// Designations follow the role; sign-ups land in the user table; View as is Admin only
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSeed } from '../src/data/seed.js';
import { designationsFor, fitDesignation, designationProblem, allDesignations } from '../src/data/designations.js';
import { createAccount, screensFor } from '../src/lib/auth.js';
import { viewAsUser, VIEW_AS } from '../src/data/menu.js';

test('each role offers only its own designations; parents are just Parent', () => {
  const db = buildSeed();
  assert.deepEqual(designationsFor(db, 'TRANSPORT'), ['Transport In-charge', 'Transport Supervisor', 'Driver', 'Cleaner', 'Bus Helper / Attendant']);
  assert.ok(designationsFor(db, 'TEACHER').includes('PGT') && !designationsFor(db, 'TEACHER').includes('Driver'));
  assert.deepEqual(designationsFor(db, 'PARENT'), ['Parent']);
  assert.equal(fitDesignation(db, 'PARENT', 'TGT'), 'Parent');
  assert.equal(fitDesignation(db, 'TRANSPORT', 'TGT'), '', 'a teacher designation is cleared when the role becomes Transport');
  assert.equal(fitDesignation(db, 'TEACHER', 'TGT'), 'TGT');
  assert.match(designationProblem(db, 'TRANSPORT', 'TGT'), /not a transport/);
  assert.match(designationProblem(db, 'TEACHER', ''), /Pick a designation/);
  assert.equal(designationProblem(db, 'PARENT', 'Parent'), '');
  assert.ok(!allDesignations(db).includes('Parent'));
});

test('schools can add designations; custom roles use the list of the role they came from', () => {
  const db = buildSeed();
  db.roleDesignations = { TRANSPORT: ['Route Marshal'] };
  assert.ok(designationsFor(db, 'TRANSPORT').includes('Route Marshal'));
  db.customRoles.push({ code: 'R_TRANSPORT_MANAGER', name: 'Transport Manager', basedOn: 'TRANSPORT' });
  assert.ok(designationsFor(db, 'R_TRANSPORT_MANAGER').includes('Driver'));
});

test('every seeded account has a designation that fits its role', () => {
  const db = buildSeed();
  for (const u of db.users.filter((x) => x.role && x.role !== 'PLATFORM' && x.status !== 'DELETED')) assert.equal(designationProblem(db, u.role, u.designation), '', `${u.name}: ${u.designation}`);
});

test('a self sign-up lands in the user table as pending with the role and designation asked for', () => {
  const db = buildSeed(); const n = db.users.length;
  const u = createAccount(db, { name: 'Ravi Kumar', identifier: '9876501234', password: 'Strong@123', requestedRole: 'TRANSPORT', designation: 'Driver' });
  assert.equal(db.users.length, n + 1);
  assert.equal(u.status, 'PENDING'); assert.equal(u.role, null); assert.equal(u.requestedRole, 'TRANSPORT'); assert.equal(u.designation, 'Driver');
});

test('View as Profile is for the Admin role only, even if granted by designation or by name', () => {
  const db = buildSeed();
  const admin = db.users.find((u) => u.role === 'ADMIN');
  assert.ok(screensFor(db, admin, 'ADMIN').includes('VA_PARENT'));
  const vp = db.users.find((u) => u.designation === 'Vice Principal');
  vp.extra = ['VA_PARENT']; db.designationAccess['Vice Principal'] = [...db.designationAccess['Vice Principal'], 'VA_TEACHER'];
  assert.ok(!screensFor(db, vp, 'TEACHER').some((c) => c.startsWith('VA_')));
  for (const code of Object.keys(VIEW_AS)) assert.ok(viewAsUser(db, code), 'a demo account for ' + code);
});

test('each user profile belongs to a department; schools can rename it; new profiles keep theirs', async () => {
  const { departmentOf } = await import('../src/data/designations.js');
  const db = buildSeed();
  assert.equal(departmentOf(db, 'TRANSPORT'), 'Transport');
  assert.equal(departmentOf(db, 'TEACHER'), 'Academics');
  db.roleDepartments = { TEACHER: 'Teaching Staff' };
  assert.equal(departmentOf(db, 'TEACHER'), 'Teaching Staff');
  db.customRoles.push({ code: 'R_WARDEN', name: 'Hostel Warden', basedOn: 'FRONT_OFFICE', department: 'Hostel' }, { code: 'R_TM', name: 'Transport Manager', basedOn: 'TRANSPORT' });
  assert.equal(departmentOf(db, 'R_WARDEN'), 'Hostel');
  assert.equal(departmentOf(db, 'R_TM'), 'Transport');
});

test('any designation can be removed from a profile, and added back', async () => {
  const db = buildSeed();
  db.roleDesignationsRemoved = { TRANSPORT: ['Cleaner'] };
  assert.ok(!designationsFor(db, 'TRANSPORT').includes('Cleaner'), 'standard designation removed');
  assert.ok(designationsFor(db, 'TRANSPORT').includes('Driver'));
  assert.equal(fitDesignation(db, 'TRANSPORT', 'Cleaner'), '', 'a removed designation is not offered when picking a role');
  db.customRoles.push({ code: 'R_TM', name: 'Transport Manager', basedOn: 'TRANSPORT' });
  assert.ok(!designationsFor(db, 'R_TM').includes('Cleaner'), 'a copied profile drops it too');
  db.roleDesignationsRemoved = {};
  assert.ok(designationsFor(db, 'TRANSPORT').includes('Cleaner'), 'added back');
});
