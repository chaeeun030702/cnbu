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
const MODEL = process.env.ANTHROPIC_ILLUST_MODEL || process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
const WORKSPACE = process.env.ANTHROPIC_WORKSPACE_ID || '';

function apiHeaders(key) {
  var h = { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' };
  if (WORKSPACE) h['anthropic-workspace-id'] = WORKSPACE;
  return h;
}

const SYSTEM = [
  'You are a professional technical illustrator who draws the figures for official occupational-safety training manuals',
  '(the quality of KOSHA / HSE / OSHA guidance booklets) used by university safety-engineering students and site supervisors.',
  'Output exactly ONE <svg> element and nothing else (no code fence, no explanation).',
  'Style and quality (this is NOT a children\'s picture — avoid cartoon, chibi or toy-like figures):',
  '- Semi-realistic vector illustration, 3/4 (isometric-like) viewpoint with believable perspective and depth.',
  '- Adult workers with correct anatomy: head about 1/7.5 of body height, visible joints, natural working posture, hands that actually grip the tool.',
  '- Shading: use linearGradient/radialGradient for volume (light from upper left), soft cast shadows on the ground, thin dark outlines (0.8–1.2 px).',
  '- Realistic, muted site palette (concrete grey, earth brown, steel blue, safety yellow/orange accents); no flat pastel sky-blue backgrounds.',
  '- Technically correct equipment drawn with real details: hard hat with chin strap, hi-vis vest with reflective bands, safety boots;',
  '  electrical items when relevant — distribution panel with breakers and RCD test button, plugs/sockets with covers, voltage tester,',
  '  lock-out padlock and tag, rubber insulating gloves with leather over-gloves, insulating boots, insulating mat, cable stands or hangers.',
  '- Background: a recognisable construction site (excavation, formwork, temporary fence, scaffold, building frame) filling the full 400x300 frame,',
  '  drawn with lower contrast so the subject stands out.',
  '- Show the SPECIFIC situation of the item clearly and large in the centre, so a supervisor understands it without words.',
  '- If the item is a HAZARD: depict the unsafe act or condition exactly as described (no red X; a badge is added later).',
  '- If the item is a REQUIRED MEASURE: depict the correct practice exactly as described, and nothing unsafe anywhere in the frame:',
  '  cables are never lying on the ground or in water (they hang on stands or hangers), workers stand upright on dry ground or an insulating mat',
  '  and do not kneel or sit in mud or water (no check marks; a badge is added later).',
  '- Keep the top-right 60x60 corner free of important detail (a badge goes there). Faces simple and not identifiable.',
  '- Root: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">. No width/height attributes.',
  '- No text, letters or numbers anywhere. No <script>, <image>, <foreignObject>, external links or animation.',
  '- Use only path, rect, circle, ellipse, line, polyline, polygon, g, defs, linearGradient, radialGradient, stop, clipPath, filter, feGaussianBlur, feOffset, feMerge, feMergeNode, feFlood, feComposite.',
  '- About 250–450 elements; prefer detailed paths over many tiny primitives.',
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
  if (s.length > 400000) return null;
  return 'data:image/svg+xml;base64,' + Buffer.from(s, 'utf8').toString('base64');
}

async function draw(key, item, scene) {
  var text = (item.ok ? 'REQUIRED MEASURE' : 'HAZARD') + ' item (Korean): ' + String(item.title || '').slice(0, 160) +
    (item.cause ? '\nDetail: ' + String(item.cause).slice(0, 200) : '') +
    (scene ? '\nSite context: ' + String(scene).slice(0, 200) : '') + '\nDraw it now.';
  var ctrl = new AbortController(); var timer = setTimeout(function () { ctrl.abort(); }, 280000);
  try {
    var r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: ctrl.signal, headers: apiHeaders(key),
      body: JSON.stringify({ model: MODEL, max_tokens: 24000, output_config: { effort: 'medium' }, system: SYSTEM,
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
