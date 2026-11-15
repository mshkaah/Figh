(function (root) {
  'use strict';
  const hyp = Math.hypot,
    PI = Math.PI,
    abs = Math.abs;
  const deg = r => (r * 180) / PI;

  function dedupe(p, e) {
    const o = [p[0]];
    for (let i = 1; i < p.length; i++) {
      const l = o[o.length - 1];
      if (hyp(p[i].x - l.x, p[i].y - l.y) >= e) o.push(p[i]);
    }
    return o;
  }
  function pathLen(p) {
    let L = 0;
    for (let i = 1; i < p.length; i++) L += hyp(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y);
    return L;
  }
  function resample(p, n) {
    const L = pathLen(p);
    if (!L) return p.slice();
    const step = L / (n - 1),
      out = [p[0]];
    let acc = 0,
      prev = p[0];
    for (let i = 1; i < p.length; i++) {
      let cur = p[i],
        d = hyp(cur.x - prev.x, cur.y - prev.y);
      while (acc + d >= step && d > 0) {
        const t = (step - acc) / d,
          q = { x: prev.x + (cur.x - prev.x) * t, y: prev.y + (cur.y - prev.y) * t };
        out.push(q);
        prev = q;
        d = hyp(cur.x - prev.x, cur.y - prev.y);
        acc = 0;
      }
      acc += d;
      prev = cur;
    }
    while (out.length < n) out.push(p[p.length - 1]);
    return out.slice(0, n);
  }
  function smooth(p, passes) {
    let a = p;
    for (let k = 0; k < passes; k++) {
      const b = a.slice();
      for (let i = 1; i < a.length - 1; i++)
        b[i] = { x: (a[i - 1].x + 2 * a[i].x + a[i + 1].x) / 4, y: (a[i - 1].y + 2 * a[i].y + a[i + 1].y) / 4 };
      a = b;
    }
    return a;
  }
  function bbox(p) {
    let x0 = 1e18,
      y0 = 1e18,
      x1 = -1e18,
      y1 = -1e18;
    p.forEach(q => {
      if (q.x < x0) x0 = q.x;
      if (q.x > x1) x1 = q.x;
      if (q.y < y0) y0 = q.y;
      if (q.y > y1) y1 = q.y;
    });
    return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
  }
  function segDist(q, a, b) {
    const dx = b.x - a.x,
      dy = b.y - a.y,
      l2 = dx * dx + dy * dy;
    let t = l2 ? ((q.x - a.x) * dx + (q.y - a.y) * dy) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    return hyp(q.x - (a.x + dx * t), q.y - (a.y + dy * t));
  }
  function lineDist(q, a, b) {
    const L = hyp(b.x - a.x, b.y - a.y) || 1;
    return abs((b.x - a.x) * (a.y - q.y) - (a.x - q.x) * (b.y - a.y)) / L;
  }

  function fitCircle(p) {
    const n = p.length;
    let mx = 0,
      my = 0;
    p.forEach(q => {
      mx += q.x;
      my += q.y;
    });
    mx /= n;
    my /= n;
    let Suu = 0,
      Suv = 0,
      Svv = 0,
      Suuu = 0,
      Svvv = 0,
      Suvv = 0,
      Svuu = 0;
    p.forEach(q => {
      const u = q.x - mx,
        v = q.y - my;
      Suu += u * u;
      Suv += u * v;
      Svv += v * v;
      Suuu += u * u * u;
      Svvv += v * v * v;
      Suvv += u * v * v;
      Svuu += v * u * u;
    });
    const det = Suu * Svv - Suv * Suv;
    if (abs(det) < 1e-9) return null;
    const uc = (Svv * (Suuu + Suvv) - Suv * (Svvv + Svuu)) / (2 * det),
      vc = (Suu * (Svvv + Svuu) - Suv * (Suuu + Suvv)) / (2 * det);
    const cx = mx + uc,
      cy = my + vc;
    let r = 0;
    p.forEach(q => (r += hyp(q.x - cx, q.y - cy)));
    r /= n;
    let e = 0;
    p.forEach(q => (e += abs(hyp(q.x - cx, q.y - cy) - r)));
    e /= n * (r || 1);
    let sweep = 0,
      pa = Math.atan2(p[0].y - cy, p[0].x - cx);
    for (let i = 1; i < n; i++) {
      const a = Math.atan2(p[i].y - cy, p[i].x - cx);
      let d = a - pa;
      while (d > PI) d -= 2 * PI;
      while (d < -PI) d += 2 * PI;
      sweep += d;
      pa = a;
    }
    return { cx, cy, r, err: e, sweep: abs(deg(sweep)) };
  }

  function rdp(p, e) {
    if (p.length < 3) return p.slice();
    let m = 0,
      k = 0;
    const a = p[0],
      b = p[p.length - 1];
    for (let j = 1; j < p.length - 1; j++) {
      const d = segDist(p[j], a, b);
      if (d > m) {
        m = d;
        k = j;
      }
    }
    return m > e
      ? rdp(p.slice(0, k + 1), e)
          .slice(0, -1)
          .concat(rdp(p.slice(k), e))
      : [a, b];
  }

  function closedPoly(p, e) {
    let f = 0,
      fd = 0;
    p.forEach((q, i) => {
      const d = hyp(q.x - p[0].x, q.y - p[0].y);
      if (d > fd) {
        fd = d;
        f = i;
      }
    });
    const poly = rdp(p.slice(0, f + 1), e)
      .slice(0, -1)
      .concat(rdp(p.slice(f), e));
    poly.pop();
    return poly;
  }
  function cleanPoly(v, L) {
    let c = v.slice(),
      changed = true;
    while (changed && c.length > 3) {
      changed = false;
      for (let i = 0; i < c.length; i++) {
        const a = c[(i + c.length - 1) % c.length],
          b = c[i],
          d = c[(i + 1) % c.length];
        const u = { x: b.x - a.x, y: b.y - a.y },
          w = { x: d.x - b.x, y: d.y - b.y };
        const turn = abs(deg(Math.atan2(u.x * w.y - u.y * w.x, u.x * w.x + u.y * w.y)));
        if (turn < 22 || hyp(u.x, u.y) < 0.07 * L) {
          c.splice(i, 1);
          changed = true;
          break;
        }
      }
    }
    return c;
  }
  function polyErr(v, Q) {
    let e = 0;
    Q.forEach(q => {
      let d = 1e18;
      for (let i = 0; i < v.length; i++) d = Math.min(d, segDist(q, v[i], v[(i + 1) % v.length]));
      e += d;
    });
    return e / Q.length;
  }
  function reducePoly(v, Q, diag) {
    let c = v.slice();
    while (c.length > 3) {
      let bi = -1,
        be = 1e18;
      for (let i = 0; i < c.length; i++) {
        const t = c.slice();
        t.splice(i, 1);
        const e = polyErr(t, Q);
        if (e < be) {
          be = e;
          bi = i;
        }
      }
      if (be < 0.04 * diag) c.splice(bi, 1);
      else break;
    }
    return c;
  }
  const wrap90 = a => {
    a = ((a % 90) + 90) % 90;
    return a > 45 ? a - 90 : a;
  };
  function snapRot(rotDeg, tol) {
    const r = wrap90(rotDeg);
    return abs(r) < tol ? rotDeg - r : rotDeg;
  }
  function norm180(a) {
    while (a > 180) a -= 360;
    while (a <= -180) a += 360;
    return a;
  }

  function straightRun(Q, minF, maxF, tol) {
    const m = Q.length;
    let best = null;
    for (let i = 0; i < m; i++) {
      for (let w = Math.floor(m * minF); w <= Math.floor(m * maxF); w++) {
        const A = Q[i],
          B = Q[(i + w) % m],
          cl = hyp(B.x - A.x, B.y - A.y);
        if (cl < 1) continue;
        let dev = 0;
        for (let k = 1; k < w; k++) {
          const d = lineDist(Q[(i + k) % m], A, B);
          if (d > dev) dev = d;
        }
        if (dev / cl < tol && (!best || w > best.w || (w === best.w && dev / cl < best.dev)))
          best = { i, w, dev: dev / cl, cl };
      }
    }
    return best;
  }

  function rotPts(p, c, a) {
    const ca = Math.cos(a),
      sa = Math.sin(a);
    return p.map(q => ({ x: c.x + (q.x - c.x) * ca - (q.y - c.y) * sa, y: c.y + (q.x - c.x) * sa + (q.y - c.y) * ca }));
  }

  function polyShape(v, label) {
    const m = v.length;
    let cx = 0,
      cy = 0;
    v.forEach(q => {
      cx += q.x;
      cy += q.y;
    });
    cx /= m;
    cy /= m;

    let bi = 0,
      bl = 0;
    for (let i = 0; i < m; i++) {
      const l = hyp(v[(i + 1) % m].x - v[i].x, v[(i + 1) % m].y - v[i].y);
      if (l > bl) {
        bl = l;
        bi = i;
      }
    }
    const e = { x: v[(bi + 1) % m].x - v[bi].x, y: v[(bi + 1) % m].y - v[bi].y };
    let ang = deg(Math.atan2(e.y, e.x)),
      adj = wrap90(ang),
      rotD = abs(adj) < 9 ? -adj : 0;
    const pr = rotD ? rotPts(v, { x: cx, y: cy }, (rotD * PI) / 180) : v;
    const b = bbox(pr),
      w = Math.max(b.w, 8),
      h = Math.max(b.h, 8);
    return {
      s: 'poly',
      cx: b.x0 + b.w / 2,
      cy: b.y0 + b.h / 2,
      w,
      h,
      rot: 0,
      pts: pr.map(q => [(q.x - b.x0) / w, (q.y - b.y0) / h]),
      closed: true,
      label
    };
  }

  function recognize(raw, o) {
    o = o || {};
    const minDiag = o.minSize || 28;
    if (!raw || raw.length < 6) return null;
    let p = dedupe(raw, 0.6);
    if (p.length < 6) return null;
    const bb0 = bbox(p),
      diag0 = hyp(bb0.w, bb0.h);
    if (diag0 < minDiag) return null;
    const L0 = pathLen(p);
    if (L0 < minDiag * 1.5) return null;
    const N = 96;
    let P = smooth(resample(p, N), 2);
    const L = pathLen(P),
      bb = bbox(P),
      diag = hyp(bb.w, bb.h);
    const A = P[0],
      Z = P[N - 1];

    let gap = hyp(A.x - Z.x, A.y - Z.y),
      cutEnd = N;
    for (let i = N - 1; i > N * 0.8; i--) {
      const g = hyp(A.x - P[i].x, A.y - P[i].y);
      if (g < gap) {
        gap = g;
        cutEnd = i + 1;
      }
    }
    for (let i = 0; i < N * 0.15; i++) {
      const g = hyp(Z.x - P[i].x, Z.y - P[i].y);
      if (g < gap) {
        gap = g;
        cutEnd = N;
      }
    }
    const gr = gap / L,
      closed = gr < 0.2;

    const chord = hyp(Z.x - A.x, Z.y - A.y);
    if (!closed) {
      let dev = 0;
      P.forEach(q => {
        const d = lineDist(q, A, Z);
        if (d > dev) dev = d;
      });
      if (chord > 0 && dev / chord < 0.055) {
        let u = { x: A.x, y: A.y },
          v = { x: Z.x, y: Z.y };
        const ang = deg(Math.atan2(v.y - u.y, v.x - u.x)),
          m = wrap90(ang);
        if (abs(m) < 6) {
          const L2 = hyp(v.x - u.x, v.y - u.y),
            th = ((ang - m) * PI) / 180,
            mx = (u.x + v.x) / 2,
            my = (u.y + v.y) / 2;
          u = { x: mx - (Math.cos(th) * L2) / 2, y: my - (Math.sin(th) * L2) / 2 };
          v = { x: mx + (Math.cos(th) * L2) / 2, y: my + (Math.sin(th) * L2) / 2 };
        }
        return { s: 'line', x1: u.x, y1: u.y, x2: v.x, y2: v.y, label: 'خط مستقيم' };
      }

      const c = fitCircle(P);
      if (c && c.err < 0.06) {
        if (c.sweep > 285) {
          const r = c.r;
          return { s: 'ellipse', cx: c.cx, cy: c.cy, w: 2 * r, h: 2 * r, rot: 0, label: 'دائرة' };
        }
        if (c.sweep > 140 && c.sweep < 225) return semiFromArc(P, c, false);
      }

      let V = rdp(P, diag * 0.06);
      const turn = (a, b, d) => {
        const t = deg(Math.atan2(d.y - b.y, d.x - b.x) - Math.atan2(b.y - a.y, b.x - a.x));
        return abs(norm180(t));
      };
      for (let pass = 0; pass < 3 && V.length > 2; pass++) {
        let k = -1,
          mn = 1e9;
        for (let i = 1; i < V.length - 1; i++) {
          const t = turn(V[i - 1], V[i], V[i + 1]);
          if (t < mn) {
            mn = t;
            k = i;
          }
        }
        if (mn < 28) V.splice(k, 1);
        else break;
      }
      if (V.length >= 3 && V.length <= 6) {
        let mx = 0,
          minSeg = 1e9;
        for (let i = 1; i < V.length - 1; i++) mx = Math.max(mx, turn(V[i - 1], V[i], V[i + 1]));
        for (let i = 1; i < V.length; i++) minSeg = Math.min(minSeg, hyp(V[i].x - V[i - 1].x, V[i].y - V[i - 1].y));
        if (mx >= 50 && minSeg > L * 0.1) {
          const b = bbox(V),
            w = Math.max(b.w, 8),
            h = Math.max(b.h, 8);
          return {
            s: 'poly',
            cx: b.x0 + b.w / 2,
            cy: b.y0 + b.h / 2,
            w,
            h,
            rot: 0,
            pts: V.map(q => [(q.x - b.x0) / w, (q.y - b.y0) / h]),
            closed: false,
            label: 'خط منكسر'
          };
        }
        if (mx < 50 && chord > 0 && dev / chord < 0.16)
          return { s: 'line', x1: A.x, y1: A.y, x2: Z.x, y2: Z.y, label: 'خط مستقيم' };
      }
      if (V.length <= 3 && chord > 0 && dev / chord < 0.16)
        return { s: 'line', x1: A.x, y1: A.y, x2: Z.x, y2: Z.y, label: 'خط مستقيم' };
      return null;
    }

    let Q = P.slice(0, cutEnd);
    if (Q.length < 12) return null;
    Q = resample(Q.concat([Q[0]]), N);
    Q.pop();
    Q = smooth(Q.concat(Q, Q), 1).slice(N, 2 * N);
    const bq = bbox(Q);

    const el = fitEllipse(Q);
    if (el.err < 0.062) return ellipseShape(el, Q);

    const sr = straightRun(Q, 0.26, 0.56, 0.045);
    if (sr) {
      const arc = [];
      for (let k = sr.w; k <= N; k++) arc.push(Q[(sr.i + k) % N]);
      const c = fitCircle(arc);
      if (c && c.err < 0.055 && c.sweep > 140 && c.sweep < 225 && abs(sr.cl / (2 * c.r) - 1) < 0.28) {
        const Ap = Q[sr.i],
          Bp = Q[(sr.i + sr.w) % N];
        return semiFromChord(Ap, Bp, arc, true);
      }
    }

    let poly = cleanPoly(closedPoly(Q.concat([Q[0]]), diag * 0.055), L),
      k = poly.length;
    poly = reducePoly(poly, Q, diag);
    k = poly.length;
    if (k === 3) return triShape(poly);
    if (k === 4) {
      const r = quadShape(poly, Q);
      if (r) return r;
    }
    if (k === 5 || k === 6) {
      const r = regularPoly(poly, k);
      if (r) return r;
    }
    if (el.err < 0.1 && k <= 3) return ellipseShape(el, Q);
    return null;
  }

  function fitEllipse(Q) {
    const n = Q.length;
    let mx = 0,
      my = 0;
    Q.forEach(q => {
      mx += q.x;
      my += q.y;
    });
    mx /= n;
    my /= n;
    let sxx = 0,
      syy = 0,
      sxy = 0;
    Q.forEach(q => {
      const u = q.x - mx,
        v = q.y - my;
      sxx += u * u;
      syy += v * v;
      sxy += u * v;
    });
    const phi = 0.5 * Math.atan2(2 * sxy, sxx - syy),
      c = Math.cos(phi),
      s = Math.sin(phi);
    let u0 = 1e18,
      u1 = -1e18,
      v0 = 1e18,
      v1 = -1e18;
    const UV = Q.map(q => {
      const u = (q.x - mx) * c + (q.y - my) * s,
        v = -(q.x - mx) * s + (q.y - my) * c;
      if (u < u0) u0 = u;
      if (u > u1) u1 = u;
      if (v < v0) v0 = v;
      if (v > v1) v1 = v;
      return [u, v];
    });
    const a = (u1 - u0) / 2,
      b = (v1 - v0) / 2,
      cu = (u0 + u1) / 2,
      cv = (v0 + v1) / 2;
    let e = 0;
    UV.forEach(([u, v]) => {
      e += abs(hyp((u - cu) / (a || 1), (v - cv) / (b || 1)) - 1);
    });
    e /= n;
    return { cx: mx + cu * c - cv * s, cy: my + cu * s + cv * c, a, b, phi: deg(phi), err: e };
  }
  function ellipseShape(el, Q) {
    let { a, b, phi } = el;
    if (b > a) {
      const t = a;
      a = b;
      b = t;
      phi += 90;
    }
    phi = norm180(phi);
    if (b / a > 0.87) {
      const r = (a + b) / 2;
      return { s: 'ellipse', cx: el.cx, cy: el.cy, w: 2 * r, h: 2 * r, rot: 0, label: 'دائرة' };
    }
    let rot = phi;
    const m = wrap90(rot);
    if (abs(m) < 11) rot -= m;
    return { s: 'ellipse', cx: el.cx, cy: el.cy, w: 2 * a, h: 2 * b, rot: (rot * PI) / 180, label: 'بيضاوي' };
  }
  function semiFromArc(P, c, closed) {
    const arc = P,
      A = P[0],
      B = P[P.length - 1];
    return semiFromChord(A, B, arc, closed);
  }
  function semiFromChord(A, B, arc, closed) {
    const M = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 },
      D = hyp(B.x - A.x, B.y - A.y),
      ux = (B.x - A.x) / D,
      uy = (B.y - A.y) / D;
    let nx = -uy,
      ny = ux,
      best = 0,
      side = 1;
    arc.forEach(q => {
      const d = (q.x - M.x) * nx + (q.y - M.y) * ny;
      if (abs(d) > abs(best)) {
        best = d;
        side = d > 0 ? 1 : -1;
      }
    });
    nx *= side;
    ny *= side;
    let h = abs(best);
    if (abs(h - D / 2) < 0.16 * D) h = D / 2;
    let rot = (Math.atan2(nx, -ny) * 180) / PI;
    rot = snapRot(norm180(rot), 13);
    const r = (rot * PI) / 180,
      bx = M.x + (nx * h) / 2,
      by = M.y + (ny * h) / 2;
    return { s: 'semi', cx: bx, cy: by, w: D, h, rot: r, closed: !!closed, label: 'نصف دائرة' };
  }
  function triShape(v) {
    return polyShape(v, 'مثلث');
  }
  function quadShape(v, Q) {
    const bd = bbox(v),
      mids0 = [
        [bd.x0 + bd.w / 2, bd.y0],
        [bd.x1, bd.y0 + bd.h / 2],
        [bd.x0 + bd.w / 2, bd.y1],
        [bd.x0, bd.y0 + bd.h / 2]
      ];
    if (
      v.every(q => mids0.some(([mx, my]) => abs(q.x - mx) < 0.17 * bd.w && abs(q.y - my) < 0.17 * bd.h)) &&
      mids0.every(([mx, my]) => v.some(q => abs(q.x - mx) < 0.17 * bd.w && abs(q.y - my) < 0.17 * bd.h))
    )
      return {
        s: 'poly',
        cx: bd.x0 + bd.w / 2,
        cy: bd.y0 + bd.h / 2,
        w: bd.w,
        h: bd.h,
        rot: 0,
        pts: [
          [0.5, 0],
          [1, 0.5],
          [0.5, 1],
          [0, 0.5]
        ],
        closed: true,
        label: 'معيّن'
      };
    const ang = [],
      len = [];
    for (let i = 0; i < 4; i++) {
      const a = v[i],
        b = v[(i + 1) % 4],
        c = v[(i + 2) % 4];
      const u = { x: b.x - a.x, y: b.y - a.y },
        w = { x: c.x - b.x, y: c.y - b.y };
      ang.push(abs(deg(Math.atan2(u.x * w.y - u.y * w.x, u.x * w.x + u.y * w.y))));
      len.push(hyp(u.x, u.y));
    }
    const rightish = ang.every(a => abs(a - 90) < 20);
    if (rightish) {
      let sx = 0,
        sy = 0;
      for (let i = 0; i < 4; i++) {
        const a = Math.atan2(v[(i + 1) % 4].y - v[i].y, v[(i + 1) % 4].x - v[i].x) * 4;
        sx += Math.cos(a);
        sy += Math.sin(a);
      }
      let th = deg(Math.atan2(sy, sx)) / 4;
      th = norm180(th);
      const m = wrap90(th);
      let rotD = abs(m) < 9 ? th - m : th;
      rotD = wrap90(rotD) === rotD ? rotD : rotD;
      const cx0 = (v[0].x + v[1].x + v[2].x + v[3].x) / 4,
        cy0 = (v[0].y + v[1].y + v[2].y + v[3].y) / 4;
      const r = rotPts(v, { x: cx0, y: cy0 }, (-rotD * PI) / 180),
        b = bbox(r);
      let w = b.w,
        h = b.h,
        lbl = 'مستطيل';
      if (abs(w - h) < 0.16 * Math.max(w, h)) {
        w = h = (w + h) / 2;
        lbl = 'مربع';
      }
      return Object.assign({ s: 'rect', w, h, rot: (rotD * PI) / 180, label: lbl }, fixCenter(cx0, cy0, b, rotD));
    }

    const b = bbox(v),
      mids = [
        [b.x0 + b.w / 2, b.y0],
        [b.x1, b.y0 + b.h / 2],
        [b.x0 + b.w / 2, b.y1],
        [b.x0, b.y0 + b.h / 2]
      ];
    const dia = v.every(q => mids.some(([mx, my]) => abs(q.x - mx) < 0.2 * b.w && abs(q.y - my) < 0.2 * b.h));
    if (dia) {
      return {
        s: 'poly',
        cx: b.x0 + b.w / 2,
        cy: b.y0 + b.h / 2,
        w: b.w,
        h: b.h,
        rot: 0,
        pts: [
          [0.5, 0],
          [1, 0.5],
          [0.5, 1],
          [0, 0.5]
        ],
        closed: true,
        label: 'معيّن'
      };
    }
    const s = polyShape(v, 'شكل رباعي');
    const par =
      len[0] > 0 &&
      abs(len[0] - len[2]) / Math.max(len[0], len[2]) < 0.18 &&
      abs(len[1] - len[3]) / Math.max(len[1], len[3]) < 0.18;
    s.label = par ? 'متوازي أضلاع' : 'شكل رباعي';
    return s;
  }
  function fixCenter(cx0, cy0, b, rotD) {
    const mx = (b.x0 + b.x1) / 2,
      my = (b.y0 + b.y1) / 2,
      a = (rotD * PI) / 180,
      ca = Math.cos(a),
      sa = Math.sin(a);
    const dx = mx - cx0,
      dy = my - cy0;
    return { cx: cx0 + dx * ca - dy * sa, cy: cy0 + dx * sa + dy * ca };
  }
  function regularPoly(v, k) {
    let cx = 0,
      cy = 0;
    v.forEach(q => {
      cx += q.x;
      cy += q.y;
    });
    cx /= k;
    cy /= k;
    const rs = v.map(q => hyp(q.x - cx, q.y - cy)),
      mr = rs.reduce((a, b) => a + b, 0) / k;
    if (rs.some(r => abs(r - mr) / mr > 0.22)) return null;

    const as = v.map(q => Math.atan2(q.y - cy, q.x - cx)).sort((a, b) => a - b);
    let ok = true;
    for (let i = 0; i < k; i++) {
      const d = (as[(i + 1) % k] - as[i] + 2 * PI) % (2 * PI);
      if (abs(d - (2 * PI) / k) > 0.55 * ((2 * PI) / k)) ok = false;
    }
    if (!ok) return null;

    let top = 0;
    v.forEach((q, i) => {
      if (q.y < v[top].y) top = i;
    });
    const base = Math.atan2(v[top].y - cy, v[top].x - cx),
      pts = [];
    for (let i = 0; i < k; i++) {
      const a = -PI / 2 + (i * 2 * PI) / k;
      pts.push({ x: cx + mr * Math.cos(a), y: cy + mr * Math.sin(a) });
    }
    const s = polyShape(pts, k === 5 ? 'خماسي منتظم' : 'سداسي منتظم');
    return s;
  }

  function isTap(p, minD) {
    if (!p.length) return true;
    const b = bbox(p);
    return hyp(b.w, b.h) < (minD || 6);
  }

  const API = { recognize, isTap, fitCircle, pathLen, resample };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.Recog = API;
})(typeof window !== 'undefined' ? window : globalThis);
