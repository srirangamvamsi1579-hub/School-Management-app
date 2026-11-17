// Release 5: leave, late arrival, meeting a teacher and office requests from the parent app
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSeed } from '../src/data/seed.js';
import { submitRequest, decide, cancelRequest, manifest, markArrived, teachersFor } from '../src/lib/pickup.js';
import { screensFor } from '../src/lib/auth.js';

const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const fresh = () => { const db = buildSeed(); db.requests = []; db.attendance = {}; return db; };
const rider = (db) => db.students.find((s) => s.routeId && s.admNo !== 'ADM-2025-0231');
const row = (db, d, trip, id) => manifest(db, d, trip).routes.flatMap((r) => r.rows).find((x) => x.id === id);

test('leave: needs a reason, coordinator approves, attendance shows Leave, bus skips the child', () => {
  const db = fresh(); const s = rider(db); const c = db.coordinators[s.sectionId];
  assert.throws(() => submitRequest(db, { studentId: s.id, type: 'LEAVE', dateFrom: day(1), dateTo: day(3) }, { name: 'P' }), /reason/);
  const r = submitRequest(db, { studentId: s.id, type: 'LEAVE', dateFrom: day(1), dateTo: day(3), reason: 'Wedding' }, { name: 'P' });
  assert.equal(r.status, 'Submitted');
  assert.equal(row(db, day(2), 'AM', s.id).status, 'CHECK');
  const other = db.staff.find((x) => ![c.primary, c.secondary].includes(x.id));
  assert.throws(() => decide(db, r.id, 'Approved', { by: 'X', staffId: other.id }), /coordinators/);
  decide(db, r.id, 'Approved', { by: 'Coord', staffId: c.primary });
  assert.equal(row(db, day(2), 'AM', s.id).status, 'NOT_BOARDING');
  assert.match(row(db, day(2), 'PM', s.id).reason, /On leave/);
  const marked = Object.entries(db.attendance).filter(([k, v]) => k.startsWith(s.sectionId) && v[s.id] === 'L').length;
  assert.ok(marked >= 2, 'leave days marked in attendance');
  assert.throws(() => submitRequest(db, { studentId: s.id, type: 'LEAVE', dateFrom: day(2), reason: 'again' }, { name: 'P' }), /already a request/);
});

test('late arrival: time window checked, confirmed at once, gate marks arrival, morning bus skips', () => {
  const db = fresh(); const s = rider(db);
  assert.throws(() => submitRequest(db, { studentId: s.id, type: 'LATE_ARRIVAL', dateFrom: day(1), time: '08:00' }, { name: 'P' }), /after/);
  assert.throws(() => submitRequest(db, { studentId: s.id, type: 'LATE_ARRIVAL', dateFrom: day(1), time: '15:30' }, { name: 'P' }), /before/);
  const r = submitRequest(db, { studentId: s.id, type: 'LATE_ARRIVAL', dateFrom: day(1), time: '10:15', reason: 'Dentist' }, { name: 'P' });
  assert.equal(r.status, 'Approved');
  assert.equal(r.gateCode, '', 'no gate code for a drop-in');
  assert.match(row(db, day(1), 'AM', s.id).reason, /dropping at 10:15/);
  assert.equal(row(db, day(1), 'PM', s.id).status, 'BOARD', 'still goes home by bus');
  markArrived(db, r.id, 'Gate');
  assert.equal(db.attendance[s.sectionId + ':' + day(1)][s.id], 'LATE');
  assert.throws(() => markArrived(db, r.id, 'Gate'), /Not an expected/);
});

test('meeting: only the child’s teachers can be asked; only that teacher can confirm; parent is told the time', () => {
  const db = fresh(); const s = db.students.find((x) => x.admNo === 'ADM-2025-0231');
  const ts = teachersFor(db, s.id);
  assert.ok(ts.length >= 2 && ts.some((t) => t.subjects.includes('Class coordinator')));
  const stranger = db.staff.find((x) => !ts.some((t) => t.id === x.id));
  assert.throws(() => submitRequest(db, { studentId: s.id, type: 'MEETING', teacherId: stranger.id, mode: 'Phone call', dateFrom: day(1), reason: 'x' }, { name: 'P' }), /teachers/);
  const t = ts[0];
  const r = submitRequest(db, { studentId: s.id, type: 'MEETING', teacherId: t.id, mode: 'Phone call', dateFrom: day(1), reason: 'Maths progress' }, { name: 'P' });
  assert.equal(r.status, 'Submitted');
  assert.ok(db.outbox.some((m) => m.kind === 'Parent meeting request'));
  const other = ts.find((x) => x.id !== t.id);
  assert.throws(() => decide(db, r.id, 'Approved', { by: 'X', staffId: other.id, meetAt: { date: day(2), time: '15:30' } }), /teacher who was asked/);
  assert.throws(() => decide(db, r.id, 'Approved', { by: 'T', staffId: t.id }), /date and time/);
  decide(db, r.id, 'Approved', { by: 'T', staffId: t.id, meetAt: { date: day(2), time: '15:30' } });
  assert.deepEqual(r.meetAt, { date: day(2), time: '15:30' });
  assert.match(db.outbox[0].body, /15:30/);
  // a meeting never changes the bus
  assert.equal(row(db, day(1), 'PM', s.id).status, 'BOARD');
  // a second request to a different teacher the same day is fine
  submitRequest(db, { studentId: s.id, type: 'MEETING', teacherId: other.id, mode: 'Video call', dateFrom: day(1), reason: 'Science' }, { name: 'P' });
});

test('office request: goes to front office, marked done with a note, parent can cancel while open', () => {
  const db = fresh(); const s = db.students.find((x) => x.admNo === 'ADM-2025-0231');
  assert.throws(() => submitRequest(db, { studentId: s.id, type: 'OTHER', category: 'Transfer certificate', dateFrom: day(5) }, { name: 'P' }), /details/);
  const r = submitRequest(db, { studentId: s.id, type: 'OTHER', category: 'Bonafide / study certificate', dateFrom: day(5), reason: 'Passport' }, { name: 'P' });
  assert.ok(db.outbox.some((m) => m.kind === 'Office request'));
  assert.ok(!db.outbox.some((m) => m.kind === 'Coordinator alert' && m.related === r.no), 'coordinators are not spammed with office work');
  decide(db, r.id, 'Approved', { by: 'Office', note: 'Ready at the office' });
  assert.equal(r.status, 'Completed');
  assert.throws(() => cancelRequest(db, r.id, 'P'), /no longer/);
  const r2 = submitRequest(db, { studentId: s.id, type: 'OTHER', category: 'Fee query', dateFrom: day(5), reason: 'Q' }, { name: 'P' });
  cancelRequest(db, r2.id, 'P'); assert.equal(r2.status, 'Cancelled');
});

test('who sees the new inboxes', () => {
  const db = buildSeed();
  const u = (role) => db.users.find((x) => x.role === role && x.status === 'ACTIVE');
  assert.ok(screensFor(db, u('TEACHER'), 'TEACHER').includes('STU_MEETINGS'));
  assert.ok(!screensFor(db, u('TEACHER'), 'TEACHER').includes('STU_OFFICE'));
  assert.ok(screensFor(db, u('FRONT_OFFICE'), 'FRONT_OFFICE').includes('STU_OFFICE'));
  assert.ok(screensFor(db, u('PARENT'), 'PARENT').includes('SELF_REQUESTS'));
  assert.ok(!screensFor(db, u('PARENT'), 'PARENT').some((c) => ['STU_MEETINGS', 'STU_OFFICE', 'STU_REQUESTS'].includes(c)));
});
