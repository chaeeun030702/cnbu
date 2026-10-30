/* 화면(셸)의 이모지 아이콘을 선 아이콘(인라인 SVG, 24px 캔버스·1.75px 선)으로 바꾼다.
   문서(iframe) 안은 건드리지 않는다. 나중에 스크립트가 다시 쓰는 글자도 MutationObserver로 따라 바꾼다. */
(function () {
  var P = {
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/>',
    pencil: '<path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/>',
    rec: '<circle cx="12" cy="12" r="6" fill="currentColor" stroke="none"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
    msg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/>',
    print: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    text: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v5h6"/><path d="M8 13h8M8 17h5"/>',
    zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
    build: '<path d="M2 20h20"/><path d="M5 20V9l7-5 7 5v11"/><path d="M9 20v-6h6v6"/>',
    bot: '<rect x="4" y="8" width="16" height="12" rx="2"/><path d="M12 4v4M9 13v2M15 13v2"/><circle cx="12" cy="3" r="1"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    hand: '<path d="M18 11V6a2 2 0 0 0-4 0M14 10V4a2 2 0 0 0-4 0v2M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>',
    pin: '<path d="M20 10c0 5-8 12-8 12s-8-7-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    down: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
    clip: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
    palette: '<circle cx="13.5" cy="6.5" r="1"/><circle cx="17.5" cy="10.5" r="1"/><circle cx="8.5" cy="7.5" r="1"/><circle cx="6.5" cy="12.5" r="1"/><path d="M12 2a10 10 0 0 0 0 20c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.4A5.6 5.6 0 0 0 22 9.8C22 5.5 17.5 2 12 2z"/>'
  };
  var M = { '🖼': 'image', '🔄': 'refresh', '✏': 'pencil', '👤': 'user', '📷': 'camera', '⏺': 'rec', '✉': 'mail', '💬': 'msg',
    '💾': 'save', '🖨': 'print', '📝': 'text', '⚡': 'zap', '🏗': 'build', '🤖': 'bot', '🔎': 'search', '✋': 'hand', '📍': 'pin',
    '📖': 'book', '⚠': 'alert', '⏳': 'clock', '🔔': 'bell', '🌐': 'globe', '📥': 'down', '📋': 'clip', '🎨': 'palette' };
  var RX = /(🖼|🔄|✏|👤|📷|⏺|✉|💬|💾|🖨|📝|⚡|🏗|🤖|🔎|✋|📍|📖|⚠|⏳|🔔|🌐|📥|📋|🎨)️?\s?/g;
  function svg(k) { return '<svg class="ico" viewBox="0 0 24 24" width="1.2em" height="1.2em" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + P[k] + '</svg>'; }
  window.ICO = function (k) { return svg(k); };
  function fixText(n) {
    var t = n.nodeValue; RX.lastIndex = 0; if (!RX.test(t)) return;
    var pe = n.parentNode; if (!pe) return;
    if (/^(OPTION|TEXTAREA|TITLE|SCRIPT|STYLE)$/.test(pe.nodeName)) { n.nodeValue = t.replace(RX, ''); return; }
    var span = document.createElement('span'); span.className = 'icw';
    span.innerHTML = t.replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; })
      .replace(RX, function (m, e) { return svg(M[e]); });   // 아이콘 뒤 띄움은 CSS(.ico margin)로 처리
    while (span.firstChild) pe.insertBefore(span.firstChild, n);
    pe.removeChild(n);
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { fixText(root); return; }
    if (root.nodeType !== 1 || root.nodeName === 'IFRAME' || root.nodeName === 'svg') return;
    var tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), a = [], n;
    while ((n = tw.nextNode())) a.push(n);
    a.forEach(fixText);
  }
  function start() {
    walk(document.body);
    new MutationObserver(function (ms) {
      ms.forEach(function (m) {
        if (m.type === 'characterData') fixText(m.target);
        else m.addedNodes.forEach(walk);
      });
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
