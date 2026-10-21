import sys; sys.path.insert(0,'.')
from fnconv import *
HEAD=re.compile(r'^\s*\[\s*مسأل')
def split_layers(body):
    lines=body.split('\n')
    defidx=[i for i,l in enumerate(lines) if BR_DEF.match(l) and not HEAD.match(l)]
    if not defidx: return None
    last=max(i for i,l in enumerate(lines) if l.strip())
    if last!=defidx[-1]: return None
    run=[defidx[-1]]
    for i in reversed(defidx[:-1]):
        if i==run[-1]-1 or all(not lines[j].strip() for j in range(i+1,run[-1])):
            nxt=int(nd(BR_DEF.match(lines[run[-1]]).group(1))); cur=int(nd(BR_DEF.match(lines[i]).group(1)))
            if cur==nxt-1: run.append(i); continue
        break
    run=sorted(run)
    first=int(nd(BR_DEF.match(lines[run[0]]).group(1)))
    if first!=1: return None
    return lines,run
def convert(body):
    r=split_layers(body)
    if not r: return None
    lines,run=r
    tail=[(int(nd(BR_DEF.match(lines[i]).group(1))),BR_DEF.match(lines[i]).group(2).strip()) for i in run]
    s=run[0]
    rest=lines[:s]
    pend={}; marks=[]
    first_def=next((i for i,l in enumerate(rest) if BR_DEF.match(l) and not HEAD.match(l)),len(rest))
    layer1_used=set()
    for i,l in enumerate(rest):
        m=BR_DEF.match(l)
        if m and not HEAD.match(l):
            k=int(nd(m.group(1)))
            q=[x for x in pend.get(k,[]) if x['li']<first_def]
            if q: pend[k].remove(q[0]); q[0]['l1']=True
        for mm in BR_MK.finditer(l):
            if HEAD.match(l[mm.start():]): continue
            if m and mm.start()<=m.end(1)+3 and mm.start()<=3: continue
            k=int(nd(mm.group(1))); mk={'li':i,'span':mm.span(),'num':k,'l1':False,'def':None}
            marks.append(mk); pend.setdefault(k,[]).append(mk)
    free={}
    for mk in marks:
        if not mk['l1']: free.setdefault(mk['num'],[]).append(mk)
    used=0
    for k,t in tail:
        q=free.get(k)
        if q: mk=q.pop(0); mk['def']=t; used+=1
    fn=[]; out=[]
    bymark={}
    for mk in marks: bymark.setdefault(mk['li'],[]).append(mk)
    for i,l in enumerate(rest):
        mks=[m for m in bymark.get(i,[]) if not m['l1']]
        if not mks: out.append(l); continue
        sx='';last=0
        for mk in mks:
            a,b=mk['span']; sx+=l[last:a]
            if mk['def'] is not None:
                fn.append(mk['def']); sx+='[%d]'%len(fn)
            last=b
        sx+=l[last:]; out.append(sx)
    body2='\n'.join(out).rstrip()
    unpaired_markers=sum(1 for m in marks if not m['l1'] and m['def'] is None)
    return dict(body=body2,footnotes=fn,tail=len(tail),paired=used,unpaired_tail=len(tail)-used,unpaired_markers=unpaired_markers)
