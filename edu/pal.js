(function () {
  const EB = window.EB,
    S = EB.S,
    $ = id => document.getElementById(id);
  const HLC = ['#ffe14d', '#ff9ecb', '#7be0a6', '#7cc4ff', '#ffb347', '#c9a7ff', '#ff7b7b', '#e6e6e6'];
  const LSC = ['#ff2d3a', '#ff7a00', '#ffd400', '#18c964', '#1b8cff', '#b44cff', '#ff4fa3', '#ffffff'];
  const LS_ORDER = ['trail', 'neon', 'dot', 'ring'];
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem('rs_edu_pal') || '{}');
  } catch (e) {}
  S.fadeMs = saved.fadeMs || 2500;
  S.fade = !!saved.fade;
  const st = {
    hl: { c: saved.hlc || HLC[0], w: saved.hlw || 18, snap: saved.hs !== false },
    laser: { c: saved.lc || LSC[0], w: saved.lw || 10, style: LS_ORDER.includes(saved.ls) ? saved.ls : 'trail' },
    erase: { c: '#000', w: saved.ew || 12, mode: saved.em === 'part' ? 'part' : 'stroke' }
  };
  const BR_OK = ['ink', 'dash', 'wave', 'dbl', 'arrow', 'line', 'glow', 'calli'];
  let qcS = {};
  try {
    qcS = JSON.parse(localStorage.getItem('rs_edu_qc') || '{}');
  } catch (e) {}
  let bo = Array.isArray(saved.bo) ? saved.bo.filter(k => BR_OK.includes(k)) : [];
  BR_OK.forEach(k => {
    if (!bo.includes(k)) bo.push(k);
  });
  let bf = Array.isArray(saved.bf) ? saved.bf.filter(k => BR_OK.includes(k) && k !== 'ink') : [];

  EB.brAll = () => bo.slice();
  EB.brOff = () => bf.slice();
  EB.brVis = () => bo.filter(k => !bf.includes(k));
  EB.brSet = (order, off) => {
    bo = order.slice();
    bf = off.slice();
    if (!EB.brVis().length) bf = [];
    if (!EB.brVis().includes(EB.TS.pen.br)) EB.TS.pen.br = EB.brVis()[0];
    EB.palKeep();
  };
  EB.TS = {
    pen: {
      get c() {
        return S.color;
      },
      set c(v) {
        S.color = v;
      },
      get w() {
        return S.width;
      },
      set w(v) {
        S.width = v;
      },
      br: BR_OK.includes(saved.br) ? saved.br : 'ink'
    },
    hl: st.hl,
    laser: st.laser,
    erase: st.erase
  };
  S.TS = EB.TS;
  EB._palKeep = () => {
    try {
      localStorage.setItem(
        'rs_edu_pal',
        JSON.stringify({
          hlc: st.hl.c,
          hlw: st.hl.w,
          hs: st.hl.snap,
          lc: st.laser.c,
          lw: st.laser.w,
          ls: st.laser.style,
          ew: st.erase.w,
          em: st.erase.mode,
          bo,
          bf,
          br: EB.TS.pen.br,
          fade: S.fade,
          fadeMs: S.fadeMs
        })
      );
    } catch (e) {}
  };
  const keep = () => EB.palKeep();

  const QDEF = {
    pen: ['#17212b', '#C0502A', '#1b57d6', '#0f8a5f', '#7a3fc2', '#e09b00', '#d6336c', '#ffffff'],
    hl: HLC,
    laser: LSC
  };
  const qcGet = t => (Array.isArray(qcS[t]) && qcS[t].length ? qcS[t] : QDEF[t]).filter(c => /^#[0-9a-f]{6}$/i.test(c));
  EB.qcGet = qcGet;
  EB.qcSet = (t, arr) => {
    qcS[t] = arr.slice(0, 40);
    try {
      localStorage.setItem('rs_edu_qc', JSON.stringify(qcS));
    } catch (e) {}
  };
  EB.qcDefault = t => QDEF[t].slice();
  EB.qcAdd = (t, c) => {
    const l = qcGet(t);
    if (!l.some(x => x.toLowerCase() === c.toLowerCase())) {
      l.unshift(c);
      EB.qcSet(t, l);
    }
  };
  EB.RNG = { pen: [1.5, 36], hl: [8, 60], laser: [4, 30], erase: [6, 70] };
  const pal = $('pal'),
    NAMES = { pen: 'لون القلم', hl: 'لون التظليل', laser: 'لون الليزر' };
  const lum = c => {
    const n = parseInt(c.slice(1), 16);
    return ((n >> 16) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114) / 255;
  };
  const DASH =
    '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><g stroke-dasharray="3 3"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/><path d="m15 5 4 4"/></g></svg>';
  const dotPx = (t, w) =>
    Math.max(4, Math.min(24, t === 'pen' ? 3 + w * 1.1 : t === 'erase' ? 4 + w * 0.3 : 3 + w * 0.42));
  EB.renderPal = function () {
    const t = S.tool,
      T = EB.TS[t];
    if (t === 'hide') {
      const g = S.hg || 'w',
        has = EB.hasBookText && EB.hasBookText();
      const n = EB.hiddenCount ? EB.hiddenCount() : 0;
      pal.innerHTML = has
        ? `<div class="hrow"><div class="hgr">${[
            ['w', 'كلمة'],
            ['s', 'جملة'],
            ['p', 'فقرة']
          ]
            .map(x => `<button class="hg${g === x[0] ? ' on' : ''}" data-hg="${x[0]}">${x[1]}</button>`)
            .join(
              ''
            )}</div><span class="hdiv"></span><button class="hg act pri" data-rvn ${n ? '' : 'disabled'}><i class="ti ti-eye"></i>كشف التالي${n ? ` · ${EB.ar(n)}` : ''}</button><button class="hg act ic" data-hmore aria-label="خيارات الإخفاء"><i class="ti ti-dots"></i></button></div>`
        : `<span class="lbl hnote"><i class="ti ti-info-circle"></i>أضف نصاً من كتاب ثم اضغط الكلمات لإخفائها وكشفها</span>`;
      pal.classList.add('s', 'scr');
      EB.resize();
      return;
    }
    pal.classList.remove('scr');
    if (!T) {
      pal.classList.remove('s');
      pal.innerHTML = '';
      EB.resize();
      return;
    }
    const dkp = EB.isDark(EB.page().paper),
      cur = (T.c || '').toLowerCase();
    let h = '';
    if (QDEF[t]) {
      const list = qcGet(t);
      h += `<div class="pws"><div class="qc" id="qc">${list.map(c => `<button class="swc${c.toLowerCase() === cur ? ' on' : ''}${lum(c) > 0.88 ? ' lt' : ''}" data-c="${c}" style="--c:${c}" aria-label="لون"></button>`).join('')}</div><button class="more" data-more aria-label="كل الألوان وتعديل الاختصارات"></button></div>`;
    } else
      h += `<div class="pws"><div class="hgr em">${[
        ['stroke', 'الخط كله', 'ti-trash-x'],
        ['part', 'جزء منه', 'ti-eraser']
      ]
        .map(
          x =>
            `<button class="hg${(T.mode || 'stroke') === x[0] ? ' on' : ''}" data-em="${x[0]}"><i class="ti ${x[2]}"></i>${x[1]}</button>`
        )
        .join('')}</div></div>`;
    const sz = dotPx(t, T.w);
    h += `<div class="pgrp"><button class="wd2" data-sz aria-label="السماكة والفرشاة: اسحب لأعلى أو لأسفل للسماكة، ولليمين أو لليسار لتبديل الفرشاة، أو اضغط للخيارات"><i style="width:${sz}px;height:${sz}px;${t === 'erase' ? 'background:none;border:2px solid var(--text)' : ''}"></i></button>${t === 'pen' ? `<button class="pt2${S.fade ? ' on' : ''}" data-t="fade" aria-label="قلم يتلاشى">${DASH}</button>` : ''}</div>`;
    pal.innerHTML = h;
    pal.classList.add('s');
    EB.resize();
    const on = pal.querySelector('.qc .swc.on');
    if (on) {
      const q = $('qc');
      q.scrollLeft +=
        on.getBoundingClientRect().left - q.getBoundingClientRect().left - q.clientWidth / 2 + on.offsetWidth / 2;
    }
  };
  pal.addEventListener('pointerdown', e => e.stopPropagation());

  let szd = null;
  const szb = () => $('szb');
  const STEP = 40,
    DEAD = 10;
  const listOf = t => (t === 'pen' ? EB.brVis() : t === 'laser' ? LS_ORDER : null);
  const curOf = (t, T) => (t === 'pen' ? T.br || 'ink' : T.style || 'trail');
  const infoOf = (t, k) =>
    t === 'pen'
      ? {
          nm: EB.BRUSHES[k],
          ic: `<svg viewBox="0 0 24 24" width="30" height="24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${EB.BR_SVG[k]}</svg>`
        }
      : { nm: EB.LASER_NAMES[k], ic: `<i class="ti ${EB.LASER_ICONS[k]}"></i>` };
  function szShow(btn, T, t) {
    const el = szb();
    if (!el) return;
    const r = btn.getBoundingClientRect(),
      d = Math.max(3, Math.min(48, T.w)),
      list = listOf(t),
      k = list && curOf(t, T);
    const dot =
      t === 'erase'
        ? 'background:none;border:2px solid var(--text)'
        : t === 'hl'
          ? 'background:' + T.c + ';border-radius:4px'
          : 'background:' + (T.c && /^#/.test(T.c) ? T.c : 'var(--text)');
    let kind = '';
    if (list) {
      const f = infoOf(t, k);
      kind = `<span class="szn"><span class="szt">${f.ic}${f.nm}</span><span class="szd">${list.map(x => `<u${x === k ? ' class="on"' : ''}></u>`).join('')}</span></span>`;
    }
    el.innerHTML = `<i style="width:${d}px;height:${d}px;${dot}"></i><b>${EB.ar(Math.round(T.w))}</b>${kind}`;
    el.style.left = Math.max(70, Math.min(innerWidth - 70, r.left + r.width / 2)) + 'px';
    el.style.top = Math.max(S.TOP + 4, r.top - el.offsetHeight - 14) + 'px';
    el.classList.add('s');
  }
  pal.addEventListener('pointerdown', e => {
    const b = e.target.closest('[data-sz]');
    if (!b) return;
    const t = S.tool,
      T = EB.TS[t];
    if (!T) return;
    e.preventDefault();
    try {
      b.setPointerCapture(e.pointerId);
    } catch (x) {}
    szd = { id: e.pointerId, y0: e.clientY, x0: e.clientX, w0: T.w, ax: 0, moved: 0, b, t, T };
    EB.closePop();
  });
  function cycle(d, dir) {
    const list = listOf(d.t);
    if (!list || list.length < 2) return false;
    let i = list.indexOf(curOf(d.t, d.T));
    if (i < 0) i = 0;
    const j = i + dir;
    if (j < 0 || j >= list.length) return false;
    const nx = list[j];
    if (d.t === 'pen') d.T.br = nx;
    else d.T.style = nx;
    EB.palKeep();
    if (navigator.vibrate) navigator.vibrate(6);
    szShow(d.b, d.T, d.t);
    return true;
  }
  pal.addEventListener('pointermove', e => {
    if (!szd || e.pointerId !== szd.id) return;
    const d = szd,
      dx = e.clientX - d.x0,
      dy = d.y0 - e.clientY;
    if (!d.axis) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < DEAD) return;
      d.axis = listOf(d.t) && Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v';
      d.moved = 1;
      d.x0 = e.clientX;
      d.y0 = e.clientY;
      szShow(d.b, d.T, d.t);
      return;
    }
    if (d.axis === 'h') {
      while (dx - d.ax <= -STEP) {
        d.ax -= STEP;
        if (!cycle(d, 1)) {
          d.ax = dx;
          break;
        }
      }
      while (dx - d.ax >= STEP) {
        d.ax += STEP;
        if (!cycle(d, -1)) {
          d.ax = dx;
          break;
        }
      }
      return;
    }
    const [lo, hi] = EB.RNG[d.t],
      span = hi - lo,
      v = Math.max(lo, Math.min(hi, d.w0 + (dy / 220) * span));
    d.T.w = Math.round(v * 2) / 2;
    const i = d.b.querySelector('i');
    if (i) {
      const s = dotPx(d.t, d.T.w);
      i.style.width = s + 'px';
      i.style.height = s + 'px';
    }
    szShow(d.b, d.T, d.t);
    S.dirty = 1;
  });
  const szEnd = e => {
    if (!szd || e.pointerId !== szd.id) return;
    const d = szd;
    szd = null;
    const el = szb();
    if (el) el.classList.remove('s');
    if (d.moved) {
      EB.palKeep();
      EB.renderPal();
      return;
    }
    if (e.type === 'pointerup') EB.toolPanel(d.b);
  };
  pal.addEventListener('pointerup', szEnd);
  pal.addEventListener('pointercancel', szEnd);

  let lp = null;
  pal.addEventListener('pointerdown', e => {
    const s = e.target.closest('.qc .swc');
    if (!s) return;
    lp = setTimeout(() => {
      lp = null;
      pal._lp = 1;
      EB.qcEditor(S.tool);
    }, 520);
  });
  ['pointerup', 'pointercancel'].forEach(ev =>
    pal.addEventListener(ev, () => {
      if (lp) {
        clearTimeout(lp);
        lp = null;
      }
    })
  );
  pal.addEventListener('pointermove', e => {
    if (lp && Math.abs(e.movementX) + Math.abs(e.movementY) > 4) {
      clearTimeout(lp);
      lp = null;
    }
  });

  pal.addEventListener('click', e => {
    const hg = e.target.closest('[data-hg]'),
      hx = e.target.closest('[data-hx]'),
      em = e.target.closest('[data-em]');
    if (em) {
      EB.TS.erase.mode = em.dataset.em;
      keep();
      EB.renderPal();
      return;
    }
    if (e.target.closest('[data-rvn]')) {
      EB.revealStep(1);
      return;
    }
    if (e.target.closest('[data-hmore]')) {
      EB.hidePop(e.target.closest('[data-hmore]'));
      return;
    }
    if (hg) {
      S.hg = hg.dataset.hg;
      try {
        localStorage.setItem('rs_edu_hg', S.hg);
      } catch (x) {}
      EB.renderPal();
      return;
    }
    if (hx) {
      if (EB.hideAllUnits) EB.hideAllUnits(hx.dataset.hx);
      return;
    }
    const t = S.tool,
      T = EB.TS[t];
    if (!T) return;
    if (e.target.closest('[data-more]')) {
      EB.colorPanel(e.target.closest('[data-more]'), {
        title: NAMES[t],
        cur: T.c,
        onPick: c => {
          T.c = c;
          if (QDEF[t]) EB.qcAdd(t, c);
          keep();
          EB.renderPal();
          EB.refreshUI();
        },
        edit: () => EB.qcEditor(t)
      });
      return;
    }
    if (pal._lp) {
      pal._lp = 0;
      return;
    }
    const c = e.target.closest('[data-c]'),
      g = e.target.closest('[data-t]');
    if (c) {
      T.c = c.dataset.c;
      keep();
      EB.renderPal();
      EB.refreshUI();
    }
    if (g) {
      S.fade = !S.fade;
      keep();
      EB.renderPal();
    }
  });
})();

(function () {
  const EB = window.EB;
  let el = null,
    shown = false,
    calm = 0;
  const KEY = 'rs_edu_tip';
  const seen = () => {
    try {
      return !!localStorage.getItem(KEY);
    } catch (e) {
      return false;
    }
  };
  const mark = () => {
    try {
      localStorage.setItem(KEY, '1');
    } catch (e) {}
  };
  const $ = id => document.getElementById(id);

  const busy = () =>
    ($('hint') && $('hint').classList.contains('s')) ||
    $('sessPop') ||
    EB._sessAuto ||
    (($('sh') || {}).classList && $('sh').classList.contains('s')) ||
    ($('pop') && $('pop').classList.contains('s')) ||
    ($('ed') && $('ed').classList.contains('s')) ||
    (EB.S && (EB.S.cur || (EB.S.sel && EB.S.sel.length))) ||
    document.body.classList.contains('drawing') ||
    (EB.S && EB.S.rec) ||
    document.querySelector('#cpOv');
  EB.tipDone = function () {
    mark();
    if (el) {
      const e = el;
      el = null;
      e.classList.remove('s');
      setTimeout(() => e.remove(), 260);
    }
  };
  EB.tipMaybe = function () {
    if (shown || seen() || busy()) {
      calm = 0;
      return;
    }
    const pal = $('pal'),
      b = pal && pal.querySelector('[data-sz]');
    if (!b || !pal.classList.contains('s')) return;
    if (++calm < 2) return;
    shown = true;
    el = document.createElement('div');
    el.id = 'tip';
    el.setAttribute('role', 'dialog');
    el.innerHTML =
      '<button class="tipx" aria-label="إغلاق"><i class="ti ti-x"></i></button><div class="tip-h"><i class="ti ti-hand-move"></i><b>حرّك زر السماكة</b></div><p><i class="ti ti-arrows-horizontal"></i>يميناً أو يساراً: الفرشاة التالية</p><p><i class="ti ti-arrows-vertical"></i>للأعلى أو للأسفل: أكبر أو أصغر</p>';
    document.body.appendChild(el);
    const r = b.getBoundingClientRect();
    el.style.bottom = Math.max(70, innerHeight - r.top + 12) + 'px';
    requestAnimationFrame(() => el && el.classList.add('s'));
    el.querySelector('.tipx').onclick = EB.tipDone;
  };
  setInterval(() => {
    if (!shown && !seen() && EB.S && ['pen', 'laser'].includes(EB.S.tool)) EB.tipMaybe();
  }, 900);
})();
