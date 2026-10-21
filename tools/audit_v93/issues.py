import sys; sys.path.insert(0,'.')
from common import *
import collections
NUM=r'[0-9\u06F0-\u06F9\u0660-\u0669]+'
WORD=r'(?:المسأل[ةه]|مسأل[ةه]|المسال[ةه]|مسال[ةه]|السؤال|سؤال|السوال|سوال)'
END=r'(?:\s*:|\s*\.(?!\d))'
GEN=(r'(?:\(\s*%s\s*:\s*%s\s*\)|\(\s*%s\s*%s\s*\)|%s\s*\(\s*%s\s*\)%s|%s\s*%s%s)'%(WORD,NUM,WORD,NUM,WORD,NUM,END,WORD,NUM,END))
NOPAREN=(r'(?:\(\s*%s\s*:\s*%s\s*\)|%s\s*\(\s*%s\s*\)%s|%s\s*%s%s)'%(WORD,NUM,WORD,NUM,END,WORD,NUM,END))
BRK=(r'(?:%s\s*\[\s*%s\s*\]\s*:|%s)'%(WORD,NUM,GEN))
DASH=r'(?:^|\n)\s*%s\s*ـ'%NUM
OVR={42:NUM+r'\s*ـ',60:NUM+r'\s*ـ',84:r'\(\s*'+NUM+r'\s*\)',85:r'\(\s*'+NUM+r'\s*\)',86:DASH,88:DASH,87:BRK}
for b in (17,26,28,29,30,35,40,43,47,82,102,106): OVR[b]=NOPAREN
CUE_WORDS=['تقدّم','تقدم','تقدّمت','تقدمت','ماتقدم','المتقدّم','المتقدم','سيأتي','سياتي','سأتي','ستأتي','ستاتي','سيجيء','سيجئ','ستجيء','ستجئ','يأتي','تأتي','يجيء','تجيء','سيتّضح','سيتضح','ستتّضح','ستتضح','يتّضح','يتضح','تتّضح','تتضح','مرّ','مر','ذكرنا','ذكرناه','ذكرناها','ذكره','ذكرها','ذكرتم','ذكرت','ذكر','سيذكر','ستذكر','سنذكر','قلتم','قلنا','راجع','سبق','سابقاً','السابقة','ورد','مذكور','مذكورة','المذكور','المذكورة','مضى','جاء','قدمنا','أسلفنا','اسلفنا','بيّناه','بيناه','بيّنّاه','بيانه','بيانها']
NOUNS=['الفقرة','الفقره','فقرة','البند','بند','النقطة','نقطة']
CUE_RE=re.compile('(?:%s)[^.:؛؟\\n]{0,60}?(?:في|فيها|فيه)\\s*(?:(?:%s)\\s*)?$'%('|'.join(CUE_WORDS),'|'.join(NOUNS)))
DIAC=re.compile(r'[\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED]')
def strip_d(t): return DIAC.sub('',t)
def preceded_by_cue(text,idx):
    before=text[max(0,idx-140):idx].rstrip()
    m=CUE_RE.search(before)
    if not m: return False
    cs=m.start()
    if cs>0 and before[cs-1] in 'وفلبك': cs-=1
    return not (cs>0 and re.match(r'[\u0600-\u06FF]',before[cs-1]))
def starts(bid,text):
    pat=re.compile(OVR.get(bid,GEN))
    t=strip_d(text); out=[]
    for m in pat.finditer(t):
        if preceded_by_cue(t,m.start()): continue
        nm=re.search(NUM,m.group(0))
        out.append((m.start(),int(nd(nm.group(0))),m.group(0)))
    return out
