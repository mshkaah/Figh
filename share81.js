(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (m) => { try { showGenericToast(m); } catch (e) {} };
  const ar = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
  const APP_NAME = 'مشكاة الفقه';
  const JAMI_NAME = 'جامع الاستفتاءات', JAMI_AUTHOR = 'للشيخ عادل الجوهر';
  const BASE_W = 1080;
  const MAX_H = 14000;
  const MAX_PAGES = 30;
  const FS_MIN = 26;
  const FS_MIN_FIT = 24;
  const MAX_PIXELS = 16e6;
  const RSShare = (window.RSShare = window.RSShare || {});

  function parse(text) {
    text = String(text || '').trim();
    let src = '', body = text;
    const m = text.match(/\n\nالمصدر:\s*([\s\S]*)$/);
    if (m) { src = m[1].trim(); body = text.slice(0, m.index).trim(); }
    const model = { kind: 'plain', body, src, question: '', opinions: [] };
    const fm = body.match(/\n\nالحواشي:\n([\s\S]*)$/);
    if (fm && !/^السؤال:/.test(body)) {
      model.body = body = body.slice(0, fm.index).trim();
      model.fnPlain = [];
      fm[1].split(/\n(?=\[[\d٠-٩]+\] )/).forEach((blk) => {
        const mm = blk.match(/^\[([\d٠-٩]+)\] ([\s\S]*)$/);
        if (mm) model.fnPlain.push({ key: 'p' + mm[1], n: +String(mm[1]).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)), text: mm[2].replace(/\n\s+/g, '\n').trim() });
      });
    }
    if (/^السؤال:/.test(body)) {
      const qi = body.indexOf('\n\nآراء المراجع:\n\n');
      if (qi > 0) {
        model.kind = 'jami';
        model.question = body.slice(0, qi).replace(/^السؤال:\s*/, '').trim();
        body.slice(qi + '\n\nآراء المراجع:\n\n'.length).split(/\n\n(?=● )/).forEach((p) => {
          const mm = p.match(/^● ([^\n]*?):\n([\s\S]*)$/);
          if (mm) model.opinions.push({ name: mm[1].trim(), text: mm[2].trim() });
        });
      } else {
        const am = body.match(/^السؤال:\s*([\s\S]*?)\n\nالجواب \(([^\n]*?)\):\s*([\s\S]*)$/);
        if (am) { model.kind = 'jami'; model.question = am[1].trim(); model.opinions = [{ name: am[2].trim(), text: am[3].trim() }]; }
      }
      if (model.kind === 'jami') splitJamiSources(model);
    }
    return model;
  }

  function splitJamiSources(model) {
    try {
      if (typeof loadCmpData !== 'function') return;
      const d = loadCmpData(), qn = nrm(model.question.split('\n')[0]);
      let subj = null;
      d.subjectsById.forEach((sb) => { if (!subj && nrm(String(sb.question || '').trim().split('\n')[0]) === qn) subj = sb; });
      if (!subj) return;
      const answers = d.answersBySubject.get(subj.id) || [];
      model.opinions.forEach((o) => {
        const sc = d.scholars.find((x) => nrm(x.name) === nrm(o.name)); if (!sc) return;
        const a = answers.find((x) => x.scholar_id === sc.id);
        const ex = a && a.answer_extra_info ? String(a.answer_extra_info).trim() : '';
        if (ex && o.text.length > ex.length && o.text.slice(-ex.length) === ex) { o.text = o.text.slice(0, -ex.length).trim(); o.srcText = ex; }
      });
      const qx = subj.question_extra_info ? String(subj.question_extra_info).trim() : '';
      if (qx && model.question.slice(-qx.length) === qx) { model.question = model.question.slice(0, -qx.length).trim(); model.qSrc = qx; }
    } catch (e) {}
  }

  const _cc = document.createElement('canvas').getContext('2d');
  function rgbOf(str) {
    _cc.fillStyle = '#000'; _cc.fillStyle = String(str || '#000');
    const s = _cc.fillStyle;
    if (s[0] === '#') return [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
    const m = s.match(/[\d.]+/g) || [0, 0, 0];
    return [+m[0], +m[1], +m[2]];
  }
  const toHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
  function lum(c) { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); }
  function contrast(a, b) { const la = lum(rgbOf(a)), lb = lum(rgbOf(b)); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); }
  function mix(a, b, t) { const x = rgbOf(a), y = rgbOf(b); return toHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t); }
  function ensure(fg, bg, min) {
    if (contrast(fg, bg) >= min) return toHex.apply(null, rgbOf(fg));
    const target = lum(rgbOf(bg)) > 0.5 ? '#000000' : '#ffffff';
    for (let t = 0.1; t <= 1.001; t += 0.1) { const h = mix(fg, target, t); if (contrast(h, bg) >= min) return h; }
    return target;
  }
  function ensureBg(bg, fg, min) {
    if (contrast(fg, bg) >= min) return toHex.apply(null, rgbOf(bg));
    const target = lum(rgbOf(fg)) > 0.5 ? '#000000' : '#ffffff';
    for (let t = 0.1; t <= 1.001; t += 0.1) { const h = mix(bg, target, t); if (contrast(fg, h) >= min) return h; }
    return bg;
  }
  const rgba = (c, a) => { const x = rgbOf(c); return `rgba(${x[0]},${x[1]},${x[2]},${a})`; };

  const PALETTES = {
    light: { bg: '#F4F1EC', surface: '#FFFFFF', surface2: '#EFEBE4', text: '#241B0F', muted: '#5F5446', dim: '#756A58', line: 'rgba(0,0,0,.12)', lineStrong: 'rgba(0,0,0,.26)', shadow: '60,45,20' },
    dark: { bg: '#12100D', surface: '#1D1A15', surface2: '#2A251C', text: '#F1EBDD', muted: '#CBC1AB', dim: '#A99F89', line: 'rgba(255,255,255,.14)', lineStrong: 'rgba(255,255,255,.28)', shadow: '0,0,0' },
    paper: { bg: '#E7D9B9', surface: '#F7EFD9', surface2: '#EBDDBE', text: '#3A2A14', muted: '#5E4A2C', dim: '#76603C', line: 'rgba(80,55,20,.22)', lineStrong: 'rgba(80,55,20,.38)', shadow: '80,55,20' },
    cream: { bg: '#F6EEDC', surface: '#FFFCF3', surface2: '#F3EAD3', text: '#2D2312', muted: '#665A43', dim: '#7C6F55', accent: '#A6571F', line: 'rgba(90,65,20,.16)', lineStrong: 'rgba(90,65,20,.32)', shadow: '90,65,20' },
    sage: { bg: '#E4EDE6', surface: '#F8FBF8', surface2: '#E9F1EB', text: '#16261D', muted: '#46594D', dim: '#5E7266', accent: '#2E7D5B', line: 'rgba(20,70,45,.16)', lineStrong: 'rgba(20,70,45,.32)', shadow: '20,60,40' },
    sky: { bg: '#E2EBF4', surface: '#F9FBFE', surface2: '#E8EFF7', text: '#14212F', muted: '#465769', dim: '#5E7083', accent: '#1F6FA8', line: 'rgba(20,60,100,.16)', lineStrong: 'rgba(20,60,100,.32)', shadow: '20,50,90' },
    rose: { bg: '#F4E4E8', surface: '#FFFAFB', surface2: '#F8EAEE', text: '#2E1820', muted: '#68454F', dim: '#7F5E68', accent: '#B23A5B', line: 'rgba(110,30,55,.16)', lineStrong: 'rgba(110,30,55,.32)', shadow: '100,30,55' },
    plum: { bg: '#EBE5F3', surface: '#FCFAFF', surface2: '#F0EBF7', text: '#201733', muted: '#554A6E', dim: '#6D6288', accent: '#6B4BA3', line: 'rgba(60,35,110,.16)', lineStrong: 'rgba(60,35,110,.32)', shadow: '55,35,100' },
    slate: { bg: '#E6E9ED', surface: '#FFFFFF', surface2: '#EEF0F3', text: '#1A222B', muted: '#4A5663', dim: '#617080', accent: '#3F5B77', line: 'rgba(30,45,60,.16)', lineStrong: 'rgba(30,45,60,.32)', shadow: '30,45,60' },
    night: { bg: '#0A101C', surface: '#121B2D', surface2: '#1A263D', text: '#E8EEF8', muted: '#B5C2D8', dim: '#8E9DB8', accent: '#6FA8FF', line: 'rgba(160,190,255,.16)', lineStrong: 'rgba(160,190,255,.32)', shadow: '0,0,10' },
    forest: { bg: '#0B140F', surface: '#112019', surface2: '#192E24', text: '#E6F0EA', muted: '#B2C6BA', dim: '#8BA396', accent: '#5CC59A', line: 'rgba(150,230,190,.16)', lineStrong: 'rgba(150,230,190,.32)', shadow: '0,10,5' },
    gold: { bg: '#15100A', surface: '#201810', surface2: '#2C2216', text: '#F4E9D2', muted: '#CDBF9F', dim: '#A5977A', accent: '#D9A441', line: 'rgba(240,210,150,.16)', lineStrong: 'rgba(240,210,150,.32)', shadow: '10,5,0' },
    black: { bg: '#000000', surface: '#0A0A0A', surface2: '#151515', text: '#F2F2F2', muted: '#C4C4C4', dim: '#9A9A9A', accent: '#E8B04A', line: 'rgba(255,255,255,.16)', lineStrong: 'rgba(255,255,255,.32)', shadow: '0,0,0' }
  };
  const PAL_LIST = [['app', 'ألوان التطبيق'], ['light', 'فاتح'], ['cream', 'كريمي'], ['paper', 'ورقي'], ['sage', 'أخضر'], ['sky', 'سماوي'], ['rose', 'وردي'], ['plum', 'بنفسجي'], ['slate', 'رمادي'], ['dark', 'داكن'], ['night', 'ليلي'], ['forest', 'غابة'], ['gold', 'ذهبي'], ['black', 'أسود']];
  function theme(pal) {
    const cs = getComputedStyle(document.documentElement);
    const v = (n, d) => (cs.getPropertyValue(n).trim() || d);
    let fam = 'font-default';
    try { fam = localStorage.getItem('rs_fontFamily') || 'font-default'; } catch (e) {}
    const font = fam === 'font-naskh' ? "'Scheherazade New','Amiri',serif" : fam === 'font-serif' ? "'Amiri','Scheherazade New',serif" : "Tahoma,'Segoe UI',sans-serif";
    const T = {
      bg: v('--bg', '#F7F5F2'), surface: v('--surface', '#fff'), surface2: v('--surface-2', '#efebe4'), line: v('--line', 'rgba(0,0,0,.1)'),
      lineStrong: v('--line-strong', 'rgba(0,0,0,.2)'), accent: v('--accent', '#C0502A'),
      text: v('--text', '#241B0F'), muted: v('--text-muted', '#6B5F4E'), dim: v('--text-dim', '#9A8F7C'), shadow: v('--shadow-rgb', '60,45,20'), font
    };
    if (PALETTES[pal]) Object.assign(T, PALETTES[pal]);
    T.text = ensure(T.text, T.surface, 7);
    T.muted = ensure(T.muted, T.surface, 4.5);
    T.dim = ensure(T.dim, T.surface, 3.6);
    T.accentInk = contrast(T.accent, '#ffffff') >= contrast(T.accent, '#111111') ? '#ffffff' : '#111111';
    T.chip = ensureBg(T.accent, T.accentInk, 4.5);
    T.accentText = ensure(ensure(T.accent, T.surface, 4.5), T.surface2, 4.5);
    const ar_ = rgbOf(T.accent); T.accentRgb = ar_.join(',');
    return T;
  }

  const M0 = '\uE000', M1 = '\uE001', MFN = '\uE0F0', MSRC = '\uE0F2', MFH = '\uE0F3';
  const MARK_RE = /^[\uE0F0\uE0F2\uE0F3]|\uE000[\uE100-\uE1FF]|\uE001/g;
  const strip = (s) => String(s == null ? '' : s).replace(MARK_RE, '');
  const hasMarks = (s) => /[\uE000\uE001]/.test(s);
  const lineKind = (s) => (s && s.charAt(0) === MFN ? 'fn' : s && s.charAt(0) === MSRC ? 'src' : s && s.charAt(0) === MFH ? 'fh' : 'txt');
  let STY = [];
  function styId(st) {
    const k = JSON.stringify(st);
    let i = STY.findIndex((x) => x.k === k);
    if (i < 0) { if (STY.length >= 250) return -1; STY.push({ k, st }); i = STY.length - 1; }
    return i;
  }
  const mark = (st, w) => { const i = styId(st); return i < 0 ? w : M0 + String.fromCharCode(0xE100 + i) + w + M1; };
  const styOf = (ch) => (STY[ch.charCodeAt(0) - 0xE100] || {}).st || null;

  const mc = document.createElement('canvas').getContext('2d');
  mc.direction = 'rtl';
  const wcache = new Map();
  function wordW(font, w) {
    const key = font + '|' + w;
    let v = wcache.get(key);
    if (v === undefined) {
      const st = w.charCodeAt(0) === 0xE000 ? styOf(w.charAt(1)) : null;
      mc.font = st && st.b ? font.replace(/^\d+/, '800') : font;
      v = mc.measureText(strip(w)).width; if (wcache.size > 60000) wcache.clear(); wcache.set(key, v);
    }
    return v;
  }
  function lineW(font, s) {
    s = String(s == null ? '' : s);
    if (!hasMarks(s)) { mc.font = font; return mc.measureText(strip(s)).width; }
    const raw = s.replace(/^[\uE0F0\uE0F2\uE0F3]/, ''), re = /\uE000([\uE100-\uE1FF])([^\uE001]*)\uE001/g;
    let last = 0, m, tot = 0;
    const meas = (f, t) => { mc.font = f; return mc.measureText(t).width; };
    while ((m = re.exec(raw)) !== null) {
      if (m.index > last) tot += meas(font, raw.slice(last, m.index));
      const st = styOf(m[1]); tot += meas(st && st.b ? font.replace(/^\d+/, '800') : font, m[2]);
      last = m.index + m[0].length;
    }
    if (last < raw.length) tot += meas(font, raw.slice(last));
    return tot;
  }
  const SAFE = 0.985;
  function graphemes(s) {
    try { if (window.Intl && Intl.Segmenter) return Array.from(new Intl.Segmenter('ar', { granularity: 'grapheme' }).segment(s), (x) => x.segment); } catch (e) {}
    return s.match(/[^ً-ٰٟۖ-ۭ][ً-ٰٟۖ-ۭ]*/g) || [s];
  }
  function breakWord(font, w, maxW) {
    const out = []; let cur = '';
    graphemes(w).forEach((g) => { if (cur && lineW(font, cur + g) > maxW) { out.push(cur); cur = g; } else cur += g; });
    if (cur) out.push(cur);
    return out;
  }
  function wrap(font, text, maxW) {
    maxW = Math.max(20, maxW * SAFE);
    const out = [], sp = wordW(font, ' ');
    String(text == null ? '' : text).split('\n').forEach((para) => {
      const words = para.split(/\s+/).filter(Boolean);
      let line = '', lw = 0;
      words.forEach((w) => {
        const ww = wordW(font, w);
        if (ww > maxW) {
          if (line) { out.push(line); line = ''; lw = 0; }
          const mm = /^\uE000([\uE100-\uE1FF])([\s\S]*)\uE001$/.exec(w);
          const parts = breakWord(font, mm ? mm[2] : w, maxW).map((q) => (mm ? M0 + mm[1] + q + M1 : q));
          parts.slice(0, -1).forEach((p) => out.push(p));
          line = parts[parts.length - 1] || ''; lw = wordW(font, line);
          return;
        }
        if (!line) { line = w; lw = ww; }
        else if (lw + sp + ww <= maxW) { line += ' ' + w; lw += sp + ww; }
        else { out.push(line); line = w; lw = ww; }
      });
      if (line) out.push(line);
    });
    return out;
  }
  function ellip(font, s, maxW) {
    s = strip(String(s || ''));
    if (lineW(font, s) <= maxW) return s;
    const g = graphemes(s);
    while (g.length > 1 && lineW(font, g.join('') + '…') > maxW) g.pop();
    return g.join('').replace(/\s+$/, '') + '…';
  }

  const imgCache = new Map();
  function loadImg(src) {
    if (!src) return Promise.resolve(null);
    if (imgCache.has(src)) return imgCache.get(src);
    const p = new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
    imgCache.set(src, p);
    return p;
  }
  const nrm = (x) => String(x || '').replace(/[ً-ٰٟـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/^(المرجع|السيد|الشيخ|الميرزا|آية الله)\s+/g, '').trim();
  function authorIdByName(name) {
    try {
      const n = nrm(name); if (!n) return null;
      try { const sc = loadCmpData().scholars.find((x) => nrm(x.name) === n); if (sc && CMP_SCHOLAR_AUTHOR[sc.id]) return CMP_SCHOLAR_AUTHOR[sc.id]; } catch (e) {}
      let best = null;
      Object.keys(allAuthors).forEach((k) => { const a = nrm(allAuthors[k]); if (a && (a === n || a.indexOf(n) >= 0 || n.indexOf(a) >= 0)) { if (!best || a === n) best = k; } });
      return best === null ? null : (isNaN(+best) ? best : +best);
    } catch (e) { return null; }
  }
  const photoOf = (aid) => { try { return (aid != null && AUTHOR_PHOTOS[aid]) || null; } catch (e) { return null; } };

  function rr(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function circleImg(c, im, cx, cy, d, ring, ringW) {
    c.save(); c.beginPath(); c.arc(cx, cy, d / 2, 0, Math.PI * 2); c.clip();
    const sc = Math.max(d / im.width, d / im.height), dw = im.width * sc, dh = im.height * sc;
    c.drawImage(im, cx - dw / 2, cy - d / 2, dw, dh);
    c.restore();
    c.beginPath(); c.arc(cx, cy, d / 2, 0, Math.PI * 2); c.strokeStyle = ring; c.lineWidth = ringW || 2; c.stroke();
  }
  function diamond(c, x, y, r, color) {
    c.save(); c.fillStyle = color; c.beginPath(); c.moveTo(x, y - r); c.lineTo(x + r, y); c.lineTo(x, y + r); c.lineTo(x - r, y); c.closePath(); c.fill(); c.restore();
  }

  const WS_RE = /[\s ​-‏‪-‮⁦-⁩]+/g;
  const WS1 = new RegExp('^' + WS_RE.source + '$');
  const nws = (t) => String(t || '').replace(WS_RE, '');
  const rgbHex = (css) => { const m = String(css || '').match(/[\d.]+/g); return m && m.length >= 3 ? toHex(+m[0], +m[1], +m[2]) : null; };
  const RICH_SKIP = '.masala-tools, .cmp-card-tools, .thamra-item-tools, .ext-tools, button, .note-display, .note-accordion, .cs-xnote, script, style, .footnote-box, .fn-body, .thamra-tag';
  function fnEntryText(entry) {
    try {
      const tmp = document.createElement('div'); tmp.innerHTML = buildFootnoteEntryHtml(entry);
      const rem = Array.from(tmp.querySelectorAll('.fn-remark'));
      const t = (rem.length ? rem.map((x) => x.textContent.replace(/\s+/g, ' ').trim()) : [tmp.textContent.replace(/\s+/g, ' ').trim()]).filter(Boolean).join(' — ');
      return t;
    } catch (e) { return ''; }
  }
  function richFromHint(hint, body) {
    try {
      if (!hint || !body) return null;
      const range = hint.range || null, root = hint.el || (range && range.commonAncestorContainer);
      if (!root) return null;
      const top = root.nodeType === 1 ? root : root.parentElement; if (!top) return null;
      const baseEl = top.closest('.body-text') || top;
      const baseCs = getComputedStyle(baseEl);
      const baseCol = rgbHex(baseCs.color), baseW = parseInt(baseCs.fontWeight, 10) || 400;
      const marks = (window.RSSelect && RSSelect.marks) ? RSSelect.marks() : [];
      const COL = (window.RSSelect && RSSelect.COLORS) || [];
      const walker = document.createTreeWalker(top, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => {
          if (!n.data) return NodeFilter.FILTER_REJECT;
          const pe = n.parentElement; if (!pe) return NodeFilter.FILTER_REJECT;
          if (pe.closest('.fn-ref')) return range && !range.intersectsNode(n) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
          if (pe.closest(RICH_SKIP)) return NodeFilter.FILTER_REJECT;
          if (range && !range.intersectsNode(n)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      const chars = [], refs = [];
      let n;
      while ((n = walker.nextNode())) {
        const pe = n.parentElement, fr = pe.closest('.fn-ref');
        if (fr) {
          const mm = /toggleFootnote\(\s*event\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/.exec(fr.getAttribute('onclick') || '');
          if (mm && !refs.some((r) => r.pos === chars.length && r.num === +mm[2] && r.sec === +mm[1])) refs.push({ pos: chars.length, sec: +mm[1], num: +mm[2] });
          continue;
        }
        let a = 0, b = n.data.length;
        if (range) { if (n === range.startContainer) a = range.startOffset; if (n === range.endContainer) b = range.endOffset; }
        if (b <= a) continue;
        let base = null;
        if (!pe.closest('.gterm')) {
          const cs = getComputedStyle(pe), col = rgbHex(cs.color), w = parseInt(cs.fontWeight, 10) || 400;
          const isNum = !!pe.closest('.ms-num, .thamra-list-badge');
          const isFnw = !!pe.closest('.fn-word');
          const differs = col && baseCol && col !== baseCol;
          if (isNum || isFnw || differs || (w >= 600 && baseW < 600)) {
            base = { k: isFnw ? 'fnw' : (isNum ? 'num' : 'col') };
            if (differs || isNum) base.c = col;
            if (w >= 600 && baseW < 600) base.b = 1;
          }
        }
        const cuts = [a, b];
        const mk = [];
        marks.forEach((m) => {
          try {
            if (!m.range.intersectsNode(n)) return;
            const ms = n === m.range.startContainer ? m.range.startOffset : 0, me = n === m.range.endContainer ? m.range.endOffset : n.data.length;
            const s0 = Math.max(a, ms), e0 = Math.min(b, me); if (e0 > s0) { mk.push({ s: s0, e: e0, m }); cuts.push(s0, e0); }
          } catch (e) {}
        });
        const pts = Array.from(new Set(cuts)).sort((x, y) => x - y);
        for (let i = 0; i + 1 < pts.length; i++) {
          const s0 = pts[i], e0 = pts[i + 1]; if (e0 <= s0) continue;
          let st = base ? Object.assign({}, base) : null;
          mk.filter((q) => q.s <= s0 && q.e >= e0).forEach((q) => {
            st = st || { k: 'hl' };
            if (q.m.c != null && COL[q.m.c]) st.bg = COL[q.m.c];
            if (q.m.fav && q.m.col) st.u = q.m.col;
          });
          const seg = n.data.slice(s0, e0);
          for (const ch of seg) { if (!WS1.test(ch)) chars.push({ ch, st }); }
        }
      }
      if (!chars.length) return null;
      const flat = chars.map((x) => x.ch).join('');
      if (flat !== nws(body) && flat !== nws(body).replace(/\[[\d٠-٩]+\]/g, '')) return null;
      const fns = [];
      refs.forEach((r) => {
        const sec = (typeof currentSections !== 'undefined') ? currentSections[r.sec] : null;
        const entry = sec && sec.footnotes ? sec.footnotes[r.num - 1] : '';
        const key = r.sec + '_' + r.num;
        if (!fns.some((f) => f.key === key)) fns.push({ key, n: r.num, text: fnEntryText(entry) });
      });
      let ci = 0, out = '', tok = '', tokSt = undefined;
      const stKey = (st) => (st ? JSON.stringify(st) : '');
      const flush = () => { if (tok) { out += tokSt ? mark(tokSt, tok) : tok; tok = ''; } };
      const pushRefs = (pos) => { refs.filter((r) => r.pos === pos).forEach((r) => { flush(); out += mark({ k: 'fnref', b: 1, c: '#c0502a', key: r.sec + '_' + r.num, n: r.num }, '[' + ar(r.num) + ']'); tokSt = undefined; }); };
      pushRefs(0);
      const bodyC = flat === nws(body) ? body : body.replace(/\[[\d٠-٩]+\]/g, '');
      for (const ch of bodyC) {
        if (WS1.test(ch)) { flush(); out += ch; continue; }
        const c0 = chars[ci++];
        if (tok && stKey(c0.st) !== stKey(tokSt)) flush();
        tokSt = c0.st; tok += ch;
        if (refs.some((r) => r.pos === ci)) { flush(); pushRefs(ci); }
      }
      flush();
      return { marked: out, fns, fresh: true };
    } catch (e) { console.warn('rich', e); return null; }
  }
  function applyFnVisibility(str, cfgFn) {
    const keep = (key) => cfgFn && cfgFn.mode !== 'none' && !(cfgFn.hide && cfgFn.hide.indexOf(key) >= 0);
    return str.replace(/([-])([^]*)/g, (all, ch, txt) => {
      const st = styOf(ch); if (!st) return all;
      if (st.k === 'fnref') return keep(st.key) ? all : '';
      if (st.k === 'fnw') return cfgFn && cfgFn.mode !== 'none' ? all : txt;
      return all;
    });
  }
  function footnoteLines(R, keys, fs, font, colW, T) {
    const f = F(font, Math.max(14, Math.round(fs * 0.82)));
    const out = [];
    keys.forEach((k) => {
      const fn = R.fns.find((x) => x.key === k); if (!fn || !fn.text) return;
      const txt = mark({ k: 'fnnum', b: 1, c: T ? T.accentText : '#a0431f' }, '[' + ar(fn.n) + ']') + ' ' + fn.text;
      wrap(f, txt, colW - 40).forEach((l) => out.push(MFN + l));
    });
    return out;
  }
  function plainLinesFor(model, fs, font, colW, cfg) {
    const f = F(font, fs);
    if (!model.rich) {
      const out = wrap(f, model.body, colW), fn0 = cfg.fn || { mode: 'none', hide: [] };
      if (model.fnPlain && model.fnPlain.length && fn0.mode !== 'none') {
        const ff = F(font, Math.max(14, Math.round(fs * 0.82)));
        const rows = [];
        model.fnPlain.filter((x) => (fn0.hide || []).indexOf(x.key) < 0).forEach((x) => {
          wrap(ff, mark({ k: 'fnnum', b: 1, c: cfg.T ? cfg.T.accentText : '#a0431f' }, '[' + ar(x.n) + ']') + ' ' + x.text, colW - 40).forEach((l) => rows.push(MFN + l));
        });
        if (rows.length) { out.push(MFH + 'الهوامش'); rows.forEach((l) => out.push(l)); }
      }
      return out;
    }
    const R = model.rich, fn = cfg.fn || { mode: 'none', hide: [] };
    const marked = applyFnVisibility(R.marked, fn);
    const refKeys = (str) => { const ks = []; str.replace(/([-])([^]*)/g, (a, ch) => { const st = styOf(ch); if (st && st.k === 'fnref') ks.push(st.key); return a; }); return ks; };
    if (fn.mode === 'none' || !refKeys(marked).length) return wrap(f, marked, colW);
    const lines = [];
    if (fn.mode === 'end') {
      wrap(f, marked, colW).forEach((l) => lines.push(l));
      const keys = refKeys(marked).filter((k, i, a) => a.indexOf(k) === i);
      const fl = footnoteLines(R, keys, fs, font, colW, cfg.T);
      if (fl.length) { lines.push(MFH + 'الهوامش'); fl.forEach((l) => lines.push(l)); }
      return lines;
    }
    marked.split('\n').forEach((para) => {
      let unit = [], pend = [];
      const flush = () => {
        if (unit.length) wrap(f, unit.join(' '), colW).forEach((l) => lines.push(l));
        if (pend.length) footnoteLines(R, pend, fs, font, colW, cfg.T).forEach((l) => lines.push(l));
        unit = []; pend = [];
      };
      para.split(/ +/).filter(Boolean).forEach((tk) => {
        unit.push(tk);
        refKeys(tk).forEach((k) => pend.push(k));
        if (pend.length && /[.؟!۔:]$/.test(strip(tk).replace(/(\[[\d٠-٩]+\])+$/, ''))) flush();
      });
      flush();
    });
    return lines;
  }

  const STYLES = { card: 'بطاقة', mishkat: 'مشكاة', clean: 'نظيف', appid: 'هوية مشكاة' };
  const DEF_STYLE = 'card';
  const SITE_LINK = 'mshkaah.github.io/Figh';
  const baseOf = (st) => (st === 'mishkat' || st === 'appid' ? 'clean' : st);
  const APPBAR = 124;
  const ARCH = 150;
  function pads(style, fr, brand, fixed) {
    const cut = fixed ? 54 : 0;
    const FT = 132;
    if (style === 'appid') { const FT2 = 76; return { padX: 64, padT: APPBAR + 44, padB: 56 + FT2 + cut, cutB: 56 + FT2, footY: 30, cut }; }
    if (style === 'clean') return { padX: 64, padT: 64, padB: 56 + FT + cut, cutB: 56 + FT, footY: 26, cut };
    if (style === 'mishkat') return { padX: 120, padT: 56 + ARCH - 20, padB: 96 + FT + cut, cutB: 96 + FT, footY: 66, cut };
    const M = 56, P = (fr !== null && fr < 1) ? 48 : 56, FOOT = 176;
    return { M, P, FOOT, padX: M + P, padT: M + P, padB: P + FOOT + cut, cutB: P + FOOT, footY: 44, cut };
  }
  function headSpec(style, h) {
    if (!h.name) return { HH: 0, total: 0 };
    if (style === 'mishkat') { const HH = (h.img ? 112 : 0) + 56 + (h.sub ? 40 : 0) + (h.where ? 34 : 0); return { HH, total: HH + 60 }; }
    const text = 54 + (h.sub ? 36 : 0) + (h.where ? 32 : 0);
    const HH = Math.max(h.img ? 100 : 0, text) + 4;
    return { HH, total: HH + 22 + 2 + 30 };
  }
  function segMetrics(u) {
    const r = (x) => Math.round(x * u);
    return { inX: r(36), qTop: r(20), qLabel: r(42), qBot: r(26), oTop: r(22), oChip: r(58), oGap: r(16), oCont: r(44), oBot: r(26), gap: r(22), colGap: 56 };
  }

  const F = (font, sz, wt) => `${wt || 400} ${sz}px ${font}`;
  function jamiFonts(k) { const fs = Math.max(8, Math.round(40 * k)); return { fs, lh: Math.round(fs * 1.85) }; }
  function plainFonts(k) { const fs = Math.max(8, Math.round(42 * k)); return { fs, lh: Math.round(fs * 1.95) }; }
  const segH = (b, S) => b.kind === 'q' ? S.qTop + S.qLabel + b.lines.length * b.lh + S.qBot : S.oTop + S.oChip + S.oGap + b.lines.length * b.lh + S.oBot;

  function buildBlocks(model, ops, k, regionW, nc, S, font) {
    const { fs, lh } = jamiFonts(k);
    const qFont = F(font, fs, 600), oFont = F(font, fs);
    const colW = (regionW - (nc - 1) * S.colGap) / nc;
    const q = { kind: 'q', lines: wrap(qFont, model.question, regionW - 2 * S.inX).concat(model.qSrc ? wrap(scaleFont(qFont, 0.78), model.qSrc, regionW - 2 * S.inX).map((l) => MSRC + l) : []), lh: Math.round(fs * 1.8), fs, font: qFont };
    const srcLines = (t, w) => (t ? wrap(scaleFont(oFont, 0.78), t, w).map((l) => MSRC + l) : []);
    const os = ops.map((o) => ({ kind: 'o', name: o.name, img: o.img, lines: wrap(oFont, o.text, colW - 2 * S.inX).concat(srcLines(o.srcText, colW - 2 * S.inX)), lh, fs, font: oFont, colW }));
    return { q, os, colW };
  }

  function packBoxes(q, os, nc, regionW, regionH, S) {
    const items = []; let y = 0;
    if (q) { const h = segH(q, S); if (h > regionH + 0.01) return { ok: false }; items.push({ t: 'q', col: -1, y, h, b: q, first: true, last: true }); y += h + S.gap; }
    const colY = new Array(nc).fill(y);
    for (const o of os) {
      let ci = 0; for (let i = 1; i < nc; i++) if (colY[i] < colY[ci]) ci = i;
      const h = segH(o, S);
      if (colY[ci] + h > regionH + 0.01) return { ok: false };
      items.push({ t: 'o', col: ci, y: colY[ci], h, b: o, first: true, last: true });
      colY[ci] += h + S.gap;
    }
    const used = os.length ? Math.max.apply(null, colY) - S.gap : (q ? y - S.gap : 0);
    return { ok: true, items, used };
  }

  function packPlain(lines, lh, nc, regionH) {
    const cap = Math.floor(regionH / lh);
    if (cap < 1) return { ok: false };
    const per = Math.max(1, Math.ceil(lines.length / nc));
    if (per > cap) return { ok: false };
    const items = [];
    for (let ci = 0; ci < nc; ci++) {
      const part = lines.slice(ci * per, (ci + 1) * per);
      if (part.length) items.push({ t: 'p', col: ci, y: 0, h: part.length * lh, lines: part, lh, first: true, last: true });
    }
    return { ok: true, items, used: per * lh };
  }

  function flowPages(q, os, nc, regionH, S) {
    const pages = [{ items: [] }];
    let pi = 0, ci = 0, y = 0, colStart = 0;
    const startRegion = () => { colStart = (pi === 0 && q) ? qBottom : 0; y = colStart; };
    let qBottom = 0;
    if (q) {
      const h = segH(q, S);
      if (h > regionH * 0.7) throw new Error('q-too-tall');
      pages[0].items.push({ t: 'q', col: -1, y: 0, h, b: q, first: true, last: true });
      qBottom = h + S.gap;
    }
    startRegion();
    const next = () => {
      ci++; if (ci >= nc) { ci = 0; pi++; if (pi >= MAX_PAGES) throw new Error('too-many'); pages.push({ items: [] }); }
      startRegion();
    };
    for (const o of os) {
      let left = o.lines.slice(), first = true;
      while (left.length) {
        const headH = first ? S.oTop + S.oChip + S.oGap : S.oTop + S.oCont;
        const room = regionH - y - headH - S.oBot;
        let n = Math.floor(room / o.lh);
        if (n >= left.length) n = left.length;
        else if (n < Math.min(2, left.length)) { if (y === colStart) throw new Error('region-too-small'); next(); continue; }
        else if (left.length - n === 1 && n > 2) n--;
        const part = Object.assign({}, o, { lines: left.slice(0, n) });
        const h = headH + n * o.lh + S.oBot;
        pages[pi].items.push({ t: 'o', col: ci, y, h, b: part, first, last: n === left.length, cont: !first });
        left = left.slice(n); y += h + S.gap; first = false;
        if (left.length) next();
      }
    }
    return pages;
  }

  function packFit(q, os, nc, regionW, regionH, S) {
    const lhq = q ? q.lh : 0;
    if (q) {
      const chrome = S.qTop + S.qLabel + S.qBot;
      const maxQ = Math.max(2, Math.floor((regionH * 0.5 - chrome) / lhq));
      if (q.lines.length > maxQ) { q = Object.assign({}, q, { lines: q.lines.slice(0, maxQ) }); q.lines[maxQ - 1] = ellip(q.font, q.lines[maxQ - 1], regionW - 2 * S.inX); q.trunc = true; }
    }
    const lhO = os.length ? os[0].lh : 1;
    const noteH = Math.round(lhO * 0.95);
    const cut = (o, cap) => {
      if (o.lines.length <= cap) return o;
      const lines = o.lines.slice(0, cap);
      lines[cap - 1] = ellip(o.font, lines[cap - 1] + ' ' + (o.lines[cap] || ''), o.colW - 2 * S.inX);
      return Object.assign({}, o, { lines, trunc: true });
    };
    const attempt = (m, cap, reserve) => {
      const sub = os.slice(0, m).map((o) => cut(o, cap));
      const r = packBoxes(q, sub, nc, regionW, regionH - (reserve ? noteH + S.gap : 0), S);
      return r.ok ? Object.assign(r, { dropped: os.length - m, os: sub }) : null;
    };
    if (!os.length) { const r = packBoxes(q, [], nc, regionW, regionH, S); return r.ok ? Object.assign(r, { dropped: 0, os: [] }) : null; }
    const maxN = Math.max.apply(null, os.map((o) => o.lines.length));
    for (let m = os.length; m >= 1; m--) {
      const reserve = m < os.length;
      if (!attempt(m, 1, reserve)) continue;
      let lo = 1, hi = maxN, best = attempt(m, 1, reserve);
      while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); const r = attempt(m, mid, reserve); if (r) { lo = mid; best = r; } else hi = mid - 1; }
      if (lo < 2 && m > 1) continue;
      best.noteReserve = reserve ? noteH + S.gap : 0;
      return best;
    }
    return null;
  }

  function plan(model, ops, cfg) {
    const { T, style, fixed, fr, W, H, content, colsOpt, brand, head } = cfg;
    const ks = cfg.kScale || 1, fitK = cfg.fitK * ks;
    const pd = pads(style, fixed ? fr : null, brand, fixed);
    const regionW = W - 2 * pd.padX;
    const font = T.font;
    const isJami = model.kind === 'jami';
    const fullMode = !fixed || content !== 'fit';
    const maxNc = isJami ? Math.min(Math.max(ops.length, 1), 4) : 3;
    const colCandidates = () => {
      if (colsOpt !== 'auto') return [Math.max(1, Math.min(+colsOpt, isJami ? Math.max(ops.length, 1) : 3))];
      if (!fixed) return [1];
      const o = []; for (let n = 1; n <= maxNc; n++) if ((regionW - (n - 1) * 56) / n >= 400) o.push(n);
      return o.length ? o : [1];
    };
    const base = { T, style, W, pd, regionW, head, brand, fixed, fr };
    const uOf = (k) => Math.max(0.62, Math.min(1, k));
    const regionHOf = (HH) => HH - pd.padT - pd.padB - head.total;

    const tryK = (k, nc, regionH, mode) => {
      const S = segMetrics(uOf(k));
      if (isJami) {
        const B = buildBlocks(model, ops, k, regionW, nc, S, font);
        if (mode === 'fit') {
          const r = packFit(B.q, B.os, nc, regionW, regionH, S);
          if (!r) return null;
          const qi = r.items.find((i) => i.t === 'q');
          return { r, S, B, lh: B.q.lh, fs: B.q.fs, trunc: r.os.some((o) => o.trunc) || !!(qi && qi.b.trunc) || r.dropped > 0 };
        }
        const r = packBoxes(B.q, B.os, nc, regionW, regionH, S);
        return r.ok ? { r, S, B, lh: B.q.lh, fs: B.q.fs } : null;
      }
      const { fs, lh } = plainFonts(k);
      const colW = (regionW - (nc - 1) * S.colGap) / nc;
      const lines = plainLinesFor(model, fs, font, colW, cfg);
      if (mode === 'fit') {
        const cap = Math.floor(regionH / lh) * nc;
        if (cap < 1) return null;
        let L = lines, trunc = false;
        if (L.length > cap) { L = lines.slice(0, cap); L[cap - 1] = ellip(F(font, fs), L[cap - 1] + ' ' + (lines[cap] || ''), colW); trunc = true; }
        const r = packPlain(L, lh, nc, regionH);
        return r.ok ? { r: Object.assign(r, { dropped: 0 }), S, lines: L, lh, fs, colW, trunc } : null;
      }
      const r = packPlain(lines, lh, nc, regionH);
      return r.ok ? { r, S, lines, lh, fs, colW } : null;
    };
    const fsOf = (k) => (isJami ? jamiFonts(k).fs : plainFonts(k).fs);
    const kMinFull = (FS_MIN / (isJami ? 40 : 42));
    const kMaxFull = 2.2;

    const finish = (res, k, nc, pages, extra) => Object.assign({ pages, k, nc, S: res.S, W, H, pd, head, isJami, truncated: !!(extra && extra.truncated), dropped: (extra && extra.dropped) || 0, noteReserve: (extra && extra.noteReserve) || 0, regionW, regionH: extra && extra.regionH }, {});

    if (!fixed) {
      const nc = colCandidates()[0];
      let k = (cfg.fszK || 1) * ks, res = null;
      const frame = (kk) => { const r = tryK(kk, nc, 1e9, 'full'); const used = r ? r.r.used : 0; return { r, h: pd.padT + head.total + used + pd.padB }; };
      let f = frame(k);
      if (f.h > MAX_H) {
        let lo = kMinFull, hi = Math.max(1, k);
        if (frame(lo).h <= MAX_H) { for (let i = 0; i < 14; i++) { const mid = (lo + hi) / 2; if (frame(mid).h <= MAX_H) lo = mid; else hi = mid; } k = lo; f = frame(k); }
        else return { split: true };
      }
      res = f.r;
      const H2 = Math.ceil(f.h);
      const pg = [{ items: res.r.items.slice() }];
      return Object.assign(finish(res, k, nc, pg, { regionH: res.r.used }), { H: H2, used: res.r.used, free: true });
    }

    const regionH = regionHOf(H);
    if (regionH < 120) return { error: 'small' };

    if (!fullMode) {
      let k = fitK, best = null;
      const floorK = FS_MIN_FIT / (isJami ? 40 : 42);
      for (;;) {
        best = null;
        colCandidates().forEach((nc) => {
          const r = tryK(k, nc, regionH, 'fit');
          if (!r) return;
          const shown = isJami ? r.r.os.reduce((s, o) => s + o.lines.length, 0) : r.lines.length;
          const score = (r.trunc ? 0 : 1e4) - 1e6 * (r.r.dropped || 0) + shown - nc * 0.01;
          if (!best || score > best.score) best = { r, nc, score };
        });
        if ((best && !best.r.r.dropped) || k <= floorK * 1.001 || !cfg.fszAuto) break;
        k = Math.max(floorK, k * 0.93);
      }
      if (!best) return plan(model, ops, Object.assign({}, cfg, { content: 'full' }));
      return Object.assign(finish(best.r, k, best.nc, [{ items: best.r.r.items }], { truncated: !!best.r.trunc, dropped: best.r.r.dropped || 0, noteReserve: best.r.r.noteReserve, regionH }), { used: best.r.r.used, mode: 'fit' });
    }

    const kFix = cfg.fszK ? cfg.fszK * ks : 0;
    if (kFix) {
      const cands = colCandidates();
      for (const nc of cands) {
        const r = tryK(kFix, nc, regionH, 'full');
        if (r) return Object.assign(finish(r, kFix, nc, [{ items: r.r.items }], { regionH }), { used: r.r.used });
      }
    }
    const search = (nc) => {
      if (!tryK(kMinFull, nc, regionH, 'full')) return 0;
      if (tryK(kMaxFull, nc, regionH, 'full')) return kMaxFull;
      let lo = kMinFull, hi = kMaxFull;
      for (let i = 0; i < 16; i++) { const mid = (lo + hi) / 2; if (tryK(mid, nc, regionH, 'full')) lo = mid; else hi = mid; }
      return lo;
    };
    let bk = 0, bn = 1;
    if (!kFix) colCandidates().forEach((nc) => { const k = search(nc); if (k > 0 && (bk === 0 || k > bk * 1.08)) { bk = k; bn = nc; } });
    if (bk > 0) {
      bk = Math.max(kMinFull, bk * ks);
      const r = tryK(bk, bn, regionH, 'full');
      return Object.assign(finish(r, bk, bn, [{ items: r.r.items }], { regionH }), { used: r.r.used });
    }
    const ncSplit = colsOpt !== 'auto' ? colCandidates()[0] : ((fr !== null && fr < 0.9) ? Math.min(2, maxNc) : 1);
    const k = kFix || kMinFull;
    const S = segMetrics(uOf(k));
    try {
      let pages;
      if (isJami) {
        const B = buildBlocks(model, ops, k, regionW, ncSplit, S, font);
        pages = flowPages(B.q, B.os, ncSplit, regionH, S);
      } else {
        const { fs, lh } = plainFonts(k);
        const colW = (regionW - (ncSplit - 1) * S.colGap) / ncSplit;
        const lines = plainLinesFor(model, fs, font, colW, cfg);
        const per = Math.floor(regionH / lh), perPage = per * ncSplit;
        const n = Math.ceil(lines.length / perPage);
        if (n > MAX_PAGES) throw new Error('too-many');
        pages = [];
        for (let p = 0; p < n; p++) {
          const chunk = lines.slice(p * perPage, (p + 1) * perPage);
          const items = [];
          const bal = Math.ceil(chunk.length / ncSplit);
          for (let ci = 0; ci < ncSplit; ci++) { const part = chunk.slice(ci * bal, (ci + 1) * bal); if (part.length) items.push({ t: 'p', col: ci, y: 0, h: part.length * lh, lines: part, lh, first: true, last: true }); }
          pages.push({ items });
        }
        return Object.assign(finish({ S }, k, ncSplit, pages, { regionH }), { split: pages.length > 1, fsPlain: fs, lhPlain: lh, plainColW: colW });
      }
      return Object.assign(finish({ S }, k, ncSplit, pages, { regionH }), { split: pages.length > 1 });
    } catch (e) {
      return { split: true, tooLong: true };
    }
  }

  function validate(p, T) {
    const problems = [];
    const font = T.font, S = p.S, regionW = p.regionW;
    const rH = p.free ? Infinity : p.regionH + 0.5;
    p.pages.forEach((pg, pi) => {
      const byCol = {};
      pg.items.forEach((it, ii) => {
        const tag = `ص${pi + 1}/${it.t}${ii}`;
        const colW = it.col < 0 ? regionW : (regionW - (p.nc - 1) * S.colGap) / p.nc;
        if (it.y < -0.01) problems.push(tag + ': y سالب');
        if (it.y + it.h > rH) problems.push(tag + ': يخرج عن أسفل الإطار');
        (byCol[it.col] = byCol[it.col] || []).push(it);
        const b = it.b || it;
        const inX = it.t === 'p' ? 0 : S.inX;
        const f = it.t === 'q' ? b.font : it.t === 'o' ? b.font : (p.fsPlain ? F(font, p.fsPlain) : F(font, plainFonts(p.k).fs));
        (it.lines || b.lines || []).forEach((ln) => { const w = lineW(f, ln); if (w > colW - 2 * inX + 0.5) problems.push(`${tag}: سطر أعرض من الصندوق (${Math.round(w)} > ${Math.round(colW - 2 * inX)})`); });
        try {
          mc.font = f; const m = mc.measureText('أبجدحخ'); const need = (m.fontBoundingBoxAscent || 0) + (m.fontBoundingBoxDescent || 0);
          const lh = it.lh || b.lh;
          if (need && lh && need > lh * 1.02) problems.push(`${tag}: ارتفاع السطر (${lh}) أقل من ارتفاع الخط (${Math.round(need)})`);
        } catch (e) {}
        if (it.t === 'o') {
          const cf = F(font, Math.max(22, Math.round(30 * Math.max(0.62, Math.min(1, p.k)))), 800);
          const avail = colW - 48 - 28;
          if (lineW(cf, ellip(cf, b.name, avail)) > avail + 0.5) problems.push(tag + ': اسم المرجع أعرض من الشريحة');
        }
      });
      Object.keys(byCol).forEach((c) => {
        const arr = byCol[c].slice().sort((a, b) => a.y - b.y);
        for (let i = 1; i < arr.length; i++) if (arr[i].y < arr[i - 1].y + arr[i - 1].h - 0.01) problems.push(`ص${pi + 1}: تداخل رأسي في العمود ${c}`);
      });
      const full = pg.items.filter((i) => i.col < 0), cols = pg.items.filter((i) => i.col >= 0);
      full.forEach((f) => cols.forEach((c) => { if (c.y < f.y + f.h - 0.01 && c.y + c.h > f.y + 0.01) problems.push(`ص${pi + 1}: تداخل السؤال مع عمود`); }));
    });
    return problems;
  }

  async function headModel(model, opts) {
    const logo = await loadImg('icons/icon-192.png');
    const h = { name: '', sub: '', where: '', img: null };
    const parts = (model.src || '').split(/\s+-\s+/).map((x) => x.trim()).filter(Boolean);
    if (model.kind === 'jami') {
      const isCmp = !parts.length || /جامع\s+الاستفتاءات/.test(parts[0]);
      if (isCmp) { h.name = JAMI_NAME; h.sub = JAMI_AUTHOR; h.where = parts.slice(1).join(' › '); }
      else { h.name = parts[0]; h.where = parts.slice(1).join(' › '); }
      h.img = opts.avatar !== false ? logo : null;
    } else if (parts.length) {
      const aid = authorIdByName(parts[0]);
      h.name = parts[0];
      if (parts.length > 1) h.sub = parts.slice(1).join(' › ');
      if (aid !== null && opts.avatar !== false) h.img = await loadImg(photoOf(aid));
    }
    return { h, logo };
  }

  const PAL_NAMES = ['app'].concat(Object.keys(PALETTES));
  function colX(p, ci) { const cw = (p.regionW - (p.nc - 1) * p.S.colGap) / p.nc; return { w: cw, right: p.pd.padX + p.regionW - ci * (cw + p.S.colGap) }; }

  function drawHeader(c, T, p, h, style, pageNo, pageCnt) {
    const sp = p.head; if (!sp.total) return;
    const R = p.W - p.pd.padX, L = p.pd.padX, y0 = p.pd.padT;
    c.textBaseline = 'alphabetic'; c.direction = 'rtl';
    const fit = (font, s, maxW) => ellip(font, s, maxW);
    if (style === 'mishkat') {
      const cx = p.W / 2; let y = y0;
      if (h.img) { circleImg(c, h.img, cx, y + 50, 100, T.lineStrong, 2); y += 112; }
      c.textAlign = 'center'; c.fillStyle = T.text; c.font = F(T.font, 42, 800);
      c.fillText(fit(c.font, h.name, R - L - 160), cx, y + 42); y += 56;
      if (h.sub) { c.font = F(T.font, 28, 500); c.fillStyle = T.accentText; c.fillText(fit(c.font, h.sub, R - L - 160), cx, y + 22); y += 40; }
      if (h.where) { c.font = F(T.font, 25, 500); c.fillStyle = T.dim; c.fillText(fit(c.font, h.where, R - L - 160), cx, y + 20); y += 34; }
      const oy = y0 + sp.HH + 30;
      c.fillStyle = T.lineStrong; c.fillRect(L + 40, oy, cx - L - 70, 2); c.fillRect(cx + 30, oy, R - cx - 70, 2);
      diamond(c, cx, oy + 1, 9, T.accent);
    } else {
      let tx = R;
      if (h.img) { const d = Math.min(96, sp.HH - 4); circleImg(c, h.img, R - d / 2, y0 + sp.HH / 2, d, T.lineStrong, 2); tx = R - d - 24; }
      c.textAlign = 'right'; c.fillStyle = T.text; c.font = F(T.font, 42, 800);
      const lim = tx - L - (pageCnt > 1 ? 130 : 0);
      let y = y0 + 44 + (sp.HH - (54 + (h.sub ? 36 : 0) + (h.where ? 32 : 0))) / 2;
      c.fillText(fit(c.font, h.name, lim), tx, y); y += 4;
      if (h.sub) { c.font = F(T.font, 28, 500); c.fillStyle = (style === 'clean' || style === 'appid') ? T.accentText : T.muted; y += 34; c.fillText(fit(c.font, h.sub, lim), tx, y); }
      if (h.where) { c.font = F(T.font, 25, 500); c.fillStyle = T.dim; y += 32; c.fillText(fit(c.font, h.where, lim), tx, y); }
      c.fillStyle = T.line; c.fillRect(L, y0 + sp.HH + 22, R - L, 2);
    }
    if (pageCnt > 1) {
      const zk = false;
      c.textAlign = 'left'; c.font = F(T.font, 28, 800); c.fillStyle = zk ? T.accentInk : T.accentText;
      const t = `${ar(pageNo)} من ${ar(pageCnt)}`;
      c.fillText(t, L, y0 + 38);
      if (pageNo > 1 && !zk) { c.font = F(T.font, 22, 600); c.fillStyle = T.dim; c.fillText('تتمة ما سبق', L, y0 + 68); }
    }
  }

  const boldOf = (font) => font.replace(/^\d+/, '800');
  const scaleFont = (font, k) => font.replace(/(\d+(?:\.\d+)?)px/, (m, n) => Math.max(14, Math.round(n * k)) + 'px');
  function drawLine(c, T, ln, R, ty, lh, font, align, geo, baseColor) {
    const kind = lineKind(ln);
    let f = font, col = baseColor || T.text;
    if (kind === 'src') { f = scaleFont(font, 0.78); col = T.dim; }
    else if (kind === 'fn') { f = scaleFont(font, 0.82); col = T.muted; }
    else if (kind === 'fh') { f = boldOf(scaleFont(font, 0.8)); col = T.accentText; }
    const fst = T.fnStyle || 'bar';
    if (kind === 'fn' && geo && fst !== 'plain') {
      c.fillStyle = rgba(T.accent, fst === 'tint' ? 0.14 : 0.09); c.fillRect(geo.L, ty, geo.R - geo.L, lh);
      if (fst === 'bar') { c.fillStyle = rgba(T.accent, 0.75); c.fillRect(geo.R - 6, ty, 6, lh); }
    }
    if (kind === 'fh' && geo) {
      c.fillStyle = T.lineStrong; c.fillRect(geo.L, ty + lh - 4, geo.R - geo.L, 2);
    }
    const body = strip(ln);
    const by = baseline(c, f, ty, lh);
    const padR = kind === 'fn' && geo && (T.fnStyle || 'bar') !== 'plain' ? 16 : 0;
    c.textAlign = 'right'; c.direction = 'rtl';
    const segs = [];
    if (hasMarks(ln)) {
      const re = /\uE000([\uE100-\uE1FF])([^\uE001]*)\uE001/g;
      const raw = ln.replace(/^[\uE0F0\uE0F2\uE0F3]/, '');
      let last = 0, m;
      while ((m = re.exec(raw)) !== null) {
        if (m.index > last) segs.push({ t: raw.slice(last, m.index) });
        segs.push({ t: m[2], st: styOf(m[1]) });
        last = m.index + m[0].length;
      }
      if (last < raw.length) segs.push({ t: raw.slice(last) });
    } else segs.push({ t: body });
    const widths = segs.map((sg) => lineW(sg.st && sg.st.b ? boldOf(f) : f, sg.t));
    const total = widths.reduce((a, b) => a + b, 0);
    let x = align === 'center' ? (R + total / 2) : (R - padR);
    segs.forEach((sg, i) => {
      const w = widths[i], st = sg.st;
      let fc = col, ff = f;
      if (st) {
        if (st.b) ff = boldOf(f);
        if (st.bg) {
          const bgc = mix(T.surface, st.bg, 0.5);
          c.fillStyle = rgba(st.bg, 0.5); rr(c, x - w - 3, ty + lh * 0.1, w + 6, lh * 0.8, 7); c.fill();
          fc = ensure(col, bgc, 4.5);
        }
        if (st.c) fc = ensure(st.c, st.bg ? mix(T.surface, st.bg, 0.5) : T.surface, 3);
        if (st.u) { c.fillStyle = ensure(st.u, T.surface, 2.5); c.fillRect(x - w, by + 7, w, 3); }
      }
      c.font = ff; c.fillStyle = fc; c.fillText(sg.t, x, by);
      x -= w;
    });
  }

  function drawQ(c, T, p, it, colR, colW, y, style) {
    const b = it.b, S = p.S, h = it.h;
    const x1 = p.pd.padX + p.regionW, x0 = p.pd.padX;
    const labelSz = Math.max(22, Math.round(28 * Math.max(0.62, Math.min(1, p.k))));
    c.textAlign = 'right';
    if (style === 'card') {
      rr(c, x0, y, x1 - x0, h, 32); c.fillStyle = T.surface2; c.fill();
      c.fillStyle = T.accent; rr(c, x1 - 10, y + 22, 8, h - 44, 4); c.fill();
    } else if (style === 'clean') {
      c.fillStyle = T.accent; rr(c, x1 - 7, y + 6, 7, h - 12, 3.5); c.fill();
      c.fillStyle = T.line; c.fillRect(x0, y + h - 2, x1 - x0, 2);
    }
    const labelY = y + S.qTop + S.qLabel * 0.72;
    const tx = style === 'card' ? x1 - S.inX + 6 : style === 'clean' ? x1 - 28 : (x0 + x1) / 2;
    if (style === 'frame') {
      c.textAlign = 'center'; c.font = F(T.font, labelSz, 800); c.fillStyle = T.accentText;
      const lw = lineW(c.font, 'السؤال');
      c.fillText('السؤال', tx, labelY);
      c.fillStyle = T.lineStrong; c.fillRect(x0 + 10, labelY - labelSz * 0.3, tx - lw / 2 - 28 - x0, 2); c.fillRect(tx + lw / 2 + 18, labelY - labelSz * 0.3, x1 - 10 - (tx + lw / 2 + 18), 2);
    } else {
      c.font = F(T.font, labelSz, 800); c.fillStyle = T.accentText; c.fillText('السؤال', tx, labelY);
    }
    c.font = b.font; c.fillStyle = T.text; c.textAlign = style === 'frame' ? 'center' : 'right';
    const ty = y + S.qTop + S.qLabel;
    b.lines.forEach((ln, i) => drawLine(c, T, ln, tx, ty + i * b.lh, b.lh, b.font, style === 'frame' ? 'center' : 'right', null));
    if (style === 'frame') { diamond(c, (x0 + x1) / 2, y + h - 6, 7, T.accent); }
  }
  function baseline(c, font, top, lh) {
    c.font = font;
    const m = c.measureText('أبجدحخ');
    const a = m.fontBoundingBoxAscent, d = m.fontBoundingBoxDescent;
    if (a != null && d != null) return top + (lh - (a + d)) / 2 + a;
    const sz = parseFloat(font.match(/([\d.]+)px/)[1]);
    return top + lh / 2 + sz * 0.3;
  }

  function drawO(c, T, p, it, colR, colW, y, style) {
    const b = it.b, S = p.S, h = it.h;
    const u = Math.max(0.62, Math.min(1, p.k));
    const chipSz = Math.max(22, Math.round(30 * u));
    const left = colR - colW;
    const inX = S.inX;
    const headH = it.first ? S.oTop + S.oChip + S.oGap : S.oTop + S.oCont;
    c.textAlign = 'right';
    const nameFont = F(T.font, it.first ? chipSz : Math.max(20, Math.round(26 * u)), 800);
    const label = it.first ? b.name : b.name + ' — تابع';
    const av = (it.first && b.img) ? Math.round(S.oChip) : 0;
    if (style === 'card') {
      rr(c, left, y, colW, h, 32); c.strokeStyle = T.lineStrong; c.lineWidth = 2; c.stroke();
      c.font = nameFont;
      const maxNw = colW - 48;
      const txt = ellip(nameFont, label, maxNw - 28 - (av ? av - 14 : 0));
      const nw = Math.min(lineW(nameFont, txt) + 52 + (av ? av - 14 : 0), maxNw);
      const chipH = it.first ? S.oChip : S.oCont - 6, cy = y + S.oTop;
      rr(c, colR - 24 - nw, cy, nw, chipH, chipH / 2); c.fillStyle = it.first ? T.chip : T.surface2; c.fill();
      if (av) circleImg(c, b.img, colR - 24 - av / 2, cy + chipH / 2, av, rgba(T.accentInk, 0.5), 2);
      c.fillStyle = it.first ? T.accentInk : T.accentText; c.textAlign = 'center';
      c.fillText(txt, colR - 24 - (nw - (av ? av - 14 : 0)) / 2 - (av ? av - 14 : 0), baseline(c, nameFont, cy, chipH));
    } else if (style === 'clean') {
      c.fillStyle = rgba(T.accent, 0.9); rr(c, colR - 6, y + 4, 6, h - 8, 3); c.fill();
      if (it.last) { c.fillStyle = T.line; c.fillRect(left, y + h - 2, colW, 2); }
      const cy = y + S.oTop, chipH = it.first ? S.oChip : S.oCont - 6;
      let tx = colR - 24;
      if (av) { circleImg(c, b.img, tx - av / 2, cy + chipH / 2, av, T.lineStrong, 2); tx -= av + 14; }
      const txt = ellip(nameFont, label, tx - left - 6);
      c.font = nameFont; c.fillStyle = T.accentText; c.textAlign = 'right';
      c.fillText(txt, tx, baseline(c, nameFont, cy, chipH));
    } else {
      const cy = y + S.oTop, chipH = it.first ? S.oChip : S.oCont - 6, cx = (left + colR) / 2;
      const txt = ellip(nameFont, label, colW - 2 * inX - (av ? av + 14 : 0));
      const tw = lineW(nameFont, txt) + (av ? av + 14 : 0);
      c.font = nameFont; c.fillStyle = T.accentText; c.textAlign = 'right';
      const startR = cx + tw / 2;
      if (av) { circleImg(c, b.img, startR - av / 2, cy + chipH / 2, av, T.lineStrong, 2); }
      c.fillText(txt, startR - (av ? av + 14 : 0), baseline(c, nameFont, cy, chipH));
      c.fillStyle = T.lineStrong;
      const ly = cy + chipH / 2 - 1;
      if (cx - tw / 2 - 20 - (left + 8) > 10) c.fillRect(left + 8, ly, cx - tw / 2 - 20 - (left + 8), 2);
      if (colR - 8 - (cx + tw / 2 + 20) > 10) c.fillRect(cx + tw / 2 + 20, ly, colR - 8 - (cx + tw / 2 + 20), 2);
      if (it.last) diamond(c, cx, y + h - 8, 6, T.accent);
    }
    c.font = b.font; c.fillStyle = T.text; c.textAlign = 'right';
    const ty = y + headH;
    b.lines.forEach((ln, i) => drawLine(c, T, ln, colR - inX, ty + i * b.lh, b.lh, b.font, 'right', { L: left + inX - 10, R: colR - inX + 10 }));
  }

  function archPath(c, x0, x1, top, yb, bot, r) {
    const cx = (x0 + x1) / 2, w = x1 - x0;
    c.beginPath();
    c.moveTo(x0, yb);
    c.bezierCurveTo(x0, yb - (yb - top) * 0.62, cx - w * 0.22, top + (yb - top) * 0.34, cx, top);
    c.bezierCurveTo(cx + w * 0.22, top + (yb - top) * 0.34, x1, yb - (yb - top) * 0.62, x1, yb);
    c.lineTo(x1, bot - r); c.quadraticCurveTo(x1, bot, x1 - r, bot);
    c.lineTo(x0 + r, bot); c.quadraticCurveTo(x0, bot, x0, bot - r);
    c.closePath();
  }
  function corner(c, x, y, sx, sy, col, col2) {
    c.save(); c.translate(x, y); c.scale(sx, sy);
    c.strokeStyle = col; c.lineWidth = 3;
    [34, 22].forEach((r) => { c.beginPath(); c.arc(0, 0, r, 0, Math.PI / 2); c.stroke(); });
    c.fillStyle = col2; [[46, 0], [0, 46], [33, 33]].forEach(([dx, dy]) => { c.beginPath(); c.arc(dx, dy, 6, 0, Math.PI * 2); c.fill(); });
    c.restore();
  }
  function drawBg(c, T, p, style, opts) {
    const W = p.W, H = p.H, cx = W / 2;
    if (style === 'clean') {
      c.fillStyle = T.surface; c.fillRect(0, 0, W, H);
      c.fillStyle = T.accent; c.fillRect(0, 0, W, 14);
      if (opts.color) { c.fillStyle = opts.color; c.fillRect(W - 22, 0, 22, H); }
    } else if (style === 'appid') {
      c.fillStyle = T.surface; c.fillRect(0, 0, W, H);
      if (opts.color) { c.fillStyle = opts.color; c.fillRect(W - 22, 0, 22, H); }
    } else if (style === 'card') {
      const pd = p.pd;
      c.fillStyle = T.bg; c.fillRect(0, 0, W, H);
      let g = c.createRadialGradient(W * 0.9, 0, 0, W * 0.9, 0, W * 1.0);
      g.addColorStop(0, `rgba(${T.accentRgb},.22)`); g.addColorStop(1, `rgba(${T.accentRgb},0)`); c.fillStyle = g; c.fillRect(0, 0, W, H);
      g = c.createRadialGradient(W * 0.05, H, 0, W * 0.05, H, W * 0.8);
      g.addColorStop(0, `rgba(${T.accentRgb},.12)`); g.addColorStop(1, `rgba(${T.accentRgb},0)`); c.fillStyle = g; c.fillRect(0, 0, W, H);
      const cx = pd.M, cy = pd.M, cw = W - 2 * pd.M, ch = H - pd.M - pd.FOOT;
      c.save(); c.shadowColor = `rgba(${T.shadow},.28)`; c.shadowBlur = 50; c.shadowOffsetY = 18;
      rr(c, cx, cy, cw, ch, 52); c.fillStyle = T.surface; c.fill(); c.restore();
      rr(c, cx, cy, cw, ch, 52); c.strokeStyle = T.line; c.lineWidth = 2; c.stroke();
      c.save(); rr(c, cx, cy, cw, ch, 52); c.clip();
      c.fillStyle = T.accent; c.fillRect(cx, cy, cw, 12);
      if (opts.color) { c.globalAlpha = 0.07; c.fillStyle = opts.color; c.fillRect(cx, cy, cw, ch); c.globalAlpha = 1; c.fillStyle = opts.color; c.fillRect(cx + cw - 22, cy, 22, ch); }
      c.restore();
    } else if (style === 'mishkat') {
      c.fillStyle = T.surface2; c.fillRect(0, 0, W, H);
      const g = c.createRadialGradient(cx, 40, 0, cx, 40, W * 0.9); g.addColorStop(0, `rgba(${T.accentRgb},.20)`); g.addColorStop(1, `rgba(${T.accentRgb},0)`);
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      const m = 40, top = m + 18, yb = m + ARCH + 70, bot = H - m;
      archPath(c, m, W - m, top, yb, bot, 30); c.fillStyle = T.surface; c.fill();
      if (opts.color) { c.save(); archPath(c, m, W - m, top, yb, bot, 30); c.clip(); c.fillStyle = rgba(opts.color, 0.08); c.fillRect(0, 0, W, H); c.fillStyle = opts.color; c.fillRect(W - m - 20, 0, 20, H); c.restore(); }
      c.lineJoin = 'round';
      archPath(c, m, W - m, top, yb, bot, 30); c.strokeStyle = T.accent; c.lineWidth = 5; c.stroke();
      archPath(c, m + 16, W - m - 16, top + 22, yb + 6, bot - 16, 22); c.strokeStyle = T.lineStrong; c.lineWidth = 1.8; c.stroke();
      c.fillStyle = T.accent; c.beginPath(); c.arc(cx, top - 6, 11, 0, Math.PI * 2); c.fill();
      c.fillStyle = T.surface; c.beginPath(); c.arc(cx, top - 6, 4.5, 0, Math.PI * 2); c.fill();
      diamond(c, cx, top + 44, 9, T.accent);
      c.fillStyle = rgba(T.accent, 0.35); [-1, 1].forEach((d) => { c.beginPath(); c.arc(cx + d * 36, top + 44, 3.5, 0, Math.PI * 2); c.fill(); });
    }
  }
  function chevron(c, x, y, r, col, bg, dir) {
    c.fillStyle = bg; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    c.strokeStyle = col; c.lineWidth = 2.5; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke();
    c.lineCap = 'round'; c.beginPath(); c.moveTo(x - dir * 4, y - 8); c.lineTo(x + dir * 5, y); c.lineTo(x - dir * 4, y + 8); c.stroke(); c.lineCap = 'butt';
  }
  function drawDividers(c, T, p, pg, regionTop, off, plain) {
    if (p.nc < 2) return;
    const col = pg.items.filter((i) => i.t !== 'q');
    if (!col.length) return;
    const top = regionTop + off + col.reduce((m, i) => Math.min(m, i.y), 1e9);
    const bot = regionTop + off + col.reduce((m, i) => Math.max(m, i.y + i.h), 0);
    const cw = (p.regionW - (p.nc - 1) * p.S.colGap) / p.nc;
    for (let k = 0; k < p.nc - 1; k++) {
      const x = p.pd.padX + p.regionW - (k + 1) * cw - k * p.S.colGap - p.S.colGap / 2;
      const g = c.createLinearGradient(0, top, 0, bot);
      g.addColorStop(0, rgba(T.accent, 0)); g.addColorStop(0.12, rgba(T.accent, 0.55)); g.addColorStop(0.88, rgba(T.accent, 0.55)); g.addColorStop(1, rgba(T.accent, 0));
      c.fillStyle = g; c.fillRect(x - 1.5, top, 3, Math.max(0, bot - top));
      const my = (top + bot) / 2;
      c.fillStyle = T.surface; c.fillRect(x - 12, my - 12, 24, 24);
      diamond(c, x, my, 9, T.accent);
    }
  }
  function drawAppBar(c, T, p, logo) {
    const W = p.W, pad = p.pd.padX, d = 72, cy = APPBAR / 2;
    c.fillStyle = T.accent; c.fillRect(0, 0, W, APPBAR);
    c.fillStyle = rgba(T.accentInk, 0.16); c.fillRect(0, APPBAR - 4, W, 4);
    let x = W - pad;
    if (logo) { c.save(); rr(c, x - d, cy - d / 2, d, d, 18); c.clip(); c.drawImage(logo, x - d, cy - d / 2, d, d); c.restore(); x -= d + 20; }
    c.direction = 'rtl'; c.textAlign = 'right'; c.fillStyle = T.accentInk; c.font = F(T.font, 44, 800);
    c.fillText(APP_NAME, x, baseline(c, c.font, cy - 28, 56));
    c.direction = 'ltr'; c.textAlign = 'left'; c.font = F("'Segoe UI', Arial, sans-serif", 24, 600); c.fillStyle = rgba(T.accentInk, 0.85);
    c.fillText(SITE_LINK, pad, cy + 8);
    c.direction = 'rtl';
  }
  function drawFooter(c, T, p, style, logo) {
    if (style === 'appid') {
      const W = p.W, H = p.H, fb = H - p.pd.footY;
      c.fillStyle = T.line; c.fillRect(p.pd.padX, fb - 46, W - 2 * p.pd.padX, 2);
      c.direction = 'ltr'; c.textAlign = 'center'; c.font = F("'Segoe UI', Arial, sans-serif", 24, 600); c.fillStyle = T.dim;
      c.fillText(SITE_LINK, W / 2, fb); c.direction = 'rtl';
      return;
    }
    const W = p.W, H = p.H, fb = H - p.pd.footY;
    const cx = W / 2, nameSz = 32, icon = 50, gap = 14;
    c.direction = 'ltr'; c.textAlign = 'center'; c.font = F("'Segoe UI', Arial, sans-serif", 26, 600); c.fillStyle = T.dim;
    c.fillText(SITE_LINK, cx, fb);
    c.direction = 'rtl';
    const ny = fb - 42;
    c.font = F(T.font, nameSz, 800);
    const nameW = lineW(c.font, APP_NAME), total = nameW + (logo ? icon + gap : 0), startX = cx + total / 2;
    if (logo) { c.save(); rr(c, startX - icon, ny - 38, icon, icon, 14); c.clip(); c.drawImage(logo, startX - icon, ny - 38, icon, icon); c.restore(); }
    c.fillStyle = T.muted; c.textAlign = 'right'; c.fillText(APP_NAME, startX - (logo ? icon + gap : 0), ny);
    c.fillStyle = T.line; const lw = Math.max(0, (W - total) / 2 - p.pd.padX - 30);
    if (lw > 20) { c.fillRect(p.pd.padX, ny - 12, lw, 2); c.fillRect(W - p.pd.padX - lw, ny - 12, lw, 2); }
  }
  function drawCut(c, T, p, pageNo, pageCnt) {
    if (pageNo >= pageCnt) return;
    const W = p.W, y = p.H - p.pd.cutB - p.pd.cut / 2;
    const t = 'يتبع في الصورة التالية', f = F(T.font, 26, 800);
    c.font = f; const tw = lineW(f, t) + 90, h = 40;
    c.fillStyle = rgba(T.accent, 0.14); rr(c, W / 2 - tw / 2, y - h / 2, tw, h, h / 2); c.fill();
    c.strokeStyle = rgba(T.accent, 0.6); c.lineWidth = 2; rr(c, W / 2 - tw / 2, y - h / 2, tw, h, h / 2); c.stroke();
    c.textAlign = 'center'; c.fillStyle = T.accentText; c.fillText(t, W / 2 + 14, baseline(c, f, y - h / 2, h));
    c.strokeStyle = T.accentText; c.lineWidth = 3; c.lineCap = 'round';
    const ax = W / 2 - tw / 2 + 26; c.beginPath(); c.moveTo(ax + 8, y - 8); c.lineTo(ax, y); c.lineTo(ax + 8, y + 8); c.stroke(); c.lineCap = 'butt';
  }

  function drawPage(model, T, p, h, logo, opts, pageNo, pageCnt, scale) {
    const style = p.style || opts.style || DEF_STYLE, bs = baseOf(style);
    const W = p.W, H = p.H;
    const cv = document.createElement('canvas');
    cv.width = Math.round(W * scale); cv.height = Math.round(H * scale);
    const c = cv.getContext('2d'); try { c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; } catch (e) {} c.scale(scale, scale); c.direction = 'rtl'; c.textBaseline = 'alphabetic';
    const pd = p.pd;
    drawBg(c, T, p, style, opts);
    if (style === 'appid') drawAppBar(c, T, p, logo);
    drawHeader(c, T, p, h, style, pageNo, pageCnt);
    const regionTop = pd.padT + p.head.total;
    const regionH = p.free ? p.used : p.regionH;
    const pg = p.pages[pageNo - 1];
    const usedH = pg.items.reduce((m, i) => Math.max(m, i.y + i.h), 0);
    const off = (p.free || p.pages.length > 1) ? 0 : Math.max(0, (regionH - usedH) / 2);
    const plainPg = pg.items.some((i) => i.t === 'p');
    drawDividers(c, T, p, pg, regionTop, off, plainPg);
    pg.items.forEach((it) => {
      const y = regionTop + off + it.y;
      if (it.t === 'q') { drawQ(c, T, p, it, 0, p.regionW, y, bs); return; }
      const cx = colX(p, it.col);
      if (it.t === 'o') { drawO(c, T, p, it, cx.right, cx.w, y, bs); return; }
      const fs = p.fsPlain || plainFonts(p.k).fs, font = F(T.font, fs);
      c.font = font; c.fillStyle = T.text; c.textAlign = 'right';
      it.lines.forEach((ln, i) => drawLine(c, T, ln, cx.right, y + i * it.lh, it.lh, font, 'right', { L: cx.right - cx.w, R: cx.right }));
    });
    if (p.dropped > 0 && pageNo === 1) {
      const ny = regionTop + off + usedH + p.S.gap;
      const lhO = p.pages[0].items.find((i) => i.t === 'o');
      const fsn = lhO ? lhO.b.fs : 28;
      c.font = F(T.font, Math.max(22, Math.round(fsn * 0.8)), 600); c.fillStyle = T.dim; c.textAlign = 'center';
      c.fillText(`… و${ar(p.dropped)} ${p.dropped === 1 ? 'مرجع آخر' : 'مراجع أخرى'} في التطبيق`, W / 2, baseline(c, c.font, ny, p.noteReserve - p.S.gap));
    }
    drawCut(c, T, p, pageNo, pageCnt);
    drawFooter(c, T, p, style, logo);
    return cv;
  }

  async function renderPages(model, sel, opts) {
    opts = opts || {};
    const style = STYLES[opts.style] ? opts.style : DEF_STYLE;
    const T = theme(PAL_NAMES.indexOf(opts.pal) >= 0 ? opts.pal : 'app');
    T.fnStyle = ['bar', 'tint', 'plain'].indexOf(opts.fnStyle) >= 0 ? opts.fnStyle : 'bar';
    try { await Promise.all([document.fonts.load("40px 'Amiri'"), document.fonts.load("40px 'Scheherazade New'"), document.fonts.ready]); } catch (e) {}
    const { h, logo } = await headModel(model, opts);
    const ops = model.kind === 'jami' ? (sel ? model.opinions.filter((o) => sel.indexOf(o.name) >= 0) : model.opinions).map((o) => ({ name: o.name, text: o.text, srcText: o.srcText, img: null })) : [];
    for (const o of ops) o.img = opts.avatar !== false ? await loadImg(photoOf(authorIdByName(o.name))) : null;

    let fr = null, FW = 0, FH = 0;
    if (opts.fw && opts.fh) { FW = Math.max(200, Math.min(4000, opts.fw)); FH = Math.max(200, Math.min(6000, opts.fh)); fr = FH / FW; }
    else if (opts.ratio) fr = opts.ratio;
    let fixed = fr !== null;
    const brand = true;
    const FSZ = { xl: 1.3, l: 1.0, m: 0.8, s: 0.62 };
    const fszAuto = !FSZ[opts.fsz];
    const fszK = FSZ[opts.fsz] || 0;
    const fitK = fszK || 1.0;
    const mkCfg = (fx, ratio) => {
      const Wf = fx ? (ratio >= 1 ? BASE_W : Math.round(BASE_W / ratio)) : BASE_W;
      const Hf = fx ? (ratio >= 1 ? Math.round(BASE_W * ratio) : BASE_W) : 0;
      return { T, style, fixed: fx, fr: fx ? ratio : null, W: Wf, H: Hf, content: opts.content || 'full', fitK, fszK, fszAuto, colsOpt: String(opts.cols || 'auto'), brand, head: headSpec(style, h), fn: { mode: opts.fn || 'none', hide: opts.fnHide || [] } };
    };
    let cfg = mkCfg(fixed, fr);
    let notes = [];
    let p = null;
    if (!fixed && cfg.colsOpt === 'auto') {
      let best = null;
      for (let nc = 1; nc <= 3; nc++) {
        if (model.kind === 'jami' && nc > Math.max(ops.length, 1)) break;
        const c2 = Object.assign(mkCfg(false, null), { W: BASE_W + (nc - 1) * 540, colsOpt: String(nc) });
        const pp = plan(model, ops, c2);
        if (!pp.pages) continue;
        const r = pp.H / pp.W;
        if (!best || r < best.r - 0.05) best = { r, cfg: c2, p: pp, nc };
        if (r <= 1.35) { best = { r, cfg: c2, p: pp, nc }; break; }
      }
      if (best && best.r <= 1.8) { cfg = best.cfg; p = best.p; notes.push('free-nc' + best.nc); }
      else if (best) { notes.push('free-too-tall'); p = { split: true }; }
    }
    if (!p) p = plan(model, ops, cfg);
    if (p.split && !p.pages) {
      fixed = true; fr = 1.25; cfg = Object.assign(mkCfg(true, fr), { fszK: fszK || 0.95 }); p = plan(model, ops, cfg); notes.push('forced-split');
    }
    if (p.error || (p.tooLong && !p.pages)) {
      fixed = false; cfg = mkCfg(false, null); p = plan(model, ops, cfg); notes.push('forced-free');
      if (!p.pages) throw new Error('layout-failed');
    }
    p.style = style;
    let problems = validate(p, T);
    let guard = 0;
    while (problems.length && guard < 4) {
      guard++;
      cfg.kScale = (cfg.kScale || 1) * 0.93;
      p = plan(model, ops, cfg); p.style = style; if (!p.pages) break; problems = validate(p, T);
    }
    const W = p.W, H = p.H;
    let scale = 1;
    if (opts.px) scale = Math.min(0.6, opts.px / W);
    else if (fixed && FW) scale = FW / W;
    else scale = 2.6;
    if (W * H * scale * scale > MAX_PIXELS) scale = Math.sqrt(MAX_PIXELS / (W * H));
    const n = p.pages.length;
    const canvases = [];
    for (let i = 0; i < n; i++) canvases.push(drawPage(model, T, p, h, logo, Object.assign({}, opts, { style, brand }), i + 1, n, scale));
    return { canvases, canvas: canvases[0], pages: n, truncated: !!p.truncated, dropped: p.dropped || 0, problems, notes, plan: p, W, H, k: p.k, nc: p.nc };
  }
  RSShare.renderPages = renderPages;
  RSShare.render = async function (model, sel, opts) { const r = await renderPages(model, sel, opts); return { canvas: r.canvas, truncated: r.truncated, problems: r.problems }; };
  RSShare.parse = parse; RSShare._rich = richFromHint;
  RSShare._validate = validate;

  function overlay() {
    let o = $('rsShareOv');
    if (!o) {
      o = document.createElement('div'); o.id = 'rsShareOv'; o.className = 'rs-ov';
      o.addEventListener('click', (e) => { if (e.target === o && Date.now() > (o._g || 0)) closeStudio(); });
      document.body.appendChild(o);
    }
    return o;
  }
  let studioClose = null;
  function closeStudio() { const o = $('rsShareOv'); if (o) { o.classList.remove('show'); o._tok = (o._tok || 0) + 1; } if (studioClose) { const f = studioClose; studioClose = null; f(); } }
  const OKEY = 'rs_share_opts', OVER = 92;
  const SIZES = [['free', 'حرّة', 'تتبع طول النص', null], ['sq', 'مربعة', '١ : ١', 1], ['rect', 'مستطيلة', '٤ : ٥', 1.25], ['wide', 'أفقية', '١٦ : ٩', 9 / 16], ['story', 'طولية', '٩ : ١٦', 16 / 9], ['custom', 'مقاس محدد', 'بالبكسل', 0]];
  const FSZ_LIST = [['auto', 'تلقائي', 'الأكبر المناسب'], ['xl', 'كبير جداً'], ['l', 'كبير'], ['m', 'متوسط'], ['s', 'صغير']];
  const DEF = { v: OVER, size: 'free', avatar: true, brand: true, w: 1080, h: 1350, content: 'full', fsz: 'auto', style: DEF_STYLE, pal: 'app', cols: 'auto', fn: 'end', fnStyle: 'bar' };
  function loadOpts() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(OKEY) || '{}') || {}; } catch (e) {}
    if (!saved.v || saved.v < OVER) { delete saved.content; delete saved.fit; }
    const op = Object.assign({}, DEF, saved, { v: OVER });
    if (!FSZ_LIST.some((x) => x[0] === op.fsz)) op.fsz = 'auto';
    if (!STYLES[op.style]) op.style = DEF_STYLE;
    if (PAL_NAMES.indexOf(op.pal) < 0) op.pal = 'app';
    op.brand = true;
    if (['none', 'inline', 'end'].indexOf(op.fn) < 0) op.fn = 'end';
    if (['bar', 'tint', 'plain'].indexOf(op.fnStyle) < 0) op.fnStyle = 'bar';
    return op;
  }
  function roOf(op, meta, hideList) {
    const z = SIZES.find((q) => q[0] === op.size);
    const fixed = op.size !== 'free';
    const ro = { avatar: op.avatar, brand: op.brand, content: fixed ? op.content : 'full', fsz: op.fsz, style: op.style, pal: op.pal, cols: op.cols, fn: op.fn, fnStyle: op.fnStyle, fnHide: hideList, color: meta && meta.color ? meta.color : null };
    if (op.size === 'custom') { ro.fw = op.w; ro.fh = op.h; } else if (z && z[3]) ro.ratio = z[3];
    return ro;
  }
  const seg = (name, items) => `<div class="shr-seg" data-seg="${name}">${items.map((x) => `<button type="button" data-v="${x[0]}"><b>${x[1]}</b>${x[2] ? `<small>${x[2]}</small>` : ''}</button>`).join('')}</div>`;
  const palDotStyle = (k) => { const P = k === 'app' ? null : PALETTES[k]; return P ? `background:${P.surface};border-color:${P.accent || '#C0502A'};box-shadow:inset 0 -9px 0 ${P.bg}` : 'background:conic-gradient(var(--accent),var(--surface),var(--accent))'; };
  const styleMini = (k) => `<span class="shr-st shr-st-${k}"><i></i><i></i><i></i></span>`;
  const fileName = (i, n) => (n > 1 ? `mishkat-alfiqh-${i + 1}.png` : 'mishkat-alfiqh.png');
  const toBlob = (cv) => new Promise((res) => cv.toBlob(res, 'image/png'));
  let canShareFiles = null;
  function detectShare() {
    if (canShareFiles !== null) return canShareFiles;
    try { canShareFiles = !!(navigator.share && navigator.canShare && navigator.canShare({ files: [new File([new Blob(['x'])], 'a.png', { type: 'image/png' })] })); } catch (e) { canShareFiles = false; }
    return canShareFiles;
  }

  function openViewer(srcs, start, getFull) {
    const v = document.createElement('div'); v.className = 'shr-vw';
    v.innerHTML = `<div class="shr-vw-top"><button type="button" class="shr-vw-x" aria-label="إغلاق"><i class="ti ti-x"></i></button><span class="shr-vw-n"></span><span class="shr-vw-hint">اضغط مرتين أو اقرص للتكبير</span></div>
      <div class="shr-vw-st"><img alt="" draggable="false"></div>
      ${srcs.length > 1 ? '<button type="button" class="shr-vw-nav shr-vw-prev" aria-label="السابقة"><i class="ti ti-chevron-right"></i></button><button type="button" class="shr-vw-nav shr-vw-next" aria-label="التالية"><i class="ti ti-chevron-left"></i></button>' : ''}`;
    document.body.appendChild(v);
    const st = v.querySelector('.shr-vw-st'), im = st.querySelector('img'), nEl = v.querySelector('.shr-vw-n');
    const urls = []; let list = srcs.slice(), idx = Math.max(0, start | 0);
    let S = 1, X = 0, Y = 0;
    const dims = () => { const cw = st.clientWidth, ch = st.clientHeight, nw = im.naturalWidth || 1, nh = im.naturalHeight || 1; const fit = Math.min(cw / nw, ch / nh) ; return { cw, ch, w: nw * fit, h: nh * fit }; };
    const clampPos = () => {
      const d = dims(), w = d.w * S, h = d.h * S;
      const bx = Math.max(0, (w - d.cw) / 2), by = Math.max(0, (h - d.ch) / 2);
      X = Math.min(bx, Math.max(-bx, X)); Y = Math.min(by, Math.max(-by, Y));
    };
    const apply = () => { clampPos(); im.style.transform = `translate(${X}px,${Y}px) scale(${S})`; };
    const show = (i) => { idx = (i + list.length) % list.length; S = 1; X = Y = 0; im.src = list[idx]; nEl.textContent = list.length > 1 ? `${ar(idx + 1)} / ${ar(list.length)}` : ''; im.onload = apply; apply(); };
    const close = () => { v.remove(); urls.forEach((u) => URL.revokeObjectURL(u)); };
    v.querySelector('.shr-vw-x').onclick = close;
    const pv = v.querySelector('.shr-vw-prev'), nx = v.querySelector('.shr-vw-next');
    if (pv) { pv.onclick = () => show(idx - 1); nx.onclick = () => show(idx + 1); }
    let t0 = null, lastTap = 0, swipe = null;
    const dist = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    st.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) { t0 = { d: dist(e.touches[0], e.touches[1]), S, X, Y, mx: (e.touches[0].clientX + e.touches[1].clientX) / 2, my: (e.touches[0].clientY + e.touches[1].clientY) / 2 }; swipe = null; }
      else if (e.touches.length === 1) {
        const t = e.touches[0], now = Date.now();
        if (now - lastTap < 300) { S = S > 1.05 ? 1 : 2.6; if (S === 1) X = Y = 0; else { const r = st.getBoundingClientRect(); X = -(t.clientX - r.left - r.width / 2) * (S - 1); Y = -(t.clientY - r.top - r.height / 2) * (S - 1); } apply(); lastTap = 0; return; }
        lastTap = now; swipe = { x: t.clientX, y: t.clientY, X, Y, moved: false };
      }
    }, { passive: true });
    st.addEventListener('touchmove', (e) => {
      if (e.cancelable) e.preventDefault();
      if (e.touches.length === 2 && t0) {
        const d = dist(e.touches[0], e.touches[1]);
        const ns = Math.min(8, Math.max(1, t0.S * d / t0.d)), k = ns / t0.S, r = st.getBoundingClientRect();
        const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left - r.width / 2, my = (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top - r.height / 2;
        S = ns; X = mx - (t0.mx - r.left - r.width / 2 - t0.X) * k; Y = my - (t0.my - r.top - r.height / 2 - t0.Y) * k; apply();
      } else if (e.touches.length === 1 && swipe) {
        const t = e.touches[0], dx = t.clientX - swipe.x, dy = t.clientY - swipe.y;
        if (Math.abs(dx) + Math.abs(dy) > 8) { swipe.moved = true; lastTap = 0; }
        if (S > 1.02) { X = swipe.X + dx; Y = swipe.Y + dy; apply(); }
        else { X = 0; Y = swipe.Y + dy; swipe.dx = dx; apply(); }
      }
    }, { passive: false });
    st.addEventListener('touchend', (e) => {
      if (e.touches.length < 2) t0 = null;
      if (swipe && e.touches.length === 0) {
        if (S <= 1.02 && swipe.moved && list.length > 1 && Math.abs(swipe.dx || 0) > 70 && Math.abs(swipe.dx) > Math.abs(Y - swipe.Y) * 1.5) show(idx + (swipe.dx < 0 ? 1 : -1));
        swipe = null;
      }
    }, { passive: true });
    st.addEventListener('wheel', (e) => { e.preventDefault(); S = Math.min(8, Math.max(1, S * (e.deltaY < 0 ? 1.15 : 0.87))); apply(); }, { passive: false });
    st.addEventListener('dblclick', () => { S = S > 1.05 ? 1 : 2.6; if (S === 1) X = Y = 0; apply(); });
    show(idx);
    Promise.resolve(getFull && getFull()).then((bl) => {
      if (!bl || !v.isConnected) return;
      list = bl.map((b) => { const u = URL.createObjectURL(b); urls.push(u); return u; });
      const keep = { S, X, Y }; im.src = list[idx]; S = keep.S; X = keep.X; Y = keep.Y; apply();
    }).catch(() => {});
  }

  function studio(text) {
    const model = parse(text), o = overlay(), op = loadOpts();
    const hint = RSShare.hint; RSShare.hint = null;
    if (model.kind === 'plain' && hint && Date.now() - (hint.t || 0) < 15000) { const rr0 = richFromHint(hint, model.body); if (rr0 && rr0.marked) model.rich = rr0; }
    const hide = [], fns = model.rich ? model.rich.fns.filter((f, i, a) => f.text && a.findIndex((x) => x.key === f.key) === i) : (model.fnPlain || []);
    o._tok = (o._tok || 0) + 1;
    const myTok = o._tok;
    const meta = RSShare.lastMeta || {};
    const isJami = model.kind === 'jami';
    const multi = isJami && model.opinions.length > 1;
    let pvTok = 0, pvTimer = 0, fullTimer = 0, full = null, fullKey = '', fullBusy = null, last = null;

    o.innerHTML = `<div class="rs-pop shr-opt shr-studio" role="dialog" aria-label="مشاركة كصورة">
      <div class="shr-pvwrap">
        <div class="shr-top"><h3><i class="ti ti-photo"></i> مشاركة كصورة</h3><button type="button" class="shr-x" data-x="1" aria-label="إغلاق"><i class="ti ti-x"></i></button></div>
        <div class="shr-pv" id="shrPv"><div class="shr-pv-in"></div><div class="shr-pv-meta"></div></div>
        <div class="shr-warn" id="shrWarn" hidden></div>
      </div>
      <div class="shr-body">
        ${multi ? `<div class="shr-sec">المراجع في الصورة</div><div class="shr-list">${model.opinions.map((x, i) => `<label class="shr-row"><input type="checkbox" data-i="${i}" checked><span class="shr-ck"><i class="ti ti-check"></i></span><span class="shr-nm">${esc(x.name)}</span></label>`).join('')}</div>` : ''}
        <div class="shr-sec">الأبعاد</div>
        <div class="shr-sizes">${SIZES.map((z) => `<button type="button" data-z="${z[0]}"><span class="shr-shape shr-${z[0]}"></span><b>${z[1]}</b><small>${z[2]}</small></button>`).join('')}</div>
        <div class="shr-custom" id="shrCustom"><input type="number" inputmode="numeric" id="shrW" min="300" max="4000"><span>×</span><input type="number" inputmode="numeric" id="shrH" min="300" max="6000"><small>بكسل (عرض × ارتفاع)</small></div>
        <div class="shr-sec">حجم الخط</div>
        ${seg('fsz', FSZ_LIST)}
        <div id="shrCutRow">
          <div class="shr-sec">إن لم يتّسع النص في هذه الأبعاد</div>
          ${seg('content', [['full', 'قسّمه على عدة صور', 'لا يُحذف شيء'], ['fit', 'اقتطع منه', 'يُقتطع بعلامة «…»']])}
        </div>
        <div class="shr-hint" id="shrHint"></div>
        <div class="shr-sec">التنسيق</div>
        <div class="shr-styles">${Object.keys(STYLES).map((k) => `<button type="button" data-style="${k}">${styleMini(k)}<b>${STYLES[k]}</b></button>`).join('')}</div>
        ${fns.length ? `<div class="shr-sec">الهوامش</div>${seg('fn', model.rich ? [['none', 'بلا هوامش'], ['inline', 'تحت موضعها', 'بعد الجملة'], ['end', 'بعد المسألة', 'في الأسفل']] : [['none', 'بلا هوامش'], ['end', 'بعد المسألة', 'في الأسفل']])}
        <div id="shrFnStyle" class="shr-fnrow"><span class="shr-fnlbl">الشكل</span>${seg('fnStyle', [['bar', 'شريط جانبي'], ['tint', 'خلفية'], ['plain', 'نص صغير']])}</div>
        <div id="shrFnList" class="shr-fnbox"><div class="shr-fnhead"><span>اختر الهوامش (${ar(fns.length)})</span><button type="button" data-fkall="1">إلغاء التحديد</button></div>
        <div class="shr-list shr-fnlist">${fns.map((f, i) => `<label class="shr-row shr-row-sm"><input type="checkbox" data-fk="${esc(f.key)}" checked><span class="shr-ck"><i class="ti ti-check"></i></span><span class="shr-nm"><b class="shr-fnn">${ar(f.n)}</b> ${esc(String(f.text).replace(/\s+/g, ' ').slice(0, 56))}${String(f.text).length > 56 ? '…' : ''}</span></label>`).join('')}</div></div>` : ''}
        <div class="shr-sec">الألوان</div>
        <button type="button" class="shr-palbar" id="shrPalBar" data-palbar="1" aria-expanded="false"><i class="shr-pdot" id="shrPalDot"></i><b id="shrPalName"></b><small>اضغط للتغيير</small><i class="ti ti-chevron-down shr-palchev"></i></button>
        <div class="shr-palwrap" id="shrPalWrap" hidden>
        <div class="shr-seg shr-pals" data-seg="pal">${PAL_LIST.map((x) => { const P = x[0] === 'app' ? null : PALETTES[x[0]]; return `<button type="button" data-v="${x[0]}"><i class="shr-pdot" style="${P ? `background:${P.surface};border-color:${P.accent || '#C0502A'};box-shadow:inset 0 -9px 0 ${P.bg}` : 'background:conic-gradient(var(--accent),var(--surface),var(--accent))'}"></i><b>${x[1]}</b></button>`; }).join('')}</div>
        </div>
        <div id="shrColsRow"><div class="shr-sec">الأعمدة</div>${seg('cols', [['auto', 'تلقائي'], ['1', 'عمود'], ['2', 'عمودان'], ['3', '٣ أعمدة']])}</div>
        <label class="shr-tg"><span>إظهار صورة المرجع<small>وإن لم توجد له صورة يظهر اسمه فقط</small></span><input type="checkbox" id="shrAv"><i class="shr-sw"><b></b></i></label>
      </div>
      <div class="rs-actions shr-act">
        <button type="button" class="no" data-text="1"><i class="ti ti-text-caption"></i> كنص</button>
        <button type="button" class="no" data-save="1"><i class="ti ti-download"></i> حفظ</button>
        <button type="button" class="ok" data-send="1"><i class="ti ti-share-3"></i> <span>مشاركة</span></button>
      </div></div>`;
    const $q = (s) => o.querySelector(s);
    const body = $q('.shr-body');
    const persist = () => { try { localStorage.setItem(OKEY, JSON.stringify(op)); } catch (e) {} };
    const selected = () => (multi ? Array.from(o.querySelectorAll('input[data-i]:checked')).map((i) => model.opinions[+i.dataset.i].name) : null);
    const keyOf = () => JSON.stringify([op, selected(), meta.color || '', hide]);

    function syncUi() {
      const fixed = op.size !== 'free';
      o.querySelectorAll('[data-z]').forEach((b) => b.classList.toggle('on', b.dataset.z === op.size));
      o.querySelectorAll('[data-style]').forEach((b) => b.classList.toggle('on', b.dataset.style === op.style));
      o.querySelectorAll('[data-seg]').forEach((g) => { const cur = String(op[g.dataset.seg]); g.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === cur)); });
      $q('#shrCustom').style.display = op.size === 'custom' ? 'flex' : 'none';
      $q('#shrCutRow').style.display = fixed ? '' : 'none';
      $q('#shrColsRow').style.display = (isJami || fixed) ? '' : 'none';
      const w = $q('#shrW'), h = $q('#shrH');
      if (document.activeElement !== w) w.value = op.w;
      if (document.activeElement !== h) h.value = op.h;
      $q('#shrAv').checked = !!op.avatar;
      { const pk = PAL_NAMES.indexOf(op.pal) >= 0 ? op.pal : 'app', pl = PAL_LIST.find((x) => x[0] === pk); $q('#shrPalDot').style.cssText = palDotStyle(pk); $q('#shrPalName').textContent = pl ? pl[1] : ''; }
      const fl = $q('#shrFnList'); if (fl) fl.style.display = op.fn === 'none' ? 'none' : '';
      const fsr = $q('#shrFnStyle'); if (fsr) fsr.style.display = op.fn === 'none' ? 'none' : '';
      $q('#shrHint').textContent = hintText();
    }
    function hintText() {
      if (op.size === 'free') return 'في الأبعاد الحرّة يظهر النص كاملاً دائماً ويتبع الطولُ المحتوى.';
      return op.content === 'full'
        ? 'لا يُحذف أي شيء: إن لم يتّسع النص بالحجم المختار تُقسَّم المسألة على عدة صور بالأبعاد نفسها.'
        : 'يبقى حجم الخط كما اخترت ويُقتطع ما لا يتّسع بعلامة «…»' + (isJami ? '، ويأخذ كل مرجع نصيباً عادلاً من المساحة.' : '.');
    }
    const readCustom = () => {
      const w = $q('#shrW'), h = $q('#shrH');
      op.w = Math.max(300, Math.min(4000, parseInt(w.value, 10) || 1080));
      op.h = Math.max(300, Math.min(6000, parseInt(h.value, 10) || 1350));
    };
    function changed() { persist(); syncUi(); invalidate(); preview(); }
    function invalidate() { clearTimeout(fullTimer); full = null; fullKey = ''; }

    function showWarn(msg) { const w = $q('#shrWarn'); if (msg) { w.textContent = msg; w.hidden = false; } else { w.hidden = true; } }
    function preview() {
      clearTimeout(pvTimer);
      const box = $q('#shrPv'); box.classList.add('busy');
      pvTimer = setTimeout(async () => {
        const tok = ++pvTok; readCustom();
        const sel = selected();
        if (multi && !sel.length) { $q('.shr-pv-in').innerHTML = '<div class="shr-pv-empty">اختر مرجعاً واحداً على الأقل</div>'; box.classList.remove('busy'); last = null; showWarn(''); return; }
        try {
          const r = await renderPages(model, sel, Object.assign({}, roOf(op, meta, hide), { px: 520 }));
          if (tok !== pvTok || o._tok !== myTok || !o.classList.contains('show')) return;
          last = r;
          const inner = $q('.shr-pv-in');
          inner.innerHTML = r.canvases.map((cv) => `<img alt="معاينة" src="${cv.toDataURL('image/png')}" style="aspect-ratio:${cv.width}/${cv.height}">`).join('');
          const bits = [`${ar(r.W)}×${ar(r.H)}`];
          if (r.pages > 1) bits.push(`${ar(r.pages)} صور`);
          $q('.shr-pv-meta').textContent = bits.join(' · ');
          const notes = [];
          if (r.truncated) notes.push(r.dropped ? 'اقتُطعت بعض الآراء لتتّسع.' : 'اقتُطع جزء من النص لأنك اخترت «اقتطع منه».');
          if (r.notes.indexOf('forced-split') >= 0) notes.push('قُسِّمت على أبعاد طولية لطولها.');
          if (r.notes.indexOf('forced-free') >= 0) notes.push('أطول من أن تُقسَّم بهذه الأبعاد فاستُعمل الطول الحرّ.');
          showWarn(notes.join(' '));
          box.classList.remove('busy'); box.classList.toggle('bad', r.problems.length > 0);
          clearTimeout(fullTimer);
          if (r.W * r.H * r.pages <= 6e6) fullTimer = setTimeout(() => { buildFull().catch(() => {}); }, 500);
        } catch (e) { box.classList.remove('busy'); $q('.shr-pv-in').innerHTML = '<div class="shr-pv-empty">تعذّرت المعاينة</div>'; console.warn('share preview', e); }
      }, 140);
    }

    function buildFull() {
      const key = keyOf();
      if (full && fullKey === key) return Promise.resolve(full);
      if (fullBusy && fullBusy.key === key) return fullBusy.p;
      readCustom();
      const sel = selected();
      const p = (async () => {
        const r = await renderPages(model, sel, roOf(op, meta, hide));
        const blobs = await Promise.all(r.canvases.map(toBlob));
        const files = blobs.map((b, i) => new File([b], fileName(i, r.pages), { type: 'image/png' }));
        const res = { r, blobs, files };
        if (keyOf() === key && o._tok === myTok) { full = res; fullKey = key; }
        return res;
      })();
      fullBusy = { key, p }; p.finally(() => { if (fullBusy && fullBusy.p === p) fullBusy = null; });
      return p;
    }
    const setBusy = (btn, on) => { btn.disabled = on; btn.classList.toggle('busy', on); };
    async function doSave(btn) {
      if (multi && !selected().length) { toast('اختر مرجعاً واحداً على الأقل'); return; }
      setBusy(btn, true);
      try {
        const res = await buildFull();
        const urls = res.blobs.map((b) => URL.createObjectURL(b));
        urls.forEach((u, i) => setTimeout(() => { const a = document.createElement('a'); a.href = u; a.download = res.files[i].name; document.body.appendChild(a); a.click(); a.remove(); }, i * 250));
        setTimeout(() => urls.forEach((u) => URL.revokeObjectURL(u)), 4000 + urls.length * 250);
        toast(res.files.length > 1 ? 'حُفظت الصور' : 'حُفظت الصورة');
      } catch (e) { toast('تعذّر إنشاء الصورة'); console.warn('share save', e); }
      setBusy(btn, false);
    }
    async function doSend(btn) {
      if (multi && !selected().length) { toast('اختر مرجعاً واحداً على الأقل'); return; }
      const label = btn.querySelector('span');
      if (full && fullKey === keyOf()) { navigator.share({ files: full.files }).catch(() => {}); return; }
      setBusy(btn, true);
      try {
        const res = await buildFull();
        setBusy(btn, false);
        try { await navigator.share({ files: res.files }); }
        catch (e) {
          if (e && e.name === 'AbortError') return;
          label.textContent = 'اضغط للمشاركة'; btn.classList.add('ready');
          setTimeout(() => { label.textContent = 'مشاركة'; btn.classList.remove('ready'); }, 6000);
        }
      } catch (e) { setBusy(btn, false); toast('تعذّر إنشاء الصورة'); console.warn('share send', e); }
    }

    o.onclick = (e) => {
      const t = e.target.closest('button'); if (!t || !o.contains(t)) return;
      if (t.dataset.x) { closeStudio(); return; }
      if (t.dataset.text) { closeStudio(); RSShare.sendText(text); return; }
      if (t.dataset.save) { doSave(t); return; }
      if (t.dataset.send) { doSend(t); return; }
      if (t.dataset.palbar) { const w = $q('#shrPalWrap'); w.hidden = !w.hidden; t.setAttribute('aria-expanded', String(!w.hidden)); t.classList.toggle('open', !w.hidden); return; }
      if (t.dataset.fkall) {
        const boxes = Array.from(o.querySelectorAll('input[data-fk]')), anyOn = boxes.some((b) => b.checked);
        boxes.forEach((b) => { b.checked = !anyOn; const k = b.dataset.fk, i = hide.indexOf(k); if (!anyOn && i >= 0) hide.splice(i, 1); else if (anyOn && i < 0) hide.push(k); });
        t.textContent = anyOn ? 'تحديد الكل' : 'إلغاء التحديد'; invalidate(); preview(); return;
      }
      if (t.dataset.z) { op.size = t.dataset.z; changed(); return; }
      if (t.dataset.style) { op.style = t.dataset.style; changed(); return; }
      const g = t.closest('[data-seg]');
      if (g) { op[g.dataset.seg] = t.dataset.v; if (g.dataset.seg === 'pal') { const w = $q('#shrPalWrap'); if (w) w.hidden = true; const pb = $q('#shrPalBar'); if (pb) { pb.classList.remove('open'); pb.setAttribute('aria-expanded', 'false'); } } changed(); }
    };
    body.addEventListener('change', (e) => {
      const t = e.target;
      if (t.id === 'shrAv') { op.avatar = t.checked; changed(); }
      else if (t.matches('input[data-fk]')) { const k = t.dataset.fk, i = hide.indexOf(k); if (t.checked && i >= 0) hide.splice(i, 1); else if (!t.checked && i < 0) hide.push(k); invalidate(); preview(); }
      else if (t.matches('input[data-i]')) { invalidate(); preview(); }
    });
    ['#shrW', '#shrH'].forEach((s) => { $q(s).oninput = () => { readCustom(); persist(); invalidate(); preview(); }; });
    $q('#shrPv').addEventListener('click', (e) => {
      const im = e.target.closest('img'); if (!im) return;
      const imgs = Array.from(o.querySelectorAll('.shr-pv-in img')); openViewer(imgs.map((x) => x.src), imgs.indexOf(im), () => buildFull().then((r) => r.blobs).catch(() => null));
    });
    if (!detectShare()) $q('[data-send]').style.display = 'none';

    studioClose = () => { clearTimeout(pvTimer); clearTimeout(fullTimer); pvTok++; full = null; };
    syncUi(); preview();
    o._g = Date.now() + 800;
    o.classList.add('show');
  }

  const _orig = window.rsShareText;
  RSShare.sendText = function (t) { if (typeof _orig === 'function') _orig(t); };
  window.rsShareText = function (text) {
    text = String(text || ''); if (!text) return;
    RSShare.lastMeta = RSShare.meta || null; RSShare.meta = null;
    studio(text);
  };
  document.addEventListener('pointerdown', (e) => {
    try {
      const b = e.target && e.target.closest ? e.target.closest('button') : null;
      const i = b && b.firstElementChild;
      if (!i || !i.classList || !(i.classList.contains('ti-clipboard') || i.classList.contains('ti-copy') || i.classList.contains('ti-share-3'))) return;
      const el = b.closest('.masala-block, .thamra-item, .cmp-answer-card, .cmp-question-box');
      if (el) RSShare.hint = { el, t: Date.now() };
    } catch (er) {}
  }, true);
  RSShare.open = studio;
})();
