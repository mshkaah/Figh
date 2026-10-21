(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ar = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[+d]);
  const toast = (m) => { try { showGenericToast(m); } catch (e) {} };
  const RSV95 = (window.RSV95 = window.RSV95 || {});
  const CONTACT_URL = 'https://t.me/Mshkaah';
  RSV95.CONTACT_URL = CONTACT_URL;

  let glossChanged = false;
  function glossBooks() { try { return getGlossaryBooksAll(); } catch (e) { return []; } }
  function glossSubText() {
    const all = glossBooks(); if (!all.length) return 'لا توجد كتب معانٍ';
    let off; try { off = getGlossaryOffSet(); } catch (e) { off = new Set(); }
    const on = all.filter((b) => !off.has(b.id)).length;
    if (on === all.length) return 'كل الكتب مفعّلة (' + ar(all.length) + ')';
    if (!on) return 'لا كتاب مفعّل — لن تظهر معانٍ';
    return ar(on) + ' من ' + ar(all.length) + ' مفعّلة';
  }
  function renderGlossRows() {
    const list = $('glossBooksList'); if (!list) return;
    const off = getGlossaryOffSet();
    list.innerHTML = glossBooks().map((b) => {
      const on = !off.has(b.id);
      return `<div class="settings-row gb-row" data-gb="${b.id}" onclick="RSV95.toggleGlossBook(${b.id})">
        <span class="lbl">${esc(b.name)}</span>
        <div class="toggle-switch${on ? ' on' : ''}"><div class="knob"></div></div>
      </div>`;
    }).join('') || '<div class="gb-empty">لا توجد كتب معانٍ في هذه النسخة.</div>';
    const sub = $('glossBooksSub'); if (sub) sub.textContent = glossSubText();
  }
  RSV95.openGlossBooks = function () {
    glossChanged = false;
    renderGlossRows();
    $('glossBooksOverlay').classList.add('show');
  };
  RSV95.toggleGlossBook = function (id) {
    const off = getGlossaryOffSet();
    if (off.has(id)) off.delete(id); else off.add(id);
    setGlossaryOffSet(off);
    glossChanged = true;
    renderGlossRows();
  };
  RSV95.glossAll = function (on) {
    const off = new Set();
    if (!on) glossBooks().forEach((b) => off.add(b.id));
    setGlossaryOffSet(off);
    glossChanged = true;
    renderGlossRows();
  };
  RSV95.closeGlossBooks = function () {
    $('glossBooksOverlay').classList.remove('show');
    if (!glossChanged) return;
    glossChanged = false;
    toast('جارٍ تحديث معاني الكلمات…');
    setTimeout(() => { try { rebuildGlossary(); toast('تم تحديث معاني الكلمات'); } catch (e) { console.warn(e); } const sub = $('glossBooksSub'); if (sub) sub.textContent = glossSubText(); }, 60);
  };

  const AS_SPEEDS = [0, 9, 14, 20, 28, 37, 48, 60, 74, 90, 108, 130, 156, 188, 226, 270];
  const asBtnOn = () => lsGet('rs_as_btn', '1') !== '0';
  const asLevel = () => { const n = parseInt(lsGet('rs_as_speed', '5'), 10); return n >= 1 && n <= 15 ? n : 5; };
  let asRunning = false, asPaused = false, asRaf = 0, asPos = 0, asLast = 0, asSet = 0, asEndAt = 0, asWake = null;

  function asContent() { return $('content'); }
  function asVisiblePage() { const fab = $('readerFab'); return !!(fab && fab.classList.contains('show')); }
  function asBarHtml() {
    return `<button class="as-b as-play" onclick="RSV95.asToggle()" aria-label="إيقاف مؤقت"><i class="ti ti-player-pause"></i></button>
      <button class="as-b" onclick="RSV95.asSpeed(-1)" aria-label="أبطأ"><i class="ti ti-minus"></i></button>
      <span class="as-sp"><b id="asLvl">${ar(asLevel())}</b><small>السرعة</small></span>
      <button class="as-b" onclick="RSV95.asSpeed(1)" aria-label="أسرع"><i class="ti ti-plus"></i></button>
      <button class="as-b as-x" onclick="RSV95.asStop()" aria-label="إنهاء التمرير التلقائي"><i class="ti ti-x"></i></button>`;
  }
  function asBar() {
    let b = $('autoScrollBar');
    if (!b) { b = document.createElement('div'); b.id = 'autoScrollBar'; b.innerHTML = asBarHtml(); document.body.appendChild(b); }
    return b;
  }
  function asSyncUi() {
    const b = $('autoScrollBar'); if (!b) return;
    b.classList.toggle('show', asRunning);
    b.classList.toggle('paused', asPaused);
    const pl = b.querySelector('.as-play i'); if (pl) pl.className = 'ti ' + (asPaused ? 'ti-player-play' : 'ti-player-pause');
    const lv = $('asLvl'); if (lv) lv.textContent = ar(asLevel());
    const fb = $('readerFabAuto'); if (fb) fb.classList.toggle('as-on', asRunning);
    document.body.classList.toggle('as-active', asRunning && !asPaused);
  }
  function asPxPerSec() {
    let k = 1; try { k = Math.max(0.6, Math.min(2.4, (typeof fontSize !== 'undefined' ? fontSize : 17) / 17)); } catch (e) {}
    return AS_SPEEDS[asLevel()] * k;
  }
  async function asWakeOn() { try { if (navigator.wakeLock && !asWake) { asWake = await navigator.wakeLock.request('screen'); asWake.addEventListener('release', () => { asWake = null; }); } } catch (e) { asWake = null; } }
  function asWakeOff() { try { if (asWake) asWake.release(); } catch (e) {} asWake = null; }
  function asFrame(ts) {
    if (!asRunning) return;
    asRaf = requestAnimationFrame(asFrame);
    if (asPaused) { asLast = ts; return; }
    const c = asContent(); if (!c) return;
    if (!asVisiblePage() || document.hidden) { RSV95.asStop(); return; }
    if (!asLast) { asLast = ts; return; }
    const dt = Math.min(64, ts - asLast); asLast = ts;
    if (Math.abs(c.scrollTop - asSet) > 2) asPos = c.scrollTop;
    const max = c.scrollHeight - c.clientHeight;
    asPos = Math.min(max, asPos + asPxPerSec() * dt / 1000);
    const target = Math.round(asPos);
    if (target !== Math.round(c.scrollTop)) { c.scrollTop = target; }
    asSet = c.scrollTop;
    if (max - c.scrollTop <= 2) {
      if (!asEndAt) asEndAt = ts;
      if (ts - asEndAt > 1200) { RSV95.asStop(); toast('وصلت إلى النهاية'); }
    } else asEndAt = 0;
  }
  function asUserTouch(e) {
    if (!asRunning || asPaused) return;
    if (e.target && e.target.closest && e.target.closest('#autoScrollBar, #readerFab')) return;
    asPaused = true; asSyncUi();
  }
  RSV95.asStart = function () {
    if (!asVisiblePage()) return;
    asRunning = true; asPaused = false; asLast = 0; asEndAt = 0;
    const c = asContent(); asPos = c ? c.scrollTop : 0; asSet = asPos;
    asBar(); asSyncUi(); asWakeOn();
    cancelAnimationFrame(asRaf); asRaf = requestAnimationFrame(asFrame);
  };
  RSV95.asStop = function () {
    asRunning = false; asPaused = false; cancelAnimationFrame(asRaf); asWakeOff(); asSyncUi();
  };
  RSV95.asToggle = function () {
    if (!asRunning) { RSV95.asStart(); return; }
    asPaused = !asPaused;
    if (!asPaused) { const c = asContent(); asPos = c ? c.scrollTop : asPos; asSet = asPos; asLast = 0; asEndAt = 0; }
    asSyncUi();
  };
  RSV95.asFab = function () { if (asRunning) RSV95.asStop(); else RSV95.asStart(); };
  RSV95.asSpeed = function (d) {
    const n = Math.max(1, Math.min(15, asLevel() + d));
    lsSet('rs_as_speed', String(n)); asSyncUi(); syncSettings();
  };
  RSV95.setSpeed = function (n) { lsSet('rs_as_speed', String(Math.max(1, Math.min(15, n | 0)))); asSyncUi(); syncSettings(); };
  RSV95.toggleAutoBtn = function () {
    lsSet('rs_as_btn', asBtnOn() ? '0' : '1');
    if (!asBtnOn()) RSV95.asStop();
    syncSettings();
  };
  (function () {
    let g = null;
    const inReader = (t) => !!(t && t.closest && t.closest('#readerPage, #customBookPage') && asVisiblePage());
    document.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2 && inReader(e.target)) {
        const a = e.touches[0], b = e.touches[1];
        g = { d0: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), y0: (a.clientY + b.clientY) / 2, done: false };
      } else g = null;
    }, { passive: true, capture: true });
    document.addEventListener('touchmove', (e) => {
      if (!g || g.done || e.touches.length !== 2) return;
      const a = e.touches[0], b = e.touches[1];
      const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), y = (a.clientY + b.clientY) / 2;
      if (Math.abs(d - g.d0) > 40) { g.done = true; return; }
      const dy = y - g.y0;
      if (dy > 70) { g.done = true; RSV95.asStart(); }
      else if (dy < -70 && asRunning) { g.done = true; RSV95.asStop(); }
    }, { passive: true, capture: true });
    document.addEventListener('touchend', () => { g = null; }, { passive: true, capture: true });
  })();
  ['touchstart', 'wheel', 'mousedown', 'keydown'].forEach((ev) => document.addEventListener(ev, asUserTouch, { passive: true, capture: true }));

  const MUST_TABLES = new Set(); for (let i = 114; i <= 127; i++) MUST_TABLES.add('bk' + i);
  function warnGroup(bookId) {
    try {
      const b = allBooks.find((x) => x.id === bookId); if (!b) return null;
      if (isUrwaBook(bookId)) return 'urwa';
      if (b.bk_table === 'bk_thamra') return 'thamra';
      if (MUST_TABLES.has(b.bk_table) || /مستمسك/.test(b.name || '')) return 'must';
      if (typeof currentSections !== 'undefined' && currentBookId === bookId && (currentSections || []).some((x) => x && x.footnotes && x.footnotes.length)) return 'other';
    } catch (e) {}
    return null;
  }
  const WNOTE = 'حاولنا قدر الإمكان تصحيح الهوامش في هذا الكتاب، وهذا أفضل ما وصلنا إليه. قد يبقى فيها خطأ أو سقط، فراجع المصدر الأصلي قبل الاعتماد عليها. وإن وجدت خطأً فتواصل معنا.';
  const SOFT = WNOTE;
  const WARN = {
    urwa: { cls: 'strong', ic: 'alert-triangle', title: 'تنبيه بخصوص الهوامش', ms: 9000, text: 'هوامش العروة الوثقى استُخرجت بجهد كبير، وحاولنا قدر الإمكان تعديلها وهذا الذي خرجنا به. تبقى عرضة للخطأ والسقط، فلا تعتمد عليها وحدها وراجع المصدر الأصلي قبل العمل بها. وإن وجدت خطأً فتواصل معنا.' },
    thamra: { cls: 'strong', ic: 'alert-triangle', title: 'تنبيه بخصوص الهوامش', ms: 8000, text: 'حاولنا قدر الإمكان تعديل هوامش الثمرة وهذا الذي خرجنا به. قد يبقى فيها خطأ، فراجع المصدر عند الحاجة. وإن وجدت خطأً فتواصل معنا.' },
    must: { cls: 'strong', ic: 'alert-triangle', title: 'تنبيه بخصوص الهوامش', ms: 8000, text: 'هوامش مستمسك العروة استُخرجت بشكل سريع وهي غير دقيقة، وقد يكون فيها خطأ أو سقط. فلا تعتمد عليها وراجع المصدر الأصلي. وإن وجدت خطأً فتواصل معنا.' },
    other: { cls: 'soft', ic: 'info-circle', title: 'ملاحظة', ms: 6500, text: SOFT }
  };
  const seenMap = () => { try { const o = JSON.parse(lsGet('rs_fnwarn_seen', '{}')); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } };
  let warnTimer = 0;
  function hideWarn() {
    const el = $('fnWarn'); if (!el) return;
    el.classList.remove('show'); clearTimeout(warnTimer);
  }
  RSV95.hideWarn = hideWarn;
  function showWarn(group, force) {
    const w = WARN[group]; if (!w) return;
    if (!force && !w.always) { const m = seenMap(); if (m[group]) return; m[group] = 1; lsSet('rs_fnwarn_seen', JSON.stringify(m)); }
    let el = $('fnWarn');
    if (!el) { el = document.createElement('div'); el.id = 'fnWarn'; el.setAttribute('role', 'alert'); document.body.appendChild(el); }
    el.className = 'fnwarn-' + w.cls;
    el.innerHTML = `<div class="fw-card"><div class="fw-ic"><i class="ti ti-${w.ic}"></i></div>
      <b>${esc(w.title)}</b><p>${esc(w.text)}</p>
      <a class="fw-ct" href="${CONTACT_URL}" target="_blank" rel="noopener"><i class="ti ti-brand-telegram"></i> <bdi>t.me/Mshkaah</bdi></a>
      <button class="fw-ok" onclick="RSV95.hideWarn()">حسناً</button>
      <i class="fw-bar" style="animation-duration:${w.ms}ms"></i></div>`;
    el.onclick = (e) => { if (e.target === el) hideWarn(); };
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(warnTimer); warnTimer = setTimeout(hideWarn, w.ms);
  }
  RSV95.previewWarn = (g) => showWarn(g, true);
  RSV95.resetWarns = function () { lsSet('rs_fnwarn_seen', '{}'); toast('ستظهر التنبيهات من جديد عند فتح هذه الكتب'); };
  function hookOpeners() {
    ['openReader', 'openThamraReader'].forEach((name) => {
      const f = window[name]; if (typeof f !== 'function' || f.__v95) return;
      const w = function (bookId) {
        const r = f.apply(this, arguments);
        try { const g = warnGroup(bookId); if (g) setTimeout(() => showWarnOnce(g), 450); } catch (e) {}
        return r;
      };
      w.__v95 = true; window[name] = w;
    });
    const rc = window.renderContinuousReader;
    if (typeof rc === 'function' && !rc.__v100) {
      let lastBook = null;
      const w2 = function (bookId) {
        let wasActive = false;
        try { const rp = $('readerPage'); wasActive = !!(rp && rp.classList.contains('active')); } catch (e) {}
        const entering = !wasActive || bookId !== lastBook;
        const r = rc.apply(this, arguments);
        try {
          lastBook = bookId;
          if (entering) { const g = warnGroup(bookId); if (g && g !== 'other') setTimeout(() => showWarnOnce(g), 450); }
        } catch (e) {}
        return r;
      };
      w2.__v100 = true; window.renderContinuousReader = w2;
    }
  }
  const lastShownAt = {};
  function showWarnOnce(g) { const n = Date.now(); if (lastShownAt[g] && n - lastShownAt[g] < 3500) return; lastShownAt[g] = n; showWarn(g); }
  document.addEventListener('click', (e) => { const el = $('fnWarn'); if (el && el.classList.contains('show') && !e.target.closest('#fnWarn') && e.target.closest('.nav-item, #bottomNav, nav')) hideWarn(); }, true);

  function syncSettings() {
    const sl = $('asSpeedSlider'); if (sl && +sl.value !== asLevel()) sl.value = asLevel();
    const v = $('asSpeedValue'); if (v) v.textContent = ar(asLevel());
    const sub = $('glossBooksSub'); if (sub) sub.textContent = glossSubText();
  }
  RSV95.syncSettings = syncSettings;
  function hookSettings() {
    const f = window.openAdvancedSettings;
    if (typeof f === 'function' && !f.__v95) {
      const w = function () { const r = f.apply(this, arguments); try { syncSettings(); } catch (e) {} return r; };
      w.__v95 = true; window.openAdvancedSettings = w;
    }
  }

  function init() {
    asBar(); hookOpeners(); hookSettings(); syncSettings();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

document.addEventListener('contextmenu', function (e) {
  const t = e.target;
  if (t && t.tagName === 'IMG' && !(t.closest && t.closest('.shr-pv, .shr-big, .sharh-diagram-wrap, #rsShareOv'))) e.preventDefault();
}, true);

(function libLongPressReorder() {
  let timer = 0, sx = 0, sy = 0, fired = false;
  const sel = '#booksPage .lib-card, #booksPage .list-row';
  function cancel() { clearTimeout(timer); timer = 0; }
  function start(e) {
    const t = e.target && e.target.closest ? e.target.closest(sel) : null;
    if (!t || typeof reorderModeActive === 'undefined' || reorderModeActive) return;
    if (e.target.closest('.reorder-active-bar, .pinned-chip, button')) return;
    const p = (e.touches && e.touches[0]) || e;
    sx = p.clientX; sy = p.clientY; fired = false; cancel();
    timer = setTimeout(() => {
      timer = 0; fired = true;
      try { if (navigator.vibrate) navigator.vibrate(15); } catch (er) {}
      try {
        ensureLibraryOrder(); libraryOrderSnapshot = libraryOrder.slice(); reorderModeActive = true;
        renderReferencesPage();
        showGenericToast('وضع الترتيب: اسحب المقبض ثم «حفظ الترتيب»');
      } catch (er) { console.warn('reorder long-press', er); }
    }, 550);
  }
  function move(e) {
    if (!timer) return;
    const p = (e.touches && e.touches[0]) || e;
    if (Math.hypot(p.clientX - sx, p.clientY - sy) > 10) cancel();
  }
  document.addEventListener('touchstart', start, { passive: true, capture: true });
  document.addEventListener('touchmove', move, { passive: true, capture: true });
  document.addEventListener('touchend', cancel, { passive: true, capture: true });
  document.addEventListener('touchcancel', cancel, { passive: true, capture: true });
  document.addEventListener('mousedown', (e) => { if (e.button === 0) start(e); }, true);
  document.addEventListener('mousemove', move, true);
  document.addEventListener('mouseup', cancel, true);
  document.addEventListener('click', (e) => { if (fired) { fired = false; e.stopPropagation(); e.preventDefault(); } }, true);
})();

(function () {
  'use strict';
  const RSV95 = (window.RSV95 = window.RSV95 || {});
  RSV95.clearAllRecents = function () {
    const run = () => {
      ['rs_recent_reads', 'rs_jami_recents', 'rs_thamra_recents'].forEach((k) => { try { localStorage.removeItem(k); } catch (e) {} });
      try { if (typeof showGenericToast === 'function') showGenericToast('تم مسح كل سجل القراءات'); } catch (e) {}
    };
    if (window.RSUI && RSUI.confirm) RSUI.confirm({ title: 'مسح سجل القراءات', msg: 'سيُمسح سجل الكتب والمسائل التي فتحتها. المفضلة والملاحظات لا تتأثر.', yes: 'مسح الكل', no: 'إلغاء', danger: true, onYes: run });
    else run();
  };
})();
