(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const ar = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
  const toast = (m) => { try { showGenericToast(m); } catch (e) {} };
  const RSV80 = (window.RSV80 = window.RSV80 || {});

  const meaningsOn = () => lsGet('rs_show_meanings', '1') !== '0';
  RSV80.meaningsOn = meaningsOn;
  RSV80.applyMeanings = function () {
    document.body.classList.toggle('no-meanings', !meaningsOn());
    const t = $('meaningsToggle'); if (t) t.classList.toggle('on', meaningsOn());
  };
  RSV80.toggleMeanings = function () { lsSet('rs_show_meanings', meaningsOn() ? '0' : '1'); RSV80.applyMeanings(); };
  (function guardGlossary() {
    const f = window.openGlossaryPopup;
    if (typeof f === 'function') window.openGlossaryPopup = function () { if (!meaningsOn()) return; return f.apply(this, arguments); };
  })();

  const HR_KEY = 'rs_home_rem';
  const hrMode = () => { const m = lsGet(HR_KEY, 'auto'); return m === 'always' || m === 'never' ? m : 'auto'; };
  let hrOpen = false;
  const remList = () => { try { const a = JSON.parse(lsGet('rs_reminders', '[]')); return (Array.isArray(a) ? a : []).filter((r) => !r.fired).sort((x, y) => x.at - y.at); } catch (e) { return []; } };
  function untilText(ts) {
    const d = ts - Date.now();
    if (d <= 0) return 'الآن';
    const m = Math.round(d / 60000);
    if (m < 1) return 'بعد أقل من دقيقة';
    if (m < 60) return 'بعد ' + (m === 1 ? 'دقيقة' : m === 2 ? 'دقيقتين' : m <= 10 ? ar(m) + ' دقائق' : ar(m) + ' دقيقة');
    const h = Math.round(d / 3600000);
    if (h < 24) return 'بعد ' + (h === 1 ? 'ساعة' : h === 2 ? 'ساعتين' : h <= 10 ? ar(h) + ' ساعات' : ar(h) + ' ساعة');
    const dd = Math.round(d / 86400000);
    return 'بعد ' + (dd === 1 ? 'يوم' : dd === 2 ? 'يومين' : dd <= 10 ? ar(dd) + ' أيام' : ar(dd) + ' يوماً');
  }
  const kindIcon = { f: 'star', n: 'pencil', w: 'writing', b: 'notes', c: 'folders', s: 'highlight' };
  function homeRemHtml() {
    const mode = hrMode(); if (mode === 'never') return '';
    const list = remList();
    if (!list.length && mode !== 'always') return '';
    const next = list[0];
    const sub = next ? 'التالي ' + untilText(next.at) : 'لا توجد تذكيرات';
    const rows = list.length ? list.map((r) => `<div class="hrem-row" onclick="RSV80.openRem('${esc(r.id)}')">
        <span class="hrem-ic"><i class="ti ti-${kindIcon[r.kind] || 'bell'}"></i></span>
        <div class="hrem-main"><b>${esc(r.title || 'عنصر')}</b>${r.sub ? `<small>${esc(r.sub)}</small>` : ''}</div>
        <span class="hrem-left" data-at="${r.at}">${untilText(r.at)}</span>
        <button type="button" class="hrem-x" aria-label="إلغاء التذكير" title="إلغاء التذكير" onclick="event.stopPropagation();RSV80.cancelRem('${esc(r.id)}')"><i class="ti ti-bell-off"></i></button>
      </div>`).join('') : '<div class="hrem-empty">أضف تذكيراً بسحب صف في «المفضلة» أو «شخصي»، أو من شريط تحديد النص.</div>';
    return `<div class="hrem-card ${hrOpen ? 'open' : ''}" id="homeReminders">
      <div class="hrem-head" onclick="RSV80.toggleHome()">
        <span class="hrem-title"><i class="ti ti-bell-ringing"></i> التذكيرات</span>
        <span class="hrem-sub" id="hremSub">${sub}</span>
        ${list.length ? `<span class="hrem-count">${ar(list.length)}</span>` : ''}
        <span class="hrem-chev"><i class="ti ti-chevron-down"></i></span>
      </div>
      <div class="hrem-body">${rows}</div>
    </div>`;
  }
  RSV80.toggleHome = function () {
    hrOpen = !hrOpen;
    const c = $('homeReminders'); if (c) c.classList.toggle('open', hrOpen);
  };
  RSV80.openRem = function (id) { try { rsOpenReminder(id); } catch (e) {} };
  RSV80.cancelRem = function (id) {
    try {
      const list = JSON.parse(lsGet('rs_reminders', '[]')).filter((r) => r.id !== id);
      lsSet('rs_reminders', JSON.stringify(list));
      try { if (self.RSNotif) RSNotif.kvSet('reminders', list); } catch (e) {}
      toast('أُلغي التذكير');
    } catch (e) {}
    RSV80.refreshHome();
  };
  RSV80.refreshHome = function () {
    const page = $('booksPage'); const extras = $('homeExtras');
    if (!extras || !page) return;
    const html = homeRemHtml();
    const cur = $('homeReminders');
    if (!html) { if (cur) cur.remove(); return; }
    const tmp = document.createElement('div'); tmp.innerHTML = html;
    const el = tmp.firstElementChild;
    if (cur) cur.replaceWith(el); else placeHome(extras, el);
  };
  function placeHome(extras, el) {
    const daily = extras.querySelector('.daily-masala-card') || extras.querySelector('.list-row');
    const lib = Array.from(extras.querySelectorAll('.section-header')).find((h) => h.querySelector('.ti-stack-2'));
    if (lib) lib.before(el); else if (daily) daily.after(el); else extras.append(el);
  }
  const _rheh = window.renderHomeExtrasHtml;
  if (typeof _rheh === 'function') window.renderHomeExtrasHtml = function () {
    let html = _rheh.apply(this, arguments);
    try {
      const add = homeRemHtml(); if (!add) return html;
      const marker = '<div class="section-header"><span><i class="ti ti-stack-2">';
      const i = html.indexOf(marker);
      return i >= 0 ? html.slice(0, i) + add + html.slice(i) : html.replace(/<\/div>\s*$/, add + '</div>');
    } catch (e) { return html; }
  };
  RSV80.setHomeRem = function (m) {
    lsSet(HR_KEY, m);
    document.querySelectorAll('[data-hrem]').forEach((b) => b.classList.toggle('active', b.dataset.hrem === hrMode()));
    RSV80.refreshHome();
  };
  const _si = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k) {
    const r = _si.apply(this, arguments);
    if (this === window.localStorage && k === 'rs_reminders') { try { setTimeout(RSV80.refreshHome, 0); } catch (e) {} }
    return r;
  };
  setInterval(() => {
    const now = Date.now();
    const list = remList();
    const stale = document.querySelectorAll('#homeReminders .hrem-left').length !== list.length;
    if (stale) { RSV80.refreshHome(); return; }
    document.querySelectorAll('#homeReminders .hrem-left').forEach((e) => { e.textContent = untilText(+e.dataset.at); });
    const sub = $('hremSub'); if (sub && list[0]) sub.textContent = 'التالي ' + untilText(list[0].at);
  }, 30000);

  function wordRows() { return [$('searchExcludeRow'), $('searchRequireRow')].filter(Boolean); }
  const wordsOpen = () => { const r = wordRows(); return r.length && r.some((x) => x.style.display !== 'none'); };
  window.toggleSearchWordsRows = function (forceClose) {
    const open = forceClose ? false : !wordsOpen();
    if (forceClose) { ['searchExcludeInput', 'searchRequireInput'].forEach((id) => { const i = $(id); if (i) i.value = ''; }); }
    wordRows().forEach((r) => { r.style.display = open ? 'flex' : 'none'; });
    if (open) { const i = $('searchExcludeInput'); if (i) setTimeout(() => i.focus(), 30); }
    updateSearchToolbarState();
  };
  window.toggleSearchExcludeRow = function (forceClose) { if (forceClose) { const i = $('searchExcludeInput'); if (i) i.value = ''; updateSearchToolbarState(); } else toggleSearchWordsRows(); };
  window.toggleSearchRequireRow = function (forceClose) { if (forceClose) { const i = $('searchRequireInput'); if (i) i.value = ''; updateSearchToolbarState(); } else toggleSearchWordsRows(); };
  const _ust = window.updateSearchToolbarState;
  window.updateSearchToolbarState = function () {
    try { if (typeof _ust === 'function') _ust.apply(this, arguments); } catch (e) {}
    const b = $('searchWordsToggle'); if (!b) return;
    const a = $('searchExcludeInput'), c = $('searchRequireInput');
    b.classList.toggle('has', !!((a && a.value.trim()) || (c && c.value.trim())));
    b.classList.toggle('on', !!wordsOpen());
  };

  function fillSlider(el) {
    const min = +el.min || 0, max = +el.max || 100, v = +el.value || 0;
    el.style.setProperty('--p', (((v - min) / (max - min)) * 100).toFixed(1) + '%');
  }
  function fillSliders() { document.querySelectorAll('input[type=range]').forEach(fillSlider); }
  document.addEventListener('input', (e) => { if (e.target && e.target.type === 'range') fillSlider(e.target); }, true);

  RSV80.jump = function (id) {
    const e = $(id); if (!e) return;
    e.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };
  RSV80.undo = function () { try { RSV77.undoSetting(); } catch (e) {} };
  RSV80.syncSettingsUi = function () {
    RSV80.applyMeanings();
    document.querySelectorAll('[data-hrem]').forEach((b) => b.classList.toggle('active', b.dataset.hrem === hrMode()));
    try { RSV77.setUndoMode(RSV77.undoMode()); RSV77.paintBars(); } catch (e) {}
    fillSliders();
  };
  ['openSettings', 'openAdvancedSettings'].forEach((n) => {
    const f = window[n]; if (typeof f !== 'function') return;
    window[n] = function () { const r = f.apply(this, arguments); try { RSV80.syncSettingsUi(); setTimeout(fillSliders, 60); } catch (e) {} return r; };
  });
  function bindChipsSpy() {
    const sheet = $('advancedSettingsSheet'); if (!sheet) return;
    sheet.addEventListener('scroll', () => {
      const secs = sheet.querySelectorAll('.settings-section-title[id]'); let cur = null;
      secs.forEach((s) => { if (s.getBoundingClientRect().top - sheet.getBoundingClientRect().top < 130) cur = s.id; });
      sheet.querySelectorAll('.set-chip').forEach((c) => c.classList.toggle('on', c.dataset.sec === cur));
    }, { passive: true });
  }

  const MASAIL_KEY = 'rs_total_masail';
  function masailCached() { try { const o = JSON.parse(lsGet(MASAIL_KEY, 'null')); if (o && o.v === (typeof EXPECTED_DB_VERSION !== 'undefined' ? EXPECTED_DB_VERSION : '') && o.n > 0) return o.n; } catch (e) {} return 0; }
  function roundApprox(n) { const step = n >= 10000 ? 500 : 100; return Math.round(n / step) * step; }
  function countMasail(done) {
    const books = (typeof allBooks !== 'undefined' ? allBooks : []).filter((b) => { try { return !isThamraBook(b.id); } catch (e) { return true; } });
    let i = 0, total = 0;
    const step = () => {
      const t0 = performance.now();
      while (i < books.length && performance.now() - t0 < 30) {
        try { total += getBookMasalaPool(books[i].id).length; } catch (e) {}
        i++;
      }
      if (i < books.length) setTimeout(step, 0); else done(total);
    };
    step();
  }
  const _oa = window.openAbout;
  if (typeof _oa === 'function') window.openAbout = function () {
    const r = _oa.apply(this, arguments);
    try {
      const box = document.querySelector('#aboutSheet .ab-masail'); if (!box) return r;
      const set = (n) => { box.innerHTML = `<i class="ti ti-list-numbers"></i> نحو <b>${ar(roundApprox(n).toLocaleString('en').replace(/,/g, '\u202F'))}</b> مسألة في كتب التطبيق`; };
      const c = masailCached();
      if (c) set(c); else {
        box.textContent = 'جارٍ حساب عدد المسائل…';
        countMasail((n) => {
          if (n > 0) { lsSet(MASAIL_KEY, JSON.stringify({ v: typeof EXPECTED_DB_VERSION !== 'undefined' ? EXPECTED_DB_VERSION : '', n })); set(n); } else box.remove();
        });
      }
    } catch (e) {}
    return r;
  };


  function jamiHeader() {
    const page = $('comparisonPage'); if (!page || page.querySelector('.jami-credit')) return;
    const h = document.createElement('div'); h.className = 'jami-credit';
    h.innerHTML = '<div class="jc-t">جامع الاستفتاءات</div><div class="jc-s">للشيخ عادل الجوهر</div>';
    page.prepend(h);
  }
  ['renderCmpChaptersList', 'openCmpChapter'].forEach((n) => {
    const f = window[n]; if (typeof f !== 'function') return;
    window[n] = function () { const r = f.apply(this, arguments); try { jamiHeader(); } catch (e) {} return r; };
  });
  const jamiOn = () => { const p = $('comparisonPage'); return !!(p && p.classList.contains('active')); };
  function syncJamiFab() {
    const fab = $('readerFab'); if (!fab) return;
    if (jamiOn()) { fab.classList.add('show'); fab.classList.remove('hidden-scroll'); fab.classList.add('jami-fab'); }
    else if (fab.classList.contains('jami-fab')) { fab.classList.remove('jami-fab'); if (!['readerPage', 'customBookPage'].some((i) => { const e = $(i); return e && e.classList.contains('active'); })) fab.classList.remove('show'); }
  }
  const JPOS = 'rs_cmp_pos';
  const _tocClick = window.readerFabTocClick;
  window.readerFabTocClick = function () {
    if (!jamiOn()) return _tocClick.apply(this, arguments);
    try {
      const d = loadCmpData();
      const rows = d.chapters.filter((c) => cmpVisibleSubjects(d.subjectsByChapter.get(c.id)).length).map((c) =>
        `<div class="list-row" onclick="closeMiniMenu();openCmpChapter(${c.id})"><div class="label">${esc(c.name)}<div class="sub">${ar(cmpVisibleSubjects(d.subjectsByChapter.get(c.id)).length)} مسألة</div></div><i class="ti ti-chevron-left"></i></div>`).join('');
      openMiniMenu('فهرس الجامع', rows);
    } catch (e) {}
  };
  const _posClick = window.handlePositionBtnClick;
  window.handlePositionBtnClick = function () {
    if (!jamiOn()) return _posClick.apply(this, arguments);
    let saved = null; try { saved = JSON.parse(lsGet(JPOS, 'null')); } catch (e) {}
    const here = (typeof cmpNav !== 'undefined' && cmpNav.subjectId) ? cmpNav.subjectId : null;
    let rows = '';
    if (saved && saved.id) rows += `<div class="list-row" onclick="closeMiniMenu();renderCmpComparisonView(${saved.id})"><span><i class="ti ti-map-pin"></i></span><div class="label">الانتقال إلى موضعي المحفوظ<div class="sub">${esc(saved.name || '')}</div></div></div>`;
    if (here) rows += `<div class="list-row" onclick="RSV80.saveJamiPos()"><span><i class="ti ti-bookmark-plus"></i></span><div class="label">حفظ هذه المسألة موضعاً لي</div></div>`;
    if (!rows) rows = '<div class="hrem-empty">افتح مسألة من الجامع ثم اضغط هنا لحفظ موضعك فيها.</div>';
    openMiniMenu('موضعي في الجامع', rows);
  };
  RSV80.saveJamiPos = function () {
    try {
      const sj = loadCmpData().subjectsById.get(cmpNav.subjectId);
      lsSet(JPOS, JSON.stringify({ id: cmpNav.subjectId, name: sj ? sj.name : '' }));
      closeMiniMenu(); toast('حُفظ موضعك في الجامع');
    } catch (e) {}
  };
  setInterval(syncJamiFab, 400);


  window.presetChipPointerDown = function (evt, presetId) {
    const chip = evt.currentTarget || evt.target.closest('.search-preset-chip'); if (!chip) return;
    const row = chip.parentElement; const sx = evt.clientX, sy = evt.clientY;
    presetLongPressFired = false; clearTimeout(presetLongPressTimer);
    let dragging = false, moved = false;
    const chips = () => Array.from(row.querySelectorAll('.search-preset-chip'));
    const onMove = (e) => {
      if (!dragging) { if (Math.hypot(e.clientX - sx, e.clientY - sy) > 12) { clearTimeout(presetLongPressTimer); cleanup(); } return; }
      e.preventDefault(); moved = true;
      chip.style.transform = `translateX(${e.clientX - sx}px)`;
      const me = chip.getBoundingClientRect(), mc = me.left + me.width / 2;
      chips().forEach((o) => {
        if (o === chip) return;
        const r = o.getBoundingClientRect(), c = r.left + r.width / 2;
        const after = o.compareDocumentPosition(chip) & Node.DOCUMENT_POSITION_FOLLOWING;
        if (after && mc > c) { o.after(chip); chip.style.transform = ''; sx2 = e.clientX; }
        else if (!after && mc < c) { o.before(chip); chip.style.transform = ''; sx2 = e.clientX; }
      });
    };
    let sx2 = sx;
    const onUp = () => {
      clearTimeout(presetLongPressTimer);
      if (dragging) {
        chip.classList.remove('dragging'); chip.style.transform = '';
        if (moved) {
          const order = chips().map((c) => c.dataset.presetId);
          const all = getSearchFilterPresets(); const sorted = order.map((id) => all.find((x) => x.id === id)).filter(Boolean);
          if (sorted.length === all.length) saveSearchFilterPresets(sorted);
          renderSearchFilterPresetsRow();
        } else openPresetMenu(presetId);
      }
      cleanup();
    };
    function cleanup() { document.removeEventListener('pointermove', onMove, true); document.removeEventListener('pointerup', onUp, true); document.removeEventListener('pointercancel', onUp, true); }
    document.addEventListener('pointermove', onMove, { capture: true, passive: false });
    document.addEventListener('pointerup', onUp, true); document.addEventListener('pointercancel', onUp, true);
    presetLongPressTimer = setTimeout(() => {
      presetLongPressFired = true; dragging = true; chip.classList.add('dragging');
      try { navigator.vibrate && navigator.vibrate(14); } catch (e) {}
    }, 420);
  };
  function openPresetMenu(presetId) {
    const p = getSearchFilterPresets().find((x) => x.id === presetId); if (!p) return;
    const isFav = lsGet('rs_search_fav_preset', '') === presetId;
    const row = (ic, label, js) => `<div class="list-row" onclick="${js}"><span><i class="ti ti-${ic}"></i></span><div class="label">${label}</div></div>`;
    openMiniMenu(p.name,
      row('pencil', 'تغيير الاسم', `rsPresetRename('${presetId}')`) +
      row('refresh', 'تحديثه بتحديدي الحالي', `rsPresetUpdate('${presetId}')`) +
      row('star', isFav ? 'إلغاء كونه المفضّل' : 'جعله اختصاري المفضّل', `rsSetFavPreset(${isFav ? "''" : `'${presetId}'`})`) +
      row('trash', 'حذف الاختصار', `closeMiniMenu();confirmDeleteSearchFilterPreset('${presetId}')`) +
      '<div class="hrem-empty">لإعادة الترتيب: اضغط مطوّلاً على الاختصار ثم اسحبه.</div>');
  }

  function init() {
    RSV80.applyMeanings();
    bindChipsSpy();
    updateSearchToolbarState();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
