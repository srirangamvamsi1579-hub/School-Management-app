// Demo data for accounts, admissions, marks and transport (all fictional).
import { rng } from '../lib/format.js';
import { hashPassword } from '../lib/auth.js';
import { extendSeed3 } from './seed3.js';

export const SUBJECTS = ['English', 'Mathematics', 'Science', 'Social Science', 'Second Language'];
export const SUBJECT_DEPT = { English: 'English', Mathematics: 'Mathematics', Science: 'Science', 'Social Science': 'Social Science', 'Second Language': 'Languages' };
export const TERMS = ['Term 1', 'Term 2'];
export const ADM_STATUSES = ['Enquiry', 'Submitted', 'In review', 'Offered', 'Enrolled', 'Opted out'];
export const DESIGNATIONS = ['Principal', 'Vice Principal', 'Head of Teaching Staff', 'Coordinator', 'Transport In-charge', 'PGT', 'TGT', 'PRT', 'Accountant', 'Office Assistant', 'Admissions Officer', 'IT Administrator'];

const DEMO_PW = 'Demo@123';

export function extendSeed(db) {
  const r = rng(29);
  const pick = (a) => a[Math.floor(r() * a.length)];
  db.version = 2;
  db.seq.user = 100; db.seq.enquiry = 500;

  // ---------- Accounts (one per demo role) ----------
  const salt = 'gvs';
  db.users = [
    ['Admin user', 'admin@greenvalley.example.in', 'EMAIL', 'ADMIN', 'IT Administrator'],
    ['Dr. Kavita Menon', 'principal@greenvalley.example.in', 'EMAIL', 'PRINCIPAL', 'Principal'],
    ['Sana Khan', 'sana.accounts@example.com', 'EMAIL', 'ACCOUNTANT', 'Accountant'],
    ['Sonia Mehta', 'sonia.teacher@example.com', 'EMAIL', 'TEACHER', 'TGT'],
    ['Anita Rao', '9845011200', 'MOBILE', 'FRONT_OFFICE', 'Office Assistant'],
    ['Rohit Sharma', 'rohit.s@example.com', 'EMAIL', 'PARENT', null],
    ['Meera Iyer', 'meera.vp@example.com', 'EMAIL', 'TEACHER', 'Vice Principal'],
    ['Platform support', 'support@yourapp.example.com', 'EMAIL', 'PLATFORM', null]
  ].map(([name, login, type, role, designation], i) => ({
    id: 'U' + (i + 1), name, login, loginType: type, email: type === 'EMAIL' ? login : '', mobile: type === 'MOBILE' ? login : '',
    role, designation, status: 'ACTIVE', verified: true, salt, pw: hashPassword(DEMO_PW, salt), failed: 0, createdAt: '2026-04-01T09:00:00Z', lastLogin: null,
    extra: [], linkedStudent: role === 'PARENT' ? 'ADM-2025-0231' : null
  }));
  // A staff sign-up waiting for approval, so the approval step can be tested (parents never wait: they are checked against the student record)
  db.users.push({ id: 'U9', name: 'Kavya Iyer', login: 'kavya.iyer@example.com', loginType: 'EMAIL', email: 'kavya.iyer@example.com', mobile: '9845077001',
    role: null, requestedRole: 'TEACHER', designation: 'PRT', status: 'PENDING', verified: true, salt, pw: hashPassword(DEMO_PW, salt), failed: 0,
    createdAt: '2026-11-15T10:20:00Z', lastLogin: null, extra: [], linkedStudent: null, note: 'Primary teacher, joining in December' });
  db.customRoles = [];
  // Designations that open extra screens without changing the person's role
  db.designationAccess = { 'Vice Principal': ['OPS_USERS', 'OPS_ROLES', 'STU_ADMISSIONS', 'ANL_RANK', 'ANL_TEACHER'], 'Admissions Officer': ['STU_ADMISSIONS'] };
  db.otp = [];

  // ---------- Marks: Term 1 and Term 2, five subjects ----------
  db.marks = {};
  db.students.forEach((s) => {
    const ability = 30 + r() * 60;
    const trend = (r() - 0.4) * 10;
    SUBJECTS.forEach((sub) => {
      const t1 = Math.max(18, Math.min(100, Math.round(ability + (r() - 0.5) * 22)));
      const t2 = Math.max(18, Math.min(100, Math.round(t1 + trend + (r() - 0.5) * 10)));
      db.marks[s.id + ':' + sub] = [t1, t2];
    });
  });
  // Subject teacher per section
  const byDept = (d) => db.staff.filter((x) => x.dept === d);
  db.subjectTeachers = {};
  db.sections.forEach((sec, k) => SUBJECTS.forEach((sub) => {
    const list = byDept(SUBJECT_DEPT[sub]);
    db.subjectTeachers[sec.id + ':' + sub] = list[(k + sub.length) % list.length].id;
  }));
  // A little spread between teachers so the report has something to show
  Object.entries(db.subjectTeachers).forEach(([key, tid]) => {
    const boost = { E3: 4, E8: 3, E5: -3, E11: -2 }[tid] || 0;
    if (!boost) return;
    const [secId, sub] = key.split(':');
    db.students.filter((s) => s.sectionId === secId).forEach((s) => { const m = db.marks[s.id + ':' + sub]; m[1] = Math.max(18, Math.min(100, m[1] + boost)); });
  });

  // ---------- Transport ----------
  db.routes = [
    ['R1', 'Zone A — Indiranagar', 'KA-01-F-4411', 40, 'Ramesh K'], ['R2', 'Zone B — Koramangala', 'KA-01-F-4412', 40, 'Suresh B'],
    ['R3', 'Zone C — HSR Layout', 'KA-01-F-4413', 32, 'Manjunath S'], ['R4', 'Zone D — Whitefield', 'KA-01-F-4414', 40, 'Prakash R'],
    ['R5', 'Zone E — Sarjapur Road', 'KA-01-F-4415', 26, 'Imran P'], ['R6', 'Zone F — Electronic City', 'KA-01-F-4416', 26, 'Venkatesh M']
  ].map(([id, name, bus, capacity, driver], i) => ({ id, band: i + 1, name, bus, capacity, driver, km: [8, 12, 15, 19, 23, 27][i], trips: 2 }));
  db.students.forEach((s) => { if (s.band) { s.routeId = 'R' + s.band; s.transportOnTime = 88 + Math.floor(r() * 12); } });

  // ---------- Admissions pipeline for 2027-28 ----------
  const FIRST = ['Advik', 'Ira', 'Vivaan', 'Anika', 'Shaurya', 'Navya', 'Ayaan', 'Kiara', 'Atharv', 'Pari', 'Rudra', 'Siya', 'Arnav', 'Mira', 'Ahaan', 'Zara'];
  const LAST = ['Rao', 'Pillai', 'Shetty', 'Bose', 'Kapoor', 'Hegde', 'Mishra', 'Chopra', 'Naidu', 'Saxena'];
  const SOURCES = ['Website', 'Walk-in', 'Referral', 'Social media', 'School fair'];
  const STATUS_MIX = ['Enquiry', 'Enquiry', 'Submitted', 'Submitted', 'In review', 'In review', 'Offered', 'Offered', 'Enrolled', 'Opted out'];
  db.enquiries = Array.from({ length: 46 }, (_, i) => {
    const grade = r() < 0.3 ? 1 : 1 + Math.floor(r() * 12);
    const status = pick(STATUS_MIX);
    const first = pick(FIRST), last = pick(LAST), parent = pick(['Rakesh', 'Deepa', 'Sanjay', 'Lakshmi', 'Arjun', 'Pooja']) + ' ' + last;
    const day = String(1 + (i % 28)).padStart(2, '0'), month = ['09', '10', '11'][i % 3];
    const hist = [['Enquiry', `2026-${month}-${day}`]];
    const order = ['Enquiry', 'Submitted', 'In review', 'Offered', 'Enrolled'];
    const upto = status === 'Opted out' ? 1 + Math.floor(r() * 3) : order.indexOf(status);
    for (let k = 1; k <= upto && k < order.length; k++) hist.push([order[k], `2026-11-${String(1 + k * 3).padStart(2, '0')}`]);
    if (status === 'Opted out') hist.push(['Opted out', '2026-11-14']);
    return { id: 'A' + (++db.seq.enquiry), no: 'APP-2027-' + String(db.seq.enquiry).padStart(4, '0'), first, last, gender: r() > 0.5 ? 'Female' : 'Male',
      dob: `${2021 - grade}-0${1 + Math.floor(r() * 9)}-1${Math.floor(r() * 9)}`, grade, prevSchool: grade > 1 ? pick(['Little Steps Pre-school', 'City Public School', 'Sunbeam School', 'Home schooled']) : '',
      parent, mobile: '98' + String(10000000 + Math.floor(r() * 89999999)), email: first.toLowerCase() + '.parent' + i + '@example.com',
      source: pick(SOURCES), transport: r() > 0.5, status, history: hist.map(([s, at]) => ({ status: s, at, by: 'Front Office', note: '' })),
      interview: status === 'In review' || status === 'Offered' ? '2026-11-24' : '', reason: status === 'Opted out' ? pick(['Chose another school', 'Fees', 'Distance', 'Relocated']) : '',
      docs: { birthCert: status !== 'Enquiry', photo: status !== 'Enquiry', reportCard: grade > 1 && ['In review', 'Offered', 'Enrolled'].includes(status) }, year: '2027-28' };
  });
  return extendSeed3(db);
}
