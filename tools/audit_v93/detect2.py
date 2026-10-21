import sys; sys.path.insert(0,'.')
from detect import *
SEP = re.compile(r'^[ \t]*[*\-_=ـ—–~]{4,}[ \t]*$')
def inline_nums(before, form):
    mk=MARK_FORMS[form]; nums=collections.Counter()
    for line in before.split('\n'):
        l2=DEF_FORMS[form].sub(lambda m:' '+m.group(2), line) if DEF_FORMS[form].match(line) else line
        for m in mk.finditer(l2): nums[int(nd(m.group(1)))]+=1
    return nums
def true_blocks(text):
    """footnote definition blocks: tail/sep-bounded runs whose numbers appear as inline markers earlier"""
    lines=text.split('\n'); out=[]
    for blk in find_blocks(text):
        if blk['form'] in('dash','dot') : 
            pass
        s,e=blk['start'],blk['end']
        after=[l for l in lines[e:] if l.strip() and not SEP.match(l)]
        prev_sep = any(SEP.match(l) for l in lines[max(0,s-3):s])
        tail = (len(after)==0)
        before='\n'.join(lines[:s])
        nums=inline_nums(before, blk['form'])
        want=range(blk['first'],blk['last']+1)
        hit=sum(1 for k in want if nums.get(k))
        ok = hit>=max(1,int(0.6*blk['count'])) and (tail or prev_sep)
        if ok: out.append(dict(blk,hit=hit,tail=tail,sep=prev_sep))
    return out
