// Mobile app: tabs = school's mobile switches ∩ the same web access rules
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSeed } from '../src/data/seed.js';
import { mobileTabs, MOBILE_SCREENS } from '../src/data/menu.js';
import { screensFor } from '../src/lib/auth.js';
import { parseHash, linkFor } from '../src/lib/links.js';

const tabsFor = (db, role, user, tenant = db.tenants[0]) => mobileTabs(tenant, role, { [role]: screensFor(db, user, role) }).map((t) => t[0]);
const userOf = (db, role) => db.users.find((u) => u.role === role && u.status === 'ACTIVE' && !u.designation?.match(/Vice|Head/));

test('parent gets only parent screens; staff screens never appear', () => {
  const db = buildSeed();
  const t = tabsFor(db, 'PARENT', userOf(db, 'PARENT'));
  assert.deepEqual(t, ['M_HOME', 'SELF_REQUESTS', 'SELF_FEES', 'SELF_PROFILE']);
});

test('teacher, front office and transport each get their own minimal set', () => {
  const db = buildSeed();
  assert.deepEqual(tabsFor(db, 'TEACHER', userOf(db, 'TEACHER')), ['M_HOME', 'STU_ATT', 'STU_REQUESTS', 'STU_MEETINGS', 'SELF_PROFILE']);
  assert.deepEqual(tabsFor(db, 'FRONT_OFFICE', userOf(db, 'FRONT_OFFICE')), ['M_HOME', 'STU_GATE', 'SELF_PROFILE']);
  assert.deepEqual(tabsFor(db, 'TRANSPORT', userOf(db, 'TRANSPORT')), ['M_HOME', 'TRN_SHEETS', 'SELF_PROFILE']);
  assert.deepEqual(tabsFor(db, 'PLATFORM', null), [], 'platform team is web only');
});

test('school switches: off for the school = no tabs; a screen switched off disappears; account tab cannot be switched off', () => {
  const db = buildSeed(); const t = db.tenants[0]; const p = userOf(db, 'PARENT');
  t.mobile.screens = { SELF_FEES: false, SELF_CHILD: true, SELF_PROFILE: false };
  assert.deepEqual(tabsFor(db, 'PARENT', p), ['M_HOME', 'SELF_REQUESTS', 'SELF_CHILD', 'SELF_PROFILE']);
  t.mobile.enabled = false;
  assert.deepEqual(tabsFor(db, 'PARENT', p), []);
  assert.equal(db.tenants.find((x) => x.id === 'T3').mobile.enabled, false, 'new / other schools start with the app off');
});

test('web rules still apply on the phone: plan, school switch-off and personal grants', () => {
  const db = buildSeed(); const t = db.tenants[0]; const teacher = userOf(db, 'TEACHER');
  t.overrides = { ...t.overrides, STU_MEETINGS: false };                    // school switched the screen off on the web
  assert.ok(!tabsFor(db, 'TEACHER', teacher).includes('STU_MEETINGS'));
  t.overrides.STU_MEETINGS = undefined;
  const fo = userOf(db, 'FRONT_OFFICE');
  assert.ok(!tabsFor(db, 'FRONT_OFFICE', fo).includes('TRN_SHEETS'));
  fo.extra = ['TRN_SHEETS'];                                                 // given the screen by name on the web
  assert.ok(tabsFor(db, 'FRONT_OFFICE', fo).includes('TRN_SHEETS'));
  assert.ok(MOBILE_SCREENS.length <= 12, 'mobile stays small');
});

test('website deep links parse and are per school', () => {
  const db = buildSeed();
  assert.deepEqual(parseHash('#/s/SELF_REQUESTS'), { kind: 's', code: 'SELF_REQUESTS', embed: false });
  assert.deepEqual(parseHash('#/p/apply?embed'), { kind: 'p', code: 'apply', embed: true });
  assert.equal(parseHash('#/x/<script>'), null);
  assert.equal(linkFor(db, 's/SELF_FEES'), 'https://greenvalley.yourapp.com/#/s/SELF_FEES');
});
