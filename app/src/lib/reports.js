// Release 15.1: Data Analytics reports (Power BI-style). Every analytic, report, chart and trend now lives in the Data
// Analytics menu; the operational menus keep only the working counts. Each report is a definition: the facts it is built
// from, the dimensions it can be cut and drilled by, the measures, the visual, the filters it takes and who may see it.
// In production each one is a Power BI page on the matching dataset view, with the same role-based row filters.
import { EXAMS, examPct, subjectsOf, gradeOf } from './results.js';
import { studentMark, staffMark, days, isSchoolDay, yearStartOf } from './attendance.js';
import { gross } from './dashboard.js';
import { classLabel, classOf, fullName, balance } from './logic.js';
import { stockOf } from './campus.js';
import { coverage } from './release14.js';
import { ADM_STATUSES } from '../data/seed2.js';

const todayIso = () => new Date().toISOString().slice(0, 10);
const r1 = (n) => Math.round(n * 10) / 10;
const pctOf = (a, b) => (b ? r1((100 * a) / b) : 0);
const month = (iso) => String(iso || '').slice(0, 7);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const monthLabel = (ym) => (ym && ym.length === 7 ? `${MONTHS[+ym.slice(5) - 1]} ${ym.slice(2, 4)}` : ym);
const sum = (l, f) => l.reduce((a, x) => a + (+f(x) || 0), 0);
const avg = (l, f) => (l.length ? r1(sum(l, f) / l.length) : 0);
const median = (arr) => { const a = [...arr].sort((x, y) => x - y); if (!a.length) return 0; const m = Math.floor(a.length / 2); return r1(a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2); };
const weekOf = (iso) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
const grade = (db, s) => classOf(db, s)?.name || '—';
const section = (db, s) => classLabel(db, s) || '—';
const teachersIn = (db, cell) => String(cell || '').split(/\s+/).slice(1).join(' ').split('/').map((t) => t.trim()).map((t) => db.staff.find((x) => x.short && x.short.toUpperCase() === t.toUpperCase())).filter(Boolean);

// ---------- Filters shared by every report (each report says which it uses) ----------
export const FILTERS = {
  dates: { label: 'Date range' }, year: { label: 'Academic year' }, classId: { label: 'Class' }, sectionId: { label: 'Section' }, studentId: { label: 'Student' },
  staffId: { label: 'Staff' }, subject: { label: 'Subject' }, feeHead: { label: 'Fee type' }, status: { label: 'Status' }, exam: { label: 'Exam' }, exam2: { label: 'Compare with' }
};
export const defaultFilters = (db) => ({ from: yearStartOf(db), to: todayIso(), year: db.year || '2026-27', classId: '', sectionId: '', studentId: '', staffId: '', subject: '', feeHead: '', status: '', exam: 'T1', exam2: 'T2' });

// Who the person is, for row-level filters: a teacher sees only their own sections; a parent sees no analytics
export function scopeFor(db, session) {
  const user = db.users.find((u) => u.id === session?.userId) || {};
  if (session?.role !== 'TEACHER' || ['Vice Principal', 'Head of Teaching Staff'].includes(user.designation)) return { all: true, label: 'All classes' };
  const me = db.staff.find((s) => s.id === user.staffId || (s.email && (s.email === user.email || s.email === user.login)) || `${s.first} ${s.last}` === user.name);
  const own = new Set();
  Object.entries(db.subjectTeachers || {}).forEach(([k, v]) => { if (me && v === me.id) own.add(k.split(':')[0]); });
  Object.entries(db.coordinators || {}).forEach(([sec, c]) => { if (me && (c.primary === me.id || c.secondary === me.id)) own.add(sec); });
  return { all: false, sections: own, label: own.size ? `Your classes only (${own.size} sections)` : 'Your classes only (none assigned)', me };
}
const inScope = (scope, s) => scope.all || scope.sections?.has(s.sectionId);
const students = (db, f, scope) => db.students.filter((s) => s.status !== 'Left' && inScope(scope, s)
  && (!f.classId || classOf(db, s)?.id === f.classId) && (!f.sectionId || s.sectionId === f.sectionId) && (!f.studentId || s.id === f.studentId));

// ---------- The reports ----------
// rows(db, f, scope) → facts; dims: drill path (first = top level); measures: computed over a group of facts
export const REPORT_DEFS = [
  // Admissions (Data Analytics › Admissions Funnel)
  { code: 'ADM_FUNNEL', screen: 'ANL_ADMISSIONS', module: 'Admissions', name: 'Admissions funnel', purpose: 'Where applicants drop out, by stage, grade and source',
    filters: ['dates', 'year', 'classId', 'status'], visual: 'funnel', roles: 'Admin, Principal, Front Office', source: 'Students › Admissions & Enquiries',
    dims: [{ key: 'stage', label: 'Stage', order: ['Enquiry', 'Submitted', 'In review', 'Offered', 'Enrolled'] }, { key: 'grade', label: 'Grade' }, { key: 'source', label: 'Source' }],
    measures: [{ key: 'n', label: 'Reached', calc: (l) => l.length }, { key: 'drop', label: 'Share of enquiries', fmt: 'pct', calc: (l, all) => pctOf(l.length, all.filter((x) => x.stage === 'Enquiry').length) }],
    rows: (db, f) => db.enquiries.filter((e) => (!f.classId || `C${e.grade}` === f.classId) && (!f.status || e.status === f.status) && (e.history[0]?.at || '') >= (f.from || '') && (e.history[0]?.at || '') <= (f.to || '9'))
      .flatMap((e) => ['Enquiry', 'Submitted', 'In review', 'Offered', 'Enrolled'].filter((st) => e.history.some((h) => h.status === st)).map((st) => ({ stage: st, grade: `Grade ${e.grade}`, source: e.source || '—', id: e.id }))) },
  { code: 'ADM_SOURCE', screen: 'ANL_ADMISSIONS', module: 'Admissions', name: 'Enquiry source ROI', purpose: 'Which channels bring enrolments',
    filters: ['dates', 'classId'], visual: 'bar', roles: 'Admin, Principal', source: 'Students › Admissions & Enquiries',
    dims: [{ key: 'source', label: 'Source' }, { key: 'grade', label: 'Grade' }],
    measures: [{ key: 'enq', label: 'Enquiries', calc: (l) => l.length }, { key: 'enr', label: 'Enrolled', calc: (l) => l.filter((x) => x.enrolled).length }, { key: 'conv', label: 'Conversion', fmt: 'pct', calc: (l) => pctOf(l.filter((x) => x.enrolled).length, l.length) }],
    rows: (db, f) => db.enquiries.filter((e) => (!f.classId || `C${e.grade}` === f.classId) && (e.history[0]?.at || '') >= (f.from || '') && (e.history[0]?.at || '') <= (f.to || '9'))
      .map((e) => ({ source: e.source || '—', grade: `Grade ${e.grade}`, enrolled: e.status === 'Enrolled' })) },
  // Students (Data Analytics › Student Insights)
  { code: 'STU_STRENGTH', screen: 'STU_INS', module: 'Students', name: 'Class strength', purpose: 'Students per class and section against 40 seats, with the girl–boy mix',
    filters: ['classId', 'sectionId'], visual: 'bar', roles: 'Admin, Principal; Teacher (own classes)', source: 'Students › All Students',
    dims: [{ key: 'grade', label: 'Grade' }, { key: 'section', label: 'Section' }, { key: 'gender', label: 'Gender' }],
    measures: [{ key: 'n', label: 'Students', calc: (l) => l.length }, { key: 'girls', label: 'Girls', fmt: 'pct', calc: (l) => pctOf(l.filter((x) => x.gender === 'Female').length, l.length) },
      { key: 'fill', label: 'Seats filled', fmt: 'pct', calc: (l) => pctOf(l.length, 40 * new Set(l.map((x) => x.section)).size) }],
    rows: (db, f, scope) => students(db, f, scope).map((s) => ({ grade: grade(db, s), section: section(db, s), gender: s.gender || '—' })) },
  // Attendance (Data Analytics › Attendance)
  { code: 'ATT_HEATMAP', asc: true, screen: 'ANL_ATTENDANCE', module: 'Attendance', name: 'Attendance heatmap', purpose: 'Spot chronic absence early (under 75%)',
    filters: ['dates', 'classId', 'sectionId', 'studentId'], visual: 'heatmap', roles: 'Principal, Admin; Teacher (own classes)', source: 'Students › Attendance',
    dims: [{ key: 'student', label: 'Student' }, { key: 'section', label: 'Section' }, { key: 'grade', label: 'Grade' }], cols: 'week',
    measures: [{ key: 'pct', label: 'Attendance', fmt: 'pct', calc: (l) => pctOf(sum(l, (x) => x.p), sum(l, (x) => x.d)) }, { key: 'abs', label: 'Days absent', calc: (l) => sum(l, (x) => x.d - x.p) }],
    rows: (db, f, scope) => {
      const from = f.from > (db.attFrom || '') ? f.from : f.from, to = f.to < todayIso() ? f.to : todayIso();
      const ds = days(from < addDaysIso(to, -70) ? addDaysIso(to, -70) : from, to).filter((d) => isSchoolDay(db, d));   // up to 10 weeks on screen
      return students(db, f, scope).flatMap((s) => { const w = {}; ds.forEach((d) => { const m = studentMark(db, s, d); if (!m) return; const k = weekOf(d); w[k] = w[k] || { d: 0, p: 0 }; if (m !== 'L') { w[k].d += 1; if (m === 'P' || m === 'LATE') w[k].p += 1; } });
        return Object.entries(w).map(([week, v]) => ({ student: fullName(s), section: section(db, s), grade: grade(db, s), week, ...v })); });
    } },
  { code: 'STF_ATTLEAVE', screen: 'ANL_ATTENDANCE', module: 'Attendance', name: 'Staff attendance & leave', purpose: 'Cover planning: who is away, and how much leave is used',
    filters: ['dates', 'staffId'], visual: 'line', roles: 'Principal, Admin', source: 'Staff › Staff Attendance, Leave Requests',
    dims: [{ key: 'month', label: 'Month', time: true }, { key: 'dept', label: 'Department' }, { key: 'staff', label: 'Staff' }],
    measures: [{ key: 'pct', label: 'Present', fmt: 'pct', calc: (l) => pctOf(sum(l, (x) => x.p), sum(l, (x) => x.d)) }, { key: 'leave', label: 'Leave days', calc: (l) => sum(l, (x) => x.leave) }],
    rows: (db, f) => { const to = f.to < todayIso() ? f.to : todayIso(); const ds = days(f.from, to).filter((d) => isSchoolDay(db, d));
      return db.staff.filter((s) => !f.staffId || s.id === f.staffId).flatMap((st) => { const m = {}; ds.forEach((d) => { const k = month(d); const mk = staffMark(db, st, d); if (!mk) return; m[k] = m[k] || { d: 0, p: 0, leave: 0 }; m[k].d += 1; if (mk === 'P' || mk === 'HALF') m[k].p += mk === 'HALF' ? 0.5 : 1; if (mk === 'L') m[k].leave += 1; });
        return Object.entries(m).map(([mo, v]) => ({ month: mo, dept: st.dept, staff: `${st.first} ${st.last}`, ...v })); }); } },
  // Fees (Data Analytics › Fee Insights)
  { code: 'FEE_TARGET', screen: 'FEE_INS', module: 'Fees', name: 'Collection vs target', purpose: 'Cash position: billed against collected, month by month',
    filters: ['dates', 'year', 'classId', 'feeHead'], visual: 'combo', target: 95, roles: 'Admin, Principal, Accountant', source: 'Fees › Collect Fee, Receipts',
    dims: [{ key: 'month', label: 'Due month', time: true }, { key: 'grade', label: 'Grade' }, { key: 'head', label: 'Fee type' }],
    measures: [{ key: 'billed', label: 'Billed', fmt: 'inr', calc: (l) => sum(l, (x) => x.billed) }, { key: 'paid', label: 'Collected', fmt: 'inr', calc: (l) => sum(l, (x) => x.paid) }, { key: 'pct', label: 'Collected %', fmt: 'pct', calc: (l) => pctOf(sum(l, (x) => x.paid), sum(l, (x) => x.billed)) }],
    rows: (db, f, scope) => { const ids = new Set(students(db, f, scope).map((s) => s.id));
      return db.invoices.filter((i) => ids.has(i.studentId) && i.due >= f.from && i.due <= f.to).flatMap((i) => { const tot = sum(i.items, (x) => x.amount) || 1; const s = db.students.find((x) => x.id === i.studentId);
        return i.items.filter((it) => !f.feeHead || it.head === f.feeHead).map((it) => ({ month: month(i.due), grade: grade(db, s), head: it.head, billed: it.amount, paid: Math.round((i.paid || 0) * it.amount / tot) })); }); } },
  { code: 'FEE_AGEING', screen: 'FEE_INS', module: 'Fees', name: 'Dues ageing', purpose: 'Who to chase first: unpaid balances by how long they are overdue',
    filters: ['classId', 'sectionId', 'feeHead', 'status'], visual: 'bar', roles: 'Accountant, Admin', source: 'Fees › Dues & Reminders',
    dims: [{ key: 'bucket', label: 'Overdue by', order: ['Not yet due', '0–30 days', '31–60 days', '60+ days'] }, { key: 'grade', label: 'Grade' }, { key: 'student', label: 'Student' }],
    measures: [{ key: 'bal', label: 'Balance', fmt: 'inr', calc: (l) => sum(l, (x) => x.bal) }, { key: 'n', label: 'Invoices', calc: (l) => l.length }],
    rows: (db, f, scope) => { const ids = new Set(students(db, f, scope).map((s) => s.id)); const t = todayIso();
      return db.invoices.filter((i) => ids.has(i.studentId) && i.status !== 'PAID' && (!f.status || i.status === f.status) && (!f.feeHead || i.items.some((x) => x.head === f.feeHead))).map((i) => {
        const late = Math.round((new Date(t) - new Date(i.due)) / 864e5); const s = db.students.find((x) => x.id === i.studentId);
        return { bucket: late < 0 ? 'Not yet due' : late <= 30 ? '0–30 days' : late <= 60 ? '31–60 days' : '60+ days', grade: grade(db, s), student: `${fullName(s)} · ${s.admNo}`, bal: balance(i) }; }); } },
  { code: 'FEE_MODES', screen: 'FEE_INS', module: 'Fees', name: 'Payment mode mix', purpose: 'Bank and gateway planning: how parents pay',
    filters: ['dates', 'classId'], visual: 'bar', roles: 'Accountant, Admin', source: 'Fees › Receipts, Payment Matching',
    dims: [{ key: 'mode', label: 'Mode' }, { key: 'month', label: 'Month', time: true }],
    measures: [{ key: 'amt', label: 'Amount', fmt: 'inr', calc: (l) => sum(l, (x) => x.amount) }, { key: 'n', label: 'Receipts', calc: (l) => l.length }],
    rows: (db, f, scope) => { const ids = new Set(students(db, f, scope).map((s) => s.id));
      return db.payments.filter((p) => ids.has(p.studentId) && month(p.at) >= month(f.from) && String(p.at).slice(0, 10) <= f.to).map((p) => ({ mode: p.mode, month: month(p.at), amount: p.amount })); } },
  // Exams (Data Analytics › Exam Results)
  { code: 'EXM_RESULTS', screen: 'ANL_EXAMS', module: 'Exams', name: 'Result analysis', purpose: 'Subject strengths and weak spots for an exam',
    filters: ['exam', 'classId', 'sectionId', 'subject', 'studentId'], visual: 'bar', roles: 'Principal, Admin; Teacher (own classes)', source: 'Exams › Marks, Report Cards',
    dims: [{ key: 'subject', label: 'Subject' }, { key: 'section', label: 'Section' }, { key: 'student', label: 'Student' }],
    measures: [{ key: 'avg', label: 'Average', fmt: 'pct', calc: (l) => avg(l, (x) => x.pct) }, { key: 'pass', label: 'Pass (≥ 33%)', fmt: 'pct', calc: (l) => pctOf(l.filter((x) => x.pct >= 33).length, l.length) }, { key: 'a', label: 'A1–A2', fmt: 'pct', calc: (l) => pctOf(l.filter((x) => x.pct >= 81).length, l.length) }],
    rows: (db, f, scope) => students(db, f, scope).flatMap((s) => subjectsOf(db, s).filter((sub) => !f.subject || sub === f.subject).map((sub) => ({ s, sub, pct: examPct(db, s, f.exam || 'T1', sub) })).filter((x) => x.pct != null)
      .map((x) => ({ subject: x.sub, section: section(db, s), student: fullName(s), pct: x.pct, grade: gradeOf(x.pct) }))) },
  { code: 'EXM_MOVERS', screen: 'ANL_EXAMS', module: 'Exams', name: 'Top & bottom movers', purpose: 'Who improved or slipped between two exams',
    filters: ['exam', 'exam2', 'classId', 'sectionId', 'subject'], visual: 'diverging', roles: 'Principal, Admin; Teacher (own classes)', source: 'Data Analytics › Top & Bottom Performers',
    dims: [{ key: 'student', label: 'Student' }, { key: 'section', label: 'Section' }],
    measures: [{ key: 'chg', label: 'Change (points)', fmt: 'signed', calc: (l) => avg(l, (x) => x.chg) }, { key: 'now', label: 'Now', fmt: 'pct', calc: (l) => avg(l, (x) => x.b) }],
    rows: (db, f, scope) => students(db, f, scope).map((s) => { const subs = subjectsOf(db, s).filter((x) => !f.subject || x === f.subject); const a = avg(subs, (x) => examPct(db, s, f.exam || 'T1', x) || 0), b = avg(subs, (x) => examPct(db, s, f.exam2 || 'T2', x) || 0);
      return { student: fullName(s), section: section(db, s), a, b, chg: r1(b - a) }; }).filter((x) => x.a || x.b), sortBy: 'chg' },
  // Timetable (Data Analytics › Timetable)
  { code: 'TT_LOAD', screen: 'ANL_TIMETABLE', module: 'Timetable', name: 'Teacher load', purpose: 'Fair allocation: periods a week per teacher',
    filters: ['staffId'], visual: 'bar', roles: 'Principal, Admin', source: 'Academics › Timetable',
    dims: [{ key: 'teacher', label: 'Teacher' }, { key: 'dept', label: 'Department' }],
    measures: [{ key: 'periods', label: 'Periods a week', calc: (l) => sum(l, (x) => x.n) }],
    rows: (db, f) => { const out = []; Object.values(db.timetable || {}).forEach((byDay) => Object.values(byDay).forEach((bySec) => Object.values(bySec).filter(Array.isArray).forEach((cells) => cells.forEach((c) => teachersIn(db, c).forEach((t) => {
      if (!f.staffId || t.id === f.staffId) out.push({ teacher: `${t.first} ${t.last} (${t.short})`, dept: t.dept, n: 5 }); })))));   // the test timetable has Friday only; a week = 5 days
      return out; } },
  { code: 'TT_SUBS', screen: 'ANL_TIMETABLE', module: 'Timetable', name: 'Substitution log', purpose: 'Cover cost: periods that needed a substitute because the teacher was on leave',
    filters: ['dates', 'staffId'], visual: 'bar', roles: 'Principal', source: 'Academics › Timetable; Staff › Leave Requests',
    dims: [{ key: 'teacher', label: 'Teacher on leave' }, { key: 'date', label: 'Date' }],
    measures: [{ key: 'periods', label: 'Periods to cover', calc: (l) => sum(l, (x) => x.n) }],
    rows: (db, f) => { const load = {}; Object.values(db.timetable || {}).forEach((byDay) => Object.values(byDay).forEach((bySec) => Object.values(bySec).filter(Array.isArray).forEach((cells) => cells.forEach((c) => teachersIn(db, c).forEach((t) => { load[t.id] = (load[t.id] || 0) + 1; })))));
      return (db.staffLeaves || []).filter((l) => l.status === 'APPROVED' && (!f.staffId || l.staffId === f.staffId)).flatMap((l) => { const t = db.staff.find((x) => x.id === l.staffId);
        return days(l.from, l.to || l.from).filter((d) => isSchoolDay(db, d) && d >= f.from && d <= f.to).map((d) => ({ teacher: `${t.first} ${t.last}`, date: d, n: (load[t.id] || 0) * (l.half ? 0.5 : 1) })); }).filter((x) => x.n > 0); } },
  // Staff (Data Analytics › Staff Insights)
  { code: 'STF_TURNOVER', screen: 'STF_INS', module: 'Staff', name: 'Headcount & turnover', purpose: 'Hiring needs: joiners, leavers and headcount by year',
    filters: ['staffId'], visual: 'line', roles: 'Admin, Principal', source: 'Staff › All Staff',
    dims: [{ key: 'year', label: 'Year joined', time: true }, { key: 'dept', label: 'Department' }, { key: 'type', label: 'Employment type' }],
    measures: [{ key: 'join', label: 'Joiners', calc: (l) => l.filter((x) => x.kind === 'join').length }, { key: 'leave', label: 'Leavers', calc: (l) => l.filter((x) => x.kind === 'leave').length },
      { key: 'turn', label: 'Turnover', fmt: 'pct', calc: (l, all, db) => pctOf(l.filter((x) => x.kind === 'leave').length, db.staff.length) }],
    rows: (db) => db.staff.flatMap((s) => [{ kind: 'join', year: String(s.join || '').slice(0, 4), dept: s.dept, type: s.type || 'Full time' }, ...(s.status === 'Left' ? [{ kind: 'leave', year: String(s.left || todayIso()).slice(0, 4), dept: s.dept, type: s.type || 'Full time' }] : [])]) },
  { code: 'STF_PAYROLL', screen: 'STF_INS', module: 'Staff', name: 'Payroll cost', purpose: 'Budget: monthly salary cost by department and pay head',
    filters: ['staffId'], visual: 'bar', roles: 'Admin, Accountant', source: 'Payroll › Run Payroll',
    dims: [{ key: 'dept', label: 'Department' }, { key: 'head', label: 'Pay head' }, { key: 'staff', label: 'Staff' }],
    measures: [{ key: 'amt', label: 'Monthly cost', fmt: 'inr', calc: (l) => sum(l, (x) => x.amt) }],
    rows: (db, f) => db.staff.filter((s) => s.status !== 'Left' && (!f.staffId || s.id === f.staffId)).flatMap((s) => ['Basic', 'HRA', 'DA', 'Transport'].map((h) => ({ dept: s.dept, head: h, staff: `${s.first} ${s.last}`, amt: s.salary?.[h] || 0 }))) },
  // Transport (Data Analytics › Transport Reports)
  { code: 'TRN_UTIL', screen: 'ANL_TRANSPORT', module: 'Transport', name: 'Route utilisation', purpose: 'Right-size the buses: seats used per route',
    filters: ['classId'], visual: 'bar', roles: 'Transport, Admin, Principal', source: 'Transport › Routes, Bus Manifest',
    dims: [{ key: 'route', label: 'Route' }, { key: 'grade', label: 'Grade' }],
    measures: [{ key: 'riders', label: 'Riders', calc: (l) => l.length }, { key: 'use', label: 'Seats used', fmt: 'pct', calc: (l) => pctOf(l.length, l[0]?.cap || 0) }],
    rows: (db, f, scope) => students(db, f, scope).filter((s) => +s.band > 0).map((s) => { const r = db.routes.find((x) => x.band === +s.band) || {}; return { route: `${r.id} ${r.name || ''}`.trim(), grade: grade(db, s), cap: r.capacity || 0 }; }) },
  { code: 'TRN_ONTIME', screen: 'ANL_TRANSPORT', module: 'Transport', name: 'On-time pick-ups', purpose: 'Service quality: trips on time, and the delays logged',
    filters: ['dates'], visual: 'bar', roles: 'Transport, Principal', source: 'Transport › Driver Route Sheets; Dashboard breakdowns',
    dims: [{ key: 'route', label: 'Route' }, { key: 'month', label: 'Month', time: true }],
    measures: [{ key: 'on', label: 'On time', fmt: 'pct', calc: (l) => pctOf(sum(l, (x) => x.trips - x.late), sum(l, (x) => x.trips)) }, { key: 'late', label: 'Late trips', calc: (l) => sum(l, (x) => x.late) }, { key: 'delay', label: 'Minutes lost', calc: (l) => sum(l, (x) => x.delay) }],
    rows: (db, f) => { const to = f.to < todayIso() ? f.to : todayIso(); const ms = [...new Set(days(f.from, to).filter((d) => isSchoolDay(db, d)).map(month))];
      return db.routes.flatMap((r) => ms.map((m) => { const inc = (db.busIncidents || []).filter((i) => i.routeId === r.id && month(i.date) === m); const sd = days(f.from, to).filter((d) => month(d) === m && isSchoolDay(db, d)).length;
        return { route: `${r.id} ${r.name}`, month: m, trips: sd * 2, late: inc.length, delay: sum(inc, (i) => i.delayMin) }; })); } },
  // Parent communication (Data Analytics › Parent Communication)
  { code: 'COM_REACH', screen: 'ANL_COMMS', module: 'Parent communication', name: 'Message reach', purpose: 'Are parents getting the messages? Sent and delivered by channel',
    filters: ['dates', 'status'], visual: 'bar', roles: 'Admin, Principal', source: 'Settings › Email & SMS Outbox; Notices',
    note: 'Read receipts are not tracked yet: emails show sent/delivered, SMS shows the gateway status, app notifications show read.',
    dims: [{ key: 'channel', label: 'Channel' }, { key: 'kind', label: 'Message type' }],
    measures: [{ key: 'sent', label: 'Sent', calc: (l) => l.length }, { key: 'deliv', label: 'Delivered', fmt: 'pct', calc: (l) => pctOf(l.filter((x) => x.delivered).length, l.length) }, { key: 'read', label: 'Read (app)', fmt: 'pct', calc: (l) => { const a = l.filter((x) => x.channel === 'App'); return a.length ? pctOf(a.filter((x) => x.read).length, a.length) : 0; } }],
    rows: (db, f) => [
      ...(db.outbox || []).map((m) => ({ channel: 'Email', kind: m.kind || 'Email', delivered: m.status === 'SENT', at: m.at, status: m.status })),
      ...(db.smsOutbox || db.sms?.queue || []).map((m) => ({ channel: 'SMS', kind: m.kind || m.template || 'SMS', delivered: m.status === 'DELIVERED' || m.status === 'SENT', at: m.at || m.createdAt, status: m.status })),
      ...(db.alerts || []).map((m) => ({ channel: 'App', kind: m.screen || 'Notice', delivered: true, read: !!m.read, at: m.at, status: m.read ? 'READ' : 'SENT' }))
    ].filter((m) => (!f.status || m.status === f.status) && String(m.at || '').slice(0, 10) >= f.from && String(m.at || '').slice(0, 10) <= f.to) },
  { code: 'COM_TURNAROUND', screen: 'ANL_COMMS', module: 'Parent communication', name: 'Requests turnaround', purpose: 'Office responsiveness: hours from a parent’s request to a decision',
    filters: ['dates', 'classId', 'status'], visual: 'bar', roles: 'Principal, Admin', source: 'Students › Coordinator Desk, Office Requests',
    dims: [{ key: 'type', label: 'Request type' }, { key: 'grade', label: 'Grade' }],
    measures: [{ key: 'n', label: 'Requests', calc: (l) => l.length }, { key: 'med', label: 'Median hours to decide', calc: (l) => median(l.filter((x) => x.hours != null).map((x) => x.hours)) }, { key: 'open', label: 'Still open', calc: (l) => l.filter((x) => x.hours == null).length }],
    rows: (db, f, scope) => { const ids = new Set(students(db, f, scope).map((s) => s.id));
      return (db.requests || []).filter((r) => ids.has(r.studentId) && (!f.status || r.status === f.status) && String(r.createdAt || '').slice(0, 10) >= f.from && String(r.createdAt || '').slice(0, 10) <= f.to).map((r) => {
        const done = (r.history || []).find((h) => ['Approved', 'Declined', 'Done', 'Confirmed'].includes(h.status)); const s = db.students.find((x) => x.id === r.studentId);
        return { type: r.type.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase()), grade: grade(db, s), hours: done ? r1((new Date(done.at) - new Date(r.createdAt || done.at)) / 36e5) : null }; }); } },
  { code: 'COM_MEETINGS', screen: 'ANL_COMMS', module: 'Parent communication', name: 'Meeting attendance', purpose: 'PTM follow-up: meetings asked for, confirmed and held',
    filters: ['dates', 'classId'], visual: 'bar', roles: 'Principal, Admin; Teacher (own classes)', source: 'Students › Parent Meetings; Events & Calendar',
    dims: [{ key: 'grade', label: 'Grade' }, { key: 'status', label: 'Status' }],
    measures: [{ key: 'asked', label: 'Asked', calc: (l) => l.length }, { key: 'conf', label: 'Confirmed', calc: (l) => l.filter((x) => ['Confirmed', 'Done', 'Approved'].includes(x.status)).length }, { key: 'held', label: 'Held', fmt: 'pct', calc: (l) => pctOf(l.filter((x) => x.status === 'Done').length, l.length) }],
    rows: (db, f, scope) => { const ids = new Set(students(db, f, scope).map((s) => s.id));
      return (db.requests || []).filter((r) => r.type === 'MEETING' && ids.has(r.studentId) && String(r.createdAt || '').slice(0, 10) >= f.from).map((r) => ({ grade: grade(db, db.students.find((x) => x.id === r.studentId)), status: r.status })); } },
  // Moved here from Campus Services and Academics (release 15.1)
  { code: 'CMP_TRENDS', screen: 'ANL_CAMPUS', module: 'Campus', name: 'Library, hostel and store trends', purpose: 'Loans and overdue by month, hostel occupancy, store sales',
    filters: ['dates'], visual: 'bar', roles: 'Admin, Principal', source: 'Campus Services › Library, Hostel, Inventory & Store',
    dims: [{ key: 'area', label: 'Area' }, { key: 'month', label: 'Month', time: true }, { key: 'item', label: 'Item' }],
    measures: [{ key: 'n', label: 'Count', calc: (l) => sum(l, (x) => x.n) }, { key: 'amt', label: 'Amount', fmt: 'inr', calc: (l) => sum(l, (x) => x.amt) }],
    rows: (db, f) => [
      ...(db.library?.loans || []).filter((x) => x.issued >= f.from && x.issued <= f.to).map((x) => ({ area: 'Library loans', month: month(x.issued), item: db.library.books.find((b) => b.id === x.bookId)?.title || '—', n: 1, amt: x.fine || 0 })),
      ...(db.hostel?.residents || []).filter((x) => !x.left).map((x) => ({ area: 'Hostel beds taken', month: month(x.from), item: x.roomId, n: 1, amt: 0 })),
      ...(db.inventory?.moves || []).filter((x) => x.type === 'SALE' && x.date >= f.from && x.date <= f.to).map((x) => ({ area: 'Store sales', month: month(x.date), item: db.inventory.items.find((i) => i.id === x.itemId)?.name || '—', n: -x.qty, amt: x.amount || 0 }))] },
  { code: 'ACA_COVERAGE', screen: 'ANL_ACADEMICS', module: 'Academics', name: 'Syllabus coverage', purpose: 'Curriculum covered across classes and subjects',
    filters: ['classId', 'subject'], visual: 'bar', roles: 'Principal, Admin; Teacher (own classes)', source: 'Academics › Curriculum Planning',
    dims: [{ key: 'grade', label: 'Class' }, { key: 'subject', label: 'Subject' }, { key: 'unit', label: 'Unit' }],
    measures: [{ key: 'cov', label: 'Covered', fmt: 'pct', calc: (l) => coverage(l.map((x) => x.u)).pct }, { key: 'planned', label: 'Periods planned', calc: (l) => sum(l, (x) => x.u.periods) }],
    rows: (db, f) => (db.curriculum || []).filter((u) => (!f.classId || u.classId === f.classId) && (!f.subject || u.subject === f.subject)).map((u) => ({ grade: db.classes.find((c) => c.id === u.classId)?.name || u.classId, subject: u.subject, unit: u.title, u })) },
  // Our company only (Service Provider › Sales Analytics)
  { code: 'SP_SALES', screen: 'SP_ANALYTICS', module: 'Sales (our company)', name: 'Sales pipeline', purpose: 'Win rate, pipeline value and discount given',
    filters: ['dates', 'status'], visual: 'bar', roles: 'Admin (our company), Sales, Platform', source: 'Service Provider › Proposal Builder, Market Review',
    dims: [{ key: 'status', label: 'Status', order: ['Draft', 'Sent', 'Won', 'Lost'] }, { key: 'tier', label: 'Plan' }, { key: 'client', label: 'Client' }],
    measures: [{ key: 'n', label: 'Proposals', calc: (l) => l.length }, { key: 'val', label: 'Value a year', fmt: 'inr', calc: (l) => sum(l, (x) => x.val) }, { key: 'disc', label: 'Average discount', fmt: 'pct', calc: (l) => avg(l, (x) => x.disc) },
      { key: 'win', label: 'Win rate', fmt: 'pct', calc: (l) => pctOf(l.filter((x) => x.status === 'Won').length, l.filter((x) => ['Won', 'Lost'].includes(x.status)).length) }],
    rows: (db, f, scope, extra) => (db.provider?.proposals || []).filter((p) => (!f.status || p.status === f.status) && (p.created || '') >= f.from && (p.created || '') <= f.to)
      .map((p) => ({ status: p.status, tier: { STARTER: 'Starter', PRO: 'Pro', PRO_PLUS: 'Pro+' }[p.options.tier] || p.options.tier, client: p.options.client || p.no, val: extra?.value ? extra.value(p) : 0, disc: +p.options.discountPct || 0 })) }
];
const addDaysIso = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const reportsFor = (screen) => REPORT_DEFS.filter((r) => r.screen === screen);
export const reportByCode = (code) => REPORT_DEFS.find((r) => r.code === code);

// Group facts by the dimension at the current drill level; each row carries every measure
export function aggregate(db, def, facts, dimKey, all = facts) {
  const dim = def.dims.find((d) => d.key === dimKey) || def.dims[0];
  const groups = new Map();
  facts.forEach((x) => { const k = x[dim.key] ?? '—'; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(x); });
  let rows = [...groups.entries()].map(([key, l]) => ({ key, facts: l, ...Object.fromEntries(def.measures.map((m) => [m.key, m.calc(l, all, db)])) }));
  if (dim.order) rows.sort((a, b) => dim.order.indexOf(a.key) - dim.order.indexOf(b.key));
  else if (dim.time) rows.sort((a, b) => String(a.key).localeCompare(String(b.key)));
  else { const k = def.sortBy || def.measures[0].key; rows.sort((a, b) => (def.asc ? 1 : -1) * ((a[k] || 0) - (b[k] || 0))); }
  return { dim, rows };
}
export function kpis(db, def, facts) { return def.measures.map((m) => ({ ...m, value: m.calc(facts, facts, db) })); }
export const fmtValue = (m, v) => (m.fmt === 'pct' ? `${v}%` : m.fmt === 'inr' ? '₹' + Math.round(v).toLocaleString('en-IN') : m.fmt === 'signed' ? (v > 0 ? '+' : '') + v : (Math.round(v * 10) / 10).toLocaleString('en-IN'));

// The menu each moved analytic came from, and where it lives now
export const MOVED = [
  ['Students › Insights', 'Data Analytics › Student Insights'], ['Staff › Insights', 'Data Analytics › Staff Insights'], ['Fees › Insights', 'Data Analytics › Fee Insights'],
  ['Admissions & Enquiries: funnel, conversion, status by grade', 'Data Analytics › Admissions Funnel'], ['Campus Services trends (library, hostel, store)', 'Data Analytics › Campus Trends'],
  ['Curriculum Planning: coverage across classes', 'Data Analytics › Syllabus Coverage'], ['Market Review & proposal KPIs', 'Service Provider › Sales Analytics'],
  ['Dashboard tiles', 'Each opens its Data Analytics report'], ['My Teaching Performance', 'Stays in My Space; the same Teacher Performance report, filtered to the teacher']
];
