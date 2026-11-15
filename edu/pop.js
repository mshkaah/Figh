(function () {
  'use strict';
  const EB = window.EB,
    S = EB.S,
    $ = EB.$,
    ar = EB.ar,
    esc = EB.esc,
    pop = $('pop');

  EB.selRect = function () {
    const items = S.shaping ? [S.shaping.shp] : S.sel;
    if (!items.length) return null;
    const b = EB.unionBox(items),
      k = S.V.k,
      pad = 12;
    return {
      l: S.V.x + b.x * k - pad,
      t: S.V.y + b.y * k - pad,
      r: S.V.x + (b.x + b.w) * k + pad,
      b: S.V.y + (b.y + b.h) * k + pad
    };
  };
  const inter = (a, b) => {
    const w = Math.min(a.r, b.r) - Math.max(a.l, b.l),
      h = Math.min(a.b, b.b) - Math.max(a.t, b.t);
    return w > 0 && h > 0 ? w * h : 0;
  };

  EB.placePop = function (anchor, avoid) {
    const W = innerWidth,
      H = innerHeight,
      m = 8,
      w = pop.offsetWidth,
      h = pop.offsetHeight,
      top = S.TOP + m,
      bot = H - m;
    const a =
      anchor && anchor.getBoundingClientRect
        ? anchor.getBoundingClientRect()
        : { left: W / 2, right: W / 2, top: H / 2, bottom: H / 2, width: 0 };
    const av = avoid === undefined ? EB.selRect() : avoid,
      act = $('act'),
      ar0 = act && act.style.display !== 'none' ? act.getBoundingClientRect() : null;
    const cx = Math.max(m, Math.min(W - w - m, a.left + (a.right - a.left) / 2 - w / 2)),
      dock = $('dock').getBoundingClientRect(),
      dockTop = (dock.height > 40 ? dock.top : H - 120) - 10;
    const C = [
      { l: cx, t: a.top - h - 10 },
      { l: cx, t: a.bottom + 10 }
    ];
    if (av)
      C.push(
        { l: cx, t: av.b + 8 },
        { l: cx, t: av.t - h - (ar0 ? ar0.height + 14 : 8) },
        { l: m, t: dockTop - h },
        { l: W - w - m, t: dockTop - h },
        { l: cx, t: top }
      );
    C.push({ l: cx, t: dockTop - h });
    let best = null,
      bs = 1e18;
    C.forEach((c, i) => {
      const r = { l: c.l, t: c.t, r: c.l + w, b: c.t + h };
      let sc = i * 1e-3;
      if (c.t < top) sc += 1e7 + (top - c.t) * 100;
      if (c.t + h > bot) sc += 1e7 + (c.t + h - bot) * 100;
      if (av) sc += inter(r, av) * 10;
      if (ar0) sc += inter(r, { l: ar0.left, t: ar0.top, r: ar0.right, b: ar0.bottom }) * 10;
      if (sc < bs) {
        bs = sc;
        best = c;
      }
    });
    pop.style.left = Math.round(best.l) + 'px';
    pop.style.top = Math.round(Math.max(top, Math.min(bot - h, best.t))) + 'px';
  };

  EB.openPop = function (html, anchor, o) {
    o = o || {};
    const keepPos = o.keep && pop.classList.contains('s') && pop._moved;
    pop.onclick = pop.oninput = pop.onchange = null;
    pop._on = pop._in = pop._ch = null;
    pop.dataset.mode = o.mode || '';
    pop.innerHTML = `<div class="pp-grab" data-grab><i class="pp-grip"></i><span class="pp-ttl">${esc(o.title || '')}</span><button class="pp-x" data-pclose aria-label="إغلاق"><i class="ti ti-x"></i></button></div>${html}`;
    const was = pop.classList.contains('s');
    pop.classList.add('s');
    pop.classList.toggle('pp-re', !was);
    if (!keepPos) {
      pop._moved = false;
      EB.placePop(anchor, o.avoid);
    }
    if (!was) {
      pop.classList.remove('pp-in');
      void pop.offsetWidth;
      pop.classList.add('pp-in');
    }
    pop._anchor = anchor;
  };
  EB.closePop = () => {
    pop.classList.remove('s', 'pp-in');
    pop._moved = false;
    pop.onclick = pop.oninput = pop.onchange = null;
    pop._on = pop._in = pop._ch = null;
  };
  pop.addEventListener('pointerdown', e => e.stopPropagation());
  pop.addEventListener('click', e => {
    if (e.target.closest('[data-pclose]')) {
      EB.closePop();
      return;
    }
    if (pop._on) pop._on(e);
  });
  pop.addEventListener('input', e => {
    if (pop._in) pop._in(e);
  });
  pop.addEventListener('change', e => {
    if (pop._ch) pop._ch(e);
  });

  pop.addEventListener('pointerdown', e => {
    const g = e.target.closest('[data-grab]');
    if (!g || e.target.closest('[data-pclose], [data-bro]')) return;
    e.preventDefault();
    const r = pop.getBoundingClientRect(),
      dx = e.clientX - r.left,
      dy = e.clientY - r.top,
      id = e.pointerId;
    pop._moved = true;
    pop.classList.add('dragging2');
    try {
      g.setPointerCapture(id);
    } catch (x) {}
    const mv = ev => {
      if (ev.pointerId !== id) return;
      const w = pop.offsetWidth,
        h = pop.offsetHeight;
      pop.style.left = Math.max(4, Math.min(innerWidth - w - 4, ev.clientX - dx)) + 'px';
      pop.style.top = Math.max(S.TOP, Math.min(innerHeight - h - 4, ev.clientY - dy)) + 'px';
    };
    const up = ev => {
      if (ev.pointerId !== id) return;
      pop.classList.remove('dragging2');
      g.removeEventListener('pointermove', mv);
      g.removeEventListener('pointerup', up);
      g.removeEventListener('pointercancel', up);
    };
    g.addEventListener('pointermove', mv);
    g.addEventListener('pointerup', up);
    g.addEventListener('pointercancel', up);
  });

  EB.FAMS = [
    ['حبر', ['#0b1220', '#17212b', '#475569', '#94a3b8', '#e5e7eb']],
    ['أحمر', ['#7f1d1d', '#c1121f', '#e5484d', '#f87171', '#fecaca']],
    ['برتقالي', ['#7c2d12', '#C0502A', '#ea580c', '#fb923c', '#fed7aa']],
    ['أصفر', ['#854d0e', '#e09b00', '#eab308', '#fde047', '#fef9c3']],
    ['أخضر', ['#14532d', '#0f8a5f', '#22c55e', '#86efac', '#dcfce7']],
    ['فيروزي', ['#134e4a', '#0f766e', '#14b8a6', '#5eead4', '#ccfbf1']],
    ['أزرق', ['#1e3a8a', '#1b57d6', '#3b82f6', '#7dd3fc', '#dbeafe']],
    ['بنفسجي', ['#4c1d95', '#7a3fc2', '#a855f7', '#c4b5fd', '#ede9fe']],
    ['وردي', ['#831843', '#d6336c', '#ec4899', '#f9a8d4', '#fce7f3']],
    ['بني', ['#3b2412', '#78350f', '#a16207', '#d6b88a', '#f3ecdd']]
  ];
  EB.colorPanel = function (anchor, o) {
    const cur = String(o.cur || '').toLowerCase(),
      sv = EB.Colors.list().slice(0, 8),
      F = EB.FAMS;
    let fi = F.findIndex(f => f[1].some(c => c.toLowerCase() === cur));
    if (fi < 0) fi = 6;
    const dot = (c, a) =>
      `<button class="cg${c.toLowerCase() === cur ? ' on' : ''}${/^#(f|e|d|c)[0-9a-f]{5}$/i.test(c) && c.toLowerCase() !== '#f3ecdd' ? ' lt' : ''}" ${a}="${c}" style="--c:${c}" aria-label="لون"></button>`;
    const body =
      () => `${sv.length ? `<div class="pp-t">ألواني</div><div class="ctone sv">${sv.map(x => dot(x.h, 'data-pc')).join('')}</div>` : ''}
      ${o.edit ? '<button class="cust2 ed" data-pedit><span class="cw ic"><i class="ti ti-arrows-sort"></i></span><span class="kt">تعديل ألوان الاختصارات<small>أضف ألواناً أو رتّبها أو احذف ما لا تستعمله</small></span><i class="ti ti-chevron-left"></i></button>' : ''}
      <button class="cust2" data-pcust><span class="cw"></span><span class="kt">لون مخصص<small>اختر أي درجة واحفظها لتجدها هنا</small></span><i class="ti ti-chevron-left"></i></button>`;
    EB.openPop(body(), anchor, { mode: 'col', title: o.title || 'اللون', avoid: o.avoid, keep: o.keep });
    const mark = c =>
      pop
        .querySelectorAll('.cg[data-pc]')
        .forEach(x => x.classList.toggle('on', (x.dataset.pc || '').toLowerCase() === String(c).toLowerCase()));
    pop._on = e => {
      const fm = e.target.closest('[data-fam]');
      if (fm) {
        fi = +fm.dataset.fam;
        pop.querySelectorAll('.fm').forEach(x => x.classList.toggle('sel', x === fm));
        pop.querySelector('.ctone').innerHTML = F[fi][1].map(c => dot(c, 'data-pc')).join('');
        pop.querySelector('.fn').textContent = F[fi][0];
        mark(o.cur || '');
        return;
      }
      const c = e.target.closest('[data-pc]');
      if (c) {
        o.cur = c.dataset.pc;
        o.onPick(c.dataset.pc);
        mark(c.dataset.pc);
        if (o.close) EB.closePop();
        return;
      }
      if (e.target.closest('[data-pedit]')) {
        EB.closePop();
        o.edit();
        return;
      }
      if (e.target.closest('[data-pcust]')) {
        EB.closePop();
        EB.Colors.pick(
          o.cur,
          col => {
            o.onPick(col);
            o.cur = col;
          },
          { title: o.title || 'لون مخصص', onCancel: () => EB.colorPanel(anchor, o) }
        );
      }
    };
  };

  EB.colorPop = function (anchor) {
    const sel = S.shaping ? [S.shaping.shp] : S.sel;
    EB.colorPanel(anchor, {
      title: 'لون العنصر',
      cur: sel[0] && sel[0].c,
      onPick: c => {
        EB.setSelColor(c);
      }
    });
  };
  EB.setSelColor = function (c) {
    const tg = S.shaping ? [S.shaping.shp] : S.sel,
      all = new Set();
    tg.forEach(i => {
      all.add(i);
      if (i.t === 'node' && !i.root)
        EB.subtree(i).forEach(x => {
          if (x.t === 'node') all.add(x);
        });
    });
    all.forEach(i => {
      if (i.t !== 'img' && i.t !== 'wid') i.c = c;
    });
    S.dirty = 1;
    if (!S.shaping) EB.commit();
  };

  const NAMES = { pen: 'القلم', hl: 'التظليل', laser: 'الليزر', erase: 'الممحاة' };
  const LASERS = [
    ['trail', 'ذيل', 'ti-wind'],
    ['neon', 'نيون', 'ti-bolt'],
    ['dot', 'نقطة', 'ti-point'],
    ['ring', 'حلقة', 'ti-radar-2']
  ];
  EB.LASER_NAMES = { trail: 'ذيل', neon: 'نيون', dot: 'نقطة', ring: 'حلقة' };
  EB.LASER_ICONS = { trail: 'ti-wind', neon: 'ti-bolt', dot: 'ti-point', ring: 'ti-radar-2' };
  const LS_HINT = {
    trail: 'أثر متوهّج بقلب أبيض يتبع إصبعك ثم يتلاشى',
    neon: 'شريط مدبّب بتوهّج لوني، عريض عند الرأس ورفيع عند الذيل',
    dot: 'نقطة مضيئة فقط، دون أثر',
    ring: 'حلقة نابضة تلفت النظر إلى موضع محدد'
  };
  const BR_HINT = {
    ink: 'كتابة وتدوين عادي',
    dash: 'خط متقطّع للربط أو لعلاقة غير مؤكدة',
    wave: 'خط متموّج يوضع تحت كلمة لتمييزها',
    dbl: 'خطان متوازيان لتأكيد العنوان أو الحكم',
    arrow: 'ينتهي برأس سهم: للتفريع والإشارة',
    line: 'خط مستقيم دقيق: للفواصل والجداول',
    glow: 'خط متوهّج لافت للتمييز اللحظي',
    calli: 'خط عريض للعناوين'
  };
  EB.BR_HINT = BR_HINT;

  const BR_SVG = {
    ink: '<path d="M3 16c4-9 7 5 10-2s5-6 8-3" stroke-width="2.4"/>',
    dash: '<path d="M3 15c4-9 7 5 10-2s5-6 8-3" stroke-width="2.4" stroke-dasharray="4 3.5"/>',
    wave: '<path d="M2 14c1.5-4 3-4 4.5 0s3 4 4.5 0 3-4 4.5 0 3 4 4.5 0" stroke-width="2.2"/>',
    dbl: '<path d="M3 9.5h18M3 14.5h18" stroke-width="2"/>',
    arrow: '<path d="M3 17c4-1 8-5 15-9" stroke-width="2.4"/><path d="M13 6.5l5.2 1.5-1.8 5.2" stroke-width="2.4"/>',
    line: '<path d="M4 19L20 5" stroke-width="2.6"/>',
    glow: '<path d="M3 12h18" stroke-width="7" opacity=".25"/><path d="M3 12h18" stroke-width="3"/>',
    calli: '<path d="M3 14c4-6 7 2 10-1s5-5 8-2" stroke-width="3.6" stroke-linecap="square"/>'
  };
  EB.BR_SVG = BR_SVG;
  EB.toolPanel = function (anchor) {
    const t = S.tool,
      T = EB.TS[t];
    if (!T) return;
    const [lo, hi] = EB.RNG[t];
    const brs =
      t === 'pen'
        ? `<div class="brs">${EB.brVis()
            .map(
              k =>
                `<button class="br${(T.br || 'ink') === k ? ' on' : ''}" data-br="${k}" title="${EB.BRUSHES[k]}" aria-label="${EB.BRUSHES[k]}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${BR_SVG[k]}</svg></button>`
            )
            .join(
              ''
            )}</div><div class="brn"><p class="pp-n brh" data-brh><b>${EB.BRUSHES[T.br || 'ink']}</b> — ${BR_HINT[T.br || 'ink']}</p></div>`
        : '';
    const extra =
      t === 'hl'
        ? `<div class="pp-r"><span>ملاصقة للكلمات</span><button class="ksw${T.snap !== false ? ' on' : ''}" data-hs role="switch" aria-checked="${T.snap !== false}" aria-label="ملاصقة التظليل للكلمات"></button></div>`
        : t === 'laser'
          ? `<p class="pp-n brh" data-lsh><b>${EB.LASER_NAMES[T.style || 'trail']}</b> — ${LS_HINT[T.style || 'trail']}</p><div class="kseg lsr">${LASERS.map(l => `<button data-ls="${l[0]}" class="${(T.style || 'trail') === l[0] ? 'on' : ''}"><i class="ti ${l[2]}"></i><span>${l[1]}</span></button>`).join('')}</div>`
          : '';
    const html = `${t === 'laser' ? '<canvas class="bpv" id="bpv"></canvas>' : ''}${brs}<div class="pp-r"><span>${t === 'erase' ? 'الحجم' : 'السماكة'}</span><input class="krg" type="range" data-bw min="${lo}" max="${hi}" step="0.5" value="${T.w}" style="--p:${Math.round(((T.w - lo) / (hi - lo)) * 100)}%"><b data-v="bw">${ar(Math.round(T.w))}</b></div>${extra}`;
    EB.openPop(html, anchor, { mode: 'tool', title: NAMES[t], avoid: null });
    if (t === 'pen') {
      const hd = pop.querySelector('.pp-grab'),
        xb = hd && hd.querySelector('.pp-x');
      if (hd && xb) {
        const ob = document.createElement('button');
        ob.className = 'pp-x pp-bro';
        ob.setAttribute('data-bro', '');
        ob.setAttribute('aria-label', 'ترتيب الفرش وإخفاء بعضها');
        ob.title = 'ترتيب الفرش وإخفاء بعضها';
        ob.innerHTML = '<i class="ti ti-arrows-sort"></i>';
        hd.insertBefore(ob, xb);
      }
    }
    const paint = () => {
      const c = $('bpv');
      if (c) EB.paintPreview(c);
    };
    paint();
    pop._in = e => {
      const x = e.target;
      if (x.dataset.bw !== undefined) {
        T.w = +x.value;
        x.style.setProperty('--p', Math.round(((x.value - lo) / (hi - lo)) * 100) + '%');
        pop.querySelector('[data-v=bw]').textContent = ar(Math.round(T.w));
        EB.palKeep();
        EB.renderPal();
        paint();
      }
    };
    pop._ch = () => EB.palKeep();
    pop._on = e => {
      const b = e.target.closest('button');
      if (!b) return;
      const d = b.dataset;
      if (d.br) {
        T.br = d.br;
        EB.palKeep();
        pop.querySelectorAll('.br').forEach(x => x.classList.toggle('on', x === b));
        const h = pop.querySelector('[data-brh]');
        if (h) h.innerHTML = `<b>${EB.BRUSHES[d.br]}</b> — ${BR_HINT[d.br]}`;
      } else if (d.bro !== undefined) {
        EB.closePop();
        EB.brEditor();
      } else if (d.hs !== undefined) {
        T.snap = T.snap === false;
        EB.palKeep();
        b.classList.toggle('on', T.snap !== false);
        b.setAttribute('aria-checked', T.snap !== false);
      } else if (d.ls) {
        T.style = d.ls;
        EB.palKeep();
        const h2 = pop.querySelector('[data-lsh]');
        if (h2) h2.innerHTML = `<b>${EB.LASER_NAMES[d.ls]}</b> — ${LS_HINT[d.ls]}`;
        pop.querySelectorAll('.lsr button').forEach(x => x.classList.toggle('on', x === b));
        paint();
      }
    };
  };

  EB.hidePop = function (anchor) {
    const n = EB.hiddenCount ? EB.hiddenCount() : 0,
      rows = [
        ['all', 'ti-eye-off', 'أخفِ كل الكلمات'],
        ['none', 'ti-eye', 'اكشف الكل'],
        ['rand', 'ti-puzzle', 'فراغات عشوائية'],
        ['prev', 'ti-arrow-back-up', 'أعِد إخفاء آخر ما كشفته']
      ];
    EB.openPop(
      `<div class="hml">${rows.map(r => `<button data-hm="${r[0]}" ${r[0] === 'prev' && !(S.rvs && S.rvs.length) ? 'disabled' : ''}><i class="ti ${r[1]}"></i><span>${r[2]}</span></button>`).join('')}</div>`,
      anchor,
      { mode: 'tool', title: 'خيارات الإخفاء' }
    );
    pop._on = e => {
      const b = e.target.closest('[data-hm]');
      if (!b || b.disabled) return;
      const k = b.dataset.hm;
      EB.closePop();
      if (k === 'prev') EB.revealStep(-1);
      else EB.hideAllUnits(k);
    };
  };

  EB.paintPreview = function (cv) {
    if (!cv) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3),
      W = cv.clientWidth || 280,
      H = cv.clientHeight || 70;
    cv.width = W * dpr;
    cv.height = H * dpr;
    const c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const pg = EB.page(),
      t = S.tool,
      T = EB.TS[t];
    c.fillStyle = pg.paper;
    c.fillRect(0, 0, W, H);
    const dk = EB.isDark(pg.paper);
    c.fillStyle = dk ? 'rgba(255,255,255,.12)' : 'rgba(40,30,15,.14)';
    for (let x = 10; x < W; x += 20)
      for (let y = 10; y < H; y += 20) {
        c.beginPath();
        c.arc(x, y, 1, 0, 7);
        c.fill();
      }
    const pts = [];
    for (let i = 0; i <= 46; i++) {
      const u = i / 46;
      pts.push({ x: W - 24 - u * (W - 48), y: H / 2 + Math.sin(u * Math.PI * 2.2) * H * 0.22 });
    }
    if (t === 'erase') {
      const r = Math.min(H / 2 - 4, (6 + T.w * 1.6) / 2);
      c.strokeStyle = '#e5484d';
      c.fillStyle = '#e5484d22';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(W / 2, H / 2, r, 0, 7);
      c.fill();
      c.stroke();
      return;
    }
    if (t === 'laser') {
      const keep = S.laser,
        now = performance.now();
      S.laser = pts.map((p, i) => ({ x: p.x, y: p.y, t: now - (46 - i) * 12, c: T.c, r: T.w, s: T.style }));
      EB.drawLaser(c, now, 1);
      S.laser = keep;
      return;
    }
    const w = t === 'hl' ? T.w * 0.9 : T.w;
    EB.strokeTo(c, { t: 'ink', pts, c: T.c, w: t === 'hl' ? w / 4 : w, hl: t === 'hl', br: T.br });
  };

  EB.palKeep = () => {
    EB.prefs();
    EB._palKeep && EB._palKeep();
  };

  (function () {
    const sh = document.getElementById('sh'),
      hd = sh && sh.querySelector('.hd');
    if (!hd) return;
    const bk = document.createElement('button');
    bk.className = 'ib hbk';
    bk.id = 'shBack';
    bk.setAttribute('aria-label', 'رجوع');
    bk.innerHTML = '<i class="ti ti-arrow-right"></i>';
    bk.hidden = true;
    hd.appendChild(bk);
    const find = () => sh.querySelector('#shB > .kr.back[data-back], #shF [data-back], #shB [data-back].tbk');
    const sync = () => {
      const t = find();
      bk.hidden = !t;
      if (t) t.classList.add('hbk-src');
    };
    new MutationObserver(sync).observe(sh, { childList: true, subtree: true });
    bk.addEventListener('click', e => {
      e.stopPropagation();
      const t = find();
      if (t) t.click();
    });
  })();
})();

(function () {
  const EB = window.EB,
    $ = EB.$,
    esc = EB.esc;
  const TN = { pen: 'القلم', hl: 'التظليل', laser: 'الليزر' };
  EB.qcEditor = function (t) {
    if (!EB.qcGet || !EB.qcGet(t)) return;
    let L = EB.qcGet(t).slice();
    const body = () =>
      `<p class="n ed-lead">تظهر هذه الألوان في الشريط السفلي (${TN[t] || ''}). اضغط اللون لتغييره، واسحب المقبض <i class="ti ti-grip-vertical"></i> لإعادة الترتيب.</p><div class="kg tl ord qcl">${L.map((c, i) => `<div class="tr" data-i="${i}"><i class="ti ti-grip-vertical grip"></i><button class="qsw" data-ed="${i}" style="--c:${c}" aria-label="تغيير اللون"></button><span class="tt qhex">${c.toUpperCase()}</span><button class="eye dngc" data-rm="${i}" ${L.length < 2 ? 'disabled' : ''} aria-label="حذف"><i class="ti ti-x"></i></button></div>`).join('')}</div><button class="qadd2" data-add><i class="ti ti-plus"></i>إضافة لون</button>`;
    const save = () => {
      EB.qcSet(t, L);
      EB.renderPal && EB.renderPal();
    };
    const bind = () => {
      const box = $('shB').querySelector('.qcl');
      if (box && EB.dragSort)
        EB.dragSort(box, '.tr', ord => {
          L = ord.map(i => L[i]);
          save();
          rend();
        });
    };
    const rend = () => {
      const sc = $('shB').scrollTop;
      $('shB').innerHTML = body();
      $('shB').scrollTop = sc;
      bind();
    };
    EB.sheet(
      'ألوان الاختصارات — ' + (TN[t] || ''),
      body(),
      '<button data-df>استعادة الافتراضي</button><button class="pri" data-ok>تم</button>',
      e => {
        const b = e.target.closest('button');
        if (!b) return;
        const d = b.dataset;
        if (d.ok !== undefined) {
          EB.closeSheet();
          return;
        }
        if (d.df !== undefined) {
          L = EB.qcDefault(t);
          save();
          rend();
          return;
        }
        if (d.rm !== undefined) {
          if (L.length > 1) {
            L.splice(+d.rm, 1);
            save();
            rend();
          }
          return;
        }
        if (d.ed !== undefined) {
          const i = +d.ed;
          EB.Colors.pick(
            L[i],
            c => {
              L[i] = c;
              save();
              rend();
            },
            { title: 'تغيير اللون' }
          );
          return;
        }
        if (d.add !== undefined) {
          EB.Colors.pick(
            EB.S.color || '#1b57d6',
            c => {
              if (!L.some(x => x.toLowerCase() === c.toLowerCase())) L.push(c);
              save();
              rend();
            },
            { title: 'لون جديد للشريط' }
          );
        }
      }
    );
    bind();
  };
  EB.brEditor = function () {
    let order = EB.brAll(),
      off = EB.brOff();
    const body = () =>
      `<p class="n ed-lead">الفرش تظهر بهذا الترتيب في لوحة القلم، وبه تتبدّل عند السحب يميناً أو يساراً على زر السماكة. اسحب المقبض <i class="ti ti-grip-vertical"></i> لإعادة الترتيب، واضغط العين لإخفاء ما لا تحتاجه.</p><div class="kg tl ord brl">${order.map((k, i) => `<div class="tr${off.includes(k) ? ' off' : ''}" data-i="${i}" data-k="${k}"><i class="ti ti-grip-vertical grip"></i><svg class="brsv" viewBox="0 0 24 24" width="38" height="26" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${EB.BR_SVG[k]}</svg><span class="tt">${EB.BRUSHES[k]}<small>${EB.BR_HINT[k]}</small></span><button class="eye" data-vis="${k}" ${k === 'ink' ? 'disabled' : ''} aria-label="إظهار/إخفاء"><i class="ti ti-eye${off.includes(k) ? '-off' : ''}"></i></button></div>`).join('')}</div>`;
    const save = () => {
      EB.brSet(order, off);
    };
    const bind = () => {
      const box = $('shB').querySelector('.brl');
      if (box && EB.dragSort)
        EB.dragSort(box, '.tr', ord => {
          order = ord.map(i => order[i]);
          save();
          rend();
        });
    };
    const rend = () => {
      const sc = $('shB').scrollTop;
      $('shB').innerHTML = body();
      $('shB').scrollTop = sc;
      bind();
    };
    EB.sheet('ترتيب الفرش', body(), '<button class="pri" data-ok>تم</button>', e => {
      const b = e.target.closest('button');
      if (!b) return;
      const d = b.dataset;
      if (d.ok !== undefined) {
        EB.closeSheet();
        return;
      }
      if (d.vis) {
        off = off.includes(d.vis) ? off.filter(x => x !== d.vis) : off.concat(d.vis);
        save();
        rend();
      }
    });
    bind();
  };
})();
