(function (root) {
  'use strict';
  const DEFAULTS = { on: false, mode: 'daily', times: ['08:00'], days: [5], everyDays: 2, anchor: 0, lastSent: 0, custom: [], customNotes: {}, rec: 'daily' };
  const MAX_CUSTOM = 40;
  const TAG = 'rs-daily-masala';
  const DB_NAME = 'rasael-notif', STORE = 'kv';
  const MAX_TIMES = 4;

  function hm(str) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(str || ''));
    if (!m) return null;
    return Math.min(23, +m[1]) * 60 + Math.min(59, +m[2]);
  }
  function fmtHM(mins) {
    mins = ((mins % 1440) + 1440) % 1440;
    return String(Math.floor(mins / 60)).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0');
  }
  function midnight(ts) { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); }

  function norm(s) {
    const src = Object.assign({}, s || {});
    if (!src.mode && (src.from || src.every)) { src.mode = 'daily'; src.times = [src.from || '08:00']; }
    const o = Object.assign({}, DEFAULTS, src);
    if (['daily', 'weekly', 'interval', 'custom'].indexOf(o.mode) < 0) o.mode = 'daily';
    let cu = Array.isArray(o.custom) ? o.custom.map(x => +x).filter(x => x > 0) : [];
    o.custom = Array.from(new Set(cu)).sort((a, b) => a - b).slice(0, MAX_CUSTOM);
    const cn = {};
    if (o.customNotes && typeof o.customNotes === 'object') o.custom.forEach(t => { const v = String(o.customNotes[t] || '').replace(/\s+/g, ' ').trim().slice(0, 120); if (v) cn[t] = v; });
    o.customNotes = cn;
    if (['daily', 'weekly', 'interval'].indexOf(o.rec) < 0) o.rec = 'daily';
    if (o.mode !== 'custom') o.rec = o.mode;
    let t = Array.isArray(o.times) ? o.times : [];
    t = t.map(x => hm(x)).filter(x => x !== null);
    t = Array.from(new Set(t)).sort((a, b) => a - b).slice(0, MAX_TIMES);
    if (!t.length) t = [hm('08:00')];
    o.times = t.map(fmtHM);
    let d = Array.isArray(o.days) ? o.days.map(x => parseInt(x, 10)).filter(x => x >= 0 && x <= 6) : [];
    d = Array.from(new Set(d)).sort((a, b) => a - b);
    o.days = d.length ? d : [5];
    o.everyDays = Math.max(1, Math.min(60, parseInt(o.everyDays, 10) || 2));
    o.anchor = +o.anchor || 0;
    o.lastSent = +o.lastSent || 0;
    o.on = !!o.on;
    return o;
  }
  function dayMatches(dayStart, s) {
    if (s.mode === 'weekly') return s.days.indexOf(new Date(dayStart).getDay()) >= 0;
    if (s.mode === 'interval') {
      const a = midnight(s.anchor || dayStart);
      const diff = Math.round((dayStart - a) / 86400000);
      return diff >= 0 && diff % s.everyDays === 0;
    }
    return true;
  }
  function slotsForDay(dayStart, s) {
    s = norm(s);
    if (s.mode === 'custom') { const end = dayStart + 86400000; return s.custom.filter(t => t >= dayStart && t < end); }
    if (!dayMatches(dayStart, s)) return [];
    return s.times.map(t => dayStart + hm(t) * 60000);
  }
  function slotsAround(now, s, ahead) {
    const t0 = midnight(now), out = [];
    const n = ahead === undefined ? 2 : ahead;
    for (let k = -1; k <= n; k++) {
      const d = new Date(t0); d.setDate(d.getDate() + k);
      slotsForDay(d.getTime(), s).forEach(x => out.push(x));
    }
    return out.sort((x, y) => x - y);
  }
  function latestDue(now, s) {
    s = norm(s);
    if (!s.on) return null;
    const due = slotsAround(now, s, 0).filter(t => t <= now && t > s.lastSent);
    if (!due.length) return null;
    const t = due[due.length - 1];
    return (now - t) <= 6 * 3600000 ? t : null;
  }
  function noteFor(s, ts) { s = norm(s); return s.mode === 'custom' ? (s.customNotes[ts] || '') : ''; }
  function upcoming(now, s, limit) {
    s = norm(s);
    if (!s.on) return [];
    if (s.mode === 'custom') return s.custom.filter(t => t > now).slice(0, limit || 12);
    const ahead = s.mode === 'daily' ? 4 : 70;
    return slotsAround(now, s, ahead).filter(t => t > now).slice(0, limit || 12);
  }
  function dayKey(ts) { const d = new Date(ts || Date.now()); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function truncate(t, n) { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n).trim() + '…' : t; }
  function buildPayload(pick, note) {
    if (note) return { title: 'مشكاة الفقه', body: truncate(note, 160), data: { open: 'daily' } };
    if (pick && (pick.snippet || pick.bookName)) {
      return {
        title: 'مسألة اليوم' + (pick.bookName ? ' — ' + pick.bookName : ''),
        body: truncate(pick.snippet, 160) || 'افتح التطبيق لقراءة مسألة اليوم',
        data: { open: 'daily' }
      };
    }
    return { title: 'مسألة اليوم', body: 'افتح التطبيق لقراءة مسألة اليوم', data: { open: 'daily' } };
  }

  function idb() {
    return new Promise((res, rej) => {
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  async function kvGet(k) {
    const db = await idb();
    return new Promise((res, rej) => { const q = db.transaction(STORE).objectStore(STORE).get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
  }
  async function kvSet(k, v) {
    const db = await idb();
    return new Promise((res, rej) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(v, k); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
  }

  root.RSNotif = { noteFor, DEFAULTS, TAG, MAX_TIMES, MAX_CUSTOM, norm, hm, fmtHM, dayMatches, slotsAround, latestDue, upcoming, buildPayload, dayKey, kvGet, kvSet, truncate };
})(typeof self !== 'undefined' ? self : window);
