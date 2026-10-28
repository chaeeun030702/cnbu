// ─────────────────────────────────────────────────────────────────────
//  /api/tr — 위험성평가표에서 관리감독자가 고치거나 추가한 한국어 문장을 다국어로 번역 (Vercel Serverless, Node 20)
//
//  입력  POST { items:[{k, t}], key? }   k = 문장 키, t = 한국어 문장 (최대 40개)
//  출력  { ok, out:{ k:{en,zh,vi,uz} } } | { ok:false, reason }
//  「외국인 노동자를 위한 안전보건용어 400선」 표준 대역어가 문장에 있으면 그 용어를 우선 쓰도록 함께 보낸다.
// ─────────────────────────────────────────────────────────────────────
const fs = require('fs');
const path = require('path');
const MODEL = process.env.ANTHROPIC_TR_MODEL || process.env.ANTHROPIC_READ_MODEL || 'claude-sonnet-5-5';
const WORKSPACE = process.env.ANTHROPIC_WORKSPACE_ID || '';

let GLOSS = null;
function gloss() {
  if (GLOSS) return GLOSS;
  try {
    const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'data.js'), 'utf8');
    const m = /var GLOSS=(\[[\s\S]*?\]\]);/.exec(src);
    GLOSS = m ? JSON.parse(m[1]) : [];
  } catch (e) { GLOSS = []; }
  return GLOSS;
}
function headers(key) {
  const h = { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' };
  if (WORKSPACE) h['anthropic-workspace-id'] = WORKSPACE;
  return h;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') return res.status(200).json({ ok: true, service: 'e-safety tr', model: MODEL, key: !!process.env.ANTHROPIC_API_KEY });
  if (req.method !== 'POST') return res.status(405).json({ ok: false, reason: 'method' });
  let body = req.body || {};
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const ck = typeof body.key === 'string' ? body.key.trim() : '';
  if (ck && !/^sk-ant-[A-Za-z0-9_\-]{20,}$/.test(ck)) return res.status(200).json({ ok: false, reason: 'bad_key' });
  const key = ck || process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(200).json({ ok: false, reason: 'no_key' });
  const items = (Array.isArray(body.items) ? body.items : []).slice(0, 40)
    .map(function (x) { return { k: String(x && x.k || '').slice(0, 80), t: String(x && x.t || '').slice(0, 600) }; })
    .filter(function (x) { return x.k && x.t.trim(); });
  if (!items.length) return res.status(200).json({ ok: true, out: {} });
  const all = items.map(function (x) { return x.t; }).join('\n');
  const terms = gloss().filter(function (g) { return g[0] && g[0].length >= 2 && all.indexOf(g[0]) >= 0; }).slice(0, 60)
    .map(function (g) { return g[0] + ' = 中文 ' + g[1] + ' / Tiếng Việt ' + g[2] + ' / Oʻzbek ' + g[3]; });
  const sys = [
    '건설현장 위험성평가표 문장을 외국인 근로자용으로 번역한다. 뜻을 바꾸지 말고 짧고 쉬운 현장 용어로 옮긴다.',
    '아래 「안전보건용어 400선」 표준 대역어가 문장에 나오면 반드시 그 대역어를 쓴다.',
    terms.length ? terms.join('\n') : '(해당 용어 없음)',
    'JSON 하나만 출력한다: {"키":{"en":"…","zh":"…(简体)","vi":"…","uz":"…(lotin)"}, …}. 코드펜스·설명 금지.',
  ].join('\n');
  const user = items.map(function (x) { return x.k + ' :: ' + x.t.replace(/\s+/g, ' '); }).join('\n');
  const ctrl = new AbortController(); const timer = setTimeout(function () { ctrl.abort(); }, 90000);
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', signal: ctrl.signal, headers: headers(key),
      body: JSON.stringify({ model: MODEL, max_tokens: 8000, output_config: { effort: 'low' }, system: sys, messages: [{ role: 'user', content: user }] }) });
    clearTimeout(timer); const d = await r.json();
    if (!r.ok) return res.status(200).json({ ok: false, reason: r.status === 401 ? 'bad_key' : 'api_' + r.status });
    let t = (d.content || []).filter(function (c) { return c.type === 'text'; }).map(function (c) { return c.text; }).join('\n').trim();
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const o = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)), out = {};
    items.forEach(function (x) { const v = o[x.k]; if (v && typeof v === 'object') out[x.k] = { en: String(v.en || ''), zh: String(v.zh || ''), vi: String(v.vi || ''), uz: String(v.uz || '') }; });
    return res.status(200).json({ ok: true, model: MODEL, out: out });
  } catch (e) {
    clearTimeout(timer);
    return res.status(200).json({ ok: false, reason: e.name === 'AbortError' ? 'timeout' : 'error' });
  }
};
