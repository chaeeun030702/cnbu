// ─────────────────────────────────────────────────────────────────────
//  /api/notify — 현장사진 위험성평가표를 나에게 이메일·문자로 발송 (Vercel Serverless Function, Node 20)
//
//  입력  POST { token, send:{email,sms}, site:{name,proc,date,by}, photo?:"data:image/jpeg;base64,…",
//               rows:[{no,work,haz,cause,law,p,s,v,level,acts:[…]}], link? }
//        token = 화면 ⑨에서 사용자가 브라우저에 저장한 발송 토큰 (서버 환경변수 NOTIFY_TOKEN 과 같아야 함)
//  출력  { ok, email:{ok,error?}, sms:{ok,error?} }   GET → 설정 상태 { email, sms, token }
//
//  보내는 것은 ‘현장사진 위험성평가표’뿐이다 (허가서·포스터는 보내지 않는다).
//  이메일 제목·본문 맨 앞, 문자 맨 앞에 [경고] 를 붙인다.
//
//  받는 사람은 서버 환경변수로만 정한다 — 요청에 주소·번호를 실어도 쓰지 않는다 (남용 방지).
//    NOTIFY_TOKEN          발송 토큰 (필수. 없으면 발송 거부)
//    RESEND_API_KEY        이메일: Resend API 키          NOTIFY_EMAIL_TO   받는 주소 (쉼표로 여러 개)
//    NOTIFY_EMAIL_FROM     (선택) 기본 onboarding@resend.dev — 도메인 인증 전에는 Resend 가입 주소로만 갈 수 있다
//    SOLAPI_API_KEY / SOLAPI_API_SECRET   문자: Solapi 키·시크릿
//    SOLAPI_SENDER         Solapi 에 사전 등록한 발신번호   NOTIFY_SMS_TO    받는 번호 (쉼표로 여러 개)
// ─────────────────────────────────────────────────────────────────────
const crypto = require('crypto');

const MAX_PHOTO = 1.5 * 1024 * 1024;
const MAX_ROWS = 60;
const MIN_GAP_MS = 20 * 1000; // 같은 서버 인스턴스에서 연속 발송 간격
let lastSend = 0;

const env = (k) => (process.env[k] || '').trim();
const list = (v) => v.split(',').map((x) => x.trim()).filter(Boolean);
const clip = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const LV = { 3: '상', 2: '중', 1: '하' };
const COL = (v) => (v >= 9 ? '#B03A2E' : v >= 6 ? '#E67E22' : v >= 3 ? '#E1A100' : '#2E8B57');

function safeEq(a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

function clean(body) {
  const rows = (Array.isArray(body.rows) ? body.rows : []).slice(0, MAX_ROWS).map((r, i) => {
    const v = Math.min(9, Math.max(1, parseInt(r.v, 10) || 1));
    return {
      no: parseInt(r.no, 10) || i + 1,
      work: clip(r.work, 80), haz: clip(r.haz, 220), cause: clip(r.cause, 160), law: clip(r.law, 120),
      p: Math.min(3, Math.max(1, parseInt(r.p, 10) || 1)), s: Math.min(3, Math.max(1, parseInt(r.s, 10) || 1)), v,
      level: clip(r.level, 6) || (v >= 6 ? '높음' : v >= 3 ? '보통' : '낮음'),
      acts: (Array.isArray(r.acts) ? r.acts : []).slice(0, 6).map((a) => clip(a, 160)).filter(Boolean),
    };
  }).sort((a, b) => b.v - a.v || a.no - b.no);
  const site = body.site || {};
  return {
    rows,
    site: { name: clip(site.name, 60), proc: clip(site.proc, 80), date: clip(site.date, 30), by: clip(site.by, 30) },
    link: /^https:\/\/[\w.-]+(\/\S*)?$/.test(String(body.link || '')) ? String(body.link).slice(0, 200) : '',
  };
}

function counts(rows) {
  return { high: rows.filter((r) => r.v >= 6).length, mid: rows.filter((r) => r.v >= 3 && r.v < 6).length, low: rows.filter((r) => r.v < 3).length };
}

function subjectOf(d) {
  const c = counts(d.rows);
  return '[경고] 현장사진 위험성평가표' + (d.site.name ? ' — ' + d.site.name : '') + ' (위험 ' + d.rows.length + '건 · 높음 ' + c.high + ')';
}

function emailHtml(d, hasPhoto) {
  const c = counts(d.rows);
  const meta = [['현장명', d.site.name], ['공종·작업', d.site.proc], ['평가일', d.site.date], ['관리감독자', d.site.by]]
    .filter((x) => x[1]).map((x) => '<b>' + x[0] + '</b> ' + esc(x[1])).join(' &nbsp;·&nbsp; ');
  const body = d.rows.map((r) => {
    const acts = r.acts.length ? '<ul style="margin:4px 0 0;padding-left:18px">' + r.acts.map((a) => '<li>' + esc(a) + '</li>').join('') + '</ul>' : '';
    return '<tr>'
      + '<td style="padding:8px;border:1px solid #d5dbe4;text-align:center">' + r.no + '</td>'
      + '<td style="padding:8px;border:1px solid #d5dbe4"><b>' + esc(r.work) + '</b><br>' + esc(r.haz)
      + (r.cause ? '<br><span style="color:#667">원인: ' + esc(r.cause) + '</span>' : '')
      + (r.law ? '<br><span style="color:#667;font-size:12px">근거: ' + esc(r.law) + '</span>' : '') + '</td>'
      + '<td style="padding:8px;border:1px solid #d5dbe4;text-align:center;white-space:nowrap">빈도 ' + LV[r.p] + '(' + r.p + ')<br>강도 ' + { 3: '대', 2: '중', 1: '소' }[r.s] + '(' + r.s + ')</td>'
      + '<td style="padding:8px;border:1px solid #d5dbe4;text-align:center;white-space:nowrap;color:#fff;font-weight:700;background:' + COL(r.v) + '">' + r.v + '<br>' + esc(r.level) + '</td>'
      + '<td style="padding:8px;border:1px solid #d5dbe4">' + (acts || '—') + '</td></tr>';
  }).join('');
  return '<div style="font-family:\'Malgun Gothic\',Apple SD Gothic Neo,sans-serif;font-size:14px;color:#1c1c1c;max-width:860px">'
    + '<div style="background:#B03A2E;color:#fff;padding:12px 14px;border-radius:6px;font-size:17px;font-weight:800">[경고] 현장사진 위험성평가표</div>'
    + '<p style="margin:12px 0 4px">위험 <b>' + d.rows.length + '건</b> — <span style="color:#B03A2E"><b>높음 ' + c.high + '</b></span> · 보통 ' + c.mid + ' · 낮음 ' + c.low + '</p>'
    + (meta ? '<p style="margin:4px 0 10px;color:#334">' + meta + '</p>' : '')
    + (hasPhoto ? '<p><img src="cid:sitephoto" alt="현장사진" style="max-width:100%;border:1px solid #d5dbe4;border-radius:4px"></p>' : '')
    + '<table style="border-collapse:collapse;width:100%;font-size:13px"><thead><tr style="background:#F1F5FA">'
    + '<th style="padding:7px;border:1px solid #d5dbe4">No</th><th style="padding:7px;border:1px solid #d5dbe4">위험요인</th>'
    + '<th style="padding:7px;border:1px solid #d5dbe4">빈도·강도</th><th style="padding:7px;border:1px solid #d5dbe4;white-space:nowrap">위험성</th>'
    + '<th style="padding:7px;border:1px solid #d5dbe4">감소대책</th></tr></thead><tbody>' + body + '</tbody></table>'
    + (d.link ? '<p><a href="' + esc(d.link) + '">웹에서 위험성평가표 보기</a></p>' : '')
    + '<p style="color:#778;font-size:12px">자동 생성 결과는 초안입니다. AI는 최초 검토, 최종 판단은 관리감독자가 진행합니다. 위험성 = 빈도(1~3) × 강도(1~3): 6 이상 높음, 3~4 보통, 1~2 낮음.</p></div>';
}

// 문자: 한글 2바이트 기준 90바이트 이하면 SMS, 넘으면 LMS (최대 약 1,900바이트)
const bytes = (s) => Array.from(s).reduce((n, ch) => n + (ch.charCodeAt(0) > 127 ? 2 : 1), 0);
function smsText(d) {
  const c = counts(d.rows);
  const lines = ['[경고] 현장사진 위험성평가'];
  if (d.site.name) lines.push('현장: ' + d.site.name);
  lines.push('위험 ' + d.rows.length + '건 (높음 ' + c.high + ' · 보통 ' + c.mid + ' · 낮음 ' + c.low + ')');
  d.rows.slice(0, 5).forEach((r, i) => lines.push((i + 1) + '. ' + (r.work || r.haz).slice(0, 28) + ' [' + r.level + ' ' + r.v + ']'));
  if (d.link) lines.push(d.link);
  let t = lines.join('\n');
  while (bytes(t) > 1900) t = t.slice(0, -10);
  return t;
}

async function sendEmail(d, photo) {
  const key = env('RESEND_API_KEY'), to = list(env('NOTIFY_EMAIL_TO'));
  if (!key || !to.length) return { ok: false, error: 'not_configured' };
  const payload = { from: env('NOTIFY_EMAIL_FROM') || 'onboarding@resend.dev', to, subject: subjectOf(d), html: emailHtml(d, !!photo) };
  if (photo) payload.attachments = [{ filename: 'site-photo.jpg', content: photo, content_id: 'sitephoto' }];
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  if (r.ok) return { ok: true };
  const t = await r.text().catch(() => '');
  return { ok: false, error: 'http_' + r.status, detail: t.slice(0, 200) };
}

async function sendSms(d) {
  const key = env('SOLAPI_API_KEY'), secret = env('SOLAPI_API_SECRET'), from = env('SOLAPI_SENDER').replace(/\D/g, '');
  const to = list(env('NOTIFY_SMS_TO')).map((x) => x.replace(/\D/g, '')).filter(Boolean);
  if (!key || !secret || !from || !to.length) return { ok: false, error: 'not_configured' };
  const text = smsText(d), long = bytes(text) > 90;
  const date = new Date().toISOString(), salt = crypto.randomBytes(16).toString('hex');
  const sig = crypto.createHmac('sha256', secret).update(date + salt).digest('hex');
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
      email: !!(env('RESEND_API_KEY') && env('NOTIFY_EMAIL_TO')),
      sms: !!(env('SOLAPI_API_KEY') && env('SOLAPI_API_SECRET') && env('SOLAPI_SENDER') && env('NOTIFY_SMS_TO')),
    });
  }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method' });

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); } catch (e) { return res.status(400).json({ ok: false, error: 'json' }); }

  const want = env('NOTIFY_TOKEN');
  if (!want) return res.status(200).json({ ok: false, error: 'no_token_configured' });
  if (!safeEq(body.token || '', want)) return res.status(401).json({ ok: false, error: 'bad_token' });

  const d = clean(body);
  if (!d.rows.length) return res.status(400).json({ ok: false, error: 'no_rows' });

  const now = Date.now();
  if (now - lastSend < MIN_GAP_MS) return res.status(429).json({ ok: false, error: 'too_fast' });
  lastSend = now;

  let photo = '';
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(body.photo || ''));
  if (m && Buffer.byteLength(m[1], 'base64') <= MAX_PHOTO) photo = m[1];

  const send = body.send || {};
  const out = { ok: false };
  const jobs = [];
  if (send.email !== false) jobs.push(sendEmail(d, photo).then((x) => { out.email = x; }, (e) => { out.email = { ok: false, error: 'exception', detail: String(e && e.message).slice(0, 120) }; }));
  if (send.sms !== false) jobs.push(sendSms(d).then((x) => { out.sms = x; }, (e) => { out.sms = { ok: false, error: 'exception', detail: String(e && e.message).slice(0, 120) }; }));
  await Promise.all(jobs);
  out.ok = [out.email, out.sms].some((x) => x && x.ok);
  if (!out.ok) lastSend = 0; // 모두 실패하면 바로 다시 시도할 수 있게 한다
  return res.status(200).json(out);
};

module.exports._test = { clean, emailHtml, smsText, subjectOf, bytes };
