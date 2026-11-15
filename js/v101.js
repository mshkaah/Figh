(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (m) => { try { showGenericToast(m); } catch (e) {} };
  const norm = (s) => { try { return normalizeArabic(String(s == null ? '' : s)).toLowerCase(); } catch (e) { return String(s || '').toLowerCase(); } };
  const arNum = (n) => { try { return normalizeDigits ? String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]) : String(n); } catch (e) { return String(n); } };
  const embedded = () => { try { return !!isEmbeddedMode; } catch (e) { return false; } };
  const RSV101 = (window.RSV101 = window.RSV101 || {});
  const TG_URL = 'https://t.me/+vtccHL2oQjBkMmVk';
  RSV101.TG_URL = TG_URL;

  const ANCHOR_EXC = '.fn-body,.fn-box,.fn-remark,.fn-orphans,.sharh-accordion,.cmp-accordion,.note-display,.note-accordion,.masala-tools,.pm-nav,.cs-xnote,.ext-tools,.cmp-card-tools,.cmp-tools2,.sharh-bar,.sec-title-ic,script,style';
  const okNode = (n) => { const p = n.parentElement; return !!p && !p.closest(ANCHOR_EXC); };
  function textWalker(root) {
    return document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (okNode(n) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
  }
  function caretAt(x, y) {
    try {
      if (document.caretRangeFromPoint) return document.caretRangeFromPoint(x, y);
      if (document.caretPositionFromPoint) {
        const cp = document.caretPositionFromPoint(x, y); if (!cp) return null;
        const r = document.createRange(); r.setStart(cp.offsetNode, cp.offset); r.collapse(true); return r;
      }
    } catch (e) {}
    return null;
  }
  function charTop(node, off) {
    const len = node.nodeValue.length; if (!len) return null;
    for (let k = 0; k < 24; k++) {
      const o = Math.min(len - 1, off + k); if (o < 0) break;
      const r = document.createRange(); r.setStart(node, o); r.setEnd(node, o + 1);
      const rc = r.getClientRects()[0]; if (rc && rc.height > 0) return rc.top;
    }
    return null;
  }
  const RSAnchor = (window.RSAnchor = {
    capture(root, scroller, inset) {
      try {
        if (!root || !scroller) return null;
        const cr = scroller.getBoundingClientRect();
        const ys = [cr.top + (inset || 0) + 8, cr.top + (inset || 0) + 30];
        const xs = [cr.right - 26, cr.left + cr.width / 2, cr.left + 26];
        for (const y of ys) for (const x of xs) {
          const rg = caretAt(x, y);
          if (!rg || rg.startContainer.nodeType !== 3 || !root.contains(rg.startContainer) || !okNode(rg.startContainer)) continue;
          let ch = 0, found = false; const w = textWalker(root); let n;
          while ((n = w.nextNode())) { if (n === rg.startContainer) { ch += rg.startOffset; found = true; break; } ch += n.nodeValue.length; }
          if (!found) continue;
          const top = charTop(rg.startContainer, rg.startOffset); if (top == null) continue;
          return { ch, dy: Math.round((top - cr.top) * 10) / 10 };
        }
      } catch (e) {}
      return null;
    },
    restore(root, scroller, ch, dy) {
      try {
        if (!root || !scroller || typeof ch !== 'number') return false;
        const w = textWalker(root); let n, acc = 0;
        while ((n = w.nextNode())) {
          const L = n.nodeValue.length;
          if (ch < acc + L) {
            const top = charTop(n, ch - acc); if (top == null) return false;
            const cr = scroller.getBoundingClientRect();
            const diff = top - (cr.top + (dy || 0));
            if (Math.abs(diff) > 1.5) { window.__rsSelfScroll = performance.now(); scroller.scrollTop += diff; }
            return true;
          }
          acc += L;
        }
      } catch (e) {}
      return false;
    },
    settle(getRoot, scroller, ch, dy, tries) {
      let touched = false, n = 0;
      const stop = () => { touched = true; cleanup(); };
      const onScroll = () => { if (performance.now() - (window.__rsSelfScroll || 0) > 120) stop(); };
      const evs = ['touchstart', 'touchmove', 'pointerdown', 'wheel', 'mousedown', 'keydown'];
      const cleanup = () => { evs.forEach((ev) => scroller.removeEventListener(ev, stop)); scroller.removeEventListener('scroll', onScroll); };
      evs.forEach((ev) => scroller.addEventListener(ev, stop, { passive: true }));
      scroller.addEventListener('scroll', onScroll, { passive: true });
      const step = () => { if (touched) return; const r = getRoot(); if (r) RSAnchor.restore(r, scroller, ch, dy); if (++n < Math.min(tries || 4, 4)) setTimeout(() => requestAnimationFrame(step), 220); else cleanup(); };
      step();
      try { if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!touched) { const r = getRoot(); if (r) RSAnchor.restore(r, scroller, ch, dy); } }); } catch (e) {}
    }
  });

  (function () {
    const orig = window.setFontSizeLevel;
    if (typeof orig !== 'function') return;
    let t = 0;
    window.setFontSizeLevel = function (size) {
      try {
        fontSize = (typeof nearestFontSizeLevel === 'function') ? nearestFontSizeLevel(size) : size;
        document.documentElement.style.setProperty('--read-size', fontSize + 'px');
        clearTimeout(t); t = setTimeout(() => lsSet('rs_fontSize', String(fontSize)), 250);
        syncFontSizeUi();
        if (typeof rsSetUiScale === 'function') rsSetUiScale();
      } catch (e) { return orig.apply(this, arguments); }
    };
    const flush = () => { try { lsSet('rs_fontSize', String(fontSize)); } catch (e) {} };
    document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
    window.addEventListener('pagehide', flush);
  })();

  const ALIAS = {
    'القراءة الليلية': 'ليلي داكن اسود وضع مظلم نهار ثيم',
    'حجم الخط': 'تكبير تصغير كبير صغير خط حجم',
    'التكبير والتصغير بالأصابع': 'قرص زوم pinch اصبعين تكبير',
    'سرعة التمرير التلقائي': 'اوتو تلقائي نزول تلقائي سرعة',
    'نوع الخط': 'خط اميري نسخ شهرزاد تاهوما',
    'طريقة قراءة الكتب': 'تمرير صفحة تقليب صفحات متصل',
    'تباعد الأسطر': 'مسافة اسطر سطر ارتفاع السطر',
    'هوامش الصفحة': 'حواف مسافة جانبية',
    'إبقاء الشاشة مضاءة': 'اضاءة سهر لا تنطفئ قفل الشاشة',
    'السحب الأفقي بين الأبواب': 'سحب تنقل يمين يسار ابواب فصول سوايب',
    'العودة إلى آخر موضع عند الفتح': 'استئناف ذاكرة اكمل آخر مكان موضع',
    'الشريط السفلي': 'تبويبات شريط سفلي مضغوط اخفاء',
    'لون التطبيق': 'لون اللون مظهر ثيم',
    'لون الخلفية': 'خلفية لون ورقي',
    'تأثير الضوء': 'توهج وهج اضاءة',
    'النسخة الاحتياطية': 'نسخ احتياطي باك اب تصدير حفظ',
    'نسخة احتياطية': 'نسخ احتياطي باك اب تصدير حفظ بيانات',
    'استعادة من نسخة': 'استيراد استرجاع ملف',
    'إشعار «مسألة اليوم»': 'اشعار تنبيه اشعارات يومي',
    'حفظ سجل البحث': 'تاريخ بحث سجل خصوصية',
    'مسح سجل البحث': 'تاريخ بحث حذف خصوصية',
    'المحذوفات': 'سلة المهملات استرجاع محذوف',
    'ترتيب المكتبة': 'ترتيب مراجع كتب اعادة ترتيب',
    'حواشي الكتب وتعليقات المراجع': 'حاشية هامش فوتنوت مفتوحة مغلقة',
    'كتب المصطلحات الفقهية': 'قاموس معاني مصطلحات تسطير',
    'إظهار المصطلحات الفقهية': 'قاموس معاني مصطلحات تسطير كلمات مسطرة',
    'نظام تحديد النص الخاص بالتطبيق': 'تحديد نسخ تظليل مقابض شريط',
    'تقليل الحركات والانتقالات': 'حركة انيميشن بطيء اداء'
  };
  let setIndex = null, setBuilt = 0;
  function labelOf(row) {
    const l = row.querySelector('.lbl'); if (!l) return null;
    const c = l.cloneNode(true); c.querySelectorAll('small').forEach((s) => s.remove());
    const title = c.textContent.replace(/\s+/g, ' ').trim();
    const sm = l.querySelector('small');
    return { title, sub: sm ? sm.textContent.replace(/\s+/g, ' ').trim() : '' };
  }
  function buildSetIndex() {
    const out = [];
    [['main', $('settingsSheet')], ['adv', $('advancedSettingsSheet')]].forEach(([key, sheet]) => {
      if (!sheet) return;
      sheet.querySelectorAll('.settings-row').forEach((row) => {
        if (row.closest('.set-search, .set-search-res')) return;
        const lb = labelOf(row); if (!lb || !lb.title) return;
        const sec = row.closest('.set-sec');
        const st = sec ? sec.querySelector('.set-group-title, .settings-section-title') : null;
        const secTitle = st ? st.textContent.replace(/\s+/g, ' ').trim() : '';
        const ic = row.querySelector('.sl-ic i') || (st ? st.querySelector('i') : null);
        const sub = row.closest('.set-sub');
        let parentRow = null;
        if (sub && sub.dataset.for) { const t = $(sub.dataset.for); parentRow = t ? t.closest('.settings-row') : null; }
        const btns = Array.from(row.querySelectorAll('button')).map((b) => b.textContent.replace(/\s+/g, ' ').trim()).join(' ');
        const alias = Object.keys(ALIAS).find((k) => lb.title.indexOf(k) >= 0);
        out.push({
          key, row, title: lb.title, sub: lb.sub, sec: secTitle, icon: ic ? Array.from(ic.classList).find((c) => /^ti-/.test(c)) || 'ti-adjustments' : 'ti-adjustments',
          parentRow, hay: norm([lb.title, lb.sub, secTitle, btns, alias ? ALIAS[alias] : ''].join(' ')), nt: norm(lb.title)
        });
      });
    });
    setIndex = out; setBuilt = Date.now();
    return out;
  }
  function searchSettings(q) {
    const words = norm(q).split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    if (!setIndex || Date.now() - setBuilt > 20000) buildSetIndex();
    const res = [];
    setIndex.forEach((it) => {
      if (!it.row.isConnected) return;
      if (!words.every((w) => it.hay.indexOf(w) >= 0)) return;
      let score = 0;
      words.forEach((w) => { if (it.nt.indexOf(w) >= 0) score += 3; if (it.nt.indexOf(w) === 0) score += 1; });
      res.push({ it, score });
    });
    res.sort((a, b) => b.score - a.score);
    return res.map((r) => r.it);
  }
  function hl(text, words) { try { return highlightTermMulti(esc(text), words); } catch (e) { return esc(text); } }
  function flashRow(row) {
    row.classList.remove('set-flash'); void row.offsetWidth; row.classList.add('set-flash');
    setTimeout(() => row.classList.remove('set-flash'), 2600);
  }
  function gotoSetting(it) {
    const inMainNow = $('settingsOverlay').classList.contains('show'), inAdvNow = $('advancedSettingsOverlay').classList.contains('show');
    let target = it.row, note = '';
    if (it.parentRow && it.row.closest('.set-sub') && !it.row.closest('.set-sub').classList.contains('open')) {
      target = it.parentRow; const pl = labelOf(it.parentRow);
      note = 'يظهر هذا الخيار بعد تفعيل «' + (pl ? pl.title : '') + '»';
    }
    clearSetSearch();
    const needAdv = it.key === 'adv', needMain = it.key === 'main';
    let delay = 40;
    if (needAdv && !inAdvNow) { try { closeSettings(); } catch (e) {} try { openAdvancedSettings(); } catch (e) {} delay = 330; }
    else if (needMain && !inMainNow) { try { closeAdvancedSettings(); } catch (e) {} try { openSettings(); } catch (e) {} delay = 330; }
    setTimeout(() => {
      try { target.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { target.scrollIntoView(); }
      setTimeout(() => flashRow(target), 220);
      if (note) toast(note);
    }, delay);
  }
  function clearSetSearch() {
    document.querySelectorAll('.set-search input').forEach((i) => { i.value = ''; });
    document.querySelectorAll('.set-search-res').forEach((r) => { r.innerHTML = ''; });
    ['settingsSheet', 'advancedSettingsSheet'].forEach((id) => { const s = $(id); if (s) s.classList.remove('set-searching'); });
    document.querySelectorAll('.set-search').forEach((s) => s.classList.remove('has-q'));
  }
  function runSetSearch(box) {
    const inp = box.querySelector('input'), q = inp.value.trim();
    const sheet = box.closest('#settingsSheet, #advancedSettingsSheet'), res = sheet.querySelector('.set-search-res');
    box.classList.toggle('has-q', !!q);
    if (!q) { sheet.classList.remove('set-searching'); res.innerHTML = ''; return; }
    sheet.classList.add('set-searching');
    const words = norm(q).split(/\s+/).filter(Boolean);
    const list = searchSettings(q);
    if (!list.length) {
      res.innerHTML = '<div class="ssr-empty"><i class="ti ti-search-off"></i><div>لا إعداد بهذا الاسم</div><small>جرّب كلمة أقصر، مثل «خط» أو «ليلي» أو «سحب» أو «إشعار».</small></div>';
      return;
    }
    res.innerHTML = '<div class="ssr-count">' + arNum(list.length) + (list.length === 1 ? ' نتيجة' : (list.length === 2 ? ' نتيجتان' : (list.length <= 10 ? ' نتائج' : ' نتيجة'))) + '</div>' + list.slice(0, 40).map((it, i) => {
      const path = (it.key === 'adv' ? 'إعدادات إضافية › ' : '') + (it.sec || 'الإعدادات');
      return `<button type="button" class="ssr-row" data-i="${i}"><span class="ssr-ic"><i class="ti ${it.icon}"></i></span><span class="ssr-t"><b>${hl(it.title, words)}</b>${it.sub ? `<small>${hl(it.sub.length > 90 ? it.sub.slice(0, 88) + '…' : it.sub, words)}</small>` : ''}<em>${esc(path)}</em></span><i class="ti ti-chevron-left ssr-go"></i></button>`;
    }).join('');
    res._list = list;
  }
  function mountSetSearch() {
    [['settingsSheet', 'h3'], ['advancedSettingsSheet', 'h3']].forEach(([id]) => {
      const sheet = $(id); if (!sheet || sheet.querySelector('.set-search')) return;
      const h3 = sheet.querySelector('h3'); if (!h3) return;
      const box = document.createElement('div'); box.className = 'set-search';
      box.innerHTML = '<i class="ti ti-search ss-ic"></i><input type="text" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="ابحث في الإعدادات…" aria-label="بحث في الإعدادات"><button type="button" class="ss-x" aria-label="مسح"><i class="ti ti-x"></i></button>';
      const res = document.createElement('div'); res.className = 'set-search-res';
      h3.insertAdjacentElement('afterend', box); box.insertAdjacentElement('afterend', res);
      const inp = box.querySelector('input'); let t = 0;
      inp.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => runSetSearch(box), 90); });
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); const f = res.querySelector('.ssr-row'); if (f && res._list) gotoSetting(res._list[0]); } });
      box.querySelector('.ss-x').addEventListener('click', () => { inp.value = ''; runSetSearch(box); inp.focus(); });
      res.addEventListener('click', (e) => { const b = e.target.closest('.ssr-row'); if (!b || !res._list) return; gotoSetting(res._list[parseInt(b.dataset.i, 10)]); });
    });
  }
  function syncSearchTop() {
    ['settingsSheet', 'advancedSettingsSheet'].forEach((id) => {
      const sh = $(id), b = sh && sh.querySelector('.set-search'), h = sh && sh.querySelector('h3'); if (!b || !h) return;
      b.style.top = Math.max(0, h.offsetHeight - 18 + 4) + 'px';
    });
  }
  ['openSettings', 'openAdvancedSettings'].forEach((n) => {
    const f = window[n]; if (typeof f !== 'function') return;
    window[n] = function () { const r = f.apply(this, arguments); try { setIndex = null; setTimeout(syncSearchTop, 30); setTimeout(syncSearchTop, 400); } catch (e) {} return r; };
  });
  ['closeSettings', 'closeAdvancedSettings'].forEach((n) => {
    const f = window[n]; if (typeof f !== 'function') return;
    window[n] = function () { const r = f.apply(this, arguments); try { clearSetSearch(); } catch (e) {} return r; };
  });

  function sharhNums(bookId) {
    const s = new Set();
    try {
      if (bookId === SHARH_AWDAH_BOOK_ID) sharhAwdahIndex.forEach((v, k) => { if (k !== '0') s.add(k); });
      if (bookId === SHARH_MANHAJ_BOOK_ID) sharhManhajIndex.forEach((v, k) => s.add(k));
      sharhVideoIndex.forEach((v, k) => { const [b, n] = k.split('::'); if (parseInt(b, 10) === bookId) s.add(n); });
    } catch (e) {}
    return Array.from(s).sort((a, b) => parseFloat(a) - parseFloat(b));
  }
  function sharhBarHtml(num) {
    return `<div class="sharh-bar" role="toolbar" aria-label="أدوات الشرح">
      <button type="button" class="sb-x" data-sb="close" title="إغلاق الشرح والعودة إلى المسألة"><i class="ti ti-x"></i></button>
      <div class="sb-t"><span class="sb-n">شرح المسألة ${arNum(num)}</span><span class="sb-at"></span></div>
      <button type="button" class="sb-b" data-sb="prev" title="شرح المسألة السابقة"><i class="ti ti-chevron-right"></i></button>
      <button type="button" class="sb-b" data-sb="next" title="شرح المسألة التالية"><i class="ti ti-chevron-left"></i></button>
      <button type="button" class="sb-b" data-sb="up" title="إلى المسألة"><i class="ti ti-arrow-bar-up"></i></button>
      <i class="sb-prog"></i>
    </div>`;
  }
  function ensureSharhBar(acc) {
    return;
    if (!acc || acc.querySelector(':scope > .sharh-bar')) return;
    const m = (acc.id || '').match(/^sharh-chooser-(\d+)-(.+)$/); if (!m) return;
    acc.insertAdjacentHTML('afterbegin', sharhBarHtml(m[2]));
    acc.dataset.sec = m[1]; acc.dataset.num = m[2];
  }
  function blockOf(acc) { return acc.closest('.masala-block'); }
  function closeSharh(acc, toMasala) {
    acc.classList.remove('open'); document.body.classList.remove('sharh-reading');
    acc.querySelectorAll('.sharh-choice-detail.open').forEach((d) => d.classList.remove('open'));
    const b = blockOf(acc);
    if (toMasala && b) { b.style.scrollMarginTop = '84px'; try { b.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { b.scrollIntoView(true); } }
  }
  function sharhStep(acc, dir) {
    const sec = parseInt(acc.dataset.sec, 10), num = acc.dataset.num;
    const nums = sharhNums(currentBookId); const i = nums.indexOf(num);
    const next = nums[i + dir];
    if (next == null) { toast(dir > 0 ? 'هذا آخر شرح في الكتاب' : 'هذا أول شرح في الكتاب'); return; }
    const kind = acc.querySelector('.sharh-choice-detail.open') ? Array.from(acc.querySelectorAll('.sharh-choice-detail')).findIndex((d) => d.classList.contains('open')) : 0;
    closeSharh(acc, false);
    const open = () => {
      const blk = document.querySelector(`#readerPage .masala-block[data-masala="${next}"]`);
      if (!blk) return false;
      const sIdx = parseInt(blk.dataset.sectionIdx, 10);
      if (!blk.querySelector('.sharh-accordion')) return false;
      readerScrollToken++;
      toggleSharhChooser({ stopPropagation() {} }, sIdx, next);
      const nacc = $(`sharh-chooser-${sIdx}-${next}`);
      if (nacc) { setTimeout(() => { const btn = nacc.querySelectorAll('.sharh-choice-btn')[Math.max(0, Math.min(kind, nacc.querySelectorAll('.sharh-choice-btn').length - 1))]; if (btn) btn.click(); }, 60); }
      return true;
    };
    if (open()) return;
    try {
      const pats = getMarkerPatterns(currentBookId);
      for (let k = 0; k < currentSections.length; k++) {
        const parts = splitByMarker(currentSections[k].body, pats.src, pats.capture, currentBookId);
        if (parts.some((p) => { const mm = p.match(pats.capture); return mm && normalizeDigits(mm[1] || mm[2] || mm[3] || mm[4] || mm[5]) === next; })) {
          ensureSectionRendered(k); scrollToSection(k, { instant: true });
          setTimeout(() => { if (!open()) toast('تعذّر فتح الشرح التالي'); }, 380);
          return;
        }
      }
    } catch (e) {}
    toast('تعذّر فتح الشرح التالي');
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('.sharh-bar [data-sb]'); if (!b) return;
    e.stopPropagation();
    const acc = b.closest('.sharh-accordion'); const a = b.dataset.sb;
    if (a === 'close') closeSharh(acc, true);
    else if (a === 'up') { const bl = blockOf(acc); if (bl) { bl.style.scrollMarginTop = '84px'; bl.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }
    else sharhStep(acc, a === 'next' ? 1 : -1);
  }, true);
  ['toggleSharhChooser', 'selectSharhSource'].forEach((n) => {
    const f = window[n]; if (typeof f !== 'function') return;
    window[n] = function (evt, a, b) {
      const r = f.apply(this, arguments);
      try {
        const sec = n === 'toggleSharhChooser' ? a : b, num = n === 'toggleSharhChooser' ? b : arguments[3];
        const acc = $(`sharh-chooser-${sec}-${num}`);
        if (acc && acc.classList.contains('open')) {
          ensureSharhBar(acc);
          const open = acc.querySelector('.sharh-choice-detail.open');
          const lab = open ? open.parentElement.querySelector('.sharh-choice-btn span') : null;
          const at = acc.querySelector('.sb-at'); if (at) at.textContent = lab ? ' · ' + lab.textContent : '';
        }
      } catch (e) {}
      return r;
    };
  });

  function videosOfBook(bookId) {
    const seen = new Map();
    try {
      sharhVideoIndex.forEach((list, k) => {
        const [b] = k.split('::'); if (parseInt(b, 10) !== bookId) return;
        list.forEach((v) => { if (!seen.has(v.videoId)) seen.set(v.videoId, v); });
      });
    } catch (e) {}
    const arr = Array.from(seen.values());
    arr.sort((a, b) => (a.rangeStart - b.rangeStart) || (a.rangeEnd - b.rangeEnd) || String(a.channel).localeCompare(String(b.channel), 'ar'));
    return arr;
  }
  const rangeTxt = (v) => v.rangeStart === v.rangeEnd ? 'المسألة ' + arNum(v.rangeStart) : 'المسائل ' + arNum(v.rangeStart) + ' – ' + arNum(v.rangeEnd);
  function ensureVidSheet() {
    let o = $('sharhVidOverlay'); if (o) return o;
    o = document.createElement('div'); o.id = 'sharhVidOverlay';
    o.innerHTML = '<div class="svo-bg" onclick="RSV101.closeVideoSheet()"></div><div class="svo-panel" role="dialog" aria-label="شروح الفيديو"><div class="svo-grip"></div><div class="svo-head"><div class="svo-t"><i class="ti ti-player-play"></i><span id="svoTitle">شروح الفيديو</span></div><button type="button" class="svo-x" onclick="RSV101.closeVideoSheet()" aria-label="إغلاق"><i class="ti ti-x"></i></button></div><div class="svo-list" id="svoList"></div></div>';
    document.body.appendChild(o); return o;
  }
  RSV101.openVideoSheet = function (bookId, num) {
    const o = ensureVidSheet(), list = $('svoList');
    const vids = videosOfBook(bookId), n = parseFloat(num);
    const book = (typeof allBooks !== 'undefined' && allBooks.find((b) => b.id === bookId)) || null;
    $('svoTitle').textContent = 'شروح الفيديو' + (book ? ' · ' + book.name : '');
    let html = '', lastCh = null, i = 0, first = -1;
    vids.forEach((v) => {
      i++;
      if (v.channel !== lastCh) { lastCh = v.channel; html += `<div class="svo-ch"><i class="ti ti-brand-youtube"></i>${esc(v.channel)}</div>`; }
      const cur = n >= v.rangeStart && n <= v.rangeEnd;
      if (cur && first < 0) first = i;
      html += `<div class="svo-it${cur ? ' cur' : ''}" data-vid="${esc(v.videoId)}" id="svo-it-${i}"><button type="button" class="svo-b" onclick="RSV101.playVideo(this)"><span class="svo-n">${arNum(i)}</span><span class="svo-m"><b>${esc(v.title)}</b><small>${rangeTxt(v)}${cur ? '<em>هذه المسألة</em>' : ''}</small></span><i class="ti ti-chevron-down svo-c"></i></button><div class="svo-p"></div></div>`;
    });
    list.innerHTML = vids.length ? html : '<div class="svo-empty">لا توجد فيديوهات لهذا الكتاب.</div>';
    o.classList.add('show'); document.body.classList.add('svo-open');
    setTimeout(() => { const t = first > 0 ? $('svo-it-' + first) : null; if (t) list.scrollTop = Math.max(0, t.offsetTop - 70); }, 60);
  };
  RSV101.closeVideoSheet = function () {
    const o = $('sharhVidOverlay'); if (!o) return;
    o.classList.remove('show'); document.body.classList.remove('svo-open');
    setTimeout(() => { o.querySelectorAll('.svo-p').forEach((p) => { p.innerHTML = ''; }); o.querySelectorAll('.svo-it.open').forEach((e) => e.classList.remove('open')); }, 260);
  };
  RSV101.playVideo = function (btn) {
    const it = btn.closest('.svo-it'), p = it.querySelector('.svo-p');
    const was = it.classList.contains('open');
    document.querySelectorAll('#svoList .svo-it.open').forEach((e) => { e.classList.remove('open'); e.querySelector('.svo-p').innerHTML = ''; });
    if (was) return;
    p.innerHTML = `<div class="sharh-video-frame"><iframe src="https://www.youtube-nocookie.com/embed/${esc(it.dataset.vid)}" title="شرح" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`;
    it.classList.add('open');
    setTimeout(() => { const l = $('svoList'); l.scrollTop = Math.max(0, it.offsetTop - 70); }, 80);
  };
  (function () {
    const f = window.renderSharhChooserHtml; if (typeof f !== 'function') return;
    window.renderSharhChooserHtml = function (sources, bookId, sectionIdx, num) {
      const vids = sources.filter((x) => x.type === 'video'), rest = sources.filter((x) => x.type !== 'video');
      if (!vids.length) return f.apply(this, arguments);
      let html = rest.length ? f.call(this, rest, bookId, sectionIdx, num) : '';
      const btn = `<div class="sharh-choice-item"><button class="sharh-choice-btn svo-open-btn" onclick="event.stopPropagation();RSV101.openVideoSheet(${bookId},'${num}')"><i class="ti ti-player-play"></i><span>شروح الفيديو (${arNum(videosOfBook(bookId).length)}) — اختر الفيديو من القائمة</span><i class="ti ti-list-details svo-ico"></i></button></div>`;
      if (!rest.length) return `<div class="sharh-acc-title"><i class="ti ti-notebook"></i> شروحات هذه المسألة</div><div class="sharh-choice-list">${btn}</div>`;
      return html.replace(/<\/div>\s*$/, btn + '</div>');
    };
  })();

  (function () {
    let span = null;
    function findSpan() {
      const c = $('content'), rp = $('readerPage');
      if (!c || !rp || !rp.classList.contains('active')) return null;
      const cr = c.getBoundingClientRect(), mid = cr.top + c.clientHeight * 0.35;
      const list = rp.querySelectorAll('.sharh-accordion.open');
      for (let i = 0; i < list.length; i++) {
        const r = list[i].getBoundingClientRect();
        if (r.height > c.clientHeight * 1.3 && r.top <= mid && r.bottom >= mid) return list[i];
      }
      return null;
    }
    const k0 = window.extScrollKind, b0 = window.extScrollBounds, l0 = window.extScrollLabel;
    if (typeof k0 === 'function') window.extScrollKind = function () {
      const k = k0.apply(this, arguments);
      if (k !== 'book') { span = null; return k; }
      span = findSpan();
      return span ? 'cmp' : k;
    };
    if (typeof b0 === 'function') window.extScrollBounds = function (kind, content) {
      if (kind === 'cmp' && span && span.isConnected) {
        const cr = content.getBoundingClientRect(), r = span.getBoundingClientRect();
        const top = r.top - cr.top + content.scrollTop;
        return { top, bottom: top + r.height };
      }
      return b0.apply(this, arguments);
    };
    if (typeof l0 === 'function') window.extScrollLabel = function (kind) {
      if (kind === 'cmp' && span && span.isConnected) return 'شرح المسألة ' + arNum(span.dataset.num || (span.id.match(/-(\d+(?:\.\d+)?)$/) || [])[1] || '');
      return l0.apply(this, arguments);
    };
  })();

  (function () {
    let raf = 0;
    const update = () => {
      raf = 0;
      const c = $('content'); if (!c) return;
      let covering = false;
      document.querySelectorAll('#readerPage .sharh-accordion.open').forEach((acc) => {
        { const r0 = acc.getBoundingClientRect(), c0 = c.getBoundingClientRect(); if (r0.top < c0.top + 10 && r0.bottom > c0.top + 70) covering = true; }
        const bar = acc.querySelector(':scope > .sharh-bar'); if (!bar) return;
        const r = acc.getBoundingClientRect(), cr = c.getBoundingClientRect();
        const total = Math.max(1, r.height - 120), seen = Math.min(total, Math.max(0, cr.top + 70 - r.top));
        const pr = bar.querySelector('.sb-prog'); if (pr) pr.style.transform = 'scaleX(' + (seen / total).toFixed(3) + ')';
      });
      document.body.classList.toggle('sharh-reading', covering);
    };
    document.addEventListener('DOMContentLoaded', () => {
      const c = $('content'); if (!c) return;
      c.addEventListener('scroll', () => { if (!raf && (document.body.classList.contains('sharh-reading') || document.querySelector('#readerPage .sharh-accordion.open'))) raf = requestAnimationFrame(update); }, { passive: true });
    });
  })();

  const jamiOn = () => { const p = $('comparisonPage'); return !!(p && p.classList.contains('active')); };
  const CMP_STATE = { q: '', scope: 'both', schs: [], shown: 40, scroll: 0 };
  RSV101.cmpState = CMP_STATE;

  function stickyInset() {
    const s = document.querySelector('#comparisonPage .cmp-sticky'), c = $('content'); if (!s || !c) return 0;
    const hc = parseFloat(s.style.getPropertyValue('--cmp-hc')) || 0;
    return Math.max(0, s.offsetHeight - hc);
  }
  function jamiAnchor() {
    const root = document.querySelector('#comparisonPage .cmp-answers-list'), c = $('content'); if (!root || !c) return null;
    const inset = stickyInset(), a = RSAnchor.capture(root, c, inset);
    return a ? { ch: a.ch, dy: Math.round((a.dy - inset) * 10) / 10 } : null;
  }
  function jamiRestore(a, tries) {
    if (!a || typeof a.ch !== 'number') return;
    const c = $('content');
    let n = 0;
    const step = () => { const r = document.querySelector('#comparisonPage .cmp-answers-list'); if (r) RSAnchor.restore(r, c, a.ch, (a.dy || 0) + stickyInset()); };
    let touched = false; const stop = () => { touched = true; };
    ['touchstart', 'wheel', 'mousedown'].forEach((ev) => c.addEventListener(ev, stop, { once: true, passive: true }));
    const loop = () => { if (touched) return; step(); if (++n < (tries || 6)) setTimeout(() => requestAnimationFrame(loop), 130); };
    loop();
    try { if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!touched) step(); }); } catch (e) {}
  }

  RSV101.jamiAnchor = jamiAnchor; RSV101.jamiRestore = jamiRestore;
  (function () {
    const ms = window.cmpMemorySave, mr = window.cmpMemoryRestore;
    if (typeof ms === 'function') window.cmpMemorySave = function (st) {
      const r = ms.apply(this, arguments);
      try {
        if (cmpNav.level === 'compare' && typeof st === 'number' && st > 0) {
          const rec = cmpMemoryLoad(); const a = jamiAnchor();
          if (rec && a) { rec.a = a; localStorage.setItem(CMP_MEMORY_KEY, JSON.stringify(rec)); }
        }
      } catch (e) {}
      return r;
    };
    if (typeof mr === 'function') window.cmpMemoryRestore = function () {
      const m = cmpMemoryLoad();
      const r = mr.apply(this, arguments);
      try { if (m && m.level === 'compare' && m.a) setTimeout(() => jamiRestore(m.a, 6), 120); } catch (e) {}
      return r;
    };
  })();

  function jamiText() {
    const page = $('comparisonPage');
    const name = (page.querySelector('.cmp-nav-name') || {}).textContent || '';
    const q = (page.querySelector('.cmp-question-text') || {}).textContent || '';
    const parts = [name.trim(), '', 'السؤال: ' + q.trim(), ''];
    page.querySelectorAll('.cmp-answer-card').forEach((c) => {
      const n = (c.querySelector('.cmp-answer-scholar') || {}).textContent || '';
      const t = (c.querySelector('.cmp-answer-text') || {}).textContent || '';
      parts.push('▪ ' + n.trim() + ':', t.trim(), '');
    });
    parts.push('— جامع الاستفتاءات · تطبيق مشكاة الفقه');
    return parts.join('\n');
  }
  function copyText(t) {
    try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(t); return true; } } catch (e) {}
    try { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); return true; } catch (e) { return false; }
  }
  function augmentCompare() {
    const page = $('comparisonPage');
    if (!page || !page.classList.contains('active') || cmpNav.level !== 'compare') return;
    const list = page.querySelector('.cmp-answers-list'); if (!list) return;
    if (!page.querySelector('.cmp-tools2')) {
      const cards = Array.from(list.querySelectorAll('.cmp-answer-card'));
      const chips = cards.map((c) => `<button type="button" class="cmp-chip${c.classList.contains('cmp-fav-card') ? ' fav' : ''}" data-sch="${c.dataset.sch}">${esc(((c.querySelector('.cmp-answer-scholar') || {}).textContent || '').trim())}</button>`).join('');
      const html = `<div class="cmp-tools2">
        ${cards.length > 1 ? `<div class="cmp-chips" aria-label="انتقال سريع إلى رأي مرجع">${chips}</div>` : ''}
        </div>`;
      list.insertAdjacentHTML('beforebegin', html);
    }
    const back = page.querySelector('.cmp-back-row');
    if (back && window.cmpCtx && window.cmpCtx.ids) {
      back.innerHTML = '<i class="ti ti-chevron-right"></i> نتائج البحث في الجامع';
      back.onclick = () => RSV101.backToCmpSearch();
    }
    const nm = page.querySelector('.cmp-nav-name'); if (nm && !nm.dataset.b) { nm.dataset.b = '1'; nm.style.cursor = 'pointer'; nm.addEventListener('click', () => { try { RSV81.openJamiToc(); } catch (e) {} }); }
    if (window.cmpCtx && window.cmpCtx.term && !window.cmpCtx.painted) {
      window.cmpCtx.painted = window.cmpCtx.ids[window.cmpCtx.index];
    }
    if (window.cmpCtx && window.cmpCtx.term && window.cmpCtx.paintFor !== cmpNav.subjectId) {
      window.cmpCtx.paintFor = cmpNav.subjectId;
      try { pendingSearchTerm = window.cmpCtx.term; applyPendingSearchHighlight(undefined, page.querySelector('.cmp-answers-list')); pendingSearchTerm = null; } catch (e) {}
    }
  }
  function cmpSearchHtml() {
    return `<div class="cmp-search" id="cmpSearch">
      <div class="cs-row"><i class="ti ti-search cs-ic"></i><input type="text" id="cmpSearchInput" enterkeyhint="search" autocomplete="off" spellcheck="false" placeholder="ابحث في الجامع: مسألة أو حكم أو كلمة…" aria-label="بحث في جامع الاستفتاءات"><button type="button" class="cs-x" aria-label="مسح"><i class="ti ti-x"></i></button></div>
      <div class="cs-opts">
        <div class="cs-scope" role="group" aria-label="مكان البحث">
          <button type="button" data-sc="both">الكل</button><button type="button" data-sc="titles">العناوين</button><button type="button" data-sc="body">الأسئلة والأجوبة</button>
        </div>
        <div class="cs-sel" role="button" tabindex="0" aria-haspopup="listbox" aria-label="المرجع"><select id="cmpSearchSch" aria-hidden="true" tabindex="-1"><option>كل المراجع</option></select><i class="ti ti-chevron-down"></i></div>
      </div>
      <div id="cmpSearchRes" class="cmp-res-box"></div>
    </div>`;
  }
  function mountCmpSearch() {
    const page = $('comparisonPage');
    if (!page || !page.classList.contains('active') || cmpNav.level === 'compare') return;
    if (page.querySelector('#cmpSearch')) return;
    const anchor = page.querySelector('.jami-credit') || null;
    if (anchor) anchor.insertAdjacentHTML('afterend', cmpSearchHtml()); else page.insertAdjacentHTML('afterbegin', cmpSearchHtml());
    const inp = $('cmpSearchInput');
    inp.value = CMP_STATE.q;
    syncScope();
    syncScholarLabel();
    if (CMP_STATE.q) runCmpSearch(true);
  }
  function syncScope() {
    document.querySelectorAll('#cmpSearch .cs-scope button').forEach((b) => b.classList.toggle('on', b.dataset.sc === CMP_STATE.scope));
  }
  let cmpResults = [];
  function snippetOf(text, words) {
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    if (t.length <= 150) return t;
    let pos = -1;
    for (const w of words) {
      if (!w) continue;
      const pat = w.split('').map((ch) => ('أإآا'.includes(ch) ? '[أإآا]' : ('ةه'.includes(ch) ? '[ةه]' : ((ch === 'ى' || ch === 'ي') ? '[ىي]' : ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))))).join('[\\u064B-\\u065F\\u0670]*');
      try { const m = new RegExp(pat).exec(t); if (m) { pos = m.index; break; } } catch (e) {}
    }
    if (pos < 0) return t.slice(0, 140) + '…';
    const s = Math.max(0, pos - 55), e = Math.min(t.length, pos + 105);
    return (s > 0 ? '… ' : '') + t.slice(s, e) + (e < t.length ? ' …' : '');
  }
  function runCmpSearch(keepScroll) {
    const box = $('cmpSearchRes'), page = $('comparisonPage'); if (!box) return;
    const q = CMP_STATE.q.trim();
    page.classList.toggle('cmp-searching', !!q);
    $('cmpSearch').classList.toggle('has-q', !!q);
    if (!q) { box.innerHTML = ''; cmpResults = []; return; }
    const nq = norm(q), words = nq.split(/\s+/).filter(Boolean);
    let res = [];
    try {
      const filt = CMP_STATE.schs.length ? new Set(CMP_STATE.schs.map((x) => parseInt(x, 10))) : null;
      res = searchCmpData(nq, words, 'scattered', filt, CMP_STATE.scope);
    } catch (e) { console.warn('cmp search', e); }
    cmpResults = res;
    const shown = Math.min(res.length, CMP_STATE.shown);
    if (!res.length) {
      box.innerHTML = '<div class="cmp-empty"><i class="ti ti-search-off"></i><div>لا نتائج في الجامع</div><small>جرّب كلمات أقل، أو اجعل البحث «الكل» وكل المراجع.</small></div>';
      return;
    }
    let h = `<div class="crb-count">${arNum(res.length)} ${res.length === 1 ? 'مسألة' : (res.length === 2 ? 'مسألتان' : (res.length <= 10 ? 'مسائل' : 'مسألة'))}</div>`;
    for (let i = 0; i < shown; i++) {
      const r = res[i];
      const chap = (r.bookName || '').replace(/^جامع الاستفتاءات\s*—?\s*/, '');
      let by = '';
      try { if (r.cmpScholarId != null) { const s = loadCmpData().scholarById.get(r.cmpScholarId); if (s) by = 'رأي ' + s.name; } } catch (e) {}
      const fav = (r.cmpFavNames && r.cmpFavNames.length) ? `<span class="crb-fav"><i class="ti ti-star-filled"></i> ${esc(r.cmpFavNames.slice(0, 2).join('، '))}</span>` : '';
      h += `<div class="cmp-res" data-i="${i}" role="button" tabindex="0"><div class="cr-top"><span class="cr-chap">${esc(chap)}</span>${fav}</div><div class="cr-title">${hl(r.title, words)}</div><div class="cr-snip">${hl(snippetOf(r.body, words), words)}</div>${by ? `<div class="cr-by">${esc(by)}</div>` : ''}</div>`;
    }
    if (shown < res.length) h += `<button type="button" class="cmp-more" data-more="1">عرض ${arNum(Math.min(40, res.length - shown))} نتيجة أخرى</button>`;
    box.innerHTML = h;
    if (!keepScroll) { }
  }
  RSV101.openCmpResult = function (i) {
    const r = cmpResults[i]; if (!r) return;
    CMP_STATE.scroll = $('content').scrollTop;
    window.cmpCtx = { ids: cmpResults.map((x) => x.cmpSubjectId), index: i, term: CMP_STATE.q.trim() };
    window.__cmpKeepCtx = true;
    renderCmpComparisonView(r.cmpSubjectId);
    try {
      const page = $('comparisonPage'); const card = r.cmpScholarId != null ? page.querySelector(`.cmp-answer-card[data-sch="${r.cmpScholarId}"]`) : null;
      if (card) card.classList.add('open');
    } catch (e) {}
  };
  RSV101.backToCmpSearch = function () {
    window.cmpCtx = null;
    renderCmpChaptersList();
    const y = CMP_STATE.scroll || 0;
    [0, 60, 200, 450].forEach((ms) => setTimeout(() => { $('content').scrollTop = y; }, ms));
  };
  document.addEventListener('input', (e) => {
    if (e.target && e.target.id === 'cmpSearchInput') {
      CMP_STATE.q = e.target.value; CMP_STATE.shown = 40;
      clearTimeout(RSV101._cst); RSV101._cst = setTimeout(() => runCmpSearch(), 160);
    }
  });
  const scholarOptions = () => (typeof cmpOrderedScholars === 'function' ? cmpOrderedScholars() : []);
  function syncScholarLabel() {
    const sel = $('cmpSearchSch'); if (!sel) return;
    const names = scholarOptions().filter((s) => CMP_STATE.schs.includes(String(s.id))).map((s) => s.name);
    const label = !names.length ? 'كل المراجع' : (names.length === 1 ? names[0] : `${arNum(names.length)} مراجع`);
    sel.innerHTML = `<option>${esc(label)}</option>`;
  }
  function openSchPicker() {
    if (!window.RSUI || !RSUI.pickMany) return;
    RSUI.pickMany({
      title: 'المراجع',
      values: CMP_STATE.schs,
      items: scholarOptions().map((s) => ({ value: String(s.id), label: s.name })),
      onPick: (vals) => {
        CMP_STATE.schs = vals;
        CMP_STATE.shown = 40;
        syncScholarLabel();
        runCmpSearch();
      }
    });
  }
  document.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('#cmpSearch .cs-sel'); if (b) { e.preventDefault(); openSchPicker(); } });
  document.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('#cmpSearch .cs-sel')) { e.preventDefault(); openSchPicker(); } });
  document.addEventListener('keydown', (e) => { if (e.target && e.target.id === 'cmpSearchInput' && e.key === 'Enter') { e.preventDefault(); e.target.blur(); runCmpSearch(); } });
  document.addEventListener('click', (e) => {
    const t = e.target; if (!t.closest) return;
    const sc = t.closest('#cmpSearch .cs-scope button'); if (sc) { CMP_STATE.scope = sc.dataset.sc; CMP_STATE.shown = 40; syncScope(); runCmpSearch(); return; }
    if (t.closest('#cmpSearch .cs-x')) { CMP_STATE.q = ''; $('cmpSearchInput').value = ''; runCmpSearch(); $('cmpSearchInput').focus(); return; }
    const more = t.closest('#cmpSearchRes .cmp-more'); if (more) { CMP_STATE.shown += 40; runCmpSearch(true); return; }
    const res = t.closest('#cmpSearchRes .cmp-res'); if (res) RSV101.openCmpResult(parseInt(res.dataset.i, 10));
  });
  document.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('cmp-res')) { e.preventDefault(); RSV101.openCmpResult(parseInt(e.target.dataset.i, 10)); } });

  ['renderCmpChaptersList', 'openCmpChapter', 'renderCmpComparisonView'].forEach((n) => {
    const f = window[n]; if (typeof f !== 'function') return;
    window[n] = function () {
      const r = f.apply(this, arguments);
      try { if (n === 'renderCmpComparisonView') augmentCompare(); else mountCmpSearch(); } catch (e) { console.warn('v101 cmp', e); }
      return r;
    };
  });

  const JPOS = 'rs_cmp_pos', JTRACK = 'rs_cmp_track';
  const jpos = () => { try { return JSON.parse(lsGet(JPOS, 'null')); } catch (e) { return null; } };
  function saveJami(withAnchor) {
    try {
      if (cmpNav.level !== 'compare') {
        const r0 = { lvl: cmpNav.level, ch: cmpNav.chapterId, name: 'جامع الاستفتاءات', at: Date.now(), st: $('content').scrollTop };
        lsSet(JPOS, JSON.stringify(r0)); return true;
      }
      const sj = loadCmpData().subjectsById.get(cmpNav.subjectId); if (!sj) return false;
      const rec = { id: cmpNav.subjectId, name: sj.name, at: Date.now() };
      if (withAnchor) { const a = jamiAnchor(); if (a) rec.a = a; rec.st = $('content').scrollTop; }
      lsSet(JPOS, JSON.stringify(rec)); return true;
    } catch (e) { return false; }
  }
  RSV101.gotoJamiPos = function (jp) {
    jp = jp || jpos(); if (!jp) return;
    try { closeMiniMenu(); } catch (e) {}
    try { closeSavedPositionsList(); } catch (e) {}
    try {
      if (!jamiOn()) showTab('comparison');
      if (jp.lvl === 'chapters') renderCmpChaptersList();
      else if (jp.lvl === 'subjects' && jp.ch != null) openCmpChapter(jp.ch);
      else renderCmpComparisonView(jp.id);
    } catch (e) {}
    if (jp.a) setTimeout(() => jamiRestore(jp.a, 7), 140);
    else if (jp.st) setTimeout(() => { $('content').scrollTop = jp.st; }, 140);
  };
  RSV101.saveJamiHere = function () { saveJami(true); syncPinState(); };
  RSV101.enableJamiTrack = function () {
    const was = lsGet(JTRACK, '') === '1';
    lsSet(JTRACK, '1'); saveJami(true);
    const btn = $('readerFabPosition');
    if (btn) { btn.classList.add('just-saved', 'tracked'); try { navigator.vibrate && navigator.vibrate(15); } catch (e) {} setTimeout(() => btn.classList.remove('just-saved'), 900); }
    toast(was ? 'تم تحديث الموقع المحفوظ' : 'سيتم تتبع الموقع في جامع الاستفتاءات');
  };
  RSV101.stopJamiTrack = function () {
    lsSet(JTRACK, '0'); try { localStorage.removeItem(JPOS); } catch (e) {} syncPinState();
  };
  function syncPinState() {
    const b = $('readerFabPosition'); if (!b || !jamiOn()) return;
    b.classList.toggle('tracked', lsGet(JTRACK, '') === '1');
  }
  (function () {
    const f = window.updateReaderFabState; if (typeof f !== 'function') return;
    window.updateReaderFabState = function () { const r = f.apply(this, arguments); try { syncPinState(); } catch (e) {} return r; };
  })();
  let pc = 0, pt = 0;
  const _pbc = window.handlePositionBtnClick;
  window.handlePositionBtnClick = function () {
    if (!jamiOn()) return _pbc.apply(this, arguments);
    pc++;
    if (pc === 1) { pt = setTimeout(() => { pc = 0; try { openSavedPositionsList(); } catch (e) {} }, 350); }
    else { clearTimeout(pt); pc = 0; RSV101.enableJamiTrack(); }
  };
  (function () {
    let t = 0;
    document.addEventListener('DOMContentLoaded', () => {
      const c = $('content'); if (!c) return;
      c.addEventListener('scroll', () => {
        if (!jamiOn() || lsGet(JTRACK, '') !== '1') return;
        clearTimeout(t); t = setTimeout(() => saveJami(true), 500);
      }, { passive: true });
    });
    setInterval(syncPinState, 700);
  })();
  const _osp = window.openSavedPositionsList;
  if (typeof _osp === 'function') window.openSavedPositionsList = function () {
    const r = _osp.apply(this, arguments);
    try { const row = $('savedPositionsList').querySelector('.saved-pos-row .saved-pos-book');
      document.querySelectorAll('#savedPositionsList .saved-pos-row').forEach((el) => {
        const b = el.querySelector('.saved-pos-book'); if (b && b.textContent.trim() === 'جامع الاستفتاءات') {
          el.onclick = () => RSV101.gotoJamiPos();
          let lt = 0; const st = () => { clearTimeout(lt); lt = setTimeout(() => { try { navigator.vibrate && navigator.vibrate(15); } catch (e) {} openConfirmDialog('إيقاف تتبّع «جامع الاستفتاءات»؟ سيُحذف موقعه المحفوظ.', () => { RSV101.stopJamiTrack(); openSavedPositionsList(); }); }, 550); }, en = () => clearTimeout(lt);
          el.addEventListener('touchstart', st, { passive: true }); el.addEventListener('touchend', en); el.addEventListener('touchmove', en); el.addEventListener('mousedown', st); el.addEventListener('mouseup', en); el.addEventListener('mouseleave', en);
        }
      });
    } catch (e) {}
    return r;
  };

  const TG_KEY = 'rs_tg_notice', ACT_KEY = 'rs_active_sec';
  const TG_AFTER = 3600;
  function tgState() { try { return JSON.parse(lsGet(TG_KEY, '{}')) || {}; } catch (e) { return {}; } }
  function tgSave(s) { lsSet(TG_KEY, JSON.stringify(s)); }
  let tgEl = null, tgTimer = 0;
  function tgShouldShow() {
    if (embedded()) return false;
    const st = tgState(); if (st.joined) return false;
    const act = parseInt(lsGet(ACT_KEY, '0'), 10) || 0;
    if (!st.shown) return act >= TG_AFTER;
    if (st.shown >= 2) return false;
    return act >= (st.atAct || 0) + 3600 * 6 && Date.now() - (st.last || 0) > 21 * 864e5;
  }
  function busy() {
    if (document.hidden) return true;
    if (window.__rsPinching || window.__rsSelBusy) return true;
    if (document.querySelector('.overlay.show, .rs-sheet-ov.show, #settingsOverlay.show, #advancedSettingsOverlay.show, #tocOverlay.show, #miniMenuOverlay.show, #noteEditorOverlay.show, #textPromptOverlay.show, #splitViewShell.show, .rs-ov.show, #loadingScreen:not([style*="none"])')) return true;
    try { const gs = window.getSelection(); if (gs && !gs.isCollapsed && String(gs).trim()) return true; } catch (e) {}
    if (document.querySelector('.rs-tip.show, .rs-nudge.show, #hintTip.show, #csBar.show')) return true;
    if (Date.now() - (window.__rsLastTouch || 0) < 3500) return true;
    const ae = document.activeElement; if (ae && /^(INPUT|TEXTAREA)$/.test(ae.tagName)) return true;
    return false;
  }
  document.addEventListener('touchstart', () => { window.__rsLastTouch = Date.now(); }, { passive: true, capture: true });
  RSV101.showTelegram = function (force) {
    if (tgEl && tgEl.isConnected) return;
    const el = document.createElement('div');
    el.id = 'tgNotice'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'قناة التليجرام');
    el.innerHTML = `<div class="tg-card">
        <div class="tg-fly" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M21.6 3.4 2.9 10.6c-1.3.5-1.3 1.2-.2 1.5l4.8 1.5 1.8 5.6c.2.6.1.8.7.8.5 0 .7-.2 1-.5l2.4-2.3 4.9 3.6c.9.5 1.5.2 1.7-.8l3.2-15.1c.3-1.2-.5-1.8-1.6-1.3zM8.6 13.2l9.8-6.2c.5-.3.9-.1.5.2l-8.1 7.3-.3 3.4-1.9-4.7z"/></svg></div>
        <div class="tg-txt"><b>انضمّ إلى قناتنا في تيليجرام</b><span>جديد التطبيق، مسائل مختارة، وما يفيدك في فقهك — بلا إزعاج.</span></div>
        <div class="tg-btns"><button type="button" class="tg-join"><i class="ti ti-brand-telegram"></i> انضمام</button><button type="button" class="tg-later">لاحقاً</button></div>
        <button type="button" class="tg-x" aria-label="إغلاق"><i class="ti ti-x"></i></button>
        <i class="tg-prog"></i>
      </div>`;
    document.body.appendChild(el); tgEl = el;
    const st = tgState();
    if (!force) { st.shown = (st.shown || 0) + 1; st.last = Date.now(); st.atAct = parseInt(lsGet(ACT_KEY, '0'), 10) || 0; tgSave(st); }
    const close = (joined) => {
      clearTimeout(tgTimer);
      el.classList.remove('in'); el.classList.add('out');
      setTimeout(() => { el.remove(); if (tgEl === el) tgEl = null; }, 520);
      if (joined && !force) { const s = tgState(); s.joined = true; tgSave(s); }
    };
    el.querySelector('.tg-join').onclick = () => { try { window.open(TG_URL, '_blank', 'noopener'); } catch (e) { location.href = TG_URL; } close(true); };
    el.querySelector('.tg-later').onclick = () => close(false);
    el.querySelector('.tg-x').onclick = () => close(false);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));
    const prog = el.querySelector('.tg-prog'); prog.style.animationDuration = '18s';
    let left = 18000, t0 = Date.now();
    const arm = () => { clearTimeout(tgTimer); t0 = Date.now(); prog.style.animationPlayState = 'running'; tgTimer = setTimeout(() => close(false), left); };
    el.addEventListener('touchstart', () => { left = Math.max(4000, left - (Date.now() - t0)); clearTimeout(tgTimer); prog.style.animationPlayState = 'paused'; }, { passive: true });
    el.addEventListener('touchend', () => { arm(); }, { passive: true });
    arm();
  };
  (function () {
    if (embedded()) return;
    let acc = parseInt(lsGet(ACT_KEY, '0'), 10) || 0;
    setInterval(() => {
      if (document.hidden || Date.now() - (window.__rsLastTouch || Date.now()) > 120000 && !document.querySelector('#autoScrollBar.show')) return;
      acc += 15; if (acc % 60 === 0 || acc % 15 === 0) lsSet(ACT_KEY, String(acc));
      if (tgShouldShow() && !busy() && !(tgEl && tgEl.isConnected)) RSV101.showTelegram();
    }, 15000);
    window.__rsLastTouch = Date.now();
  })();

  function init() {
    try { mountSetSearch(); } catch (e) { console.warn('settings search', e); }
    document.body.classList.add('v101');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
