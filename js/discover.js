(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const q = (s, r) => (r || document).querySelector(s);
  const qa = (s, r) => Array.from((r || document).querySelectorAll(s));
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const lsDel = (k) => { try { localStorage.removeItem(k); } catch (e) {} };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const arNum = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const embedded = () => { try { return !!isEmbeddedMode; } catch (e) { return false; } };
  const RSD = (window.RSD = window.RSD || {});
  RSD.util = { $, q, qa, lsGet, lsSet, esc, arNum, sleep };
  if (embedded()) { RSD.embedded = true; return; }

  const userOff = () => lsGet('rs_hints_off', '0') === '1';
  const GK = (k, icon) => (k === 'swipe' || k === 'two')
    ? `<span class="gk ic k-${k}"><i class="ti ti-${icon || (k === 'swipe' ? 'arrows-horizontal' : 'arrows-vertical')}"></i></span>`
    : `<span class="gk ic k-${k}"><i class="ti ti-hand-finger"></i></span>`;
  RSD.GK = GK;
  const DOTS = (n) => `<span class="dc-dots n${n}"><i></i>${n > 1 ? '<i></i>' : ''}</span>`;
  RSD.DOTS = DOTS;
  const pref = (k, d) => { try { return !!RSUI.pref(k); } catch (e) { return d; } };
  const gestCfg = () => { const d = { copyLong: 'share', starDbl: 1, starLong: 1, hlDbl: 1, hlLong: 1, hlMode: 'tap', starMode: 'tap' }; try { return Object.assign(d, JSON.parse(lsGet('rs_cs_gest', '{}')) || {}); } catch (e) { return d; } };

  const GROUPS = [['read', 'أثناء القراءة'], ['search', 'في البحث'], ['lists', 'المكتبة والقوائم'], ['jami', 'في الجامع']];
  const FEATURES = [
    { id: 'tools', grp: 'read', ic: 'pointer', keys: ['tools'], t: 'أدوات المسألة', s: 'عند النقر على أي مسألة تظهر أدواتها: النسخ والنجمة والملاحظة وإضافتها إلى كتاب خاص. وهي مخفية إلى أن تُنقر المسألة.', g: [['tap', 'نقرة على المسألة']] },
    { id: 'copy', grp: 'read', ic: 'share-3', keys: ['copy'], t: 'النسخ والمشاركة كصورة', s: 'الضغط المطوّل على زر النسخ يحوّل المسألة إلى بطاقة صورة تتضمن اسم المرجع والمصدر، جاهزة للمشاركة.', g: [['tap', 'ضغطة', 'نسخ النص'], ['long', 'مطوّلة', 'مشاركة كصورة']], req: () => true },
    { id: 'star', grp: 'read', ic: 'star', keys: ['star'], t: 'النجمة بثلاثة ألوان', s: 'تُحفظ المسألة في المفضلة بلون يُختار من زر واحد، وتُفرز المفضلة بحسب الألوان.', g: [['tap', 'ضغطة', 'اللون الأول'], ['dbl', 'ضغطتان', 'اللون الثاني'], ['long', 'مطوّلة', 'جميع الألوان']] },
    { id: 'select', grp: 'read', ic: 'highlight', keys: ['select'], t: 'تحديد النص', s: 'يُضغط مطوّلاً على كلمة ثم يُسحب المقبضان لتحديد المقطع المطلوب، فيظهر شريط يتضمن التظليل والنسخ وغيرهما.', g: [['long', 'مطوّلة على كلمة']], req: () => !!(window.RSSelect && RSSelect.enabledNow ? RSSelect.enabledNow() : true) },
    { id: 'hl', grp: 'read', ic: 'palette', keys: ['hl'], t: 'التظليل بثلاثة ألوان', s: 'في شريط التحديد، وبالحركات نفسها المستعملة مع النجمة.', g: [['tap', 'ضغطة', 'اللون الأول'], ['dbl', 'ضغطتان', 'اللون الثاني'], ['long', 'مطوّلة', 'جميع الألوان']], req: () => !!(window.RSSelect && RSSelect.enabledNow ? RSSelect.enabledNow() : true) },
    { id: 'swipe', grp: 'read', ic: 'arrows-horizontal', keys: ['swipe'], t: 'التنقل بين الأبواب بالسحب', s: 'بإصبع واحد على النص: السحب لليمين ينقل إلى الفصل التالي، ولليسار إلى الفصل السابق.', g: [['swipe', 'لليمين', 'التالي'], ['swipe', 'لليسار', 'السابق']], req: () => pref('swipe', true) },
    { id: 'pin', grp: 'read', ic: 'map-pin', keys: ['pin', 'pinGuide'], t: 'الدبوس: حفظ الموضع', s: 'يحفظ موضع القراءة في كل كتاب للعودة إليه من أي كتاب آخر، ويتيح قراءة كتابين معاً في شاشة مقسومة.', g: [['tap', 'ضغطة', 'المواقع المحفوظة'], ['dbl', 'ضغطتان', 'تتبّع الكتاب'], ['long', 'مطوّلة', 'تقسيم الشاشة']] },
    { id: 'auto', grp: 'read', ic: 'hand-two-fingers', keys: ['auto'], t: 'التمرير التلقائي', s: 'السحب بإصبعين للأسفل يحرّك الكتاب تلقائياً أثناء القراءة. ولمسة واحدة توقفه، وتُضبط سرعته من الإعدادات الإضافية.', g: [['two', 'سحب بإصبعين']] },
    { id: 'pinch', grp: 'read', ic: 'zoom-in', keys: ['pinch'], t: 'تكبير الخط بإصبعين', s: 'مباعدة الإصبعين تكبّر الخط وتقريبهما يصغّره، في القراءة والشروح والجامع.', g: [['two', 'مباعدة أو تقريب', '', 'zoom-in']], req: () => pref('pinch', true) },
    { id: 'sbar', grp: 'read', ic: 'adjustments-horizontal', keys: ['sbar'], t: 'الشريط الجانبي', s: 'الشريط الرفيع على حافة الشاشة أثناء التمرير: يُنقر عليه أو يُسحب للانتقال السريع داخل الباب.', g: [['tap', 'نقر أو سحب']] },
    { id: 'toc', grp: 'read', ic: 'list', keys: ['toc'], t: 'فهرس الكتاب', s: 'النقر على اسم الكتاب في أعلى الشاشة يفتح فهرسه، وفيه خانة بحث داخل هذا الكتاب وحده.', g: [['tap', 'نقرة على اسم الكتاب']] },
    { id: 'words', grp: 'read', ic: 'underline', keys: ['gloss', 'fn'], t: 'الكلمات المسطّرة وأرقام الحواشي', s: 'النقر على الكلمة المسطّرة يعرض معناها، وعلى الرقم الصغير يعرض نص الحاشية.', g: [['tap', 'نقرة']] },
    { id: 'flags', grp: 'read', ic: 'book-2', keys: ['sharhFlag'], t: 'علامة الشرح', s: 'أيقونة الكتاب بجانب رقم المسألة تعني وجود شرح لها (نصاً أو فيديو).', g: [['tap', 'نقرة على العلامة']] },
    { id: 'refSet', grp: 'read', ic: 'adjustments', keys: ['refSet'], t: 'التحكم بهوامش المراجع', s: 'في العروة الوثقى والثمرة: ترتيب أولوية المراجع في الهوامش، وإخفاء من لا يُراد، وتلوين من يُراد تمييزه.', g: [['tap', 'زر الإعدادات أعلى الكتاب']] },

    { id: 'searchTools', grp: 'search', ic: 'filter-cog', keys: ['searchTools'], t: 'الاستثناء والتثبيت وخيارات البحث', s: '«استثناء» يُخرج من النتائج ما يحوي كلمة معيّنة، و«تثبيت» يُلزم كل نتيجة بوجود كلمة معيّنة، و«خيارات البحث» تحدد طريقة المطابقة ومكان البحث.', g: [['tap', 'أزرار شريط البحث']] },
    { id: 'presets', grp: 'search', ic: 'bookmark-plus', keys: ['filterGuide'], t: 'تصفية المراجع وحفظها كاختصار', s: 'تُحدَّد المراجع والكتب التي يشملها البحث ثم يُضغط «حفظ كاختصار»، فيظهر زر باسمه يطبّق الاختيار بضغطة، ويُعدَّل بالضغط المطوّل عليه.', g: [['tap', 'ضغطة', 'تطبيق الاختيار'], ['long', 'مطوّلة', 'تعديل الاسم أو الحذف']] },
    { id: 'swipeS', grp: 'search', ic: 'list-search', keys: ['swipeS'], t: 'تقليب نتائج البحث', s: 'بعد فتح أي نتيجة: السحب لليمين ينقل إلى النتيجة التالية ولليسار إلى السابقة دون العودة إلى القائمة.', g: [['swipe', 'لليمين', 'التالية'], ['swipe', 'لليسار', 'السابقة']], req: () => pref('swipe', true) },
    { id: 'sortref', grp: 'search', ic: 'arrows-sort', keys: ['sortref'], t: 'ترتيب النتائج بحسب المرجع', s: 'زر «حسب المرجع» تحت كل بحث يجمع النتائج بحسب المراجع، والضغط المطوّل عليه يتيح ترتيب المراجع.', g: [['tap', 'ضغطة', 'الجمع بحسب المرجع'], ['long', 'مطوّلة', 'ترتيب المراجع']] },

    { id: 'libhome', grp: 'lists', ic: 'history', keys: ['libhome'], t: 'آخر كتاب عند المرجع', s: 'ضغطتان متتاليتان على اسم المرجع تفتحان آخر كتاب قُرئ عنده في الموضع نفسه. وزر الساعة في الأعلى يعرض القراءات الأخيرة.', g: [['dbl', 'ضغطتان', 'آخر كتاب قُرئ']] },
    { id: 'libsort', grp: 'lists', ic: 'layout-grid', keys: ['libsort'], t: 'ترتيب المكتبة', s: 'الضغط المطوّل على أي مرجع في المكتبة يُدخل وضع الترتيب لتحريك المراجع بحسب الرغبة.', g: [['long', 'مطوّلة على المرجع']] },
    { id: 'rows', grp: 'lists', ic: 'arrow-bar-both', keys: ['rowsFav', 'rowsWrite', 'rowsCb', 'rowsBooks'], t: 'سحب الصفوف', s: 'سحب الصف لليمين يُظهر أزراره: الحذف والتذكير في المفضلة، وتغيير الاسم والحذف في «شخصي» وقوائم الكتب.', g: [['swipe', 'لليمين', 'أزرار الصف']] },
    { id: 'favchips', grp: 'lists', ic: 'palette', keys: ['favchips'], t: 'ألوان المفضلة', s: 'الضغط على لون يعرض مسائله وحدها، والضغط المطوّل عليه يتيح ترتيب الألوان وتسميتها.', g: [['tap', 'ضغطة', 'التصفية بلون'], ['long', 'مطوّلة', 'ترتيب وتسمية']] },
    { id: 'personal', grp: 'lists', ic: 'folder', keys: ['persBooks', 'persCols', 'persEdu'], t: 'الكتاب الخاص والمجموعة', s: 'الكتاب الخاص يجمع المسائل والملاحظات المختارة، والمجموعة (الحقيبة) تضم كتباً ومراجع تلزم معاً. وكلاهما يُنشأ بزر +.', g: [['tap', 'زر +', 'إنشاء']] },
    { id: 'tabHome', grp: 'lists', ic: 'arrow-bar-up', keys: ['tabHome'], t: 'العودة إلى بداية القسم', s: 'النقر على أيقونة القسم الحالي في الشريط السفلي يعيد إلى أول صفحة فيه دفعة واحدة.', g: [['tap', 'نقرة على القسم الحالي']] },

    { id: 'jami', grp: 'jami', ic: 'chart-bar', keys: ['jamiIntro'], t: 'جامع الاستفتاءات', s: 'يجمع أجوبة المراجع عن المسألة الواحدة متجاورة لتيسير المقارنة بينها، مع بحث مدمج، ويمكن الانتقال إلى مرجع بعينه بالنقر على اسمه.', g: [['tap', 'قسم «الجامع»']] },
    { id: 'swipeC', grp: 'jami', ic: 'arrows-horizontal', keys: ['swipeC', 'jamiRes'], t: 'تقليب مسائل الجامع', s: 'داخل أي مسألة في الجامع: السحب لليمين ينقل إلى المسألة التالية ولليسار إلى السابقة، وزر الرجوع يعيد إلى النتائج كما كانت.', g: [['swipe', 'لليمين', 'التالية'], ['swipe', 'لليسار', 'السابقة']], req: () => pref('swipe', true) },
    { id: 'cmpSet', grp: 'jami', ic: 'adjustments', keys: ['cmpSet'], t: 'ترتيب مراجع الجامع', s: 'تقديم من يُراد، وإخفاء من لا يُراد، وتمييز من يُراد بلون. ويسري ذلك على جميع مسائل الجامع.', g: [['tap', 'زر «ترتيب المراجع»']] }
  ];
  RSD.features = FEATURES; RSD.groups = GROUPS;
  const byId = (id) => FEATURES.find((f) => f.id === id);
  RSD.get = byId;
  const hintLearned = (k) => { try { return !!(window.RSHints && RSHints.isLearned(k)); } catch (e) { return false; } };
  const enabled = (f) => { try { return !f.req || !!f.req(); } catch (e) { return true; } };
  const used = (f) => f.keys.some(hintLearned);
  const watched = (f) => lsGet('rs_dc_seen_' + f.id, '') === '1';
  const done = (f) => used(f) || watched(f);
  RSD.fast = () => { const f = FEATURES.filter((x) => !(x.req && !x.req())).find((x) => !done(x)) || FEATURES[0]; if (f && RSD.play) RSD.play(f.id); };
  RSD.isDone = (id) => { const f = byId(id); return !!f && done(f); };
  RSD.markSeen = (id) => { const f = byId(id); if (f && !watched(f)) { lsSet('rs_dc_seen_' + id, '1'); refreshAll(); } };
  function progress() {
    const act = FEATURES.filter(enabled);
    const n = act.filter(done).length;
    return { n, total: act.length, lit: act.length ? n / act.length : 0 };
  }
  RSD.progress = progress;

  const nicheHtml = (lit, cls) => `<div class="dc-niche ${cls || ''}" style="--lit:${lit.toFixed(2)}"><div class="nc-glow"></div><div class="nc-ring"></div><img class="nc-lamp" src="icons/icon-512.png" alt="" draggable="false"></div>`;
  RSD.nicheHtml = nicheHtml;

  let hub = null, hubFilter = 'all';
  function cardHtml(f) {
    const ok = done(f), en = enabled(f);
    const chips = f.g.map((c) => `<span class="dc-chip">${GK(c[0], c[3])}<span>${esc(c[1])}${c[2] ? ` <em>· ${esc(c[2])}</em>` : ''}</span></span>`).join('');
    return `<button type="button" class="dc-card${ok ? ' done' : ''}${en ? '' : ' off'}" data-id="${f.id}">
      <span class="ci"><i class="ti ti-${ok ? 'check' : f.ic}"></i></span>
      <span class="cb"><b>${esc(f.t)}</b><em>${esc(f.s)}${en ? '' : ' (معطّلة حالياً في إعداداتك)'}</em><span class="cg">${chips}</span></span>
      <i class="ti ti-chevron-left cs"></i></button>`;
  }
  function hubBody() {
    const p = progress(), off = userOff();
    const sections = GROUPS.map(([gid, gname]) => {
      const fs = FEATURES.filter((f) => f.grp === gid && (hubFilter === 'all' || (enabled(f) && !done(f))));
      if (!fs.length) return '';
      const all = FEATURES.filter((f) => f.grp === gid && enabled(f));
      return `<h3 class="dc-gh">${gname}<small>${arNum(all.filter(done).length)} من ${arNum(all.length)}</small></h3><div class="dc-list">${fs.map(cardHtml).join('')}</div>`;
    }).join('') || '<div class="dc-empty"><i class="ti ti-sparkles" style="font-size:30px;color:var(--accent)"></i><br>اكتُشفت جميع الميزات المخفية.</div>';
    const msg = p.n >= p.total ? 'اكتُشفت جميع الميزات المخفية.' : p.n === 0 ? 'اضغط على أي ميزة ليُنقل بك إلى موضعها الفعلي ويُشار إلى الزر المطلوب.' : 'كلما استُعملت حركة مخفية ازداد إضاءة المشكاة.';
    return `<section class="dc-hero">${nicheHtml(Math.max(.15, p.lit), 'sm')}<div class="hb"><div class="hn">${p.n ? `${arNum(p.n)}<small>من ${arNum(p.total)} ميزة مخفية</small>` : `${arNum(p.total)}<small>ميزة مخفية بانتظارك</small>`}</div><p>${msg}</p><div class="dc-bar"><i style="width:${Math.round(p.lit * 100)}%"></i></div></div></section>
      <div class="dc-key"><span class="ky">${DOTS(2)}<b>نقطتان</b><em>حركتان مخفيتان: ضغطتان متتاليتان، وضغطة مطوّلة</em></span><span class="ky">${DOTS(1)}<b>نقطة</b><em>حركة مخفية واحدة: ضغطة مطوّلة (اضغط واستمر)</em></span><span class="ky">${GK('swipe')}<b>سحب</b><em>على الصفوف والنصوص</em></span></div>
      <div class="dc-seg" role="tablist"><button type="button" role="tab" data-f="all" class="${hubFilter === 'all' ? 'on' : ''}">كل الميزات</button><button type="button" role="tab" data-f="todo" class="${hubFilter === 'todo' ? 'on' : ''}">لم أكتشفها بعد</button></div>
      ${sections}
      <div class="dc-foot">
        <div class="settings-row" data-a="toggle" role="button" tabindex="0"><span class="lbl">علامات الحركات المخفية<small>تظهر على الأزرار ذات الحركات الإضافية. يمكن إيقافها لمن أتقن الحركات</small></span><div class="toggle-switch${off ? '' : ' on'}"><div class="knob"></div></div></div>
        <button type="button" class="dc-linkbtn" data-a="welcome"><i class="ti ti-player-play"></i> إعادة عرض الترحيب</button>
        <button type="button" class="dc-linkbtn" data-a="reset"><i class="ti ti-restore"></i> إعادة التعليمات من البداية</button>
      </div>`;
  }
  function ensureHub() {
    if (hub) return hub;
    const o = document.createElement('div'); o.id = 'rsDisc'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-label', 'اكتشف مشكاة');
    o.innerHTML = `<div class="dc-top"><button type="button" class="dc-x" data-a="close" aria-label="إغلاق"><i class="ti ti-arrow-right"></i></button><h2>اكتشف مشكاة</h2><span style="width:40px"></span></div><div class="dc-scroll"></div>`;
    document.body.appendChild(o);
    o.addEventListener('click', (e) => {
      const card = e.target.closest('.dc-card'); if (card) { const id = card.dataset.id; closeHub(); setTimeout(() => { RSD.tryIt && RSD.tryIt(id); }, 320); return; }
      const f = e.target.closest('[data-f]'); if (f) { hubFilter = f.dataset.f; renderHub(true); return; }
      const a = e.target.closest('[data-a]'); if (!a) return;
      if (a.dataset.a === 'close') closeHub();
      else if (a.dataset.a === 'toggle') { try { RSHints.toggleOff(); } catch (x) {} renderHub(); }
      else if (a.dataset.a === 'reset') { resetAll(); renderHub(); }
      else if (a.dataset.a === 'welcome') { closeHub(); setTimeout(() => RSD.welcome(), 350); }
    });
    hub = o; return o;
  }
  function renderHub(keepTop) {
    if (!hub) return; const sc = q('.dc-scroll', hub), y = sc.scrollTop;
    sc.innerHTML = hubBody(); sc.scrollTop = keepTop ? Math.min(y, 180) : y;
  }
  function openHub() {
    const o = ensureHub(); renderHub();
    q('.dc-scroll', o).scrollTop = 0;
    o.classList.add('show'); document.body.classList.add('dc-hub-open');
    try { markHelpSeen(); } catch (e) {}
  }
  function closeHub() { if (hub) hub.classList.remove('show'); document.body.classList.remove('dc-hub-open'); }
  const hubOpen = () => !!(hub && hub.classList.contains('show'));
  RSD.open = openHub; RSD.close = closeHub; RSD.hubOpen = hubOpen; RSD.render = () => renderHub();
  function markHelpSeen() { const s = JSON.parse(lsGet('rs_seen_v79', '{}') || '{}'); if (!s.help) { s.help = 1; lsSet('rs_seen_v79', JSON.stringify(s)); } }
  function resetAll() {
    try { RSHints.reset(); } catch (e) {}
    FEATURES.forEach((f) => lsDel('rs_dc_seen_' + f.id));
    lsDel('rs_dc_home_x'); lsDel('rs_dc_peek_rows'); lsDel('rs_dc_peek_tools');
    try { Object.keys(localStorage).filter((k) => /^rs_(peek_|dcw_|cc_)/.test(k)).forEach(lsDel); } catch (e) {}
    refreshAll();
    try { showGenericToast('ستُعرض التعليمات من جديد'); } catch (e) {}
  }
  RSD.closeTop = function () {
    if (RSD.stageOpen && RSD.stageOpen()) { RSD.stageClose(); return true; }
    if (hubOpen()) { closeHub(); return true; }
    return false;
  };
  const _ct = window.closeTopOverlayOnBack;
  if (typeof _ct === 'function') window.closeTopOverlayOnBack = function () { if (RSD.closeTop()) return true; return _ct.apply(this, arguments); };
  window.openHelp = function () { openHub(); };
  window.closeHelp = (function (f) { return function () { try { f && f.apply(this, arguments); } catch (e) {} }; })(window.closeHelp);

  const homeX = () => lsGet('rs_dc_home_x', '') === '1';
  function homeHtml() {
    if (homeX() || userOff() || !lsGet('rs_dc_welcome', '')) return '';
    const p = progress(); if (p.n >= p.total) return '';
    return `<div class="dc-home" id="dcHome" role="button" tabindex="0" onclick="RSD.open()">${nicheHtml(Math.max(.15, p.lit), 'sm')}
      <div class="hb"><b>الميزات المخفية في مشكاة</b><span>${p.n ? `المكتشف ${arNum(p.n)} من ${arNum(p.total)}` : `${arNum(p.total)} ميزة`}</span><div class="dc-bar"><i style="width:${Math.round(p.lit * 100)}%"></i></div></div>
      <i class="ti ti-chevron-left hg"></i><button type="button" class="hx" aria-label="إخفاء" onclick="event.stopPropagation();RSD.hideHome()"><i class="ti ti-x"></i></button></div>`;
  }
  RSD.hideHome = function () {
    const go = () => RSD.hideHomeNow();
    if (RSD.confirmDlg) RSD.confirmDlg({ ic: 'trophy-off', title: 'إخفاء بطاقة الميزات المخفية؟', body: 'تُظهر هذه البطاقة كم اكتشفتَ من الميزات المخفية في التطبيق. عند إخفائها لن تظهر في الرئيسية، لكن تقدّمك محفوظ ويمكنك رؤيته من الإعدادات ← اكتشف.', q: 'هل تريد إخفاءها فعلاً؟', keep: 'إبقاء البطاقة', off: 'نعم، أخفِها' }, go); else go();
  };
  RSD.hideHomeNow = function () { lsSet('rs_dc_home_x', '1'); const h = $('dcHome'); if (h) { h.style.transition = 'opacity .25s, transform .25s'; h.style.opacity = 0; h.style.transform = 'scale(.96)'; setTimeout(() => h.remove(), 260); } try { showGenericToast('تجدها دائماً في الإعدادات ← اكتشف'); } catch (e) {} };
  (function hookHome() {
    const f = window.renderHomeExtrasHtml; if (typeof f !== 'function' || f.__dc) return;
    const w = function () {
      let h = f.apply(this, arguments);
      try { const card = homeHtml(); if (card) { const i = h.indexOf('<div class="section-header"><span><i class="ti ti-stack-2"></i>'); if (i > 0) h = h.slice(0, i) + card + h.slice(i); } } catch (e) {}
      return h;
    };
    w.__dc = true; window.renderHomeExtrasHtml = w;
  })();
  function refreshHome() {
    try {
      const old = $('dcHome'); const html = homeHtml();
      if (!html) { if (old) old.remove(); return; }
      if (old) { const t = document.createElement('div'); t.innerHTML = html; old.replaceWith(t.firstElementChild); }
      else if (typeof renderHomeExtras === 'function' && $('homeExtras') && $('booksPage').classList.contains('active')) renderHomeExtras();
    } catch (e) {}
  }
  function refreshAll() { try { refreshHome(); if (hubOpen()) renderHub(); } catch (e) {} }
  RSD.refresh = refreshAll;

  let winEl = null, winTimer = 0;
  function celebrate(f) {
    return;
    if (!f || hubOpen() || RSD.stageOpen && RSD.stageOpen()) return;
    if (!winEl) { winEl = document.createElement('div'); winEl.id = 'dcWin'; winEl.setAttribute('role', 'status'); winEl.setAttribute('aria-live', 'polite'); document.body.appendChild(winEl); }
    const p = progress();
    winEl.innerHTML = `${nicheHtml(Math.max(.2, p.lit), 'sm')}<div><b>اكتشفتَ: ${esc(f.t)}</b><span>${arNum(p.n)} من ${arNum(p.total)} ميزة مخفية</span></div>`;
    const nn = winEl.querySelector('.dc-niche'); nn.style.width = nn.style.height = '40px';
    void winEl.offsetWidth; winEl.classList.add('show');
    clearTimeout(winTimer); winTimer = setTimeout(() => winEl.classList.remove('show'), 2600);
  }
  RSD.celebrate = celebrate;
  (function hookLearn() {
    const H = window.RSHints; if (!H || H.__dc) return;
    const l = H.learn; H.__dc = true;
    H.learn = function (k) {
      const before = new Set(FEATURES.filter(done).map((f) => f.id));
      const r = l.apply(this, arguments);
      try { FEATURES.forEach((f) => { if (!before.has(f.id) && done(f) && f.keys.indexOf(k) >= 0) { celebrate(f); try { document.dispatchEvent(new CustomEvent('rsd-learned', { detail: f.id })); } catch (e) {} } }); refreshAll(); } catch (e) {}
      return r;
    };
  })();
  const L = (k) => { try { RSHints.learn(k); } catch (e) {} };
  const activePage = () => { const p = document.querySelector('.page.active'); return p ? p.id : ''; };
  document.addEventListener('click', (e) => {
    const t = e.target; if (!t || !t.closest) return;
    if (t.closest('#pageTitle') && activePage() === 'readerPage') L('toc');
    if (t.closest('.ms-sharh-flag')) L('sharhFlag');
    if (t.closest('.ms-cmp-flag')) L('cmpFlag');
    if (t.closest('#urwaSettingsBtn')) L('refSet');
    if (t.closest('.cmp-order-btn')) L('cmpSet');
    if (t.closest('#searchWordsToggle, #searchOptsBtn')) L('searchTools');
    if (t.closest('#comparisonPage .list-row, #comparisonPage .cmp-tile')) L('jamiIntro');
    if (t.closest('#bottomnav .navitem.active') && /^(authorBooksPage|customBookPage|indexPage)$/.test(activePage())) L('tabHome');
  }, true);
  setInterval(() => { try { const b = $('csBar'); if (b && b.isConnected && getComputedStyle(b).display !== 'none' && activePage() === 'readerPage' && !hintLearned('select')) L('select'); } catch (e) {} }, 1200);

  function boot() {
    let n = 0;
    const iv = setInterval(() => {
      n++; const app = $('app');
      if (app && app.style.display === 'flex') {
        clearInterval(iv);
        setTimeout(() => { if (!lsGet('rs_cc_welcome', '') && !userOff() && RSD.welcome) RSD.welcome(); else refreshHome(); }, 700);
      } else if (n > 120) clearInterval(iv);
    }, 350);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
