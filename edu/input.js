(function () {
  'use strict';
  const EB = window.EB,
    S = EB.S,
    $ = EB.$,
    cv = $('cv'),
    hyp = Math.hypot,
    PI = Math.PI;
  const ptrs = new Map();
  let pinch = null,
    panning = null,
    down = null,
    drag = null,
    marquee = null,
    holdT = 0,
    lastTap = {},
    hov = null,
    erased = 0;
  const page = () => EB.page();
  const vis = EB.vis;

  EB.domAt = function (x, y) {
    cv.style.pointerEvents = 'none';
    const els = document.elementsFromPoint(x, y);
    cv.style.pointerEvents = '';
    return els;
  };
  EB.tapDom = function (x, y) {
    const els = EB.domAt(x, y);
    for (const el of els) {
      const u = el.closest && el.closest('.u');
      if (u && u.classList.contains('b')) {
        EB.toggleUnit(u, false);
        return true;
      }
      const g = el.closest && el.closest('.gterm[data-g]');
      if (g && S.tool !== 'hide' && !g.closest('.bk.ng')) {
        EB.glossPop(g.dataset.g, g);
        return true;
      }
      const a = el.closest && el.closest('[data-a]');
      if (a && EB.W) {
        EB.W.act(a, x, y);
        return true;
      }
    }
    return false;
  };

  EB.unitGroup = function (u, g) {
    if (g !== 's' && g !== 'p') return [u];
    const blk = u.closest('.mb') || u.closest('.bk') || u.parentElement,
      all = [...blk.querySelectorAll('.u')];
    if (g === 'p') return all;
    const segs = [];
    let cur = [];
    all.forEach(x => {
      cur.push(x);
      if (/[.!؟?؛:۔]$/.test(x.textContent.trim())) {
        segs.push(cur);
        cur = [];
      }
    });
    if (cur.length) segs.push(cur);
    return segs.find(sg => sg.includes(u)) || [u];
  };

  EB.unitOwner = function (u) {
    const w = u.closest('.wid');
    if (w) {
      const it = page().items.find(x => x._el === w);
      return it ? it.d : null;
    }
    return page().sheet || null;
  };
  EB.toggleUnit = function (u, hide, g) {
    const grp = EB.unitGroup(u, g == null ? S.hg || 'w' : g);
    grp.forEach(x => {
      const o = EB.unitOwner(x);
      if (!o) return;
      o.hid = o.hid || [];
      const i = +x.dataset.i,
        has = o.hid.includes(i),
        want = hide == null ? !has : hide;
      if (want && !has) {
        o.hid.push(i);
        x.classList.add('b');
        (S.rvs = S.rvs || []).length = 0;
      } else if (!want && has) {
        o.hid.splice(o.hid.indexOf(i), 1);
        x.classList.remove('b');
      }
    });
    S.udirty = 1;
    EB.refreshUI && EB.refreshUI();
  };

  EB.hlUnit = function (u, col) {
    const o = EB.unitOwner(u);
    if (!o) return;
    o.hl = o.hl || {};
    const i = u.dataset.i;
    if (col) {
      o.hl[i] = col;
      u.classList.add('hl');
      u.style.setProperty('--hc', col);
    } else {
      delete o.hl[i];
      u.classList.remove('hl');
      u.style.removeProperty('--hc');
    }
    S.udirty = 1;
    const bk = u.closest('.bk, .sheet');
    if (bk) {
      cancelAnimationFrame(bk._gp);
      bk._gp = requestAnimationFrame(() => EB.hlGaps(bk));
    }
  };

  EB.textOwners = function () {
    const pg = page(),
      L = [];
    if (pg.sheet && pg.sheet.kind === 'book') L.push({ o: pg.sheet, n: EB.units(pg.sheet).length, el: pg._sheetEl });
    pg.items
      .filter(x => x.t === 'wid' && x.k === 'bk' && !x.hs)
      .sort((a, b) => a.y - b.y || b.x - a.x)
      .forEach(x => L.push({ o: x.d, n: EB.unitize({ html: x.d.html || '' }).U.length, el: x._el }));
    return L;
  };
  EB.hiddenCount = () => EB.textOwners().reduce((n, e) => n + (e.o.hid || []).length, 0);
  const domU = (e, i) => e.el && e.el.querySelector(`.u[data-i="${i}"]`);
  EB.hideAllUnits = function (mode) {
    if (mode === true) mode = 'all';
    else if (mode === false) mode = 'none';
    const L = EB.textOwners();
    if (!L.length) {
      EB.toast('أضف نصاً من كتاب أولاً');
      return;
    }
    L.forEach(e => {
      const words = e.el ? [...e.el.querySelectorAll('.u')] : [];
      let H = [];
      if (mode === 'all') H = Array.from({ length: e.n }, (_, k) => k);
      else if (mode === 'rand')
        H = words
          .filter(u => u.textContent.replace(/[^\p{L}\p{N}]/gu, '').length > 2 && Math.random() < 0.34)
          .map(u => +u.dataset.i);
      e.o.hid = H;
      words.forEach(u => u.classList.toggle('b', H.includes(+u.dataset.i)));
    });
    S.rvs = [];
    EB.commit();
    EB.refreshUI();
  };

  EB.revealStep = function (dir) {
    const L = EB.textOwners();
    S.rvs = S.rvs || [];
    if (dir > 0) {
      for (const e of L) {
        if (e.o.hid && e.o.hid.length) {
          const i = Math.min(...e.o.hid);
          e.o.hid.splice(e.o.hid.indexOf(i), 1);
          S.rvs.push({ o: e.o, i });
          const u = domU(e, i);
          if (u) u.classList.remove('b');
          break;
        }
      }
    } else {
      const r = S.rvs.pop();
      if (!r) return;
      const e = L.find(x => x.o === r.o);
      r.o.hid = r.o.hid || [];
      r.o.hid.push(r.i);
      const u = e && domU(e, r.i);
      if (u) u.classList.add('b');
    }
    EB.commit();
    EB.refreshUI();
  };

  function selBox() {
    return EB.unionBox(S.sel);
  }

  const NS = [
    ['r', 'مستطيل مدوّر', 'ti-rectangle'],
    ['o', 'بيضاوي', 'ti-oval'],
    ['p', 'كبسولة', 'ti-capsule-horizontal'],
    ['s', 'مربّع حاد', 'ti-square'],
    ['l', 'خط سفلي', 'ti-underline']
  ];
  EB.nodeShapePop = function (anchor, items) {
    const nodes = items.filter(x => x.t === 'node'),
      cur = nodes[0] && (nodes[0].ns || 'r');
    EB.openPop(
      `<div class="nsg">${NS.map(n => `<button data-ns="${n[0]}" class="${cur === n[0] ? 'on' : ''}"><i class="ti ${n[2]}"></i><span>${n[1]}</span></button>`).join('')}</div>`,
      anchor,
      { mode: 'ns', title: 'شكل العقدة' }
    );
    const pop = document.getElementById('pop');
    pop._on = e => {
      const b = e.target.closest('[data-ns]');
      if (!b) return;
      nodes.forEach(x => {
        x.ns = b.dataset.ns;
      });
      pop.querySelectorAll('[data-ns]').forEach(x => x.classList.toggle('on', x === b));
      S.dirty = 1;
      EB.commit();
    };
  };
  EB.handleList = function () {
    if (!S.sel.length || S.shaping) return [];
    const k = S.V.k,
      it = S.sel[0];
    if (S.sel.length === 1) {
      if (it.t === 'line')
        return [
          { id: 'p1', x: it.x1, y: it.y1 },
          { id: 'p2', x: it.x2, y: it.y2 }
        ];
      if (it.t === 'shape') {
        const hw = it.w / 2,
          hh = it.h / 2,
          L = [
            ['nw', -1, -1],
            ['n', 0, -1],
            ['ne', 1, -1],
            ['e', 1, 0],
            ['se', 1, 1],
            ['s', 0, 1],
            ['sw', -1, 1],
            ['w', -1, 0]
          ].map(([id, sx, sy]) => Object.assign({ id, sx, sy }, EB.toWorld(it, { x: sx * hw, y: sy * hh })));
        L.push(Object.assign({ id: 'rot' }, EB.toWorld(it, { x: 0, y: -hh - 38 / k })));
        if (it.s === 'poly' && it.closed === false)
          it.pts.forEach(([u, v], i) =>
            L.push(Object.assign({ id: 'v' + i, vi: i }, EB.toWorld(it, { x: (u - 0.5) * it.w, y: (v - 0.5) * it.h })))
          );
        return L;
      }
      if (it.t === 'wid') {
        const b = EB.box(it);
        return [
          { id: 'nw', x: b.x, y: b.y },
          { id: 'ne', x: b.x + b.w, y: b.y },
          { id: 'se', x: b.x + b.w, y: b.y + b.h },
          { id: 'sw', x: b.x, y: b.y + b.h },
          { id: 'e', x: b.x + b.w, y: b.y + b.h / 2 },
          { id: 'w', x: b.x, y: b.y + b.h / 2 }
        ];
      }
      if (it.t === 'node') {
        const b = EB.box(it);
        return [
          { id: 'nw', x: b.x, y: b.y },
          { id: 'ne', x: b.x + b.w, y: b.y },
          { id: 'se', x: b.x + b.w, y: b.y + b.h },
          { id: 'sw', x: b.x, y: b.y + b.h },
          { id: 'e', x: b.x + b.w, y: b.y + b.h / 2 },
          { id: 'w', x: b.x, y: b.y + b.h / 2 },
          { id: 's', x: b.x + b.w / 2, y: b.y + b.h }
        ];
      }
      if (it.t === 'frame') {
        const b = EB.box(it);
        return [
          { id: 'nw', x: b.x, y: b.y },
          { id: 'ne', x: b.x + b.w, y: b.y },
          { id: 'se', x: b.x + b.w, y: b.y + b.h },
          { id: 'sw', x: b.x, y: b.y + b.h },
          { id: 'e', x: b.x + b.w, y: b.y + b.h / 2 },
          { id: 'w', x: b.x, y: b.y + b.h / 2 },
          { id: 's', x: b.x + b.w / 2, y: b.y + b.h },
          { id: 'n', x: b.x + b.w / 2, y: b.y }
        ];
      }
    }
    const b = selBox();
    return [
      { id: 'nw', x: b.x, y: b.y },
      { id: 'ne', x: b.x + b.w, y: b.y },
      { id: 'se', x: b.x + b.w, y: b.y + b.h },
      { id: 'sw', x: b.x, y: b.y + b.h }
    ];
  };
  function hitHandle(pt, px) {
    const r = (px || 22) / S.V.k;
    const L = EB.handleList();
    for (let i = L.length - 1; i >= 0; i--) if (hyp(pt.x - L[i].x, pt.y - L[i].y) < r) return L[i];
    return null;
  }

  EB.drawOverlay = function (c) {
    const k = S.V.k,
      acc = getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#C0502A';
    c.save();
    c.lineWidth = 2.5 / k;
    c.strokeStyle = acc;
    c.setLineDash([9 / k, 6 / k]);
    S.sel.forEach(it => {
      if (!vis(it)) return;
      const f = EB.frame(it),
        pad = 6 / k;
      c.beginPath();
      if (it.t === 'shape') {
        f.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
        c.closePath();
      } else {
        const b = EB.box(it);
        c.rect(b.x - pad, b.y - pad, b.w + 2 * pad, b.h + 2 * pad);
      }
      c.stroke();
    });
    if (S.sel.length > 1) {
      const b = selBox(),
        pad = 8 / k;
      c.setLineDash([]);
      c.lineWidth = 1.5 / k;
      c.strokeRect(b.x - pad, b.y - pad, b.w + 2 * pad, b.h + 2 * pad);
    }
    c.setLineDash([]);
    const H = EB.handleList();
    const rh = H.find(h => h.id === 'rot');
    if (rh && S.sel[0]) {
      const t = EB.toWorld(S.sel[0], { x: 0, y: -S.sel[0].h / 2 });
      c.lineWidth = 2 / k;
      c.beginPath();
      c.moveTo(t.x, t.y);
      c.lineTo(rh.x, rh.y);
      c.stroke();
    }

    const tc =
      S.sel.length === 1 &&
      (S.sel[0].t === 'text' || S.sel[0].t === 'node') &&
      /^#[0-9a-f]{3,8}$/i.test(S.sel[0].c || '')
        ? S.sel[0].c
        : null;
    H.forEach(h => {
      const s = 1 / k,
        id = h.id,
        rr = (x, y, w, hh, r) => {
          c.beginPath();
          c.roundRect ? c.roundRect(x, y, w, hh, r) : c.rect(x, y, w, hh);
        };
      c.setLineDash([]);
      c.lineWidth = tc ? 3 * s : 2.5 * s;
      c.fillStyle = tc || '#fff';
      c.strokeStyle = tc ? '#fff' : acc;
      if (tc) {
        c.shadowColor = 'rgba(0,0,0,.38)';
        c.shadowBlur = 5;
      } else c.shadowBlur = 0;
      if (id === 'rot') {
        c.beginPath();
        c.arc(h.x, h.y, 13 * s, 0, 7);
        c.fill();
        c.stroke();
        c.beginPath();
        c.arc(h.x, h.y, 5.5 * s, -2.6, 1.9);
        c.lineWidth = 2.2 * s;
        c.stroke();
        const ex = h.x + 5.5 * s * Math.cos(1.9),
          ey = h.y + 5.5 * s * Math.sin(1.9);
        c.beginPath();
        c.moveTo(ex - 4 * s, ey - 1 * s);
        c.lineTo(ex + 0.5 * s, ey + 3 * s);
        c.lineTo(ex + 3.5 * s, ey - 3 * s);
        c.stroke();
      } else if (id === 'p1' || id === 'p2') {
        c.beginPath();
        c.arc(h.x, h.y, 10 * s, 0, 7);
        c.fillStyle = acc;
        c.fill();
        c.strokeStyle = '#fff';
        c.lineWidth = 3 * s;
        c.stroke();
      } else if (h.vi !== undefined) {
        c.save();
        c.translate(h.x, h.y);
        c.rotate(Math.PI / 4);
        rr(-7 * s, -7 * s, 14 * s, 14 * s, 3 * s);
        c.fill();
        c.stroke();
        c.restore();
      } else if (id.length === 1) {
        const hz = id === 'n' || id === 's',
          ang = h.sx !== undefined && S.sel[0] ? S.sel[0].rot || 0 : 0;
        c.save();
        c.translate(h.x, h.y);
        c.rotate(ang);
        if (hz) rr(-13 * s, -5 * s, 26 * s, 10 * s, 5 * s);
        else rr(-5 * s, -13 * s, 10 * s, 26 * s, 5 * s);
        c.fill();
        c.stroke();
        c.restore();
      } else {
        c.save();
        c.translate(h.x, h.y);
        c.rotate(S.sel.length === 1 && S.sel[0].t === 'shape' ? S.sel[0].rot || 0 : 0);
        rr(-9 * s, -9 * s, 18 * s, 18 * s, tc ? 9 * s : 5 * s);
        c.fill();
        c.stroke();
        c.restore();
      }
      c.shadowBlur = 0;
    });
    if (marquee) {
      const m = marquee;
      c.globalAlpha = 0.12;
      c.fillStyle = acc;
      c.fillRect(Math.min(m.x0, m.x1), Math.min(m.y0, m.y1), Math.abs(m.x1 - m.x0), Math.abs(m.y1 - m.y0));
      c.globalAlpha = 1;
      c.lineWidth = 1.5 / k;
      c.setLineDash([6 / k, 4 / k]);
      c.strokeRect(Math.min(m.x0, m.x1), Math.min(m.y0, m.y1), Math.abs(m.x1 - m.x0), Math.abs(m.y1 - m.y0));
    }
    if (hov && S.tool === 'erase') {
      c.setLineDash([]);
      c.strokeStyle = '#e5484d';
      c.fillStyle = '#e5484d22';
      c.lineWidth = 2 / k;
      c.beginPath();
      c.arc(hov.x, hov.y, eRad(), 0, 7);
      c.fill();
      c.stroke();
    }
    if (S.shaping) {
      const b = EB.box(S.shaping.shp),
        pad = 10 / k;
      c.setLineDash([8 / k, 6 / k]);
      c.strokeStyle = acc;
      c.lineWidth = 2 / k;
      c.globalAlpha = 0.55;
      c.strokeRect(b.x - pad, b.y - pad, b.w + 2 * pad, b.h + 2 * pad);
    }
    if (EB.recOverlay) EB.recOverlay(c);
    c.restore();
  };
  const eRad = () => (6 + S.TS.erase.w * 1.6) / S.V.k;

  function nearestItem(pt, filter) {
    const items = page().items;
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (!vis(it) || (filter && !filter(it))) continue;
      if (EB.hit(it, pt, (S.hitPx || 12) / S.V.k)) return it;
    }
    return null;
  }
  cv.addEventListener('pointerdown', e => {
    EB.closeUI && EB.closeUI();
    if (e.pointerType === 'pen') S.penSeen = true;
    cv.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    cancelAnimationFrame(EB.anim);
    EB.zoomStop && EB.zoomStop();
    if (ptrs.size === 2) {
      S.cur = null;
      drag = null;
      marquee = null;
      clearTimeout(holdT);
      down = null;
      if (S.shaping) finishShaping();
      const [a, b] = [...ptrs.values()],
        d0 = hyp(a.x - b.x, a.y - b.y) || 1,
        cx0 = (a.x + b.x) / 2,
        cy0 = (a.y + b.y) / 2;
      pinch = { d0, ds: d0, k0: S.V.k, wx: (cx0 - S.V.x) / S.V.k, wy: (cy0 - S.V.y) / S.V.k };
      return;
    }
    if (ptrs.size > 2) return;
    down = { x: e.clientX, y: e.clientY, moved: 0, t: performance.now() };
    const pt = EB.toW(e.clientX, e.clientY);
    if ((S.penSeen && e.pointerType === 'touch') || S.tool === 'hand') {
      panning = { x: e.clientX, y: e.clientY };
      return;
    }
    const tool = S.tool;
    if (tool === 'select') {
      S.hitPx = e.pointerType === 'mouse' ? 12 : 20;

      const sbx = S.sel.length ? selBox() : null,
        tiny = sbx && Math.min(sbx.w, sbx.h) * S.V.k < 72;
      const h = hitHandle(pt, tiny ? 15 : 22);
      if (h) {
        drag = {
          type: 'handle',
          h,
          orig: S.sel.map(i => JSON.parse(JSON.stringify(i, (k, v) => (k[0] === '_' ? undefined : v)))),
          box0: selBox(),
          p0: pt,
          off: { x: h.x - pt.x, y: h.y - pt.y }
        };
        return;
      }
      const it = nearestItem(pt);
      if (it) {
        if (
          lastTap.id === it.id &&
          performance.now() - lastTap.t < 350 &&
          (it.t === 'text' || it.t === 'node' || it.t === 'wid')
        ) {
          it.t === 'wid' ? EB.editWidget(it) : EB.editText(it);
          lastTap = {};
          return;
        }
        lastTap = { id: it.id, t: performance.now() };
        if (!S.sel.includes(it)) S.sel = EB.groupOf(it);
        drag = { type: 'move', lx: pt.x, ly: pt.y, carry: EB.carryFor(S.sel) };
        EB.showAct();
        S.dirty = 1;
        return;
      }

      if (sbx && pt.x >= sbx.x && pt.x <= sbx.x + sbx.w && pt.y >= sbx.y && pt.y <= sbx.y + sbx.h) {
        drag = { type: 'move', lx: pt.x, ly: pt.y, carry: EB.carryFor(S.sel) };
        return;
      }
      S.sel = [];
      EB.showAct();
      marquee = { x0: pt.x, y0: pt.y, x1: pt.x, y1: pt.y };
      S.dirty = 1;
      return;
    }
    if (S.sel.length) {
      const hh = hitHandle(pt, 24);
      if (hh) {
        drag = {
          type: 'handle',
          h: hh,
          orig: S.sel.map(i => JSON.parse(JSON.stringify(i, (k, v) => (k[0] === '_' ? undefined : v)))),
          box0: selBox(),
          p0: pt,
          off: { x: hh.x - pt.x, y: hh.y - pt.y }
        };
        return;
      }
      S.sel = [];
      EB.showAct();
    }
    if (tool === 'hide') {
      const u = EB.domAt(e.clientX, e.clientY)
        .map(el => el.closest && el.closest('.u'))
        .find(Boolean);
      if (u) {
        drag = { type: 'hide', mode: !u.classList.contains('b') };
        EB.toggleUnit(u, drag.mode);
      }
      return;
    }
    if (tool === 'erase') {
      S.cur = { erase: 1 };
      hov = pt;
      eraseAt(pt);
      return;
    }
    if (tool === 'laser') {
      (S.laser = S.laser || []).push(
        Object.assign({ t: performance.now(), c: S.TS.laser.c, r: S.TS.laser.w, s: S.TS.laser.style }, pt)
      );
      S.dirty = 1;
      return;
    }
    {
      const T = S.TS[tool] || S.TS.pen;
      S.cur = {
        t: 'ink',
        id: EB.nid(),
        pts: [pt],
        c: T.c,
        w: T.w / S.V.k,
        hl: tool === 'hl',
        fd: S.fade && tool === 'pen',
        br: tool === 'pen' ? T.br : undefined,
        ts: null,
        sn: S.sess,
        anc: { x: e.clientX, y: e.clientY }
      };
    }
    S.dirty = 1;
  });
  cv.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId)) {
      if (S.tool === 'erase' && e.pointerType === 'mouse') {
        hov = EB.toW(e.clientX, e.clientY);
        S.dirty = 1;
      }
      return;
    }
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (down && hyp(e.clientX - down.x, e.clientY - down.y) > 7) down.moved = 1;
    if (pinch && ptrs.size >= 2) {
      const [a, b] = [...ptrs.values()],
        d = hyp(a.x - b.x, a.y - b.y),
        cx = (a.x + b.x) / 2,
        cy = (a.y + b.y) / 2;
      pinch.ds += (d - pinch.ds) * 0.7;
      const nk = Math.max(0.05, Math.min(16, (pinch.k0 * pinch.ds) / pinch.d0));
      S.V.k = nk;
      S.V.x = cx - pinch.wx * nk;
      S.V.y = cy - pinch.wy * nk;
      EB.applyV();
      return;
    }
    if (panning) {
      S.V.x += e.clientX - panning.x;
      S.V.y += e.clientY - panning.y;
      panning = { x: e.clientX, y: e.clientY };
      EB.applyV();
      return;
    }
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of evs.length ? evs : [e]) {
      const pt = EB.toW(ev.clientX, ev.clientY);
      if (S.shaping) {
        shapeMove(pt);
        continue;
      }
      if (marquee) {
        marquee.x1 = pt.x;
        marquee.y1 = pt.y;
        S.dirty = 1;
        continue;
      }
      if (drag) {
        dragMove(drag, pt, ev);
        continue;
      }
      if (S.tool === 'laser') {
        (S.laser = S.laser || []).push(
          Object.assign({ t: performance.now(), c: S.TS.laser.c, r: S.TS.laser.w, s: S.TS.laser.style }, pt)
        );
        S.dirty = 1;
      } else if (S.cur && S.cur.erase) {
        const pv = hov;
        if (pv && S.TS.erase.mode === 'part') {
          const n = Math.min(12, Math.ceil(Math.hypot(pt.x - pv.x, pt.y - pv.y) / Math.max(2, eRad() * 0.5)));
          for (let q = 1; q < n; q++) eraseAt({ x: pv.x + ((pt.x - pv.x) * q) / n, y: pv.y + ((pt.y - pv.y) * q) / n });
        }
        hov = pt;
        eraseAt(pt);
      } else if (S.cur) {
        const l = S.cur.pts[S.cur.pts.length - 1];
        if (hyp(pt.x - l.x, pt.y - l.y) * S.V.k > 1.5) {
          S.cur.pts.push(pt);
          S.dirty = 1;
          if (hyp(ev.clientX - S.cur.anc.x, ev.clientY - S.cur.anc.y) > 7) {
            S.cur.anc = { x: ev.clientX, y: ev.clientY };
            clearTimeout(holdT);
            if (S.snap && !S.cur.hl && !S.cur.fd && S.tool === 'pen')
              holdT = setTimeout(tryShape, (EB.CF && EB.CF.snapMs) || 420);
          }
        }
      }
    }
  });

  function snapHl(cur) {
    const k = S.V.k,
      tol = Math.max(3, cur.w * 0.25),
      P = [];
    for (let i = 0; i < cur.pts.length; i++) {
      const a = cur.pts[i],
        b = cur.pts[i + 1] || a,
        n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 3));
      for (let j = 0; j < n; j++) P.push({ x: a.x + ((b.x - a.x) * j) / n, y: a.y + ((b.y - a.y) * j) / n });
    }
    const hit = [...document.querySelectorAll('#stage .u')]
      .filter(u => !u.classList.contains('b'))
      .filter(u => {
        const r = u.getBoundingClientRect();
        if (r.right <= r.left || r.bottom <= r.top) return false;
        const l = (r.left - S.V.x) / k,
          t = (r.top - S.V.y) / k,
          rr = (r.right - S.V.x) / k,
          bb = (r.bottom - S.V.y) / k;
        return P.some(p => p.x >= l - tol && p.x <= rr + tol && p.y >= t - tol && p.y <= bb + tol);
      });
    if (!hit.length) return false;
    hit.forEach(u => EB.hlUnit(u, cur.c));
    S.cur = null;
    S.dirty = 1;
    EB.vibrate && EB.vibrate(8);
    return true;
  }
  function up(e) {
    clearTimeout(holdT);
    const n = ptrs.size;
    ptrs.delete(e.pointerId);
    if (ptrs.size < 2) pinch = null;
    if (S.shaping) {
      finishShaping();
    } else {
      if (S.cur && !S.cur.erase && S.cur.pts.length) {
        if (S.cur.br === 'line' && S.cur.pts.length > 2) {
          const P = S.cur.pts;
          S.cur.pts = [P[0], P[P.length - 1]];
        }
        const tiny = EB.bboxDiag(S.cur.pts) < 5 / S.V.k;
        if (tiny && !down.moved && e.type === 'pointerup' && EB.tapDom(e.clientX, e.clientY)) {
        } else if (S.cur.fd) {
          S.cur.ts = performance.now();
          page().items.push(S.cur);
        } else if (S.cur.hl && S.TS.hl.snap !== false && snapHl(S.cur)) {
        } else {
          page().items.push(S.cur);
          EB.commit();
        }
      }
      if (erased) {
        erased = 0;
        EB.commit();
      }
      if (S.udirty) {
        S.udirty = 0;
        EB.commit();
      }
      if (drag && (drag.type === 'move' || drag.type === 'handle') && down && down.moved) {
        EB.commit();
        EB.showAct();
      }
      if (marquee) {
        const m = marquee,
          x0 = Math.min(m.x0, m.x1),
          x1 = Math.max(m.x0, m.x1),
          y0 = Math.min(m.y0, m.y1),
          y1 = Math.max(m.y0, m.y1);
        if ((x1 - x0) * S.V.k > 8 || (y1 - y0) * S.V.k > 8)
          S.sel = page().items.filter(it => {
            if (!vis(it)) return false;
            const b = EB.box(it);
            return b.x < x1 && b.x + b.w > x0 && b.y < y1 && b.y + b.h > y0;
          });
        EB.showAct();
      }
      if (
        n === 1 &&
        down &&
        !down.moved &&
        e.type === 'pointerup' &&
        (S.tool === 'laser' || S.tool === 'hide' || S.tool === 'select')
      ) {
        if (S.tool === 'select' && !S.sel.length) {
        }
        if (S.tool === 'hide') {
          const u = EB.domAt(e.clientX, e.clientY)
            .map(el => el.closest && el.closest('.u'))
            .find(Boolean);
          if (u && drag == null) EB.toggleUnit(u, true);
        }
      }
    }
    S.cur = null;
    marquee = null;
    if (!ptrs.size) {
      panning = null;
      drag = null;
      hov = null;
    }
    S.dirty = 1;
    if (!ptrs.size) down = null;
  }
  EB.bboxDiag = p => {
    let x0 = 1e18,
      y0 = 1e18,
      x1 = -1e18,
      y1 = -1e18;
    p.forEach(q => {
      x0 = Math.min(x0, q.x);
      x1 = Math.max(x1, q.x);
      y0 = Math.min(y0, q.y);
      y1 = Math.max(y1, q.y);
    });
    return hyp(x1 - x0, y1 - y0);
  };
  cv.addEventListener(
    'pointerdown',
    () => {
      if (innerHeight < 520 && (S.tool === 'pen' || S.tool === 'hl')) document.body.classList.add('drawing');
    },
    true
  );
  ['pointerup', 'pointercancel'].forEach(ev => addEventListener(ev, () => document.body.classList.remove('drawing')));
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', e => {
    S.cur = null;
    up(e);
  });
  cv.addEventListener(
    'wheel',
    e => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        if (Math.abs(e.deltaY) < 40) EB.zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.01));
        else EB.zoomSmooth(e.clientX, e.clientY, Math.max(0.6, Math.min(1.6, Math.exp(-e.deltaY * 0.004))));
      } else {
        S.V.x -= e.deltaX;
        S.V.y -= e.deltaY;
        EB.applyV();
      }
    },
    { passive: false }
  );
  cv.addEventListener('contextmenu', e => e.preventDefault());

  function placeWidDom(it) {
    EB.W && EB.W.place(it);
  }
  function dragMove(d, pt, ev) {
    if (d.type === 'hide') {
      const u = EB.domAt(ev.clientX, ev.clientY)
        .map(el => el.closest && el.closest('.u'))
        .find(Boolean);
      if (u) EB.toggleUnit(u, d.mode);
      return;
    }

    if (!down || !down.moved) return;
    if (d.type === 'move') {
      const dx = pt.x - d.lx,
        dy = pt.y - d.ly;
      S.sel.concat(d.carry || []).forEach(it => {
        EB.move(it, dx, dy);
        if (it.t === 'wid') placeWidDom(it);
      });
      d.lx = pt.x;
      d.ly = pt.y;
      S.dirty = 1;
      return;
    }
    if (d.type === 'handle') handleDrag(d, pt, ev);
  }
  function snapAng(a, step, tol) {
    const s = (step * PI) / 180,
      r = Math.round(a / s) * s;
    return Math.abs(a - r) < (tol * PI) / 180 ? r : a;
  }
  function handleDrag(d, pt0, ev) {
    const pt = d.off ? { x: pt0.x + d.off.x, y: pt0.y + d.off.y } : pt0;
    const it = S.sel[0],
      o = d.orig[0],
      h = d.h;
    if (S.sel.length === 1 && it.t === 'line') {
      let x = pt.x,
        y = pt.y;
      const ax = h.id === 'p1' ? it.x2 : it.x1,
        ay = h.id === 'p1' ? it.y2 : it.y1;
      const a = Math.atan2(y - ay, x - ax),
        L = hyp(x - ax, y - ay),
        sa = snapAng(a, 15, 4);
      x = ax + L * Math.cos(sa);
      y = ay + L * Math.sin(sa);
      if (h.id === 'p1') {
        it.x1 = x;
        it.y1 = y;
      } else {
        it.x2 = x;
        it.y2 = y;
      }
      S.dirty = 1;
      return;
    }
    if (S.sel.length === 1 && it.t === 'shape') {
      if (h.vi !== undefined) {
        const lp = o.pts.map(([u, v]) => ({ x: (u - 0.5) * o.w, y: (v - 0.5) * o.h }));
        lp[h.vi] = EB.toLocal(o, pt);
        const xs = lp.map(q => q.x),
          ys = lp.map(q => q.y),
          x0 = Math.min(...xs),
          x1 = Math.max(...xs),
          y0 = Math.min(...ys),
          y1 = Math.max(...ys),
          w = Math.max(x1 - x0, 16),
          hh2 = Math.max(y1 - y0, 16),
          c = EB.toWorld(o, { x: (x0 + x1) / 2, y: (y0 + y1) / 2 });
        it.cx = c.x;
        it.cy = c.y;
        it.w = w;
        it.h = hh2;
        it.pts = lp.map(q => [(q.x - x0) / w, (q.y - y0) / hh2]);
        S.dirty = 1;
        return;
      }
      if (h.id === 'rot') {
        const a = Math.atan2(pt.y - o.cy, pt.x - o.cx) + PI / 2;
        it.rot = snapAng(a, 15, 4);
        S.dirty = 1;
        return;
      }
      const p = EB.toLocal(o, pt),
        hw = o.w / 2,
        hh = o.h / 2,
        sx = h.sx,
        sy = h.sy;
      let nw = o.w,
        nh = o.h,
        cx = 0,
        cy = 0;
      if (sx) {
        const ax = -sx * hw;
        nw = Math.max(14, Math.abs(p.x - ax));
        cx = (ax + (ax + sx * nw)) / 2;
      }
      if (sy) {
        const ay = -sy * hh;
        nh = Math.max(14, Math.abs(p.y - ay));
        cy = (ay + (ay + sy * nh)) / 2;
      }
      if (sx && sy && (o.w === o.h || ev.shiftKey)) {
        const s = Math.max(nw / o.w, nh / o.h);
        nw = o.w * s;
        nh = o.h * s;
        const ax = -sx * hw,
          ay = -sy * hh;
        cx = ax + (sx * nw) / 2;
        cy = ay + (sy * nh) / 2;
      }
      const wc = EB.toWorld(o, { x: cx, y: cy });
      it.cx = wc.x;
      it.cy = wc.y;
      it.w = nw;
      it.h = nh;
      S.dirty = 1;
      return;
    }
    if (S.sel.length === 1 && (it.t === 'wid' || it.t === 'node' || it.t === 'frame') && 'ewsn'.includes(h.id)) {
      const b = EB.box(o),
        sc = it.t === 'wid' ? o.sc || 1 : 1,
        mn = it.t === 'wid' ? 220 : it.t === 'node' ? 70 : 120;
      if (h.id === 'e') it.w = Math.max(mn, (pt.x - b.x) / sc);
      else if (h.id === 'w') {
        const r = b.x + b.w;
        it.w = Math.max(mn, (r - pt.x) / sc);
        it.x = r - it.w * sc;
      } else if (h.id === 's') {
        if (it.t === 'node') it.mh = Math.max(40, pt.y - b.y);
        else it.h = Math.max(100, pt.y - b.y);
      } else if (h.id === 'n') {
        const bt = b.y + b.h;
        it.h = Math.max(100, bt - pt.y);
        it.y = bt - it.h;
      }
      placeWidDom(it);
      S.dirty = 1;
      return;
    }

    const b = d.box0,
      ax = h.x === b.x ? b.x + b.w : b.x,
      ay = h.y === b.y ? b.y + b.h : b.y;
    const d0 = hyp(h.x - ax, h.y - ay) || 1,
      f = Math.max(0.1, hyp(pt.x - ax, pt.y - ay) / d0);
    S.sel.forEach((it, i) => {
      const n = JSON.parse(JSON.stringify(d.orig[i]));
      Object.keys(it).forEach(k => {
        if (k[0] !== '_') delete it[k];
      });
      Object.assign(it, n);
      EB.scale(it, f, f, ax, ay);
      if (it.t === 'wid') placeWidDom(it);
    });
    S.dirty = 1;
  }

  function eraseAt(pt) {
    const r = eRad(),
      items = page().items;
    {
      const els = EB.domAt(S.V.x + pt.x * S.V.k, S.V.y + pt.y * S.V.k);
      els.forEach(el => {
        const u = el.closest && el.closest('.u.hl');
        if (u) {
          EB.hlUnit(u, null);
          erased = 1;
        }
      });
    }
    const part = S.TS.erase.mode === 'part';
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (!vis(it)) continue;
      if (!EB.eraseHit(it, pt, r)) continue;
      erased = 1;
      S.dirty = 1;
      if (S.sess && it.s !== S.sess) {
        it.hs = S.sess;
        continue;
      }
      if (part && it.t === 'ink' && it.pts && it.pts.length > 1) {
        const pcs = cutInk(it, pt, r);
        items.splice(i, 1, ...pcs);
        continue;
      }
      items.splice(i, 1);
    }
  }

  function cutInk(it, pt, r) {
    const P = [],
      step = Math.max(1.2, r * 0.3);
    for (let i = 0; i < it.pts.length - 1; i++) {
      const a = it.pts[i],
        b = it.pts[i + 1],
        n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step));
      for (let j = 0; j < n; j++) P.push({ x: a.x + ((b.x - a.x) * j) / n, y: a.y + ((b.y - a.y) * j) / n });
    }
    P.push(it.pts[it.pts.length - 1]);
    const segs = [];
    let cur = [];
    P.forEach(q => {
      if (Math.hypot(q.x - pt.x, q.y - pt.y) <= r + it.w / 2) {
        if (cur.length) segs.push(cur);
        cur = [];
      } else cur.push(q);
    });
    if (cur.length) segs.push(cur);
    const keepBr = !(it.br === 'arrow' || it.br === 'darrow' || it.br === 'line');
    return segs
      .filter(s => s.length > 1)
      .map((s, n) => {
        const o = Object.assign({}, it, { id: n ? EB.nid() : it.id, pts: s });
        if (!keepBr) o.br = 'ink';
        return o;
      });
  }

  function tryShape() {
    const c = S.cur;
    if (!c || !c.pts || c.pts.length < 6) return;
    const r = Recog.recognize(c.pts, { minSize: 30 / S.V.k });
    if (!r) return;
    const last = c.pts[c.pts.length - 1];
    let shp;
    const ds0 = c.br === 'dot' ? 2 : c.br === 'dash' ? 1 : 0;
    if (r.s === 'line')
      shp = {
        t: 'line',
        id: c.id,
        x1: r.x1,
        y1: r.y1,
        x2: r.x2,
        y2: r.y2,
        c: c.c,
        lw: c.w,
        ar: c.br === 'arrow' ? 1 : 0,
        ds: ds0,
        sn: S.sess
      };
    else
      shp = {
        t: 'shape',
        id: c.id,
        s: r.s,
        cx: r.cx,
        cy: r.cy,
        w: r.w,
        h: r.h,
        rot: r.rot || 0,
        pts: r.pts,
        closed: r.closed,
        c: c.c,
        lw: c.w,
        ds: ds0,
        f: 0,
        sn: S.sess
      };
    S.shaping = {
      shp,
      P0: { x: last.x, y: last.y },
      base: { w: shp.w, h: shp.h, x2: shp.x2, y2: shp.y2, cx: shp.cx, cy: shp.cy },
      label: r.label,
      regular: shp.t === 'shape' && (shp.s === 'ellipse' || shp.s === 'rect') && Math.abs(shp.w - shp.h) < 2
    };
    S.cur = null;
    S.dirty = 1;
    EB.vibrate(14);
    EB.toast('تحوّل إلى ' + r.label, 1400);
    EB.showAct();
  }
  function shapeMove(pt) {
    const sh = S.shaping,
      it = sh.shp;
    if (it.t === 'line') {
      const a = Math.atan2(pt.y - it.y1, pt.x - it.x1),
        L = hyp(pt.x - it.x1, pt.y - it.y1),
        sa = snapAng(a, 15, 4);
      it.x2 = it.x1 + L * Math.cos(sa);
      it.y2 = it.y1 + L * Math.sin(sa);
      S.dirty = 1;
      return;
    }
    const b = sh.base,
      l = EB.toLocal({ cx: b.cx, cy: b.cy, rot: it.rot }, pt),
      l0 = EB.toLocal({ cx: b.cx, cy: b.cy, rot: it.rot }, sh.P0);
    let sx = Math.max(0.15, Math.abs(l.x) / Math.max(Math.abs(l0.x), 12)),
      sy = Math.max(0.15, Math.abs(l.y) / Math.max(Math.abs(l0.y), 12));
    if (sh.regular) {
      sx = sy = Math.max(sx, sy);
    }
    if (hyp(pt.x - sh.P0.x, pt.y - sh.P0.y) * S.V.k < 6) {
      sx = sy = 1;
    }
    it.w = b.w * sx;
    it.h = b.h * sy;
    S.dirty = 1;
    EB.placeAct();
  }
  function finishShaping() {
    const sh = S.shaping;
    if (!sh) return;
    const it = sh.shp;
    S.shaping = null;
    it.sn = S.sess;
    page().items.push(it);
    S.sel = [it];
    EB.commit();
    EB.showAct();
    S.dirty = 1;
  }
  EB.finishShaping = finishShaping;

  const FAM = [
    ['ellipse', 'ti-circle', 'دائرة'],
    ['rect', 'ti-square', 'مربع'],
    ['tri', 'ti-triangle', 'مثلث'],
    ['diamond', 'ti-diamond', 'معيّن'],
    ['semi', 'ti-circle-half-2', 'نصف دائرة'],
    ['pent', 'ti-pentagon', 'خماسي'],
    ['hex', 'ti-hexagon', 'سداسي'],
    ['star', 'ti-star', 'نجمة'],
    ['polyline', 'ti-line', 'خط منكسر']
  ];
  const polyPts = {
    tri: [
      [0.5, 0],
      [1, 1],
      [0, 1]
    ],
    diamond: [
      [0.5, 0],
      [1, 0.5],
      [0.5, 1],
      [0, 0.5]
    ]
  };
  function regPts(n, star) {
    const pts = [];
    const m = star ? n * 2 : n;
    for (let i = 0; i < m; i++) {
      const a = -PI / 2 + (i * 2 * PI) / m,
        r = star && i % 2 ? 0.42 : 1;
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    const xs = pts.map(p => p[0]),
      ys = pts.map(p => p[1]),
      x0 = Math.min(...xs),
      x1 = Math.max(...xs),
      y0 = Math.min(...ys),
      y1 = Math.max(...ys);
    return pts.map(([x, y]) => [(x - x0) / (x1 - x0), (y - y0) / (y1 - y0)]);
  }
  EB.shapeProto = function (type) {
    if (type === 'ellipse' || type === 'rect') return { s: type };
    if (type === 'semi') return { s: 'semi', closed: true };
    if (type === 'tri' || type === 'diamond') return { s: 'poly', pts: polyPts[type] };
    if (type === 'polyline')
      return {
        s: 'poly',
        closed: false,
        pts: [
          [0, 0.85],
          [0.3, 0.1],
          [0.62, 0.9],
          [1, 0.15]
        ],
        f: 0
      };
    if (type === 'pent') return { s: 'poly', pts: regPts(5) };
    if (type === 'hex') return { s: 'poly', pts: regPts(6) };
    if (type === 'star') return { s: 'poly', pts: regPts(5, 1) };
  };
  function convert(it, type) {
    const p = EB.shapeProto(type);
    delete it.pts;
    delete it.closed;
    Object.assign(it, p);
    if ((type === 'ellipse' || type === 'rect') && Math.abs(it.w - it.h) / Math.max(it.w, it.h) < 0.2)
      it.w = it.h = Math.max(it.w, it.h);
    if (type === 'semi' && Math.abs(it.h - it.w / 2) > it.w * 0.3) it.h = it.w / 2;
    S.dirty = 1;
  }
  EB.addShape = function (type, props) {
    const c = EB.vc(),
      k = Math.min(1.5, (1 / S.V.k) * 1.0),
      base = 220 * Math.max(0.4, Math.min(2, 1 / S.V.k));
    let it;
    if (type === 'line' || type === 'arrow')
      it = { t: 'line', x1: c.x - base / 2, y1: c.y, x2: c.x + base / 2, y2: c.y, ar: type === 'arrow' ? 1 : 0 };
    else
      it = Object.assign(
        {
          t: 'shape',
          cx: c.x,
          cy: c.y,
          w: base * (type === 'semi' ? 1 : 1),
          h: base * (type === 'rect' ? 0.7 : type === 'semi' ? 0.5 : 1),
          rot: 0,
          f: 0
        },
        EB.shapeProto(type)
      );
    Object.assign(
      it,
      { id: EB.nid(), c: S.color, lw: Math.max(3, S.width) / Math.max(0.3, S.V.k), sn: S.sess },
      props || {}
    );
    page().items.push(it);
    S.sel = [it];
    EB.commit();
    EB.showAct();
    S.dirty = 1;
    return it;
  };
  const ICON = (i, t, k, cls, on) =>
    `<button class="g${on ? ' on' : ''}${cls ? ' ' + cls : ''}" data-k="${k}" title="${t}"><i class="ti ${i}"></i></button>`;
  EB.showAct = function () {
    if (EB.closeMini && $('szmini') && $('szmini')._it && S.sel[0] !== $('szmini')._it) EB.closeMini();
    const a = $('act'),
      tgt = S.shaping ? S.shaping.shp : S.sel.length === 1 ? S.sel[0] : null;
    if (!S.sel.length && !S.shaping) {
      a.style.display = 'none';
      return;
    }
    let h = '';
    if (tgt && tgt.t === 'shape') {
      h +=
        '<div class="cvr">' +
        FAM.map(
          ([k, i, t]) =>
            `<button class="g${famOf(tgt) === k ? ' on' : ''}" data-k="cv:${k}" title="${t}"><i class="ti ${i}"></i></button>`
        ).join('') +
        '</div>';
      if (tgt.s === 'semi') h += ICON('ti-line', 'القاطع', 'closed', '', tgt.closed);
      h += `<button data-k="sty"><i class="ti ti-line-dashed"></i>النمط</button>`;
    } else if (tgt && tgt.t === 'line') h += `<button data-k="sty"><i class="ti ti-line-dashed"></i>النمط</button>`;
    else if (tgt && (tgt.t === 'text' || tgt.t === 'node'))
      h +=
        `<button data-k="ed"><i class="ti ti-pencil"></i>تعديل</button>` +
        (tgt.t === 'node' ? `<button data-k="ch"><i class="ti ti-subtask"></i>فرع جديد</button>` : '');
    else if (tgt && tgt.t === 'wid' && tgt.k === 'bk') h += '';
    else if (tgt && tgt.t === 'wid') h += `<button data-k="edw"><i class="ti ti-pencil"></i>تعديل السؤال</button>`;
    if (!S.shaping) {
      if (S.sel.length === 1 && S.sel[0].t === 'wid')
        h += `<button class="g" data-k="size" title="المزيد"><i class="ti ti-dots"></i></button>`;
      if (S.sel.length)
        h += `<button class="g" data-k="lay" title="الطبقات"><i class="ti ti-stack-front"></i></button>`;
      const colorable = S.sel.some(i => i.t !== 'img' && i.t !== 'wid');
      if (h && !h.endsWith('</i>')) h += '<i class="sp"></i>';
      if (colorable) h += `<button class="g" data-k="col" title="اللون"><i class="ti ti-palette"></i></button>`;
      const reals = S.sel.filter(x => x.t !== 'link' && x.t !== 'frame');
      if (reals.length > 1)
        h += `<button data-k="arr"><i class="ti ti-layout-grid"></i>ترتيب</button><button data-k="grp"><i class="ti ti-stack-2"></i>${S.sel.every(x => x.g && x.g === S.sel[0].g) ? 'فكّ' : 'تجميع'}</button><button data-k="wrap"><i class="ti ti-frame"></i>حلبة</button>`;
      if (S.sel.filter(x => x.t !== 'link').length === 2)
        h += `<button data-k="lnk"><i class="ti ti-link"></i>ربط</button>`;
      if (S.sel.length === 1 && S.sel[0].g)
        h += `<button data-k="grp"><i class="ti ti-stack-2"></i>فكّ التجميع</button>`;
      if (S.sel.length === 1 && S.sel[0].t === 'node')
        h += `${S.sel[0].par ? '<button data-k="sib"><i class="ti ti-arrow-bar-both"></i>فرع بجانبه</button>' : ''}<button data-k="tree"><i class="ti ti-hierarchy-2"></i>تحديد الفرع كله</button><button data-k="carry" class="${EB.carryOn() ? 'on' : ''}" aria-pressed="${EB.carryOn()}" title="عند تحريك العقدة تتحرك فروعها معها"><i class="ti ti-link"></i>معها فروعها</button><button data-k="nsh"><i class="ti ti-shape-2"></i>الشكل</button>`;
      if (S.sel.length === 1 && S.sel[0].t === 'frame')
        h += `<button data-k="edf"><i class="ti ti-pencil"></i>العنوان</button>`;
      if (S.sel.length === 1 && S.sel[0].t === 'link')
        h += `<button data-k="sty"><i class="ti ti-line-dashed"></i>النمط</button>`;
      h += `<button class="g" data-k="cp" title="نسخ"><i class="ti ti-copy"></i></button><button class="g dng" data-k="del" title="حذف"><i class="ti ti-trash"></i></button>`;
    } else h += `<button class="g" data-k="col" title="اللون"><i class="ti ti-palette"></i></button>`;
    a.innerHTML = h;
    a.style.display = 'flex';
    EB.placeAct();
  };
  function famOf(it) {
    if (it.s === 'ellipse' || it.s === 'rect' || it.s === 'semi') return it.s;
    if (it.s === 'poly' && it.pts) {
      if (it.closed === false) return 'polyline';
      const n = it.pts.length;
      if (n === 3) return 'tri';
      if (n === 4) return 'diamond';
      if (n === 5) return 'pent';
      if (n === 6) return 'hex';
      if (n === 10) return 'star';
    }
    return '';
  }
  EB.placeAct = function () {
    const a = $('act');
    if (a.style.display === 'none') return;
    const items = S.shaping ? [S.shaping.shp] : S.sel;
    if (!items.length) return;
    const b = EB.unionBox(items),
      k = S.V.k;
    const sx = S.V.x + (b.x + b.w / 2) * k,
      sy = S.V.y + b.y * k;
    let y = sy - a.offsetHeight - 46;
    if (y < S.TOP + 6) y = Math.min(S.V.y + (b.y + b.h) * k + 50, innerHeight - S.BOT - a.offsetHeight - 6);
    if (y < S.TOP + 6) y = S.TOP + 6;
    a.style.top = y + 'px';
    a.style.left = Math.max(8, Math.min(innerWidth - a.offsetWidth - 8, sx - a.offsetWidth / 2)) + 'px';
  };
  $('act').addEventListener('pointerdown', e => e.stopPropagation());
  $('act').addEventListener('click', e => {
    const bt = e.target.closest('[data-k]');
    if (!bt) return;
    const k = bt.dataset.k,
      tgt = S.shaping ? S.shaping.shp : S.sel[0],
      items = S.sel;
    if (k.startsWith('cv:')) {
      convert(tgt, k.slice(3));
      if (S.shaping) {
        S.shaping.regular = (tgt.s === 'ellipse' || tgt.s === 'rect') && Math.abs(tgt.w - tgt.h) < 2;
        S.shaping.base.w = tgt.w;
        S.shaping.base.h = tgt.h;
      }
      if (!S.shaping) EB.commit();
      EB.showAct();
      return;
    }
    const A = {
      fill: () => {
        tgt.f = tgt.f ? 0 : 1;
      },
      dash: () => {
        tgt.d = tgt.d ? 0 : 1;
      },
      closed: () => {
        tgt.closed = !tgt.closed;
      },
      arrow: () => {
        tgt.ar = tgt.ar ? 0 : 1;
      },
      bkf: () => {
        tgt.d.fs = Math.min(60, (tgt.d.fs || 26) + 3);
        EB.W.render(tgt);
      },
      bks: () => {
        tgt.d.fs = Math.max(14, (tgt.d.fs || 26) - 3);
        EB.W.render(tgt);
      },
      ed: () => EB.editText(tgt),
      edw: () => EB.editWidget(tgt),
      ch: () => EB.addChild(tgt),
      col: () => EB.colorPop(bt),
      lay: () => EB.layerPop(bt),
      sty: () => EB.stylePop(bt, tgt),
      arr: () => EB.arrangePop(bt),
      grp: () => {
        if (items.every(x => x.g && x.g === items[0].g)) items.forEach(x => delete x.g);
        else {
          const g = 'g' + EB.nid();
          items.forEach(x => (x.g = g));
        }
      },
      wrap: () => {
        EB.addFrame(items.filter(x => x.t !== 'link'));
      },
      lnk: () => EB.linkSel(),
      tree: () => {
        S.sel = EB.subtree(tgt);
      },
      carry: () => {
        EB.carrySet(!EB.carryOn());
      },
      sib: () => {
        const p = page().items.find(o => o.id === tgt.par);
        if (p) {
          EB.addChild(p);
        } else EB.addChild(tgt);
      },
      nsh: () => EB.nodeShapePop(bt, items),
      edf: () =>
        EB.askText('عنوان الحلبة', tgt.title || '', v => {
          tgt.title = v;
          S.dirty = 1;
          EB.commit();
        }),
      cp: () => {
        const n = items.map(i => {
          const c = EB.clone(i);
          EB.move(c, 40 / S.V.k, 40 / S.V.k);
          c.sn = S.sess;
          return c;
        });
        page().items.push(...n);
        S.sel = n;
        EB.mountWidgets();
      },
      fr: () => {
        const L = page().items;
        items.forEach(i => {
          L.splice(L.indexOf(i), 1);
          L.push(i);
        });
      },
      bk: () => {
        const L = page().items;
        items
          .slice()
          .reverse()
          .forEach(i => {
            L.splice(L.indexOf(i), 1);
            L.unshift(i);
          });
      },
      size: () => EB.sizePop(bt),
      del: () => EB.deleteSel()
    };
    if (A[k]) {
      A[k]();
      S.dirty = 1;
      if (!S.shaping) EB.commit();
      if (k !== 'del' && k !== 'col' && k !== 'lay' && k !== 'sty') EB.showAct();
    }
  });

  EB.closeMini = function () {
    const m = $('szmini');
    if (m) {
      m.classList.remove('s');
      m._it = null;
    }
    if (EB._miniAway) {
      document.removeEventListener('pointerdown', EB._miniAway, true);
      EB._miniAway = null;
    }
  };
  EB.sizePop = function (anchor) {
    const it = S.sel.length === 1 && S.sel[0].t === 'wid' ? S.sel[0] : null;
    if (!it) return;
    let m = $('szmini');
    if (!m) {
      m = document.createElement('div');
      m.id = 'szmini';
      m.setAttribute('role', 'group');
      m.setAttribute('aria-label', 'حجم الخط');
      document.body.appendChild(m);
    }
    if (m.classList.contains('s') && m._it === it) {
      EB.closeMini();
      return;
    }
    const bk = it.k === 'bk',
      FZ = ['s', 'm', 'l', 'xl'],
      FN = { s: 'صغير', m: 'متوسط', l: 'كبير', xl: 'كبير جداً' };
    const val = () => (bk ? EB.ar(it.d.fs || 26) : FN[it.d.fz || 'm']);
    m.innerHTML = `<span>حجم الخط</span><button data-st="fs-" aria-label="تصغير الخط"><i class="ti ti-minus"></i></button><b data-fv>${val()}</b><button data-st="fs+" aria-label="تكبير الخط"><i class="ti ti-plus"></i></button>`;
    m._it = it;
    m.classList.add('s');
    const ar0 = $('act').getBoundingClientRect(),
      w = m.offsetWidth,
      h = m.offsetHeight;
    let top = ar0.bottom + 8;
    if (top + h > innerHeight - S.BOT - 4) top = Math.max(S.TOP + 4, ar0.top - h - 8);
    m.style.top = top + 'px';
    m.style.left = Math.max(8, Math.min(innerWidth - w - 8, ar0.left + ar0.width / 2 - w / 2)) + 'px';
    m.onpointerdown = e => e.stopPropagation();
    m.onclick = e => {
      const b = e.target.closest('[data-st]');
      if (!b) return;
      const up = b.dataset.st === 'fs+';
      if (bk) it.d.fs = up ? Math.min(60, (it.d.fs || 26) + 3) : Math.max(14, (it.d.fs || 26) - 3);
      else {
        const i = FZ.indexOf(it.d.fz || 'm');
        it.d.fz = FZ[Math.max(0, Math.min(3, i + (up ? 1 : -1)))];
      }
      EB.W.render(it);
      EB.layout && EB.layout(true);
      const fv = m.querySelector('[data-fv]');
      if (fv) fv.textContent = val();
      S.dirty = 1;
      EB.commit && EB.commit();
      EB.placeAct && EB.placeAct();
    };
    if (EB._miniAway) document.removeEventListener('pointerdown', EB._miniAway, true);
    EB._miniAway = e => {
      if (!m.contains(e.target) && !(anchor && anchor.contains && anchor.contains(e.target))) EB.closeMini();
    };
    setTimeout(() => EB._miniAway && document.addEventListener('pointerdown', EB._miniAway, true), 30);
  };
  function scaleSel(f) {
    const b = selBox(),
      ox = b.x + b.w / 2,
      oy = b.y + b.h / 2;
    S.sel.forEach(it => {
      EB.scale(it, f, f, ox, oy);
      if (it.t === 'wid') placeWidDom(it);
    });
  }
  EB.deleteSel = function () {
    const L = page().items,
      ids = new Set();
    S.sel.forEach(it => {
      if (it.t === 'node') subtree(it.id).forEach(i => ids.add(i));
      else ids.add(it.id);
    });
    L.slice().forEach(it => {
      if (it.t === 'link' && (ids.has(it.a) || ids.has(it.b))) ids.add(it.id);
    });
    L.slice().forEach(it => {
      if (ids.has(it.id)) {
        if (S.sess && it.sn !== S.sess) it.hs = S.sess;
        else L.splice(L.indexOf(it), 1);
      }
    });
    S.sel = [];
    EB.mountWidgets();
    EB.showAct();
    S.dirty = 1;
    EB.commit();
  };
  function subtree(id) {
    const r = [id];
    page().items.forEach(o => {
      if (o.par === id) r.push(...subtree(o.id));
    });
    return r;
  }
  EB.addChild = function (p) {
    const L = page().items,
      sibs = L.filter(o => o.par === p.id).length,
      pg = p.par && L.find(q => q.id === p.par);
    const base = pg
      ? Math.atan2(p.y + p.h / 2 - (pg.y + pg.h / 2), p.x + p.w / 2 - (pg.x + pg.w / 2))
      : -PI / 2 + sibs * 1.26;
    const ang = pg ? base + (sibs % 2 ? 1 : -1) * Math.ceil(sibs / 2) * 0.6 : base,
      d = p.root ? 250 : 210,
      col = p.root ? EB.COLORS[1 + (sibs % 5)] : p.c;
    const n = {
      t: 'node',
      id: EB.nid(),
      par: p.id,
      w: 150,
      c: col,
      text: 'فرع',
      x: p.x + p.w / 2 + Math.cos(ang) * d - 75,
      y: p.y + p.h / 2 + Math.sin(ang) * d - 28,
      sn: S.sess
    };
    L.push(n);
    S.sel = [n];
    S.dirty = 1;
  };

  let edT = null;
  EB.editText = function (it) {
    edT = it;
    const t = $('edIn');
    t.value = it.text === 'اكتب هنا' || it.text === 'فرع' ? '' : it.text || '';
    $('ed').classList.add('s');
    $('ed').style.bottom = S.BOT + 8 + 'px';
    setTimeout(() => {
      t.focus();
      grow();
    }, 50);
  };
  const grow = () => {
    const t = $('edIn');
    t.style.height = 'auto';
    t.style.height = Math.min(t.scrollHeight, innerHeight * 0.3) + 'px';
  };
  $('edIn').addEventListener('input', () => {
    grow();
    if (edT) {
      edT.text = $('edIn').value || ' ';
      S.dirty = 1;
    }
  });
  EB.edDone = function () {
    if (edT) {
      if (!edT.text || !edT.text.trim()) edT.text = edT.t === 'node' ? 'فرع' : 'نص';
      S.dirty = 1;
      EB.commit();
    }
    edT = null;
    $('ed').classList.remove('s');
    $('edIn').blur();
  };
  $('edOk').onclick = EB.edDone;
  EB.addText = function () {
    const c = EB.vc(),
      w = 340,
      it = {
        t: 'text',
        id: EB.nid(),
        x: c.x - w / 2,
        y: c.y - 30,
        w,
        text: 'اكتب هنا',
        fs: Math.round(34 / Math.max(0.5, Math.min(1.5, S.V.k))),
        c: S.color,
        sn: S.sess,
        h: 60
      };
    page().items.push(it);
    S.sel = [it];
    EB.showAct();
    EB.editText(it);
    S.dirty = 1;
    return it;
  };

  cv.addEventListener('lostpointercapture', e => {
    if (!down && !drag && !panning) ptrs.delete(e.pointerId);
  });
  addEventListener('blur', () => {
    ptrs.clear();
    pinch = null;
  });
})();
