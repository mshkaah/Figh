(function () {
  'use strict';
  const EB = window.EB,
    S = EB.S,
    $ = EB.$,
    ar = EB.ar,
    esc = EB.esc,
    page = () => EB.page();
  const TOOLS = [
    ['pen', 'ti-pencil', 'قلم'],
    ['hl', 'ti-highlight', 'تظليل'],
    ['erase', 'ti-eraser', 'ممحاة'],
    ['laser', 'ti-focus-2', 'ليزر'],
    ['select', 'ti-pointer', 'تحديد'],
    ['hand', 'ti-arrows-move', 'تحريك'],
    ['hide', 'ti-eye-off', 'إخفاء']
  ];
  const MODES = [
    ['text', 'نص متصل', 'كل كلمة تُخفى وتُكشف'],
    ['sent', 'جمل', 'تُخفى الجملة كاملة'],
    ['list', 'قائمة', 'نقاط لكل جملة'],
    ['lines', 'سطر لكل جملة', 'كل جملة في سطر']
  ];
  EB.TOOLS = TOOLS;
  EB.MODES = MODES;

  EB.shH = null;

  const shStack = [];
  let shLast = null,
    shClr = 0;
  const shSnap = () => ({
    t: $('shT').textContent,
    b: $('shB').innerHTML,
    f: $('shF').innerHTML,
    fd: $('shF').style.display,
    h: EB.shH,
    sc: $('shB').scrollTop
  });
  const shBack = () => $('shBk') && $('shBk').classList.toggle('s', shStack.length > 0);
  const shOpen = () => $('sh').classList.contains('s');
  EB.sheet = function (title, body, foot, handler) {
    clearTimeout(shClr);
    if (shLast && performance.now() - shLast.at < 80) shStack.push(shLast.snap);
    shLast = null;
    EB._shAt = performance.now();
    $('shT').textContent = title;
    $('shB').innerHTML = body;
    const f = $('shF');
    f.style.display = foot ? 'flex' : 'none';
    f.innerHTML = foot || '';
    EB.shH = handler || null;
    $('veil').classList.add('s');
    $('sh').classList.add('s');
    $('shB').scrollTop = 0;
    shBack();
  };
  EB.closeSheet = function () {
    if (shOpen()) shLast = { snap: shSnap(), at: performance.now() };
    $('veil').classList.remove('s');
    $('sh').classList.remove('s');
    EB.shH = null;
    clearTimeout(shClr);
    shClr = setTimeout(() => {
      if (!shOpen()) {
        shStack.length = 0;
        shLast = null;
        shBack();
      }
    }, 90);
    if (EB.onSheetClose) {
      const f = EB.onSheetClose;
      EB.onSheetClose = null;
      f();
    }
  };
  EB.sheetBack = function () {
    const s = shStack.pop();
    if (!s) return false;
    $('shT').textContent = s.t;
    $('shB').innerHTML = s.b;
    $('shF').innerHTML = s.f;
    $('shF').style.display = s.fd;
    EB.shH = s.h;
    EB._shAt = performance.now();
    $('shB').scrollTop = s.sc;
    shBack();
    return true;
  };
  $('veil').onclick = () => {
    if (performance.now() - (EB._shAt || 0) > 450) EB.closeSheet();
  };
  $('shX').onclick = () => EB.closeSheet();
  $('shBk').onclick = () => EB.sheetBack();
  $('sh').addEventListener('click', e => {
    if (EB.shH) EB.shH(e);
  });
  EB.askText = function (title, val, cb) {
    EB.sheet(
      title,
      `<div class="fld"><input class="ginp" id="atIn" value="${esc(val)}" maxlength="80"></div>`,
      '<button class="pri" data-a="ok">حفظ</button>',
      e => {
        if (e.target.closest('[data-a=ok]')) {
          const v = $('atIn').value.trim();
          EB.closeSheet();
          if (v) cb(v);
        }
      }
    );
    setTimeout(() => $('atIn').select(), 280);
  };
  EB.confirm = function (title, msg, okLabel, cb, danger) {
    EB.sheet(
      title,
      `<div class="cf"><i class="ti ti-${danger ? 'alert-triangle' : 'help-circle'}${danger ? ' dg' : ''}"></i><p>${msg}</p></div>`,
      `<button data-a="no">إلغاء</button><button class="${danger ? 'dng' : 'pri'}" data-a="ok">${okLabel}</button>`,
      e => {
        const a = e.target.closest('[data-a]');
        if (!a) return;
        EB.closeSheet();
        if (a.dataset.a === 'ok') cb();
      }
    );
  };

  EB.closeUI = function () {
    EB.closePop && EB.closePop();
    EB.closeMini && EB.closeMini();
    if ($('ed').classList.contains('s')) EB.edDone();
  };

  EB.setTool = function (t) {
    S.tool = t;
    if (t !== 'select') {
      S.sel = [];
      EB.showAct();
    }
    if (S.shaping) EB.finishShaping();
    S.dirty = 1;
    EB.refreshUI();
  };
  $('tools').addEventListener('click', e => {
    const b = e.target.closest('[data-t]');
    if (!b) return;
    const t = b.dataset.t;
    EB.closePop();
    EB.setTool(t);
  });
  $('bUndo').onclick = () => {
    EB.closeUI();
    EB.undo();
  };
  $('bRedo').onclick = () => {
    EB.closeUI();
    EB.redo();
  };
  $('bPrev').onclick = () => EB.gotoPage(S.pi - 1);
  $('bNext').onclick = () => EB.gotoPage(S.pi + 1);
  $('bCnt').onclick = () => {
    $('rail').classList.toggle('s');
    EB.renderRail();
    setTimeout(EB.resize, 280);
  };
  $('zIn').onclick = () => EB.zoomSmooth(innerWidth / 2, (S.TOP + innerHeight - S.BOT) / 2, 1.3);
  $('zOut').onclick = () => EB.zoomSmooth(innerWidth / 2, (S.TOP + innerHeight - S.BOT) / 2, 1 / 1.3);
  $('zPct').onclick = () =>
    EB.go({ k: 1, x: innerWidth / 2 - EB.vc().x, y: S.V.y }, false) ||
    EB.zoomAt(innerWidth / 2, innerHeight / 2, 1 / S.V.k);
  $('unfocus').onclick = () => document.body.classList.remove('focus');
  $('bExit').onclick = async () => {
    EB.closeUI();
    await EB.flush();
    if (window.parent !== window && parent.EDU && parent.EDU.close) parent.EDU.close();
    else EB.toast('تم الحفظ');
  };
  $('bTitle').onclick = () =>
    EB.askText('اسم الدرس', S.lesson.name, v => {
      S.lesson.name = v;
      EB.save();
      EB.refreshUI();
    });

  EB.startChosen = () => {
    if (!EB._sessAuto) return;
    EB._sessAuto = 0;
    setTimeout(() => {
      if (!$('sessPop') && EB.sessionStart && !S.sess) EB.sessionStart();
    }, 380);
  };
  $('hint').addEventListener('click', e => {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    ({
      pBlank: () => {
        EB.hintOff = 1;
        $('hint').classList.remove('s');
        EB.setTool && EB.setTool('pen');
        EB.startChosen();
      },
      pBook: () => EB.bookPicker(),
      pQ: () => EB.insertSheet('q'),
      pFile: () => $('fDoc').click()
    })[b.dataset.a]();
  });

  const ptype = p =>
    p.sheet
      ? p.sheet.kind === 'img'
        ? ['ti-photo', 'ملف']
        : ['ti-book-2', 'كتاب']
      : p.items.some(i => i.t === 'wid')
        ? ['ti-help-circle', 'سؤال']
        : ['ti-file', 'ورقة'];
  EB.renderRail = function () {
    const L = S.lesson;
    $('rail').innerHTML =
      L.pages
        .map((p, i) => {
          const t = ptype(p);
          return `<button class="pg${i === S.pi ? ' on' : ''}" data-g="${i}"><b>${ar(i + 1)}</b><i class="ti ${t[0]}"></i><span>${esc(p.title || t[1])}</span></button>`;
        })
        .join('') + `<button class="pg add" data-g="add"><i class="ti ti-plus"></i><span>صفحة</span></button>`;
    const a = $('rail').querySelector('.on');
    if (a) a.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    $('rail')
      .querySelectorAll('.pg[data-g]')
      .forEach(b => {
        if (b.dataset.g !== 'add') b.dataset.i = b.dataset.g;
      });
    if (EB.dragSort)
      EB.dragSort(
        $('rail'),
        '.pg[data-i]',
        ord => {
          const cur = L.pages[S.pi];
          L.pages = ord.map(k => L.pages[k]);
          S.pi = L.pages.indexOf(cur);
          EB.save();
          EB.refreshUI();
        },
        { axis: 'x', hold: 380 }
      );
  };
  $('rail').addEventListener('click', e => {
    const g = e.target.closest('[data-g]');
    if (!g) return;
    if (g.dataset.g === 'add') EB.addPageSheet();
    else {
      const i = +g.dataset.g;
      if (i === S.pi) EB.pageMenu();
      else EB.gotoPage(i);
    }
  });
  const gridStyle = (paper, g, gs, k) => {
    const c = EB.gridCss({ paper, grid: g, gs }, k, 0, 0);
    return `background-color:${c.color};background-image:${c.img};background-size:${c.size};background-position:${c.pos};background-repeat:${c.rep}`;
  };
  EB.pageMenu = function (keepScroll) {
    const pg = page(),
      sh = pg.sheet,
      isBook = sh && sh.kind === 'book',
      sc = $('shB').scrollTop;
    const kr = (b, ic, t, sm, cls) =>
      `<button class="kr${cls ? ' ' + cls : ''}" data-b="${b}"><i class="ti ${ic}"></i><span class="kt">${t}${sm ? `<small>${sm}</small>` : ''}</span></button>`;
    const pct = (v, a, z) => Math.round(((v - a) / (z - a)) * 100);
    const isCustom = !EB.PAPERS.some(c => c.toLowerCase() === (pg.paper || '').toLowerCase());
    let h = `<div class="pgpv" id="pgPv" style="${gridStyle(pg.paper, pg.grid, pg.gs || 28, 0.6)}"><span class="pgpv-t" style="color:${EB.inkFor(pg.paper)}">${isBook ? 'نص الكتاب' : 'معاينة الورقة'}</span></div>`;
    h += `<div class="kg-t">لون الورقة</div><div class="ppg" id="ppG">${EB.PAPERS.map((c, i) => `<button class="pp${pg.paper.toLowerCase() === c.toLowerCase() ? ' on' : ''}${EB.isDark(c) ? ' dk' : ''}" data-p="${c}" style="--c:${c};--i:${i}" aria-label="لون الورقة"><i class="ti ti-check"></i></button>`).join('')}<button class="pp more${isCustom ? ' on' : ''}" data-pcu style="--i:${EB.PAPERS.length}" aria-label="لون مخصص"><i class="ti ti-check"></i></button></div>`;
    h += `<div class="kg-t">نمط الورقة</div><div class="pat" id="patG">${EB.GRIDS.map((g, i) => `<button class="ptn${pg.grid === g[0] ? ' on' : ''}" data-gr="${g[0]}" style="--i:${i}"><span class="pv" style="${gridStyle(pg.paper, g[0], 28, 0.5)}"></span><b>${g[1]}</b></button>`).join('')}</div>`;
    h += `<div class="kg gsz" id="gszW" style="${pg.grid === 'none' ? 'display:none' : ''}"><div class="kr rg"><span class="kt">حجم الخانة</span><input class="krg" type="range" id="gsR" min="16" max="64" step="2" value="${pg.gs || 28}" style="--p:${pct(pg.gs || 28, 16, 64)}%"></div></div>`;
    if (isBook) {
      h =
        `<div class="kg-t">محتوى الصفحة</div><div class="kg">${kr('parts', 'ti-list-numbers', 'ترتيب المسائل والفصول', 'أضف المزيد أو أعد الترتيب')}</div>` +
        h;
      h += `<div class="kg-t">الإخفاء والكشف</div><div class="kg">${kr('hideAll', 'ti-eye-off', 'إخفاء الكل', 'يختفي النص كله ثم تكشفه تدريجياً')}${kr('showAll', 'ti-eye', 'كشف الكل', '')}${kr('cloze', 'ti-puzzle', 'فراغات عشوائية', 'تختفي بعض الكلمات للاختبار')}</div><p class="n" style="margin:6px 4px 0">بعد الإخفاء اضغط أي موضع مخفي لكشفه، أو استخدم «كشف التالي» أثناء الشرح.</p>`;
      h += `<div class="kg-t">الخط</div><div class="kg"><div class="kr rg"><span class="kt">حجم الخط</span><input class="krg" type="range" id="fsR" min="20" max="48" step="1" value="${sh.fs || 30}" style="--p:${pct(sh.fs || 30, 20, 48)}%"></div><div class="kr rg"><span class="kt">تباعد الأسطر</span><input class="krg" type="range" id="lhR" min="1.5" max="3.4" step=".1" value="${sh.lh || 2.1}" style="--p:${pct(sh.lh || 2.1, 1.5, 3.4)}%"></div><button class="kr sw" data-b="marg" role="switch" aria-checked="${!!sh.marg}"><i class="ti ti-layout-sidebar-right"></i><span class="kt">مساحة للشرح بجانب النص<small>هامش فارغ تكتب فيه</small></span><span class="ksw${sh.marg ? ' on' : ''}"></span></button></div>`;
    }
    h += `<div class="kg-t">الصفحة</div><div class="kg">${kr('dup', 'ti-copy', 'نسخ الصفحة', '')}${kr('rename', 'ti-pencil', 'تسمية الصفحة', '')}${kr('clear', 'ti-eraser', 'مسح الكتابة', 'يبقى المحتوى وتُمسح كتابتك', 'dng')}${kr('del', 'ti-trash', 'حذف الصفحة', '', 'dng')}</div>`;
    EB.sheet('إعدادات الصفحة ' + ar(S.pi + 1), h, null, pageMenuClick);
    if (keepScroll) $('shB').scrollTop = sc;
    const sh2 = $('shB');
    sh2.oninput = e => {
      const s = page().sheet,
        p = page();
      const r = e.target;
      if (r.type === 'range') r.style.setProperty('--p', Math.round(((r.value - r.min) / (r.max - r.min)) * 100) + '%');
      if (r.id === 'gsR') {
        p.gs = +r.value;
        EB.applyV();
        pgRefresh();
        EB.save();
        return;
      }
      if (!s) return;
      if (r.id === 'fsR') s.fs = +r.value;
      if (r.id === 'lhR') s.lh = +r.value;
      EB.rebuildSheet();
      EB.save();
    };
  };

  function pgRefresh() {
    const pg = page(),
      pv = $('pgPv');
    if (!pv) return;
    pv.setAttribute('style', gridStyle(pg.paper, pg.grid, pg.gs || 28, 0.6));
    const t = pv.querySelector('.pgpv-t');
    if (t) t.style.color = EB.inkFor(pg.paper);
    document.querySelectorAll('#patG .ptn').forEach(b => {
      b.classList.toggle('on', b.dataset.gr === pg.grid);
      b.querySelector('.pv').setAttribute('style', gridStyle(pg.paper, b.dataset.gr, 28, 0.5));
    });
    document.querySelectorAll('#ppG .pp').forEach(b => {
      const cu = b.dataset.pcu !== undefined;
      b.classList.toggle(
        'on',
        cu
          ? !EB.PAPERS.some(c => c.toLowerCase() === pg.paper.toLowerCase())
          : (b.dataset.p || '').toLowerCase() === pg.paper.toLowerCase()
      );
    });
    const gw = $('gszW');
    if (gw) gw.style.display = pg.grid === 'none' ? 'none' : '';
    const mc = document.querySelector('#ppG .more');
    if (mc) mc.style.removeProperty('--c');
  }
  function setPaper(c) {
    const pg = page(),
      sh = pg.sheet;
    pg.paper = c;
    if (EB.isDark(c) && sh && sh.kind === 'book') sh.col = '#1e1926';
    else if (sh && sh.kind === 'book' && sh.col === '#1e1926') sh.col = '#ffffff';
    if (EB.isDark(S.color) === EB.isDark(c)) S.color = EB.inkFor(c);
    EB.applyV();
    EB.rebuildSheet();
    EB.save();
    pgRefresh();
    EB.refreshUI();
  }
  function pageMenuClick(e) {
    const pg = page(),
      sh = pg.sheet,
      L = S.lesson,
      t = e.target.closest('button');
    if (!t) return;
    const d = t.dataset;
    if (d.p) {
      setPaper(d.p);
      return;
    }
    if (d.pcu !== undefined) {
      EB.Colors.pick(
        pg.paper,
        c => {
          setPaper(c);
        },
        { title: 'لون الورقة' }
      );
      return;
    }
    if (d.gr) {
      pg.grid = d.gr;
      EB.applyV();
      EB.save();
      pgRefresh();
      return;
    }
    if (d.m) {
      sh.mode = d.m;
      sh.hid = [];
      sh._u = null;
      EB.rebuildSheet();
      EB.save();
      EB.pageMenu();
      return;
    }
    const b = d.b;
    if (!b) return;
    const n = EB.units(sh || { body: '' }).length;
    if (b === 'parts') {
      EB.closeSheet();
      EB.partsSheet();
      return;
    }
    if (b === 'hideAll') {
      sh.hid = Array.from({ length: n }, (_, i) => i);
      EB.rebuildSheet();
      EB.save();
      EB.toast('أُخفي النص — اضغط أي موضع لكشفه');
    } else if (b === 'showAll') {
      sh.hid = [];
      EB.rebuildSheet();
      EB.save();
    } else if (b === 'cloze') {
      sh.hid = [];
      for (let i = 0; i < n; i++)
        if (Math.random() < 0.28 && (sh.mode !== 'text' || EB.units(sh)[i].t.length > 2)) sh.hid.push(i);
      EB.rebuildSheet();
      EB.save();
    } else if (b === 'marg') {
      sh.marg = !sh.marg;
      EB.rebuildSheet();
      EB.save();
      EB.pageMenu(true);
      EB.fit();
    } else if (b === 'dup') {
      const c = JSON.parse(JSON.stringify(pg, (k, v) => (k[0] === '_' || k === 'el' ? undefined : v)));
      c.id = 'p' + Date.now().toString(36);
      c.title = (pg.title || 'ورقة') + ' (نسخة)';
      c.items.forEach(i => {
        if (i.st) i.st = {};
      });
      EB.closeSheet();
      EB.addPage(c);
    } else if (b === 'rename') {
      EB.closeSheet();
      EB.askText('اسم الصفحة', pg.title || '', v => {
        pg.title = v;
        EB.refreshUI();
        EB.save();
      });
    } else if (b === 'clear') {
      EB.closeSheet();
      EB.confirm(
        'مسح الكتابة',
        'سيُحذف كل ما رُسم أو أُضيف على هذه الصفحة، ويبقى نص الكتاب. هل تريد المتابعة؟',
        'مسح',
        () => {
          pg.items = [];
          EB.commit();
          EB.mountWidgets();
          S.sel = [];
          EB.showAct();
          S.dirty = 1;
          EB.refreshUI();
        },
        true
      );
    } else if (b === 'del') {
      EB.closeSheet();
      EB.confirm('حذف الصفحة', 'ستُحذف هذه الصفحة وما كُتب عليها.', 'حذف', () => EB.delPage(S.pi), true);
    }
  }

  EB.beginSession = () => {
    S.sess = ++S.lesson.sc;
    S.lesson.pages.forEach(p => {
      if (p.sheet) p.sheet.hid0 = (p.sheet.hid || []).slice();
    });
    EB.toast('بدأت جلسة شرح — كل ما تكتبه يمكن حذفه دفعة واحدة', 2600);
    EB.refreshUI();
    EB.save();
  };
  $('sessBtn').onclick = () => {
    if (!S.sess) {
      EB.sessionStart();
      return;
    }
    EB.sheet(
      'جلسة الشرح',
      `<p class="n" style="font-size:15px">كل ما كتبته أو أضفته أثناء هذه الجلسة مُعلَّم. يبقى الدرس نفسه (النصوص والأسئلة) كما هو.</p>`,
      '',
      e => {
        const a = e.target.closest('[data-a]');
        if (!a) return;
        const v = a.dataset.a;
        EB.closeSheet();
        if (v === 'keep') endSession(false);
        else if (v === 'drop')
          EB.confirm(
            'حذف شرح الجلسة',
            'سيُحذف كل ما كُتب في هذه الجلسة وتعود الأسئلة والنصوص المخفية لحالتها قبل الجلسة.',
            'احذف الشرح',
            () => endSession(true),
            true
          );
      }
    );
    $('shB').insertAdjacentHTML(
      'beforeend',
      `<div class="kg"><button class="kr" data-a="keep"><i class="ti ti-device-floppy" style="color:var(--ok)"></i><span class="kt">إنهاء مع الاحتفاظ بالشرح<small>يبقى الشرح ظاهراً ويمكن إخفاؤه لاحقاً من القائمة</small></span></button><button class="kr dng" data-a="drop"><i class="ti ti-trash"></i><span class="kt">إنهاء وحذف كل ما كُتب في الجلسة<small>يعود الدرس كما كان قبل الجلسة</small></span></button></div>`
    );
  };
  function endSession(drop) {
    const sid = S.sess;
    S.lesson.pages.forEach(p => {
      if (drop) {
        p.items = p.items.filter(i => i.sn !== sid);
        p.items.forEach(i => {
          if (i.hs === sid) delete i.hs;
          if (i.t === 'wid') i.st = {};
        });
        if (p.sheet && p.sheet.hid0) {
          p.sheet.hid = p.sheet.hid0;
        }
      } else {
        p.items = p.items.filter(i => i.hs !== sid);
      }
      if (p.sheet) delete p.sheet.hid0;
      EB.initHist(p);
    });
    S.sess = 0;
    S.sel = [];
    EB.showAct();
    EB.mount(true);
    EB.save();
    EB.toast(drop ? 'حُذف شرح الجلسة' : 'حُفظ الشرح');
  }

  $('bMore').onclick = () => {
    EB.closeUI();
    const h = `<div class="kg-t">الصفحة</div><div class="kg"><button class="kr" data-a="pgset"><i class="ti ti-file-settings"></i><span class="kt">إعدادات الصفحة<small>الورق · الألوان · الخط · ترتيب الصفحات</small></span><i class="ti ti-chevron-left kch"></i></button></div><div class="kg-t">العرض والتسجيل</div><div class="kg"><button class="kr" data-a="focus"><i class="ti ti-presentation"></i><span class="kt">وضع العرض<small>إخفاء الأدوات ليبقى الدرس وحده</small></span><i class="ti ti-chevron-left kch"></i></button><button class="kr" data-a="rec"><i class="ti ti-video"></i><span class="kt">تسجيل الدرس<small>فيديو بصوتك مع الكتابة</small></span><i class="ti ti-chevron-left kch"></i></button></div><div class="kg-t">الدرس</div><div class="kg"><button class="kr" data-a="rename"><i class="ti ti-pencil"></i><span class="kt">تسمية الدرس<small></small></span><i class="ti ti-chevron-left kch"></i></button><button class="kr" data-a="export"><i class="ti ti-download"></i><span class="kt">تصدير الدرس<small>ملف يمكن فتحه لاحقاً</small></span><i class="ti ti-chevron-left kch"></i></button></div><div class="kg-t">عام</div><div class="kg"><button class="kr" data-a="settings"><i class="ti ti-settings"></i><span class="kt">الإعدادات<small>الصوت · معاني المصطلحات · الأدوات</small></span><i class="ti ti-chevron-left kch"></i></button></div>`;
    EB.sheet('الدرس: ' + S.lesson.name, h, null, e => {
      const a = e.target.closest('[data-a]');
      if (!a) return;
      const v = a.dataset.a;
      if (v === 'settings') {
        EB.closeSheet();
        EB.settingsSheet();
      } else if (v === 'pgset') {
        EB.closeSheet();
        EB.pageMenu();
      } else if (v === 'rec') {
        EB.closeSheet();
        EB.recordSheet();
      } else if (v === 'focus') {
        EB.closeSheet();
        document.body.classList.add('focus');
        $('rail').classList.remove('s');
      } else if (v === 'rename') {
        EB.closeSheet();
        $('bTitle').click();
      } else if (v === 'export') {
        EB.closeSheet();
        EB.exportLesson();
      }
    });
  };
  EB.exportLesson = async function () {
    await EB.flush();
    const o = await EduStore.exportLesson(S.lesson.id);
    const blob = new Blob([JSON.stringify(o)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (S.lesson.name || 'درس') + '.mishkat-lesson.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 1500);
    EB.toast('صُدّر الدرس');
  };

  EB.refreshUI = function () {
    const L = S.lesson,
      pg = page();
    if (!L || !pg) return;
    $('bTitle').innerHTML = `${esc(L.name)}<small>${esc(pg.title || ptype(pg)[1])}</small>`;
    $('bCnt').textContent = ar(S.pi + 1) + ' / ' + ar(L.pages.length);
    $('bPrev').disabled = S.pi === 0;
    $('bNext').disabled = S.pi === L.pages.length - 1;
    const book = pg.sheet && pg.sheet.kind === 'book';
    if (S.tool === 'hide' && !EB.hideAvail()) {
      S.tool = 'pen';
    }
    $('tools').innerHTML = EB.toolList()
      .map(
        t =>
          `<button class="tb${S.tool === t[0] ? ' on' : ''}" data-t="${t[0]}" aria-label="${t[2]}"><i class="ti ${t[1]}"></i>${t[2]}${EB.TS && EB.TS[t[0]] && EB.TS[t[0]].c && t[0] !== 'erase' ? `<i class="sw" style="background:${EB.TS[t[0]].c}"></i>` : ''}</button>`
      )
      .join('');
    $('bUndo').disabled = !(pg._h && pg._hi > 0);
    $('bRedo').disabled = !(pg._h && pg._hi < pg._h.length - 1);
    const sb = $('sessBtn');
    sb.classList.toggle('live', !!S.sess);
    sb.querySelector('span').textContent = S.sess ? 'جلسة جارية' : 'جلسة شرح';
    {
      const hs = !EB.hintOff && L.pages.length === 1 && !pg.items.length && !pg.sheet,
        was = $('hint').classList.contains('s');
      $('hint').classList.toggle('s', hs);
      if (was && !hs) EB.startChosen();
    }
    const hidn = EB.hiddenCount ? EB.hiddenCount() : 0;
    $('revealBtn').classList.toggle('s', !!hidn);
    if ($('rail').classList.contains('s')) EB.renderRail();
    S.dirty = 1;
    EB.renderPal && EB.renderPal();
  };
  $('rvNext').onclick = () => EB.revealStep(1);
  $('rvPrev').onclick = () => EB.revealStep(-1);

  addEventListener('keydown', e => {
    if (/INPUT|TEXTAREA/.test((e.target || {}).tagName)) {
      if (e.key === 'Escape') EB.closeUI();
      return;
    }
    const k = e.key,
      mod = e.ctrlKey || e.metaKey;
    if (mod && k === 'z') {
      e.preventDefault();
      e.shiftKey ? EB.redo() : EB.undo();
    } else if (mod && k === 'y') {
      e.preventDefault();
      EB.redo();
    } else if ((k === 'Delete' || k === 'Backspace') && S.sel.length) {
      EB.deleteSel();
    } else if (k === 'Escape') {
      EB.closeSheet();
      EB.closePop();
      S.sel = [];
      EB.showAct();
      S.dirty = 1;
      document.body.classList.remove('focus');
    } else if (k === 'ArrowRight' && !mod) EB.gotoPage(S.pi - 1);
    else if (k === 'ArrowLeft' && !mod) EB.gotoPage(S.pi + 1);
    else if (!mod) {
      const m = { p: 'pen', h: 'hl', e: 'erase', l: 'laser', v: 'select', m: 'hand' }[k.toLowerCase()];
      if (m) EB.setTool(m);
    }
  });
})();
