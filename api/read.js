// ─────────────────────────────────────────────────────────────────────
//  /api/read — 현장사진 AI 판독 (Vercel Serverless Function, Node 20)
//
//  입력  POST { image: "data:image/jpeg;base64,…", name, site:{kind,place,no}, lang, key? }
//        key = 화면 ⑦에서 사용자가 브라우저에 저장한 Anthropic API 키(선택). 없으면 서버 환경변수 사용.
//  출력  { ok, model, hits:[{id,x,y,conf,evidence:[ko,foreign]}],
//          scene:[ko,foreign], extra:[[ko,foreign],…] }
//
//  지식베이스 19종(data/indicators.json)을 시스템 프롬프트에 넣고 Claude 비전
//  모델에 사진을 보내, 사진에서 실제로 확인되는 위험 표지만 근거와 함께 받는다.
//  키가 없거나(no_key) 거부되거나(bad_key) 호출이 실패하면 ok:false 를 돌려주고,
//  프런트엔드는 키워드 판독으로 대체한다.
// ─────────────────────────────────────────────────────────────────────
const KB = require('../data/indicators.json');

const LANG_NAME = { ko: '한국어', en: 'English', zh: '中文(简体)', vi: 'Tiếng Việt', uz: "O'zbek" };
const MAX_BYTES = 5 * 1024 * 1024;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5';

function kbText() {
  return KB.map(function (x) {
    var cue = x.cue || (x.ptw && x.ptw.imp) || '';
    return x.id + ' | ' + x.name + ' | 군: ' + x.grp + ' | 판독 단서: ' + cue.slice(0, 220);
  }).join('\n');
}

function systemPrompt(lang) {
  var foreign = lang && lang !== 'ko' ? LANG_NAME[lang] || lang : null;
  return [
    '당신은 건설현장 전기작업 안전 전문가이다. 산업안전보건기준에 관한 규칙 제301~327조와',
    'KOSHA GUIDE C-C-49-2026을 근거로 현장사진을 판독한다.',
    '',
    '아래는 판독에 사용하는 위험 표지 지식베이스 19종이다. 사진에서 시각적으로 확인되거나',
    '장면상 명백히 성립하는 표지만 고른다. 추측으로 고르지 않는다.',
    '',
    kbText(),
    '',
    '출력 규칙',
    '1. JSON 하나만 출력한다. 코드펜스·설명문을 붙이지 않는다.',
    '2. 형식: {"scene":[ko' + (foreign ? ',' + 'foreign' : '') + '],',
    '   "hits":[{"id":"U01","x":46,"y":26,"conf":0.9,"evidence":[ko' + (foreign ? ',foreign' : '') + ']}],',
    '   "extra":[[ko' + (foreign ? ',foreign' : '') + ']]}',
    '3. x,y 는 해당 위험이 보이는 위치의 사진 좌표(%): 왼쪽 위 0,0 — 오른쪽 아래 100,100.',
    '4. conf 는 0~1. 0.5 미만이면 hits 에 넣지 않는다.',
    '5. evidence 는 사진에서 본 것을 한 문장으로(한국어 40자 이내).',
    '6. scene 은 작업 장면 요약 한 문장(한국어 60자 이내).',
    '7. extra 는 지식베이스에 없는 추가 위험을 한 문장씩 최대 3개. 없으면 [].',
    foreign
      ? '8. ko 다음 요소는 같은 내용의 ' + foreign + ' 번역이다. 두 요소를 반드시 함께 넣는다.'
      : '8. 배열의 원소는 한국어 하나만 넣는다.',
  ].join('\n');
}

function parseDataUrl(s) {
  var m = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(String(s || ''));
  if (!m) return null;
  return { mime: m[1], b64: m[2] };
}

function clamp(v, lo, hi) { v = Number(v); return isFinite(v) ? Math.min(hi, Math.max(lo, v)) : (lo + hi) / 2; }

function extractJson(text) {
  var t = String(text || '').trim();
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  var a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b < 0) throw new Error('no_json');
  return JSON.parse(t.slice(a, b + 1));
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, service: 'e-safety read', model: MODEL,
      key: !!process.env.ANTHROPIC_API_KEY, indicators: KB.length });
  }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, reason: 'method' });

  var body = req.body || {};
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }

  // 키 우선순위: 화면 ⑦에서 사용자가 저장한 키(요청 본문) → 서버 환경변수
  var clientKey = typeof body.key === 'string' ? body.key.trim() : '';
  if (clientKey && !/^sk-ant-[A-Za-z0-9_\-]{20,}$/.test(clientKey)) {
    return res.status(200).json({ ok: false, reason: 'bad_key' });
  }
  var key = clientKey || process.env.ANTHROPIC_API_KEY;
  var keyFrom = clientKey ? 'client' : 'server';
  if (!key) return res.status(200).json({ ok: false, reason: 'no_key' });
  var img = parseDataUrl(body.image);
  if (!img) return res.status(400).json({ ok: false, reason: 'bad_image' });
  if (img.b64.length * 0.75 > MAX_BYTES) return res.status(413).json({ ok: false, reason: 'too_large' });

  var lang = ['en', 'zh', 'vi', 'uz'].indexOf(body.lang) >= 0 ? body.lang : 'ko';
  var site = body.site || {};
  var userText = [
    '현장 정보 — 공종: ' + (site.kind || '미입력') + ' / 작업장소: ' + (site.place || '미입력') +
    ' / 파일명: ' + (body.name || ''),
    '이 사진을 판독하여 규칙대로 JSON만 출력하라.',
  ].join('\n');

  var payload = {
    model: MODEL,
    max_tokens: 1400,
    temperature: 0,
    system: systemPrompt(lang),
    messages: [{ role: 'user', content: [
      { type: 'image', source: { type: 'base64', media_type: img.mime, data: img.b64 } },
      { type: 'text', text: userText },
    ] }],
  };

  var ctrl = new AbortController();
  var timer = setTimeout(function () { ctrl.abort(); }, 28000);
  try {
    var r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: ctrl.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': key,
                 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(payload),
    });
    clearTimeout(timer);
    var data = await r.json();
    if (!r.ok) {
      return res.status(200).json({ ok: false, reason: r.status === 401 ? 'bad_key' : 'api_' + r.status,
        keyFrom: keyFrom, detail: data && data.error && data.error.message });
    }
    var text = (data.content || []).filter(function (c) { return c.type === 'text'; })
      .map(function (c) { return c.text; }).join('\n');
    var out = extractJson(text);
    var ids = {}; KB.forEach(function (x) { ids[x.id] = true; });
    var seen = {};
    var hits = (out.hits || []).filter(function (h) {
      return h && ids[h.id] && !seen[h.id] && Number(h.conf) >= 0.5 && (seen[h.id] = true);
    }).map(function (h) {
      var ev = Array.isArray(h.evidence) ? h.evidence : [String(h.evidence || '')];
      return { id: h.id, x: Math.round(clamp(h.x, 3, 97)), y: Math.round(clamp(h.y, 3, 97)),
               conf: Math.round(clamp(h.conf, 0, 1) * 100) / 100,
               evidence: ev.slice(0, 2).map(String) };
    });
    var scene = Array.isArray(out.scene) ? out.scene.slice(0, 2).map(String) : [String(out.scene || '')];
    var extra = (Array.isArray(out.extra) ? out.extra : []).slice(0, 3).map(function (e) {
      return (Array.isArray(e) ? e : [String(e)]).slice(0, 2).map(String); });
    return res.status(200).json({ ok: true, model: MODEL, lang: lang, hits: hits, scene: scene, extra: extra,
      keyFrom: keyFrom, usage: data.usage });
  } catch (e) {
    clearTimeout(timer);
    return res.status(200).json({ ok: false, reason: e.name === 'AbortError' ? 'timeout' : 'error',
      detail: String(e && e.message || e) });
  }
};
