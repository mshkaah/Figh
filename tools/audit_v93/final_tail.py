import sys; sys.path.insert(0,'.')
from fnconv import *
from appfn import app_extract
HDRLINE=re.compile(r'\n[ \t]*(?:ال)?(?:هوامش|هامش|حواشي|حاشية)[ \t]*:?[ \t]*$')
def safe_tail(body):
    r=tail_block(body)
    if not r: return None
    main,defs,found,form,prev_sep=r
    allnums=[x for d in defs for x in d['nums']]
    hit=[k for k in allnums if k in found]
    full=len(hit)==len(allnums)
    if not full and not (prev_sep and len(hit)>=0.6*len(allnums)): return None
    miss=[k for k in found if k not in allnums]
    if len(miss)>max(1,int(0.2*len(allnums))): return None
    res=apply_tail(body)
    res['body']=HDRLINE.sub('',res['body'].rstrip()) 
    res['full']=full
    return res
