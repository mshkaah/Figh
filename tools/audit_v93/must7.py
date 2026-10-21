import sys; sys.path.insert(0,'.')
from fnconv import BR_DEF, BR_MK
from common import *
HEAD=re.compile(r'^\s*\[\s*مسأل')
REFLEX=re.compile(r'(^[\u0621-\u064A ]{2,14}\s*[:ـ]\s*[٠-٩0-9]+|لاحظ|الوسائل|مستدرك|الجواهر|الحدائق|التهذيب|الكافي|الفقيه|الاستبصار|المستند|مفتاح الكرامة|كشف اللثام|الذكرى|المدارك|المنتهى|التذكرة|المعتبر|السرائر|الخلاف|المبسوط|النهاية|البحار|مصباح الفقيه|راجع|انظر|ج\s*[:٠-٩0-9]|ص\s*[:٠-٩0-9]|باب\s*:|حديث\s*:|سورة|الآية|الفقه|المصدر|كتاب)')
def parse(body):
    lines=body.split('\n'); recs=[]; markers=[]
    for i,l in enumerate(lines):
        m=BR_DEF.match(l)
        isdef=bool(m) and not HEAD.match(l)
        rec={'i':i,'line':l,'def':None,'marks':[]}
        txt=l
        if isdef:
            rec['def']=(int(nd(m.group(1))),m.group(2).strip()); txt=m.group(2)
        off=len(l)-len(txt)
        for mm in BR_MK.finditer(txt):
            if HEAD.match(txt[mm.start():]): continue
            mk={'num':int(nd(mm.group(1))),'li':i,'span':(mm.start()+off,mm.end()+off),'def':None,'inrun':None}
            rec['marks'].append(mk); markers.append(mk)
        recs.append(rec)
    runs=[]; cur=None
    for rec in recs:
        if rec['def']:
            n=rec['def'][0]
            if cur and n==cur['last']+1 and rec['i']-cur['end']<=3: cur['recs'].append(rec); cur['last']=n; cur['end']=rec['i']
            else:
                cur={'recs':[rec],'last':n,'first':n,'end':rec['i']}; runs.append(cur)
    for r in runs:
        for rec in r['recs']:
            for mk in rec['marks']: mk['inrun']=id(r)
    return recs,markers,runs
WEAK=re.compile(r'^(?:تقدم|تقدمت|تقدما|مر|يأتي|سيأتي|لاحظ|راجع|ما تقدم|نفس)')
def is_refs(run):
    ds=[r['def'][1] for r in run['recs']]
    strong=sum(1 for d in ds if REFLEX.search(d) and len(d)<170)
    weak=sum(1 for d in ds if not (REFLEX.search(d) and len(d)<170) and WEAK.match(d) and len(d)<80)
    n=len(ds)
    ok = strong>=0.6*n or (strong>=1 and (strong+weak)>=0.8*n)
    return ok, strong/n
SRC=r'(?:مستدرك الوسائل|الوسائل|مستدرك|وسائل الشيعة|الوافي|البحار|الكافي|التهذيب|الفقيه|الاستبصار|جامع أحاديث الشيعة|راجع|المصدر|الحدائق|الجواهر|عوالي اللآلي|دعائم الإسلام|المستدرك)'
HADITH=r'حديث\s*:\s*[٠-٩]+(?:\s*[،و]\s*[٠-٩]+)*'
CHAIN=re.compile(r'^(?P<fn>'+SRC+r'[^\n]{0,170}?'+HADITH+r'(?:\s*[،.]?\s*وباب\s*:[^\n]{0,110}?'+HADITH+r')*\.?)(?P<rest>.*)$',re.S)
SURAH=re.compile(r'^(?P<fn>[\u0621-\u064A ]{2,14}\s*[:ـ]\s*[٠-٩]+(?:\s*[،و]\s*[٠-٩]+)*\.?)(?P<rest>.*)$',re.S)
def split_def(d):
    """returns (footnote_text, remainder) or None if the line must stay in the body"""
    m=CHAIN.match(d) or SURAH.match(d)
    if m:
        rest=m.group('rest').strip(); fn=m.group('fn').strip()
        if len(fn)<=260: return fn,rest
    if len(d)<=170 and (REFLEX.search(d) or WEAK.match(d)): return d,''
    return None

def is_refs(run):
    ds=[r['def'][1] for r in run['recs']]
    def strong_line(d): return bool(CHAIN.match(d) or SURAH.match(d) or (len(d)<170 and REFLEX.search(d)))
    strong=sum(1 for d in ds if strong_line(d))
    weak=sum(1 for d in ds if not strong_line(d) and WEAK.match(d) and len(d)<80)
    n=len(ds)
    return (strong>=0.6*n or (strong>=1 and (strong+weak)>=0.8*n)), strong/n

def convert(body):
    recs,markers,runs=parse(body)
    if not runs: return None
    refruns=[]
    for r in runs:
        ok,_=is_refs(r)
        r['_refs']=ok
        if r['first']==1 and (ok or any(CHAIN.match(x['def'][1]) for x in r['recs'])): refruns.append(r)
    if not refruns: return None
    start_idx=lambda r:r['recs'][0]['i']
    remove={}; remainder={}
    for r in refruns:
        st=start_idx(r); prev=[x for x in refruns if x is not r and start_idx(x)<st]
        for rec in r['recs']:
            n=rec['def'][0]; rec['mk']=None; sp=split_def(rec['def'][1])
            if sp is None: continue
            if not r['_refs'] and not CHAIN.match(rec['def'][1]): continue
            fn,rest=sp; rec['fn']=fn
            cands=[m for m in markers if m['num']==n and m['def'] is None and m['li']<st]
            pref=[m for m in cands if any(m['inrun']==id(x) for x in prev)]
            pick=pref or cands
            remove[rec['i']]=rec
            if pick: mk=pick[0]; mk['def']=fn; rec['mk']=mk
            if rest: remainder[rec['i']]=rest
    if not remove: return None
    for rec in remove.values():
        if rec['mk'] is not None and rec['mk']['li'] in remove:
            rec['mk']['def']=None; rec['mk']=None
    refmk={id(rec['mk']) for rec in remove.values() if rec['mk'] is not None}
    fn_list=[]; out=[]
    for rec in recs:
        if rec['i'] in remove:
            if rec['i'] in remainder: out.append(remainder[rec['i']])
            continue
        l=rec['line']; mks=[m for m in rec['marks'] if id(m) in refmk]
        if mks:
            s_='';last=0
            for mk in sorted(mks,key=lambda m:m['span']):
                a,b=mk['span']; s_+=l[last:a]; fn_list.append(mk['def']); s_+='[%d]'%len(fn_list); last=b
            s_+=l[last:]; l=s_
        out.append(l)
    orphan=[rec['fn'] for rec in remove.values() if rec['mk'] is None]
    body2=re.sub(r'\n{3,}','\n\n','\n'.join(out)).rstrip()
    tot=len(remove)
    return dict(body=body2,footnotes=fn_list,orphans=orphan,refdefs=tot,paired=tot-len(orphan),runs=len(refruns),split=len(remainder))
