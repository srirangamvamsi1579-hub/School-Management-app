// Release 13: Campus Services and the Service Provider menus (price list, proposals, demos, competitors)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSeed } from '../src/data/seed.js';
import { MENU, ACCESS, canSee, PLANS, SP_CODES } from '../src/data/menu.js';
import { DEFAULT_RATE_CARD as RC, quote, planFor, blankOptions, demoConfig, demoCode, featureList } from '../src/lib/pricing.js';
import * as C from '../src/lib/campus.js';
import { PROVIDERS, FEATURES, priceRange, ROADMAP } from '../src/data/providers.js';
import { seedRelease13 } from '../src/data/seedRelease13.js';
import { rolePerms } from '../src/lib/auth.js';

const o = (x) => ({ ...blankOptions(RC), ...x });

test('quotes match the worked quotes in the pricing plan', () => {
  const a = quote(RC, o({ students: 180, plan: 'STARTER', messaging: 'EMAIL' }));
  assert.equal(a.monthlyTotal, 1800); assert.equal(a.yearly, 19800); assert.equal(a.yearlyWithGst, 23364); assert.equal(a.perStudentYear, 110);
  const b = quote(RC, o({ students: 400, plan: 'GROWTH', messaging: 'SMS', transport: 'BASIC', buses: 4 }));
  assert.equal(b.monthlyTotal, 5200); assert.equal(b.yearly, 57200); assert.equal(b.oneTimeTotal, 12500); assert.equal(b.firstInvoiceTotal, 82246);
  const c = quote(RC, o({ students: 800, plan: 'PROFESSIONAL', messaging: 'SMS', transport: 'PLUS', buses: 10, addons: { ANALYTICS: true } }));
  assert.equal(c.monthlyTotal, 7200 + 1200 + 3500 + 1600);   // question bank included from Professional
  assert.ok(c.monthly.some((l) => l.code === 'QBANK') === false);
  const d = quote(RC, o({ students: 2000, plan: 'ENTERPRISE', transport: 'PLUS', buses: 25, hosting: 'DEDICATED_DB', addons: { ANALYTICS: true, BRANDED_APP: true } }));
  assert.equal(d.monthlyTotal, 38250); assert.equal(d.yearly, 420750); assert.equal(d.oneTimeTotal, 50000 + 15000 + 40000);
});

test('tiers, minimums, included add-ons, discounts and warnings', () => {
  assert.equal(planFor(RC, 90).code, 'STARTER'); assert.equal(planFor(RC, 90, { allowFree: true }).code, 'FREE');
  assert.equal(planFor(RC, 251).code, 'GROWTH'); assert.equal(planFor(RC, 1000).code, 'PROFESSIONAL'); assert.equal(planFor(RC, 1001).code, 'ENTERPRISE');
  assert.equal(quote(RC, o({ students: 260, plan: 'GROWTH' })).monthly[0].amount, 2600);
  assert.equal(quote(RC, o({ students: 10, plan: 'GROWTH' })).monthly[0].amount, 2500, 'minimum applies');
  assert.match(quote(RC, o({ students: 600, plan: 'GROWTH' })).warnings.join(), /over the Growth limit/);
  const lib = quote(RC, o({ students: 200, plan: 'STARTER', addons: { LIBRARY: true } }));
  assert.equal(lib.monthly.find((l) => l.code === 'LIBRARY').amount, 300, 'library minimum on Starter');
  assert.ok(quote(RC, o({ students: 400, plan: 'GROWTH', addons: { LIBRARY: true } })).monthly.find((l) => l.code === 'LIBRARY').included, 'library included from Growth');
  const bus = quote(RC, o({ students: 400, plan: 'GROWTH', transport: 'PLUS', buses: 2 }));
  assert.equal(bus.monthly.find((l) => l.code === 'TRANSPORT_PLUS').amount, 5 * 350, 'Transport Plus minimum 5 buses');
  const disc = quote(RC, o({ students: 400, plan: 'GROWTH', messaging: 'SMS', discountPct: 15 }));
  assert.equal(disc.monthly.find((l) => l.code === 'DISCOUNT').amount, -600, 'discount on the plan, not on SMS');
  assert.match(disc.warnings.join(), /owner's approval/);
  assert.match(quote(RC, o({ plan: 'GROWTH', hosting: 'ON_PREM' })).warnings.join(), /Enterprise schools only/);
  assert.equal(quote(RC, o({ students: 400, plan: 'GROWTH', billing: 'MONTHLY' })).yearly, 48000);
  assert.deepEqual(quote(RC, o({ students: 400, plan: 'GROWTH', interState: true })).gstSplit.map((x) => x[0]), ['IGST 18%']);
});

test('a proposal becomes the app set-up the demo shows', () => {
  const plus = demoConfig(RC, o({ plan: 'GROWTH', transport: 'PLUS', messaging: 'SMS', addons: { ANALYTICS: true } }));
  assert.equal(plus.plan, 'GROWTH');
  assert.equal(plus.overrides.FN_ROUTE_PLANNING, true); assert.equal(plus.overrides.FN_SMS_OTP, true); assert.equal(plus.overrides.ANALYTICS, true);
  assert.equal(plus.overrides.CMP_LIBRARY, true, 'library included in Growth'); assert.equal(plus.overrides.CMP_HOSTEL, false);
  const none = demoConfig(RC, o({ plan: 'STARTER', transport: 'NONE', messaging: 'APP' }));
  assert.equal(none.overrides.TRANSPORT, false); assert.equal(none.overrides.FN_SMS_OTP, false); assert.equal(none.overrides.EXM_QB, false, 'question bank is an add-on below Professional');
  const free = demoConfig(RC, o({ plan: 'FREE' }));
  assert.equal(free.plan, 'STARTER'); assert.equal(free.overrides.STU_REPORTCARD, false);
  const f = featureList(RC, o({ plan: 'ENTERPRISE', transport: 'BASIC' }));
  assert.ok(f.find((m) => m.code === 'CAMPUS').items.every((i) => i.on), 'Enterprise has every Campus screen');
  assert.ok(!f.some((m) => ['SERVICE_PROVIDER', 'PLATFORM'].includes(m.code)), 'company menus never sold to schools');
  assert.equal(demoCode('Hillview Public School', []), 'DHPS'); assert.equal(demoCode('Hillview Public School', ['DHPS']), 'DHP2');
});

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
  assert.throws(() => C.setHomework(db, { sectionId: 'C8A', subject: 'Maths', title: 'x', due: '2000-01-01' }), /today or later/);
  const sec = db.sections[0].id;
  const h = C.setHomework(db, { sectionId: sec, subject: 'Maths', title: 'Ex 1', due: t });
  const kid = C.studentsInSection(db, sec)[0];
  C.markHomework(db, h.id, kid.id, 'DONE');
  assert.equal(C.homeworkStats(db, h).done, 1);
  assert.throws(() => C.scheduleClass(db, { sectionId: sec, subject: 'Maths', date: t, time: '10:00', link: 'http://x.com' }), /https/);
  C.scheduleClass(db, { sectionId: sec, subject: 'Maths', date: t, time: '10:00', link: 'https://meet.example.com/a' });
  assert.throws(() => C.scheduleClass(db, { sectionId: sec, subject: 'English', date: t, time: '10:00', link: 'https://meet.example.com/b' }), /already has Maths/);
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
