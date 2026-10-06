// ─────────────────────────────────────────────────────────────────────
//  /api/poster — 실사 안전포스터 자동 생성 (Vercel Serverless Function, Node 20)
//
//  입력  POST { prompt, photo: "data:image/jpeg;base64,…", mode: 'full'|'card', key? }
//        prompt = 홈페이지(Claude 판독 결과 → 포스터 문구)가 만든 이미지 지시문
//        photo  = 현장사진(1024px 이하로 줄인 것)
//        key    = 화면 ⑦에서 사용자가 브라우저에 저장한 OpenAI API 키(선택). 없으면 서버 환경변수 OPENAI_API_KEY.
//  출력  { ok, model, image: "data:image/png;base64,…" }  |  { ok:false, error }
//
//  mode 'full' : 샘플 포스터 레이아웃(api/_ref/layout.jpg — 기관 로고를 지운 사본)과 현장사진을 함께 보내
//                같은 구성의 A3 세로 실사 포스터를 만든다(1024×1536).
//  mode 'card' : 현장사진만 보내 포스터 오른쪽 ‘올바른 작업’ 카드 사진을 만든다(1536×1024).
// ─────────────────────────────────────────────────────────────────────
const fs = require('fs');
const path = require('path');

const MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
const QUALITY = process.env.OPENAI_IMAGE_QUALITY || 'medium';
const MAX_PHOTO = 4 * 1024 * 1024;
const MAX_PROMPT = 6000;

function b64ToBlob(dataUrl) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(dataUrl || '');
  if (!m) return null;
  const buf = Buffer.from(m[2], 'base64');
  if (!buf.length || buf.length > MAX_PHOTO) return null;
  return { blob: new Blob([buf], { type: m[1] }), ext: m[1].split('/')[1].replace('jpeg', 'jpg') };
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') return res.status(200).json({ ok: true, model: MODEL, hasKey: !!process.env.OPENAI_API_KEY });
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const key = (typeof body.key === 'string' && /^sk-[\w-]{20,}$/.test(body.key.trim())) ? body.key.trim() : process.env.OPENAI_API_KEY;
  if (!key) return res.status(200).json({ ok: false, error: 'no_key' });

  const prompt = String(body.prompt || '').slice(0, MAX_PROMPT);
  if (prompt.length < 20) return res.status(400).json({ ok: false, error: 'prompt' });
  const photo = b64ToBlob(body.photo);
  if (!photo) return res.status(400).json({ ok: false, error: 'photo' });
  const full = body.mode !== 'card';

  const fd = new FormData();
  fd.append('model', MODEL);
  fd.append('n', '1');
  fd.append('quality', QUALITY);
  fd.append('size', full ? '1024x1536' : '1536x1024');
  if (full) {
    const ref = fs.readFileSync(path.join(__dirname, '_ref', 'layout.jpg'));
    fd.append('image[]', new Blob([ref], { type: 'image/jpeg' }), 'layout.jpg');
    fd.append('prompt', 'The FIRST image is a layout reference: copy its poster layout, colors and section structure, but NOT its text and NOT any logo. '
      + 'The SECOND image is the real site photo. ' + prompt);
  } else {
    fd.append('prompt', 'The attached image is the real site photo. ' + prompt);
  }
  fd.append('image[]', photo.blob, 'site.' + photo.ext);

  try {
    const r = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: 'Bearer ' + key }, body: fd });
    const j = await r.json().catch(function () { return {}; });
    if (!r.ok) {
      const code = r.status === 401 ? 'bad_key' : (j.error && j.error.code) || ('http_' + r.status);
      return res.status(200).json({ ok: false, error: code, detail: j.error && j.error.message ? String(j.error.message).slice(0, 200) : '' });
    }
    const b64 = j.data && j.data[0] && j.data[0].b64_json;
    if (!b64) return res.status(200).json({ ok: false, error: 'empty' });
    return res.status(200).json({ ok: true, model: MODEL, mode: full ? 'full' : 'card', image: 'data:image/png;base64,' + b64 });
  } catch (e) {
    return res.status(200).json({ ok: false, error: 'network' });
  }
};
