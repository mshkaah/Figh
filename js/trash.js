(function () {
  'use strict';
  const TKEY = 'rs_trash', DAYS = 30, MAX = 120;
  const KINDS = {
    rs_favorites: { type: 'fav', label: 'مفضلة', id: (x) => (x.kind || 'm') + '|' + x.bookId + '|' + x.sectionIdx + '|' + x.masalaNum, name: (x) => x.title || x.bookName || 'مسألة' },
    rs_notes: { type: 'note', label: 'ملاحظة', id: (x) => (x.kind || 'm') + '|' + x.bookId + '|' + x.sectionIdx + '|' + x.masalaNum, name: (x) => x.title || (x.text || '').slice(0, 40) || 'ملاحظة' },
    rs_custom_books: { type: 'book', label: 'كتاب', id: (x) => x.id, name: (x) => x.name || 'كتاب' },
    rs_collections: { type: 'col', label: 'مجموعة', id: (x) => x.id, name: (x) => x.name || 'مجموعة' },
    rs_writings: { type: 'wr', label: 'كتابة', id: (x) => x.id, name: (x) => x.title || (x.text || '').trim().slice(0, 40) || 'كتابة' }
  };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rawGet = Storage.prototype.getItem, rawSet = Storage.prototype.setItem;
  const readTrash = () => { try { const a = JSON.parse(rawGet.call(localStorage, TKEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
  function writeTrash(a) { try { rawSet.call(localStorage, TKEY, JSON.stringify(a)); } catch (e) {} updateRow(); }

  Storage.prototype.setItem = function (k, v) {
    if (this === localStorage && KINDS[k]) {
      try {
        const kd = KINDS[k];
        const oldArr = JSON.parse(rawGet.call(localStorage, k) || '[]'), newArr = JSON.parse(v || '[]');
        if (Array.isArray(oldArr) && Array.isArray(newArr) && oldArr.length) {
          const alive = new Set(newArr.map(kd.id));
          const gone = oldArr.filter((x) => x && !alive.has(kd.id(x)));
          if (gone.length) {
            const now = Date.now(), cut = now - DAYS * 86400000;
            const t = readTrash().filter((e) => e.t > cut);
            gone.forEach((item) => t.unshift({ t: now, k, id: kd.id(item), name: kd.name(item), item }));
            writeTrash(t.slice(0, MAX));
          }
        }
      } catch (e) {}
    }
    return rawSet.apply(this, arguments);
  };

  function restore(i) {
    const t = readTrash(), e = t[i]; if (!e) return;
    const kd = KINDS[e.k], item = e.item;
    try {
      if (e.k === 'rs_favorites') { if (!favorites.some((x) => kd.id(x) === e.id)) favorites.push(item); localStorage.setItem('rs_favorites', JSON.stringify(favorites)); }
      else if (e.k === 'rs_notes') { if (!notes.some((x) => kd.id(x) === e.id)) notes.push(item); saveNoteStorage(); }
      else if (e.k === 'rs_custom_books') { if (!customBooks.some((x) => x.id === item.id)) customBooks.push(item); saveCustomBooks(); }
      else if (e.k === 'rs_collections') { if (!collections.some((x) => x.id === item.id)) collections.push(item); saveCollections(); }
      else if (e.k === 'rs_writings') { if (!freeWritings.some((x) => x.id === item.id)) freeWritings.push(item); saveWritingsStorage(); }
      if (e.k !== 'rs_favorites' && e.k !== 'rs_notes') { try { ensureLibraryOrder(); saveLibraryOrder(); } catch (er) {} }
    } catch (er) { showGenericToast('تعذّر الاسترجاع'); return; }
    t.splice(i, 1); writeTrash(t);
    showGenericToast('تم الاسترجاع');
    openTrash();
    try { renderFavoritesPage(); } catch (er) {}
    try { renderWritingPage(); } catch (er) {}
    try { renderHomeExtras(); } catch (er) {}
  }
  window.rsRestoreTrash = (i) => restore(i);
  window.rsDeleteTrashItem = (i) => { const t = readTrash(); t.splice(i, 1); writeTrash(t); openTrash(); };
  window.rsEmptyTrash = () => openConfirmDialog('تفريغ المحذوفات نهائياً؟', () => { writeTrash([]); try { closeMiniMenu(); } catch (e) {} });

  function openTrash() {
    const cut = Date.now() - DAYS * 86400000;
    const t = readTrash().filter((e) => e.t > cut);
    let html;
    if (!t.length) html = '<div class="empty-state" style="padding:22px 10px;">لا شيء هنا.<br>ما تحذفه يبقى هنا ٣٠ يوماً ثم يُمحى.</div>';
    else {
      html = t.map((e, i) => `<div class="list-row" onclick="rsRestoreTrash(${i})"><span style="font-size:20px;"><i class="ti ti-arrow-back-up"></i></span>
        <div class="label">${esc(e.name)}<small>${esc(KINDS[e.k].label)} · ${esc(relativeTimeAr(e.t))} · اضغط للاسترجاع</small></div></div>`).join('');
      html += '<div class="list-row" onclick="rsEmptyTrash()" style="opacity:.8"><span style="font-size:20px;color:#c0392b;"><i class="ti ti-trash-x"></i></span><div class="label" style="color:#c0392b;">تفريغ المحذوفات</div></div>';
    }
    openMiniMenu('المحذوفات', html);
  }
  window.rsOpenTrash = openTrash;

  function updateRow() {
    const el = document.getElementById('trashCount'); if (!el) return;
    const n = readTrash().length; el.textContent = n ? n + ' عنصراً' : '';
  }
  const _oas = window.openAdvancedSettings;
  if (typeof _oas === 'function') window.openAdvancedSettings = function () { const r = _oas.apply(this, arguments); updateRow(); return r; };
})();
