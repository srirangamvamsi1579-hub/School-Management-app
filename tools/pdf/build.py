import os
# -*- coding: utf-8 -*-
import sys
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle,
                                PageBreak, KeepTogether, Preformatted, NextPageTemplate, CondPageBreak)
from reportlab.platypus.tableofcontents import TableOfContents

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import content as C

FD = '/usr/share/fonts/truetype/dejavu/'
pdfmetrics.registerFont(TTFont('Sans', FD + 'DejaVuSans.ttf'))
pdfmetrics.registerFont(TTFont('Sans-Bold', FD + 'DejaVuSans-Bold.ttf'))
pdfmetrics.registerFont(TTFont('Cond', FD + 'DejaVuSansCondensed.ttf'))
pdfmetrics.registerFont(TTFont('Cond-Bold', FD + 'DejaVuSansCondensed-Bold.ttf'))
pdfmetrics.registerFont(TTFont('Mono', FD + 'DejaVuSansMono.ttf'))
from reportlab.pdfbase.pdfmetrics import registerFontFamily
registerFontFamily('Sans', normal='Sans', bold='Sans-Bold', italic='Sans', boldItalic='Sans-Bold')
registerFontFamily('Cond', normal='Cond', bold='Cond-Bold', italic='Cond', boldItalic='Cond-Bold')

INK = colors.HexColor('#14171C'); MUTED = colors.HexColor('#4B5260'); NAVY = colors.HexColor('#111827')
BLUE = colors.HexColor('#2147C7'); BLUE_T = colors.HexColor('#EEF2FF'); LINE = colors.HexColor('#D5DAE1')
ROW = colors.HexColor('#F5F6F8'); GREEN = colors.HexColor('#0F6B32'); GREEN_T = colors.HexColor('#E6F4EA')
ORANGE = colors.HexColor('#8A3B00'); ORANGE_T = colors.HexColor('#FFF1E0'); RED = colors.HexColor('#A11A12'); RED_T = colors.HexColor('#FDECEA')

S = {}
S['body'] = ParagraphStyle('body', fontName='Sans', fontSize=9.5, leading=14, textColor=INK, spaceAfter=6)
S['small'] = ParagraphStyle('small', parent=S['body'], fontSize=8.5, leading=12, textColor=MUTED)
S['h1'] = ParagraphStyle('h1', fontName='Sans-Bold', fontSize=20, leading=25, textColor=INK, spaceBefore=4, spaceAfter=10)
S['h2'] = ParagraphStyle('h2', fontName='Sans-Bold', fontSize=14, leading=18, textColor=INK, spaceBefore=10, spaceAfter=6)
S['h3'] = ParagraphStyle('h3', fontName='Sans-Bold', fontSize=11, leading=14, textColor=INK, spaceBefore=8, spaceAfter=2)
S['meta'] = ParagraphStyle('meta', fontName='Cond', fontSize=8.5, leading=11, textColor=MUTED, spaceAfter=4)
S['part'] = ParagraphStyle('part', fontName='Sans-Bold', fontSize=11, leading=14, textColor=BLUE, spaceAfter=2)
S['cell'] = ParagraphStyle('cell', fontName='Cond', fontSize=8, leading=10, textColor=INK)
S['cellb'] = ParagraphStyle('cellb', parent=S['cell'], fontName='Cond-Bold')
S['cellm'] = ParagraphStyle('cellm', parent=S['cell'], textColor=MUTED)
S['cellh'] = ParagraphStyle('cellh', parent=S['cell'], fontName='Cond-Bold', textColor=colors.white)
S['cellc'] = ParagraphStyle('cellc', parent=S['cell'], alignment=TA_CENTER)
S['cellhc'] = ParagraphStyle('cellhc', parent=S['cellh'], alignment=TA_CENTER, fontSize=7.2, leading=9)
S['bullet'] = ParagraphStyle('bullet', parent=S['body'], leftIndent=12, bulletIndent=2, spaceAfter=3)
S['mono'] = ParagraphStyle('mono', fontName='Mono', fontSize=7.4, leading=9.6, textColor=colors.HexColor('#E5E9F0'))

W = A4[0] - 36 * mm
BOX = '☐'


def P(t, s='cell'):
    return Paragraph(t, S[s])


def esc(t):
    return t.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def tbl(data, widths, header=True, zebra=True, extra=None):
    t = Table(data, colWidths=widths, repeatRows=1 if header else 0)
    st = [('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 4), ('RIGHTPADDING', (0, 0), (-1, -1), 4),
          ('TOPPADDING', (0, 0), (-1, -1), 3), ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
          ('LINEBELOW', (0, 0), (-1, -1), 0.4, LINE), ('BOX', (0, 0), (-1, -1), 0.6, LINE)]
    if header:
        st += [('BACKGROUND', (0, 0), (-1, 0), NAVY)]
    if zebra:
        for i in range(1 if header else 0, len(data)):
            if i % 2 == 0:
                st.append(('BACKGROUND', (0, i), (-1, i), ROW))
    if extra:
        st += extra
    t.setStyle(TableStyle(st))
    return t


class Doc(BaseDocTemplate):
    def __init__(self, fn, **kw):
        super().__init__(fn, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=20 * mm, bottomMargin=18 * mm,
                         title='School Management Platform — Menu, Screens & Onboarding Review',
                         author='[Your Company]', subject='Client review document', **kw)
        fr = Frame(self.leftMargin, self.bottomMargin, self.width, self.height, id='f')
        self.addPageTemplates([PageTemplate('cover', frames=[fr], onPage=cover_page),
                               PageTemplate('body', frames=[fr], onPage=body_page)])

    def afterFlowable(self, f):
        if isinstance(f, Paragraph):
            st = f.style.name
            if st in ('h1', 'h2'):
                lvl = 0 if st == 'h1' else 1
                key = 'h%d' % id(f)
                self.canv.bookmarkPage(key)
                self.notify('TOCEntry', (lvl, f.getPlainText(), self.page, key))
                self.canv.addOutlineEntry(f.getPlainText(), key, level=lvl, closed=(lvl == 1))


def cover_page(c, d):
    w, h = A4
    c.saveState()
    c.setFillColor(NAVY); c.rect(0, h - 120 * mm, w, 120 * mm, stroke=0, fill=1)
    c.setFillColor(BLUE); c.rect(18 * mm, h - 122 * mm, 40 * mm, 4 * mm, stroke=0, fill=1)
    c.setFillColor(colors.HexColor('#94A3B8')); c.setFont('Sans-Bold', 10)
    c.drawString(18 * mm, h - 30 * mm, 'CLIENT REVIEW · VERSION 1.0 · 17 NOVEMBER 2026')
    c.setFillColor(colors.white); c.setFont('Sans-Bold', 30)
    c.drawString(18 * mm, h - 52 * mm, 'School Management Platform')
    c.setFont('Sans', 17)
    c.drawString(18 * mm, h - 64 * mm, 'Menus, screens & fields — and how a new')
    c.drawString(18 * mm, h - 73 * mm, 'school is onboarded by configuration')
    c.setFont('Sans', 10.5); c.setFillColor(colors.HexColor('#CBD5E1'))
    c.drawString(18 * mm, h - 92 * mm, 'Please mark each item Keep, Change or Remove and add your comments.')
    c.drawString(18 * mm, h - 99 * mm, 'Your feedback decides what we build for go-live.')
    c.setFillColor(INK); c.setFont('Sans-Bold', 11)
    y = h - 145 * mm
    for k, v in [('Prepared for', '[CLIENT SCHOOL NAME]'), ('Prepared by', '[YOUR COMPANY]'), ('Reviewer', '______________________________'),
                 ('Review due by', '______________________________')]:
        c.setFont('Sans', 9.5); c.setFillColor(MUTED); c.drawString(18 * mm, y, k)
        c.setFont('Sans-Bold', 12); c.setFillColor(INK); c.drawString(60 * mm, y, v); y -= 11 * mm
    y -= 6 * mm
    c.setFont('Sans-Bold', 10); c.setFillColor(INK); c.drawString(18 * mm, y, 'What is inside'); y -= 7 * mm
    c.setFont('Sans', 9.5); c.setFillColor(MUTED)
    for line in ['Part A — Every menu, sub-menu and screen field, in the order users see them',
                 'Part B — Onboarding a new school: wizard, School Blueprint, import templates, checks, go-live',
                 'Sign-off page — overall decision and signatures']:
        c.drawString(22 * mm, y, '•  ' + line); y -= 6.5 * mm
    c.setFont('Sans', 8); c.setFillColor(MUTED)
    c.drawString(18 * mm, 14 * mm, 'Confidential — prepared for the named school. Sample names and figures are illustrative.')
    c.restoreState()


def body_page(c, d):
    c.saveState()
    c.setStrokeColor(LINE); c.setLineWidth(0.5)
    c.line(18 * mm, A4[1] - 13 * mm, A4[0] - 18 * mm, A4[1] - 13 * mm)
    c.setFont('Sans', 7.5); c.setFillColor(MUTED)
    c.drawString(18 * mm, A4[1] - 11 * mm, 'School Management Platform — client review v1.0')
    c.drawRightString(A4[0] - 18 * mm, A4[1] - 11 * mm, '[CLIENT SCHOOL NAME]')
    c.drawString(18 * mm, 10 * mm, 'Keep ☐   Change ☐   Remove ☐   — tick one per row; write details in the comment box')
    c.drawRightString(A4[0] - 18 * mm, 10 * mm, 'Page %d' % d.page)
    c.restoreState()


def plan_chip(rank):
    col = {1: (GREEN_T, GREEN), 2: (BLUE_T, BLUE), 3: (BLUE_T, BLUE), 4: (ORANGE_T, ORANGE)}[rank]
    return col


story = []
story.append(NextPageTemplate('body'))
story.append(PageBreak())

# ---- How to review + contents
story.append(Paragraph('How to review this document', S['h1']))
for t in [
    'This document lists everything the platform shows, in the order a user meets it: <b>menu → sub-menu → fields on each screen</b>.',
    'For every field, tick <b>Keep</b>, <b>Change</b> or <b>Remove</b>. Use the comment box under each screen for anything missing, '
    'renamed, or in the wrong order. Mark-ups on a printed copy or in a PDF reader both work.',
    'Each screen also shows <b>who uses it</b> and the <b>lowest plan that includes it</b>. Anything one plan up can be bought as an add-on.',
]:
    story.append(Paragraph(t, S['body']))
leg = [[P('Plan', 'cellh'), P('School size', 'cellh'), P('Shown in this document as', 'cellh')],
       [P('Starter'), P('Up to 250 students'), P('All plans')], [P('Growth'), P('251 – 500'), P('Growth+')],
       [P('Professional'), P('501 – 1,000'), P('Professional+')], [P('Enterprise'), P('1,000+'), P('Enterprise')]]
story.append(tbl(leg, [40 * mm, 50 * mm, W - 90 * mm]))
story.append(Spacer(1, 6))
fld = [[P('Field type', 'cellh'), P('Meaning', 'cellh')],
       [P('Column'), P('Shown in a list or table')], [P('Text / Number / Date / Amount'), P('Typed in by the user (Amount in ₹)')],
       [P('Select / Multi-select'), P('Picked from a list the school maintains')], [P('Auto'), P('Filled in by the system')],
       [P('Toggle'), P('On / off switch')], [P('Encrypted'), P('Stored encrypted; only permitted roles can see it')],
       [P('Report page'), P('A Power BI page inside the Insights tab')], [P('Req ✓'), P('Required before saving')]]
story.append(tbl(fld, [50 * mm, W - 50 * mm]))
story.append(PageBreak())

toc = TableOfContents()
toc.levelStyles = [ParagraphStyle('t0', fontName='Sans-Bold', fontSize=10, leading=15, leftIndent=0),
                   ParagraphStyle('t1', fontName='Sans', fontSize=9, leading=12.5, leftIndent=12, textColor=MUTED)]
story.append(Paragraph('Contents', S['h3']))
story.append(toc)
story.append(PageBreak())

# ---- PART A
story.append(Paragraph('PART A', S['part']))
story.append(Paragraph('A1. Menu map', S['h1']))
story.append(Paragraph('10 main menus. Insights tabs (Power BI) sit at the top of the menus that have data worth analysing.', S['body']))
rows = [[P('#', 'cellh'), P('Main menu', 'cellh'), P('Sub-menus (in order)', 'cellh'), P('Purpose', 'cellh')]]
for n, name, purpose, screens in C.MODULES:
    subs = ', '.join(s[0] for s in screens)
    rows.append([P(n), P('<b>%s</b>' % esc(name)), P(esc(subs)), P(esc(purpose), 'cellm')])
story.append(tbl(rows, [8 * mm, 26 * mm, 80 * mm, W - 114 * mm]))
story.append(Spacer(1, 8))
story.append(Paragraph('Platform Console (your provider’s team only)', S['h3']))
rows = [[P('Console menu', 'cellh'), P('What it does', 'cellh')]] + [[P('<b>%s</b>' % a), P(esc(b))] for a, b in C.CONSOLE]
story.append(tbl(rows, [40 * mm, W - 40 * mm]))

story.append(PageBreak())
story.append(Paragraph('A2. Who sees what', S['h1']))
story.append(Paragraph('Default access by role. The Admin can change any of these in Operations › Roles &amp; Permissions, and create custom roles (Professional+).', S['body']))
rows = [[P('Menu', 'cellh')] + [P(r, 'cellh') for r in C.ROLES]]
ext = []
for i, (m, cells) in enumerate(C.MATRIX, start=1):
    rr = [P('<b>%s</b>' % m)]
    for j, c in enumerate(cells, start=1):
        rr.append(P(esc(c), 'cellc'))
        if c == 'Full':
            ext.append(('BACKGROUND', (j, i), (j, i), BLUE_T))
        elif c == '—':
            ext.append(('TEXTCOLOR', (j, i), (j, i), MUTED))
    rows.append(rr)
story.append(tbl(rows, [28 * mm] + [(W - 28 * mm) / 6] * 6, zebra=False, extra=ext))
story.append(Spacer(1, 8))
cm = Table([[P('<b>Comments on menus and access</b>', 'cell')], [P('')]], colWidths=[W], rowHeights=[None, 30 * mm])
cm.setStyle(TableStyle([('BOX', (0, 0), (-1, -1), 0.6, LINE), ('BACKGROUND', (0, 0), (-1, 0), ROW)]))
story.append(cm)

story.append(PageBreak())
story.append(Paragraph('A3. Screens and fields', S['h1']))
story.append(Paragraph('Fields are listed top-to-bottom, left-to-right as they appear on screen. Sample data on the design canvas shows each screen filled in.', S['body']))

fw = [7 * mm, 42 * mm, 22 * mm, 8 * mm, W - 7 * mm - 42 * mm - 22 * mm - 8 * mm - 39 * mm, 13 * mm, 13 * mm, 13 * mm]
for n, name, purpose, screens in C.MODULES:
    story.append(CondPageBreak(60 * mm))
    story.append(Paragraph('%s. %s' % (n, esc(name)), S['h2']))
    story.append(Paragraph(esc(purpose), S['small']))
    for k, (sub, kind, who, rank, fields) in enumerate(screens, start=1):
        head = [Paragraph('%s.%d  %s › %s' % (n, k, esc(name), esc(sub)), S['h3']),
                Paragraph('<b>Screen:</b> %s &nbsp;·&nbsp; <b>Used by:</b> %s &nbsp;·&nbsp; <b>Plan:</b> %s' % (esc(kind), esc(who), C.PLAN[rank]), S['meta'])]
        data = [[P('#', 'cellh'), P('Field / column', 'cellh'), P('Type', 'cellh'), P('Req', 'cellh'), P('Notes', 'cellh'),
                 P('Keep', 'cellhc'), P('Change', 'cellhc'), P('Remove', 'cellhc')]]
        for i, (f, t, req, note) in enumerate(fields, start=1):
            data.append([P(str(i), 'cellm'), P(esc(f)), P(esc(t), 'cellm'), P('✓' if req else '', 'cellc'), P(esc(note), 'cellm'),
                         P(BOX, 'cellc'), P(BOX, 'cellc'), P(BOX, 'cellc')])
        data.append([P('<b>Comments / missing fields</b>'), '', '', '', '', '', '', ''])
        n_rows = len(data)
        t = Table(data, colWidths=fw, repeatRows=1, rowHeights=[None] * (n_rows - 1) + [16 * mm])
        st = [('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 3), ('RIGHTPADDING', (0, 0), (-1, -1), 3),
              ('TOPPADDING', (0, 0), (-1, -1), 2.5), ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
              ('BACKGROUND', (0, 0), (-1, 0), NAVY), ('LINEBELOW', (0, 0), (-1, -1), 0.4, LINE), ('BOX', (0, 0), (-1, -1), 0.6, LINE),
              ('SPAN', (0, n_rows - 1), (-1, n_rows - 1)), ('BACKGROUND', (5, 1), (-1, n_rows - 2), colors.HexColor('#FAFBFC'))]
        for i in range(2, n_rows - 1, 2):
            st.append(('BACKGROUND', (0, i), (4, i), ROW))
        t.setStyle(TableStyle(st))
        story.append(KeepTogether(head + [t]) if len(fields) <= 14 else KeepTogether(head))
        if len(fields) > 14:
            story.append(t)
        story.append(Spacer(1, 4))

# ---- PART B
story.append(PageBreak())
story.append(Paragraph('PART B', S['part']))
story.append(Paragraph('B1. Onboarding a new school by configuration', S['h1']))
story.append(Paragraph(
    'A new school is set up the way cloud platforms such as AWS set up a new account: from a <b>template</b>, through a <b>wizard</b>, '
    'with a <b>preview before anything changes</b>, first in <b>pre-production</b> and then promoted to <b>production</b> on approval. '
    'There is no custom code per school — every difference is configuration.', S['body']))
rows = [[P('Cloud idea', 'cellh'), P('In this platform', 'cellh'), P('What it means for the school', 'cellh')]]
rows += [[P(esc(a), 'cellm'), P('<b>%s</b>' % esc(b)), P(esc(c))] for a, b, c in C.AWS_MAP]
story.append(tbl(rows, [42 * mm, 36 * mm, W - 78 * mm]))
story.append(Spacer(1, 8))
cm = Table([[P('<b>Comments on the approach</b>')], [P('')]], colWidths=[W], rowHeights=[None, 22 * mm])
cm.setStyle(TableStyle([('BOX', (0, 0), (-1, -1), 0.6, LINE), ('BACKGROUND', (0, 0), (-1, 0), ROW)]))
story.append(cm)

story.append(PageBreak())
story.append(Paragraph('B2. Onboarding stages', S['h1']))
rows = [[P('#', 'cellh'), P('Stage', 'cellh'), P('Who', 'cellh'), P('What happens', 'cellh'), P('Output', 'cellh'), P('Typical time', 'cellh')]]
rows += [[P(a), P('<b>%s</b>' % esc(b)), P(esc(c), 'cellm'), P(esc(d)), P(esc(e)), P(esc(f), 'cellm')] for a, b, c, d, e, f in C.STAGES]
story.append(tbl(rows, [7 * mm, 22 * mm, 30 * mm, 60 * mm, 32 * mm, W - 151 * mm]))
story.append(Spacer(1, 6))
story.append(Paragraph('Stages 2–6 happen in <b>pre-production</b>. Nothing reaches production until the Principal approves at stage 7, '
                       'and the same configuration is then applied to production — so what was tested is exactly what goes live.', S['small']))
story.append(Spacer(1, 6))
story.append(Paragraph('Timeline by plan', S['h3']))
rows = [[P('Plan', 'cellh'), P('Students', 'cellh'), P('Set-up approach', 'cellh'), P('Typical onboarding', 'cellh')]]
rows += [[P('<b>%s</b>' % a), P(b), P(esc(c)), P(d)] for a, b, c, d in C.TIMELINE]
story.append(tbl(rows, [30 * mm, 28 * mm, 80 * mm, W - 138 * mm]))
story.append(Paragraph('Times assume the school’s data is available in Excel and staff are free for the test stage.', S['small']))

story.append(PageBreak())
story.append(Paragraph('B3. The School Blueprint (configuration as a template)', S['h1']))
story.append(Paragraph('The wizard writes this file for you; larger schools can also edit it directly. One Blueprint describes the plan, academics, '
                       'fees, roles, appearance and data imports. It is versioned, so every change is tracked and can be undone.', S['body']))
pre = Preformatted(C.BLUEPRINT, S['mono'])
bx = Table([[pre]], colWidths=[W])
bx.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), NAVY), ('LEFTPADDING', (0, 0), (-1, -1), 10), ('TOPPADDING', (0, 0), (-1, -1), 8),
                        ('BOTTOMPADDING', (0, 0), (-1, -1), 8)]))
story.append(bx)
story.append(Spacer(1, 8))
story.append(Paragraph('What happens to a Blueprint', S['h3']))
rows = [[P('Step', 'cellh'), P('Result', 'cellh')]] + [[P('<b>%s</b>' % a), P(esc(b))] for a, b in C.BLUEPRINT_STEPS]
story.append(tbl(rows, [40 * mm, W - 40 * mm]))

story.append(PageBreak())
story.append(Paragraph('B4. Data import templates', S['h1']))
story.append(Paragraph('Excel templates are downloaded from the onboarding wizard, already filled with the school’s classes and fee heads. '
                       'Files load in the order shown; each one can only refer to things created by an earlier file.', S['body']))
order = Table([[P('<b>%s</b>' % f.split('_', 1)[0], 'cellc') for f, _, _, _ in C.IMPORTS]], colWidths=[W / len(C.IMPORTS)] * len(C.IMPORTS))
order.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), BLUE_T), ('BOX', (0, 0), (-1, -1), 0.6, LINE), ('INNERGRID', (0, 0), (-1, -1), 0.6, colors.white)]))
story.append(order)
story.append(Paragraph('Load order: 01 classes → 02 staff → 03 students → 04 fee structure → 05 opening dues → 06 salaries → 07 opening balances → 08 question bank (optional)', S['small']))
for f, purpose, dep, cols in C.IMPORTS:
    rows = [[P('Column', 'cellh'), P('Req', 'cellh'), P('Format / rule', 'cellh'), P('Example', 'cellh')]]
    rows += [[P('<font name="Mono" size="7.5">%s</font>' % esc(a)), P('✓' if b else '', 'cellc'), P(esc(c)), P(esc(d), 'cellm')] for a, b, c, d in cols]
    story.append(KeepTogether([Paragraph(esc(f), S['h3']),
                               Paragraph('<b>Holds:</b> %s &nbsp;·&nbsp; <b>Needs first:</b> %s' % (esc(purpose), esc(dep)), S['meta']),
                               tbl(rows, [52 * mm, 10 * mm, 76 * mm, W - 138 * mm]), Spacer(1, 4)]))

story.append(PageBreak())
story.append(Paragraph('B5. Checks on every import', S['h1']))
rows = [[P('Check', 'cellh'), P('What it catches', 'cellh')]] + [[P('<b>%s</b>' % a), P(esc(b))] for a, b in C.CHECKS]
story.append(tbl(rows, [32 * mm, W - 32 * mm]))
story.append(Spacer(1, 8))
story.append(Paragraph('Sample error report (downloadable as Excel)', S['h3']))
story.append(Paragraph('Nothing is saved until a file has no errors. The school fixes the rows and uploads again; warnings can be accepted.', S['small']))
rows = [[P(h, 'cellh') for h in ['File', 'Row', 'Column', 'Value', 'Problem', 'How to fix']]]
rows += [[P(a), P(b), P('<font name="Mono" size="7">%s</font>' % esc(c)), P(esc(d)), P(esc(e)), P(esc(f), 'cellm')] for a, b, c, d, e, f in C.ERRORS]
story.append(tbl(rows, [30 * mm, 10 * mm, 26 * mm, 24 * mm, 42 * mm, W - 132 * mm], extra=[('TEXTCOLOR', (4, 1), (4, -1), RED)]))
story.append(Spacer(1, 8))
story.append(Paragraph('Reconciliation before go-live', S['h3']))
for t in ['Students per class and section match the school’s register.',
          'Total opening fee dues match the old system, student by student for the top 20 balances.',
          'Opening bank and cash balances match the bank statement and cash book on the cut-over date.',
          'Staff count and monthly payroll total match last month’s salary sheet.']:
    story.append(Paragraph(t, S['bullet'], bulletText='•'))

story.append(PageBreak())
story.append(Paragraph('B6. Who does what', S['h1']))
rows = [[P('Task', 'cellh'), P('School', 'cellh'), P('Provider', 'cellh')]] + [[P('<b>%s</b>' % esc(a)), P(esc(b)), P(esc(c))] for a, b, c in C.RACI]
story.append(tbl(rows, [55 * mm, 55 * mm, W - 110 * mm]))
story.append(Spacer(1, 8))
story.append(Paragraph('B7. Go-live checklist', S['h1']))
rows = [[P('Done', 'cellh'), P('Item', 'cellh'), P('Checked by', 'cellh')]] + [[P(BOX, 'cellc'), P(esc(g)), P('')] for g in C.GOLIVE]
story.append(tbl(rows, [14 * mm, W - 54 * mm, 40 * mm]))
story.append(Spacer(1, 8))
story.append(Paragraph('B8. Data protection', S['h2']))
for t in ['Each school’s data is separated by a school ID enforced in the database itself, not just in screens; Enterprise schools can have their own database.',
          'Data stays in the chosen AWS region. Bank account and tax ID numbers are encrypted; documents are stored encrypted.',
          'Designed to support India’s Digital Personal Data Protection Act, 2023 — for example, recording verifiable parental consent before processing a child’s personal data.',
          'Every sign-in, change, import, download and print is logged with who and when.']:
    story.append(Paragraph(t, S['bullet'], bulletText='•'))

# ---- Sign-off
story.append(PageBreak())
story.append(Paragraph('Review sign-off', S['h1']))
story.append(Paragraph('Overall decision', S['h3']))
rows = [[P(BOX + '  Approved as is', 'cell'), P(BOX + '  Approved with the changes marked', 'cell'), P(BOX + '  Needs another review', 'cell')]]
t = Table(rows, colWidths=[W / 3] * 3); t.setStyle(TableStyle([('BOX', (0, 0), (-1, -1), 0.6, LINE), ('INNERGRID', (0, 0), (-1, -1), 0.6, LINE),
                                                               ('TOPPADDING', (0, 0), (-1, -1), 8), ('BOTTOMPADDING', (0, 0), (-1, -1), 8)]))
story.append(t)
story.append(Spacer(1, 10))
story.append(Paragraph('Top priorities for go-live (in order)', S['h3']))
rows = [[P('#', 'cellh'), P('Change requested', 'cellh'), P('Screen / section', 'cellh')]] + [[P(str(i)), P(''), P('')] for i in range(1, 7)]
t = tbl(rows, [10 * mm, W - 60 * mm, 50 * mm], zebra=False)
t._argH = [None] + [10 * mm] * 6
story.append(t)
story.append(Spacer(1, 10))
story.append(Paragraph('Preferred plan and add-ons', S['h3']))
rows = [[P(BOX + '  Starter'), P(BOX + '  Growth'), P(BOX + '  Professional'), P(BOX + '  Enterprise')],
        [P('Add-ons: ______________________________________________________________________________'), '', '', '']]
t = Table(rows, colWidths=[W / 4] * 4); t.setStyle(TableStyle([('BOX', (0, 0), (-1, -1), 0.6, LINE), ('SPAN', (0, 1), (-1, 1)),
                                                               ('TOPPADDING', (0, 0), (-1, -1), 8), ('BOTTOMPADDING', (0, 0), (-1, -1), 8)]))
story.append(t)
story.append(Spacer(1, 14))
rows = [[P('<b>For the school</b>'), P('<b>For the provider</b>')],
        [P('Name: ________________________________'), P('Name: ________________________________')],
        [P('Role: ________________________________'), P('Role: ________________________________')],
        [P('Signature: ____________________________'), P('Signature: ____________________________')],
        [P('Date: _________________________________'), P('Date: _________________________________')]]
t = Table(rows, colWidths=[W / 2] * 2); t.setStyle(TableStyle([('BOX', (0, 0), (-1, -1), 0.6, LINE), ('LINEAFTER', (0, 0), (0, -1), 0.6, LINE),
                                                               ('TOPPADDING', (0, 0), (-1, -1), 9), ('BACKGROUND', (0, 0), (-1, 0), ROW)]))
story.append(t)

out = sys.argv[1] if len(sys.argv) > 1 else 'School_Platform_Client_Review.pdf'
Doc(out).multiBuild(story)
print('ok', out)
