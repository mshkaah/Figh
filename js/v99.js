(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const toast = (m) => { try { showGenericToast(m); } catch (e) {} };

  let chip = null, chipText = '', chipTimer = 0;
  function ensureChip() {
    if (chip && chip.isConnected) return chip;
    chip = document.createElement('div');
    chip.id = 'chapterChip'; chip.setAttribute('aria-hidden', 'true');
    chip.innerHTML = '<span class="cc-dot"></span><span class="cc-tx"></span>';
    document.body.appendChild(chip);
    return chip;
  }
  function placeChip() {
    const tb = $('topbar'); if (!tb || !chip) return;
    if (document.body.classList.contains('tb-away')) { chip.style.top = ''; return; }
    chip.style.top = Math.round(tb.offsetTop + tb.offsetHeight + 6) + 'px';
  }
  function watchTopbar() {
    const tb = $('topbar'); if (!tb || tb.__chipWatch) return; tb.__chipWatch = true;
    try { new ResizeObserver(placeChip).observe(tb); } catch (e) {}
    try { new MutationObserver(placeChip).observe(document.body, { attributes: true, attributeFilter: ['class'] }); } catch (e) {}
    tb.addEventListener('transitionend', placeChip);
  }
  function showChip(text) {
    const c = ensureChip(); placeChip(); watchTopbar();
    const tx = c.querySelector('.cc-tx');
    if (!text) { c.classList.remove('show'); chipText = ''; return; }
    if (text === chipText && c.classList.contains('show')) return;
    const first = !c.classList.contains('show');
    chipText = text;
    if (first) { tx.textContent = text; void c.offsetWidth; c.classList.add('show'); return; }
    c.classList.add('swap'); clearTimeout(chipTimer);
    chipTimer = setTimeout(() => { tx.textContent = text; c.classList.remove('swap'); }, 150);
  }
  function hideChip() { if (chip) { chip.classList.remove('show'); chipText = ''; } }

  const _clear = window.clearReadingHeader;
  window.clearReadingHeader = function () { if (typeof _clear === 'function') _clear(); hideChip(); const t = $('pageTitle'); if (t) delete t.dataset.rhKey; };

  window.setReadingHeader = function (sectionTitle, bookName) {
    const el = $('pageTitle'); if (!el) return;
    const rp = $('readerPage'); if (!rp || !rp.classList.contains('active')) return;
    let marja = '', aid = null;
    try { const b = allBooks.find((x) => x.id === currentBookId); if (b) { aid = b.author_id; marja = allAuthors[aid] || ''; } } catch (e) {}
    const key = marja + '|' + bookName;
    if (el.dataset.rhKey !== key) {
      el.dataset.rhKey = key;
      el.innerHTML = '';
      const main = document.createElement('span'); main.className = 'rh-book'; main.textContent = bookName || sectionTitle || '';
      main.onclick = () => { try { openTocDrawer(); } catch (e) {} };
      el.appendChild(main);
      if (marja) {
        const sub = document.createElement('span'); sub.className = 'title-sub rh-marja';
        let photo = null; try { photo = AUTHOR_PHOTOS[aid]; } catch (e) {}
        if (photo) { const im = document.createElement('img'); im.className = 'rh-av'; im.alt = ''; im.src = photo; im.onerror = () => im.remove(); sub.appendChild(im); }
        const nm = document.createElement('span'); nm.textContent = marja; sub.appendChild(nm);
        el.appendChild(sub);
      }
    }
    document.body.classList.add('reading-compact');
    const t = (sectionTitle || '').trim();
    showChip(t && t !== (bookName || '').trim() ? t : '');
  };
  window.addEventListener('resize', placeChip);
  let moT = 0;
  const mo = new MutationObserver(() => {
    if (moT) return;
    moT = setTimeout(() => { moT = 0; const open = document.querySelector('.overlay.show, .rs-ov.show, #tocDrawer.open'); if (chip) chip.classList.toggle('under', !!open); }, 160);
  });
  mo.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });

  fetch('vendor/fonts/alfannan.woff2', { method: 'HEAD', cache: 'no-store' }).then((r) => {
    if (!r.ok) return;
    const b = $('fontFannanBtn'); if (b) b.style.display = '';
    if (document.fonts && document.fonts.load) document.fonts.load('400 17px "Alfannan"').catch(() => {});
  }).catch(() => {});

  try {
    if (sessionStorage.getItem('rs_just_updated')) {
      sessionStorage.removeItem('rs_just_updated');
      setTimeout(() => toast('تم تحديث التطبيق تلقائياً ✓'), 900);
    }
  } catch (e) {}
})();
