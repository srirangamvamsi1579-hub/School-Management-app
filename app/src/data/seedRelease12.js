// Release 12 demo data (all fictional) and the upgrade of saved test data: employment type and transport staff,
// the bus fleet and breakdowns, route-map positions of stops and riders' homes, holidays, staff leave and alerts,
// and the new screens in each department's access list. Safe to run more than once.
import { DEFAULT_LEAVE_TYPES } from '../lib/leave.js';
import { ACCESS } from './menu.js';

const h = (s) => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const PART_TIME = ['EMP-0096', 'EMP-0054'];   // Computers and one language teacher work mornings only
const MORE_TRANSPORT = [
  // [first, last, designation, type, mobile, joined]
  ['Suresh', 'B', 'Driver', 'Full time', '9845022002', '2020-06-01'], ['Manjunath', 'S', 'Driver', 'Full time', '9845022003', '2019-06-01'],
  ['Prakash', 'R', 'Driver', 'Full time', '9845022004', '2023-06-01'], ['Imran', 'P', 'Driver', 'Full time', '9845022005', '2024-06-01'], ['Venkatesh', 'M', 'Driver', 'Full time', '9845022006', '2021-06-01'],
  ['Savitha', 'R', 'Bus Helper / Attendant', 'Part time', '9845022012', '2022-06-01'], ['Geetha', 'N', 'Bus Helper / Attendant', 'Part time', '9845022013', '2023-06-01'],
  ['Parvathi', 'K', 'Bus Helper / Attendant', 'Part time', '9845022014', '2024-06-01'], ['Shobha', 'M', 'Bus Helper / Attendant', 'Part time', '9845022015', '2025-06-01'], ['Revathi', 'S', 'Bus Helper / Attendant', 'Part time', '9845022016', '2026-06-01']];

// Route-map directions (degrees) per route; 1 map unit = 0.5 km, school at (50, 50)
const DIR = { R1: 300, R2: 210, R3: 160, R4: 30, R5: 110, R6: 250 };

export const NEW_CODES = ['STU_PROFILE', 'STU_REPORTCARD', 'SELF_LEAVE', 'HELP_FAQ', 'OPS_HELPDOCS'];

export function seedRelease12(db) {
  if (db.release >= 12) return db;
  const year = +String(db.year || '2026-27').slice(0, 4);
  // ---- Staff: employment type, more transport staff, salaries ----
  const n0 = db.staff.length;
  MORE_TRANSPORT.forEach(([first, last, desig, type, mobile, join], i) => {
    if (db.staff.some((s) => s.mobile === mobile)) return;
    const basic = desig === 'Driver' ? 21000 : 9000;
    db.staff.push({ id: 'E' + (n0 + i + 1), code: 'EMP-' + String(173 + i * 7).padStart(4, '0'), first, last, short: (first.slice(0, 2) + last).toUpperCase().slice(0, 4), dept: 'Transport', desig, type,
      gender: ['Savitha', 'Geetha', 'Parvathi', 'Shobha', 'Revathi'].includes(first) ? 'Female' : 'Male', mobile, email: '', join,
      salary: { Basic: basic, HRA: Math.round(basic * 0.3), DA: Math.round(basic * 0.1), Transport: 0, PF: Math.round(basic * 0.12), Tax: 0 }, status: 'Active' });
  });
  db.staff.forEach((s) => {
    if (!s.type) s.type = PART_TIME.includes(s.code) || s.desig === 'Bus Helper / Attendant' ? 'Part time' : 'Full time';
    if (s.type === 'Part time' && s.dept !== 'Transport') s.salary = { ...s.salary, Basic: Math.round(s.salary.Basic * 0.5), HRA: Math.round(s.salary.HRA * 0.5), DA: Math.round(s.salary.DA * 0.5) };
  });
  // Drivers and attendants named on the routes are the staff records
  (db.routes || []).forEach((r) => { const d = db.staff.find((s) => `${s.first} ${s.last}` === r.driver); if (d) r.driverId = d.id; const a = db.staff.find((s) => `${s.first} ${s.last}` === r.attendant); if (a) r.attendantId = a.id; });

  // ---- Bus fleet and breakdowns ----
  db.buses = [...(db.routes || []).map((r) => ({ reg: r.bus, seats: r.capacity, status: 'In service', routeId: r.id, fitnessUntil: `${year + 1}-03-31`, lastService: `${year}-0${5 + (h(r.id) % 4)}-1${h(r.bus) % 9}` })),
    { reg: 'KA-01-F-4417', seats: 32, status: 'Spare', routeId: null, fitnessUntil: `${year + 1}-01-31`, lastService: `${year}-09-22` }];
  db.busIncidents = [
    { id: 'BI1', date: `${year}-06-24`, routeId: 'R4', bus: 'KA-01-F-4414', kind: 'Breakdown', detail: 'Engine overheated on Whitefield Main Road', delayMin: 55, students: 0, replacedBy: 'KA-01-F-4417', trip: 'AM' },
    { id: 'BI2', date: `${year}-07-30`, routeId: 'R2', bus: 'KA-01-F-4412', kind: 'Flat tyre', detail: 'Rear tyre at Sony Signal', delayMin: 25, students: 0, replacedBy: null, trip: 'PM' },
    { id: 'BI3', date: `${year}-09-08`, routeId: 'R4', bus: 'KA-01-F-4414', kind: 'Breakdown', detail: 'Clutch failure near ITPL', delayMin: 70, students: 0, replacedBy: 'KA-01-F-4417', trip: 'AM' },
    { id: 'BI4', date: `${year}-10-14`, routeId: 'R6', bus: 'KA-01-F-4416', kind: 'Battery', detail: 'Would not start at the depot', delayMin: 35, students: 0, replacedBy: 'KA-01-F-4417', trip: 'AM' },
    { id: 'BI5', date: `${year}-11-12`, routeId: 'R4', bus: 'KA-01-F-4414', kind: 'Breakdown', detail: 'Brake warning light; bus taken off the road', delayMin: 45, students: 0, replacedBy: 'KA-01-F-4417', trip: 'PM' }];
  db.busIncidents.forEach((b) => { b.students = db.students.filter((s) => s.status === 'Active' && s.routeId === b.routeId).length; });

  // ---- Route map: stop positions and riders' homes ----
  (db.routes || []).forEach((r) => {
    const a = (DIR[r.id] * Math.PI) / 180;
    const far = Math.min(44, (r.km * 0.85) / 0.5);
    r.stops.forEach((st, k) => {
      const d = far * (1 - k * 0.3), side = ((h(r.id + st.name) % 9) - 4) * 1.2;
      st.x = Math.round((50 + d * Math.cos(a) - side * Math.sin(a)) * 10) / 10;
      st.y = Math.round((50 + d * Math.sin(a) + side * Math.cos(a)) * 10) / 10;
    });
    // R4's middle two stops are driven in a roundabout order today, so the planner has something to suggest
    if (r.id === 'R4' && r.stops.length >= 3) { const [s0, s1, s2] = r.stops; [s0.x, s1.x] = [s1.x, s0.x]; [s0.y, s1.y] = [s1.y, s0.y]; s2.x += 0; }
  });
  db.students.filter((s) => s.routeId).forEach((s, i) => {
    const r = db.routes.find((x) => x.id === s.routeId);
    if (!s.stop) s.stop = r.stops[h(s.id) % r.stops.length].name;
    const st = r.stops.find((x) => x.name === s.stop) || r.stops[0];
    const dx = ((h(s.id + 'x') % 21) - 10) / 10, dy = ((h(s.id + 'y') % 21) - 10) / 10;
    s.home = { x: Math.round((st.x + dx * 1.6) * 10) / 10, y: Math.round((st.y + dy * 1.6) * 10) / 10 };
    // A few riders live nearer another stop, and three R2 riders live together far from any stop
    if (i % 17 === 3) { const other = r.stops[(r.stops.indexOf(st) + 1) % r.stops.length]; s.home = { x: other.x + 0.4, y: other.y - 0.3 }; }
  });
  const r2 = db.students.filter((s) => s.routeId === 'R2').slice(0, 3);
  const r2s = db.routes.find((x) => x.id === 'R2')?.stops[0];
  if (r2s) r2.forEach((s, k) => { s.home = { x: r2s.x - 6 + k * 0.5, y: r2s.y + 4 - k * 0.4 }; });

  // ---- Holidays (school calendar) ----
  db.holidays = [
    { date: `${year}-08-15`, name: 'Independence Day' }, { date: `${year}-09-14`, name: 'Ganesh Chaturthi' }, { date: `${year}-10-02`, name: 'Gandhi Jayanti' },
    { date: `${year}-10-19`, name: 'Dussehra break' }, { date: `${year}-10-20`, name: 'Dussehra break' }, { date: `${year}-11-09`, name: 'Deepavali' }, { date: `${year}-12-25`, name: 'Christmas' }];

  // ---- Staff leave: types, history, two requests waiting ----
  db.leaveTypes = DEFAULT_LEAVE_TYPES.map((t) => ({ ...t }));
  const by = (code) => db.staff.find((s) => s.code === code);
  const principal = db.users.find((u) => u.role === 'PRINCIPAL'), vp = db.users.find((u) => u.designation === 'Vice Principal'), admin = db.users.find((u) => u.role === 'ADMIN');
  const L = (id, code, type, from, to, days, reason, status, approvers, decidedBy = null) => ({ id, staffId: by(code)?.id, type, from, to, half: false, days, reason, status, approvers, decidedBy, at: `${from}T09:00:00Z`, by: `${by(code)?.first} ${by(code)?.last}` });
  const T = [principal?.id, vp?.id].filter(Boolean), O = [principal?.id, admin?.id].filter(Boolean);
  db.staffLeaves = [
    L('LV1', 'EMP-0012', 'CL', `${year}-07-10`, `${year}-07-11`, 2, 'Family function', 'APPROVED', T, principal?.name),
    L('LV2', 'EMP-0012', 'SL', `${year}-09-03`, `${year}-09-03`, 1, 'Fever', 'APPROVED', T, vp?.name),
    L('LV3', 'EMP-0103', 'CL', `${year}-08-21`, `${year}-08-21`, 1, 'Bank work', 'APPROVED', O, principal?.name),
    L('LV4', 'EMP-0061', 'EL', `${year}-12-21`, `${year}-12-24`, 4, 'Travelling home for a wedding', 'PENDING', T),
    L('LV5', 'EMP-0110', 'CL', `${year}-11-27`, `${year}-11-27`, 1, 'Child’s school event', 'PENDING', O)].filter((r) => r.staffId);
  db.seq.leave = 5;
  db.staffAttendance = db.staffAttendance || {};
  db.alerts = db.alerts || [];
  db.seq.alert = db.seq.alert || 0;
  db.staffLeaves.filter((r) => r.status === 'PENDING').forEach((r) => { const st = db.staff.find((s) => s.id === r.staffId);
    r.approvers.forEach((u) => db.alerts.push({ id: `N0-${r.id}-${u}`, userId: u, title: `Leave to approve: ${st.first} ${st.last}`, body: `${db.leaveTypes.find((t) => t.code === r.type).name}, ${r.days} day(s) from ${r.from}. Reason: ${r.reason}`, screen: 'STF_LEAVE', at: r.at, read: false })); });

  // ---- Report cards, help documents and FAQs added by the school ----
  db.reportCards = db.reportCards || [];
  db.helpDocs = db.helpDocs || [{ id: 'HD1', title: 'School calendar 2026-27', kind: 'LINK', url: 'https://www.example.com/calendar-2026-27.pdf', menu: 'HELP_FAQ', roles: ['ALL'], addedBy: 'Admin user', at: `${year}-06-01T10:00:00Z`, version: 1 }];
  db.schoolFaqs = db.schoolFaqs || [{ id: 'SF1', topic: 'School rules', q: 'What time does the school gate close in the morning?', a: 'The gate closes at 08:50. Children arriving later are marked Late at the Gate Desk.', roles: ['ALL'], addedBy: 'Admin user' }];

  // ---- Last year's figures used by the new dashboard insights ----
  const ly = db.history?.[`${year - 1}-${String(year).slice(2)}`];
  if (ly) {
    const was = db.staff.filter((x) => x.status === 'Active' && x.join < `${year}-04-01`);
    ly.staffByType = { 'Full time': was.filter((x) => x.type === 'Full time').length + 1, 'Part time': was.filter((x) => x.type === 'Part time').length - 1 };
    ly.staff = was.length; ly.busIncidents = 7; ly.buses = 7;
    ly.staffByGender = { Male: was.filter((x) => x.gender === 'Male').length + 1, Female: was.filter((x) => x.gender === 'Female').length - 1 };
  }

  // ---- Access: the new screens in every department's list; Add Staff now lives inside All Staff ----
  const swap = (list) => {
    let l = list.filter((c) => c !== 'STF_ADD').map((c) => (c === 'STU_PROMOTE' ? 'STU_REPORTCARD' : c));
    if (l.includes('STU_LIST') && !l.includes('STU_PROFILE')) l.push('STU_PROFILE');
    if (l.includes('HELP_GUIDE') && !l.includes('HELP_FAQ')) l.push('HELP_FAQ');
    if (l.includes('EXM_PROFILE') && !l.includes('STU_REPORTCARD')) l.push('STU_REPORTCARD');
    if (l.includes('SELF_PAYSLIP') && !l.includes('SELF_LEAVE')) l.push('SELF_LEAVE');
    return [...new Set(l)];
  };
  Object.keys(db.deptPerms || {}).forEach((d) => { db.deptPerms[d] = swap(db.deptPerms[d]); });
  if (db.perms) Object.keys(db.perms).forEach((r) => { db.perms[r] = swap(db.perms[r]); });
  // Teachers apply in My Leave; approving stays with the Principal and the Vice Principal
  const acad = Object.keys(db.deptPerms || {}).find((d) => (db.deptPerms[d] || []).includes('EXM_QP') && !(db.deptPerms[d] || []).includes('PAY_RUN'));
  if (acad && !ACCESS.TEACHER.includes('STF_LEAVE')) db.deptPerms[acad] = db.deptPerms[acad].filter((c) => c !== 'STF_LEAVE');
  db.designationAccess = db.designationAccess || {};
  db.designationAccess['Vice Principal'] = [...new Set([...(db.designationAccess['Vice Principal'] || []), 'STF_LEAVE'])];
  db.release = 12;
  return db;
}
