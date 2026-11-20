# Merge logic + browser results, add failure analysis, write qa/QA_test_cases.xlsx and qa/summary.json
import json
from collections import Counter, OrderedDict
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter

L = json.load(open('qa/results-logic.json'))
U = json.load(open('qa/results-ui.json'))
cases = [dict(c, layer='Business logic') for c in L['cases']] + [dict(c, layer='Browser (UI)') for c in U['cases']]

# Findings: (severity, title, likely cause, suggested fix, failed case ids)
F = OrderedDict()
F['F01'] = ('High', 'Add-on-only menus show in existing schools on the older app plans',
  "Existing schools (Sunrise = Starter app plan, St. Mary's = Pro) are gated by plan rank. Dashboard, the three desks, Transport, Web & App Screens, Templates, Appearance and Timings have rank 1, so every plan gets them. Only demo and client schools use the add-on rules.",
  'Store tier + bought add-ons on every school and derive menu switches from them with the same function demo/client schools use; migrate seed schools by mapping app plan to tier.',
  ['PLAN-T2-Dashboard','PLAN-T2-CoordinatorDes','PLAN-T2-GateDesk','PLAN-T2-ParentMeetings','PLAN-T2-TransportRoute','PLAN-T2-WebAppScreens','PLAN-T2-Templates','PLAN-T2-AppearanceBran','PLAN-T2-Timings','PLAN-T3-TransportRoute','PLAN-T3-WebAppScreens','PLAN-T3-Timings','UI-TIER-T2-Admin'])
F['F02'] = ('High', 'Admission numbers and student IDs can repeat',
  'admitStudent numbers new students from students.length + 1. After any student record is removed (for example an import rollback), the next admission gets a number already in use.',
  'Number from a sequence counter (db.seq.admission) that never goes back; add a unique check (database already has a unique key, so the API would error).',
  ['STU_ADMIT-04'])
F['F03'] = ('Medium', 'No duplicate check for admissions and enquiries',
  'Neither the New Admission form nor admitStudent/addEnquiry look for the same child (name + date of birth + guardian mobile).',
  'Before saving, look for a match and show “Possible duplicate: <name, ADM no.> — save anyway?”; same for enquiries by child name + parent mobile + grade.',
  ['STU_ADMIT-02','UI-STU_ADMIT-12','STU_ADMISSIONS-03'])
F['F04'] = ('Medium', 'Staff short code can duplicate an existing one',
  'StaffForm checks mobile/email duplicates but not the timetable short code, which the timetable clash check relies on.',
  'Refuse a short code already used by another active staff member (case-insensitive).',
  ['UI-STF_LIST-03'])
F['F05'] = ('Medium', 'Dates are not checked for plausibility',
  'Date fields check only presence. Date of birth can be in the future or give an age that does not fit the class; joining date can be 2099; portfolio dates can be in the future or impossible (2026-13-45).',
  'Date of birth: not in the future, age 2.5–20 and within ±2 years of the class’s usual age (warn, not block, outside that). Joining date: not more than 6 months ahead. Portfolio date: real date, not in the future.',
  ['STU_ADMIT-03','UI-STU_ADMIT-09','UI-STU_ADMIT-10','STU_ADMISSIONS-06','UI-STU_ADMISSIONS-06','UI-STF_LIST-06','STU_PORTFOLIO-03','STU_PORTFOLIO-04','CMP_EVENTS-05'])
F['F06'] = ('Medium', 'Names made of spaces (or digits and symbols) are accepted',
  'Required checks test `!f.first`, so "   " passes. Add user then creates an account whose name is blank after trimming.',
  'Trim before the required check; names allow letters, spaces and . \' - only (any script).',
  ['UI-STU_ADMIT-07','UI-STU_ADMISSIONS-05','UI-OPS_USERS-05','UI-STU_ADMIT-08'])
F['F07'] = ('Medium', 'Negative or unrealistic numbers are accepted',
  'Question marks have no lower bound (−2 saved, which breaks paper totals); Payment Matching “Add” only checks that amount is filled (−₹500 allowed); basic pay has no upper bound.',
  'Marks 1–20 whole numbers; incoming payment amount > 0; basic pay ≤ ₹10,00,000 a month with a confirm above ₹3,00,000.',
  ['UI-EXM_QB-02','UI-FEE_MATCHING-01','UI-STF_LIST-05'])
F['F08'] = ('Medium', 'A parent request can be saved for a child who is not theirs (business layer)',
  'submitRequest does not check that the student is one of the signed-in parent’s children; only the screen limits the choice.',
  'In submitRequest (and the API), refuse unless studentId is in user.children.',
  ['SELF_REQ-05'])
F['F09'] = ('Low', 'Business rules live only in the screens',
  'recordPayment accepts 0, negative or text amounts and UPI without a reference; addEnquiry accepts a blank name/mobile; proposals save a malformed contact email. The forms block these, but imports, the public form and the future API call the same functions.',
  'Move each form rule into the matching lib function (one source of truth) and keep the form check for instant feedback.',
  ['FEE_COLLECT-02','FEE_COLLECT-03','FEE_COLLECT-04','STU_ADMISSIONS-02','SP_PROPOSAL-07'])
F['F10'] = ('Low', 'Duplicates allowed for events, library books and curriculum units',
  'addEvent, addBook and addUnit do not look for the same title on the same date / author / class+subject.',
  'Warn “already exists — add copies instead?” for books; refuse identical unit names in one class+subject; warn for same event title on the same date.',
  ['CMP_EVENTS-07','CMP_LIBRARY-03','ACA_CURRICULUM-05'])
F['F11'] = ('Low', 'Small validation gaps',
  'Homework subject not required; an online class can be booked today at a time already past; library copies 2.5 accepted; curriculum periods 2.6 silently saved as 3; expense 12.345 is shown as “Twelve only”.',
  'Require subject; refuse past times today; copies whole numbers; round periods/amounts and show the corrected value before saving.',
  ['CMP_HOMEWORK-04','CMP_CLASSES-08','CMP_LIBRARY-02','ACA_CURRICULUM-03','UI-ACC_EXP-01'])
F['F12'] = ('Low', 'Mobile numbers typed with +91 or spaces are refused (or cut off)',
  'Admission mobile has maxLength 10, so “+91 98450 12399” is cut to “+91 98450 ” and refused; the pickup list refuses it outright. The sign-in field already normalises the same input.',
  'Proposed auto-correction (needs your approval): strip spaces, dashes and a leading +91/0, show “Saved as 9845012399”.',
  ['UI-STU_ADMIT-11','SELF_REQ-PICKUP-04'])
F['F13'] = ('Low', 'Needs decision: Accountant can open Student Profile',
  'The seeded department “Accounts & Finance” includes Student Profile (guardian contacts, attendance, marks), wider than the Accountant role list.',
  'If not intended, remove STU_PROFILE from that department, or give Accountant a fees-only student view.',
  ['ACC-ACCOUNTANT-X-STU_PROFILE'])
F['F14'] = ('Low', 'Needs decision: Custom roles are on for every tier',
  'demoConfig always switches on FN_CUSTOM_ROLES, which the older app plans gave only from Pro+.',
  'Decide whether custom roles are a basic feature, part of Pro+, or a paid add-on; then set it in the rate card.',
  ['TIER-STARTER-CustomRoles'])
# ---------------------------------------------------------------- workbook
wb = Workbook()
H = Font(bold=True, color='FFFFFF'); HF = PatternFill('solid', fgColor='1F4E79')
def sheet(ws, headers, rows, widths):
    ws.append(headers)
    for c in ws[1]: c.font = H; c.fill = HF; c.alignment = Alignment(vertical='top', wrap_text=True)
    for r in rows: ws.append(r)
    for i, w in enumerate(widths, 1): ws.column_dimensions[get_column_letter(i)].width = w
    for row in ws.iter_rows(min_row=2):
        for c in row: c.alignment = Alignment(vertical='top', wrap_text=True)
    ws.freeze_panes = 'A2'; ws.auto_filter.ref = ws.dimensions

owner = {i: k for k, v in F.items() for i in v[4]}
for c in cases:
    if c['status'] == 'Fail':
        k = owner.get(c['id'])
        if not k: raise SystemExit('Unmapped failure ' + c['id'])
        sev, title, cause, fix, _ = F[k]
        c.update(finding=k, severity=sev, cause=cause, fix=fix)
mapped = {i for v in F.values() for i in v[4]}
RETEST = __import__('os').environ.get('RETEST') == '1'
if not RETEST:
    missing = mapped - {c['id'] for c in cases if c['status'] == 'Fail'}
    if missing: raise SystemExit('Finding lists a passing case: ' + ', '.join(sorted(missing)))
else:
    # Release 15 retest: the first run failed exactly the cases listed under the findings
    for c in cases: c['first'] = 'Fail' if c['id'] in mapped else 'Pass'
    status = {k: ('Fixed' if all(next(x for x in cases if x['id'] == i)['status'] == 'Pass' for i in v[4]) else 'Open — needs your decision') for k, v in F.items()}
    wb = Workbook(); ws = wb.active; ws.title = 'Retest summary'
    tot = Counter(c['status'] for c in cases)
    ws.append(['Retest after release 15 fixes — 20 Nov 2026']); ws['A1'].font = Font(bold=True, size=13); ws.append([])
    ws.append(['Test cases', len(cases)]); ws.append(['Passed (first run → retest)', f"{sum(c['first']=='Pass' for c in cases)} → {tot['Pass']}"]); ws.append(['Failed (first run → retest)', f"{sum(c['first']=='Fail' for c in cases)} → {tot['Fail']}"])
    ws.append([]); ws.append(['Finding', 'Severity', 'Finding title', 'Status', 'Failed cases (first run)', 'Fix applied']); [setattr(x, 'font', Font(bold=True)) for x in ws[ws.max_row]]
    for k, v in F.items(): ws.append([k, v[0], v[1], status[k], len(v[4]), v[3] if status[k] == 'Fixed' else 'Not changed — waiting for your decision'])
    for col, w in zip('ABCDEF', [10, 10, 52, 24, 12, 70]): ws.column_dimensions[col].width = w
    for row in ws.iter_rows(min_row=8):
        for x in row: x.alignment = Alignment(vertical='top', wrap_text=True)
    ws2 = wb.create_sheet('Retest cases')
    rows = [[c['id'], c['first'], c['status'], owner.get(c['id'], ''), c.get('module', ''), c.get('menu', ''), c.get('title', ''), c.get('expected', ''), c.get('actual', '')] for c in cases if c['id'] in mapped]
    rows.sort(key=lambda r: (r[3], r[0]))
    sheet(ws2, ['Test case ID', 'First run', 'Retest', 'Finding', 'Module', 'Menu', 'Title', 'Expected', 'Actual (retest)'], rows, [26, 10, 10, 9, 16, 22, 42, 40, 44])
    red = PatternFill('solid', fgColor='F8D7DA'); green = PatternFill('solid', fgColor='D4EDDA')
    for row in ws2.iter_rows(min_row=2): row[2].fill = red if row[2].value == 'Fail' else green
    wb.save('qa/QA_retest.xlsx')
    json.dump({'total': len(cases), 'pass': tot['Pass'], 'fail': tot['Fail'], 'status': status}, open('qa/retest.json', 'w'), indent=1)
    print('retest', len(cases), dict(tot), status); raise SystemExit

# 1 Summary on top
ws = wb.active; ws.title = 'Summary'
tot = Counter(c['status'] for c in cases)
ws.append(['QA cycle — school management app, run 20 Nov 2026 (file upload excluded)']); ws['A1'].font = Font(bold=True, size=13)
ws.append([])
ws.append(['Test cases', len(cases)]); ws.append(['Passed', tot['Pass']]); ws.append(['Failed', tot['Fail']])
ws.append(['Findings (grouped failures)', len(F)])
ws.append([])
ws.append(['Area', 'Cases', 'Passed', 'Failed']); [setattr(c, 'font', Font(bold=True)) for c in ws[ws.max_row]]
by = OrderedDict()
for c in cases: by.setdefault(c['suite'] if c['suite'] != 'UI' else 'Browser: ' + c.get('category', ''), []).append(c)
for k, v in by.items(): ws.append([k, len(v), sum(x['status'] == 'Pass' for x in v), sum(x['status'] == 'Fail' for x in v)])
ws.append([])
ws.append(['Severity', 'Findings', 'Failed cases']); [setattr(c, 'font', Font(bold=True)) for c in ws[ws.max_row]]
for s in ['High', 'Medium', 'Low']:
    ks = [k for k, v in F.items() if v[0] == s]; ws.append([s, len(ks), sum(len(F[k][4]) for k in ks)])
ws.column_dimensions['A'].width = 46; ws.column_dimensions['B'].width = 12; ws.column_dimensions['C'].width = 12; ws.column_dimensions['D'].width = 12

# 2 Failures
ws = wb.create_sheet('Failures')
sevord = {'High': 0, 'Medium': 1, 'Low': 2}
fl = sorted([c for c in cases if c['status'] == 'Fail'], key=lambda c: (sevord[c['severity']], c['finding'], c['id']))
sheet(ws, ['Finding', 'Severity', 'Test case ID', 'Menu / module', 'Expected', 'Actual', 'Likely cause', 'Suggested fix'],
      [[c['finding'], c['severity'], c['id'], f"{c.get('module','')} › {c.get('menu','')}", c.get('expected', ''), c.get('actual', ''), c['cause'], c['fix']] for c in fl],
      [9, 9, 26, 30, 36, 40, 50, 50])

# 3 All test cases
ws = wb.create_sheet('Test cases')
sheet(ws, ['Test case ID', 'Result', 'Severity', 'Type', 'Category', 'Module', 'Menu', 'Feature', 'Tier', 'Add-on', 'Role', 'Title', 'Steps', 'Expected', 'Actual', 'Layer', 'Finding'],
      [[c['id'], c['status'], c.get('severity', ''), c.get('type', ''), c.get('category', ''), c.get('module', ''), c.get('menu', ''), c.get('feature', ''), c.get('tier', ''), c.get('addon', ''), c.get('role', ''), c.get('title', ''), c.get('steps', ''), c.get('expected', ''), c.get('actual', ''), c['layer'], c.get('finding', '')] for c in cases],
      [26, 8, 9, 9, 18, 16, 22, 20, 14, 12, 18, 42, 40, 36, 40, 13, 8])
red = PatternFill('solid', fgColor='F8D7DA'); green = PatternFill('solid', fgColor='D4EDDA')
for row in ws.iter_rows(min_row=2):
    row[1].fill = red if row[1].value == 'Fail' else green

# 4 Role access (what each role sees on Green Valley, Pro+ app plan)
ws = wb.create_sheet('Role access')
rows = []
menus = U['menusByRole']
for r in L['roleRows']:
    ui = menus.get(r['role'].replace(' (our company)', ''), {})
    rows.append([r['role'], ', '.join(r['modules']), r['count'], '; '.join(r['screens']), '; '.join(r['hidden']), ', '.join(r['readOnly']) or 'none',
                 'Not in menu; direct link opens Main menu with “… is not available for your account”', ', '.join(ui.keys()) if ui else '—'])
sheet(ws, ['Role', 'Visible menus', 'Screens', 'Visible menus › sub-menus (allowed actions follow the screen)', 'Hidden menus › sub-menus', 'Read-only screens', 'On an unauthorized attempt', 'Menus seen in the browser (Main menu)'],
      rows, [24, 40, 9, 70, 70, 16, 34, 40])

# 5 Add-on matrix
ws = wb.create_sheet('Tier & add-on matrix')
addon_rows = [c for c in cases if c['suite'] == 'Tier & add-on' and (c['id'].startswith('TIER-') or c['id'].startswith('ADDON-')) and c.get('feature') not in ('Basic features in every tier', 'Paid add-ons not given free', 'Custom roles', 'Dashboard')]
feat = OrderedDict()
for c in addon_rows:
    t = 'Starter + add-on' if c['id'].startswith('ADDON-') else c['tier']
    feat.setdefault(c['feature'], {})[t] = ('Visible' if c['type'] == 'Positive' else 'Hidden') + (' ✓' if c['status'] == 'Pass' else ' ✗ FAIL')
cols = ['Starter', 'Pro', 'Pro+', 'Starter + add-on']
sheet(ws, ['Add-on-only feature'] + [f'{c} (expected → result)' for c in cols], [[k] + [v.get(c, '') for c in cols] for k, v in feat.items()], [30, 22, 22, 22, 26])

wb.save('qa/QA_test_cases.xlsx')
json.dump({'total': len(cases), 'pass': tot['Pass'], 'fail': tot['Fail'], 'findings': {k: {'severity': v[0], 'title': v[1], 'cause': v[2], 'fix': v[3], 'cases': v[4]} for k, v in F.items()},
           'byArea': {k: [len(v), sum(x['status'] == 'Pass' for x in v)] for k, v in by.items()}}, open('qa/summary.json', 'w'), indent=1)
print(len(cases), dict(tot), 'findings', len(F))
