(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const ar = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
  const G = (t) => `<span class="gd-g">${t}</span>`;
  const embedded = () => { try { return !!isEmbeddedMode; } catch (e) { return false; } };

  const PARTS = [
    { id: 'p1', t: 'في القراءة', ic: 'book-2' },
    { id: 'p2', t: 'في البحث', ic: 'search' },
    { id: 'p3', t: 'المكتبة والمفضلة', ic: 'layout-grid' },
    { id: 'p4', t: 'جامع الاستفتاءات', ic: 'scale' },
    { id: 'p5', t: 'المشاركة والإعدادات', ic: 'settings' }
  ];
  const L = [
    { id: 'select', part: 'p1', ic: 'highlight', t: 'حدّد نصاً',
      lead: 'كل ما تفعله بالنص يبدأ بالتحديد: النسخ والتظليل والنجمة والملاحظة.',
      steps: ['اضغط ' + G('ضغطة مطوّلة') + 'على أي كلمة حتى يُظلَّل عليها.', 'اسحب أحد المقبضين لتوسّع التحديد أو تضيّقه.', 'يظهر شريط صغير فيه «نسخ» و«تظليل»، وزر «⋯» يفتح كل الخيارات.'],
      tip: 'من «⋯» تحدّد الفصل كله دفعة واحدة، وتثبّت في الشريط ما تستعمله كثيراً.',
      demo: { k: 'press', word: 'الاحتياط', after: 'الاستحبابي يرجع فيه المكلّف إلى ذوقه.' },
      go: 'book', cue: 'اضغط مطوّلاً على أي كلمة في النص', det: 'select' },
    { id: 'hl', part: 'p1', ic: 'brush', t: 'ظلّل بلون تختاره',
      lead: 'زر التظليل واحد، لكنه يفهم ثلاث حركات تختلف نتيجتها.',
      steps: ['حدّد نصاً، ثم المس زر التظليل.', G('ضغطة') + 'تظلّل باللون الأول، و' + G('ضغطتان') + 'باللون الثاني، و' + G('ضغطة مطوّلة') + 'تفتح كل الألوان.'],
      tip: 'إن أردت الألوان ظاهرة دائماً بدل الحركات فاختر ذلك من الإعدادات المتقدمة ← النص والتحديد.',
      demo: { k: 'taps', icon: 'highlight', c1: '#ffd43b', c2: '#51cf66' },
      go: 'book', cue: 'حدّد كلمة، ثم جرّب زر التظليل بالحركات الثلاث', det: 'hl', chips: true },
    { id: 'star', part: 'p1', ic: 'star', t: 'النجمة وألوانها',
      lead: 'النجمة إشارة مرجعية تجمع لك المسائل في «المفضلة»، ولها الحركات الثلاث نفسها.',
      steps: ['حدّد نصاً أو المس المسألة، ثم المس النجمة.', 'ضغطة، أو ضغطتان، أو ضغطة مطوّلة، كل واحدة بلون.'],
      tip: 'ألوان النجمة تصفّي مفضلتك لاحقاً، فاجعل لكل لون معنى عندك: «للمراجعة»، «للسؤال»…',
      demo: { k: 'taps', icon: 'star', c1: '#f5a524', c2: '#e5484d' },
      go: 'book', cue: 'حدّد كلمة، ثم جرّب زر النجمة بالحركات الثلاث', det: 'star', chips: true },
    { id: 'tapmark', part: 'p1', ic: 'pointer', t: 'المس نصاً مظلّلاً',
      lead: 'ما ظلّلته أو نجّمته يبقى في الكتاب، والمسه يُظهر خياراته.',
      steps: ['المس نصاً عليه تظليل أو نجمة أو ملاحظة.', 'يظهر شريط فيه: إزالة التظليل، أو إزالة النجمة، أو عرض الملاحظة.'],
      demo: { k: 'tapword', word: 'ذوقه', card: 'إزالة التظليل', cardIc: 'eraser', mark: 1 },
      go: 'book', cue: 'ظلّل نصاً (كما في الدرس السابق)، ثم المسه', det: 'tapmark' },
    { id: 'meaning', part: 'p1', ic: 'book-2', t: 'معاني الكلمات',
      lead: 'الكلمة المسطّرة في الكتاب مصطلح فقهي له معنى جاهز.',
      steps: ['المس الكلمة المسطّرة فتفتح نافذة بمعناها.', G('ضغطة مطوّلة') + 'عليها تحدّدها بدل أن تفتح معناها.', 'وإن اجتمع عليها تظليل أو ملاحظة ظهرت قائمة صغيرة تختار منها.'],
      tip: 'قد لا يطابق المعنى سياق النص تماماً، فاعتبره عوناً على الفهم لا حكماً. ومن الإعدادات المتقدمة تخفي المعاني كلها.',
      demo: { k: 'tapword', word: 'الاحتياط', card: 'الأخذ بأحوط الأقوال تحرّزاً', cardIc: 'book-2', und: 1 },
      go: 'book', cue: 'المس أي كلمة مسطّرة (انتقل للباب التالي إن لم تجد)', det: 'meaning' },
    { id: 'notes', part: 'p1', ic: 'pencil', t: 'اكتب ملاحظة',
      lead: 'الملاحظة تُكتب تحت المسألة نفسها، وتجدها لاحقاً في «عليها تعليق».',
      steps: ['المس أي مسألة فتظهر أدواتها.', 'المس زر القلم، واكتب، ثم احفظ.'],
      demo: { k: 'tapword', word: 'مسألة', card: 'اكتب ملاحظتك…', cardIc: 'pencil' },
      go: 'book', cue: 'المس أي مسألة ثم زر الملاحظة (القلم)', det: 'notes' },
    { id: 'copylong', part: 'p1', ic: 'share-3', t: 'شارك بدل أن تنسخ',
      lead: 'زر النسخ يحمل وجهاً ثانياً.',
      steps: [G('ضغطة مطوّلة') + 'على «نسخ»، في أي مكان في التطبيق، تحوّله إلى «مشاركة».', 'ارفع إصبعك فتفتح المشاركة بدل النسخ.'],
      demo: { k: 'copyshare' },
      go: 'book', cue: 'حدّد كلمة ثم اضغط مطوّلاً على «نسخ»' },
    { id: 'swipe', part: 'p1', ic: 'arrows-horizontal', t: 'اسحب بين الأبواب',
      lead: 'لا تحتاج الفهرس كل مرة.',
      steps: ['اسحب بإصبع واحد أفقياً: لليمين إلى الباب التالي، ولليسار إلى السابق.', 'وإن فتحت الكتاب من نتيجة بحث فالسحب ينقلك بين النتائج.'],
      demo: { k: 'swipe' },
      go: 'book', cue: 'اسحب بإصبعك يميناً أو يساراً على النص', det: 'swipe' },
    { id: 'fab', part: 'p1', ic: 'map-pin', t: 'الدبوس العائم وتقسيم الشاشة',
      lead: 'الدبوس في أسفل القارئ يحفظ لك موضعك، ويقسّم الشاشة.',
      steps: [G('ضغطة') + 'تعرض مواقعك المحفوظة في كل الكتب.', G('ضغطتان') + 'تبدآن تتبّع الكتاب الذي أنت فيه.', G('ضغطة مطوّلة') + 'تقسّم الشاشة نافذتين، في كل واحدة كتاب.'],
      tip: 'في تقسيم الشاشة تسحب الفاصل لتغيّر حجم النافذتين، وكل نافذة تفتح بإعداداتها وشريطها.',
      demo: { k: 'taps', icon: 'map-pin', c1: '#4dabf7', c2: '#51cf66', labels: ['ضغطة: مواقعي', 'ضغطتان: تتبّع', 'مطوّلة: تقسيم'] },
      go: 'book', cue: 'جرّب الحركات الثلاث على الدبوس العائم', det: 'fab', chips: true },

    { id: 'search', part: 'p2', ic: 'search', t: 'ابحث عن كلمة',
      lead: 'يبحث في العناوين والنصوص والحواشي وفي الجامع.',
      steps: ['اكتب كلمة أو عبارة ثم اضغط زر البحث.', 'المس النتيجة لتُفتح في موضعها من الكتاب.', 'من «خيارات البحث» تختار التطابق التام أو مكان البحث.'],
      demo: { k: 'type', q: 'الصلاة في السفر', r1: 'منهاج الصالحين › الصلاة', r2: 'العروة الوثقى › صلاة المسافر' },
      go: 'tab:search', cue: 'اكتب كلمة (مثل: الصلاة) واضغط زر البحث', det: 'search' },
    { id: 'presets', part: 'p2', ic: 'bookmarks', t: 'اختصارات البحث',
      lead: 'إن كنت تبحث دائماً في المراجع أنفسهم فاحفظ اختيارك.',
      steps: ['اضبط «المراجع والكتب» كما تريد.', 'اضغط «حفظ كاختصار» وسمِّه، فيظهر زر باسمه.', G('ضغطة مطوّلة') + 'على الاختصار تفتح قائمته: تغيير الاسم، التقديم والتأخير، المفضّل، الحذف.'],
      demo: { k: 'press', word: 'كتب السيستاني', chip: 1, menu: ['تغيير الاسم', 'جعله المفضّل', 'حذف'] },
      go: 'tab:search', cue: 'افتح «المراجع والكتب»، وجرّب حفظ اختصار' },
    { id: 'sortauth', part: 'p2', ic: 'arrows-sort', t: 'ترتيب النتائج بالمرجع',
      lead: 'تحت كل بحث شريط ترتيب: الأقرب، وحسب المرجع.',
      steps: ['اختر «حسب المرجع» فتتجمّع النتائج بحسب ترتيبك.', G('ضغطة مطوّلة') + 'عليه تفتح قائمة المراجع، فاسحب المقبض لتغيّر الترتيب.'],
      demo: { k: 'drag', rows: ['السيد السيستاني', 'السيد الخوئي', 'السيد الخامنئي'] },
      go: 'tab:search', cue: 'ابحث عن كلمة، ثم اضغط مطوّلاً على «حسب المرجع»', det: 'sortauth' },

    { id: 'pins', part: 'p3', ic: 'pin', t: 'رتّب المثبّتات',
      lead: 'المثبّتات شريط في أعلى الرئيسية لما تعود إليه كثيراً.',
      steps: [G('ضغطة مطوّلة') + 'على أي بطاقة مثبّتة تدخلك وضع الترتيب والحذف.', 'اسحب لترتّب، واضغط × للحذف.'],
      demo: { k: 'press', word: 'السيستاني', chip: 1, menu: ['ترتيب', 'إزالة التثبيت'] },
      go: 'tab:books', cue: 'اضغط مطوّلاً على أي بطاقة مثبّتة (إن وُجدت)' },
    { id: 'navtop', part: 'p3', ic: 'arrow-bar-up', t: 'العودة لبداية القسم',
      lead: 'بعد أن تتعمّق في قسم، لا تضغط رجوع مرات كثيرة.',
      steps: ['المس أيقونة القسم الذي أنت فيه في الشريط السفلي.', 'يرجع بك فوراً إلى أول صفحاته.'],
      demo: { k: 'scrolltop' },
      go: 'tab:books', cue: 'انزل في القائمة، ثم المس أيقونة «الرسائل» في الشريط السفلي', det: 'navtop' },
    { id: 'swiperow', part: 'p3', ic: 'arrow-bar-both', t: 'اسحب الصف',
      lead: 'في المفضلة وفي «شخصي» لكل صف أزرار خفية.',
      steps: ['اسحب الصف جانباً بإصبعك.', 'تظهر أزرار الحذف وتغيير الاسم والتذكير.'],
      demo: { k: 'swiperow' },
      go: 'tab:favorites', cue: 'اسحب أي صف جانباً (إن كانت مفضلتك فارغة فنجّم مسألة أولاً)' },
    { id: 'recents', part: 'p3', ic: 'history', t: 'القراءات: كتابك الأخير',
      lead: 'التطبيق يتذكر آخر كتبك بمواضعها، وجامع الاستفتاءات واحد منها كأنه كتاب.',
      steps: ['زر الساعة في الأعلى يعرض آخر قراءاتك.', 'المس كتاباً ليُفتح عند موضعك بالضبط.', 'المس «جامع الاستفتاءات» لترى آخر المسائل التي فتحتها فيه، ثم المس أي مسألة.', 'ضغطتان سريعتان على أيقونة مرجع تفتح آخر كتاب قرأته عنده.'],
      tip: 'من الإعدادات ← «القراءات والذاكرة» تختار عدد الكتب وعدد مسائل الجامع (٣ أو ٥ أو ٧ أو ١٠).',
      demo: { k: 'tapword', word: 'القراءات', card: 'جامع الاستفتاءات · آخر ٣ مسائل', cardIc: 'scale', btn: 1 },
      go: 'recents', cue: 'المس زر الساعة في الشريط العلوي' },

    { id: 'jamiorder', part: 'p4', ic: 'users', t: 'رتّب مراجع الجامع',
      lead: 'في الجامع تظهر آراء المراجع بطاقات تحت السؤال، وترتيبها بيدك.',
      steps: ['افتح «ترتيب المراجع وإخفاء/تمييز».', 'اسحب المقبض لتقدّم من تريد، وأخفِ من لا تريد رأيه.', 'الترتيب الأول افتراضياً: السيستاني ثم الخوئي ثم الفياض… وهو قابل للتغيير.'],
      demo: { k: 'drag', rows: ['السيد السيستاني', 'السيد الخوئي', 'الشيخ الفياض'] },
      go: 'jami', cue: 'اسحب مقبض أي مرجع لتغيّر مكانه' },

    { id: 'share', part: 'p5', ic: 'photo', t: 'شارك صورةً أو نصاً',
      lead: 'كل مشاركة تعرض لك خيارين: صورة بطاقة أنيقة، أو نص.',
      steps: ['المس زر المشاركة (أو اضغط مطوّلاً على النسخ).', 'اختر «كصورة» أو «كنص».', 'في الصورة تختار الأبعاد: مربعة أو مستطيلة أو حرة أو بمقاس تحدّده، وتختار هل تظهر صورة المرجع.', 'مسائل الجامع تحمل اسم «جامع الاستفتاءات» ومؤلفه الشيخ عادل الجوهر.'],
      demo: { k: 'copyshare', share: 1 },
      go: 'book', cue: 'المس أي مسألة ثم زر المشاركة' },
    { id: 'undo', part: 'p5', ic: 'arrow-back-up', t: 'تراجع عن آخر إعداد',
      lead: 'غيّرت شيئاً ولم يعجبك؟ لا تبحث عنه.',
      steps: ['غيّر أي إعداد.', 'شريط «تراجع» في أعلى الإعدادات يرجّع آخر تغيير بلمسة.'],
      demo: { k: 'toggle' },
      go: 'settings', cue: 'بدّل أي مفتاح في الإعدادات ثم اضغط «تراجع»', det: 'undo' },
    { id: 'notifs', part: 'p5', ic: 'bell', t: 'مواعيد إشعار «مسألة اليوم»',
      lead: 'للمواعيد نوعان، بجانب بعضهما في الإعدادات ← «الإشعارات والمواعيد».',
      steps: [G('مواعيدي') + ': تكرار تلقائي. كل يوم، أو أيام تختارها من الأسبوع (الاثنين والثلاثاء، أو الجمعة وحدها)، أو كل عدة أيام (كل ٣ أيام، كل ٤ أيام…).', G('مواعيد مجدولة') + ': تاريخ وساعة بالضبط، ولك أن تكتب نص الإشعار بنفسك.'],
      demo: { k: 'toggle', notif: 1 },
      go: 'notif', cue: 'جرّب «مواعيدي» ثم «مواعيد مجدولة»' }
  ];

  const DONE_KEY = 'rs_guide_done_v82';
  const doneSet = () => { try { return new Set(JSON.parse(lsGet(DONE_KEY, '[]'))); } catch (e) { return new Set(); } };
  const markDone = (id) => { const s = doneSet(); if (s.has(id)) return; s.add(id); lsSet(DONE_KEY, JSON.stringify([...s])); paintDone(); };
  function paintDone() {
    const s = doneSet();
    document.querySelectorAll('#guideBookPage .gb-sec[data-id]').forEach((e) => e.classList.toggle('done', s.has(e.dataset.id)));
    const n = L.filter((x) => s.has(x.id)).length;
    const t = $('gbProgT'); if (t) t.textContent = `أتممتَ ${ar(n)} من ${ar(L.length)} درساً`;
    const f = $('gbProgF'); if (f) f.style.width = Math.round(n / L.length * 100) + '%';
  }

  const HAND = '<i class="hnd ti ti-hand-finger"></i>';
  const LINE = (n) => `<span class="ln" style="width:${n}%"></span>`;
  const DEMO = {
    press(d) {
      if (d.chip) return `<div class="gdm gdm-chip"><div class="chips"><span class="c">الطهارة</span><span class="c tw"><i class="ring"></i>${esc(d.word)}${HAND}</span><span class="c">الصلاة والصوم</span></div>
        <div class="menu">${d.menu.map((m) => `<span>${esc(m)}</span>`).join('')}</div></div>`;
      return `<div class="gdm gdm-press"><div class="bar"><i class="ti ti-copy"></i><i class="ti ti-palette"></i><i class="ti ti-dots"></i></div>
        <p class="tx">الأصل في الأشياء الإباحة، وأما <span class="tw"><i class="ring"></i>${esc(d.word)}<i class="hd hd1"></i><i class="hd hd2"></i>${HAND}</span> ${esc(d.after)}</p>${LINE(86)}${LINE(62)}</div>`;
    },
    taps(d) {
      const lb = d.labels || ['ضغطة', 'ضغطتان', 'ضغطة مطوّلة'];
      return `<div class="gdm gdm-taps" style="--c1:${d.c1};--c2:${d.c2}"><div class="btn"><i class="ti ti-${d.icon}"></i><b class="bd b1"></b><b class="bd b2"></b></div>
        <i class="rip r1"></i><i class="rip r2"></i><i class="rip r3"></i><i class="ring"></i>${HAND}
        <div class="pal"><s></s><s></s><s></s><s></s></div>
        <div class="lbls"><span class="l1">${lb[0]}</span><span class="l2">${lb[1]}</span><span class="l3">${lb[2]}</span></div></div>`;
    },
    tapword(d) {
      const cardInner = d.btn ? `<i class="ti ti-${d.cardIc}"></i><b>${esc(d.card)}</b>` : `<i class="ti ti-${d.cardIc}"></i><b>${esc(d.card)}</b>`;
      return `<div class="gdm gdm-tapw"><p class="tx">من آداب القراءة أن تعرف معنى <span class="tw${d.und ? ' und' : ''}${d.mark ? ' mk' : ''}"><i class="rip"></i>${esc(d.word)}${HAND}</span> قبل أن تعمل به.</p>${LINE(80)}
        <div class="card">${cardInner}</div></div>`;
    },
    swipe() {
      return `<div class="gdm gdm-swipe"><div class="pg p1"><h5>الباب الأول</h5>${LINE(90)}${LINE(70)}${LINE(82)}</div><div class="pg p2"><h5>الباب الثاني</h5>${LINE(78)}${LINE(88)}${LINE(60)}</div>${HAND}</div>`;
    },
    drag(d) {
      return `<div class="gdm gdm-drag"><div class="rw r1"><i class="ti ti-grip-vertical"></i>${esc(d.rows[0])}</div><div class="rw r2"><i class="ti ti-grip-vertical"></i>${esc(d.rows[1])}</div><div class="rw r3"><i class="ti ti-grip-vertical"></i>${esc(d.rows[2])}</div>${HAND}</div>`;
    },
    swiperow() {
      return `<div class="gdm gdm-srow"><div class="acts"><i class="ti ti-trash"></i><i class="ti ti-pencil"></i><i class="ti ti-bell"></i></div><div class="rw"><span>مسألة من مفضلتي</span><i class="ti ti-star"></i></div>${HAND}</div>`;
    },
    type(d) {
      return `<div class="gdm gdm-type"><div class="sb"><span class="tx"><span class="typed">${esc(d.q)}</span></span><i class="ti ti-search go"></i></div>
        <div class="res a">${esc(d.r1)}</div><div class="res b">${esc(d.r2)}</div>${HAND}</div>`;
    },
    scrolltop() {
      return `<div class="gdm gdm-top"><div class="lst">${[1, 2, 3, 4, 5, 6, 7, 8].map((i) => `<span class="it">عنصر ${ar(i)}</span>`).join('')}</div><div class="nv"><span class="n on"><i class="ti ti-book-2"></i><em>الرسائل</em></span><span class="n"><i class="ti ti-search"></i></span><span class="n"><i class="ti ti-star"></i></span></div>${HAND}</div>`;
    },
    copyshare(d) {
      return `<div class="gdm gdm-cs"><div class="btn"><i class="ti ti-copy i1"></i><i class="ti ti-share-3 i2"></i></div><i class="ring"></i>${HAND}
        <div class="lab l1">نسخ</div><div class="lab l2">مشاركة</div>
        ${d.share ? '<div class="two"><span><i class="ti ti-photo"></i> كصورة</span><span><i class="ti ti-text-caption"></i> كنص</span></div>' : ''}</div>`;
    },
    toggle(d) {
      return `<div class="gdm gdm-tg"><div class="ub"><i class="ti ti-arrow-back-up"></i><span class="t0">لا تغييرات للتراجع عنها</span><span class="t1">آخر تغيير: ${d.notif ? 'نوع المواعيد' : 'تأثير الضوء'}</span><b>تراجع</b></div>
        <div class="row"><span>${d.notif ? 'مواعيدي' : 'تأثير الضوء'}</span><span class="sw"><i></i></span></div>${HAND}</div>`;
    }
  };

  const bodyCls = () => { try { return fontFamily; } catch (e) { return ''; } };
  const bodySize = () => { try { return fontSize; } catch (e) { return 17; } };
  function lessonHtml(l, i) {
    const demo = DEMO[l.demo.k] ? DEMO[l.demo.k](l.demo) : '';
    return `<section class="gb-sec" id="gb-${l.id}" data-id="${l.id}">
      <h2 class="gb-title"><span class="gb-n">${ar(i + 1)}</span><span class="gb-tt">${esc(l.t)}</span><i class="ti ti-circle-check gb-ok" title="أتممتَ هذا الدرس"></i></h2>
      <div class="gb-body body-text ${bodyCls()}" style="font-size:${bodySize()}px">
        <p class="gb-lead">${esc(l.lead)}</p>
        ${demo}
        <ol class="gb-steps">${l.steps.map((s) => `<li>${s}</li>`).join('')}</ol>
        ${l.tip ? `<div class="gb-tip"><i class="ti ti-bulb"></i><span>${esc(l.tip)}</span></div>` : ''}
      </div></section>`;
  }
  function refHtml() {
    let g = [];
    try { g = RSUI.GUIDE || []; } catch (e) {}
    if (!g.length) return '';
    return `<div class="gb-part" id="gb-part-ref"><span>ملحق</span><b>المرجع السريع</b></div>` + g.map((s, si) => `<section class="gb-sec gb-ref" id="gb-ref-${si}">
      <h2 class="gb-title"><span class="gb-n"><i class="ti ti-list-details"></i></span><span class="gb-tt">${esc(s.t)}</span></h2>
      <div class="gb-body body-text ${bodyCls()}" style="font-size:${bodySize()}px"><p class="gb-lead">${esc(s.lead)}</p>
      ${s.items.map(([h, p]) => `<div class="gb-it"><h4>${esc(h)}</h4><p>${p}</p></div>`).join('')}</div></section>`).join('');
  }
  function bookHtml() {
    let out = `<div class="gb">
      <div class="gb-cover"><span class="gb-cv-ic"><i class="ti ti-book-2"></i></span><h1>التعليمية</h1><p>كتابٌ يشرح التطبيق خطوة خطوة.</p>
        <div class="gb-how"><div><i class="ti ti-list"></i><span>افتح <b>الفهرس</b> بالزر العائم لتنتقل بين الدروس.</span></div><div><i class="ti ti-movie"></i><span>في كل درس <b>رسم متحرّك</b> يريك الحركة.</span></div></div>
        <div class="gb-prog"><span id="gbProgT"></span><i><b id="gbProgF"></b></i></div></div>`;
    let n = 0;
    PARTS.forEach((p, pi) => {
      out += `<div class="gb-part" id="gb-part-${p.id}"><span>الباب ${['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس'][pi]}</span><b>${esc(p.t)}</b></div>`;
      L.filter((x) => x.part === p.id).forEach((l) => { out += lessonHtml(l, n); n++; });
    });
    out += refHtml() + '</div>';
    return out;
  }

  let io = null;
  function observeDemos() {
    try { if (io) io.disconnect(); } catch (e) {}
    const demos = document.querySelectorAll('#guideBookPage .gdm');
    if (!('IntersectionObserver' in window)) { demos.forEach((d) => d.classList.add('play')); return; }
    io = new IntersectionObserver((es) => es.forEach((e) => e.target.classList.toggle('play', e.isIntersecting)), { root: $('content'), threshold: 0.35 });
    demos.forEach((d) => io.observe(d));
  }

  let returnTab = 'books';
  function ensurePage() {
    let p = $('guideBookPage');
    if (!p) { p = document.createElement('div'); p.className = 'page'; p.id = 'guideBookPage'; $('content').appendChild(p); }
    return p;
  }
  function showFab() {
    try {
      showReaderFab();
      ['readerFabPosition', 'readerFabCbEdit', 'urwaSettingsBtn'].forEach((i) => { const e = $(i); if (e) e.style.display = 'none'; });
    } catch (e) {}
  }
  function open(id) {
    if (embedded()) return;
    closeCoach(true);
    try { closeSettings(); closeAdvancedSettings(); closeHelp(); } catch (e) {}
    try { if (typeof currentTab === 'string') returnTab = currentTab; } catch (e) {}
    const page = ensurePage();
    page.innerHTML = bookHtml();
    navStack = [() => { try { showTab(returnTab); } catch (e) {} }];
    updateBackButtonVisibility();
    try { hideBreadcrumb(); } catch (e) {}
    switchPage('guideBookPage', 'التعليمية');
    showFab();
    paintDone(); observeDemos();
    const c = $('content');
    c.scrollTop = 0;
    if (id) setTimeout(() => go(id), 60);
  }
  function go(id) {
    const e = $('gb-' + id) || $('gb-' + id.replace(/^ref-/, 'ref-')) || $(id);
    if (!e) return;
    const c = $('content');
    c.scrollTo({ top: Math.max(0, e.offsetTop - 8), behavior: 'smooth' });
  }
  const isOpen = () => { const p = $('guideBookPage'); return !!(p && p.classList.contains('active')); };

  let tocOn = false;
  const normAr = (x) => String(x || '').replace(/[ً-ٰٟـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').toLowerCase();
  function tocHtml(q) {
    const nq = normAr(q || '').trim(), ds = doneSet();
    let h = '', any = false, n = 0;
    PARTS.forEach((p) => {
      const items = L.filter((x) => x.part === p.id);
      const idx = items.map((x) => L.indexOf(x));
      const list = items.filter((x) => !nq || normAr(x.t + ' ' + x.lead).indexOf(nq) >= 0);
      if (!list.length) return;
      any = true;
      h += `<div class="toc-item toc-chap">${esc(p.t)}</div>`;
      list.forEach((l) => { h += `<div class="toc-item toc-sub" onclick="RSGuide.tocGo('${l.id}')">${ds.has(l.id) ? '<i class="ti ti-circle-check gb-toc-ok"></i> ' : ''}${ar(L.indexOf(l) + 1)}. ${esc(l.t)}</div>`; });
    });
    let g = []; try { g = RSUI.GUIDE || []; } catch (e) {}
    const gl = g.map((s, i) => [s, i]).filter(([s]) => !nq || normAr(s.t).indexOf(nq) >= 0);
    if (gl.length) { any = true; h += '<div class="toc-item toc-chap">المرجع السريع</div>' + gl.map(([s, i]) => `<div class="toc-item toc-sub" onclick="RSGuide.tocGo('gb-ref-${i}')">${esc(s.t)}</div>`).join(''); }
    return any ? h : '<div class="toc-item toc-empty">لا نتائج</div>';
  }
  function openToc() {
    tocOn = true;
    $('tocDrawerTitle').textContent = 'التعليمية';
    const inp = $('tocBookSearch'); if (inp) { inp.value = ''; inp.placeholder = 'ابحث في الدروس...'; }
    $('tocDrawerList').innerHTML = tocHtml('');
    $('tocOverlay').classList.add('show');
  }
  const _rf = window.readerFabTocClick;
  window.readerFabTocClick = function () { if (isOpen()) return openToc(); return _rf.apply(this, arguments); };
  const _tb = window.tocBookSearchRun;
  window.tocBookSearchRun = function (v) { if (tocOn) { $('tocDrawerList').innerHTML = tocHtml(v); return; } return _tb.apply(this, arguments); };
  const _ct = window.closeTocDrawer;
  window.closeTocDrawer = function () { tocOn = false; return _ct.apply(this, arguments); };
  const _ot = window.openTocDrawer;
  window.openTocDrawer = function () { tocOn = false; return _ot.apply(this, arguments); };

  function closeCoach() {}

  window.RSGuide = {
    open, go, tocGo: function (id) { try { closeTocDrawer(); } catch (e) {} go(id); },
    closePractice: closeCoach,
    isDone: (id) => doneSet().has(id),
    markDone,
    resetDone: (ids) => { const s = doneSet(); (ids || []).forEach((i) => s.delete(i)); lsSet(DONE_KEY, JSON.stringify([...s])); paintDone(); },
    lessons: L,
    refreshDots: function () { try { refreshDots(); } catch (e) {} }
  };
  window.openHelp = function () { open(); };
  (function () {
    let r = null; try { r = sessionStorage.getItem('rs_guide_reopen'); sessionStorage.removeItem('rs_guide_reopen'); } catch (e) {}
    if (!r) return;
    const t = setInterval(() => { const a = $('app'); if (a && getComputedStyle(a).display !== 'none' && typeof allBooks !== 'undefined' && allBooks.length) { clearInterval(t); setTimeout(() => open(r === '1' ? null : r), 600); } }, 400);
  })();

  const SEEN = 'rs_seen_v79';
  const seen = () => { try { return JSON.parse(lsGet(SEEN, '{}')) || {}; } catch (e) { return {}; } };
  const markSeen = (k) => { const s = seen(); if (!s[k]) { s[k] = 1; lsSet(SEEN, JSON.stringify(s)); } refreshDots(); };
  function rowOf(k) { return k === 'help' ? document.querySelector('#settingsSheet .settings-link-row[onclick^="openHelp"]') : k === 'about' ? document.querySelector('#settingsSheet .settings-link-row[onclick^="openAbout"]') : $('installRow'); }
  function refreshDots() {
    const s = seen(); let any = false;
    ['help', 'about', 'install'].forEach((k) => {
      const row = rowOf(k); if (!row) return;
      const hidden = k === 'install' && row.style.display === 'none';
      const unseen = !s[k] && !hidden;
      if (unseen) any = true;
      let d = row.querySelector('.sl-dot');
      if (unseen && !d) { d = document.createElement('span'); d.className = 'sl-dot'; d.setAttribute('aria-label', 'جديد — افتحه'); const go2 = row.querySelector('.sl-go'); if (go2) row.insertBefore(d, go2); else row.appendChild(d); }
      if (!unseen && d) d.remove();
    });
    const g = $('toolsBtn'); if (g) g.classList.toggle('has-dot', any);
  }
  function wrap(name, key) {
    const f = window[name]; if (typeof f !== 'function') return;
    window[name] = function () { markSeen(key); return f.apply(this, arguments); };
  }
  wrap('openHelp', 'help'); wrap('openAbout', 'about');
  if (window.RSUI && RSUI.install) { const oi = RSUI.install; RSUI.install = function () { markSeen('install'); return oi.apply(this, arguments); }; }
  const _os = window.openSettings;
  if (typeof _os === 'function') window.openSettings = function () { const r = _os.apply(this, arguments); setTimeout(refreshDots, 0); return r; };
  const boot = () => { setTimeout(refreshDots, 400); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
