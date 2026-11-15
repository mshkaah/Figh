(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const page = () => $('comparisonPage');
  const content = () => $('content');
  const sticky = () => { const p = page(); return p && p.querySelector('.cmp-sticky'); };

  const FADE_MS = 160;
  const SCROLL_SETTLE_MS = 450;
  const SWIPE_DISTANCE = 34;

  const REVEAL_DISTANCE = 28;

  const state = { folded: false, lastTop: 0, travel: 0, ignoreUntil: 0, animTimer: 0 };

  const collapseHeight = (s) => (s ? parseFloat(s.style.getPropertyValue('--cmp-hc')) || 0 : 0);
  const hideAt = (s) => (s ? parseFloat(s.dataset.hideAt) || collapseHeight(s) : 0);

  function measure() {
    const s = sticky();
    const stack = s && s.querySelector('.cmp-qstack');
    if (!stack) return;
    const hc = Math.max(0, stack.offsetTop - 8);
    if (String(hc) !== s.dataset.hc) {
      s.dataset.hc = String(hc);
      s.style.setProperty('--cmp-hc', hc + 'px');
    }
    const c = content();
    let mark = s.previousElementSibling;
    if (!mark || !mark.classList.contains('cmp-sticky-mark')) {
      mark = document.createElement('div');
      mark.className = 'cmp-sticky-mark';
      s.parentNode.insertBefore(mark, s);
    }
    if (c) s.dataset.hideAt = String(Math.round(mark.getBoundingClientRect().top - c.getBoundingClientRect().top + c.scrollTop + hc));
  }

  let measureFrame = 0;
  function scheduleMeasure() {
    if (measureFrame) return;
    measureFrame = requestAnimationFrame(() => { measureFrame = 0; measure(); });
  }

  const FOLD_KEY = 'rs_jami_qfold';
  const savedFolded = () => { try { return localStorage.getItem(FOLD_KEY) === '1'; } catch (e) { return false; } };
  const saveFolded = (on) => { try { localStorage.setItem(FOLD_KEY, on ? '1' : '0'); } catch (e) {} };

  function applyFold(s, on) {
    s.classList.toggle('q-tuck', on);
    const bar = s.querySelector('.cmp-qpane-bar');
    const full = s.querySelector('.cmp-qpane-full');
    if (bar) bar.setAttribute('aria-hidden', on ? 'false' : 'true');
    if (full) full.setAttribute('aria-hidden', on ? 'true' : 'false');
  }

  function setFolded(on) {
    const s = sticky();
    const c = content();
    if (!s || on === state.folded) return;
    state.folded = on;
    saveFolded(on);
    const stuck = !!c && c.scrollTop >= hideAt(s);
    const before = s.offsetHeight;
    state.ignoreUntil = Date.now() + SCROLL_SETTLE_MS;
    if (window.RSV144 && RSV144.freezeTopbar) RSV144.freezeTopbar(SCROLL_SETTLE_MS);
    s.classList.add('q-anim');
    applyFold(s, on);
    if (stuck) c.scrollTop = Math.max(hideAt(s) + 1, c.scrollTop + s.offsetHeight - before);
    state.lastTop = c ? c.scrollTop : 0;
    clearTimeout(state.animTimer);
    state.animTimer = setTimeout(() => s.classList.remove('q-anim'), FADE_MS + 40);
  }

  function jumpToScholar(chip, e) {
    const p = page();
    const c = content();
    const card = p && p.querySelector(`.cmp-answer-card[data-sch="${chip.dataset.sch}"]`);
    if (!c || !card) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    const s = sticky();
    const bar = s && s.querySelector('.cmp-qbar');
    const cr = c.getBoundingClientRect();
    const r = card.getBoundingClientRect();
    const offset = state.folded && bar ? bar.offsetHeight + 20 : (s ? s.offsetHeight - collapseHeight(s) : 150) + 6;
    card.classList.add('open');
    c.scrollTo({ top: Math.max(0, r.top - cr.top + c.scrollTop - offset), behavior: 'smooth' });
    card.classList.remove('cmp-pulse');
    void card.offsetWidth;
    card.classList.add('cmp-pulse');
  }

  function onScroll() {
    const c = content();
    const s = sticky();
    const p = page();
    if (!c || !s || !p || !p.classList.contains('active')) return;
    const top = c.scrollTop;
    const delta = top - state.lastTop;
    state.lastTop = top;
    if (Date.now() < state.ignoreUntil) { state.travel = 0; return; }
    if (top <= hideAt(s) - collapseHeight(s) + 4) { s.classList.remove('hc-show'); state.travel = 0; return; }
    if (!delta) return;
    state.travel = (delta > 0) === (state.travel > 0) ? state.travel + delta : delta;
    if (state.travel < -REVEAL_DISTANCE) s.classList.add('hc-show');
    else if (state.travel > REVEAL_DISTANCE) s.classList.remove('hc-show');
  }

  function bindPage() {
    const p = page();
    if (!p || p.__jamiBound) return;
    p.__jamiBound = true;

    p.addEventListener('click', (e) => {
      if (e.target.closest('.cmp-qfold')) { e.stopPropagation(); setFolded(true); return; }
      if (e.target.closest('.cmp-qbar')) { e.stopPropagation(); setFolded(false); return; }
      const chip = e.target.closest('.cmp-chip');
      if (chip) jumpToScholar(chip, e);
    }, true);

    let startY = null;
    let startX = 0;
    p.addEventListener('touchstart', (e) => {
      const hit = e.target.closest && e.target.closest('.cmp-question-box, .cmp-qbar');
      if (!hit || e.touches.length !== 1) { startY = null; return; }
      const text = e.target.closest('.cmp-question-text');
      if (text && text.scrollHeight > text.clientHeight + 2) { startY = null; return; }
      startY = e.touches[0].clientY;
      startX = e.touches[0].clientX;
    }, { passive: true });
    p.addEventListener('touchmove', (e) => {
      if (startY == null) return;
      const t = e.touches[0];
      const dy = t.clientY - startY;
      const dx = t.clientX - startX;
      if (Math.abs(dy) > SWIPE_DISTANCE && Math.abs(dy) > Math.abs(dx) * 1.4) {
        setFolded(dy < 0);
        startY = null;
      }
    }, { passive: true });
    p.addEventListener('touchend', () => { startY = null; }, { passive: true });
  }

  function onPageChange() {
    const s = sticky();
    if (s && !s.__jamiReady) {
      s.__jamiReady = true;
      state.folded = savedFolded();
      applyFold(s, state.folded);
      state.travel = 0;
      state.lastTop = content() ? content().scrollTop : 0;
    }
    bindPage();
    scheduleMeasure();
  }

  function start() {
    const p = page();
    if (!p || !content()) { setTimeout(start, 400); return; }
    new MutationObserver(onPageChange).observe(p, { childList: true, subtree: true });
    try { if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleMeasure); } catch (e) {}
    window.addEventListener('resize', scheduleMeasure);
    content().addEventListener('scroll', onScroll, { passive: true });
    onPageChange();
  }

  window.RSJami = { fold: () => setFolded(true), unfold: () => setFolded(false) };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
