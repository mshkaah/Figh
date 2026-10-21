#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
تنظيف كسر الأسطر الزائد داخل نص العروة (وأي كتاب آخر يُمرَّر له).

القاعدة الآمنة المطبَّقة (لا شيء غيرها):
  1) \n مفردة (سطر واحد بالضبط) => تُستبدل بمسافة واحدة، إلا إذا كانت
     مجاورة مباشرة لعلامة ترقيم/قوس (عندها تُحذف بلا مسافة إطلاقاً، لتفادي
     نتائج كـ"كلمة ." بدل "كلمة.").
  2) \n{3,} (ثلاثة أسطر فارغة فأكثر) => تُعامل بنفس منطق الحالة (1)، لأن كل
     حالة كهذه فُحصت يدوياً بالعروة (13 حالة إجمالاً) وتبيّن أنها كسر جملة
     متصلة، لا فاصل حقيقي.
  3) \n\n بالضبط (سطر فارغ واحد) => لا تُمس إطلاقاً بهذه الجولة. معقدة
     (خليط فاصل حقيقي/خطأ عرضي)، تُترك لقرار منفصل لاحقاً.
  4) لا حذف نص، فقط استبدال/حذف أحرف newline ومسافات متكررة ناتجة عنها.

الاستخدام: يُشغَّل يدوياً بعد فحص، لا يُستدعى تلقائياً من أي مكان آخر.
"""
import sqlite3
import re
import sys

PLACEHOLDER = '\u0001'


def clean_text(text):
    if text is None:
        return text
    if '\n' not in text:
        return text

    protected = re.sub(r'(?<!\n)\n\n(?!\n)', PLACEHOLDER, text)

    def repl(m):
        pos = m.start()
        before_char = protected[pos - 1] if pos > 0 else ''
        after_char = protected[pos + 1] if pos + 1 < len(protected) else ''
        if after_char in '.,:؛،؟!)]' or before_char in '([':
            return ''
        return ' '

    cleaned = re.sub(r'\n', repl, protected)
    cleaned = cleaned.replace(PLACEHOLDER, '\n\n')
    cleaned = re.sub(r' {2,}', ' ', cleaned)
    cleaned = re.sub(r' +\n\n', '\n\n', cleaned)
    cleaned = re.sub(r'\n\n +', '\n\n', cleaned)
    return cleaned


def process_table(conn, table, dry_run=True):
    cur = conn.cursor()
    cur.execute(f"SELECT rowid, body FROM {table}")
    rows = cur.fetchall()
    changed = 0
    diffs = []
    for rowid, body in rows:
        if not body:
            continue
        new_body = clean_text(body)
        if new_body != body:
            changed += 1
            if len(diffs) < 5:
                diffs.append((rowid, body, new_body))
            if not dry_run:
                cur.execute(f"UPDATE {table} SET body = ? WHERE rowid = ?", (new_body, rowid))
    if not dry_run:
        conn.commit()
    return changed, len(rows), diffs


if __name__ == '__main__':
    db_path = sys.argv[1] if len(sys.argv) > 1 else 'books_test.db'
    tables_arg = None
    for a in sys.argv[2:]:
        if a != '--apply':
            tables_arg = a
            break
    tables = tables_arg.split(',') if tables_arg else [
        'bk68', 'bk69', 'bk70', 'bk71', 'bk72', 'bk73', 'bk74', 'bk75',
        'bk76', 'bk77', 'bk78', 'bk79', 'bk80', 'bk81', 'bk90'
    ]
    dry_run = '--apply' not in sys.argv

    conn = sqlite3.connect(db_path)
    total_changed = 0
    total_rows = 0
    for t in tables:
        changed, total, diffs = process_table(conn, t, dry_run=dry_run)
        total_changed += changed
        total_rows += total
        print(f"{t}: {changed}/{total} rows changed" + (" (DRY RUN)" if dry_run else " (APPLIED)"))
    print(f"\nTOTAL: {total_changed}/{total_rows} rows changed")
    conn.close()
