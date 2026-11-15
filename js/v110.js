(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const arNum = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
  const EMB = /[?&]embedded=1/.test(location.search);
  const RSV110 = window.RSV110 = {};
  const toast = (m) => { try { showGenericToast(m); } catch (e) {} };

  const EXTERNAL = /^(t\.me|telegram\.me|wa\.me|api\.whatsapp\.com|youtu\.be|(www\.|m\.)?youtube\.com|(www\.)?google\.[a-z.]+)$/i;
  let web = null;
  function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } }
  function buildWeb() {
    if (web) return web;
    const o = document.createElement('div'); o.id = 'rsWeb'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-label', 'نافذة الموقع');
    o.innerHTML = `<div class="rw-bar">
        <button type="button" class="rw-btn rw-x" data-a="close" aria-label="إغلاق"><i class="ti ti-x"></i></button>
        <div class="rw-ttl"><b></b><small></small></div>
        <button type="button" class="rw-btn" data-a="reload" aria-label="إعادة تحميل"><i class="ti ti-refresh"></i></button>
        <button type="button" class="rw-btn" data-a="ext" aria-label="فتح في المتصفح"><i class="ti ti-external-link"></i></button>
      </div><div class="rw-prog"><i></i></div>
      <div class="rw-body"><iframe title="الموقع" referrerpolicy="strict-origin-when-cross-origin" allow="clipboard-write; fullscreen" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads"></iframe>
        <div class="rw-hint"><i class="ti ti-info-circle"></i><span>إن لم تظهر الصفحة فالموقع يمنع عرضه داخل التطبيق.</span><button type="button" data-a="ext">فتح في المتصفح</button><button type="button" class="rw-hx" data-a="hint-x"><i class="ti ti-x"></i></button></div></div>`;
    document.body.appendChild(o);
    const fr = o.querySelector('iframe'), hint = o.querySelector('.rw-hint');
    web = { o, fr, hint, url: '', t: 0 };
    fr.addEventListener('load', () => { o.classList.add('loaded'); clearTimeout(web.t); if (web.url) { web.t = setTimeout(() => hint.classList.add('on'), 1200); } });
    o.addEventListener('click', (e) => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      const a = b.dataset.a;
      if (a === 'close') closeWeb();
      else if (a === 'reload') { o.classList.remove('loaded'); hint.classList.remove('on'); fr.src = web.url; }
      else if (a === 'ext') { try { window.open(web.url, '_blank', 'noopener'); } catch (x) {} }
      else if (a === 'hint-x') hint.classList.remove('on');
    });
    return web;
  }
  function openWeb(url, title) {
    url = String(url || '');
    if (!/^https?:\/\//i.test(url)) { try { window.open(url, '_blank', 'noopener'); } catch (e) {} return; }
    const h = hostOf(url);
    const gSearch = /(^|\.)google\.[a-z.]+$/i.test(h) && /\/search/.test(url);
    if ((EXTERNAL.test(h) && !gSearch) || EMB) { try { window.open(url, '_blank', 'noopener'); } catch (e) {} return; }
    if (navigator.onLine === false) { toast('يحتاج فتح الموقع اتصالاً بالإنترنت'); return; }
    const w = buildWeb();
    w.url = url; w.o.classList.remove('loaded'); w.hint.classList.remove('on');
    w.o.querySelector('.rw-ttl b').textContent = title || h;
    w.o.querySelector('.rw-ttl small').textContent = gSearch ? 'جوجل — بحث داخل الموقع' : url.replace(/^https?:\/\//, '');
    w.fr.src = url;
    document.body.classList.add('rs-web-open');
    requestAnimationFrame(() => w.o.classList.add('show'));
    clearTimeout(w.t); w.t = setTimeout(() => w.hint.classList.add('on'), 9000);
  }
  function closeWeb() {
    if (!web || !web.o.classList.contains('show')) return false;
    web.o.classList.remove('show'); document.body.classList.remove('rs-web-open'); clearTimeout(web.t); web.hint.classList.remove('on');
    const fr = web.fr; setTimeout(() => { if (!web.o.classList.contains('show')) { web.url = ''; fr.src = 'about:blank'; } }, 450);
    return true;
  }
  RSV110.openWeb = openWeb; RSV110.closeWeb = closeWeb;
  window.openSiteLink = function (url) { openWeb(url); };
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[target="_blank"][href]'); if (!a) return;
    const href = a.getAttribute('href') || '';
    if (!/^https?:\/\//i.test(href) || EXTERNAL.test(hostOf(href))) return;
    e.preventDefault(); openWeb(href, (a.textContent || '').trim().slice(0, 60));
  }, true);

  (function () {
    const f = window.closeTopOverlayOnBack; if (typeof f !== 'function') return;
    window.closeTopOverlayOnBack = function () {
      if (closeWeb()) return true;
      if (closeVl() || (window.RSV112 && RSV112.closeList && RSV112.closeList())) return true;
      const u = $('rsUpd'); if (u && u.classList.contains('show') && !u.classList.contains('busy')) { u.classList.remove('show'); try { sessionStorage.setItem('rs_upd_later', '1'); } catch (e) {} return true; }
      return f.apply(this, arguments);
    };
  })();

  const REPO = 'Mshkaah/Figh';
  const verParts = (v) => String(v || '').replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  function isNewer(a, b) { const x = verParts(a), y = verParts(b); for (let i = 0; i < Math.max(x.length, y.length); i++) { const p = x[i] || 0, q = y[i] || 0; if (p !== q) return p > q; } return false; }
  const localVer = () => { try { return BUILD_VERSION; } catch (e) { return ''; } };
  const autoOn = () => lsGet('rs_upd_auto', '1') === '1';
  async function fetchRemoteVersion() {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 9000);
    try {
      const r = await fetch('https://raw.githubusercontent.com/' + REPO + '/HEAD/service-worker.js?t=' + Date.now(), { cache: 'no-store', signal: ctl.signal });
      if (!r.ok) throw new Error('http ' + r.status);
      const m = (await r.text()).match(/SHELL_VERSION\s*=\s*'([^']+)'/);
      return m ? m[1] : null;
    } finally { clearTimeout(t); }
  }
  let updShown = false;
  function whenIdle(fn, tries) {
    tries = tries == null ? 25 : tries;
    const busy = () => { try { return !!($('dcWelcome') || $('ccFilm') || $('ccShare') || $('ccMock') || (window.RSD && RSD.hdBusy && RSD.hdBusy())); } catch (e) { return false; } };
    if (!busy() || tries <= 0) fn(); else setTimeout(() => whenIdle(fn, tries - 1), 3000);
  }
  function showUpdate(remote) {
    if (updShown || EMB) return; updShown = true;
    let o = $('rsUpd');
    if (!o) {
      o = document.createElement('div'); o.id = 'rsUpd'; o.setAttribute('role', 'alertdialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-label', 'تحديث التطبيق');
      o.innerHTML = `<div class="ru-card"><div class="ru-grab"></div><img class="ru-logo" src="icons/bismillah.png" alt="" width="64" height="64">
        <h2>تحديث جديد جاهز</h2><span class="ru-ver"></span>
        <p>سيعيد التطبيق فتح نفسه خلال لحظات. مفضلتك وملاحظاتك محفوظة.</p>
        <button type="button" class="ru-go"><i class="ti ti-refresh"></i><span>تحديث</span></button>
        <div class="ru-bar" aria-hidden="true"><i></i></div><div class="ru-msg"></div><button type="button" class="ru-later">لاحقاً</button></div>`;
      document.body.appendChild(o);
      o.querySelector('.ru-go').addEventListener('click', applyUpdate);
      o.querySelector('.ru-later').addEventListener('click', () => { if (o.classList.contains('busy')) return; o.classList.remove('show'); try { sessionStorage.setItem('rs_upd_later', '1'); } catch (e) {} updShown = false; });
    }
    o.querySelector('.ru-ver').textContent = (remote || '') + (localVer() ? '  ←  ' + localVer() : '');
    requestAnimationFrame(() => o.classList.add('show'));
  }
  async function applyUpdate() {
    const o = $('rsUpd'), go = o.querySelector('.ru-go'), msg = o.querySelector('.ru-msg');
    const reset = (m) => { go.disabled = false; go.innerHTML = '<i class="ti ti-refresh"></i><span>تحديث</span>'; o.classList.remove('busy'); msg.textContent = m || ''; };
    go.disabled = true; o.classList.add('busy'); go.innerHTML = '<i class="spin"></i><span>جارٍ التحديث…</span>'; msg.textContent = '';
    try {
      if (!('serviceWorker' in navigator)) { reset('المتصفح لا يدعم التحديث التلقائي'); return; }
      if (navigator.onLine === false) { reset('لا يوجد اتصال بالإنترنت'); return; }
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) { reset('تعذّر العثور على تسجيل التطبيق، جرّب «تحديث ملفات التطبيق» من الإعدادات'); return; }
      window.__rsUserUpd = true;
      try { await reg.update(); } catch (e) {}
      const w = reg.waiting || reg.installing;
      if (!w) { window.__rsUserUpd = false; reset('لم يصل الإصدار الجديد إلى الخادم بعد، حاول بعد دقائق'); return; }
      if (w.state !== 'installed' && w.state !== 'activated') {
        await new Promise((res, rej) => {
          const t = setTimeout(() => rej(new Error('timeout')), 120000);
          w.addEventListener('statechange', () => { if (w.state === 'installed' || w.state === 'activated') { clearTimeout(t); res(); } else if (w.state === 'redundant') { clearTimeout(t); rej(new Error('redundant')); } });
        });
      }
      try { w.postMessage({ type: 'SKIP_WAITING' }); } catch (e) {}
      try { sessionStorage.setItem('rs_just_updated', '1'); } catch (e) {}
      setTimeout(() => location.reload(), 5000);
    } catch (e) { window.__rsUserUpd = false; reset('تعذّر التحديث الآن، تأكّد من الاتصال وحاول مجدداً'); }
  }
  let chkBusy = false;
  async function checkUpdate(force, minGapMs) {
    if (EMB || !('serviceWorker' in navigator)) return false;
    if (navigator.onLine === false) return false;
    if (chkBusy) return false;
    if (!force) {
      if (!autoOn()) return false;
      const last = +lsGet('rs_upd_last', '0') || 0;
      if (Date.now() - last < (minGapMs == null ? 10 * 60 * 1000 : minGapMs)) return false;
      try { if (sessionStorage.getItem('rs_upd_later')) return false; } catch (e) {}
    }
    chkBusy = true;
    try {
      try { const reg = await navigator.serviceWorker.getRegistration(); if (reg) { reg.update().catch(() => {}); watchReg(reg); } } catch (e) {}
      let remote = null;
      try { remote = await fetchRemoteVersion(); } catch (e) { return null; }
      lsSet('rs_upd_last', String(Date.now()));
      if (remote && isNewer(remote, localVer())) { whenIdle(() => showUpdate(remote)); return true; }
      return false;
    } finally { chkBusy = false; }
  }
  const watched = new WeakSet();
  function watchReg(reg) {
    if (!reg || watched.has(reg)) return; watched.add(reg);
    if (reg.waiting && autoOn()) whenIdle(() => showUpdate(''));
    reg.addEventListener('updatefound', () => {
      const w = reg.installing; if (!w) return;
      w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller && autoOn()) whenIdle(() => showUpdate('')); });
    });
  }
  RSV110.checkNow = async function () {
    const s = $('updNowSmall'); if (s) s.textContent = 'جارٍ الفحص…';
    const r = await checkUpdate(true);
    if (s) s.textContent = r === true ? 'يوجد إصدار جديد' : r === null ? 'تعذّر الاتصال بالخادم' : 'أنت على أحدث إصدار (' + localVer() + ')';
    if (r === true) { updShown = false; try { sessionStorage.removeItem('rs_upd_later'); } catch (e) {} }
  };
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (e) => { if (e.data && e.data.type === 'PROTO?' && e.ports && e.ports[0]) e.ports[0].postMessage('v2'); });
    if (!EMB) {
      const boot = () => {
        navigator.serviceWorker.getRegistration().then((reg) => { if (reg) watchReg(reg); }).catch(() => {});
        checkUpdate(false, 60 * 1000);
      };
      if (document.readyState === 'complete') setTimeout(boot, 2500); else window.addEventListener('load', () => setTimeout(boot, 2500));
      window.addEventListener('online', () => setTimeout(() => checkUpdate(false, 15 * 1000), 800));
      document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(() => checkUpdate(false, 5 * 60 * 1000), 1200); });
    }
  }

  function cleanTitle(t, ch) {
    let s = String(t || ''); const names = [ch, String(ch || '').replace(/^(قناة|الشيخ|السيد)\s+/, '')].filter((x) => x && x.length > 2);
    names.forEach((n) => { s = s.replace(new RegExp('\\s*[\\-–—|:•·،]?\\s*' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*[\\-–—|:•·،]?\\s*', 'g'), ' '); });
    s = s.replace(/^[\s\-–—|:•·،]+|[\s\-–—|:•·،]+$/g, '').replace(/\s{2,}/g, ' ');
    return s || String(t || '');
  }
  const rangeTxt = (v) => v.rangeStart === v.rangeEnd ? 'المسألة ' + arNum(v.rangeStart) : 'المسائل ' + arNum(v.rangeStart) + ' – ' + arNum(v.rangeEnd);
  function cardHtml(v, bookId, num) {
    return `<div class="vc" data-vid="${esc(v.videoId)}"><div class="vc-head"><span class="vc-ch"><i class="ti ti-brand-youtube"></i><span>${esc(v.channel)}</span></span>
      <button type="button" class="vc-list" onclick="event.stopPropagation();RSV110.videoList(${bookId},'${esc(String(v.channel).replace(/'/g, "\\'"))}','${esc(num)}')"><i class="ti ti-list-details"></i>القائمة</button></div>
      <div class="vc-title">${esc(cleanTitle(v.title, v.channel))}</div>
      <div class="vc-frame" role="button" tabindex="0" aria-label="تشغيل الفيديو" onclick="event.stopPropagation();RSV110.playInline(this)"><span class="vc-play"><i class="ti ti-player-play-filled"></i></span></div>
      <div class="vc-meta"><em>${rangeTxt(v)}</em></div></div>`;
  }
  RSV110.cleanTitle = cleanTitle; RSV110.rangeTxt = rangeTxt;
  RSV110.playInline = function (fr) {
    if (fr.querySelector('iframe')) return;
    const id = fr.closest('.vc').dataset.vid;
    fr.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${esc(id)}?autoplay=1&rel=0" title="شرح" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
  };
  (function () {
    const f = window.renderSharhChooserHtml; if (typeof f !== 'function') return;
    window.renderSharhChooserHtml = function (sources, bookId, sectionIdx, num) {
      const vids = (sources || []).filter((x) => x.type === 'video'), rest = (sources || []).filter((x) => x.type !== 'video');
      if (!vids.length) return f.apply(this, arguments);
      const list = (sharhVideoIndex.get(`${bookId}::${num}`) || []).filter((v, i, a) => a.findIndex((z) => z.videoId === v.videoId) === i);
      const cards = list.map((v) => cardHtml(v, bookId, num)).join('');
      const head = rest.length ? f.call(this, rest, bookId, sectionIdx, num) : '<div class="sharh-acc-title"><i class="ti ti-notebook"></i> شروحات هذه المسألة</div>';
      return head + cards;
    };
  })();
  let vl = null;
  function closeVl() { if (!vl || !vl.classList.contains('show')) return false; vl.classList.remove('show'); return true; }
  RSV110.videoList = function (bookId, channel, num) {
    const all = [], seen = new Set();
    try { sharhVideoIndex.forEach((list, k) => { if (parseInt(k.split('::')[0], 10) !== bookId) return; list.forEach((v) => { if (v.channel === channel && !seen.has(v.videoId)) { seen.add(v.videoId); all.push(v); } }); }); } catch (e) {}
    all.sort((a, b) => (a.rangeStart - b.rangeStart) || (a.rangeEnd - b.rangeEnd));
    if (!vl) {
      vl = document.createElement('div'); vl.id = 'sharhVidOverlay'; vl.className = 'rs-vl';
      vl.innerHTML = '<div class="svo-bg"></div><div class="svo-panel" role="dialog"><div class="svo-grip"></div><div class="svo-head"><div class="svo-t"><i class="ti ti-brand-youtube"></i><span class="vl-t"></span></div><button type="button" class="svo-x"><i class="ti ti-x"></i></button></div><div class="svo-list"></div></div>';
      document.body.appendChild(vl);
      vl.querySelector('.svo-bg').onclick = vl.querySelector('.svo-x').onclick = closeVl;
    }
    const n = parseFloat(num), book = allBooks.find((b) => b.id === bookId);
    vl.querySelector('.vl-t').textContent = channel + (book ? ' · ' + book.name : '');
    vl.querySelector('.svo-list').innerHTML = all.map((v, i) => { const cur = n >= v.rangeStart && n <= v.rangeEnd;
      return `<div class="svo-it${cur ? ' cur' : ''}"><button type="button" class="svo-b" data-go="${v.rangeStart}"><span class="svo-n">${arNum(i + 1)}</span><span class="svo-m"><b>${esc(cleanTitle(v.title, v.channel))}</b><small>${rangeTxt(v)}${cur ? '<em>هذه المسألة</em>' : ''}</small></span><i class="ti ti-chevron-left svo-c" style="transform:none"></i></button></div>`; }).join('') || '<div class="svo-empty">لا توجد فيديوهات أخرى لهذه القناة.</div>';
    vl.querySelector('.svo-list').onclick = (e) => {
      const b = e.target.closest('[data-go]'); if (!b) return;
      closeVl(); const target = b.dataset.go;
      const blk = document.querySelector(`#readerPage .masala-block[data-masala="${target}"]`);
      if (blk) { try { blk.scrollIntoView({ behavior: 'smooth', block: 'start' }); const fl = blk.querySelector('.ms-sharh-flag'); const acc = blk.querySelector('.sharh-accordion'); if (fl && acc && !acc.classList.contains('open')) setTimeout(() => fl.click(), 450); } catch (x) {} }
      else { try { goToMasalaFromAccordion(bookId, String(target)); } catch (x) {} }
    };
    document.body.classList.add('svo-open'); vl.classList.add('show');
    const cur = vl.querySelector('.svo-it.cur'); if (cur) setTimeout(() => { const l = vl.querySelector('.svo-list'); l.scrollTop = Math.max(0, cur.offsetTop - 70); }, 60);
  };

  const curBookOpen = () => { try { const rp = $('readerPage'); return rp && rp.classList.contains('active') ? currentBookId : null; } catch (e) { return null; } };
  function markHere() {
    const id = curBookOpen();
    document.querySelectorAll('#savedPositionsList .saved-pos-row').forEach((r) => {
      const here = id != null && String(r.dataset.bookId) === String(id);
      r.classList.toggle('is-here', here);
      const t = r.querySelector('.saved-pos-book'); if (!t) return;
      const tag = t.querySelector('.here-tag');
      if (here && !tag) t.insertAdjacentHTML('beforeend', '<span class="here-tag"><i class="ti ti-map-pin-filled"></i>أنت هنا</span>');
      else if (!here && tag) tag.remove();
    });
  }
  (function () {
    const f = window.openSavedPositionsList; if (typeof f === 'function') window.openSavedPositionsList = function () { const r = f.apply(this, arguments); try { markHere(); } catch (e) {} return r; };
    const j = window.jumpToSavedPosition;
    if (typeof j === 'function') window.jumpToSavedPosition = function (bookId) {
      const id = curBookOpen();
      if (id != null && String(id) === String(bookId)) { closeSavedPositionsList(); toast('أنت في هذا الكتاب الآن'); return; }
      return j.apply(this, arguments);
    };
  })();
  function syncPinGlow() {
    const b = $('readerFabPosition'); if (!b) return;
    let on = false;
    try { const id = curBookOpen(); on = id != null && getTrackedBookIds().has(Number(id)); } catch (e) {}
    b.classList.toggle('tracking-here', on);
  }
  setInterval(() => { if (!document.hidden) syncPinGlow(); }, 1500);
  document.addEventListener('click', () => setTimeout(syncPinGlow, 200), true);

  let lastOpen = null;
  function paintLastOpen() {
    const rows = document.querySelectorAll('#searchResults .result-row');
    rows.forEach((r) => r.classList.remove('last-open'));
    if (lastOpen == null) return;
    const m = Array.from(rows).find((r) => (r.getAttribute('onclick') || '') === `searchResultClick(${lastOpen})`);
    if (m) m.classList.add('last-open');
  }
  (function () {
    const c = window.searchResultClick;
    if (typeof c === 'function') window.searchResultClick = function (i) { lastOpen = i; try { const ct = $('content'); if ($('searchPage').classList.contains('active')) window.__rsSearchY = ct.scrollTop; } catch (e) {} return c.apply(this, arguments); };
    const r = window.renderSearchResultsPage;
    if (typeof r === 'function') window.renderSearchResultsPage = function () { const x = r.apply(this, arguments); try { paintLastOpen(); } catch (e) {} return x; };
    const s = window.showSearchRoot;
    if (typeof s === 'function') window.showSearchRoot = function () {
      const x = s.apply(this, arguments);
      try {
        paintLastOpen();
        const y = window.__rsSearchY; const ct = $('content');
        if (typeof y === 'number' && y > 0 && lastOpen != null) { const go = () => { ct.scrollTop = y; }; requestAnimationFrame(() => { go(); requestAnimationFrame(go); }); setTimeout(go, 160); setTimeout(go, 400);
          const row = document.querySelector('#searchResults .result-row.last-open'); if (row) setTimeout(() => { const rr = row.getBoundingClientRect(), cr = ct.getBoundingClientRect(); if (rr.top < cr.top + 60 || rr.bottom > cr.bottom - 80) row.scrollIntoView({ block: 'center' }); }, 480); }
      } catch (e) {}
      return x;
    };
    const st = window.showTab;
    if (typeof st === 'function') window.showTab = function (tab) {
      try { if ($('searchPage').classList.contains('active')) window.__rsSearchY = $('content').scrollTop; } catch (e) {}
      return st.apply(this, arguments);
    };
  })();

  const MEM_KEY = 'rs_sec_mem';
  let mem = {}; try { mem = JSON.parse(lsGet(MEM_KEY, '{}')) || {}; } catch (e) { mem = {}; }
  let memT = 0;
  const memKey = (b, i) => b + ':' + i;
  function saveMem() { const k = Object.keys(mem); if (k.length > 500) k.slice(0, 100).forEach((x) => delete mem[x]); lsSet(MEM_KEY, JSON.stringify(mem)); }
  function recordPos() {
    try {
      const rp = $('readerPage'); if (!rp || !rp.classList.contains('active') || isPageFlipMode() || isThamraBook(currentBookId)) return;
      const c = $('content'), i = rsEffectiveSectionIdx(), el = document.getElementById('rs-sec-' + i); if (!el) return;
      const off = Math.round(c.scrollTop - (el.offsetTop - 12));
      const k = memKey(currentBookId, i);
      if (off > 40) mem[k] = off; else delete mem[k];
      clearTimeout(memT); memT = setTimeout(saveMem, 1500);
    } catch (e) {}
  }
  (function () { const c = $('content'); if (c) { let t = 0; c.addEventListener('scroll', () => { clearTimeout(t); t = setTimeout(recordPos, 220); }, { passive: true }); } })();
  function twoFingerStep(dir) {
    try {
      recordPos();
      const base = rsEffectiveSectionIdx(), target = base + dir;
      if (target < 0 || target >= currentSections.length) return;
      const off = mem[memKey(currentBookId, target)] || 0;
      currentSectionIndex = base;
      scrollToSection(target, { smooth: false, direction: dir });
      try { saveLastPosition(); } catch (e) {}
      if (off > 0) {
        const apply = () => { const el = document.getElementById('rs-sec-' + target), c = $('content'); if (el && c) c.scrollTop = Math.max(0, el.offsetTop - 12 + off); };
        [200, 450, 800].forEach((ms) => setTimeout(apply, ms));
        toast('عدتَ إلى آخر موضع تركته في هذا الباب');
      }
      try { navigator.vibrate && navigator.vibrate(10); } catch (e) {}
    } catch (e) { console.warn('two-finger step', e); }
  }
  (function () {
    let g = null;
    const inReader = (t) => !!(t && t.closest && t.closest('#readerPage') && $('readerPage').classList.contains('active'));
    document.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2 && inReader(e.target) && RSUI.pref('swipe')) {
        const a = e.touches[0], b = e.touches[1];
        g = { d0: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), x0: (a.clientX + b.clientX) / 2, y0: (a.clientY + b.clientY) / 2, done: false };
      } else g = null;
    }, { passive: true, capture: true });
    document.addEventListener('touchmove', (e) => {
      if (!g || g.done || e.touches.length !== 2) return;
      const a = e.touches[0], b = e.touches[1];
      const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), x = (a.clientX + b.clientX) / 2, y = (a.clientY + b.clientY) / 2;
      if (Math.abs(d - g.d0) > 40) { g.done = true; return; }
      const dx = x - g.x0, dy = y - g.y0;
      if (Math.abs(dx) > Math.max(70, innerWidth * .2) && Math.abs(dx) > Math.abs(dy) * 1.8) { g.done = true; twoFingerStep(dx > 0 ? 1 : -1); }
    }, { passive: true, capture: true });
    document.addEventListener('touchend', () => { g = null; }, { passive: true, capture: true });
  })();
})();
