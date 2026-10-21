import sqlite3, json, re
DB='/home/claude/work/books_db/books.db'
FORBIDDEN_IDS = set(list(range(68,82))+[90,110])
def conn(): return sqlite3.connect(DB)
def books():
    c=conn()
    out=[]
    for bid,name,aid,_,tbl in c.execute("select book_id,book_name,auther_id,bktitle_table,bk_table from book_menu order by book_id"):
        if bid in FORBIDDEN_IDS: continue
        out.append((bid,name.strip(),aid,tbl))
    return out
AR_DIG=str.maketrans('٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹','01234567890123456789')
def nd(s): return s.translate(AR_DIG)
def T(bid): return f'bk{bid:02d}' if bid<10 else f'bk{bid}'
