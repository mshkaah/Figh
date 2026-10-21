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
  window.rsPrintWriting = function (id) {
    const w = findW(id); if (!w) return;
    printHtml(w.title || 'كتابة', `${w.title ? `<h1>${escapeHtml(w.title)}</h1>` : ''}<div class="sub">${esc(new Date(w.updatedAt || Date.now()).toLocaleDateString('ar'))}</div><div class="wr">${bodyHtmlOf(w)}</div>`);
  };
  function cleanBody(b) {
    return String(b || '').replace(new RegExp(BLOCK_MARKER_SRC, 'g'), '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/\[\d+\]/g, '').replace(/^[:.،؛\s]+/, '').replace(/\n{3,}/g, '\n\n').trim();
  }
  window.rsPrintBook = function (id) {
    const cb = customBooks.find((b) => b.id === id); if (!cb) return;
    let html = `<h1>${escapeHtml(cb.name)}</h1><div class="sub">${esc(new Date().toLocaleDateString('ar'))} · ${esc(ar(flattenCustomBookItems(cb).length))} عنصراً</div>`;
    const item = (it) => {
      if (it.type === 'chapter') { html += `<h2>${escapeHtml(it.title || 'فصل')}</h2>`; it.items.forEach(item); return; }
      if (it.type === 'note') { html += `<div class="it note tx">${escapeHtml((it.text || '').replace(/[*=]/g, ''))}</div>`; return; }
      if (it.type === 'quote') { html += `<div class="it quote"><div class="src">${escapeHtml(it.srcSub || it.bookName || '')}</div><div class="tx">${escapeHtml(it.text || '')}</div></div>`; return; }
      let body = '';
      try {
        const c = it.type === 'masala' ? getMasalaContentForCustomBook(it.bookId, it.sectionIdx, it.masalaNum) : getProcessedSection(it.bookId, it.sectionIdx);
        body = cleanBody(c && c.body);
      } catch (e) {}
      if (!body) return;
      html += `<div class="it"><div class="src">${escapeHtml([it.authorName, it.bookName, it.masalaNum ? 'مسألة ' + it.masalaNum : ''].filter(Boolean).join(' - '))}</div><div class="tx">${escapeHtml(body)}</div></div>`;
    };
    cb.items.forEach(item);
    printHtml(cb.name, html);
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
