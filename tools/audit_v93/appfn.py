import re
from common import nd
HDR1 = re.compile(r'\n\s*(?:\*\s*\*\s*\*\s*\n+)?\s*(?:ال)?هوامش[^\n]*\n\s*(?:[*\-]{5,}\s*\n)?')
ITEM = re.compile(r'(?:^|\n)\s*\(?\s*([0-9\u06F0-\u06F9\u0660-\u0669]{1,4})\s*\)?\s*[-.\)]\s*')
INL = re.compile(r'\(\s*([0-9\u06F0-\u06F9\u0660-\u0669]{1,4})\s*\)')
ANYH = re.compile(r'\n[ \t]*(?:\*\s*\*\s*\*[ \t]*\n+)?[ \t]*(?:(?:ال)?هوامش|هامش\s+(?:في|غي)\s+(?:ال)?هوامش)[^\n]*\n[ \t]*(?:[*\-]{5,}[ \t]*\n)?')
def block_items(text):
    items=list(re.finditer(ITEM.pattern,text)); m={}
    for i,it in enumerate(items):
        n=int(nd(it.group(1))); s=it.end(); e=items[i+1].start() if i+1<len(items) else len(text)
        c=text[s:e].strip()
        if c: m[n]=(m[n]+'\n'+c) if n in m else c
    return m
def extract_multi(body):
    if not body: return None
    heads=list(ANYH.finditer(body))
    if len(heads)<2: return None
    mains=[];blocks=[];cursor=0
    for i,h in enumerate(heads):
        mains.append(body[cursor:h.start()])
        start=h.end(); limit=heads[i+1].start() if i+1<len(heads) else len(body)
        rest=body[start:limit]; lead=len(rest)-len(rest.lstrip())
        gap=re.search(r'\n[ \t]+\n|\n[ \t]*\n[ \t]*\n',rest[lead:])
        bt=rest[:lead+gap.start()] if gap else rest
        blocks.append((bt,bool(re.search(r'هامش\s+(?:في|غي)',h.group(0)))))
        cursor=start+len(bt)
    mains.append(body[cursor:])
    arr=[];pieces=[];prev=None
    for i,seg in enumerate(mains):
        if i<len(blocks):
            items=block_items(blocks[i][0]); nested=False
            if blocks[i][1] and prev and items:
                segn={int(nd(m.group(1))) for m in INL.finditer(seg)}
                if not any(n in segn for n in items):
                    nested=True
                    for n,t in items.items():
                        hit=-1
                        for k in range(prev[0],prev[1]):
                            if re.search(r'\(\s*%d\s*\)'%n,nd(arr[k])): hit=k;break
                        if hit>=0: arr[hit]+= '\n— هامش: '+t
                        else: arr.append(t)
            if not nested:
                start=len(arr); used=set()
                def rep(m):
                    n=int(nd(m.group(1)))
                    if n not in items: return m.group(0)
                    arr.append(items[n]); used.add(n); return '[%d]'%len(arr)
                seg=INL.sub(rep,seg)
                for n,t in items.items():
                    if n not in used: arr.append(t)
                prev=(start,len(arr))
        pieces.append(seg)
    out=pieces[0]
    for p in pieces[1:]:
        pv=out.rstrip(); nx=p.lstrip()
        if not nx: out=pv; continue
        out=pv+('\n' if re.search(r'[.؟!:»]$',pv) else ' ')+nx
    if not arr: return None
    return out,arr
def extract_inline(body):
    if not body: return None
    m=HDR1.search(body)
    if not m: return None
    main=body[:m.start()]; fs=body[m.end():]
    items=list(ITEM.finditer(fs))
    if not items: return None
    fm={}
    for i,it in enumerate(items):
        n=int(nd(it.group(1))); s=it.end(); e=items[i+1].start() if i+1<len(items) else len(fs)
        c=fs[s:e].strip()
        if c: fm[n]=(fm[n]+'\n'+c) if n in fm else c
    conv=INL.sub(lambda mm: '[%d]'%int(nd(mm.group(1))) if int(nd(mm.group(1))) in fm else mm.group(0), main)
    mx=max(fm) if fm else 0
    arr=['']*mx
    for n,t in fm.items(): arr[n-1]=t
    return conv,arr
def app_extract(body, rawfn):
    """returns (body, footnotes_list or None, mode)"""
    if rawfn: return body,None,'col'
    mu=extract_multi(body)
    if mu: return mu[0],mu[1],'multi'
    r=extract_inline(body)
    if not r: return body,None,'none'
    return r[0],r[1],'inline'
