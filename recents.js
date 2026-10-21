(function () {
  'use strict';
  const KEY = 'rs_recent_reads', NKEY = 'rs_recent_n', MAX = 10;
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const getN = () => { const n = parseInt(lsGet(NKEY, '4'), 10); return n >= 3 && n <= 5 ? n : 4; };
  const load = () => { try { const a = JSON.parse(lsGet(KEY, '[]')); return Array.isArray(a) ? a : []; } catch (e) { return []; } };

  let pending = null, timer = 0;
  function flush() {
    clearTimeout(timer); timer = 0;
    if (!pending) return;
    const p = pending; pending = null;
    const list = load().filter((x) => x.bookId !== p.bookId);
    list.unshift(p);
    lsSet(KEY, JSON.stringify(list.slice(0, MAX)));
    refreshBadge();
  }
  const _save = window.saveLastPosition;
  window.saveLastPosition = function () {
    const r = _save.apply(this, arguments);
    try {
      const pos = JSON.parse(localStorage.getItem('rs_lastPosition') || 'null');
      if (pos && pos.bookId && typeof pos.scrollTop === 'number' && !isThamraBook(pos.bookId)) {
        const book = allBooks.find((b) => b.id === pos.bookId);
        if (book) {
          const sec = currentSections && currentSections[pos.sectionIdx];
          let secOff = null;
          try {
            const el = document.getElementById('rs-sec-' + pos.sectionIdx), c = document.getElementById('content');
            if (el && c && document.getElementById('readerPage').classList.contains('active') && !document.getElementById('readerPage').classList.contains('page-mode')) {
              secOff = Math.max(0, Math.round(c.getBoundingClientRect().top - el.getBoundingClientRect().top));
            }
          } catch (er) {}
          pending = { secOff, bookId: pos.bookId, sectionIdx: pos.sectionIdx, scrollTop: pos.scrollTop, mode: pos.mode,
            bookName: book.name, authorId: book.author_id, authorName: (allAuthors[book.author_id] || '').trim(),
            sectionTitle: sec ? sec.title : '', t: Date.now() };
          if (!timer) timer = setTimeout(flush, 700);
        }
      }
    } catch (e) {}
    return r;
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
  addEventListener('pagehide', flush);

  function openEntry(e) {
    const book = allBooks.find((b) => b.id === e.bookId);
    if (!book) { showGenericToast('هذا الكتاب لم يعد متاحاً'); return; }
    try { closeMiniMenu(); } catch (er) {}
    const aid = allAuthors[book.author_id] ? book.author_id : GLOSSARY_AUTHOR_ID;
    currentAuthorId = aid;
    pushNav(() => openAuthorBooks(aid));
    loadBookSections(e.bookId, book);
    const start = Math.max(0, Math.min(e.sectionIdx || 0, currentSections.length - 1));
    const relative = typeof e.secOff === 'number' && (e.mode || 'scroll') === 'scroll' && readModeName() === 'scroll';
    renderContinuousReader(e.bookId, start, { scrollTop: (!relative && typeof e.scrollTop === 'number' && (e.mode || 'scroll') === readModeName()) ? e.scrollTop : null });
    if (relative) refineToOffset(e.bookId, start, e.secOff);
  }
  function refineToOffset(bookId, idx, off) {
    try { readerScrollToken++; } catch (er) {}
    const c = document.getElementById('content');
    let touched = false;
    const stop = () => { touched = true; };
    ['wheel', 'touchstart', 'keydown'].forEach((ev) => c.addEventListener(ev, stop, { once: true, passive: true }));
    const jump = () => {
      if (touched || currentBookId !== bookId) return;
      try { ensureSectionRendered(idx); } catch (er) {}
      const el = document.getElementById('rs-sec-' + idx); if (!el) return;
      c.scrollTop += (el.getBoundingClientRect().top - c.getBoundingClientRect().top) + off;
    };
    [30, 200, 500, 1000, 1700].forEach((ms) => setTimeout(jump, ms));
  }
  window.rsOpenRecent = (i) => { flush(); const e = load()[i]; if (e) openEntry(e); };

  function openRecentsMenu() {
    flush();
    const list = load().slice(0, getN());
    let html;
    if (!list.length) html = '<div class="empty-state" style="padding:22px 10px;">لا توجد قراءات بعد.<br>افتح أي كتاب وسيظهر هنا بموضعك.</div>';
    else html = list.map((e, i) => `<div class="list-row" onclick="rsOpenRecent(${i})"><span style="font-size:20px;"><i class="ti ti-book-2"></i></span>
      <div class="label">${esc(e.bookName)}<small>${esc([e.authorName, e.sectionTitle].filter(Boolean).join(' · '))}${e.t ? ' · ' + esc(relativeTimeAr(e.t)) : ''}</small></div></div>`).join('');
    html += '<div style="font-size:12px;color:var(--text-dim);padding:10px 14px 4px;line-height:1.9;">نقرتان متتاليتان على أيقونة أي مرجع في الرئيسية تفتح آخر كتاب قرأته عنده.</div>';
    openMiniMenu('آخر قراءاتك', html);
  }
  window.rsOpenRecents = openRecentsMenu;

  function addButton() {
    const tools = document.getElementById('toolsBtn'); if (!tools || document.getElementById('recentsBtn')) return;
    const b = document.createElement('button');
    b.className = 'icon-btn'; b.id = 'recentsBtn'; b.title = 'القراءات'; b.setAttribute('aria-label', 'القراءات');
    b.innerHTML = '<i class="ti ti-history"></i>'; b.onclick = openRecentsMenu;
    tools.parentElement.insertBefore(b, tools);
    refreshBadge();
  }
  function refreshBadge() { const b = document.getElementById('recentsBtn'); if (b) b.style.display = ''; }

  let last = null;
  const AUTHOR_RE = /openAuthorBooks\(\s*'?(-?\w+)'?\s*\)/;
  function authorFrom(el) {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const oc = n.getAttribute && n.getAttribute('onclick');
      if (oc) { const m = oc.match(AUTHOR_RE); if (m && !/currentAuthorId/.test(oc)) return m[1]; }
    }
    return null;
  }
  document.addEventListener('click', (ev) => {
    const now = Date.now();
    if (last && now - last.t < 450) {
      const aid = last.aid; last = null;
      flush();
      const nid = aid === String(GLOSSARY_AUTHOR_ID) ? GLOSSARY_AUTHOR_ID : parseInt(aid, 10);
      const hit = load().find((e) => { const bk = allBooks.find((b) => b.id === e.bookId); return bk && (nid === GLOSSARY_AUTHOR_ID ? !allAuthors[bk.author_id] : bookInAuthor(bk, nid)); });
      ev.stopPropagation(); ev.preventDefault();
      if (hit) openEntry(hit); else showGenericToast('لا توجد قراءة سابقة عند هذا المرجع');
      return;
    }
    const aid = authorFrom(ev.target);
    last = aid ? { aid, t: now } : null;
  }, true);

  window.rsSetRecentN = (n) => { lsSet(NKEY, String(n)); syncSetting(); };
  function syncSetting() {
    const n = getN();
    document.querySelectorAll('#recentNRow [data-n]').forEach((b) => b.classList.toggle('on', +b.dataset.n === n));
  }
  const _oas = window.openAdvancedSettings;
  if (typeof _oas === 'function') window.openAdvancedSettings = function () { const r = _oas.apply(this, arguments); syncSetting(); return r; };

  const boot = () => { addButton(); syncSetting(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
