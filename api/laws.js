// ─────────────────────────────────────────────────────────────────────
//  /api/laws — 법령 최신화 확인 (Vercel Serverless, Node 20)
//
//  입력  POST { laws:[{name, cites:['제301조 [전기 기계·기구 등의 충전부 방호]', …]}], key? }
//  출력  { ok, model, checked:'YYYY-MM-DD', laws:[{ name, promulgated, effective, amended:bool|null,
//           summary, source, changes:[{ from, to, note }] }] }
//  Claude 웹 검색(국가법령정보센터 등 공공 사이트만)으로 각 법령의 최신 공포·시행일을 찾고,
//  문서가 인용한 조문의 번호·제목이 바뀌었으면 바꿀 문구(from → to)를 제안한다.
//  AI는 최초 검토, 최종 반영은 관리감독자가 화면에서 고른다.
// ─────────────────────────────────────────────────────────────────────
const MODEL = process.env.ANTHROPIC_LAW_MODEL || process.env.ANTHROPIC_READ_MODEL || 'claude-sonnet-5-5';
const WORKSPACE = process.env.ANTHROPIC_WORKSPACE_ID || '';
const DOMAINS = ['law.go.kr', 'moleg.go.kr', 'moel.go.kr', 'kosha.or.kr', 'korea.kr', 'lawmaking.go.kr'];

function headers(key) {
  const h = { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' };
  // Workspace ID는 서버 키와 Workspace에 묶이지 않은 키(sk-ant-usr-…)에만 붙인다. 화면에 넣은 일반 API 키(sk-ant-api…)에는 붙이지 않는다
  if (WORKSPACE && /^sk-ant-usr/.test(String(key || '').trim()) || WORKSPACE && String(key || '').trim() === String(process.env.ANTHROPIC_API_KEY || '').trim().replace(/^["']|["']$/g, '')) h['anthropic-workspace-id'] = WORKSPACE;
  return h;
}
function extractJson(text) {
  let t = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b < 0) throw new Error('no_json');
  return JSON.parse(t.slice(a, b + 1));
}
const S = (v, n) => String(v == null ? '' : v).slice(0, n || 400);

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') return res.status(200).json({ ok: true, service: 'e-safety laws', model: MODEL, key: !!process.env.ANTHROPIC_API_KEY });
  if (req.method !== 'POST') return res.status(405).json({ ok: false, reason: 'method' });
  let body = req.body || {};
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const ck = typeof body.key === 'string' ? body.key.trim() : '';
  if (ck && !/^sk-ant-[A-Za-z0-9_\-]{20,}$/.test(ck)) return res.status(200).json({ ok: false, reason: 'bad_key' });
  const key = ck || process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(200).json({ ok: false, reason: 'no_key' });

  const laws = (Array.isArray(body.laws) ? body.laws : []).slice(0, 10).map(function (l) {
    return { name: S(l && l.name, 80), cites: (Array.isArray(l && l.cites) ? l.cites : []).slice(0, 200).map(function (c) { return S(c, 160); }) };
  }).filter(function (l) { return l.name; });
  if (!laws.length) return res.status(400).json({ ok: false, reason: 'no_laws' });

  const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);   // 한국 날짜
  const system = [
    '너는 한국 산업안전 법령 담당자다. 오늘은 ' + today + '이다.',
    '웹 검색으로 국가법령정보센터(law.go.kr) 등 공공 사이트에서 아래 법령 각각의 "현행" 최신 공포일·시행일을 확인한다.',
    '그리고 문서가 인용한 조문(번호와 [제목]) 가운데 현행 법령에서 번호·제목이 바뀌었거나 삭제·이동된 것이 있으면 바꿀 문구를 제안한다.',
    '규칙:',
    '1. 확인하지 못한 값은 지어내지 말고 빈 문자열, amended 는 null 로 둔다.',
    '2. changes 의 from 은 입력 cites 문구를 글자 그대로 복사한다. to 는 현행 기준의 같은 형식 문구다. 바뀐 게 없으면 changes 는 빈 배열.',
    '3. 시행 예정(아직 시행 전) 개정은 summary 에 "시행 예정"으로 적고 changes 에는 넣지 않는다.',
    '4. summary 는 최근 개정 요지를 한국어 한두 문장으로.',
    '5. source 는 확인한 페이지 주소 하나.',
    '출력은 JSON 하나만: {"laws":[{"name":"","promulgated":"YYYY-MM-DD","effective":"YYYY-MM-DD","amended":true,"summary":"","source":"","changes":[{"from":"","to":"","note":""}]}]}',
    'amended 는 "문서가 인용한 조문에 영향이 있는 개정이 있는지" 여부다.',
  ].join('\n');
  const user = '확인할 법령과 문서가 인용한 조문:\n' + laws.map(function (l, i) {
    return (i + 1) + '. ' + l.name + (l.cites.length ? '\n   인용: ' + l.cites.join(' | ') : '');
  }).join('\n');

  let messages = [{ role: 'user', content: user }];
  const ctrl = new AbortController();
  const timer = setTimeout(function () { ctrl.abort(); }, 280000);
  try {
    let d = null, text = '';
    for (let turn = 0; turn < 4; turn++) {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', signal: ctrl.signal, headers: headers(key),
        body: JSON.stringify({ model: MODEL, max_tokens: 12000, output_config: { effort: 'medium' }, system: system, messages: messages,
          tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 12, allowed_domains: DOMAINS }] }),
      });
      d = await r.json();
      if (!r.ok) return res.status(200).json({ ok: false, reason: 'api_' + r.status, error: d && d.error && d.error.message });
      text = (d.content || []).filter(function (c) { return c.type === 'text'; }).map(function (c) { return c.text; }).join('\n');
      if (d.stop_reason !== 'pause_turn') break;
      messages = messages.concat([{ role: 'assistant', content: d.content }]);   // 긴 검색은 이어서 진행
    }
    let out;
    try { out = extractJson(text); } catch (e) { return res.status(200).json({ ok: false, reason: 'parse', raw: S(text, 600) }); }
    const map = {};
    (out.laws || []).forEach(function (x) { if (x && x.name) map[String(x.name).replace(/\s/g, '')] = x; });
    const result = laws.map(function (l) {
      const x = map[l.name.replace(/\s/g, '')] || {};
      const ch = (Array.isArray(x.changes) ? x.changes : []).map(function (c) { return { from: S(c && c.from, 160), to: S(c && c.to, 160), note: S(c && c.note, 200) }; })
        .filter(function (c) { return c.from && c.to && c.from !== c.to && l.cites.indexOf(c.from) >= 0; });
      return { name: l.name, promulgated: S(x.promulgated, 10), effective: S(x.effective, 10),
        amended: x.amended === true || x.amended === false ? x.amended : null,
        summary: S(x.summary, 300), source: /^https?:\/\//.test(x.source || '') ? S(x.source, 300) : '', changes: ch };
    });
    return res.status(200).json({ ok: true, model: MODEL, checked: today, laws: result });
  } catch (e) {
    return res.status(200).json({ ok: false, reason: e && e.name === 'AbortError' ? 'timeout' : 'error', error: S(e && e.message, 200) });
  } finally { clearTimeout(timer); }
};
