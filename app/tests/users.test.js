import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSeed } from '../src/data/seed.js';
import { signIn } from '../src/lib/auth.js';
import { checkStudent, childLines, parentTriesLeft, noteParentTry, MAX_PARENT_TRIES, rejoinPlan, deleteAccount } from '../src/lib/users.js';

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

test('deleting archives the account; the school keeps contact details, a self-deletion does not; rejoin plan checks today\'s state', () => {
  const db = buildSeed();
  const t = db.users.find((u) => u.role === 'TEACHER' && u.status === 'ACTIVE' && u.email);
  const email = t.email;
  deleteAccount(db, t.id, 'Admin', { reason: 'Left the school' });
  assert.equal(t.status, 'DELETED');
  assert.ok(signIn(db, email, 'Demo@123').error, 'cannot sign in');
  const a = db.userArchive[0];
  assert.equal(a.email, email); assert.equal(a.reason, 'Left the school'); assert.equal(a.department, 'Academics'); assert.equal(a.deletedBy, 'Admin');
  assert.equal(rejoinPlan(db, a).notes.length, 0, 'still fits');
  const p = db.users.find((u) => u.role === 'PARENT' && u.email && (u.children?.length || u.linkedStudent));
  deleteAccount(db, p.id, 'Parent (self)', { self: true });
  const b = db.userArchive[0];
  assert.equal(b.email, ''); assert.equal(b.mobile, ''); assert.equal(b.login, ''); assert.ok(b.children.length, 'children kept');
  const kid = db.students.find((s) => s.admNo === b.children[0].adm); kid.status = 'Left';
  const plan = rejoinPlan(db, b);
  assert.equal(plan.children.length, b.children.length - 1);
  assert.ok(plan.notes.some((n) => /no longer enrolled/.test(n)));
});
