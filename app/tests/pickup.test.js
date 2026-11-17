import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSeed } from '../src/data/seed.js';
import { submitRequest, decide, handOver, cancelRequest, manifest, lateFor } from '../src/lib/pickup.js';
import { buildRequest, configProblems, queueSms, flushQueue } from '../src/lib/sms.js';
import { screensFor, canSharePerf, sendOtp } from '../src/lib/auth.js';

const today = new Date().toISOString().slice(0, 10);
const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
const fresh = () => { const db = buildSeed(); db.requests = []; db.attendance = {}; return db; };
const rider = (db) => db.students.find((s) => s.routeId && s.admNo !== 'ADM-2025-0231');

test('manifest: everyone boards unless absent or a request says otherwise', () => {
  const db = fresh(); const s = rider(db);
  assert.equal(manifest(db, tomorrow, 'AM').boarding, db.students.filter((x) => x.routeId).length);
  submitRequest(db, { studentId: s.id, type: 'OWN_TRANSPORT', dateFrom: tomorrow, dateTo: tomorrow }, { name: 'P' });
  const m = manifest(db, tomorrow, 'PM'); const row = m.routes.flatMap((r) => r.rows).find((x) => x.id === s.id);
  assert.equal(row.status, 'NOT_BOARDING'); assert.match(row.reason, /Own transport/);
  db.attendance[s.sectionId + ':' + tomorrow] = { [s.id]: 'A' };
  assert.equal(manifest(db, tomorrow, 'AM').routes.flatMap((r) => r.rows).find((x) => x.id === s.id).status, 'ABSENT');
});

test('early leave: coordinator approves, gate code checked, manifest shows who collected', () => {
  const db = fresh(); const s = rider(db);
  const c = db.coordinators[s.sectionId];
  const r = submitRequest(db, { studentId: s.id, type: 'EARLY_LEAVE', dateFrom: tomorrow, time: '11:30', reason: 'Doctor', collector: { name: 'Anil K', relation: 'Father', mobile: '9845000001' } }, { name: 'P' });
  assert.equal(r.status, 'Submitted');
  assert.equal(manifest(db, tomorrow, 'PM').routes.flatMap((x) => x.rows).find((x) => x.id === s.id).status, 'CHECK');
  assert.ok(db.outbox.filter((m) => m.kind === 'Coordinator alert').length >= 2, 'both coordinators told');
  const other = db.staff.find((x) => ![c.primary, c.secondary].includes(x.id));
  assert.throws(() => decide(db, r.id, 'Approved', { by: 'x', staffId: other.id }), /coordinators/);
  decide(db, r.id, 'Approved', { by: 'Secondary', staffId: c.secondary });
  assert.match(r.gateCode, /^\d{4}$/);
  assert.equal(db.smsQueue[0].purpose, 'GATE_CODE'); assert.equal(db.smsQueue[0].status, 'QUEUED_NO_GATEWAY');
  assert.throws(() => handOver(db, r.id, '0000' === r.gateCode ? '1111' : '0000', 'Gate'), /does not match/);
  handOver(db, r.id, r.gateCode, 'Gate');
  const row = manifest(db, tomorrow, 'PM').routes.flatMap((x) => x.rows).find((x) => x.id === s.id);
  assert.equal(row.status, 'NOT_BOARDING'); assert.match(row.reason, /Left early at .* with Anil K/);
  assert.throws(() => cancelRequest(db, r.id, 'P'), /no longer/);
});

test('cut-offs and validation', () => {
  const db = fresh(); const s = rider(db);
  assert.equal(lateFor({ type: 'DROP', dateFrom: today }), true, 'same-morning drop is late');
  assert.throws(() => submitRequest(db, { studentId: s.id, type: 'EARLY_LEAVE', dateFrom: tomorrow, time: '15:30', collector: { name: 'A', relation: 'Father', mobile: '9845000001' } }, {}), /before 15:00/);
  assert.throws(() => submitRequest(db, { studentId: s.id, type: 'PICKUP', dateFrom: tomorrow, collector: { name: '', mobile: '' } }, {}), /collecting/);
  const ok = submitRequest(db, { studentId: s.id, type: 'PICKUP', dateFrom: tomorrow, collector: { name: 'A', relation: 'Father', mobile: '9845000001' } }, {});
  assert.equal(ok.status, 'Approved', 'next-day pickup before cut-off confirmed at once');
  assert.throws(() => submitRequest(db, { studentId: s.id, type: 'PICKUP', dateFrom: tomorrow, collector: { name: 'A', relation: 'Father', mobile: '9845000001' } }, {}), /already/);
});

test('SMS framework: queued without provider, vendor requests, go live flushes non-OTP', () => {
  const db = fresh();
  const otp = sendOtp(db, { to: '9845011200', channel: 'SMS', purpose: 'SIGNIN', schoolName: 'X' });
  assert.equal(otp.status, 'GATEWAY_PENDING');
  queueSms(db, { to: '9845011200', purpose: 'FEE_REMINDER', vars: { amount: '₹10', student: 'A', date: 'today', link: 'l' }, schoolName: 'X' });
  const cfg = { ...db.smsConfig, provider: 'MSG91', secretRef: 'arn:x', sender: 'GVSSCH' };
  assert.ok(configProblems(cfg).some((p) => /DLT template/.test(p)));
  Object.values(cfg.templates).forEach((t) => { t.dltId = '1107000000000000001'; });
  assert.deepEqual(configProblems(cfg), []);
  const m = buildRequest(cfg, { to: '9845011200', purpose: 'OTP', vars: { code: '1' }, text: 't' });
  assert.equal(m.url, 'https://control.msg91.com/api/v5/flow/'); assert.equal(m.body.recipients[0].mobiles, '919845011200');
  const sns = buildRequest({ ...cfg, provider: 'AWS_SNS', entityId: 'E1' }, { to: '9845011200', purpose: 'OTP', vars: {}, text: 't' });
  assert.equal(sns.params.MessageAttributes['AWS.MM.SMS.TemplateId'].StringValue, '1107000000000000001');
  db.smsConfig = { ...cfg, status: 'LIVE' };
  assert.equal(flushQueue(db), 1); assert.equal(db.smsQueue.find((x) => x.purpose === 'OTP').status, 'EXPIRED');
});

test('teacher performance is hidden from teachers until shared', () => {
  const db = fresh();
  const t = db.users.find((u) => u.login === 'sonia.teacher@example.com');
  const hots = db.users.find((u) => u.designation === 'Head of Teaching Staff');
  assert.ok(!screensFor(db, t, 'TEACHER').includes('ANL_TEACHER')); assert.ok(!screensFor(db, t, 'TEACHER').includes('SELF_MYPERF'));
  assert.ok(canSharePerf(db, hots, 'TEACHER')); assert.ok(canSharePerf(db, null, 'PRINCIPAL')); assert.ok(!canSharePerf(db, t, 'TEACHER'));
  db.settings.teacherPerfShared = true;
  assert.ok(screensFor(db, t, 'TEACHER').includes('SELF_MYPERF')); assert.ok(!screensFor(db, t, 'TEACHER').includes('ANL_TEACHER'));
});
