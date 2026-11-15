(function () {
  var oi = window.setInterval, last = 0;
  window.__rsScrollT = 0;
  ['scroll', 'touchmove', 'wheel'].forEach(function (ev) { window.addEventListener(ev, function () { last = Date.now(); }, { capture: true, passive: true }); });
  window.setInterval = function (fn, ms) {
    var rest = Array.prototype.slice.call(arguments, 2);
    if (typeof fn === 'function' && ms >= 400 && ms <= 1500) {
      var w = function () { if (document.hidden || Date.now() - last < 350) return; return fn.apply(this, rest); };
      return oi.call(window, w, Math.max(ms, 900));
    }
    return oi.apply(window, arguments);
  };
})();
(function(){try{
  if(location.search.indexOf('tour=1')<0) return;
  var real=window.localStorage, mem={}, i, k;
  for(i=0;i<real.length;i++){k=real.key(i);mem[k]=real.getItem(k);}
  mem.rs_hints_off='1';
  var fake={getItem:function(k){return Object.prototype.hasOwnProperty.call(mem,k)?mem[k]:null;},setItem:function(k,v){mem[k]=String(v);},removeItem:function(k){delete mem[k];},clear:function(){mem={};},key:function(n){return Object.keys(mem)[n]||null;}};
  Object.defineProperty(fake,'length',{get:function(){return Object.keys(mem).length;}});
  Object.defineProperty(window,'localStorage',{get:function(){return fake;},configurable:true});
}catch(e){}})();
(function () {
  var ok = true;
  try { window.localStorage.setItem('__t', '1'); window.localStorage.removeItem('__t'); } catch (e) { ok = false; }
  if (!ok) {
    var m = {};
    var shim = { getItem: function (k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; }, setItem: function (k, v) { m[k] = String(v); }, removeItem: function (k) { delete m[k]; }, clear: function () { m = {}; }, key: function (i) { return Object.keys(m)[i] || null; } };
    Object.defineProperty(shim, 'length', { get: function () { return Object.keys(m).length; } });
    try { Object.defineProperty(window, 'localStorage', { value: shim, configurable: true }); } catch (e) {}
    window.__rsStorageVolatile = true;
  } else {
    try {
      var _set = Storage.prototype.setItem, warned = false;
      Storage.prototype.setItem = function (k, v) {
        try { return _set.call(this, k, v); }
        catch (e) {
          if (!warned) { warned = true; setTimeout(function () { try { showGenericToast('تعذّر الحفظ: مساحة التخزين ممتلئة'); } catch (x) {} }, 0); }
        }
      };
    } catch (e) {}
  }
})();
