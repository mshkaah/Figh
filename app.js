(function () {
  try {
    if (localStorage.getItem('rs_jami_rename') === '1') return;
    ['rs_favorites', 'rs_notes', 'rs_custom_books', 'rs_collections'].forEach(function (k) {
      var v = localStorage.getItem(k);
      if (v && v.indexOf('جامع الأحكام') >= 0) localStorage.setItem(k, v.split('جامع الأحكام').join('جامع الاستفتاءات'));
    });
    localStorage.setItem('rs_jami_rename', '1');
  } catch (e) {}
})();

let db = null;
let _dbVersionVerified = null;

const urlParams = new URLSearchParams(location.search);
const isEmbeddedMode = urlParams.get('embedded') === '1';

const BUILD_VERSION = 'v1.00 تجريبية';
const EXPECTED_DB_VERSION = 29;

let allBooks = [];
const BOOK_EXTRA_AUTHORS = { 27: [11], 28: [11], 29: [11] };
function bookInAuthor(b, aid) {
  if (b.author_id === aid) return true;
  const ex = BOOK_EXTRA_AUTHORS[b.id];
  return !!(ex && ex.includes(aid));
}
let allAuthors = {};
let authorOrder = [];
const SPECIAL_AUTHOR_ICONS = {
  0: 'ti-vocabulary',
  25: 'ti-library',
};
function authorFallbackIcon(aid) {
  if (aid === GLOSSARY_AUTHOR_ID) return 'ti-vocabulary';
  return SPECIAL_AUTHOR_ICONS[aid] || 'ti-user-circle';
}

const GLOSSARY_AUTHOR_ID = '__glossary__';

let currentAuthorId = null;
let currentBookId = null;
let currentBookTable = null;
let currentSectionIndex = null;
let currentSections = [];
const bookSectionsCache = new Map();
let navStack = [];
let isNavigatingBack = false;
let currentTab = 'books';
let booksTabActive = false;
let lastBooksPageId = 'booksPage';
let lastBooksPageTitle = 'المحتويات';
let lastBooksBreadcrumb = null;
let reorderModeActive = false;
let searchTabActive = false;
let lastSearchPageBreadcrumb = null;
let libraryOrderSnapshot = null;

function enterReorderModeFromSettings() {
  closeSettings();
  ensureLibraryOrder();
  libraryOrderSnapshot = libraryOrder.slice();
  reorderModeActive = true;
  showTab('books');
}

function saveReorderAndExit() {
  authorOrder = libraryOrder.filter(k => k.indexOf('author:') === 0).map(k => parseLibKey(k).id);
  saveCustomAuthorOrder();
  saveLibraryOrder();
  reorderModeActive = false;
  libraryOrderSnapshot = null;
  renderReferencesPage();
}

function cancelReorderMode() {
  if (libraryOrderSnapshot) libraryOrder = libraryOrderSnapshot;
  libraryOrderSnapshot = null;
  reorderModeActive = false;
  renderReferencesPage();
}

let collections = JSON.parse(localStorage.getItem('rs_collections') || '[]');
function saveCollections() { localStorage.setItem('rs_collections', JSON.stringify(collections)); }

let libraryOrder = JSON.parse(localStorage.getItem('rs_library_order') || 'null') || [];
function parseLibKey(k) {
  const i = k.indexOf(':');
  const type = k.slice(0, i);
  let id = k.slice(i + 1);
  if (type === 'author') id = (id === GLOSSARY_AUTHOR_ID) ? id : parseInt(id, 10);
  if (type === 'book') id = parseInt(id, 10);
  return { type, id };
}
function ensureLibraryOrder() {
  const validKeys = new Set();
  authorOrder.forEach(aid => validKeys.add('author:' + aid));
  customBooks.forEach(cb => validKeys.add('custombook:' + cb.id));
  collections.forEach(col => validKeys.add('collection:' + col.id));
  (typeof freeWritings !== 'undefined' ? freeWritings : []).forEach(w => validKeys.add('writing:' + w.id));
  libraryOrder = libraryOrder.filter(k => validKeys.has(k));
  const present = new Set(libraryOrder);
  authorOrder.forEach(aid => { const k = 'author:' + aid; if (!present.has(k)) { libraryOrder.push(k); present.add(k); } });
  customBooks.forEach(cb => { const k = 'custombook:' + cb.id; if (!present.has(k)) { libraryOrder.push(k); present.add(k); } });
  collections.forEach(col => { const k = 'collection:' + col.id; if (!present.has(k)) { libraryOrder.push(k); present.add(k); } });
  (typeof freeWritings !== 'undefined' ? freeWritings : []).forEach(w => { const k = 'writing:' + w.id; if (!present.has(k)) { libraryOrder.push(k); present.add(k); } });
}
function saveLibraryOrder() { localStorage.setItem('rs_library_order', JSON.stringify(libraryOrder)); }

let dragSrcKey = null;
function onLibDragStart(evt) {
  const row = evt.currentTarget.closest('.lib-reorder-row');
  dragSrcKey = row ? row.dataset.libkey : null;
  if (row) row.classList.add('dragging');
  evt.dataTransfer.effectAllowed = 'move';
}
function onLibDragOver(evt) {
  evt.preventDefault();
  const row = evt.currentTarget;
  if (row.dataset.libkey === dragSrcKey) return;
  const rect = row.getBoundingClientRect();
  const before = (evt.clientY - rect.top) < rect.height / 2;
  row.classList.toggle('drop-before', before);
  row.classList.toggle('drop-after', !before);
}
function onLibDragOverGrid(evt) {
  evt.preventDefault();
  const container = document.getElementById('libReorderContainer');
  if (!container) return;
  const cards = Array.from(container.querySelectorAll('.lib-reorder-row'));
  let nearest = null, nearestDist = Infinity;
  for (const card of cards) {
    if (card.dataset.libkey === dragSrcKey) continue;
    const r = card.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const dist = (evt.clientX - cx) ** 2 + (evt.clientY - cy) ** 2;
    if (dist < nearestDist) { nearestDist = dist; nearest = { card, rect: r }; }
  }
  cards.forEach(c => c.classList.remove('drop-before', 'drop-after'));
  if (nearest) {
    const before = evt.clientX > (nearest.rect.left + nearest.rect.width / 2);
    nearest.card.classList.toggle('drop-before', before);
    nearest.card.classList.toggle('drop-after', !before);
  }
}
function onLibDrop(evt) {
  evt.preventDefault();
  const targetKey = evt.currentTarget.dataset.libkey;
  document.querySelectorAll('.lib-reorder-row').forEach(r => r.classList.remove('drop-before', 'drop-after'));
  if (!dragSrcKey || targetKey === dragSrcKey) return;
  const srcIdx = libraryOrder.indexOf(dragSrcKey);
  let targetIdx = libraryOrder.indexOf(targetKey);
  if (srcIdx === -1 || targetIdx === -1) return;
  libraryOrder.splice(srcIdx, 1);
  targetIdx = libraryOrder.indexOf(targetKey);
  const isGrid = evt.currentTarget.classList.contains('lib-card');
  const rect = evt.currentTarget.getBoundingClientRect();
  const before = isGrid
    ? evt.clientX > (rect.left + rect.width / 2)
    : (evt.clientY - rect.top) < rect.height / 2;
  libraryOrder.splice(before ? targetIdx : targetIdx + 1, 0, dragSrcKey);
  renderReferencesPage();
}
function onLibDragEnd(evt) {
  const row = evt.currentTarget.closest('.lib-reorder-row');
  if (row) row.classList.remove('dragging');
  document.querySelectorAll('.lib-reorder-row').forEach(r => r.classList.remove('drop-before', 'drop-after'));
  dragSrcKey = null;
}

let touchDragState = null;
function onLibHandleTouchStart(evt) {
  if (!reorderModeActive) return;
  evt.preventDefault();
  const row = evt.currentTarget.closest('.lib-reorder-row');
  const allRows = Array.from(document.querySelectorAll('#booksPage .lib-reorder-row'))
    .map(r => ({ el: r, key: r.dataset.libkey, rect: r.getBoundingClientRect() }));
  touchDragState = {
    key: row.dataset.libkey, rowEl: row, startX: evt.touches[0].clientX, startY: evt.touches[0].clientY,
    targetKey: null, before: true, rows: allRows, rafPending: false,
    lastX: evt.touches[0].clientX, lastY: evt.touches[0].clientY
  };
  row.classList.add('dragging');
  row.style.position = 'relative';
  row.style.zIndex = '60';
  document.addEventListener('touchmove', onLibHandleTouchMove, { passive: false });
  document.addEventListener('touchend', onLibHandleTouchEnd, { passive: false });
  document.addEventListener('touchcancel', onLibHandleTouchEnd, { passive: false });
  touchDragState.scrollRaf = requestAnimationFrame(libAutoScrollTick);
}

function onLibHandleTouchMove(evt) {
  if (!touchDragState) return;
  evt.preventDefault();
  touchDragState.lastX = evt.touches[0].clientX;
  touchDragState.lastY = evt.touches[0].clientY;
  if (touchDragState.rafPending) return;
  touchDragState.rafPending = true;
  requestAnimationFrame(() => { if (touchDragState) { touchDragState.rafPending = false; libDragApply(); } });
}
function libAutoScrollTick() {
  if (!touchDragState) return;
  const content = document.getElementById('content');
  if (content) {
    const cRect = content.getBoundingClientRect();
    const edge = 110, y = touchDragState.lastY;
    let sp = 0;
    if (y < cRect.top + edge) sp = -Math.min(26, Math.ceil((cRect.top + edge - y) / 4));
    else if (y > cRect.bottom - edge) sp = Math.min(26, Math.ceil((y - (cRect.bottom - edge)) / 4));
    if (sp) {
      const before = content.scrollTop;
      content.scrollTop += sp;
      const moved = content.scrollTop - before;
      if (moved) {
        touchDragState.startY -= moved;
        touchDragState.rows.forEach(r => { r.rect = r.el.getBoundingClientRect(); });
        libDragApply();
      }
    }
  }
  touchDragState.scrollRaf = requestAnimationFrame(libAutoScrollTick);
}
function libDragApply() {
  if (!touchDragState) return;
  const touchX = touchDragState.lastX, touchY = touchDragState.lastY;
  const dx = touchX - touchDragState.startX, dy = touchY - touchDragState.startY;
  touchDragState.rowEl.style.transform = `translate(${dx}px, ${dy}px)`;
  let nearest = null, nearestDist = Infinity;
  for (const r of touchDragState.rows) {
    if (r.key === touchDragState.key) continue;
    const cx = r.rect.left + r.rect.width / 2, cy = r.rect.top + r.rect.height / 2;
    const dist = (touchX - cx) ** 2 + (touchY - cy) ** 2;
    if (dist < nearestDist) { nearestDist = dist; nearest = r; }
  }
  touchDragState.rows.forEach(r => r.el.classList.remove('drop-before', 'drop-after'));
  if (nearest) {
    const isGrid = nearest.el.classList.contains('lib-card');
    const before = isGrid ? touchX > (nearest.rect.left + nearest.rect.width / 2) : (touchY - nearest.rect.top) < nearest.rect.height / 2;
    nearest.el.classList.toggle('drop-before', before);
    nearest.el.classList.toggle('drop-after', !before);
    touchDragState.targetKey = nearest.key;
    touchDragState.before = before;
  }
}

function onLibHandleTouchEnd() {
  if (!touchDragState) return;
  document.removeEventListener('touchmove', onLibHandleTouchMove);
  document.removeEventListener('touchend', onLibHandleTouchEnd);
  document.removeEventListener('touchcancel', onLibHandleTouchEnd);
  cancelAnimationFrame(touchDragState.scrollRaf);
  const { key, targetKey, before } = touchDragState;
  touchDragState = null;
  document.querySelectorAll('.lib-reorder-row').forEach(r => {
    r.classList.remove('drop-before', 'drop-after', 'dragging');
    r.style.transform = ''; r.style.position = ''; r.style.zIndex = '';
  });
  if (!targetKey || targetKey === key) return;
  const srcIdx = libraryOrder.indexOf(key);
  if (srcIdx === -1) return;
  libraryOrder.splice(srcIdx, 1);
  let targetIdx = libraryOrder.indexOf(targetKey);
  if (targetIdx === -1) targetIdx = libraryOrder.length;
  libraryOrder.splice(before ? targetIdx : targetIdx + 1, 0, key);
  renderReferencesPage();
}

const FONT_SIZE_LEVELS = [15, 17, 20, 24];
function nearestFontSizeLevel(v) {
  v = parseInt(v, 10);
  if (isNaN(v)) return 17;
  return Math.max(12, Math.min(40, v));
}
let fontSize = nearestFontSizeLevel(parseInt(localStorage.getItem('rs_fontSize') || '17', 10));
let fontFamily = localStorage.getItem('rs_fontFamily') || 'font-default';
let nightMode = localStorage.getItem('rs_night') === '1';
let favSubTab = localStorage.getItem('rs_fav_subtab') || 'starred';
let favorites = JSON.parse(localStorage.getItem('rs_favorites') || '[]');

let pins = JSON.parse(localStorage.getItem('rs_pins') || '[]');

let customBooks = JSON.parse(localStorage.getItem('rs_custom_books') || '[]');
migrateCustomBooksV2();
function migrateCustomBooksV2() {
  let changed = false;
  customBooks.forEach(cb => {
    if (cb.migratedV2) return;
    const newItems = [];
    let currentChapter = null;
    (cb.items || []).forEach(it => {
      if (it.type === 'heading') {
        currentChapter = { uid: it.uid, type: 'chapter', title: it.text, items: [] };
        if (it.color) currentChapter.color = it.color;
        newItems.push(currentChapter);
      } else if (currentChapter) {
        currentChapter.items.push(it);
      } else {
        newItems.push(it);
      }
    });
    cb.items = newItems;
    cb.migratedV2 = true;
    changed = true;
  });
  if (changed) saveCustomBooks();
}

let glossaryMap = new Map();
let glossaryTermsSet = new Set();
let glossaryRegex = null;
const GLOSSARY_MIN_TERM_LEN = 4;
const GLOSSARY_SHORT_STOP = new Set(['قال']);
function isShortGlossaryTermAllowed(term, defs) {
  const bare = String(term).replace(/[\u064B-\u065F\u0670\u0640\u200c\u200d\s]/g, '')
    .replace(/[إأآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
  if (!/^[\u0621-\u064A]{3}$/.test(bare)) return false;
  if (GLOSSARY_SHORT_STOP.has(bare)) return false;
  return defs.some(d => !d.gram);
}
const ARABIC_WORD_CHAR = '\\u0600-\\u06FF\\u200c\\u200d';

const BLOCK_NUM_SRC = '[0-9\\u06F0-\\u06F9\\u0660-\\u0669]+';
const BLOCK_WORD_SRC = '(?:المسأل[ةه]|مسأل[ةه]|المسال[ةه]|مسال[ةه]|السؤال|سؤال|السوال|سوال)';
const BLOCK_END_SRC = '(?:\\s*:|\\s*\\.(?!\\d))';
const BLOCK_MARKER_SRC = `(?:\\(\\s*${BLOCK_WORD_SRC}\\s*:\\s*${BLOCK_NUM_SRC}\\s*\\)|\\(\\s*${BLOCK_WORD_SRC}\\s*${BLOCK_NUM_SRC}\\s*\\)|${BLOCK_WORD_SRC}\\s*\\(\\s*${BLOCK_NUM_SRC}\\s*\\)${BLOCK_END_SRC}|${BLOCK_WORD_SRC}\\s*${BLOCK_NUM_SRC}${BLOCK_END_SRC})`;
const BLOCK_MARKER_TEST = new RegExp(BLOCK_MARKER_SRC);
const BLOCK_MARKER_CAPTURE = new RegExp(`^(?:\\(\\s*${BLOCK_WORD_SRC}\\s*:\\s*(${BLOCK_NUM_SRC})\\s*\\)|\\(\\s*${BLOCK_WORD_SRC}\\s*(${BLOCK_NUM_SRC})\\s*\\)|${BLOCK_WORD_SRC}\\s*\\(\\s*(${BLOCK_NUM_SRC})\\s*\\)${BLOCK_END_SRC}|${BLOCK_WORD_SRC}\\s*(${BLOCK_NUM_SRC})${BLOCK_END_SRC})`);

const MARKER_REF_CUE_WORDS = ['تقدّم', 'تقدم', 'تقدّمت', 'تقدمت', 'ماتقدم', 'المتقدّم', 'المتقدم',
  'سيأتي', 'سياتي', 'سأتي', 'ستأتي', 'ستاتي', 'سيجيء', 'سيجئ', 'ستجيء', 'ستجئ', 'يأتي', 'تأتي', 'يجيء', 'تجيء',
  'سيتّضح', 'سيتضح', 'ستتّضح', 'ستتضح', 'يتّضح', 'يتضح', 'تتّضح', 'تتضح',
  'مرّ', 'مر', 'ذكرنا', 'ذكرناه', 'ذكرناها', 'ذكره', 'ذكرها', 'ذكرتم', 'ذكرت', 'ذكر',
  'سيذكر', 'ستذكر', 'سنذكر', 'قلتم', 'قلنا',
  'راجع', 'سبق', 'سابقاً', 'السابقة', 'ورد', 'مذكور', 'مذكورة', 'المذكور', 'المذكورة',
  'مضى', 'جاء', 'قدمنا', 'أسلفنا', 'اسلفنا', 'بيّناه', 'بيناه', 'بيّنّاه', 'بيانه', 'بيانها'];
const MARKER_REF_NOUN_WORDS = ['الفقرة', 'الفقره', 'فقرة', 'البند', 'بند', 'النقطة', 'نقطة'];
const MARKER_REF_CUE_RE = new RegExp(
  `(?:${MARKER_REF_CUE_WORDS.join('|')})[^.:؛؟\\n]{0,60}?(?:في|فيها|فيه)\\s*(?:(?:${MARKER_REF_NOUN_WORDS.join('|')})\\s*)?$`
);
const ARABIC_LETTER_RE = /[\u0600-\u06FF]/;
const ATTACHABLE_PREFIX_LETTERS = ['و', 'ف', 'ل', 'ب', 'ك'];
function stripTrailingBreaksAndSpace(s) {
  let prev;
  do { prev = s; s = s.replace(/(?:<br>|\s)+$/, ''); } while (s !== prev);
  return s;
}
function isMarkerPrecededByReferenceCue(text, matchIndex) {
  const raw = text.slice(Math.max(0, matchIndex - 140), matchIndex);
  const before = stripTrailingBreaksAndSpace(raw);
  if (!MARKER_REF_CUE_RE.test(before)) return false;
  const m = before.match(MARKER_REF_CUE_RE);
  let cueStart = m.index;
  if (cueStart > 0 && ATTACHABLE_PREFIX_LETTERS.includes(before[cueStart - 1])) {
    cueStart -= 1;
  }
  const prevChar = cueStart > 0 ? before[cueStart - 1] : '';
  return !ARABIC_LETTER_RE.test(prevChar);
}

function numFromMarkerStr(numStr) {
  if (numStr == null) return null;
  const table = {};
  for (let i = 0; i < 10; i++) {
    table[String.fromCharCode(0x0660 + i)] = String(i);
    table[String.fromCharCode(0x06F0 + i)] = String(i);
  }
  const conv = [...numStr].map(c => table[c] || c).join('');
  const n = parseInt(conv, 10);
  return Number.isNaN(n) ? null : n;
}
const DIACRITIC_RE = /[\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED]/;
const DIACRITIC_G_RE = /[\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED]/g;
let _identityMap = new Int32Array(0);
function stripDiacriticsWithMap(text) {
  DIACRITIC_G_RE.lastIndex = 0;
  let m = DIACRITIC_G_RE.exec(text);
  if (!m) {
    if (_identityMap.length < text.length + 1) {
      const sz = Math.max(text.length + 1, _identityMap.length * 2, 4096);
      _identityMap = new Int32Array(sz);
      for (let i = 0; i < sz; i++) _identityMap[i] = i;
    }
    return { stripped: text, map: _identityMap };
  }
  const parts = [], map = [];
  let last = 0;
  while (m) {
    if (m.index > last) { parts.push(text.slice(last, m.index)); for (let i = last; i < m.index; i++) map.push(i); }
    last = m.index + 1;
    m = DIACRITIC_G_RE.exec(text);
  }
  if (last < text.length) { parts.push(text.slice(last)); for (let i = last; i < text.length; i++) map.push(i); }
  map.push(text.length);
  return { stripped: parts.join(''), map };
}

function diacriticTolerantWrap(html, regexSrc, wrapClass, skipIf) {
  const { stripped, map } = stripDiacriticsWithMap(html);
  const re = new RegExp(regexSrc, 'g');
  const matches = [];
  let m;
  while ((m = re.exec(stripped)) !== null) {
    matches.push(m);
    if (re.lastIndex === m.index) re.lastIndex++;
  }
  for (let i = matches.length - 1; i >= 0; i--) {
    const mm = matches[i];
    const p1 = mm[1] || '', p2 = mm[2] || '', p3 = mm[3];
    const origStart = map[mm.index];
    const p3StartStripped = mm.index + p1.length + p2.length;
    const origP3Start = map[p3StartStripped];
    const origP3End = map[p3StartStripped + p3.length];
    if (skipIf && skipIf(html, origP3Start, mm[4], origP3End - origP3Start)) continue;
    html = html.slice(0, origP3Start) + `<span class="${wrapClass}">` + html.slice(origP3Start, origP3End) + '</span>' + html.slice(origP3End);
  }
  return html;
}

const CROSS_ROW_DIP_EXCLUDED_BOOK_IDS = new Set([56, 101, 102, 103, 104, 105, 106, 107, 108, 109]);
const bookCrossRowSuppressionCache = {};
function stripBrAndNewlines(s) {
  return s.replace(/<br>|\n/g, '');
}
const DIP_SIG_WINDOW = 20;
function buildDipSignature(textOrHtml, matchIndex, matchLen) {
  const markerText = stripBrAndNewlines(textOrHtml.slice(matchIndex, matchIndex + matchLen));
  const afterText = stripBrAndNewlines(textOrHtml.slice(matchIndex + matchLen, matchIndex + matchLen + DIP_SIG_WINDOW));
  return `${markerText}|${afterText}`;
}

function getBookLevelSuppressedSignatures(bookId, rowsOverride) {
  if (bookCrossRowSuppressionCache[bookId]) return bookCrossRowSuppressionCache[bookId];
  const suppressed = new Set();
  const patterns = getMarkerPatterns(bookId);
  const captureRe = new RegExp(patterns.capture);
  const rows = rowsOverride || getBookOrderedRawRows(bookId);
  if (!rows || !rows.length) { bookCrossRowSuppressionCache[bookId] = suppressed; return suppressed; }
const SAFETY_LENGTH_CHECK_BOOK_IDS = new Set([...CROSS_ROW_DIP_EXCLUDED_BOOK_IDS, 84]);
const isRiskyPackedQaBook = SAFETY_LENGTH_CHECK_BOOK_IDS.has(bookId);
  const seq = [];
  const PROBE_WINDOW = 200;
  for (const r of rows) {
    const sec = buildSectionFromRow(r[0], r[1], r[2], r[3], bookId);
    const { stripped, map } = stripDiacriticsWithMap(sec.body);
    const re = new RegExp(patterns.src, 'g');
    const rowMatchPositions = [];
    if (isRiskyPackedQaBook) {
      const re2 = new RegExp(patterns.src, 'g');
      let mm;
      while ((mm = re2.exec(stripped)) !== null) {
        rowMatchPositions.push(mm.index);
        if (re2.lastIndex === mm.index) re2.lastIndex++;
      }
    }
    let m;
    while ((m = re.exec(stripped)) !== null) {
      if (!isMarkerPrecededByReferenceCue(stripped, m.index)) {
        const origIdx = map[m.index];
        const cm = sec.body.slice(origIdx).match(captureRe);
        const numStr = cm ? (cm[1] || cm[2] || cm[3] || cm[4] || cm[5]) : null;
        const num = numFromMarkerStr(numStr);
        if (num != null) {
          const gapText = stripBrAndNewlines(stripped.slice(m.index + m[0].length, m.index + m[0].length + DIP_SIG_WINDOW));
          let probeLen = 0;
          if (isRiskyPackedQaBook) {
            const nextPos = rowMatchPositions.find(p => p > m.index);
            const probeEnd = Math.min(m.index + m[0].length + PROBE_WINDOW, nextPos != null ? nextPos : stripped.length);
            probeLen = stripBrAndNewlines(stripped.slice(m.index + m[0].length, probeEnd)).length;
          }
          seq.push({ num, sig: `${stripBrAndNewlines(stripped.slice(m.index, m.index + m[0].length))}|${gapText}`, probeLen });
        }
      }
      if (re.lastIndex === m.index) re.lastIndex++;
    }
  }
  for (let i = 1; i < seq.length - 1; i++) {
    const prev = seq[i - 1], cur = seq[i], next = seq[i + 1];
    const isDip = cur.num < prev.num && next.num > prev.num && (next.num - prev.num) >= 1 && (next.num - prev.num) <= 10;
    const isSpike = cur.num > prev.num + 15 && Math.abs(next.num - prev.num) <= 10 && !isLikelyDigitTypo(cur.num, prev.num, next.num);
    if (isDip || isSpike) {
      if (isRiskyPackedQaBook && cur.probeLen > 60) continue;
      suppressed.add(cur.sig);
    }
  }
  bookCrossRowSuppressionCache[bookId] = suppressed;
  return suppressed;
}

function isCrossRowSuppressed(textOrHtml, pos, len, bookId) {
  if (bookId == null || len == null) return false;
  const sigs = getBookLevelSuppressedSignatures(bookId);
  if (!sigs.size) return false;
  return sigs.has(buildDipSignature(textOrHtml, pos, len));
}

function isLikelyDigitTypo(curNum, prevNum, nextNum) {
  const s = String(curNum);
  if (s.length < 2) return false;
  const lo = Math.min(prevNum, nextNum) - 1, hi = Math.max(prevNum, nextNum) + 1;
  for (let i = 0; i < s.length - 1; i++) {
    const chars = s.split('');
    [chars[i], chars[i + 1]] = [chars[i + 1], chars[i]];
    const swapped = parseInt(chars.join(''), 10);
    if (!Number.isNaN(swapped) && swapped >= lo && swapped <= hi) return true;
  }
  return false;
}

function filterSequenceDips(text, candidates, capturePattern) {
  if (!capturePattern) return candidates;
  const captureRe = new RegExp(capturePattern);
  const withNums = candidates.map(c => {
    const cm = text.slice(c.index).match(captureRe);
    const numStr = cm ? (cm[1] || cm[2] || cm[3] || cm[4] || cm[5]) : null;
    return { index: c.index, len: c.len || 0, num: numFromMarkerStr(numStr) };
  });
  const drop = new Array(withNums.length).fill(false);
  const MEANINGFUL_CONTENT_RE = /[\u0621-\u064A]{2,}/;
  if (withNums.length >= 2) {
    for (let i = 0; i < withNums.length - 1; i++) {
      const cur = withNums[i];
      const nextIdx = withNums[i + 1].index;
      const contentAfter = text.slice(cur.index + cur.len, nextIdx);
      if (!MEANINGFUL_CONTENT_RE.test(contentAfter)) {
        drop[i] = true;
      }
    }
  }
  if (candidates.length < 3) return candidates.filter((c, i) => !drop[i]);
  for (let i = 1; i < withNums.length - 1; i++) {
    const prev = withNums[i - 1].num, cur = withNums[i].num, next = withNums[i + 1].num;
    if (prev == null || cur == null || next == null) continue;
    if (cur < prev && next > prev && (next - prev) >= 1 && (next - prev) <= 10) {
      drop[i] = true;
      continue;
    }
    if (cur > prev + 15 && Math.abs(next - prev) <= 10 && !isLikelyDigitTypo(cur, prev, next)) {
      drop[i] = true;
    }
  }
  return candidates.filter((c, i) => !drop[i]);
}

function splitByMarker(text, srcPattern, capturePattern, bookId) {
  const { stripped, map } = stripDiacriticsWithMap(text);
  const re = new RegExp(srcPattern, 'g');
  let candidates = [];
  let m;
  while ((m = re.exec(stripped)) !== null) {
    if (!isMarkerPrecededByReferenceCue(stripped, m.index)) {
      candidates.push({ index: m.index, len: m[0].length });
    }
    if (re.lastIndex === m.index) re.lastIndex++;
  }
  candidates = filterSequenceDips(stripped, candidates, capturePattern);
  const effectiveBookId = bookId != null ? bookId : currentBookId;
  if (effectiveBookId != null && candidates.length) {
    const suppressedSigs = getBookLevelSuppressedSignatures(effectiveBookId);
    if (suppressedSigs.size) {
      candidates = candidates.filter(c => !suppressedSigs.has(buildDipSignature(stripped, c.index, c.len)));
    }
  }
  const starts = candidates.map(c => map[c.index]);
  if (!starts.length) return [text];
  const parts = [];
  if (starts[0] > 0) parts.push(text.slice(0, starts[0]));
  for (let i = 0; i < starts.length; i++) {
    parts.push(text.slice(starts[i], i + 1 < starts.length ? starts[i + 1] : text.length));
  }
  return parts;
}

const DASH_LINESTART_SRC = `(?:^|\\n)\\s*${BLOCK_NUM_SRC}\\s*ـ`;
const DASH_LINESTART_HTML_SRC = `${BLOCK_NUM_SRC}\\s*ـ`;
const DASH_LINESTART_CAPTURE = `^(?:\\n|\\s)*(${BLOCK_NUM_SRC})\\s*ـ`;

const BLOCK_MARKER_NO_PAREN_BARE_SRC = `(?:\\(\\s*${BLOCK_WORD_SRC}\\s*:\\s*${BLOCK_NUM_SRC}\\s*\\)|${BLOCK_WORD_SRC}\\s*\\(\\s*${BLOCK_NUM_SRC}\\s*\\)${BLOCK_END_SRC}|${BLOCK_WORD_SRC}\\s*${BLOCK_NUM_SRC}${BLOCK_END_SRC})`;
const BLOCK_MARKER_NO_PAREN_BARE_CAPTURE = `^(?:\\(\\s*${BLOCK_WORD_SRC}\\s*:\\s*(${BLOCK_NUM_SRC})\\s*\\)|${BLOCK_WORD_SRC}\\s*\\(\\s*(${BLOCK_NUM_SRC})\\s*\\)${BLOCK_END_SRC}|${BLOCK_WORD_SRC}\\s*(${BLOCK_NUM_SRC})${BLOCK_END_SRC})`;
const NO_PAREN_BARE_OVERRIDE = { src: BLOCK_MARKER_NO_PAREN_BARE_SRC, capture: BLOCK_MARKER_NO_PAREN_BARE_CAPTURE };

const BLOCK_MARKER_WITH_BRACKET_SRC = `(?:${BLOCK_WORD_SRC}\\s*\\[\\s*${BLOCK_NUM_SRC}\\s*\\]\\s*:|${BLOCK_MARKER_SRC})`;
const BLOCK_MARKER_WITH_BRACKET_CAPTURE = `^(?:${BLOCK_WORD_SRC}\\s*\\[\\s*(${BLOCK_NUM_SRC})\\s*\\]\\s*:|\\(\\s*${BLOCK_WORD_SRC}\\s*:\\s*(${BLOCK_NUM_SRC})\\s*\\)|\\(\\s*${BLOCK_WORD_SRC}\\s*(${BLOCK_NUM_SRC})\\s*\\)|${BLOCK_WORD_SRC}\\s*\\(\\s*(${BLOCK_NUM_SRC})\\s*\\)${BLOCK_END_SRC}|${BLOCK_WORD_SRC}\\s*(${BLOCK_NUM_SRC})${BLOCK_END_SRC})`;

const BLOCK_END_DASH_SRC = '(?:\\s*[:.\\-–ـ](?!\\d))';
const BLOCK_DASH_ALT_SRC = `${BLOCK_WORD_SRC}\\s*${BLOCK_NUM_SRC}${BLOCK_END_DASH_SRC}`;
const BLOCK_DASH_ALT_CAPTURE = `${BLOCK_WORD_SRC}\\s*(${BLOCK_NUM_SRC})${BLOCK_END_DASH_SRC}`;
const BLOCK_MARKER_WITH_DASH_SRC = `(?:${BLOCK_MARKER_SRC}|${BLOCK_DASH_ALT_SRC})`;
const BLOCK_MARKER_WITH_DASH_CAPTURE = BLOCK_MARKER_CAPTURE.source + '|' + '^' + BLOCK_DASH_ALT_CAPTURE;
const BLOCK_OUTER_BRACKET_ALT_SRC = `\\[\\s*${BLOCK_WORD_SRC}\\s*${BLOCK_NUM_SRC}\\s*\\]\\s*[:.]?`;
const BLOCK_OUTER_BRACKET_ALT_CAPTURE = `\\[\\s*${BLOCK_WORD_SRC}\\s*(${BLOCK_NUM_SRC})\\s*\\]\\s*[:.]?`;
const BLOCK_CLOSEPAREN_ALT_SRC = `${BLOCK_WORD_SRC}\\s*${BLOCK_NUM_SRC}\\s*\\)`;
const BLOCK_CLOSEPAREN_ALT_CAPTURE = `${BLOCK_WORD_SRC}\\s*(${BLOCK_NUM_SRC})\\s*\\)`;
const BOOK_MARKER_OVERRIDES = {
  53: { src: BLOCK_MARKER_WITH_DASH_SRC, capture: BLOCK_MARKER_WITH_DASH_CAPTURE },
  54: { src: BLOCK_MARKER_WITH_DASH_SRC, capture: BLOCK_MARKER_WITH_DASH_CAPTURE },
  114: { src: `(?:${BLOCK_OUTER_BRACKET_ALT_SRC}|${BLOCK_MARKER_SRC})`, capture: BLOCK_MARKER_CAPTURE.source + '|^' + BLOCK_OUTER_BRACKET_ALT_CAPTURE },
  36: { src: `(?:${BLOCK_MARKER_SRC}|${BLOCK_CLOSEPAREN_ALT_SRC})`, capture: BLOCK_MARKER_CAPTURE.source + '|^' + BLOCK_CLOSEPAREN_ALT_CAPTURE },
  42: { src: `${BLOCK_NUM_SRC}\\s*ـ`, capture: `^\\(?\\s*(${BLOCK_NUM_SRC})\\s*\\)?\\s*ـ?` },
  60: { src: `${BLOCK_NUM_SRC}\\s*ـ`, capture: `^\\(?\\s*(${BLOCK_NUM_SRC})\\s*\\)?\\s*ـ?` },
  84: { src: `\\(\\s*${BLOCK_NUM_SRC}\\s*\\)`, capture: `^\\(?\\s*(${BLOCK_NUM_SRC})\\s*\\)?\\s*ـ?` },
  85: { src: `\\(\\s*${BLOCK_NUM_SRC}\\s*\\)`, capture: `^\\(?\\s*(${BLOCK_NUM_SRC})\\s*\\)?\\s*ـ?` },
  86: { src: DASH_LINESTART_SRC, capture: DASH_LINESTART_CAPTURE, htmlSrc: DASH_LINESTART_HTML_SRC },
  87: { src: BLOCK_MARKER_WITH_BRACKET_SRC, capture: BLOCK_MARKER_WITH_BRACKET_CAPTURE },
  88: { src: DASH_LINESTART_SRC, capture: DASH_LINESTART_CAPTURE, htmlSrc: DASH_LINESTART_HTML_SRC },
  17: NO_PAREN_BARE_OVERRIDE,
  26: NO_PAREN_BARE_OVERRIDE,
  28: NO_PAREN_BARE_OVERRIDE,
  29: NO_PAREN_BARE_OVERRIDE,
  30: NO_PAREN_BARE_OVERRIDE,
  35: NO_PAREN_BARE_OVERRIDE,
  40: NO_PAREN_BARE_OVERRIDE,
  43: NO_PAREN_BARE_OVERRIDE,
  47: NO_PAREN_BARE_OVERRIDE,
  82: NO_PAREN_BARE_OVERRIDE,
  102: NO_PAREN_BARE_OVERRIDE,
  106: NO_PAREN_BARE_OVERRIDE,
};

function toHtmlSafePattern(srcString) {
  return srcString.split('\\s').join('(?:\\s|<br>)');
}

function getMarkerPatterns(bookId) {
  const override = BOOK_MARKER_OVERRIDES[bookId];
  if (!override) {
    return { src: BLOCK_MARKER_SRC, test: BLOCK_MARKER_TEST, capture: BLOCK_MARKER_CAPTURE, htmlSrc: toHtmlSafePattern(BLOCK_MARKER_SRC) };
  }
  return {
    src: override.src,
    test: new RegExp(override.src),
    capture: new RegExp(override.capture),
    htmlSrc: toHtmlSafePattern(override.htmlSrc || override.src),
  };
}


const URWA_JURIST_MAP = {"المرعشی": "المرعشي", "المرعشي": "المرعشي", "محمّد رضا الگلپایگانی": "محمّد رضا الگلپايگاني", "محمّدرضا الگلپایگانی": "محمّد رضا الگلپايگاني", "محمّد رضاالگلپایگانی": "محمّد رضا الگلپايگاني", "محمّد رضا الگلپايگاني": "محمّد رضا الگلپايگاني", "محمد رضا الگلپایگانی": "محمّد رضا الگلپايگاني", "محمدرضا الگلپایگانی": "محمّد رضا الگلپايگاني", "محمد رضا ⇦ ⇨ الگلپایگانی": "محمّد رضا الگلپايگاني", "محمد رضاالگلپایگانی": "محمّد رضا الگلپايگاني", "محمّدرضاالگلپایگانی": "محمّد رضا الگلپايگاني", "محمدرضاالگلپایگانی": "محمّد رضا الگلپايگاني", "الفیروزآبادی": "الفيروزآبادي", "الفيروزآبادي": "الفيروزآبادي", "الفیروزآبادیّ": "الفيروزآبادي", "الفیروز آبادی": "الفيروزآبادي", "الفیروز أبادی": "الفيروزآبادي", "حسین القمّی": "حسين القمّي", "حسین القمیّ": "حسين القمّي", "حسین القمی": "حسين القمّي", "حسين القمّي": "حسين القمّي", "حسین القّمی": "حسين القمّي", "الرفیعی": "الرفيعي", "الرفيعي": "الرفيعي", "الرّفیعی": "الرفيعي", "الرَّفیعی": "الرفيعي", "الخمینی": "الخميني", "الخميني": "الخميني", "عبدالهادی الشیرازی": "عبدالهادي الشيرازي", "عبد الهادی الشیرازی": "عبدالهادي الشيرازي", "عبد الهادي الشيرازي": "عبدالهادي الشيرازي", "عبدالهادیالشیرازی": "عبدالهادي الشيرازي", "الحکیم": "الحكيم", "الحكيم": "الحكيم", "المیلانی": "الميلاني", "الميلاني": "الميلاني", "الآملی": "الآملي", "الآملي": "الآملي", "الأملی": "الآملي", "السبزواری": "السبزواري", "السبزواري": "السبزواري", "محمّد الشیرازی": "محمّد الشيرازي", "محمد الشیرازی": "محمّد الشيرازي", "محمّد الشيرازي": "محمّد الشيرازي", "محمدالشیرازی": "محمّد الشيرازي", "محمّدالشیرازی": "محمّد الشيرازي", "مفتی الشیعة": "مفتي الشيعة", "مفتي الشيعة": "مفتي الشيعة", "مفتیالشیعة": "مفتي الشيعة", "مفتی ⇦ ⇨ الشیعة": "مفتي الشيعة", "السیستانی": "السيستاني", "السيستاني": "السيستاني", "اللنکرانی": "اللنكراني", "اللنكراني": "اللنكراني", "کاشف الغطاء": "كاشف الغطاء", "كاشف الغطاء": "كاشف الغطاء", "الشاهرودی": "الشاهرودي", "الشاهرودي": "الشاهرودي", "مهدی الشیرازی": "مهدي الشيرازي", "مهدي الشيرازي": "مهدي الشيرازي", "مهدی ⇦ ⇨ الشیرازی": "مهدي الشيرازي", "مهدیالشیرازی": "مهدي الشيرازي", "الکوه کَمَرَئی": "الكوه كَمَري", "الکوه کَمَرئی": "الكوه كَمَري", "الکوه کمَرَئی": "الكوه كَمَري", "الکوه کَمرَئی": "الكوه كَمَري", "الکوه کمرئی": "الكوه كَمَري", "الكوه كمرئي": "الكوه كَمَري", "الکوه ⇦ ⇨ کَمَرَئی": "الكوه كَمَري", "صدر الدین الصدر": "صدر الدين الصدر", "صدرالدین الصدر": "صدر الدين الصدر", "صدر الدين الصدر": "صدر الدين الصدر", "صدر الدینالصدر": "صدر الدين الصدر", "صدرالدینالصدر": "صدر الدين الصدر", "الإصطهباناتی": "الإصطهباناتي", "الاصطهباناتی": "الإصطهباناتي", "الإصطهباناتي": "الإصطهباناتي", "الأصطهباناتی": "الإصطهباناتي", "النائینی": "النائيني", "النائيني": "النائيني", "جمال الدین الگلپایگانی": "جمال الدين الگلپايگاني", "جمال الدين الگلپايگاني": "جمال الدين الگلپايگاني", "⇦ ⇨ جمال الدین الگلپایگانی": "جمال الدين الگلپايگاني", "جمال الدینالگلپایگانی": "جمال الدين الگلپايگاني", "جمال الدین ⇦ ⇨ الگلپایگانی": "جمال الدين الگلپايگاني", "عبداللّه الشیرازی": "عبداللّه الشيرازي", "عبد اللّه الشیرازی": "عبداللّه الشيرازي", "عبد اللّه الشيرازي": "عبداللّه الشيرازي", "عبدالله الشیرازی": "عبداللّه الشيرازي", "عبداللّه ⇦ ⇨ الشیرازی": "عبداللّه الشيرازي", "عبداللهالشیرازی": "عبداللّه الشيرازي", "آقا ضیاء": "آقا ضياء", "آقاضیاء": "آقا ضياء", "آقا ضياء": "آقا ضياء", "آقاضياء": "آقا ضياء", "الإصفهانی": "الإصفهاني", "الإصفهاني": "الإصفهاني", "الاصفهانی": "الإصفهاني", "الأصفهانی": "الإصفهاني", "آل یاسین": "آل ياسين", "آل ياسين": "آل ياسين", "البروجردی": "البروجردي", "البروجردي": "البروجردي", "البجنوردی": "البجنوردي", "البجنوردي": "البجنوردي", "أحمد الخونساری": "أحمد الخونساري", "أحمدالخونساری": "أحمد الخونساري", "أحمد الخونساري": "أحمد الخونساري", "احمد الخونساری": "أحمد الخونساري", "أحمد الخوانساری": "أحمد الخونساري", "الشریعتمداری": "الشريعتمداري", "الشريعتمداري": "الشريعتمداري", "الفانی": "الفاني", "الفاني": "الفاني", "الخوئی": "الخوئي", "الخوئي": "الخوئي", "حسن القمّی": "حسن القمّي", "حسن → القمّی": "حسن القمّي", "حسن القمّي": "حسن القمّي", "حسن القمی": "حسن القمّي", "حسن القمیّ": "حسن القمّي", "حسن القُمّی": "حسن القمّي", "حسنالقمّی": "حسن القمّي", "حسن القّمی": "حسن القمّي", "تقی القمّی": "تقي القمّي", "تقی القمیّ": "تقي القمّي", "تقی القمی": "تقي القمّي", "تقیّ القمّی": "تقي القمّي", "تقي القمّي": "تقي القمّي", "تقیالقمّی": "تقي القمّي", "تقی ا لقمّی": "تقي القمّي", "الروحانی": "الروحاني", "الروحاني": "الروحاني", "الجواهری": "الجواهري", "الجواهري": "الجواهري", "الحائری": "الحائري", "الحائري": "الحائري", "محمّد تقی الخونساری": "محمّد تقي الخونساري", "محمد تقی الخونساری": "محمّد تقي الخونساري", "محمّد تقي الخونساري": "محمّد تقي الخونساري", "محمدتقی الخونساری": "محمّد تقي الخونساري", "محمّدتقی الخونساری": "محمّد تقي الخونساري", "محمد تقیالخونساری": "محمّد تقي الخونساري", "محمدتقیّ الخونساری": "محمّد تقي الخونساري", "محمدتقیالخونساری": "محمّد تقي الخونساري", "محمّد تقیالخونساری": "محمّد تقي الخونساري", "محمّد تقی ⇦ ⇨ الخونساری": "محمّد تقي الخونساري", "محمد تقی الخوانساری": "محمّد تقي الخونساري", "محمّد تقی الخوانساری": "محمّد تقي الخونساري", "الأراکی": "الأراكي", "الأراكي": "الأراكي", "الآراکی": "الأراكي", "زین الدین": "زين الدين", "زين الدين": "زين الدين", "زین الدّین": "زين الدين", "الکوه کَمَرِی": "الكوه كَمَري", "الکوه کمری": "الكوه كَمَري", "الکوه کَمَری": "الكوه كَمَري", "الکُوه کَمَرِی": "الكوه كَمَري", "الکوه کَمَرَی": "الكوه كَمَري", "الکُوه کَمَری": "الكوه كَمَري", "الکوه کَمری": "الكوه كَمَري", "اللکنرانی": "اللنكراني", "اللكنراني": "اللنكراني",
  "محمد رضا گلپایگانی": "محمّد رضا الگلپايگاني",
  "عبدالهادی الشیرای": "عبدالهادي الشيرازي",
  "االآملی": "الآملي",
  "میلانی": "الميلاني",
  "عبداللّه شیرازی": "عبداللّه الشيرازي",
  "جمال الدین گلپایگانی": "جمال الدين الگلپايگاني",
  "جمال الدین الگلبایگانی": "جمال الدين الگلپايگاني",
  "الإصطهبانابی": "الإصطهباناتي",
  "الاصطبهاناتی": "الإصطهباناتي",
  "مرعشی": "المرعشي",
  "البجنوری": "البجنوردي",
  "روحانی": "الروحاني",
  "السبزورای": "السبزواري",
  "الرعشی": "المرعشي",
  "لنائینی": "النائيني",
  "البجنرودی": "البجنوردي",
  "البجنودری": "البجنوردي",
  "محدرضا الگلپایگانی": "محمّد رضا الگلپايگاني",
  "جمال الحین الگلپایگانی": "جمال الدين الگلپايگاني",
  "جمال الدین الگپایگانی": "جمال الدين الگلپايگاني",
  "الشریعمتداری": "الشريعتمداري",
  "أحمد الخوساری": "أحمد الخونساري",
  "الإمام الخمینی": "الخميني",
  "محمّد رضا الگلپگایگانی": "محمّد رضا الگلپايگاني",
  "محمّد رضا الکلپایگانی": "محمّد رضا الگلپايگاني",
  "جمال الدی الگلپایگانی": "جمال الدين الگلپايگاني",
  "البرجرودی": "البروجردي",
  "محمّد رضاالکلپایکانی": "محمّد رضا الگلپايگاني",
  "شاهرودی": "الشاهرودي",
  "شریعتمداری": "الشريعتمداري",
  "الکوه الکمرئی": "الكوه كَمَري",
  "محمّد رضا الگپایگانی": "محمّد رضا الگلپايگاني",
  "تقی الخونساری": "محمّد تقي الخونساري",
  "الخوانساری": "أحمد الخونساري",
  "محمد رضا الگپایگانی": "محمّد رضا الگلپايگاني",
  "صدرالدین لصدر": "صدر الدين الصدر",
  "صدر الدین صدر": "صدر الدين الصدر",
  "صدرالدین صدر": "صدر الدين الصدر",
  "مهدی الشیرزای": "مهدي الشيرازي",
  "جمال الدین الگلپاگانی": "جمال الدين الگلپايگاني",
  "الکوکَمَرَئی": "الكوه كَمَري",
  "جمال الدین الگلپایگیانی": "جمال الدين الگلپايگاني",
  "مفتی الشعیة": "مفتي الشيعة",
  "جمال الدین¨ الگلپایگانی": "جمال الدين الگلپايگاني",
};

const URWA_REAL_JURISTS = ["آقا ضياء", "آل ياسين", "أحمد الخونساري", "الآملي", "الأراكي", "الإصطهباناتي", "الإصفهاني", "البجنوردي", "البروجردي", "الجواهري", "الحائري", "الحكيم", "الخميني", "الخوئي", "الرفيعي", "الروحاني", "السبزواري", "السيستاني", "الشاهرودي", "الشريعتمداري", "الفاني", "الفيروزآبادي", "الكوه كَمَري", "اللنكراني", "المرعشي", "الميلاني", "النائيني", "تقي القمّي", "جمال الدين الگلپايگاني", "حسن القمّي", "حسين القمّي", "زين الدين", "صدر الدين الصدر", "عبداللّه الشيرازي", "عبدالهادي الشيرازي", "كاشف الغطاء", "محمّد الشيرازي", "محمّد تقي الخونساري", "محمّد رضا الگلپايگاني", "مفتي الشيعة", "مهدي الشيرازي"];
URWA_REAL_JURISTS.forEach(n => { URWA_JURIST_MAP[n] = n; });


const URWA_AUTHOR_ID = 25;
const JURIST_SETTINGS_KEY = 'urwa_jurist_settings_v1';

function getJuristSettings() {
  try {
    const raw = localStorage.getItem(JURIST_SETTINGS_KEY);
    const s = raw ? JSON.parse(raw) : {};
    return { order: s.order || [], hidden: s.hidden || {}, favorite: s.favorite || {}, lead: s.lead === 's' ? 's' : 'o' };
  } catch (e) { return { order: [], hidden: {}, favorite: {}, lead: 'o' }; }
}
function saveJuristSettings(s) {
  try { localStorage.setItem(JURIST_SETTINGS_KEY, JSON.stringify(s)); } catch (e) {}
}


function urwaSecTitle(book, idx, fallback) {
  try {
    const toc = (typeof URWA_ORIG_TOC !== 'undefined' && book && isUrwaBook(book.id)) ? URWA_ORIG_TOC[book.bk_table] : null;
    if (!toc) return fallback;
    let best = null;
    for (const e of toc) { if (e[2] - 1 <= idx) best = e; else break; }
    return best ? best[0] : fallback;
  } catch (e) { return fallback; }
}
const URWA_BOOK_TABLES = new Set(['bk68','bk69','bk70','bk71','bk72','bk73','bk74','bk75','bk76','bk77','bk78','bk79','bk80','bk81','bk90']);
function isUrwaBook(bookId) {
  const book = allBooks.find(b => b.id === bookId);
  return !!book && book.author_id === URWA_AUTHOR_ID && URWA_BOOK_TABLES.has(book.bk_table);
}

const URWA_BOOK_MAP = {
  bk68: [{r:1,n:"مقدمة"}, {r:4,n:"كتاب الاجتهاد والتقليد"}, {r:77,n:"كتاب الطهارة"}],
  bk69: [{r:1,n:"كتاب الطهارة"}],
  bk70: [{r:1,n:"كتاب الطهارة"}],
  bk71: [{r:1,n:"كتاب الطهارة"}],
  bk72: [{r:1,n:"كتاب الطهارة"}],
  bk73: [{r:1,n:"كتاب الصلاة"}],
  bk74: [{r:1,n:"كتاب الصلاة"}],
  bk75: [{r:1,n:"كتاب الصلاة"}],
  bk76: [{r:1,n:"كتاب الصلاة"}],
  bk77: [{r:1,n:"كتاب الصوم"}],
  bk78: [{r:1,n:"كتاب الزكاة"}],
  bk79: [{r:1,n:"كتاب الخمس"}, {r:105,n:"كتاب الحج"}],
  bk80: [{r:1,n:"كتاب الحج"}],
  bk81: [{r:1,n:"كتاب الإجارة"}, {r:42,n:"كتاب المضاربة"}, {r:116,n:"كتاب المزارعة"}, {r:144,n:"كتاب المساقاة"}],
  bk90: [{r:1,n:"كتاب الضمان"}, {r:57,n:"كتاب الحوالة"}, {r:74,n:"كتاب النكاح"}, {r:331,n:"كتاب الوصية"}],
};
const URWA_FASL_EVENTS = {
  bk68: [{r:1,n:"سیرته الشخصیة (ره)"}, {r:2,n:"مواقفه فی مواجهة أعداء الاسلام"}, {r:3,n:"أصحاب التعلیقات"}, {r:4,n:"یجب التقلید أو الاحتیاط علی غیر المجتهد"}, {r:6,n:"جواز العمل بالاحتیاط"}, {r:7,n:"الاحتیاط فی الفعل أو فی الترک"}, {r:8,n:"جواز الاحتیاط ولو استلزم التکرار"}, {r:10,n:"لا حاجة إلی التقلید فی الضروریات و الیقینیات"}, {r:11,n:"عمل العامّی بلا تقلید و لا احتیاط باطل"}, {r:12,n:"تعریف التقلید"}, {r:13,n:"حکم البقاء علی تقلید المیّت"}, {r:16,n:"وجوب تقلید الأعلم مع الإمکان"}, {r:20,n:"عمل الجاهل المقصّر الملتفت باطل"}, {r:21,n:"تعریف الأعلم"}, {r:23,n:"ما یعرف به اجتهاد المجتهد"}, {r:26,n:"یشترط فی المجتهد أُمور"}, {r:27,n:"تعریف العدالة"}, {r:31,n:"وجوب العلم بأجزاء العبادات و شرائطها و موانعها و مقدّماتها"}, {r:32,n:"وجوب تعلّم مسائل الشکّ و السهو"}, {r:33,n:"وجوب التقلید فی المستحبّات"}, {r:35,n:"إذا تبدّل رأی المجتهد"}, {r:37,n:"یجوز التبعیض فی المسائل"}, {r:40,n:"ما یُعلم به فتوی المجتهد"}, {r:41,n:"من قلّد غیر الأعلم أو من لیس أهلاً للفتوی"}, {r:43,n:"إذا شکّ فی موت المجتهد أو فی تبدّل رأیه"}, {r:44,n:"إذا عمل بلا تقلید مدّة من الزمن"}, {r:46,n:"إذا قلّد مجتهداً ثمّ شکّ فی أنّه جامع للشرائط أم لا"}, {r:47,n:"یحرم الافتاء و القضاء علی من لیس أهلاً لهما"}, {r:48,n:"تثبت عدالة المفتی و القاضی بأُمور"}, {r:54,n:"وجوب العمل بالاحتیاط فی زمان الفحص عن المجتهد"}, {r:55,n:"المأذون و الوکیل عن المجتهد ینعزل بموت المجتهد"}, {r:56,n:"فی من بقی علی تقلید المیت، دون أن یقلّد الحی"}, {r:57,n:"فی من قلّد من یفتی بخلاف مجتهد الأوّل"}, {r:58,n:"الوکیل و الوصی یعملان بمقتضی تقلید الموکِّل و الموصی"}, {r:59,n:"اختلاف المتعاملین فی التقلید"}, {r:60,n:"فی المرافعات اختیار الحکم بید المدّعی"}, {r:61,n:"لا یجوز نقض حکم الحاکم الجامع للشرائط"}, {r:62,n:"فی من نقل فتوی المجتهد، ثم تبدّل رأیه، أو نقلها خطأً"}, {r:63,n:"إذا تعارض الناقلان فی نقل الفتوی"}, {r:64,n:"إذا عرضت مسألة لا یعلم حکمها و لم یکن الأعلم حاضراً"}, {r:65,n:"فی من عدل إلی الحی بعد موت مُقَلدَیه الأوّل و الثانی"}, {r:66,n:"ما یکفی فی تحقّق التقلید"}, {r:67,n:"احتیاطات الأعلم"}, {r:68,n:"فی أقسام الاحتیاط"}, {r:69,n:"التخییر فی صورة تساوی المجتهدین"}, {r:70,n:"فی تشخیص موارد الاحتیاط"}, {r:71,n:"محلّ التقلید و مورده"}, {r:72,n:"لا تعتبر الأعلمیّة فی اُمور"}, {r:73,n:"إذا تبدّل رأی المجتهد هل یجب علیه إعلام المقلدین؟"}, {r:74,n:"لا یجوز للمقلِّد إجراء أصالة البراءة أو الطهارة أو الاستصحاب فی الشبهات الحکمیّة"}, {r:75,n:"لا یجوز تقلید المجتهد غیر العادل أو مجهول الحال"}, {r:76,n:"الظن بفتوی المجتهد لا یکفی فی جواز العمل ◂ فصل فی المیاه ◂ أحکام الماء المطلق و المضاف"}, {r:77,n:"المیاه"}, {r:85,n:"أحکام تغیّر الماء"}, {r:95,n:"فصل فی الماء الجاری"}, {r:103,n:"فصل فی الماء الراکد: الکرّ و القلیل ◂ تحدید مقدار الکرّ وزناً و مساحة"}, {r:105,n:"أحکام الماء الکرّ"}, {r:116,n:"فصل فی ماء المطر"}, {r:127,n:"فصل فی ماء الحمّام"}, {r:128,n:"فصل فی ماء البئر"}, {r:137,n:"فصل فی الماء المستعمل فی رفع الحدث الأکبر و الأصغر"}, {r:152,n:"فهرس المحتویات"}],
  bk69: [{r:1,n:"الماء المشکوک النجاسة ◂ الشکّ فی إطلاق الماء ◂ الشکّ فی إباحة الماء"}, {r:2,n:"العلم الإجمالی بالنجاسة"}, {r:4,n:"العلم الإجمالی بالنجاسة والإضافة"}, {r:5,n:"العلم الإجمالی بالنجاسة أو الغصبیة"}, {r:7,n:"التوضؤ بالمشتبه بالمضاف ◂ ملاقی الشبهة المحصورة"}, {r:8,n:"انحصار الماء فی المشتبهین"}, {r:10,n:"الحکم فی الماءین المشتبهین إذا توضأ أو اغتسل بأحدهما ثم بالآخر"}, {r:11,n:"العلم الإجمالی بالنجاسة بعد العمل"}, {r:13,n:"إستعمال أحد المشتبهین بالغصبیّة"}, {r:14,n:"سؤر نجس العین ◂ طهارة السؤر"}, {r:15,n:"الأول والثانی: بول وغائط مالا یؤکل لحمه ◂ بول وغائط ما یؤکل لحمه ◂ فضلة مالا نفس له ◂ ملاقاة النجاسة فی الباطن ◂ بیع البول والغائط ◂ الانتفاع بالبول والغائط"}, {r:16,n:"البول والغائط من الحیوان المشکوک"}, {r:17,n:"الثالث: المنی ◂ الرابع: المیتة ◂ الأجزاء المبانة من الحی"}, {r:19,n:"فأرة المسک"}, {r:22,n:"المراد من المیتة ◂ أمارات التذکیة"}, {r:23,n:"ما یؤخذ من ید الکافر أو أرضهم"}, {r:26,n:"نجاسة السقط"}, {r:28,n:"نجاسة المیّت قبل البرد"}, {r:29,n:"نجاسة المضغة والمشیمة"}, {r:31,n:"العضو المقطوع المعلّق بالبدن"}, {r:32,n:"حکم الجند"}, {r:36,n:"بیع المیتة ◂ الانتفاع بالمیتة ◂ الخامس: الدم"}, {r:50,n:"السادس والسابع: الکلب والخنزیر ◂ الثامن: الکفر ◂ المراد بالکافر ◂ ولد الکافر"}, {r:54,n:"التاسع: الخمر"}, {r:57,n:"العاشر: الفقّاع"}, {r:58,n:"الحادی عشر: عرق الجنب من حرام"}, {r:62,n:"الثانی عشر: عرق الابل الجلاّلة"}, {r:68,n:"ثبوت النجاسة بالعلم الوجدانی وبالبیّنة العادلة ◂ ثبوت النجاسة بقول ذی الید ◂ عدم ثبوت النجاسة بمطلق الظن ◂ عدم الاعتبار بعلم الوسواسی"}, {r:69,n:"ثبوت النجاسة بالعلم الإجمالی"}, {r:70,n:"فیما لا یعتبر بالبیّنة"}, {r:71,n:"فروع فی الشهادة بالنجاسة"}, {r:77,n:"قبول خبر صاحب الید بالنجاسة"}, {r:79,n:"لا یعتبر العدالة فی حجیة خبر صاحب الید مع الکلام فی اعتبار الإسلام والبلوغ"}, {r:81,n:"حکم ما إذا أخبر صاحب الید بعد الاستعمال"}, {r:82,n:"شروط التنجّس"}, {r:92,n:"منجّسیّة المتنجّس"}, {r:93,n:"فروع فی کیفیة التنجیس"}, {r:95,n:"اشتراط الطهارة فی الصلاة"}, {r:96,n:"وجوب إزالة النجاسة عن المساجد"}, {r:97,n:"فروع فی لزوم تطهیر المسجد"}, {r:114,n:"فی أن المشاهد کالمساجد"}, {r:115,n:"أحکام فی حرمة تنجیس المصحف"}, {r:124,n:"فی إزالة النجاسة عن الطعام وظروفه"}, {r:125,n:"فی حرمة الانتفاع بالنجس"}, {r:126,n:"فی حرمة التسبیب إلی أکل النجس"}, {r:127,n:"فی حرمة سقی المسکرات للأطفال"}, {r:128,n:"بعض فروع الإعلام بالنجاسة"}, {r:130,n:"الصلاة فی النجس جهلاً ◂ الالتفات إلی النجاسة فی الصلاة ◂ الصّلاة فی النجس ناسیاً"}, {r:133,n:"انحصار ثوب المصلّی فی النجس"}, {r:140,n:"الصّلاة فی النجس اضطراراً"}, {r:143,n:"الأوّل: دم الجروح والقروح"}, {r:149,n:"الثانی: الدم الأقل من الدرهم"}, {r:157,n:"الثالث: مالا تتم الصّلاة فیه ◂ الرابع: المحمول المتنجِّس"}, {r:158,n:"الخامس: ثوب المربیّة"}, {r:160,n:"السادس: العفو عن النجاسة حال الإضطرار"}, {r:161,n:"الأوّل: الماء ◂ شروط مطهّریة الماء"}, {r:163,n:"حکم استعمال الغسالة فی التطهیر"}, {r:164,n:"ما یعتبر فیه تعدّد الغسل"}, {r:165,n:"ما یعتبر فیه الغسل مرّة ◂ کیفیة تطهیر الأوانی"}, {r:175,n:"فروع التطهیر بالماء"}, {r:201,n:"الثانی:الأرض ◂ کیفیة التطهیر بالأرض ◂ تحدید الأرض المطهّرة ◂ اعتبار طهارة الأرض فی التطهیر بها ◂ تحدید ما یطهر بالأرض"}, {r:203,n:"فروع فی مطهریة الأرض"}, {r:208,n:"الثالث: الشمس ◂ ما یطهر بالشمس"}, {r:209,n:"مطهّریة الشمس للحصر والبواری من المنقول ◂ ما یعتبر فی مطهّریة الشمس ◂ فروع فی مطهّریة الشمس"}, {r:215,n:"الرابع: الاستحالة ◂ معنی الاستحالة ◂ مطهّریة الاستحالة للنجس والمتنجّس ◂ حکم تبدّل الأوصاف وتفرق الأجزاء ◂ بعض فروع الانقلاب ◂ حکم الشک فی الاستحالة ◂ الخامس: الانقلاب ◂ ما یشترط فی مطهریة الانقلاب"}, {r:222,n:"الاستهلاک والاستحالة"}, {r:223,n:"السادس: ذهاب الثلثین ◂ کیفیة تقدیر الثلث والثلثین"}, {r:224,n:"طرق ثبوت ذهاب الثلثین ◂ فروع فی مطهّریة ذهاب الثلثین"}, {r:233,n:"السابع: الانتقال ◂ انتقال دم الانسال إلی جوف البق"}, {r:234,n:"حکم دم البق الخارج بعد قتله ◂ الثامن: الإسلام ◂ فیما یطهر بالإسلام من الکافر"}, {r:236,n:"فیما یتحقق به الإسلام"}, {r:238,n:"التاسع: التبعیّة ◂ العاشر: زوال العین"}, {r:240,n:"الحادی عشر: استبراء الحیوان الجلاّل ◂ معنی الجلل ◂ ما یحصل به الاستبراء عن الجلل ◂ مدّة الاستبراء فی الحیوانات ◂ الثانی عشر: حجر الاستنجاء ◂ الثالث عشر: خروج الدم من الذبیحة ◂ الرابع عشر: نزح البئر ◂ الخامس عشر: تیمّم المیّت"}],
  bk70: [{r:2,n:"حکم استعمال الظروف المتّخذة من جلد المیتة أو نجس العین ◂ حکم استعمال الظروف المغصوبة فی الوضوء"}, {r:3,n:"ما یشترط للحکم بطهارة أوانی الکفار"}, {r:4,n:"حکم استعمال أوانی الخمر والمتّخذة من الخشب ونحوه"}, {r:5,n:"حکم استعمال أوانی الذهب والفضة"}, {r:6,n:"حکم الإناء الملبّس بالذهب والفضة والمفضّض والمطلی"}, {r:8,n:"حکم الممتزج بالذهب أو الفضة"}, {r:9,n:"الممتزج من الذهب والفضة"}, {r:10,n:"حکم غیر الأوانی من الذهب والفضة"}, {r:11,n:"المراد من الإناء"}, {r:12,n:"عدم الفرق فی حرمة الأکل بین مباشرته بالفم أو أخذ اللقمة منه ◂ عدم سرایة حرمة الأکل والشرب إلی المأکول والمشروب"}, {r:15,n:"حکم انحصار ماء الوضوء أو الغسل فی إحدی الآنیتین"}, {r:17,n:"حکم التوضّؤ أو الاغتسال من إناء الذهب أو الفضة جهلاً بالحکم أو الموضوع"}, {r:19,n:"الاضطرار إلی استعمال أوانی الذهب أو الفضة"}, {r:21,n:"دوران الأمر بین استعمال أوانی الذهب أو الفضة أو الآنیة المغصوبة"}, {r:23,n:"هل یجب کسر إناء الذهب أو الفضة؟"}, {r:24,n:"إذا شکّ فی شیءٍ کونه إناءً أو أنّه من الذهب أو الفضة أم لا"}, {r:25,n:"وجوب ستر العورة عن الناظر المحترم ◂ تحدید العورة ومقدار الستر الواجب"}, {r:26,n:"حرمة النظر إلی عورة الکافر"}, {r:27,n:"المراد من الناظر المحترم"}, {r:29,n:"ما یستحبّ ستره"}, {r:30,n:"فروع فی ستر العورة"}, {r:31,n:"حکم النظر من وراء الزجاجة ونحوها"}, {r:34,n:"لو شکّ فی الناظر أو المنظور إلیه"}, {r:36,n:"حکم النظر إلی عورة الخنثی"}, {r:37,n:"لو اضطرّ إلی النظر إلی عورة الغیر"}, {r:38,n:"حرمة استقبال المتخلّی للقبلة وکذا استدباره لها ◂ حکم الاستقبال والاستدبار حال الاستبراء والاستنجاء"}, {r:39,n:"لو اشتبهت القبلة ◂ حکم إقعاد الطفل للتخلّی مستقبلاً أو مستدبراً"}, {r:40,n:"عدم وجوب التشریق أو التغریب حال التخلّی"}, {r:41,n:"حکم من یتواتر بوله أو غائطه"}, {r:42,n:"حکم الدوران بالبول عند اشتباه القبلة"}, {r:44,n:"التخلّی فی ملک الغیر"}, {r:45,n:"المراد بمقادیم البدن"}, {r:46,n:"حرمة التخلّی فی مثل المدارس التی لا یعلم کیفیة وقفها"}, {r:47,n:"لزوم غسل موضع البول بالماء ◂ کیفیة الاستنجاء ◂ ما یعتبر فیما یمسح به ◂ حرمة الاستنجاء بالمحترمات"}, {r:48,n:"لابد من إزالة الرطوبة فی المسح"}, {r:51,n:"فروع الشک فی الاستنجاء"}, {r:52,n:"عدم وجوب الدلک فی الاستنجاء من البول"}, {r:54,n:"جواز الاستنجاء بالمشکوک کونه عظماً أو روثاً أو من المحترمات"}, {r:55,n:"کیفیة الاستبراء ◂ طهارة الرطوبة المشتبهة بعد الاستبراء ◂ اختصاص الاستبراء بالرجال ◂ استبراء مقطوع الذکر"}, {r:56,n:"نجاسة الرطوبة المشتبهة مع ترک الاستبراء ولو اضطراراً"}, {r:57,n:"عدم لزوم المباشرة فی الاستبراء"}, {r:58,n:"الشک فی الاستبراء"}, {r:63,n:"مستحبات التخلی ◂ مکروهات التخلی ◂ أحکام حبس البول أو الغائط"}, {r:64,n:"موارد استحباب البول"}, {r:65,n:"ما یستحب لمن وجد لقمة خبز فی بیت الخلاء"}, {r:66,n:"الأوّل والثانی: البول والغائط ◂ الثالث: الریح الخارج من مخرج الغائط من المعدة دون غیره ◂ الرابع: النوم مطلقا ◂ الخامس: کلّ ما أزال العقل ◂ السادس: الاستحاضة بأقسامها"}, {r:67,n:"إذا شک فی وجود الناقض أو ناقضیّة الموجود"}, {r:69,n:"المذی والوذی والودی لا تنقض الوضوء ◂ اُمور یستحب الوضوء بعدها"}, {r:70,n:"أقسام ما هو مشروط بالوضوء ◂ غایات الوضوء الواجب ◂ الوضوء لقضاء الأجزاء المنسیّة وسجدتی السهو ◂ الوضوء لمسّ المصحف"}, {r:71,n:"أقسام وجوب الوضوء بسبب النذر"}, {r:72,n:"فروع مسّ المحدث للمصحف"}, {r:87,n:"یجوز مسّ ترجمة القرآن بخلاف اسم اللّه تعالی ◂ وضع النجس أو المتنجّس علی المصحف"}, {r:88,n:"أکل المحدث و المتطهّر للّقمة التی کتب علیها القرآن"}, {r:89,n:"صحة الوضوء فی نفسه وإن لم یقصد به غایة علی کلام"}, {r:90,n:"أقسام الوضوء المستحب ◂ الأول: استحبابه للصلاة والطواف و التهیّؤ للصلاة ◂ بقیة ما یستحب لأجله الوضوء ◂ الثانی: استحباب الوضوء التجدیدی ◂ الثالث: استحبابه للحائض وللجنب ولتغسیل المیّت وغیرها"}, {r:91,n:"إباحة جمیع الغایات بالوضوء"}, {r:92,n:"الوضوء التجدیدی وانکشاف الحدث ◂ عدم اعتبار قصد موجب الوضوء"}, {r:93,n:"کفایة الوضوء الواحد للأحداث المتعدّدة"}, {r:94,n:"الوضوء للغایات المتعدّدة"}, {r:95,n:"الأوّل: أن یکون بمدّ ◂ الثانی: الاستیاک ◂ الثالث: وضع الإناء علی الیمین ◂ الرابع: غسل الیدین ◂ الخامس: المضمضة والاستنشاق ◂ السادس: التسمیة ◂ السابع: الاغتراف بالیمین ◂ الثامن: قراءة الأدعیة المأثورة ◂ التاسع: تثنیة الغسلات ◂ العاشر: أن یبدأ الرجل بالظاهر والمرأة بالباطن من الذراعین ◂ الحادی عشر: صبّ الماء علی أعلی کل عضو ◂ الثانی عشر: غسل الأعضاء صبّاً لا رَمساً ◂ الثالث عشر: الغسل بإمرار الید لا بمجرّد صبّ الماء ◂ الرابع عشر: حضور القلب فی جمیع الأفعال ◂ الخامش عشر: قراءة سورة القدر حال الوضوء ◂ السادس عشر: قراءة آیة الکرسی ◂ السابع عشر: فتح العینین حال غسل الوجه"}, {r:96,n:"الأوّل: الاستعانة بالغیر فی المقدّمات القریبة ◂ الثانی: التمندل علی کلام ◂ الثالث: الوضوء فی مکان الاستنجاء ◂ الرابع: الوضوء من الآنیة المفضّضة أو المذهبة أو المنقوشة بالصور ◂ الخامس: الوضوء بالمیاه المکروهة"}, {r:97,n:"الأوّل: غسل الوجه ◂ وظیفة الأنزع والأغمّ ونحوهما ◂ وجوب الابتداء بالأعلی فی غسل الوجه ◂ وجوب غسل شیءٍ من الأطراف مقدمة، وعدم وجوب غسل البواطن"}, {r:98,n:"وجوب غسل الوجه والیدین بجمیع أجزائهما"}, {r:102,n:"إذا شک بوجود المانع أو علم بمشکوک المانعیّة"}, {r:104,n:"الثانی: غسل الیدین"}, {r:106,n:"حکم وسخ الأظفار"}, {r:107,n:"حم ما یقطع من لحم الیدین"}, {r:109,n:"حکم الشقوق علی ظاهر الکفّ"}, {r:110,n:"حکم ما یعلو البشرة مثل الجدری"}, {r:111,n:"حکم ما ینجمد علی الجرح عند برئه"}, {r:112,n:"لا یجب إزالة الوسخ الّذی لیس بحاجب"}, {r:113,n:"الکلام فی الوسواسی"}, {r:114,n:"لا یجب قلع الشوکة فی الید فی بعض الصور"}, {r:115,n:"الکلام فی الوضوء الارتماسی"}, {r:116,n:"الوضوء بماء المطر"}, {r:117,n:"الشک فی کون شیءٍ من الظاهر ◂ الثالث: مسح الرأس ببلّة الوضوء ومحلّ المسح من الرأس"}, {r:118,n:"کیفیة المسح وما یعتبر فیه ◂ التسویة بین أنحاء المسح ◂ الرابع: مسح الرجلین ◂ تحدید المسح والمراد من الکعبین وکیفیة المسح ◂ اعتبار تقدیم الرجل الیمنی علی الیسری"}, {r:119,n:"الحکم فی مقطوع بعض القدم ◂ اعتبار أن یکون المسح بنداوة الوضوء"}, {r:120,n:"لابدّ من تأثّر الممسوح ببلّة الماسح"}, {r:121,n:"تعذّر المسح بباطن الکفّ وظاهرها"}, {r:124,n:"لو تعذّر المسح ببلّة الوضوء"}, {r:126,n:"عدم لزوم المسح تدریجاً وجوازه دفعة"}, {r:127,n:"المسح علی الحائل لضرورة"}, {r:128,n:"ما یعتبر فی مشروعیة المسح علی الحائل"}, {r:130,n:"ترک التقیّة مع وجوبها"}, {r:131,n:"المبادرة إلی الوضوء الاختیاری لو تعذّر بالتأخیر"}, {r:132,n:"إذا اعتقد التقیّة ثم انکشف الخلاف"}, {r:134,n:"دوران الأمر بین الغسل والمسح تقیّة"}, {r:135,n:"حکم زوال السبب المسوّغ للتقیة"}, {r:136,n:"حکم العمل بخلاف مذهب من یتّقیه"}, {r:137,n:"جواز الصبّ متعدّداً فی کلّ غسلة"}, {r:138,n:"وجوب الابتداء فی الغسل من الأعلی"}, {r:139,n:"کراهة الإسراف واستحباب الإسباغ"}, {r:141,n:"وضوء الوسواسی"}, {r:142,n:"إذا بالغ غیر الوسواسی فی غسله"}, {r:143,n:"یکفی مسح الرجلین بأحد الأصابع"}, {r:144,n:"الأوّل: إطلاق الماء إلی نهایة الغسل ◂ الثانی: طهارة الماء وأعضاء الوضوء"}, {r:145,n:"التوضّؤ بماء القلیان"}, {r:146,n:"استحباب تقدیم الاستنجاء علی الوضوء ◂ کیفیة غسل موضع الجرح ◂ الثالث: عدم الحائل علی محلّ الوضوء ◂ الرابع: إباحة الماء وظرفه ومصبّه ومکان الوضوء"}, {r:147,n:"لا فرق فی بطلان الوضوء بفقد الشرائط المذکورة بین العمد وغیره"}, {r:148,n:"الالتفات إلی الغصبیّة أثناء الوضوء"}, {r:149,n:"لابدّ من إحراز رضا المالک فی جواز التصرّف"}, {r:150,n:"حکم الوضوء والشرب من الأنهار الکبار"}, {r:151,n:"الوضوء من حیاض المساجد والمدارس"}, {r:152,n:"إذا شُقّ نهر من آخر بغیر إذن المالک"}, {r:155,n:"لو کان بعض جهات الحوض مغصوباً"}, {r:156,n:"حکم الوضوء إذا کان المکان مباحاً والفضاء مغصوباً"}, {r:157,n:"استلزام الوضوء تحریک المغضوب"}, {r:158,n:"الوضوء تحت الخیمة المغصوبة"}, {r:159,n:"بعض فروع اعتبار الإباحة"}, {r:162,n:"الوضوء من ماءٍ وقع فیه القلیل من الماء المغصوب ◂ الخامس: عدم کون ظرف الوضوء من الذهب أو الفضّة"}, {r:163,n:"الوضوء من آنیة باعتقاد غصبیّتها ثمّ تبیّن الخلاف ◂ السادس: عدم کون الماء مستعملاً فی رفع الخبث ◂ السابع: عدم المانع من استعمال الماء ◂ الثامن: سعة الوقت للوضوء والصلاة"}, {r:164,n:"التاسع: المباشرة فی أفعال الوضوء"}, {r:166,n:"الاستنابة فی الوضوء ◂ العاشر: الترتیب فی أفعال الوضوء ◂ الحادی عشر: الموالاة فی الوضوء"}, {r:170,n:"الثانی عشر: النیّة فی الوضوء ◂ عدم لزوم التلفظ بالنیّة ولا إخطارها ◂ لزوم استمرار النیة فی تمام الأفعال ◂ لا یجب نیّة الوجوب ولا الاستحباب"}, {r:171,n:"عدم اعتبار قصد الاستباحة أو رفع الحدث ◂ الثالث عشر: الخلوص بمعنی مبطلیة الریاء ◂ الریاء مبطل للوضوء مطلقاً ◂ الکلام فی التوبة من الریاء ◂ الشکّ فی تحقّق الریاء ◂ العجب لایبطل الوضوء ◂ حکم الضمائم إلی قصد القربة"}, {r:172,n:"الریاء بعد العمل"}, {r:173,n:"وضوء المرأة فی موضع یراها الأجنبی"}, {r:174,n:"اجتماع غایات الوضوء"}, {r:175,n:"دخول الوقت أثناء الوضوء"}, {r:176,n:"لو کان الوضوء لواجب فأتی به لمستحب"}, {r:177,n:"التضرّر بالغسل الزائد"}, {r:178,n:"الکلام فی مبطلیّة الارتداد"}, {r:179,n:"التوضؤ مع نهی المولی أو الزوج"}, {r:180,n:"استصحاب الوضوء والحدث للمتیقن منهما"}, {r:181,n:"المأمور بالوضوء إذا نسیه وصلّی"}, {r:182,n:"من توضأ للتجدید وعلم ببطلان أحد وضوئیه"}, {r:183,n:"فروغ الشک فی زمان الحدث"}, {r:185,n:"من علم إجمالاً ببطلان إحدی النافلتین للحدث"}, {r:186,n:"العلم بصدور حدث وصلاة بعد الوضوء"}, {r:187,n:"العلم بترک جزء واجب أو مستحب"}, {r:188,n:"العلم بترک جزء أو شرط"}, {r:189,n:"کثیر الشک"}, {r:191,n:"الشک فی أثناء التیمّم ◂ الشک فی وجود الأمر الاضطراری"}, {r:192,n:"الشک فی إتمام الوضوء أو العدول عنه اختیاراً أو اضطراراً"}, {r:193,n:"الشک فی الحاجب"}, {r:194,n:"إذا علم بحدوث الحاجب وشک فی تقدم الوضوء وتأخره عنه"}, {r:195,n:"إذا توضّأ فشکّ فی أنّه هل طهّر المحلّ قبله؟"}, {r:196,n:"بعض فروع قاعدة الفراغ"}, {r:199,n:"تعریف الجبائر ◂ لو أمکن إیصال الماء تحت الجبیرة وجب ◂ تفصیل صور الجبیرة ◂ وجوب المسح علی الجبیرة الموضوعة ◂ ما یعتبر فی المسح علی الجبیرة ◂ لو أمکن إیصال الماء تحت جبیرة موضع المسح"}, {r:200,n:"الجبیرة المستوعبة"}, {r:201,n:"إذا کانت الجبیرة فی الماسح"}, {r:202,n:"شرط الانتقال إلی مسح الجبیرة"}, {r:203,n:"الجبائر المتعدِّدة فی محلّ واحد"}, {r:204,n:"إذا وقع بعض الأطراف الصحیحة تحت الجبیرة"}, {r:205,n:"اعتبار غسل أطراف الجرح المکشوف"}, {r:206,n:"إضرار الماء بأطراف الجرح"}, {r:207,n:"إذا أضرّ الماء من دون جرح ونحوه"}, {r:209,n:"المرمّد یتیمّم"}, {r:210,n:"محلّ الفصد من الجروح"}, {r:211,n:"جریان أحکام الجبیرة لو حدث الجرح اختیاراً وعصیاناً"}, {r:212,n:"اللاصق ببعض المواضع"}, {r:213,n:"إذا کانت الجبیرة مغصوبة"}, {r:215,n:"عدم اشتراط کون الجبیرة ممّا تصحّ الصلاة فیه"}, {r:216,n:"إجراء حکم الجبیرة مادام خوف الضرر باقیاً"}, {r:217,n:"إذا کان رفع الجبیرة مفوّتاً للوقت"}, {r:218,n:"حکم الدواء المختلط بالدم المنجمد علی الجرح"}, {r:219,n:"هل یتحقّق الغسل بالمسح برطوبة الید؟"}, {r:220,n:"عدم مانعیّة الدسومة من المسح علی الجبیرة"}, {r:221,n:"العضو السلیم إذا لم یمکن تطهیره"}, {r:222,n:"تخفیف الجبیرة غیر واجب"}, {r:223,n:"الوضوء الجبیری رافع للحدث، لا مبیح"}, {r:224,n:"فوارق جبیرة محلّ الغسل والمسح"}, {r:225,n:"غسل الجبیرة"}, {r:227,n:"مساواة التیمّم للوضوء فی أحکام الجبیرة"}, {r:229,n:"هل یجوز قضاء الصلاة لصاحب الجبیرة عن نفسه وغیره؟ ◂ إجزاء وضوء الجبیرة لوزال العذر"}, {r:230,n:"جواز البدار لصاحب الجبیرة"}, {r:231,n:"اعتقاد الضرر أو عدمه"}, {r:232,n:"إذا تردّد بین الوضوء الجبیری ووجوب التیمّم"}, {r:233,n:"صور المسلوس والمبطون وأحکامها ◂ الصورة الاُولی: وجود فترة تسع الطهارة والصلاة بلا حدث ◂ الصورة الثانیة: خروج الحدث أثناء الصلاة مرّة أو أکثر بحیث لا یلزم الحرج من تجدید الوضوء ◂ الصورة الثالثة: خروج الحدث أثناء الصلاة کثیراً بحیث یلزم الحرج من تجدید الوضوء کل مرّة ◂ الصورة الرابعة: خروج الحدث بدون انقطاع ◂ حکم سلس الریح ◂ فی وجوب المبادرة بلا مهلة"}, {r:234,n:"کفایة وضوئهما لغیر الصلاة"}, {r:235,n:"وجوب التحفّط عن النجاسة"}, {r:236,n:"لا دلیل علی وجوب المعالجة علیهما"}, {r:237,n:"حکم مسّهما کتابة القرآن"}, {r:238,n:"تأخیر الصلاة مع احتمال الفترة"}, {r:239,n:"إذا شرع فی الصلاة باعتقاد عدم الفترة فتبیّن وجودها"}, {r:240,n:"إذا تمکّنا من الصلاة الاضطراریة"}, {r:241,n:"عدم وجوب القضاء علیهما"}, {r:242,n:"لو نذر الدوام علی الوضوء فطرأت إحدی الحالتین"}],
  bk71: [{r:1,n:"تعداد الأغسال الواجبة"}, {r:2,n:"وجوه نذر الغسل والزیارة"}, {r:3,n:"موجبات الجنابة: ◂ الأول: خروج المنی وعلامته ◂ الشک فی کون الخارج منیّاً ◂ عدم اعتبار الدفق فی المریض والمرأة ◂ الثانی: الجماع وإن لم ینزل ◂ المدار فی الجماع ◂ رؤیة المنی فی الثوب"}, {r:4,n:"إذا علم بالجنابة والغسل وجهل السابق منهما"}, {r:5,n:"دوران الجنابة بین شخصین"}, {r:6,n:"حکم الاقتداء عند دوران الجنابة بین شخصین أو أکثر"}, {r:7,n:"بعض فروع دوران الجنابة بین اثنین أو أکثر ◂ خروج المنی بصورة الدم"}, {r:8,n:"وجوب الغسل علی المرأة بالاحتلام"}, {r:10,n:"إجناب الشخص نفسه اختیاراً مع العجز عن الغسل"}, {r:11,n:"مع الشک فی الدخول لایجب الغسل"}, {r:12,n:"لا فرق فی الدخول بالعضو مجرّدا أو ملفوفا بخرقة"}, {r:13,n:"من یأتی بالغسل احتیاطا لابدّ له من الوضوء"}, {r:14,n:"الأول: الصلاة وتوابعها ◂ الثانی: الطواف الواجب ◂ الثالث: صوم شهر رمضان وقضاؤه ◂ فروع فی مبطلیة الجنابة"}, {r:15,n:"حکم الاحتلام فی نهار شهر رمضان ◂ الأول: مسّ خطّ المصحف وأسمائه تعالی، وکذا مسّ سائر أسماء الأنبیاء والأئمة علیهم السلام ◂ الثانی: دخول المسجدین ولو اجتیازا ◂ الثالث: المکث فی سائر المساجد وکذا المشاهد المشرّفة ◂ الرابع: دخول المسجد بنیّة وضع شیءٍ فیه ◂ الخامس: قراءة سور العزائم ◂ تیمّم الجنب للخروج من المسجدین ◂ الکلام فی الحائض والنفساء ◂ حکم المسجد الخراب"}, {r:16,n:"لایجری حکم المسجد علی المصلّی فی البیت"}, {r:17,n:"الشک فی المسجدیة"}, {r:18,n:"الأولی للجنب عدم قراءة آیة «أفمن کان مؤمنا...» فی دعاء کمیل"}, {r:19,n:"حکم إدخال الجنب للمسجد"}, {r:20,n:"استئجار الجنب لکنس المسجد"}, {r:21,n:"التیمّم لدخول المسجد وأخذ الماء منه"}, {r:22,n:"من فروع استئجار الجنب"}, {r:23,n:"الشک فی الجنابة"}, {r:25,n:"غسل الجنابة والکون علی الطهارة ◂ لایجب قصد الوجوب أو الندب ◂ فروع فی غسل الجنابة ◂ الاُولی: الترتیب، صورته وأحکامه ◂ الثانیة: الارتماس، صورته وأحکامه ◂ لزوم الإعادة لولم یستوعب الغسل تمام البدن ◂ وحدة الکیفیة فی جمیع الأغسال ◂ قد تتعیّن إحدی الکیفیّتین بالخصوص ◂ الوضوء مع غسل الجنابة ◂ أفضلیة الترتیبی من الارتماسی ◂ جواز رمس العضو فی الترتیبی"}, {r:27,n:"محل النیّة فی الغسل الارتماسی"}, {r:28,n:"اشتراط طهارة الأعضاء حال الغسل"}, {r:29,n:"وجوب الیقین بوصول الماء إلی البشرة"}, {r:30,n:"الشکّ فی کون الشیء من الظاهر أو الباطن"}, {r:31,n:"اعتبار الموالاة فی غسل المبطون والمسلوس والمستحاضة"}, {r:32,n:"الغسل تحت المطر ونحوه"}, {r:33,n:"جواز العدول عن الارتماسی وبالعکس"}, {r:34,n:"جواز الارتماس بما دون الکرّ مع طهارة البدن، وحکم الاغتسال منه بعد ذلک"}, {r:35,n:"شرائط صحّة الغسل"}, {r:36,n:"نیّة الغسل وکفایة الداعی إلیه"}, {r:37,n:"إذا شکّ فی اغتساله بعد الخروج من الحمّام"}, {r:38,n:"الاغتسال باعتقاد خلاف الحال"}, {r:39,n:"الاغتسال مع قصد عدم دفع الاُجرة"}, {r:40,n:"الاغتسال بالماء المسخّن بالمغصوب"}, {r:41,n:"الغسل فی الأحواض الموقوفة"}, {r:43,n:"الغسل بالمئزر المغصوب"}, {r:44,n:"اُجرة اغتسال الزوجة علی الزوج"}, {r:45,n:"اغتسال الصائم بالارتماس نسیانا أو عمدا"}, {r:46,n:"الکلام فی استحباب المذکورات ◂ کراهة الاستعانة بالغیر فی المقدمات القریبة"}, {r:47,n:"الاستبراء لیس شرطا فی صحّة الغسل"}, {r:48,n:"البلل المشتبه وصوره"}, {r:49,n:"إذا شک بعد الغسل بالاستبراء"}, {r:50,n:"فروع فی حکم الرطوبة المشتبهة"}, {r:53,n:"الإحداث بالأصغر أثناء غسل الجنابة"}, {r:54,n:"الإحداث بالأصغر بین بقیة الأغسال ◂ إذا أحدث بالأکبر أثناء الغسل"}, {r:55,n:"إذا أحدث بالأصغر أثناء الأغسال المستحبة"}, {r:56,n:"الشکّ فی غسل عضو قبل الدخول فی الآخر"}, {r:57,n:"الشکّ فی نیّة الارتماسی بعد الارتماس"}, {r:58,n:"العلم ببقاء شیء غیر منغسل"}, {r:59,n:"الشکّ فی الاغتسال بعد الصلاة"}, {r:60,n:"صور اجتماع الأغسال المتعدّدة وأحکامها"}, {r:61,n:"غسل الجمعة من الجنب والحائض"}, {r:62,n:"بعض فروع التداخل"}, {r:63,n:"صفات الحیض ◂ مبدأ الحیض ومنتهاه ◂ معنی القرشیة ◂ الشکّ فی القرشیة وفی البلوغ والیأس ◂ الدم الخارج من مشکوکة البلوغ"}, {r:64,n:"اجتماع الحیض مع الإرضاع والحمل"}, {r:66,n:"فروع فی حکم الحیض"}, {r:67,n:"الشکّ فی حیضیّة الدم"}, {r:68,n:"اشتباه الحیض بغیره ◂ حکم الصلاة بدون الاختبار ◂ حکم تعذّر الاختبار ◂ اشتباه دم الحیض بدم القرحة ◂ أقلّ الحیض وأکثره ◂ أقلّ الطهر عشرة أیام"}, {r:69,n:"ما یعتبر فی ثلاثة أیام الدم ◂ حکم النقاء المتخلّل بین الأیام العشرة"}, {r:70,n:"أقسام الحائض"}, {r:71,n:"ذات العادة وأقسامها ◂ ذات العادة الوقتیة ◂ ذات العادة العددیة"}, {r:72,n:"فی انقلاب العادة أوبطلانها"}, {r:73,n:"العادة المرکّبة"}, {r:74,n:"حصول العادة بالتمییز"}, {r:75,n:"حکم النقاء المتخلّل بین الحیضتین"}, {r:76,n:"تساوی الحیضتین فی العددیة والوقتیة"}, {r:77,n:"حکم صاحبة العادة الوقتیة مطلقاً"}, {r:78,n:"حکم غیر ذات العادة الوقتیة ◂ رؤیة العدد فی غیر وقت العادة"}, {r:79,n:"حکم الدم فی العادة وغیرها إذا لم یتجاوز العشرة"}, {r:80,n:"حکم الدَمَین المتخلّل بینهما أقلّ من عشرة"}, {r:81,n:"إذا کان بعض کل واحد من الدَمَین فی العادة ◂ تعارض الوقت والعدد"}, {r:82,n:"حکم ما تجاوز العدد ولم یتجاوز العشرة"}, {r:83,n:"رؤیة الدم مرّتین فی شهر واحد"}, {r:85,n:"حکم الاستبراء وکیفیته ◂ الکلام فی وجوب الاستظهار للحائض"}, {r:87,n:"إذا انقطع الدم واحتمل عوده قبل العشرة"}, {r:88,n:"حکم الصلاة مع ترک الاستبراء"}, {r:89,n:"تعذّر الاستبراء"}, {r:90,n:"حکم ذات العادة إذا تجاوز دمها العشرة ◂ رجوع غیر ذات العادة إلی التمییز ◂ تعارض الدَمَین الواجدین للصفات ◂ فاقدة العادة والتمییز ◂ أقسام الناسیة وأحکامها"}, {r:91,n:"المراد من الشهر ومبدؤه"}, {r:92,n:"اختیار العدد فی أوّل رؤیة الدم"}, {r:93,n:"وجوب الموافقة بین الشهور"}, {r:94,n:"تبیُّن الخلاف فی المختار"}, {r:95,n:"تجاوز الدم عن العشرة فی ذات العادة الوقتیة"}, {r:96,n:"تجاوز الدم عن العشرة فی ذات العادة العددیة"}, {r:97,n:"التسویة بین أوصاف الدم"}, {r:98,n:"بعض فروع اعتبار التمییز"}, {r:101,n:"ما یعتبر فی التمییز بالصفات"}, {r:102,n:"الرجوع إلی الأقران مع فقد الأقارب"}, {r:103,n:"الأقارب الذین ترجع إلیهم"}, {r:104,n:"منافاة مختار المرأة مع حق الزوج"}, {r:105,n:"لزوم التدارک عند انکشاف الخلاف"}, {r:106,n:"محرّمات الحیض وأحکامه ◂ الأول: العبادة ◂ الثانی: المسّ ◂ الثالث: قراءة آیات السجدة ◂ الرابع: اللبث فی المساجد ◂ الخامس: الوضع فی المساجد ◂ السادس: الاجتیار من المسجدین ◂ حکم دخول الحائض المشاهد ◂ حکم الحیض فی المسجدین ◂ حکم الحیض أثناء الصلاة ◂ الشکّ فی الحیض أثناء الصلاة"}, {r:107,n:"فروع فی تروک الحائض"}, {r:108,n:"السابع: وط ء الحائض فی القبل ◂ الاستمتاع بغیر الوطء"}, {r:109,n:"وط ء الحائض فی دبرها ◂ خروج دمها من غیر الفرج ◂ إخبار المرأة بحیضها وطهرها"}, {r:110,n:"لافرق فی حرمة الوط ء بین الزوجة ونحوها ◂ لافرق فی حکم الحیض بین سائر أنواعه ◂ الثامن: وجوب الکفّارة ◂ الکلام فی الوجوب وکیفیة التکفیر ◂ شروط تحمّل الکفّارة"}, {r:112,n:"کفّارة وط ء الدّبر"}, {r:113,n:"کفّارة الزنا بالحائض"}, {r:115,n:"فروع کفّارة وط ء الحائض"}, {r:119,n:"العجز غیر مسقط للکفّارة"}, {r:123,n:"مصرف الکفّارة"}, {r:124,n:"تکرّر الوط ء فی کلّ ثلث"}, {r:125,n:"إلحاق النُفَساء بالحائض ◂ وط ء الحائض فی کلّ ثلث من الحیض ◂ التاسع: طلاق الحائض وظهارها"}, {r:126,n:"بعض فروع طلاق الحائض"}, {r:129,n:"المدار علی وجود الدم فی الأحکام الثلاثة ◂ العاشر: وجوب الغسل بعد انقطاع الحیض"}, {r:130,n:"غسل الحیض کغسل الجنابة حکما وکیفا"}, {r:131,n:"الغسل رافع لحدث الحیض وإن لم تتوضّأ"}, {r:132,n:"جواز الوط ء بعد انتهاء الحیض"}, {r:135,n:"انتقاض التیمّم بدل الغسل ◂ الحادی العشر: وجوب قضاء الصیام ◂ الحائض لاتقضی صلاتها"}, {r:136,n:"إذا حاضت بعد دخول الوقت"}, {r:137,n:"إذا طهرت قبل خروج الوقت ◂ قضاء الحائض التی تدرک من الوقت رکعة"}, {r:138,n:"إذا طهرت فی زمان لایسع الصلاة مع الطهارة ◂ المناط فی تمامیة الرکعة ◂ فروع ترتبط بأعمال الحائض من القضاء والتدارک"}, {r:139,n:"العلم أوّل الوقت بمفاجأة الحیض"}, {r:142,n:"إذا طهرت ولها وقت إحدی الصلاتین"}, {r:143,n:"إذا طهرت فی مواطن التخییر مع ضیق الوقت"}, {r:144,n:"عدم سعة الوقت إلاّ لواحدة مع اشتباه القبلة"}, {r:145,n:"إذا اعتقدت سعة الوقت"}, {r:146,n:"ما یستحب للحائض"}, {r:147,n:"مایکره للحائض"}, {r:148,n:"أغسال الحائض"}, {r:149,n:"تعریف الاستحاضة ◂ صفات دم الاستحاضة ◂ کون دم الاستحاضة هو الأصل لدی الشکّ ◂ أقسام المستحاضة وأحکامها ◂ الاستحاضة القلیلة وأحکامها ◂ الاستحاضة المتوسّطة وأحکامها ◂ الاستحاضة الکثیرة وأحکامها"}, {r:150,n:"تفریق الصلوات جائز للمستحاضة ◂ بعض فروع المستحاضة"}, {r:152,n:"وجوب الفحص علی المستحاضة"}, {r:153,n:"حکم الاختبار قبل الوقت ◂ تجدید المستحاضة الأعمال للصلاة دون توابعها"}, {r:154,n:"التجدید مع انقطاع الدم"}, {r:155,n:"التخییر بین تقدیم الغسل علی الوضوء، وبالعکس"}, {r:156,n:"لزوم المبادرة إلی الصلاة بعد الأعمال"}, {r:157,n:"التحفّظ من خروج الدم"}, {r:158,n:"أحوطیّة الاحتشاء بعد الغسل ◂ المحافظة من خروج الدم إذا کانت صائمة ◂ تقدیم غسل الفجر علیه لصلاة اللیل ونحو ذلک"}, {r:160,n:"اشتراط الأغسال فی صوم المستحاضة دون الوضوءات"}, {r:161,n:"تأخیر الصلاة إلی وقت انقطاع الدم"}, {r:162,n:"صور وأحکام انقطاع الدم أثناء الوقت"}, {r:163,n:"انقلابات الاستحاضة وأحکامها"}, {r:164,n:"وجوب الغسل للانقطاع"}, {r:165,n:"وضوء المستحاضة القلیلة لکل مشروط به"}, {r:166,n:"لو عملت المستحاضة بوظیفتها أو أخلّت"}, {r:167,n:"جواز القضاء للمستحاضة"}, {r:168,n:"الحدث الأصغر أثناء الغسل"}, {r:170,n:"الحدث الأکبر أثناء الغسل"}, {r:171,n:"وجوب خمسة أغسال علی المستحاضة"}, {r:172,n:"بدلیة التیمّم عن غسل المستحاضة ◂ حدّ النفاس ◂ أقل النِفاس وأکثره ◂ مبدأ احتساب النفاس"}, {r:173,n:"لحوق النقاء المتخلّل بالنفاس"}, {r:174,n:"حکم تجاوز دم النفاس عن العشرة ◂ عدم رؤیة الدم فی العشرة ◂ صاحبة العادة إذا لم ترَ فی العادة، أو رأته فی بعضها"}, {r:175,n:"اعتبار فصل أقلّ الطهر بین الحیض والنفاس"}, {r:176,n:"إذا خرج بعض الطفل بعد فصل طویل"}, {r:177,n:"تعدّد الولادة"}, {r:178,n:"حکم مستمرّة الدم إلی شهر أو أکثر"}, {r:179,n:"وجوب الاستظهار علی النفساء"}, {r:180,n:"حکم استظهار النفساء لو استمر الدم بعد مضیّ العادة"}, {r:181,n:"النفساء کالحائض"}, {r:182,n:"کیفیة غسل النفاس"}, {r:183,n:"وجوب غسل مسّ المیت ◂ ما یعتبر فی وجوب غسل مسّ المیت ◂ حکم مسّ المیّت المغسّل بالماء القراح اضطرارا ◂ حکم مسّ المیّت المیمّم لتعذّر التغسیل ◂ لافرق فی المیّت بجمیع أقسامه ◂ اتحاد حکم الماسّ والممسوس فیما لاتحلّه الحیاة وغیره"}, {r:184,n:"مسّ القطعة المبانة من الحیّ والمیّت"}, {r:185,n:"مسّ العظم المجرّد ◂ فروع الشکّ فی تحقّق المسّ ◂ مسّ الشهید"}, {r:186,n:"العلم الإجمالی بأنّ إحدی القطعَتین من الإنسان"}, {r:187,n:"المسّ الاضطراری کالاختیاری، کبیرا کان الماسّ أو صغیرا"}, {r:188,n:"عدم الفرق فی مسّ القطعة المبانة بین کونها من الماسّ أو غیره"}, {r:189,n:"حکم مسّ القطعة المبانة من الحیّ قبل البرد"}, {r:190,n:"مسّ الطفل اُمّه المیّتة، وبالعکس"}, {r:191,n:"فروع فی مسّ المیّت"}, {r:196,n:"ناقضیّة مسّ المیّت للوضوء"}, {r:197,n:"الشکّ فی أنّ المسّ وقع قبل الغسل أوبعده ◂ کیفیة غسل المسّ"}, {r:198,n:"وجوب غسل المسّ لکل مشروط بالطهارة"}, {r:199,n:"حلّیة دخول المساجد ونحوها للماسّ قبل الغسل"}, {r:200,n:"الحدث أثناء غسل المسّ"}, {r:201,n:"مسّ المیّت أثناء غسل المسّ ◂ تکرار المسّ لایوجب تکرّر الغسل"}, {r:202,n:"جریان حکم المسّ مع الرطوبة وبدونها ◂ أقسام ما یسبّبه مسّ المیّت"}],
  bk72: [{r:1,n:"وجوب التوبة وحقیقتها"}, {r:2,n:"ما یجب فعله عند ظهور علامات الموت"}, {r:3,n:"الوصیة بأداء الواجبات من صوم وصلاة وحج ونحوها"}, {r:4,n:"تملیک غیر الوارث ◂ هل یجب الإعلام بمال لایعلمه الوارث؟"}, {r:5,n:"هل یجب نصب القیّم علی الأطفال؟"}, {r:7,n:"آداب العیادة"}, {r:8,n:"الأول: توجیه المیّت إلی القبلة ◂ هل یجب أن یوجّه المحتضر نفسه؟ ◂ الرابع: نقله إلی مصلاّه إذا عسر علیه النزع ◂ الخامس: قراءة القرآن سیّما بعض السور ◂ فروع فیما یتعلق بتوجیه المیت ◂ الثانی والثالث: استحباب تلقین المیت الاعتقادات الحقة وتلقینه کلمات الفرج"}, {r:12,n:"کفائیة وجوب التجهیز وشرطیّة إذن الولی ◂ إذا امتنع الولی سقط اعتبار إذنه ◂ عدم اعتبار الصراحة فی إذن الولیّ ◂ سقوط وجوب المبادرة بالعلم بمباشرة الغیر ◂ الظنّ بمباشرة الغیر ◂ العلم بصدور الفعل عن الغیر والشک فی صحته ◂ الکلام فی تجهیر الصبی الممیّز وکفایته عن البالغین"}, {r:13,n:"الزوج أولی بزوجته والمالک أولی بممولکه ◂ بعض المرحجات فی الأولویة وفروعها"}, {r:18,n:"وصیّة المیت لغیر الولی"}, {r:21,n:"دعوی الولایة علی المیّت"}, {r:22,n:"إذا غسّل المیّت أو صلّی علیه عن إجبار"}, {r:23,n:"وجوب تغسیل کلّ مسلم ◂ کیفیة تغسیل المخالف ◂ حرمة تجهیز الکافر وما اُلحق به ◂ حکم أطفال المسلمین وأطفال غیرهم"}, {r:24,n:"تجهیز الأسیر واللّقیط والسقط"}, {r:25,n:"وجوب قصد القربة فی غسل المیّت ◂ کفایة نیة واحدة للأغسال الثلاثة ◂ جواز تعدّد من یغسّل المیت ◂ اعتبار المماثلة فی الذکوریة والاُنوثیة إلاّ فی موارد ◂ الأوّل: الطفل الذی لم یتجاوز الثلاث سنین ◂ الثانی: تغسیل الزوج زوجته وبالعکس ◂ إلحاق المنقطعة ونحوها بالدائمة ◂ تغسیل المطلق مطلقته وبالعکس ◂ حکم التغسیل بعد انقضاء العدة ◂ الثالث: المحارم بنسب أو رضاع أو مصاهرة ◂ ماقیل باشتراطه فی تغسیل المحارم ◂ الرابع: المولی والأمة علی إشکال ◂ حکم الخنثی المشکل"}, {r:26,n:"حکم المیت أو عضوه المشتبه بین الذکر والانثی ◂ تغسیل الکتابی المماثل للمسلم ◂ إذا حضر المسلم المماثل بعد تغسیل الکتابی"}, {r:27,n:"انحصار التغسیل بالمخالف المماثل"}, {r:28,n:"إذا فقد المماثل فی غیر موارد الاستثناء المتقدمة ◂ شرائط المُغسّل ◂ الأول: الشهید ومن قتل فی حفظ بیضة الإسلام ◂ المدار فی سقوط التغسیل وعدمه فی الشهید ◂ الثانی: من وجب قتله برجم أو قصاص ◂ الأمر بالاغتسال للقصاص والرجم قبلهما ◂ ما یعتبر فی غسل وتکفین المرجوم والمقتص منه ◂ اعتبار استناد الموت إلی الرجم أو القصاص ◂ سقوط الغسل عزیمة لارخصة ◂ الحکم بجواز تکفین الشهید فوق الثیاب ◂ ما یجوز وما لا یجوز نزعه من الشهید"}, {r:31,n:"الشک فی شهادة من وجد میتاً فی المعرکة"}, {r:32,n:"من لایجری علیه حکم الشهید"}, {r:33,n:"اذا اشتبه المسلم بالکافر"}, {r:34,n:"حکم مسّ الشهید والمقتول بالقصاص ◂ حکم القطعة المبانة من المیت"}, {r:36,n:"جریان أحکام المیت لو بقی عظاماً بلا لحم ◂ حکم العضو المردد بین الذکر والأنثی"}, {r:37,n:"ما یُعتبر فی غسل المیت"}, {r:38,n:"غسل المیت کغسل الجنابة علی کلام فی الارتماسی ◂ إزاله النجاسة عن بدن المیت قبل التغسیل"}, {r:39,n:"ما یعتبر فی السدر والکافور"}, {r:41,n:"الوضوء مع غسل المیّت"}, {r:42,n:"مقدار الماء الذی یغسل به المیّت"}, {r:43,n:"حکم تعذّر أحد الخلیطین أو کلیهما ◂ بدلیّة التیمّم عن تغسیل المیت ◂ کفایة الماء لغسل واحد"}, {r:45,n:"حکم من تعذّر تغسیله لجرح أو حرق ونحو ذلک"}, {r:46,n:"المیت المحرم لا یُمسُّ بالکافور"}, {r:48,n:"حکم ارتفاع العذر عن الغسل أو الخلیط ◂ کیفیة التیمّم بالمیّت"}, {r:49,n:"حکم مسّ المیّت المیمّم ◂ اشتراط الغسل بما اشترط فی الوضوء"}, {r:50,n:"الغسل بالمغصوب نسیاناً أو جهلاً"}, {r:51,n:"أفضلیة تجرید المیت حین التغسیل أو أفضلیته من وراء الثیاب"}, {r:53,n:"إجزاء غسل المیت عن غیره ◂ تغسیل المیّت قبل برده ◂ حرمة النظر إلی عورة المیّت"}, {r:54,n:"واجبات المیت التی یجوز النبش لأجل تدارکها"}, {r:55,n:"أخذ الأجرة علی تغسیل المیّت"}, {r:57,n:"استعمال المیسور من السدر والکافور عند تعذّره ◂ تنجّس بدن المیّت بعد الغسل أو أثنائه"}, {r:58,n:"طهارة الآلات بعد کل غسل"}, {r:61,n:"وجوب التکفین بالأثواب الثلاثة: المئزروالقمیص والإزار ◂ حکم تعذّر بعض أثواب الکفن"}, {r:62,n:"نیّة التکفین"}, {r:63,n:"اعتبار حصول الستر بتمام الأثواب أو بکلّ واحدٍ منها"}, {r:64,n:"التکفین بجلد المیتة أو بالمغصوب اضطراراً"}, {r:65,n:"ما لا یجوز التکفین به اختیاراً"}, {r:66,n:"صور الدوران بین أفراد ما لا یجوز التکفین به اختیاراً"}, {r:68,n:"حکم التکفین بالحریر غیر الخالص ◂ یلزم إزالة ما لو تنجّس من الکفن بغسله أو بقرضه"}, {r:69,n:"حکم تجهیز الزوجة وشرائطه"}, {r:74,n:"تجهیز غیر الزوجة من واجبی النفقة"}, {r:76,n:"القول فی مالکیة الکفن"}, {r:78,n:"فروع فی التجهیز"}, {r:80,n:"خروج مؤنة التجهیز من الترکة"}, {r:81,n:"حکم الزائد عن الواجب فی التجهیز"}, {r:82,n:"هل یقدّم الکفن علی الحقوق المتعلّقة بالترکة کحق الرهن؟"}, {r:83,n:"هل یجب علی المسلمین بذل الکفن؟"}, {r:84,n:"تکفین المحرم کغیره"}, {r:87,n:"تحنیط المساجد السبعة بالکافور ◂ ما یستحب مسحه بالکافور من أعضاء المیّت ◂ محلّ التحنیط ◂ شروط الکافور ◂ یجب تحنیط کل میّت ماعدا المحرم ◂ نیّة التحنیط ◂ مقدار الحنوط الواجب والمستحب ◂ سقوط الحنوط بتعذّر الکافور"}, {r:90,n:"فروع فی مکروهات التحنیط ومستحبّاته"}, {r:96,n:"تقدیم التغسیل بالکافور علی التحنیط فی مورد التزاحم ◂ تقدیم الجبهة علی سائر المواضع فی التحنیط"}, {r:97,n:"استحباب وضعهما مع کل میّت"}, {r:98,n:"أولویة جریدة النخل مع الإمکان"}, {r:99,n:"اعتبار الرطوبة فی الجریدة"}, {r:100,n:"بقیة مستحبات الجریدة"}, {r:101,n:"کیفیة وضع الجریدتین فی القبر"}, {r:103,n:"لو تَرک وضع الجریدتین جُعلت علی القبر ◂ الکتابة علی الجریدتین ◂ استحباب الإعلام بموت المؤمن ◂ استحباب التشییع ◂ آداب التشییع ◂ مکروهات التشییع"}, {r:104,n:"وجوب الصلاة علی کلّ مسلم ◂ حرمة الصلاة علی کلّ کافر ◂ الصلاة علی الطفل ◂ الصلاة علی من لا یعلم إسلامه"}, {r:105,n:"شروط الصلاة علی المیت ◂ صلاة الصبی الممیز علی المیت"}, {r:107,n:"اشتراط تأخر الصلاة عن التکفین ◂ الصلاة عند تعذّر الکفن ◂ عدم سقوط سائر الواجبات بتعذر الکفن"}, {r:108,n:"جواز تعدّد الصلاة علی المیت مع الکلام فی النیّة"}, {r:109,n:"حکم الصلاة علی بعض المیت"}, {r:111,n:"الصلاة قبل الدفن ◂ اعتبار الاستئذان من جمیع الأولیاء"}, {r:113,n:"حکم ما إذا کان الولی إمرأة ◂ تعیین المیت من یصلّی علیه"}, {r:114,n:"شروط إمامة صلاة المیت"}, {r:115,n:"مشروعیة صلاة المیت جماعة"}, {r:118,n:"إمامة المرأة للنساء فی صلاة المیت"}, {r:119,n:"صلاة العراة علی المیت"}, {r:121,n:"فروع فی الصلاة جماعةً علی المیت ◂ حضور المرأة جماعة الرجال ◂ حکم العدول فی جماعة المیّت"}, {r:122,n:"التکبیر قبل الإمام فی الصلاة المیّت"}, {r:123,n:"من حضر أثناء صلاة الجماعه علی المیّت ◂ وجوب الإتیان بخمس تکبیرات ◂ صورة الأذکار بین تکبیرات الصلاة"}, {r:125,n:"الاتیان بالناقص عن الخمس تکبیرات"}, {r:126,n:"کیفیة الأدعیة بین التکبیرات"}, {r:127,n:"اعتبار العربیة فی الأدعیة بالقدر الواجب"}, {r:128,n:"ما لا یعتبر فی صلاة المیت ممّا یعتبر فی الصلاة"}, {r:129,n:"الشک فی ذکوریة المیت ◂ الشک بین التکبیرات"}, {r:130,n:"الأول: کون المیت مستلقیاً ◂ الثانی: اتجاه رأسه إلی یمین المصلّی ◂ الثالث: وقوف المصلّی خلف المیّت محاذیاً له ◂ الرابع: الحضور عند المیّت ◂ الحادی عشر: قصد القربة ◂ الثانی عشر: إباحة المکان ◂ الخامس: عدم الحائل بین المصلّی والمیت ◂ السادس: عدم الإفراط فی البعد عن المیّت ◂ السابع: عدم العلوّ المفرط بین المصلّی والمیت ◂ الثامن: استقبال القبلة عند الصلاة ◂ التاسع: القیام حال الصلاة ◂ العاشر: تعیین المیت ◂ الثالث عشر: الموالاة بین التکبیرات والأدعیة ◂ الرابع عشر: الاستقرار حال الصلاة ◂ الخامس عشر: تأخر الصلاة عن الغسل والکفن ◂ السادس عشر: أن یکون المیت مستور العورة ◂ السابع عشر: إذن الولی"}, {r:131,n:"ما یعتبر فی صلاة المیت"}, {r:133,n:"ما یلزم فی شرطیة القیام والاستقرار ◂ حکم الصلاة عند اشتباه القبلة"}, {r:134,n:"غصبیة مکان المیّت دون المصلّی"}, {r:138,n:"صلاة غیر المأذون من الولی"}, {r:139,n:"اذا دفن المیت ولم یصلَّ علیه"}, {r:140,n:"التیمّم لصلاة الجنازة ◂ الکلام بغیر الصلاة أثناء صلاة الجنازة"}, {r:141,n:"الإشکال فی صلاة العاجز مع وجود من یستطیع القیام"}, {r:143,n:"انکشاف وجود القادر بعد الصلاة من العاجز ◂ الشک فی صلاة الغیر"}, {r:144,n:"الصلاة علی المیّت مع العلم ببطلانها تقلیلاً أو اجتهاداً"}, {r:145,n:"الصلاة علی المصلوب"}, {r:146,n:"تکرار الصلاة علی المیت"}, {r:147,n:"لو ترکت الصلاة قبل الدفن"}, {r:149,n:"الصلاة علی المصلّی علیه قبل الدفن"}, {r:150,n:"استحباب المبادرة إلی صلاة الجنازة"}, {r:152,n:"الصلاة علی الجنازة أثناء الفریضة الیومیة ◂ کیفیة الصلاة إذا تعدّدت الجنائز ◂ إذا تواردت جنازة أثناء أخری"}, {r:154,n:"مسوّغات التیمّم ◂ الأول: عدم وجدان الماء ◂ ما یعتبر فی وجوب مواراة المیت"}, {r:155,n:"وجوب الطلب ومقداره ◂ شرطیة الاستقبال فی الدفن"}, {r:156,n:"حکم الموت فی السفینة"}, {r:157,n:"محققات الطلب ومسقطاته"}, {r:158,n:"حکم الجنین من مسلم إذا مات فی بطن کافرة"}, {r:161,n:"فروع فی واجبات الدفن وأحکامه"}, {r:169,n:"موت الجنین فی بطن الحامل أو حیاته وموتها ◂ المستحبات المتعلقة بالدفن ◂ کیفیة التلقین ◂ بقیة مستحبات الدفن ◂ صلاة لیلة الدفن"}, {r:172,n:"أحکام القبور ◂ فروع تتعلق بالمیت"}, {r:178,n:"حرمة نبش قبر المؤمن ◂ مستثنیات حرمة نبش القبور"}, {r:179,n:"تخریب القبور وفروع تتعلق بالدفن"}, {r:192,n:"الأغسال الزمانیة ◂ استحباب غسل الجمعة"}, {r:193,n:"مبدأ غسل الجمعة ومنتهاه ◂ نیة الغسل بعد زوال الجمعة ◂ قضاء غسل الجمعة"}, {r:194,n:"تقدیم غسل الجمعة ◂ فروع فی وقت الجمعة وقضائه"}, {r:205,n:"صحة غسل الجمعة من الجنب والحائض ◂ التیمم بدل غسل الجمعة"}, {r:206,n:"أغسال لیالی شهر رمضان"}, {r:209,n:"غُسل یومی العیدین ووقته ◂ غسل یوم الترویة ◂ غسل یوم عرفة ◂ غسل أیام من رجب ◂ غسل یوم الغدیر ◂ غسل یوم المباهلة"}, {r:210,n:"بقیة الأغسال الزمانیة"}, {r:213,n:"أقسام الأغسال الفعلیة"}, {r:215,n:"بعض الأغسال المسنونة"}, {r:217,n:"إجزاء الأغسال و کفایة غسل واحد"}, {r:218,n:"تداخل الأغسال و کفایة غسل واحد"}, {r:219,n:"الکلام فی استحباب الغسل نفساً"}, {r:220,n:"بدلیة التیمم فی المقام"}, {r:229,n:"لو ترک الطلب متعمدّاً صحّت صلاته وإنْ عصی"}, {r:231,n:"اذا أخطا الماء أو اعتقد ضیق الوقت فتبین العکس"}, {r:233,n:"حکم إراقة الماء بعد الوقت وقبله أو إبطال الوضوء"}, {r:235,n:"حکم الطلب عند الخوف أو الحرج أو اختلاف الأرض ◂ الثانی: عدم الوصلة إلی الماء"}, {r:236,n:"أنحاء تحصیل الماء ◂ الثالث: الخوف من استعمال الماء"}, {r:238,n:"حکم الطهارة المائیة مع الضرر والحرج"}, {r:239,n:"التیمّم أو الوضوء باعتقاد الضرر أو خوفه وتبین الخلاف"}, {r:240,n:"الإجناب عمداً مع العلم بالتضرر باستعمال الماء ◂ حکم إبطال الوضوء أو الجماع مع عدم التمکن من الماء ◂ الرابع: الحرج فی تحصیل الماء أو استعماله ◂ الخامس: الخوف علی نفسه أو غیره من العطش لو توضأ بالماء"}, {r:241,n:"وظیفة من کان معه ماءان: طاهر ونجس"}, {r:242,n:"السادس: إذا عارض الوضوء أو الغسل واجب أهم ◂ لو قدم الطهارة الحدثیة علی الخبثیة ◂ تعیّن تقدیم الطهارة الحدثیة لو فقد التراب"}, {r:243,n:"دوران الأمر بین صرف الماء للوضوء أو إزالة بعض الخبث"}, {r:244,n:"الدوران بین الترک فی الوقت أو شرب النجس ◂ دوران الأمر بین تحصیل الماء وتحصیل الساتر ◂ الدوران بین تحصیل الماء أو القبلة ◂ السابع: ضیق الوقت عن استعمال الماء"}, {r:246,n:"لو ضیّق الوقت علی نفسه بالاختیار ◂ الشک فی ضیق الوقت وسعته"}, {r:248,n:"ضیق الوقت عن تحصیل الماء الموجود"}, {r:249,n:"من ضاق وقته عن استعمال الماء فخالف واستعمله"}, {r:250,n:"التیمّم لصلاة أو غایة ضاق وقتها لایبیح غیرها"}, {r:252,n:"المدار ضیق الوقت عن الواجبات لا مع المستحبات"}, {r:253,n:"حکم ضیق الوقت فی المستحبّات ◂ التیمّم باعتقاد السعة فتبیّن الضیق أو العکس"}, {r:254,n:"الثامن: العجز عن استعمال الماء لمانع شرعی"}, {r:255,n:"حکم من کان جنباً مع عدم الماء إلاّ فی المسجد ◂ موارد مشروعیة التیمّم مع وجدان الماء"}, {r:257,n:"خلط المطلق بالمضاف ◂ جواز التیمّم علی مطلق وجه الأرض ◂ حکم التیمّم بالجص والنّورة والطین قبل الإحراق وبعده ◂ حکم التیمّم بالمعادن ونحوها ممّا خرج عن اسم الأرض ◂ جواز التیمّم بالغبار ومع فقده فبالطین ◂ وظیفة من فقد الأرض والغبار والطین ◂ حکم التیمّم بالثلج ◂ تعین الطهارة المائیة لو أمکن إذابة الثلج"}, {r:258,n:"الأحوط الترتیب بین أنواع الأرض بحسب الإمکان"}, {r:260,n:"من لا یجد الاّ الجص المطبوخ أو الآجر أو الخزف أو الرماد"}, {r:261,n:"جواز التیمّم علی الحائظ من الطین ونحوه مما لا یخرج عن اسم الأرض"}, {r:263,n:"وجوب إزالة ما لصق بالید من الطین عند التیمّم"}, {r:265,n:"حکم التیمّم بالتراب الممزوج بغیره"}, {r:268,n:"وجوب شراء ما یتیمّم به"}, {r:269,n:"حکم التیمّم علی الأرض الندیّة"}, {r:270,n:"حکم التیمّم بما لا یصح التیمّم به جهلاً ◂ تحدید المراد من الطین ◂ اشتراط الطهارة والإطلاق والإباحة"}, {r:271,n:"حکم التیمّم حال الجهل بالغصبیة أو نسیانها ◂ التیمّم بالتراب فی آنیة الذهب والفضة"}, {r:272,n:"اشتباه التراب النجس بغیره والمباح بالمغصوب ◂ العلم الإجمالی بغصبیة الماء أو التراب أو نجاسة أحدهما أو إضافته"}, {r:275,n:"التیمّم بما یشک فی کونه ترابا"}, {r:276,n:"حکم تیمّم المحبوس فی مکان مغصوب ووضوئه بمائه"}, {r:277,n:"إذا کان التراب لا یکفی لضرب الکفّین معاً"}, {r:278,n:"مستحبات التیمّم ومایتیمّم به ومکروهاته"}, {r:280,n:"الأول: ضرب باطن الیدین معاً اختیاراً وبما تیسّر مع الاضطرار ◂ الثانی: مسح الجبهة والجبینین ◂ الثالث: مسح ظاهر کل من الکفین بباطن الاُخری ◂ الأول: النیة ◂ السادس: عدم الحائل بین الماسح والممسوح ◂ السابع: طهارة الماسح والمسوح مع الاختیار ◂ الثانی: المباشرة مع الاختیار ◂ الثالث: الموالاة ولو کان بدلاً عن الغسل"}, {r:281,n:"الرابع: الترتیب، بمسح الوجه ثمّ الید الیمین ثم الیسری"}, {r:282,n:"الخامس: الابتداء بالأعلی الأعلی ومنه الی الأسفل فی الوجه والیدین"}, {r:283,n:"لو بقی فی الممسوح ما لم یمسح علیه"}, {r:284,n:"مسح اللحم الزائد"}, {r:285,n:"حکم الجبیرة علی الماسح أو الممسوح"}, {r:286,n:"جواز الاستنابة مع تعذر المباشرة"}, {r:287,n:"حکم ما لو کان باطن الیدین نجساً"}, {r:288,n:"حکم الأقطع فی التیمّم"}, {r:289,n:"لو کان علی الباطن نجاسة لها جرم ولا یمکن إزالتها"}, {r:291,n:"الخاتم حائل یجب نزعه ◂ تعیین المبدل عنه ولو إجمالاً عند تعدّد التیمّم"}, {r:292,n:"کفایة قصد ما فی الذمّة من الغایات"}, {r:293,n:"حکم ما لو قصد غایة فانکشف عدمها أو غیرها"}, {r:295,n:"شرطیّة إمرار الماسح علی الممسوح"}, {r:298,n:"کفایة ضربة واحدة للتیمّم بدلاً عن الوضوء والغسل"}, {r:299,n:"الشک بعد الفراغ أو فی الأثناء من التیمّم"}, {r:300,n:"حکم التیمّم إذا علم فوات جزء منه بعد الفراغ ◂ حکم التیمّم قبل الوقت"}, {r:302,n:"الصلاة بالتیمّم السابق لصلاة دخل وقتها ◂ حکم التیمّم فی سعة الوقت"}, {r:304,n:"البدار إلی صلاة اُخری لمن تیمّم لصلاة سابقة"}, {r:305,n:"المراد من آخر الوقت"}, {r:306,n:"التیمّم للصلاة القضائیة والنافلة"}, {r:307,n:"التیمّم بتخیّل ضیق الوقت ◂ إجزاء التیمّم عمّا صلاّه لو زال العذر ◂ موارد استحباب إعادة الصلاة لو زال العذر"}, {r:309,n:"المتیمّم لغایة بحکم الطاهر تشرع له الغایات الاُخر ◂ غایات الوضوء والغسل غایات للتیمّم"}, {r:311,n:"إغناء تیمّم الجنب عن الوضوء"}, {r:312,n:"الأول: الحدث"}, {r:313,n:"الثانی: وجدان الماء ◂ الثالث: زوال العذر"}, {r:314,n:"وجدان الماء فی زمان لا یسع الوضوء أو الغسل ◂ وجدان الماء أثناء الصلاة قبل الرکوع أو بعده"}, {r:315,n:"وجدان الماء أثناء غیر الصلاة من العبادات"}, {r:316,n:"زوال العذر غیر الفقدان ◂ وجدان الماء بعد الرکوع ثمّ فقدانه"}, {r:317,n:"بعض فروع وجدان الماء بعد الرکوع"}, {r:320,n:"صحة صلاة من أتمّها مع وجوب قطعها"}, {r:321,n:"وجدان المتیمّم تیمّمین ما یکفی لأحدهما"}, {r:323,n:"إذا وجد ماء یکفی الغسل أو الوضوء وهو محدث بغیر الجنابة ◂ هل ینقض التیمّم بدل الغسل بالحدث الأصغر"}, {r:325,n:"التداخل فی التیمّمات"}, {r:326,n:"التیمّم بدل أغسال عدیدة أو غسل معین إذا انکشف غیره ◂ إذا تزاحم جُنبٌ ومیّت ومحدث بالأصغر علی الماء"}, {r:328,n:"التیمّم لصلاة منذورة"}, {r:330,n:"استئجار من وظیفته التیمّم للصلاة عن المیت ◂ المجنب المتیمّم مع کون الماء فی المسجد"}, {r:331,n:"لو أمکن الجمع فی سائر الفروض تعیّن"}, {r:332,n:"لو علم بعدم وجدان ما تیمّم به بعد الوقت"}, {r:333,n:"التیمّم لمسّ القرآن"}, {r:335,n:"وجوب إزالة الحاجب عن مواضع التیمّم"}, {r:336,n:"الأحوط فی موارد الحدث الأکبر غیر الجنابة ◂ نقش لفظ الجلالة علی العضو"}],
  bk73: [{r:1,n:"کیفیة الإتیان بالنافلة ◂ مقدمة فی فضل الصلاة ◂ الصلوات الواجبة ◂ الصلوات الیومیة ◂ الرواتب الیومیة"}, {r:2,n:"أعداد النوافل فی یوم الجمعة ◂ سقوط بعض النوافل فی السفر"}, {r:3,n:"استحباب القنوت فی الصلاة"}, {r:4,n:"استحباب صلاة الغفیلة ◂ استحباب صلاة الوصیة"}, {r:5,n:"المراد من الصلاة الوسطی"}, {r:6,n:"جواز التنفّل جالساً"}, {r:7,n:"وقت الظهرین ◂ وقت العشاءین ◂ تعمیم الحکم للساتر وغیره ◂ وقت صلاة الصبح ◂ وقت صلاة الجمعة ◂ أوقات الفضیلة ◂ طرق معرفة الزوال"}, {r:8,n:"المراد بالوقت الاختصاصی"}, {r:9,n:"لو صلّی اللاحقة قبل السابقة ◂ ثمرة القول بالوقت الاختصاصی"}, {r:11,n:"العدول فی الصلاة"}, {r:13,n:"التفریق بین الصلاتین"}, {r:14,n:"للعصر وقت فضیلة ووقتا إجزاء"}, {r:15,n:"استحباب التعجیل فی الصلاة"}, {r:16,n:"استحباب الغَلَس بصلاة الصبح"}, {r:17,n:"من أدرک من الوقت رکعة"}, {r:18,n:"وقت نافلة الظهرین"}, {r:19,n:"تقدیم نافلة الظهرین علی الزوال"}, {r:20,n:"ما یتعلّق بنافلة یوم الجمعة"}, {r:21,n:"وقت نافلة المغرب"}, {r:22,n:"وقت نافلة العشاء"}, {r:23,n:"وقت نافلة الصبح"}, {r:24,n:"دسّ نافلة الصبح فی صلاة اللیل"}, {r:25,n:"وقت نافلة اللیل"}, {r:26,n:"موارد تقدیم صلاة اللیل"}, {r:27,n:"ما یتعلّق بتقدیم صلاة اللیل"}, {r:28,n:"طلوع الفجر أثناء صلاة اللیل"}, {r:30,n:"الموارد المستثناة من استحباب تعجیل الصلاة"}, {r:31,n:"استحباب التعجیل فی قضاء الفرائض"}, {r:32,n:"موارد وجوب تأخیر الصلاة"}, {r:33,n:"التطوّع فی وقت الفریضة"}, {r:34,n:"التطوّع ممّن علیه القضاء ◂ نذر التنفّل وقت الفریضة"}, {r:35,n:"تقسیم النافلة وبعض أحکامها ◂ الأوقات التی تُکره فیها النوافل المبتدأة"}, {r:36,n:"بطلان الصلاة قبل دخول الوقت ◂ شهرة عدم کفایة الظنّ بدخول الوقت"}, {r:37,n:"الاعتماد علی شهادة العدلَین، وکذا علی العارف بالوقت ◂ حکم ما إذا کان غافلاً عن إحراز دخول الوقت وصلّی"}, {r:38,n:"حکم الدخول بالصلاة باعتقاد دخول الوقت ثمّ انکشاف الخطأ"}, {r:39,n:"کفایة الظنّ لغیر المتمکّن من تحصیل الحجّة"}, {r:40,n:"إذا شرع باعتقاد دخول الوقت ثمّ شکّ فیه"}, {r:41,n:"إذا شکّ بعد الدخول فی الصلاة أنّه راعی الوقت أم لا"}, {r:42,n:"الشکّ فی الوقت بعد الفراغ من الصلاة"}, {r:43,n:"حکم الترتیب بین الظهرین والعشاءین"}, {r:44,n:"إذا ترک المغرب ودخل فی العشاء غفلةً"}, {r:45,n:"أحکام العدول من اللاحقة إلی السابقة وبالعکس"}, {r:48,n:"تعیین الوقت المختصّ بالصلاة الاُولی"}, {r:50,n:"ارتفاع العذر عن أداء التکلیف فی آخر الوقت"}, {r:51,n:"ارتفاع العذر فی أثناء الوقت المشترک"}, {r:52,n:"بلوغ الصبیّ أثناء الوقت المشترک"}, {r:53,n:"حکم من أتی بالمستحبّات عند ضیق وقت الواجب"}, {r:54,n:"من أدرک من الوقت رکعةً أو أزید یلزمه ترک المستحبات"}, {r:55,n:"الشکّ فی أثناء العصر أنّه صلّی الظهر أم لا ◂ معنی القبلة ◂ حِجر إسماعیل لیس من القبلة ◂ الکلام أنّ الکعبة عیناً أو جهةً هی القبلة ◂ الکلام فی إحراز المحاذاة والجهة ◂ الکلام فی استعلام القبلة"}, {r:56,n:"وظیفة المتحیّر مع تعذّر الظنّ وسعة الوقت ◂ علامات الظنّ بالقبلة"}, {r:57,n:"وجوب التحرّی مع الجهل بالقبلة"}, {r:59,n:"إخبار صاحب المنزل بالقبلة"}, {r:60,n:"إذا خالف اجتهاده قبلة بلد المسلمین"}, {r:61,n:"إذا انحصرت القبلة فی جهتین وجبت الصلاة إلیهما"}, {r:62,n:"عدم وجوب تکرار التحرّی لکلّ صلاة مع بقاء الظنّ"}, {r:63,n:"تبدّل الظنّ بالقبلة بعد الصلاة أو فی أثنائها"}, {r:65,n:"اقتداء أحد المجتهدَین المختلفَین فی القبلة بالآخر"}, {r:66,n:"إذا لم یقدر علی الاجتهاد أو لم یحصل له الظنّ"}, {r:67,n:"مَن کان علیه صلاتان إلی الجهات الأربع"}, {r:70,n:"مَن صلّی إلی أربع جهات ثمّ علم أو ظنّ بالقبلة"}, {r:71,n:"جریان حکم الصلاة الیومیة علی غیرها فی الاستقبال"}, {r:72,n:"الصلاة من غیر فحص عن القبلة"}, {r:73,n:"الأوّل: الصلاة الواجبة وتوابعها والنافلة مع الاستقرار ◂ کیفیة الاستقبال فی الصلاة ◂ الثانی والثالث: المیّت حال الاحتضار والصلاة والدفن ◂ الرابع والخامس: الحیوان حال الذبح والنحر"}, {r:74,n:"ما یحرم من الاستقبال وما یستحب"}, {r:76,n:"ما یکره من الاستقبال"}, {r:77,n:"حکم مَن أخلّ بالاستقبال عالماً عامداً، ومَن أخلّ به عن غیر عمد"}, {r:78,n:"انکشاف الخلل أثناء الصلاة ◂ حکم مَن کان منحرفاً إلی الیمین والیسار أو إلی الاستدبار ◂ الإخلال بالاستقبال فی الذبح والنحر"}, {r:79,n:"الدفن إلی غیر القبلة ◂ وجوب ستر العورتین مطلقاً إلاّ ما استُثنی"}, {r:80,n:"وجوب ستر المرأة بدنها عن غیر المحارم ◂ حکم الوجه والکفّین ستراً ونظراً ◂ حرمة النظر مع التلذّذ بلا استثناء ◂ ستر الشعر المستعار والحُلِیّ"}, {r:81,n:"النظر إلی ما یحرم بالمرآة ونحوها"}, {r:82,n:"شرطیة الستر الواجب ◂ کیفیة الستر الواجب فی الصلاة للرجل والمرأة"}, {r:83,n:"أحکام ستر الباطن والزینة والوجه والرقبة فی صلاة المرأة"}, {r:84,n:"أحکام الستر فی صلاة الأمة ومقداره"}, {r:87,n:"الصبیة غیر البالغة کالأمة"}, {r:88,n:"عموم شرطیة الستر لأنواع الصلاة وتوابعها"}, {r:89,n:"شرطیة الستر فی الطواف"}, {r:90,n:"ظهور العورة أثناء الصلاة"}, {r:91,n:"إذا نسی ستر العورة فی الصلاة"}, {r:92,n:"وجوب الستر من جمیع الجوانب ◂ هل یجب علی المصلّی التستّر عن نفسه؟"}, {r:94,n:"ما یعتبر فی الساتر الصلاتی"}, {r:96,n:"الأوّل: الطهارة ◂ الثانی: الإباحة ◂ نسیان غصبیة الساتر أو الجهل بها"}, {r:97,n:"فروع اعتبار الإباحة فی الساتر الصلاتی"}, {r:105,n:"الثالث: أن لا یکون من أجزاء المیتة وإن کان محلّل الأکل ◂ تعمیم الحکم لما کانت میتته طاهرة ◂ الصلاة فیما یشکّ کونه من المذکّی ◂ ما یؤخذ من مسلم یستحلّ المیتة بالدبغ ◂ ما یؤخذ من ید الکافر أو مجهول الحال"}, {r:106,n:"حکم المأخوذ من المسلم بعد أخذه من الکافر ◂ استصحاب جزءٍ من المیتة فی الصلاة"}, {r:107,n:"الصلاة فی المیتة جهلاً أو نسیاناً"}, {r:108,n:"الصلاة فیما یشکّ کونه من جلد الحیوان ◂ الرابع: أن لا یکون من أجزاء مالا یؤکل لحمه"}, {r:109,n:"شمول الحکم لغیر ذی النفس السائلة ◂ لا بأس بفضلات الحیوانات التی لا لحم لها عند الصلاة"}, {r:110,n:"استثناء فضلات الإنسان من عرقه وشعره ونحوهما"}, {r:111,n:"تعمیم المنع للملبوس والمحمول"}, {r:112,n:"الصلاة فی الخزّ الخالص"}, {r:113,n:"الصلاة فی جلد السِنجاب ◂ الصلاة فی السَمُّور والقاقُم والفَنَک والحواصل ◂ الصلاة فی اللباس المشکوک کونه ممّا یؤکل"}, {r:114,n:"الصلاة فی غیر المأکول جهلاً أو نسیاناً"}, {r:115,n:"تعمیم المنع للمحرّم أکله بالأصل أو بالعارض ◂ الخامس: أن لا یکون من الذهب للرجال ◂ موارد صدق عنوان لبس الذهب وعدمه ◂ جواز حمل الذهب فی الصلاة ◂ شدّ الأسنان بالذهب ◂ حمل السلاح المحلّی بالذهب وحکم الصلاة فیه ◂ لا بأس بالذهب للمرأة والصبیّ الممیِّز"}, {r:116,n:"الصلاة فیما یشکّ فی کونه ذهباً"}, {r:117,n:"الصلاة فی الذهب جهلاً أو نسیاناً"}, {r:118,n:"حکم قاب الساعة وزنجیرها المتّخذ من الذهب"}, {r:119,n:"لا فرق فی لبس الذهب بین الظاهر والمستور"}, {r:120,n:"بعض فروع استعمال الذهب ◂ السادس: أن لا یکون حریراً محضاً للرجال ◂ حکم ما لا تتمّ الصلاة فیه إذا کان حریراً"}, {r:121,n:"حرمة لبس الحریر فی غیر الصلاة إلاّ لضرورة أو حرب ◂ لبس النساء للحریر والصلاة فیه ◂ لبس الخنثی للحریر والصلاة فیه ◂ لبس الحریر الممتزج بغیره والصلاة فیه ◂ الثوب المکفوف بالحریر المحض ◂ حمل الحریر فی الصلاة ◂ استعمال الحریر فی غیر اللبس"}, {r:122,n:"فروع فی سائر انحاء اللبس والملبوس من الحریر"}, {r:124,n:"لبس الحریر حال الضرورة"}, {r:127,n:"الصلاة فی الحریر جهلاً أو نسیاناً"}, {r:128,n:"اشتراط کون الخلیط ممّا تصحّ فیه الصلاة"}, {r:129,n:"الصلاة فی ممنوعِ أو مشکوکِ الصحّة"}, {r:131,n:"انحصار الثوب بما لا تصحّ الصلاة فیه"}, {r:134,n:"التاسع: عدم کون المسجد أعلی أو أسفل من موضع القدم ◂ الاضطرار إلی لبس النجس أو نحوه"}, {r:135,n:"لبس وإلباس الصبیّ الحریر وحکم صلاته فیه"}, {r:136,n:"وجوب تحصیل الساتر الصلاتی"}, {r:137,n:"حکم لباس الشهرة"}, {r:138,n:"لبس الرجل والمرأة ما یختصّ بالآخر ◂ صلاة الفاقد للساتر الصلاتی"}, {r:139,n:"کیفیة صلاة العاری ◂ وجدان العاری ما یستر إحدی عورتَیه"}, {r:140,n:"مشروعیة صلاة العُراة جماعةً"}, {r:142,n:"تأخیر الصلاة مع فقد الساتر ◂ العلم إجمالاً بمانعیّة أحد الثوبین"}, {r:143,n:"صلاة المستلقی أو المضطجع بالنجس والحریر ونحوهما"}, {r:144,n:"هل تصحّ الصلاة فی ثوبٍ طویلٍ جدّاً من النجس أو الحریر أو نحوهما؟"}, {r:145,n:"الصلاة فیما یستر ظهر القدم دون الساق"}, {r:146,n:"الاُولی: الثوب الأسود عدا ما استثنی ◂ بقیة مکروهات اللباس ◂ سائر المکروهات مثل الخضاب و"}, {r:148,n:"الأوّل: الإباحة؛ فلا تصحّ فی المکان المغصوب ◂ تعریف مکان المصلّی ◂ شروط مکان المصلّی ◂ الصلاة فی مکان تعلّق لحقّ الغیر ◂ الصلاة فی المغصوب غافلاً أو ناسیاً أو جاهلاً ◂ فروع الصلاة فی المغصوب"}, {r:153,n:"صلاة المحبوس فی المکان المغصوب"}, {r:154,n:"إذا اعتقد الغصبیة وصلّی فتبیّن الخلاف ◂ إذا اعتقد الإباحة وصلّی فتبیّن الخلاف"}, {r:155,n:"الصلاة فی المغصوب مع الجهل بحرمته"}, {r:156,n:"الصلاة فی الأرض المغصوبة المجهول مالکها ◂ شرطیة الإذن بالتصرّف فی المال المشترک بین الشرکاء"}, {r:157,n:"حکم الشراء من المال غیر المزکّی وغیر المخمّس"}, {r:159,n:"حکم التصرّف فی ترکة المیّت إذا تعلّق بها حقّ الغیر"}, {r:160,n:"حکم التصرّف فی الترکة مع الدین المستغرق"}, {r:161,n:"طرق إحراز الإذن فی التصرّف"}, {r:162,n:"حکم الصلاة فی الأراضی المتّسعة"}, {r:163,n:"الصلاة فی بیوت من تضمّنت الآیة جواز الأکل فیها"}, {r:164,n:"وجوب الخروج من المکان المغصوب"}, {r:165,n:"حکم مَن دخل فی المغصوب جهلاً ثمّ التفت"}, {r:166,n:"رجوع المالک عن إذنه قبل الشروع فی الصلاة أو فی أثنائها"}, {r:167,n:"إذا کان الإذن من باب الخوف أو غیره"}, {r:168,n:"دوران الأمر بین الصلاة بتمامها فی حال الخروج أو بعده مع إدراک رکعة من الوقت ◂ الثانی من شروط المکان: کونه قارّاً ◂ حکم الصلاة علی الدابّة ونحوها"}, {r:169,n:"حکم الصلاة فی السفینة"}, {r:170,n:"الصلاة علی مثل صُبرة الحنطة والرَمل مع عدم الاستقرار ◂ الثالث: أن لا یکون معرضاً للقطع ◂ الرابع: أن لا یکون ممّا یحرم البقاء فیه ◂ الخامس: أن لا یکون ممّا یحرم الکون علیه ◂ السادس: أن یکون ممّا یمکن أداء الأفعال فیه ◂ السابع: أن لا یکون متقدّماً علی قبر المعصوم علیه السلام ولا مساویاً له ◂ الثامن: خلوّ المکان من نجاسة متعدّیة ◂ العاشر: عدم تقدّم المرأة أو محاذاتها للرجل"}, {r:171,n:"الاُمور التی ترفع المنع أو الکراهة فی المحاذاة ◂ تعمیم الحکم للمحارم وغیرهم، والکلام فی غیر البالغ"}, {r:172,n:"تعمیم الحکم للنافلة"}, {r:173,n:"اختصاص الحکم بحال الاختیار"}, {r:174,n:"اختصاص الحکم بصورة الاشتغال بالصلاة"}, {r:175,n:"حکم الصلاة علی سطح الکعبة وفی جوفها"}, {r:176,n:"اشتراط کون مسجد الجبهة من الأرض أو ما أنبتته غیر المأکول والملبوس ◂ عدم جواز السجود علی ما خرج عن اسم الأرض کبعض المعادن ◂ عدم جواز السجود علی ما خرج عن اسم النبات کالرماد والفحم ◂ عدم جواز السجود علی المأکول والملبوس ◂ جملة ممّا یتعلّق به المنع والجواز فی المقام"}, {r:186,n:"السجود علی ما یؤکل فی بعض الأوقات والبلدان"}, {r:187,n:"بقیة ما یتعلّق به المنع والجواز من موارد السجود"}, {r:197,n:"السجود علی القرطاس بأنواعه"}, {r:198,n:"الکلام فی الأبدال إذا فُقِدَ ما یصحّ السجود علیه"}, {r:199,n:"اشتراط تمکین الجبهة علی ما یسجد علیه"}, {r:200,n:"کیفیة الصلاة فی الأرض الطینیة"}, {r:201,n:"أفضلیة السجود علی الأرض من غیرها خصوصاً تربة الحسین علیه السلام"}, {r:202,n:"فقد ما یصحّ السجود علیه أثناء الصلاة"}, {r:203,n:"السجود علی ما لا یجوز باعتقاد أنّه ممّا یجوز"}, {r:204,n:"أحدها: الحمّام وإن کان نظیفاً ◂ بقیة المواضع المکروهة ◂ حکم الصلاة فی البِیَع والکنائس"}, {r:205,n:"الصلاة عند قبور الأئمة علیهم السلام"}, {r:207,n:"جعل المصلّی سترة بین یدیه ◂ المواضع التی تستحب الصلاة فیها"}, {r:209,n:"استحباب تفریق الصلاة فی أماکن ◂ کراهة صلاة جار المسجد فی غیره"}, {r:210,n:"استحباب الصلاة فی مسجد لا یصلّی فیه"}, {r:212,n:"استحباب کثرة التردّد إلی المساجد"}, {r:213,n:"استحباب بناء المسجد"}, {r:214,n:"إجراء صیغة الوقف"}, {r:215,n:"جواز جعل الأرض مسجداً دون البناء"}, {r:216,n:"استحباب تعمیر المسجد وجواز تجدید بنائه"}, {r:217,n:"زخرفة المسجد ونقشه بالصور ◂ بیع المسجد وبیع آلاته ◂ عدم خروج المسجد عن المسجدیة بخرابه ◂ تنجیس المسجد وما یعود إلیه من الأحکام ◂ جواز جعل الکنیف مسجداً وکیفیته ◂ إخراج الحصی وما یجتمع بالکَنسِ من المسجد ◂ الدفن فی المسجد ◂ استحباب السبق إلی المسجد ◂ بقیة أحکام المساجد ◂ مکروهات المسجد"}, {r:218,n:"تفضیل صلاة المرأة فی بیتها"}, {r:219,n:"تفضیل إتیان النوافل فی المنازل"}, {r:220,n:"استحباب الأذان والإقامة فی الفرائض الیومیة ◂ تأکّد استحباب الإقامة للرجال إلاّ فی موارد ◂ اختصاص الأذان والإقامة بالفرائض الیومیة ◂ موارد استحباب الأذان فی غیر الصلاة ◂ انقسام الأذان إلی أذان الصلاة وأذان الإعلام ◂ فصول الأذان والإقامة ◂ استحباب الصلاة علی النبیّ صلی الله علیه و آله عند ذکر اسمه المبارک ◂ الشهادة الثالثة فی الأذان والإقامة ◂ حکم التکرار فی بعض فصول الأذان ◂ اجتزاء المرأة عن الأذان بالتکبیر والشهادتین ◂ أذان المسافر والمستعجل ◂ ما یکره فی الأذان والإقامة ◂ موارد سقوط الأذان، وأنّه رخصة أم عزیمة"}, {r:221,n:"عدم تأکّد الأذان للفوائت فی دور واحد"}, {r:222,n:"موارد سقوط الأذان والإقامة"}, {r:223,n:"استحباب حکایة الأذان عند سماعه وکذا الإقامة"}, {r:224,n:"حکایة الأذان فی الصلاة"}, {r:225,n:"فروع فی سماع الأذان والإقامة"}, {r:230,n:"الأوّل: النیّة ابتداءً واستدامةً ◂ الثانی: العقل والإیمان ◂ أذان الصبیّ ◂ الکلام فی اعتبار الذکوریة ◂ الثالث: الترتیب بین الأذان والاقامة وبین فصولهما ◂ الرابع: الموالاة فی الأذان والإقامة ◂ الخامس: العربیة مع عدم اللحن ◂ السادس: دخول الوقت ◂ تقدیم الأذان قبل الفجر ◂ السابع: الطهارة من الحدث فی الإقامة ◂ الشکّ فی الأذان والإقامة"}, {r:231,n:"الأوّل: الاستقبال ◂ الثانی: القیام ◂ الثالث: الطهارة فی الأذان ◂ الرابع: عدم التکلّم فی أثنائهما ◂ الخامس: الاستقرار فی الإقامة ◂ السادس: الجزم فی أواخر فصولهما، مع التأنّی فی الأذان والحدر فی الإقامة ◂ السابع: الإفصاح بالألف والهاء من لفظ الجلالة ◂ الثامن: وضع الإصبعین فی الاُذُنین فی الأذان ◂ التاسع: مدّ الصوت فی الأذان ورفعه فیهما ◂ العاشر: الفصل بین الأذان والإقامة ◂ ما یستحب قوله فی السجدة والخطوة والقعدة بعد الأذان"}, {r:232,n:"ما یستحب لمن سمع الشهادتین من المؤذِّن"}, {r:233,n:"ما یستحب فی المنصوب للأذان"}, {r:234,n:"حکم من ترک الإقامة والأذان عمداً حتّی أحرم للصلاة ◂ نسیان الأذان والإقامة"}, {r:235,n:"الاکتفاء بأحدهما فیما جاز له ترک الإقامة"}, {r:236,n:"النوم والارتداد فی أثناء الأذان والإقامة"}, {r:237,n:"لو أذّن منفرداً وأقام ثمّ بدا له الإقامة"}, {r:238,n:"الحدث أثناء الأذان أو الإقامة"}, {r:239,n:"أخذ الاُجرة علی أذان الصلاة"}, {r:240,n:"اللحن فی أذان الإعلام"}],
  bk74: [{r:1,n:"الصلوات الواجبة ◂ تعداد واجبات الصلاة وبیان الأرکان منها ◂ کفایة الداعی دون الزائد علیه ◂ درجات غایات الامتثال"}, {r:2,n:"وجوب تعیین العمل لو کان ما علیه فعلاً متعدّداً"}, {r:3,n:"عدم وجوب قصد الأداء والقضاء إلاّ مع توقّف التعیین علی أحدهما"}, {r:4,n:"جواز العدول فی أماکن التخییر بین القصر والتمام"}, {r:5,n:"کفایة القصد الإجمالی للشروع فی الصلاة"}, {r:6,n:"عدم منافاة نیّة الوجوب اشتمال الصلاة علی المندوب"}, {r:7,n:"مرجوحیّة التلفّظ بالنیّة"}, {r:8,n:"من لا یعرف الصلاة علیه الأخذ بالتلقین"}, {r:9,n:"شرطیة الخلوص من الریاء فی النیّة ◂ وجوه تحقّق الریاء: ◂ الأول: قصد الریاء محضاً ◂ الثالث: الریاء فی الأجزاء الواجبة ◂ الثانی: ضمّ الریاء إلی القربة ◂ الرابع: الریاء فی الأجزاء المستحبّة ◂ الخامس: الریاء من حیث المکان ◂ السادس: الریاء من حیث الزمان ◂ السابع: الریاء فی أوصاف العمل ◂ الثامن: الریاء فی مقدمات العمل ◂ التاسع: الریاء فی ما هو خارج عن الصلاة ◂ العاشر: الصلاة بحیث یعجبه أن یراه الناس"}, {r:10,n:"الریاء المتأخّر عن العبادة لا یوجب البطلان"}, {r:11,n:"حکم العُجب المتأخّر فی الصلاة"}, {r:12,n:"حکم الضمائم من غیر الریاء"}, {r:13,n:"أنحاء الضمیمة إلی داعی القربة ◂ حکم ما یؤتی به بقصد الصلاة وغیرها"}, {r:14,n:"انضمام داعی إعلام الغیر إلی داعی الصلاة"}, {r:15,n:"وقت نیّة ابتداء الصلاة"}, {r:16,n:"وجوب استدامة النیّة إلی آخر الصلاة"}, {r:17,n:"حکم نیّة القطع أو القاطع أثناء الصلاة"}, {r:18,n:"لو نوی المکلّف صلاةً فسبق لسانه أو خیاله خطوراً إلی غیرها"}, {r:19,n:"وقوع صحّة الصلاة علی ما افتُتِحَت علیه"}, {r:20,n:"حکم الشکّ فی تعیین الفریضة"}, {r:21,n:"موارد جواز العدول من صلاة إلی اُخری: ◂ أولها: العدول من الحاضرة إلی الحاضرة ◂ الثانی: العدول من الفائتة إلی الفائتة ◂ الثالث: العدول من الحاضرة إلی الفائتة ◂ الرابع: العدول من الجمعة إلی النافلة لمن قرأ غیر سورة الجمعة ◂ الخامس: العدول من الفریضة إلی النافلة لإدراک الجماعة ◂ السادس: العدول من الجماعة إلی الانفراد ◂ السابع: العدول من إمام إلی إمامٍ آخر ◂ الثامن: العدول من القصر إلی التمام ◂ التاسع: العدول من التمام إلی القصر ◂ العاشر: العدول من القصر إلی التمام أو العکس فی مواطن التخییر"}, {r:22,n:"عدم جواز العدول من الفائتة إلی الحاضرة"}, {r:23,n:"حکم العدول من النفل إلی الفرض أو إلی نفلٍ آخر"}, {r:24,n:"عدم جواز العدول فی موضع لا یجوز العدول فیه"}, {r:25,n:"العدول من الظهر إلی العصر"}, {r:26,n:"حکم العدول فی غیر موضع العدول خطأً"}, {r:27,n:"عدم البأس بترامی العدول"}, {r:28,n:"العدول بعد الفراغ من الصلاة"}, {r:29,n:"کفایة النیّة فی تحقّق العدول"}, {r:30,n:"بلوغ حدّ الترخّص أثناء الصلاة"}, {r:31,n:"إذا عیّن صلاةً ثمّ تبیّن أنّ ما فی ذمّته صلاةً اُخری"}, {r:32,n:"الخطأ فی قصد عنوان الرکعات فی النوافل"}, {r:33,n:"رکنیة التکبیر ◂ حکم ترک التکبیرة وزیادتها أو نقصانها ◂ الإتیان بتکبیرة أثناء الصلاة لصلاةٍ اُخری نسیاناً ◂ لزوم الإتیان بتکبیرة الإحرام مجرّدةً بلا وصل ◂ التکبیر بغیر الکیفیة المعهودة"}, {r:35,n:"اعتبار القیام والاستقرار فی تکبیرة الإحرام"}, {r:37,n:"أدنی ما یتحقّق به التلفّظ"}, {r:38,n:"وجوب تعلّم التکبیرة"}, {r:39,n:"کیفیة التکبیر من الأخرس"}, {r:40,n:"حکم التکبیرات المندوبة کحکم تکبیرة الإحرام"}, {r:41,n:"صحّة صلاة من ترک التعلّم فی سعة الوقت"}, {r:42,n:"استحباب الإتیان بستِّ تکبیرات سوی تکبیرة الإحرام واختیار الأخیرة ◂ عموم استحباب الافتتاح، والقول بالاختصاص بمواضع"}, {r:43,n:"الجمع بین محتملات مسألة تعیین تکبیرة الإحرام"}, {r:44,n:"کیفیة الافتتاح بالسبع وصیغها"}, {r:45,n:"استحباب جهر الإمام بتکبیرة الإحرام"}, {r:46,n:"استحباب رفع الیدین حال التکبیر"}, {r:48,n:"حکم الشکّ فی تکبیرة الإحرام"}, {r:49,n:"التعریف بأقسام القیام ◂ القیام حال التکبیرة، والمتّصل بالرکوع واجب رکنی ◂ القیام حال القراءة وبعد الرکوع واجب غیر رکنی ◂ القیام المستحبّ والمباح ◂ حکم القیام حال تکبیرة الإحرام وقبلها وبعدها"}, {r:50,n:"حکم القیام حال القراءة والتسبیحات"}, {r:51,n:"المراد من استحبابیة القیام حال القنوت"}, {r:52,n:"حکم نسیان القیام حال القراءة"}, {r:53,n:"المراد من القیام المتّصل بالرکوع"}, {r:54,n:"الکلام فی زیادة القیام"}, {r:55,n:"الشکّ فی القیام بعد تجاوزه"}, {r:56,n:"ما یعتبر فی القیام"}, {r:57,n:"الإخلال بشرائط القیام نسیاناً"}, {r:59,n:"حکم الاعتماد علی إحدی الرجلین حال القیام"}, {r:60,n:"حکم الاعتماد والمعتمد علیه فی حال الاضطرار"}, {r:61,n:"مقدّمیة القیام الاضطراری بأقسامه علی الجلوس"}, {r:63,n:"حکم العاجز عن القیام أو الجلوس أو الاستلقاء"}, {r:64,n:"حکم المتمکّن من القیام والعاجز عن الرکوع قائماً أو السجود"}, {r:65,n:"الحکم فی ترک القیام أوترک الرکوع والسجود"}, {r:66,n:"دوران الأمر بین الصلاة قائماً ماشیاً أو جالساً"}, {r:67,n:"فی مَن کانت وظیفته الجلوس وأمکنه القیام للرکوع"}, {r:68,n:"حکم القادر علی القیام فی بعض الرکعات أو الرکعة"}, {r:69,n:"مقدّمیة المشی أوالرکوب حال الصلاة للعجز عن القیام"}, {r:70,n:"مظنّة التمکّن من القیام فی آخر الوقت"}, {r:71,n:"حکم التمکّن من القیام مع خوف المرض أو بط ء برئه"}, {r:72,n:"الحکم بین مراعاة الاستقبال ومراعاة القیام"}, {r:73,n:"حکم تجدّد العجز عن القیام فی أثناء الصلاة"}, {r:74,n:"حکم تجدّد القدرة علی القیام فی أثناء الصلاة"}, {r:76,n:"لو رکع قائماً ثمّ عجز عن القیام"}, {r:77,n:"اعتبار الاستقرار فی أفعال الصلاة وأذکارها"}, {r:78,n:"حکم العاجز عن السجود"}, {r:79,n:"کیفیة الجلوس للمصلی جالساً"}, {r:80,n:"مستحبّات القیام"}, {r:81,n:"ما یجب قراءته فی صلاة الفرائض ◂ حکم القراءة"}, {r:82,n:"حکم قراءة ما یفوت الوقت"}, {r:83,n:"حکم قراءة سور العزائم"}, {r:84,n:"حکم قراءة آیة السجدة"}, {r:85,n:"حکم قراءة السور فی النوافل"}, {r:86,n:"حکم قراءة العزائم فی النوافل"}, {r:87,n:"ما هی سور العزائم"}, {r:88,n:"حکم البسملة فی السور"}, {r:89,n:"ما حکم السور المتحدة"}, {r:90,n:"قراءة أکثر من سورة فی الفرائض"}, {r:91,n:"ما حکم تعیین السورة"}, {r:92,n:"ما حکم تعیین البسملة للسورة"}, {r:96,n:"حکم العدول فی السور حال الصلاة"}, {r:100,n:"حکم الجهر فی القراءة للرجل"}, {r:101,n:"الجهر بالبسملة فی الظهرین"}, {r:102,n:"حکم الجهر فی موضع الإخفات وبالعکس"}, {r:103,n:"صور الجهل بالحکم جهراً وإخفاتاً"}, {r:104,n:"حکم الناسی أو الجاهل للقراءة قبل الرکوع"}, {r:105,n:"سقوط الجهر عن النساء"}, {r:106,n:"ما المناط فی صدق الجهر والإخفات"}, {r:107,n:"کیفیة صدق القراءة"}, {r:108,n:"حکم غیر الحافظ للقراءة"}, {r:110,n:"قراءة العاجز عن القراءة"}, {r:111,n:"حکم قراءة الأخرس"}, {r:112,n:"فی وجوب تعلّم القراءة"}, {r:113,n:"حکم الائتمام مع العجز عن تعلّم القراءة"}, {r:114,n:"حکم من ضاق وقته عن التعلّم"}, {r:115,n:"حکم من لم یعلم شیئاً من القرآن ◂ حکم أخذ الاُجرة علی تعلیم الصلاة"}, {r:116,n:"حکم الترتیب والموالاة فی القراءة"}, {r:117,n:"الإخلال بالکلمات والحروف والحرکات"}, {r:119,n:"حکم الوقف بالحرکة والوصل بالسکون"}, {r:120,n:"مراعاة مخارج الحروف"}, {r:122,n:"المدّ الواجب ومورده"}, {r:125,n:"حکم الفصل بین حروف الکلمة"}, {r:126,n:"انقطاع النَفَس أثناء القراءة"}, {r:128,n:"مواضع الإدغام"}, {r:129,n:"القراءة بإحدی القراءات السبع"}, {r:131,n:"الحروف الشمسیة والقمریة"}, {r:141,n:"حکم من نسی الحمد فی الرکعتین الاُولتین"}, {r:142,n:"أفضلیّة التسبیحات علی القراءة"}, {r:143,n:"حکم القراءة فی الأخیرتین"}, {r:144,n:"حکم الإخفات فی الأخیرتین"}, {r:145,n:"العدول من القراءة إلی التسبیح وبالعکس"}, {r:148,n:"قراءة الحمد بتخیّل أنّه فی الاُولیین"}, {r:149,n:"حکم نسیان القراءة والتسبیحات قبل الرکوع"}, {r:150,n:"الشکّ فی التسبیح بعد الهویّ للرکوع"}, {r:151,n:"فی حکم زیادة التسبیحات علی الثلاث"}, {r:152,n:"قصد القربة فی التسبیحات"}, {r:153,n:"الأول: الاستعاذة ◂ الثانی: الجهر بالبسملة ◂ الثالث: الترتیل ◂ الرابع: تحسین الصوت ◂ الخامس: الوقف علی فواصل الآیات ◂ السادس: ملاحظة المعانی والاتّعاظ بها ◂ السابع: السؤال عند آیة النعمة والنقمة بما یناسبهما ◂ الثامن: السکتة بین الحمد والسورة، وکذا بعد السورة ◂ التاسع: قراءة المأثور بعد التوحید والفاتحة ◂ العاشر: قراءة بعض السور المخصوصة فی بعض الصلوات ◂ استحباب قراءة بعض السور فی صلاة ◂ کراهة ترک سورة التوحید فی جمیع الفرائض"}, {r:154,n:"کراهة قراءة التوحید بنَفَسٍ واحد، وکذا الحمد"}, {r:155,n:"کراهة قراءة سورة واحدة فی الرکعتین إلاّ التوحید"}, {r:156,n:"جواز تکرار الآیة فی الفریضة وغیرها والبکاء"}, {r:157,n:"استحباب إعادة الجمعة أو الظهر فی یوم الجمعة إذا لم یقرأهما"}, {r:158,n:"قراءة المعوّذتین فی الصلاة"}, {r:159,n:"عدد آیات الحمد والتوحید"}, {r:160,n:"قصد الإنشاء والقرآن حین القراءة"}, {r:161,n:"الاستقرار حال القراءة"}, {r:162,n:"استحباب الصلاة علی النبی عند سماع اسمه حین القراءة"}, {r:163,n:"حکم القراءة فی الحرکة القهریّة"}, {r:164,n:"حکم الشکّ فی صحّة قراءة آیة أو کلمة"}, {r:165,n:"الاقتصار علی تسبیحة واحدة عند الضیق"}, {r:169,n:"حکم الرکوع فی الصلاة ◂ واجبات الرکوع ◂ الأوّل: الانحناء ◂ الثانی: الذِکر ◂ الثالث: الطمأنینة ◂ الرابع: الانتصاب بعد الرکوع ◂ الخامس: الطمأنینة حال القیام من الرکوع"}, {r:170,n:"عدم وجوب وضع الیدین علی الرکبتین ◂ العجز عن الانحناء للرکوع"}, {r:171,n:"حکم الرکوع جالساً مع الانحناء وقائماً مُومِئاً"}, {r:172,n:"التمکّن من الرکوع الاختیاری بعد العجز"}, {r:173,n:"زیادة الرکوع الجلوسی أو الإیمائی"}, {r:174,n:"حکم من کان کالراکع خلقةً أو بالعارض"}, {r:175,n:"اعتبار قصد الرکوع فی الانحناء"}, {r:176,n:"حکم الناسی للرکوع قبل السجود"}, {r:178,n:"حدّ الانحناء فی رکوع المرأة"}, {r:179,n:"فی ما یکتفی به من الذِکر فی الرکوع"}, {r:180,n:"زیادة الذکر علی المرّة"}, {r:181,n:"کفایة التسبیحة الصغری"}, {r:182,n:"عدم جواز الشروع فی الذکر قبل الرکوع والاطمئنان"}, {r:183,n:"سقوط الطمأنینة عن العاجز"}, {r:184,n:"حکم ترک الطمأنینة فی الرکوع"}, {r:185,n:"فی الجمع بین التسبیحة الصغری و الکبری"}, {r:186,n:"العدول من التسبیحة الصغری إلی الکبری، وبالعکس"}, {r:187,n:"شرائط ذکر الرکوع"}, {r:189,n:"التحرّک قهراً فی حال الذکر"}, {r:190,n:"حکم التنقّل بین مراتب الانحناء"}, {r:192,n:"الشکّ فی لفظ «العظیم»"}, {r:193,n:"کیفیّة الرکوع الجلوسی"}, {r:194,n:"مستحبّات الرکوع: ◂ الأوّل: التکبیر للرکوع فی حال الانتصاب ◂ الثانی: رفع الیدین حال التکبیرة ◂ الثالث: وضع الکفّین علی الرکبتین ◂ الرابع: ردّ الرکبتین إلی الخلف ◂ الخامس: تسویة الظهر ◂ السادس: مدّ العنق ◂ السابع: أن یکون نظره بین قدمیه ◂ الثامن: التجنیح ◂ التاسع: وضع الید الیمنی علی الرکبة قبل الید الیسری ◂ العاشر: وضع المرأة یدیها علی فخذیها فوق الرکبتین ◂ الحادی عشر: تکرار التسبیح ثلاثاً ◂ الثانی عشر: الخَتم علی وَتر ◂ الثالث عشر: الدعاء قبل الذکر بالمأثور ◂ الرابع عشر: الدعاء بعد الانتصاب منه بالمأثور ◂ الخامس عشر: رفع الیدین للانتصاب منه ◂ السادس عشر: الصلاة علی النبی6 بعد الذکر أو قبله ◂ مکروهات الرکوع:"}, {r:195,n:"الأول: أن یطأطئ رأسه ◂ الثانی: یضمّ یدیه إلی جنبیه ◂ الثالث: أن یضع إحدی الکفّین علی الاُخری ویدخلهما بین رکبتیه ◂ الرابع: قراءة القرآن فیه ◂ الخامس: أن یجعل یدیه تحت ثیابه ملاصقاً لجسده"}, {r:196,n:"اتّحاد النافلة مع الفریضة فی أحکام الرکوع"}, {r:197,n:"حقیقة السجود وأقسامه ورکنیّته ◂ واجبات السجود: ◂ الأول: وضع المساجد السبعة علی الأرض ◂ الثانی: الذکر ◂ الثالث: الطمأنینة ◂ الرابع: رفع الرأس منه ◂ الخامس: الجلوس بعد السجدة الأولی وبعده ◂ السادس: کون المساجد السبعة فی محالّها ◂ السابع: مساواة موضع الجبهة للموقف ◂ الثامن: وضع الجبهة علی ما یصحّ السجود علیه ◂ التاسع: طهارة محلّ وضع الجبهة ◂ العاشر: المحافظة علی العربیة والموالاة والترتیب فی الذکر ◂ تحدید الجبهة وموضع السجود"}, {r:198,n:"اعتبار مباشرة الجبهة حال السجود"}, {r:199,n:"اشتراط وضع الکفّین علی الأرض اختیاراً"}, {r:201,n:"إجزاء وضع مسمّی الرکبتین، وتحدید الرکبة"}, {r:202,n:"وضع طرفَی الإبهامین وما بحکمها"}, {r:203,n:"الاعتماد علی الأعضاء السبعة حال السجود"}, {r:204,n:"کیفیة السجود وتفصیله"}, {r:205,n:"حکم وضع الجبهة علی موضع مرتفع"}, {r:206,n:"حکم ما لو وضعت الجبهة علی ما لا یصحّ السجود علیه"}, {r:207,n:"حکم تعذّر السجود علی الجبهة"}, {r:208,n:"فی ما لو عجز عن الانحناء أو وضع بعض الأعضاء للسجود"}, {r:209,n:"حکم ما لو حرّک إبهامه او باقی المساجد فی حال الذکر"}, {r:211,n:"حکم السجود علی غیر الأرض"}, {r:212,n:"حکم ما لو نسی السجدتین أو إحداهما"}, {r:213,n:"حکم ما لا تستقرّ علیه المساجد"}, {r:214,n:"حکم العاجز عن الانحناء بین وضع الیدین علی الأرض ووضع المسجد علی الجبهة"}, {r:215,n:"الاُمور المستحبة حال السجود: ◂ الأول: التکبیر حال الانتصاب من الرکوع قائماً أو قاعداً ◂ الثانی: رفع الیدین حال التکبیر ◂ الثالث: السبق بالیدین إلی الأرض عند الهویّ ◂ الرابع: استیعاب الجبهة للمسجد ◂ الخامس: الإرغام بالأنف ◂ السادس: بسط الیدین مضمومَتَی الأصابع ◂ السابع: شغل النظر إلی طرف الأنف حال السجود ◂ الثامن: الدعاء قبل الشروع فی الذِکر ◂ التاسع: تکرار الذِکر ◂ العاشر: الخَتم علی الوَتر ◂ الحادی عشر: اختیار التسبیح من الذِکر ◂ الثانی عشر: السجود علی الأرض ◂ الثالث عشر: المساواة بین موضع الجبهة والموقف ◂ الرابع عشر: الدعاء فی السجود ◂ الخامس عشر: التورّک فی الجلوس ◂ السادس عشر: القول بین السجدتین: «أستغفر اللّه ربّی وأتوب إلیه» ◂ السابع عشر: التکبیر بعد السجدة الاُولی وقبل الثانیة ◂ الثامن عشر: التکبیر بعد الرفع من الثانیة کذلک ◂ التاسع عشر: رفع الیدین حال التکبیرات ◂ العشرون: وضع الیدین علی الفخذین حال الجلوس ◂ الحادی والعشرون: التجافی حال الجلوس ◂ الثانی والعشرون: التجنُّح ◂ الثالث والعشرون: الصلاة علی النبی وآله فی السجدتین ◂ الرابع والعشرون: أن یقوم سابقاً برفع رکبتیه قبل یدیه ◂ الخامس والعشرون: القول بین السجدتین: «اللهمّ اغفرلی وارحمنی...» ◂ السادس والعشرون: القول عند النهوض للقیام: «بحول اللّه وقوّته...» ◂ السابع والعشرون: عدم العجن بیدیه عند إرادة النهوض ◂ الثامن والعشرون: وضع الرکبتین قبل الیدین للمرأة عند الهویّ للسجود ◂ التاسع والعشرون: إطالة السجود والإکثار فیه من التسبیح والذکر ◂ الثلاثون: مباشرة الأرض بالکفّین ◂ الواحد والثلاثون: زیادة تمکین الجبهة وسائر المساجد فی السجود ◂ کراهة الإقعاء فی الجلوس"}, {r:216,n:"کراهة نفخ موضع السجود"}, {r:217,n:"کراهة قراءة القرآن فی السجود"}, {r:218,n:"حکم ترک جلسة الاستراحة"}, {r:219,n:"حکم ما لو نسی جلسة الاستراحة"}, {r:220,n:"السجود للسهو"}, {r:233,n:"فی ما یعتبر فی هذا السجود"}, {r:236,n:"فی ما لا یعتبر فی هذا السجود"}, {r:237,n:"فی ما یکتفی به فی هذا السجود"}, {r:238,n:"حکم ما لو سمع القراءة مکرّراً وشکّ بین الأقلّ والأکثر"}, {r:239,n:"فی ما لو علم عدد القراءات وشکّ فی الإتیان بین الأقلّ والأکثر ◂ کفایة رفع الرأس من السجدة فی صورة وجوب التکرار"}, {r:240,n:"سجود الشکر، وبعض موارده ◂ ما یُکتفی به وما یشترط وما لا یشترط فی هذا السجود"}, {r:241,n:"فی ما لو وَجَدَ سببَ سجود الشکر وکان له مانع من ذلک"}, {r:242,n:"السجود بقصد التذلّل والتعظیم للّه تعالی، وما یتعلّق به"}, {r:243,n:"حکم السجود لغیر اللّه تعالی"}, {r:244,n:"الثانی: الصلاة علی النبی وآله ◂ فی کیفیة التشهّد والصلاة علی النبی وآله ◂ حکم التشهد فی کلّ صلاة ◂ حکم ترکه ◂ واجبات التشهّد، سبعة: ◂ الأوّل: الشهادتان ◂ الثالث: الجلوس بمقدار الذکر الوارد ◂ الرابع: الطمأنینة فیه ◂ الخامس: الترتیب فیه ◂ السادس: الموالاة ◂ السابع: تأدیته بالوجه الصحیح ◂ ذکر الشهادتین والصلاة بألفاظها المتعارفة"}, {r:245,n:"کیفیة الجلوس فی التشهّد"}, {r:246,n:"حکم تعلّم الذکر"}, {r:247,n:"یستحبّ فی التشهّد اُمور عشرة: ◂ الأول: الجلوس متورّکاً ◂ الثانی: القول قبل الشروع بالذکر: «الحمد للّه»، أو غیر ذلک ◂ الثالث: جعل الیدین علی الفخذین ◂ الرابع: أن یکون نظره إلی حِجره ◂ الخامس: القول بعد الشهادة الثانیة: «أرسله بالحق بشیراً و...» ◂ السادس: القول بعد الصلاة علی النبیّ: «وتقبّل شفاعته، وارفع درجته» ◂ السابع: القول فی التشهّد الأول والثانی بما جاء فی موثّقة أبی بصیر ◂ الثامن: التسبیح سبعاً بعد التشهّد الأول ◂ التاسع: قول «بحول اللّه وقوّته...» حین القیام عن التشهّد الأوّل ◂ العاشر: ضمّ المرأة فخذَیها حال الجلوس للتشهّد"}, {r:248,n:"کراهة الإقعاء حال التشهّد"}, {r:249,n:"حکم التسلیم وجزئیّته للصلاة وجمیع ما یعتبر فیها ◂ حکم ترکه ◂ حکم الجلوس فی التسلیم والاطمئنان ◂ کیفیة التسلیم وصیغته ◂ حکم تأدیته ◂ حکم الصلاة فی الحدث أو الإتیان ببعض المنافیات قبل السلام"}, {r:250,n:"ما لا یشترط فی التسلیم"}, {r:251,n:"حکم تعلّم صیغة التسلیم ◂ حکم العاجز عن التسلیم والأخرس"}, {r:252,n:"مستحبّات الجلوس فیه"}, {r:253,n:"کفایة الإخطار الإجمالی بالبال فی السلام"}, {r:254,n:"استحباب الإیماء بالتسلیم"}, {r:255,n:"فی ما لو دخل وقت الصلاة أثناء التسلیم"}, {r:256,n:"حکم الترتیب بین أفعال الصلاة ◂ حکم ما لو خالف الترتیب"}, {r:257,n:"ترک الموالاة ◂ حکم الموالاة بین أفعال الصلاة وأجزاءها ◂ التطویل لا یوجب فوات الموالاة"}, {r:258,n:"مراعاة التتابع العرفی بالأفعال والقراءة والأذکار"}, {r:259,n:"فی ما لو نذر الموالاة"}, {r:260,n:"حکم القنوت فی جمیع الفرائض والنوافل ◂ تأکّد القنوت فی الصلوات ◂ محلّ القنوت فی الصلوات ◂ عدم اشتراط رفع الیدین ولا الذکر الخاص فیه ◂ أقلّ ما یجزی فی القنوت ◂ جواز قراءة القرآن فی القنوت"}, {r:261,n:"جواز قراءة الأشعار فی القنوت"}, {r:262,n:"جواز الدعاء فیه بسائر اللغات إلاّ الأذکار المخصوصة"}, {r:263,n:"قراءة الأدعیة الواردة عن الأئمة: فی القنوت"}, {r:264,n:"ما یُبدء به فی القنوت"}, {r:265,n:"بعض ما ورد من القنوت الجامع"}, {r:266,n:"حکم القنوت بالدعاء الملحون"}, {r:267,n:"جواز الدعاء لشخصٍ أو علیه"}, {r:268,n:"حکم الدعاء لطلب الحرام"}, {r:269,n:"استحباب إطالة القنوت"}, {r:270,n:"استحبابیّة وکرهیّة جملة من الأمور حین القنوت"}, {r:271,n:"فی ما إذا نذر القنوت"}, {r:272,n:"حکم نسیان القنوت وما یتعلّق به"}, {r:273,n:"استحباب الجهر بالقنوت"}, {r:274,n:"فی شرطیة القیام فی القنوت"}, {r:275,n:"صلاة المرأة کالرجل فی الواجبات والمستحبّات، وبعض ما یستحبّ فی صلاتها"}, {r:276,n:"صلاة الصَبیِّ کالرجل، والصبیّة کالمرأة"}, {r:277,n:"بعض ما یستحبّ فی حال الصلاة"}, {r:278,n:"ما المراد من التعقیب ◂ ذکر اُمور فی التعقیب: ◂ أحدها: أن یکبّر ثلاثاً بعد التسلیم ◂ الثانی: تسبیح الزهراء علیهاالسلام ، وذکر فضله وکیفیته ◂ استحباب کون السبحة من طین قبر الحسین علیه السلام"}, {r:279,n:"فی ما لو شکّ فی تسبیح الزهراء علیهاالسلام ◂ الثالث: دعاء «لا إله إلاّ اللّه وحده وحده... إنّک علی کلّ شیءٍ قدیر» ◂ الرابع: «اللهمّ اهدِنی من عندکَ، وأفِضْ علیَّ... من برکاتک» ◂ الخامس: «سبحان اللّه، والحمد للّه، ولا إله إلاّ اللّه واللّه أکبر» مائة مرة أو أربعین أو ثلاثین ◂ السادس: «اللهمّ صلِّ علی محمدٍ وآلِ محمدٍ، وأجرنی من النار... الحور العین» ◂ العاشر: «اُعیذُ نفسی وما رزقنی ربّی...»، و«اُعیذ نفسی...» ◂ السابع: «أعوذ بوجهک الکریم... ولا قوّة إلاّ باللّه العلیّ العظیم» ◂ الحادی عشر: أن یقرأ سورة التوحید اثنتی عشرة مرة، ثمّ یقرأ الدعاء الوارد بعدها ◂ الثامن: قراءة الحمد وآیة الکرسی وآیة «شَهِدَ اللّه أنَّهُ...» وآیة المُلک ◂ التاسع: «اللهمّ إنّی أسألک من کلّ خیرٍ أحاط به علمُکَ... وعذاب الآخرة» ◂ الثانی عشر: الشهادتان والإقرار بالأئمة علیهم السلام ◂ الثالث عشر: قبل أن یُثنی رجلیه یقول ثلاث مرات: «أستغفر اللّه الذی... وأتوب إلیه» ◂ الرابع عشر: دعاء الحفظ من النسیان، وهو: «سبحان من لا یعتدی علی أهل مملکته... قدیر»"}, {r:280,n:"استحباب الجلوس فی المصلّی بعد صلاة الصبح إلی طلوع الشمس مشتغلاً بذکر الله"}, {r:281,n:"الدعاء بعد الفریضة أفضل من الصلاة بعدها، وهو أفضل من الدعاء بعد النافلة"}, {r:282,n:"استحباب سجود الشکر بعد کلّ صلاة"}, {r:283,n:"استحباب الصلاة علی النبی حیثما ذَکَر أو ذُکِر عنده ◂ یستحب تکرار الصلاة علیه إذا ذکر اسمه صلی الله علیه و آله وسلم مکرّراً"}, {r:284,n:"إذا کان فی أثناء التشهّد فسَمِع اسمه لا یکتفی بالصلاة التی تَجب للتشهّد"}, {r:285,n:"عدم الفصل الطویل بین ذکره والصلاة علیه صلی الله علیه و آله وسلم"}, {r:286,n:"لا تُعتبر کیفیة خاصة فی الصلاة علیه صلی الله علیه و آله وسلم ، بل یکفی کلّ ما یدلّ علیها"}, {r:287,n:"إذا کَتَبَ اسمَه صلی الله علیه و آله وسلم یستحبّ أن یکتب الصلاة علیه"}, {r:288,n:"فی ما لو تذکّر اسمَه صلی الله علیه و آله وسلم فی قلبه"}, {r:289,n:"استحباب الصلاة علیه صلی الله علیه و آله وسلم عند ذکر سائر الأنبیاء والأئمة علیهم السلام وکیفیتها"}, {r:290,n:"الاُمور المبطِلة للصلاة ◂ أحدها: فقدان بعض الشرائط فی الصلاة، کالستر وإباحة المکان وغیرهما ◂ الثانی: إتیان الحدث الأکبر أو الأصغر ◂ الثالث: التکفیر ◂ الرابع: تعمّد الالتفات بتمام البدن دون الرأس ◂ الخامس: تعمّد الکلام بحرفین ولو مهمَلَین، أو بحرفٍ واحدٍ مُفهِم للمعنی ◂ ما لو تکلّم بحرفین فحصل ثانیهما من إشباع حرکة الأول"}, {r:291,n:"حکم التکلّم بحرفین من غیر ترکیب"}, {r:292,n:"فی ما لو تکلّم بحرفٍ واحدٍ غیر مفهمٍ للمعنی ووصله بإحدی کلمات الذکر أو القراءة"}, {r:293,n:"عدم بطلان الصلاة بمدِّ حرف المدِّ واللِینِ وإن زاد حرف آخر"}, {r:294,n:"حکم ما لو تکلّم بأحد حروف المعانی، کحرف الجر والتعلیل والعطف مع عدم قصدها"}, {r:295,n:"عدم بطلان الصلاة بصوت التَنَحْنُحْ أو النفخ والأنین والتأوّه من دون حکایتها"}, {r:296,n:"ذکر التأوّه من الذنب أو من نار جهنم ضمن الدعاء لا یبطل الصلاة بدون ذکر المتعلّق"}, {r:297,n:"عدم الفرق فی بطلان الصلاة بین وجود مخاطَب أم لا، وکذا مع الاضطرار أو الاختیار"}, {r:298,n:"لا بأس بالذکر والدعاء فی جمیع أحوال الصلاة بغیر المحرَّم، ومعه لا یجوز ومبطل"}, {r:299,n:"جواز الذکر والدعاء بغیر العربیة، وإن کانت أفضل"}, {r:300,n:"اعتبار قصد القرآنیة فی القراءة، وإن لم یکن بها ولم یکن دعاءً أبطل"}, {r:301,n:"حکم ما لو أتی بالذکر بقصد تنبیه الغیر والدلالة، أو قصد به التنبیه من دون قصد الذکر"}, {r:302,n:"جواز الدعاء مع مخاطبة الغیر بقول: «غفر الله لک»"}, {r:303,n:"جواز تکرار الذکر أو القراءة عمداً أو من باب الاحتیاط، وعدمه مع الوسوسة"}, {r:304,n:"لا یجوز ابتداءً السلام للمصلّی وکذا سائر التحیّات مع قصد التحیّة، وإن قصد الدعاء فلا بأس"}, {r:305,n:"جواز ردّ سلام التحیّة أثناء الصلاة، بل یجب، وإن عصی لم تبطل"}, {r:306,n:"وجوب ردّ السلام أثناء الصلاة بمثل ما سُلِّم بنفس اللفظ والمماثلة"}, {r:307,n:"لو قال المسلِّم: «علیکم السلام» فالأحوط أن یقول: «سلام علیکم» بقصد القرآنیة أو الدعاء"}, {r:308,n:"وجوب ردّ جواب السلام صحیحاً ولو سُلِّمَ بالملحون، والأفضل قصد القرآن والدعاء"}, {r:309,n:"حکم ما لو کان المسلِّم صبیّاً ممیِّزاً، أو امرأةً أجنبیة، أو أجنبیّاً علی امرأة تصلّی"}, {r:310,n:"فیما لو سُلِّم علی جماعةٍ منهم المصلِّی فردّ الجواب غیره، أو ردّه صبیّ ممیِّز"}, {r:311,n:"حکم ما لو سُلِّم علیه بقول: «سلام» بدون «علیکم»"}, {r:312,n:"لو سُلِّمَ مرّات عدیدة یکفی فی الجواب مرة، ولو أجاب وسُلِّم یجب جواب الثانی"}, {r:313,n:"حکم ما لو شکّ المصلّی أنّ المسلِّم قصده مع الجماعة، أو لا"}, {r:314,n:"وجوب ردّ السلام فوراً، وعدمه لو أخّر عصیاناً أو نسیاناً مع خروجه عن صدق الجواب، وإن کان فی الصلاة لم یجز"}, {r:315,n:"وجوب إسماع ردّ السلام، سواء کان فی الصلاة أم لا، إلاّ إذا سلّم ومشی سریعاً"}, {r:316,n:"فی ما لو کانت التحیة بغیر لفظ السلام، ولو کان فی أثناء الصلاة"}, {r:317,n:"حکم ما لو شکّ المصلّی بأنّ المسلِّم سلّم بأیّ صیغة؟"}, {r:318,n:"کراهة السلام علی المصلِّی"}, {r:319,n:"کفائیّة وجوب ردّ السلام، وعدم سقوط الاستحباب بالنسبة إلی الباقین"}, {r:320,n:"جواز سلام الأجنبی علی الأجنبیة، وبالعکس مع عدم الرِیبة أو خوف الفتنة"}, {r:321,n:"حکم الابتداء بالسلام علی الکافر، وسلام الذمّی علی المسلم وکیفیته ◂ استحباب سلام الراکب علی الماشی، والقائم علی الجالس، والقلّة علی الکثرة، وغیرها"}, {r:323,n:"عدم وجوب ردّ السلام إن کان سخریة أو مزاح"}, {r:324,n:"عدم وجوب الردّ إذا سلّم علی أحد شخصین ولم یُعلم أیّهما أراد؟ وإن کان الأفضل الردّ لکلیهما فی غیر حال الصلاة"}, {r:325,n:"لو تقارن سلام شخصین کلّ علی الآخر وجب علی کلٍّ فهما الردّ للآخر"}, {r:326,n:"وجوب ردّ سلام قارئ التعزیة والواعظ ونحوهما، ویکفی ردّ أحد المستمعین"}, {r:327,n:"استحباب الردّ بالأحسن فی غیر حال الصلاة"}, {r:328,n:"استحباب قول العاطس ومن سمع عطسة الغیر: «الحمدلله»، أو التحمید والصلاة ◂ یستحبّ تسمیت العاطس یقول: «ویرحمک الله» أو الجمع، وإن کان فی الصلاة ◂ یستحبّ للعاطس أن یردّ التسمیت بقوله: «یغفرالله لکم» ◂ السادس: تعمّد القهقهة ولو اضطراراً ◂ السابع: تعمّد البکاء المشتمل علی الصوت وغیره لاُمور الدنیا ◂ الثامن: کلّ فعلٍ ماحٍ لصورة الصلاة، قلیلاً کان أو کثیراً ◂ التاسع: الأکل والشرب الماحیان للصورة، عمداً کانا أو سهواً ◂ العاشر: تعمّد قول: «آمِین» بعد تمام الفاتحة لغیر ضرورة ◂ الحادی عشر: الشکّ فی رکعات الثنائیة والثلاثیّة والاُولَیَین من الرباعیة ◂ الثانی عشر: زیادة جزءٍ أو نقصانه، عمداً إن لم یکن رکناً، ومطلقاً مع الرکنیة"}, {r:329,n:"لو شکّ بعد السلام فی أنّه هل أحدث أثناء الصلاة أم لا؟ بنی علی العدم والصحة"}, {r:330,n:"حکم من علم بأنّه نام اختیاراً وشکّ فی أنّه هل أتم الصلاة ثمّ نام، أو نام فی أثنائها؟"}, {r:331,n:"حکم من رأی نجاسةً فی المسجد أثناء الصلاة"}, {r:332,n:"فی القول بجواز البکاء علی سیدالشهداء علیه السلام فی حال الصلاة"}, {r:333,n:"حکم الشکّ فی بقاء الصلاة فی الفعل الکثیر والسکوت الطویل"}, {r:334,n:"فهرس محتویات الکتاب ◂ الاصدارت العلمیة لمؤسسة السبطین علیهماالسلام العالمیة"}],
  bk75: [{r:1,n:"الاُمور التی یُکره الإتیان بها فی الصلاة"}, {r:4,n:"عدم جواز قطع الفریضة اختیاراً ◂ لا یجوز قطع النافلة المنذورة بالخصوص"}, {r:5,n:"عدم جواز قطع الصلاة إن رأی أو حدثت نجاسة فی المسجد لإزالتها"}, {r:6,n:"حکم قطع الصلاة إذا توقّف أداء الدَین المطالب به علیه"}, {r:7,n:"حکم ترک القطع فی موارد وجوبه"}, {r:8,n:"حین إرادة القطع رخصةً أو وجوباً استحباب القول : « السلام علیک أیها النبی...»"}, {r:9,n:"وجوب صلاة الآیات علی الرجال والنساء والخناثی ◂ الاُمور المسبِّبة لصلاة الآیات ◂ وقت صلاة الآیات ◂ تفصیل کیفیة صلاة الآیات ◂ صور کیفیة صلاة الآیات"}, {r:10,n:"ما یعتبر فی صلاة الآیات من الأجزاء والشرائط والأذکار الواجبة والمندوبة"}, {r:11,n:"مواضع استحباب القنوت فی صلاة الآیات"}, {r:12,n:"استحباب التکبیر عند کلّ هویٍّ للرکوع وکلّ رفعٍ منه"}, {r:13,n:"استحباب قول : « سمع اللّه لمن حمده » بعد الرفع من الرکوع الخامس والعاشر"}, {r:14,n:"حکم الشک فی عدد الرکعات فی صلاة الآیات"}, {r:15,n:"الرکوعات فی صلاة الآیات أرکان ، فتبطل بزیادتها أو نقیصتها ، عمداً أو سهواً"}, {r:16,n:"لو أدرک من وقت الکسوفین رکعةً فقد أدرک الوقت"}, {r:17,n:"وجوب القضاء عند الإهمال مع العلم ، وکذا إن علم ونسی"}, {r:18,n:"یجب القضاء أو الإعادة عند العلم بالآیة مع تبیّن فساد الصلاة"}, {r:19,n:"حکم ما لو حصلت الآیة فی وقت الفریضة"}, {r:20,n:"لو شرع فی الیومیة ثمّ ظهر له ضیق وقت الآیة قطعها مع سعة وقتها"}, {r:21,n:"ما یستحبّ فی صلاة الآیات من اُمور ◂ فی حکم التطویل فی القراءة والأذکار فیها حتی للإمام"}, {r:22,n:"حکم الدخول فی الجماعة لو أدرک الإمام فی رکوع الاُولی أو الثانیة ، قبل الرکوع أو بعده"}, {r:24,n:"وجوب الإتیان بسجود السهو عند حصول موجباته فیها کما فی الیومیّة"}, {r:25,n:"جریان قاعدة التجاوز عن المحل فیها وعدم التجاوز عند الشکّ کما فی الیومیّة"}, {r:26,n:"شرائط ثبوت الکسوف والخسوف وسائر الآیات"}, {r:27,n:"اختصاص وجوب صلاة الآیات بِمَن فی بلد الآیة"}, {r:28,n:"وجوب صلاة الآیات علی کلّ مکلّفٍ ، إلاّ الحائض والنُفَساء"}, {r:29,n:"لو تعدّد سبب الآیة دفعةً أو تدریجاً تعدَّدَ وجوب الصلاة"}, {r:30,n:"حکم ما لو تعدّد ما علیه من سبب واحد ، ومع تعدّد السبب نوعاً"}, {r:31,n:"المناط فی وجوب القضاء فی الکسوفَین فی صورة الجهل"}, {r:32,n:"حکم ما لو أخبر جماعة بحدوث الکسوف ولم یحصل العلم ثم تبیّن صدقهم"}, {r:33,n:"وجوب قضاء الصلوات الیومیة الفائتة عمداً أو سهواً أو جهلاً أو لمرض وغیره ◂ حکم بلوغ الصبی وإفاقة المجنون والمغمی علیه والحائض والنفساء وغیرهم"}, {r:34,n:"فیما لو أسلم الکافر قبل خروج الوقت ولم یُصلِّ"}, {r:35,n:"لا فرق فی سقوط القضاء عن المجنون والحائض والنُفَساء بین کون العذر قهریاً أو اختیاریاً"}, {r:36,n:"المرتدّ الفطری أو الملّی یجب علیه قضاء ما فات منه أیام ردّته بعد عَوده للإسلام"}, {r:38,n:"المخالف یجب علیه قضاء ما فات منه أو أتی به علی وجه یخالف مذهبه ، وعکسه صحیح ◂ لو استبصر المخالف ثمّ خالف ثم استبصر فالأحوط القضاء ◂ وجوب القضاء علی شارب المسکِر ، مع العلم أو الجهل"}, {r:39,n:"فاقد الطَهورَین یجب علیه القضاء ویسقط عنه الأداء"}, {r:40,n:"وجوب أداء الظهر علی من وجبت علیه الجمعة وترکها ، وقضائها إن ترکها ، لا قضاء الجمعة"}, {r:41,n:"وجوب قضاء غیر الیومیة سوی العیدین حتی النافلة المنذورة فی وقتٍ معیَّن"}, {r:42,n:"یجوز قضاء الفرائض فی اللیل أو النهار أو السفر أو الحضر ، وما فات فی الحضر تماماً سفراً، وبالعکس"}, {r:43,n:"حکم ما لو فاتت الصلاة فی أماکن التخییر"}, {r:44,n:"القضاء فیما لو فاتت الصلاة فی السفر الذی یجب فیه الاحتیاط بین القصر والتمام"}, {r:45,n:"فیما لو فاتته الصلاة وکان فی أول الوقت حاضراً وفی آخر الوقت مسافراً ، وبالعکس"}, {r:46,n:"استحباب قضاء النوافل الرواتب استحباباً مؤکّداً ◂ فی مَن عجز عن قضاء الرواتب ، وعدم الفرق فی قضاء النوافل بین الأوقات"}, {r:47,n:"عدم اعتبار الترتیب فی قضاء الفوائت من غیر الیومیة"}, {r:48,n:"وجوب الترتیب فی قضاء الفوائت الیومیّة ، کقضاء السابق علی اللاحق"}, {r:49,n:"حکم ما لو جهل الترتیب فی الفوائت فی یوم أو یومین ◂ فیما لو فاتته الصلوات الخمس غیر مرتبة ولم یعلم السابق من اللاحق"}, {r:50,n:"لو فاتته صلوات معلومة سفراً وحضراً ولم یعلم الترتیب صلّی بعددها من الأیّام"}, {r:51,n:"فیما إذا علم أنّ علیه صلاةً واحدةً ولم یعلم بأنّها ظهر أو عصر اکتفی بأربع رکعات بقصد ما فی الذمّة"}, {r:52,n:"حکم ما لو تیقّن فوت إحدی الصلاتین من الظهرین لا علی التعیین واحتمل فوت کلتیهما"}, {r:53,n:"فیمن علم أنّ علیه إحدی الصلوات الخمس"}, {r:54,n:"الحکم فیمن علم أنّ علیه اثنتین من الخمس مردّدتین فی الخمس من یوم ◂ فیمن علم أنّ علیه اثنتین من الخمس مردّدتین فی الخمس من یوم ◂ فیمن علم أنّ علیه اثنتین من الخمس ولم یعلم أنّه کان مسافراً أو حاضراً"}, {r:55,n:"فیما لو علم أنّ علیه ثلاثة فروض من الخمس سفراً أو حضراً ◂ فیمن علم أنّ علیه ثلاثة فروض من الخمس ولم یعلم أنّه کان حاضراً أو مسافراً"}, {r:56,n:"إذا علم أنّ علیه أربعةً من الخمس وجب علیه الإتیان بالخمس علی الترتیب"}, {r:57,n:"فیمن علم أنّ علیه خمس صلوات مرتبة ولا یعلم أنّ أوُّلها أیّة صلاة"}, {r:58,n:"فیما إذا علم أنّ علیه ستّ صلوات ◂ فیما لو علم أنّ علیه سبع صلوات ◂ فی الاکتفاء بالقدر المعلوم لو علم فوت صلاة معیّنة مرّاتٍ ولم یعلم عددها"}, {r:59,n:"فیما لو علم بفوت صلواتٍ مختلفةٍ ولم یعلم مقدارها ◂ لا یجب الفور فی القضاء ، بل هو موسّع ما دام العمر إذا لم ینجرَّ إلی المسامحة والتهاون"}, {r:60,n:"عدم وجوب تقدیم الصلاة الفائتة علی الحاضرة"}, {r:61,n:"فیما لو کانت علیه فوائت أیام وفاتت منه صلاة ذلک الیوم ولم یتمکّن من إتیانها"}, {r:62,n:"فیما لو احتمل اشتغال ذمّته بفائتة أو فوائت ، و کذا لو احتمل خللاً فیها"}, {r:63,n:"فی إتیان النوافل لمن علیه القضاء ، قبل دخول الوقت أو بعد إتیان الفریضة"}, {r:64,n:"عدم جواز الاستنابة فی قضاء الفوائت مادام حیّاً ولو عجز عن إتیانها أصلاً"}, {r:65,n:"جواز إتیان القضاء جماعةً ، سواء کان الإمام قاضیاً أم مؤدّیاً"}, {r:66,n:"فی تأخیر القضاء لذوی الأعذار إلی زمان رفع العذر"}, {r:67,n:"استحباب تمرین الممیِّز من الأطفال علی قضاء ما فات والتمرین علی أدائه"}, {r:68,n:"یجب علی الولیّ منع الأطفال عن کلّ ما فیه ضرر علیهم أو علی غیرهم من الناس من المحرّمات ◂ فی منع الممیِّز عن لبس الحریر والذهب وغیرهم ممّا یحرم علی البالغین"}, {r:69,n:"جواز الاستئجار للصلاة بل ولسائر العبادات عن الأموات إذا فاتت منهم ◂ عدم جواز الاستئجار ولا التبرّع عن الأحیاء فی الواجبات وإن کانوا عاجزین ◂ جواز إتیان المستحبّات وإهداء ثوابها للأحیاء والنیابة فی بعض المستحبّات ◂ لا یکفی فی تفریغ ذمّة المیّت إتیان العمل وإهداء ثوابه"}, {r:70,n:"یُعتبر فی صحّة عمل الأجیر والمتبرّع قصد القربة"}, {r:71,n:"وجوب الوصیّة علی مَن علیه شیء من الواجبات ، وعلی الوصیّ إخراجها من الترکة"}, {r:72,n:"إذا علم أنّ علیه شیئاً من الواجبات وجب إخراجها وإن لم یوصِ به"}, {r:73,n:"لو أوصی المیت بالصلاة أو الصوم ونحوهما ولم یکن له ترکة لا یجب علی الوصی أو الوارث إخراجه من ماله ، ولا المباشرة ، إلاّ ما فات منه لعذر وإن لم یوصِ"}, {r:74,n:"فیما لو أوصی بما یجب علیه من باب الاحتیاط وجب إخراجه من الأصل"}, {r:75,n:"لو أوصی بما یستحبّ علیه من باب الاحتیاط وجب العمل به ، لکن یخرج من الثلث ◂ فیما لو أوصی بالاستئجار عنه أزید من عمره فإنّه یجب العمل والإخراج من الثلث ◂ لو علم فراغ ذمّته علماً قطعیاً فلا یجب وإن أوصی به ◂ فیما لو آجَرَ نفسَه لصلاةٍ أو صومٍ أو حجٍّ فمات قبل الإتیان به"}, {r:76,n:"فیمن لو کان علیه صلاة أو صیام استئجاریّ وکان علیه فوائت من نفسه"}, {r:77,n:"یشترط فی الأجیر کونه عارفاً بأجزاء الصلاة وأحکامها تقلیداً أو اجتهاداً"}, {r:78,n:"فی اشتراط عدالة الأجیر"}, {r:79,n:"حکم کفایة استئجار غیر البالغ ولو بإذن ولیّه"}, {r:80,n:"عدم جواز استئجار ذوی الأعذار والعاجز عن القیام وإن کان المیّت کذلک"}, {r:81,n:"فیما لو استأجر القادر فصار عاجزاً ◂ فی حکم تبرّع العاجز عن القیام عن المیّت"}, {r:82,n:"لوسها الأجیر أو شکّ فیعمل وفق تقلیده أو اجتهاده ، وعدم إعادة الصلاة"}, {r:83,n:"یجب علی الأجیر الإتیان بالصلاة وفقاً لتکلیف المیّت أجتهاداً أو تقلیداً"}, {r:84,n:"جواز استئجار کلٍّ من الرجل والمرأة للآخر مع مراعاة المباشر جهراً وإخفاتاً"}, {r:85,n:"جواز الإتیان بالصلاة الاستئجاریة جماعةً مع عدم اشتراط الانفراد ◂ حکم الاقتداء بمن یصلّی الصلاة الاستئجاریة"}, {r:86,n:"وجوب مراعاة الترتیب فی الصلاة الاستئجاریة مع العلم به"}, {r:87,n:"حکم ما لو استُؤجِر لفوائت المیّت جماعةً"}, {r:88,n:"عدم فراغ ذمّة المیّت بمجرّد الاستئجار ، بل یتوقّف علی العمل صحیحاً"}, {r:89,n:"فیما لو مات الأجیر قبل انقضاء مدة الإجارة ◂ عدم جواز استئجار الأجیر غیره للعمل إلاّ بإذن المستأجر"}, {r:90,n:"فراغ ذمّة المیّت وانفساخ الإجارة لو تبرّع متبرّع قبل عمل الأجیر"}, {r:91,n:"یستحقّ الأجیر أجرة المثل لو ظهر بطلان الإجارة بعد العمل أو حصل الغَبْن"}, {r:92,n:"فیما لو آجر نفسه لصلاة أربع رکعاتٍ فأخّر ولم یصلِّ عصر ذلک الیوم"}, {r:93,n:"حکم ما لو انقضی الوقت المضروب للصلاة المستأجرة ولم یأتِ بها الأجیر"}, {r:94,n:"وجوب تعیین المیّت المنوب عنه ولو إجمالاً ، ولم یجب ذکر اسمه"}, {r:95,n:"وجوب الإتیان بالمتعارف عند عدم تعیین کیفیة العمل من حیث المستّحبات"}, {r:96,n:"فیما لو نسی الأجیر بعض المستحبّات المشترط علیها أو بعض الواجبات عدا الأرکان"}, {r:97,n:"حکم ما لو آجر نفسه لصلاة شهرٍ وشکّ بأنّ المستأجَر علیه سفر أو حضر"}, {r:99,n:"وجوب القضاء علی ولیّ المیّت مافاته من الصلاة لعذرٍ وعدم إمکانه قضاءه ◂ المراد بالولیّ هو الابن الأکبر ، فلا یجب علی البنت ولا علی غیر الأکبر ◂ وجوب القضاء علی الولیّ ما فات من الأبوین من صلاة نفسهما"}, {r:100,n:"عدم وجوب القضاء عن المیّت علی ولد الولد وإن کان هو الأکبر"}, {r:101,n:"لا یجب القضاء علی غیر الأکبر لو مات الأکبر بعد أحد أبویه"}, {r:102,n:"عدم اعتبار البلوغ والعقل فی الولیّ عند الموت ، فیجب علی الطفل إن بلغ"}, {r:103,n:"الاعتبار فی الولیّ فی أکبر الأبناء بالسنّ ، لا بالبلوغ"}, {r:104,n:"لا یجب فی الولیّ کونه وارثاً ، بل یجب علی الممنوع من الإرث بالقتل أو"}, {r:105,n:"الخنثی المشکل الأکبر لا یعتبر ولیّاً ، بل غیره ولو کان أصغر ◂ لو انحصرت الولایة فی الخنثی لم یجب علیه"}, {r:106,n:"عدم وجوب القضاء علی أیّ واحد لو اشتبه الأکبر بین الاثنین"}, {r:107,n:"فیما لو تساوی الإبنان بالسِنّ قُسِّط القضاء علیهما"}, {r:108,n:"سقوط القضاء عن الولیّ لو أوصی المیّت بالاستئجار بشرط صحة صلاة الأجیر"}, {r:109,n:"جواز استئجار الولیّ ما علیه من القضاء عن المیّت"}, {r:110,n:"فی سقوط القضاء عن الولیّ لو تبرّع عن المیّت متبرِّع"}, {r:111,n:"وجوب مراعاة الترتیب فی الصلاة علی الولیّ ، والاحتیاط بالتکرار مع جهله"}, {r:112,n:"المناط فی الجهر والإخفات علی حال الولیّ المباشر ، لا المیّت فیجهر بالجهریّة ولو عن الاُمّ"}, {r:113,n:"مراعاة الولیّ تکلیف نفسه اجتهاداً أو تقلیداً ، بخلاف أجزاء الصلاة وشرائطها"}, {r:114,n:"لا یجب علی الولی القضاء لو علم فوائت للمیّت ولم یدرِ أنّها لعذرٍ أو لا"}, {r:115,n:"مدار الأکبریة للأبناء علی الولادة ، لا علی انعقاد النطفة ، فالأول ولادةً هو الأکبر"}, {r:116,n:"فی عدم اختصاص الوجوب علی الولیّ بالفوائت الیومیة"}, {r:117,n:"کفایة الوجوب علی الولیّ إخبار المیّت قضاء ما فاته لعذر"}, {r:118,n:"وجوب القضاء علی الولیّ إذا مات أحدهما فی أثناء الوقت"}, {r:119,n:"وجوب الاستئجار من الترکة لو لم یکن ولیّ أو کان ومات قبل أن یقضی ◂ فیما لو تبیّن بطلان ما أتی به الولیّ من قضاء الصلاة"}, {r:120,n:"عدم المنع من الوجوب علی الولیّ اشتغال ذمّته بفوائت نفسه"}, {r:121,n:"عدم وجوب الفوریة فی قضاء الولیّ عن المیّت"}, {r:122,n:"فیما لو مات الولیّ بعد المیّت قبل تمکّنه من القضاء"}, {r:123,n:"حکم ما لو استأجر الولیّ غیره لِما علیه من صلاة المیّت"}, {r:124,n:"الجماعة مستحب أکید فی جمیع الفرائض الیومیة الأدائیة ◂ صلاة الجماعة تفضل علی صلاة الفرد بأربع وعشرین درجة ◂ فی فضل وثواب صلاة الجماعة فی القرآن والسنة النبویّة ◂ فضل الجماعة فی حدیث جبرئیل للنبی صلی الله علیه و آله عن اللّه تعالی ◂ تضاعف الأجر عند تعدّد جهات الفضل فی فضیلة المساجد ◂ زیادة الفضل والأجر فی فضیلة إمام الجماعة وکثرة المأمومین ◂ عدم جواز ترک الجماعة رغبة عنها أو استخفافاً بها ◂ ما ورد من الأحادیث والأخبار فی ذمّ تارک الجماعة رغبةً عنها ◂ وجوب الجماعة فی الجمعة واشتراطها فی صحّتها ◂ فی حکم ضیق الوقت عن تعلّم القراءة لمن لا یُحسنها ◂ فی وجوب الجماعة بالنذر والعهد والیمین ◂ حکم وجوبها لو توقّف ترک الوسواس علیها"}, {r:125,n:"عدم مشروعیة الجماعة فی النوافل الأصلیة وإن وجبت بالعارض بنذرٍ"}, {r:126,n:"الموارد التی تصحّ فیها الصلاة جماعةً ◂ جواز الاقتداء فی کلٍّ من الصلوات الیومیة بمن یصلّی الاُخری بمطلق الأحوال ◂ فی جواز اقتداء المؤدّی بالقاضی والمسافر بالحاضر والمعید بمن لم یصلِّ وبالعکس"}, {r:127,n:"فی حکم اقتداء من یصلّی وجوباً بمن یعید احتیاطاً ، واقتداء المحتاط بالمحتاط ◂ فی جواز الاقتداء فی الیومیة أداءً أو قضاءً بصلاة الطواف والعکس"}, {r:128,n:"عدم جواز الاقتداء فی الیومیة بصلاة الاحتیاط فی الشکوک"}, {r:129,n:"فی عدم جواز اقتداء مصلّی الیومیة أو الطواف بمصلّی الآیات أو العیدین أو الأموات ، ولا العکس"}, {r:130,n:"فی حکم اقتداء مصلِّی العیدین بمصلّی الاستسقاء ، وکذا العکس"}, {r:131,n:"لا تنعقد الجمعة والعیدان إلاّ بخمسةٍ أحدهم الإمام"}, {r:132,n:"عدم اشتراط نیّة الإمام الجماعة والإمامة فی انعقاد الجماعة عدا الجمعة والعیدین ◂ أقلّ عدد تنعقد به الجماعة ـ عدا الجمعة والعیدین ـ اثنان ، الإمام والمأموم ◂ لابدّ للمأموم من نیّة الائتمام ، فإن لم ینوِه لم تتحقّق الجماعة ولو تابع الإمام ◂ تجب وحدة الإمام ، فلو نوی الاقتداء باثنین لم تصحّ جماعةً ◂ وجوب تعیین الإمام بالاسم أو الوصف أو الإشارة الذهنیة أو الخارجیة"}, {r:133,n:"عدم جواز الاقتداء بالمأموم ، واشتراط عدم کون إمامه مأموماً لغیره"}, {r:134,n:"فیما لو شکّ المأموم بأن نوی الائتمام أولا بنی علی العدم"}, {r:135,n:"لو نوی الاقتداء بشخصٍ أنّه زید فبان أنّه عمرو ، فإن لم یکن عادلاً بطلت جماعته ◂ فی صورة قصد الاقتداء بزیدٍ وتخیّل أنّ الحاضر هو زید تبطل جماعته"}, {r:136,n:"فی صورة کون قصده الاقتداء بهذا الحاضر وتخیّل أنّه زید فبان أنّه عمرو صحّت صلاته"}, {r:137,n:"فیما لو صلّی اثنان ثم عُلِم أنّ نیّة کُلٍّ منهما الإمامة للآخر ◂ فیما لو علم أنّ نیّة کلٍّ منهما الائتمام بالآخر ◂ فی نقل المأموم نیّته من إمامٍ إلی إمامٍ آخر اختیاراً"}, {r:138,n:"جواز تقدیم المأمومین إماماً آخر وإتمام الصلاة معه لو عرض للإمام ما یمنعه من إتمام الصلاة ◂ عدم جواز عدول المنفرد إلی الائتمام فی الأثناء"}, {r:139,n:"فی العدول من الائتمام إلی الانفراد ولو اختیاراً فی جمیع أحوال الصلاة"}, {r:140,n:"لا یجب علی المأموم القراءة لو نوی الانفراد بعد قراءة الإمام قبل الدخول فی الرکوع"}, {r:141,n:"فی جواز الائتمام والرکوع مع الإمام لو أدرکه راکعاً ثمّ العدول إلی الانفراد اختیاراً"}, {r:143,n:"فیما لو نوی المأموم الانفراد بعد قراءة الإمام وأتمّ صلاته فنوی الاقتداء به فی صلاة اُخری ◂ عدم جواز عود المأموم إلی الائتمام لو نوی الانفراد فی الأثناء"}, {r:144,n:"صحّة الائتمام لو تردّد المأموم فی الانفراد وعدمه ثمّ عزم علی عدم الانفراد ◂ البنیان علی العدم فیما لو شکّ بأنّه عدل إلی الانفراد أم لا"}, {r:145,n:"عدم اعتبار قصد القربة فی صحّة صلاة الجماعة"}, {r:147,n:"فی الاقتداء بمن یصلّی صلاةً لا یجوز الاقتداء فیها ، کالنافلة أو الآیات ◂ فیما لو لم یدرک الإمام إلاّ فی الرکوع أو أول الرکعة أو أثنائها"}, {r:148,n:"حکم ما لو رکع بتخیّل إدراک الإمام راکعاً ولم یدرک ، أو شکّ فی إدراکه وعدمه"}, {r:149,n:"فی حکم الدخول فی الجماعة مع الاطمئنان بإدراک رکوع الإمام ، وعدمه"}, {r:150,n:"فیما لو نوی وکبّر فرفع الإمام رأسه قبل أن یرکع أو قبل الوصول إلی حدّ الرکوع"}, {r:151,n:"جواز الدخول فی الجماعة لو أدرک الإمام فی التشهّد الأخیر"}, {r:152,n:"فیما لو أدرک الإمام فی السجدة الاُولی أو الثانیة من الرکعة الأخیرة"}, {r:153,n:"فی حضور المأموم الجماعة فرأی الإمام راکعاً وخاف رفع الإمام رأسه إن التحق بالصفّ"}, {r:154,n:"شروط الجماعة مضافاً إلی ما مرّ فی المسائل المتقدمة ◂ أحدهما: عدم وجود الحائل بین الإمام والمأموم یمنع عن المشاهدة ◂ الثانی : عدم کون موقف الإمام أعلی من موقف المأمومین ◂ الثالث : عدم تباعد المأموم عن الإمام کثیراً فی العادة ◂ الرابع : عدم تقدم المأموم علی الإمام فی الموقف ◂ عدم البأس بالحائل القصیر غیر المانع من المشاهدة"}, {r:155,n:"فی حکم الحائل المثقوب وسطه لو تحققت المشاهدة فیه حال الرکوع أو"}, {r:156,n:"حکم الحائل الزجاجی الحاکی من ورائه"}, {r:157,n:"عدم عدّ الظلمة والغُبار والنهر والطریق من الحائل إن لم یکن فیه بُعد ممنوع"}, {r:158,n:"فی حکم الشبّاک وعدّه من الحائل"}, {r:159,n:"عدم منع حیلولة المأمومین بعضهم لبعض"}, {r:160,n:"لا یمنع عدم مشاهدة بعض أهل الصفّ الأوّل أو أکثر عن الإمام"}, {r:161,n:"عدم صحة اقتداء مَن علی یمین ویسار الإمام إن کان الإمام فی محرابٍ داخلٍ فی جدار"}, {r:162,n:"الحکم فیما لو تجدّد الحائل فی الأثناء"}, {r:163,n:"عدم صحّة الجماعة فیما لو دخل فی الصلاة مع وجود الحائل جاهلاً به أو لِعمیً وغیره"}, {r:164,n:"عدم صحة اقتداء مَن بین الإسطوانات مع وجود الحائل بینه وبین من تقدّمه"}, {r:165,n:"فی حکم الحائل الغیر مستقرٍّ ، کمرور شخص أو حیوان أو غیر ذلک"}, {r:166,n:"البناء علی العدم فیما لو شکّ فی حدوث الحائل فی الأثناء"}, {r:167,n:"حکم ما لو کان الحائل ممّا لا یمنع عن المشاهدة فی بعض أحوال الصلاة"}, {r:168,n:"فیما لو تمّت صلاة الصفّ الأول وبقوا جالسین فی مکانهم"}, {r:169,n:"اعتبار الثوب الرقیق الذی یُری الشبح من ورائه حائلاً"}, {r:170,n:"حکم ما لو کان أصل الصفوف اللاحقة متفرّقین بفاصل أکثر من الخطوة"}, {r:171,n:"بطلان الجماعة فیما لو تجدّد البُعد فی أثناء الصلاة"}, {r:172,n:"فی حکم اقتداء المتأخّر للبُعد فیما لو انتهت صلاة الصفّ المتقدّم لقصورهم أو انفرادهم"}, {r:173,n:"فی جواز إحرام أهل الصفّ المتأخّر مع عدم دخول الصفّ المتقدّم"}, {r:174,n:"بطلان جماعة الصفّ المتأخِّر إذا عُلِمَ بطلان صلاة الصفّ المتقدّم"}, {r:175,n:"الفصل بالصبیّ الممیِّز لا یضرّ ما لم یُعلَم بطلان صلاته"}, {r:176,n:"البناء علی العدم فیما لو شکّ فی حدوث البُعد فی الأثناء"}, {r:177,n:"فیما لو تقدّم المأموم علی الإمام أثناء الصلاة سهواً أو جهلاً أو اضطراراً صار منفرداً"}, {r:178,n:"فی حکم الجماعة بالاستدارة حول الکعبة وتقدّم المأموم علی الإمام بحسب الدائرة"}, {r:179,n:"فی حکم قراءة المأموم مع الإمام فی الرکعتین الاُولَیَین من الإخفاتیّة وترکها"}, {r:180,n:"فیما لو شکّ المأموم فی السماع وعدمه أو أنّ المسموع صوت الإمام أو غیره"}, {r:181,n:"عدم السماع لا فرق فیه بین کونه لجهة البُعد أو کون المأموم أصمّاً أو لکثرة الأصوات وغیرها"}, {r:182,n:"حکم قراءة المأموم لو سمع بعض قراءة الإمام"}, {r:183,n:"عدم بطلان صلاة المأموم لو قرأ بتخیّل أنّ المسموع غیر صوت الإمام ثمّ تبیّن أنّه صوته"}, {r:184,n:"عدم وجوب الطمأنینة علی المأموم حال قراءة الإمام"}, {r:185,n:"عدم جواز تقدم المأموم علی الإمام فی الأفعال ، وکذا التأخّر الفاحش"}, {r:186,n:"وجوب المتابعة لیس شرطاً فی صحة الصلاة ، بل هو تعبّدی ، فلو تقدّم أو تأخّر فاحشاً عمداً أثِم"}, {r:188,n:"وجوب العود والمتابعة لو رفع المأموم رأسه من الرکوع أو السجود قبل الإمام سهواً أو ◂ بطلان الصلاة جماعةً فیما لو رفع رأسه من الرکوع سهواً ، ثم عاد للمتابعة فرفع الإمام رأسه"}, {r:189,n:"الحکم فیما لو رفع المأموم رأسه من السجود فرأی الإمام فی السجدة فتخیّلها الاُولی ، فعاد إلیها بقصد"}, {r:190,n:"عدم جواز المتابعة للمأموم فیما لو رکع أو سجد قبل الإمام عمداً"}, {r:191,n:"عدم وجوب تأخّر المأموم أو مقارنته مع الإمام فی الأقوال"}, {r:192,n:"حکم ما لو أحرم المأموم قبل الإمام سهواً بزعم أنّه کبَّر"}, {r:193,n:"جواز إتیان المأموم ذکر الرکوع والسجود أزید من الإمام"}, {r:194,n:"عدم جواز ترک المأموم جلسة الاستراحة وهو یقلّد من یوجبها أو یحتاطها رغم ترک الإمام لها"}, {r:195,n:"یجب عود المأموم إلی القیام لو رکع المأموم ثم رأی الإمام یقنت فی غیر محلّه"}, {r:196,n:"عدم تحمّل الإمام عن المأموم غیر القراءة فی الاُولَتَین لو ائتمّ به فیهما"}, {r:197,n:"فیما لو أدرک المأموم الإمام فی الرکعة الثانیة"}, {r:198,n:"فی المراد بعدم إمهالِ الإمامِ المأمومَ المجوِّز لترک السورة"}, {r:199,n:"عدم بطلان صلاة المأموم فیما لو اعتقد إمهال الإمامِ له فی قرائة فقرأها ولم یُدرِک رکوعه"}, {r:201,n:"وجوب إخفات المأموم فی القراءة خلف الإمام وإن کانت الصلاة جهریة ◂ فیما یجب علی المأموم المسبوق برکعة"}, {r:202,n:"فیما لو أدرک المأمومُ الإمامَ فی الأخیرتین فدخل معه قبل رکوعه"}, {r:203,n:"فی حضور المأموم الجماعة ولم یدرِ أنّ الإمام فی الاُولَیَین أو الأخیرتین"}, {r:204,n:"فیما لو تخیّل المأموم أنّ الإمام فی الاُولَیَین فترک القراءة ثمّ تبیّن أنّه فی الأخیرتین"}, {r:205,n:"حکم ما لو کان المأموم مشتغلاً بالنافلة أو الفریضة فاُقیمت الجماعة وخاف عدم إدراکها"}, {r:206,n:"فی الفرق فی جواز العدول من الفریضة إلی النافلة لإدراک الجماعة بین الثنائیة أو غیرها"}, {r:207,n:"الحکم فیما لو قام المأموم مع الإمام إلی الرکعة الثانیة أو الثالثة فتذکّر أنّه ترک سجدةً أو سجدتین"}, {r:208,n:"جواز إتیان المأموم بالتکبیرات السِتّ قبل تحریم الإمام"}, {r:209,n:"جواز اقتداء أحد المجتهدَین أو المقلّدَین أو المختلِفَین بالآخر مع الاتحاد فی العمل"}, {r:210,n:"عدم جواز اقتداء المأموم لو علم بطلان صلاة الإمام من جهةٍ ما وهو یعتقد صحّتها جهلاً وسهواً"}, {r:211,n:"فیما لو رأی المأموم فی ثوب الإمام أو بدنه نجاسةً غیر معفوٍّ عنها"}, {r:212,n:"حکم ما لو تبیّن بعد الصلاة کون الإمام فاسقاً أو کافراً أو غیر متطهّر أو"}, {r:213,n:"الحکم فیما لو نسیَ الإمام شیئاً من واجبات الصلاة ولم یعلم به المأموم"}, {r:214,n:"حکم ما لو تبیّن للإمام بطلان صلاته لکونه محدِثاً أو تارکَ شرطٍ أو غیر ذلک"}, {r:215,n:"عدم جواز الاقتداء بإمامٍ یری نفسه مجتهداً ولیس بمجتهد مع عمله برأیه"}, {r:216,n:"عدم جواز الائتمام لو دخل الإمام فی الصلاة معتقداً دخول الوقت والمأموم بعکسه"}, {r:217,n:"الاُمور التی تشترط فی إمام الجماعة : البلوغ والعقل والإیمان والعدالة وصحة الولادة وغیرها ◂ إباحة إمامة القاعد والمضطجع لِمثلهما والجالس للمضطجع"}, {r:218,n:"عدم البأس بإمامة المتیمّم للمتوضّئ وذی الجبیرة لغیره والمتنجّس لعذرٍ لغیره"}, {r:219,n:"جواز الاقتداء بِمَن لا یُحسِن القراءه فی غیر المحلّ الذی یتحمّله الإمام عن المأموم"}, {r:220,n:"عدم جواز إمامة مَن لا یُحسن القراءة لمثله إذا اختلفا فی محل التحمّل"}, {r:221,n:"جواز الاقتداء بِمَن لا یتمکّن من کمال الإفصاح بالحروف وإن کان المأموم أفصح منه"}, {r:222,n:"فی حکم اقتداء غیر المُحسِن بمن هو محسِن"}, {r:223,n:"عدم جواز إمامة الأخرس لغیره وإن کان ممّن لا یُحسِن"}, {r:224,n:"جواز إمامة المرأة لمثلها ، وعدم الجواز للرجل ولا للخُنثی"}, {r:225,n:"جواز إمامة الخُنثی للاُنثی دون الرجل والخُنثی"}, {r:226,n:"جواز إمامة غیر البالغ لمثله"}, {r:227,n:"فی حکم إمامة الأجذم والأبرص والمحدود بالحدّ الشرعی بعد التوبة والأعرابی لمثلهم ولغیرهم"}, {r:228,n:"فی مناط العدالة الشرعیة فی العبادات وتعریفها"}, {r:229,n:"فی تعریف المعصیة الکبیرة ومواردها"}, {r:230,n:"کفایة ثبوت عدالة شخص بشهادة عدلَین إن لم یُعارَض بشهادة عدل آخر أو عدلَین"}, {r:231,n:"فی کفایة الاطمئنان بإخبار جماعة غیر معلُومِی العدالة بعدالة شخص"}, {r:232,n:"حکم تصدّی الإمامة مَنْ یعرف نفسه بعدم عدالته"}, {r:233,n:"فی الأولویة بالإمام للإمام الراتب فی المسجد من غیره وإن کان الغیر أفضل منه"}, {r:234,n:"فیما لو تشاحَّ الأئمة رغبةً فی ثواب الإمامة لا لفرضٍ دُنیوی"}, {r:235,n:"عدم حرمة مزاحمة الغیر للإمام الراتب فی المسجد إذا کان المسجد وقفاً لا مِلکاً له"}, {r:236,n:"فی کراهة إمامة بعض الأشخاص کالأجذم والأبرص والأغلف وغیرهم إلاّ لأمثالهم"}, {r:237,n:"الاُمور المستحبّة فی صلاة الجماعة هی: ◂ أحدها : وقوف المأموم عن یمین الإمام إن کان رجلاً واحداً ، وخلفه لو کانوا أکثر ◂ الثانی : وقوف الإمام فی وسط الصفّ ◂ الثالث : وقوف أهل الفضل فی العلم والکمال والعقل والورع والتقوی فی الصفّ الأول ◂ الرابع : الوقوف فی القرب من الإمام ◂ الخامس : الوقوف فی میامن الصفوف لأنّها أفضل من میاسرها بعکس صلاة الجنازة ◂ السادس : اعتدال الصفوف ، وسَدّ الفُرَج فیها ، والمحاذاة بین المناکب ◂ السابع : تقارب الصفوف بعضها من بعض بأقلّ من مقدار مسقط الإنسان إذا سجد ◂ الثامن : کون صلاة الإمام بصلاةِ أضعفِ مَن خلفه ◂ التاسع : اشتغال المأموم المسبوق بالتمجید والتسبیح والتهلیل إذا أکمل القراءة قبل رکوع الإمام ◂ العاشر : عدم قیام الإمام بعد التسلیم حتّی یُتمّ مَن خلفه صلاته من المسبوقین ◂ الحادی عشر : إسماع الإمام مَن خلفه القراءة الجهریة والأذکار بلا عُلُوٍّ مفرط ◂ الثانی عشر : إطالة الإمام رکوعه إذا أحسّ بدخول شخص ضِعفَ ما کان ◂ الثالث عشر : قول المأموم عند الفراغ من سورة الفاتحة : الحمدُ للّه ِ ربِّ العالمین ◂ الرابع عشر : قیام المؤمومین عند قول المؤذِّن : قد قامتِ الصلاةُ ◂ الاُمور المکروهة فی صلاة الجماعة : ◂ أحدها : وقوف المأموم وحده فی صفٍّ وحده مع وجود موضع فی الصفوف ◂ الثانی : الانشغال بالنافلة بعد قول المؤذِّن : قد قامت الصلاة ، أو عند الشروع فیه ◂ الثالث : اختصاص الإمام الدعاء لنفسه إن اخترعه من عنده دون الأدعیة المأثورة ◂ الرابع : التکلّم بعد قول المؤذِّن : قد قامت الصلاة ، بل یکره فی غیر الجماعة أیضاً ◂ الخامس : إسماعُ المأمومِ الإمامَ ما یقوله کُلاًّ أو بعضاً ◂ السادس : ائتمام الحاضر بالمسافر وبالعکس مع اختلاف صلاتهما قصراً وتماماً ◂ الجواز لکلٍّ من الإمام والمأموم عند انتهاء صلاته قبل الآخر أن لا یُسلِّم وینتظر"}, {r:238,n:"فیما لو شکّ المأموم بعد السجدة الثانیة من الإمام أنّه سجد معه سجدتین أو واحدة"}, {r:239,n:"حکم ما لو اقتدی المغرب بعشاء الإمام وشکّ فی حال القیام أنّه الرابعة أو الثالثة"}, {r:240,n:"فیما لو رأی المأموم من عادلٍ کبیرةً"}, {r:241,n:"عدم صحّة الاقتداء فیما لو رأی الإمام یصلّی ولم یعلم أنّها من الیومیة أو النوافل"}, {r:242,n:"فی القدر المتیقّن من اغتفار زیادة الرکوع للمتابعة سهواً"}, {r:243,n:"الحکم فیما لو کان الإمام یصلّی أداءً أو قضاءً یقینیاً والمأموم منحصراً بمن یصلّی احتیاطیاً"}, {r:244,n:"لا یلزم علی المأموم نیة الإفراد إذا فرغ الإمام من الصلاة وهو فی التشهد"}, {r:245,n:"المأموم المسبوق برکعةٍ یجوز له القیام بعد السجدة الثانیة من رابعة الإمام وینفرد"}, {r:246,n:"عدم وجوب إصغاء المأموم إلی قراءة الإمام فی الاُولَیَین من الجهریة"}, {r:247,n:"للفسق أم لا"}, {r:248,n:"جواز تقدم المأموم إلی الصفّ المتقدم أو یتأخّر إن وجد خللاً فیهما ، مع مراعاة القبلة"}, {r:249,n:"استحباب انتظار الجماعة إماماً أو مأموماً ، وهو أفضل من الصلاة أول الوقت منفرداً"}, {r:250,n:"استحباب الجماعة فی السفینة الواحدة والمتعدّدة للرجال والنساء ، وکراهتها فی بطون الأودیة"}, {r:251,n:"استحباب اختیار الإمامة علی الاقتداء ، وللإمام إن أحسن مثل أجر من صلّی مقتدیاً به"}, {r:252,n:"عدم البأس بالاقتداء بالعبد إذا کان عارفاً بالصلاة وأحکامها"}, {r:253,n:"فی ترک المأموم القراءة فی الاُولَیَین من الإخفاتیة"}, {r:254,n:"المشهور کراهة تمکین الصبیان من الصفّ الأول وإن کانوا ممیِّزین"}, {r:255,n:"جواز بل استحباب إعادة الصلاة منفرداً أو جماعةً إذا صلّی واحتمل فیها خللاً فی الواقع"}, {r:256,n:"الاجتزاء بالصلاة المُعادَة إذا ظهر بعد إعادة الصلاة جماعةً أنّ الاُولی کانت باطلةً"}, {r:257,n:"إذا أراد نیّة الوجه فی الصلاة المُعادَة ینوی الندب ، لا الوجوب"}, {r:258,n:"وهو الإخلال بالشیء المعتبر فیها وجوداً أو عدماً"}, {r:259,n:"فی أحکام أقسام الخلل العمدی الموجب لبطلان الصلاة ◂ فی بیان أنواع الخلل والزیادة والنقیصة فی الصلاة"}, {r:260,n:"فیما لو حصل الإخلال بزیادةٍ أو نقصانٍ جهلاً بالحکم"}, {r:261,n:"عدم الفرق فی البطلان بالزیادة العمدیة بین کونه فی ابتداء النیّة أو فی الأثناء ، وغیره"}, {r:262,n:"تبطل الصلاة إن أخلّ بالطهارة الحدثیة ساهیاً بأن ترک الوضوء أو الغسل أو التیمّم وإن تذکّر بالأثناء"}, {r:263,n:"بطلان الصلاة فیما لو صلّی قبل دخول الوقت أو إلی الیمین والیسار أو مستدبراً ساهیاً"}, {r:264,n:"فیما لو أخلّ بالطهارة الخبثیة فی البدن أو اللباس ساهیاً أو جاهلاً بالحکم أو الموضوع"}, {r:266,n:"حکم الإخلال بستر العورة وبشرائط الساتر سهواً عدا الطهارة ◂ فی حکم الإخلال بشرائط المکان سهواً"}, {r:267,n:"فیما لو سجد علی ما لا یصحّ السجود علیه سهواً إمّا لنجاسة أو غیرها"}, {r:268,n:"بطلان الصلاة بزیادة رکعة أو رکوعاً أو سجدتین من رکعة أو تکبیرة الإحرام سهواً ، عدا الجماعة"}, {r:269,n:"فی المستثنی من بطلان الصلاة بزیادة الرکعة"}, {r:270,n:"عدم الفرق فی بطلان الصلاة بزیادة رکعة بین کونه تشهّد فی الرابعة ثمّ قام للخامسة أو جلس بمقدارها"}, {r:271,n:"بطلان الصلاة فیما لوسَها عن الرکوع حتّی دخل فی السجدة الثانیة"}, {r:272,n:"حکم ما لو نسی السجدتین ولم یتذکّر إلاّ بعد الدخول فی رکوع الرکعة التالیة ، وغیره"}, {r:273,n:"بطلان الصلاة فیما لو نسی النیّة أو التکبیرة أو القیام حالها والقیام المتصل ، سواء تذکّر فی الأثناء أم لا"}, {r:274,n:"الحکم فیما لو نسی الرکعة الأخیرة فذکرها بعد التشهّد أو بعد التسلیم الواجب وغیرهما"}, {r:275,n:"لم تبطل الصلاة لو نسی ما عدا الأرکان من أجزاء الصلاة ، ویتدارک ◂ فی موارد فوت محلّ التدارک وأحکامه"}, {r:276,n:"فی حکم ما لو کان المنسیّ الجهر أو الإخفات"}, {r:277,n:"وهو الشکّ فی الإتیان بأصل الصلاة وفی شرائطها وفی أجزائها وفی عدد رکعاتها ◂ فی موارد الشکّ فی أصل الصلاة بأنّه هل صلّی أولا ؟"}, {r:278,n:"فیما لو شکّ فی فعل الصلاة وبقی من الوقت مقدار رکعة فهل یُنزّل منزلة تمام الوقت ، أوْ لا ؟"}, {r:279,n:"حکم ما لو ظنّ فعل الصلاة أو ظنّ عدم فعلها"}, {r:280,n:"لو شکّ فی بقاء الوقت وعدمه یلحقه حکم البقاء"}, {r:281,n:"تفصیل حکم ما لو شکّ فی أثناء صلاة العصر أنّه صلّی الظهر أوْ لا"}, {r:282,n:"التفصیل فیما لو علم أنّه صلّی إحدی الصلاتین من الظهر أو العصر ولم یدرِ المعیَّن منهما"}, {r:283,n:"فیما لو شکّ فی الصلاة أثناء الوقت ونسی الإتیان بها ، أو شکّ واعتقد أنّه خارج الوقت"}, {r:284,n:"حکم کثیر الشکّ فی الإتیان بالصلاة وعدمه حکم غیره ، والوسواسیّ یبنی علی الإتیان"}, {r:285,n:"التفصیل فی حکم الشکّ فی بعض شرائط الصلاة"}, {r:286,n:"التفصیل فی أحکام الشکّ فی شیءٍ من أفعال الصلاة"}, {r:287,n:"فی جریان الحکم المذکور فی المسألة المتقدمة فی غیر صلاة المختار"}, {r:288,n:"حکم ما لو شکّ فی صحّه ما أتی به وفساده لا فی أصل الإتیان"}, {r:289,n:"فیما لو شکّ فی فعلٍ قبل دخوله فی الغیر فأتی به ، ثم تبیّن أنّه کان آتیاً به"}, {r:290,n:"فی الشکّ فی التسلیم بعد الدخول فی صلاة اُخری أو بعد الإتیان بالمنافیات"}, {r:291,n:"فیما لو شکّ المأموم فی أنّه کبّر للإحرام أم لا"}, {r:292,n:"فیما لو شکّ وهو فی فعلٍ أنّه هل شکّ فی بعض الأفعال المتقدّمة ، أوْ لا ؟"}, {r:293,n:"الشکوک الثمانیة الموجبة لبطلان الصلاة : ◂ أحدها : الشکّ فی الصلاة الثُنائیة ، کالصبح وصلاة السفر ◂ الثانی : الشکّ فی الثلاثیة ، کالمغرب ◂ الثالث : الشکّ بین الواحدة والأکثر ◂ الرابع : الشکّ بین الاثنتین والأکثر قبل إکمال السجدتین ◂ الخامس : الشکّ بین الاثنتین والخمس أو الأزید وإن کان بعد الإکمال ◂ السادس : الشکّ بین الثلاث والسِتّ أو الأزید ◂ السابع : الشکّ بین الأربع والسِتّ أو الأزید ◂ الثامن : الشکّ بین الرکعات بحیث لم یدرِ کم صلّی"}, {r:294,n:"الشکوک الصحیحة تسعة فی الرباعیة ◂ أحدها : الشکّ بین الاثنتین والثلاث بعد إکمال السجدتین ◂ الثانی : الشکّ بین الثلاث والأربع فی أیّ موضعٍ کان ◂ الثالث : الشکّ بین الاثنتین والأربع بعد الإکمال ◂ الرابع : الشکّ بین الاثنتین والثلاث والأربع بعد الإکمال ◂ الخامس : الشکّ بین الأربع والخمس بعد إکمال السجدتین ◂ السادس : الشکّ بین الأربع والخمس حال القیام ◂ السابع : الشکّ بین الثلاث والخمس حال القیام ◂ الثامن : الشکّ بین الثلاث والأربع والخمس حال القیام ◂ التاسع : الشکّ بین الخمسِ والسِتِّ حال القیام"}, {r:295,n:"الشکّ فی الرکعات فی غیر تلک الموارد التسعة موجب للبطلان"}, {r:296,n:"عدم جواز العمل بحکم الشکّ من البناء أو البطلان بمجرّد حدوثه"}, {r:297,n:"فی بیان المراد بالشکّ فی الرکعات"}, {r:298,n:"فیما إذا شکّ فی إتیان السجدتین أو إحداهما وعدمه فی الشکوک المعتبر فیها إکمال السجدتین"}, {r:299,n:"فی الشکّ الثانی والثامن إذا علم حال القیام أنّه ترک سجدةً أو سجدتین بطلت صلاته"}],
  bk76: [{r:1,n:"جملة من أحکام صلاة الاحتیاط، مضافاً إلی ما تقدّم فی مسائل الصلاة"}, {r:2,n:"ما یعتبر فی الصلوات من الشرائط یجری فی صلاة الاحتیاط"}, {r:3,n:"یُراعی فی صلاة الاحتیاط جهة الاستقلال والجزئیة ؛ لتردّدها بین النافلة أو الجزء أو بمنزلة الجزء"}, {r:4,n:"عدم وجوب إعادة الصلاة لو جاء بالمنافی قبل صلاة الاحتیاط ثم تبیّن تمامیّتها"}, {r:5,n:"لا یجب الإتیان بالاحتیاط لو تبیّن تمامیّة الصلاة قبلها"}, {r:6,n:"لو تبیّن تمامیّة الصلاة بعد الإتیان بالاحتیاط فتحسب نافلةً ، وإن تبیّن فی الأثناء جاز قطعها"}, {r:7,n:"إذا تبیّن بعد إتمام الصلاة وقبل الاحتیاط زیادة رکعةٍ وجب إعادتها قبل الشروع بها أو فی الأثناء أو بعدها"}, {r:8,n:"صلاة الاحتیاط جابرة للصلاة إذا تبیّن بعد الاحتیاط نقصان الصلاة"}, {r:9,n:"عدم کفایة صلاة الاحتیاط لو تبیّن بعد صلاة الاحتیاط نقص الصلاة أزید ممّا کان ◂ صلاة الاحتیاط لا تکون جابرةً للنقص لو تبیّن الواقع بخلاف کلٍّ من طَرَفَی شکّه"}, {r:10,n:"فیما لو تبیّن قبل الشروع فی صلاة الاحتیاط نقصان صلاته"}, {r:11,n:"الحکم فیما لو تبیّن نقصان الصلاة فی أثناء صلاة الاحتیاط"}, {r:12,n:"فی حکم ما لو شکّ فی إتیان صلاة الاحتیاط بعد العلم بوجوبها علیه"}, {r:13,n:"لو زاد فی صلاة الاحتیاط رکعةً أو رکناً ولو سهواً بطلت ووجب إعادتها وإعادة الصلاة"}, {r:14,n:"فیما لو شکّ فی فعل من أفعال صلاة الاحتیاط"}, {r:15,n:"إذا شکّ بأنّه هل شکّ شکّاً یوجب صلاة الاحتیاط ، أولا ؟ بنی علی عدمه"}, {r:16,n:"الحکم فیما إذا شکّ فی عدد رکعات صلاة الاحتیاط"}, {r:17,n:"لو زاد فی صلاة الاحتیاط فعلاً غیر رکنٍ أو نقصَ فهل علیه سجدتا سهوٍ أولا ؟ وجهان ، والأحوط الإتیان بهما"}, {r:18,n:"إذا شکّ فی شرطٍ أو جزءٍ من صلاة الاحتیاط بعد السلام لم یلتفت إلیه"}, {r:19,n:"حکم ما لو نسی صلاة الاحتیاط وشرع فی نافلة أو قضاء فریضة أو غیرهما"}, {r:20,n:"إذا نسی سجدةً واحدةً من صلاة الاحتیاط أو تشهّداً قضاهما بعدها"}, {r:21,n:"وجوب قضاء الأجزاء المنسیّة مع عدم التذکّر قبل الرکوع"}, {r:22,n:"یُشتَرَط فی سجدتَی السهو جمیع ما یُشتَرَط فی سجود الصلاة ◂ فیما لو نسی بعض أجزاء التشهّد أو الصلاة علی محمدٍ وآل محمد"}, {r:23,n:"حکم ما لو فصل بین سجدتَی السهو والصلاة بالمنافی عمداً أو سهواً"}, {r:24,n:"إذا أتی بما یوجب السهو قبل الإتیان بسجدتَی السهو أو فی الأثناء فَعَلَه بعدهما"}, {r:25,n:"لا یجب قضاء ما نسیه من الذکر فی سجدتَی السهو ، ما عدا وضع الجبهة فی سجود الصلاة"}, {r:26,n:"حکم ما لو نسی بعض أجزاء التشهّد القضائی وأمکن تدارکه ، أو لم یمکن تدارکه بعد تخلّل المنافی"}, {r:27,n:"لو تعدّد نسیان السجدة أو التشهّد أتی بهما واحدةً بعد واحدة ، مع عدم اشتراط التعیین"}, {r:28,n:"فیما لو کان علیه قضاء سجدةٍ وقضاء تشهّد"}, {r:29,n:"الإتیان بالاحتیاط بالتکرار لو کان علیه قضاء سجدة وقضاء تشهّد وشکّ فی السابق واللاّحق"}, {r:30,n:"حکم ما لو شکّ فی أنّه نسی أحدهما أم لا ، أو علم بنسیان أحدهما وشکّ فی التدارک"}, {r:31,n:"فیما لو کان علیه صلاة الاحتیاط وقضاء السجدة أو التشهّد"}, {r:32,n:"حکم إعادة سجدة القضاء لو سها عن الذکر أو بعض ما یعتبر فیها ما عدا وضع الجبهة"}, {r:33,n:"فی حکم الإتیان بالسلام فی التشهّد القضائی"}, {r:34,n:"عدم الفرق فی وجوب قضاء السجدة وکفایته عن إعادة الصلاة بین کونها من الأولَتَین والأخیرتَین"}, {r:35,n:"فیما لو اعتقد نسیان السجدة أو التشهّد مع فوت محلّ تدارکهما وبعد الفراغ انقلب شکّاً"}, {r:36,n:"لو کان علیه قضاء السجدة أو التشهّد وشکّ فی إتیانه وعدمه وجب علیه الإتیان مادام فی وقت الصلاة"}, {r:37,n:"فیما لو شکّ فی أنّ الفائت منه سجدة واحدة أو سجدتان من رکعتین بنی علی الاتحاد"}, {r:38,n:"یکفی سجود السهو فیما لو شکّ أن الفائت منه سجدة أو غیرها من الأجزاء الواجبة التی لا یجب قضاؤها"}, {r:39,n:"لو نسی قضاء السجدة أو التشهّد وتذکّر بعد الدخول فی نافلةٍ أو فریضةٍ جاز له قطعها والإتیان به"}, {r:40,n:"فیما لو کان علیه قضاء السجدة أو التشهّد فی صلاة الظهر وضاق وقت صلاة العصر"}, {r:41,n:"الأُمور التی توجب سجود السهو: ◂ الأول: الکلام سهواً بغیر قرآن ودعاء وذکر ، المتحقّق بحرفین أو حرفٍ واحدٍ مُفْهِمٍ فی ◂ الثانی: السلام فی غیر محلّه سهواً ، سواء کان بقصد الخروج بتخیّل إتمام الصلاة ، أم لا بقصده ◂ الثالث: نسیان السجدة الواحدة لو فات محلّ تدارکها ولم یتذکّر إلاّ بعد الرکوع أو السلام ◂ الرابع: إذا نسی التشهّد وفات محلّ تدارکه ◂ الخامس: فی الشکّ بین الأربع والخمس بعد إکمال السجدتین ، کما مرّ فی شکوک الصلاة ◂ السادس: للقیام فی موضع القعود أو العکس، بل لکلّ زیادة ونقیصة لم تُذکر فی محل التدارک"}, {r:42,n:"وجوب تکرار سجود السهو بتکرّر الموجب ، من نوع واحد کان أو من أنواع ، والکلام الواحد موجب واحد"}, {r:43,n:"فیما لو سها عن سجدة واحدة من الرکعة الأُولی مثلاً وقام وقرأ وقنت وکبّر للرکوع فتذکّر قبل الرکوع"}, {r:44,n:"لا یجب فی سجود السهو تعیین السبب ولو مع التعدّد ، ولا الترتیب فی أسبابه"}, {r:45,n:"حکم ما لو سجد سجود السهو للکلام فبان أنّ الموجب غیره"}, {r:46,n:"وجوب الإتیان والمبادرة بسجود السهو فوراً، فإن أخّر عمداً عصی ولم یسقط"}, {r:47,n:"فی کیفیّة سجود السهو وصیغته ◂ التخییر فی إتیان تشهّد سجود السهو بالتشهّد المتعارف، أو الخفیف"}, {r:48,n:"عدم وجوب سجود السهو لو شکّ فی تحقّق موجبه، وعکسه فی الزیادة والنقیصة"}, {r:49,n:"فیما لو شکّ فی إتیان سجود السهو بعد العلم بوجوبه"}, {r:50,n:"عدم وجوب سجود السهو فیما لو اعتقد وجود الموجب وبعد السلام شکّ فیه"}, {r:51,n:"البناء علی الأقلّ فیما لو علم بوجود الموجب وشکّ فی الأقلّ والأکثر"}, {r:52,n:"فیما لو علم نسیان جزءٍ وشکّ بعد السلام بأنّه تذکّر قبل فوت محلّه وتدارکه أم لا"}, {r:53,n:"لو شکّ فی فعلٍ من أفعاله فی محلّه أتی به، وإن تجاوز لم یلتفت"}, {r:54,n:"فیما لو شکّ فی أنّه سجد سجدتَین أو واحدة"}, {r:55,n:"الأول: الشکّ بعد تجاوز المحلّ ◂ الثانی: الشکّ بعد الوقت ، سواء فی الشروط أو الأفعال أو الرکعات أو أصل الإتیان ◂ الثالث: الشکّ بعد السلام ◂ المواضع التی لا یُعتنی بالشکّ فیها: ◂ الرابع: شکّ کثیر الشکّ وإن لم یصل حدّ الوسواس ◂ الرجوع إلی العرف فی کثرة الشکّ"}, {r:56,n:"لو شکّ فی حصول حالة کثرة الشکّ أم لا بنی علی العدم"}, {r:57,n:"الحکم فیما لو لم یلتفت إلی شکّه وظهر بعد ذلک خلاف ما بنی علیه"}, {r:58,n:"عدم جواز الاعتناء بالشکّ ، وعدم جواز الرجوع إلی المشکوک لو کان رکناً"}, {r:59,n:"لو شکّ فی اختصاص کثرة شکّه بموردٍ معیّنٍ أو مطلقاً اقتصر علی ذلک المورد"}, {r:60,n:"کثیر الشکّ وغیره لا یجب علیه ضبط عدد الرکعات بالحصی أو السُبحة ولو کان أفضل ◂ الخامس: الشکّ البَدویّ الزائل بعد التَرَوّی ◂ السادس: شکّ کلٍّ من الإمام والمأموم مع حفظ الآخر"}, {r:61,n:"عدم رجوع الإمام إلی المأمومین إذا کان شاکّاً وهم مختلِفِین، إلاّ بعد حصول الظنّ بإحدی الفرقتین"}, {r:62,n:"حکم ما لو کان الإمام شاکّاً والمأمومون مختلِفین بعضهم شاکّاً والآخر متیقّناً"}, {r:63,n:"الحکم فیما لو کان کلّ من الإمام والمأمومین شاکّاً اتّحاداً أو اختلافاً أو فی القدر المشترک ◂ السابع: الشکّ فی رکعات النافلة، رکعةً کانت أو رکعتین أو رباعیة"}, {r:64,n:"عدم وجوب قضاء السجدة المنسیّة فی النافلة، ولا التشهّد، ولا سجود السهو لموجباته فیها"}, {r:65,n:"فیما لو شکّ فی النافلة بین الاثنتین والثلاث فبنی علی الاثنتین ثمّ تبیّن کونها ثلاثاً"}, {r:66,n:"لو شکّ فی أصل فعل الصلاة بنی علی العدم، إلاّ إذا کانت موقّتةً وخرج وقتها"}, {r:67,n:"فی حکم الظنّ فی رکعات النافلة"}, {r:68,n:"الحکم فی نسیان کیفیّة النوافل التی لها کیفیّة خاصّة أو سورة خاصّة أو دعاء خاصّ کالغُفَیلة وغیرها"}, {r:69,n:"إنّ کلّ ما ذکر من أحکام السهو والشکّ والظنّ یجری فی جمیع الصلوات الواجبة أداءً وقضاءً"}, {r:70,n:"فی الفرق بین الظنّ المتعلّق بالرکعات والظنّ المتعلّق بالأفعال والمتعلّق بالشروط"}, {r:71,n:"جواز تأخیر التروّی إلی وقت العمل بالشکّ إذا حدث الشکّ بین الثلاث والأربع قبل السجدتین أو بینهما"}, {r:72,n:"فی وجوب تعلّم ما یَعُمّ به البلوی من أحکام الشکّ والسهو، والقول ببطلان صلاة من لا یعرفها"}, {r:73,n:"الاُولی: حکم ما لو شکّ فی أنّ ما بیده ظهر أو عصر ◂ الثانیة: فیما لو شکّ فی أنّ ما بیده مغرب أو عشاء مع علمه بإتیانها أو بعدم الإتیان بها ◂ الثالثة: حکم ما لو علم بعد الصلاة أو فی أثنائها أنّه ترک سجدتین من رکعتین ◂ الرابعة: الحکم فیما إذا کان فی الرکعة الرابعة مثلاً وشکّ فی أنّ شکّه السابق بین الأثنتین والثلاث کان قبل إکمال السجدتین أو بعدهما ◂ الخامسة: إذا شکّ فی أنّ الرکعة التی بیده آخر الظهر، أو أنّه أتمّها وهذه أول العصر جعلها آخر الظهر ◂ السادسة: فیما إذا شکّ فی العشاء بین الثلاث والأربع وتذکّر أنّه سها عن المغرب ◂ السابعة: الحکم فیما لو تذکّر فی أثناء العصر أنّه ترک من الظهر رکعةً ◂ الثامنة: فیما لو صلّی صلاتین ثمّ علم نقصان رکعةٍ أو رکعتین من إحداهما من غیر تعیین ◂ التاسعة: حکم ما لو شکّ بین الاثنتین والثلاث ثمّ شکّ فی أنّ الرکعة التی بیده آخر صلاته أو اُولی صلاة الاحتیاط ◂ العاشرة: فیما لو شکّ بأنّ الرکعة التی بیده رابعة المغرب، أو أنّه سلَّم علی الثلاث وهذه اُولی العشاء ◂ الحادیة عشرة: حکم ما لو شکّ وهو جالس بعد السجدتین بین الاثنتین والثلاث وعلم بعدم إتیان التشهّد ◂ الثانیة عشرة: الحکم فیما لو شکّ فی أنّه بعد الرکوع من الثالثة أو قبل الرکوع من الرابعة بنی علی الثانی ◂ الثالثة عشرة: فیما لو کان قائماً وهو فی الرکعة الثانیة، وعلم أنّه أتی برکوعین ولم یعلم أیّهما ◂ الرابعة عشرة: الحکم فیما لو علم بعد الفراغ أنّه ترک سجدتین ولم یدرِ أنّهما من رکعةٍ أو رکعتین ◂ الخامسة عشرة: فیما لو علم أنّه بعد ما دخل فی السجدة الثانیة مثلاً أنّه: إمّا ترک القراءة أو الرکوع أو غیرهما ◂ السادسة عشرة: حکم ما لو علم قبل أن یدخل فی الرکوع أنّه: إمّا ترک سجدتین من السابقة أو القراءة ◂ السابعة عشرة: فیما إذا علم بعد القیام إلی الثالثة أنّه ترک التشهّد وشکّ فی ترکه السجدة أم لا ◂ الثامنة عشرة: الحکم فیما لو علم إجمالاً أنّه أتی بأحد الأمرین من السجدة والتشهّد من غیر تعیین وشکّ فی الآخر ◂ التاسعة عشرة: فیما لو علم أنّه: إمّا ترک السجدة من الرکعة السابقة، أو التشهّد من هذه الرکعة ◂ العشرون: حکم ما لو علم أنّه ترک سجدة إمّا من الرکعة السابقة، أو من هذه الرکعة ◂ الحادیة والعشرون: الحکم فیما إذا علم أنّه إمّا ترک جزءاً مستحبّیّاً کالقنوت أو جزءاً واجباً ◂ الثانیة والعشرون: لا إشکال فی بطلان الفریضة إذا علم إجمالاً أنّه إمّا زاد أو نقص رکناً، بعکس النافلة ◂ الثالثة والعشرون: فیما لو تذکّر وهو فی السجدة أو بعدها من الرکعة الثانیة ترکه سجدة من الاُولی وترکه رکوع هذه ◂ الرابعة والعشرون: حکم ما إذا صلّی الظهر والعصر وعلم بعد السلام نقصان إحدی الصلاتین ◂ السادسة والعشرون: فیما إذا صلّی الظهرین وقبل السلام للعصر علم إجمالاً أنّه: إمّا ترک رکعةً من الظهر وما بیده رابعة العصر ، أو أنّ ظهره تامّة وهذه ثالثة العصر ◂ الخامسة والعشرون: الحکم فیما لو صلّی المغرب والعشاء ثمّ علم بعد سلام العشاء نقصه رکعةً من إحداهما ◂ السابعة والعشرون: فیما لو علم أنّه صلّی الظهرین ثمانِ رکعات، ولکن لم یدرِ أنّه صلّی کلاًّ منهما أربع رکعات، أو نقص من إحداهما رکعة وزاد فی الأُخری ◂ الثامنة والعشرون: حکم ما إذا علم أنّه صلّی الظهرین ثمانِ رکعات، وقبل سلام العصر شکّ فی أنّه هل صلّی الظهر أربعاً وما بیده رابعة العصر، أو نقص من الظهر رکعةً فسلّم علی الثلاث وما بیده خامسة العصر ؟ ◂ التاسعة والعشرون: فیما لو انعکس الفرض السابق بأن شکّ فی أنّه صلّی الظهر أربعاً وما بیده رابعة العصر ، أو صلاّها خمساً وما بیده ثالثة العصر ◂ الثلاثون: حکم ما إذا علم أنّه صلّی الظهرین تسع رکعاتٍ ولم یدرِ أنّه زاد رکعةً فی الظهر أو فی العصر ◂ الحادیة والثلاثون: فیما إذا علم أنّه صلّی العشاءَین ثمانِ رکعاتٍ ولم یدرِ أنّه زاد الرکعة الزائدة فی المغرب أو فی العشاء ◂ الثانیة والثلاثون: الحکم فیما لو أتی بالمغرب ثمّ نسی الإتیان بها باعتقاد عدم الإتیان، أو شکّ فیه فأتی بها ثانیاً وتذکّر قبل السلام إتیانه بها، ولکن علم بزیادة رکعةٍ إمّا فی الاُولی أو الثانیة ◂ الثالثة والثلاثون: إذا شکّ فی الرکوع وهو قائم وجب علیه الإتیان به، فلو نسی حتّی دخل فی السجود فهل یجری علیه حکم الشکّ بعد تجاوز المحلّ، أولا؟ ◂ الرابعة والثلاثون: فیما لو علم نسیان شیءٍ قبل فوات محلّ المنسیِّ وجب علیه التدارک، فنسی حتی دخل فی رکنٍ بعده، ثمّ انقلب علمه بالنسیان شکّاً ◂ الخامسة والثلاثون: حکم ما لو اعتقد نقصان السجدة أو التشهّد، أو ترک ما یوجب سجود السهو فی أثناء الصلاة، ثمّ تبدّل اعتقاده بالشکّ أو بعد الصلاة قبل الإتیان ◂ السادسة والثلاثون: فیما لو تیقّن بعد السلام وقبل إتیان المنافی عمداً أو سهواً نقصان الصلاة وشکّ بأنّ الناقص رکعة أو رکعتان ◂ السابعة والثلاثون: الحکم فیما لو تیقّن بعد السلام قبل إتیان المنافی نقصان رکعة، ثمّ شکّ أنّه أتی بها أولا ◂ الثامنة والثلاثون: فیما إذا علم أنّ ما بیده رابعة، لکن لا یدری أنّها واقعیة أو بنائیة ◂ التاسعة والثلاثون: إذا تیقّن بعد القیام إلی الرکعة التالیة أنّه ترک سجدة أو سجدتین أو تشهّداً، ثمّ شکّ أنّه هل رجع وتدارک ثم قام، أو هو القیام الأول؟ ◂ الأربعون: فیما إذا شکّ بین الثلاث والأربع مثلاً فبنی علی الأربع، ثمّ أتی برکعةٍ أُخری سهواً ◂ الحادیة والأربعون: إذا شکّ فی رکنٍ بعد تجاوز المحلّ ثمّ أتی به نسیاناً، فهل تبطل صلاته؟ ◂ الثانیة والأربعون: فیما إذا کان فی التشهّد فذکر أنّه نسی الرکوع، ومع ذلک شکّ فی السجدتین أیضاً ◂ الثالثة والأربعون: حکم ما إذا شکّ بین الثلاث والأربع مثلاً وعلم أنّه ترک رکناً أو ما یوجب القضاء أو السهو ◂ الرابعة والأربعون: حکم ما إذا تذکّر بعد القیام أنّه ترک سجدةً من الرکعة التی قام عنها ◂ الخامسة والأربعون: فیما لو علم بعد القیام أو الدخول فی التشهّد نسیان إحدی السجدتین وشکّ فی الأخری ◂ السادسة والأربعون: الحکم فیما إذا شکّ بین الثلاث والأربع مثلاً وبعد السلام قبل صلاة الاحتیاط علم أنّها کانت أربعاً، ثمّ عاد شکّه ◂ السابعة والأربعون: فیما لو دخل فی سجود الرکعة الثانیة وشکّ فی رکوع هذه الرکعة والسجدتین من الأولی ◂ الثامنة والأربعون: عدم جریان حکم کثیر الشکّ فی صورة العلم الإجمالی ◂ التاسعة والأربعون: حکم ما لو اعتقد أنّه قرأ السورة مثلاً وشکّ فی قراءة الحمد، فبنی علی القراءة لتجاوز المحلّ، ثمّ فی القنوت تذکّر أنّه لم یقرأ السورة ◂ الخمسون: فیما لو علم أنّه: إمّا ترک سجدةً، أو زاد رکوعاً ◂ الحادیة والخمسون: حکم ما لو علم أنّه: إمّا ترکَ سجدةً من الاُولی، أو زاد فی الثانیة ◂ الثانیة والخمسون: لو علم أنّه: إمّا ترک سجدةً أو تشهّداً وجب الإتیان بقضائهما وسجدتا السهو مرّةً ◂ الثالثة والخمسون: الحکم فیما إذا شکّ فی أنّه صلّی المغرب والعشاء أم لا قبل أن ینتصف اللیل ◂ الرابعة والخمسون: فیما إذا صلّی الظهر والعصر ثمّ علم إجمالاً أنّه شکّ فی إحداهما بین الاثنتین والثلاث ولا یدری أنّ الشکّ المذکور فی أیّهما کان ◂ الخامسة والخمسون: إذا علم إجمالاً أنّه إمّا زادَ قراءةً أو نَقَصَها یکفیه سجدتا السهو مرّةً ◂ السادسة والخمسون: فیما إذا شکّ بین الاثنتین والثلاث فبنی علی الثلاث، ثمّ شکّ بین الثلاث البنائیة والأربع ◂ السابعة والخمسون: الحکم فیما لو علم أنّه زاد سجدتین ولم یدرِ أنّهما من رکعة أو رکعتین ◂ الثامنة والخمسون: إذا شکّ بأنّه هل ترک الجزء الفلانی عمداً أولا؟ فمع بقاء محلّ الشکّ لا إشکال فی وجوب الإتیان به ◂ التاسعة والخمسون: حکم ما إذا توضّأ وصلّی، ثمّ علم أنّه إمّا ترک جزءاً من وضوئه أو رکناً من صلاته ◂ الستّون: فیما لو کان مشغولاً بالتشهّد أو بعد الفراغ منه، وشکّ فی أنّه صلّی رکعتین أو ثلاثاً ◂ الحادیة والستّون: حکم ما لو شکّ فی شیء وقد دخل فی غیره الذی وقع فی غیر محلّه ◂ الثانیة والستّون: فیما لو بقی من الوقت أربع رکعاتٍ للعصر وعلیه صلاة الاحتیاط من جهة الشکّ فی الظهر ◂ الثالثة والستّون: الحکم فیما لو قرأ فی الصلاة شیئاً بتخیّل أنّه ذکر أو دعاء أو قرآن ثمّ تبیّن أنّه کلام الآدمی ◂ الرابعة والستّون: عدم وجوب سجود السهو فیما لو عکس الترتیب الواجب سهواً، کتقدیم السورة علی الحمد وتذکّر فی الرکوع ◂ الخامسة والستّون: إذا وجب علیه قضاء السجدة المنسیّة أو التشهّد ثمّ أبطل صلاته أو انکشف بطلانها سقط وجوبه ◂ السادسة والستّون: الحکم فیما إذا شکّ فی أنّه هل سجد سجدةً واحدةً أو اثنتین أو ثلاثاً؟ ◂ السابعة والستّون: إذا ترک جزءاً من أجزاء الصلاة لجهله بوجوبه فالأفضل إعادة الصلاة وإن لم یکن من الأرکان"}, {r:74,n:"وجوب صلاة العیدین فی زمان حضور المعصوم علیه السلام ، واستحبابها فی زمن الغیبة جماعةً وفرادی ◂ عدم اشتراطها ما یشترط فی الجمعة، ولا بُعد فرسخ بین الجماعتین ◂ وقتها من طلوع الشمس إلی الزوال، ولا قضاء لها لوفاتت ◂ استحباب تأخیرها إلی ارتفاع الشمس، ویستحبّ فی عید الفطر تأخیرها أزید بمقدار الإفطار وإخراج الفِطرة ◂ فی عدد رکعاتها وکیفیتها ◂ عدم اشتراط سورة مخصوصة فیها، بل یجزی کلّ سورة، والأفضل الشمس والغاشیة، أو « سَبِّح اسمَ » والشمس ◂ الأُمور المستحبّة فی صلاة العیدَین ◂ أحدها: الجهر بالقراءة للإمام والمنفرد ◂ الثانی: رفع الیدین حال التکبیرات ◂ الثالث: الإصحار بها، إلاّ فی مکّةَ فَأنّه یستحبّ الإتیان بها فی المسجد الحرام ◂ الرابع: السجود علی الأرض دون غیرها ممّا یصحّ السجود علیه ◂ الخامس: الخروج إلیها راجلاً حافیاً مع السکینة والوقار ◂ السادس: الغُسل قبلها ◂ السابع: لبس العمامة البیضاء ◂ الثامن: أن یُشمّر ثوبه إلی ساقه ◂ التاسع: الإفطار فی صباح عید الفطر بالتمر، والأکل من لحم الأضحیة فی الأضحی ◂ العاشر: التکبیرات عقیب أربع صلوات فی عید الفطر ◂ فی کیفیة التکبیر فی یوم عید الفطر ◂ الاُمور المکروهة فی صلاة العیدَین ◂ الثالث: نقل المِنبر إلی الصحراء"}, {r:75,n:"الأول: الخروج مع السلاح، إلاّ فی حال الخوف ◂ الثانی: النافلة قبل صلاة العید وبعدها إلی الزوال، إلاّ فی مدینة الرسول صلی الله علیه و آله ◂ الرابع: الصلاة تحت السَقف"}, {r:76,n:"الأفضل ترک النساء لهذه الصلاة إلاّ العجائز"}, {r:77,n:"عدم تحمّل الإمام فی هذه الصلاة إلاّ القراءة والأذکار والتکبیرات والقنوتات"}, {r:78,n:"لو شکّ فی التکبیرات والقنوتات بنی علی الأقلّ"}, {r:79,n:"فیما لو أدرک مع الإمام بعض التکبیرات"}, {r:80,n:"لو سها عن القراءة أو التکبیرات أو القنوتات کُلاًّ أو بعضاً لم تبطل، بعکس السهو عن الرکوع والسجدتین"}, {r:81,n:"الحکم فیما لو أتی بموجب سجود السهو فی صلاة العیدَین"}, {r:82,n:"لیس فی صلاة العیدین أذان ولا إقامة، بل یستحبّ القول: «الصلاة» ثلاثاً"}, {r:83,n:"فیما لو اتّفق العید والجمعة فمن کان نائیاً عن البلد اختار العَود لأهله أوالبقاء لحضور الجمعة"}, {r:84,n:"فی عدد رکعات صلاة لیلة الدفن وکیفیّتها ◂ لا بأس بالاستئجار لهذه الصلاة وإعطاء الاُجرة بعنوان التبرّع والإحسان"}, {r:85,n:"جواز إتیان شخص واحد أزید من واحدة بقصد إهداء الثواب متبرّعاً أو بإذن المستأجر"}, {r:86,n:"الحکم فیما لو صلّی ونسی آیة الکرسی فی الاُولی أو القدر فیالثانیة، أو قرأ القدر أقلّ من العشرة نسیاناً"}, {r:87,n:"إذا أخذ الاُجرة لیُصلّی فنسی فترکها فی تلک اللیلة وجب علیه ردّها إلی المُعطی"}, {r:88,n:"إذا لم یُدفن المیّت إلاّ بعد مدّةٍ فالظاهر أنّ الصلاة تؤخَّر إلی لیلة الدفن"}, {r:89,n:"ذکر روایة الکفعمی فی کیفیة صلاة لیلة الدفن"}, {r:90,n:"جواز إتیان صلاة لیلة الدفن فی أیّ وقتٍ کان من اللیل، والأفضل التعجیل بها بعد العشاءَین"}, {r:91,n:"فی أنّ صلاة جعفر من المستحبّات الأکیدة، وتسمّی أیضاً: «صلاة التسبیح» و «صلاة الحبوة» ◂ تواتر الأخبار فی شهرة صلاة جعفر بین العامة والخاصّة ◂ ذکر الروایات الواردة فی استحباب الإتیان بصلاة جعفر علیه السلام ◂ فی کیفیة صلاة جعفر بن أبی طالب علیهماالسلام ◂ جواز إتیان هذه الصلاة لیلاً أو نهاراً، سفراً أو حضراً، وذکر أفضل أوقاتها"}, {r:92,n:"عدم تعیین سورة مخصوصة فیها، وذکر أفضل السور الواردة فیها"}, {r:93,n:"جواز تأخیر التسبیحات إلی ما بعد الصلاة، وجواز التفریق لسببٍ ما"}, {r:94,n:"جواز احتساب هذه الصلاة من نوافل اللیل أو النهار أداءً وقضاءً، وذکر روایة الإمام الصادق علیه السلام ◂ فی المراد من الاحتساب فی روایة الإمام الصادق علیه السلام ◂ دفع دعوی تغییر هیئة الفریضة وتوقیفیّة العبادات"}, {r:95,n:"استحباب القنوت فی هذه الصلاة فی الرکعة الثانیة من کلٍّ من الصلاتین؛ للعمومات و"}, {r:96,n:"فیما لو سها المصلّی عن بعض التسبیحات أو کلّها فی محلٍّ فتذکّر فی المحلّ الآخر"}, {r:97,n:"الأفضل عدم الاکتفاء بالتسبیحات عن ذکر الرکوع والسجود، فیأتی به أیضاً قبلها أو بعدها"}, {r:98,n:"یُستحبّ أن یقول فی السجدة الثانیة من الرکعة الرابعة بعد التسبیحات: « یا مَن لَبِسَ العِزّ والوقار... »"}, {r:99,n:"فی عدد رکعاتها ووقتها وکیفیّتها ◂ الکلام فی جعل صلاة الغفیلة نافلة المغرب، أو لا"}, {r:100,n:"استحباب صلاة رکعتین فی الیوم الأول من کلّ شهر ◂ فی کیفیّة صلاة أول الشهر ◂ جواز الإتیان بهذه الصلاة فی تمام الیوم، ولیس لها وقت معیَّن"}, {r:101,n:"فی عدد رکعاتها، وکیفیّتها ◂ فی ثواب الإتیان بصلاة الوصیّة فی کلّ جُمُعةٍ أو کلّ لیلة"}, {r:102,n:"ذکر وقتها، وعدد رکعاتها ◂ فی کیفیّتها، وثواب صلاتها فی یوم الغدیر ◂ فی صحّة دلیلها ومشروعیة الإتیان بها جماعةً"}, {r:103,n:"ذکر ورودها فی کیفیّات متعدّدة، وذکر موضوعها"}, {r:104,n:"منها: نوافل الفرائض الیومیة، وهی ثلاث وعشرون رکعةً مع احتساب رکعتی الوَتیرة بواحدة ◂ ومنها: نافلة اللیل، وهی إحدی عشرة رکعة ◂ ومنها: الصلوات المستحبّة فی أوقات مخصوصة ◂ ومنها: الصلوات التی لها أسباب ◂ ومنها : الصلوات المستحبّة لغایات مخصوصة ◂ ومنها: الصلوات المخصوصة بدون سبب وغایة ووقت ◂ ومنها: النوافل المبتَدَأَة"}, {r:105,n:"جواز إتیان جمیع الصلوات المندوبة جالساً اختیاراً، وماشیاً وراکباً، وفی المَحمِل والسفینة ◂ حکم إتیانها نائماً مستلقیاً أو مضطجعاً حال الاختیار ◂ جواز إتیان النوافل رکعةً قائماً واُخری جالساً، بل بعض الرکعة جالساً وبعضها قائماً ◂ إذا أتی بالنافلة جالساً یستحبّ احتساب کلّ رکعتین برکعة واحدة ◂ فیما لو صلّی جالساً وأبقی من السورة آیةً أو آیتین فقام وأتمّها ورکع عن قیام ◂ لا فرق فی الجلوس بین کیفیّاته، فهو مخیّر بین أنواعها حتّی مَدّ الرِجلَین ◂ حکم ما لو نذر النافلة مطلقاً، أو نذرها جالساً ◂ النوافل کلّها رکعتان، عدم جواز الزیادة علیهما ولا النقیصة، إلاّ فی صلاة الأَعرابی والوَتر ◂ الأحکام المختصّة بالنوافل: ◂ منها: جواز الجلوس والمشی اختیاراً ◂ ومنها: عدم وجوب السورة فیها، إلاّ فی بعض الصلوات المخصوصة بکیفیّات خاصّة ◂ ومنها: جواز الاکتفاء ببعض السورة فیها ◂ ومنها: جواز قراءة أزید من سورة من غیر إشکال ◂ ومنها: جواز قراءة العزائم فیها ◂ ومنها: جواز العدول فیها من سورة إلی اُخری مطلقاً ◂ ومنها: عدم بطلانها بزیادة الرکن فیها سهواً ◂ ومنها: جواز قطعها اختیاراً ◂ ومنها: إتیانها فی البیت أفضل من إتیانها فی المسجد ◂ ومنها: عدم بطلانها بالشکّ بین الرکعات ◂ ومنها: عدم وجوب سجود السهو لها، ولا قضاء السجدة المنسیّة ◂ ومنها: جواز إتیانها فی جوف الکعبة وسطحها ◂ ومنها: عدم مشروعیة الجماعة فیها، إلاّ فی صلاة الاستسقاء، وصلاة الغدیر علی أقوال"}, {r:106,n:"وجوب القصر علی المسافر مع اجتماع الشرائط الآتیة بإسقاط الأخیرتین من الرباعیات ◂ الأوّل: المسافة، وهی ثمانیة فراسخ امتدادیة ذهاباً أو إیاباً، أو ملفّقة منهما ◂ الفرسخ ثلاثة أمیال، ویساوی حالیاً خمسة کیلومترات ونصف تقریباً"}, {r:107,n:"المسافة مبنیّة عن التحقیق، لا المسامحة العرفیة، فلو نقصت عن ثمانیة فراسخ لا یجوز القصر"}, {r:108,n:"لو شکّ فی کون مقصده مسافةً شرعیةً أو لا بقی علی التمام، وکذا لو ظنّ کونها مسافةً"}, {r:109,n:"تثبت المسافة بالعلم الحاصل من الاختبار وبالشیاع والبیّنة الشرعیة، وبالعدل الواحد إشکال"}, {r:110,n:"الأفضل فی عدم الحرج عند الشکّ وجوب الاختبار أو السؤال لتحصیل البیّنة أو الشیاع المفید للعلم"}, {r:111,n:"الحکم فیما لو تعارضت البیّنتان"}, {r:112,n:"فیما لو شکّ فی مقدار المسافة شرعاً"}, {r:113,n:"حکم ما لو کان شاکّاً فی المسافة ومع ذلک قصّر"}, {r:114,n:"فیما لو اعتقد کونه مسافةً فقصّر ثمّ ظهر عدمها، أو اعتقد عدم کونه مسافةً فأتمّ ثم ظهرالعکس"}, {r:115,n:"لو شکّ فی کونه مسافةً، أو اعتقد العدم ثمّ بان فی أثناء السیر کونه مسافةً یقصّر"}, {r:116,n:"الحکم فیما لو قصد الصبیّ مسافةً ثمّ بلغ، أو أراد التطوّع بالصلاة مع عدم بلوغه"}, {r:117,n:"لو تردّد فی أقلّ من أربعة فراسخ ذاهباً وجائیاً مرّاتٍ حتّی بلغ المجموع ثمانیةً لم یقصّر"}, {r:118,n:"حکم ما لو کان للبلد طریقان والأبعد منهما مسافة"}, {r:119,n:"الحکم فی المسافة المستدیرة"}, {r:120,n:"فی مبدأ حساب المسافة فی المدن الکبار والمتوسّطات والصغار التی لا سُورَ لها ◂ الشرط الثانی: قصد قطع المسافة من حین الخروج"}, {r:121,n:"عدم اعتبار اتّصال السیر مع قصد المسافة، فیقصّر وإن کان قصده قطع ثمانیة فی أیّام"}, {r:122,n:"لا یعتبر فی قصد المسافة أن یکون مستقلاًّ، بل یکفی ولو من جهة التبعیّة والطاعة کالزوجة والعبد"}, {r:123,n:"فیما لو علم التابع بمفارقة المتبوع قبل بلوغ المسافة ولو ملفّقة"}, {r:124,n:"الحکم فیما لو کان التابع عازماً علی المفارقة مهما أمکنه، أو معلّقاً لها علی حصول أمرٍ کالعتق أو الطلاق"}, {r:125,n:"فیما لو اعتقد التابع أنّ متبوعه لم یقصد المسافة، أو شکّ فی ذلک وفی الأثناء علم أنّه قاصد لها"}, {r:126,n:"الحکم فیما إذا کان مُکرَهاً علی السفر أو اُجبِر علیه، أو اُلقی فی السفینة من دون اختیاره ◂ الشرط الثالث: استمرار قصد المسافة، فلو عدل عنه قبل بلوغ الأربعة أو تردّد أَتَمَّ"}, {r:127,n:"فی کفایة بقاء قصد النوع فی استمرار القصد وإن عدل عن الشخص"}, {r:128,n:"الحکم فیما لو تردّد فی الأثناء ثمّ عاد إلی الجزم قبل قطع مسافةٍ من الطریق أو بعده"}, {r:129,n:"عدم وجوب إعادة ما صلاّه قصراً فی وقته قبل العدول عن قصده فضلاً عن قضائه خارجه"}, {r:130,n:"الرابع: أن لا یکون من قصده فی أوّل السیر أو أثنائه إقامة عشرة أیّام قبل بلوغ الثمانیة ◂ الحکم فیما لو کان حین الشروع فی السفر أو أثنائه قاصداً الإقامة أو متردّداً فی ذلک وعدل عن تردیده"}, {r:131,n:"فیما لو لم یکن ناویاً أوّل السفر الإقامة أو المرور علی الوطن وقطع مقداراً من المسافة، ثم بدا له ذلک، ثم عدل ◂ الخامس من الشروط: أن لا یکون السفر حراماً، وإلاّ لم یقصّر"}, {r:133,n:"إذا کان السفر مستلزماً لترک واجب کالفِرار من الدَین ونحوه فهل یوجب التمام، أم لا؟ ◂ حکم ما إذا کان السفر مباحاً لکن رکب دابّةً غصبیّة، أو کان المشی فی أرضٍ مغصوبة"}, {r:134,n:"التابع للجائر المجبور أوالمُکره ، أو کان قصده دفع مظلمةٍ أو نحوها من الأعمال الراجحة قصّر ، وبعکسه یُتمّ"}, {r:135,n:"حکم ما لو کان التابع للجائر المعدّ نفسه لطاعته لو أمره بالسفر فسافر امتثالاً لأمره، سواء أُعدّ إعانةً له، أم لم یُعدَّ إعانة علی الظلم"}, {r:136,n:"الحکم فیما لو سافر للصید لقوت عیاله والتجارة، أو لِلّهو کما عند أبناء الدنیا"}, {r:137,n:"الراجع من سفر المعصیة إن کان بعد التوبة یُقصِّر، وإن کان مع عدم التوبة فلا یبعد وجوب التمام علیه"}, {r:138,n:"إباحة السفر کما أنّها شرط فی الابتداء فکذلک شرط فی الاستدامة"}, {r:139,n:"حکم ما لو کانت غایة السفر ملفّقة من الطاعة والمعصیة"}, {r:140,n:"فیما لو شکّ فی کون السفر معصیةً أو لا مع کون الشبهة موضوعیة"}, {r:141,n:"هل المدار فی الحلّیّة والحرمة علی الواقع، أو الاعتقاد، أو الظاهر من جهة الاُصول إشکال؟"}, {r:142,n:"فیما لو کانت الغایة المحرّمة فی أثناء الطریق لکن کان السفر إلیه مستلزماً لقطع مقدار آخر من المسافة"}, {r:143,n:"السفر بقصد مجرّد التنزّه لیس بحرام، ولا یوجب التمام"}, {r:144,n:"فی حکم ما لو نذر أن یتمّ الصلاة فی السفر فی یومٍ معیّنٍ أو یصوم یوماً معیّناً"}, {r:145,n:"فیما إذا کان سفره مباحاً لکن یقصد الغایة المحرَّمة فی حواشی الطریق فیخرج عنه لمحرَّمٍ ویرجع إلیه"}, {r:146,n:"الحکم فیما لو قصد مکاناً لغایةٍ محرّمة، وحاله لو تاب، أو لو لم یتب"}, {r:147,n:"فیما لو کان السفر لغایةٍ لکن عرض فی أثناء الطریق قطع مقدار من المسافة لغرضٍ محرّمٍ منضمّاً إلی الفرض الأوّل"}, {r:148,n:"فی حکم ما لو کان السفر فی الابتداء معصیةً فقصد الصوم، ثمّ عدل فی الأثناء إلی الطاعة"}, {r:149,n:"جواز الإتیان بالصوم النَدِبیّ فی سفر المعصیة، ولا یسقط عنه الجمعة ولا نوافل النهار ◂ السادس من الشرائط: أن لا یکون ممّن بیته معه، کأهل البوادی الذین لامسکن لهم؛ لعدم صدق المسافر علیهم ◂ السابع: أن لا یکون ممّن اتّخذ السفر عملاً له، کالمُکاری والملاّح والسائق والساعی ونحوهم"}, {r:150,n:"الحکم بشأن الحَملَداریة الذین یتّخذون السفر عملاً فی أشهر الحجّ والزیارة لا علی طول السنة ◂ إذا سافر المُکاری ونحوه ممّن شغله السفر لغیر عمله کالحجّ أو الزیارة فإنّه یقصّر، وبعکسه لا یقصّر"}, {r:152,n:"فیمن کان شغلُه المکاراة فی الصیف دون الشتاء، أو بالعکس"}, {r:153,n:"حکم مَن کان التردّد إلی ما دون المسافة عملاً له، کالحطّاب ونحوه"}, {r:154,n:"فی اعتبار التمام علی استمرار مَن شغله السفر عدم إقامته فی بلده أو غیره عشرة أیّام"}, {r:155,n:"الحکم فیما إذا لم یکن عمله السفر لکن عرض له عارض فسافر أسفاراً عدیدة"}, {r:156,n:"فی عدم اعتبار فیمَن شغله السفر اتّحاد کیفیّات وخصوصیّات أسفاره من حیث الطُول والقُصر"}, {r:157,n:"السائح فی الأرض الذی لم یتّخذ وطناً منها یُتمّ، والأفضل الجمع"}, {r:158,n:"الراعی الذی لیس له مکان مخصوص یُتمّ"}, {r:159,n:"التاجر الذی یدور فی تجارته یُتمّ"}, {r:160,n:"المسافِر المُعرِض عن وطنه ولم یتّخذ وطناً غیره یُقصِّر"}, {r:161,n:"فیمن کان فی أرضٍ واسعة اتّخذها مقرّاً له، لکنّه فی کلِّ سنةٍ فی مکانٍ منها"}, {r:162,n:"إذا شکّ بأنّه أقام فی منزله أو بلدٍ آخر عشرة أیّامٍ أو أقلَّ بقی علی التمام ◂ الثامن: الوصول إلی حدّ الترخّص، وهو المکان الّذی تتواری عنه جدران البلد"}, {r:163,n:"فی کفایة تحقّق أحد فردَی الترخّص ـ تواری الجدران أو خفاء الأذان ـ مع عدم العلم بتحقّق الآخر أو مع العلم ◂ الحکم فیما لو تحقّق أحد سَبَبَی الترخّص دون الآخر ◂ المناط فی خفاء الجدران: خفاء جدران البیوت، لا خفاء الأعلام والقِباب والمَنارات"}, {r:164,n:"الحکم فیما لو کان البلد فی مکان مرتفع، أو مکان منخفض، أو مانع یمنع عن رؤیته، أو البیوت علی خلاف المعتاد علوّاً وانخفاضاً"}, {r:165,n:"إذا لم یکن هناک بیوت ولا جدران یُعتبر التقدیر، وفی بیوت الأعراب ونحوهم یکفی خفاؤها بلا تقدیر"}, {r:166,n:"الظاهر فی خفاء الأذان کفایة عدم تمیّز فصوله، وإن کان اعتبار خفاء مطلق الصوت أفضل"}, {r:167,n:"عدم کون الأذان فی آخر البلد فی البلدان الصغیرة والمتوسّطة ، بل المدار أذانها"}, {r:168,n:"فی اعتبار کون الأذان علی مرتفعٍ معتادٍ فی أذان ذلک البلد، ولو منارة متعارفة فی العُلُوّ"}, {r:169,n:"المدار فی عین الرائی واُذُن السامع علی المتوسّط فی الرؤیة والسَماع فی الهواء الخالی من الغبار والریح"}, {r:170,n:"الأفضل عدم اختصاص اعتبار حدّ الترخّص بالوطن فیجری فی محلّ الإقامة أیضاً"}, {r:171,n:"کما أنّه لا فرق فی الوطن بین ابتداء السفر والعود منه فی اعتبار الترخّص کذلک فی محلّ الإقامة ◂ إذا شکّ فی البلوغ إلی حدّ الترخّص بنی علی عدمه، فیبقی علی التمام فی الذهاب، وعلی القصر بعکسه"}, {r:172,n:"الحکم فیما إذا کان فی السفینة أو العربة فشرع بالصلاة قبل حدّ الترخّص بنیّة التمام ثمّ فی الأثناء وصل إلیه"}, {r:173,n:"فیما لو اعتقد الوصول إلی الحدّ فصلّی قصراً، ثمّ بان أنّه لم یَصِلْ إلیه"}, {r:174,n:"الحکم فیما إذا سافر من وطنه وجاز حدّ الترخّص، ثمّ فی أثناء الطریق وصل إلی مادونه ◂ إذا سافر من محلّ الإقامة وجاز عن الحدّ، ثمّ وصل إلی ما دونه أو رجع فی الأثناء لحاجةٍ بقی علی التقصیر"}, {r:175,n:"فی المسافة الدَوریة حول البلد دون الترخّص فی تمام الدَور أو بعضه ممّا لم یبقَ قبله أو بعده مسافة یُتمّ الصلاة"}, {r:176,n:"أحدها: الوطن، فإنّ المرور علیه قاطع للسفر وموجب للتمام مادام فیه ◂ المراد بالوطن: المکان الذی اتّخذه مسکناً ومقرّاً له دائماً، بلداً کان أو قریةً، ◂ فیما لو أعرض عن وطنه الأصلیّ أوالمستجدّ وتوطّن فی غیره ولم یکن له فیه مِلک ◂ فی إعراضه عن وطنه الأصلیّ وتوطّنه فی غیره وله فیه مِلک سَکَنَ فیه واتّخذهُ وطناً له دائماً ◂ فی بیان الوطن العُرفی والوطن الشرعی"}, {r:177,n:"فی إمکان تعدّد الوطن العرفی"}, {r:178,n:"لا یبعد کون الولد تابعاً لأبویه أو أحدهما فی الوطن ما لم یُعرِض بعد بلوغه عن مقرّهما"}, {r:179,n:"زوال حکم الوطنیّة بالإعراض والخروج وإن لم یتّخذ بعدُ وطناً آخر"}, {r:180,n:"عدم اشتراط إباحة المکان الذی فیه فی الوطن، فالدار المغصوبة المسکونة فی البلد یعتبر ذلک البلد وطناً له"}, {r:181,n:"الحکم فیما إذا تردّد بعد العزم علی الوطن أبداً"}, {r:182,n:"فی اعتبار قصد التوطّن أبداً فی صدق الوطن العرفی فی کلمات العلماء رحمهم الله ◂ الثانی من قواطع السفر: العزم علی إقامة عشرة أیّامٍ متوالیاتٍ فی مکان واحد من بلدٍ أو قریة"}, {r:183,n:"یشترط فی الإقامة: وحدة محلّ الإقامة، فلو قصد الإقامة فی أمکنة متعدّدة لم ینقطع حکم السفر ◂ لا یُعتبر فی نیّة الإقامة قصد عدم الخروج عن خطّة سور البلد ◂ المدار فی محلّ الإقامة علی صدق الوحدة عرفاً، فلا یجب التضییق لو کان محلّ الإقامة برّیّة قَفراء"}, {r:184,n:"عدم جواز التوسیع کثیراً فی محلّ الإقامة بحیث یخرج عن صدق وحدة المحلّ"}, {r:185,n:"الحکم فیما لو علّق الإقامة علی أمرٍ مشکوکِ الحصول، بل وکذا علی مظنون الحصول"}, {r:186,n:"المجبور علی الإقامة عشراً والمُکرَه علیها یجب علیه التمام وإن کان من نیّته الخروج"}, {r:187,n:"عدم صحّة نیّة الإقامة فی بیوت الأعراب ونحوها ما لم یطمئنّ بعدم الرحیل عشرة أیّام"}, {r:188,n:"الزوجة والعبد إذا قصدا المقام بمقدار ما قصده الزوج والسید لا یبعد کفایته فی تحقّق الإقامة لهما"}, {r:189,n:"فیما إذا قصد المُقام إلی آخر الشهر مثلاً وکان عشرة أیّام وإن کان عالماً أو غیر عالم"}, {r:190,n:"حکم ما إذا عزم علی إقامة عشرة أیّام ثمّ عدل عن قصده"}, {r:191,n:"فیما لو صلّی رباعیةً بتمامٍ بعد العزم علی الإقامة، ثمّ عدل غافلاً عن إقامته"}, {r:192,n:"عدم الاشتراط فی تحقّق الإقامة کونه مکلّفاً بالصلاة، فلو نوی الإقامة وهو غیر بالغ ثمّ بلغ فی أثناء العشرة وجب علیه التمام"}, {r:193,n:"الحکم فیما إذا فاتته الرباعیة بعد العزم علی الإقامة ثمّ عدل عنها بعد الوقت"}, {r:194,n:"العدول عن الإقامة قبل الصلاة تماماً قاطع لها من حینه، ولیس کاشفاً عن عدم تحقّقها من الأوّل"}, {r:195,n:"لا فرق فی العدول عن قصد الإقامة بین أن یعزم علی عدمها أو یتردّد فیها"}, {r:196,n:"لو عزم الإقامة فنوی الصوم، ثمّ عدل بعد الزوال قبل الصلاة رجع إلی القصر فی صلاته وصومه صحیح"}, {r:197,n:"إذا تمّت العشرة یبقی علی التمام ما لم یُنشئ سفراً جدیداً، ولا حاجة إلی إقامة جدیدة"}, {r:198,n:"کما أنّ الإقامة موجبة للصلاة تماماً ولوجوب أو جواز الصوم کذلک موجبة لاستحباب النوافل الساقطة حال السفر"}, {r:199,n:"الصور المتمثّلة فیما لو تحقّقت الإقامة وتمّت العشرة أوّلاً وبدا للمقیم الخروج ما دون المسافة ولو ملفّقة: ◂ الصورة الاُولی: أن یکون عازماً علی العود إلی محلّ الإقامة واستأنف إقامة عشرةٍ اُخری ◂ الثانیة: أن یکون عازماً علی عدم العود إلی محلّ الإقامة، وحکمه وجوب القصر ◂ الثالثة: أن یکون عازماً علی العود إلی محلّ الإقامة من دون إقامةٍ مستأنفة ◂ الرابعة: أن یکون عازماً علی العود إلیه بأن لا یکون حین الخروج مُعرِضاً عنه ◂ الخامسة: أن یکون عازماً علی العود إلی محلّ الإقامة لکن مع التردّد فی الإقامة بعد العود وعدمها ◂ السادسة: أن یکون عازماً علی العود مع الذُهُول عن الإقامة وعدمها ◂ السابعة: أن یکون متردّداً فی العود وعدمه، أو ذاهلاً عنه"}, {r:200,n:"الحکم فیما إذا بدا للمقیم السفر، ثمّ بدا له العود إلی محلّ الإقامة والبقاء عشرة أیّام"}, {r:201,n:"فیما لو دخل فی الصلاة بنیّة القصر ثمّ بدا له الإقامة، أو لو نوی الإقامة ودخل فی الصلاة بنیّة التمام فبدا له السفر"}, {r:202,n:"عدم الفرق فی إیجاب الإقامة لقطع حکم السفر وإتمام الصلاة بین أن تکون محلّلةً أو محرّمة"}, {r:203,n:"إذا کان علیه صوم واجب غیر رمضان کالنذر أو الاستئجار وجب علیه الإقامة مع الإمکان"}, {r:204,n:"إشکالیة جواز الإقامة فیما إذا بقی من الوقت أربع رکعاتٍ وعلیه الظهران؛ لتفویت الظهر وصیرورتها قضاءً"}, {r:205,n:"إذا نوی الإقامة ثمّ عدل عنها وشکّ فی عدوله فیرجع إلی القصر"}, {r:206,n:"فیما لو علم بعد نیّة الإقامة بصلاة أربع رکعاتٍ والعدول عن الإقامة، ولکن شکّ فی المتقدّم منهما مع الجهل بتاریخهما"}, {r:207,n:"إذا صلّی تماماً ثمّ عدل ولکن تبیّن بطلان صلاته رجع إلی القصر، وکان کمن لم یصلِّ"}, {r:208,n:"الحکم فیما إذا نوی الإقامة ثمّ عدل عنها بعد خروج وقت الصلاة وشکّ بأنّه صلّی أوْ لا؟"}, {r:209,n:"الظاهر الکفایة فی البقاء علی التمام فیما لو عدل عن الإقامة بعد الإتیان بالسلام الواجب قبل السلام الأخیر"}, {r:210,n:"صورتا المسألة فیما لو اعتقد أن رفقاءَه قصدوا الإقامة فقصدها، ثمّ تبیّن أ نهم لم یقصدوا فهل یبقی علی التمام، أوْ لا؟ ◂ الثالث من القواطع: التردّد فی البقاء وعدمه ثلاثین یوماً إذا کان بعد بلوغ المسافة"}, {r:211,n:"یلحق بالتردّد: ما إذا عزم علی الخروج غداً أو بعد غدٍ ثمّ لم یخرج إلی مُضیِّ ثلاثین یوماً"}, {r:212,n:"وجه إلحاق الشهر الهلالی إذا کان ناقصاً بثلاثین یوماً لو تردّد فی أوّل الشهر"}, {r:213,n:"یکفی فی الثلاثین التلفیق إذا کان تردّده فی أثناء الیوم"}, {r:214,n:"عدم الفرق فی مکان التردّد بین کونه بلداً أو قریةً أو مفازة"}, {r:215,n:"اشتراط وحدة مکان التردّد، فلو کان بعض الثلاثین فی مکان وبعضه فی مکان آخر لم یقطع حکم التردّد"}, {r:216,n:"فی حکم المتردّد بعد الثلاثین یوماً فی مسألة الخروج إلی ما دون المسافة مع قصد العود إلیه"}, {r:217,n:"الحکم فیما إذا تردّد فی مکانٍ تسعةً وعشرین یوماً أو أقلّ ثمّ سار إلی مکان آخر وتردّد فیه کذلک"}, {r:218,n:"حکم المتردّد ثلاثین یوماً لو أنشأ سفراً بقدر المسافة"}, {r:219,n:"وجوب القصر فی الصلوات الرباعیة فیما عدا الأماکن الأربعة ◂ عدم جواز الإتیان بالنوافل النهاریة ولا الوتیرة إلاّ بعنوان الرجاء ◂ إذا دخل علیه الوقت وهو حاضر ثمّ سافر قبل الإتیان بالظهرین یجوز له الإتیان بنافلتهما سفراً ◂ عدم سقوط نافلة الصبح والمغرب ولا صلاة اللیل فی السفر"}, {r:220,n:"عدم بُعد جواز الإتیان بنافلة الظهر فی حال السفر إذا دخل علیه الوقت وهو مسافر"}, {r:221,n:"حکم صلاة المسافر لو صلّی تماماً بعد تحقّق شرائط القصر وکان عالماً بالحکم والموضوع، أو جاهلاً بهما، أو بأحدهما، أو ناسیاً"}, {r:222,n:"حکم الصوم فیما ذُکِر حکم الصلاة، فیبطل مع العلم والعمد، ویصحّ مع الجهل بأصل الحکم دون الجهل بالخصوصیّات والموضوع"}, {r:223,n:"إذا قصّر مَن وظیفته التمام بطلت صلاته فی جمیع الموارد، إلاّ فی المقیم المقصّر للجهل بأنّ حکمه التمام"}, {r:224,n:"الحکم فیما لو کان المسافر جاهلاً بأصل الحکم ولکن لم یُصلِّ فی الوقت، أو کان ناسیاً للسفر أو لحکمه"}, {r:226,n:"فیما لو تذکّر الناسی للسفر أو لحکمه فی أثناء الصلاة، أو تذکّر بعد الصلاة تماماً وبقی من الوقت مقدار رکعة ◂ الظاهر صحّة صلاة المسافر لو قصّر اتّفاقاً لا عن قصد، أو لو کان جاهلاً للقصر فنوی التمام"}, {r:227,n:"الحکم فیما لو دخل علیه الوقت وهو حاضر متمکّن من الصلاة ولم یُصلِّ ثمّ سافر"}, {r:228,n:"فیما إذا فاتت من المسافر الصلاة وکان فی أول الوقت حاضراً وفی آخره مسافراً، أو بالعکس"}, {r:229,n:"فی تخییر المسافر الصلاة قصراً أو تماماً فی الأماکن الأربعة: المسجد الحرام ومسجد النبی صلی الله علیه و آله ومسجد الکوفة والحائر الحسینی"}],
  bk77: [{r:1,n:"اعتبار قصد النوع فی الصوم الواجب ◂ وجوب الصوم وأقسامه وحکم منکره وتارکه ◂ اعتبار القصد والقربة ◂ اعتبار قصد النوع فی الصوم المندوب ◂ کفایة قصد الصوم فی صوم رمضان"}, {r:2,n:"قصد صوم غیر رمضان فی رمضان ◂ المتوخّی وهو من اشتبه علیه شهر رمضان کالمحبوس ونحوه"}, {r:3,n:"قصد الوجه وعدمه فی الصوم ◂ إذا جاء بالمأمور به مع قصد الخلاف خطأً"}, {r:4,n:"العلم بالمفطرات علی التفصیل"}, {r:5,n:"نیّة الجاهل بالمفطر"}, {r:6,n:"نیّة النیابة عن الغیر"}, {r:7,n:"الصوم فی شهر رمضان لغیره"}, {r:8,n:"صوم النذر إذا لم ینوه أو نوی غیره"}, {r:9,n:"التعیین ممّن علیه أکثر من قضاء أو نذر أو کفّارة"}, {r:10,n:"فروع فی التعیین إذا کان العمل واحداً"}, {r:13,n:"وقت النیّة"}, {r:14,n:"فروع فی وقت النیّة"}, {r:15,n:"کیفیة نیة صوم شهر رمضان"}, {r:17,n:"حکم یوم الشک"}, {r:18,n:"کیفیة النیّة فی صوم یوم الشک"}, {r:19,n:"فروع صوم یوم الشک"}, {r:22,n:"نیّة القطع أو القاطع فی أثناء النهار"}, {r:23,n:"عدم لزوم معرفة حقیقة الصوم التفصیلیة"}, {r:24,n:"العدول من صوم الی صوم"}, {r:25,n:"الأول والثانی: الأکل والشرب المعتاد منه وغیره قلّ أو کثر ◂ حکم التخلیل بعد الأکل ممّن یرید الصوم"}, {r:26,n:"حکم ابتلاع البصاق وما یخرج من الصدر"}, {r:28,n:"المدار صدق الأکل والشرب بأیّ نحوٍ کان"}, {r:29,n:"صوم من أنفذ إلی جوفه رمحاً أو نحوه ◂ الثالث : الجماع وإن لم ینزل"}, {r:30,n:"بعض فروع الإنزال وصوره"}, {r:32,n:"حکم الجماع قهراً أو سهواً من غیر اختیار"}, {r:34,n:"حکم ارتکاب المفطر خطأً أو قاصداً مع الخلاف"}, {r:35,n:"حکم مجامعة الخنثی"}, {r:37,n:"الرابع: الاستمناء"}, {r:38,n:"بعض صور مفطریة الاستمناء"}, {r:42,n:"الخامس : تعمّد الکذب علی الله تعالی أو رسوله أو الأئمة (صلوات الله علیهم)"}, {r:43,n:"إلحاق سائر الانبیاء والأوصیاء بنبیّنا (صلی الله علیه وآله)"}, {r:44,n:"فروع فی ما یندرج فی الکذب من العناوین"}, {r:49,n:"حکم الکذب علی الفقهاء والمجتهدین والرواة"}, {r:50,n:"حکم ارتکاب الکذب لأجل الاضطرار والتقیة"}, {r:51,n:"إذا قصد الکذب فتبیّن الصدق وبالعکس"}, {r:52,n:"حکم الکذب هزلاً أو مع عدم القصد"}, {r:53,n:"السادس : إیصال الغبار الغلیظ إلی الحلق ◂ حکم البخار ودخان التتن ◂ السابع : الارتماس فی الماء ◂ مبطلیة رمس الرأس فی الماء"}, {r:54,n:"رمس الرأس فی المضاف وغیره من المائعات"}, {r:55,n:"الکلام فی صدق الارتماس فی بعض الفروض"}, {r:56,n:"حکم ذی الرأسین"}, {r:59,n:"فروع فی مفطریّة الارتماس"}, {r:63,n:"حکم الصوم إذا انحصر الغسل بالارتماس"}, {r:67,n:"قصد الارتماس بالغسل فی غیر شهر رمضان"}, {r:69,n:"الارتماس فی الماء المغصوب"}, {r:70,n:"عدم الفرق بین العالم بحکم الارتماس والجاهل به"}, {r:71,n:"حکم الارتماس فی الوحل والثلج"}, {r:72,n:"حکم الشک فی الارتماس ◂ الثامن : البقاء علی الجنابة عمداً فی شهر رمضان وقضائه ◂ أحکام الجنابة فی صوم غیر شهر رمضان وقضائه ◂ الإصباح جنباً من غیر عمد ◂ الاحتلام فی النهار ◂ النوم علی الجنابة بعد العلم بها ◂ التعجیز الاختیاری کما لو أجنب قبل الفجر متعمداً ◂ البقاء علی حدث الحیض والنفاس"}, {r:73,n:"مَن طهرت من حیضها ولم یسع الوقت للغسل ولا للتیمم ◂ حکم صوم المستحاضة"}, {r:74,n:"من نسی غسل الجنابة فی شهر رمضان وغیره"}, {r:75,n:"من تعذّر علیه الغسل وجب علیه التیمّم قبل الفجر"}, {r:76,n:"هل یبطل التیمم بدل الغسل بالحدث الأصغر أو لا؟"}, {r:77,n:"جواز التأخیر فی غسل من احتلم نهار شهر رمضان"}, {r:78,n:"حکم الصوم إذا علم سبق الاحتلام علی الفجر أو شک"}, {r:79,n:"حکم نوم الجنب قبل الفجر وأقسامه"}, {r:81,n:"حکم نوم الجنب فی صوم غیر شهر رمضان"}, {r:82,n:"فروع فی النوم بعد الجنابة"}, {r:83,n:"حکم النوم مع حدث الحیض والنفاس لیل شهر رمضان"}, {r:84,n:"الشک فی عدد النومات"}, {r:85,n:"من نسی الجنابة أیّاماً من شهر رمضان وشک فی عددها"}, {r:87,n:"قصد الوجوب فی غسل الجنابة قبل الفجر"}, {r:88,n:"إجزاء الصوم من فاقد الطهورین مع الحدث"}, {r:89,n:"عدم مانعیّة حدث مسّ المیّت من الصوم حدوثاً وبقاء"}, {r:90,n:"إجناب الصائم نفسه مع ضیق الوقت وظنّ السعة"}, {r:91,n:"الحقنة بالجامد والمائع غیر البالغ للجوف وما یشک فی کونه منها"}, {r:92,n:"التاسع : من المفطرات الاحتقان بالمایع ولو مع الاضطرار ◂ العاشر : تعمّد القیء"}, {r:93,n:"ابتلاع ما یخرج بالتجشّؤ"}, {r:94,n:"مفطریة القیء وما یطّرد فیه من الفروع"}, {r:103,n:"فروع اعتبار العمد والاختیار فی فعل المفطر ◂ الإفطار عمداً فی صورة الظنّ بفساد الصوم"}, {r:104,n:"الإفطار للتقیّة من الظالم"}, {r:105,n:"حکم ابتلاع اللّقمة وما یدخل فی الحلق من غیر اختیار"}, {r:107,n:"وظیفة من خاف علی نفسه الهلاک من غلبة العطش"}, {r:108,n:"مبطلیة الذهاب إلی مکان یضطرّ فیه إلی الإفطار"}, {r:109,n:"مبطلیة الجماع إذا تذکّر بعد النسیان ولم یترک"}, {r:110,n:"المیزان فی ما یجوز للصائم ارتکابه من اُمور ◂ الحکم فی ابتلاع الریق الممتزج بالدم ونحوه من المحرّمات"}, {r:111,n:"الأول : مباشرة النساء بما لا یستوجب الجنابة ◂ الثالث : دخول الحمّام لمن یخشی الضعف ◂ الرابع : إخراج الدم المضعف بل کل فعل یورث الضعف ◂ الخامس : السعوط مع عدم العلم بوصوله إلی الحلق ◂ السادس : شمّ الریاحین ◂ السابع : بلّ الثوب علی الجسد ◂ الثامن : جلوس المرأة فی الماء ◂ التاسع : الحقنة بالجامد ◂ العاشر : قلع الضرس بل مطلق إدماء الفم ◂ الحادی عشر : السواک بالعود الرطب ◂ الثانی عشر : المضمضة عبثاً ◂ الثالث عشر : إنشاد الشعر ◂ الرابع عشر : الجدال والمراء وأذی الخادم والمسارعة إلی الحلف"}, {r:112,n:"لزوم الکفّارة بفعل المفطرات عمداً واختیاراً علی تفصیل ◂ لزوم الکفّارة علی الجاهل علی تفصیل ◂ أقسام وجوب الکفّارة ◂ الأول : کفّارة صوم شهر رمضان ◂ کفّارة الإفطار علی محرّم ◂ الثانی : کفّارة قضاء شهر رمضان ◂ الرابع : کفّارة صوم الاعتکاف ◂ الثالث : کفارة صوم النذر المعیّن ◂ تکرّر الکفّارة بتکرّر موجبها"}, {r:113,n:"لزوم کفارة الجمع بلا فرق بین الإفطار بالمحرم ذاتاً وبالعارض"}, {r:114,n:"من الإفطار بالمحرّم الکذب علی الله ورسوله"}, {r:115,n:"حکم ابتلاع النخامة ◂ تعذّر بعض الخصال فی کفّارة الجمع"}, {r:116,n:"حکم تکرّر الکفّارة بالجماع مراراً وکونه علی الوجه المحرّم"}, {r:117,n:"المدار فی تکرّر الکفّارة فی بعض الموارد"}, {r:118,n:"من أفطر بغیر الجماع إذا جامع بعد ذلک"}, {r:120,n:"الإفطار بالحلال ثمّ تناول الحرام ◂ العلم بفساد الصوم والشک فی وجوه"}, {r:121,n:"من أفطر ثمّ سافر بعد الزوال أو قبله"}, {r:122,n:"إفطار یوم الشک مع تحقق المخالفة"}, {r:123,n:"من استحلّ الإفطار فی شهر رمضان"}, {r:124,n:"من جامع زوجته الصائمة مکرهاً لها أو مطاوعةً له"}, {r:125,n:"من جامع زوجته الصائمة وهی نائمة ومن أکرهها علی غیر الجماع"}, {r:126,n:"حکم الإکراه من الزوجة لزوجها"}, {r:127,n:"الإکراه فی غیر الزوجة کالأمة والأجنبیّة"}, {r:128,n:"إکراه الزوج المفطر لعذرٍ زوجته الصائمة علی الجماع"}, {r:129,n:"من عجز عن الخصال الثلاث فی کفارة شهر رمضان"}, {r:130,n:"من تمکن من الکفّارة بعد العجز عنها ◂ التبرع بالکفّارة عن الغیر"}, {r:131,n:"التأخیر فی أداء الکفّارة وکونها غیر فوریّة"}, {r:132,n:"الإفطار علی الحرام بعد المغرب"}, {r:134,n:"مصرف کفّارة الإطعام"}, {r:135,n:"مقدار الطعام ونوعه فیالکفّارة ◂ لزوم مراعاة العدد وإطعام ستین نفساً ولو من الصغار والنساء ◂ جواز السفر فی شهر رمضان من غیر حاجة"}, {r:136,n:"مقدار المدّ"}, {r:137,n:"الأول: النوم الثانی بل الثالث علی الجنابة ◂ الثانی : إبطال الصوم بالإخلال بالنیّة ◂ الثالث : نسیان غسل الجنابة یوماً أو أیّاماً ◂ الرابع : فعل المفطر بعد الفجر قبل المراعاة ◂ الخامس : الأکل تعویلاً علی من أخبر ببقاء اللیل ◂ السادس : الأکل لزعمه سخریّة المخبر بطلوع الفجر ◂ السابع : الإفطار تقلیداً لمن أخبر بدخول اللیل ◂ الثامن : الإفطار لظلمةً أوجبت القطع فبان خطؤه ◂ حکم تناول المفطر مع الشکّ فی طلوع الفجر"}, {r:138,n:"فعل المفطر قبل الفحص ◂ التاسع : إدخال الماء فی الفم للتبرّد فسبقه ودخل الجوف"}, {r:139,n:"سبق الماء بالمضمضة لوضوء الصلاة"}, {r:140,n:"کراهة المبالغة فی المضمضة ◂ عدم جواز التمضمض مطلقاً مع العلم بسبق الماء"}, {r:141,n:"العاشر : سبق المنی بالملاعبة أو الملامسة"}, {r:142,n:"مبدأ نهار الصوم ومنتهاه ◂ استصحاب الصلاة قبل الإفطار ◂ عدم مشروعیة الصوم فی اللیل"}, {r:143,n:"الأول : الإسلام والإیمان ◂ الثانی : العقل ◂ الثالث : عدم الإصباح جنباً أو علی حدث الحیض والنفاس ◂ الرابع : الخلوّ من الحیض والنفاس فی مجموع النهار ◂ الخامس : أن لا یکون مسافراً ◂ مواضع استثنیت من الصوم فی السفر ◂ الصوم المندوب فی السفر ◂ صحة صوم المسافر الجاهل بالحکم دون الناسی ◂ صحة الصوم من المسافر بعد الزوال وکذا من لم یقصّر فی صلاته ◂ السادس : عدم المرض أو الرمد الذی یضرّه الصوم ◂ عدم الابتلاء بالمزاحم الأهمّ ◂ عدم کفایة الضعف فی سقوط الصوم ◂ الصوم بزعم عدم الضرر مع انکشاف الخلاف ◂ علم المکلف من نفسه خلاف حکم الطبیب ◂ صحة الصوم من النائم تمام النهار مع سبق النیة"}, {r:144,n:"صحة صوم الصبی الممیز"}, {r:145,n:"عدم جواز الصوم المندوب وعلیه صوم واجب"}, {r:146,n:"استثناء العجز والنسیان من عدم الجواز ◂ حکم نذر صوم التطوّع ممّن علیه الفرض ◂ حکم التطوّع بالصوم ممّن علیه صوم واجب بالاستئجار"}, {r:147,n:"الأول والثانی : البلوغ والعقل ◂ الصبی والمجنون إذا کملا بعد طلوع الفجر ولم یأتیا بالمفطر ◂ الثالث : عدم الإغماء ◂ الرابع : عدم المرض ◂ حکم مَن برئ بعد الزوال ولم یتناول شیئاً أو برئ قبله ◂ الخامس : الخلوّ من الحیض والنفاس ◂ السادس : الحَضَر ◂ حکم المسافر قبل وبعد الزوال"}, {r:148,n:"حکم القادم قبل وبعد الزوال ◂ استحباب الإمساک بقیة النهار للقادم من السفر مفطراً ◂ المستثنیات من قاعدة التلازم بین إتمام الصلاة والصوم وقصرها والإفطار"}, {r:149,n:"عدم جواز الإفطار للمسافر قبل حدّ الترخّص"}, {r:150,n:"حکم السفر اختیاراً فی شهر رمضان وغیره من الواجب المعیّن"}, {r:151,n:"کراهة السفر فی شهر رمضان"}, {r:152,n:"کراهة الجماع والتملّی من الطعام والشراب من غیر الصائم"}, {r:153,n:"الأول والثانی : الشیخ والشیخة فی صورة التعذّر والمشقّة ◂ اعتبار دفع الفدیة وبیان قدرها ونوعها ◂ الحکم بالقضاء فی صورة تجدّد القدرة فی الشیخ والشیخة ◂ الثالث : من به داء العطش ◂ الرابع : الحامل المقرب ◂ وجوب الصدقة والقضاء علیها ◂ الخامس : المرضعة القلیلة اللبن"}, {r:154,n:"الأول : رؤیة المکلّف بنفسه ◂ الثانی : التواتر ◂ الثالث : الشیاع المفید للعلم ◂ الرابع : مضی ثلاثین یوماً من هلال شعبان أو رمضان ◂ الخامس : البیّنة الشرعیة ◂ الإشکال فی الأخذ بالبیّنة فی بعض الموارد ◂ السادس : حکم الحاکم ◂ حکم استناد الحاکم إلی الشیاع الظنّی ◂ عدم ثبوت الهلال بقول المنجّمین ونحوه ◂ لو ترک الصوم ثم انکشف بشهادة عدلین ثبوت الهلال ◂ اعتبار شهادة الشاهدین بالرؤیة حسّاً لا حدساً"}, {r:155,n:"نفوذ حکم الحاکم بالهلال فی حق مقلّدیه وغیرهم"}, {r:156,n:"ثبوت الهلال فی بلد دون بلد اتّحد الاُفق أم لم یتّحد"}, {r:157,n:"الإخبار بثبوت الهلال بواسطة الآلات والمخترعات"}, {r:158,n:"حکم یوم الشک أنّه من رمضان أو شوّال"}, {r:159,n:"حکم ما لو غمّت الشهور"}, {r:160,n:"حکم الأسیر والمحبوس إذا لم یتمکّنا من تحصیل العلم بالشهر"}, {r:161,n:"إجراء أحکام شهر رمضان علی ما ظنّه رمضاناً ◂ حکم اشتباه شهر رمضان بین شهرین أو أکثر"}, {r:162,n:"حکم المکان الذی یکون لیله ونهاره غیر متعارفین"}, {r:163,n:"شرائط وجوب قضاء الصوم ◂ بلوغ الصبی فی أثناء النهار أو الشک فی کونه قبل الفجر أو بعده ◂ عدم قضاء صوم ما فات حال الجنون ◂ حکم قضاء ما فات عن المغمی علیه ◂ لا قضاء علی من أسلم عن کفر وکذا لو أسلم أثناء النهار ◂ وجوب القضاء علی المرتدّ ما فاته أیّام ردّته"}, {r:164,n:"وجوب القضاء علی من فاته الصوم لسکر"}, {r:165,n:"وجوب القضاء علی الحائض والنفساء"}, {r:166,n:"حکم المخالف إذا استبصر"}, {r:167,n:"وجوب القضاء علی من فاته الصوم لنومٍ أو غفلة"}, {r:168,n:"دوران الفائت بین الأقل والأکثر"}, {r:169,n:"عدم وجوب الفور والتتابع فی القضاء"}, {r:170,n:"عدم وجوب تعیین الأیام فی صوم القضاء"}, {r:171,n:"حکم من کان علیه قضاء رمضانین فصاعداً"}, {r:172,n:"عدم الترتیب بین صوم القضاء وغیره من أقسام الواجب"}, {r:173,n:"إذا صام قضاءً ثم تبیّن فراغ ذمّته لم یقع عن غیره"}, {r:174,n:"حکم من فاته شهر رمضان أو بعضه لعذرٍ ومات فیه"}, {r:175,n:"لو استمرّ المرض إلی رمضان الآخر ◂ لو استمرّ العذر غیر المرض إلی رمضان الآخر"}, {r:176,n:"فوات شهر رمضان لا لعذرٍ أو لعذرٍ لم یستمر ◂ من فاته شهر رمضان لا لعذرٍ أو لعذر غیر مستمر إلی رمضان الآخر"}, {r:177,n:"تکرّر الکفّارة لو استمرّ المرض ثلاث أو أربع سنین"}, {r:178,n:"عدم تکرّر کفّارة السنة الواحدة لو أخّر القضاء سنین عدیدة"}, {r:179,n:"جواز إعطاء کفّارة أیّام عدیدة لفقیر واحد ◂ عدم وجوب کفّارة العبد علی سیّده"}, {r:180,n:"اعتبار فوریّة القضاء قبل رمضان الآخر"}, {r:181,n:"قضاء ما فات المیّت لعذر ◂ ما یشترط فی وجوب القضاء والمقضی عنه والولی"}, {r:182,n:"لو لم یکن للمیّت ولد"}, {r:183,n:"إذا تعدّد الولی أو تبرّع متبرّع عن المتوفّی"}, {r:184,n:"فروع فی ما یجب علی الولی من قضاء الصوم عن المیّت"}, {r:188,n:"قضاء غیر رمضان من الصوم الواجب علی المتوفّی"}, {r:189,n:"فروع فی قضاء شهر رمضان وغیره من الصوم الواجب عن نفسه وغیره"}, {r:190,n:"منها : ما یجب الصوم مع غیره ◂ ومنها : ما یجب فیه الصوم بعد الفجر عن غیره ◂ کفّارة الظهار وقتل الخطأ والإفطار فی قضاء شهر رمضان والیمین ◂ کفّارة صید النعامة والبقر الوحشی والغزال ◂ کفّارة الإفاضة من عرفات قبل الغروب عامداً ◂ کفّارة خدش المرأة وجهها فی المصاب وشق الرجل ثوبه علی زوجته أو ولده ◂ ومنها : ما یجب فیه الصوم مخیّراً بینه وبین غیره ◂ کفّارة الإفطار فی شهر رمضان وکفّارة الاعتکاف وکفّارة النذر ◂ کفّارة العهد وجزّ المرأة شعرها فی المصاب وحلق الرأس فی الإحرام ◂ ومنها : ما یجب فیه الصوم مرتّباً علی غیره مخیّراً بینه وبین غیره ◂ وجوب التتابع فیما وجب فی کفّارته صوم شهرین"}, {r:191,n:"التتابع فی الثمانیة عشر بدل الشهرین بل فی جمیع صوم الکفّارة ◂ التتابع فی صوم النذر مع الاشتراط"}, {r:192,n:"التتابع فی قضاء الصوم المنذور المشروط فیه التتابع"}, {r:193,n:"الشروع فی صوم التتابع فی وقت لا یسلم فیه"}, {r:194,n:"الإفطار فی أثناء الصوم الذی یشترط فیه التتابع لا لعذر"}, {r:195,n:"الإفطار فی أثناء الصوم الذی یشترط فیه التتابع لعذر ◂ من أمثلة ما فیه العذر"}, {r:196,n:"المقدار اللازم من التتابع فی الصوم"}, {r:197,n:"بطلان التتابع فی الأثناء لا یکشف عن بطلان ما سبق من الأیام"}, {r:198,n:"أقسام الصوم ◂ أقسام الصوم الواجب ◂ أقسام الصوم المندوب"}, {r:199,n:"المکروه من الصوم ◂ أقسام الصوم المحظور"}, {r:200,n:"مواضع استحباب الإمساک تأدّباً ◂ معناه وأفضل أوقاته وأقسامه ◂ شرائط صحة الاعتکاف ◂ الأول: الإیمان، فلا یصحّ من غیره ◂ الثانی : العقل، فلا یصحّ من المجنون ◂ الثالث : نیّة القربة العبادیة ◂ الرابع : الصوم فلا یصحّ بدونه ◂ الخامس : ألّا یقلّ الاعتکاف عن ثلاثة أیام ◂ السادس : لزوم الکون فی المسجد وبیان المراد من المسجد ◂ السابع : إذن السید لمملوکه والمستأجر لأجیره الخاص ◂ إذن الزوج للزوجة ◂ إذن الوالد لولده ◂ الثامن : استدامة اللبث فی المسجد"}, {r:201,n:"بطلان الاعتکاف بالارتداد"}, {r:202,n:"عدم جواز العدول بالنیّة فی الاعتکاف"}, {r:203,n:"النیابة عن أکثر من واحد"}, {r:204,n:"کفایة مطلق الصوم فی الاعتکاف"}, {r:205,n:"جواز قطع الاعتکاف فی الیومین الأوّلین"}, {r:206,n:"حکم قطع الاعتکاف المنذور المعیّن ◂ صوم نذر الاعتکاف فی یوم علیه فیه صوم واجب"}, {r:207,n:"نذر الاعتکاف لیوم أو یومین"}, {r:208,n:"لو صادف النذر مانع من الصوم کالعید"}, {r:209,n:"نذر الاعتکاف یوم قدوم شخصٍ معیّن"}, {r:210,n:"حکم اللیلتین المتوسّطتین واللیلة الاُولی فی الاعتکاف المنذور"}, {r:211,n:"المراد من الشهر فی المقام"}, {r:213,n:"لو نذر اعتکاف شهر أو مقدار شهر والفرق بینهما"}, {r:214,n:"فروع فیما یرتبط بالتتابع فی صوم الاعتکاف"}, {r:216,n:"قضاء ما ترک من الاعتکاف الواجب وحکم ما لو غمّت الشهور"}, {r:218,n:"اعتبار وحدة المسجد فی الاعتکاف الواحد"}, {r:219,n:"حکم ما لو اتفق مانع من إتمام الاعتکاف"}, {r:220,n:"أحکام فی توابع المسجد ومنه مسجد الکوفة المعظّم وفروع ذلک"}, {r:227,n:"صحة اعتکاف الصبی الممیز ◂ اعتکاف العبد وشرطیة إذن المولی"}, {r:230,n:"حکم خروج المعتکف من المسجد"}, {r:231,n:"الخروج لأجل الاغتسال من الجنابة"}, {r:232,n:"اعتبار عدم الغصبیة للمکان من المسجد"}, {r:234,n:"فروع فی ما یرتبط بالخروج من المسجد"}, {r:235,n:"إجزاء اللبث فی المسجد بأیّ نحوٍ کان"}, {r:236,n:"وظیفة المرأة المعتکفة إذا طُلّقت طلاقاً رجعیاً"}, {r:238,n:"الرجوع عن الاعتکاف"}, {r:239,n:"فروع الرجوع عن الاعتکاف"}, {r:240,n:"التعلیق فی نیّة الاعتکاف"}, {r:242,n:"أحدها: المباشرة بالجماع من الرجل والمرأة ◂ الثانی : الاستمناء ◂ الثالث: شمّ الطیب مع التلذّذ ◂ الرابع: البیع والشراء ◂ الخامس: المماراة ◂ استواء اللّیل والنهار فی التحریم"}, {r:243,n:"فعل المباح فی الاعتکاف"}, {r:244,n:"حکم ارتکاب أحد المحرّمات فی الاعتکاف"}, {r:245,n:"مرتکب أحد المحرّمات سهواً"}, {r:246,n:"قضاء ما فسد من الاعتکاف"}, {r:247,n:"قضاء ما فات بموت المعتکف"}, {r:249,n:"حکم البیع والشراء فی الاعتکاف"}, {r:250,n:"وجوب الکفارة وتفصیلاتها"}],
  bk78: [{r:1,n:"أوّلاً: البلوغ ◂ ثانیاً: العقل ◂ خامساً: تمام التمکّن من التصرّف ◂ سادساً: النصاب"}, {r:2,n:"إخراج الزکاة فی غلاّت غیر البالغ"}, {r:3,n:"حکم المغمی علیه أثناء الحول ونحوه"}, {r:4,n:"تعلّق الزکاة فی ملکیّة العبد علی القول بها"}, {r:6,n:"الشکّ فی المتقدّم من البلوغ والتعلّق"}, {r:7,n:"الشکّ فی المتقدّم من العقل والتعلّق ◂ مانعیّة ثبوت الخبار ونحوه فی تعلّق الزکاة"}, {r:8,n:"الشرکة فی الأعیان الزکویّة"}, {r:9,n:"مانعیّة الوقف من تعلّق الزکاة بالعین الوقفیّة"}, {r:10,n:"فروض التمکّن من التصرّف فی المغصوب والمسروق ونحوها"}, {r:11,n:"التمکّن من استیفاء الدین وتفصیلاته"}, {r:12,n:"المقترض یجب أداء الزکاة إذا بلغت بالقرض"}, {r:13,n:"تعلّق الزکاة بالنذر صُوَره وأحکامه"}, {r:14,n:"إذا استطاع الحج بالنصاب"}, {r:15,n:"من تمکّن من التصرّف بعد التعذّر وبالعکس"}, {r:16,n:"کون الکافر مکلّفاً بالفروع ومنها الزکاة"}, {r:19,n:"لزوم إخراج ما تعلّق به الزکاة قبل البیع ونحوه"}, {r:20,n:"ما یجب وما یستحبّ زکاته من الأجناس ◂ حکم المتولّد من جنسین مختلفین"}, {r:21,n:"الشرط الأوّل : النصاب ◂ مسائل فی نصاب الأنعام الثلاثة"}, {r:28,n:"الشرط الثانی : السوم طول الحول ◂ الشرط الثالث : أن لا تکون عوامل ◂ الشرط الرابع : مضی الحول علیها جامعة للشرائط"}, {r:29,n:"بطلان الحول باختلاف بعض الشرائط"}, {r:30,n:"التفصیل فی ضمان النصاب"}, {r:31,n:"المسلم المرتد عن دینه لو تعلّقت بماله الزکاة"}, {r:32,n:"المناط فی الدفع لمن کان مالکاً النصاب أو أکثر"}, {r:33,n:"تجدّد النصاب فی الملک الجدید وصوره"}, {r:34,n:"حکم النصاب إذا کان صداقاً للزوجة"}, {r:35,n:"حکم تعلّق الزکاة فی البیع الثابت فیه الخیار"}, {r:37,n:"من شرائطها: الأوّل : النصاب وبیان حدّه ◂ الثانی : کون النقدین مسکوکین بسکّة المعاملة ◂ الثالث : مضیّ الحول"}, {r:38,n:"حکم الحلی وأوانی الذهب والفضّة"}, {r:39,n:"حکم النقدین إذا کانا مغشوشین وفروع ذلک"}, {r:44,n:"نفقة العیال إذا بلغت نصاباً حال علیه الحول"}, {r:46,n:"إذا کانت الأموال الزکویّة من أجناس مختلفة"}, {r:47,n:"وجوب الزکاة فی الغلاّت الأربع وبیانها وشرائطها ◂ وقت تعلّق الزکاة بالغلاّت"}, {r:49,n:"مدخلیّة الیبوسة فی اعتبار النصاب فی الغلاّت ◂ المدار فی التعلّق فی جملة من الأجناس"}, {r:50,n:"حکم التصرّف بما یزید علی المتعارف"}, {r:51,n:"طلب الساعی الزکاة قبل الوقت"}, {r:52,n:"وقت الإخراج فی الغلاّت"}, {r:54,n:"دفع القیمة من النقدین ومن غیرهما"}, {r:56,n:"مقدار الزکاة فی الغلاّت وفروع ذلک"}, {r:57,n:"عدم وجوب الزکاة بعد الدفع ولو بقیت أحوالاً"}, {r:61,n:"استثناء ما یأخذه السلطان وغیره"}, {r:62,n:"استثناء المؤن من الزکاة"}, {r:63,n:"اسثناء قیمة البذر"}, {r:64,n:"بعض فروع استثناء المؤن"}, {r:70,n:"حکم تباعد الأمکنة واختلاف وقت الإدراک وتعدّد الثمرة لعام واحد فی الزرع والنخل"}, {r:71,n:"حکم دفع الرطب عن التمر أو العنب عن الزبیب"}, {r:72,n:"تبدیل الزکاة بالقیمة"}, {r:73,n:"تعلّق الزکاة بالمال لو مات الزارع بعد التعلّق"}, {r:75,n:"وجوب الزکاة علی من کان مالکاً حال التعلّق"}, {r:76,n:"تعدّد أنواع الثمر واختلافها فی الجودة"}, {r:77,n:"کیفیّة تعلّق الزکاة بالعین وثمرة ذلک"}, {r:78,n:"جواز الخرص علی المالک···"}, {r:79,n:"التجارة بالمال المتعلّق فیه الزکاة"}, {r:80,n:"جواز عزل الزکاة"}, {r:81,n:"الأوّل : مال التجارة وشرائط التعلّق به ◂ قدر الزکاة وکیفیّة تعلّقها بالمال ◂ حکم مال التجارة لو کان من النصاب"}, {r:82,n:"ثمرة القول باشتراط حول الحول فی المقام"}, {r:83,n:"زکاة مال المضاربة"}, {r:84,n:"تقدّم الزکاة الواجبة علی الدین"}, {r:85,n:"فروع فی زکاة مال التجارة"}, {r:86,n:"الثانی : ما یکال أو یوزن من الحبوب"}, {r:87,n:"الثالث : إناث الخیل ◂ الرابع : حاصل العقار المتّخذ للنماء ◂ الخامس : الحلی، وزکاته إعارته ◂ السادس : المال الغائب أو المدفون علی تفصیل ◂ السابع : النصاب المعاوض به بقصد الفرار"}, {r:88,n:"الأوّل والثانی : الفقیر والمسکین وبیان المراد منهما ◂ حکم القادر علی الاکتساب ◂ فروع فی المؤونة ومستحقّ الزکاة"}, {r:96,n:"الشکّ فی کفایة المؤونة"}, {r:98,n:"احتساب الدین علی الفقیر من الزکاة"}, {r:99,n:"عدم وجوب إعلام الفقیر بالزکاة ◂ دفع الزکاة إلی غیر المستحق وفروع ذلک"}, {r:102,n:"الثالث : العاملون علیها وما یشترط فیهم ◂ الرابع : المؤلّفة قلوبهم ◂ الخامس : الرقاب ◂ السادس : الغارمون"}, {r:103,n:"عدم الفرق بین أقسام الدین"}, {r:106,n:"فروع فی صرف الزکاة فی الغارمین"}, {r:116,n:"السابع : سبیل اللّه ◂ الثامن : ابن السبیل"}, {r:119,n:"دفع الزکاة للفقیر باعتقاد الوجوب وانکشاف الخلاف···"}, {r:120,n:"إعطاء أطفال المؤمنین ومن بحکمهم ◂ الأوّل : الإیمان، فلا یعطی الکافر بأقسامه"}, {r:122,n:"حکم ما لو کان أحد الأبوین مؤمناً دون الآخر"}, {r:124,n:"عدم الإجزاء ممّن أعطی لغیر المؤمن زکاته"}, {r:125,n:"الإشکال فی إعطاء من لا یُحرز فیهم الإیمان"}, {r:127,n:"إعطاء من اعتقد کونه مؤمناً وتبیّن الخلاف ◂ الثانی : عدم کون الدفع إلیه إعانة علی الإثم"}, {r:128,n:"الثالث : ألاّ یکون المدفوع إلیه من واجبی النفقة المزکّی وفروع ذلک"}, {r:129,n:"استثناء بعض من تجب علیه النفقة من المنع المذکور"}, {r:132,n:"فروع فی دفع الزکاة إلی أصناف من المستحقّین"}, {r:139,n:"الرابع : أن لا یکون هاشمیّاً والزکاة من غیره"}, {r:140,n:"الاستثناء من المحرّم من صدقات غیر الهاشمی علیه"}, {r:141,n:"ما یثبت به النسب الهاشمی"}, {r:143,n:"المسألة الاُولی : الأفضل نقل الزکاة إلی الفقیه الجامع للشرائط ◂ الثانیة : البسط علی الأصناف الثمانیة ◂ الثالثة : مرجحیّة بعض الأوصاف والأصناف ◂ الرابعة : أفضلیّة الإجهار فی أداء الزکاة ◂ الخامس : القبول من المالک بلا بیّنة ولا یمین ◂ السادسة : حکم عزل الزکاة بین وجود المستحق وعدمه ◂ السابعة : الاتّجار بمال الزکاة ◂ الثامنة : وجوب الوصیّة بأداء ما علیه من الزکاة ◂ التاسعة : العدول بالزکاة إلی غیر الحاضرین من الفقراء ◂ العاشرة : نقل الزکاة من بلده إلی غیره ◂ الحادیة عشرة : نقل الزکاة مع وجود المستحق فی البلد ◂ الثانیة عشرة : من کان ماله فی غیر بلد الزکاة یحتسبه عمّا علیه فی بلده ◂ الثالثة عشرة : إذا کان المال فی بلد آخر غیر بلده جاز له نقله إلی بلده ضامناً ◂ الرابعة عشرة : القبض للزکاة بعنوان الولایة ◂ الخامسة عشرة : اُجرة الکیّال والوزّان ◂ السادسة عشرة : تعدّد موجبات الاستحقاق فی شخص واحد ◂ السابعة عشرة : المملوک الذی یشتری بالمال الزکوی إذا مات ◂ الثامنة عشرة : حدّ ما یدفع من الزکاة ◂ التاسعة عشرة : استحباب الدعاء لربّ المال ◂ العشرون : کراهة طلب التملّک ما أخرج من الزکاة صدقة"}, {r:144,n:"الکلام فی الفوریّة وعدمها ◂ المناط فی الضمان مع وجود المستحق ◂ ما یشترط فی الضمان مع التأخیر"}, {r:145,n:"تلف الزکاة مع تأخیر المالک بمتلف"}, {r:146,n:"تقدیم الزکاة قبل وقت الوجوب وفروع ذلک"}, {r:147,n:"دفع الزکاة للفقیر قرضاً، ثمّ احتسابها علیه بعد الوجوب وفروع ذلک"}, {r:151,n:"ما یعتبر فی نیّة الزکاة ◂ عدم لزوم تعیین الجنس المزکّی ◂ التوکیل فی أداء الزکاة وإیصالها"}, {r:152,n:"کفایة النیّة وصول المال للفقیر مع بقاء العین أو تلفها"}, {r:153,n:"جواز الدفع للحاکم بعنوان الوکالة عن المالک أو الولایة علی الفقراء"}, {r:154,n:"أداء الولی للزکاة عن القاصر والنیّة نیابة عنه"}, {r:155,n:"أداء الحاکم الزکاة عن الممتنع أو أخذها من الکافر"}, {r:156,n:"أداء الزکاة بنیّة ما علیه"}, {r:157,n:"دفع الزکاة عن ماله الغائب ثمّ انکشاف تلفه"}, {r:158,n:"الاُولی : التکلیف بإخراج زکاة مال التجارة عن الصبی أو المجنون فی عدة مَن ؟"}, {r:159,n:"الثانیة : حکم الشکّ فی إخراج الزکاة بعد العلم بتعلّقها ◂ الثالثة : الشکّ فی البیع للمال الزکوی أ نّه قبل التعلّق أو بعده ◂ الرابعة : إخراج ما تعلّقت به الزکاة من مال المیّت ◂ الخامسة : شکُّ الوارث فی أداء المورّث للزکاة ◂ السادسة : لو تردّد ما علیه بین الخمس والزکاة ◂ السابعة : تردّد المال المتعلّق فیه الزکاة بین نوعین ◂ الثامنة : الدفع إلی واجب النفقة من زکاة المیّت ◂ التاسعة : بیع العین المستحقّة للزکاة واشتراط أداء زکاتها علی المشتری ◂ العاشرة : من طلب من غیره لدفع عنه ◂ الحادیة عشرة : هل تبرأ ذمّة الموکل بمجرّد التوکیل فی الدفع عنه ◂ الثانیة عشرة : الدفع بنیّة ما علیه فإن لم یکن فعن أبیه وهکذا ◂ الثالثة عشرة : عدم لزوم الترتیب فی الأداء ◂ الرابعة عشرة : حکم الزکاة فی المزارعة الفاسدة والصحیحة ◂ الخامسة عشرة : الاقتراض علی الزکاة من قبل الحاکم وصرفه فی مصارفها ◂ السادسة عشرة : حکم أخذ الفقیر أو الحاکم للزکاة ثمّ إرجاعها للمالک ◂ السابعة عشرة : حکم اعتبار التمکّن من التصرّف فیما لا یعتبر فیه الحول کالغلاّت ◂ الثامنة عشرة : حکم المال الغافل عنه صاحبه مع القدرة علیه ◂ التاسعة عشرة : إذا کان عدم التصرّف بسبب النذر أو الشرط أو الإکراه ◂ العشرون : للمالک أن یشتری من زکاته من سهم سبیل اللّه عیناً ویوقفها ◂ الحادیة والعشرون : لیس للفقیر مقاصّة الممتنع عن أداء الزکاة إلاّ بإذن الحاکم الشرعی ◂ الثانیة والعشرون : هل یجوز دفع الزکاة للفقیر من سهم الفقراء علی أن یحجّ بها ؟ ◂ الثالثة والعشرون : هل یجوز دفع الزکاة وسهم سبیل اللّه للظالم لتخلیص مؤمن منه ◂ الرابعة والعشرون : زکاة المنذور لشخص، علیه أم علی الناذر ◂ الخامسة والعشرون : للفقیر حقّ التوکیل فی قبض الزکاة ◂ السادسة والعشرون : لا فضولیّة فی دفع الزکاة عن المالک ◂ السابعة والعشرون : هل یجوز للوکیل فی دفع الزکاة الأخذ منها إذا کان فقیراً ◂ الثامنة والعشرون : وجوب الزکاة علی الفقیر من الأعیان الزکویة ◂ التاسعة والعشرون : حکم المال الزکوی بین الشریکین ◂ الثلاثون : أخذ الحاکم زکاة الکافر ◂ الحادیة والثلاثون : من کان علیه خمس وزکاة لا یفی المال بهما ◂ الثانیة والثلاثون : إعطاء الزکاة للسائل بکفّه وکذا الفطرة ◂ الثالثة والثلاثون : الدفع للفقیر غیر العادل ◂ الرابعة والثلاثون : نیّة القربة فی العزل والدفع ◂ الخامسة والثلاثون : لو قصد المالک الریاء والوکیل القربة ◂ السادسة والثلاثون : قصد القربة من المالک وعدمه من الحاکم ◂ السابعة والثلاثون : إجزاء نیّة الحاکم عن الممتنع ◂ الثامنة والثلاثون : دفع الزکاة إلی طالب العلم مع قدرته علی الاکتساب ◂ التاسعة والثلاثون : دفع الزکاة إلی من یطلب العلم ریاءً ◂ الأربعون : دفع الزکاة فی المکان المغصوب ◂ الحادیة والأربعون : اعتبار التمکّن من التصرّف فی بعض الفروض"}, {r:160,n:"زکاة الفطرة، وجوبها وفوائدها وشرائطها"}, {r:161,n:"ما لا یعتبر فی الوجوب من الاُمور ◂ اعتبار قصد القربة ◂ استحباب إخراج الفقیر زکاة الفطرة عنه وعن عیاله ◂ کراهة تملّک ما دفعه زکاةً"}, {r:163,n:"المدار فی زمان وجوب الفطرة إدراک غروب لیلة العید"}, {r:164,n:"وجوب إخراج الفطرة عن نفسه وعیاله حتّی من لا تجب علیه نفقته وحتّی الکافر منهم ◂ وجوب إخراج الفطرة عمّن یصیر عیالاً قبل الغروب"}, {r:165,n:"من وجبت علی غیره فطرته سقطت عن نفسه"}, {r:166,n:"فطرة الزوجة مع عدم وجوب نفقتها علیه وکذا المملوک"}, {r:167,n:"فطرة الصغیر والمجنون لو أنفق الولی علیهما من مالهما"}, {r:168,n:"دفع الفطرة بالوکالة ونحوها"}, {r:169,n:"مَن دفع عن نفسه مع وجوبها علی غیره"}, {r:170,n:"حرمة فطرة غیر الهاشمی علی الهاشمی"}, {r:171,n:"عموم الحکم فی العیال والمعیل حال حضورهم وغیبتهم"}, {r:173,n:"حکم المملوک المشترک"}, {r:174,n:"حکم مَن کان عیالاً لشخصین"}, {r:175,n:"الحکم فی فطرة الرضیع"}, {r:176,n:"عدم وجوب الفطرة عن الجنین"}, {r:177,n:"عدم اشتراک کون الإنفاق من المال الحلال"}, {r:178,n:"فروع اُخری فی المقام"}, {r:184,n:"جنس زکاة الفطرة ◂ ما یُعتبر فی الجنس المخرج"}, {r:185,n:"الاجتزاء بالقیمة فی زکاة الفطرة"}, {r:186,n:"فروع فی دفع القیمة وما هو المدار فیها"}, {r:188,n:"لا یلزم الإخراج من نفس الجنس عنه وعن عیاله"}, {r:189,n:"لزوم إخراج صاع عن کلّ رأس وما هو مقداره"}, {r:191,n:"أوّل وقت وجوب زکاة الفطرة ◂ حکم تقدیم زکاة الفطرة ◂ حکم مَن لم یؤدّها حتّی خرج وقتها"}, {r:192,n:"أحکام العزل فی زکاة الفطرة"}, {r:197,n:"بیان مصرفها وما یُستثنی فیه ◂ إعطاء الفطرة بلا اشتراط للعدالة فی المستحق"}, {r:198,n:"جواز تولّی المالک وتوکیله فی دفع الفطرة وأولویّة الدفع للحاکم الشرعی"}, {r:199,n:"حکم إعطاء الفقیر أقلّ من صاع"}, {r:200,n:"حکم إعطاء الفقیر أکثر من صاع"}, {r:201,n:"ملاحظة بعض المرجّحات بین المستحقّین"}, {r:202,n:"حکم الدفع لشخصٍ علی أ نّه فقیر وتبیّن الخلاف"}, {r:203,n:"الحکم فی مدّعی الفقر"}, {r:204,n:"لزوم النیّة فی زکاة الفطرة"}],
  bk79: [{r:1,n:"الخمس : ثبوت الخمس وغایته ◂ الأوّل : الغنائم ، موضوعها ومستثنیاتها وفروع ذلک"}, {r:2,n:"الأموال المستحصلة من الکفّار"}, {r:3,n:"أموال الناصب"}, {r:4,n:"یعتبر فی المغتنم ألاّ یکون من المال المحترم"}, {r:5,n:"لا یعتبر النصاب فی الغنائم"}, {r:6,n:"معنی السَلَب وجریان الخمس فیه ◂ الثانی : المعادن معناها وما یدور مدارها ◂ اشتراط بلوغ النصاب فی خمس المعدن وما یستثنی منه ◂ بلوغ المعدن المستخرج علی دفعات النصاب ولو بالاشتراک ◂ شرطیّة الوحدة فی جنس المعدن"}, {r:7,n:"إخراج الخمس قبل التصفیة"}, {r:8,n:"المعدن الموجود مطروحاً فی الصحراء"}, {r:9,n:"حکم المعدن فی الأرض المملوکة والمفتوحة عنوة"}, {r:12,n:"حکم الزیادة الحاصلة بسبب العمل"}, {r:14,n:"إذا شکّ فی بلوغ ما أخرجه النصاب ◂ الثالث : الکنز ، معناه وما یتحقّق به"}, {r:15,n:"من وجد کنزاً فی ملک غیره وفروع ذلک"}, {r:17,n:"حکم الکنوز المتعدّدة"}, {r:18,n:"تحقّق النصاب فی الکنز الواحد بالإخراج دفعات"}, {r:19,n:"ما یوجد فی بطون الحیوانات"}, {r:21,n:"الرابع : الغوص معناه ونصابه وفروع ذلک"}, {r:27,n:"حکم المعدن الموجود تحت الماء"}, {r:28,n:"حکم العنبر المأخوذ بالغوص ◂ الخامس : المال الحلال المختلط بالحرام بشرائط"}, {r:29,n:"فروع فی المال المختلط بالحرام"}, {r:31,n:"لو علم صاحب المال فی عدد محصور"}, {r:32,n:"العلم بوجود الحق فی الذمّة مع عدم العلم بمتعلّقه وفروع ذلک"}, {r:34,n:"تبیّن المالک بعد إخراج الخمس"}, {r:35,n:"تبیّن الجهل بالمقدار بعد إخراج الخمس"}, {r:36,n:"من خلط الحرام المجهول بماله باختیاره"}, {r:37,n:"بعض الصور فی المال المختلط"}, {r:39,n:"إتلاف المال المختلط قبل إخراج الخمس أو ا لتصرّف فیه"}, {r:40,n:"السادس : الأرض التی اشتراها الذمّی من مسلم وشرائط وفروع ذلک"}, {r:41,n:"الأرض المفتوحة عنوة إذا اشتراها الذمّی"}, {r:42,n:"فروع فی الأرض التی یشتریها الذمّی من مسلم"}, {r:50,n:"السابع : ما یفضل عن مؤنة سنته ◂ أنواع ما تحصل به الفائدة من الوجوه وفروع ذلک"}, {r:54,n:"حکم الزیادة المتّصلة والمنفصلة للعین"}, {r:55,n:"زیادة قیمة العین ثمّ انخفاضها أثناء السنة"}, {r:56,n:"نمو النخیل والأشجار فیمن عمّر بستاناً"}, {r:57,n:"تعیین رأس السنة مع اختلاف المکاسب"}, {r:58,n:"الربح الحاصل من المعاملة المخیّرة"}, {r:60,n:"إخراج خمس رأس المال الحاصل من الأرباح"}, {r:61,n:"مبدأ احتساب الأرباح"}, {r:62,n:"المراد من المؤونة"}, {r:63,n:"خمس رأس مال التجارة"}, {r:64,n:"ما ینتفع به مع بقاء عینه کالفراش والأوانی ممّا یحتاج إلیه"}, {r:65,n:"أخذ المؤونة من الربح"}, {r:66,n:"مناط المؤنة"}, {r:67,n:"ما یصرف فی المؤنة قبل حصول الربح"}, {r:68,n:"حکم ما زاد علی المؤنة وما یحتاج إلی بقاء أعیانها وفروع"}, {r:70,n:"مصارف الحجّ من المؤنة"}, {r:72,n:"أداء الدین من المؤنة وحکم ما لو لم یؤدّه أثناء السنة"}, {r:73,n:"وقت تعلّق الخمس وجواز تأخیر الأداء إلی آخر السنة"}, {r:74,n:"جبران لخسران الواقع فی بعض المال من غیر التجارة"}, {r:75,n:"جبر الخسران فی التجارة بربح تجارة اُخری"}, {r:76,n:"التخییر فی الدفع من العین أو القیمة"}, {r:77,n:"الاتّجار بالعین قبل إخراج خمسها ◂ الحکم بجواز التصرّف فی بعض الربح والوجه فی شرکة أرباب الخمس مع المالک"}, {r:78,n:"الحکم بجواز التصرّف فی الربح بالاتّجار قبل تمام الحول لا بعده"}, {r:79,n:"الحکم بجواز التصرّف بالمصالحة مع الحاکم فی بعض الفروض"}, {r:80,n:"تعجیل إخراج الخمس والرجوع فی فرض زیادة المؤنة"}, {r:81,n:"حرمة التصرّف فیما اشتراه من الربح قبل إخراج الخمس"}, {r:82,n:"المدار فی احتساب مصارف الحجّ"}, {r:83,n:"حکم الغوص أو المعدن إذا کان مکسباً له"}, {r:84,n:"عدم استثناء المؤنة من الربح فی الزوجة المکفولة"}, {r:85,n:"عدم اشتراط التکلیف والحریّة فی وجوب الخمس"}, {r:86,n:"أقسام الخمس وسهامه وشرائطها"}, {r:87,n:"عدم لزوم البسط والاستیعاب فی القسمة"}, {r:88,n:"عدم استحقاق المنتسب إلی هاشم بالاُم للخمس"}, {r:89,n:"المدار فی ثبوت النسب الهاشمی"}, {r:90,n:"حکم دفع الخمس إلی واجب النفقة"}, {r:91,n:"المنع من دفع الزائد عن مؤنة السنة لمستحقّ واحد"}, {r:92,n:"حکم سهم الامام علیه السلام فی زمن الغیبة"}, {r:93,n:"حکم سهم السادة فی زمن الغیبة ◂ نقل الخمس إلی بلدٍ آخر وما یتفرّع علی ذلک"}, {r:100,n:"اعتبار القبض والاشکال بالعزل"}, {r:101,n:"احتساب الدَین فی ذمّة المستحقّ خمساً"}, {r:102,n:"دفع البدل لا یعتبر فیه رضا المستحقّ أو المجتهد"}, {r:103,n:"إرجاع المستحقّ الخمس علی المالک بعد تملّکه"}, {r:104,n:"حکم بقیّة موارد الخمس فی زمان الغیبة"}, {r:105,n:"الحجّ : فضله وثوابه ◂ مقدمة فی آداب السفر لحجّ أو غیره"}, {r:106,n:"وجوب الحجّ مرّة واحدة ◂ من ذهب إلی وجوبه علی أهل الجِدَة فی کلّ عام ◂ عدم جواز تعطیل الکعبة ◂ فوریّة أداء الحجّ بعد تحقّق الشرائط ◂ وجوب إتیان مقدّمات الحجّ"}, {r:107,n:"الشرط الأوّل : الکمال بالبلوغ والعقل ◂ مشروعیّة حجّ الصبیّ وعدم الإجزاء عن حجّة الإسلام ◂ اشتراط إذن الولی فی حجّ الصبیّ"}, {r:108,n:"کیفیّة إحجاج الصبیّ"}, {r:109,n:"المراد بالولی الذی یحجّ بالصبیّ"}, {r:110,n:"للولیّ فی الإحرام بالصبی أن یکون غیر محرم"}, {r:111,n:"النفقة الزائدة علی نفقة الحضر"}, {r:112,n:"فی مَنْ یتحمّل هدی الصبی وکفّاراته"}, {r:113,n:"إجزاء حجّ الصبیّ إذا أدرک المشعر بالغاً والمجنون عاقلاً"}, {r:114,n:"حکم حجّ الصبیّ إذا بلغ قبل الإحرام"}, {r:115,n:"حکم الحجّ لو خالف ما اعتقده ما هو الواقع ◂ الشرط الثانی (من شرائط الحجّ) : الحریّة ◂ مشروعیّة حجّ المملوک دون إجزائه عن حجّة الإسلام ◂ صحّة حجّ المملوک لو اُعتِق قبل إدراک المشعر ◂ التکلیف بتجدید النیّة ◂ أقوال فی شرطیّة الاستطاعة فی المقام ◂ أقوال فی شرطیّة إدراک أحد الموقفین فی المقام ◂ الحکم بالإجزاء شامل لجمیع أقسام الحجّ"}, {r:116,n:"رجوع المولی عن إذنه فی حجّ العبد"}, {r:117,n:"بیع المولی مملوکه المحرم بإذنه"}, {r:118,n:"هدی العبد من انعتق ومن لم ینعتق"}, {r:119,n:"الأقوال فی مَن یتحمّل کفّارات العبد"}, {r:120,n:"حکم إفساد المملوک حجّه بالجماع من انعتق ومن لم ینعتق"}, {r:121,n:"شمول الحکم فی المملوک لجمیع أقسامه ما عدا المبعّض ◂ وجوب طاعة المملوک لو أمره مولاه بالحجّ"}, {r:122,n:"الشرط الثالث ( من شرائط الحجّ ) : الاستطاعة"}, {r:123,n:"ما یعتبر فی الاستطاعة"}, {r:124,n:"اعتبار الراحلة حتّی بالنسبة إلی أهل مکّة"}, {r:125,n:"عدم الفرق بین وجود الزاد والراحلة عیناً ووجود بدلها"}, {r:126,n:"المراد بالزاد والراحلة"}, {r:127,n:"تحصیل الاستطاعة بالکسب فی الطریق"}, {r:128,n:"حصول الاستطاعة غیر مختصّ بالبلد"}, {r:129,n:"تحمّل الضرر بحسب حال المکلّف وشأنه"}, {r:130,n:"غلاء أسعار ما یحتاج إلیه فی الحجّ"}, {r:131,n:"اشتراط نفقة العود إلی الوطن فی الاستطاعة"}, {r:132,n:"استثناء ما یلزم الحرج من بیعه لأجل الحجّ"}, {r:134,n:"هل یشترط فی استثناء ما یحتاج إلیه الملکیّة أم یکفی التمکّن ولو بغیر الملک؟ ◂ هل یجب تبدیل العین بالقیمة للصرف فی نفقة الحجّ وصدق الاستطاعة؟"}, {r:135,n:"موارد فی ضروریّات ما یحتاج إلیه من مستثنیات الاستطاعة"}, {r:137,n:"إذا کان ما یحجّ به دین علی شخص"}, {r:138,n:"الإقتراض للحجّ"}, {r:139,n:"صور تزاحم الحجّ فی أداء الدَین"}, {r:140,n:"زوال الاستطاعة بالدَین المتأخّر عنها"}, {r:141,n:"مانعیّة تعلّق الخمس والزکاة بالمال من تحقّق الاستطاعة"}, {r:142,n:"الدَین الذی لا یمنع من تحقّق الاستطاعة"}, {r:143,n:"الشکّ فی الاستطاعة"}, {r:144,n:"الشکّ فی بقاء المال الغائب إلی زمان العود"}, {r:145,n:"تفویت الاستطاعة"}, {r:146,n:"مناط تحقّق الاستطاعة"}, {r:147,n:"الجهل بالاستطاعة"}, {r:148,n:"من موارد الجهل بالاستطاعة"}, {r:149,n:"الاستطاعة بالملکیّة المتزلزلة"}, {r:150,n:"شرطیّة بقاء الاستطاعة"}, {r:151,n:"ذهاب مؤونة الرجوع بعد تمام الأعمال"}, {r:154,n:"تزاحم الحجّ والنذر"}, {r:155,n:"تفصیل فی النذر المعلّق"}, {r:156,n:"وجوب الحجّ بالبذل"}, {r:157,n:"المنع من أداء الدَین بالاستطاعة البذلیّة"}, {r:158,n:"الرجوع إلی کفایة فی الاستطاعة البذلیّة"}, {r:159,n:"صور البذل"}, {r:160,n:"حصول الاستطاعة ببذل المتولّی للوقف والوصیّة"}, {r:161,n:"حصول الاستطاعة بالحقوق الشرعیّة"}, {r:162,n:"إجزاء الحجّ البذلیّ عن حجّة الإسلام"}, {r:163,n:"الرجوع عن البذل للحجّ"}, {r:164,n:"التزام الباذل إذا رجع بنفقة العود"}, {r:165,n:"البذل لواحدٍ من اثنین"}, {r:166,n:"ثمن الهدی والکفّارات فی الحجّ البذلی"}, {r:167,n:"ما یجب بالبذل للحجّ من سائر أقسامه وفروعه"}, {r:168,n:"تخییر المبذول له بین الحجّ والزیارة"}, {r:169,n:"انتفاء الاستطاعة فی أثناء الطریق"}, {r:170,n:"رجوع الباذل فی الأثناء"}, {r:171,n:"لو کان الباذل متعدّداً"}, {r:172,n:"لو بان عدم کفایة ما بذله الباذل"}, {r:173,n:"تعلیق البذل علی الأمر بالاقتراض"}, {r:174,n:"لو تبیّن انّ الاستطاعة حصلت بالمال الحرام"}, {r:175,n:"الاستطاعة لو آجر نفسه للخدمة فی الطریق"}, {r:176,n:"عدم وجوب قبول الإجارة للخدمة بما یصیر به مستطیعاً"}, {r:177,n:"الاستطاعة بالنیابة"}, {r:178,n:"المتسکّع إذا حجّ لنفسه أو عن غیره تبرّعاً أو إجارة"}, {r:179,n:"اشتراط الاستطاعة بوجود ما یموّن به عیاله"}, {r:180,n:"اعتبار الرجوع إلی کفایة"}, {r:181,n:"تصرّف الولد بمال الوالد"}, {r:182,n:"جواز الحجّ من مال الغیر وعدم لزوم صرف ا لمستطیع من خصوص ماله"}, {r:183,n:"اشتراط الاستطاعة البدنیّة والزمانیّة والسربیّة فی الحجّ"}, {r:186,n:"عدم وجوب الحجّ مع استلزامه تلف المال أو ترک واجب"}, {r:187,n:"إذا اعتقد تحقّق بعض شرائط الاستطاعة أو اعتقد فقدها، فبان الخلاف"}, {r:188,n:"إذا استلزم الحجّ ترک الواجب"}, {r:189,n:"توقّف الحجّ علی بذل مال لدفع عدو"}, {r:190,n:"توقّف الحجّ علی قتال العدوّ"}, {r:191,n:"انحصار طریق الحجّ فی البحر"}, {r:192,n:"حکم الحجّ مع تعلّق الخمس أو الزکاة بأمواله"}, {r:193,n:"وجوب مباشرة الحجّ المستقرّ علی المستطیع والاستنابة إن لم یتمکّن من المباشرة"}, {r:194,n:"زوال العذر بعد الاستنابة ◂ هل یختصّ وجوب الاستنابة بحجّة الإسلام؟"}, {r:195,n:"موت من استقرّ علیه الحجّ فی الطریق"}, {r:196,n:"وجوب الحجّ علی الکافر والمرتدّ وفروع فی المقام"}, {r:200,n:"حجّ المخالف"}, {r:201,n:"عدم اعتبار اذن الزوج فی حجّ الزوجة"}, {r:202,n:"عدم اعتبار وجود المحرم فی حجّ المرأة المأمونة علی نفسها"}, {r:203,n:"لو ترک الحجّ المستقرّ علیه حتّی زالت الاستطاعة أو بعض شرائطها"}, {r:204,n:"مَن استقرّ علیه حجّ الإفراد والقِران والعمرة"}, {r:205,n:"قضاء الحجّ عن المیّت ◂ الوصیّة بالحجّ ◂ قصور الترکة عن الحجّ والدَین مجتمعة"}],
  bk80: [{r:1,n:"شرائط انعقاد نذر الحجّ ◂ حکم الکافر فی المقام"}, {r:2,n:"حکم یمین ونذر الزوجة والمملوک والولد ◂ حکم الزوجة المنقطعة وولد الولد"}, {r:3,n:"فروع فی شمول الحکم لجملة من الموارد"}, {r:8,n:"نذر الحجّ من مکانٍ معیّن والخلف فیه"}, {r:9,n:"تأخیر الحجّ المنذور ◂ أحکام قضاء ما فوّت من الحجّ المنذور"}, {r:10,n:"عدم التمکّن من إتیان الحجّ المنذور"}, {r:11,n:"هل یجب القضاء فی النذر المعلّق علی شیء عن الناذر المتوفّی؟"}, {r:12,n:"زوال القدرة عن الحجّ النذریّ"}, {r:13,n:"نذر إحجاج الغیر"}, {r:14,n:"نذر الإحجاج معلّقاً علی شرط ◂ حکم المستطیع لو نذر الحجّ الواجب ◂ الاستطاعة فی نذر الحجّ"}, {r:15,n:"نذر غیر حجّة الإسلام فی عام الاستطاعة"}, {r:16,n:"الاستطاعة بعد نذر الحجّ وصورها"}, {r:17,n:"إهمال النذر وحصول الاستطاعة لحجّة الإسلام"}, {r:18,n:"هل یتداخل الحجّ النذری غیر المقیّد مع حجّة الإسلام؟"}, {r:19,n:"حصول الاستطاعة قبل تحقّق متعلّق الحجّ المنذور"}, {r:20,n:"ماذا یقدم من استقرّ فی ذمّته حجّتان فی صورة التزاحم؟"}, {r:21,n:"الحجّ الواجب بالنذر الموسّع"}, {r:22,n:"نذر الحجّ أو الإحجاج"}, {r:23,n:"نذر الحجّ أو زیارة الحسین"}, {r:24,n:"من مات وعلیه حجّ لم یعلم أنّه حجّة الإسلام أو حجّ النذر"}, {r:25,n:"نذر الحجّ ماشیاً"}, {r:26,n:"نذر الحجّ راکباً أو حافیاً"}, {r:27,n:"شرائط نذر الحجّ ماشیاً أو حافیاً أو راکباً"}, {r:28,n:"مبدأ وجوب المشی أو الحفاء"}, {r:29,n:"لزوم عدم ارتکاب ما ینافی نذر المشی للحجّ"}, {r:30,n:"مخالفة نذر المشی للحجّ"}, {r:31,n:"تخلّل الرکوب أثناء المشی للحجّ المنذور مشیاً"}, {r:32,n:"العجز عن المشی بعد انعقاد النذر"}, {r:33,n:"امتناع المشی لعارضٍ غیر العجز"}, {r:34,n:"مشروعیّة النیابة وشروط نائب الحجّ ◂ الأوّل: البلوغ، نیابة الصبیّ الممیّز ◂ الثانی: العقل، صحّة نیابة السفیه دون المجنون ◂ الثالث: الإیمان وعدم صحّة نیابة المخالف ◂ الرابع: العدالة ◂ الخامس: معرفة أعمال الحجّ ◂ السادس: عدم اشتغال ذمّة النائب بحجٍّ آخر"}, {r:35,n:"صحّة نیابة المملوک بإذن مولاه"}, {r:36,n:"اشتراط الإسلام فی المنوب عنه"}, {r:37,n:"حکم استنابة الصرورة"}, {r:38,n:"حکم الحجّ عن الصبیّ الممیّز والمجنون"}, {r:39,n:"شرطیّة المماثلة بین النائب والمنوب عنه"}, {r:40,n:"اعتبار قصد النیابة وتعیین المنوب عنه"}, {r:41,n:"حصول فراغ الذمّة باتیان الحجّ لا بمجرّد الإجارة"}, {r:42,n:"حکم استئجار المعذور فی ترک بعض الأعمال"}, {r:43,n:"صور موت النائب قبل الإتیان بالمناسک"}, {r:44,n:"التفصیل فی استحقاق اُجرة النائب المتوفی فی المناسک"}, {r:45,n:"تعیین نوع الحجّ المستأجر علیه"}, {r:46,n:"عدم اعتبار تعیین الطریق والحکم فی صورة التعیین"}, {r:47,n:"الإجارة للحجّ مرّتین فی سنة"}, {r:48,n:"اقتران الإجارتین للحجّ ◂ تأخیر حجّ الإجارة أو تقدیمه"}, {r:49,n:"تصحیح الإجارة الثانیة ببعض الوجوه"}, {r:50,n:"صدّ الأجیر أو إحصاره"}, {r:51,n:"هل یتحمّل النائب موجب الکفّارة؟"}, {r:52,n:"اقتضاء الإجارة التعجیل"}, {r:53,n:"استحباب ردّ الأجیر الزائد من الاُجرة أو التتمیم"}, {r:54,n:"حکم إفساد الأجیر حجّه"}, {r:55,n:"زمان ملکیّة الأجیر الاُجرة"}, {r:56,n:"إقتضاء الإجارة المباشرة"}, {r:57,n:"استئجار من ضاق وقته عن إتمام حجّ التمتّع"}, {r:58,n:"التبرّع بالحجّ عن المیّت والحیّ"}, {r:59,n:"نیابة شخص عن اثنین أو أزید فی عام واحد"}, {r:60,n:"نیابة جماعة عن المیّت أو الحیّ فی عامٍ واحد"}, {r:61,n:"إخراج الحجّ الموصی به من الأصل أو الثلث ◂ الشکّ فی الموصی به ◂ العلم بالوجوب والشکّ فی الأداء"}, {r:62,n:"کفایة المیقاتیّة مع إطلاق الوصیّة بالحجّ"}, {r:63,n:"تعیین اُجرة الحجّ الموصی به"}, {r:64,n:"ملاحظة شأن المیّت فی الاستئجار للحجّ"}, {r:65,n:"الوصیّة بالحجّ بعدد معیّن وبلا عدد"}, {r:66,n:"الوصیّة بالحجّ سنین متعدّدة مع عدم وفاء الاُجرة"}, {r:67,n:"الوصیّة بالحجّ بمقدار من الاُجرة"}, {r:68,n:"الوصیّة بالحجّ بتعیین أجیر معیّن"}, {r:69,n:"حکم تعیین اُجرة لا یرغب فیها راغب"}, {r:70,n:"حکم ما صالح علیه بشرط الحجّ عنه بعد موته"}, {r:71,n:"حکم الوصیّة بالحجّ عنه ماشیاً أو حافیاً"}, {r:72,n:"حکم الوصیّة بحجّتین أو أزید وأنّها واجبة علیه"}, {r:73,n:"الشکّ بعد موت الوصی فی تنفیذه الوصیّة"}, {r:74,n:"حکم تلف اُجرة الحجّ فی ید الوصیّ من دون تقصیر"}, {r:75,n:"الشکّ فی المال الموصی به للحجّ أنّه من الثلث أو لا؟"}, {r:76,n:"استحباب الطواف ومشروعیّته مستقلّاً"}, {r:77,n:"حکم الودیعة إذا مات صاحبها وعلیه حجّة الإسلام"}, {r:78,n:"جواز طواف النائب عن نفسه بعد الفراغ وعن غیره"}, {r:79,n:"جواز مباشرة الحجّ من قِبَل الآخذ للمال بنفسه"}, {r:80,n:"استحباب الحجّ من فاقد الشرائط وکراهة الترک"}, {r:81,n:"استحباب نیّة العود عند الخروج من مکّة"}, {r:82,n:"استحباب التبرّع بالحجّ عن الغیر"}, {r:83,n:"استحباب الاستقراض للحجّ مع الوثوق بالوفاء"}, {r:84,n:"استحباب إحجاج غیر المستطیع"}, {r:85,n:"جواز إعطاء الزکاة من لا یستطیع الحجّ"}, {r:86,n:"أفضلیّة الحجّ من الصدقة بنفقته"}, {r:87,n:"استحباب کثرة الانفاق فی الحجّ"}, {r:88,n:"حکم الحجّ بالمال المشتبة والمال الحرام"}, {r:90,n:"فی بعض شرائط الحجّ الندبی"}, {r:91,n:"إهداء ثواب الحجّ"}, {r:92,n:"ما یستحبّ لمن لا مال له"}, {r:93,n:"وجوب العمرة بشرائط الحجّ"}, {r:94,n:"إجزاء عمرة التمتّع عن العمرة المفردة"}, {r:95,n:"موارد من العمرة الواجبة"}, {r:96,n:"إختصاص النائی بالتمتّع والحاضر بالقِران والإفراد ◂ حدّ البعد الموجب للتمتّع ◂ وظیفة من منزله علی نفس الحدّ ومن شکّ فی منزله ◂ إجزاء الأقسام الثلاثة فی الحجّ الندبی ◂ حکم من کان له وطنان"}, {r:97,n:"وظیفة المکّی الخارج إلی بعض الأمصار"}, {r:98,n:"حکم المقیم بمکّة من أهل الآفاق ◂ الحدّ الموجب للانقلاب ◂ حکم المکّی المقیم فی بلد آخر"}, {r:99,n:"میقات المقیم فی مکّة إذا تمتّع ◂ حکم من لم یتمکّن من الإحرام من أحد المواقیت"}, {r:100,n:"صورة حجّ التمتّع وشرائطه ◂ شروط حجّ التمتّع ◂ الأوّل: النیّة، أی قصد نوع الحجّ ◂ الثانی: وقوع مجموع عمرته وحجّه فی أشهر الحجّ ◂ حکم الإتیان بعمرة التمتّع قبل أشهر الحجّ ◂ الثالث: وقوع الحجّ وعمرة التمتّع فی سنة واحدة ◂ الرابع: الإحرام من بطن مکّة ◂ الخامس: أن یکون مجموع عمرته وحجّه من واحد وعن واحد"}, {r:101,n:"حکم خروج المعتمر من مکّة"}, {r:102,n:"العدول من حجّ التمتّع إلی القِران أو الإفراد"}, {r:103,n:"الأقوال فی الحائض والنفساء لو ضاق وقتهما عن إتمام العمرة وإدراک الحجّ"}, {r:104,n:"الحکم إذا حدث الحیض أثناء طواف عمرة التمتّع"}, {r:105,n:"الأوّل: ذوالحلیفة وهو میقات أهل المدینة ومن یمرّ علیهم ◂ حکم تأخیر الإحرام إلی الجحفة"}, {r:106,n:"عدول أهل المدینة إلی میقاتٍ آخر"}, {r:107,n:"إحرام الحائض خارج المسجد"}, {r:108,n:"إحرام الجنب من خارج المسجد ◂ الثانی: العقیق، وهو میقات أهل نجد والعراق ومن یمرّ علیهم ◂ الثالث: الجحفة، وهو میقات أهل الشام ومصر والمغرب ◂ الرابع: یلملم، وهو میقات لأهل الیمن ◂ الخامس: قرن المنازل، وهو میقات لأهل الطائف ◂ السادس: مکّة، وهی لحجّ التمتّع ◂ السابع: دُوَیرة الأهل، میقات من کان منزله دون المیقات إلی مکّة ◂ الثامن: فخّ، وهو میقات الصبیان ◂ التاسع: محاذاة أحد المواقیت الخمسة ◂ ما تتحقّق به المحاذاة ◂ طرق ثبوت المحاذاة ◂ تبیّن الخلاف فی الإحرام من موضع المحاذاة ◂ العاشر: أدنی الحلّ، وهو میقات العمرة المفردة"}, {r:109,n:"میقات من یمرّ علی المواقیت"}, {r:110,n:"المحصّلة فی الإحرام من المواقیت"}, {r:111,n:"عدم جواز الإحرام قبل المیقات إلّا فی موردین : ◂ الأوّل: نذر الإحرام قبل المیقات ◂ إلحاق العهد والیمین بالنذر ◂ اعتبار تعیین المکان المنذور منه الإحرام ◂ الثانی: تقدیم الإحرام لمن خاف فوت العمرة"}, {r:112,n:"المنع عن تأخیر الإحرام عن المیقات"}, {r:113,n:"ترک الإحرام من المیقات"}, {r:114,n:"ترک الإحرام للعمرة المفردة عن المیقات"}, {r:115,n:"حکم من کان مریضاً لا یتمکّن من النزع ولبس الثوبین والمعذور عن إنشاء الإحرام"}, {r:116,n:"ترک الإحرام من المیقات ناسیاً أو جاهلاً"}, {r:117,n:"حکم المقیم بمکّة لو أراد حجّ التمتّع"}, {r:118,n:"نسیان المتمتّع الإحرام للحجّ من مکّة"}, {r:119,n:"من ترک الإحرام نسیاناً أو جهلاً وتذکّر بعد الفراغ من المناسک"}, {r:120,n:"مستحبّات الشروع فی الأعمال ◂ الأوّل: توفیر الشعر ◂ الثانی: قصّ الأظفار والأخذ من الشارب ونحو ذلک ◂ الثالث: الغسل أو بدله للإحرام فی المیقات وحکم تقدیمه علیه ◂ من أحرم بغیر غسل ◂ الدعاء بالمأثور عند الغسل ◂ الرابع: أن یکون الإحرام عقیب صلاة ◂ الخامس: صلاة ستّ رکعات أو أربع أو رکعتین للإحرام"}, {r:121,n:"کراهة استعمال الحنّاء قبل الإحرام"}, {r:122,n:"واجبات الإحرام ◂ الأوّل: النیّة وبیان مؤادّها"}, {r:123,n:"ما یعتبر فی نیّة الإحرام"}, {r:124,n:"تعیین خصوصیّات الإحرام فی النیّة"}, {r:125,n:"ما لا یعتبر فی نیّة الإحرام"}, {r:127,n:"إذا نسی أن إحرامه کان للعمرة أو للحجّ"}, {r:128,n:"لو نوی للحجّ والعمرة بنیّة واحدة"}, {r:129,n:"لو نوی الإحرام کإحرام فلان"}, {r:130,n:"لو نوی غیر ما وجب علیه أو نطق به أو شکّ"}, {r:133,n:"ما یستحبّ فی نیّة الإحرام"}, {r:134,n:"الثانی: التلبیة وکیفیّتها"}, {r:135,n:"ما یلزم مراعاته فی التلبیة"}, {r:136,n:"مواطن انعقاد الإحرام بالتلبیة وبالإشعار والتقلید"}, {r:137,n:"تأخیر التلبیة عن النیّة ولبس الثوبین"}, {r:138,n:"جواز إتیان محرّمات الإحرام قبل التلبیة"}, {r:139,n:"حکم نسیان التلبیة"}, {r:140,n:"استحباب إکثار التلبیة والجهر بها"}, {r:141,n:"أفضلیّة تأخیر التلبیة إلی المواضع الخاصّة"}, {r:142,n:"موضع قطع التلبیة للمعتمر والحاجّ"}, {r:143,n:"عدم لزوم صورة خاصّة فی تکرار التلبیة"}, {r:144,n:"الشکّ فی صحّة التلبیة"}, {r:145,n:"صور الشکّ فی التلبیة"}, {r:146,n:"الثالث: لبس الثوبین بلا کیفیّة مخصوصة فیهما"}, {r:147,n:"حکم من أحرم فی قمیصه عالماً عامداً ◂ نزع المحرم ثوبی الإحرام أو تبدیلهما حیناً مّا"}, {r:148,n:"لبس ما زاد علی الثوبین فی ابتداء الإحرام"}, {r:150,n:"ماهیّة الإجارة"}, {r:151,n:"الأوّل: الإیجاب والقبول ◂ الثانی: المتعاقدان وما یشترط فیهما ◂ الثالث: العوضان وما یشترط فیهما ◂ إعتبار الاختیار وعدم الإکراه ◂ إجارة المفلَّس والسفیه"}, {r:152,n:"إعتبار الحریّة وتعیین العین والمنفعة ومعلومیّتها"}, {r:155,n:"اُمور لابدّ من تعیینها"}, {r:160,n:"الإجارة بنحو التردید بین وجهین وأجرین"}, {r:161,n:"اشتراط وقت معیّن فی الإجارة وحکم تخلّف الشرط"}, {r:163,n:"کلام فی المعاطاة ◂ بیع العین المستأجرة"}, {r:164,n:"وقوع البیع والإجارة فی زمانٍ واحد"}, {r:165,n:"هل تبطل الإجارة بموت المؤجر أو المستأجر؟"}, {r:166,n:"حدود الولایة علی الصبی فی المقام"}, {r:167,n:"إجارة المرأة نفسها مدّة ثمّ أقدمت علی الزواج فی أثنائها"}, {r:168,n:"أحکام تابعیّة المملوک المستخدم بعد عتقه من مولاه"}, {r:169,n:"تبیّن العیب فی العین المستأجرة"}, {r:170,n:"تبیّن العیب فی الاُجرة"}, {r:171,n:"إفلاس المستأجر"}, {r:172,n:"جریان خیار الغبن فی الإجارة"}, {r:173,n:"ما یجری وما لا یجری من الخیارات فی الإجارة"}, {r:174,n:"بیع العین المستأجرة علی المستأجر"}, {r:175,n:"استقرار الاُجرة مع تسلّم العین بلا توقّف علی الاستیفاء"}, {r:176,n:"حکم الاُجرة مع بذل العین وعدم تسلّمها"}, {r:177,n:"ما تستقرّ فیه الاُجرة من المنافع"}, {r:178,n:"تلف العین المستأجرة قبل الاستیفاء وتمام المدّة"}, {r:179,n:"فسخ الإجارة فی أثناء المدّة"}, {r:180,n:"تلف بعض العین المستأجرة"}, {r:181,n:"استظهار ملکیّة الاُجرة من حین العقد وتبعات ذلک"}, {r:182,n:"الإجارة علی الکلّی وتلف فرد منه"}, {r:183,n:"انهدام الدار المستأجرة"}, {r:184,n:"امتناع المؤجِر من التسلیم"}, {r:185,n:"الامتناع بمنع ظالم من الانتفاع بالعین"}, {r:186,n:"لو تعذّر علی المستأجر الاستیفاء"}, {r:187,n:"موجبات ما تلف بسبب سماوی أو بسبب مُتلِف"}, {r:188,n:"إجارة الزوجة نفسها بلا إذن من الزوج فیما ینافی حقّ الاستمتاع"}, {r:189,n:"شرطیّة التسلیم والتسلّم وتحقّقها باختلاف الموارد"}, {r:190,n:"تبیّن بطلان الإجارة فی المدّة أو بعدها"}, {r:191,n:"إجارة الملک المشاع بإذن من الشریک فی التسلیم"}, {r:192,n:"استئجار اثنین داراً علی الإشاعة أو بالتناوب"}, {r:194,n:"اشتراط الضمان علی المستأجر ◂ الضمان فی الإجارة الباطلة ◂ حکم الضمان لعین المستأجر التی بید المؤجر"}, {r:195,n:"المدار علی أیّ القیّم فی الضمان؟"}, {r:196,n:"ضمان الأجیر إتلاف العین فی صورةٍ استحقّ الاُجرة علیها"}, {r:197,n:"ضمان تلف العین بید من تجاوز الحدّ المأذون فیه"}, {r:198,n:"ارتکاب الطبیب ما یوجب الضمان"}, {r:199,n:"مسقطات الضمان عن الطبیب"}, {r:200,n:"ضمان الحمّال ما یُسقطه من المتاع"}, {r:201,n:"حکم الضمان بحسب الموارد والأشخاص فی جملة موارد"}, {r:202,n:"ما یوجب الضمان علی العبد"}, {r:203,n:"عدم ضمان صاحب الدابّة"}, {r:204,n:"عدم ضمان صاحب السفینة"}, {r:205,n:"ضمان المحمول زیادة علی المسمّی"}, {r:206,n:"ضمان الزیادة فی السیر عن المسمّی"}, {r:207,n:"سوق الدابّة ونحوها بالمتعارف علیه من الضرب ونحوه"}, {r:208,n:"عدم تمکّن الأجیر من حفظ ما استؤجر علیه"}, {r:209,n:"عدم ضمان صاحب الحمّام حفظ الثیاب"}, {r:210,n:"کفایة مالکیّة المنفعة فی صحّة الإجارة ◂ اعتبار مالکیّة المنفعة فی صحّة الإجارة وفروع ذلک ◂ صحّة إجارة العین المستأجرة مع عدم اشتراط المباشرة"}, {r:211,n:"دفع متعلّق العمل غیر المشروط فیه المباشرة إلی الغیر"}, {r:212,n:"جواز تبرّع الغیر عن الأجیر غیر المشروط بالمباشرة"}, {r:213,n:"أحکام الأجیر الخاصّ"}, {r:214,n:"العمل لغیر المستأجر مع عدم تعیین المباشرة أو المدّة"}, {r:215,n:"صور ثبوت الاُجرة فی غیر مورد الإجارة وفروع ذلک"}, {r:217,n:"صور فی فوات المنفعة علی المستأجر أو تعذّرها"}, {r:219,n:"استیفاء المنفعة فی أغراض لم یرضها الشارع"}, {r:220,n:"الاشتباه فی استیفاء منفعة عین غیر المستأجرة"}, {r:221,n:"التزاحم فی متعلّق الإجارة"}, {r:222,n:"فهرست محتویات الکتاب ◂ فهرست الإصدارات العلمیّة لمؤسّسة السبطین علیهماالسلام العالمیّة"}],
  bk81: [{r:1,n:"إجارة الأرض للزرع بما یحصل منها فی الزرع"}, {r:2,n:"إجارة حصّة من الأرض مشاعاً أو بنحو الکلّی فی المعیّن أو فی الذمّة"}, {r:3,n:"إجارة الأرض لتعمل مسجداً"}, {r:4,n:"استئجار الدراهم والدنانیر للزینة والشجر للاستظلال والبستان للتنزّه"}, {r:5,n:"الاستئجار لحیازة المباحات"}, {r:8,n:"استئجار المرأة للإرضاع والارتضاع"}, {r:9,n:"استئجار المرأة المزوّجة للرضاع"}, {r:10,n:"جواز إجبار الأمة علی الرضاع إلّا المکاتبة والمبعّضة"}, {r:11,n:"إجارة المرأة نفسها للرضاع قبل التزوّج"}, {r:12,n:"عدم الفرق فی المرتضع بین المعیّن والکلّی"}, {r:13,n:"حکم استئجار الشاة للبنها والشجرة لثمرتها"}, {r:14,n:"حکم الإجارة لإتیان الواجبات العینیّة والکفائیّة"}, {r:15,n:"الإجارة لأعمال المسجد والمشهد"}, {r:16,n:"جواز الاستئجار للحراسة واشتراط الضمان"}, {r:17,n:"استئجار شخصین للصلاة عن میّت واحد وشخص واحد للحجّ عن میّتین أو نحوه"}, {r:18,n:"الإجارة للنیابة عن الأحیاء فی العبادات"}, {r:19,n:"العمل للغیر تبرّعاً"}, {r:20,n:"حکم المأمور بعمل لو عمله بقصد التبرّع أو بدونه"}, {r:21,n:"الضابط فی موضوع الإجارة من الأعیان والأعمال"}, {r:22,n:"الإجارة علی الأعمال المستحبّة لا بعنوان النیابة"}, {r:23,n:"تحمّل ما یتوقّف علیه العمل من الأعیان"}, {r:24,n:"الجمع بین الإجارة والبیع فی عقد واحد"}, {r:25,n:"الاستئجار للإنفاذ فی جمیع حوائج المستأجر"}, {r:26,n:"استعمال الأجیر مع عدم تعیین الاُجرة"}, {r:27,n:"صور انقضاء مدّة الإجارة قبل إدراک الزرع"}, {r:28,n:"التنازع فی أصل الإجارة"}, {r:29,n:"النزاع فی نحو استیفاء المنفعة"}, {r:30,n:"التنازع فی قدر المستأجر علیه"}, {r:31,n:"النزاع فی ردّ العین المستأجرة"}, {r:32,n:"ادّعاء العامل تلف العین وإنکار المالک"}, {r:33,n:"کراهة تضمین الأجیر فی مورد ضمانه"}, {r:34,n:"النزاع فی مقدار الاُجرة"}, {r:35,n:"النزاع فی تعیّن العین أو الاُجرة"}, {r:36,n:"الاختلاف فی الاشتراط وعدمه"}, {r:37,n:"الاختلاف فی مدّة الإجارة"}, {r:38,n:"الاختلاف فی صحّة وفساد العقد"}, {r:39,n:"النزاع فی تعیین المقصد"}, {r:40,n:"النزاع فی نحو العمل وکیفیّته"}, {r:41,n:"موارد الیمین فی باب التداعی"}, {r:42,n:"خاتمة فیها مسائل : ◂ الاُولی: خراج الأرض علی المالک لا المستأجر ◂ الثانیة: أخذ الاُجرة علی قراءة التعزیة ◂ الثالثة: استئجار الصبی الممیّز ◂ الرابعة: حکم اُصول الزرع الباقیة بعد انقضاء مدّة الإجارة ◂ الخامسة: ضمان القصّاب ما یذبحه علی غیر الوجه الشرعی ◂ السادسة: الإتیان عن غیر المنوب عنه فیما استؤجر علیه ◂ السابعة: توکیل المستأجر فی تجدید الإجارة ◂ الثامنة: إجارة العین المشتراة ببیع الخیار ◂ التاسعة: حصول العمل المستأجر علیه لا بقید المباشرة بتبرّع المتبرّع ◂ العاشرة: الإجارة لعمل حصل مانعٌ عن إتمامه ◂ الحادیة عشرة: فسخ الأجیر ذوالخیار قبل العمل أو بعده أو فی أثنائه ◂ الثانیة عشرة: جواز اشتراط النفقة علی الأجیر أو المؤجر ◂ الثالثة عشرة: إجارة المالک للعین المستأجرة ◂ الرابعة عشرة: تملّک العین المستأجرة قبل انقضاء مدّة الإجارة ◂ الخامسة عشرة: عدم بطلان إجارة الأرض للزراعة لو نقص الحاصل بآفة ◂ السادسة عشرة: إجارة الأرض مدّة بتعمیرها ◂ السابعة عشرة: أخذ الاُجرة علی الطبابة ◂ الثامنة عشرة: الإجارة علی ختم القرآن ◂ التاسعة عشرة: توزیع المسافة فی إجارة الحجّ البلدی علی متعدّدین ◂ العشرون: حکم الإخلال السهوی فی الصلاة الاستئجاریّة إذا لم یکن مبطلاً لها"}, {r:44,n:"معنی المضاربة لغةً واصطلاحاً ◂ صور دفع المال إلی الغیر للتجارة ◂ الشرائط العامّة فی المضاربة ◂ الشرائط الخاصّة: ما یشترط فی رأس المال ◂ أوّلاً: أن یکون عیناً ◂ ثانیاً: أن یکون من الذهب والفضّة المسکوکین ◂ ثالثاً: کونه معلوماً قدراً ووصفاً ◂ رابعاً: کونه معیّناً ◂ خامساً: یشترط فی الربح، أن یکون مشاعاً ◂ سادساً: تعیین حصّة کلّ منهما ◂ سابعاً: أن یکون الربح بین المالک والعامل ◂ ثامناً: ذَکَرَ بعضهم من الشرائط، أن یکون رأس المال بید العامل ◂ تاسعاً: کون الاسترباح بالتجارة ◂ عاشراً: کفایة رأس المال ◂ آثار اشتراط القدرة فی المضاربة ◂ المضاربة علی ماله الموجود فی ید غیره ◂ جواز فسخ عقد المضاربة ◂ اشتراط عدم الفسخ فی المضاربة ◂ أحکام الشروط فی المضاربة ◂ حکم المضاربة بقصد الانتفاع بالنماء"}, {r:45,n:"اشتراط الخسارة أو ضمان رأس المال علی العامل"}, {r:46,n:"حکم شرط المالک علی العامل اُموراً ومخالفة العامل"}, {r:47,n:"عدم جواز خلط رأس المال بمالٍ آخر"}, {r:48,n:"حرّیّة التصرّف للعامل مع إطلاق العقد"}, {r:49,n:"حکم بیع العامل نسیئة بلا إذن"}, {r:50,n:"حکم المعاملة بأزید أو أقلّ من قیمة المثل"}, {r:51,n:"البیع بغیر النقد"}, {r:52,n:"شراء الجنس المعیب"}, {r:53,n:"الشراء فی الذمّة ◂ الثانی: أن یقصد کون الثمن فی ذمّته ◂ صور الشراء فی الذمّة : ◂ الأوّل: أن یشتری بقصد المالک وفی ذمّته ◂ الثالث: أن یقصد ذمّة نفسه ◂ الرابع: قصد دفع الثمن من مال المضاربة ◂ الخامس: قصد الشراء فی ذمّته من غیر لحاظٍ إلی نفسه وغیره"}, {r:54,n:"وظیفة العامل تحمّل أعباء العمل التجاری بموجب المضاربة"}, {r:55,n:"نفقة سفر العامل"}, {r:56,n:"بیان المراد بالنفقة ومقدارها والمراد من السفر المستحقّ فیه النفقة"}, {r:60,n:"کیفیّة توزیع المال لو تعدّد أرباب العمل"}, {r:61,n:"عدم اشتراط ظهور الربح فی استحقاق النفقة"}, {r:62,n:"نفقة علاج العامل لو مرض فی السفر"}, {r:63,n:"نفقة رجوع العامل لو حصل الفسخ أو الانفساخ فی السفر"}, {r:64,n:"تداخل العقد بین المضاربة والقرض والبضاعة"}, {r:65,n:"الاختلاف فینوع المعاملة"}, {r:66,n:"بیان صور تقسیم الربح"}, {r:67,n:"تفاوت التعبیر فی تعیین ربح النصف"}, {r:68,n:"جواز اتّحاد المالک مع تعدّد العامل، وعکسه"}, {r:69,n:"صور کون المال مشترکاً بین اثنین"}, {r:70,n:"بطلان المضاربة بموت کلّ من المالک أو العامل"}, {r:71,n:"عدم جواز توکیل العامل غیره إلّا بإذن المالک"}, {r:72,n:"ثلاث صور فی إذن المالک فی مضاربة الغیر"}, {r:73,n:"مضاربة العامل غیره من دون إذن المالک"}, {r:74,n:"حکم الشرط فی ضمن المضاربة"}, {r:75,n:"ملکیّة العامل للربح بمجرّد ظهوره وأقوال فی المسألة"}, {r:76,n:"اعتبار الربح وقایة لرأس المال"}, {r:77,n:"ظهور الربح لو نضّ تمامه أو بعضه"}, {r:78,n:"بیع العامل حصّته من الربح"}, {r:79,n:"جبران الربح للخسارة"}, {r:80,n:"عدم ضمان العامل ما لم یکن غیر أمین"}, {r:81,n:"شراء المالک من العامل من مال المضاربة"}, {r:82,n:"الأخذ بالشفعة من المالک"}, {r:83,n:"وطء العامل الجاریة من مال المضاربة"}, {r:84,n:"شراء العامل زوج المالکة فی المضاربة"}, {r:85,n:"شراء من ینعتق علی المالک بمال المضاربة"}, {r:86,n:"شراء العامل من ینعتق علیه"}, {r:87,n:"أحکام الفسخ والانفساخ فی عقد المضاربة ◂ الاُولی: کون الفسخ قبل الشروع فی العمل ◂ بیان أحکام المضاربة : ◂ الثانیة: إذا کان الفسخ قبل حصول الربح ◂ الثالثة: کون الفسخ من العامل بعد السفر بإذن المالک ◂ الرابعة: حصول الفسخ قبل حصول الربح وبالمال عروض ◂ الخامسة: حصول الفسخ بعد حصول الربح وبالمال عروض ◂ السادسة: لو کان فی المال دیون علی الناس ◂ السابعة: قیام الوارث مقام المالک أو العامل فیموتها ◂ الثامنة: وجوب التخلیة بین المالک وماله علی العامل"}, {r:88,n:"فروع کون الربح وقایة لرأس المال"}, {r:89,n:"أحکام المضاربة الفاسدة"}, {r:90,n:"إدّعاء المضاربة علی أحدٍ وإنکار الأخیر"}, {r:91,n:"تنازع العامل والمالک فی رأس المال"}, {r:92,n:"إدّعاء المالک علی العامل التخلّف"}, {r:93,n:"التنازع فی التلف"}, {r:94,n:"التنازع فی مقدار حصّة العامل"}, {r:95,n:"التنازع فیأصل المضاربة أو تسلیم المال"}, {r:96,n:"التنازع فی صحّة المضاربة"}, {r:97,n:"إدّعاء الردّ وإنکاره"}, {r:98,n:"إدّعاء الفسخ وإنکاره"}, {r:99,n:"اختلاف العامل والمالک فی الشراء للمضاربة وغیره"}, {r:100,n:"إدّعاء المالک المضاربة والقابض القرض"}, {r:101,n:"إدّعاء المالک القرض والعامل المضاربة"}, {r:102,n:"النزاع فی کونه إبضاعاً أو مضاربة"}, {r:103,n:"الاختلاف فی مقدار الربح أو حصوله، أو فی مقدار نصیب العامل ◂ مسائل : ◂ الاُولی: موت العامل وعنده مال مضاربة ◂ الثانیة: اشتراط التنجیز فی المضاربة ◂ الثالثة: لا یشترط الحَجر فی العامل ◂ الرابعة: عروض ما یبطل المضاربة ◂ الخامسة: مضاربة المالک فی مرض الموت ◂ السادسة: کون رأس المال لغیر المضارب ◂ السابعة: اشتراط المضاربة فی عقد لازم ◂ الثامنة: إیقاع المضاربة بعنوان الجعالة ◂ التاسعة: اتّجار الولیّ بمال المولّی علیه ◂ العاشرة: إیصاء الولیّ بالمضاربة بمال الولیّ علیه ◂ الحادیة عشرة: تلف المال فی ید العامل بعد موت المالک ◂ الثانیة عشرة: فسخ أحد الشریکین العقد ◂ الثالثة عشرة: أخذ العامل مال المضاربة وترک التجارة مدّة ◂ الرابعة عشرة: اشتراط العامل عدم جبران الربح للخسارة ◂ الخامسة عشرة: مخالفة العامل للمالک ◂ السادسة عشرة: حکم تعدّد العامل فی المضاربة ◂ السابعة عشرة: تلف المال فی المعاملة نسیئة بإذن المالک ◂ الثامنة عشرة: حکم المضاربة مع الذمّی ◂ التاسعة عشرة: المضاربة بالمال الکلّی ◂ العشرون: تبعیض المالک فی تسلیم مال المضاربة إلی العامل"}, {r:104,n:"معنی الشرکة وأقسامها وما یعتبر فیها ◂ اختصاص الشرکة العقدیّة بالأعیان"}, {r:105,n:"لو استأجر اثنین لعملٍ واحد"}, {r:106,n:"حکم ما یستحصل بعملٍ مشترک"}, {r:107,n:"اشتراط الامتزاج فی الشرکة العقدیّة"}, {r:108,n:"تساوی الشریکین فی الربح والخسارة"}, {r:109,n:"حکم التصرّف فی المال المشترک"}, {r:110,n:"العامل أمین لا یضمن إلّا مع التفریط"}, {r:111,n:"الشرکة من العقود الجائزة"}, {r:112,n:"تعیین الأجل فی عقد الشرکة"}, {r:113,n:"ادّعاء أحد الشریکین علی الآخر الخیانة"}, {r:114,n:"إدّعاء العامل التلف"}, {r:115,n:"بطلان الشرکة بالموت"}, {r:116,n:"النزاع فی أنّه اشتری لنفسه أو بالشرکة"}, {r:118,n:"معنی المزارعة ومشروعیّتها ◂ شرائط عقد المزارعة : ◂ الأوّل: الإیجاب والقبول 404 الثانی: الشرائط العامة من البلوغ والعقل وغیرهما ◂ السادس: تعیین المدّة ◂ الثالث: أن یکون النماء مشترکاً بینهما ◂ الرابع: أن یکون مشاعاً بینهما ◂ الخامس: تعیین الحصّة ◂ السابع: قابلیّة الأرض للزرع ولو بالعلاج ◂ الثامن: تعیین المزروع ◂ التاسع: تعیین الأرض ومقدارها ◂ العاشر: تعیین المصارف کالبذر وغیره وکونه علی أیّهما ◂ عدم اشتراط کون الأرض ملکاً للمزارع ◂ الإذن بزراعة أرضٍ علی حصّةٍ من الحاصل منها"}, {r:119,n:"لزوم عقد المزارعة ومبطلاته ◂ حکم المزارعة المعاطاتیّة والإذنیّة"}, {r:120,n:"الاستعارة والرجوع فی إعارة الأرض للمزارعة"}, {r:121,n:"حکم اشتراط أحدهما علی الآخر شیئاً مضافاً إلی الحصّة"}, {r:122,n:"القسمة بعد استثناء مقدار البذر أو ما یُصرف ◂ إذا شرط مدّة معیّنة والزرع لم یبلغ"}, {r:123,n:"لو ترک الزارع الزرع حتّی انقضت المدّة"}, {r:124,n:"إذا غصَب الأرض غاصب"}, {r:125,n:"إذا تعدّی الزارع ما عیّن له من الزرع"}, {r:126,n:"لو زارع علی أرضٍ لا ماء لها"}, {r:127,n:"تعیین من علیه البذر"}, {r:128,n:"حکم عقد المزارعة بین أزید من اثنین"}, {r:129,n:"مزارعة العامل غیره"}, {r:130,n:"تبیّن بطلان العقد"}, {r:131,n:"مفاد عقد المزارعة وتحدید زمان الاشتراک فی الحاصل"}, {r:132,n:"حصول موجب الانفساخ فی الأثناء"}, {r:133,n:"حصول الفسخ فی الأثناء بالتقایل ونحوه"}, {r:134,n:"تبیّن مغصوبیّة الأرض بعد عقد المزارعة ◂ تبیّن مغصوبیّة البذر ◂ تبیّن الغصبیّة فی سائر المصارف"}, {r:135,n:"حکم خراج الأرض ومن علیه سائر المؤن ◂ جواز الخرص بین الزارع والمالک ◂ حقیقة الخرص وأحکامه"}, {r:136,n:"وجوب الزکاة علی المالک والزرع مع تحقّق النصاب"}, {r:137,n:"حکم الباقی من الاُصول بعد الزرع"}, {r:138,n:"اختلاف المالک والزارع فیالمدّة أو الحصّة وغیر ذلک"}, {r:139,n:"الاختلاف فی اشتراط کون البذر أو العوامل علی أیّهما"}, {r:140,n:"الاختلاف فی الإعارة والمزارعة"}, {r:141,n:"لو ادّعی المالک الغصب والزارع المزارعة"}, {r:142,n:"حکم قلع الزرع بعد تعلّق الزکاة وقبل البلوغ"}, {r:143,n:"مسائل متفرّقة : ◂ الاُولی: إذا قصّر العامل فی تربیة الزرع فقلّ الحاصل ◂ تسلیم الأرض الخراجیّة إلی غیره لِزَرعها لنفسه ◂ الثانیة: إدّعاء المالک علی العامل التخلّف عن الشرط أو نحوه ◂ الثالثة: إدّعاء أحدهما شرطاً وإنکار الآخر أصل الاشتراط ◂ الرابعة: إدّعاء الغبن فی المعاملة ◂ الخامسة: مزارعة الأرض الموقوفة ◂ السادسة: جواز مزارعة الکافر ◂ السابعة: النهی عن تسمیة حصّة للبذر وحصّة للبقر وثالثة للأرض ◂ الثامنة: جواز المصالحة عن الحصّة بمقدارٍ معیّن ◂ التاسعة: جواز المزارعة علی الأرض البائرة وبعض صور الاشتراط ◂ العاشرة: استحباب الدعاء عند نثر الحبّ"}, {r:145,n:"معنی المساقاة ومشروعیّتها ◂ شرائط المساقاة : ◂ الأوّل: الإیجاب والقبول ◂ الثانی: البلوغ والعقل والاختیار ◂ الثالث: عدم الحَجْر ◂ الرابع: کون الاُصول مملوکة عیناً أو منفعة ◂ الخامس: کونها معیّنة عندهما ◂ السادس: کونها ثابتة مغروسة ◂ السابع: تعیین المدّة ◂ الثامن: أن یکون قبل ظهور الثمر ◂ التاسع: أن تکون الحصّة معیّنة مشاعة ◂ العاشر: تعیین ما علی المالک وما علی العامل ◂ صحّة المساقاة قبل ظهور الثمر ◂ المساقاة علی أشجار لا ثمر لها"}, {r:146,n:"المساقاة علی اُصول غیر ثابتة"}, {r:147,n:"المعاملة علی أشجار لا تحتاج إلی السقی"}, {r:148,n:"المساقاة علی فسلانٍ مغروسة"}, {r:149,n:"المساقاة علی ودیّ غیر مغروسة"}, {r:150,n:"المساقاة لازمة"}, {r:151,n:"حکم المساقاة إذا مات أحد الطرفین"}, {r:152,n:"الضابط فی تعیین ما علیهما من الأعمال بمقتضی العقد"}, {r:153,n:"ما لا یصحّ اشتراطه علی المالک وما یصحّ"}, {r:154,n:"ترک العامل ما اشترط علیه"}, {r:155,n:"شرط العامل أن یعمل غلام المالک معه"}, {r:156,n:"عدم اعتبار مباشرة العامل للعمل"}, {r:157,n:"اشتراط انفراد أحدهما بالثمر"}, {r:158,n:"عدم اعتبار العلم بمقدار کلّ نوعٍ من أنواع الشجر"}, {r:159,n:"جواز إفراد کلّ نوعٍ بحصّة"}, {r:160,n:"ملاحظة اختلاف کیفیّة السقی فی تقدیر الحصّة"}, {r:161,n:"اشتراط شیء غیر الحصّة"}, {r:162,n:"لو تلف بعض الثمرة فی صورة اشتراط شیء"}, {r:163,n:"حکم جعل المالک للعامل حصّة من الاُصول"}, {r:164,n:"لو تبیّن فی الأثناء عدم خروج الثمر"}, {r:165,n:"الاستئجار بحصّة من الثمرة"}, {r:166,n:"أحکام بطلان عقد المساقاة"}, {r:167,n:"إشتراط مساقاة فیعقد مساقاة"}, {r:168,n:"جواز تعدّد العامل أو المالک"}, {r:169,n:"امتناع العامل عن العمل بعد إجراء العقد"}, {r:170,n:"حصول العمل من غیر العامل"}, {r:171,n:"أحکام فسخ المالک عند امتناع العامل"}, {r:173,n:"تبیّن غصبیّة الاُصول"}, {r:174,n:"حکم مساقاة العامل غیره"}, {r:175,n:"خراج الأرض علی المالک"}, {r:176,n:"ملکیّة العامل لحصّته من حین الظهور ◂ فروع ملکیّة الحصّة بالظهور : ◂ حکم الزکاة بالنسبة إلی العامل"}, {r:177,n:"صورة التنازع بین المساقین"}, {r:178,n:"حکم خیانة العامل"}, {r:179,n:"حکم المغارسة وفروع الحکم بالبطلان"}, {r:180,n:"الجهل بکیفیّة وصحّة المغارسة ◂ تذنیب"}],
  bk90: [{r:1,n:"معنی الضمان وإطلاقاته وشرائطه"}, {r:2,n:"أحدها: الإیجاب"}, {r:3,n:"الثانی: القبول من المضمون له"}, {r:4,n:"الثالث: کون الضامن بالغاً عاقلاً"}, {r:5,n:"الرابع: کونه مختاراً"}, {r:6,n:"الخامس: عدم کونه محجوراً"}, {r:7,n:"السادس: عدم کون الضامن مملوکاً ◂ السابع: التنجیز ◂ الثامن: ثبوت الدین فیذمّة المضمون عنه"}, {r:8,n:"التاسع: عدم اشتغال ذمّة الضامن ◂ العاشر: امتیاز الدین والمضمون له والمضمون عنه"}, {r:9,n:"عدم اعتبار العلم بمقدار المضمون أو جنسه"}, {r:10,n:"انتقال الحق إلی ذمّة الضامن بالضمان"}, {r:11,n:"إبراء ذمّة الضامن والمضمون عنه"}, {r:12,n:"لزوم الضمان من طرف الضامن والمضمون له وحکم ضمان المعسر"}, {r:14,n:"اشتراط الخیار وغیره فی الضمان"}, {r:15,n:"تبیّن کون الضامن مملوکاً"}, {r:16,n:"ضمان الدَین الحالّ مؤجّلاً وبالعکس"}, {r:17,n:"حکم ضمان الدَین الحال مؤجّلاً"}, {r:18,n:"موت الضامن وحلول الدَین المؤجّل ◂ ضمان الدَین المؤجّل بأقلّ من أجله وأدائه"}, {r:19,n:"ضمان الدَین المؤجّل حالّاً بإذن المضمون عنه"}, {r:20,n:"حکم الضمان من غیر إذن المضمون عنه"}, {r:21,n:"لیس للضامن الرجوع إلّا بعد الأداء بمقدار ما أدّی"}, {r:22,n:"احتساب المضمون له الدَین علی الضامن من الحقوق الشرعیّة"}, {r:23,n:"بیع المضمون له بما یساوی أقلّ من الدَین"}, {r:24,n:"لو دفع المضمون عنه إلی الضامن مقدار ما ضمن قبل الأداء"}, {r:25,n:"لو دفع المضمون عنه بأمر الضامن"}, {r:27,n:"إذا دفع المضمون عنه بغیر إذن الضامن ◂ إذا ضمن تبرّعاً فضمن عنه ضامن"}, {r:28,n:"ضمان الدَین بأقلّ منه أو أکثر"}, {r:29,n:"الضمان بغیر جنس الدَین"}, {r:30,n:"الضمان بشرط الرهانة"}, {r:31,n:"إذا کان علی الدَین رهن فهل ینفک بالضمان؟"}, {r:32,n:"اشتراط الضمان فی مالٍ معیّن وما فیه من أقسام"}, {r:33,n:"إذن المولی لعبده بالضمان فی کسبه"}, {r:34,n:"ضمان إثنین عن واحد"}, {r:35,n:"ضمان کلّ من المدینین ما علیه للاخر"}, {r:36,n:"عدم اعتبار علم الضامن بثبوت الدَین"}, {r:37,n:"ضمان ما تشهد به البیّنة"}, {r:39,n:"جواز الدور فی الضمان ◂ ضمان دَین الفقیر بالوفاء من الخمس ونحوه"}, {r:40,n:"کون الدَین زکاةً أو خمساً"}, {r:41,n:"الضمان فی مرض الموت"}, {r:42,n:"ضمان ما یعتبر مباشرة المدیون له وضمان الکلّی فی المعیّن"}, {r:43,n:"حکم ضمان نفقة الزوجة والأقارب"}, {r:44,n:"ضمان مال الکتابة"}, {r:45,n:"حکم ضمان مال الجعالة والسبق والرمایة"}, {r:46,n:"حکم ضمان الأعیان المضمونة"}, {r:47,n:"حکم ضمان درک الثمن للمشتری"}, {r:48,n:"ضمان أرش المعیب ◂ ضمان عهدة الثمن وتبیّن بعض المبیع مستحقّاً"}, {r:49,n:"ضمان ما یحدثه المشتری فی الأرض"}, {r:50,n:"ضمان المتاع الملقی فی البحر لغرضٍ عقلائی"}, {r:51,n:"اختلاف المضمون له والمضمون عنه"}, {r:52,n:"اختلاف الضامن والمضمون له"}, {r:53,n:"اختلاف الضامن والمضمون عنه"}, {r:54,n:"إنکار الضامن الضمان"}, {r:55,n:"لو ادّعی الضامن الوفاء وأنکر المضمون له"}, {r:56,n:"لو أذِن له المدین فی وفاء دینه بلا ضمان فوفی"}, {r:57,n:"تعریف الحوالة وشرائطها العامّة ◂ الشرائط المعتبرة فی الحوالة ◂ الأوّل: الإیجاب والقبول ◂ الثانی: التنجیز ◂ الثالث: الرضا من المحیل والمحتال ◂ الرابع: کون المحال به ثابتاً فی ذمّة المحیل ◂ الخامس: کون المحال به معلوماً جنساً وقدراً لهما ◂ السادس: تساوی المالین المحال به والمحال علیه ◂ حکم الحوالة بالمنفعة والعمل"}, {r:58,n:"براءة ذمّة المحیل بمجرّد تحقّق الحوالة"}, {r:59,n:"عدم وجوب قبول الحوالة"}, {r:60,n:"لزوم الحوالة ما لم تکن علی معسر"}, {r:61,n:"الحوالة علی البریء"}, {r:62,n:"اشتراط خیار الفسخ"}, {r:63,n:"جواز الدور والترامی فی الحوالة"}, {r:64,n:"جواز التبرّع عن الغیر"}, {r:65,n:"لو ادّعی المحیل علی المحال علیه مالاً فأنکره"}, {r:66,n:"اشتغال ذمّة المحیل للبریء عند الحوالة أو الأداء"}, {r:67,n:"حوالة السیّد علی مکاتبه بمال الکتابة وفروع فی المقام"}, {r:68,n:"الاختلاف فی کون الواقع حوالة أو وکالة"}, {r:71,n:"إذا وقعت الحوالة علی المشتری وبالعکس وتبیّن بطلان البیع"}, {r:72,n:"إذا وقعت الحوالة بأحد الوجهین"}, {r:73,n:"إذا أحال علی وکیله بمال شخصی فی یده"}, {r:75,n:"التزوّج بالنساء وحبهنّ من سنن الإسلام المؤکّدة ◂ کراهة العزوبة وثبوت الاستحباب للنکاح من غیر اختصاص بواحدة أو بنوع"}, {r:76,n:"حکم النکاح بالنظر إلی الطبیعة والطوارئ"}, {r:78,n:"مستحبات من أراد التزویج"}, {r:79,n:"المکروه عند إیقاع العقد"}, {r:80,n:"ترجیح جملة صفات للتزویج ◂ الأخبار فی کراهة تزویج جملة من الرجال وما تحمل علیه"}, {r:81,n:"مستحبّات الدخول علی الزوجة"}, {r:82,n:"أکل ما ینثر فی الأعراس"}, {r:83,n:"مستحبّات ومکروهات الجماع"}, {r:84,n:"أوقات کراهة الجماع"}, {r:85,n:"جملة من سنن النکاح وآدابه"}, {r:97,n:"النظر إلی المرأة لمن یرید تزویجها"}, {r:99,n:"نظر المرأة إلی الرجل الّذی یرید تزویجها"}, {r:100,n:"النظر إلی نساء أهل الذمّة وسائر الکفّار"}, {r:101,n:"نظر کلّ من الرجل والمرأة لمماثله"}, {r:102,n:"حلّیّة کلّ المرأة لزوجها والرجل لزوجته"}, {r:103,n:"نظر الخنثی إلی الذکر وبالعکس"}, {r:104,n:"حکم النظر إلی الأجنبیّة وهی إلی الأجنبی وحکم الوجه والکفّین"}, {r:105,n:"النظر إلی المحارم"}, {r:106,n:"نظر السیّد إلی مملوکته"}, {r:108,n:"موارد الاستثناء من الحرمة فی الأجنبی والأجنبیّة"}, {r:110,n:"حمل وتقبیل الصبیّة من غیر المحارم"}, {r:111,n:"نظر المملوک والخصی لمالکتهما"}, {r:112,n:"سماع صوت الأجنبیّة ◂ نظر المرأة للرجل الأعمی"}, {r:113,n:"مصافحة الأجنبی للأجنبیّة"}, {r:114,n:"السلام علی النساء من غیر المحارم"}, {r:115,n:"الجلوس فی مجلس المرأة قبل برده"}, {r:116,n:"الاستئذان علی الأب"}, {r:117,n:"تفریق الأطفال فی المضاجع"}, {r:118,n:"النظر إلی العضو المبان من الأجنبیّ"}, {r:119,n:"وصل شعر المرأة بشعر غیرها"}, {r:120,n:"عدم اقتضاء جواز النظر جواز المسّ"}, {r:121,n:"اعتبار عدم التعدّی عن مقدار الضرورة"}, {r:122,n:"کراهة خروج النساء واختلاطهنّ بالرجال"}, {r:123,n:"اشتباه محلّل النظر والتستّر مع محرّمه بالشبهة المحصورة وغیرها"}, {r:124,n:"وجوب التستّر علی النساء وحرمة النظر علی الرجال وحکم العکس"}, {r:125,n:"تحدید النظر المحرّم"}, {r:126,n:"حکم وطء الزوجة والمملوکة فی الدبر"}, {r:127,n:"حکم وطء الحائض دبراً"}, {r:128,n:"هل یتحقّق النشوز بعدم تمکین الزوجة من وطئها دبراً؟"}, {r:129,n:"اشتراک الوطء فی الدبر والقبل فی جملة الأحکام"}, {r:130,n:"تحقّق الحنث بالوطء دبراً لو حلف علی الترک"}, {r:131,n:"موارد العزل"}, {r:132,n:"ترک وطء الزوجة أکثر من أربعة أشهر"}, {r:133,n:"حکم ما لو کانت المرأة لا تصبر عن المواقعة إلی أربعة أشهر"}, {r:134,n:"تدارک ما فات من ترک الوطء لمانع"}, {r:135,n:"حرمة وطء الزوجة قبل إکمال تسع سنین"}, {r:136,n:"التحریم بإفضاء الصغیرة قبل إکمال التسع"}, {r:137,n:"وجوب الدیة وتعلّق النفقة للمفضاة ◂ حقیقة الإفضاء وأنّه لا فرق فیه بالدخول قبلاً ودبراً"}, {r:138,n:"اختصاص الحکم بالزوجة الصغیرة المفضاة بالوطء دون غیرها"}, {r:139,n:"الدخول بالزوجة بعد إکمالها التسع"}, {r:140,n:"حکم المفضی إذا کان صغیراً أو مجنوناً"}, {r:141,n:"ضمان من عیبت بغیر الإفضاء"}, {r:142,n:"وطء من شکّ فی إکمالها تسع سنین"}, {r:143,n:"جریان أحکام الزوجیّة بعد الإفضاء"}, {r:144,n:"عدم سقوط النفقة بنشوز المفضاة"}, {r:145,n:"حرمة الزیادة علی الأربع فی العقد الدائم وجوازه فی الملک والتحلیل والمنقطع ◂ الجمع بین أزید من أمتین للحرّ وأزید من حرّتین للعبد ◂ صور الجمع للحرّ والعبد ◂ حکم العبد والأمة المبعّضین"}, {r:146,n:"عتق العبد عن ثلاث أو أربع إماء"}, {r:147,n:"الشکّ فی أنّ عقد الأربع بالدائم"}, {r:148,n:"من کان عنده أربع فطلّق واحدة وأراد نکاح الخامسة"}, {r:149,n:"حرمة التزویج فی عدّة الغیر ◂ تحریم المزوّجة فی العدّة مطلقاً دواماً ومتعة قبلاً دخل أو دبراً ◂ ما لا یلحق بالتزویج فی العدّة من الموارد ◂ عدم إلحاق وطء المعتدة شبهة ولا زناً ما عدا الرجعیّة"}, {r:150,n:"التزویج فی العدّة من قِبَل الولیّ والوکیل"}, {r:151,n:"جواز تزویج من فی العدّة لنفسه"}, {r:152,n:"المناط فی الدخول المعتبر شرطاً فی الحرمة الأبدیّة"}, {r:153,n:"الشکّ فی کون المرأة فی العدّة"}, {r:154,n:"العلم بالعدّة والشکّ فی الدخول والعلم بالدخول والشکّ من جهة اُخری"}, {r:155,n:"العلم الإجمالی بکون إحداهما فی العدّة"}, {r:156,n:"من علم بالعدّة شکّ فی أنّها لنفسه أو لغیره"}, {r:157,n:"الزواج بذات البعل وصوره"}, {r:158,n:"التزوّج بامرأة علیها عدّة لم تشرع فیها"}, {r:159,n:"الزواج بذات العدّة جهلاً والحمل منها"}, {r:160,n:"إذا اجتمعت عدد مختلفة هل تتداخل أم تتعدّد؟ ◂ حکم ما لو کانت العدّتان لشخصٍ واحد"}, {r:161,n:"ثبوت المهر للموطوءة أو المزوّجة فی العدّة"}, {r:162,n:"مبدأ العدّة فی وطء الشبهة"}, {r:163,n:"حکم الموطوءة بالشبهة لو کانت عالمة فی الحرّة والأمة"}, {r:164,n:"حکم المهر لو تعدّد الوطء"}, {r:165,n:"أحکام نکاح الزانیة"}, {r:166,n:"لا تحرم علی الرجل امرأته بزناها"}, {r:167,n:"الزنا بذات البعل"}, {r:168,n:"الزنا بذات العدّة الرجعیّة"}, {r:169,n:"من لاط بغلام فأوقبه وایجابه الحرمة علی اُمّه وبنته واُخته وعدمها فی الموطوء ◂ حکم اللواط بعد التزویج ◂ حکم الوطء غیر العمدی ◂ الاُمّ الرضاعیّة کالنسبیة من جهة الحرمة وکذا الاُخت والبنت ◂ الشکّ فی تحقّق الإیقاب وعدمه"}, {r:170,n:"التزویج حال الإحرام وفروع فی البطلان والتحریم ◂ من تزوج عالماً بالحرمة غافلاً عن کونه محرماً أو ناسیاً"}, {r:171,n:"وطء الزوجة فی حال الإحرام"}, {r:172,n:"بطلان التزویج من غیر جهة الإحرام"}, {r:173,n:"الشکّ فی کون التزویج فی الإحرام أو قبله أو بعده"}, {r:174,n:"حکم إنکشاف فساد الإحرام أو إفساده"}, {r:175,n:"رجوع المحرم فی الطلاق فی العدّة الرجعیّة"}, {r:176,n:"جواز التوکیل للمحرم فی إیقاع التزویج"}, {r:177,n:"إجازة عقد الفضولی فی حال الإحرام وبعده"}, {r:178,n:"حقیقة المصاهرة ◂ حرمة زوجة الأب والابن علی الآخر"}, {r:179,n:"حرمة مملوکة الأب علی الابن وبالعکس"}, {r:180,n:"حرمة اُمّ الزوجة علی الزوج"}, {r:181,n:"حرمة البنت علی الزوج الداخل باُمّها ◂ تحدید الدخول المحرّم"}, {r:182,n:"وطء الأب والابن مملوکة الآخر"}, {r:183,n:"جواز وطء الأب مملوکة ابنه الصغیر"}, {r:184,n:"حکم ما لو زنی الأب أو الابن بمملوکة الآخر"}, {r:185,n:"حکم وطء الأب أو الابن مملوکة الآخر شبهة"}, {r:186,n:"نکاح المرأة علی عمّتها أو خالتها وبالعکس"}, {r:187,n:"شمول الحکم لمطلق العمّة والخالة بلا فرق ولا استثناء حال"}, {r:189,n:"اقتران العقدین علی العمّة وبنت أخیها أو الخالة وبنت اُختها"}, {r:190,n:"عدم الفرق فی العمّة والخالة مسلمتین وغیرهما وبین الدنیا والعلیا منهما"}, {r:191,n:"کفایة الرضا الباطنی"}, {r:192,n:"عدم کفایة الإذن السابق فی التزویج"}, {r:193,n:"الرجوع عن الإذن بعد العقد"}, {r:194,n:"کفایة الإذن وإن کان عن غرور"}, {r:195,n:"اعتبار إذنهما من باب الحکم الشرعی"}, {r:196,n:"الاشتراط علی العمّة أو الخالة الإذن فی تزویج بنت الأخ أو الاُخت"}, {r:197,n:"الشکّ فی حصول إذن العمّة أو الخالة"}, {r:198,n:"صحّة العقد بالإذن اللاحق"}, {r:199,n:"حکم الشکّ فی سبق أحد العقدین واقترانه"}, {r:200,n:"إذا ادّعتا عدم الإذن وادّعی هو الإذن"}, {r:201,n:"صحّة التزویج إذا حصلت البنتیّة بعده أو کان الجمع بینهما حال الکفر ثمّ أسلم"}, {r:202,n:"تزوّج بنت الأخ أو الاُخت لو طلّق عمّتها أو خالتها"}, {r:203,n:"حکم المملوکتین والمختلفتین"}, {r:205,n:"الزنا الطارئ علی التزویج ◂ الزنا السابق علی التزویج ◂ حکم الوطء بالشبهة"}, {r:206,n:"الزنا بمملوکة الأب والعکس"}, {r:207,n:"ترتّب حکم الزنا بالوطء فی القبل أو الدبر"}, {r:208,n:"بعض فروع الشکّ فی الزنا"}, {r:209,n:"حصول الزنا بالاختیاری والاضطراری بالبالغة وغیرها"}, {r:211,n:"حکم ما لو زنا لاحقاً ثمّ طلّق زوجته وأراد الرجوع لها"}, {r:212,n:"الزنا بعد التزویج بالفضولی"}, {r:213,n:"النظر واللمس بشهوة هل ینشر الحرمة؟"}, {r:216,n:"الجمع بین الاُختین فی النکاح وفی الملک"}, {r:217,n:"التزویج بإحدی الاُختین وملک الاُخری"}, {r:218,n:"وطء إحدی الاُختین بالملک والتزوّج بالاُخری"}, {r:219,n:"بطلان عقد الثانیة بعد التزوج بالاُولی"}, {r:220,n:"حکم ما لو تزوّج بالاُختین واشتبه السابق واللاحق"}, {r:221,n:"حکم اقتران عقد الاُختین"}, {r:222,n:"حکم وطء إحدی الاُختین المملوکتین"}, {r:223,n:"وطء الثانیة بعد وطء الاُولی"}, {r:224,n:"حکم الجمع بین الاُختین من الزنا"}, {r:225,n:"حکم التزوّج بإحدی الاُختین فی عدّة اُختها"}, {r:226,n:"حکم التزوّج بإحدی الاُختین مع الزنا بالاُخری أو وطئها شبهة"}, {r:227,n:"حکم الجمع بین فاطمیّتین"}, {r:228,n:"التزویج بالإماء"}, {r:229,n:"تزویج الأمة مع عدم الشرطین"}, {r:230,n:"تحقّق الشرطین وزوالهما بعد التزوج"}, {r:231,n:"الوطء بالتحلیل أو بملک الیمین"}, {r:232,n:"تزویج حرّة لا یقدر علی مقاربتها"}, {r:233,n:"من لم تکفه مع الشرطین أمة واحدة"}, {r:234,n:"طلب الحرّة مهراً بمقدار یعدّ ضرراً علیه"}, {r:235,n:"جواز نکاح الأمة علی الحرّة مع إذنها بالشرطین ◂ نکاح الحرّة علی الأمة ◂ نکاح الحرّة والأمة فی عقد واحد"}, {r:236,n:"نکاح المبعّضة علی المبعّضة أو الحرّة"}, {r:237,n:"حکم موت الحرّة أو طلاقها بعد عقد الأمة"}, {r:238,n:"حکم التزوّج بالأمة فی عدّة الحرّة"}, {r:239,n:"نکاح الأمة بعد التزوّج الفضولی بحرّة"}, {r:240,n:"الشکّ فی السابق من عقد الحرّة والأمة"}, {r:241,n:"الاشتراط فی عقد الحرّة إذنها فی نکاح الأمة"}, {r:242,n:"أمر تزویج المملوک عبداً وأمةً لسیّده"}, {r:243,n:"صحّة زواج المملوک وقف علی إجازة المولی وکونها کاشفة"}, {r:244,n:"حکم المهر فی تزویج المملوک"}, {r:245,n:"مهر الأمة المزوّجة للمولی ونفقتها"}, {r:246,n:"جعل المهر للأمة المأذونة فی التزویج"}, {r:247,n:"نکاح المملوک عبداً أو أمةً المشترک والمبعّض"}, {r:248,n:"حکم النکاح والمهر فی فرض شراء الحرّة زوجها المملوک"}, {r:249,n:"ملکیّة المولود من مملوکین"}, {r:250,n:"منع اشتراط رقّیّة الولد من الحرّ"}, {r:251,n:"تزوّج الحرّ مملوکة غیره وحکم الولد والمهر"}, {r:252,n:"هل للوارث إجازة العقد الواقع علی أمةٍ مُورِّثة؟"}, {r:253,n:"حکم الأمة المدَلّسة علی الحرّ من جهة النکاح والمهر والولد"}, {r:254,n:"زواج العبد بحرّة من دون إذن مولاه وإجازته وحکم الولد"}, {r:255,n:"زنا العبد بحرّة من غیر عقد"}, {r:256,n:"زنا الحرّ بأمة وکذا العبد بأمة الغیر"}, {r:257,n:"تحلیل المولی أمته لعبده وتزویجها منه وفروع ذلک"}, {r:258,n:"إرادة المولی التفریق بین عبده وأمته"}, {r:259,n:"إعطاء المولی شیئاً لأمته لو زوّجها من عبده"}, {r:260,n:"انتقال الأمر بالمفارقة لورثة المولی"}, {r:261,n:"لو زوّج الأمة غیر مولاها من حرّ"}, {r:262,n:"من تزوّج بأمة بین شریکین ثمّ اشتری بعضها"}, {r:263,n:"عتق الأمة المزوّجة وثبوت الخیار لها ◂ حکم المهر لو کان العتق بعد الدخول وقبله"}, {r:264,n:"حکم المهر لو کان العتق قبل الدخول والفسخ بعده"}, {r:265,n:"نکاح الأمة بتفویض المهر أو البضع"}, {r:266,n:"الحکم لو کان العتق فی العدّة الرجعیّة أو البائنة"}, {r:267,n:"عدم افتقار الفسخ لإذن الحاکم"}, {r:268,n:"فوریّة الخیار بعد العتق للأمة المزوّجة"}, {r:269,n:"إعلام المعتقة بالحال"}, {r:270,n:"الخیار فیمن لا یصحّ منها الاختیار"}, {r:271,n:"ثبوت الخیار ولو کان التزویج برضاها"}, {r:272,n:"اشتراط المولی فی العتق عدم الخیار فی الفسخ"}, {r:273,n:"عدم الخیار للعبد المعتق"}, {r:274,n:"الحکم لو کان للعبد حرّة وأمتان واُعتقت إحداهما"}, {r:275,n:"الصیغة وشرائطها فی النکاح"}, {r:276,n:"التعاقد بالإشارة وبالکتابة"}, {r:278,n:"التطابق بین الإیجاب والقبول فی ألفاظ المتعلّقات"}, {r:279,n:"الاکتفاء بلفظ «نعم» بعد الاستفهام"}, {r:280,n:"اللحن فی الصیغة"}, {r:281,n:"قصد الانشاء فی إجراء الصیغة"}, {r:282,n:"معرفة معنی الصیغة تفصیلاً"}, {r:283,n:"الموالاة بین الإیجاب والقبول"}, {r:284,n:"اتّحاد مجلس الإیجاب والقبول"}, {r:285,n:"التنجیز فی العقد"}, {r:286,n:"وقوع العقد علی وجه یخالف الاحتیاط"}, {r:287,n:"شرط کمال العاقد"}, {r:288,n:"وکالة السفیه عن الغیر فی العقد"}, {r:289,n:"شرط الذکورة فی العاقد"}, {r:290,n:"شرط بقاء أهلیّة المتعاقدین إلی تمام العقد"}, {r:291,n:"شرط تعیین الزوج والزوجة"}, {r:292,n:"اختلاف الاسم والوصف أو أحدهما مع الإشارة"}, {r:293,n:"تنازع الزوجین فی التعیین وعدمه ◂ الاتّفاق علی التعیین والاختلاف فی المعیّن"}, {r:294,n:"نکاح الحمل وإنکاحه"}, {r:295,n:"اشتراط علم کلّ من الزوجین بأوصاف الآخر"}, {r:296,n:"اشتراط الخیار فی نفس العقد وفی المهر ◂ تصادق الرجل والمرأة علی الزوجیّة ونکرانها من أحدهما ◂ الإقرار بعد الإنکار ورجوع المدّعی عن دعواه ◂ من تزوّج امرأة ادّعی غیره سبق زوجیّتها ◂ تزوّج من ادّعی زوجیّتها رجل مع إنکارها ◂ من أنکرت دعوی زوجیّتها من رجل وادّعت زوجیّته من اُختها أو اُمّها أو بنتها ◂ زوجیّة العبد من مملوکة اشتراها لاحقاً له أو للمولی أو مطلقاً ◂ تصدیق دعوی عدم الزوجیّة من غیر فحص ◂ ادّعاء المرأة الزوجیّة بعد التزوّج بها ◂ لزوم العلم بایقاع الوکیل للعقد فی زمان معین قبل المقاربة منهما"}, {r:297,n:"ولایة الأب والجدّ الأب ◂ عدم ولایة الاُمّ ولا الجد من قبلها ولا الأخ والعم والخال وأولادهم ◂ ولایة الأب والجدّ علی الصغیرین والمجنون ◂ الولایة علی البالغ والبالغة الرشیدین ◂ لزوم إذن البکر والأب ما لم تسقط ولایته ◂ محتملات ذهاب البکارة"}, {r:298,n:"ثبوت ولایة الجدّ فی حیاة الأب وموته"}, {r:299,n:"نفوذ تزویج الولی الصغیرة بعد بلوغها ورشدها وکذا الصغیر"}, {r:300,n:"ما یشترط فی صحّة تزویج الأب"}, {r:301,n:"تزویج الولیّ البنت بدون مهر المثل أو الصغیر بأزید منه"}, {r:302,n:"لزوم إذن الولی فی نکاح السفیه"}, {r:303,n:"الرشد فی شؤون المال وعدمه فی شؤون النکاح"}, {r:304,n:"استقلال الأب والجد فی الولایة وما یتفرّع علیه"}, {r:305,n:"تزویج الولی للمولّی علیه من ذی العیب ◂ ثبوت الخیار مع الجهل بالعیب المجوّز للفسخ"}, {r:306,n:"تزویج مملوک المملوک"}, {r:307,n:"الولایة للوصیّ فی تزویج المجنون والصغیر"}, {r:308,n:"ولایة الحاکم الشرعی"}, {r:309,n:"الاستئذان من الأب والجد والأخ"}, {r:310,n:"کفایة سکوت البکر فی إحراز إذنها"}, {r:311,n:"عامّة شرائط الأولیاء"}, {r:312,n:"تعدّی الوکیل عمّا عیّنه الموکّل ◂ تزویج وکیل المرأة من نفسه"}, {r:313,n:"النکاح الفضولی حکماً ومعنیً ولزوم الإجازة وفروع فی المقام"}, {r:332,n:"معنی الوصیّة وتقسیماتها ◂ نفوذ الوصیّة العهدیّة والتوقّف فی الوصیّة التملیکیّة علی القبول ◂ إیقاع القبول بعد وفاة الموصی"}, {r:333,n:"ما یجب عند ظهور أمارات الموت"}, {r:334,n:"حکم ردّ الموصی له الوصیّة"}, {r:335,n:"قبول أحد شیئین أو بعض شیء من قبل الموصی له"}, {r:336,n:"تصرّف الورثة فی العین الموصی بها"}, {r:337,n:"موت الموصی له قبل القبول أو الردّ وقیام الوارث مقامه ◂ فروع فی مسألة موت الموصی له ◂ الأوّل: هل الحکم یشمل ورثة الوارث؟ ◂ الثانی: قبول بعض الورثة وردّ بعضهم ◂ الثالث: الوجه فی انتقال الموصی به إلی وارث الموصی له ◂ الرابع: المدار فی الوارث ◂ الخامس: هل ترث الزوجة الأرض الموصی بها لزوجها لو مات قبل القبول؟ ◂ السادس: کون الموصی به ممّن ینعتق علی الموصی له"}, {r:338,n:"عدم اشتراط القبول فی الوصیّة العهدیّة وما إذا کان للنوع أو للجهة"}, {r:339,n:"تحقّق الوصیّة بکلّ ما دلّ علیها من لفظٍ أو فعل"}, {r:340,n:"شرائط الموصی ◂ الأوّل: البلوغ، بیان نفوذ وصیّة البالغ عشراً ◂ الثانی: العقل ◂ الثالث: الاختیار ◂ الرابع: الرشد، بیان وصیّة السفیه المفلّس ◂ الخامس: الحرّیّة، بیان وصیّة العبد لو انعتق ◂ السادس: أن لا یکون قاتل نفسه، وفیه أحکام"}, {r:341,n:"وصیّة الأب أو الجدّ مع فقد الآخر بالولایة علی الأطفال"}],
};

function normalizeBookName(name) {
  if (!name) return name;
  let n = name.replace(/[\u064B-\u065F\u0670]/g, '');
  n = n.replace(/\u0640/g, '');
  n = n.replace(/^(كتاب)\s+(?!ال)(\S)/, (m, k, c) => `${k} ال${c}`);
  return n;
}

function parseManhajTitle(title) {
  let t = (title || '').trim().replace(/[\u064B-\u065F\u0670]/g, '').replace(/\u0640/g, '');
  const dashIdx = t.indexOf(' - ');
  if (dashIdx !== -1) {
    return { book: normalizeBookName(t.slice(0, dashIdx).trim()), rest: t.slice(dashIdx + 3).trim() };
  }
  if (t.startsWith('كتاب ')) return { book: normalizeBookName(t), rest: null };
  return { book: null, rest: t };
}

function buildTopicTree(groupBooks) {
  const isUrwaGroup = groupBooks.length > 0 && isUrwaBook(groupBooks[0].id);
  const bookNodes = [];
  const bookIndex = new Map();

  function getBookNode(name) {
    if (!bookIndex.has(name)) {
      const node = { name, faslList: [], faslIndex: new Map() };
      bookIndex.set(name, node);
      bookNodes.push(node);
    }
    return bookIndex.get(name);
  }
  function getFaslList(bookNode, faslName) {
    const key = faslName || '';
    if (!bookNode.faslIndex.has(key)) {
      const fasl = { name: faslName, items: [] };
      bookNode.faslIndex.set(key, fasl);
      bookNode.faslList.push(fasl);
    }
    return bookNode.faslIndex.get(key).items;
  }

  for (const book of groupBooks) {
    const res = db.exec(`SELECT rowid, title, body, footnotes FROM "${book.bk_table}" ORDER BY rowid`);
    const rows = res.length ? res[0].values : [];
    if (isUrwaGroup) {
      const bookEvents = (URWA_BOOK_MAP[book.bk_table] || []).slice().sort((a, b) => a.r - b.r);
      const faslEvents = (URWA_FASL_EVENTS[book.bk_table] || []).slice().sort((a, b) => a.r - b.r);
      rows.forEach((r, idx) => {
        const rowid = r[0], title = r[1] || '(بدون عنوان)';
        let bookName = null;
        for (const ev of bookEvents) { if (ev.r <= rowid) bookName = ev.n; else break; }
        if (!bookName) return;
        let faslName = null;
        for (const ev of faslEvents) {
          if (ev.r <= rowid) { if (bookEvents.every(be => be.r <= ev.r || be.r > rowid)) faslName = ev.n; }
        }
        const bookStart = bookEvents.filter(be => be.n === bookName).reduce((min, be) => be.r <= rowid ? Math.max(min, be.r) : min, 0);
        faslName = null;
        for (const ev of faslEvents) { if (ev.r >= bookStart && ev.r <= rowid) faslName = ev.n; }
        const bookNode = getBookNode(bookName);
        const items = getFaslList(bookNode, faslName);
        items.push({ bookId: book.id, sectionIdx: idx, title });
      });
    } else {
      rows.forEach((r, idx) => {
        const title = r[1] || '(بدون عنوان)';
        const parsed = parseManhajTitle(title);
        if (!parsed.book) return;
        const bookNode = getBookNode(parsed.book);
        const items = getFaslList(bookNode, null);
        items.push({ bookId: book.id, sectionIdx: idx, title: parsed.rest || title });
      });
    }
  }
  return bookNodes;
}

function collectAllUrwaJurists() {
  const settings = getJuristSettings();
  const names = new Set(URWA_REAL_JURISTS);
  const ordered = settings.order.filter(n => names.has(n));
  const rest = [...names].filter(n => !settings.order.includes(n)).sort((a, b) => a.localeCompare(b, 'ar'));
  return [...ordered, ...rest];
}

function canonicalJurist(rawName) {
  if (!rawName) return null;
  return URWA_JURIST_MAP[rawName] || null;
}

function updateJuristSettingsBtnState() {
  const btn = document.getElementById('urwaSettingsBtn');
  if (!btn) return;
  if (isThamraBook(currentBookId)) {
    btn.style.display = 'flex';
    btn.setAttribute('onclick', 'openThamraJuristSettingsPanel()');
    btn.title = 'إعدادات آراء المراجع بالثمرة';
  } else if (isUrwaBook(currentBookId)) {
    btn.style.display = 'flex';
    btn.setAttribute('onclick', 'openJuristSettingsPanel()');
    btn.title = 'إعدادات هوامش العروة';
  } else {
    btn.style.display = 'none';
  }
}

function openJuristSettingsPanel() {
  renderJuristSettingsList();
  document.getElementById('juristSettingsOverlay').classList.add('show');
}
function closeJuristSettingsPanel() {
  document.getElementById('juristSettingsOverlay').classList.remove('show');
  document.querySelectorAll('.fn-body.open').forEach(el => { el.classList.remove('open'); el.dataset.built = ''; });
  refreshAllRenderedSections();
}

function renderJuristSettingsList() {
  const names = collectAllUrwaJurists();
  const settings = getJuristSettings();
  let html = `<p class="jurist-help">رتّب أولوية ظهور المراجع داخل هوامش العروة، أو أخفِ من لا تريد ظهوره، أو ميّز من تريد تمييزه بلون خاص.</p>
    <div class="jurist-help" style="border:1px solid #ccc;border-radius:10px;padding:8px 10px;margin-bottom:12px;">
      <div style="font-weight:bold;margin-bottom:6px;">تعليقات المراجع المطبوعة أعلى الصفحة قبل الهامش رقم 1 تُنسب إلى:</div>
      <button onclick="setLeadMode('o')" style="margin-left:6px;padding:6px 12px;border-radius:8px;border:1px solid ${settings.lead === 'o' ? '#2e7d32' : '#999'};background:${settings.lead === 'o' ? '#2e7d32' : 'transparent'};color:${settings.lead === 'o' ? '#fff' : 'inherit'};">أول هامش في الصفحة</button>
      <button onclick="setLeadMode('s')" style="padding:6px 12px;border-radius:8px;border:1px solid ${settings.lead === 's' ? '#2e7d32' : '#999'};background:${settings.lead === 's' ? '#2e7d32' : 'transparent'};color:${settings.lead === 's' ? '#fff' : 'inherit'};">آخر هامش في الصفحة السابقة</button>
    </div>`;
  names.forEach((name, i) => {
    const hidden = !!settings.hidden[name];
    const fav = !!settings.favorite[name];
    html += `<div class="jurist-row ${hidden ? 'jurist-hidden' : ''} ${fav ? 'jurist-fav' : ''}" data-key="${escapeHtml(name)}">
      <span class="jurist-grip" title="اسحب لتغيير الترتيب"><i class="ti ti-grip-vertical"></i></span>
      <span class="jurist-name">${escapeHtml(name)}</span>
      <button class="jurist-fav-btn ${fav ? 'active' : ''}" title="مميّز" onclick="toggleJuristFavorite('${escapeHtml(name).replace(/'/g, "\\'")}')"><i class="ti ti-star"></i></button>
      <button class="jurist-hide-btn ${hidden ? 'active' : ''}" title="إخفاء" onclick="toggleJuristHidden('${escapeHtml(name).replace(/'/g, "\\'")}')"><i class="ti ti-${hidden ? 'eye-off' : 'eye'}"></i></button>
    </div>`;
  });
  document.getElementById('juristSettingsList').innerHTML = html || '<div class="empty-state">لم يُعثر على أي مرجع بالحواشي</div>';
  enableJuristDragReorder(document.getElementById('juristSettingsList'), keys => {
    const st = getJuristSettings(); st.order = keys; saveJuristSettings(st); renderJuristSettingsList();
  });
}

function enableJuristDragReorder(listEl, onReorder) {
  if (!listEl) return;
  listEl.querySelectorAll('.jurist-row .jurist-grip').forEach(grip => {
    grip.addEventListener('pointerdown', ev => {
      if (ev.pointerType === 'mouse' && ev.button !== 0) return;
      const row = grip.closest('.jurist-row');
      if (!row) return;
      ev.preventDefault();
      const rows = Array.from(listEl.querySelectorAll('.jurist-row'));
      const from = rows.indexOf(row);
      if (from < 0) return;
      const scroller = (function find(el) {
        while (el && el !== document.body) {
          const cs = getComputedStyle(el);
          if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight) return el;
          el = el.parentElement;
        }
        return null;
      })(listEl);
      try { grip.setPointerCapture(ev.pointerId); } catch (e) {}
      const startY = ev.clientY;
      const startScroll = scroller ? scroller.scrollTop : 0;
      const h = row.offsetHeight;
      const tops = rows.map(r => r.offsetTop);
      let curY = startY, to = from, raf = 0;
      row.classList.add('jurist-dragging');
      rows.forEach(r => { if (r !== row) r.style.transition = 'transform .15s ease'; });
      const apply = () => {
        const dy = (curY - startY) + ((scroller ? scroller.scrollTop : 0) - startScroll);
        row.style.transform = `translateY(${dy}px)`;
        const center = tops[from] + h / 2 + dy;
        let idx = 0;
        rows.forEach((r, k) => { if (k !== from && tops[k] + r.offsetHeight / 2 < center) idx++; });
        to = idx;
        rows.forEach((r, k) => {
          if (k === from) return;
          let shift = 0;
          if (from < to && k > from && k <= to) shift = -h;
          else if (from > to && k >= to && k < from) shift = h;
          r.style.transform = shift ? `translateY(${shift}px)` : '';
        });
      };
      const tick = () => {
        if (scroller) {
          const sb = scroller.getBoundingClientRect();
          if (curY < sb.top + 40) scroller.scrollTop -= 12;
          else if (curY > sb.bottom - 40) scroller.scrollTop += 12;
        }
        apply();
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      const move = e => { curY = e.clientY; };
      const finish = commit => {
        cancelAnimationFrame(raf);
        grip.removeEventListener('pointermove', move);
        grip.removeEventListener('pointerup', up);
        grip.removeEventListener('pointercancel', cancel);
        try { grip.releasePointerCapture(ev.pointerId); } catch (e) {}
        apply();
        rows.forEach(r => { r.style.transform = ''; r.style.transition = ''; });
        row.classList.remove('jurist-dragging');
        if (commit && to !== from) {
          const keys = rows.map(r => r.getAttribute('data-key'));
          keys.splice(to, 0, keys.splice(from, 1)[0]);
          onReorder(keys);
        }
      };
      const up = () => finish(true);
      const cancel = () => finish(false);
      grip.addEventListener('pointermove', move);
      grip.addEventListener('pointerup', up);
      grip.addEventListener('pointercancel', cancel);
    });
  });
}

function moveJurist(idx, dir) {
  const names = collectAllUrwaJurists();
  const settings = getJuristSettings();
  const target = idx + dir;
  if (target < 0 || target >= names.length) return;
  settings.order = names.slice();
  const tmp = settings.order[idx];
  settings.order[idx] = settings.order[target];
  settings.order[target] = tmp;
  saveJuristSettings(settings);
  renderJuristSettingsList();
}

function toggleJuristHidden(name) {
  const settings = getJuristSettings();
  if (settings.hidden[name]) delete settings.hidden[name]; else settings.hidden[name] = true;
  saveJuristSettings(settings);
  renderJuristSettingsList();
}

function toggleJuristFavorite(name) {
  const settings = getJuristSettings();
  if (settings.favorite[name]) delete settings.favorite[name]; else settings.favorite[name] = true;
  saveJuristSettings(settings);
  renderJuristSettingsList();
}

const THAMRA_JURIST_SETTINGS_KEY = 'thamra_jurist_settings_v1';
const THAMRA_REAL_JURISTS = ['الاحقاقي','الحكيم','الخامنئي','الخميني','الخوئي','الزنجاني','السيد صادق','السيستاني','الشيرازي','الصدر','العصفور','الفياض','المدرسي','الواعظي','الوحيد','بشير','زين الدين'];

function getThamraJuristSettings() {
  try {
    const raw = localStorage.getItem(THAMRA_JURIST_SETTINGS_KEY);
    const s = raw ? JSON.parse(raw) : {};
    return { order: s.order || [], hidden: s.hidden || {}, favorite: s.favorite || {} };
  } catch (e) { return { order: [], hidden: {}, favorite: {} }; }
}
function saveThamraJuristSettings(s) {
  try { localStorage.setItem(THAMRA_JURIST_SETTINGS_KEY, JSON.stringify(s)); } catch (e) {}
}
function collectThamraJurists() {
  const settings = getThamraJuristSettings();
  const names = new Set(THAMRA_REAL_JURISTS);
  const ordered = settings.order.filter(n => names.has(n));
  const rest = [...names].filter(n => !settings.order.includes(n)).sort((a, b) => a.localeCompare(b, 'ar'));
  return [...ordered, ...rest];
}

function openThamraJuristSettingsPanel() {
  renderThamraJuristSettingsList();
  document.getElementById('thamraJuristSettingsOverlay').classList.add('show');
}
function closeThamraJuristSettingsPanel() {
  document.getElementById('thamraJuristSettingsOverlay').classList.remove('show');
  if (currentThamraSectionIndex != null) renderThamraReaderContent();
}

function setLeadMode(m) {
  const settings = getJuristSettings();
  settings.lead = (m === 's') ? 's' : 'o';
  saveJuristSettings(settings);
  renderJuristSettingsList();
}

function renderThamraJuristSettingsList() {
  const names = collectThamraJurists();
  const settings = getThamraJuristSettings();
  let html = `<p class="jurist-help">رتّب أولوية ظهور المراجع بآراء الثمرة، أو أخفِ من لا تريد ظهوره، أو ميّز من تريد تمييزه بلون خاص.</p>`;
  names.forEach((name, i) => {
    const hidden = !!settings.hidden[name];
    const fav = !!settings.favorite[name];
    html += `<div class="jurist-row ${hidden ? 'jurist-hidden' : ''} ${fav ? 'jurist-fav' : ''}" data-key="${escapeHtml(name)}">
      <span class="jurist-grip" title="اسحب لتغيير الترتيب"><i class="ti ti-grip-vertical"></i></span>
      <span class="jurist-name">${escapeHtml(name)}</span>
      <button class="jurist-fav-btn ${fav ? 'active' : ''}" title="مميّز" onclick="toggleThamraJuristFavorite('${escapeHtml(name).replace(/'/g, "\\'")}')"><i class="ti ti-star"></i></button>
      <button class="jurist-hide-btn ${hidden ? 'active' : ''}" title="إخفاء" onclick="toggleThamraJuristHidden('${escapeHtml(name).replace(/'/g, "\\'")}')"><i class="ti ti-${hidden ? 'eye-off' : 'eye'}"></i></button>
    </div>`;
  });
  document.getElementById('thamraJuristSettingsList').innerHTML = html;
  enableJuristDragReorder(document.getElementById('thamraJuristSettingsList'), keys => {
    const st = getThamraJuristSettings(); st.order = keys; saveThamraJuristSettings(st); renderThamraJuristSettingsList();
  });
}

function moveThamraJurist(idx, dir) {
  const names = collectThamraJurists();
  const settings = getThamraJuristSettings();
  const target = idx + dir;
  if (target < 0 || target >= names.length) return;
  settings.order = names.slice();
  const tmp = settings.order[idx];
  settings.order[idx] = settings.order[target];
  settings.order[target] = tmp;
  saveThamraJuristSettings(settings);
  renderThamraJuristSettingsList();
}
function toggleThamraJuristHidden(name) {
  const settings = getThamraJuristSettings();
  if (settings.hidden[name]) delete settings.hidden[name]; else settings.hidden[name] = true;
  saveThamraJuristSettings(settings);
  renderThamraJuristSettingsList();
}
function toggleThamraJuristFavorite(name) {
  const settings = getThamraJuristSettings();
  if (settings.favorite[name]) delete settings.favorite[name]; else settings.favorite[name] = true;
  saveThamraJuristSettings(settings);
  renderThamraJuristSettingsList();
}

function normalizeDigits(s) {
  return String(s).replace(/[\u06F0-\u06F9\u0660-\u0669]/g, d => {
    const code = d.charCodeAt(0);
    if (code >= 0x06F0 && code <= 0x06F9) return String(code - 0x06F0);
    if (code >= 0x0660 && code <= 0x0669) return String(code - 0x0660);
    return d;
  });
}

const FOOTNOTE_SECTION_HEADER_RE = /\n\s*(?:\*\s*\*\s*\*\s*\n+)?\s*(?:ال)?(?:هوامش|هاومش|هوتمش|هوامض)[^\n]*\n\s*(?:[*\-]{5,}\s*\n)?/;
const FOOTNOTE_ITEM_RE = /(?:^|\n)\s*\(?\s*([0-9\u06F0-\u06F9\u0660-\u0669]{1,4})\s*\)?\s*[-.\)]\s*/g;
const INLINE_FN_REF_RE = /\(\s*([0-9\u06F0-\u06F9\u0660-\u0669]{1,4})\s*\)/g;

function extractInlineFootnoteSection(body) {
  if (!body) return { mainText: body, footnoteMap: null };
  const m = FOOTNOTE_SECTION_HEADER_RE.exec(body);
  if (!m) return { mainText: body, footnoteMap: null };
  const mainText = body.slice(0, m.index);
  const fnSectionText = body.slice(m.index + m[0].length);
  const items = [...fnSectionText.matchAll(FOOTNOTE_ITEM_RE)];
  if (!items.length) return { mainText: body, footnoteMap: null };
  const footnoteMap = new Map();
  for (let i = 0; i < items.length; i++) {
    const num = parseInt(normalizeDigits(items[i][1]), 10);
    const start = items[i].index + items[i][0].length;
    const end = i + 1 < items.length ? items[i + 1].index : fnSectionText.length;
    const content = fnSectionText.slice(start, end).trim();
    if (content) footnoteMap.set(num, footnoteMap.has(num) ? footnoteMap.get(num) + '\n' + content : content);
  }
  return { mainText, footnoteMap };
}

const FN_LINE_START_PARA_RE = /^[ \t]*\(\s*[0-9\u06F0-\u06F9\u0660-\u0669]{1,4}\s*\)(?=[ \t]*\S)/;
function convertInlineRefsToBrackets(mainText, footnoteMap, bookId) {
  const conv = (whole, numStr) => {
    const num = parseInt(normalizeDigits(numStr), 10);
    return footnoteMap.has(num) ? `[${num}]` : whole;
  };
  if (bookId !== 84) return mainText.replace(INLINE_FN_REF_RE, conv);
  return mainText.split('\n').map(line => {
    const m = FN_LINE_START_PARA_RE.exec(line);
    if (!m) return line.replace(INLINE_FN_REF_RE, conv);
    return m[0] + line.slice(m[0].length).replace(INLINE_FN_REF_RE, conv);
  }).join('\n');
}

const FN_ANY_HEADER_SRC = '\\n[ \\t]*(?:\\*\\s*\\*\\s*\\*[ \\t]*\\n+)?[ \\t]*(?:(?:ال)?(?:هوامش|هاومش|هوتمش|هوامض)|هامش\\s+(?:في|غي)\\s+(?:ال)?هوامش)[^\\n]*\\n[ \\t]*(?:[*\\-]{5,}[ \\t]*\\n)?';
const FN_REF_SRC = '\\(\\s*([0-9\\u06F0-\\u06F9\\u0660-\\u0669]{1,4})\\s*\\)';
function parseFootnoteBlockItems(text) {
  const items = [...text.matchAll(new RegExp(FOOTNOTE_ITEM_RE.source, 'g'))];
  const map = new Map();
  for (let i = 0; i < items.length; i++) {
    const num = parseInt(normalizeDigits(items[i][1]), 10);
    const start = items[i].index + items[i][0].length;
    const end = i + 1 < items.length ? items[i + 1].index : text.length;
    const content = text.slice(start, end).trim();
    if (content) map.set(num, map.has(num) ? map.get(num) + '\n' + content : content);
  }
  return map;
}
function extractMultiBlockFootnotes(body) {
  if (!body) return null;
  const heads = [...body.matchAll(new RegExp(FN_ANY_HEADER_SRC, 'g'))];
  if (heads.length < 2) return null;
  const mains = [], blocks = [];
  let cursor = 0;
  heads.forEach((h, i) => {
    mains.push(body.slice(cursor, h.index));
    const start = h.index + h[0].length;
    const limit = i + 1 < heads.length ? heads[i + 1].index : body.length;
    const rest = body.slice(start, limit);
    const lead = rest.length - rest.replace(/^\s+/, '').length;
    const gap = /\n[ \t]+\n|\n[ \t]*\n[ \t]*\n/.exec(rest.slice(lead));
    const blockText = gap ? rest.slice(0, lead + gap.index) : rest;
    blocks.push({ text: blockText, nestedHeader: /هامش\s+(?:في|غي)/.test(h[0]) });
    cursor = start + blockText.length;
  });
  mains.push(body.slice(cursor));
  const arr = [], pieces = [];
  let prevRange = null;
  for (let i = 0; i < mains.length; i++) {
    let seg = mains[i];
    if (i < blocks.length) {
      const items = parseFootnoteBlockItems(blocks[i].text);
      let handledAsNested = false;
      if (blocks[i].nestedHeader && prevRange && items.size) {
        const segNums = new Set([...seg.matchAll(new RegExp(FN_REF_SRC, 'g'))].map(m => parseInt(normalizeDigits(m[1]), 10)));
        const refersToSeg = [...items.keys()].some(n => segNums.has(n));
        if (!refersToSeg) {
          handledAsNested = true;
          for (const [n, t] of items) {
            let hit = -1;
            for (let k = prevRange[0]; k < prevRange[1]; k++) {
              if (new RegExp('\\(\\s*' + n + '\\s*\\)').test(normalizeDigits(arr[k]))) { hit = k; break; }
            }
            if (hit >= 0) arr[hit] = arr[hit] + '\n— هامش: ' + t; else arr.push(t);
          }
        }
      }
      if (!handledAsNested) {
        const startIdx = arr.length;
        const used = new Set();
        seg = seg.replace(new RegExp(FN_REF_SRC, 'g'), (whole, ns) => {
          const n = parseInt(normalizeDigits(ns), 10);
          if (!items.has(n)) return whole;
          arr.push(items.get(n)); used.add(n);
          return `[${arr.length}]`;
        });
        for (const [n, t] of items) if (!used.has(n)) arr.push(t);
        prevRange = [startIdx, arr.length];
      }
    }
    pieces.push(seg);
  }
  let out = pieces[0];
  for (let i = 1; i < pieces.length; i++) {
    const prev = out.replace(/\s+$/, ''), nxt = pieces[i].replace(/^\s+/, '');
    if (!nxt) { out = prev; continue; }
    out = prev + (/[.؟!:»]$/.test(prev) ? '\n' : ' ') + nxt;
  }
  if (!arr.length) return null;
  return { body: out, arr };
}

function extractBodyFootnotesIfNeeded(body, rawFootnotesCol, bookId) {
  if (rawFootnotesCol) return { body, footnotesJson: null };
  const multi = extractMultiBlockFootnotes(body);
  if (multi) return { body: multi.body, footnotesJson: multi.arr };
  const { mainText, footnoteMap } = extractInlineFootnoteSection(body);
  if (!footnoteMap) return { body, footnotesJson: null };
  const convertedBody = convertInlineRefsToBrackets(mainText, footnoteMap, bookId);
  const maxNum = Math.max(...footnoteMap.keys());
  const arr = new Array(maxNum).fill('');
  for (const [num, text] of footnoteMap) arr[num - 1] = text;
  return { body: convertedBody, footnotesJson: arr };
}

function parseFootnotes(raw, isUrwa) {
  if (!raw) return [];
  let arr;
  try {
    arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
  } catch (e) { return []; }
  if (!isUrwa) return arr;
  return arr.map(fn => isArrayFootnoteGroup(fn) ? expandUrwaFootnoteGroup(fn) : fn);
}

function isArrayFootnoteGroup(fn) {
  return Array.isArray(fn);
}

const URWA_PAREN_NAMES_RE = /\(([^)]{5,200})\)\s*\.?\s*$/;
function expandUrwaFootnoteGroup(entries) {
  const result = [];
  for (const r of entries) {
    if (!r || typeof r !== 'object') { result.push(r); continue; }
    if (r.jurist) {
      const canon = canonicalJurist(r.jurist);
      result.push(canon ? { ...r, jurist: canon } : { ...r, jurist: null });
      continue;
    }
    const text = (r.text || '').trim();
    const m = URWA_PAREN_NAMES_RE.exec(text);
    let expanded = false;
    if (m) {
      const content = m[1];
      if (content.includes('،') || content.includes(',')) {
        const parts = content.split(/[،,]/).map(p => p.trim()).filter(Boolean);
        const canonNames = [];
        let allResolved = parts.length >= 2;
        for (const p of parts) {
          const canon = canonicalJurist(p);
          if (canon) canonNames.push(canon); else { allResolved = false; break; }
        }
        if (allResolved) {
          for (const name of canonNames) result.push({ ...r, jurist: name });
          expanded = true;
        }
      }
    }
    if (!expanded) result.push(r);
  }
  return result;
}


let pendingSearchTerm = null;
let pendingFootnoteNum = null;

const masalaComparisons = [
];

let comparisonIndex = new Map();

function buildComparisonIndex() {
  comparisonIndex = new Map();
  for (const group of masalaComparisons) {
    for (const entry of group.entries) {
      comparisonIndex.set(`${entry.bookId}::${entry.masalaNum}`, group);
    }
  }
}

const SHARH_AWDAH_BOOK_ID = 13;
let sharhAwdahIndex = new Map();
let sharhAwdahIntro = null;
let sharhAwdahLoaded = false;

function loadSharhAwdahIndex() {
  if (sharhAwdahLoaded) return;
  sharhAwdahLoaded = true;
  try {
    const res = db.exec('SELECT masala_num, body FROM sharh_awdah');
    if (!res.length) return;
    for (const row of res[0].values) {
      const num = String(row[0]);
      const body = row[1] || '';
      if (num === '0') sharhAwdahIntro = body;
      else sharhAwdahIndex.set(num, body);
    }
  } catch (e) {
    sharhAwdahIndex = new Map();
  }
}

function toggleSharhAccordion(evt, sectionIdx, num) { toggleSharhChooser(evt, sectionIdx, num); }
function toggleSharhManhajAccordion(evt, sectionIdx, num) { toggleSharhChooser(evt, sectionIdx, num); }

let sharhVideoIndex = new Map();
let sharhVideoLoaded = false;

function loadSharhVideoIndex() {
  if (sharhVideoLoaded) return;
  sharhVideoLoaded = true;
  try {
    const res = db.exec('SELECT book_id, masala_start, masala_end, video_id, title, channel, channel_url FROM sharh_video');
    if (!res.length) return;
    for (const row of res[0].values) {
      const [bookId, start, end, videoId, title, channel, channelUrl] = row;
      const entry = { videoId, title, channel, channelUrl, rangeStart: start, rangeEnd: end };
      for (let n = start; n <= end; n++) {
        const key = `${bookId}::${n}`;
        if (!sharhVideoIndex.has(key)) sharhVideoIndex.set(key, []);
        sharhVideoIndex.get(key).push(entry);
      }
    }
  } catch (e) {
    sharhVideoIndex = new Map();
  }
}

function getSharhSourcesFor(bookId, num) {
  const sources = [];
  if (bookId === SHARH_AWDAH_BOOK_ID && sharhAwdahIndex.has(num)) {
    sources.push({ type: 'text-awdah', label: 'شرح أوضح الوسائل' });
  }
  if (bookId === SHARH_MANHAJ_BOOK_ID && sharhManhajIndex.has(num)) {
    sources.push({ type: 'text-manhaj', label: 'شرح السراج في شرح المنهاج' });
  }
  const videos = sharhVideoIndex.get(`${bookId}::${num}`) || [];
  const seenVideoIds = new Set();
  for (const v of videos) {
    if (seenVideoIds.has(v.videoId)) continue;
    seenVideoIds.add(v.videoId);
    const isTatimma = /تتمة/.test(v.title);
    const rangeLabel = v.rangeStart === v.rangeEnd ? '' : ` (مسألة ${v.rangeStart}-${v.rangeEnd})`;
    const tatimmaLabel = isTatimma ? ' — تتمة' : '';
    sources.push({
      type: 'video',
      label: `فيديو — ${v.channel}${tatimmaLabel}${rangeLabel}`,
      videoId: v.videoId, title: v.title, channel: v.channel,
    });
  }
  return sources;
}

function toggleSharhChooser(evt, sectionIdx, num) {
  evt.stopPropagation();
  const acc = document.getElementById(`sharh-chooser-${sectionIdx}-${num}`);
  if (!acc) return;
  if (acc.classList.contains('open')) { acc.classList.remove('open'); return; }
  if (!acc.dataset.built) {
    const sources = getSharhSourcesFor(currentBookId, num);
    acc.innerHTML = renderSharhChooserHtml(sources, currentBookId, sectionIdx, num);
    acc.dataset.built = '1';
  }
  acc.classList.add('open');
  scrollToSharhEl(acc);
}

function scrollToSharhEl(el) {
  if (!el) return;
  el.style.scrollMarginTop = '84px';
  requestAnimationFrame(() => requestAnimationFrame(() => {
    try { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    catch (e) { try { el.scrollIntoView(true); } catch (e2) {} }
  }));
}

function renderSharhChooserHtml(sources, bookId, sectionIdx, num) {
  if (!sources.length) return '';
  let html = `<div class="sharh-acc-title"><i class="ti ti-notebook"></i> شروحات هذه المسألة</div>
    <div class="sharh-choice-list">`;
  sources.forEach((s, idx) => {
    html += `<div class="sharh-choice-item">
      <button class="sharh-choice-btn" onclick="selectSharhSource(event, ${bookId}, ${sectionIdx}, '${num}', ${idx})">
        <i class="ti ${s.type === 'video' ? 'ti-player-play' : 'ti-file-text'}"></i>
        <span>${escapeHtml(s.label)}</span>
      </button>
      <div class="sharh-choice-detail" id="sharh-choice-detail-${sectionIdx}-${num}-${idx}"></div>
    </div>`;
  });
  html += `</div>`;
  sharhChooserSourcesCache.set(`${bookId}::${num}`, sources);
  return html;
}

const sharhChooserSourcesCache = new Map();

function selectSharhSource(evt, bookId, sectionIdx, num, idx) {
  evt.stopPropagation();
  const sources = sharhChooserSourcesCache.get(`${bookId}::${num}`);
  if (!sources || !sources[idx]) return;
  const source = sources[idx];
  const detail = document.getElementById(`sharh-choice-detail-${sectionIdx}-${num}-${idx}`);
  if (!detail) return;
  if (detail.classList.contains('open')) {
    detail.classList.remove('open');
    return;
  }
  if (!detail.dataset.built) {
    if (source.type === 'text-awdah') {
      const body = sharhAwdahIndex.get(num) || '';
      detail.innerHTML = `<div class="sharh-acc-body">${escapeHtml(body).replace(/\n/g, '<br>')}</div>`;
    } else if (source.type === 'text-manhaj') {
      const entry = sharhManhajIndex.get(num) || { body: '', diagram: null };
      const diagramHtml = entry.diagram
        ? `<div class="sharh-diagram-wrap"><img src="icons/sharh_diagrams/${entry.diagram}.png" alt="مخطط توضيحي" loading="lazy"></div>`
        : '';
      const bodyHtml = entry.body
        ? `<div class="sharh-acc-body">${escapeHtml(entry.body).replace(/\n/g, '<br>')}</div>`
        : '';
      detail.innerHTML = `${bodyHtml}${diagramHtml}`;
    } else if (source.type === 'video') {
      detail.innerHTML = `<div class="sharh-video-wrap">
          <div class="sharh-video-title">${escapeHtml(source.title)}</div>
          <div class="sharh-video-frame">
            <iframe src="https://www.youtube-nocookie.com/embed/${source.videoId}"
              title="${escapeHtml(source.title)}"
              frameborder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowfullscreen loading="lazy"></iframe>
          </div>
        </div>`;
    }
    detail.dataset.built = '1';
  }
  detail.classList.add('open');
  scrollToSharhEl(detail.previousElementSibling || detail);
}


const SHARH_MANHAJ_BOOK_ID = 14;
let sharhManhajIndex = new Map();
let sharhManhajLoaded = false;

function loadSharhManhajIndex() {
  if (sharhManhajLoaded) return;
  sharhManhajLoaded = true;
  try {
    const res = db.exec('SELECT masala_num, body, diagram_image FROM sharh_manhaj');
    if (!res.length) return;
    for (const row of res[0].values) {
      const num = String(row[0]);
      sharhManhajIndex.set(num, { body: row[1] || '', diagram: row[2] || null });
    }
  } catch (e) {
    sharhManhajIndex = new Map();
  }
}

async function resetCachedFiles(reload) {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
    if (window.caches) {
      const names = await caches.keys();
      await Promise.all(names.map(n => caches.delete(n)));
    }
  } catch (e) { console.error('resetCachedFiles', e); }
  if (reload) location.reload();
}


function migrateUrwaSavedData() {
  try {
    if (localStorage.getItem('rs_urwa_remap') === 'v24') return;
    const idRes = db.exec("SELECT book_id, bk_table FROM book_menu");
    const mapRes = db.exec("SELECT bk_table, old_idx, new_idx FROM urwa_rowmap");
    if (!idRes.length || !mapRes.length) return;
    const tableOf = {}; idRes[0].values.forEach(([id, t]) => { tableOf[id] = t; });
    const rm = {}; mapRes[0].values.forEach(([t, o, n]) => { (rm[t] = rm[t] || {})[o] = n; });
    const titleCache = {};
    const titleAt = (t, idx) => {
      if (!titleCache[t]) { const r = db.exec('SELECT title FROM "' + t + '" ORDER BY rowid'); titleCache[t] = r.length ? r[0].values.map(v => v[0]) : []; }
      return titleCache[t][idx];
    };
    let moved = 0, stale = 0;
    const fixItem = (it) => {
      if (!it || it.bookId == null || !rm[tableOf[it.bookId]] || typeof it.sectionIdx !== 'number') return;
      const t = tableOf[it.bookId];
      const mapped = rm[t][it.sectionIdx];
      if (it.title && mapped !== undefined && titleAt(t, mapped) === it.title) {
        if (mapped !== it.sectionIdx) { it.sectionIdx = mapped; moved++; }
        delete it.urwaStale;
      } else if (it.title && titleAt(t, it.sectionIdx) === it.title && (mapped === undefined || mapped === it.sectionIdx)) {
        delete it.urwaStale;
      } else { it.urwaStale = true; stale++; }
    };
    const fixList = (key) => {
      const arr = JSON.parse(localStorage.getItem(key) || '[]');
      arr.forEach(fixItem);
      localStorage.setItem(key, JSON.stringify(arr)); return arr;
    };
    const f = fixList('rs_favorites'); if (typeof favorites !== 'undefined') { favorites.length = 0; f.forEach(x => favorites.push(x)); }
    const n = fixList('rs_notes'); if (typeof notes !== 'undefined') { notes.length = 0; n.forEach(x => notes.push(x)); }
    try {
      const cbs = JSON.parse(localStorage.getItem('rs_custom_books') || '[]');
      cbs.forEach(cb => (cb.items || []).forEach(fixItem));
      localStorage.setItem('rs_custom_books', JSON.stringify(cbs));
      if (typeof customBooks !== 'undefined') { customBooks.length = 0; cbs.forEach(x => customBooks.push(x)); }
    } catch (e) { console.warn('تعذّرت هجرة كتبي الخاصة:', e); }
    const lp = JSON.parse(localStorage.getItem('rs_lastPosition') || 'null');
    if (lp && rm[tableOf[lp.bookId]]) { lp.sectionIdx = 0; lp.scrollTop = 0; localStorage.setItem('rs_lastPosition', JSON.stringify(lp)); }
    const bp = JSON.parse(localStorage.getItem('rs_bookPositions') || '{}');
    Object.keys(bp).forEach(k => { const v = bp[k]; if (v && rm[tableOf[k]]) { v.sectionIdx = 0; v.scrollTop = 0; } });
    localStorage.setItem('rs_bookPositions', JSON.stringify(bp));
    localStorage.removeItem('rs_daily_masala');
    localStorage.setItem('rs_urwa_remap', 'v24');
    if (moved || stale) console.log('هجرة العروة: نُقل ' + moved + ' عنصراً بعد التحقق من العنوان، ووُسم ' + stale + ' كغير مؤكَّد الموضع');
  } catch (e) { console.warn('تعذّرت هجرة بيانات العروة المحفوظة:', e); }
}


const DB_CACHE_NAME = 'rasael-db-' + EXPECTED_DB_VERSION;
const DB_MIN_BYTES = 5 * 1048576;
const DB_PARTS = ['books_part1.bin', 'books_part2.bin'];
async function loadDbBytes(_say) {
  const partUrls = DB_PARTS.map(p => new URL(p, location.href).href);
  const legacyUrl = new URL('books.db', location.href).href;
  let cache = null;
  try { if (window.caches) cache = await caches.open(DB_CACHE_NAME); } catch (e) { cache = null; }
  const PART_MIN = 1048576;
  if (cache) {
    try {
      // 1) نسخة مخزّنة من الجزأين
      const hits = await Promise.all(partUrls.map(u => cache.match(u)));
      if (hits.every(Boolean)) {
        _say('فتح مكتبة الكتب…');
        const abs = [];
        for (const h of hits) abs.push(await h.arrayBuffer());
        if (abs.every(a => a.byteLength > PART_MIN)) {
          const out = new Uint8Array(abs[0].byteLength + abs[1].byteLength);
          out.set(new Uint8Array(abs[0]), 0);
          out.set(new Uint8Array(abs[1]), abs[0].byteLength);
          return out;
        }
        await Promise.all(partUrls.map(u => cache.delete(u)));
      }
      // 2) نسخة قديمة كاملة (books.db) من إصدار سابق
      const hit = await cache.match(legacyUrl);
      if (hit) {
        const len = +hit.headers.get('Content-Length') || 0;
        if (len === 0 || len > DB_MIN_BYTES) {
          _say('فتح مكتبة الكتب…');
          const ab = await hit.arrayBuffer();
          if (ab.byteLength > DB_MIN_BYTES) return new Uint8Array(ab);
        }
        await cache.delete(legacyUrl);
      }
    } catch (e) { console.warn('تعذّرت القراءة من الكاش، سيُنزَّل من الشبكة:', e); }
  }
  _say('تنزيل الكتب لأول مرة (حجمها نحو 140 ميغابايت على جزأين) — بعدها تعمل بلا إنترنت وبسرعة…');
  let buf = null;
  let received = 0;
  const lp = document.getElementById('loadProgress');
  async function pullInto(resp, label, cacheKey) {
    const total = +resp.headers.get('Content-Length') || 0;
    let body = resp.body;
    if (cache && total > PART_MIN && resp.status === 200) {
      try {
        const [forCache, forRead] = body.tee();
        body = forRead;
        cache.put(cacheKey, new Response(forCache, { status: 200, headers: { 'Content-Length': String(total), 'Content-Type': 'application/octet-stream' } })).catch(() => {});
      } catch (e) { body = resp.body; }
    }
    if (!buf) buf = new Uint8Array(total > 0 ? Math.ceil(total * 2.05) : 150 * 1048576);
    const reader = body.getReader();
    while (true) {
      let _t;
      const { done, value } = await Promise.race([
        reader.read(),
        new Promise((_, rej) => { _t = setTimeout(() => rej(new Error('توقّف تنزيل قاعدة البيانات (' + label + ') عند ' + (received / 1048576).toFixed(1) + ' ميغابايت (ركود 30 ثانية).')), 30000); })
      ]);
      clearTimeout(_t);
      if (done) break;
      if (received + value.length > buf.length) {
        const bigger = new Uint8Array(Math.max(buf.length * 2, received + value.length));
        bigger.set(buf.subarray(0, received), 0);
        buf = bigger;
      }
      buf.set(value, received);
      received += value.length;
      if (lp) lp.textContent = `${label}: ${(received / 1048576).toFixed(1)} MB`;
    }
  }
  const r1 = await fetch(partUrls[0]);
  if (r1.ok) {
    await pullInto(r1, 'الجزء 1 من 2', partUrls[0]);
    const r2 = await fetch(partUrls[1]);
    if (!r2.ok) throw new Error('تعذّر تنزيل ' + DB_PARTS[1] + ' (رمز ' + r2.status + ') — تأكّد أنه مرفوع بجانب index.html');
    await pullInto(r2, 'الجزء 2 من 2', partUrls[1]);
  } else {
    // احتياط: ملف books.db واحد إن وُجد
    const r = await fetch(legacyUrl);
    if (!r.ok) throw new Error('تعذّر تنزيل ' + DB_PARTS[0] + ' (رمز ' + r1.status + ') ولا books.db (رمز ' + r.status + ')');
    await pullInto(r, 'قاعدة البيانات', legacyUrl);
  }
  return buf.length !== received ? buf.subarray(0, received) : buf;
}

async function init() {
  const _bvt = document.getElementById('buildVersionTag');
  if (_bvt) _bvt.textContent = BUILD_VERSION;
  applyTheme();
  try {
    const _lp = document.getElementById('loadProgress');
    const _say = (t) => { if (_lp) _lp.textContent = t; };
    if (typeof initSqlJs === 'undefined') throw new Error('تعذّر تحميل مكتبة sql.js (vendor/sql-wasm.js). تأكّد أن مجلد vendor مرفوع كاملاً بجانب index.html.');
    _say('تحميل محرك قاعدة البيانات والكتب…');
    let _sharedDb = null;
    try { if (isEmbeddedMode && window.parent && window.parent !== window && window.parent.__rsDb && typeof window.parent.__rsDb.exec === 'function') _sharedDb = window.parent.__rsDb; } catch (e) { _sharedDb = null; }
    if (_sharedDb) {
      db = _sharedDb;
      window.__rsDb = db;
    } else {
      const sqlPromise = Promise.race([
        initSqlJs({ locateFile: f => `vendor/${f}` }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('انتهت مهلة تحميل محرك قاعدة البيانات (45 ثانية) — تأكّد أن vendor/sql-wasm.wasm مرفوع.')), 45000))
      ]);
      const bytesPromise = loadDbBytes(_say);
      sqlPromise.catch(() => {}); bytesPromise.catch(() => {});
      const SQL = await sqlPromise;
      let buf = await bytesPromise;
      {
      {
        const head = new TextDecoder('latin1').decode(buf.subarray(0, 15));
        if (buf.length < 5 * 1048576 || head !== 'SQLite format 3') {
          let peek = '';
          try { peek = new TextDecoder().decode(buf.subarray(0, 80)).replace(/\s+/g, ' '); } catch (e) {}
          throw new Error(`الملف الذي وصل ليس قاعدة بيانات صالحة (حجمه ${(buf.length / 1048576).toFixed(2)} ميغابايت${peek ? '، يبدأ بـ: ' + peek : ''}). على الأرجح لم يُرفع books.db كاملاً على الاستضافة أو انقطع الاتصال. القاعدة الصحيحة نحو 100 ميغابايت.`);
        }
      }
      db = new SQL.Database(buf);
      window.__rsDb = db;
      buf = null;
      }
    }

    try {
      const uvRes = db.exec('PRAGMA user_version');
      const dbVersion = uvRes && uvRes[0] ? uvRes[0].values[0][0] : null;
      _dbVersionVerified = dbVersion;
      const mismatchTag = document.getElementById('buildVersionTag');
      if (dbVersion !== null && dbVersion !== EXPECTED_DB_VERSION && !sessionStorage.getItem('rs_autoheal')) {
        sessionStorage.setItem('rs_autoheal', '1');
        resetCachedFiles(true);
        return;
      }
      if (dbVersion !== null && dbVersion !== EXPECTED_DB_VERSION) {
        const warnMsg = `⚠️ تعارض نسخ: الكود يتوقّع بيانات v${EXPECTED_DB_VERSION} لكن الموجود v${dbVersion} — على الأغلب اختلطت ملفات من تنزيلات مختلفة، احذف كل الملفات القديمة وأعد التنزيل من جديد`;
        if (mismatchTag) { mismatchTag.textContent = warnMsg; mismatchTag.style.color = '#ff5555'; mismatchTag.style.fontWeight = 'bold'; }
        console.error(warnMsg);
      } else if (mismatchTag) {
        mismatchTag.textContent = BUILD_VERSION + ` (تحقّق: بيانات v${dbVersion} ✓ متطابقة)`;
      }
    } catch (e) { console.warn('تعذر التحقق من نسخة قاعدة البيانات:', e); }

    migrateUrwaSavedData();
    loadBooksAndAuthors();
    ensureLibraryOrder();

    setupSwipeNavigation();
    if (!isEmbeddedMode) setupHardwareBack();
    document.getElementById('loadingScreen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    if (isEmbeddedMode) {
      document.body.classList.add('embedded-mode');
      setupSplitPaneMessaging();
    } else {
      setupSplitViewLongPress();
    }
    positionReaderFab();
    try { setupCompactView(); } catch (e) { console.warn('الوضع المضغوط:', e); }

    try { buildComparisonIndex(); } catch (e) { console.warn('تعذر بناء فهرس المقارنة:', e); }
    try { loadSharhAwdahIndex(); } catch (e) { console.warn('تعذر تحميل شرح أوضح الوسائل:', e); }
    try { loadSharhManhajIndex(); } catch (e) { console.warn('تعذر تحميل شرح السراج في شرح المنهاج:', e); }
    try { loadSharhVideoIndex(); } catch (e) { console.warn('تعذر تحميل فهرس شروحات الفيديو:', e); }

    if (!isEmbeddedMode && !resumeLastPosition()) renderReferencesPage();
    const _idle = (fn) => { if (window.requestIdleCallback) requestIdleCallback(fn, { timeout: 1500 }); else setTimeout(fn, 200); };
    _idle(() => ensureGlossaryBuilt());
    _idle(() => loadSearchIndex());
    _idle(() => { try { notifInit(); } catch (e) { console.warn('notif', e); } });
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (e) {}
  } catch (err) {
    document.getElementById('loadProgress').innerHTML =
      'حدث خطأ أثناء التحميل: ' + escapeHtml(String(err.message || err)) +
      '<br><button onclick="resetCachedFiles(true)" style="margin-top:10px;padding:8px 18px;border-radius:8px;border:1px solid #666;background:#333;color:#fff;font-size:13px;">مسح كاش الملفات وإعادة المحاولة</button>';
    console.error(err);
  }
}

function loadBooksAndAuthors() {
  const authRes = db.exec("SELECT auther_id, auher_name FROM authers ORDER BY auther_id");
  if (authRes.length) {
    for (const row of authRes[0].values) {
      allAuthors[row[0]] = (row[1] || '').trim().replace(/^المرجع\s+/, '');
      authorOrder.push(row[0]);
    }
  }
  const bookRes = db.exec("SELECT book_id, book_name, auther_id, bk_table FROM book_menu ORDER BY book_id");
  if (bookRes.length) {
    for (const row of bookRes[0].values) {
      allBooks.push({
        id: row[0],
        name: row[1],
        author_id: row[2],
        bk_table: row[3],
        author: allAuthors[row[2]] || ''
      });
    }
  }
  const hasOrphanBooks = allBooks.some(b => !allAuthors[b.author_id]);
  if (hasOrphanBooks) authorOrder.push(GLOSSARY_AUTHOR_ID);
  allAuthors[GLOSSARY_AUTHOR_ID] = 'القواعد والمصطلحات';
  applyCustomAuthorOrder();
}

const DEFAULT_AUTHOR_ORDER = [25, 1, 11, 4, 3, 7, 13, 12, 8, 15, 16, 17, 20, 23, 26, 27, 24, 19];
function applyCustomAuthorOrder() {
  let saved = [];
  try { saved = JSON.parse(localStorage.getItem('rs_authorOrder') || '[]'); } catch (e) { saved = []; }
  if (!saved.length) {
    const have = new Set(authorOrder);
    const first = DEFAULT_AUTHOR_ORDER.filter(id => have.has(id));
    const fs = new Set(first);
    authorOrder = first.concat(authorOrder.filter(id => !fs.has(id)));
    return;
  }
  const savedSet = new Set(saved);
  const known = saved.filter(id => authorOrder.includes(id) || authorOrder.includes(parseInt(id, 10)));
  const remaining = authorOrder.filter(id => !savedSet.has(id) && !savedSet.has(String(id)));
  authorOrder = known.map(id => authorOrder.includes(id) ? id : parseInt(id, 10)).concat(remaining);
}

function saveCustomAuthorOrder() {
  localStorage.setItem('rs_authorOrder', JSON.stringify(authorOrder));
}

let _glossaryBuilding = false;
function ensureGlossaryBuilt() {
  if (glossaryRegex || _glossaryBuilding || !db) return glossaryRegex;
  _glossaryBuilding = true;
  try { buildGlossary(); } catch (e) { console.warn('تعذر بناء قائمة المصطلحات:', e); }
  _glossaryBuilding = false;
  return glossaryRegex;
}

const _ENUM_ORD_CORE = new Set(['اول','اولي','ثاني','ثانيه','ثالث','ثالثه','رابع','رابعه','خامس','خامسه','سادس','سادسه','سابع','سابعه','ثامن','ثامنه','تاسع','تاسعه','عاشر','عاشره','حادي','حاديه','اولا','ثانيا','ثالثا','رابعا','خامسا','سادسا','سابعا','ثامنا','تاسعا','عاشرا','عشرون','عشرين','ثلاثون','ثلاثين','اربعون','اربعين','خمسون','خمسين','ستون','ستين','سبعون','سبعين','ثمانون','ثمانين','تسعون','تسعين','مائه','ماءه']);
const _ENUM_FILLER = new Set(['عشر','عشره','و']);
const _ENUM_DIGITS_RE = /^[\d\u0660-\u0669\u06F0-\u06F9\s.\-\u2013\u2014\u0640()\[\]{}\u060C,:;\u061B\/\\*#]+$/;
function isEnumerationTerm(term) {
  if (!term) return false;
  let t = String(term).replace(/[\u064B-\u065F\u0670\u0640\u200c\u200d\u200f\u200e]/g, '');
  if (_ENUM_DIGITS_RE.test(t)) return true;
  t = t.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[ی]/g, 'ي')
       .replace(/[()\[\]{}«»"'\u060C,:;\u061B.\-\u2013\u2014*#]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t) return true;
  const toks = t.split(' ');
  let core = 0;
  for (let tok of toks) {
    if (/^[\d\u0660-\u0669\u06F0-\u06F9]+$/.test(tok)) { core++; continue; }
    let k = tok;
    if (k.length > 3 && k.startsWith('وال')) k = k.slice(1);
    if (k.startsWith('ال') && k.length > 3) k = k.slice(2);
    if (_ENUM_ORD_CORE.has(k)) { core++; continue; }
    if (_ENUM_FILLER.has(k) || _ENUM_FILLER.has(tok)) continue;
    if (tok.startsWith('و') && _ENUM_ORD_CORE.has(tok.slice(1).replace(/^ال/, ''))) { core++; continue; }
    return false;
  }
  return core > 0;
}

function getGlossaryBooksAll() {
  return allBooks.filter(b =>
    (!allAuthors[b.author_id] || b.author_id === 0) &&
    (b.name.includes('مصطلح') || b.name.includes('اصطلاح'))
  );
}
function getGlossaryOffSet() {
  try { const a = JSON.parse(localStorage.getItem('rs_gloss_off') || '[]'); return new Set(Array.isArray(a) ? a.map(Number) : []); } catch (e) { return new Set(); }
}
function setGlossaryOffSet(set) {
  try { localStorage.setItem('rs_gloss_off', JSON.stringify(Array.from(set))); } catch (e) {}
}
function rebuildGlossary() {
  glossaryMap = new Map(); glossaryTermsSet = new Set(); glossaryRegex = null; _glossaryBuilding = false;
  ensureGlossaryBuilt();
  try {
    const rp = document.getElementById('readerPage');
    if (rp && rp.classList.contains('active') && typeof currentBookId !== 'undefined' && !isThamraBook(currentBookId) && typeof refreshAllRenderedSections === 'function') refreshAllRenderedSections();
  } catch (e) { console.warn('glossary refresh', e); }
}
function buildGlossary() {
  const _glossOff = getGlossaryOffSet();
  const glossaryBooks = getGlossaryBooksAll().filter(b => !_glossOff.has(b.id));
  for (const book of glossaryBooks) {
    let rows;
    try {
      const res = db.exec(`SELECT title, body, footnotes, rowid FROM "${book.bk_table}" ORDER BY rowid`);
      rows = res.length ? res[0].values : [];
    } catch (e) { continue; }
    for (const [title, body, fnCol, rowid] of rows) {
      if (!body) continue;
      if (/^\s*[\[(]?\s*(?:مقدمة|إهداء)/.test(title || '')) continue;
      const dashAt = (title || '').indexOf(' — ');
      const part = dashAt > 0 ? title.slice(0, dashAt).trim() : '';
      const srcLabel = part ? `${book.name} — ${part}` : book.name;
      const isGrammar = /النحو|البلاغة|الصرف/.test(part);
      for (const entry of parseGlossaryBody(body)) {
        let def = fnCol ? entry.def.replace(/\s*\[\d+\]/g, '') : entry.def;
        def = def.replace(/^\]\s*/, '');
        if (!glossaryMap.has(entry.term)) glossaryMap.set(entry.term, []);
        glossaryMap.get(entry.term).push({ def, source: srcLabel, bid: book.id, rid: rowid, bi: entry.bi, gram: isGrammar });
      }
    }
  }

  {
    const TASHKEEL_RE = /[\u064B-\u065F\u0670\u0640]/g;
    const aliasPairs = [];
    glossaryMap.forEach((defs, term) => {
      const variants = new Set();
      const bare = term.replace(TASHKEEL_RE, '').replace(/\s+/g, ' ').trim();
      if (bare && bare !== term) variants.add(bare);
      let core = bare.replace(/^\[\s*/, '').replace(/\s*\]$/, '').trim();
      core = core.replace(/^\(\s*[^)]{1,14}\)\s*/, '').trim();
      core = core.replace(/\s*\([^)]*\)\s*$/, '').trim();
      if (core && core !== bare) variants.add(core);
      if (core.includes(' - ')) {
        core.split(' - ').forEach(p => {
          p = p.trim();
          if (p.length >= 3 && !/^في\s/.test(p)) variants.add(p);
        });
      }
      variants.forEach(v => { if (v && v !== term) aliasPairs.push([v, defs]); });
    });
    aliasPairs.forEach(([v, defs]) => {
      const ex = glossaryMap.get(v);
      if (!ex) { glossaryMap.set(v, defs.slice()); return; }
      defs.forEach(d => { if (!ex.includes(d)) ex.push(d); });
    });
  }

  const rajeaOnly = /^راجع\s*(?:كلمة\s*)?["«»]?\s*([^"«»\n]{3,40}?)\s*["«»]?\s*$/;
  const _normHamza = (t) => t.replace(/[إأآا]/g, 'ا');
  const rajeaIndex = new Map();
  glossaryMap.forEach((tdefs, tterm) => {
    const k = _normHamza(tterm);
    if (!rajeaIndex.has(k)) rajeaIndex.set(k, tdefs);
  });
  glossaryMap.forEach((defs, term) => {
    defs.forEach(d => {
      const m = d.def.match(rajeaOnly);
      if (!m) return;
      const target = m[1].replace(/^:\s*/, '').trim();
      const resolvedDefs = rajeaIndex.get(_normHamza(target)) || null;
      if (resolvedDefs) {
        d.def = resolvedDefs.map(rd => rd.def).join(' | ');
      }
    });
  });

  const hamzaChars = ['ا', 'أ', 'إ', 'آ'];
  const HAMZA_RE = /[اأإآ]/g;
  const extraEntries = [];
  glossaryMap.forEach((defs, term) => {
    if (!HAMZA_RE.test(term)) return;
    HAMZA_RE.lastIndex = 0;
    const firstHamzaIdx = term.search(HAMZA_RE);
    if (firstHamzaIdx === -1) return;
    hamzaChars.forEach(h => {
      const variant = term.slice(0, firstHamzaIdx) + h + term.slice(firstHamzaIdx + 1);
      if (variant !== term && !glossaryMap.has(variant)) {
        extraEntries.push([variant, defs]);
      }
    });
  });
  extraEntries.forEach(([v, defs]) => glossaryMap.set(v, defs));

  Array.from(glossaryMap.keys()).forEach(k => { if (isEnumerationTerm(k)) glossaryMap.delete(k); });

  glossaryTermsSet = new Set();
  glossaryMap.forEach((defs, term) => {
    if (term.length < GLOSSARY_MIN_TERM_LEN && !isShortGlossaryTermAllowed(term, defs)) return;
    glossaryTermsSet.add(term);
    const norm = term.replace(/[إأآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
    if (norm !== term) glossaryTermsSet.add(norm);
  });
  glossaryRegex = glossaryTermsSet.size > 0;
}

function parseGlossaryBody(body) {
  const entries = [];
  const blocks = body.split(/\n\s*\n/);
  for (let bi = 0; bi < blocks.length; bi++) {
    const block = blocks[bi].trim();
    if (!block) continue;
    const m = block.match(/^([^\n:：]{1,60}?)[\s\u200c]*[:：]\s*([\s\S]*)$/);
    if (!m) continue;
    let term = m[1].replace(/[\u200c\u200d]/g, '').trim();
    let def = m[2].replace(/[\u200c\u200d]/g, ' ').replace(/[ \t]+/g, ' ').trim();
    if (!term || !def) continue;
    if (term.length < 2 || term.length > 40) continue;
    if (isEnumerationTerm(term)) continue;
    entries.push({ term, def, bi });
  }
  return entries;
}

function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function applyTheme() {
  document.body.classList.toggle('night-mode', nightMode);
  document.documentElement.setAttribute('data-theme', nightMode ? 'dark' : 'light');
  const toggle = document.getElementById('nightToggle');
  if (toggle) toggle.classList.toggle('on', nightMode);
  document.querySelectorAll('.font-family-controls button[data-font]').forEach(b => {
    b.classList.toggle('active', b.dataset.font === fontFamily);
  });
  syncFontSizeUi();
  const libView = localStorage.getItem('rs_library_view') || 'cards';
  document.querySelectorAll('#libraryViewControls button[data-libview]').forEach(b => {
    b.classList.toggle('active', b.dataset.libview === libView);
  });
  const pinsToggle = document.getElementById('showPinsToggle');
  if (pinsToggle) pinsToggle.classList.toggle('on', isSectionShown('pins'));
  const dailyToggle = document.getElementById('showDailyToggle');
  if (dailyToggle) dailyToggle.classList.toggle('on', isSectionShown('daily'));
  document.querySelectorAll('#readModeControls button[data-readmode]').forEach(b => {
    b.classList.toggle('active', b.dataset.readmode === readModeName());
  });
  try { applyAppearancePrefs(); refreshLookUi(); } catch (e) { console.warn('look', e); }
}

function openAdvancedSettings() {
  document.getElementById('advancedSettingsOverlay').classList.add('show');
  applyTheme();
  try { notifRefreshUi(); } catch (e) {}
}
function closeAdvancedSettings() { document.getElementById('advancedSettingsOverlay').classList.remove('show'); }

function isSectionShown(key) {
  return localStorage.getItem('rs_show_' + key) !== '0';
}
function toggleShowSection(key) {
  const shown = isSectionShown(key);
  localStorage.setItem('rs_show_' + key, shown ? '0' : '1');
  applyTheme();
  if (document.getElementById('booksPage').classList.contains('active')) renderReferencesPage();
}

function getNavMode() { return localStorage.getItem('rs_navmode') === 'compact' ? 'compact' : 'show'; }
function navAutoHide() { const v = localStorage.getItem('rs_navhide'); return v === null ? getNavMode() === 'compact' : v === '1'; }
function setNavAutoHide(on) {
  localStorage.setItem('rs_navhide', on ? '1' : '0');
  if (!on) document.body.classList.remove('nav-away');
  const t = document.getElementById('navHideToggle'); if (t) t.classList.toggle('on', !!on);
}
function toggleNavAutoHide() { setNavAutoHide(!navAutoHide()); }
function isTypingNow() {
  const a = document.activeElement;
  return !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable);
}
let _compactTimer = null;
function applyCompactView() {
  const mode = getNavMode();
  const b = document.body;
  if (isTypingNow()) return;
  const compact = !isEmbeddedMode && mode === 'compact';
  const _nh = document.getElementById('navHideToggle'); if (_nh) _nh.classList.toggle('on', navAutoHide());
  b.classList.toggle('compact-view', compact);
  if (!(navAutoHide() || isEmbeddedMode)) b.classList.remove('nav-away');
  try { positionReaderFab(); } catch (e) {}
}
function setNavMode(m) {
  localStorage.setItem('rs_navmode', m);
  applyCompactView();
  document.querySelectorAll('#navModeControls button').forEach(x => x.classList.toggle('active', x.dataset.navmode === m));
}
let _lastNavScrollTop = 0;
function onContentScrollForNav() {
  if (!(navAutoHide() || isEmbeddedMode)) { document.body.classList.remove('nav-away'); return; }
  const c = document.getElementById('content');
  const top = c.scrollTop;
  const delta = top - _lastNavScrollTop;
  _lastNavScrollTop = top;
  const nearEnd = top + c.clientHeight >= c.scrollHeight - 80;
  if (delta > 6) document.body.classList.add('nav-away');
  else if ((delta < -14 && !nearEnd) || delta < -40 || top < 20) document.body.classList.remove('nav-away');
}
function setupCompactView() {
  window.addEventListener('resize', () => { clearTimeout(_compactTimer); _compactTimer = setTimeout(applyCompactView, 120); });
  document.addEventListener('focusout', () => setTimeout(applyCompactView, 250));
  const c = document.getElementById('content');
  if (c) c.addEventListener('scroll', onContentScrollForNav, { passive: true });
  const nav = document.getElementById('bottomnav');
  if (nav) nav.addEventListener('click', () => document.body.classList.remove('nav-away'), true);
  applyCompactView();
  document.querySelectorAll('#navModeControls button').forEach(x => x.classList.toggle('active', x.dataset.navmode === getNavMode()));
}

function openSettings() {
  document.getElementById('settingsOverlay').classList.add('show');
  applyTheme();
  const _bvs = document.getElementById('buildVersionSettingsTag');
  if (_bvs) {
    if (_dbVersionVerified !== null && _dbVersionVerified !== EXPECTED_DB_VERSION) {
      _bvs.textContent = `⚠️ تعارض: الكود يتوقّع بيانات v${EXPECTED_DB_VERSION} / الموجود v${_dbVersionVerified}`;
      _bvs.style.color = '#ff5555'; _bvs.style.fontWeight = 'bold';
    } else {
      _bvs.textContent = BUILD_VERSION + (_dbVersionVerified !== null ? ` ✓` : '');
    }
  }
}
const SOURCE_URL = 'https://github.com/Mshkaah/Figh';
function openHelp() {
  document.getElementById('helpSheet').innerHTML = RSUI.helpHtml();
  document.getElementById('helpOverlay').classList.add('show');
  document.getElementById('helpSheet').scrollTop = 0;
}
function closeHelp() { document.getElementById('helpOverlay').classList.remove('show'); }

function openAbout() {
  let nBooks = 0, nMarja = 0, nQ = 0;
  try {
    nBooks = allBooks.filter(b => b.id !== undefined).length;
    nMarja = Object.keys(allAuthors || {}).filter(k => k !== String(GLOSSARY_AUTHOR_ID) && allAuthors[k] && !/^القواعد/.test(allAuthors[k])).length;
    const d = loadCmpData(); nQ = d.subjectsById.size;
  } catch (e) {}
  document.getElementById('aboutSheet').innerHTML = RSUI.aboutHtml({ books: nBooks, marja: nMarja, questions: nQ, version: BUILD_VERSION, sourceUrl: SOURCE_URL });
  document.getElementById('aboutOverlay').classList.add('show');
  document.getElementById('aboutSheet').scrollTop = 0;
}
function closeAbout() { document.getElementById('aboutOverlay').classList.remove('show'); }

function closeSettings() { document.getElementById('settingsOverlay').classList.remove('show'); }

function toggleNight() {
  try { const _l = getLook(); if (_l.auto) { _l.auto = false; localStorage.setItem(LOOK_KEY, JSON.stringify(_l)); } } catch (e) {}
  nightMode = !nightMode;
  localStorage.setItem('rs_night', nightMode ? '1' : '0');
  applyTheme();
}

function setFontSizeLevel(size) {
  fontSize = size;
  localStorage.setItem('rs_fontSize', fontSize);
  document.querySelectorAll('.body-text').forEach(el => {
    el.style.fontSize = fontSize + 'px';
  });
  document.documentElement.style.setProperty('--read-size', fontSize + 'px');
  syncFontSizeUi();
}
function syncFontSizeUi() {
  const sl = document.getElementById('fontSizeSlider');
  if (sl && parseInt(sl.value, 10) !== fontSize) sl.value = fontSize;
  const v = document.getElementById('fontSizeValue'); if (v) v.textContent = fontSize;
  const p = document.getElementById('fontSizePreview');
  if (p) { p.style.fontSize = fontSize + 'px'; p.classList.remove('font-default', 'font-serif', 'font-naskh'); p.classList.add(fontFamily); }
}


const _fontLoadKeepers = [];
function ensureReaderFontsLoaded() {
  if (!document.fonts || !document.fonts.load) return;
  const fam = fontFamily === 'font-naskh' ? 'Scheherazade New' : (fontFamily === 'font-serif' ? 'Amiri' : null);
  if (!fam) return;
  const sample = 'بسم الله الرحمن الرحيم ١٢٣ abc';
  ['400', '500', '600', '700'].forEach(w => {
    document.fonts.load(`${w} 17px "${fam}"`, sample).then(faces => { faces.forEach(f => { if (_fontLoadKeepers.indexOf(f) === -1) _fontLoadKeepers.push(f); }); }).catch(() => {});
  });
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) ensureReaderFontsLoaded(); });
window.addEventListener('pageshow', ensureReaderFontsLoaded);
window.addEventListener('load', ensureReaderFontsLoaded);
function setFontFamily(f) {
  fontFamily = f;
  localStorage.setItem('rs_fontFamily', f);
  applyTheme();
  ensureReaderFontsLoaded();
  document.querySelectorAll('.body-text').forEach(el => {
    el.classList.remove('font-default', 'font-serif', 'font-naskh');
    el.classList.add(f);
  });
  syncFontSizeUi();
}

const TAB_NAMES = ['books', 'search', 'favorites', 'comparison', 'writing'];
const tabCtx = {};
TAB_NAMES.forEach(t => { tabCtx[t] = { stack: [], view: null, snap: null }; });
let isRestoringTab = false;

function registerView(restore, opts) {
  opts = opts || {};
  const ctx = tabCtx[currentTab]; if (!ctx) return;
  ctx.view = { restore, snapshot: opts.snapshot || null, handlesScroll: !!opts.handlesScroll };
}
function captureViewSnap(v) {
  const c = document.getElementById('content');
  const snap = { scroll: c ? c.scrollTop : 0 };
  if (v && v.snapshot) { try { Object.assign(snap, v.snapshot()); } catch (e) {} }
  return snap;
}
function runViewRestore(v, snap) {
  const prev = isRestoringTab; isRestoringTab = true;
  try { v.restore(snap); } finally { isRestoringTab = prev; }
  if (!v.handlesScroll && snap && typeof snap.scroll === 'number') {
    const y = snap.scroll;
    requestAnimationFrame(() => requestAnimationFrame(() => { document.getElementById('content').scrollTop = y; }));
  }
}

function showSearchRoot() {
  searchTabActive = false;
  hideBreadcrumb();
  switchPage('searchPage', 'البحث');
  if (!document.getElementById('searchFilterPanel').dataset.built) buildSearchFilterPanel();
  populateCmpSearchScholarSelect();
  registerView(() => showSearchRoot());
}
function renderTabRoot(tab) {
  navStack = [];
  updateBackButtonVisibility();
  hideBreadcrumb();
  if (tab === 'books') renderReferencesPage();
  else if (tab === 'search') showSearchRoot();
  else if (tab === 'favorites') { renderFavoritesPage(); switchPage('favoritesPage', 'الاشارات المرجعية'); }
  else if (tab === 'comparison') { renderComparisonPage(); switchPage('comparisonPage', 'جامع الاستفتاءات'); }
  else if (tab === 'writing') { renderWritingPage(); switchPage('writingPage', 'شخصي'); }
}

function showTab(tab) {
  const content = document.getElementById('content');
  const wasAlready = (currentTab === tab);
  const out = tabCtx[currentTab];
  if (out && !wasAlready) {
    out.stack = navStack.slice();
    out.snap = out.view ? captureViewSnap(out.view) : null;
  }
  currentTab = tab;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('#bottomnav .navitem').forEach(n => n.classList.remove('active'));
  document.querySelector(`#bottomnav .navitem[data-page="${tab}"]`).classList.add('active');
  const ctx = tabCtx[tab];

  if (wasAlready) {
    ctx.stack = []; ctx.view = null; ctx.snap = null;
    renderTabRoot(tab);
    content.scrollTop = 0;
    return;
  }
  if (ctx.view) {
    navStack = ctx.stack.slice();
    updateBackButtonVisibility();
    runViewRestore(ctx.view, ctx.snap);
    updateBackButtonVisibility();
    return;
  }
  if (tab === 'comparison') {
    navStack = []; updateBackButtonVisibility(); hideBreadcrumb();
    cmpMemoryRestore(); switchPage('comparisonPage', 'جامع الاستفتاءات');
    return;
  }
  renderTabRoot(tab);
  content.scrollTop = 0;
}

function updateBackButtonVisibility() {
  document.getElementById('backBtn').style.display = navStack.length === 0 ? 'none' : 'flex';
  const embBtn = document.getElementById('embeddedBackBtn');
  if (embBtn) embBtn.classList.toggle('show', navStack.length > 0);
}

function goBack() {
  if (navStack.length > 0) {
    const prev = navStack.pop();
    isNavigatingBack = true;
    try { prev(); } finally { isNavigatingBack = false; }
    updateBackButtonVisibility();
    return;
  }
  history.back();
}

function pushNav(fn) {
  if (isNavigatingBack || isRestoringTab) return;
  const ctx = tabCtx[currentTab];
  const v = ctx && ctx.view;
  if (v) {
    const snap = captureViewSnap(v);
    navStack.push(() => runViewRestore(v, snap));
  } else {
    navStack.push(fn);
  }
  updateBackButtonVisibility();
}

function updateAddBookFab(pageId) {
  const f = document.getElementById('addBookFab');
  if (f) f.classList.toggle('show', pageId === 'booksPage');
}
function switchPage(pageId, title) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(pageId).classList.add('active');
  updateAddBookFab(pageId);
  document.getElementById('pageTitle').textContent = title;
  clearReadingHeader();

  if (pageId === 'customBookPage') {
    showReaderFab();
    document.getElementById('readerFabPosition').style.display = 'none';
    const editBtn = document.getElementById('readerFabCbEdit');
    editBtn.style.display = 'flex';
    editBtn.classList.toggle('active', customBookEditMode);
    document.getElementById('urwaSettingsBtn').style.display = 'none';
    updateScrollbar();
  } else if (pageId !== 'readerPage') {
    hideReaderFabEntirely();
    document.getElementById('urwaSettingsBtn').style.display = 'none';
    updateScrollbar();
  } else if (document.querySelector('#readerPage .reader-section')) {
    updateReaderFabState();
    showReaderFab();
    document.getElementById('readerFabPosition').style.display = 'flex';
    document.getElementById('readerFabCbEdit').style.display = 'none';
    updateJuristSettingsBtnState();
    recomputeCurrentSectionScrollBounds();
    updateScrollbar();
  } else {
    hideReaderFabEntirely();
    updateJuristSettingsBtnState();
  }
}

function showBreadcrumb(parts) {
  const bar = document.getElementById('breadcrumbBar');
  const readingBookOnly = parts.length === 1 && document.getElementById('readerPage').classList.contains('active') && currentBookId;
  bar.innerHTML = parts.map((p, i) => {
    const isLast = i === parts.length - 1;
    let onclickAttr = '';
    if (readingBookOnly) onclickAttr = ` onclick="openTocDrawer()"`;
    else if (!isLast) {
      if (i === 0) onclickAttr = ` onclick="openAuthorBooks(currentAuthorId)"`;
      else if (i === 1) onclickAttr = ` onclick="openTocDrawer()"`;
    }
    const cls = isLast && !readingBookOnly ? 'crumb-current' : 'crumb-link';
    return (i > 0 ? '<span class="crumb-sep">›</span>' : '') +
      `<span class="${cls}"${onclickAttr}>${escapeHtml(p)}</span>`;
  }).join('');
  bar.classList.add('show');
  const current = bar.querySelector('.crumb-current');
  if (current) {
    const scrollToCurrent = () => current.scrollIntoView({ behavior: 'auto', inline: 'end', block: 'nearest' });
    requestAnimationFrame(scrollToCurrent);
    setTimeout(scrollToCurrent, 120);
  }
}
function hideBreadcrumb() {
  document.getElementById('breadcrumbBar').classList.remove('show');
}

function isPinned(type, id) {
  return pins.some(p => p.type === type && String(p.id) === String(id));
}
function savePins() { localStorage.setItem('rs_pins', JSON.stringify(pins)); }

function togglePin(type, id, label, sub) {
  const idx = pins.findIndex(p => p.type === type && String(p.id) === String(id));
  if (idx >= 0) {
    pins.splice(idx, 1);
  } else {
    pins.push({ type, id: String(id), label: label || '', sub: sub || '' });
  }
  savePins();
  masalaPoolCache = {};
  const booksPageEl = document.getElementById('booksPage');
  const _pp = document.getElementById('pinPickerOverlay');
  if (_pp && _pp.classList.contains('show')) { pinsHomeDirty = true; return; }
  if (booksPageEl && booksPageEl.classList.contains('active') && !reorderModeActive) {
    renderHomeExtras();
  }
}
let pinsHomeDirty = false;

let pinPickerLevel = 'authors';
let pinPickerAuthorId = null;

function openPinPicker() {
  pinPickerLevel = 'authors';
  pinPickerAuthorId = null;
  renderPinPicker();
  document.getElementById('pinPickerOverlay').classList.add('show');
}
function closePinPicker() {
  document.getElementById('pinPickerOverlay').classList.remove('show');
  if (pinsHomeDirty) {
    pinsHomeDirty = false;
    setTimeout(() => {
      const b = document.getElementById('booksPage');
      if (b && b.classList.contains('active') && !reorderModeActive) renderHomeExtras();
    }, 30);
  }
}

function renderPinPicker() {
  const titleEl = document.getElementById('pinPickerTitle');
  const listEl = document.getElementById('pinPickerList');
  if (pinPickerLevel === 'authors') {
    titleEl.innerHTML = 'اختر مرجعاً لتثبيته، أو اضغط اسمه لتثبيت كتاب معيّن منه';
    let html = '';
    ensureLibraryOrder();
    libraryOrder.forEach(key => {
      const { type, id } = parseLibKey(key);
      if (type === 'custombook') {
        const cb = customBooks.find(b => b.id === id); if (!cb) return;
        const already = isPinned('custombook', cb.id);
        const nameAttr = escapeHtml(cb.name).replace(/'/g, "\\'");
        html += `<div class="pp-row"><span class="pp-avatar pp-avatar-custom"><i class="ti ti-notes"></i></span>
          <div class="pp-label">${escapeHtml(cb.name)}<div class="sub">كتابي</div></div>
          <button class="pp-pin-btn ${already ? 'active' : ''}" onclick="pinPickerTogglePin('custombook','${cb.id}','${nameAttr}','')">${already ? '<i class="ti ti-check"></i> مثبَّت' : 'تثبيت'}</button></div>`;
      } else if (type === 'collection') {
        const col = collections.find(c => c.id === id); if (!col) return;
        const already = isPinned('collection', col.id);
        const nameAttr = escapeHtml(col.name).replace(/'/g, "\\'");
        html += `<div class="pp-row"><span class="pp-avatar pp-avatar-custom"><i class="ti ti-folder"></i></span>
          <div class="pp-label">${escapeHtml(col.name)}<div class="sub">حقيبة</div></div>
          <button class="pp-pin-btn ${already ? 'active' : ''}" onclick="pinPickerTogglePin('collection','${col.id}','${nameAttr}','')">${already ? '<i class="ti ti-check"></i> مثبَّت' : 'تثبيت'}</button></div>`;
      } else if (type === 'author') {
        const aid = id;
        const name = allAuthors[aid] || '';
        const already = isPinned('author', aid);
        const photo = AUTHOR_PHOTOS[aid];
        const iconInner = photo ? `<img src="${photo}" alt="">` : `<i class="ti ${authorFallbackIcon(aid)}"></i>`;
        const nameAttr = escapeHtml(name).replace(/'/g, "\\'");
        html += `<div class="pp-row">
          <span class="pp-avatar">${iconInner}</span>
          <div class="pp-label" onclick="pinPickerDrill('${aid}')">${escapeHtml(name)}<div class="sub">كتبه تحديداً ›</div></div>
          <button class="pp-pin-btn ${already ? 'active' : ''}" onclick="pinPickerTogglePin('author','${aid}','${nameAttr}','')">${already ? '<i class="ti ti-check"></i> مثبَّت' : 'تثبيت الكل'}</button>
        </div>`;
      }
    });
    listEl.innerHTML = html;
  } else {
    const aid = pinPickerAuthorId;
    const name = allAuthors[aid] || '';
    titleEl.innerHTML = `<span class="pp-back" onclick="pinPickerBack()"><i class="ti ti-arrow-right"></i></span> كتب ${escapeHtml(name)}`;
    const books = allBooks.filter(b => (bookInAuthor(b, aid)) || (aid === GLOSSARY_AUTHOR_ID && !allAuthors[b.author_id]));
    let html = '';
    books.forEach(book => {
      const already = isPinned('book', book.id);
      const bnameAttr = escapeHtml(book.name).replace(/'/g, "\\'");
      const anameAttr = escapeHtml(name).replace(/'/g, "\\'");
      html += `<div class="pp-row">
        <span class="pp-avatar pp-avatar-book"><i class="ti ti-book"></i></span>
        <div class="pp-label">${escapeHtml(book.name)}</div>
        <button class="pp-pin-btn ${already ? 'active' : ''}" onclick="pinPickerTogglePin('book','${book.id}','${bnameAttr}','${anameAttr}')">${already ? '<i class="ti ti-check"></i> مثبَّت' : 'تثبيت'}</button>
      </div>`;
    });
    listEl.innerHTML = html || '<div class="empty-state">لا توجد كتب</div>';
  }
}
function pinPickerDrill(aid) {
  pinPickerLevel = 'books';
  pinPickerAuthorId = (aid === GLOSSARY_AUTHOR_ID) ? aid : parseInt(aid, 10);
  renderPinPicker();
}
function pinPickerBack() { pinPickerLevel = 'authors'; renderPinPicker(); }
function pinPickerTogglePin(type, id, label, sub) {
  let btn = null;
  try { const ev = window.event; btn = ev && ev.target && ev.target.closest ? ev.target.closest('button.pp-pin-btn') : null; } catch (e) { btn = null; }
  togglePin(type, id, label, sub);
  if (btn) {
    const on = isPinned(type, id);
    btn.classList.toggle('active', on);
    btn.innerHTML = on ? '<i class="ti ti-check"></i> مثبَّت' : (type === 'author' ? 'تثبيت الكل' : 'تثبيت');
  } else renderPinPicker();
}

const AUTHOR_PHOTOS = {
  1: 'icons/marja/sistani.jpg',
  3: 'icons/marja/khamenei.jpg',
  4: 'icons/marja/fayyad.jpg',
  7: 'icons/marja/sadiq_shirazi.jpg',
  11: 'icons/marja/khoei.jpg',
  12: 'icons/marja/waheed_khorasani.jpg',
  13: 'icons/marja/khomeini.jpg',
  16: 'icons/marja/mohammad_shirazi.jpg',
  24: 'icons/marja/khaqani.jpg',
  8: 'icons/marja/haeri.jpg',
  15: 'icons/marja/najafi.jpg',
  17: 'icons/marja/tabrizi.jpg',
  19: 'icons/marja/makarem.jpg',
  20: 'icons/marja/hakim.jpg',
  23: 'icons/marja/zanjani.jpg',
  27: 'icons/marja/subhani.jpg',
  26: 'icons/marja/usfur_cover.jpg'
};

function renderReferencesPage() {
  const container = document.getElementById('booksPage');
  let html = '';
  if (reorderModeActive) {
    ensureLibraryOrder();
    const viewMode = localStorage.getItem('rs_library_view') || 'cards';
    const isCards = viewMode !== 'list';
    html += `<div class="ref-toolbar reorder-active-bar">
      <span class="reorder-hint">اسحب <i class="ti ti-grip-vertical"></i> لإعادة الترتيب</span>
      <button class="reorder-save-btn" onclick="saveReorderAndExit()"><i class="ti ti-check"></i> حفظ الترتيب</button>
      <button class="reorder-cancel-btn" onclick="cancelReorderMode()">إلغاء</button>
    </div>`;
    html += isCards ? '<div class="lib-grid lib-grid-reorder" id="libReorderContainer">' : '<div id="libReorderContainer">';
    libraryOrder.forEach(key => {
      const { type, id } = parseLibKey(key);
      const dragAttrs = `data-libkey="${key}" ondragover="onLibDragOverGrid(event)" ondrop="onLibDrop(event)"`;
      const handleAttrs = `draggable="true" ondragstart="onLibDragStart(event)" ondragend="onLibDragEnd(event)" ontouchstart="onLibHandleTouchStart(event)"`;
      if (type === 'author') {
        const aid = id;
        const name = allAuthors[aid] || '';
        const count = allBooks.filter(b => (bookInAuthor(b, aid)) || (aid === GLOSSARY_AUTHOR_ID && !allAuthors[b.author_id])).length;
        const photo = AUTHOR_PHOTOS[aid];
        if (isCards) {
          const iconInner = photo
            ? `<img src="${photo}" alt="" onerror="this.parentElement.innerHTML='<i class=&quot;ti ti-user-circle&quot;></i>'">`
            : `<i class="ti ${authorFallbackIcon(aid)}"></i>`;
          html += `<div class="lib-card lib-reorder-row" ${dragAttrs}>
            <span class="reorder-card-handle" ${handleAttrs}><i class="ti ti-grip-vertical"></i></span>
            <div class="lib-card-photo">${iconInner}</div>
            <div class="lib-card-name">${escapeHtml(name)}</div>
            <div class="lib-card-sub">${count} كتاب</div>
          </div>`;
        } else {
          const iconHtml = photo
            ? `<img class="ref-photo" src="${photo}" alt="" onerror="this.outerHTML='<span style=&quot;font-size:30px;&quot;><i class="ti ti-user-circle"></i></span>'">`
            : `<span style="font-size:30px;line-height:1;">${aid === GLOSSARY_AUTHOR_ID ? '<i class="ti ti-vocabulary"></i>' : '<i class="ti ti-user-circle"></i>'}</span>`;
          html += `<div class="list-row ref-row-reorder lib-reorder-row" ${dragAttrs}>
            <span class="drag-handle" ${handleAttrs}><i class="ti ti-grip-vertical"></i></span>
            <span>${iconHtml}</span>
            <div class="label">${escapeHtml(name)}<small>${count} كتاب</small></div>
          </div>`;
        }
      } else if (type === 'collection') {
        const col = collections.find(c => c.id === id);
        if (!col) return;
        if (isCards) {
          html += `<div class="lib-card lib-reorder-row" ${dragAttrs}>
            <span class="reorder-card-handle" ${handleAttrs}><i class="ti ti-grip-vertical"></i></span>
            <div class="lib-card-photo lib-card-photo-collection"><i class="ti ti-folder"></i></div>
            <div class="lib-card-name">${escapeHtml(col.name)}</div>
            <div class="lib-card-sub">${col.memberKeys.length} عنصر</div>
          </div>`;
        } else {
          html += `<div class="list-row ref-row-reorder lib-reorder-row" ${dragAttrs}>
            <span class="drag-handle" ${handleAttrs}><i class="ti ti-grip-vertical"></i></span>
            <span style="font-size:20px;color:var(--accent-text);"><i class="ti ti-folder"></i></span>
            <div class="label">${escapeHtml(col.name)}<small>${col.memberKeys.length} عنصر</small></div>
          </div>`;
        }
      } else if (type === 'writing') {
        const w = freeWritings.find(x => x.id === id);
        if (!w) return;
        const wc = w.color || '#8e5bd4';
        if (isCards) {
          html += `<div class="lib-card lib-reorder-row" ${dragAttrs}>
            <span class="reorder-card-handle" ${handleAttrs}><i class="ti ti-grip-vertical"></i></span>
            <div class="lib-card-photo" style="background:${hexToRgba(wc, 0.14)};color:${wc}"><i class="ti ti-pencil"></i></div>
            <div class="lib-card-name">${escapeHtml(writingDisplayTitle(w))}</div>
            <div class="lib-card-sub">كتابة</div>
          </div>`;
        } else {
          html += `<div class="list-row ref-row-reorder lib-reorder-row" ${dragAttrs}>
            <span class="drag-handle" ${handleAttrs}><i class="ti ti-grip-vertical"></i></span>
            <span style="font-size:20px;color:${wc};"><i class="ti ti-pencil"></i></span>
            <div class="label">${escapeHtml(writingDisplayTitle(w))}<small>كتابة</small></div>
          </div>`;
        }
      } else {
        const cb = customBooks.find(b => b.id === id);
        if (!cb) return;
        if (isCards) {
          html += `<div class="lib-card lib-reorder-row" ${dragAttrs}>
            <span class="reorder-card-handle" ${handleAttrs}><i class="ti ti-grip-vertical"></i></span>
            <div class="lib-card-photo lib-card-photo-custom"><i class="ti ti-notes"></i></div>
            <div class="lib-card-name">${escapeHtml(cb.name)}</div>
            <div class="lib-card-sub">كتابي</div>
          </div>`;
        } else {
          html += `<div class="list-row ref-row-reorder lib-reorder-row" ${dragAttrs}>
            <span class="drag-handle" ${handleAttrs}><i class="ti ti-grip-vertical"></i></span>
            <span style="font-size:20px;color:#2471A3;"><i class="ti ti-notes"></i></span>
            <div class="label">${escapeHtml(cb.name)}<small>كتابي الخاص</small></div>
          </div>`;
        }
      }
    });
    html += '</div>';
  } else {
    dailyMasalaExpanded = computeDailyMasalaExpandedForThisVisit();
    html += renderHomeExtrasHtml();
  }
  container.innerHTML = html || '<div class="empty-state"><div class="ic"><i class="ti ti-book-2"></i></div>لا توجد مراجع</div>';
  container.classList.toggle('reorder-mode', reorderModeActive);
  hideBreadcrumb();
  switchPage('booksPage', 'المحتويات');
  booksTabActive = false;
  lastBooksPageId = 'booksPage';
  lastBooksPageTitle = 'المحتويات';
  lastBooksBreadcrumb = null;
  if (currentTab === 'books') registerView(() => renderReferencesPage());
}

function renderHomeExtrasHtml() {
  let html = '<div id="homeExtras">';
  if (isSectionShown('pins')) {
    html += `<div class="section-header">
        <span><i class="ti ti-pin"></i> المثبّتة</span>
        ${pinsEditMode ? `<button class="section-header-add done-mode" onclick="exitPinEditMode()">تمّ</button>` : ''}
      </div>`;
    html += renderPinnedShortcutsHtml();
  }
  if (isSectionShown('daily')) html += renderDailyMasalaHtml();
  html += `<div class="section-header"><span><i class="ti ti-stack-2"></i> مكتبتي</span></div>`;
  html += renderLibraryGridHtml();
  html += '</div>';
  return html;
}

function renderHomeExtras() {
  const el = document.getElementById('homeExtras');
  if (el) el.outerHTML = renderHomeExtrasHtml();
  if (isSectionShown('pins')) initPinnedDragAndDrop();
}

function renderPinnedShortcutsHtml() {
  let html = '<div class="pinned-shortcuts-row" id="pinnedShortcutsRow">';
  pins.forEach((p, idx) => {
    const isAuthor = p.type === 'author';
    const isCustom = p.type === 'custombook';
    const isCollection = p.type === 'collection';
    let photo = null, iconInner, badge = '', shapeClass = '';
    if (isAuthor) {
      if (p.id === GLOSSARY_AUTHOR_ID) {
        iconInner = `<i class="ti ti-vocabulary"></i>`;
      } else {
        photo = AUTHOR_PHOTOS[p.id];
        iconInner = photo ? `<img src="${photo}" alt="" onerror="this.parentElement.innerHTML='<i class=&quot;ti ${authorFallbackIcon(p.id)}&quot;></i>'">` : `<i class="ti ${authorFallbackIcon(p.id)}"></i>`;
      }
    } else if (isCustom) {
      iconInner = `<i class="ti ti-notes"></i>`;
      shapeClass = 'pin-ic-custom-color';
    } else if (isCollection) {
      iconInner = `<i class="ti ti-folder"></i>`;
      shapeClass = 'pin-ic-collection-color';
    } else {
      const book = allBooks.find(b => b.id === parseInt(p.id, 10));
      const isGlossaryBook = book && !allAuthors[book.author_id];
      photo = (book && !isGlossaryBook) ? AUTHOR_PHOTOS[book.author_id] : null;
      iconInner = isGlossaryBook
        ? `<i class="ti ti-vocabulary"></i>`
        : (photo ? `<img src="${photo}" alt="" onerror="this.parentElement.innerHTML='<i class=&quot;ti ${book ? authorFallbackIcon(book.author_id) : 'ti-user-circle'}&quot;></i>'">` : `<i class="ti ${book ? authorFallbackIcon(book.author_id) : 'ti-user-circle'}"></i>`);
      badge = `<span class="pin-book-badge"><i class="ti ti-book"></i></span>`;
    }
    const openCall = isAuthor ? `openAuthorBooks('${p.id}')` : isCustom ? `openCustomBookFromPersonal('${p.id}')` : isCollection ? `openCollectionFromPersonal('${p.id}')` : `openBookIndex(${parseInt(p.id, 10)})`;
    const editControls = pinsEditMode ? `
      <span class="pin-drag-handle" data-drag-handle="${idx}"><i class="ti ti-grip-vertical"></i></span>
      <span class="pin-remove-x" onclick="event.stopPropagation(); removePinNow('${p.type}','${p.id}')"><i class="ti ti-x"></i></span>` : '';
    const tapAction = pinsEditMode ? '' : openCall;
    html += `<div class="pinned-chip ${pinsEditMode ? 'pin-edit-mode' : ''}" data-pin-idx="${idx}"
        ontouchstart="startLongPress(event)" ontouchend="cancelLongPress()"
        onmousedown="startLongPress(event)" onmouseup="cancelLongPress()" onmouseleave="cancelLongPress()">
      ${editControls}
      <div class="pin-ic-wrap" onclick="${tapAction}">
        <div class="pin-ic ${shapeClass}">${iconInner}</div>
        ${badge}
      </div>
      <div class="pin-label" onclick="${tapAction}" title="${escapeHtml(p.sub || '')}">${escapeHtml(p.label || '')}</div>
    </div>`;
  });
  if (!pinsEditMode) {
    html += `<div class="pinned-chip pinned-chip-add" onclick="openPinPicker()">
      <div class="pin-ic-wrap"><div class="pin-ic pin-ic-add"><i class="ti ti-plus"></i></div></div>
      <div class="pin-label">إضافة</div>
    </div>`;
  }
  html += '</div>';
  if (!pins.length) {
    html += `<div class="pinned-hint">لا شيء مثبَّت بعد — اضغط "إضافة" بالشريط أعلاه</div>`;
  }
  return html;
}

let pinDragState = null;

function initPinnedDragAndDrop() {
  const row = document.getElementById('pinnedShortcutsRow');
  if (!row) return;
  row.querySelectorAll('.pin-drag-handle').forEach(handle => {
    handle.addEventListener('touchstart', onPinDragHandleStart, { passive: false });
    handle.addEventListener('mousedown', onPinDragHandleStart);
  });
}

function onPinDragHandleStart(e) {
  e.preventDefault();
  e.stopPropagation();
  const handle = e.currentTarget;
  const srcIdx = parseInt(handle.dataset.dragHandle, 10);
  const chip = handle.closest('.pinned-chip');
  const point = e.touches ? e.touches[0] : e;
  pinDragState = { srcIdx, chip, startX: point.clientX, startY: point.clientY };
  chip.classList.add('pin-dragging');
  document.addEventListener('touchmove', onPinDragMove, { passive: false });
  document.addEventListener('touchend', onPinDragEnd);
  document.addEventListener('mousemove', onPinDragMove);
  document.addEventListener('mouseup', onPinDragEnd);
}

function onPinDragMove(e) {
  if (!pinDragState) return;
  e.preventDefault();
  const point = e.touches ? e.touches[0] : e;
  const row = document.getElementById('pinnedShortcutsRow');
  if (!row) return;
  const chips = [...row.querySelectorAll('.pinned-chip[data-pin-idx]')];
  let targetIdx = pinDragState.srcIdx;
  for (const chip of chips) {
    const rect = chip.getBoundingClientRect();
    const idx = parseInt(chip.dataset.pinIdx, 10);
    if (point.clientX >= rect.left && point.clientX <= rect.right) { targetIdx = idx; break; }
  }
  if (targetIdx !== pinDragState.srcIdx) {
    const [moved] = pins.splice(pinDragState.srcIdx, 1);
    pins.splice(targetIdx, 0, moved);
    pinDragState.srcIdx = targetIdx;
    localStorage.setItem('rs_pins', JSON.stringify(pins));
    renderHomeExtras();
    const newRow = document.getElementById('pinnedShortcutsRow');
    const newChip = newRow ? newRow.querySelector(`.pinned-chip[data-pin-idx="${targetIdx}"]`) : null;
    if (newChip) { newChip.classList.add('pin-dragging'); pinDragState.chip = newChip; }
  }
}

function onPinDragEnd() {
  if (pinDragState && pinDragState.chip) pinDragState.chip.classList.remove('pin-dragging');
  pinDragState = null;
  document.removeEventListener('touchmove', onPinDragMove);
  document.removeEventListener('touchend', onPinDragEnd);
  document.removeEventListener('mousemove', onPinDragMove);
  document.removeEventListener('mouseup', onPinDragEnd);
}

let pinsEditMode = false;
let longPressTimer = null;
function startLongPress(evt) {
  clearTimeout(longPressTimer);
  if (pinsEditMode) return;
  longPressTimer = setTimeout(() => {
    longPressTimer = null;
    if (navigator.vibrate) navigator.vibrate(15);
    pinsEditMode = true;
    renderHomeExtras();
  }, 500);
}
function cancelLongPress() { clearTimeout(longPressTimer); longPressTimer = null; }
function exitPinEditMode() { pinsEditMode = false; renderHomeExtras(); }
function removePinNow(type, id) {
  const pin = pins.find(p => p.type === type && String(p.id) === String(id));
  const label = pin ? pin.label : 'هذا العنصر';
  openConfirmDialog(`إزالة "${label}" من المثبَّتة؟`, () => {
    togglePin(type, id, '', '');
  });
}

function renderLibraryGridHtml() {
  ensureLibraryOrder();
  const viewMode = localStorage.getItem('rs_library_view') || 'cards';
  const isCards = viewMode !== 'list';
  let html = isCards ? '<div class="lib-grid">' : '';
  libraryOrder.forEach(key => {
    const { type, id } = parseLibKey(key);
    if (type === 'author') {
      const aid = id;
      const name = allAuthors[aid] || '';
      const count = allBooks.filter(b => (bookInAuthor(b, aid)) || (aid === GLOSSARY_AUTHOR_ID && !allAuthors[b.author_id])).length;
      const photo = AUTHOR_PHOTOS[aid];
      if (isCards) {
        const iconInner = photo
          ? `<img src="${photo}" alt="" onerror="this.parentElement.innerHTML='<i class=&quot;ti ti-user-circle&quot;></i>'">`
          : `<i class="ti ${authorFallbackIcon(aid)}"></i>`;
        html += `<div class="lib-card" onclick="openAuthorBooks('${aid}')">
          <div class="lib-card-photo">${iconInner}</div>
          <div class="lib-card-name">${escapeHtml(name)}</div>
          <div class="lib-card-sub">${count} كتاب</div>
        </div>`;
      } else {
        const iconHtml = photo
          ? `<img class="ref-photo" src="${photo}" alt="" onerror="this.outerHTML='<span style=&quot;font-size:30px;&quot;><i class="ti ti-user-circle"></i></span>'">`
          : `<span style="font-size:30px;line-height:1;">${aid === GLOSSARY_AUTHOR_ID ? '<i class="ti ti-vocabulary"></i>' : '<i class="ti ti-user-circle"></i>'}</span>`;
        html += `<div class="list-row" onclick="openAuthorBooks('${aid}')">
          <span>${iconHtml}</span>
          <div class="label">${escapeHtml(name)}<small>${count} كتاب</small></div>
        </div>`;
      }
    } else if (type === 'custombook') {
      const cb = customBooks.find(b => b.id === id);
      if (!cb) return;
      if (isCards) {
        html += `<div class="lib-card" onclick="openCustomBookFromPersonal('${cb.id}')">
          <div class="lib-card-photo lib-card-photo-custom"><i class="ti ti-notes"></i></div>
          <div class="lib-card-name">${escapeHtml(cb.name)}</div>
          <div class="lib-card-sub">كتابي</div>
        </div>`;
      } else {
        html += `<div class="list-row" onclick="openCustomBookFromPersonal('${cb.id}')">
          <span style="font-size:20px;color:#2471A3;"><i class="ti ti-notes"></i></span>
          <div class="label">${escapeHtml(cb.name)}<small>كتابي</small></div>
        </div>`;
      }
    } else if (type === 'writing') {
      const w = freeWritings.find(x => x.id === id);
      if (!w) return;
      const wc = w.color || '#8e5bd4';
      if (isCards) {
        html += `<div class="lib-card" onclick="openWritingFromLibrary('${w.id}')">
          <div class="lib-card-photo" style="background:${hexToRgba(wc, 0.14)};color:${wc}"><i class="ti ti-pencil"></i></div>
          <div class="lib-card-name">${escapeHtml(writingDisplayTitle(w))}</div>
          <div class="lib-card-sub">كتابة</div>
        </div>`;
      } else {
        html += `<div class="list-row" onclick="openWritingFromLibrary('${w.id}')">
          <span style="font-size:20px;color:${wc};"><i class="ti ti-pencil"></i></span>
          <div class="label">${escapeHtml(writingDisplayTitle(w))}<small>كتابة</small></div>
        </div>`;
      }
    } else if (type === 'collection') {
      const col = collections.find(c => c.id === id);
      if (!col) return;
      const memberCount = col.memberKeys.length;
      if (isCards) {
        html += `<div class="lib-card" onclick="openCollectionFromPersonal('${col.id}')">
          <div class="lib-card-photo lib-card-photo-collection"><i class="ti ti-folder"></i></div>
          <div class="lib-card-name">${escapeHtml(col.name)}</div>
          <div class="lib-card-sub">${memberCount} عنصر</div>
        </div>`;
      } else {
        html += `<div class="list-row" onclick="openCollectionFromPersonal('${col.id}')">
          <span style="font-size:20px;color:var(--accent-text);"><i class="ti ti-folder"></i></span>
          <div class="label">${escapeHtml(col.name)}<small>${memberCount} عنصر</small></div>
        </div>`;
      }
    }
  });
  if (isCards) html += '</div>';
  return html;
}
function openLibraryAddChooser() {
  openMiniMenu('إضافة إلى مكتبتي', `
    <div class="list-row" onclick="closeMiniMenu(); openTextPrompt('اسم الكتاب الجديد','كتابي', createCustomBookAndOpen);"><span style="font-size:20px;color:#2471A3;"><i class="ti ti-notes"></i></span><div class="label">كتاب جديد<small>كتاب فارغ تجمع فيه مسائل من قراءتك</small></div></div>
    <div class="list-row" onclick="closeMiniMenu(); openNewWritingFromLibrary();"><span style="font-size:20px;color:#8e5bd4;"><i class="ti ti-pencil-plus"></i></span><div class="label">كتابة جديدة<small>مساحة حرّة تكتب فيها وتدرج مسائلك وتعليقاتك</small></div></div>
    <div class="list-row" onclick="closeMiniMenu(); openTextPrompt('اسم الحقيبة','حقيبتي', createCollectionAndOpen);"><span style="font-size:20px;color:var(--accent-text);"><i class="ti ti-folder"></i></span><div class="label">حقيبة جديدة<small>تضمّ كتباً موجودة بالفعل، رسمية أو خاصة، تحت اسم واحد</small></div></div>
  `);
}
function openNewWritingFromLibrary() {
  personalState.tab = 'wr';
  enterPersonalTab();
  renderWritingPage();
  openWritingEditor(null);
}
function createCustomBookAndOpen(name) {
  const trimmed = (name || '').trim() || 'كتابي';
  const cb = { id: newUid('cb'), name: trimmed, createdAt: Date.now(), items: [], migratedV2: true };
  customBooks.push(cb);
  saveCustomBooks();
  openCustomBook(cb.id);
}
function createCollectionAndOpen(name) {
  const trimmed = (name || '').trim() || 'حقيبتي';
  const col = { id: newUid('col'), name: trimmed, createdAt: Date.now(), memberKeys: [] };
  collections.push(col);
  saveCollections();
  openCollection(col.id);
}
function setLibraryViewMode(mode) {
  localStorage.setItem('rs_library_view', mode);
  applyTheme();
  if (document.getElementById('booksPage').classList.contains('active')) renderReferencesPage();
}


const BOOK_PART_PATTERNS = [
  /\s*[-–]?\s*\(?\s*الجزء\s+(?:الأول|الاول|الثاني|الثالث|الرابع|الخامس|السادس|السابع|الثامن|التاسع|العاشر|الحادي عشر|الثاني عشر|الثالث عشر|الرابع عشر|الخامس عشر|\d+)\s*\)?(?=\s|$|[-–)])/g,
  /\s*[-–]?\s*جزء\s+(?:الأول|الاول|الثاني|الثالث|الرابع|\d+)(?=\s|$|[-–])/g,
  /\s*[-–]?\s*(?:العبادات|المعاملات)(?=\s|$|[-–])/g,
  /\s*[-–]?\s*\(?\s*ج\s*\.?\s*[\d٠-٩]+\s*\)?\s*$/g,
];

function bookRootName(name) {
  let n = (name || '').trim();
  for (const pat of BOOK_PART_PATTERNS) n = n.replace(pat, '');
  n = n.replace(/\s+/g, ' ').trim().replace(/[-–]+$/, '').trim();
  return n.replace(/منهج الصالحين/g, 'منهاج الصالحين');
}

function groupBooksByParts(books) {
  const rootMap = new Map();
  for (const book of books) {
    const root = bookRootName(book.name);
    if (!rootMap.has(root)) rootMap.set(root, []);
    rootMap.get(root).push(book);
  }
  const items = [];
  const seenRoots = new Set();
  for (const book of books) {
    const root = bookRootName(book.name);
    if (seenRoots.has(root)) continue;
    seenRoots.add(root);
    const group = rootMap.get(root);
    if (group.length > 1) {
      items.push({ type: 'group', root, books: group });
    } else {
      items.push({ type: 'single', book });
    }
  }
  return items;
}

let currentCollectionId = null;
function openCollection(id) {
  pushNav(() => renderReferencesPage());
  currentCollectionId = id;
  renderCollectionPage();
  const col = collections.find(c => c.id === id);
  showBreadcrumb([col ? col.name : 'حقيبة']);
  switchPage('authorBooksPage', col ? col.name : 'حقيبة');
  booksTabActive = true;
  lastBooksPageId = 'authorBooksPage';
  lastBooksPageTitle = col ? col.name : 'حقيبة';
  lastBooksBreadcrumb = [col ? col.name : 'حقيبة'];
  registerView(() => openCollection(id));
}
function renderCollectionPage() {
  const col = collections.find(c => c.id === currentCollectionId);
  const container = document.getElementById('authorBooksPage');
  if (!col) { container.innerHTML = '<div class="empty-state">لم تعد هذه الحقيبة موجودة</div>'; return; }
  let html = '';
  if (!col.memberKeys.length) {
    html += `<div class="empty-state"><div class="ic"><i class="ti ti-folder"></i></div>الحقيبة فارغة — أضف إليها من الزر أدناه</div>`;
  }
  col.memberKeys.forEach(key => {
    const { type, id } = parseLibKey(key);
    if (type === 'author') {
      const name = allAuthors[id] || '';
      if (!name && id !== GLOSSARY_AUTHOR_ID) return;
      const aPhoto = AUTHOR_PHOTOS[id];
      const aAvatar = aPhoto ? `<img src="${aPhoto}" alt="">` : `<i class="ti ${authorFallbackIcon(id)}"></i>`;
      html += swipeRow(`<div class="list-row" onclick="openAuthorBooks('${id}')">
        <span class="pp-avatar">${aAvatar}</span>
        <div class="label">${escapeHtml(name)}<small>مرجع كامل</small></div>
      </div>`, [{icon:'trash',label:'إزالة',color:'#c0392b',js:`confirmRemoveCollectionMember('${key}')`}]);
    } else if (type === 'book') {
      const book = allBooks.find(b => b.id === id);
      if (!book) return;
      const bPhoto = AUTHOR_PHOTOS[book.author_id];
      const bAvatar = bPhoto ? `<img src="${bPhoto}" alt="">` : `<i class="ti ti-book"></i>`;
      html += swipeRow(`<div class="list-row" onclick="openBookIndex(${id})">
        <span class="pp-avatar">${bAvatar}</span>
        <div class="label">${escapeHtml(book.name)}<small>${escapeHtml(allAuthors[book.author_id] || 'كتاب')}</small></div>
      </div>`, [{icon:'trash',label:'إزالة',color:'#c0392b',js:`confirmRemoveCollectionMember('${key}')`}]);
    } else if (type === 'custombook') {
      const cb = customBooks.find(b => b.id === id);
      if (!cb) return;
      html += swipeRow(`<div class="list-row" onclick="openCustomBookFromPersonal('${cb.id}')">
        <span style="font-size:20px;color:#2471A3;"><i class="ti ti-notes"></i></span>
        <div class="label">${escapeHtml(cb.name)}<small>كتابي</small></div>
      </div>`, [{icon:'trash',label:'إزالة',color:'#c0392b',js:`confirmRemoveCollectionMember('${key}')`}]);
    }
  });
  html += `<div class="list-row" onclick="openCollectionMemberPicker()">
      <span style="font-size:20px;color:var(--accent);"><i class="ti ti-circle-plus"></i></span>
      <div class="label">إضافة إلى الحقيبة</div>
    </div>`;
  container.innerHTML = html;
}
function confirmRemoveCollectionMember(key) {
  openConfirmDialog('إزالة هذا العنصر من الحقيبة؟ (لا يُحذف من مكانه الأصلي)', () => removeCollectionMember(key));
}
function removeCollectionMember(key) {
  const col = collections.find(c => c.id === currentCollectionId);
  if (!col) return;
  col.memberKeys = col.memberKeys.filter(k => k !== key);
  saveCollections();
  renderCollectionPage();
}
let colPickerLevel = 'authors';
let colPickerAuthorId = null;
function openCollectionMemberPicker() {
  colPickerLevel = 'authors';
  colPickerAuthorId = null;
  renderCollectionMemberPicker();
  document.getElementById('colMemberPickerOverlay').classList.add('show');
}
function closeCollectionMemberPicker() { document.getElementById('colMemberPickerOverlay').classList.remove('show'); }
function renderCollectionMemberPicker() {
  const col = collections.find(c => c.id === currentCollectionId);
  const titleEl = document.getElementById('colMemberPickerTitle');
  const listEl = document.getElementById('colMemberPickerList');
  const memberSet = new Set(col ? col.memberKeys : []);
  if (colPickerLevel === 'authors') {
    titleEl.innerHTML = 'اختر مرجعاً لإضافة كل كتبه، أو اضغط اسمه لاختيار كتاب معيّن';
    let html = '';
    ensureLibraryOrder();
    libraryOrder.forEach(key => {
      const { type, id } = parseLibKey(key);
      if (type === 'custombook') {
        const cb = customBooks.find(b => b.id === id); if (!cb) return;
        const already = memberSet.has(`custombook:${cb.id}`);
        html += `<div class="pp-row"><span class="pp-avatar pp-avatar-custom"><i class="ti ti-notes"></i></span>
          <div class="pp-label">${escapeHtml(cb.name)}<div class="sub">كتابي</div></div>
          <button class="pp-pin-btn ${already ? 'active' : ''}" onclick="colPickerToggle('custombook','${cb.id}')">${already ? '<i class="ti ti-check"></i> مُضاف' : 'إضافة'}</button></div>`;
      } else if (type === 'author') {
        const aid = id;
        const name = allAuthors[aid] || '';
        const already = memberSet.has(`author:${aid}`);
        const photo = AUTHOR_PHOTOS[aid];
        const iconInner = photo ? `<img src="${photo}" alt="">` : `<i class="ti ${authorFallbackIcon(aid)}"></i>`;
        html += `<div class="pp-row">
          <span class="pp-avatar">${iconInner}</span>
          <div class="pp-label" onclick="colPickerDrill('${aid}')">${escapeHtml(name)}<div class="sub">كتبه تحديداً ›</div></div>
          <button class="pp-pin-btn ${already ? 'active' : ''}" onclick="colPickerToggle('author','${aid}')">${already ? '<i class="ti ti-check"></i> الكل مُضاف' : 'إضافة الكل'}</button>
        </div>`;
      }
    });
    listEl.innerHTML = html;
  } else {
    const aid = colPickerAuthorId;
    const name = allAuthors[aid] || '';
    titleEl.innerHTML = `<span class="pp-back" onclick="colPickerBack()"><i class="ti ti-arrow-right"></i></span> كتب ${escapeHtml(name)}`;
    const books = allBooks.filter(b => (bookInAuthor(b, aid)) || (aid === GLOSSARY_AUTHOR_ID && !allAuthors[b.author_id]));
    let html = '';
    books.forEach(book => {
      const already = memberSet.has(`book:${book.id}`);
      html += `<div class="pp-row">
        <span class="pp-avatar pp-avatar-book"><i class="ti ti-book"></i></span>
        <div class="pp-label">${escapeHtml(book.name)}</div>
        <button class="pp-pin-btn ${already ? 'active' : ''}" onclick="colPickerToggle('book',${book.id})">${already ? '<i class="ti ti-check"></i> مُضاف' : 'إضافة'}</button>
      </div>`;
    });
    listEl.innerHTML = html || '<div class="empty-state">لا توجد كتب</div>';
  }
}
function colPickerDrill(aid) {
  colPickerLevel = 'books';
  colPickerAuthorId = (aid === GLOSSARY_AUTHOR_ID) ? aid : parseInt(aid, 10);
  renderCollectionMemberPicker();
}
function colPickerBack() { colPickerLevel = 'authors'; renderCollectionMemberPicker(); }
function colPickerToggle(type, id) {
  const col = collections.find(c => c.id === currentCollectionId);
  if (!col) return;
  const key = `${type}:${id}`;
  const idx = col.memberKeys.indexOf(key);
  if (idx >= 0) col.memberKeys.splice(idx, 1); else col.memberKeys.push(key);
  saveCollections();
  renderCollectionMemberPicker();
  renderCollectionPage();
}

function openAuthorBooks(authorId) {
  const normId = (authorId === GLOSSARY_AUTHOR_ID) ? authorId : parseInt(authorId, 10);
  pushNav(() => renderReferencesPage());
  currentAuthorId = normId;
  const isGlossaryGroup = normId === GLOSSARY_AUTHOR_ID;
  const books = allBooks.filter(b => isGlossaryGroup ? !allAuthors[b.author_id] : bookInAuthor(b, normId));
  const authorName = allAuthors[normId] || '';

  const authorIdArg = normId === GLOSSARY_AUTHOR_ID ? `'${GLOSSARY_AUTHOR_ID}'` : normId;
  let html = '';
  for (const item of groupBooksByParts(books)) {
    if (item.type === 'group') {
      html += `<div class="list-row" onclick="openBookGroup(${authorIdArg}, '${escapeHtml(item.root).replace(/'/g, "\\'")}')">
        <span style="font-size:20px;"><i class="ti ti-stack"></i></span>
        <div class="label">${escapeHtml(item.root)}<small>${item.books.length} أجزاء</small></div>
      </div>`;
    } else {
      html += `<div class="list-row" onclick="openBookIndex(${item.book.id})">
        <span style="font-size:20px;"><i class="ti ti-book"></i></span>
        <div class="label">${escapeHtml(item.book.name)}</div>
      </div>`;
    }
  }
  document.getElementById('authorBooksPage').innerHTML = html || '<div class="empty-state"><div class="ic"><i class="ti ti-book"></i></div>لا توجد كتب</div>';

  if (!isGlossaryGroup) {
    officialSitesFor(normId).slice().reverse().forEach(st => {
      const a = document.createElement('a');
      a.href = st.u || ('https://www.google.com/search?q=' + encodeURIComponent(st.n + ' ' + authorName));
      a.target = '_blank'; a.rel = 'noopener'; a.className = 'ref-link-row';
      a.innerHTML = '<i class="ti ti-world"></i> ' + escapeHtml(st.n);
      document.getElementById('authorBooksPage').prepend(a);
    });
  }
  showBreadcrumb([authorName]);
  switchPage('authorBooksPage', authorName);
  booksTabActive = true;
  lastBooksPageId = 'authorBooksPage';
  lastBooksPageTitle = authorName;
  lastBooksBreadcrumb = [authorName];
  registerView(() => openAuthorBooks(authorId));
}

const TOPIC_TREE_ELIGIBLE_IDS = new Set([68,69,70,71,72,73,74,75,76,77,78,79,80,81,90, 14,15,16]);
function isTopicTreeEligible(groupBooks) {
  return groupBooks.length > 0 && groupBooks.every(b => TOPIC_TREE_ELIGIBLE_IDS.has(b.id));
}

let topicViewMode = {};
let topicTreeCache = {};
let topicNodeOpenState = {};

function openBookGroup(authorId, root) {
  const normId = (authorId === GLOSSARY_AUTHOR_ID) ? authorId : parseInt(authorId, 10);
  pushNav(() => openAuthorBooks(authorId));
  const isGlossaryGroup = normId === GLOSSARY_AUTHOR_ID;
  const books = allBooks.filter(b => isGlossaryGroup ? !allAuthors[b.author_id] : bookInAuthor(b, normId));
  const groupBooks = books.filter(b => bookRootName(b.name) === root);
  const authorName = allAuthors[normId] || '';

  currentTopicGroupBooks = groupBooks;
  currentTopicGroupRoot = root;
  currentTopicGroupAuthorName = authorName;
  renderBookGroupPage();
  showBreadcrumb([authorName, root]);
  switchPage('authorBooksPage', root);
  booksTabActive = true;
  lastBooksPageId = 'authorBooksPage';
  lastBooksPageTitle = root;
  lastBooksBreadcrumb = [authorName, root];
  registerView(() => openBookGroup(authorId, root));
}

let currentTopicGroupBooks = [];
let currentTopicGroupRoot = '';
let currentTopicGroupAuthorName = '';

function renderBookGroupPage() {
  const groupBooks = currentTopicGroupBooks;
  const root = currentTopicGroupRoot;
  const eligible = isTopicTreeEligible(groupBooks);
  const mode = eligible ? (topicViewMode[root] || 'parts') : 'parts';

  let html = '';
  if (eligible) {
    html += `<div class="topic-toolbar">
      <div class="topic-toggle-group">
        <button class="topic-toggle-btn ${mode === 'parts' ? 'active' : ''}" onclick="setTopicViewMode('parts')">تصنيف الأجزاء</button>
        <button class="topic-toggle-btn ${mode === 'topic' ? 'active' : ''}" onclick="setTopicViewMode('topic')">تصنيف موضوعي</button>
      </div>
      ${mode === 'topic' ? `<button class="topic-expand-btn" onclick="expandAllTopicNodes()"><i class="ti ti-maximize"></i> فتح الكل</button>
      <button class="topic-expand-btn" onclick="collapseAllTopicNodes()"><i class="ti ti-minimize"></i> طي الكل</button>` : ''}
    </div>`;
  }

  if (mode === 'topic') {
    if (!topicTreeCache[root]) topicTreeCache[root] = buildTopicTree(groupBooks);
    html += renderTopicTreeHtml(topicTreeCache[root], root);
  } else {
    for (const book of groupBooks) {
      html += `<div class="list-row" onclick="openBookIndex(${book.id})">
        <span style="font-size:20px;"><i class="ti ti-book"></i></span>
        <div class="label">${escapeHtml(book.name)}</div>
      </div>`;
    }
  }
  document.getElementById('authorBooksPage').innerHTML = html || '<div class="empty-state"><div class="ic"><i class="ti ti-book"></i></div>لا توجد أجزاء</div>';
}

function setTopicViewMode(mode) {
  topicViewMode[currentTopicGroupRoot] = mode;
  renderBookGroupPage();
}

function topicNodeId(root, bookIdx, faslIdx) {
  return faslIdx == null ? `${root}::b${bookIdx}` : `${root}::b${bookIdx}::f${faslIdx}`;
}

function renderTopicTreeHtml(tree, root) {
  let html = '';
  tree.forEach((book, bIdx) => {
    const nodeId = topicNodeId(root, bIdx);
    const isOpen = !!topicNodeOpenState[nodeId];
    const totalCount = book.faslList.reduce((s, f) => s + f.items.length, 0);
    html += `<div class="topic-node ${isOpen ? 'open' : ''}" data-node-id="${escapeHtml(nodeId)}">
      <div class="topic-node-header" onclick="toggleTopicNode('${escapeHtml(nodeId).replace(/'/g, "\\'")}')">
        <span class="chevron"><i class="ti ti-chevron-left"></i></span>
        <span class="label">${escapeHtml(book.name)}</span>
        <span class="count">${totalCount} مسألة</span>
      </div>
      <div class="topic-node-children">`;
    book.faslList.forEach((fasl, fIdx) => {
      if (fasl.name) {
        const first = fasl.items[0];
        if (first) {
          html += `<div class="topic-leaf topic-fasl-link" onclick="event.stopPropagation(); openReader(${first.bookId}, ${first.sectionIdx})"><span class="label">${escapeHtml(fasl.name)}</span><span class="count">${fasl.items.length}</span></div>`;
        }
      } else {
        for (const item of fasl.items) {
          html += `<div class="topic-leaf" onclick="event.stopPropagation(); openReader(${item.bookId}, ${item.sectionIdx})">${escapeHtml(item.title)}</div>`;
        }
      }
    });
    html += `</div></div>`;
  });
  return html;
}

function toggleTopicNode(nodeId) {
  topicNodeOpenState[nodeId] = !topicNodeOpenState[nodeId];
  const el = document.querySelector(`[data-node-id="${CSS.escape(nodeId)}"]`);
  if (el) el.classList.toggle('open', topicNodeOpenState[nodeId]);
}

function expandAllTopicNodes() {
  document.querySelectorAll('.topic-node').forEach(el => {
    const id = el.getAttribute('data-node-id');
    topicNodeOpenState[id] = true;
    el.classList.add('open');
  });
}

function collapseAllTopicNodes() {
  document.querySelectorAll('.topic-node').forEach(el => {
    const id = el.getAttribute('data-node-id');
    topicNodeOpenState[id] = false;
    el.classList.remove('open');
  });
}

function loadBookSectionsRaw(bookId, bookTable) {
  if (bookSectionsCache.has(bookId)) return bookSectionsCache.get(bookId);
  const res = db.exec(`SELECT rowid, title, body, footnotes FROM "${bookTable}" ORDER BY rowid`);
  const sections = res.length ? res[0].values.map(r => buildSectionFromRow(r[0], r[1], r[2], r[3], bookId)) : [];
  bookSectionsCache.set(bookId, sections);
  return sections;
}
function loadBookSections(bookId, book) {
  currentBookTable = book.bk_table;
  currentSections = loadBookSectionsRaw(bookId, book.bk_table);
}

function openBookIndex(bookId) {
  const book = allBooks.find(b => b.id === bookId);
  const resolvedAuthorId = allAuthors[book.author_id] ? book.author_id : GLOSSARY_AUTHOR_ID;
  currentAuthorId = resolvedAuthorId;

  if (isThamraBook(bookId)) {
    pushNav(() => openAuthorBooks(resolvedAuthorId));
    openThamraIndex(bookId, book);
    return;
  }

  pushNav(() => openAuthorBooks(resolvedAuthorId));
  loadBookSections(bookId, book);
  if (!currentSections.length) {
    document.getElementById('readerPage').innerHTML = '<div class="empty-state"><div class="ic"><i class="ti ti-file-text"></i></div>هذا الكتاب فارغ</div>';
    switchPage('readerPage', book.name);
    return;
  }

  let startIdx = 0, startScrollTop = null;
  let pos = null;
  try { pos = JSON.parse(localStorage.getItem('rs_lastPosition') || 'null'); } catch (e) { pos = null; }
  if (pos && pos.bookId === bookId && typeof pos.sectionIdx === 'number') {
    startIdx = Math.max(0, Math.min(pos.sectionIdx, currentSections.length - 1));
    startScrollTop = (typeof pos.scrollTop === 'number' && (pos.mode || 'scroll') === readModeName()) ? pos.scrollTop : null;
  }

  renderContinuousReader(bookId, startIdx, { scrollTop: startScrollTop });
}

function scrollToMasalaWithinSection(sectionIdx, masalaNum, opts) {
  opts = opts || {};
  const blockSel = `#readerPage [data-section-idx="${sectionIdx}"].masala-block[data-masala="${masalaNum}"]`;
  if (rw) rwEnsure(sectionIdx);
  readerScrollToken++;
  (() => {
    let stableCount = 0, attempts = 0;
    const content = document.getElementById('content');
    const poll = () => {
      attempts++;
      const block = document.querySelector(blockSel);
      if (block) {
        const cr = content.getBoundingClientRect(), r = block.getBoundingClientRect();
        const want = opts.block === 'start' ? cr.top + 8 : (cr.top + cr.height / 2 - r.height / 2);
        const dev = r.top - want;
        if (attempts === 1 || Math.abs(dev) > 28) { block.scrollIntoView({ behavior: 'auto', block: opts.block || 'center' }); stableCount = 0; }
        else stableCount++;
      }
      if (stableCount >= 3 || attempts >= 14) {
        if (block) block.classList.add('fav-jump-highlight');
        return;
      }
      setTimeout(() => requestAnimationFrame(poll), 150);
    };
    requestAnimationFrame(poll);
  })();
}

function openReader(bookId, sectionIdx) {
  if (isThamraBook(bookId)) {
    openThamraReader(bookId, sectionIdx);
    return;
  }
  searchResultContext = null;
  const book = allBooks.find(b => b.id === bookId);
  const alreadyOpen = currentBookId === bookId && document.getElementById('readerPage').classList.contains('active') && currentSections.length;
  if (!alreadyOpen) {
    const resolvedAuthorId = allAuthors[book.author_id] ? book.author_id : GLOSSARY_AUTHOR_ID;
    currentAuthorId = resolvedAuthorId;
    pushNav(() => openAuthorBooks(resolvedAuthorId));
    loadBookSections(bookId, book);
    renderContinuousReader(bookId, sectionIdx, { highlightTerm: pendingSearchTerm });
  } else {
    scrollToSection(sectionIdx, { instant: true, highlightTerm: pendingSearchTerm });
    saveLastPosition();
  }
}

const EAGER_RENDER_BUFFER = 2;
let readerLazyObserver = null;
let readerDelegationAttached = false;


const RW_THRESHOLD = 250, RW_HALF = 50, RW_CHUNK = 40, RW_MAX = 170, RW_MARGIN = 2600;
let rw = null;
function rwEstH(sec) { return Math.max(90, Math.min(3200, (sec.body ? sec.body.length : 0) * 0.35)); }
function rwInit(bookId) {
  const n = currentSections.length, pre = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) pre[i + 1] = pre[i] + rwEstH(currentSections[i]) + 130;
  rw = { bookId, lo: 0, hi: 0, pre };
}
function rwSectionsHtml(from, to, book) {
  let html = '';
  const bookId = book.id, n = currentSections.length;
  for (let idx = from; idx < to; idx++) {
    const sec = currentSections[idx];
    const estH = rwEstH(sec);
    html += `<div class="reader-section" data-section-idx="${idx}" id="rs-sec-${idx}" style="contain-intrinsic-height:auto ${Math.round(estH + 100)}px">
      <h2 class="section-title" onclick="openTocDrawer()"><span>${escapeHtml(urwaSecTitle(book, idx, sec.title))}</span><i class="ti ti-list-tree sec-title-ic"></i><i class="ti ti-file-plus sec-title-ic sec-add-cb" title="إضافة هذا الباب لكتابي" onclick="event.stopPropagation(); addSectionToCustomBook(${idx})"></i><i class="ti ti-star${isFavorite(bookId, idx) ? ' sec-fav-active' : ''} sec-title-ic sec-fav-toggle" title="تفضيل هذا القسم" onclick="event.stopPropagation(); toggleSectionFavoriteByIdx(${idx})"></i></h2>
      <div class="body-text body-text-slot ${fontFamily}" style="font-size:${fontSize}px; min-height:${estH}px;" data-rendered="0" data-section-idx="${idx}"></div>
      <div class="pm-nav">
        <button class="pm-btn" ${idx <= 0 ? 'disabled' : ''} onclick="navSection(-1)"><i class="ti ti-chevron-right"></i> السابق</button>
        <span class="pm-count">${idx + 1} / ${n}</span>
        <button class="pm-btn" ${idx >= n - 1 ? 'disabled' : ''} onclick="navSection(1)">التالي <i class="ti ti-chevron-left"></i></button>
      </div>
    </div>`;
  }
  return html;
}
function rwHas(idx) { return !!rw && idx >= rw.lo && idx < rw.hi; }
function rwActive() { return !!rw && rw.bookId === currentBookId && !!document.getElementById('rwTop'); }
function rwObserveNew(from, to) {
  if (!readerLazyObserver) return;
  for (let i = from; i < to; i++) {
    const slot = document.querySelector(`#readerPage .body-text-slot[data-section-idx="${i}"]`);
    if (slot && slot.dataset.rendered === '0') readerLazyObserver.observe(lazyObserveTarget(slot));
  }
}
function rwRemoveSections(from, to) {
  for (let i = from; i < to; i++) {
    const el = document.getElementById(`rs-sec-${i}`);
    if (!el) continue;
    if (readerLazyObserver) { try { readerLazyObserver.unobserve(el); } catch (e) {} }
    el.remove();
  }
}
function rwSetSpacers() {
  const n = currentSections.length;
  const t = document.getElementById('rwTop'), b = document.getElementById('rwBot');
  if (t) t.style.height = Math.round(rw.pre[rw.lo]) + 'px';
  if (b) b.style.height = Math.round(rw.pre[n] - rw.pre[rw.hi]) + 'px';
}
function rwExtend(dir, count) {
  if (!rwActive()) return;
  const content = document.getElementById('content');
  const book = allBooks.find(b => b.id === currentBookId); if (!book) return;
  const n = currentSections.length;
  if (dir < 0) {
    const nlo = Math.max(0, rw.lo - count); if (nlo === rw.lo) return;
    const anchor = document.getElementById(`rs-sec-${rw.lo}`);
    const before = anchor ? anchor.getBoundingClientRect().top : 0;
    document.getElementById('rwTop').insertAdjacentHTML('afterend', rwSectionsHtml(nlo, rw.lo, book));
    const oldLo = rw.lo; rw.lo = nlo; rwSetSpacers(); rwObserveNew(nlo, oldLo);
    if (anchor) content.scrollTop += anchor.getBoundingClientRect().top - before;
  } else {
    const nhi = Math.min(n, rw.hi + count); if (nhi === rw.hi) return;
    document.getElementById('rwBot').insertAdjacentHTML('beforebegin', rwSectionsHtml(rw.hi, nhi, book));
    const oldHi = rw.hi; rw.hi = nhi; rwSetSpacers(); rwObserveNew(oldHi, nhi);
  }
  rwTrim(dir);
}
function rwTrim(dir) {
  if (!rwActive() || rw.hi - rw.lo <= RW_MAX) return;
  const content = document.getElementById('content');
  const keep = RW_MAX - RW_CHUNK;
  if (dir > 0) {
    const nlo = Math.min(rw.hi - keep, currentSectionIndex - 25); if (nlo <= rw.lo) return;
    const anchor = document.getElementById(`rs-sec-${nlo}`);
    const before = anchor ? anchor.getBoundingClientRect().top : 0;
    rwRemoveSections(rw.lo, nlo); rw.lo = nlo; rwSetSpacers();
    if (anchor) content.scrollTop += anchor.getBoundingClientRect().top - before;
  } else {
    const nhi = Math.max(rw.lo + keep, currentSectionIndex + 25); if (nhi >= rw.hi) return;
    rwRemoveSections(nhi, rw.hi); rw.hi = nhi; rwSetSpacers();
  }
}
function rwEnsure(idx) {
  if (!rwActive() || rwHas(idx)) return;
  const n = currentSections.length;
  idx = Math.max(0, Math.min(idx, n - 1));
  if (rwHas(idx)) return;
  if (idx < rw.lo && rw.lo - idx <= RW_CHUNK * 2) { rwExtend(-1, rw.lo - idx + 6); return; }
  if (idx >= rw.hi && idx - rw.hi < RW_CHUNK * 2) { rwExtend(1, idx - rw.hi + 7); return; }
  const book = allBooks.find(b => b.id === currentBookId); if (!book) return;
  const page = document.getElementById('readerPage'), content = document.getElementById('content');
  const lo = Math.max(0, idx - RW_HALF), hi = Math.min(n, idx + RW_HALF + 1);
  lockActiveSectionTracking(400);
  readerScrollToken++;
  rwRemoveSections(rw.lo, rw.hi);
  rw.lo = lo; rw.hi = hi;
  document.getElementById('rwTop').insertAdjacentHTML('afterend', rwSectionsHtml(lo, hi, book));
  rwSetSpacers(); rwObserveNew(lo, hi);
  content.scrollTop = Math.max(0, rw.pre[idx]);
}
let rwCheckRaf = 0;
function rwCheck() {
  if (!rw || rwCheckRaf || isPageFlipMode()) return;
  rwCheckRaf = requestAnimationFrame(() => {
    rwCheckRaf = 0;
    if (!rwActive() || isPageFlipMode() || !document.getElementById('readerPage').classList.contains('active')) return;
    const content = document.getElementById('content');
    const cr = content.getBoundingClientRect();
    const t = document.getElementById('rwTop').getBoundingClientRect();
    const b = document.getElementById('rwBot').getBoundingClientRect();
    if (rw.lo > 0 && cr.top - t.bottom < RW_MARGIN && Date.now() >= programmaticScrollLockUntil) rwExtend(-1, RW_CHUNK);
    else if (rw.hi < currentSections.length && b.top - cr.bottom < RW_MARGIN) rwExtend(1, RW_CHUNK);
  });
}

function renderContinuousReader(bookId, targetIdx, opts) {
  opts = opts || {};
  currentBookId = bookId;
  currentSectionIndex = Math.max(0, Math.min(targetIdx, currentSections.length - 1));
  const book = allBooks.find(b => b.id === bookId);

  const _n = currentSections.length;
  let html = '';
  if (_n > RW_THRESHOLD) {
    rwInit(bookId);
    const lo = Math.max(0, currentSectionIndex - RW_HALF), hi = Math.min(_n, currentSectionIndex + RW_HALF + 1);
    rw.lo = lo; rw.hi = hi;
    html = `<div id="rwTop" class="rw-spacer" style="height:${Math.round(rw.pre[lo])}px"></div>${rwSectionsHtml(lo, hi, book)}<div id="rwBot" class="rw-spacer" style="height:${Math.round(rw.pre[_n] - rw.pre[hi])}px"></div>`;
  } else {
    rw = null;
    html = rwSectionsHtml(0, _n, book);
  }
  { const _c = document.getElementById('content'); if (_c) _c.style.overflowAnchor = rw ? 'none' : ''; }
  document.getElementById('readerPage').innerHTML = html;
  document.getElementById('readerPage').classList.toggle('page-mode', isPageFlipMode());
  attachReaderDelegationOnce();

  const from = Math.max(0, currentSectionIndex - EAGER_RENDER_BUFFER);
  const to = Math.min(currentSections.length - 1, currentSectionIndex + EAGER_RENDER_BUFFER);
  for (let i = from; i <= to; i++) ensureSectionRendered(i);
  setupLazyReaderObserver();
  recomputeCurrentSectionScrollBounds();

  switchPage('readerPage', book.name);
  booksTabActive = true;
  lastBooksPageId = 'readerPage';
  lastBooksPageTitle = book.name;
  registerView((snap) => {
    const bk = allBooks.find(b => b.id === bookId);
    if (!bk) { renderTabRoot(currentTab); return; }
    loadBookSections(bookId, bk);
    if (!currentSections.length) { renderTabRoot(currentTab); return; }
    renderContinuousReader(bookId, snap && typeof snap.idx === 'number' ? snap.idx : currentSectionIndex,
      { scrollTop: snap && typeof snap.scrollTop === 'number' ? snap.scrollTop : null });
    if (snap && 'srcCtx' in snap) searchResultContext = snap.srcCtx;
  }, {
    handlesScroll: true,
    snapshot: () => ({ idx: currentSectionIndex, scrollTop: document.getElementById('content').scrollTop, srcCtx: searchResultContext })
  });

  const authorLabel = allAuthors[book.author_id] || allAuthors[GLOSSARY_AUTHOR_ID];
  const initialBreadcrumbTitle = nearestNonEmptySectionTitle(currentSectionIndex);
  setReadingHeader(initialBreadcrumbTitle, book.name);
  showBreadcrumb([book.name]);
  lastBooksBreadcrumb = [authorLabel, book.name, initialBreadcrumbTitle];

  document.getElementById('urwaSettingsBtn').style.display = 'none';
  updateJuristSettingsBtnState();
  updateReaderFabState();
  showReaderFab();

  const content = document.getElementById('content');
  lockActiveSectionTracking(150);
  if (isPageFlipMode()) {
    pmShowSection(currentSectionIndex);
    if (typeof opts.scrollTop === 'number' && opts.scrollTop > 0) setTimeout(() => { content.scrollTop = opts.scrollTop; }, 60);
    if (opts.highlightTerm) applyPendingSearchHighlight(currentSectionIndex);
    saveLastPosition();
    return;
  }
  if (typeof opts.scrollTop === 'number') {
    content.scrollTop = opts.scrollTop;
    let attempts = 0;
    const _tok = readerScrollToken;
    const settle = () => {
      if (_tok !== readerScrollToken) return;
      attempts++;
      const el = document.getElementById(`rs-sec-${currentSectionIndex}`);
      if (el) {
        const c = document.getElementById('content');
        const cr = c.getBoundingClientRect(), er = el.getBoundingClientRect();
        if (er.bottom < cr.top + 20 || er.top > cr.bottom - 20) scrollToSectionElement(currentSectionIndex, false);
      }
      if (attempts < 6) setTimeout(() => requestAnimationFrame(settle), 150);
    };
    setTimeout(() => requestAnimationFrame(settle), 60);
  } else if (!opts.highlightTerm) {
    ensureSectionRendered(currentSectionIndex);
    scrollToSectionElement(currentSectionIndex);
    let attempts = 0;
    const _tok = readerScrollToken;
    const settle = () => {
      if (_tok !== readerScrollToken) return;
      attempts++;
      scrollToSectionElement(currentSectionIndex, false);
      if (attempts < 6) setTimeout(() => requestAnimationFrame(settle), 150);
    };
    setTimeout(() => requestAnimationFrame(settle), 260);
  } else {
    ensureSectionRendered(currentSectionIndex);
    scrollToSectionElement(currentSectionIndex, false);
  }
  if (opts.highlightTerm) applyPendingSearchHighlight(currentSectionIndex);
  saveLastPosition();
}

function ensureSectionRendered(idx) {
  if (rw && !rwHas(idx)) rwEnsure(idx);
  const slot = document.querySelector(`#readerPage .body-text-slot[data-section-idx="${idx}"]`);
  if (!slot || slot.dataset.rendered === '1') return;
  const sec = currentSections[idx];
  if (!sec) return;
  slot.innerHTML = renderBodyHtml(sec.body, sec.footnotes, idx);
  slot.style.minHeight = '';
  slot.dataset.rendered = '1';
  if (readerLazyObserver) readerLazyObserver.unobserve(lazyObserveTarget(slot));
  if (currentBookId === SHARH_AWDAH_BOOK_ID && sec.rowid === 1 && sharhAwdahIntro) {
    slot.insertAdjacentHTML('beforeend', `
      <div class="sharh-intro-block">
        <div class="sharh-intro-title" onclick="this.parentElement.classList.toggle('open')">
          <i class="ti ti-notebook"></i> تمهيد شرح أوضح الوسائل
        </div>
        <div class="sharh-intro-body">${escapeHtml(sharhAwdahIntro).replace(/\n/g, '<br>')}</div>
      </div>`);
  }
}

const UNRENDER_DISTANCE = 18;
let unrenderSweepTimer = null;
function scheduleDistantSectionsUnrender() {
  clearTimeout(unrenderSweepTimer);
  unrenderSweepTimer = setTimeout(unrenderDistantSections, 900);
}
function unrenderDistantSections() {
  if (!document.getElementById('readerPage').classList.contains('active')) return;
  const slots = document.querySelectorAll('#readerPage .body-text-slot[data-rendered="1"]');
  slots.forEach(slot => {
    const idx = parseInt(slot.dataset.sectionIdx, 10);
    if (Math.abs(idx - currentSectionIndex) <= UNRENDER_DISTANCE) return;
    const actualHeight = slot.offsetHeight;
    if (actualHeight > 0) slot.style.minHeight = actualHeight + 'px';
    slot.innerHTML = '';
    slot.dataset.rendered = '0';
    if (readerLazyObserver) readerLazyObserver.observe(lazyObserveTarget(slot));
  });
}

function refreshAllRenderedSections() {
  document.querySelectorAll('#readerPage .body-text-slot[data-rendered="1"]').forEach(slot => {
    const idx = parseInt(slot.dataset.sectionIdx, 10);
    const sec = currentSections[idx];
    if (!sec) return;
    slot.innerHTML = renderBodyHtml(sec.body, sec.footnotes, idx);
  });
  recomputeCurrentSectionScrollBounds();
  updateScrollbar();
}

function lazyObserveTarget(slot) { return slot.closest('.reader-section') || slot; }
function setupLazyReaderObserver() {
  if (readerLazyObserver) readerLazyObserver.disconnect();
  const content = document.getElementById('content');
  readerLazyObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) ensureSectionRendered(parseInt(entry.target.dataset.sectionIdx, 10));
    });
  }, { root: content, rootMargin: '1200px 0px 1200px 0px' });
  document.querySelectorAll('#readerPage .body-text-slot[data-rendered="0"]').forEach(slot => readerLazyObserver.observe(lazyObserveTarget(slot)));
}

let readerScrollToken = 0;
let programmaticScrollLockUntil = 0;
function lockActiveSectionTracking(durationMs) {
  programmaticScrollLockUntil = Date.now() + durationMs;
}

function scrollToSectionElement(idx, smooth) {
  if (rw && !rwHas(idx) && !isPageFlipMode()) rwEnsure(idx);
  const content = document.getElementById('content');
  const el = document.getElementById(`rs-sec-${idx}`);
  if (!el) return;
  if (isPageFlipMode()) { if (!el.classList.contains('pm-current')) pmShowSection(idx); return; }
  const top = Math.max(0, el.offsetTop - 12);
  if (smooth) {
    lockActiveSectionTracking(500);
    content.scrollTo({ top, behavior: 'smooth' });
  } else {
    lockActiveSectionTracking(120);
    content.scrollTop = top;
  }
}

function scrollToSectionSettled(idx, smooth) {
  if (isPageFlipMode()) { scrollToSectionElement(idx, false); return; }
  ensureSectionRendered(idx);
  scrollToSectionElement(idx, smooth);
  let attempts = 0;
  const _tok = readerScrollToken;
  const settle = () => {
    if (_tok !== readerScrollToken) return;
    attempts++;
    scrollToSectionElement(idx, false);
    if (attempts < 6) setTimeout(() => requestAnimationFrame(settle), 150);
  };
  setTimeout(() => requestAnimationFrame(settle), smooth ? 260 : 60);
}

function scrollToSection(idx, opts) {
  opts = opts || {};
  idx = Math.max(0, Math.min(idx, currentSections.length - 1));
  if (isPageFlipMode()) {
    pmShowSection(idx);
    updateReaderFabState();
    showReaderFab();
    updateBreadcrumbForCurrentSection();
    if (opts.highlightTerm) applyPendingSearchHighlight(idx);
    if (opts.direction) triggerPageTransition(opts.direction);
    return;
  }
  const from = Math.max(0, idx - EAGER_RENDER_BUFFER);
  const to = Math.min(currentSections.length - 1, idx + EAGER_RENDER_BUFFER);
  for (let i = from; i <= to; i++) ensureSectionRendered(i);
  currentSectionIndex = idx;
  recomputeCurrentSectionScrollBounds();
  if (opts.highlightTerm) {
    ensureSectionRendered(idx);
    scrollToSectionElement(idx, false);
  } else {
    scrollToSectionSettled(idx, !opts.instant);
  }
  updateReaderFabState();
  showReaderFab();
  updateBreadcrumbForCurrentSection();
  if (opts.highlightTerm) applyPendingSearchHighlight(idx);
  if (opts.direction) triggerPageTransition(opts.direction);
}

function updateReaderFabState() {
  const posBtn = document.getElementById('readerFabPosition');
  if (posBtn) posBtn.classList.toggle('tracked', !isThamraBook(currentBookId) && getTrackedBookIds().has(Number(currentBookId)));
}

function readerFabTocClick() {
  if (document.getElementById('customBookPage').classList.contains('active')) { openCbToc(); return; }
  openTocDrawer();
}

function openTocDrawer() {
  const isTh = isThamraBook(currentBookId);
  if (!isTh && !currentSections.length) return;
  if (isTh && !currentThamraSections.length) return;
  const book = allBooks.find(b => b.id === currentBookId);
  document.getElementById('tocDrawerTitle').textContent = book ? book.name : '';
  const inp = document.getElementById('tocBookSearch');
  if (inp) { inp.value = ''; inp.placeholder = 'ابحث في عناوين هذا الكتاب...'; }
  document.getElementById('tocDrawerList').innerHTML = '<div class="toc-item toc-empty">جارٍ تحميل الفهرس…</div>';
  document.getElementById('tocOverlay').classList.add('show');
  requestAnimationFrame(() => setTimeout(renderTocList, 0));
}
function closeTocDrawer() {
  document.getElementById('tocOverlay').classList.remove('show');
}
function tocThamraClick(idx) {
  closeTocDrawer();
  if (isThamraContinuousMode()) {
    currentThamraSectionIndex = idx;
    const el = document.querySelector(`#readerPage [data-thamra-section-idx="${idx}"]`);
    if (el) el.scrollIntoView({ behavior: 'auto', block: 'start' });
    const book = allBooks.find(b => b.id === currentBookId);
    const sec = currentThamraSections[idx];
    if (book && sec) { const al = allAuthors[book.author_id] || allAuthors[GLOSSARY_AUTHOR_ID]; showBreadcrumb([al, book.name, sec.text]); }
  } else {
    navThamraSection(idx - currentThamraSectionIndex);
  }
}
const TOC_CHUNK = 60, TOC_MAX_RESULTS = 300;
let _tocState = null, _tocNormCache = null, _tocScrollBound = false, _tocSearchTimer = 0;
function tocData() {
  if (isThamraBook(currentBookId)) return currentThamraSections.map((sec, i) => ({ t: 'th', i, sec }));
  const book = allBooks.find(b => b.id === currentBookId);
  const origToc = (typeof URWA_ORIG_TOC !== 'undefined' && book) ? URWA_ORIG_TOC[book.bk_table] : null;
  if (origToc && isUrwaBook(currentBookId)) return origToc.map((e, i) => ({ t: 'u', i, e }));
  return currentSections.map((sec, i) => ({ t: 's', i, sec }));
}
function tocActiveIndex(data) {
  if (!data.length) return -1;
  if (data[0].t === 'th') return currentThamraSectionIndex;
  if (data[0].t === 'u') { let a = -1; data.forEach((d, i) => { if (d.e[2] - 1 <= currentSectionIndex) a = i; }); return a; }
  return currentSectionIndex;
}
function tocTitleOf(d) { return d.t === 'u' ? d.e[0] : (d.t === 'th' ? (d.sec.text || '') : (d.sec.title || '')); }
function tocRowHtml(d, active, words) {
  const hl = (t) => words && words.length ? highlightTermMulti(escapeHtml(t || ''), words) : escapeHtml(t || '');
  if (d.t === 'th') {
    const sub = d.sec.itemType === 'subheading' ? ' toc-sub' : '';
    return `<div class="toc-item${sub} ${active ? 'active' : ''}" onclick="tocThamraClick(${d.i})">${hl(d.sec.text)}</div>`;
  }
  if (d.t === 'u') return `<div class="toc-item toc-urwa ${active ? 'active' : ''}" onclick="tocItemClick(${Math.max(0, d.e[2] - 1)})"><span class="toc-t">${hl(d.e[0])}</span><span class="toc-pg">${d.e[1]}</span></div>`;
  return `<div class="toc-item ${active ? 'active' : ''}" onclick="tocItemClick(${d.i})">${hl(d.sec.title)}</div>`;
}
function tocPaint(from, to) {
  const st = _tocState; if (!st) return;
  const box = document.getElementById('tocDrawerList');
  let h = '';
  for (let k = from; k < to; k++) h += tocRowHtml(st.data[k], k === st.active, st.words);
  box.innerHTML = h;
  st.lo = from; st.hi = to;
}
function tocOnScroll() {
  const st = _tocState; if (!st || st.words) return;
  const box = document.getElementById('tocDrawerList');
  if (box.scrollTop < 240 && st.lo > 0) {
    const from = Math.max(0, st.lo - TOC_CHUNK), n = st.lo - from;
    let h = ''; for (let k = from; k < st.lo; k++) h += tocRowHtml(st.data[k], k === st.active, null);
    const before = box.scrollHeight;
    box.insertAdjacentHTML('afterbegin', h);
    box.scrollTop += box.scrollHeight - before;
    st.lo = from;
  } else if (box.scrollTop + box.clientHeight > box.scrollHeight - 320 && st.hi < st.data.length) {
    const to = Math.min(st.data.length, st.hi + TOC_CHUNK);
    let h = ''; for (let k = st.hi; k < to; k++) h += tocRowHtml(st.data[k], k === st.active, null);
    box.insertAdjacentHTML('beforeend', h);
    st.hi = to;
  }
}
function renderTocList() {
  const box = document.getElementById('tocDrawerList');
  const data = tocData();
  const active = tocActiveIndex(data);
  _tocState = { data, active, lo: 0, hi: 0, words: null };
  if (!_tocScrollBound) {
    _tocScrollBound = true;
    let raf = 0;
    box.addEventListener('scroll', () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; tocOnScroll(); }); }, { passive: true });
  }
  const lo = active >= 0 ? Math.max(0, active - 25) : 0;
  const hi = Math.min(data.length, Math.max(lo + 70, active + 45));
  tocPaint(lo, hi);
  const ae = box.querySelector('.toc-item.active');
  if (ae) box.scrollTop = Math.max(0, ae.offsetTop - box.clientHeight / 2 + ae.offsetHeight / 2); else box.scrollTop = 0;
}
function tocThamraItemHtml(sec, idx, active) { return tocRowHtml({ t: 'th', i: idx, sec }, active, null); }

function tocBookSearchRun(q) {
  clearTimeout(_tocSearchTimer);
  _tocSearchTimer = setTimeout(() => tocBookSearchNow(q), 130);
}
function tocBookSearchNow(q) {
  const box = document.getElementById('tocDrawerList');
  const term = normalizeArabic(q || '').trim();
  if (!term) { renderTocList(); return; }
  const words = term.split(/\s+/).filter(Boolean);
  const data = tocData();
  if (!_tocNormCache || _tocNormCache.bookId !== currentBookId || _tocNormCache.n !== data.length) {
    _tocNormCache = { bookId: currentBookId, n: data.length, arr: data.map(d => normalizeArabic(tocTitleOf(d))) };
  }
  const found = [];
  let more = false;
  for (let i = 0; i < data.length; i++) {
    const n = _tocNormCache.arr[i];
    if (words.every(w => n.includes(w))) { if (found.length >= TOC_MAX_RESULTS) { more = true; break; } found.push(data[i]); }
  }
  _tocState = { data: found, active: -1, lo: 0, hi: found.length, words };
  let h = '';
  found.forEach(d => { h += tocRowHtml(d, false, words); });
  if (more) h += `<div class="toc-item toc-empty">عُرض أول ${TOC_MAX_RESULTS} عنواناً — أضف كلمة لتضييق البحث</div>`;
  box.innerHTML = h || '<div class="toc-item toc-empty">لا توجد عناوين مطابقة</div>';
  box.scrollTop = 0;
}
function tocItemClick(idx) {
  closeTocDrawer();
  scrollToSection(idx, { instant: false });
  saveLastPosition();
}

function attachReaderDelegationOnce() {
  if (readerDelegationAttached) return;
  readerDelegationAttached = true;
  const readerPage = document.getElementById('readerPage');
  readerPage.addEventListener('click', (e) => {
    const block = e.target.closest('.masala-block');
    if (block && !e.target.closest('.masala-tools')) {
      const wasTouched = block.classList.contains('touched');
      readerPage.querySelectorAll('.masala-block.touched').forEach(x => x.classList.remove('touched'));
      if (!wasTouched) block.classList.add('touched');
      return;
    }
    if (!block) readerPage.querySelectorAll('.masala-block.touched').forEach(x => x.classList.remove('touched'));
  });
}

(function setupThamraToolsTouch() {
  document.addEventListener('click', (e) => {
    const readerPage = document.getElementById('readerPage');
    if (!readerPage || !readerPage.contains(e.target)) return;
    const item = e.target.closest('.thamra-item[data-ext-key]');
    if (item && e.target.closest('.thamra-item-tools, .note-accordion, textarea, .note-display')) return;
    const wasTouched = item ? item.classList.contains('touched') : false;
    readerPage.querySelectorAll('.thamra-item.touched').forEach(x => x.classList.remove('touched'));
    if (item && !wasTouched) item.classList.add('touched');
  });
})();


const THAMRA_BOOK_TABLE = 'bk_thamra';
let currentThamraItems = [];
let currentThamraSections = [];
let currentThamraSectionIndex = null;
let thamraItemsCache = null;

const FULL_ROW_QA_BOOK_IDS = new Set([56, 102, 103, 104, 105, 106, 107, 108, 109]);
function isFullRowQaBook(bookId) {
  return FULL_ROW_QA_BOOK_IDS.has(bookId);
}
const FULL_ROW_QA_START_RE = /^\s*(?:السؤال|سؤال)\s*:/;
function normalizeFullRowQaBody(body, rowid) {
  if (!body || !FULL_ROW_QA_START_RE.test(body)) return body;
  return body.replace(FULL_ROW_QA_START_RE, `مسألة ${rowid}: `);
}


const SHORT_QA_BOOK_IDS = new Set([7, 9, 33, 62]);
function isShortQaBook(bookId) {
  return SHORT_QA_BOOK_IDS.has(bookId);
}
const SHORT_QA_ITEM_RE = /(^|\n)(\s*)س(?:[\u200e\u200f]?[0-9\u06F0-\u06F9\u0660-\u0669]*)(\s*):/g;
function normalizeShortQaBody(body, rowid) {
  if (!body) return body;
  let counter = 0;
  return body.replace(SHORT_QA_ITEM_RE, (whole, pre, sp1, sp2) => {
    counter++;
    return `${pre}${sp1}مسألة ${rowid * 1000 + counter}${sp2}:`;
  });
}

const BOOK23_FALSE_REF_FIND = 'كما تقدم في (مسألة 802)';
const BOOK23_FALSE_REF_REPLACE = 'كما تقدم في مسألة رقم 802';
function fixBook23FalseReference(body) {
  if (!body || body.indexOf(BOOK23_FALSE_REF_FIND) === -1) return body;
  return body.split(BOOK23_FALSE_REF_FIND).join(BOOK23_FALSE_REF_REPLACE);
}

function buildSectionFromRow(rowid, title, rawBody, rawFootnotes, bookId) {
  let body = rawBody || '';
  if (isFullRowQaBook(bookId)) body = normalizeFullRowQaBody(body, rowid);
  if (isShortQaBook(bookId)) body = normalizeShortQaBody(body, rowid);
  if (bookId === 23) body = fixBook23FalseReference(body);
  const { body: finalBody, footnotesJson } = extractBodyFootnotesIfNeeded(body, rawFootnotes, bookId);
  const footnotes = footnotesJson
    ? parseFootnotes(JSON.stringify(footnotesJson), isUrwaBook(bookId))
    : parseFootnotes(rawFootnotes, isUrwaBook(bookId));
  return { rowid, title: title || '(بدون عنوان)', body: finalBody, footnotes };
}

function isThamraBook(bookId) {
  const book = allBooks.find(b => b.id === bookId);
  return !!book && book.bk_table === THAMRA_BOOK_TABLE;
}

let bookRowsCache = {};
let masalaPoolCache = {};

function getBookOrderedRawRows(bookId) {
  if (bookRowsCache[bookId]) return bookRowsCache[bookId];
  if (!db) return [];
  const book = allBooks.find(b => b.id === bookId);
  let rows = [];
  if (book && !isThamraBook(bookId)) {
    try {
      const res = db.exec(`SELECT rowid, title, body, footnotes FROM "${book.bk_table}" ORDER BY rowid`);
      rows = res.length ? res[0].values : [];
    } catch (e) { rows = []; }
  }
  bookRowsCache[bookId] = rows;
  return rows;
}

function getProcessedSection(bookId, sectionIdx) {
  const rows = getBookOrderedRawRows(bookId);
  const r = rows[sectionIdx];
  if (!r) return null;
  return buildSectionFromRow(r[0], r[1], r[2], r[3], bookId);
}

function getBookMasalaPool(bookId) {
  if (masalaPoolCache[bookId]) return masalaPoolCache[bookId];
  if (!db || isThamraBook(bookId)) return (masalaPoolCache[bookId] = []);
  const rows = getBookOrderedRawRows(bookId);
  const patterns = getMarkerPatterns(bookId);
  const pool = [];
  rows.forEach((r, sectionIdx) => {
    const sec = buildSectionFromRow(r[0], r[1], r[2], r[3], bookId);
    if (!sec.body || !patterns.test.test(sec.body)) return;
    const parts = splitByMarker(sec.body, patterns.src, patterns.capture, bookId);
    parts.forEach(part => {
      const m = part.match(patterns.capture);
      if (!m) return;
      const num = normalizeDigits(m[1] || m[2] || m[3] || m[4] || m[5]);
      if (!num) return;
      const text = part.trim();
      if (text.length < 12) return;
      pool.push({ bookId, sectionIdx, masalaNum: num, sectionTitle: sec.title, snippet: text.replace(/\s+/g, ' ').slice(0, 260) });
    });
  });
  masalaPoolCache[bookId] = pool;
  return pool;
}

function expandPinToBookIds(p) {
  if (p.type === 'custombook') return [];
  if (p.type === 'book') {
    const id = parseInt(p.id, 10);
    return isNaN(id) ? [] : [id];
  }
  if (p.id === GLOSSARY_AUTHOR_ID) return allBooks.filter(b => !allAuthors[b.author_id]).map(b => b.id);
  const aid = parseInt(p.id, 10);
  return allBooks.filter(b => bookInAuthor(b, aid)).map(b => b.id);
}

function getCustomBookOwnMasalaPool(cb) {
  const pool = [];
  flattenCustomBookItems(cb).forEach(it => {
    if (it.type === 'masala' && it.masalaNum) {
      pool.push({ bookId: it.bookId, sectionIdx: it.sectionIdx, masalaNum: it.masalaNum, sectionTitle: it.title || '', snippet: (it.snippet || '').replace(/\s+/g, ' ').slice(0, 260) });
    }
  });
  return pool;
}

function getPinnedBookIds() {
  const set = new Set();
  pins.forEach(p => expandPinToBookIds(p).forEach(id => set.add(id)));
  return Array.from(set);
}

function pinsSignature() {
  return pins.map(p => p.type + ':' + p.id).sort().join('|');
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getDailyMasala(forceNew) {
  const sig = pinsSignature();
  if (!sig) return null;
  let stored = null;
  try { stored = JSON.parse(localStorage.getItem('rs_daily_masala') || 'null'); } catch (e) { stored = null; }
  if (!forceNew && stored && stored.date === todayStr() && stored.sig === sig && stored.pick) {
    return stored.pick;
  }
  let pool = [];
  getPinnedBookIds().forEach(id => { pool = pool.concat(getBookMasalaPool(id)); });
  pins.forEach(p => {
    if (p.type !== 'custombook') return;
    const cb = customBooks.find(b => b.id === p.id);
    if (cb) pool = pool.concat(getCustomBookOwnMasalaPool(cb));
  });
  if (!pool.length) return null;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  const book = allBooks.find(b => b.id === pick.bookId);
  const enriched = {
    bookId: pick.bookId, sectionIdx: pick.sectionIdx, masalaNum: pick.masalaNum,
    sectionTitle: pick.sectionTitle, snippet: pick.snippet,
    bookName: book ? book.name : '', authorName: book ? (allAuthors[book.author_id] || '') : ''
  };
  localStorage.setItem('rs_daily_masala', JSON.stringify({ date: todayStr(), sig, pick: enriched }));
  return enriched;
}

let dailyMasalaExpanded = false;
function computeDailyMasalaExpandedForThisVisit() {
  const seen = localStorage.getItem('rs_daily_seen');
  const today = todayStr();
  if (seen === today) return false;
  localStorage.setItem('rs_daily_seen', today);
  return true;
}
function toggleDailyMasalaExpanded() {
  dailyMasalaExpanded = !dailyMasalaExpanded;
  const card = document.querySelector('#homeExtras .daily-masala-card');
  if (card) {
    card.classList.toggle('dmc-expanded', dailyMasalaExpanded);
    card.classList.toggle('dmc-collapsed', !dailyMasalaExpanded);
    const sub = card.querySelector('.dmc-head-sub');
    if (sub) {
      const pick = getDailyMasala(false);
      sub.textContent = dailyMasalaExpanded ? (pick ? pick.bookName : '') : 'اضغط لعرضها';
    }
  } else {
    renderHomeExtras();
  }
}

function renderDailyMasalaHtml() {
  if (!pins.length) {
    return `<div class="list-row" onclick="openPinPicker()">
      <span style="font-size:20px;color:var(--text-dim);"><i class="ti ti-calendar-check"></i></span>
      <div class="label">مسألة اليوم<div class="sub">ثبّت مرجعاً أو كتاباً لتفعيلها</div></div>
      <span style="font-size:15px;color:var(--text-dim);"><i class="ti ti-chevron-left"></i></span>
    </div>`;
  }
  const pick = getDailyMasala(false);
  if (!pick) {
    return `<div class="list-row">
      <span style="font-size:20px;color:var(--text-dim);"><i class="ti ti-calendar-check"></i></span>
      <div class="label">مسألة اليوم<div class="sub">لا توجد مسائل مرقّمة بالكتب المثبَّتة حالياً</div></div>
    </div>`;
  }
  const _dailyBook = allBooks.find(b => b.id === pick.bookId);
  if (_dailyBook && !bookSectionsCache.has(pick.bookId)) {
    const _prefetch = () => { try { loadBookSectionsRaw(pick.bookId, _dailyBook.bk_table); } catch (e) {  } };
    if (window.requestIdleCallback) requestIdleCallback(_prefetch, { timeout: 800 }); else setTimeout(_prefetch, 120);
  }
  return renderDailyMasalaCardHtml(pick);
}

const DAILY_PREVIEW_MAX_CHARS = 140;
function truncateDailyPreview(text) {
  if (!text) return text;
  if (text.length <= DAILY_PREVIEW_MAX_CHARS) return text;
  return text.slice(0, DAILY_PREVIEW_MAX_CHARS).trim() + '…';
}

function renderDailyMasalaCardHtml(pick) {
  let content = null;
  try { content = getMasalaContentForCustomBook(pick.bookId, pick.sectionIdx, pick.masalaNum); } catch (e) { content = null; }
  const fullText = content ? content.body : pick.snippet;
  const wasTruncated = fullText && fullText.length > DAILY_PREVIEW_MAX_CHARS;
  const previewText = truncateDailyPreview(fullText);
  const bodyHtml = content ? formatCustomBookText(previewText, content.footnotes, 'daily', pick.bookId) : escapeHtml(previewText);
  const stateClass = dailyMasalaExpanded ? 'dmc-expanded' : 'dmc-collapsed';
  return `<div class="daily-masala-card ${stateClass}">
    <div class="dmc-head" onclick="toggleDailyMasalaExpanded()">
      <span class="dmc-title"><i class="ti ti-calendar-check"></i> مسألة اليوم</span>
      <span class="dmc-head-sub">${dailyMasalaExpanded ? escapeHtml(pick.bookName) : 'اضغط لعرضها'}</span>
      <span class="daily-shuffle-inline" title="مسألة أخرى" onclick="event.stopPropagation(); shuffleDailyMasala()"><i class="ti ti-refresh"></i></span>
      <span class="dmc-chevron"><i class="ti ti-chevron-down"></i></span>
    </div>
    <div class="dmc-collapsible">
      <div class="dmc-source" onclick="openDailyMasala()"><i class="ti ti-bookmark"></i> ${escapeHtml(pick.authorName)} — ${escapeHtml(pick.bookName)}</div>
      <div class="dmc-body-wrap ${wasTruncated ? 'dmc-faded' : ''}" onclick="openDailyMasala()">
        <div class="cb-item-body body-text ${fontFamily}" style="font-size:${fontSize}px;">${bodyHtml}</div>
      </div>
      <div class="dmc-readmore" onclick="openDailyMasala()">${wasTruncated ? '— قُصّت هنا، المسألة أطول من هذا —  اقرأها كاملة ‹' : 'فتح المسألة كاملة ‹'}</div>
    </div>
  </div>`;
}


function shuffleDailyMasala() {
  getDailyMasala(true);
  renderHomeExtras();
}

function openDailyMasala() {
  const pick = getDailyMasala(false);
  if (!pick) return;
  navStack = [];
  pushNav(() => showTab('books'));
  openReader(pick.bookId, pick.sectionIdx);
  scrollToMasalaWithinSection(pick.sectionIdx, pick.masalaNum);
}

function loadThamraData() {
  if (thamraItemsCache) return thamraItemsCache;
  const res = db.exec(`SELECT item_id, seq, item_type, text, list_style, opinions_json, table_json FROM "${THAMRA_BOOK_TABLE}" ORDER BY seq`);
  const rows = res.length ? res[0].values : [];
  const items = rows.map(r => {
    let opinion = null, table = null;
    try { opinion = r[5] ? JSON.parse(r[5]) : null; } catch (e) { opinion = null; }
    try { table = r[6] ? JSON.parse(r[6]) : null; } catch (e) { table = null; }
    return { itemId: r[0], seq: r[1], itemType: r[2], text: r[3] || '', listStyle: r[4] || null, opinion, table };
  });

  const sections = [];
  items.forEach((it, idx) => {
    if (it.itemType === 'heading' || it.itemType === 'subheading') {
      if (sections.length) sections[sections.length - 1].itemsEnd = idx;
      sections.push({ seq: it.seq, itemType: it.itemType, text: it.text, itemsStart: idx, itemsEnd: items.length });
    }
  });
  if (!sections.length || sections[0].itemsStart > 0) {
    sections.unshift({ seq: -1, itemType: 'heading', text: '(مقدمة الكتاب)', itemsStart: 0, itemsEnd: sections.length ? sections[0].itemsStart : items.length });
  }

  thamraItemsCache = { items, sections };
  return thamraItemsCache;
}

function openThamraIndex(bookId, book) {
  const data = loadThamraData();
  currentThamraItems = data.items;
  currentThamraSections = data.sections;

  let html = '';
  currentThamraSections.forEach((sec, idx) => {
    const isSub = sec.itemType === 'subheading';
    html += `<div class="list-row ${isSub ? 'thamra-sub-row' : ''}" onclick="openReader(${bookId}, ${idx})">
      <div class="label">${escapeHtml(sec.text)}</div>
    </div>`;
  });
  document.getElementById('indexPage').innerHTML = html || '<div class="empty-state"><div class="ic"><i class="ti ti-file-text"></i></div>هذا الكتاب فارغ</div>';
  const authorLabel = allAuthors[book.author_id] || allAuthors[GLOSSARY_AUTHOR_ID];
  showBreadcrumb([authorLabel, book.name]);
  switchPage('indexPage', book.name);
  booksTabActive = true;
  lastBooksPageId = 'indexPage';
  lastBooksPageTitle = book.name;
  lastBooksBreadcrumb = [authorLabel, book.name];
  registerView(() => openThamraIndex(bookId, book));
}

function openThamraReader(bookId, sectionIdx) {
  pushNav(() => openThamraIndex(bookId, allBooks.find(b => b.id === bookId)));
  searchResultContext = null;
  currentBookId = bookId;
  currentBookTable = THAMRA_BOOK_TABLE;
  const data = loadThamraData();
  currentThamraItems = data.items;
  currentThamraSections = data.sections;
  currentThamraSectionIndex = sectionIdx;

  renderThamraReaderContent();
  const book = allBooks.find(b => b.id === bookId);
  switchPage('readerPage', book.name);
  updateJuristSettingsBtnState();
  const authorLabel = allAuthors[book.author_id] || allAuthors[GLOSSARY_AUTHOR_ID];
  const sec = currentThamraSections[sectionIdx];
  showBreadcrumb([authorLabel, book.name, sec ? sec.text : '']);
  booksTabActive = true;
  lastBooksPageId = 'readerPage';
  lastBooksPageTitle = book.name;
  lastBooksBreadcrumb = [authorLabel, book.name, sec ? sec.text : ''];
  registerView((snap) => {
    openThamraReader(bookId, snap && typeof snap.idx === 'number' ? snap.idx : currentThamraSectionIndex);
  }, {
    snapshot: () => ({ idx: currentThamraSectionIndex })
  });
  if (isThamraContinuousMode()) {
    setTimeout(() => {
      const el = document.querySelector(`[data-thamra-section-idx="${sectionIdx}"]`);
      if (el) el.scrollIntoView({ behavior: 'auto', block: 'start' });
    }, 30);
  }
}

function navThamraSection(delta) {
  const newIdx = currentThamraSectionIndex + delta;
  if (newIdx < 0 || newIdx >= currentThamraSections.length) return;
  const content = document.getElementById('content');
  currentThamraSectionIndex = newIdx;
  renderThamraReaderContent();
  const book = allBooks.find(b => b.id === currentBookId);
  const authorLabel = allAuthors[book.author_id] || allAuthors[GLOSSARY_AUTHOR_ID];
  const sec = currentThamraSections[currentThamraSectionIndex];
  showBreadcrumb([authorLabel, book.name, sec.text]);
  lastBooksBreadcrumb = [authorLabel, book.name, sec.text];
  triggerPageTransition(delta);
  content.scrollTop = 0;
}

function isPageFlipMode() { return localStorage.getItem('rs_readmode') === 'pages'; }
function readModeName() { return isPageFlipMode() ? 'pages' : 'scroll'; }
function isThamraContinuousMode() { return !isPageFlipMode(); }

function pmShowSection(idx) {
  const page = document.getElementById('readerPage');
  if (!page) return;
  if (rw) rwEnsure(idx);
  page.querySelectorAll('.reader-section.pm-current').forEach(e => e.classList.remove('pm-current'));
  const el = document.getElementById(`rs-sec-${idx}`);
  if (el) el.classList.add('pm-current');
  currentSectionIndex = idx;
  for (let i = Math.max(0, idx - 1); i <= Math.min(currentSections.length - 1, idx + 1); i++) ensureSectionRendered(i);
  recomputeCurrentSectionScrollBounds();
  document.getElementById('content').scrollTop = 0;
  if (typeof updateScrollbar === 'function') updateScrollbar();
}

function setReadMode(mode) {
  const wasPages = isPageFlipMode();
  const nowPages = mode === 'pages';
  localStorage.setItem('rs_readmode', nowPages ? 'pages' : 'scroll');
  applyTheme();
  if (wasPages === nowPages) return;
  const reader = document.getElementById('readerPage');
  if (!reader || !reader.classList.contains('active')) return;
  const content = document.getElementById('content');
  if (typeof isThamraBook === 'function' && isThamraBook(currentBookId) && currentThamraSections.length) {
    if (!wasPages) {
      const top = content.getBoundingClientRect().top;
      let best = currentThamraSectionIndex;
      document.querySelectorAll('#readerPage [data-thamra-section-idx]').forEach(el => {
        if (el.getBoundingClientRect().top - top <= 80) best = parseInt(el.dataset.thamraSectionIdx, 10);
      });
      currentThamraSectionIndex = best;
      renderThamraReaderContent();
      content.scrollTop = 0;
    } else {
      renderThamraReaderContent();
      const idx = currentThamraSectionIndex;
      setTimeout(() => {
        const el = document.querySelector(`[data-thamra-section-idx="${idx}"]`);
        if (el) el.scrollIntoView({ behavior: 'auto', block: 'start' });
      }, 30);
    }
    return;
  }
  if (currentSections && currentSections.length && reader.querySelector('.reader-section')) {
    const idx = currentSectionIndex;
    renderContinuousReader(currentBookId, idx, {});
  }
}
function setThamraContinuousMode(on) { setReadMode(on ? 'scroll' : 'pages'); }

function renderThamraReaderContent() {
  if (isThamraContinuousMode()) { renderThamraContinuousContent(); return; }
  const sec = currentThamraSections[currentThamraSectionIndex];
  if (!sec) return;
  const bodyHtml = renderThamraSectionHtml(sec);

  const html = `
    <div class="reader-toolbar">
      <button onclick="navThamraSection(-1)">‹ السابق</button>
      <button onclick="navThamraSection(1)">التالي ›</button>
    </div>
    <h2 class="section-title">${escapeHtml(sec.text)}</h2>
    <div class="body-text thamra-body ${fontFamily}" style="font-size:${fontSize}px;">${bodyHtml}</div>
  `;
  document.getElementById('readerPage').innerHTML = html;
  applyPendingSearchHighlight();
}

function renderThamraContinuousContent() {
  let html = '';
  currentThamraSections.forEach((sec, idx) => {
    const bodyHtml = renderThamraSectionHtml(sec);
    html += `<div class="reader-section" data-thamra-section-idx="${idx}">
      <h2 class="section-title">${escapeHtml(sec.text)}</h2>
      <div class="body-text thamra-body ${fontFamily}" style="font-size:${fontSize}px;">${bodyHtml}</div>
    </div>`;
  });
  document.getElementById('readerPage').innerHTML = html;
  applyPendingSearchHighlight(undefined, document.querySelector(`#readerPage [data-thamra-section-idx="${currentThamraSectionIndex}"]`));
}

function renderThamraSectionHtml(sec) {
  let html = '';
  const start = (sec.seq === -1) ? sec.itemsStart : sec.itemsStart + 1;
  for (let i = start; i < sec.itemsEnd; i++) {
    const it = currentThamraItems[i];
    if (!it) continue;
    html += renderThamraItemHtml(it);
  }
  if (!html) html = '<div class="empty-state" style="padding:30px 10px;">لا يوجد محتوى إضافي تحت هذا العنوان</div>';
  return html;
}

function renderThamraItemHtmlBase(it) {
  switch (it.itemType) {
    case 'heading':
      return `<h3 class="thamra-inline-heading">${escapeHtml(it.text)}</h3>`;
    case 'subheading':
      return `<h4 class="thamra-inline-subheading">${escapeHtml(it.text)}</h4>`;
    case 'question':
      return `<div class="thamra-item thamra-question">
        <div class="thamra-item-tools"><button title="نسخ" onclick="copyThamraItem(event, ${it.itemId})"><i class="ti ti-clipboard"></i></button></div>
        <span class="thamra-tag">سؤال</span> ${escapeHtml(it.text)}
      </div>`;
    case 'answer':
      return `<div class="thamra-item thamra-answer">
        <div class="thamra-item-tools"><button title="نسخ" onclick="copyThamraItem(event, ${it.itemId})"><i class="ti ti-clipboard"></i></button></div>
        <span class="thamra-tag">جواب</span> ${escapeHtml(it.text)}
      </div>`;
    case 'note':
      return `<div class="thamra-item thamra-note">
        <div class="thamra-item-tools"><button title="نسخ" onclick="copyThamraItem(event, ${it.itemId})"><i class="ti ti-clipboard"></i></button></div>
        <i class="ti ti-info-circle"></i> ${escapeHtml(it.text)}
      </div>`;
    case 'list_item':
      return renderThamraListItemHtml(it);
    case 'opinion':
      return renderThamraOpinionHtml(it);
    case 'table':
      return renderThamraTableHtml(it);
    default:
      return it.text ? `<div class="thamra-item">${escapeHtml(it.text)}</div>` : '';
  }
}

const THAMRA_LIST_MARKER_RE = /(?:^|(?<=[.:؟!]\s))(-\d+|[\u0621-\u064A]\s?[-(]|دال:|-)(?=\s)/g;

function thamraListMarkerClass(marker) {
  if (/^-\d+$/.test(marker)) return 'thamra-list-badge-numbered';
  if (marker === '-') return 'thamra-list-badge-bulleted';
  return 'thamra-list-badge-lettered';
}

function renderThamraListItemHtml(it) {
  const style = it.listStyle || 'plain';
  const raw = it.text || '';
  let html = '';
  let last = 0;
  THAMRA_LIST_MARKER_RE.lastIndex = 0;
  let m;
  while ((m = THAMRA_LIST_MARKER_RE.exec(raw)) !== null) {
    html += escapeHtml(raw.slice(last, m.index));
    const cls = thamraListMarkerClass(m[1]);
    html += `<span class="thamra-list-badge ${cls}">${escapeHtml(m[1])}</span>`;
    last = m.index + m[1].length;
  }
  html += escapeHtml(raw.slice(last));
  return `<div class="thamra-item thamra-list-item thamra-list-${escapeHtml(style)}">${html}</div>`;
}

function formatThamraAttributions(attributions) {
  if (!attributions || !attributions.length) return '';
  const settings = getThamraJuristSettings();
  const order = settings.order;
  const priority = name => { const idx = order.indexOf(name); return idx === -1 ? 999 : idx; };

  const groups = attributions.map(a => {
    const visibleNames = (a.names || []).filter(n => !settings.hidden[n]);
    return { ...a, names: visibleNames };
  }).filter(a => a.names.length > 0);
  if (!groups.length) return '';

  for (const g of groups) g.names.sort((x, y) => priority(x) - priority(y));
  groups.sort((a, b) => priority(a.names[0]) - priority(b.names[0]));

  return groups.map(a => {
    const names = a.names.map(n => settings.favorite[n]
      ? `<span class="thamra-attr-fav">${escapeHtml(n)}</span>`
      : escapeHtml(n)
    ).join('، ');
    const note = a.note ? ` <span class="thamra-attr-note">(${escapeHtml(a.note)})</span>` : '';
    return `<span class="thamra-attr-group">${names}${note}</span>`;
  }).join('<span class="thamra-attr-sep">|</span>');
}

function renderThamraOpinionHtml(it) {
  if (!it.opinion) return '';
  const hadAttributions = !!(it.opinion.attributions && it.opinion.attributions.length);
  const attrHtml = formatThamraAttributions(it.opinion.attributions);
  if (hadAttributions && !attrHtml) return '';
  const text = it.opinion.text || '';
  return `<div class="thamra-item thamra-opinion">
    <div class="thamra-item-tools"><button title="نسخ" onclick="copyThamraItem(event, ${it.itemId})"><i class="ti ti-clipboard"></i></button></div>
    <span class="thamra-opinion-text">${escapeHtml(text)}</span>
    ${attrHtml ? `<div class="thamra-opinion-attrs">${attrHtml}</div>` : ''}
  </div>`;
}

function renderThamraTableHtml(it) {
  if (!it.table) return '';
  const t = it.table;
  let html = `<div class="thamra-table-wrap"><div class="thamra-table-title">${escapeHtml(t.title || '')}</div><table class="thamra-table">`;
  html += `<thead><tr>${t.columns.map(c => `<th>${escapeHtml(c)}</th>`).join('')}</tr></thead><tbody>`;
  for (const row of t.rows) {
    const opinionsHtml = (row.opinions || []).map(op => {
      const hadAttributions = !!(op.attributions && op.attributions.length);
      const attrHtml = formatThamraAttributions(op.attributions);
      if (hadAttributions && !attrHtml) return '';
      return `<div class="thamra-table-opinion">
        <span class="thamra-opinion-text">${escapeHtml(op.text)}</span>
        ${attrHtml ? `<div class="thamra-opinion-attrs">${attrHtml}</div>` : ''}
      </div>`;
    }).join('');
    if (t.kind === 'kafara_table') {
      html += `<tr><td class="thamra-td-category">${escapeHtml(row.category || '')}</td><td>${opinionsHtml}</td></tr>`;
    } else if (t.kind === 'wuquf_matrix') {
      html += `<tr><td>${escapeHtml(row.arafa || '')}</td><td>${escapeHtml(row.mazdalifa || '')}</td><td>${opinionsHtml}</td></tr>`;
    } else {
      html += `<tr><td colspan="${t.columns.length}">${escapeHtml(JSON.stringify(row))}</td></tr>`;
    }
  }
  html += '</tbody></table></div>';
  return html;
}

function rsCopyTextWithFlash(text, btn) {
  if (rsShareNext) { rsShareNext = false; rsShareText(text); if (btn && btn._rsRestore) btn._rsRestore(); return; }
  const flash = () => { if (btn) flashCopyButton(btn); };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(flash, () => { rsLegacyCopy(text); flash(); });
  } else {
    rsLegacyCopy(text); flash();
  }
}
let rsShareNext = false;
let rsPendingShareText = '';
function rsShareText(text) {
  text = String(text || '');
  if (!text) return;
  if (navigator.share) {
    navigator.share({ text }).catch((err) => { if (!err || err.name !== 'AbortError') rsShareFallback(text); });
    return;
  }
  rsShareFallback(text);
}
function rsShareFallback(text) {
  rsPendingShareText = text;
  openMiniMenu('مشاركة', `
    <div class="list-row" onclick="rsShareVia('wa')"><span class="mm-ic"><i class="ti ti-brand-whatsapp"></i></span><div class="label">واتساب</div></div>
    <div class="list-row" onclick="rsShareVia('tg')"><span class="mm-ic"><i class="ti ti-brand-telegram"></i></span><div class="label">تيليجرام</div></div>
    <div class="list-row" onclick="rsShareVia('mail')"><span class="mm-ic"><i class="ti ti-mail"></i></span><div class="label">البريد</div></div>
    <div class="list-row" onclick="rsShareVia('copy')"><span class="mm-ic"><i class="ti ti-clipboard"></i></span><div class="label">نسخ النص</div></div>
  `);
}
function rsShareVia(kind) {
  const t = rsPendingShareText, e = encodeURIComponent(t);
  closeMiniMenu();
  if (kind === 'copy') { rsLegacyCopy(t); showGenericToast('تم النسخ'); return; }
  const url = kind === 'wa' ? 'https://wa.me/?text=' + e
    : kind === 'tg' ? 'https://t.me/share/url?url=%20&text=' + e
    : 'mailto:?body=' + e;
  window.open(url, '_blank', 'noopener');
}
(function rsLongPressShare() {
  const HOLD_MS = 450, SLOP = 12;
  let timer = null, btn = null, fired = false, x0 = 0, y0 = 0, saved = '';
  const isCopyBtn = (t) => {
    const b = t && t.closest ? t.closest('button') : null;
    const i = b && b.firstElementChild;
    return i && i.classList && (i.classList.contains('ti-clipboard') || i.classList.contains('ti-copy')) ? b : null;
  };
  const restore = (b) => {
    if (!b || !b.classList.contains('share-armed')) return;
    b.classList.remove('share-armed');
    const i = b.firstElementChild;
    if (i) i.className = saved;
    b._rsRestore = null;
  };
  document.addEventListener('pointerdown', (e) => {
    const b = isCopyBtn(e.target);
    if (!b || (e.pointerType === 'mouse' && e.button !== 0)) return;
    btn = b; fired = false; x0 = e.clientX; y0 = e.clientY;
    clearTimeout(timer);
    timer = setTimeout(() => {
      fired = true;
      const i = b.firstElementChild;
      saved = i.className;
      b._rsRestore = () => restore(b);
      b.classList.add('share-armed');
      i.className = 'ti ti-share-3';
      try { navigator.vibrate && navigator.vibrate(18); } catch (err) {}
    }, HOLD_MS);
  }, true);
  document.addEventListener('pointermove', (e) => {
    if (!btn || fired) return;
    if (Math.abs(e.clientX - x0) > SLOP || Math.abs(e.clientY - y0) > SLOP) { clearTimeout(timer); btn = null; }
  }, true);
  let swallowRealClick = false;
  const fireShare = (b) => {
    if (!b || !b.isConnected) return;
    rsShareNext = true;
    swallowRealClick = true; setTimeout(() => { swallowRealClick = false; }, 700);
    try { b.click(); } catch (er) {}
    rsShareNext = false; restore(b);
  };
  const end = () => {
    clearTimeout(timer);
    if (fired && btn) { const b = btn; fired = false; btn = null; fireShare(b); return; }
    btn = null;
  };
  document.addEventListener('pointerup', end, true);
  document.addEventListener('pointercancel', () => {
    clearTimeout(timer);
    if (fired && btn) { const b = btn; fired = false; btn = null; fireShare(b); return; }
    btn = null; fired = false;
  }, true);
  document.addEventListener('click', (e) => {
    if (swallowRealClick && e.isTrusted && e.target.closest && e.target.closest('button')) { swallowRealClick = false; e.stopPropagation(); e.preventDefault(); }
  }, true);
  document.addEventListener('click', (e) => {
    const b = e.target.closest ? e.target.closest('button.share-armed') : null;
    if (b && fired) {
      rsShareNext = true; fired = false;
      setTimeout(() => { rsShareNext = false; restore(b); }, 0);
    }
  }, true);
  document.addEventListener('contextmenu', (e) => { if (isCopyBtn(e.target)) e.preventDefault(); }, true);
})();
function rsLegacyCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text; document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); } catch (e) {}
  document.body.removeChild(ta);
}

function thamraAttributionsPlain(attributions) {
  const html = formatThamraAttributions(attributions);
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return Array.from(tmp.querySelectorAll('.thamra-attr-group')).map(g => g.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' | ');
}

function thamraContextForItem(itemIdx) {
  const sec = findThamraSectionForItemIndex(itemIdx);
  const lowest = sec ? sec.itemsStart : 0;
  const answers = [];
  for (let i = itemIdx - 1; i >= lowest; i--) {
    const x = currentThamraItems[i];
    if (!x) continue;
    if (x.itemType === 'heading' || x.itemType === 'subheading') return null;
    if (x.itemType === 'answer') { answers.unshift(x.text); continue; }
    if (x.itemType === 'question') return { kind: 'question', text: x.text, answers };
    if (x.itemType === 'list_item') return { kind: 'list', text: x.text, answers: [] };
  }
  return null;
}

function thamraAnswerLabel(x) {
  if (x.itemType === 'answer') return 'الجواب';
  const n = x.opinion ? thamraAttributionsPlain(x.opinion.attributions) : '';
  return n || 'رأي متفق عليه';
}
function thamraOpinionHidden(x) {
  if (!x || x.itemType !== 'opinion' || !x.opinion) return false;
  const had = !!(x.opinion.attributions && x.opinion.attributions.length);
  return had && !thamraAttributionsPlain(x.opinion.attributions);
}
function thamraAnswerText(x) { return String(x.itemType === 'opinion' && x.opinion ? (x.opinion.text || '') : (x.text || '')).trim(); }
function buildThamraCopyText(itemIdx) {
  const it = currentThamraItems[itemIdx];
  let text = it.text;
  if (it.itemType === 'question') {
    const sec = findThamraSectionForItemIndex(itemIdx);
    const hi = sec ? sec.itemsEnd : currentThamraItems.length;
    const parts = [];
    for (let i = itemIdx + 1; i < hi; i++) {
      const x = currentThamraItems[i];
      if (!x) continue;
      if (x.itemType === 'question' || x.itemType === 'heading' || x.itemType === 'subheading') break;
      if (x.itemType === 'answer' || (x.itemType === 'opinion' && x.opinion && !thamraOpinionHidden(x))) {
        const t = thamraAnswerText(x);
        if (t) parts.push(`● ${thamraAnswerLabel(x)}:\n${t}`);
      }
    }
    text = 'السؤال: ' + String(it.text || '').trim();
    if (parts.length) text += '\n\nآراء المراجع:\n\n' + parts.join('\n\n');
    return text;
  }
  if ((it.itemType === 'opinion' && it.opinion) || it.itemType === 'answer') {
    const ctx = thamraContextForItem(itemIdx);
    if (ctx && ctx.kind === 'question') {
      return 'السؤال: ' + String(ctx.text || '').trim() + `\n\nالجواب (${thamraAnswerLabel(it)}): ` + thamraAnswerText(it);
    }
  }
  if (it.itemType === 'opinion' && it.opinion) {
    const names = thamraAttributionsPlain(it.opinion.attributions);
    const ctx = thamraContextForItem(itemIdx);
    let out = '';
    if (ctx) {
      out += ctx.text.trim() + '\n';
      ctx.answers.forEach(a => { out += '\n' + String(a).trim() + '\n'; });
      out += '\n' + (ctx.kind === 'question' ? 'الجواب: ' : 'الرأي: ');
    }
    out += it.opinion.text + (names ? `\n(${names})` : '');
    text = out;
  }
  return text;
}

function copyThamraItem(evt, itemId) {
  evt.stopPropagation();
  const itemIdx = currentThamraItems.findIndex(x => x.itemId === itemId);
  if (itemIdx === -1) return;
  const text = buildThamraCopyText(itemIdx);
  const book = allBooks.find(b => b.id === currentBookId);
  const sec = findThamraSectionForItemIndex(itemIdx);
  const citation = `${text}\n\nالمصدر: ${book.name} - ${sec ? sec.text : ''}`;
  rsCopyTextWithFlash(citation, evt.currentTarget);
}

function extKeyOf(kind, a, b) { return kind === 't' ? 't' + a : (kind === 'q' ? 'q' + a : 'c' + a + '_' + b); }
function extArgs(kind, a, b) { return `'${kind}',${a},${kind === 'c' ? b : 0}`; }
function extFindFav(kind, key) { return favorites.find(f => f.kind === kind && f.masalaNum === key) || null; }
function extFindNote(kind, key) { return notes.find(n => n.kind === kind && n.masalaNum === key) || null; }

function extDescribe(kind, a, b) {
  if (kind === 't') {
    const idx = currentThamraItems.findIndex(x => x.itemId === a);
    if (idx < 0) return null;
    const book = allBooks.find(x => x.id === currentBookId);
    const secObj = findThamraSectionForItemIndex(idx);
    const secIdx = secObj ? Math.max(0, currentThamraSections.indexOf(secObj)) : 0;
    const bookName = book ? book.name : '';
    const secTitle = secObj ? secObj.text : '';
    return {
      kind, key: extKeyOf(kind, a, b), bookId: currentBookId, sectionIdx: secIdx,
      title: secTitle, bookName, text: buildThamraCopyText(idx),
      source: `${bookName} - ${secTitle}`, sub: `${bookName} — ${secTitle}`, ref: { itemId: a }
    };
  }
  if (kind === 'c') {
    const { subjectsById, chapters, answersBySubject, scholarById } = loadCmpData();
    const subject = subjectsById.get(a);
    if (!subject) return null;
    const ans = (answersBySubject.get(a) || []).find(x => x.scholar_id === b);
    if (!ans) return null;
    const sch = scholarById.get(b);
    const chapter = chapters.find(c => c.id === subject.chapter_id);
    let text = 'السؤال: ' + String(subject.question || '').trim();
    if (subject.question_extra_info) text += '\n' + String(subject.question_extra_info).trim();
    text += `\n\nالجواب (${sch ? sch.name : ''}): ` + String(ans.answer_text || '').trim();
    if (ans.answer_extra_info) text += '\n' + String(ans.answer_extra_info).trim();
    const where = [chapter ? chapter.name : '', subject.name].filter(Boolean).join(' - ');
    return {
      kind, key: extKeyOf(kind, a, b), bookId: 'cmp', sectionIdx: a,
      title: subject.name, bookName: 'جامع الاستفتاءات', text,
      source: 'جامع الاستفتاءات للشيخ عادل الجوهر - ' + where,
      sub: `جامع الاستفتاءات — ${sch ? sch.name : ''} — ${subject.name}`, ref: { subjectId: a, scholarId: b }
    };
  }
  if (kind === 'q') {
    const { subjectsById, chapters, answersBySubject, scholarById } = loadCmpData();
    const subject = subjectsById.get(a);
    if (!subject) return null;
    const hidden = getCmpScholarSettings().hidden;
    const answers = answersBySubject.get(a) || [];
    let text = 'السؤال: ' + String(subject.question || '').trim();
    if (subject.question_extra_info) text += '\n' + String(subject.question_extra_info).trim();
    const parts = [];
    cmpOrderedScholars().forEach(sch => {
      if (hidden[sch.id]) return;
      const ans = answers.find(x => x.scholar_id === sch.id);
      if (!ans) return;
      let t = `● ${sch.name}:\n${String(ans.answer_text || '').trim()}`;
      if (ans.answer_extra_info) t += '\n' + String(ans.answer_extra_info).trim();
      parts.push(t);
    });
    if (parts.length) text += '\n\nآراء المراجع:\n\n' + parts.join('\n\n');
    const chapter = chapters.find(c => c.id === subject.chapter_id);
    const where = [chapter ? chapter.name : '', subject.name].filter(Boolean).join(' - ');
    return {
      kind, key: extKeyOf(kind, a, b), bookId: 'cmp', sectionIdx: a,
      title: subject.name, bookName: 'جامع الاستفتاءات', text,
      source: 'جامع الاستفتاءات للشيخ عادل الجوهر - ' + where,
      sub: `جامع الاستفتاءات — السؤال كاملاً — ${subject.name}`, ref: { subjectId: a, scholarId: 0 }
    };
  }
  return null;
}

function extToolsHtml(kind, a, b, cls) {
  const key = extKeyOf(kind, a, b);
  const fav = extFindFav(kind, key);
  const hasNote = !!extFindNote(kind, key);
  const args = extArgs(kind, a, b);
  const copyCall = kind === 't' ? `copyThamraItem(event, ${a})` : (kind === 'q' ? `copyCmpQuestion(event, ${a})` : `copyCmpAnswer(event, ${a}, ${b})`);
  const col = fav ? starColorValue(fav.color) : '';
  return `<div class="${cls} ext-tools">
    <button title="نسخ" onclick="${copyCall}"><i class="ti ti-clipboard"></i></button>
    <button title="إشارة مرجعية (ضغطة/ضغطتان/مطوّلة للألوان)" class="ext-star ${fav ? 'bm-active' : ''}" ${fav ? `style="color:${col};background:${hexToRgba(col, 0.16)}"` : ''} onclick="extStarTap(event, ${args})" onpointerdown="extStarDown(event, ${args})" onpointerup="extStarUp()" onpointerleave="extStarUp()" onpointercancel="extStarUp()" oncontextmenu="return false"><i class="ti ti-star"></i></button>
    <button title="ملاحظة" class="ext-note-btn ${hasNote ? 'note-active' : ''}" onclick="extToggleNote(event, ${args})"><i class="ti ti-pencil"></i></button>
    <button title="إضافة لكتابي" onclick="extAddToCustomBook(event, ${args})"><i class="ti ti-file-plus"></i></button>
  </div>`;
}
function extNoteAreaHtml(kind, a, b) {
  const key = extKeyOf(kind, a, b);
  const n = extFindNote(kind, key);
  return n && n.text
    ? `<div class="note-display" id="ext-note-display-${key}"><i class="ti ti-pencil"></i> ${escapeHtml(n.text)}</div><div class="note-accordion" id="ext-note-acc-${key}"></div>`
    : `<div class="note-display" id="ext-note-display-${key}" style="display:none;"></div><div class="note-accordion" id="ext-note-acc-${key}"></div>`;
}

function renderThamraItemHtml(it) {
  const html = renderThamraItemHtmlBase(it);
  if (!html || !(it.itemType === 'question' || it.itemType === 'answer' || it.itemType === 'note' || it.itemType === 'opinion')) return html;
  try {
    const key = extKeyOf('t', it.itemId, 0);
    const fav = extFindFav('t', key);
    const tools = extToolsHtml('t', it.itemId, 0, 'thamra-item-tools');
    let out = html.replace(/<div class="thamra-item-tools">[\s\S]*?<\/button><\/div>/, tools);
    out = out.replace('<div class="thamra-item ',
      `<div data-ext-key="${key}" data-thamra-item="${it.itemId}" ${fav ? `style="--ext-col:${starColorValue(fav.color)}"` : ''} class="thamra-item ${fav ? 'ext-fav ' : ''}`);
    out = out.replace(/<\/div>\s*$/, extNoteAreaHtml('t', it.itemId, 0) + '</div>');
    return out;
  } catch (e) { return html; }
}

function copyCmpAnswer(evt, subjectId, scholarId) {
  evt.stopPropagation();
  const d = extDescribe('c', subjectId, scholarId);
  if (!d) return;
  rsCopyTextWithFlash(`${d.text}\n\nالمصدر: ${d.source}`, evt.currentTarget);
}

function copyCmpQuestion(evt, subjectId) {
  evt.stopPropagation();
  const d = extDescribe('q', subjectId, 0);
  if (!d) return;
  rsCopyTextWithFlash(`${d.text}\n\nالمصدر: ${d.source}`, evt.currentTarget);
}

function extSaveFavs() { try { localStorage.setItem('rs_favorites', JSON.stringify(favorites)); } catch (e) {} }
function extSetFav(kind, a, b, color) {
  const d = extDescribe(kind, a, b);
  if (!d) return;
  const idx = favorites.findIndex(f => f.kind === kind && f.masalaNum === d.key);
  if (idx >= 0) {
    if (color === null) favorites.splice(idx, 1); else favorites[idx].color = color;
  } else if (color !== null) {
    favorites.push({ kind, bookId: d.bookId, sectionIdx: d.sectionIdx, title: d.title, bookName: d.bookName, masalaNum: d.key,
      snippet: d.text.slice(0, 90), color, extText: d.text, extSub: d.sub, extRef: d.ref });
  }
  extSaveFavs();
  extPaint(kind, a, b);
}
function extPaint(kind, a, b) {
  const key = extKeyOf(kind, a, b);
  const el = document.querySelector(`[data-ext-key="${key}"]`);
  if (!el) return;
  const fav = extFindFav(kind, key);
  const btn = el.querySelector('.ext-star');
  el.classList.toggle('ext-fav', !!fav);
  if (fav) {
    const col = starColorValue(fav.color);
    el.style.setProperty('--ext-col', col);
    if (btn) { btn.classList.add('bm-active'); btn.style.color = col; btn.style.background = hexToRgba(col, 0.16); }
  } else {
    el.style.removeProperty('--ext-col');
    if (btn) { btn.classList.remove('bm-active'); btn.style.color = ''; btn.style.background = ''; }
  }
}
let extStarTimer = null, extStarLong = false, extStarTapState = null, extSheetCtx = null;
function extStarDown(evt, kind, a, b) {
  extStarLong = false; clearTimeout(extStarTimer);
  extStarTimer = setTimeout(() => { extStarLong = true; try { navigator.vibrate && navigator.vibrate(15); } catch (e) {} openExtStarSheet(kind, a, b); }, 480);
}
function extStarUp() { clearTimeout(extStarTimer); }
function extStarTap(evt, kind, a, b) {
  evt.stopPropagation();
  if (extStarLong) { extStarLong = false; return; }
  const tk = kind + '|' + a + '|' + b;
  if (extStarTapState && extStarTapState.key === tk) {
    clearTimeout(extStarTapState.t); extStarTapState = null;
    extSetFav(kind, a, b, getStarPrefs().double);
    return;
  }
  extStarTapState = { key: tk, t: setTimeout(() => {
    extStarTapState = null;
    const exists = !!extFindFav(kind, extKeyOf(kind, a, b));
    extSetFav(kind, a, b, exists ? null : getStarPrefs().single);
  }, 270) };
}
function openExtStarSheet(kind, a, b) {
  extSheetCtx = { kind, a, b };
  let ov = document.getElementById('starSheetOverlay');
  if (!ov) {
    ov = document.createElement('div'); ov.id = 'starSheetOverlay';
    ov.onclick = (e) => { if (e.target === ov) closeStarSheet(); };
    document.body.appendChild(ov);
  }
  renderExtStarSheet(); ov.classList.add('show');
}
function renderExtStarSheet() {
  const { kind, a, b } = extSheetCtx;
  const prefs = getStarPrefs();
  const fav = extFindFav(kind, extKeyOf(kind, a, b));
  document.getElementById('starSheetOverlay').innerHTML = `<div class="star-sheet">
    <div class="star-sheet-title"><i class="ti ti-star"></i> لون النجمة</div>
    <div class="star-sheet-label">لون هذا العنصر</div>
    <div class="star-dots">${starDotsHtml(fav ? (fav.color || 'gold') : '', 'extStarPickNow')}</div>
    <div class="star-sheet-label">لون الضغطة الواحدة</div>
    <div class="star-dots">${starDotsHtml(prefs.single, 'extStarPrefSingle')}</div>
    <div class="star-sheet-label">لون الضغطتين المتتاليتين</div>
    <div class="star-dots">${starDotsHtml(prefs.double, 'extStarPrefDouble')}</div>
    ${fav ? '<button class="star-remove" onclick="extStarRemoveNow()"><i class="ti ti-trash"></i> إزالة من المفضلة</button>' : ''}
  </div>`;
}
function extStarPickNow(c) { extSetFav(extSheetCtx.kind, extSheetCtx.a, extSheetCtx.b, c); closeStarSheet(); }
function extStarPrefSingle(c) { const p = getStarPrefs(); p.single = c; saveStarPrefs(p); renderExtStarSheet(); }
function extStarPrefDouble(c) { const p = getStarPrefs(); p.double = c; saveStarPrefs(p); renderExtStarSheet(); }
function extStarRemoveNow() { extSetFav(extSheetCtx.kind, extSheetCtx.a, extSheetCtx.b, null); closeStarSheet(); }

function extToggleNote(evt, kind, a, b) {
  evt.stopPropagation();
  const key = extKeyOf(kind, a, b);
  const acc = document.getElementById('ext-note-acc-' + key);
  if (!acc) return;
  if (acc.classList.contains('open')) { acc.classList.remove('open'); return; }
  const n = extFindNote(kind, key);
  const args = extArgs(kind, a, b);
  acc.innerHTML = `
    <div class="note-accordion-label"><i class="ti ti-pencil"></i> ملاحظتك على هذا العنصر</div>
    <textarea id="ext-note-text-${key}" placeholder="اكتب ملاحظتك هنا...">${escapeHtml(n ? n.text : '')}</textarea>
    <div class="note-acc-actions">
      <button class="note-save" onclick="extSaveNote(event, ${args})">حفظ</button>
      <button class="note-cancel" onclick="extCloseNote('${key}')">إغلاق</button>
    </div>`;
  acc.classList.add('open');
  setTimeout(() => {
    acc.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const ta = document.getElementById('ext-note-text-' + key);
    if (ta) ta.focus();
  }, 80);
}
function extCloseNote(key) {
  const acc = document.getElementById('ext-note-acc-' + key);
  if (acc) acc.classList.remove('open');
}
function extSaveNote(evt, kind, a, b) {
  evt.stopPropagation();
  const key = extKeyOf(kind, a, b);
  const ta = document.getElementById('ext-note-text-' + key);
  const d = extDescribe(kind, a, b);
  if (!ta || !d) return;
  const val = ta.value;
  const idx = notes.findIndex(n => n.kind === kind && n.masalaNum === key);
  if (!val.trim()) { if (idx >= 0) notes.splice(idx, 1); }
  else if (idx >= 0) notes[idx].text = val;
  else notes.push({ kind, bookId: d.bookId, sectionIdx: d.sectionIdx, masalaNum: key, text: val, title: d.title, bookName: d.bookName, extText: d.text, extSub: d.sub, extRef: d.ref });
  saveNoteStorage();
  extCloseNote(key);
  const el = document.querySelector(`[data-ext-key="${key}"]`);
  const btn = el && el.querySelector('.ext-note-btn');
  if (btn) btn.classList.toggle('note-active', !!val.trim());
  const display = document.getElementById('ext-note-display-' + key);
  if (display) {
    if (val.trim()) { display.innerHTML = '<i class="ti ti-pencil"></i> ' + escapeHtml(val); display.style.display = 'block'; }
    else display.style.display = 'none';
  }
}

function extAddToCustomBook(evt, kind, a, b) {
  evt.stopPropagation();
  const d = extDescribe(kind, a, b);
  if (!d) return;
  pendingCbItem = {
    type: 'quote', bookId: null, sectionIdx: null, masalaNum: null,
    title: d.title, bookName: d.bookName, authorName: '', text: d.text, snippet: d.text.slice(0, 140),
    srcKind: kind, srcBookId: d.bookId, srcSection: d.sectionIdx, srcRef: d.ref, srcSub: d.sub
  };
  openAddToCustomBookPicker();
}

function extScrollTo(sel) {
  let tries = 0;
  const poll = () => {
    tries++;
    const el = document.querySelector(sel);
    if (el) {
      el.scrollIntoView({ behavior: 'auto', block: 'center' });
      el.classList.add('ext-jump-highlight');
      setTimeout(() => el.classList.remove('ext-jump-highlight'), 2500);
      return;
    }
    if (tries < 12) setTimeout(poll, 150);
  };
  setTimeout(poll, 120);
}
function openExtSource(rec, backFn) {
  if (!rec || !rec.extRef) return;
  navStack = [];
  pushNav(backFn || (() => showTab('favorites')));
  if (rec.kind === 't') {
    if (!allBooks.find(b => b.id === rec.bookId)) return;
    openReader(rec.bookId, rec.sectionIdx || 0);
    setTimeout(() => extScrollTo(`[data-thamra-item="${rec.extRef.itemId}"]`), 700);
  } else if (rec.kind === 'c') {
    updateBackButtonVisibility();
    renderCmpComparisonView(rec.extRef.subjectId);
    extScrollTo(`[data-ext-key="${extKeyOf('c', rec.extRef.subjectId, rec.extRef.scholarId)}"]`);
  } else if (rec.kind === 'q') {
    updateBackButtonVisibility();
    renderCmpComparisonView(rec.extRef.subjectId);
  }
}
function openExtQuoteSource(uid) {
  const cb = customBooks.find(b => b.id === currentCustomBookId);
  const loc = cb && findItemLocation(cb, uid);
  if (!loc) return;
  const it = loc.array[loc.index];
  const cbId = currentCustomBookId;
  openExtSource({ kind: it.srcKind, bookId: it.srcBookId, sectionIdx: it.srcSection, extRef: it.srcRef }, () => openCustomBook(cbId));
}

function extBlockHtml(head, text, noteText) {
  return `<div class="wr-masala" contenteditable="false"><div class="wr-masala-head">${escapeHtml(head)}</div>`
    + `<div class="wr-masala-body">${escapeHtml(text || '').replace(/\n/g, '<br>')}</div>`
    + (noteText ? `<div class="wr-masala-note">تعليقي: ${escapeHtml(noteText).replace(/\n/g, '<br>')}</div>` : '')
    + `</div><div><br></div>`;
}

function findThamraSectionForItemIndex(itemIdx) {
  for (let i = currentThamraSections.length - 1; i >= 0; i--) {
    if (itemIdx >= currentThamraSections[i].itemsStart) return currentThamraSections[i];
  }
  return currentThamraSections[0] || null;
}

function getThamraItemSearchText(it) {
  if (it.itemType === 'opinion' && it.opinion) {
    const names = (it.opinion.attributions || []).flatMap(a => a.names || []).join(' ');
    return `${it.opinion.text || ''} ${names}`;
  }
  if (it.itemType === 'table' && it.table) {
    const rows = it.table.rows || [];
    const parts = [it.table.title || ''];
    for (const row of rows) {
      parts.push(row.category || '', row.arafa || '', row.mazdalifa || '');
      for (const op of (row.opinions || [])) {
        parts.push(op.text || '');
        parts.push(...(op.attributions || []).flatMap(a => a.names || []));
      }
    }
    return parts.join(' ');
  }
  return it.text || '';
}

function searchThamraBook(book, normTerm, queryWords, precision, scope) {
  if (scope === 'footnotes') return [];
  const data = loadThamraData();
  const results = [];
  const seenSections = new Set();
  data.sections.forEach((sec, sectionIdx) => {
    for (let i = sec.itemsStart; i < sec.itemsEnd; i++) {
      const it = data.items[i];
      if (!it) continue;
      if (i === sec.itemsStart && sec.seq !== -1) continue;
      const itemText = getThamraItemSearchText(it);
      if (!itemText) continue;
      const normItemText = scope !== 'titles' ? normalizeArabic(itemText) : '';
      const normSecTitle = scope !== 'body' ? normalizeArabic(sec.text) : '';
      const haystack = scope === 'titles' ? normSecTitle : (scope === 'body' ? normItemText : normSecTitle + '\n' + normItemText);
      let isMatch;
      if (precision === 'exact') {
        isMatch = haystack.includes(normTerm);
      } else {
        isMatch = queryWords.every(w => haystack.includes(w));
      }
      if (isMatch && !seenSections.has(sectionIdx)) {
        seenSections.add(sectionIdx);
        results.push({
          bookId: book.id, bookName: book.name,
          rowid: sectionIdx, title: sec.text, body: itemText,
          isThamra: true,
        });
      }
    }
  });
  return results;
}

function saveLastPosition() {
  try {
    const content = document.getElementById('content');
    const scrollTop = document.getElementById('readerPage').classList.contains('active') ? content.scrollTop : undefined;
    localStorage.setItem('rs_lastPosition', JSON.stringify({ bookId: currentBookId, sectionIdx: currentSectionIndex, scrollTop, mode: readModeName() }));
  } catch (e) {  }
  updateBookPositionSilent();
}

function resumeLastPosition() {
  if (!RSUI.pref('resume')) return false;
  let pos = null;
  try { pos = JSON.parse(localStorage.getItem('rs_lastPosition') || 'null'); } catch (e) { pos = null; }
  if (!pos) return false;
  const book = allBooks.find(b => b.id === pos.bookId);
  if (!book) return false;
  if (isThamraBook(pos.bookId)) return false;
  const aid = allAuthors[book.author_id] ? book.author_id : GLOSSARY_AUTHOR_ID;
  renderReferencesPage();
  openAuthorBooks(aid);
  openBookIndex(pos.bookId);
  return true;
}

const SAVED_POSITIONS_MAX = 50;

function getTrackedBookIds() {
  try { return new Set(JSON.parse(localStorage.getItem('rs_trackedBooks') || '[]').map(Number)); } catch (e) { return new Set(); }
}
function setTrackedBookIds(set) {
  try { localStorage.setItem('rs_trackedBooks', JSON.stringify([...set].map(Number))); } catch (e) {  }
}
function getSavedPositions() {
  try { return JSON.parse(localStorage.getItem('rs_bookPositions') || '{}'); } catch (e) { return {}; }
}
function setSavedPositions(map) {
  try { localStorage.setItem('rs_bookPositions', JSON.stringify(map)); } catch (e) {  }
}

function updateBookPositionSilent() {
  if (!currentBookId || isThamraBook(currentBookId)) return;
  if (!getTrackedBookIds().has(currentBookId)) return;
  const book = allBooks.find(b => b.id === currentBookId);
  if (!book) return;
  const content = document.getElementById('content');
  const isReaderActive = document.getElementById('readerPage').classList.contains('active');
  if (!isReaderActive) return;
  const section = currentSections[currentSectionIndex];
  const map = getSavedPositions();
  map[currentBookId] = {
    sectionIdx: currentSectionIndex,
    scrollTop: content.scrollTop,
    mode: readModeName(),
    bookName: book.name,
    sectionTitle: section ? section.title : '',
    updatedAt: Date.now(),
  };
  setSavedPositions(map);
}

let positionBtnClickTimer = null;
let positionBtnClickCount = 0;
function handlePositionBtnClick() {
  positionBtnClickCount++;
  if (positionBtnClickCount === 1) {
    positionBtnClickTimer = setTimeout(() => {
      positionBtnClickCount = 0;
      openSavedPositionsList();
    }, 350);
  } else if (positionBtnClickCount === 2) {
    clearTimeout(positionBtnClickTimer);
    positionBtnClickCount = 0;
    enableTrackingForCurrentBook();
  }
}

function enableTrackingForCurrentBook() {
  if (!currentBookId || isThamraBook(currentBookId)) {
    showGenericToast('تتبّع الموقع غير متاح لهذا الكتاب');
    return;
  }
  const tracked = getTrackedBookIds();
  const wasAlreadyTracked = tracked.has(currentBookId);
  tracked.add(Number(currentBookId));
  setTrackedBookIds(tracked);
  updateBookPositionSilent();
  const btn = document.getElementById('readerFabPosition');
  if (btn) {
    btn.classList.add('just-saved', 'tracked');
    if (navigator.vibrate) { try { navigator.vibrate(15); } catch (e) {} }
    setTimeout(() => btn.classList.remove('just-saved'), 900);
  }
  showGenericToast(wasAlreadyTracked ? 'تم تحديث الموقع المحفوظ' : 'سيتم تتبع الموقع في هذا الكتاب');
}

function relativeTimeAr(timestamp) {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return 'الآن';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `قبل ${normalizeDigits(String(diffMin))} د`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `قبل ${normalizeDigits(String(diffHr))} س`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `قبل ${normalizeDigits(String(diffDay))} يوم`;
  return new Date(timestamp).toLocaleDateString('ar');
}

function openSavedPositionsList() {
  const map = getSavedPositions();
  const entries = Object.entries(map).sort((a, b) => b[1].updatedAt - a[1].updatedAt);
  const listEl = document.getElementById('savedPositionsList');
  if (!entries.length) {
    listEl.innerHTML = '<div id="savedPositionsEmpty">لا توجد كتب متتبَّعة بعد.<br>افتح أي كتاب واضغط زر الموقع ضغطتين متتاليتين لبدء تتبّع موضعك فيه تلقائياً.</div>';
  } else {
    listEl.innerHTML = entries.map(([bookId, pos]) => `
      <div class="saved-pos-row" data-book-id="${bookId}"
        onclick="jumpToSavedPosition(${bookId})"
        ontouchstart="startSavedPosLongPress(event, ${bookId})" ontouchend="cancelSavedPosLongPress()" ontouchmove="cancelSavedPosLongPress()"
        onmousedown="startSavedPosLongPress(event, ${bookId})" onmouseup="cancelSavedPosLongPress()" onmouseleave="cancelSavedPosLongPress()">
        <div class="saved-pos-icon"><i class="ti ti-map-pin"></i></div>
        <div class="saved-pos-info">
          <div class="saved-pos-book">${escapeHtml(pos.bookName || '')}</div>
          <div class="saved-pos-section">${escapeHtml(pos.sectionTitle || '')}</div>
        </div>
        <div class="saved-pos-time">${relativeTimeAr(pos.updatedAt)}</div>
      </div>`).join('');
  }
  document.getElementById('savedPositionsOverlay').classList.add('show');
}
function closeSavedPositionsList() {
  document.getElementById('savedPositionsOverlay').classList.remove('show');
}
let savedPosLongPressTimer = null;
function startSavedPosLongPress(evt, bookId) {
  clearTimeout(savedPosLongPressTimer);
  savedPosLongPressTimer = setTimeout(() => {
    savedPosLongPressTimer = null;
    if (navigator.vibrate) { try { navigator.vibrate(15); } catch (e) {} }
    confirmDeleteSavedPosition(evt, bookId);
  }, 550);
}
function cancelSavedPosLongPress() { clearTimeout(savedPosLongPressTimer); savedPosLongPressTimer = null; }
function confirmDeleteSavedPosition(evt, bookId) {
  if (evt) evt.stopPropagation();
  const map = getSavedPositions();
  const pos = map[bookId];
  const name = pos ? pos.bookName : 'هذا الكتاب';
  openConfirmDialog(`إيقاف تتبّع "${name}"؟ سيُحذف موقعه المحفوظ.`, () => {
    const map2 = getSavedPositions();
    delete map2[bookId];
    setSavedPositions(map2);
    const tracked = getTrackedBookIds();
    tracked.delete(parseInt(bookId, 10));
    setTrackedBookIds(tracked);
    openSavedPositionsList();
  });
}

function jumpToSavedPosition(bookId) {
  const map = getSavedPositions();
  const pos = map[bookId];
  if (!pos) return;
  const book = allBooks.find(b => b.id === bookId);
  if (!book) { showGenericToast('هذا الكتاب لم يعد متاحاً'); return; }
  closeSavedPositionsList();
  const resolvedAuthorId = allAuthors[book.author_id] ? book.author_id : GLOSSARY_AUTHOR_ID;
  currentAuthorId = resolvedAuthorId;
  pushNav(() => openAuthorBooks(resolvedAuthorId));
  loadBookSections(bookId, book);
  const startIdx = Math.max(0, Math.min(pos.sectionIdx, currentSections.length - 1));
  renderContinuousReader(bookId, startIdx, { scrollTop: (typeof pos.scrollTop === 'number' && (pos.mode || 'scroll') === readModeName()) ? pos.scrollTop : null });
}

function renderOrphanFootnotesHtml(rawBody, footnotes) {
  if (!footnotes || !footnotes.length || isUrwaBook(currentBookId) || isThamraBook(currentBookId)) return '';
  const used = new Set();
  for (const m of String(rawBody).matchAll(/\[(\d+)\]/g)) used.add(parseInt(m[1], 10));
  const rows = [];
  footnotes.forEach((e, i) => {
    if (used.has(i + 1) || typeof e !== 'string' || !e.trim()) return;
    rows.push(`<div class="fn-remark"><i class="ti ti-quote"></i> ${escapeHtml(e.trim()).replace(/\n/g, '<br>')}</div>`);
  });
  if (!rows.length) return '';
  return `<div class="fn-orphans"><div class="fn-orphans-title"><i class="ti ti-notes"></i> هوامش هذا القسم (بلا علامة في المتن)</div>${rows.join('')}</div>`;
}
function renderBodyHtml(rawBody, footnotes, sectionIdx) {
  return renderBodyHtmlCore(rawBody, footnotes, sectionIdx) + renderOrphanFootnotesHtml(rawBody, footnotes);
}
function renderBodyHtmlCore(rawBody, footnotes, sectionIdx) {
  const patterns = getMarkerPatterns(currentBookId);
  const hasMasala = patterns.test.test(rawBody);
  if (!hasMasala) {
    return formatPlainText(rawBody, footnotes, sectionIdx);
  }
  const parts = splitByMarker(rawBody, patterns.src, patterns.capture, currentBookId);
  let html = '';
  for (const part of parts) {
    const m = part.match(patterns.capture);
    if (!m) { html += formatPlainText(part, footnotes, sectionIdx); continue; }
    const num = normalizeDigits(m[1] || m[2] || m[3] || m[4] || m[5]);
    const blockType = /سؤال/.test(m[0]) ? 'سؤال' : 'مسألة';
    const isFav = isMasalaFavorite(currentBookId, sectionIdx, num);
    const existingNote = getNoteFor(currentBookId, sectionIdx, num);
    const inner = formatPlainText(part, footnotes, sectionIdx);
    const hasComparison = comparisonIndex.has(`${currentBookId}::${num}`);
    const hasSharh = currentBookId === SHARH_AWDAH_BOOK_ID && sharhAwdahIndex.has(num);
    const hasSharhManhaj = currentBookId === SHARH_MANHAJ_BOOK_ID && sharhManhajIndex.has(num);
    const hasSharhVideo = sharhVideoIndex.has(`${currentBookId}::${num}`);
    const hasAnySharh = hasSharh || hasSharhManhaj || hasSharhVideo;
    const favClass = isFav ? 'masala-fav-persistent' : '';
    const noteDisplay = existingNote
      ? `<div class="note-display" id="note-display-${sectionIdx}-${num}"><i class="ti ti-pencil"></i> ${escapeHtml(existingNote)}</div>`
      : `<div class="note-display" id="note-display-${sectionIdx}-${num}" style="display:none;"></div>`;
    let leadFlags = '';
    if (hasComparison) leadFlags += `<span class="ms-cmp-flag ms-inline-flag" title="آراء مراجع أخرى" onclick="toggleComparisonAccordion(event, ${sectionIdx}, '${num}')">!</span>`;
    if (hasAnySharh) leadFlags += `<span class="ms-sharh-flag ms-inline-flag" title="شروحات هذه المسألة" onclick="toggleSharhChooser(event, ${sectionIdx}, '${num}')"><i class="ti ti-book-2"></i></span>`;
    const innerWithFlags = leadFlags
      ? inner.replace(/(class="ms-num">[^<]*<\/span>)/, `$1${leadFlags}`)
      : inner;
    html += `<div class="masala-block ${favClass}" ${isFav ? `style="background:${hexToRgba(starColorValue(favColorOf(currentBookId, sectionIdx, num)), 0.12)}"` : ''} data-masala="${num}" data-section-idx="${sectionIdx}" data-blocktype="${blockType}">
      <div class="masala-tools">
        <button title="نسخ" onclick="copyMasala(event, ${sectionIdx}, '${num}')"><i class="ti ti-clipboard"></i></button>
        <button title="إشارة مرجعية (ضغطة/ضغطتان/مطوّلة للألوان)" class="${isFav ? 'bm-active' : ''}" ${isFav ? `style="color:${starColorValue(favColorOf(currentBookId, sectionIdx, num))};background:${hexToRgba(starColorValue(favColorOf(currentBookId, sectionIdx, num)), 0.16)}"` : ''} onclick="starTap(event, ${sectionIdx}, '${num}')" onpointerdown="starPressStart(event, ${sectionIdx}, '${num}')" onpointerup="starPressEnd()" onpointerleave="starPressEnd()" onpointercancel="starPressEnd()" oncontextmenu="return false"><i class="ti ti-star"></i></button>
        <button title="ملاحظة" class="${existingNote ? 'note-active' : ''}" onclick="toggleNoteEditor(event, ${sectionIdx}, '${num}')"><i class="ti ti-pencil"></i></button>
        <button title="إضافة لكتابي" onclick="addMasalaToCustomBook(event, ${sectionIdx}, '${num}')"><i class="ti ti-file-plus"></i></button>
      </div>
      ${innerWithFlags}
      ${hasComparison ? `<div class="cmp-accordion" id="cmp-acc-${sectionIdx}-${num}"></div>` : ''}
      ${hasAnySharh ? `<div class="sharh-accordion" id="sharh-chooser-${sectionIdx}-${num}"></div>` : ''}
      ${noteDisplay}
      <div class="note-accordion" id="note-acc-${sectionIdx}-${num}"></div>
    </div>`;
  }
  return html;
}

const SUBLIST_ORDINAL_WORD_SRC = `()()((?:أولاً|أولا|ثانياً|ثانيا|ثالثاً|ثالثا|رابعاً|رابعا|خامساً|خامسا|سادساً|سادسا|سابعاً|سابعا|ثامناً|ثامنا|تاسعاً|تاسعا|عاشراً|عاشرا)(?:\\s|<br>)*[:\\-ـ])`;
const SUBLIST_ORDINAL_DEF_SRC = `()()((?:\\(\\s*)?(?:الأولى|الأول|الثانية|الثاني|الثالثة|الثالث|الرابعة|الرابع|الخامسة|الخامس|السادسة|السادس|السابعة|السابع|الثامنة|الثامن|التاسعة|التاسع|العاشرة|العاشر)(?:\\s*\\))?(?:\\s|<br>)*:)`;
const SUBLIST_SPELLED_DIGIT_SRC = `(^|<br>)(\\s*)((?:واحد|اثنان|اثنين|ثلاثة|أربعة|خمسة|ستة|سبعة|ثمانية|تسعة|عشرة)(?:\\s|<br>)*[:\\-])`;
const SUBLIST_DASH_NUM_SRC = `(^|<br>|:)(\\s*)([0-9\\u06F0-\\u06F9\\u0660-\\u0669]{1,3}(?:\\s|<br>)*[-ـ])`;
const SUBLIST_DOT_NUM_SRC = `(^|<br>|:)(\\s*)([0-9\\u06F0-\\u06F9\\u0660-\\u0669]{1,3}(?:\\s|<br>)*\\.(?!\\d))`;
const SUBLIST_CLOSEPAREN_NUM_SRC = `(^|<br>|:)(\\s*)([0-9\\u06F0-\\u06F9\\u0660-\\u0669]{1,3}(?:\\s|<br>)*\\))`;
const SUBLIST_ALPHA_ENUM_SRC = `(^|<br>)(\\s*)((?:أ|ب|ج|د|هـ|و|ز|ح|ط|ي)(?:\\s|<br>)*[-–.\\)ـ])`;
const SUBLIST_PAREN_DIGIT_SRC = `()()(\\((?:\\s|<br>)*([0-9\\u06F0-\\u06F9\\u0660-\\u0669]{1,2})(?:\\s|<br>)*\\))`;
const SUBLIST_PAREN_DIGIT_EXCLUDE_BEFORE_RE = /(?:المسأل[ةه]|مسأل[ةه]|السؤال|سؤال)(?:\s|<br>)*$/;
function highlightSublistNumbering(html) {
  html = diacriticTolerantWrap(html, SUBLIST_ORDINAL_WORD_SRC, 'ms-sublist');
  html = diacriticTolerantWrap(html, SUBLIST_ORDINAL_DEF_SRC, 'ms-sublist');
  html = diacriticTolerantWrap(html, SUBLIST_SPELLED_DIGIT_SRC, 'ms-sublist');
  html = diacriticTolerantWrap(html, SUBLIST_DASH_NUM_SRC, 'ms-sublist');
  html = diacriticTolerantWrap(html, SUBLIST_DOT_NUM_SRC, 'ms-sublist');
  html = diacriticTolerantWrap(html, SUBLIST_CLOSEPAREN_NUM_SRC, 'ms-sublist');
  html = diacriticTolerantWrap(html, SUBLIST_ALPHA_ENUM_SRC, 'ms-sublist');
  html = diacriticTolerantWrap(html, SUBLIST_PAREN_DIGIT_SRC, 'ms-sublist', (h, pos, numStr) => {
    if (numStr != null && numFromMarkerStr(numStr) > 20) return true;
    const before = h.slice(Math.max(0, pos - 30), pos);
    return SUBLIST_PAREN_DIGIT_EXCLUDE_BEFORE_RE.test(before);
  });
  return html;
}

function footnoteItemVisible(r, settings) {
  if (!r) return false;
  if (r.lead && r.lead !== (settings.lead || 'o')) return false;
  if (r.jurist && settings.hidden[r.jurist]) return false;
  if (Array.isArray(r.of) && r.of.length && r.of.every(n => settings.hidden[n])) return false;
  return true;
}
function footnoteHasVisible(entry) {
  if (!Array.isArray(entry)) return !(entry === '' || entry == null);
  const settings = getJuristSettings();
  return entry.some(r => footnoteItemVisible(r, settings));
}

const _urwaCtxCache = {};
function urwaContextLabel(bookId, sectionIdx) {
  try {
    if (!isUrwaBook(bookId) || typeof sectionIdx !== 'number') return '';
    const book = allBooks.find(b => b.id === bookId);
    if (!book) return '';
    const key = book.bk_table;
    if (!_urwaCtxCache[key]) {
      _urwaCtxCache[key] = {
        books: (URWA_BOOK_MAP[key] || []).slice().sort((a, b) => a.r - b.r),
        fasls: (URWA_FASL_EVENTS[key] || []).slice().sort((a, b) => a.r - b.r)
      };
    }
    const { books, fasls } = _urwaCtxCache[key];
    const rowid = sectionIdx + 1;
    let bookEv = null;
    for (const ev of books) { if (ev.r <= rowid) bookEv = ev; else break; }
    if (!bookEv) return '';
    let fasl = null;
    for (const ev of fasls) { if (ev.r >= bookEv.r && ev.r <= rowid) fasl = ev.n; }
    if (fasl) { fasl = String(fasl).split(' ◂ ')[0]; if (fasl.length > 70) fasl = fasl.slice(0, 68) + '…'; }
    return fasl ? `${bookEv.n} › ${fasl}` : bookEv.n;
  } catch (e) { return ''; }
}

function footnoteMarkerClass(entry) {
  if (!Array.isArray(entry)) return 'fn-ref';
  const settings = getJuristSettings();
  const visible = entry.filter(r => footnoteItemVisible(r, settings));
  if (visible.some(r => r.jurist && settings.favorite[r.jurist])) return 'fn-ref fn-ref-fav';
  return 'fn-ref';
}

const ANSWER_FULL_WORD_BOOK_IDS = new Set([17, 56, 84, 85, 86, 87, 88, 101, 102, 103, 104, 105, 106, 107, 108, 109]);
const ANSWER_ABBR_BOOK_IDS = new Set([5, 6, 7, 9, 33, 62, 84, 85, 86, 87, 88, 101, 102, 103, 104, 105, 106, 107, 108, 109]);
const ANSWER_FULL_WORD_SRC = `(^|<br>)(\\s*)(و?(?:الجواب|الجوب)(?:\\s|<br>)*[:.])`;
const ANSWER_ABBR_SRC = `(^|<br>)(\\s*)(ج(?:\\s|<br>)*:)`;
function highlightAnswerMarker(html, bookId) {
  if (ANSWER_FULL_WORD_BOOK_IDS.has(bookId)) {
    html = diacriticTolerantWrap(html, ANSWER_FULL_WORD_SRC, 'ms-answer');
  }
  if (ANSWER_ABBR_BOOK_IDS.has(bookId)) {
    html = diacriticTolerantWrap(html, ANSWER_ABBR_SRC, 'ms-answer');
  }
  return html;
}

function formatPlainText(text, footnotes, sectionIdx) {
  let html = escapeHtml(text).replace(/\n/g, '<br>');
  const activePatterns = getMarkerPatterns(currentBookId);
  html = diacriticTolerantWrap(
    html, `(^|<br>)(\\s*)(${activePatterns.htmlSrc})`, 'ms-num',
    (h, pos, _g, len) => isMarkerPrecededByReferenceCue(h, pos) || isCrossRowSuppressed(h, pos, len, currentBookId)
  );
  html = highlightAnswerMarker(html, currentBookId);
  html = highlightSublistNumbering(html);
  if (ensureGlossaryBuilt()) {
    html = highlightGlossaryTerms(html);
  }
  if (footnotes && footnotes.length) {
    html = html.replace(/((?:<[^>]+>|[^\s\[<])+)?( ?)\[(\d+)\]/g, (whole, word, sp, n) => {
      const i = parseInt(n, 10);
      if (i < 1 || i > footnotes.length) return whole;
      const entry = footnotes[i - 1];
      const wordHtml = word ? `<span class="fn-word">${word}</span>` : '';
      if (!footnoteHasVisible(entry)) return word ? wordHtml + sp : sp;
      const cls = footnoteMarkerClass(entry);
      return `${wordHtml}${word ? '' : sp}<sup class="${cls}" onclick="toggleFootnote(event, ${sectionIdx}, ${i})">[${n}]</sup><span class="fn-body" id="fn-body-${sectionIdx}-${i}"></span>`;
    });
  }
  return html;
}

function buildFootnoteEntryHtml(entry) {
  const isEmptyEntry = entry === '' || entry == null || (Array.isArray(entry) && entry.length === 0);
  if (isEmptyEntry) {
    return '<div class="fn-remark fn-remark-empty">— لم يُعثر على نص هذه الحاشية في المصدر —</div>';
  }
  if (Array.isArray(entry)) {
    const settings = getJuristSettings();
    let remarks = entry.filter(r => footnoteItemVisible(r, settings));
    remarks = remarks.slice().sort((a, b) => {
      const ia = a.jurist ? settings.order.indexOf(a.jurist) : -1;
      const ib = b.jurist ? settings.order.indexOf(b.jurist) : -1;
      if (ia === -1 && ib === -1) return 0;
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
    if (!remarks.length) {
      return '<div class="fn-remark fn-remark-empty">— لا يوجد رأي ظاهر هنا حسب إعدادات الحواشي الحالية —</div>';
    }
    return remarks.map(r => {
      const isFav = r.jurist && settings.favorite[r.jurist];
      return `<div class="fn-remark ${isFav ? 'fn-remark-fav' : ''}">
        <i class="ti ti-quote"></i> ${escapeHtml(r.text)}
        ${r.jurist ? `<span class="fn-remark-author">(${escapeHtml(r.jurist)})</span>` : ''}
      </div>`;
    }).join('');
  }
  const lines = String(entry).split('\n').filter(l => l.trim());
  if (lines.length > 1) {
    return lines.map(l => `<div class="fn-remark"><i class="ti ti-quote"></i> ${escapeHtml(l)}</div>`).join('');
  }
  return `<i class="ti ti-quote"></i> ${escapeHtml(entry)}`;
}

function toggleFootnote(evt, sectionIdx, num) {
  evt.stopPropagation();
  const el = document.getElementById(`fn-body-${sectionIdx}-${num}`);
  if (!el) return;
  if (el.classList.contains('open')) { el.classList.remove('open'); return; }
  if (!el.dataset.built) {
    const sec = currentSections[sectionIdx];
    const entry = (sec && sec.footnotes && sec.footnotes[num - 1]) || '';
    el.innerHTML = buildFootnoteEntryHtml(entry);
    el.dataset.built = '1';
  }
  el.classList.add('open');
}

function highlightGlossaryTerms(html) {
  return html.replace(/(<[^>]+>)|([^<]+)/g, (match, tag, txt) => {
    if (tag) return tag;
    if (!txt || !txt.trim()) return txt;
    return linkGlossaryInText(txt);
  });
}

function linkGlossaryInText(txt) {
  const TOKEN_RE = /[\u0600-\u06FF\u0610-\u061A\u064B-\u065F]+[\s\u00A0]*/g;
  const tokens = [];
  let m;
  let lastEnd = 0;
  const wordRE = /[\u0600-\u06FF\u0610-\u061A\u064B-\u065F]+/g;
  const allWords = [];
  while ((m = wordRE.exec(txt)) !== null) {
    allWords.push({ word: m[0], start: m.index, end: m.index + m[0].length });
  }

  if (!allWords.length) return txt;

  let result = '';
  let i = 0;
  let cursor = 0;

  while (i < allWords.length) {
    const startPos = allWords[i].start;
    result += txt.slice(cursor, startPos);

    let matched = false;
    const maxLen = Math.min(6, allWords.length - i);
    for (let len = maxLen; len >= 1; len--) {
      const phraseStart = allWords[i].start;
      const phraseEnd   = allWords[i + len - 1].end;
      const phrase = txt.slice(phraseStart, phraseEnd).replace(/\s+$/, '');
      const normalizedPhrase = normalizeArabicForLookup(phrase);
      if (glossaryTermsSet.has(phrase) || glossaryTermsSet.has(normalizedPhrase)) {
        const displayPhrase = txt.slice(phraseStart, phraseEnd);
        const lookupKey = glossaryTermsSet.has(phrase) ? phrase : normalizedPhrase;
        result += `<span class="gterm" onclick="openGlossaryPopup('${escapeJsAttr(lookupKey)}')">${txt.slice(phraseStart, phraseEnd)}</span>`;
        cursor = phraseEnd;
        i += len;
        matched = true;
        break;
      }
    }
    if (!matched) {
      result += txt.slice(startPos, allWords[i].end);
      cursor = allWords[i].end;
      i++;
    }
  }
  result += txt.slice(cursor);
  return result;
}

function normalizeArabicForLookup(s) {
  return s.replace(/[إأآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
}

function escapeJsAttr(s) { return s.replace(/'/g, "\\'"); }

function navSection(delta) {
  const newIdx = currentSectionIndex + delta;
  if (newIdx < 0 || newIdx >= currentSections.length) return;
  scrollToSection(newIdx, { smooth: true, direction: delta });
  saveLastPosition();
}

function triggerPageTransition(delta) {
  const bar = document.getElementById('pageTransitionBar');
  if (!bar) return;
  bar.classList.remove('sweep-next', 'sweep-prev');
  void bar.offsetWidth;
  bar.classList.add(delta > 0 ? 'sweep-next' : 'sweep-prev');
}

function setupSwipeNavigation() {
  const content = document.getElementById('content');
  let startX = 0, startY = 0, tracking = false;
  content.addEventListener('touchstart', (e) => {
    const _inCmp = document.getElementById('comparisonPage').classList.contains('active') && cmpNav.level === 'compare';
    if (!_inCmp && !document.getElementById('readerPage').classList.contains('active')) { tracking = false; return; }
    if (e.touches.length !== 1 || !RSUI.pref('swipe')) { tracking = false; return; }
    if (e.target && e.target.closest && e.target.closest('.thamra-table-wrap')) { tracking = false; return; }
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    tracking = true;
  }, { passive: true });
  content.addEventListener('touchend', (e) => {
    if (!tracking) return;
    tracking = false;
    if (window.__rsPinching) return;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const direction = dx > 0 ? 1 : -1;
    if (document.getElementById('comparisonPage').classList.contains('active')) {
      if (cmpNav.level === 'compare') navCmpSubject(direction);
      return;
    }
    if (isThamraBook(currentBookId) && currentThamraSections.length) {
      thamraStepSection(direction);
      return;
    }
    if (searchResultContext) {
      navSearchResult(direction);
    } else {
      navSection(direction);
    }
  }, { passive: true });

  content.addEventListener('scroll', () => {
    updateScrollbar();
    scheduleActiveSectionUpdate();
    rwCheck();
    scheduleReaderFabVisibility();
    scheduleDistantSectionsUnrender();
  }, { passive: true });
  setupUnifiedScrollbar();
}

let lastFabScrollTop = 0;
let fabStopTimer = null;
function positionReaderFab() {
  const fab = document.getElementById('readerFab');
  if (fab) fab.style.bottom = '';
}

function showReaderFab() {
  const fab = document.getElementById('readerFab');
  fab.classList.add('show');
  fab.classList.remove('hidden-scroll');
}
function hideReaderFabEntirely() {
  document.getElementById('readerFab').classList.remove('show');
}
function scheduleReaderFabVisibility() {
  const content = document.getElementById('content');
  const fab = document.getElementById('readerFab');
  const delta = content.scrollTop - lastFabScrollTop;
  lastFabScrollTop = content.scrollTop;
  if (delta > 4) {
    fab.classList.add('hidden-scroll');
  } else if (delta < -4 || content.scrollTop < 20) {
    fab.classList.remove('hidden-scroll');
  }
  clearTimeout(fabStopTimer);
  fabStopTimer = setTimeout(() => fab.classList.remove('hidden-scroll'), 320);
}

let activeSectionRafPending = false;
let activeSectionSaveTimer = null;
function scheduleActiveSectionUpdate() {
  if (!document.getElementById('readerPage').classList.contains('active')) return;
  if (typeof isThamraBook === 'function' && isThamraBook(currentBookId) && currentThamraSections.length) {
    if (isPageFlipMode() || Date.now() < programmaticScrollLockUntil || activeSectionRafPending) return;
    activeSectionRafPending = true;
    requestAnimationFrame(() => { activeSectionRafPending = false; if (Date.now() >= programmaticScrollLockUntil) updateThamraActiveFromScroll(); });
    return;
  }
  if (isPageFlipMode()) {
    clearTimeout(activeSectionSaveTimer);
    activeSectionSaveTimer = setTimeout(saveLastPosition, 400);
    return;
  }
  if (Date.now() < programmaticScrollLockUntil) return;
  if (activeSectionRafPending) return;
  activeSectionRafPending = true;
  requestAnimationFrame(() => {
    activeSectionRafPending = false;
    if (Date.now() < programmaticScrollLockUntil) return;
    updateActiveSectionFromScroll();
  });
}
function updateActiveSectionFromScroll() {
  const content = document.getElementById('content');
  const threshold = content.getBoundingClientRect().top + 12;
  const sections = document.querySelectorAll('#readerPage .reader-section');
  let activeIdx = currentSectionIndex;
  for (const el of sections) {
    if (el.getBoundingClientRect().top <= threshold) {
      activeIdx = parseInt(el.dataset.sectionIdx, 10);
    } else break;
  }
  if (activeIdx !== currentSectionIndex) {
    currentSectionIndex = activeIdx;
    recomputeCurrentSectionScrollBounds();
    updateScrollbar();
    updateReaderFabState();
    if (allBooks.find(b => b.id === currentBookId)) updateBreadcrumbForCurrentSection();
  }
  clearTimeout(activeSectionSaveTimer);
  activeSectionSaveTimer = setTimeout(saveLastPosition, 400);
}


let curSectionScrollBounds = { top: 0, bottom: 0 };

function extScrollKind() {
  const cmp = document.getElementById('comparisonPage');
  if (cmp && cmp.classList.contains('active') && typeof cmpNav !== 'undefined' && cmpNav.level === 'compare') return 'cmp';
  const rp = document.getElementById('readerPage');
  if (rp && rp.classList.contains('active') && isThamraBook(currentBookId) && currentThamraSections.length) return 'thamra';
  return 'book';
}
function extScrollBounds(kind, content) {
  const total = Math.max(0, content.scrollHeight);
  if (kind === 'thamra' && isThamraContinuousMode()) {
    const cr = content.getBoundingClientRect();
    const el = document.querySelector(`#readerPage [data-thamra-section-idx="${currentThamraSectionIndex}"]`);
    if (!el) return { top: 0, bottom: 0 };
    const next = document.querySelector(`#readerPage [data-thamra-section-idx="${currentThamraSectionIndex + 1}"]`);
    const er = el.getBoundingClientRect();
    const top = er.top - cr.top + content.scrollTop;
    const bottom = next ? next.getBoundingClientRect().top - cr.top + content.scrollTop : er.bottom - cr.top + content.scrollTop;
    return { top, bottom };
  }
  return { top: 0, bottom: total };
}
function thamraSyncBreadcrumb() {
  const book = allBooks.find(b => b.id === currentBookId);
  const sec = currentThamraSections[currentThamraSectionIndex];
  if (!book || !sec) return;
  const authorLabel = allAuthors[book.author_id] || allAuthors[GLOSSARY_AUTHOR_ID];
  showBreadcrumb([authorLabel, book.name, sec.text]);
  lastBooksBreadcrumb = [authorLabel, book.name, sec.text];
}
function updateThamraActiveFromScroll() {
  if (!isThamraContinuousMode()) return;
  const content = document.getElementById('content');
  const threshold = content.getBoundingClientRect().top + 12;
  let active = currentThamraSectionIndex;
  for (const el of document.querySelectorAll('#readerPage [data-thamra-section-idx]')) {
    if (el.getBoundingClientRect().top <= threshold) active = parseInt(el.dataset.thamraSectionIdx, 10);
    else break;
  }
  if (!isNaN(active) && active !== currentThamraSectionIndex) {
    currentThamraSectionIndex = active;
    thamraSyncBreadcrumb();
    updateScrollbar();
  }
}
function thamraStepSection(delta) {
  const newIdx = currentThamraSectionIndex + delta;
  if (newIdx < 0 || newIdx >= currentThamraSections.length) return;
  if (!isThamraContinuousMode()) { navThamraSection(delta); return; }
  const el = document.querySelector(`#readerPage [data-thamra-section-idx="${newIdx}"]`);
  if (!el) return;
  lockActiveSectionTracking(400);
  currentThamraSectionIndex = newIdx;
  el.scrollIntoView({ behavior: 'auto', block: 'start' });
  thamraSyncBreadcrumb();
  updateScrollbar();
}
function extScrollLabel(kind) {
  if (kind === 'thamra') { const sec = currentThamraSections[currentThamraSectionIndex]; return sec ? sec.text : ''; }
  try { const sub = loadCmpData().subjectsById.get(cmpNav.subjectId); return sub ? sub.name : ''; } catch (e) { return ''; }
}

function recomputeCurrentSectionScrollBounds() {
  const el = document.getElementById(`rs-sec-${currentSectionIndex}`);
  if (!el) { curSectionScrollBounds = { top: 0, bottom: 0 }; return; }
  const nextEl = document.getElementById(`rs-sec-${currentSectionIndex + 1}`);
  if (isPageFlipMode()) { curSectionScrollBounds = { top: el.offsetTop, bottom: el.offsetTop + el.offsetHeight }; return; }
  curSectionScrollBounds = {
    top: el.offsetTop,
    bottom: nextEl ? nextEl.offsetTop : el.offsetTop + el.offsetHeight,
  };
}

function nearestBlockToTop(content) {
  const activeSection = document.getElementById(`rs-sec-${currentSectionIndex}`);
  const blocks = activeSection ? activeSection.querySelectorAll('.masala-block') : [];
  if (!blocks.length) return null;
  let nearest = null, nearestDist = Infinity;
  const contentTop = content.getBoundingClientRect().top;
  blocks.forEach(b => {
    const dist = Math.abs(b.getBoundingClientRect().top - contentTop - 40);
    if (dist < nearestDist) { nearestDist = dist; nearest = b; }
  });
  return nearest;
}

function updateScrollbar() {
  const content = document.getElementById('content');
  const track = document.getElementById('scrollbarTrack');
  const thumb = document.getElementById('scrollbarThumb');
  const _ek = track ? extScrollKind() : 'book';
  if (_ek !== 'book') {
    const b = extScrollBounds(_ek, content);
    curSectionScrollBounds = b;
    const h = b.bottom - b.top;
    const contSec = _ek === 'thamra' && isThamraContinuousMode();
    if (h <= 2 || (h <= content.clientHeight + 4 && !contSec)) { track.classList.remove('active'); return; }
    track.classList.add('active');
    const trackHeight = track.clientHeight;
    const thumbHeight = Math.max(52, Math.min(trackHeight, (content.clientHeight / h) * trackHeight));
    const pos = Math.max(0, Math.min(h, content.scrollTop - b.top));
    const ratio = Math.max(0, Math.min(1, pos / Math.max(1, h - content.clientHeight)));
    thumb.style.height = `${thumbHeight}px`;
    thumb.style.top = `${ratio * (trackHeight - thumbHeight)}px`;
    return;
  }
  if (!track || !document.getElementById('readerPage').classList.contains('active') || !currentSections.length) {
    if (track) track.classList.remove('active');
    return;
  }
  const { top, bottom } = curSectionScrollBounds;
  const sectionHeight = bottom - top;
  if (sectionHeight <= 2) { track.classList.remove('active'); return; }
  track.classList.add('active');
  const trackHeight = track.clientHeight;
  const thumbHeight = Math.max(52, Math.min(trackHeight, (content.clientHeight / sectionHeight) * trackHeight));
  const posWithinSection = Math.max(0, Math.min(sectionHeight, content.scrollTop - top));
  const maxPos = Math.max(1, sectionHeight - content.clientHeight);
  const ratio = Math.max(0, Math.min(1, posWithinSection / maxPos));
  thumb.style.height = `${thumbHeight}px`;
  thumb.style.top = `${ratio * (trackHeight - thumbHeight)}px`;
}

function showScrollLabel(thumbTopPx) {
  const content = document.getElementById('content');
  const label = document.getElementById('scrollbarLabel');
  const _lk = extScrollKind();
  if (_lk !== 'book') { label.textContent = extScrollLabel(_lk); label.style.top = `${thumbTopPx}px`; label.classList.add('show'); return; }
  const nearest = nearestBlockToTop(content);
  if (!nearest) {
    const sec = currentSections[currentSectionIndex];
    label.textContent = sec ? sec.title : '';
  } else {
    const typeLabel = nearest.dataset.blocktype || 'مسألة';
    label.textContent = `${typeLabel} ${nearest.dataset.masala}`;
  }
  label.style.top = `${thumbTopPx}px`;
  label.classList.add('show');
}
function hideScrollLabel() {
  document.getElementById('scrollbarLabel').classList.remove('show');
}

function setupUnifiedScrollbar() {
  const content = document.getElementById('content');
  const track = document.getElementById('scrollbarTrack');
  const thumb = document.getElementById('scrollbarThumb');
  let dragging = false;

  function scrollToTouch(clientY) {
    const trackRect = track.getBoundingClientRect();
    const thumbHeight = thumb.offsetHeight;
    const { top, bottom } = curSectionScrollBounds;
    const sectionHeight = bottom - top;
    const usable = trackRect.height - thumbHeight;
    const rawPos = clientY - trackRect.top - thumbHeight / 2;
    const pos = Math.max(0, Math.min(usable, rawPos));
    const ratio = usable > 0 ? pos / usable : 0;

    const edgeRatio = trackRect.height > 0
      ? Math.max(0, Math.min(1, (clientY - trackRect.top) / trackRect.height))
      : 0.5;

    if (sectionHeight <= content.clientHeight + 4) {
      if (edgeRatio >= 0.55 && hasAdjacent(1)) jumpToAdjacentSection(1);
      else if (edgeRatio < 0.55 && hasAdjacent(-1)) jumpToAdjacentSection(-1);
      return;
    }

    const maxPos = sectionHeight - content.clientHeight;
    content.scrollTop = top + ratio * maxPos;
    updateScrollbar();
    showScrollLabel(trackRect.top + pos);

    if (edgeRatio >= 0.94 && hasAdjacent(1)) {
      jumpToAdjacentSection(1);
    } else if (edgeRatio <= 0.06 && hasAdjacent(-1)) {
      jumpToAdjacentSection(-1);
    }
  }

  function hasAdjacent(dir) {
    const k = extScrollKind();
    if (k === 'cmp') return false;
    if (k === 'thamra') {
      if (!isThamraContinuousMode()) return false;
      return dir > 0 ? currentThamraSectionIndex < currentThamraSections.length - 1 : currentThamraSectionIndex > 0;
    }
    return dir > 0 ? currentSectionIndex < currentSections.length - 1 : currentSectionIndex > 0;
  }

  function jumpToAdjacentSection(dir) {
    if (extScrollKind() === 'thamra') {
      lockActiveSectionTracking(200);
      currentThamraSectionIndex += dir;
      const b = extScrollBounds('thamra', content);
      curSectionScrollBounds = b;
      content.scrollTop = dir > 0 ? b.top : Math.max(0, b.bottom - content.clientHeight);
      thamraSyncBreadcrumb();
      updateScrollbar();
      return;
    }
    lockActiveSectionTracking(200);
    currentSectionIndex += dir;
    ensureSectionRendered(currentSectionIndex);
    recomputeCurrentSectionScrollBounds();
    content.scrollTop = dir > 0
      ? curSectionScrollBounds.top
      : Math.max(0, curSectionScrollBounds.bottom - content.clientHeight);
    updateReaderFabState();
    updateBreadcrumbForCurrentSection();
    updateScrollbar();
  }

  track.addEventListener('touchstart', (e) => {
    dragging = true;
    thumb.classList.add('dragging');
    scrollToTouch(e.touches[0].clientY);
    e.preventDefault();
  }, { passive: false });

  document.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    e.preventDefault();
    scrollToTouch(e.touches[0].clientY);
  }, { passive: false });

  document.addEventListener('touchend', () => {
    if (!dragging) return;
    dragging = false;
    thumb.classList.remove('dragging');
    hideScrollLabel();
  });

  const observer = new MutationObserver(() => updateScrollbar());
  observer.observe(content, { childList: true, subtree: true });
  window.addEventListener('resize', updateScrollbar);
  window.addEventListener('resize', positionReaderFab);
  setInterval(updateScrollbar, 600);
}


function setReadingHeader(sectionTitle, bookName) {
  const el = document.getElementById('pageTitle');
  if (!el) return;
  const rp = document.getElementById('readerPage');
  if (!rp || !rp.classList.contains('active')) return;
  el.innerHTML = '';
  const main = document.createElement('span');
  main.textContent = sectionTitle || bookName;
  el.appendChild(main);
  if (sectionTitle && bookName) {
    const sub = document.createElement('span');
    sub.className = 'title-sub';
    sub.textContent = bookName;
    sub.onclick = () => openTocDrawer();
    el.appendChild(sub);
  }
  document.body.classList.add('reading-compact');
}
function clearReadingHeader() { document.body.classList.remove('reading-compact'); }

function nearestNonEmptySectionTitle(sectionIdx) {
  for (let i = sectionIdx; i >= 0; i--) {
    const t = currentSections[i] && currentSections[i].title ? currentSections[i].title.trim() : '';
    if (t) return t;
  }
  return '';
}
function updateBreadcrumbForCurrentSection() {
  { const rp = document.getElementById('readerPage'); if (!rp || !rp.classList.contains('active')) return; }
  const book = allBooks.find(b => b.id === currentBookId);
  if (!book) return;
  const authorLabel = allAuthors[book.author_id] || allAuthors[GLOSSARY_AUTHOR_ID];
  const title = nearestNonEmptySectionTitle(currentSectionIndex);
  setReadingHeader(title, book.name);
  showBreadcrumb([book.name]);
  lastBooksBreadcrumb = [authorLabel, book.name, title];
  if (searchTabActive) lastSearchPageBreadcrumb = lastBooksBreadcrumb;
}

let exitConfirmPending = false;
let exitConfirmTimeout = null;
function closeTopOverlayOnBack() {
  try { if (RSUI.closeAll()) return true; } catch (e) {}
  const order = [['glossaryOverlay', closeGlossaryPopup], ['advancedSettingsOverlay', closeAdvancedSettings], ['helpOverlay', closeHelp], ['aboutOverlay', closeAbout], ['settingsOverlay', closeSettings],
    ['juristSettingsOverlay', closeJuristSettingsPanel], ['thamraJuristSettingsOverlay', closeThamraJuristSettingsPanel], ['cmpScholarSettingsOverlay', closeCmpScholarSettingsPanel],
    ['pinPickerOverlay', closePinPicker], ['colMemberPickerOverlay', closeCollectionMemberPicker], ['cbPickerOverlay', closeCbPicker], ['savedPositionsOverlay', closeSavedPositionsList]];
  for (const [id, fn] of order) { const e = document.getElementById(id); if (e && e.classList.contains('show')) { fn(); return true; } }
  return false;
}
function setupHardwareBack() {
  history.pushState({ rsGuard: true }, '');
  window.addEventListener('popstate', () => {
    if (closeTopOverlayOnBack()) { requestAnimationFrame(() => { history.pushState({ rsGuard: true }, ''); }); return; }
    if (navStack.length > 0) {
      const prev = navStack.pop();
      isNavigatingBack = true;
      try { prev(); } finally { isNavigatingBack = false; }
      updateBackButtonVisibility();
      requestAnimationFrame(() => { history.pushState({ rsGuard: true }, ''); });
      return;
    }
    if (!RSUI.pref('exitc')) return;
    requestAnimationFrame(() => { history.pushState({ rsGuard: true }, ''); });
    showExitToast();
  });
  (function () {
    let done = false;
    const arm = () => {
      if (done) return; done = true;
      ['pointerdown', 'touchstart', 'keydown', 'click'].forEach((ev) => document.removeEventListener(ev, arm, true));
      try { history.pushState({ rsGuard: true }, ''); } catch (e) {}
    };
    ['pointerdown', 'touchstart', 'keydown', 'click'].forEach((ev) => document.addEventListener(ev, arm, { capture: true, passive: true }));
  })();
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) {
      requestAnimationFrame(() => { history.pushState({ rsGuard: true }, ''); });
    }
  });
}

function showExitToast() {
  const toast = document.getElementById('exitToast');
  toast.classList.add('show');
  clearTimeout(toast._hideTimeout);
  toast._hideTimeout = setTimeout(() => toast.classList.remove('show'), 2000);
}


function getMasalaText(sectionIdx, num) {
  const sec = currentSections[sectionIdx];
  if (!sec) return '';
  const patterns = getMarkerPatterns(currentBookId);
  const parts = splitByMarker(sec.body, patterns.src, patterns.capture, currentBookId);
  for (const part of parts) {
    const m = part.match(patterns.capture);
    if (m && normalizeDigits(m[1] || m[2] || m[3] || m[4] || m[5]) === num) return part.trim();
  }
  return '';
}

function buildMasalaFootnotesCopyText(sectionIdx, masalaText) {
  const sec = currentSections[sectionIdx];
  const fns = sec && sec.footnotes;
  if (!fns || !fns.length || !masalaText) return '';
  const settings = getJuristSettings();
  const seen = new Set(), nums = [];
  const re = /\[(\d+)\]/g;
  let m;
  while ((m = re.exec(masalaText)) !== null) {
    const n = parseInt(m[1], 10);
    if (n >= 1 && n <= fns.length && !seen.has(n)) { seen.add(n); nums.push(n); }
  }
  const blocks = [];
  nums.forEach(n => {
    const entry = fns[n - 1];
    let lines = [];
    if (Array.isArray(entry)) {
      const remarks = entry.filter(r => footnoteItemVisible(r, settings)).slice().sort((a, b) => {
        const ia = a.jurist ? settings.order.indexOf(a.jurist) : -1;
        const ib = b.jurist ? settings.order.indexOf(b.jurist) : -1;
        if (ia === -1 && ib === -1) return 0;
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
      });
      lines = remarks.map(r => String(r.text || '').trim() + (r.jurist ? ` (${r.jurist})` : '')).filter(l => l.trim());
    } else if (entry) {
      lines = String(entry).split('\n').map(l => l.trim()).filter(Boolean);
    }
    if (lines.length) blocks.push(`[${n}] ` + lines.join('\n    '));
  });
  return blocks.length ? 'الحواشي:\n' + blocks.join('\n') : '';
}

function copyMasala(evt, sectionIdx, num) {
  evt.stopPropagation();
  const text = getMasalaText(sectionIdx, num);
  if (!text) return;
  const book = allBooks.find(b => b.id === currentBookId);
  const authorName = (allAuthors[book.author_id] || allAuthors[GLOSSARY_AUTHOR_ID] || '').trim();
  const sectionTitle = currentSections[sectionIdx] ? currentSections[sectionIdx].title : '';
  const fnText = isUrwaBook(currentBookId) ? buildMasalaFootnotesCopyText(sectionIdx, text) : '';
  const citation = `${text}${fnText ? '\n\n' + fnText : ''}\n\nالمصدر: ${authorName} - ${book.name} - ${sectionTitle}`;
  try { if (window.RSShare) { const fc = favColorOf(currentBookId, sectionIdx, num); RSShare.meta = fc ? { color: starColorValue(fc) } : null; } } catch (e) {}
  rsCopyTextWithFlash(citation, evt.currentTarget);
}
function flashCopyButton(btn) {
  if (!btn) return;
  const old = btn.innerHTML;
  btn.innerHTML = '<i class="ti ti-check"></i>';
  setTimeout(() => { btn.innerHTML = old; }, 1000);
}

function isMasalaFavorite(bookId, sectionIdx, masalaNum) {
  return favorites.some(f => f.bookId === bookId && f.sectionIdx === sectionIdx && f.masalaNum === masalaNum);
}

function toggleMasalaFavorite(evt, sectionIdx, num) {
  evt.stopPropagation();
  const book = allBooks.find(b => b.id === currentBookId);
  const sec = currentSections[sectionIdx];
  const idx = favorites.findIndex(f => f.bookId === currentBookId && f.sectionIdx === sectionIdx && f.masalaNum === num);
  if (idx >= 0) {
    favorites.splice(idx, 1);
  } else {
    const snippet = getMasalaText(sectionIdx, num).slice(0, 90);
    favorites.push({ bookId: currentBookId, sectionIdx, title: sec.title, bookName: book.name, masalaNum: num, snippet });
  }
  localStorage.setItem('rs_favorites', JSON.stringify(favorites));
  evt.currentTarget.classList.toggle('bm-active');
  const block = document.querySelector(`#readerPage [data-section-idx="${sectionIdx}"].masala-block[data-masala="${num}"]`);
  if (block) block.classList.toggle('masala-fav-persistent', idx < 0);
}

const STAR_COLORS = { gold: '#d4a017', red: '#d9443a', green: '#2e9e5b', blue: '#2f7fd1', purple: '#8e5bd4', pink: '#d6568f' };
const STAR_PREFS_KEY = 'rs_star_prefs';
function getStarPrefs() {
  try { const p = JSON.parse(localStorage.getItem(STAR_PREFS_KEY) || '{}'); return { single: p.single || 'gold', double: p.double || 'red' }; }
  catch (e) { return { single: 'gold', double: 'red' }; }
}
function saveStarPrefs(p) { try { localStorage.setItem(STAR_PREFS_KEY, JSON.stringify(p)); } catch (e) {} }
function starColorValue(c) { return STAR_COLORS[c] || (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c : STAR_COLORS.gold); }
function favColorOf(bookId, sectionIdx, num) {
  const f = favorites.find(x => x.bookId === bookId && x.sectionIdx === sectionIdx && x.masalaNum === num);
  return f ? f.color : null;
}
function paintStar(sectionIdx, num) {
  const block = document.querySelector(`#readerPage [data-section-idx="${sectionIdx}"].masala-block[data-masala="${num}"]`);
  if (!block) return;
  const f = favorites.find(x => x.bookId === currentBookId && x.sectionIdx === sectionIdx && x.masalaNum === num);
  const btn = block.querySelector('.masala-tools button[title^="إشارة"]');
  block.classList.toggle('masala-fav-persistent', !!f);
  if (f) {
    const col = starColorValue(f.color);
    block.style.background = hexToRgba(col, 0.12);
    if (btn) { btn.classList.add('bm-active'); btn.style.color = col; btn.style.background = hexToRgba(col, 0.16); }
  } else {
    block.style.background = '';
    if (btn) { btn.classList.remove('bm-active'); btn.style.color = ''; btn.style.background = ''; }
  }
}
function setMasalaFavorite(sectionIdx, num, color, removeIfSame) {
  const book = allBooks.find(b => b.id === currentBookId);
  const sec = currentSections[sectionIdx];
  if (!book || !sec) return;
  const idx = favorites.findIndex(f => f.bookId === currentBookId && f.sectionIdx === sectionIdx && f.masalaNum === num);
  if (idx >= 0) {
    if (color === null) favorites.splice(idx, 1);
    else favorites[idx].color = color;
  } else if (color !== null) {
    const snippet = getMasalaText(sectionIdx, num).slice(0, 90);
    favorites.push({ bookId: currentBookId, sectionIdx, title: sec.title, bookName: book.name, masalaNum: num, snippet, color });
  }
  localStorage.setItem('rs_favorites', JSON.stringify(favorites));
  paintStar(sectionIdx, num);
}
let starPressTimer = null, starLongFired = false, starTapState = null;
function starPressStart(evt, si, num) {
  starLongFired = false; clearTimeout(starPressTimer);
  starPressTimer = setTimeout(() => { starLongFired = true; try { navigator.vibrate && navigator.vibrate(15); } catch (e) {} openStarSheet(si, num); }, 480);
}
function starPressEnd() { clearTimeout(starPressTimer); }
function starTap(evt, si, num) {
  evt.stopPropagation();
  if (starLongFired) { starLongFired = false; return; }
  const key = si + '|' + num;
  if (starTapState && starTapState.key === key) {
    clearTimeout(starTapState.t); starTapState = null;
    setMasalaFavorite(si, num, getStarPrefs().double);
    return;
  }
  starTapState = { key, t: setTimeout(() => {
    starTapState = null;
    const exists = favColorOf(currentBookId, si, num) !== null || favorites.some(f => f.bookId === currentBookId && f.sectionIdx === si && f.masalaNum === num);
    setMasalaFavorite(si, num, exists ? null : getStarPrefs().single);
  }, 270) };
}
let starSheetCtx = null;
function starDotsHtml(selected, fnName) {
  let h = '';
  for (const k of Object.keys(STAR_COLORS)) h += `<button class="star-dot ${selected === k ? 'sel' : ''}" style="background:${STAR_COLORS[k]}" onclick="${fnName}('${k}')"></button>`;
  const custom = /^#/.test(selected || '');
  h += `<button type="button" class="star-dot star-dot-custom ${custom ? 'sel' : ''}" style="${custom ? 'background:' + selected : ''}" title="لون مخصّص" onclick="starCustomColor('${fnName}', '${custom ? selected : '#d4a017'}')"><i class="ti ti-palette"></i></button>`;
  return h;
}
function starCustomColor(fnName, cur) {
  RSUI.pickColor({ title: 'لون النجمة', value: cur, presets: ['#d4a017', '#d9443a', '#2e9e5b', '#2f7fd1', '#8e5bd4', '#d6568f', '#8B5E34', '#4A5568', '#111111'], onApply: (c) => { if (typeof window[fnName] === 'function') window[fnName](c); } });
}
function openStarSheet(si, num) {
  starSheetCtx = { si, num };
  let ov = document.getElementById('starSheetOverlay');
  if (!ov) {
    ov = document.createElement('div'); ov.id = 'starSheetOverlay';
    ov.onclick = (e) => { if (e.target === ov) closeStarSheet(); };
    document.body.appendChild(ov);
  }
  renderStarSheet(); ov.classList.add('show');
}
function closeStarSheet() { const ov = document.getElementById('starSheetOverlay'); if (ov) ov.classList.remove('show'); }
function renderStarSheet() {
  const { si, num } = starSheetCtx;
  const prefs = getStarPrefs();
  const cur = favColorOf(currentBookId, si, num);
  const isFav = favorites.some(f => f.bookId === currentBookId && f.sectionIdx === si && f.masalaNum === num);
  document.getElementById('starSheetOverlay').innerHTML = `<div class="star-sheet">
    <div class="star-sheet-title"><i class="ti ti-star"></i> لون النجمة</div>
    <div class="star-sheet-label">لون هذه المسألة</div>
    <div class="star-dots">${starDotsHtml(isFav ? (cur || 'gold') : '', 'starPickNow')}</div>
    <div class="star-sheet-label">لون الضغطة الواحدة</div>
    <div class="star-dots">${starDotsHtml(prefs.single, 'starPrefSingle')}</div>
    <div class="star-sheet-label">لون الضغطتين المتتاليتين</div>
    <div class="star-dots">${starDotsHtml(prefs.double, 'starPrefDouble')}</div>
    ${isFav ? '<button class="star-remove" onclick="starRemoveNow()"><i class="ti ti-trash"></i> إزالة من المفضلة</button>' : ''}
  </div>`;
}
function starPickNow(c) { setMasalaFavorite(starSheetCtx.si, starSheetCtx.num, c); closeStarSheet(); }
function starPrefSingle(c) { const p = getStarPrefs(); p.single = c; saveStarPrefs(p); renderStarSheet(); }
function starPrefDouble(c) { const p = getStarPrefs(); p.double = c; saveStarPrefs(p); renderStarSheet(); }
function starRemoveNow() { setMasalaFavorite(starSheetCtx.si, starSheetCtx.num, null); closeStarSheet(); }

function getMasalaTextFromBook(bookId, masalaNum) {
  const book = allBooks.find(b => b.id === bookId);
  if (!book) return null;
  let rows;
  try {
    const res = db.exec(`SELECT body FROM "${book.bk_table}"`);
    rows = res.length ? res[0].values : [];
  } catch (e) { return null; }
  const patterns = getMarkerPatterns(bookId);
  for (const [body] of rows) {
    if (!body) continue;
    const parts = splitByMarker(body, patterns.src, patterns.capture, bookId);
    for (const part of parts) {
      const m = part.match(patterns.capture);
      if (m && normalizeDigits(m[1] || m[2] || m[3] || m[4] || m[5]) === masalaNum) return part.trim();
    }
  }
  return null;
}

function toggleComparisonAccordion(evt, sectionIdx, num) {
  evt.stopPropagation();
  const acc = document.getElementById(`cmp-acc-${sectionIdx}-${num}`);
  if (!acc) return;
  if (acc.classList.contains('open')) { acc.classList.remove('open'); return; }
  if (!acc.dataset.built) {
    const group = comparisonIndex.get(`${currentBookId}::${num}`);
    acc.innerHTML = renderComparisonGroupHtml(group, currentBookId, num, sectionIdx);
    acc.dataset.built = '1';
  }
  acc.classList.add('open');
}

function closeComparisonAccordion(sectionIdx, num) {
  const acc = document.getElementById(`cmp-acc-${sectionIdx}-${num}`);
  if (acc) acc.classList.remove('open');
}

function renderComparisonGroupHtml(group, excludeBookId, excludeMasalaNum, sectionIdx) {
  let html = `<div class="cmp-acc-title"><i class="ti ti-chart-bar"></i> آراء مراجع أخرى في هذه المسألة${group.topic ? ' — ' + escapeHtml(group.topic) : ''}</div>`;
  let any = false;
  for (const entry of group.entries) {
    if (entry.bookId === excludeBookId && entry.masalaNum === excludeMasalaNum) continue;
    const book = allBooks.find(b => b.id === entry.bookId);
    if (!book) continue;
    const text = getMasalaTextFromBook(entry.bookId, entry.masalaNum);
    if (!text) continue;
    any = true;
    const authorName = allAuthors[book.author_id] || '';
    html += `<div class="cmp-card">
      <div class="cmp-author">${escapeHtml(authorName)} — ${escapeHtml(book.name)}</div>
      <div class="cmp-text">${escapeHtml(text)}</div>
      <span class="cmp-goto" onclick="goToMasalaFromAccordion(${entry.bookId}, '${entry.masalaNum}')">عرض المسألة كاملة ‹</span>
    </div>`;
  }
  if (!any) html += `<div style="font-size:13px;color:var(--text-dim);">لا توجد بيانات لعرضها.</div>`;
  html += `<button class="cmp-acc-close" onclick="closeComparisonAccordion(${sectionIdx}, '${excludeMasalaNum}')">إغلاق</button>`;
  return html;
}

function goToMasalaFromAccordion(bookId, masalaNum) {
  const book = allBooks.find(b => b.id === bookId);
  if (!book) return;
  const res = db.exec(`SELECT rowid, title, body FROM "${book.bk_table}" ORDER BY rowid`);
  const sections = res.length ? res[0].values.map(r => ({ rowid: r[0], title: r[1] || '', body: r[2] || '' })) : [];
  const patterns = getMarkerPatterns(bookId);
  const idx = sections.findIndex(s => {
    const parts = splitByMarker(s.body, patterns.src, patterns.capture, bookId);
    return parts.some(p => {
      const m = p.match(patterns.capture);
      return m && normalizeDigits(m[1] || m[2] || m[3] || m[4] || m[5]) === masalaNum;
    });
  });
  navStack = [];
  pushNav(() => showTab(currentTab));
  openReader(bookId, idx >= 0 ? idx : 0);
}

let notes = JSON.parse(localStorage.getItem('rs_notes') || '[]');

function getNoteFor(bookId, sectionIdx, masalaNum) {
  const n = notes.find(x => x.bookId === bookId && x.sectionIdx === sectionIdx && x.masalaNum === masalaNum);
  return n ? n.text : null;
}

function saveNoteStorage() {
  localStorage.setItem('rs_notes', JSON.stringify(notes));
}

function setNoteFor(bookId, sectionIdx, masalaNum, text, title, bookName) {
  const idx = notes.findIndex(x => x.bookId === bookId && x.sectionIdx === sectionIdx && x.masalaNum === masalaNum);
  if (!text.trim()) {
    if (idx >= 0) notes.splice(idx, 1);
  } else if (idx >= 0) {
    notes[idx].text = text;
  } else {
    notes.push({ bookId, sectionIdx, masalaNum, text, title, bookName });
  }
  saveNoteStorage();
}

function toggleNoteEditor(evt, sectionIdx, num) {
  evt.stopPropagation();
  const acc = document.getElementById(`note-acc-${sectionIdx}-${num}`);
  if (!acc) return;
  if (acc.classList.contains('open')) { acc.classList.remove('open'); return; }
  const existing = getNoteFor(currentBookId, sectionIdx, num) || '';
  acc.innerHTML = `
    <div class="note-accordion-label"><i class="ti ti-pencil"></i> ملاحظتك على هذه المسألة</div>
    <textarea id="note-text-${sectionIdx}-${num}" placeholder="اكتب ملاحظتك هنا...">${escapeHtml(existing)}</textarea>
    <div class="note-acc-actions">
      <button class="note-save" onclick="saveNoteFromEditor(event, ${sectionIdx}, '${num}')">حفظ</button>
      <button class="note-cancel" onclick="closeInlineNoteEditor(${sectionIdx}, '${num}')">إغلاق</button>
    </div>`;
  acc.classList.add('open');
  setTimeout(() => {
    acc.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const ta = document.getElementById(`note-text-${sectionIdx}-${num}`);
    if (ta) ta.focus();
  }, 80);
}

function closeInlineNoteEditor(sectionIdx, num) {
  const acc = document.getElementById(`note-acc-${sectionIdx}-${num}`);
  if (acc) acc.classList.remove('open');
}

function saveNoteFromEditor(evt, sectionIdx, num) {
  evt.stopPropagation();
  const textarea = document.getElementById(`note-text-${sectionIdx}-${num}`);
  const book = allBooks.find(b => b.id === currentBookId);
  const sec = currentSections[sectionIdx];
  setNoteFor(currentBookId, sectionIdx, num, textarea.value, sec.title, book.name);
  closeInlineNoteEditor(sectionIdx, num);
  const btn = document.querySelector(`#readerPage [data-section-idx="${sectionIdx}"].masala-block[data-masala="${num}"] button[title="ملاحظة"]`);
  if (btn) btn.classList.toggle('note-active', !!textarea.value.trim());
  const display = document.getElementById(`note-display-${sectionIdx}-${num}`);
  if (display) {
    if (textarea.value.trim()) {
      display.innerHTML = '<i class="ti ti-pencil"></i> ' + escapeHtml(textarea.value);
      display.style.display = 'block';
    } else {
      display.style.display = 'none';
    }
  }
}


function isFavorite(bookId, sectionIdx) {
  return favorites.some(f => f.bookId === bookId && f.sectionIdx === sectionIdx && !f.masalaNum);
}

function toggleSectionFavoriteByIdx(idx) {
  const book = allBooks.find(b => b.id === currentBookId);
  const sec = currentSections[idx];
  if (!book || !sec) return;
  const favIdx = favorites.findIndex(f => f.bookId === currentBookId && f.sectionIdx === idx && !f.masalaNum);
  const nowFavorite = favIdx < 0;
  if (favIdx >= 0) {
    favorites.splice(favIdx, 1);
  } else {
    favorites.push({ bookId: currentBookId, sectionIdx: idx, title: sec.title, bookName: book.name });
  }
  localStorage.setItem('rs_favorites', JSON.stringify(favorites));
  const sectionEl = document.querySelector(`#rs-sec-${idx} .sec-fav-toggle`);
  if (sectionEl) sectionEl.classList.toggle('sec-fav-active', nowFavorite);
}


function switchFavSubTab(tab) {
  favSubTab = tab;
  localStorage.setItem('rs_fav_subtab', tab);
  renderFavoritesPage();
}

function swipeRow(contentHtml, actions) {
  const btns = actions.map(a => `<button class="swipe-btn" style="background:${a.color}" onclick="event.stopPropagation();closeAllSwipes();${a.js}"><i class="ti ti-${a.icon}"></i><span>${a.label}</span></button>`).join('');
  return `<div class="swipe-row" data-n="${actions.length}"><div class="swipe-actions">${btns}</div><div class="swipe-content">${contentHtml}</div></div>`;
}
const SWIPE_BTN_W = 78;
function closeAllSwipes(except) {
  document.querySelectorAll('.swipe-row.open').forEach(r => {
    if (r === except) return;
    r.classList.remove('open');
    const c = r.querySelector('.swipe-content'); if (c) { c.style.transition = ''; c.style.transform = ''; }
  });
}
(function initSwipeRows() {
  let cur = null, sx = 0, sy = 0, base = 0, W = 0, dragging = false, justDragged = false, lastT = 0;
  document.addEventListener('pointerdown', e => {
    const row = e.target.closest && e.target.closest('.swipe-row');
    if (!row) { closeAllSwipes(); return; }
    if (e.target.closest('.swipe-btn')) return;
    closeAllSwipes(row);
    cur = row; sx = e.clientX; sy = e.clientY; W = (+row.dataset.n || 1) * SWIPE_BTN_W;
    base = row.classList.contains('open') ? W : 0; dragging = false; lastT = base;
  }, true);
  document.addEventListener('pointermove', e => {
    if (!cur) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (!dragging) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        dragging = true;
        cur.querySelector('.swipe-content').style.transition = 'none';
        try { cur.setPointerCapture(e.pointerId); } catch (_) {}
      } else if (Math.abs(dy) > 12) { cur = null; return; }
    }
    if (dragging) {
      lastT = Math.max(0, Math.min(W, base + dx));
      cur.querySelector('.swipe-content').style.transform = `translateX(${lastT}px)`;
    }
  }, true);
  const end = () => {
    if (!cur) return;
    if (dragging) {
      const c = cur.querySelector('.swipe-content');
      c.style.transition = '';
      if (lastT > W * 0.4) { cur.classList.add('open'); c.style.transform = `translateX(${W}px)`; }
      else { cur.classList.remove('open'); c.style.transform = ''; }
      justDragged = true; setTimeout(() => { justDragged = false; }, 60);
    }
    cur = null; dragging = false;
  };
  document.addEventListener('pointerup', end, true);
  document.addEventListener('pointercancel', end, true);
  document.addEventListener('click', e => {
    const row = e.target.closest && e.target.closest('.swipe-row');
    if (!row || e.target.closest('.swipe-btn')) return;
    if (justDragged || row.classList.contains('open')) { e.stopPropagation(); e.preventDefault(); if (!justDragged) closeAllSwipes(); }
  }, true);
})();
function removeFavoriteAt(i) {
  openConfirmDialog('حذف هذه المسألة من المفضلة؟', () => {
    favorites.splice(i, 1); localStorage.setItem('rs_favorites', JSON.stringify(favorites)); renderFavoritesPage();
  });
}
function removeNoteAt(i) {
  openConfirmDialog('حذف هذا التعليق؟', () => { notes.splice(i, 1); saveNoteStorage(); renderFavoritesPage(); });
}
let favColorFilter = 'all';
function setFavColorFilter(c) { favColorFilter = c; renderFavoritesPage(); }
function renderFavoritesPage() {
  const container = document.getElementById('favoritesPage');
  if (currentTab === 'favorites') registerView(() => { renderFavoritesPage(); switchPage('favoritesPage', 'الاشارات المرجعية'); });
  if (favorites.length === 0 && notes.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="ic"><i class="ti ti-star"></i></div>لا توجد مسائل في المفضلة بعد<br>اضغط على <i class="ti ti-star"></i> أثناء القراءة لإضافتها</div>';
    return;
  }
  let html = `<div class="fav-subtabs">
    <button class="fav-subtab-btn ${favSubTab === 'starred' ? 'active' : ''}" onclick="switchFavSubTab('starred')">
      <i class="ti ti-star"></i> المفضلة <span class="fav-subtab-count">${favorites.length}</span>
    </button>
    <button class="fav-subtab-btn ${favSubTab === 'noted' ? 'active' : ''}" onclick="switchFavSubTab('noted')">
      <i class="ti ti-pencil"></i> عليها تعليق <span class="fav-subtab-count">${notes.length}</span>
    </button>
  </div>`;

  if (favSubTab === 'starred') {
    if (!favorites.length) {
      html += '<div class="empty-state"><div class="ic"><i class="ti ti-star"></i></div>لا توجد مسائل مفضَّلة بعد<br>اضغط على <i class="ti ti-star"></i> أثناء القراءة لإضافتها</div>';
    } else {
      const colorOrder = Object.keys(STAR_COLORS).map(k => STAR_COLORS[k]);
      const groups = new Map();
      favorites.forEach((f, i) => {
        const hex = starColorValue(f.color).toLowerCase();
        if (!groups.has(hex)) groups.set(hex, []);
        groups.get(hex).push({ f, i });
      });
      const hexes = Array.from(groups.keys()).sort((x, y) => {
        const ix = colorOrder.indexOf(x), iy = colorOrder.indexOf(y);
        return (ix === -1 ? 99 : ix) - (iy === -1 ? 99 : iy);
      });
      if (favColorFilter !== 'all' && !groups.has(favColorFilter)) favColorFilter = 'all';
      const colorName = (hex) => {
        const k = Object.keys(STAR_COLORS).find(key => STAR_COLORS[key].toLowerCase() === hex);
        return ({ gold: 'ذهبي', red: 'أحمر', green: 'أخضر', blue: 'أزرق', purple: 'بنفسجي', pink: 'وردي' })[k] || 'لون مخصّص';
      };
      html += `<div class="fav-color-chips">
        <button class="fav-color-chip ${favColorFilter === 'all' ? 'active' : ''}" onclick="setFavColorFilter('all')">الكل <span class="fav-subtab-count">${favorites.length}</span></button>
        ${hexes.map(h => `<button class="fav-color-chip ${favColorFilter === h ? 'active' : ''}" onclick="setFavColorFilter('${h}')"><span class="fav-color-dot" style="background:${h}"></span>${colorName(h)} <span class="fav-subtab-count">${groups.get(h).length}</span></button>`).join('')}
      </div>`;
      const rowHtml = (f, i, hex) => {
        const _ctx = urwaContextLabel(f.bookId, f.sectionIdx);
        const subtitle = f.kind ? (f.extSub || f.bookName) : (f.masalaNum ? `مسألة ${f.masalaNum} — ${f.bookName}` : f.bookName) + (_ctx && !f.urwaStale ? ` — ${_ctx}` : '');
        return swipeRow(`<div class="list-row fav-colored-row" style="border-inline-start:5px solid ${hex};" onclick="openFavorite(${i})">
          <div class="label">${escapeHtml(f.title)}<div class="sub">${escapeHtml(subtitle)}</div>${f.urwaStale ? '<div class="sub" style="color:#c0392b;">⚠ حُفظت قبل تحديث نص العروة؛ قد يشير الموضع لمسألة أخرى — راجعها</div>' : ''}</div>
        </div>`, [{icon:'trash',label:'حذف',color:'#c0392b',js:`removeFavoriteAt(${i})`}]);
      };
      favorites.map((f, i) => ({ f, i, hex: starColorValue(f.color).toLowerCase() }))
        .filter(x => favColorFilter === 'all' || x.hex === favColorFilter)
        .reverse()
        .forEach(({ f, i, hex }) => { html += rowHtml(f, i, hex); });
    }
  } else {
    if (!notes.length) {
      html += '<div class="empty-state"><div class="ic"><i class="ti ti-pencil"></i></div>لا توجد مسائل عليها تعليق بعد<br>اضغط على <i class="ti ti-pencil"></i> أثناء القراءة لإضافة ملاحظة</div>';
    } else {
      notes.map((n, i) => [n, i]).reverse().forEach(([n, i]) => {
        html += swipeRow(`<div class="list-row" onclick="openNoteFromFavorites(${i})">
          <span style="font-size:18px;"><i class="ti ti-pencil"></i></span>
          <div class="label">${escapeHtml(n.title)}${n.text ? `<div class="sub fav-note-snip">${escapeHtml(String(n.text).replace(/\s+/g, ' ').slice(0, 110))}</div>` : ''}<div class="sub">${n.kind ? escapeHtml(n.extSub || n.bookName) : `مسألة ${escapeHtml(n.masalaNum)} — ${escapeHtml(n.bookName)}`}${(!n.urwaStale && urwaContextLabel(n.bookId, n.sectionIdx)) ? ' — ' + escapeHtml(urwaContextLabel(n.bookId, n.sectionIdx)) : ''}</div>${n.urwaStale ? '<div class="sub" style="color:#c0392b;">⚠ كُتبت قبل تحديث نص العروة؛ قد يشير الموضع لمسألة أخرى — راجعها (نص ملاحظتك محفوظ كاملاً)</div>' : ''}</div>
        </div>`, [{icon:'trash',label:'حذف',color:'#c0392b',js:`removeNoteAt(${i})`}]);
      });
    }
  }
  container.innerHTML = html;
}

function openNoteFromFavorites(i) {
  const n = notes[i];
  if (n && n.kind) { openExtSource(n); return; }
  navStack = [];
  pushNav(() => showTab('favorites'));
  openReader(n.bookId, n.sectionIdx);
  scrollToMasalaWithinSection(n.sectionIdx, n.masalaNum);
}

function openFavorite(i) {
  const f = favorites[i];
  if (f && f.kind) { openExtSource(f); return; }
  navStack = [];
  pushNav(() => showTab('favorites'));
  openReader(f.bookId, f.sectionIdx);
  if (f.masalaNum) scrollToMasalaWithinSection(f.sectionIdx, f.masalaNum);
}


function newUid(prefix) { return prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7); }

let textPromptCallback = null;
function openTextPrompt(title, defaultValue, callback) {
  document.getElementById('textPromptTitle').textContent = title;
  const input = document.getElementById('textPromptInput');
  input.value = defaultValue || '';
  textPromptCallback = callback;
  document.getElementById('textPromptOverlay').classList.add('show');
  setTimeout(() => { input.focus(); input.select(); }, 60);
}
function confirmTextPrompt() {
  const input = document.getElementById('textPromptInput');
  const v = input.value;
  const cb = textPromptCallback;
  textPromptCallback = null;
  document.getElementById('textPromptOverlay').classList.remove('show');
  if (cb) cb(v);
}
function cancelTextPrompt() {
  textPromptCallback = null;
  document.getElementById('textPromptOverlay').classList.remove('show');
}

let confirmDialogCallback = null;
function openConfirmDialog(message, onYes) {
  document.getElementById('confirmDialogMsg').textContent = message;
  confirmDialogCallback = onYes;
  document.getElementById('confirmDialogOverlay').classList.add('show');
}
function confirmDialogYes() {
  const cb = confirmDialogCallback;
  confirmDialogCallback = null;
  document.getElementById('confirmDialogOverlay').classList.remove('show');
  if (cb) cb();
}
function confirmDialogNo() {
  confirmDialogCallback = null;
  document.getElementById('confirmDialogOverlay').classList.remove('show');
}

function openMiniMenu(title, itemsHtml) {
  document.getElementById('miniMenuTitle').textContent = title;
  document.getElementById('miniMenuList').innerHTML = itemsHtml;
  document.getElementById('miniMenuOverlay').classList.add('show');
}
function closeMiniMenu() { document.getElementById('miniMenuOverlay').classList.remove('show'); }

function saveCustomBooks() { localStorage.setItem('rs_custom_books', JSON.stringify(customBooks)); }

function findItemLocation(cb, uid) {
  const topIdx = cb.items.findIndex(it => it.uid === uid);
  if (topIdx >= 0) return { array: cb.items, index: topIdx, parentChapterUid: null };
  for (const it of cb.items) {
    if (it.type === 'chapter') {
      const idx = it.items.findIndex(ch => ch.uid === uid);
      if (idx >= 0) return { array: it.items, index: idx, parentChapterUid: it.uid };
    }
  }
  return null;
}
function flattenCustomBookItems(cb) {
  const out = [];
  cb.items.forEach(it => {
    if (it.type === 'chapter') it.items.forEach(ch => out.push(ch));
    else out.push(it);
  });
  return out;
}

function itemCountLabel(cb) {
  const n = flattenCustomBookItems(cb).length;
  const chapters = cb.items.filter(it => it.type === 'chapter').length;
  if (!n && !chapters) return 'فارغ';
  return chapters ? `${n} عنصر — ${chapters} فصل` : `${n} عنصر`;
}

let pendingCbItem = null;

function addMasalaToCustomBook(evt, sectionIdx, num) {
  evt.stopPropagation();
  const book = allBooks.find(b => b.id === currentBookId);
  const sec = currentSections[sectionIdx];
  if (!book || !sec) return;
  const authorName = allAuthors[book.author_id] || allAuthors[GLOSSARY_AUTHOR_ID] || '';
  pendingCbItem = {
    type: 'masala', bookId: currentBookId, sectionIdx, masalaNum: num,
    title: `مسألة ${num}`, bookName: book.name, authorName,
    snippet: getMasalaText(sectionIdx, num).slice(0, 140)
  };
  openAddToCustomBookPicker();
}

function addSectionToCustomBook(sectionIdx) {
  const book = allBooks.find(b => b.id === currentBookId);
  const sec = currentSections[sectionIdx];
  if (!book || !sec) return;
  const authorName = allAuthors[book.author_id] || allAuthors[GLOSSARY_AUTHOR_ID] || '';
  pendingCbItem = {
    type: 'section', bookId: currentBookId, sectionIdx, masalaNum: null,
    title: sec.title, bookName: book.name, authorName, snippet: ''
  };
  openAddToCustomBookPicker();
}

function openAddToCustomBookPicker() {
  const listEl = document.getElementById('cbPickerList');
  let html = `<div class="list-row" onclick="addPendingItemToNewBook()">
    <span style="font-size:20px;color:var(--accent);"><i class="ti ti-circle-plus"></i></span>
    <div class="label">كتاب جديد</div>
  </div>`;
  customBooks.slice().reverse().forEach(cb => {
    html += `<div class="list-row" onclick="addPendingItemToBook('${cb.id}')">
      <span style="font-size:20px;"><i class="ti ti-notes"></i></span>
      <div class="label">${escapeHtml(cb.name)}<div class="sub">${itemCountLabel(cb)}</div></div>
    </div>`;
  });
  listEl.innerHTML = html;
  document.getElementById('cbPickerOverlay').classList.add('show');
}
function closeCbPicker() {
  document.getElementById('cbPickerOverlay').classList.remove('show');
  pendingCbItem = null;
}
function addPendingItemToBook(bookId) {
  if (!pendingCbItem) return;
  const cb = customBooks.find(b => b.id === bookId);
  if (!cb) return;
  document.getElementById('cbPickerOverlay').classList.remove('show');
  const chapters = cb.items.filter(it => it.type === 'chapter');
  if (chapters.length) {
    openAddChapterChooser(cb, chapters);
  } else {
    finalizePendingItem(cb, null);
  }
}
function openAddChapterChooser(cb, chapters) {
  let html = `<div class="list-row" onclick="finalizePendingItemFlow('${cb.id}', null)">
    <span style="font-size:20px;"><i class="ti ti-ban"></i></span>
    <div class="label">بدون فصل (بجذر الكتاب)</div>
  </div>`;
  chapters.forEach(ch => {
    html += `<div class="list-row" onclick="finalizePendingItemFlow('${cb.id}', '${ch.uid}')">
      <span style="font-size:20px;"><i class="ti ti-folder"></i></span>
      <div class="label">${escapeHtml(ch.title)}<div class="sub">${ch.items.length} عنصر</div></div>
    </div>`;
  });
  html += `<div class="list-row" onclick="createChapterForPendingItem('${cb.id}')">
    <span style="font-size:20px;color:var(--accent);"><i class="ti ti-circle-plus"></i></span>
    <div class="label">فصل جديد</div>
  </div>`;
  openMiniMenu('أضِفها إلى أي فصل؟', html);
}
function finalizePendingItemFlow(bookId, chapterUidOrNull) {
  closeMiniMenu();
  const cb = customBooks.find(b => b.id === bookId);
  if (!cb) return;
  finalizePendingItem(cb, chapterUidOrNull);
}
function createChapterForPendingItem(bookId) {
  closeMiniMenu();
  openTextPrompt('اسم الفصل الجديد', '', (title) => {
    const t = (title || '').trim();
    if (!t) return;
    const cb = customBooks.find(b => b.id === bookId);
    if (!cb) return;
    const chapter = { uid: newUid('it'), type: 'chapter', title: t, items: [] };
    cb.items.push(chapter);
    finalizePendingItem(cb, chapter.uid);
  });
}
function finalizePendingItem(cb, chapterUidOrNull) {
  if (!pendingCbItem) return;
  const item = Object.assign({}, pendingCbItem, { uid: newUid('it') });
  if (chapterUidOrNull) {
    const chapter = cb.items.find(it => it.uid === chapterUidOrNull && it.type === 'chapter');
    if (chapter) chapter.items.push(item); else cb.items.push(item);
  } else {
    cb.items.push(item);
  }
  cb.updatedAt = Date.now();
  saveCustomBooks();
  pendingCbItem = null;
  const booksPageEl = document.getElementById('booksPage');
  if (booksPageEl && booksPageEl.classList.contains('active')) renderHomeExtras();
}
function addPendingItemToNewBook() {
  const staged = pendingCbItem;
  document.getElementById('cbPickerOverlay').classList.remove('show');
  openTextPrompt('اسم الكتاب الجديد', 'كتابي', (name) => {
    const trimmed = (name || '').trim() || 'كتابي';
    const cb = { id: newUid('cb'), name: trimmed, createdAt: Date.now(), items: [], migratedV2: true };
    customBooks.push(cb);
    pendingCbItem = staged;
    finalizePendingItem(cb, null);
  });
}

let currentCustomBookId = null;
let customBookEditMode = false;
let customBookLinkMode = false;
let customBookLinkSelection = new Set();
let customBookItemFootnotesCache = {};

function openCustomBook(id) {
  pushNav(() => renderReferencesPage());
  currentCustomBookId = id;
  customBookEditMode = false;
  customBookLinkMode = false;
  customBookLinkSelection.clear();
  renderCustomBookPage();
  const cb = customBooks.find(b => b.id === id);
  showBreadcrumb([cb ? cb.name : 'كتابي']);
  switchPage('customBookPage', cb ? cb.name : 'كتابي');
  booksTabActive = true;
  lastBooksPageId = 'customBookPage';
  lastBooksPageTitle = cb ? cb.name : 'كتابي';
  lastBooksBreadcrumb = [cb ? cb.name : 'كتابي'];
  registerView(() => openCustomBook(id));
}

function cbKeepAnchor(fn) {
  const c = document.getElementById('content');
  let uid = null, off = 0;
  try {
    if (c) {
      const ct = c.getBoundingClientRect().top;
      const els = document.querySelectorAll('#customBookPage [data-cb-item-uid]');
      for (const el of els) { const r = el.getBoundingClientRect(); if (r.bottom > ct + 60) { uid = el.getAttribute('data-cb-item-uid'); off = r.top - ct; break; } }
    }
  } catch (e) {}
  const st = c ? c.scrollTop : 0;
  fn();
  try {
    if (c && uid) {
      const el = document.querySelector('#customBookPage [data-cb-item-uid="' + uid + '"]');
      if (el) c.scrollTop += el.getBoundingClientRect().top - c.getBoundingClientRect().top - off; else c.scrollTop = st;
    }
  } catch (e) {}
}
function cbSyncFab() {
  const editBtn = document.getElementById('readerFabCbEdit');
  if (editBtn) editBtn.classList.toggle('active', !!(customBookEditMode || customBookLinkMode));
}
function renderCustomBookPage() {
  const cb = customBooks.find(b => b.id === currentCustomBookId);
  const container = document.getElementById('customBookPage');
  if (!cb) { container.innerHTML = '<div class="empty-state">الكتاب غير موجود</div>'; return; }
  customBookItemFootnotesCache = {};

  let html = (customBookEditMode && !customBookLinkMode) ? `<div class="cb-topbar">
    <button class="cb-icon-btn ${customBookLinkMode ? 'active' : ''}" title="ربط عناصر الكتاب ببعضها" onclick="toggleCustomBookLinkMode()"><i class="ti ti-link"></i></button>
    <button class="cb-icon-btn" title="فصل جديد" onclick="addCustomBookChapterFlow()"><i class="ti ti-folder-plus"></i></button>
    <span style="flex:1"></span>
    <button class="cb-icon-btn" title="خيارات أخرى" onclick="openCustomBookMoreMenu()"><i class="ti ti-dots"></i></button>
  </div>` : '';
  container.classList.toggle('cb-editing', !!customBookEditMode);
  container.classList.toggle('cb-linking', !!customBookLinkMode);

  if (customBookLinkMode) {
    html += `<div class="cb-linkbar">
      <span>${customBookLinkSelection.size} عنصر محدَّد — اختر عنصرين فأكثر (مسائل أو ملاحظات أو مقتبسات) لتربطها معاً</span>
      <div class="cb-linkbar-actions">
        <button class="cb-linkbar-confirm" ${customBookLinkSelection.size < 2 ? 'disabled' : ''} onclick="confirmGroupLink()"><i class="ti ti-link"></i> اربطهم معاً</button>
        <button class="cb-linkbar-cancel" onclick="toggleCustomBookLinkMode()">إلغاء</button>
      </div>
    </div>`;
  }

  if (!cb.items.length) {
    html += `<div class="empty-state"><div class="ic"><i class="ti ti-file-plus"></i></div>هذا الكتاب فارغ حتى الآن<br>أثناء قراءة أي كتاب اضغط <i class="ti ti-file-plus"></i> بجانب أي مسألة أو عنوان باب لسحبه هنا، أو اضغط + بالأسفل لتكتب ملاحظتك الخاصة مباشرة</div>`;
    if (customBookEditMode && !customBookLinkMode) html += renderInsertRow(null, 0);
  } else {
    if (customBookEditMode && !customBookLinkMode) html += renderInsertRow(null, 0);
    cb.items.forEach((item, idx) => {
      html += item.type === 'chapter'
        ? renderCustomBookChapterHtml(cb, item, idx)
        : renderCustomBookItemHtml(cb, item, idx, cb.items);
      if (customBookEditMode && !customBookLinkMode) html += renderInsertRow(null, idx + 1);
    });
  }
  container.innerHTML = html;
  requestAnimationFrame(() => {
    container.classList.add('cb-page-fade-in');
    setTimeout(() => container.classList.remove('cb-page-fade-in'), 220);
  });
}

function toggleCustomBookEditMode() {
  customBookEditMode = !customBookEditMode;
  if (customBookEditMode) { customBookLinkMode = false; customBookLinkSelection.clear(); }
  inlineInsertAt = null;
  cbKeepAnchor(renderCustomBookPage);
  const editBtn = document.getElementById('readerFabCbEdit');
  if (editBtn) editBtn.classList.toggle('active', customBookEditMode);
}
function toggleCustomBookLinkMode() {
  customBookLinkMode = !customBookLinkMode;
  customBookEditMode = !customBookLinkMode;
  customBookLinkSelection.clear();
  inlineInsertAt = null;
  cbKeepAnchor(renderCustomBookPage);
  cbSyncFab();
}

let inlineInsertAt = null;
function renderInsertRow(parentChapterUid, index) {
  const isActive = inlineInsertAt
    && (inlineInsertAt.parentChapterUid || null) === (parentChapterUid || null)
    && inlineInsertAt.index === index;
  if (isActive) {
    return `<div class="cb-inline-editor">
      <div class="cb-inline-editor-label"><i class="ti ti-pencil"></i> من كتابتك أنت</div>
      <div class="note-editor-toolbar rs-ntb">
        <button type="button" data-fmt="bold" onmousedown="event.preventDefault()" onclick="rsNoteFmt('bold')" title="خط عريض"><i class="ti ti-bold"></i></button>
        <button type="button" data-fmt="mark" onmousedown="event.preventDefault()" onclick="rsNoteFmt('mark')" title="تمييز بخلفية"><i class="ti ti-highlight"></i></button>
        <span class="nt-sep"></span>
        <button type="button" data-fmt="color:red" onmousedown="event.preventDefault()" onclick="rsNoteFmt('color','red')" title="نص أحمر"><span class="nt-dot" style="background:#C0392B"></span></button>
        <button type="button" data-fmt="color:green" onmousedown="event.preventDefault()" onclick="rsNoteFmt('color','green')" title="نص أخضر"><span class="nt-dot" style="background:#1E8449"></span></button>
        <button type="button" data-fmt="color:blue" onmousedown="event.preventDefault()" onclick="rsNoteFmt('color','blue')" title="نص أزرق"><span class="nt-dot" style="background:#2471A3"></span></button>
        <span class="nt-sep"></span>
        <button type="button" onmousedown="event.preventDefault()" onclick="rsNoteFmt('divider')" title="خط فاصل"><i class="ti ti-separator"></i></button>
      </div>
      <div id="inlineNoteTa" class="rs-rich" contenteditable="true" dir="rtl" data-placeholder="اكتب ملاحظتك هنا..."></div>
      <div class="note-acc-actions">
        <button class="note-save" onclick="saveInlineNote()">حفظ</button>
        <button class="note-cancel" onclick="cancelInlineInsert()">إلغاء</button>
      </div>
    </div>`;
  }
  const pKey = parentChapterUid ? `'${parentChapterUid}'` : 'null';
  return `<div class="cb-insert-row" onclick="openInlineInsert(${pKey}, ${index})"><i class="ti ti-plus"></i></div>`;
}
function openInlineInsert(parentChapterUid, index) {
  inlineInsertAt = { parentChapterUid: parentChapterUid || null, index };
  renderCustomBookPage();
  setTimeout(() => { const ta = document.getElementById('inlineNoteTa'); if (ta) ta.focus(); }, 60);
}
function cancelInlineInsert() {
  inlineInsertAt = null;
  renderCustomBookPage();
}
function inlineNoteWrap(pre, post) {
  const ta = document.getElementById('inlineNoteTa');
  if (!ta) return;
  const s = ta.selectionStart, e = ta.selectionEnd;
  const val = ta.value;
  const selected = val.slice(s, e) || 'نص';
  ta.value = val.slice(0, s) + pre + selected + post + val.slice(e);
  ta.focus();
  ta.selectionStart = s + pre.length;
  ta.selectionEnd = s + pre.length + selected.length;
}
function saveInlineNote() {
  const ta = document.getElementById('inlineNoteTa');
  if (!ta || !inlineInsertAt) { cancelInlineInsert(); return; }
  const text = ta.value;
  if (!text.trim()) { cancelInlineInsert(); return; }
  const cb = customBooks.find(b => b.id === currentCustomBookId);
  if (!cb) { cancelInlineInsert(); return; }
  const arr = inlineInsertAt.parentChapterUid
    ? ((cb.items.find(it => it.uid === inlineInsertAt.parentChapterUid) || { items: [] }).items)
    : cb.items;
  arr.splice(inlineInsertAt.index, 0, { uid: newUid('it'), type: 'note', text });
  cb.updatedAt = Date.now();
  saveCustomBooks();
  inlineInsertAt = null;
  renderCustomBookPage();
}

function openCustomBookMoreMenu() {
  const cb = customBooks.find(b => b.id === currentCustomBookId);
  if (!cb) return;
  openMiniMenu('خيارات الكتاب', `
    <div class="list-row" onclick="closeMiniMenu(); renameCustomBookFlow('${cb.id}');"><span style="font-size:20px;"><i class="ti ti-pencil"></i></span><div class="label">إعادة تسمية الكتاب</div></div>
    <div class="list-row" onclick="closeMiniMenu(); deleteCustomBookFlow('${cb.id}');"><span style="font-size:20px;color:#c0392b;"><i class="ti ti-trash"></i></span><div class="label" style="color:#c0392b;">حذف الكتاب نهائياً</div></div>
  `);
}

function addCustomBookChapterFlow() {
  openTextPrompt('اسم الفصل الجديد', '', (text) => {
    const t = (text || '').trim();
    if (!t) return;
    const cb = customBooks.find(b => b.id === currentCustomBookId);
    if (!cb) return;
    cb.items.push({ uid: newUid('it'), type: 'chapter', title: t, items: [] });
    cb.updatedAt = Date.now();
    saveCustomBooks();
    renderCustomBookPage();
  });
}
function renameChapterFlow(chapterUid) {
  const cb = customBooks.find(b => b.id === currentCustomBookId);
  const chapter = cb && cb.items.find(it => it.uid === chapterUid);
  if (!chapter) return;
  openTextPrompt('إعادة تسمية الفصل', chapter.title, (t) => {
    const trimmed = (t || '').trim();
    if (!trimmed) return;
    chapter.title = trimmed;
    cb.updatedAt = Date.now();
    saveCustomBooks();
    renderCustomBookPage();
  });
}
function deleteChapterFlow(chapterUid) {
  const cb = customBooks.find(b => b.id === currentCustomBookId);
  const chapter = cb && cb.items.find(it => it.uid === chapterUid);
  if (!chapter) return;
  const count = chapter.items.length;
  const msg = count ? `حذف فصل "${chapter.title}" وكل ما بداخله (${count} عنصر)؟ لا يمكن التراجع.` : `حذف فصل "${chapter.title}" الفارغ؟`;
  openConfirmDialog(msg, () => {
    cb.items = cb.items.filter(it => it.uid !== chapterUid);
    cb.updatedAt = Date.now();
    saveCustomBooks();
    renderCustomBookPage();
  });
}

function renameCustomBookFlow(id) {
  const cb = customBooks.find(b => b.id === id);
  if (!cb) return;
  openTextPrompt('إعادة تسمية الكتاب', cb.name, (name) => {
    const trimmed = (name || '').trim();
    if (!trimmed) return;
    cb.name = trimmed; cb.updatedAt = Date.now();
    saveCustomBooks();
    document.getElementById('pageTitle').textContent = trimmed;
    lastBooksPageTitle = trimmed;
    if (lastBooksBreadcrumb) { lastBooksBreadcrumb = ['صانع الكتاب', trimmed]; showBreadcrumb(lastBooksBreadcrumb); }
  });
}

function deleteCustomBookFlow(id) {
  const cb = customBooks.find(b => b.id === id);
  if (!cb) return;
  openConfirmDialog(`حذف كتاب "${cb.name}" نهائياً؟ لا يمكن التراجع عن هذا.`, () => {
    customBooks = customBooks.filter(b => b.id !== id);
    saveCustomBooks();
    goBack();
  });
}

function removeCustomBookItem(itemUid) {
  const cb = customBooks.find(b => b.id === currentCustomBookId);
  if (!cb) return;
  const loc = findItemLocation(cb, itemUid);
  if (!loc) return;
  loc.array.splice(loc.index, 1);
  cb.updatedAt = Date.now();
  saveCustomBooks();
  renderCustomBookPage();
}
function moveCustomBookItem(itemUid, dir) {
  const cb = customBooks.find(b => b.id === currentCustomBookId);
  if (!cb) return;
  const loc = findItemLocation(cb, itemUid);
  if (!loc) return;
  const to = loc.index + dir;
  if (to < 0 || to >= loc.array.length) return;
  const tmp = loc.array[loc.index]; loc.array[loc.index] = loc.array[to]; loc.array[to] = tmp;
  cb.updatedAt = Date.now();
  saveCustomBooks();
  renderCustomBookPage();
}

let cbDragSrcUid = null;
function onCbDragStart(evt) {
  const row = evt.currentTarget.closest('.cb-drag-row');
  cbDragSrcUid = row ? row.dataset.cbDragKey : null;
  if (row) row.classList.add('dragging');
  evt.dataTransfer.effectAllowed = 'move';
}
function onCbDragOver(evt) {
  evt.preventDefault();
  const row = evt.currentTarget;
  if (row.dataset.cbDragKey === cbDragSrcUid) return;
  const rect = row.getBoundingClientRect();
  const before = (evt.clientY - rect.top) < rect.height / 2;
  row.classList.toggle('drop-before', before);
  row.classList.toggle('drop-after', !before);
}
function onCbDrop(evt) {
  evt.preventDefault();
  const targetUid = evt.currentTarget.dataset.cbDragKey;
  document.querySelectorAll('.cb-drag-row').forEach(r => r.classList.remove('drop-before', 'drop-after'));
  if (!cbDragSrcUid || targetUid === cbDragSrcUid) return;
  const rect = evt.currentTarget.getBoundingClientRect();
  const before = (evt.clientY - rect.top) < rect.height / 2;
  reorderCbItemsByDrag(cbDragSrcUid, targetUid, before);
  cbDragSrcUid = null;
}
function onCbDragEnd(evt) {
  const row = evt.currentTarget.closest('.cb-drag-row');
  if (row) row.classList.remove('dragging');
  document.querySelectorAll('.cb-drag-row').forEach(r => r.classList.remove('drop-before', 'drop-after'));
  cbDragSrcUid = null;
}
function reorderCbItemsByDrag(srcUid, targetUid, before) {
  const cb = customBooks.find(b => b.id === currentCustomBookId);
  if (!cb) return;
  const srcLoc = findItemLocation(cb, srcUid);
  const targetLoc = findItemLocation(cb, targetUid);
  if (!srcLoc || !targetLoc || srcLoc.array !== targetLoc.array) return;
  const arr = srcLoc.array;
  const [item] = arr.splice(srcLoc.index, 1);
  let newIdx = arr.findIndex(it => it.uid === targetUid);
  if (newIdx === -1) newIdx = arr.length;
  arr.splice(before ? newIdx : newIdx + 1, 0, item);
  cb.updatedAt = Date.now();
  saveCustomBooks();
  renderCustomBookPage();
}

let cbTouchDragState = null;
function onCbHandleTouchStart(evt) {
  if (!customBookEditMode) return;
  evt.preventDefault();
  const row = evt.currentTarget.closest('.cb-drag-row');
  if (!row) return;
  const allRows = Array.from(document.querySelectorAll('#customBookPage .cb-drag-row'))
    .map(r => ({ el: r, uid: r.dataset.cbDragKey, rect: r.getBoundingClientRect() }));
  cbTouchDragState = {
    uid: row.dataset.cbDragKey, rowEl: row, startY: evt.touches[0].clientY,
    targetUid: null, before: true, rows: allRows, rafPending: false, lastY: evt.touches[0].clientY
  };
  row.classList.add('dragging');
  row.style.position = 'relative';
  row.style.zIndex = '60';
  document.addEventListener('touchmove', onCbHandleTouchMove, { passive: false });
  document.addEventListener('touchend', onCbHandleTouchEnd, { passive: false });
}
function onCbHandleTouchMove(evt) {
  if (!cbTouchDragState) return;
  evt.preventDefault();
  cbTouchDragState.lastY = evt.touches[0].clientY;
  if (cbTouchDragState.rafPending) return;
  cbTouchDragState.rafPending = true;
  requestAnimationFrame(() => {
    if (!cbTouchDragState) return;
    cbTouchDragState.rafPending = false;
    const touchY = cbTouchDragState.lastY;
    const dy = touchY - cbTouchDragState.startY;
    cbTouchDragState.rowEl.style.transform = `translateY(${dy}px)`;
    const content = document.getElementById('content');
    if (content) {
      const cRect = content.getBoundingClientRect();
      const edgeZone = 60;
      const beforeScroll = content.scrollTop;
      if (touchY < cRect.top + edgeZone) content.scrollTop -= 10;
      else if (touchY > cRect.bottom - edgeZone) content.scrollTop += 10;
      if (content.scrollTop !== beforeScroll) {
        cbTouchDragState.rows.forEach(r => { r.rect = r.el.getBoundingClientRect(); });
      }
    }
    let matched = null;
    for (const r of cbTouchDragState.rows) {
      if (r.uid === cbTouchDragState.uid) continue;
      if (touchY >= r.rect.top && touchY <= r.rect.bottom) { matched = r; break; }
    }
    cbTouchDragState.rows.forEach(r => r.el.classList.remove('drop-before', 'drop-after'));
    if (matched) {
      const before = (touchY - matched.rect.top) < matched.rect.height / 2;
      matched.el.classList.toggle('drop-before', before);
      matched.el.classList.toggle('drop-after', !before);
      cbTouchDragState.targetUid = matched.uid;
      cbTouchDragState.before = before;
    }
  });
}
function onCbHandleTouchEnd() {
  if (!cbTouchDragState) return;
  document.removeEventListener('touchmove', onCbHandleTouchMove);
  document.removeEventListener('touchend', onCbHandleTouchEnd);
  const { uid, targetUid, before } = cbTouchDragState;
  cbTouchDragState = null;
  document.querySelectorAll('.cb-drag-row').forEach(r => {
    r.classList.remove('drop-before', 'drop-after', 'dragging');
    r.style.transform = ''; r.style.position = ''; r.style.zIndex = '';
  });
  if (!targetUid || targetUid === uid) return;
  reorderCbItemsByDrag(uid, targetUid, before);
}

function openMoveToChapterPicker(itemUid) {
  const cb = customBooks.find(b => b.id === currentCustomBookId);
  if (!cb) return;
  const chapters = cb.items.filter(it => it.type === 'chapter');
  let html = `<div class="list-row" onclick="moveItemToChapter('${itemUid}', null)">
    <span style="font-size:20px;"><i class="ti ti-ban"></i></span>
    <div class="label">بدون فصل (بجذر الكتاب)</div>
  </div>`;
  chapters.forEach(ch => {
    html += `<div class="list-row" onclick="moveItemToChapter('${itemUid}', '${ch.uid}')">
      <span style="font-size:20px;"><i class="ti ti-folder"></i></span>
      <div class="label">${escapeHtml(ch.title)}<div class="sub">${ch.items.length} عنصر</div></div>
    </div>`;
  });
  html += `<div class="list-row" onclick="createChapterAndMoveItem('${itemUid}')">
    <span style="font-size:20px;color:var(--accent);"><i class="ti ti-circle-plus"></i></span>
    <div class="label">فصل جديد</div>
  </div>`;
  openMiniMenu('نقل إلى فصل', html);
}
function moveItemToChapter(itemUid, chapterUidOrNull) {
  const cb = customBooks.find(b => b.id === currentCustomBookId);
  if (!cb) return;
  const loc = findItemLocation(cb, itemUid);
  if (!loc) return;
  const [item] = loc.array.splice(loc.index, 1);
  if (chapterUidOrNull) {
    const chapter = cb.items.find(it => it.uid === chapterUidOrNull && it.type === 'chapter');
    if (chapter) chapter.items.push(item); else cb.items.push(item);
  } else {
    cb.items.push(item);
  }
  cb.updatedAt = Date.now();
  saveCustomBooks();
  closeMiniMenu();
  renderCustomBookPage();
}
function createChapterAndMoveItem(itemUid) {
  closeMiniMenu();
  openTextPrompt('اسم الفصل الجديد', '', (title) => {
    const t = (title || '').trim();
    if (!t) return;
    const cb = customBooks.find(b => b.id === currentCustomBookId);
    if (!cb) return;
    const chapter = { uid: newUid('it'), type: 'chapter', title: t, items: [] };
    cb.items.push(chapter);
    saveCustomBooks();
    moveItemToChapter(itemUid, chapter.uid);
  });
}

function jumpToCustomBookItemSource(bookId, sectionIdx, masalaNum) {
  navStack = [];
  pushNav(() => openCustomBook(currentCustomBookId));
  openReader(bookId, sectionIdx);
  if (masalaNum) scrollToMasalaWithinSection(sectionIdx, masalaNum);
}

function toggleGroupSelect(uid) {
  if (customBookLinkSelection.has(uid)) customBookLinkSelection.delete(uid);
  else customBookLinkSelection.add(uid);
  const sel = customBookLinkSelection.has(uid);
  const el = document.querySelector('#customBookPage [data-cb-item-uid="' + uid + '"]');
  if (el) {
    el.classList.toggle('cb-selected', sel);
    const dot = el.querySelector('.cb-select-dot'); if (dot) dot.innerHTML = sel ? '<i class="ti ti-circle-check"></i>' : '<i class="ti ti-circle"></i>';
  }
  const bar = document.querySelector('#customBookPage .cb-linkbar');
  if (bar) {
    const sp = bar.querySelector(':scope > span'); if (sp) sp.textContent = customBookLinkSelection.size + ' عنصر محدَّد — اختر عنصرين فأكثر (مسائل أو ملاحظات أو مقتبسات) لتربطها معاً';
    const ok = bar.querySelector('.cb-linkbar-confirm'); if (ok) ok.disabled = customBookLinkSelection.size < 2;
  }
}
function confirmGroupLink() {
  if (customBookLinkSelection.size < 2) return;
  openTextPrompt('اسم يجمع هذه المسائل (مثلاً: حكم الاستطاعة عند المراجع)', '', (label) => {
    const t = (label || '').trim();
    if (!t) return;
    const cb = customBooks.find(b => b.id === currentCustomBookId);
    if (!cb) return;
    const gid = newUid('grp');
    flattenCustomBookItems(cb).forEach(it => { if (customBookLinkSelection.has(it.uid)) { it.groupId = gid; it.groupLabel = t; } });
    cb.updatedAt = Date.now();
    saveCustomBooks();
    customBookLinkMode = false; customBookEditMode = true;
    customBookLinkSelection.clear();
    cbKeepAnchor(renderCustomBookPage); cbSyncFab();
  });
}
function groupColorFor(groupId) {
  const palette = ['#C0502A', '#2471A3', '#1E8449', '#8E44AD', '#B7950B', '#A93226'];
  let h = 0;
  for (let i = 0; i < groupId.length; i++) h = (h * 31 + groupId.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}
function scrollToNextGroupMember(currentUid, groupId) {
  const cb = customBooks.find(b => b.id === currentCustomBookId);
  if (!cb) return;
  const members = flattenCustomBookItems(cb).filter(it => it.groupId === groupId);
  if (members.length < 2) return;
  const idx = members.findIndex(it => it.uid === currentUid);
  const next = members[(idx + 1) % members.length];
  const el = document.querySelector(`[data-cb-item-uid="${next.uid}"]`);
  if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('fav-jump-highlight'); }
}

let noteEditorTargetUid = null;
function openNoteEditor(existingUid) {
  noteEditorTargetUid = existingUid;
  const ta = document.getElementById('noteEditorInput');
  const cb = customBooks.find(b => b.id === currentCustomBookId);
  const loc = cb && findItemLocation(cb, existingUid);
  ta.value = loc ? loc.array[loc.index].text : '';
  document.getElementById('noteEditorOverlay').classList.add('show');
  setTimeout(() => ta.focus(), 60);
}
function closeNoteEditor() { document.getElementById('noteEditorOverlay').classList.remove('show'); }
function saveNoteEditor() {
  const ta = document.getElementById('noteEditorInput');
  const text = ta.value;
  const cb = customBooks.find(b => b.id === currentCustomBookId);
  if (!cb || !noteEditorTargetUid) { closeNoteEditor(); return; }
  const loc = findItemLocation(cb, noteEditorTargetUid);
  if (loc) loc.array[loc.index].text = text;
  cb.updatedAt = Date.now();
  saveCustomBooks();
  closeNoteEditor();
  renderCustomBookPage();
}
function noteEditorWrap(pre, post) {
  const ta = document.getElementById('noteEditorInput');
  const s = ta.selectionStart, e = ta.selectionEnd;
  const val = ta.value;
  const selected = val.slice(s, e) || 'نص';
  ta.value = val.slice(0, s) + pre + selected + post + val.slice(e);
  ta.focus();
  ta.selectionStart = s + pre.length;
  ta.selectionEnd = s + pre.length + selected.length;
}
function noteEditorInsertDivider() {
  const ta = document.getElementById('noteEditorInput');
  const s = ta.selectionStart;
  const val = ta.value;
  const insertion = (s > 0 && val[s - 1] !== '\n' ? '\n' : '') + '---\n';
  ta.value = val.slice(0, s) + insertion + val.slice(s);
  ta.focus();
  const pos = s + insertion.length;
  ta.selectionStart = ta.selectionEnd = pos;
}

function renderNoteText(raw) {
  let html = escapeHtml(raw || '');
  html = html.replace(/^---$/gm, '<hr class="cb-note-hr">');
  html = html.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/==([^=\n]+)==/g, '<mark class="cb-note-mark">$1</mark>');
  for (let _i = 0; _i < 6; _i++) {
    const _prev = html;
    html = html.replace(/\[color:(red|green|blue)\]((?:(?!\[color:)[\s\S])*?)\[\/color\]/g, (m, c, t) => `<span class="cbn-${c}">${t}</span>`);
    if (html === _prev) break;
  }
  html = html.replace(/\[\/?color(?::[a-z]+)?\]/g, '');
  html = html.replace(/\n/g, '<br>');
  return html;
}

const CB_COLOR_SWATCHES = ['#C0392B', '#CA6F1E', '#B7950B', '#1E8449', '#2471A3', '#8E44AD'];
function openItemColorPicker(itemUid) {
  let html = `<div class="cb-color-grid">
    <div class="cb-color-swatch cb-color-none" onclick="setItemColor('${itemUid}','')" title="بلا لون"><i class="ti ti-ban"></i></div>`;
  CB_COLOR_SWATCHES.forEach(c => {
    html += `<div class="cb-color-swatch" style="background:${c};" onclick="setItemColor('${itemUid}','${c}')"></div>`;
  });
  html += `<div class="cb-color-swatch swatch-custom" onclick="closeMiniMenu(); RSUI.pickColor({title:'لون هذا العنصر', value:'#2471A3', onApply:(c)=>setItemColor('${itemUid}', c)})" title="لون مخصّص"><i class="ti ti-palette"></i></div>`;
  html += '</div>';
  openMiniMenu('لون هذا العنصر', html);
}
function setItemColor(itemUid, color) {
  const cb = customBooks.find(b => b.id === currentCustomBookId);
  if (!cb) return;
  const loc = findItemLocation(cb, itemUid);
  if (!loc) return;
  const item = loc.array[loc.index];
  if (color) item.color = color; else delete item.color;
  cb.updatedAt = Date.now();
  saveCustomBooks();
  closeMiniMenu();
  renderCustomBookPage();
}
function hexToRgba(hex, alpha) {
  const h = (hex || '').replace('#', '');
  if (h.length !== 6) return `rgba(150,150,150,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function getMasalaContentForCustomBook(bookId, sectionIdx, masalaNum) {
  const sec = getProcessedSection(bookId, sectionIdx);
  if (!sec) return null;
  const patterns = getMarkerPatterns(bookId);
  const parts = splitByMarker(sec.body, patterns.src, patterns.capture, bookId);
  for (const part of parts) {
    const m = part.match(patterns.capture);
    if (!m) continue;
    if (normalizeDigits(m[1] || m[2] || m[3] || m[4] || m[5]) === masalaNum) {
      return { title: sec.title, body: part.trim(), footnotes: sec.footnotes };
    }
  }
  return null;
}

function renderCustomBookChapterHtml(cb, chapter, idx) {
  let inner = '';
  if (!chapter.items.length) {
    inner = `<div class="cb-chapter-empty">لا عناصر بهذا الفصل بعد</div>`;
    if (customBookEditMode && !customBookLinkMode) inner += renderInsertRow(chapter.uid, 0);
  } else {
    if (customBookEditMode && !customBookLinkMode) inner += renderInsertRow(chapter.uid, 0);
    chapter.items.forEach((child, cidx) => {
      inner += renderCustomBookItemHtml(cb, child, cidx, chapter.items);
      if (customBookEditMode && !customBookLinkMode) inner += renderInsertRow(chapter.uid, cidx + 1);
    });
  }
  const chapterControls = customBookEditMode ? `<span class="cb-item-controls">
      <button title="إعادة تسمية الفصل" onclick="event.stopPropagation(); renameChapterFlow('${chapter.uid}')"><i class="ti ti-pencil"></i></button>
      <button title="حذف الفصل" onclick="event.stopPropagation(); deleteChapterFlow('${chapter.uid}')"><i class="ti ti-trash"></i></button>
    </span>` : '';
  const dragHandle = customBookEditMode
    ? `<span class="cb-drag-handle" draggable="true" ondragstart="onCbDragStart(event)" ondragend="onCbDragEnd(event)" ontouchstart="onCbHandleTouchStart(event)"><i class="ti ti-grip-vertical"></i></span>`
    : '';
  const rowAttrs = customBookEditMode
    ? ` data-cb-drag-key="${chapter.uid}" ondragover="onCbDragOver(event)" ondrop="onCbDrop(event)"`
    : '';
  return `<div class="cb-chapter ${customBookEditMode ? 'cb-drag-row' : ''}" data-cb-item-uid="${chapter.uid}"${rowAttrs}>
    <div class="cb-chapter-head">
      ${dragHandle}
      <div class="cb-chapter-title"><i class="ti ti-folder-open"></i> ${escapeHtml(chapter.title)}</div>
      ${chapterControls}
    </div>
    <div class="cb-chapter-body">${inner}</div>
  </div>`;
}

function cbLinkBits(item) {
  const sel = customBookLinkMode && customBookLinkSelection.has(item.uid);
  const gc = item.groupId ? groupColorFor(item.groupId) : null;
  const cls = (customBookLinkMode ? ' cb-selectable' : '') + (sel ? ' cb-selected' : '') + (gc ? ' cb-grouped' : '');
  const st = (item.color ? `border-inline-start:4px solid ${item.color};background:${hexToRgba(item.color, 0.06)};` : '') + (gc ? `--gc:${gc};` : '');
  return {
    sel, cls, style: st ? ` style="${st}"` : '',
    click: customBookLinkMode ? ` onclick="toggleGroupSelect('${item.uid}')"` : '',
    dot: customBookLinkMode ? `<span class="cb-select-dot">${sel ? '<i class="ti ti-circle-check"></i>' : '<i class="ti ti-circle"></i>'}</span>` : '',
    chip: item.groupId ? `<span class="cb-group-chip" style="--gc:${gc}" onclick="event.stopPropagation(); openGroupMenu('${item.uid}')"><i class="ti ti-link"></i> ${escapeHtml(item.groupLabel || 'مرتبط')}</span>` : ''
  };
}
function openGroupMenu(uid) {
  const cb = customBooks.find(b => b.id === currentCustomBookId); if (!cb) return;
  const it = flattenCustomBookItems(cb).find(x => x.uid === uid); if (!it || !it.groupId) return;
  const n = flattenCustomBookItems(cb).filter(x => x.groupId === it.groupId).length;
  openMiniMenu('«' + (it.groupLabel || 'مرتبط') + '» — ' + n + ' عناصر',
    `<div class="list-row" onclick="closeMiniMenu(); scrollToNextGroupMember('${uid}','${it.groupId}')"><span style="font-size:20px;"><i class="ti ti-arrow-down"></i></span><div class="label">الانتقال إلى العنصر التالي في الربط</div></div>
     <div class="list-row" onclick="closeMiniMenu(); renameGroupFlow('${it.groupId}')"><span style="font-size:20px;"><i class="ti ti-pencil"></i></span><div class="label">إعادة تسمية الربط</div></div>
     <div class="list-row" onclick="closeMiniMenu(); unlinkItem('${uid}')"><span style="font-size:20px;"><i class="ti ti-unlink"></i></span><div class="label">فكّ ربط هذا العنصر وحده</div></div>
     <div class="list-row" onclick="closeMiniMenu(); unlinkGroup('${it.groupId}')"><span style="font-size:20px;color:#c0392b;"><i class="ti ti-link-off"></i></span><div class="label">فكّ الربط كله</div></div>`);
}
function unlinkItem(uid) {
  const cb = customBooks.find(b => b.id === currentCustomBookId); if (!cb) return;
  const all = flattenCustomBookItems(cb), it = all.find(x => x.uid === uid); if (!it) return;
  const gid = it.groupId; delete it.groupId; delete it.groupLabel;
  const rest = all.filter(x => x.groupId === gid);
  if (rest.length < 2) rest.forEach(x => { delete x.groupId; delete x.groupLabel; });
  cb.updatedAt = Date.now(); saveCustomBooks(); renderCustomBookPage();
}
function unlinkGroup(gid) {
  const cb = customBooks.find(b => b.id === currentCustomBookId); if (!cb) return;
  flattenCustomBookItems(cb).forEach(x => { if (x.groupId === gid) { delete x.groupId; delete x.groupLabel; } });
  cb.updatedAt = Date.now(); saveCustomBooks(); renderCustomBookPage();
}
function renameGroupFlow(gid) {
  const cb = customBooks.find(b => b.id === currentCustomBookId); if (!cb) return;
  const cur = (flattenCustomBookItems(cb).find(x => x.groupId === gid) || {}).groupLabel || '';
  openTextPrompt('اسم الربط', cur, (label) => {
    const t = (label || '').trim(); if (!t) return;
    flattenCustomBookItems(cb).forEach(x => { if (x.groupId === gid) x.groupLabel = t; });
    cb.updatedAt = Date.now(); saveCustomBooks(); renderCustomBookPage();
  });
}

function renderCustomBookItemHtml(cb, item, idx, siblingsArray) {
  const colorBtn = `<button title="لون العنصر" onclick="event.stopPropagation(); openItemColorPicker('${item.uid}')"><i class="ti ti-palette${item.color ? '-fill' : ''}"></i></button>`;
  const moveChapterBtn = `<button title="نقل إلى فصل" onclick="event.stopPropagation(); openMoveToChapterPicker('${item.uid}')"><i class="ti ti-folder-symlink"></i></button>`;
  const dragHandle = customBookEditMode
    ? `<span class="cb-drag-handle" draggable="true" ondragstart="onCbDragStart(event)" ondragend="onCbDragEnd(event)" ontouchstart="onCbHandleTouchStart(event)"><i class="ti ti-grip-vertical"></i></span>`
    : '';
  const rowAttrs = customBookEditMode
    ? ` data-cb-drag-key="${item.uid}" ondragover="onCbDragOver(event)" ondrop="onCbDrop(event)"`
    : '';
  const dragRowClass = customBookEditMode ? ' cb-drag-row' : '';

  if (customBookEditMode) {
    let shortLabel;
    if (item.type === 'note') {
      shortLabel = (item.text || '').replace(/[\n\r]+/g, ' ').replace(/[*=\-\[\]]/g, '').trim().slice(0, 60) || 'ملاحظة بلا نص بعد';
    } else if (item.type === 'quote') {
      shortLabel = (item.text || '').replace(/\s+/g, ' ').trim().slice(0, 70) || item.bookName;
    } else {
      let snippet = '';
      try {
        const content = (item.type === 'masala')
          ? getMasalaContentForCustomBook(item.bookId, item.sectionIdx, item.masalaNum)
          : getProcessedSection(item.bookId, item.sectionIdx);
        if (content && content.body) {
          snippet = content.body.replace(new RegExp(BLOCK_MARKER_SRC, 'g'), '').replace(/\s+/g, ' ').trim().replace(/^[:.،؛\s]+/, '').slice(0, 70);
        }
      } catch (e) {  }
      shortLabel = snippet || `${item.authorName} — ${item.bookName}${item.masalaNum ? ' — مسألة ' + item.masalaNum : ''}`;
    }
    const icon = item.type === 'note' ? 'ti-book-2' : 'ti-bookmark';
    const compactStyle = item.color ? ` style="border-inline-start:4px solid ${item.color};"` : '';
    const subLabel = (item.type === 'quote')
      ? `<div class="cb-item-compact-sub">${escapeHtml(item.srcSub || item.bookName)}</div>`
      : (item.type !== 'note')
      ? `<div class="cb-item-compact-sub">${escapeHtml(item.authorName)} — ${escapeHtml(item.bookName)}${item.masalaNum ? ' — مسألة ' + escapeHtml(item.masalaNum) : ''}</div>`
      : '';
    return `<div class="cb-item cb-item-compact${dragRowClass}" data-cb-item-uid="${item.uid}"${compactStyle}${rowAttrs}>
      ${dragHandle}
      <span style="font-size:15px;flex-shrink:0;color:var(--text-dim);"><i class="ti ${icon}"></i></span>
      <div class="cb-item-compact-text">
        <div class="cb-item-compact-label">${escapeHtml(shortLabel)}</div>
        ${subLabel}
      </div>
      <span class="cb-item-controls">
        ${item.type === 'note' ? `<button title="تعديل النص" onclick="event.stopPropagation(); openNoteEditor('${item.uid}')"><i class="ti ti-pencil"></i></button>` : ''}
        ${colorBtn}
        ${item.type !== 'note' ? moveChapterBtn : ''}
        <button title="إزالة" onclick="event.stopPropagation(); removeCustomBookItem('${item.uid}')"><i class="ti ti-x"></i></button>
      </span>
    </div>`;
  }

  if (item.type === 'note') {
    const lb = cbLinkBits(item);
    return `<div class="cb-item cb-note${lb.cls}" data-cb-item-uid="${item.uid}"${lb.style}${lb.click}>
      <div class="cb-item-head">
        ${lb.dot}<span class="cb-src"><i class="ti ti-book-2"></i> ملاحظتي</span>
        ${lb.chip}
        ${customBookLinkMode ? '' : `<span class="cb-item-controls"><button title="تعديل النص" onclick="event.stopPropagation(); openNoteEditor('${item.uid}')"><i class="ti ti-pencil"></i></button></span>`}
      </div>
      <div class="cb-item-body body-text ${fontFamily}" style="font-size:${fontSize}px;">${renderNoteText(item.text)}</div>
    </div>`;
  }

  if (item.type === 'quote') {
    const lb = cbLinkBits(item);
    return `<div class="cb-item cb-quote${lb.cls}" data-cb-item-uid="${item.uid}"${lb.style}${lb.click}>
      <div class="cb-item-head">
        ${lb.dot}<span class="cb-src cb-src-link"${customBookLinkMode ? '' : ` onclick="event.stopPropagation(); openExtQuoteSource('${item.uid}')"`}><i class="ti ti-quote"></i> ${escapeHtml(item.srcSub || item.bookName)}</span>
        ${lb.chip}
      </div>
      <div class="cb-item-body body-text ${fontFamily}" style="font-size:${fontSize}px;white-space:pre-wrap;">${escapeHtml(item.text || '')}</div>
    </div>`;
  }

  let content = null;
  try {
    content = (item.type === 'masala')
      ? getMasalaContentForCustomBook(item.bookId, item.sectionIdx, item.masalaNum)
      : getProcessedSection(item.bookId, item.sectionIdx);
  } catch (e) { content = null; }
  customBookItemFootnotesCache[item.uid] = (content && content.footnotes) || [];
  const bodyHtml = content
    ? formatCustomBookText(content.body, content.footnotes, item.uid, item.bookId)
    : `<span style="color:#c0392b;">تعذّر تحميل نص هذا العنصر — <span style="cursor:pointer;text-decoration:underline;" onclick="removeCustomBookItem('${item.uid}')">إزالته</span></span>`;

  const lb = cbLinkBits(item);
  const jumpCall = `jumpToCustomBookItemSource(${item.bookId}, ${item.sectionIdx}, ${item.masalaNum ? `'${item.masalaNum}'` : 'null'})`;
  const srcOnclick = customBookLinkMode ? '' : ` onclick="event.stopPropagation(); ${jumpCall}"`;
  const bodyOnclick = customBookLinkMode ? '' : ` onclick="${jumpCall}"`;

  return `<div class="cb-item${lb.cls}" data-cb-item-uid="${item.uid}"${lb.style}${lb.click}>
    <div class="cb-item-head">
      ${lb.dot}
      <span class="cb-src cb-src-link"${srcOnclick}><i class="ti ti-bookmark"></i> ${escapeHtml(item.authorName)} — ${escapeHtml(item.bookName)}${item.masalaNum ? ` — مسألة ${escapeHtml(item.masalaNum)}` : ''}</span>
      ${lb.chip}
    </div>
    <div class="cb-item-body body-text ${fontFamily} cb-item-body-tappable" style="font-size:${fontSize}px;"${bodyOnclick}>${bodyHtml}</div>
  </div>`;
}

function openCbToc() {
  const cb = customBooks.find(b => b.id === currentCustomBookId);
  if (!cb || !cb.items.length) return;
  document.getElementById('cbTocDrawerTitle').textContent = cb.name;
  renderCbTocList();
  document.getElementById('cbTocOverlay').classList.add('show');
}
function closeCbToc() { document.getElementById('cbTocOverlay').classList.remove('show'); }
function cbTocEntryHtml(item) {
  if (item.type === 'note') {
    const preview = (item.text || '').replace(/[\n\r]+/g, ' ').replace(/[*=\-\[\]]/g, '').trim().slice(0, 44) || 'ملاحظة بلا نص بعد';
    return `<div class="cb-toc-item" onclick="cbTocItemClick('${item.uid}')"><i class="ti ti-book-2"></i> ${escapeHtml(preview)}</div>`;
  }
  if (item.type === 'quote') {
    return `<div class="cb-toc-item" onclick="cbTocItemClick('${item.uid}')"><i class="ti ti-quote"></i> ${escapeHtml((item.srcSub || item.bookName || '').slice(0, 60))}</div>`;
  }
  const label = `${item.authorName} — ${item.bookName}${item.masalaNum ? ' — مسألة ' + item.masalaNum : ''}`;
  return `<div class="cb-toc-item" onclick="cbTocItemClick('${item.uid}')"><i class="ti ti-bookmark"></i> ${escapeHtml(label)}</div>`;
}
function renderCbTocList() {
  const cb = customBooks.find(b => b.id === currentCustomBookId);
  const container = document.getElementById('cbTocDrawerList');
  if (!cb) { container.innerHTML = ''; return; }
  let html = '';
  cb.items.forEach(item => {
    if (item.type === 'chapter') {
      html += `<div class="cb-toc-heading" onclick="cbTocItemClick('${item.uid}')"><i class="ti ti-folder"></i> ${escapeHtml(item.title)}</div>`;
      item.items.forEach(child => { html += cbTocEntryHtml(child); });
    } else {
      html += cbTocEntryHtml(item);
    }
  });
  container.innerHTML = html || '<div class="empty-state">الكتاب فارغ</div>';
}
function cbTocItemClick(uid) {
  closeCbToc();
  const el = document.querySelector(`[data-cb-item-uid="${uid}"]`);
  if (el) setTimeout(() => { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); el.classList.add('fav-jump-highlight'); }, 50);
}

function toggleCustomBookFootnote(evt, itemUid, num) {
  evt.stopPropagation();
  const el = document.getElementById(`cbfn-body-${itemUid}-${num}`);
  if (!el) return;
  if (el.classList.contains('open')) { el.classList.remove('open'); return; }
  if (!el.dataset.built) {
    const footnotes = customBookItemFootnotesCache[itemUid] || [];
    const entry = footnotes[num - 1] || '';
    el.innerHTML = buildFootnoteEntryHtml(entry);
    el.dataset.built = '1';
  }
  el.classList.add('open');
}

function formatCustomBookText(text, footnotes, itemUid, bookId) {
  let html = escapeHtml(text || '').replace(/\n/g, '<br>');
  const activePatterns = (bookId != null) ? getMarkerPatterns(bookId) : { src: BLOCK_MARKER_SRC, htmlSrc: BLOCK_MARKER_SRC };
  html = diacriticTolerantWrap(
    html, `(^|<br>)(\\s*)(${activePatterns.htmlSrc})`, 'ms-num',
    (h, pos, _g, len) => isMarkerPrecededByReferenceCue(h, pos) || isCrossRowSuppressed(h, pos, len, bookId)
  );
  if (bookId != null) html = highlightAnswerMarker(html, bookId);
  html = highlightSublistNumbering(html);
  if (ensureGlossaryBuilt()) html = highlightGlossaryTerms(html);
  if (footnotes && footnotes.length) {
    html = html.replace(/((?:<[^>]+>|[^\s\[<])+)?( ?)\[(\d+)\]/g, (whole, word, sp, n) => {
      const i = parseInt(n, 10);
      if (i < 1 || i > footnotes.length) return whole;
      const entry = footnotes[i - 1];
      const wordHtml = word ? `<span class="fn-word">${word}</span>` : '';
      if (!footnoteHasVisible(entry)) return word ? wordHtml + sp : sp;
      const cls = footnoteMarkerClass(entry);
      return `${wordHtml}${word ? '' : sp}<sup class="${cls}" onclick="toggleCustomBookFootnote(event, '${itemUid}', ${i})">[${n}]</sup><span class="fn-body" id="cbfn-body-${itemUid}-${i}"></span>`;
    });
  }
  return html;
}

function openGlossaryPopup(term) {
  let defs = glossaryMap.get(term);
  if (!defs || !defs.length) {
    const norm = term.replace(/[إأآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
    glossaryMap.forEach((d, t) => {
      if (defs && defs.length) return;
      const tn = t.replace(/[إأآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
      if (tn === norm) defs = d;
    });
  }
  if (!defs || !defs.length) return;
  const card = document.getElementById('glossaryCard');
  let html = RSUI.xBtn() + `<h4 style="padding-inline-end:40px">${escapeHtml(term)}</h4>`;
  html += `<div class="gdef-warning">المعنى قد لا يتوافق مع السياق</div>`;
  _glossaryPopupDefs = defs.slice();
  defs.forEach((d, i) => {
    const src = (d.bid != null && d.rid != null)
      ? `<a class="gsrc gsrc-link" role="link" tabindex="0" title="فتح الكتاب عند هذا المعنى" onclick="openGlossarySource(${i})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openGlossarySource(${i});}">المصدر: ${escapeHtml(d.source)} <i class="ti ti-external-link"></i></a>`
      : `<span class="gsrc">المصدر: ${escapeHtml(d.source)}</span>`;
    html += `<div class="gdef">${escapeHtml(d.def)}${src}</div>`;
  });
  card.innerHTML = html;
  document.getElementById('glossaryOverlay').classList.add('show');
}

let _glossaryPopupDefs = [];

function glossarySourcePhrases(body, d) {
  const blocks = String(body || '').split(/\n\s*\n/);
  const block = (blocks[d.bi] || '').trim();
  if (!block) return [];
  const toks = block.split('\n')[0].split(/\s+/).filter(Boolean);
  if (!toks.length) return [];
  const sq = (t) => normalizeArabic(t).replace(/\s+/g, ' ');
  const hay = sq(blocks.join('\n\n'));
  const before = d.bi > 0 ? sq(blocks.slice(0, d.bi).join('\n\n')).length + 1 : 0;
  const end = before + sq(block).length;
  const out = [];
  const maxN = Math.min(toks.length, 14);
  for (let n = Math.min(3, maxN); n <= maxN; n++) {
    const ph = toks.slice(0, n).join(' ');
    const q = sq(ph).trim();
    if (!q) continue;
    const p = hay.indexOf(q);
    if (p >= before - 2 && p <= end) { out.push(ph); break; }
  }
  if (!out.length) out.push(toks.slice(0, Math.min(maxN, 6)).join(' '));
  const t2 = toks.slice(0, Math.min(maxN, 3)).join(' ');
  if (t2 !== out[0]) out.push(t2);
  return out;
}

function openGlossarySource(i) {
  const d = _glossaryPopupDefs[i];
  if (!d || d.bid == null || d.rid == null || !db) return;
  const book = allBooks.find(b => b.id === d.bid);
  if (!book) return;
  let body = '';
  try {
    const res = db.exec(`SELECT body FROM "${book.bk_table}" WHERE rowid = ${d.rid | 0}`);
    body = res.length && res[0].values.length ? (res[0].values[0][0] || '') : '';
  } catch (e) { body = ''; }
  const phrases = glossarySourcePhrases(body, d);
  closeGlossaryPopup();
  const sections = loadBookSectionsRaw(book.id, book.bk_table);
  const idx = sections.findIndex(sc => sc.rowid === d.rid);
  if (idx < 0) return;
  const saved = { exact: lastSearchExact, scope: window.lastSearchScope };
  const marks = () => document.querySelectorAll('#readerPage mark.search-flash').length;
  try {
    lastSearchExact = false;
    window.lastSearchScope = 'body';
    document.querySelectorAll('#readerPage mark.search-flash').forEach(mk => { const par = mk.parentNode; if (!par) return; par.replaceChild(document.createTextNode(mk.textContent), mk); par.normalize(); });
    const m0 = marks();
    pendingSearchTerm = phrases.length ? phrases[0] : null;
    openReader(book.id, idx);
    for (let k = 1; k < phrases.length && marks() <= m0; k++) {
      pendingSearchTerm = phrases[k];
      applyPendingSearchHighlight(currentSectionIndex);
    }
  } catch (e) {
    console.warn('تعذّر فتح مصدر المعنى:', e);
  } finally {
    pendingSearchTerm = null;
    lastSearchExact = saved.exact;
    window.lastSearchScope = saved.scope;
  }
}
function closeGlossaryPopup() {
  document.getElementById('glossaryOverlay').classList.remove('show');
}


let searchIndex = null;
let searchIndexState = 'idle';
async function loadCachedBinary(name, minBytes) {
  const url = new URL(name, location.href).href;
  let cache = null;
  try { if (window.caches) cache = await caches.open(DB_CACHE_NAME); } catch (e) { cache = null; }
  if (cache) {
    try { const hit = await cache.match(url); if (hit) { const ab = await hit.arrayBuffer(); if (ab.byteLength > minBytes) return ab; await cache.delete(url); } } catch (e) {}
  }
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(name + ' ' + resp.status);
  const copy = resp.clone();
  const ab = await resp.arrayBuffer();
  if (ab.byteLength <= minBytes) throw new Error(name + ' ناقص');
  if (cache && !(navigator.serviceWorker && navigator.serviceWorker.controller)) cache.put(url, copy).catch(() => {});
  return ab;
}
async function loadSearchIndex() {
  if (searchIndexState !== 'idle' || !db) return;
  searchIndexState = 'loading';
  try {
    const ab = await loadCachedBinary('search-index.bin', 100000);
    const hl = new DataView(ab).getUint32(0, true);
    const h = JSON.parse(new TextDecoder().decode(new Uint8Array(ab, 4, hl)));
    if (h.v !== 1 || h.dbVersion !== EXPECTED_DB_VERSION) throw new Error('فهرس البحث لنسخة بيانات مختلفة');
    const idxOfBook = new Map(); let gid = 0;
    for (let i = 0; i < h.books.length; i++) {
      const bm = h.books[i]; const bk = allBooks.find(b => b.id === bm.id);
      if (!bk) throw new Error('كتاب غير موجود بالفهرس: ' + bm.id);
      const c = db.exec(`SELECT count(*) FROM "${bk.bk_table}"`)[0].values[0][0];
      if (c !== bm.n) throw new Error('عدد صفوف مختلف للكتاب ' + bm.id);
      idxOfBook.set(bm.id, i);
    }
    let pos = 4 + hl;
    const rb = new Uint8Array(ab, pos, h.rowidLen); pos += h.rowidLen;
    const vocab = new TextDecoder().decode(new Uint8Array(ab, pos, h.vocabLen)); pos += h.vocabLen;
    const offs = new Uint32Array(ab.slice(pos, pos + (h.tokens + 1) * 4)); pos += (h.tokens + 1) * 4;
    const post = new Uint8Array(ab, pos, h.postLen);
    const starts = new Int32Array(h.tokens + 1); let t = 0; starts[0] = 0;
    for (let i = vocab.indexOf('\n'); i !== -1 && t < h.tokens - 1; i = vocab.indexOf('\n', i + 1)) starts[++t] = i + 1;
    starts[h.tokens] = vocab.length + 1;
    const bookOfGid = new Uint16Array(h.rows), rowidOfGid = new Uint32Array(h.rows);
    let rp = 0; gid = 0;
    for (let i = 0; i < h.books.length; i++) {
      let prev = 0;
      for (let k = 0; k < h.books[i].n; k++) {
        let v = 0, mul = 1, b;
        do { b = rb[rp++]; v += (b & 127) * mul; mul *= 128; } while (b & 128);
        prev += v; bookOfGid[gid] = i; rowidOfGid[gid] = prev; gid++;
      }
    }
    searchIndex = { h, idxOfBook, vocab, starts, offs, post, bookOfGid, rowidOfGid, nTok: h.tokens, rows: h.rows };
    searchIndexState = 'ready';
  } catch (e) {
    searchIndexState = 'failed'; searchIndex = null;
    console.warn('فهرس البحث غير متاح — سيُستخدم البحث الكامل:', e && e.message);
  }
}
function searchIndexMark(sub, mask) {
  const ix = searchIndex, vocab = ix.vocab, starts = ix.starts;
  let p = 0;
  while ((p = vocab.indexOf(sub, p)) !== -1) {
    let lo = 0, hi = ix.nTok - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= p) lo = mid; else hi = mid - 1; }
    const post = ix.post; let q = ix.offs[lo]; const end = ix.offs[lo + 1]; let g = 0;
    while (q < end) {
      let v = 0, mul = 1, b;
      do { b = post[q++]; v += (b & 127) * mul; mul *= 128; } while (b & 128);
      g += v; mask[g] = 1;
    }
    p = starts[lo + 1];
  }
}
function searchIndexCandidates(normTerm, queryWords, wordForms, precision) {
  if (window.__noSearchIndex || searchIndexState !== 'ready' || !searchIndex) return null;
  const ix = searchIndex; const mask = new Uint8Array(ix.rows);
  const parts = normTerm.split(/\s+/).filter(Boolean);
  if (!parts.length || !queryWords.length) return null;
  let subs;
  if (precision === 'exact' && queryWords.length === 1) subs = [parts[0]];
  else { subs = []; for (const forms of wordForms) for (const f of forms) subs.push(f); }
  if (!subs.length) return null;
  for (const f of subs) { if (!f || /\s/.test(f)) return null; }
  for (const f of subs) searchIndexMark(f, mask);
  let n = 0; for (let i = 0; i < mask.length; i++) n += mask[i];
  if (n > ix.rows * 0.4) return null;
  const out = new Map();
  for (let g = 0; g < mask.length; g++) {
    if (!mask[g]) continue;
    const bid = ix.h.books[ix.bookOfGid[g]].id;
    let a = out.get(bid); if (!a) { a = []; out.set(bid, a); }
    a.push(ix.rowidOfGid[g]);
  }
  return out;
}
function fetchRowsByRowids(table, ids) {
  const rows = [];
  for (let i = 0; i < ids.length; i += 500) {
    const res = db.exec(`SELECT rowid, title, body FROM "${table}" WHERE rowid IN (${ids.slice(i, i + 500).join(',')}) ORDER BY rowid`);
    if (res.length) for (const r of res[0].values) rows.push(r);
  }
  return rows;
}

const _NORM_AR_MAP = { 'إ': 'ا', 'أ': 'ا', 'آ': 'ا', 'ة': 'ه', 'ى': 'ي', 'ی': 'ي', 'ک': 'ك' };
const _NORM_AR_RE = /[\u064B-\u065F\u0670\u0640]+|[إأآةىیک]/g;
function _normArFn(m) { return _NORM_AR_MAP[m] || ''; }
function normalizeArabic(s) {
  return String(s).replace(_NORM_AR_RE, _normArFn);
}

let lastSearchExact = false, lastSearchNormTerm = '';
const _EX_LETTER = /[\p{L}\p{N}\p{M}]/u;
function exactPhraseTest(hay, normTerm) {
  if (!normTerm || !hay) return false;
  const h = normTerm.indexOf(' ') >= 0 ? hay.replace(/\s+/g, ' ') : hay;
  let from = 0, p;
  while ((p = h.indexOf(normTerm, from)) !== -1) {
    const before = p === 0 ? '' : h[p - 1], after = h[p + normTerm.length] || '';
    if (!(before && _EX_LETTER.test(before)) && !(after && _EX_LETTER.test(after))) return true;
    from = p + 1;
  }
  return false;
}
function _flexLetter(ch) {
  if ('أإآا'.includes(ch)) return '[أإآا]';
  if ('ةه'.includes(ch)) return '[ةه]';
  if (ch === 'ى' || ch === 'ي') return '[ىي]';
  return ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function highlightExactPhrase(escapedText, normTerm) {
  const words = String(normTerm || '').split(' ').filter(Boolean);
  if (!words.length) return escapedText;
  const MK = '[\\u064B-\\u065F\\u0670\\u0640]';
  const pat = words.map(w => w.split('').map(_flexLetter).join(MK + '*')).join('(?:\\s|' + MK + ')+');
  try {
    const re = new RegExp('(^|[^\\p{L}\\p{N}\\p{M}])(' + pat + MK + '*)(?![\\p{L}\\p{N}\\p{M}])', 'giu');
    return escapedText.replace(re, (m, pre, hit) => pre + '<mark>' + hit + '</mark>');
  } catch (e) { return escapedText; }
}
function highlightForMode(escapedText, words) {
  return (lastSearchExact && lastSearchNormTerm) ? highlightExactPhrase(escapedText, lastSearchNormTerm) : highlightTermMulti(escapedText, words);
}
function _normWithMap(body) {
  let norm = ''; const idx = [];
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (/[\u064B-\u065F\u0670\u0640]/.test(c)) continue;
    if (/\s/.test(c)) { if (norm.endsWith(' ')) continue; norm += ' '; idx.push(i); continue; }
    norm += (_NORM_AR_MAP[c] || c); idx.push(i);
  }
  return { norm, idx };
}

function searchOptionSelect(btn) {
  const group = btn.closest('.search-opt-group');
  if (!group) return;
  group.querySelectorAll('.search-opt-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  updateSearchToolbarState();
}
function updateSearchToolbarState() {
  const opts = document.getElementById('searchOptsBtn'), ex = document.getElementById('searchExcludeToggle');
  if (opts) {
    const nonDefault = getSearchOptionValue('searchPrecision') !== 'scattered' || getSearchOptionValue('searchScope') !== 'both';
    opts.classList.toggle('has', nonDefault);
  }
  if (ex) {
    const inp = document.getElementById('searchExcludeInput');
    ex.classList.toggle('has', !!(inp && inp.value.trim()));
  }
  const rq = document.getElementById('searchRequireToggle');
  if (rq) { const ri = document.getElementById('searchRequireInput'); rq.classList.toggle('has', !!(ri && ri.value.trim())); }
}
function toggleSearchRequireRow(forceClose) {
  const row = document.getElementById('searchRequireRow'), btn = document.getElementById('searchRequireToggle'), inp = document.getElementById('searchRequireInput');
  if (!row) return;
  if (forceClose && inp) inp.value = '';
  const open = forceClose ? false : row.style.display === 'none';
  row.style.display = open ? 'flex' : 'none';
  if (btn) btn.classList.toggle('on', open);
  if (open && inp) inp.focus();
  updateSearchToolbarState();
}
function getSearchOptionValue(optName) {
  const group = document.querySelector(`.search-opt-group[data-opt-name="${optName}"]`);
  if (!group) return null;
  const active = group.querySelector('.search-opt-btn.active');
  return active ? active.dataset.value : null;
}

function toggleSearchFilterPanel() {
  const panel = document.getElementById('searchFilterPanel');
  const on = panel.classList.toggle('show');
  const btn = document.getElementById('searchFilterToggle');
  if (btn) btn.classList.toggle('on', on);
}

function toggleSearchOpts() {
  const r = document.getElementById('searchOptionsRow'), b = document.getElementById('searchOptsBtn');
  const show = r.style.display === 'none';
  r.style.display = show ? 'flex' : 'none';
  b.classList.toggle('on', show);
}
function toggleSearchExcludeRow(forceClose) {
  const row = document.getElementById('searchExcludeRow');
  const btn = document.getElementById('searchExcludeToggle');
  const inp = document.getElementById('searchExcludeInput');
  if (forceClose && inp) inp.value = '';
  const open = forceClose ? false : row.style.display === 'none';
  row.style.display = open ? 'flex' : 'none';
  btn.classList.toggle('on', open);
  if (open && inp) inp.focus();
  updateSearchToolbarState();
}

const MYNOTES_ID = -1000001, MYNOTES_MARK = -1000002;
const JAMI_ALL_ID = -1000000;
const CMP_SCHOLAR_AUTHOR = { 2: 19, 3: 3, 4: 13, 5: 11, 8: 1, 9: 16, 10: 7, 12: 26, 13: 4, 15: 12, 170: 17, 171: 24 };
function cmpOrderedScholarsForSearch() {
  try { return loadCmpData().scholars.slice().sort((x, y) => (x.scholar_order || 0) - (y.scholar_order || 0)); } catch (e) { return []; }
}
function getJamiScopeFromSelection(selectedIds) {
  if (!selectedIds) return null;
  if (selectedIds.has(JAMI_ALL_ID)) return null;
  const set = new Set();
  selectedIds.forEach(id => { if (id < 0 && id > -1000000) set.add(-id); });
  return set.size ? set : false;
}
function filterPanelFind(q) {
  const t = normalizeArabic(q || '').trim();
  document.querySelectorAll('#searchFilterPanel .filter-author-group').forEach(g => {
    const hit = !t || normalizeArabic(g.textContent).includes(t);
    g.style.display = hit ? '' : 'none';
    if (t && hit) { g.querySelector('.filter-books-sub').classList.add('expanded'); g.querySelectorAll('.filter-part-sub').forEach(x => x.classList.add('expanded')); }
  });
}
function filterGroupIcon(aid) {
  if (aid === 'jami_all') return 'ti-books';
  if (aid === 'mynotes') return 'ti-message-2';
  if (String(aid) === '0' || aid === GLOSSARY_AUTHOR_ID) return 'ti-vocabulary';
  if (String(aid) === '25') return 'ti-library';
  if (/^jami_s/.test(String(aid))) return 'ti-user-circle';
  return 'ti-user';
}
function buildSearchFilterPanel() {
  const panel = document.getElementById('searchFilterPanel');
  let savedIds = null;
  try {
    const raw = localStorage.getItem(SEARCH_FILTER_STATE_KEY);
    if (raw) savedIds = new Set(JSON.parse(raw));
  } catch (e) { savedIds = null; }

  let html = `<input type="text" class="filter-find" placeholder="ابحث عن مرجع أو كتاب..." oninput="filterPanelFind(this.value)">
  <div class="filter-actions filter-actions-top">
    <button id="filterToggleAllBtn" onclick="toggleAllFilterChecks()">تحديد الكل</button>
    <button class="filter-save-preset-btn" onclick="openSaveFilterPresetPrompt()"><i class="ti ti-bookmark-plus"></i> حفظ كاختصار</button>
  </div>`;
  const legacySaved = !!savedIds && !savedIds.has(0);
  const jamiChecked = (vid) => savedIds ? (legacySaved || savedIds.has(vid)) : true;
  const jamiScholars = cmpOrderedScholarsForSearch();
  const scholarsByAuthor = {};
  const orphanScholars = [];
  jamiScholars.forEach(sc => {
    const aid = CMP_SCHOLAR_AUTHOR[sc.id];
    if (aid && allAuthors[aid]) (scholarsByAuthor[aid] = scholarsByAuthor[aid] || []).push(sc);
    else orphanScholars.push(sc);
  });
  const notesChecked = savedIds ? (!savedIds.has(MYNOTES_MARK) || savedIds.has(MYNOTES_ID)) : true;
  const vChecked = (vid) => vid === MYNOTES_ID ? notesChecked : jamiChecked(vid);
  const groups = [];
  groups.push({ key: 'mynotes', name: 'تعليقاتي', books: [], virtual: [{ id: MYNOTES_ID, name: 'تعليقاتي على المسائل والنصوص', notes: true }] });
  groups.push({ key: 'jami_all', name: 'جامع الاستفتاءات', books: [], virtual: [{ id: JAMI_ALL_ID, name: 'كل الجامع (جميع المراجع)', all: true }].concat(jamiScholars.map(sc => ({ id: -sc.id, name: sc.name, scholar: true }))) });
  for (const aid of authorOrder) {
    const name = allAuthors[aid];
    const books = allBooks.filter(b => aid === GLOSSARY_AUTHOR_ID ? !allAuthors[b.author_id] : bookInAuthor(b, aid));
    const virtual = (scholarsByAuthor[aid] || []).map(sc => ({ id: -sc.id, name: 'جامع الاستفتاءات (رأيه فقط)' }));
    if (!books.length && !virtual.length) continue;
    groups.push({ key: String(aid), name, books, virtual });
  }
  for (const g of groups) {
    const aid = g.key;
    const authorChecked = savedIds
      ? (g.books.every(b => savedIds.has(b.id)) && g.virtual.every(v => vChecked(v.id)))
      : true;
    html += `<div class="filter-author-group">
      <div class="filter-author-row" onclick="toggleFilterAuthorExpand(event, '${aid}')">
        <input type="checkbox" ${authorChecked ? 'checked' : ''} data-author="${aid}" onclick="event.stopPropagation()" onchange="onFilterAuthorToggle(this)">
        ${AUTHOR_PHOTOS[aid] ? `<img class="filter-av" src="${AUTHOR_PHOTOS[aid]}" alt="">` : `<span class="filter-av filter-av-ph"><i class="ti ${filterGroupIcon(aid)}"></i></span>`}
        <span class="filter-nm">${escapeHtml(g.name)}</span><span class="filter-cnt">${g.books.length + g.virtual.length}</span>
        <span class="toggle-arrow">‹</span>
      </div>
      <div class="filter-books-sub" id="filter-books-${aid}">`;
    const _bookRow = (b, extraCls) => {
      const bookChecked = savedIds ? savedIds.has(b.id) : true;
      return `<div class="filter-book-row ${extraCls || ''}">
        <input type="checkbox" ${bookChecked ? 'checked' : ''} data-book="${b.id}" data-author-of="${aid}" onchange="onFilterBookToggle(this)">
        <span>${escapeHtml(b.name)}</span>
      </div>`;
    };
    let _gi = 0;
    for (const item of groupBooksByParts(g.books)) {
      if (item.type === 'group') {
        const gid = `${aid}_g${_gi++}`;
        const allOn = item.books.every(b => savedIds ? savedIds.has(b.id) : true);
        html += `<div class="filter-part-group">
          <div class="filter-part-row" onclick="toggleFilterPartGroup(event, '${gid}')">
            <input type="checkbox" ${allOn ? 'checked' : ''} data-bgroup="${gid}" data-author-of-group="${aid}" onclick="event.stopPropagation()" onchange="onFilterPartGroupToggle(this)">
            <i class="ti ti-stack-2 filter-part-ic"></i>
            <span class="filter-part-nm">${escapeHtml(item.root)}</span><span class="filter-cnt">${item.books.length}</span>
            <span class="toggle-arrow">‹</span>
          </div>
          <div class="filter-part-sub" id="filter-part-${gid}">${item.books.map(b => _bookRow(b, 'filter-part-child')).join('')}</div>
        </div>`;
      } else {
        html += _bookRow(item.book);
      }
    }
    for (const v of g.virtual) {
      html += `<div class="filter-book-row">
        <input type="checkbox" ${vChecked(v.id) ? 'checked' : ''} data-book="${v.id}" data-virtual="1" data-author-of="${aid}" onchange="onFilterVirtualToggle(this)">
        <span>${escapeHtml(v.name)}</span>
      </div>`;
    }
    html += `</div></div>`;
  }
  panel.innerHTML = html;
  panel.dataset.built = '1';
  refreshFilterToggleBtn();
  renderSearchFilterPresetsRow();
}

function toggleFilterAuthorExpand(evt, aid) {
  const sub = document.getElementById(`filter-books-${aid}`);
  const row = evt.currentTarget;
  sub.classList.toggle('expanded');
  row.classList.toggle('expanded');
}

function onFilterAuthorToggle(checkbox) {
  const aid = checkbox.dataset.author;
  document.querySelectorAll(`input[data-author-of="${aid}"]`).forEach(c => c.checked = checkbox.checked);
  document.querySelectorAll(`input[data-author-of-group="${aid}"]`).forEach(c => { c.checked = checkbox.checked; c.indeterminate = false; });
  saveCurrentSearchFilterState();
}

const OFFICIAL_SITES = {
  wikishia: [{ n: 'ويكي شيعة (موسوعة)', u: 'https://ar.wikishia.net/' }],
  wikifeqh: [{ n: 'ويكي فقه (موسوعة)', u: 'https://ar.wikifeqh.ir/' }],
  1:  [{ n: 'موقع السيد السيستاني الرسمي (الاستفتاءات)', u: 'https://www.sistani.org/arabic/qa/' }],
  3:  [{ n: 'موقع السيد الخامنئي الرسمي (الاستفتاءات)', u: 'https://www.leader.ir/ar/istifta' }],
  4:  [{ n: 'موقع الشيخ الفياض الرسمي (الاستفتاءات)', u: 'https://ar.alfayadh.org/qa/' }],
  7:  [{ n: 'لجنة الإفتاء للسيد صادق الشيرازي', u: 'https://www.alisteftaa.com/' }],
  8:  [{ n: 'موقع السيد كاظم الحائري الرسمي', u: 'https://www.alhaeri.org/' }],
  11: [{ n: 'موقع السيد الخوئي الرسمي', u: 'https://www.alkhoei.org/' }],
  12: [{ n: 'موقع الشيخ الوحيد الرسمي', u: null }],
  13: [{ n: 'استفتاءات الإمام الخميني (موقع أحكام)', u: 'https://ahkam.islamasil.net/category/%D8%A7%D9%84%D8%A7%D8%B3%D8%AA%D9%81%D8%AA%D8%A7%D8%A1%D8%A7%D8%AA/%D8%A2%D9%8A%D8%A9-%D8%A7%D9%84%D9%84%D9%87-%D8%A7%D9%84%D8%B3%D9%8A%D8%AF-%D8%B1%D9%88%D8%AD-%D8%A7%D9%84%D9%84%D9%87-%D8%A7%D9%84%D8%AE%D9%85%D9%8A%D9%86%D9%8A/' }],
  15: [{ n: 'موقع الشيخ بشير النجفي الرسمي', u: 'https://www.alnajafy.com/' }],
  16: [{ n: 'موقع السيد محمد الشيرازي الرسمي', u: 'https://alshirazi.org/?langs=AR' }],
  17: [{ n: 'موقع الميرزا التبريزي الرسمي', u: null }],
  19: [{ n: 'موقع السيد الحكيم الرسمي', u: 'https://alhakeem.com/ar' }],
  20: [{ n: 'موقع الشيخ الخاقاني الرسمي', u: 'https://www.alkhakani-najaf.com/alkhakani/' }],
  23: [{ n: 'موقع الشيخ مكارم الشيرازي (الاستفتاءات)', u: 'https://www.makarem.ir/main.aspx?typeinfo=21&lid=1' }],
  24: [{ n: 'موقع السيد الزنجاني الرسمي', u: null }],
  27: [{ n: 'موقع الشيخ السبحاني الرسمي', u: null }],
};
const OFFICIAL_SITES_OVERRIDE_KEY = 'rs_official_sites_override';
const SEARCH_SITES_KEY = 'rs_search_sites';
function getSiteOverrides() { try { return JSON.parse(localStorage.getItem(OFFICIAL_SITES_OVERRIDE_KEY) || '{}'); } catch (e) { return {}; } }
function officialSitesFor(aid) {
  const list = OFFICIAL_SITES[aid];
  if (!list) return [];
  const ov = getSiteOverrides();
  return list.map((x, i) => ({ n: x.n, u: ov[aid + '_' + i] || x.u, aid, i })).filter((x) => !!x.u);
}
function getSavedSiteSet() { try { return new Set((JSON.parse(localStorage.getItem(SEARCH_SITES_KEY) || '[]')).map(String)); } catch (e) { return new Set(); } }
function saveSiteSelection() {
  const arr = [];
  document.querySelectorAll('#searchFilterPanel input[data-site]').forEach(c => { if (c.checked) arr.push(c.dataset.site); });
  try { localStorage.setItem(SEARCH_SITES_KEY, JSON.stringify(arr)); } catch (e) {}
}
function siteHost(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } }
function openSiteLink(url) { window.open(url, '_blank', 'noopener'); }
function siteSearchUrl(site, term) {
  const host = site.u ? siteHost(site.u) : '';
  const authorName = String(allAuthors[site.aid] || '').trim();
  if (host) return `https://www.google.com/search?q=site:${host}+${encodeURIComponent(term)}`;
  return `https://www.google.com/search?q=${encodeURIComponent(site.n + ' ' + authorName + ' ' + term)}`;
}
function editSiteUrl(aid, i) {
  const st = officialSitesFor(aid)[i];
  openTextPrompt('رابط الموقع الرسمي', st.u || 'https://', (val) => {
    val = (val || '').trim();
    if (val && !/^https?:\/\//i.test(val)) val = 'https://' + val;
    const ov = getSiteOverrides();
    if (val) ov[aid + '_' + i] = val; else delete ov[aid + '_' + i];
    try { localStorage.setItem(OFFICIAL_SITES_OVERRIDE_KEY, JSON.stringify(ov)); } catch (e) {}
    openOfficialSitesSheet();
  });
}
function closeOfficialSitesSheet() { const ov = document.getElementById('officialSitesOverlay'); if (ov) ov.classList.remove('show'); }
function _siteEntriesAll(aid) {
  const list = OFFICIAL_SITES[aid]; if (!list) return [];
  const ov = getSiteOverrides();
  return list.map((x, i) => ({ n: x.n, u: ov[aid + '_' + i] || x.u || null, aid, i })).filter((x) => !!x.u);
}
function openSiteHome(aid, i) {
  const st = _siteEntriesAll(aid).find((x) => x.i === +i); if (!st) return;
  const authorName = String(allAuthors[aid] || '').trim();
  openSiteLink(st.u || ('https://www.google.com/search?q=' + encodeURIComponent('الموقع الرسمي ' + (authorName || st.n))));
}
function openOfficialSitesSheet() {
  let ov = document.getElementById('officialSitesOverlay');
  if (!ov) {
    ov = document.createElement('div'); ov.id = 'officialSitesOverlay';
    ov.onclick = (e) => { if (e.target === ov) closeOfficialSitesSheet(); };
    document.body.appendChild(ov);
  }
  const term = lastSearchTerm || '';
  const wikis = ['wikishia', 'wikifeqh'];
  const orderIdx = (a) => { const k = authorOrder.indexOf(a); return k < 0 ? 999 : k; };
  const aids = Object.keys(OFFICIAL_SITES).filter((k) => /^\d+$/.test(k)).map(Number).sort((a, b) => orderIdx(a) - orderIdx(b));
  const card = (aid) => _siteEntriesAll(aid).map((st) => {
    const photo = AUTHOR_PHOTOS[aid];
    const known = !!st.u;
    return `<div class="osite-card ${known ? '' : 'unverified'}" onclick="openSiteHome('${aid}', ${st.i})">
      ${photo ? `<img class="osite-av" src="${photo}" alt="">` : '<span class="osite-av osite-av-ph"><i class="ti ti-world"></i></span>'}
      <div class="osite-main"><div class="osite-name">${escapeHtml(st.n)}</div><div class="osite-host">${known ? escapeHtml(siteHost(st.u)) : 'الرابط غير مؤكَّد — بحث عن الموقع'}</div></div>
      <div class="osite-btns" onclick="event.stopPropagation()">
        ${term && known ? `<button title="ابحث عن الكلمة في الموقع" onclick="openSiteLink('${escapeJsAttr(siteSearchUrl(st, term))}')"><i class="ti ti-search"></i></button>` : ''}
        ${typeof aid === 'string' ? '' : `<button title="${known ? 'تعديل الرابط' : 'أضف الرابط الرسمي'}" onclick="editSiteUrlAny('${aid}', ${st.i})"><i class="ti ti-pencil"></i></button>`}
      </div></div>`;
  }).join('');
  ov.innerHTML = `<div class="osites-sheet">${RSUI.xBtn()}<div class="osites-title" style="padding-inline-end:40px"><i class="ti ti-world"></i> المواقع الرسمية${term ? ` — بحث «${escapeHtml(term)}»` : ''}</div>
    <div class="osites-hint">${term ? 'اضغط البطاقة لفتح الموقع، وزر البحث لبحث كلمتك داخله.' : 'اضغط البطاقة لفتح موقع المرجع. اكتب كلمة في البحث لتبحث فيه مباشرة.'}</div>
    <div class="osites-list">
      <div class="osites-sec">الموسوعات</div><div class="osites-grid">${wikis.map(card).join('')}</div>
      <div class="osites-sec">مواقع المراجع</div><div class="osites-grid">${aids.map(card).join('')}</div>
    </div></div>`;
  ov.classList.add('show');
}
function editSiteUrlAny(aid, i) {
  const st = _siteEntriesAll(aid).find((x) => x.i === +i); if (!st) return;
  openTextPrompt('رابط الموقع الرسمي', st.u || 'https://', (val) => {
    val = (val || '').trim();
    if (val && !/^https?:\/\//i.test(val)) val = 'https://' + val;
    const ov = getSiteOverrides();
    if (val) ov[aid + '_' + i] = val; else delete ov[aid + '_' + i];
    try { localStorage.setItem(OFFICIAL_SITES_OVERRIDE_KEY, JSON.stringify(ov)); } catch (e) {}
    openOfficialSitesSheet();
  });
}
function onFilterVirtualToggle(cb) {
  document.querySelectorAll(`#searchFilterPanel input[data-book="${cb.dataset.book}"]`).forEach(c => { c.checked = cb.checked; });
  saveCurrentSearchFilterState();
}
function filterAllChecked() {
  const boxes = document.querySelectorAll('#searchFilterPanel input[data-book]');
  return boxes.length > 0 && Array.from(boxes).every(c => c.checked);
}
function refreshFilterToggleBtn() {
  if (typeof syncFilterPartGroups === 'function') syncFilterPartGroups();
  const btn = document.getElementById('filterToggleAllBtn');
  if (!btn) return;
  const any = Array.from(document.querySelectorAll('#searchFilterPanel input[data-book]')).some(c => c.checked);
  btn.textContent = any ? 'إلغاء التحديد' : 'تحديد الكل';
}
function toggleAllFilterChecks() {
  const any = Array.from(document.querySelectorAll('#searchFilterPanel input[data-book]')).some(c => c.checked);
  setAllFilterChecks(!any);
}
function setAllFilterChecks(state) {
  document.querySelectorAll('#searchFilterPanel input[type=checkbox]').forEach(c => c.checked = state);
  saveCurrentSearchFilterState();
}

function getSelectedBookIds() {
  const ids = new Set();
  document.querySelectorAll('#searchFilterPanel input[data-book]').forEach(c => {
    if (c.checked) ids.add(parseInt(c.dataset.book, 10));
  });
  ids.add(0);
  return ids;
}

let lastSearchResults = [];
let lastSearchTerm = '';
const SEARCH_PAGE_SIZE = 20;
let searchCurrentPage = 1;
let lastSearchPartialResults = [];
let lastSearchSuggestion = null;
let lastSearchWasAutoCorrected = null;
let lastSearchQueryWords = [];
let lastSearchElapsedMs = 0;
let searchRequestToken = 0;
let searchResultContext = null;

const SEARCH_FILTER_STATE_KEY = 'rs_search_filter_state';
const SEARCH_FILTER_PRESETS_KEY = 'rs_search_filter_presets';

function getSearchFilterPresets() {
  try { return JSON.parse(localStorage.getItem(SEARCH_FILTER_PRESETS_KEY) || '[]'); } catch (e) { return []; }
}
function saveSearchFilterPresets(presets) {
  localStorage.setItem(SEARCH_FILTER_PRESETS_KEY, JSON.stringify(presets));
}
function getCurrentFilterSelectedBookIds() {
  const ids = [];
  document.querySelectorAll('#searchFilterPanel input[data-book]').forEach(c => { if (c.checked) ids.push(parseInt(c.dataset.book, 10)); });
  if (ids.length) { ids.push(0); ids.push(MYNOTES_MARK); }
  return ids;
}
function saveCurrentSearchFilterState() {
  refreshFilterToggleBtn();
  try { localStorage.setItem(SEARCH_FILTER_STATE_KEY, JSON.stringify(getCurrentFilterSelectedBookIds())); } catch (e) {  }
}
function applySearchFilterSelection(bookIds) {
  const idSet = new Set(bookIds);
  const legacy = !idSet.has(0);
  document.querySelectorAll('#searchFilterPanel input[data-book]').forEach(c => {
    c.checked = ((legacy || !idSet.has(MYNOTES_MARK)) && c.dataset.virtual && (legacy || parseInt(c.dataset.book, 10) === MYNOTES_ID)) ? true : idSet.has(parseInt(c.dataset.book, 10));
  });
  document.querySelectorAll('#searchFilterPanel input[data-author]').forEach(c => {
    const aid = c.dataset.author;
    const bookBoxes = document.querySelectorAll(`input[data-author-of="${aid}"]`);
    c.checked = bookBoxes.length > 0 && Array.from(bookBoxes).every(b => b.checked);
  });
  refreshFilterToggleBtn();
}
function openSaveFilterPresetPrompt() {
  const ids = getCurrentFilterSelectedBookIds();
  if (!ids.length) { showGenericToast('حدّد مرجعاً أو كتاباً واحداً على الأقل أولاً'); return; }
  openTextPrompt('اسم الاختصار (مثلاً: مسائل الحج)', '', (name) => {
    if (!name || !name.trim()) return;
    const presets = getSearchFilterPresets();
    presets.push({ id: 'sfp_' + Date.now(), name: name.trim(), bookIds: ids });
    saveSearchFilterPresets(presets);
    renderSearchFilterPresetsRow();
  });
}
function applySearchFilterPreset(presetId) {
  const preset = getSearchFilterPresets().find(p => p.id === presetId);
  if (!preset) return;
  if (!document.getElementById('searchFilterPanel').dataset.built) buildSearchFilterPanel();
  applySearchFilterSelection(preset.bookIds);
  saveCurrentSearchFilterState();
  if (!document.getElementById('searchFilterPanel').classList.contains('show')) toggleSearchFilterPanel();
}
function deleteSearchFilterPreset(evt, presetId) {
  if (evt) evt.stopPropagation();
  const presets = getSearchFilterPresets().filter(p => p.id !== presetId);
  saveSearchFilterPresets(presets);
  renderSearchFilterPresetsRow();
}
let presetLongPressTimer = null;
let presetLongPressFired = false;
function presetChipPointerDown(evt, presetId) {
  presetLongPressFired = false;
  clearTimeout(presetLongPressTimer);
  presetLongPressTimer = setTimeout(() => {
    presetLongPressFired = true;
    if (navigator.vibrate) { try { navigator.vibrate(12); } catch (e) {} }
    confirmDeleteSearchFilterPreset(presetId);
  }, 550);
}
function presetChipPointerUp() {
  clearTimeout(presetLongPressTimer);
}
function presetChipClick(evt, presetId) {
  if (presetLongPressFired) { presetLongPressFired = false; return; }
  applySearchFilterPreset(presetId);
}
function confirmDeleteSearchFilterPreset(presetId) {
  const preset = getSearchFilterPresets().find(p => p.id === presetId);
  if (!preset) return;
  openConfirmDialog(`حذف اختصار "${preset.name}"؟ لا يمكن التراجع بعد الحذف.`, () => {
    deleteSearchFilterPreset(null, presetId);
  });
}
function renderSearchFilterPresetsRow() {
  const row = document.getElementById('searchFilterPresetsRow');
  if (!row) return;
  const presets = getSearchFilterPresets();
  if (!presets.length) { row.innerHTML = ''; row.style.display = 'none'; return; }
  row.style.display = 'flex';
  row.innerHTML = '<span class="preset-label">اختصاراتي</span>' + presets.map(p => `
    <span class="search-preset-chip" data-preset-id="${p.id}" data-preset-name="${escapeHtml(p.name)}"
      onclick="presetChipClick(event, '${p.id}')"
      onpointerdown="presetChipPointerDown(event, '${p.id}')"
      onpointerup="presetChipPointerUp(event)"
      onpointerleave="presetChipPointerUp(event)"
      onpointercancel="presetChipPointerUp(event)">
      ${escapeHtml(p.name)}
    </span>`).join('');
}

function extractFootnoteSearchText(rawFootnotes) {
  if (!rawFootnotes) return '';
  try {
    const entries = JSON.parse(rawFootnotes);
    if (!Array.isArray(entries)) return '';
    const texts = [];
    for (const fn of entries) {
      if (typeof fn === 'string') { texts.push(fn); continue; }
      if (Array.isArray(fn)) {
        for (const entry of fn) {
          if (entry && typeof entry.text === 'string') texts.push(entry.text);
        }
      }
    }
    return texts.join('\n');
  } catch (e) { return ''; }
}

function pickFootnoteForDisplay(rawFootnotes, normTerm, queryWords) {
  if (!rawFootnotes) return null;
  let entries;
  try { entries = JSON.parse(rawFootnotes); } catch (e) { return null; }
  if (!Array.isArray(entries)) return null;
  const tests = [
    t => t.includes(normTerm),
    t => queryWords.length > 0 && queryWords.every(w => t.includes(w)),
    t => queryWords.some(w => t.includes(w)),
  ];
  const cands = [];
  entries.forEach((fn, i) => {
    if (typeof fn === 'string') cands.push({ num: i + 1, jurist: null, text: fn });
    else if (Array.isArray(fn)) fn.forEach(e => { if (e && typeof e.text === 'string') cands.push({ num: i + 1, jurist: e.jurist || null, text: e.text }); });
  });
  for (const test of tests) {
    const hit = cands.find(c => test(normalizeArabic(c.text)));
    if (hit) return hit;
  }
  return null;
}

function findFootnoteNumberContaining(rawFootnotes, normTerm) {
  if (!rawFootnotes) return null;
  try {
    const entries = JSON.parse(rawFootnotes);
    if (!Array.isArray(entries)) return null;
    for (let i = 0; i < entries.length; i++) {
      const fn = entries[i];
      let text = '';
      if (typeof fn === 'string') text = fn;
      else if (Array.isArray(fn)) text = fn.map(e => (e && typeof e.text === 'string') ? e.text : '').join('\n');
      if (text && normalizeArabic(text).includes(normTerm)) return i + 1;
    }
  } catch (e) {  }
  return null;
}

function levenshteinDistance(a, b) {
  if (a === b) return 0;
  const al = a.length, bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;
  let prevRow = new Array(bl + 1);
  for (let j = 0; j <= bl; j++) prevRow[j] = j;
  for (let i = 1; i <= al; i++) {
    const curRow = new Array(bl + 1);
    curRow[0] = i;
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curRow[j] = Math.min(prevRow[j] + 1, curRow[j - 1] + 1, prevRow[j - 1] + cost);
    }
    prevRow = curRow;
  }
  return prevRow[bl];
}

let searchWordIndex = null;
function buildSearchWordIndex() {
  if (searchWordIndex) return searchWordIndex;
  const freq = new Map();
  const wordRe = /[\u0621-\u064A]+/g;
  for (const book of allBooks) {
    if (isThamraBook(book.id)) {
      const data = loadThamraData();
      for (const sec of data.sections) {
        const words = normalizeArabic(sec.text || '').match(wordRe) || [];
        for (const w of words) { if (w.length >= 3) freq.set(w, (freq.get(w) || 0) + 1); }
      }
      continue;
    }
    let rows;
    try {
      const res = db.exec(`SELECT title FROM "${book.bk_table}"`);
      rows = res.length ? res[0].values : [];
    } catch (e) { continue; }
    for (const [title] of rows) {
      const words = normalizeArabic(title || '').match(wordRe) || [];
      for (const w of words) { if (w.length >= 3) freq.set(w, (freq.get(w) || 0) + 1); }
    }
  }
  searchWordIndex = freq;
  return freq;
}

function suggestCorrection(word) {
  const freq = buildSearchWordIndex();
  if (freq.has(word)) return null;
  let best = null, bestDist = Infinity, bestFreq = 0;
  const maxDist = word.length <= 4 ? 1 : word.length <= 7 ? 2 : 3;
  for (const [candidate, count] of freq) {
    if (Math.abs(candidate.length - word.length) > maxDist) continue;
    const dist = levenshteinDistance(word, candidate);
    if (dist <= maxDist && (dist < bestDist || (dist === bestDist && count > bestFreq))) {
      best = candidate; bestDist = dist; bestFreq = count;
    }
  }
  return best;
}

function expandSearchWord(word, depth) {
  const forms = new Set([word]);
  if (depth === 'stem' || depth === 'root') {
    if (word.startsWith('ال') && word.length > 4) forms.add(word.slice(2));
    else if (!word.startsWith('ال')) forms.add('ال' + word);
  }
  return forms;
}

function findBestSnippetWindow(normBody, originalBody, queryWords, windowRadius = 90) {
  if (!queryWords.length) return { start: 0, end: Math.min(originalBody.length, 160) };
  const positions = [];
  for (const w of queryWords) {
    let idx = 0;
    while (true) {
      const found = normBody.indexOf(w, idx);
      if (found === -1) break;
      positions.push({ pos: found, len: w.length });
      idx = found + w.length;
    }
  }
  if (!positions.length) return { start: 0, end: Math.min(originalBody.length, 160) };
  positions.sort((a, b) => a.pos - b.pos);
  let bestScore = -1, bestWinStart = 0, bestWinEnd = 160;
  for (const p of positions) {
    const winStart = Math.max(0, p.pos - windowRadius);
    const winEnd = Math.min(normBody.length, p.pos + windowRadius);
    const uniqueWordsInWindow = new Set();
    for (const p2 of positions) {
      if (p2.pos >= winStart && p2.pos < winEnd) uniqueWordsInWindow.add(p2.pos + ':' + p2.len);
    }
    const score = uniqueWordsInWindow.size;
    if (score > bestScore) { bestScore = score; bestWinStart = winStart; bestWinEnd = winEnd; }
  }
  return { start: bestWinStart, end: bestWinEnd };
}

function makeSnippetAdvanced(body, queryWords, displayTerm) {
  if (!body) return '';
  if (lastSearchExact && lastSearchNormTerm) {
    try {
      const { norm, idx } = _normWithMap(body);
      const L = lastSearchNormTerm.length;
      let m = -1, from = 0, p;
      const flat = norm;
      while ((p = flat.indexOf(lastSearchNormTerm, from)) !== -1) {
        const b4 = p === 0 ? '' : flat[p - 1], af = flat[p + L] || '';
        if (!(b4 && _EX_LETTER.test(b4)) && !(af && _EX_LETTER.test(af))) { m = p; break; }
        from = p + 1;
      }
      if (m >= 0) {
        const s0 = idx[Math.max(0, m - 90)], e0 = idx[Math.min(idx.length - 1, m + L + 90)] + 1;
        const sn = (s0 > 0 ? '…' : '') + body.slice(s0, e0) + (e0 < body.length ? '…' : '');
        return highlightExactPhrase(escapeHtml(sn), lastSearchNormTerm);
      }
    } catch (e) {  }
  }
  const normBody = normalizeArabic(body);
  const { start, end } = findBestSnippetWindow(normBody, body, queryWords);
  let snippet = (start > 0 ? '…' : '') + body.slice(start, end) + (end < body.length ? '…' : '');
  return highlightTermMulti(escapeHtml(snippet), queryWords.length ? queryWords : [displayTerm]);
}

function highlightTermMulti(escapedText, words) {
  if (!words || !words.length) return escapedText;
  let result = escapedText;
  const buildFlexiblePattern = (w) => {
    return w.split('').map(ch => {
      if ('أإآا'.includes(ch)) return '[أإآا]';
      if ('ةه'.includes(ch)) return '[ةه]';
      if (ch === 'ى' || ch === 'ي') return '[ىي]';
      return ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).join('[\\u064B-\\u065F\\u0670]*');
  };
  const sortedWords = [...new Set(words)].filter(Boolean).sort((a, b) => b.length - a.length);
  for (const w of sortedWords) {
    if (!w) continue;
    try {
      const pattern = new RegExp(buildFlexiblePattern(w), 'gi');
      result = result.replace(pattern, (m) => `<mark>${m}</mark>`);
    } catch (e) {  }
  }
  return result;
}

function computeRelevanceScore(normTitle, normBody, queryWords) {
  let score = 0;
  for (const w of queryWords) {
    if (!w) continue;
    if (normTitle.includes(w)) score += 50;
    let idx = 0, count = 0;
    while (count < 15) {
      const found = normBody.indexOf(w, idx);
      if (found === -1) break;
      count++; idx = found + w.length;
    }
    score += count * 3;
  }
  if (queryWords.length > 1) {
    const phrase = queryWords.join(' ');
    if (normBody.includes(phrase) || normTitle.includes(phrase)) score += 10;
  }
  return score;
}


function searchThamraBookAdvanced(book, normTerm, queryWords, expandedWordSets, precision, scope) {
  const data = loadThamraData();
  const full = [];
  const partial = [];
  const seenSectionsFull = new Set();
  const seenSectionsPartial = new Set();
  data.sections.forEach((sec, sectionIdx) => {
    for (let i = sec.itemsStart; i < sec.itemsEnd; i++) {
      const it = data.items[i];
      if (!it) continue;
      if (i === sec.itemsStart && sec.seq !== -1) continue;
      const itemText = getThamraItemSearchText(it);
      if (!itemText) continue;
      const normItemText = scope !== 'titles' ? normalizeArabic(itemText) : '';
      const normSecTitle = scope !== 'body' ? normalizeArabic(sec.text) : '';
      const haystack = scope === 'titles' ? normSecTitle : (scope === 'body' ? normItemText : normSecTitle + '\n' + normItemText);

      if (precision === 'exact' && exactPhraseTest(haystack, normTerm)) {
        if (!seenSectionsFull.has(sectionIdx)) {
          seenSectionsFull.add(sectionIdx);
          full.push({ bookId: book.id, bookName: book.name, rowid: sectionIdx, title: sec.text, body: scope === 'titles' ? '' : itemText, isThamra: true,
            score: computeRelevanceScore(normSecTitle, normItemText, queryWords) });
        }
        continue;
      }
      if (precision === 'exact') continue;
      const matched = [], missing = [];
      expandedWordSets.forEach((forms, idx) => {
        const hit = [...forms].some(f => haystack.includes(f));
        if (hit) matched.push(queryWords[idx]); else missing.push(queryWords[idx]);
      });
      if (matched.length === queryWords.length && precision !== 'exact') {
        if (!seenSectionsFull.has(sectionIdx)) {
          seenSectionsFull.add(sectionIdx);
          full.push({ bookId: book.id, bookName: book.name, rowid: sectionIdx, title: sec.text, body: scope === 'titles' ? '' : itemText, isThamra: true,
            score: computeRelevanceScore(normSecTitle, normItemText, queryWords) });
        }
      } else if (matched.length > 0 && queryWords.length > 1) {
        if (!seenSectionsPartial.has(sectionIdx)) {
          seenSectionsPartial.add(sectionIdx);
          partial.push({ bookId: book.id, bookName: book.name, rowid: sectionIdx, title: sec.text, body: scope === 'titles' ? '' : itemText, isThamra: true,
            score: computeRelevanceScore(normSecTitle, normItemText, matched), matchedWords: matched, missingWords: missing });
        }
      }
    }
  });
  return { full, partial };
}


function searchMyNotes(normTerm, queryWords, precision, scope) {
  const out = [];
  (notes || []).forEach((n, i) => {
    const text = String(n.text || ''), title = String(n.title || n.bookName || ''), quote = String(n.extText || '');
    const normNote = scope === 'titles' ? '' : normalizeArabic(text + '\n' + quote);
    const normTitle = scope === 'body' ? '' : normalizeArabic(title);
    const hay = (scope === 'titles' ? normTitle : (scope === 'body' ? normNote : normTitle + '\n' + normNote));
    const ok = precision === 'exact'
      ? exactPhraseTest(hay, normTerm)
      : queryWords.every(w => hay.includes(w));
    if (!ok) return;
    out.push({ isNote: true, noteIndex: i, bookId: n.bookId || -1, bookName: n.kind ? (n.extSub || n.bookName || 'نص محدَّد') : ((n.bookName || '') + (n.masalaNum ? ' — مسألة ' + n.masalaNum : '')),
      rowid: -1, title: n.title || n.bookName || 'تعليق', body: text + (quote ? '\n«' + quote.slice(0, 200) + '»' : ''), score: computeRelevanceScore(normTitle, normNote, queryWords) + 5 });
  });
  return out;
}
function openNoteResult(r) {
  const n = notes[r.noteIndex]; if (!n) return;
  if (n.kind) { openExtSource(n, restoreSearchFromResult); return; }
  navStack = [restoreSearchFromResult];
  updateBackButtonVisibility();
  openReader(n.bookId, n.sectionIdx);
  scrollToMasalaWithinSection(n.sectionIdx, n.masalaNum);
}

function doSearch() {
  return doSearchInternal(document.getElementById('searchInput').value.trim(), false);
}

function doSearchInternal(rawTerm, isAutoCorrected, autoCorrectedFrom) {
  searchTabActive = false;
  const resultsDiv = document.getElementById('searchResults');
  const paginationDiv = document.getElementById('searchPagination');
  if (!rawTerm) { resultsDiv.innerHTML = ''; paginationDiv.innerHTML = ''; return; }
  document.getElementById('searchFilterPanel').classList.remove('show');
  if (!isAutoCorrected) resultsDiv.innerHTML = '<div class="empty-state">جاري البحث...</div>';
  paginationDiv.innerHTML = '';

  const precision = getSearchOptionValue('searchPrecision');
  const scope = getSearchOptionValue('searchScope');
  window.lastSearchScope = scope;
  const depth = 'exact';
  const filterBuilt = document.getElementById('searchFilterPanel').dataset.built;
  const selectedIds = filterBuilt ? getSelectedBookIds() : null;
  const excludeRaw = document.getElementById('searchExcludeInput').value.trim();
  const normExclude = excludeRaw ? normalizeArabic(excludeRaw) : '';

  const reqEl = document.getElementById('searchRequireInput');
  const reqWords = reqEl ? normalizeArabic(reqEl.value.trim()).split(/\s+/).filter(Boolean) : [];
  const normTerm = normalizeArabic(rawTerm).replace(/\s+/g, ' ').trim();
  const queryWords = normTerm.split(/\s+/).filter(Boolean);
  lastSearchExact = precision === 'exact'; lastSearchNormTerm = lastSearchExact ? normTerm : '';
  const expandedWordSets = queryWords.map(w => expandSearchWord(w, depth));

  const startTime = performance.now();

  const MAX_BATCH_MS = 40;
  const fullResults = [];
  try {
    const jamiScope = getJamiScopeFromSelection(selectedIds);
    const cmpHits = (jamiScope === false || scope === 'footnotes') ? [] : searchCmpData(normTerm, queryWords, precision, jamiScope, scope);
    cmpHits.forEach(h => { h.score = computeRelevanceScore(normalizeArabic(h.title || ''), normalizeArabic(h.body || ''), queryWords); fullResults.push(h); });
  } catch (e) { console.warn('بحث المقارنة:', e); }
  try {
    if ((!selectedIds || selectedIds.has(MYNOTES_ID)) && scope !== 'footnotes') {
      searchMyNotes(normTerm, queryWords, precision, scope).forEach(h => fullResults.push(h));
    }
  } catch (e) { console.warn('بحث التعليقات:', e); }
  const partialResults = [];
  let bookQueue = allBooks.slice();
  let stopped = false;
  let candByBook = null;
  if (scope !== 'footnotes') {
    try { candByBook = searchIndexCandidates(normTerm, queryWords, expandedWordSets.map(f => [...f]), precision); } catch (e) { candByBook = null; }
  }

  const expandedWordArrays = expandedWordSets.map(f => [...f]);
  function matchWordSets(haystack) {
    const matched = [];
    const missing = [];
    for (let idx = 0; idx < expandedWordArrays.length; idx++) {
      const forms = expandedWordArrays[idx];
      let hit = false;
      for (let k = 0; k < forms.length; k++) { if (haystack.includes(forms[k])) { hit = true; break; } }
      if (hit) matched.push(queryWords[idx]); else missing.push(queryWords[idx]);
    }
    return { matched, missing };
  }

  function processOneBook(book) {
    if (isThamraBook(book.id)) {
      if (scope === 'footnotes') return;
      const thamraMatches = searchThamraBookAdvanced(book, normTerm, queryWords, expandedWordSets, precision, scope);
      fullResults.push(...thamraMatches.full);
      partialResults.push(...thamraMatches.partial);
      return;
    }
    let rows;
    try {
      if (candByBook && searchIndex.idxOfBook.has(book.id)) {
        const ids = candByBook.get(book.id);
        if (!ids) return;
        rows = fetchRowsByRowids(book.bk_table, ids);
      } else {
        const needsFootnotes = scope === 'footnotes';
        const cols = needsFootnotes ? 'rowid, title, footnotes' : (scope === 'titles' ? "rowid, title, ''" : 'rowid, title, body');
        const res = db.exec(`SELECT ${cols} FROM "${book.bk_table}" ORDER BY rowid`);
        rows = res.length ? res[0].values : [];
      }
    } catch (e) { return; }
    for (const [rowid, title, thirdCol] of rows) {
      const t = title || '';
      const isFootnoteScope = scope === 'footnotes';
      const b = isFootnoteScope ? extractFootnoteSearchText(thirdCol) : (thirdCol || '');
      if (isFootnoteScope && !b) continue;
      const normTitle = (scope === 'both' || scope === 'titles') ? normalizeArabic(t) : '';
      const normBody = scope === 'titles' ? '' : normalizeArabic(b);
      const haystack = scope === 'titles' ? normTitle : (scope === 'both' ? normTitle + '\n' + normBody : normBody);
      const fnPick = isFootnoteScope ? pickFootnoteForDisplay(thirdCol, normTerm, queryWords) : null;
      const footnoteNum = isFootnoteScope ? (fnPick ? fnPick.num : findFootnoteNumberContaining(thirdCol, normTerm)) : null;
      const shownBody = fnPick ? `[${fnPick.num}] ${fnPick.jurist ? fnPick.jurist + ': ' : ''}${fnPick.text}` : (scope === 'titles' ? '' : b);

      if (precision === 'exact') {
        if (exactPhraseTest(haystack, normTerm)) {
          fullResults.push({ bookId: book.id, bookName: book.name, rowid, title: t, body: shownBody, footnoteNum,
            score: computeRelevanceScore(normTitle, normBody, queryWords) });
        }
      } else {
        const { matched, missing } = matchWordSets(haystack);
        if (matched.length === queryWords.length) {
          fullResults.push({ bookId: book.id, bookName: book.name, rowid, title: t, body: shownBody, footnoteNum,
            score: computeRelevanceScore(normTitle, normBody, queryWords) });
        } else if (matched.length > 0) {
          partialResults.push({ bookId: book.id, bookName: book.name, rowid, title: t, body: shownBody, footnoteNum,
            score: computeRelevanceScore(normTitle, normBody, matched), matchedWords: matched, missingWords: missing });
        }
      }
      if (fullResults.length >= 500) { stopped = true; break; }
    }
  }

  searchRequestToken++;
  const myToken = searchRequestToken;

  function processBatch() {
    if (myToken !== searchRequestToken) return;
    const batchStart = performance.now();
    while (bookQueue.length > 0 && (performance.now() - batchStart) < MAX_BATCH_MS) {
      const book = bookQueue.shift();
      if (selectedIds && !selectedIds.has(book.id)) continue;
      processOneBook(book);
      if (stopped) break;
    }
    if (stopped || bookQueue.length === 0) finishSearch();
    else setTimeout(processBatch, 0);
  }

  function finishSearch() {
    function applyExclude(list) {
      if (!normExclude) return list;
      const exTitle = scope !== 'body' && scope !== 'footnotes';
      const exBody = scope !== 'titles';
      return list.filter(r => !normalizeArabic((exTitle ? (r.title || '') : '') + ' ' + (exBody ? (r.body || '') : '')).includes(normExclude));
    }
    function applyRequire(list) {
      if (!reqWords.length) return list;
      const inTitle = scope !== 'body' && scope !== 'footnotes';
      const inBody = scope !== 'titles';
      return list.filter(r => { const hay = normalizeArabic((inTitle ? (r.title || '') : '') + ' ' + (inBody ? (r.body || '') : '')); return reqWords.every(w => hay.includes(w)); });
    }
    let finalFull = applyRequire(applyExclude(fullResults));
    let finalPartial = applyRequire(applyExclude(partialResults));

    finalFull.sort((a, b) => b.score - a.score);
    finalPartial.sort((a, b) => b.score - a.score);

    if (finalFull.length === 0 && finalPartial.length === 0 && queryWords.length === 1
        && queryWords[0].length >= 4 && !isAutoCorrected) {
      const corrected = suggestCorrection(queryWords[0]);
      if (corrected && levenshteinDistance(queryWords[0], corrected) === 1) {
        doSearchInternal(corrected, true, rawTerm);
        return;
      }
    }

    let suggestion = null;
    if (finalFull.length === 0 && finalPartial.length === 0 && queryWords.length === 1 && queryWords[0].length >= 3) {
      const corrected = suggestCorrection(queryWords[0]);
      if (corrected) suggestion = corrected;
    }

    lastSearchResults = finalFull;
    lastSearchPartialResults = finalPartial;
    lastSearchTerm = rawTerm;
    lastSearchQueryWords = queryWords;
    lastSearchSuggestion = suggestion;
    lastSearchElapsedMs = performance.now() - startTime;
    lastSearchWasAutoCorrected = isAutoCorrected ? autoCorrectedFrom : null;
    searchCurrentPage = 1;
    renderSearchResultsPage();
  }

  setTimeout(processBatch, 0);
}

function getMatchScoreLabel(score, matchedCount, totalWords, isPartial) {
  if (isPartial) return 'تطابق جزئي';
  if (totalWords <= 1) return score >= 20 ? 'تطابق قوي' : 'تطابق جيد';
  const ratio = matchedCount / totalWords;
  if (ratio >= 1 && score >= 15) return 'تطابق قوي';
  if (ratio >= 1) return 'تطابق جيد';
  return 'تطابق جزئي';
}
function matchPill(label) {
  const k = label === 'تطابق قوي' ? 'strong' : (label === 'تطابق جيد' ? 'good' : 'partial');
  return `<span class="mpill mpill-${k}">${label}</span>`;
}

function resultAuthorHtml(r) {
  try {
    if (!r) return '';
    let a = '';
    if (r.isNote) return '<span class="rauth">تعليقاتي</span><span class="rsep">›</span>';
    if (r.isCmp) { const sc = r.cmpScholarId != null ? loadCmpData().scholarById.get(r.cmpScholarId) : null; a = sc ? String(sc.name || '').trim() : ''; }
    else { const b = allBooks.find(x => x.id === r.bookId); a = b ? (allAuthors[b.author_id] || '').trim() : ''; }
    return a ? `<span class="rauth">${escapeHtml(a)}</span><span class="rsep">›</span>` : '';
  } catch (e) { return ''; }
}
function renderSearchResultsPage() {
  const resultsDiv = document.getElementById('searchResults');
  const paginationDiv = document.getElementById('searchPagination');
  const results = lastSearchResults;
  const partials = lastSearchPartialResults || [];
  const term = lastSearchTerm;

  if (results.length === 0 && partials.length === 0) {
    let suggestionHtml = '';
    if (lastSearchSuggestion) {
      suggestionHtml = `<div class="dym-suggestion">قصدك <button onclick="applyDidYouMean('${escapeJsAttr(lastSearchSuggestion)}')">${escapeHtml(lastSearchSuggestion)}</button>؟</div>`;
    }
    const chipHtml = `<button class="osites-chip" onclick="openOfficialSitesSheet()"><i class="ti ti-world"></i> المواقع الرسمية</button>`;
    resultsDiv.innerHTML = `${suggestionHtml}<div id="searchEmpty">لا توجد نتائج لكلمة "${escapeHtml(term)}"</div>${chipHtml}`;
    paginationDiv.innerHTML = '';
    return;
  }

  const totalPages = Math.ceil(results.length / SEARCH_PAGE_SIZE) || (partials.length ? 1 : 0);
  const startIdx = (searchCurrentPage - 1) * SEARCH_PAGE_SIZE;
  const pageResults = results.slice(startIdx, startIdx + SEARCH_PAGE_SIZE);

  const elapsedSec = ((lastSearchElapsedMs || 0) / 1000).toFixed(2);
  let html = '';
  if (lastSearchWasAutoCorrected) {
    html += `<div class="dym-suggestion dym-autocorrect">عرضنا نتائج <b>"${escapeHtml(term)}"</b> بدل <b>"${escapeHtml(lastSearchWasAutoCorrected)}"</b> — <button onclick="applyDidYouMean('${escapeJsAttr(lastSearchWasAutoCorrected)}', true)">البحث بالكلمة الأصلية</button></div>`;
  }
  if (results.length > 0) {
    html += `<div class="section-header">${results.length} نتيجة — صفحة ${searchCurrentPage} من ${totalPages} <span class="search-timing">(${elapsedSec} ث)</span></div>`;
  }
  html += `<button class="osites-chip" onclick="openOfficialSitesSheet()"><i class="ti ti-world"></i> المواقع الرسمية</button>`;
  const qWords = lastSearchQueryWords || [term];
  pageResults.forEach((r, i) => {
    const globalIdx = startIdx + i;
    const snippet = makeSnippetAdvanced(r.body, qWords, term);
    const matchCountNote = qWords.length > 1
      ? `<div class="result-match-count">مطابقة ب${qWords.length === 2 ? 'كلمتين' : normalizeDigits(String(qWords.length)) + ' كلمات'}</div>` : '';
    html += `<div class="result-row" onclick="searchResultClick(${globalIdx})">
      <div class="rbook"><span class="rbook-t">${globalIdx + 1}. ${resultAuthorHtml(r)}${escapeHtml(r.bookName)}${cmpFavBadge(r)}${urwaContextLabel(r.bookId, (typeof r.rowid === 'number' ? r.rowid - 1 : r.sectionIdx)) ? `<span class="rctx"> — ${escapeHtml(urwaContextLabel(r.bookId, (typeof r.rowid === 'number' ? r.rowid - 1 : r.sectionIdx)))}</span>` : ''}</span>${matchPill(getMatchScoreLabel(r.score, qWords.length, qWords.length, false))}</div>
      <div class="rtitle">${(window.lastSearchScope === 'body' || window.lastSearchScope === 'footnotes') ? escapeHtml(r.title) : highlightForMode(escapeHtml(r.title), qWords)}</div>
      <div class="rsnippet">${snippet}</div>
      ${matchCountNote}
    </div>`;
  });

  if (partials.length > 0) {
    html += `<div class="partial-note"><i class="ti ti-alert-triangle"></i> النتائج التالية لا تحتوي كل كلمات البحث</div>`;
    partials.slice(0, 30).forEach((r, i) => {
      const snippet = makeSnippetAdvanced(r.body, r.matchedWords || qWords, term);
      const missingNote = r.missingWords && r.missingWords.length
        ? `<div class="result-missing-note">لم تُذكر: ${r.missingWords.map(escapeHtml).join('، ')}</div>` : '';
      html += `<div class="result-row result-row-partial" onclick="searchPartialResultClick(${i})">
        <div class="rbook"><span class="rbook-t">${resultAuthorHtml(r)}${escapeHtml(r.bookName)}${cmpFavBadge(r)}${urwaContextLabel(r.bookId, (typeof r.rowid === 'number' ? r.rowid - 1 : r.sectionIdx)) ? `<span class="rctx"> — ${escapeHtml(urwaContextLabel(r.bookId, (typeof r.rowid === 'number' ? r.rowid - 1 : r.sectionIdx)))}</span>` : ''}</span>${matchPill('تطابق جزئي')}</div>
        <div class="rtitle">${(window.lastSearchScope === 'body' || window.lastSearchScope === 'footnotes') ? escapeHtml(r.title) : highlightForMode(escapeHtml(r.title), r.matchedWords || qWords)}</div>
        <div class="rsnippet">${snippet}</div>
        ${missingNote}
      </div>`;
    });
  }

  resultsDiv.innerHTML = html;
  renderSearchPagination(totalPages);
}

function applyDidYouMean(word, forceNoAutoCorrect) {
  document.getElementById('searchInput').value = word;
  if (forceNoAutoCorrect) { doSearchInternal(word, true, null); }
  else doSearch();
}

function searchPartialResultClick(idx) {
  const r = lastSearchPartialResults[idx];
  if (!r) return;
  const savedResults = lastSearchResults;
  lastSearchResults = lastSearchPartialResults;
  searchResultClick(idx);
  lastSearchResults = savedResults;
}



function renderSearchPagination(totalPages) {
  const paginationDiv = document.getElementById('searchPagination');
  if (totalPages <= 1) { paginationDiv.innerHTML = ''; return; }
  let html = '';
  for (let p = 1; p <= totalPages; p++) {
    html += `<button class="${p === searchCurrentPage ? 'active' : ''}" onclick="goToSearchPage(${p})">${p}</button>`;
  }
  paginationDiv.innerHTML = html;
}

function goToSearchPage(p) {
  searchCurrentPage = p;
  renderSearchResultsPage();
  document.getElementById('searchResults').scrollIntoView({ behavior: 'smooth', block: 'start' });
}


function cmpFavBadge(r) {
  if (!r || !r.cmpFavNames || !r.cmpFavNames.length) return '';
  return ` <span class="cmp-fav-mark"><i class="ti ti-star-filled"></i> فيها رأي ${escapeHtml(r.cmpFavNames.slice(0, 2).join('، '))}</span>`;
}
let searchReturnState = { scroll: 0, page: 1 };
function restoreSearchFromResult() {
  const y = searchReturnState.scroll || 0;
  if (searchReturnState.page && searchReturnState.page !== searchCurrentPage && lastSearchResults.length) {
    searchCurrentPage = searchReturnState.page;
    try { renderSearchResultsPage(); } catch (e) {}
  }
  showSearchRoot();
  const c = document.getElementById('content');
  const apply = () => { c.scrollTop = y; };
  requestAnimationFrame(() => { apply(); requestAnimationFrame(apply); });
  setTimeout(apply, 120); setTimeout(apply, 350);
}
function searchResultClick(resultIndex) {
  const r = lastSearchResults[resultIndex];
  if (!r) return;
  const _sp = document.getElementById('searchPage');
  if (_sp && _sp.classList.contains('active')) {
    searchReturnState = { scroll: document.getElementById('content').scrollTop, page: searchCurrentPage };
  }

  if (r.isNote) { openNoteResult(r); return; }
  try { if (window.RSV77 && RSV77.bookToast && !r.isCmp) RSV77.bookToast(r.bookId); } catch (e) {}
  if (r.isCmp) {
    navStack = [restoreSearchFromResult];
    updateBackButtonVisibility();
    renderCmpComparisonView(r.cmpSubjectId);
    searchResultContext = { results: lastSearchResults, index: resultIndex };
    searchTabActive = true;
    lastSearchPageBreadcrumb = lastBooksBreadcrumb;
    try {
      const page = document.getElementById('comparisonPage');
      const card = r.cmpScholarId != null ? page.querySelector(`.cmp-answer-card[data-sch="${r.cmpScholarId}"]`) : null;
      const term = lastSearchTerm;
      if (term) {
        let done = false;
        if (card) { pendingSearchTerm = term; applyPendingSearchHighlight(undefined, card); done = !!page.querySelector('mark.search-flash'); }
        if (!done) { pendingSearchTerm = term; applyPendingSearchHighlight(undefined, page); }
        pendingSearchTerm = null;
      }
    } catch (e) { console.warn('cmp highlight', e); }
    return;
  }
  const book = allBooks.find(b => b.id === r.bookId);

  if (r.isThamra) {
    navStack = [restoreSearchFromResult];
    updateBackButtonVisibility();
    pendingSearchTerm = lastSearchTerm;
    openThamraReader(r.bookId, r.rowid);
    searchResultContext = { results: lastSearchResults, index: resultIndex };
    searchTabActive = true;
    lastSearchPageBreadcrumb = lastBooksBreadcrumb;
    return;
  }

  currentAuthorId = allAuthors[book.author_id] ? book.author_id : GLOSSARY_AUTHOR_ID;
  loadBookSections(r.bookId, book);
  const idx = currentSections.findIndex(s => s.rowid === r.rowid);
  navStack = [restoreSearchFromResult];
  updateBackButtonVisibility();
  pendingSearchTerm = lastSearchTerm;
  pendingFootnoteNum = typeof r.footnoteNum === 'number' ? r.footnoteNum : null;
  renderContinuousReader(r.bookId, idx >= 0 ? idx : 0, { highlightTerm: pendingSearchTerm });
  searchResultContext = { results: lastSearchResults, index: resultIndex };
  searchTabActive = true;
  lastSearchPageBreadcrumb = lastBooksBreadcrumb;
}

function navSearchResult(delta) {
  const newIndex = searchResultContext.index + delta;
  if (newIndex < 0 || newIndex >= searchResultContext.results.length) return;
  searchResultClick(newIndex);
}

function applyPendingSearchHighlight(sectionIdx, targetEl) {
  if (!pendingSearchTerm) return;
  const term = pendingSearchTerm;
  pendingSearchTerm = null;
  const footnoteNum = pendingFootnoteNum;
  pendingFootnoteNum = null;
  if (rw && typeof sectionIdx === 'number') rwEnsure(sectionIdx);
  const sectionEl = typeof sectionIdx === 'number' ? document.getElementById(`rs-sec-${sectionIdx}`) : null;
  let bodyEl;
  if (sectionEl && typeof footnoteNum === 'number') {
    const marker = Array.from(sectionEl.querySelectorAll('sup[onclick*="toggleFootnote"]'))
      .find(s => (s.getAttribute('onclick') || '').replace(/\s+/g, '').endsWith(`,${sectionIdx},${footnoteNum})`));
    if (marker) {
      marker.classList.add('fn-marker-flash');
      let tries = 0;
      const settle = () => {
        marker.scrollIntoView({ behavior: tries === 0 ? 'auto' : 'smooth', block: 'center' });
        if (++tries < 6) setTimeout(() => requestAnimationFrame(settle), 160);
      };
      requestAnimationFrame(settle);
      return;
    }
  }
  if (!bodyEl && targetEl) bodyEl = targetEl.querySelector('.body-text') || targetEl;
  if (!bodyEl) bodyEl = sectionEl ? sectionEl.querySelector('.body-text') : document.querySelector('#readerPage .body-text');
  if (!bodyEl) return;

  const buildTextMap = (root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    let norm = ''; const map = [];
    let n;
    while ((n = walker.nextNode())) {
      const t = n.nodeValue;
      for (let i = 0; i < t.length; i++) {
        const c = normalizeArabic(t[i]);
        for (let k = 0; k < c.length; k++) { norm += /\s/.test(c[k]) ? ' ' : c[k]; map.push({ node: n, off: i }); }
      }
    }
    return { norm, map };
  };
  const escRe = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const normTerm2 = normalizeArabic(term).trim();
  const qWords = normTerm2.split(/\s+/).filter(Boolean);
  const wordForms = new Set();
  qWords.forEach(w => { wordForms.add(w); if (w.startsWith('ال') && w.length > 4) wordForms.add(w.slice(2)); else if (!w.startsWith('ال')) wordForms.add('ال' + w); });
  const findRanges = (root) => {
    const { norm, map } = buildTextMap(root);
    if (!norm) return null;
    if (lastSearchExact && qWords.length) {
      const re = new RegExp('(^|[^\\p{L}\\p{N}\\p{M}])(' + qWords.map(escRe).join('\\s+') + ')(?![\\p{L}\\p{N}\\p{M}])', 'u');
      const m = re.exec(norm);
      if (!m) return null;
      const st = m.index + m[1].length;
      return { ranges: [[st, st + m[2].length]], map };
    }
    if (qWords.length > 1) {
      const m = new RegExp(qWords.map(escRe).join('\\s+')).exec(norm);
      if (m) return { ranges: [[m.index, m.index + m[0].length]], map };
    }
    const hits = [];
    qWords.forEach(w => {
      [...wordForms].filter(f => f === w || f === 'ال' + w || (w.startsWith('ال') && f === w.slice(2))).forEach(f => {
        let from = 0, p;
        while ((p = norm.indexOf(f, from)) !== -1) { hits.push({ w, s: p, e: p + f.length }); from = p + f.length; if (hits.length > 4000) break; }
      });
    });
    if (!hits.length) return null;
    hits.sort((a, b) => a.s - b.s);
    let best = null, bestScore = -1;
    for (const h of hits) {
      const set = new Set();
      hits.forEach(o => { if (Math.abs(o.s - h.s) <= 220) set.add(o.w); });
      if (set.size > bestScore) { bestScore = set.size; best = h; }
      if (bestScore === qWords.length) break;
    }
    const near = hits.filter(o => Math.abs(o.s - best.s) <= 220);
    const seen = new Set(); const ranges = [];
    near.forEach(o => { if (!seen.has(o.w)) { seen.add(o.w); ranges.push([o.s, o.e]); } });
    return { ranges, map };
  };
  const wrapRange = (map, s0, e0) => {
    const segs = [];
    for (let i = s0; i < e0; i++) {
      const m = map[i]; if (!m) continue;
      const last = segs[segs.length - 1];
      if (last && last.node === m.node && m.off + 1 >= last.to) last.to = Math.max(last.to, m.off + 1);
      else segs.push({ node: m.node, from: m.off, to: m.off + 1 });
    }
    const marks = [];
    for (let k = segs.length - 1; k >= 0; k--) {
      const { node, from, to } = segs[k];
      if (!node.parentNode) continue;
      const txt = node.nodeValue;
      const mark = document.createElement('mark');
      mark.className = 'search-flash';
      mark.textContent = txt.slice(from, to);
      const parent = node.parentNode;
      parent.insertBefore(document.createTextNode(txt.slice(0, from)), node);
      parent.insertBefore(mark, node);
      parent.insertBefore(document.createTextNode(txt.slice(to)), node);
      parent.removeChild(node);
      marks.unshift(mark);
    }
    return marks;
  };
  const _scope = window.lastSearchScope || 'both';
  let found = null;
  if (_scope === 'titles' && sectionEl) {
    const tEl = sectionEl.querySelector('.section-title span') || sectionEl.querySelector('.section-title');
    if (tEl) found = findRanges(tEl);
    if (found) bodyEl = tEl;
  } else if (_scope === 'body') {
    found = findRanges(bodyEl);
  } else {
    found = findRanges(bodyEl);
    if (!found && sectionEl) found = findRanges(sectionEl);
  }
  if (!found) return;
  const sorted = found.ranges.slice().sort((a, b) => b[0] - a[0]);
  const firstStart = Math.min(...found.ranges.map(r => r[0]));
  let firstMark = null;
  sorted.forEach(([s0, e0]) => {
    const ms = wrapRange(found.map, s0, e0);
    if (ms.length && s0 === firstStart) firstMark = ms[0];
    else if (ms.length && !firstMark) firstMark = ms[0];
  });
  if (!firstMark) return;
  let reflowAttempts = 0;
  const settleScroll = () => {
    firstMark.scrollIntoView({ behavior: reflowAttempts === 0 ? 'auto' : 'smooth', block: 'center' });
    reflowAttempts++;
    if (reflowAttempts < 6) setTimeout(() => requestAnimationFrame(settleScroll), 160);
  };
  setTimeout(() => requestAnimationFrame(settleScroll), 50);
}

let freeWritings = JSON.parse(localStorage.getItem('rs_writings') || '[]');
let currentWritingId = null;

function saveWritingsStorage() {
  localStorage.setItem('rs_writings', JSON.stringify(freeWritings));
}

const personalState = { q: '', all: {}, tab: 'books' };
function personalSlice(arr, key, nameFn) {
  const t = normalizeArabic(personalState.q || '').trim();
  let r = t ? arr.filter(x => normalizeArabic(nameFn(x) || '').includes(t)) : arr.slice();
  r.reverse();
  const lim = (t || personalState.all[key]) ? r.length : 30;
  const more = r.length - lim;
  return { items: r.slice(0, lim), more, total: r.length };
}
function personalMoreBtn(key, more) {
  return more > 0 ? `<button class="personal-more" onclick="personalState.all['${key}']=true;renderWritingPage()">عرض الكل (+${more})</button>` : '';
}
function personalSearchInput(v) {
  personalState.q = v; renderWritingPage();
  const el = document.getElementById('personalFind'); if (el) { el.focus(); el.setSelectionRange(v.length, v.length); }
}
function personalSetTab(t) { personalState.tab = t; personalState.q = ''; renderWritingPage(); }
function personalDate(ts) {
  if (!ts) return '';
  try { return new Date(ts).toLocaleDateString('ar', { year: 'numeric', month: 'short', day: 'numeric' }); } catch (e) { return ''; }
}

function renderWritingPage() {
  currentWritingId = null;
  if (currentTab === 'writing') registerView(() => { renderWritingPage(); switchPage('writingPage', 'شخصي'); });
  const container = document.getElementById('writingPage');
  const tab = personalState.tab;
  const tabs = [['books', 'كتبي', customBooks.length], ['cols', 'مجموعاتي', collections.length], ['wr', 'كتاباتي', freeWritings.length]];
  const holders = { books: 'ابحث في كتبي...', cols: 'ابحث في مجموعاتي...', wr: 'ابحث في كتاباتي...' };
  let html = `<div class="personal-top">
    <div class="seg">${tabs.map(([k, n, c]) => `<button class="${tab === k ? 'on' : ''}" onclick="personalSetTab('${k}')">${n}<span class="n">${normalizeDigits(String(c))}</span></button>`).join('')}</div>
    <div class="personal-find-row"><input type="text" id="personalFind" class="personal-find" placeholder="${holders[tab]}" value="${escapeHtml(personalState.q)}" oninput="personalSearchInput(this.value)">
      <button class="psq" title="${tab === 'books' ? 'كتاب جديد' : tab === 'cols' ? 'مجموعة جديدة' : 'كتابة جديدة'}" aria-label="جديد" onclick="${tab === 'books' ? "openTextPrompt('اسم الكتاب الجديد','كتابي', createCustomBookFromPersonal)" : tab === 'cols' ? "openTextPrompt('اسم الحقيبة','حقيبتي', createCollectionFromPersonal)" : 'openWritingEditor(null)'}"><i class="ti ti-plus"></i></button>
      <button class="psq psq-quiet" title="استيراد من ملف" aria-label="استيراد من ملف" onclick="rsImportFile()"><i class="ti ti-file-import"></i></button></div></div>`;
  if (tab === 'books') {
    const pb = personalSlice(customBooks, 'books', b => b.name);
    if (!customBooks.length) html += `<div class="pempty">لا توجد كتب بعد.<br>الكتاب الخاص مساحة تجمع فيها المسائل والملاحظات التي تختارها.</div>`;
    else if (!pb.total) html += `<div class="pempty">لا نتائج مطابقة.</div>`;
    else {
      html += '<div class="plist">';
      pb.items.forEach(cb => {
        html += swipeRow(`<div class="pitem" onclick="openCustomBookFromPersonal('${cb.id}')"><div class="pitem-name">${escapeHtml(cb.name)}</div><div class="pitem-sub">${normalizeDigits(String((cb.items || []).length))} عنصر</div></div>`,
          [{ icon: 'pencil', label: 'الاسم', color: '#2471A3', js: `personalRenameBook('${cb.id}')` }, { icon: 'trash', label: 'حذف', color: '#c0392b', js: `personalDeleteBook('${cb.id}')` }]);
      });
      html += '</div>' + personalMoreBtn('books', pb.more);
    }
  } else if (tab === 'cols') {
    const pc = personalSlice(collections, 'cols', c => c.name);
    if (!collections.length) html += `<div class="pempty">لا توجد مجموعات بعد.<br>المجموعة (الحقيبة) تضم كتباً وأقساماً تحتاجها معاً.</div>`;
    else if (!pc.total) html += `<div class="pempty">لا نتائج مطابقة.</div>`;
    else {
      html += '<div class="plist">';
      pc.items.forEach(col => {
        html += swipeRow(`<div class="pitem" onclick="openCollectionFromPersonal('${col.id}')"><div class="pitem-name">${escapeHtml(col.name)}</div><div class="pitem-sub">${normalizeDigits(String(col.memberKeys.length))} عنصر</div></div>`,
          [{ icon: 'pencil', label: 'الاسم', color: '#2471A3', js: `personalRenameCollection('${col.id}')` }, { icon: 'trash', label: 'حذف', color: '#c0392b', js: `personalDeleteCollection('${col.id}')` }]);
      });
      html += '</div>' + personalMoreBtn('cols', pc.more);
    }
  } else {
    const pw = personalSlice(freeWritings, 'wr', w => (w.title || '') + ' ' + (w.text || ''));
    if (!freeWritings.length) html += `<div class="pempty">لا توجد كتابات بعد.</div>`;
    else if (!pw.total) html += `<div class="pempty">لا نتائج مطابقة.</div>`;
    else {
      html += '<div class="plist">';
      pw.items.forEach(w => {
        const txt = (w.text || '').trim() || '(كتابة فارغة)';
        const d = personalDate(w.updatedAt);
        const wc = w.color || '#8e5bd4';
        html += swipeRow(`<div class="pitem" style="--bar:${wc}" onclick="openWritingEditor('${w.id}')">${w.title ? `<div class="pitem-name" style="color:${wc}">${escapeHtml(w.title)}</div>` : ''}<div class="pitem-txt">${escapeHtml(txt.slice(0, 180))}</div>${d ? `<div class="pitem-sub">${d}</div>` : ''}</div>`,
          [{ icon: 'pencil', label: 'العنوان', color: '#2471A3', js: `personalRenameWriting('${w.id}')` }, { icon: 'trash', label: 'حذف', color: '#c0392b', js: `personalDeleteWriting('${w.id}')` }]);
      });
      html += '</div>' + personalMoreBtn('wr', pw.more);
    }
  }
  html += '<div style="height:var(--nav-clear);flex-shrink:0;"></div>';
  container.innerHTML = html;
}

function enterPersonalTab() { if (currentTab !== 'writing') showTab('writing'); }
function openCustomBookFromPersonal(id) { enterPersonalTab(); openCustomBook(id); }
function openCollectionFromPersonal(id) { enterPersonalTab(); openCollection(id); }
function createCustomBookFromPersonal(name) {
  const trimmed = (name || '').trim() || 'كتابي';
  const cb = { id: newUid('cb'), name: trimmed, createdAt: Date.now(), items: [], migratedV2: true };
  customBooks.push(cb); saveCustomBooks();
  openCustomBookFromPersonal(cb.id);
}
function createCollectionFromPersonal(name) {
  const trimmed = (name || '').trim() || 'حقيبتي';
  const col = { id: newUid('col'), name: trimmed, createdAt: Date.now(), memberKeys: [] };
  collections.push(col); saveCollections();
  openCollectionFromPersonal(col.id);
}

const WRITING_COLORS = ['#8e5bd4', '#d9443a', '#2e9e5b', '#2f7fd1', '#d4a017', '#d6568f', '#555555'];
function writingDisplayTitle(w) {
  if (w.title && w.title.trim()) return w.title.trim();
  const t = (w.text || '').trim().split('\n')[0] || 'كتابة';
  return t.length > 28 ? t.slice(0, 28) + '…' : t;
}
function openWritingFromLibrary(id) {
  enterPersonalTab();
  openWritingEditor(id);
}
function personalRenameBook(id) {
  const cb = customBooks.find(b => b.id === id); if (!cb) return;
  openTextPrompt('إعادة تسمية الكتاب', cb.name, (name) => { const t = (name || '').trim(); if (!t) return; cb.name = t; cb.updatedAt = Date.now(); saveCustomBooks(); renderWritingPage(); });
}
function personalDeleteBook(id) {
  const cb = customBooks.find(b => b.id === id); if (!cb) return;
  openConfirmDialog(`حذف كتاب "${cb.name}" نهائياً؟ لا يمكن التراجع عن هذا.`, () => {
    customBooks = customBooks.filter(b => b.id !== id); saveCustomBooks();
    pins = pins.filter(p => !(p.type === 'custombook' && p.id === id)); savePins();
    ensureLibraryOrder(); saveLibraryOrder(); renderWritingPage();
  });
}
function personalRenameCollection(id) {
  const col = collections.find(c => c.id === id); if (!col) return;
  openTextPrompt('إعادة تسمية الحقيبة', col.name, (name) => { const t = (name || '').trim(); if (!t) return; col.name = t; saveCollections(); renderWritingPage(); });
}
function personalDeleteCollection(id) {
  const col = collections.find(c => c.id === id); if (!col) return;
  openConfirmDialog(`حذف حقيبة "${col.name}"؟ الكتب والمراجع بداخلها تبقى بمكانها.`, () => {
    collections = collections.filter(c => c.id !== id); saveCollections();
    libraryOrder = libraryOrder.filter(k => k !== `collection:${id}`); saveLibraryOrder();
    pins = pins.filter(p => !(p.type === 'collection' && p.id === id)); savePins();
    renderWritingPage();
  });
}
function personalRenameWriting(id) {
  const w = freeWritings.find(x => x.id === id); if (!w) return;
  openTextPrompt('عنوان الكتابة', w.title || '', (name) => { w.title = (name || '').trim(); w.updatedAt = Date.now(); saveWritingsStorage(); renderWritingPage(); });
}
function personalDeleteWriting(id) {
  const w = freeWritings.find(x => x.id === id); if (!w) return;
  openConfirmDialog('حذف هذه الكتابة نهائياً؟', () => {
    freeWritings = freeWritings.filter(x => x.id !== id); saveWritingsStorage();
    ensureLibraryOrder(); saveLibraryOrder(); renderWritingPage();
  });
}

let writingDraftColor = null;
function sanitizeWritingHtml(html) {
  const doc = new DOMParser().parseFromString('<div id="r">' + html + '</div>', 'text/html');
  const root = doc.getElementById('r');
  const allowed = new Set(['B', 'I', 'U', 'STRONG', 'EM', 'SPAN', 'FONT', 'DIV', 'P', 'BR', 'UL', 'OL', 'LI']);
  const danger = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'SVG', 'MATH']);
  (function walk(node) {
    let c = node.firstChild;
    while (c) {
      const next = c.nextSibling;
      if (c.nodeType === 1) {
        if (danger.has(c.tagName)) { node.removeChild(c); }
        else if (!allowed.has(c.tagName)) {
          while (c.firstChild) node.insertBefore(c.firstChild, c);
          node.removeChild(c);
          c = node.firstChild;
          if (c) {  }
          continue;
        } else {
          Array.from(c.attributes).forEach(at => {
            if (at.name === 'style') c.setAttribute('style', at.value.replace(/url\([^)]*\)|expression\([^)]*\)|@import[^;]*/gi, ''));
            else if (at.name === 'class' && /^(wr-masala|wr-masala-head|wr-masala-body|wr-masala-note)$/.test(at.value.trim())) {  }
            else if (at.name === 'contenteditable' && at.value === 'false' && c.getAttribute('class') === 'wr-masala') {  }
            else if (!['color', 'size'].includes(at.name)) c.removeAttribute(at.name);
          });
          walk(c);
        }
      } else if (c.nodeType !== 3) { node.removeChild(c); }
      c = next;
    }
  })(root);
  return root.innerHTML;
}
function writingEditorEl() { return document.getElementById('writingMainTextarea'); }
function getWritingText() { const el = writingEditorEl(); return el ? el.innerText.replace(/\u00a0/g, ' ') : ''; }
function openWritingEditor(id) {
  currentWritingId = id;
  wrPanelTab = 'fav';
  const container = document.getElementById('writingPage');
  const writing = id ? freeWritings.find(w => w.id === id) : null;
  writingDraftColor = writing ? (writing.color || WRITING_COLORS[0]) : WRITING_COLORS[0];
  const bodyHtml = writing ? (writing.html ? sanitizeWritingHtml(writing.html) : escapeHtml(writing.text || '').replace(/\n/g, '<br>')) : '';
  container.innerHTML = `
    <div class="wr-top" id="wrTop">
      <div class="wr-bar">
        <button class="wr-ic" onclick="renderWritingPage()" title="رجوع للقائمة"><i class="ti ti-chevron-right"></i></button>
        <span class="wr-bar-sp"></span>
        <button class="wr-ic" onclick="copyCurrentWriting()" title="نسخ"><i class="ti ti-copy"></i></button>
        <button class="wr-ic" onclick="shareCurrentWriting()" title="مشاركة"><i class="ti ti-share-3"></i></button>
        ${writing ? `<button class="wr-ic wr-danger" onclick="deleteCurrentWriting()" title="حذف"><i class="ti ti-trash"></i></button>` : ''}
        <button class="wr-save" onclick="saveCurrentWriting()"><i class="ti ti-check"></i> حفظ</button>
      </div>
      <div class="wr-toolbar" id="wrToolbar">
        <button data-cmd="bold" onmousedown="event.preventDefault()" onclick="wrCmd('bold')" title="عريض"><b>B</b></button>
        <button data-cmd="italic" onmousedown="event.preventDefault()" onclick="wrCmd('italic')" title="مائل"><i>I</i></button>
        <button data-cmd="underline" onmousedown="event.preventDefault()" onclick="wrCmd('underline')" title="تسطير"><u>U</u></button>
        <span class="wr-sep"></span>
        <button onmousedown="event.preventDefault()" onclick="wrFontStep(-1)" title="تصغير الخط">A−</button>
        <span class="wr-size" id="wrSizeLbl">3</span>
        <button onmousedown="event.preventDefault()" onclick="wrFontStep(1)" title="تكبير الخط">A+</button>
        <span class="wr-sep"></span>
        <button onmousedown="event.preventDefault()" onclick="wrPalette('foreColor')" title="لون الخط"><i class="ti ti-typography"></i></button>
        <button onmousedown="event.preventDefault()" onclick="wrPalette('hiliteColor')" title="تظليل"><i class="ti ti-palette"></i></button>
        <button onmousedown="event.preventDefault()" onclick="wrCmd('removeFormat')" title="مسح التنسيق"><i class="ti ti-eraser"></i></button>
      </div>
      <div class="wr-palette" id="wrPalette"></div>
    </div>
    <div class="wr-meta">
      <input type="text" id="writingTitleInput" class="writing-title-input" placeholder="عنوان الكتابة" value="${escapeHtml(writing ? (writing.title || '') : '')}">
      <button class="wr-tag-btn" onclick="toggleWritingColorPicker()" title="لون الكتابة بالقائمة"><span class="wr-tag-dot" id="wrTagDot" style="background:${writingDraftColor}"></span><i class="ti ti-tag"></i></button>
    </div>
    <div class="writing-colors" id="writingColors" style="display:none">${writingColorsHtml()}</div>
    <button class="wr-insert-btn" onclick="toggleWritingFavPanel()"><i class="ti ti-star"></i> إدراج مسألة من المفضلة أو التعليقات</button>
    <div id="writingFavPanel" class="writing-fav-panel"></div>
    <div id="writingMainTextarea" class="writing-editor" contenteditable="true" dir="rtl" data-placeholder="اكتب هنا..." onkeyup="wrUpdateToolbarState()" onmouseup="wrUpdateToolbarState()" ontouchend="wrUpdateToolbarState()">${bodyHtml}</div>
    <div style="height:24px"></div>`;
  try { document.execCommand('styleWithCSS', false, true); } catch (e) {}
  wrBindSelectionWatcher();
  registerView(() => {
    const ed = writingEditorEl();
    if (ed && currentWritingId === id) switchPage('writingPage', 'شخصي');
    else openWritingEditor(id);
  });
}
let wrPanelTab = 'fav';
let wrSelWatcherBound = false;
function wrBindSelectionWatcher() {
  if (wrSelWatcherBound) return;
  wrSelWatcherBound = true;
  document.addEventListener('selectionchange', wrUpdateToolbarState);
}
function wrUpdateToolbarState() {
  const el = writingEditorEl(); if (!el) return;
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || !el.contains(sel.anchorNode)) return;
  ['bold', 'italic', 'underline'].forEach(cmd => {
    let on = false;
    try { on = document.queryCommandState(cmd); } catch (e) {}
    const b = document.querySelector(`#wrToolbar button[data-cmd="${cmd}"]`);
    if (b) b.classList.toggle('on', !!on);
  });
  let sz = 3;
  try { sz = parseInt(document.queryCommandValue('fontSize'), 10) || 3; } catch (e) {}
  const lbl = document.getElementById('wrSizeLbl'); if (lbl) lbl.textContent = String(sz);
}
function toggleWritingColorPicker() {
  const el = document.getElementById('writingColors');
  el.style.display = el.style.display === 'none' ? 'flex' : 'none';
}
function writingColorsHtml() {
  return WRITING_COLORS.map(c => `<button class="wr-color-dot ${writingDraftColor === c ? 'sel' : ''}" style="background:${c}" onclick="setWritingColor('${c}')"></button>`).join('');
}
function setWritingColor(c) {
  writingDraftColor = c;
  document.getElementById('writingColors').innerHTML = writingColorsHtml();
  const d = document.getElementById('wrTagDot'); if (d) d.style.background = c;
}
function wrCmd(cmd, val) {
  const el = writingEditorEl(); if (!el) return;
  el.focus();
  try { document.execCommand(cmd, false, val === undefined ? null : val); } catch (e) {}
  wrUpdateToolbarState();
}
function wrFontStep(d) {
  const el = writingEditorEl(); if (!el) return;
  el.focus();
  let cur = 3;
  try { cur = parseInt(document.queryCommandValue('fontSize'), 10) || 3; } catch (e) {}
  const next = Math.max(1, Math.min(7, cur + d));
  try { document.execCommand('fontSize', false, String(next)); } catch (e) {}
  const lbl = document.getElementById('wrSizeLbl'); if (lbl) lbl.textContent = String(next);
}
function wrPalette(kind) {
  const pal = document.getElementById('wrPalette');
  if (pal.dataset.kind === kind && pal.classList.contains('open')) { pal.classList.remove('open'); return; }
  pal.dataset.kind = kind;
  const cols = ['#000000', '#d9443a', '#2e9e5b', '#2f7fd1', '#8e5bd4', '#d4a017', '#d6568f', '#ffe066', '#b8f2c9', '#bfe0ff'];
  pal.innerHTML = cols.map(c => `<button class="wr-color-dot" style="background:${c}" onmousedown="event.preventDefault()" onclick="wrApplyColor('${kind}','${c}')"></button>`).join('')
    + `<button type="button" class="wr-color-dot wr-color-custom" title="لون مخصّص" onmousedown="event.preventDefault()" onclick="wrCustomColor('${kind}')"><i class="ti ti-palette"></i></button>`;
  pal.classList.add('open');
}
let _wrSavedRange = null;
function wrCustomColor(kind) {
  try { const sel = window.getSelection(); _wrSavedRange = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null; } catch (e) { _wrSavedRange = null; }
  RSUI.pickColor({ title: kind === 'hiliteColor' ? 'لون التمييز' : 'لون النص', value: kind === 'hiliteColor' ? '#ffe066' : '#d9443a',
    onApply: (c) => {
      const el = writingEditorEl(); if (el) el.focus();
      try { if (_wrSavedRange) { const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(_wrSavedRange); } } catch (e) {}
      wrApplyColor(kind, c);
    } });
}
function wrApplyColor(kind, c) { wrCmd(kind, c); document.getElementById('wrPalette').classList.remove('open'); }

function setWritingPanelTab(t) { wrPanelTab = t; renderWritingFavPanel(); }
function toggleWritingFavPanel() {
  const panel = document.getElementById('writingFavPanel');
  if (panel.classList.contains('open')) { panel.classList.remove('open'); return; }
  renderWritingFavPanel();
  panel.classList.add('open');
}
function renderWritingFavPanel() {
  const panel = document.getElementById('writingFavPanel');
  const favItems = [];
  favorites.forEach((f, i) => { if (f.masalaNum) favItems.push({ f, i }); });
  favItems.reverse();
  const noteItems = notes.map((n, i) => ({ n, i })).reverse();
  const tabsHtml = `<div class="wfp-tabs">
    <button class="${wrPanelTab === 'fav' ? 'on' : ''}" onclick="setWritingPanelTab('fav')"><i class="ti ti-star"></i> المفضلة <span>${favItems.length}</span></button>
    <button class="${wrPanelTab === 'note' ? 'on' : ''}" onclick="setWritingPanelTab('note')"><i class="ti ti-pencil"></i> التعليقات <span>${noteItems.length}</span></button>
  </div>`;
  let body = '';
  if (wrPanelTab === 'fav') {
    body = favItems.length ? favItems.map(({ f, i }) => {
      const hex = starColorValue(f.color);
      return `<div class="writing-fav-item" style="border-right:4px solid ${hex}" onclick="insertFavoriteIntoWriting(${i})">
        <div class="wf-title">${escapeHtml(f.title)}</div>
        <div class="wf-sub">${f.kind ? escapeHtml(f.extSub || f.bookName) : `مسألة ${escapeHtml(f.masalaNum)} — ${escapeHtml(f.bookName)}`}</div>
      </div>`;
    }).join('') : `<div class="cmp-empty" style="padding:16px;">لا توجد مسائل في المفضلة بعد.</div>`;
  } else {
    body = noteItems.length ? noteItems.map(({ n, i }) => `
      <div class="writing-fav-item" onclick="insertNoteIntoWriting(${i})">
        <div class="wf-title">${escapeHtml(n.title)}</div>
        <div class="wf-sub">${n.kind ? escapeHtml(n.extSub || n.bookName) : `مسألة ${escapeHtml(n.masalaNum)} — ${escapeHtml(n.bookName)}`}</div>
        ${n.text ? `<div class="wf-note">${escapeHtml(n.text)}</div>` : ''}
      </div>`).join('') : `<div class="cmp-empty" style="padding:16px;">لا توجد تعليقات بعد.</div>`;
  }
  panel.innerHTML = tabsHtml + `<div class="wfp-list">${body}</div>`;
}

function insertTextAtCursor(text) { insertWritingHtml(escapeHtml(text).replace(/\n/g, '<br>')); }
function insertWritingHtml(html) {
  const el = writingEditorEl();
  if (!el) return;
  el.focus();
  const sel = window.getSelection();
  if (!sel.rangeCount || !el.contains(sel.anchorNode)) {
    const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); sel.removeAllRanges(); sel.addRange(r);
  }
  try { document.execCommand('insertHTML', false, html); } catch (e) { el.insertAdjacentHTML('beforeend', html); }
  document.getElementById('writingFavPanel').classList.remove('open');
}
function masalaBlockHtml(bookId, masalaNum, text, noteText) {
  const book = allBooks.find(b => b.id === bookId);
  const bookName = book ? book.name : '';
  const marja = book ? (allAuthors[book.author_id] || '') : '';
  const head = ['مسألة ' + masalaNum, bookName, marja].filter(Boolean).join(' — ');
  return `<div class="wr-masala" contenteditable="false"><div class="wr-masala-head">${escapeHtml(head)}</div>`
    + `<div class="wr-masala-body">${escapeHtml(text || '').replace(/\n/g, '<br>')}</div>`
    + (noteText ? `<div class="wr-masala-note">تعليقي: ${escapeHtml(noteText).replace(/\n/g, '<br>')}</div>` : '')
    + `</div><div><br></div>`;
}

function insertFavoriteIntoWriting(i) {
  const f = favorites[i];
  if (!f || !f.masalaNum) return;
  if (f.kind) { insertWritingHtml(extBlockHtml(f.extSub || f.bookName, f.extText || f.snippet || '', '')); return; }
  insertWritingHtml(masalaBlockHtml(f.bookId, f.masalaNum, getMasalaTextFromBook(f.bookId, f.masalaNum) || f.snippet || '', ''));
}

function insertNoteIntoWriting(i) {
  const n = notes[i];
  if (!n) return;
  if (n.kind) { insertWritingHtml(extBlockHtml(n.extSub || n.bookName, n.extText || '', n.text || '')); return; }
  insertWritingHtml(masalaBlockHtml(n.bookId, n.masalaNum, getMasalaTextFromBook(n.bookId, n.masalaNum) || '', n.text || ''));
}

function saveCurrentWriting() {
  const text = getWritingText();
  const html = sanitizeWritingHtml(writingEditorEl().innerHTML);
  const title = (document.getElementById('writingTitleInput').value || '').trim();
  const color = writingDraftColor || WRITING_COLORS[0];
  if (currentWritingId) {
    const w = freeWritings.find(x => x.id === currentWritingId);
    if (w) { w.text = text; w.html = html; w.title = title; w.color = color; w.updatedAt = Date.now(); }
  } else {
    const id = 'w' + Date.now();
    freeWritings.push({ id, text, html, title, color, updatedAt: Date.now() });
    currentWritingId = id;
  }
  saveWritingsStorage();
  ensureLibraryOrder(); saveLibraryOrder();
  renderWritingPage();
}

function copyCurrentWriting() {
  const text = getWritingText();
  if (rsShareNext) { rsShareNext = false; rsShareText(text); return; }
  showGenericToast('تم النسخ');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text);
  } else {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
  }
}

function shareCurrentWriting() {
  const text = getWritingText();
  if (navigator.share) {
    navigator.share({ text }).catch(() => {});
  } else {
    copyCurrentWriting();
  }
}

function deleteCurrentWriting() {
  if (!currentWritingId) return;
  const id = currentWritingId;
  openConfirmDialog('حذف هذه الكتابة نهائياً؟', () => {
    freeWritings = freeWritings.filter(w => w.id !== id);
    saveWritingsStorage();
    ensureLibraryOrder(); saveLibraryOrder();
    renderWritingPage();
  });
}
function renderComparisonPage() { renderComparisonHomePage(); }

function onCmpTopicChange() {
  const idx = document.getElementById('cmpTopicSelect').value;
  const checksDiv = document.getElementById('cmpAuthorChecks');
  const resultDiv = document.getElementById('cmpResultTable');
  resultDiv.innerHTML = '';
  if (idx === '') { checksDiv.innerHTML = ''; return; }
  const group = masalaComparisons[parseInt(idx, 10)];
  let html = '';
  group.entries.forEach((entry, i) => {
    const book = allBooks.find(b => b.id === entry.bookId);
    if (!book) return;
    const authorName = allAuthors[book.author_id] || '';
    html += `<label><input type="checkbox" checked data-cmp-entry="${i}"> ${escapeHtml(authorName)}</label>`;
  });
  checksDiv.innerHTML = html;
  checksDiv.dataset.groupIdx = idx;
  renderCmpResultTable();
  checksDiv.querySelectorAll('input[type=checkbox]').forEach(c => c.addEventListener('change', renderCmpResultTable));
}

function renderCmpResultTable() {
  const checksDiv = document.getElementById('cmpAuthorChecks');
  const resultDiv = document.getElementById('cmpResultTable');
  const groupIdx = checksDiv.dataset.groupIdx;
  if (groupIdx === undefined) return;
  const group = masalaComparisons[parseInt(groupIdx, 10)];
  let html = '';
  group.entries.forEach((entry, i) => {
    const checkbox = checksDiv.querySelector(`input[data-cmp-entry="${i}"]`);
    if (!checkbox || !checkbox.checked) return;
    const book = allBooks.find(b => b.id === entry.bookId);
    if (!book) return;
    const authorName = allAuthors[book.author_id] || '';
    const text = getMasalaTextFromBook(entry.bookId, entry.masalaNum);
    html += `<div class="cmp-card">
      <div class="cmp-author">${escapeHtml(authorName)} — ${escapeHtml(book.name)}</div>
      <div class="cmp-text">${text ? escapeHtml(text) : 'تعذّر إيجاد نص المسألة'}</div>
      <span class="cmp-goto" onclick="goToMasalaFromAccordion(${entry.bookId}, '${entry.masalaNum}')">عرض المسألة كاملة ‹</span>
    </div>`;
  });
  resultDiv.innerHTML = html || '<div class="cmp-empty">اختر مرجعاً واحداً على الأقل</div>';
}

function getCmpSearchScholarFilter() {
  const sel = document.getElementById('cmpSearchScholarSelect');
  if (!sel || !sel.value) return null;
  return parseInt(sel.value, 10);
}

function populateCmpSearchScholarSelect() {
  const sel = document.getElementById('cmpSearchScholarSelect');
  if (!sel || sel.dataset.built) return;
  const scholars = cmpOrderedScholars();
  let html = '<option value="">كل المراجع (بحث عام)</option>';
  scholars.forEach(s => { html += `<option value="${s.id}">${escapeHtml(s.name)}</option>`; });
  sel.innerHTML = html;
  sel.dataset.built = '1';
}

function searchCmpData(normTerm, queryWords, precision, scholarFilter, scope) {
  const { subjectsById, chapters, answersBySubject, scholarById } = loadCmpData();
  const results = [];
  const seenSubjects = new Set();
  const chapterById = new Map(chapters.map(c => [c.id, c]));
  const titlesOnly = scope === 'titles';
  const bodyOnly = scope === 'body';

  for (const [subjectId, answers] of answersBySubject) {
    const subject = subjectsById.get(subjectId);
    if (!subject) continue;
    const _hid = getCmpScholarSettings().hidden;
    const relevantAnswers = (scholarFilter ? answers.filter(a => scholarFilter.has(a.scholar_id)) : answers).filter(a => !_hid[a.scholar_id]);
    if (!relevantAnswers.length) continue;

    const normQuestion = normalizeArabic(subject.question || '');
    const normSubjectName = normalizeArabic(subject.name || '');
    let matchedAnswerText = '';
    let matchedScholarId = null;
    let isMatch = false;

    for (const ans of relevantAnswers) {
      const normAnswer = normalizeArabic(ans.answer_text || '');
      const haystack = titlesOnly ? normSubjectName
        : bodyOnly ? (normQuestion + '\n' + normAnswer)
        : (normSubjectName + '\n' + normQuestion + '\n' + normAnswer);
      const m = precision === 'exact'
        ? exactPhraseTest(haystack, normTerm)
        : queryWords.every(w => haystack.includes(w));
      if (m) { isMatch = true; matchedAnswerText = ans.answer_text; matchedScholarId = ans.scholar_id; break; }
    }
    if (!isMatch) continue;
    if (seenSubjects.has(subjectId)) continue;
    seenSubjects.add(subjectId);

    const chapter = chapterById.get(subject.chapter_id);
    const showScholar = (scholarFilter && scholarFilter.size === 1) ? [...scholarFilter][0] : matchedScholarId;
    const scholarLabel = scholarFilter && showScholar && scholarById.get(showScholar)
      ? ` — رأي ${scholarById.get(showScholar).name}` : '';
    const _fav = getCmpScholarSettings().favorite;
    const favNames = answers.filter(a => _fav[a.scholar_id] && !_hid[a.scholar_id]).map(a => (scholarById.get(a.scholar_id) || {}).name).filter(Boolean);
    results.push({
      cmpFavNames: favNames,
      cmpSubjectId: subjectId,
      cmpScholarId: matchedScholarId,
      bookName: `جامع الاستفتاءات${chapter ? ' — ' + chapter.name : ''}${scholarLabel}`,
      title: subject.name,
      body: matchedAnswerText || subject.question,
      isCmp: true,
    });
  }
  return results;
}

const CMP_SCHOLAR_SETTINGS_KEY = 'cmp_scholar_settings_v1';
function getCmpScholarSettings() {
  try {
    const raw = localStorage.getItem(CMP_SCHOLAR_SETTINGS_KEY);
    const s = raw ? JSON.parse(raw) : {};
    return { order: s.order || [], hidden: s.hidden || {}, favorite: s.favorite || {} };
  } catch (e) { return { order: [], hidden: {}, favorite: {} }; }
}

function saveCmpScholarSettings(s) {
  try { localStorage.setItem(CMP_SCHOLAR_SETTINGS_KEY, JSON.stringify(s)); } catch (e) {}
}


let cmpDataCache = null;

function loadCmpData() {
  if (cmpDataCache) return cmpDataCache;
  const chapters = dbAll(`SELECT id, name, chapter_order FROM cmp_chapters WHERE archived=0 ORDER BY id`);
  const subjects = dbAll(`SELECT id, chapter_id, name, question, question_extra_info, subject_order FROM cmp_subjects WHERE archived=0 ORDER BY chapter_id, subject_order, id`);
  const answers = dbAll(`SELECT id, subject_id, scholar_id, answer_text, answer_extra_info FROM cmp_answers WHERE archived=0`);
  const scholars = dbAll(`SELECT id, name, scholar_order FROM cmp_scholars WHERE archived=0 ORDER BY scholar_order`);
  (function () {
    const kw = [['سيستاني', 1], ['خوئي', 11], ['فياض', 4], ['خامنئي', 3], ['صادق', 7], ['خميني', 13], ['خراساني', 12], ['وحيد', 12], ['حائري', 8], ['نجفي', 15], ['بشير', 15], ['محمد الشيرازي', 16], ['محمد الحسيني', 16], ['تبريزي', 17], ['حكيم', 20], ['زنجاني', 23], ['عصفور', 26], ['سبحاني', 27], ['خاقاني', 24], ['مكارم', 19], ['ناصر', 19]];
    const rank = (sc) => {
      let aid = CMP_SCHOLAR_AUTHOR[sc.id];
      if (!aid) { const nm = String(sc.name || ''); const hit = kw.find(k => nm.indexOf(k[0]) >= 0); aid = hit ? hit[1] : 0; }
      const i = DEFAULT_AUTHOR_ORDER.indexOf(aid);
      return i < 0 ? 1000 : i;
    };
    const base = new Map(scholars.map((x, i) => [x.id, i]));
    scholars.sort((a, b) => (rank(a) - rank(b)) || (base.get(a.id) - base.get(b.id)));
    scholars.forEach((x, i) => { x.scholar_order = i + 1; });
  })();

  const answersBySubject = new Map();
  answers.forEach(a => {
    if (!answersBySubject.has(a.subject_id)) answersBySubject.set(a.subject_id, []);
    answersBySubject.get(a.subject_id).push(a);
  });
  const subjectsByChapter = new Map();
  const subjectsWithAnswers = subjects.filter(s => (answersBySubject.get(s.id) || []).length > 0);
  subjectsWithAnswers.forEach(s => {
    if (!subjectsByChapter.has(s.chapter_id)) subjectsByChapter.set(s.chapter_id, []);
    subjectsByChapter.get(s.chapter_id).push(s);
  });
  const chaptersWithSubjects = chapters.filter(c => (subjectsByChapter.get(c.id) || []).length > 0);
  const scholarById = new Map(scholars.map(s => [s.id, s]));

  const flatSubjectIds = [];
  chaptersWithSubjects.forEach(c => {
    subjectsByChapter.get(c.id).forEach(s => flatSubjectIds.push(s.id));
  });

  cmpDataCache = {
    chapters: chaptersWithSubjects,
    subjectsByChapter,
    subjectsById: new Map(subjects.map(s => [s.id, s])),
    answersBySubject,
    scholars,
    scholarById,
    flatSubjectIds,
  };
  return cmpDataCache;
}


function cmpOrderedScholars() {
  const { scholars } = loadCmpData();
  const settings = getCmpScholarSettings();
  let list = scholars.slice();
  if (settings.order && settings.order.length) {
    const orderIndex = new Map(settings.order.map((id, i) => [id, i]));
    list.sort((a, b) => {
      const ia = orderIndex.has(a.id) ? orderIndex.get(a.id) : 999;
      const ib = orderIndex.has(b.id) ? orderIndex.get(b.id) : 999;
      return ia - ib;
    });
  }
  list.sort((a, b) => {
    const fa = settings.favorite[a.id] ? 0 : 1;
    const fb = settings.favorite[b.id] ? 0 : 1;
    return fa - fb;
  });
  return list;
}

function openCmpScholarSettingsPanel() {
  renderCmpScholarSettingsList();
  document.getElementById('cmpScholarSettingsOverlay').classList.add('show');
}

function closeCmpScholarSettingsPanel() {
  document.getElementById('cmpScholarSettingsOverlay').classList.remove('show');
  if (cmpNav.subjectId !== null) renderCmpComparisonView(cmpNav.subjectId);
}

function renderCmpScholarSettingsList() {
  const scholars = loadCmpData().scholars;
  const settings = getCmpScholarSettings();
  const displayOrder = cmpOrderedScholars();
  let html = `<p class="jurist-help">رتّب أولوية ظهور المراجع في صفحة الجامع، أو أخفِ من لا تريد ظهوره، أو ميّز من تريد تمييزه.</p>`;
  displayOrder.forEach((sch, i) => {
    const hidden = !!settings.hidden[sch.id];
    const fav = !!settings.favorite[sch.id];
    html += `<div class="jurist-row ${hidden ? 'jurist-hidden' : ''} ${fav ? 'jurist-fav' : ''}" data-key="${sch.id}">
      <span class="jurist-grip" title="اسحب لتغيير الترتيب"><i class="ti ti-grip-vertical"></i></span>
      <span class="jurist-name">${escapeHtml(sch.name)}</span>
      <button class="jurist-fav-btn ${fav ? 'active' : ''}" title="مميّز" onclick="toggleCmpScholarFavorite(${sch.id})"><i class="ti ti-star"></i></button>
      <button class="jurist-hide-btn ${hidden ? 'active' : ''}" title="إخفاء" onclick="toggleCmpScholarHidden(${sch.id})"><i class="ti ti-${hidden ? 'eye-off' : 'eye'}"></i></button>
    </div>`;
  });
  document.getElementById('cmpScholarSettingsList').innerHTML = html || '<div class="empty-state">لا يوجد مراجع</div>';
  enableJuristDragReorder(document.getElementById('cmpScholarSettingsList'), keys => {
    const st = getCmpScholarSettings(); st.order = keys.map(k => Number(k)); saveCmpScholarSettings(st); renderCmpScholarSettingsList();
  });
}

function moveCmpScholar(idx, dir) {
  const displayOrder = cmpOrderedScholars();
  const settings = getCmpScholarSettings();
  const target = idx + dir;
  if (target < 0 || target >= displayOrder.length) return;
  settings.order = displayOrder.map(s => s.id);
  const tmp = settings.order[idx];
  settings.order[idx] = settings.order[target];
  settings.order[target] = tmp;
  saveCmpScholarSettings(settings);
  renderCmpScholarSettingsList();
}

function toggleCmpScholarHidden(id) {
  const settings = getCmpScholarSettings();
  if (settings.hidden[id]) delete settings.hidden[id]; else settings.hidden[id] = true;
  saveCmpScholarSettings(settings);
  renderCmpScholarSettingsList();
}

function toggleCmpScholarFavorite(id) {
  const settings = getCmpScholarSettings();
  if (settings.favorite[id]) delete settings.favorite[id]; else settings.favorite[id] = true;
  saveCmpScholarSettings(settings);
  renderCmpScholarSettingsList();
}


let cmpNav = { level: 'chapters', chapterId: null, subjectId: null };

const CMP_MEMORY_KEY = 'cmp_position_memory_v1';
function cmpMemorySave(scrollTop) {
  try {
    const prev = cmpMemoryLoad() || {};
    const rec = { level: cmpNav.level, chapterId: cmpNav.chapterId, subjectId: cmpNav.subjectId,
      scroll: (typeof scrollTop === 'number') ? scrollTop : 0 };
    if (typeof scrollTop !== 'number' && prev.level === rec.level && prev.chapterId === rec.chapterId && prev.subjectId === rec.subjectId) rec.scroll = prev.scroll || 0;
    localStorage.setItem(CMP_MEMORY_KEY, JSON.stringify(rec));
  } catch (e) {}
}
function cmpMemoryLoad() { try { return JSON.parse(localStorage.getItem(CMP_MEMORY_KEY) || 'null'); } catch (e) { return null; } }
function cmpMemoryRestore() {
  const m = cmpMemoryLoad();
  if (!m) { renderComparisonHomePage(); return; }
  try {
    if (m.level === 'compare' && m.subjectId != null) renderCmpComparisonView(m.subjectId);
    else if (m.level === 'subjects' && m.chapterId != null) openCmpChapter(m.chapterId);
    else { renderComparisonHomePage(); return; }
  } catch (e) { renderComparisonHomePage(); return; }
  const y = m.scroll || 0;
  requestAnimationFrame(() => requestAnimationFrame(() => { document.getElementById('content').scrollTop = y; }));
}
(function () {
  let t = null;
  document.addEventListener('DOMContentLoaded', () => {
    const c = document.getElementById('content');
    if (!c) return;
    c.addEventListener('scroll', () => {
      const p = document.getElementById('comparisonPage');
      if (!p || !p.classList.contains('active')) return;
      clearTimeout(t);
      t = setTimeout(() => cmpMemorySave(c.scrollTop), 250);
    }, { passive: true });
  });
})();


function cmpViewMode() { try { return localStorage.getItem('cmpViewMode') || 'grid'; } catch (e) { return 'grid'; } }
function setCmpViewMode(m, inChapter) {
  try { localStorage.setItem('cmpViewMode', m); } catch (e) {}
  if (inChapter && cmpNav.chapterId !== null) openCmpChapter(cmpNav.chapterId); else renderCmpChaptersList();
}
function cmpToggleHtml(inChapter, leftHtml) {
  const m = cmpViewMode();
  return `<div class="cmp-toolbar">${leftHtml || '<span></span>'}<div class="cmp-view-toggle"><button class="${m === 'grid' ? 'on' : ''}" aria-label="شبكة" onclick="setCmpViewMode('grid', ${!!inChapter})"><i class="ti ti-layout-grid"></i></button><button class="${m === 'list' ? 'on' : ''}" aria-label="قائمة" onclick="setCmpViewMode('list', ${!!inChapter})"><i class="ti ti-list"></i></button></div></div>`;
}
function cmpTileHtml(onclick, name, sub) {
  return `<div class="cmp-card" onclick="${onclick}"><div class="cmp-card-name">${escapeHtml(name)}</div>${sub ? `<div class="cmp-card-sub">${escapeHtml(sub)}</div>` : '<div></div>'}</div>`;
}
const JAMI_APP_URL = 'https://play.google.com/store/apps/details?id=com.mo7ib.jami3.android';
function renderComparisonHomePage() {
  cmpNav = { level: 'chapters', chapterId: null, subjectId: null };
  renderCmpChaptersList();
}

function cmpSubjectVisible(subjectId) {
  const { answersBySubject } = loadCmpData();
  const hid = getCmpScholarSettings().hidden;
  return (answersBySubject.get(subjectId) || []).some(a => !hid[a.scholar_id]);
}
function cmpVisibleSubjects(list) { return (list || []).filter(sj => cmpSubjectVisible(sj.id)); }
function cmpVisibleFlatIds() { return loadCmpData().flatSubjectIds.filter(cmpSubjectVisible); }

function renderCmpChaptersList() {
  cmpNav.level = 'chapters';
  cmpNav.chapterId = null;
  cmpNav.subjectId = null;
  const container = document.getElementById('comparisonPage');
  const { chapters, subjectsByChapter } = loadCmpData();
  const grid = cmpViewMode() === 'grid';
  const settingsBtn = `<button class="cmp-settings-btn" onclick="openCmpScholarSettingsPanel()"><i class="ti ti-adjustments"></i> ترتيب المراجع</button>`;
  let html = `    ${cmpToggleHtml(false, settingsBtn)}
    <div class="${grid ? 'cmp-grid' : 'cmp-chapter-list'}">`;
  chapters.forEach(c => {
    const visCount = cmpVisibleSubjects(subjectsByChapter.get(c.id)).length;
    if (!visCount) return;
    const count = normalizeDigits(String(visCount));
    html += grid ? cmpTileHtml(`openCmpChapter(${c.id})`, c.name, count + ' مسألة')
      : `<div class="list-row" onclick="openCmpChapter(${c.id})">
      <div class="label">${escapeHtml(c.name)}<div class="sub">${count} مسألة</div></div>
      <i class="ti ti-chevron-left"></i>
    </div>`;
  });
  html += `</div><div class="cmp-src-quiet"><a href="${JAMI_APP_URL}" target="_blank" rel="noopener">الاطلاع على التطبيق الأصلي</a></div>`;
  container.innerHTML = html;
  switchPage('comparisonPage', 'جامع الاستفتاءات');
  registerView(() => cmpMemoryRestore());
  cmpMemorySave(0);
}

function openCmpChapter(chapterId) {
  cmpNav.level = 'subjects';
  cmpNav.chapterId = chapterId;
  cmpNav.subjectId = null;
  const container = document.getElementById('comparisonPage');
  const { chapters, subjectsByChapter } = loadCmpData();
  const chapter = chapters.find(c => c.id === chapterId);
  const subjects = cmpVisibleSubjects(subjectsByChapter.get(chapterId));
  const gridS = cmpViewMode() === 'grid';
  const _cd = loadCmpData(), _st = getCmpScholarSettings();
  const favNamesOf = (sid) => (_cd.answersBySubject.get(sid) || [])
    .filter(a => _st.favorite[a.scholar_id] && !_st.hidden[a.scholar_id])
    .map(a => (_cd.scholarById.get(a.scholar_id) || {}).name).filter(Boolean);
  const back = `<div class="cmp-back-row" style="margin:0" onclick="renderCmpChaptersList()"><i class="ti ti-chevron-right"></i> كل الأبواب</div>`;
  let html = `<h2>${escapeHtml(chapter ? chapter.name : '')}</h2>
    ${cmpToggleHtml(true, back)}
    <div class="${gridS ? 'cmp-grid' : 'cmp-subject-list'}">`;
  subjects.forEach(s => {
    const fv = favNamesOf(s.id);
    const fvTxt = fv.length ? 'رأي ' + fv.slice(0, 2).join('، ') : '';
    html += gridS ? cmpTileHtml(`openCmpSubject(${s.id})`, s.name, fvTxt ? '★ ' + fvTxt : '')
      : `<div class="list-row" onclick="openCmpSubject(${s.id})">
      <div class="label">${escapeHtml(s.name)}${fvTxt ? `<div class="sub"><span class="cmp-fav-mark"><i class="ti ti-star-filled"></i> ${escapeHtml(fvTxt)}</span></div>` : ''}</div>
      <i class="ti ti-chevron-left"></i>
    </div>`;
  });
  html += `</div><div class="cmp-src-quiet"><a href="${JAMI_APP_URL}" target="_blank" rel="noopener">الاطلاع على التطبيق الأصلي</a></div>`;
  container.innerHTML = html;
  switchPage('comparisonPage', 'جامع الاستفتاءات');
  registerView(() => cmpMemoryRestore());
  cmpMemorySave(0);
}

function openCmpSubject(subjectId) {
  renderCmpComparisonView(subjectId);
}


function navCmpSubject(direction) {
  const flatSubjectIds = cmpVisibleFlatIds();
  if (cmpNav.subjectId === null) return;
  const idx = flatSubjectIds.indexOf(cmpNav.subjectId);
  if (idx === -1) return;
  const nextIdx = idx + direction;
  if (nextIdx < 0 || nextIdx >= flatSubjectIds.length) return;
  renderCmpComparisonView(flatSubjectIds[nextIdx]);
}

function renderCmpComparisonView(subjectId) {
  cmpNav.level = 'compare';
  cmpNav.subjectId = subjectId;
  const { subjectsById, chapters, answersBySubject, scholarById } = loadCmpData();
  let flatSubjectIds = cmpVisibleFlatIds();
  if (!flatSubjectIds.includes(subjectId)) flatSubjectIds = flatSubjectIds.concat([subjectId]);
  const subject = subjectsById.get(subjectId);
  if (!subject) return;
  cmpNav.chapterId = subject.chapter_id;
  const chapter = chapters.find(c => c.id === subject.chapter_id);
  const answers = answersBySubject.get(subjectId) || [];
  const settings = getCmpScholarSettings();
  const orderedScholars = cmpOrderedScholars();

  const idx = flatSubjectIds.indexOf(subjectId);
  const hasPrev = idx > 0;
  const hasNext = idx !== -1 && idx < flatSubjectIds.length - 1;

  let cardsHtml = '';
  orderedScholars.forEach(sch => {
    if (settings.hidden[sch.id]) return;
    const ans = answers.find(a => a.scholar_id === sch.id);
    if (!ans) return;
    const fav = !!settings.favorite[sch.id];
    const _ek = extKeyOf('c', subjectId, sch.id);
    const _ef = extFindFav('c', _ek);
    cardsHtml += `<div class="cmp-answer-card ${fav ? 'cmp-fav-card' : ''} ${_ef ? 'ext-fav' : ''}" data-sch="${sch.id}" data-ext-key="${_ek}"${_ef ? ` style="--ext-col:${starColorValue(_ef.color)}"` : ''}>
      <div class="cmp-answer-head">
        <div class="cmp-answer-scholar">${fav ? '<i class="ti ti-star"></i> ' : ''}${escapeHtml(sch.name)}</div>
        ${extToolsHtml('c', subjectId, sch.id, 'cmp-card-tools')}
      </div>
      <div class="cmp-answer-text">${escapeHtml(ans.answer_text)}</div>
      ${ans.answer_extra_info ? `<div class="cmp-answer-source">${escapeHtml(ans.answer_extra_info)}</div>` : ''}
      ${extNoteAreaHtml('c', subjectId, sch.id)}
    </div>`;
  });
  if (!cardsHtml) {
    cardsHtml = `<div class="cmp-empty">لا توجد إجابات ظاهرة (تحقّق من إعدادات إخفاء المراجع)</div>`;
  }

  const _qk = extKeyOf('q', subjectId, 0);
  const _qf = extFindFav('q', _qk);
  const container = document.getElementById('comparisonPage');
  container.innerHTML = `
    <div class="cmp-sticky">
      <div class="cmp-back-row" onclick="openCmpChapter(${subject.chapter_id})"><i class="ti ti-chevron-right"></i> ${escapeHtml(chapter ? chapter.name : 'الباب')}</div>
      <div class="cmp-nav-arrows">
        <button onclick="navCmpSubject(1)" ${hasNext ? '' : 'disabled'}><i class="ti ti-chevron-right"></i></button>
        <span class="cmp-nav-position"><span class="cmp-nav-name">${escapeHtml(subject.name)}</span> ${idx + 1} / ${flatSubjectIds.length}</span>
        <button onclick="navCmpSubject(-1)" ${hasPrev ? '' : 'disabled'}><i class="ti ti-chevron-left"></i></button>
      </div>
      <div class="cmp-question-box ${_qf ? 'ext-fav' : ''}" data-ext-key="${_qk}"${_qf ? ` style="--ext-col:${starColorValue(_qf.color)}"` : ''}>
        <div class="cmp-question-head">
          <div class="cmp-question-label">السؤال</div>
          ${extToolsHtml('q', subjectId, 0, 'cmp-card-tools')}
        </div>
        <div class="cmp-question-text">${escapeHtml(subject.question)}</div>
        ${subject.question_extra_info ? `<div class="cmp-question-extra">${escapeHtml(subject.question_extra_info)}</div>` : ''}
      </div>
    </div>
    ${extNoteAreaHtml('q', subjectId, 0)}
    <button class="cmp-settings-btn" onclick="openCmpScholarSettingsPanel()"><i class="ti ti-adjustments"></i> ترتيب المراجع وإخفاء/تمييز</button>
    <div class="cmp-answers-list">${cardsHtml}</div>
  `;
  switchPage('comparisonPage', 'جامع الاستفتاءات');
  registerView(() => cmpMemoryRestore());
  document.getElementById('content').scrollTop = 0;
  cmpMemorySave(0);
}



function dbAll(sql, params) {
  try {
    const res = params ? db.exec(sql, params) : db.exec(sql);
    if (!res.length) return [];
    const { columns, values } = res[0];
    return values.map(row => {
      const obj = {};
      columns.forEach((col, i) => { obj[col] = row[i]; });
      return obj;
    });
  } catch (e) { console.warn('dbAll error:', e, sql); return []; }
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showGenericToast(message) {
  const toast = document.getElementById('genericToast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toast._hideTimeout);
  toast._hideTimeout = setTimeout(() => toast.classList.remove('show'), 2000);
}


let splitViewActive = false;
let splitLongPressTimer = null;
let splitLongPressStartXY = null;

let splitLongPressFired = false;
function setupSplitViewLongPress() {
  const fab = document.getElementById('readerFabPosition');
  if (!fab) return;
  const indicator = document.getElementById('splitLongPressIndicator');
  const start = (clientX, clientY) => {
    if (!document.getElementById('readerPage').classList.contains('active')) return;
    splitLongPressStartXY = { x: clientX, y: clientY };
    indicator.style.left = clientX + 'px';
    indicator.style.top = clientY + 'px';
    indicator.classList.add('active');
    splitLongPressTimer = setTimeout(() => {
      indicator.classList.remove('active');
      if (navigator.vibrate) { try { navigator.vibrate(20); } catch (err) {} }
      splitLongPressFired = true;
      enterSplitView();
    }, 550);
  };
  fab.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    splitLongPressFired = false;
    start(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  const cancelLongPress = (e) => {
    if (splitLongPressStartXY && e.touches && e.touches[0]) {
      const dx = Math.abs(e.touches[0].clientX - splitLongPressStartXY.x);
      const dy = Math.abs(e.touches[0].clientY - splitLongPressStartXY.y);
      if (dx < 10 && dy < 10) return;
    }
    clearTimeout(splitLongPressTimer);
    indicator.classList.remove('active');
  };
  fab.addEventListener('touchmove', cancelLongPress, { passive: true });
  fab.addEventListener('touchend', cancelLongPress, { passive: true });
  fab.addEventListener('touchcancel', cancelLongPress, { passive: true });
  fab.addEventListener('click', (e) => {
    if (splitLongPressFired) { e.stopPropagation(); e.preventDefault(); splitLongPressFired = false; }
  }, true);
}

function enterSplitView() {
  if (splitViewActive) return;
  if (!currentBookId || isThamraBook(currentBookId)) {
    showGenericToast('افتح كتاباً عادياً أولاً لتقسيم الشاشة');
    return;
  }
  splitViewActive = true;
  const frame1 = document.getElementById('splitFrame1');
  const url = `${location.pathname}?embedded=1&bookId=${currentBookId}&sectionIdx=${currentSectionIndex}&scrollTop=${Math.round(document.getElementById('content').scrollTop)}`;
  frame1.src = url;
  const frame2 = document.getElementById('splitFrame2');
  frame2.style.display = 'block';
  frame2.src = `${location.pathname}?embedded=1`;
  document.getElementById('splitPane1').style.flexBasis = '50%';
  document.getElementById('splitPane2').style.flexBasis = '50%';
  document.getElementById('splitViewShell').classList.add('show');
  document.body.classList.add('split-active');
}

function exitSplitView() {
  splitViewActive = false;
  document.getElementById('splitViewShell').classList.remove('show');
  document.getElementById('splitFrame1').src = '';
  document.getElementById('splitFrame2').src = '';
  document.body.classList.remove('split-active');
}

function toggleSplitOrientation() {
  document.getElementById('splitViewShell').classList.toggle('orientation-vertical');
}

function setupSplitPaneMessaging() {
  const bookId = parseInt(urlParams.get('bookId'), 10);
  const sectionIdx = parseInt(urlParams.get('sectionIdx'), 10) || 0;
  const scrollTop = parseInt(urlParams.get('scrollTop'), 10) || 0;
  if (!bookId || !allBooks.find(b => b.id === bookId)) { renderReferencesPage(); return; }
  const book = allBooks.find(b => b.id === bookId);
  currentAuthorId = allAuthors[book.author_id] ? book.author_id : GLOSSARY_AUTHOR_ID;
  loadBookSections(bookId, book);
  const startIdx = Math.max(0, Math.min(sectionIdx, currentSections.length - 1));
  renderContinuousReader(bookId, startIdx, { scrollTop });
}

(function setupSplitDividerDrag() {
  document.addEventListener('DOMContentLoaded', () => {
    const divider = document.getElementById('splitDivider');
    if (!divider) return;
    const shell = document.getElementById('splitViewShell');
    const pane1 = document.getElementById('splitPane1');
    const pane2 = document.getElementById('splitPane2');
    let dragging = false;

    function onMove(clientX, clientY) {
      const rect = shell.getBoundingClientRect();
      const vertical = shell.classList.contains('orientation-vertical');
      let ratio;
      if (vertical) {
        ratio = (clientY - rect.top) / rect.height;
      } else {
        ratio = 1 - ((clientX - rect.left) / rect.width);
      }
      ratio = Math.max(0.2, Math.min(0.8, ratio));
      pane1.style.flexBasis = (ratio * 100) + '%';
      pane2.style.flexBasis = ((1 - ratio) * 100) + '%';
    }
    divider.addEventListener('touchstart', (e) => {
      if (e.target.closest('.split-ctl')) return;
      dragging = true; e.preventDefault();
    }, { passive: false });
    document.addEventListener('touchmove', (e) => {
      if (!dragging) return;
      const t = e.touches[0];
      onMove(t.clientX, t.clientY);
    }, { passive: true });
    document.addEventListener('touchend', () => { dragging = false; });
    divider.addEventListener('mousedown', (e) => { if (e.target.closest('.split-ctl')) return; dragging = true; e.preventDefault(); });
    document.addEventListener('mousemove', (e) => { if (dragging) onMove(e.clientX, e.clientY); });
    document.addEventListener('mouseup', () => { dragging = false; });
  });
})();

window.addEventListener('DOMContentLoaded', init);

const LOOK_KEY = 'rs_look_v68';
const LOOK_DEFAULTS = { accent: '', bgLight: '', bgDark: '', glow: true, glowK: 100, lh: 195, justify: true, auto: false };
const ACCENT_PRESETS = [
  { n: 'الافتراضي', c: '' }, { n: 'ذهبي', c: '#D9A441' }, { n: 'برتقالي', c: '#C0502A' }, { n: 'أخضر', c: '#2F8F5B' },
  { n: 'أزرق', c: '#2F6FB5' }, { n: 'بنفسجي', c: '#7A4FB8' }, { n: 'وردي', c: '#C2476B' }, { n: 'تركوازي', c: '#1F8A8A' }
];
const BG_PRESETS_LIGHT = [
  { n: 'الافتراضي', c: '' }, { n: 'أبيض', c: '#FFFFFF' }, { n: 'كريمي', c: '#FBF6EC' }, { n: 'ورقي', c: '#EFE5CC' },
  { n: 'أخضر هادئ', c: '#E6EFE3' }, { n: 'أزرق فاتح', c: '#E3ECF5' }, { n: 'رمادي', c: '#E9E9EC' }
];
const BG_PRESETS_DARK = [
  { n: 'الافتراضي', c: '' }, { n: 'أسود', c: '#000000' }, { n: 'رمادي داكن', c: '#161616' }, { n: 'أزرق ليلي', c: '#0E1520' },
  { n: 'أخضر داكن', c: '#0E1A14' }, { n: 'بني داكن', c: '#1A1410' }
];
function getLook() {
  let o = {};
  try { o = JSON.parse(localStorage.getItem(LOOK_KEY) || '{}') || {}; } catch (e) { o = {}; }
  return Object.assign({}, LOOK_DEFAULTS, o);
}
function _hex2rgb(h) { h = String(h).replace('#', ''); if (h.length === 3) h = h.split('').map(x => x + x).join(''); const n = parseInt(h, 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function _rgb2hex(a) { return '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''); }
function _mix(a, b, t) { const A = _hex2rgb(a), B = _hex2rgb(b); return _rgb2hex(A.map((v, i) => v + (B[i] - v) * t)); }
function _lum(h) { const [r, g, b] = _hex2rgb(h).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; }
function _rgba(h, a) { const [r, g, b] = _hex2rgb(h); return `rgba(${r},${g},${b},${a})`; }

function applyAppearancePrefs() {
  const L = getLook(), st = document.documentElement.style, dark = !!nightMode;
  const setv = (k, v) => { if (v === null || v === undefined || v === '') st.removeProperty(k); else st.setProperty(k, v); };
  if (L.accent) {
    const c = L.accent;
    setv('--accent', c);
    setv('--accent-l', _mix(c, '#ffffff', 0.25));
    setv('--accent-dark', dark ? c : _mix(c, '#000000', 0.22));
    setv('--accent-text', dark ? _mix(c, '#ffffff', 0.18) : _mix(c, '#000000', 0.22));
    setv('--accent-ink', _lum(c) > 0.5 ? '#231703' : '#FFFFFF');
    setv('--chip', _rgba(c, 0.15));
    setv('--accent-rgb', _hex2rgb(c).join(','));
  } else {
    ['--accent', '--accent-l', '--accent-dark', '--accent-text', '--accent-ink', '--chip', '--accent-rgb'].forEach(k => setv(k, null));
  }
  const base = L.accent || (dark ? '#D9A441' : '#C0502A');
  setv('--glow', L.glow ? _rgba(base, Math.min(0.9, (dark ? 0.18 : 0.14) * L.glowK / 100)) : 'transparent');
  const bg = dark ? L.bgDark : L.bgLight;
  if (bg) {
    const txt = _lum(bg) > 0.45 ? '#241B0F' : '#F3ECDD';
    setv('--bg', bg);
    setv('--surface', dark ? _mix(bg, '#ffffff', 0.06) : _mix(bg, '#ffffff', 0.65));
    setv('--surface-2', dark ? _mix(bg, '#ffffff', 0.11) : _mix(bg, '#000000', 0.045));
    setv('--surface-trans', _rgba(dark ? _mix(bg, '#ffffff', 0.06) : _mix(bg, '#ffffff', 0.65), 0.92));
    setv('--text', txt); setv('--text-light', txt);
    setv('--text-muted', _mix(txt, bg, 0.35)); setv('--text-dim', _mix(txt, bg, 0.55));
  } else {
    ['--bg', '--surface', '--surface-2', '--surface-trans', '--text', '--text-light', '--text-muted', '--text-dim'].forEach(k => setv(k, null));
  }
  setv('--read-lh', String(L.lh / 100));
  setv('--read-align', L.justify ? 'justify' : 'right');
  setv('--read-size', fontSize + 'px');
  setv('--read-font', fontFamily === 'font-naskh' ? "'Scheherazade New','Noto Naskh Arabic','Amiri',serif"
    : fontFamily === 'font-serif' ? "'Amiri','Traditional Arabic','Scheherazade New',serif" : "'Tahoma','Segoe UI',sans-serif");
}
function setLook(patch, noUi) {
  const L = Object.assign(getLook(), patch);
  try { localStorage.setItem(LOOK_KEY, JSON.stringify(L)); } catch (e) {}
  applyAppearancePrefs();
  if (!noUi) refreshLookUi();
}
function resetLook() {
  try { localStorage.removeItem(LOOK_KEY); } catch (e) {}
  applyAppearancePrefs(); refreshLookUi();
}
function toggleAutoTheme() {
  setLook({ auto: !getLook().auto });
  applyAutoTheme();
}
function applyAutoTheme() {
  if (!getLook().auto || !window.matchMedia) return;
  const d = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (d !== nightMode) { nightMode = d; try { localStorage.setItem('rs_night', d ? '1' : '0'); } catch (e) {} applyTheme(); }
}
function refreshLookUi() {
  const L = getLook(), dark = !!nightMode;
  const sw = (list, cur, fn, defA, defB) => list.map(x => {
    const act = (x.c || '').toLowerCase() === (cur || '').toLowerCase();
    const bgst = x.c ? x.c : `linear-gradient(135deg, ${defA} 50%, ${defB} 50%)`;
    return `<button type="button" class="swatch ${act ? 'active' : ''}" style="background:${bgst}" title="${x.n}" aria-label="${x.n}" onclick="${fn}('${x.c}')"></button>`;
  }).join('');
  const isCustom = (list, cur) => !!cur && !list.some(x => (x.c || '').toLowerCase() === cur.toLowerCase());
  const accEl = document.getElementById('accentSwatches');
  if (accEl) {
    accEl.innerHTML = sw(ACCENT_PRESETS, L.accent, 'pickAccent', '#C0502A', '#D9A441') +
      `<button type="button" class="swatch swatch-custom ${isCustom(ACCENT_PRESETS, L.accent) ? 'active' : ''}" title="لون مخصّص" aria-label="لون مخصّص" onclick="openAccentPicker()"><i class="ti ti-palette"></i></button>`;
  }
  const bgEl = document.getElementById('bgSwatches');
  const list = dark ? BG_PRESETS_DARK : BG_PRESETS_LIGHT;
  const curBg = dark ? L.bgDark : L.bgLight;
  if (bgEl) {
    bgEl.innerHTML = sw(list, curBg, 'pickBg', '#F7F5F2', '#141019') +
      `<button type="button" class="swatch swatch-custom ${isCustom(list, curBg) ? 'active' : ''}" title="لون مخصّص" aria-label="لون مخصّص" onclick="openBgPicker()"><i class="ti ti-palette"></i></button>`;
  }
  const hint = document.getElementById('bgThemeHint'); if (hint) hint.textContent = dark ? '(للوضع الليلي)' : '(للوضع النهاري)';
  const tg = (id, on) => { const e = document.getElementById(id); if (e) e.classList.toggle('on', !!on); };
  tg('justifyToggle', L.justify); tg('glowToggle', L.glow); tg('autoThemeToggle', L.auto);
  const row = document.getElementById('glowStrengthRow'); if (row) row.classList.toggle('disabled', !L.glow);
  const setr = (id, vid, v, txt) => { const e = document.getElementById(id); if (e && parseInt(e.value, 10) !== v) e.value = v; const t = document.getElementById(vid); if (t) t.textContent = txt; };
  setr('lhSlider', 'lhValue', L.lh, (L.lh / 100).toFixed(2));
  setr('glowSlider', 'glowValue', L.glowK, L.glowK + '%');
}
function pickAccent(c) { setLook({ accent: c }); }
function openAccentPicker() {
  const prev = getLook().accent;
  RSUI.pickColor({ title: 'لون التطبيق', value: prev || '#C0502A', presets: ACCENT_PRESETS.map(x => x.c).filter(Boolean),
    onInput: (c) => setLook({ accent: c }, true), onApply: (c) => setLook({ accent: c }), onCancel: () => setLook({ accent: prev })});
}
function openBgPicker() {
  const key = nightMode ? 'bgDark' : 'bgLight', L = getLook(), prev = L[key];
  const list = nightMode ? BG_PRESETS_DARK : BG_PRESETS_LIGHT;
  RSUI.pickColor({ title: nightMode ? 'لون الخلفية (الوضع الليلي)' : 'لون الخلفية (الوضع النهاري)', value: prev || (nightMode ? '#141019' : '#F7F5F2'), presets: list.map(x => x.c).filter(Boolean),
    onInput: (c) => setLook({ [key]: c }, true), onApply: (c) => setLook({ [key]: c }), onCancel: () => setLook({ [key]: prev || '' }) });
}
function pickBg(c, noUi) { setLook(nightMode ? { bgDark: c } : { bgLight: c }, noUi); }
try {
  if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyAutoTheme);
} catch (e) {}
try { applyAppearancePrefs(); applyAutoTheme(); } catch (e) {}


const NOTIF_LS = 'rs_notif_v70';
function getNotif() {
  let o = {};
  try { o = JSON.parse(localStorage.getItem(NOTIF_LS) || '{}') || {}; } catch (e) { o = {}; }
  return RSNotif.norm(o);
}
function notifSupported() { return typeof Notification !== 'undefined' && 'serviceWorker' in navigator; }
async function notifSyncStore() {
  try {
    await RSNotif.kvSet('settings', getNotif());
    const p = getDailyMasala(false);
    if (p) await RSNotif.kvSet('pick', { day: RSNotif.dayKey(), pick: { snippet: p.snippet, bookName: p.bookName } });
  } catch (e) {}
}
function saveNotif(o) { try { localStorage.setItem(NOTIF_LS, JSON.stringify(o)); } catch (e) {} }
async function setNotif(patch) {
  const o = Object.assign(getNotif(), patch);
  saveNotif(o);
  await notifSyncStore();
  notifRefreshUi();
  notifSchedule();
}
async function toggleNotif() {
  const cur = getNotif();
  if (cur.on) { await setNotif({ on: false }); notifSchedule(); return; }
  if (!notifSupported()) { showGenericToast('متصفحك لا يدعم الإشعارات'); return; }
  let perm = Notification.permission;
  if (perm === 'default') { try { perm = await Notification.requestPermission(); } catch (e) {} }
  if (perm !== 'granted') { showGenericToast('الإشعارات محظورة — فعّلها من إعدادات المتصفح/الجهاز للتطبيق'); notifRefreshUi(); return; }
  await setNotif({ on: true, lastSent: Date.now(), anchor: new Date().setHours(0, 0, 0, 0) });
  try { const reg = await navigator.serviceWorker.ready; if (reg.periodicSync) await reg.periodicSync.register('rs-daily-masala', { minInterval: 60 * 60 * 1000 }); } catch (e) {}
  showGenericToast('تم تفعيل الإشعارات');
}
async function notifShow(auto, due) {
  const reg = await navigator.serviceWorker.ready;
  const pick = (function () { try { return getDailyMasala(false); } catch (e) { return null; } })();
  const p = RSNotif.buildPayload(pick, due ? RSNotif.noteFor(getNotif(), due) : '');
  await reg.showNotification(p.title, { body: p.body, tag: RSNotif.TAG, renotify: true, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', dir: 'rtl', lang: 'ar', data: p.data });
}
async function testNotif() {
  if (!notifSupported()) { showGenericToast('متصفحك لا يدعم الإشعارات'); return; }
  let perm = Notification.permission;
  if (perm === 'default') { try { perm = await Notification.requestPermission(); } catch (e) {} }
  if (perm !== 'granted') { showGenericToast('الإشعارات محظورة — فعّلها من إعدادات المتصفح/الجهاز'); return; }
  try { await notifShow(false); showGenericToast('أُرسل إشعار تجريبي'); } catch (e) { showGenericToast('تعذّر إرسال الإشعار'); }
}
async function notifTick() {
  try {
    if (isEmbeddedMode || !notifSupported() || Notification.permission !== 'granted') return;
    if (typeof TimestampTrigger !== 'undefined') return;
    const o = getNotif();
    if (!o.on) return;
    let stored = null; try { stored = await RSNotif.kvGet('settings'); } catch (e) {}
    if (stored && stored.lastSent > o.lastSent) { o.lastSent = stored.lastSent; saveNotif(o); }
    const due = RSNotif.latestDue(Date.now(), o);
    if (!due) return;
    o.lastSent = due; saveNotif(o);
    await notifSyncStore();
    await notifShow(true, due);
  } catch (e) {}
}
async function notifSchedule() {
  try {
    if (!notifSupported() || typeof TimestampTrigger === 'undefined' || Notification.permission !== 'granted') return;
    const reg = await navigator.serviceWorker.ready;
    const old = await reg.getNotifications({ tag: RSNotif.TAG, includeTriggered: false });
    old.forEach(n => n.close());
    const o = getNotif();
    if (!o.on) return;
    const pk = (function () { try { return getDailyMasala(false); } catch (e) { return null; } })();
    const slots = RSNotif.upcoming(Date.now(), o, 20);
    for (const t of slots) {
      const p = RSNotif.buildPayload(pk, RSNotif.noteFor(o, t));
      await reg.showNotification(p.title, { body: p.body, tag: RSNotif.TAG + '-' + t, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', dir: 'rtl', lang: 'ar', data: p.data, showTrigger: new TimestampTrigger(t) });
    }
  } catch (e) {}
}
const NOTIF_WEEKDAYS = [['السبت', 6], ['الأحد', 0], ['الاثنين', 1], ['الثلاثاء', 2], ['الأربعاء', 3], ['الخميس', 4], ['الجمعة', 5]];
const NOTIF_DAY_NAMES = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const NOTIF_INTERVALS = Array.from({ length: 29 }, (_, i) => i + 2);
function notifDaysLabel(n) { return n === 1 ? 'كل يوم' : n === 2 ? 'كل يومين' : n <= 10 ? `كل ${RSUI.ar(n)} أيام` : `كل ${RSUI.ar(n)} يوماً`; }
function notifSetMode(m) {
  const patch = { mode: m };
  if (m === 'interval') patch.anchor = new Date().setHours(0, 0, 0, 0);
  setNotif(patch);
  if (m === 'custom' && !getNotif().custom.some(t => t > Date.now())) setTimeout(notifAddCustom, 150);
}
function notifSetTop(kind) {
  const o = getNotif();
  if (kind === 'sched') return notifSetMode('custom');
  notifSetMode(o.rec || 'daily');
}
function notifAddCustom() {
  const o = getNotif();
  if (o.custom.length >= RSNotif.MAX_CUSTOM) { showGenericToast('بلغتَ الحد الأقصى للمواعيد'); return; }
  RSUI.pickDateTime({ title: 'موعد مجدول', withNote: true, onDone: (ts, note) => {
    const cur = getNotif();
    if (cur.custom.includes(ts)) { showGenericToast('هذا الموعد مضاف من قبل'); return; }
    const cn = Object.assign({}, cur.customNotes); if (note) cn[ts] = note;
    setNotif({ custom: cur.custom.concat([ts]), customNotes: cn });
  } });
}
function notifEditCustom(ts) {
  const o0 = getNotif();
  RSUI.pickDateTime({ title: 'تعديل الموعد', value: ts, withNote: true, note: o0.customNotes[ts] || '', onDone: (nt, note) => {
    const cur = getNotif();
    const cn = Object.assign({}, cur.customNotes); delete cn[ts]; if (note) cn[nt] = note;
    setNotif({ custom: cur.custom.filter(x => x !== ts).concat([nt]), customNotes: cn });
  } });
}
function notifRemoveCustom(ts) { const cur = getNotif(); const cn = Object.assign({}, cur.customNotes); delete cn[ts]; setNotif({ custom: cur.custom.filter(x => x !== ts), customNotes: cn }); }
function notifClearPastCustom() { const cur = getNotif(), now = Date.now(); setNotif({ custom: cur.custom.filter(x => x > now) }); }
function notifToggleDay(d) {
  const o = getNotif();
  let days = o.days.slice();
  if (days.includes(d)) { if (days.length === 1) { showGenericToast('اختر يوماً واحداً على الأقل'); return; } days = days.filter(x => x !== d); } else days.push(d);
  setNotif({ days });
}
function notifStepEvery(dir) {
  const o = getNotif();
  let i = NOTIF_INTERVALS.indexOf(o.everyDays);
  if (i < 0) i = NOTIF_INTERVALS.findIndex(x => x >= o.everyDays);
  if (i < 0) i = NOTIF_INTERVALS.length - 1;
  i = Math.max(0, Math.min(NOTIF_INTERVALS.length - 1, i + dir));
  setNotif({ everyDays: NOTIF_INTERVALS[i], anchor: new Date().setHours(0, 0, 0, 0) });
}
function notifEditTime(i) {
  const o = getNotif();
  RSUI.pickTime({ title: 'وقت الإشعار', value: o.times[i], onDone: (t) => { const ts = o.times.slice(); ts[i] = t; setNotif({ times: ts }); } });
}
function notifAddTime() {
  const o = getNotif();
  if (o.times.length >= RSNotif.MAX_TIMES) { showGenericToast('الحد الأقصى أربعة أوقات'); return; }
  const last = RSNotif.hm(o.times[o.times.length - 1]);
  RSUI.pickTime({ title: 'وقت إضافي', value: RSNotif.fmtHM(last + 240), onDone: (t) => { if (o.times.includes(t)) { showGenericToast('هذا الوقت مضاف من قبل'); return; } setNotif({ times: o.times.concat([t]) }); } });
}
function notifRemoveTime(i, ev) {
  if (ev) ev.stopPropagation();
  const o = getNotif();
  if (o.times.length === 1) { showGenericToast('يلزم وقت واحد على الأقل'); return; }
  setNotif({ times: o.times.filter((_, k) => k !== i) });
}
function notifNextText(o) {
  const nxt = RSNotif.upcoming(Date.now(), o, 1)[0];
  if (!nxt) return '';
  const d = new Date(nxt), t0 = new Date().setHours(0, 0, 0, 0);
  const diff = Math.round((new Date(nxt).setHours(0, 0, 0, 0) - t0) / 86400000);
  const day = diff === 0 ? 'اليوم' : diff === 1 ? 'غداً' : NOTIF_DAY_NAMES[d.getDay()] + ' ' + RSUI.ar(d.getDate()) + '/' + RSUI.ar(d.getMonth() + 1);
  return `الإشعار القادم: ${day}، الساعة ${RSUI.fmtTime(RSNotif.fmtHM(d.getHours() * 60 + d.getMinutes()))}.`;
}
function renderNotifOptions(on) {
  const box = document.getElementById('notifOptions'); if (!box) return;
  box.style.display = on ? '' : 'none';
  if (!on) { box.innerHTML = ''; return; }
  const o = getNotif();
  const seg = (m, t) => `<button type="button" class="${o.mode === m ? 'active' : ''}" onclick="notifSetMode('${m}')">${t}</button>`;
  const top = (k, t, ic, on) => `<button type="button" class="${on ? 'active' : ''}" onclick="notifSetTop('${k}')"><i class="ti ti-${ic}"></i> ${t}</button>`;
  let h = `<div class="nt-block"><span class="nt-lbl">نوع المواعيد</span><div class="nt-seg nt-top">${top('mine', 'مواعيدي', 'repeat', o.mode !== 'custom')}${top('sched', 'مواعيد مجدولة', 'calendar-event', o.mode === 'custom')}</div>
    <div class="nt-sub-hint">${o.mode === 'custom' ? 'تختار تاريخاً وساعة بالضبط، ولك أن تكتب نص الإشعار بنفسك.' : 'تكرار تلقائي: كل يوم، أو أيام تختارها من الأسبوع، أو كل عدة أيام.'}</div></div>`;
  if (o.mode !== 'custom') h += `<div class="nt-block"><span class="nt-lbl">التكرار</span><div class="nt-seg nt-seg3">${seg('daily', 'كل يوم')}${seg('weekly', 'أيام من الأسبوع')}${seg('interval', 'كل عدة أيام')}</div></div>`;
  if (o.mode === 'custom') {
    const now = Date.now();
    const fut = o.custom.filter(t => t > now), past = o.custom.length - fut.length;
    h += `<div class="nt-block"><span class="nt-lbl">المواعيد المجدولة <span style="color:var(--text-dim);font-size:12px">(حتى ${RSUI.ar(RSNotif.MAX_CUSTOM)} موعداً)</span></span><div class="nt-custom">`
      + (fut.length ? fut.map(t => `<div class="nt-cu"><button type="button" class="nt-cu-t" onclick="notifEditCustom(${t})"><i class="ti ti-calendar-event"></i><span class="nt-cu-in"><b>${RSUI.fmtDateTime(t)}</b>${o.customNotes[t] ? `<em>${escapeHtml(o.customNotes[t])}</em>` : ''}</span></button><button type="button" class="nt-cu-x" onclick="notifRemoveCustom(${t})" aria-label="حذف الموعد"><i class="ti ti-x"></i></button></div>`).join('')
        : '<div class="nt-cu-empty">لا مواعيد قادمة بعد. أضف أول موعد.</div>')
      + `<button type="button" class="nt-time nt-add nt-cu-add" onclick="notifAddCustom()">+ موعد</button>`
      + (past ? `<button type="button" class="nt-cu-clean" onclick="notifClearPastCustom()">مسح ${RSUI.ar(past)} موعداً منتهياً</button>` : '')
      + `</div><div class="nt-next">${notifNextText(o)}</div></div>`;
  } else if (o.mode === 'weekly') {
    h += `<div class="nt-block"><span class="nt-lbl">الأيام <span style="color:var(--text-dim);font-size:12px">(مثلاً الاثنين والثلاثاء كل أسبوع، أو الجمعة وحدها)</span></span><div class="nt-days">${NOTIF_WEEKDAYS.map(([n, d]) => `<button type="button" class="${o.days.includes(d) ? 'active' : ''}" onclick="notifToggleDay(${d})">${n}</button>`).join('')}</div></div>`;
  } else if (o.mode === 'interval') {
    h += `<div class="nt-block"><span class="nt-lbl">التكرار</span><div class="nt-step"><button type="button" onclick="notifStepEvery(1)" aria-label="أكثر">+</button><b>${notifDaysLabel(o.everyDays)}</b><button type="button" onclick="notifStepEvery(-1)" aria-label="أقل">−</button></div></div>`;
  }
  if (o.mode !== 'custom') h += `<div class="nt-block"><span class="nt-lbl">${o.times.length > 1 ? 'الأوقات' : 'الوقت'}</span><div class="nt-times">`
    + o.times.map((t, i) => `<button type="button" class="nt-time" onclick="notifEditTime(${i})">${RSUI.fmtTime(t)}${o.times.length > 1 ? `<span class="rm" onclick="notifRemoveTime(${i}, event)" aria-label="حذف الوقت">×</span>` : ''}</button>`).join('')
    + (o.times.length < RSNotif.MAX_TIMES ? `<button type="button" class="nt-time nt-add" onclick="notifAddTime()">+ وقت</button>` : '')
    + `</div><div class="nt-next">${on ? notifNextText(o) : ''}</div></div>`;
  h += `<div class="settings-row"><span class="lbl">تجربة إشعار الآن</span><button class="settings-action-btn" onclick="testNotif()">تجربة</button></div>`;
  box.innerHTML = h;
}
function notifRefreshUi() {
  const o = getNotif();
  const supported = notifSupported();
  const perm = supported ? Notification.permission : 'unsupported';
  const on = o.on && perm === 'granted';
  const t = document.getElementById('notifToggle'); if (t) t.classList.toggle('on', on);
  renderNotifOptions(on);
  const hint = document.getElementById('notifHint');
  if (hint) {
    if (!supported) hint.textContent = 'هذا المتصفح لا يدعم الإشعارات. على الآيفون: أضف التطبيق إلى الشاشة الرئيسية أولاً.';
    else if (perm === 'denied') hint.textContent = 'الإشعارات محظورة لهذا التطبيق. فعّلها من إعدادات المتصفح أو الجهاز ثم أعد المحاولة.';
    else hint.textContent = 'يظهر الإشعار بمسألة اليوم، وبالضغط عليه تُفتح المسألة. وصوله والتطبيق مغلق يختلف بحسب المتصفح وتوفير الطاقة، ويكون أوثق إذا ثبّتّ التطبيق على الشاشة الرئيسية.';
  }
}
function notifInit() {
  if (isEmbeddedMode || !notifSupported()) return;
  try {
    navigator.serviceWorker.addEventListener('message', (e) => { if (e.data && e.data.type === 'open-daily') { try { openDailyMasala(); } catch (err) {} } });
  } catch (e) {}
  if (urlParams.get('openDaily') === '1') { try { openDailyMasala(); } catch (e) {} }
  notifSyncStore().then(() => notifTick());
  notifSchedule();
  setInterval(notifTick, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { notifTick(); notifSyncStore(); } });
}
