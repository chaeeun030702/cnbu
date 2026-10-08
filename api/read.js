// ─────────────────────────────────────────────────────────────────────
//  /api/read — 현장사진 AI 판독 (Vercel Serverless Function, Node 20)
//
//  입력  POST { image: "data:image/jpeg;base64,…", name, site:{kind,place,no}, lang, key? }
//        key = 화면 ⑦에서 사용자가 브라우저에 저장한 Anthropic API 키(선택). 없으면 서버 환경변수 사용.
//  출력  { ok, model, domain:'elec'|'gen', hits:[{id,x,y,conf,evidence:[ko,foreign]}],
//          scene:[ko,foreign], extra:[[ko,foreign],…] }
//
//  지식베이스 39종(data/indicators.json — 전기 U01~U19 · 일반 G01~G20)을 시스템 프롬프트에 넣고 Claude 비전
//  모델에 사진을 보내, 사진에서 실제로 확인되는 위험 표지만 근거와 함께 받는다.
//  키가 없거나(no_key) 거부되거나(bad_key) 호출이 실패하면 ok:false 를 돌려주고,
//  프런트엔드는 키워드 판독으로 대체한다.
// ─────────────────────────────────────────────────────────────────────
const KB = require('../data/indicators.json');

const LANG_NAME = { ko: '한국어', en: 'English', zh: '中文(简体)', vi: 'Tiếng Việt', uz: "O'zbek" };
const MAX_BYTES = 5 * 1024 * 1024;
// 사진 판독 모델 — 기본 Claude Sonnet 5.5. 바꾸려면 Vercel 환경변수 ANTHROPIC_READ_MODEL 에 모델 이름(예: claude-opus-5-5)을 넣는다.
const MODEL = process.env.ANTHROPIC_READ_MODEL || 'claude-sonnet-5-5';
// 워크스페이스에 묶이지 않은 키(sk-ant-usr-…)는 anthropic-workspace-id 헤더가 필요하다
const WORKSPACE = process.env.ANTHROPIC_WORKSPACE_ID || '';

function kbText(dom) {
  return KB.filter(function (x) { return x.dom === dom; }).map(function (x) {
    var cue = x.cue || (x.ptw && x.ptw.imp) || '';
    return x.id + ' | ' + x.name + ' | 군: ' + x.grp + ' | 판독 단서: ' + cue.slice(0, 220);
  }).join('\n');
}

function systemPrompt(lang) {
  var foreign = lang && lang !== 'ko' ? LANG_NAME[lang] || lang : null;
  return [
    '당신은 건설현장 안전 전문가이다. 산업안전보건기준에 관한 규칙과 KOSHA GUIDE C-C-49-2026',
    '「안전작업허가에 관한 기술지원규정」(2026. 1. 30. 개정)을 근거로 현장사진을 판독한다.',
    '',
    '먼저 사진의 작업 영역(domain)을 정한다.',
    ' - "elec": 전기설비 작업(분전반·배전반·전선·케이블·활선·변압기·전동공구 전원부 등이 작업 대상)',
    ' - "gen" : 전기설비 부문 외 일반 건설작업(비계·고소·굴착·양중·건설기계·거푸집·해체·용접·밀폐공간·운반 등)',
    '',
    '아래는 판독에 사용하는 위험 표지 지식베이스 39종이다. 사진에서 시각적으로 확인되거나',
    '장면상 명백히 성립하는 표지만 고른다. 추측으로 고르지 않는다. 두 영역의 표지를 함께 골라도 된다.',
    '',
    '[전기설비부문 표지 U01~U19]',
    kbText('elec'),
    '',
    '[일반작업 표지 G01~G20]',
    kbText('gen'),
    '',
    '[1단계 — 사람마다 안전모부터 확인한다 (표지를 고르기 전에 반드시 먼저)]',
    '사진 속 사람을 모두 찾아 왼쪽부터 번호를 매기고, 사람마다 아래 순서로 하나씩 본다. 첫인상이나 지식베이스 단서 문장의 예시에 끌려 "착용했다"고 가정하지 않는다.',
    ' ① head(머리·안전모): "insulating_helmet"(전기용 절연모) | "hard_hat"(일반 안전모) | "none"(맨머리·일반 모자·두건·머리카락이 보임) | "unclear"',
    '    안전모가 있으면 턱끈 체결 여부도 본다: chin "fastened" | "unfastened" | "unclear"',
    ' ② hands: "insulating_gloves" | "work_gloves"(면·코팅장갑) | "bare"(맨손) | "unclear"',
    ' ③ feet: "insulating_boots" | "safety_shoes" | "other"(일반 신발·장화) | "unclear"',
    ' ④ body: "hi_vis" | "harness" | "none" | "unclear" (여러 개면 쉼표로)',
    '그림·일러스트·만화도 실제 사진과 같은 기준으로 본다.',
    '전기 작업에서 head 가 insulating_helmet 이 아니거나, hands 가 insulating_gloves 가 아니거나, feet 이 insulating_boots 가 아니면 U05 를 고르고,',
    'evidence 에 빠진 보호구를 모두 적는다(예: "절연모 없이 맨머리, 맨손, 일반 장화"). head 가 none 이거나 턱끈 미체결이면 G16 도 고른다.',
    '',
    '[2단계 — 위치는 정밀하게]',
    ' - 각 위험마다 box:[x1,y1,x2,y2] 로 그 위험 물체를 꼭 맞게 감싸는 상자를 준다(사진 좌표 %, 왼쪽 위 0,0 — 오른쪽 아래 100,100, 소수점 1자리).',
    ' - 상자는 사람 전체나 넓은 배경이 아니라 위험 그 자체에 맞춘다: 안전모 미착용→그 사람의 머리, 맨손→손, 노출 충전부→단자·버스바, 물속 케이블→물에 잠긴 케이블 구간, 개구부→구멍 가장자리.',
    ' - 같은 위험이 여러 곳이면 가장 뚜렷한 한 곳을 고른다. 사람별 ppe 에는 그 사람의 머리 상자 head_box 를 준다.',
    '',
    '출력 규칙',
    '1. JSON 하나만 출력한다. 코드펜스·설명문을 붙이지 않는다.',
    '2. 형식: {"domain":"elec"|"gen","scene":[ko' + (foreign ? ',foreign' : '') + '],',
    '   "ppe":[{"person":1,"head":"none","chin":"unclear","hands":"bare","feet":"other","body":"none","head_box":[40.5,20.0,52.0,34.5]}],',
    '   "hits":[{"id":"G01","box":[40.0,18.5,55.5,35.0],"conf":0.9,"evidence":[ko' + (foreign ? ',foreign' : '') + ']}],',
    '   "extra":[{"text":[ko' + (foreign ? ',foreign' : '') + '],"box":[10.0,60.0,30.0,80.0]}]}',
    '3. conf 는 0~1. 0.5 미만이면 hits 에 넣지 않는다.',
    '4. evidence 는 사진에서 본 것을 한 문장으로(한국어 40자 이내).',
    '5. scene 은 작업 장면 요약 한 문장(한국어 60자 이내).',
    '6. extra 는 지식베이스에 없는 추가 위험 최대 3개. 각각 text(한 문장)와 위치 box 를 반드시 준다. 없으면 [].',
    '7. domain 은 사진의 주된 작업으로 정한다. 전기설비가 작업 대상이 아니면 "gen".',
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

function apiHeaders(key) {
  var h = { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' };
  if (WORKSPACE) h['anthropic-workspace-id'] = WORKSPACE;
  return h;
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
    var info = { ok: true, service: 'e-safety read', model: MODEL,
      key: !!process.env.ANTHROPIC_API_KEY, workspace: !!WORKSPACE, indicators: KB.length,
      commit: (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) };
    // GET /api/read?test=1 → 서버 키로 짧은 텍스트 요청을 보내 Anthropic 응답을 그대로 보여준다(진단용)
    if (req.query && req.query.test && process.env.ANTHROPIC_API_KEY) {
      try {
        var tr = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST', headers: apiHeaders(process.env.ANTHROPIC_API_KEY),
          body: JSON.stringify({ model: MODEL, max_tokens: 256, output_config: { effort: 'low' },
            messages: [{ role: 'user', content: 'Reply with OK.' }] }),
        });
        var td = await tr.json();
        info.test = tr.ok ? { status: tr.status, stop_reason: td.stop_reason }
                          : { status: tr.status, error: td && td.error && td.error.message };
      } catch (e) { info.test = { error: String(e && e.message || e) }; }
    }
    return res.status(200).json(info);
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
    // Sonnet 5.5 는 temperature 등 샘플링 값을 기본값 외로 주면 400 을 돌려준다 → 보내지 않는다.
    // thinking 은 끌 수 없으므로 effort 를 낮춰 지연을 줄이고, 생각 토큰까지 감안해 max_tokens 를 넉넉히 둔다.
    max_tokens: 8000,
    output_config: { effort: 'medium' },
    system: systemPrompt(lang),
    messages: [{ role: 'user', content: [
      { type: 'image', source: { type: 'base64', media_type: img.mime, data: img.b64 } },
      { type: 'text', text: userText },
    ] }],
  };

  var ctrl = new AbortController();
  var timer = setTimeout(function () { ctrl.abort(); }, 110000);
  try {
    var r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: ctrl.signal,
      headers: apiHeaders(key),
      body: JSON.stringify(payload),
    });
    clearTimeout(timer);
    var data = await r.json();
    if (!r.ok) {
      return res.status(200).json({ ok: false, reason: r.status === 401 ? 'bad_key' : 'api_' + r.status,
        keyFrom: keyFrom, detail: data && data.error && data.error.message });
    }
    if (data.stop_reason === 'refusal' || data.stop_reason === 'max_tokens') {
      return res.status(200).json({ ok: false, reason: data.stop_reason, keyFrom: keyFrom });
    }
    var text = (data.content || []).filter(function (c) { return c.type === 'text'; })
      .map(function (c) { return c.text; }).join('\n');
    var out = extractJson(text);
    var ids = {}; KB.forEach(function (x) { ids[x.id] = true; });
    var seen = {};
    // 위치: box 의 중심(없으면 x,y)을 쓴다 — 소수점 1자리 %
    var ctr = function (o, dx, dy) {
      var b = o && Array.isArray(o.box) ? o.box : (o && Array.isArray(o.head_box) ? o.head_box : null);
      if (b && b.length === 4 && b.every(function (v) { return isFinite(Number(v)); })) {
        var x1 = Math.min(b[0], b[2]), x2 = Math.max(b[0], b[2]), y1 = Math.min(b[1], b[3]), y2 = Math.max(b[1], b[3]);
        return [Math.round(clamp((x1 + x2) / 2, 2, 98) * 10) / 10, Math.round(clamp((y1 + y2) / 2, 2, 98) * 10) / 10];
      }
      return [Math.round(clamp(o && o.x != null ? o.x : dx, 2, 98) * 10) / 10, Math.round(clamp(o && o.y != null ? o.y : dy, 2, 98) * 10) / 10];
    };
    var hits = (out.hits || []).filter(function (h) {
      return h && ids[h.id] && !seen[h.id] && Number(h.conf) >= 0.5 && (seen[h.id] = true);
    }).map(function (h) {
      var ev = Array.isArray(h.evidence) ? h.evidence : [String(h.evidence || '')], c = ctr(h, 50, 50);
      return { id: h.id, x: c[0], y: c[1], conf: Math.round(clamp(h.conf, 0, 1) * 100) / 100, evidence: ev.slice(0, 2).map(String) };
    });
    var scene = Array.isArray(out.scene) ? out.scene.slice(0, 2).map(String) : [String(out.scene || '')];
    var extra = (Array.isArray(out.extra) ? out.extra : []).slice(0, 3).map(function (e, k) {
      var t = e && !Array.isArray(e) && typeof e === 'object' ? e.text : e;
      var c = e && typeof e === 'object' && !Array.isArray(e) ? ctr(e, 20 + k * 30, 85) : null;
      return { text: (Array.isArray(t) ? t : [String(t || '')]).slice(0, 2).map(String), x: c ? c[0] : null, y: c ? c[1] : null };
    }).filter(function (e) { return e.text[0]; });
    var domain = out.domain === 'gen' || out.domain === 'elec' ? out.domain : null;
    // 사람별 보호구 점검(안전모 먼저) 결과로 빠진 표지를 보완한다
    var ppe = (Array.isArray(out.ppe) ? out.ppe : []).slice(0, 8);
    var KO = { head: { none: '맨머리(안전모·절연모 없음)', hard_hat: '일반 안전모(절연모 아님)' }, hands: { bare: '맨손', work_gloves: '일반 장갑(절연장갑 아님)' }, feet: { other: '일반 신발(절연화 아님)', safety_shoes: '안전화(절연화 아님)' } };
    var find = function (id) { return hits.filter(function (h) { return h.id === id; })[0]; };
    var isElec = (domain || 'elec') === 'elec' || hits.some(function (h) { return h.id.charAt(0) === 'U'; });
    ppe.forEach(function (p, n) {
      if (!p) return; var miss = [], hc = ctr({ head_box: p.head_box, x: p.x, y: p.y }, 50, 30), who = ppe.length > 1 ? '작업자 ' + (p.person || n + 1) + ': ' : '';
      ['head', 'hands', 'feet'].forEach(function (k) { var v = String(p[k] || ''); if (KO[k][v]) miss.push(KO[k][v]); });
      if (isElec && miss.length) {
        var ev = who + miss.join(', '), h5 = find('U05');
        if (h5) { if (!/절연모|맨머리|안전모/.test(h5.evidence[0]) && /맨머리|안전모/.test(ev)) h5.evidence[0] = h5.evidence[0] + ' / ' + ev; }
        else hits.push({ id: 'U05', x: hc[0], y: hc[1], conf: 0.8, evidence: ['보호구 점검 — ' + ev] });
      }
      var noHelmet = String(p.head) === 'none', noChin = String(p.chin) === 'unfastened' && String(p.head) !== 'none';
      if (noHelmet || noChin) {
        var g = find('G16'), ev2 = who + (noHelmet ? '안전모 미착용(맨머리)' : '안전모 턱끈 미체결');
        if (g) { if (!/안전모|맨머리|턱끈/.test(g.evidence[0])) g.evidence[0] = g.evidence[0] + ' / ' + ev2; g.x = hc[0]; g.y = hc[1]; }
        else hits.push({ id: 'G16', x: hc[0], y: hc[1], conf: 0.8, evidence: ['보호구 점검 — ' + ev2] });
      }
    });
    if (!domain && hits.length) {
      var ng = hits.filter(function (h) { return h.id.charAt(0) === 'G'; }).length;
      domain = ng > hits.length - ng ? 'gen' : 'elec';
    }
    return res.status(200).json({ ok: true, model: MODEL, lang: lang, domain: domain, hits: hits, scene: scene, extra: extra, ppe: ppe,
      keyFrom: keyFrom, usage: data.usage });
  } catch (e) {
    clearTimeout(timer);
    return res.status(200).json({ ok: false, reason: e.name === 'AbortError' ? 'timeout' : 'error',
      detail: String(e && e.message || e) });
  }
};
