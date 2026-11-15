(function () {
  'use strict';
  const EB = window.EB,
    S = EB.S,
    $ = EB.$,
    ar = EB.ar,
    esc = EB.esc,
    page = () => EB.page();
  const real = it => it.t !== 'link';

  EB.groupOf = it => (it.g ? page().items.filter(o => o.g === it.g) : [it]);

  const sub = id => {
    const L = page().items,
      seen = new Set([id]),
      r = [],
      q = [id];
    while (q.length) {
      const i = q.shift();
      L.forEach(o => {
        if (o.t === 'node' && o.par === i && !seen.has(o.id)) {
          seen.add(o.id);
          r.push(o);
          q.push(o.id);
        }
      });
      L.forEach(l => {
        if (l.t === 'link' && l.a === i && !seen.has(l.b)) {
          const o = L.find(x => x.id === l.b);
          if (o && o.t !== 'link') {
            seen.add(o.id);
            r.push(o);
            q.push(o.id);
          }
        }
      });
    }
    return r;
  };
  EB.subtree = it => [it, ...sub(it.id)];
  const inside = (f, o) => {
    if (o === f || o.t === 'link') return false;
    const b = EB.box(o),
      c = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    return c.x >= f.x && c.x <= f.x + f.w && c.y >= f.y && c.y <= f.y + f.h;
  };

  EB.carryOn = () => {
    try {
      return localStorage.getItem('rs_edu_carry') === '1';
    } catch (e) {
      return false;
    }
  };
  EB.carrySet = on => {
    try {
      localStorage.setItem('rs_edu_carry', on ? '1' : '0');
    } catch (e) {}
  };
  EB.carryFor = function (sel) {
    const out = new Set();
    sel.forEach(it => {
      if (it.t === 'frame')
        page().items.forEach(o => {
          if (inside(it, o)) out.add(o);
        });
      else if (it.t === 'node' && EB.carryOn() && sel.length === 1) sub(it.id).forEach(o => out.add(o));
    });
    sel.forEach(i => out.delete(i));
    return [...out];
  };
  EB.rewrap = function (items) {
    const L = page().items;
    items.forEach(i => {
      const k = L.indexOf(i);
      if (k > 0 && i.t === 'frame') {
        L.splice(k, 1);
        L.unshift(i);
      }
    });
  };

  EB.clusters = function () {
    const pg = page(),
      bs = [];
    if (pg.sheet && pg._sw) bs.push({ x: 0, y: 0, w: pg._sw, h: pg._sh, wt: 300 });
    pg.items
      .filter(i => EB.vis(i) && real(i) && !i.fd)
      .forEach(i => {
        const b = EB.box(i);
        bs.push({ x: b.x, y: b.y, w: b.w, h: b.h, wt: i.t === 'ink' ? 2 + (i.pts ? i.pts.length : 0) / 6 : 30 });
      });
    const cl = [];
    bs.forEach(b => {
      const c = { x0: b.x, y0: b.y, x1: b.x + b.w, y1: b.y + b.h, wt: b.wt };
      let m = true;
      while (m) {
        m = false;
        for (let i = 0; i < cl.length; i++) {
          const o = cl[i],
            g = 260;
          if (c.x0 - g < o.x1 && c.x1 + g > o.x0 && c.y0 - g < o.y1 && c.y1 + g > o.y0) {
            c.x0 = Math.min(c.x0, o.x0);
            c.y0 = Math.min(c.y0, o.y0);
            c.x1 = Math.max(c.x1, o.x1);
            c.y1 = Math.max(c.y1, o.y1);
            c.wt += o.wt;
            cl.splice(i, 1);
            m = true;
            break;
          }
        }
      }
      cl.push(c);
    });
    return cl.map(c => ({ x: c.x0, y: c.y0, w: c.x1 - c.x0, h: c.y1 - c.y0, wt: c.wt }));
  };
  EB.fitBox = function (b) {
    const W = innerWidth,
      avH = innerHeight - S.TOP - S.BOT - 16,
      k = Math.max(0.1, Math.min(1.2, (W - 40) / Math.max(40, b.w), avH / Math.max(40, b.h)));
    EB.go({ k, x: W / 2 - (b.x + b.w / 2) * k, y: S.TOP + 8 + (avH - b.h * k) / 2 - b.y * k });
  };
  EB.goDensest = function () {
    const c = EB.clusters().sort((a, b) => b.wt - a.wt)[0];
    if (!c) {
      EB.toast('لا يوجد محتوى بعد');
      return;
    }
    EB.fitBox(c);
  };
  const away = $('away');
  let awayTarget = null,
    lastKey = '';
  function checkAway() {
    const pg = page();
    if (!pg) return;
    const key = [S.V.x | 0, S.V.y | 0, (S.V.k * 100) | 0, pg.items.length, S.pi].join();
    if (key === lastKey) return;
    lastKey = key;
    const k = S.V.k,
      vw = innerWidth / k,
      vh = (innerHeight - S.TOP - S.BOT) / k,
      vx = -S.V.x / k,
      vy = (S.TOP - S.V.y) / k,
      mx = vw * 0.3,
      my = vh * 0.3;
    const cl = EB.clusters();
    if (!cl.length) {
      away.classList.remove('s');
      return;
    }
    if (cl.some(c => c.x < vx + vw + mx && c.x + c.w > vx - mx && c.y < vy + vh + my && c.y + c.h > vy - my)) {
      away.classList.remove('s');
      return;
    }
    const cx = vx + vw / 2,
      cy = vy + vh / 2;
    let best = null,
      bd = 1e18;
    cl.forEach(c => {
      const d = Math.hypot(c.x + c.w / 2 - cx, c.y + c.h / 2 - cy);
      if (d < bd) {
        bd = d;
        best = c;
      }
    });
    awayTarget = best;
    const a = Math.atan2(best.y + best.h / 2 - cy, best.x + best.w / 2 - cx),
      W = innerWidth,
      H = innerHeight,
      rx = W / 2 - 46,
      ry = (H - S.TOP - S.BOT) / 2 - 36,
      t = Math.min(rx / Math.max(0.001, Math.abs(Math.cos(a))), ry / Math.max(0.001, Math.abs(Math.sin(a))));
    away.style.left = W / 2 + Math.cos(a) * t - 26 + 'px';
    away.style.top = S.TOP + (H - S.TOP - S.BOT) / 2 + Math.sin(a) * t - 26 + 'px';
    away.querySelector('i').style.transform = `rotate(${(a * 180) / Math.PI + 90}deg)`;
    away.classList.add('s');
  }
  setInterval(checkAway, 220);
  away.onclick = () => {
    if (awayTarget) EB.fitBox(awayTarget);
  };
  $('zHome').onclick = () => EB.goDensest();

  EB.addFrame = function (items) {
    const L = page().items;
    let b,
      title = 'مجموعة';
    if (items && items.length) {
      b = EB.unionBox(items);
      const p = 50;
      b = { x: b.x - p, y: b.y - p - 10, w: b.w + 2 * p, h: b.h + 2 * p + 10 };
    } else {
      const c = EB.vc(),
        w = 760,
        h = 520;
      b = { x: c.x - w / 2, y: c.y - h / 2, w, h };
    }
    const f = { t: 'frame', id: EB.nid(), x: b.x, y: b.y, w: b.w, h: b.h, c: EB.COLORS[1], title, sn: S.sess };
    L.unshift(f);
    S.sel = [f];
    EB.setTool('select');
    EB.showAct();
    EB.commit();
    S.dirty = 1;
    return f;
  };

  EB.linkSel = function () {
    const [a, b] = S.sel.filter(real);
    if (!a || !b) return;
    const L = page().items;
    const ex = L.find(l => l.t === 'link' && ((l.a === a.id && l.b === b.id) || (l.a === b.id && l.b === a.id)));
    if (ex) {
      L.splice(L.indexOf(ex), 1);
      EB.toast('أُزيل الرابط');
    } else {
      L.push({ t: 'link', id: EB.nid(), a: a.id, b: b.id, c: S.color, lw: 5, ar: 0, sn: S.sess });
      EB.toast('تم الربط');
    }
    S.dirty = 1;
    EB.commit();
  };

  EB.arrangePop = function (anchor) {
    const pop = $('pop');
    const B = [
      ['al', 'ti-align-left', 'محاذاة لليمين'],
      ['ac', 'ti-align-center', 'توسيط أفقي'],
      ['am', 'ti-align-box-center-middle', 'توسيط رأسي'],
      ['at', 'ti-align-box-top-center', 'محاذاة للأعلى'],
      ['dh', 'ti-layout-distribute-horizontal', 'توزيع أفقي'],
      ['dv', 'ti-layout-distribute-vertical', 'توزيع رأسي'],
      ['gr', 'ti-grid-dots', 'شبكة'],
      ['rw', 'ti-arrows-horizontal', 'صف'],
      ['cl', 'ti-columns', 'عمود']
    ];
    EB.openPop(
      `<div class="arr">${B.map(b => `<button data-ar="${b[0]}" title="${b[2]}"><i class="ti ${b[1]}"></i><span>${b[2]}</span></button>`).join('')}</div>`,
      anchor,
      { mode: 'arr', title: 'ترتيب المحدد' }
    );
    pop._on = e => {
      const b = e.target.closest('[data-ar]');
      if (!b) return;
      arrange(b.dataset.ar);
      EB.closePop();
    };
  };
  function arrange(op) {
    const it = S.sel.filter(i => real(i) && i.t !== 'frame');
    if (it.length < 2) return;
    const bx = it.map(i => [i, EB.box(i)]),
      U = EB.unionBox(it),
      mv = (i, dx, dy) => {
        EB.move(i, dx, dy);
        if (i.t === 'wid') EB.W.place(i);
      };
    if (op === 'al') bx.forEach(([i, b]) => mv(i, U.x + U.w - (b.x + b.w), 0));
    if (op === 'ac') bx.forEach(([i, b]) => mv(i, U.x + U.w / 2 - (b.x + b.w / 2), 0));
    if (op === 'am') bx.forEach(([i, b]) => mv(i, 0, U.y + U.h / 2 - (b.y + b.h / 2)));
    if (op === 'at') bx.forEach(([i, b]) => mv(i, 0, U.y - b.y));
    const gap = 40;
    if (op === 'dh') {
      bx.sort((a, b) => a[1].x - b[1].x);
      const tot = bx.reduce((s, [, b]) => s + b.w, 0),
        g = (U.w - tot) / (bx.length - 1);
      let x = U.x;
      bx.forEach(([i, b]) => {
        mv(i, x - b.x, 0);
        x += b.w + g;
      });
    }
    if (op === 'dv') {
      bx.sort((a, b) => a[1].y - b[1].y);
      const tot = bx.reduce((s, [, b]) => s + b.h, 0),
        g = (U.h - tot) / (bx.length - 1);
      let y = U.y;
      bx.forEach(([i, b]) => {
        mv(i, 0, y - b.y);
        y += b.h + g;
      });
    }
    if (op === 'rw') {
      bx.sort((a, b) => b[1].x - a[1].x);
      let x = U.x + U.w;
      bx.forEach(([i, b]) => {
        mv(i, x - b.w - b.x, U.y - b.y);
        x -= b.w + gap;
      });
    }
    if (op === 'cl') {
      bx.sort((a, b) => a[1].y - b[1].y);
      let y = U.y;
      bx.forEach(([i, b]) => {
        mv(i, U.x - b.x, y - b.y);
        y += b.h + gap;
      });
    }
    if (op === 'gr') {
      bx.sort((a, b) => a[1].y - b[1].y || b[1].x - a[1].x);
      const n = Math.ceil(Math.sqrt(bx.length)),
        cw = Math.max(...bx.map(([, b]) => b.w)) + gap,
        ch = Math.max(...bx.map(([, b]) => b.h)) + gap;
      bx.forEach(([i, b], k) => {
        const c = k % n,
          r = Math.floor(k / n);
        mv(
          i,
          U.x + U.w - (c + 1) * cw + gap - b.x - ((b.w - (cw - gap)) / 2) * 0 + (cw - gap - b.w) / 2,
          U.y + r * ch - b.y
        );
      });
    }
    S.dirty = 1;
    EB.commit();
    EB.showAct();
  }

  const COL = () => EB.COLORS,
    nid = () => EB.nid();
  EB.template = function (k) {
    const c = EB.vc(),
      L = page().items,
      C = COL(),
      N = o => Object.assign({ t: 'node', id: nid(), w: 150, sn: S.sess }, o);
    let root = N({
      root: 1,
      w: 210,
      c: C[0],
      text: k === 'flow' ? 'الخطوة ١' : k === 'tree' ? 'العنوان' : 'الفكرة الرئيسية',
      x: c.x - 105,
      y: c.y - 30
    });
    if (k === 'mind') {
      L.push(root);
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        L.push(
          N({
            par: root.id,
            w: 150,
            c: C[1 + (i % 5)],
            text: 'فرع ' + ar(i + 1),
            x: c.x + Math.cos(a) * 200 - 75,
            y: c.y + Math.sin(a) * 260 - 28
          })
        );
      }
    } else if (k === 'tree') {
      root.y = c.y - 300;
      L.push(root);
      for (let i = 0; i < 3; i++) {
        const x = c.x + (1 - i) * 200 - 75,
          ch = N({ par: root.id, c: C[1 + i], text: 'فرع ' + ar(i + 1), x, y: c.y - 120 });
        L.push(ch);
        for (let j = 0; j < 2; j++) L.push(N({ par: ch.id, c: ch.c, text: 'تفصيل', x, y: c.y + 40 + j * 110 }));
      }
    } else if (k === 'flow') {
      root.x = c.x + 330;
      root.root = 0;
      root.ns = 'p';
      root.c = C[1];
      L.push(root);
      let p = root;
      for (let i = 1; i < 4; i++) {
        const n = N({
          par: p.id,
          ns: 'p',
          c: C[1 + i],
          text: 'الخطوة ' + ar(i + 1),
          x: c.x + 330 - i * 220,
          y: c.y - 30
        });
        L.push(n);
        p = n;
      }
    } else if (k === 'cmp') {
      root.text = 'مقارنة';
      root.y = c.y - 260;
      L.push(root);
      [
        ['الأول', C[1], 1],
        ['الثاني', C[3], -1]
      ].forEach(([t, col, s]) => {
        const h = N({ par: root.id, c: col, w: 230, text: t, x: c.x + s * 150 - 115, y: c.y - 120 });
        L.push(h);
        for (let j = 0; j < 3; j++)
          L.push(N({ par: h.id, c: col, w: 230, ns: 'o', text: 'نقطة', x: c.x + s * 150 - 115, y: c.y + j * 100 }));
      });
    }
    S.sel = [root];
    EB.setTool('select');
    EB.showAct();
    EB.commit();
    S.dirty = 1;
    EB.toast('انقر مرتين على أي عقدة للكتابة. يتحرك العنوان وحده؛ فعّل «معها فروعها» لتحريك الشجرة كاملة.', 3600);
  };

  EB.imageNet = async function (files) {
    if (!files.length) return;
    EB.toast('جارٍ تجهيز الصور…', 15000);
    const c = EB.vc(),
      L = page().items,
      n = files.length,
      R = 190 + n * 26;
    const root = {
      t: 'node',
      id: nid(),
      root: 1,
      w: 220,
      c: COL()[0],
      text: 'الفكرة',
      x: c.x - 110,
      y: c.y - 30,
      sn: S.sess
    };
    L.push(root);
    const made = [root];
    for (let i = 0; i < n; i++) {
      try {
        const im = await EB.readImage(files[i], 900),
          a = await EB.addAsset(im.url),
          w = 220,
          h = (w * im.h) / im.w,
          ang = -Math.PI / 2 + (i * 2 * Math.PI) / n,
          it = {
            t: 'img',
            id: nid(),
            a,
            x: c.x + Math.cos(ang) * R * 1.25 - w / 2,
            y: c.y + Math.sin(ang) * R - h / 2,
            w,
            h,
            sn: S.sess
          };
        L.push(it);
        L.push({ t: 'link', id: nid(), a: root.id, b: it.id, c: COL()[1 + (i % 5)], lw: 5, ar: 0, sn: S.sess });
      } catch (e) {}
    }
    S.sel = [root];
    EB.setTool('select');
    EB.showAct();
    EB.commit();
    EB.fit();
    S.dirty = 1;
    EB.toast('اربط أي عنصرين بتحديدهما ثم «ربط». اسحب الصور لتحريكها.', 3600);
  };
  const fNet = document.createElement('input');
  fNet.type = 'file';
  fNet.accept = 'image/*';
  fNet.multiple = true;
  fNet.hidden = true;
  document.body.appendChild(fNet);
  fNet.onchange = e => {
    const f = [...e.target.files];
    e.target.value = '';
    EB.imageNet(f.slice(0, 16));
  };

  const SHAPES = [
    ['rect', 'ti-square', 'مستطيل'],
    ['ellipse', 'ti-circle', 'دائرة'],
    ['tri', 'ti-triangle', 'مثلث'],
    ['diamond', 'ti-square-rotated', 'معين'],
    ['semi', 'ti-circle-half-2', 'نصف دائرة'],
    ['pent', 'ti-pentagon', 'خماسي'],
    ['hex', 'ti-hexagon', 'سداسي'],
    ['star', 'ti-star', 'نجمة'],
    ['arrow', 'ti-arrow-narrow-right', 'سهم'],
    ['line', 'ti-line', 'خط'],
    ['polyline', 'ti-chart-line', 'خط منكسر']
  ];
  let use = {};
  try {
    use = JSON.parse(localStorage.getItem('rs_edu_stk') || '{}');
  } catch (e) {}

  const QI = {
    mcq: 'ti-list-check',
    tf: 'ti-circle-check',
    match: 'ti-arrows-shuffle',
    flip: 'ti-cards',
    order: 'ti-arrows-sort',
    blank: 'ti-text-caption',
    cls: 'ti-layout-columns',
    wheel: 'ti-ferry',
    timer: 'ti-hourglass',
    hukm: 'ti-scale',
    reveal: 'ti-list-numbers'
  };
  const MAPS = [
    ['mind', 'ti-hierarchy-2', 'خريطة ذهنية'],
    ['tree', 'ti-binary-tree-2', 'شجرة'],
    ['flow', 'ti-list-numbers', 'تسلسل خطوات'],
    ['cmp', 'ti-columns', 'مقارنة']
  ];
  const tile = (attr, ic, t, c) =>
    `<button class="ins-t" ${attr}${c ? ' data-c="' + c + '"' : ''}><i class="ti ${ic}"></i>${t}</button>`;

  const REG = () => {
    const QN = EB.QNAMES,
      r = [
        ['a:text', 'w', 'ti-letter-t', 'نص'],
        ['a:frame', 'w', 'ti-box-multiple', 'مجموعة']
      ];
    SHAPES.forEach(x => r.push(['sh:' + x[0], 's', x[1], x[2]]));
    r.push(
      ['a:img', 'm', 'ti-photo', 'صورة'],
      ['a:book', 'm', 'ti-book-2', 'من كتاب'],
      ['a:file', 'm', 'ti-file-import', 'ملف / PDF'],
      ['a:net', 'm', 'ti-layout-grid', 'شبكة صور']
    );
    Object.keys(QN).forEach(k => r.push(['q:' + k, 'q', QI[k] || 'ti-help-circle', QN[k]]));
    MAPS.forEach(x => r.push(['a:' + x[0], 'g', x[1], x[2]]));
    return r;
  };
  const CATS = { w: 'كتابة', s: 'أشكال', m: 'وسائط', q: 'أسئلة وتمارين', g: 'مخططات' };
  let FAV = null;
  const favLoad = () => {
    if (FAV) return FAV;
    try {
      FAV = JSON.parse(localStorage.getItem('rs_edu_ins_fav') || 'null');
    } catch (e) {}
    if (!Array.isArray(FAV)) FAV = ['a:text', 'a:img', 'a:book', 'sh:rect', 'sh:polyline', 'q:mcq'];
    return FAV;
  };
  const favSave = () => {
    try {
      localStorage.setItem('rs_edu_ins_fav', JSON.stringify(FAV));
    } catch (e) {}
  };
  const attrOf = k => {
    const [t, v] = k.split(':');
    return (t === 'sh' ? 'data-sh' : t === 'q' ? 'data-q' : 'data-a') + '="' + v + '"';
  };
  EB.insertSheet = function (tab, edit) {
    tab = tab || 'w';
    const keys = Object.keys(EB.STK).sort((a, b) => (use[b] || 0) - (use[a] || 0)),
      R = REG(),
      by = {};
    R.forEach(x => (by[x[0]] = x));
    favLoad();
    edit = !!edit;
    const stk = ks =>
      ks
        .map(k => `<button class="stk" data-stk="${k}"><canvas width="96" height="96" data-k="${k}"></canvas></button>`)
        .join('');
    const T = x =>
      edit
        ? `<button class="ins-t${FAV.includes(x[0]) ? ' fv' : ''}" data-c="${x[1]}" data-fav="${x[0]}"><i class="ti ${x[2]}"></i>${x[3]}<em class="star"><i class="ti ti-star${FAV.includes(x[0]) ? '-filled' : ''}"></i></em></button>`
        : tile(attrOf(x[0]), x[2], x[3], x[1]);
    const sec = (t, inner, extra) => `<div class="kg-t ins-h">${t}${extra || ''}</div>${inner}`;
    const parts = () => {
      let h = '';
      if (edit) {
        h += `<div class="ins-ed"><i class="ti ti-star"></i><span>اضغط على أي عنصر لإضافته إلى اختصاراتك أو إزالته منها، واسحب المقبض لترتيبها.</span></div>`;
        h += sec(
          'ترتيب اختصاراتي',
          FAV.length
            ? `<div class="kg tl ord" id="favOrd">${FAV.filter(k => by[k])
                .map(
                  (k, n) =>
                    `<div class="tr" data-i="${n}" data-k="${k}"><i class="ti ti-grip-vertical grip"></i><i class="ti ${by[k][2]}"></i><span class="tt">${by[k][3]}</span><button class="eye" data-fav="${k}" aria-label="إزالة"><i class="ti ti-x"></i></button></div>`
                )
                .join('')}</div>`
            : '<p class="n" style="margin:0 4px">لا اختصارات بعد.</p>',
          ''
        );
      } else if (FAV.length)
        h += sec(
          'اختصاراتي',
          `<div class="ins-g">${FAV.filter(k => by[k])
            .map(k => tile(attrOf(k), by[k][2], by[k][3], by[k][1]))
            .join('')}</div>`
        );
      Object.keys(CATS).forEach(c => {
        h += sec(
          CATS[c],
          `<div class="ins-g">${R.filter(x => x[1] === c)
            .map(T)
            .join('')}</div>`
        );
      });
      if (!edit)
        h += sec(
          'ملصقات',
          `<div class="ins-st" id="stkBox">${stk(keys.slice(0, 12))}</div>`,
          keys.length > 12 ? '<button class="lnk" data-more>عرض الجميع</button>' : ''
        );
      return h;
    };
    const draw = () =>
      $('shB')
        .querySelectorAll('canvas[data-k]')
        .forEach(c => EB.drawStk(c.getContext('2d'), c.dataset.k, 4, 4, 88));
    const render = () => {
      const sc = $('shB').scrollTop;
      $('shB').innerHTML = parts();
      draw();
      $('shT').innerHTML = edit
        ? 'تخصيص الاختصارات'
        : 'إدراج <button class="lnk ins-edit" data-edit><i class="ti ti-star"></i> تخصيص</button>';
      $('shB').scrollTop = sc;
      const o = $('favOrd');
      if (o)
        EB.dragSort(o, '.tr', ord => {
          const ks = [...o.querySelectorAll('.tr')].map(r => r.dataset.k);
          FAV = ord.map(i => ks[i]).filter(Boolean);
          favSave();
          render();
        });
    };
    EB.sheet('إدراج', '', null, e => {
      const b = e.target.closest('button');
      if (!b) return;
      const d = b.dataset;
      if (d.edit !== undefined) {
        edit = !edit;
        $('shF').style.display = edit ? 'flex' : 'none';
        $('shF').innerHTML = edit ? '<button class="pri" data-done>تم</button>' : '';
        render();
        return;
      }
      if (d.done !== undefined) {
        edit = false;
        $('shF').style.display = 'none';
        render();
        return;
      }
      if (d.fav) {
        FAV = FAV.includes(d.fav) ? FAV.filter(x => x !== d.fav) : FAV.concat(d.fav);
        favSave();
        render();
        return;
      }
      if (d.a === 'book') {
        EB.closeSheet();
        EB.bookPicker({ append: !!(page().sheet && page().sheet.kind === 'book') });
        return;
      }
      if (d.a === 'file') {
        EB.closeSheet();
        $('fDoc').click();
        return;
      }
      if (d.a === 'mind') {
        EB.closeSheet();
        EB.mindChooser();
        return;
      }
      if (d.more !== undefined) {
        $('stkBox').innerHTML = stk(keys);
        draw();
        b.remove();
        return;
      }
      if (d.sh) {
        EB.closeSheet();
        EB.addShape(d.sh);
        EB.setTool('select');
      } else if (d.stk) {
        use[d.stk] = (use[d.stk] || 0) + 1;
        try {
          localStorage.setItem('rs_edu_stk', JSON.stringify(use));
        } catch (er) {}
        EB.closeSheet();
        EB.addStk(d.stk);
      } else if (d.q) {
        EB.closeSheet();
        EB.questionEditor(d.q, null);
      } else if (d.a === 'text') {
        EB.closeSheet();
        EB.setTool('select');
        EB.addText();
      } else if (d.a === 'img') {
        EB.closeSheet();
        $('fImg').click();
      } else if (d.a === 'frame') {
        EB.closeSheet();
        EB.addFrame();
      } else if (d.a === 'net') {
        EB.closeSheet();
        fNet.click();
      } else if (['tree', 'flow', 'cmp'].includes(d.a)) {
        EB.closeSheet();
        EB.template(d.a);
      }
    });
    render();
    if (tab !== 'w') {
      const h = [...$('shB').querySelectorAll('.ins-h')].find(x =>
        x.textContent.startsWith({ m: 'وسائط', q: 'أسئلة', g: 'مخططات' }[tab])
      );
      if (h)
        setTimeout(() => {
          $('shB').scrollTop = h.offsetTop - 8;
        }, 30);
    }
  };

  EB.xPage = () => {
    try {
      return localStorage.getItem('rs_edu_xp') === '1';
    } catch (e) {
      return false;
    }
  };
  EB.pickDoc = function () {
    const fm = (ic, t, sm) =>
      `<div class="kr"><i class="ti ${ic}"></i><span class="kt">${t}<small>${sm}</small></span></div>`;
    const h = `<div class="kg-t">الملفات المدعومة</div><div class="kg">${fm('ti-file-type-pdf', 'PDF وصور', 'الأدق: تُعرض الصفحات كما هي لتكتب عليها')}${fm('ti-presentation', 'عرض PowerPoint', 'تُستخرج الشرائح في صفحات قابلة للشرح')}${fm('ti-file-text', 'Word وملفات نصية', 'يُستخرج النص في صفحات قابلة للكتابة')}</div>
    <div class="kg-t">خيارات</div><div class="kg"><button class="kr sw" data-xp role="switch" aria-checked="${EB.xPage()}"><i class="ti ti-file-plus"></i><span class="kt">صفحة بيضاء بعد كل صفحة<small>مساحة جاهزة للشرح بعد كل صفحة من الملف</small></span><span class="ksw${EB.xPage() ? ' on' : ''}"></span></button></div>`;
    EB.sheet(
      'إرفاق ملف',
      h,
      '<button data-x>إلغاء</button><button class="pri" data-pk><i class="ti ti-upload"></i> اختر الملف</button>',
      e => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.xp !== undefined) {
          const v = !EB.xPage();
          try {
            localStorage.setItem('rs_edu_xp', v ? '1' : '0');
          } catch (er) {}
          b.setAttribute('aria-checked', v);
          b.querySelector('.ksw').classList.toggle('on', v);
        } else if (b.dataset.x !== undefined) EB.closeSheet();
        else if (b.dataset.pk !== undefined) {
          EB.closeSheet();
          $('fDoc').click();
        }
      }
    );
  };
  async function unzip(buf) {
    const dv = new DataView(buf),
      u8 = new Uint8Array(buf);
    let e = u8.length - 22;
    while (e > 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
    const n = dv.getUint16(e + 10, true);
    let p = dv.getUint32(e + 16, true);
    const out = {};
    for (let i = 0; i < n; i++) {
      const m = dv.getUint16(p + 10, true),
        cs = dv.getUint32(p + 20, true),
        nl = dv.getUint16(p + 28, true),
        xl = dv.getUint16(p + 30, true),
        cl = dv.getUint16(p + 32, true),
        lo = dv.getUint32(p + 42, true),
        name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nl));
      p += 46 + nl + xl + cl;
      if (!/^(ppt\/slides\/slide\d+\.xml|word\/document\.xml)$/.test(name)) continue;
      const ln = dv.getUint16(lo + 26, true),
        lx = dv.getUint16(lo + 28, true),
        data = u8.subarray(lo + 30 + ln + lx, lo + 30 + ln + lx + cs);
      out[name] =
        m === 0
          ? new TextDecoder().decode(data)
          : await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
    }
    return out;
  }
  const textPage = (title, paras, n) => {
    const html = paras.map(t => `<div class="mb">${esc(t)}</div>`).join(''),
      sheet = {
        kind: 'book',
        book: '',
        title,
        html,
        body: paras.join('\n'),
        mode: 'text',
        hid: [],
        fs: 30,
        lh: 2.1,
        col: document.documentElement.dataset.theme === 'dark' ? '#1e1926' : '#ffffff',
        gloss: false
      };
    return EB.newPage({ type: 'doc', title: String(title).slice(0, 22), sheet, grid: 'dots' });
  };
  EB.importText = async function (f) {
    const nm = f.name.replace(/\.[^.]+$/, ''),
      pages = [];
    if (/\.(txt|md)$/i.test(f.name) || f.type.startsWith('text/')) {
      const t = (await f.text())
        .replace(/\r/g, '')
        .split(/\n{2,}/)
        .map(s => s.trim())
        .filter(Boolean);
      for (let i = 0; i < t.length; i += 6)
        pages.push(textPage(nm + (i ? ' ' + ar(i / 6 + 1) : ''), t.slice(i, i + 6)));
    } else if (/\.(pptx|docx)$/i.test(f.name)) {
      if (!window.DecompressionStream) return false;
      EB.toast('جارٍ قراءة الملف…', 15000);
      const z = await unzip(await f.arrayBuffer()),
        dec = s =>
          s
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'")
            .replace(/&amp;/g, '&');
      if (/\.pptx$/i.test(f.name)) {
        Object.keys(z)
          .sort((a, b) => parseInt(a.match(/\d+/)) - parseInt(b.match(/\d+/)))
          .forEach((k, i) => {
            const paras = (z[k].match(/<a:p>[\s\S]*?<\/a:p>|<a:p [\s\S]*?<\/a:p>/g) || [])
              .map(p => dec((p.match(/<a:t[^>]*>([^<]*)<\/a:t>/g) || []).map(t => t.replace(/<[^>]+>/g, '')).join('')))
              .filter(s => s.trim());
            pages.push(textPage('شريحة ' + ar(i + 1), paras.length ? paras : ['(شريحة بلا نص — صور أو أشكال فقط)']));
          });
      } else {
        const paras = (z['word/document.xml'] || '').match(/<w:p[ >][\s\S]*?<\/w:p>/g) || [],
          t = paras
            .map(p => dec((p.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || []).map(x => x.replace(/<[^>]+>/g, '')).join('')))
            .filter(s => s.trim());
        for (let i = 0; i < t.length; i += 6) pages.push(textPage(nm + ' ' + ar(i / 6 + 1), t.slice(i, i + 6)));
      }
    } else return false;
    if (!pages.length) {
      EB.toast('لم يُعثر على نص في الملف');
      return true;
    }
    const first = S.pi + 1;
    let ix = S.pi;
    pages.forEach(pg => {
      S.lesson.pages.splice(++ix, 0, pg);
      EB.initHist(pg);
      if (EB.xPage()) {
        const b = EB.newPage({ title: 'ورقة شرح', grid: 'dots' });
        S.lesson.pages.splice(++ix, 0, b);
        EB.initHist(b);
      }
    });
    EB.gotoPage(first);
    EB.save();
    EB.toast('أُضيف ' + ar(pages.length) + ' صفحة. للشكل الكامل للعروض احفظها PDF.', 4000);
    return true;
  };

  EB.addPageSheet = function (open) {
    const QN = EB.QNAMES;
    let paper = 'dots';
    const row = (a, i, t, sm) =>
      `<button class="kr" data-a="${a}"><i class="ti ${i}"></i><span class="kt">${t}<small>${sm}</small></span><i class="ti ti-chevron-left kc"></i></button>`;
    const h = `<div class="kg">${row('blank', 'ti-file-plus', 'ورقة بيضاء', 'سبورة حرة للكتابة والرسم')}
      <div class="ap-paper"><div class="fl">نوع الورقة</div><div class="kchips">${EB.GRIDS.map(g => `<button class="kchip ${g[0] === paper ? 'on' : ''}" data-paper="${g[0]}">${g[1]}</button>`).join('')}</div></div>
      ${row('book', 'ti-book-2', 'من كتاب', 'اختر الكتاب ثم الفصل أو المسائل')}${row('file', 'ti-file-import', 'من ملف', 'PDF · PowerPoint · Word · صور · نص')}
      ${row('qpage', 'ti-list-check', 'صفحة سؤال', 'اختيار · صح/خطأ · توصيل · ترتيب · …')}${row('mpage', 'ti-hierarchy-2', 'خريطة أو مخطط', 'ذهنية · شجرة · تسلسل · مقارنة')}</div>`;
    const sub = (title, items, attr) => {
      $('shT').textContent = title;
      $('shB').innerHTML =
        `<button class="kr back" data-back><i class="ti ti-chevron-right"></i><span class="kt">رجوع</span></button><div class="ins-g" style="margin-top:10px">${items.map(x => tile(attr + '="' + x[0] + '"', x[1], x[2])).join('')}</div>`;
    };
    EB.sheet('صفحة جديدة', h, null, e => {
      const b = e.target.closest('button');
      if (!b) return;
      const d = b.dataset;
      if (d.paper) {
        paper = d.paper;
        b.parentNode.querySelectorAll('.kchip').forEach(x => x.classList.toggle('on', x === b));
        return;
      }
      if (d.back !== undefined) {
        EB.addPageSheet();
        return;
      }
      if (d.a === 'qpage') {
        sub(
          'صفحة سؤال',
          Object.keys(QN).map(k => [k, QI[k] || 'ti-help-circle', QN[k]]),
          'data-q'
        );
        return;
      }
      if (d.a === 'mpage') {
        sub('خريطة أو مخطط', MAPS, 'data-m');
        return;
      }
      if (d.a === 'blank') {
        EB.closeSheet();
        EB.addPage(EB.newPage({ grid: paper }));
        S.color = EB.inkFor();
        EB.refreshUI();
      } else if (d.q) {
        EB.closeSheet();
        EB.questionEditor(d.q, null, true);
      } else if (d.a === 'book') {
        EB.closeSheet();
        EB.bookPicker();
      } else if (d.a === 'file') {
        EB.closeSheet();
        EB.pickDoc();
      } else if (d.m) {
        EB.closeSheet();
        EB.addPage(EB.newPage({ title: 'خريطة', grid: 'dots' }));
        if (d.m === 'mind') EB.mindChooser();
        else EB.template(d.m);
        EB.fit();
      }
    });
    if (open === 'q') $('shB').querySelector('[data-a=qpage]').click();
  };

  EB.syncParts = function (sh) {
    sh.html = EB.partsHtml(sh.parts);
    sh.title = sh.parts.length
      ? sh.parts.length > 1
        ? sh.parts[0].title + ' (+' + ar(sh.parts.length - 1) + ')'
        : sh.parts[0].title
      : '';
    sh.hid = [];
    sh._u = null;
    sh.body = sh.parts.map(p => p.body || '').join('\n');
    EB.rebuildSheet();
    S.dirty = 1;
  };
  EB.partsSheet = function () {
    const sh = page().sheet;
    if (!sh || sh.kind !== 'book') return;
    if (!sh.parts) sh.parts = [{ title: sh.title, html: sh.html || '', body: sh.body || '' }];
    const P = sh.parts,
      rend = () => {
        $('shB').innerHTML =
          `<div class="kg tl ord">${P.map((p, n) => `<div class="tr" data-i="${n}"><i class="ti ti-grip-vertical grip"></i><span class="pn">${ar(n + 1)}</span><span class="tt">${esc(p.title)}</span><button class="eye" data-sp="${n}" ${P.length > 1 ? '' : 'disabled'} aria-label="نقل إلى صفحة مستقلة"><i class="ti ti-file-export"></i></button><button class="eye dngc" data-rm="${n}" ${P.length > 1 ? '' : 'disabled'} aria-label="حذف"><i class="ti ti-x"></i></button></div>`).join('')}</div><button class="kr add" data-add style="margin-top:12px"><i class="ti ti-plus"></i><span class="kt">إضافة من كتاب<small>أضف فصلاً أو مسائل إلى هذه الصفحة</small></span></button><p class="n" style="margin:10px 4px 0">اسحب المقبض لإعادة الترتيب. أيقونة الملف تنقل العنصر إلى صفحة جديدة بعد هذه الصفحة.</p>`;
        EB.dragSort($('shB').querySelector('.ord'), '.tr', ord => {
          const N = ord.map(k => P[k]);
          P.splice(0, P.length, ...N);
          EB.syncParts(sh);
          EB.save();
          rend();
        });
      };
    EB.sheet('ترتيب محتوى الصفحة', '', '<button class="pri" data-ok>تم</button>', e => {
      const b = e.target.closest('button');
      if (!b) return;
      const d = b.dataset;
      if (d.ok !== undefined) {
        EB.closeSheet();
        return;
      }
      if (d.add !== undefined) {
        EB.closeSheet();
        EB.bookPicker({ append: true });
        return;
      }
      if (d.rm !== undefined) P.splice(+d.rm, 1);
      else if (d.sp !== undefined) {
        const x = P.splice(+d.sp, 1)[0],
          ns = Object.assign({}, sh, { parts: [x], gl: sh.gl });
        ns.html = x.html;
        ns.title = x.title;
        ns.body = x.body || '';
        ns.hid = [];
        ns._u = null;
        const pg = EB.newPage({ type: 'book', title: x.title.slice(0, 22), sheet: ns, grid: page().grid });
        S.lesson.pages.splice(S.pi + 1, 0, pg);
        EB.initHist(pg);
        EB.toast('نُقل إلى صفحة جديدة بعد هذه');
      } else return;
      EB.syncParts(sh);
      EB.save();
      rend();
    });
    rend();
  };

  EB.zWids = function () {
    EB.layout(true);
  };
  EB.layerPop = function (anchor) {
    const pop = $('pop');
    const B = [
      ['front', 'ti-stack-front', 'أمام الكل'],
      ['fwd', 'ti-layers-subtract', 'للأمام خطوة'],
      ['bwd', 'ti-layers-intersect', 'للخلف خطوة'],
      ['back', 'ti-stack-back', 'خلف الكل']
    ];
    EB.openPop(
      `<div class="arr">${B.map(b => `<button data-ly="${b[0]}"><i class="ti ${b[1]}"></i><span>${b[2]}</span></button>`).join('')}</div><p class="pp-n">الترتيب يشمل البطاقات والأسئلة والرسم معاً. «خطوة» تتجاوز أقرب عنصر يتداخل معه.</p>`,
      anchor,
      { mode: 'lay', title: 'ترتيب الطبقات' }
    );
    pop._on = e => {
      const b = e.target.closest('[data-ly]');
      if (!b) return;
      const L = page().items,
        its = L.filter(x => S.sel.includes(x)),
        op = b.dataset.ly;
      if (op === 'front') {
        its.forEach(i => {
          L.splice(L.indexOf(i), 1);
          L.push(i);
        });
      } else if (op === 'back') {
        its
          .slice()
          .reverse()
          .forEach(i => {
            L.splice(L.indexOf(i), 1);
            L.unshift(i);
          });
      } else {
        const dir = op === 'fwd' ? 1 : -1,
          hit = (a, c) => {
            const A = EB.box(a),
              B = EB.box(c);
            return A.x < B.x + B.w && B.x < A.x + A.w && A.y < B.y + B.h && B.y < A.y + A.h;
          };
        (dir > 0 ? its.slice().reverse() : its).forEach(i => {
          let n = L.indexOf(i),
            j = n + dir;
          while (j >= 0 && j < L.length && (its.includes(L[j]) || !EB.vis(L[j]) || L[j].t === 'link' || !hit(i, L[j])))
            j += dir;
          if (j < 0 || j >= L.length) return;
          L.splice(n, 1);
          L.splice(j, 0, i);
        });
      }
      EB.zWids();
      S.dirty = 1;
      EB.commit();
      EB.toast(b.textContent.trim());
    };
  };

  EB.stylePop = function (anchor, tgt) {
    if (!tgt) return;
    const pop = $('pop');
    let opened = false;
    const items = S.sel.filter(x => ['shape', 'line', 'link'].includes(x.t)),
      ds = () => (tgt.ds != null ? tgt.ds : tgt.d ? 1 : 0);
    const LS3 = [
        [0, 'متصل', ''],
        [1, 'متقطع', '9 7'],
        [2, 'منقّط', '0.1 7']
      ],
      pct = (v, lo, hi) => Math.round(((v - lo) / (hi - lo)) * 100);
    const rend = () => {
      const lw = Math.round((tgt.lw || 4) * 2) / 2,
        lwMax = Math.max(24, Math.ceil(lw * 2)),
        op = Math.round((tgt.op == null ? 1 : tgt.op) * 100),
        closed = !(tgt.t === 'shape' && tgt.closed === false && tgt.s === 'poly');
      const html = `<div class="pp-t">نمط الخط</div>
      <div class="kseg lsty">${LS3.map(x => `<button data-ds="${x[0]}" class="${ds() === x[0] ? 'on' : ''}"><svg viewBox="0 0 60 8"><path d="M2 4H58" stroke="currentColor" stroke-width="3" stroke-linecap="round"${x[2] ? ` stroke-dasharray="${x[2]}"` : ''}/></svg><span>${x[1]}</span></button>`).join('')}</div>
      ${tgt.t === 'link' ? '' : `<div class="pp-r"><span>حجم الشكل</span><input class="krg" type="range" data-sz min="25" max="300" step="5" value="100" style="--p:${pct(100, 25, 300)}%"><b data-v="sz">١٠٠٪</b></div>`}
      <div class="pp-r"><span>السماكة</span><input class="krg" type="range" data-lw min="1" max="${lwMax}" step="1" value="${lw}" style="--p:${pct(lw, 1, lwMax)}%"><b data-v="lw">${EB.ar(Math.round(lw))}</b></div>
      <div class="pp-r"><span>الشفافية</span><input class="krg" type="range" data-op min="15" max="100" step="5" value="${op}" style="--p:${pct(op, 15, 100)}%"><b data-v="op">${op}٪</b></div>
      ${
        tgt.t === 'shape'
          ? closed
            ? `<div class="pp-r"><span>تعبئة الشكل</span><button class="ksw${tgt.f ? ' on' : ''}" data-f role="switch" aria-checked="${!!tgt.f}" aria-label="تعبئة"></button></div>`
            : ''
          : `<div class="pp-t" style="margin-top:12px">الأسهم</div><div class="kseg">${[
              [0, 'ti-minus', 'بلا سهم'],
              [1, 'ti-arrow-narrow-left', 'سهم'],
              [2, 'ti-arrows-horizontal', 'سهمان']
            ]
              .map(
                x =>
                  `<button data-ar="${x[0]}" class="${(tgt.ar || 0) === x[0] ? 'on' : ''}"><i class="ti ${x[1]}"></i>${x[2]}</button>`
              )
              .join('')}</div>`
      }`;
      EB.openPop(html, anchor, { mode: 'sty', title: 'نمط الخط والشكل', keep: opened });
      opened = true;
      pop._moved = true;
      bind();
    };
    let bind = () => {};
    rend();
    const ap = f => {
      items.forEach(f);
      S.dirty = 1;
    };
    const onClick = e => {
      const b = e.target.closest('button');
      if (!b) return;
      const d = b.dataset;
      if (d.ds !== undefined)
        ap(x => {
          x.ds = +d.ds;
          delete x.d;
        });
      else if (d.f !== undefined)
        ap(x => {
          x.f = x.f ? 0 : 1;
        });
      else if (d.ar !== undefined)
        ap(x => {
          x.ar = +d.ar;
        });
      else return;
      EB.commit();
      rend();
    };
    let szBase = null;
    const onInput = e => {
      const t = e.target;
      if (t.dataset.sz !== undefined) {
        if (!szBase) szBase = items.map(x => (x.t === 'line' ? [x.x1, x.y1, x.x2, x.y2] : [x.w, x.h]));
        const f = +t.value / 100;
        items.forEach((x, i) => {
          const b = szBase[i];
          if (!b) return;
          if (x.t === 'line') {
            const mx = (b[0] + b[2]) / 2,
              my = (b[1] + b[3]) / 2;
            x.x1 = mx + (b[0] - mx) * f;
            x.y1 = my + (b[1] - my) * f;
            x.x2 = mx + (b[2] - mx) * f;
            x.y2 = my + (b[3] - my) * f;
          } else if (x.t === 'shape') {
            x.w = b[0] * f;
            x.h = b[1] * f;
          }
        });
        t.style.setProperty('--p', Math.round(((t.value - 25) / 275) * 100) + '%');
        t.parentNode.querySelector('b').textContent = EB.ar
          ? EB.ar(Math.round(f * 100)) + '٪'
          : Math.round(f * 100) + '%';
        S.dirty = 1;
        EB.showAct && EB.showAct();
        return;
      }
      if (t.dataset.lw === undefined && t.dataset.op === undefined) return;
      const lo = +t.min,
        hi = +t.max;
      t.style.setProperty('--p', Math.round(((t.value - lo) / (hi - lo)) * 100) + '%');
      const bv = t.parentNode.querySelector('b');
      if (t.dataset.lw !== undefined) {
        ap(x => {
          x.lw = +t.value;
        });
        bv.textContent = EB.ar(+t.value);
      } else {
        ap(x => {
          x.op = +t.value / 100;
        });
        bv.textContent = EB.ar(+t.value) + '٪';
      }
    };
    const onChange = e => {
      if (e.target.dataset.sz !== undefined) {
        szBase = null;
        e.target.value = 100;
        e.target.style.setProperty('--p', '27%');
        e.target.parentNode.querySelector('b').textContent = '١٠٠٪';
      }
      EB.commit();
    };
    bind = () => {
      pop._on = onClick;
      pop._in = onInput;
      pop._ch = onChange;
    };
    bind();
  };

  EB.mindChooser = function () {
    const sv = b =>
      `<svg viewBox="0 0 80 56" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">${b}</svg>`;
    const O = [
      [
        'mind',
        'شعاعية',
        'فكرة مركزية تتفرع حولها الأفكار',
        sv(
          '<circle cx="40" cy="28" r="7" fill="currentColor"/><path d="M40 21V8M40 35v13M33 28H12M47 28h21M35 23L16 10M45 23l19-13M35 33L16 46M45 33l19 13"/>'
        )
      ],
      [
        'tree',
        'شجرية راسية',
        'من الأعلى إلى الأسفل',
        sv(
          '<rect x="30" y="4" width="20" height="9" rx="3" fill="currentColor"/><path d="M40 13v8M16 21h48M16 21v8M40 21v8M64 21v8"/><rect x="8" y="29" width="16" height="8" rx="3"/><rect x="32" y="29" width="16" height="8" rx="3"/><rect x="56" y="29" width="16" height="8" rx="3"/><path d="M16 37v6M64 37v6"/>'
        )
      ],
      [
        'flow',
        'تسلسل خطوات',
        'خطوات متتابعة بأسهم',
        sv(
          '<rect x="4" y="20" width="16" height="16" rx="4"/><rect x="32" y="20" width="16" height="16" rx="4"/><rect x="60" y="20" width="16" height="16" rx="4"/><path d="M22 28h8M50 28h8"/>'
        )
      ],
      [
        'cmp',
        'مقارنة',
        'عمودان لقولين أو حكمين',
        sv(
          '<rect x="6" y="6" width="28" height="9" rx="3" fill="currentColor"/><rect x="46" y="6" width="28" height="9" rx="3" fill="currentColor"/><path d="M10 24h20M10 33h20M10 42h20M50 24h20M50 33h20M50 42h20"/>'
        )
      ]
    ];
    EB.sheet(
      'نوع الخريطة',
      `<div class="mcs">${O.map(o => `<button data-mt="${o[0]}">${o[3]}<b>${o[1]}</b><small>${o[2]}</small></button>`).join('')}<button data-mt="net"><svg viewBox="0 0 80 56" fill="none" stroke="currentColor" stroke-width="2.4"><rect x="4" y="6" width="24" height="18" rx="3"/><rect x="52" y="6" width="24" height="18" rx="3"/><rect x="28" y="32" width="24" height="18" rx="3"/><path d="M28 15h24M16 24l16 8M64 24L48 32"/></svg><b>شبكة صور</b><small>اربط صوراً من عندك</small></button></div>`,
      null,
      e => {
        const b = e.target.closest('[data-mt]');
        if (!b) return;
        EB.closeSheet();
        if (b.dataset.mt === 'net') $('fNet') ? $('fNet').click() : EB.toast('اختر صوراً من الإدراج');
        else EB.template(b.dataset.mt);
      }
    );
  };
})();
