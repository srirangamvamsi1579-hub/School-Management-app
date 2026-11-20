// Release 15.1: analytics moved into Data Analytics with full reports; F13 decision; QA enhancements as backlog
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSeed } from '../src/data/seed.js';
import { MENU, ACCESS, ANL_NEW, SP_CODES } from '../src/data/menu.js';
import { DEFAULT_RATE_CARD } from '../src/lib/pricing.js';
import { REPORT_DEFS, defaultFilters, scopeFor, aggregate, kpis, MOVED } from '../src/lib/reports.js';
import { ROADMAP } from '../src/data/providers.js';
import { seedRelease15 } from '../src/data/seedRelease15.js';
import { seedRelease12 } from '../src/data/seedRelease12.js';
import { screensFor, departments, baseRoleOf } from '../src/lib/auth.js';

const items = (code) => MENU.find((m) => m.code === code).items.map((i) => i[0]);

test('every insight lives under Data Analytics; none is left in Students, Staff or Fees', () => {
  const anl = items('ANALYTICS');
  for (const c of ['STU_INS', 'STF_INS', 'FEE_INS', 'ANL_ADMISSIONS', 'ANL_TRANSPORT', ...ANL_NEW]) assert.ok(anl.includes(c), c);
  for (const m of ['STUDENTS', 'STAFF', 'FEES']) for (const c of ['STU_INS', 'STF_INS', 'FEE_INS']) assert.ok(!items(m).includes(c), `${c} still in ${m}`);
  assert.ok(SP_CODES.includes('SP_ANALYTICS'));
  assert.ok(MOVED.length >= 7);
  const add = DEFAULT_RATE_CARD.addons.find((a) => a.code === 'ANALYTICS');
  for (const c of ANL_NEW) assert.ok(add.menus.includes(c), 'add-on lacks ' + c);
});

test('every report runs with default filters, has KPIs, and drills down to its next level', () => {
  const db = buildSeed(); const f = defaultFilters(db);
  assert.ok(REPORT_DEFS.length >= 21);
  for (const def of REPORT_DEFS) {
    const facts = def.rows(db, f, { all: true }, {});
    assert.ok(Array.isArray(facts), def.code);
    const k = kpis(db, def, facts); assert.equal(k.length, def.measures.length, def.code);
    k.forEach((x) => assert.ok(Number.isFinite(Number(x.value)) || x.value === 0, `${def.code} ${x.key} = ${x.value}`));
    const top = aggregate(db, def, facts, def.dims[0].key);
    if (facts.length && def.dims[1]) { const r = top.rows[0]; const next = aggregate(db, def, r.facts, def.dims[1].key, facts); assert.ok(next.rows.length >= 1, def.code + ' drill'); }
    for (const key of ['code', 'name', 'purpose', 'visual', 'roles', 'source']) assert.ok(def[key], `${def.code} lacks ${key}`);
  }
});

test('a class teacher sees only their own sections; the Vice Principal sees all', () => {
  const db = buildSeed();
  const teacher = db.users.find((u) => u.role === 'TEACHER' && !['Vice Principal', 'Head of Teaching Staff'].includes(u.designation) && scopeFor(db, { userId: u.id, role: 'TEACHER' }).sections?.size);
  assert.ok(teacher, 'a teacher with sections');
  const scope = scopeFor(db, { userId: teacher.id, role: 'TEACHER' });
  const def = REPORT_DEFS.find((r) => r.code === 'EXM_RESULTS');
  const mine = def.rows(db, defaultFilters(db), scope, {}); const all = def.rows(db, defaultFilters(db), { all: true }, {});
  assert.ok(mine.length > 0 && mine.length < all.length);
  const vp = db.users.find((u) => u.designation === 'Vice Principal');
  if (vp) assert.equal(scopeFor(db, { userId: vp.id, role: 'TEACHER' }).all, true);
});

test('F13: the Accountant does not open Student Profile by default, and the removal sticks on reload', () => {
  assert.ok(!ACCESS.ACCOUNTANT.includes('STU_PROFILE'));
  const db = buildSeed();
  const acc = db.users.find((u) => baseRoleOf(db, u.role) === 'ACCOUNTANT');
  assert.ok(acc);
  assert.ok(!screensFor(db, acc, acc.role).includes('STU_PROFILE'));
  seedRelease12(db); seedRelease15(db);   // a reload runs the upgrades again
  assert.ok(!screensFor(db, acc, acc.role).includes('STU_PROFILE'));
  // given back by hand, it stays
  const dept = Object.values(departments(db)).find((d) => d.profiles.some((p) => baseRoleOf(db, p.code) === 'ACCOUNTANT'));
  db.deptPerms[dept.name].push('STU_PROFILE'); seedRelease12(db); seedRelease15(db);
  assert.ok(db.deptPerms[dept.name].includes('STU_PROFILE'));
});

test('the nine QA enhancements are backlog items on the roadmap, not built', () => {
  const db = buildSeed();
  const back = ROADMAP.filter((r) => r.backlog);
  assert.equal(back.length, 9);
  for (const r of back) assert.equal(db.provider.roadmap.find((x) => x.code === r.code)?.status, 'Backlog', r.code);
  assert.deepEqual(back.map((r) => r.priority).sort(), ['Later', 'Later', 'Next', 'Next', 'Next', 'Next', 'Now', 'Now', 'Now']);
});
