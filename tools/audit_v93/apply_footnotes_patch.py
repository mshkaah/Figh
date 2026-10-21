#!/usr/bin/env python3
"""يطبّق رقع الهوامش على نسخة من books.db (لا يعدّل الأصل).
الاستخدام:  python3 apply_footnotes_patch.py books.db books_patched.db [footnotes_patch.json mustamsak_footnotes_patch.json]
إن لم تُذكر ملفات رقع طُبّقت الرقعتان المجاورتان لهذا السكربت.
حماية: يرفض أي جدول من العروة الوثقى (bk68-bk81, bk90) أو الثمرة (bk110/bk_thamra)، ويتحقق من بصمة النص قبل الكتابة."""
import sqlite3, json, shutil, sys, hashlib, os
src, dst = sys.argv[1], sys.argv[2]
here = os.path.dirname(os.path.abspath(__file__))
files = sys.argv[3:] or [os.path.join(here, 'footnotes_patch.json'), os.path.join(here, 'mustamsak_footnotes_patch.json')]
FORBIDDEN = {f'bk{i}' for i in list(range(68, 82)) + [90, 110]} | {'bk_thamra'}
shutil.copyfile(src, dst)
c = sqlite3.connect(dst); done = skipped = 0
for f in files:
    for p in json.load(open(f, encoding='utf-8')):
        t = p['table']
        if t in FORBIDDEN: raise SystemExit(f'محظور: {t}')
        row = c.execute(f'select body, footnotes from "{t}" where rowid=?', (p['rowid'],)).fetchone()
        if not row or hashlib.sha1(row[0].encode()).hexdigest() != p['sha1_before'] or row[1]:
            skipped += 1; continue
        c.execute(f'update "{t}" set body=?, footnotes=? where rowid=?',
                  (p['body'], json.dumps(p['footnotes'], ensure_ascii=False), p['rowid']))
        done += 1
c.commit(); c.close()
print(f'طُبّق {done} صفاً، تُخطّي {skipped}')
