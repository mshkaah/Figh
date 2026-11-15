(function () {
  'use strict';
  const RSD = window.RSD; if (!RSD || RSD.embedded) return;
  const { $, q, qa, lsGet, lsSet } = RSD.util;
  const SPD = 0.82;
  const sleep = (ms) => RSD.util.sleep(Math.round(ms * SPD));
  const lsDel = (k) => { try { localStorage.removeItem(k); } catch (e) {} };
  const userOff = () => lsGet('rs_hints_off', '0') === '1';
  const ctxOn = () => lsGet('rs_coach_ctx', '1') === '1' && !userOff();
  const flag = (k) => lsGet('rs_cc_' + k, '') === '1';
  const setFlag = (k) => lsSet('rs_cc_' + k, '1');
  const reduced = () => { try { return document.body.classList.contains('reduce-motion') || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } };
  const activePage = () => { const p = document.querySelector('.page.active'); return p ? p.id : ''; };
  const readerActive = () => activePage() === 'readerPage';
  const swipeOn = () => { try { return !!RSUI.pref('swipe'); } catch (e) { return true; } };
  const gestCfg = () => { const d = { copyLong: 'share' }; try { return Object.assign(d, JSON.parse(lsGet('rs_cs_gest', '{}')) || {}); } catch (e) { return d; } };
  const OVERLAYS = '#fnWarn.show, #fnNotice, .rs-ov.show, .rs-sheet-ov.show, #tocOverlay.show, #cbTocOverlay.show, #savedPositionsOverlay.show, #fnWarn.show, #fnNotice, #glossaryOverlay.show, #settingsOverlay.show, #advancedSettingsOverlay.show, #starSheetOverlay.show, #rsShareOv, #miniMenuOverlay.show, #dcWelcome, #ccFilm, #ccShare, #ccMock, #ccConfirm';
  const busy = () => {
    try {
      if (document.querySelector(OVERLAYS)) return true;
      if (Date.now() - (window.__fnEnd || 0) < 3500) return true;
      if (RSD.hubOpen && RSD.hubOpen()) return true;
      if (RSD.stageOpen && RSD.stageOpen()) return true;
      const bar = $('csBar'); if (bar && getComputedStyle(bar).display !== 'none') return true;
      if (document.body.classList.contains('split-active')) return true;
      const a = $('autoScrollBar'); if (a && a.classList.contains('show')) return true;
    } catch (e) {}
    return false;
  };
  RSD.ctxOn = ctxOn;
  RSD.coachFlag = flag;

  function handSvg(two) {
    const fing = two
      ? '<rect x="13" y="3" width="13" height="40" rx="6.5"/><rect x="26" y="3" width="13" height="40" rx="6.5"/><rect x="38" y="25" width="10.5" height="22" rx="5.25"/><rect x="47" y="30" width="8.5" height="17" rx="4.25"/>'
      : '<rect x="13" y="3" width="13" height="42" rx="6.5"/><rect x="25" y="21" width="12" height="26" rx="6"/><rect x="36" y="26" width="10.5" height="22" rx="5.25"/><rect x="45.5" y="31" width="8.5" height="17" rx="4.25"/>';
    const palm = '<rect x="9" y="34" width="46" height="36" rx="17"/><rect x="3.5" y="40" width="14" height="24" rx="7" transform="rotate(-22 10.5 52)"/>';
    const crease = two ? '<path d="M25.6 38v-5M38 38v-4"/>' : '<path d="M24.8 46l.2-8M36 48l.2-7M45.4 50l.1-5"/>';
    const nails = two ? '<rect x="16" y="6" width="7" height="8" rx="3.5"/><rect x="29" y="6" width="7" height="8" rx="3.5"/>' : '<rect x="16" y="6" width="7" height="8" rx="3.5"/>';
    return `<svg class="hd" viewBox="0 0 60 84" overflow="visible" style="overflow:visible" aria-hidden="true" focusable="false">
      <defs><linearGradient id="ccSk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#F1D9BB"/></linearGradient>
      <linearGradient id="ccCuff" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="var(--accent-l, #D9694A)"/><stop offset="1" stop-color="var(--accent, #C0502C)"/></linearGradient></defs>
      <g fill="#3a2716" stroke="#3a2716" stroke-width="3.2" stroke-linejoin="round">${fing}${palm}</g>
      <g fill="url(#ccSk)">${fing}${palm}</g>
      <g fill="none" stroke="#7a5532" stroke-opacity=".38" stroke-width="1.4" stroke-linecap="round">${crease}</g>
      <g fill="#fff" fill-opacity=".72">${nails}</g>
      <path d="M14 64c4 3 9 4.500 16 4.500s12-1.500 16-4.500" fill="none" stroke="#C9A67C" stroke-opacity=".5" stroke-width="1.6" stroke-linecap="round"/>
      <rect x="11" y="67" width="40" height="17" rx="6.500" fill="url(#ccCuff)" stroke="#3a2716" stroke-width="2.4"/>
      <path d="M15 71.500h32" stroke="#fff" stroke-opacity=".34" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M19 76.500v3.500M26 76.500v3.500M33 76.500v3.500M40 76.500v3.500" stroke="#3a2716" stroke-opacity=".22" stroke-width="1.5" stroke-linecap="round"/>
    </svg><i class="tp a"></i><i class="tp b"></i>`;
  }
  function makeHand(fx, two) {
    const el = document.createElement('div'); el.className = 'cc-hand' + (two ? ' two' : ''); el.innerHTML = handSvg(two); fx.appendChild(el);
    const api = {
      el, x: 0, y: 0,
      clamp(x, y) { x += 2; y += 11; const w = fx.clientWidth, h = fx.clientHeight; if (w > 40 && h > 40) { x = Math.max(10, Math.min(w - 10, x)); y = Math.max(8, Math.min(h - 34, y)); } return [x, y]; },
      place(x, y) { [x, y] = api.clamp(x, y); el.style.transition = 'none'; el.style.transform = `translate(${x}px,${y}px)`; api.x = x; api.y = y; void el.offsetWidth; },
      go(x, y, ms, ease) { [x, y] = api.clamp(x, y); el.style.transition = `transform ${ms}ms ${ease || 'var(--cc-ease)'}, opacity .35s ease`; el.style.transform = `translate(${x}px,${y}px)`; api.x = x; api.y = y; },
      show() { el.classList.add('on'); }, hide() { el.classList.remove('on'); el.classList.remove('down'); },
      down() { el.classList.add('down'); }, up() { el.classList.remove('down'); },
      ripple() { const r = document.createElement('i'); r.className = 'cc-rip'; r.style.left = api.x + 'px'; r.style.top = (api.y + 4) + 'px'; fx.appendChild(r); setTimeout(() => r.remove(), 1000); }
    };
    return api;
  }
  const ease = (t) => (t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  function tween(ms, fn, alive) {
    ms = Math.max(60, Math.round(ms * SPD));
    return new Promise((res) => { const t0 = performance.now(); (function f(now) { const t = Math.min(1, (now - t0) / ms); fn(ease(t), t); if (t < 1 && (!alive || alive())) requestAnimationFrame(f); else res(); })(t0); });
  }
  const CANCEL = { cancel: true };
  function makeSideNote(fx) {
    const host = fx.parentElement;
    const card = host && host.querySelector('.cs-card, .mk-card');
    const el = document.createElement('div'); el.className = 'cc-note'; el.setAttribute('aria-live', 'polite');
    el.innerHTML = '<ol class="cn-list"></ol><button type="button" class="cn-ok"><i class="ti ti-check"></i><span>عَلِمتُ</span></button>';
    (card || fx).appendChild(el);
    const list = el.querySelector('.cn-list'), okb = el.querySelector('.cn-ok');
    let pend = null;
    const api = {
      el,
      step(icon, text) {
        qa('li.now', list).forEach((l) => l.classList.remove('now'));
        const li = document.createElement('li'); li.className = 'now';
        li.innerHTML = (icon ? `<i class="ti ti-${icon}"></i>` : '') + `<span>${text}</span>`;
        list.appendChild(li); el.classList.add('on'); return li;
      },
      show(hand, icon, text) { return api.step(icon, text); },
      ask(icon, text, btn) {
        if (text) api.step(icon, text);
        return new Promise((res) => {
          pend = res; okb.querySelector('span').textContent = btn || 'عَلِمتُ';
          el.classList.add('ask'); okb.disabled = true;
          setTimeout(() => { okb.disabled = false; }, 650);
          okb.onclick = () => { if (okb.disabled) return; pend = null; el.classList.remove('ask'); res(); };
        });
      },
      clear() { list.innerHTML = ''; el.classList.remove('ask'); },
      hide() { },
      end() { if (pend) { const r = pend; pend = null; r(); } }
    };
    return api;
  }

  function welcomeClose(after) {
    const o = $('dcWelcome'); if (!o) return;
    lsSet('rs_dc_welcome', '1'); lsSet('rs_cc_welcome', '1');
    o.classList.remove('show'); setTimeout(() => o.remove(), 520);
    try { RSD.refresh && RSD.refresh(); } catch (e) {}
    try { document.dispatchEvent(new CustomEvent('rsd-welcome-done')); } catch (e) {}
    if (after) setTimeout(after, 560);
  }
  function openWelcome() {
    if ($('dcWelcome')) return;
    const o = document.createElement('div'); o.id = 'dcWelcome'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-label', 'مرحباً بك في مشكاة الفقه');
    o.innerHTML = `<div class="wv-body">${RSD.nicheHtml(.62)}<h1>مشكاة الفقه</h1><p class="wv-lead">حركات مخفية توفّر وقتك</p></div>
      <div class="wv-choices">
        <button type="button" class="wv-opt main" data-a="ctx"><span class="wi"><i class="ti ti-bulb"></i></span><span class="wt"><b>أرشدني أثناء الاستخدام</b><span>تلميحة قصيرة في وقتها</span></span><i class="ti ti-chevron-left wg"></i></button>
        <button type="button" class="wv-opt" data-a="all"><span class="wi"><i class="ti ti-list-details"></i></span><span class="wt"><b>الدليل كاملاً الآن</b><span>كل الحركات في مكان واحد</span></span><i class="ti ti-chevron-left wg"></i></button>
        <button type="button" class="wv-skip" data-a="skip">تخطّي كل التعليمات</button>
      </div>
      <div class="wv-warn" hidden><div class="ww-card"><span class="ww-ic"><i class="ti ti-alert-triangle"></i></span><b>لا يُنصح بالتخطّي</b><p>في التطبيق حركات مخفية لا تظهر على الشاشة ولا يمكن اكتشافها بالمصادفة (النسخ والمشاركة، ألوان النجمة، الدبوس، تقسيم الشاشة، ترتيب المراجع). تخطَّ فقط إن كنت لا تحتاج إلى أي شرح إطلاقاً.</p>
        <button type="button" class="wv-opt main ww-keep" data-a="back"><b>رجوع، سأتعلّمها</b></button><button type="button" class="ww-hold" disabled><i class="fill"></i><span>تخطَّ رغم ذلك: اضغط مطوّلاً للتأكيد</span></button></div></div>`;
    document.body.appendChild(o);
    o.addEventListener('click', (e) => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      const wn = q('.wv-warn', o);
      if (b.dataset.a === 'skip') { wn.hidden = false; requestAnimationFrame(() => wn.classList.add('on')); return; }
      if (b.dataset.a === 'back') { wn.classList.remove('on'); setTimeout(() => { wn.hidden = true; }, 200); return; }
      if (b.dataset.a === 'skipgo') { lsSet('rs_coach_ctx', '0'); welcomeClose(); try { const H = window.RSHints; if (H && H.toggleOff && lsGet('rs_hints_off', '0') !== '1') H.toggleOff(); else lsSet('rs_hints_off', '1'); } catch (x) { lsSet('rs_hints_off', '1'); } return; }
      if (b.dataset.a === 'ctx') { lsSet('rs_coach_ctx', '1'); welcomeClose(); }
      else { lsSet('rs_coach_ctx', '0'); welcomeClose(() => { try { RSD.open(); } catch (x) {} }); }
    });
    (function () {
      const hb = q('.ww-hold', o), fill = q('.fill', o); let t0 = 0, raf = 0, fired = false, armT = 0;
      const go = () => { if (fired) return; fired = true; const a = o.querySelector('[data-a="skipgo"]'); lsSet('rs_coach_ctx', '0'); welcomeClose(); try { const H = window.RSHints; if (H && H.toggleOff && lsGet('rs_hints_off', '0') !== '1') H.toggleOff(); else lsSet('rs_hints_off', '1'); } catch (x) { lsSet('rs_hints_off', '1'); } };
      const stop = () => { cancelAnimationFrame(raf); raf = 0; t0 = 0; if (!fired) fill.style.transform = 'scaleX(0)'; };
      const step = () => { if (!t0) return; const p = Math.min(1, (performance.now() - t0) / 1800); fill.style.transform = `scaleX(${p})`; if (p >= 1) { go(); return; } raf = requestAnimationFrame(step); };
      const start = (e) => { if (hb.disabled || fired) return; e.preventDefault(); t0 = performance.now(); try { navigator.vibrate && navigator.vibrate(8); } catch (x) {} raf = requestAnimationFrame(step); };
      ['pointerdown', 'touchstart'].forEach((ev) => hb.addEventListener(ev, start, { passive: false }));
      ['pointerup', 'pointercancel', 'pointerleave', 'touchend', 'touchcancel'].forEach((ev) => hb.addEventListener(ev, stop));
      hb.addEventListener('contextmenu', (e) => e.preventDefault());
      hb.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
      new MutationObserver(() => { const wn = q('.wv-warn', o); clearTimeout(armT); hb.disabled = true; stop(); if (wn && !wn.hidden) armT = setTimeout(() => { hb.disabled = false; }, 2000); }).observe(q('.wv-warn', o), { attributes: true, attributeFilter: ['hidden'] });
    })();
    requestAnimationFrame(() => requestAnimationFrame(() => o.classList.add('show')));
  }
  RSD.welcome = openWelcome;

  let film = null;
  const FILM_STEPS = () => {
    const s = [];
    if (swipeOn()) {
      s.push({ k: 'next', ic: 'arrows-horizontal', b: 'السحب لليمين', t: 'للانتقال إلى الفصل التالي', chip: ['arrow-right', 'الفصل التالي'] });
      s.push({ k: 'prev', ic: 'arrows-horizontal', b: 'السحب لليسار', t: 'للعودة إلى الفصل السابق', chip: ['arrow-left', 'الفصل السابق'] });
    }
    s.push({ k: 'auto', ic: 'hand-two-fingers', b: 'السحب بإصبعين للأسفل', t: 'يتحرك الكتاب تلقائياً، ولمسة واحدة توقفه', chip: ['arrow-down', 'تمرير تلقائي'] });
    return s;
  };
  function startFilm() {
    if (film || $('ccFilm')) return;
    const steps = FILM_STEPS();
    const o = document.createElement('div'); o.id = 'ccFilm'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-label', 'كيف تتنقل داخل الكتاب');
    o.innerHTML = `<div class="cc-scrim"></div><div class="cc-fx"></div><div class="cc-chip" id="ccChip"></div>
      <div class="cc-card">
        <button type="button" class="cc-x" data-a="x" aria-label="إغلاق"><i class="ti ti-x"></i></button>
        <h2>${steps.length > 1 ? 'ثلاث حركات للقراءة' : 'حركة للقراءة'}</h2>
        <ol class="cc-steps">${steps.map((s, i) => `<li data-i="${i}"><span class="ic"><i class="ti ti-${s.ic}"></i></span><span class="tx"><b>${s.b}</b><span>${s.t}</span></span></li>`).join('')}</ol>
        <div class="cc-legend"><b>علامات الحركات المخفية على الأزرار</b>
          <div class="lg"><span class="dc-dots n2"><i></i><i></i></span><span><b>نقطتان</b> = حركتان مخفيتان: ضغطتان متتاليتان، وضغطة مطوّلة</span></div>
          <div class="lg"><span class="dc-dots n1"><i></i></span><span><b>نقطة</b> = حركة مخفية واحدة: ضغطة مطوّلة (اضغط واستمر)</span></div>
        </div>
        <button type="button" class="cc-ok" data-a="ok"><i class="ti ti-check"></i>حسناً</button>
      </div>`;
    document.body.appendChild(o);
    const fx = q('.cc-fx', o), chip = q('#ccChip', o);
    const c = $('content');
    const f = film = { o, fx, chip, run: 0, c, y0: c ? c.scrollTop : 0, hand1: null, hand2: null, closed: false };
    o.addEventListener('click', (e) => { const b = e.target.closest('[data-a]'); if (b) closeFilm(); });
    ['touchmove', 'wheel'].forEach((ev) => q('.cc-scrim', o).addEventListener(ev, (e) => e.preventDefault(), { passive: false }));
    requestAnimationFrame(() => requestAnimationFrame(() => o.classList.add('show')));
    if (reduced()) { qa('.cc-steps li', o).forEach((li) => li.classList.add('on')); return; }
    playFilm(f, steps);
  }
  async function playFilm(f, steps) {
    const my = ++f.run, alive = () => !f.closed && f.run === my;
    const w = async (ms) => { await sleep(ms); if (!alive()) throw CANCEL; };
    const W = innerWidth, H = innerHeight, y = Math.round(H * .24);
    const lis = qa('.cc-steps li', f.o);
    const on = (i) => lis.forEach((li, j) => li.classList.toggle('on', j === i));
    const chipAt = (s, x, yy) => { f.chip.innerHTML = `<i class="ti ti-${s.chip[0]}"></i>${s.chip[1]}`; f.chip.style.left = x + 'px'; f.chip.style.top = yy + 'px'; void f.chip.offsetWidth; f.chip.classList.add('on'); };
    const chipOff = () => f.chip.classList.remove('on');
    const c = f.c;
    const nudge = (dx) => { if (!c) return; c.style.transition = 'transform .9s var(--cc-ease)'; c.style.transform = dx ? `translateX(${dx}px)` : ''; };
    f.clean = () => { try { if (c) { c.style.transform = ''; setTimeout(() => { c.style.transition = ''; }, 700); } } catch (e) {} };
    try {
      await w(900);
      const h1 = f.hand1 = makeHand(f.fx, false), h2 = f.hand2 = makeHand(f.fx, true);
      for (let loop = 0; loop < 2; loop++) {
        for (let i = 0; i < steps.length; i++) {
          const s = steps[i]; on(i);
          if (s.k === 'next' || s.k === 'prev') {
            const x0 = s.k === 'next' ? W * .3 : W * .7, x1 = s.k === 'next' ? W * .7 : W * .3;
            h1.place(x0, y + 26); h1.show(); await w(80);
            h1.go(x0, y, 520); await w(560);
            h1.down(); h1.ripple(); await w(260);
            chipAt(s, (x0 + x1) / 2, y - 84);
            nudge(s.k === 'next' ? 30 : -30);
            h1.go(x1, y, 1000); await w(1050);
            h1.up(); nudge(0); await w(500);
            chipOff(); h1.go(x1, y + 30, 450); h1.hide(); await w(800);
          } else {
            const xc = W * .5, y0 = Math.round(H * .15), y1 = Math.round(H * .33);
            h2.place(xc, y0 + 26); h2.show(); await w(80);
            h2.go(xc, y0, 520); await w(560);
            h2.down(); h2.ripple(); await w(260);
            chipAt(s, xc, y0 - 78);
            const from = c ? c.scrollTop : 0;
            h2.go(xc, y1, 1600);
            await tween(1600, (e) => { if (c) c.scrollTop = from + 240 * e; }, alive);
            if (!alive()) throw CANCEL;
            h2.up(); await w(380);
            chipOff(); h2.hide();
            tween(800, (e) => { if (c) c.scrollTop = from + 240 * (1 - e); }, alive);
            await w(1000);
          }
        }
        on(-1); await w(700);
      }
      lis.forEach((li) => li.classList.add('on'));
    } catch (e) { if (e !== CANCEL) console.warn('coach film', e); }
  }
  function closeFilm() {
    const f = film; if (!f || f.closed) return;
    f.closed = true; f.run++; film = null;
    setFlag('film'); RSD._filmEnd = Date.now();
    try { f.clean && f.clean(); if (f.c) f.c.scrollTop = f.y0; } catch (e) {}
    f.o.classList.remove('show'); setTimeout(() => f.o.remove(), 700);
  }

  let scene = null;
  function blockSnippet(b) {
    try {
      const c = b.cloneNode(true);
      c.querySelectorAll('.masala-tools, .cmp-accordion, .note-display, .ms-inline-flag, .sharh-chooser, sup').forEach((n) => n.remove());
      let t = (c.textContent || '').replace(/\s+/g, ' ').trim();
      t = t.replace(/^(مسألة|سؤال)\s*[:(]?\s*[\d٠-٩]+\s*[:)]?\s*/, '');
      return t.slice(0, 190);
    } catch (e) { return ''; }
  }
  function refLine() {
    try { const bk = allBooks.find((x) => x.id === currentBookId); const au = bk && allAuthors[bk.author_id]; return [bk && bk.name, au].filter(Boolean).join(' — ') || 'مشكاة الفقه'; } catch (e) { return 'مشكاة الفقه'; }
  }
  const MINI_LAMP = '<img src="icons/icon-192.png" alt="" width="18" height="18" style="border-radius:5px">';
  function startShare(block) {
    if (scene || $('ccShare')) return;
    setFlag('share'); setFlag('m_star'); setFlag('m_pin'); try { const H = window.RSHints; if (H && H.learn) { H.learn('pinGuide'); } } catch (e) {}
    const txt = blockSnippet(block) || 'يجب على المكلف تعلّم أحكام ما يبتلى به من الصلاة والطهارة.';
    const o = document.createElement('div'); o.id = 'ccShare'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-label', 'حركات الأزرار: النسخ والنجمة والدبوس');
    const dots = (n) => `<span class="dc-dots n${n}">${'<i></i>'.repeat(n)}</span>`;
    o.innerHTML = `<div class="cc-scrim"></div>
      <div class="cs-card">
        <div class="cc-eyebrow"><i class="ti ti-hand-finger"></i>حركات مخفية في الأزرار</div>
        <h2 class="cs-h">النسخ والمشاركة</h2>
        <div class="cs-stage">
          <div class="cs-lab"></div>
          <div class="cs-tools">
            <span class="tb copy"><i class="ico cp ti ti-clipboard"></i><i class="ico sh ti ti-share-3"></i><span class="ring"></span>${dots(1)}</span>
            <span class="tb star"><i class="ti ti-star"></i><span class="ring"></span>${dots(2)}</span>
            <span class="tb"><i class="ti ti-pencil"></i></span>
            <span class="tb"><i class="ti ti-file-plus"></i></span>
          </div>
          <div class="cs-pal">${['#E0A526', '#D9534F', '#4C9A6A', '#3E7CB1', '#8E5BB0'].map((c) => `<b style="background:${c}"></b>`).join('')}</div>
          <div class="cs-pinwrap"><span class="tb pin"><i class="ti ti-map-pin"></i><span class="ring"></span>${dots(2)}</span></div>
          <div class="cs-out"></div>
        </div>
        <div class="cs-sheet">
          <div class="sh-hd"><i class="ti ti-photo-share"></i>مشاركة كصورة</div>
          <div class="cs-img"><div class="im-t"></div><div class="im-f">${MINI_LAMP}<span class="im-r"></span></div></div>
        </div>
        <button type="button" class="cs-ok" data-a="ok"><i class="ti ti-check"></i>حسناً</button>
      </div>
      <div class="cc-fx"></div>`;
    document.body.appendChild(o);
    q('.im-t', o).textContent = txt; q('.im-r', o).textContent = refLine();
    ['touchmove', 'wheel', 'contextmenu'].forEach((ev) => o.addEventListener(ev, (e) => e.preventDefault(), { passive: false }));
    const s = scene = { o, run: 0, closed: false, finished: false, block };
    o.addEventListener('click', (e) => { if (e.target.closest('[data-a="ok"]') && s.finished) closeShare(); });
    requestAnimationFrame(() => requestAnimationFrame(() => o.classList.add('show')));
    if (reduced()) { o.classList.add('sheet'); s.finished = true; const sn0 = makeSideNote(q('.cc-fx', o)); ['ضغطة واحدة: تنسخ النص|clipboard', 'ضغطة مطوّلة: مشاركة كصورة|photo', 'النجمة: ضغطة أو ضغطتان أو مطوّلة لألوان مختلفة|star', 'الدبوس: ضغطة قائمة، ضغطتان تتبّع، مطوّلة تقسيم الشاشة|map-pin'].forEach((t) => { const [x, i] = t.split('|'); sn0.step(i, x); }); sn0.ask(null, null, 'عَلِمتُ').then(() => closeShare()); return; }
    playShare(s);
  }
  const SPLIT_OUT = '<span class="mk-phone"><b class="p1"><i></i><i></i><i></i></b><b class="p2"><i></i><i></i><i></i></b></span>';
  async function playShare(s) {
    const my = ++s.run, alive = () => !s.closed && s.run === my;
    const w = async (ms) => { await sleep(ms); if (!alive()) throw CANCEL; };
    const o = s.o, lab = q('.cs-lab', o), ok = q('.cs-ok', o), h2 = q('.cs-h', o), out = q('.cs-out', o), pal = q('.cs-pal', o);
    const copy = q('.tb.copy', o), star = q('.tb.star', o), pin = q('.tb.pin', o);
    const C = [ '#E0A526', '#D9534F', '#4C9A6A', '#3E7CB1', '#8E5BB0' ];
    const center = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
    const fx = q('.cc-fx', o); let hand = null;
    const sn = makeSideNote(fx);
    const label = (ic, t) => { if (hand) sn.show(hand, ic, t); };
    const ask = async (ic, t, b) => { await sn.ask(ic, t, b); if (!alive()) throw CANCEL; };
    const press = async (el, kind) => {
      const ring = q('.ring', el);
      if (kind === 'tap') { hand.down(); hand.ripple(); el.classList.add('press'); await w(220); hand.up(); el.classList.remove('press'); }
      else if (kind === 'dbl') { for (let i = 0; i < 2; i++) { hand.down(); hand.ripple(); el.classList.add('press'); await w(150); hand.up(); el.classList.remove('press'); await w(i ? 80 : 130); } }
      else { hand.down(); hand.ripple(); el.classList.add('press'); ring.classList.add('on'); await tween(1150, (e) => ring.style.setProperty('--p', String(Math.round(e * 100))), alive); if (!alive()) throw CANCEL; hand.ripple(); ring.classList.remove('on'); try { navigator.vibrate && navigator.vibrate(14); } catch (e) {} el.classList.remove('press'); }
    };
    const goTo = async (el) => { const p = center(el); hand.place(p.x + 40, p.y + 84); hand.show(); await w(80); hand.go(p.x, p.y, 760); await w(820); };
    const slide = async (el) => { const p = center(el); hand.up(); hand.go(p.x, p.y, 700); await w(760); };
    const showOut = (html) => { out.classList.remove('on'); setTimeout(() => { if (!alive()) return; out.innerHTML = html; out.classList.add('on'); }, 180); };
    try {
      await w(900);
      hand = makeHand(fx, false);
      const hold = (ms) => w(ms);
      const done = async () => { await sn.ask(null, null, 'عَلِمتُ'); if (!alive()) throw CANCEL; sn.clear(); };
      sn.step('point', 'النقاط الصغيرة على الزر تعني حركات مخفية فيه'); await hold(1400);
      await goTo(copy);
      sn.step('clipboard', 'ضغطة واحدة: تنسخ النص');
      await press(copy, 'tap'); await hold(1500);
      sn.step('hand-finger', 'ضغطة مطوّلة: تتحوّل إلى «مشاركة كصورة»');
      await hold(600); await press(copy, 'long'); copy.classList.add('morph'); hand.ripple(); await w(600);
      hand.up(); hand.go(center(copy).x + 30, center(copy).y + 60, 600); hand.hide(); await w(500);
      o.classList.add('sheet');
      sn.step('photo', 'تظهر معاينة جاهزة للحفظ أو الإرسال'); await hold(1500);
      await done();
      o.classList.remove('sheet'); await w(700); copy.classList.remove('morph');
      h2.textContent = 'النجمة'; await w(300);
      const sic = q('i', star);
      await goTo(star);
      sn.step('star', 'ضغطة واحدة: اللون الأول');
      await press(star, 'tap'); sic.className = 'ti ti-star-filled'; sic.style.color = C[0]; await hold(1500);
      sn.step('star', 'ضغطتان متتاليتان: اللون الثاني');
      await press(star, 'dbl'); sic.style.color = C[1]; await hold(1500);
      sn.step('palette', 'ضغطة مطوّلة: تظهر كل الألوان');
      await hold(500); await press(star, 'long'); pal.classList.add('on'); await hold(1500);
      await done();
      hand.hide(); pal.classList.remove('on'); await w(500);
      o.classList.add('pinmode'); h2.textContent = 'الدبوس وتقسيم الشاشة'; await w(800);
      await goTo(pin);
      sn.step('list', 'ضغطة واحدة: مواقعك المحفوظة');
      await press(pin, 'tap'); showOut('<span class="mk-list"><b></b><b></b><b></b></span>'); await hold(1500);
      sn.step('arrows-exchange', 'ضغطتان متتاليتان: تتبّع هذا الكتاب');
      await press(pin, 'dbl'); showOut('<span class="mk-trk"><i class="ti ti-map-pin-filled"></i><i class="ti ti-arrows-exchange"></i><i class="ti ti-book-2"></i></span>'); await hold(1500);
      sn.step('layout-columns', 'ضغطة مطوّلة: تقسيم الشاشة إلى كتابين');
      await hold(500); await press(pin, 'long'); showOut(SPLIT_OUT); await w(300);
      q('.mk-phone', out) && setTimeout(() => { const ph = q('.mk-phone', out); if (ph && alive()) ph.classList.add('split'); }, 500);
      await hold(1700);
      await done();
      hand.hide(); s.finished = true; closeShare(); return;
    } catch (e) { if (e !== CANCEL) console.warn('coach share', e); }
  }
  function closeShare() {
    const s = scene; if (!s || s.closed) return;
    s.closed = true; s.run++; scene = null; RSD._filmEnd = Date.now();
    s.o.classList.remove('show'); setTimeout(() => s.o.remove(), 650);
    setTimeout(() => {
      try {
        const b = s.block && s.block.isConnected ? s.block : null; if (!b) return;
        if (!b.classList.contains('touched')) b.classList.add('touched');
        const cp = q('.masala-tools > button:first-child', b); if (!cp) return;
        cp.classList.add('cc-try'); setTimeout(() => cp.classList.remove('cc-try'), 6000);
      } catch (e) {}
    }, 500);
  }
  RSD.demoShare = () => { const b = q('#readerPage .masala-block'); if (b) startShare(b); };
  RSD.demoFilm = () => { if (RSD.demoReader) RSD.demoReader(); };

  let shareTimer = 0;
  document.addEventListener('click', (e) => {
    try {
      const b = e.target && e.target.closest && e.target.closest('#readerPage .masala-block');
      if (!b || e.target.closest('button, .ms-inline-flag, .gterm, sup, a')) return;
      if (!ctxOn() || flag('share') || !flag('hd_reader') || scene || film || (RSD.hdBusy && RSD.hdBusy())) return;
      if (gestCfg().copyLong === 'off') return;
      clearTimeout(shareTimer);
      const attempt = () => {
        if (!readerActive() || scene || film || flag('share') || !ctxOn()) return;
        const wait = 12000 - (Date.now() - (RSD._filmEnd || 0));
        if (wait > 0) { shareTimer = setTimeout(attempt, wait + 200); return; }
        const blk = b.isConnected && b.classList.contains('touched') ? b : null;
        if (!blk || busy()) return;
        const r = blk.getBoundingClientRect(); if (r.bottom < 100 || r.top > innerHeight - 100) return;
        startShare(blk);
      };
      shareTimer = setTimeout(attempt, 1500);
    } catch (x) {}
  }, true);

  const _ct = window.closeTopOverlayOnBack;
  if (typeof _ct === 'function') window.closeTopOverlayOnBack = function () {
    if (scene) { if (scene.finished) closeShare(); return true; }
    if (film) { closeFilm(); return true; }
    return _ct.apply(this, arguments);
  };

  const TAG = (ic) => `<span class="tag"><i class="ti ti-${ic}"></i></span>`;
  const SECTIONS = {
    books: { ic: 'notebook', t: 'كتبي: كتب خاصة بك', p: `تجمع فيها المسائل التي تختارها من أي كتاب، وتضيف ملاحظاتك بينها. يُنشأ الكتاب بزر ${TAG('plus')} في الأعلى، ثم تُضاف إليه المسائل أثناء القراءة بالنقر على المسألة ثم على أيقونة «إضافة لكتابي» ${TAG('file-plus')}.` },
    cols: { ic: 'folders', t: 'مجموعاتي: حقائب للمراجع والكتب', p: `تضم كتباً ومراجع وكتباً خاصة تُحتاج معاً تحت اسم واحد، مثل «مسائل الحج»، لتُفتح بضغطة واحدة. تُنشأ المجموعة بزر ${TAG('plus')} ثم تُضاف إليها العناصر من داخلها.` },
    wr: { ic: 'pencil', t: 'كتاباتي: دفتر حرّ', p: `لكتابة ما تشاء دون قيد: خلاصة درس أو فائدة أو سؤال يُراد الرجوع إليه. يفتح زر ${TAG('plus')} كتابة جديدة، ويمكن تصدير الكتابة بصيغة PDF.` }
  };
  function secCardHtml(key, cls) {
    const s = SECTIONS[key];
    return `<div class="cc-secard ${cls || ''}" data-cc="${key}" role="note"><span class="se-ic"><i class="ti ti-${s.ic}"></i></span><div class="se-b"><b>${s.t}</b><p>${s.p}</p></div><button type="button" class="se-x" aria-label="إغلاق"><i class="ti ti-x"></i></button></div>`;
  }
  function dismissCard(card, key) {
    setFlag(key); card.classList.add('out'); setTimeout(() => card.remove(), 420);
    if (key === 'cb_edit') { const e = $('readerFabCbEdit'); if (e) e.classList.remove('cc-glow'); }
  }
  document.addEventListener('click', (e) => {
    const x = e.target.closest && e.target.closest('.cc-secard:not(.cc-float) .se-x'); if (!x) return;
    const card = x.closest('.cc-secard'); dismissCard(card, card.dataset.flag || ('sec_' + card.dataset.cc));
  });
  function hookWriting() {
    const rw = window.renderWritingPage; if (typeof rw !== 'function' || rw.__cc) return;
    const w = function () {
      const r = rw.apply(this, arguments);
      try {
        const pg = $('writingPage'); if (!pg || !ctxOn()) return r;
        const tab = (typeof personalState !== 'undefined' && personalState.tab) || 'books';
        if (!SECTIONS[tab] || flag('sec_' + tab) || (personalState.q || '').trim()) return r;
        const top = pg.querySelector('.personal-top'); if (!top) return r;
        top.insertAdjacentHTML('afterend', secCardHtml(tab));
      } catch (e) {}
      return r;
    };
    w.__cc = true; window.renderWritingPage = w;
  }

  function cbCard(kind) {
    const li = (ic, b, t) => `<li><span class="tag"><i class="ti ti-${ic}"></i></span><span><b>${b}</b> ${t}</span></li>`;
    const spec = {
      empty: { flag: 'cb_empty', ic: 'file-plus', t: 'الكتاب فارغ: ثلاث طرق للإضافة', list: [
        li('file-plus', 'من القراءة:', 'يُنقر على أي مسألة ثم على «إضافة لكتابي».'),
        li('highlight', 'من جزء من النص:', 'يُضغط مطوّلاً على كلمة ويُسحب المقبضان، ثم يُختار «إلى كتاب» من شريط التحديد.'),
        li('pencil', 'من كتابتك:', 'يُضغط زر القلم في الأسفل ثم علامة + بين العناصر لكتابة ما تريد.')] },
      edit: { flag: 'cb_edit', ic: 'pencil', t: 'ترتيب الكتاب', list: [
        li('pencil', 'زر القلم', 'في الأسفل يفتح أدوات البناء: ترتيب العناصر وحذفها وإضافة الملاحظات.'),
        li('folder-plus', 'المجلد (الفصل):', 'يجمع مجموعة من المسائل تحت عنوان واحد، ويظهر زره بعد فتح القلم.')] },
      tools: { flag: 'cb_tools', ic: 'tools', t: 'أدوات بناء الكتاب', list: [
        li('plus', 'علامة +', 'بين أي عنصرين: لإضافة ملاحظة من كتابتك في ذلك الموضع.'),
        li('folder-plus', 'فصل جديد:', 'مجلد يجمع مجموعة من المسائل تحت عنوان واحد، وزره في الشريط العلوي.'),
        li('link', 'الربط:', 'يُختار عنصران فأكثر لربطها معاً.'),
        li('pencil', 'القلم مجدداً:', 'ينهي التعديل ويعود إلى القراءة.')] }
    }[kind];
    return `<div class="cc-secard in-book" data-cc="cb" data-flag="${spec.flag}" role="note"><span class="se-ic"><i class="ti ti-${spec.ic}"></i></span><div class="se-b"><b>${spec.t}</b><ul class="se-list">${spec.list.join('')}</ul></div><button type="button" class="se-x" aria-label="إغلاق"><i class="ti ti-x"></i></button></div>`;
  }
  function bookCoach() {
    const pg = $('customBookPage'); if (!pg) return;
    qa('.cc-secard', pg).forEach((n) => n.remove());
    const fab = $('readerFabCbEdit'); if (fab) fab.classList.remove('cc-glow');
    if (!ctxOn()) return;
    let cb = null, edit = false, link = false;
    try { cb = customBooks.find((b) => b.id === currentCustomBookId); edit = !!customBookEditMode; link = !!customBookLinkMode; } catch (e) { return; }
    if (!cb) return;
    const n = (cb.items || []).length;
    if (edit && !flag('cb_edit')) setFlag('cb_edit');
    let kind = null;
    if (edit && !link && !flag('cb_tools')) kind = 'tools';
    else if (!edit && !n && !flag('cb_empty')) kind = 'empty';
    else if (!edit && n >= 2 && !flag('cb_edit')) kind = 'edit';
    if (!kind) return;
    const first = pg.firstElementChild;
    const html = cbCard(kind);
    if (first && /cb-topbar|cb-linkbar/.test(first.className)) first.insertAdjacentHTML('afterend', html);
    else pg.insertAdjacentHTML('afterbegin', html);
    if (kind === 'edit' && fab) fab.classList.add('cc-glow');
  }
  function hookBook() {
    const rb = window.renderCustomBookPage; if (typeof rb !== 'function' || rb.__cc) return;
    const w = function () { const r = rb.apply(this, arguments); try { bookCoach(); } catch (e) {} return r; };
    w.__cc = true; window.renderCustomBookPage = w;
  }

  const PIP = (n) => `<span class="dc-dots n${n}">${'<i></i>'.repeat(n)}</span>`;
  const glyph = (g) => (g === 'pip1' ? PIP(1) : g === 'pip2' ? PIP(2) : `<i class="ti ti-${g}"></i>`);
  const rowsHtml = (rows) => rows.map(([g, b, t]) => `<li><span class="tag${/^pip/.test(g) ? ' pg' : ''}">${glyph(g)}</span><span><b>${b}</b> ${t}</span></li>`).join('');
  const cardHtml = (id, ic, t, rows, cls) => `<div class="cc-secard ${cls || ''}" data-cc="pg" data-flag="${id}" role="note"><span class="se-ic"><i class="ti ti-${ic}"></i></span><div class="se-b"><b>${t}</b><ul class="se-list">${rowsHtml(rows)}</ul></div><button type="button" class="se-x" aria-label="إغلاق"><i class="ti ti-x"></i></button></div>`;
  const inView = (el, top, bot) => { if (!el || !el.isConnected) return false; const r = el.getBoundingClientRect(); return r.width > 4 && r.height > 4 && r.top >= (top == null ? 100 : top) && r.bottom <= innerHeight - (bot == null ? 150 : bot); };
  const anyInView = (sel) => qa(sel).some((n) => inView(n));
  const srcCtx = () => { try { return !!rsSrcCtx(); } catch (e) { return false; } };
  const inThamra = () => { try { return typeof isThamraBook === 'function' && isThamraBook(currentBookId); } catch (e) { return false; } };
  const cmpLevel = () => { try { return cmpNav && cmpNav.level; } catch (e) { return ''; } };

  const PAGE_CARDS_ALL = [
    { id: 'pg_lib', page: 'booksPage', ok: () => !q('#booksPage .reorder-active-bar') && !!q('#booksPage .lib-card'),
      put: (pg, el) => pg.insertBefore(el, pg.firstChild),
      html: () => cardHtml('pg_lib', 'books', 'المكتبة: اختصارات المراجع', [
        ['pip2', 'على اسم المرجع:', 'ضغطتان متتاليتان تفتحان آخر كتاب قُرئ عنده في الموضع نفسه، وضغطة مطوّلة تُدخل وضع ترتيب المكتبة.']]) },
    { id: 'pg_search', page: 'searchPage', ok: () => !!q('#searchPage .search-toolbar'),
      put: (pg, el) => q('#searchPage .search-toolbar').insertAdjacentElement('afterend', el),
      html: () => cardHtml('pg_search', 'search', 'أدوات البحث', [
        ['adjustments-horizontal', 'خيارات البحث:', 'تحدد طريقة المطابقة (كلمات متفرقة أو تطابق تام) ومكان البحث (العناوين أو النصوص أو الحواشي).'],
        ['filter-cog', 'استثناء وتثبيت:', 'الاستثناء يُخرج من النتائج ما يحوي كلمة معيّنة، والتثبيت يُلزم كل نتيجة بوجود كلمة معيّنة.'],
        ['books', 'المراجع والكتب:', 'تحدد المراجع والكتب التي يشملها البحث، ثم «حفظ كاختصار» لتطبيق الاختيار نفسه بضغطة واحدة لاحقاً.']]) },
    { id: 'pg_results', page: 'searchPage', ok: () => !!q('#searchResults .result-row') && !!$('searchResults'),
      put: (pg, el) => $('searchResults').insertAdjacentElement('beforebegin', el),
      html: () => cardHtml('pg_results', 'list-search', 'نتائج البحث', [
        ['arrows-horizontal', 'تقليب النتائج:', 'بعد فتح أي نتيجة، السحب لليمين ينقل إلى النتيجة التالية ولليسار إلى السابقة دون العودة إلى القائمة.'],
        ['pip1', 'حسب المرجع:', 'يجمع النتائج بحسب المراجع، والضغط المطوّل على الزر يتيح ترتيب المراجع.']]) },
    { id: 'pg_fav', page: 'favoritesPage', ok: () => !!q('#favoritesPage .swipe-row'),
      put: (pg, el) => pg.insertBefore(el, pg.firstChild),
      html: () => cardHtml('pg_fav', 'star', 'المفضلة', [
        ['arrows-horizontal', 'سحب الصف:', 'السحب لليمين يُظهر زرَّي الحذف والتذكير.'],
        ['pip1', 'ألوان المفضلة:', 'الضغط على لون يعرض مسائله وحده، والضغط المطوّل عليه يتيح ترتيب الألوان وتسميتها.']]) },
    { id: 'pg_jami', page: 'comparisonPage', ok: () => cmpLevel() === 'chapters' && !!q('#comparisonPage .list-row, #comparisonPage .cmp-tile'),
      put: (pg, el) => pg.insertBefore(el, pg.firstChild),
      html: () => cardHtml('pg_jami', 'chart-bar', 'جامع الاستفتاءات', [
        ['chart-bar', 'ما هو؟', 'يجمع أجوبة المراجع عن المسألة الواحدة متجاورة لتيسير المقارنة بينها.'],
        ['adjustments', 'ترتيب المراجع:', 'تقديم من يُراد، وإخفاء من لا يُراد، وتمييز من يُراد بلون. ويسري ذلك على جميع المسائل.']]) },
    { id: 'pg_jami2', page: 'comparisonPage', ok: () => cmpLevel() === 'compare',
      put: (pg, el) => pg.insertBefore(el, pg.firstChild),
      html: () => cardHtml('pg_jami2', 'users', 'مقارنة الأجوبة', [
        ['users', 'اسم المرجع:', 'النقر على اسمه في الشريط العلوي ينقل مباشرة إلى جوابه.'],
        ['arrows-horizontal', 'التقليب:', 'السحب لليمين ينقل إلى المسألة التالية ولليسار إلى السابقة.'],
        ['adjustments', 'ترتيب المراجع:', 'من الزر أعلى الصفحة لتخصيص الترتيب والإخفاء والتمييز.']]) }
  ];
  const PAGE_CARDS = PAGE_CARDS_ALL.filter((c) => c.id === 'pg_jami');
  function pageCards() {
    const act = activePage();
    for (const c of PAGE_CARDS) {
      if (c.page !== act || flag(c.id)) continue;
      const pg = $(c.page); if (!pg || pg.querySelector('[data-flag="' + c.id + '"]')) continue;
      let ok = false; try { ok = c.ok(); } catch (e) {}
      if (!ok) continue;
      const t = document.createElement('div'); t.innerHTML = c.html(); const el = t.firstElementChild; el.classList.add('pg-card');
      try { c.put(pg, el); } catch (e) {}
      return;
    }
  }

  const FLOATS = [
    { id: 'rf_swipeS', ok: () => srcCtx() && !inThamra() && swipeOn(), ic: 'list-search', t: 'تقليب نتائج البحث', rows: [['arrows-horizontal', 'السحب:', 'لليمين إلى النتيجة التالية، ولليسار إلى السابقة، دون العودة إلى قائمة النتائج.']] },
    { id: 'rf_refset', ok: () => { const b = $('urwaSettingsBtn'); return !!b && b.style.display !== 'none' && inView(b, 40, 40); }, glow: 'urwaSettingsBtn', ic: 'adjustments', t: 'التحكم بهوامش المراجع',
      rows: [['adjustments', 'زر الإعدادات', 'في أعلى الكتاب يتيح ترتيب أولوية المراجع في الهوامش، وإخفاء من لا يُراد، وتلوين من يُراد تمييزه.']] },
    { id: 'rf_flags', ok: () => anyInView('#readerPage .ms-sharh-flag'), ic: 'book-2', t: 'علامة الشرح',
      rows: [['book-2', 'أيقونة الكتاب', 'بجانب رقم المسألة: لها شرح مكتوب أو مرئي، ويُفتح بالنقر عليها.']] },
    { id: 'rf_pin', ok: () => !inThamra() && inView($('readerFabPosition'), 40, 10), ic: 'map-pin', t: 'الدبوس: حفظ الموضع',
      rows: [['hand-finger', 'ضغطة:', 'قائمة المواقع المحفوظة في كل الكتب.'], ['pip2', 'ضغطتان:', 'تتبّع هذا الكتاب لتعود إلى موضعك فيه من أي كتاب آخر.'], ['pip1', 'ضغطة مطوّلة:', 'تقسيم الشاشة لقراءة كتابين معاً.']] },
    { id: 'rf_words', ok: () => anyInView('#readerPage .gterm, #readerPage sup[onclick^="toggleFootnote"]'), ic: 'underline', t: 'الكلمات المسطّرة والحواشي',
      rows: [['underline', 'الكلمة المسطّرة:', 'النقر عليها يعرض معناها.'], ['notes', 'الرقم الصغير:', 'النقر عليه يعرض نص الحاشية تحت المسألة.']] },
    { id: 'rf_tools', ok: () => readMs > 50000, ic: 'tools', t: 'أدوات القراءة',
      rows: [['list', 'اسم الكتاب', 'في أعلى الشاشة: النقر عليه يفتح الفهرس وفيه بحث داخل الكتاب.'], ['zoom-in', 'إصبعان:', 'مباعدتهما تكبّر الخط وتقريبهما يصغّره.'], ['adjustments-horizontal', 'الشريط الجانبي:', 'على حافة الشاشة أثناء التمرير، للانتقال السريع داخل الباب.']] }
  ];
  let fl = null, flClosedAt = 0, readMs = 0;
  function closeFloat(save) {
    if (!fl) return; const f = fl; fl = null; flClosedAt = Date.now();
    if (save) setFlag(f.def.id);
    if (f.def.glow) { const g = $(f.def.glow); if (g) g.classList.remove('cc-glow2'); }
    f.el.classList.add('out'); setTimeout(() => f.el.remove(), 420);
  }
  function floatTick() {
    if (fl) { if (!readerActive() || (fl.def.id !== 'rf_swipeS' && false)) closeFloat(false); return; }
    if (!readerActive() || !flag('film') || film || scene || busy()) return;
    if (Date.now() - flClosedAt < 7000 || Date.now() - (RSD._filmEnd || 0) < 6000) return;
    for (const d of FLOATS) {
      if (flag(d.id)) continue;
      let ok = false; try { ok = d.ok(); } catch (e) {}
      if (!ok) continue;
      const t = document.createElement('div');
      t.innerHTML = `<div class="cc-secard cc-float" data-cc="rf" data-flag="${d.id}" role="note"><span class="se-ic"><i class="ti ti-${d.ic}"></i></span><div class="se-b"><b>${d.t}</b><ul class="se-list">${rowsHtml(d.rows)}</ul></div><button type="button" class="se-x" aria-label="إغلاق"><i class="ti ti-x"></i></button></div>`;
      const el = t.firstElementChild; document.body.appendChild(el);
      fl = { def: d, el };
      if (d.glow) { const g = $(d.glow); if (g) g.classList.add('cc-glow2'); }
      return;
    }
  }
  document.addEventListener('click', (e) => { const x = e.target.closest && e.target.closest('.cc-float .se-x'); if (x) { e.stopPropagation(); closeFloat(true); } }, true);

  let readerSince = 0;
  function tick() {
    try {
      if (document.visibilityState === 'visible' && readerActive()) readMs += 700;
      if (ctxOn() && lsGet('rs_cc_welcome', '') === '1' && !busy()) pageCards();
      if (document.visibilityState !== 'visible' || !ctxOn() || lsGet('rs_cc_welcome', '') !== '1') { readerSince = 0; return; }
    } catch (e) {}
  }
  RSD.cc = { makeHand, makeSideNote, tween, flag, setFlag, busy, activePage, readerActive, swipeOn, reduced, ctxOn, CANCEL, ease, getScene: () => scene };
  function init() {
    hookWriting(); hookBook();
    setInterval(tick, 700);
  }
  init();
  RSD.coachReady = true;
})();
