(function () {
  'use strict';
  const RSUI = window.RSUI = {};
  const $ = (id) => document.getElementById(id);
  const AR = '٠١٢٣٤٥٦٧٨٩';
  const ar = RSUI.ar = (n) => String(n).replace(/\d/g, (d) => AR[d]);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const toast = (m) => { try { if (typeof showGenericToast === 'function') showGenericToast(m); } catch (e) {} };

  const CLOSERS = {
    settingsOverlay: 'closeSettings', advancedSettingsOverlay: 'closeAdvancedSettings', helpOverlay: 'closeHelp', aboutOverlay: 'closeAbout',
    glossaryOverlay: 'closeGlossaryPopup', juristSettingsOverlay: 'closeJuristSettingsPanel', thamraJuristSettingsOverlay: 'closeThamraJuristSettingsPanel',
    cmpScholarSettingsOverlay: 'closeCmpScholarSettingsPanel', pinPickerOverlay: 'closePinPicker', colMemberPickerOverlay: 'closeCollectionMemberPicker',
    cbPickerOverlay: 'closeCbPicker', savedPositionsOverlay: 'closeSavedPositionsList', officialSitesOverlay: 'closeOfficialSitesSheet'
  };
  RSUI.xBtn = () => '<button type="button" class="sx" aria-label="إغلاق" title="إغلاق" onclick="RSUI.closeSheet(this)"></button>';
  RSUI.closeSheet = function (btn) {
    const ov = btn.closest('.rs-ov, .rs-sheet-ov, [id$="Overlay"]');
    if (!ov) return;
    const fn = CLOSERS[ov.id];
    if (fn && typeof window[fn] === 'function') window[fn](); else ov.classList.remove('show');
  };
  RSUI.mountSheetClose = function () {
    ['settingsSheet', 'juristSettingsSheet', 'thamraJuristSettingsSheet', 'cmpScholarSettingsSheet', 'pinPickerSheet', 'colMemberPickerSheet', 'cbPickerSheet', 'savedPositionsSheet']
      .forEach((id) => { const s = $(id); if (s && !s.querySelector(':scope > .sx')) s.insertAdjacentHTML('afterbegin', RSUI.xBtn()); });
    const adv = $('advancedSettingsSheet');
    if (adv) { const h = adv.querySelector('h3'); if (h && !h.querySelector('.sx')) h.insertAdjacentHTML('beforeend', RSUI.xBtn()); }
  };

  function makeOverlay(id, cancelFn) {
    let ov = $(id);
    if (ov) return ov;
    ov = document.createElement('div');
    ov.id = id; ov.className = 'rs-ov';
    ov.addEventListener('click', (e) => { if (e.target === ov) cancelFn(); });
    document.body.appendChild(ov);
    return ov;
  }
  const closers = {};
  RSUI.closeAll = function () {
    let any = false;
    ['rsTimeOv', 'rsDtOv', 'rsColorOv', 'rsConfirmOv', 'rsInstallOv'].forEach((id) => { const o = $(id); if (o && o.classList.contains('show')) { any = true; if (closers[id]) closers[id](); else o.classList.remove('show'); } });
    return any;
  };

  RSUI.confirm = function (o) {
    const ov = makeOverlay('rsConfirmOv', () => cancel());
    const cancel = closers.rsConfirmOv = () => { ov.classList.remove('show'); if (o.onNo) o.onNo(); };
    ov.style.alignItems = 'center'; ov.style.padding = '20px';
    ov.innerHTML = `<div class="rs-pop" style="border-radius:18px;max-width:380px;padding-top:20px">
      ${o.title ? `<h3 style="padding:0;text-align:center">${esc(o.title)}</h3>` : ''}
      <p style="margin:0 0 16px;text-align:center;line-height:1.9;font-size:14.5px">${esc(o.msg || '')}</p>
      <div class="rs-actions"><button class="ok" id="rsConfirmYes" style="${o.danger ? 'background:#c0392b;color:#fff' : ''}">${esc(o.yes || 'موافق')}</button><button class="no" id="rsConfirmNo">${esc(o.no || 'إلغاء')}</button></div></div>`;
    $('rsConfirmYes').onclick = () => { ov.classList.remove('show'); if (o.onYes) o.onYes(); };
    $('rsConfirmNo').onclick = cancel;
    ov.classList.add('show');
  };

  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  function hsv2rgb(h, s, v) {
    const f = (n) => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
    return [f(5), f(3), f(1)].map((x) => Math.round(x * 255));
  }
  function rgb2hsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0;
    if (d) { if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
    return [h, mx ? d / mx : 0, mx];
  }
  const toHex = (rgb) => '#' + rgb.map((x) => x.toString(16).padStart(2, '0')).join('');
  function parseHex(s) {
    s = String(s || '').trim().replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(s)) s = s.split('').map((c) => c + c).join('');
    if (!/^[0-9a-f]{6}$/i.test(s)) return null;
    return [0, 2, 4].map((i) => parseInt(s.substr(i, 2), 16));
  }
  RSUI.pickColor = function (o) {
    o = o || {};
    const ov = makeOverlay('rsColorOv', () => cancel());
    let done = false;
    const cancel = closers.rsColorOv = () => { if (done) return; done = true; ov.classList.remove('show'); if (o.onCancel) o.onCancel(); };
    const presets = (o.presets || ['#C0502A', '#D9A441', '#2F8F5B', '#2F6FB5', '#7A4FB8', '#C2476B', '#1F8A8A', '#8B5E34', '#4A5568', '#111111', '#FFFFFF']).filter(Boolean);
    ov.innerHTML = `<div class="rs-pop">${RSUI.xBtn()}
      <h3>${esc(o.title || 'اختيار لون')}</h3>
      <div class="cp-sv" id="cpSv"><div class="cp-thumb" id="cpSvT"></div></div>
      <div class="cp-hue" id="cpHue"><div class="cp-thumb" id="cpHueT"></div></div>
      <div class="cp-row"><span class="cp-prev" id="cpPrev"></span><input class="rs-field cp-hex" id="cpHex" maxlength="7" autocomplete="off" spellcheck="false" aria-label="رمز اللون"></div>
      <div class="cp-presets">${presets.map((c) => `<button type="button" style="background:${c}" data-c="${c}" aria-label="${c}"></button>`).join('')}</div>
      <div class="rs-actions"><button class="ok" id="cpOk">اعتماد</button><button class="no" id="cpNo">إلغاء</button></div></div>`;
    ov.querySelector('.sx').onclick = cancel;
    const rgb0 = parseHex(o.value) || parseHex('#C0502A');
    let [h, s, v] = rgb2hsv(rgb0[0], rgb0[1], rgb0[2]);
    const sv = $('cpSv'), hue = $('cpHue'), hex = $('cpHex');
    let raf = 0;
    const cur = () => toHex(hsv2rgb(h, s, v));
    function paint(fromHex) {
      sv.style.setProperty('--cp-h', h.toFixed(0));
      $('cpSvT').style.left = ((1 - s) * 100) + '%';
      $('cpSvT').style.top = ((1 - v) * 100) + '%';
      $('cpHueT').style.left = ((1 - h / 360) * 100) + '%';
      $('cpPrev').style.background = cur();
      if (!fromHex) hex.value = cur().toUpperCase();
      if (o.onInput) { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => o.onInput(cur())); }
    }
    function drag(el, fn) {
      el.addEventListener('pointerdown', (e) => { el.setPointerCapture(e.pointerId); fn(e); e.preventDefault(); const mv = (ev) => fn(ev); const up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); }; el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); });
    }
    drag(sv, (e) => { const r = sv.getBoundingClientRect(); s = 1 - clamp((e.clientX - r.left) / r.width, 0, 1); v = 1 - clamp((e.clientY - r.top) / r.height, 0, 1); paint(); });
    drag(hue, (e) => { const r = hue.getBoundingClientRect(); h = (1 - clamp((e.clientX - r.left) / r.width, 0, 1)) * 360; if (h >= 360) h = 359.99; paint(); });
    hex.addEventListener('input', () => { const p = parseHex(hex.value); if (p) { [h, s, v] = rgb2hsv(p[0], p[1], p[2]); paint(true); } });
    ov.querySelectorAll('.cp-presets button').forEach((b) => { b.onclick = () => { const p = parseHex(b.dataset.c); [h, s, v] = rgb2hsv(p[0], p[1], p[2]); paint(); }; });
    $('cpOk').onclick = () => { done = true; ov.classList.remove('show'); if (o.onApply) o.onApply(cur()); };
    $('cpNo').onclick = cancel;
    ov.classList.add('show');
    paint();
  };

  const ITEM = 44;
  RSUI.fmtTime = function (hhmm) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ''));
    if (!m) return '';
    let h = +m[1]; const pm = h >= 12; h = h % 12 || 12;
    return ar(h) + ':' + ar(m[2]) + ' ' + (pm ? 'م' : 'ص');
  };
  RSUI.pickTime = function (o) {
    o = o || {};
    const ov = makeOverlay('rsTimeOv', () => cancel());
    const cancel = closers.rsTimeOv = () => { ov.classList.remove('show'); if (o.onCancel) o.onCancel(); };
    const m0 = /^(\d{1,2}):(\d{2})$/.exec(o.value || '08:00') || [0, 8, 0];
    let H = +m0[1] % 24, M = +m0[2] % 60;
    let pm = H >= 12 ? 1 : 0, h12 = H % 12 || 12, min = M;
    const hours = Array.from({ length: 12 }, (_, i) => i + 1), mins = Array.from({ length: 60 }, (_, i) => i);
    const wheel = (id, arr, fmt) => `<div class="tp-wheel" id="${id}">${arr.map((x, i) => `<div data-i="${i}">${fmt(x)}</div>`).join('')}</div>`;
    ov.innerHTML = `<div class="rs-pop">${RSUI.xBtn()}<h3>${esc(o.title || 'اختيار الوقت')}</h3>
      <div class="tp-wheels">${wheel('tpH', hours, (x) => ar(x))}<span class="tp-colon">:</span>${wheel('tpM', mins, (x) => ar(String(x).padStart(2, '0')))}${wheel('tpP', [0, 1], (x) => (x ? 'م' : 'ص'))}</div>
      <div class="rs-actions"><button class="ok" id="tpOk">اعتماد</button><button class="no" id="tpNo">إلغاء</button></div></div>`;
    ov.querySelector('.sx').onclick = cancel;
    const wH = $('tpH'), wM = $('tpM'), wP = $('tpP');
    const idxOf = (w) => Math.max(0, Math.round(w.scrollTop / ITEM));
    const mark = (w, i) => w.querySelectorAll('div').forEach((d, k) => d.classList.toggle('on', k === i));
    const bind = (w, set) => {
      let t = 0;
      w.addEventListener('scroll', () => { const i = idxOf(w); mark(w, i); clearTimeout(t); t = setTimeout(() => set(idxOf(w)), 90); }, { passive: true });
      w.querySelectorAll('div').forEach((d) => d.addEventListener('click', () => { w.scrollTo({ top: +d.dataset.i * ITEM, behavior: 'smooth' }); }));
    };
    bind(wH, (i) => { h12 = hours[Math.min(i, 11)]; });
    bind(wM, (i) => { min = mins[Math.min(i, 59)]; });
    bind(wP, (i) => { pm = Math.min(i, 1); });
    ov.classList.add('show');
    requestAnimationFrame(() => {
      wH.scrollTop = (h12 - 1) * ITEM; wM.scrollTop = min * ITEM; wP.scrollTop = pm * ITEM;
      mark(wH, h12 - 1); mark(wM, min); mark(wP, pm);
    });
    $('tpOk').onclick = () => {
      h12 = hours[Math.min(idxOf(wH), 11)]; min = mins[Math.min(idxOf(wM), 59)]; pm = Math.min(idxOf(wP), 1);
      const hh = (h12 % 12) + (pm ? 12 : 0);
      ov.classList.remove('show');
      if (o.onDone) o.onDone(String(hh).padStart(2, '0') + ':' + String(min).padStart(2, '0'));
    };
    $('tpNo').onclick = cancel;
  };

  const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const WEEK_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const WEEK_SHORT = ['س', 'ح', 'ن', 'ث', 'ر', 'خ', 'ج'];
  RSUI.defaultWhen = function () {
    const d = new Date(Date.now() + 3600000);
    d.setSeconds(0, 0);
    d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15);
    return d.getTime();
  };
  RSUI.fmtDateTime = function (ts) {
    const d = new Date(ts), t0 = new Date(); t0.setHours(0, 0, 0, 0);
    const d0 = new Date(ts); d0.setHours(0, 0, 0, 0);
    const diff = Math.round((d0 - t0) / 86400000);
    const hm = RSUI.fmtTime(String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'));
    const day = diff === 0 ? 'اليوم' : diff === 1 ? 'غداً' : WEEK_AR[d.getDay()] + ' ' + ar(d.getDate()) + ' ' + MONTHS_AR[d.getMonth()] + (d.getFullYear() !== new Date().getFullYear() ? ' ' + ar(d.getFullYear()) : '');
    return day + '، ' + hm;
  };
  function hijriOf(d) {
    try { return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' }).format(d); } catch (e) { return ''; }
  }
  RSUI.pickDateTime = function (o) {
    o = o || {};
    const ov = makeOverlay('rsDtOv', () => cancel());
    let done = false;
    const cancel = closers.rsDtOv = () => { if (done) return; done = true; ov.classList.remove('show'); if (o.onCancel) o.onCancel(); };
    const minTs = o.min != null ? o.min : Date.now();
    let cur = new Date(o.value && o.value > minTs ? o.value : RSUI.defaultWhen());
    let view = new Date(cur.getFullYear(), cur.getMonth(), 1);
    const day0 = (x) => { const y = new Date(x); y.setHours(0, 0, 0, 0); return y.getTime(); };
    const sameDay = (a, b) => day0(a) === day0(b);
    ov.innerHTML = `<div class="rs-pop dt-pop">${RSUI.xBtn()}<h3>${esc(o.title || 'اختيار الموعد')}</h3><div id="dtBody"></div>
      ${o.withNote ? '<div class="dt-note"><label for="dtNote">نص الإشعار <small>(اختياري، وإن تركته فارغاً يعرض مسألة اليوم)</small></label><textarea id="dtNote" rows="2" maxlength="120" placeholder="اكتب ما تريد أن يظهر في الإشعار بالضبط..."></textarea></div>' : ''}
      <div class="rs-actions"><button class="ok" id="dtOk">اعتماد</button><button class="no" id="dtNo">إلغاء</button></div></div>`;
    ov.querySelector('.sx').onclick = cancel;
    if (o.withNote && $('dtNote')) $('dtNote').value = o.note || '';
    const body = $('dtBody');
    function paint() {
      const y = view.getFullYear(), m = view.getMonth();
      const first = new Date(y, m, 1), startOffset = (first.getDay() + 1) % 7;
      const dim = new Date(y, m + 1, 0).getDate();
      const todayTs = day0(Date.now());
      let cells = '';
      for (let i = 0; i < startOffset; i++) cells += '<span class="dt-c dt-e"></span>';
      for (let d = 1; d <= dim; d++) {
        const dd = new Date(y, m, d), past = day0(dd) < day0(minTs);
        const cls = ['dt-c', past ? 'dt-past' : '', sameDay(dd, cur) ? 'dt-sel' : '', day0(dd) === todayTs ? 'dt-today' : ''].join(' ');
        cells += `<button type="button" class="${cls}" data-d="${d}" ${past ? 'disabled' : ''}>${ar(d)}</button>`;
      }
      const canPrev = new Date(y, m, 0).getTime() >= day0(minTs);
      const ts = cur.getTime(), bad = ts < minTs + 30000;
      body.innerHTML = `<div class="dt-head"><button type="button" class="dt-nav" data-nav="-1" ${canPrev ? '' : 'disabled'} aria-label="الشهر السابق"><i class="ti ti-chevron-right"></i></button>
        <b>${MONTHS_AR[m]} ${ar(y)}</b>
        <button type="button" class="dt-nav" data-nav="1" aria-label="الشهر التالي"><i class="ti ti-chevron-left"></i></button></div>
        <div class="dt-week">${WEEK_SHORT.map((w) => `<span>${w}</span>`).join('')}</div>
        <div class="dt-grid">${cells}</div>
        <button type="button" class="dt-time" id="dtTime"><i class="ti ti-clock"></i> <span>${RSUI.fmtTime(String(cur.getHours()).padStart(2, '0') + ':' + String(cur.getMinutes()).padStart(2, '0'))}</span><small>اضغط لتغيير الساعة</small></button>
        <div class="dt-sum ${bad ? 'bad' : ''}">${bad ? 'هذا الموعد مضى، اختر وقتاً لاحقاً' : esc(RSUI.fmtDateTime(ts))}<small>${esc(hijriOf(cur))}</small></div>`;
      $('dtOk').disabled = bad;
    }
    body.addEventListener('click', (e) => {
      const nav = e.target.closest('[data-nav]');
      if (nav && !nav.disabled) { view = new Date(view.getFullYear(), view.getMonth() + (+nav.dataset.nav), 1); paint(); return; }
      const c = e.target.closest('.dt-c[data-d]');
      if (c && !c.disabled) { cur = new Date(view.getFullYear(), view.getMonth(), +c.dataset.d, cur.getHours(), cur.getMinutes(), 0, 0); paint(); return; }
      if (e.target.closest('#dtTime')) {
        RSUI.pickTime({ title: 'الساعة', value: String(cur.getHours()).padStart(2, '0') + ':' + String(cur.getMinutes()).padStart(2, '0'),
          onDone: (hhmm) => { const [h, mi] = hhmm.split(':').map(Number); cur.setHours(h, mi, 0, 0); paint(); } });
      }
    });
    $('dtOk').onclick = () => { if (cur.getTime() < minTs + 30000) return; done = true; ov.classList.remove('show'); if (o.onDone) o.onDone(cur.getTime(), o.withNote && $('dtNote') ? $('dtNote').value.trim() : undefined); };
    $('dtNo').onclick = cancel;
    ov.classList.add('show');
    paint();
  };

  const PREFS = { pinch: ['rs_pinch', '1'], wake: ['rs_wake', '0'], resume: ['rs_resume', '1'], exitc: ['rs_exitconfirm', '1'], swipe: ['rs_swipe_nav', '1'], motion: ['rs_reduce_motion', '0'] };
  RSUI.pref = (name) => lsGet(PREFS[name][0], PREFS[name][1]) === '1';
  RSUI.setPref = function (name, on) {
    lsSet(PREFS[name][0], on ? '1' : '0');
    if (name === 'wake') applyWake();
    if (name === 'motion') document.body.classList.toggle('reduce-motion', on);
    RSUI.refreshPrefsUi();
  };
  RSUI.togglePref = (name) => RSUI.setPref(name, !RSUI.pref(name));
  RSUI.refreshPrefsUi = function () {
    const map = { pinchToggle: 'pinch', wakeToggle: 'wake', resumeToggle: 'resume', exitToggle: 'exitc', swipeToggle: 'swipe', motionToggle: 'motion' };
    Object.keys(map).forEach((id) => { const e = $(id); if (e) e.classList.toggle('on', RSUI.pref(map[id])); });
    const pad = $('readPadSlider'); if (pad) { pad.value = RSUI.readPad(); const v = $('readPadValue'); if (v) v.textContent = ar(RSUI.readPad()); }
  };
  RSUI.readPad = () => clamp(parseInt(lsGet('rs_read_pad', '18'), 10) || 18, 6, 44);
  RSUI.setReadPad = function (n, noUi) {
    n = clamp(parseInt(n, 10) || 18, 6, 44);
    lsSet('rs_read_pad', String(n));
    document.documentElement.style.setProperty('--read-pad', n + 'px');
    if (!noUi) RSUI.refreshPrefsUi(); else { const v = $('readPadValue'); if (v) v.textContent = ar(n); }
  };

  let wakeLock = null;
  async function applyWake() {
    try {
      if (RSUI.pref('wake') && !document.hidden && 'wakeLock' in navigator) {
        if (!wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); }
      } else if (wakeLock) { await wakeLock.release(); wakeLock = null; }
    } catch (e) { wakeLock = null; }
  }
  document.addEventListener('visibilitychange', applyWake);

  let pinching = false, badgeTimer = 0;
  const textArea = (t) => !!(t && t.closest && t.closest('#readerPage, #comparisonPage, #customBookPage, #favoritesPage'));
  const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  function showBadge(n) {
    let b = $('pinchBadge');
    if (!b) { b = document.createElement('div'); b.id = 'pinchBadge'; document.body.appendChild(b); }
    b.innerHTML = ar(n) + '<small>حجم الخط</small>';
    b.classList.add('show');
    clearTimeout(badgeTimer); badgeTimer = setTimeout(() => b.classList.remove('show'), 700);
  }
  function midpoint(t) { return { x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 }; }
  function caretRangeAt(x, y) {
    try {
      let r = null;
      if (document.caretRangeFromPoint) r = document.caretRangeFromPoint(x, y);
      else if (document.caretPositionFromPoint) {
        const cp = document.caretPositionFromPoint(x, y);
        if (cp) { r = document.createRange(); r.setStart(cp.offsetNode, cp.offset); r.collapse(true); }
      }
      return r;
    } catch (e) { return null; }
  }
  function charRect(range) {
    const n = range.startContainer, o = range.startOffset;
    if (n.nodeType !== 3) return null;
    const r = document.createRange();
    const len = n.nodeValue.length;
    if (!len) return null;
    if (o < len) { r.setStart(n, o); r.setEnd(n, o + 1); } else { r.setStart(n, o - 1); r.setEnd(n, o); }
    const rects = r.getClientRects();
    return rects.length ? rects[0] : null;
  }
  function captureAnchor(x, y) {
    const c = $('content');
    if (!c) return null;
    const rg = caretRangeAt(x, y);
    if (rg && c.contains(rg.startContainer)) {
      const rc = charRect(rg);
      if (rc) return { node: rg.startContainer, off: rg.startOffset, dy: rc.top - y };
    }
    let el = document.elementFromPoint(x, y);
    el = el && el.closest ? (el.closest('.masala, .thamra-item, p, .body-text, .reader-section') || el) : null;
    if (el && c.contains(el)) {
      const b = el.getBoundingClientRect();
      return { el, frac: b.height ? (y - b.top) / b.height : 0 };
    }
    return null;
  }
  function restoreAnchor(a, y) {
    const c = $('content');
    if (!a || !c) return;
    let top = null;
    if (a.node) {
      if (!a.node.isConnected) return;
      const rg = document.createRange();
      const len = a.node.nodeValue.length;
      const o = Math.min(a.off, Math.max(len - 1, 0));
      if (!len) return;
      rg.setStart(a.node, o); rg.setEnd(a.node, Math.min(o + 1, len));
      const rc = rg.getClientRects()[0];
      if (rc) top = rc.top - a.dy;
    } else if (a.el && a.el.isConnected) {
      const b = a.el.getBoundingClientRect();
      top = b.top + a.frac * b.height;
    }
    if (top === null) return;
    const diff = top - y;
    if (Math.abs(diff) > 0.5) c.scrollTop += diff;
  }
  function flashAnchor(a) {
    try {
      if (!a || !a.node || !a.node.isConnected || !(window.CSS && CSS.highlights && window.Highlight)) return;
      const t = a.node.nodeValue || '', len = t.length; if (!len) return;
      let s0 = Math.min(a.off, len - 1), e0 = s0;
      const ws = /\s/;
      while (s0 > 0 && !ws.test(t[s0 - 1]) && a.off - s0 < 14) s0--;
      while (e0 < len && !ws.test(t[e0]) && e0 - a.off < 14) e0++;
      if (e0 <= s0) e0 = Math.min(len, s0 + 1);
      const r = document.createRange(); r.setStart(a.node, s0); r.setEnd(a.node, e0);
      CSS.highlights.set('rs-zanchor', new Highlight(r));
      clearTimeout(flashAnchor._t);
      flashAnchor._t = setTimeout(() => { try { CSS.highlights.delete('rs-zanchor'); } catch (e) {} }, 1300);
    } catch (e) {}
  }
  let sliderAnchor = null, sliderT = 0;
  RSUI.setFontKeepPos = function (n) {
    const c = $('content');
    try {
      if (c && (!sliderAnchor || !sliderAnchor.a || (sliderAnchor.a.node && !sliderAnchor.a.node.isConnected))) {
        const r = c.getBoundingClientRect(), y = r.top + Math.min(r.height * 0.35, 260), x = r.left + r.width / 2;
        const a = captureAnchor(x, y);
        sliderAnchor = a ? { a, y } : null;
      }
    } catch (e) { sliderAnchor = null; }
    try { setFontSizeLevel(n); } catch (e) {}
    if (sliderAnchor) { try { restoreAnchor(sliderAnchor.a, sliderAnchor.y); } catch (e) {} }
    clearTimeout(sliderT); sliderT = setTimeout(() => { sliderAnchor = null; }, 1200);
  };
  function setupPinch() {
    let p = null;
    const PINCH_START = 26;
    const activate = (e) => {
      const m = midpoint(e.touches);
      p.active = true; p.s0 = fontSize; p.last = fontSize; p.d0 = dist(e.touches); p.anchor = captureAnchor(m.x, m.y);
      pinching = true; window.__rsPinching = true;
      document.body.classList.add('rs-pinching');
    };
    document.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2 && RSUI.pref('pinch') && textArea(e.target) && typeof fontSize !== 'undefined') {
        p = { d0: dist(e.touches), s0: fontSize, last: fontSize, anchor: null, active: false, dInit: dist(e.touches) };
      } else if (e.touches.length > 2) { p = null; }
    }, { passive: true, capture: true });
    document.addEventListener('touchmove', (e) => {
      if (e.touches.length >= 2) { if (e.cancelable) e.preventDefault(); }
      if (!p || e.touches.length !== 2) return;
      if (!p.active) {
        if (Math.abs(dist(e.touches) - p.dInit) < PINCH_START) return;
        activate(e);
      }
      const m = midpoint(e.touches);
      const n = clamp(Math.round(p.s0 * dist(e.touches) / p.d0), 12, 40);
      try { if (typeof lockActiveSectionTracking === 'function') lockActiveSectionTracking(500); } catch (err) {}
      if (n !== p.last) {
        p.last = n; p.changed = true;
        try { setFontSizeLevel(n); } catch (err) {}
        showBadge(n);
        if (!p.anchor || (p.anchor.node && !p.anchor.node.isConnected)) p.anchor = captureAnchor(m.x, m.y);
      }
      p.lastY = m.y;
      if (p.changed) restoreAnchor(p.anchor, m.y);
    }, { passive: false, capture: true });
    const end = (e) => {
      if (p && e.touches.length < 2 && !p.active) { p = null; return; }
      if (p && e.touches.length < 2) {
        const a = p.anchor, y = p.lastY, wasChanged = !!p.changed; p = null;
        document.body.classList.remove('rs-pinching');
        if (a && y != null && wasChanged) {
          let touched = false; const mark = () => { touched = true; };
          const c = $('content');
          if (c) { c.addEventListener('touchstart', mark, { once: true, passive: true }); c.addEventListener('wheel', mark, { once: true, passive: true }); }
          const fix = () => { if (!touched) restoreAnchor(a, y); };
          restoreAnchor(a, y); flashAnchor(a);
          requestAnimationFrame(fix);
          [90, 260, 620, 1100].forEach((ms) => setTimeout(fix, ms));
        }
        setTimeout(() => { pinching = false; window.__rsPinching = false; }, 250);
      }
    };
    document.addEventListener('touchend', end, { passive: true, capture: true });
    document.addEventListener('touchcancel', end, { passive: true, capture: true });
    ['gesturestart', 'gesturechange', 'gestureend'].forEach((ev) => document.addEventListener(ev, (e) => e.preventDefault(), { passive: false }));
    const vv = window.visualViewport;
    if (vv) vv.addEventListener('resize', () => {
      if (vv.scale > 1.02 && !pinching) RSUI.resetZoom();
      const a = document.activeElement, typing = !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable);
      document.body.classList.toggle('kb-open', typing && vv.height < window.innerHeight - 140);
      resetDocScroll();
    });
    window.addEventListener('scroll', resetDocScroll, { passive: true });
    document.addEventListener('focusout', () => { setTimeout(() => { document.body.classList.remove('kb-open'); resetDocScroll(); }, 80); });
  }
  function resetDocScroll() {
    const de = document.documentElement;
    if (window.scrollY || window.scrollX || de.scrollTop || document.body.scrollTop) { window.scrollTo(0, 0); de.scrollTop = 0; document.body.scrollTop = 0; }
  }
  RSUI.resetZoom = function () {
    const m = document.querySelector('meta[name="viewport"]');
    if (!m) return;
    const orig = m.getAttribute('data-orig') || m.getAttribute('content');
    m.setAttribute('data-orig', orig);
    m.setAttribute('content', 'width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
    setTimeout(() => { m.setAttribute('content', 'width=device-width, initial-scale=1.01, minimum-scale=1.0, maximum-scale=1.01, user-scalable=no, viewport-fit=cover'); }, 60);
    setTimeout(() => { m.setAttribute('content', orig); }, 160);
  };

  let deferredInstall = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; RSUI.refreshInstallUi(); });
  window.addEventListener('appinstalled', () => { deferredInstall = null; toast('تم تثبيت التطبيق'); RSUI.refreshInstallUi(); });
  RSUI.isStandalone = () => { try { return window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true; } catch (e) { return false; } };
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  RSUI.refreshInstallUi = function () {
    const row = $('installRow'); if (!row) return;
    const standalone = RSUI.isStandalone();
    row.style.display = standalone ? 'none' : '';
    const small = $('installSub');
    if (small) small.textContent = deferredInstall ? 'أضِفه إلى شاشتك الرئيسية ليُفتح كتطبيق مستقل، ويعمل بعد أول تحميل بلا إنترنت' : (isIOS() ? 'خطوات الإضافة إلى الشاشة الرئيسية' : 'أضِفه إلى شاشتك الرئيسية، وإن لم تظهر نافذة التثبيت فهذه خطواته');
  };
  RSUI.install = async function () {
    if (deferredInstall) {
      try {
        deferredInstall.prompt();
        const r = await deferredInstall.userChoice;
        deferredInstall = null;
        if (r && r.outcome === 'accepted') toast('جارٍ تثبيت التطبيق');
      } catch (e) { showInstallHelp(); }
      RSUI.refreshInstallUi();
      return;
    }
    showInstallHelp();
  };
  RSUI.closeInstallHelp = function () { const o = $('rsInstallOv'); if (o) o.classList.remove('show'); };
  function showInstallHelp() {
    const ov = makeOverlay('rsInstallOv', RSUI.closeInstallHelp);
    closers.rsInstallOv = RSUI.closeInstallHelp;
    const steps = isIOS()
      ? ['افتح التطبيق في متصفح Safari، فغيره لا يتيح الإضافة على الآيفون.', 'اضغط زر المشاركة في أسفل الشاشة (مربع يخرج منه سهم).', 'مرّر القائمة واختر «إضافة إلى الشاشة الرئيسية».', 'اضغط «إضافة»، وستجد الأيقونة بين تطبيقاتك.']
      : ['اضغط الثلاث نقاط ⋮ في أعلى المتصفح.', 'اختر «تثبيت التطبيق»، أو «إضافة إلى الشاشة الرئيسية» إن لم تجد الأول.', 'أكّد بالضغط على «تثبيت».', 'ستجد الأيقونة بين تطبيقاتك، ويُفتح التطبيق من دون شريط المتصفح.'];
    ov.innerHTML = `<div class="rs-pop">${RSUI.xBtn()}<h3>تثبيت التطبيق</h3>
      <p style="margin:0 0 12px;font-size:14px;line-height:2;color:var(--text-dim)">لم يعرض المتصفح نافذة التثبيت من نفسه (قد يكون التطبيق مثبّتاً من قبل، أو أن المتصفح لا يدعمها). يمكنك التثبيت يدوياً:</p>
      <ol style="margin:0 0 10px;padding-inline-start:22px;font-size:14.5px;line-height:2.1">${steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
      <div style="padding:10px 12px;border-radius:10px;background:rgba(var(--accent-rgb),.1);font-size:13.5px;line-height:1.9"><b>يعمل بدون إنترنت:</b> بعد التثبيت وأول تحميل كامل يصبح التطبيق قادراً على العمل بلا اتصال، فتقرأ وتبحث وتحفظ كل شيء دون إنترنت.</div></div>`;
    ov.querySelector('.sx').onclick = RSUI.closeInstallHelp;
    ov.classList.add('show');
  }

  RSUI.exportBackup = function () {
    const data = {};
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k === 'rs_autoheal') continue; data[k] = localStorage.getItem(k); } } catch (e) {}
    const d = new Date(), pad = (n) => String(n).padStart(2, '0');
    const blob = new Blob([JSON.stringify({ app: 'rasael', format: 1, at: d.toISOString(), data })], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `rasael-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    toast('حُفظت النسخة الاحتياطية');
  };
  RSUI.importBackup = function () {
    let inp = $('rsBackupFile');
    if (!inp) {
      inp = document.createElement('input'); inp.type = 'file'; inp.id = 'rsBackupFile'; inp.accept = '.json,application/json'; inp.style.display = 'none';
      document.body.appendChild(inp);
    }
    inp.value = '';
    inp.onchange = () => {
      const f = inp.files && inp.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        let obj = null;
        try { obj = JSON.parse(String(r.result)); } catch (e) {}
        if (!obj || obj.app !== 'rasael' || !obj.data || typeof obj.data !== 'object') { toast('هذا الملف ليس نسخة احتياطية من التطبيق'); return; }
        const n = Object.keys(obj.data).length;
        RSUI.confirm({
          title: 'استعادة النسخة', msg: `ستُستبدل بياناتك الحالية (المفضلة والملاحظات والكتب والإعدادات) بما في النسخة، وفيها ${ar(n)} عنصراً محفوظاً. أتريد المتابعة؟`, yes: 'استعادة', no: 'إلغاء', danger: true,
          onYes: () => {
            try {
              const keep = {}; ['rs_autoheal'].forEach((k) => { const v = localStorage.getItem(k); if (v !== null) keep[k] = v; });
              localStorage.clear();
              Object.keys(obj.data).forEach((k) => { if (typeof obj.data[k] === 'string') localStorage.setItem(k, obj.data[k]); });
              Object.keys(keep).forEach((k) => localStorage.setItem(k, keep[k]));
            } catch (e) { toast('تعذّرت الاستعادة'); return; }
            toast('تمت الاستعادة، جارٍ إعادة التشغيل');
            setTimeout(() => location.reload(), 700);
          }
        });
      };
      r.readAsText(f);
    };
    inp.click();
  };
  RSUI.resetSettings = function () {
    RSUI.confirm({
      title: 'إعادة الإعدادات', msg: 'ترجع كل الإعدادات (الخط والألوان والإشعارات وغيرها) إلى حالتها الأولى. أما المفضلة والملاحظات والكتب والكتابات فتبقى كما هي.', yes: 'إعادة', no: 'إلغاء', danger: true,
      onYes: () => {
        const settingKeys = ['rs_look_v68', 'rs_night', 'rs_fontSize', 'rs_fontFamily', 'rs_readmode', 'rs_navmode', 'rs_library_view', 'rs_show_pins', 'rs_show_daily', 'rs_notif_v70',
          'rs_pinch', 'rs_wake', 'rs_resume', 'rs_exitconfirm', 'rs_swipe_nav', 'rs_reduce_motion', 'rs_read_pad', 'rs_star_prefs', 'rs_navhide', 'rs_wr_bar', 'rs_custom_select', 'rs_sel_pinned', 'rs_hl_prefs', 'rs_gterm_mode', 'rs_cs_gest', 'rs_xnote_mode', 'rs_search_hist_on', 'rs_search_author_order', 'rs_search_fav_preset', 'rs_search_sort', 'rs_search_sort_mode', 'rs_fn_mode', 'rs_share_opts'];
        try { settingKeys.forEach((k) => localStorage.removeItem(k)); } catch (e) {}
        toast('أُعيدت الإعدادات');
        setTimeout(() => location.reload(), 600);
      }
    });
  };

  const G = (t) => `<span class="gd-g">${t}</span>`;
  const GUIDE = [
    { t: 'الشاشة الرئيسية', lead: 'تُفتح على «المحتويات»، وهي مكتبتك كلها في صفحة واحدة.', items: [
      ['المكتبة', 'لكل مرجع بطاقة فيها صورته وعدد كتبه. المس البطاقة لترى كتبه، ثم المس الكتاب لتصل إلى فهرسه. ومن الإعدادات يمكنك أن تحوّل المكتبة من بطاقات إلى قائمة.'],
      ['ترتيب المكتبة', 'افتح الإعدادات واختر «ترتيب»، ثم اسحب كل بطاقة من مقبضها إلى المكان الذي تريد، واحفظ الترتيب أو تراجع عنه.'],
      ['المثبّتة', 'شريط أعلى الصفحة تضع فيه ما تعود إليه كثيراً من مراجع وكتب. يفتح زر «إضافة» قائمة الاختيار، و' + G('ضغطة مطوّلة') + 'على أي بطاقة مثبّتة تُدخلك وضع الترتيب والحذف. وإن لم تحتج إلى هذا القسم فأخفِه من الإعدادات.'],
      ['مسألة اليوم', 'مسألة تُختار من الكتب التي ثبّتّها وتتبدّل كل يوم. المس عنوانها لتُفتح مختصرة، وأيقونة التحديث تأتي بغيرها، والمس نص المسألة أو مصدرها لتنتقل إلى موضعها في الكتاب. ولا تظهر إلا بعد أن تثبّت شيئاً. ويمكن أن تصلك كإشعار في أوقات تحددها (انظر الإعدادات).'],
      ['زر +', 'الدائرة العائمة في الرئيسية تُنشئ كتاباً خاصاً، أو كتابة حرّة، أو مجموعة (حقيبة).']
    ] },
    { t: 'القراءة', lead: 'كل ما يخص قراءة الكتب والتنقل داخلها.', items: [
      ['طريقة القراءة', 'تختار من الإعدادات الإضافية بين «صفحة متصلة» تمرّر فيها الأبواب تباعاً، و«صفحة واحدة» تقلّب فيها باباً بعد باب.'],
      ['التنقل بين الأبواب', 'اسحب بإصبع واحد أفقياً: لليمين إلى الباب التالي ولليسار إلى السابق. وزر الفهرس العائم يفتح قائمة أبواب الكتاب لتقفز إلى أيها شئت، وفي أعلاها خانة بحث داخل هذا الكتاب وحده. ويمكن إيقاف السحب الأفقي من الإعدادات إن كان يزعجك.'],
      ['تكبير الخط بالأصابع', 'في القراءة وفي الجامع: ضع إصبعين على النص وباعد بينهما ليكبر الخط، أو قرّبهما ليصغر. يظهر رقم الحجم لحظة التغيير ويُحفظ للمرة القادمة. وهو يتحكم بالنص وحده لا بالأزرار. تستطيع إيقاف هذه الحركة من الإعدادات، ويبقى المنزلق هناك لضبط الحجم باللمس.'],
      ['المصطلحات', 'الكلمة المسطّرة مصطلح فقهي: المسها فتفتح نافذة بمعناه ومصدره. وقد لا يطابق المعنى سياق النص تماماً، فاعتبره عوناً على الفهم لا حكماً.'],
      ['الحواشي', 'رقم الحاشية بين قوسين مربعين، مثل [١]، يفتح نصها تحت المسألة مباشرة، والمسه ثانية لإغلاقها.'],
      ['أدوات المسألة', 'المس أي مسألة، أو أي رأي في الثمرة، فتظهر أدواتها: نسخ، ونجمة، وملاحظة، وإضافة إلى كتابي.'],
      ['النسخ والمشاركة', 'زر النسخ ينسخ المسألة. و' + G('ضغطة مطوّلة') + 'عليه، في أي مكان، تحوّله إلى مشاركة تفتح قائمة المشاركة بدل النسخ. وفي العروة يضيف النسخ حواشي المسألة وفق ما اخترته من إخفاء وترتيب.'],
      ['النجمة والألوان', 'النجمة إشارة مرجعية بثلاث حركات: ' + G('ضغطة') + 'تحفظ المسألة باللون الأول، و' + G('ضغطتان') + 'باللون الثاني، و' + G('ضغطة مطوّلة') + 'تفتح لوحة تختار منها اللونين وتغيّرهما متى شئت. وتجمع المفضلة المسائل بحسب لونها.'],
      ['الملاحظات', 'زر الملاحظة يفتح مربع كتابة تحت المسألة نفسها. وفي شريط الأدوات تنسيق: عريض، وتمييز بخلفية، وثلاثة ألوان للنص، وخط فاصل. وكل مسألة عليها ملاحظة تجدها في المفضلة.'],
      ['موضعي في الكتاب', 'زر الدبوس العائم له ثلاث حالات: ' + G('ضغطة واحدة') + 'تعرض مواقعك المحفوظة في كل الكتب لتنتقل إلى أحدها، و' + G('ضغطتان') + 'تبدآن تتبّع الكتاب الذي أنت فيه فيُحفظ موضعك تلقائياً كلما مرّرت، و' + G('ضغطة مطوّلة') + 'على الموقع داخل القائمة تحذفه. أما الضغطة المطوّلة على الزر نفسه فتفتح تقسيم الشاشة.'],
      ['تحديد النص', 'حدّد أي كلمات (ضغطة مطوّلة ثم المقبضان) فيظهر شريط صغير. زر «⋯» يفتح كل الخيارات: تظليل بأربعة ألوان، ونجمة للنص المحدَّد، وملاحظة عليه، وإضافته إلى كتاب من كتبك، وتذكير به، ومشاركة. والدبوس بجانب كل خيار يجعله ظاهراً في الشريط دائماً أو يخفيه.'],
      ['تقسيم الشاشة', 'اضغط مطوّلاً على زر الدبوس فتنقسم الشاشة إلى نافذتين مستقلتين، في كل منهما كتاب، لتقابل بين مسألتين دون تنقّل. اسحب الفاصل بينهما لتغيير الحجم، وبدّل الاتجاه بين الطول والعرض، وأغلق التقسيم بالزر الصغير في الفاصل.'],
      ['العودة إلى بداية القسم', 'اضغط على أيقونة القسم الذي أنت فيه بالشريط السفلي، فيرجع بك إلى أول صفحاته.']
    ] },
    { t: 'العروة الوثقى والثمرة', lead: 'كتابان لهما معاملة خاصة لأن عليهما تعليقات المراجع.', items: [
      ['حواشي العروة', 'تظهر تحت كل مسألة تعليقات الفقهاء مسمّاة بأسمائهم. وزر الضبط في أعلى الشاشة (أيقونة المنزلقات) يفتح إعدادات الحواشي: ترتّب الفقهاء بسحب المقبض، وتخفي من لا تريد، وتضع نجمة على من تريد تمييزه بلون خاص. وفيه كذلك اختيار موضع التعليقات المطبوعة أعلى الصفحة: تُنسب إلى أول هامش في الصفحة، أو إلى آخر هامش في الصفحة السابقة.'],
      ['فهرس العروة بحسب الموضوع', 'يمكنك عرض فهرس العروة مصنَّفاً بالأبواب والفصول بدل الترتيب الأصلي. المس عنوان الفصل ليفتح القارئ عند أول مسألة فيه.'],
      ['الثمرة', 'فيها آراء المراجع مرتبة تحت كل مسألة، وللمراجع فيها إعدادات مستقلة عن العروة: ترتيب، وإخفاء، وتمييز. والمس أي رأي لتظهر أدواته. وينسخ زر النسخ السؤال والجواب وأسماء المراجع والمصدر معاً.'],
      ['الشروح', 'بعض الكتب لها شروح مكتوبة ومقاطع مسجّلة. حيث يوجد ذلك يظهر زر الشرح تحت المسألة، فاختر منه الشرح الذي تريد.']
    ] },
    { t: 'جامع الاستفتاءات', lead: 'يضع جواب كل مرجع عن السؤال الواحد في بطاقة، فتقارن بلا تنقّل بين الكتب. أصله عمل الشيخ عادل الجوهر.', items: [
      ['الأبواب والمسائل', 'تُعرض الأبواب أولاً بطاقات أو قائمة، ولك التبديل بالزرين أعلى الصفحة. افتح باباً فتظهر أسئلته، ثم افتح السؤال.'],
      ['المقارنة', 'تحت السؤال بطاقة لكل مرجع فيها جوابه. تنتقل إلى السؤال التالي أو السابق بالسحب الأفقي أو بالسهمين في الأعلى. وإذا نزلت في القراءة بقي شريط السؤال ثابتاً في الأعلى فلا تنسى ما تقرأ.'],
      ['ترتيب المراجع', 'زر «ترتيب المراجع وإخفاء/تمييز» يتيح أن تسحب المراجع بحسب أولويتك، وأن تخفي من لا تريد رأيه، وأن تميّز من تقدّمه.'],
      ['أدوات السؤال والجواب', 'في بطاقة السؤال: نسخ يأخذ السؤال مع آراء المراجع الظاهرة بترتيبك مع المصدر، ونجمة، وملاحظة، وإضافة إلى كتابي. ولكل جواب أدواته الأربع كذلك.'],
      ['المصدر الأصلي', 'في أسفل الصفحة رابط صغير إلى التطبيق الأصلي على متجر Google Play لمن أراد زيارته.']
    ] },
    { t: 'البحث', lead: 'يبحث في عناوين الكتب ونصوصها وحواشيها وفي الجامع.', items: [
      ['البدء', 'اكتب كلمة أو عبارة ثم اضغط زر البحث أو مفتاح الإدخال. تظهر النتائج بمقتطف يُظلَّل فيه موضع الكلمة، ومعها الكتاب والمرجع.'],
      ['خيارات البحث', 'تحدد بها «طريقة المطابقة»: تطابق تام للعبارة، أو كلمات متفرقة في النص نفسه. و«مكان البحث»: العناوين والنصوص معاً، أو العناوين وحدها، أو النصوص، أو الحواشي. و«شكل الكلمة»: كما كُتبت، أو مع «ال» التعريف وبدونها.'],
      ['استثناء كلمة', 'اكتب كلمة لا تريد أن تظهر في النتائج، فتُحذف كل نتيجة تحويها.'],
      ['المراجع والكتب', 'يفتح قائمة تحدد منها أين يبحث. علامة على المرجع تشمل كتبه كلها، وسهم صغير بجانبه يفتح كتبه لتختار منها. وفي أعلى القائمة خانة للتصفية بالاسم، وزر تحديد الكل أو إلغائه.'],
      ['الاختصارات', 'بعد أن تضبط اختيارك اضغط «حفظ كاختصار» وسمِّه، فيظهر تحت أزرار البحث زر باسمه يطبّق اختيارك بلمسة واحدة. و' + G('ضغطة مطوّلة') + 'على هذا الزر تحذفه.'],
      ['ترتيب النتائج', 'فوق النتائج: «الأقرب»، و«حسب المرجع» (ضغطة مطوّلة عليه تفتح ترتيب المراجع بالأسهم)، و«اختصاري المفضّل» الذي يطبّق اختصاراً حفظتَه، وإلغاؤه يعيد تصفيتك السابقة. ولجعل اختصار مفضّلاً اضغط عليه مطوّلاً. اسم المرجع يظهر قبل اسم الكتاب في كل نتيجة.'],
      ['فتح النتيجة', 'المس النتيجة لتُفتح في موضعها من الكتاب، وفي القارئ تتنقل بين نتائج البحث بالسحب الأفقي. وحين ترجع تجد القائمة كما كانت، في الصفحة وموضع التمرير نفسيهما.'],
      ['هل تقصد؟', 'إن لم تُنتج الكلمة نتائج اقترح عليك البحث كلمة قريبة منها بالرسم، فتضغط الاقتراح لتبحث به.']
    ] },
    { t: 'المفضلة', lead: 'يجتمع فيها كل ما علّمتَه أثناء القراءة.', items: [
      ['تبويبان', '«المفضلة» فيها المسائل المنجّمة، و«عليها تعليق» فيها المسائل التي كتبت عليها ملاحظة. وعدد كل تبويب ظاهر بجانب اسمه.'],
      ['الألوان', 'في تبويب المفضلة أزرار بألوان النجوم تصفّي القائمة على لون واحد. وبلا تصفية يكون الأحدث أولاً.'],
      ['الفتح والحذف', 'المس الصف ليُفتح الكتاب عند المسألة نفسها. واسحب الصف جانباً ليظهر زر الحذف.']
    ] },
    { t: 'شخصي', lead: 'مساحتك الخاصة: كتب تؤلّفها، ومجموعات تجمعها، وكتابات حرّة.', items: [
      ['كتبي', 'كتاب خاص تجمع فيه المسائل والملاحظات. تضيف إليه من أي مسألة بزر «إضافة إلى كتابي»، فتختار الكتاب والباب. وداخل الكتاب يفتح زر القلم وضع الترتيب والحذف، وتستطيع إدراج ملاحظة بين العناصر، وإضافة أبواب، وإعادة تسمية الكتاب أو حذفه من قائمة النقاط الثلاث.'],
      ['مجموعاتي', 'المجموعة (أو الحقيبة) تضم كتباً وأقساماً تحتاجها معاً لتصل إليها بلمسة. تظهر كذلك في المكتبة بالرئيسية.'],
      ['كتاباتي', 'محرر نصوص حرّ: تكتب فيه وتنسّق الخط واللون، وتدرج من مفضلتك أو ملاحظاتك ما تشاء، ثم تنسخ الكتابة أو تشاركها.'],
      ['الاسم والحذف', 'في هذه الصفحة كلها، اسحب الصف جانباً لتظهر أزرار تغيير الاسم والحذف.']
    ] },
    { t: 'الإعدادات', lead: 'تفتح من الترس في أعلى كل صفحة.', items: [
      ['الأساسية', 'حجم الخط بالمنزلق (من ١٢ إلى ٤٠) مع معاينة، وتشغيل التكبير بالأصابع أو إيقافه، والقراءة الليلية، وترتيب المكتبة.'],
      ['القراءة', 'نوع الخط، وطريقة القراءة، وتباعد الأسطر، وهوامش الصفحة، وضبط النص على الحافتين، وإبقاء الشاشة مضاءة.'],
      ['المظهر', 'لون التطبيق ولون الخلفية، من ألوان جاهزة أو بمنتقي ألوان خاص بالتطبيق تضبط به اللون بدقة. وتأثير الضوء وقوته، والوضع التلقائي الذي يتبع نظام الجهاز.'],
      ['الإشعارات', 'إشعار «مسألة اليوم» له ثلاثة جداول: كل يوم بوقت أو أكثر، أو في أيام محددة من الأسبوع (يوم واحد يعني مرة في الأسبوع)، أو كل عدد من الأيام. وتختار الأوقات بنفسك. ويعرض التطبيق موعد الإشعار القادم. ملاحظة: وصول الإشعار والتطبيق مغلق يتفاوت بحسب المتصفح وتوفير الطاقة؛ ويكون أوثق إذا ثبّتّ التطبيق على الشاشة الرئيسية.'],
      ['التنقل واللمس', 'التحكم بالسحب الأفقي بين الأبواب، وبتأكيد الخروج بالضغط مرتين على رجوع الجهاز، وبعودة التطبيق إلى آخر موضع قرأت فيه، وبتقليل الحركات والانتقالات.'],
      ['الشريط السفلي', 'عادي ظاهر دائماً، أو مضغوط يختفي عند النزول بالقراءة ويعود عند الصعود.'],
      ['النسخ الاحتياطي', 'كل ما تحفظه يبقى في متصفحك وحده. من «البيانات» تحفظ نسخة في ملف، وتستعيدها على هذا الجهاز أو غيره. وهذا أمانك الوحيد إن مُسحت بيانات المتصفح.']
    ] },
    { t: 'التثبيت والعمل بلا إنترنت', lead: 'يعمل التطبيق بعد أول تحميل دون اتصال.', items: [
      ['أول تشغيل', 'عند أول فتح تُنزَّل الكتب كلها (نحو مئة ميغابايت)، فاتركه حتى يكتمل مرة واحدة. بعدها يفتح بسرعة ولا يحتاج إلى شبكة.'],
      ['التثبيت', 'من الإعدادات اختر «تثبيت التطبيق» فيضاف إلى شاشتك الرئيسية ويُفتح كتطبيق مستقل دون شريط المتصفح. وهو الخيار نفسه الذي تجده في قائمة المتصفح (الثلاث نقاط) باسم «تثبيت التطبيق». وعلى الآيفون تكون الإضافة من زر المشاركة في Safari.'],
      ['التحديثات', 'حين يصدر إصدار جديد يُنزَّل في الخلفية ويبدأ العمل به عند فتح التطبيق مرة أخرى.'],
      ['خصوصيتك', 'التطبيق بلا حسابات ولا خادم يستقبل بياناتك. المفضلة والملاحظات والكتابات وإعداداتك كلها على جهازك.']
    ] }
  ];
  RSUI.GUIDE = GUIDE;
  function guideHtml(q) {
    q = (q || '').trim();
    const norm = (s) => String(s).replace(/<[^>]*>/g, ' ').replace(/[ً-ٰٟـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
    const nq = norm(q);
    const hl = (html) => {
      if (!q) return html;
      const re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'g');
      return html.replace(/(^|>)([^<]+)/g, (m, a, txt) => a + txt.replace(re, '<mark class="gd-hit">$1</mark>'));
    };
    let out = '', n = 0;
    GUIDE.forEach((s, si) => {
      const items = s.items.filter(([h, p]) => !nq || norm(h + ' ' + p + ' ' + s.t).indexOf(nq) >= 0);
      if (!items.length) return;
      n++;
      const open = q ? ' open' : '';
      out += `<div class="gd-sec${open}" id="gd-${si}"><button type="button" class="gd-head" onclick="RSUI.guideToggle(${si})"><span class="gd-num">${ar(si + 1)}</span><span class="gd-ttl">${s.t}</span><i class="ti ti-chevron-left gd-chev"></i></button>
        <div class="gd-body"><p class="gd-lead">${s.lead}</p>${items.map(([h, p]) => `<div class="gd-item"><h4>${hl(h)}</h4><p>${hl(p)}</p></div>`).join('')}</div></div>`;
    });
    return out || '<div class="gd-empty">لا يوجد في الدليل ما يطابق بحثك.</div>';
  }
  RSUI.guideSections = guideHtml;
  RSUI.guideToggle = function (i) { const e = $('gd-' + i); if (e) e.classList.toggle('open'); };
  RSUI.guideFind = function (v) { const box = $('gdList'); if (box) box.innerHTML = guideHtml(v); };
  RSUI.guideGo = function (i) {
    const e = $('gd-' + i); if (!e) return;
    e.classList.add('open');
    const sheet = $('helpSheet');
    if (sheet) sheet.scrollTo({ top: Math.max(0, e.offsetTop - 64), behavior: 'smooth' });
  };
  RSUI.helpHtml = function () {
    return `<h3><span class="pp-back" onclick="closeHelp()"><i class="ti ti-arrow-right"></i></span> دليل الاستخدام${RSUI.xBtn()}</h3>
      <div class="gd-find"><input type="text" class="rs-field" id="gdFind" placeholder="ابحث في الدليل عن ميزة أو كلمة..." oninput="RSUI.guideFind(this.value)" autocomplete="off"></div>
      <div id="gdList">${guideHtml('')}</div>`;
  };

  RSUI.aboutHtml = function (st) {
    const n = (x) => ar(x || 0);
    const src = st.sourceUrl ? ` <a class="ab-quiet" href="${esc(st.sourceUrl)}" target="_blank" rel="noopener">الشيفرة المصدرية</a>` : '';
    return `<h3><span class="pp-back" onclick="closeAbout()"><i class="ti ti-arrow-right"></i></span> حول المشروع${RSUI.xBtn()}</h3>
      <div class="ab">
        <div class="ab-ayah">﴿فَلَوْلَا نَفَرَ مِن كُلِّ فِرْقَةٍ مِّنْهُمْ طَائِفَةٌ لِّيَتَفَقَّهُوا فِي الدِّينِ وَلِيُنذِرُوا قَوْمَهُمْ إِذَا رَجَعُوا إِلَيْهِمْ لَعَلَّهُمْ يَحْذَرُونَ﴾</div>
        <div class="ab-ayah-src">سورة التوبة، الآية ١٢٢</div>
        <div class="ab-orn"><i></i></div>
        <p class="ab-p">هذا التطبيق خزانة صغيرة تجمع الرسائل العملية لعدد من المراجع الكرام، ومعها العروة الوثقى بحواشي الفقهاء عليها، وكتاب الثمرة، وشروح مكتوبة ومسجّلة، وجامع الاستفتاءات الذي يضع أجوبة المراجع عن المسألة الواحدة جنباً إلى جنب. وفي هذه النسخة ${n(st.books)} كتاباً تعود إلى ${n(st.marja)} مرجعاً، ومعها ${n(st.questions)} سؤالاً في الجامع.</p>
        <p class="ab-p ab-masail"></p>
        <p class="ab-p"><span class="rh">مفتوح المصدر</span>شيفرة التطبيق مفتوحة، يقرؤها كل من أراد أن يطمئن إلى ما يفعله، وينقلها أو يبني عليها أو يشارك في تحسينها وتصحيح ما فيها من خطأ، لا يُطلب من أحد ثمن ولا اشتراك.${src}</p>
        <p class="ab-p"><span class="rh">بياناتك عندك</span>لا حسابات هنا ولا خادم يستقبل شيئاً منك. ما تحفظه من إشارات وملاحظات وكتب وكتابات يبقى في متصفحك وحده، وبعد أول تحميل يعمل التطبيق دون اتصال. وإن أردت نقل ما جمعتَ إلى جهاز آخر فاحفظ نسخة احتياطية من الإعدادات.</p>
        <p class="ab-p"><span class="rh">عن الجامع</span>جامع الاستفتاءات للشيخ عادل الجوهر، نُقل هنا كما وضعه. وأصله تطبيق مستقل على متجر Google Play، تجد رابطه الصغير في أسفل صفحة الجامع.</p>
        <p class="ab-p"><span class="rh">الشكر</span>الشكر لكل من أعان على هذا العمل بنص أو مراجعة أو دعاء، ولأصحاب البرامج والدراسات الفقهية الذين سبقوا إلى هذا الميدان وانتفعنا بجهدهم. نسأل الله أن يتقبله خالصاً لوجهه، وأن ينفع به المؤمنين.</p>
        <p class="ab-p"><span class="rh">الحواشي والأخطاء</span>حاولنا قدر الإمكان ضبط حواشي العروة الوثقى ومستمسك العروة والثمرة، لكن قد يقع فيها خطأ. إن وجدت خطأً في حاشية أو نص أو ترقيم فتواصل معنا لنصلحه.</p>
        <p class="ab-p"><span class="rh">تواصل معنا</span><a class="ab-contact" href="https://t.me/Mshkaah" target="_blank" rel="noopener"><i class="ti ti-brand-telegram"></i> t.me/Mshkaah</a></p>
        <div class="ab-orn"><i></i></div>
        <div class="ab-end">والحمد لله رب العالمين،<br>وصلى الله على محمد وآله الطاهرين</div>
        <div class="ab-ver">الإصدار ${esc(st.version || '')}</div>
      </div>`;
  };

  RSUI.applyPrefs = function () {
    document.body.classList.toggle('reduce-motion', RSUI.pref('motion'));
    document.documentElement.style.setProperty('--read-pad', RSUI.readPad() + 'px');
    applyWake();
    RSUI.refreshPrefsUi(); RSUI.refreshInstallUi();
  };
  document.addEventListener('DOMContentLoaded', () => {
    RSUI.mountSheetClose();
    RSUI.applyPrefs();
    setupPinch();
  });
})();
