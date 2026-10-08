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
function fitMain() { var m = $('#main'), d = $('#docs'); if (!m || !d) return; var w = m.clientWidth - 24; var z = Math.min(1, w / 1180); d.style.zoom = z > 0.25 ? z : 0.25; }

/* ---------- 위험분석 프레임 렌더 후 ---------- */
window.onRA = function (rows) {
  H.rows = (rows || []).map(function (m) { return { id: m.id, no: m.no, v: m.v, cust: !!m.cust, grp: m.grp }; });
  document.body.classList.toggle('nodoc', !H.rows.length);
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
  var w = RAW(); if (!w) return; H.sample = null; H.photo = null; H.fname = ''; H.gpt = null; H.sig = {};
  var S = freshState(w); S.ph2 = false; S.sel = []; S.mk = {}; S.src = {}; S.scene = null; S.fname = '-'; S.corr = { sum: false, rain: false, morn: false, fore: false }; w.S = S;
  $('#thumb').innerHTML = ''; $('#drop').classList.remove('has'); status('', ''); $('#gptFull').style.display = 'none';
  ['m_site', 'm_proc', 'm_date', 'm_by', 'm_memo'].forEach(function (k) { $('#' + k).value = ''; });
  w.renderAll();
}
function shrink(src, max, cb) { var im = new Image(); im.onload = function () { var w = im.naturalWidth, h = im.naturalHeight, k = Math.min(1, max / Math.max(w, h)); var c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); cb(c.toDataURL('image/jpeg', 0.86), c.width, c.height); }; im.src = src; }
function onFile(f) {
  if (!f || !/^image\//.test(f.type)) return; var r = new FileReader();
  r.onload = function () { shrink(r.result, 1600, function (small, pw, ph) {
    var w = RAW(); if (!w) return; H.sample = null; H.photo = small; H.pw = pw; H.ph = ph; H.fname = f.name; H.gpt = null; H.sig = {}; $('#gptFull').style.display = 'none';
    $('#thumb').innerHTML = '<img src="' + small + '" alt="">'; $('#drop').classList.add('has');
    var S = freshState(w); S.ph2 = false; S.sel = []; S.mk = {}; S.src = {}; S.scene = null; S.fname = f.name; S.memo = $('#m_memo').value; S.corr = { sum: false, rain: false, morn: false, fore: false }; w.S = S;
    w.hostPhoto(small, function () { if (ENG === 'ai') runRead(); else if (ENG === 'kw') runKw(); else { applyMeta(true); w.renderAll(); status('✋ 직접 선택 — 체크리스트에서 보이는 위험 표지를 고르세요.', 'info'); } });
  }); };
  r.readAsDataURL(f);
}
function runKw() { var w = RAW(); if (!w) return; w.S.memo = $('#m_memo').value + ' ' + $('#m_proc').value; w.S.fname = H.fname || w.S.fname; w.S.scene = null; w.doKw(); applyMeta(true); w.renderAll(); status('🔎 ' + esc(w.S.kwmsg || '키워드 판독 완료'), 'ok'); }

/* ---------- AI 판독 (/api/read) ---------- */
function runRead() {
  var w = RAW(); if (BUSY || !w || !H.photo) return; BUSY = true; var lang = LANG;
  status('<span class="spin"></span> AI가 사진을 판독하는 중입니다… (20~40초)', 'busy');
  var ctrl = window.AbortController ? new AbortController() : null, tm = setTimeout(function () { if (ctrl) ctrl.abort(); }, 65000);
  fetch('api/read', { method: 'POST', headers: { 'content-type': 'application/json' }, signal: ctrl ? ctrl.signal : undefined,
    body: JSON.stringify({ image: H.photo, name: H.fname, lang: lang, key: APIKEY || undefined, site: { kind: $('#m_proc').value, place: $('#m_site').value } }) })
    .then(function (r) { return r.json().catch(function () { return { ok: false, reason: 'http_' + r.status }; }); })
    .then(function (j) { clearTimeout(tm); BUSY = false; if (j && j.ok && j.hits && j.hits.length) applyAI(j, lang); else fallback(j && (j.reason || j.error)); })
    .catch(function (e) { clearTimeout(tm); BUSY = false; fallback(e && e.name === 'AbortError' ? 'timeout' : 'network'); });
}
function applyAI(j, lang) {
  var w = RAW(); if (!w) return; var S = w.S; S.sel = []; S.mk = {}; S.src = {}; S.ps = {};
  j.hits.forEach(function (h) { if (!KBI[h.id] || S.sel.indexOf(h.id) >= 0) return; S.sel.push(h.id); S.mk[h.id] = [Math.round(h.x), Math.round(h.y)]; S.src[h.id] = { ai: arr5(h.evidence, lang) }; });
  S.scene = j.scene ? arr5(j.scene, lang) : null;
  (j.extra || []).slice(0, 3).forEach(function (x) { var t = Array.isArray(x) ? x[0] : x; if (!t) return; var c = { id: 'C' + (++S.cn), name: String(t), cause: String(t), acts: ['관리감독자가 대책을 적는다'], p: 2, s: 2 }; c.ai = 1; if (Array.isArray(x) && x[1]) c.nm5 = arr5(x, lang); S.custom.push(c); S.sel.push(c.id); });
  if (j.domain === 'gen') TAB = 'gen'; else if (j.domain === 'elec') TAB = 'elec';
  applyMeta(true); w.renderAll();
  status('🤖 AI 판독 완료 — 위험 표지 <b>' + j.hits.length + '</b>건' + ((j.extra || []).length ? ', 지식베이스 밖 추가 위험 ' + j.extra.length + '건(⑥ 목록)' : '') + ' · ' + esc(j.model || '') + '<br><small>체크리스트에서 더하거나 빼고, 빈도·강도는 평가표에서 고칩니다.</small>', 'ok');
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
  var tag = $('#ptwTag'); tag.className = 'ptwtag ' + (k === 'c49' ? 'e' : 'g'); tag.textContent = (k === 'c49' ? '⚡ KOSHA GUIDE C-C-49-2026 전기 사전작업허가서' : '🏗️ KOSHA GUIDE C-C-49-2026 일반 건설 사전작업허가서') + (DOMSEL === 'auto' ? ' — 자동 판정' : ' — 관리감독자 지정');
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
  return { texts: tx, icons: icons, nd: top.length, nm: acts.length, theme: th };
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
    f.hostPST({ texts: pd.texts, icons: pd.icons, nd: pd.nd, nm: pd.nm, photo: H.photo || (H.orig && H.orig.photo), pw: H.pw, ph: H.ph, marks: marks, fname: H.fname, gpt: H.gpt, lang: LANG,
      code: '2026-CBNU-포스터-' + (k === 'c49' ? '전기' : '일반') + '-' + ymd,
      src: '사진: 왼쪽 실제 현장사진(' + (H.fname || '업로드') + ') · 오른쪽 ChatGPT 이미지 생성(상황 재현) · 통계: CSI 건설사고 사례 재집계, 1단계 분석보고서 · 외국어 병기는 「안전보건용어 400선」 표준 대역어를 우선 적용했고, 400선 외 용어는 연구자가 번역했다. 현장 적용 전 관리감독자가 확인한다.' });
  }
  setTimeout(function () { fitFrame('pstBox'); fitMain(); mkPrompt(); }, 350);
}

/* ---------- ChatGPT 추가작업 ---------- */
function mkPrompt() {
  var f = W('pstBox'); if (!f || !f.hostGet) return; var g = f.hostGet(), w = RAW(); if (!w) return;
  var enOf = function (k) { var s = f.STR && f.STR[k]; return (s && s.en) || g[k] || ''; };
  var items = H.rows.filter(function (r) { return KBI[r.id]; }).sort(function (a, b) { return b.v - a.v; }).slice(0, 4).map(function (r) { return KBI[r.id].tag[1]; });
  var p;
  if ($('#gmode').value === 'card') {
    p = 'Create ONE photorealistic image, landscape 4:3, that looks like a real documentary photo taken at a Korean construction site.\n'
      + 'It is the GOOD-PRACTICE card of a multilingual safety poster.\n'
      + 'Scene: ' + enOf('good_t') + ' — ' + enOf('good_c') + '\n'
      + 'Setting: similar to the attached site photo, but every hazard below is CONTROLLED and the work is done safely:\n- ' + items.join('\n- ') + '\n'
      + 'Workers wear white hard hats with chin straps fastened, hi-vis vests and the right PPE for the task. Faces must not be identifiable (side or back view).\n'
      + 'Natural daylight, sharp, print quality. No readable text, no letters, no logos, no watermark, no blood.';
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
var OKEY = '';
function okeySave() { var v = ($('#oKey').value || '').trim(); if (!/^sk-[\w-]{20,}$/.test(v)) { $('#gmsg').textContent = 'sk- 로 시작하는 OpenAI API 키를 넣으세요.'; return; }
  OKEY = v; try { localStorage.setItem('cbnu_okey', v); } catch (e) {} $('#oKey').value = ''; $('#gmsg').textContent = '✓ OpenAI 키를 이 브라우저에만 저장했습니다 (…' + v.slice(-4) + ').'; }
function okeyClear() { OKEY = ''; try { localStorage.removeItem('cbnu_okey'); } catch (e) {} $('#gmsg').textContent = 'OpenAI 키를 지웠습니다.'; }
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
  btn.disabled = true; $('#gmsg').textContent = '⏳ Claude가 만든 프롬프트로 실사 이미지를 생성하는 중입니다 (30~90초)…';
  var tick = setInterval(function () { $('#gmsg').textContent = '⏳ 실사 이미지 생성 중… ' + Math.round((Date.now() - t0) / 1000) + '초'; }, 1000);
  var end = function (msg) { clearInterval(tick); btn.disabled = false; $('#gmsg').textContent = msg; };
  shrink(photo, 1024, function (small) {
    if (!small) return end('현장사진을 읽지 못했습니다.');
    fetch('api/poster', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: $('#gprompt').value, photo: small, mode: mode, key: OKEY || undefined }) })
      .then(function (r) { return r.json(); }).then(function (j) {
        if (!j || !j.ok) { var e = j && j.error; return end(e === 'no_key' ? '서버와 브라우저에 OpenAI 키가 없습니다. 아래 칸에 키를 저장하거나 Vercel 환경변수 OPENAI_API_KEY를 설정하세요. (수동: ‘복사 + ChatGPT 열기’)' : e === 'bad_key' ? 'OpenAI 키가 거부되었습니다.' : '생성 실패: ' + (e || '알 수 없음') + (j && j.detail ? ' — ' + j.detail : '')); }
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
function saveDoc(k) { $$('.ddm').forEach(function (m) { m.classList.remove('open'); }); var x = W(frameOf(k)); try { if (k === 'ra') x.saveHtml(); else x.hostSave(); } catch (e) {} }

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
  return { total: v.length, nine: v.filter(function (x) { return x >= 9; }).length, high: v.filter(function (x) { return x >= 6; }).length, mid: v.filter(function (x) { return x >= 3 && x < 6; }).length, low: v.filter(function (x) { return x < 3; }).length };
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
function mailHtmlC(title, site, c) {
  var meta = [['현장명', site.name], ['공종·작업', site.proc], ['평가일', site.date], ['관리감독자', site.by]].filter(function (x) { return x[1]; })
    .map(function (x) { return '<b>' + x[0] + '</b> ' + esc(x[1]); }).join(' &nbsp;·&nbsp; ');
  return '<div style="font-family:\'Malgun Gothic\',Apple SD Gothic Neo,sans-serif;font-size:14px;color:#1c1c1c;max-width:640px">'
    + '<p style="margin:0 0 12px"><a href="' + SITE_URL + '">' + SITE_URL + '</a></p>'
    + '<div style="background:#B03A2E;color:#fff;padding:12px 14px;border-radius:6px;font-size:17px;font-weight:800">' + esc(title) + '</div>'
    + '<p style="margin:12px 0 4px">위험 <b>' + c.total + '건</b> · <span style="color:#B03A2E"><b>9이상 ' + c.nine + '건</b></span> <span style="color:#778;font-size:12px">(위험성 = 빈도 × 강도, 최대 9)</span></p>'
    + (meta ? '<p style="margin:4px 0 10px;color:#334">' + meta + '</p>' : '')
    + '<p>첨부한 <b>현장사진 위험 분석 sheet</b>(HTML 파일)를 열어 위험 분석과 위험성평가표를 확인하세요.</p>'
    + '<p style="color:#778;font-size:12px">자동 생성 결과는 초안입니다. AI는 최초 검토, 최종 판단은 관리감독자가 진행합니다.</p></div>';
}
/* 분석 sheet(약 1MB)는 커넥터 입력 한도(1MiB)를 넘으므로 파일 인자($file)로 보낸다. 그 경로가 안 되면 gzip(.html.gz)으로 줄여 보낸다. */
function connSend(list, title, cnt, site, sheet) {
  var base = { to: list, subject: title, body: SITE_URL + '\n\n' + title + '\n\n첨부한 현장사진 위험 분석 sheet(HTML 파일)를 열어 확인하세요.', htmlBody: mailHtmlC(title, site, cnt) };
  var NAME = 'site-photo-risk-analysis-sheet.html';
  var call = function (att) { return CMCP.callTool('Gmail', 'send_message', Object.assign({}, base, { attachments: [att] })); };
  var viaGzip = function () {
    if (typeof CompressionStream !== 'function') return Promise.reject({ code: 'too_large' });
    return new Response(new Blob([sheet]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer().then(function (buf) {
      var b64 = b64OfBuf(buf); if (b64.length > 900000) return Promise.reject({ code: 'too_large' });
      return call({ content: b64, filename: NAME + '.gz', mimeType: 'application/gzip' });
    });
  };
  return CMCP.listTools().then(function (r) { return !!(r && r.fileArgs); }, function () { return false; }).then(function (fa) {
    if (!fa) return viaGzip();
    return call({ content: { $file: { data: new Blob([sheet], { type: 'text/html' }), name: NAME, type: 'text/html' } }, filename: NAME, mimeType: 'text/html' })
      .catch(function (e) { return (e && (e.code === 'bad_request' || e.code === 'capability_disabled' || e.code === 'tool_error')) ? viaGzip() : Promise.reject(e); });
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
      : '이 사이트에서는 메일을 보낼 수 없습니다(서버에 메일 설정 없음). 메일은 ' + mailLink() + '에서 발송하세요. 문자는 위 Solapi 키로 발송됩니다.';
  }).catch(function () { var el = $('#nCfg'); if (el) el.textContent = '이 주소에서는 서버 함수를 쓸 수 없습니다 (Vercel 배포에서만 동작).'; });
}
var NCH = '';
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
function solNeed() { // 키가 없으면 ⑨ 로 안내한다
  nstat('먼저 왼쪽 ⑨ 발송 설정에 Solapi API Key·Secret·발신번호를 저장하세요.', 'warn');
  var k = $('#solKey'); if (k) { k.scrollIntoView({ behavior: 'smooth', block: 'center' }); k.focus(); }
}
function nLoad(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
/* 수신자: 체크리스트(PRESETS, assets/recipients.js) + 직접 입력 1칸. 마지막 체크 상태는 이 브라우저에 기억한다(처음엔 첫 항목만 체크) */
function nFmt(v, mail) { return mail ? v : v.replace(/^(01\d)(\d{3,4})(\d{4})$/, '$1-$2-$3'); }
function nPresets(mail) { return (typeof PRESETS !== 'undefined' && PRESETS[mail ? 'email' : 'sms']) || []; }
function nChecked(mail) {
  var list = nPresets(mail), saved = null;
  try { saved = JSON.parse(localStorage.getItem('cbnu_nsel_' + (mail ? 'email' : 'sms')) || 'null'); } catch (e) {}
  return Array.isArray(saved) ? saved.filter(function (v) { return list.indexOf(v) >= 0; }) : list.slice(0, 1);
}
function nRender(mail) {
  var on = nChecked(mail);
  $('#ndPre').innerHTML = nPresets(mail).map(function (v, i) {
    return '<label class="ndck" for="ndPre' + i + '"><input type="checkbox" id="ndPre' + i + '" value="' + esc(v) + '"' + (on.indexOf(v) >= 0 ? ' checked' : '') + '><span>' + esc(nFmt(v, mail)) + '</span></label>';
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
  return out.length > 3 ? null : out;
}
/* 버튼 → 입력창: 받는 이메일 주소 / 휴대폰 번호(최대 3개, 쉼표로 구분)와 제목을 확인하고 발송한다 */
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
  if (!CMCP && channel === 'email' && !MAIL_SRV) { nstat('이 사이트에서는 메일을 보낼 수 없습니다. 메일은 Claude 아티팩트 버전(Gmail 커넥터)에서 발송하세요.', 'warn'); var cf = $('#nCfg'); if (cf) cf.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
  if (!CMCP && channel === 'sms') { solLoad(); if (!solValid()) { solNeed(); return; } }
  if (CMCP && channel !== 'email') { nstat('문자 발송은 Vercel 사이트(e-safety.vercel.app)에서만 됩니다.', 'warn'); return; }
  var mail = channel === 'email'; NCH = channel;
  $('#ndHd').textContent = mail ? '✉️ 메일 발송' : '💬 문자 발송';
  $('#ndLab').textContent = mail ? '받는 이메일 (선택)' : '받는 휴대폰 번호 (선택)'; nRender(mail);
  var to = $('#ndTo'); to.type = mail ? 'email' : 'tel'; to.multiple = mail; to.placeholder = mail ? 'name@example.com' : '010-1234-5678'; to.value = '';
  $('#ndTitle').textContent = ntitle(cnt);
  $('#ndNote').textContent = CMCP ? '내 Gmail 계정(Gmail 커넥터)으로 발송합니다. 현장사진 위험 분석 sheet(HTML 파일)가 첨부됩니다.' : mail ? '현장사진 위험 분석 sheet(HTML 파일)가 첨부됩니다.' : '문자 요금이 발생합니다(Solapi 잔액에서 차감). 저장해 둔 Solapi 키는 발송 요청에만 실어 서버를 거쳐 Solapi로 전달됩니다(서버는 저장하지 않음). 제목이 길면 장문(LMS)으로 나갑니다.';
  $('#ndTokRow').style.display = (NTOKEN || CMCP || !mail) ? 'none' : ''; // 문자는 Solapi 키를 직접 넣으므로 토큰이 필요 없다
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
  if (list.length > 3) { err.textContent = '받는 사람은 최대 3명입니다.'; return; }
  var tok = NTOKEN || ($('#ndTok').value || '').trim();
  var cred = null;
  if (!mail && !CMCP) {
    solLoad(); if (!solValid()) { ndClose(); solNeed(); return; }
    cred = { key: SOL.key, secret: SOL.secret, sender: SOL.from };
  }
  if (!tok && !CMCP && mail) { err.textContent = '발송 토큰을 입력하세요.'; return; }
  if (!w || !cnt.total) { err.textContent = '먼저 사진을 올리고 문서를 생성하세요.'; return; }
  if (CMCP) { // Claude 아티팩트: Gmail 커넥터로 직접 발송
    var site0 = { name: $('#m_site').value, proc: $('#m_proc').value, date: $('#m_date').value, by: $('#m_by').value }, title0 = ntitle(cnt), sheet0 = '';
    try { sheet0 = w.sheetHtml(); } catch (e) { err.textContent = '분석 sheet를 만들지 못했습니다.'; return; }
    try { localStorage.setItem('cbnu_nsel_email', JSON.stringify(picked)); } catch (e) {}
    ndClose(); NBUSY = true; nstat('메일 발송 중…');
    connSend(list, title0, cnt, site0, sheet0)
      .then(function () { nstat('✓ 메일 발송 완료 (' + list.join(', ') + ') — ' + title0, 'on'); }, function (e) { nstat('✗ ' + connWhy(e), 'warn'); })
      .then(function () { NBUSY = false; });
    return;
  }
  var body = { token: tok, solapi: cred, channel: NCH, to: list, counts: cnt, link: location.origin + '/', site: { name: $('#m_site').value, proc: $('#m_proc').value, date: $('#m_date').value, by: $('#m_by').value } };
  if (mail) { try { body.sheet = w.sheetHtml(); } catch (e) { err.textContent = '분석 sheet를 만들지 못했습니다.'; return; } }
  var title = ntitle(cnt), name = mail ? '메일' : '문자';
  try { localStorage.setItem(mail ? 'cbnu_nsel_email' : 'cbnu_nsel_sms', JSON.stringify(picked)); } catch (e) {}
  ndClose(); NBUSY = true; nstat(name + ' 발송 중…');
  fetch('/api/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .then(function (r) { return r.json().catch(function () { return { ok: false, error: r.status === 413 ? 'too_large' : 'http_' + r.status }; }); })
    .then(function (j) {
      var why = { bad_token: '발송 토큰이 맞지 않습니다.', no_token_configured: '서버에 NOTIFY_TOKEN 이 설정되지 않았습니다.', too_fast: '잠시 후 다시 시도하세요 (연속 발송 제한).',
        not_configured: '서버에 ' + name + ' 발송 설정이 없습니다 (환경변수).', too_large: '분석 sheet가 너무 큽니다 (사진을 줄여 다시 올려 주세요).', sheet: '분석 sheet가 올바르지 않거나 너무 큽니다.',
        bad_recipient: '받는 ' + (mail ? '주소' : '번호') + ' 형식이 맞지 않습니다.', no_recipient: '받는 ' + (mail ? '주소' : '번호') + '가 없습니다.', bad_credentials: 'Solapi 키·시크릿·발신번호 형식이 맞지 않습니다.', sms_rejected: 'Solapi가 문자를 거절했습니다' };
      if (j.ok) { if (mail) { NTOKEN = tok; try { localStorage.setItem('cbnu_ntok', tok); } catch (e) {} } nstat('✓ ' + name + ' 발송 완료 (' + list.join(', ') + ') — ' + title, 'on'); }
      else { if (j.error === 'bad_token') { NTOKEN = ''; try { localStorage.removeItem('cbnu_ntok'); } catch (e) {} } nstat('✗ ' + name + ' 발송 실패: ' + (why[j.error] || j.error || '알 수 없음') + (j.detail && !mail ? ' — ' + String(j.detail).slice(0, 140) : ''), 'warn'); }
    })
    .catch(function () { nstat('서버에 연결하지 못했습니다.', 'warn'); })
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
  applyUI(); initFrames(); probe(); notifyProbe(); connInit(); solRender();
  window.addEventListener('resize', fitMain); fitMain();
})();
