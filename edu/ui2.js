(function () {
  'use strict';
  const EB = window.EB,
    S = EB.S,
    $ = EB.$,
    ar = EB.ar,
    esc = EB.esc,
    page = () => EB.page();
  $('zPct').onclick = () => EB.zoomAt(innerWidth / 2, innerHeight / 2, 1 / S.V.k);
  const norm = s =>
    String(s || '')
      .replace(/[ً-ٰٟـ]/g, '')
      .replace(/[أإآ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .toLowerCase();
  EB.norm = norm;

  $('bIns').onclick = () => {
    EB.closeUI();
    EB.insertSheet();
  };
  EB.addStk = addStk;
  EB.readImage = readImage;
  function addStk(k) {
    const c = EB.vc(),
      w = 90 / Math.max(0.5, Math.min(2, S.V.k));
    const it = { t: 'stk', id: EB.nid(), k, x: c.x - w / 2, y: c.y - w / 2, w, h: w, sn: S.sess };
    page().items.push(it);
    S.sel = [it];
    EB.setTool('select');
    EB.showAct();
    EB.commit();
    S.dirty = 1;
  }
  function template(k) {
    const c = EB.vc(),
      L = page().items,
      COL = EB.COLORS,
      ink = '#17212b';
    const root = {
      t: 'node',
      id: EB.nid(),
      root: 1,
      w: 200,
      c: ink,
      text: k === 'mind' ? 'الفكرة الرئيسية' : 'العنوان',
      x: c.x - 100,
      y: k === 'mind' ? c.y - 30 : c.y - 300,
      sn: S.sess
    };
    L.push(root);
    if (k === 'mind') {
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        L.push({
          t: 'node',
          id: EB.nid(),
          par: root.id,
          w: 140,
          c: COL[1 + (i % 5)],
          text: 'فرع ' + ar(i + 1),
          x: c.x + Math.cos(a) * 190 - 70,
          y: c.y + Math.sin(a) * 250 - 28,
          sn: S.sess
        });
      }
    } else {
      for (let i = 0; i < 3; i++) {
        const x = c.x + (1 - i) * 190 - 70,
          ch = {
            t: 'node',
            id: EB.nid(),
            par: root.id,
            w: 140,
            c: COL[1 + i],
            text: 'فرع ' + ar(i + 1),
            x,
            y: c.y - 120,
            sn: S.sess
          };
        L.push(ch);
        for (let j = 0; j < 2; j++)
          L.push({
            t: 'node',
            id: EB.nid(),
            par: ch.id,
            w: 140,
            c: ch.c,
            text: 'تفصيل',
            x,
            y: c.y + 40 + j * 110,
            sn: S.sess
          });
      }
    }
    S.sel = [root];
    EB.setTool('select');
    EB.showAct();
    EB.commit();
    S.dirty = 1;
    EB.toast('حدّد أي عقدة واضغط «فرع» لإضافة فرع، وانقر مرتين لتغيير النص', 3000);
  }

  EB.addAsset = async function (dataUrl) {
    const id = 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    S.assets = S.assets || {};
    S.assets[id] = dataUrl;
    await EduStore.putAsset(S.lesson.id, id, dataUrl);
    return id;
  };
  function readImage(file, maxW) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => {
        const im = new Image();
        im.onload = () => {
          const k = Math.min(1, maxW / im.width),
            c = document.createElement('canvas');
          c.width = Math.round(im.width * k);
          c.height = Math.round(im.height * k);
          c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
          res({
            url: c.toDataURL(
              file.type === 'image/png' && im.width * im.height < 1.2e6 ? 'image/png' : 'image/jpeg',
              0.86
            ),
            w: c.width,
            h: c.height
          });
        };
        im.onerror = rej;
        im.src = r.result;
      };
      r.onerror = rej;
      r.readAsDataURL(file);
    });
  }
  $('fImg').onchange = async e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      const im = await readImage(f, 1600),
        a = await EB.addAsset(im.url),
        c = EB.vc(),
        w = Math.min(420 / Math.max(0.4, S.V.k), im.w),
        h = (w * im.h) / im.w;
      const it = { t: 'img', id: EB.nid(), a, x: c.x - w / 2, y: c.y - h / 2, w, h, sn: S.sess };
      page().items.push(it);
      S.sel = [it];
      EB.setTool('select');
      EB.showAct();
      EB.commit();
      S.dirty = 1;
    } catch (er) {
      EB.toast('تعذّر فتح الصورة');
    }
  };
  async function loadPdfJs() {
    if (window.pdfjsLib) return window.pdfjsLib;
    await new Promise((ok, no) => {
      const s = document.createElement('script');
      s.src = '../vendor/pdfjs/pdf.min.js';
      s.onload = ok;
      s.onerror = no;
      document.head.appendChild(s);
    });
    pdfjsLib.GlobalWorkerOptions.workerSrc = '../vendor/pdfjs/pdf.worker.min.js';
    return pdfjsLib;
  }
  $('fDoc').onchange = async e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      if (f.type.startsWith('image/')) {
        const im = await readImage(f, 1800),
          a = await EB.addAsset(im.url);
        EB.addPage(
          EB.newPage({
            type: 'doc',
            title: f.name.replace(/\.[^.]+$/, '').slice(0, 24),
            sheet: { kind: 'img', img: a, w: 900, col: '#ffffff' }
          })
        );
        if (EB.xPage()) {
          EB.addPage(EB.newPage({ title: 'ورقة شرح', grid: 'dots' }));
          EB.gotoPage(S.pi - 1);
        }
        return;
      }
      if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) {
        EB.toast('جارٍ تجهيز الملف…', 20000);
        const lib = await loadPdfJs(),
          pdf = await lib.getDocument({ data: await f.arrayBuffer() }).promise,
          n = Math.min(pdf.numPages, 80);
        let first = true,
          ix = S.pi;
        for (let i = 1; i <= n; i++) {
          const p = await pdf.getPage(i),
            vp0 = p.getViewport({ scale: 1 }),
            sc = 1500 / vp0.width,
            vp = p.getViewport({ scale: sc }),
            c = document.createElement('canvas');
          c.width = vp.width;
          c.height = vp.height;
          await p.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
          const a = await EB.addAsset(c.toDataURL('image/jpeg', 0.84));
          const pg = EB.newPage({
            type: 'doc',
            title: f.name.replace(/\.[^.]+$/, '').slice(0, 16) + ' ' + ar(i),
            sheet: { kind: 'img', img: a, w: 900, col: '#ffffff' }
          });
          if (first) {
            EB.addPage(pg);
            first = false;
            ix = S.pi;
          } else {
            S.lesson.pages.splice(++ix, 0, pg);
            EB.initHist(pg);
          }
          if (EB.xPage()) {
            S.lesson.pages.splice(++ix, 0, EB.newPage({ title: 'ورقة شرح', grid: 'dots' }));
            EB.initHist(S.lesson.pages[ix]);
          }
          EB.toast('صفحة ' + ar(i) + ' من ' + ar(n), 20000);
        }
        EB.refreshUI();
        EB.save();
        EB.toast(pdf.numPages > n ? 'أُضيفت أول ' + ar(n) + ' صفحة' : 'أُضيف الملف (' + ar(n) + ' صفحة)');
        return;
      }
      if (EB.importText && (await EB.importText(f))) return;
      EB.toast('تعذّر قراءة هذه الصيغة. احفظ الملف بصيغة PDF ثم أرفقه.', 4200);
    } catch (er) {
      console.error(er);
      EB.toast('تعذّر فتح الملف');
    }
  };
})();
