(function () {
  'use strict';
  const nav = document.getElementById('bottomnav');
  if (!nav) return;
  let pill = document.getElementById('navPill');
  if (!pill) { pill = document.createElement('i'); pill.id = 'navPill'; pill.setAttribute('aria-hidden', 'true'); nav.insertBefore(pill, nav.firstChild); }
  let first = true;
  function place() {
    const a = nav.querySelector('.navitem.active');
    if (!a) return;
    const x = a.offsetLeft, w = a.offsetWidth;
    if (!w) return;
    if (first) { pill.style.transition = 'none'; }
    pill.style.width = w + 'px';
    pill.style.transform = 'translate3d(' + x + 'px,0,0)';
    if (first) { void pill.offsetWidth; pill.style.transition = ''; first = false; }
  }
  let follow = 0;
  function track() {
    const t0 = performance.now();
    cancelAnimationFrame(follow);
    (function step(t) { place(); if (t - t0 < 340) follow = requestAnimationFrame(step); })(t0);
  }
  new MutationObserver(() => track()).observe(nav, { attributes: true, subtree: true, attributeFilter: ['class'] });
  try { new ResizeObserver(() => { first = true; place(); }).observe(nav); } catch (e) {}
  window.addEventListener('resize', () => { first = true; place(); });
  window.addEventListener('orientationchange', () => { first = true; setTimeout(place, 200); });
  requestAnimationFrame(() => requestAnimationFrame(place));
  setTimeout(() => { first = true; place(); }, 800);

  nav.addEventListener('click', (e) => {
    const it = e.target.closest && e.target.closest('.navitem'); if (!it || !nav.contains(it)) return;
    const tab = it.dataset.page; if (!tab || typeof window.showTab !== 'function') return;
    e.stopPropagation();
    document.body.classList.remove('nav-away');
    if (!it.classList.contains('active')) {
      nav.querySelectorAll('.navitem.active').forEach((n) => n.classList.remove('active'));
      it.classList.add('active');
    }
    requestAnimationFrame(() => setTimeout(() => { try { window.showTab(tab); } catch (err) { console.error(err); } }, 0));
  }, true);
})();

(function () {
  const page = document.getElementById('comparisonPage'); if (!page) return;
  const PH = [['السيستاني', 'sistani'], ['الخامنئي', 'khamenei'], ['الفياض', 'fayyad'], ['الخوئي', 'khoei'], ['الخميني', 'khomeini'], ['الوحيد', 'waheed_khorasani'], ['صادق الشيرازي', 'sadiq_shirazi'], ['مكارم', 'makarem'], ['الشيرازي', 'mohammad_shirazi'], ['الحائري', 'haeri'], ['النجفي', 'najafi'], ['التبريزي', 'tabrizi'], ['مكارم', 'makarem'], ['الحكيم', 'hakim'], ['الزنجاني', 'zanjani'], ['السبحاني', 'subhani'], ['الخاقاني', 'khaqani']];
  const photoFor = (n) => { for (const [k, f] of PH) if (n.indexOf(k) >= 0) return 'icons/marja/' + f + '.jpg'; return ''; };
  let busy = false;
  function decorate() {
    busy = true;
    page.querySelectorAll('.cmp-answer-scholar:not([data-av])').forEach((el) => {
      el.setAttribute('data-av', '1');
      const name = (el.textContent || '').trim();
      const src = photoFor(name);
      if (!src) return;
      const av = document.createElement('span'); av.className = 'cmp-av'; av.setAttribute('aria-hidden', 'true');
      const im = document.createElement('img'); im.src = src; im.alt = ''; im.decoding = 'async'; im.loading = 'lazy';
      im.onerror = () => { try { av.remove(); } catch (e) {} };
      av.appendChild(im);
      el.insertBefore(av, el.firstChild);
    });
    busy = false;
  }
  let raf = 0;
  new MutationObserver(() => { if (busy || raf) return; raf = requestAnimationFrame(() => { raf = 0; decorate(); }); }).observe(page, { childList: true, subtree: true });
  decorate();
})();
