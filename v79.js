(function () {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const FAV = 'rs_search_fav_preset';

  let lastTitle = null;
  const _sp = window.switchPage;
  if (typeof _sp === 'function') window.switchPage = function (id, title) { lastTitle = title; return _sp.apply(this, arguments); };
  function guardTitle() {
    const el = document.getElementById('pageTitle'); if (!el) return;
    new MutationObserver(() => {
      const act = document.querySelector('.page.active');
      if (act && act.id !== 'readerPage' && el.querySelector('.title-sub')) {
        if (lastTitle != null) el.textContent = lastTitle;
        document.body.classList.remove('reading-compact');
      }
    }).observe(el, { childList: true, subtree: true });
  }

  const get = () => getSearchFilterPresets();
  const save = (a) => { saveSearchFilterPresets(a); renderSearchFilterPresetsRow(); };
  const norm = (a) => a.filter((x) => x > 0).sort((x, y) => x - y).join(',');
  function currentIds() {
    try {
      const panel = document.getElementById('searchFilterPanel');
      if (panel && panel.dataset.built) return getCurrentFilterSelectedBookIds();
      return JSON.parse(localStorage.getItem('rs_search_filter_state') || '[]');
    } catch (e) { return []; }
  }
  const _rsfp = window.renderSearchFilterPresetsRow;
  window.renderSearchFilterPresetsRow = function () {
    const r = _rsfp.apply(this, arguments);
    try {
      const cur = norm(currentIds());
      get().forEach((p) => {
        const c = document.querySelector(`#searchFilterPresetsRow .search-preset-chip[data-preset-id="${p.id}"]`);
        if (c) c.classList.toggle('is-active', !!cur && cur === norm(p.bookIds));
      });
      const hint = document.querySelector('#searchFilterPresetsRow .preset-hint');
      if (hint) hint.textContent = 'ضغطة مطوّلة على اختصار: تعديل أو ترتيب أو حذف';
    } catch (e) {}
    return r;
  };
  const _scs = window.saveCurrentSearchFilterState;
  if (typeof _scs === 'function') window.saveCurrentSearchFilterState = function () { const r = _scs.apply(this, arguments); try { renderSearchFilterPresetsRow(); } catch (e) {} return r; };
  const _asp = window.applySearchFilterPreset;
  if (typeof _asp === 'function') window.applySearchFilterPreset = function () { const r = _asp.apply(this, arguments); try { renderSearchFilterPresetsRow(); } catch (e) {} return r; };

  window.rsPresetRename = function (id) {
    closeMiniMenu();
    const p = get().find((x) => x.id === id); if (!p) return;
    openTextPrompt('اسم الاختصار', p.name, (name) => { if (!name || !name.trim()) return; const a = get(); const q = a.find((x) => x.id === id); if (q) { q.name = name.trim(); save(a); } });
  };
  window.rsPresetUpdate = function (id) {
    closeMiniMenu();
    const ids = currentIds();
    if (!ids.length) { showGenericToast('حدّد مرجعاً أو كتاباً أولاً من «المراجع والكتب»'); return; }
    const a = get(), q = a.find((x) => x.id === id); if (!q) return;
    q.bookIds = ids; save(a); showGenericToast('حُدِّث الاختصار بتحديدك الحالي');
  };
  window.rsPresetMove = function (id, d) {
    closeMiniMenu();
    const a = get(), i = a.findIndex((x) => x.id === id), j = i + d; if (i < 0 || j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]]; save(a);
  };
  window.presetChipPointerDown = function (evt, presetId) {
    presetLongPressFired = false; clearTimeout(presetLongPressTimer);
    presetLongPressTimer = setTimeout(() => {
      presetLongPressFired = true;
      try { navigator.vibrate && navigator.vibrate(12); } catch (e) {}
      const a = get(), i = a.findIndex((x) => x.id === presetId); if (i < 0) return;
      const p = a[i], isFav = localStorage.getItem(FAV) === presetId;
      const row = (ic, label, js, off) => `<div class="list-row"${off ? ' style="opacity:.4;pointer-events:none"' : ''} onclick="${js}"><span><i class="ti ti-${ic}"></i></span><div class="label">${label}</div></div>`;
      openMiniMenu(p.name,
        row('pencil', 'تغيير الاسم', `rsPresetRename('${presetId}')`) +
        row('refresh', 'تحديثه بتحديدي الحالي', `rsPresetUpdate('${presetId}')`) +
        row('arrow-right', 'تقديمه (قبل الذي يسبقه)', `rsPresetMove('${presetId}',-1)`, i === 0) +
        row('arrow-left', 'تأخيره (بعد الذي يليه)', `rsPresetMove('${presetId}',1)`, i === a.length - 1) +
        row('star', isFav ? 'إلغاء كونه المفضّل' : 'جعله اختصاري المفضّل', `rsSetFavPreset(${isFav ? "''" : `'${presetId}'`})`) +
        row('trash', 'حذف الاختصار', `closeMiniMenu();confirmDeleteSearchFilterPreset('${presetId}')`));
    }, 550);
  };

  const _onr = window.openNoteResult;
  if (typeof _onr === 'function') window.openNoteResult = function (r) {
    const out = _onr.apply(this, arguments);
    try {
      const words = (lastSearchExact ? [lastSearchNormTerm] : (lastSearchQueryWords || [])).filter(Boolean);
      let n = 0;
      const tick = () => {
        n++;
        const els = document.querySelectorAll('#readerPage .cs-xnote, #readerPage .note-display, #readerPage .note-accordion');
        let first = null;
        els.forEach((e) => { e.classList.add('open'); const m = window.RSMark && RSMark(e, words); if (m && !first) first = m; });
        if (first) first.scrollIntoView({ block: 'center', behavior: 'auto' });
        else if (n < 10) setTimeout(tick, 350);
      };
      setTimeout(tick, 900);
    } catch (e) {}
    return out;
  };

  const boot = () => { try { guardTitle(); renderSearchFilterPresetsRow(); } catch (e) {} };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
