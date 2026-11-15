(function () {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const AR = '٠١٢٣٤٥٦٧٨٩', ar = (n) => String(n).replace(/\d/g, (d) => AR[d]);
  const toast = (m) => { try { showGenericToast(m); } catch (e) {} };

  const css = document.createElement('style');
  css.textContent = `
  #writingPage:has(.wr-read) { padding-inline: 14px; }
  .wr-read { padding: 6px 2px 120px; }
  .wr-read-title { margin: 14px 0 4px; font-size: 1.35em; font-weight: 800; line-height: 1.6; padding-inline-start: 12px; border-inline-start: 5px solid var(--bar, var(--accent)); }
  .wr-read-meta { font-size: 12px; color: var(--text-dim); margin: 0 0 14px; padding-inline-start: 17px; }
  .wr-read-body { line-height: 2.05; word-wrap: break-word; }
  .wr-read-body .wr-masala { margin: 12px 0; }
  .wr-fab { position: fixed; left: 16px; bottom: calc(var(--nav-clear, 80px) + 6px); z-index: 40; width: 54px; height: 54px; border-radius: 50%; border: 0; background: var(--accent); color: #fff; font-size: 23px; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 18px rgba(var(--shadow-rgb,0,0,0),.3); cursor: pointer; }
  .wr-fab:active { transform: scale(.94); }
  `;
  document.head.appendChild(css);

  const _edit = window.openWritingEditor;
  const findW = (id) => freeWritings.find((w) => w.id === id);
  function bodyHtmlOf(w) { return w.html ? sanitizeWritingHtml(w.html) : escapeHtml(w.text || '').replace(/\n/g, '<br>'); }

  window.rsReadWriting = function (id) {
    const w = findW(id); if (!w) { renderWritingPage(); return; }
    currentWritingId = id;
    const container = document.getElementById('writingPage');
    const words = (w.text || '').trim() ? (w.text || '').trim().split(/\s+/).length : 0;
    const wc = w.color || '#8e5bd4';
    container.innerHTML = `
      <div class="wr-top" id="wrTop"><div class="wr-bar">
        <button class="wr-ic" onclick="renderWritingPage()" title="رجوع للقائمة"><i class="ti ti-chevron-right"></i></button>
        <span class="wr-bar-sp"></span>
        <button class="wr-ic" onclick="rsCopyWritingRead()" title="نسخ"><i class="ti ti-copy"></i></button>
        <button class="wr-ic" onclick="rsPrintWriting('${id}')" title="PDF / طباعة"><i class="ti ti-file-type-pdf"></i></button>
      </div></div>
      <div class="wr-read" style="--bar:${wc}">
        ${w.title ? `<h2 class="wr-read-title">${escapeHtml(w.title)}</h2>` : ''}
        <div class="wr-read-meta">${esc(ar(words))} كلمة${w.updatedAt ? ' · ' + esc(relativeTimeAr(w.updatedAt)) : ''}</div>
        <div class="wr-read-body body-text ${fontFamily}" style="font-size:${fontSize}px;">${bodyHtmlOf(w) || '<span style="color:var(--text-dim)">لا نص بعد — اضغط على القلم للكتابة.</span>'}</div>
      </div>
      <button class="wr-fab" onclick="rsEditWriting('${id}')" title="تعديل" aria-label="تعديل"><i class="ti ti-pencil"></i></button>`;
    try { registerView(() => { rsReadWriting(id); switchPage('writingPage', 'شخصي'); }); } catch (e) {}
    try { RSSelect && RSSelect.clear(); } catch (e) {}
  };
  window.rsEditWriting = function (id) { return _edit.call(window, id, true); };
  window.rsCopyWritingRead = function () {
    const el = document.querySelector('#writingPage .wr-read-body'); if (!el) return;
    const t = el.innerText.replace(/ /g, ' ').trim();
    const ok = () => toast('تم النسخ');
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, () => { try { rsLegacyCopy(t); ok(); } catch (e) {} });
    else { try { rsLegacyCopy(t); ok(); } catch (e) {} }
  };

  const H = (t) => `<div><b>${t}</b>&nbsp;</div><div><br></div>`;
  const TEMPLATES = [
    { n: 'كتابة فارغة', ic: 'file', html: '' },
    { n: 'بحث فقهي', ic: 'scale', title: 'بحث في ', html: H('المسألة:') + H('الأقوال والمراجع:') + H('الدليل:') + H('الخلاصة:') },
    { n: 'ملخص درس', ic: 'notebook', title: 'درس: ', html: H('الموضوع:') + H('النقاط الرئيسية:') + H('فوائد:') + H('أسئلة للمراجعة:') },
    { n: 'سؤال وجواب', ic: 'help-circle', title: 'سؤال: ', html: H('السؤال:') + H('الجواب:') + H('المصدر:') }
  ];
  function openTemplates() {
    openMiniMenu('كتابة جديدة', TEMPLATES.map((t, i) => `<div class="list-row" onclick="rsNewWriting(${i})"><span style="font-size:20px;"><i class="ti ti-${t.ic}"></i></span><div class="label">${t.n}</div></div>`).join(''));
  }
  window.rsNewWriting = function (i) {
    try { closeMiniMenu(); } catch (e) {}
    const t = TEMPLATES[i] || TEMPLATES[0];
    _edit.call(window, null, true);
    if (!t.html && !t.title) return;
    const ed = writingEditorEl(), ti = document.getElementById('writingTitleInput');
    if (ti && t.title) ti.value = t.title;
    ed.innerHTML = t.html;
    try { ed.dispatchEvent(new Event('input')); } catch (e) {}
    try {
      ed.focus();
      const first = ed.firstElementChild || ed, r = document.createRange();
      r.selectNodeContents(first); r.collapse(false);
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
    } catch (e) {}
  };

  window.openWritingEditor = function (id, forceEdit) {
    if (forceEdit) return _edit.apply(this, [id]);
    if (id && findW(id)) return rsReadWriting(id);
    if (!id) return _edit.call(window, null, true);
    return _edit.apply(this, arguments);
  };

  const _save = window.saveCurrentWriting;
  window.saveCurrentWriting = function () {
    if (typeof rsAutosaveNow === 'function') {
      rsAutosaveNow();
      const id = currentWritingId;
      if (id && findW(id)) { rsReadWriting(id); return; }
      renderWritingPage(); return;
    }
    return _save.apply(this, arguments);
  };
  const patchBack = () => {
    const id = currentWritingId, b = document.querySelector('#wrTop .wr-bar .wr-ic');
    if (id && b && document.getElementById('writingMainTextarea')) b.setAttribute('onclick', `if(window.rsAutosaveNow) rsAutosaveNow(); rsReadWriting('${id}')`);
  };
  const _editWrapped = window.rsEditWriting;
  window.rsEditWriting = function (id) { const r = _editWrapped.call(this, id); try { patchBack(); } catch (e) {} return r; };

  function printHtml(title, inner) {
    const base = new URL('.', location.href).href;
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
    document.body.appendChild(f);
    const d = f.contentDocument;
    d.open();
    d.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title>
      <base href="${base}"><link rel="stylesheet" href="vendor/fonts.css">
      <style>
        @page { size: A4; margin: 18mm 16mm 20mm; @bottom-center { content: counter(page); font-family: 'Amiri', serif; font-size: 11pt; color: #666; } }
        html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        body { font-family: 'Amiri', 'Scheherazade New', serif; font-size: 15pt; line-height: 2; color: #111; margin: 0; }
        h1 { font-size: 24pt; text-align: center; margin: 0 0 4pt; }
        .sub { text-align: center; color: #777; font-size: 11pt; margin-bottom: 18pt; border-bottom: 1.5px solid #bbb; padding-bottom: 10pt; }
        h2 { font-size: 18pt; margin: 20pt 0 6pt; break-after: avoid; border-inline-start: 5px solid #888; padding-inline-start: 10pt; }
        .it { margin: 0 0 12pt; break-inside: avoid-page; }
        .src { font-size: 10.5pt; color: #777; margin-bottom: 2pt; }
        .tx { white-space: pre-wrap; text-align: justify; }
        .note { border-inline-start: 4px solid #999; background: #f4f4f4; padding: 6pt 10pt; font-size: 14pt; }
        .quote { border-inline-start: 4px solid #bbb; padding-inline-start: 10pt; }
        .wr b, .wr strong { font-weight: 700; }
      </style></head><body>${inner}</body></html>`);
    d.close();
    const go = () => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { toast('تعذّرت الطباعة في هذا المتصفح'); } setTimeout(() => f.remove(), 60000); };
    const w = f.contentWindow;
    const ready = (w.document.fonts && w.document.fonts.ready) ? w.document.fonts.ready : Promise.resolve();
    Promise.race([ready, new Promise((r) => setTimeout(r, 1500))]).then(() => setTimeout(go, 150));
  }
  const PDF = { W: 1240, H: 1754, M: 120, FS: 34, LH: 66 };
  function pdfText(html) {
    const d = document.createElement('div'); d.style.cssText = 'position:fixed;left:-99999px;top:0;width:600px;white-space:pre-wrap;';
    d.innerHTML = html; document.body.appendChild(d);
    const t = d.innerText; d.remove(); return String(t || '').replace(/\n{3,}/g, '\n\n').trim();
  }
  async function pdfBuild(title, sub, blocks) {
    try { await Promise.race([document.fonts.load('700 40px Amiri'), new Promise((r) => setTimeout(r, 1500))]); await document.fonts.load('400 34px Amiri'); } catch (e) {}
    const cs = getComputedStyle(document.documentElement);
    const ACC = (cs.getPropertyValue('--accent') || '#C0502A').trim() || '#C0502A';
    const FONT = "'Amiri','Scheherazade New','Noto Naskh Arabic',serif";
    const pages = []; let cv, c, y, n = 0;
    const R = PDF.W - PDF.M, L = PDF.M, maxW = R - L;
    const toAr = (x) => String(x).replace(/\d/g, (k) => '٠١٢٣٤٥٦٧٨٩'[k]);
    const newPage = () => {
      cv = document.createElement('canvas'); cv.width = PDF.W; cv.height = PDF.H; c = cv.getContext('2d');
      c.fillStyle = '#fff'; c.fillRect(0, 0, PDF.W, PDF.H); c.direction = 'rtl'; c.textBaseline = 'alphabetic';
      y = PDF.M; n++; pages.push(cv);
    };
    const limit = () => PDF.H - PDF.M - 40;
    const wrap = (txt, font, w) => {
      c.font = font; const out = [];
      String(txt).split('\n').forEach((par) => {
        if (!par.trim()) { out.push(''); return; }
        let line = '';
        par.split(/\s+/).forEach((wd) => { const t = line ? line + ' ' + wd : wd; if (c.measureText(t).width > w && line) { out.push(line); line = wd; } else line = t; });
        if (line) out.push(line);
      });
      return out;
    };
    const ensure = (h) => { if (y + h > limit()) newPage(); };
    newPage();
    c.textAlign = 'center'; c.fillStyle = '#1b1208'; c.font = `700 62px ${FONT}`;
    wrap(title, c.font, maxW - 40).forEach((l) => { c.fillText(l, PDF.W / 2, y + 62); y += 82; });
    if (sub) { y += 18; c.font = `400 28px ${FONT}`; c.fillStyle = '#7a6b58'; c.fillText(sub, PDF.W / 2, y + 20); y += 44; }
    c.strokeStyle = ACC; c.lineWidth = 3; c.beginPath(); c.moveTo(PDF.W / 2 - 80, y + 6); c.lineTo(PDF.W / 2 + 80, y + 6); c.stroke(); y += 46;
    c.textAlign = 'right';
    for (const b of blocks) {
      if (b.k === 'h2') {
        const f = `700 44px ${FONT}`, ls = wrap(b.t, f, maxW - 40); ensure(ls.length * 66 + 70);
        y += 26; c.fillStyle = ACC; c.fillRect(R - 8, y - 2, 8, ls.length * 66 - 8);
        c.font = f; c.fillStyle = '#1b1208'; ls.forEach((l) => { c.fillText(l, R - 30, y + 46); y += 66; }); y += 14; continue;
      }
      const f = `400 ${PDF.FS}px ${FONT}`, ind = b.k === 'quote' ? 34 : (b.k === 'note' ? 30 : 0);
      const ls = wrap(b.t, f, maxW - ind * 2);
      if (b.src) { c.font = `400 26px ${FONT}`; const sl = wrap(b.src, c.font, maxW); ensure(sl.length * 42 + PDF.LH * 2); c.fillStyle = '#8a7b6a'; sl.forEach((l) => { c.fillText(l, R, y + 30); y += 42; }); }
      let i = 0;
      while (i < ls.length) {
        const room = Math.max(1, Math.floor((limit() - y) / PDF.LH));
        if (room < 2 && i === 0) { newPage(); continue; }
        const part = ls.slice(i, i + room);
        if (b.k === 'note') { c.fillStyle = '#f5f1ea'; c.fillRect(L, y - 8, maxW, part.length * PDF.LH + 20); c.fillStyle = '#a99a85'; c.fillRect(R - 6, y - 8, 6, part.length * PDF.LH + 20); }
        if (b.k === 'quote') { c.fillStyle = '#cfc4b4'; c.fillRect(R - 5, y - 4, 5, part.length * PDF.LH + 10); }
        c.font = f; c.fillStyle = '#17110a';
        part.forEach((l) => { c.fillText(l, R - ind, y + 40); y += PDF.LH; });
        i += part.length;
        if (i < ls.length) newPage();
      }
      y += 34;
    }
    pages.forEach((p, i) => { const g = p.getContext('2d'); g.direction = 'rtl'; g.textAlign = 'center'; g.font = `400 28px ${FONT}`; g.fillStyle = '#8a7b6a'; g.fillText(toAr(i + 1), PDF.W / 2, PDF.H - 56); });
    return pages;
  }
  async function pdfBytes(pages) {
    const enc = new TextEncoder(), chunks = []; let len = 0; const offs = [];
    const push = (u) => { chunks.push(u); len += u.length; };
    const str = (s) => push(enc.encode(s));
    const jpgs = [];
    for (const p of pages) { const blob = await new Promise((r) => p.toBlob(r, 'image/jpeg', 0.9)); jpgs.push(new Uint8Array(await blob.arrayBuffer())); }
    const N = pages.length, PW = 595.28, PH = 841.89;
    str('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    const obj = (id, fn) => { offs[id] = len; str(id + ' 0 obj\n'); fn(); str('\nendobj\n'); };
    obj(1, () => str('<< /Type /Catalog /Pages 2 0 R >>'));
    obj(2, () => str('<< /Type /Pages /Count ' + N + ' /Kids [' + pages.map((_, i) => (3 + i * 3) + ' 0 R').join(' ') + '] >>'));
    pages.forEach((p, i) => {
      const pid = 3 + i * 3, iid = pid + 1, cid = pid + 2;
      obj(pid, () => str(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /XObject << /Im0 ${iid} 0 R >> >> /Contents ${cid} 0 R >>`));
      obj(iid, () => { str(`<< /Type /XObject /Subtype /Image /Width ${p.width} /Height ${p.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpgs[i].length} >>\nstream\n`); push(jpgs[i]); str('\nendstream'); });
      const cs = `q ${PW} 0 0 ${PH} 0 0 cm /Im0 Do Q`;
      obj(cid, () => str(`<< /Length ${cs.length} >>\nstream\n${cs}\nendstream`));
    });
    const total = 3 + N * 3, xref = len;
    str('xref\n0 ' + total + '\n0000000000 65535 f \n');
    for (let i = 1; i < total; i++) str(String(offs[i]).padStart(10, '0') + ' 00000 n \n');
    str('trailer\n<< /Size ' + total + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF');
    const out = new Uint8Array(len); let o = 0; chunks.forEach((u) => { out.set(u, o); o += u.length; });
    return out;
  }
  function pdfDeliver(bytes, name) {
    const blob = new Blob([bytes], { type: 'application/pdf' }), url = URL.createObjectURL(blob);
    const file = (() => { try { return new File([blob], name + '.pdf', { type: 'application/pdf' }); } catch (e) { return null; } })();
    const canShare = !!(file && navigator.canShare && navigator.canShare({ files: [file] }));
    const ov = document.createElement('div'); ov.className = 'rs-ov show'; ov.id = 'rsPdfDone';
    ov.innerHTML = `<div class="rs-pop"><button type="button" class="sx" aria-label="إغلاق"></button><h3><i class="ti ti-file-type-pdf"></i> ملف PDF جاهز</h3>
      <p style="margin:6px 0 14px;line-height:1.9;color:var(--text-muted)">${esc(name)}.pdf · ${esc(ar(Math.max(1, Math.round(bytes.length / 1024))))} ك.ب</p>
      <div class="rs-actions"><a class="ok" id="rsPdfSave" href="${url}" download="${esc(name)}.pdf" style="text-decoration:none;text-align:center"><i class="ti ti-download"></i> حفظ</a>
      ${canShare ? '<button type="button" class="no" id="rsPdfShare"><i class="ti ti-share-3"></i> مشاركة</button>' : ''}
      <button type="button" class="no" id="rsPdfOpen"><i class="ti ti-eye"></i> فتح</button></div></div>`;
    document.body.appendChild(ov);
    const close = () => { ov.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000); };
    ov.querySelector('.sx').onclick = close; ov.onclick = (e) => { if (e.target === ov) close(); };
    ov.querySelector('#rsPdfSave').addEventListener('click', () => setTimeout(close, 400));
    const sh = ov.querySelector('#rsPdfShare'); if (sh) sh.onclick = () => { navigator.share({ files: [file], title: name }).then(close, () => {}); };
    ov.querySelector('#rsPdfOpen').onclick = () => { window.open(url, '_blank'); };
  }
  async function exportPdf(title, sub, blocks) {
    try { toast('جارٍ تجهيز ملف PDF…'); } catch (e) {}
    try {
      const pages = await pdfBuild(title, sub, blocks);
      const bytes = await pdfBytes(pages);
      pdfDeliver(bytes, String(title || 'مشكاة').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 60) || 'مشكاة');
      return true;
    } catch (e) { console.warn('pdf', e); try { toast('تعذّر إنشاء الملف'); } catch (x) {} return false; }
  }
  window.RSPdf = { build: pdfBuild, bytes: pdfBytes, export: exportPdf };

  window.rsPrintWriting = function (id) {
    const w = findW(id); if (!w) return;
    const txt = pdfText(bodyHtmlOf(w));
    exportPdf(w.title || 'كتابة', new Date(w.updatedAt || Date.now()).toLocaleDateString('ar'), [{ k: 'p', t: txt }]).then((ok) => {
      if (!ok) printHtml(w.title || 'كتابة', `${w.title ? `<h1>${escapeHtml(w.title)}</h1>` : ''}<div class="wr">${bodyHtmlOf(w)}</div>`);
    });
  };
  function cleanBody(b) {
    return String(b || '').replace(new RegExp(BLOCK_MARKER_SRC, 'g'), '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/\[\d+\]/g, '').replace(/^[:.،؛\s]+/, '').replace(/\n{3,}/g, '\n\n').trim();
  }
  window.rsPrintBook = function (id) {
    const cb = customBooks.find((b) => b.id === id); if (!cb) return;
    const blocks = [];
    const item = (it) => {
      if (it.type === 'chapter') { blocks.push({ k: 'h2', t: it.title || 'فصل' }); it.items.forEach(item); return; }
      if (it.type === 'note') { blocks.push({ k: 'note', t: (it.text || '').replace(/[*=]/g, '') }); return; }
      if (it.type === 'quote') { blocks.push({ k: 'quote', src: it.srcSub || it.bookName || '', t: it.text || '' }); return; }
      let body = '';
      try {
        const c = it.type === 'masala' ? getMasalaContentForCustomBook(it.bookId, it.sectionIdx, it.masalaNum) : getProcessedSection(it.bookId, it.sectionIdx);
        body = cleanBody(c && c.body);
      } catch (e) {}
      if (!body) return;
      blocks.push({ k: 'p', src: [it.authorName, it.bookName, it.masalaNum ? 'مسألة ' + it.masalaNum : ''].filter(Boolean).join(' - '), t: body });
    };
    cb.items.forEach(item);
    if (!blocks.length) { try { toast('الكتاب فارغ، أضف إليه مسائل أولاً'); } catch (e) {} return; }
    exportPdf(cb.name, new Date().toLocaleDateString('ar') + ' · ' + ar(flattenCustomBookItems(cb).length) + ' عنصراً', blocks);
  };
  const _more = window.openCustomBookMoreMenu;
  window.openCustomBookMoreMenu = function () {
    const r = _more.apply(this, arguments);
    try {
      document.getElementById('miniMenuList').insertAdjacentHTML('afterbegin',
        `<div class="list-row" onclick="closeMiniMenu(); rsPrintBook('${currentCustomBookId}');"><span style="font-size:20px;"><i class="ti ti-file-type-pdf"></i></span><div class="label">تصدير PDF / طباعة</div></div>`);
    } catch (e) {}
    return r;
  };
})();
