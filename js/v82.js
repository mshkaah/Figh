(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const RSV82 = (window.RSV82 = window.RSV82 || {});
  const toast = (m) => { try { showGenericToast(m); } catch (e) {} };

  RSV82.clearSearchHistory = function () {
    try { localStorage.setItem('rs_search_history', '[]'); } catch (e) {}
    const row = $('rsSearchHist'); if (row) { row.style.display = 'none'; row.innerHTML = ''; }
    toast('تم مسح سجل البحث');
  };

  const KEY = 'rs_jami_recents', NK = 'rs_jami_recent_n', MK = 'rs_jami_recent_mode', OK = 'rs_jami_recent_on';
  const on = () => lsGet(OK, '1') !== '0';
  const getN = () => { const n = parseInt(lsGet(NK, '3'), 10); return [3, 5, 7, 10].indexOf(n) >= 0 ? n : 3; };
  const getMode = () => { const m = lsGet(MK, 'open'); return m === 's5' || m === 's15' ? m : 'open'; };
  const load = () => { try { const a = JSON.parse(lsGet(KEY, '[]')); return Array.isArray(a) ? a : []; } catch (e) { return []; } };

  function record(id) {
    try {
      const d = loadCmpData(), sj = d.subjectsById.get(id); if (!sj) return;
      const ch = (d.chapters || []).find((c) => c.id === sj.chapter_id);
      const list = load().filter((x) => x.id !== id);
      list.unshift({ id, name: sj.name, chapter: ch ? ch.name : '', t: Date.now() });
      lsSet(KEY, JSON.stringify(list.slice(0, 10)));
    } catch (e) {}
  }
  let tm = 0;
  function onOpen(id) {
    clearTimeout(tm);
    const m = getMode();
    if (m === 'open') { record(id); return; }
    const ms = m === 's5' ? 5000 : 15000;
    tm = setTimeout(() => {
      try { const p = $('comparisonPage'); if (p && p.classList.contains('active') && cmpNav.subjectId === id) record(id); } catch (e) {}
    }, ms);
  }
  ['renderCmpComparisonView', 'openCmpSubject'].forEach((n) => {
    const f = window[n]; if (typeof f !== 'function') return;
    window[n] = function (id) { const r = f.apply(this, arguments); try { const sid = (typeof id === 'number') ? id : cmpNav.subjectId; if (sid != null) onOpen(sid); } catch (e) {} return r; };
  });

  RSV82.openJamiRecents = function () {
    const list = load().slice(0, getN());
    const html = list.length
      ? list.map((e) => `<div class="list-row" onclick="RSV82.openJamiItem(${e.id})"><span style="font-size:20px;"><i class="ti ti-scale"></i></span><div class="label">${esc(e.name)}<small>${esc(e.chapter)}${e.t ? ' · ' + esc(relativeTimeAr(e.t)) : ''}</small></div></div>`).join('')
      : '<div class="empty-state" style="padding:22px 10px;">لم تفتح مسائل في الجامع بعد.</div>';
    openMiniMenu('جامع الاستفتاءات — آخر مسائلك', html);
  };
  RSV82.openJamiItem = function (id) {
    try { closeMiniMenu(); showTab('comparison'); renderCmpComparisonView(id); } catch (e) {}
  };

  const _omm = window.openMiniMenu;
  window.openMiniMenu = function (title) {
    const r = _omm.apply(this, arguments);
    try {
      if (title === 'آخر قراءاتك' && on() && load().length) {
        const box = $('miniMenuList'); if (!box) return r;
        const j = load()[0];
        let books = []; try { books = JSON.parse(lsGet('rs_recent_reads', '[]')); } catch (e) {}
        const row = document.createElement('div');
        row.className = 'list-row'; row.onclick = () => RSV82.openJamiRecents();
        row.innerHTML = `<span style="font-size:20px;"><i class="ti ti-scale"></i></span><div class="label">جامع الاستفتاءات<small>آخر ${getN() > load().length ? load().length : getN()} مسائل · ${esc(j.name)}${j.t ? ' · ' + esc(relativeTimeAr(j.t)) : ''}</small></div><i class="ti ti-chevron-left" style="color:var(--text-dim)"></i>`;
        const newer = !books.length || j.t > books[0].t;
        if (newer) box.prepend(row);
        else {
          const rows = box.querySelectorAll('.list-row');
          const idx = books.slice(0, rows.length).filter((b) => b.t > j.t).length;
          if (rows[idx]) rows[idx].before(row); else box.appendChild(row);
        }
      }
    } catch (e) {}
    return r;
  };

  RSV82.toggleJamiRec = function () { lsSet(OK, on() ? '0' : '1'); sync(); };
  RSV82.setJamiN = function (n) { lsSet(NK, String(n)); sync(); };
  RSV82.setJamiMode = function (m) { lsSet(MK, m); sync(); };
  RSV82.clearJamiRecents = function () { lsSet(KEY, '[]'); toast('تم مسح سجل مسائل الجامع'); };
  function sync() {
    const t = $('jamiRecToggle'); if (t) t.classList.toggle('on', on());
    const n = getN(), m = getMode();
    document.querySelectorAll('#jamiRecNRow [data-jn]').forEach((b) => b.classList.toggle('on', +b.dataset.jn === n));
    document.querySelectorAll('#jamiRecModeRow [data-jm]').forEach((b) => b.classList.toggle('active', b.dataset.jm === m));
    try { RSV81.syncSubs(); } catch (e) {}
  }
  ['openSettings'].forEach((n) => {
    const f = window[n]; if (typeof f !== 'function') return;
    window[n] = function () { const r = f.apply(this, arguments); try { sync(); if (typeof syncSetting === 'function') syncSetting(); document.querySelectorAll('#recentNRow [data-n]').forEach((b) => b.classList.toggle('on', +b.dataset.n === (parseInt(lsGet('rs_recent_n', '4'), 10) || 4))); } catch (e) {} return r; };
  });

  const boot = () => { sync(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
