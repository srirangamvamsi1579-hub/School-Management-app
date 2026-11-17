// Calculations behind the Data Analytics reports. Each mirrors a SQL view in database/007 and a
// Power BI report page in docs/powerbi/REPORTS.md, so the test build and Power BI show the same numbers.
import { SUBJECTS, ADM_STATUSES } from '../data/seed2.js';
import { groupOf, transportFor } from '../data/seed.js';
import { fullName, admitStudent, log, renderFor, tenantOf } from './logic.js';

const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const r1 = (n) => Math.round(n * 10) / 10;
export const PASS = 33;   // CBSE pass mark %

const termIdx = (term) => (term === 'Term 1' ? 0 : 1);
export const levelOf = (db, s) => parseInt(s.sectionId.slice(1), 10);
export const sectionName = (db, id) => { const x = db.sections.find((y) => y.id === id); return db.classes.find((c) => c.id === x.classId).name.replace('Grade ', '') + '-' + x.name; };

export function studentScore(db, s, term = 'Term 2', subject = 'ALL') {
  const subs = subject === 'ALL' ? SUBJECTS : [subject];
  return r1(avg(subs.map((sub) => db.marks[s.id + ':' + sub]?.[termIdx(term)] ?? 0)));
}

// Top N and bottom N in a grade, all sections together unless sections are picked
export function rankReport(db, { classId, sectionIds = [], term = 'Term 2', subject = 'ALL', n = 6 }) {
  const secs = db.sections.filter((x) => x.classId === classId && (!sectionIds.length || sectionIds.includes(x.id))).map((x) => x.id);
  const rows = db.students.filter((s) => s.status === 'Active' && secs.includes(s.sectionId)).map((s) => {
    const score = studentScore(db, s, term, subject);
    const prev = term === 'Term 2' ? studentScore(db, s, 'Term 1', subject) : null;
    return { id: s.id, name: fullName(s), admNo: s.admNo, section: sectionName(db, s.sectionId), score, change: prev === null ? null : r1(score - prev), attendance: s.attendance };
  }).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  rows.forEach((x, i) => { x.rank = i + 1; });
  const scores = rows.map((x) => x.score);
  return { rows, top: rows.slice(0, n), bottom: rows.slice(-n).reverse(), count: rows.length, average: r1(avg(scores)),
    passRate: rows.length ? Math.round(100 * rows.filter((x) => x.score >= PASS).length / rows.length) : 0,
    bySection: secs.map((id) => { const l = rows.filter((x) => x.section === sectionName(db, id)); return { section: sectionName(db, id), count: l.length, average: r1(avg(l.map((x) => x.score))) }; }) };
}

export function transportReport(db, { classId = '' } = {}) {
  const riders = db.students.filter((s) => s.status === 'Active' && s.band && (!classId || db.sections.find((x) => x.id === s.sectionId).classId === classId));
  const routes = db.routes.map((rt) => {
    const l = riders.filter((s) => s.routeId === rt.id);
    const revenue = l.reduce((a, s) => a + transportFor(groupOf(levelOf(db, s)), s.band), 0);
    return { ...rt, riders: l.length, utilisation: Math.round(100 * l.length / rt.capacity), revenue, perKm: rt.km ? Math.round(revenue / rt.km) : 0,
      onTime: Math.round(avg(l.map((s) => s.transportOnTime || 0))) };
  });
  const active = db.students.filter((s) => s.status === 'Active' && (!classId || db.sections.find((x) => x.id === s.sectionId).classId === classId));
  const byGrade = db.classes.filter((c) => !classId || c.id === classId).map((c) => {
    const all = active.filter((s) => db.sections.find((x) => x.id === s.sectionId).classId === c.id);
    const rid = all.filter((s) => s.band);
    return { grade: c.name, students: all.length, riders: rid.length, share: all.length ? Math.round(100 * rid.length / all.length) : 0 };
  });
  return { routes, byGrade, riders: riders.length, revenue: routes.reduce((a, x) => a + x.revenue, 0), seats: db.routes.reduce((a, x) => a + x.capacity, 0),
    unpaid: riders.filter((s) => db.invoices.some((i) => i.studentId === s.id && i.status === 'OVERDUE')).length };
}

// How each teacher's students are doing in the subject they teach, against the same grade and subject school-wide
export function teacherPerformance(db, { classId = '', subject = 'ALL' } = {}) {
  const groups = {};
  Object.entries(db.subjectTeachers).forEach(([key, tid]) => {
    const [secId, sub] = key.split(':');
    if (subject !== 'ALL' && sub !== subject) return;
    const sec = db.sections.find((x) => x.id === secId);
    if (classId && sec.classId !== classId) return;
    const kids = db.students.filter((s) => s.status === 'Active' && s.sectionId === secId);
    const g = (groups[tid + ':' + sub] ||= { teacherId: tid, subject: sub, sections: [], t1: [], t2: [], gradeAvg: [] });
    g.sections.push(sectionName(db, secId));
    kids.forEach((s) => {
      const [a, b] = db.marks[s.id + ':' + sub];
      g.t1.push(a); g.t2.push(b);
      // grade average for this subject, all sections
      const peers = db.students.filter((p) => p.status === 'Active' && db.sections.find((x) => x.id === p.sectionId).classId === sec.classId);
      g.gradeAvg.push(avg(peers.map((p) => db.marks[p.id + ':' + sub][1])));
    });
  });
  const rows = Object.values(groups).filter((g) => g.t2.length).map((g) => {
    const t = db.staff.find((x) => x.id === g.teacherId);
    const a2 = avg(g.t2), a1 = avg(g.t1), ga = avg(g.gradeAvg);
    const vsGrade = r1(a2 - ga), change = r1(a2 - a1);
    const pass = Math.round(100 * g.t2.filter((m) => m >= PASS).length / g.t2.length);
    const distinction = Math.round(100 * g.t2.filter((m) => m >= 75).length / g.t2.length);
    // Index: 50 = in line with the grade; +/- 3 points per mark above/below, +1 per mark of improvement
    const index = Math.max(0, Math.min(100, Math.round(50 + vsGrade * 3 + change)));
    return { teacherId: g.teacherId, teacher: `${t.first} ${t.last}`, short: t.short, subject: g.subject, sections: g.sections.join(', '), students: g.t2.length,
      term1: r1(a1), term2: r1(a2), change, vsGrade, pass, distinction, index, band: index >= 60 ? 'Above' : index >= 40 ? 'In line' : 'Below' };
  });
  return rows.sort((a, b) => b.index - a.index);
}

// ---------- Admissions ----------
export const NEXT = { Enquiry: ['Submitted', 'Opted out'], Submitted: ['In review', 'Opted out'], 'In review': ['Offered', 'Opted out'], Offered: ['Enrolled', 'Opted out'], Enrolled: [], 'Opted out': ['Enquiry'] };

export function admissionsSummary(db, { grades = [] } = {}) {
  const list = db.enquiries.filter((e) => !grades.length || grades.includes(e.grade));
  const rows = db.classes.filter((c) => !grades.length || grades.includes(c.level)).map((c) => {
    const l = list.filter((e) => e.grade === c.level);
    const counts = Object.fromEntries(ADM_STATUSES.map((st) => [st, l.filter((e) => e.status === st).length]));
    const seats = Math.max(0, 40 * db.sections.filter((x) => x.classId === c.id).length - db.students.filter((s) => s.status === 'Active' && db.sections.find((x) => x.id === s.sectionId).classId === c.id).length);
    return { grade: c.name, level: c.level, total: l.length, ...counts, seats };
  });
  const tot = Object.fromEntries(ADM_STATUSES.map((st) => [st, list.filter((e) => e.status === st).length]));
  // Funnel: everyone who reached each stage (history), not just who is there now
  const reached = (st) => list.filter((e) => e.history.some((h) => h.status === st)).length;
  const funnel = ['Enquiry', 'Submitted', 'In review', 'Offered', 'Enrolled'].map((st) => ({ stage: st, count: reached(st) }));
  return { rows, totals: { total: list.length, ...tot }, funnel, conversion: list.length ? Math.round(100 * tot.Enrolled / list.length) : 0,
    offerAccept: reached('Offered') ? Math.round(100 * tot.Enrolled / reached('Offered')) : 0 };
}

export function addEnquiry(db, f, by) {
  db.seq.enquiry += 1;
  const status = f.application ? 'Submitted' : 'Enquiry';
  const today = new Date().toISOString().slice(0, 10);
  const e = { id: 'A' + db.seq.enquiry, no: 'APP-2027-' + String(db.seq.enquiry).padStart(4, '0'), first: f.first, last: f.last, gender: f.gender, dob: f.dob, grade: Number(f.grade),
    prevSchool: f.prevSchool || '', parent: f.parent, mobile: f.mobile, email: f.email || '', source: f.source || 'Walk-in', transport: !!f.transport, status,
    history: [{ status: 'Enquiry', at: today, by, note: '' }].concat(f.application ? [{ status: 'Submitted', at: today, by, note: 'Application form' }] : []),
    interview: '', reason: '', docs: { birthCert: !!f.birthCert, photo: !!f.photo, reportCard: !!f.reportCard }, year: '2027-28', address: f.address || '', siblings: f.siblings || '' };
  db.enquiries.unshift(e);
  if (e.email) ackEmail(db, e, status === 'Submitted' ? 'Application received' : 'Thank you for your enquiry');
  log(db, by, status === 'Submitted' ? 'Application submitted' : 'Enquiry added', `${e.no} · Grade ${e.grade}`);
  return e;
}

function ackEmail(db, e, title, extra = '') {
  const school = tenantOf(db).name;
  db.outbox.unshift({ id: 'M' + (db.outbox.length + 1), to: e.email, kind: 'Admissions', status: 'SENT', at: new Date().toISOString(), related: e.no,
    subject: `${school}: ${title} — ${e.first} ${e.last} (${e.no})`, body: `<p>Dear ${e.parent},</p><p>${title} for <b>${e.first} ${e.last}</b>, Grade ${e.grade}, academic year ${e.year}. Reference <b>${e.no}</b>.</p>${extra}<p>Admissions Office, ${school}</p>` });
}

export function moveEnquiry(db, id, to, { by, note = '', interview = '', reason = '' }) {
  const e = db.enquiries.find((x) => x.id === id);
  if (!NEXT[e.status].includes(to)) throw new Error(`Can't move from ${e.status} to ${to}`);
  if (to === 'Offered' && !(e.docs.birthCert && e.docs.photo)) throw new Error('Birth certificate and photo must be received before an offer');
  if (to === 'Opted out' && !reason) throw new Error('Give a reason for opting out');
  e.status = to;
  e.history.push({ status: to, at: new Date().toISOString().slice(0, 10), by, note: note || reason });
  if (interview) e.interview = interview;
  if (reason) e.reason = reason;
  let student = null;
  if (to === 'Enrolled') {
    const cls = db.classes.find((c) => c.level === e.grade);
    const sec = db.sections.filter((x) => x.classId === cls.id).map((x) => ({ x, n: db.students.filter((s) => s.sectionId === x.id).length })).sort((a, b) => a.n - b.n)[0].x;
    student = admitStudent(db, { first: e.first, last: e.last, gender: e.gender, dob: e.dob, sectionId: sec.id, guardianName: e.parent, relation: 'Guardian', mobile: e.mobile, email: e.email, band: e.transport ? 1 : 0 }, by);
    e.studentId = student.id;
    if (e.email) {
      const letter = renderFor(db, 'ADMISSION_LETTER', { date: new Date().toLocaleDateString('en-GB'), guardian_name: e.parent, student_name: `${e.first} ${e.last}`, class: `${cls.name}-${sec.name}`, admission_no: student.admNo, start_date: '01-04-2027' });
      db.outbox.unshift({ id: 'M' + (db.outbox.length + 1), to: e.email, kind: 'Admission letter', status: 'SENT', at: new Date().toISOString(), related: e.no, subject: `Admission confirmed — ${e.first} ${e.last}`, body: letter.body });
    }
  } else if (e.email && ['In review', 'Offered'].includes(to)) {
    ackEmail(db, e, to === 'Offered' ? 'We are pleased to offer a place' : 'Your application is being reviewed',
      to === 'Offered' ? '<p>Please accept the offer and pay the admission fee within 7 days to confirm the seat.</p>' : e.interview ? `<p>Interaction / assessment on <b>${e.interview}</b>.</p>` : '');
  }
  log(db, by, 'Admission status', `${e.no} → ${to}`);
  return { enquiry: e, student };
}
