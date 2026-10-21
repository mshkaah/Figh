(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } };
  const RSV77 = (window.RSV77 = window.RSV77 || {});

  const LABELS = {
    rs_night: 'الوضع الليلي', rs_fontSize: 'حجم الخط', rs_fontFamily: 'نوع الخط', rs_readmode: 'طريقة القراءة',
    rs_navmode: 'الشريط السفلي', rs_navhide: 'إخفاء الشريط عند النزول', rs_library_view: 'شكل المكتبة',
    rs_show_pins: 'إظهار المثبّتة', rs_show_daily: 'إظهار مسألة اليوم', rs_notif_v70: 'التذكيرات',
    rs_pinch: 'التكبير بالأصابع', rs_wake: 'إبقاء الشاشة مضاءة', rs_resume: 'العودة لآخر موضع',
    rs_exitconfirm: 'تأكيد الخروج', rs_swipe_nav: 'السحب بين الأبواب', rs_reduce_motion: 'تقليل الحركة',
    rs_read_pad: 'هوامش القراءة', rs_star_prefs: 'ألوان النجمة', rs_custom_select: 'شريط التحديد',
    rs_sel_pinned: 'أزرار شريط التحديد', rs_wr_bar: 'شريط كتاباتي', rs_look_v68: 'المظهر',
    rs_show_meanings: 'معاني الكلمات', rs_home_rem: 'تذكيرات الرئيسية', rs_xnote_mode: 'عرض الملاحظات', rs_hl_prefs: 'ألوان التظليل', rs_cs_gest: 'إيماءات شريط التحديد', rs_fn_mode: 'الحواشي والتعليقات'
  };
  const LOOK_LABELS = { accent: 'لون التطبيق', bgLight: 'الخلفية', bgDark: 'الخلفية', glow: 'تأثير الضوء', glowK: 'شدة الضوء', lh: 'تباعد الأسطر', justify: 'ضبط النص', auto: 'المظهر التلقائي' };
  const KEYS = Object.keys(LABELS);
  const stack = [];
  const COALESCE = 2500;
  const undoMode = () => (lsGet('rs_undo_mode', 'last') === 'all' ? 'all' : 'last');
  const MAXN = () => (undoMode() === 'all' ? 30 : 1);
  let applying = false;

  const rawSet = Storage.prototype.setItem, rawRemove = Storage.prototype.removeItem;
  const rawGet = Storage.prototype.getItem;

  const settingsOpen = () => {
    const a = $('settingsOverlay'), b = $('advancedSettingsOverlay');
    return !!((a && a.classList.contains('show')) || (b && b.classList.contains('show')));
  };

  function lookLabel(prev, next) {
    let a = {}, b = {};
    try { a = JSON.parse(prev || '{}') || {}; } catch (e) {}
    try { b = JSON.parse(next || '{}') || {}; } catch (e) {}
    const ks = Object.keys(Object.assign({}, a, b)).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
    const names = [...new Set(ks.map((k) => LOOK_LABELS[k] || 'المظهر'))];
    return names.length === 1 ? names[0] : 'المظهر';
  }

  function record(key, next) {
    if (applying || !settingsOpen() || !KEYS.includes(key)) return;
    let prev = null;
    try { prev = rawGet.call(localStorage, key); } catch (e) {}
    if (prev === next) return;
    const now = Date.now(), top = stack[stack.length - 1];
    const label = key === 'rs_look_v68' ? lookLabel(prev, next) : LABELS[key];
    const same = top && top.key === key && (undoMode() === 'last' || now - top.t < COALESCE);
    if (same) { top.t = now; top.label = label; }
    else { if (undoMode() === 'last') stack.length = 0; stack.push({ key, prev, label, t: now }); while (stack.length > MAXN()) stack.shift(); }
    const t2 = stack[stack.length - 1];
    if (t2.key === key && t2.prev === next) stack.pop();
    paintBars();
  }
  Storage.prototype.setItem = function (k, v) {
    if (this === window.localStorage) { try { record(k, String(v)); } catch (e) {} }
    return rawSet.apply(this, arguments);
  };
  Storage.prototype.removeItem = function (k) {
    if (this === window.localStorage) { try { record(k, null); } catch (e) {} }
    return rawRemove.apply(this, arguments);
  };

  function reapply(key) {
    const T = (fn) => { try { fn(); } catch (e) { console.warn('undo reapply', key, e); } };
    switch (key) {
      case 'rs_night':
        T(() => { nightMode = lsGet('rs_night', '0') === '1'; applyTheme(); applyAppearancePrefs(); refreshLookUi(); });
        break;
      case 'rs_look_v68': T(() => { applyAppearancePrefs(); refreshLookUi(); }); break;
      case 'rs_fontSize': T(() => setFontSizeLevel(nearestFontSizeLevel(parseInt(lsGet('rs_fontSize', '17'), 10)))); break;
      case 'rs_fontFamily': T(() => setFontFamily(lsGet('rs_fontFamily', 'font-default'))); break;
      case 'rs_readmode': T(() => setReadMode(lsGet('rs_readmode', 'scroll'))); break;
      case 'rs_navmode': T(() => { applyCompactView(); applyTheme(); }); break;
      case 'rs_navhide': T(() => applyCompactView()); break;
      case 'rs_library_view': T(() => setLibraryViewMode(lsGet('rs_library_view', 'cards'))); break;
      case 'rs_show_pins': case 'rs_show_daily':
        T(() => { if ($('booksPage') && $('booksPage').classList.contains('active')) renderReferencesPage(); applyTheme(); }); break;
      case 'rs_notif_v70': T(() => { notifSyncStore(); notifRefreshUi(); notifSchedule(); }); break;
      case 'rs_read_pad': T(() => RSUI.setReadPad(lsGet('rs_read_pad', '18'))); break;
      case 'rs_wake': case 'rs_pinch': case 'rs_resume': case 'rs_exitconfirm': case 'rs_swipe_nav': case 'rs_reduce_motion':
        T(() => RSUI.applyPrefs()); break;
      case 'rs_custom_select': case 'rs_sel_pinned':
        T(() => { window.RSSelect && RSSelect.refreshPins && RSSelect.refreshPins(); }); break;
      case 'rs_wr_bar': T(() => RSV77.applyWrBar()); break;
      case 'rs_show_meanings': T(() => window.RSV80 && RSV80.applyMeanings()); break;
      case 'rs_home_rem': T(() => window.RSV80 && RSV80.refreshHome()); break;
      case 'rs_xnote_mode': case 'rs_hl_prefs': case 'rs_cs_gest': T(() => { window.RSSelect && RSSelect.refreshPins && RSSelect.refreshPins(); window.RSSelect && RSSelect.apply && RSSelect.apply(); }); break;
      default: break;
    }
    T(() => { if (typeof applyTheme === 'function') applyTheme(); });
    T(() => { if ($('csToggleRow') && window.RSSelect && RSSelect.refreshPins) RSSelect.refreshPins(); });
  }

  RSV77.undoSetting = function () {
    const e = stack.pop(); if (!e) return;
    applying = true;
    try {
      if (e.prev == null) rawRemove.call(localStorage, e.key); else rawSet.call(localStorage, e.key, e.prev);
    } catch (er) {}
    try { reapply(e.key); } finally { applying = false; }
    paintBars();
    try { showGenericToast('تم التراجع عن: ' + e.label); } catch (er) {}
  };

  function paintBars() {
    const top = stack[stack.length - 1];
    document.querySelectorAll('[data-undo-bar]').forEach((bar) => {
      const t = bar.querySelector('.ub-t'), b = bar.querySelector('.ub-b');
      bar.classList.toggle('has', !!top);
      if (t) t.textContent = top ? ('آخر تغيير: ' + top.label + (stack.length > 1 ? ' (+' + RSUI.ar(stack.length - 1) + ' قبله)' : '')) : 'لا تغييرات للتراجع عنها';
      if (b) b.disabled = !top;
    });
  }
  RSV77.paintBars = paintBars;
  RSV77.undoMode = undoMode;
  RSV77.setUndoMode = function (m) {
    try { localStorage.setItem('rs_undo_mode', m === 'all' ? 'all' : 'last'); } catch (e) {}
    while (stack.length > MAXN()) stack.shift();
    paintBars();
    document.querySelectorAll('[data-undo-mode]').forEach((b) => b.classList.toggle('active', b.dataset.undoMode === undoMode()));
  };
  function mountBars() { paintBars(); document.querySelectorAll('[data-undo-mode]').forEach((b) => b.classList.toggle('active', b.dataset.undoMode === undoMode())); }
  function wrapOpen(name) {
    const f = window[name]; if (typeof f !== 'function') return;
    window[name] = function () {
      const r = f.apply(this, arguments);
      mountBars(); paintBars();
      try { RSV77.refreshWrBar(); applyCompactView(); } catch (e) {}
      return r;
    };
  }

  let lastToastBook = null, lastToastAt = 0;
  function bookToast(bookId) {
    try {
      if (typeof isEmbeddedMode !== 'undefined' && isEmbeddedMode) return;
      const b = allBooks.find((x) => x.id === bookId); if (!b) return;
      const now = Date.now();
      if (lastToastBook === bookId && now - lastToastAt < 20000) return;
      lastToastBook = bookId; lastToastAt = now;
      const au = (allAuthors && allAuthors[b.author_id]) || b.author || '';
      if (au) showGenericToast(au);
    } catch (e) {}
  }
  RSV77.bookToast = bookToast;
  function wrapReader(name) {
    const f = window[name]; if (typeof f !== 'function') return;
    window[name] = function (bookId) {
      const r = f.apply(this, arguments);
      bookToast(bookId);
      return r;
    };
  }

  RSV77.wrBar = () => (lsGet('rs_wr_bar', 'fixed') === 'hide' ? 'hide' : 'fixed');
  RSV77.setWrBar = function (m) {
    try { localStorage.setItem('rs_wr_bar', m === 'hide' ? 'hide' : 'fixed'); } catch (e) {}
    RSV77.refreshWrBar(); RSV77.applyWrBar();
  };
  RSV77.refreshWrBar = function () {
    const m = RSV77.wrBar();
    document.querySelectorAll('#wrBarControls button').forEach((b) => b.classList.toggle('active', b.dataset.wrbar === m));
  };
  RSV77.applyWrBar = function () {
    document.body.classList.toggle('wr-bar-hide', RSV77.wrBar() === 'hide');
    if (RSV77.wrBar() !== 'hide') document.body.classList.remove('wr-away');
  };
  let lastTop = 0;
  function onScroll() {
    if (RSV77.wrBar() !== 'hide') return;
    const w = $('writingPage'); if (!w || !w.classList.contains('active') || !w.querySelector('.wr-top')) { document.body.classList.remove('wr-away'); return; }
    const c = $('content'), top = c.scrollTop, d = top - lastTop; lastTop = top;
    const ae = document.activeElement;
    if (ae && ae.isContentEditable && d > 0 && top > 80 && false) return;
    if (d > 8 && top > 60) document.body.classList.add('wr-away');
    else if (d < -10 || top < 30) document.body.classList.remove('wr-away');
  }
  function keepSelection() {
    document.addEventListener('pointerdown', (e) => {
      const b = e.target.closest && e.target.closest('.wr-toolbar button, .wr-toolbar select');
      if (b && b.tagName === 'BUTTON') e.preventDefault();
    }, true);
    document.addEventListener('mousedown', (e) => {
      const b = e.target.closest && e.target.closest('.wr-toolbar button');
      if (b) e.preventDefault();
    }, true);
  }

  function init() {
    wrapOpen('openSettings'); wrapOpen('openAdvancedSettings');
    ['closeSettings', 'closeAdvancedSettings'].forEach((n) => { const f = window[n]; if (typeof f === 'function') window[n] = function () { const r = f.apply(this, arguments); setTimeout(paintBars, 0); return r; }; });
    wrapReader('openReader');
    mountBars();
    RSV77.refreshWrBar(); RSV77.applyWrBar();
    const c = $('content'); if (c) c.addEventListener('scroll', onScroll, { passive: true });
    keepSelection();
    const _sp = window.switchPage;
    if (typeof _sp === 'function') window.switchPage = function () { document.body.classList.remove('wr-away'); return _sp.apply(this, arguments); };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
