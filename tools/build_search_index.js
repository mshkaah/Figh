const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..');
const initSqlJs = require(path.join(dir, 'vendor/sql-wasm.js'));
const M = { 'إ': 'ا', 'أ': 'ا', 'آ': 'ا', 'ة': 'ه', 'ى': 'ي', 'ی': 'ي', 'ک': 'ك' };
const RE = /[ً-ٰٟـ]+|[إأآةىیک]/g;
const norm = s => String(s).replace(RE, m => M[m] || '');
function pushVarint(arr, v) { while (v >= 128) { arr.push((v & 127) | 128); v = Math.floor(v / 128); } arr.push(v); }

(async () => {
  const SQL = await initSqlJs({ locateFile: f => path.join(dir, 'vendor', f) });
  const db = new SQL.Database(fs.readFileSync(path.join(dir, 'books.db')));
  const dbVersion = db.exec('PRAGMA user_version')[0].values[0][0];
  const books = db.exec('SELECT book_id, bk_table FROM book_menu ORDER BY book_id')[0].values;
  const vocab = new Map();
  const bookMeta = []; const rowidBytes = []; let gid = 0;
  for (const [id, tb] of books) {
    let r; try { r = db.exec(`SELECT rowid, title, body FROM "${tb}" ORDER BY rowid`); } catch (e) { continue; }
    if (!r.length) continue;
    const rows = r[0].values; let prev = 0;
    bookMeta.push({ id, n: rows.length });
    for (const [rid, ti, bo] of rows) {
      pushVarint(rowidBytes, rid - prev); prev = rid;
      const seen = new Set();
      for (const t of (norm(ti || '') + '\n' + norm(bo || '')).split(/\s+/)) {
        if (!t || seen.has(t)) continue; seen.add(t);
        let a = vocab.get(t); if (!a) { a = []; vocab.set(t, a); } a.push(gid);
      }
      gid++;
    }
  }
  const tokens = [...vocab.keys()];
  const vocabBuf = Buffer.from(tokens.join('\n'), 'utf8');
  const post = []; const offs = new Uint32Array(tokens.length + 1);
  tokens.forEach((t, i) => { offs[i] = post.length; let p = 0; for (const g of vocab.get(t)) { pushVarint(post, g - p); p = g; } });
  offs[tokens.length] = post.length;
  const header = Buffer.from(JSON.stringify({ v: 1, dbVersion, rows: gid, books: bookMeta, tokens: tokens.length,
    rowidLen: rowidBytes.length, vocabLen: vocabBuf.length, postLen: post.length }), 'utf8');
  const len = Buffer.alloc(4); len.writeUInt32LE(header.length);
  const out = Buffer.concat([len, header, Buffer.from(rowidBytes), vocabBuf, Buffer.from(offs.buffer), Buffer.from(post)]);
  fs.writeFileSync(path.join(dir, 'search-index.bin'), out);
  console.log(`search-index.bin: ${(out.length / 1048576).toFixed(1)} MB — ${gid} صفاً، ${tokens.length} كلمة مميّزة، نسخة القاعدة v${dbVersion}`);
})();
