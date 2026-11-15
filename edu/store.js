(function (root) {
  'use strict';
  const DB = 'mishkat_edu',
    IDXK = 'rs_edu_idx';
  let dbp = null;
  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains('lessons')) d.createObjectStore('lessons', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('assets')) d.createObjectStore('assets', { keyPath: 'k' });
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  const tx = (st, mode, fn) =>
    open().then(
      d =>
        new Promise((res, rej) => {
          const t = d.transaction(st, mode),
            s = t.objectStore(st);
          const q = fn(s);
          t.oncomplete = () => res(q && q.result);
          t.onerror = () => rej(t.error);
          t.onabort = () => rej(t.error);
        })
    );
  const uid = () => 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  function idx() {
    try {
      return JSON.parse(localStorage.getItem(IDXK) || '[]');
    } catch (e) {
      return [];
    }
  }
  function setIdx(a) {
    try {
      localStorage.setItem(IDXK, JSON.stringify(a));
    } catch (e) {}
  }
  function meta(l) {
    return {
      id: l.id,
      name: l.name,
      pages: l.pages.length,
      updated: l.updated || Date.now(),
      created: l.created || Date.now(),
      book: (l.pages.find(p => p.sheet && p.sheet.book) || { sheet: {} }).sheet.book || ''
    };
  }
  function touch(l) {
    const a = idx().filter(x => x.id !== l.id);
    a.unshift(meta(l));
    setIdx(a);
  }
  const S = {
    open,
    uid,
    idx,
    touch,
    newLesson(name) {
      const l = { id: uid(), name: name || 'درس جديد', created: Date.now(), updated: Date.now(), sc: 0, pages: [] };
      return S.put(l).then(() => l);
    },
    get(id) {
      return tx('lessons', 'readonly', s => s.get(id));
    },
    put(l) {
      l.updated = Date.now();
      return tx('lessons', 'readwrite', s => s.put(l)).then(() => {
        touch(l);
        return l;
      });
    },
    del(id) {
      return S.assetKeys(id)
        .then(ks =>
          tx('assets', 'readwrite', s => {
            ks.forEach(k => s.delete(k));
          })
        )
        .then(() => tx('lessons', 'readwrite', s => s.delete(id)))
        .then(() => setIdx(idx().filter(x => x.id !== id)));
    },
    putAsset(lid, aid, data) {
      return tx('assets', 'readwrite', s => s.put({ k: lid + ':' + aid, l: lid, d: data }));
    },
    getAsset(lid, aid) {
      return tx('assets', 'readonly', s => s.get(lid + ':' + aid)).then(r => r && r.d);
    },
    assetKeys(lid) {
      return open().then(
        d =>
          new Promise(res => {
            const out = [],
              r = d.transaction('assets').objectStore('assets').openCursor();
            r.onsuccess = () => {
              const c = r.result;
              if (c) {
                if (c.value.l === lid) out.push(c.key);
                c.continue();
              } else res(out);
            };
            r.onerror = () => res(out);
          })
      );
    },
    allAssets(lid) {
      return open().then(
        d =>
          new Promise(res => {
            const out = {},
              r = d.transaction('assets').objectStore('assets').openCursor();
            r.onsuccess = () => {
              const c = r.result;
              if (c) {
                if (c.value.l === lid) out[c.key.slice(lid.length + 1)] = c.value.d;
                c.continue();
              } else res(out);
            };
            r.onerror = () => res(out);
          })
      );
    },
    async exportLesson(id) {
      const l = await S.get(id);
      if (!l) return null;
      return { mishkat: 'lesson', v: 1, lesson: l, assets: await S.allAssets(id) };
    },
    async importLesson(o) {
      if (!o || o.mishkat !== 'lesson' || !o.lesson || !Array.isArray(o.lesson.pages)) throw new Error('ملف غير صالح');
      const l = o.lesson;
      l.id = uid();
      l.name = (l.name || 'درس') + ' (مستورد)';
      await S.put(l);
      for (const k in o.assets || {}) await S.putAsset(l.id, k, o.assets[k]);
      return l;
    },
    async rename(id, name) {
      const l = await S.get(id);
      if (!l) return;
      l.name = name;
      return S.put(l);
    }
  };
  root.EduStore = S;
})(window);
