(function () {
  'use strict';
  const RKEY = 'rs_reminders';
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (m) => { try { showGenericToast(m); } catch (e) {} };

  const load = () => { try { const a = JSON.parse(lsGet(RKEY, '[]')); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
  function save(list) {
    lsSet(RKEY, JSON.stringify(list));
    try { if (self.RSNotif) RSNotif.kvSet('reminders', list); } catch (e) {}
  }

  const KINDS = {
    f: { find: (key) => favorites[+key], rid: (it) => 'f|' + (it.kind || 'm') + '|' + it.bookId + '|' + it.sectionIdx + '|' + it.masalaNum, label: 'مسألة' },
    n: { find: (key) => notes[+key], rid: (it) => 'n|' + (it.kind || 'm') + '|' + it.bookId + '|' + it.sectionIdx + '|' + it.masalaNum, label: 'مسألة' },
    w: { find: (key) => freeWritings.find((x) => x.id === key), rid: (it) => 'w|' + it.id, label: 'كتابة' },
    b: { find: (key) => customBooks.find((x) => x.id === key), rid: (it) => 'b|' + it.id, label: 'كتاب' },
    c: { find: (key) => collections.find((x) => x.id === key), rid: (it) => 'c|' + it.id, label: 'مجموعة' }
  };
  function describe(k, it) {
    if (k === 'f' || k === 'n') {
      return { ref: { kind: it.kind || null, bookId: it.bookId, sectionIdx: it.sectionIdx, masalaNum: it.masalaNum }, title: it.title || '',
        sub: it.kind ? (it.extSub || it.bookName) : (it.masalaNum ? 'مسألة ' + it.masalaNum + ' — ' : '') + (it.bookName || ''), snippet: (k === 'n' ? it.text : it.snippet) || '' };
    }
    if (k === 'w') return { ref: { id: it.id }, title: (it.title || '').trim() || (it.text || '').trim().split('\n')[0].slice(0, 40) || 'كتابة', sub: 'كتاباتي', snippet: (it.text || '').slice(0, 120) };
    if (k === 'b') return { ref: { id: it.id }, title: it.name || 'كتاب', sub: 'كتبي', snippet: '' };
    if (k === 'c') return { ref: { id: it.id }, title: it.name || 'مجموعة', sub: 'مجموعاتي', snippet: '' };
    return null;
  }
  const ridOf = (k, it) => KINDS[k].rid(it);
  const findActive = (k, key) => { const it = KINDS[k] && KINDS[k].find(key); return it ? load().find((r) => r.rid === ridOf(k, it) && !r.fired) : null; };

  function fmtWhen(ts) { return (window.RSUI && RSUI.fmtDateTime) ? RSUI.fmtDateTime(ts) : new Date(ts).toLocaleString('ar'); }
  const q = (v) => "'" + String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";

  const _swipe = window.swipeRow;
  const SWIPE_PATTERNS = [
    [/onclick="(openFavorite)\((\d+)\)"/, 'f'], [/onclick="(openNoteFromFavorites)\((\d+)\)"/, 'n'],
    [/onclick="(openWritingEditor)\('([^']+)'\)"/, 'w'], [/onclick="(openCustomBookFromPersonal)\('([^']+)'\)"/, 'b'], [/onclick="(openCollectionFromPersonal)\('([^']+)'\)"/, 'c']
  ];
  window.swipeRow = function (html, actions) {
    try {
      const h = String(html);
      for (const [re, k] of SWIPE_PATTERNS) {
        const m = h.match(re);
        if (!m) continue;
        const has = findActive(k, m[2]);
        actions = actions.concat([{ icon: has ? 'bell-ringing' : 'bell', label: 'تذكير', color: has ? '#1b7a3d' : '#2e8b57', js: `rsRemind('${k}',${q(m[2])})` }]);
        break;
      }
    } catch (e) {}
    return _swipe.call(this, html, actions);
  };

  function refresh() { try { if (typeof currentTab !== 'undefined') { if (currentTab === 'favorites') renderFavoritesPage(); else if (currentTab === 'writing' && document.getElementById('personalFind')) renderWritingPage(); } } catch (e) {} }
  function store(rec) {
    const list = load().filter((r) => !(r.rid === rec.rid && !r.fired));
    list.push(Object.assign({ id: 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4), fired: false }, rec));
    save(list);
    try { closeMiniMenu(); } catch (e) {}
    askPermission(); registerSync();
    toast('سأذكّرك ' + fmtWhen(rec.at));
    refresh();
  }
  function setAt(k, key, at) {
    const it = KINDS[k] && KINDS[k].find(key); if (!it) return;
    const d = describe(k, it);
    store({ rid: ridOf(k, it), kind: k, ref: d.ref, title: d.title, sub: d.sub, snippet: d.snippet, at });
  }
  function askPermission() { try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch (e) {} }
  function registerSync() {
    try { navigator.serviceWorker.ready.then((reg) => { if (reg.periodicSync) reg.periodicSync.register('rs-reminders', { minInterval: 15 * 60 * 1000 }).catch(() => {}); }); } catch (e) {}
  }
  window.rsRemindSet = (k, key, at) => setAt(k, key, at);
  window.rsRemindCancel = (k, key) => {
    const it = KINDS[k] && KINDS[k].find(key); if (!it) return;
    save(load().filter((r) => !(r.rid === ridOf(k, it) && !r.fired)));
    try { closeMiniMenu(); } catch (e) {}
    toast('أُلغي التذكير'); refresh();
  };

  function quickOptions() {
    const now = new Date();
    const base = new Date(now); base.setSeconds(0, 0); base.setMinutes(Math.ceil(base.getMinutes() / 5) * 5);
    const plus = (h, d) => { const x = new Date(base); x.setHours(x.getHours() + (h || 0)); x.setDate(x.getDate() + (d || 0)); return x.getTime(); };
    return [['بعد ساعة', plus(1)], ['بعد ثلاث ساعات', plus(3)], ['غداً في مثل هذا الوقت', plus(0, 1)], ['بعد ثلاثة أيام', plus(0, 3)], ['بعد أسبوع', plus(0, 7)]];
  }
  function openDialog(title, k, key, cur) {
    const row = (icon, label, small, onclick, color) => `<div class="list-row" onclick="${onclick}"><span style="font-size:20px;${color ? 'color:' + color + ';' : ''}"><i class="ti ti-${icon}"></i></span><div class="label"${color ? ` style="color:${color};"` : ''}>${label}${small ? `<small>${small}</small>` : ''}</div></div>`;
    let html = '';
    if (cur) html += row('bell-ringing', 'مضبوط: ' + esc(fmtWhen(cur.at)), 'اضغط لتعديل الموعد', `rsRemindCustom('${k}',${q(key)})`, '#1b7a3d');
    else html += row('calendar-plus', 'اختيار يوم وساعة بنفسي', 'أي تاريخ وأي وقت تريد', `rsRemindCustom('${k}',${q(key)})`);
    html += '<div style="font-size:12px;color:var(--text-dim);padding:8px 14px 2px;">أو اختصار سريع</div>';
    html += quickOptions().map(([n, t]) => row('clock', n, esc(fmtWhen(t)), `rsRemindSet('${k}',${q(key)},${t})`)).join('');
    if (cur) html += row('bell-off', 'إلغاء التذكير', '', `rsRemindCancel('${k}',${q(key)})`, '#c0392b');
    openMiniMenu(title, html);
  }
  window.rsRemind = function (k, key) {
    const it = KINDS[k] && KINDS[k].find(key); if (!it) return;
    openDialog('تذكير بهذا ' + KINDS[k].label, k, key, findActive(k, key));
  };
  window.rsRemindCustom = function (k, key) {
    const cur = findActive(k, key);
    try { closeMiniMenu(); } catch (e) {}
    RSUI.pickDateTime({ title: 'موعد التذكير', value: cur ? cur.at : undefined, onDone: (ts) => setAt(k, key, ts) });
  };

  window.RSRemind = {
    forSelection(info) {
      const snippet = String(info.text || '').slice(0, 120);
      const rid = 's|' + info.bk + '|' + info.sec + '|' + snippet.slice(0, 30);
      const mk = (at) => store({ rid, kind: 's', ref: { bk: info.bk, sec: info.sec, text: info.text, pre: info.pre || '', post: info.post || '' }, title: info.title || 'نص محدد', sub: info.sub || '', snippet, at });
      const cur = load().find((r) => r.rid === rid && !r.fired);
      const row = (icon, label, small, fn) => `<div class="list-row" data-act="${fn}"><span style="font-size:20px;"><i class="ti ti-${icon}"></i></span><div class="label">${label}${small ? `<small>${small}</small>` : ''}</div></div>`;
      const opts = quickOptions();
      let html = row('calendar-plus', cur ? 'تعديل الموعد: ' + esc(fmtWhen(cur.at)) : 'اختيار يوم وساعة بنفسي', 'أي تاريخ وأي وقت تريد', 'c')
        + '<div style="font-size:12px;color:var(--text-dim);padding:8px 14px 2px;">أو اختصار سريع</div>'
        + opts.map(([n, t], i) => row('clock', n, esc(fmtWhen(t)), 'q' + i)).join('');
      if (cur) html += row('bell-off', 'إلغاء التذكير', '', 'x');
      openMiniMenu('تذكير بهذا النص', html);
      const list = document.getElementById('miniMenuList');
      if (list) list.onclick = (e) => {
        const r = e.target.closest('[data-act]'); if (!r) return;
        const a = r.dataset.act;
        if (a === 'c') { try { closeMiniMenu(); } catch (er) {} RSUI.pickDateTime({ title: 'موعد التذكير', value: cur ? cur.at : undefined, onDone: mk }); }
        else if (a === 'x') { save(load().filter((x) => !(x.rid === rid && !x.fired))); try { closeMiniMenu(); } catch (er) {} toast('أُلغي التذكير'); }
        else if (a[0] === 'q') mk(opts[+a.slice(1)][1]);
      };
    }
  };

  async function fire(r) {
    const title = 'تذكير: ' + (r.title || 'عنصر');
    const body = [r.sub, (r.snippet || '').slice(0, 120)].filter(Boolean).join('\n');
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification(title, { body, tag: 'rs-rem-' + r.id, icon: './icons/icon-192.png', badge: './icons/icon-192.png', dir: 'rtl', lang: 'ar', data: { open: 'reminder', id: r.id } });
      }
    } catch (e) { try { new Notification(title, { body }); } catch (e2) {} }
    if (!document.hidden) toast(title);
  }
  let busy = false;
  async function tick() {
    if (busy) return; busy = true;
    try {
      const list = load(), now = Date.now(); let changed = false;
      for (const r of list) if (!r.fired && r.at <= now) { r.fired = true; r.firedAt = now; changed = true; await fire(r); }
      const keep = list.filter((r) => !r.fired || now - (r.firedAt || 0) < 3 * 86400000);
      if (changed || keep.length !== list.length) save(keep);
    } finally { busy = false; }
  }
  function openReminder(id) {
    const r = load().find((x) => x.id === id); if (!r) return;
    try {
      if (r.kind === 'f' || r.kind === 'n') {
        const arr = r.kind === 'f' ? favorites : notes;
        const i = arr.findIndex((it) => (it.kind || null) === r.ref.kind && it.bookId === r.ref.bookId && it.sectionIdx === r.ref.sectionIdx && it.masalaNum === r.ref.masalaNum);
        if (i < 0) { toast('هذه المسألة لم تعد في قائمتك'); return; }
        r.kind === 'f' ? openFavorite(i) : openNoteFromFavorites(i);
      } else if (r.kind === 'w') {
        if (!freeWritings.some((x) => x.id === r.ref.id)) { toast('هذه الكتابة لم تعد موجودة'); return; }
        openWritingFromLibrary(r.ref.id);
      } else if (r.kind === 'b') {
        if (!customBooks.some((x) => x.id === r.ref.id)) { toast('هذا الكتاب لم يعد موجوداً'); return; }
        openCustomBookFromPersonal(r.ref.id);
      } else if (r.kind === 'c') {
        if (!collections.some((x) => x.id === r.ref.id)) { toast('هذه المجموعة لم تعد موجودة'); return; }
        openCollectionFromPersonal(r.ref.id);
      } else if (r.kind === 's') {
        if (window.RSSelect && RSSelect.openText) RSSelect.openText(r.ref);
      }
    } catch (e) {}
  }
  window.rsOpenReminder = openReminder;

  const boot = () => {
    try { navigator.serviceWorker.addEventListener('message', (e) => { if (e.data && e.data.type === 'open-reminder') waitReady(() => openReminder(e.data.id)); }); } catch (e) {}
    const id = new URLSearchParams(location.search).get('openReminder');
    waitReady(() => { tick(); if (id) openReminder(id); });
    setInterval(tick, 20000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
    try {
      if (self.RSNotif) RSNotif.kvGet('reminders').then((kv) => {
        const fired = new Set((kv || []).filter((r) => r.fired).map((r) => r.id));
        const list = load(); let ch = false;
        list.forEach((r) => { if (!r.fired && fired.has(r.id)) { r.fired = true; r.firedAt = r.firedAt || Date.now(); ch = true; } });
        if (ch) save(list); else RSNotif.kvSet('reminders', list);
      }).catch(() => {});
    } catch (e) {}
  };
  function waitReady(fn) { let n = 0; const t = setInterval(() => { if ((typeof allBooks !== 'undefined' && allBooks.length) || ++n > 80) { clearInterval(t); if (n <= 80) fn(); } }, 150); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
