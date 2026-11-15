(function () {
  'use strict';
  const RSD = window.RSD; if (!RSD || RSD.embedded) return;
  const { $, q, qa, lsGet, lsSet, esc, sleep } = RSD.util; const GK = RSD.GK;
  const userOff = () => lsGet('rs_hints_off', '0') === '1';
  const activePage = () => { const p = document.querySelector('.page.active'); return p ? p.id : ''; };
  const readerActive = () => activePage() === 'readerPage';
  const visible = (el) => { if (!el || !el.isConnected) return false; const r = el.getBoundingClientRect(); if (r.width < 6 || r.height < 6) return false; const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden'; };
  const firstVis = (sel, root) => qa(sel, root).find(visible) || null;
  const inView = (el, top, bot) => { const r = el.getBoundingClientRect(); return r.width > 6 && r.height > 6 && r.top >= (top == null ? 80 : top) && r.bottom <= innerHeight - (bot == null ? 100 : bot); };
  const inThamra = () => { try { return typeof isThamraBook === 'function' && isThamraBook(currentBookId); } catch (e) { return false; } };
  const swipeOn = () => { try { return !!RSUI.pref('swipe'); } catch (e) { return true; } };
  const srcCtx = () => { try { return !!rsSrcCtx(); } catch (e) { return false; } };
  const cmpCompare = () => { try { const c = $('comparisonPage'); return !!(c && c.classList.contains('active') && cmpNav && cmpNav.level === 'compare'); } catch (e) { return false; } };
  const sectionsCount = () => { try { if (isThamraBook(currentBookId) && typeof currentThamraSections !== 'undefined') return (currentThamraSections || []).length; return typeof currentSections !== 'undefined' ? (currentSections || []).length : 0; } catch (e) { return 0; } };
  const busy = () => {
    try {
      if (Date.now() - (window.__fnEnd || 0) < 3500) return true;
      if (document.querySelector('.rs-ov.show, .rs-sheet-ov.show, #tocOverlay.show, #cbTocOverlay.show, #savedPositionsOverlay.show, #fnWarn.show, #fnNotice, #glossaryOverlay.show, #settingsOverlay.show, #advancedSettingsOverlay.show, #starSheetOverlay.show, #rsShareOv, #miniMenuOverlay.show, #dcWelcome.show')) return true;
      if (RSD.hubOpen && RSD.hubOpen()) return true; if (RSD.stageOpen && RSD.stageOpen()) return true;
      const bar = $('csBar'); if (bar && getComputedStyle(bar).display !== 'none') return true;
      if (document.body.classList.contains('split-active')) return true;
      const a = $('autoScrollBar'); if (a && a.classList.contains('show')) return true;
    } catch (e) {}
    return false;
  };

  let lastTouch = 0, lastScroll = 0, readMs = 0, readSince = 0, lastReadT = 0;
  ['pointerdown', 'touchstart', 'wheel', 'keydown'].forEach((ev) => document.addEventListener(ev, () => { lastTouch = Date.now(); }, { passive: true, capture: true }));
  function hookScroll() {
    const c = $('content'); if (!c || c.__dc) return; c.__dc = true;
    c.addEventListener('scroll', () => {
      if (!readerActive()) return; const n = Date.now(); lastScroll = n;
      lastReadT = n;
    }, { passive: true });
  }
  document.addEventListener('click', (e) => { try { if (e.target.closest('#readerPage .masala-block')) RSD._toolsTouched = true; } catch (x) {} }, true);

  const wait = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < (ms || 4000)) { let v = null; try { v = fn(); } catch (e) {} if (v) return v; await sleep(120); } return null; };
  function bookToOpen(kind) {
    try {
      if (kind === 'urwa') { const b = allBooks.find((x) => { try { return isUrwaBook(x.id) || isThamraBook(x.id); } catch (e) { return false; } }); return b ? b.id : null; }
      const plain = (id) => { try { return !isUrwaBook(id) && !isThamraBook(id); } catch (e) { return true; } };
      let cur = null; try { cur = currentBookId; } catch (e) {}
      if (readerActive() && cur != null && plain(cur)) return cur;
      try { const rec = JSON.parse(localStorage.getItem('rs_recent_reads') || '[]').find((r) => plain(r.bookId) && allBooks.some((x) => x.id === r.bookId)); if (rec) return rec.bookId; } catch (e) {}
      const pref = allBooks.find((x) => /منهاج الصالحين/.test(x.name) && plain(x.id)); if (pref) return pref.id;
      const any = allBooks.find((x) => plain(x.id)); return any ? any.id : null;
    } catch (e) { return null; }
  }
  async function toReader(kind) {
    if (readerActive() && (kind !== 'urwa' || ($('urwaSettingsBtn') && visible($('urwaSettingsBtn'))))) return true;
    const id = bookToOpen(kind); if (id == null) return false;
    try { openBookIndex(id); } catch (e) { return false; }
    return !!(await wait(() => q('#readerPage .masala-block, #readerPage .thamra-item'), 6000));
  }
  const readerBlock = () => qa('#readerPage .masala-block').find((b) => { const r = b.getBoundingClientRect(); return r.top > 90 && r.top < innerHeight - 260 && r.height > 70; }) || firstVis('#readerPage .masala-block');
  const revealTools = (b) => { try { b.classList.add('touched'); } catch (e) {} };
  const tab = async (t) => { try { showTab(t); } catch (e) {} await sleep(450); };
  const searchFor = async (term) => { await tab('search'); const i = $('searchInput'); if (i) { i.value = term; try { doSearch(); } catch (e) {} } await wait(() => firstVis('#searchPage .result-row'), 6000); };
  const libCard = () => qa('#booksPage .lib-card').filter(visible).find((c) => !/(^|\s)0\s*كتاب/.test(c.textContent)) || firstVis('#booksPage .lib-card');

  const TRY = {
    tools: { kind: 'tap', text: 'المس أي مسألة بإصبعك', go: () => toReader(), el: readerBlock },
    copy: { kind: 'long', text: 'أبقِ إصبعك على زر النسخ حتى تظهر الصورة', go: async () => { if (await toReader()) { const b = readerBlock(); if (b) { revealTools(b); await sleep(450); } } }, el: () => { const b = readerBlock(); if (b) revealTools(b); return b && q('.masala-tools button', b); } },
    star: { kind: 'dbl', text: 'اضغط النجمة ضغطتين سريعتين، أو أبقِ إصبعك عليها', go: async () => { if (await toReader()) { const b = readerBlock(); if (b) { revealTools(b); await sleep(450); } } }, el: () => { const b = readerBlock(); if (b) revealTools(b); return b && q('button[title^="إشارة مرجعية"]', b); } },
    select: { kind: 'long', text: 'أبقِ إصبعك على أي كلمة في النص', go: () => toReader(), el: readerBlock },
    hl: { kind: 'dbl', text: 'حدّد كلمة بإصبعك أولاً، ثم اضغط لون التظليل ضغطتين', go: () => toReader(), el: () => { const bar = $('csBar'); if (bar && getComputedStyle(bar).display !== 'none') return firstVis('#csBar .cs-hlbtn'); return readerBlock(); } },
    swipe: { kind: 'swipe', text: 'اسحب على النص بإصبع واحد، يميناً أو يساراً', go: () => toReader(), el: () => $('content') },
    pin: { kind: 'dbl', text: 'اضغط الدبوس ضغطتين لتتبّع هذا الكتاب', go: () => toReader(), el: () => $('readerFabPosition') },
    auto: { kind: 'two', text: 'اسحب على النص بإصبعين نحو الأسفل', go: () => toReader(), el: () => $('content') },
    pinch: { kind: 'two', text: 'باعِد بين إصبعين على النص لتكبّره', go: () => toReader(), el: () => $('content') },
    sbar: { kind: 'tap', text: 'المس الشريط الرفيع على حافة الشاشة أو اسحبه', go: async () => { if (await toReader()) { const c = $('content'); if (c) c.scrollBy(0, 6); try { updateScrollbar(); } catch (e) {} const t = $('scrollbarTrack'); if (t) t.classList.add('active'); } }, el: () => $('scrollbarTrack') },
    toc: { kind: 'tap', text: 'المس اسم الكتاب في الأعلى', go: () => toReader(), el: () => $('pageTitle') },
    words: { kind: 'tap', text: 'المس كلمة مسطّرة أو رقماً صغيراً في النص', go: () => toReader(), el: () => firstVis('#readerPage .gterm') || firstVis('#readerPage sup[onclick^="toggleFootnote"]') },
    flags: { kind: 'tap', text: 'المس العلامة بجانب رقم المسألة', go: () => toReader(), el: () => firstVis('#readerPage .ms-sharh-flag') },
    refSet: { kind: 'tap', text: 'المس زر الإعدادات في أعلى الكتاب', go: () => toReader('urwa'), el: () => { const b = $('urwaSettingsBtn'); return b && visible(b) ? b : null; } },
    swipeS: { kind: 'tap', text: 'افتح أي نتيجة، ثم اسحب على النص', go: () => searchFor('الصلاة'), el: () => firstVis('#searchPage .result-row') },
    presets: { kind: 'tap', text: 'علّم مراجع ثم اضغط «حفظ كاختصار»', go: async () => { await tab('search'); try { toggleSearchFilterPanel(); } catch (e) {} await sleep(450); }, el: () => firstVis('#searchFilterPanel .filter-save-preset-btn') || $('searchFilterToggle') },
    sortref: { kind: 'long', text: 'أبقِ إصبعك على «حسب المرجع»', go: () => searchFor('الصلاة'), el: () => firstVis('#rsSortRow [data-auth]') },
    libhome: { kind: 'dbl', text: 'اضغط اسم المرجع ضغطتين سريعتين', go: () => tab('books'), el: libCard },
    rows: { kind: 'swipe', text: 'اسحب أي صف لليمين فتظهر أزراره', go: async () => { await tab('favorites'); if (!firstVis('#favoritesPage .swipe-row')) await tab('writing'); }, el: () => firstVis('#favoritesPage .swipe-row, #writingPage .swipe-row') },
    libsort: { kind: 'long', text: 'أبقِ إصبعك على أي مرجع', go: () => tab('books'), el: libCard },
    favchips: { kind: 'long', text: 'أبقِ إصبعك على أي لون', go: () => tab('favorites'), el: () => firstVis('#favoritesPage .fav-color-chip[data-fcol]') },
    personal: { kind: 'tap', text: 'اضغط زر + لتنشئ كتاباً خاصاً أو حقيبة', go: () => tab('writing'), el: () => firstVis('#writingPage .psq') },
    tabHome: { kind: 'tap', text: 'المس القسم الحالي في الشريط السفلي', go: async () => { await tab('books'); const c = libCard(); const m = c && (c.getAttribute('onclick') || '').match(/openAuthorBooks\('?(-?\d+)'?\)/); if (m) { try { openAuthorBooks(m[1]); } catch (e) {} await sleep(600); } }, el: () => q('#bottomnav .navitem.active') },
    searchTools: { kind: 'tap', text: 'اضغط «استثناء وتثبيت» في شريط البحث', go: () => tab('search'), el: () => $('searchWordsToggle') },
    jami: { kind: 'tap', text: 'اختر أي باب من أبواب الجامع', go: () => tab('comparison'), el: () => firstVis('#comparisonPage .list-row, #comparisonPage .cmp-tile') },
    swipeC: { kind: 'tap', text: 'افتح أي مسألة، ثم اسحب على النص', go: () => tab('comparison'), el: () => firstVis('#comparisonPage .cmp-card, #comparisonPage [onclick*="openCmpChapter"]') },
    cmpSet: { kind: 'tap', text: 'المس «ترتيب المراجع»', go: () => tab('comparison'), el: () => firstVis('#comparisonPage .cmp-order-btn') }
  };
  RSD.canTry = (id) => !!TRY[id];

  let spot = null;
  function ensureSpot() {
    if (spot) return spot;
    const ring = document.createElement('div'); ring.id = 'dcRing';
    const hand = document.createElement('div'); hand.id = 'dcHand'; hand.innerHTML = '<i class="ti ti-hand-finger"></i>';
    const tip = document.createElement('div'); tip.id = 'dcTip'; tip.setAttribute('role', 'status'); tip.setAttribute('aria-live', 'polite');
    document.body.append(ring, hand, tip);
    tip.addEventListener('click', (e) => { if (e.target.closest('[data-a="x"]')) RSD.stopTry(); });
    spot = { ring, hand, tip, iv: 0, id: null, t0: 0 }; return spot;
  }
  RSD.stopTry = function () {
    if (!spot) return; clearInterval(spot.iv); spot.id = null;
    spot.ring.className = ''; spot.hand.className = ''; spot.tip.classList.remove('show');
    document.removeEventListener('rsd-learned', onLearned);
  };
  function onLearned(e) { if (spot && e.detail === spot.id) { const id = spot.id; setTimeout(() => { if (spot && spot.id === id) RSD.stopTry(); }, 400); } }
  RSD.tryIt = async function (id) {
    const R = TRY[id]; const f = RSD.get(id); if (!R || !f) return;
    const s = ensureSpot(); RSD.stopTry(); s.id = id; s.t0 = Date.now();
    s.tip.innerHTML = `<span class="tp-g">${GK(R.kind === 'swipe' ? 'swipe' : R.kind === 'two' ? 'two' : R.kind, R.kind === 'two' && id === 'pinch' ? 'zoom-in' : undefined)}</span><span class="tp-t">${esc(R.text)}</span><button type="button" data-a="x" aria-label="إغلاق"><i class="ti ti-x"></i></button>`;
    s.tip.classList.add('show');
    let ok = false; try { await R.go(); ok = true; } catch (e) { ok = false; }
    if (s.id !== id) return;
    document.addEventListener('rsd-learned', onLearned);
    const place = () => {
      if (!spot || spot.id !== id) return;
      if (Date.now() - s.t0 > 60000 || busy() && !(RSD.stageOpen && RSD.stageOpen()) && false) { RSD.stopTry(); return; }
      let el = null; try { el = R.el(); } catch (e) {}
      if (!el || !visible(el)) { s.ring.className = ''; s.hand.className = ''; return; }
      const r = el.getBoundingClientRect(); const big = r.width > 120 || r.height > 90;
      const pad = big ? -2 : 6;
      s.ring.style.cssText = `left:${r.left - pad}px;top:${r.top - pad}px;width:${r.width + pad * 2}px;height:${r.height + pad * 2}px;border-radius:${big ? 18 : Math.min(18, r.height / 2 + pad)}px`;
      s.ring.className = 'on k-' + R.kind;
      const cx = r.left + r.width / 2, cy = big ? Math.min(Math.max(r.top + r.height / 2, 200), innerHeight - 220) : r.top + r.height / 2;
      s.hand.style.left = cx + 'px'; s.hand.style.top = cy + 'px'; s.hand.className = 'on k-' + R.kind;
    };
    place(); s.iv = setInterval(place, 350);
  };

  const W = [
    { id: 'tools', kind: 'tap', text: 'المس أي مسألة لتظهر أدواتها: نسخ ونجمة وملاحظة', ok: () => readerActive() && readMs > 5000 && !RSD._toolsTouched },
    { id: 'swipe', kind: 'swipe', text: 'اسحب على النص: يميناً للباب التالي، ويساراً للسابق', ok: () => readerActive() && !srcCtx() && swipeOn() && sectionsCount() > 1 && readMs > 22000 },
    { id: 'swipeS', kind: 'swipe', text: 'اسحب على النص لتنتقل إلى النتيجة التالية أو السابقة', ok: () => readerActive() && srcCtx() && swipeOn() && !inThamra() && readMs > 6000 },
    { id: 'libhome', kind: 'dbl', text: 'ضغطتان على اسم المرجع تفتحان آخر كتاب قرأته عنده', ok: () => activePage() === 'booksPage' && !document.querySelector('.reorder-active-bar') && recentExists() },
    { id: 'pin', kind: 'dbl', text: 'ضغطتان على الدبوس تتبّعان موضعك لتعود إليه من أي كتاب', ok: () => readerActive() && !inThamra() && readMs > 16000 && inView($('readerFabPosition') || document.body, 40, 10) },
    { id: 'auto', kind: 'two', text: 'اسحب بإصبعين على النص فيتحرك الكتاب وحده وأنت تقرأ', ok: () => readerActive() && !inThamra() && readMs > 22000 },
    { id: 'pinch', kind: 'two', icon: 'zoom-in', text: 'باعِد بين إصبعين على النص لتكبّر الخط', ok: () => readerActive() && readMs > 9000 },
    { id: 'swipeC', kind: 'swipe', text: 'اسحب على النص للتنقل بين مسائل الجامع', ok: () => cmpCompare() && swipeOn() },
    { id: 'tabHome', kind: 'tap', text: 'المس أيقونة القسم في الأسفل للعودة إلى بدايته دفعة واحدة', ok: () => (activePage() === 'authorBooksPage' || activePage() === 'customBookPage') && !!q('#bottomnav .navitem.active') }
  ];
  document.addEventListener('rsd-learned', (e) => {
    if (!wCur || e.detail !== wCur) return; const id = wCur; lsSet('rs_dcw_' + id, '9');
    wEl.classList.add('ok'); wEl.innerHTML = '<span class="wh-g"><i class="ti ti-check"></i></span><span class="wh-t">أحسنت، هذه حركتك الآن</span>';
    setTimeout(() => { if (wCur === id) { hideW(); setTimeout(() => wEl && wEl.classList.remove('ok'), 400); } }, 1700);
  });
  function recentExists() { try { const l = JSON.parse(lsGet('rs_recent_reads', '[]')); return Array.isArray(l) && l.length > 0; } catch (e) { return false; } }
  let wEl = null, wTimer = 0, wShown = 0, lastW = 0, wCur = null, since = {}, sessionStart = Date.now();
  const WCAP = 8, WGAP = 9000, WFIRST = 12000;
  function ensureW() {
    if (wEl) return wEl;
    wEl = document.createElement('div'); wEl.id = 'dcWhisper'; wEl.setAttribute('role', 'status'); wEl.setAttribute('aria-live', 'polite'); document.body.appendChild(wEl);
    wEl.addEventListener('click', (e) => {
      const a = e.target.closest('[data-a]'); if (!a || !wCur) return; const id = wCur;
      lsSet('rs_dcw_' + id, '9'); hideW(); if (a.dataset.a === 'show') RSD.play(id);
    });
    return wEl;
  }
  function hideW() { clearTimeout(wTimer); if (wEl) wEl.classList.remove('show'); wCur = null; lastW = Date.now(); }
  function showW(w) {
    const el = ensureW(); wCur = w.id; wShown++;
    lsSet('rs_dcw_' + w.id, String((+lsGet('rs_dcw_' + w.id, '0')) + 1)); wEl && wEl.classList.remove('ok');
    el.innerHTML = `<span class="wh-g">${GK(w.kind === 'swipe' ? 'swipe' : w.kind === 'two' ? 'two' : w.kind, w.icon)}</span><span class="wh-t">${esc(w.text)}</span><button type="button" class="wh-s" data-a="show">أرني</button><button type="button" class="wh-x" data-a="x" aria-label="إغلاق"><i class="ti ti-x"></i></button>`;
    void el.offsetWidth; el.classList.remove('away'); el.classList.add('show');
  }
  document.addEventListener('pointerdown', (e) => { if (wCur && !e.target.closest('#dcWhisper') && Date.now() - lastW > 0) { } }, true);
  function tickW() {
    try {
      if (document.visibilityState === 'visible' && readerActive()) readMs += 1000;
      if (document.visibilityState === 'hidden' || userOff() || !lsGet('rs_dc_welcome', '')) return;
      hookScroll();
      if (wCur) { if (wEl) wEl.classList.toggle('away', !!busy()); return; }
      const now = Date.now();
      if (wShown >= WCAP || now - lastW < (lastW ? WGAP : WFIRST) || now - sessionStart < WFIRST || busy() || now - lastTouch < 1500 || now - lastScroll < 1500 || (spot && spot.id)) return;
      for (const w of W) {
        if (RSD.isDone(w.id) || +lsGet('rs_dcw_' + w.id, '0') >= 2) continue;
        const f = RSD.get(w.id); if (f && f.req && !f.req()) continue;
        let ok = false; try { ok = !!w.ok(); } catch (e) {}
        if (!ok) { since[w.id] = 0; continue; }
        if (!since[w.id]) since[w.id] = now;
        if (now - since[w.id] < 2500) continue;
        since[w.id] = 0; showW(w); return;
      }
    } catch (e) {}
  }

  function peekRows() {
    try {
      if (userOff() || (RSD.ctxOn && !RSD.ctxOn()) || busy() || (spot && spot.id)) return;
      const pg = q('.page.active'); if (!pg) return;
      const key = 'rs_cc_peek_' + pg.id; if (lsGet(key, '') === '1') return;
      const row = qa('.swipe-row', pg).find((r) => { const b = r.getBoundingClientRect(); return b.width > 100 && b.top > 90 && b.bottom < innerHeight - 100; });
      if (!row || Date.now() - lastTouch < 1200) return;
      const c = q('.swipe-content', row); if (!c || !c.animate) return;
      lsSet(key, '1');
      const w = Math.min(160, (parseInt(row.dataset.n, 10) || 2) * 78);
      c.animate([
        { transform: 'translateX(0)', easing: 'cubic-bezier(.45,.05,.2,1)' },
        { transform: `translateX(${w}px)`, offset: .36 },
        { transform: `translateX(${w}px)`, offset: .64, easing: 'cubic-bezier(.45,.05,.2,1)' },
        { transform: 'translateX(0)' }
      ], { duration: 3200, delay: 400, fill: 'none' });
    } catch (e) {}
  }
  let readerSince = 0;
  function peekTools() {
    try {
      if (userOff() || lsGet('rs_dc_peek_tools', '') === '1' || RSD.isDone('tools')) return;
      if (!readerActive()) { readerSince = 0; return; }
      if (!readerSince) { readerSince = Date.now(); return; }
      if (Date.now() - readerSince < 3200 || busy() || Date.now() - lastTouch < 2500 || RSD._toolsTouched) return;
      const b = readerBlock(); if (!b || b.classList.contains('touched')) return;
      lsSet('rs_dc_peek_tools', '1');
      b.classList.add('touched');
      setTimeout(() => { if (!RSD._toolsTouched) b.classList.remove('touched'); }, 1700);
    } catch (e) {}
  }
  setInterval(() => { peekRows(); }, 1000);
  RSD.guideReady = true;
})();
