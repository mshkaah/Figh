import sys; sys.path.insert(0,'.')
from fnconv import *
HEAD_RE=re.compile(r'^\s*\[\s*مسأل')
def parse_row(body):
    lines=body.split('\n'); items=[]; pending={}; markers=[]; defs=[]
    for ln in lines:
        m=BR_DEF.match(ln)
        if m and not HEAD_RE.match(ln):
            k=int(nd(m.group(1))); d={'num':k,'text':m.group(2).strip(),'used':False}
            q=pending.get(k)
            if q:
                mk=q.pop(0); mk['def']=d; d['used']=True
            defs.append(d); items.append(('def',d)); continue
        spans=[]
        for mm in BR_MK.finditer(ln):
            if HEAD_RE.match(ln[mm.start():]) : continue
            k=int(nd(mm.group(1))); mk={'num':k,'span':mm.span(),'def':None}
            spans.append(mk); markers.append(mk); pending.setdefault(k,[]).append(mk)
        items.append(('line',ln,spans))
    return dict(items=items,markers=markers,defs=defs)
def cross_pair(rows):
    """rows: list of parsed dicts in book order. unpaired defs pair with unpaired markers of previous row."""
    for i in range(1,len(rows)):
        prev=rows[i-1]; free={}
        for mk in prev['markers']:
            if mk['def'] is None: free.setdefault(mk['num'],[]).append(mk)
        for d in rows[i]['defs']:
            if not d['used'] and free.get(d['num']):
                mk=free[d['num']].pop(0); mk['def']=d; d['used']=True; d['xrow']=True
def render(row):
    fn=[]; out=[]
    for it in row['items']:
        if it[0]=='def': continue
        _,ln,spans=it
        s='';last=0
        for mk in spans:
            a,b=mk['span']; s+=ln[last:a]
            if mk['def'] is not None:
                t=BR_MK.sub('',mk['def']['text']).strip()
                fn.append(t); s+='[%d]'%len(fn)
            last=b
        s+=ln[last:]; out.append(s)
    body=re.sub(r'[ \t]+\n','\n','\n'.join(out)); body=re.sub(r'\n{3,}','\n\n',body).rstrip()
    return body,fn
