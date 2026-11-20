// Release 14: Starter / Pro / Pro+ pricing with bands, paid add-ons, development and storage, margin and discount;
// proposals linked to demo schools; Curriculum, Portfolios, Backups, Board integration, WhatsApp, Timings.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSeed } from '../src/data/seed.js';
import { MENU, ACCESS, canSee, funcOn, FUNCTIONS } from '../src/data/menu.js';
import {
  DEFAULT_RATE_CARD as RC, quote, blankOptions, tierPrice, basePrice, yearCost, activeAddons, demoConfig, offering, upgradeOptions, BASIC, ALWAYS
} from '../src/lib/pricing.js';
import { saveOptions, newProposal, makeDemo } from '../src/lib/proposals.js';
import * as R from '../src/lib/release14.js';
import { seedRelease14, NEW_CODES_14 } from '../src/data/seedRelease14.js';
import { buildProposalPdf } from '../src/lib/proposalPdf.js';
import { rolePerms } from '../src/lib/auth.js';

const o = (x) => ({ ...blankOptions(RC), ...x });

test('three tiers, priced per student a year in bands, with a base price', () => {
  assert.deepEqual(RC.tiers.map((t) => t.name), ['Starter', 'Pro', 'Pro+']);
  assert.deepEqual(RC.tiers.map((t) => basePrice(RC, t.code)), [56000, 84000, 120000], 'base = 200 students');
  assert.equal(tierPrice(RC, 'PRO', 400).amount, 300 * 420 + 100 * 380, 'bands work like slabs');
  assert.equal(tierPrice(RC, 'STARTER', 50).billed, 200, 'small schools pay for 200');
  assert.equal(tierPrice(RC, 'PRO_PLUS', 2000).amount, 300 * 600 + 400 * 540 + 800 * 480 + 500 * 420);
  // Never cheaper with one more student
  for (const t of RC.tiers) for (let n = 290; n < 1600; n += 7) assert.ok(tierPrice(RC, t.code, n + 1).amount >= tierPrice(RC, t.code, n).amount);
  assert.equal(yearCost(RC, 'PRO', 400), 164000 + 4800);
});

test('nothing is free: every plan, add-on, storage and development line has a price', () => {
  RC.tiers.forEach((t) => t.rates.forEach((r) => assert.ok(r > 0)));
  RC.addons.forEach((a) => assert.ok(a.rate > 0, a.code));
  assert.ok(RC.storage.rate > 0);
  const q = quote(RC, o({ tier: 'STARTER', students: 300 }));
  assert.deepEqual(q.lines.map((l) => l.code), ['TIER', 'STORAGE']);
  assert.deepEqual(q.oneTime.map((l) => l.code), ['WEB_DESIGN', 'DB_SETUP'], 'web page design and database set-up on every proposal');
  assert.ok(q.oneTime.every((l) => l.amount > 0));
});

test('basic features are in Starter; the listed extras are add-ons, not in the basic tier', () => {
  assert.equal(BASIC.length, 8);
  const starter = demoConfig(RC, o({ tier: 'STARTER' })).overrides;
  ['STU_ADMISSIONS', 'STU_PROFILE', 'STU_ATT', 'STF_ATT', 'STF_LEAVE', 'FEE_STRUCT', 'FEE_COLLECT', 'FEE_RECEIPTS', 'STU_REPORTCARD', 'ACA_TIMETABLE', 'CMP_EVENTS', 'SELF_CHILD', 'OPS_OUTBOX'].forEach((c) => assert.equal(starter[c], true, c));
  ['DASH', 'STU_REQUESTS', 'STU_GATE', 'STU_MEETINGS', 'TRN_ROUTES', 'OPS_CHANNELS', 'OPS_TEMPLATES', 'OPS_APPEARANCE', 'OPS_BACKUP', 'CMP_HOMEWORK', 'ACA_CURRICULUM', 'STU_PORTFOLIO', 'FN_WHATSAPP', 'FN_BOARD', 'FN_STOP_TIMINGS', 'FN_ROUTE_PLANNING'].forEach((c) => assert.equal(starter[c], false, c));
  assert.equal(starter.DASHBOARD, false); assert.equal(starter.TRANSPORT, false);
  const plus = demoConfig(RC, o({ tier: 'PRO_PLUS' })).overrides;
  ['DASH', 'STU_GATE', 'TRN_ROUTES', 'FN_ROUTE_PLANNING', 'FN_STOP_TIMINGS', 'OPS_CHANNELS', 'FN_BOARD', 'ACA_CURRICULUM', 'STU_PORTFOLIO', 'OPS_BACKUP', 'FN_WHATSAPP'].forEach((c) => assert.equal(plus[c], true, c));
  ALWAYS.forEach((c) => assert.equal(starter[c], true));
  // Every switch is set explicitly
  FUNCTIONS.forEach((f) => assert.equal(typeof starter[f.code], 'boolean'));
});

test('add-ons: included in a tier, chosen on a lower tier, WhatsApp needs no service, Timings needs Transport', () => {
  const pro = quote(RC, o({ tier: 'PRO', students: 400 }));
  const dash = pro.lines.find((l) => l.code === 'DASHBOARD');
  assert.ok(dash.included && dash.amount === 0 && dash.cost > 0, 'included: no extra price, still a running cost');
  const st = quote(RC, o({ tier: 'STARTER', students: 400, addons: { DASHBOARD: true, WHATSAPP: true } }));
  assert.equal(st.lines.find((l) => l.code === 'DASHBOARD').amount, 8000);
  const wa = st.lines.find((l) => l.code === 'WHATSAPP');
  assert.equal(wa.amount, 6000); assert.equal(wa.cost, 0); assert.equal(wa.provider, 'No service needed');
  const t = quote(RC, o({ tier: 'STARTER', addons: { TIMINGS: true } }));
  assert.ok(!t.lines.some((l) => l.code === 'TIMINGS')); assert.match(t.warnings.join(), /needs Transport/);
  assert.deepEqual(activeAddons(RC, o({ tier: 'STARTER', addons: { TIMINGS: true, TRANSPORT: true } })), ['TRANSPORT', 'TIMINGS']);
  const bus = quote(RC, o({ tier: 'STARTER', buses: 1, addons: { TRANSPORT: true } }));
  assert.equal(bus.lines.find((l) => l.code === 'TRANSPORT').amount, 6000, 'minimum 2 buses');
  const board = demoConfig(RC, o({ tier: 'PRO', addons: { BOARD: true } })).overrides;
  assert.equal(board.FN_BOARD, true);
  const off = offering(RC, o({ tier: 'PRO', addons: { LMS: true } }));
  assert.ok(off.inTier.some((a) => a.code === 'HOMEWORK') && off.chosen.some((a) => a.code === 'LMS'));
  assert.ok(RC.addons.filter((a) => a.inspired).map((a) => a.code).join() === 'HOMEWORK,LMS,PORTFOLIO');
});

test('the worked example: Pro, 650 students, transport, timings, SMS, analytics', () => {
  const x = o({ tier: 'PRO', students: 650, buses: 8, addons: { SMS: true, TRANSPORT: true, TIMINGS: true, ANALYTICS: true } });
  const q = quote(RC, x);
  assert.equal(q.lines[0].amount, 259000); assert.equal(q.recurring, 330000); assert.equal(q.oneTimeTotal, 47500);
  assert.equal(q.economics.maxDiscountPct, 13.5);
  const d = quote(RC, { ...x, discountPct: 10 });
  assert.equal(d.discount, 31050); assert.equal(d.recurring, 298950);
  assert.equal(Math.round(d.economics.profitPct * 10) / 10, 18.2);
  assert.equal(d.warnings.length, 0, '10% is within what sales can give');
  assert.match(quote(RC, { ...x, discountPct: 12 }).warnings.join(), /owner's approval/);
});

test('margin, profit, operating cost and maximum discount add up', () => {
  for (const tier of ['STARTER', 'PRO', 'PRO_PLUS']) for (const students of [150, 400, 1200, 3000]) {
    const q = quote(RC, o({ tier, students, addons: { SMS: true } }));
    const e = q.economics;
    assert.equal(Math.round(e.operatingCost), Math.round(e.runningCost + e.overheadTotal));
    assert.equal(Math.round(e.profit), Math.round(q.recurring - e.operatingCost));
    assert.ok(e.grossMarginPct >= RC.economics.industryMargin[0], `${tier} ${students}: margin ${e.grossMarginPct} within the SaaS standard`);
    assert.ok(e.maxDiscountPct >= 0 && e.maxDiscountPct <= RC.maxDiscount);
    // At the maximum discount, profit is still at the floor
    const atMax = quote(RC, o({ tier, students, addons: { SMS: true }, discountPct: e.maxDiscountPct }));
    assert.ok(atMax.economics.profitPct >= RC.economics.profitFloor - 0.01, `${tier} ${students}`);
    // Above it, the discount is cut back to it
    const over = quote(RC, o({ tier, students, addons: { SMS: true }, discountPct: e.maxDiscountPct + 5 }));
    assert.equal(over.discountPct, e.maxDiscountPct); assert.match(over.warnings.join(), /most discount/);
  }
  const g = quote(RC, o({ interState: true }));
  assert.deepEqual(g.gstSplit.map((x) => x[0]), ['IGST 18%']);
  assert.equal(g.yearOneTotal, Math.round((g.yearOne * 1.18) * 100) / 100);
});

test('Demo Builder changes update the linked proposal and its demo school', () => {
  const db = buildSeed();
  const p = newProposal(db, o({ client: 'Hillview School', tier: 'STARTER' }), 'Sales team');
  const t = makeDemo(db, p.id, { name: 'Sales team', userId: 'U-SALES', role: 'SALES' });
  assert.equal(p.demoId, t.id); assert.equal(t.overrides.DASH, false); assert.equal(t.demo.tier, 'Starter');
  saveOptions(db, p.id, { ...p.options, tier: 'PRO', addons: { PORTFOLIO: true } });
  const again = db.tenants.find((x) => x.id === t.id);
  assert.equal(db.provider.proposals.find((x) => x.id === p.id).options.tier, 'PRO');
  assert.equal(again.overrides.DASH, true); assert.equal(again.overrides.STU_PORTFOLIO, true); assert.equal(again.demo.tier, 'Pro');
  assert.equal(makeDemo(db, p.id, { name: 'x' }).id, t.id, 'one demo school per proposal');
  // The demo school's menus follow the switches
  assert.ok(canSee('STU_PORTFOLIO', 'TEACHER', 4, again.overrides)); assert.ok(!canSee('TRN_ROUTES', 'PRINCIPAL', 4, again.overrides));
});

test('saved proposals from release 13 move to the new tiers', () => {
  const u = upgradeOptions({ client: 'X', students: 800, plan: 'ENTERPRISE', messaging: 'SMS', transport: 'PLUS', buses: 9, addons: { LEARNING: true, HOSTEL: true }, contact: 'Principal', hosting: 'NON_AWS' });
  assert.equal(u.tier, 'PRO_PLUS'); assert.deepEqual(Object.keys(u.addons).sort(), ['HOSTEL', 'ONLINE', 'SMS', 'TIMINGS', 'TRANSPORT']);
  assert.equal(u.poc.designation, 'Principal'); assert.equal(u.hosting, 'DEDICATED_STACK');
  assert.equal(upgradeOptions(u), u);
  const db = buildSeed();
  const old = structuredClone(db); old.release = 13; delete old.curriculum; delete old.portfolios; delete old.backup;
  old.provider.proposals.push({ id: 'PRX', no: 'PROP-2026-009', status: 'Draft', created: '2026-11-01', by: 'S', options: { client: 'Old', students: 300, plan: 'GROWTH', messaging: 'EMAIL', transport: 'NONE', addons: {} } });
  Object.keys(old.deptPerms || {}).forEach((d) => { old.deptPerms[d] = old.deptPerms[d].filter((c) => !NEW_CODES_14.includes(c)); });
  seedRelease14(old); seedRelease14(old);
  assert.equal(old.release, 14);
  assert.equal(old.provider.proposals.find((p) => p.id === 'PRX').options.tier, 'PRO');
  assert.ok(old.provider.profile.email.endsWith('example.com'));
  assert.ok(rolePerms(old, 'TEACHER').includes('ACA_CURRICULUM')); assert.ok(rolePerms(old, 'ADMIN').includes('OPS_BACKUP'));
  assert.ok(old.curriculum.length > 20 && old.portfolios.length >= 4 && old.backup.history.length >= 1);
});

test('new screens: menus, access and every new function', () => {
  const codes = MENU.flatMap((m) => m.items.map((i) => i[0]));
  NEW_CODES_14.forEach((c) => assert.ok(codes.includes(c)));
  assert.ok(ACCESS.ADMIN.includes('OPS_BACKUP') && !ACCESS.TEACHER.includes('OPS_BACKUP'));
  assert.ok(ACCESS.PARENT.includes('STU_PORTFOLIO'));
  const db = buildSeed(); const gv = db.tenants.find((t) => t.id === 'T1');
  ['FN_STOP_TIMINGS', 'FN_WHATSAPP', 'FN_BOARD'].forEach((f) => assert.ok(funcOn(gv, f), f));
  assert.ok(!funcOn(db.tenants.find((t) => t.id === 'T2'), 'FN_WHATSAPP'), 'Starter school: WhatsApp off');
});

test('curriculum planning and portfolios', () => {
  const db = buildSeed();
  assert.throws(() => R.addUnit(db, { classId: 'C8', subject: 'Science', title: '', month: 'Jun', periods: 8 }), /unit name/);
  assert.throws(() => R.addUnit(db, { classId: 'C8', subject: 'Science', title: 'X', month: 'May', periods: 8 }), /month/);
  const u = R.addUnit(db, { classId: 'C8', subject: 'Science', title: 'Sound', month: 'Feb', periods: 6, by: 'T' });
  assert.equal(R.setUnitProgress(db, u.id, 3).status, 'In progress');
  assert.equal(R.setUnitProgress(db, u.id, 99).taught, 6); assert.equal(u.status, 'Taught');
  const c = R.coverage([{ periods: 10, taught: 5, status: 'In progress' }, { periods: 10, taught: 10, status: 'Taught' }]);
  assert.deepEqual([c.pct, c.done], [75, 1]);
  const s = db.students[0];
  assert.throws(() => R.addPortfolioItem(db, { studentId: s.id, title: 'A', kind: 'Poem', date: '2026-11-01' }), /kind/);
  R.addPortfolioItem(db, { studentId: s.id, title: 'Private note', kind: 'Reflection', date: '2026-11-02', shared: false, by: 'T' });
  R.addPortfolioItem(db, { studentId: s.id, title: 'Shared essay', kind: 'Work sample', date: '2026-11-03', by: 'T' });
  assert.deepEqual(R.portfolioOf(db, s.id, true).map((p) => p.title).filter((t) => t === 'Private note' || t === 'Shared essay'), ['Shared essay']);
});

test('backups: file round trip, checks, restore keeps the history', () => {
  const db = buildSeed();
  const json = R.backupJson(db);
  db.students[0].first = 'Changed';
  const f = R.readBackup(json, db);
  R.restoreBackup(db, f, 'Admin');
  assert.notEqual(db.students[0].first, 'Changed');
  assert.match(db.backup.history[0].kind, /Restored/);
  assert.throws(() => R.readBackup('not json', db), /not a backup/);
  assert.throws(() => R.readBackup(JSON.stringify({ kind: 'x' }), db), /not a backup/);
  const other = JSON.parse(json); other.schoolCode = 'ZZZ';
  assert.throws(() => R.readBackup(JSON.stringify(other), db), /for school ZZZ/);
  const broken = JSON.parse(json); delete broken.data.students;
  assert.throws(() => R.readBackup(JSON.stringify(broken), db), /no students/);
});

test('board integration, WhatsApp links', () => {
  const db = buildSeed();
  assert.equal(R.boardOf(db.tenants[0]), 'CBSE');
  R.setBoard(db, 'T1', 'IB'); assert.deepEqual(R.BOARDS[R.boardOf(db.tenants[0])].cosch.slice(0, 2), ['7', '6']);
  assert.throws(() => R.setBoard(db, 'T1', 'XYZ'));
  assert.equal(R.whatsappLink('98123 44410', 'Fee due'), 'https://wa.me/919812344410?text=Fee%20due');
  assert.match(R.whatsappShare('Sports Day'), /^https:\/\/wa\.me\/\?text=Sports%20Day$/);
});

test('the proposal PDF is made with every section', () => {
  const db = buildSeed();
  for (const p of db.provider.proposals) {
    const doc = buildProposalPdf({ proposal: p, rc: db.provider.rateCard, profile: db.provider.profile });
    const bytes = Buffer.from(doc.output('arraybuffer'));
    assert.equal(bytes.subarray(0, 4).toString(), '%PDF');
    assert.ok(doc.getNumberOfPages() >= 4 && doc.getNumberOfPages() <= 7, `${p.no}: ${doc.getNumberOfPages()} pages`);
  }
  const p = db.provider.proposals[0];
  const internal = buildProposalPdf({ proposal: p, rc: db.provider.rateCard, profile: db.provider.profile }).getNumberOfPages();
  const client = buildProposalPdf({ proposal: { ...p, options: { ...p.options, showInternal: false } }, rc: db.provider.rateCard, profile: db.provider.profile }).getNumberOfPages();
  assert.ok(client <= internal);
});
