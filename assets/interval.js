/* 홈 상단 바 '인터벌 촬영' — 1분 간격으로 현장사진을 자동 촬영한다. 시작하고 3초 뒤 첫 사진을 찍어 '현장사진 올리기'에 반영하고 공유 시트(사진에 저장)로 보낸다.
   사진은 /camera 페이지와 같은 IndexedDB(interval-camera/shots)에 쌓이므로 그곳에서 보기·내보내기·전송할 수 있다.
   iPad Safari는 화면이 꺼지거나 이 탭이 가려지면 카메라가 멈춘다 → 화면 유지(Wake Lock)와 복귀 시 자동 복구를 쓴다. */
(function () {
  'use strict';
  var INTERVALS = [60];                          // 초
  var FIRST_DELAY = 3;                           // 시작 후 첫 사진까지 (초)
  function lbl(s) { return s % 60 === 0 ? s / 60 + '분' : s + '초'; }
  var WIDTH = 1920, QUALITY = 0.9;
  var btn = document.getElementById('ivBtn'), menu = document.getElementById('ivm');
  if (!btn || !menu) return;

  var stream = null, video = null, wake = null, timer = null, busy = false;
  var running = false, every = 0, nextAt = 0, taken = 0, feedFirst = false, saveFirst = false;

  /* ---------- 저장 (camera.html과 같은 스키마) ---------- */
  var dbp = new Promise(function (ok, no) {
    var r = indexedDB.open('interval-camera', 1);
    r.onupgradeneeded = function () { r.result.createObjectStore('shots', { keyPath: 'id', autoIncrement: true }); };
    r.onsuccess = function () { ok(r.result); };
    r.onerror = function () { no(r.error); };
  });
  function putShot(s) {
    return dbp.then(function (db) {
      return new Promise(function (ok, no) { var t = db.transaction('shots', 'readwrite'); t.objectStore('shots').add(s); t.oncomplete = ok; t.onerror = function () { no(t.error); }; });
    });
  }

  /* ---------- 화면 ---------- */
  var toastEl = null, toastT = 0;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#222;color:#fff;padding:10px 16px;border-radius:10px;font-size:13px;z-index:200;max-width:90vw;box-shadow:0 6px 18px rgba(0,0,0,.3)';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg; toastEl.style.display = 'block';
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.style.display = 'none'; }, 5000);
  }
  function item(label, fn) {
    var b = document.createElement('button'); b.textContent = label;
    b.onclick = function () { menu.classList.remove('open'); fn(); };
    return b;
  }
  function render() {
    btn.className = 'gh blue' + (running ? ' act' : '');   // 평소 파란색, 촬영 중에는 초록색
    btn.innerHTML = running ? '<span class="ic">⏺</span><span class="bl on">촬영 중 · ' + lbl(every) + ' · ' + taken + '장</span><span class="cr">▾</span>'
      : '<span class="ic">📷</span><span class="bl">인터벌 촬영</span><span class="cr">▾</span>';   // 좁은 화면에서는 아이콘만(.bl 숨김), 촬영 중에는 상태 글자를 보인다
    var items = [];
    if (running) items.push(item('■ 촬영 중지', stop));
    else INTERVALS.forEach(function (s) { items.push(item('▶ ' + lbl(s) + '마다 촬영 시작', function () { start(s); })); });
    items.push(item('촬영 페이지 열기 (설정·전송·저장된 사진)', function () {
      if (running && !confirm('이 화면을 벗어나면 촬영이 멈춥니다. 촬영 페이지로 이동할까요?')) return;
      location.href = 'camera';
    }));
    menu.replaceChildren.apply(menu, items);
  }

  /* ---------- 카메라 ---------- */
  function openCamera() {
    closeCamera();
    return navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: WIDTH }, height: { ideal: Math.round(WIDTH * 3 / 4) } }, audio: false
    }).then(function (s) {
      stream = s;
      if (!video) {
        video = document.createElement('video');
        video.setAttribute('playsinline', ''); video.muted = true; video.autoplay = true;
        video.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
        document.body.appendChild(video);
      }
      video.srcObject = s;
      return video.play().catch(function () {});
    });
  }
  function closeCamera() { if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; if (video) video.srcObject = null; }
  function alive() { return stream && stream.getVideoTracks().some(function (t) { return t.readyState === 'live'; }) && video && video.videoWidth > 0; }
  function lockScreen() {
    if (!('wakeLock' in navigator) || wake) return Promise.resolve();
    return navigator.wakeLock.request('screen').then(function (w) { wake = w; w.addEventListener('release', function () { wake = null; }); }).catch(function () {});
  }

  /* ---------- 촬영 ---------- */
  function stamp(d) { return d.toLocaleString('ko-KR', { hour12: false }).replace(/\s+/g, ' '); }
  function capture() {
    if (busy) return Promise.resolve(); busy = true;
    return Promise.resolve().then(function () { return alive() ? null : openCamera(); })
      .then(function () { return new Promise(function (r) { requestAnimationFrame(r); }); })
      .then(function () {
        var c = document.createElement('canvas'); c.width = video.videoWidth; c.height = video.videoHeight;
        var g = c.getContext('2d'); g.drawImage(video, 0, 0);
        var now = new Date(), isFirst = feedFirst, shareIt = saveFirst, watch = typeof window.watchWants === 'function' && window.watchWants();   // watch: 위험 알림 루틴이 이 사진을 분석할 수 있는 상태
        var clean = (isFirst || watch) ? new Promise(function (r) { c.toBlob(r, 'image/jpeg', QUALITY); }) : Promise.resolve(null);   // 촬영 시각 글자를 넣기 전 원본
        return clean.then(function (cleanBlob) {
          var size = Math.max(16, Math.round(c.height / 36)), pad = size / 2;
          g.font = '600 ' + size + 'px sans-serif'; g.textBaseline = 'bottom';
          var t = stamp(now), w = g.measureText(t).width;
          g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(pad / 2, c.height - size - pad * 1.5, w + pad * 1.5, size + pad * 1.2);
          g.fillStyle = '#fff'; g.fillText(t, pad, c.height - pad);
          var shot = null;
          return new Promise(function (r) { c.toBlob(r, 'image/jpeg', QUALITY); }).then(function (blob) {
            if (!blob) throw new Error('이미지 생성 실패');
            shot = blob;
            return putShot({ blob: blob, takenAt: now.getTime(), sent: false });
          }).then(function () { if (shareIt) { saveFirst = false; shareShot(shot, now); } }).then(function () { if (!cleanBlob) return; if (watch) { feedFirst = false; window.watchFeed(cleanBlob, now); } else if (isFirst) feedSitePhoto(cleanBlob, now); });
        });
      })
      .then(function () { taken++; render(); })
      .catch(function (e) { toast('촬영 실패: ' + (e && e.message || e)); })
      .then(function () { busy = false; });
  }
  /* 촬영 시작 후 첫 사진을 '① 현장사진 올리기'에 직접 올린 것과 같게 반영(축소 → 판독 → 문서 생성) */
  function feedSitePhoto(blob, d) {
    if (typeof window.onFile !== 'function') return;
    feedFirst = false;
    window.onFile(new File([blob], 'interval-' + d.getTime() + '.jpg', { type: 'image/jpeg', lastModified: d.getTime() }));
    toast('첫 사진을 현장사진으로 올렸습니다.');
  }
  /* 첫 사진을 공유 시트로 보낸다(iPad: '이미지 저장' → 사진 앱). 공유는 사용자가 화면을 누른 직후에만 열리므로, 자동 호출이 막히면 탭하는 버튼을 띄운다 */
  var shareEl = null;
  function hideShare() { if (shareEl) { shareEl.remove(); shareEl = null; } }
  function shareShot(blob, d) {
    var file = new File([blob], 'interval-' + d.getTime() + '.jpg', { type: 'image/jpeg', lastModified: d.getTime() });
    if (!(navigator.canShare && navigator.canShare({ files: [file] }))) { toast('이 브라우저는 사진 공유를 지원하지 않습니다. 촬영 페이지에서 저장하세요.'); return; }
    navigator.share({ files: [file] }).catch(function (e) {
      if (e && e.name === 'AbortError') return;                    // 사용자가 공유 시트를 닫음
      hideShare();
      shareEl = document.createElement('div');
      shareEl.style.cssText = 'position:fixed;left:50%;bottom:72px;transform:translateX(-50%);display:flex;gap:6px;z-index:201;box-shadow:0 6px 18px rgba(0,0,0,.35);border-radius:12px;overflow:hidden';
      var go = document.createElement('button'), x = document.createElement('button');
      go.textContent = '📥 첫 사진 공유 / 사진에 저장'; go.style.cssText = 'border:0;background:#1A73E8;color:#fff;font-size:14px;font-weight:700;padding:12px 16px';
      x.textContent = '✕'; x.style.cssText = 'border:0;background:#334155;color:#fff;font-size:14px;padding:12px 14px';
      go.onclick = function () { navigator.share({ files: [file] }).then(hideShare, function (err) { if (!err || err.name !== 'AbortError') toast('공유하지 못했습니다. 촬영 페이지에서 저장하세요.'); hideShare(); }); };
      x.onclick = hideShare; shareEl.append(go, x); document.body.appendChild(shareEl);
      setTimeout(hideShare, 120000);
    });
  }
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(function () {
      if (!running) return;
      capture().then(function () {
        nextAt = Math.max(nextAt + every * 1000, Date.now() + 1000);   // 밀렸으면 건너뛰고 다음 칸으로
        schedule();
      });
    }, Math.max(0, nextAt - Date.now()));
  }

  function start(sec) {
    if (running) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return toast('이 브라우저는 카메라를 지원하지 않거나 HTTPS가 아닙니다.');
    openCamera().then(function () {
      return lockScreen();
    }).then(function () {
      running = true; every = sec; taken = 0; feedFirst = true; saveFirst = true; render();
      nextAt = Date.now() + FIRST_DELAY * 1000; schedule();   // 3초 뒤 첫 장, 그 뒤로 간격마다
      toast(FIRST_DELAY + '초 뒤 첫 사진을 찍고, 이후 ' + lbl(every) + '마다 촬영합니다. 이 화면을 켜 둔 채 앞에 두세요.');
    }).catch(function (e) {
      closeCamera(); running = false; render();
      toast(e && e.name === 'NotAllowedError' ? '카메라 권한이 거부되었습니다. 설정 > Safari > 카메라에서 허용해 주세요.' : '카메라를 켤 수 없습니다: ' + (e && e.message || e));
    });
  }
  function stop() {
    running = false; feedFirst = false; saveFirst = false; clearTimeout(timer); closeCamera();
    if (wake) { wake.release().catch(function () {}); wake = null; }
    var n = taken; render(); toast('촬영을 멈췄습니다. 총 ' + n + '장 · 촬영 페이지에서 확인·전송할 수 있습니다.');
  }

  /* 화면이 가려졌다 돌아오면 화면 유지·카메라를 되살리고 바로 한 장 찍는다 */
  document.addEventListener('visibilitychange', function () {
    if (!running || document.hidden) return;
    lockScreen().then(function () { return alive() ? null : openCamera(); })
      .then(function () { if (nextAt < Date.now()) { nextAt = Date.now(); schedule(); } })
      .catch(function (e) { toast('카메라 복구 실패: ' + (e && e.message || e)); });
  });

  render();
})();
