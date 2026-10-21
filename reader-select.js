(function () {
  'use strict';
  const PREF = 'rs_custom_select', HKEY = 'rs_highlights', PKEY = 'rs_sel_pinned', NKEY = 'rs_xnote_mode', GKEY = 'rs_cs_gest', HPKEY = 'rs_hl_prefs', GTKEY = 'rs_gterm_mode';
  const COLORS = ['#ffd43b', '#51cf66', '#ff8cc6', '#4dabf7', '#ff922b', '#b197fc'];
  const HL_QUICK = [0, 1, 2, 3];
  const STAR_QUICK = ['gold', 'red', 'green', 'blue'];
  const SEL_CONT = '#readerPage .body-text, #customBookPage .cb-item-body, #writingPage .wr-read-body, #comparisonPage .cmp-answer-text, #comparisonPage .cmp-question-text';
  const SKIP = '.masala-tools, .cmp-card-tools, button, .note-display, .note-accordion, .cs-xnote, .fn-ref, .footnote-box, script, style';
  const GT = '.gterm';
  const CKEY = 'rs_cs_colored';
  const CMENU = { hl: '#f08c00', star: '#e0a800', note: '#1c7ed6', book: '#2f9e44', remind: '#e03131', share: '#7048e8' };
  const NO_TAP = 'button, a, .fn-ref, .masala-tools, .section-title, .note-display, .note-accordion, .cs-xnote, input, textarea, .fn-body';

  const ACTIONS = [
    { id: 'copy', icon: 'copy', label: 'نسخ', av: 'any' },
    { id: 'plain', icon: 'clipboard-text', label: 'نسخ بلا مصدر', short: 'بلا مصدر', av: 'any' },
    { id: 'share', icon: 'share-3', label: 'مشاركة', av: 'any' },
    { id: 'hl', icon: 'palette', label: 'تظليل', av: 'reader' },
    { id: 'star', icon: 'star', label: 'نجمة', av: 'reader' },
    { id: 'note', icon: 'pencil', label: 'ملاحظة', av: 'reader' },
    { id: 'book', icon: 'file-plus', label: 'إضافة إلى كتاب', short: 'إلى كتاب', av: 'reader' },
    { id: 'remind', icon: 'bell', label: 'تذكير', av: 'reader' },
    { id: 'all', icon: 'select-all', label: 'تحديد الفصل كله', short: 'الفصل', av: 'any' },
    { id: 'above', icon: 'arrow-bar-up', label: 'تحديد المسألة العليا', short: 'العليا', av: 'reader' },
    { id: 'below', icon: 'arrow-bar-down', label: 'تحديد المسألة السفلى', short: 'السفلى', av: 'reader' },
    { id: 'wiki', icon: 'world-search', label: 'بحث في ويكي شيعة', short: 'ويكي شيعة', av: 'any' },
    { id: 'fix', icon: 'message-report', label: 'إرسال تصحيح', short: 'تصحيح', av: 'reader' },
    { id: 'clear', icon: 'x', label: 'إلغاء التحديد', short: 'إلغاء', av: 'any' }
  ];
  const DEFAULT_PINNED = ['copy', 'hl'];
  const A = (id) => ACTIONS.find((x) => x.id === id);

  const supported = !!(window.CSS && CSS.highlights && window.Highlight);
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const enabled = () => supported && lsGet(PREF, '1') !== '0';
  const toast = (m) => { try { showGenericToast(m); } catch (e) {} };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function getPinned() {
    try { const a = JSON.parse(lsGet(PKEY, 'null')); if (Array.isArray(a)) return a.filter((id) => A(id)); } catch (e) {}
    return DEFAULT_PINNED.slice();
  }
  const setPinned = (a) => lsSet(PKEY, JSON.stringify(a));
  const noteMode = () => { const m = lsGet(NKEY, 'show'); return m === 'icon' || m === 'hide' ? m : 'show'; };
  const GEST_DEF = { copyLong: 'share', starDbl: 1, starLong: 1, hlMode: 'tap', starMode: 'tap', hlDbl: 1, hlLong: 1 };
  function getGest() { try { return Object.assign({}, GEST_DEF, JSON.parse(lsGet(GKEY, '{}')) || {}); } catch (e) { return Object.assign({}, GEST_DEF); } }
  const setGest = (o) => lsSet(GKEY, JSON.stringify(Object.assign(getGest(), o)));
  function getHlPrefs() { try { const p = JSON.parse(lsGet(HPKEY, '{}')) || {}; const ok = (v, d) => (Number.isInteger(v) && COLORS[v] ? v : d); return { single: ok(p.single, 0), double: ok(p.double, 1) }; } catch (e) { return { single: 0, double: 1 }; } }
  const setHlPrefs = (p) => lsSet(HPKEY, JSON.stringify(p));
  const gtMode = () => (lsGet(GTKEY, 'meaning') === 'select' ? 'select' : 'meaning');

  function rgbaOf(hex, a) { const h = String(hex).replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }
  const css = document.createElement('style');
  css.textContent = `
  body.cs-on ${SEL_CONT.split(',').map(s => s.trim()).join(', body.cs-on ')} { -webkit-user-select:none; user-select:none; -webkit-touch-callout:none; -webkit-tap-highlight-color:transparent; }
  ::highlight(rs-sel) { background-color: rgba(var(--accent-rgb, 70,130,230), .32); }
  ::highlight(rs-flash) { background-color: rgba(var(--accent-rgb, 70,130,230), .5); }
  ::highlight(rs-note) { text-decoration: underline dotted; text-decoration-thickness: 2px; text-underline-offset: 5px; }
  ${COLORS.map((c, i) => `::highlight(rs-hl-${i}) { background-color: ${rgbaOf(c, .46)}; }\n  body.night-mode ::highlight(rs-hl-${i}) { background-color: ${rgbaOf(c, .36)}; }`).join('\n')}
  #csChoose { position:fixed; z-index:143; display:none; flex-direction:column; min-width:150px; padding:4px; border-radius:13px; background:var(--surface,#fff); color:var(--text); border:1px solid var(--line-strong,rgba(0,0,0,.15)); box-shadow:0 10px 30px rgba(var(--shadow-rgb,0,0,0),.3); direction:rtl; }
  body.night-mode #csChoose { background:#1d1d1d; color:#eee; }
  #csChoose button { all:unset; display:flex; align-items:center; gap:10px; min-height:42px; padding:0 12px; border-radius:9px; font-size:14px; font-weight:600; cursor:pointer; }
  #csChoose button i { font-size:19px; color:var(--accent-text,var(--accent)); }
  #csChoose button:active { background:rgba(var(--accent-rgb,70,130,230),.15); }
  #readerPage .cs-xnote, #comparisonPage .cs-xnote { font-weight:400; font-style:normal; text-decoration:none; text-indent:0; }
  .cs-handle { position:fixed; z-index:140; width:30px; height:44px; margin:-4px 0 0 -15px; touch-action:none; display:none; }
  .cs-handle::before { content:''; position:absolute; left:14px; top:0; width:2px; height:16px; background:var(--accent); }
  .cs-handle::after { content:''; position:absolute; left:6px; top:14px; width:18px; height:18px; border-radius:50%; background:var(--accent); box-shadow:0 1px 4px rgba(0,0,0,.35); }
  #csBar { position:fixed; z-index:141; display:none; align-items:center; justify-content:center; flex-wrap:wrap; gap:1px; padding:4px 5px; border-radius:12px; background:var(--text); color:var(--bg); box-shadow:0 6px 22px rgba(var(--shadow-rgb,0,0,0),.35); font-size:13.5px; font-weight:700; max-width:min(94vw, 340px); direction:rtl; }
  #csBar button { all:unset; display:flex; align-items:center; gap:5px; min-height:36px; min-width:36px; box-sizing:border-box; justify-content:center; padding:0 9px; border-radius:9px; cursor:pointer; color:inherit; font:inherit; -webkit-touch-callout:none; -webkit-user-select:none; user-select:none; touch-action:manipulation; }
  #csBar button i { font-size:18px; }
  #csBar button:active { background:rgba(128,128,128,.3); }
  #csBar button.armed { background:var(--accent); color:var(--accent-ink,#fff); }
  #csBar .cs-sep { width:1px; height:20px; background:currentColor; opacity:.25; margin:0 3px; }
  #csBar .cs-dot { width:24px; height:24px; min-height:24px; min-width:24px; padding:0; border-radius:50%; border:2px solid #fff; box-shadow:0 0 0 1px rgba(0,0,0,.3); box-sizing:border-box; }
  #csBar .cs-dot + .cs-dot { margin-inline-start:3px; }
  #csBar .cs-more { opacity:.85; }
  #csBar .cs-dot.mono { background:#fff !important; border-color:rgba(128,128,128,.55); box-shadow:none; }
  #csMenu .cs-row .cs-dots b.mono { background:transparent !important; border:2px solid rgba(128,128,128,.55); box-shadow:none; }
  #csBar button.cs-hlbtn { position:relative; }
  #csBar button.cs-hlbtn .cs-badge, #csBar button.cs-starbtn .cs-badge { position:absolute; bottom:3px; inset-inline-end:4px; width:10px; height:10px; border-radius:50%; border:2px solid #fff; box-shadow:0 0 0 1px rgba(0,0,0,.35); box-sizing:content-box; }
  #csBar button.cs-starbtn { position:relative; }
  #csMenu { position:fixed; z-index:142; display:none; width:min(262px, calc(100vw - 16px)); padding:5px; border-radius:14px; background:var(--surface, #fff); color:var(--text); border:1px solid var(--line-strong, rgba(0,0,0,.15)); box-shadow:0 10px 32px rgba(var(--shadow-rgb,0,0,0),.28); direction:rtl; font-size:14px; max-height:70vh; overflow-y:auto; }
  body.night-mode #csMenu { background:#1d1d1d; color:#eee; }
  #csMenu .cs-row { display:flex; align-items:center; gap:10px; min-height:42px; padding:0 8px 0 4px; border-radius:9px; cursor:pointer; -webkit-user-select:none; user-select:none; }
  #csMenu .cs-row:active { background:rgba(var(--accent-rgb,70,130,230),.14); }
  #csMenu .cs-row > i.cs-ic { font-size:19px; width:22px; text-align:center; color:var(--accent-text, var(--accent)); flex:none; margin-inline-start:6px; }
  #csMenu .cs-row .cs-lb { flex:1; min-width:0; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  #csMenu .cs-row .cs-dots { display:flex; gap:5px; }
  #csMenu .cs-row .cs-dots b { width:22px; height:22px; border-radius:50%; display:block; border:2px solid #fff; box-shadow:0 0 0 1px rgba(128,128,128,.55); box-sizing:border-box; }
  #csMenu .cs-row .cs-pin { all:unset; flex:none; box-sizing:border-box; width:30px; height:30px; display:grid; place-content:center; border-radius:50%; border:1.6px solid rgba(128,128,128,.55); background:transparent; color:var(--text-dim); cursor:pointer; font-size:16px; transition:background .12s, color .12s, border-color .12s; }
  #csMenu .cs-row .cs-pin.on { background:var(--accent); border-color:var(--accent); color:var(--accent-ink,#fff); }
  #csMenu .cs-row .cs-pin:active { transform:scale(.92); }
  #csMenu .cs-hr { height:1px; background:var(--line, rgba(128,128,128,.25)); margin:4px 6px; }
  #csMenu .cs-row.cs-danger > i.cs-ic, #csMenu .cs-row.cs-danger .cs-lb { color:#c0392b; }
  #csMenu .cs-hint { font-size:11px; color:var(--text-dim); padding:4px 10px 6px; line-height:1.7; }
  #csNoteOv .cs-nhead { display:flex; align-items:center; gap:8px; margin:0 0 10px; }
  #csNoteOv .cs-nhead h3 { flex:1; margin:0; }
  #csNoteOv .cs-ico { all:unset; box-sizing:border-box; flex:none; width:34px; height:34px; display:grid; place-content:center; border-radius:10px; font-size:18px; cursor:pointer; color:var(--text-dim); border:1px solid var(--line-strong, rgba(128,128,128,.3)); }
  #csNoteOv .cs-ico:active { background:rgba(128,128,128,.2); }
  #csNoteOv .cs-ico.danger { color:#c0392b; }
  #csNoteOv .cs-nbody { min-height:110px; margin-bottom:12px; }
  #csNoteOv .cs-ntext { white-space:pre-wrap; overflow-wrap:anywhere; line-height:1.95; font-size:15px; padding:10px 12px; min-height:110px; box-sizing:border-box; border-radius:10px; background:var(--surface-2); }
  #csNoteOv textarea.rs-field { min-height:110px; margin-bottom:0; }
  #csNoteOv .cs-quote { margin:0 0 10px; padding:8px 12px; border-inline-start:3px solid var(--accent); background:var(--surface-2); border-radius:6px; font-size:13.5px; line-height:1.9; color:var(--text-dim); max-height:84px; overflow:hidden; }
  #csNoteOv textarea.rs-field { resize:vertical; line-height:1.9; }
  .cs-xnote { display:flex; gap:8px; align-items:flex-start; margin:6px 0 12px; padding:8px 11px; border-radius:9px; background:rgba(var(--accent-rgb),.09); border-inline-start:3px solid var(--accent); color:var(--accent-text, var(--accent)); font-size:13px; line-height:1.75; cursor:pointer; -webkit-user-select:none; user-select:none; text-align:start; }
  .cs-xnote > i { flex:none; margin-top:4px; font-size:14px; }
  .cs-xnote > span { flex:1; min-width:0; white-space:pre-wrap; overflow-wrap:anywhere; }
  body.xn-icon .cs-xnote:not(.open), body.xn-icon .note-display:not(.open) { max-height:2.3em; overflow:hidden; }
  body.xn-icon .cs-xnote:not(.open) > span, body.xn-icon .note-display:not(.open) { white-space:nowrap; text-overflow:ellipsis; overflow:hidden; }
  body.xn-icon .note-display { cursor:pointer; }
  body.xn-hide .cs-xnote, body.xn-hide .note-display { display:none !important; }
  #csStarOv .star-dots, #csHlOv .star-dots { margin-bottom:6px; }
  #csHlOv .star-dot { width:34px; height:34px; }
  .cs-seg { display:flex; gap:6px; flex-wrap:wrap; margin-top:8px; }
  .cs-seg button { all:unset; box-sizing:border-box; padding:7px 12px; border-radius:9px; font-size:13px; font-weight:600; cursor:pointer; border:1px solid var(--line-strong); color:var(--text); background:var(--surface); }
  .cs-seg button.on { background:rgba(var(--accent-rgb),.14); border-color:var(--accent); color:var(--accent-text); }
  .cs-grp { margin-top:10px; }
  .cs-grp > b { display:block; font-size:12px; color:var(--text-dim); margin-bottom:2px; font-weight:700; }
  .cs-empty { font-size:12px; color:var(--text-dim); padding:6px 2px; }
  .cs-pins { display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }
  .cs-pins button { all:unset; display:inline-flex; align-items:center; gap:5px; box-sizing:border-box; padding:7px 11px; border-radius:9px; font-size:13px; font-weight:600; cursor:pointer; border:1px solid var(--line-strong); color:var(--text); background:var(--surface); }
  .cs-pins button.on { background:rgba(var(--accent-rgb),.14); border-color:var(--accent); color:var(--accent-text); }
  .cs-pins button i { font-size:16px; }
  .cs-pins button:active { transform:scale(.97); }
  `;
  document.head.appendChild(css);
  const dynCss = document.createElement('style'); dynCss.id = 'csDyn'; document.head.appendChild(dynCss);
  const dynSeen = new Set();
  function colorGroup(hex) {
    const h = String(hex || '#d4a017').replace('#', '').toLowerCase();
    const name = 'rs-hx-' + h;
    if (!dynSeen.has(name)) { dynSeen.add(name); dynCss.textContent += `::highlight(${name}) { background-color: ${rgbaOf('#' + h, .2)}; text-decoration: underline; text-decoration-color: #${h}; text-decoration-thickness: 2.5px; text-underline-offset: 5px; }\n`; }
    return name;
  }

  const isText = (n) => n && n.nodeType === 3;
  function caretAt(x, y) {
    let node = null, off = 0;
    if (document.caretPositionFromPoint) {
      const p = document.caretPositionFromPoint(x, y);
      if (p) { node = p.offsetNode; off = p.offset; }
    } else if (document.caretRangeFromPoint) {
      const r = document.caretRangeFromPoint(x, y);
      if (r) { node = r.startContainer; off = r.startOffset; }
    }
    return isText(node) ? { node, off } : null;
  }
  const cmp = (a, b) => (a.node === b.node ? a.off - b.off : (a.node.compareDocumentPosition(b.node) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  const JAMI = 'jami';
  const isJami = (cont) => !!(cont && cont.closest && cont.closest('#comparisonPage'));
  function tagJami() {
    const sid = (typeof cmpNav !== 'undefined' && cmpNav) ? cmpNav.subjectId : null; if (!sid) return;
    document.querySelectorAll('#comparisonPage .cmp-answer-text').forEach((c) => { const card = c.closest('.cmp-answer-card'); if (card) c.dataset.jkey = 'a:' + sid + ':' + card.dataset.sch; });
    document.querySelectorAll('#comparisonPage .cmp-question-text').forEach((c) => { c.dataset.jkey = 'q:' + sid; });
  }
  const isThamraCont = (cont) => !!(cont && cont.classList && cont.classList.contains('thamra-body') && cont.closest('#readerPage'));
  function thKeyOf(cont) {
    try {
      if (typeof currentThamraSections === 'undefined') return null;
      const secEl = cont.closest('[data-thamra-section-idx]');
      const idx = secEl ? +secEl.dataset.thamraSectionIdx : currentThamraSectionIndex;
      const sec = currentThamraSections[idx];
      return sec ? 'th' + sec.seq : null;
    } catch (e) { return null; }
  }
  function tagThamra() {
    if (typeof isThamraBook !== 'function' || typeof currentBookId === 'undefined' || !isThamraBook(currentBookId)) return;
    document.querySelectorAll('#readerPage .thamra-body').forEach((c) => { const k = thKeyOf(c); if (k) c.dataset.thkey = k; });
  }
  const isThSec = (sec) => typeof sec === 'string' && /^th-?\d+$/.test(sec);
  const containerOf = (n) => { const el = n && (n.nodeType === 1 ? n : n.parentElement); return el ? el.closest(SEL_CONT) : null; };
  const WORD = /[\p{L}\p{M}\p{N}_]/u;
  function wordBounds(pt) {
    const t = pt.node.data; let s = pt.off, e = pt.off;
    if (!(t[s] && WORD.test(t[s])) && s > 0 && WORD.test(t[s - 1])) { s--; e = s; }
    while (s > 0 && WORD.test(t[s - 1])) s--;
    while (e < t.length && WORD.test(t[e])) e++;
    if (s === e) return null;
    return { a: { node: pt.node, off: s }, b: { node: pt.node, off: e } };
  }
  function mkRange(a, b) {
    const r = document.createRange();
    if (cmp(a, b) <= 0) { r.setStart(a.node, a.off); r.setEnd(b.node, b.off); } else { r.setStart(b.node, b.off); r.setEnd(a.node, a.off); }
    return r;
  }
  function textMap(cont) {
    const w = document.createTreeWalker(cont, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.parentElement && n.parentElement.closest(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT)
    });
    const nodes = []; let str = '', n;
    while ((n = w.nextNode())) { nodes.push({ node: n, start: str.length }); str += n.data; }
    return { str, nodes };
  }
  function offsetOf(map, pt) {
    const e = map.nodes.find((x) => x.node === pt.node);
    return e ? e.start + pt.off : -1;
  }
  function pointAt(map, off) {
    let lo = 0, hi = map.nodes.length - 1, ans = 0;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (map.nodes[m].start <= off) { ans = m; lo = m + 1; } else hi = m - 1; }
    const e = map.nodes[ans]; if (!e) return null;
    return { node: e.node, off: Math.min(e.node.data.length, Math.max(0, off - e.start)) };
  }

  let sel = null;
  let hlHit = null;
  let hlRanges = [];
  let menuOpen = false;
  const bar = document.createElement('div'); bar.id = 'csBar';
  const menu = document.createElement('div'); menu.id = 'csMenu';
  const hS = document.createElement('div'); hS.className = 'cs-handle'; hS.dataset.k = 's';
  const hE = document.createElement('div'); hE.className = 'cs-handle'; hE.dataset.k = 'e';
  function mount() { document.body.append(bar, menu, hS, hE); }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);

  function paintSel() {
    if (!supported) return;
    if (sel) CSS.highlights.set('rs-sel', new Highlight(mkRange(sel.a, sel.b)));
    else CSS.highlights.delete('rs-sel');
  }
  function closeMenu() { menuOpen = false; menu.style.display = 'none'; }
  function clearSel() {
    sel = null; hlHit = null; paintSel(); closeMenu();
    bar.style.display = hS.style.display = hE.style.display = 'none';
  }
  function rects(range) { return Array.from(range.getClientRects()).filter((r) => r.width > 0.5 && r.height > 0.5); }
  const curRange = () => (sel ? mkRange(sel.a, sel.b) : (hlHit && hlHit.range));
  function ctx() {
    const range = curRange(); if (!range) return null;
    const cont = sel ? sel.cont : containerOf(range.startContainer);
    return { range, cont, reader: !!(cont && isJami(cont)) || !!(cont && cont.closest('#readerPage') && typeof currentBookId !== 'undefined'), entry: hlHit ? hlHit.entry : null };
  }
  function place() {
    const range = curRange();
    if (!range || (sel && !sel.cont.isConnected)) { clearSel(); return; }
    const rs = rects(range); if (!rs.length) { clearSel(); return; }
    const first = rs[0], last = rs[rs.length - 1];
    const rtl = getComputedStyle(sel ? sel.cont : (containerOf(range.startContainer) || document.body)).direction === 'rtl';
    if (sel) {
      hS.style.display = hE.style.display = 'block';
      hS.style.left = (rtl ? first.right : first.left) + 'px'; hS.style.top = first.bottom + 'px';
      hE.style.left = (rtl ? last.left : last.right) + 'px'; hE.style.top = last.bottom + 'px';
    }
    bar.style.display = 'flex';
    const bw = bar.offsetWidth, bh = bar.offsetHeight, vw = innerWidth;
    let top = first.top - bh - 12; if (top < 8) top = last.bottom + 52;
    top = Math.min(innerHeight - bh - 8, Math.max(8, top));
    let left = (first.left + first.right) / 2 - bw / 2;
    left = Math.min(vw - bw - 8, Math.max(8, left));
    bar.style.top = top + 'px'; bar.style.left = left + 'px';
    if (menuOpen) placeMenu();
  }
  function placeMenu() {
    menu.style.display = 'block';
    const br = bar.getBoundingClientRect(), mw = menu.offsetWidth, mh = menu.offsetHeight;
    const more = bar.querySelector('.cs-more'), mr = more ? more.getBoundingClientRect() : br;
    let left = mr.left + mr.width / 2 - mw / 2; left = Math.min(innerWidth - mw - 8, Math.max(8, left));
    let top = br.bottom + 6; if (top + mh > innerHeight - 8) top = Math.max(8, br.top - mh - 6);
    menu.style.left = left + 'px'; menu.style.top = top + 'px';
  }
  let raf = 0;
  const schedulePlace = () => { if ((sel || hlHit) && !raf) raf = requestAnimationFrame(() => { raf = 0; place(); }); };
  document.addEventListener('scroll', schedulePlace, true);
  addEventListener('resize', schedulePlace);

  const availIn = (a, c) => a.av === 'any' || (a.av === 'reader' && c.reader);
  function btn(a, many) {
    const lab = many ? '' : `<span>${esc(a.short || a.label)}</span>`;
    return `<button data-a="${a.id}"${isColored(a.id) ? ' class="cs-col"' : ''} aria-label="${esc(a.label)}" title="${esc(a.label)}"><i class="ti ti-${a.icon}"></i>${lab}</button>`;
  }
  function getColored() { try { const a = JSON.parse(lsGet(CKEY, '[]')); if (Array.isArray(a)) return a.filter((id) => A(id)); } catch (e) {} return []; }
  const setColored = (a) => lsSet(CKEY, JSON.stringify(a));
  const isColored = (id) => getColored().indexOf(id) >= 0;
  function dotsBar(prefix, list) {
    const col = isColored(prefix);
    return list.map((c, i) => col
      ? `<button class="cs-dot" data-a="${prefix}" data-i="${i}" style="background:${prefix === 'hl' ? c : starColorValue(c)}" aria-label="لون"></button>`
      : `<button class="cs-dot mono" data-a="${prefix}" data-i="${i}" aria-label="لون"></button>`).join('');
  }
  function renderBar() {
    const c = ctx(); if (!c) return;
    const hasNote = !!(c.entry && c.entry.note);
    const pinned = getPinned().map(A).filter((a) => a && availIn(a, c) && !(hasNote && a.id === 'note'));
    const many = pinned.length > 2, g = getGest();
    let h = '';
    pinned.forEach((a) => {
      if (a.id === 'hl') {
        if (g.hlMode === 'dots') h += dotsBar('hl', HL_QUICK.map((i) => COLORS[i]));
        else h += `<button class="cs-hlbtn${isColored('hl') ? ' cs-col' : ''}" data-a="hl" aria-label="تظليل" title="تظليل — نقرة: لون، نقرتان: لون ثانٍ، مطوّلة: كل الألوان"><i class="ti ti-palette"></i>${isColored('hl') ? `<span class="cs-badge" style="background:${COLORS[getHlPrefs().single]}"></span>` : ''}</button>`;
      } else if (a.id === 'star') {
        if (g.starMode === 'dots') h += dotsBar('star', STAR_QUICK);
        else h += `<button class="cs-starbtn${isColored('star') ? ' cs-col' : ''}" data-a="star" aria-label="نجمة" title="نجمة — نقرة: لون، نقرتان: لون ثانٍ، مطوّلة: كل الألوان"><i class="ti ti-star"></i>${isColored('star') ? `<span class="cs-badge" style="background:${starColorValue(getStarPrefs().single)}"></span>` : ''}</button>`;
      } else h += btn(a, many);
    });
    if (c.entry) {
      const e = c.entry;
      if (e.c != null) h += `<button data-a="unhl"${isColored('hl') ? ' class="cs-col"' : ''} aria-label="إزالة التظليل" title="إزالة التظليل"><i class="ti ti-eraser"></i></button>`;
      if (e.fav) h += `<button data-a="unstar" aria-label="إزالة النجمة" title="إزالة النجمة"${isColored('star') ? ` style="color:${starColorValue(e.col)}"` : ''}><i class="ti ti-star-filled"></i></button>`;
      if (e.note) h += `<button data-a="note" aria-label="الملاحظة" title="الملاحظة"><i class="ti ti-pencil"></i></button>`;
    }
    if (pinned.length || c.entry) h += '<span class="cs-sep"></span>';
    h += `<button class="cs-more" data-a="more" aria-label="المزيد" title="المزيد"><i class="ti ti-dots"></i></button>`;
    bar.innerHTML = h;
  }
  const on_col = (id) => (isColored(id) ? ' cs-col' : '');
  function renderMenu() {
    const c = ctx(); if (!c) return;
    const pinned = getPinned();
    let h = '';
    if (c.entry) {
      const e = c.entry;
      if (e.c != null) h += `<div class="cs-row cs-danger" data-a="unhl"><i class="cs-ic ti ti-eraser"></i><span class="cs-lb">إزالة التظليل</span></div>`;
      if (e.fav) h += `<div class="cs-row cs-danger" data-a="unstar"><i class="cs-ic ti ti-star-off"></i><span class="cs-lb">إزالة النجمة</span></div>`;
      h += '<div class="cs-hr"></div>';
    }
    ACTIONS.filter((a) => availIn(a, c)).forEach((a) => {
      if (a.id === 'clear') h += '<div class="cs-hr"></div>';
      const on = pinned.includes(a.id);
      let dots = '';
      if (a.id === 'hl') dots = `<span class="cs-dots">${HL_QUICK.map((i) => isColored('hl') ? `<b data-a="hl" data-i="${i}" style="background:${COLORS[i]}"></b>` : `<b class="mono" data-a="hl" data-i="${i}"></b>`).join('')}</span>`;
      else if (a.id === 'star') dots = `<span class="cs-dots">${STAR_QUICK.map((k, i) => isColored('star') ? `<b data-a="star" data-i="${i}" style="background:${starColorValue(k)}"></b>` : `<b class="mono" data-a="star" data-i="${i}"></b>`).join('')}</span>`;
      const act = (a.id === 'hl') ? '' : ` data-a="${a.id}"`;
      const lbl = (a.id === 'note' && c.entry && c.entry.note) ? 'عرض الملاحظة' : a.label;
      h += `<div class="cs-row${on_col(a.id)}"${act}><i class="cs-ic ti ti-${a.icon}"></i><span class="cs-lb">${esc(lbl)}</span>${dots}`
        + `<button class="cs-pin${on ? ' on' : ''}" data-pin="${a.id}" aria-label="${on ? 'إزالة من الشريط' : 'تثبيت في الشريط'}" title="${on ? 'مثبّت في الشريط — اضغط لفكّه' : 'ثبّته في الشريط'}"><i class="ti ti-pin"></i></button>` + '</div>';
    });
    h += '<div class="cs-hint">الدبوس المعبّأ = مثبّت في الشريط، والفارغ = داخل القائمة فقط.</div>';
    menu.innerHTML = h;
  }
  function openMenu() { renderMenu(); menuOpen = true; placeMenu(); }
  function show() { renderBar(); paintSel(); place(); }
  function refreshUi() { if (!sel && !hlHit) return; renderBar(); if (menuOpen) renderMenu(); place(); }

  function cleanText(range) {
    const frag = range.cloneContents();
    const tmp = document.createElement('div'); tmp.appendChild(frag);
    tmp.querySelectorAll(SKIP).forEach((e) => e.remove());
    tmp.querySelectorAll('br').forEach((b) => b.replaceWith('\n'));
    tmp.querySelectorAll('.masala-block, p, div, li').forEach((b) => b.append('\n'));
    return tmp.textContent.replace(/ /g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  function sourceFor(range) {
    try {
      const el = (n) => (n.nodeType === 1 ? n : n.parentElement);
      const s = el(range.startContainer), e = el(range.endContainer);
      const cont = containerOf(range.startContainer);
      if (cont && cont.closest('#writingPage')) return '';
      if (cont && cont.closest('#comparisonPage')) {
        const card = cont.closest('.cmp-answer-card'); const nm = card ? ((card.querySelector('.cmp-answer-scholar') || {}).textContent || '').trim() : 'السؤال';
        return 'جامع الاستفتاءات للشيخ عادل الجوهر - ' + nm;
      }
      if (cont && cont.closest('#customBookPage')) {
        const row = cont.closest('[data-cb-item-uid]'); const cb = customBooks.find((b) => b.id === currentCustomBookId);
        const it = row && cb && flattenCustomBookItems(cb).find((x) => x.uid === row.dataset.cbItemUid);
        if (it && it.bookName) return `${it.authorName ? it.authorName + ' - ' : ''}${it.bookName}${it.masalaNum ? ' - مسألة ' + it.masalaNum : ''}`;
        return '';
      }
      const book = allBooks.find((b) => b.id === currentBookId); if (!book) return '';
      const author = (allAuthors[book.author_id] || '').trim();
      const secEl = s && s.closest('.reader-section');
      let title = secEl ? ((secEl.querySelector('.section-title span') || {}).textContent || '').trim() : '';
      if (cont && isThamraCont(cont)) {
        try { const tk = thKeyOf(cont); const sc = currentThamraSections.find((x) => 'th' + x.seq === tk); title = sc ? String(sc.text || '').trim() : ''; } catch (e) { title = ''; }
        return [author, book.name, title].filter(Boolean).join(' - ');
      }
      const m1 = s && s.closest('.masala-block'), m2 = e && e.closest('.masala-block');
      let mas = '';
      if (m1 && m2) mas = m1 === m2 ? ` - مسألة ${m1.dataset.masala}` : ` - المسائل ${m1.dataset.masala}–${m2.dataset.masala}`;
      return [author, book.name, title].filter(Boolean).join(' - ') + mas;
    } catch (err) { return ''; }
  }
  function fullCopyText(range, noSource) {
    const t = cleanText(range), src = noSource ? '' : sourceFor(range);
    return src ? `${t}\n\nالمصدر: ${src}` : t;
  }
  function doCopy(range, noSource) {
    const text = fullCopyText(range, noSource);
    const ok = () => toast(noSource ? 'تم النسخ' : 'تم النسخ مع المصدر');
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, () => { try { rsLegacyCopy(text); ok(); } catch (e) {} });
    else { try { rsLegacyCopy(text); ok(); } catch (e) {} }
  }
  function doShare(range) {
    const text = fullCopyText(range, false);
    try { (window.RSShare = window.RSShare || {}).hint = { range: range.cloneRange(), t: Date.now() }; } catch (e) {}
    try { rsShareText(text); } catch (e) { doCopy(range); }
  }
  document.addEventListener('copy', (e) => {
    if (!enabled() || !sel) return;
    e.clipboardData.setData('text/plain', fullCopyText(mkRange(sel.a, sel.b)));
    e.preventDefault();
  });

  const loadH = () => { try { const a = JSON.parse(lsGet(HKEY, '[]')); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
  const saveH = (a) => lsSet(HKEY, JSON.stringify(a));
  const newId = () => 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  function allHits(str, needle, shift) {
    const out = []; if (!needle) return out;
    let i = str.indexOf(needle);
    while (i >= 0 && out.length < 60) { out.push(i + shift); i = str.indexOf(needle, i + 1); }
    return out;
  }
  function collapseWs(str) {
    let s2 = '', idx = [], prevWs = false;
    for (let i = 0; i < str.length; i++) {
      const ws = /\s/.test(str[i]);
      if (ws) { if (!prevWs) { s2 += ' '; idx.push(i); } prevWs = true; } else { s2 += str[i]; idx.push(i); prevWs = false; }
    }
    return { s: s2, idx };
  }
  function pickNear(c, h) { return c.length === 1 || h.off == null ? c[0] : c.reduce((best, x) => (Math.abs(x - h.off) < Math.abs(best - h.off) ? x : best)); }
  function locate(map, h) {
    const pre = h.pre || '', post = h.post || '';
    let c = allHits(map.str, pre + h.text + post, pre.length);
    if (!c.length) c = allHits(map.str, pre + h.text, pre.length);
    if (!c.length) c = allHits(map.str, h.text + post, 0);
    if (!c.length) c = allHits(map.str, h.text, 0);
    if (c.length) return pickNear(c, h);
    const m = map._c || (map._c = collapseWs(map.str)), t = collapseWs(h.text).s.trim(), p2 = collapseWs(pre).s;
    let cc = allHits(m.s, p2 + t, p2.length);
    if (!cc.length) cc = allHits(m.s, t, 0);
    if (!cc.length) return -1;
    const k = pickNear(cc.map((x) => m.idx[Math.min(x, m.idx.length - 1)]), h);
    return k;
  }
  function selInfo() {
    const c = ctx(); if (!c || !c.reader) return null;
    if (c.entry) { const e = c.entry; return { bk: e.bk, sec: e.sec, text: e.text, off: e.off, pre: e.pre, post: e.post, entry: e, sub: sourceFor(c.range), bookName: bookNameOf(e.bk), title: titleOf(e.text) }; }
    if (isJami(c.cont)) {
      tagJami(); const jk = c.cont.dataset.jkey; if (!jk) return null;
      const mp = textMap(c.cont), s0 = offsetOf(mp, sel.a), e0 = offsetOf(mp, sel.b); if (s0 < 0 || e0 <= s0) return null;
      const tx = mp.str.slice(s0, e0);
      return { bk: JAMI, sec: jk, text: tx, off: s0, pre: mp.str.slice(Math.max(0, s0 - 24), s0), post: mp.str.slice(e0, e0 + 24), entry: null, sub: sourceFor(c.range), bookName: 'جامع الأحكام', title: titleOf(tx) };
    }
    if (isThamraCont(c.cont)) {
      tagThamra(); const tk = c.cont.dataset.thkey; if (!tk) return null;
      const mp = textMap(c.cont), s0 = offsetOf(mp, sel.a), e0 = offsetOf(mp, sel.b); if (s0 < 0 || e0 <= s0) return null;
      const tx = mp.str.slice(s0, e0);
      return { bk: currentBookId, sec: tk, text: tx, off: s0, pre: mp.str.slice(Math.max(0, s0 - 24), s0), post: mp.str.slice(e0, e0 + 24), entry: null, sub: sourceFor(c.range), bookName: bookNameOf(currentBookId), title: titleOf(tx) };
    }
    const secEl = c.cont.closest('[data-section-idx]'); if (!secEl) return null;
    const map = textMap(c.cont), s = offsetOf(map, sel.a), e = offsetOf(map, sel.b);
    if (s < 0 || e <= s) return null;
    const text = map.str.slice(s, e);
    return { bk: currentBookId, sec: +secEl.dataset.sectionIdx, text, off: s, pre: map.str.slice(Math.max(0, s - 24), s), post: map.str.slice(e, e + 24), entry: null, sub: sourceFor(c.range), bookName: bookNameOf(currentBookId), title: titleOf(text) };
  }
  function bookNameOf(id) { if (id === JAMI) return 'جامع الاستفتاءات'; const b = allBooks.find((x) => x.id === id); return b ? b.name : ''; }
  function titleOf(t) { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > 60 ? t.slice(0, 60).trim() + '…' : t; }
  function entryFor(info, list) {
    if (info.entry) { const live = list.find((x) => x.id === info.entry.id); if (live) return live; }
    let e = list.find((x) => x.bk === info.bk && x.sec === info.sec && x.text === info.text && x.pre === info.pre);
    if (!e) { e = { id: newId(), bk: info.bk, sec: info.sec, text: info.text, off: info.off, pre: info.pre, post: info.post, t: Date.now() }; list.push(e); }
    return e;
  }
  const dropIfEmpty = (list) => list.filter((e) => e.c != null || e.fav || e.note);

  const TOO_LONG = 6000;
  const tooLong = (info) => { if (info && info.text.length > TOO_LONG) { toast('النص طويل للحفظ — حدّد جزءاً أقصر'); return true; } return false; };
  function addHighlight(ci) {
    const info = selInfo(); if (!info) { toast('التظليل متاح داخل الكتب'); return; }
    if (tooLong(info)) return;
    const list = loadH(), e = entryFor(info, list); e.c = ci;
    saveH(list); clearSel(); applyAll();
  }
  function removeHighlight() {
    const e = hlHit && hlHit.entry; if (!e) return;
    const list = loadH(), x = list.find((y) => y.id === e.id);
    if (x) { delete x.c; saveH(dropIfEmpty(list)); }
    clearSel(); applyAll();
  }
  const saveFavs = () => lsSet('rs_favorites', JSON.stringify(favorites));
  function addStar(colorKey) {
    const info = selInfo(); if (!info) { toast('النجمة متاحة داخل الكتب'); return; }
    if (tooLong(info)) return;
    const list = loadH(), e = entryFor(info, list), key = 'x' + e.id;
    const color = colorKey || getStarPrefs().single;
    const ref = { bk: info.bk, sec: info.sec, text: info.text, off: info.off, pre: info.pre, post: info.post };
    const i = favorites.findIndex((f) => f.kind === 'x' && f.masalaNum === key);
    if (i >= 0) favorites[i].color = color;
    else favorites.push({ kind: 'x', bookId: info.bk, sectionIdx: info.sec, title: info.title, bookName: info.bookName, masalaNum: key, snippet: info.text.slice(0, 90), color, extText: info.text, extSub: info.sub, extRef: ref });
    saveFavs();
    e.fav = key; e.col = starColorValue(color);
    saveH(list); clearSel(); applyAll(); toast('أُضيف النص إلى المفضلة');
  }
  function removeStar() {
    const e = hlHit && hlHit.entry; if (!e) return;
    const list = loadH(), x = list.find((y) => y.id === e.id);
    if (x && x.fav) {
      const i = favorites.findIndex((f) => f.kind === 'x' && f.masalaNum === x.fav);
      if (i >= 0) { favorites.splice(i, 1); saveFavs(); }
      delete x.fav; delete x.col; saveH(dropIfEmpty(list));
    }
    clearSel(); applyAll();
  }
  function noteOverlay() {
    let ov = document.getElementById('csNoteOv');
    if (!ov) { ov = document.createElement('div'); ov.id = 'csNoteOv'; ov.className = 'rs-ov'; document.body.appendChild(ov); }
    ov.onclick = (e) => { if (e.target === ov) ov.classList.remove('show'); };
    return ov;
  }
  const quoteOf = (t) => esc(t.length > 160 ? t.slice(0, 160) + '…' : t);
  function noteSheet(info, existing, onSave, onDelete, viewFirst) {
    const ov = noteOverlay();
    const close = () => ov.classList.remove('show');
    let editing = !existing || !viewFirst;
    const render = () => {
      ov.innerHTML = `<div class="rs-pop"><div class="cs-nhead"><h3>${existing ? 'ملاحظتك على النص' : 'ملاحظة على النص المحدَّد'}</h3>`
        + (existing && !editing ? '<button type="button" class="cs-ico" id="csNEdit" aria-label="تعديل" title="تعديل"><i class="ti ti-pencil"></i></button>' : '')
        + (existing ? '<button type="button" class="cs-ico danger" id="csNDel" aria-label="حذف الملاحظة" title="حذف الملاحظة"><i class="ti ti-trash"></i></button>' : '')
        + `</div><div class="cs-quote">${quoteOf(info.text)}</div><div class="cs-nbody">`
        + (editing ? '<textarea class="rs-field" id="csNoteText" placeholder="اكتب ملاحظتك هنا..."></textarea>' : `<div class="cs-ntext">${esc(existing.text)}</div>`)
        + '</div><div class="rs-actions">'
        + (editing ? `<button class="ok" id="csNoteOk">حفظ</button><button class="no" id="csNoteNo">${existing ? 'إلغاء' : 'إغلاق'}</button>` : '<button class="no" id="csNoteNo">إغلاق</button>')
        + '</div></div>';
      const ta = ov.querySelector('#csNoteText');
      if (ta) { ta.value = existing ? existing.text : ''; setTimeout(() => { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }, 120); }
      ov.querySelector('#csNoteNo').onclick = () => { if (existing && editing && viewFirst) { editing = false; render(); } else close(); };
      const ok = ov.querySelector('#csNoteOk');
      if (ok) ok.onclick = () => { const v = ta.value.trim(); if (!v) { toast('اكتب نص الملاحظة أولاً'); return; } close(); onSave(v); };
      const ed = ov.querySelector('#csNEdit'); if (ed) ed.onclick = () => { editing = true; render(); };
      const del = ov.querySelector('#csNDel');
      if (del) del.onclick = () => {
        if (window.RSUI && RSUI.confirm) RSUI.confirm({ title: 'حذف الملاحظة', msg: 'ستُحذف هذه الملاحظة نهائياً.', yes: 'حذف', no: 'إلغاء', danger: true, onYes: () => { close(); onDelete(); } });
        else { close(); onDelete(); }
      };
    };
    render(); ov.classList.add('show');
  }
  function removeNoteFor(key, entryId) {
    const list = loadH(), x = list.find((y) => y.id === entryId);
    const i = notes.findIndex((q) => q.kind === 'x' && q.masalaNum === key);
    if (i >= 0) { notes.splice(i, 1); saveNoteStorage(); }
    if (x) { delete x.note; saveH(dropIfEmpty(list)); }
    clearSel(); applyAll(); toast('حُذفت الملاحظة');
  }
  function viewNote() { addNote(true); }
  function addNote(viewFirst) {
    const info = selInfo(); if (!info) { toast('الملاحظات متاحة داخل الكتب'); return; }
    if (tooLong(info)) return;
    const list0 = loadH(), e0 = info.entry && list0.find((x) => x.id === info.entry.id);
    const key0 = e0 && e0.note;
    const existing = key0 ? notes.find((n) => n.kind === 'x' && n.masalaNum === key0) : null;
    clearSel();
    noteSheet(info, existing, (val) => {
      const list = loadH(), e = entryFor(info, list), key = 'x' + e.id;
      const i = notes.findIndex((n) => n.kind === 'x' && n.masalaNum === key);
      if (i >= 0) notes[i].text = val;
      else notes.push({ kind: 'x', bookId: info.bk, sectionIdx: info.sec, masalaNum: key, text: val, title: info.title, bookName: info.bookName, extText: info.text, extSub: info.sub, extRef: { bk: info.bk, sec: info.sec, text: info.text, off: info.off, pre: info.pre, post: info.post } });
      saveNoteStorage();
      e.note = key; saveH(list); applyAll(); toast('حُفظت الملاحظة');
    }, () => removeNoteFor(key0, e0 && e0.id), !!viewFirst);
  }
  function addToBook() {
    const info = selInfo(); if (!info) return;
    pendingCbItem = { type: 'quote', bookId: null, sectionIdx: null, masalaNum: null, title: info.title, bookName: info.bookName, authorName: '', text: info.text, snippet: info.text.slice(0, 140),
      srcKind: 'x', srcBookId: info.bk, srcSection: info.sec, srcRef: { bk: info.bk, sec: info.sec, text: info.text, off: info.off, pre: info.pre, post: info.post }, srcSub: info.sub };
    clearSel(); openAddToCustomBookPicker();
  }
  function addReminder() {
    const info = selInfo(); if (!info || !window.RSRemind) return;
    clearSel(); RSRemind.forSelection({ bk: info.bk, sec: info.sec, text: info.text, off: info.off, pre: info.pre, post: info.post, title: info.title, sub: info.sub });
  }

  function applyAll() {
    if (!supported) return;
    hlRanges = [];
    const groups = {};
    const add = (name, r) => { (groups[name] = groups[name] || []).push(r); };
    if (enabled()) {
      let all = loadH();
      let dirty = false;
      all.forEach((h) => {
        if (h.fav && !favorites.some((f) => f.kind === 'x' && f.masalaNum === h.fav)) { delete h.fav; delete h.col; dirty = true; }
        if (h.note && !notes.some((n) => n.kind === 'x' && n.masalaNum === h.note)) { delete h.note; dirty = true; }
      });
      if (dirty) { all = dropIfEmpty(all); saveH(all); }
      const mine = (typeof currentBookId !== 'undefined') ? all.filter((h) => h.bk === currentBookId) : [];
      if (mine.length) {
        document.querySelectorAll('#readerPage .body-text[data-section-idx]').forEach((cont) => {
          const sec = +cont.dataset.sectionIdx, list = mine.filter((h) => h.sec === sec); if (!list.length) return;
          const map = textMap(cont);
          list.forEach((h) => {
            const i = locate(map, h); if (i < 0) return;
            const a = pointAt(map, i), b = pointAt(map, i + h.text.length); if (!a || !b) return;
            const r = mkRange(a, b);
            if (h.c != null && COLORS[h.c]) add('rs-hl-' + h.c, r);
            if (h.fav) add(colorGroup(h.col), r);
            if (h.note) add('rs-note', r);
            hlRanges.push({ id: h.id, entry: h, range: r });
          });
        });
      }
    }
    if (enabled()) {
      try {
        tagJami();
        const mineJ = loadH().filter((h) => h.bk === JAMI);
        if (mineJ.length) document.querySelectorAll('#comparisonPage [data-jkey]').forEach((cont) => {
          const list = mineJ.filter((h) => h.sec === cont.dataset.jkey); if (!list.length) return;
          const map = textMap(cont);
          list.forEach((h) => {
            const i = locate(map, h); if (i < 0) return;
            const a = pointAt(map, i), b = pointAt(map, i + h.text.length); if (!a || !b) return;
            const r = mkRange(a, b);
            if (h.c != null && COLORS[h.c]) add('rs-hl-' + h.c, r);
            if (h.fav) add(colorGroup(h.col), r);
            if (h.note) add('rs-note', r);
            hlRanges.push({ id: h.id, entry: h, range: r });
          });
        });
      } catch (er) { console.warn('jami hl', er); }
    }
    if (enabled()) {
      try {
        tagThamra();
        const mineT = loadH().filter((h) => isThSec(h.sec) && typeof currentBookId !== 'undefined' && h.bk === currentBookId);
        if (mineT.length) document.querySelectorAll('#readerPage .thamra-body[data-thkey]').forEach((cont) => {
          const list = mineT.filter((h) => h.sec === cont.dataset.thkey); if (!list.length) return;
          const map = textMap(cont);
          list.forEach((h) => {
            const i = locate(map, h); if (i < 0) return;
            const a = pointAt(map, i), b = pointAt(map, i + h.text.length); if (!a || !b) return;
            const r = mkRange(a, b);
            if (h.c != null && COLORS[h.c]) add('rs-hl-' + h.c, r);
            if (h.fav) add(colorGroup(h.col), r);
            if (h.note) add('rs-note', r);
            hlRanges.push({ id: h.id, entry: h, range: r });
          });
        });
      } catch (er) { console.warn('thamra hl', er); }
    }
    try { syncInlineNotes(); } catch (er) { console.warn('xnote', er); }
    const names = COLORS.map((_, i) => 'rs-hl-' + i).concat(['rs-note']);
    Object.keys(groups).forEach((n) => { if (names.indexOf(n) < 0) names.push(n); });
    applyAll._names = Array.from(new Set((applyAll._names || []).concat(names)));
    const sig = applyAll._names.map((n) => n + ':' + (groups[n] || []).map((r) => r.startOffset + '-' + r.endOffset + '-' + r.startContainer.isConnected).join(',')).join('|');
    const sameNodes = applyAll._last && applyAll._last.nodes && applyAll._last.nodes.every((x) => x.isConnected);
    if (applyAll._last && applyAll._last.sig === sig && sameNodes) return;
    applyAll._last = { sig, nodes: Object.keys(groups).reduce((a, n) => a.concat(groups[n].map((r) => r.startContainer)), []) };
    applyAll._names.forEach((n) => { if (groups[n] && groups[n].length) CSS.highlights.set(n, new Highlight(...groups[n])); else CSS.highlights.delete(n); });
  }
  const BLOCKS = 'p, div, li, .masala-block, h1, h2, h3, h4, blockquote';
  function blockOf(n) { const el = n.nodeType === 1 ? n : n.parentElement; return el ? el.closest(BLOCKS) : null; }
  function lineBreakPoint(range, cont) {
    const rs = rects(range); if (!rs.length) return null;
    const last = rs[rs.length - 1], limit = last.bottom - last.height * 0.4;
    const endNode = range.endContainer; if (!isText(endNode)) return null;
    const home = blockOf(endNode);
    const walker = document.createTreeWalker(cont, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.parentElement && n.parentElement.closest(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT)
    });
    walker.currentNode = endNode;
    const probe = document.createRange();
    let node = endNode, off = range.endOffset, steps = 0;
    while (node && steps < 1500) {
      const t = node.data;
      if (blockOf(node) !== home) return null;
      for (; off < t.length && steps < 1500; off++, steps++) {
        if (off > 0 && /\s/.test(t[off - 1]) && !/\s/.test(t[off])) {
          probe.setStart(node, off); probe.setEnd(node, off + 1);
          const r = probe.getClientRects()[0];
          if (r && r.top >= limit) return { node, off };
        }
      }
      node = walker.nextNode(); off = 0;
    }
    return null;
  }
  function placeNoteEl(el, pt) {
    const { node, off } = pt;
    let host = node.parentElement && node.parentElement.closest('.gterm, .fn-ref, a, button, sup');
    if (host) { host.after(el); return; }
    if (off <= 0) { node.parentNode.insertBefore(el, node); return; }
    if (off >= node.data.length) { node.parentNode.insertBefore(el, node.nextSibling); return; }
    const tail = node.splitText(off);
    tail.parentNode.insertBefore(el, tail);
  }
  function syncInlineNotes() {
    const mode = noteMode();
    document.body.classList.toggle('xn-icon', mode === 'icon');
    document.body.classList.toggle('xn-hide', mode === 'hide');
    const want = new Map();
    if (mode !== 'hide') hlRanges.forEach((h) => { if (h.entry.note) { const n = notes.find((x) => x.kind === 'x' && x.masalaNum === h.entry.note); if (n) want.set(h.id, { h, n }); } });
    document.querySelectorAll('#readerPage .cs-xnote, #comparisonPage .cs-xnote').forEach((el) => {
      if (!want.has(el.dataset.hid)) { const par = el.parentNode; el.remove(); if (par && par.normalize) par.normalize(); }
    });
    const tails = new Map();
    want.forEach(({ h, n }, id) => {
      const cont = containerOf(h.range.endContainer); if (!cont) return;
      let el = document.querySelector(`.cs-xnote[data-hid="${id}"]`);
      const font = getComputedStyle(cont).fontSize;
      const sig = Math.round(cont.clientWidth) + '|' + font + '|' + h.range.endOffset + '|' + (h.range.endContainer.data || '').length + '|' + noteMode();
      const textChanged = el && el.dataset.t !== n.text;
      if (el && el.isConnected && el.dataset.sig === sig && !textChanged) return;
      if (!el) { el = document.createElement('div'); el.className = 'cs-xnote'; el.dataset.hid = id; }
      else if (el.parentNode) { const par = el.parentNode; el.remove(); if (par.normalize) par.normalize(); }
      el.dataset.t = n.text; el.innerHTML = `<i class="ti ti-pencil"></i><span>${esc(n.text)}</span>`; el.dataset.sig = sig;
      const pt = lineBreakPoint(h.range, cont);
      if (pt) { placeNoteEl(el, pt); return; }
      let anchor = h.range.endContainer.nodeType === 1 ? h.range.endContainer : h.range.endContainer.parentElement;
      while (anchor && anchor.parentElement !== cont) anchor = anchor.parentElement;
      if (!anchor) { const kids = Array.from(cont.children).filter((c) => !c.classList.contains('cs-xnote')); anchor = kids.length ? kids[kids.length - 1] : null; }
      const cur = anchor ? (tails.get(anchor) || anchor) : null;
      if (cur) { cur.after(el); tails.set(anchor, el); } else cont.append(el);
    });
  }
  document.addEventListener('click', (e) => {
    const x = e.target.closest && e.target.closest('.cs-xnote');
    if (x) {
      if (noteMode() === 'icon' && !x.classList.contains('open')) { x.classList.add('open'); return; }
      const h = hlRanges.find((r) => r.id === x.dataset.hid); if (!h) return;
      hlHit = { entry: h.entry, range: h.range }; viewNote(); return;
    }
    const nd = e.target.closest && e.target.closest('.note-display');
    if (nd && noteMode() === 'icon') nd.classList.toggle('open');
  });
  let obsT = 0;
  function observe() {
    ['readerPage', 'comparisonPage'].forEach((id) => {
      const root = document.getElementById(id); if (!root) return;
      new MutationObserver(() => { clearTimeout(obsT); obsT = setTimeout(applyAll, 140); }).observe(root, { childList: true, subtree: true });
    });
  }

  const contSel = (ref) => (ref.bk === JAMI ? `#comparisonPage [data-jkey="${ref.sec}"]` : (isThSec(ref.sec) ? `#readerPage .thamra-body[data-thkey="${ref.sec}"]` : `#readerPage .body-text[data-section-idx="${ref.sec}"]`));
  function flash(ref, tries) {
    tries = tries || 0;
    if (isThSec(ref.sec)) tagThamra();
    const cont = document.querySelector(contSel(ref));
    if (cont && cont.dataset.rendered === '0') { try { ensureSectionRendered(ref.sec); } catch (e) {} }
    const c2 = document.querySelector(contSel(ref));
    if (!c2 || c2.dataset.rendered === '0' || !c2.textContent.trim()) { if (tries < 14) setTimeout(() => flash(ref, tries + 1), 160); return; }
    const map = textMap(c2), i = locate(map, ref);
    if (i < 0) return;
    const a = pointAt(map, i), b = pointAt(map, i + ref.text.length); if (!a || !b) return;
    const r = mkRange(a, b);
    try { readerScrollToken++; } catch (e) {}
    let n = 0, stable = 0;
    const settle = () => {
      n++;
      let el = null;
      try {
        const cc = document.querySelector(contSel(ref));
        if (cc) { const m2 = textMap(cc), j = locate(m2, ref), p2 = j >= 0 ? pointAt(m2, j) : null; el = p2 && p2.node.parentElement; }
      } catch (e) {}
      if (el) {
        const box = document.getElementById('content').getBoundingClientRect(), rc = el.getBoundingClientRect();
        const dev = (rc.top + rc.height / 2) - (box.top + box.height / 2);
        if (n === 1 || Math.abs(dev) > 40) { el.scrollIntoView({ block: 'center', behavior: 'auto' }); stable = 0; } else stable++;
      }
      if (stable < 3 && n < 12) setTimeout(settle, 160);
    };
    settle();
    if (supported) { CSS.highlights.set('rs-flash', new Highlight(r)); setTimeout(() => CSS.highlights.delete('rs-flash'), 3200); }
  }
  function openText(ref) {
    if (ref && ref.bk === JAMI) {
      const sid = +String(ref.sec).split(':')[1];
      try { renderCmpComparisonView(sid); } catch (e) { toast('تعذّر فتح المسألة'); return; }
      setTimeout(() => { tagJami(); flash(ref); }, 350); return;
    }
    if (ref && isThSec(ref.sec) && allBooks.find((b) => b.id === ref.bk)) {
      try {
        const data = loadThamraData();
        const idx = data.sections.findIndex((x) => 'th' + x.seq === ref.sec);
        if (idx < 0) { toast('تعذّر العثور على القسم'); return; }
        openThamraReader(ref.bk, idx);
      } catch (e) { toast('تعذّر فتح القسم'); return; }
      setTimeout(() => flash(ref), 450); return;
    }
    if (!ref || !allBooks.find((b) => b.id === ref.bk)) { toast('هذا الكتاب لم يعد متاحاً'); return; }
    openReader(ref.bk, ref.sec || 0);
    setTimeout(() => flash(ref), 350);
  }
  const _oes = window.openExtSource;
  if (typeof _oes === 'function') window.openExtSource = function (rec, backFn) {
    if (rec && rec.kind === 'x' && rec.extRef) {
      navStack = []; pushNav(backFn || (() => showTab('favorites')));
      openText(rec.extRef); return;
    }
    return _oes.apply(this, arguments);
  };

  let press = null, mouseDrag = null, handleDrag = null, longFired = false;
  const inUi = (t) => t && t.closest && (t.closest('#csBar') || t.closest('#csMenu') || t.closest('.cs-handle') || t.closest('#csNoteOv') || t.closest('#csStarOv') || t.closest('#csHlOv'));

  function startSelection(cont, a, b) { sel = { cont, a, b }; hlHit = null; closeMenu(); show(); }
  function selectWordAt(x, y) {
    const pt = caretAt(x, y); if (!pt) return false;
    const cont = containerOf(pt.node); if (!cont || !enabled()) return false;
    if (pt.node.parentElement.closest(SKIP)) return false;
    const wb = wordBounds(pt); if (!wb) return false;
    startSelection(cont, wb.a, wb.b);
    return true;
  }

  document.addEventListener('pointerdown', (e) => {
    if (!enabled()) return;
    if (inUi(e.target)) return;
    const cont = e.target.closest && e.target.closest(SEL_CONT);
    if (!cont || e.target.closest(NO_TAP)) { if (sel || hlHit) clearSel(); return; }
    longFired = false;
    if (e.pointerType === 'mouse') {
      if (e.button !== 0) return;
      const pt = caretAt(e.clientX, e.clientY);
      if (sel || hlHit) clearSel();
      mouseDrag = pt ? { cont, a: pt, x: e.clientX, y: e.clientY, moved: false } : null;
      return;
    }
    if (sel || hlHit) clearSel();
    press = { x: e.clientX, y: e.clientY, id: e.pointerId };
    press.timer = setTimeout(() => {
      if (!press) return;
      if (selectWordAt(press.x, press.y)) { longFired = true; try { navigator.vibrate && navigator.vibrate(10); } catch (er) {} }
      press = null;
    }, 400);
  }, true);

  document.addEventListener('pointermove', (e) => {
    if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 10) { clearTimeout(press.timer); press = null; }
    if (mouseDrag && (e.buttons & 1)) {
      if (!mouseDrag.moved && Math.hypot(e.clientX - mouseDrag.x, e.clientY - mouseDrag.y) < 4) return;
      mouseDrag.moved = true;
      const pt = caretAt(e.clientX, e.clientY);
      if (pt && containerOf(pt.node) === mouseDrag.cont && !pt.node.parentElement.closest(SKIP)) {
        const a = mouseDrag.a, [x, y] = cmp(a, pt) <= 0 ? [a, pt] : [pt, a];
        sel = { cont: mouseDrag.cont, a: x, b: y }; hlHit = null; paintSel();
        bar.style.display = 'none'; hS.style.display = hE.style.display = 'none'; closeMenu();
      }
    }
  }, true);

  document.addEventListener('pointerup', () => {
    if (press) { clearTimeout(press.timer); press = null; }
    if (mouseDrag) {
      const d = mouseDrag; mouseDrag = null;
      if (d.moved && sel && cmp(sel.a, sel.b) !== 0) { longFired = true; show(); }
    }
  }, true);
  document.addEventListener('pointercancel', () => { if (press) { clearTimeout(press.timer); press = null; } }, true);

  const meaningsOn = () => lsGet('rs_show_meanings', '1') !== '0';
  const chooser = document.createElement('div'); chooser.id = 'csChoose';
  function mountChooser() { document.body.appendChild(chooser); }
  if (document.body) mountChooser(); else document.addEventListener('DOMContentLoaded', mountChooser);
  const closeChooser = () => { chooser.style.display = 'none'; chooser.innerHTML = ''; };
  function hitAt(e) {
    const pt = caretAt(e.clientX, e.clientY); if (!pt || !hlRanges.length) return null;
    let best = null, bestLen = Infinity;
    hlRanges.forEach((h) => {
      try {
        if (h.range.isPointInRange(pt.node, pt.off)) { const len = (h.entry.text || '').length; if (len < bestLen) { best = h; bestLen = len; } }
      } catch (er) {}
    });
    return best;
  }
  function runMeaning(gt) {
    try { new Function(gt.getAttribute('onclick') || '').call(gt); } catch (er) {}
  }
  function openChooser(x, y, opts) {
    chooser.innerHTML = opts.map((o, i) => `<button type="button" data-i="${i}"><i class="ti ti-${o.icon}"></i><span>${esc(o.label)}</span></button>`).join('');
    chooser.style.display = 'flex';
    const w = chooser.offsetWidth, h = chooser.offsetHeight;
    let left = Math.min(innerWidth - w - 8, Math.max(8, x - w / 2));
    let top = y + 18; if (top + h > innerHeight - 8) top = Math.max(8, y - h - 22);
    chooser.style.left = left + 'px'; chooser.style.top = top + 'px';
    chooser.onclick = (ev) => {
      const b = ev.target.closest('button'); if (!b) return;
      ev.stopPropagation();
      const o = opts[+b.dataset.i]; closeChooser(); if (o) o.run();
    };
  }
  document.addEventListener('pointerdown', (e) => { if (chooser.style.display === 'flex' && !e.target.closest('#csChoose')) closeChooser(); }, true);
  document.addEventListener('scroll', () => { if (chooser.style.display === 'flex') closeChooser(); }, true);

  document.addEventListener('click', (e) => {
    if (!enabled()) return;
    if (e.target.closest && e.target.closest('#csChoose')) return;
    const gt = e.target.closest && e.target.closest(GT);
    const gtOn = !!gt && meaningsOn() && !inUi(e.target);
    if (gt && !inUi(e.target) && (longFired || sel)) { e.stopPropagation(); e.preventDefault(); longFired = false; return; }
    if (longFired || sel || inUi(e.target)) { longFired = false; return; }
    const cont = e.target.closest && e.target.closest('#readerPage .body-text, #comparisonPage .cmp-answer-text, #comparisonPage .cmp-question-text');
    if (!cont) return;
    if (e.target.closest(NO_TAP) && !gtOn) return;
    const hit = hitAt(e);
    if (gtOn && hit) {
      e.stopPropagation(); e.preventDefault();
      const en = hit.entry, opts = [{ icon: 'book-2', label: 'معنى الكلمة', run: () => runMeaning(gt) }];
      if (en.c != null) opts.push({ icon: 'highlight', label: 'التظليل', run: () => { hlHit = { entry: en, range: hit.range }; closeMenu(); show(); } });
      if (en.fav) opts.push({ icon: 'star', label: 'النجمة', run: () => { hlHit = { entry: en, range: hit.range }; closeMenu(); show(); } });
      if (en.note) opts.push({ icon: 'pencil', label: 'التعليق', run: () => { hlHit = { entry: en, range: hit.range }; viewNote(); } });
      if (opts.length === 2 && en.c == null && !en.fav && !en.note) { runMeaning(gt); return; }
      openChooser(e.clientX, e.clientY, opts);
      return;
    }
    if (gtOn) return;
    if (!hit) return;
    hlHit = { entry: hit.entry, range: hit.range }; closeMenu(); show();
  }, true);

  document.addEventListener('dblclick', (e) => {
    if (!enabled() || inUi(e.target) || !e.target.closest || !e.target.closest(SEL_CONT) || e.target.closest(NO_TAP)) return;
    mouseDrag = null; if (selectWordAt(e.clientX, e.clientY)) longFired = true;
  }, true);

  document.addEventListener('contextmenu', (e) => {
    if (!enabled()) return;
    if (inUi(e.target)) { e.preventDefault(); return; }
    if (e.target.closest && e.target.closest(SEL_CONT) && !e.target.closest('input, textarea')) e.preventDefault();
  }, true);

  [hS, hE].forEach((h) => {
    h.addEventListener('pointerdown', (e) => {
      if (!sel) return;
      e.preventDefault(); e.stopPropagation(); h.setPointerCapture(e.pointerId);
      handleDrag = { k: h.dataset.k, fixed: h.dataset.k === 's' ? sel.b : sel.a, cont: sel.cont };
      bar.style.display = 'none'; closeMenu();
    });
    h.addEventListener('pointermove', (e) => {
      if (!handleDrag) return;
      const pt = caretAt(e.clientX, e.clientY - 22);
      if (!pt || containerOf(pt.node) !== handleDrag.cont || pt.node.parentElement.closest(SKIP)) return;
      const f = handleDrag.fixed, [a, b] = cmp(pt, f) <= 0 ? [pt, f] : [f, pt];
      sel = { cont: handleDrag.cont, a, b }; paintSel(); place(); bar.style.display = 'none';
    });
    const end = () => { if (handleDrag) { handleDrag = null; if (sel) show(); } };
    h.addEventListener('pointerup', end); h.addEventListener('pointercancel', end);
  });

  function selectChapter() {
    const c = ctx(); if (!c || !c.cont) return;
    const map = textMap(c.cont); if (!map.nodes.length) return;
    const last = map.nodes[map.nodes.length - 1];
    const a = { node: map.nodes[0].node, off: 0 }, b = { node: last.node, off: last.node.data.length };
    startSelection(c.cont, a, b);
    toast('حُدِّد الفصل كله');
  }

  const UNITS = '#readerPage .masala-block, #readerPage .thamra-item';
  function selectNeighbor(dir) {
    const c = ctx(); if (!c || !sel) return;
    const node = sel.dir === 'b' ? sel.b.node : sel.a.node;
    const from = node && node.parentElement && node.parentElement.closest(UNITS);
    const units = Array.from(document.querySelectorAll(UNITS)).filter((u) => u.offsetParent !== null);
    if (!units.length) { toast('لا توجد مسائل مفصولة في هذا النص'); return; }
    let i = from ? units.indexOf(from) : -1;
    if (i < 0) {
      const y = (curRange() ? curRange().getBoundingClientRect().top : 0);
      i = units.findIndex((u) => u.getBoundingClientRect().top >= y); if (i < 0) i = units.length - 1;
      i += dir > 0 ? -1 : 1;
    }
    const t = units[i + dir];
    if (!t) { toast(dir < 0 ? 'هذه أول مسألة ظاهرة' : 'هذه آخر مسألة ظاهرة'); return; }
    const map = textMap(t); if (!map.nodes.length) { toast('لا نص في المسألة المجاورة'); return; }
    const last = map.nodes[map.nodes.length - 1];
    const a = { node: map.nodes[0].node, off: 0 }, b = { node: last.node, off: last.node.data.length };
    const cont = containerOf(a.node); if (!cont) return;
    startSelection(cont, a, b);
    try { t.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { t.scrollIntoView(); }
  }
  const TG = 'https://t.me/Mshkaah';
  function doWiki(range) {
    const t = String(range.toString() || '').replace(/\s+/g, ' ').trim().slice(0, 120);
    if (!t) return;
    const st = (typeof officialSitesFor === 'function' ? officialSitesFor('wikishia')[0] : null) || { u: 'https://ar.wikishia.net/', n: 'ويكي شيعة', aid: 'wikishia' };
    window.open(typeof siteSearchUrl === 'function' ? siteSearchUrl(st, t) : 'https://www.google.com/search?q=site:ar.wikishia.net+' + encodeURIComponent(t), '_blank', 'noopener');
  }
  function doFix() {
    const info = selInfo(); if (!info) { toast('حدّد النص المراد تصحيحه أولاً'); return; }
    const msg = ['تصحيح مقترح — مشكاة الفقه', '', 'المصدر: ' + [info.bookName, info.sub || info.title].filter(Boolean).join(' — '), '', 'النص:', info.text, '', 'التصحيح المقترح:', ''].join('\n');
    const open = () => { window.open(TG, '_blank', 'noopener'); };
    const done = (ok) => { toast(ok ? 'نُسخ نص التصحيح — الصقه في محادثة تيليغرام التي ستفتح' : 'افتح تيليغرام وأرسل التصحيح'); open(); };
    try { navigator.clipboard.writeText(msg).then(() => done(true), () => done(false)); } catch (e) { done(false); }
  }
  function run(act, idx, color) {
    const range = curRange();
    switch (act) {
      case 'copy': if (range) doCopy(range, false); clearSel(); break;
      case 'plain': if (range) doCopy(range, true); clearSel(); break;
      case 'share': if (range) { const r = range; clearSel(); doShare(r); } break;
      case 'hl': addHighlight(+idx); break;
      case 'unhl': removeHighlight(); break;
      case 'star': addStar(color || (idx != null && idx !== '' ? STAR_QUICK[+idx] : null)); break;
      case 'unstar': removeStar(); break;
      case 'note': if (hlHit && hlHit.entry && hlHit.entry.note) viewNote(); else addNote(); break;
      case 'book': addToBook(); break;
      case 'remind': addReminder(); break;
      case 'all': selectChapter(); break;
      case 'above': selectNeighbor(-1); break;
      case 'below': selectNeighbor(1); break;
      case 'wiki': if (range) { const r = range; clearSel(); doWiki(r); } break;
      case 'fix': doFix(); clearSel(); break;
      case 'more': if (menuOpen) closeMenu(); else openMenu(); break;
      default: clearSel();
    }
  }
  bar.addEventListener('pointerdown', (e) => e.preventDefault());
  menu.addEventListener('pointerdown', (e) => e.preventDefault());

  let lp = null, lpFired = false, swallowClick = false;
  const lpAct = () => (getGest().copyLong === 'plain' ? 'plain' : 'share');
  function lpDown(e) {
    const bc = e.target.closest('button[data-a="copy"]');
    const bs = !bc && e.target.closest('[data-a="star"]:not([data-i])');
    const bh = !bc && !bs && e.target.closest('[data-a="hl"]:not([data-i])');
    const b = bc || bs || bh; if (!b) return;
    const g = getGest();
    if (bc && g.copyLong === 'off') return;
    if (bs && !g.starLong) return;
    if (bh && !g.hlLong) return;
    lpFired = false;
    lp = { b, star: !!bs, timer: setTimeout(() => {
      lpFired = true;
      if (bc) { b.classList.add('armed'); const i = b.querySelector('i'); if (i) { b._ic = i.className; i.className = 'ti ti-' + (lpAct() === 'plain' ? 'clipboard-text' : 'share-3'); } }
      try { navigator.vibrate && navigator.vibrate(18); } catch (er) {}
      if (bs) { swallowClick = true; setTimeout(() => { swallowClick = false; }, 700); openStarSheetSel(); lp = null; }
      if (bh) { swallowClick = true; setTimeout(() => { swallowClick = false; }, 700); openHlSheetSel(); lp = null; }
    }, 450), x: e.clientX, y: e.clientY };
  }
  bar.addEventListener('pointerdown', lpDown);
  menu.addEventListener('pointerdown', lpDown);
  bar.addEventListener('pointermove', (e) => { if (lp && !lpFired && Math.hypot(e.clientX - lp.x, e.clientY - lp.y) > 12) { clearTimeout(lp.timer); lp = null; } });
  const lpDisarm = (b) => { b.classList.remove('armed'); const i = b.querySelector('i'); if (i && b._ic) i.className = b._ic; };
  const lpEnd = (commit) => {
    if (!lp) return;
    clearTimeout(lp.timer);
    const { b } = lp; lp = null;
    if (lpFired) {
      lpFired = false; lpDisarm(b);
      if (commit) { swallowClick = true; setTimeout(() => { swallowClick = false; }, 600); run(lpAct()); }
    }
  };
  function lpClickCommit(e) {
    if (!lp || !lpFired || !lp.b) return false;
    const b = lp.b; if (!e.target.closest || e.target.closest('button[data-a="copy"]') !== b) return false;
    clearTimeout(lp.timer); lp = null; lpFired = false; lpDisarm(b);
    e.preventDefault(); e.stopPropagation();
    swallowClick = true; setTimeout(() => { swallowClick = false; }, 600);
    run(lpAct());
    return true;
  }
  bar.addEventListener('pointerup', () => lpEnd(true));
  bar.addEventListener('pointercancel', () => lpEnd(true));
  menu.addEventListener('pointerup', () => { if (lp) { clearTimeout(lp.timer); lp = null; } });

  let starTapT = 0;
  function starTapSel() {
    if (!getGest().starDbl) { run('star'); return; }
    if (starTapT) { clearTimeout(starTapT); starTapT = 0; run('star', null, getStarPrefs().double); return; }
    starTapT = setTimeout(() => { starTapT = 0; run('star'); }, 270);
  }
  function openStarSheetSel() {
    let ov = document.getElementById('csStarOv');
    if (!ov) {
      ov = document.createElement('div'); ov.id = 'csStarOv'; ov.className = 'rs-ov';
      ov.addEventListener('click', (e) => { if (e.target === ov && Date.now() > (ov._g || 0)) ov.classList.remove('show'); });
      document.body.appendChild(ov);
    }
    const render = () => {
      const pf = getStarPrefs();
      ov.innerHTML = `<div class="rs-pop"><h3><i class="ti ti-star"></i> لون النجمة</h3>
        <div class="star-sheet-label">لون هذا النص</div><div class="star-dots">${starDotsHtml('', 'csStarPick')}</div>
        <div class="star-sheet-label">لون النقرة الواحدة</div><div class="star-dots">${starDotsHtml(pf.single, 'csPrefSingle')}</div>
        <div class="star-sheet-label">لون النقرتين المتتاليتين</div><div class="star-dots">${starDotsHtml(pf.double, 'csPrefDouble')}</div>
        <div class="rs-actions" style="margin-top:14px"><button class="no" id="csStarNo">إغلاق</button></div></div>`;
      ov.querySelector('#csStarNo').onclick = () => ov.classList.remove('show');
    };
    window.csStarPick = (c) => { ov.classList.remove('show'); addStar(c); };
    window.csPrefSingle = (c) => { const p = getStarPrefs(); p.single = c; saveStarPrefs(p); render(); syncSettings(); };
    window.csPrefDouble = (c) => { const p = getStarPrefs(); p.double = c; saveStarPrefs(p); render(); syncSettings(); };
    ov._g = Date.now() + 700; render(); ov.classList.add('show');
  }

  let hlTapT = 0;
  function hlTapSel() {
    const p = getHlPrefs();
    if (!getGest().hlDbl) { addHighlight(p.single); return; }
    if (hlTapT) { clearTimeout(hlTapT); hlTapT = 0; addHighlight(p.double); return; }
    hlTapT = setTimeout(() => { hlTapT = 0; addHighlight(getHlPrefs().single); }, 270);
  }
  function openHlSheetSel() {
    let ov = document.getElementById('csHlOv');
    if (!ov) {
      ov = document.createElement('div'); ov.id = 'csHlOv'; ov.className = 'rs-ov';
      ov.addEventListener('click', (e) => { if (e.target === ov && Date.now() > (ov._g || 0)) ov.classList.remove('show'); });
      document.body.appendChild(ov);
    }
    const dots = (cur, fn) => `<div class="star-dots">${COLORS.map((c, i) => `<button type="button" class="star-dot ${cur === i ? 'sel' : ''}" style="background:${c}" aria-label="لون" onclick="${fn}(${i})"></button>`).join('')}</div>`;
    const render = () => {
      const pf = getHlPrefs();
      ov.innerHTML = `<div class="rs-pop"><h3><i class="ti ti-palette"></i> لون التظليل</h3>
        <div class="star-sheet-label">ظلّل هذا النص بلون</div>${dots(-1, 'csHlPick')}
        <div class="star-sheet-label">لون النقرة الواحدة</div>${dots(pf.single, 'csHlSingle')}
        <div class="star-sheet-label">لون النقرتين المتتاليتين</div>${dots(pf.double, 'csHlDouble')}
        <div class="rs-actions" style="margin-top:14px"><button class="no" id="csHlNo">إغلاق</button></div></div>`;
      ov.querySelector('#csHlNo').onclick = () => ov.classList.remove('show');
    };
    window.csHlPick = (i) => { ov.classList.remove('show'); addHighlight(i); };
    window.csHlSingle = (i) => { const p = getHlPrefs(); p.single = i; setHlPrefs(p); render(); syncSettings(); refreshUi(); };
    window.csHlDouble = (i) => { const p = getHlPrefs(); p.double = i; setHlPrefs(p); render(); syncSettings(); };
    ov._g = Date.now() + 700; render(); ov.classList.add('show');
  }

  function onActivate(e) {
    if (lpClickCommit(e)) return;
    if (swallowClick) { swallowClick = false; e.preventDefault(); return; }
    const pin = e.target.closest('[data-pin]');
    if (pin) {
      e.stopPropagation();
      const id = pin.dataset.pin, cur = getPinned();
      setPinned(cur.includes(id) ? cur.filter((x) => x !== id) : cur.concat([id]));
      refreshUi(); syncSettings();
      return;
    }
    const el = e.target.closest('[data-a]'); if (!el) return;
    if (el.dataset.a === 'star' && (el.dataset.i == null || el.dataset.i === '')) { starTapSel(); return; }
    if (el.dataset.a === 'hl' && (el.dataset.i == null || el.dataset.i === '')) { hlTapSel(); return; }
    run(el.dataset.a, el.dataset.i);
  }
  bar.addEventListener('click', onActivate);
  menu.addEventListener('click', onActivate);

  function syncSettings() {
    const row = document.getElementById('csToggleRow'); if (!row) return;
    let box = document.getElementById('csPinsBox');
    if (!box) {
      box = document.createElement('div'); box.id = 'csPinsBox'; box.className = 'cs-box';
      const holder = document.querySelector('#csSub .set-sub-in');
      if (holder) holder.appendChild(box); else row.insertAdjacentElement('afterend', box);
      box.addEventListener('click', (e) => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.reset) { setPinned(DEFAULT_PINNED.slice()); setGest(GEST_DEF); setHlPrefs({ single: 0, double: 1 }); setColored([]); lsSet(NKEY, 'show'); }
        else if (b.dataset.col) { const cc = getColored(); setColored(cc.includes(b.dataset.col) ? cc.filter((x) => x !== b.dataset.col) : cc.concat([b.dataset.col])); }
        else if (b.dataset.hm) setGest({ hlMode: b.dataset.hm });
        else if (b.dataset.sm) setGest({ starMode: b.dataset.sm });
        else if (b.dataset.hd) setGest({ hlDbl: +b.dataset.hd });
        else if (b.dataset.hg) setGest({ hlLong: +b.dataset.hg });
        else if (b.dataset.id) { const cur = getPinned(); setPinned(cur.includes(b.dataset.id) ? cur.filter((x) => x !== b.dataset.id) : cur.concat([b.dataset.id])); }
        else if (b.dataset.cl) setGest({ copyLong: b.dataset.cl });
        else if (b.dataset.sd) setGest({ starDbl: +b.dataset.sd });
        else if (b.dataset.sl) setGest({ starLong: +b.dataset.sl });
        else if (b.dataset.nm) { lsSet(NKEY, b.dataset.nm); try { applyAll(); } catch (er) {} }
        syncSettings(); refreshUi();
      });
    }
    const pinned = getPinned(), g = getGest(), nm = noteMode(), pf = getStarPrefs(), hp = getHlPrefs();
    const acts = ACTIONS;
    const hlDots = (cur, fn) => `<div class="star-dots" style="margin-top:6px">${COLORS.map((c, i) => `<button type="button" class="star-dot ${cur === i ? 'sel' : ''}" style="background:${c}" aria-label="لون" onclick="${fn}(${i})"></button>`).join('')}</div>`;
    const chip = (a) => `<button type="button" data-id="${a.id}"><i class="ti ti-${a.icon}"></i> ${esc(a.label)}</button>`;
    const inBar = acts.filter((a) => pinned.includes(a.id)), inMenu = acts.filter((a) => !pinned.includes(a.id));
    const seg = (attr, cur, items) => `<div class="cs-seg">${items.map(([v, t]) => `<button type="button" data-${attr}="${v}" class="${String(cur) === String(v) ? 'on' : ''}">${t}</button>`).join('')}</div>`;
    box.style.display = supported ? '' : 'none';
    box.innerHTML = `<div class="cs-card">
        <div class="cs-card-t"><i class="ti ti-layout-navbar"></i> شريط التحديد<small>اضغط أي زر لنقله بين «الشريط» و«القائمة ⋯». «⋯» يظهر دائماً في الشريط.</small></div>
        <div class="cs-grp"><b>الظاهرة في الشريط</b><div class="cs-pins">${inBar.length ? inBar.map(chip).join('') : '<span class="cs-empty">لا شيء — كل الإجراءات داخل «⋯»</span>'}</div></div>
        <div class="cs-grp"><b>داخل القائمة «⋯»</b><div class="cs-pins">${inMenu.length ? inMenu.map(chip).join('') : '<span class="cs-empty">كل الإجراءات مثبّتة في الشريط</span>'}</div></div>
        <div class="cs-grp"><b>زر «نسخ» — ضغطة مطوّلة</b>${seg('cl', g.copyLong, [['share', 'مشاركة'], ['plain', 'نسخ بلا مصدر'], ['off', 'لا شيء']])}</div>
      </div>
      <div class="cs-card">
        <div class="cs-card-t"><i class="ti ti-color-swatch"></i> ألوان الأزرار<small>كل الأزرار بيضاء افتراضياً. اضغط زراً ليصير ملوّناً في الشريط والقائمة فيسهل تمييزه، واضغطه مرة أخرى لإعادته أبيض.</small></div>
        <div class="cs-pins">${acts.filter((a) => a.id !== 'clear' && a.id !== 'all' && a.id !== 'copy' && a.id !== 'plain').map((a) => { const on = isColored(a.id); return `<button type="button" data-col="${a.id}" class="${on ? 'on' : ''}"><i class="ti ti-${a.icon}"${on && CMENU[a.id] ? ` style="color:${CMENU[a.id]}"` : ''}></i> ${esc(a.label)}</button>`; }).join('')}</div>
      </div>
      <div class="cs-card">
        <div class="cs-card-t"><i class="ti ti-palette"></i> التظليل</div>
        <div class="cs-grp"><b>طريقة اختيار اللون</b>${seg('hm', g.hlMode, [['tap', 'زر واحد بإيماءات'], ['dots', 'الألوان ظاهرة دائماً']])}</div>
        ${g.hlMode === 'tap' ? `<div class="cs-grp"><b>نقرتان متتاليتان</b>${seg('hd', g.hlDbl, [[1, 'اللون الثاني'], [0, 'معطّلة']])}</div>
        <div class="cs-grp"><b>ضغطة مطوّلة</b>${seg('hg', g.hlLong, [[1, 'قائمة الألوان'], [0, 'معطّلة']])}</div>
        <div class="cs-grp"><b>لون النقرة الواحدة ثم النقرتين</b>${hlDots(hp.single, 'csHlSingle')}${hlDots(hp.double, 'csHlDouble')}</div>` : ''}
      </div>
      <div class="cs-card">
        <div class="cs-card-t"><i class="ti ti-star"></i> النجمة</div>
        <div class="cs-grp"><b>طريقة اختيار اللون</b>${seg('sm', g.starMode, [['tap', 'زر واحد بإيماءات'], ['dots', 'الألوان ظاهرة دائماً']])}</div>
        ${g.starMode === 'tap' ? `<div class="cs-grp"><b>نقرتان متتاليتان</b>${seg('sd', g.starDbl, [[1, 'اللون الثاني'], [0, 'معطّلة']])}</div>
        <div class="cs-grp"><b>ضغطة مطوّلة</b>${seg('sl', g.starLong, [[1, 'قائمة الألوان'], [0, 'معطّلة']])}</div>
        <div class="cs-grp"><b>لون النقرة الواحدة ثم النقرتين</b><div class="star-dots" style="margin-top:6px">${starDotsHtml(pf.single, 'csPrefSingle')}</div><div class="star-dots" style="margin-top:8px">${starDotsHtml(pf.double, 'csPrefDouble')}</div></div>` : ''}
      </div>
      <div class="cs-card">
        <div class="cs-card-t"><i class="ti ti-pencil"></i> الملاحظات</div>
        <div class="cs-grp"><b>عرضها في النص</b>${seg('nm', nm, [['show', 'ظاهرة دائماً'], ['icon', 'سطر مختصر'], ['hide', 'مخفية']])}</div>
      </div>
      <div class="cs-pins" style="margin-top:12px"><button type="button" data-reset="1" style="opacity:.8"><i class="ti ti-restore"></i> الافتراضي</button></div>`;
    if (!window.csHlSingle) { window.csHlSingle = (i) => { const p = getHlPrefs(); p.single = i; setHlPrefs(p); syncSettings(); refreshUi(); }; window.csHlDouble = (i) => { const p = getHlPrefs(); p.double = i; setHlPrefs(p); syncSettings(); }; }
    if (!window.csPrefSingle) { window.csPrefSingle = (c) => { const p = getStarPrefs(); p.single = c; saveStarPrefs(p); syncSettings(); }; window.csPrefDouble = (c) => { const p = getStarPrefs(); p.double = c; saveStarPrefs(p); syncSettings(); }; }
  }
  function applyMode() {
    document.body.classList.toggle('cs-on', enabled());
    if (!enabled()) { clearSel(); if (supported) { CSS.highlights.delete('rs-sel'); } }
    applyAll();
    const t = document.getElementById('csToggle'); if (t) t.classList.toggle('on', enabled());
    const row = document.getElementById('csToggleRow'); if (row) row.style.display = supported ? '' : 'none';
    syncSettings();
  }
  window.rsToggleCustomSelect = function () { lsSet(PREF, enabled() ? '0' : '1'); applyMode(); };
  const _oas = window.openAdvancedSettings;
  if (typeof _oas === 'function') window.openAdvancedSettings = function () { const r = _oas.apply(this, arguments); applyMode(); return r; };

  let rzT = 0; addEventListener('resize', () => { clearTimeout(rzT); rzT = setTimeout(() => { try { applyAll(); } catch (er) {} }, 250); });
  const boot = () => { applyMode(); observe(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.RSSelect = { marks: () => hlRanges.map((h) => ({ range: h.range, c: h.entry.c, fav: h.entry.fav, col: h.entry.col })), COLORS, noteMode, cycleNotes: () => { const m = noteMode(), n = m === 'show' ? 'icon' : (m === 'icon' ? 'hide' : 'show'); lsSet(NKEY, n); applyAll(); syncSettings(); toast(n === 'show' ? 'الملاحظات ظاهرة' : (n === 'icon' ? 'الملاحظات بسطر مختصر' : 'الملاحظات مخفية')); }, clear: clearSel, apply: applyAll, enabled, openText, refreshPins: () => { syncSettings(); refreshUi(); } };
})();
