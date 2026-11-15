(function () {
  'use strict';
  const EB = window.EB,
    S = EB.S,
    $ = EB.$,
    esc = EB.esc,
    ar = EB.ar;
  const CF = {
    hideTools: [],
    order: [],
    gl: 'tap',
    glView: 'bubble',
    glOff: [],
    sound: null,
    fx: 'confetti',
    snap: true,
    snapMs: 420,
    vib: true
  };
  try {
    Object.assign(CF, JSON.parse(localStorage.getItem('rs_edu_set') || '{}'));
  } catch (e) {}
  EB.CF = CF;
  const keep = () => {
    try {
      localStorage.setItem('rs_edu_set', JSON.stringify(CF));
    } catch (e) {}
  };
  if (CF.sound !== null) S.sound = !!CF.sound;
  S.snap = CF.snap !== false;
  EB.vibrate = ms => {
    if (CF.vib !== false && navigator.vibrate)
      try {
        navigator.vibrate(ms);
      } catch (e) {}
  };

  EB.hasBookText = function () {
    const pg = EB.page();
    return !!(pg && ((pg.sheet && pg.sheet.kind === 'book') || pg.items.some(i => i.t === 'wid' && i.k === 'bk')));
  };
  const ordered = () => {
    let L = EB.TOOLS.slice();
    if (CF.order.length)
      L.sort((a, b) => {
        const x = CF.order.indexOf(a[0]),
          y = CF.order.indexOf(b[0]);
        return (x < 0 ? 99 : x) - (y < 0 ? 99 : y);
      });
    return L;
  };

  EB.hideAvail = () => CF.hideAlways || EB.hasBookText();
  EB.toolList = function () {
    return ordered().filter(t => !CF.hideTools.includes(t[0]) && (t[0] !== 'hide' || EB.hideAvail()));
  };

  const GL = [
    ['off', 'ti-eye-off', 'مخفية', 'لا تُلوَّن المصطلحات ولا تظهر معانيها.'],
    ['tap', 'ti-click', 'عند الضغط', 'المصطلحات منقّطة، واضغط أي مصطلح ليظهر معناه.'],
    ['show', 'ti-pin', 'دائمة', 'تُكتب معاني المصطلحات تلقائياً أسفل النص أو أسفل كل بطاقة.']
  ];
  const FX = [
    ['confetti', 'ti-confetti', 'قصاصات'],
    ['stars', 'ti-sparkles', 'نجوم'],
    ['fire', 'ti-firework', 'ألعاب نارية'],
    ['off', 'ti-ban', 'بلا مؤثر']
  ];
  const HOLD = [
    [300, 'سريع'],
    [420, 'عادي'],
    [750, 'بطيء']
  ];
  EB.settingsSheet = async function (view) {
    let srcs = [];
    try {
      srcs = EB.bridge.glossSources ? await EB.bridge.glossSources() : [];
    } catch (e) {}
    view = view || 'main';
    let hist = [];
    const sw = (k, t, sub, on, ic) =>
      `<button class="kr sw" data-k="${k}" role="switch" aria-checked="${!!on}">${ic ? `<i class="ti ${ic}"></i>` : ''}<span class="kt">${t}${sub ? `<small>${sub}</small>` : ''}</span><span class="ksw${on ? ' on' : ''}"></span></button>`;
    const nOn = () => srcs.filter(s => !CF.glOff.includes(s.name)).length;
    const toolsOn = () => ordered().filter(t => !CF.hideTools.includes(t[0])).length;
    const hub = (go, ic, c, t, sub, val) =>
      `<button class="kr hub" data-go="${go}"><span class="hi" style="--hc:${c}"><i class="ti ${ic}"></i></span><span class="kt">${t}<small>${sub}</small></span><span class="kv">${val}</span><i class="ti ti-chevron-left kch"></i></button>`;
    const optCards = (attr, list, cur) =>
      `<div class="opts sm">${list.map(m => `<button class="opt${cur === m[0] ? ' on' : ''}" ${attr}="${m[0]}"><i class="ti ${m[1]}"></i><span class="kt"><b>${m[2]}</b>${m[3] ? `<small>${m[3]}</small>` : ''}</span><span class="rd"></span></button>`).join('')}</div>`;
    const TITLES = {
      main: 'الإعدادات',
      tools: 'الأدوات في الشريط السفلي',
      write: 'الكتابة والأشكال',
      gloss: 'معاني المصطلحات',
      fx: 'الصوت والمؤثرات',
      sess: 'الجلسات'
    };
    const views = {
      main: () => `<div class="kg-t">الأدوات</div><div class="kg">${hub('tools', 'ti-layout-bottombar', '#c0502a', 'الأدوات في الشريط السفلي', 'ترتيبها وإظهارها وإخفاؤها', ar(toolsOn()) + ' ظاهرة')}${hub('write', 'ti-pencil', '#2f6fd0', 'الكتابة والأشكال', 'تحويل الرسم إلى شكل نظيف', S.snap ? 'مفعّل' : 'متوقف')}</div>
        <div class="kg-t">المحتوى</div><div class="kg">${hub('gloss', 'ti-book-2', '#0f8a5f', 'معاني المصطلحات', 'كيف تظهر معاني كلمات الكتب', (GL.find(m => m[0] === CF.gl) || GL[1])[2])}</div>
        <div class="kg-t">الدرس</div><div class="kg">${hub('fx', 'ti-volume', '#8a4fc2', 'الصوت والمؤثرات', 'أصوات الإجابة والاحتفال', S.sound ? 'مفعّل' : 'صامت')}${hub('sess', 'ti-presentation', '#17898f', 'الجلسات', 'شروحات الجلسات السابقة', S.showSess !== false ? 'ظاهرة' : 'مخفية')}</div>`,
      tools: () =>
        `<p class="n st-lead">اسحب المقبض لإعادة الترتيب، واضغط العين لإخفاء أداة أو إظهارها. يمكنك إخفاء أي أداة وإعادتها وقتما شئت.</p><div class="kg tl ord">${ordered()
          .map(
            (t, n) =>
              `<div class="tr${CF.hideTools.includes(t[0]) ? ' off' : ''}" data-i="${n}"><i class="ti ti-grip-vertical grip"></i><i class="ti ${t[1]}"></i><span class="tt">${t[2]}${t[0] === 'hide' ? '<small>تظهر عند وجود نص كتاب في الصفحة</small>' : ''}</span><button class="eye" data-eye="${t[0]}" aria-label="إظهار أو إخفاء"><i class="ti ti-${CF.hideTools.includes(t[0]) ? 'eye-off' : 'eye'}"></i></button></div>`
          )
          .join(
            ''
          )}</div><div class="kg" style="margin-top:14px">${sw('hideAlways', 'إظهار أداة الإخفاء دائماً', 'افتراضياً تظهر فقط حين يكون في الصفحة نص كتاب.', CF.hideAlways, 'ti-eye-off')}</div><button class="kchip st-reset" data-reset><i class="ti ti-restore"></i>استعادة الترتيب الافتراضي</button>`,
      write:
        () => `<div class="kg">${sw('snap', 'تحويل الرسم إلى شكل', 'ارسم دائرة أو مربعاً أو مثلثاً ثم أبقِ إصبعك ثابتاً فيتحوّل إلى شكل نظيف.', S.snap, 'ti-shape-2')}</div>
        <div class="kg-t">مدة التوقف قبل التحويل</div><div class="kseg">${HOLD.map(h => `<button data-hold="${h[0]}" class="${CF.snapMs === h[0] ? 'on' : ''}">${h[1]}</button>`).join('')}</div>
        <div class="kg-t" style="margin-top:20px">اللمس</div><div class="kg">${sw('vib', 'اهتزاز خفيف', 'عند تحوّل الرسم إلى شكل وعند بدء السحب للترتيب.', CF.vib !== false, 'ti-device-mobile-vibration')}</div>`,
      gloss: () => `<div class="kg-t">كيف تظهر المعاني؟</div>${optCards('data-gl', GL, CF.gl)}
        ${CF.gl === 'tap' ? `<div class="kg-t">شكل المعنى عند الضغط</div><div class="kseg"><button data-glv="bubble" class="${CF.glView !== 'sheet' ? 'on' : ''}"><i class="ti ti-message-2"></i> فقاعة قرب الكلمة</button><button data-glv="sheet" class="${CF.glView === 'sheet' ? 'on' : ''}"><i class="ti ti-layout-bottombar"></i> ورقة سفلية</button></div>` : ''}
        ${srcs.length ? `<div class="kg-t">مصادر المعاني <span class="cnt">${ar(nOn())} من ${ar(srcs.length)}</span></div><div class="src-tools"><button class="kchip" data-all="1">تحديد الكل</button><button class="kchip" data-all="0">إلغاء الكل</button></div><div class="kg">${srcs.map(x => `<button class="kr pk sq${CF.glOff.includes(x.name) ? '' : ' on'}" data-src="${esc(x.name)}"><span class="kc"><i class="ti ti-check"></i></span><span class="kt">${esc(x.name || 'بدون مصدر')}<small>${ar(x.n)} مصطلح</small></span></button>`).join('')}</div>` : ''}`,
      fx: () => `<div class="kg">${sw('sound', 'المؤثرات الصوتية', 'أصوات عند الإجابة على الأسئلة وعند انتهاء المؤقت.', S.sound, 'ti-volume')}</div>
        <div class="kg-t">الاحتفال عند الإجابة الصحيحة <small class="st-hint">اضغط أي خيار لتجربته</small></div><div class="fxg">${FX.map(m => `<button class="fxb${CF.fx === m[0] ? ' on' : ''}" data-fx="${m[0]}"><i class="ti ${m[1]}"></i><span>${m[2]}</span></button>`).join('')}</div>`,
      sess: () =>
        `<div class="kg">${sw('sess', 'شروحات الجلسات السابقة', 'إظهار ما كتبته في جلسات سابقة فوق الصفحة. إيقافه يخفيها دون حذفها.', S.showSess !== false, 'ti-history')}</div>`
    };
    const foot = () =>
      view === 'main'
        ? '<button class="pri" data-ok>تم</button>'
        : '<button data-back><i class="ti ti-arrow-right"></i> رجوع</button><button class="pri" data-ok>تم</button>';
    const rend = (keepScroll, dir) => {
      const B = $('shB'),
        sc = B.scrollTop;
      B.innerHTML = `<div class="vw ${dir ? 'vw-' + dir : ''}">${views[view]()}</div>`;
      $('shT').textContent = TITLES[view];
      $('shF').style.display = 'flex';
      $('shF').innerHTML = foot();
      if (keepScroll) B.scrollTop = sc;
      else B.scrollTop = 0;
      const ord = B.querySelector('.ord');
      if (ord)
        EB.dragSort(ord, '.tr', o => {
          const T0 = ordered().map(t => t[0]);
          CF.order = o.map(i => T0[i]);
          keep();
          rend(1);
          EB.refreshUI();
          EB.vibrate(8);
        });
    };
    const patchSw = (b, on) => {
      b.setAttribute('aria-checked', on);
      b.querySelector('.ksw').classList.toggle('on', on);
    };
    EB.sheet(TITLES[view], '', '', e => {
      const b = e.target.closest('button');
      if (!b) return;
      const d = b.dataset;
      if (d.ok !== undefined) {
        EB.closeSheet();
        return;
      }
      if (d.back !== undefined) {
        if (hist.length) {
          view = hist.pop();
          rend(0, 'b');
        } else {
          EB.closeSheet();
          setTimeout(() => $('bMore').click(), 280);
        }
        return;
      }
      if (d.go) {
        hist.push(view);
        view = d.go;
        rend(0, 'f');
        return;
      }
      if (d.k) {
        const k = d.k,
          on = b.getAttribute('aria-checked') !== 'true';
        if (k === 'sound') {
          S.sound = on;
          CF.sound = on;
          EB.prefs && EB.prefs();
          if (on && EB.sfx) EB.sfx.ok();
        } else if (k === 'sess') {
          S.showSess = on;
          EB.mountWidgets();
          S.dirty = 1;
        } else if (k === 'snap') {
          S.snap = on;
          CF.snap = on;
        } else if (k === 'hideAlways') {
          CF.hideAlways = on;
          keep();
          EB.refreshUI();
        } else if (k === 'vib') {
          CF.vib = on;
          if (on) EB.vibrate(20);
        }
        keep();
        patchSw(b, on);
        return;
      }
      if (d.hold) {
        CF.snapMs = +d.hold;
        keep();
        b.parentElement.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
        return;
      }
      if (d.gl) {
        CF.gl = d.gl;
        keep();
        rend(1);
        EB.refreshGl && EB.refreshGl();
        return;
      }
      if (d.glv) {
        CF.glView = d.glv;
        keep();
        rend(1);
        return;
      }
      if (d.fx) {
        CF.fx = d.fx;
        keep();
        B_fx(b);
        if (d.fx !== 'off') {
          const r = b.getBoundingClientRect();
          EB.burst(r.left + r.width / 2, r.top + 10, 60);
        }
        return;
      }
      if (d.src !== undefined) {
        CF.glOff = CF.glOff.filter(x => x !== d.src);
        if (b.classList.contains('on')) CF.glOff.push(d.src);
        keep();
        EB.refreshGl && EB.refreshGl();
        rend(1);
        return;
      }
      if (d.all !== undefined) {
        CF.glOff = d.all === '1' ? [] : srcs.map(x => x.name);
        keep();
        EB.refreshGl && EB.refreshGl();
        rend(1);
        return;
      }
      if (d.reset !== undefined) {
        CF.order = [];
        CF.hideTools = [];
        keep();
        rend(1);
        EB.refreshUI();
        return;
      }
      if (d.eye) {
        const t = d.eye,
          hid = CF.hideTools.includes(t);
        if (!hid && ordered().filter(x => !CF.hideTools.includes(x[0])).length <= 1) {
          EB.toast('أبقِ أداة واحدة على الأقل ظاهرة');
          return;
        }
        CF.hideTools = hid ? CF.hideTools.filter(x => x !== t) : CF.hideTools.concat(t);
        keep();
        if (!hid && S.tool === t) {
          const f = EB.toolList()[0];
          if (f) EB.setTool(f[0]);
        }
        rend(1);
        EB.refreshUI();
      }
    });
    const B_fx = b => b.parentElement.querySelectorAll('.fxb').forEach(x => x.classList.toggle('on', x === b));
    rend();
  };

  EB.dragSort = function (box, rowSel, onDone, o) {
    o = o || {};
    const X = o.axis === 'x',
      hold = o.hold || 0,
      hs = o.handle || '.grip';
    if (box._ds) box.removeEventListener('pointerdown', box._ds);
    box._ds = e => {
      const row = e.target.closest(rowSel);
      if (!row || !box.contains(row)) return;
      if (!hold && !e.target.closest(hs)) return;
      if (e.button) return;
      const id = e.pointerId,
        sc = box.closest('#shB') || box,
        rows = () => [...box.querySelectorAll(rowSel)],
        pos = r => (X ? r.left : r.top),
        size = r => (X ? r.width : r.height);
      const r0 = row.getBoundingClientRect();
      let on = 0,
        tm = 0,
        raf = 0,
        cur = X ? e.clientX : e.clientY,
        grab = cur - pos(r0);
      const tmv = ev => {
        if (on) ev.preventDefault();
      };
      const place = () => {
        const want = cur - grab,
          rtl = X && getComputedStyle(box).direction === 'rtl';
        row.style.transform = '';
        const nat = row.getBoundingClientRect();
        let cen = want + size(nat) / 2;
        const others = rows().filter(n => n !== row),
          all = rows();
        let idx = all.indexOf(row);
        for (const n of others) {
          const q = n.getBoundingClientRect(),
            mid = pos(q) + size(q) / 2,
            before = !!(n.compareDocumentPosition(row) & 4);
          if (rtl ? (before ? cen > mid : cen < mid) : before ? cen < mid : cen > mid) {
            if (before) n.before(row);
            else n.after(row);
            break;
          }
        }
        row.style.transform = '';
        const nat2 = row.getBoundingClientRect();
        row.style.transform = X ? `translateX(${want - pos(nat2)}px)` : `translateY(${want - pos(nat2)}px)`;
      };
      const loop = () => {
        if (!on) return;
        const sr = sc.getBoundingClientRect(),
          edge = 54;
        if (!X) {
          if (cur < sr.top + edge) sc.scrollTop -= 9;
          else if (cur > sr.bottom - edge) sc.scrollTop += 9;
        }
        place();
        raf = requestAnimationFrame(loop);
      };
      const start = () => {
        on = 1;
        addEventListener('touchmove', tmv, { passive: false });
        row.classList.add('drag');
        box.classList.add('dragging');
        try {
          row.setPointerCapture(id);
        } catch (x) {}
        EB.vibrate(10);
        loop();
      };
      const mv = ev => {
        if (ev.pointerId !== id) return;
        const p = X ? ev.clientX : ev.clientY;
        if (!on) {
          if (hold && Math.abs(p - (X ? e.clientX : e.clientY)) > 8) cancel();
          return;
        }
        ev.preventDefault();
        cur = p;
      };
      const cancel = () => {
        clearTimeout(tm);
        cancelAnimationFrame(raf);
        removeEventListener('touchmove', tmv);
        removeEventListener('pointermove', mv, true);
        removeEventListener('pointerup', up, true);
        removeEventListener('pointercancel', up, true);
      };
      const up = ev => {
        if (ev.pointerId !== id) return;
        const was = on;
        on = 0;
        cancel();
        if (was) {
          row.classList.remove('drag');
          box.classList.remove('dragging');
          row.style.transform = '';
          const ord = rows().map(r => +r.dataset.i);
          if (ord.some((v, i) => v !== i)) onDone(ord);
        }
      };
      addEventListener('pointermove', mv, true);
      addEventListener('pointerup', up, true);
      addEventListener('pointercancel', up, true);
      if (hold) tm = setTimeout(start, hold);
      else {
        start();
        e.preventDefault();
      }
    };
    box.addEventListener('pointerdown', box._ds);
  };

  const tg = $('dockTg');
  const setDock = off => {
    document.body.classList.toggle('dk-off', off);
    tg.firstElementChild.className = 'ti ti-chevron-' + (off ? 'up' : 'down');
    try {
      localStorage.setItem('rs_edu_dk', off ? '1' : '0');
    } catch (e) {}
    EB.resize();
    setTimeout(EB.resize, 260);
  };
  tg.onclick = () => setDock(!document.body.classList.contains('dk-off'));
  try {
    if (localStorage.getItem('rs_edu_dk') === '1') setDock(true);
  } catch (e) {}
})();
