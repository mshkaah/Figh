(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const lsDel = (k) => { try { localStorage.removeItem(k); } catch (e) {} };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const embedded = () => { try { return !!isEmbeddedMode; } catch (e) { return false; } };
  const RSHints = (window.RSHints = window.RSHints || {});

  (function () {
    const V = '106';
    if (lsGet('rs_hints_ver', '') === V) return;
    try {
      const del = [];
      for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && (k.indexOf('rs_hint_') === 0 || k.indexOf('rs_tip_') === 0 || k.indexOf('rs_hg_') === 0)) del.push(k); }
      del.forEach((k) => lsDel(k));
    } catch (e) {}
    lsSet('rs_hints_ver', V);
  })();

  const OFF_KEY = 'rs_hints_off';
  const userOffFlag = () => lsGet(OFF_KEY, '0') === '1';
  const tourFrame = () => /[?&]tour=1/.test(location.search);
  const hintsOff = () => embedded() || lsGet(OFF_KEY, '0') === '1';
  const ROWS = ['rowsFav', 'rowsWrite', 'rowsCb', 'rowsBooks'];
  const sib = (k) => (ROWS.indexOf(k) >= 0 ? ROWS : [k]);
  const learned = (k) => sib(k).some((x) => lsGet('rs_hint_' + x, '') === '1');
  const tipped = (k) => sib(k).some((x) => lsGet('rs_tip_' + x, '') === '1');
  const setTipped = (k) => lsSet('rs_tip_' + k, '1');
  const ALL_KEYS = ['favIntro', 'searchIntro', 'writeIntro', 'libsort', 'star', 'hl', 'copy', 'pin', 'tools', 'swipe', 'swipeS', 'swipeC', 'auto', 'pinch', 'gloss', 'fn', 'sbar', 'rowsFav', 'rowsWrite', 'rowsCb', 'rowsBooks', 'favchips', 'libhome', 'sortref', 'jamiIntro', 'pinGuide', 'sharhFlag', 'refSet', 'searchRes', 'jamiRes', 'tabHome', 'filterGuide', 'persBooks', 'persCols', 'persEdu', 'searchTools', 'jamiIntro'];

  const GK = (k, icon) => (k === 'swipe' || k === 'two')
    ? `<span class="gk k-${k}"><i class="ti ti-${icon || (k === 'swipe' ? 'arrows-horizontal' : 'arrows-vertical')}"></i></span>`
    : `<span class="gk k-${k}"><i></i><i></i></span>`;

  function gest() {
    const d = { copyLong: 'share', starDbl: 1, starLong: 1, hlDbl: 1, hlLong: 1, hlMode: 'tap', starMode: 'tap' };
    try { return Object.assign(d, JSON.parse(lsGet('rs_cs_gest', '{}')) || {}); } catch (e) { return d; }
  }
  function syncConds() {
    const b = document.body; if (!b) return;
    const g = gest();
    b.classList.toggle('gh-off', userOffFlag() || (embedded() && !tourFrame()));
    b.classList.toggle('gh-star-off', !(g.starDbl || g.starLong));
    b.classList.toggle('gh-hl-off', !(g.hlDbl || g.hlLong));
    b.classList.toggle('gh-bcopy-off', g.copyLong === 'off');
    b.classList.toggle('gh-pin-off', inThamra());
    syncDots();
  }
  function markBody() { ALL_KEYS.forEach((k) => { if (learned(k)) document.body.classList.add('hint-' + k + '-used'); }); syncConds(); }
  const GDEF = { star: ['dbl', 'long'], hl: ['dbl', 'long'], copy: ['long'], pin: ['dbl', 'long'], favchips: ['long'], sortref: ['long'], lib: ['dbl', 'long'] };
  function dotsLeft(k) {
    const gs = GDEF[k]; if (!gs) return 0;
    const rec = gs.filter((x) => lsGet('rs_hg_' + k + '_' + x, '') === '1').length;
    return gs.length - rec;
  }
  function enabledGestures(k) {
    const gs = GDEF[k]; if (!gs) return [];
    const g = gest();
    if (k === 'star') return gs.filter((x) => (x === 'dbl' ? g.starDbl : g.starLong));
    if (k === 'hl') return gs.filter((x) => (x === 'dbl' ? g.hlDbl : g.hlLong));
    if (k === 'copy') return g.copyLong === 'off' ? [] : gs.slice();
    return gs.slice();
  }
  function dotsShown(k) {
    return enabledGestures(k).filter((x) => lsGet('rs_hg_' + k + '_' + x, '') !== '1').length;
  }
  function syncDots() {
    const b = document.body; if (!b) return;
    Object.keys(GDEF).forEach((k) => {
      const n = dotsShown(k); if (b.getAttribute('data-d-' + k) !== String(n)) b.setAttribute('data-d-' + k, String(n));
      const m = (enabledGestures(k).length > 0 && n === 0) ? '1' : '0';
      if (b.getAttribute('data-m-' + k) !== m) b.setAttribute('data-m-' + k, m);
    });
  }
  function learnG(k, g) { lsSet('rs_hg_' + k + '_' + g, '1'); learn(k); syncDots(); }
  function learn(k) {
    const gm = { libhome: ['lib', 'dbl'], libsort: ['lib', 'long'] }[k]; if (gm) lsSet('rs_hg_' + gm[0] + '_' + gm[1], '1');
    if (!learned(k)) { sib(k).forEach((x) => { lsSet('rs_hint_' + x, '1'); document.body.classList.add('hint-' + x + '-used'); }); }
    if (cur && cur.key === k) hideTip();
    if (nud && nud.key === k) hideNudge();
    syncDots();
  }

  const WATCH = {
    star: { sel: '.ext-star, button[title^="إشارة مرجعية"], #csBar .cs-starbtn, #csMenu [data-a="star"]:not([data-i])', learnBy: ['dbl', 'long'], ms: 500 },
    hl: { sel: '#csBar .cs-hlbtn, #csMenu [data-a="hl"]:not([data-i])', learnBy: ['dbl', 'long'], ms: 500 },
    copy: { sel: '#csBar button[data-a="copy"], #csMenu button[data-a="copy"], .masala-tools > button:first-child, .ext-tools > button:first-child', learnBy: ['long'], ms: 500 },
    pin: { sel: '#readerFabPosition', learnBy: ['dbl', 'long'], ms: 620 },
    lib: { sel: '#booksPage .lib-card:not(.lib-reorder-row)', learnBy: ['dbl', 'long'], ms: 520 },
    favchips: { sel: '.fav-color-chip[data-fcol]', learnBy: ['long'], ms: 520 },
    sortref: { sel: '#rsSortRow [data-auth]', learnBy: ['long'], ms: 520 }
  };
  const KEYS = Object.keys(WATCH);
  function match(t) {
    if (!t || !t.closest) return null;
    for (const k of KEYS) { const el = t.closest(WATCH[k].sel); if (el) return { key: k, el }; }
    return null;
  }

  function tipSpec(k, el) {
    const g = gest();
    if (k === 'star') {
      const rows = [['tap', 'ضغطة', 'اللون الأول']];
      if (g.starDbl) rows.push(['dbl', 'ضغطتان', 'اللون الثاني']);
      if (g.starLong) rows.push(['long', 'مطوّلة', 'جميع الألوان وتغييرها']);
      return { ic: 'star', t: 'النجمة وحركاتها', rows };
    }
    if (k === 'hl') {
      const rows = [['tap', 'ضغطة', 'اللون الأول']];
      if (g.hlDbl) rows.push(['dbl', 'ضغطتان', 'اللون الثاني']);
      if (g.hlLong) rows.push(['long', 'مطوّلة', 'جميع الألوان']);
      return { ic: 'palette', t: 'التظليل وحركاته', rows };
    }
    if (k === 'copy') {
      const inBar = !!(el && el.closest && el.closest('#csBar, #csMenu'));
      if (inBar && g.copyLong === 'off') return null;
      return { ic: 'share-3', t: 'النسخ والمشاركة كصورة', rows: [['tap', 'ضغطة', 'نسخ النص'], ['long', 'مطوّلة', inBar && g.copyLong === 'plain' ? 'نسخ بلا مصدر' : 'مشاركة كصورة']], sub: inBar && g.copyLong === 'plain' ? '' : 'تتحول المسألة إلى بطاقة صورة تتضمن اسم المرجع والمصدر، جاهزة للإرسال.' };
    }
    if (k === 'pin') return { ic: 'map-pin', t: 'الدبوس وحركاته', rows: [['tap', 'ضغطة', 'مواقعك المحفوظة'], ['dbl', 'ضغطتان', 'تتبّع هذا الكتاب'], ['long', 'مطوّلة', 'كتابان معاً']] };
    if (k === 'lib') return { ic: 'books', t: 'اسم المرجع وحركاته', rows: [['tap', 'ضغطة', 'فتح كتب المرجع'], ['dbl', 'ضغطتان', 'آخر كتاب قُرئ عنده'], ['long', 'مطوّلة', 'ترتيب المكتبة']] };
    if (k === 'favchips') return { ic: 'palette', t: 'ألوان المفضلة', rows: [['tap', 'ضغطة', 'عرض مسائل هذا اللون'], ['long', 'مطوّلة', 'ترتيب الألوان وتسميتها']] };
    if (k === 'sortref') return { ic: 'arrows-sort', t: 'الترتيب بحسب المرجع', rows: [['tap', 'ضغطة', 'جمع النتائج بحسب المرجع'], ['long', 'مطوّلة', 'ترتيب المراجع']] };
    return null;
  }

  let cur = null, tipEl = null, tipTimer = 0, showAt = 0, sessionTips = 0;
  const SESSION_TIP_CAP = 8;
  function ensureTip() {
    if (tipEl && tipEl.isConnected) return tipEl;
    tipEl = document.createElement('div'); tipEl.id = 'rsTip'; tipEl.setAttribute('role', 'status'); tipEl.setAttribute('aria-live', 'polite');
    document.body.appendChild(tipEl); return tipEl;
  }
  function visibleRect(el, x, y) {
    try {
      if (el && el.isConnected) {
        const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
        if (r.width > 4 && r.height > 4 && cs.visibility !== 'hidden' && cs.display !== 'none' && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth) {
          let o = el, ok = true;
          while (o && o !== document.body) { if (getComputedStyle(o).display === 'none') { ok = false; break; } o = o.parentElement; }
          if (ok) return r;
        }
      }
    } catch (e) {}
    return { left: x - 4, right: x + 4, top: y - 4, bottom: y + 4, width: 8, height: 8 };
  }
  function placeTip(el, r, below) {
    const w = el.offsetWidth, h = el.offsetHeight, vw = innerWidth, vh = innerHeight, gap = 13;
    const cx = r.left + r.width / 2;
    const left = clamp(cx - w / 2, 12, Math.max(12, vw - w - 12));
    const above = !below && r.top - h - gap >= 10;
    let top = above ? r.top - h - gap : r.bottom + gap;
    top = clamp(top, 8, Math.max(8, vh - h - 8));
    el.style.left = Math.round(left) + 'px'; el.style.top = Math.round(top) + 'px';
    el.dataset.side = above ? 'above' : 'below';
    const ar = el.querySelector('.gt-ar'); if (ar) ar.style.left = Math.round(clamp(cx - left - 7, 16, w - 30)) + 'px';
  }
  function hideTip() {
    clearTimeout(tipTimer); tipTimer = 0;
    if (tipEl) tipEl.classList.remove('show');
    cur = null;
  }
  function showTip(spec, anchor, x, y, key, ms, below) {
    const el = ensureTip();
    clearTimeout(tipTimer);
    el.classList.remove('show');
    el.innerHTML = `<div class="gt-hd"><i class="ti ti-${esc(spec.ic)}"></i><span>${esc(spec.t)}</span></div>` +
      (spec.rows ? spec.rows.map(([k, l, r]) => `<div class="gt-row">${GK(k)}<b>${esc(l)}</b><span>${esc(r)}</span></div>`).join('') : '') +
      (spec.sub ? `<p class="gt-sub">${esc(spec.sub)}</p>` : '') + '<i class="gt-ar"></i>';
    placeTip(el, visibleRect(anchor, x, y), below);
    void el.offsetWidth;
    el.classList.add('show');
    cur = { key }; showAt = Date.now(); sessionTips++;
    tipTimer = setTimeout(hideTip, ms || 7000);
  }
  RSHints.showTip = function (k) { const spec = tipSpec(k, null); const el = document.querySelector(WATCH[k] && WATCH[k].sel); if (spec) showTip(spec, el, innerWidth / 2, innerHeight / 2, k); };

  document.addEventListener('pointerdown', () => { if (cur && Date.now() - showAt > 350) hideTip(); }, true);
  document.addEventListener('scroll', () => { if (cur && Date.now() - showAt > 700) hideTip(); }, true);

  let lp = null;
  const lastClick = {};
  let tipSched = 0, pendingLib = false;
  setInterval(() => {
    if (!pendingLib || hintsOff() || overlayOpen(true) || activePageId() !== 'booksPage') return;
    pendingLib = false; if (dotsLeft('lib') === 0) return;
    const el = document.querySelector('#booksPage .lib-card:not(.lib-reorder-row)'); const spec = tipSpec('lib', el); if (el && spec) showTip(spec, el, 0, 0, 'lib', 9000, true);
  }, 900);
  document.addEventListener('pointerdown', (e) => {
    const hit = match(e.target); if (!hit || (learned(hit.key) && dotsLeft(hit.key) === 0)) return;
    const w = WATCH[hit.key];
    clearTimeout(lp && lp.t);
    lp = { x: e.clientX, y: e.clientY, t: setTimeout(() => { lp = null; if (w.learnBy.indexOf('long') >= 0) learnG(hit.key, 'long'); }, w.ms) };
  }, true);
  document.addEventListener('pointermove', (e) => { if (lp && Math.hypot(e.clientX - lp.x, e.clientY - lp.y) > 12) { clearTimeout(lp.t); lp = null; } }, true);
  ['pointerup', 'pointercancel'].forEach((ev) => document.addEventListener(ev, () => { if (lp) { clearTimeout(lp.t); lp = null; } }, true));
  document.addEventListener('click', (e) => {
    syncConds();
    const hit = match(e.target); if (!hit) return;
    const k = hit.key, w = WATCH[k]; if (learned(k) && dotsLeft(k) === 0) return;
    const now = Date.now(), prev = lastClick[k];
    if (prev && now - prev.t < 450 && prev.el === hit.el) {
      lastClick[k] = null; clearTimeout(tipSched);
      if (w.learnBy.indexOf('dbl') >= 0) { learnG(k, 'dbl'); return; }
    }
    lastClick[k] = { t: now, el: hit.el };
    if (k === 'lib') return;
    if (dotsLeft(k) === 0 || w.noTip || hintsOff() || (window.RSD && RSD.ctxOn && !RSD.ctxOn())) return;
    const px = e.clientX, py = e.clientY, pg = activePageId();
    clearTimeout(tipSched);
    tipSched = setTimeout(() => {
      if (dotsLeft(k) === 0 || hintsOff() || overlayOpen(true)) return;
      if (activePageId() !== pg) { return; }
      const spec = tipSpec(k, hit.el); if (!spec || spec.rows.length < 2) return;
      showTip(spec, hit.el, px, py, k, 9000);
    }, 650);
  }, true);

  const OVERLAY_SEL = '.rs-ov.show, .rs-sheet-ov.show, #tocOverlay.show, #cbTocOverlay.show, #savedPositionsOverlay.show, #fnWarn.show, #fnNotice, #glossaryOverlay.show, #settingsOverlay.show, #advancedSettingsOverlay.show, #starSheetOverlay.show, #rsShareOv, #miniMenuOverlay.show';
  function overlayOpen(keepBars) {
    if (Date.now() - (window.__fnEnd || 0) < 3500) return true;
    try {
      if (document.querySelector(OVERLAY_SEL)) return true;
      if (!keepBars) {
        const bar = $('csBar'); if (bar && getComputedStyle(bar).display !== 'none') return true;
        const m = $('csMenu'); if (m && getComputedStyle(m).display !== 'none') return true;
      }
      if (document.body.classList.contains('split-active')) return true;
    } catch (e) {}
    return false;
  }
  const activePageId = () => { const p = document.querySelector('.page.active'); return p ? p.id : ''; };
  const inThamra = () => { try { return typeof isThamraBook === 'function' && isThamraBook(currentBookId); } catch (e) { return false; } };
  const readerActive = () => { const p = $('readerPage'); return !!(p && p.classList.contains('active')); };

  let nud = null, nudEl = null, nudTimer = 0, nudSince = 0;
  function ensureNudge() {
    if (nudEl && nudEl.isConnected) return nudEl;
    nudEl = document.createElement('div'); nudEl.id = 'rsNudge'; nudEl.setAttribute('role', 'status'); nudEl.setAttribute('aria-live', 'polite');
    document.body.appendChild(nudEl); return nudEl;
  }
  function hideNudge() { clearTimeout(nudTimer); nudTimer = 0; if (nudEl) nudEl.classList.remove('show'); nud = null; }
  function showNudge(key, glyph, title, sub, extra, ms) {
    const el = ensureNudge();
    el.classList.remove('show');
    el.innerHTML = `<div class="gn-g">${glyph}</div><div class="gn-b"><div class="gt-hd"><span>${esc(title)}</span></div><p class="gt-sub">${esc(sub)}</p>${extra || ''}</div>`;
    void el.offsetWidth; el.classList.add('show');
    nud = { key }; nudSince = Date.now();
    clearTimeout(nudTimer); nudTimer = setTimeout(hideNudge, ms || 6500);
  }

  let ringEl = null, handEl = null;
  function hideRing() { if (ringEl) ringEl.className = ''; }
  function showRing(el, kind) {
    try {
      const r = el.getBoundingClientRect(); if (r.width < 4) return;
      if (!ringEl || !ringEl.isConnected) { ringEl = document.createElement('div'); ringEl.id = 'rsRing'; document.body.appendChild(ringEl); }
      const p = 5;
      ringEl.className = ''; void ringEl.offsetWidth;
      ringEl.style.cssText = `left:${r.left - p}px;top:${r.top - p}px;width:${r.width + p * 2}px;height:${r.height + p * 2}px;border-radius:${Math.min(18, Math.max(10, r.height / 2 + p))}px`;
      ringEl.className = 'on r-' + kind;
    } catch (e) {}
  }
  function hideHand() { if (handEl) { handEl.className = ''; } }
  function glideHand(x1, y, x2, ms) {
    try {
      if (!handEl || !handEl.isConnected) { handEl = document.createElement('div'); handEl.id = 'rsHand'; handEl.innerHTML = '<i class="ti ti-hand-finger"></i>'; document.body.appendChild(handEl); }
      handEl.className = ''; handEl.style.transition = 'none'; handEl.style.left = x1 + 'px'; handEl.style.top = y + 'px'; void handEl.offsetWidth;
      handEl.className = 'on';
      setTimeout(() => { if (!handEl) return; handEl.style.transition = 'left ' + (ms || 800) + 'ms cubic-bezier(.4,.1,.3,1), opacity .25s'; handEl.style.left = x2 + 'px'; }, 120);
    } catch (e) {}
  }
  function tapHand(x, y) {
    try {
      if (!handEl || !handEl.isConnected) { handEl = document.createElement('div'); handEl.id = 'rsHand'; handEl.innerHTML = '<i class="ti ti-hand-finger"></i>'; document.body.appendChild(handEl); }
      handEl.className = ''; handEl.style.transition = 'none'; handEl.style.left = x + 'px'; handEl.style.top = y + 'px'; void handEl.offsetWidth;
      handEl.className = 'on tap';
    } catch (e) {}
  }

  let demo = null, lastEnd = 0, session = 0, lastEndPage = '';
  const SESSION_CAP = 14;
  function endDemo() {
    if (!demo) return;
    const d = demo; demo = null; d.timers.forEach(clearTimeout);
    try { d.clean && d.clean(); } catch (e) {}
    hideRing(); hideHand(); hideTip(); hideNudge(); lastEnd = Date.now(); lastEndPage = activePageId();
  }
  function startDemo(key, fn) {
    setTipped(key); session++;
    const d = { key, page: activePageId(), t0: Date.now(), timers: [], clean: null, at(ms, f) { this.timers.push(setTimeout(() => { if (demo === d) { try { f(); } catch (e) {} } }, ms)); } };
    demo = d;
    try { fn(d); } catch (e) { endDemo(); }
  }
  document.addEventListener('pointerdown', () => { if (demo && Date.now() - demo.t0 > 350) endDemo(); else if (nud && Date.now() - nudSince > 800) hideNudge(); }, true);
  document.addEventListener('scroll', () => { if (demo && demo.noScrollCancel) return; if (demo && Date.now() - demo.t0 > 900) endDemo(); }, true);

  const rowKeyOf = (pid) => ({ favoritesPage: 'rowsFav', writingPage: 'rowsWrite', customBookPage: 'rowsCb' }[pid] || 'rowsBooks');
  const cmpCompare = () => { try { const c = $('comparisonPage'); return !!(c && c.classList.contains('active') && cmpNav && cmpNav.level === 'compare'); } catch (e) { return false; } };
  const srcCtx = () => { try { return !!rsSrcCtx(); } catch (e) { return false; } };
  document.addEventListener('click', (e) => {
    const t = e.target; if (!t || !t.closest) return;
    if (t.closest('#readerPage .masala-block, #customBookPage .masala-block, #readerPage .thamra-item')) learn('tools');
    if (t.closest('.gterm')) learn('gloss');
    if (t.closest('sup[onclick^="toggleFootnote"]')) learn('fn');
  }, true);
  const GL = [
    { k: 'libhome', sel: '#booksPage .lib-card', by: ['dbl'] },
    { k: 'libsort', sel: '#booksPage .lib-card', by: ['long'] },
    { k: 'favchips', sel: '.fav-color-chip[data-fcol]', by: ['long'] },
    { k: 'sortref', sel: '#rsSortRow [data-auth]', by: ['long'] },
    { k: 'sbar', sel: '#scrollbarTrack', by: ['down'] }
  ];
  (function () {
    let t = null; const lc = {};
    const hitsOf = (e) => { const el = e.target && e.target.closest ? e.target : null; const out = []; if (!el) return out; for (const g of GL) { const m = el.closest(g.sel); if (m) out.push({ g, m }); } return out; };
    document.addEventListener('pointerdown', (e) => {
      hitsOf(e).forEach((h) => {
        if (learned(h.g.k)) return;
        if (h.g.by.indexOf('down') >= 0) { learn(h.g.k); return; }
        if (h.g.by.indexOf('long') >= 0) { clearTimeout(t && t.t); t = { x: e.clientX, y: e.clientY, t: setTimeout(() => { t = null; if (GDEF[h.g.k]) learnG(h.g.k, 'long'); else learn(h.g.k); }, 520) }; }
      });
    }, true);
    document.addEventListener('pointermove', (e) => { if (t && Math.hypot(e.clientX - t.x, e.clientY - t.y) > 12) { clearTimeout(t.t); t = null; } }, true);
    ['pointerup', 'pointercancel'].forEach((ev) => document.addEventListener(ev, () => { if (t) { clearTimeout(t.t); t = null; } }, true));
    document.addEventListener('click', (e) => {
      hitsOf(e).forEach((h) => {
        if (learned(h.g.k) || h.g.by.indexOf('dbl') < 0) return;
        const p = lc[h.g.k], n = Date.now();
        if (p && n - p.t < 450 && p.el === h.m) { lc[h.g.k] = null; learn(h.g.k); } else lc[h.g.k] = { t: n, el: h.m };
      });
    }, true);
  })();
  (function () {
    let s = null, d0 = 0;
    const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    document.addEventListener('touchstart', (e) => {
      s = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() } : null;
      d0 = e.touches.length === 2 ? dist(e.touches) : 0;
    }, { passive: true, capture: true });
    document.addEventListener('touchmove', (e) => { if (d0 && e.touches.length === 2 && readerActive() && Math.abs(dist(e.touches) - d0) > 50) { learn('pinch'); d0 = 0; } }, { passive: true, capture: true });
    document.addEventListener('touchend', (e) => {
      if (!s || !e.changedTouches[0]) { s = null; return; }
      const dx = e.changedTouches[0].clientX - s.x, dy = e.changedTouches[0].clientY - s.y, dt = Date.now() - s.t; s = null;
      if (dt > 450 || Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 2) return;
      if (cmpCompare()) learn('swipeC');
      else if (readerActive()) learn(!inThamra() && srcCtx() ? 'swipeS' : 'swipe');
    }, { passive: true, capture: true });
  })();
  function hookAuto() {
    try {
      if (window.RSV95 && typeof RSV95.asStart === 'function' && !RSV95.asStart.__gh) {
        const f = RSV95.asStart;
        RSV95.asStart = function () { learn('auto'); return f.apply(this, arguments); };
        RSV95.asStart.__gh = true;
      }
    } catch (e) {}
  }
  (function () {
    let s = null;
    document.addEventListener('pointerdown', (e) => { s = e.target && e.target.closest && e.target.closest('.swipe-row') ? { x: e.clientX, y: e.clientY } : null; }, true);
    document.addEventListener('pointerup', (e) => { if (s && Math.abs(e.clientX - s.x) > 40 && Math.abs(e.clientX - s.x) > Math.abs(e.clientY - s.y) * 1.4) learn(rowKeyOf(activePageId())); s = null; }, true);
  })();

  let scrollMs = 0, lastScrollT = 0;
  function hookScroll() {
    const c = $('content'); if (!c) return;
    c.addEventListener('scroll', () => {
      if (!readerActive()) return;
      const n = Date.now();
      if (lastScrollT && n - lastScrollT < 1500) scrollMs += n - lastScrollT;
      lastScrollT = n;
    }, { passive: true });
  }
  let lastTouch = 0;
  ['pointerdown', 'touchstart', 'wheel'].forEach((ev) => document.addEventListener(ev, () => { lastTouch = Date.now(); }, { passive: true, capture: true }));

  const autoBarOn = () => { const a = $('autoScrollBar'); return !!(a && a.classList.contains('show')); };
  function sectionsCount() {
    try {
      if (typeof isThamraBook === 'function' && isThamraBook(currentBookId) && typeof currentThamraSections !== 'undefined') return (currentThamraSections || []).length;
      return typeof currentSections !== 'undefined' ? (currentSections || []).length : 0;
    } catch (e) { return 0; }
  }
  function swipeOn() { try { return !!RSUI.pref('swipe'); } catch (e) { return true; } }
  function pinchOn() { try { return !!RSUI.pref('pinch'); } catch (e) { return true; } }
  function firstSeen(root, sel, top, bot) {
    const nodes = (typeof root === 'string' ? document.querySelectorAll(root + ' ' + sel) : root.querySelectorAll(sel));
    for (const n of nodes) { const r = n.getBoundingClientRect(); if (r.width > 6 && r.height > 6 && r.top >= (top == null ? 90 : top) && r.bottom <= innerHeight - (bot == null ? 110 : bot)) return n; }
    return null;
  }
  function firstTouchable(root, sel) {
    const nodes = document.querySelectorAll(root + ' ' + sel);
    for (const n of nodes) { const r = n.getBoundingClientRect(); if (r.height > 30 && r.bottom > 140 && r.top < innerHeight - 160) return n; }
    return null;
  }
  const ic = (n) => `<i class="ti ti-${n}"></i>`;
  const centerY = (r) => clamp((Math.max(r.top, 100) + Math.min(r.bottom, innerHeight - 140)) / 2, 120, innerHeight - 160);

  function shiftContent(d, dx) {
    const c = $('content'); if (!c) return;
    c.style.transition = 'transform .5s cubic-bezier(.3,.7,.3,1)';
    d.clean = () => { try { c.style.transform = ''; setTimeout(() => { c.style.transition = ''; }, 600); } catch (e) {} };
    d.noScrollCancel = true;
    const y = innerHeight * 0.5;
    glideHand(innerWidth * 0.3, y, innerWidth * 0.7, 700);
    d.at(150, () => { c.style.transform = 'translateX(' + dx + 'px)'; });
    d.at(1000, () => { c.style.transform = ''; });
    d.at(1500, () => { c.style.transform = 'translateX(' + (-dx) + 'px)'; glideHand(innerWidth * 0.7, y, innerWidth * 0.3, 700); });
    d.at(2350, () => { c.style.transform = ''; });
  }

  function toolBtnLesson(k, _n, ring) {
    const gate = () => (learned('tools') || tipped('tools')) && readerActive() && !learned(k) && !(k === 'star' && document.body.classList.contains('gh-star-off'));
    return { k, delay: 1500,
      ok() { return gate() && firstTouchable('#readerPage', '.masala-block'); },
      run(b) {
        const sp = tipSpec(k, null); if (!sp) return;
        startDemo(k, (d) => {
          const had = b.classList.contains('touched'); b.classList.add('touched');
          d.clean = () => { if (!had) b.classList.remove('touched'); };
          d.at(450, () => {
            const el = b.querySelector(WATCH[k].sel);
            if (!el || !sp.rows || sp.rows.length < 2) { endDemo(); return; }
            showRing(el, ring); showTip(sp, el, 0, 0, k, k === 'copy' ? 8000 : 5200);
          });
          d.at(k === 'copy' ? 8600 : 5800, endDemo);
        });
      } };
  }

  const LESSONS = [
    { k: 'libhome', delay: 500,
      ok() { const p = $('booksPage'); return p && p.classList.contains('active') && !p.querySelector('.lib-reorder-row, .reorder-active-bar') && libCardWithRecent(); },
      run(card) {
        startDemo('libhome', (d) => {
          showRing(card, 'dbl'); const r = card.getBoundingClientRect(); tapHand(r.left + r.width / 2, r.top + r.height / 2);
          showTip({ ic: 'history', t: 'ارجع إلى آخر كتاب قرأته', sub: 'اضغط اسم المرجع ضغطتين سريعتين فيفتح آخر كتاب قرأته عنده بموضعك بالضبط. وزر الساعة في أعلى الصفحة يعرض آخر كتبك كلها (القراءات السابقة).' }, card, 0, 0, 'libhome', 9000, true);
          d.at(9200, endDemo);
        });
      } },
    { k: 'tools', delay: 900,
      ok() { return readerActive() && firstTouchable('#readerPage', '.masala-block, .thamra-item'); },
      run(b) {
        startDemo('tools', (d) => {
          const r = b.getBoundingClientRect(), cx = r.left + r.width / 2, cy = centerY(r);
          const had = b.classList.contains('touched');
          tapHand(cx, cy + 50); showRing(b, 'tap');
          d.at(700, () => { b.classList.add('touched'); });
          showTip({ ic: 'pointer', t: 'المس أي مسألة', sub: 'فتظهر أدواتها: نسخ، نجمة، ملاحظة، إضافة لكتابي. هي مخفية حتى تلمس المسألة.' }, null, cx, Math.max(r.top, 110) + 4, 'tools', 3000, true);
          d.clean = () => { if (!had) b.classList.remove('touched'); };
          d.at(3600, endDemo);
        });
      } },
    toolBtnLesson('copy', 'copy', 'long'),
    toolBtnLesson('star', 'ext', 'dbl'),
    { k: 'swipe', delay: 2200,
      ok() { return readerActive() && !srcCtx() && swipeOn() && sectionsCount() > 1; },
      run() {
        startDemo('swipe', (d) => {
          showNudge('swipe', '<i class="ti ti-hand-finger gn-swp"></i>', 'اسحب للتنقل بين الأبواب', 'لليمين: الفصل التالي. لليسار: الفصل السابق. بإصبع واحد على النص.', '', 5200);
          shiftContent(d, 40); d.at(5300, endDemo);
        });
      } },
    { k: 'pin', delay: 9000,
      ok() {
        const b = $('readerFabPosition'); if (!b) return false;
        if (!(readerActive() || cmpCompare())) return false;
        if (inThamra()) return false;
        const r = b.getBoundingClientRect(); return r.width > 8 && r.top > 40 && r.bottom < innerHeight - 10 && b;
      },
      run(btn) {
        startDemo('pin', (d) => {
          showRing(btn, 'tap');
          showTip({ ic: 'map-pin', t: 'الدبوس: موقعك بين الكتب', rows: [['tap', 'ضغطة', 'كتبك المتتبَّعة'], ['dbl', 'ضغطتان', 'تتبّع هذا الكتاب'], ['long', 'مطوّلة', 'تقسيم الشاشة']], sub: 'بعد التتبّع تقفز من أي كتاب إلى هذا الكتاب بموضعك بالضبط، من قائمة الضغطة. والمطوّلة تعرض كتابين معاً، أو كتاباً والجامع.' }, btn, 0, 0, 'pin', 11000, false);
          d.at(11200, endDemo);
        });
      } },
    { k: 'swipeS', delay: 1400,
      ok() { return readerActive() && srcCtx() && swipeOn() && !inThamra(); },
      run() {
        let n = '';
        try { n = 'هذه النتيجة ' + (searchResultContext.index + 1) + ' من ' + searchResultContext.results.length + '. '; } catch (e) {}
        startDemo('swipeS', (d) => {
          showNudge('swipeS', '<i class="ti ti-hand-finger gn-swp"></i>', 'تنقّل بين نتائج البحث', n + 'اسحب لليمين: النتيجة التالية. لليسار: السابقة. دون الرجوع للقائمة.', '', 5800);
          shiftContent(d, 40); d.at(5900, endDemo);
        });
      } },
    { k: 'gloss', delay: 1500,
      ok() { return readerActive() && firstSeen('#readerPage', '.gterm', 100, 150); },
      run(el) {
        startDemo('gloss', (d) => {
          const r = el.getBoundingClientRect(); showRing(el, 'tap'); tapHand(r.left + r.width / 2, r.top + r.height / 2);
          showTip({ ic: 'underline', t: 'كلمة مسطّرة = مصطلح فقهي', sub: 'المسها لتعرف معناها.' }, el, 0, 0, 'gloss', 4200);
          d.at(4400, endDemo);
        });
      } },
    { k: 'fn', delay: 1500,
      ok() { return readerActive() && firstSeen('#readerPage', 'sup[onclick^="toggleFootnote"]', 100, 150); },
      run(el) {
        startDemo('fn', (d) => {
          const r = el.getBoundingClientRect(); showRing(el, 'tap'); tapHand(r.left + r.width / 2, r.top + r.height / 2);
          showTip({ ic: 'notes', t: 'رقم الحاشية', sub: 'المسه فيظهر نصها تحت المسألة، والمسه ثانية لإغلاقها.' }, el, 0, 0, 'fn', 4200);
          d.at(4400, endDemo);
        });
      } },
    { k: 'sbar', delay: 400,
      ok() { const t = $('scrollbarTrack'); return readerActive() && scrollMs > 15000 && t && t.getBoundingClientRect().height > 60 && t; },
      run(t) {
        startDemo('sbar', (d) => {
          t.classList.add('active'); d.noScrollCancel = true;
          d.clean = () => { try { t.classList.remove('active'); } catch (e) {} };
          const r = t.getBoundingClientRect();
          showRing(t, 'tap');
          showTip({ ic: 'adjustments-horizontal', t: 'الشريط الجانبي', sub: 'المسه أو اسحبه للانتقال السريع داخل الباب؛ وعند طرفيه ينقلك للباب المجاور.' }, null, r.left + r.width / 2, innerHeight * 0.45, 'sbar', 4800);
          d.at(5000, endDemo);
        });
      } },
    { k: 'auto', delay: 700,
      ok() { return readerActive() && scrollMs > 25000 && !autoBarOn() && !inThamra(); },
      run() {
        startDemo('auto', (d) => {
          showNudge('auto', '<i class="ti ti-hand-two-fingers gn-two"></i>', 'تمرير تلقائي', 'اسحب بإصبعين على النص، للأعلى أو للأسفل، فيتحرك الكتاب وحده نحو الأسفل.', '', 6200);
          d.noScrollCancel = true;
          const c = $('content');
          if (c) { d.at(900, () => { c.scrollBy({ top: 70, behavior: 'smooth' }); }); d.at(2200, () => { c.scrollBy({ top: 70, behavior: 'smooth' }); }); d.at(3500, () => { c.scrollBy({ top: 70, behavior: 'smooth' }); }); }
          d.at(6300, endDemo);
        });
      } },
    { k: 'pinch', delay: 700,
      ok() { return readerActive() && scrollMs > 45000 && pinchOn() && !autoBarOn(); },
      run() {
        startDemo('pinch', (d) => {
          showNudge('pinch', '<i class="ti ti-zoom-in gn-two"></i>', 'كبّر الخط بإصبعين', 'باعد بين إصبعين على النص لتكبّره، وقرّبهما لتصغّره.', '', 5800);
          d.at(5900, endDemo);
        });
      } },
    { k: 'swipeC', delay: 1500,
      ok() { return cmpCompare() && swipeOn(); },
      run() {
        startDemo('swipeC', (d) => {
          const y = innerHeight * 0.5; glideHand(innerWidth * 0.3, y, innerWidth * 0.7, 700);
          showNudge('swipeC', '<i class="ti ti-hand-finger gn-swp"></i>', 'اسحب للتنقل بين المسائل', 'لليمين: المسألة التالية. لليسار: السابقة. وإن فتحتها من نتائج بحث الجامع فالتقليب بين النتائج نفسها.', '', 5200);
          d.at(5300, endDemo);
        });
      } }
  ];

  function libCardWithRecent() {
    try {
      const list = JSON.parse(lsGet('rs_recent_reads', '[]')); if (!Array.isArray(list) || !list.length) return null;
      const ids = new Set();
      list.forEach((e) => { const bk = allBooks.find((b) => b.id === e.bookId); if (bk) ids.add(String(bk.author_id)); });
      const cards = document.querySelectorAll('#booksPage .lib-card');
      for (const c of cards) {
        const oc = (c.getAttribute('onclick') || '') + ' ' + ((c.querySelector('[onclick]') || {}).getAttribute ? (c.querySelector('[onclick]').getAttribute('onclick') || '') : '');
        const m = oc.match(/openAuthorBooks\(\s*'?(-?\w+)'?\s*\)/); if (!m) continue;
        const r = c.getBoundingClientRect();
        if (ids.has(m[1]) && r.width > 6 && r.top >= 70 && r.bottom <= innerHeight - 120) return c;
      }
    } catch (e) {}
    return null;
  }
  function introLesson(k, pid, cond, spec) {
    return { k, delay: 1200,
      ok() {
        const p = $(pid); if (!p || !p.classList.contains('active')) return false;
        if (!cond()) return false;
        return p.getBoundingClientRect().width > 0 && p;
      },
      run() {
        startDemo(k, (d) => {
          showTip(spec, null, innerWidth / 2, innerHeight * 0.4, k, 9000, true);
          const ar = $('rsTip') && $('rsTip').querySelector('.gt-ar'); if (ar) ar.style.display = 'none';
          d.at(9200, endDemo);
        });
      } };
  }
  function flagLesson(k, sel, spec) {
    return { k, delay: 1200,
      ok() { return readerActive() && firstSeen('#readerPage', sel, 100, 150); },
      run() {
        const el = firstSeen('#readerPage', sel, 100, 150); if (!el) return;
        startDemo(k, (d) => {
          showRing(el, 'tap');
          showTip(spec, el, 0, 0, k, 7000, true);
          d.at(7200, endDemo);
        });
      } };
  }
  function rowLesson(k, pid, extra) {
    return { k, delay: 800,
      ok() {
        const p = $(pid); if (!p || !p.classList.contains('active')) return false;
        if (p.querySelector('.reorder-active-bar, .pin-edit-mode')) return false;
        if (k === 'rowsBooks' && !(activePageId() === 'booksPage' || activePageId() === 'authorBooksPage')) return false;
        const row = firstSeen(p, '.swipe-row', 70, innerHeight * 0.2);
        return row && row.querySelector('.swipe-content') && row;
      },
      run(row) {
        startDemo(k, (d) => {
          const r = row.getBoundingClientRect(), c = row.querySelector('.swipe-content');
          const labels = Array.prototype.map.call(row.querySelectorAll('.swipe-btn span'), (s) => s.textContent.trim()).filter(Boolean);
          const w = 72, y = r.top + r.height / 2;
          let sub = labels.length ? 'تظهر أزراره: ' + labels.join('، ') + '.' : 'تظهر أزراره.';
          if (labels.indexOf('تذكير') >= 0) sub += ' «تذكير» يرسل لك إشعاراً بهذه المسألة في الوقت الذي تختاره.';
          if (extra) sub += ' ' + extra;
          c.style.transition = 'transform .45s cubic-bezier(.3,.7,.3,1)';
          d.noScrollCancel = true;
          d.clean = () => { try { c.style.transform = ''; setTimeout(() => { c.style.transition = ''; }, 500); } catch (e) {} };
          glideHand(r.left + r.width * 0.3, y, r.left + r.width * 0.3 + 90, 600);
          d.at(250, () => { c.style.transform = 'translateX(' + w + 'px)'; });
          showTip({ ic: 'arrows-horizontal', t: 'اسحب الصف لليمين', sub }, row, r.left + r.width / 2, r.bottom, k, 7200, true);
          d.at(3600, () => { c.style.transform = ''; hideHand(); });
          d.at(7300, endDemo);
        });
      } };
  }
  LESSONS.push(
    rowLesson('rowsFav', 'favoritesPage', 'يمكنك حذف المسألة من المفضلة أيضاً من نفس الأزرار.'),
    rowLesson('rowsWrite', 'writingPage'),
    rowLesson('rowsCb', 'customBookPage'),
    rowLesson('rowsBooks', 'booksPage'),
    rowLesson('rowsBooks', 'authorBooksPage'),
    { k: 'favchips', delay: 700,
      ok() { const p = $('favoritesPage'); return p && p.classList.contains('active') && firstSeen(p, '.fav-color-chip[data-fcol]', 60, innerHeight * 0.4); },
      run(chip) {
        startDemo('favchips', (d) => {
          showRing(chip, 'long'); const r = chip.getBoundingClientRect(); tapHand(r.left + r.width / 2, r.top + r.height / 2);
          showTip({ ic: 'palette', t: 'ألوان المفضلة', rows: [['tap', 'ضغطة', 'تصفية بهذا اللون'], ['long', 'مطوّلة', 'ترتيب الألوان وتسميتها']] }, chip, 0, 0, 'favchips', 5200, true);
          d.at(5400, endDemo);
        });
      } },
    { k: 'libsort', delay: 1100,
      ok() { const p = $('booksPage'); return p && p.classList.contains('active') && !p.querySelector('.lib-reorder-row, .reorder-active-bar') && firstSeen(p, '.lib-card', 70, 120); },
      run(card) {
        startDemo('libsort', (d) => {
          showRing(card, 'long'); const r = card.getBoundingClientRect(); tapHand(r.left + r.width / 2, r.top + r.height / 2);
          showTip({ ic: 'layout-grid', t: 'اضغط مطوّلاً على أي مرجع', sub: 'لتدخل وضع ترتيب المكتبة وتحرّك المراجع كما تحب.' }, card, 0, 0, 'libsort', 5600, true);
          d.at(5800, endDemo);
        });
      } },
    introLesson('favIntro', 'favoritesPage', () => !$('favoritesPage').querySelector('.swipe-row'),
      { ic: 'star', t: 'هنا تجتمع مسائلك المنجَّمة', sub: 'نجّم أي مسألة أثناء القراءة فتظهر هنا مفرزة بألوانها. اسحب صفها لليمين لحذفها أو لتذكيرك بها بإشعار، واضغط اللون مطوّلاً لترتيب الألوان وتسميتها.' }),
    flagLesson('sharhFlag', '.ms-sharh-flag', { ic: 'book-2', t: 'لهذه المسألة شرح', sub: 'الأيقونة الزرقاء بجانب رقم المسألة تعني أن لها شرحاً، نصاً أو فيديو.' }),
    { k: 'refSet', delay: 1800,
      ok() {
        if (readerActive()) { const b = $('urwaSettingsBtn'); if (b && b.style.display !== 'none') { const r = b.getBoundingClientRect(); if (r.width > 8 && r.top > 40 && r.bottom < innerHeight - 20) return b; } return false; }
        if (cmpCompare() || ($('comparisonPage') && $('comparisonPage').classList.contains('active'))) return firstSeen($('comparisonPage'), '.cmp-order-btn', 60, 120);
        return false;
      },
      run(btn) {
        const inCmp = !!(btn.closest && btn.closest('#comparisonPage'));
        startDemo('refSet', (d) => {
          showRing(btn, 'tap');
          showTip({ ic: 'adjustments', t: inCmp ? 'رتّب المراجع كما تحب' : 'هوامش المراجع بيدك', sub: inCmp ? 'قدّم من تثق بمرجعه، أخفِ من لا تريد، ولوّن من تريد تمييزه. ينطبق على كل مسائل الجامع.' : 'رتّب أولوية ظهور المراجع داخل الهوامش، أخفِ من لا تريد، ولوّن من تريد تمييزه. الزر نفسه في العروة والثمرة.' }, btn, 0, 0, 'refSet', 8000, true);
          d.at(8200, endDemo);
        });
      } },
    { k: 'searchRes', delay: 900,
      ok() {
        const p = $('searchPage'); if (!p || !p.classList.contains('active')) return false;
        return firstSeen(p, '.result-row', 120, 140);
      },
      run(row) {
        startDemo('searchRes', (d) => {
          showRing(row, 'tap');
          showTip({ ic: 'list-search', t: 'افتح نتيجة ثم قلّب', sub: 'بعد فتح أي نتيجة اسحب يميناً للنتيجة التالية ويساراً للسابقة، دون الرجوع إلى القائمة. وتحت النتائج زر «حسب المرجع» لجمعها بحسب المراجع.' }, row, 0, 0, 'searchRes', 9000, true);
          d.at(9200, endDemo);
        });
      } },
    { k: 'jamiRes', delay: 900,
      ok() {
        const p = $('comparisonPage'); if (!p || !p.classList.contains('active') || cmpCompare() || !swipeOn()) return false;
        return firstSeen(p, '.cmp-res', 120, 140);
      },
      run(row) {
        startDemo('jamiRes', (d) => {
          showRing(row, 'tap');
          showTip({ ic: 'list-search', t: 'قلّب بين مسائل نتائج الجامع', sub: 'افتح مسألة ثم اسحب يميناً للتالية ويساراً للسابقة، وزر الرجوع يعيدك إلى النتائج كما تركتها.' }, row, 0, 0, 'jamiRes', 8500, true);
          d.at(8700, endDemo);
        });
      } },
    { k: 'tabHome', delay: 1500,
      ok() {
        const pg = activePageId(); if (pg !== 'authorBooksPage' && pg !== 'customBookPage') return false;
        const nv = document.querySelector('#bottomnav .navitem.active'); if (!nv) return false;
        const r = nv.getBoundingClientRect(); return r.width > 10 && nv;
      },
      run(nv) {
        const lb = (nv.querySelector('.label') || {}).textContent || 'القسم';
        startDemo('tabHome', (d) => {
          showRing(nv, 'tap');
          showTip({ ic: 'arrow-bar-up', t: 'ارجع للبداية بلمسة', sub: 'المس «' + lb.trim() + '» في الشريط السفلي مرة ثانية للعودة إلى أول صفحة في هذا القسم، بدل الرجوع خطوة خطوة.' }, nv, 0, 0, 'tabHome', 7500, false);
          d.at(7700, endDemo);
        });
      } },
    { k: 'sortref', delay: 1000,
      ok() { const p = $('searchPage'); return p && p.classList.contains('active') && firstSeen(p, '#rsSortRow [data-auth]', 60, 120); },
      run(chip) {
        startDemo('sortref', (d) => {
          showRing(chip, 'long'); const r = chip.getBoundingClientRect(); tapHand(r.left + r.width / 2, r.top + r.height / 2);
          showTip({ ic: 'arrows-sort', t: 'حسب المرجع', rows: [['tap', 'ضغطة', 'جمع النتائج بحسب المرجع'], ['long', 'مطوّلة', 'ترتيب المراجع كما تريد']] }, chip, 0, 0, 'sortref', 5600, true);
          d.at(5800, endDemo);
        });
      } }
  );

  const since = {};
  function tick() {
    try {
      if (document.visibilityState === 'hidden' || hintsOff()) return;
      if (demo && demo.page !== activePageId()) endDemo();
      if ((cur || nud || demo) && overlayOpen(true)) { endDemo(); hideTip(); hideNudge(); }
      if (demo || cur || nud) return;
      const now = Date.now();
      if (session >= SESSION_CAP || now - lastEnd < (activePageId() !== lastEndPage ? 4500 : 13000) || overlayOpen(false) || now - lastTouch < 700 || now - lastScrollT < 700) return;
      for (const L of LESSONS) {
        if (learned(L.k) || tipped(L.k)) continue;
        let info = false; try { info = L.ok(); } catch (e) {}
        if (!info) { since[L.k] = 0; continue; }
        if (!since[L.k]) since[L.k] = now;
        if (now - since[L.k] < L.delay) continue;
        since[L.k] = 0;
        L.run(info); return;
      }
    } catch (e) {}
  }

  function hookPinSheet() {
    const f = window.openSavedPositionsList; if (typeof f !== 'function' || f.__gh) return;
    const card = (k, t, d) => `<div class="gh-pc">${GK(k)}<div><b>${t}</b><span>${d}</span></div></div>`;
    const w = function () {
      const r = f.apply(this, arguments);
      try {
        const sheet = $('savedPositionsSheet'); if (!sheet) return r;
        let foot = $('ghPinFoot'); if (foot) foot.remove();
        const has = !!sheet.querySelector('.saved-pos-row');
        foot = document.createElement('div'); foot.id = 'ghPinFoot';
        if (inThamra()) { sheet.appendChild(foot); foot.innerHTML = '<div class="gh-fr"><span>التتبّع وتقسيم الشاشة غير متاحين في هذا الكتاب.</span></div>'; return r; }
        const cnt = +lsGet('rs_pinguide_n', '0') + 1; lsSet('rs_pinguide_n', String(cnt)); if (cnt > 1 || lsGet('rs_cc_share', '') === '1') { foot.remove(); return r; }
        const first = false;
        if (first) {
          foot.className = 'gh-full';
          foot.innerHTML = `<div class="gh-ph"><i class="ti ti-map-pin"></i> الدبوس: ثلاث حركات من زر واحد</div>
            ${card('tap', 'ضغطة: هذه القائمة', 'تعرض كل كتاب تتبّعته (والجامع)، وبلمسة على أي صف تقفز إليه بموضعك بالضبط. اضغط الصف مطوّلاً لإيقاف تتبّعه.')}
            ${card('dbl', 'ضغطتان: ابدأ التتبّع', 'اضغط الدبوس ضغطتين متتاليتين داخل أي كتاب فيُحفظ موضعك فيه تلقائياً أثناء القراءة. ثم من أي كتاب آخر افتح هذه القائمة واختر ذلك الكتاب لتنتقل إليه فوراً، وتعود لما كنت تقرؤه بنفس الطريقة. ويظهر حول الدبوس إطار ملوّن حين يكون الكتاب متتبَّعاً.')}
            ${card('long', 'مطوّلة: قسّم الشاشة', 'أبقِ إصبعك على الدبوس فتنقسم الشاشة نافذتين، فتقرأ كتابين معاً، أو كتاباً والجامع، أو تقارن بين مسألتين. كل نافذة مستقلة بتمريرها وموضعها.')}
            <button type="button" class="gx-reset gh-ok" onclick="RSHints.learn('pinGuide');var e=document.getElementById('ghPinFoot');if(e){e.className='';}openSavedPositionsList()"><i class="ti ti-check"></i> حسناً، لا تُظهرها ثانيةً هنا</button>`;
        } else {
          foot.innerHTML = `<div class="gh-fr">${GK('dbl')}<span><b>ضغطتان</b> على الدبوس: تتبّع موضعك في هذا الكتاب</span></div>
            <div class="gh-fr">${GK('long')}<span><b>مطوّلة</b> على الدبوس: تقسيم الشاشة إلى نافذتين</span></div>` +
            (has ? `<div class="gh-fr">${GK('long')}<span><b>مطوّلة</b> على موقع: إيقاف تتبّعه</span></div>` : '');
        }
        sheet.appendChild(foot);
      } catch (e) {}
      return r;
    };
    w.__gh = true; window.openSavedPositionsList = w;
  }

  function guideCard(key, ic, title, items) {
    return `<div class="gh-card" data-gk="${key}"><button type="button" class="gh-card-x" aria-label="إغلاق" onclick="RSHints.dismissCard('${key}')"><i class="ti ti-x"></i></button><div class="gh-card-h"><i class="ti ti-${ic}"></i><b>${esc(title)}</b></div>` +
      items.map((t) => `<p>${t}</p>`).join('') + `</div>`;
  }
  RSHints.dismissCard = function (k) {
    learn(k);
    document.querySelectorAll('.gh-card[data-gk="' + k + '"]').forEach((c) => { c.classList.add('out'); setTimeout(() => c.remove(), 220); });
  };
  function hookCards() {
    const bf = window.buildSearchFilterPanel;
    if (typeof bf === 'function' && !bf.__gh) {
      const w = function () {
        const r = bf.apply(this, arguments);
        try {
          const panel = $('searchFilterPanel');
          if (panel && !hintsOff() && !learned('filterGuide') && !panel.querySelector('.gh-card')) {
            panel.insertAdjacentHTML('afterbegin', guideCard('filterGuide', 'filter', 'اختر المراجع التي تريد نتائجها فقط', [
              'علّم المراجع والكتب التي تريد البحث فيها، وألغِ ما لا تريد نتائجه، فيقتصر البحث عليها.',
              'ثم اضغط <b>«حفظ كاختصار»</b> وسمِّه (مثلاً «مسائل الحج»): يظهر لك زر بهذا الاسم تحت خانة البحث، تطبّق به هذا الاختيار بضغطة واحدة. واضغطه مطوّلاً لتغيير اسمه أو حذفه.'
            ]));
          }
        } catch (e) {}
        return r;
      };
      w.__gh = true; window.buildSearchFilterPanel = w;
    }
    const sp = window.openSaveFilterPresetPrompt;
    if (typeof sp === 'function' && !sp.__gh) { const w2 = function () { try { learn('filterGuide'); } catch (e) {} return sp.apply(this, arguments); }; w2.__gh = true; window.openSaveFilterPresetPrompt = w2; }
    const rw = window.renderWritingPage;
    if (typeof rw === 'function' && !rw.__gh) {
      const w3 = function () {
        const r = rw.apply(this, arguments);
        try {
          const pg = $('writingPage'); if (!pg || hintsOff()) return r;
          const tab = (typeof personalState !== 'undefined' && personalState.tab) || 'books';
          const key = tab === 'books' ? 'persBooks' : tab === 'cols' ? 'persCols' : tab === 'edu' ? 'persEdu' : '';
          if (!key || learned(key)) return r;
          const top = pg.querySelector('.personal-top'); if (!top) return r;
          const html = tab === 'books'
            ? guideCard('persBooks', 'notes', 'الكتاب الخاص: مجموعتك من المسائل', [
              'أنشئ كتاباً بزر <b>+</b> في الأعلى وسمّه. ثم أثناء القراءة المس أي مسألة واضغط أيقونة <b>«إضافة لكتابي»</b> فتنضم إليه، وتفتحه من هنا لتقرأ ما جمعته وترتّبه.',
              'اسحب صف الكتاب لتغيير اسمه أو حذفه.'
            ])
            : tab === 'edu'
            ? guideCard('persEdu', 'chalkboard', 'السبورة: دروسك في مكان واحد', [
              'ابدأ درساً بزر <b>+</b> ثم اكتب وارسم وأدرج نصوصاً من الكتب، أو سجّل شرحك بالفيديو.',
              'اسحب صف الدرس لتغيير اسمه أو تصديره أو حذفه.'
            ])
            : guideCard('persCols', 'folder', 'الحقيبة: مجلد لما تحتاجه معاً', [
              'الحقيبة تجمع مراجع وكتباً (رسمية أو خاصة) تحت اسم واحد لتصل إليها سريعاً. أنشئها بزر <b>+</b> ثم ادخلها واضغط زر الإضافة أسفل الصفحة لتختار ما تضمّه إليها.',
              'اسحب صفها لتغيير اسمها أو حذفها.'
            ]);
          top.insertAdjacentHTML('afterend', html);
        } catch (e) {}
        return r;
      };
      w3.__gh = true; window.renderWritingPage = w3;
    }
  }

  const CH = (k, label, res, icon) => `<span class="gx-c">${GK(k, icon)}<span>${esc(label)}${res ? ` <em>· ${esc(res)}</em>` : ''}</span></span>`;
  const SHEET = [
    { sec: 'أثناء القراءة' },
    { ic: 'pointer', t: 'المس أي مسألة', d: 'تظهر أدواتها: نسخ، نجمة، ملاحظة، إضافة لكتابي. هي مخفية حتى تلمس المسألة.', g: [['tap', 'لمسة على المسألة']] },
    { ic: 'share-3', t: 'شارك كصورة بدل أن تنسخ', d: 'اضغط زر «نسخ» مطوّلاً في أدوات المسألة أو في شريط التحديد، فتتحوّل المسألة إلى بطاقة صورة أنيقة باسم المرجع والمصدر، جاهزة للإرسال.', g: [['long', 'مطوّلة على زر «نسخ»', 'مشاركة']] },
    { ic: 'star', t: 'النجمة: ثلاثة ألوان من زر واحد', d: 'ضغطة تنجّم بلونك الأول، وضغطتان بالثاني، والمطوّلة تفتح كل الألوان لتختار وتغيّر لوني الضغطة والضغطتين. والمفضلة تفرز مسائلك بحسب اللون.', g: [['tap', 'ضغطة', 'اللون الأول'], ['dbl', 'ضغطتان', 'اللون الثاني'], ['long', 'مطوّلة', 'كل الألوان']] },
    { ic: 'palette', t: 'التظليل: ثلاثة ألوان من زر واحد', d: 'في شريط التحديد (حدّد نصاً أولاً). نفس حركات النجمة.', g: [['tap', 'ضغطة', 'اللون الأول'], ['dbl', 'ضغطتان', 'اللون الثاني'], ['long', 'مطوّلة', 'كل الألوان']] },
    { ic: 'highlight', t: 'حدّد نصاً', d: 'اضغط مطوّلاً على كلمة ثم اسحب المقبضين. يظهر شريط فيه نسخ وتظليل، و«⋯» لبقية الخيارات (نجمة، ملاحظة، كتابي، تذكير، مشاركة).', g: [['long', 'مطوّلة على كلمة']] },
    { ic: 'arrows-horizontal', t: 'اسحب للتنقل بين الأبواب', d: 'بإصبع واحد على النص. السحب لليمين يأخذك إلى الفصل التالي، ولليسار إلى السابق.', g: [['swipe', 'لليمين', 'التالي'], ['swipe', 'لليسار', 'السابق']] },
    { ic: 'list-search', t: 'التقليب بين نتائج البحث', d: 'افتح نتيجة من البحث ثم اسحب بنفس الطريقة: ينقلك إلى النتيجة التالية أو السابقة دون الرجوع للقائمة. وعند الرجوع تجد القائمة كما تركتها.', g: [['swipe', 'لليمين', 'النتيجة التالية'], ['swipe', 'لليسار', 'السابقة']] },
    { ic: 'map-pin', t: 'الدبوس العائم', d: 'الزر الذي في أسفل القارئ. ضغطة: قائمة كل ما تتبّعته من كتب فتنتقل إليها بموضعك. ضغطتان: تتبّع الكتاب الحالي (يظهر عليه إطار ملوّن)، فتصل إليه سريعاً من أي كتاب. مطوّلة: تقسيم الشاشة لقراءة كتابين معاً أو كتاب والجامع.', g: [['tap', 'ضغطة', 'مواقعي المحفوظة'], ['dbl', 'ضغطتان', 'تتبّع هذا الكتاب'], ['long', 'مطوّلة', 'تقسيم الشاشة']] },
    { ic: 'hand-two-fingers', t: 'تمرير تلقائي', d: 'اسحب بإصبعين على النص، للأعلى أو للأسفل، فيتحرك الكتاب وحده نحو الأسفل. لمسة بإصبع واحد تُوقفه مؤقتاً، وسرعته من الإعدادات الإضافية.', g: [['two', 'سحب بإصبعين', 'يبدأ']] },
    { ic: 'zoom-in', t: 'كبّر الخط بإصبعين', d: 'باعد بين إصبعين على النص أو قرّبهما، في القراءة وفي الجامع. يمكن إيقافه من الإعدادات.', g: [['two', 'باعِد أو قرّب', '', 'zoom-in']] },
    { ic: 'adjustments-horizontal', t: 'الشريط الجانبي', d: 'الشريط الرفيع الذي يظهر على حافة الشاشة أثناء التمرير: المسه أو اسحبه للانتقال السريع داخل الباب، وعند طرفيه ينقلك إلى الباب المجاور.', g: [['tap', 'لمس أو سحب']] },
    { ic: 'list', t: 'المس اسم الكتاب في الأعلى', d: 'يفتح فهرس الكتاب. وفي الفهرس خانة بحث داخل هذا الكتاب وحده.', g: [['tap', 'لمسة']] },
    { ic: 'underline', t: 'الكلمة المسطّرة والرقم [١]', d: 'الكلمة المسطّرة مصطلح فقهي: المسها لمعناه. ورقم الحاشية بين قوسين يفتح نصها تحت المسألة، والمسه ثانية لإغلاقها.', g: [['tap', 'لمسة']] },
    { ic: 'eraser', t: 'المس نصاً مظلّلاً أو منجَّماً', d: 'يظهر شريط فيه إزالة التظليل أو النجمة أو عرض الملاحظة.', g: [['tap', 'لمسة']] },
    { ic: 'book-2', t: 'أيقونة الشرح', d: 'الأيقونة الزرقاء بجانب رقم المسألة تعني أن لها شرحاً (نصاً أو فيديو). المسها لتفتحه.', g: [['tap', 'لمسة على الأيقونة']] },
    { ic: 'adjustments', t: 'هوامش المراجع وترتيبهم', d: 'زر الإعدادات في أعلى القارئ (في العروة والثمرة) و«ترتيب المراجع» في الجامع: قدّم من تثق بمرجعه، أخفِ من لا تريد، ولوّن من تريد تمييزه.', g: [['tap', 'لمسة على الزر']] },
    { sec: 'في الجامع' },
    { ic: 'search', t: 'ابحث داخل الجامع', d: 'خانة البحث أعلى الجامع. افتح نتيجة ثم اسحب يميناً للنتيجة التالية ويساراً للسابقة، وزر الرجوع يعيدك إلى النتائج كما تركتها.', g: [['swipe', 'لليمين', 'النتيجة التالية'], ['swipe', 'لليسار', 'السابقة']] },
    { ic: 'map-pin', t: 'دبوس الجامع', d: 'مثل أي كتاب تماماً: ضغطة تفتح قائمة المواقع، وضغطتان تتبّعان موضعك في الجامع، ومطوّلة تقسم الشاشة. وكل موضع يعود إلى سطره بالضبط.', g: [['tap', 'ضغطة', 'القائمة'], ['dbl', 'ضغطتان', 'تتبّع'], ['long', 'مطوّلة', 'تقسيم الشاشة']] },
    { ic: 'users', t: 'قفزة سريعة إلى مرجع', d: 'صف الأسماء فوق الأجوبة: المس اسم مرجع فتنزل إليه مباشرة. مرّر الصف نفسه يمنة ويسرة دون أن ينتقل بك إلى مسألة أخرى.', g: [['tap', 'لمسة على الاسم']] },
    { sec: 'في البحث' },
    { ic: 'bookmarks', t: 'اختصارات البحث', d: 'بعد ضبط «المراجع والكتب» احفظه كاختصار فيظهر زر باسمه. اضغط عليه مطوّلاً لتغيير اسمه أو ترتيبه أو جعله المفضّل أو حذفه.', g: [['long', 'مطوّلة على الاختصار', 'قائمته']] },
    { ic: 'arrows-sort', t: 'ترتيب النتائج بالمرجع', d: 'تحت كل بحث زر «حسب المرجع» يجمع النتائج بحسب المراجع. اضغط عليه مطوّلاً لترتيب المراجع كما تريد.', g: [['long', 'مطوّلة على «حسب المرجع»']] },
    { sec: 'في المكتبة والقوائم' },
    { ic: 'history', t: 'ضغطتان سريعتان على اسم مرجع', d: 'في المكتبة أو المثبّتة: تفتح آخر كتاب قرأته عند هذا المرجع بموضعك بالضبط. وزر الساعة في الأعلى يعرض آخر كتبك كلها.', g: [['dbl', 'ضغطتان على المرجع', 'آخر كتاب قرأته']] },
    { ic: 'folder', t: 'الكتاب الخاص والحقيبة', d: 'في «شخصي»: الكتاب الخاص يجمع المسائل التي تضيفها إليه من القراءة بأيقونة «إضافة لكتابي»، والحقيبة (المجلد) تجمع مراجع وكتباً تحتاجها معاً. كلاهما يُنشأ بزر + ويُعدَّل اسمه أو يُحذف بسحب صفه.', g: [['tap', 'زر +', 'إنشاء']] },
    { ic: 'layout-grid', t: 'رتّب مكتبتك والمثبّتات', d: 'على أي مرجع في المكتبة تدخل وضع الترتيب، وعلى أي بطاقة مثبّتة تدخل وضع الترتيب والحذف.', g: [['long', 'مطوّلة']] },
    { ic: 'arrow-bar-both', t: 'اسحب الصف', d: 'في المفضلة تظهر «حذف» و«تذكير» (إشعار يذكّرك بالمسألة في الوقت الذي تختاره)، وفي «شخصي» تغيير الاسم والحذف. وكل قائمة تُسحب صفوفها بنفس الطريقة.', g: [['swipe', 'لليمين', 'أزرار الصف']] },
    { ic: 'palette', t: 'ألوان المفضلة', d: 'في المفضلة اضغط لوناً مطوّلاً (أو زر «ترتيب وتسمية») لترتيب الألوان وإعطائها أسماءً تخصك.', g: [['long', 'مطوّلة على اللون']] },
    { ic: 'settings-search', t: 'ابحث في الإعدادات', d: 'في أعلى الإعدادات (والإضافية) خانة بحث: اكتب ما تريده، مثل «خط» أو «سحب» أو «لون»، فتقفز إلى الخيار وتضيئه.', g: [['tap', 'اكتب في الخانة']] },
    { ic: 'arrow-bar-up', t: 'العودة لبداية القسم', d: 'المس أيقونة القسم الذي أنت فيه في الشريط السفلي، فيرجع إلى أول صفحة فيه بدل أن تضغط رجوع مرات.', g: [['tap', 'لمسة على القسم الحالي']] }
  ];
  function disabledNote(r) {
    try {
      const g = gest(); let n = '';
      if (r.t.indexOf('اسحب للتنقل') === 0 || r.t.indexOf('التقليب') === 0) n = RSUI.pref('swipe') ? '' : 'السحب بين الأبواب';
      else if (r.t.indexOf('كبّر') === 0) n = RSUI.pref('pinch') ? '' : 'التكبير بالأصابع';
      else if (r.t.indexOf('النجمة') === 0) n = (g.starDbl || g.starLong) && g.starMode === 'tap' ? '' : 'حركات النجمة';
      else if (r.t.indexOf('التظليل') === 0) n = (g.hlDbl || g.hlLong) && g.hlMode === 'tap' ? '' : 'حركات التظليل';
      else if (r.t.indexOf('شارك') === 0) n = g.copyLong === 'off' ? 'الضغطة المطوّلة على نسخ' : '';
      return n ? `<div class="gx-off"><i class="ti ti-adjustments-off"></i> معطّلة حالياً في إعداداتك (${esc(n)}). تُفعَّل من الإعدادات.</div>` : '';
    } catch (e) { return ''; }
  }
  function sheetHtml() {
    const off = hintsOff();
    const rows = SHEET.map((r) => r.sec
      ? `<div class="gx-sec">${esc(r.sec)}</div>`
      : `<div class="gx-row"><div class="gx-ic"><i class="ti ti-${r.ic}"></i></div><div class="gx-b"><h4>${esc(r.t)}</h4><p>${esc(r.d)}</p><div class="gx-ch">${r.g.map((c) => CH(c[0], c[1], c[2], c[3])).join('')}</div>${disabledNote(r)}</div></div>`).join('');
    let xb = ''; try { xb = RSUI.xBtn(); } catch (e) {}
    return `<h3><span class="pp-back" onclick="closeHelp()"><i class="ti ti-arrow-right"></i></span> الإيماءات والاختصارات${xb}</h3>
      <p class="gx-lead">أزرار كثيرة في التطبيق لها حركات لا تظهر على الشاشة. الزر الذي عليه نقطة <span class="gx-dot"></span> فيه حركة مخفية؛ المسه مرة وستظهر لك تلميحة. وهذه الحركات كلها في مكان واحد، مرتّبة بالأهمية.</p>
      <div class="gx-key"><span>${GK('tap')} ضغطة</span><span>${GK('dbl')} ضغطتان سريعتان</span><span>${GK('long')} مطوّلة: أبقِ إصبعك نصف ثانية</span><span>${GK('swipe')} سحب</span></div>
      ${rows}
      <div class="gx-sec">جولات تعريفية</div>
      <p class="gx-lead" style="margin-top:0">كل قسم يعرّفك بنفسه مرة واحدة عند أول فتح. أعد أي جولة متى شئت:</p>
      <div class="gx-tours">${(window.RSTour && RSTour.list || []).map(([id, n]) => `<button type="button" class="gx-tour" onclick="RSTour.replay('${id}')"><i class="ti ti-player-play"></i>${esc(n)}</button>`).join('')}</div>
      <div class="gx-foot">
        <div class="settings-row" onclick="RSHints.toggleOff()" role="button" tabindex="0"><span class="lbl">إظهار النقاط والتلميحات<small>أطفئها إن كنت تعرف الحركات</small></span><div class="toggle-switch${off ? '' : ' on'}"><div class="knob"></div></div></div>
        <button type="button" class="gx-reset" onclick="RSHints.reset()"><i class="ti ti-restore"></i> أعِد إظهار التلميحات من البداية</button>
      </div>`;
  }
  function rerenderSheet() {
    const s = $('helpSheet'); if (!s) return;
    const y = s.scrollTop; s.innerHTML = sheetHtml(); s.scrollTop = y;
  }
  RSHints.toggleOff = function () {
    lsSet(OFF_KEY, hintsOff() ? '0' : '1');
    endDemo(); hideTip(); hideNudge(); syncConds(); rerenderSheet();
  };
  RSHints.reset = function () {
    ALL_KEYS.forEach((k) => { lsDel('rs_hint_' + k); lsDel('rs_tip_' + k); document.body.classList.remove('hint-' + k + '-used'); });
    Object.keys(GDEF).forEach((k) => GDEF[k].forEach((g) => lsDel('rs_hg_' + k + '_' + g)));
    ['select', 'toc', 'sharhFlag', 'refSet', 'cmpSet'].forEach((k) => lsDel('rs_hint_' + k));
    lsSet(OFF_KEY, '0'); sessionTips = 0; session = 0; scrollMs = 0;
    syncConds(); rerenderSheet();
    try { showGenericToast('ستظهر التلميحات من جديد'); } catch (e) {}
  };
  RSHints.isLearned = learned;
  RSHints.learn = learn;
  RSHints.learnG = learnG;
  RSHints.dotsLeft = dotsLeft;
  RSHints.sheetHtml = sheetHtml;
  RSUI.helpHtml = sheetHtml;
  window.RSHints = RSHints;

  const SEEN = 'rs_seen_v79';
  const seen = () => { try { return JSON.parse(lsGet(SEEN, '{}')) || {}; } catch (e) { return {}; } };
  const markSeen = (k) => { const s = seen(); if (!s[k]) { s[k] = 1; lsSet(SEEN, JSON.stringify(s)); } refreshDots(); };
  function rowOf(k) { return k === 'help' ? document.querySelector('#settingsSheet .settings-link-row[onclick^="openHelp"]') : k === 'about' ? document.querySelector('#settingsSheet .settings-link-row[onclick^="openAbout"]') : $('installRow'); }
  function refreshDots() {
    const s = seen(); let any = false;
    ['help', 'about', 'install'].forEach((k) => {
      const row = rowOf(k); if (!row) return;
      const hidden = k === 'install' && row.style.display === 'none';
      const unseen = !s[k] && !hidden;
      if (unseen) any = true;
      let d = row.querySelector('.sl-dot');
      if (unseen && !d) { d = document.createElement('span'); d.className = 'sl-dot'; d.setAttribute('aria-label', 'جديد — افتحه'); const go2 = row.querySelector('.sl-go'); if (go2) row.insertBefore(d, go2); else row.appendChild(d); }
      if (!unseen && d) d.remove();
    });
    const g = $('toolsBtn'); if (g) g.classList.toggle('has-dot', any);
  }
  function wrap(name, key) {
    const f = window[name]; if (typeof f !== 'function') return;
    window[name] = function () { markSeen(key); return f.apply(this, arguments); };
  }

  function init() {
    markBody(); hookAuto(); hookScroll(); hookPinSheet();
    wrap('openHelp', 'help'); wrap('openAbout', 'about');
    if (window.RSUI && RSUI.install) { const oi = RSUI.install; RSUI.install = function () { markSeen('install'); return oi.apply(this, arguments); }; }
    const _os = window.openSettings;
    if (typeof _os === 'function') window.openSettings = function () { const r = _os.apply(this, arguments); setTimeout(refreshDots, 0); setTimeout(syncConds, 0); return r; };
    setTimeout(refreshDots, 400);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
