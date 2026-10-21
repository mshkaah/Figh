const SHELL_VERSION = 'v1.00-t3';
const DB_VERSION = '29';
importScripts('./notif-core.js');
const SHELL_CACHE = `rasael-shell-${SHELL_VERSION}`;
const DB_CACHE = `rasael-db-${DB_VERSION}`;
const KEEP = [SHELL_CACHE, DB_CACHE];

const APP_SHELL = [
  './',
  './index.html',
  './app.js',
  './features.js',
  './writing-view.js',
  './reader-select.js',
  './recents.js',
  './reminders.js',
  './trash.js',
  './v77.js',
  './guide.js',
  './v79.js',
  './v80.js',
  './v81.js',
  './share81.js',
  './v82.js',
  './v89.js',
  './v95.js',
  './v96.js',
  './v100.js',
  './v80.css',
  './v81.css',
  './v82.css',
  './v83.css',
  './v89.css',
  './v91.css',
  './v95.css',
  './v96.css',
  './v100.css',
  './urwa_toc.js',
  './notif-core.js',
  './ui-kit.js',
  './ui-kit.css',
  './manifest.json',
  './vendor/sql-wasm.js',
  './vendor/sql-wasm.wasm',
  './vendor/fonts.css',
  './vendor/tabler/tabler-icons.min.css',
  './vendor/tabler/fonts/tabler-icons.woff2',
  './vendor/tabler/fonts/tabler-icons.woff',
  './vendor/fonts/amiri-arabic-400-normal.woff2',
  './vendor/fonts/amiri-arabic-700-normal.woff2',
  './vendor/fonts/amiri-latin-400-normal.woff2',
  './vendor/fonts/amiri-latin-700-normal.woff2',
  './vendor/fonts/scheherazade-new-arabic-400-normal.woff2',
  './vendor/fonts/scheherazade-new-arabic-500-normal.woff2',
  './vendor/fonts/scheherazade-new-arabic-600-normal.woff2',
  './vendor/fonts/scheherazade-new-arabic-700-normal.woff2',
  './vendor/fonts/scheherazade-new-latin-400-normal.woff2',
  './vendor/fonts/scheherazade-new-latin-500-normal.woff2',
  './vendor/fonts/scheherazade-new-latin-600-normal.woff2',
  './vendor/fonts/scheherazade-new-latin-700-normal.woff2',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/marja/sistani.jpg',
  './icons/marja/subhani.jpg',
  './icons/marja/usfur_cover.jpg',
  './icons/marja/khamenei.jpg',
  './icons/marja/khoei.jpg',
  './icons/marja/khomeini.jpg',
  './icons/marja/fayyad.jpg',
  './icons/marja/sadiq_shirazi.jpg',
  './icons/marja/waheed_khorasani.jpg',
  './icons/marja/mohammad_shirazi.jpg',
  './icons/marja/zanjani.jpg','./icons/marja/haeri.jpg','./icons/marja/najafi.jpg','./icons/marja/tabrizi.jpg','./icons/marja/hakim.jpg','./icons/marja/khaqani.jpg','./icons/marja/makarem.jpg',
  './icons/sharh_diagrams/masala_7_8.png',
  './icons/sharh_diagrams/masala_9.png',
  './icons/sharh_diagrams/masala_11.png',
  './icons/sharh_diagrams/masala_21.png',
];

const MIN_DB_BYTES = 5 * 1024 * 1024;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(APP_SHELL.map((u) => new Request(u, { cache: 'reload' })))));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(names.filter((n) => !KEEP.includes(n)).map((n) => caches.delete(n))))
  );
  self.clients.claim();
});


async function cleanNavResponse(resp) {
  try {
    if (!resp || resp.type === 'opaque' || resp.type === 'error') return resp;
    const h = new Headers(resp.headers);
    h.delete('x-frame-options'); h.delete('content-security-policy'); h.delete('content-security-policy-report-only');
    h.delete('content-length'); h.delete('content-encoding');
    if (!h.get('content-type')) h.set('content-type', 'text/html; charset=utf-8');
    const body = await resp.clone().arrayBuffer();
    return new Response(body, { status: 200, statusText: 'OK', headers: h });
  } catch (e) { return resp; }
}

function isDbRequest(url) { return new URL(url).pathname.endsWith('/books.db'); }
function isShellRequest(url) {
  const u = new URL(url);
  if (u.origin !== self.location.origin) return false;
  const p = u.pathname.replace(/\/+$/, '') || '/';
  return ['/', '/index.html', '/app.js', '/features.js', '/writing-view.js', '/reader-select.js', '/recents.js', '/reminders.js', '/trash.js', '/v77.js', '/guide.js', '/v79.js', '/urwa_toc.js', '/notif-core.js', '/ui-kit.js', '/ui-kit.css', '/manifest.json', '/service-worker.js'].some((sp) => p === sp || p.endsWith(sp));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  if (/\/books_part[12]\.bin$/.test(new URL(req.url).pathname)) return; // أجزاء القاعدة: يديرها app.js مباشرة

  if (isDbRequest(req.url)) {
    event.respondWith((async () => {
      const cache = await caches.open(DB_CACHE);
      const cached = await cache.match(req.url);
      if (cached) {
        const len = +cached.headers.get('Content-Length') || 0;
        if (len === 0 || len > MIN_DB_BYTES) return cached;
        await cache.delete(req.url);
      }
      try {
        const resp = await fetch(req.url);
        const len = +resp.headers.get('Content-Length') || 0;
        if (resp && resp.ok && resp.status === 200 && (len === 0 || len > MIN_DB_BYTES)) {
          cache.put(req.url, resp.clone()).catch(() => {});
        }
        return resp;
      } catch (e) {
        return new Response('', { status: 504, statusText: 'Offline' });
      }
    })());
    return;
  }

  if (new URL(req.url).pathname.endsWith('/search-index.bin')) {
    event.respondWith((async () => {
      const cache = await caches.open(DB_CACHE);
      const cached = await cache.match(req.url);
      if (cached) return cached;
      try {
        const resp = await fetch(req.url);
        if (resp && resp.ok && resp.status === 200) cache.put(req.url, resp.clone()).catch(() => {});
        return resp;
      } catch (e) { return new Response('', { status: 504, statusText: 'Offline' }); }
    })());
    return;
  }

  if (req.mode === 'navigate' || isShellRequest(req.url)) {
    event.respondWith(
      caches.open(SHELL_CACHE).then((c) => c.match(req, { ignoreSearch: true }).then((hit) => hit || (req.mode === 'navigate' ? c.match('./index.html') : null)))
        .then((hit) => hit || fetch(req).then((resp) => {
          if (resp && resp.ok) { const copy = resp.clone(); caches.open(SHELL_CACHE).then((c) => c.put(req, copy)).catch(() => {}); }
          return resp;
        }))
        .then((resp) => (req.mode === 'navigate' ? cleanNavResponse(resp) : resp))
        .catch(() => new Response('', { status: 504, statusText: 'Offline' }))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((r) => {
          if (r && r.status === 200) { const copy = r.clone(); caches.open(SHELL_CACHE).then((c) => c.put(req, copy)).catch(() => {}); }
          return r;
        })
        .catch(() => new Response('', { status: 504, statusText: 'Offline' }));
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'NOTIF_TICK') { event.waitUntil(Promise.all([swNotifyIfDue().catch(() => {}), swRemindersIfDue().catch(() => {})])); return; }
  if (event.data === 'CLEAR_CACHES') {
    event.waitUntil(caches.keys().then((ns) => Promise.all(ns.map((n) => caches.delete(n)))));
  }
});

async function swNotifyIfDue() {
  const N = self.RSNotif;
  const s = await N.kvGet('settings');
  if (!s || !s.on) return;
  const now = Date.now();
  const due = N.latestDue(now, s);
  if (!due) return;
  const rec = await N.kvGet('pick');
  const pick = rec && rec.day === N.dayKey(now) ? rec.pick : null;
  const p = N.buildPayload(pick, N.noteFor(s, due));
  await self.registration.showNotification(p.title, {
    body: p.body, tag: N.TAG, renotify: true, icon: './icons/icon-192.png', badge: './icons/icon-192.png',
    dir: 'rtl', lang: 'ar', data: p.data
  });
  s.lastSent = due;
  await N.kvSet('settings', s);
}

async function swRemindersIfDue() {
  const N = self.RSNotif;
  const list = await N.kvGet('reminders');
  if (!Array.isArray(list) || !list.length) return;
  const now = Date.now(); let changed = false;
  for (const r of list) {
    if (r.fired || r.at > now) continue;
    r.fired = true; r.firedAt = now; changed = true;
    await self.registration.showNotification('تذكير: ' + (r.title || 'مسألة'), {
      body: [r.sub, String(r.snippet || '').slice(0, 120)].filter(Boolean).join('\n'), tag: 'rs-rem-' + r.id,
      icon: './icons/icon-192.png', badge: './icons/icon-192.png', dir: 'rtl', lang: 'ar', data: { open: 'reminder', id: r.id }
    });
  }
  if (changed) await N.kvSet('reminders', list);
}

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'rs-daily-masala') event.waitUntil(Promise.all([swNotifyIfDue().catch(() => {}), swRemindersIfDue().catch(() => {})]));
  if (event.tag === 'rs-reminders') event.waitUntil(swRemindersIfDue().catch(() => {}));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const nd = event.notification.data || {};
  event.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const top = list.find((c) => !/[?&]embedded=1/.test(c.url)) || list[0];
    if (top) {
      try { await top.focus(); } catch (e) {}
      top.postMessage(nd.open === 'reminder' ? { type: 'open-reminder', id: nd.id } : { type: 'open-daily' });
      return;
    }
    if (nd.open === 'reminder') { await self.clients.openWindow('./index.html?openReminder=' + encodeURIComponent(nd.id)); return; }
    await self.clients.openWindow('./index.html?openDaily=1');
  })());
});
