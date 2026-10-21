(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (m) => { try { showGenericToast(m); } catch (e) {} };
  const RSV89 = (window.RSV89 = window.RSV89 || {});

  const FN_KEY = 'rs_fn_mode';
  const fnMode = () => (lsGet(FN_KEY, 'closed') === 'open' ? 'open' : 'closed');
  function syncFnUi() {
    document.querySelectorAll('#fnModeControls [data-fnmode]').forEach((b) => b.classList.toggle('active', b.dataset.fnmode === fnMode()));
  }
  function openOne(box) {
    if (!box || box.classList.contains('open') || box.dataset.auto === '1') return;
    box.dataset.auto = '1';
    const sup = box.previousElementSibling;
    if (sup && sup.tagName === 'SUP' && typeof sup.onclick === 'function') {
      try { sup.onclick.call(sup, { stopPropagation() {}, preventDefault() {} }); } catch (e) {}
    }
  }
  let io = null;
  const supBox = new WeakMap();
  function ioGet() {
    if (io || !('IntersectionObserver' in window)) return io;
    io = new IntersectionObserver((ents) => {
      ents.forEach((en) => { if (en.isIntersecting) { io.unobserve(en.target); const b = supBox.get(en.target); if (b && fnMode() === 'open') openOne(b); } });
    }, { rootMargin: '1400px 0px' });
    return io;
  }
  function watchBoxes(root) {
    if (fnMode() !== 'open') return;
    const list = (root.matches && root.matches('.fn-body')) ? [root] : Array.from(root.querySelectorAll ? root.querySelectorAll('.fn-body:not(.open)') : []);
    const o = ioGet();
    list.forEach((b) => { if (b.dataset.auto === '1') return; const sup = b.previousElementSibling; if (o && sup) { supBox.set(sup, b); o.observe(sup); } else openOne(b); });
  }
  RSV89.setFnMode = function (m) {
    lsSet(FN_KEY, m === 'open' ? 'open' : 'closed');
    syncFnUi();
    if (m === 'open') {
      document.querySelectorAll('.fn-body').forEach((b) => { b.dataset.auto = ''; });
      watchBoxes(document.body);
    } else {
      document.querySelectorAll('.fn-body.open').forEach((b) => b.classList.remove('open'));
      document.querySelectorAll('.fn-body').forEach((b) => { b.dataset.auto = ''; });
    }
    toast(m === 'open' ? 'الحواشي مفتوحة دائماً' : 'الحواشي مغلقة دائماً');
  };
  RSV89.fnMode = fnMode;
  let fnQ = [], fnT = 0;
  new MutationObserver((muts) => {
    if (fnMode() !== 'open') return;
    muts.forEach((m) => m.addedNodes.forEach((n) => { if (n.nodeType === 1) fnQ.push(n); }));
    if (fnT || !fnQ.length) return;
    fnT = setTimeout(() => { fnT = 0; const q = fnQ; fnQ = []; q.forEach(watchBoxes); }, 60);
  }).observe(document.body, { childList: true, subtree: true });

  const SKEY = 'rs_session_v89';
  const scrolls = {};
  let lastSig = '';
  const val = (id) => { const e = $(id); return e ? e.value : ''; };
  function activePageId() { const p = document.querySelector('.page.active'); return p ? p.id : ''; }
  function snapshot() {
    const tab = (typeof currentTab === 'string') ? currentTab : 'books';
    const content = $('content');
    if (content) scrolls[tab] = content.scrollTop;
    const st = { v: 1, t: Date.now(), tab, scroll: Object.assign({}, scrolls), booksAt: null, search: null, fav: null, writing: null };
    if (tab === 'books') st.booksAt = activePageId();
    else { try { st.booksAt = (JSON.parse(sessionStorage.getItem('rs_booksAt') || 'null')) || null; } catch (e) {} }
    const q = val('searchInput').trim();
    if (q) {
      const opt = (n) => { try { return getSearchOptionValue(n); } catch (e) { return null; } };
      const shown = (id) => { const e = $(id); return !!(e && e.style.display !== 'none' && e.style.display !== ''); };
      st.search = {
        q, ex: val('searchExcludeInput'), rq: val('searchRequireInput'), prec: opt('searchPrecision'), scope: opt('searchScope'),
        page: (typeof searchCurrentPage === 'number') ? searchCurrentPage : 1,
        optsOpen: shown('searchOptionsRow'), wordsOpen: shown('searchExcludeRow') || shown('searchRequireRow')
      };
    }
    st.fav = { find: val('rsFavFind') };
    if (tab === 'writing') {
      const pid = activePageId();
      if (pid === 'customBookPage' && typeof currentCustomBookId !== 'undefined' && currentCustomBookId) st.writing = { view: 'cb', id: currentCustomBookId };
      else if (pid === 'writingPage' && typeof currentWritingId !== 'undefined' && currentWritingId) {
        st.writing = { view: $('writingMainTextarea') ? 'edit' : (document.querySelector('#writingPage .wr-read') ? 'read' : 'list'), id: currentWritingId };
      } else st.writing = { view: 'list' };
    } else {
      try { st.writing = (JSON.parse(lsGet(SKEY, 'null')) || {}).writing || null; } catch (e) {}
    }
    return st;
  }
  function save() {
    try {
      const st = snapshot(); st.t = 0;
      const sig = JSON.stringify(st);
      if (sig === lastSig) return;
      lastSig = sig; st.t = Date.now();
      lsSet(SKEY, JSON.stringify(st));
    } catch (e) {}
  }
  function load() { try { const s = JSON.parse(lsGet(SKEY, 'null')); return (s && s.v === 1) ? s : null; } catch (e) { return null; } }
  RSV89.saveSession = save;
  let ready = false;
  const _save = save;
  const guardedSave = () => { if (ready) _save(); };
  RSV89.saveSession = guardedSave;

  const wait = (cond, ms, max) => new Promise((res) => { const t0 = Date.now(); const f = () => { let ok = false; try { ok = cond(); } catch (e) {} if (ok || Date.now() - t0 > max) res(ok); else setTimeout(f, ms); }; f(); });
  const setScroll = (y) => { if (typeof y !== 'number') return; [250, 800, 1600].forEach((d) => setTimeout(() => { const c = $('content'); if (c) c.scrollTop = y; }, d)); };

  async function restoreSearch(s) {
    try {
      const inp = $('searchInput'); if (!inp || !s || !s.q) return;
      inp.value = s.q;
      const ex = $('searchExcludeInput'), rq = $('searchRequireInput');
      if (ex) ex.value = s.ex || ''; if (rq) rq.value = s.rq || '';
      const pick = (name, v) => { if (!v) return; const b = document.querySelector(`.search-opt-group[data-opt-name="${name}"] .search-opt-btn[data-value="${v}"]`); if (b) searchOptionSelect(b); };
      pick('searchPrecision', s.prec); pick('searchScope', s.scope);
      if (s.optsOpen) { const r = $('searchOptionsRow'); if (r) { r.style.display = 'flex'; const b = $('searchOptsBtn'); if (b) b.classList.add('on'); } }
      if (s.wordsOpen) { if (ex && ex.value) { $('searchExcludeRow').style.display = 'flex'; } if (rq && rq.value) { $('searchRequireRow').style.display = 'flex'; } }
      try { updateSearchToolbarState(); } catch (e) {}
      doSearch();
      await wait(() => { const r = $('searchResults'); return r && r.textContent.trim() && r.textContent.indexOf('جاري البحث') < 0; }, 200, 25000);
      if (s.page > 1 && typeof renderSearchResultsPage === 'function') { searchCurrentPage = s.page; renderSearchResultsPage(); }
    } catch (e) { console.warn('restore search', e); }
  }

  async function restoreTabs(st) {
    if (!st || typeof showTab !== 'function') return;
    try {
      if (st.search) await restoreSearch(st.search);
      if (st.fav && st.fav.find) {  RSV89._favFind = st.fav.find; }
      const tab = st.tab;
      if (tab && tab !== 'books') {
        showTab(tab);
        if (tab === 'favorites' && st.fav && st.fav.find) setTimeout(() => { const i = $('rsFavFind'); if (i) { i.value = st.fav.find; try { rsFavSearch(st.fav.find); } catch (e) {} } }, 120);
        if (tab === 'writing' && st.writing) {
          const w = st.writing;
          setTimeout(() => {
            try {
              if (w.view === 'read' && typeof rsReadWriting === 'function' && freeWritings.find((x) => x.id === w.id)) rsReadWriting(w.id);
              else if (w.view === 'edit' && typeof rsEditWriting === 'function' && freeWritings.find((x) => x.id === w.id)) rsEditWriting(w.id);
              else if (w.view === 'cb' && customBooks.find((b) => b.id === w.id)) openCustomBook(w.id);
            } catch (e) { console.warn('restore writing', e); }
          }, 150);
        }
        setScroll((st.scroll || {})[tab]);
      } else if (tab === 'books') {
        setScroll((st.scroll || {}).books);
      }
    } catch (e) { console.warn('restore tabs', e); }
  }

  const _resume = window.resumeLastPosition;
  if (typeof _resume === 'function') {
    window.resumeLastPosition = function () {
      let r = false;
      const st = load();
      let on = true; try { on = !!RSUI.pref('resume'); } catch (e) {}
      try {
        if (on && st && st.tab === 'books' && st.booksAt === 'booksPage') r = false;
        else r = _resume.apply(this, arguments);
      } catch (e) { r = false; }
      if (on && st) {
        setTimeout(async () => { await restoreTabs(st); ready = true; }, 80);
      } else ready = true;
      return r;
    };
  } else ready = true;
  setTimeout(() => { if (!ready && !(typeof isEmbeddedMode !== 'undefined' && isEmbeddedMode)) ready = true; }, 15000);
  setInterval(guardedSave, 2000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') guardedSave(); });
  window.addEventListener('pagehide', guardedSave);
  setInterval(() => { try { if (currentTab === 'books') sessionStorage.setItem('rs_booksAt', JSON.stringify(activePageId())); } catch (e) {} }, 1500);

  const AUTH_ORD = 'rs_search_author_order';
  function authOrder() {
    let saved = []; try { saved = JSON.parse(lsGet(AUTH_ORD, '[]')) || []; } catch (e) {}
    const out = [], seen = new Set();
    saved.concat(typeof authorOrder !== 'undefined' ? authorOrder : []).forEach((a) => { if (!seen.has(a)) { seen.add(a); out.push(a); } });
    return out;
  }
  RSV89.openAuthorOrder = function () {
    const ord = authOrder().filter((a) => { try { return !!allAuthors[a]; } catch (e) { return false; } });
    const rows = ord.map((a) => `<div class="jurist-row" data-key="${a}"><span class="jurist-grip" title="اسحب لتغيير الترتيب"><i class="ti ti-grip-vertical"></i></span><span class="jurist-name">${esc(allAuthors[a] || '')}</span></div>`).join('');
    openMiniMenu('ترتيب المراجع في نتائج البحث',
      `<div class="hrem-empty" style="padding:0 4px 8px">اضغط على المقبض ⠿ واسحب المرجع إلى مكانه. يبقى هذا الترتيب محفوظاً، ويُستعمل عند اختيار «حسب المرجع» في أي بحث.</div><div id="rsAoList">${rows}</div>
       <div class="list-row" onclick="RSV89.resetAuthorOrder()"><span><i class="ti ti-restore"></i></span><div class="label">الترتيب الافتراضي (ترتيب المكتبة)</div></div>`);
    try {
      enableJuristDragReorder($('rsAoList'), (keys) => {
        const keep = keys.map((k) => (isNaN(+k) ? k : +k));
        const rest = authOrder().filter((x) => keep.indexOf(x) < 0);
        lsSet(AUTH_ORD, JSON.stringify(keep.concat(rest)));
        lsSet('rs_search_sort_mode', 'author');
        toast('حُفظ ترتيب المراجع');
      });
    } catch (e) {}
  };
  RSV89.resetAuthorOrder = function () { try { localStorage.removeItem(AUTH_ORD); } catch (e) {} RSV89.openAuthorOrder(); toast('رجع الترتيب الافتراضي'); };

  const num = (s) => (String(s).match(/[\d.]+/g) || []).map(Number);
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  function effBg(el) {
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const c = num(getComputedStyle(e).backgroundColor);
      if (c.length >= 3 && (c.length < 4 || c[3] > 0.5)) return c.slice(0, 3);
    }
    return document.body.classList.contains('night-mode') ? [18, 18, 18] : [255, 255, 255];
  }
  function guard(root) {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll('[style*="color"]').forEach((el) => {
      if (el.closest('#writingMainTextarea')) return;
      if (el.dataset.cg) { el.style.color = el.dataset.cgo || ''; delete el.dataset.cg; delete el.dataset.cgo; }
      const cs = getComputedStyle(el);
      const fg = num(cs.color).slice(0, 3), bg = effBg(el);
      if (fg.length < 3 || cr(fg, bg) >= 3.4) return;
      const target = lum(bg) > 0.5 ? [0, 0, 0] : [255, 255, 255];
      let out = null;
      for (let t = 0.15; t <= 1.001; t += 0.1) { const m = fg.map((v, i) => v + (target[i] - v) * t); if (cr(m, bg) >= 4.2) { out = m; break; } }
      out = out || target;
      el.dataset.cgo = el.style.color || '';
      el.style.color = `rgb(${out.map((v) => Math.round(v)).join(',')})`; el.dataset.cg = '1';
    });
  }
  let gT = 0;
  const gRoots = ['customBookPage', 'writingPage', 'readerPage', 'favoritesPage'];
  new MutationObserver(() => {
    clearTimeout(gT);
    gT = setTimeout(() => { gRoots.forEach((id) => { const r = $(id); if (r && r.classList.contains('active')) guard(r); }); }, 160);
  }).observe($('content') || document.body, { childList: true, subtree: true });
  new MutationObserver(() => { gRoots.forEach((id) => { const r = $(id); if (r) guard(r); }); }).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  const _os = window.openSettings;
  if (typeof _os === 'function') window.openSettings = function () { const r = _os.apply(this, arguments); syncFnUi(); return r; };
  const _oas = window.openAdvancedSettings;
  if (typeof _oas === 'function') window.openAdvancedSettings = function () { const r = _oas.apply(this, arguments); syncFnUi(); return r; };
  syncFnUi();
  setTimeout(() => watchBoxes(document.body), 600);
})();
