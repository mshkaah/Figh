(function () {
  'use strict';
  const toast = (m) => { try { showGenericToast(m); } catch (e) {} };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const arDigits = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
  const safeName = (s) => String(s || 'rasael').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 40);

  function downloadBlob(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  async function shareOrDownloadFile(obj, baseName) {
    const json = JSON.stringify(obj);
    const filename = safeName(baseName) + '.rasael.json';
    try {
      const file = new File([json], filename, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: baseName });
        return;
      }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    downloadBlob(new Blob([json], { type: 'application/json' }), filename);
    toast('حُفظ الملف، أرسله لمن تريد');
  }
  function pickFile(accept, cb) {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = accept; inp.style.display = 'none';
    inp.onchange = () => {
      const f = inp.files && inp.files[0]; inp.remove();
      if (!f) return;
      const r = new FileReader();
      r.onload = () => cb(String(r.result || ''), f);
      r.readAsText(f, 'utf-8');
    };
    document.body.appendChild(inp); inp.click();
  }

  function reUid(items) {
    return (items || []).map((it) => {
      const c = JSON.parse(JSON.stringify(it));
      c.uid = newUid('i');
      if (c.type === 'chapter') c.items = reUid(c.items);
      return c;
    });
  }
  function exportCustomBook(id) {
    const cb = customBooks.find((b) => b.id === id);
    if (!cb) return;
    shareOrDownloadFile({ app: 'rasael', kind: 'book', format: 1, name: cb.name, items: cb.items }, cb.name);
  }
  function exportCustomBookText(id) {
    const cb = customBooks.find((b) => b.id === id);
    if (!cb) return;
    const lines = [cb.name, ''];
    const emit = (it) => {
      if (it.type === 'chapter') { lines.push('## ' + (it.title || it.name || 'فصل'), ''); (it.items || []).forEach(emit); return; }
      if (it.type === 'note' || it.type === 'quote') { lines.push((it.text || '').trim(), ''); return; }
      let body = '';
      try {
        const c = it.type === 'masala' ? getMasalaContentForCustomBook(it.bookId, it.sectionIdx, it.masalaNum) : getProcessedSection(it.bookId, it.sectionIdx);
        body = (c && c.body ? c.body : '').replace(new RegExp(BLOCK_MARKER_SRC, 'g'), '').replace(/<[^>]+>/g, '').trim();
      } catch (e) {}
      lines.push(`[${it.authorName || ''} — ${it.bookName || ''}${it.masalaNum ? ' — مسألة ' + it.masalaNum : ''}]`, body, '');
    };
    cb.items.forEach(emit);
    const text = lines.join('\n');
    if (navigator.share) navigator.share({ title: cb.name, text }).catch(() => {});
    else downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), safeName(cb.name) + '.txt');
  }
  window.rsExportBook = exportCustomBook;
  window.rsExportBookText = exportCustomBookText;

  function importFromText(text) {
    let obj;
    try { obj = JSON.parse(text); } catch (e) { toast('الملف غير صالح'); return; }
    if (!obj || obj.app !== 'rasael') { toast('هذا ليس ملفاً من التطبيق'); return; }
    if (obj.kind === 'book' && Array.isArray(obj.items)) {
      const cb = { id: newUid('cb'), name: (obj.name || 'كتاب مستورد') + ' (مستورد)', createdAt: Date.now(), items: reUid(obj.items), migratedV2: true };
      customBooks.push(cb); saveCustomBooks();
      toast('استُورد الكتاب: ' + cb.name);
      renderWritingPage();
    } else if (obj.kind === 'writing') {
      const w = { id: 'w' + Date.now(), text: String(obj.text || ''), html: sanitizeWritingHtml(String(obj.html || '')), title: (obj.title || 'كتابة مستوردة'), color: obj.color || '#8e5bd4', updatedAt: Date.now() };
      freeWritings.push(w); saveWritingsStorage();
      try { ensureLibraryOrder(); saveLibraryOrder(); } catch (e) {}
      toast('استُوردت الكتابة');
      renderWritingPage();
    } else toast('نوع الملف غير مدعوم');
  }
  window.rsImportFile = () => pickFile('.json,application/json', (t) => importFromText(t));

  const _moreMenu = window.openCustomBookMoreMenu;
  window.openCustomBookMoreMenu = function () {
    const r = _moreMenu.apply(this, arguments);
    try {
      const list = document.getElementById('miniMenuList');
      const id = currentCustomBookId;
      list.insertAdjacentHTML('afterbegin',
        `<div class="list-row" onclick="closeMiniMenu(); rsExportBook('${id}');"><span style="font-size:20px;"><i class="ti ti-share-3"></i></span><div class="label">مشاركة الكتاب كملف (يفتحه مستخدم آخر)</div></div>
         <div class="list-row" onclick="closeMiniMenu(); rsExportBookText('${id}');"><span style="font-size:20px;"><i class="ti ti-file-text"></i></span><div class="label">مشاركة الكتاب كنص</div></div>`);
    } catch (e) {}
    return r;
  };

  let autoTimer = null, lastSavedSig = '';
  function sig() {
    const ed = writingEditorEl(), t = document.getElementById('writingTitleInput');
    return (t ? t.value : '') + '\u0001' + (ed ? ed.innerHTML : '');
  }
  function setStatus(msg) { const s = document.getElementById('rsWrStatus'); if (s) s.dataset.msg = msg; updateMeta(); }
  function updateMeta() {
    const s = document.getElementById('rsWrStatus'); if (!s) return;
    const txt = getWritingText().trim();
    const words = txt ? txt.split(/\s+/).length : 0;
    s.textContent = `${arDigits(words)} كلمة · ${arDigits(txt.length)} حرفاً` + (s.dataset.msg ? ' · ' + s.dataset.msg : '');
  }
  function autosaveNow() {
    clearTimeout(autoTimer);
    const ed = writingEditorEl(); if (!ed) return;
    const cur = sig(); if (cur === lastSavedSig) return;
    const text = getWritingText();
    const title = (document.getElementById('writingTitleInput').value || '').trim();
    if (!currentWritingId && !text.trim() && !title) return;
    const html = sanitizeWritingHtml(ed.innerHTML);
    const color = writingDraftColor || WRITING_COLORS[0];
    if (currentWritingId) {
      const w = freeWritings.find((x) => x.id === currentWritingId);
      if (w) { w.text = text; w.html = html; w.title = title; w.color = color; w.updatedAt = Date.now(); }
    } else {
      const id = 'w' + Date.now();
      freeWritings.push({ id, text, html, title, color, updatedAt: Date.now() });
      currentWritingId = id;
      try { ensureLibraryOrder(); saveLibraryOrder(); } catch (e) {}
    }
    saveWritingsStorage();
    lastSavedSig = cur;
    setStatus('حُفظ تلقائياً');
  }
  window.rsAutosaveNow = autosaveNow;
  function scheduleAuto() { setStatus('غير محفوظ'); clearTimeout(autoTimer); autoTimer = setTimeout(autosaveNow, 1500); }

  const _openWritingEditor = window.openWritingEditor;
  window.openWritingEditor = function () {
    const r = _openWritingEditor.apply(this, arguments);
    try {
      const bar = document.querySelector('#wrTop .wr-bar');
      const sp = bar && bar.querySelector('.wr-bar-sp');
      if (sp) sp.insertAdjacentHTML('afterend',
        `<button class="wr-ic" onclick="rsExportWriting(true)" title="مشاركة كملف للتطبيق"><i class="ti ti-file-export"></i></button>
         <button class="wr-ic" onclick="rsExportWriting(false)" title="تنزيل كنص (.txt)"><i class="ti ti-download"></i></button>`);
      const ed = writingEditorEl();
      ed.insertAdjacentHTML('afterend', '<div id="rsWrStatus" style="font-size:12px;color:var(--text-dim);padding:6px 2px;"></div>');
      lastSavedSig = sig();
      ed.addEventListener('input', scheduleAuto);
      document.getElementById('writingTitleInput').addEventListener('input', scheduleAuto);
      updateMeta();
    } catch (e) {}
    return r;
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden) { try { autosaveNow(); } catch (e) {} } });
  window.addEventListener('pagehide', () => { try { autosaveNow(); } catch (e) {} });

  window.rsExportWriting = function (asAppFile) {
    autosaveNow();
    const title = (document.getElementById('writingTitleInput').value || '').trim() || 'كتابة';
    const text = getWritingText();
    if (asAppFile) {
      shareOrDownloadFile({ app: 'rasael', kind: 'writing', format: 1, title, text, html: sanitizeWritingHtml(writingEditorEl().innerHTML), color: writingDraftColor }, title);
    } else {
      downloadBlob(new Blob([title + '\n\n' + text], { type: 'text/plain;charset=utf-8' }), safeName(title) + '.txt');
      toast('نُزّلت الكتابة');
    }
  };

  const HKEY = 'rs_search_history';
  const getHist = () => { try { return JSON.parse(localStorage.getItem(HKEY) || '[]'); } catch (e) { return []; } };
  const setHist = (a) => { try { localStorage.setItem(HKEY, JSON.stringify(a.slice(0, 12))); } catch (e) {} };

  function vocabSuggest(prefix) {
    try {
      if (typeof searchIndexState === 'undefined' || searchIndexState !== 'ready' || !searchIndex) return [];
      const ix = searchIndex, v = ix.vocab, starts = ix.starts, offs = ix.offs;
      const cand = new Map();
      const tokenAt = (pos) => { let lo = 0, hi = ix.nTok - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (starts[m] <= pos) lo = m; else hi = m - 1; } return lo; };
      const take = (pos) => {
        const t = tokenAt(pos); if (starts[t] !== pos) return;
        const w = v.slice(starts[t], starts[t + 1] - 1);
        if (w.length > prefix.length && w.length <= 16 && /^[\u0621-\u064A]+$/.test(w)) cand.set(w, offs[t + 1] - offs[t]);
      };
      if (v.startsWith(prefix)) take(0);
      let i = -1;
      while (cand.size < 700 && (i = v.indexOf('\n' + prefix, i + 1)) !== -1) take(i + 1);
      return Array.from(cand.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6).map((x) => x[0]);
    } catch (e) { return []; }
  }
  function currentSuggestions() {
    const inp = document.getElementById('searchInput'); if (!inp) return { words: [], hist: [] };
    const val = inp.value;
    const trimmed = val.trim();
    if (trimmed.length < 2 || /\s$/.test(val)) return { words: [], hist: [] };
    const parts = trimmed.split(/\s+/), last = normalizeArabic(parts[parts.length - 1]);
    const base = parts.slice(0, -1).join(' ');
    const words = last.length >= 2 ? vocabSuggest(last).map((w) => (base ? base + ' ' : '') + w) : [];
    const nt = normalizeArabic(trimmed);
    const hist = getHist().filter((h) => h !== trimmed && normalizeArabic(h).startsWith(nt)).slice(0, 3);
    return { words, hist };
  }
  const HIST_ON = 'rs_search_hist_on';
  const histOn = () => { try { return localStorage.getItem(HIST_ON) !== '0'; } catch (e) { return true; } };
  window.rsToggleSearchHistory = function () {
    try { localStorage.setItem(HIST_ON, histOn() ? '0' : '1'); } catch (e) {}
    syncHistToggle(); renderHist();
    showGenericToast(histOn() ? 'سجل البحث مفعّل' : 'سجل البحث متوقف');
  };
  function syncHistToggle() { const t = document.getElementById('histToggle'); if (t) t.classList.toggle('on', histOn()); }
  function renderHist() {
    const inp = document.getElementById('searchInput'); if (!inp) return;
    let row = document.getElementById('rsSearchHist');
    if (!row) {
      row = document.createElement('div'); row.id = 'rsSearchHist';
      inp.closest('.search-box-row').insertAdjacentElement('afterend', row);
    }
    const typing = inp.value.trim().length >= 2;
    let items;
    if (typing) {
      const s = currentSuggestions();
      items = (histOn() ? s.hist.map((q) => ({ q, k: 'h' })) : []).concat(s.words.map((q) => ({ q, k: 'w' })));
    } else items = histOn() ? getHist().map((q) => ({ q, k: 'h' })) : [];
    row.className = 'rs-sg rs-sg-h2';
    row.style.cssText = items.length ? '' : 'display:none';
    const chip = (it, i) => `<span class="rs-chip ${it.k === 'h' ? 'is-h' : 'is-w'}" data-i="${i}" role="button" tabindex="0"><i class="ti ti-${it.k === 'h' ? 'history' : 'search'}"></i><span class="rs-chip-t">${esc(it.q)}</span>${it.k === 'h' ? `<button type="button" class="rs-chip-x" data-del="${i}" title="حذف من السجل" aria-label="حذف من السجل"><i class="ti ti-x"></i></button>` : ''}</span>`;
    const clr = (!typing && items.length > 0 && items.some((x) => x.k === 'h')) ? '<button type="button" class="rs-chip-clear" data-clear="1"><i class="ti ti-trash"></i> مسح الكل</button>' : '';
    row.innerHTML = `<div class="rs-chips">${clr}${items.map(chip).join('')}</div>`;
    row.onclick = (e) => {
      const c = e.target.closest('[data-clear]'); if (c) { setHist([]); renderHist(); return; }
      const d = e.target.closest('[data-del]');
      if (d) { e.stopPropagation(); const it = items[+d.dataset.del]; if (it) { setHist(getHist().filter((x) => x !== it.q)); renderHist(); } return; }
      const r = e.target.closest('.rs-chip'); if (!r) return;
      const it = items[+r.dataset.i]; if (!it) return;
      if (it.k === 'h') { inp.value = it.q; doSearch(); }
      else { inp.value = it.q + ' '; inp.focus(); renderHist(); }
    };
  }
  let sugT = 0;
  function bindInput() {
    const inp = document.getElementById('searchInput'); if (!inp || inp._rsSug) return;
    inp._rsSug = true;
    inp.addEventListener('input', () => { clearTimeout(sugT); sugT = setTimeout(renderHist, 90); });
  }
  const _doSearch = window.doSearch;
  window.doSearch = function () {
    try {
      const q = document.getElementById('searchInput').value.trim();
      if (q.length >= 2 && histOn()) setHist([q].concat(getHist().filter((x) => x !== q)));
      const row = document.getElementById('rsSearchHist'); if (row) row.style.display = 'none';
    } catch (e) {}
    return _doSearch.apply(this, arguments);
  };

  const SORT_ON = 'rs_search_sort', SORT_MODE = 'rs_search_sort_mode', AUTH_ORD = 'rs_search_author_order', FAV_PRESET = 'rs_search_fav_preset';
  const sortOn = () => localStorage.getItem(SORT_ON) !== '0';
  const sortMode = () => (localStorage.getItem(SORT_MODE) === 'author' ? 'author' : 'rel');
  const lsJson = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  function authOrder() {
    const saved = lsJson(AUTH_ORD, []), out = [], seen = new Set();
    saved.concat(authorOrder).forEach((a) => { if (!seen.has(a)) { seen.add(a); out.push(a); } });
    return out;
  }
  let baseRef = null, baseFull = null, basePartial = null, favPrev = null;
  function sortList(list, mode) {
    if (mode === 'rel') return list;
    const bookIdx = new Map(allBooks.map((b, i) => [b.id, i]));
    const authIdx = new Map(authOrder().map((a, i) => [a, i]));
    const key = (r) => {
      const bk = allBooks.find((b) => b.id === r.bookId);
      const bi = bookIdx.has(r.bookId) ? bookIdx.get(r.bookId) : 1e9;
      const ai = bk && authIdx.has(bk.author_id) ? authIdx.get(bk.author_id) : 1e8;
      return [ai, bi, r.rowid || 0];
    };
    return list.map((r, i) => ({ r, k: key(r), i })).sort((x, y) => (x.k[0] - y.k[0]) || (x.k[1] - y.k[1]) || (x.k[2] - y.k[2]) || (x.i - y.i)).map((x) => x.r);
  }
  const favPresetObj = () => { const id = localStorage.getItem(FAV_PRESET); return id ? getSearchFilterPresets().find((p) => p.id === id) || null : null; };
  const _renderResults = window.renderSearchResultsPage;
  window.renderSearchResultsPage = function () {
    try {
      if (lastSearchResults !== baseRef) { baseFull = lastSearchResults.slice(); basePartial = (lastSearchPartialResults || []).slice(); }
      if (sortOn() && sortMode() === 'author') { lastSearchResults = sortList(baseFull, 'author'); lastSearchPartialResults = sortList(basePartial, 'author'); }
      else { lastSearchResults = baseFull.slice(); lastSearchPartialResults = basePartial.slice(); }
      baseRef = lastSearchResults;
    } catch (e) {}
    const r = _renderResults.apply(this, arguments);
    try {
      if (sortOn() && (lastSearchResults.length || (lastSearchPartialResults || []).length)) {
        const m = sortMode(), fp = favPresetObj();
        const chip = (cls, on, attrs, inner) => `<button type="button" class="rs-sc${on ? ' on' : ''} ${cls}" ${attrs}>${inner}</button>`;
        const chips =
          chip('', m === 'rel' && favPrev === null, `onclick="rsSetSearchSort('rel')"`, 'الأقرب') +
          chip('rs-sc-auth', m === 'author', `data-auth="1" oncontextmenu="return false"`, 'حسب المرجع <i class="ti ti-arrows-sort"></i>') +
          chip('rs-sc-fav', favPrev !== null, `onclick="rsToggleFavFilter()"`, `<i class="ti ti-star${favPrev !== null ? '-filled' : ''}"></i> ${fp ? esc(fp.name) : 'اختصاري المفضّل'}`);
        document.getElementById('searchResults').insertAdjacentHTML('afterbegin',
          `<div id="rsSortRow" class="rs-sortrow"><div class="rs-sc-line"><span class="rs-sc-lbl">ترتيب</span>${chips}</div><div class="rs-sc-hint">${m === 'author' ? 'اضغط مطوّلاً على «حسب المرجع» لتغيير ترتيب المراجع' : 'اضغط على «حسب المرجع» لتجميع النتائج، ومطوّلاً لترتيب المراجع'}</div></div>`);
        bindAuthChip();
      }
    } catch (e) {}
    return r;
  };
  function bindAuthChip() {
    const b = document.querySelector('#rsSortRow .rs-sc-auth'); if (!b) return;
    let t = 0, fired = false, sx = 0, sy = 0;
    const cancel = () => clearTimeout(t);
    b.addEventListener('pointerdown', (e) => { fired = false; sx = e.clientX; sy = e.clientY; clearTimeout(t); t = setTimeout(() => { fired = true; try { navigator.vibrate && navigator.vibrate(12); } catch (er) {} rsOpenAuthorOrder(); }, 480); });
    b.addEventListener('pointermove', (e) => { if (Math.abs(e.clientX - sx) > 10 || Math.abs(e.clientY - sy) > 10) cancel(); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => b.addEventListener(ev, cancel));
    b.addEventListener('click', () => { if (fired) { fired = false; return; } rsSetSearchSort('author'); });
  }
  window.rsSetSearchSort = function (m) {
    if (favPrev !== null) { rsToggleFavFilter(true); return; }
    try { localStorage.setItem(SORT_MODE, m); } catch (e) {}
    searchCurrentPage = 1; renderSearchResultsPage();
  };
  window.rsOpenAuthorOrder = function () {
    const inRes = new Set();
    (baseFull || []).concat(basePartial || []).forEach((r) => { const bk = allBooks.find((b) => b.id === r.bookId); if (bk) inRes.add(bk.author_id); });
    const ord = authOrder();
    const vis = ord.filter((a) => inRes.has(a));
    const rows = vis.map((a) => `<div class="jurist-row" data-key="${a}"><span class="jurist-grip" title="اسحب لتغيير الترتيب"><i class="ti ti-grip-vertical"></i></span><span class="jurist-name">${esc(allAuthors[a] || '')}</span></div>`).join('');
    openMiniMenu('ترتيب المراجع في نتائج البحث', `<div class="hrem-empty" style="padding:0 4px 8px">اضغط على المقبض ⠿ واسحب المرجع إلى مكانه.</div><div id="rsAoList">${rows || '<div class="list-row"><div class="label">لا نتائج</div></div>'}</div>` +
      `<div class="list-row" onclick="rsResetAuthorOrder()"><span><i class="ti ti-restore"></i></span><div class="label">الترتيب الافتراضي (ترتيب المكتبة)</div></div>`);
    try {
      enableJuristDragReorder(document.getElementById('rsAoList'), (keys) => {
        const keep = keys.map((k) => (isNaN(+k) ? k : +k));
        const ord = authOrder(), out = ord.slice();
        const slots = []; ord.forEach((a, i) => { if (keep.indexOf(a) >= 0) slots.push(i); });
        if (slots.length === keep.length) keep.forEach((a, j) => { out[slots[j]] = a; });
        else { const rest = ord.filter((x) => keep.indexOf(x) < 0); out.length = 0; keep.concat(rest).forEach((x) => out.push(x)); }
        try { localStorage.setItem(AUTH_ORD, JSON.stringify(out)); localStorage.setItem(SORT_MODE, 'author'); } catch (e) {}
        searchCurrentPage = 1; renderSearchResultsPage(); rsOpenAuthorOrder();
      });
    } catch (e) {}
  };
  window.rsMoveAuthor = function (a, d) {
    const inRes = new Set();
    (baseFull || []).concat(basePartial || []).forEach((r) => { const bk = allBooks.find((b) => b.id === r.bookId); if (bk) inRes.add(bk.author_id); });
    const ord = authOrder(), vis = ord.filter((x) => inRes.has(x));
    const i = vis.indexOf(a), j = i + d; if (i < 0 || j < 0 || j >= vis.length) return;
    const ia = ord.indexOf(vis[i]), ib = ord.indexOf(vis[j]);
    [ord[ia], ord[ib]] = [ord[ib], ord[ia]];
    try { localStorage.setItem(AUTH_ORD, JSON.stringify(ord)); localStorage.setItem(SORT_MODE, 'author'); } catch (e) {}
    rsOpenAuthorOrder();
    searchCurrentPage = 1; renderSearchResultsPage();
  };
  window.rsResetAuthorOrder = function () {
    try { localStorage.removeItem(AUTH_ORD); } catch (e) {}
    rsOpenAuthorOrder(); searchCurrentPage = 1; renderSearchResultsPage();
  };
  window.rsToggleFavFilter = function () {
    try {
      if (favPrev !== null) {
        applySearchFilterSelection(favPrev.length ? favPrev : [0]); saveCurrentSearchFilterState();
        favPrev = null; showGenericToast('رجعت التصفية السابقة'); doSearch(); return;
      }
      const fp = favPresetObj();
      if (!fp) { rsPickFavPreset(); return; }
      if (!document.getElementById('searchFilterPanel').dataset.built) buildSearchFilterPanel();
      favPrev = getCurrentFilterSelectedBookIds();
      applySearchFilterSelection(fp.bookIds); saveCurrentSearchFilterState();
      showGenericToast('طُبّق الاختصار: ' + fp.name);
      doSearch();
    } catch (e) { console.warn(e); }
  };
  window.rsPickFavPreset = function () {
    const ps = getSearchFilterPresets();
    if (!ps.length) { showGenericToast('احفظ اختصاراً من لوحة التصفية أولاً، ثم اجعله مفضّلاً بالضغط المطوّل عليه'); return; }
    const cur = localStorage.getItem(FAV_PRESET);
    openMiniMenu('اختر اختصارك المفضّل', ps.map((p) => `<div class="list-row" onclick="rsSetFavPreset('${p.id}')"><span><i class="ti ti-star${p.id === cur ? '-filled' : ''}"></i></span><div class="label">${esc(p.name)}</div></div>`).join(''));
  };
  window.rsSetFavPreset = function (id) {
    try { closeMiniMenu(); } catch (e) {}
    try { if (id) localStorage.setItem(FAV_PRESET, id); else localStorage.removeItem(FAV_PRESET); } catch (e) {}
    try { renderSearchFilterPresetsRow(); } catch (e) {}
    if (lastSearchResults && (lastSearchResults.length || (lastSearchPartialResults || []).length)) renderSearchResultsPage();
  };
  window.presetChipPointerDown = function (evt, presetId) {
    presetLongPressFired = false; clearTimeout(presetLongPressTimer);
    presetLongPressTimer = setTimeout(() => {
      presetLongPressFired = true;
      try { navigator.vibrate && navigator.vibrate(12); } catch (e) {}
      const p = getSearchFilterPresets().find((x) => x.id === presetId); if (!p) return;
      const isFav = localStorage.getItem(FAV_PRESET) === presetId;
      openMiniMenu(p.name,
        `<div class="list-row" onclick="rsSetFavPreset(${isFav ? "''" : `'${presetId}'`})"><span><i class="ti ti-star${isFav ? '' : '-filled'}"></i></span><div class="label">${isFav ? 'إلغاء كونه المفضّل' : 'جعله اختصاري المفضّل'}</div></div>` +
        `<div class="list-row" onclick="closeMiniMenu();confirmDeleteSearchFilterPreset('${presetId}')"><span><i class="ti ti-trash"></i></span><div class="label">حذف الاختصار</div></div>`);
    }, 550);
  };
  const _rsfp = window.renderSearchFilterPresetsRow;
  window.renderSearchFilterPresetsRow = function () {
    const r = _rsfp.apply(this, arguments);
    try {
      const fav = localStorage.getItem(FAV_PRESET);
      document.querySelectorAll('#searchFilterPresetsRow .search-preset-chip').forEach((c) => {
        if (c.dataset.presetId === fav) { c.classList.add('is-fav'); c.insertAdjacentHTML('afterbegin', '<i class="ti ti-star-filled"></i> '); }
      });
      const row = document.getElementById('searchFilterPresetsRow');
      if (row && row.style.display !== 'none' && !row.querySelector('.preset-hint')) row.insertAdjacentHTML('beforeend', '<span class="preset-hint">اضغط مطوّلاً على اختصار لجعله مفضّلاً أو حذفه</span>');
    } catch (e) {}
    return r;
  };
  window.rsToggleSearchSort = function () {
    try { localStorage.setItem(SORT_ON, sortOn() ? '0' : '1'); } catch (e) {}
    syncSortToggle();
    if (document.getElementById('searchResults') && (lastSearchResults.length || (lastSearchPartialResults || []).length)) { searchCurrentPage = 1; renderSearchResultsPage(); }
  };
  function syncSortToggle() { const t = document.getElementById('sortToggle'); if (t) t.classList.toggle('on', sortOn()); }
  const _oas2 = window.openAdvancedSettings;
  if (typeof _oas2 === 'function') window.openAdvancedSettings = function () { const r = _oas2.apply(this, arguments); syncSortToggle(); syncHistToggle(); return r; };

  let favQuery = '', favCache = new Map();
  function favHay(kind, item) {
    const k = kind + (item.bookId || '') + '|' + (item.sectionIdx || 0) + '|' + (item.masalaNum || '') + '|' + (item.text || '').length + '|' + (item.snippet || '').length;
    if (favCache.has(k)) return favCache.get(k);
    let body = '';
    try {
      if (item.bookId && item.masalaNum && !item.kind) { const c = getMasalaContentForCustomBook(item.bookId, item.sectionIdx, item.masalaNum); body = c && c.body ? c.body.replace(/<[^>]+>/g, ' ') : ''; }
    } catch (e) {}
    const h = normalizeArabic([item.title, item.bookName, item.extSub, item.snippet, item.text, item.extText, body].filter(Boolean).join(' '));
    favCache.set(k, h); return h;
  }
  function markWords(root, words) {
    root.querySelectorAll('mark.rs-fmark').forEach((m) => { const t = document.createTextNode(m.textContent); m.replaceWith(t); });
    root.normalize();
    if (!words || !words.length) return null;
    const flex = (w) => w.split('').map((ch) => ('أإآا'.includes(ch) ? '[أإآا]' : 'ةه'.includes(ch) ? '[ةه]' : (ch === 'ى' || ch === 'ي') ? '[ىي]' : ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('[\u064B-\u065F\u0670\u0640]*');
    let re; try { re = new RegExp(words.slice().sort((a, b) => b.length - a.length).map(flex).join('|'), 'g'); } catch (e) { return null; }
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), nodes = [];
    let n; while ((n = tw.nextNode())) nodes.push(n);
    let first = null;
    nodes.forEach((node) => {
      const t = node.nodeValue; re.lastIndex = 0; let m, last = 0, frag = null;
      while ((m = re.exec(t)) !== null) {
        if (!m[0]) { re.lastIndex++; continue; }
        frag = frag || document.createDocumentFragment();
        frag.appendChild(document.createTextNode(t.slice(last, m.index)));
        const mk = document.createElement('mark'); mk.className = 'rs-fmark'; mk.textContent = m[0]; frag.appendChild(mk); if (!first) first = mk;
        last = m.index + m[0].length;
      }
      if (frag) { frag.appendChild(document.createTextNode(t.slice(last))); node.replaceWith(frag); }
    });
    return first;
  }
  window.RSMark = markWords;
  function applyFavFilter() {
    const page = document.getElementById('favoritesPage'); if (!page) return;
    const q = normalizeArabic(favQuery.trim());
    const words = q.split(/\s+/).filter(Boolean);
    let shown = 0, total = 0;
    page.querySelectorAll('.swipe-row').forEach((row) => {
      const el = row.querySelector('[onclick^="openFavorite("], [onclick^="openNoteFromFavorites("]'); if (!el) return;
      const m = el.getAttribute('onclick').match(/\((\d+)\)/); if (!m) return;
      const isNote = el.getAttribute('onclick').startsWith('openNote');
      const item = (isNote ? notes : favorites)[+m[1]]; if (!item) return;
      total++;
      const ok = !words.length || words.every((w) => favHay(isNote ? 'n' : 'f', item).includes(w));
      row.style.display = ok ? '' : 'none'; if (ok) shown++;
      try { const lab = row.querySelector('.label'); if (lab) markWords(lab, ok ? words : []); } catch (e) {}
    });
    let msg = document.getElementById('rsFavNone');
    if (words.length && total && !shown) {
      if (!msg) { msg = document.createElement('div'); msg.id = 'rsFavNone'; msg.className = 'empty-state'; msg.textContent = 'لا نتائج مطابقة'; page.appendChild(msg); }
    } else if (msg) msg.remove();
  }
  window.rsFavSearch = function (v) { favQuery = v; applyFavFilter(); const w = document.querySelector('.rs-favsearch'); if (w) w.classList.toggle('has', !!v); };
  const _renderFav = window.renderFavoritesPage;
  window.renderFavoritesPage = function () {
    const r = _renderFav.apply(this, arguments);
    try {
      const page = document.getElementById('favoritesPage');
      if (page.querySelector('.fav-subtabs')) {
        page.querySelector('.fav-subtabs').insertAdjacentHTML('afterend',
          `<div class="rs-favsearch${favQuery ? ' has' : ''}"><i class="ti ti-search"></i><input type="search" id="rsFavFind" placeholder="ابحث في المفضلة والتعليقات..." value="${esc(favQuery)}" oninput="rsFavSearch(this.value)" enterkeyhint="search"><button type="button" class="rs-fs-x" aria-label="مسح" onclick="var i=document.getElementById('rsFavFind');i.value='';rsFavSearch('');i.focus()"><i class="ti ti-x"></i></button></div>`);
        if (favQuery) applyFavFilter();
      }
    } catch (e) {}
    return r;
  };

  const boot = () => { try { bindInput(); renderHist(); syncHistToggle(); } catch (e) {} };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
