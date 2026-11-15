(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ar = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
  const toEn = (s) => String(s == null ? '' : s).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const RSV144 = window.RSV144 = window.RSV144 || {};
  const content = () => $('content');

  (function () {
    const R = window.RSV112 = window.RSV112 || {};
    const clean = (t, ch) => { try { return window.RSV110 && RSV110.cleanTitle ? RSV110.cleanTitle(t, ch) : String(t || ''); } catch (e) { return String(t || ''); } };
    const rng = (v) => (v.rangeStart === v.rangeEnd ? 'المسألة ' + ar(v.rangeStart) : 'المسائل ' + ar(v.rangeStart) + ' – ' + ar(v.rangeEnd));
    let vl = null; const st = { bookId: 0, num: 0, mode: 'masala', ch: '', all: [] };

    function allVideos(bookId) {
      const all = [], seen = new Set();
      try { sharhVideoIndex.forEach((list, k) => { if (parseInt(k.split('::')[0], 10) !== bookId) return; list.forEach((v) => { const key = v.videoId + '|' + v.channel; if (!seen.has(key)) { seen.add(key); all.push(v); } }); }); } catch (e) {}
      all.sort((a, b) => (a.rangeStart - b.rangeStart) || (a.rangeEnd - b.rangeEnd) || String(a.channel).localeCompare(String(b.channel), 'ar'));
      return all;
    }
    const inRange = (v, n) => n >= v.rangeStart && n <= v.rangeEnd;
    const plural = (k) => (k === 1 ? 'شرح' : k === 2 ? 'شرحان' : k <= 10 ? 'شروح' : 'شرحاً');

    function close() { if (!vl || !vl.classList.contains('show')) return false; vl.classList.remove('show'); document.body.classList.remove('svo-open'); return true; }
    R.closeList = close;

    function renderChips() {
      const box = vl.querySelector('.v3-chips'); const chans = new Map();
      st.all.forEach((v) => chans.set(v.channel, (chans.get(v.channel) || 0) + 1));
      if (chans.size < 2) { box.style.display = 'none'; box.innerHTML = ''; return; }
      box.style.display = '';
      let h = `<button type="button" class="v3-chip${st.ch === '' ? ' on' : ''}" data-ch="">الكل<em>${ar(st.all.length)}</em></button>`;
      chans.forEach((n, ch) => { h += `<button type="button" class="v3-chip${st.ch === ch ? ' on' : ''}" data-ch="${esc(ch)}">${esc(ch)}<em>${ar(n)}</em></button>`; });
      box.innerHTML = h;
    }
    function render() {
      const n = parseFloat(st.num), listEl = vl.querySelector('.svo-list');
      const vids = st.ch ? st.all.filter((v) => v.channel === st.ch) : st.all;
      const map = new Map();
      vids.forEach((v) => { const key = st.mode === 'channel' ? v.channel : String(v.rangeStart); if (!map.has(key)) map.set(key, { items: [], a: v.rangeStart, ch: v.channel }); map.get(key).items.push(v); });
      const groups = [...map.values()];
      let hereIdx = -1;
      if (st.mode === 'masala') { groups.forEach((g, gi) => { if (g.a <= n) hereIdx = gi; }); if (hereIdx >= 0 && !groups[hereIdx].items.some((v) => inRange(v, n))) hereIdx = groups.findIndex((g) => g.items.some((v) => inRange(v, n))); }
      listEl.innerHTML = groups.map((g, gi) => {
        const cur = st.mode === 'masala' ? gi === hereIdx : g.items.some((v) => inRange(v, n));
        const cnt = `<small>${ar(g.items.length)} ${plural(g.items.length)}</small>`;
        const title = st.mode === 'channel'
          ? `<span class="gt">${esc(g.ch)}</span>${cnt}`
          : `<span class="gt">المسألة ${ar(g.a)}</span>${cur ? '<em>أنت هنا</em>' : ''}${cnt}`;
        const rows = g.items.map((v) => {
          const here = inRange(v, n), multi = v.rangeEnd > v.rangeStart;
          const main = st.mode === 'channel' ? esc(clean(v.title, v.channel)) : esc(v.channel);
          const sub = st.mode === 'channel' ? `<span class="v3-rg">${rng(v)}</span>` : `${esc(clean(v.title, v.channel))}${multi ? `<span class="v3-rg">المسائل ${ar(v.rangeStart)} – ${ar(v.rangeEnd)}</span>` : ''}`;
          return `<button type="button" class="v3-row${here ? ' cur' : ''}" data-go="${v.rangeStart}" data-a="${v.rangeStart}" data-b="${v.rangeEnd}"><span class="v3-ic"><i class="ti ti-player-play"></i></span><span class="v3-m"><b>${main}</b><small>${sub}</small></span><i class="ti ti-chevron-left v3-c"></i></button>`;
        }).join('');
        return `<section class="v3-g${cur ? ' cur' : ''}"><h4 class="v3-gh">${title}</h4>${rows}</section>`;
      }).join('') || '<div class="svo-empty">لا توجد شروحات مسجّلة.</div>';
      vl.querySelectorAll('.v3-seg button').forEach((b) => b.classList.toggle('on', b.dataset.m === st.mode));
      const first = vids.length ? Math.min.apply(null, vids.map((v) => v.rangeStart)) : 0, last = vids.length ? Math.max.apply(null, vids.map((v) => v.rangeEnd)) : 0;
      const inp = vl.querySelector('.v3-num'); inp.placeholder = vids.length ? `${ar(first)} – ${ar(last)}` : '';
      renderChips();
      setTimeout(() => { const c = listEl.querySelector('.v3-g.cur'); listEl.scrollTop = c ? Math.max(0, c.getBoundingClientRect().top - listEl.getBoundingClientRect().top + listEl.scrollTop - 4) : 0; }, 40);
    }
    function jump(n) {
      if (!(n >= 0)) return false;
      const listEl = vl.querySelector('.svo-list'); const rows = [...listEl.querySelectorAll('.v3-row')]; if (!rows.length) return false;
      let best = null, bd = Infinity;
      rows.forEach((r) => { const a = +r.dataset.a, b = +r.dataset.b; const d = (n >= a && n <= b) ? 0 : (n < a ? a - n : n - b); if (d < bd) { bd = d; best = r; } });
      if (!best) return false;
      const g = best.closest('.v3-g');
      const lr = listEl.getBoundingClientRect(), br = best.getBoundingClientRect(); listEl.scrollTo({ top: Math.max(0, br.top - lr.top + listEl.scrollTop - 44), behavior: 'smooth' });
      best.classList.remove('flash'); void best.offsetWidth; best.classList.add('flash');
      return true;
    }
    function goTo(target) {
      close(); const bookId = st.bookId;
      const blk = document.querySelector(`#readerPage .masala-block[data-masala="${target}"]`);
      if (blk) { try { blk.scrollIntoView({ behavior: 'smooth', block: 'start' }); const fl = blk.querySelector('.ms-sharh-flag'); const acc = blk.querySelector('.sharh-accordion'); if (fl && acc && !acc.classList.contains('open')) setTimeout(() => fl.click(), 450); } catch (x) {} }
      else { try { goToMasalaFromAccordion(bookId, String(target)); } catch (x) {} }
    }
    function build() {
      const old = $('sharhVidOverlay'); if (old && !old.classList.contains('vl3')) old.remove();
      vl = document.createElement('div'); vl.id = 'sharhVidOverlay'; vl.className = 'rs-vl vl3';
      vl.innerHTML = `<div class="svo-bg"></div><div class="svo-panel" role="dialog" aria-label="قائمة الشروحات"><div class="svo-grip"></div>
        <div class="svo-head"><div class="svo-t"><i class="ti ti-brand-youtube"></i><span class="vl-t"></span></div><button type="button" class="svo-x" aria-label="إغلاق"><i class="ti ti-x"></i></button></div>
        <div class="v3-chips" role="tablist" aria-label="القناة"></div>
        <div class="v3-seg" role="tablist"><button type="button" data-m="masala">حسب المسألة</button><button type="button" data-m="channel">حسب القناة</button></div>
        <div class="svo-list"></div>
        <div class="v3-bar"><button type="button" class="v3-here"><i class="ti ti-current-location"></i><span>موضعي</span></button>
          <label class="v3-jump"><i class="ti ti-hash"></i><input class="v3-num" type="text" inputmode="numeric" enterkeyhint="go" autocomplete="off" placeholder="رقم المسألة" aria-label="الانتقال إلى مسألة برقمها"></label>
          <button type="button" class="v3-go">اذهب</button></div></div>`;
      document.body.appendChild(vl);
      vl.querySelector('.svo-bg').onclick = vl.querySelector('.svo-x').onclick = close;
      vl.querySelector('.v3-seg').onclick = (e) => { const b = e.target.closest('[data-m]'); if (!b || b.dataset.m === st.mode) return; st.mode = b.dataset.m; lsSet('rs_vl_mode', st.mode); render(); };
      vl.querySelector('.v3-chips').onclick = (e) => { const b = e.target.closest('[data-ch]'); if (!b) return; st.ch = b.dataset.ch; lsSet('rs_vl_ch_' + st.bookId, st.ch); render(); };
      const listEl = vl.querySelector('.svo-list');
      listEl.onclick = (e) => { const b = e.target.closest('[data-go]'); if (b) goTo(b.dataset.go); };
      const inp = vl.querySelector('.v3-num');
      const run = () => { const n = parseFloat(toEn(inp.value)); if (isNaN(n)) { inp.focus(); return; } jump(n); inp.blur(); };
      vl.querySelector('.v3-go').onclick = run;
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); run(); } });
      vl.querySelector('.v3-here').onclick = () => { inp.value = ''; jump(parseFloat(st.num)); };
    }
    R.openList = function (bookId, num) {
      st.bookId = bookId; st.num = num; st.mode = lsGet('rs_vl_mode', 'masala') === 'channel' ? 'channel' : 'masala';
      st.all = allVideos(bookId);
      st.ch = lsGet('rs_vl_ch_' + bookId, '');
      if (st.ch && !st.all.some((v) => v.channel === st.ch)) st.ch = '';
      if (!vl || !vl.isConnected || !vl.classList.contains('vl3')) build();
      let book = null; try { book = allBooks.find((b) => b.id === bookId); } catch (e) {}
      vl.querySelector('.vl-t').textContent = 'الشروحات' + (book ? ' · ' + book.name : '');
      vl.querySelector('.v3-num').value = '';
      render();
      document.body.classList.add('svo-open'); vl.classList.add('show');
    };
    if (window.RSV110) { window.RSV110.videoList = (bookId, channel, num) => R.openList(bookId, num); }
  })();

  window.renderSearchPagination = function (totalPages) {
    const box = $('searchPagination'); if (!box) return;
    if (totalPages <= 1) { box.innerHTML = ''; return; }
    const cur = Math.min(Math.max(1, searchCurrentPage), totalPages);
    const set = new Set([1, totalPages, cur - 1, cur, cur + 1]);
    if (cur <= 3) { set.add(2); set.add(3); set.add(4); }
    if (cur >= totalPages - 2) { set.add(totalPages - 1); set.add(totalPages - 2); set.add(totalPages - 3); }
    const pages = [...set].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
    let nums = '', prev = 0;
    pages.forEach((p) => {
      if (prev && p - prev > 1) nums += `<button type="button" class="pg2-gap" data-gap="1" aria-label="اختيار رقم الصفحة">…</button>`;
      nums += `<button type="button" class="pg2-n${p === cur ? ' on' : ''}" data-p="${p}"${p === cur ? ' aria-current="page"' : ''}>${p}</button>`; prev = p;
    });
    box.innerHTML = `<div class="pg2">
      <div class="pg2-row"><button type="button" class="pg2-step" data-p="${cur - 1}" aria-label="السابق" ${cur <= 1 ? 'disabled' : ''}><i class="ti ti-chevron-right"></i></button>
      <div class="pg2-nums">${nums}</div>
      <button type="button" class="pg2-step" data-p="${cur + 1}" aria-label="التالي" ${cur >= totalPages ? 'disabled' : ''}><i class="ti ti-chevron-left"></i></button></div>
      <div class="pg2-jump"><span>صفحة <b>${cur}</b> من <b>${totalPages}</b></span>
        <label class="pg2-in"><input type="text" inputmode="numeric" enterkeyhint="go" autocomplete="off" placeholder="رقم الصفحة" aria-label="الانتقال إلى صفحة"></label><button type="button" class="pg2-go">اذهب</button></div></div>`;
    box.dataset.total = String(totalPages);
  };
  document.addEventListener('click', (e) => {
    const box = $('searchPagination'); if (!box || !box.contains(e.target)) return;
    const total = parseInt(box.dataset.total, 10) || 1;
    const nb = e.target.closest('[data-p]');
    if (nb && !nb.disabled) { const p = parseInt(nb.dataset.p, 10); if (p >= 1 && p <= total && p !== searchCurrentPage) goToSearchPage(p); return; }
    if (e.target.closest('[data-gap]')) { const i = box.querySelector('.pg2-in input'); if (i) i.focus(); return; }
    if (e.target.closest('.pg2-go')) { const i = box.querySelector('.pg2-in input'); const p = parseInt(toEn(i.value), 10); if (p >= 1 && p <= total) goToSearchPage(p); else { i.value = ''; i.focus(); } }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || !e.target.closest || !e.target.closest('#searchPagination .pg2-in')) return;
    e.preventDefault(); const box = $('searchPagination'); const total = parseInt(box.dataset.total, 10) || 1; const p = parseInt(toEn(e.target.value), 10);
    if (p >= 1 && p <= total) { e.target.blur(); goToSearchPage(p); }
  });

  const TB_KEY = 'rs_tbhide';
  const tbHide = () => lsGet(TB_KEY, '0') === '1';
  let tbAway = false, tLast = 0, tAcc = 0, tbFrozenUntil = 0;
  RSV144.freezeTopbar = (ms) => { tbFrozenUntil = Date.now() + ms; tAcc = 0; };
  function setAway(on) {
    const tb = $('topbar'); if (!tb) return;
    if (on === tbAway) return;
    if (on) document.documentElement.style.setProperty('--tb-h', tb.offsetHeight + 'px');
    tbAway = on; document.body.classList.toggle('tb-away', on);
  }
  function tbScroll() {
    const c = content(); if (!c) return;
    const t = c.scrollTop, d = t - tLast; tLast = t;
    if (Date.now() < tbFrozenUntil) return;
    if (!tbHide() || document.body.classList.contains('embedded-mode')) { if (tbAway) setAway(false); tAcc = 0; return; }
    if (t < 40) { tAcc = 0; setAway(false); return; }
    if (!d) return;
    tAcc = ((d > 0) === (tAcc > 0)) ? tAcc + d : d;
    if (!tbAway && tAcc > 44 && t > 120) setAway(true);
    else if (tbAway && tAcc < -26) setAway(false);
  }
  function paintTbControls() {
    document.querySelectorAll('#tbModeControls [data-tbmode]').forEach((b) => b.classList.toggle('active', (b.dataset.tbmode === 'hide') === tbHide()));
  }
  RSV144.setTbMode = function (m) {
    lsSet(TB_KEY, m === 'hide' ? '1' : '0'); document.body.classList.toggle('tb-auto', m === 'hide');
    if (m !== 'hide') setAway(false); paintTbControls();
  };
  function startTb() {
    const c = content(); if (!c) return setTimeout(startTb, 400);
    document.body.classList.toggle('tb-auto', tbHide());
    c.addEventListener('scroll', tbScroll, { passive: true });
    paintTbControls();
    const sp = window.switchPage;
    if (typeof sp === 'function') window.switchPage = function () { try { setAway(false); tAcc = 0; } catch (e) {} return sp.apply(this, arguments); };
    const os = window.openSettings;
    if (typeof os === 'function') window.openSettings = function () { try { setAway(false); } catch (e) {} const r = os.apply(this, arguments); try { paintTbControls(); } catch (e) {} return r; };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startTb); else startTb();

  function exclusiveTools() {
    const defs = [['toggleSearchOpts', 'searchOptsBtn'], ['toggleSearchWordsRows', 'searchWordsToggle'], ['toggleSearchFilterPanel', 'searchFilterToggle']];
    const orig = {};
    defs.forEach(([fn]) => { orig[fn] = window[fn]; });
    if (defs.some(([fn]) => typeof orig[fn] !== 'function')) return setTimeout(exclusiveTools, 500);
    defs.forEach(([fn, id]) => {
      window[fn] = function (force) {
        const me = $(id);
        if (me && !me.classList.contains('on') && force !== true) {
          defs.forEach(([ofn, oid]) => { const ob = $(oid); if (ofn !== fn && ob && ob.classList.contains('on')) { try { orig[ofn](true); } catch (e) {} if (ob.classList.contains('on')) { try { orig[ofn](); } catch (e) {} } } });
        }
        return orig[fn].apply(this, arguments);
      };
    });
  }
  exclusiveTools();
})();
