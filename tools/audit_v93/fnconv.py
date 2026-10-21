import sys; sys.path.insert(0,'.')
from common import *
SEP=re.compile(r'^[ \t]*[*\-_=ـ—–~]{4,}[ \t]*$')
D=r'([0-9٠-٩۰-۹]{1,3}(?:\s*(?:و|،|,|-)\s*[0-9٠-٩۰-۹]{1,3})*)'
DEFS={
 'paren':re.compile(r'^[ \t]*\(\s*'+D+r'\s*\)[ \t]*(?:[-–ـ.:]\s*)?(\S.*)$'),
 'dash': re.compile(r'^[ \t]*([0-9٠-٩۰-۹]{1,3})[ \t]*ـ[ \t]*(\S.*)$'),
 'bracket':re.compile(r'^[ \t]*\[\s*([0-9٠-٩۰-۹]{1,3})\s*\][ \t]*(\S.*)$'),
}
MK=re.compile(r'\(\s*([0-9٠-٩۰-۹]{1,3})\s*\)|\[\s*([0-9٠-٩۰-۹]{1,3})\s*\]')
def nums_of(s): return [int(nd(x)) for x in re.findall(r'[0-9٠-٩۰-۹]+',s)]

def tail_block(body):
    """Single trailing footnote block (optionally between separators). Returns (main_with_[k], [texts], info) or None"""
    lines=body.split('\n')
    n=len(lines)
    e=n
    while e>0 and (not lines[e-1].strip() or SEP.match(lines[e-1])): e-=1
    if e==0: return None
    for form,rx in DEFS.items():
        idx=[i for i in range(e) if rx.match(lines[i])]
        if len(idx)<1: continue
        starts=[i for i in idx if nums_of(rx.match(lines[i]).group(1))[0]==1]
        for s in reversed(starts):
            block=lines[s:e]
            exp=1; defs=[]; cur=None; ok=True
            for ln in block:
                m=rx.match(ln)
                if m:
                    ns=nums_of(m.group(1))
                    if ns[0]==exp or (ns[0]==exp):
                        cur={'nums':ns,'text':m.group(2).strip()}; defs.append(cur); exp=ns[-1]+1; continue
                    ok=False;break
                elif not ln.strip(): continue
                elif SEP.match(ln): continue
                else:
                    if cur is None: ok=False;break
                    cur['text']+=' '+ln.strip()
            if not ok or not defs: continue
            main_lines=lines[:s]
            while main_lines and (not main_lines[-1].strip() or SEP.match(main_lines[-1])): main_lines.pop()
            prev_sep = s>0 and any(SEP.match(l) for l in lines[max(0,s-2):s])
            main='\n'.join(main_lines)
            allnums=[x for d in defs for x in d['nums']]
            found={}
            for m in MK.finditer(main):
                k=int(nd(m.group(1) or m.group(2)))
                ls=main.rfind('\n',0,m.start())+1
                if main[ls:m.start()].strip()=='' : continue
                found.setdefault(k,[]).append(m)
            hit=[k for k in allnums if k in found]
            need=0.6 if len(allnums)>2 else 1.0
            if len(hit)>=max(1,need*len(allnums)) or (prev_sep and len(hit)>=1 and len(hit)>=0.4*len(allnums)):
                return main,defs,found,form,prev_sep
    return None

def apply_tail(body):
    r=tail_block(body)
    if not r: return None
    main,defs,found,form,prev_sep=r
    fn=[]; mapping={}
    for d in defs:
        fn.append(d['text'])
        for k in d['nums']: mapping[k]=len(fn)
    def rep(m):
        k=int(nd(m.group(1) or m.group(2)))
        ls=main.rfind('\n',0,m.start())+1
        if main[ls:m.start()].strip()=='' or k not in mapping: return m.group(0)
        return '[%d]'%mapping[k]
    out=MK.sub(rep,main)
    missing=sorted(k for k in found if k not in mapping)
    return dict(body=out,footnotes=fn,form=form,sep=prev_sep,defs=len(defs),markers_without_def=missing)

BR_DEF=re.compile(r'^[ \t]*\[\s*([0-9٠-٩۰-۹]{1,3})\s*\][ \t]*(\S.*)$')
BR_MK=re.compile(r'\[\s*([0-9٠-٩۰-۹]{1,3})\s*\]')
ISSUE_HEAD=re.compile(r'\[\s*مسأل')
def scattered_brackets(body):
    lines=body.split('\n'); out=[]; pending={}; fn=[]; order={}
    unpaired_defs=[]; 
    res_lines=[]; marker_slots=[]
    markers=[]
    for li,ln in enumerate(lines):
        m=BR_DEF.match(ln)
        if m and not ISSUE_HEAD.match(ln):
            k=int(nd(m.group(1)))
            q=pending.get(k)
            if q:
                mk=q.pop(0); mk['def']=m.group(2).strip()
            else: unpaired_defs.append((k,m.group(2).strip()))
            res_lines.append(None); continue
        spans=[]
        for mm in BR_MK.finditer(ln):
            pre=ln[:mm.start()]
            if ISSUE_HEAD.search(ln[max(0,mm.start()-0):mm.end()+12]) and re.match(r'\s*\[\s*مسأل',ln[mm.start():]): continue
            k=int(nd(mm.group(1)))
            mk={'num':k,'li':len(res_lines),'span':mm.span(),'def':None}
            spans.append(mk); markers.append(mk); pending.setdefault(k,[]).append(mk)
        res_lines.append((ln,spans))
    fn=[]; 
    outl=[]
    for item in res_lines:
        if item is None: continue
        ln,spans=item
        if not spans: outl.append(ln); continue
        s=''; last=0
        for mk in spans:
            a,b=mk['span']; s+=ln[last:a]
            if mk['def'] is not None:
                fn.append(mk['def']); s+='[%d]'%len(fn)
            last=b
        s+=ln[last:]; outl.append(s)
    body2='\n'.join(outl)
    return dict(body=re.sub(r'\n{3,}','\n\n',body2).rstrip('\n'),footnotes=fn,
                unpaired_markers=sum(1 for m in markers if m['def'] is None),
                unpaired_defs=unpaired_defs,total_markers=len(markers))
