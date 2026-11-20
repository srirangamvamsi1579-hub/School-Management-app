// Release 15: fixes from the November 2026 QA cycle (findings F01–F12 of the QA report)
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSeed } from '../src/data/seed.js';
import { PLAN_ADDONS, ADDON_OF, PLANS, canSee, funcOn } from '../src/data/menu.js';
import { DEFAULT_RATE_CARD as RC } from '../src/lib/pricing.js';
import { APP_PLAN } from '../src/lib/delivery.js';
import { admitStudent, nextAdmissionNo, recordPayment, ADM_NEW, initialOf } from '../src/lib/logic.js';
import { addEnquiry } from '../src/lib/analytics.js';
import { cleanMobile, mobileOk, nameProblem, dobCheck, realDate, moneyNote } from '../src/lib/validate.js';
import { addEvent, addBook, scheduleClass, setHomework } from '../src/lib/campus.js';
import { addUnit, addPortfolioItem } from '../src/lib/release14.js';
import { submitRequest } from '../src/lib/pickup.js';
import { proposalProblems } from '../src/lib/proposals.js';

const day = (k) => { const d = new Date(); d.setDate(d.getDate() + k); return d.toISOString().slice(0, 10); };
const kid = (o = {}) => ({ first: 'Kiran', last: 'Rao', gender: 'Male', dob: '2019-06-01', sectionId: 'C1A', guardianName: 'Suresh Rao', relation: 'Father', mobile: '9845012399', ...o });

test('F01: add-on-only menus follow the tier of the app plan, and stay in step with the price list', () => {
  for (const [tier, plan] of Object.entries(APP_PLAN)) {
    const rank = PLANS.find((p) => p.code === plan).rank;
    const want = RC.tiers.find((t) => t.code === tier).includes.filter((a) => Object.values(ADDON_OF).includes(a)).sort();
    assert.deepEqual([...PLAN_ADDONS[rank]].sort(), want, `${tier} (${plan})`);
  }
  const db = buildSeed(); const t2 = db.tenants.find((t) => t.id === 'T2'); const rank2 = 1;
  for (const c of ['DASH', 'STU_GATE', 'TRN_ROUTES', 'OPS_CHANNELS', 'OPS_TEMPLATES', 'OPS_BACKUP']) assert.equal(canSee(c, 'ADMIN', rank2, t2.overrides), false, c);
  assert.equal(funcOn(t2, 'FN_STOP_TIMINGS'), false);
  assert.equal(canSee('DASH', 'ADMIN', 1, { DASH: true }), true, 'a school that buys the Dashboard gets it');
  const t1 = db.tenants.find((t) => t.id === 'T1');
  assert.equal(canSee('TRN_ROUTES', 'TRANSPORT', 3, t1.overrides), true, 'Pro+ includes Transport');
});

test('F02: admission number = running number + surname initial + year of joining, at most 10 characters, never reused', () => {
  const db = buildSeed();
  const a = admitStudent(db, kid(), 'QA');
  assert.match(a.admNo, ADM_NEW); assert.ok(a.admNo.length <= 10); assert.equal(a.admNo.slice(4, 5), 'R'); assert.ok(a.admNo.endsWith('2026'));
  db.students.splice(db.students.indexOf(a), 1);                     // e.g. an import rolled back
  const b = admitStudent(db, kid({ first: 'Anu', last: '', mobile: '9845012300' }), 'QA');
  assert.notEqual(b.admNo, a.admNo); assert.equal(b.admNo.slice(4, 5), 'A', 'no surname → first-name initial');
  assert.ok(!db.students.some((s) => s !== b && s.id === b.id), 'student id not reused');
  assert.equal(initialOf('Évora'), 'E'); assert.equal(initialOf('श्री'), '');
  db.seq.admission[2027] = 99998; assert.equal(nextAdmissionNo(db, { last: 'Z', year: 2027 }).length, 10);
});

test('F03/F05/F06: admissions refuse bad names and impossible dates; duplicates need “save anyway”', () => {
  const db = buildSeed();
  assert.throws(() => admitStudent(db, kid({ first: '   ' }), 'QA'), /First name is required/);
  assert.throws(() => admitStudent(db, kid({ first: 'K1r@n#' }), 'QA'), /letters/);
  assert.throws(() => admitStudent(db, kid({ dob: day(30) }), 'QA'), /future/);
  assert.throws(() => admitStudent(db, kid({ dob: '1981-01-01' }), 'QA'), /over 20/);
  assert.match(dobCheck('2012-01-01', { level: 1, yearStart: '2026-04-01' }).warning, /unusual/);
  admitStudent(db, kid(), 'QA');
  assert.throws(() => admitStudent(db, kid(), 'QA'), (e) => e.code === 'DUPLICATE' && /Possible duplicate/.test(e.message));
  assert.ok(admitStudent(db, kid({ allowDuplicate: true }), 'QA').admNo);
  const e = addEnquiry(db, { first: 'Anu', parent: 'Ravi', mobile: '+91 98450 12345', grade: 2 }, 'QA');
  assert.equal(e.mobile, '9845012345', '+91 and spaces removed');
  assert.throws(() => addEnquiry(db, { first: 'anu ', parent: 'Ravi', mobile: '9845012345', grade: 2 }, 'QA'), (x) => x.code === 'DUPLICATE');
  assert.throws(() => addEnquiry(db, { first: 'Bo', parent: '  ', mobile: '9845012345', grade: 2 }, 'QA'), /Parent name/);
});

test('F07/F09/F11: amounts, counts and times', () => {
  const db = buildSeed(); const inv = db.invoices.find((i) => i.status !== 'PAID');
  for (const amount of [0, -500, 'abc']) assert.throws(() => recordPayment(db, { studentId: inv.studentId, amount, mode: 'Cash' }), /more than ₹0/);
  assert.throws(() => recordPayment(db, { studentId: inv.studentId, amount: 100, mode: 'UPI', ref: '' }), /reference/);
  assert.equal(recordPayment(db, { studentId: inv.studentId, amount: 100.456, mode: 'Cash' }).amount, 100.46);
  assert.equal(moneyNote('12.345'), 'Will be saved as ₹12.35 (rounded to paise)');
  assert.throws(() => addBook(db, { title: 'X', copies: 2.5 }), /whole number/);
  assert.throws(() => setHomework(db, { sectionId: db.sections[0].id, subject: '', title: 'X', due: day(1) }), /subject/);
  assert.throws(() => scheduleClass(db, { sectionId: db.sections[0].id, subject: 'Maths', date: day(0), time: '00:05', link: 'https://meet.example.com/a', now: '09:00' }), /already passed/);
  assert.throws(() => addUnit(db, { classId: db.classes[5].id, subject: 'Science', title: 'L', month: 'Jul', periods: 2.6 }), /whole number/);
});

test('F05/F10: dates and duplicates in events, books, units and portfolios', () => {
  const db = buildSeed();
  assert.ok(!realDate('2026-13-45') && !realDate('2026-02-31') && realDate('2026-02-28'));
  assert.throws(() => addEvent(db, { title: 'X', date: '31/02/2026' }), /valid date/);
  addEvent(db, { title: 'PTM', date: day(3) });
  assert.throws(() => addEvent(db, { title: 'ptm ', date: day(3) }), (e) => e.code === 'DUPLICATE');
  addBook(db, { title: 'Dup', author: 'A', copies: 1 });
  assert.throws(() => addBook(db, { title: 'dup', author: 'a', copies: 1 }), /add copies/);
  const u = { classId: db.classes[5].id, subject: 'Science', title: 'Light', month: 'Jul', periods: 8 };
  addUnit(db, u); assert.throws(() => addUnit(db, u), /already planned/);
  const s = db.students[0].id;
  assert.throws(() => addPortfolioItem(db, { studentId: s, title: 'X', kind: 'Project', date: day(30) }), /future/);
  assert.throws(() => addPortfolioItem(db, { studentId: s, title: 'X', kind: 'Project', date: '2026-13-45' }), /date/);
});

test('F08/F12: parents act only for their own children; mobile numbers are tidied, not cut', () => {
  const db = buildSeed(); const parent = db.users.find((u) => u.role === 'PARENT');
  const other = db.students.find((s) => !parent.children.includes(s.admNo));
  assert.throws(() => submitRequest(db, { studentId: other.id, type: 'LEAVE', dateFrom: day(3), dateTo: day(3), reason: 'X' }, parent), /own children/);
  assert.equal(cleanMobile('+91 98450 12399'), '9845012399'); assert.equal(cleanMobile('098450-12399'), '9845012399');
  assert.ok(!mobileOk('5551234567891')); assert.ok(!mobileOk('98450'));
  assert.equal(nameProblem('Anne-Marie O’Neil'), ''); assert.equal(nameProblem('श्री राम'), '');
  assert.deepEqual(proposalProblems({ client: 'X', poc: { name: 'A', email: 'a@school', phone: '12' } }), ['a valid contact email', 'a valid contact number (10 to 13 digits)']);
});
