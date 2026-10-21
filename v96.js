(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const RSV96 = (window.RSV96 = window.RSV96 || {});

  window.toggleFilterPartGroup = function (evt, gid) {
    const sub = $('filter-part-' + gid);
    if (!sub) return;
    sub.classList.toggle('expanded');
    if (evt && evt.currentTarget) evt.currentTarget.classList.toggle('expanded');
  };
  window.onFilterPartGroupToggle = function (cb) {
    const sub = $('filter-part-' + cb.dataset.bgroup);
    if (sub) sub.querySelectorAll('input[data-book]').forEach((c) => { c.checked = cb.checked; });
    cb.indeterminate = false;
    syncAuthorBox(cb.dataset.authorOfGroup);
    if (typeof saveCurrentSearchFilterState === 'function') saveCurrentSearchFilterState();
  };
  window.onFilterBookToggle = function (cb) {
    if (typeof saveCurrentSearchFilterState === 'function') saveCurrentSearchFilterState();
  };
  function syncAuthorBox(aid) {
    const box = document.querySelector('#searchFilterPanel input[data-author="' + aid + '"]');
    if (!box) return;
    const kids = document.querySelectorAll('#searchFilterPanel input[data-author-of="' + aid + '"]');
    box.checked = kids.length > 0 && Array.from(kids).every((b) => b.checked);
    const some = Array.from(kids).some((b) => b.checked);
    box.indeterminate = some && !box.checked;
  }
  window.syncFilterPartGroups = function () {
    const panel = $('searchFilterPanel'); if (!panel) return;
    panel.querySelectorAll('input[data-bgroup]').forEach((g) => {
      const sub = $('filter-part-' + g.dataset.bgroup); if (!sub) return;
      const kids = Array.from(sub.querySelectorAll('input[data-book]'));
      const on = kids.filter((k) => k.checked).length;
      g.checked = kids.length > 0 && on === kids.length;
      g.indeterminate = on > 0 && on < kids.length;
    });
    panel.querySelectorAll('input[data-author]').forEach((a) => syncAuthorBox(a.dataset.author));
  };

  const RGB_OF = { red: [192, 57, 43], green: [30, 132, 73], blue: [36, 113, 163] };
  function parseCssColor(s) {
    if (!s) return null;
    const m = String(s).match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/);
    if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
    const h = String(s).trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (h) {
      let x = h[1]; if (x.length === 3) x = x.split('').map((c) => c + c).join('');
      return { r: parseInt(x.slice(0, 2), 16), g: parseInt(x.slice(2, 4), 16), b: parseInt(x.slice(4, 6), 16), a: 1 };
    }
    return null;
  }
  function colorName(css) {
    const c = parseCssColor(css); if (!c || c.a < 0.2) return null;
    const mx = Math.max(c.r, c.g, c.b), mn = Math.min(c.r, c.g, c.b), d = mx - mn;
    if (d < 40) return null;
    let h;
    if (mx === c.r) h = ((c.g - c.b) / d) % 6; else if (mx === c.g) h = (c.b - c.r) / d + 2; else h = (c.r - c.g) / d + 4;
    h = (h * 60 + 360) % 360;
    if (h < 25 || h >= 335) return 'red';
    if (h >= 75 && h < 175) return 'green';
    if (h >= 185 && h < 265) return 'blue';
    return null;
  }
  const hasBg = (css) => { const c = parseCssColor(css); return !!c && c.a > 0.2; };

  function htmlToMarkup(root) {
    const runs = [];
    let pendingNl = false;
    const last = () => runs[runs.length - 1];
    const nl = () => { runs.push({ nl: true }); pendingNl = false; };
    const push = (t, st) => {
      if (!t) return;
      if (pendingNl && runs.length && !last().nl) nl();
      pendingNl = false;
      runs.push({ t, b: st.b, m: st.m, c: st.c });
    };
    function walk(n, st) {
      n.childNodes.forEach((ch) => {
        if (ch.nodeType === 3) { push(ch.nodeValue.replace(/ /g, ' ').replace(/[​‎‏]/g, ''), st); return; }
        if (ch.nodeType !== 1) return;
        const tag = ch.tagName;
        if (tag === 'BR') { nl(); return; }
        if (tag === 'HR') { if (runs.length && !last().nl) nl(); push('---', {}); nl(); return; }
        const ns = { b: st.b, m: st.m, c: st.c };
        if (tag === 'B' || tag === 'STRONG') ns.b = true;
        if (tag === 'MARK') ns.m = true;
        const cs = ch.style || {};
        const cls = ch.className || '';
        const mc = /\bcbn-(red|green|blue)\b/.exec(cls);
        if (mc) ns.c = mc[1];
        if (cs.fontWeight && (cs.fontWeight === 'bold' || parseInt(cs.fontWeight, 10) >= 600)) ns.b = true;
        if (cs.fontWeight && (cs.fontWeight === 'normal' || (parseInt(cs.fontWeight, 10) || 0) > 0 && parseInt(cs.fontWeight, 10) < 600)) ns.b = false;
        if (cs.backgroundColor !== undefined && cs.backgroundColor !== '') ns.m = hasBg(cs.backgroundColor);
        if (cs.color) ns.c = colorName(cs.color);
        if (tag === 'FONT' && ch.getAttribute('color')) ns.c = colorName(ch.getAttribute('color'));
        const block = tag === 'DIV' || tag === 'P' || tag === 'LI' || tag === 'UL' || tag === 'OL';
        if (block && runs.length && !last().nl) nl();
        walk(ch, ns);
        if (block) pendingNl = true;
      });
    }
    walk(root, {});
    const merged = [];
    runs.forEach((r) => {
      const p = merged[merged.length - 1];
      if (!r.nl && p && !p.nl && !!p.b === !!r.b && !!p.m === !!r.m && (p.c || null) === (r.c || null)) p.t += r.t; else merged.push(Object.assign({}, r));
    });
    return merged.map((r) => {
      if (r.nl) return '\n';
      let t = r.t;
      if (!t.trim()) return t;
      const lead = t.match(/^\s*/)[0], trail = t.match(/\s*$/)[0];
      let core = t.slice(lead.length, t.length - trail.length);
      if (r.b) core = '**' + core + '**';
      if (r.m) core = '==' + core + '==';
      if (r.c) core = '[color:' + r.c + ']' + core + '[/color]';
      return lead + core + trail;
    }).join('').replace(/\n{4,}/g, '\n\n\n');
  }
  RSV96.htmlToMarkup = htmlToMarkup;
  RSV96.setEditorRaw = (el, raw) => setEditor(el, raw);

  function markupToHtml(raw) {
    try { return typeof renderNoteText === 'function' ? renderNoteText(raw || '') : String(raw || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])).replace(/\n/g, '<br>'); } catch (e) { return ''; }
  }
  const HEX0 = { red: '#C0392B', green: '#1E8449', blue: '#2471A3' };
  function setEditor(el, raw) {
    el.innerHTML = markupToHtml(raw);
    el.querySelectorAll('[class*="cbn-"]').forEach((n) => {
      const m = /\bcbn-(red|green|blue)\b/.exec(n.className || '');
      if (m) { n.removeAttribute('class'); n.style.color = HEX0[m[1]]; }
    });
  }
  const editorOf = (el) => el || document.activeElement;
  function activeEditor() {
    const a = document.activeElement;
    if (a && a.classList && a.classList.contains('rs-rich')) return a;
    return document.getElementById('inlineNoteTa') || document.getElementById('noteEditorInput');
  }
  function editorBase(ed) { try { return getComputedStyle(ed).color; } catch (e) { return '#000'; } }
  const HEX = { red: '#C0392B', green: '#1E8449', blue: '#2471A3' };
  function selColor() { try { return colorName(document.queryCommandValue('foreColor')); } catch (e) { return null; } }
  function selMark() { try { const v = document.queryCommandValue('hiliteColor') || document.queryCommandValue('backColor'); return hasBg(v); } catch (e) { return false; } }

  window.rsNoteFmt = function (kind, val) {
    const ed = activeEditor(); if (!ed) return;
    ed.focus();
    try { document.execCommand('styleWithCSS', false, true); } catch (e) {}
    if (kind === 'bold') {
      try { document.execCommand('bold'); } catch (e) {}
    } else if (kind === 'mark') {
      const on = selMark();
      try { document.execCommand('hiliteColor', false, on ? 'transparent' : '#ffe066'); } catch (e) {}
    } else if (kind === 'color') {
      const cur = selColor();
      try { document.execCommand('foreColor', false, cur === val ? editorBase(ed) : HEX[val]); } catch (e) {}
    } else if (kind === 'divider') {
      try { document.execCommand('insertHTML', false, '<hr class="cb-note-hr"><br>'); } catch (e) {}
    }
    syncToolbars();
  };
  function syncToolbars() {
    const ed = document.activeElement;
    if (!ed || !ed.classList || !ed.classList.contains('rs-rich')) return;
    const col = selColor(), mk = selMark();
    let bd = false; try { bd = document.queryCommandState('bold'); } catch (e) {}
    document.querySelectorAll('.rs-ntb [data-fmt]').forEach((b) => {
      const f = b.dataset.fmt;
      b.classList.toggle('on', f === 'bold' ? bd : f === 'mark' ? mk : f.indexOf('color:') === 0 ? f.slice(6) === col : false);
    });
  }
  document.addEventListener('selectionchange', () => { try { syncToolbars(); } catch (e) {} });
  document.addEventListener('paste', (e) => {
    const t = e.target;
    if (!t || !t.classList || !t.classList.contains('rs-rich')) return;
    e.preventDefault();
    const txt = (e.clipboardData || window.clipboardData).getData('text/plain') || '';
    try { document.execCommand('insertText', false, txt); } catch (er) {}
  }, true);

  window.inlineNoteWrap = function () {};
  window.noteEditorWrap = function () {};
  window.noteEditorInsertDivider = function () { window.rsNoteFmt('divider'); };
  window.openNoteEditor = function (existingUid) {
    noteEditorTargetUid = existingUid;
    const ed = $('noteEditorInput');
    const cb = customBooks.find((b) => b.id === currentCustomBookId);
    const loc = cb && findItemLocation(cb, existingUid);
    setEditor(ed, loc ? loc.array[loc.index].text : '');
    $('noteEditorOverlay').classList.add('show');
    setTimeout(() => { ed.focus(); try { const r = document.createRange(); r.selectNodeContents(ed); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } catch (e) {} }, 60);
  };
  window.saveNoteEditor = function () {
    const ed = $('noteEditorInput');
    const text = htmlToMarkup(ed).replace(/\s+$/, '');
    const cb = customBooks.find((b) => b.id === currentCustomBookId);
    if (!cb || !noteEditorTargetUid) { closeNoteEditor(); return; }
    const loc = findItemLocation(cb, noteEditorTargetUid);
    if (loc) loc.array[loc.index].text = text;
    cb.updatedAt = Date.now();
    saveCustomBooks();
    closeNoteEditor();
    renderCustomBookPage();
  };
  window.saveInlineNote = function () {
    const ed = $('inlineNoteTa');
    if (!ed || !inlineInsertAt) { cancelInlineInsert(); return; }
    const text = htmlToMarkup(ed).replace(/\s+$/, '');
    if (!text.trim()) { cancelInlineInsert(); return; }
    const cb = customBooks.find((b) => b.id === currentCustomBookId);
    if (!cb) { cancelInlineInsert(); return; }
    const arr = inlineInsertAt.parentChapterUid
      ? ((cb.items.find((it) => it.uid === inlineInsertAt.parentChapterUid) || { items: [] }).items)
      : cb.items;
    arr.splice(inlineInsertAt.index, 0, { uid: newUid('it'), type: 'note', text });
    cb.updatedAt = Date.now();
    saveCustomBooks();
    inlineInsertAt = null;
    renderCustomBookPage();
  };

  const CHROME_SEL = '.list-row, .lib-card, .author-card, .pp-row, .osite-card, .settings-row, .filter-author-row, .filter-part-row, .filter-book-row, .swipe-row, .sbx-pin, .pin-chip, .ref-link-row, button, [role="button"]';
  const KEEP_SEL = 'input, textarea, [contenteditable="true"], .rs-rich, .reader-section, .masala, .cb-item-body, .note-display, .wr-masala, .selectable';
  function insideKeep(n) { const el = n && (n.nodeType === 1 ? n : n.parentElement); return !!(el && el.closest && el.closest(KEEP_SEL)); }
  document.addEventListener('selectionchange', () => {
    try {
      const s = getSelection();
      if (!s || s.isCollapsed || !s.anchorNode) return;
      const el = s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement;
      if (!el || !el.closest) return;
      if (insideKeep(el)) return;
      if (el.closest(CHROME_SEL)) s.removeAllRanges();
    } catch (e) {}
  });
  document.addEventListener('contextmenu', (e) => {
    const t = e.target;
    if (!t || !t.closest || insideKeep(t)) return;
    if (t.closest('.list-row, .lib-card, .author-card, .pp-row, .osite-card, .pin-chip, .sbx-pin, .search-preset-chip')) e.preventDefault();
  }, true);
})();
