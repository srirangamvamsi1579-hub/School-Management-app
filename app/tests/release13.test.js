// Release 13: Campus Services and the Service Provider menus (price list, proposals, demos, competitors)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSeed } from '../src/data/seed.js';
import { MENU, ACCESS, canSee, PLANS, SP_CODES } from '../src/data/menu.js';
import { demoCode } from '../src/lib/pricing.js';
import * as C from '../src/lib/campus.js';
import { PROVIDERS, FEATURES, priceRange, ROADMAP } from '../src/data/providers.js';
import { seedRelease13 } from '../src/data/seedRelease13.js';
import { rolePerms } from '../src/lib/auth.js';


// Pricing tests moved to release14.test.js (Starter / Pro / Pro+).

test('Service Provider menus are only for our company; Campus follows the plan', () => {
  const db = buildSeed();
  for (const c of SP_CODES) {
    assert.ok(canSee(c, 'SALES', 1, {}, null) && canSee(c, 'PLATFORM', 1, {}, null), c);
    assert.ok(canSee(c, 'ADMIN', 1, { SERVICE_PROVIDER: false }, null), `Admin sees ${c}, whatever the school switches`);
    for (const r of ['PRINCIPAL', 'TEACHER', 'PARENT']) assert.ok(!canSee(c, r, 4, {}, { [r]: [...rolePerms(db, r), c] }), `${r} must not see ${c}`);
  }
  assert.ok(SP_CODES.every((c) => ACCESS.ADMIN.includes(c)), 'Admin has Service Provider (release 13.2)');
  assert.ok(!ACCESS.ADMIN.includes('PLT_SCHOOLS'), 'but not the Platform Console');
  assert.ok(canSee('CMP_HOMEWORK', 'PARENT', 1, {}, null)); assert.ok(!canSee('CMP_LIBRARY', 'TEACHER', 1, {}, null)); assert.ok(canSee('CMP_LIBRARY', 'TEACHER', 2, {}, null));
  assert.ok(!canSee('CMP_HOSTEL', 'PRINCIPAL', 3, {}, null)); assert.ok(canSee('CMP_HOSTEL', 'PRINCIPAL', 3, { CMP_HOSTEL: true }, null));
  assert.ok(!canSee('SP_RATES', 'SALES', 1, { SERVICE_PROVIDER: false }, null) === false, 'a school switch can never hide company menus from the company');
  assert.ok(MENU.find((m) => m.code === 'CAMPUS').items.length === 6);
  assert.ok(db.users.some((u) => u.role === 'SALES'));
});

test('library: issue, limits, overdue and fines', () => {
  const db = buildSeed(); const t = '2026-12-01';
  const s = db.students.find((x) => x.status === 'Active' && !db.library.loans.some((l) => l.studentId === x.id));
  const one = C.issueBook(db, { bookId: 'BK1', studentId: s.id, on: t });
  assert.equal(one.due, '2026-12-15');
  C.issueBook(db, { bookId: 'BK2', studentId: s.id, on: t });
  assert.throws(() => C.issueBook(db, { bookId: 'BK3', studentId: s.id, on: t }), /already has 2 books/);
  const r = C.returnBook(db, one.id, '2026-12-20');
  assert.equal(r.fine, 10, '5 days late × ₹2');
  assert.throws(() => C.returnBook(db, one.id), /not on loan/);
  const b = C.addBook(db, { title: 'One copy', copies: 1 });
  C.issueBook(db, { bookId: b.id, studentId: db.students[5].id, on: t });
  assert.throws(() => C.issueBook(db, { bookId: b.id, studentId: db.students[6].id, on: t }), /No copy/);
  assert.throws(() => C.issueBook(db, { bookId: 'BK4', studentId: s.id, on: '2026-12-30' }), /overdue/);
});

test('hostel: right block, capacity, one bed each, vacate frees it', () => {
  const db = buildSeed();
  const girl = db.students.find((x) => x.status === 'Active' && x.gender === 'Female' && !db.hostel.residents.some((r) => r.studentId === x.id));
  assert.throws(() => C.allocate(db, { studentId: girl.id, roomId: 'HB1-101' }), /for male students/);
  const room = db.hostel.rooms.find((r) => r.blockId === 'HB2' && C.freeBeds(db, r.id) > 0);
  const r = C.allocate(db, { studentId: girl.id, roomId: room.id });
  assert.throws(() => C.allocate(db, { studentId: girl.id, roomId: room.id }), /already has a bed/);
  const before = C.freeBeds(db, room.id); C.vacate(db, r.id); assert.equal(C.freeBeds(db, room.id), before + 1);
  const full = db.hostel.rooms.find((x) => x.blockId === 'HB2');
  while (C.freeBeds(db, full.id) > 0) { const g = db.students.find((x) => x.status === 'Active' && x.gender === 'Female' && !db.hostel.residents.some((y) => y.studentId === x.id && !y.left)); C.allocate(db, { studentId: g.id, roomId: full.id }); }
  const g2 = db.students.find((x) => x.status === 'Active' && x.gender === 'Female' && !db.hostel.residents.some((y) => y.studentId === x.id && !y.left));
  assert.throws(() => C.allocate(db, { studentId: g2.id, roomId: full.id }), /is full/);
  assert.equal(C.hostelFee(db, { mess: true }), 10000);
});

test('homework, online classes, store and calendar rules', () => {
  const db = buildSeed(); const t = C.today();
  const tm = new Date(Date.now() + 864e5).toISOString().slice(0, 10);   // online classes: a time that hasn't passed, whatever the clock says
  assert.throws(() => C.setHomework(db, { sectionId: 'C8A', subject: 'Maths', title: 'x', due: '2000-01-01' }), /today or later/);
  const sec = db.sections[0].id;
  const h = C.setHomework(db, { sectionId: sec, subject: 'Maths', title: 'Ex 1', due: t });
  const kid = C.studentsInSection(db, sec)[0];
  C.markHomework(db, h.id, kid.id, 'DONE');
  assert.equal(C.homeworkStats(db, h).done, 1);
  assert.throws(() => C.scheduleClass(db, { sectionId: sec, subject: 'Maths', date: tm, time: '10:00', link: 'http://x.com' }), /https/);
  C.scheduleClass(db, { sectionId: sec, subject: 'Maths', date: tm, time: '10:00', link: 'https://meet.example.com/a' });
  assert.throws(() => C.scheduleClass(db, { sectionId: sec, subject: 'English', date: tm, time: '10:00', link: 'https://meet.example.com/b' }), /already has Maths/);
  const item = db.inventory.items[0]; const stock = C.stockOf(db, item.id);
  assert.throws(() => C.sellItem(db, { itemId: item.id, qty: stock + 1, studentId: kid.id }), /in stock/);
  const sale = C.sellItem(db, { itemId: item.id, qty: 2, studentId: kid.id });
  assert.equal(sale.amount, 2 * item.price); assert.equal(C.stockOf(db, item.id), stock - 2);
  C.receiveStock(db, { itemId: item.id, qty: 5 }); assert.equal(C.stockOf(db, item.id), stock + 3);
  assert.throws(() => C.addEvent(db, { title: 'X', date: '2026-12-10', end: '2026-12-01' }), /before the start/);
  C.addEvent(db, { title: 'Founders Day', date: '2026-12-10' });
  assert.ok(C.calendar(db, '2026-12-01', '2026-12-31').some((e) => e.title === 'Founders Day'));
  assert.ok(C.audienceUsers(db, 'PARENTS').every((u) => u.role === 'PARENT'));
  assert.ok(!C.audienceUsers(db, 'ALL').some((u) => ['PLATFORM', 'SALES'].includes(u.role)));
});

test('competitor data: every provider has a country and source; prices work out; roadmap names a country', () => {
  for (const p of PROVIDERS) {
    assert.ok(p.country && p.region && p.priceText, p.code);
    if (!p.us) assert.match(p.source, /^https:\/\//, p.code);
    for (const u of p.fsrc || []) assert.match(u, /^https:\/\//, `${p.code} feature source`);
    for (const k of Object.keys(p.f)) assert.ok(FEATURES.some((f) => f[0] === k), `${p.code}: unknown feature ${k}`);
  }
  const us = PROVIDERS.find((p) => p.us); assert.ok(FEATURES.every(([c]) => us.f[c]), 'our column covers every feature');
  assert.deepEqual(priceRange(PROVIDERS.find((p) => p.code === 'ASKCAMPUS'), 400), [95988, 95988]);
  assert.equal(priceRange(PROVIDERS.find((p) => p.code === 'GRADELINK'), 400), null);
  assert.ok(PROVIDERS.some((p) => p.region === 'Global' && p.country === 'United Kingdom'));
  assert.ok(ROADMAP.every((r) => r.country && r.seenAt && ['Now', 'Next', 'Later'].includes(r.priority)));
});

test('saved release 12 data upgrades: new screens added to each department, run twice is safe', () => {
  const db = buildSeed();
  const old = structuredClone(db); old.release = 12;
  ['library', 'hostel', 'homework', 'onlineClasses', 'inventory', 'events', 'provider'].forEach((k) => delete old[k]);
  old.users = old.users.filter((u) => u.role !== 'SALES');
  Object.keys(old.deptPerms || {}).forEach((d) => { old.deptPerms[d] = old.deptPerms[d].filter((c) => !c.startsWith('CMP_')); });
  seedRelease13(old); seedRelease13(old);
  assert.equal(old.release, 13); assert.equal(old.users.filter((u) => u.role === 'SALES').length, 1);
  assert.ok(rolePerms(old, 'TEACHER').includes('CMP_HOMEWORK')); assert.ok(rolePerms(old, 'PARENT').includes('CMP_EVENTS'));
  assert.ok(!rolePerms(old, 'PARENT').includes('CMP_INVENTORY'));
  assert.ok(old.provider.proposals.length >= 3 && old.library.books.length >= 20);
  assert.equal(PLANS.length, 4);
});
