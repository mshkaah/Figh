(function () {
  'use strict';
  const $ = id => document.getElementById(id),
    PI = Math.PI,
    hyp = Math.hypot;
  const FONT = '"Scheherazade New","Noto Naskh Arabic","Amiri",Tahoma,sans-serif';
  const FONTS = [
    ['', 'خط القراءة'],
    ['Scheherazade New', 'شهرزاد'],
    ['Amiri', 'أميري'],
    ['Noto Naskh Arabic', 'نسخ'],
    ['Alfannan', 'الفنان'],
    ['Tahoma', 'تاهوما']
  ];
  const ar = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
  const esc = s =>
    String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const EB = (window.EB = { $, ar, esc, FONT, FONTS });
  EB.readFont = () => {
    try {
      const v = getComputedStyle(parent.document.documentElement).getPropertyValue('--read-font').trim();
      if (v) return v;
    } catch (e) {}
    return FONT;
  };
  EB.fam = it => (it.ff ? '"' + it.ff + '",' + FONT : EB.readFont());
  const world = $('world'),
    stage = $('stage'),
    cv = $('cv');
  let ctx = cv.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 3);

  const LCV = [],
    WCS = [];
  let SEGS = [];
  const COLORS = ['#17212b', '#C0502A', '#1b57d6', '#0f8a5f', '#e09b00', '#7a3fc2', '#d6336c', '#ffffff'];
  const PAPERS = [
    '#ffffff',
    '#f6f1e7',
    '#fff6cf',
    '#fde4e4',
    '#fde8f1',
    '#f1e6fb',
    '#e6f0fb',
    '#dff5f3',
    '#e8f5ea',
    '#e4e7ea',
    '#2b2733',
    '#1c2733',
    '#1d2b24',
    '#15121a'
  ];
  const isDark = c => {
    const n = parseInt(c.slice(1), 16);
    return (n >> 16) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11 < 110;
  };
  const S = (EB.S = {
    lesson: null,
    pi: 0,
    tool: 'pen',
    color: '#17212b',
    width: 4,
    fade: false,
    snap: true,
    sess: 0,
    showSess: true,
    V: { x: 0, y: 0, k: 1 },
    sel: [],
    imgs: {},
    dirty: 1,
    TOP: 56,
    BOT: 90,
    uid: 1,
    sound: true,
    penSeen: false,
    ink: null
  });
  EB.COLORS = COLORS;
  EB.PAPERS = PAPERS;
  EB.isDark = isDark;
  const nid = () => S.uid++;
  EB.nid = nid;
  try {
    const s = JSON.parse(localStorage.getItem('rs_edu_prefs') || '{}');
    if (s.width) S.width = s.width;
    if (s.snap === false) S.snap = false;
    if (s.sound === false) S.sound = false;
    if (s.color) S.color = s.color;
  } catch (e) {}
  EB.prefs = () => {
    try {
      localStorage.setItem(
        'rs_edu_prefs',
        JSON.stringify({ width: S.width, snap: S.snap, sound: S.sound, color: S.color })
      );
    } catch (e) {}
  };
  EB.page = () => S.lesson.pages[S.pi];
  EB.toast = (t, ms) => {
    const el = $('toast');
    el.style.bottom = S.BOT + 14 + 'px';
    el.textContent = t;
    el.classList.add('s');
    clearTimeout(EB.toast.t);
    EB.toast.t = setTimeout(() => el.classList.remove('s'), ms || 1600);
  };
  EB.dirty = () => {
    S.dirty = 1;
  };

  EB.newPage = function (o) {
    const dk = document.documentElement.dataset.theme === 'dark';
    return Object.assign(
      {
        id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
        type: 'blank',
        title: 'ورقة',
        paper: dk ? '#15121a' : '#ffffff',
        grid: 'dots',
        items: [],
        sheet: null,
        view: null
      },
      o || {}
    );
  };
  EB.inkFor = paper => (isDark(paper || EB.page().paper) ? '#f3ecdd' : '#17212b');

  const rot = (x, y, a) => {
    const c = Math.cos(a),
      s = Math.sin(a);
    return { x: x * c - y * s, y: x * s + y * c };
  };
  const toLocal = (it, p) => rot(p.x - it.cx, p.y - it.cy, -(it.rot || 0));
  const toWorld = (it, l) => {
    const r = rot(l.x, l.y, it.rot || 0);
    return { x: it.cx + r.x, y: it.cy + r.y };
  };
  EB.toLocal = toLocal;
  EB.toWorld = toWorld;
  const kind = it => it.t;
  const isBoxShape = it => it.t === 'shape';
  EB.isBoxShape = isBoxShape;
  function widH(it) {
    return it._el ? it._el.offsetHeight : 120;
  }
  EB.byId = id => EB.page().items.find(i => i.id === id);
  function box(it) {
    switch (it.t) {
      case 'ink': {
        let x0 = 1e18,
          y0 = 1e18,
          x1 = -1e18,
          y1 = -1e18;
        for (const p of it.pts) {
          if (p.x < x0) x0 = p.x;
          if (p.x > x1) x1 = p.x;
          if (p.y < y0) y0 = p.y;
          if (p.y > y1) y1 = p.y;
        }
        const e = (it.w || 4) / 2;
        return { x: x0 - e, y: y0 - e, w: x1 - x0 + 2 * e, h: y1 - y0 + 2 * e };
      }
      case 'shape': {
        const c = corners(it),
          xs = c.map(p => p.x),
          ys = c.map(p => p.y),
          x0 = Math.min(...xs),
          y0 = Math.min(...ys);
        return { x: x0, y: y0, w: Math.max(...xs) - x0, h: Math.max(...ys) - y0 };
      }
      case 'line': {
        const x0 = Math.min(it.x1, it.x2),
          y0 = Math.min(it.y1, it.y2);
        return { x: x0, y: y0, w: Math.abs(it.x2 - it.x1), h: Math.abs(it.y2 - it.y1) };
      }
      case 'wid': {
        const s = it.sc || 1;
        return { x: it.x, y: it.y, w: it.w * s, h: widH(it) * s };
      }
      case 'frame':
        return { x: it.x, y: it.y, w: it.w, h: it.h };
      case 'link': {
        const A = EB.byId(it.a),
          B = EB.byId(it.b);
        if (!A || !B) return { x: 0, y: 0, w: 1, h: 1 };
        const p = EB.linkPts(it);
        return {
          x: Math.min(p[0].x, p[1].x),
          y: Math.min(p[0].y, p[1].y),
          w: Math.abs(p[1].x - p[0].x),
          h: Math.abs(p[1].y - p[0].y)
        };
      }
      case 'text':
        return { x: it.x, y: it.y, w: it.w, h: it.h || 50 };
      case 'node':
        return { x: it.x, y: it.y, w: it.w, h: it.h || 56 };
      default:
        return { x: it.x, y: it.y, w: it.w, h: it.h || it.w };
    }
  }
  function corners(it) {
    const hw = it.w / 2,
      hh = it.h / 2;
    return [
      [-hw, -hh],
      [hw, -hh],
      [hw, hh],
      [-hw, hh]
    ].map(([x, y]) => toWorld(it, { x, y }));
  }
  EB.box = box;
  EB.corners = corners;

  function frame(it) {
    if (it.t === 'shape') return corners(it);
    const b = box(it);
    return [
      { x: b.x, y: b.y },
      { x: b.x + b.w, y: b.y },
      { x: b.x + b.w, y: b.y + b.h },
      { x: b.x, y: b.y + b.h }
    ];
  }
  EB.frame = frame;
  function unionBox(items) {
    let x0 = 1e18,
      y0 = 1e18,
      x1 = -1e18,
      y1 = -1e18;
    items.forEach(it => {
      const b = box(it);
      x0 = Math.min(x0, b.x);
      y0 = Math.min(y0, b.y);
      x1 = Math.max(x1, b.x + b.w);
      y1 = Math.max(y1, b.y + b.h);
    });
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  EB.unionBox = unionBox;

  function outline(it) {
    const hw = it.w / 2,
      hh = it.h / 2;
    if (it.s === 'rect')
      return [
        [-hw, -hh],
        [hw, -hh],
        [hw, hh],
        [-hw, hh],
        [-hw, -hh]
      ].map(([x, y]) => ({ x, y }));
    if (it.s === 'ellipse') {
      const o = [];
      for (let i = 0; i <= 56; i++) {
        const a = (i / 56) * 2 * PI;
        o.push({ x: hw * Math.cos(a), y: hh * Math.sin(a) });
      }
      return o;
    }
    if (it.s === 'semi') {
      const o = [];
      for (let i = 0; i <= 32; i++) {
        const a = PI + (i / 32) * PI;
        o.push({ x: hw * Math.cos(a), y: hh + it.h * Math.sin(a) });
      }
      if (it.closed) o.push(o[0]);
      return o;
    }
    if (it.s === 'poly') {
      const o = it.pts.map(([u, v]) => ({ x: (u - 0.5) * it.w, y: (v - 0.5) * it.h }));
      if (it.closed !== false) o.push(o[0]);
      return o;
    }
    return [];
  }
  function segDist(p, a, b) {
    const dx = b.x - a.x,
      dy = b.y - a.y,
      l2 = dx * dx + dy * dy;
    let t = l2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    return hyp(p.x - a.x - dx * t, p.y - a.y - dy * t);
  }
  function inPoly(p, poly) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i],
        b = poly[j];
      if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
    }
    return c;
  }
  EB.segDist = segDist;
  function hit(it, p, tol) {
    switch (it.t) {
      case 'ink': {
        const r = (it.w || 4) / 2 + tol,
          q = it.pts;
        if (q.length === 1) return hyp(p.x - q[0].x, p.y - q[0].y) < r;
        for (let i = 1; i < q.length; i++) if (segDist(p, q[i - 1], q[i]) < r) return true;
        return false;
      }
      case 'shape': {
        const l = toLocal(it, p),
          o = outline(it);
        const r = (it.lw || 4) / 2 + tol;
        for (let i = 1; i < o.length; i++) if (segDist(l, o[i - 1], o[i]) < r) return true;
        if (it.f || (it.w < 40 && it.h < 40)) return inPoly(l, o);
        return false;
      }
      case 'line':
        return segDist(p, { x: it.x1, y: it.y1 }, { x: it.x2, y: it.y2 }) < (it.lw || 4) / 2 + tol;
      case 'link': {
        const A = EB.byId(it.a),
          B = EB.byId(it.b);
        if (!A || !B) return false;
        const q = EB.linkPts(it);
        return segDist(p, q[0], q[1]) < (it.lw || 4) / 2 + tol + 4;
      }
      case 'frame':
        return p.x >= it.x - tol && p.x <= it.x + it.w + tol && p.y >= it.y - 30 && p.y <= it.y + it.h + tol;
      default: {
        const b = box(it);
        return p.x >= b.x - tol && p.x <= b.x + b.w + tol && p.y >= b.y - tol && p.y <= b.y + b.h + tol;
      }
    }
  }
  EB.hit = hit;
  function eraseHit(it, p, r) {
    if (it.t === 'ink' || it.t === 'line' || it.t === 'shape' || it.t === 'hlr') return hit(it, p, r);
    return false;
  }
  EB.eraseHit = eraseHit;

  function move(it, dx, dy) {
    if (it.t === 'ink')
      it.pts.forEach(p => {
        p.x += dx;
        p.y += dy;
      });
    else if (it.t === 'line') {
      it.x1 += dx;
      it.x2 += dx;
      it.y1 += dy;
      it.y2 += dy;
    } else if (it.t === 'shape') {
      it.cx += dx;
      it.cy += dy;
    } else if (it.t === 'link') {
    } else {
      it.x += dx;
      it.y += dy;
    }
  }
  function scale(it, sx, sy, ox, oy) {
    const X = x => ox + (x - ox) * sx,
      Y = y => oy + (y - oy) * sy;
    if (it.t === 'ink') {
      it.pts.forEach(p => {
        p.x = X(p.x);
        p.y = Y(p.y);
      });
      it.w = Math.max(1, it.w * Math.sqrt(Math.abs(sx * sy)));
    } else if (it.t === 'line') {
      it.x1 = X(it.x1);
      it.x2 = X(it.x2);
      it.y1 = Y(it.y1);
      it.y2 = Y(it.y2);
    } else if (it.t === 'shape') {
      it.cx = X(it.cx);
      it.cy = Y(it.cy);
      const r = it.rot || 0;
      if (Math.abs(Math.sin(r * 2)) < 0.02) {
        if (Math.abs(Math.sin(r)) > 0.5) {
          it.w *= Math.abs(sy);
          it.h *= Math.abs(sx);
        } else {
          it.w *= Math.abs(sx);
          it.h *= Math.abs(sy);
        }
      } else {
        const s = Math.sqrt(Math.abs(sx * sy));
        it.w *= s;
        it.h *= s;
      }
    } else if (it.t === 'link') {
    } else if (it.t === 'wid') {
      const b = box(it),
        s0 = it.sc || 1,
        s1 = Math.max(0.35, Math.min(4, s0 * Math.abs(sx))),
        fe = s1 / s0;
      it.x = ox + (b.x - ox) * fe;
      it.y = oy + (b.y - oy) * fe;
      it.sc = s1;
    } else if (it.t === 'frame') {
      it.x = X(it.x);
      it.y = Y(it.y);
      it.w *= Math.abs(sx);
      it.h *= Math.abs(sy);
    } else if (it.t === 'node') {
      it.x = X(it.x);
      it.y = Y(it.y);
      it.w = Math.max(60, it.w * Math.abs(sx));
      it.fs = Math.max(10, (it.fs || (it.root ? 30 : 24)) * Math.abs(sx));
      if (it.mh) it.mh *= Math.abs(sy);
    } else {
      const b = box(it),
        nx = X(b.x),
        ny = Y(b.y);
      it.x = nx;
      it.y = ny;
      it.w = Math.max(30, b.w * Math.abs(sx));
      if (it.t === 'img' || it.t === 'stk') it.h = it.t === 'stk' ? it.w : (it.h || b.h) * Math.abs(sy);
      if (it.t === 'text') it.fs = (it.fs || 30) * Math.abs(sy);
    }
  }
  EB.move = move;
  EB.scale = scale;
  EB.clone = it => {
    const n = JSON.parse(JSON.stringify(it, (k, v) => (k[0] === '_' ? undefined : v)));
    n.id = nid();
    if (it.t === 'wid') n.st = {};
    return n;
  };

  function wrapText(t, w, font) {
    ctx.font = font;
    const out = [];
    String(t)
      .split('\n')
      .forEach(par => {
        let l = '';
        par.split(/\s+/).forEach(wd => {
          const x = l ? l + ' ' + wd : wd;
          if (l && ctx.measureText(x).width > w) {
            out.push(l);
            l = wd;
          } else l = x;
        });
        out.push(l);
      });
    return out;
  }
  const txtOn = c => (isDark(c) ? '#fff' : '#1a1410');
  EB.txtOn = txtOn;

  const G = window.__GLYPHS || {};
  const STK = {
    check: ['#1f9d63', G.check],
    cross: ['#d03a4e', G.cross],
    star: ['#e09b00', G.star],
    heart: ['#d6336c', G.heart],
    q: ['#1b57d6', G.q],
    ex: ['#e0701a', G.ex],
    bulb: ['#c98a00', G.bulb],
    flag: ['#7a3fc2', G.flag],
    clock: ['#34495e', G.clock],
    book: ['#0f8a5f', G.book],
    target: ['#C0502A', G.target],
    arrow: ['#1b57d6', G.arrow],
    hand: ['#8e5bd4', G.hand],
    trophy: ['#d19a00', G.trophy],
    thumb: ['#1f9d63', G.thumb],
    spark: ['#d68a00', G.spark],
    mark: ['#c23b4f', G.mark],
    pencil: ['#e0701a', G.pencil],
    eye: ['#17898f', G.eye],
    bell: ['#d6336c', G.bell],
    chat: ['#1b57d6', G.chat],
    rocket: ['#7a3fc2', G.rocket],
    flame: ['#e0501a', G.flame],
    smile: ['#d99a00', G.smile],
    scale: ['#4a5fa8', G.scale],
    school: ['#8c2f3b', G.school]
  };
  Object.keys(STK).forEach(k => {
    if (!STK[k][1]) delete STK[k];
  });
  EB.STK = STK;
  const stkPaths = {};
  function drawStk(c, k, x, y, s, col) {
    const d = STK[k] || STK.star;
    c.save();
    c.translate(x, y);
    c.scale(s / 24, s / 24);
    c.shadowColor = 'rgba(0,0,0,.22)';
    c.shadowBlur = 5;
    c.shadowOffsetY = 1.5;
    c.beginPath();
    c.arc(12, 12, 11, 0, 7);
    const g = c.createLinearGradient(0, 0, 0, 24),
      base = col || d[0];
    g.addColorStop(0, shade(base, 12));
    g.addColorStop(1, shade(base, -24));
    c.fillStyle = g;
    c.fill();
    c.shadowColor = 'transparent';
    c.lineWidth = 0.9;
    c.strokeStyle = 'rgba(255,255,255,.35)';
    c.beginPath();
    c.arc(12, 12, 10.2, 0, 7);
    c.stroke();
    const p = stkPaths[k] || (stkPaths[k] = new Path2D(d[1]));
    c.translate(12, 12);
    c.scale(0.66, 0.66);
    c.translate(-12, -12);
    c.shadowColor = 'rgba(0,0,0,.25)';
    c.shadowBlur = 2;
    c.shadowOffsetY = 0.8;
    c.fillStyle = '#fff';
    c.fill(p);
    c.restore();
  }
  function shade(h, a) {
    const n = parseInt(h.slice(1), 16);
    const f = v => Math.max(0, Math.min(255, v + a));
    return '#' + ((1 << 24) + (f(n >> 16) << 16) + (f((n >> 8) & 255) << 8) + f(n & 255)).toString(16).slice(1);
  }
  EB.drawStk = drawStk;

  function pathShape(c, it) {
    const hw = it.w / 2,
      hh = it.h / 2;
    c.beginPath();
    if (it.s === 'rect') {
      const r = Math.min(10, hw, hh);
      if (c.roundRect) c.roundRect(-hw, -hh, it.w, it.h, r);
      else c.rect(-hw, -hh, it.w, it.h);
    } else if (it.s === 'ellipse') c.ellipse(0, 0, hw, hh, 0, 0, 7);
    else if (it.s === 'semi') {
      c.ellipse(0, hh, hw, it.h, 0, PI, 2 * PI);
      if (it.closed) c.closePath();
    } else if (it.s === 'poly') {
      it.pts.forEach(([u, v], i) => {
        const x = (u - 0.5) * it.w,
          y = (v - 0.5) * it.h;
        i ? c.lineTo(x, y) : c.moveTo(x, y);
      });
      if (it.closed !== false) c.closePath();
    }
  }
  function arrowHead(c, x1, y1, x2, y2, lw) {
    const a = Math.atan2(y2 - y1, x2 - x1),
      L = Math.max(16, Math.min(lw * 4.2, 28 + lw * 1.2));
    c.moveTo(x2 - L * Math.cos(a - 0.5), y2 - L * Math.sin(a - 0.5));
    c.lineTo(x2, y2);
    c.lineTo(x2 - L * Math.cos(a + 0.5), y2 - L * Math.sin(a + 0.5));
  }

  function inkPath(c, p, dx, dy) {
    dx = dx || 0;
    dy = dy || 0;
    c.beginPath();
    if (p.length < 3) {
      c.moveTo(p[0].x + dx, p[0].y + dy);
      p.forEach(q => c.lineTo(q.x + dx + 0.01, q.y + dy));
    } else {
      c.moveTo(p[0].x + dx, p[0].y + dy);
      for (let i = 1; i < p.length - 1; i++)
        c.quadraticCurveTo(p[i].x + dx, p[i].y + dy, (p[i].x + p[i + 1].x) / 2 + dx, (p[i].y + p[i + 1].y) / 2 + dy);
      c.lineTo(p[p.length - 1].x + dx, p[p.length - 1].y + dy);
    }
  }

  function sampleCurve(p, step) {
    const out = [{ x: p[0].x, y: p[0].y }];
    if (p.length < 3) {
      p.slice(1).forEach(q => out.push({ x: q.x, y: q.y }));
      return out;
    }
    let a = p[0];
    for (let i = 1; i < p.length - 1; i++) {
      const m = { x: (p[i].x + p[i + 1].x) / 2, y: (p[i].y + p[i + 1].y) / 2 },
        n = Math.max(1, Math.min(8, Math.ceil(hyp(m.x - a.x, m.y - a.y) / step)));
      for (let k = 1; k <= n; k++) {
        const t = k / n,
          u = 1 - t;
        out.push({
          x: u * u * a.x + 2 * u * t * p[i].x + t * t * m.x,
          y: u * u * a.y + 2 * u * t * p[i].y + t * t * m.y
        });
      }
      a = m;
    }
    const l = p[p.length - 1];
    out.push({ x: l.x, y: l.y });
    return out;
  }
  const BRUSHES = {
    ink: 'عادي',
    dash: 'متقطّع',
    wave: 'متموّج',
    dbl: 'خطان',
    arrow: 'سهم',
    line: 'مستقيم',
    glow: 'متوهّج',
    calli: 'عريض'
  };
  EB.BRUSHES = BRUSHES;
  function brushSpeed(c, p, w) {
    const sm = sampleCurve(p, Math.max(1.5, w * 0.5));
    if (sm.length < 3) {
      inkPath(c, p);
      c.stroke();
      return;
    }
    let f = 1;
    const N = sm.length;
    c.lineCap = 'round';
    for (let i = 1; i < N; i++) {
      const d = hyp(sm[i].x - sm[i - 1].x, sm[i].y - sm[i - 1].y) / Math.max(1, w),
        tgt = Math.max(0.45, Math.min(1.55, 1.6 - 0.5 * d * ((p.length / N) * 2.2)));
      f += (tgt - f) * 0.25;
      const tp = Math.min(1, i / 5, (N - i) / 6 + 0.35),
        ww = w * f * (0.55 + 0.45 * Math.max(0, tp));
      c.lineWidth = ww;
      c.beginPath();
      c.moveTo(sm[i - 1].x, sm[i - 1].y);
      c.lineTo(sm[i].x, sm[i].y);
      c.stroke();
    }
  }
  function brushCalli(c, p, w) {
    const sm = sampleCurve(p, Math.max(1.2, w * 0.35)),
      A = -0.82,
      nx = Math.cos(A) * w * 0.5,
      ny = Math.sin(A) * w * 0.5;
    c.beginPath();
    if (sm.length < 2) sm.push({ x: sm[0].x + 0.01, y: sm[0].y });
    for (let i = 1; i < sm.length; i++) {
      const a = sm[i - 1],
        b = sm[i],
        cr = (b.x - a.x) * ny - (b.y - a.y) * nx,
        s = cr < 0 ? -1 : 1;

      if (s > 0) {
        c.moveTo(a.x + nx, a.y + ny);
        c.lineTo(b.x + nx, b.y + ny);
        c.lineTo(b.x - nx, b.y - ny);
        c.lineTo(a.x - nx, a.y - ny);
      } else {
        c.moveTo(a.x - nx, a.y - ny);
        c.lineTo(b.x - nx, b.y - ny);
        c.lineTo(b.x + nx, b.y + ny);
        c.lineTo(a.x + nx, a.y + ny);
      }
      c.closePath();
    }
    c.fill();
  }
  function brushPencil(c, p, w, a0) {
    const base = c.globalAlpha;
    c.globalAlpha = base * 0.62;
    c.lineWidth = w * 0.82;
    inkPath(c, p);
    c.stroke();
    c.globalAlpha = base * 0.5;
    c.lineWidth = w * 0.55;
    c.setLineDash([w * 0.45, w * 0.5]);
    inkPath(c, p, w * 0.14, -w * 0.1);
    c.stroke();
    c.setLineDash([]);
    c.globalAlpha = base * 0.35;
    c.lineWidth = w * 0.3;
    inkPath(c, p, -w * 0.12, w * 0.14);
    c.stroke();
  }
  function drawStroke(it, now) {
    const p = it.pts;
    if (!p.length) return;
    let a = 1;
    if (it.fd && it.ts) {
      const age = now - it.ts,
        T = S.fadeMs || 2500;
      if (age > T) a = 1 - (age - T) / 700;
    }
    ctx.save();
    ctx.globalAlpha = a * (it.hl ? 0.4 : 1);
    ctx.strokeStyle = it.c;
    ctx.fillStyle = it.c;
    ctx.lineWidth = it.w * (it.hl ? 4 : 1);
    ctx.lineCap = it.hl ? 'butt' : 'round';
    ctx.lineJoin = 'round';
    if (it.hl && !isDark(EB.page().paper)) ctx.globalCompositeOperation = 'multiply';
    const br = it.hl ? 'ink' : it.br || 'ink';
    const w = it.w;
    if (br === 'speed' && p.length > 3) brushSpeed(ctx, p, w);
    else if (br === 'calli' && p.length > 1) brushCalli(ctx, p, w);
    else if (br === 'pencil') brushPencil(ctx, p, w);
    else if (br === 'dot') {
      ctx.setLineDash([0.1, w * 2.3]);
      inkPath(ctx, p);
      ctx.stroke();
    } else if (br === 'dash') {
      ctx.setLineDash([w * 3, w * 2.2]);
      inkPath(ctx, p);
      ctx.stroke();
    } else if (br === 'wave' && p.length > 1) {
      const sm = sampleCurve(p, Math.max(2, w * 0.6)),
        A = Math.max(3, w * 0.6),
        L = Math.max(26, w * 6);
      let d = 0;
      ctx.beginPath();
      for (let i = 0; i < sm.length; i++) {
        if (i) d += hyp(sm[i].x - sm[i - 1].x, sm[i].y - sm[i - 1].y);
        const a = sm[Math.max(0, i - 1)],
          b = sm[Math.min(sm.length - 1, i + 1)],
          l = hyp(b.x - a.x, b.y - a.y) || 1,
          o = Math.sin((d / L) * 6.2832) * A,
          x = sm[i].x - ((b.y - a.y) / l) * o,
          y = sm[i].y + ((b.x - a.x) / l) * o;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    } else if (br === 'line' && p.length > 1) {
      const a = p[0],
        b = p[p.length - 1];
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    } else if (br === 'dbl' && p.length > 1) {
      const sm = sampleCurve(p, Math.max(3, w)),
        g = Math.max(2, w * 0.55);
      [-g, g].forEach(o => {
        ctx.beginPath();
        sm.forEach((q, i) => {
          const a = sm[Math.max(0, i - 1)],
            b = sm[Math.min(sm.length - 1, i + 1)],
            l = hyp(b.x - a.x, b.y - a.y) || 1,
            x = q.x - ((b.y - a.y) / l) * o,
            y = q.y + ((b.x - a.x) / l) * o;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        });
        ctx.lineWidth = Math.max(1.2, w * 0.42);
        ctx.stroke();
      });
    } else if (br === 'dd') {
      ctx.setLineDash([w * 3.2, w * 1.7, 0.1, w * 1.7]);
      inkPath(ctx, p);
      ctx.stroke();
    } else if (br === 'zig' && p.length > 1) {
      const sm = sampleCurve(p, Math.max(2, w * 0.6)),
        A = Math.max(4, w * 0.9),
        L = Math.max(22, w * 4.5);
      let d = 0;
      ctx.lineJoin = 'miter';
      ctx.beginPath();
      for (let i = 0; i < sm.length; i++) {
        if (i) d += hyp(sm[i].x - sm[i - 1].x, sm[i].y - sm[i - 1].y);
        const a = sm[Math.max(0, i - 1)],
          b = sm[Math.min(sm.length - 1, i + 1)],
          l = hyp(b.x - a.x, b.y - a.y) || 1,
          ph = d / L,
          o = (Math.abs(ph - Math.floor(ph + 0.5)) * 4 - 1) * A,
          x = sm[i].x - ((b.y - a.y) / l) * o,
          y = sm[i].y + ((b.x - a.x) / l) * o;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    } else if (br === 'marker') {
      ctx.globalAlpha *= 0.5;
      ctx.lineWidth = w * 2.4;
      ctx.lineCap = 'butt';
      if (!isDark(EB.page().paper)) ctx.globalCompositeOperation = 'multiply';
      inkPath(ctx, p);
      ctx.stroke();
    } else if (br === 'glow') {
      ctx.shadowColor = it.c;
      ctx.shadowBlur = w * 1.8;
      ctx.lineWidth = w * 0.8;
      inkPath(ctx, p);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha *= 0.85;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = Math.max(1, w * 0.28);
      inkPath(ctx, p);
      ctx.stroke();
    } else if (br === 'darrow' && p.length > 1) {
      inkPath(ctx, p);
      ctx.stroke();
      const e = p[p.length - 1],
        s = p[0];
      let j = p.length - 2;
      while (j > 0 && hyp(e.x - p[j].x, e.y - p[j].y) < Math.max(8, w * 2)) j--;
      let m = 1;
      while (m < p.length - 1 && hyp(s.x - p[m].x, s.y - p[m].y) < Math.max(8, w * 2)) m++;
      ctx.beginPath();
      arrowHead(ctx, p[j].x, p[j].y, e.x, e.y, w);
      arrowHead(ctx, p[m].x, p[m].y, s.x, s.y, w);
      ctx.stroke();
    } else if (br === 'arrow' && p.length > 1) {
      inkPath(ctx, p);
      ctx.stroke();
      let j = p.length - 2;
      const e = p[p.length - 1];
      while (j > 0 && hyp(e.x - p[j].x, e.y - p[j].y) < Math.max(8, w * 2)) j--;
      ctx.beginPath();
      arrowHead(ctx, p[j].x, p[j].y, e.x, e.y, w);
      ctx.stroke();
    } else {
      inkPath(ctx, p);
      ctx.stroke();
    }
    ctx.restore();
  }

  EB.strokeTo = function (c, it) {
    const keep = ctx;
    ctx = c;
    try {
      drawStroke(it, performance.now());
    } finally {
      ctx = keep;
    }
  };
  const dashOf = it => {
    const w = it.lw || 4,
      k = it.ds != null ? it.ds : it.d ? 1 : 0;
    return k === 1 ? [w * 2.6, w * 2] : k === 2 ? [0.1, w * 2.2] : [];
  };
  EB.dashOf = dashOf;
  function drawItem(it, now) {
    ctx.save();
    ctx.lineCap = ctx.lineJoin = 'round';
    ctx.direction = 'rtl';
    if (it.op != null && it.t !== 'ink') ctx.globalAlpha = it.op;
    switch (it.t) {
      case 'ink':
        ctx.restore();
        return drawStroke(it, now);
      case 'shape':
        ctx.translate(it.cx, it.cy);
        ctx.rotate(it.rot || 0);
        pathShape(ctx, it);
        if (it.f && it.closed !== false) {
          ctx.globalAlpha = 0.18 * (it.op != null ? it.op : 1);
          ctx.fillStyle = it.c;
          ctx.fill();
          ctx.globalAlpha = it.op != null ? it.op : 1;
        }
        ctx.strokeStyle = it.c;
        ctx.lineWidth = it.lw || 4;
        ctx.setLineDash(dashOf(it));
        ctx.stroke();
        break;
      case 'line':
        ctx.strokeStyle = it.c;
        ctx.lineWidth = it.lw || 4;
        ctx.setLineDash(dashOf(it));
        ctx.beginPath();
        ctx.moveTo(it.x1, it.y1);
        ctx.lineTo(it.x2, it.y2);
        if (it.ar) arrowHead(ctx, it.x1, it.y1, it.x2, it.y2, it.lw || 4);
        if (it.ar === 2) arrowHead(ctx, it.x2, it.y2, it.x1, it.y1, it.lw || 4);
        ctx.stroke();
        break;
      case 'text': {
        const f = (it.b ? '700 ' : '500 ') + (it.fs || 30) + 'px ' + EB.fam(it),
          ls = wrapText(it.text, it.w - 16, f),
          lh = (it.fs || 30) * 1.55;
        it.h = ls.length * lh + 14;
        ctx.font = f;
        ctx.fillStyle = it.c;
        ctx.textAlign = 'right';
        ls.forEach((l, i) => ctx.fillText(l, it.x + it.w - 8, it.y + 7 + (i + 0.8) * lh));
        break;
      }
      case 'node': {
        const base = it.fs || (it.root ? 30 : 24),
          f = '700 ' + base + 'px ' + EB.fam(it),
          ls = wrapText(it.text, it.w - 28, f);
        it.h = Math.max(it.mh || 56, ls.length * base * 1.45 + 24);
        const ns = it.ns || 'r';
        ctx.beginPath();
        if (ns === 'o') ctx.ellipse(it.x + it.w / 2, it.y + it.h / 2, it.w / 2, it.h / 2, 0, 0, 7);
        else if (ns === 'p' || it.root)
          ctx.roundRect ? ctx.roundRect(it.x, it.y, it.w, it.h, it.h / 2) : ctx.rect(it.x, it.y, it.w, it.h);
        else if (ns === 's')
          ctx.roundRect ? ctx.roundRect(it.x, it.y, it.w, it.h, 6) : ctx.rect(it.x, it.y, it.w, it.h);
        else ctx.roundRect ? ctx.roundRect(it.x, it.y, it.w, it.h, 18) : ctx.rect(it.x, it.y, it.w, it.h);
        if (ns === 'l') {
          ctx.strokeStyle = it.c;
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(it.x, it.y + it.h);
          ctx.lineTo(it.x + it.w, it.y + it.h);
          ctx.stroke();
          ctx.fillStyle = it.c2 || it.c;
        } else {
          ctx.fillStyle = it.c;
          ctx.shadowColor = 'rgba(0,0,0,.18)';
          ctx.shadowBlur = 8;
          ctx.shadowOffsetY = 2;
          ctx.fill();
          ctx.shadowColor = 'transparent';
          ctx.fillStyle = txtOn(it.c);
        }
        ctx.font = f;
        ctx.textAlign = 'center';
        if (ns === 'l') ctx.fillStyle = EB.inkFor();
        ls.forEach((l, i) =>
          ctx.fillText(l, it.x + it.w / 2, it.y + it.h / 2 + (i - (ls.length - 1) / 2) * base * 1.45 + base * 0.34)
        );
        break;
      }
      case 'frame': {
        const r = 30,
          c2 = it.c;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(it.x, it.y, it.w, it.h, r) : ctx.rect(it.x, it.y, it.w, it.h);
        ctx.globalAlpha = 0.09;
        ctx.fillStyle = c2;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = c2;
        ctx.lineWidth = 4;
        ctx.setLineDash([16, 10]);
        ctx.stroke();
        ctx.setLineDash([]);
        const f = '700 26px ' + EB.fam(it),
          t = it.title || '';
        if (t) {
          ctx.font = f;
          const tw = Math.min(it.w - 60, ctx.measureText(t).width + 44);
          ctx.beginPath();
          ctx.roundRect
            ? ctx.roundRect(it.x + it.w - tw - 24, it.y - 22, tw, 46, 23)
            : ctx.rect(it.x + it.w - tw - 24, it.y - 22, tw, 46);
          ctx.fillStyle = c2;
          ctx.fill();
          ctx.fillStyle = txtOn(c2);
          ctx.textAlign = 'center';
          ctx.fillText(t, it.x + it.w - tw / 2 - 24, it.y + 9, tw - 24);
        }
        break;
      }
      case 'link': {
        const A = EB.byId(it.a),
          B = EB.byId(it.b);
        if (!A || !B) break;
        const q = EB.linkPts(it);
        ctx.strokeStyle = it.c;
        ctx.lineWidth = it.lw || 4;
        ctx.setLineDash(dashOf(it));
        ctx.beginPath();
        ctx.moveTo(q[0].x, q[0].y);
        ctx.lineTo(q[1].x, q[1].y);
        if (it.ar) arrowHead(ctx, q[0].x, q[0].y, q[1].x, q[1].y, it.lw || 4);
        if (it.ar === 2) arrowHead(ctx, q[1].x, q[1].y, q[0].x, q[0].y, it.lw || 4);
        ctx.stroke();
        break;
      }
      case 'stk':
        drawStk(ctx, it.k, it.x, it.y, it.w, it.c);
        break;
      case 'hlr': {
        if (!isDark(EB.page().paper)) ctx.globalCompositeOperation = 'multiply';
        ctx.globalAlpha = 0.42 * (it.op != null ? it.op : 1);
        ctx.fillStyle = it.c;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(it.x, it.y, it.w, it.h, Math.min(8, it.h / 3)) : ctx.rect(it.x, it.y, it.w, it.h);
        ctx.fill();
        break;
      }
      case 'img': {
        const im = EB.img(it.a);
        if (im && im.complete && im.naturalWidth) ctx.drawImage(im, it.x, it.y, it.w, it.h);
        else {
          ctx.fillStyle = 'rgba(128,128,128,.15)';
          ctx.fillRect(it.x, it.y, it.w, it.h);
        }
        break;
      }
    }
    ctx.restore();
  }
  EB.img = function (a) {
    if (S.imgs[a]) return S.imgs[a];
    const d = S.assets && S.assets[a];
    if (!d) {
      EB.loadAsset(a);
      return null;
    }
    const im = new Image();
    im.onload = () => {
      S.dirty = 1;
    };
    im.src = d;
    return (S.imgs[a] = im);
  };
  EB.loadAsset = function (a) {
    if (!S.assets) S.assets = {};
    if (S.assets[a] || (S._ld = S._ld || {})[a]) return;
    S._ld[a] = 1;
    EduStore.getAsset(S.lesson.id, a).then(d => {
      if (d) {
        S.assets[a] = d;
      }
      S.dirty = 1;
      if (EB.page().sheet && EB.page().sheet.img === a) EB.mount(true);
    });
  };
  const vis = it => !it.hs && (S.showSess || !it.sn || it.sn === S.sess);
  EB.vis = vis;

  function drawLinks(items) {
    items.forEach(o => {
      if (o.t !== 'node' || !o.par) return;
      const p = items.find(q => q.id === o.par);
      if (!p) return;
      const ax = p.x + p.w / 2,
        ay = p.y + (p.h || 56) / 2,
        bx = o.x + o.w / 2,
        by = o.y + (o.h || 56) / 2,
        mx = (ax + bx) / 2;
      ctx.save();
      ctx.strokeStyle = o.c;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.bezierCurveTo(mx, ay, mx, by, bx, by);
      ctx.stroke();
      ctx.restore();
    });
  }
  EB.drawLinks = drawLinks;
  function edgePt(it, tx, ty) {
    const b = box(it),
      cx = b.x + b.w / 2,
      cy = b.y + b.h / 2,
      dx = tx - cx,
      dy = ty - cy;
    if (!dx && !dy) return { x: cx, y: cy };
    const k = Math.min((b.w / 2 + 6) / (Math.abs(dx) || 1e-9), (b.h / 2 + 6) / (Math.abs(dy) || 1e-9));
    return { x: cx + dx * k, y: cy + dy * k };
  }
  EB.linkPts = function (l) {
    const A = EB.byId(l.a),
      B = EB.byId(l.b),
      ba = box(A),
      bb = box(B);
    const ac = { x: ba.x + ba.w / 2, y: ba.y + ba.h / 2 },
      bc = { x: bb.x + bb.w / 2, y: bb.y + bb.h / 2 };
    return [edgePt(A, bc.x, bc.y), edgePt(B, ac.x, ac.y)];
  };

  function handles(selFrame, single) {
    return EB.handleList ? EB.handleList() : [];
  }
  const LZ_TT = { trail: 900, neon: 1100, dot: 900, ring: 900 };
  EB.LZ_MAX = 1100;
  EB.drawLaser = function (c, now, k) {
    const all = S.laser || [],
      lst = all[all.length - 1],
      sty = (lst && lst.s) || 'trail',
      TT = LZ_TT[sty] || 900,
      L = all.filter(l => now - l.t < TT);
    if (!L.length) return;
    const h = L[L.length - 1],
      col = h.c || '#ff2d3a',
      R = (h.r || 10) / 10 / k,
      f0 = Math.max(0.25, 1 - (now - h.t) / 900),
      fo = p => Math.max(0, 1 - (now - p.t) / TT);
    c.save();
    c.lineCap = 'round';
    c.lineJoin = 'round';
    const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }),
      far = (a, b) => Math.hypot(b.x - a.x, b.y - a.y) > 400 / k;
    const each = fn => {
      for (let i = 1; i < L.length; i++) {
        const a = L[i - 1],
          b = L[i],
          n = L[i + 1] || b;
        if (far(a, b)) continue;
        const f = fo(b);
        if (f <= 0) continue;
        const m0 = i > 1 ? mid(a, b) : a,
          m1 = n === b ? b : mid(b, n);
        fn(m0, b, m1, f, i);
      }
    };
    const layer = (alpha, width, color, cap) => {
      let key = -1,
        open = false,
        end = null;
      const flush = () => {
        if (open) {
          c.stroke();
          open = false;
        }
      };
      each((m0, p, m1, f) => {
        const q = Math.ceil(f * 40);
        if (q !== key || !end || end.x !== m0.x || end.y !== m0.y) {
          flush();
          key = q;
          const fq = q / 40;
          c.strokeStyle = color;
          c.lineCap = cap || 'round';
          c.globalAlpha = alpha(fq);
          c.lineWidth = width(fq);
          c.beginPath();
          c.moveTo(m0.x, m0.y);
          open = true;
        }
        c.quadraticCurveTo(p.x, p.y, m1.x, m1.y);
        end = m1;
      });
      flush();
    };
    const spot = () => {
      const r = 22 * R,
        g = c.createRadialGradient(h.x, h.y, 0, h.x, h.y, r);
      g.addColorStop(0, '#fff');
      g.addColorStop(0.25, '#fff');
      g.addColorStop(0.5, col);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.globalAlpha = f0;
      c.fillStyle = g;
      c.beginPath();
      c.arc(h.x, h.y, r, 0, 7);
      c.fill();
    };
    if (sty === 'trail') {
      layer(
        f => 0.16 * f,
        f => 24 * R * f + 2 / k,
        col,
        'butt'
      );
      layer(
        f => 0.45 * f,
        f => 10 * R * f + 1 / k,
        col,
        'butt'
      );
      layer(
        f => 1,
        f => 3.2 * R * f + 0.5 / k,
        '#fff'
      );
      spot();
    } else if (sty === 'neon') {
      c.shadowColor = col;
      c.shadowBlur = 14 * R * k;
      layer(
        f => 0.95 * Math.min(1, f * 1.6),
        f => 1.2 / k + 9 * R * f,
        col
      );
      c.shadowBlur = 0;
      layer(
        f => 0.9 * Math.min(1, f * 1.6),
        f => 0.6 / k + 3.2 * R * f,
        '#fff'
      );
      c.shadowColor = col;
      c.shadowBlur = 12 * R * k;
      c.globalAlpha = f0;
      c.fillStyle = '#fff';
      c.beginPath();
      c.arc(h.x, h.y, 5 * R, 0, 7);
      c.fill();
    } else if (sty === 'ring') {
      const p = (now % 900) / 900;
      c.globalAlpha = f0;
      c.strokeStyle = col;
      c.lineWidth = 5 * R;
      c.beginPath();
      c.arc(h.x, h.y, 16 * R, 0, 7);
      c.stroke();
      c.globalAlpha = f0 * (1 - p) * 0.7;
      c.lineWidth = 3 * R;
      c.beginPath();
      c.arc(h.x, h.y, (16 + p * 22) * R, 0, 7);
      c.stroke();
      c.globalAlpha = f0;
      c.fillStyle = '#fff';
      c.beginPath();
      c.arc(h.x, h.y, 3.5 * R, 0, 7);
      c.fill();
    } else spot();
    c.restore();
  };

  EB.renderTo = function (c2, now, drawW) {
    const keep = ctx;
    ctx = c2;
    try {
      const pg = EB.page(),
        items = pg.items.filter(vis);
      drawLinks(items);
      items.forEach(it => {
        if (it.t === 'wid') {
          if (drawW) drawW(it);
          return;
        }
        if (it.fd && it.ts && now - it.ts > (S.fadeMs || 2500) + 700) return;
        drawItem(it, now);
      });
      if (S.cur && S.cur.pts) drawStroke(S.cur, now);
      if (S.shaping) drawItem(S.shaping.shp, now);
    } finally {
      ctx = keep;
    }
  };

  function segsOf(items) {
    const out = [];
    for (const it of items) {
      if (!vis(it)) continue;
      if (it.t === 'wid' && !it._el) continue;
      const k = it.t === 'wid' ? 'w' : 'c',
        l = out[out.length - 1];
      if (l && l.k === k) l.its.push(it);
      else out.push({ k, its: [it] });
    }
    return out;
  }
  EB.segsOf = segsOf;
  const layerCanvas = n => {
    let c = LCV[n];
    if (c) return c;
    c = document.createElement('canvas');
    c.className = 'lc';
    c.width = cv.width;
    c.height = cv.height;
    c._x = c.getContext('2d');
    return (LCV[n] = c);
  };
  const vT = () => `translate(${S.V.x}px,${S.V.y}px) scale(${S.V.k})`;
  const wcont = n => {
    let d = WCS[n];
    if (!d) {
      d = document.createElement('div');
      d.className = 'wc';
      d.style.transform = vT();
      WCS[n] = d;
    }
    return d;
  };
  let layoutSig = '';
  EB.clearLayers = function () {
    WCS.forEach(d => d.remove());
    LCV.forEach(c => c.remove());
    layoutSig = '';
    SEGS = [];
  };

  function layout(force) {
    const pg = EB.page();
    if (!pg) return;
    const segs = segsOf(pg.items),
      wl = $('wl');
    if (!wl) return;
    let ci = 0,
      wi = 0,
      seen = false;
    const nodes = [],
      sig = [];
    segs.forEach((sg, n) => {
      if (sg.k === 'c') {
        seen = true;
        if (n === segs.length - 1) sg.cv = cv;
        else {
          sg.cv = layerCanvas(Math.min(ci++, 7));
          nodes.push(sg.cv);
        }
        sig.push('c');
      } else {
        sg.box = !seen && n === 0 ? wl : wcont(wi++);
        if (sg.box !== wl) nodes.push(sg.box);
        sig.push('w' + sg.its.map(i => i.id).join('.'));
      }
    });
    const key = sig.join('|');
    SEGS = segs;
    if (key === layoutSig && !force) return;
    layoutSig = key;
    WCS.forEach(d => {
      if (!nodes.includes(d)) d.remove();
    });
    LCV.forEach(c => {
      if (!nodes.includes(c)) c.remove();
    });
    segs.forEach(sg => {
      if (sg.k === 'w') sg.its.forEach(it => sg.box.appendChild(it._el));
    });
    nodes.forEach(nd => stage.insertBefore(nd, cv));
  }
  EB.layout = layout;
  function frameRender() {
    const now = performance.now(),
      pg = EB.page();
    if (!pg) {
      requestAnimationFrame(frameRender);
      return;
    }
    if (S.dirty || (S.laser && S.laser.length) || (S.fx && S.fx.length) || pg.items.some(i => i.fd) || S.cur) {
      const cvx = cv.getContext('2d');
      layout();
      const used = [cv];
      SEGS.forEach(sg => {
        if (sg.k === 'c' && !used.includes(sg.cv)) used.push(sg.cv);
      });
      used.forEach(c => {
        const x = c === cv ? cvx : c._x;
        x.setTransform(1, 0, 0, 1, 0, 0);
        x.clearRect(0, 0, c.width, c.height);
        x.setTransform(dpr * S.V.k, 0, 0, dpr * S.V.k, dpr * S.V.x, dpr * S.V.y);
      });
      const items = pg.items;
      let relay = 0,
        first = true;
      SEGS.forEach(sg => {
        if (sg.k !== 'c') return;
        ctx = sg.cv === cv ? cvx : sg.cv._x;
        if (first) {
          drawLinks(items.filter(vis));
          first = false;
        }
        sg.its.forEach(it => {
          if (it.fd && it.ts && now - it.ts > (S.fadeMs || 2500) + 700) {
            const i = items.indexOf(it);
            if (i >= 0) items.splice(i, 1);
            relay = 1;
            return;
          }
          drawItem(it, now);
        });
      });
      ctx = cvx;
      if (first) drawLinks(items.filter(vis));
      if (S.cur && S.cur.pts) drawStroke(S.cur, now);
      if (S.shaping) drawItem(S.shaping.shp, now);
      if (EB.drawOverlay) EB.drawOverlay(ctx, now);
      if (S.laser) {
        S.laser = S.laser.filter(l => now - l.t < EB.LZ_MAX);
        EB.drawLaser(ctx, now, S.V.k);
      }
      S.dirty = 0;
      if (relay) S.dirty = 1;
      if (EB.placeAct) EB.placeAct();
    }
    requestAnimationFrame(frameRender);
  }

  EB.GRIDS = [
    ['dots', 'نقاط'],
    ['grid', 'مربعات'],
    ['lines', 'أسطر'],
    ['graph', 'رسم بياني'],
    ['note', 'دفتر'],
    ['none', 'سادة']
  ];
  EB.gridCss = function (pg, k, vx, vy) {
    const gs = pg.gs || 28,
      dk = isDark(pg.paper),
      col = dk ? 'rgba(255,255,255,.13)' : 'rgba(40,30,15,.17)',
      strong = dk ? 'rgba(255,255,255,.26)' : 'rgba(40,30,15,.32)',
      mar = dk ? 'rgba(255,120,120,.55)' : 'rgba(210,60,60,.55)';
    let g = gs * k;
    while (g < gs / 2) g *= 2;
    while (g > gs * 2) g /= 2;
    const pos = vx + 'px ' + vy + 'px',
      r = { color: pg.paper };
    if (pg.grid === 'dots') {
      r.img = `radial-gradient(circle,${col} 1.5px,transparent 1.8px)`;
      r.size = g + 'px ' + g + 'px';
      r.pos = pos;
      r.rep = 'repeat';
    } else if (pg.grid === 'grid') {
      r.img = `linear-gradient(${col} 1px,transparent 1px),linear-gradient(90deg,${col} 1px,transparent 1px)`;
      r.size = g + 'px ' + g + 'px';
      r.pos = pos;
      r.rep = 'repeat';
    } else if (pg.grid === 'lines') {
      r.img = `linear-gradient(${col} 1.2px,transparent 1.2px)`;
      r.size = '100% ' + g * 1.6 + 'px';
      r.pos = pos;
      r.rep = 'repeat';
    } else if (pg.grid === 'graph') {
      const G = g * 5;
      r.img = `linear-gradient(${strong} 1.4px,transparent 1.4px),linear-gradient(90deg,${strong} 1.4px,transparent 1.4px),linear-gradient(${col} 1px,transparent 1px),linear-gradient(90deg,${col} 1px,transparent 1px)`;
      r.size = `${G}px ${G}px,${G}px ${G}px,${g}px ${g}px,${g}px ${g}px`;
      r.pos = [pos, pos, pos, pos].join(',');
      r.rep = 'repeat';
    } else if (pg.grid === 'note') {
      r.img = `linear-gradient(${mar} 0,${mar} 100%),linear-gradient(${col} 1.2px,transparent 1.2px)`;
      r.size = `2px 100%,100% ${g * 1.6}px`;
      r.pos = `${vx + 90 * k}px 0,${pos}`;
      r.rep = 'no-repeat,repeat';
    } else {
      r.img = 'none';
      r.size = 'auto';
      r.pos = '0 0';
      r.rep = 'repeat';
    }
    return r;
  };
  function bg() {
    const pg = EB.page();
    if (!pg) return;
    const V = S.V,
      c = EB.gridCss(pg, V.k, V.x, V.y);
    stage.style.backgroundColor = c.color;
    stage.style.backgroundImage = c.img;
    stage.style.backgroundSize = c.size;
    stage.style.backgroundPosition = c.pos;
    stage.style.backgroundRepeat = c.rep;
  }
  function applyV() {
    const V = S.V,
      t = `translate(${V.x}px,${V.y}px) scale(${V.k})`;
    world.style.transform = t;
    WCS.forEach(d => {
      d.style.transform = t;
    });
    bg();
    S.dirty = 1;
    const z = $('zPct');
    if (z) z.textContent = ar(Math.round(V.k * 100)) + '٪';
  }
  EB.applyV = applyV;
  EB.go = function (t, instant) {
    cancelAnimationFrame(EB.anim);
    if (instant || matchMedia('(prefers-reduced-motion:reduce)').matches) {
      S.V = Object.assign({}, t);
      applyV();
      return;
    }
    const a = Object.assign({}, S.V),
      t0 = performance.now();
    const st = n => {
      const p = Math.min(1, (n - t0) / 280),
        e = 1 - Math.pow(1 - p, 3);
      S.V = { x: a.x + (t.x - a.x) * e, y: a.y + (t.y - a.y) * e, k: a.k + (t.k - a.k) * e };
      applyV();
      if (p < 1) EB.anim = requestAnimationFrame(st);
    };
    EB.anim = requestAnimationFrame(st);
  };
  EB.zoomAt = function (cx, cy, f) {
    const V = S.V,
      nk = Math.max(0.05, Math.min(16, V.k * f));
    f = nk / V.k;
    V.x = cx - (cx - V.x) * f;
    V.y = cy - (cy - V.y) * f;
    V.k = nk;
    applyV();
  };

  let zt = null,
    zraf = 0;
  EB.zoomStop = function () {
    zt = null;
    cancelAnimationFrame(zraf);
    zraf = 0;
  };
  EB.zoomSmooth = function (cx, cy, f) {
    const base = zt ? zt.k : S.V.k;
    zt = { k: Math.max(0.05, Math.min(16, base * f)), cx, cy };
    if (matchMedia('(prefers-reduced-motion:reduce)').matches) {
      const d = zt.k / S.V.k;
      EB.zoomAt(cx, cy, d);
      zt = null;
      return;
    }
    if (zraf) return;
    cancelAnimationFrame(EB.anim);
    const step = () => {
      zraf = 0;
      if (!zt) return;
      const d = zt.k / S.V.k;
      if (Math.abs(Math.log(d)) < 0.003) {
        EB.zoomAt(zt.cx, zt.cy, d);
        zt = null;
        return;
      }
      EB.zoomAt(zt.cx, zt.cy, Math.pow(d, 0.2));
      zraf = requestAnimationFrame(step);
    };
    zraf = requestAnimationFrame(step);
  };
  EB.toW = (x, y) => ({ x: (x - S.V.x) / S.V.k, y: (y - S.V.y) / S.V.k });
  EB.vc = () => ({ x: (innerWidth / 2 - S.V.x) / S.V.k, y: ((S.TOP + innerHeight - S.BOT) / 2 - S.V.y) / S.V.k });
  EB.contentBox = function () {
    const pg = EB.page(),
      bs = [];
    if (pg.sheet && pg._sw) bs.push({ x: 0, y: 0, w: pg._sw, h: pg._sh });
    pg.items.filter(vis).forEach(i => bs.push(box(i)));
    if (!bs.length) return null;
    let x0 = 1e18,
      y0 = 1e18,
      x1 = -1e18,
      y1 = -1e18;
    bs.forEach(b => {
      x0 = Math.min(x0, b.x);
      y0 = Math.min(y0, b.y);
      x1 = Math.max(x1, b.x + b.w);
      y1 = Math.max(y1, b.y + b.h);
    });
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  };
  EB.fit = function (instant) {
    const pg = EB.page(),
      c = EB.contentBox(),
      W = innerWidth,
      avH = innerHeight - S.TOP - S.BOT - 16;
    if (!c) {
      EB.go({ k: 1, x: W / 2, y: S.TOP + avH / 2 }, instant);
      return;
    }
    if (pg.sheet) {
      const k = Math.min(1.4, (W - 24) / c.w);
      EB.go({ k, x: W / 2 - (c.x + c.w / 2) * k, y: S.TOP + 12 - c.y * k }, instant);
      return;
    }
    const k = Math.min(1.2, (W - 40) / c.w, avH / c.h);
    EB.go({ k, x: W / 2 - (c.x + c.w / 2) * k, y: S.TOP + 8 + (avH - c.h * k) / 2 - c.y * k }, instant);
  };
  EB.resize = function () {
    cv.width = innerWidth * dpr;
    cv.height = innerHeight * dpr;
    LCV.forEach(c => {
      c.width = cv.width;
      c.height = cv.height;
    });
    S.TOP = $('top').offsetHeight;
    const LS = innerWidth > innerHeight && innerHeight <= 620,
      pal = $('pal'),
      ph = pal.classList.contains('s') ? pal.offsetHeight + 8 : 0,
      dh = $('dock').offsetHeight;
    S.BOT = LS ? 14 + ph : dh + 22;
    S.LS = LS;
    document.documentElement.style.setProperty('--pb', (LS ? ph + 14 : dh + 22) + 'px');
    S.dirty = 1;
    const fx = $('fx');
    fx.width = innerWidth;
    fx.height = innerHeight;
  };

  const snapStr = pg =>
    JSON.stringify(
      { i: pg.items.filter(i => !i.fd), s: pg.sheet ? { h: pg.sheet.hid || [], l: pg.sheet.hl || {} } : null },
      (k, v) => (k[0] === '_' ? undefined : v)
    );
  EB.commit = function () {
    const pg = EB.page();
    if (!pg._h) {
      pg._h = [snapStr(pg)];
      pg._hi = 0;
      return;
    }
    const s = snapStr(pg);
    if (s === pg._h[pg._hi]) return;
    pg._h.length = pg._hi + 1;
    pg._h.push(s);
    if (pg._h.length > 70) pg._h.shift();
    pg._hi = pg._h.length - 1;
    EB.save();
    EB.refreshUI && EB.refreshUI();
  };
  EB.initHist = pg => {
    pg._h = [snapStr(pg)];
    pg._hi = 0;
  };
  EB.undo = function () {
    const pg = EB.page();
    if (!pg._h || pg._hi < 1) return;
    pg._hi--;
    restore(pg);
  };
  EB.redo = function () {
    const pg = EB.page();
    if (!pg._h || pg._hi >= pg._h.length - 1) return;
    pg._hi++;
    restore(pg);
  };
  function restore(pg) {
    const o = JSON.parse(pg._h[pg._hi]);
    pg.items = o.i;
    if (pg.sheet && o.s) {
      pg.sheet.hid = o.s.h;
      pg.sheet.hl = o.s.l;
      EB.rebuildSheet();
    }
    S.sel = [];
    EB.mountWidgets();
    EB.showAct && EB.showAct();
    S.dirty = 1;
    EB.save();
    EB.refreshUI && EB.refreshUI();
  }
  let saveT = 0;
  EB.save = function () {
    clearTimeout(saveT);
    saveT = setTimeout(EB.flush, 700);
  };
  EB.flush = function () {
    clearTimeout(saveT);
    const l = S.lesson;
    if (!l) return;
    EB.page() && (EB.page().view = Object.assign({}, S.V));
    l.pi = S.pi;
    l.sess = S.sess || 0;
    const out = JSON.parse(JSON.stringify(l, (k, v) => (k[0] === '_' || k === 'el' ? undefined : v)));
    out.pages.forEach(p => (p.items = p.items.filter(i => !i.fd)));
    return EduStore.put(out).then(() => {
      l.updated = out.updated;
    });
  };
  let posSig = '';
  setInterval(() => {
    if (!S.lesson || !EB.page()) return;
    const sig = S.pi + ':' + Math.round(S.V.x) + ':' + Math.round(S.V.y) + ':' + S.V.k.toFixed(3);
    if (sig !== posSig) {
      if (posSig) EB.save();
      posSig = sig;
    }
  }, 1200);
  addEventListener('pagehide', () => EB.flush());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) EB.flush();
  });

  EB.partsHtml = parts =>
    parts.length > 1
      ? parts.map(p => `<h4 class="pt">${esc(p.title)}</h4>${p.html}`).join('')
      : parts[0]
        ? parts[0].html
        : '';
  EB.cleanHtml = function (html) {
    const d = document.createElement('div');
    d.innerHTML = String(html || '');
    d.querySelectorAll('script,style,button,.masala-tools,sup.fn-ref,.fn-ref').forEach(n => n.remove());
    d.querySelectorAll('[onclick]').forEach(n => {
      const m = /openGlossaryPopup\(\s*['"]([^'"]*)['"]/.exec(n.getAttribute('onclick') || '');
      if (m) {
        n.dataset.g = m[1].replace(/\\'/g, "'");
        n.classList.add('gterm');
      }
      n.removeAttribute('onclick');
    });
    d.querySelectorAll('[style],[id]').forEach(n => {
      n.removeAttribute('style');
      n.removeAttribute('id');
    });
    return d.innerHTML;
  };
  const legacyHtml = sh =>
    '<div class="mb">' +
    esc(
      String(sh.body || '')
        .replace(/\r/g, '')
        .replace(/<[^>]+>/g, '')
        .trim()
    ).replace(/\n+/g, '<br>') +
    '</div>';
  const SENT = /[^.!؟?؛\n]+[.!؟?؛]*/g;

  EB.unitize = function (sh, hid, hl) {
    const root = document.createElement('div');
    root.innerHTML = sh.html ? sh.html : legacyHtml(sh);
    const mode = 'text',
      U = [];
    let n = 0;
    const mk = () => {
      const sp = document.createElement('span');
      sp.className = 'u';
      sp.dataset.i = n++;
      return sp;
    };
    if (mode === 'text') {
      const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT),
        nodes = [];
      while (tw.nextNode()) nodes.push(tw.currentNode);
      nodes.forEach(t => {
        if (t.parentElement.closest('.pt,.nu')) return;
        const parts = t.data.split(/(\s+)/);
        if (parts.length === 1 && !parts[0].trim()) return;
        const fr = document.createDocumentFragment();
        parts.forEach(p => {
          if (!p) return;
          if (/^\s+$/.test(p)) fr.appendChild(document.createTextNode(p));
          else {
            const sp = mk();
            sp.textContent = p;
            fr.appendChild(sp);
          }
        });
        t.replaceWith(fr);
      });
    } else {
      root.querySelectorAll('.mb').forEach(blk => {
        const tw = document.createTreeWalker(blk, NodeFilter.SHOW_TEXT),
          nodes = [];
        let txt = '';
        while (tw.nextNode()) {
          nodes.push({ n: tw.currentNode, s: txt.length });
          txt += tw.currentNode.data;
        }
        const sp = [];
        let m;
        SENT.lastIndex = 0;
        while ((m = SENT.exec(txt))) {
          const a = m.index + (m[0].length - m[0].trimStart().length),
            b = m.index + m[0].trimEnd().length;
          if (b > a) sp.push([a, b]);
        }
        const at = off => {
          for (let k = nodes.length - 1; k >= 0; k--) if (nodes[k].s <= off) return k;
          return 0;
        };
        for (let k = sp.length - 1; k >= 0; k--) {
          const [a, b] = sp[k],
            na = nodes[at(a)],
            nb = nodes[at(Math.max(a, b - 1))];
          const r = document.createRange();
          r.setStart(na.n, a - na.s);
          r.setEnd(nb.n, Math.min(nb.n.data.length, b - nb.s));
          const el = document.createElement('span');
          el.className = 'u';
          el.appendChild(r.extractContents());
          r.insertNode(el);
        }
      });
      root.querySelectorAll('.mb span.u').forEach(el => {
        el.dataset.i = n++;
      });
    }
    root.querySelectorAll('span.u').forEach(el => U.push({ t: el.textContent }));
    const H = hid || new Set();
    root.querySelectorAll('span.u').forEach(el => {
      if (H.has(+el.dataset.i)) el.classList.add('b');
      const k = hl && hl[el.dataset.i];
      if (k) {
        el.classList.add('hl');
        el.style.setProperty('--hc', k);
      }
    });
    EB.hlGaps(root);
    return { html: root.innerHTML, U };
  };

  EB.hlGaps = function (root) {
    root.querySelectorAll('span.ug').forEach(g => g.replaceWith(document.createTextNode(g.textContent)));
    root.normalize && root.normalize();
    root.querySelectorAll('span.u.hl').forEach(a => {
      const t = a.nextSibling;
      if (!t || t.nodeType !== 3 || !/^\s+$/.test(t.data)) return;
      const b = t.nextSibling;
      if (!b || b.nodeType !== 1 || !b.classList.contains('u') || !b.classList.contains('hl')) return;
      const g = document.createElement('span');
      g.className = 'ug';
      g.textContent = t.data;
      g.style.setProperty('--hc', a.style.getPropertyValue('--hc') || '#ffe14d');
      t.replaceWith(g);
    });
  };
  EB.units = function (sh) {
    if (sh._u && sh._um === sh.mode) return sh._u;
    const r = EB.unitize(sh);
    sh._u = r.U;
    sh._um = sh.mode;
    return sh._u;
  };
  function sheetHTML(pg) {
    const sh = pg.sheet;
    if (!sh) return '';
    const dk = isDark(sh.col || '#fff'),
      fg = dk ? '#f3ecdd' : '#241b0f';
    if (sh.kind === 'img')
      return `<section class="sheet" style="left:0;top:0;width:${sh.w || 900}px;background:${sh.col || '#fff'}"><img class="doc" src="${(S.assets && S.assets[sh.img]) || ''}" alt=""></section>`;
    const mode = sh.mode || 'text',
      r = EB.unitize(sh, new Set(sh.hid || []), sh.hl);
    sh._u = r.U;
    sh._um = sh.mode;
    const w = 640,
      CFg = (EB.CF && EB.CF.gl) || 'tap',
      gall = (sh.gl || []).concat(CFg === 'show' || sh.glAuto ? EB.autoGl(sh) : []),
      gl =
        gall.length && (CFg !== 'off' || sh.glAuto)
          ? `<div class="gl"><h5>معاني المصطلحات</h5>${gall.map(g => `<p><b>${esc(g.k)}:</b> ${esc(g.t)}</p>`).join('')}</div>`
          : '';
    return `<section class="sheet${dk ? ' nm' : ''}" style="left:0;top:0;width:${w + (sh.marg ? 300 : 0)}px;background:${sh.col || '#fff'};color:${fg}"><div class="card" style="width:${w}px"><div class="bk-h"><i class="ti ti-book-2"></i>${esc(sh.book || '')}</div><h3>${esc(sh.title || '')}</h3><div class="bk m-${mode}${sh.gloss === false || CFg === 'off' ? ' ng' : ''}" style="font-size:${sh.fs || 30}px;line-height:${sh.lh || 2.1}">${r.html}</div>${gl}</div>${sh.marg ? '<div class="mg" style="flex:1">مساحة للشرح</div>' : ''}</section>`;
  }
  EB.mount = function (keepView) {
    const pg = EB.page();
    EB.clearLayers();
    world.innerHTML = sheetHTML(pg) + '<div id="wl"></div>';
    const sheetEl = world.querySelector('.sheet');
    pg._sheetEl = sheetEl;
    const measure = () => {
      if (sheetEl) {
        pg._sw = sheetEl.offsetWidth;
        pg._sh = sheetEl.offsetHeight;
      }
      S.dirty = 1;
    };
    measure();
    if (sheetEl) {
      const im = sheetEl.querySelector('img');
      if (im)
        im.onload = () => {
          measure();
          EB.fit(true);
        };
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    EB.mountWidgets();
    if (!keepView) {
      if (pg.view) {
        S.V = Object.assign({}, pg.view);
        applyV();
      } else {
        EB.fit(true);
      }
    }
    S.sel = [];
    EB.showAct && EB.showAct();
    EB.refreshUI && EB.refreshUI();
    applyV();
  };

  EB.autoGl = function (sh) {
    if (sh._ag) return sh._ag;
    if (sh._agp || !EB.bridge || !EB.bridge.defs) return [];
    sh._agp = 1;
    const keys = [...new Set([...String(sh.html || '').matchAll(/data-g="([^"]+)"/g)].map(m => m[1]))].slice(0, 20),
      off = (EB.CF && EB.CF.glOff) || [];
    Promise.all(
      keys.map(async k => {
        try {
          const d = ((await EB.bridge.defs(k)) || []).filter(x => !off.includes(x.s || ''));
          return d[0] ? { k, t: d[0].t } : null;
        } catch (e) {
          return null;
        }
      })
    ).then(r => {
      sh._ag = r.filter(Boolean);
      sh._agp = 0;
      if (EB.page() && EB.page().sheet === sh) EB.rebuildSheet();
    });
    return [];
  };
  EB.refreshGl = function () {
    (EB.S.lesson ? EB.S.lesson.pages : []).forEach(p => {
      if (p.sheet) {
        p.sheet._ag = null;
        p.sheet._agp = 0;
      }
    });
    if (EB.page() && EB.page().sheet) EB.rebuildSheet();
  };
  EB.rebuildSheet = function () {
    const pg = EB.page();
    const old = pg._sheetEl;
    const tmp = document.createElement('div');
    tmp.innerHTML = sheetHTML(pg);
    const n = tmp.firstElementChild;
    if (old) old.replaceWith(n);
    else world.insertBefore(n, world.firstChild);
    pg._sheetEl = n;
    pg._sw = n.offsetWidth;
    pg._sh = n.offsetHeight;
    S.dirty = 1;
    EB.refreshUI && EB.refreshUI();
  };
  EB.gotoPage = function (i, anim) {
    const L = S.lesson;
    i = Math.max(0, Math.min(L.pages.length - 1, i));
    if (L.pages[S.pi]) L.pages[S.pi].view = Object.assign({}, S.V);
    S.pi = i;
    if (!EB.page()._h) EB.initHist(EB.page());
    EB.mount();
    EB.save();
  };
  EB.addPage = function (pg, at) {
    const L = S.lesson;
    at = at == null ? S.pi + 1 : at;
    L.pages.splice(at, 0, pg);
    EB.initHist(pg);
    EB.gotoPage(at);
    EB.save();
    return pg;
  };
  EB.delPage = function (i) {
    const L = S.lesson;
    if (L.pages.length < 2) {
      EB.toast('لا يمكن حذف الصفحة الوحيدة');
      return;
    }
    L.pages.splice(i, 1);
    S.pi = Math.min(S.pi, L.pages.length - 1);
    EB.mount();
    EB.save();
  };

  EB.start = function () {
    EB.resize();
    addEventListener('resize', () => {
      EB.resize();
    });
    requestAnimationFrame(frameRender);
  };
  EB.drawItem = drawItem;
  EB.drawStroke = drawStroke;
  EB.wrapText = wrapText;
})();
