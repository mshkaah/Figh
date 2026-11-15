(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const RSV81 = (window.RSV81 = window.RSV81 || {});

  function syncSubs() {
    document.querySelectorAll('.set-sub[data-for]').forEach((sub) => {
      const t = $(sub.dataset.for); if (!t) return;
      sub.classList.toggle('open', t.classList.contains('on'));
    });
  }
  RSV81.syncSubs = syncSubs;
  function watchToggles() {
    const mo = new MutationObserver(syncSubs);
    document.querySelectorAll('.set-sub[data-for]').forEach((sub) => {
      const t = $(sub.dataset.for); if (t) mo.observe(t, { attributes: true, attributeFilter: ['class'] });
    });
    syncSubs();
  }

  const READER_PAGES = ['readerPage', 'customBookPage'];
  function guardReaderBar() {
    const act = document.querySelector('.page.active');
    if (!act || READER_PAGES.indexOf(act.id) >= 0) return;
    const t = $('pageTitle');
    if (document.body.classList.contains('reading-compact')) document.body.classList.remove('reading-compact');
    if (t && t.querySelector('.title-sub')) {
      const main = t.firstElementChild ? t.firstElementChild.textContent : '';
      t.textContent = act.id === 'comparisonPage' ? 'جامع الاستفتاءات' : (main || t.textContent);
    }
    const bc = $('breadcrumbBar'); if (bc && bc.classList.contains('show') && act.id !== 'indexPage' && act.id !== 'authorBooksPage') bc.classList.remove('show');
  }
  function bindGuard() {
    const mo = new MutationObserver(guardReaderBar);
    document.querySelectorAll('.page').forEach((p) => mo.observe(p, { attributes: true, attributeFilter: ['class'] }));
    const t = $('pageTitle'); if (t) mo.observe(t, { childList: true, subtree: true });
    const bc = $('breadcrumbBar'); if (bc) mo.observe(bc, { attributes: true, attributeFilter: ['class'] });
    ['switchPage', 'showTab'].forEach((n) => {
      const f = window[n]; if (typeof f !== 'function') return;
      window[n] = function () { const r = f.apply(this, arguments); try { guardReaderBar(); setTimeout(guardReaderBar, 60); setTimeout(guardReaderBar, 400); } catch (e) {} return r; };
    });
  }

  const jamiOn = () => { const p = $('comparisonPage'); return !!(p && p.classList.contains('active')); };
  function fixJamiHeader() {
    const page = $('comparisonPage'); if (!page) return;
    let h = page.querySelector('.jami-credit');
    if (!h) { h = document.createElement('div'); h.className = 'jami-credit'; page.prepend(h); }
    const url = (typeof JAMI_APP_URL !== 'undefined') ? JAMI_APP_URL : '#';
    h.innerHTML = '<div class="jc-t">جامع الاستفتاءات</div><div class="jc-s">للشيخ عادل الجوهر</div>' +
      `<a class="jc-link" href="${url}" target="_blank" rel="noopener"><i class="ti ti-external-link"></i> الاطّلاع على التطبيق الأصلي</a>`;
  }
  ['renderCmpChaptersList', 'openCmpChapter'].forEach((n) => {
    const f = window[n]; if (typeof f !== 'function') return;
    window[n] = function () { const r = f.apply(this, arguments); try { fixJamiHeader(); } catch (e) {} return r; };
  });

  let jamiToc = false;
  const normAr = (x) => String(x || '').replace(/[ً-ٰٟـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').toLowerCase();
  function jamiTocHtml(q) {
    const d = loadCmpData(), nq = normAr(q || '').trim();
    const cur = (typeof cmpNav !== 'undefined') ? cmpNav.subjectId : null;
    let h = '', n = 0;
    d.chapters.forEach((c) => {
      const subs = cmpVisibleSubjects(d.subjectsByChapter.get(c.id) || []);
      const chapHit = nq && normAr(c.name).indexOf(nq) >= 0;
      const list = nq && !chapHit ? subs.filter((s) => normAr(s.name).indexOf(nq) >= 0) : subs;
      if (!list.length) return;
      h += `<div class="toc-item toc-chap">${escapeHtml(c.name)}</div>`;
      list.forEach((s) => { n++; h += `<div class="toc-item toc-sub ${cur === s.id ? 'active' : ''}" onclick="RSV81.jamiGo(${s.id})">${escapeHtml(s.name)}</div>`; });
    });
    return h || '<div class="toc-item toc-empty">لا نتائج</div>';
  }
  RSV81.openJamiToc = function () {
    jamiToc = true;
    $('tocDrawerTitle').textContent = 'جامع الاستفتاءات';
    const inp = $('tocBookSearch'); if (inp) { inp.value = ''; inp.placeholder = 'ابحث في أبواب ومسائل الجامع...'; }
    $('tocDrawerList').innerHTML = jamiTocHtml('');
    $('tocOverlay').classList.add('show');
    setTimeout(() => { const a = document.querySelector('#tocDrawerList .toc-item.active'); if (a) a.scrollIntoView({ block: 'center' }); }, 60);
  };
  RSV81.jamiGo = function (id) { try { closeTocDrawer(); } catch (e) {} try { renderCmpComparisonView(id); } catch (e) {} };
  const _tocClick = window.readerFabTocClick;
  window.readerFabTocClick = function () { if (jamiOn()) return RSV81.openJamiToc(); return _tocClick.apply(this, arguments); };
  const _tbs = window.tocBookSearchRun;
  window.tocBookSearchRun = function (v) { if (jamiToc) { $('tocDrawerList').innerHTML = jamiTocHtml(v); return; } return _tbs.apply(this, arguments); };
  const _oct = window.closeTocDrawer;
  window.closeTocDrawer = function () { jamiToc = false; return _oct.apply(this, arguments); };
  const _otd = window.openTocDrawer;
  window.openTocDrawer = function () { jamiToc = false; return _otd.apply(this, arguments); };

  const JPOS = 'rs_cmp_pos', JTRACK = 'rs_cmp_track';
  const jamiPos = () => { try { return JSON.parse(lsGet(JPOS, 'null')); } catch (e) { return null; } };
  function saveJamiPos() {
    try {
      const sj = loadCmpData().subjectsById.get(cmpNav.subjectId); if (!sj) return;
      lsSet(JPOS, JSON.stringify({ id: cmpNav.subjectId, name: sj.name, at: Date.now() }));
    } catch (e) {}
  }
  ['renderCmpComparisonView', 'openCmpSubject'].forEach((n) => {
    const f = window[n]; if (typeof f !== 'function') return;
    window[n] = function () { const r = f.apply(this, arguments); try { if (lsGet(JTRACK, '') === '1') saveJamiPos(); } catch (e) {} return r; };
  });
  let pcount = 0, ptimer = 0;
  const _pbc = window.handlePositionBtnClick;
  window.handlePositionBtnClick = function () {
    if (!jamiOn()) return _pbc.apply(this, arguments);
    pcount++;
    if (pcount === 1) { ptimer = setTimeout(() => { pcount = 0; try { openSavedPositionsList(); } catch (e) {} }, 350); }
    else { clearTimeout(ptimer); pcount = 0; lsSet(JTRACK, '1'); saveJamiPos(); toast('سيتم تتبّع الموقع في جامع الاستفتاءات'); }
  };
  const _osp = window.openSavedPositionsList;
  window.openSavedPositionsList = function () {
    const r = _osp.apply(this, arguments);
    try {
      const jp = jamiPos(), box = $('savedPositionsList'); if (!jp || !box) return r;
      const empty = $('savedPositionsEmpty'); if (empty) empty.remove();
      const row = document.createElement('div'); row.className = 'saved-pos-row';
      row.innerHTML = `<div class="saved-pos-icon"><i class="ti ti-scale"></i></div><div class="saved-pos-info"><div class="saved-pos-book">جامع الاستفتاءات</div><div class="saved-pos-section">${escapeHtml(jp.name || '')}</div></div><div class="saved-pos-time">${jp.at ? relativeTimeAr(jp.at) : ''}</div>`;
      row.onclick = () => { try { if (window.RSV101) RSV101.gotoJamiPos(jp); else { closeSavedPositionsList(); showTab('comparison'); renderCmpComparisonView(jp.id); } } catch (e) {} };
      box.prepend(row);
    } catch (e) {}
    return r;
  };
  function toast(m) { try { showGenericToast(m); } catch (e) {} }

  function init() { watchToggles(); bindGuard(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
