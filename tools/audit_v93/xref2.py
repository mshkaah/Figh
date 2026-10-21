import sys; sys.path.insert(0,'.')
from issues import *
import json
CEN=re.compile(r'(?:ال)?(?:مسأل[ةه]|مسال[ةه]|سؤال|سوال|فقرة|فقره|بند)\s*[\(\[]?\s*(%s)\s*[\)\]]?(?:\s*(?:و|،|,|إلى|الى)\s*[\(\[]?\s*(%s)\s*[\)\]]?)?'%(NUM,NUM))
PASTW=set(map(strip_d,['تقدم','تقدمت','تقدما','المتقدم','المتقدمة','مر','مرت','مضى','سبق','سبقت','السابقة','السابق','ذكرنا','ذكرناه','ذكرناها','ذكره','ذكرها','ذكر','ذكرت','ذكرتم','قدمنا','أسلفنا','بيناه','بينا','قلنا','المذكور','المذكورة','مذكور','مذكورة','وردت','ورد','تقدمه','تقدمها']))
FUTW=set(map(strip_d,['سيأتي','سياتي','ستأتي','ستاتي','سيجيء','سيجئ','ستجيء','يأتي','تأتي','سيذكر','ستذكر','سنذكر','يذكر','سيتضح','ستتضح','سيبين','ستبين','سنبين','لاحقا','لاحقاً','الآتية','الاتية','الآتي','الاتي','يجيء','تجيء','سيأتيك','سنتعرض','سيرد','سترد','ستجئ','سيجي','ستجي']))
EXTW=['المنهاج','منهاج الصالحين','الرسالة العملية','رسالة','المسائل المنتخبة','توضيح المسائل','تحرير الوسيلة','العروة','المناسك','كتاب','الجزء','ج1','ج 1','ج2','ج 2','ج3','المستمسك','الفتاوى','الفتوى','الوسيلة','المنتخبة','هداية','مناسك']
SELFW=['هذه الرسالة','هذا الكتاب','هذا الجزء']
def toks(c): return re.findall(r'[\u0621-\u064A]+',c)
def norm(w):
    for p in ('و','ف'):
        if w.startswith(p) and len(w)>3 and (w[1:] in PASTW or w[1:] in FUTW): return w[1:]
    return w
def direction(before):
    c=re.split(r'[.:؛؟!\n]',strip_d(before))[-1]
    d='neutral'
    for t in toks(c):
        t=norm(t)
        if t in PASTW: d='past'
        elif t in FUTW: d='future'
    return d
def mentions(bid,text):
    t=strip_d(text); sp=[s[0] for s in starts(bid,text)]
    out=[]
    for m in CEN.finditer(t):
        if any(abs(m.start()-p)<=3 for p in sp): continue
        before=t[max(0,m.start()-100):m.start()]; after=t[m.end():m.end()+45]
        ls=t.rfind('\n',0,m.start())+1
        if re.match(r'\s*[(\[]?\s*$',t[ls:m.start()]) and re.match(r'\s*[):.]',t[m.end():m.end()+3]) : continue
        d=direction(before)
        ext=[w for w in EXTW if w in before[-45:] or w in after[:35]]
        nums=[int(nd(m.group(1)))]+([int(nd(m.group(2)))] if m.group(2) else [])
        out.append(dict(pos=m.start(),text=m.group(0),dir=d,ext=ext,nums=nums,ctx=t[max(0,m.start()-45):m.end()+30].replace('\n',' ')))
    return out
