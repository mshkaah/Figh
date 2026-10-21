import sys; sys.path.insert(0,'.')
from common import *; from appfn import *
import collections
DEF_FORMS = {
 'paren':  re.compile(r'^[ \t]*\(\s*([0-9٠-٩۰-۹]{1,3})\s*\)[ \t]*(?:[-–ـ.:]\s*)?(\S.*)$'),
 'bracket':re.compile(r'^[ \t]*\[\s*([0-9٠-٩۰-۹]{1,3})\s*\][ \t]*(?:[-–ـ.:]\s*)?(\S.*)$'),
 'guill':  re.compile(r'^[ \t]*«\s*([0-9٠-٩۰-۹]{1,3})\s*»[ \t]*(?:[-–ـ.:]\s*)?(\S.*)$'),
 'dash':   re.compile(r'^[ \t]*([0-9٠-٩۰-۹]{1,3})[ \t]*[-–ـ][ \t]*(\S.*)$'),
 'dot':    re.compile(r'^[ \t]*([0-9٠-٩۰-۹]{1,3})[ \t]*\.[ \t]*(\S.*)$'),
}
MARK_FORMS = {
 'paren':  re.compile(r'\(\s*([0-9٠-٩۰-۹]{1,3})\s*\)'),
 'bracket':re.compile(r'\[\s*([0-9٠-٩۰-۹]{1,3})\s*\]'),
 'guill':  re.compile(r'«\s*([0-9٠-٩۰-۹]{1,3})\s*»'),
 'dash': re.compile(r'(?!x)x'), 'dot': re.compile(r'(?!x)x'),
}
def find_blocks(text):
    """find runs of consecutive definition lines with increasing numbers (start at 1 or small). returns list of dict"""
    lines=text.split('\n'); res=[]
    for form,rx in DEF_FORMS.items():
        i=0
        while i<len(lines):
            m=rx.match(lines[i])
            if m:
                n=int(nd(m.group(1))); run=[(i,n)]; j=i+1; last=n
                while j<len(lines):
                    if not lines[j].strip(): j+=1; continue
                    m2=rx.match(lines[j])
                    if m2 and int(nd(m2.group(1)))==last+1:
                        last+=1; run.append((j,last)); j+=1
                    elif m2 is None and run and len(lines[j].strip())>0 and not any(rx2.match(lines[j]) for rx2 in DEF_FORMS.values()):
                        j+=1
                        if j-run[-1][0]>8: break
                    else: break
                if len(run)>=2 or (len(run)==1 and run[0][1]==1):
                    res.append(dict(form=form,start=run[0][0],first=run[0][1],last=last,count=len(run),end=j))
                i=max(j,i+1)
            else: i+=1
    return res
