// Demo data for the dashboard and staff registration (all fictional): more staff records, staff gender and joining
// dates, students who joined this year, last year's figures and grade limits. Deterministic: no random numbers.
const h = (s) => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

const FEMALE = ['Sonia', 'Shalini', 'Sanchita', 'Sana', 'Anita', 'Kavya', 'Meera', 'Kavita', 'Lakshmi', 'Divya', 'Rekha'];
const MORE_STAFF = [
  // [first, last, dept, designation, email, mobile, joined]
  ['Kavita', 'Menon', 'Leadership', 'Principal', 'principal@greenvalley.example.in', '9845010001', '2018-04-01'],
  ['Meera', 'Iyer', 'Leadership', 'Vice Principal', 'meera.vp@example.com', '9845010002', '2020-04-01'],
  ['Kavya', 'Iyer', 'Primary', 'PRT', 'kavya.iyer@example.com', '9845077001', '2026-11-16'],
  ['Divya', 'Nair', 'Primary', 'PRT', 'divya.nair@example.com', '9845077002', '2026-06-01'],
  ['Rekha', 'Shetty', 'Primary', 'PRT', 'rekha.shetty@example.com', '9845077003', '2026-06-01'],
  ['Manjunath', 'Gowda', 'Transport', 'Transport In-charge', 'transport@greenvalley.example.in', '9845022000', '2021-04-01'],
  ['Ramesh', 'K', 'Transport', 'Driver', 'ramesh.driver@example.com', '9845022001', '2022-04-01'],
  ['Lakshmi', 'B', 'Transport', 'Bus Helper / Attendant', 'lakshmi.b@example.com', '9845022011', '2026-07-01']];

export function seedDashboard(db) {
  const n0 = db.staff.length;
  MORE_STAFF.forEach(([first, last, dept, desig, email, mobile, join], i) => db.staff.push({ id: 'E' + (n0 + i + 1), code: 'EMP-' + String(117 + i * 7).padStart(4, '0'),
    first, last, short: first.slice(0, 3).toUpperCase(), dept, desig, mobile, email, join, salary: { Basic: 32000, HRA: 12800, DA: 3200, Transport: 1600, PF: 3840, Tax: 1500 }, status: 'Active' }));
  db.staff.forEach((s) => {
    s.gender = FEMALE.includes(s.first) ? 'Female' : 'Male';
    if (s.join === '2019-06-01' && h(s.code) % 6 === 0) s.join = '2026-06-01';      // a few joined this year
  });
  // Students: Grade I joined this year; a few others joined this year in higher grades
  db.students.forEach((s) => {
    const lv = parseInt(s.sectionId.slice(1), 10);
    s.joined = lv === 1 || h(s.id) % 13 === 0 ? '2026-04-0' + (1 + (h(s.id) % 9)) : `${2026 - lv + 1}-04-01`;
  });
  db.settings = { ...(db.settings || {}), coEd: true, staffRatio: 30, feeTarget: 95 };
  // Grade limits (seats planned per grade); some grades are over, some under
  db.gradeLimits = {};
  db.classes.forEach((c) => { const n = db.students.filter((s) => s.sectionId.startsWith(c.id) && s.sectionId.length > c.id.length && /^[A-Z]/.test(s.sectionId.slice(c.id.length))).length;
    db.gradeLimits[c.id] = Math.max(2, n + [-2, -1, 0, 1, 2, 3][h(c.id) % 6]); });
  // Last academic year (2025-26), for the arrows
  const byClassGender = {};
  db.classes.forEach((c) => ['Male', 'Female'].forEach((g) => {
    const now = db.students.filter((s) => s.status === 'Active' && s.gender === g && db.sections.find((x) => x.id === s.sectionId)?.classId === c.id).length;
    byClassGender[c.id + ':' + g] = Math.max(0, now + [-1, 0, 1, 1, -1, 2][h(c.id + g) % 6]);
  }));
  const staffLast = db.staff.filter((s) => s.join < '2026-04-01');
  const ridersNow = db.students.filter((s) => s.routeId);
  db.history = { '2025-26': {
    studentsByClassGender: byClassGender,
    newStudents: 21,
    staff: staffLast.length + 2, staffByGender: { Male: staffLast.filter((s) => s.gender === 'Male').length + 1, Female: staffLast.filter((s) => s.gender === 'Female').length + 1 },
    newStaff: 3,
    riders: ridersNow.length - 6, ridersByRoute: Object.fromEntries((db.routes || []).map((rt) => [rt.id, Math.max(0, ridersNow.filter((s) => s.routeId === rt.id).length - (h(rt.id) % 3))])),
    feesBilled: Math.round(db.invoices.reduce((a, i) => a + i.net, 0) * 0.93), feesCollected: Math.round(db.invoices.reduce((a, i) => a + i.net, 0) * 0.93 * 0.96),
    feesCollectedToDate: Math.round(db.invoices.reduce((a, i) => a + i.paid, 0) * 0.94),   // by the same date last year
    registrations: { WEBSITE: 9, APP: 4, ADMIN: 3 } } };
  // The staff sign-up waiting for approval is gone: staff now register against the staff record
  db.users = db.users.filter((u) => u.id !== 'U9');
  db.users.forEach((u) => { const st = db.staff.find((x) => x.email === u.login || x.mobile === u.login || `${x.first} ${x.last}` === u.name.replace(/^Dr\. /, '')); if (st && u.role !== 'PARENT') u.staffId = st.id; });
  return db;
}
