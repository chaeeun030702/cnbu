/* 법령 최신화 — 산업안전보건법·중대재해처벌법 등이 개정되면 문서에 인용한 조문 문구를 최신으로 바꾼다.
   ① 지식베이스(KB)와 문서가 인용한 법령·조문을 모은다 → ② /api/laws(Claude 웹 검색)로 현행 공포·시행일과 바뀐 조문을 확인
   → ③ 관리감독자가 고른 항목만 "기존 문구 → 새 문구"로 저장(이 브라우저) → ④ 모든 결과 문서에 즉시 반영.
   AI는 최초 검토, 최종 판단은 관리감독자가 진행. */
(function () {
  var LAWS = [
    { id: 'osha', name: '산업안전보건법', short: '산안법', url: 'https://www.law.go.kr/법령/산업안전보건법', re: /산업안전보건법(?! 시행)/ },
    { id: 'oshad', name: '산업안전보건법 시행령', short: '산안법 시행령', url: 'https://www.law.go.kr/법령/산업안전보건법시행령', re: /산업안전보건법 시행령/ },
    { id: 'oshar', name: '산업안전보건법 시행규칙', short: '산안법 시행규칙', url: 'https://www.law.go.kr/법령/산업안전보건법시행규칙', re: /산업안전보건법 시행규칙/ },
    { id: 'rule', name: '산업안전보건기준에 관한 규칙', short: '안전보건규칙', url: 'https://www.law.go.kr/법령/산업안전보건기준에관한규칙', re: /안전보건규칙|산업안전보건기준에 관한 규칙/ },
    { id: 'sapa', name: '중대재해 처벌 등에 관한 법률', short: '중처법', url: 'https://www.law.go.kr/법령/중대재해처벌등에관한법률', re: /중대재해 ?처벌(?:법| 등에 관한 법률)(?! 시행령)/ },
    { id: 'sapad', name: '중대재해 처벌 등에 관한 법률 시행령', short: '중처법 시행령', url: 'https://www.law.go.kr/법령/중대재해처벌등에관한법률시행령', re: /중대재해 ?처벌(?:법| 등에 관한 법률) 시행령/ },
    { id: 'kosha', name: 'KOSHA GUIDE·기술지원규정', short: 'KOSHA GUIDE', url: 'https://portal.kosha.or.kr/', re: /KOSHA/ }
  ];
  // 지식베이스 밖에서 문서 본문이 인용하는 조문(보존기간·위험성평가·중처법 의무 등)
  var EXTRA = { osha: ['제5조 [사업주 등의 의무]', '제16조 [관리감독자]', '제36조 [위험성평가의 실시]'], oshar: ['제37조의4'],
    sapa: ['제4조 [사업주와 경영책임자등의 안전 및 보건 확보의무]'], sapad: ['제4조 [안전보건관리체계의 구축 및 이행에 관한 조치]'], kosha: ['KOSHA GUIDE C-C-49-2026', 'KOSHA GUIDE P-94-2021'] };
  var ST = 'cbnu_lawfix', FR = ['raBox', 'c49Box', 'genBox', 'pstBox', 'signBox'];
  var D = load(), LAST = null;
  function load() { try { var v = JSON.parse(localStorage.getItem(ST) || 'null'); if (v && v.fixes) return v; } catch (e) {} return { fixes: [], checked: {} }; }
  function save() { try { localStorage.setItem(ST, JSON.stringify(D)); } catch (e) {} }
  function $(s) { return document.querySelector(s); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ① 인용 조문 모으기 — 지식베이스 문구와 지금 열린 결과 문서의 본문을 줄 단위로 훑는다.
     "안전보건규칙 제318조 [..]·제322조제2항 [..]·산업안전보건법 제16조 [..] / KOSHA B-E-12-2026", "제301조(…) 제1항" 형식 모두 */
  function texts() {
    var a = [];
    (window.KB || []).forEach(function (k) { a.push(Array.isArray(k.law) ? k.law[0] : (k.law || '')); });
    FR.forEach(function (id) { try { var d = document.getElementById(id).contentDocument; if (d && d.body) a = a.concat(d.body.innerText.split(/\n+/)); } catch (e) {} });
    return a;
  }
  function cites() {
    var out = {}; LAWS.forEach(function (l) { out[l.id] = (EXTRA[l.id] || []).slice(); });
    var tok = /(산업안전보건법 시행규칙|산업안전보건법 시행령|산업안전보건법|안전보건규칙|산업안전보건기준에 관한 규칙|중대재해 ?처벌(?:법| 등에 관한 법률)(?: 시행령)?)|(KOSHA(?: GUIDE)? [A-Z]+(?:-[A-Z]+)*-\d+-\d{4})|(제\d+조(?:의\d+)?(?:\s*(?:\[[^\]]{1,40}\]|\([^)]{1,40}\)))?(?:\s*제\d+항)?(?:\s*제\d+호)?)/g;
    texts().forEach(function (s) {
      var cur = null, m; tok.lastIndex = 0;
      while ((m = tok.exec(s))) {
        if (m[1]) { cur = LAWS.filter(function (l) { return l.id !== 'kosha' && l.re.test(m[1]); })[0] || cur; }
        else if (m[2]) push(out.kosha, m[2]);
        else if (m[3] && cur) push(out[cur.id], m[3].replace(/\s+/g, ' ').trim());
      }
    });
    return out;
    function push(a, v) { if (a.indexOf(v) < 0) a.push(v); }
  }

  /* ④ 문서에 반영 — 텍스트 노드에서 기존 문구를 새 문구로. 새 문구 안의 기존 문구는 다시 바꾸지 않는다 */
  function fixNode(v) {
    D.fixes.forEach(function (f) { if (!f.on || v.indexOf(f.from) < 0) return;
      v = v.split(f.to).map(function (p) { return p.split(f.from).join(f.to); }).join(f.to); });
    return v;
  }
  function apply(root) {
    if (!root || !D.fixes.some(function (f) { return f.on; })) return;
    var d = root.ownerDocument || root, tw = d.createTreeWalker(root, 4, null), n, a = [];
    while ((n = tw.nextNode())) a.push(n);
    a.forEach(function (x) { var v = fixNode(x.nodeValue); if (v !== x.nodeValue) x.nodeValue = v; });
  }
  function watch() {
    FR.forEach(function (id) { try { var f = document.getElementById(id), d = f && f.contentDocument; if (!d || !d.body) return;
      if (!d.__lf) { d.__lf = 1; var t = null; new MutationObserver(function () { clearTimeout(t); t = setTimeout(function () { apply(d.body); }, 80); })
        .observe(d.body, { childList: true, subtree: true, characterData: true }); }
      apply(d.body); } catch (e) {} });
  }
  setInterval(watch, 1500);

  /* 대화상자 */
  function row(l, C) {
    var c = D.checked[l.id] || {}, r = LAST && LAST[l.id], st;
    if (r) st = r.amended === true ? '<span class="lw-b warn">개정 · 확인 필요</span>' : (r.amended === false ? '<span class="lw-b ok">인용 조문 변경 없음</span>' : '<span class="lw-b">확인 못 함</span>');
    else st = c.date ? '<span class="lw-b ok">확인 ' + esc(c.date) + '</span>' : '<span class="lw-b">미확인</span>';
    var eff = (r && r.effective) || c.effective || '—';
    return '<tr><td><b>' + esc(l.short) + '</b><small>' + esc(l.name) + '</small></td><td class="num">' + C[l.id].length + '</td><td class="num">' + esc(eff) + '</td><td>' + st + '</td>'
      + '<td><a href="' + esc((r && r.source) || l.url) + '" target="_blank" rel="noopener" class="lw-a">원문 ↗</a></td></tr>'
      + (r && r.summary ? '<tr class="lw-sum"><td colspan="5">' + esc(r.summary) + '</td></tr>' : '');
  }
  function render() {
    var C = cites();
    $('#lwTb').innerHTML = LAWS.map(function (l) { return row(l, C); }).join('');
    var sug = [];
    if (LAST) LAWS.forEach(function (l) { ((LAST[l.id] || {}).changes || []).forEach(function (c) { sug.push({ law: l.short, from: c.from, to: c.to, note: c.note }); }); });
    $('#lwSug').innerHTML = sug.length ? '<div class="lw-h">AI가 제안한 조문 변경 — 맞는 항목만 고른 뒤 반영</div>' + sug.map(function (s, i) {
      return '<label class="lw-s"><input type="checkbox" data-i="' + i + '" checked><span><em>' + esc(s.law) + '</em> <s>' + esc(s.from) + '</s> → <input class="lw-to" data-i="' + i + '" value="' + esc(s.to) + '">'
        + (s.note ? '<small>' + esc(s.note) + '</small>' : '') + '</span></label>'; }).join('')
      + '<button type="button" class="sm pri" id="lwApply">선택 항목 문서에 반영</button>' : (LAST ? '<div class="lw-none">문서가 인용한 조문 가운데 바뀐 것을 찾지 못했습니다.</div>' : '');
    $('#lwSug').__sug = sug;
    var b = $('#lwApply'); if (b) b.onclick = applySug;
    $('#lwFix').innerHTML = D.fixes.length ? D.fixes.map(function (f, i) {
      return '<div class="lw-f' + (f.on ? '' : ' off') + '"><label><input type="checkbox" data-i="' + i + '"' + (f.on ? ' checked' : '') + '> <span>' + esc(f.from) + ' → <b>' + esc(f.to) + '</b></span></label><button type="button" class="lw-x" data-i="' + i + '" aria-label="삭제" title="삭제">✕</button></div>'; }).join('')
      : '<div class="lw-none">아직 반영한 변경이 없습니다.</div>';
  }
  function applySug() {
    var sug = $('#lwSug').__sug || [], n = 0;
    Array.prototype.forEach.call(document.querySelectorAll('#lwSug input[type=checkbox]'), function (c) {
      if (!c.checked) return; var s = sug[+c.dataset.i], to = document.querySelector('#lwSug .lw-to[data-i="' + c.dataset.i + '"]').value.trim();
      if (s && to && to !== s.from) { addFix(s.from, to); n++; } });
    LAST && LAWS.forEach(function (l) { if (LAST[l.id]) LAST[l.id].changes = []; });
    save(); render(); watch(); msg(n ? n + '건을 문서에 반영했습니다.' : '고른 항목이 없습니다.', n ? 'ok' : '');
  }
  function addFix(from, to) { D.fixes = D.fixes.filter(function (f) { return f.from !== from; }); D.fixes.push({ from: from, to: to, on: true, at: today() }); }
  function today() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function msg(t, k) { var m = $('#lwMsg'); m.className = 'lw-msg ' + (k || ''); m.textContent = t; }
  function revert(f) {   // 끈·지운 변경은 문서에서 새 문구를 기존 문구로 되돌린다
    FR.forEach(function (id) { try { var d = document.getElementById(id).contentDocument; if (!d || !d.body) return;
      var tw = d.createTreeWalker(d.body, 4, null), n, a = []; while ((n = tw.nextNode())) if (n.nodeValue.indexOf(f.to) >= 0) a.push(n);
      a.forEach(function (x) { x.nodeValue = x.nodeValue.split(f.to).join(f.from); }); } catch (e) {} });
  }

  window.lawOpen = function () { render(); msg('', ''); var g = $('#lwdlg'); if (g.showModal) g.showModal(); else g.setAttribute('open', ''); };
  window.lawClose = function () { var g = $('#lwdlg'); g.close ? g.close() : g.removeAttribute('open'); };
  window.lawCheck = function () {
    var C = cites(), b = $('#lwGo'), t0 = Date.now();
    b.disabled = true; var tick = setInterval(function () { msg('국가법령정보센터 등에서 최신 개정을 확인하는 중… ' + Math.round((Date.now() - t0) / 1000) + '초 (보통 1~3분)', 'busy'); }, 1000);
    fetch('api/laws', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: (window.APIKEY || undefined), laws: LAWS.map(function (l) { return { name: l.name, cites: C[l.id] }; }) }) })
      .then(function (r) { return r.json().catch(function () { return { ok: false, reason: 'http_' + r.status }; }); })
      .then(function (j) {
        clearInterval(tick); b.disabled = false;
        if (!j || !j.ok) { var why = j && (j.reason === 'api_401' || j.reason === 'no_key' || j.reason === 'bad_key') ? 'Claude API 키가 없거나 유효하지 않습니다. 왼쪽 Claude API 키 칸에 키를 넣거나 Vercel의 ANTHROPIC_API_KEY를 새 키로 바꿔 주세요' : '확인하지 못했습니다 (' + ((j && (j.error || j.reason)) || '오류') + ')'; msg(why + '. 아래 "직접 바꾸기"로 고칠 수 있습니다.', 'warn'); return; }
        LAST = {}; j.laws.forEach(function (x, i) { var l = LAWS[i]; LAST[l.id] = x;
          D.checked[l.id] = { date: j.checked, effective: x.effective, promulgated: x.promulgated, source: x.source }; });
        save(); render();
        var n = j.laws.reduce(function (a, x) { return a + x.changes.length; }, 0);
        msg(j.checked + ' 기준 확인 완료 — 바꿀 조문 ' + n + '건. AI는 최초 검토, 최종 판단은 관리감독자가 진행.', n ? 'warn' : 'ok');
      }).catch(function (e) { clearInterval(tick); b.disabled = false; msg('연결 오류: ' + e.message, 'warn'); });
  };
  window.lawManual = function () {
    var a = $('#lwFrom').value.trim(), b = $('#lwTo').value.trim();
    if (!a || !b || a === b) { msg('기존 문구와 새 문구를 모두 적어 주세요.', 'warn'); return; }
    addFix(a, b); save(); $('#lwFrom').value = ''; $('#lwTo').value = ''; render(); watch(); msg('반영했습니다: ' + a + ' → ' + b, 'ok');
  };
  document.addEventListener('change', function (e) {
    var c = e.target; if (!c.closest || !c.closest('#lwFix') || c.type !== 'checkbox') return;
    var f = D.fixes[+c.dataset.i]; if (!f) return; f.on = c.checked; save();
    if (!f.on) revert(f); render(); watch();
  });
  document.addEventListener('click', function (e) {
    var x = e.target.closest && e.target.closest('#lwFix .lw-x'); if (!x) return;
    var f = D.fixes.splice(+x.dataset.i, 1)[0]; save(); if (f && f.on) revert(f); render();
  });
})();
