// ─────────────────────────────────────────────────────────────────────
//  /api/illust — 안전포스터 항목 그림 자동 생성 (Vercel Serverless Function, Node 20)
//
//  입력  POST { items:[{ title, cause, ok }], scene, key? }   (최대 6개)
//        title = 항목 문구(한국어), cause = 보충 설명, ok = true 면 지켜야 할 모습 / false 면 위험한 모습
//        key   = 화면 ⑧에서 사용자가 브라우저에 저장한 Anthropic API 키(선택). 없으면 서버 환경변수.
//  출력  { ok, model, svgs:[ "data:image/svg+xml;base64,…" | null, … ] }  |  { ok:false, reason }
//
//  Claude 가 항목마다 4:3 평면 일러스트(SVG)를 그린다. 실사 사진이 아니라 안전교육 교재풍 그림이다.
//  받은 SVG 는 스크립트·이벤트 속성·외부 링크를 지운 뒤 data URI 로 돌려준다.
// ─────────────────────────────────────────────────────────────────────
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
const WORKSPACE = process.env.ANTHROPIC_WORKSPACE_ID || '';

function apiHeaders(key) {
  var h = { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' };
  if (WORKSPACE) h['anthropic-workspace-id'] = WORKSPACE;
  return h;
}

const SYSTEM = [
  'You draw illustrations for a multilingual construction-safety poster used by foreign workers in Korea.',
  'Output exactly ONE <svg> element and nothing else (no code fence, no explanation).',
  'Rules:',
  '- Root: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">. No width/height attributes.',
  '- Flat vector style like a safety-training manual: clean shapes, soft flat colors, thin dark outlines, a full background',
  '  (sky, ground, building or excavation) that fills the whole 400x300 frame.',
  '- Workers: simple but correct human proportions, white hard hat, navy work clothes; faces simple, no identifiable people.',
  '- Show the SPECIFIC situation of the item clearly and large in the center, so it is understood without words.',
  '- If the item is a HAZARD: depict the unsafe act or condition as it happens (do not draw red X marks; a badge is added later).',
  '- If the item is a REQUIRED MEASURE: depict the correct safe practice being done (no check marks; a badge is added later).',
  '- Keep the top-right 60x60 corner free of important detail (a badge goes there).',
  '- No text, letters or numbers anywhere. No <script>, <image>, <foreignObject>, external links, filters or animation.',
  '- Use only path, rect, circle, ellipse, line, polyline, polygon, g, defs, linearGradient, radialGradient, stop.',
  '- Keep it under about 150 elements.',
].join('\n');

function clean(svg) {
  var s = String(svg || '');
  var a = s.indexOf('<svg'), b = s.lastIndexOf('</svg>');
  if (a < 0 || b < 0) return null;
  s = s.slice(a, b + 6);
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
       .replace(/<image\b[^>]*>/gi, '').replace(/<(animate|set|animateTransform|animateMotion)\b[^>]*\/?>/gi, '')
       .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
       .replace(/\s(?:xlink:)?href\s*=\s*("(?!#)[^"]*"|'(?!#)[^']*')/gi, '');
  if (!/xmlns=/.test(s.slice(0, 200))) s = s.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  if (s.length > 200000) return null;
  return 'data:image/svg+xml;base64,' + Buffer.from(s, 'utf8').toString('base64');
}

async function draw(key, item, scene) {
  var text = (item.ok ? 'REQUIRED MEASURE' : 'HAZARD') + ' item (Korean): ' + String(item.title || '').slice(0, 160) +
    (item.cause ? '\nDetail: ' + String(item.cause).slice(0, 200) : '') +
    (scene ? '\nSite context: ' + String(scene).slice(0, 200) : '') + '\nDraw it now.';
  var ctrl = new AbortController(); var timer = setTimeout(function () { ctrl.abort(); }, 110000);
  try {
    var r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: ctrl.signal, headers: apiHeaders(key),
      body: JSON.stringify({ model: MODEL, max_tokens: 12000, output_config: { effort: 'low' }, system: SYSTEM,
        messages: [{ role: 'user', content: text }] }),
    });
    clearTimeout(timer);
    var d = await r.json();
    if (!r.ok) return { err: r.status === 401 ? 'bad_key' : 'api_' + r.status };
    var t = (d.content || []).filter(function (c) { return c.type === 'text'; }).map(function (c) { return c.text; }).join('\n');
    var u = clean(t);
    return u ? { svg: u } : { err: 'no_svg' };
  } catch (e) { clearTimeout(timer); return { err: e.name === 'AbortError' ? 'timeout' : 'error' }; }
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') return res.status(200).json({ ok: true, service: 'e-safety illust', model: MODEL, key: !!process.env.ANTHROPIC_API_KEY });
  if (req.method !== 'POST') return res.status(405).json({ ok: false, reason: 'method' });
  var body = req.body || {};
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  var clientKey = typeof body.key === 'string' ? body.key.trim() : '';
  if (clientKey && !/^sk-ant-[A-Za-z0-9_\-]{20,}$/.test(clientKey)) return res.status(200).json({ ok: false, reason: 'bad_key' });
  var key = clientKey || process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(200).json({ ok: false, reason: 'no_key' });
  var items = (Array.isArray(body.items) ? body.items : []).slice(0, 6);
  if (!items.length) return res.status(400).json({ ok: false, reason: 'items' });
  var out = await Promise.all(items.map(function (it) { return draw(key, it || {}, body.scene); }));
  return res.status(200).json({ ok: out.some(function (o) { return o.svg; }), model: MODEL,
    svgs: out.map(function (o) { return o.svg || null; }), errors: out.map(function (o) { return o.err || null; }) });
};
