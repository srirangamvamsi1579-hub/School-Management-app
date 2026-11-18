import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSeed } from '../src/data/seed.js';
import { signIn } from '../src/lib/auth.js';
import { checkStudent, childLines, parentTriesLeft, noteParentTry, MAX_PARENT_TRIES, deleteAccount, normalizeUsers, designationLabel, canResetPasswords, RESET_PW, archiveMatches, fromArchive, canAddUsers, sourceLabel, checkStaff, roleForStaff } from '../src/lib/users.js';

test('parent check: admission no., student name and grade must all match the student record', () => {
  const db = buildSeed();
  const ok = checkStudent(db, { admissionNo: 'adm-2025-0231', studentName: '  aarav  SHARMA ', grade: '8' });
  assert.equal(ok.student.admNo, 'ADM-2025-0231', 'case and spaces ignored');
  assert.ok(checkStudent(db, { admissionNo: 'ADM-2025-0231', studentName: 'Sharma Aarav', grade: '8' }).student, 'word order ignored');
  assert.ok(checkStudent(db, { admissionNo: 'ADM-2025-0231', studentName: 'Aarav', grade: '8' }).student, 'first name alone');
  assert.match(checkStudent(db, { admissionNo: 'ADM-2025-0231', studentName: 'Sharma', grade: '8' }).error, /don't match/, 'surname alone is not enough');
  assert.match(checkStudent(db, { admissionNo: 'ADM-2025-0231', studentName: 'Aarav Sharma', grade: '7' }).error, /don't match/, 'wrong grade');
  assert.match(checkStudent(db, { admissionNo: 'ADM-2025-0231', studentName: 'Rahul Sharma', grade: '8' }).error, /don't match/, 'wrong name');
  assert.match(checkStudent(db, { admissionNo: 'ADM-2099-9999', studentName: 'Aarav Sharma', grade: '8' }).error, /don't match/, 'unknown number');
  assert.match(checkStudent(db, { admissionNo: '231', studentName: 'Aarav', grade: '8' }).error, /like ADM-/);
  assert.match(checkStudent(db, { admissionNo: 'ADM-2025-0231', studentName: '', grade: '8' }).error, /name/);
  // the same message for every mismatch, so it doesn't reveal which part was wrong
  const msgs = new Set([['Sharma', '8'], ['Aarav Sharma', '7'], ['Rahul', '8']].map(([n, g]) => checkStudent(db, { admissionNo: 'ADM-2025-0231', studentName: n, grade: g }).error));
  assert.equal(msgs.size, 1);
  db.students.find((s) => s.admNo === 'ADM-2025-0231').status = 'Left';
  assert.ok(checkStudent(db, { admissionNo: 'ADM-2025-0231', studentName: 'Aarav Sharma', grade: '8' }).error, 'a student who left does not match');
});

test('parent check: wrong tries are limited per sign-in ID; a match clears them', () => {
  const db = buildSeed();
  for (let i = 0; i < MAX_PARENT_TRIES - 1; i++) noteParentTry(db, 'p@gmail.com', false);
  assert.equal(parentTriesLeft(db, 'p@gmail.com'), 1);
  assert.equal(parentTriesLeft(db, 'other@gmail.com'), MAX_PARENT_TRIES);
  noteParentTry(db, 'p@gmail.com', true);
  assert.equal(parentTriesLeft(db, 'p@gmail.com'), MAX_PARENT_TRIES);
});

test('Users shows each parent\'s student: admission no., name and grade', () => {
  const db = buildSeed();
  const parent = db.users.find((u) => u.role === 'PARENT' && (u.children?.length || u.linkedStudent));
  const lines = childLines(db, parent);
  assert.ok(lines.length >= 1 && lines.every((k) => k.ok && /^ADM-/.test(k.adm) && k.name && /^Grade /.test(k.grade)));
});

test('deleting archives the account; the school keeps contact details, a self-deletion does not', () => {
  const db = buildSeed();
  const t = db.users.find((u) => u.role === 'TEACHER' && u.status === 'ACTIVE' && u.email);
  const email = t.email;
  deleteAccount(db, t.id, 'Admin', { reason: 'Left the school' });
  assert.equal(t.status, 'DELETED');
  assert.ok(signIn(db, email, 'Demo@123').error, 'cannot sign in');
  const a = db.userArchive[0];
  assert.equal(a.email, email); assert.equal(a.reason, 'Left the school'); assert.equal(a.department, 'Academics'); assert.equal(a.deletedBy, 'Admin');
  assert.equal(a.rejoined, undefined, 'no rejoin status');
  const p = db.users.find((u) => u.role === 'PARENT' && u.email && (u.children?.length || u.linkedStudent));
  deleteAccount(db, p.id, 'Parent (self)', { self: true });
  const b = db.userArchive[0];
  assert.equal(b.email, ''); assert.equal(b.mobile, ''); assert.equal(b.login, ''); assert.ok(b.children.length, 'children kept');
});

test('parents never wait for approval; no switched-off status; N/A designation; reset password only for Admin or a granted person', () => {
  const db = buildSeed();
  assert.ok(!db.users.some((u) => (u.role || u.requestedRole) === 'PARENT' && u.status === 'PENDING'), 'seed has no pending parent');
  // older saved data: a pending parent and a switched-off account
  db.users.push({ id: 'X1', name: 'Old Parent', requestedRole: 'PARENT', role: null, status: 'PENDING', linkedStudent: 'ADM-2025-0231', login: 'old@example.com' });
  db.users.push({ id: 'X2', name: 'Old Off', role: 'TEACHER', status: 'DISABLED', login: 'off@example.com' });
  normalizeUsers(db);
  const x1 = db.users.find((u) => u.id === 'X1');
  assert.equal(x1.status, 'ACTIVE'); assert.equal(x1.role, 'PARENT'); assert.deepEqual(x1.children, ['ADM-2025-0231']);
  assert.equal(db.users.find((u) => u.id === 'X2').status, 'LOCKED');
  assert.equal(designationLabel(x1), 'N/A');
  assert.equal(designationLabel({ role: 'TEACHER', designation: 'TGT' }), 'TGT');
  assert.ok(canResetPasswords({}, 'ADMIN'));
  assert.ok(!canResetPasswords({ perms: [] }, 'PRINCIPAL'));
  assert.ok(canResetPasswords({ perms: [RESET_PW] }, 'PRINCIPAL'));
});

test('coming back: Add user copies details from the archive and checks them against today', () => {
  const db = buildSeed();
  const t = db.users.find((u) => u.role === 'TRANSPORT' && u.status === 'ACTIVE' && u.email);
  const email = t.email;
  deleteAccount(db, t.id, 'Admin', { reason: 'Left the school' });
  const roles = [{ code: 'TRANSPORT' }, { code: 'PARENT' }, { code: 'TEACHER' }];
  const fit = (r, d) => d;
  const [a] = archiveMatches(db, email.slice(0, 6));
  assert.equal(a.userId, t.id, 'found by email');
  const r = fromArchive(db, a, { roles, fit });
  assert.equal(r.fields.identifier, a.login); assert.equal(r.fields.role, 'TRANSPORT'); assert.equal(r.notes.length, 0);
  assert.equal(fromArchive(db, a, { roles: [{ code: 'PARENT' }], fit }).fields.role, '', 'a profile that no longer exists is left to pick');
  const p = db.users.find((u) => u.role === 'PARENT' && u.email && (u.children?.length || u.linkedStudent));
  deleteAccount(db, p.id, 'Parent (self)', { self: true });
  const b = db.userArchive[0];
  const rb = fromArchive(db, b, { roles, fit });
  assert.equal(rb.fields.identifier, ''); assert.ok(rb.notes.some((n) => /not kept/.test(n)));
  assert.equal(rb.fields.admissionNo, b.children[0].adm); assert.ok(rb.fields.studentName && rb.fields.grade, 'student details from today’s record');
  assert.ok(checkStudent(db, rb.fields).student, 'copied student details pass the check');
});

test('accounts come from registration; only the Admin adds someone, with a reason', () => {
  const db = buildSeed();
  assert.ok(canAddUsers('ADMIN')); assert.ok(!canAddUsers('PRINCIPAL')); assert.ok(!canAddUsers('TEACHER'));
  assert.ok(db.users.filter((u) => !['ADMIN', 'PLATFORM'].includes(u.role)).every((u) => ['WEBSITE', 'APP'].includes(u.source)), 'demo accounts registered themselves');
  assert.equal(sourceLabel({ source: 'APP' }), 'Registered in the app');
  assert.equal(sourceLabel({ source: 'ADMIN', addReason: 'Needs help to register' }), 'Added by the Admin — Needs help to register');
});

test('staff are checked against the staff record: employee code, name and the email or mobile on file; role from the record', () => {
  const db = buildSeed();
  const ok = checkStaff(db, { employeeCode: 'emp-0131', first: 'kavya', last: 'IYER', identifier: 'kavya.iyer@example.com' });
  assert.equal(ok.role, 'TEACHER'); assert.equal(ok.designation, 'PRT');
  assert.ok(checkStaff(db, { employeeCode: 'EMP-0131', first: 'Kavya', last: '', identifier: '9845077001' }).staff, 'mobile on file, first name only');
  assert.match(checkStaff(db, { employeeCode: 'EMP-0131', first: 'Kavya', last: 'Iyer', identifier: 'someone@gmail.com' }).error, /don't match/, 'email not on the record');
  assert.match(checkStaff(db, { employeeCode: 'EMP-0131', first: 'Divya', last: 'Iyer', identifier: 'kavya.iyer@example.com' }).error, /don't match/, 'wrong name');
  assert.match(checkStaff(db, { employeeCode: 'EMP-0999', first: 'Kavya', last: 'Iyer', identifier: 'kavya.iyer@example.com' }).error, /don't match/, 'unknown code');
  assert.match(checkStaff(db, { employeeCode: '131', first: 'Kavya' }).error, /like EMP-/);
  const roles = Object.fromEntries(db.staff.map((s) => [s.desig, roleForStaff(db, s)]));
  assert.equal(roles.Principal, 'PRINCIPAL'); assert.equal(roles.Accountant, 'ACCOUNTANT'); assert.equal(roles.Driver, 'TRANSPORT'); assert.equal(roles['Office Assistant'], 'FRONT_OFFICE');
  assert.ok(!db.users.some((u) => u.status === 'PENDING'), 'nobody is waiting for approval');
});
