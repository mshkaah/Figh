(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const RSV100 = (window.RSV100 = window.RSV100 || {});

  const standalone = () => { try { return !!(window.RSUI && RSUI.isStandalone && RSUI.isStandalone()); } catch (e) { return false; } };
  const embedded = () => { try { return typeof isEmbeddedMode !== 'undefined' && !!isEmbeddedMode; } catch (e) { return false; } };
  const canPromptInstall = () => !standalone() && !embedded() && lsGet('rs_installed_flag', '') !== '1';

  function syncInstallBtn() {
    const b = $('installTopBtn'); if (!b) return;
    b.style.display = canPromptInstall() ? '' : 'none';
  }
  RSV100.syncInstallBtn = syncInstallBtn;

  function hookInstallUi() {
    if (!window.RSUI || RSUI.__v100) return;
    const f = RSUI.refreshInstallUi;
    if (typeof f === 'function') {
      RSUI.refreshInstallUi = function () { const r = f.apply(this, arguments); try { syncInstallBtn(); } catch (e) {} return r; };
    }
    RSUI.__v100 = true;
  }
  window.addEventListener('appinstalled', () => {
    lsSet('rs_installed_flag', '1');
    syncInstallBtn(); const n = $('rsInstallNote'); if (n) n.remove();
  });
  try {
    const mq = window.matchMedia('(display-mode: standalone)');
    const on = () => syncInstallBtn();
    if (mq.addEventListener) mq.addEventListener('change', on); else if (mq.addListener) mq.addListener(on);
  } catch (e) {}

  const NKEY = 'rs_install_note';
  const readN = () => { try { const o = JSON.parse(lsGet(NKEY, '{}')); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } };
  function shouldShowNote() {
    if (!canPromptInstall()) return false;
    const n = readN();
    if ((n.count || 0) >= 6) return false;
    if (n.last && Date.now() - n.last < 24 * 3600 * 1000) return false;
    return true;
  }
  function showInstallNote() {
    if (!shouldShowNote() || $('rsInstallNote')) return;
    const n = readN(); n.count = (n.count || 0) + 1; n.last = Date.now(); lsSet(NKEY, JSON.stringify(n));
    const el = document.createElement('div'); el.id = 'rsInstallNote';
    el.innerHTML = `<div class="wn" role="status"><div class="wn-ic wn-ic-inst"><i class="ti ti-download"></i></div><div class="wn-b">
      <div class="wn-h"><b>ثبّت مشكاة الفقه</b><span>الآن</span></div>
      <div class="wn-t">أضِفه إلى شاشتك الرئيسية ليُفتح كتطبيق مستقل ويعمل بلا إنترنت. اضغط هنا للتثبيت.</div></div></div>`;
    document.body.appendChild(el);
    let gone = false, tm = 0;
    const close = () => { if (gone) return; gone = true; clearTimeout(tm); el.classList.add('hide'); el.classList.remove('show'); setTimeout(() => el.remove(), 450); };
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
    tm = setTimeout(close, 9000);
    const wn = el.querySelector('.wn'); let x0 = null, y0 = null, moved = false;
    wn.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; moved = false; }, { passive: true });
    wn.addEventListener('touchmove', (e) => { if (Math.abs(e.touches[0].clientX - x0) > 40 || y0 - e.touches[0].clientY > 25) { moved = true; close(); } }, { passive: true });
    wn.addEventListener('click', () => { if (moved) return; close(); try { RSUI.install(); } catch (e) {} });
  }
  RSV100.showInstallNote = showInstallNote;

  function scheduleInstallNote() {
    if (!shouldShowNote()) return;
    let tries = 0;
    const tick = () => {
      tries++;
      if (tries > 40) return;
      const app = $('app');
      const appUp = app && getComputedStyle(app).display !== 'none';
      const busy = $('rsWelcome') || ($('fnWarn') && $('fnWarn').classList.contains('show')) || document.querySelector('.rs-ov.show, .overlay.show');
      if (appUp && !busy) { setTimeout(() => { if (!$('rsWelcome')) showInstallNote(); else setTimeout(tick, 1500); }, 2200); return; }
      setTimeout(tick, 1500);
    };
    setTimeout(tick, 1800);
  }

  const FAV_KEY = 'rs_search_fav_preset';
  let session = null;

  function openMenu(presetId) {
    const a = getSearchFilterPresets(), i = a.findIndex((x) => x.id === presetId); if (i < 0) return;
    const p = a[i], isFav = lsGet(FAV_KEY, '') === presetId;
    const row = (ic, label, js, off) => `<div class="list-row"${off ? ' style="opacity:.4;pointer-events:none"' : ''} onclick="${js}"><span><i class="ti ti-${ic}"></i></span><div class="label">${label}</div></div>`;
    openMiniMenu(p.name,
      row('pencil', 'تغيير الاسم', `rsPresetRename('${presetId}')`) +
      row('refresh', 'تحديثه بتحديدي الحالي', `rsPresetUpdate('${presetId}')`) +
      row('arrow-right', 'تقديمه (قبل الذي يسبقه)', `rsPresetMove('${presetId}',-1)`, i === 0) +
      row('arrow-left', 'تأخيره (بعد الذي يليه)', `rsPresetMove('${presetId}',1)`, i === a.length - 1) +
      row('star', isFav ? 'إلغاء كونه المفضّل' : 'جعله اختصاري المفضّل', `rsSetFavPreset(${isFav ? "''" : `'${presetId}'`})`) +
      row('trash', 'حذف الاختصار', `closeMiniMenu();confirmDeleteSearchFilterPreset('${presetId}')`) +
      '<div class="hrem-empty">لإعادة الترتيب بالسحب: اضغط مطوّلاً على الاختصار ثم اسحبه إلى مكانه.</div>');
  }

  window.presetChipPointerDown = function (evt, presetId) {
    if (session) session.abort();
    if (evt.pointerType === 'mouse' && evt.button !== 0) return;
    const chip = (evt.currentTarget && evt.currentTarget.classList && evt.currentTarget.classList.contains('search-preset-chip'))
      ? evt.currentTarget : (evt.target && evt.target.closest ? evt.target.closest('.search-preset-chip') : null);
    if (!chip) return;
    const row = chip.parentElement, pid = evt.pointerId, sx = evt.clientX, sy = evt.clientY;
    let entered = false, moved = false, timer = 0, target = null, over = false;
    const t0 = Date.now();
    const others = () => Array.from(row.querySelectorAll('.search-preset-chip')).filter((c) => c !== chip);
    const clearMarks = () => row.querySelectorAll('.drop-target').forEach((c) => c.classList.remove('drop-target'));
    presetLongPressFired = false;

    function enter() {
      if (entered || over) return;
      entered = true; presetLongPressFired = true;
      clearTimeout(timer);
      chip.classList.add('dragging');
      try { chip.setPointerCapture(pid); } catch (e) {}
      try { navigator.vibrate && navigator.vibrate(14); } catch (e) {}
    }
    function detach() {
      document.removeEventListener('pointermove', onMove, true);
      document.removeEventListener('pointerup', onUp, true);
      document.removeEventListener('pointercancel', onUp, true);
      document.removeEventListener('touchmove', onTouchMove, true);
      try { chip.releasePointerCapture(pid); } catch (e) {}
    }
    function finish() {
      over = true; clearTimeout(timer); detach();
      chip.classList.remove('dragging'); chip.style.transform = ''; clearMarks();
      session = null;
      setTimeout(() => { presetLongPressFired = false; }, 400);
    }
    function onTouchMove(e) { if (entered) e.preventDefault(); }
    function onMove(e) {
      if (e.pointerId !== pid || over) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (!entered) {
        if (Math.hypot(dx, dy) > 10) { finish(); }
        return;
      }
      if (e.cancelable) e.preventDefault();
      if (Math.hypot(dx, dy) > 6) moved = true;
      chip.style.transform = `translate(${dx}px,${dy}px)`;
      let hit = null;
      for (const o of others()) {
        const r = o.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top - 6 && e.clientY <= r.bottom + 6) { hit = o; break; }
      }
      if (hit !== target) { clearMarks(); target = hit; if (hit) hit.classList.add('drop-target'); }
    }
    function onUp(e) {
      if (e.pointerId !== pid || over) return;
      const wasEntered = entered, didMove = moved, tgt = target;
      const hijacked = e.type === 'pointercancel' && !wasEntered && !didMove && Date.now() - t0 > 260;
      finish();
      if (hijacked) { presetLongPressFired = true; setTimeout(() => { presetLongPressFired = false; }, 400); openMenu(presetId); return; }
      if (!wasEntered) return;
      if (didMove && tgt) {
        const all = getSearchFilterPresets();
        const from = all.findIndex((x) => x.id === presetId), to = all.findIndex((x) => x.id === tgt.dataset.presetId);
        if (from >= 0 && to >= 0 && from !== to) {
          const item = all.splice(from, 1)[0]; all.splice(to, 0, item);
          saveSearchFilterPresets(all);
        }
        renderSearchFilterPresetsRow();
      } else if (!didMove) {
        openMenu(presetId);
      } else {
        renderSearchFilterPresetsRow();
      }
    }
    session = { enter: () => { if (!over) enter(); }, abort: () => { if (!over) finish(); } };
    document.addEventListener('pointermove', onMove, { capture: true, passive: false });
    document.addEventListener('pointerup', onUp, true);
    document.addEventListener('pointercancel', onUp, true);
    document.addEventListener('touchmove', onTouchMove, { capture: true, passive: false });
    timer = setTimeout(enter, 380);
  };

  document.addEventListener('contextmenu', (e) => {
    const c = e.target && e.target.closest ? e.target.closest('.search-preset-chip') : null;
    if (!c) return;
    e.preventDefault();
    if (session) session.enter();
  }, true);
  document.addEventListener('selectstart', (e) => {
    if (e.target && e.target.closest && e.target.closest('.search-preset-chip')) e.preventDefault();
  }, true);

  function init() {
    hookInstallUi();
    syncInstallBtn();
    scheduleInstallNote();
    try { if (typeof renderSearchFilterPresetsRow === 'function') renderSearchFilterPresetsRow(); } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.addEventListener('pageshow', () => { try { syncInstallBtn(); } catch (e) {} });
})();
