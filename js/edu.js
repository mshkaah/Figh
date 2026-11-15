
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dig = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
  let ov = null, openId = null;
  const toast = (m) => { try { if (window.RSUI && RSUI.toast) return RSUI.toast(m); } catch (e) { } const t = document.createElement('div'); t.className = 'edu-toast'; t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), 2200); };
  const rerender = () => { try { if (typeof currentTab !== 'undefined' && currentTab === 'writing' && typeof renderWritingPage === 'function') renderWritingPage(); } catch (e) { } };

  const secCache = {};
  const tableOf = id => { const b = (typeof allBooks !== 'undefined' ? allBooks : []).find(x => String(x.id) === String(id)); return b && b.bk_table; };
  const rowOf = (t, i) => { const r = db.exec('SELECT title, body FROM "' + t + '" ORDER BY rowid LIMIT 1 OFFSET ' + (i | 0)); return r.length && r[0].values.length ? r[0].values[0] : null; };
  const cleanBody = b => String(b || '').replace(/ /g, ' ').replace(/[ \t]+/g, ' ').replace(/\s?\[\d+\]/g, '').trim();
  function withBook(id, fn) { const prev = currentBookId; currentBookId = Number(id); try { return fn(); } finally { currentBookId = prev; } }
  function styled(id, i, body) {
    return withBook(id, () => { try { return splitParts(id, body).raw.map(part => formatPlainText(part, null, i)); } catch (e) { return [escapeHtml(body).replace(/\n/g, '<br>')]; } });
  }
  const savedPos = id => { try { const m = getSavedPositions()[id]; if (m && m.sectionIdx != null) return { idx: m.sectionIdx, title: m.sectionTitle || '' }; } catch (e) { } try { const lp = JSON.parse(localStorage.getItem('rs_lastPosition') || 'null'); if (lp && String(lp.bookId) === String(id)) return { idx: lp.sectionIdx || 0, title: '' }; } catch (e) { } return null; };
  const BRIDGE = {
    async books() { return (typeof allBooks !== 'undefined' ? allBooks : []).map(b => ({ id: b.id, name: b.name, author: b.author || '' })); },
    async groups() {
      const bs = typeof allBooks !== 'undefined' ? allBooks : [], by = new Map();
      bs.forEach(b => { if (typeof isThamraBook === 'function' && isThamraBook(b.id)) return; const a = b.author || 'أخرى'; if (!by.has(a)) by.set(a, []); by.get(a).push({ id: b.id, name: b.name }); });
      return [...by.entries()].map(([author, books]) => ({ author, books }));
    },
    async recent() { try { const lp = JSON.parse(localStorage.getItem('rs_lastPosition') || 'null'); if (lp && lp.bookId) { const b = allBooks.find(x => x.id === lp.bookId); if (b) return { id: b.id, name: b.name }; } } catch (e) { } return null; },
    async lastPos(id) { return savedPos(id); },
    async sections(id) {
      if (secCache[id]) return secCache[id]; const t = tableOf(id); if (!t || !db) return [];
      const r = db.exec('SELECT title FROM "' + t + '" ORDER BY rowid'); const rows = r.length ? r[0].values : [];
      return secCache[id] = rows.map((v, i) => ({ i, title: (v[0] || '(بدون عنوان)').toString().trim() }));
    },

    async blocks(id, i) {
      const t = tableOf(id); const r = rowOf(t, i); if (!r) return []; const body = cleanBody(r[1]); return partsInfo(id, body);
    },

    async parts(id, i, o) {
      o = o || {}; const t = tableOf(id); if (!t || !db) return []; const r = rowOf(t, i); if (!r) return []; const body = cleanBody(r[1]);
      const info = partsInfo(id, body), html = styled(id, i, body), sp = splitParts(id, body).raw;
      return info.map((x, k) => { let hh = html[k] || ''; if (!o.styles) hh = hh.replace(/<span class="(?:ms-num|ms-answer|ms-sublist)">([\s\S]*?)<\/span>/g, '$1'); if (!o.gloss) hh = hh.replace(/<span class="gterm"[^>]*>([\s\S]*?)<\/span>/g, '$1'); return { k, label: x.label, html: hh, body: sp[k] || '' }; });
    },
    async section(id, i, o) {
      o = o || {}; const t = tableOf(id); if (!t || !db) return null; const r = rowOf(t, i); if (!r) return null; const title = (r[0] || '').toString().trim(), body = cleanBody(r[1]);
      let parts = styled(id, i, body);
      if (o.blocks && o.blocks.length) { const raw = splitParts(id, body).raw; parts = o.blocks.map(k => parts[k]).filter(Boolean); }
      let html = parts.map(x => '<div class="mb">' + x + '</div>').join('');
      if (!o.styles) html = html.replace(/<span class="(?:ms-num|ms-answer|ms-sublist)">([\s\S]*?)<\/span>/g, '$1');
      if (!o.gloss) html = html.replace(/<span class="gterm"[^>]*>([\s\S]*?)<\/span>/g, '$1');
      return { title, html, body };
    },

    async search(q, o) {
      o = o || {}; if (typeof db === 'undefined' || !db || typeof normalizeArabic !== 'function') return { hits: [], mode: 'none' };
      const nt = normalizeArabic(String(q || '')).replace(/\s+/g, ' ').trim(); if (nt.replace(/\s/g, '').length < 2) return { hits: [], mode: 'short' };
      const words = [...new Set(nt.split(' '))], LIM = o.limit || 40, hits = [], bks = typeof allBooks !== 'undefined' ? allBooks : [];
      const ready = typeof searchIndexState !== 'undefined' && searchIndexState === 'ready' && typeof searchIndex !== 'undefined' && searchIndex;
      const rowids = (EDU._rid = EDU._rid || {});
      const ridsOf = t => rowids[t] || (rowids[t] = (() => { const r = db.exec('SELECT rowid FROM "' + t + '" ORDER BY rowid'); return r.length ? r[0].values.map(v => v[0]) : []; })());
      const pos = (arr, rid) => { let lo = 0, hi = arr.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] < rid) lo = m + 1; else hi = m; } return lo; };
      const DIA = /[\u064B-\u065F\u0670\u0640]/;
      const test = (bk, i, title, body) => {
        const t = cleanBody(body), nb = normalizeArabic(t), nti = normalizeArabic(String(title || ''));
        const inT = words.every(w => nti.includes(w)); let p = -1; if (words.every(w => nb.includes(w))) p = nb.indexOf(nt) >= 0 ? nb.indexOf(nt) : nb.indexOf(words[0]);
        if (p < 0 && !inT) return; let snip = '', hl = null;
        if (p >= 0) { let c = 0, k = 0; while (k < t.length && c < p) { if (!DIA.test(t[k])) c++; k++; } const a = Math.max(0, k - 40), e = Math.min(t.length, k + 90); snip = (a ? '…' : '') + t.slice(a, e).replace(/\s+/g, ' ') + (e < t.length ? '…' : ''); const w0 = words.length === 1 ? words[0].length : nt.length; hl = [Math.max(0, k - a + (a ? 1 : 0)), Math.min(snip.length, k - a + (a ? 1 : 0) + w0 + 2)]; }
        else snip = t.replace(/\s+/g, ' ').slice(0, 90);
        hits.push({ bookId: bk.id, bookName: bk.name, author: bk.author || '', i, title: (title || '').toString().trim(), snip, hl, inTitle: inT });
      };
      if (o.book != null) {
        const bk = bks.find(b => String(b.id) === String(o.book)); if (!bk) return { hits, mode: 'none' };
        const r = db.exec('SELECT title, body FROM "' + bk.bk_table + '" ORDER BY rowid'); const rows = r.length ? r[0].values : [];
        for (let i = 0; i < rows.length && hits.length < LIM; i++) test(bk, i, rows[i][0], rows[i][1]); return { hits, mode: 'scan' };
      }
      if (!ready) return { hits, mode: 'noindex' };
      const ix = searchIndex; let ws = words.filter(w => w.length >= 2).sort((a, b) => b.length - a.length).slice(0, 3); if (!ws.length) return { hits, mode: 'short' };
      let mask = null; for (const w of ws) { const m = new Uint8Array(ix.rows); searchIndexMark(w, m); if (!mask) mask = m; else for (let g = 0; g < m.length; g++) mask[g] &= m[g]; }
      const per = new Map(); let n = 0;
      for (let g = 0; g < mask.length && n < 360; g++) { if (!mask[g]) continue; const bid = ix.h.books[ix.bookOfGid[g]].id; let a = per.get(bid); if (!a) per.set(bid, a = []); if (a.length >= 6) continue; a.push(ix.rowidOfGid[g]); n++; }
      for (const [bid, ids] of per) {
        const bk = bks.find(b => b.id === bid); if (!bk) continue; const arr = ridsOf(bk.bk_table);
        for (const r of fetchRowsByRowids(bk.bk_table, ids)) { if (hits.length >= LIM) break; test(bk, pos(arr, r[0]), r[1], r[2]); }
      }
      return { hits, mode: 'index' };
    },
    async glossSources() {
      const m = new Map(); for (const [, arr] of glossaryMap) { const seen = new Set(); (arr || []).forEach(x => { const s = (x && typeof x === 'object' && x.source) || ''; if (seen.has(s)) return; seen.add(s); m.set(s, (m.get(s) || 0) + 1); }); }
      return [...m].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n);
    },
    async defs(term) {
      let d = glossaryMap.get(term); if (!d || !d.length) { const ck = glossaryNormIndex.get(glossKey(term)); if (ck) d = glossaryMap.get(ck); }
      return (d || []).map(x => typeof x === 'string' ? { t: x, s: '' } : { t: x.def || x.text || x.meaning || '', s: x.source || '' });
    }
  };

  const esc2 = x => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');

  function splitParts(id, body) {
    try {
      const p = withBook(id, () => getMarkerPatterns(Number(id))), re = new RegExp(p.test.source, p.test.flags.replace(/[gy]/g, ''));
      if (re.test(body)) { const raw = withBook(id, () => splitByMarker(body, p.src, p.capture, Number(id))); if (raw.length > 1) return { raw, p, kind: 'm' }; }
    } catch (e) { }
    const paras = body.split(/\n+/).map(x => x.trim()).filter(Boolean), raw = []; paras.forEach(x => { if (raw.length && raw[raw.length - 1].length < 60) raw[raw.length - 1] += '\n' + x; else raw.push(x); });
    return { raw: raw.length ? raw : [body], kind: 'p' };
  }
  function partsInfo(id, body) {
    const sp = splitParts(id, body);
    return sp.raw.map((part, k) => { let label = 'فقرة ' + (k + 1); if (sp.kind === 'm') { const m = part.match(sp.p.capture); if (m) { const num = normalizeDigits(m[1] || m[2] || m[3] || m[4] || m[5] || ''); label = (/سؤال/.test(m[0]) ? 'سؤال' : 'مسألة') + ' ' + num; } else label = 'مقدمة'; } return { k, label, snip: part.replace(/\s+/g, ' ').slice(0, 70) }; });
  }

  const EDU = window.EDU = {
    isOpen: () => !!ov,
    openId: () => (ov ? openId : null),
    has: id => EduStore.idx().some(l => String(l.id) === String(id)),
    count: () => EduStore.idx().length,
    hubHtml(q) {
      const norm = typeof normalizeArabic === 'function' ? normalizeArabic : (x => x), t = norm(q || '').trim();
      let list = EduStore.idx(); if (t) list = list.filter(l => norm(l.name + ' ' + (l.book || '')).includes(t));
      const introOff = (() => { try { return localStorage.getItem('rs_edu_intro_off') === '1'; } catch (e) { return false; } })();
      let h = introOff ? '' : `<div class="edu-hero"><button type="button" class="edu-x" aria-label="إغلاق" onclick="EDU.hideIntro()"><i class="ti ti-x"></i></button><div class="edu-hero-ic"><i class="ti ti-chalkboard"></i></div><div class="edu-hero-tx"><b>سبورة المعلم</b><span>اشرح على سبورة لا نهائية، واستعن بنصوص الكتب في مشكاة وأسئلة تفاعلية وملفات PDF وصور.</span></div><button class="edu-go" onclick="EDU.newLesson()"><i class="ti ti-plus"></i>درس جديد</button></div>`;
      if (!t && !introOff) h += `<div class="edu-feats" aria-label="ما الذي تقدمه السبورة"><div class="edu-feat"><i class="ti ti-infinity"></i><b>سبورة لا نهائية</b><span>اكتب وارسم بلا حدود، وقرّب وبعّد كما تشاء.</span></div><div class="edu-feat"><i class="ti ti-book-2"></i><b>نصوص الكتب</b><span>أدرج مسائل من كتب مشكاة، وأخفِ الكلمات واكشفها للتدريب.</span></div><div class="edu-feat"><i class="ti ti-video"></i><b>جلسة وتسجيل</b><span>سجّل شرحك بصوتك وكتابتك في فيديو واحد.</span></div><div class="edu-feat"><i class="ti ti-list-check"></i><b>أسئلة تفاعلية</b><span>صفحات أسئلة وتمارين مع احتفال عند الإجابة الصحيحة.</span></div></div>`;
      if (!list.length) return h + `<div class="pempty">${t ? 'لا نتائج مطابقة.' : 'لا توجد دروس بعد.<br>ابدأ درساً جديداً أو استورد درساً من ملف.'}</div>`;
      h += '<div class="plist">';
      list.forEach(l => {
        const d = l.updated ? new Date(l.updated).toLocaleDateString('ar', { month: 'short', day: 'numeric' }) : '';
        h += swipeRow(`<div class="pitem edu-item" onclick="EDU.open('${l.id}')"><div class="pitem-name">${esc(l.name)}</div><div class="pitem-sub">${dig(l.pages)} صفحة${l.book ? ' · ' + esc(l.book) : ''}${d ? ' · ' + d : ''}</div></div>`,
          [{ icon: 'pencil', label: 'الاسم', color: '#2471A3', js: `EDU.rename('${l.id}')` }, { icon: 'file-export', label: 'تصدير', color: '#2e8b57', js: `EDU.exportFile('${l.id}')` }, { icon: 'trash', label: 'حذف', color: '#c0392b', js: `EDU.remove('${l.id}')` }]);
      });
      return h + '</div>';
    },
    hideIntro() {
      try { localStorage.setItem('rs_edu_intro_off', '1'); } catch (e) { }
      try { if (window.RSHints && RSHints.dismissCard) RSHints.dismissCard('persEdu'); } catch (e) { }
      document.querySelectorAll('.edu-hero, .edu-feats').forEach(c => { c.classList.add('out'); setTimeout(() => c.remove(), 220); });
    },
    newLesson() { openTextPrompt('اسم الدرس', 'درس جديد', async name => { const l = await EduStore.newLesson((name || '').trim() || 'درس جديد'); rerender(); EDU.open(l.id); }); },
    open(id) {
      if (ov) return; openId = String(id); ov = document.createElement('div'); ov.id = 'eduOv';
      const th = document.documentElement.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light');
      ov.innerHTML = '<div class="edu-load"><i class="ti ti-chalkboard"></i><span>تجهيز السبورة…</span></div><iframe title="سبورة المعلم" allow="microphone; fullscreen; clipboard-write" src="edu/board.html?id=' + encodeURIComponent(id) + '&t=' + th + '"></iframe>';
      document.body.appendChild(ov);
    },
    ready() { if (ov) { const l = ov.querySelector('.edu-load'); if (l) l.remove(); } },
    close() { if (!ov) return; ov.remove(); ov = null; openId = null; rerender(); try { RSV89.saveSession(); } catch (e) { } },
    rename(id) { EduStore.get(id).then(l => { if (!l) return; openTextPrompt('اسم الدرس', l.name, async name => { const n = (name || '').trim(); if (n) { await EduStore.rename(id, n); rerender(); } }); }); },
    remove(id) { const l = EduStore.idx().find(x => x.id === id); openConfirmDialog('حذف الدرس «' + (l ? l.name : '') + '» نهائياً؟', async () => { await EduStore.del(id); rerender(); }); },
    async exportFile(id) { const o = await EduStore.exportLesson(id); if (!o) return; const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(o)], { type: 'application/json' })); a.download = (o.lesson.name || 'درس') + '.mishkat-lesson.json'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); },
    importFile() {
      const i = document.createElement('input'); i.type = 'file'; i.accept = '.json,application/json'; i.onchange = async () => { const f = i.files[0]; if (!f) return; try { const l = await EduStore.importLesson(JSON.parse(await f.text())); toast('استُورد الدرس «' + l.name + '»'); rerender(); } catch (e) { toast('الملف ليس درساً صالحاً'); } }; i.click();
    }
  };
  window.EDU_BRIDGE = BRIDGE;
})();
