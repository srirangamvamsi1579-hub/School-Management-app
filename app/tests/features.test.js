import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSeed } from '../src/data/seed.js';
import { signIn, sendOtp, checkOtp, createAccount, accountEmail, passwordProblems, idType, screensFor, canManageUsers, findUser } from '../src/lib/auth.js';
import { rankReport, transportReport, teacherPerformance, admissionsSummary, addEnquiry, moveEnquiry } from '../src/lib/analytics.js';

test('sign-in: password, lock after 5 wrong tries, pending accounts blocked', () => {
  const db = buildSeed();
  assert.ok(signIn(db, 'admin@greenvalley.example.in', 'Demo@123').user);
  assert.ok(signIn(db, '+91 98450 11200', 'Demo@123').user, 'mobile with +91 and spaces');
  for (let i = 0; i < 5; i++) signIn(db, 'sonia.teacher@example.com', 'nope');
  assert.match(signIn(db, 'sonia.teacher@example.com', 'Demo@123').error, /locked/);
  assert.match(signIn(db, 'farhan.ali@example.com', 'Demo@123').error, /waiting/);
});

test('sign-up: gmail or mobile, OTP, password rules, account email never contains the password', () => {
  const db = buildSeed();
  assert.equal(idType('new.parent@gmail.com'), 'EMAIL'); assert.equal(idType('9876543210'), 'MOBILE'); assert.equal(idType('12345'), null);
  assert.ok(passwordProblems('short').length > 0); assert.deepEqual(passwordProblems('Str0ng!pass'), []);
  const sms = sendOtp(db, { to: '9876543210', channel: 'SMS', purpose: 'SIGNUP', schoolName: 'X' });
  assert.equal(sms.status, 'GATEWAY_PENDING');
  const req = sendOtp(db, { to: 'new.parent@gmail.com', channel: 'EMAIL', purpose: 'SIGNUP', schoolName: 'X' });
  assert.match(checkOtp(db, { to: 'new.parent@gmail.com', purpose: 'SIGNUP', code: '000000' }) || '', /Wrong code/);
  assert.equal(checkOtp(db, { to: 'new.parent@gmail.com', purpose: 'SIGNUP', code: req.code }), null);
  const u = createAccount(db, { name: 'New Parent', identifier: 'new.parent@gmail.com', password: 'Str0ng!pass', requestedRole: 'PARENT', admissionNo: 'ADM-2025-0231' });
  assert.equal(u.status, 'PENDING');
  const mail = accountEmail(db, u, 'X', 'WELCOME');
  assert.equal(mail.to, 'new.parent@gmail.com'); assert.ok(!mail.body.includes('Str0ng!pass'));
  assert.equal(findUser(db, 'NEW.PARENT@gmail.com').id, u.id);
});

test('designation opens extra screens without changing the role', () => {
  const db = buildSeed();
  const vp = db.users.find((u) => u.designation === 'Vice Principal');
  const sonia = db.users.find((u) => u.login === 'sonia.teacher@example.com');
  assert.equal(vp.role, 'TEACHER');
  assert.ok(canManageUsers(db, vp, vp.role)); assert.ok(!canManageUsers(db, sonia, sonia.role));
  assert.ok(screensFor(db, vp, 'TEACHER').includes('STU_ADMISSIONS'));
});

test('top 6 / bottom 6 across all sections of a grade, and filtered to sections', () => {
  const db = buildSeed();
  const all = rankReport(db, { classId: 'C9' });
  assert.equal(all.top.length, 6); assert.equal(all.bottom.length, 6);
  assert.ok(all.top[0].score >= all.top[5].score && all.bottom[0].score <= all.bottom[5].score);
  assert.ok(new Set(all.rows.map((r) => r.section)).size === 6, 'clubs all six sections');
  const two = rankReport(db, { classId: 'C9', sectionIds: ['C9S1', 'C9S2'] });
  assert.ok(two.rows.every((r) => ['IX-S1', 'IX-S2'].includes(r.section)));
});

test('transport and teacher performance reports add up', () => {
  const db = buildSeed();
  const t = transportReport(db);
  assert.equal(t.routes.reduce((a, r) => a + r.riders, 0), db.students.filter((s) => s.band).length);
  const tp = teacherPerformance(db, {});
  assert.ok(tp.length > 5 && tp.every((r) => r.index >= 0 && r.index <= 100));
});

test('admissions: statuses, rules, enrol creates a student, summary by grade', () => {
  const db = buildSeed();
  const e = addEnquiry(db, { first: 'Test', last: 'Child', gender: 'Female', dob: '2019-05-01', grade: 2, parent: 'P', mobile: '9876500000', email: 'p@example.com', application: true }, 'test');
  assert.equal(e.status, 'Submitted');
  assert.throws(() => moveEnquiry(db, e.id, 'Enrolled', { by: 't' }), /Can't move/);
  moveEnquiry(db, e.id, 'In review', { by: 't', interview: '2026-11-30' });
  assert.throws(() => moveEnquiry(db, e.id, 'Offered', { by: 't' }), /Birth certificate/);
  e.docs.birthCert = true; e.docs.photo = true;
  moveEnquiry(db, e.id, 'Offered', { by: 't' });
  const before = db.students.length;
  const { student } = moveEnquiry(db, e.id, 'Enrolled', { by: 't' });
  assert.equal(db.students.length, before + 1); assert.ok(student.admNo);
  assert.equal(db.outbox[0].kind, 'Admission letter');
  const s = admissionsSummary(db, { grades: [2] });
  assert.equal(s.rows.length, 1); assert.ok(s.rows[0].Enrolled >= 1);
});
