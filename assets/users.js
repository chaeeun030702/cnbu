/* ---------- 사용자 등록 · 분석 결과 PDF · 인터벌 촬영 위험 알림 루틴 ---------- */
/* 사용자 등록: 기본 사용자 2명(assets/recipients.js 의 PRESETS 순서대로 이메일·문자 번호를 짝지음) + 추가 등록.
   등록한 사용자는 메일·문자 발송 창의 받는 사람 목록이 되고, ‘알림’이 켜진 사용자는 인터벌 촬영 위험 알림의 수신자가 된다. 이 브라우저(localStorage)에만 저장한다.
   위험 알림 루틴: 인터벌 촬영 중 찍은 사진을 AI로 분석(app.js onFile → runRead)하고, 위험성(빈도×강도) 6 이상이 나오면 알림 사용자에게 메일을 보낸다
   (제목·본문은 메일 발송과 같고, 분석 결과 화면 PDF + 분석 sheet 첨부). 분석이 끝나기 전에 찍은 사진은 건너뛰고, 한 번 보낸 뒤 10분은 다시 보내지 않는다. */
var U_MAX = 20, WATCH_MIN = 6, WATCH_COOL = 10 * 60 * 1000, WATCH_RETRY = 60 * 1000;
var WATCH = { on: false, busy: false, last: 0, retry: 0, seen: 0, sent: 0, msg: '' };

function uGet(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
function uSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
function uJson(k, d) { try { var v = JSON.parse(uGet(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } }

function usersAll() {
  var P = (typeof PRESETS !== 'undefined' && PRESETS) || { email: [], sms: [] }, out = [];
  for (var i = 0; i < 2; i++) out.push({ id: 'd' + (i + 1), name: '사용자 ' + (i + 1), email: (P.email || [])[i] || '', sms: (P.sms || [])[i] || '', def: true });
  var ex = uJson('cbnu_users', []), al = uJson('cbnu_ualert', {});
  (Array.isArray(ex) ? ex : []).forEach(function (u) { if (u && u.id && (u.email || u.sms)) out.push({ id: String(u.id), name: String(u.name || ''), email: String(u.email || ''), sms: String(u.sms || ''), def: false }); });
  return out.map(function (u) { u.alert = al[u.id] !== false; return u; });
}
function usersFor(mail) { // 메일/문자 발송 창에 쓰는 (값, 이름) 목록 — 중복 제거
  var seen = {}, out = [];
  usersAll().forEach(function (u) { var v = mail ? u.email : u.sms; if (v && !seen[v]) { seen[v] = 1; out.push({ v: v, name: u.name }); } });
  return out;
}
function usersAlertMails() { var seen = {}, out = []; usersAll().forEach(function (u) { if (u.alert && u.email && !seen[u.email]) { seen[u.email] = 1; out.push(u.email); } }); return out; }

/* Gmail 계정(앱 비밀번호): 이 사이트의 서버에서 메일을 보낼 때(특히 자동 알림) 쓴다. 이 브라우저에만 저장하고 발송 요청에만 실어 보낸다 */
function gmGet() { var u = uGet('cbnu_gm_user'), p = uGet('cbnu_gm_pass'); return (u && p) ? { user: u, pass: p } : null; }
function gmValid() { return !!gmGet(); }
function gmSave() {
  var u = ($('#gmUser').value || '').trim().toLowerCase(), p = ($('#gmPass').value || '').replace(/\s+/g, '') || (gmGet() ? gmGet().pass : ''), st = $('#gmStat');
  var bad = !/^[^\s@]+@gmail\.com$/.test(u) ? 'Gmail 주소를 입력하세요.' : !/^[A-Za-z0-9]{12,32}$/.test(p) ? '앱 비밀번호(16자리, 공백 없이)를 입력하세요.' : '';
  if (bad) { st.textContent = bad; st.className = 'keystat warn'; return; }
  uSet('cbnu_gm_user', u); uSet('cbnu_gm_pass', p); $('#gmPass').value = ''; gmRender(); nstat('✓ Gmail 계정을 이 브라우저에만 저장했습니다.', 'on');
}
function gmClear() { try { localStorage.removeItem('cbnu_gm_user'); localStorage.removeItem('cbnu_gm_pass'); } catch (e) {} $('#gmUser').value = ''; gmRender(); nstat('저장된 Gmail 계정을 지웠습니다.'); }
function gmRender() {
  var g = gmGet(), st = $('#gmStat'); if (!st) return;
  if (g && !$('#gmUser').value) $('#gmUser').value = g.user;
  $('#gmPass').placeholder = g ? '저장됨 (…' + g.pass.slice(-4) + ') — 바꿀 때만 입력' : '앱 비밀번호 16자리';
  st.className = 'keystat ' + (g ? 'on' : ''); st.textContent = g ? '✓ 저장됨 — ' + g.user + ' 계정으로 메일을 보냅니다.' : '저장하면 발송 토큰 없이 이 계정으로 메일을 보냅니다.';
}

/* ---------- 사용자 등록 창 ---------- */
function uFmt(v) { return v.replace(/^(01\d)(\d{3,4})(\d{4})$/, '$1-$2-$3'); }
function uNameOf(v, mail) { var f = usersFor(mail).filter(function (x) { return x.v === v; })[0]; return f ? f.name : ''; }
function usersRender() {
  var l = $('#uList'); if (!l) return;
  l.innerHTML = usersAll().map(function (u) {
    return '<div class="urow"><div class="uinfo"><div><b>' + esc(u.name || '(이름 없음)') + '</b>' + (u.def ? '<i>기본</i>' : '') + '</div>'
      + '<small>' + (u.email ? esc(u.email) : '<em>이메일 없음</em>') + ' · ' + (u.sms ? esc(uFmt(u.sms)) : '<em>번호 없음</em>') + '</small></div>'
      + '<label class="ualert" title="인터벌 촬영 위험 알림 메일을 받습니다"><input type="checkbox"' + (u.alert ? ' checked' : '') + (u.email ? '' : ' disabled') + ' onchange="userAlert(\'' + u.id + '\',this.checked)">알림</label>'
      + (u.def ? '<span class="udel"></span>' : '<button type="button" class="udel" title="삭제" onclick="userDel(\'' + u.id + '\')">✕</button>') + '</div>';
  }).join('');
  $('#uWatch').checked = WATCH.on; gmRender(); watchRender();
  var b = $('#uBtn'); if (b) b.textContent = '👤 사용자 등록' + (WATCH.on ? ' · 🔔' : '');
}
function usersOpen() { usersRender(); $('#uErr').textContent = ''; var d = $('#udlg'); if (d.showModal) d.showModal(); else d.setAttribute('open', ''); }
function usersClose() { var d = $('#udlg'); if (d.close) d.close(); else d.removeAttribute('open'); }
function userAdd() {
  var name = ($('#uName').value || '').trim().slice(0, 20), mail = ($('#uMail').value || '').trim().toLowerCase(), tel = ($('#uTel').value || '').replace(/\D/g, ''), err = $('#uErr');
  if (!mail && !tel) { err.textContent = '이메일이나 휴대폰 번호 중 하나는 입력하세요.'; return; }
  if (mail && !/^[^\s@,;<>"]{1,64}@[^\s@,;<>"]{1,200}\.[^\s@,;<>"]{2,}$/.test(mail)) { err.textContent = '이메일 주소를 확인하세요.'; return; }
  if (tel && !/^01[016789]\d{7,8}$/.test(tel)) { err.textContent = '휴대폰 번호를 확인하세요 (010 등 국내 번호).'; return; }
  var all = usersAll();
  if (all.length >= U_MAX) { err.textContent = '사용자는 최대 ' + U_MAX + '명입니다.'; return; }
  if (all.some(function (u) { return (mail && u.email === mail) || (tel && u.sms === tel); })) { err.textContent = '이미 등록된 이메일·번호입니다.'; return; }
  var ex = uJson('cbnu_users', []); if (!Array.isArray(ex)) ex = [];
  ex.push({ id: 'u' + Date.now().toString(36), name: name || '사용자 ' + (all.length + 1), email: mail, sms: tel });
  uSet('cbnu_users', JSON.stringify(ex)); ['uName', 'uMail', 'uTel'].forEach(function (k) { $('#' + k).value = ''; }); err.textContent = ''; usersRender();
}
function userDel(id) {
  var ex = uJson('cbnu_users', []); if (!Array.isArray(ex)) ex = [];
  uSet('cbnu_users', JSON.stringify(ex.filter(function (u) { return u.id !== id; }))); usersRender();
}
function userAlert(id, on) { var al = uJson('cbnu_ualert', {}); al[id] = !!on; uSet('cbnu_ualert', JSON.stringify(al)); usersRender(); }

/* ---------- 분석 결과 화면 → PDF (A4 가로, 위험분석·위험성평가표의 .sheet 쪽마다 1쪽) ---------- */
/* html2canvas 로 쪽마다 그림으로 만든 뒤 jsPDF 로 묶는다. 요청 본문 한도(Vercel 4.5MB)를 넘지 않도록 base64 길이가 PDF_MAX 를 넘으면 화질을 낮춰 다시 묶는다 */
var PDF_MAX = 2000000;
function pdfBuild(canv, q) {
  var J = window.jspdf.jsPDF, doc = new J({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  canv.forEach(function (c, i) { if (i) doc.addPage('a4', 'landscape'); doc.addImage(c.toDataURL('image/jpeg', q), 'JPEG', 0, 0, 297, 210, undefined, 'FAST'); });
  return doc.output('arraybuffer');
}
function pdfShrink(c, k) { var o = document.createElement('canvas'); o.width = Math.round(c.width * k); o.height = Math.round(c.height * k); var g = o.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, o.width, o.height); g.drawImage(c, 0, 0, o.width, o.height); return o; }
function makePdf() { // → Promise<{ b64, blob, pages } | null>  (만들지 못하면 null — 메일은 HTML 첨부만으로 나간다)
  var w = RAW();
  if (!w || !window.html2canvas || !(window.jspdf && window.jspdf.jsPDF)) return Promise.resolve(null);
  var sheets = $$('.sheet', w.document).filter(function (s) { return s.offsetHeight > 0; });
  if (!sheets.length) return Promise.resolve(null);
  var canv = [], i = 0;
  function next() {
    if (i >= sheets.length) return Promise.resolve();
    return window.html2canvas(sheets[i], { scale: 1.5, backgroundColor: '#ffffff', logging: false, useCORS: true }).then(function (c) { canv.push(c); i++; return next(); });
  }
  return next().then(function () {
    var steps = [[1, 0.78], [1, 0.6], [1, 0.45], [0.7, 0.55]], buf = null, b64 = '';
    for (var s = 0; s < steps.length; s++) {
      var cs = steps[s][0] === 1 ? canv : canv.map(function (c) { return pdfShrink(c, steps[s][0]); });
      buf = pdfBuild(cs, steps[s][1]); b64 = b64OfBuf(buf);
      if (b64.length <= PDF_MAX) break;
    }
    return b64.length <= PDF_MAX ? { b64: b64, blob: new Blob([buf], { type: 'application/pdf' }), pages: canv.length } : null;
  }).catch(function () { return null; });
}

/* ---------- 인터벌 촬영 위험 알림 루틴 ---------- */
function watchRender() {
  var s = $('#uStat'); if (!s) return;
  var why = !WATCH.on ? '꺼짐 — 켜면 인터벌 촬영 사진마다 위험 분석을 하고, 위험성 ' + WATCH_MIN + ' 이상이면 알림 사용자에게 메일을 보냅니다.'
    : (typeof ENG !== 'undefined' && ENG !== 'ai') ? '⚠️ AI 판독 모드(②)로 바꿔야 사진을 분석합니다.'
    : WATCH.msg || '켜짐 — 인터벌 촬영을 시작하면 사진마다 분석합니다.';
  s.textContent = why; s.className = 'keystat ' + (WATCH.on ? (/⚠️|✗/.test(why) ? 'warn' : 'on') : '');
}
function watchToggle() {
  WATCH.on = !!$('#uWatch').checked; uSet('cbnu_watch', WATCH.on ? '1' : '0');
  WATCH.msg = ''; usersRender();
}
function watchNote(m, c) { WATCH.msg = m; watchRender(); nstat(m, c); }
function watchWants() { // 인터벌 촬영이 사진을 찍을 때 묻는다 — 지금 분석할 수 있는 상태인가
  return WATCH.on && !WATCH.busy && !BUSY && ENG === 'ai';
}
function watchFeed(blob, d) {
  WATCH.busy = true; WATCH.seen++;
  var guard = setTimeout(function () { WATCH.busy = false; }, 100000);
  watchNote('🔔 촬영 사진 분석 중… (' + WATCH.seen + '번째)');
  window.onFile(new File([blob], 'interval-' + d.getTime() + '.jpg', { type: 'image/jpeg', lastModified: d.getTime() }), function (ok) {
    clearTimeout(guard); WATCH.busy = false;
    if (!ok) { watchNote('⚠️ 사진을 AI로 분석하지 못했습니다 — 알림을 보내지 않았습니다.', 'warn'); return; }
    watchCheck(d);
  });
}
function watchCheck(d) {
  var c = sheetCounts(), hhmm = d.toLocaleTimeString('ko-KR', { hour12: false, hour: '2-digit', minute: '2-digit' });
  if (!c.high) { watchNote('✓ ' + hhmm + ' 분석 — 위험성 ' + WATCH_MIN + ' 이상 없음 (위험 ' + c.total + '건, 최고 ' + c.max + ')'); return; }
  var now = Date.now();
  if (now - WATCH.last < WATCH_COOL) { watchNote('🔔 ' + hhmm + ' 위험성 ' + WATCH_MIN + ' 이상 ' + c.high + '건 — 방금 알림을 보내 ' + Math.ceil((WATCH.last + WATCH_COOL - now) / 60000) + '분 뒤에 다시 보냅니다.'); return; }
  if (now < WATCH.retry) { watchNote('🔔 ' + hhmm + ' 위험성 ' + WATCH_MIN + ' 이상 ' + c.high + '건 — 직전 발송이 실패해 잠시 후 다시 시도합니다.', 'warn'); return; }
  watchSend(c, d, hhmm);
}
function watchSend(c, d, hhmm) {
  var to = usersAlertMails(), gm = gmGet(), w = RAW();
  if (!to.length) { watchNote('⚠️ 위험성 ' + WATCH_MIN + ' 이상 ' + c.high + '건 — 알림을 받을 사용자(이메일)가 없습니다. 👤 사용자 등록에서 ‘알림’을 켜세요.', 'warn'); return; }
  if (!gm && !(NTOKEN && MAIL_SRV)) { watchNote('⚠️ 위험성 ' + WATCH_MIN + ' 이상 ' + c.high + '건 — 메일 보내는 계정이 없습니다. 👤 사용자 등록 → Gmail 계정을 저장하세요.', 'warn'); return; }
  var sheet = ''; try { sheet = w.sheetHtml(); } catch (e) { watchNote('✗ 분석 sheet를 만들지 못했습니다.', 'warn'); return; }
  NBUSY = true; watchNote('🔔 위험성 ' + WATCH_MIN + ' 이상 ' + c.high + '건 (최고 ' + c.max + ') — 메일 만드는 중…', 'warn');
  makePdf().then(function (pdf) {
    var body = { channel: 'email', to: to, counts: c, sheet: sheet, pdf: pdf ? pdf.b64 : undefined,
      note: '인터벌 촬영 자동 알림 · ' + hhmm + ' 촬영 사진에서 위험성 ' + WATCH_MIN + ' 이상 ' + c.high + '건 (최고 ' + c.max + ')',
      site: { name: $('#m_site').value, proc: $('#m_proc').value, date: $('#m_date').value, by: $('#m_by').value } };
    if (gm) body.gmail = gm; else body.token = NTOKEN;
    return fetch('/api/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return { ok: false, error: r.status === 413 ? 'too_large' : 'http_' + r.status }; }); })
      .then(function (j) {
        if (j.ok) { WATCH.last = Date.now(); WATCH.sent++; watchNote('✓ ' + hhmm + ' 위험 알림 메일 발송 (' + to.join(', ') + ')' + (pdf ? '' : ' — PDF 없이 HTML만'), 'on'); }
        else { WATCH.retry = Date.now() + WATCH_RETRY; watchNote('✗ 위험 알림 메일 실패: ' + (mailWhy(j)), 'warn'); }
      });
  }).catch(function () { WATCH.retry = Date.now() + WATCH_RETRY; watchNote('✗ 서버에 연결하지 못했습니다.', 'warn'); })
    .then(function () { NBUSY = false; });
}
function mailWhy(j) {
  var m = { bad_token: '발송 토큰이 맞지 않습니다.', no_token_configured: '서버에 NOTIFY_TOKEN 이 설정되지 않았습니다.', too_fast: '연속 발송 제한 (잠시 후 다시)', not_configured: '서버에 메일 설정이 없습니다.',
    too_large: '첨부가 너무 큽니다.', sheet: '분석 sheet가 올바르지 않거나 너무 큽니다.', pdf: 'PDF가 올바르지 않거나 너무 큽니다.', bad_recipient: '받는 주소 형식이 맞지 않습니다.', no_recipient: '받는 주소가 없습니다.',
    bad_credentials: 'Gmail 계정이 허용 목록에 없거나 앱 비밀번호 형식이 맞지 않습니다.', mail_auth: 'Gmail이 로그인을 거부했습니다 (앱 비밀번호 확인).', mail_failed: 'Gmail 발송 실패' };
  return (m[j.error] || j.error || '알 수 없음') + (j.detail && /mail_failed|http_/.test(j.error || '') ? ' — ' + String(j.detail).slice(0, 120) : '');
}
(function () { WATCH.on = uGet('cbnu_watch') === '1'; var b = document.getElementById('uBtn'); if (b && WATCH.on) b.textContent = '👤 사용자 등록 · 🔔'; })();
