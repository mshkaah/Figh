  if ('serviceWorker' in navigator) {
    var __rsHadCtrl = !!navigator.serviceWorker.controller, __rsEmb = /[?&]embedded=1/.test(location.search), __rsUpd = false, __rsT0 = Date.now(), __rsTouched = false;
    ['touchstart', 'mousedown', 'keydown', 'wheel'].forEach(function (ev) { window.addEventListener(ev, function () { __rsTouched = true; }, { once: true, passive: true, capture: true }); });
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!__rsHadCtrl || __rsEmb) { __rsHadCtrl = true; return; }
      if (__rsUpd) return; __rsUpd = true;
      if (window.__rsUserUpd) { try { sessionStorage.setItem('rs_just_updated', '1'); } catch (e) {} location.reload(); return; }
      var go = function () { try { sessionStorage.setItem('rs_just_updated', '1'); } catch (e) {} location.reload(); };
      if (document.hidden || (Date.now() - __rsT0 < 12000 && !__rsTouched)) { go(); return; }
      document.addEventListener('visibilitychange', function () { if (document.hidden) go(); });
      window.addEventListener('pagehide', function () { try { sessionStorage.setItem('rs_just_updated', '1'); } catch (e) {} });
    });
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js').catch(err => {
        console.error('فشل تسجيل Service Worker:', err);
      });
    });
  }
