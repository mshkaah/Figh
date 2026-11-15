(async function () {
  'use strict';
  const EB = window.EB,
    S = EB.S,
    $ = EB.$;
  const q = new URLSearchParams(location.search);
  let th = q.get('t');
  if (!th) {
    try {
      th = parent.document.documentElement.dataset.theme;
    } catch (e) {}
  }
  if (!th) th = matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = th;
  try {
    const rf = EB.readFont && EB.readFont();
    if (rf) document.documentElement.style.setProperty('--bf', rf);
  } catch (e) {}

  let host = null;
  try {
    host = parent !== window && parent.EDU_BRIDGE;
  } catch (e) {}
  const DEMO = [
    {
      id: 1,
      name: 'مدخل إلى الفقه',
      author: 'تجريبي',
      s: [
        [
          'تعريف الفقه',
          'الفقه في اللغة الفهم، وفي الاصطلاح العلم بالأحكام الشرعية العملية المستنبطة من أدلتها التفصيلية. ويبحث الفقيه في أفعال المكلفين من عبادات ومعاملات.'
        ],
        [
          'مصادر الاستنباط',
          'تُعرف مصادر الاستنباط بالأدلة، ومن أشهرها الكتاب والسنة والإجماع والعقل. ويحتاج الباحث إلى معرفة دلالات الألفاظ.'
        ]
      ]
    },
    {
      id: 2,
      name: 'مبادئ الطهارة',
      author: 'تجريبي',
      s: [
        [
          'الماء المطلق والمضاف',
          'ينقسم الماء إلى مطلق ومضاف. فالمطلق ما يصدق عليه اسم الماء بلا قيد. والمضاف ما لا يصدق عليه ذلك إلا بقيد.'
        ]
      ]
    }
  ];
  EB.bridge = host || {
    books: async () => DEMO.map(b => ({ id: b.id, name: b.name, author: b.author })),
    sections: async id => DEMO.find(b => b.id === id).s.map((s, i) => ({ i, title: s[0] })),
    section: async (id, i) => {
      const s = DEMO.find(b => b.id === id).s[i];
      return { title: s[0], body: s[1] };
    }
  };
  const id = q.get('id');
  let L = id && (await EduStore.get(id));
  if (!L) L = await EduStore.newLesson(q.get('name') || 'درس جديد');
  L.sc = L.sc || 0;
  if (!L.pages || !L.pages.length) L.pages = [EB.newPage({ title: 'ورقة ١' })];
  S.lesson = L;
  S.assets = await EduStore.allAssets(L.id);
  S.pi = Math.min(L.pi || 0, L.pages.length - 1);
  S.sess = L.sess && L.sess <= L.sc ? L.sess : 0;
  S.color = EB.inkFor(L.pages[S.pi].paper);
  S.uid = 1 + L.pages.reduce((m, p) => Math.max(m, ...p.items.map(i => +i.id || 0), 0), 0);
  EB.start();
  EB.initHist(EB.page());
  EB.mount();
  EB.refreshUI();
  if (parent !== window && parent.EDU && parent.EDU.ready) parent.EDU.ready();
  window.__ready = true;

  if (!q.get('ns') && L.pages.length === 1 && !L.pages[0].items.length && !L.pages[0].sheet && EB.sessionStart)
    EB._sessAuto = 1;
})();
