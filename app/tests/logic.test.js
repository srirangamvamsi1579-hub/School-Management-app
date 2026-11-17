import { test } from 'node:test';
import assert from 'node:assert/strict';
import { amountInWords } from '../src/lib/format.js';
import { buildSeed } from '../src/data/seed.js';
import { recordPayment, sendFeeRequests, receiveNotification, mapRows, commitImport, rollbackImport, suggestField, transform, generatePaper, balance, renderFor } from '../src/lib/logic.js';
import { renderTemplate, sanitize } from '../src/data/templates.js';

test('amount in words matches the school invoice', () => {
  assert.equal(amountInWords(103070), 'One Lakh, Three Thousand And Seventy');
  assert.equal(amountInWords(12500000), 'One Crore, Twenty Five Lakh');
});

test('counter payment creates receipt, balanced voucher and confirmation email', () => {
  const db = buildSeed();
  const s = db.students.find((x) => x.admNo === 'ADM-2025-0231');
  const p = recordPayment(db, { studentId: s.id, amount: 103070, mode: 'UPI', ref: 'T1' });
  const v = db.vouchers[0];
  assert.equal(v.lines.reduce((a, l) => a + l.debit, 0), v.lines.reduce((a, l) => a + l.credit, 0));
  assert.equal(db.invoices.find((i) => i.no === 'INV-GVS-08374').status, 'PAID');
  assert.equal(db.outbox[0].kind, 'Payment confirmation');
  assert.ok(p.receiptNo);
});

test('fee requests per grade; guardians without email get SMS', () => {
  const db = buildSeed();
  const g = db.guardians.find((x) => x.id === db.students.find((s) => s.sectionId === 'C8B').guardianId); g.email = '';
  const c = sendFeeRequests(db, { classIds: ['C8'], scope: 'INST', dueDate: '2026-12-10', by: 'test' });
  assert.equal(c.counts.sent + c.counts.noEmail, db.messages.length);
  assert.ok(c.counts.noEmail >= 1);
  assert.ok(db.outbox.some((m) => m.body.includes('schoolfees@sbi')));
});

test('auto-matching by pay link, narration, duplicate and unmatched', () => {
  const db = buildSeed();
  sendFeeRequests(db, { classIds: ['C8'], scope: 'INST', dueDate: '2026-12-10', by: 'test' });
  const [m1, m2] = db.messages;
  const n1 = receiveNotification(db, { source: 'GATEWAY', ref: 'pay_1', amount: m1.due, mode: 'UPI', token: m1.token });
  assert.equal(n1.status, 'AUTO'); assert.equal(m1.status, 'PAID'); assert.match(m1.remarks, /confirmed automatically/);
  const adm = db.students.find((s) => s.id === m2.studentId).admNo;
  const n2 = receiveNotification(db, { source: 'BANK_STATEMENT', ref: 'UTR9', amount: 1000, mode: 'NEFT', narration: 'NEFT/UTR9/' + adm });
  assert.equal(n2.status, 'AUTO'); assert.equal(m2.status, 'PARTIAL');
  assert.equal(receiveNotification(db, { source: 'BANK_STATEMENT', ref: 'UTR9', amount: 1000, mode: 'NEFT' }).status, 'DUPLICATE');
  assert.equal(receiveNotification(db, { source: 'BANK_STATEMENT', ref: 'X1', amount: 7, mode: 'NEFT', narration: 'FEES' }).status, 'UNMATCHED');
});

test('parent UTR waits, then the bank line confirms it', () => {
  const db = buildSeed();
  sendFeeRequests(db, { classIds: ['C8'], scope: 'INST', dueDate: '2026-12-10', by: 'test' });
  const m = db.messages[0]; const adm = db.students.find((s) => s.id === m.studentId).admNo;
  assert.equal(receiveNotification(db, { source: 'UTR_SUBMITTED', ref: 'U55', amount: m.due, mode: 'UPI', narration: adm }).status, 'WAITING');
  assert.equal(receiveNotification(db, { source: 'BANK_STATEMENT', ref: 'U55', amount: m.due, mode: 'NEFT', narration: 'NEFT' }).status, 'AUTO');
  assert.equal(m.status, 'PAID');
});

test('import: suggestion, transforms, validation, commit and rollback', () => {
  const db = buildSeed();
  assert.equal(suggestField('STUDENTS', 'Adm No'), 'admission_no');
  assert.equal(suggestField('STUDENTS', 'Father Name'), 'guardian_name');
  assert.equal(transform('+91 98450 11223', 'PHONE_IN'), '9845011223');
  assert.equal(transform('31/02/2013', 'DATE'), '!31/02/2013');
  const prof = db.importProfiles[0];
  const rows = [
    { 'Adm No': 'N-1', 'Student Name': 'Riya Kulkarni', 'D.O.B': '14/03/2013', Sex: 'Girl', Std: '8th', Div: 'a', 'Father Name': 'ANIL KULKARNI', Mobile: '98450 11223', 'E-mail': 'x@example' },
    { 'Adm No': 'N-2', 'Student Name': 'Tara Iyer', 'D.O.B': '31/02/2013', Sex: 'Girl', Std: '8th', Div: 'A', 'Father Name': 'S Iyer', Mobile: '9845033445', 'E-mail': '' }];
  const out = mapRows(db, 'STUDENTS', rows, prof);
  assert.equal(out[0].status, 'WARNING'); assert.equal(out[0].out.guardian_name, 'Anil Kulkarni'); assert.equal(out[0].out.class, 'Grade VIII');
  assert.equal(out[1].status, 'ERROR');
  const before = db.students.length;
  const job = commitImport(db, 'STUDENTS', out.filter((r) => r.status !== 'ERROR'), 'f.csv', 'test');
  assert.equal(db.students.length, before + 1);
  rollbackImport(db, job.id, 'test');
  assert.equal(db.students.length, before);
});

test('paper sets do not share questions and follow the format', () => {
  const db = buildSeed();
  const p = generatePaper(db, { chapters: [1, 2, 4], mix: [30, 50, 20], formatCode: 'UT25', sets: 3, title: 't', by: 'test' });
  assert.equal(p.stats.total, 25);
  const ids = p.sets.flatMap((s) => s.questions.map((q) => q.id));
  assert.equal(new Set(ids).size, ids.length);
});

test('templates: placeholders, repeating rows, school default and sanitising', () => {
  assert.equal(renderTemplate('{{a}}-{{#items}}[{{x}}]{{/items}}', { a: 1, items: [{ x: 'p' }, { x: 'q' }] }), '1-[p][q]');
  assert.equal(sanitize('<p onclick="x()">hi</p><script>bad()</script>'), '<p>hi</p>');
  const db = buildSeed();
  db.templates.push({ id: 'MINE', category: 'FEE_INVOICE', name: 'Ours', body: 'OURS {{student_name}}', source: 'CUSTOM', status: 'ACTIVE', version: 1 });
  db.templateDefaults.FEE_INVOICE = { SCHOOL: 'MINE' };
  assert.equal(renderFor(db, 'FEE_INVOICE', { student_name: 'X' }).body, 'OURS X');
});
