/* 4단계 홈페이지 — 현장사진 → 위험분석·위험성평가표(ra.html) · 사전작업허가서(ptw-c49.html / ptw-gen.html) · 안전포스터(poster.html)
   상태의 기준은 위험분석 프레임(ra.html)의 S 다. 이 파일은 사진·판독·패널을 다루고, 프레임 렌더가 끝날 때마다(onRA)
   허가서와 포스터를 다시 맞춘다. 생성 결과는 초안이며 최종 판단은 관리감독자가 한다. */
'use strict';
var LANG = 'zh', ENG = 'ai', OUT = 'all', DOMSEL = 'auto', TAB = 'elec', APIKEY = '', SERVERKEY = null, BUSY = false, EDIT = false;
var LIX = { ko: 0, en: 1, zh: 2, vi: 3, uz: 4 };
var KBI = {}; KB.forEach(function (k) { KBI[k.id] = k; });
var H = { sample: null, photo: null, pw: 1600, ph: 1164, fname: '', gpt: null, ready: { ra: 0, c49: 0, gen: 0, pst: 0 }, sig: {}, rows: [], pending: null, orig: null, meta: {} };

function $(s, r) { return (r || document).querySelector(s); }
function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function U(k) { return UI[k] ? UI[k][0] : k; }
function UT(k) { var d = UI[k]; if (!d || LANG === 'ko') return ''; return d[LIX[LANG]] || ''; }
function rkc(v) { return v >= 9 ? '#B03A2E' : (v >= 6 ? '#E67E22' : (v >= 3 ? '#E1A100' : '#2E8B57')); }
function W(id) { try { return $('#' + id).contentWindow; } catch (e) { return null; } }
function RAW() { var w = W('raBox'); return (w && w.S && w.renderAll) ? w : null; }
function arr5(a, lang) { var o = ['', '', '', '', '']; a = a || []; o[0] = a[0] || ''; var i = LIX[lang || LANG]; if (i && a[1]) o[i] = a[1]; return o; }
function status(t, c) { var e = $('#rdStat'); e.innerHTML = t; e.className = 'rdstat ' + (c || ''); }

/* ---------- UI 문구 ---------- */
function applyUI() {
  $$('[data-ui]').forEach(function (e) { var k = e.getAttribute('data-ui'), t = e.classList.contains('bi') || e.closest('.seg') ? UT(k) : '';
    if (e.closest('#top') && k === 'title') t = UT(k);
    e.innerHTML = esc(U(k)) + (t ? '<small class="uitr">' + esc(t) + '</small>' : ''); });
  $('#aiTr').textContent = UT('ai');
  $('#engHint').innerHTML = esc(U('hint_' + ENG)) + (UT('hint_' + ENG) ? '<small class="uitr">' + esc(UT('hint_' + ENG)) + '</small>' : '');
  $$('#langSeg button').forEach(function (b) { b.classList.toggle('on', b.dataset.l === LANG); });
  $$('#engSeg button').forEach(function (b) { b.classList.toggle('on', b.dataset.e === ENG); });
  $$('#domSeg button').forEach(function (b) { b.classList.toggle('on', b.dataset.d === DOMSEL); });
  $$('#outSeg button').forEach(function (b) { b.classList.toggle('on', b.dataset.o === OUT); });
  renderGloss(); renderKey();
}

/* ---------- 프레임 ---------- */
function initFrames() {
  $('#raBox').src = 'ra.html?embed=1';
  $('#c49Box').src = 'ptw-c49.html?embed=1';
  $('#genBox').src = 'ptw-gen.html?embed=1';
  $('#pstBox').src = 'poster.html?embed=1';
}
window.raReady = function () {
  H.ready.ra = 1; var w = RAW();
  H.orig = { KO: {}, STR: {}, sub: '' };
  ['m_site_v', 'm_proc_v', 'm_team_v', 'm_basis_v', 'p1s'].forEach(function (k) { H.orig.KO[k] = w.KO[k]; H.orig.STR[k] = w.STR[k] ? JSON.parse(JSON.stringify(w.STR[k])) : null; });
  var sb = w.document.querySelector('#S1 .sub1 .ed'); H.orig.sub = sb ? sb.innerHTML : '';
  H.orig.photo = w.document.getElementById('photo').getAttribute('src');
  var go = function () { if (H.pending) { var p = H.pending; H.pending = null; p(); } else loadSample('e2'); };
  if (w.document.fonts && w.document.fonts.ready) w.document.fonts.ready.then(go); else go();
};
window.ptwReady = function (k) { H.ready[k] = 1; scheduleSync(); };
window.pstReady = function () { H.ready.pst = 1; scheduleSync(); };
function fitFrame(id) { var f = $('#' + id); try { var d = f.contentDocument, y = f.contentWindow.scrollY || 0, b = 0; Array.prototype.forEach.call(d.body.children, function (el) { if (el.tagName === 'SCRIPT') return; var r = el.getBoundingClientRect(); if (r.height) b = Math.max(b, r.bottom + y); }); if (b > 50) f.style.height = Math.ceil(b + 16) + 'px'; } catch (e) {} }
/* 헤더 왼쪽 아이콘으로 왼쪽 입력란(#side)을 켜고 끈다. 끄면 문서가 넓어져 화면 너비에 다시 맞추고, 상태는 이 브라우저에 기억한다 */
function sideToggle(force) {
  var hide = typeof force === 'boolean' ? force : !document.body.classList.contains('sidehide');
  document.body.classList.toggle('sidehide', hide);
  var b = $('#sideTgl'); if (b) b.setAttribute('aria-expanded', hide ? 'false' : 'true');
  try { localStorage.setItem('cbnu_sidehide', hide ? '1' : '0'); } catch (e) {}
  DOCZ = 0; setTimeout(fitMain, 30);
}
/* 결과 문서(오른쪽 #main, 1180px)만 확대·축소한다 — 입력란은 그대로. Ctrl(⌘)+휠 · 트랙패드 핀치 · 터치 두 손가락 핀치로 배율을 바꾸고, 빈 배경을 두 번 누르면 화면 너비에 맞춘다.
   CSS zoom 은 iPad Safari 에서 iframe 안쪽까지 줄지 않아 오른쪽이 잘렸으므로 transform: scale + 배율에 맞춘 #docsBox(너비·높이)를 쓴다. 넘치면 #main 이 스크롤되어 밀어서 볼 수 있다 */
var DOCZ = 0, ZMIN = 0.25, ZMAX = 1.5, ZT = 0; // DOCZ 0 = 화면 너비에 맞춤
function docFit() { var m = $('#main'); return Math.max(ZMIN, Math.min(1, (m.clientWidth - 24) / 1180)); }
function curZ() { return DOCZ || docFit(); }
function fitMain() {
  var m = $('#main'), d = $('#docs'), b = $('#docsBox'); if (!m || !d || !b) return;
  var z = curZ(); d.style.transform = 'scale(' + z + ')'; b.style.width = Math.round(1180 * z) + 'px'; b.style.height = Math.ceil(d.offsetHeight * z) + 'px';
  bindZoomFrames();
}
function zoomLabel(z) { var e = $('#zlab'); if (!e) return; e.textContent = DOCZ ? Math.round(z * 100) + '%' : '맞춤 ' + Math.round(z * 100) + '%'; e.className = 'on'; clearTimeout(ZT); ZT = setTimeout(function () { e.className = ''; }, 900); }
function zoomAt(nz, px, py) { // px,py: #main 안의 기준점(화면 좌표). 그 지점이 제자리에 머물도록 스크롤을 맞춘다
  var m = $('#main'), old = curZ(); nz = Math.max(ZMIN, Math.min(ZMAX, nz)); if (Math.abs(nz - old) < 0.002) return;
  var cx = (m.scrollLeft + px - 12) / old, cy = (m.scrollTop + py - 12) / old;
  DOCZ = Math.abs(nz - docFit()) < 0.01 ? 0 : nz; fitMain();
  var z = curZ(); m.scrollLeft = Math.max(0, cx * z + 12 - px); m.scrollTop = Math.max(0, cy * z + 12 - py); zoomLabel(z);
}
function zoomFit() { DOCZ = 0; fitMain(); var m = $('#main'); m.scrollLeft = 0; zoomLabel(curZ()); }
var PZ = null; // 핀치 상태
function bindZoom(doc, frame) { // doc: #main 이 들어 있는 문서 또는 iframe 문서. frame 이 있으면 좌표를 부모 화면 좌표로 바꾼다
  if (doc.__zb) return; doc.__zb = 1;
  var m = $('#main');
  function pt(x, y) { if (!frame) return { x: x, y: y }; var r = frame.getBoundingClientRect(), z = curZ(); return { x: r.left + x * z, y: r.top + y * z }; }
  function inMain(p) { var r = m.getBoundingClientRect(); return { x: p.x - r.left, y: p.y - r.top }; }
  var tgt = frame ? doc : m;
  tgt.addEventListener('wheel', function (e) {
    if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault();
    var p = inMain(pt(e.clientX, e.clientY)); zoomAt(curZ() * Math.exp(-e.deltaY * 0.0022), p.x, p.y);
  }, { passive: false });
  function dist(t) { var a = pt(t[0].clientX, t[0].clientY), b = pt(t[1].clientX, t[1].clientY); return { d: Math.hypot(a.x - b.x, a.y - b.y), c: inMain({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }) }; }
  tgt.addEventListener('touchstart', function (e) { if (e.touches.length === 2) { var s = dist(e.touches); PZ = { d0: s.d, z0: curZ() }; } }, { passive: true });
  tgt.addEventListener('touchmove', function (e) { if (PZ && e.touches.length === 2) { e.preventDefault(); var s = dist(e.touches); zoomAt(PZ.z0 * s.d / PZ.d0, s.c.x, s.c.y); } }, { passive: false });
  tgt.addEventListener('touchend', function (e) { if (e.touches.length < 2) PZ = null; }, { passive: true });
  if (frame) { try { var st = doc.createElement('style'); st.textContent = 'html,body{touch-action:pan-x pan-y}'; doc.head.appendChild(st); } catch (x) {} }
}
function bindZoomFrames() { ['raBox', 'c49Box', 'genBox', 'pstBox'].forEach(function (id) { try { var f = $('#' + id), d = f && f.contentDocument; if (d && d.body) bindZoom(d, f); } catch (e) {} }); }

/* ---------- 위험분석 프레임 렌더 후 ---------- */
window.onRA = function (rows) {
  H.rows = (rows || []).map(function (m) { return { id: m.id, no: m.no, v: m.v, cust: !!m.cust, grp: m.grp }; });
  // 지식베이스 표지(KB)가 하나도 없으면(위험 요인이 없거나, AI의 '추가 위험'·직접 추가한 항목뿐) 2.사전작업허가서·3.안전포스터는 근거가 없어 만들지도 보이지도 않는다.
  // 만들면 표본(물속 펌프 감전) 문구가 남아 사진·AI 판독과 어긋난다. 다시 판독해 표지가 나오면 새로 만든다.
  var noKb = !H.rows.some(function (r) { return !r.cust; }), none = noKb && (H.rows.length > 0 || !!H.nohaz);
  document.body.classList.toggle('nohaz', none); if (none) H.sig = {};
  document.body.classList.toggle('nodoc', !H.rows.length && !H.nohaz); // 표지가 0건이어도 AI 판독을 마친 사진이면 '위험 요인 확인되지 않음' 문서를 보인다
  renderPanel(); setTimeout(function () { fitFrame('raBox'); fitMain(); }, 60); scheduleSync();
};
var SYNC_T = null;
function scheduleSync() { clearTimeout(SYNC_T); SYNC_T = setTimeout(function () { syncPTW(); syncPoster(); }, 220); }

/* ---------- 분야 판정 ---------- */
function domAuto() { var S = RAW() ? RAW().S : null; if (!S) return 'n'; var e = 0, g = 0; S.sel.forEach(function (id) { if (id[0] === 'U') e++; else if (id[0] === 'G') g++; }); return e ? 'e' : (g ? 'g' : 'n'); }
function ptwKind() { if (DOMSEL !== 'auto') return DOMSEL; var d = domAuto(); return d === 'g' ? 'gen' : 'c49'; }

/* ---------- 좌측 패널 ---------- */
function renderPanel() {
  var w = RAW(); if (!w) return; var S = w.S;
  var vmap = {}; H.rows.forEach(function (r) { vmap[r.id] = r.v; });
  var d = domAuto(), k = ptwKind();
  var dr = $('#domRes'), key = d === 'n' ? 'domN' : (k === 'c49' ? 'domE' : 'domG');
  dr.className = 'domres ' + (d === 'n' ? '' : (k === 'c49' ? 'e' : 'g'));
  dr.innerHTML = esc(U(key)) + (DOMSEL !== 'auto' && d !== 'n' ? ' <small>(관리감독자 지정)</small>' : '') + (UT(key) ? '<small class="uitr">' + esc(UT(key)) + '</small>' : '');
  $('#tabE').classList.toggle('on', TAB === 'elec'); $('#tabG').classList.toggle('on', TAB === 'gen');
  var order = TAB === 'elec' ? GO : GOG, h = '';
  order.forEach(function (g) {
    var its = KB.filter(function (x) { return x.dom === TAB && x.grp === g; }); if (!its.length) return;
    h += '<div class="kbg"><h5>' + esc((GN[g] || [g])[0]) + (LANG !== 'ko' && GN[g] ? ' <small style="color:#B00020;font-weight:500">' + esc(GN[g][LIX[LANG]]) + '</small>' : '') + '</h5>';
    its.forEach(function (x) {
      var on = S.sel.indexOf(x.id) >= 0, v = vmap[x.id] || x.p * x.s, ai = S.src[x.id] && S.src[x.id].ai;
      h += '<label class="kbi' + (on ? ' chk' : '') + '"><input type="checkbox" data-id="' + x.id + '"' + (on ? ' checked' : '') + '>'
        + '<span class="rk" style="background:' + rkc(v) + '" title="' + (on ? '현재 위험성' : '기본 위험성') + '">' + v + '</span><span class="kid">' + x.id + '</span><span class="kt">' + esc(x.tag[0])
        + (LANG !== 'ko' ? '<small class="uitr">' + esc(x.tag[LIX[LANG]]) + '</small>' : '') + '</span>'
        + (ai ? '<span class="aib">AI</span>' : '') + (on ? '<button class="pin' + (w.ARM === x.id ? ' act' : '') + '" data-pin="' + x.id + '" title="사진에 위치 지정">📍</button>' : '') + '</label>';
    });
    h += '</div>';
  });
  $('#kb').innerHTML = h;
  var nE = S.sel.filter(function (i) { return i[0] === 'U'; }).length, nG = S.sel.filter(function (i) { return i[0] === 'G'; }).length, nC = S.sel.filter(function (i) { return i[0] === 'C'; }).length;
  var LEG = { ko: ['U: Utility — 전력·가스·수도 등 공급설비', 'G: General — 일반 건설 작업'], en: ['U: Utility — power, gas, water and other supply facilities', 'G: General — general construction work'], zh: ['U：Utility — 电力·燃气·供水等供应设施', 'G：General — 一般建设作业'], vi: ['U: Utility — cơ sở cung cấp điện, gas, nước…', 'G: General — công việc xây dựng chung'], uz: ['U: Utility — elektr, gaz, suv va boshqa taʼminot inshootlari', 'G: General — umumiy qurilish ishlari'] };
  $('#kbLeg').innerHTML = '<b>표지 번호 범례</b>' + LEG.ko.map(function (k, i) { return '<div>' + esc(k) + (LANG !== 'ko' && LEG[LANG] ? '<small class="uitr">' + esc(LEG[LANG][i]) + '</small>' : '') + '</div>'; }).join('');
  $('#kbCount').innerHTML = '선택 <b>' + S.sel.length + '</b> / 39 · 전기 ' + nE + ' · 일반 ' + nG + (nC ? ' · 추가 ' + nC : '');
  $('#corr').innerHTML = CORR.map(function (c) { return '<label><input type="checkbox" data-c="' + c.id + '"' + (S.corr[c.id] ? ' checked' : '') + '><span><b>' + esc(c.lab[0]) + '</b> — ' + esc(c.why[0]) + ' <i>(' + (c.grp ? c.grp.join('·') : '전 군') + ')</i></span></label>'; }).join('');
  $('#custList').innerHTML = S.custom.map(function (c) { var on = S.sel.indexOf(c.id) >= 0; return '<div class="cl"><span><b>' + c.id + '</b> ' + esc(c.name) + ' (빈도 ' + c.p + '·강도 ' + c.s + ')' + (on ? ' <button class="pin" data-pin="' + c.id + '" title="사진에 위치 지정" style="color:inherit">📍</button>' : '') + '</span><button data-del="' + c.id + '" title="삭제">✕</button></div>'; }).join('');
}
function setTab(t) { TAB = t; renderPanel(); }
function rerender() { var w = RAW(); if (w) w.renderAll(); }
function selNone() { var w = RAW(); if (!w) return; w.S.sel = w.S.sel.filter(function (id) { return id[0] === 'C'; }); w.S.mk = {}; w.S.ps = {}; rerender(); }
document.addEventListener('change', function (ev) {
  var t = ev.target, w = RAW(); if (!w) return; var S = w.S;
  if (t.matches('#kb input[data-id]')) { var id = t.getAttribute('data-id'), i = S.sel.indexOf(id);
    if (t.checked && i < 0) { S.sel.push(id); S.src[id] = S.src[id] || { chk: 1 }; } else if (!t.checked && i >= 0) { S.sel.splice(i, 1); delete S.mk[id]; delete S.ps[id]; }
    rerender(); }
  else if (t.matches('#corr input')) { S.corr[t.getAttribute('data-c')] = t.checked; Object.keys(S.ps).forEach(function (k) { delete S.ps[k].p; }); rerender(); }
});
document.addEventListener('click', function (ev) {
  var t = ev.target, w = RAW();
  if (!t.closest('.dd')) $$('.ddm').forEach(function (m) { m.classList.remove('open'); });
  var pin = t.closest && t.closest('[data-pin]'); if (pin && w) { ev.preventDefault(); var id = pin.getAttribute('data-pin'); w.ARM = (w.ARM === id) ? null : id; w.renderPanel(); renderPanel();
    if (w.ARM) { status('📍 <b>' + id + '</b> — 오른쪽 위험분석 1면의 사진에서 위치를 클릭하세요.', 'info'); $('#secRA').scrollIntoView({ behavior: 'smooth' }); } return; }
  var del = t.closest && t.closest('[data-del]'); if (del && w) { var id2 = del.getAttribute('data-del'); w.S.custom = w.S.custom.filter(function (c) { return c.id !== id2; }); w.S.sel = w.S.sel.filter(function (x) { return x !== id2; }); delete w.S.mk[id2]; rerender(); return; }
  var b = t.closest && t.closest('#langSeg button,#engSeg button,#domSeg button,#outSeg button');
  if (b) { if (b.dataset.l) setLang(b.dataset.l); else if (b.dataset.e) setEng(b.dataset.e); else if (b.dataset.d) { DOMSEL = b.dataset.d; applyUI(); renderPanel(); H.sig = {}; scheduleSync(); } else if (b.dataset.o) setOut(b.dataset.o); }
});
function addCustom() {
  var w = RAW(); if (!w) return; var nm = $('#cName').value.trim(); if (!nm) { $('#cName').focus(); return; }
  var c = { id: 'C' + (++w.S.cn), name: nm, cause: $('#cCause').value.trim() || nm, acts: $('#cAct').value.split(/\n+/).map(function (x) { return x.trim(); }).filter(Boolean), p: +$('#cP').value, s: +$('#cS').value };
  if (!c.acts.length) c.acts = ['관리감독자가 대책을 적는다']; w.S.custom.push(c); w.S.sel.push(c.id);
  $('#cName').value = ''; $('#cCause').value = ''; $('#cAct').value = ''; rerender();
}

/* ---------- 언어·엔진·출력 ---------- */
function setLang(l) {
  LANG = l; applyUI(); var w = RAW(); if (w) w.setLang(l);
  ['c49Box', 'genBox'].forEach(function (id) { var x = W(id); try { if (x && x.setLang) x.setLang(l); } catch (e) {} });
  var p = W('pstBox'); try { if (p && p.setLang) p.setLang(l); } catch (e) {}
  setTimeout(function () { fitFrame('c49Box'); fitFrame('genBox'); fitFrame('pstBox'); mkPrompt(); }, 300);
}
function setEng(e) { ENG = e; applyUI(); if (e === 'ai' && H.photo && !H.sample && !BUSY) runRead(); else if (e === 'kw' && H.photo && !H.sample) runKw(); }
function setOut(o) { OUT = o; document.body.classList.remove('out-ra', 'out-ptw', 'out-pst'); if (o !== 'all') document.body.classList.add('out-' + o); applyUI(); setTimeout(fitMain, 50); }
function goGen() { var w = RAW(); if (!w) return; if (H.photo && !H.sample && ENG === 'ai' && !w.S.sel.length) { runRead(); return; } applyMeta(); $('#docs').scrollIntoView({ behavior: 'smooth' }); }
function ddOpen(id) { var m = $('#' + id), o = m.classList.contains('open'); $$('.ddm').forEach(function (x) { x.classList.remove('open'); }); if (!o) m.classList.add('open'); }

/* ---------- 현장 정보 → 문서 ---------- */
var DEF = {
  site: ['○○ 건설현장', '○○ construction site', '○○建设现场', 'Công trường ○○', '○○ qurilish obyekti'],
  siteG1: ['철근콘크리트 골조 공사 현장', 'Reinforced-concrete frame construction site', '钢筋混凝土框架施工现场', 'Công trường thi công khung bê tông cốt thép', 'Temir-beton karkas qurilish obyekti'],
  procE: ['전기 작업 (현장사진 판독)', 'Electrical work (site-photo reading)', '电气作业（现场照片判读）', 'Công việc điện (đọc ảnh hiện trường)', 'Elektr ishi (joy surati tahlili)'],
  procG: ['일반 건설작업 (현장사진 판독)', 'General construction work (site-photo reading)', '一般建设作业（现场照片判读）', 'Công việc xây dựng chung (đọc ảnh hiện trường)', 'Umumiy qurilish ishi (joy surati tahlili)'],
  team: ['관리감독자·안전관리자·근로자 대표·통역', 'Supervisor, safety manager, worker representative, interpreter', '管理监督员·安全管理者·工人代表·翻译', 'Giám sát viên, cán bộ an toàn, đại diện công nhân, phiên dịch', 'Nazoratchi, xavfsizlik menejeri, ishchilar vakili, tarjimon'],
  basisG: ['산업안전보건법 제36조, 같은 법 시행규칙 제37조, 안전보건규칙 제1편 총칙·제2편 안전기준, KOSHA GUIDE C-C-49-2026, 3×3 추정', 'OSH Act Art. 36, Enforcement Rule Art. 37, OSH Rule Parts 1–2, KOSHA GUIDE C-C-49-2026, 3×3 estimation', '产业安全保健法第36条、同法施行规则第37条、安全保健规则第1编总则·第2编安全标准、KOSHA GUIDE C-C-49-2026、3×3估算', 'Luật ATVSLĐ Điều 36, Quy tắc thi hành Điều 37, Quy tắc ATVSLĐ Phần 1–2, KOSHA GUIDE C-C-49-2026, ước tính 3×3', 'MMX qonuni 36-modda, Ijro qoidalari 37-modda, Qoidalar 1–2-qism, KOSHA GUIDE C-C-49-2026, 3×3 baholash'],
};
function userArr(v) { return [v, '', '', '', '']; }
function applyMeta(noRender) {
  var w = RAW(); if (!w) return; var site = $('#m_site').value.trim(), proc = $('#m_proc').value.trim(), by = $('#m_by').value.trim();
  var e2 = H.sample === 'e2', d = domAuto();
  function put(k, arr) { w.setK(k, arr, true); }
  function orig(k) { w.KO[k] = H.orig.KO[k]; if (H.orig.STR[k]) w.STR[k] = JSON.parse(JSON.stringify(H.orig.STR[k])); }
  if (site) put('m_site_v', userArr(site)); else if (e2) orig('m_site_v'); else put('m_site_v', H.sample === 'g1' ? DEF.siteG1 : DEF.site);
  if (proc) put('m_proc_v', userArr(proc)); else if (e2) orig('m_proc_v'); else put('m_proc_v', d === 'g' ? DEF.procG : DEF.procE);
  if (by) put('m_team_v', userArr(by + ' (관리감독자) · 근로자 대표 · 통역')); else if (e2) orig('m_team_v'); else put('m_team_v', DEF.team);
  if (e2 || d !== 'g') orig('m_basis_v'); else put('m_basis_v', DEF.basisG);
  var sb = w.document.querySelector('#S1 .sub1 .ed');
  if (e2) { if (sb) sb.innerHTML = H.orig.sub; orig('p1s'); }
  else { var ai = ENG === 'ai' && w.S.src && Object.keys(w.S.src).some(function (k) { return w.S.src[k] && w.S.src[k].ai; });
    if (sb) sb.textContent = (H.fname || '현장사진') + ' · ' + (ai ? 'AI 사진 판독 + ' : '') + '체크리스트(지식베이스) 기반 판독 · [4단계 홈페이지]';
    var f = H.fname || 'site photo';
    w.STR.p1s = { en: 'Photo: ' + f + ' · ' + (ai ? 'AI photo reading + ' : '') + 'knowledge-base checklist · [Stage 4 website]', zh: '照片：' + f + ' · ' + (ai ? 'AI照片判读 + ' : '') + '清单（知识库）判读 · [第4阶段网站]', vi: 'Ảnh: ' + f + ' · ' + (ai ? 'AI đọc ảnh + ' : '') + 'danh mục cơ sở tri thức · [trang web giai đoạn 4]', uz: 'Surat: ' + f + ' · ' + (ai ? 'SI surat tahlili + ' : '') + 'bilim bazasi roʻyxati · [4-bosqich sayti]' }; }
  w.HDATE = $('#m_date').value.trim(); w.HBY = by;
  if (!noRender) w.renderAll();
}

/* ---------- 표본·사진 ---------- */
function freshState(w) { var S = w.initState(); S.ps = {}; return S; }
function loadSample(n) {
  H.nohaz = false;
  var w = RAW(); if (!w) { H.pending = function () { loadSample(n); }; return; }
  var s = SAMPLES[n]; H.sample = n; H.fname = s.name; H.gpt = null; H.sig = {}; $('#gptFull').style.display = 'none';
  var S = freshState(w);
  if (n === 'g1') { S.ph2 = false; S.sel = []; S.mk = {}; S.src = {}; s.hits.forEach(function (h) { S.sel.push(h[0]); S.mk[h[0]] = [h[1], h[2]]; S.src[h[0]] = { ai: h[3] }; });
    S.scene = s.scene; S.corr = JSON.parse(JSON.stringify(s.corr)); S.fname = s.name; TAB = 'gen'; }
  else { TAB = 'elec'; }
  w.S = S; H.photo = s.photo;
  var im = new Image(); im.onload = function () { H.pw = im.naturalWidth; H.ph = im.naturalHeight; }; im.src = s.photo;
  $('#thumb').innerHTML = '<img src="' + s.photo + '" alt="">'; $('#drop').classList.add('has');
  status(n === 'e2' ? '⚡ 표본 1 — 사진_현장 사진 sample_전기 2 (3단계 판독 결과 10건). 새 사진을 올리면 바뀝니다.' : '🏗️ 표본 2 — 현장 사진 sample_일반 1 (3단계 판독 결과 7건). 새 사진을 올리면 바뀝니다.', 'info');
  w.hostPhoto(n === 'e2' ? H.orig.photo : s.photo, function () { applyMeta(true); w.setLang(LANG); });
  if (s.poster) { var gf = $('#gptFull'); gf.style.display = 'block'; gf.querySelector('img').src = s.poster;
    gf.querySelector('b').textContent = '실사판 포스터 — Claude가 ChatGPT에서 샘플 포스터 양식을 참조해 생성 (표본 ' + (n === 'e2' ? '1' : '2') + ', 오른쪽 위 충북대학교 심볼 합성)'; }
}
function resetAll() {
  H.nohaz = false;
  var w = RAW(); if (!w) return; H.sample = null; H.photo = null; H.fname = ''; H.gpt = null; H.sig = {};
  var S = freshState(w); S.ph2 = false; S.sel = []; S.mk = {}; S.src = {}; S.scene = null; S.fname = '-'; S.corr = { sum: false, rain: false, morn: false, fore: false }; w.S = S;
  $('#thumb').innerHTML = ''; $('#drop').classList.remove('has'); status('', ''); $('#gptFull').style.display = 'none';
  ['m_site', 'm_proc', 'm_date', 'm_by', 'm_memo'].forEach(function (k) { $('#' + k).value = ''; });
  w.renderAll();
}
function shrink(src, max, cb) { var im = new Image(); im.onload = function () { var w = im.naturalWidth, h = im.naturalHeight, k = Math.min(1, max / Math.max(w, h)); var c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); cb(c.toDataURL('image/jpeg', 0.86), c.width, c.height); }; im.src = src; }
var AFTER = null; // 판독이 끝났을 때 한 번 부르는 콜백 (감시 모드 위험 알림 루틴)
function afterRead(ok) { var f = AFTER; AFTER = null; if (f) f(ok); }
function onFile(f, cb) {
  AFTER = cb || null;
  if (!f || !/^image\//.test(f.type)) { afterRead(false); return; } var r = new FileReader();
  r.onload = function () { shrink(r.result, 1600, function (small, pw, ph) {
    var w = RAW(); if (!w) { afterRead(false); return; } H.nohaz = false; H.sample = null; H.photo = small; H.pw = pw; H.ph = ph; H.fname = f.name; H.gpt = null; H.sig = {}; $('#gptFull').style.display = 'none';
    $('#thumb').innerHTML = '<img src="' + small + '" alt="">'; $('#drop').classList.add('has');
    var S = freshState(w); S.ph2 = false; S.sel = []; S.mk = {}; S.src = {}; S.scene = null; S.fname = f.name; S.memo = $('#m_memo').value; S.corr = { sum: false, rain: false, morn: false, fore: false }; w.S = S;
    w.hostPhoto(small, function () { if (ENG === 'ai') runRead(); else if (ENG === 'kw') { runKw(); afterRead(false); } else { applyMeta(true); w.renderAll(); status('✋ 직접 선택 — 체크리스트에서 보이는 위험 표지를 고르세요.', 'info'); afterRead(false); } });
  }); };
  r.readAsDataURL(f);
}
function runKw() { var w = RAW(); if (!w) return; w.S.memo = $('#m_memo').value + ' ' + $('#m_proc').value; w.S.fname = H.fname || w.S.fname; w.S.scene = null; w.doKw(); H.nohaz = !w.S.sel.length; applyMeta(true); w.renderAll(); status('🔎 ' + esc(w.S.kwmsg || '키워드 판독 완료'), 'ok'); }

/* ---------- AI 판독 (/api/read) ---------- */
function runRead() {
  var w = RAW(); if (BUSY || !w || !H.photo) { afterRead(false); return; } BUSY = true; var lang = LANG;
  status('<span class="spin"></span> AI가 사진을 판독하는 중입니다… (20~40초)', 'busy');
  var ctrl = window.AbortController ? new AbortController() : null, tm = setTimeout(function () { if (ctrl) ctrl.abort(); }, 65000);
  fetch('api/read', { method: 'POST', headers: { 'content-type': 'application/json' }, signal: ctrl ? ctrl.signal : undefined,
    body: JSON.stringify({ image: H.photo, name: H.fname, lang: lang, key: APIKEY || undefined, site: { kind: $('#m_proc').value, place: $('#m_site').value } }) })
    .then(function (r) { return r.json().catch(function () { return { ok: false, reason: 'http_' + r.status }; }); })
    .then(function (j) { clearTimeout(tm); BUSY = false; if (j && j.ok && ((j.hits && j.hits.length) || (j.extra && j.extra.length))) { applyAI(j, lang); afterRead(true); } else if (j && j.ok) { applyNone(j, lang); afterRead(true); } else { fallback(j && (j.reason || j.error)); afterRead(false); } })
    .catch(function (e) { clearTimeout(tm); BUSY = false; fallback(e && e.name === 'AbortError' ? 'timeout' : 'network'); afterRead(false); });
}
function applyAI(j, lang) {
  var w = RAW(); if (!w) return; H.nohaz = false; var S = w.S; S.sel = []; S.mk = {}; S.src = {}; S.ps = {};
  j.hits.forEach(function (h) { if (!KBI[h.id] || S.sel.indexOf(h.id) >= 0) return; S.sel.push(h.id); S.mk[h.id] = [Math.round(h.x), Math.round(h.y)]; S.src[h.id] = { ai: arr5(h.evidence, lang) }; });
  S.scene = j.scene ? arr5(j.scene, lang) : null;
  var noKbHit = !j.hits || !j.hits.length;
  (j.extra || []).slice(0, 3).forEach(function (x) { var t = Array.isArray(x) ? x[0] : x; if (!t) return; var c = { id: 'C' + (++S.cn), name: String(t), cause: String(t), acts: ['관리감독자가 대책을 적는다'], p: 2, s: 2 }; c.ai = 1; if (Array.isArray(x) && x[1]) c.nm5 = arr5(x, lang); S.custom.push(c); S.sel.push(c.id); });
  if (j.domain === 'gen') TAB = 'gen'; else if (j.domain === 'elec') TAB = 'elec';
  applyMeta(true); w.renderAll();
  status('🤖 AI 판독 완료 — 위험 표지 <b>' + j.hits.length + '</b>건' + ((j.extra || []).length ? ', 지식베이스 밖 추가 위험 ' + j.extra.length + '건(⑥ 목록)' : '') + ' · ' + esc(j.model || '') + '<br><small>체크리스트에서 더하거나 빼고, 빈도·강도는 평가표에서 고칩니다.</small>' + (noKbHit ? '<br><small>⚠️ 지식베이스 표지가 없어 <b>사전작업허가서·안전포스터는 만들지 않습니다</b>(추가 위험은 위험분석·평가표에만 반영).</small>' : ''), noKbHit ? 'warn' : 'ok');
}
/* AI가 사진에서 위험 요인을 하나도 못 찾았을 때: 키워드 판독으로 임의의 표지를 채우지 않고 '위험 요인 확인되지 않음, 관리감독자 확인 요함'으로 표시한다 */
function applyNone(j, lang) {
  var w = RAW(); if (!w) return; H.nohaz = true; var S = w.S; S.sel = []; S.mk = {}; S.src = {}; S.ps = {}; S.scene = j.scene && j.scene[0] ? arr5(j.scene, lang) : null;
  applyMeta(true); w.renderAll();
  status('🤖 AI 판독 완료 — <b>위험 요인 확인되지 않음, 관리감독자 확인 요함</b> · ' + esc(j.model || '') + '<br><small>사진에서 표지를 찾지 못했습니다. 관리감독자가 현장에서 직접 확인하고, 필요하면 체크리스트에서 표지를 고르세요.</small>', 'warn');
}
function fallback(err) {
  var why = err === 'no_key' ? 'API 키가 없어 AI 판독을 하지 못했습니다' : (err === 'bad_key' ? 'API 키가 거부되었습니다(⑧ 확인)' : 'AI 판독 실패' + (err ? ' (' + err + ')' : ''));
  runKw(); status('⚠️ ' + esc(why) + ' — 키워드 판독으로 대체했습니다. ' + esc(RAW() ? RAW().S.kwmsg || '' : ''), 'warn');
}

/* ---------- API 키 ---------- */
function renderKey() { var e = $('#keyStat'); if (!e) return;
  if (APIKEY) { e.textContent = '이 브라우저에 저장된 키 사용 중 (…' + APIKEY.slice(-4) + ')'; e.className = 'keystat on'; }
  else if (SERVERKEY) { e.textContent = '입력한 키 없음 — 서버 키로 AI 판독'; e.className = 'keystat on'; }
  else if (SERVERKEY === false) { e.textContent = '서버에도 키가 없습니다 — AI 판독 대신 키워드 판독을 씁니다'; e.className = 'keystat warn'; }
  else { e.textContent = '키 상태 확인 중…'; e.className = 'keystat'; } }
function keySave() { var v = ($('#apiKey').value || '').trim(); if (!v) return; if (!/^sk-ant-/.test(v)) { $('#keyStat').textContent = 'sk-ant- 로 시작하는 키를 넣으세요'; $('#keyStat').className = 'keystat warn'; return; }
  APIKEY = v; try { localStorage.setItem('cbnu_key', v); } catch (e) {} $('#apiKey').value = ''; renderKey(); if (H.photo && !H.sample && ENG === 'ai') runRead(); }
function keyClear() { APIKEY = ''; try { localStorage.removeItem('cbnu_key'); } catch (e) {} renderKey(); }
function probe() { fetch('api/read').then(function (r) { return r.json(); }).then(function (j) { SERVERKEY = !!(j && j.key); renderKey(); }).catch(function () { SERVERKEY = false; renderKey(); }); }

/* ---------- 사전작업허가서 ---------- */
function sameSet(a, b) { return a.slice().sort().join() === b.slice().sort().join(); }
function syncPTW() {
  var w = RAW(); if (!w || !H.rows.length) return; var k = ptwKind(), other = k === 'c49' ? 'gen' : 'c49';
  $('#' + k + 'Box').style.display = ''; $('#' + other + 'Box').style.display = 'none';
  if (!H.ready[k]) return; var f = W(k + 'Box'); if (!f || !f.hostPTW) return;
  var ids = w.S.sel.filter(function (id) { return id[0] !== 'C'; });
  var own = (k === 'c49' && H.sample === 'e2') || (k === 'gen' && H.sample === 'g1');
  var base = k === 'c49' ? w.D.PHORD : SAMPLES.g1.hits.map(function (h) { return h[0]; });
  var sig = [ids.join(), H.sample, H.photo ? H.photo.length : 0, JSON.stringify(w.S.mk)].join('|');
  if (H.sig[k] === sig) { if (H.sig[k + 'L'] !== LANG) { f.setLang(LANG); H.sig[k + 'L'] = LANG; } setTimeout(function () { fitFrame(k + 'Box'); fitMain(); }, 150); return; }
  H.sig[k] = sig; H.sig[k + 'L'] = LANG;
  var mk = {}; Object.keys(w.S.mk).forEach(function (id) { mk[id] = w.S.mk[id]; });
  if (own && sameSet(ids, base)) f.hostPTW({ sample: true, lang: LANG });
  else if (own) f.hostPTW({ same: true, ids: ids, lang: LANG });
  else f.hostPTW({ ids: ids, photo: H.photo || (H.orig && H.orig.photo), mk: mk, fname: H.fname, lang: LANG, kb: ptwTexts(k, w, ids), blankF: k === 'c49' ? ['voltage'] : [] });
  setTimeout(function () { fitFrame(k + 'Box'); fitMain(); }, 250);
}


/* 새 사진일 때 허가서의 표본 전용 문구를 판독 결과로 바꾼다 */
function J5() { var o = ['', '', '', '', '']; for (var i = 0; i < arguments.length; i++) { var x = arguments[i]; for (var j = 0; j < 5; j++) o[j] += Array.isArray(x) ? (x[j] || '') : x; } return o; }
function joinA(list, sep) { var o = ['', '', '', '', '']; list.forEach(function (x, i) { for (var j = 0; j < 5; j++) o[j] += (i ? sep : '') + (x[j] || ''); }); return o; }
var BL = ['', '', '', '', ''];
function ptwTexts(k, w, ids) {
  var S = w.S, rows = H.rows.filter(function (r) { return KBI[r.id]; }).sort(function (a, b) { return b.v - a.v || a.no - b.no; }), n = ids.length;
  var nE = ids.filter(function (i) { return i[0] === 'U'; }).length, nG = n - nE, top = rows[0] ? KBI[rows[0].id] : null;
  var tags3 = joinA(rows.slice(0, 3).map(function (r) { return short(KBI[r.id].tag, 40); }), ', ');
  var site = $('#m_site').value.trim(), o = {};
  if (k === 'c49') {
    o.rdScene = S.scene ? J5(['장면: ', 'Scene: ', '场景：', 'Cảnh: ', 'Sahna: '], S.scene) : ['장면: 올린 사진 — 관리감독자가 장면을 확인해 적는다', 'Scene: uploaded photo — the supervisor describes it after checking', '场景：上传的照片 — 由管理监督员确认后填写', 'Cảnh: ảnh tải lên — giám sát viên kiểm tra rồi ghi lại', 'Sahna: yuklangan surat — nazoratchi tekshirib yozadi'];
    o.rdMk = ['판독 표지 ' + n + '건 (번호·KB ID)', n + ' indicators read (No.·KB ID)', '判读标志' + n + '项（编号·KB ID）', n + ' dấu hiệu đã đọc (số·KB ID)', n + ' ta belgi aniqlandi (raqam·KB ID)'];
    var on = CORR.filter(function (c) { return S.corr[c.id]; });
    o.rdCorr = on.length ? J5(['가능성 보정: ', 'Likelihood correction: ', '可能性修正：', 'Điều chỉnh khả năng: ', 'Ehtimollik tuzatishi: '], joinA(on.map(function (c) { return c.lab; }), ' · '), ' +1') : ['가능성 보정: 없음', 'Likelihood correction: none', '可能性修正：无', 'Điều chỉnh khả năng: không', 'Ehtimollik tuzatishi: yoʻq'];
    o.rdRa = ['연결 위험성평가표: 4단계 홈페이지 위험성평가표 (같은 표지 번호)', 'Linked risk assessment: Stage 4 website RA sheet (same indicator numbers)', '关联风险评估表：第4阶段网站风险评估表（标志编号相同）', 'Bảng đánh giá liên kết: bảng RA trên trang giai đoạn 4 (cùng số dấu hiệu)', 'Bogʻlangan baholash: 4-bosqich sayti RA jadvali (belgi raqamlari bir xil)'];
    if (top) o.rdRisk = J5(['핵심 위험: ', 'Key risk: ', '核心危险：', 'Rủi ro chính: ', 'Asosiy xavf: '], short(top.tag, 60), ' — ', top.cause);
    o.vSummary = J5(['현장사진 판독 위험: ', 'Hazards read from the photo: ', '现场照片判读危险：', 'Nguy hiểm đọc từ ảnh: ', 'Suratdan aniqlangan xavflar: '], tags3, [' — 작업 내용·범위는 관리감독자가 적는다', ' — the supervisor fills in the work scope', ' — 作业内容·范围由管理监督员填写', ' — giám sát viên ghi nội dung, phạm vi công việc', ' — ish mazmuni va doirasini nazoratchi yozadi']);
    o.vRaNo = ['4단계 홈페이지 위험성평가표', 'Stage 4 website RA sheet', '第4阶段网站风险评估表', 'Bảng RA trên trang giai đoạn 4', '4-bosqich sayti RA jadvali'];
    ['vArea', 'vEqNo', 'vEqName', 'vEquip', 'vHead', 'vIso1', 'vIso2', 'vKey', 'vSpecial', 'vVolt'].forEach(function (x) { o[x] = BL; });
    o.vLoc = site ? [site, '', '', '', ''] : BL;
  } else {
    o.dom = J5(['분야 판정: ', 'Field: ', '领域判定：', 'Phân loại: ', 'Soha: '], nE ? ['전기 표지 포함 — 관리감독자가 일반 건설 PTW 지정', 'electrical indicators present — general construction PTW chosen by the supervisor', '含电气标志 — 由管理监督员指定一般建设PTW', 'có dấu hiệu điện — giám sát viên chọn PTW xây dựng chung', 'elektr belgilari bor — umumiy qurilish PTW ni nazoratchi tanlagan'] : ['일반 안전분야', 'general safety', '一般安全领域', 'an toàn chung', 'umumiy xavfsizlik'],
      [' (전기 표지 ' + nE + '건 · 일반 표지 ' + nG + '건) → KOSHA GUIDE C-C-49-2026 일반 건설 PTW 적용', ' (' + nE + ' electrical · ' + nG + ' general indicators) → KOSHA GUIDE C-C-49-2026 general construction PTW applies', '（电气标志' + nE + '项 · 一般标志' + nG + '项）→ 适用KOSHA GUIDE C-C-49-2026一般建设PTW', ' (' + nE + ' dấu hiệu điện · ' + nG + ' dấu hiệu chung) → áp dụng PTW xây dựng chung KOSHA GUIDE C-C-49-2026', ' (' + nE + ' ta elektr · ' + nG + ' ta umumiy belgi) → KOSHA GUIDE C-C-49-2026 umumiy qurilish PTW qoʻllanadi']);
    o.hitH = ['판독 위험 표지 ' + n + '건 (번호·KB ID)', n + ' hazard indicators read (No.·KB ID)', '判读危险标志' + n + '项（编号·KB ID）', n + ' dấu hiệu nguy hiểm (số·KB ID)', n + ' ta xavf belgisi (raqam·KB ID)'];
    var hot = ids.some(function (i) { return KBI[i] && KBI[i].hot; }), sp = [];
    ids.forEach(function (i) { (KBI[i] && KBI[i].supp || []).forEach(function (x) { if (sp.indexOf(x) < 0 && SUPP[x]) sp.push(x); }); });
    o.dec = J5(['주 허가: ', 'Main permit: ', '主许可：', 'Giấy phép chính: ', 'Asosiy ruxsat: '], SUPP[hot ? 'hot' : 'gen'], [' · 보충허가: ', ' · Supplementary: ', ' · 补充许可：', ' · Bổ sung: ', ' · Qoʻshimcha: '],
      sp.length ? joinA(sp.map(function (x) { return SUPP[x]; }), '·') : ['없음', 'none', '无', 'không', 'yoʻq'],
      [' — 관리감독자가 현장에서 확인한다', ' — confirmed on site by the supervisor', ' — 由管理监督员现场确认', ' — giám sát viên xác nhận tại hiện trường', ' — nazoratchi joyida tasdiqlaydi']);
  }
  return o;
}

/* ---------- 안전포스터 ---------- */
function themeOf(id) { var k = KBI[id]; return k ? (TGRP[k.dom][k.grp] || (k.dom === 'elec' ? 'shock' : 'fall')) : null; }
function mainTheme(rows) { var sc = {}; rows.forEach(function (r) { var t = themeOf(r.id); if (t) sc[t] = (sc[t] || 0) + r.v; }); var best = null; Object.keys(sc).forEach(function (t) { if (!best || sc[t] > sc[best]) best = t; }); return best || 'shock'; }
function short(a, n) { return a.map(function (s) { s = String(s || '').split(' · ')[0].split(' — ')[0].trim(); return s.length > (n || 60) ? s.slice(0, (n || 60) - 1) + '…' : s; }); }
function splitActs(arr) { var parts = arr.map(function (s, i) { var re = (i === 0 || i === 2) ? /(?=[①②③④⑤⑥⑦⑧⑨])/ : /(?=\(\d\)\s)/; return String(s).split(re).map(function (x) { return x.replace(/^([①-⑨]|\(\d\))\s*/, '').trim(); }).filter(Boolean); });
  var n = parts[0].length; if (parts.every(function (p) { return p.length === n; })) { var o = []; for (var j = 0; j < n; j++) o.push(parts.map(function (p) { return p[j]; })); return o; } return [arr]; }
function lawNums(rows) { var out = []; rows.forEach(function (r) { var k = KBI[r.id]; if (!k) return; var t = String(k.law).split('/')[0], re = /제(\d+)조(의(\d+))?/g, m;
  while ((m = re.exec(t))) { var pre = t.slice(0, m.index); if (pre.lastIndexOf('산업안전보건법') > pre.lastIndexOf('규칙')) continue; var a = m[1] + (m[3] ? '의' + m[3] : ''); if (out.indexOf(a) < 0) out.push(a); } }); return out.slice(0, 8); }
function posterData(rows, kind) {
  var kbRows = rows.filter(function (r) { return !r.cust && KBI[r.id]; }).sort(function (a, b) { return b.v - a.v || a.no - b.no; });
  var th = mainTheme(kbRows), T = THEMES[th], tx = {};
  ['slogan', 't1', 't2', 'sub', 'good_t', 'good_c', 'banner'].forEach(function (f) { tx[f === 'slogan' ? 'c_slogan' : f] = T[f]; });
  var top = kbRows.slice(0, 3), icons = [];
  top.forEach(function (r, i) { var k = KBI[r.id]; tx['d' + i + '_t'] = short(k.tag, 40); tx['d' + i + '_c'] = k.cause; icons[i] = icon(themeOf(r.id), false); });
  var acts = [], used = {}; for (var pass = 0; pass < 3 && acts.length < 3; pass++) top.forEach(function (r) { if (acts.length >= 3) return; var a = splitActs(KBI[r.id].act)[pass]; if (a && !used[a[0]]) { used[a[0]] = 1; acts.push({ a: a, r: r }); } });
  acts.forEach(function (x, i) { var k = KBI[x.r.id]; tx['m' + i + '_t'] = x.a; tx['m' + i + '_c'] = [x.r.id + ' ' + short(k.tag, 34)[0] + ' 대책', x.r.id + ' — countermeasure', x.r.id + ' 对策', 'Biện pháp ' + x.r.id, x.r.id + ' chorasi']; icons[3 + i] = icon(themeOf(x.r.id), true); });
  if (top[0]) { var t0 = short(KBI[top[0].id].tag, 34); tx.bad_t = ['현장사진: ' + t0[0], 'Site photo: ' + t0[1], '现场照片：' + t0[2], 'Ảnh hiện trường: ' + t0[3], 'Obyekt surati: ' + t0[4]];
    var lst = kbRows.slice(0, 5); tx.bad_c = [0, 1, 2, 3, 4].map(function (j) { return lst.map(function (r) { return '①②③④⑤⑥⑦⑧⑨'[r.no - 1 > 8 ? 8 : r.no - 1] + ' ' + short(KBI[r.id].tag, 28)[j]; }).join('  '); });
    tx.data = KBI[top[0].id].csi; }
  var nums = lawNums(kbRows), g = 'C-C-49-2026';
  tx.law = ['산업안전보건기준에 관한 규칙 제' + nums.join('·') + '조 · KOSHA GUIDE ' + g, 'OSH Standards Rule Art. ' + nums.join(', ') + ' · KOSHA GUIDE ' + g, '产业安全保健标准规则 第' + nums.join('·') + '条 · KOSHA GUIDE ' + g, 'Quy tắc tiêu chuẩn ATVSLĐ Điều ' + nums.join(', ') + ' · KOSHA GUIDE ' + g, 'MMX standartlari qoidasi ' + nums.join(', ') + '-moddalar · KOSHA GUIDE ' + g];
  return { texts: tx, icons: icons, nd: top.length, nm: acts.length, theme: th, ids: top.map(function (r) { return r.id; }) };
}
function icon(th, ok) { var bg = ok ? '#e8f5ea' : '#fdecea', badge = ok ? '<circle cx="140" cy="20" r="14" fill="#1E7B3A"/><path d="M132,20 l5,5 l10,-11" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' : '<circle cx="140" cy="20" r="14" fill="#B3261E"/><path d="M133,13 l14,14 M147,13 l-14,14" stroke="#fff" stroke-width="4" stroke-linecap="round"/>';
  return '<svg viewBox="0 0 160 120" preserveAspectRatio="xMidYMid meet"><rect width="160" height="120" fill="' + bg + '"/>' + (ICON[th] || ICON.shock) + badge + '</svg>'; }
function syncPoster() {
  var w = RAW(); if (!w || !H.rows.length || !H.ready.pst) return; var f = W('pstBox'); if (!f || !f.hostPST) return;
  var ids = w.S.sel.slice(), k = ptwKind();
  var sig = [ids.join(), JSON.stringify(H.rows.map(function (r) { return r.v; })), H.sample, H.photo ? H.photo.length : 0, H.gpt ? H.gpt.length : 0, JSON.stringify(w.S.mk), k].join('|');
  if (H.sig.pst === sig) { if (H.sig.pstL !== LANG) { f.setLang(LANG); H.sig.pstL = LANG; mkPrompt(); } return; }
  H.sig.pst = sig; H.sig.pstL = LANG;
  if (H.sample === 'e2' && sameSet(ids, w.D.PHORD)) { f.hostPST({ sample: true, gpt: H.gpt, lang: LANG }); }
  else {
    var pd = posterData(H.rows, k), marks = [];
    H.rows.forEach(function (r) { var p = w.S.mk[r.id]; if (p) marks.push([p[0], p[1], r.no]); });
    var d = new Date(), ymd = d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2);
    f.hostPST({ texts: pd.texts, icons: pd.icons, nd: pd.nd, nm: pd.nm, theme: pd.theme, photo: H.photo || (H.orig && H.orig.photo), pw: H.pw, ph: H.ph, marks: marks, fname: H.fname, gpt: H.gpt, lang: LANG,
      code: '2026-CBNU-포스터-' + (k === 'c49' ? '전기' : '일반') + '-' + ymd,
      src: '사진: 왼쪽 실제 현장사진(' + (H.fname || '업로드') + ') · 오른쪽 ChatGPT 이미지 생성(상황 재현) · 항목 그림: Claude 자동 생성(평면 일러스트) · 통계: CSI 건설사고 사례 재집계, 1단계 분석보고서 · 외국어 병기는 「안전보건용어 400선」 표준 대역어를 우선 적용했고, 400선 외 용어는 연구자가 번역했다. 현장 적용 전 관리감독자가 확인한다.' });
    rowImgs(f, pd, w.S.mk, sig);
  }
  setTimeout(function () { fitFrame('pstBox'); fitMain(); mkPrompt(); }, 350);
}
/* 항목별 4:3 사진: 위험 = 현장사진에서 표시 위치 주변, 지킬 사항 = ChatGPT 실사 이미지의 왼쪽·가운데·오른쪽 (편집 모드에서 눌러 교체) */
function cut43(src, cx, cy, fw, cb) {
  var im = new Image(); im.onload = function () {
    var W0 = im.naturalWidth, H0 = im.naturalHeight, w = Math.min(W0, W0 * fw), h = w * 0.75; if (h > H0) { h = H0; w = h / 0.75; }
    var x = Math.max(0, Math.min(W0 - w, cx * W0 - w / 2)), y = Math.max(0, Math.min(H0 - h, cy * H0 - h / 2));
    var c = document.createElement('canvas'); c.width = 640; c.height = 480; c.getContext('2d').drawImage(im, x, y, w, h, 0, 0, 640, 480);
    try { cb(c.toDataURL('image/jpeg', 0.88)); } catch (e) {} };
  im.src = src;
}
/* 항목 그림 6장: Claude(/api/illust)가 항목 문구를 보고 평면 일러스트(SVG)를 그려 넣는다 (ChatGPT 실사화 안 씀).
   같은 문구는 다시 그리지 않도록 ILL 에 보관. 실패하면 위험 항목은 현장사진의 표시 위치를 잘라 넣고, 지킬 사항은 아이콘을 둔다. */
var ILL = {};
function rowImgs(f, pd, mk, sig) {
  if (!f.hostRowImg) return; var ok = function () { return H.sig.pst === sig; };
  var photo = H.photo || (H.orig && H.orig.photo), T = pd.texts || {}, ko = function (v) { return Array.isArray(v) ? v[0] : (v || ''); };
  var items = [];
  for (var i = 0; i < pd.nd; i++) items.push({ slot: i, ok: false, title: ko(T['d' + i + '_t']), cause: ko(T['d' + i + '_c']) });
  for (var j = 0; j < pd.nm; j++) items.push({ slot: 3 + j, ok: true, title: ko(T['m' + j + '_t']), cause: ko(T['m' + j + '_c']) });
  var crop = function (it) { var id = (pd.ids || [])[it.slot], p = mk && mk[id]; if (it.ok || !photo || !p) return;
    cut43(photo, p[0] / 100, p[1] / 100, 0.36, function (d) { if (ok()) f.hostRowImg(it.slot, d, false); }); };
  var need = [];
  items.forEach(function (it) { var c = ILL[(it.ok ? 'm|' : 'd|') + it.title]; if (c) f.hostRowImg(it.slot, c, it.ok); else need.push(it); });
  if (!need.length) return;
  var w = RAW(), sc = w && w.S && w.S.scene ? ko(w.S.scene) : '';
  fetch('api/illust', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ items: need.map(function (it) { return { title: it.title, cause: it.cause, ok: it.ok }; }), scene: sc, key: APIKEY || undefined }) })
    .then(function (r) { return r.json(); })
    .then(function (j) { need.forEach(function (it, k) { var u = j && j.svgs && j.svgs[k];
      if (u) { ILL[(it.ok ? 'm|' : 'd|') + it.title] = u; if (ok()) f.hostRowImg(it.slot, u, it.ok); } else if (ok()) crop(it); }); })
    .catch(function () { need.forEach(function (it) { if (ok()) crop(it); }); });
}

/* ‘🎨 위험·반드시 그림 Claude 자동 생성’ — 지금 포스터의 위험 3건·반드시 지킬 사항 3건 문구로 항목 그림을 새로 그린다(표본 포함) */
var RSVGBUSY = false;
function rowSvgAuto() {
  var f = W('pstBox'); if (!f || !f.hostGet || !f.hostRowImg) { $('#gmsg').textContent = '먼저 현장사진을 올리거나 표본을 고르세요.'; return; }
  if (RSVGBUSY) return; var g = f.hostGet(), rows = f.document.querySelectorAll('.rules .ricon'), items = [];
  for (var i = 0; i < rows.length && i < 6; i++) { var row = rows[i].closest('.row'); if (row && row.style.display === 'none') continue;
    var ok = i >= 3, kk = ok ? 'm' + (i - 3) : 'd' + i; if (!g[kk + '_t']) continue; items.push({ slot: i, ok: ok, title: g[kk + '_t'], cause: g[kk + '_c'] || '' }); }
  if (!items.length) { $('#gmsg').textContent = '그릴 항목이 없습니다.'; return; }
  var btn = $('#rSvg'), t0 = Date.now(), sig = H.sig.pst; RSVGBUSY = true; btn.disabled = true;
  var tick = setInterval(function () { $('#gmsg').textContent = '🎨 Claude가 항목 그림 ' + items.length + '장을 그리는 중… ' + Math.round((Date.now() - t0) / 1000) + '초'; }, 1000);
  var end = function (msg) { clearInterval(tick); RSVGBUSY = false; btn.disabled = false; $('#gmsg').textContent = msg; };
  var w = RAW(), sc = w && w.S && w.S.scene ? (Array.isArray(w.S.scene) ? w.S.scene[0] : w.S.scene) : '';
  fetch('api/illust', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ items: items.map(function (it) { return { title: it.title, cause: it.cause, ok: it.ok }; }), scene: sc, key: APIKEY || undefined }) })
    .then(function (r) { return r.json(); }).then(function (j) {
      if (!j || !j.svgs) return end(j && j.reason === 'no_key' ? '서버와 브라우저에 Claude 키가 없습니다. 왼쪽 입력칸 ⑧에 키를 저장하세요.' : 'Claude 그림을 받지 못했습니다. 다시 눌러 주세요.');
      var n = 0, fail = [];
      items.forEach(function (it, k) { var u = j.svgs[k]; if (u && H.sig.pst === sig) { ILL[(it.ok ? 'm|' : 'd|') + it.title] = u; f.hostRowImg(it.slot, u, it.ok); n++; } else if (!u) fail.push((it.ok ? '반드시' : '위험') + ((it.slot % 3) + 1)); });
      end(fail.length ? 'Claude 그림 ' + n + '장 완료, 일부 실패(' + fail.join(', ') + ') — 다시 누르세요.' : '✓ Claude가 항목 그림 ' + n + '장을 새로 그려 넣었습니다 (' + Math.round((Date.now() - t0) / 1000) + '초). 편집 모드에서 그림을 눌러 바꿀 수도 있습니다.');
    }).catch(function () { end('서버에 연결하지 못했습니다.'); });
}

/* ---------- ChatGPT 추가작업 ---------- */
function mkPrompt() {
  var f = W('pstBox'); if (!f || !f.hostGet) return; var g = f.hostGet(), w = RAW(); if (!w) return;
  var enOf = function (k) { var s = f.STR && f.STR[k]; return (s && s.en) || g[k] || ''; };
  var items = H.rows.filter(function (r) { return KBI[r.id]; }).sort(function (a, b) { return b.v - a.v; }).slice(0, 4).map(function (r) { return KBI[r.id].tag[1]; });
  var p;
  if ($('#gmode').value === 'card') {
    p = 'Create ONE photorealistic image, landscape 3:2, that looks like a real documentary photo taken at a Korean construction site, for a realistic safety poster.\n'
      + 'It is the GOOD-PRACTICE photo of a multilingual safety poster.\n'
      + 'Scene: ' + enOf('good_t') + ' — ' + enOf('good_c') + '\n'
      + 'Setting: similar to the attached site photo, but every hazard below is CONTROLLED and the work is done safely:\n- ' + items.join('\n- ') + '\n'
      + 'CAMERA: WIDE-ANGLE establishing shot (about 24 mm), camera set back 15-20 m and slightly elevated. The workers and the task occupy only about the central third of the frame; '
      + 'the rest shows a WIDE, deep background of the surrounding construction site — excavation and earthworks, rebar and formwork, temporary fences with safety signage panels (no readable text), '
      + 'scaffolding, tower crane or excavator, stacked materials, site roads, distant buildings and sky — so the whole working environment is clearly visible. Do NOT crop tightly on people or hands.\n'
      + 'Workers wear white hard hats with chin straps fastened, hi-vis vests and the right PPE for the task. Faces must not be identifiable (side or back view).\n'
      + 'Natural daylight, sharp focus throughout (deep depth of field), true colors, print quality. No readable text, no letters, no logos, no watermark, no blood.';
  } else {
    p = 'Create a realistic, print-quality Korean construction SAFETY POSTER image, portrait A3 ratio (1:1.414). Real photographs, clean layout, bold Korean typography. Render ALL Korean text exactly as written. Do NOT draw any logo; leave an EMPTY navy square at top-right for a university logo.\n'
      + '1) Navy header: yellow warning triangle + "안전제일", slogan "' + (g.c_slogan || '') + '".\n'
      + '2) Headline: "' + (g.t1 || '') + '" (black) + "' + (g.t2 || '') + '" (green).\n3) Subtitle: "' + (g.sub || '') + '".\n'
      + '4) Two photo cards: LEFT red "' + (g.bad_t || '') + '" (use the attached site photo); RIGHT green "' + (g.good_t || '') + '".\n'
      + '5) Red panel "이렇게 하면 위험합니다!": "' + [g.d0_t, g.d1_t, g.d2_t].filter(Boolean).join('", "') + '". Green panel "반드시 지켜야 합니다!": "' + [g.m0_t, g.m1_t, g.m2_t].filter(Boolean).join('", "') + '".\n'
      + '6) Yellow banner: "' + (g.banner || '') + '".\n7) Navy footer: emergency contact box and "119".';
  }
  $('#gprompt').value = p;
}
function gptGo() { var t = $('#gprompt'); if (!t.value) mkPrompt(); var v = t.value;
  var done = function () { $('#gmsg').textContent = '✓ 프롬프트를 복사했습니다. 새 창의 ChatGPT 입력창에 붙여 넣고(Ctrl+V) 현장사진도 함께 올리세요.'; };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(v).then(done, function () { t.select(); document.execCommand('copy'); done(); }); else { t.select(); document.execCommand('copy'); done(); }
  window.open('https://chatgpt.com/', '_blank', 'noopener'); }
function onGpt(inp) { var f = inp.files[0]; if (!f) return; var r = new FileReader();
  r.onload = function () { if ($('#gmode').value === 'card') { H.gpt = r.result; H.sig.pst = ''; syncPoster(); $('#gmsg').textContent = '✓ 포스터 오른쪽 카드에 ChatGPT 이미지를 넣었습니다.'; }
    else { var gf = $('#gptFull'); gf.style.display = 'block'; gf.querySelector('img').src = r.result; gf.querySelector('b').textContent = 'ChatGPT 실사판 포스터 (사용자 업로드)'; } };
  r.readAsDataURL(f); inp.value = ''; }

/* ---------- 실사 포스터 자동 생성 (서버 /api/poster → OpenAI 이미지 API) ---------- */
var OKEY = '', SERVEROKEY = null;
function renderOKey() { var t, c;
  if (OKEY) { t = '이 브라우저에 저장된 키 사용 중 (…' + OKEY.slice(-4) + ')'; c = 'keystat on'; }
  else if (SERVEROKEY) { t = '입력한 키 없음 — 서버 키로 실사 포스터 생성'; c = 'keystat on'; }
  else if (SERVEROKEY === false) { t = '서버에도 키가 없습니다 — 수동(복사 + ChatGPT 열기)으로 만들 수 있습니다'; c = 'keystat warn'; }
  else { t = '키 상태 확인 중…'; c = 'keystat'; }
  [$('#oKeyStat'), $('#oKeyStat2')].forEach(function (e) { if (e) { e.textContent = (e.id === 'oKeyStat2' ? '왼쪽 ⑨ — ' : '') + t; e.className = c; } }); }
function oprobe() { fetch('api/poster').then(function (r) { return r.json(); }).then(function (j) { SERVEROKEY = !!(j && j.hasKey); renderOKey(); }).catch(function () { SERVEROKEY = false; renderOKey(); }); }
function okeySave() { var v = ($('#oKey').value || '').trim(); if (!v) return; if (!/^sk-[\w-]{20,}$/.test(v)) { var e = $('#oKeyStat'); e.textContent = 'sk- 로 시작하는 OpenAI API 키를 넣으세요'; e.className = 'keystat warn'; return; }
  OKEY = v; try { localStorage.setItem('cbnu_okey', v); } catch (e) {} $('#oKey').value = ''; renderOKey(); }
function okeyClear() { OKEY = ''; try { localStorage.removeItem('cbnu_okey'); } catch (e) {} renderOKey(); }
function shrink(src, max, cb) { var im = new Image(); im.onload = function () { var k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
    var c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); cb(c.toDataURL('image/jpeg', 0.85)); }; im.onerror = function () { cb(null); }; im.src = src; }
function withLogo(src, cb) { var im = new Image(), lg = new Image(), n = 0;
  var go = function () { if (++n < 2) return; var c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; var x = c.getContext('2d'); x.drawImage(im, 0, 0);
    if (lg.naturalWidth) { var s = Math.round(c.width * 0.13), m = Math.round(c.width * 0.025); x.fillStyle = '#fff'; x.fillRect(c.width - s - m - 6, m - 6, s + 12, s + 12); x.drawImage(lg, c.width - s - m, m, s, s * lg.naturalHeight / lg.naturalWidth); }
    cb(c.toDataURL('image/jpeg', 0.92)); };
  im.onload = go; lg.onload = go; lg.onerror = go; im.src = src; lg.src = 'assets/cbnu.png'; }
function gptAuto() {
  var photo = H.photo || (H.orig && H.orig.photo); if (!photo) { $('#gmsg').textContent = '먼저 현장사진을 올리거나 표본을 고르세요.'; return; }
  mkPrompt(); var mode = $('#gmode').value, btn = $('#gAuto'), t0 = Date.now();
  btn.disabled = true; $('#gmsg').textContent = '⏳ Claude가 만든 프롬프트로 오른쪽 이미지를 실사화하는 중입니다 (30~90초)…';
  var tick = setInterval(function () { $('#gmsg').textContent = '⏳ 실사 이미지 생성 중… ' + Math.round((Date.now() - t0) / 1000) + '초'; }, 1000);
  var end = function (msg) { clearInterval(tick); btn.disabled = false; $('#gmsg').textContent = msg; };
  shrink(photo, 1024, function (small) {
    if (!small) return end('현장사진을 읽지 못했습니다.');
    fetch('api/poster', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: $('#gprompt').value, photo: small, mode: mode, key: OKEY || undefined }) })
      .then(function (r) { return r.json(); }).then(function (j) {
        if (!j || !j.ok) { var e = j && j.error; return end(e === 'no_key' ? '서버와 브라우저에 OpenAI 키가 없습니다. 왼쪽 입력칸 ⑨에 키를 저장하거나 Vercel 환경변수 OPENAI_API_KEY를 설정하세요. (수동: ‘복사 + ChatGPT 열기’)' : e === 'bad_key' ? 'OpenAI 키가 거부되었습니다.' : '생성 실패: ' + (e || '알 수 없음') + (j && j.detail ? ' — ' + j.detail : '')); }
        if (mode === 'card') { H.gpt = j.image; H.sig.pst = ''; syncPoster(); end('✓ 실사 카드 사진을 포스터 오른쪽에 넣었습니다 (' + Math.round((Date.now() - t0) / 1000) + '초, ' + j.model + ').'); }
        else withLogo(j.image, function (img) { var gf = $('#gptFull'); gf.style.display = 'block'; gf.querySelector('img').src = img;
          gf.querySelector('b').textContent = '실사판 포스터 — 자동 생성 (' + j.model + ', 오른쪽 위 충북대학교 심볼 합성)'; end('✓ 실사판 포스터를 아래에 표시했습니다. 이미지를 길게 눌러 저장할 수 있습니다.'); });
      }).catch(function () { end('서버에 연결하지 못했습니다.'); });
  });
}

/* ---------- 편집·인쇄·저장 ---------- */
function edAll() { EDIT = !EDIT; var w = RAW(); if (w && !!w.ed !== EDIT) w.tgl();
  ['c49Box', 'genBox', 'pstBox'].forEach(function (id) { var x = W(id); try { if (x && x.hostEdit) x.hostEdit(EDIT); } catch (e) {} });
  var b = $('#eb'); b.classList.toggle('act', EDIT); b.textContent = EDIT ? '✓ 편집 중' : '✏️ 편집 모드'; }
function frameOf(k) { return k === 'ra' ? 'raBox' : (k === 'pst' ? 'pstBox' : ptwKind() + 'Box'); }
function printDoc(k) { $$('.ddm').forEach(function (m) { m.classList.remove('open'); }); var x = W(frameOf(k)); try { x.focus(); x.print(); } catch (e) {} }
/* ---------- 위험성평가표 → Excel(.xlsx) ----------
   화면의 위험성평가표(위험분석·평가표 문서 안 table.ra)를 읽어 한 시트로 만든다 — 문서에서 고친 값(편집 모드, 빈도·강도 선택)이 그대로 들어간다.
   인쇄 설정: A4 가로, 여백 위 2.0cm · 왼쪽 1.5cm · 오른쪽 1.0cm · 아래 1.0cm, 폭 1쪽에 맞춤, 머리글 두 줄 반복, 아래 가운데 쪽 번호.
   ExcelJS(약 0.9MB)는 처음 쓸 때만 내려받는다. */
var XLSX_P = null;
function loadExcelJS() {
  if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
  if (!XLSX_P) XLSX_P = new Promise(function (ok, no) {
    var s = document.createElement('script'); s.src = 'assets/vendor/exceljs.min.js';
    s.onload = function () { window.ExcelJS ? ok(window.ExcelJS) : (XLSX_P = null, no(new Error('exceljs'))); };
    s.onerror = function () { XLSX_P = null; no(new Error('load')); };
    document.head.appendChild(s);
  });
  return XLSX_P;
}
function xcell(td) { // 칸 안의 한국어와 병기 번역을 줄바꿈으로 이어 붙인다
  if (!td) return ''; var out = [];
  Array.prototype.forEach.call(td.querySelectorAll('.ed'), function (ed) {
    var ko = (ed.textContent || '').trim(); if (ko) out.push(ko);
    var n = ed.nextElementSibling, tr = n ? (n.textContent || '').trim() : ''; if (tr) out.push(tr);
  });
  return out.length ? out.join('\n') : (td.textContent || '').trim();
}
function xlen(str) { var n = 0; for (var i = 0; i < str.length; i++) n += str.charCodeAt(i) > 255 ? 2 : 1; return n; }
function xlines(text, widthChars) { // 글꼴 9~10pt 기준: 열 너비(글자 수) 1칸에 한글 0.6자 안팎이 들어간다고 보고 줄 수를 넉넉히 센다
  var cap = Math.max(4, widthChars * 1.15), n = 0; String(text).split('\n').forEach(function (ln) { n += Math.max(1, Math.ceil(xlen(ln) / cap)); }); return n;
}
function saveXlsx() {
  var w = RAW(), doc = w && w.document, trs = doc ? Array.prototype.slice.call(doc.querySelectorAll('table.ra tbody tr[data-id]')) : [];
  if (!trs.length) { nstat('먼저 사진을 올리고 문서를 생성하세요 (위험성평가표에 항목이 없습니다).', 'warn'); return; }
  nstat('Excel 파일 만드는 중…');
  var meta = doc.querySelector('table.meta'), mv = meta ? Array.prototype.map.call(meta.querySelectorAll('td'), xcell) : [];
  loadExcelJS().then(function (ExcelJS) {
    var cm = function (x) { return x / 2.54; };
    var wb = new ExcelJS.Workbook(); wb.creator = 'e-safety'; wb.created = new Date();
    var ws = wb.addWorksheet('위험성평가표');
    var W = [5, 15, 11, 19, 36, 22, 26, 7, 7, 11, 40, 11, 11, 10]; // 열 너비(글자 수)
    W.forEach(function (x, i) { ws.getColumn(i + 1).width = x; });
    var thin = { style: 'thin', color: { argb: 'FF8C98A8' } }, bd = { top: thin, left: thin, bottom: thin, right: thin };
    var FONT = '맑은 고딕';
    // 제목
    ws.mergeCells('A1:N1'); var t = ws.getCell('A1'); t.value = '현장사진 위험성평가표'; t.font = { name: FONT, size: 18, bold: true, color: { argb: 'FF002A5C' } }; t.alignment = { horizontal: 'center', vertical: 'middle' }; ws.getRow(1).height = 32;
    // 현장 정보 (현장명·평가일 / 사진·공종 / 평가팀·보정 / 평가 근거)
    var M = [['현장명', mv[0] || '', '평가일', mv[1] || ''], ['판독 사진', mv[2] || '', '공종·작업', mv[3] || ''], ['평가팀', mv[4] || '', '가능성 보정', mv[5] || ''], ['평가 근거', mv[6] || '', null, null]];
    M.forEach(function (r, i) {
      var n = 2 + i, sw = function (a, b) { var t = 0; for (var q = a; q <= b; q++) t += W[q]; return t; };
      ws.getRow(n).height = Math.min(120, Math.max(20, 13 * Math.max(xlines(r[1], r[2] == null ? sw(2, 13) : sw(2, 6)), r[2] == null ? 1 : xlines(r[3], sw(10, 13))) + 6));
      ws.mergeCells('A' + n + ':B' + n); ws.getCell('A' + n).value = r[0];
      if (r[2] == null) { ws.mergeCells('C' + n + ':N' + n); ws.getCell('C' + n).value = r[1]; }
      else { ws.mergeCells('C' + n + ':G' + n); ws.getCell('C' + n).value = r[1]; ws.mergeCells('H' + n + ':J' + n); ws.getCell('H' + n).value = r[2]; ws.mergeCells('K' + n + ':N' + n); ws.getCell('K' + n).value = r[3]; }
      ['A', 'C', 'H', 'K'].forEach(function (c) { var cell = ws.getCell(c + n); if (cell.value == null || (c === 'H' && r[2] == null) || (c === 'K' && r[2] == null)) return;
        var lab = c === 'A' || c === 'H'; cell.font = { name: FONT, size: 10, bold: lab }; cell.alignment = { vertical: 'middle', horizontal: lab ? 'center' : 'left', wrapText: true };
        if (lab) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF3FA' } }; });
      for (var c = 1; c <= 14; c++) ws.getCell(n, c).border = bd;
    });
    ws.getRow(6).height = 8;
    // 머리글 (2단)
    var HD = [[7, 'A', 'A', '순번'], [7, 'B', 'B', '작업내용'], [7, 'C', 'E', '유해·위험요인 파악'], [7, 'F', 'F', '관련근거(법적기준)'], [7, 'G', 'G', '현재상태'], [7, 'H', 'J', '현재 위험성'], [7, 'K', 'K', '위험성 감소대책'], [7, 'L', 'L', '개선일'], [7, 'M', 'M', '완료일'], [7, 'N', 'N', '담당자']];
    HD.forEach(function (h) { if (h[1] !== h[2]) ws.mergeCells(h[1] + '7:' + h[2] + '7'); else ws.mergeCells(h[1] + '7:' + h[1] + '8'); ws.getCell(h[1] + '7').value = h[3]; });
    [['C', '분류'], ['D', '원인/유해요인'], ['E', '위험요인 상세'], ['H', '빈도'], ['I', '강도'], ['J', '위험']].forEach(function (h) { ws.getCell(h[0] + '8').value = h[1]; });
    for (var r = 7; r <= 8; r++) { ws.getRow(r).height = 22; for (var c = 1; c <= 14; c++) { var hc = ws.getCell(r, c); hc.font = { name: FONT, size: 10, bold: true, color: { argb: 'FFFFFFFF' } }; hc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002A5C' } }; hc.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; hc.border = bd; } }
    // 항목
    var RK = function (v) { return v >= 9 ? 'FFB03A2E' : (v >= 6 ? 'FFE67E22' : (v >= 3 ? 'FFE1A100' : 'FF2E8B57')); };
    trs.forEach(function (tr, i) {
      var td = tr.children, v = +(td[9] && td[9].getAttribute('data-r')) || 0, lv = td[9] && td[9].querySelector('.rl') ? td[9].querySelector('.rl').textContent.trim() : '';
      var sv = function (c) { var s = c && c.querySelector('select'); return s && s.selectedOptions && s.selectedOptions[0] ? s.selectedOptions[0].textContent.trim() : (c ? c.textContent.trim() : ''); };
      var cb = td[7] && td[7].querySelector('.cb') ? ' ' + td[7].querySelector('.cb').textContent.trim() : '';
      var vals = [+(td[0].textContent.trim()) || i + 1, xcell(td[1]), xcell(td[2]), xcell(td[3]), xcell(td[4]), xcell(td[5]), xcell(td[6]), sv(td[7]) + cb, sv(td[8]), v, xcell(td[10]), xcell(td[11]), (td[12] ? td[12].textContent.trim() : ''), xcell(td[13])];
      var row = ws.addRow(vals), lines = 1;
      vals.forEach(function (x, c) { var cell = row.getCell(c + 1); cell.border = bd; cell.font = { name: FONT, size: 9 }; cell.alignment = { vertical: 'top', horizontal: (c === 0 || c >= 7 && c <= 9 || c >= 11) ? 'center' : 'left', wrapText: true };
        lines = Math.max(lines, xlines(x, W[c])); });
      var rk = row.getCell(10); rk.numFmt = '0" (' + lv + ')"'; rk.font = { name: FONT, size: 10, bold: true, color: { argb: 'FFFFFFFF' } }; rk.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RK(v) } }; rk.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      row.height = Math.min(409, Math.max(26, lines * 13 + 8));
    });
    // 인쇄 설정: A4 가로, 여백(위 2.0 · 왼쪽 1.5 · 오른쪽 1.0 · 아래 1.0 cm)
    ws.pageSetup = { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true, printTitlesRow: '7:8',
      margins: { top: cm(2.0), left: cm(1.5), right: cm(1.0), bottom: cm(1.0), header: 0.2, footer: 0.2 } };
    ws.headerFooter = { oddFooter: '&C&9&P / &N' };
    return wb.xlsx.writeBuffer().then(function (buf) {
      var site = (mv[0] || '').split('\n')[0].replace(/[\\/:*?"<>|\s]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30), d = new Date(), p2 = function (x) { return (x < 10 ? '0' : '') + x; };
      var name = '위험성평가표' + (site ? '_' + site : '') + '_' + d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()) + '.xlsx';
      var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })); a.download = name;
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 800);
      nstat('✓ Excel 저장: ' + name + ' (A4 가로 · ' + trs.length + '개 항목)', 'on');
    });
  }).catch(function (e) { nstat('✗ Excel을 만들지 못했습니다' + (e && e.message === 'load' ? ' (파일 로드 실패)' : '') + '.', 'warn'); });
}
function saveDoc(k) { $$('.ddm').forEach(function (m) { m.classList.remove('open'); }); if (k === 'xlsx') { saveXlsx(); return; } var x = W(frameOf(k)); try { if (k === 'ra') x.saveHtml(); else x.hostSave(); } catch (e) {} }

/* ---------- 400선 ---------- */
function renderGloss() { var b = $('#glossBody'); if (!b) return; var q = ($('#gq').value || '').trim(); var cols = ['zh', 'vi', 'uz'].indexOf(LANG) >= 0 ? [LANG] : ['zh', 'vi', 'uz'];
  var ix = { zh: 1, vi: 2, uz: 3 }, rows = GLOSS.filter(function (g) { return !q || g.join(' ').toLowerCase().indexOf(q.toLowerCase()) >= 0; }).slice(0, 400);
  b.innerHTML = '<table>' + rows.map(function (g) { return '<tr><td>' + esc(g[0]) + '</td>' + cols.map(function (c) { return '<td>' + esc(g[ix[c]]) + '</td>'; }).join('') + '</tr>'; }).join('') + '</table>' + (rows.length ? '' : '<div class="hint">찾는 용어가 없습니다.</div>'); }

/* ---------- 위험 분석 자료 발송 (상단 바: 메일 발송 · 문자 발송) ---------- */
/* 버튼을 누르면 받는 이메일 주소·휴대폰 번호를 입력하는 창이 뜬다(마지막 입력은 이 브라우저에 기억).
   제목(메일·문자 공통): ‘[경고] 현장사진 위험성 분석(위험 N건 · 9이상 M건)’ — 9이상 = 위험성(빈도×강도)이 9 이상인 건수. 메일에는 현장사진 위험 분석 sheet(위험분석·위험성평가표 HTML)를 첨부한다.
   실제 제목은 서버가 같은 규칙으로 만든다. 발송 토큰이 맞아야 보낼 수 있다(/api/notify). */
var NTOKEN = '', NBUSY = false, NTIMER = 0;
function ntitle(c) { return '[경고] 현장사진 위험성 분석(위험 ' + c.total + '건 · 9이상 ' + c.nine + '건)'; }
function nstat(t, c) {
  var e = $('#ntoast'); if (!e) return; e.textContent = t; e.className = 'on ' + (c === 'on' ? 'ok' : (c || '')); clearTimeout(NTIMER);
  NTIMER = setTimeout(function () { e.className = ''; }, c === 'warn' ? 9000 : 6000);
  var st = $('#nStat'); if (st) { st.textContent = t; st.className = 'keystat ' + (c || ''); }
}
function sheetCounts() {
  var w = RAW(); var v = w ? Array.prototype.slice.call(w.document.querySelectorAll('table.ra tbody tr[data-id] td.rk')).map(function (td) { return +td.getAttribute('data-r') || 0; }).filter(Boolean) : [];
  return { max: Math.max.apply(null, v.concat(0)), ge3: v.filter(function (x) { return x >= 3; }).length, total: v.length, nine: v.filter(function (x) { return x >= 9; }).length, high: v.filter(function (x) { return x >= 6; }).length, mid: v.filter(function (x) { return x >= 3 && x < 6; }).length, low: v.filter(function (x) { return x < 3; }).length };
}
function ntokSave() { var v = ($('#nTok').value || '').trim(); if (!v) return; NTOKEN = v; try { localStorage.setItem('cbnu_ntok', v); } catch (e) {} $('#nTok').value = ''; nstat('✓ 발송 토큰을 이 브라우저에만 저장했습니다.', 'on'); }
function ntokClear() { NTOKEN = ''; try { localStorage.removeItem('cbnu_ntok'); } catch (e) {} nstat('발송 토큰을 지웠습니다.'); }
/* ---------- Claude 아티팩트 버전: Gmail 커넥터로 메일 발송 ----------
   claude.ai 아티팩트로 열렸을 때만(window.claude.use('mcp')가 열릴 때) 켜진다. 서버(/api/notify)·발송 토큰 없이
   로그인한 본인의 Gmail 커넥터로 직접 보낸다. 문자·AI 사진 판독·저장·인쇄·카메라는 아티팩트에서 쓸 수 없어 숨긴다. */
var SITE_URL = 'https://e-safety.vercel.app/';
var CMCP = null;
var IN_ART = !!(window.claude && typeof window.claude.use === 'function'); // 아티팩트 뷰어 안이면 스크립트보다 먼저 window.claude 가 있다
var CONN = IN_ART ? 0 : -1;                                                    // 0 연결 중 · 1 Gmail 커넥터 사용 가능 · -1 아티팩트 아님/사용 불가
var ARTIFACT_URL = 'https://claude.ai/artifact/44cnudKouvMjRAiy7tmTim';
/* 클릭하는 순간에도 Gmail 커넥터를 찾는다 — 뷰어가 window.claude 를 스크립트보다 늦게 붙이거나 연결이 늦어도 메일이 나가게 한다 */
function connEnsure() {
  if (CMCP) return Promise.resolve(true);
  if (!(window.claude && typeof window.claude.use === 'function')) return Promise.resolve(false);
  IN_ART = true; CONN = 0; document.body.classList.add('art');
  return window.claude.use('mcp').then(function (m) {
    if (!m) { CONN = -1; document.body.classList.remove('art'); return false; }
    CMCP = m; CONN = 1; return true;
  }, function () { CONN = -1; return false; });
}
function connInit() {
  if (!IN_ART) return;
  document.body.classList.add('art'); // 커넥터 연결을 기다리지 않고 아티팩트에서 쓸 수 없는 칸(토큰·문자 키)을 처음부터 숨긴다
  window.claude.use('mcp').then(function (m) {
    var cf = $('#nCfg');
    if (!m) { CONN = -1; document.body.classList.remove('art'); if (cf) cf.textContent = 'Gmail 커넥터를 쓸 수 없습니다. claude.ai에 로그인한 본인 계정에서 이 아티팩트를 여세요.'; return; }
    CMCP = m; CONN = 1;
    if (cf) cf.textContent = 'Claude 아티팩트 버전 — 내 Gmail 커넥터로 직접 발송합니다 (키·토큰 입력 불필요). 문자 발송은 Vercel 사이트(e-safety.vercel.app)에서만 됩니다.';
  }).catch(function () { CONN = -1; });
}
function b64OfBuf(buf) { var u = new Uint8Array(buf), s = ''; for (var i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }
function mailHtmlC(title, site, c, note, hasPdf) {
  var meta = [['현장명', site.name], ['공종·작업', site.proc], ['평가일', site.date], ['관리감독자', site.by]].filter(function (x) { return x[1]; })
    .map(function (x) { return '<b>' + x[0] + '</b> ' + esc(x[1]); }).join(' &nbsp;·&nbsp; ');
  return '<div style="font-family:\'Malgun Gothic\',Apple SD Gothic Neo,sans-serif;font-size:14px;color:#1c1c1c;max-width:640px">'
    + '<p style="margin:0 0 12px"><a href="' + SITE_URL + '">' + SITE_URL + '</a></p>'
    + '<div style="background:#B03A2E;color:#fff;padding:12px 14px;border-radius:6px;font-size:17px;font-weight:800">' + esc(title) + '</div>'
    + (note ? '<p style="margin:8px 0;padding:8px 10px;background:#FBEDEB;border-left:4px solid #B03A2E;color:#7a2018">' + esc(note) + '</p>' : '')
    + '<p style="margin:12px 0 4px">위험 <b>' + c.total + '건</b> · <span style="color:#B03A2E"><b>9이상 ' + c.nine + '건</b></span> <span style="color:#778;font-size:12px">(위험성 = 빈도 × 강도, 최대 9)</span></p>'
    + (meta ? '<p style="margin:4px 0 10px;color:#334">' + meta + '</p>' : '')
    + '<p>첨부한 ' + (hasPdf ? '<b>분석 결과 PDF</b>(A4 가로)와 ' : '') + '<b>현장사진 위험 분석 sheet</b>(HTML 파일)에서 위험 분석과 위험성평가표를 확인하세요.</p>'
    + '<p style="color:#778;font-size:12px">자동 생성 결과는 초안입니다. AI는 최초 검토, 최종 판단은 관리감독자가 진행합니다.</p></div>';
}
/* 커넥터 입력 한도는 1MiB. 큰 첨부는 파일 인자($file, 호출당 1개)로 보낸다 → PDF 를 $file 로, 분석 sheet(HTML)는 gzip 으로 줄여 함께 붙인다(너무 크면 PDF 만).
   파일 인자를 쓸 수 없으면 PDF·gzip HTML 을 한도 안에서 인라인으로 붙인다. */
function connSend(list, title, cnt, site, sheet, pdf, note) {
  var HN = 'site-photo-risk-analysis-sheet.html', PN = 'site-photo-risk-analysis.pdf';
  var call = function (atts) { // 본문의 첨부 안내는 실제로 붙은 것에 맞춘다 → 결과는 PDF 가 붙었는지(true/false)
    var hp = atts.some(function (a) { return a.mimeType === 'application/pdf'; });
    return CMCP.callTool('Gmail', 'send_message', { to: list, subject: title, attachments: atts, htmlBody: mailHtmlC(title, site, cnt, note, hp),
      body: SITE_URL + '\n\n' + title + (note ? '\n' + note : '') + '\n\n첨부한 ' + (hp ? '분석 결과 PDF와 ' : '') + '현장사진 위험 분석 sheet(HTML 파일)를 확인하세요.' }).then(function () { return hp; });
  };
  var gz = function () {
    if (typeof CompressionStream !== 'function') return Promise.resolve(null);
    return new Response(new Blob([sheet]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer().then(function (buf) { return b64OfBuf(buf); }, function () { return null; });
  };
  var gzAtt = function (b64) { return { content: b64, filename: HN + '.gz', mimeType: 'application/gzip' }; };
  var inline = function () { // 인라인(1MiB 한도)으로 붙일 수 있는 만큼
    return gz().then(function (b64) {
      var atts = [], used = 0;
      if (pdf && pdf.b64.length <= 600000) { atts.push({ content: pdf.b64, filename: PN, mimeType: 'application/pdf' }); used += pdf.b64.length; }
      if (b64 && used + b64.length <= 850000) atts.push(gzAtt(b64));
      return atts.length ? call(atts) : Promise.reject({ code: 'too_large' });
    });
  };
  var viaFile = function (blob, name, type, rest) { return call([{ content: { $file: { data: blob, name: name, type: type } }, filename: name, mimeType: type }].concat(rest)); };
  return CMCP.listTools().then(function (r) { return !!(r && r.fileArgs); }, function () { return false; }).then(function (fa) {
    if (!fa) return inline();
    var go = pdf ? gz().then(function (b64) { return viaFile(pdf.blob, PN, 'application/pdf', b64 && b64.length <= 700000 ? [gzAtt(b64)] : []); })
      : viaFile(new Blob([sheet], { type: 'text/html' }), HN, 'text/html', []);
    return go.catch(function (e) { return (e && (e.code === 'bad_request' || e.code === 'capability_disabled' || e.code === 'tool_error')) ? inline() : Promise.reject(e); });
  });
}
function connWhy(e) {
  var c = e && e.code, m = {
    needs_reauth: 'Gmail 연결이 만료되었습니다. claude.ai 설정 → 커넥터에서 Gmail을 다시 연결하세요.',
    server_not_connected: 'Gmail 커넥터가 없습니다. claude.ai 설정 → 커넥터에서 Gmail을 추가하세요.',
    selection_required: 'Gmail 커넥터가 둘 이상입니다. 사용할 계정을 선택하세요.',
    not_in_manifest: '이 페이지의 Gmail 사용이 허용되지 않았습니다. 페이지의 권한 메뉴에서 허용하세요.',
    consent_required: '이 페이지의 Gmail 사용이 허용되지 않았습니다. 다시 눌러 허용하세요.',
    approval_required: 'Gmail 발송 승인이 필요합니다. 다시 눌러 허용하세요.',
    blocked_by_policy: '조직 정책이 Gmail 발송을 막고 있습니다.',
    too_large: '분석 sheet가 너무 커서 첨부하지 못했습니다 (사진을 줄여 다시 올려 주세요).',
    cancelled: '발송이 취소되었습니다.',
    server_unavailable: 'Gmail 서버 응답이 없습니다. 보낸편지함을 확인한 뒤 필요하면 다시 누르세요.',
    upstream_error: 'Gmail 서버 응답이 없습니다. 보낸편지함을 확인한 뒤 필요하면 다시 누르세요.',
    tool_error: 'Gmail이 발송을 거부했습니다' + (e && e.message ? ': ' + String(e.message).slice(0, 120) : '.')
  };
  return m[c] || ('Gmail 발송 실패' + (c ? ' (' + c + ')' : ''));
}
var MAIL_SRV = false; // 이 사이트의 서버가 메일(토큰+메일 설정)을 보낼 수 있는지
function mailLink() { return '<a href="' + ARTIFACT_URL + '" target="_blank" rel="noopener">Claude 아티팩트 버전(Gmail 커넥터)</a>'; }
function notifyProbe() {
  if (IN_ART) return; // 아티팩트에는 서버 함수가 없다
  fetch('/api/notify').then(function (r) { return r.json(); }).then(function (j) {
    MAIL_SRV = !!(j && j.token && j.email);
    var box = $('#mailTok'); if (box) box.classList.toggle('on', MAIL_SRV); // 메일 서버 설정이 있을 때만 발송 토큰 칸을 보여 준다
    var el = $('#nCfg'); if (!el) return;
    el.innerHTML = MAIL_SRV ? '서버 설정 — 메일 ✓ · 문자는 위 Solapi 키로 발송됩니다.'
      : '';
  }).catch(function () { var el = $('#nCfg'); if (el) el.textContent = '이 주소에서는 서버 함수를 쓸 수 없습니다 (Vercel 배포에서만 동작).'; });
}
var NCH = '', N_MAX = 10;
/* 문자: 사용자가 입력한 Solapi 키는 이 브라우저에만 저장(발송 성공 시)하고, 발송 요청에만 실어 서버로 보낸다. 서버는 저장하지 않는다 */
var SOL = { key: '', secret: '', from: '' };
function solLoad() { try { SOL = { key: localStorage.getItem('cbnu_sol_key') || '', secret: localStorage.getItem('cbnu_sol_secret') || '', from: localStorage.getItem('cbnu_sol_from') || '' }; } catch (e) {} }
function solSave() { try { localStorage.setItem('cbnu_sol_key', SOL.key); localStorage.setItem('cbnu_sol_secret', SOL.secret); localStorage.setItem('cbnu_sol_from', SOL.from); } catch (e) {} }
function solValid() { return !!(SOL.key && SOL.secret && SOL.from); }
function solRender() {
  solLoad();
  var k = $('#solKey'); if (!k) return;
  k.value = SOL.key; $('#solFrom').value = SOL.from; $('#solSecret').value = '';
  $('#solSecret').placeholder = SOL.secret ? '저장됨 (…' + SOL.secret.slice(-4) + ') — 바꿀 때만 입력' : 'API Secret';
  var st = $('#solStat'); st.className = 'keystat ' + (solValid() ? 'on' : '');
  st.textContent = solValid() ? '✓ 저장됨 — 문자 발송 준비 완료 (발신번호 ' + nFmt(SOL.from, false) + ')' : '키·시크릿·발신번호를 저장하면 문자를 보낼 수 있습니다.';
}
function solSaveBtn() {
  var st = $('#solStat'), k = ($('#solKey').value || '').trim(), sc = ($('#solSecret').value || '').trim() || SOL.secret, fr = ($('#solFrom').value || '').replace(/[\s-]/g, '');
  var bad = !/^[A-Za-z0-9]{8,64}$/.test(k) ? 'API Key를 확인하세요 (영문·숫자).' : !/^[A-Za-z0-9]{8,128}$/.test(sc) ? 'API Secret을 입력하세요 (영문·숫자).' : !/^\d{8,12}$/.test(fr) ? '발신번호를 숫자로 입력하세요 (예: 01012345678).' : '';
  if (bad) { st.textContent = bad; st.className = 'keystat warn'; return; }
  SOL = { key: k, secret: sc, from: fr }; solSave(); solRender(); nstat('✓ Solapi 키를 이 브라우저에만 저장했습니다.', 'on');
}
function solClear() {
  SOL = { key: '', secret: '', from: '' };
  try { ['cbnu_sol_key', 'cbnu_sol_secret', 'cbnu_sol_from'].forEach(function (k) { localStorage.removeItem(k); }); } catch (e) {}
  solRender(); nstat('저장된 Solapi 키를 지웠습니다.');
}
function solNeed() { // 키가 없으면 ⑩ 으로 안내한다
  nstat('먼저 왼쪽 ⑩ 발송 설정에 Solapi API Key·Secret·발신번호를 저장하세요.', 'warn');
  var k = $('#solKey'); if (k) { k.scrollIntoView({ behavior: 'smooth', block: 'center' }); k.focus(); }
}
function nLoad(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
/* 수신자: 체크리스트(PRESETS, assets/recipients.js) + 직접 입력 1칸. 마지막 체크 상태는 이 브라우저에 기억한다(처음엔 첫 항목만 체크) */
function nFmt(v, mail) { return mail ? v : v.replace(/^(01\d)(\d{3,4})(\d{4})$/, '$1-$2-$3'); }
function nPresets(mail) { return typeof usersFor === 'function' ? usersFor(mail).map(function (x) { return x.v; }) : ((typeof PRESETS !== 'undefined' && PRESETS[mail ? 'email' : 'sms']) || []); }
function nChecked(mail) {
  var list = nPresets(mail), saved = null;
  try { saved = JSON.parse(localStorage.getItem('cbnu_nsel_' + (mail ? 'email' : 'sms')) || 'null'); } catch (e) {}
  return Array.isArray(saved) ? saved.filter(function (v) { return list.indexOf(v) >= 0; }) : list.slice(0, 1);
}
function nRender(mail) {
  var on = nChecked(mail);
  $('#ndPre').innerHTML = nPresets(mail).map(function (v, i) {
    return '<label class="ndck" for="ndPre' + i + '"><input type="checkbox" id="ndPre' + i + '" value="' + esc(v) + '"' + (on.indexOf(v) >= 0 ? ' checked' : '') + '><span>' + (typeof uNameOf === 'function' && uNameOf(v, mail) ? '<b>' + esc(uNameOf(v, mail)) + '</b> ' : '') + esc(nFmt(v, mail)) + '</span></label>';
  }).join('');
}
function nPicked() { return $$('#ndPre input:checked').map(function (i) { return i.value; }); }
function nSplit(v, mail) {
  var raw = String(v || '').split(/[\s,;]+/).filter(Boolean), out = [];
  for (var i = 0; i < raw.length; i++) {
    var t = mail ? raw[i].toLowerCase() : raw[i].replace(/\D/g, '');
    if (!(mail ? /^[^\s@,;<>"]{1,64}@[^\s@,;<>"]{1,200}\.[^\s@,;<>"]{2,}$/ : /^01[016789]\d{7,8}$/).test(t)) return null;
    if (out.indexOf(t) < 0) out.push(t);
  }
  return out.length > N_MAX ? null : out;
}
/* 버튼 → 입력창: 받는 이메일 주소 / 휴대폰 번호(최대 10개, 쉼표로 구분)와 제목을 확인하고 발송한다 */
function notifySend(channel) {
  if (NBUSY) return;
  var w = RAW(), cnt = sheetCounts();
  if (!w || !cnt.total) { nstat('먼저 사진을 올리고 문서를 생성하세요.', 'warn'); return; }
  if (!CMCP && channel === 'email' && window.claude && typeof window.claude.use === 'function') { // 아티팩트: 커넥터를 (다시) 찾아 연결한 뒤 이어서 진행
    nstat('Gmail 커넥터에 연결하는 중…');
    connEnsure().then(function (ok) {
      if (ok) { var t = $('#ntoast'); if (t) t.className = ''; notifySend(channel); }
      else nstat('Gmail 커넥터를 쓸 수 없습니다. claude.ai에 로그인한 본인 계정에서 이 아티팩트를 열어 주세요.', 'warn');
    });
    return;
  }
  if (!CMCP && channel === 'email' && !MAIL_SRV && !gmValid()) { nstat('이 사이트에서는 메일을 보낼 수 없습니다. 왼쪽 ⑩ 발송 설정에 Gmail 계정을 저장하거나, Claude 아티팩트 버전(Gmail 커넥터)에서 발송하세요.', 'warn'); var cf = $('#nCfg'); if (cf) cf.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
  if (!CMCP && channel === 'sms') { solLoad(); if (!solValid()) { solNeed(); return; } }
  if (CMCP && channel !== 'email') { nstat('문자 발송은 Vercel 사이트(e-safety.vercel.app)에서만 됩니다.', 'warn'); return; }
  var mail = channel === 'email'; NCH = channel;
  $('#ndHd').textContent = mail ? '✉️ 메일 발송' : '💬 문자 발송';
  $('#ndLab').textContent = mail ? '받는 이메일 (선택)' : '받는 휴대폰 번호 (선택)'; nRender(mail);
  var to = $('#ndTo'); to.type = mail ? 'email' : 'tel'; to.multiple = mail; to.placeholder = mail ? 'name@example.com' : '010-1234-5678'; to.value = '';
  $('#ndTitle').textContent = ntitle(cnt);
  $('#ndNote').textContent = CMCP ? '내 Gmail 계정(Gmail 커넥터)으로 발송합니다. 분석 결과 화면 PDF와 현장사진 위험 분석 sheet(HTML 파일)가 첨부됩니다.' : mail ? (gmValid() ? gmGet().user + ' 계정으로 발송합니다. ' : '') + '분석 결과 화면 PDF와 현장사진 위험 분석 sheet(HTML 파일)가 첨부됩니다.' : '문자 요금이 발생합니다(Solapi 잔액에서 차감). 저장해 둔 Solapi 키는 발송 요청에만 실어 서버를 거쳐 Solapi로 전달됩니다(서버는 저장하지 않음). 제목이 길면 장문(LMS)으로 나갑니다.';
  $('#ndTokRow').style.display = (NTOKEN || CMCP || !mail || gmValid()) ? 'none' : ''; // 문자는 Solapi 키를 직접 넣으므로 토큰이 필요 없다
  $('#ndTok').value = ''; $('#ndErr').textContent = '';
  var d = $('#ndlg'); if (d.showModal) d.showModal(); else d.setAttribute('open', '');
  setTimeout(function () { ($('#ndTokRow').style.display === 'none' ? $('#ndGo') : $('#ndTok')).focus(); }, 30);
}
function ndClose() { var d = $('#ndlg'); if (d.close) d.close(); else d.removeAttribute('open'); }
function notifyGo() {
  if (NBUSY) return;
  var mail = NCH === 'email', err = $('#ndErr'), w = RAW(), cnt = sheetCounts();
  var picked = nPicked(), extra = nSplit($('#ndTo').value, mail);
  if (extra === null) { err.textContent = mail ? '추가 입력의 이메일 주소를 확인하세요.' : '추가 입력의 휴대폰 번호를 확인하세요 (010 등 국내 번호).'; return; }
  var list = picked.slice(); extra.forEach(function (v) { if (list.indexOf(v) < 0) list.push(v); });
  if (!list.length) { err.textContent = mail ? '받는 이메일을 체크하거나 추가 입력에 주소를 넣으세요.' : '받는 번호를 체크하거나 추가 입력에 번호를 넣으세요.'; return; }
  if (list.length > N_MAX) { err.textContent = '받는 사람은 최대 ' + N_MAX + '명입니다.'; return; }
  var tok = NTOKEN || ($('#ndTok').value || '').trim();
  var cred = null;
  if (!mail && !CMCP) {
    solLoad(); if (!solValid()) { ndClose(); solNeed(); return; }
    cred = { key: SOL.key, secret: SOL.secret, sender: SOL.from };
  }
  var gm = (mail && !CMCP) ? gmGet() : null;
  if (!tok && !CMCP && mail && !gm) { err.textContent = '발송 토큰을 입력하세요.'; return; }
  if (!w || !cnt.total) { err.textContent = '먼저 사진을 올리고 문서를 생성하세요.'; return; }
  if (CMCP) { // Claude 아티팩트: Gmail 커넥터로 직접 발송
    var site0 = { name: $('#m_site').value, proc: $('#m_proc').value, date: $('#m_date').value, by: $('#m_by').value }, title0 = ntitle(cnt), sheet0 = '';
    try { sheet0 = w.sheetHtml(); } catch (e) { err.textContent = '분석 sheet를 만들지 못했습니다.'; return; }
    try { localStorage.setItem('cbnu_nsel_email', JSON.stringify(picked)); } catch (e) {}
    ndClose(); NBUSY = true; nstat('분석 결과 PDF 만드는 중…');
    makePdf().then(function (pdf) { nstat('메일 발송 중…'); return connSend(list, title0, cnt, site0, sheet0, pdf, ''); })
      .then(function (hp) { nstat('✓ 메일 발송 완료 (' + list.join(', ') + ') — ' + title0 + (hp ? '' : ' (PDF는 용량 때문에 빠지고 HTML만 첨부)'), 'on'); }, function (e) { nstat('✗ ' + connWhy(e), 'warn'); })
      .then(function () { NBUSY = false; });
    return;
  }
  var body = { token: gm ? undefined : tok, gmail: gm || undefined, solapi: cred, channel: NCH, to: list, counts: cnt, link: SITE_URL, site: { name: $('#m_site').value, proc: $('#m_proc').value, date: $('#m_date').value, by: $('#m_by').value } };
  if (mail) { try { body.sheet = w.sheetHtml(); } catch (e) { err.textContent = '분석 sheet를 만들지 못했습니다.'; return; } }
  var title = ntitle(cnt), name = mail ? '메일' : '문자';
  try { localStorage.setItem(mail ? 'cbnu_nsel_email' : 'cbnu_nsel_sms', JSON.stringify(picked)); } catch (e) {}
  ndClose(); NBUSY = true;
  var prep = mail ? (nstat('분석 결과 PDF 만드는 중…'), makePdf()) : Promise.resolve(null);
  prep.then(function (pdf) {
    if (pdf) body.pdf = pdf.b64;
    nstat(name + ' 발송 중…');
    return fetch('/api/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return { ok: false, error: r.status === 413 ? 'too_large' : 'http_' + r.status }; }); })
      .then(function (j) {
        if (j.ok) { if (mail && !gm && tok) { NTOKEN = tok; try { localStorage.setItem('cbnu_ntok', tok); } catch (e) {} } nstat('✓ ' + name + ' 발송 완료 (' + list.join(', ') + ') — ' + title + (mail && !pdf ? ' (PDF 없이 HTML만)' : ''), 'on'); }
        else { if (j.error === 'bad_token') { NTOKEN = ''; try { localStorage.removeItem('cbnu_ntok'); } catch (e) {} }
          nstat('✗ ' + name + ' 발송 실패: ' + (mail ? mailWhy(j) : ({ bad_credentials: 'Solapi 키·시크릿·발신번호 형식이 맞지 않습니다.', sms_rejected: 'Solapi가 문자를 거절했습니다', too_fast: '잠시 후 다시 시도하세요 (연속 발송 제한).', not_configured: '서버에 문자 발송 설정이 없습니다 (환경변수).', bad_recipient: '받는 번호 형식이 맞지 않습니다.', no_recipient: '받는 번호가 없습니다.' }[j.error] || j.error || '알 수 없음') + (j.detail ? ' — ' + String(j.detail).slice(0, 140) : '')), 'warn'); }
      });
  }).catch(function () { nstat('서버에 연결하지 못했습니다.', 'warn'); })
    .then(function () { NBUSY = false; });
}

/* ---------- 시작 ---------- */
(function init() {
  try { APIKEY = localStorage.getItem('cbnu_key') || ''; OKEY = localStorage.getItem('cbnu_okey') || ''; NTOKEN = localStorage.getItem('cbnu_ntok') || ''; } catch (e) {}
  var drop = $('#drop'), fi = $('#file');
  fi.addEventListener('change', function () { if (fi.files[0]) onFile(fi.files[0]); fi.value = ''; });
  ['dragenter', 'dragover'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function (e) { var f = e.dataTransfer && e.dataTransfer.files[0]; if (f) onFile(f); });
  $('#gq').addEventListener('input', renderGloss);
  ['m_site', 'm_proc', 'm_by'].forEach(function (k) { $('#' + k).addEventListener('change', function () { applyMeta(); }); });
  $('#m_date').value = (function () { var d = new Date(); return d.getFullYear() + '. ' + (d.getMonth() + 1) + '. ' + d.getDate() + '.'; })();
  document.body.classList.add('nodoc');
  applyUI(); initFrames(); probe(); renderOKey(); oprobe(); notifyProbe(); connInit(); solRender();
  try { if (localStorage.getItem('cbnu_sidehide') === '1') sideToggle(true); } catch (e) {}
  window.addEventListener('resize', fitMain); fitMain(); bindZoom(document); $('#main').addEventListener('dblclick', function (e) { if (e.target === this || e.target.id === 'docsBox') zoomFit(); });
  if (window.ResizeObserver) new ResizeObserver(fitMain).observe($('#docs')); // 문서 높이가 바뀌면 스크롤 범위를 맞춘다
  ['raBox', 'c49Box', 'genBox', 'pstBox'].forEach(function (id) { var f = $('#' + id); if (f) f.addEventListener('load', function () { setTimeout(fitMain, 50); }); });
})();
