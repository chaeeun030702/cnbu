// ─────────────────────────────────────────────────────────────────────
//  /api/notify — 현장사진 위험 분석 자료를 나에게 이메일 또는 문자로 발송 (Vercel Serverless Function, Node 20)
//
//  입력  POST { token, channel:'email'|'sms', to?, sheet?, site?, counts? }
//        token   = 상단 바 버튼의 입력창에서 사용자가 넣어 이 브라우저에만 저장한 발송 토큰
//        channel = 'email' → 메일 1통 / 'sms' → 문자 1건 (버튼마다 한 채널만 보낸다)
//        to      = 받는 이메일 주소(들) 또는 휴대폰 번호(들) — 최대 3개. 비우면 서버 환경변수 NOTIFY_*_TO 를 쓴다
//        sheet   = 현장사진 위험 분석 sheet(위험분석·위험성평가표) HTML 문서 — 메일에 첨부 (email 필수)
//  출력  { ok, error?, detail? }          GET → 서버 설정 상태 { token, email, sms }
//
//  제목  '[경고] 현장사진 위험성평가표 — 현장명 (위험 N건 · 높음 M)'  (현장명이 비면 ' — 현장명' 생략)
//  메일  제목 = 위 제목, 첨부 = 현장사진 위험 분석 sheet
//  문자  내용 = 위 제목 (한글 90바이트를 넘으면 LMS)
//
//  받는 사람은 화면에서 입력한다. 아무에게나 보내는 것을 막으려고 발송 토큰이 맞아야 하고, 형식(이메일·국내 휴대폰)과
//  개수(3개)를 검사하며 채널별 연속 발송을 20초 간격으로 제한한다.
//    NOTIFY_TOKEN          발송 토큰 (필수. 없으면 발송 거부)
//    RESEND_API_KEY        이메일: Resend API 키          NOTIFY_EMAIL_TO   (선택) 입력이 없을 때 쓸 기본 받는 주소
//    NOTIFY_EMAIL_FROM     (선택) 기본 onboarding@resend.dev — 도메인 인증 전에는 Resend 가입 주소로만 갈 수 있다
//    SOLAPI_API_KEY / SOLAPI_API_SECRET   문자: Solapi 키·시크릿
//    SOLAPI_SENDER         Solapi 에 사전 등록한 발신번호   NOTIFY_SMS_TO    (선택) 입력이 없을 때 쓸 기본 받는 번호
// ─────────────────────────────────────────────────────────────────────
const crypto = require('crypto');

const SITE_URL = 'https://e-safety.vercel.app/'; // 메일 맨 위에 넣는 사이트 링크
const MAX_SHEET = 3.2 * 1000 * 1000; // 문자 수. Vercel 요청 본문 한도(4.5MB) 안에서 쓴다
const MIN_GAP_MS = 20 * 1000;        // 같은 서버 인스턴스에서 채널별 연속 발송 간격
const last = { email: 0, sms: 0 };

const env = (k) => (process.env[k] || '').trim();
const list = (v) => v.split(',').map((x) => x.trim()).filter(Boolean);
const clip = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const MAX_TO = 3;
const EMAIL_RE = /^[^\s@,;<>"]{1,64}@[^\s@,;<>"]{1,200}\.[^\s@,;<>"]{2,}$/;
const PHONE_RE = /^01[016789]\d{7,8}$/;
// 받는 사람 목록: 문자열(쉼표·공백·세미콜론 구분) 또는 배열 → 중복 제거한 목록. 잘못된 항목이 하나라도 있으면 null
function parseTo(v, channel) {
  const raw = (Array.isArray(v) ? v : String(v == null ? '' : v).split(/[\s,;]+/)).map((x) => String(x).trim()).filter(Boolean);
  const out = [];
  for (const x of raw) {
    const t = channel === 'sms' ? x.replace(/\D/g, '') : x.toLowerCase();
    if (!(channel === 'sms' ? PHONE_RE : EMAIL_RE).test(t)) return null;
    if (!out.includes(t)) out.push(t);
  }
  return out.length > MAX_TO ? null : out;
}
const num = (v) => Math.min(99, Math.max(0, parseInt(v, 10) || 0));

function safeEq(a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

function titleOf(site, counts) {
  return '[경고] 현장사진 위험성평가표' + (site.name ? ' — ' + site.name : '') + ' (위험 ' + counts.total + '건 · 높음 ' + counts.high + ')';
}

function emailHtml(title, site, counts) {
  const meta = [['현장명', site.name], ['공종·작업', site.proc], ['평가일', site.date], ['관리감독자', site.by]]
    .filter((x) => x[1]).map((x) => '<b>' + x[0] + '</b> ' + esc(x[1])).join(' &nbsp;·&nbsp; ');
  const sum = counts.total
    ? '<p style="margin:12px 0 4px">위험 <b>' + counts.total + '건</b> — <span style="color:#B03A2E"><b>높음 ' + counts.high + '</b></span> · 보통 ' + counts.mid + ' · 낮음 ' + counts.low + '</p>' : '';
  return '<div style="font-family:\'Malgun Gothic\',Apple SD Gothic Neo,sans-serif;font-size:14px;color:#1c1c1c;max-width:640px">'
    + '<p style="margin:0 0 12px"><a href="' + SITE_URL + '">' + SITE_URL + '</a></p>'
    + '<div style="background:#B03A2E;color:#fff;padding:12px 14px;border-radius:6px;font-size:17px;font-weight:800">' + esc(title) + '</div>'
    + sum + (meta ? '<p style="margin:4px 0 10px;color:#334">' + meta + '</p>' : '')
    + '<p>첨부한 <b>현장사진 위험 분석 sheet</b>(HTML 파일)를 열어 위험 분석과 위험성평가표를 확인하세요.</p>'
    + '<p style="color:#778;font-size:12px">자동 생성 결과는 초안입니다. AI는 최초 검토, 최종 판단은 관리감독자가 진행합니다.</p></div>';
}

async function sendEmail(to, sheet, site, counts) {
  const title = titleOf(site, counts);
  const key = env('RESEND_API_KEY');
  if (!key) return { ok: false, error: 'not_configured' };
  const payload = {
    from: env('NOTIFY_EMAIL_FROM') || 'onboarding@resend.dev', to, subject: title, html: emailHtml(title, site, counts),
    text: SITE_URL + '\n\n' + title + '\n\n첨부한 현장사진 위험 분석 sheet(HTML 파일)를 열어 확인하세요.',
    attachments: [{ filename: 'site-photo-risk-analysis-sheet.html', content: Buffer.from(sheet, 'utf8').toString('base64') }],
  };
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  if (r.ok) return { ok: true };
  const t = await r.text().catch(() => '');
  return { ok: false, error: 'http_' + r.status, detail: t.slice(0, 200) };
}

async function sendSms(to, site, counts) {
  const key = env('SOLAPI_API_KEY'), secret = env('SOLAPI_API_SECRET'), from = env('SOLAPI_SENDER').replace(/\D/g, '');
  if (!key || !secret || !from) return { ok: false, error: 'not_configured' };
  const date = new Date().toISOString(), salt = crypto.randomBytes(16).toString('hex');
  const sig = crypto.createHmac('sha256', secret).update(date + salt).digest('hex');
  // 문자는 KS X 1001(EUC-KR) 범위만 안전하므로 긴 대시(—, U+2014)는 모양이 같은 가로선(―, U+2015)으로 바꾼다
  const text = titleOf(site, counts).replace(/\u2014/g, '\u2015');
  const long = Array.from(text).reduce((n, ch) => n + (ch.charCodeAt(0) > 127 ? 2 : 1), 0) > 90; // 한글 2바이트, 90바이트 초과 시 LMS
  const messages = to.map((n) => Object.assign({ to: n, from, text, type: long ? 'LMS' : 'SMS' }, long ? { subject: '[경고] 위험성평가표' } : {}));
  const r = await fetch('https://api.solapi.com/messages/v4/send-many/detail', {
    method: 'POST',
    headers: { Authorization: 'HMAC-SHA256 apiKey=' + key + ', date=' + date + ', salt=' + salt + ', signature=' + sig, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });
  if (r.ok) return { ok: true };
  const t = await r.text().catch(() => '');
  return { ok: false, error: 'http_' + r.status, detail: t.slice(0, 200) };
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true, token: !!env('NOTIFY_TOKEN'),
      email: !!env('RESEND_API_KEY'),
      sms: !!(env('SOLAPI_API_KEY') && env('SOLAPI_API_SECRET') && env('SOLAPI_SENDER')),
    });
  }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method' });

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); } catch (e) { return res.status(400).json({ ok: false, error: 'json' }); }

  const want = env('NOTIFY_TOKEN');
  if (!want) return res.status(200).json({ ok: false, error: 'no_token_configured' });
  if (!safeEq(body.token || '', want)) return res.status(401).json({ ok: false, error: 'bad_token' });

  const channel = body.channel;
  if (channel !== 'email' && channel !== 'sms') return res.status(400).json({ ok: false, error: 'channel' });

  const hasTo = Array.isArray(body.to) ? body.to.length : String(body.to || '').trim() !== '';
  const to = hasTo ? parseTo(body.to, channel) : parseTo(env(channel === 'email' ? 'NOTIFY_EMAIL_TO' : 'NOTIFY_SMS_TO'), channel);
  if (to === null) return res.status(400).json({ ok: false, error: 'bad_recipient' });
  if (!to.length) return res.status(400).json({ ok: false, error: 'no_recipient' });

  let sheet = '';
  if (channel === 'email') {
    sheet = typeof body.sheet === 'string' ? body.sheet : '';
    if (sheet.length < 1000 || sheet.length > MAX_SHEET || !/^<!doctype html>/i.test(sheet)) return res.status(400).json({ ok: false, error: 'sheet' });
  }

  const now = Date.now();
  if (now - last[channel] < MIN_GAP_MS) return res.status(429).json({ ok: false, error: 'too_fast' });
  last[channel] = now;

  const s = body.site || {}, c = body.counts || {};
  const site = { name: clip(s.name, 60), proc: clip(s.proc, 80), date: clip(s.date, 30), by: clip(s.by, 30) };
  const counts = { total: num(c.total), high: num(c.high), mid: num(c.mid), low: num(c.low) };

  let out;
  try { out = channel === 'email' ? await sendEmail(to, sheet, site, counts) : await sendSms(to, site, counts); }
  catch (e) { out = { ok: false, error: 'exception', detail: String(e && e.message).slice(0, 120) }; }
  if (!out.ok) last[channel] = 0; // 실패하면 바로 다시 시도할 수 있게 한다
  return res.status(200).json(out);
};

module.exports.titleOf = titleOf;
module.exports.parseTo = parseTo;
