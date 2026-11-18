// Exam results for student profiles and report cards: % per subject per exam, ranks against classmates, CBSE grades.
import { SUBJECTS } from '../data/seed2.js';
import { fullName, classLabel } from './logic.js';
import { studentSummary, yearStartOf } from './attendance.js';
import { todayISO } from './format.js';

// The year's exams. Term exams come from the marks register; periodic tests sit close to the term result.
export const EXAMS = [
  { code: 'PT1', name: 'Periodic Test 1', term: 'Term 1', from: 'T1', shift: 'a', weight: 0.1 },
  { code: 'T1', name: 'Half-yearly exam', term: 'Term 1', weight: 0.4 },
  { code: 'PT2', name: 'Periodic Test 2', term: 'Term 2', from: 'T2', shift: 'b', weight: 0.1 },
  { code: 'T2', name: 'Annual exam', term: 'Term 2', weight: 0.4 }
];
// Report card scopes: one exam, a term (its periodic test + term exam), or the whole year (weighted)
export const SCOPES = [
  ['T1_TERM', 'Term 1 (Periodic Test 1 + Half-yearly)', ['PT1', 'T1']], ['T2_TERM', 'Term 2 (Periodic Test 2 + Annual)', ['PT2', 'T2']], ['YEAR', 'Whole year (weighted)', ['PT1', 'T1', 'PT2', 'T2']],
  ...EXAMS.map((e) => [e.code, e.name, [e.code]])
];
const h = (s) => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const r1 = (n) => Math.round(n * 10) / 10;

export function examPct(db, s, exam, subject) {
  const m = db.marks[s.id + ':' + subject];
  if (!m) return null;
  const e = EXAMS.find((x) => x.code === exam);
  const base = e.code === 'T1' || e.from === 'T1' ? m[0] : m[1];
  if (!e.from) return base;
  return Math.max(0, Math.min(100, base + ((h(s.id + subject + e.code) % 13) - 6)));
}
export const subjectsOf = (db, s) => SUBJECTS.filter((sub) => db.marks[s.id + ':' + sub]);
export function overall(db, s, exams) {
  const subs = subjectsOf(db, s);
  const per = subs.map((sub) => scopePct(db, s, exams, sub)).filter((x) => x != null);
  return per.length ? r1(per.reduce((a, b) => a + b, 0) / per.length) : null;
}
export function scopePct(db, s, exams, subject) {
  const parts = exams.map((x) => [EXAMS.find((e) => e.code === x).weight, examPct(db, s, x, subject)]).filter((p) => p[1] != null);
  const w = parts.reduce((a, p) => a + p[0], 0);
  return w ? r1(parts.reduce((a, p) => a + p[0] * p[1], 0) / w) : null;
}

// CBSE 8-point grading
export const GRADES = [[91, 'A1'], [81, 'A2'], [71, 'B1'], [61, 'B2'], [51, 'C1'], [41, 'C2'], [33, 'D'], [0, 'E']];
export const gradeOf = (pct) => (pct == null ? '—' : GRADES.find(([min]) => pct >= min)[1]);

const classmates = (db, s, by) => db.students.filter((x) => x.status === 'Active' && (by === 'section' ? x.sectionId === s.sectionId : db.sections.find((y) => y.id === x.sectionId)?.classId === db.sections.find((y) => y.id === s.sectionId)?.classId));
// Rank among classmates (ties share a rank), how many there are, the class average and the top score
export function standing(db, s, exams, by = 'grade', subject = null) {
  const list = classmates(db, s, by).map((x) => ({ id: x.id, pct: subject ? scopePct(db, x, exams, subject) : overall(db, x, exams) })).filter((x) => x.pct != null);
  const me = list.find((x) => x.id === s.id);
  if (!me) return null;
  const rank = 1 + list.filter((x) => x.pct > me.pct).length;
  const below = list.filter((x) => x.pct < me.pct).length;
  return { rank, of: list.length, pct: me.pct, average: r1(list.reduce((a, x) => a + x.pct, 0) / list.length), top: Math.max(...list.map((x) => x.pct)),
    betterThan: list.length > 1 ? Math.round((100 * below) / (list.length - 1)) : 100, all: list.map((x) => x.pct).sort((a, b) => a - b) };
}

export function performance(db, s) {
  const subs = subjectsOf(db, s);
  const rows = subs.map((sub) => ({ subject: sub, ...Object.fromEntries(EXAMS.map((e) => [e.code, examPct(db, s, e.code, sub)])) }));
  const exams = EXAMS.map((e) => ({ ...e, pct: overall(db, s, [e.code]), section: standing(db, s, [e.code], 'section'), grade: standing(db, s, [e.code], 'grade') }));
  return { rows, exams };
}

const termDates = (db, exams) => {
  const ys = yearStartOf(db); const y = +ys.slice(0, 4);
  const t2 = exams.some((e) => e.startsWith('T2') || e === 'PT2');
  const t1 = exams.some((e) => e.startsWith('T1') || e === 'PT1');
  const from = t1 ? ys : `${y}-10-01`; const to = t2 ? `${y + 1}-03-31` : `${y}-09-30`;
  return [from, to < todayISO() ? to : todayISO()];
};

// Everything one report card shows
export function reportCard(db, s, scope) {
  const [code, title, exams] = SCOPES.find((x) => x[0] === scope);
  const subs = subjectsOf(db, s);
  const rows = subs.map((sub) => { const pct = scopePct(db, s, exams, sub); return { subject: sub, marks: exams.map((e) => examPct(db, s, e, sub)), pct, grade: gradeOf(pct) }; });
  const pct = overall(db, s, exams);
  const [from, to] = termDates(db, exams);
  const att = studentSummary(db, s, from, to);
  const cosch = Object.entries(db.cosch || {}).filter(([k, g]) => k.startsWith(s.id + ':') && g).map(([k, g]) => ({ area: k.slice(s.id.length + 1), grade: g }));
  return { code, title, exams: exams.map((e) => EXAMS.find((x) => x.code === e)), student: s, name: fullName(s), cls: classLabel(db, s), rows, pct, grade: gradeOf(pct),
    section: standing(db, s, exams, 'section'), gradeRank: standing(db, s, exams, 'grade'), attendance: att, attFrom: from, attTo: to,
    result: pct == null ? '—' : rows.every((r) => r.pct >= 33) ? 'Pass' : 'Needs improvement', remarks: (db.profiles?.[s.id] || []).map((c) => `${c.subject}: ${c.text}`), cosch };
}
