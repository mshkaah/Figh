(function () {
  'use strict';
  const EB = window.EB,
    S = EB.S,
    $ = EB.$,
    ar = EB.ar,
    esc = EB.esc,
    page = () => EB.page(),
    norm = s => EB.norm(s);
  const cnt = (n, one, two, few, many) =>
    n === 1 ? one : n === 2 ? two : n <= 10 ? ar(n) + ' ' + few : ar(n) + ' ' + many;
  const items = n => cnt(n, 'عنصر واحد', 'عنصران', 'عناصر', 'عنصراً');
  EB.bookPicker = async function (opts) {
    opts = opts || {};
    const me = (EB._bpN = (EB._bpN || 0) + 1);
    const B = EB.bridge;
    let groups = [];
    try {
      groups = B.groups
        ? await B.groups()
        : Object.values(
            (await B.books()).reduce((m, b) => {
              (m[b.author || 'أخرى'] = m[b.author || 'أخرى'] || { author: b.author || 'أخرى', books: [] }).books.push(
                b
              );
              return m;
            }, {})
          );
    } catch (e) {}
    if (!groups.length) {
      EB.sheet(
        'من كتاب',
        '<p class="n" style="font-size:15px">تعذّر الوصول إلى مكتبة الكتب. ادخل إلى السبورة من قسم «تعليم» داخل التطبيق.</p>'
      );
      return;
    }
    const bookMap = new Map();
    groups.forEach(g =>
      g.books.forEach(b => {
        b.author = b.author || g.author;
        bookMap.set(String(b.id), b);
      })
    );
    let recent = null,
      rpos = null;
    try {
      recent = B.recent ? await B.recent() : null;
      if (recent) {
        recent = bookMap.get(String(recent.id)) || recent;
        rpos = B.lastPos ? await B.lastPos(recent.id) : null;
      }
    } catch (e) {}
    const st = {
      view: 'lib',
      lq: '',
      bq: '',
      gopen: new Set(),
      book: null,
      secs: [],
      pos: null,
      exp: new Set(),
      blk: {},
      more: 120,
      pick: new Map(),
      order: [],
      preset: 'all',
      per: 2,
      flow: 'side',
      cards: false,
      styles: true,
      gloss: true,
      glfoot: false,
      hideAll: false,
      marg: false,
      adv: false,
      hits: null,
      undo: null,
      pv: null,
      rd: {},
      from: 'lib'
    };
    if (recent)
      groups.forEach((g, n) => {
        if (g.books.some(b => String(b.id) === String(recent.id))) st.gopen.add(n);
      });
    else if (groups.length <= 2) groups.forEach((g, n) => st.gopen.add(n));
    const pk = (b, i, k) => b.id + '|' + i + '|' + (k == null ? '' : k),
      bkey = (b, i) => b.id + '|' + i;
    const whole = (b, i) => st.pick.has(pk(b, i, null)),
      isSel = (b, i, k) => whole(b, i) || st.pick.has(pk(b, i, k));
    const selN = (b, i) => {
      if (whole(b, i)) return 'all';
      let n = 0;
      st.pick.forEach(x => {
        if (x.b.id === b.id && x.i === i) n++;
      });
      return n;
    };
    const alive = () => EB._bpN === me;
    const keepScroll = fn => {
      const y = $('shB').scrollTop;
      fn();
      $('shB').scrollTop = y;
    };
    $('sh').classList.add('tall');
    EB.onSheetClose = () => {
      setTimeout(() => {
        if (EB._bpN === me) $('sh').classList.remove('tall');
      }, 320);
    };
    document.addEventListener('keydown', () => {}, { once: true });

    const head = step => {
      $('shT').innerHTML =
        `<span class="bt">${opts.append ? 'إضافة إلى الصفحة من كتاب' : 'من كتاب'}</span><span class="bs"><em class="${step === 1 ? 'on' : 'dn'}"><b>${step === 1 ? '١' : '<i class="ti ti-check"></i>'}</b>الاختيار</em><span>·</span><em class="${step === 2 ? 'on' : ''}"><b>٢</b>الترتيب</em></span>`;
    };
    const tray = () => {
      const n = st.pick.size;
      if (st.undo)
        return `<div class="tray"><div class="tc"><b>مُسح الاختيار</b></div><button data-undo><i class="ti ti-arrow-back-up"></i>تراجع</button><button class="pri" data-next disabled>متابعة</button></div>`;
      return `<div class="tray"><div class="tc">${n ? `<b>${items(n)}</b><small>مختار${n === 1 ? '' : 'ة'}</small>` : '<small>اختر فصلاً كاملاً أو مسائل بعينها</small>'}</div><button data-clear ${n ? '' : 'disabled'}>مسح</button><button class="pri" data-next ${n ? '' : 'disabled'}>متابعة<i class="ti ti-arrow-left"></i></button></div>`;
    };
    const setTray = () => {
      if (st.view === 'arr') return;
      const f = $('shF');
      f.style.display = 'flex';
      f.innerHTML = tray();
    };
    const paint = (step, body, foot) => {
      EB.sheet('', body, foot, onClick);
      head(step);
    };
    const srch = (id, ph, val) =>
      `<div class="ksrch${val ? ' has' : ''}"><i class="ti ti-search"></i><input id="${id}" type="text" enterkeyhint="search" autocomplete="off" spellcheck="false" placeholder="${ph}" value="${esc(val)}"><button class="kx" data-qx aria-label="مسح البحث"><i class="ti ti-x"></i></button></div>`;

    let qT = 0,
      sTok = 0;
    const bindInput = id => {
      const el = $(id);
      if (!el) return;
      el.oninput = () => {
        if (st.view === 'lib') st.lq = el.value;
        else st.bq = el.value;
        el.parentNode.classList.toggle('has', !!el.value);
        fillRes();
        clearTimeout(qT);
        qT = setTimeout(doSearch, 220);
      };
      el.onkeydown = e => {
        if (e.key === 'Enter') {
          el.blur();
        }
      };
    };
    const fillRes = () => {
      const r = $('res');
      if (r) r.innerHTML = st.view === 'lib' ? libRes() : bookRes();
    };
    const doSearch = async () => {
      const q = st.view === 'lib' ? st.lq : st.bq,
        nq = norm(q).trim(),
        view = st.view;
      if (nq.replace(/\s/g, '').length < 2 || !B.search) {
        st.hits = null;
        return;
      }
      const tok = ++sTok;
      let r;
      try {
        r = await B.search(q, { book: view === 'book' ? st.book.id : null, limit: 40 });
      } catch (e) {
        r = { hits: [], mode: 'err' };
      }
      if (tok !== sTok || !alive()) return;
      st.hits = { q: nq, view, hits: (r && r.hits) || [], mode: (r && r.mode) || '' };
      if (st.view === view) fillRes();
    };
    const hitRows = () => {
      const q = norm(st.lq || st.bq).trim(),
        h = st.hits;
      if (q.replace(/\s/g, '').length < 2) return '';
      if (!B.search) return '';
      if (!h || h.q !== q || h.view !== st.view)
        return '<p class="n kld"><i class="ti ti-loader-2 spin"></i> جارٍ البحث في النصوص…</p>';
      if (!h.hits.length)
        return h.mode === 'noindex'
          ? '<p class="n">فهرس نصوص الكتب لم يجهز بعد، فتظهر هنا عناوين الكتب فقط. افتح كتاباً للبحث في فصوله ونصه.</p>'
          : '';
      return `<div class="kg-t">في الفصول والنصوص · ${ar(h.hits.length)}</div><div class="kg">${h.hits
        .map((x, n) => {
          let sn = esc(x.snip || '');
          if (x.hl && x.snip)
            sn =
              esc(x.snip.slice(0, x.hl[0])) +
              '<mark>' +
              esc(x.snip.slice(x.hl[0], x.hl[1])) +
              '</mark>' +
              esc(x.snip.slice(x.hl[1]));
          return `<button class="kr hit" data-hit="${n}"><i class="ti ti-file-text"></i><span class="kt"><b>${esc(x.title)}</b><small class="sn">${sn}</small>${st.view === 'lib' ? `<small class="bn">${esc(x.bookName)}</small>` : ''}</span><i class="ti ti-chevron-left kch"></i></button>`;
        })
        .join('')}</div>`;
    };

    const bookRow = b =>
      `<button class="kr" data-bk="${esc(b.id)}"><i class="ti ti-book-2"></i><span class="kt">${esc(b.name)}</span><i class="ti ti-chevron-left kch"></i></button>`;
    const libRes = () => {
      const q = norm(st.lq).trim(),
        ws = q.split(/\s+/).filter(Boolean);
      let h = '';
      if (!q) {
        if (recent)
          h += `<button class="kcard rec" data-cont><i class="ti ti-history"></i><span class="kt"><small>تابع من حيث توقفت</small><b>${esc(recent.name)}</b>${rpos ? `<small>${esc(rpos.title || 'الفصل ' + ar(rpos.idx + 1))}</small>` : ''}</span><i class="ti ti-chevron-left kch"></i></button>`;
        h += '<div class="kg-t">المراجع</div>';
        groups.forEach((g, n) => {
          const op = st.gopen.has(n);
          h += `<div class="kg grp${op ? ' open' : ''}"><button class="kr" data-g="${n}"><i class="ti ti-user-circle"></i><span class="kt"><b>${esc(g.author)}</b></span><span class="kv">${cnt(g.books.length, 'كتاب', 'كتابان', 'كتب', 'كتاباً')}</span><i class="ti ti-chevron-${op ? 'down' : 'left'} kch"></i></button>${op ? `<div class="kx">${g.books.map(bookRow).join('')}</div>` : ''}</div>`;
        });
        return h;
      }
      const bs = [];
      groups.forEach(g =>
        g.books.forEach(b => {
          const t = norm(b.name + ' ' + g.author);
          if (ws.every(w => t.includes(w))) bs.push(b);
        })
      );
      if (bs.length)
        h += `<div class="kg-t">الكتب · ${ar(bs.length)}</div><div class="kg">${bs
          .slice(0, 30)
          .map(
            b =>
              `<button class="kr" data-bk="${esc(b.id)}"><i class="ti ti-book-2"></i><span class="kt">${esc(b.name)}<small>${esc(b.author || '')}</small></span><i class="ti ti-chevron-left kch"></i></button>`
          )
          .join('')}</div>`;
      const hr = hitRows();
      h += hr;
      if (!bs.length && !hr) h += '<p class="n" style="text-align:center;padding:24px 0">لا نتائج.</p>';
      return h;
    };
    const lib = () => {
      st.view = 'lib';
      st.hits = null;
      paint(1, srch('q', 'ابحث عن كتاب أو فصل أو نص مسألة…', st.lq) + '<div id="res"></div>', tray());
      fillRes();
      bindInput('q');
      if (st.lq) doSearch();
    };

    const loadBlocks = async (b, i) => {
      const k = bkey(b, i);
      if (st.blk[k] !== undefined) return;
      st.blk[k] = null;
      try {
        st.blk[k] = B.blocks ? await B.blocks(b.id, i) : [];
      } catch (e) {
        st.blk[k] = [];
      }
    };
    const chRow = s => {
      const b = st.book,
        open = st.exp.has(s.i),
        n = selN(b, s.i);
      let r = `<button class="kr ch${open ? ' open' : ''}${n ? ' hasel' : ''}" data-ch="${s.i}" id="ch${s.i}" aria-expanded="${open}"><span class="kt"><b>${esc(s.title)}</b></span>${n ? `<span class="kv kcnt">${n === 'all' ? '<i class="ti ti-check"></i> كامل' : ar(n) + ' مختارة'}</span>` : ''}<i class="ti ti-chevron-${open ? 'up' : 'down'} kch"></i></button>`;
      if (open) {
        const bl = st.blk[bkey(b, s.i)];
        if (!bl) r += '<div class="kx"><p class="n kld"><i class="ti ti-loader-2 spin"></i> جارٍ التحميل…</p></div>';
        else {
          const w = whole(b, s.i);
          r += `<div class="kx"><div class="kr pk sub${w ? ' on' : ''}" data-w="${s.i}" role="checkbox" aria-checked="${w}"><span class="kt"><b>كامل الفصل</b>${bl.length > 1 ? `<small>${cnt(bl.length, 'مسألة', 'مسألتان', 'مسائل', 'مسألة')}</small>` : ''}</span><button class="kpv" data-pv="${s.i}" aria-label="معاينة الفصل"><i class="ti ti-eye"></i></button><span class="kc"><i class="ti ti-check"></i></span></div>`;
          if (bl.length > 1)
            r +=
              bl
                .slice(0, 300)
                .map(x => {
                  const on = isSel(b, s.i, x.k);
                  return `<div class="kr pk sub${on ? ' on' : ''}" data-b="${s.i}:${x.k}" role="checkbox" aria-checked="${on}"><span class="kt"><b>${esc(x.label)}</b><small class="sn">${esc(x.snip || '')}</small></span><button class="kpv" data-pv="${s.i}:${x.k}" aria-label="معاينة"><i class="ti ti-eye"></i></button><span class="kc"><i class="ti ti-check"></i></span></div>`;
                })
                .join('') +
              (bl.length > 300
                ? `<p class="n" style="padding:6px 14px">يُعرض أول ٣٠٠ مقطع، والباقي ضمن «كامل الفصل» أو المعاينة.</p>`
                : '');
          r += '</div>';
        }
      }
      return r;
    };
    const bookRes = () => {
      const q = norm(st.bq).trim(),
        ws = q.split(/\s+/).filter(Boolean);
      let h = '';
      if (!q && st.pos && st.secs[st.pos.idx])
        h += `<button class="kcard rec" data-ch="${st.pos.idx}"><i class="ti ti-bookmark"></i><span class="kt"><small>آخر موضع قرأتَ فيه</small><b>${esc(st.secs[st.pos.idx].title)}</b></span><i class="ti ti-chevron-left kch"></i></button>`;
      const list = st.secs.filter(s => !q || ws.every(w => norm(s.title).includes(w))),
        shown = list.slice(0, st.more);
      if (list.length)
        h += `<div class="kg-t">${q ? 'الفصول المطابقة' : 'الفصول'} · ${ar(list.length)}</div><div class="kg chs">${shown.map(chRow).join('')}</div>${list.length > st.more ? `<div class="row"><button data-more>عرض المزيد (${ar(list.length - st.more)})</button></div>` : ''}`;
      h += hitRows();
      if (q && !list.length && !h) h = '<p class="n" style="text-align:center;padding:24px 0">لا نتائج.</p>';
      return h;
    };
    const crumb = () => {
      const b = st.book;
      return `<div class="crumb"><button data-crumb="lib">المكتبة</button><i class="ti ti-chevron-left"></i><button data-crumb="grp">${esc(b.author || 'المراجع')}</button><i class="ti ti-chevron-left"></i><b>${esc(b.name)}</b></div>`;
    };
    const bookView = () => {
      st.view = 'book';
      st.hits = null;
      paint(1, crumb() + srch('bq', 'ابحث في فصول الكتاب ونصّه…', st.bq) + '<div id="res"></div>', tray());
      fillRes();
      bindInput('bq');
      if (st.bq) doSearch();
    };
    const scrollTo = i => {
      const el = $('ch' + i);
      if (el) el.scrollIntoView({ block: 'start' });
    };
    const openBook = async (b, at) => {
      EB.toast('جارٍ فتح الكتاب…', 8000);
      st.book = b;
      st.bq = '';
      st.exp = new Set();
      st.more = 120;
      st.pos = null;
      st.secs = [];
      try {
        st.secs = await B.sections(b.id);
        st.pos = B.lastPos ? await B.lastPos(b.id) : null;
      } catch (e) {}
      $('toast').classList.remove('s');
      if (!alive()) return;
      if (at != null && st.secs[at]) {
        st.exp = new Set([at]);
        st.more = Math.max(120, at + 20);
        await loadBlocks(b, at);
      }
      bookView();
      if (at != null && st.exp.size) scrollTo(at);
    };
    const expand = async i => {
      if (st.exp.has(i)) {
        st.exp.delete(i);
        return keepScroll(fillRes);
      }
      st.exp.add(i);
      keepScroll(fillRes);
      await loadBlocks(st.book, i);
      if (st.exp.has(i) && st.view === 'book') keepScroll(fillRes);
    };
    const toggleWhole = (b, i, title) => {
      const k = pk(b, i, null);
      if (st.pick.has(k)) st.pick.delete(k);
      else {
        [...st.pick.keys()].forEach(x => {
          if (x.startsWith(b.id + '|' + i + '|')) st.pick.delete(x);
        });
        st.pick.set(k, { b, i, k: null, title });
      }
    };
    const toggleBlock = (b, i, k, bl, secTitle) => {
      const lab = (bl.find(x => x.k === k) || {}).label || 'فقرة ' + (k + 1);
      if (whole(b, i)) {
        st.pick.delete(pk(b, i, null));
        bl.forEach(x => {
          if (x.k !== k) st.pick.set(pk(b, i, x.k), { b, i, k: x.k, title: secTitle + ' — ' + x.label });
        });
      } else if (st.pick.has(pk(b, i, k))) st.pick.delete(pk(b, i, k));
      else st.pick.set(pk(b, i, k), { b, i, k, title: secTitle + ' — ' + lab });
    };
    const secTitle = i => (st.secs[i] && st.secs[i].title) || '';
    const afterPick = () => {
      st.undo = null;
      if (st.view === 'prev') keepScroll(pvView);
      else keepScroll(fillRes);
      setTray();
    };

    async function rdLoad(b, i) {
      const k = bkey(b, i);
      if (st.rd[k]) return;
      st.rd[k] = null;
      try {
        if (B.parts) st.rd[k] = await B.parts(b.id, i, { styles: true, gloss: true });
        else {
          const r = await B.section(b.id, i, {});
          st.rd[k] = [
            {
              k: 0,
              label: 'النص',
              html: r && r.html ? r.html : '<div>' + esc((r && r.body) || '') + '</div>',
              body: r ? r.body : ''
            }
          ];
        }
      } catch (e) {
        st.rd[k] = [];
      }
    }
    const pvView = () => {
      st.view = 'prev';
      const b = st.book,
        i = st.pv.i,
        ps = st.rd[bkey(b, i)],
        w = whole(b, i);
      let h = `<div class="crumb"><button data-pvb><i class="ti ti-chevron-right"></i>رجوع إلى الفصول</button></div><div class="pvt"><button class="ib" data-pvn="-1" aria-label="الفصل السابق" ${i <= 0 ? 'disabled' : ''}><i class="ti ti-chevron-right"></i></button><div class="kt"><b>${esc(secTitle(i))}</b><small>${esc(b.name)} · ${ar(i + 1)} من ${ar(st.secs.length)}</small></div><button class="ib" data-pvn="1" aria-label="الفصل التالي" ${i >= st.secs.length - 1 ? 'disabled' : ''}><i class="ti ti-chevron-left"></i></button></div>`;
      h += `<div class="kg"><div class="kr pk${w ? ' on' : ''}" data-pvw role="checkbox" aria-checked="${w}"><span class="kt"><b>كامل الفصل</b><small>أو اضغط المسائل التي تريدها</small></span><span class="kc"><i class="ti ti-check"></i></span></div></div>`;
      if (!ps)
        h +=
          '<p class="n kld" style="text-align:center;padding:30px"><i class="ti ti-loader-2 spin"></i> جارٍ التحميل…</p>';
      else if (!ps.length) h += '<p class="n" style="text-align:center;padding:30px">لا نص في هذا الفصل.</p>';
      else
        h += `<div class="pvl">${ps
          .map(p => {
            const on = isSel(b, i, p.k);
            return `<div class="pvb${on ? ' on' : ''}" data-pb="${p.k}" id="pb${p.k}"><div class="pvh"><b>${esc(p.label)}</b><span class="kc${on ? ' on' : ''}"><i class="ti ti-check"></i></span></div><div class="bk m-text">${EB.cleanHtml(p.html)}</div></div>`;
          })
          .join('')}</div>`;
      paint(1, h, tray());
    };
    const openPv = async (i, k) => {
      st.pv = { i };
      await rdLoad(st.book, i);
      pvView();
      if (k != null) {
        const el = $('pb' + k);
        if (el) el.scrollIntoView({ block: 'start' });
      }
    };

    const reconcile = () => {
      const rank = new Map();
      st.pick.forEach(x => {
        if (!rank.has(x.b.id)) rank.set(x.b.id, rank.size);
      });
      const keep = st.order.filter(x => st.pick.get(pk(x.b, x.i, x.k)) === x),
        inK = new Set(keep);
      const fresh = [...st.pick.values()]
        .filter(x => !inK.has(x))
        .sort(
          (a, c) => rank.get(a.b.id) - rank.get(c.b.id) || a.i - c.i || (a.k == null ? -1 : c.k == null ? 1 : a.k - c.k)
        );
      st.order = keep.concat(fresh);
    };
    const perNow = () => {
      const n = st.order.length;
      if (opts.append || st.cards) return Math.max(1, n);
      return st.preset === 'all' ? Math.max(1, n) : st.preset === 'one' ? 1 : Math.max(1, Math.min(st.per, n));
    };
    const sw = (key, label, hint, off, why) =>
      `<button class="kr" data-t="${key}" role="switch" aria-checked="${off ? false : !!st[key]}" ${off ? 'disabled' : ''}><span class="kt">${label}<small>${off ? why : hint}</small></span><span class="ksw${!off && st[key] ? ' on' : ''}"></span></button>`;
    const arr = () => {
      st.view = 'arr';
      reconcile();
      const o = st.order;
      if (!o.length) {
        return st.from === 'book' ? bookView() : lib();
      }
      const per = perNow(),
        pages = Math.ceil(o.length / per),
        lock = opts.append || st.cards;
      const why = opts.append ? 'غير متاح عند الإضافة إلى صفحة قائمة' : 'غير متاح في وضع البطاقات';
      const opt = (attr, ic, t, d, on, dis, extra) =>
        `<button class="opt${on ? ' on' : ''}" ${attr} ${dis ? 'disabled' : ''}><i class="ti ${ic}"></i><span class="kt"><b>${t}</b><small>${d}</small></span><span class="rd"></span></button>${extra || ''}`;
      let h = `<div class="kg-t">كيف يظهر النص على السبورة؟</div><div class="opts">${opt('data-view="0"', 'ti-file-text', 'ورقة كتاب متصلة', 'النص كاملاً كما في الكتاب على ورقة واحدة، تكتب عليه وتخفي منه وتكشف.', !st.cards)}${opt('data-view="1"', 'ti-cards', 'بطاقات منفصلة', 'كل مسألة بطاقة مستقلة تحرّكها وتكبّرها وترتّبها كما تشاء.', st.cards)}</div>`;
      if (st.cards && o.length > 1)
        h += `<div class="kg-t">كيف تُرتَّب البطاقات؟</div><div class="opts">${opt('data-flow="side"', 'ti-layout-columns', 'جنباً إلى جنب', 'تُوزَّع في عمودين متجاورين ليظهر أكثر من بطاقة معاً.', st.flow !== 'stack')}${opt('data-flow="stack"', 'ti-layout-rows', 'فوق بعض', 'بطاقة تحت بطاقة في عمود واحد.', st.flow === 'stack')}</div>`;
      h += `<div class="kg-t">كم صفحة تريد؟</div>${lock ? `<p class="n" style="margin:0 4px 8px">${why}</p>` : ''}<div class="opts">${opt('data-preset="all"', 'ti-file', 'كل شيء في صفحة واحدة', 'تجتمع كل المسائل المختارة في صفحة واحدة.', !lock && st.preset === 'all', lock)}${opt('data-preset="one"', 'ti-files', 'صفحة لكل مسألة', 'تُنشأ صفحة مستقلة لكل مسألة تختارها.', !lock && st.preset === 'one', lock)}${opt('data-preset="custom"', 'ti-adjustments', 'أحدد العدد بنفسي', 'أنت تقرر كم مسألة في كل صفحة.', !lock && st.preset === 'custom', lock)}</div>`;
      if (!lock && st.preset === 'custom')
        h += `<div class="kcard strow2"><span class="kt">عدد المسائل في الصفحة<small>${cnt(pages, 'صفحة واحدة', 'صفحتان', 'صفحات', 'صفحة')}</small></span><div class="kstep"><button data-per="-1" aria-label="أقل" ${per <= 1 ? 'disabled' : ''}><i class="ti ti-minus"></i></button><b>${ar(per)}</b><button data-per="1" aria-label="أكثر" ${per >= o.length ? 'disabled' : ''}><i class="ti ti-plus"></i></button></div></div>`;
      h += `<div class="kg-t pgt"><span>${opts.append ? 'ما سيُضاف' : st.cards ? 'البطاقات' : 'الصفحات الناتجة · ' + cnt(pages, 'صفحة', 'صفحتان', 'صفحات', 'صفحة')}</span><small>اسحب <i class="ti ti-grip-vertical"></i> لإعادة الترتيب</small></div><div id="pgs">`;
      for (let g = 0, n = 0; n < o.length; g++, n += per) {
        const part = o.slice(n, n + per);
        h += `<section class="kcard pgc"><div class="pgh"><b><i class="ti ti-${opts.append ? 'file-plus' : 'file-text'}"></i>${opts.append ? 'الصفحة الحالية — تُضاف في آخرها' : st.cards ? 'صفحة جديدة — بطاقات' : 'صفحة ' + ar(g + 1)}</b><small>${items(part.length)}</small></div>${part.map((x, j) => `<div class="orw2" data-i="${n + j}"><i class="ti ti-grip-vertical grip" aria-label="اسحب للترتيب"></i><span class="tt">${esc(x.title)}${st.pick.size > 0 && groups.length > 1 && new Set(o.map(y => y.b.id)).size > 1 ? `<small>${esc(x.b.name)}</small>` : ''}</span><button class="rmx" data-rm="${n + j}" aria-label="حذف"><i class="ti ti-x"></i></button></div>`).join('')}</section>`;
      }
      h += `</div><div class="kg-t">تخصيص النص</div><div class="kg">`;
      h +=
        sw('styles', 'ألوان الكتاب وترقيم المسائل', 'تبقى الأرقام والأجوبة بألوانها كما في الكتاب.') +
        sw('gloss', 'المصطلحات تفاعلية', 'تظهر المصطلحات بخط منقّط، ويظهر معناها عند الضغط عليها.') +
        sw(
          'glfoot',
          'اكتب معاني المصطلحات أسفل ' + (st.cards ? 'كل بطاقة' : 'الصفحة'),
          st.cards
            ? 'يُضاف صندوق بمعاني مصطلحات كل بطاقة في أسفلها.'
            : 'تُجمع معاني مصطلحات النص تلقائياً في صندوق أسفل الورقة.'
        ) +
        (st.cards
          ? ''
          : sw('marg', 'مساحة للشرح', 'يُترك هامش فارغ بجوار النص لتكتب فيه شرحك.', opts.append, why) +
            sw(
              'hideAll',
              'إخفاء النص وكشفه تدريجياً',
              'يبدأ النص مخفياً وتكشفه جزءاً جزءاً أثناء الشرح.',
              opts.append,
              why
            ));
      h += '</div>';
      paint(
        2,
        h,
        `<button data-back><i class="ti ti-arrow-right"></i>رجوع</button><button class="pri" data-go>${opts.append ? 'إضافة إلى هذه الصفحة (' + ar(o.length) + ')' : st.cards ? 'إضافة ' + cnt(o.length, 'بطاقة', 'بطاقتين', 'بطاقات', 'بطاقة') : 'إضافة ' + cnt(pages, 'صفحة', 'صفحتين', 'صفحات', 'صفحة')}</button>`
      );
      EB.dragSort($('pgs'), '.orw2', ord => {
        const old = st.order.slice();
        st.order = ord.map(k => old[k]);
        keepScroll(arr);
      });
    };

    async function onClick(e) {
      const t = e.target,
        d = k => {
          const el = t.closest('[' + k + ']');
          return el ? el.getAttribute(k) : null;
        };
      if (st.view === 'arr') {
        const bt = t.closest('button');
        if (!bt || bt.disabled) return;
        const x = bt.dataset,
          o = st.order;
        if (x.back !== undefined) {
          return st.from === 'book' ? bookView() : lib();
        }
        if (x.go !== undefined) return add();
        if (x.flow !== undefined) {
          st.flow = x.flow;
          return keepScroll(arr);
        }
        if (x.view !== undefined) {
          st.cards = x.view === '1';
          return keepScroll(arr);
        }
        if (x.preset) {
          st.preset = x.preset;
          if (x.preset === 'custom') st.per = Math.max(1, Math.min(o.length, st.per));
          return keepScroll(arr);
        }
        if (x.per) {
          st.per = Math.max(1, Math.min(o.length, st.per + +x.per));
          return keepScroll(arr);
        }
        if (x.rm !== undefined) {
          const r = o.splice(+x.rm, 1)[0];
          st.pick.delete(pk(r.b, r.i, r.k));
          st.per = Math.max(1, Math.min(st.per, o.length));
          return keepScroll(arr);
        }
        if (x.adv !== undefined) {
          st.adv = !st.adv;
          return keepScroll(arr);
        }
        if (x.t) {
          st[x.t] = !st[x.t];
          return keepScroll(arr);
        }
        return;
      }
      if (d('data-clear') !== null && t.closest('[data-clear]') && !t.closest('[data-clear]').disabled) {
        st.undo = new Map(st.pick);
        st.pick.clear();
        st.undoT = setTimeout(() => {
          st.undo = null;
          if (alive() && st.view !== 'arr') setTray();
        }, 7000);
        keepScroll(fillRes);
        if (st.view === 'prev') keepScroll(pvView);
        return setTray();
      }
      if (t.closest('[data-undo]')) {
        clearTimeout(st.undoT);
        st.pick = st.undo || st.pick;
        st.undo = null;
        if (st.view === 'prev') keepScroll(pvView);
        else keepScroll(fillRes);
        return setTray();
      }
      if (t.closest('[data-next]')) {
        const nb = t.closest('[data-next]');
        if (nb.disabled) return;
        st.from = st.view === 'lib' ? 'lib' : 'book';
        if (st.view === 'prev') st.from = 'book';
        return arr();
      }
      if (t.closest('[data-qx]')) {
        const id = st.view === 'lib' ? 'q' : 'bq',
          el = $(id);
        if (st.view === 'lib') st.lq = '';
        else st.bq = '';
        el.value = '';
        el.parentNode.classList.remove('has');
        fillRes();
        el.focus();
        return;
      }
      if (st.view === 'prev') {
        const b = st.book,
          i = st.pv.i;
        if (t.closest('[data-pvb]')) {
          st.exp.add(i);
          return (bookView(), scrollTo(i));
        }
        const nv = d('data-pvn');
        if (nv !== null) {
          const j = i + +nv;
          if (j < 0 || j >= st.secs.length) return;
          st.pv = { i: j };
          await rdLoad(b, j);
          pvView();
          $('shB').scrollTop = 0;
          return;
        }
        if (t.closest('[data-pvw]')) {
          toggleWhole(b, i, secTitle(i));
          return afterPick();
        }
        const pb = d('data-pb');
        if (pb !== null) {
          const ps = st.rd[bkey(b, i)];
          toggleBlock(b, i, +pb, ps, secTitle(i));
          return afterPick();
        }
        return;
      }

      const g = d('data-g');
      if (g !== null) {
        const n = +g;
        st.gopen.has(n) ? st.gopen.delete(n) : st.gopen.add(n);
        return keepScroll(fillRes);
      }
      const bk = d('data-bk');
      if (bk !== null) {
        const b = bookMap.get(bk);
        if (b) return openBook(b);
      }
      if (t.closest('[data-cont]') && recent) return openBook(recent, rpos && rpos.idx != null ? rpos.idx : null);
      const hit = d('data-hit');
      if (hit !== null && st.hits) {
        const x = st.hits.hits[+hit];
        if (!x) return;
        if (st.view === 'lib') {
          const b = bookMap.get(String(x.bookId)) || { id: x.bookId, name: x.bookName, author: x.author };
          return openBook(b, x.i);
        }
        st.bq = '';
        st.more = Math.max(120, x.i + 20);
        st.exp = x.i;
        await loadBlocks(st.book, x.i);
        return (bookView(), scrollTo(x.i));
      }
      const cr = d('data-crumb');
      if (cr !== null) {
        st.lq = '';
        if (cr === 'grp') {
          const n = groups.findIndex(g2 => g2.books.some(b => String(b.id) === String(st.book.id)));
          if (n >= 0) st.gopen.add(n);
        }
        return lib();
      }
      if (t.closest('[data-more]')) {
        st.more += 200;
        return keepScroll(fillRes);
      }
      const pv = d('data-pv');
      if (pv !== null) {
        const [i, k] = pv.split(':');
        return openPv(+i, k == null ? null : +k);
      }
      const ch = d('data-ch');
      if (ch !== null) {
        return expand(+ch);
      }
      const w = d('data-w');
      if (w !== null) {
        toggleWhole(st.book, +w, secTitle(+w));
        return afterPick();
      }
      const bb = d('data-b');
      if (bb !== null) {
        const [i, k] = bb.split(':').map(Number);
        toggleBlock(st.book, i, k, st.blk[bkey(st.book, i)] || [], secTitle(i));
        return afterPick();
      }
    }

    const sec = (x, o2) =>
      B.section(x.b.id, x.i, { styles: st.styles, gloss: st.gloss, blocks: x.k == null ? null : [x.k] });
    const bookNames = list => [...new Set(list.map(x => x.b.name))].join(' · ');
    async function add() {
      if (st.cards) return addCards();
      if (opts.append) return addMore();
      const o = st.order,
        per = perNow(),
        groupsP = [];
      for (let n = 0; n < o.length; n += per) groupsP.push(o.slice(n, n + per));
      EB.toast('جارٍ تجهيز الصفحات…', 30000);
      const dk = document.documentElement.dataset.theme === 'dark',
        first = S.pi + 1;
      let made = 0;
      for (const grp of groupsP) {
        const parts = [];
        for (const x of grp) {
          const r = await sec(x);
          if (r) parts.push({ title: x.title, html: EB.cleanHtml(r.html || ''), body: r.body });
        }
        if (!parts.length) continue;
        const html = EB.partsHtml(parts);
        const title = parts.length > 1 ? parts[0].title + ' (+' + ar(parts.length - 1) + ')' : parts[0].title;
        const sheet = {
          parts,
          kind: 'book',
          bookId: grp[0].b.id,
          book: bookNames(grp),
          author: grp[0].b.author || '',
          title,
          html,
          body: parts.map(p => p.body).join('\n'),
          mode: 'text',
          hid: [],
          fs: 30,
          lh: 2.1,
          marg: st.marg,
          gloss: st.gloss,
          glAuto: !!st.glfoot,
          col: dk ? '#1e1926' : '#ffffff'
        };
        if (st.hideAll) sheet.hid = Array.from({ length: EB.units(sheet).length }, (_, k) => k);
        const pg = EB.newPage({ type: 'book', title: title.slice(0, 22), sheet, grid: 'dots' });
        S.lesson.pages.splice(first + made, 0, pg);
        EB.initHist(pg);
        made++;
      }
      EB.closeSheet();
      $('toast').classList.remove('s');
      if (!made) {
        EB.toast('لم يُضف شيء');
        return;
      }
      EB.gotoPage(first);
      EB.save();
      EB.toast('أُضيفت ' + ar(made) + ' صفحة من «' + bookNames(o) + '»');
    }
    async function addCards() {
      EB.toast('جارٍ تجهيز البطاقات…', 30000);
      const o = st.order;
      let made = 0,
        pg = page();
      if (!opts.append) {
        const np = EB.newPage({ title: (o[0].b.name || 'بطاقات').slice(0, 22), grid: 'dots' });
        S.lesson.pages.splice(S.pi + 1, 0, np);
        EB.initHist(np);
        EB.gotoPage(S.pi + 1);
        pg = page();
      }

      const c = EB.vc(),
        cols = st.flow === 'stack' ? 1 : Math.min(2, o.length),
        CW = 640,
        GAP = 44,
        total = cols * CW + (cols - 1) * GAP,
        cx = opts.append ? c.x : 0;
      const xAt = k => cx + total / 2 - CW - k * (CW + GAP);
      let y = opts.append ? c.y - 100 : 40,
        rowH = 0,
        col = 0;
      for (const x of o) {
        const r = await sec(x);
        if (!r) continue;
        let ch = EB.cleanHtml(r.html || '');
        if (st.glfoot) ch += await EB.glFooter(ch);
        const w = EB.W.make('bk', { title: x.title, html: ch, book: x.b.name }, xAt(col), y);
        pg.items.push(w);
        EB.mountWidgets();
        await new Promise(r2 => setTimeout(r2, 30));
        const hh = w._el ? w._el.offsetHeight : 300;
        rowH = Math.max(rowH, hh);
        if (++col >= cols) {
          col = 0;
          y += rowH + GAP;
          rowH = 0;
        }
        made++;
      }
      EB.closeSheet();
      $('toast').classList.remove('s');
      S.dirty = 1;
      EB.commit && EB.commit();
      EB.fit && EB.fit();
      EB.save();
      EB.toast('أُضيفت ' + ar(made) + ' بطاقة');
    }
    async function addMore() {
      const sh = page().sheet;
      sh.parts = sh.parts || [{ title: sh.title, html: sh.html || '', body: sh.body || '' }];
      EB.toast('جارٍ الإضافة…', 15000);
      for (const x of st.order) {
        const r = await sec(x);
        if (r) sh.parts.push({ title: x.title, html: EB.cleanHtml(r.html || ''), body: r.body });
      }
      EB.syncParts(sh);
      EB.closeSheet();
      $('toast').classList.remove('s');
      EB.save();
      EB.toast('أُضيفت العناصر إلى الصفحة');
    }
    lib();
  };

  EB.glFooter = async function (html) {
    if (!EB.bridge || !EB.bridge.defs) return '';
    const off = (EB.CF && EB.CF.glOff) || [],
      keys = [...new Set([...String(html).matchAll(/data-g="([^"]+)"/g)].map(m => m[1]))].slice(0, 12);
    const r = (
      await Promise.all(
        keys.map(async k => {
          try {
            const d = ((await EB.bridge.defs(k)) || []).filter(x => !off.includes(x.s || ''));
            return d[0] ? { k, t: d[0].t } : null;
          } catch (e) {
            return null;
          }
        })
      )
    ).filter(Boolean);
    return r.length
      ? `<div class="gl"><h5>معاني المصطلحات</h5>${r.map(g => `<p><b>${esc(g.k)}:</b> ${esc(g.t)}</p>`).join('')}</div>`
      : '';
  };
  const pin = (term, m) => {
    const pg = page(),
      c = EB.vc(),
      w = EB.W.make(
        'bk',
        { title: term, book: m.s || 'معنى المصطلح', html: '<div class="mb">' + esc(m.t) + '</div>', fs: 26, gl: 1 },
        null,
        null
      );
    w.w = 440;
    w.x = c.x - 220;
    w.y = c.y - 90;
    pg.items.push(w);
    EB.mountWidgets();
    S.sel = [w];
    EB.closeSheet();
    EB.closePop && EB.closePop();
    EB.setTool('select');
    EB.showAct();
    EB.commit();
    S.dirty = 1;
    EB.toast('ثبّتُّ المعنى — اسحبه لمكانه');
  };

  EB.glossPop = async function (term, el) {
    let d = [];
    try {
      d = EB.bridge.defs ? await EB.bridge.defs(term) : [];
    } catch (e) {}
    const off = (EB.CF && EB.CF.glOff) || [];
    d = d.filter(x => !off.includes(x.s || ''));
    const can = d.length && S.lesson,
      bubble = !(EB.CF && EB.CF.glView === 'sheet') && el && el.getBoundingClientRect;
    const body = d.length
      ? d
          .map(
            (x, i) =>
              `<div class="gdef"><p>${esc(x.t)}</p><div class="gd-f">${x.s ? `<small>${esc(x.s)}</small>` : '<span></span>'}${can ? `<button class="kchip pin" data-pin="${i}"><i class="ti ti-pin"></i>تثبيت</button>` : ''}</div></div>`
          )
          .join('')
      : '<p class="n">لا يوجد معنى مسجّل لهذا المصطلح.</p>';
    if (bubble) {
      EB.openPop(`<div class="gbub">${body}</div>`, el, {
        mode: 'gl',
        title: term,
        avoid: el.getBoundingClientRect() && {
          l: el.getBoundingClientRect().left,
          t: el.getBoundingClientRect().top,
          r: el.getBoundingClientRect().right,
          b: el.getBoundingClientRect().bottom
        }
      });
      $('pop')._on = e => {
        const x = e.target.closest('[data-pin]');
        if (!x) return;
        const m = d[+x.dataset.pin];
        if (m) pin(term, m);
      };
      return;
    }
    EB.sheet(
      term,
      body +
        (can
          ? '<p class="n" style="margin:8px 2px 0">التثبيت يضع المعنى في بطاقة تحرّكها وتكبّرها وتضعها حيث تشاء.</p>'
          : ''),
      null,
      e => {
        const x = e.target.closest('[data-pin]');
        if (!x) return;
        const m = d[+x.dataset.pin];
        if (m) pin(term, m);
      }
    );
  };
})();
