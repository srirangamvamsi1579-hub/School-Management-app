// Release 12: attendance registers, staff leave and approvals, route planning, results and report cards,
// dashboard figures and insights, conversion templates, menus and the upgrade of saved data.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSeed } from '../src/data/seed.js';
import { MENU, ACCESS } from '../src/data/menu.js';
import { seedRelease12 } from '../src/data/seedRelease12.js';
import { studentMark, setStudentMark, staffMark, summarize, days, studentSummary } from '../src/lib/attendance.js';
import { balances, checkLeave, applyLeave, decideLeave, cancelLeave, approversFor } from '../src/lib/leave.js';
import { alertsFor, unreadFor } from '../src/lib/alerts.js';
import { routeOptions, applyOption, pickupSuggestions, addStop, removeStop, moveRider, timingsFor } from '../src/lib/routing.js';
import { gradeOf, standing, reportCard, examPct } from '../src/lib/results.js';
import { staffFigures, transportFigures, monthsPaid, studentInsights, staffInsights, transportInsights, feeInsights, enrolInsights } from '../src/lib/dashboard.js';
import { TEMPLATES, templateFile, templateForFile, checkTemplate, loadTemplate } from '../src/lib/importTemplates.js';
import { rollbackImport } from '../src/lib/logic.js';
import { screensFor } from '../src/lib/auth.js';

const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const nextWeekday = (from, wd) => { let d = addDays(from, 1); while (new Date(d + 'T00:00:00Z').getUTCDay() !== wd) d = addDays(d, 1); return d; };
const today = new Date().toISOString().slice(0, 10);

test('menus: Student Profile, Report Cards (not Promote), Add Staff inside All Staff, My Leave, FAQs, Help documents', () => {
  const codes = MENU.flatMap((m) => m.items.map((i) => i[0]));
  ['STU_PROFILE', 'STU_REPORTCARD', 'SELF_LEAVE', 'HELP_FAQ', 'OPS_HELPDOCS'].forEach((c) => assert.ok(codes.includes(c), c));
  ['STU_PROMOTE', 'STF_ADD'].forEach((c) => assert.ok(!codes.includes(c), c + ' removed'));
  assert.ok(ACCESS.TEACHER.includes('SELF_LEAVE') && !ACCESS.TEACHER.includes('STF_LEAVE'), 'teachers apply in My Leave, not the approval screen');
  const db = buildSeed();
  const vp = db.users.find((u) => u.designation === 'Vice Principal');
  assert.ok(screensFor(db, vp, vp.role).includes('STF_LEAVE'), 'the Vice Principal approves');
  const teacher = db.users.find((u) => u.id === 'U4');
  const mine = screensFor(db, teacher, 'TEACHER');
  assert.ok(mine.includes('STU_PROFILE') && mine.includes('STU_REPORTCARD') && mine.includes('SELF_LEAVE') && mine.includes('HELP_FAQ'));
});

test('upgrade of saved data runs once and keeps working', () => {
  const db = buildSeed();
  const n = db.staff.length;
  db.release = 9; seedRelease12(db);
  assert.equal(db.staff.length, n, 'no duplicate staff');
  assert.equal(db.release, 12);
  Object.values(db.deptPerms).forEach((l) => assert.ok(!l.includes('STU_PROMOTE') && !l.includes('STF_ADD')));
});

test('attendance register: holidays, saved marks, cycle, summary', () => {
  const db = buildSeed();
  const s = db.students.find((x) => x.sectionId === 'C8A');
  const sunday = days('2026-07-01', '2026-07-07').find((d) => new Date(d + 'T00:00:00Z').getUTCDay() === 0);
  assert.equal(studentMark(db, s, sunday), 'H');
  assert.equal(studentMark(db, s, '2026-08-15'), 'H', 'Independence Day');
  assert.equal(studentMark(db, s, addDays(today, 30)), null, 'future days are blank');
  setStudentMark(db, s, '2026-07-01', 'A');
  assert.equal(studentMark(db, s, '2026-07-01'), 'A');
  const sum = summarize(['P', 'P', 'A', 'LATE', 'H', null]);
  assert.deepEqual([sum.days, sum.present, sum.A, sum.pct], [4, 3, 1, 75]);
  const july = studentSummary(db, s, '2026-07-01', '2026-07-31');
  assert.ok(july.days >= 25 && july.days <= 27 && july.pct > 50);
});

test('staff leave: balances, rules, approvers are notified, decision, register, cancel', () => {
  const db = buildSeed();
  const sonia = db.staff.find((s) => s.code === 'EMP-0012');
  const u = db.users.find((x) => x.staffId === sonia.id);
  const b = balances(db, sonia.id);
  assert.equal(b.find((x) => x.code === 'CL').taken, 2);
  assert.ok(!b.some((x) => x.code === 'PL'), 'paternity leave not offered to women');
  const mon = nextWeekday(today, 1);
  assert.match(checkLeave(db, sonia, { type: 'CL', from: mon, to: addDays(mon, 4), reason: 'Trip' }), /up to 3 days/);
  assert.match(checkLeave(db, sonia, { type: 'EL', from: addDays(today, 2), to: addDays(today, 2), reason: 'Trip' }), /7 days ahead/);
  assert.match(checkLeave(db, sonia, { type: 'CL', from: addDays(today, -3), to: addDays(today, -3), reason: 'Late' }), /Only sick leave/);
  const approvers = approversFor(db, sonia);
  const principal = db.users.find((x) => x.role === 'PRINCIPAL'), vp = db.users.find((x) => x.designation === 'Vice Principal');
  assert.deepEqual(approvers.sort(), [principal.id, vp.id].sort());
  const before = unreadFor(db, principal.id);
  const r = applyLeave(db, sonia, { type: 'CL', from: mon, to: addDays(mon, 1), reason: 'Family function' }, u);
  assert.equal(r.status, 'PENDING'); assert.equal(r.days, 2);
  assert.equal(unreadFor(db, principal.id), before + 1, 'the Principal is notified');
  assert.ok(alertsFor(db, vp.id).some((a) => a.title.includes('Sonia')), 'the Vice Principal is notified');
  assert.ok(db.outbox.some((m) => m.subject.startsWith('Leave to approve')), 'and emailed');
  assert.match(checkLeave(db, sonia, { type: 'SL', from: mon, to: mon, reason: 'Fever' }), /Overlaps/);
  const admin = db.users.find((x) => x.role === 'ADMIN');
  assert.throws(() => decideLeave(db, r.id, 'APPROVED', admin), /not an approver/);
  assert.throws(() => decideLeave(db, r.id, 'DECLINED', principal, ''), /reason/);
  decideLeave(db, r.id, 'APPROVED', principal);
  assert.equal(staffMark(db, sonia, mon), 'L');
  assert.ok(alertsFor(db, u.id).some((a) => a.title.startsWith('Leave approved')), 'Sonia is told');
  assert.equal(balances(db, sonia.id).find((x) => x.code === 'CL').left, 12 - 2 - 2);
  cancelLeave(db, r.id, u.name);
  assert.equal(r.status, 'CANCELLED');
  // The Principal's own leave goes to the Admin
  const kp = db.staff.find((s) => s.desig === 'Principal');
  assert.deepEqual(approversFor(db, kp), [admin.id]);
});

test('route planning: shortest order, times that fit school times, pickup suggestions, add and remove stops', () => {
  const db = buildSeed();
  const opts = routeOptions(db, 'R4');
  assert.equal(opts[0].key, 'SHORTEST'); assert.ok(opts[0].saveMin > 5, 'R4 can be shorter');
  applyOption(db, 'R4', 'SHORTEST', 'test');
  const r4 = db.routes.find((r) => r.id === 'R4');
  r4.stops.forEach((s, i) => { assert.ok(s.am < r4.schoolArrive); assert.ok(s.pm > r4.schoolLeave); if (i) assert.ok(s.am > r4.stops[i - 1].am); });
  assert.equal(routeOptions(db, 'R4').find((o) => o.key === 'CURRENT').saveMin, 0);
  const sg = pickupSuggestions(db);
  assert.ok(sg.moves.length >= 1 && sg.moves.every((m) => m.newKm < m.nowKm));
  const ns = sg.newStops.find((n) => n.routeId === 'R2');
  assert.ok(ns && ns.riders.length >= 2 && ns.newKm < ns.nowKm);
  addStop(db, 'R2', { name: 'Lake Gate', x: ns.x, y: ns.y, riders: ns.riders.map((x) => x.id) });
  const r2 = db.routes.find((r) => r.id === 'R2');
  assert.ok(r2.stops.some((s) => s.name === 'Lake Gate'));
  assert.ok(ns.riders.every((x) => db.students.find((s) => s.id === x.id).stop === 'Lake Gate'));
  assert.throws(() => addStop(db, 'R2', { name: 'lake gate', x: 1, y: 1 }), /already has/);
  assert.throws(() => removeStop(db, 'R2', 'Lake Gate'), /Move the riders/);
  const m = sg.moves[0]; moveRider(db, m.studentId, m.toRoute, m.toStop);
  assert.equal(db.students.find((s) => s.id === m.studentId).stop, m.toStop);
  const t = timingsFor(r2.stops, '08:45', '15:15');
  assert.equal(t.length, r2.stops.length);
});

test('results: CBSE grades, ranks with ties, report card', () => {
  assert.deepEqual([gradeOf(91), gradeOf(90.9), gradeOf(33), gradeOf(32.9), gradeOf(null)], ['A1', 'A2', 'D', 'E', '—']);
  const db = buildSeed();
  const s = db.students.find((x) => x.sectionId === 'C8A');
  const st = standing(db, s, ['T1'], 'grade');
  assert.ok(st.rank >= 1 && st.rank <= st.of && st.of === db.students.filter((x) => x.sectionId.startsWith('C8')).length);
  const pt = examPct(db, s, 'PT1', 'English');
  assert.ok(pt >= 0 && pt <= 100);
  const rc = reportCard(db, s, 'T1_TERM');
  assert.equal(rc.exams.length, 2); assert.equal(rc.rows.length, 5);
  assert.ok(rc.attendance.days > 50, 'term attendance');
  assert.ok(['Pass', 'Needs improvement'].includes(rc.result));
});

test('dashboard: full and part time, salary by type, buses and breakdowns, insights', () => {
  const db = buildSeed();
  assert.equal(monthsPaid(db, '2026-11-18'), 7);
  const f = staffFigures(db);
  assert.equal(f.byType[0].count + f.byType[1].count, f.total);
  assert.ok(f.byType[1].count > 0 && f.byType[1].monthly < f.byType[0].monthly);
  assert.equal(f.byType[0].paid + f.byType[1].paid, f.paidTotal);
  assert.equal(f.categories.reduce((a, c) => a + c.count, 0), f.total);
  const t = transportFigures(db);
  assert.equal(t.buses.length, 7); assert.equal(t.spare, 1);
  assert.equal(t.incidents.length, 5); assert.equal(t.byBus[0][0], 'KA-01-F-4414');
  assert.ok(t.routes.every((r) => r.change === r.riders - r.before));
  for (const fn of [studentInsights, staffInsights, transportInsights, feeInsights, enrolInsights]) { const out = fn(db); assert.ok(out.length >= 1 && out.every((x) => typeof x === 'string' && !/undefined|NaN/.test(x)), fn.name); }
});

test('conversion templates: names, recognising files, checks, loading and rolling back', () => {
  assert.equal(TEMPLATES.length, 20);
  assert.equal(new Set(TEMPLATES.map((t) => t.no)).size, 20);
  assert.equal(templateFile(TEMPLATES[1]), '02_Student_Data.xlsx');
  assert.equal(templateForFile('02_Student_Data_GVS_20261118.xlsx').name, 'Student');
  assert.equal(templateForFile('12_Student_Transport_Data.xlsx').name, 'Student_Transport');
  assert.equal(templateForFile('Student list.xlsx'), null);
  assert.equal(templateForFile('02_Staff_Data.xlsx'), null, 'number and name must agree');
  const t = TEMPLATES.find((x) => x.name === 'Student_Transport');
  assert.deepEqual(checkTemplate(t, [{ 'Admission no': 'X' }]).missing, ['Route no', 'Stop name (landmark)', 'Uses']);
  const db = buildSeed();
  const s = db.students.find((x) => x.routeId === 'R1');
  const other = db.routes.find((r) => r.id === 'R2').stops[0].name;
  const rows = [{ 'Admission no': s.admNo, 'Route no': 'R2', 'Stop name (landmark)': other, Uses: 'Both ways' }, { 'Admission no': 'NOPE', 'Route no': 'R2', 'Stop name (landmark)': other, Uses: 'Both ways' }];
  assert.equal(checkTemplate(t, rows).ok, 2);
  const { job, errors } = loadTemplate(db, t, rows, '12_Student_Transport_Data_GVS_20261118.xlsx', 'test');
  assert.equal(job.rows, 1); assert.equal(errors.length, 1);
  assert.equal(s.routeId, 'R2');
  rollbackImport(db, job.id, 'test');
  assert.equal(s.routeId, 'R1', 'rolled back');
  const marks = TEMPLATES.find((x) => x.name === 'Exam_Marks');
  assert.match(checkTemplate(marks, [{ 'Admission no': 'A', Exam: 'Mid-term', Subject: 'Maths', 'Marks obtained': 'x', 'Maximum marks': '50' }]).rows[0].msgs.join(' '), /Exam should be one of.*Marks obtained should be a number/);
});
