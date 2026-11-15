(function () {
  'use strict';
  const RSV112 = window.RSV112 = window.RSV112 || {};
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ar = (n) => (typeof arNum === 'function' ? arNum(n) : String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]));
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const V = () => window.RSV110 || {};
  const clean = (t, ch) => (V().cleanTitle ? V().cleanTitle(t, ch) : String(t || ''));
  const rng = (v) => (v.rangeStart === v.rangeEnd ? 'المسألة ' + ar(v.rangeStart) : 'المسائل ' + ar(v.rangeStart) + ' – ' + ar(v.rangeEnd));

  function barHtml(v) {
    return `<div class="vc" data-vid="${esc(v.videoId)}">
      <button type="button" class="vc-bar" aria-expanded="false" onclick="event.stopPropagation();RSV112.toggleBar(this)">
        <span class="vc-ic"><i class="ti ti-brand-youtube"></i></span>
        <span class="vc-tx"><b>${esc(v.channel)}</b><small>${esc(clean(v.title, v.channel))}</small></span>
        <i class="ti ti-chevron-down vc-chev"></i>
      </button>
      <div class="vc-body"><div class="vc-frame"></div><div class="vc-meta"><em>${rng(v)}</em></div></div>
    </div>`;
  }
  RSV112.toggleBar = function (btn) {
    const box = btn.closest('.vc'), fr = box.querySelector('.vc-frame');
    const open = box.classList.toggle('open'); btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      if (!fr.querySelector('iframe')) fr.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${esc(box.dataset.vid)}?rel=0" title="شرح" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>`;
      try { setTimeout(() => box.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80); } catch (e) {}
    } else { fr.innerHTML = ''; }
  };
  (function hook() {
    const g = window.renderSharhChooserHtml; if (typeof g !== 'function' || g.__v112) return;
    const w = function (sources, bookId, sectionIdx, num) {
      const vids = (sources || []).filter((x) => x.type === 'video'), rest = (sources || []).filter((x) => x.type !== 'video');
      if (!vids.length) return g.apply(this, arguments);
      let list = []; try { list = (sharhVideoIndex.get(`${bookId}::${num}`) || []).filter((v, i, a) => a.findIndex((z) => z.videoId === v.videoId) === i); } catch (e) {}
      const head = `<div class="sharh-acc-title vc-title-row"><span class="vt"><i class="ti ti-notebook"></i>شروحات هذه المسألة</span>
        <button type="button" class="vc-listbtn" onclick="event.stopPropagation();RSV112.openList(${bookId},'${esc(num)}')"><i class="ti ti-list-details"></i>القائمة</button></div>`;
      let text = '';
      if (rest.length) text = g.call(this, rest, bookId, sectionIdx, num).replace(/<div class="sharh-acc-title">[\s\S]*?<\/div>/, '');
      return head + text + `<div class="vc-bars">${list.map(barHtml).join('')}</div>`;
    };
    w.__v112 = true; window.renderSharhChooserHtml = w;
  })();

  let vl = null, st = { bookId: 0, num: 0, mode: 'masala', groups: [] };
  const closeVl = () => { if (!vl || !vl.classList.contains('show')) return false; vl.classList.remove('show'); document.body.classList.remove('svo-open'); return true; };
  RSV112.closeList = closeVl;
  function allVideos(bookId) {
    const all = [], seen = new Set();
    try { sharhVideoIndex.forEach((list, k) => { if (parseInt(k.split('::')[0], 10) !== bookId) return; list.forEach((v) => { const key = v.videoId + '|' + v.channel; if (!seen.has(key)) { seen.add(key); all.push(v); } }); }); } catch (e) {}
    all.sort((a, b) => (a.rangeStart - b.rangeStart) || (a.rangeEnd - b.rangeEnd) || String(a.channel).localeCompare(String(b.channel), 'ar'));
    return all;
  }
  function buildGroups(all, mode) {
    const map = new Map();
    all.forEach((v) => { const key = mode === 'channel' ? v.channel : String(v.rangeStart); if (!map.has(key)) map.set(key, { key, items: [], a: v.rangeStart, b: v.rangeStart, ch: v.channel }); const g = map.get(key); g.items.push(v); if (v.rangeEnd > g.b) g.b = v.rangeEnd; });
    return [...map.values()];
  }
  const inRange = (v, n) => n >= v.rangeStart && n <= v.rangeEnd;
  function render() {
    const all = allVideos(st.bookId), mode = st.mode, n = parseFloat(st.num);
    const groups = st.groups = buildGroups(all, mode);
    const listEl = vl.querySelector('.svo-list');
    let hereIdx = -1;
    if (mode === 'masala') { groups.forEach((g, gi) => { if (g.a <= n) hereIdx = gi; }); if (hereIdx >= 0 && !groups[hereIdx].items.some((v) => inRange(v, n))) hereIdx = groups.findIndex((g) => g.items.some((v) => inRange(v, n))); }
    listEl.innerHTML = groups.map((g, gi) => {
      const cur = mode === 'masala' ? gi === hereIdx : g.items.some((v) => inRange(v, n));
      const cnt = `<small>${ar(g.items.length)} ${g.items.length === 1 ? 'شرح' : (g.items.length === 2 ? 'شرحان' : (g.items.length <= 10 ? 'شروح' : 'شرحاً'))}</small>`;
      const title = mode === 'channel' ? `<i class="ti ti-brand-youtube"></i><span class="gt">${esc(g.ch)}</span>${cnt}` : `<i class="ti ti-hash"></i><span class="gt">المسألة ${ar(g.a)}</span>${cur ? '<em>أنت هنا</em>' : ''}${cnt}`;
      const rows = g.items.map((v) => {
        const here = inRange(v, n);
        const main = mode === 'channel' ? esc(clean(v.title, v.channel)) : esc(v.channel);
        const multi = v.rangeEnd > v.rangeStart;
        const sub = mode === 'channel' ? `<span class="vl2-rg">${rng(v)}</span>` : `${esc(clean(v.title, v.channel))}${multi ? `<span class="vl2-rg">المسائل ${ar(v.rangeStart)} – ${ar(v.rangeEnd)}</span>` : ''}`;
        return `<button type="button" class="vl2-row${here ? ' cur' : ''}" data-go="${v.rangeStart}"><span class="vl2-ic"><i class="ti ti-brand-youtube"></i></span><span class="vl2-m"><b>${main}</b><small>${sub}</small></span><i class="ti ti-chevron-left vl2-c"></i></button>`;
      }).join('');
      return `<section class="vl2-g${cur ? ' cur' : ''}" data-gi="${gi}"><h4 class="vl2-gh">${title}</h4>${rows}</section>`;
    }).join('') || '<div class="svo-empty">لا توجد شروحات مسجّلة لهذا الكتاب.</div>';
    const rg = vl.querySelector('.vl2-range'); rg.max = Math.max(0, groups.length - 1); rg.value = 0;
    vl.querySelector('.vl2-bar').style.display = groups.length > 1 ? '' : 'none';
    vl.querySelectorAll('.vl2-seg button').forEach((b) => b.classList.toggle('on', b.dataset.m === mode));
    syncPos();
    const cur = listEl.querySelector('.vl2-g.cur');
    setTimeout(() => { if (cur) listEl.scrollTop = Math.max(0, cur.offsetTop - 52); syncPos(); }, 60);
  }
  function groupAtTop() {
    const l = vl.querySelector('.svo-list'), gs = [...l.querySelectorAll('.vl2-g')]; let idx = 0;
    gs.forEach((g, i) => { if (g.offsetTop - 60 <= l.scrollTop + 4) idx = i; });
    return idx;
  }
  let lockRange = false;
  function syncPos() {
    if (!vl) return; const gs = st.groups; if (!gs.length) return;
    const i = groupAtTop(), g = gs[i], rg = vl.querySelector('.vl2-range');
    if (!lockRange) rg.value = i;
    rg.style.setProperty('--p', (gs.length > 1 ? (i / (gs.length - 1)) * 100 : 0) + '%');
    const lab = st.mode === 'channel' ? g.ch : 'المسألة ' + ar(g.a);
    vl.querySelector('.vl2-pos').innerHTML = `<b>${esc(lab)}</b><small>${ar(i + 1)} من ${ar(gs.length)}</small>`;
  }
  function goTo(target) {
    closeVl();
    const bookId = st.bookId;
    const blk = document.querySelector(`#readerPage .masala-block[data-masala="${target}"]`);
    if (blk) { try { blk.scrollIntoView({ behavior: 'smooth', block: 'start' }); const fl = blk.querySelector('.ms-sharh-flag'); const acc = blk.querySelector('.sharh-accordion'); if (fl && acc && !acc.classList.contains('open')) setTimeout(() => fl.click(), 450); } catch (x) {} }
    else { try { goToMasalaFromAccordion(bookId, String(target)); } catch (x) {} }
  }
  RSV112.openList = function (bookId, num) {
    st.bookId = bookId; st.num = num; st.mode = lsGet('rs_vl_mode', 'masala') === 'channel' ? 'channel' : 'masala';
    if (!vl) {
      vl = document.createElement('div'); vl.id = 'sharhVidOverlay'; vl.className = 'rs-vl vl2';
      vl.innerHTML = `<div class="svo-bg"></div><div class="svo-panel" role="dialog" aria-label="قائمة الشروحات"><div class="svo-grip"></div>
        <div class="svo-head"><div class="svo-t"><i class="ti ti-list-details"></i><span class="vl-t"></span></div><button type="button" class="svo-x" aria-label="إغلاق"><i class="ti ti-x"></i></button></div>
        <div class="vl2-seg" role="tablist"><button type="button" data-m="masala">حسب المسألة</button><button type="button" data-m="channel">حسب القناة</button></div>
        <div class="svo-list"></div>
        <div class="vl2-bar"><div class="vl2-pos"></div><input type="range" class="vl2-range" min="0" max="0" step="1" value="0" aria-label="التنقل بين المسائل"></div></div>`;
      document.body.appendChild(vl);
      vl.querySelector('.svo-bg').onclick = vl.querySelector('.svo-x').onclick = closeVl;
      vl.querySelector('.vl2-seg').onclick = (e) => { const b = e.target.closest('[data-m]'); if (!b || b.dataset.m === st.mode) return; st.mode = b.dataset.m; lsSet('rs_vl_mode', st.mode); render(); vl.querySelector('.svo-list').scrollTop = 0; syncPos(); };
      const listEl = vl.querySelector('.svo-list');
      listEl.addEventListener('scroll', () => { if (!lockRange) syncPos(); }, { passive: true });
      listEl.onclick = (e) => { const b = e.target.closest('[data-go]'); if (b) goTo(b.dataset.go); };
      const rg = vl.querySelector('.vl2-range');
      rg.addEventListener('input', () => {
        lockRange = true; const g = listEl.querySelectorAll('.vl2-g')[+rg.value];
        if (g) listEl.scrollTop = Math.max(0, g.offsetTop - 52);
        const gs = st.groups, i = +rg.value, gg = gs[i]; rg.style.setProperty('--p', (gs.length > 1 ? (i / (gs.length - 1)) * 100 : 0) + '%');
        if (gg) vl.querySelector('.vl2-pos').innerHTML = `<b>${esc(st.mode === 'channel' ? gg.ch : 'المسألة ' + ar(gg.a))}</b><small>${ar(i + 1)} من ${ar(gs.length)}</small>`;
        clearTimeout(rg._t); rg._t = setTimeout(() => { lockRange = false; }, 160);
      });
    }
    let book = null; try { book = allBooks.find((b) => b.id === bookId); } catch (e) {}
    vl.querySelector('.vl-t').textContent = 'قائمة الشروحات' + (book ? ' · ' + book.name : '');
    render();
    document.body.classList.add('svo-open'); vl.classList.add('show');
  };
  if (window.RSV110) { window.RSV110.videoList = (bookId, channel, num) => RSV112.openList(bookId, num); window.RSV110.closeVl = closeVl; }

  const selMode = () => { const m = lsGet('rs_sel_mode', ''); if (m === 'app' || m === 'system' || m === 'none') return m; return lsGet('rs_custom_select', '1') === '0' ? 'system' : 'app'; };
  function paintSel() {
    const m = selMode();
    document.body.classList.toggle('sel-none', m === 'none');
    document.body.classList.toggle('sel-system', m === 'system');
    document.querySelectorAll('#selModeControls [data-selmode]').forEach((b) => b.classList.toggle('active', b.dataset.selmode === m));
  }
  RSV112.setSelMode = function (m) {
    lsSet('rs_sel_mode', m);
    const wantApp = m === 'app', isApp = lsGet('rs_custom_select', '1') !== '0';
    if (wantApp !== isApp && typeof window.rsToggleCustomSelect === 'function') window.rsToggleCustomSelect();
    else lsSet('rs_custom_select', wantApp ? '1' : '0');
    paintSel();
    try { const sel = getSelection(); if (sel && !wantApp && m === 'none') sel.removeAllRanges(); } catch (e) {}
  };
  const inReading = (t) => !!(t && t.closest && t.closest('#readerPage, #comparisonPage, #writingViewPage, .split-pane'));
  document.addEventListener('contextmenu', (e) => { if (selMode() !== 'system' && inReading(e.target) && !e.target.closest('input, textarea, [contenteditable="true"]')) e.preventDefault(); }, true);
  document.addEventListener('selectionchange', () => {
    const m = selMode(); if (m === 'system') return;
    try { const sel = getSelection(); if (!sel || sel.isCollapsed || !sel.anchorNode) return; const n = sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement; if (m === 'none' && inReading(n)) sel.removeAllRanges(); } catch (e) {}
  });
  const sty = document.createElement('style');
  sty.textContent = 'body.sel-none #readerPage, body.sel-none #comparisonPage, body.sel-none .split-pane { -webkit-user-select: none !important; user-select: none !important; -webkit-touch-callout: none !important; }';
  document.head.appendChild(sty);
  paintSel();
  const _oas2 = window.openAdvancedSettings;
  if (typeof _oas2 === 'function') window.openAdvancedSettings = function () { const r = _oas2.apply(this, arguments); paintSel(); return r; };

  const MUST = new Set(); for (let i = 114; i <= 127; i++) MUST.add('bk' + i);
  function warnGroup(id) {
    try {
      const b = allBooks.find((x) => x.id === id); if (!b) return null;
      if (isUrwaBook(id)) return 'urwa';
      if (b.bk_table === 'bk_thamra') return 'thamra';
      if (MUST.has(b.bk_table) || /مستمسك/.test(b.name || '')) return 'must';
    } catch (e) {}
    return null;
  }
  const FN = {
    urwa:   { t: 'عن هوامش العروة الوثقى', lvl: 'soft', x: 'استخرجنا هذه الهوامش وراجعناها بجهد كبير، وحاولنا أن تكون بأعلى درجة من الصحة نستطيعها. ومع ذلك قد يقع في بعض المواضع {{خطأ أو سقط}}، فراجع المصدر الأصلي قبل الاعتماد عليها.' },
    thamra: { t: 'عن هوامش الثمرة', lvl: 'soft', x: 'تابعنا هوامش هذا الكتاب وصحّحناها قدر الإمكان بأعلى درجة من الصحة. ومع ذلك قد يبقى في بعض المواضع {{خطأ أو سقط}}، فراجع المصدر عند الحاجة.' },
    must:   { t: 'تنبيه عن هوامش مستمسك العروة', lvl: 'strong', cls: 'must', x: 'أُضيفت هوامش هذا الكتاب {{آلياً وبسرعة كبيرة}}، على خلاف بقية الكتب التي تابعناها بتأنٍّ، فاحتمال الخطأ والسقط فيها أعلى بكثير. لا تعتمد عليها وحدها، وراجع المصدر الأصلي قبل العمل بها.', ok: 'عَلِمتُ',
      follow: { t: 'كلمة أخيرة عن هذا الكتاب', lvl: 'strong', cls: 'must', x: 'هوامش مستمسك العروة وُضعت بصورة {{آلية بالكامل}}، فلا تجعل ما تجده فيها من أخطاء مقياساً لبقية الكتب؛ فقد أُتيح لسائر الكتب من الوقت والرعاية والمراجعة ما لم يتّسع له هذا الكتاب.', ok: 'حسناً', ic: 'heart-handshake' } }
  };
  const fnSeen = () => { try { const o = JSON.parse(lsGet('rs_fnwarn_seen', '{}')); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } };
  let fnEl = null, fnT = 0, fnBook = null, fnJami = false;
  function fnClose() { clearTimeout(fnT); window.__fnEnd = Date.now(); if (fnEl) { fnEl.classList.remove('show'); const e = fnEl; setTimeout(() => { if (e && !e.classList.contains('show')) e.remove(); }, 350); if (fnEl === e) fnEl = null; } }
  function fnCard(d) {
    fnClose();
    const el = document.createElement('div'); el.id = 'fnNotice'; el.className = 'fn-' + d.lvl + (d.cls ? ' fn-' + d.cls : ''); el.setAttribute('role', d.lvl === 'strong' ? 'alertdialog' : 'status');
    const txt = esc(d.x).replace(/\{\{(.+?)\}\}/g, '<mark class="fnn-key">$1</mark>');
    const ic = d.ic || (d.lvl === 'strong' ? 'alert-triangle' : 'info-circle');
    el.innerHTML = `<div class="fnn-scrim"></div><div class="fnn-card">
      <span class="fnn-grip"></span>
      <div class="fnn-hd"><span class="fnn-ic"><i class="ti ti-${ic}"></i></span><b>${esc(d.t)}</b></div>
      <p>${txt}</p>
      <div class="fnn-ft"><a href="https://t.me/Mshkaah" target="_blank" rel="noopener"><i class="ti ti-brand-telegram"></i><bdi>t.me/Mshkaah</bdi></a><button type="button" class="fnn-ok" ${d.lvl === 'strong' ? 'disabled' : ''}>${esc(d.ok || 'حسناً')}</button></div>
      ${d.lvl === 'soft' ? '<i class="fnn-bar"></i>' : ''}</div>`;
    document.body.appendChild(el); fnEl = el;
    el.querySelector('.fnn-ok').onclick = () => { fnClose(); if (d.follow) setTimeout(() => fnCard(d.follow), 420); };
    el.querySelector('.fnn-scrim').onclick = () => { if (d.lvl === 'soft') fnClose(); };
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
    if (d.lvl === 'strong') setTimeout(() => { const b = el.querySelector('.fnn-ok'); if (b) b.disabled = false; }, 1200);
    else fnT = setTimeout(fnClose, 10000);
  }
  function fnShow(g, force) {
    const d = FN[g]; if (!d) return;
    if (!force) { const m = fnSeen(); if (m[g]) return; m[g] = 1; try { lsSet('rs_fnwarn_seen', JSON.stringify(m)); } catch (e) {} }
    fnCard(d);
  }
  function fnTick() {
    try {
      const cp = $('comparisonPage'), r = $('readerPage');
      const jami = !!(cp && cp.classList.contains('active'));
      const on = !!(r && r.classList.contains('active'));
      if (jami) { return; }
      if (fnJami) { fnJami = false; if (fnEl && fnEl.classList.contains('fn-soft')) fnClose(); }
      if (!on) { if (fnBook !== null) { fnBook = null; if (fnEl && fnEl.classList.contains('fn-soft')) fnClose(); } return; }
      if (fnBook === currentBookId) return;
      fnBook = currentBookId;
      const g = warnGroup(currentBookId);
      if (g && !fnSeen()[g]) setTimeout(() => { if (fnBook === currentBookId) fnShow(g); }, 120); else if (!g) fnClose();
    } catch (e) {}
  }
  window.setInterval(fnTick, 300);
  RSV112.previewWarn = (g) => fnShow(g, true);

  (function () {
    const c = $('content'); if (!c) return;
    let raf = 0, dwell = 0, pill = null, pillT = 0, lastScroll = 0, down = false, settleT = 0;
    const atEnd = () => c.scrollTop + c.clientHeight >= c.scrollHeight - 110;
    const inReader = () => { const r = $('readerPage'); return !!(r && r.classList.contains('active')); };
    function hidePill() { clearTimeout(dwell); dwell = 0; document.body.classList.remove('rs-nudging'); }
    function showPill() { document.body.classList.remove('rs-nudging'); void document.body.offsetWidth; document.body.classList.add('rs-nudging'); }
    function check() {
      raf = 0;
      const end = atEnd();
      document.body.classList.remove('nav-end');
      let pages = false; try { pages = isPageFlipMode(); } catch (e) {}
      const exact = c.scrollTop + c.clientHeight >= c.scrollHeight - 3;
      let can = false; try { can = inReader() && pages && exact && currentSectionIndex < currentSections.length - 1; } catch (e) {}
      if (!can) { if (dwell) hidePill(); return; }
      if (dwell) return;
      if (down || performance.now() - lastScroll < 120) { clearTimeout(settleT); settleT = setTimeout(() => { if (!raf) raf = requestAnimationFrame(check); }, 140); return; }
      showPill();
      dwell = setTimeout(() => { dwell = 0; try { if (!down && atEnd() && inReader()) { hidePill(); navSection(1); } else hidePill(); } catch (e) {} }, 700);
    }
    c.addEventListener('scroll', () => { lastScroll = performance.now(); if (!raf) raf = requestAnimationFrame(check); }, { passive: true });
    ['touchstart', 'pointerdown'].forEach((ev) => document.addEventListener(ev, () => { down = true; if (dwell) hidePill(); }, { passive: true, capture: true }));
    ['touchend', 'touchcancel', 'pointerup', 'pointercancel'].forEach((ev) => document.addEventListener(ev, () => { down = false; if (!raf) raf = requestAnimationFrame(check); }, { passive: true, capture: true }));
  })();

  (function () {
    const page = $('comparisonPage'); if (!page) return;
    page.addEventListener('click', (e) => {
      if (e.target.closest('.cmp-card-tools, .ext-tools, button, a, .gterm, .note-area, textarea, input')) return;
      const card = e.target.closest('.cmp-answer-card, .cmp-question-box');
      const was = card && card.classList.contains('touched');
      page.querySelectorAll('.cmp-answer-card.touched, .cmp-question-box.touched').forEach((x) => x.classList.remove('touched'));
      if (card && !was) card.classList.add('touched');
    });
  })();
})();

