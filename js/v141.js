(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const vis = (el) => { try { return !!el && el.isConnected && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden'; } catch (e) { return false; } };
  const BLOCKERS = '#settingsOverlay.show, #advancedSettingsOverlay.show, #dcWelcome, #ccFilm, #rsShareOv, #glossaryOverlay.show';
  const GUIDES = '#ccNote, #ccHd, #ccLibTip, #ccTools, #ccMock';

  function dismiss(el) {
    try {
      const b = el.querySelector('.nt-skip, .tl-skip, .mk-ok, .lt-ok, [data-a="skip"]');
      if (b) { b.click(); return; }
      el.classList.remove('show'); setTimeout(() => { try { el.remove(); } catch (e) {} }, 250);
    } catch (e) {}
  }
  function tick() {
    try {
      const loading = vis($('loadingScreen')), block = !!document.querySelector(BLOCKERS);
      if (!loading && !block) return;
      document.querySelectorAll(GUIDES).forEach((el) => { dismiss(el); });
    } catch (e) {}
  }
  setInterval(tick, 350);
})();
