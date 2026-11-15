(function () {
  'use strict';
  const EB = window.EB,
    S = EB.S,
    $ = EB.$,
    ar = EB.ar,
    esc = EB.esc;
  const O = { q: 720, mic: true, cur: 'natural', cam: 'view', zoom: 1, logo: true, cd: 3 };
  try {
    Object.assign(O, JSON.parse(localStorage.getItem('rs_edu_rec') || '{}'));
    O.cam = O.camv2 === 'follow' ? 'follow' : 'view';
    O.zoom = 1;
  } catch (e) {}
  let R = null,
    last = { x: 0, y: 0, down: false, t: 0, tool: '' };
  const cvEl = $('cv');
  ['pointermove', 'pointerdown'].forEach(ev =>
    cvEl.addEventListener(
      ev,
      e => {
        const p = EB.toW(e.clientX, e.clientY);
        last = { x: p.x, y: p.y, down: e.buttons > 0 || ev === 'pointerdown', t: performance.now(), tool: S.tool };
      },
      true
    )
  );
  cvEl.addEventListener(
    'pointerup',
    () => {
      last.down = false;
      last.t = performance.now();
    },
    true
  );

  let cssCache = null;
  async function buildCss() {
    if (cssCache) return cssCache;
    const txt = async u => (await fetch(u)).text(),
      b64 = async u => {
        const b = await (await fetch(u)).arrayBuffer();
        let s = '',
          a = new Uint8Array(b);
        for (let i = 0; i < a.length; i += 8192) s += String.fromCharCode.apply(null, a.subarray(i, i + 8192));
        return btoa(s);
      };
    let css = await txt('board.css');
    const rf = getComputedStyle(document.documentElement).getPropertyValue('--bf') || '',
      fam = new Set(['Noto Naskh Arabic', 'Scheherazade New']);
    (rf.match(/'([^']+)'|"([^"]+)"/g) || []).forEach(f => fam.add(f.replace(/['"]/g, '')));
    let fonts = '';
    try {
      const ft = await txt('../vendor/fonts.css');
      const faces = ft.match(/@font-face\s*\{[^}]*\}/g) || [];
      for (const f of faces) {
        const m = /font-family:\s*'([^']+)'/.exec(f),
          u = /url\('([^']+)'\)/.exec(f),
          w = /font-weight:\s*(\d+)/.exec(f);
        if (!m || !u || !fam.has(m[1]) || !/arabic/.test(u[1]) || !['400', '700'].includes(w && w[1])) continue;
        try {
          fonts +=
            f
              .replace(u[0], `url(data:font/woff2;base64,${await b64('../vendor/' + u[1])})`)
              .replace(/unicode-range:[^;]+;/, '') + '\n';
        } catch (e) {}
      }
    } catch (e) {}
    const vars = [...new Set(css.match(/--[\w-]+/g) || [])],
      cs = getComputedStyle(document.documentElement);
    const vs = vars.map(v => `${v}:${cs.getPropertyValue(v)}`).join(';');
    cssCache = {
      css:
        css.replace(/@import[^;]+;/g, '') +
        fonts +
        '.wid,.sheet{position:relative!important;left:0!important;top:0!important;transform:none!important;margin:0!important}.ti,.rs{display:none!important}',
      vs
    };
    return cssCache;
  }
  const RS = 1.5;
  async function raster(el) {
    const { css, vs } = await buildCss(),
      w = el.offsetWidth,
      h = el.offsetHeight;
    if (!w || !h) return null;
    const xml = new XMLSerializer().serializeToString(el.cloneNode(true));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(w * RS)}" height="${Math.round(h * RS)}" viewBox="0 0 ${w} ${h}"><foreignObject width="${w}" height="${h}"><div xmlns="http://www.w3.org/1999/xhtml" dir="rtl" style="${vs.replace(/"/g, '&quot;')};width:${w}px;height:${h}px"><style><![CDATA[${css}]]></style>${xml}</div></foreignObject></svg>`;
    return await new Promise(res => {
      const im = new Image();
      im.onload = () => res({ im, w, h });
      im.onerror = () => res(null);
      im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
  }
  const hash = s => {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return h;
  };
  const cache = new WeakMap();
  let busy = false;
  async function refreshDom() {
    if (busy) return;
    busy = true;
    try {
      const els = [...$('stage').querySelectorAll('.sheet,.wid')];
      for (const el of els) {
        const key = hash(el.outerHTML) + ':' + el.offsetWidth + ':' + el.offsetHeight,
          c = cache.get(el);
        if (c && c.key === key) continue;
        const r = await raster(el);
        if (r) cache.set(el, Object.assign(r, { key }));
      }
    } catch (e) {}
    busy = false;
  }

  const logo = new Image();
  logo.src = '../icons/icon-192.png';
  function paper(c, W, H, s, cx, cy) {
    const pg = EB.page();
    c.fillStyle = pg.paper;
    c.fillRect(0, 0, W, H);
    if (!pg.grid || pg.grid === 'none') return;
    const dk = EB.isDark ? EB.isDark(pg.paper) : false,
      col = dk ? 'rgba(255,255,255,.13)' : 'rgba(40,30,15,.17)',
      strong = dk ? 'rgba(255,255,255,.26)' : 'rgba(40,30,15,.32)',
      gs = pg.gs || 28;
    let gw = gs;
    while (gw * s < gs / 2) gw *= 2;
    while (gw * s > gs * 2) gw /= 2;
    const g = gw * s;
    const ox = (W / 2 - cx * s) % g,
      oy = (H / 2 - cy * s) % g;
    c.fillStyle = col;
    c.strokeStyle = col;
    c.lineWidth = 1;
    const grid = (st, step, lw) => {
      c.strokeStyle = st;
      c.lineWidth = lw;
      c.beginPath();
      const sx = (W / 2 - cx * s) % step,
        sy = (H / 2 - cy * s) % step;
      for (let x = sx; x < W; x += step) {
        c.moveTo(x, 0);
        c.lineTo(x, H);
      }
      for (let y = sy; y < H; y += step) {
        c.moveTo(0, y);
        c.lineTo(W, y);
      }
      c.stroke();
    };
    if (pg.grid === 'dots') {
      for (let x = ox; x < W; x += g)
        for (let y = oy; y < H; y += g) {
          c.beginPath();
          c.arc(x, y, 1.6 * Math.max(1, W / 900), 0, 7);
          c.fill();
        }
    } else if (pg.grid === 'grid') grid(col, g, 1);
    else if (pg.grid === 'graph') {
      grid(col, g, 1);
      grid(strong, g * 5, 1.4);
    } else if (pg.grid === 'lines' || pg.grid === 'note') {
      c.beginPath();
      const sy = (H / 2 - cy * s) % (g * 1.6);
      for (let y = sy; y < H; y += g * 1.6) {
        c.moveTo(0, y);
        c.lineTo(W, y);
      }
      c.stroke();
      if (pg.grid === 'note') {
        c.strokeStyle = dk ? 'rgba(255,120,120,.55)' : 'rgba(210,60,60,.55)';
        c.lineWidth = 2;
        const mx = W / 2 + (90 - cx) * s;
        c.beginPath();
        c.moveTo(mx, 0);
        c.lineTo(mx, H);
        c.stroke();
      }
    }
  }
  function cursor(c, x, y, st, down, k) {
    c.save();
    c.translate(x, y);
    const u = k;
    if (st === 'finger') {
      c.globalAlpha = down ? 0.55 : 0.3;
      c.fillStyle = '#c0502a';
      c.beginPath();
      c.arc(0, 0, 22 * u, 0, 7);
      c.fill();
      c.globalAlpha = 0.9;
      c.lineWidth = 3 * u;
      c.strokeStyle = '#fff';
      c.stroke();
    } else if (st === 'pen' || st === 'marker') {
      c.rotate(0.75);
      c.shadowColor = 'rgba(0,0,0,.3)';
      c.shadowBlur = 8 * u;
      c.shadowOffsetY = 4 * u;
      const L = 150 * u,
        w = 15 * u;
      c.fillStyle = st === 'marker' ? '#e0a400' : '#2a2f3a';
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(-w * 0.55, -26 * u);
      c.lineTo(-w, -L);
      c.lineTo(w, -L);
      c.lineTo(w * 0.55, -26 * u);
      c.closePath();
      c.fill();
      c.shadowColor = 'transparent';
      c.fillStyle = st === 'marker' ? '#fff3c4' : '#c0502a';
      c.fillRect(-w, -L, 2 * w, 18 * u);
      c.fillStyle = 'rgba(255,255,255,.35)';
      c.fillRect(-w * 0.35, -L + 22 * u, w * 0.3, L - 70 * u);
      c.fillStyle = st === 'marker' ? '#e0a400' : '#111';
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(-w * 0.22, -12 * u);
      c.lineTo(w * 0.22, -12 * u);
      c.fill();
    } else if (st === 'feather') {
      c.rotate(0.62);
      c.shadowColor = 'rgba(0,0,0,.28)';
      c.shadowBlur = 8 * u;
      c.shadowOffsetY = 4 * u;
      const L = 210 * u;
      const g = c.createLinearGradient(0, 0, 0, -L);
      g.addColorStop(0, '#f4ecd8');
      g.addColorStop(1, '#fffaf0');
      c.fillStyle = g;
      c.strokeStyle = '#a98f5a';
      c.lineWidth = 2 * u;
      c.beginPath();
      c.moveTo(0, 0);
      c.bezierCurveTo(-8 * u, -40 * u, -52 * u, -L * 0.45, -34 * u, -L * 0.8);
      c.bezierCurveTo(-26 * u, -L * 0.98, 6 * u, -L * 1.02, 22 * u, -L * 0.86);
      c.bezierCurveTo(60 * u, -L * 0.5, 30 * u, -50 * u, 0, 0);
      c.fill();
      c.stroke();
      c.shadowColor = 'transparent';
      c.strokeStyle = '#8a6d3b';
      c.lineWidth = 3 * u;
      c.beginPath();
      c.moveTo(0, 0);
      c.quadraticCurveTo(-4 * u, -L * 0.5, 2 * u, -L * 0.95);
      c.stroke();
      c.lineWidth = 1.2 * u;
      c.strokeStyle = 'rgba(138,109,59,.5)';
      for (let i = 1; i < 9; i++) {
        const y = -L * 0.1 * i - 10 * u;
        c.beginPath();
        c.moveTo(0, y);
        c.lineTo(-22 * u + i * u, y - 22 * u);
        c.moveTo(0, y);
        c.lineTo(20 * u - i * u, y - 22 * u);
        c.stroke();
      }
    }
    c.restore();
  }
  function frame(now) {
    const c = R.c,
      W = R.W,
      H = R.H,
      pg = EB.page();
    if (!pg) return;
    if (R.pi !== S.pi) {
      R.pi = S.pi;
      const v = EB.vc();
      R.cx = v.x;
      R.cy = v.y;
    }
    const vw = innerWidth / S.V.k,
      dt = Math.min(0.1, (now - R.t0) / 1000);
    R.t0 = now;
    let s = W / (vw * O.zoom);
    if (O.cam === 'fit') {
      const b = EB.contentBox();
      if (b) {
        const sf = Math.min(W / (b.w * 1.1), H / (b.h * 1.1));
        s = Math.min(sf, (W / vw) * 1.2);
        R.tcx = b.x + b.w / 2;
        R.tcy = b.y + b.h / 2;
      }
    } else if (O.cam === 'view') {
      R.cx = (innerWidth / 2 - S.V.x) / S.V.k;
      R.cy = (innerHeight / 2 - S.V.y) / S.V.k;
      R.tcx = null;
      s = (W / innerWidth) * S.V.k;
    } else {
      const active = last.down || now - last.t < 2200;
      if (active) {
        const hw = W / s / 2,
          hh = H / s / 2,
          dz = 0.28;
        let dx = last.x - R.cx,
          dy = last.y - R.cy;
        const mx = hw * dz,
          my = hh * dz;
        R.tcx = R.cx + (Math.abs(dx) > mx ? dx - Math.sign(dx) * mx * 0.6 : 0);
        R.tcy = R.cy + (Math.abs(dy) > my ? dy - Math.sign(dy) * my * 0.6 : 0);
      }
    }
    if (R.tcx != null) {
      const f = 1 - Math.exp(-dt * (O.cam === 'view' ? 14 : 3.2));
      R.cx += (R.tcx - R.cx) * f;
      R.cy += (R.tcy - R.cy) * f;
    }
    R.s = s;
    paper(c, W, H, s, R.cx, R.cy);
    c.save();
    c.translate(W / 2 - R.cx * s, H / 2 - R.cy * s);
    c.scale(s, s);
    {
      const sh = $('world').querySelector('.sheet'),
        r = sh && cache.get(sh);
      if (r) c.drawImage(r.im, 0, 0, r.w, r.h);
    }
    EB.renderTo(c, now, it => {
      const r = it._el && cache.get(it._el);
      if (r) {
        const sc = it.sc || 1;
        c.drawImage(r.im, it.x, it.y, r.w * sc, r.h * sc);
      }
    });
    if (S.laser) EB.drawLaser(c, now, s);
    c.restore();
    const show = O.cur !== 'none' && O.cur !== 'natural' && (last.down || now - last.t < 1400);
    if (show) {
      const px = W / 2 + (last.x - R.cx) * s,
        py = H / 2 + (last.y - R.cy) * s;
      if (px > -50 && px < W + 50 && py > -50 && py < H + 50)
        cursor(c, px, py, O.cur, last.down, Math.max(0.5, W / 1280));
    }
    if (logo.complete && logo.naturalWidth) {
      const u = W / 1280,
        h = 38 * u,
        pad = 18 * u,
        tx = 'مشكاة الفقه',
        bh = h + 10 * u;
      c.save();
      c.font = `700 ${20 * u}px "Noto Naskh Arabic",serif`;
      const tw = c.measureText(tx).width,
        w = h + tw + 30 * u,
        x0 = pad,
        y0 = H - pad - bh;
      c.shadowColor = 'rgba(0,0,0,.16)';
      c.shadowBlur = 10 * u;
      c.fillStyle = 'rgba(255,252,246,.88)';
      c.beginPath();
      c.roundRect ? c.roundRect(x0, y0, w, bh, bh / 2) : c.rect(x0, y0, w, bh);
      c.fill();
      c.shadowColor = 'transparent';
      c.strokeStyle = 'rgba(120,80,40,.22)';
      c.lineWidth = 1.2 * u;
      c.stroke();
      c.drawImage(logo, x0 + w - h - 6 * u, y0 + 5 * u, h, h);
      c.fillStyle = '#4a3320';
      c.textAlign = 'right';
      c.textBaseline = 'middle';
      c.direction = 'rtl';
      c.fillText(tx, x0 + w - h - 14 * u, y0 + bh / 2 + 1);
      c.restore();
    }
  }
  EB.recOverlay = function (c) {
    if (true) return;
    const k = S.V.k,
      w = R.W / R.s,
      h = R.H / R.s;
    c.save();
    c.setLineDash([14 / k, 10 / k]);
    c.lineWidth = 3 / k;
    c.strokeStyle = '#e5484d';
    c.strokeRect(R.cx - w / 2, R.cy - h / 2, w, h);
    c.restore();
    S.dirty = 1;
  };

  const SZ = { '16:9': [16, 9], '9:16': [9, 16], '1:1': [1, 1] };
  EB.sessionStart = function () {
    const old = $('sessPop');
    if (old) {
      closeSess();
      return;
    }
    let ses = true,
      rec = false;
    const btn = $('sessBtn'),
      r = btn.getBoundingClientRect();
    const el = document.createElement('div');
    el.id = 'sessPop';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'بدء الجلسة');
    const card = (k, ic, t, sm, on) =>
      `<button class="sp-o${on ? ' on' : ''}" data-k="${k}" role="switch" aria-checked="${on}"><span class="sp-i"><i class="ti ${ic}"></i></span><span class="kt"><b>${t}</b><small>${sm}</small></span><span class="sp-c"><i class="ti ti-check"></i></span></button>`;
    const go = () =>
      `<button class="sp-go" data-go><i class="ti ${rec ? 'ti-player-record' : 'ti-player-play'}"></i>${rec ? (ses ? 'ابدأ الجلسة والتسجيل' : 'متابعة إلى التسجيل') : ses ? 'ابدأ الجلسة' : 'اختر خياراً أولاً'}</button>`;
    el.innerHTML = `<i class="sp-arrow"></i><div class="sp-h"><span>بدء الجلسة</span><button class="sp-x" data-x aria-label="إغلاق"><i class="ti ti-x"></i></button></div>${card('ses', 'ti-presentation', 'جلسة شرح', 'تُعلَّم كتابتك ويمكن حذفها دفعة واحدة', true)}${card('rec', 'ti-video', 'تسجيل فيديو', 'يحفظ شرحك بصوتك وكتابتك', false)}<div class="sp-f">${go()}</div>`;
    document.body.appendChild(el);
    const w = el.offsetWidth,
      cx = r.left + r.width / 2,
      left = Math.max(10, Math.min(innerWidth - w - 10, cx - w / 2));
    el.style.left = left + 'px';
    el.style.top = r.bottom + 12 + 'px';
    el.style.setProperty('--ax', cx - left + 'px');
    requestAnimationFrame(() => el.classList.add('s'));
    function closeSess() {
      el.classList.remove('s');
      setTimeout(() => el.remove(), 200);
      document.removeEventListener('pointerdown', away, true);
    }
    const away = e => {
      if (!el.contains(e.target) && !btn.contains(e.target)) closeSess();
    };
    setTimeout(() => document.addEventListener('pointerdown', away, true), 50);
    el.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.x !== undefined) {
        closeSess();
        return;
      }
      if (b.dataset.k) {
        const on = b.getAttribute('aria-checked') !== 'true';
        b.setAttribute('aria-checked', on);
        b.classList.toggle('on', on);
        if (b.dataset.k === 'ses') ses = on;
        else rec = on;
        el.querySelector('.sp-f').innerHTML = go();
        return;
      }
      if (b.dataset.go !== undefined) {
        if (!ses && !rec) {
          el.classList.add('shake');
          setTimeout(() => el.classList.remove('shake'), 400);
          return;
        }
        closeSess();
        if (ses && !S.sess) EB.beginSession();
        if (rec) setTimeout(EB.recordSheet, 260);
      }
    });
  };
  EB.recordSheet = function () {
    if (R) return;
    const chip = (g, v, t) =>
      `<button data-o="${g}:${v}" class="${String(O[g]) === String(v) ? 'on' : ''}">${t}</button>`;
    const seg = (g, arr) => `<div class="kseg">${arr.map(x => chip(g, x[0], x[1])).join('')}</div>`;
    const h = `<div class="kcard rec" style="margin-bottom:12px"><i class="ti ti-video"></i><span class="kt"><b>يُسجَّل ما تراه على السبورة</b><small>بنفس اتجاه شاشتك، دون أي أزرار أو أدوات، وبصوتك إن فعّلت المايك. يظهر شعار «مشكاة الفقه» في زاوية الفيديو.</small></span></div>
    <div class="kg-t">الصوت</div><div class="kg"><button class="kr sw" data-t="mic" role="switch" aria-checked="${!!O.mic}"><i class="ti ti-microphone"></i><span class="kt">تسجيل صوتي<small>سيطلب المتصفح إذن المايك</small></span><span class="ksw${O.mic ? ' on' : ''}"></span></button></div>
    <div class="kg-t">حركة الشاشة</div><div class="kg"><button class="kr sw" data-t="follow" role="switch" aria-checked="${O.cam === 'follow'}"><i class="ti ti-zoom-pan"></i><span class="kt">تقريب تلقائي يتبع قلمك<small>تقترب الكاميرا من مكان الكتابة وحدها</small></span><span class="ksw${O.cam === 'follow' ? ' on' : ''}"></span></button></div>
    <div class="kg-t">شكل القلم في الفيديو</div>${seg('cur', [
      ['natural', 'بدون'],
      ['pen', 'قلم'],
      ['feather', 'ريشة'],
      ['marker', 'ماركر'],
      ['finger', 'إصبع']
    ])}
    <div class="kg-t">جودة الفيديو</div>${seg('q', [
      [480, 'خفيفة'],
      [720, 'عالية'],
      [1080, 'ممتازة']
    ])}`;
    EB.sheet(
      'تسجيل فيديو للشرح',
      h,
      '<button data-x>إلغاء</button><button class="pri" data-go><i class="ti ti-player-record"></i> ابدأ التسجيل</button>',
      e => {
        const b = e.target.closest('button');
        if (!b) return;
        const d = b.dataset;
        if (d.o) {
          const [g, v] = d.o.split(':');
          O[g] = isNaN(+v) ? v : +v;
          save();
          b.parentElement.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
        } else if (d.t === 'follow') {
          O.cam = O.cam === 'follow' ? 'view' : 'follow';
          save();
          b.setAttribute('aria-checked', O.cam === 'follow');
          b.querySelector('.ksw').classList.toggle('on', O.cam === 'follow');
        } else if (d.t) {
          O[d.t] = !O[d.t];
          save();
          b.setAttribute('aria-checked', O[d.t]);
          b.querySelector('.ksw').classList.toggle('on', O[d.t]);
        } else if (d.x !== undefined) EB.closeSheet();
        else if (d.go !== undefined) {
          EB.closeSheet();
          start();
        }
      }
    );
  };
  const save = () => {
    O.camv2 = O.cam;
    try {
      localStorage.setItem('rs_edu_rec', JSON.stringify(O));
    } catch (e) {}
  };
  function bar() {
    let el = $('recBar');
    if (!el) {
      el = document.createElement('div');
      el.id = 'recBar';
      document.body.appendChild(el);
      el.onclick = e => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.k === 'p') pause();
        if (b.dataset.k === 's') stop();
      };
    }
    return el;
  }
  async function start() {
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) {
      EB.toast('متصفحك لا يدعم تسجيل الفيديو');
      return;
    }
    const land = innerWidth >= innerHeight,
      m = O.q,
      ratio = land ? innerWidth / innerHeight : innerHeight / innerWidth,
      W = land ? Math.round((m * ratio) / 2) * 2 : Math.round(m / 2) * 2,
      H = land ? Math.round(m / 2) * 2 : Math.round((m * ratio) / 2) * 2;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    EB.toast('جارٍ تجهيز التسجيل…', 12000);
    await buildCss();
    await refreshDom();
    let taint = false;
    try {
      const p = document.createElement('canvas').getContext('2d');
      const k = [...$('stage').querySelectorAll('.sheet,.wid')].map(el => cache.get(el)).find(Boolean);
      if (k) {
        p.drawImage(k.im, 0, 0);
        p.getImageData(0, 0, 1, 1);
      }
    } catch (e) {
      taint = true;
    }
    if (taint) EB.toast('هذا المتصفح لا يسمح بتصوير نصوص الكتب داخل الفيديو؛ سيُسجَّل الحبر والأشكال فقط', 4500);
    let mic = null;
    if (O.mic) {
      try {
        mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      } catch (e) {
        EB.toast('تعذّر الوصول للميكروفون؛ سيُسجَّل الفيديو بلا صوت', 3500);
      }
    }
    const stream = c.captureStream(30);
    if (mic) mic.getAudioTracks().forEach(t => stream.addTrack(t));
    const types = [
        'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
        'video/mp4',
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm'
      ],
      mime = types.find(t => MediaRecorder.isTypeSupported(t)) || '';
    const rec = new MediaRecorder(
      stream,
      Object.assign(mime ? { mimeType: mime } : {}, { videoBitsPerSecond: m >= 1080 ? 8e6 : m >= 720 ? 4.5e6 : 2e6 })
    );
    const chunks = [];
    rec.ondataavailable = e => {
      if (e.data && e.data.size) chunks.push(e.data);
    };
    const v = EB.vc();
    R = {
      c: g,
      W,
      H,
      rec,
      stream,
      mic,
      chunks,
      mime: rec.mimeType || mime || 'video/webm',
      cx: v.x,
      cy: v.y,
      tcx: null,
      tcy: null,
      t0: performance.now(),
      pi: S.pi,
      s: 1,
      el: 0,
      pausedAt: 0,
      paused: false
    };
    for (let n = O.cd; n > 0; n--) {
      EB.toast(
        String(n).replace(/\d/, d => '٠١٢٣٤٥٦٧٨٩'[d]),
        1000
      );
      await new Promise(r => setTimeout(r, 1000));
    }
    rec.start(500);
    R.t0 = performance.now();
    R.t00 = Date.now();
    R.timer = setInterval(() => {
      if (!R.paused) R.el = (Date.now() - R.t00 - R.pausedTot) / 1000;
      draw();
    }, 500);
    R.pausedTot = 0;
    const loop = now => {
      if (!R) return;
      if (!R.paused) frame(now);
      R.raf = requestAnimationFrame(loop);
    };
    R.raf = requestAnimationFrame(loop);
    R.dom = setInterval(refreshDom, 350);
    draw();
    document.body.classList.add('recording');
    S.dirty = 1;
    EB.toast('بدأ التسجيل');
  }
  const mm = s => ar(String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(Math.floor(s % 60)).padStart(2, '0'));
  function draw() {
    if (!R) {
      const b = $('recBar');
      if (b) b.remove();
      return;
    }
    bar().innerHTML = `<i class="rd${R.paused ? ' ps' : ''}"></i><b>${mm(R.el)}</b><button data-k="p" aria-label="إيقاف مؤقت"><i class="ti ti-player-${R.paused ? 'play' : 'pause'}"></i></button><button data-k="s" class="st" aria-label="إنهاء"><i class="ti ti-player-stop"></i> إنهاء</button>`;
  }
  function pause() {
    if (!R) return;
    if (R.paused) {
      R.rec.resume();
      R.pausedTot += Date.now() - R.pausedAt;
      R.paused = false;
    } else {
      R.rec.pause();
      R.pausedAt = Date.now();
      R.paused = true;
    }
    draw();
  }
  function stop() {
    if (!R) return;
    const r = R;
    if (r.paused) pause();
    clearInterval(r.timer);
    clearInterval(r.dom);
    cancelAnimationFrame(r.raf);
    r.rec.onstop = () => {
      r.stream.getTracks().forEach(t => t.stop());
      if (r.mic) r.mic.getTracks().forEach(t => t.stop());
      const blob = new Blob(r.chunks, { type: r.mime.split(';')[0] }),
        ext = /mp4/.test(r.mime) ? 'mp4' : 'webm';
      R = null;
      document.body.classList.remove('recording');
      draw();
      S.dirty = 1;
      done(blob, ext);
    };
    r.rec.stop();
  }
  function done(blob, ext) {
    const name =
        'مشكاة-' +
        ((S.lesson && S.lesson.title) || 'شرح')
          .replace(/[\\/:*?"<>|]/g, ' ')
          .trim()
          .slice(0, 40) +
        '-' +
        new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '') +
        '.' +
        ext,
      url = URL.createObjectURL(blob);
    const dl = () => {
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
    };
    dl();
    const sz = (blob.size / 1048576).toFixed(1);
    EB.sheet(
      'انتهى التسجيل',
      `<video src="${url}" controls playsinline style="width:100%;border-radius:14px;background:#000;max-height:52vh"></video><div class="kg" style="margin-top:12px"><div class="kr"><i class="ti ti-circle-check" style="color:var(--accent-text)"></i><span class="kt">حُفظ الفيديو في تنزيلات جهازك<small>${ar(sz)} م.ب</small></span></div></div>`,
      '<button data-s><i class="ti ti-download"></i> حفظ مرة أخرى</button><button class="pri" data-sh><i class="ti ti-share-3"></i> مشاركة</button>',
      e => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.s !== undefined) dl();
        else if (b.dataset.sh !== undefined) {
          try {
            const f = new File([blob], name, { type: blob.type });
            if (navigator.canShare && navigator.canShare({ files: [f] })) navigator.share({ files: [f], title: name });
            else EB.toast('المشاركة غير متاحة هنا؛ استخدم «حفظ»');
          } catch (er) {}
        }
      }
    );
  }
  EB._rec = { raster, buildCss, refreshDom, cache };
  EB.recStop = stop;
  EB.isRecording = () => !!R;
})();
