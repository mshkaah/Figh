(function () {
  'use strict';
  const RSD = window.RSD; if (!RSD || RSD.embedded || !RSD.cc) return;
  const { makeHand, makeSideNote, tween, flag, setFlag, busy, activePage, readerActive, swipeOn, reduced, ctxOn, CANCEL } = RSD.cc;
  const { $, q, qa, lsGet, lsSet } = RSD.util;
  const sleep = (ms) => RSD.util.sleep(Math.round(ms * 0.82));
  const GAP = 5500;
  let cur = null, mock = null, lastEnd = Date.now() - 3000, readMs = 0;
  let toolsOpen = false;
  RSD.hdBusy = () => !!(cur || mock || toolsOpen);

  function rectOf(el, pad) {
    try {
      if (!el || !el.isConnected) return null;
      const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') return null;
      const r = el.getBoundingClientRect(); if (r.width < 6 || r.height < 6) return null;
      const p = pad == null ? 70 : pad;
      if (r.top < p || r.bottom > innerHeight - p || r.left < 0 || r.right > innerWidth) return null;
      return r;
    } catch (e) { return null; }
  }
  const firstVis = (sel, pad) => { for (const n of qa(sel)) { if (rectOf(n, pad)) return n; } return null; };
  const ctr = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, r }; };

  const canTouch = (() => { try { const t = new Touch({ identifier: 1, target: document.body, clientX: 1, clientY: 1 }); return !!t && typeof TouchEvent === 'function'; } catch (e) { return false; } })();
  function fireTouch(type, target, pts) {
    const list = pts.map((p) => new Touch({ identifier: p.id, target, clientX: p.x, clientY: p.y, pageX: p.x, pageY: p.y, screenX: p.x, screenY: p.y, radiusX: 10, radiusY: 10, force: .5 }));
    const end = type === 'touchend' || type === 'touchcancel';
    target.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, composed: true, touches: end ? [] : list, targetTouches: end ? [] : list, changedTouches: list }));
  }
  const OURS = '#ccHd, #ccNote, #ccTools, #ccMock, #ccLibTip, #ccConfirm, #ccShare';
  const underEl = (x, y) => { try { for (const e of document.elementsFromPoint(x, y)) { if (!e.closest(OURS)) return e; } } catch (e) {} return document.body; };
  const overlapA = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  const handBox = (x, y, two) => ({ left: x - (two ? 30 : 24), right: x + (two ? 48 : 44), top: y - 8, bottom: y + 88 });
  const unionR = (a, b) => ({ left: Math.min(a.left, b.left), right: Math.max(a.right, b.right), top: Math.min(a.top, b.top), bottom: Math.max(a.bottom, b.bottom) });
  const visR = (sel) => { const out = []; for (const e of qa(sel)) { try { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < .2) continue; const r = e.getBoundingClientRect(); if (r.width > 6 && r.height > 6 && r.width * r.height < innerWidth * innerHeight * .7) out.push(r); } catch (x) {} } return out; };
  const GKX = (k) => (k === 'tap' ? '<span class="gk k-tap"><i></i></span>' : k === 'dbl' ? '<span class="gk k-dbl"><i></i><i></i></span>' : k === 'long' ? '<span class="gk k-long"><i></i><i></i></span>'
    : k === 'swipe' ? '<span class="gk k-ic"><i class="ti ti-arrows-horizontal"></i></span>' : k === 'two' ? '<span class="gk k-ic"><i class="ti ti-arrows-vertical"></i></span>' : `<span class="gk k-ic"><i class="ti ti-${k}"></i></span>`);
  const noteHtml = (def) => `<div class="nt-hd"><span class="nt-ic"><i class="ti ti-${def.ic || 'hand-finger'}"></i></span><span class="nt-t">${def.title || ''}</span><button type="button" class="nt-skip" data-a="skip">تخطّي</button></div>
    <ul class="nt-rows">${(def.rows || []).map(([k, b, t]) => `<li>${GKX(k)}<b>${b}</b><span class="tx">${t}</span></li>`).join('')}</ul><div class="nt-msg"></div>`;
  const fontNow = () => { try { return fontSize; } catch (e) { return null; } };

  function placeNote(d, rects) {
    const el = d.note; if (!el || !el.isConnected) return;
    const H = innerHeight, h = el.offsetHeight, nav = $('bottomnav'); let navTop = H;
    try { if (nav && getComputedStyle(nav).display !== 'none') { const r = nav.getBoundingClientRect(); if (r.height > 10) navTop = Math.min(H, r.top); } } catch (e) {}
    const top = 10, bot = Math.max(top, navTop - h - 10), W = innerWidth;
    const extra = visR('#csBar, #csMenu, .cs-handle, #searchOptionsRow, #searchRequireRow, #searchExcludeRow, #searchFilterPanel, [id$="SettingsOverlay"] > *, #miniMenuOverlay > *, .text-prompt-box, #textPromptOverlay > *');
    const av = rects.concat(extra).map((r) => ({ left: r.left - 12, right: r.right + 12, top: r.top - 12, bottom: r.bottom + 12 }));
    const calc = () => {
      const h = el.offsetHeight, bot = Math.max(top, navTop - h - 10);
      const sc = (y) => av.reduce((t, r) => t + overlapA({ left: 12, right: W - 12, top: y, bottom: y + h }, r), 0);
      return { st: sc(top), sb: sc(bot), bot };
    };
    el.classList.remove('compact');
    let c = calc();
    if (Math.min(c.st, c.sb) > 400) { el.classList.add('compact'); const c2 = calc(); if (Math.min(c2.st, c2.sb) < Math.min(c.st, c.sb)) c = c2; else el.classList.remove('compact'); }
    let side = c.st < c.sb ? 't' : c.sb < c.st ? 'b' : d.side;
    if (d.side && Math.abs(c.st - c.sb) < 600) side = d.side;
    d.side = side; el.style.top = (side === 't' ? top : c.bot) + 'px';
  }
  function runDemo(id, script, def) {
    if (cur || mock || toolsOpen || $('ccShare') || $('ccDots')) return false;
    def = def || {};
    const o = document.createElement('div'); o.className = 'cc-fx blk'; o.id = 'ccHd';
    o.innerHTML = '<i class="hd-ring"></i><div class="cc-chip"></div>';
    document.body.appendChild(o);
    const ring = q('.hd-ring', o), chip = q('.cc-chip', o);
    const d = cur = { id, o, closed: false, done: false, skipped: false, t0: Date.now(), glow: null, undo: [], note: null, side: 't', blk: true, keep: false };
    if (def.note) {
      const el = document.createElement('div'); el.id = 'ccNote'; el.setAttribute('role', 'dialog'); el.innerHTML = noteHtml(def.note); document.body.appendChild(el); d.note = el;
      el.addEventListener('click', (e) => { const b = e.target.closest('[data-a="skip"]'); if (b) { d.skipped = true; d.closed = true; finish(d); } });
      ['touchmove', 'wheel'].forEach((ev) => el.addEventListener(ev, (e) => e.preventDefault(), { passive: false }));
      requestAnimationFrame(() => { placeNote(d, []); requestAnimationFrame(() => el.classList.add('show')); });
    }
    setTimeout(() => { if (cur === d) { d.closed = true; finish(d); } }, 150000);
    const alive = () => !d.closed;
    const w = async (ms) => { await sleep(ms); if (!alive()) throw CANCEL; };
    const hand1 = makeHand(o, false), hand2 = makeHand(o, true);
    const A = {
      w, alive,
      glow(el) { if (d.glow) d.glow.classList.remove('cc-hd-t'); d.glow = el; if (el) el.classList.add('cc-hd-t'); },
      hl(i) { if (d.note) qa('.nt-rows li', d.note).forEach((li, j) => li.classList.toggle('on', j === i)); },
      okRow(i) { const li = d.note && qa('.nt-rows li', d.note)[i]; if (li) { li.classList.remove('on'); li.classList.add('ok'); } },
      msg(t) { if (d.note) { q('.nt-msg', d.note).textContent = t || ''; placeNote(d, d.lastRects || []); } },
      setNote(nd) { if (d.note) { d.note.innerHTML = noteHtml(nd); placeNote(d, d.lastRects || []); } },
      dodge(rects) { d.lastRects = rects || d.lastRects || []; placeNote(d, d.lastRects); },
      tryMode(on) { o.classList.toggle('try', !!on); d.keep = !!on; },
      say(text, icon, x, y, below, abs) {
        if (d.note) return;
        chip.innerHTML = (icon ? `<i class="ti ti-${icon}"></i>` : '') + text;
        chip.style.left = Math.max(84, Math.min(innerWidth - 84, x)) + 'px';
        chip.style.top = abs ? Math.round(y) + 'px' : (below ? y + 98 : Math.max(70, y - 84)) + 'px';
        void chip.offsetWidth; chip.classList.add('on');
      },
      hush() { chip.classList.remove('on'); },
      async arrive(h, x, y, fromDx, fromDy, extra, el) {
        { const two = h === hand2; let r = handBox(x, y, two); if (extra) r = unionR(r, extra); const t = d.target; A.dodge(t ? [unionR(r, t)] : [r]); d.target = null; await w(260); }
        if (el && el.isConnected) { try { const c = ctr(el); x = c.x; y = c.y; } catch (e) {} }
        h.place(x + (fromDx == null ? 34 : fromDx), y + (fromDy == null ? 64 : fromDy)); h.show(); await w(60);
        h.go(x, y, 620); await w(660);
        return { x, y };
      },
      async leave(h, el) { h.up(); if (el) el.classList.remove('cc-hd-p'); h.hide(); await w(380); },
      async tap(el, text, icon, opt) {
        let { x, y } = ctr(el); const h = hand1;
        A.glow(el); d.target = el.getBoundingClientRect();
        { const c2 = await A.arrive(h, x, y, undefined, undefined, undefined, el); x = c2.x; y = c2.y; }
        if (text) A.say(text, icon, x, y, opt && opt.below);
        h.down(); h.ripple(); el.classList.add('cc-hd-p'); await w(240);
        h.up(); el.classList.remove('cc-hd-p');
        if (opt && opt.click) { try { el.click(); } catch (e) {} const bl = () => { try { const a = document.activeElement; if (a && a.blur && /INPUT|TEXTAREA/.test(a.tagName)) a.blur(); } catch (e) {} }; bl(); setTimeout(bl, 90); setTimeout(bl, 220); await w(250); A.dodge(); if (opt.hold > 1500) { h.up(); h.hide(); } }
        await w(opt && opt.hold != null ? opt.hold : 1100);
        await A.leave(h, el); A.hush(); A.glow(null);
      },
      async dbl(el, text, icon, opt) {
        let { x, y } = ctr(el); const h = hand1;
        A.glow(el); d.target = el.getBoundingClientRect();
        { const c2 = await A.arrive(h, x, y, undefined, undefined, undefined, el); x = c2.x; y = c2.y; }
        for (let i = 0; i < 2; i++) { h.down(); h.ripple(); el.classList.add('cc-hd-p'); await w(150); h.up(); el.classList.remove('cc-hd-p'); await w(i ? 100 : 130); }
        if (text) A.say(text, icon, x, y, opt && opt.below);
        await w(1500);
        await A.leave(h, el); A.hush();
      },
      async long(el, text, icon, opt) {
        let { x, y } = ctr(el); const h = hand1;
        A.glow(el); d.target = el.getBoundingClientRect();
        { const c2 = await A.arrive(h, x, y, undefined, undefined, undefined, el); x = c2.x; y = c2.y; }
        ring.style.left = x + 'px'; ring.style.top = y + 'px'; ring.style.setProperty('--p', '0'); ring.classList.add('on');
        h.down(); h.ripple(); el.classList.add('cc-hd-p');
        await tween(1050, (e) => ring.style.setProperty('--p', String(Math.round(e * 100))), alive); if (!alive()) throw CANCEL;
        h.ripple(); try { navigator.vibrate && navigator.vibrate(12); } catch (e) {}
        if (text) A.say(text, icon, x, y, opt && opt.below);
        ring.classList.remove('on'); await w(1500);
        await A.leave(h, el); A.hush();
      },
      async swipe(x0, y0, x1, y1, ms, fallback, two, label) {
        const h = two ? hand2 : hand1;
        if (label) A.say(label, 'hand-finger', innerWidth / 2, two ? innerHeight * .74 : innerHeight * .2, false, true);
        await A.arrive(h, x0, y0, 0, 46, handBox(x1, y1, two));
        h.down(); h.ripple(); await w(200);
        if (!canTouch) {
          h.go(x1, y1, ms, 'cubic-bezier(.45,.05,.25,1)'); await w(Math.round(ms * .6));
          try { fallback && fallback(); } catch (e) {}
          await w(Math.round(ms * .4) + 80);
        } else {
          const tgt = underEl(x0, y0);
          const pts = (x, y) => (two ? [{ id: 1, x: x - 15, y }, { id: 2, x: x + 15, y }] : [{ id: 1, x, y }]);
          let last = [x0, y0];
          d.undo.push(() => { try { fireTouch('touchend', tgt, pts(last[0], last[1])); } catch (e) {} });
          fireTouch('touchstart', tgt, pts(x0, y0));
          await tween(ms, (e) => { const xx = x0 + (x1 - x0) * e, yy = y0 + (y1 - y0) * e; last = [xx, yy]; h.place(xx, yy); fireTouch('touchmove', tgt, pts(xx, yy)); }, alive);
          if (!alive()) throw CANCEL;
          fireTouch('touchend', tgt, pts(x1, y1)); d.undo.pop();
        }
        h.up(); await w(500);
        h.hide(); A.hush(); await w(300);
      },
      async pinch(cx, cy, s0, s1, ms) {
        const l = makeHand(o, false), r = makeHand(o, false);
        const tgt = underEl(cx, cy);
        A.dodge([{ left: cx - s1 / 2 - 60, right: cx + s1 / 2 + 60, top: cy - 60, bottom: cy + 120 }]);
        const pts = (sp) => [{ id: 1, x: cx - sp / 2, y: cy }, { id: 2, x: cx + sp / 2, y: cy }];
        const f0 = fontNow();
        const restore = () => { try { if (f0 != null && fontNow() !== f0) setFontSizeLevel(f0); } catch (e) {} };
        let sp = s0;
        d.undo.push(() => { try { fireTouch('touchend', tgt, pts(sp)); } catch (e) {} restore(); });
        l.place(cx - s0 / 2 - 30, cy + 60); r.place(cx + s0 / 2 + 30, cy + 60); l.show(); r.show(); await w(80);
        l.go(cx - s0 / 2, cy, 600); r.go(cx + s0 / 2, cy, 600); await w(680);
        l.down(); r.down(); l.ripple(); r.ripple(); await w(200);
        const run = async (a, b, t) => {
          await tween(t, (e) => { sp = a + (b - a) * e; l.place(cx - sp / 2, cy); r.place(cx + sp / 2, cy); if (canTouch) fireTouch('touchmove', tgt, pts(sp)); }, alive);
          if (!alive()) throw CANCEL;
        };
        if (canTouch) fireTouch('touchstart', tgt, pts(s0));
        await run(s0, s1, ms); await w(1500);
        await run(s1, s0 + 28, ms);
        if (canTouch) fireTouch('touchend', tgt, pts(s0 + 28));
        d.undo.pop(); l.up(); r.up(); await w(500);
        if (!canTouch) { try { setFontSizeLevel(Math.min(40, Math.round(f0 * 1.5))); } catch (e) {} await w(1500); }
        restore();
        l.hide(); r.hide(); await w(500);
      },
      async drag(el, dx, dy, ms) {
        const { x, y } = ctr(el); const h = hand1;
        await A.arrive(h, x, y, null, null, handBox(x + dx, y + dy));
        h.down(); h.ripple(); await w(200);
        const o1 = Element.prototype.setPointerCapture, o2 = Element.prototype.releasePointerCapture;
        Element.prototype.setPointerCapture = function (id) { if (id >= 9000) return; return o1.apply(this, arguments); };
        Element.prototype.releasePointerCapture = function (id) { if (id >= 9000) return; return o2.apply(this, arguments); };
        const rest = () => { Element.prototype.setPointerCapture = o1; Element.prototype.releasePointerCapture = o2; };
        const pe = (type, xx, yy) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 9101, pointerType: 'touch', isPrimary: true, clientX: xx, clientY: yy, button: 0, buttons: type === 'pointerup' ? 0 : 1 }));
        let px = x, py = y; d.undo.push(() => { try { pe('pointercancel', px, py); } catch (e) {} rest(); });
        pe('pointerdown', x, y);
        await tween(ms, (e) => { px = x + dx * e; py = y + dy * e; h.place(px, py); pe('pointermove', px, py); }, alive);
        if (!alive()) throw CANCEL;
        pe('pointerup', px, py); d.undo.pop(); rest(); h.up(); await w(900);
        h.hide(); await w(300);
      },
      async grip(grip, dy, ms) {
        const { x, y } = ctr(grip); const h = hand1;
        await A.arrive(h, x, y, null, null, handBox(x, y + dy));
        h.down(); h.ripple(); await w(150);
        const pe = (type, yy) => grip.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 91, pointerType: 'touch', isPrimary: true, clientX: x, clientY: yy, button: 0, buttons: type === 'pointerup' ? 0 : 1 }));
        let yy = y; d.undo.push(() => { try { pe('pointercancel', yy); } catch (e) {} });
        pe('pointerdown', y);
        await tween(ms, (e) => { yy = y + dy * e; h.place(x, yy); pe('pointermove', yy); }, alive);
        if (!alive()) throw CANCEL;
        pe('pointerup', y + dy); d.undo.pop(); h.up(); await w(700);
        h.hide(); await w(300);
      }
    };
    d.ends = () => {
      d.closed = true;
      try { d.undo.forEach((f) => f()); } catch (e) {}
      if (d.glow) d.glow.classList.remove('cc-hd-t');
      qa('.cc-hd-p').forEach((n) => n.classList.remove('cc-hd-p'));
      o.classList.add('out'); setTimeout(() => o.remove(), 450);
      if (d.note) { d.note.classList.remove('show'); const nn = d.note; setTimeout(() => nn.remove(), 400); }
    };
    (async () => {
      try { await script(A, d); d.done = true; } catch (e) { if (e !== CANCEL) console.warn('hand demo', id, e); }
      finish(d);
    })();
    return true;
  }
  function finish(d) {
    if (cur !== d) return;
    cur = null; lastEnd = Date.now(); d.ends();
    if (d.done || d.skipped) setFlag(d.id);
    else { const n = (+lsGet('rs_cc_x_' + d.id, '0') || 0) + 1; lsSet('rs_cc_x_' + d.id, String(n)); if (n >= 3) setFlag(d.id); }
  }
  const userTouch = (e) => { if (e && e.isTrusted === false) return; if (cur && !cur.keep && !cur.blk && Date.now() - cur.t0 > 500) { cur.closed = true; finish(cur); } };
  document.addEventListener('pointerdown', userTouch, true);
  document.addEventListener('touchstart', userTouch, { capture: true, passive: true });

  const STAR_COLS = ['#E0A526', '#D9534F', '#4C9A6A', '#3E7CB1', '#8E5BB0'];
  const outStar = (i) => `<span class="mk-star" style="--c:${STAR_COLS[i]}"><i class="ti ti-star-filled"></i></span>`;
  const outPal = `<span class="mk-pal">${STAR_COLS.map((c) => `<b style="background:${c}"></b>`).join('')}</span>`;
  const outList = '<span class="mk-list"><b></b><b></b><b></b></span>';
  const outTrack = '<span class="mk-trk"><i class="ti ti-map-pin-filled"></i><i class="ti ti-arrows-exchange"></i><i class="ti ti-book-2"></i></span>';
  const outSplit = '<span class="mk-split"><b></b><b></b></span>';
  const SCENES = {
    dots: { aria: 'معنى النقاط على الأزرار', eyebrow: 'علامة على الأزرار', title: 'ماذا تعني النقاط؟', flag: 'dots',
      intro: 'النقاط الصغيرة المضيئة فوق بعض الأزرار تعني أن في الزر حركات مخفية غير الضغطة العادية. <b>عدد النقاط = عدد الحركات المخفية.</b>',
      foot: 'تبقى النقاط ظاهرة دائماً لتذكّرك. وإن أردت إخفاءها: الإعدادات ‹ إعدادات متقدمة ‹ إظهار النقاط والتلميحات.',
      rows: [
        { icon: 'star', n: 2, cap: 'نقطتان = حركتان مخفيتان', steps: [{ k: 'dbl', t: 'ضغطتان متتاليتان' }, { k: 'long', t: 'أو ضغطة مطوّلة' }],
          legend: [['tap', 'ضغطة واحدة', 'عمل الزر المعتاد'], ['dbl', 'ضغطتان متتاليتان', 'عمل مخفي أول'], ['long', 'ضغطة مطوّلة (اضغط واستمر)', 'عمل مخفي ثانٍ']] },
        { icon: 'map-pin', n: 1, cap: 'نقطة واحدة = حركة مخفية واحدة', steps: [{ k: 'long', t: 'ضغطة مطوّلة' }],
          legend: [['tap', 'ضغطة واحدة', 'عمل الزر المعتاد'], ['long', 'ضغطة مطوّلة (اضغط واستمر)', 'عمل مخفي']] }
      ] },
    star: { aria: 'حركات النجمة', eyebrow: 'حركات مخفية', title: 'النجمة', flag: 'm_star',
      rows: [{ icon: 'star', n: 2, steps: [{ k: 'tap', t: 'ضغطة: اللون الأول', out: outStar(0), col: 0 }, { k: 'dbl', t: 'ضغطتان: اللون الثاني', out: outStar(1), col: 1 }, { k: 'long', t: 'مطوّلة: كل الألوان', out: outPal }] }] },
    pin: { aria: 'حركات الدبوس', eyebrow: 'حركات مخفية', title: 'الدبوس', flag: 'm_pin',
      rows: [{ icon: 'map-pin', n: 2, steps: [{ k: 'tap', t: 'ضغطة: مواقعك المحفوظة', out: outList }, { k: 'dbl', t: 'ضغطتان: تتبّع الكتاب', out: outTrack }, { k: 'long', t: 'مطوّلة: كتابان معاً', out: outSplit }] }] }
  };
  function startMock(key) {
    const def = SCENES[key]; if (!def || mock || cur || $('ccMock')) return false;
    if (key === 'dots') return startDotsLite(def);
    const o = document.createElement('div'); o.id = 'ccMock'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-label', def.aria);
    o.innerHTML = `<div class="cc-scrim"></div><div class="mk-card"><div class="mk-eyebrow"><i class="ti ti-hand-finger"></i>${def.eyebrow}</div><h2>${def.title}</h2>${def.intro ? `<p class="mk-intro">${def.intro}</p>` : ''}
      ${def.rows.map((r, i) => `<div class="mk-row" data-i="${i}">${r.cap ? `<p class="mk-cap">${r.cap}</p>` : ''}<div class="mk-lab"></div><div class="mk-stage"><span class="mk-btn"><i class="ti ti-${r.icon}"></i><span class="dc-dots n${r.n}">${'<i></i>'.repeat(r.n)}</span><span class="ring"></span></span><div class="mk-out"></div></div>${r.legend ? `<ul class="mk-leg">${r.legend.map((l) => `<li><span class="lk k-${l[0]}">${l[0] === 'tap' ? '<i class="ti ti-point"></i>' : l[0] === 'dbl' ? '<i class="ti ti-point"></i><i class="ti ti-point"></i>' : '<i class="ti ti-hand-finger"></i>'}</span><b>${l[1]}</b><em>${l[2]}</em></li>`).join('')}</ul>` : ''}</div>`).join('')}
      ${def.foot ? `<p class="mk-foot">${def.foot}</p>` : ''}
      <button type="button" class="mk-ok" disabled><i class="ti ti-check"></i>حسناً</button></div><div class="cc-fx"></div>`;
    document.body.appendChild(o);
    ['touchmove', 'wheel', 'contextmenu'].forEach((ev) => o.addEventListener(ev, (e) => e.preventDefault(), { passive: false }));
    const m = mock = { o, closed: false, key, def };
    const sk = q('.mk-skipall', o); if (sk) sk.addEventListener('click', () => { setFlag('dots'); closeMock(); try { const H = window.RSHints; if (H && H.toggleOff) H.toggleOff(); } catch (e) {} });
    const ok = q('.mk-ok', o);
    ok.addEventListener('click', () => { if (!ok.disabled) closeMock(); });
    requestAnimationFrame(() => requestAnimationFrame(() => o.classList.add('show')));
    if (reduced()) { const sn0 = makeSideNote(q('.cc-fx', o)); def.rows.forEach((r) => r.steps.forEach((s) => sn0.step(r.icon, s.t))); sn0.ask(null, null, 'عَلِمتُ').then(() => closeMock()); return true; }
    playMock(m);
    return true;
  }
  function startDotsLite(def) {
    const o = document.createElement('div'); o.id = 'ccMock'; o.className = 'mk-lite'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-label', def.aria);
    o.innerHTML = `<div class="cc-scrim"></div><div class="mk-card"><h2>ماذا تعني النقاط؟</h2>
      <div class="mk-lt"><span class="dc-dots n2"><i></i><i></i></span><span>ضغطتان متتاليتان، أو ضغطة مطوّلة</span></div>
      <div class="mk-lt"><span class="dc-dots n1"><i></i></span><span>ضغطة مطوّلة</span></div>
      <p class="mk-foot">تختفي النقاط بعد أن تجرّب كل حركات الزر.</p>
      <button type="button" class="mk-ok on"><i class="ti ti-check"></i>حسناً</button></div>`;
    document.body.appendChild(o);
    const m = mock = { o, closed: false, key: 'dots', def };
    const ok = q('.mk-ok', o);
    ok.addEventListener('click', () => closeMock());
    q('.cc-scrim', o).addEventListener('click', () => closeMock());
    requestAnimationFrame(() => requestAnimationFrame(() => o.classList.add('show')));
    return true;
  }
  async function playMock(m) {
    const alive = () => !m.closed, o = m.o;
    const w = async (ms) => { await sleep(ms); if (!alive()) throw CANCEL; };
    const fx = q('.cc-fx', o);
    try {
      await w(1000);
      const hand = makeHand(fx, false);
      const sn = makeSideNote(fx); o.classList.add('hn');
      for (let ri = 0; ri < m.def.rows.length; ri++) {
        const row = q(`.mk-row[data-i="${ri}"]`, o), btn = q('.mk-btn', row), ring = q('.ring', btn), lab = q('.mk-lab', row), out = q('.mk-out', row), ico = q('.mk-btn > i', row);
        const spec = m.def.rows[ri];
        const label = (t, ic) => { if (m.def.legend !== undefined || spec.legend) return; sn.step(ic || (spec.icon === 'star' ? 'star' : 'map-pin'), t); };
        const at = () => { const r = btn.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height * .5 }; };
        let p = at(); hand.place(p.x + 40, p.y + 80); hand.show(); await w(80); hand.go(p.x, p.y, 750); await w(800);
        for (let si = 0; si < spec.steps.length; si++) {
          const s = spec.steps[si];
          const lt = String(s.t).replace(/^مطوّلة:/, 'اضغط مطوّلاً:').replace(/^ضغطة:/, 'ضغطة واحدة:');
          label(lt, s.k === 'long' ? 'hand-finger' : (spec.icon === 'star' ? 'star' : 'map-pin')); await w(s.k === 'long' ? 650 : 350);
          if (s.k === 'tap') { hand.down(); hand.ripple(); btn.classList.add('press'); await w(220); hand.up(); btn.classList.remove('press'); }
          else if (s.k === 'dbl') { for (let i = 0; i < 2; i++) { hand.down(); hand.ripple(); btn.classList.add('press'); await w(150); hand.up(); btn.classList.remove('press'); await w(130); } }
          else { hand.down(); hand.ripple(); btn.classList.add('press'); ring.classList.add('on'); await tween(1100, (e) => ring.style.setProperty('--p', String(Math.round(e * 100))), alive); if (!alive()) throw CANCEL; hand.ripple(); ring.classList.remove('on'); try { navigator.vibrate && navigator.vibrate(12); } catch (e) {} btn.classList.remove('press'); hand.up(); }
          if (s.col != null) { ico.className = 'ti ti-star-filled'; ico.style.color = STAR_COLS[s.col]; }
          else if (s.k === 'long' && spec.icon === 'star' && s.out) { ico.className = 'ti ti-star-filled'; ico.style.color = STAR_COLS[0]; }
          if (s.out) { out.classList.remove('on'); out.innerHTML = s.out; void out.offsetWidth; out.classList.add('on'); }
          await w(1400);
          if (s.out && si < spec.steps.length - 1) out.classList.remove('on');
          if (si < spec.steps.length - 1) await w(250);
        }
        hand.hide(); await w(420);
      }
      await sn.ask(null, null, 'عَلِمتُ'); if (!alive()) throw CANCEL;
      closeMock();
    } catch (e) { if (e !== CANCEL) console.warn('mock', e); }
  }
  function closeMock() {
    const m = mock; if (!m || m.closed) return;
    m.closed = true; mock = null; lastEnd = Date.now();
    setFlag(m.def.flag);
    m.o.classList.remove('show'); setTimeout(() => m.o.remove(), 600);
  }

  const srcCtx = () => { try { return !!rsSrcCtx(); } catch (e) { return false; } };
  const inThamra = () => { try { return typeof isThamraBook === 'function' && isThamraBook(currentBookId); } catch (e) { return false; } };
  const cmpLevel = () => { try { return cmpNav && cmpNav.level; } catch (e) { return ''; } };
  const contentEl = () => $('content');
  const underOurs = '#ccHd, #ccTools, #ccMock, #ccLibTip, #ccConfirm';
  const onBody = () => { try { const e = underEl(innerWidth / 2, innerHeight * .46); return !!(e && e.closest && e.closest('#readerPage .body-text')); } catch (e) { return false; } };
  const autoStop = () => { try { RSV95.asStop(); } catch (e) {} };

  const SHEETS = {
    cmpScholarSettingsOverlay: () => { try { closeCmpScholarSettingsPanel(); } catch (e) {} },
    juristSettingsOverlay: () => { try { closeJuristSettingsPanel(); } catch (e) {} },
    thamraJuristSettingsOverlay: () => { try { closeThamraJuristSettingsPanel(); } catch (e) {} }
  };
  const KEEP = /^rs_(cc_|hint_|tip_|hg_)/;
  async function sheetDemo(A, d, btn, overlay) {
    const snap = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); snap[k] = localStorage.getItem(k); }
    const restore = () => {
      try {
        const now = []; for (let i = 0; i < localStorage.length; i++) now.push(localStorage.key(i));
        Object.keys(snap).forEach((k) => { if (!KEEP.test(k) && localStorage.getItem(k) !== snap[k]) localStorage.setItem(k, snap[k]); });
        now.forEach((k) => { if (!(k in snap) && !KEEP.test(k)) localStorage.removeItem(k); });
      } catch (e) {}
    };
    d.undo.push(() => { restore(); const ov = $(overlay); if (ov && ov.classList.contains('show') && SHEETS[overlay]) SHEETS[overlay](); });
    await A.tap(btn, null, null, { click: true, hold: 1200 });
    const rowsOf = () => qa('#' + overlay + ' .jurist-row');
    const visible = () => rowsOf().filter((r) => rectOf(r, 0));
    let v = visible(); if (v.length < 2) return;
    let pick = v[Math.min(2, v.length - 1)];
    const key = pick.dataset.key, rowOf = () => rowsOf().find((r) => r.dataset.key === key);
    const rh = Math.max(40, Math.abs(ctr(v[1]).y - ctr(v[0]).y));
    A.hl(0); await A.tap(q('.jurist-fav-btn', pick), null, null, { click: true, hold: 700 });
    await A.w(500);
    A.hl(1); await A.tap(q('.jurist-hide-btn', rowOf()), null, null, { click: true, hold: 900 });
    await A.tap(q('.jurist-hide-btn', rowOf()), null, null, { click: true, hold: 300 });
    restore();
    const ov = $(overlay); if (ov && SHEETS[overlay]) SHEETS[overlay]();
    d.undo.length = 0; d.undo.push(() => { restore(); });
    await A.w(600);
  }

  async function typeInto(A, input, text) {
    for (const ch of text) { input.value += ch; try { input.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {} await A.w(130); }
  }
  async function searchDemo(A, d) {
    const opened = { opts: false, words: false, filt: false };
    const val = (n) => { try { return getSearchOptionValue(n); } catch (e) { return null; } };
    const v0 = { p: val('searchPrecision'), s: val('searchScope') };
    const pick = (name, value) => { const b = q(`.search-opt-group[data-opt-name="${name}"] .search-opt-btn[data-value="${value}"]`); if (b) { try { searchOptionSelect(b); } catch (e) {} } };
    d.undo.push(() => {
      try {
        if (v0.p) pick('searchPrecision', v0.p); if (v0.s) pick('searchScope', v0.s);
        if (opened.opts && $('searchOptionsRow').style.display !== 'none') toggleSearchOpts();
        if (opened.words) toggleSearchWordsRows(true);
        if (opened.filt && $('searchFilterPanel').classList.contains('show')) toggleSearchFilterPanel();
      } catch (e) {}
    });
    await A.tap($('searchOptsBtn'), 'خيارات البحث', 'adjustments-horizontal', { click: true, below: true, hold: 800 }); opened.opts = true;
    let b = q('.search-opt-btn[data-value="exact"]'); if (b && rectOf(b, 0)) { await A.tap(b, 'تطابق تام', 'target', { click: true, below: true, hold: 1000 }); }
    b = q('.search-opt-btn[data-value="scattered"]'); if (b && rectOf(b, 0)) { await A.tap(b, null, null, { click: true, hold: 500 }); }
    b = q('.search-opt-btn[data-value="titles"]'); if (b && rectOf(b, 0)) { await A.tap(b, 'مكان البحث', 'map-search', { click: true, below: true, hold: 1000 }); }
    b = q('.search-opt-btn[data-value="both"]'); if (b && rectOf(b, 0)) { await A.tap(b, null, null, { click: true, hold: 500 }); }
    await A.tap($('searchOptsBtn'), null, null, { click: true, hold: 500 }); opened.opts = false;
    await A.tap($('searchWordsToggle'), 'استثناء وتثبيت', 'filter-cog', { click: true, below: true, hold: 700 }); opened.words = true;
    const ex = $('searchExcludeInput'), rq = $('searchRequireInput');
    if (ex && rectOf(ex, 0)) { A.say('استثناء كلمة', 'ban', ctr(ex).x, ctr(ex).y, true); await typeInto(A, ex, 'ماء'); await A.w(1200); A.hush(); }
    if (rq && rectOf(rq, 0)) { A.say('تثبيت كلمة', 'pin', ctr(rq).x, ctr(rq).y, true); await typeInto(A, rq, 'طهارة'); await A.w(1200); A.hush(); }
    toggleSearchWordsRows(true); opened.words = false; await A.w(500);
    await A.tap($('searchFilterToggle'), 'المراجع والكتب', 'books', { click: true, below: true, hold: 1800 }); opened.filt = true;
    await A.tap($('searchFilterToggle'), null, null, { click: true, hold: 400 }); opened.filt = false;
  }

  const scrollSafe = () => { try { const c = contentEl(); return c ? c.scrollTop : 0; } catch (e) { return 0; } };
  const SHEET_ROWS = [['star', 'النجمة', 'تُميّز المرجع بلون خاص (والترتيب بيدك)'], ['eye-off', 'العين', 'تُخفي المرجع من العرض وتُظهره متى شئت']];
  const NOTES = {
    hd_swipeS: { ic: 'list-search', title: 'تقليب نتائج البحث', rows: [['swipe', 'السحب لليمين', 'النتيجة التالية'], ['swipe', 'السحب لليسار', 'النتيجة السابقة']] },
    hd_refset: { ic: 'adjustments-horizontal', title: 'هوامش المراجع', rows: SHEET_ROWS },
    hd_pinch: { ic: 'zoom-in', title: 'تكبير الخط وتصغيره', rows: [['arrows-diagonal', 'تباعد الإصبعين', 'يكبّر الخط'], ['arrows-diagonal-minimize-2', 'تقارب الإصبعين', 'يصغّر الخط']] },
    hd_sel: { ic: 'select', title: 'تحديد النص', rows: [['long', 'ضغطة مطوّلة', 'على كلمة تحدّدها'], ['arrows-horizontal', 'سحب المقبضين', 'يوسّع التحديد أو يضيّقه'], ['dots', 'الثلاث نقاط', 'تفتح أدوات التحديد كلها'], ['home', 'الزر السفلي', 'يرجعك إلى الصفحة الرئيسية للقسم']] },
    hd_flags: { ic: 'book-2', title: 'علامة الشرح', rows: [['book-2', 'أيقونة الكتاب', 'للمسألة شرح مكتوب أو مرئي']] },
    hd_gloss: { ic: 'underline', title: 'الكلمة المسطّرة', rows: [['underline', 'كلمة تحتها خط', 'اضغطها يظهر معناها']] },
    hd_fn: { ic: 'notes', title: 'الحواشي', rows: [['notes', 'الرقم الصغير', 'اضغطه يظهر نص الحاشية تحت المسألة']] },
    hd_lib: { ic: 'books', title: 'اسم المرجع وحركاته', rows: [['dbl', 'ضغطتان متتاليتان', 'تفتحان آخر كتاب قرأته عنده في موضعك الأخير'], ['long', 'ضغطة مطوّلة', 'تُدخلك وضع ترتيب المكتبة']] },
    hd_search: { ic: 'books', title: 'المراجع والكتب والاختصار', rows: [['books', 'المراجع والكتب', 'حدّد ما يشمله البحث'], ['bookmark-plus', 'حفظ كاختصار', 'احفظ اختيارك لتعود إليه بلمسة']] },
    hd_sortref: { ic: 'arrows-sort', title: 'الترتيب بحسب المرجع', rows: [['tap', 'ضغطة', 'تجمع النتائج بحسب المرجع'], ['long', 'ضغطة مطوّلة', 'ترتيب المراجع: تقديم وإخفاء وتمييز']] },
    hd_jami: { ic: 'adjustments', title: 'ترتيب المراجع', rows: SHEET_ROWS },
    hd_jamiCmp: { ic: 'chart-bar', title: 'التنقل في الجامع', rows: [['swipe', 'السحب لليمين', 'المسألة التالية'], ['swipe', 'السحب لليسار', 'المسألة السابقة'], ['users', 'شريط المراجع السريعة', 'اضغط اسم مرجع فتنتقل مباشرة إلى جوابه']] },
    hd_reader: { ic: 'hand-finger', title: 'ثلاث حركات للقراءة', rows: [['swipe', 'السحب لليمين', 'الانتقال إلى الفصل التالي'], ['swipe', 'السحب لليسار', 'العودة إلى الفصل السابق'], ['two', 'السحب بإصبعين للأسفل', 'تمرير تلقائي مستمر، ولمسة واحدة توقفه']] }
  };
  const DEMOS = [
    { id: 'hd_reader', group: 'reader', delay: 250,
      ok: () => readerActive() && !srcCtx() && !!q('#readerPage .masala-block, #readerPage .thamra-item, #readerPage .reader-section'),
      run: async (A, d) => {
        const W = innerWidth, H = innerHeight, c = contentEl(), y = Math.round(H * .46);
        let sections = 0; try { sections = currentSections.length; } catch (e) {}
        const top0 = c ? c.scrollTop : 0;
        const canNav = swipeOn() && sections > 1 && !inThamra();
        const rows = (canNav ? NOTES.hd_reader.rows : NOTES.hd_reader.rows.slice(2));
        A.setNote({ ic: 'hand-finger', title: 'ثلاث حركات للقراءة', rows });
        d.undo.push(() => { autoStop(); });
        await A.w(700);
        let i = 0;
        if (canNav) {
          A.hl(i++); await A.swipe(W * .27, y, W * .73, y, 1300, () => { try { navSection(1); } catch (e) {} });
          await A.w(500);
          A.hl(i++); await A.swipe(W * .73, y, W * .27, y, 1300, () => { try { navSection(-1); } catch (e) {} });
          await A.w(1100);
        }
        A.hl(i); await A.swipe(W * .5, Math.round(H * .34), W * .5, Math.round(H * .56), 2600, () => { try { RSV95.asStart(1); } catch (e) {} }, true);
        await A.w(3200); autoStop(); await A.w(600);
        if (c) { try { c.scrollTo({ top: top0, behavior: 'smooth' }); } catch (e) {} }
        await A.w(900); A.hl(-1);
        autoStop();
      } },
    { id: 'hd_swipeS', group: 'reader', delay: 400,
      ok: () => readerActive() && srcCtx() && swipeOn() && !inThamra(),
      run: async (A) => {
        const W = innerWidth, H = innerHeight, y = Math.round(H * .46);
        await A.w(500);
        A.hl(0); await A.swipe(W * .27, y, W * .73, y, 1300, () => { try { navSearchResult(1); } catch (e) {} });
        await A.w(500);
        A.hl(1); await A.swipe(W * .73, y, W * .27, y, 1300, () => { try { navSearchResult(-1); } catch (e) {} });
        await A.w(700);
      } },
    { id: 'hd_refset', group: 'reader', delay: 600,
      ok: () => readerActive() && flag('share') && flag('hd_tools') && rectOf($('urwaSettingsBtn'), 0) && $('urwaSettingsBtn'),
      run: async (A, d, el) => { await sheetDemo(A, d, el, inThamra() ? 'thamraJuristSettingsOverlay' : 'juristSettingsOverlay'); } },
    { id: 'hd_pinch', group: 'reader', delay: 600,
      ok: () => readerActive() && flag('share') && flag('left1') && onBody(),
      run: async (A, d) => {
        const cx = innerWidth / 2, cy = Math.round(innerHeight * .46);
        await A.w(500);
        A.hl(0);
        await A.pinch(cx, cy, 90, 190, 2000);
        A.hl(-1); await A.w(500);
      } },
    { id: 'hd_flags', group: 'reader', delay: 1500,
      ok: () => readerActive() && flag('hd_tools') && firstVis('#readerPage .ms-sharh-flag', 150),
      run: async (A, d, el) => { A.hl(el.classList.contains('ms-sharh-flag') ? 0 : 1); await A.tap(el, null, null, { hold: 2200 }); } },
    { id: 'hd_gloss', group: 'reader', delay: 1500,
      ok: () => readerActive() && flag('hd_tools') && firstVis('#readerPage .gterm', 150),
      run: async (A, d, el) => { A.hl(0); await A.tap(el, null, null, { hold: 2200 }); } },
    { id: 'hd_fn', group: 'reader', delay: 1500,
      ok: () => readerActive() && flag('hd_tools') && firstVis('#readerPage sup[onclick^="toggleFootnote"]', 150),
      run: async (A, d, el) => { A.hl(0); await A.tap(el, null, null, { hold: 2200 }); } },
    { id: 'hd_lib', delay: 900, page: 'booksPage',
      ok: () => !q('#booksPage .lib-reorder-row, #booksPage .reorder-active-bar') && firstVis('#booksPage .lib-card', 150),
      run: async (A, d, el) => {
        await A.w(400);
        A.hl(0); await A.dbl(el);
        await A.w(300);
        const el2 = firstVis('#booksPage .lib-card', 150) || el;
        A.hl(1); await A.long(el2);
      } },
    { id: 'hd_search', delay: 900, page: 'searchPage',
      ok: () => rectOf($('searchFilterToggle'), 40),
      run: async (A, d) => {
        const presetsBefore = (() => { try { return getSearchFilterPresets().map((p) => p.id); } catch (e) { return []; } })();
        const stateBefore = lsGet('rs_search_filter_state', null);
        const clean = () => {
          try { saveSearchFilterPresets(getSearchFilterPresets().filter((p) => presetsBefore.indexOf(p.id) >= 0)); renderSearchFilterPresetsRow(); } catch (e) {}
          try { if (stateBefore == null) localStorage.removeItem('rs_search_filter_state'); else localStorage.setItem('rs_search_filter_state', stateBefore); } catch (e) {}
        };
        d.undo.push(() => { try { cancelTextPrompt(); } catch (e) {} try { if ($('searchFilterPanel').classList.contains('show')) toggleSearchFilterPanel(); } catch (e) {} clean(); });
        await A.w(400);
        A.hl(0); await A.tap($('searchFilterToggle'), null, null, { click: true, hold: 1800 });
        const sv = q('#searchFilterPanel .filter-save-preset-btn');
        if (sv && rectOf(sv, 0)) {
          A.hl(1); await A.tap(sv, null, null, { click: true, hold: 900 });
          const inp = $('textPromptInput');
          if (inp && $('textPromptOverlay') && $('textPromptOverlay').classList.contains('show')) {
            inp.value = ''; await typeInto(A, inp, 'مسائل الحج'); await A.w(500);
            const cf = q('#textPromptOverlay .text-prompt-confirm');
            if (cf) await A.tap(cf, null, null, { click: true, hold: 900 });
            const chip = q('#searchFilterPresetsRow .search-preset-chip');
            if (chip && rectOf(chip, 0)) await A.tap(chip, null, null, { click: true, hold: 2000 });
          }
        }
        clean();
        try { if ($('searchFilterPanel').classList.contains('show')) toggleSearchFilterPanel(); } catch (e) {}
        await A.w(500);
      } },
    { id: 'hd_sortref', delay: 900, page: 'searchPage',
      ok: () => firstVis('#rsSortRow [data-auth]', 110),
      run: async (A, d, el) => { await A.w(400); A.hl(0); await A.tap(el, null, null, { click: true, hold: 1600 }); A.hl(1); const e2 = firstVis('#rsSortRow [data-auth]', 60) || el; d.undo.push(() => { try { qa('.rs-ov.show .rs-close, .rs-sheet-ov.show .rs-close').forEach((b) => b.click()); } catch (e) {} }); await A.long(e2, null, null, { hold: 2600 }); } },
    { id: 'hd_jami', delay: 900, page: 'comparisonPage',
      ok: () => firstVis('.cmp-order-btn', 60),
      run: async (A, d, el) => { await A.w(400); await sheetDemo(A, d, el, 'cmpScholarSettingsOverlay'); } },
    { id: 'hd_jamiCmp', delay: 900, page: 'comparisonPage',
      ok: () => cmpLevel() === 'compare' && swipeOn(),
      run: async (A) => {
        const W = innerWidth, H = innerHeight, y = Math.round(H * .5);
        await A.w(500);
        A.hl(0); await A.swipe(W * .27, y, W * .73, y, 1300, () => { try { cmpStep(1); } catch (e) {} });
        await A.w(500);
        A.hl(1); await A.swipe(W * .73, y, W * .27, y, 1300, () => { try { cmpStep(-1); } catch (e) {} });
        await A.w(700);
        const chips = qa('.cmp-chips .cmp-chip').filter((c) => rectOf(c, 0));
        if (chips.length > 1) { A.hl(2); await A.tap(chips[Math.min(2, chips.length - 1)], null, null, { click: true, hold: 2200 }); }
      } }
  ];
  const TOOL_SLIDES = [
    { h: 'تحديد النص', rows: [['long', 'ضغطة مطوّلة', 'على كلمة تحدّدها'], ['arrows-horizontal', 'سحب المقبضين', 'يوسّع التحديد أو يضيّقه'], ['dots', 'الثلاث نقاط', 'تفتح أدوات إضافية']] },
    { h: 'التظليل', rows: [['tap', 'ضغطة', 'اللون الأول'], ['dbl', 'ضغطتان متتاليتان', 'اللون الثاني'], ['long', 'ضغطة مطوّلة', 'كل الألوان']] },
    { h: 'المزيد «⋯»', rows: [['star', 'نجمة', 'تحفظ المقطع في مفضلتك بلون'], ['pencil', 'ملاحظة', 'تكتب ملاحظة تظهر تحت المسألة'], ['file-plus', 'إلى كتاب', 'يُضاف إلى كتابك الخاص'], ['bell', 'تذكير', 'إشعار يذكّرك به في وقت تختاره'], ['select-all', 'أدوات أخرى', 'تحديد الفصل كله، المسألة العليا والسفلى، مشاركة']] },
    { h: 'تثبيت الأدوات في الشريط', rows: [['map-pin-filled', 'الدبوس المعبّأ', 'الأداة تظهر في الشريط مباشرة'], ['map-pin', 'الدبوس الفارغ', 'الأداة داخل القائمة فقط']] }
  ];
  function startTools() {
    if (toolsOpen || $('ccTools')) return;
    toolsOpen = true;
    const PAL = ['#E0A526', '#D9534F', '#4C9A6A', '#3E7CB1', '#8E5BB0'];
    const o = document.createElement('div'); o.id = 'ccTools'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-label', 'أدوات التحديد');
    const menuRows = [['star', 'نجمة'], ['pencil', 'ملاحظة'], ['file-plus', 'إلى كتاب'], ['bell', 'تذكير'], ['share-3', 'مشاركة']];
    o.innerHTML = `<div class="cc-scrim"></div><div class="tl-card"><div class="tl-top"><span class="tl-eye"><i class="ti ti-highlight"></i>أدوات التحديد</span><span><span class="tl-cnt"></span> <button type="button" class="tl-skip" data-a="skip">تخطّي</button></span></div>
      <h2 class="tl-h"></h2><ul class="tl-rows"></ul>
      <div class="tl-stage">
        <div class="tl-text">يجب على المكلف تعلّم أحكام ما يبتلى به، <mark>ومن شكّ في عدد الركعات بعد السجدتين</mark> فله أن يبني على الأكثر ويأتي بصلاة الاحتياط بعد التسليم، ولا شيء عليه بعد ذلك.</div>
        <div class="tl-pal">${PAL.map((c) => `<b style="background:${c}"></b>`).join('')}</div>
        <div class="tl-bar"><span class="tb"><i class="ti ti-copy"></i></span><span class="tb hl"><i class="ti ti-palette"></i><span class="ring"></span></span><span class="tb star" style="display:none"><i class="ti ti-star"></i></span><span class="sep"></span><span class="tb more"><i class="ti ti-dots"></i></span></div>
        <div class="tl-menu">${menuRows.map(([ic, lb]) => `<div class="mr"><i class="ic ti ti-${ic}"></i><span class="lb">${lb}</span><span class="pn"><i class="ti ti-pin-filled"></i></span></div>`).join('')}</div>
        <div class="cc-fx"></div></div>
      <button type="button" class="tl-ok" data-a="ok"><i class="ti ti-check"></i><span>التالي</span></button></div>`;
    document.body.appendChild(o);
    ['touchmove', 'wheel', 'contextmenu'].forEach((ev) => o.addEventListener(ev, (e) => e.preventDefault(), { passive: false }));
    requestAnimationFrame(() => requestAnimationFrame(() => o.classList.add('show')));
    const S = { closed: false, wait: null, skipDone: true };
    const alive = () => !S.closed;
    const SKIPC = { skip: true };
    const w = async (ms) => { await sleep(ms); if (!alive()) throw CANCEL; if (S.sk) throw SKIPC; };
    const card = q('.tl-card', o), rowsEl = q('.tl-rows', o), h2 = q('.tl-h', o), cnt = q('.tl-cnt', o), okB = q('.tl-ok', o), stage = q('.tl-stage', o);
    const mark = q('.tl-text mark', o), pal = q('.tl-pal', o), hlB = q('.tb.hl', o), moreB = q('.tb.more', o), starB = q('.tb.star', o), menu = q('.tl-menu', o), mrs = qa('.tl-menu .mr', o);
    const close = (done) => {
      if (S.closed) return; S.closed = true; toolsOpen = false; lastEnd = Date.now();
      if (done) setFlag('hd_tools');
      if (S.wait) { const r = S.wait; S.wait = null; r('skip'); }
      o.classList.remove('show'); setTimeout(() => o.remove(), 600);
    };
    o.addEventListener('click', (e) => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      if (b.dataset.a === 'skip') { close(true); return; }
      if (b.dataset.a === 'ok' && S.wait) { const r = S.wait; S.wait = null; r('ok'); }
    });
    const hand = makeHand(q('.cc-fx', o), false);
    const ctrIn = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
    let shown = false;
    const glide = async (el, ms) => { const p = ctrIn(el); if (!shown) { hand.place(p.x + 34, p.y + 62); hand.show(); shown = true; await w(70); } hand.go(p.x, p.y, ms || 800); await w((ms || 800) + 80); };
    const press = async (el, kind) => {
      const ring = q('.ring', el);
      const once = async (t) => { hand.down(); hand.ripple(); el.classList.add('press'); await w(t); hand.up(); el.classList.remove('press'); };
      if (kind === 'tap') await once(280);
      else if (kind === 'dbl') { await once(190); await w(150); await once(190); }
      else { hand.down(); hand.ripple(); el.classList.add('press'); ring && ring.classList.add('on'); await tween(1200, (e) => ring && ring.style.setProperty('--p', String(Math.round(e * 100))), () => alive() && !S.sk); if (!alive()) throw CANCEL; if (S.sk) throw SKIPC; hand.ripple(); ring && ring.classList.remove('on'); hand.up(); el.classList.remove('press'); }
    };
    const hl = (i) => qa('li', rowsEl).forEach((li, j) => li.classList.toggle('on', j === i));
    const setSlide = async (i) => {
      card.classList.add('swap'); await w(260);
      const s = TOOL_SLIDES[i]; h2.textContent = s.h; cnt.textContent = `${i + 1} / ${TOOL_SLIDES.length}`;
      rowsEl.innerHTML = s.rows.map(([k, b, t]) => `<li>${/^(tap|dbl|long)$/.test(k) ? GKH(k) : `<span class="tl-ri"><i class="ti ti-${k}"></i></span>`}<b>${b}</b><span class="tx">${t}</span></li>`).join('');
      card.classList.remove('swap'); await w(300);
    };
    const chapter = async (i, fn, pre) => {
      S.sk = false; hand.hide(); shown = false;
      if (pre) pre();
      await setSlide(i);
      okB.querySelector('span').textContent = 'عَلِمتُ'; okB.classList.add('on'); okB.disabled = true; setTimeout(() => { okB.disabled = false; }, 450);
      const clicked = new Promise((r) => { S.wait = r; });
      const anim = (async () => { try { await fn(); } catch (e) { if (e !== SKIPC) throw e; } })();
      const a = await clicked; S.sk = true;
      okB.classList.remove('on');
      if (a === 'skip') throw CANCEL;
      try { await anim; } catch (e) { if (e !== CANCEL) throw e; throw e; }
      hand.hide(); shown = false; pal.classList.remove('on'); hl(-1); mark.style.background = ''; mark.classList.remove('sel');
    };
    (async () => {
      try {
        await w(500);
        await chapter(0, async () => {
          await w(300); hl(0); await glide(mark); await press(mark, 'long'); mark.classList.add('sel'); await w(900);
          hl(1); await w(1100); hl(2); await glide(moreB, 700); await w(900);
        });
        await chapter(1, async () => {
          await w(300); await glide(hlB); hl(0); await press(hlB, 'tap'); mark.style.background = 'rgba(224,165,38,.45)'; await w(1000);
          hl(1); await press(hlB, 'dbl'); mark.style.background = 'rgba(217,83,79,.38)'; await w(1000);
          hl(2); await press(hlB, 'long'); pal.classList.add('on'); await w(1500);
        });
        await chapter(2, async () => {
          await w(300); await glide(moreB); await press(moreB, 'tap'); menu.classList.add('on'); await w(500);
          for (let i = 0; i < 5; i++) { hl(i); mrs.forEach((m, j) => m.classList.toggle('hot', j === i)); await glide(q('.ic', mrs[i]) || mrs[i], 450); await w(750); }
          mrs.forEach((m) => m.classList.remove('hot'));
        });
        await chapter(3, async () => {
          menu.classList.add('on', 'pins');
          await w(400); const pn = q('.pn', mrs[0]);
          hl(1); await glide(pn, 600); await w(400);
          hl(0); await press(pn, 'tap'); pn.classList.add('on'); starB.style.display = ''; starB.classList.add('newtool'); await w(1500);
        });
        close(true);
      } catch (e) { if (e !== CANCEL) console.warn('tools', e); close(S.skipDone); }
    })();
  }
  RSD.demoTools = startTools;
  const since = {};
  let lastGroup = '';
  function demoTick() {
    try {
      if (document.visibilityState !== 'visible') return;
      if (ctxOn() && lsGet('rs_cc_welcome', '') === '1') searchCards();
      if (readerActive()) readMs += 700;
      if (!ctxOn() || lsGet('rs_cc_welcome', '') !== '1' || mock || cur || toolsOpen || busy() || RSD.cc.getScene() || $('ccLibTip')) return;
      if (!flag('dots')) setFlag('dots');
      if (toolsOpen) return;
      if (flag('share') && !readerActive() && !flag('left1') && ['booksPage', 'authorBooksPage', 'searchPage', 'favoritesPage', 'comparisonPage'].indexOf(activePage()) >= 0) setFlag('left1');
      if (readerActive() && flag('hd_pinch') && !flag('hd_tools') && onBody() && Date.now() - lastEnd > 700 && !document.querySelector('#csBar.show, #csMenu.show')) { startTools(); return; }
      if (Date.now() - lastEnd < 800 || document.querySelector('#rsTip.show, #rsNudge.show')) return;
      const pg = activePage(), now = Date.now();
      if (readerActive() && flag('hd_reader') && !flag('share') && !inThamra() && q('#readerPage .masala-block') && RSD.demoShare) { RSD.demoShare(); return; }
      for (const D of DEMOS) {
        if (flag(D.id)) continue;
        if (D.page && D.page !== pg) { since[D.id] = 0; continue; }
        let info = null; try { info = D.ok(); } catch (e) {}
        if (!info) { since[D.id] = 0; continue; }
        if (!since[D.id]) since[D.id] = now;
        if (now - since[D.id] < D.delay) continue;
        since[D.id] = 0;
        runDemo(D.id, (A, d) => D.run(A, d, info), { note: NOTES[D.id] }); return;
      }
    } catch (e) {}
  }
  RSD.demoReader = () => { try { localStorage.removeItem('rs_cc_hd_reader'); } catch (e) {} };
  RSD.demoDots = () => startMock('dots');
  try {
    const n0 = parseInt(lsGet('rs_dots_n', '0'), 10) || 0;
    if (lsGet('rs_dots_once', '') !== '1' && n0 === 0 && lsGet('rs_hints_off', '') !== '1') {
      let tries = 0;
      const loadingUp = () => { const l = document.getElementById('loadingScreen'); return !!(l && l.style.display !== 'none' && getComputedStyle(l).display !== 'none'); };
      const iv = setInterval(() => {
        try {
          if (++tries > 600) { clearInterval(iv); return; }
          if (document.visibilityState !== 'visible') return;
          if (loadingUp() || lsGet('rs_cc_welcome', '') !== '1') return;
          if (busy() || document.getElementById('ccMock') || RSD.cc.getScene() || document.getElementById('ccLibTip') || cur || toolsOpen) return;
          clearInterval(iv);
          if (startMock('dots')) { lsSet('rs_dots_once', '1'); lsSet('rs_dots_n', '1'); }
        } catch (e) { clearInterval(iv); }
      }, 1800);
    }
  } catch (e) {}
  RSD.demoStar = () => startMock('star');
  RSD.demoPin = () => startMock('pin');
  RSD.demoRun = (id) => { const D = DEMOS.find((x) => x.id === id); if (!D) return false; let info = null; try { info = D.ok(); } catch (e) {} return !!info && runDemo(D.id, (A, d) => D.run(A, d, info), { note: NOTES[D.id] }); };

  const GKH = (k) => (k === 'tap' ? '<span class="gk k-tap"><i></i></span>' : k === 'dbl' ? '<span class="gk k-dbl"><i></i><i></i></span>' : '<span class="gk k-long"><i></i><i></i></span>');
  function libGate(card) {
    if ($('ccLibTip')) return;
    const o = document.createElement('div'); o.id = 'ccLibTip'; o.setAttribute('role', 'alertdialog'); o.setAttribute('aria-label', 'حركات اسم المرجع');
    o.innerHTML = `<div class="lt-scrim"></div><div class="lt-box"><div class="gt-hd"><i class="ti ti-books"></i><span>حركتان مخفيتان على اسم المرجع</span></div>
      <div class="gt-row">${GKH('dbl')}<b>ضغطتان متتاليتان</b><span>تنقلك مباشرة إلى آخر كتاب قرأته عند هذا المرجع</span></div>
      <div class="gt-row">${GKH('long')}<b>ضغطة مطوّلة</b><span>تفتح وضع ترتيب المراجع</span></div>
      <button type="button" class="lt-ok"><i class="ti ti-check"></i>عَلِمتُ</button></div>`;
    document.body.appendChild(o);
    requestAnimationFrame(() => o.classList.add('show'));
    q('.lt-ok', o).addEventListener('click', (e) => {
      e.stopPropagation(); setFlag('libok'); o.classList.remove('show'); setTimeout(() => o.remove(), 300);
      try { if (card.isConnected) card.click(); } catch (x) {}
    });
  }
  document.addEventListener('click', (e) => {
    try {
      if (e.isTrusted === false) return;
      const card = e.target && e.target.closest && e.target.closest('#booksPage .lib-card:not(.lib-reorder-row)');
      if (true || !card || flag('libok') || !ctxOn() || lsGet('rs_lib_gate_off', '') === '1') return;
      if (document.body.getAttribute('data-d-lib') === '0') { setFlag('libok'); return; }
      if (document.body.classList.contains('gh-off') || lsGet('rs_cc_welcome', '') !== '1') return;
      { const n = +lsGet('rs_cc_libn', '0') || 0; if (n < 1) { lsSet('rs_cc_libn', String(n + 1)); return; } }
      e.preventDefault(); e.stopImmediatePropagation();
      if (cur) { cur.closed = true; finish(cur); }
      libGate(card);
    } catch (x) {}
  }, true);

  function confirmDlg(spec, onYes) {
    if ($('ccConfirm')) return;
    const o = document.createElement('div'); o.id = 'ccConfirm'; o.setAttribute('role', 'alertdialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-label', spec.title);
    o.innerHTML = `<div class="cc-scrim"></div><div class="cf-card"><span class="cf-ic"><i class="ti ti-${spec.ic || 'alert-triangle'}"></i></span><h2>${spec.title}</h2>
      <p>${spec.body}</p><p class="cf-q">${spec.q}</p>
      <button type="button" class="cf-keep" data-a="keep"><i class="ti ti-check"></i>${spec.keep}</button>
      <button type="button" class="cf-hold" disabled><i class="fill"></i><span>${spec.off} — اضغط مطوّلاً للتأكيد</span></button></div>`;
    document.body.appendChild(o);
    const hb = q('.cf-hold', o), fill = q('.fill', o);
    setTimeout(() => { hb.disabled = false; }, 1500);
    let t0 = 0, raf = 0, fired = false;
    const stop = () => { cancelAnimationFrame(raf); raf = 0; t0 = 0; if (!fired) fill.style.transform = 'scaleX(0)'; };
    const step = () => { if (!t0) return; const p = Math.min(1, (performance.now() - t0) / 1800); fill.style.transform = `scaleX(${p})`; if (p >= 1) { fired = true; close(); try { onYes(); } catch (x) {} return; } raf = requestAnimationFrame(step); };
    const start = (e) => { if (hb.disabled || fired) return; e.preventDefault(); t0 = performance.now(); try { navigator.vibrate && navigator.vibrate(8); } catch (x) {} raf = requestAnimationFrame(step); };
    ['pointerdown', 'touchstart'].forEach((ev) => hb.addEventListener(ev, start, { passive: false }));
    ['pointerup', 'pointercancel', 'pointerleave', 'touchend', 'touchcancel'].forEach((ev) => hb.addEventListener(ev, stop));
    hb.addEventListener('contextmenu', (e) => e.preventDefault());
    hb.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!fired && !hb.disabled) { fired = true; close(); try { onYes(); } catch (x) {} } } });
    function close() { o.classList.remove('show'); setTimeout(() => o.remove(), 400); }
    o.addEventListener('click', (e) => { const b = e.target.closest('[data-a="keep"]'); if (b) close(); });
    requestAnimationFrame(() => requestAnimationFrame(() => o.classList.add('show')));
  }
  RSD.confirmDlg = confirmDlg;
  function wrapToggle() {
    const Hh = window.RSHints; if (!Hh || typeof Hh.toggleOff !== 'function' || Hh.toggleOff.__cc) return;
    const f = Hh.toggleOff;
    Hh.toggleOff = function () {
      if (lsGet('rs_hints_off', '0') === '1') return f.apply(this, arguments);
      confirmDlg({ ic: 'bulb-off', title: 'إيقاف التعليمات والتلميحات', body: 'تُزال النقاط على الأزرار، وعروض اليد، وصناديق التلميح. ويمكن إعادة تفعيلها لاحقاً من الإعدادات ← اكتشف.', q: 'هل تؤكّد عدم رغبتك في عرض التعليمات؟', keep: 'إبقاء التعليمات', off: 'إيقاف التعليمات' }, () => f.call(Hh));
    };
    Hh.toggleOff.__cc = true;
  }

  let lastTouchT = 0;
  ['touchstart', 'pointerdown', 'wheel'].forEach((ev) => document.addEventListener(ev, () => { lastTouchT = Date.now(); }, { passive: true, capture: true }));
  function peekSidebar() {
    try {
      if (!ctxOn() || cur || toolsOpen || busy() || !readerActive() || flag('pk_sbar') || !flag('hd_tools')) return;
      if (Date.now() - lastTouchT < 2500) return;
      const t = $('scrollbarTrack'), th = $('scrollbarThumb'); if (!t || !th || t.getBoundingClientRect().height < 80) return;
      setFlag('pk_sbar');
      t.classList.add('active');
      th.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(46px)', offset: .4 }, { transform: 'translateY(46px)', offset: .6 }, { transform: 'translateY(0)' }], { duration: 2600, easing: 'ease-in-out' });
      setTimeout(() => { try { t.classList.remove('active'); } catch (e) {} }, 2800);
    } catch (e) {}
  }

  function miniCard(id, ic, html) {
    return `<div class="cc-mini" data-flag="${id}" role="note"><span class="mi-ic"><i class="ti ti-${ic}"></i></span><div class="mi-b">${html}</div><button type="button" class="mi-x" aria-label="إغلاق"><i class="ti ti-x"></i></button></div>`;
  }
  function searchCards() {
    if (activePage() !== 'searchPage' || cur) return;
    const opts = $('searchOptionsRow');
    if (opts && opts.style.display !== 'none' && !flag('c_match') && !q('#searchPage [data-flag="c_match"]')) {
      const g = q('.search-opt-group[data-opt-name="searchPrecision"]', opts);
      if (g) { const t = document.createElement('div'); t.innerHTML = miniCard('c_match', 'target', '<b>تطابق تام:</b> تُطلب العبارة كما كُتبت، بالترتيب نفسه وبلا فاصل.<br><b>كلمات متفرقة:</b> يكفي ورود الكلمات في المسألة، متتابعةً أو متباعدة.'); g.insertAdjacentElement('afterend', t.firstElementChild); }
    }
    const req = $('searchRequireRow');
    const wordsOpen = !!(req && req.style.display !== 'none');
    let wc = q('#searchPage [data-flag="c_words"]');
    if (wordsOpen && !flag('c_words') && !wc && req) { const t = document.createElement('div'); t.innerHTML = miniCard('c_words', 'filter-cog', '<b>استثناء:</b> تُستبعد المسائل التي ترد فيها الكلمة.<br><b>تثبيت:</b> لا تُعرض إلا المسائل التي ترد فيها الكلمة.'); req.insertAdjacentElement('afterend', t.firstElementChild); wc = q('#searchPage [data-flag="c_words"]'); }
    if (wc) wc.style.display = wordsOpen ? '' : 'none';
  }
  document.addEventListener('click', (e) => {
    const x = e.target.closest && e.target.closest('.cc-mini .mi-x'); if (!x) return;
    const c = x.closest('.cc-mini'); setFlag(c.dataset.flag); c.classList.add('out'); setTimeout(() => c.remove(), 300);
  });

  RSD.resetPages = function () {
    try { autoStop(); } catch (e) {}
    try { if (typeof tabCtx === 'object') Object.keys(tabCtx).forEach((k) => { tabCtx[k].stack = []; tabCtx[k].view = null; tabCtx[k].snap = null; }); } catch (e) {}
    try { navStack = []; updateBackButtonVisibility(); } catch (e) {}
    try { searchResultContext = null; } catch (e) {}
    try { window.cmpCtx = null; } catch (e) {}
    try { qa('.overlay.show, .modal.show').forEach((n) => { if (!n.id || !/^cc|^dc/.test(n.id)) n.classList.remove('show'); }); } catch (e) {}
    try { showTab('books'); if (currentTab === 'books') { renderTabRoot('books'); const c = contentEl(); if (c) c.scrollTop = 0; } } catch (e) {}
  };
  document.addEventListener('rsd-welcome-done', () => setTimeout(() => { try { if (lsGet('rs_cc_welcome', '') === '1') RSD.resetPages(); } catch (e) {} }, 700));
  const _rb = window.closeTopOverlayOnBack;
  if (typeof _rb === 'function') window.closeTopOverlayOnBack = function () { if (cur) { cur.skipped = true; cur.closed = true; finish(cur); return true; } return _rb.apply(this, arguments); };
  function init() { wrapToggle(); setInterval(demoTick, 700); setInterval(wrapToggle, 3000); setInterval(peekSidebar, 1500); }
  init();
})();
