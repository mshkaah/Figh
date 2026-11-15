(function () {
  const EB = window.EB,
    KEY = 'rs_edu_colors';
  const esc = s =>
    String(s == null ? '' : s).replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const OK = h => /^#[0-9a-f]{6}$/i.test(h || '');
  let L = [];
  try {
    L = (JSON.parse(localStorage.getItem(KEY) || '[]') || []).filter(x => x && OK(x.h));
  } catch (e) {}
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(L));
    } catch (e) {}
  };
  const hex2rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const rgb2hex = (r, g, b) =>
    '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  function rgb2hsv(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    const mx = Math.max(r, g, b),
      mn = Math.min(r, g, b),
      d = mx - mn;
    let h = 0;
    if (d) {
      if (mx === r) h = ((g - b) / d) % 6;
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    return [h, mx ? d / mx : 0, mx];
  }
  function hsv2rgb(h, s, v) {
    const c = v * s,
      x = c * (1 - Math.abs(((h / 60) % 2) - 1)),
      m = v - c;
    let r = 0,
      g = 0,
      b = 0;
    if (h < 60) [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
  }

  const C = (EB.Colors = {
    list: () => L.slice(),
    find: h => L.findIndex(x => x.h.toLowerCase() === String(h).toLowerCase()),
    add(h, n) {
      h = h.toLowerCase();
      const i = C.find(h);
      if (i >= 0) {
        if (n) L[i].n = n;
      } else L.unshift({ h, n: n || '' });
      if (L.length > 40) L.length = 40;
      save();
    },
    rename(i, n) {
      if (L[i]) {
        L[i].n = n;
        save();
      }
    },
    remove(i) {
      L.splice(i, 1);
      save();
    },
    pick(cur, cb, o) {
      o = o || {};
      let ov = document.getElementById('cpOv');
      if (!ov) {
        ov = document.createElement('div');
        ov.id = 'cpOv';
        document.body.appendChild(ov);
      }
      const rgb0 = OK(cur) ? hex2rgb(cur) : [192, 80, 42];
      let [h, s, v] = rgb2hsv(...rgb0);
      let renaming = -1;
      const close = () => {
        ov.classList.remove('s');
        ov.innerHTML = '';
      };
      const now = () => rgb2hex(...hsv2rgb(h, s, v));
      ov.innerHTML = `<div class="cpp" role="dialog" aria-label="اختيار لون"><button class="sx" id="cpX" aria-label="إغلاق"></button><h3>${esc(o.title || 'لون مخصص')}</h3>
        <div class="cp-sv" id="cpSv"><div class="cp-th" id="cpSvT"></div></div><div class="cp-hue" id="cpHue"><div class="cp-th" id="cpHueT"></div></div>
        <div class="cp-row"><span class="cp-prev" id="cpPrev"></span><input class="ginp cp-hex" id="cpHex" maxlength="7" autocomplete="off" spellcheck="false" aria-label="رمز اللون"><input class="ginp cp-nm" id="cpNm" maxlength="24" placeholder="اسم اللون (اختياري)" autocomplete="off"></div>
        <div class="kg-t">ألواني المحفوظة</div><div class="cp-saved" id="cpList"></div>
        <div class="cp-act"><button id="cpSave"><i class="ti ti-bookmark-plus"></i>حفظ في ألواني</button><button class="ok" id="cpOk">اعتماد</button></div></div>`;
      const $ = id => ov.querySelector('#' + id),
        sv = $('cpSv'),
        hue = $('cpHue'),
        hx = $('cpHex');
      function paint(fromHex) {
        sv.style.setProperty('--cp-h', h.toFixed(0));
        $('cpSvT').style.left = (1 - s) * 100 + '%';
        $('cpSvT').style.top = (1 - v) * 100 + '%';
        $('cpHueT').style.left = (1 - h / 360) * 100 + '%';
        $('cpPrev').style.background = now();
        if (!fromHex) hx.value = now().toUpperCase();
        const i = C.find(now());
        if (i >= 0 && !$('cpNm').value) $('cpNm').placeholder = L[i].n || 'محفوظ';
        if (o.onInput) o.onInput(now());
      }
      function drag(el, fn) {
        el.addEventListener('pointerdown', e => {
          el.setPointerCapture(e.pointerId);
          fn(e);
          e.preventDefault();
          const mv = ev => fn(ev),
            up = () => {
              el.removeEventListener('pointermove', mv);
              el.removeEventListener('pointerup', up);
              el.removeEventListener('pointercancel', up);
            };
          el.addEventListener('pointermove', mv);
          el.addEventListener('pointerup', up);
          el.addEventListener('pointercancel', up);
        });
      }
      drag(sv, e => {
        const r = sv.getBoundingClientRect();
        s = 1 - clamp((e.clientX - r.left) / r.width, 0, 1);
        v = 1 - clamp((e.clientY - r.top) / r.height, 0, 1);
        paint();
      });
      drag(hue, e => {
        const r = hue.getBoundingClientRect();
        h = (1 - clamp((e.clientX - r.left) / r.width, 0, 1)) * 360;
        if (h >= 360) h = 359.99;
        paint();
      });
      hx.addEventListener('input', () => {
        let t = hx.value.trim();
        if (t[0] !== '#') t = '#' + t;
        if (OK(t)) {
          [h, s, v] = rgb2hsv(...hex2rgb(t));
          paint(true);
        }
      });
      function list() {
        const el = $('cpList');
        if (!L.length) {
          el.innerHTML =
            '<div class="cp-empty">لا ألوان محفوظة بعد. اختر لوناً ثم اضغط «حفظ في ألواني» وسمّه ليسهل الوصول إليه من القلم والتظليل وكل مكان.</div>';
          return;
        }
        el.innerHTML = L.map(
          (x, i) =>
            `<div class="cp-s" data-i="${i}"><button class="sw" data-use style="background:${x.h}" aria-label="استخدام اللون"></button>${renaming === i ? `<input class="rn" maxlength="24" value="${esc(x.n)}" placeholder="اسم اللون">` : `<button class="nm" data-use>${esc(x.n || 'بلا اسم')}<small>${x.h.toUpperCase()}</small></button>`}<button class="ib" data-rn aria-label="${renaming === i ? 'حفظ الاسم' : 'تسمية'}"><i class="ti ti-${renaming === i ? 'check' : 'pencil'}"></i></button><button class="ib dng" data-del aria-label="حذف"><i class="ti ti-trash"></i></button></div>`
        ).join('');
        const rn = el.querySelector('input.rn');
        if (rn) {
          rn.focus();
          rn.select();
          rn.onkeydown = e => {
            if (e.key === 'Enter') {
              C.rename(renaming, rn.value.trim());
              renaming = -1;
              list();
            }
          };
        }
      }
      $('cpList').onclick = e => {
        const row = e.target.closest('.cp-s');
        if (!row) return;
        const i = +row.dataset.i;
        if (e.target.closest('[data-use]')) {
          [h, s, v] = rgb2hsv(...hex2rgb(L[i].h));
          $('cpNm').value = L[i].n;
          paint();
          return;
        }
        if (e.target.closest('[data-rn]')) {
          if (renaming === i) {
            const rn = row.querySelector('input.rn');
            C.rename(i, rn.value.trim());
            renaming = -1;
          } else renaming = i;
          list();
          return;
        }
        if (e.target.closest('[data-del]')) {
          C.remove(i);
          renaming = -1;
          list();
          EB.toast && EB.toast('حُذف اللون');
        }
      };
      $('cpSave').onclick = () => {
        C.add(now(), $('cpNm').value.trim());
        $('cpNm').value = '';
        list();
        EB.toast && EB.toast('حُفظ في ألواني');
      };
      $('cpOk').onclick = () => {
        const c = now(),
          nm = $('cpNm').value.trim();
        if (nm) C.add(c, nm);
        close();
        cb && cb(c);
      };
      const cancel = () => {
        close();
        o.onCancel && o.onCancel();
      };
      $('cpX').onclick = cancel;
      ov.onclick = e => {
        if (e.target === ov) cancel();
      };
      ov.classList.add('s');
      paint();
      list();
    }
  });
})();
