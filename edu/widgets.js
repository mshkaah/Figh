(function () {
  'use strict';
  const EB = window.EB,
    S = EB.S,
    esc = EB.esc,
    ar = EB.ar,
    $ = EB.$,
    world = $('world');
  const LET = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];
  const TAG = {
    bk: ['ti-book-2', 'بطاقة من كتاب'],
    mcq: ['ti-list-check', 'اختيار من متعدد'],
    tf: ['ti-checkbox', 'صح أم خطأ'],
    match: ['ti-arrows-shuffle', 'وصّل'],
    flip: ['ti-help-circle', 'بطاقة إجابة'],
    order: ['ti-arrows-sort', 'رتّب'],
    blank: ['ti-forms', 'أكمل الفراغ'],
    cls: ['ti-layout-columns', 'صنّف'],
    wheel: ['ti-ferry', 'عجلة الاختيار'],
    timer: ['ti-clock', 'مؤقت'],
    hukm: ['ti-scale', 'الحكم الشرعي'],
    reveal: ['ti-list-numbers', 'كشف تدريجي']
  };
  EB.WTAG = TAG;
  const shuf = a => {
    const b = a.map((x, i) => i);
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [b[i], b[j]] = [b[j], b[i]];
    }
    return b;
  };

  let ac = null;
  function tone(seq) {
    if (!S.sound) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      let t = ac.currentTime;
      seq.forEach(([f, d, type, v]) => {
        const o = ac.createOscillator(),
          g = ac.createGain();
        o.type = type || 'sine';
        o.frequency.value = f;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(v || 0.12, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(g);
        g.connect(ac.destination);
        o.start(t);
        o.stop(t + d + 0.02);
        t += d * 0.7;
      });
    } catch (e) {}
  }
  EB.sfx = {
    ok: () =>
      tone([
        [523, 0.16],
        [659, 0.16],
        [784, 0.28]
      ]),
    bad: () =>
      tone([
        [196, 0.22, 'sawtooth', 0.07],
        [165, 0.3, 'sawtooth', 0.07]
      ]),
    end: () =>
      tone([
        [880, 0.18],
        [880, 0.18],
        [880, 0.3]
      ])
  };
  let parts = [],
    raf = 0;

  EB.burst = function (x, y, cnt) {
    const fxm = (EB.CF && EB.CF.fx) || 'confetti';
    if (fxm === 'off') return;
    const n = cnt || 70;
    if (fxm === 'stars') {
      const cols = ['#ffd23f', '#ffb000', '#fff2a8', '#ff9f1c'];
      for (let i = 0; i < n * 0.6; i++) {
        const a = Math.random() * 6.28,
          v = 3 + Math.random() * 8;
        parts.push({
          k: 's',
          x,
          y,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v - 4,
          c: cols[i % 4],
          r: 6 + Math.random() * 9,
          rot: Math.random() * 6,
          vr: (Math.random() - 0.5) * 0.3,
          life: 1,
          g: 0.22
        });
      }
    } else if (fxm === 'fire') {
      const cols = ['#ff4d4d', '#ffb84d', '#ffe14d', '#4dc3ff', '#e05cd0', '#7be0a6'];
      const R = Math.max(1, Math.round(n / 40));
      for (let q = 0; q < R; q++) {
        const ox = x + (q ? (Math.random() - 0.5) * 220 : 0),
          oy = y + (q ? (Math.random() - 0.5) * 120 : 0),
          col = cols[Math.floor(Math.random() * cols.length)];
        for (let i = 0; i < 46; i++) {
          const a = (i / 46) * 6.283 + Math.random() * 0.1,
            v = 4 + Math.random() * 6;
          parts.push({
            k: 'f',
            x: ox,
            y: oy,
            px: ox,
            py: oy,
            vx: Math.cos(a) * v,
            vy: Math.sin(a) * v,
            c: i % 5 === 0 ? '#fff' : col,
            r: 2 + Math.random() * 2,
            life: 1,
            g: 0.12,
            d: 0.018,
            delay: q * 8
          });
        }
      }
    } else {
      const cols = ['#C0502A', '#1b57d6', '#0f8a5f', '#e09b00', '#7a3fc2', '#d6336c'];
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.28,
          v = 4 + Math.random() * 9;
        parts.push({
          x,
          y,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v - 5,
          c: cols[i % 6],
          r: 3 + Math.random() * 4,
          rot: Math.random() * 6,
          vr: (Math.random() - 0.5) * 0.5,
          life: 1
        });
      }
    }
    if (!raf) raf = requestAnimationFrame(fxLoop);
  };
  const star = (c, r) => {
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5 - Math.PI / 2,
        rr = i % 2 ? r * 0.45 : r;
      c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    c.closePath();
    c.fill();
  };
  function fxLoop() {
    const fx = $('fx'),
      c = fx.getContext('2d');
    c.clearRect(0, 0, fx.width, fx.height);
    parts = parts.filter(p => p.life > 0);
    parts.forEach(p => {
      if (p.delay > 0) {
        p.delay--;
        return;
      }
      if (p.k === 'f') {
        p.px = p.x;
        p.py = p.y;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.g;
        p.vx *= 0.97;
        p.vy *= 0.97;
        p.life -= p.d;
        c.save();
        c.globalAlpha = Math.max(0, p.life);
        c.strokeStyle = p.c;
        c.lineWidth = p.r;
        c.lineCap = 'round';
        c.shadowColor = p.c;
        c.shadowBlur = 8;
        c.beginPath();
        c.moveTo(p.px, p.py);
        c.lineTo(p.x, p.y);
        c.stroke();
        c.restore();
        return;
      }
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.g || 0.35;
      p.vx *= 0.985;
      p.rot += p.vr;
      p.life -= p.k === 's' ? 0.012 : 0.014;
      c.save();
      c.globalAlpha = Math.max(0, p.life);
      c.translate(p.x, p.y);
      c.rotate(p.rot);
      c.fillStyle = p.c;
      if (p.k === 's') {
        c.shadowColor = p.c;
        c.shadowBlur = 10;
        star(c, p.r);
      } else c.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
      c.restore();
    });
    raf = parts.length ? requestAnimationFrame(fxLoop) : 0;
    if (!raf) c.clearRect(0, 0, fx.width, fx.height);
  }

  const TH = [
    ['plain', 'عام', '#8a5a2b', 0, '', ''],
    ['faida', 'فائدة', '#2f7d5b', 0, 'ti-bulb', 'فائدة'],
    ['tanbih', 'تنبيه', '#b8791a', 0, 'ti-alert-triangle', 'تنبيه'],
    ['khilaf', 'خلاف', '#4a5fa8', 0, 'ti-scale', 'مسألة خلافية'],
    ['qaida', 'قاعدة', '#8c2f3b', 0, 'ti-book-2', 'قاعدة'],
    ['murajaa', 'مراجعة', '#51606e', 0, 'ti-repeat', 'مراجعة'],
    ['custom', 'لون خاص', '#1b57d6', 0, '', '']
  ];
  EB.TH = TH;
  const DF = { e: ['ti-leaf', 'سهل'], m: ['ti-bolt', 'متوسط'], h: ['ti-flame', 'صعب'], x: ['ti-flame', 'صعب جداً'] };
  const thOf = d => {
    const t = TH.find(x => x[0] === (d.th || 'plain')) || TH[0];
    return { id: t[0], a: t[0] === 'custom' ? d.tc || '#1b57d6' : t[2], dk: !!t[3] };
  };
  const W = (EB.W = {});
  const E = () => ({ q: '' });
  W.defaults = {
    hukm: { q: '', a: 0 },
    reveal: { q: '', o: ['', '', ''] },
    bk: { title: '', html: '', book: '' },
    mcq: { q: '', o: ['', '', ''], a: [0] },
    tf: { q: '', a: true },
    match: {
      q: '',
      pairs: [
        ['', ''],
        ['', ''],
        ['', '']
      ]
    },
    flip: { q: '', a: '' },
    order: { q: '', o: ['', '', ''] },
    blank: { q: '' },
    timer: { q: '', sec: 60, up: false },
    cls: {
      q: '',
      c: ['', ''],
      i: [
        ['', 0],
        ['', 0],
        ['', 1],
        ['', 1]
      ]
    },
    wheel: { q: '', o: ['', '', '', ''] }
  };
  W.make = function (k, d, x, y) {
    const c = EB.vc(),
      w = k === 'timer' ? 340 : k === 'wheel' ? 440 : k === 'match' || k === 'bk' ? 640 : 560;
    return {
      t: 'wid',
      id: EB.nid(),
      k,
      d: d || JSON.parse(JSON.stringify(W.defaults[k])),
      w,
      sc: 1,
      x: x == null ? c.x - w / 2 : x,
      y: y == null ? c.y - 120 : y,
      st: {},
      sn: S.sess
    };
  };
  const A = d => (Array.isArray(d.a) ? d.a : [d.a || 0]);
  const ph = (v, t) => (v && v.trim() ? esc(v) : `<span class="ph">${t}</span>`);
  const fmt = sec => {
    sec = Math.max(0, Math.round(sec));
    const h = Math.floor(sec / 3600),
      m = Math.floor((sec % 3600) / 60),
      s = sec % 60,
      p = n => ar(String(n).padStart(2, '0'));
    return (h ? p(h) + ':' : '') + p(m) + ':' + p(s);
  };
  W.fmt = fmt;

  const bt = d => {
    const q = String(d.q || '');
    const old = !Array.isArray(d.hw) && /\{[^}]+\}/.test(q);
    const t = [];
    let wi = 0,
      n = 0;
    const hw = Array.isArray(d.hw) ? d.hw : [];
    if (old) {
      let k = 0;
      q.split(/(\{[^}]*\})/).forEach(seg => {
        const m = /^\{([^}]*)\}$/.exec(seg);
        if (m) {
          t.push({ w: m[1], h: 1, i: k++ });
          n++;
        } else if (seg) t.push({ s: seg });
      });
      return { t, n };
    }
    q.split(/(\s+)/).forEach(seg => {
      if (!seg) return;
      if (/^\s+$/.test(seg)) t.push({ s: seg });
      else {
        const h = hw.includes(wi);
        t.push({ w: seg, h, i: wi });
        if (h) n++;
        wi++;
      }
    });
    return { t, n };
  };
  W.bt = bt;
  const HK = [
    ['واجب', 'يأثم تاركه'],
    ['مستحب', 'يُؤجر فاعله'],
    ['مباح', 'سواء'],
    ['مكروه', 'الأولى تركه'],
    ['حرام', 'يأثم فاعله']
  ];
  EB.HUKM = HK;
  function inner(it) {
    const d = it.d,
      st = (it.st = it.st || {}),
      tg = TAG[it.k];
    const th0 = TH.find(x => x[0] === (d.th || 'plain')) || TH[0];
    let h = `<div class="wh"><span class="tg"><i class="ti ${tg[0]}"></i>${tg[1]}</span>${th0[5] ? `<span class="rl"><i class="ti ${th0[4]}"></i>${th0[5]}</span>` : ''}<span class="sp"></span>${DF[d.df] ? `<span class="dfb df-${d.df}"><i class="ti ${DF[d.df][0]}"></i>${DF[d.df][1]}${d.df === 'x' ? '<s></s><s></s><s></s>' : ''}</span>` : ''}<button class="rs ib" data-a="rs" title="إعادة السؤال" aria-label="إعادة السؤال"><i class="ti ti-refresh"></i></button></div>`,
      qh = '',
      ah = '';
    if (it.k === 'bk')
      return `<div class="bkc${d.gl ? ' pinned' : ''}"><div class="bkh"><i class="ti ${d.gl ? 'ti-pin' : 'ti-book-2'}"></i><b>${esc(d.title || '')}</b><small>${esc(d.book || '')}</small></div><div class="bk m-text${EB.CF && EB.CF.gl === 'off' ? ' ng' : ''}" style="font-size:${d.fs || 26}px;line-height:2">${EB.unitize({ html: d.html || '' }, new Set(d.hid || []), d.hl).html}</div></div>`;
    if (it.k !== 'timer' && it.k !== 'blank' && !(it.k === 'wheel' && !d.q))
      qh += `<div class="q">${ph(d.q, 'اكتب السؤال')}</div>`;
    else if (it.k === 'timer' && d.q) qh += `<div class="q" style="font-size:22px;text-align:center">${esc(d.q)}</div>`;
    if (it.k === 'mcq') {
      st.p = st.p || {};
      const C = A(d);
      if (C.length > 1) ah += `<div class="mu">أكثر من إجابة صحيحة (${ar(C.length)})</div>`;
      d.o.forEach((o, i) => {
        const done = st.done,
          ok = C.includes(i),
          cls = st.p[i] ? (ok ? 'ok' : 'no') : done ? (ok ? 'ok' : 'dim') : '';
        ah += `<button class="opt ${cls}" data-a="opt:${i}"><span class="lt">${LET[i] || i + 1}</span><span class="ot">${ph(o, 'الخيار ' + ar(i + 1))}</span></button>`;
      });
    } else if (it.k === 'tf') {
      const r = st.pick;
      ah += `<div class="tfrow">${[true, false]
        .map(v => {
          const cls = r == null ? '' : v === r ? (r === d.a ? 'ok' : 'no') : st.done && v === d.a ? 'ok' : 'dim';
          return `<button class="opt tfb ${cls}" data-a="tf:${v}"><i class="ti ti-${v ? 'check' : 'x'}"></i><span>${v ? 'صح' : 'خطأ'}</span></button>`;
        })
        .join('')}</div>`;
    } else if (it.k === 'hukm') {
      st.p = st.p || {};
      ah += `<div class="hk">${HK.map((x, i) => {
        const ok = i === d.a,
          cls = st.p[i] ? (ok ? 'ok' : 'no') : st.done ? (ok ? 'ok' : 'dim') : '';
        return `<button class="opt ${cls}" data-h="${i}" data-a="hk:${i}">${x[0]}<small>${x[1]}</small></button>`;
      }).join('')}</div>`;
    } else if (it.k === 'reveal') {
      st.rv = st.rv || {};
      const O = d.o.filter(x => x && x.trim()),
        left = O.filter((x, i) => !st.rv[i]).length;
      ah += `<div class="rvl">${O.map((o, i) => (st.rv[i] ? `<div class="ri on"><span class="lt">${ar(i + 1)}</span><span class="ot">${esc(o)}</span></div>` : `<button class="ri" data-a="rv:${i}"><span class="lt">${ar(i + 1)}</span><span class="hid">اضغط للكشف</span></button>`)).join('')}${left ? `<button class="rn" data-a="rv:next"><i class="ti ti-eye"></i>كشف التالي</button>` : ''}</div>`;
    } else if (it.k === 'flip')
      ah += `<div class="flip${st.fl ? ' fl' : ''}" data-a="flip"><div class="fi"><div class="fa">اضغط لإظهار الإجابة</div><div class="fb">${ph(d.a, 'الجواب')}</div></div></div>`;
    else if (it.k === 'match') {
      st.ord = st.ord || shuf(d.pairs);
      st.dn = st.dn || {};
      ah += `<div class="mt"><div class="col">${d.pairs.map((p, i) => `<div class="it${st.dn[i] ? ' done' : ''}${st.sel === i ? ' sel' : ''}" data-a="mr:${i}">${ph(p[0], '…')}</div>`).join('')}</div><div class="col">${st.ord.map(j => `<div class="it${st.dn[j] ? ' done' : ''}" data-a="ml:${j}">${ph(d.pairs[j][1], '…')}</div>`).join('')}</div></div>`;
    } else if (it.k === 'order') {
      st.ord = st.ord || shuf(d.o);
      st.seq = st.seq || [];
      ah += `<div class="ordl">${st.ord
        .map(j => {
          const n = st.seq.indexOf(j);
          return `<button class="opt${n >= 0 ? ' ok' : ''}" data-a="od:${j}"><span class="lt">${n >= 0 ? ar(n + 1) : '؟'}</span><span class="ot">${ph(d.o[j], '…')}</span></button>`;
        })
        .join('')}</div>`;
    } else if (it.k === 'blank') {
      st.rv = st.rv || {};
      const T = bt(d);
      if (!T.n) ah += `<div class="q"><span class="ph">اكتب الجملة ثم اضغط على الكلمات التي تريد إخفاءها</span></div>`;
      else
        ah += `<div class="q bl">${T.t
          .map(x => {
            if (x.s) return esc(x.s).replace(/\n/g, '<br>');
            return x.h
              ? st.rv[x.i]
                ? `<span class="bw on">${esc(x.w)}</span>`
                : `<button class="bw" data-a="bl:${x.i}" style="min-width:${Math.max(3, x.w.length * 0.6)}em">&nbsp;</button>`
              : esc(x.w);
          })
          .join('')}</div>`;
    } else if (it.k === 'cls') {
      st.dn = st.dn || {};
      ah += `<div class="cls"><div class="cc">${d.c.map((c, k) => `<div class="ccol" data-a="cc:${k}"><b>${ph(c, 'الفئة ' + ar(k + 1))}</b><div class="cin">${d.i.map((p, i) => (st.dn[i] && p[1] === k ? `<span class="cdn">${esc(p[0])}</span>` : '')).join('')}</div></div>`).join('')}</div><div class="cpool">${d.i.map((p, i) => (st.dn[i] ? '' : `<button class="cchip${st.sel === i ? ' sel' : ''}" data-a="ci:${i}">${ph(p[0], '…')}</button>`)).join('')}${d.i.every((p, i) => st.dn[i]) ? '<div class="cfin"><i class="ti ti-circle-check"></i>أحسنت، صُنّفت كلها</div>' : ''}</div></div>`;
    } else if (it.k === 'wheel') {
      const O = d.o.filter(x => x && x.trim()),
        n = Math.max(O.length, 2),
        sg = 360 / n,
        pt = (a, r) =>
          [100 + r * Math.sin((a * Math.PI) / 180), 100 - r * Math.cos((a * Math.PI) / 180)]
            .map(v => v.toFixed(1))
            .join(' '),
        fl = [88, 52, 72, 34];
      const segs = O.map(
        (o, i) =>
          `<path d="M100 100L${pt(i * sg, 94)}A94 94 0 0 1 ${pt((i + 1) * sg, 94)}Z" fill="color-mix(in srgb,var(--wa,var(--accent)) ${fl[i % 4]}%,var(--surface))" stroke="var(--surface)" stroke-width="2"/><text x="100" y="34" transform="rotate(${(i + 0.5) * sg} 100 100)" text-anchor="middle" font-size="${n > 7 ? 9 : 11}" font-weight="700" fill="${fl[i % 4] > 60 ? '#fff' : 'var(--text)'}">${esc(o.length > 11 ? o.slice(0, 10) + '…' : o)}</text>`
      ).join('');
      ah += `<div class="whl"><div class="wpt"></div><svg viewBox="0 0 200 200" style="transform:rotate(${st.rot || 0}deg)">${segs || '<circle cx="100" cy="100" r="94" fill="var(--surface-2)"/>'}<circle cx="100" cy="100" r="12" fill="var(--surface)" stroke="var(--line-strong)" stroke-width="2"/></svg></div><div class="wres">${st.res ? `<i class="ti ti-sparkles"></i>${esc(st.res)}` : st.spin ? '…' : 'اضغط «أدر» لاختيار عشوائي'}</div><button class="wgo" data-a="wh:go"${st.spin ? ' disabled' : ''}><i class="ti ti-rotate-clockwise-2"></i>أدر العجلة</button>`;
    } else if (it.k === 'timer') {
      const v = d.up ? st.el || 0 : st.left == null ? d.sec : st.left;
      ah += `<div class="tm${st.end ? ' end' : ''}"><div class="t">${fmt(v)}</div><div class="bt"><button data-a="tm:play"><i class="ti ti-${st.run ? 'player-pause' : 'player-play'}"></i></button><button data-a="tm:reset"><i class="ti ti-player-stop"></i></button>${d.up ? '' : '<button data-a="tm:-"><i class="ti ti-minus"></i></button><button data-a="tm:+"><i class="ti ti-plus"></i></button>'}</div></div>`;
    }
    if (it.k === 'blank') return h + `<div class="bd2">${ah}</div>`;
    return h + `<div class="bd2">${qh}<div class="an">${ah}</div></div>`;
  }
  const done = el => el;
  W.render = function (it) {
    if (!it._el) return;
    const t = thOf(it.d);
    it._el.className =
      'wid th-' +
      t.id +
      (t.dk ? ' dk' : '') +
      ' ly-' +
      (it.d.ly || 's') +
      (it.d.gr ? ' gr' : '') +
      ' fz-' +
      (it.d.fz || 'm') +
      ' sk-' +
      (it.d.sk || 'soft');
    if (t.id === 'custom') {
      it._el.style.setProperty('--wa', t.a);
      it._el.style.setProperty('--wbg', `color-mix(in srgb,${t.a} 12%,var(--surface))`);
    } else {
      it._el.style.removeProperty('--wa');
      it._el.style.removeProperty('--wbg');
    }
    it._el.innerHTML = inner(it);
    EB.S.dirty = 1;
  };
  W.place = function (it) {
    if (!it._el) return;
    const e = it._el;
    e.style.left = it.x + 'px';
    e.style.top = it.y + 'px';
    e.style.width = it.w + 'px';
    e.style.transform = it.sc && it.sc !== 1 ? `scale(${it.sc})` : '';
    S.dirty = 1;
  };
  EB.mountWidgets = function () {
    const wl = $('wl');
    if (!wl) return;
    wl.innerHTML = '';
    EB.clearLayers();
    EB.page().items.forEach(it => {
      if (it.t !== 'wid') return;
      if (!EB.vis(it)) {
        it._el = null;
        return;
      }
      const e = document.createElement('div');
      e.dataset.w = it.id;
      e.dir = 'rtl';
      wl.appendChild(e);
      it._el = e;
      W.place(it);
      W.render(it);
    });
    EB.layout(true);
    S.dirty = 1;
  };
  W.refresh = function (it) {
    W.render(it);
  };
  W.act = function (el, x, y) {
    const wEl = el.closest('.wid');
    const it = EB.page().items.find(i => String(i.id) === wEl.dataset.w);
    if (!it) return;
    const [a, v] = el.dataset.a.split(':'),
      d = it.d,
      st = (it.st = it.st || {});
    if (a === 'rs') {
      it.st = {};
      W.render(it);
      return;
    }
    if (it.k === 'mcq' && a === 'opt') {
      const i = +v,
        C = A(d);
      if (st.done || (st.p && st.p[i])) return;
      st.p = st.p || {};
      st.p[i] = 1;
      if (C.includes(i)) {
        EB.sfx.ok();
        if (C.every(c => st.p[c])) {
          st.done = 1;
          EB.burst(x, y);
        } else EB.burst(x, y, 18);
      } else EB.sfx.bad();
      W.render(it);
    } else if (it.k === 'tf' && a === 'tf') {
      if (st.done) return;
      st.pick = v === 'true';
      if (st.pick === d.a) {
        st.done = 1;
        EB.burst(x, y);
        EB.sfx.ok();
      } else {
        EB.sfx.bad();
        st.done = 0;
        setTimeout(() => {
          if (st.pick !== d.a) {
            st.pick = null;
            W.render(it);
          }
        }, 900);
      }
      W.render(it);
    } else if (it.k === 'hukm' && a === 'hk') {
      const i = +v;
      if (st.done || (st.p && st.p[i])) return;
      st.p = st.p || {};
      st.p[i] = 1;
      if (i === d.a) {
        st.done = 1;
        EB.sfx.ok();
        EB.burst(x, y);
      } else EB.sfx.bad();
      W.render(it);
    } else if (it.k === 'reveal' && a === 'rv') {
      st.rv = st.rv || {};
      const O = d.o.filter(q => q && q.trim());
      if (v === 'next') {
        const i = O.findIndex((q, k) => !st.rv[k]);
        if (i >= 0) st.rv[i] = 1;
      } else st.rv[+v] = 1;
      EB.sfx.ok();
      if (O.every((q, k) => st.rv[k])) EB.burst(x, y, 30);
      W.render(it);
    } else if (it.k === 'flip') {
      st.fl = !st.fl;
      W.render(it);
      if (st.fl) EB.sfx.ok();
    } else if (it.k === 'order' && a === 'od') {
      const j = +v;
      st.seq = st.seq || [];
      if (st.seq.includes(j)) return;
      if (j === st.seq.length) {
        st.seq.push(j);
        EB.sfx.ok();
        if (st.seq.length === d.o.length) EB.burst(x, y);
        W.render(it);
      } else {
        EB.sfx.bad();
        el.classList.add('bad');
        setTimeout(() => el.classList.remove('bad'), 450);
      }
    } else if (it.k === 'blank' && a === 'bl') {
      st.rv = st.rv || {};
      st.rv[+v] = 1;
      EB.sfx.ok();
      const tot = bt(d).n;
      if (Object.keys(st.rv).length >= tot) EB.burst(x, y);
      W.render(it);
    } else if (it.k === 'match') {
      if (a === 'mr') {
        if (st.dn[+v]) return;
        st.sel = st.sel === +v ? null : +v;
        W.render(it);
      } else if (a === 'ml') {
        if (st.sel == null || st.dn[+v]) return;
        if (st.sel === +v) {
          st.dn[+v] = 1;
          st.sel = null;
          EB.sfx.ok();
          EB.burst(x, y);
          if (Object.keys(st.dn).length === d.pairs.length)
            setTimeout(() => EB.burst(innerWidth / 2, innerHeight / 3), 250);
          W.render(it);
        } else {
          EB.sfx.bad();
          el.classList.add('bad');
          setTimeout(() => el.classList.remove('bad'), 450);
        }
      }
    } else if (it.k === 'cls') {
      st.dn = st.dn || {};
      if (a === 'ci') {
        const i = +v;
        if (st.dn[i]) return;
        st.sel = st.sel === i ? null : i;
        W.render(it);
      } else if (a === 'cc') {
        if (st.sel == null) {
          EB.toast('اختر عنصراً أولاً ثم اضغط فئته');
          return;
        }
        if (d.i[st.sel][1] === +v) {
          st.dn[st.sel] = 1;
          st.sel = null;
          EB.sfx.ok();
          EB.burst(x, y, 18);
          if (d.i.every((p, i) => st.dn[i])) setTimeout(() => EB.burst(innerWidth / 2, innerHeight / 3), 200);
          W.render(it);
        } else {
          EB.sfx.bad();
          el.classList.add('bad');
          setTimeout(() => el.classList.remove('bad'), 450);
        }
      }
    } else if (it.k === 'wheel' && a === 'wh') {
      if (st.spin) return;
      const O = d.o.filter(q => q && q.trim());
      if (O.length < 2) return;
      const n = O.length,
        sg = 360 / n,
        w = Math.floor(Math.random() * n),
        jit = (Math.random() - 0.5) * sg * 0.6,
        prev = st.rot || 0,
        nx = Math.ceil(prev / 360) * 360 + 1800 + (360 - (w + 0.5) * sg) + jit;
      st.spin = 1;
      st.res = '';
      W.render(it);
      const sv = it._el.querySelector('.whl svg');
      if (sv) {
        void sv.getBoundingClientRect();
        sv.style.transition = 'transform 3.6s cubic-bezier(.12,.62,.12,1)';
        sv.style.transform = `rotate(${nx}deg)`;
      }
      let tk = 0;
      const ti = setInterval(() => {
        if (EB.sfx.tick && tk++ < 24) EB.sfx.tick();
      }, 140);
      setTimeout(() => {
        clearInterval(ti);
        st.rot = nx;
        st.spin = 0;
        st.res = O[w];
        EB.sfx.ok();
        W.render(it);
        const r = it._el.getBoundingClientRect();
        EB.burst(r.left + r.width / 2, r.top + r.height / 2);
      }, 3700);
    } else if (it.k === 'timer') {
      if (v === 'play') {
        if (d.up) {
          if (st.run) {
            st.el = (Date.now() - st.startAt) / 1000;
            st.run = 0;
          } else {
            st.startAt = Date.now() - (st.el || 0) * 1000;
            st.run = 1;
          }
        } else if (st.run) {
          st.left = Math.max(0, (st.endAt - Date.now()) / 1000);
          st.run = 0;
        } else {
          if (st.left == null || st.left <= 0) st.left = d.sec;
          st.endAt = Date.now() + st.left * 1000;
          st.run = 1;
          st.end = 0;
        }
      } else if (v === 'reset') {
        it.st = {};
      } else if (v === '+' || v === '-') {
        const stp = d.sec >= 600 ? 60 : 30;
        d.sec = Math.max(10, d.sec + (v === '+' ? stp : -stp));
        if (!st.run) st.left = d.sec;
        else st.endAt += (v === '+' ? stp : -stp) * 1000;
        EB.save();
      }
      W.render(it);
    }
  };
  setInterval(() => {
    const pg = EB.page();
    if (!pg) return;
    pg.items.forEach(it => {
      if (it.t !== 'wid' || it.k !== 'timer' || !it.st || !it.st.run) return;
      if (it.d.up) {
        it.st.el = (Date.now() - it.st.startAt) / 1000;
        W.render(it);
        return;
      }
      const left = Math.max(0, (it.st.endAt - Date.now()) / 1000);
      it.st.left = left;
      if (left <= 0) {
        it.st.run = 0;
        it.st.end = 1;
        EB.sfx.end();
      }
      W.render(it);
    });
  }, 250);

  const NAMES = {
    mcq: 'اختيار من متعدد',
    tf: 'صح أم خطأ',
    match: 'توصيل',
    flip: 'بطاقة إجابة',
    order: 'ترتيب',
    blank: 'أكمل الفراغ',
    cls: 'صنّف في فئات',
    wheel: 'عجلة الاختيار',
    timer: 'مؤقت',
    hukm: 'الحكم الشرعي',
    reveal: 'كشف تدريجي'
  };
  EB.QNAMES = NAMES;
  EB.editWidget = it => EB.questionEditor(it.k, it);
  EB.questionEditor = function (kind, it, newPage) {
    const d = it ? JSON.parse(JSON.stringify(it.d)) : JSON.parse(JSON.stringify(W.defaults[kind]));
    if (kind === 'mcq') d.a = A(d).slice();
    if (kind === 'blank' && !Array.isArray(d.hw)) {
      const q0 = String(d.q || ''),
        hw = [];
      if (/\{[^}]+\}/.test(q0)) {
        let wi = 0;
        q0.replace(/\{([^}]*)\}|(\S+)/g, (m, a, b) => {
          if (a != null) {
            a.trim()
              .split(/\s+/)
              .forEach(() => {
                hw.push(wi++);
              });
          } else wi++;
          return m;
        });
        d.q = q0.replace(/[{}]/g, '');
        d.hw = hw;
      } else d.hw = [];
    }
    const IN = (cls, att, val, pl) => `<input class="ginp" ${att} value="${esc(val)}" placeholder="${pl}">`;
    const ap = true;
    const rows = () => {
      if (kind === 'mcq')
        return d.o
          .map(
            (o, i) =>
              `<div class="orow" data-i="${i}"><i class="ti ti-grip-vertical grip"></i><button data-ok="${i}" class="${d.a.includes(i) ? 'on' : ''}" title="إجابة صحيحة"><i class="ti ti-check"></i></button>${IN('', 'data-o="' + i + '"', o, 'الخيار ' + ar(i + 1))}<button data-rm="${i}" ${d.o.length <= 2 ? 'disabled' : ''}><i class="ti ti-x"></i></button></div>`
          )
          .join('');
      if (kind === 'order')
        return d.o
          .map(
            (o, i) =>
              `<div class="orow" data-i="${i}"><i class="ti ti-grip-vertical grip"></i><span class="pn">${ar(i + 1)}</span>${IN('', 'data-o="' + i + '"', o, 'العنصر ' + ar(i + 1))}<button data-rm="${i}" ${d.o.length <= 2 ? 'disabled' : ''}><i class="ti ti-x"></i></button></div>`
          )
          .join('');
      if (kind === 'match')
        return d.pairs
          .map(
            (p, i) =>
              `<div class="orow" data-i="${i}"><i class="ti ti-grip-vertical grip"></i>${IN('', 'data-pl="' + i + '"', p[0], 'العنصر')}<i class="ti ti-arrows-left-right" style="color:var(--mute)"></i>${IN('', 'data-pr="' + i + '"', p[1], 'ما يناسبه')}<button data-rm="${i}" ${d.pairs.length <= 2 ? 'disabled' : ''}><i class="ti ti-x"></i></button></div>`
          )
          .join('');
      if (kind === 'wheel' || kind === 'reveal')
        return d.o
          .map(
            (o, i) =>
              `<div class="orow" data-i="${i}"><i class="ti ti-grip-vertical grip"></i>${IN('', 'data-o="' + i + '"', o, 'الخيار ' + ar(i + 1))}<button data-rm="${i}" ${d.o.length <= 2 ? 'disabled' : ''}><i class="ti ti-x"></i></button></div>`
          )
          .join('');
      if (kind === 'cls')
        return d.i
          .map(
            (p, i) =>
              `<div class="orow" data-i="${i}">${IN('', 'data-ci="' + i + '"', p[0], 'العنصر ' + ar(i + 1))}<button data-ct="${i}" class="catb" title="الفئة الصحيحة">${esc((d.c[p[1]] || '').trim() || 'فئة ' + ar(p[1] + 1))}</button><button data-rm="${i}" ${d.i.length <= 2 ? 'disabled' : ''}><i class="ti ti-x"></i></button></div>`
          )
          .join('');
      return '';
    };
    const hms = () => {
      const s = d.sec || 60;
      return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60];
    };
    const render = () => {
      let h = '';
      if (kind === 'blank') {
        const T = bt(Object.assign({}, d, { hw: d.hw || [] }));
        h += `<div class="fld"><label>اكتب الجملة كاملة</label><textarea class="ginp" id="qq" rows="3" placeholder="مثال: عدد ركعات الوتر ثلاث عند الحنفية">${esc(d.q)}</textarea></div><div class="fld"><label>اضغط على الكلمات التي تريد إخفاءها</label><div class="wch" id="wch">${
          T.t
            .filter(x => !x.s)
            .map(x => `<button data-hw="${x.i}" class="${x.h ? 'on' : ''}">${esc(x.w)}</button>`)
            .join('') || '<span class="n">اكتب الجملة أولاً ثم اضغط «تحديث الكلمات»</span>'
        }</div><button data-rw><i class="ti ti-refresh"></i>تحديث الكلمات</button></div>`;
      } else if (kind === 'timer' || kind === 'wheel')
        h += `<div class="fld"><label>عنوان (اختياري)</label><input class="ginp" id="qq" value="${esc(d.q)}" placeholder="${kind === 'wheel' ? 'مثال: من يجيب؟' : 'مثال: وقت المناقشة'}"></div>`;
      else
        h += `<div class="fld"><label>${kind === 'tf' ? 'العبارة' : 'السؤال'}</label><textarea class="ginp" id="qq" rows="2" placeholder="اكتب ${kind === 'tf' ? 'العبارة' : 'السؤال'} هنا">${esc(d.q)}</textarea></div>`;
      if (kind === 'mcq')
        h += `<div class="fld"><label>الخيارات — اضغط ✓ على إجابة أو أكثر (يمكن أن تكون الإجابات الصحيحة متعددة)</label><div id="opts">${rows()}</div><button data-add ${d.o.length >= 8 ? 'disabled' : ''}><i class="ti ti-plus"></i>خيار</button></div>`;
      if (kind === 'order')
        h += `<div class="fld"><label>اكتب العناصر بالترتيب الصحيح (تُخلط عند العرض)</label><div id="opts">${rows()}</div><button data-add ${d.o.length >= 8 ? 'disabled' : ''}><i class="ti ti-plus"></i>عنصر</button></div>`;
      if (kind === 'reveal')
        h += `<div class="fld"><label>النقاط (تُكشف واحدة تلو الأخرى)</label><div id="opts">${rows()}</div><button data-add ${d.o.length >= 10 ? 'disabled' : ''}><i class="ti ti-plus"></i>نقطة</button></div>`;
      if (kind === 'hukm')
        h += `<div class="fld"><label>الحكم الصحيح</label><div class="hkp">${HK.map((x, i) => `<button data-hk="${i}" class="${d.a === i ? 'on' : ''}">${x[0]}</button>`).join('')}</div></div>`;
      if (kind === 'wheel')
        h += `<div class="fld"><label>الأسماء أو الأسئلة التي تدور عليها العجلة</label><div id="opts">${rows()}</div><button data-add ${d.o.length >= 12 ? 'disabled' : ''}><i class="ti ti-plus"></i>خيار</button></div>`;
      if (kind === 'cls')
        h += `<div class="fld"><label>الفئات (٢ إلى ٤)</label>${d.c.map((c, k) => `<div class="orow"><span class="pn">${ar(k + 1)}</span>${IN('', 'data-cn="' + k + '"', c, 'اسم الفئة ' + ar(k + 1))}<button data-rmc="${k}" ${d.c.length <= 2 ? 'disabled' : ''}><i class="ti ti-x"></i></button></div>`).join('')}<button data-addc ${d.c.length >= 4 ? 'disabled' : ''}><i class="ti ti-plus"></i>فئة</button></div><div class="fld"><label>العناصر — اضغط زر الفئة لتغييرها</label><div id="cop">${rows()}</div><button data-add ${d.i.length >= 12 ? 'disabled' : ''}><i class="ti ti-plus"></i>عنصر</button></div>`;
      if (kind === 'tf')
        h += `<div class="fld"><label>الحكم الصحيح</label><div class="kseg"><button data-tf="1" class="${d.a ? 'on' : ''}"><i class="ti ti-check"></i>صح</button><button data-tf="0" class="${d.a ? '' : 'on'}"><i class="ti ti-x"></i>خطأ</button></div></div>`;
      if (kind === 'match')
        h += `<div class="fld"><label>الأزواج المتطابقة (تُخلط عند العرض)</label><div id="opts">${rows()}</div><button data-add ${d.pairs.length >= 8 ? 'disabled' : ''}><i class="ti ti-plus"></i>زوج</button></div>`;
      if (kind === 'flip')
        h += `<div class="fld"><label>الجواب (يظهر عند الضغط على البطاقة)</label><textarea class="ginp" id="qans" rows="2" placeholder="اكتب الجواب هنا">${esc(d.a)}</textarea></div>`;
      if (kind === 'timer') {
        const [hh, mm, ss] = hms(),
          fmt = (hh ? ar(hh) + ':' : '') + ar(String(mm).padStart(2, '0')) + ':' + ar(String(ss).padStart(2, '0'));
        h += `<div class="fld"><label>نوع المؤقت</label><div class="kseg"><button data-up="0" class="${d.up ? '' : 'on'}"><i class="ti ti-hourglass-low"></i> تنازلي</button><button data-up="1" class="${d.up ? 'on' : ''}"><i class="ti ti-stopwatch"></i> ساعة إيقاف</button></div></div>${
          d.up
            ? ''
            : `<div class="fld"><label>المدة</label><button class="tdur${d.wo ? ' open' : ''}" data-wo><b>${fmt}</b><small>${hh ? 'ساعة : دقيقة : ثانية' : 'دقيقة : ثانية'}</small><i class="ti ti-chevron-down"></i></button>${
                d.wo
                  ? `<div class="tw">${[
                      ['h', 24, hh, 'ساعة'],
                      ['m', 60, mm, 'دقيقة'],
                      ['s', 60, ss, 'ثانية']
                    ]
                      .map(
                        c =>
                          `<div class="twc"><div class="twh">${c[3]}</div><div class="tww" data-w="${c[0]}" data-v="${c[2]}">${Array.from({ length: c[1] }, (_, i) => `<div class="${i === c[2] ? 'on' : ''}">${String(i).padStart(2, '0')}</div>`).join('')}</div></div>`
                      )
                      .join('')}</div>`
                  : ''
              }<div class="kchips tpre">${[
                [30, '٣٠ ثانية'],
                [60, 'دقيقة'],
                [300, '٥ دقائق'],
                [600, '١٠ دقائق'],
                [900, '١٥ دقيقة'],
                [1800, '٣٠ دقيقة'],
                [3600, 'ساعة']
              ]
                .map(p => `<button class="kchip${d.sec === p[0] ? ' on' : ''}" data-pre="${p[0]}">${p[1]}</button>`)
                .join('')}</div></div>`
        }`;
      }
      const thn = (TH.find(t => t[0] === (d.th || 'plain')) || TH[0])[1],
        dfn = DF[d.df] ? DF[d.df][1] : 'بلا صعوبة';
      h += `<div class="aph"><i class="ti ti-palette"></i><span>المظهر والهوية</span></div>`;
      if (ap) {
        h += `<div class="fld"><label>شكل البطاقة</label><div class="sks">${[
          ['soft', 'ناعم'],
          ['bold', 'شريط ملوّن'],
          ['flat', 'إطار'],
          ['note', 'دفتر'],
          ['chalk', 'سبورة'],
          ['side', 'شريط جانبي'],
          ['lift', 'مرفوعة']
        ]
          .map(
            s =>
              `<button data-sk="${s[0]}" class="${(d.sk || 'soft') === s[0] ? 'on' : ''}"><span class="skp sk-${s[0]}"><b></b><i></i><i></i></span>${s[1]}</button>`
          )
          .join('')}</div></div>`;
        if (kind !== 'timer' && kind !== 'wheel')
          h += `<div class="fld"><label>تخطيط السؤال</label><div class="lys">${[
            ['s', 'السؤال أعلى والأجوبة أسفل', '<i></i><u></u>'],
            ['a', 'الأجوبة أعلى', '<u></u><i></i>'],
            ['r', 'السؤال يمين والأجوبة يسار', '<i></i><u></u>'],
            ['l', 'السؤال يسار والأجوبة يمين', '<u></u><i></i>']
          ]
            .map(
              l =>
                `<button data-ly="${l[0]}" class="ly ly-${l[0]}${(d.ly || 's') === l[0] ? ' on' : ''}"><span class="lp">${l[2]}</span><em>${l[1]}</em></button>`
            )
            .join(
              ''
            )}</div></div>${kind === 'mcq' || kind === 'order' ? `<div class="fld"><label>ترتيب الخيارات</label><div class="kseg"><button data-gr="0" class="${d.gr ? '' : 'on'}"><i class="ti ti-list"></i> قائمة</button><button data-gr="1" class="${d.gr ? 'on' : ''}"><i class="ti ti-layout-grid"></i> عمودان</button></div></div>` : ''}<div class="fld"><label>حجم الخط</label><div class="kseg">${[
            ['s', 'صغير'],
            ['m', 'متوسط'],
            ['l', 'كبير']
          ]
            .map(z => `<button data-fz="${z[0]}" class="${(d.fz || 'm') === z[0] ? 'on' : ''}">${z[1]}</button>`)
            .join('')}</div></div>`;
        h += `<div class="fld"><label>مستوى الصعوبة</label><div class="kseg">${[
          ['', 'بلا'],
          ['e', 'سهل'],
          ['m', 'متوسط'],
          ['h', 'صعب'],
          ['x', 'صعب جداً']
        ]
          .map(x => `<button data-df="${x[0]}" class="${(d.df || '') === x[0] ? 'on' : ''}">${x[1]}</button>`)
          .join('')}</div></div>`;
        h += `<div class="fld"><label>دور السؤال وهويته</label><div class="ths2">${TH.map(t => `<button data-th="${t[0]}" class="thc${(d.th || 'plain') === t[0] ? ' on' : ''}"><i class="dot${t[0] === 'custom' && !d.tc ? ' cu' : ''}" style="${t[0] === 'custom' ? (d.tc ? 'background:' + d.tc : '') : 'background:' + t[2]}"></i><span>${t[1]}</span></button>`).join('')}</div></div>`;
      }
      $('shB').innerHTML = h;
      $('shB')
        .querySelectorAll('.tww')
        .forEach(w => {
          w.scrollTop = +w.dataset.v * 40;
          let tm = 0;
          w.addEventListener('scroll', () => {
            clearTimeout(tm);
            tm = setTimeout(() => {
              const i = Math.round(w.scrollTop / 40);
              w.querySelectorAll('div').forEach((n, k) => n.classList.toggle('on', k === i));
              w.dataset.v = i;
              const g = k => +($('shB').querySelector('[data-w=' + k + ']') || { dataset: { v: 0 } }).dataset.v;
              d.sec = Math.max(5, g('h') * 3600 + g('m') * 60 + g('s'));
              const bb = $('shB').querySelector('.tdur b');
              if (bb) {
                const H = g('h'),
                  M = g('m'),
                  Sx = g('s');
                bb.textContent =
                  (H ? ar(H) + ':' : '') + ar(String(M).padStart(2, '0')) + ':' + ar(String(Sx).padStart(2, '0'));
              }
            }, 90);
          });
        });
      const ob = $('opts');
      if (ob)
        EB.dragSort(ob, '.orow', ord => {
          grab();
          if (kind === 'match') d.pairs = ord.map(k => d.pairs[k]);
          else {
            const o0 = d.o;
            d.o = ord.map(k => o0[k]);
            if (kind === 'mcq') d.a = d.a.map(a => ord.indexOf(a));
          }
          render();
        });
    };
    const grab = () => {
      const q = $('qq');
      if (q) d.q = q.value;
      const B = $('shB');
      if (kind === 'mcq' || kind === 'order' || kind === 'wheel' || kind === 'reveal')
        B.querySelectorAll('[data-o]').forEach(i => (d.o[+i.dataset.o] = i.value));
      if (kind === 'match') {
        B.querySelectorAll('[data-pl]').forEach(i => (d.pairs[+i.dataset.pl][0] = i.value));
        B.querySelectorAll('[data-pr]').forEach(i => (d.pairs[+i.dataset.pr][1] = i.value));
      }
      if (kind === 'flip') d.a = $('qans').value;
      if (kind === 'cls') {
        B.querySelectorAll('[data-ci]').forEach(i => (d.i[+i.dataset.ci][0] = i.value));
        B.querySelectorAll('[data-cn]').forEach(i => (d.c[+i.dataset.cn] = i.value));
      }
    };
    EB.sheet(
      (it ? 'تعديل: ' : 'سؤال: ') + NAMES[kind],
      '',
      `<button data-s="no">إلغاء</button><button class="pri" data-s="ok">${it ? 'حفظ' : 'إضافة'}</button>`,
      e => {
        const b = e.target.closest('button');
        if (!b) return;
        const x = b.dataset;
        if (x.s === 'no') {
          if (!EB.sheetBack()) EB.closeSheet();
          return;
        }
        if (x.s === 'ok') {
          grab();
          if (kind === 'mcq' || kind === 'order') {
            const f = d.o.map((o, i) => [o.trim(), i]).filter(p => p[0]);
            if (f.length < 2) {
              EB.toast('اكتب خيارين على الأقل');
              return;
            }
            if (kind === 'mcq') d.a = d.a.map(i => f.findIndex(p => p[1] === i)).filter(i => i >= 0);
            d.o = f.map(p => p[0]);
            if (kind === 'mcq' && !d.a.length) {
              EB.toast('حدّد الإجابة الصحيحة بعلامة ✓');
              return;
            }
          }
          if (kind === 'wheel' || kind === 'reveal') {
            d.o = d.o.map(o => o.trim()).filter(Boolean);
            if (d.o.length < 2) {
              EB.toast(kind === 'reveal' ? 'اكتب نقطتين على الأقل' : 'اكتب خيارين على الأقل');
              return;
            }
          }
          if (kind === 'cls') {
            d.c = d.c.map((c, k) => c.trim() || 'الفئة ' + ar(k + 1));
            d.i = d.i.filter(p => p[0].trim()).map(p => [p[0].trim(), Math.min(p[1], d.c.length - 1)]);
            if (d.i.length < 2) {
              EB.toast('اكتب عنصرين على الأقل');
              return;
            }
          }
          if (kind === 'match') {
            d.pairs = d.pairs.filter(p => p[0].trim() && p[1].trim());
            if (d.pairs.length < 2) {
              EB.toast('اكتب زوجين على الأقل');
              return;
            }
          }
          if (
            (kind === 'mcq' ||
              kind === 'tf' ||
              kind === 'flip' ||
              kind === 'order' ||
              kind === 'match' ||
              kind === 'blank' ||
              kind === 'cls' ||
              kind === 'hukm' ||
              kind === 'reveal') &&
            !String(d.q).trim() &&
            kind !== 'match'
          ) {
            EB.toast(kind === 'blank' ? 'اكتب الجملة أولاً' : 'اكتب السؤال أولاً');
            return;
          }
          if (kind === 'blank') {
            const nw = String(d.q).trim().split(/\s+/).length;
            d.hw = (d.hw || []).filter(i => i < nw);
            if (!d.hw.length) {
              EB.toast('اضغط على كلمة واحدة على الأقل لإخفائها');
              return;
            }
          }
          EB.closeSheet();
          if (it) {
            it.d = d;
            it.st = {};
            W.render(it);
            EB.commit();
            return;
          }
          if (newPage) EB.addPage(EB.newPage({ title: NAMES[kind], grid: 'dots' }));
          const w = W.make(kind, d);
          if (newPage) {
            const c = EB.vc();
            w.x = c.x - w.w / 2;
            w.y = c.y - 170;
          }
          EB.page().items.push(w);
          EB.mountWidgets();
          S.sel = [w];
          EB.setTool('select');
          EB.showAct();
          EB.commit();
          S.dirty = 1;
          if (newPage || w.w * S.V.k > innerWidth - 16) EB.fit();
          return;
        }
        grab();
        if (x.ok !== undefined) {
          const i = +x.ok,
            p = d.a.indexOf(i);
          p >= 0 ? d.a.length > 1 && d.a.splice(p, 1) : d.a.push(i);
        } else if (x.tf !== undefined) d.a = x.tf === '1';
        else if (x.hk !== undefined) d.a = +x.hk;
        else if (x.up !== undefined && kind === 'timer') d.up = x.up === '1';
        else if (x.hw !== undefined) {
          const i = +x.hw,
            p = d.hw.indexOf(i);
          p >= 0 ? d.hw.splice(p, 1) : d.hw.push(i);
        } else if (x.rw !== undefined) {
          const nw = String(d.q).trim() ? String(d.q).trim().split(/\s+/).length : 0;
          d.hw = d.hw.filter(i => i < nw);
        } else if (x.ly !== undefined) d.ly = x.ly;
        else if (x.sk !== undefined) d.sk = x.sk;
        else if (x.gr !== undefined) d.gr = x.gr === '1';
        else if (x.fz !== undefined) d.fz = x.fz;
        else if (x.pre !== undefined) d.sec = +x.pre;
        else if (x.df !== undefined) d.df = x.df;
        else if (x.wo !== undefined) d.wo = !d.wo;
        else if (x.th === 'custom') {
          EB.Colors.pick(
            d.tc || '#1b57d6',
            c => {
              d.th = 'custom';
              d.tc = c;
              render();
            },
            { title: 'لون هوية السؤال' }
          );
          return;
        } else if (x.th !== undefined) d.th = x.th;
        else if (x.ct !== undefined) {
          const p = d.i[+x.ct];
          p[1] = (p[1] + 1) % d.c.length;
        } else if (x.addc !== undefined) d.c.push('');
        else if (x.rmc !== undefined) {
          const k = +x.rmc;
          d.c.splice(k, 1);
          d.i.forEach(p => {
            if (p[1] === k) p[1] = 0;
            else if (p[1] > k) p[1]--;
          });
        } else if (x.add !== undefined) {
          kind === 'match' ? d.pairs.push(['', '']) : kind === 'cls' ? d.i.push(['', 0]) : d.o.push('');
        } else if (x.rm !== undefined) {
          const i = +x.rm;
          if (kind === 'match') d.pairs.splice(i, 1);
          else if (kind === 'cls') d.i.splice(i, 1);
          else {
            d.o.splice(i, 1);
            if (kind === 'mcq') d.a = d.a.filter(a => a !== i).map(a => (a > i ? a - 1 : a));
            if (kind === 'mcq' && !d.a.length) d.a = [0];
          }
        } else return;
        render();
      }
    );
    render();
  };
})();
