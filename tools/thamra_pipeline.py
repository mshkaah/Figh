# -*- coding: utf-8 -*-
"""
Full extraction pipeline for "الثمرة في أحكام الحج والعمرة" (طبعة 1445).
Single self-contained script (no cross-imports between extraction stages,
to avoid the state-accumulation bugs from the earlier multi-script version).

Stages:
  1. Read docx in true body order (paragraphs + tables interleaved).
  2. Drop running page headers/footers and the table-of-contents block.
  3. Merge line-wrapped paragraphs into whole sentences/opinions, respecting
     this document's REVERSED parenthesis convention: ')' visually opens a
     group, '(' visually closes it (an artifact of the original PDF's RTL
     text extraction).
  4. Drop the front-matter (المقدمة) block entirely per user request.
  5. Classify each unit: heading / subheading / question / opinion / table.
  6. For opinion lines, resolve every parenthetical or trailing scholar-name
     group to a canonical name, normalizing the PDF's extra kerning spaces
     (e.g. 'الســيد' -> 'السيد') and dropped articles/hamza variants.
  7. Rebuild the one "جدول إدراك الوقوفين" that the docx split into 4 broken
     table fragments, and the 17 intact "جدول الكفارات" tables.
"""
import re
import json
from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph
from docx.oxml.ns import qn

SRC = '/mnt/user-data/uploads/الثمرة_في_أحكام_العمرة_1445_لكترونية.docx'


CANONICAL_AUTHER_ID = {
    'السيستاني': 1,
    'الخامنئي': 3,
    'الفياض': 4,
    'السيد صادق': 7,
    'الحائري': 8,
    'الخوئي': 11,
    'الوحيد': 12,
    'الخميني': 13,
    'بشير': 15,
    'الشيرازي': 16,
    'التبريزي': 17,
    'الحكيم': 19,
    'الخاقاني': 20,
    'مكارم': 23,
    'الزنجاني': 24,
    'العصفور': 26,
    'السبحاني': 27,
    'المدرسي': None,
    'زين الدين': None,
    'الواعظي': None,
    'الصدر': None,
    'الاحقاقي': None,
}

_ALIAS_TO_CANON = {}
def _key(s):
    return re.sub(r'\s+', '', s)
for _canon in CANONICAL_AUTHER_ID:
    _ALIAS_TO_CANON[_key(_canon)] = _canon
_EXTRA_ALIASES = {
    'السيدصادق': 'السيد صادق', 'سيدصادق': 'السيد صادق',
    'زينالدين': 'زين الدين', 'البشير': 'بشير',
    'شبيريزنجاني': 'الزنجاني',
    'خامئني': 'الخامنئي', 'خامنئني': 'الخامنئي', 'الخامئني': 'الخامنئي',
}
for _alias, _canon in _EXTRA_ALIASES.items():
    _ALIAS_TO_CANON[_key(_alias)] = _canon

def _normalize_hamza(s):
    return s.translate(str.maketrans({'\u0625': '\u0627', '\u0623': '\u0627', '\u0622': '\u0627'}))

def resolve_name(raw):
    """Return canonical scholar name string, or None if unresolved."""
    raw = raw.replace('\u0640', '')
    raw = re.sub(r'\s+', ' ', raw).strip(' :.')
    if not raw:
        return None
    for candidate in (raw, _normalize_hamza(raw)):
        k = _key(candidate)
        if k in _ALIAS_TO_CANON:
            return _ALIAS_TO_CANON[k]
        if not candidate.startswith('ال'):
            k2 = _key('ال' + candidate)
            if k2 in _ALIAS_TO_CANON:
                return _ALIAS_TO_CANON[k2]
    return None


def safe_strip(t):
    return t.strip(' \t\n\r\x0b\x0c')

def is_running_header_footer(text):
    t = safe_strip(text)
    if not t or len(t) > 60 or '\u2002' in text:
        return False
    if t.startswith(('◀', '◁')) or t.startswith('سؤال') or t.startswith('ســؤال'):
        return False
    if re.match(r'^\d{1,4}\s{2,}[\u0600-\u06FF].{0,50}$', t):
        return True
    if re.match(r'^[\u0600-\u06FF].{0,50}?\s{2,}\d{1,4}$', t):
        return True
    if re.match(r'^[\u0600-\u06FF ]{2,35}\s\d{1,3}$', t):
        return True
    return False

def is_orphan_diacritic(text):
    """A lone Arabic diacritic mark left over from a page-break artifact,
    with no independent meaning (e.g. a stray 'ً' by itself)."""
    t = safe_strip(text)
    return len(t) <= 2 and all(0x064B <= ord(c) <= 0x0652 for c in t) and bool(t)

def clean_table(tbl):
    header = [safe_strip(c.text) for c in tbl.rows[0].cells] if tbl.rows else []
    rows = [[safe_strip(c.text) for c in row.cells] for row in tbl.rows[1:]]
    rows = [r for r in rows if any(r)]
    return {'header': header, 'rows': rows}

def iter_block_items(doc):
    body = doc.element.body
    for child in body.iterchildren():
        if child.tag == qn('w:p'):
            yield ('p', Paragraph(child, doc))
        elif child.tag == qn('w:tbl'):
            yield ('t', Table(child, doc))

def read_raw_stream():
    doc = Document(SRC)
    raw = []
    for kind, it in iter_block_items(doc):
        if kind == 'p':
            txt = it.text
            if not safe_strip(txt):
                continue
            if safe_strip(txt) == 'المحتويات':
                break
            if is_running_header_footer(txt):
                continue
            if is_orphan_diacritic(txt):
                continue
            raw.append(('text', safe_strip(txt)))
        else:
            raw.append(('table', clean_table(it)))
    return raw


def split_internal_bullets(t):
    """A few paragraphs contain multiple \u2002-marked opinions glued together."""
    if '\u2002' not in t:
        return [t]
    parts = t.split('\u2002')
    out = []
    if parts[0].strip():
        out.append(parts[0])
    for p in parts[1:]:
        out.append('\u2002' + p)
    return out

def parens_balanced(t):
    """')' is the visual opener and '(' the visual closer in this source."""
    depth = 0
    for ch in t:
        if ch == ')':
            depth += 1
        elif ch == '(' and depth > 0:
            depth -= 1
    return depth == 0

def ends_terminal(t):
    t = t.rstrip()
    if not parens_balanced(t):
        return False
    return bool(re.search(r'[\.\(\)؟!]$', t)) or t.endswith('.J')

def starts_new_unit(t):
    if t.startswith('\u2002'):
        return True
    ts = t.lstrip(' \t\n\r\x0b\x0c')
    if ts.startswith(('◀', '◁')):
        return True
    if ts.startswith('سؤال') or ts.startswith('ســؤال'):
        return True
    if ts.startswith('جواب') or ts.startswith('جـواب'):
        return True
    if re.match(r'^-\d+\s', ts):
        return True
    if re.match(r'^\(\d+\s', ts):
        return True
    if re.match(r'^-\s*(هل|لو|ما|إذا)\b', ts):
        return True
    if ts.strip() == 'المحتويات':
        return True
    return False

def merge_stream(raw):
    raw2 = []
    for kind, val in raw:
        if kind == 'table':
            raw2.append(('table', val))
        else:
            for piece in split_internal_bullets(val):
                if piece.strip(' \t\n\r\x0b\x0c'):
                    raw2.append(('text', piece))
    merged = []
    for kind, val in raw2:
        if kind == 'table':
            merged.append(('table', val))
            continue
        if (merged and merged[-1][0] == 'text'
                and not starts_new_unit(val)
                and not ends_terminal(merged[-1][1])):
            merged[-1] = ('text', merged[-1][1].rstrip() + ' ' + val.lstrip(' \t\n\r\x0b\x0c'))
        else:
            merged.append(('text', val))
    return merged

SOURCE_PATCHES = [
    (
        'له حكم المبطون )الطواف والاستنابة( )الأحوط وجوباً )الحكيم( ويأتي بوضوء للطواف وآخر للصلاة: )الخميني، الحكيم.(',
        'له حكم المبطون )الطواف والاستنابة( )الأحوط وجوباً: الحكيم( ويأتي بوضوء للطواف وآخر للصلاة: )الخميني، الحكيم.(',
    ),
    (
        'الأحوط الجمعبين الوظيفتين الذبحفي محله والاستنابة: الخوئي( وإن كان الاظهر',
        'الأحوط الجمعبين الوظيفتين الذبحفي محله والاستنابة: )الخوئي( وإن كان الاظهر',
    ),
    (
        'من يبعد منزلــه أو حدود بلده )يحتاط إذا اختلفتا( عن المســجد الحرام أقل من 48 ميــلًا 86.400) كيلو متراً(\x00)زين الدين.(',
        'من يبعد منزلــه أو حدود بلده )يحتاط إذا اختلفتا( عن المســجد الحرام أقل من 48 ميــلًا 86.400 كيلو متراً )زين الدين.(',
    ),
]

GLUED_SECTION_TITLES = ['الملحق', 'جديد الطبعة الورقية 1445ه']

def split_glued_titles(merged):
    out = []
    for kind, val in merged:
        if kind == 'text':
            for title in GLUED_SECTION_TITLES:
                if val.startswith(title + ' ') and len(val) > len(title) + 1:
                    out.append(('text', title))
                    val = val[len(title):].lstrip()
                    break
        out.append((kind, val))
    return out

def apply_source_patches(merged):
    fixed = []
    i = 0
    while i < len(merged):
        kind, val = merged[i]
        if (kind == 'text' and val.rstrip().endswith('كيلو متراً(')
                and i + 1 < len(merged) and merged[i + 1][0] == 'text'
                and merged[i + 1][1].strip() == ')زين الدين.('):
            base = val.rstrip()[:-1]
            joined = base + '( )زين الدين.('
            fixed.append(('text', joined))
            i += 2
            continue
        fixed.append((kind, val))
        i += 1
    merged = fixed

    out = []
    for kind, val in merged:
        if kind == 'text':
            for old, new in SOURCE_PATCHES[:2]:
                if old in val:
                    val = val.replace(old, new)
        out.append((kind, val))
    return out


FRONT_MATTER_END_MARKER = 'ينقسم الحج إلى ثلاثة أنواع'

def drop_front_matter(merged):
    for i, (kind, val) in enumerate(merged):
        if kind == 'text' and FRONT_MATTER_END_MARKER in val:
            return merged[i:]
    return merged


def find_paren_groups(t):
    groups = []
    depth = 0
    start = None
    for i, ch in enumerate(t):
        if ch == ')':
            if depth == 0:
                start = i
            depth += 1
        elif ch == '(':
            if depth > 0:
                depth -= 1
                if depth == 0 and start is not None:
                    groups.append((start, i, t[start + 1:i]))
    return groups

def _try_name_list(fragment):
    parts = [p.strip(' .') for p in re.split('[،,]', fragment) if p.strip(' .')]
    if not parts:
        return None
    resolved = [resolve_name(p) for p in parts]
    if all(r is not None for r in resolved):
        return resolved
    return None

def try_resolve_group(content):
    content = content.strip(' .:')
    if not content:
        return None
    if ':' in content:
        left, right = content.split(':', 1)
        for side, other in [(right.strip(), left.strip()), (left.strip(), right.strip())]:
            names = _try_name_list(side)
            if names:
                return names, (other or None)
        return None
    names = _try_name_list(content)
    if names:
        return names, None
    return None

def parse_opinion_line(raw_bullet):
    text = raw_bullet[1:].strip()
    opens, closes = text.count(')'), text.count('(')
    unbalanced = opens != closes

    groups = find_paren_groups(text)
    attributions = []
    consumed = []
    for (s, e, content) in groups:
        res = try_resolve_group(content)
        if res:
            names, note = res
            attributions.append({'names': names, 'note': note, 'raw': content})
            consumed.append((s, e))

    base = text
    for (s, e) in sorted(consumed, reverse=True):
        base = base[:s] + base[e + 1:]

    tail = re.search(r'\(\s*([^()]{2,60})[\.\s]*$', base)
    if tail:
        names = _try_name_list(tail.group(1))
        if names:
            attributions.append({'names': names, 'note': None, 'raw': tail.group(1)})
            base = base[:tail.start()] + base[tail.end():]

    if ':' in base and not attributions:
        left, right = base.rsplit(':', 1)
        names = _try_name_list(right)
        if names:
            attributions.append({'names': names, 'note': None, 'raw': right.strip()})
            base = left

    base = re.sub(r'\s{2,}', ' ', base).strip(' ,،.')

    flag = None
    if unbalanced:
        flag = 'unbalanced_parens_review_needed'
    elif not attributions and any(resolve_name(w) for w in re.split('[،, ]', text) if len(w) > 2):
        flag = 'contains_name_token_but_unresolved'
    return base, attributions, flag

def parse_multi_opinion_cell(cell_text):
    """A table cell (kafara or wuquf) sometimes packs MULTIPLE distinct opinions
    with no \u2002 marker between them at all. Opinions are separated either by
    a literal newline (unless that newline falls mid name-list, i.e. right after
    an Arabic comma -- a wrapped line, not a new opinion), or by a period that
    closes a name-list and precedes a brand-new ruling clause."""
    RS = '\u241E'
    text = cell_text
    text = re.sub(r'،\s*\n\s*', '، ', text)
    text = re.sub(r':\s*\n\s*(?=[\u0600-\u06FF)])', ' \u241F ', text)
    text = text.replace('\n', ' ' + RS + ' ')
    text = re.sub(r'(?<=[\u0600-\u06FF])\.\s+(?=[\u0600-\u06FF])', ' ' + RS + ' ', text)
    text = text.replace('\u241F', ': ')
    pieces = [p.strip(' .') for p in text.split(RS) if p.strip(' .')]

    opinions = []
    for piece in pieces:
        base, attrs, flag = parse_opinion_line('\u2002' + piece)
        opinions.append({'text': base, 'attributions': attrs, 'flag': flag})
    return opinions


KNOWN_SUBHEADINGS = {
    'الاستطاعة', 'المواقيت', 'الإحرام', 'صلاة الطواف', 'السعي بين الصفا والمروة',
    'التقصير', 'بين العمرة والحج', 'أعمال الحج', 'الإحرام لحج التمتع',
    'الوقوف بعرفات', 'الوقوف بالمشعر )المزدلفة(', 'أعمال منى يوم العاشر', 'أعمال مكة',
    'المبيت بمنى ليلة الحادي عشر والثاني عشر',
    'رمي الجمرات الثلاث يوم الحادي عشر والثاني عشر', 'أحكام المصدود',
    'أحكام النساء في الحج والعمرة', 'الملحق', 'جديد الطبعة الورقية 1445ه',
    'جدول إدراك الوقوفين',
}

def classify_list_marker(ts):
    """Return the enumeration style for a line that opens a numbered/lettered
    list item, or None. Used to tag these for distinct color rendering."""
    if re.match(r'^-\d+\s', ts):
        return 'numbered'
    if re.match(r'^[أابتثجحخدذرزسشصضطظعغفقكلمنهوي]\s?[-\(]\s', ts):
        return 'lettered'
    if re.match(r'^-\s+\S', ts):
        return 'bulleted'
    return None

def is_bare_question(ts):
    """Lines like '- هل يجب...؟' -- appended-list questions with no explicit
    'سؤال:' marker (used in the closing 'الملحق: جديد الطبعة الورقية' section,
    where new questions were added without accompanying answers)."""
    return bool(re.match(r'^-\s*(هل|لو|ما|إذا)\b.*[؟\?]\s*$', ts))

def is_wuquf_fragment(tbl):
    WUQUF_HEADER_MARKERS = {'الحـــــكم', 'مزدلفة', 'عرفة'}
    hdr = tbl['header']
    return any(h.strip() in WUQUF_HEADER_MARKERS for h in hdr) or (
        len(hdr) == 3 and hdr[1].strip() in ('لم يدرك الموقف', 'أدرك الموقف الاختياري', 'أدرك الموقف الاضطراري')
    )

def rebuild_wuquf_table(fragments):
    """fragments: list of the raw table dicts (header treated as first data row)."""
    cells = []
    for tbl in fragments:
        cells.append(tbl['header'])
        cells.extend(tbl['rows'])
    rows = []
    for hukm, mazdalifa, arafa in cells[1:]:
        rows.append({'arafa': arafa.strip(), 'mazdalifa': mazdalifa.strip(),
                      'opinions': parse_multi_opinion_cell(hukm)})
    return {'title': 'جدول إدراك الوقوفين', 'kind': 'wuquf_matrix',
            'columns': ['عرفة', 'مزدلفة', 'الحكم'], 'rows': rows}

def rebuild_kafara_table(tbl):
    rows = []
    KAFARA_CELL_PATCHES = {
        'الاستغفار: السيد صادق(': 'الاستغفار: )السيد صادق(',
        'لو قبلها بشــهوة فعليــة بدنه وإن لم ينزل، وأما من غير شهوة فعليه شاة ))عى الأحوط: الحكيم( الخامنئي، الوحيد، الخميني(':
            'لو قبلها بشــهوة فعليــة بدنه وإن لم ينزل، وأما من غير شهوة فعليه شاة )الحكيم، الخامنئي، الوحيد، الخميني(',
        'كف مــن الطعام يتصــدق بها علىَ الفقير )العصفــور( علىَ الأحوط: )الســيد صادق، الخوئي، البشــير( )عى الأحوط الأولى )السيســتاني، الحكيم، الخميني(':
            'كف مــن الطعام يتصــدق بها علىَ الفقير )العصفــور( علىَ الأحوط: )الســيد صادق، الخوئي، البشــير( علىَ الأحوط الأولى )السيســتاني، الحكيم، الخميني(',
    }
    for row in tbl['rows']:
        kafara_cell, nou_cell = row[0], row[1]
        kafara_cell = KAFARA_CELL_PATCHES.get(kafara_cell, kafara_cell)
        rows.append({'category': nou_cell.strip(),
                      'opinions': parse_multi_opinion_cell(kafara_cell)})
    return {'title': 'جدول الكفارات', 'kind': 'kafara_table',
            'columns': ['النوع', 'الكفارة'], 'rows': rows}


def build():
    raw = read_raw_stream()
    merged = merge_stream(raw)
    merged = apply_source_patches(merged)
    merged = split_glued_titles(merged)
    merged = drop_front_matter(merged)

    doc = []
    i, n = 0, len(merged)
    wuquf_fragments = []
    wuquf_flushed = False

    while i < n:
        kind, val = merged[i]
        if kind == 'table':
            if is_wuquf_fragment(val):
                wuquf_fragments.append(val)
                i += 1
                continue
            else:
                doc.append({'type': 'table', 'data': rebuild_kafara_table(val)})
                i += 1
                continue
        if wuquf_fragments and not wuquf_flushed:
            doc.append({'type': 'table', 'data': rebuild_wuquf_table(wuquf_fragments)})
            wuquf_flushed = True

        t = val
        ts = t.lstrip()
        if ts.startswith(('◀', '◁')):
            doc.append({'type': 'heading', 'text': ts.lstrip('◀◁ ').strip()})
        elif ts.strip() in KNOWN_SUBHEADINGS:
            doc.append({'type': 'subheading', 'text': ts.strip()})
        elif ts.startswith('سؤال') or ts.startswith('ســؤال') or ts.startswith('ســؤاّل'):
            doc.append({'type': 'question', 'text': ts.strip()})
        elif ts.startswith('جواب') or ts.startswith('جـواب') or ts.startswith('الجــواب') or ts.startswith('الجواب'):
            doc.append({'type': 'answer', 'text': ts.strip()})
        elif re.match(r'^\(\d+\s', ts):
            doc.append({'type': 'subheading', 'text': ts.strip()})
        elif is_bare_question(ts):
            doc.append({'type': 'question', 'text': ts.strip()})
        elif (doc and doc[-1]['type'] == 'subheading' and ts.rstrip().endswith('؟')
              and not classify_list_marker(ts)):
            doc.append({'type': 'question', 'text': ts.strip()})
        elif (doc and doc[-1]['type'] in ('question', 'opinion')
              and not ts.startswith(('◀', '◁')) and ts.strip() not in KNOWN_SUBHEADINGS
              and not classify_list_marker(ts) and not re.match(r'^\(\d+\s', ts)
              and parse_opinion_line('\u2002' + t)[1]):
            base, attrs, flag = parse_opinion_line('\u2002' + t)
            doc.append({'type': 'opinion', 'text': base, 'attributions': attrs, 'flag': flag})
        elif classify_list_marker(ts):
            doc.append({'type': 'list_item', 'style': classify_list_marker(ts), 'text': ts.strip()})
        elif t.startswith('\u2002'):
            base, attrs, flag = parse_opinion_line(t)
            doc.append({'type': 'opinion', 'text': base, 'attributions': attrs, 'flag': flag})
        elif t.strip() == 'جدول الكفارات':
            pass
        else:
            doc.append({'type': 'note', 'text': t.strip()})
        i += 1

    if wuquf_fragments and not wuquf_flushed:
        doc.append({'type': 'table', 'data': rebuild_wuquf_table(wuquf_fragments)})

    return doc

if __name__ == '__main__':
    doc = build()
    from collections import Counter
    print('total items:', len(doc))
    print(Counter(item['type'] for item in doc))
    flagged = [it for it in doc if it.get('flag')]
    for item in doc:
        if item['type'] == 'table':
            for row in item['data']['rows']:
                for op in row.get('opinions', []):
                    if op.get('flag'):
                        flagged.append({'type': 'table_cell', 'flag': op['flag'], 'text': op['text']})
    print('flagged opinions needing review:', len(flagged))
    for it in flagged:
        print(' -', it['flag'], repr(it['text'][:100]))
    with open('thamra_final.json', 'w', encoding='utf-8') as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
