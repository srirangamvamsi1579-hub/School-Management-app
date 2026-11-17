// Mobile app: tabs = school's mobile switches ∩ the same web access rules
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSeed } from '../src/data/seed.js';
import { mobileTabs, PHONE_READY, onWeb, webScreens } from '../src/data/menu.js';
import { setChannel, submitDraft, approve, sendBack, diffLayouts, restoreVersion, resetDraft } from '../src/lib/channels.js';
import { screensFor } from '../src/lib/auth.js';
import { parseHash, linkFor } from '../src/lib/links.js';

const tabsFor = (db, role, user, tenant = db.tenants[0]) => mobileTabs(tenant, role, { [role]: screensFor(db, user, role) }).map((t) => t[0]);
const userOf = (db, role) => db.users.find((u) => u.role === role && u.status === 'ACTIVE' && !u.designation?.match(/Vice|Head/));

test('parent gets only parent screens; staff screens never appear', () => {
  const db = buildSeed();
  const t = tabsFor(db, 'PARENT', userOf(db, 'PARENT'));
  assert.deepEqual(t, ['M_HOME', 'SELF_REQUESTS', 'SELF_FEES', 'SELF_CHILD', 'SELF_PROFILE']);
});

test('teacher, front office and transport each get their own minimal set', () => {
  const db = buildSeed();
  assert.deepEqual(tabsFor(db, 'TEACHER', userOf(db, 'TEACHER')), ['M_HOME', 'ACA_TIMETABLE', 'STU_ATT', 'STU_REQUESTS', 'STU_MEETINGS', 'SELF_PROFILE']);
  assert.deepEqual(tabsFor(db, 'FRONT_OFFICE', userOf(db, 'FRONT_OFFICE')), ['M_HOME', 'STU_GATE', 'STU_OFFICE', 'TRN_CHANGES', 'SELF_PROFILE']);
  assert.deepEqual(tabsFor(db, 'TRANSPORT', userOf(db, 'TRANSPORT')), ['M_HOME', 'TRN_SHEETS', 'TRN_MANIFEST', 'TRN_CHANGES', 'SELF_PROFILE']);
  assert.deepEqual(tabsFor(db, 'PLATFORM', null), [], 'platform team is web only');
});

test('school app switch: off = no tabs; new schools start with the app off', () => {
  const db = buildSeed(); const t = db.tenants[0]; const p = userOf(db, 'PARENT');
  t.mobile.enabled = false;
  assert.deepEqual(tabsFor(db, 'PARENT', p), []);
  assert.equal(db.tenants.find((x) => x.id === 'T3').mobile.enabled, false);
});

test('web & app screens: draft changes nothing until a different person approves', () => {
  const db = buildSeed(); const t = db.tenants[0];
  const fo = userOf(db, 'FRONT_OFFICE'); const parent = userOf(db, 'PARENT');
  setChannel(db, 'FRONT_OFFICE', 'STU_GATE', 'APP', 'Admin');
  setChannel(db, 'PARENT', 'SELF_FEES', 'WEB', 'Admin');
  assert.ok(onWeb(t, 'FRONT_OFFICE', 'STU_GATE'), 'draft is not live');
  assert.ok(tabsFor(db, 'PARENT', parent).includes('SELF_FEES'));
  assert.equal(diffLayouts(t.channels.published, t.channels.draft).length, 2);
  assert.throws(() => approve(db, { by: 'P', byId: 'U2' }), /Nothing is waiting/);
  submitDraft(db, { by: 'Admin', byId: 'U1', note: 'Gate on the tablet' });
  assert.throws(() => setChannel(db, 'PARENT', 'SELF_CHILD', 'WEB', 'Admin'), /waiting for approval/);
  assert.throws(() => approve(db, { by: 'Admin', byId: 'U1' }), /different person/);
  assert.throws(() => sendBack(db, { by: 'P', byId: 'U2', note: '' }), /Say what/);
  const v = approve(db, { by: 'Principal', byId: 'U2' });
  assert.equal(v, 2);
  assert.ok(!onWeb(t, 'FRONT_OFFICE', 'STU_GATE'), 'gate now app only');
  assert.ok(!webScreens(t, 'FRONT_OFFICE', { FRONT_OFFICE: screensFor(db, fo, 'FRONT_OFFICE') }).includes('STU_GATE'));
  assert.ok(tabsFor(db, 'FRONT_OFFICE', fo).includes('STU_GATE'));
  assert.ok(!tabsFor(db, 'PARENT', parent).includes('SELF_FEES'), 'fees now website only');
  assert.ok(db.outbox.some((m) => /Published/.test(m.subject)));
  restoreVersion(db, 1, 'Admin');
  assert.equal(diffLayouts(t.channels.published, t.channels.draft).length, 2, 'restoring v1 undoes both');
});

test('locked and non-phone screens cannot be moved; account stays everywhere', () => {
  const db = buildSeed();
  assert.throws(() => setChannel(db, 'PARENT', 'SELF_PROFILE', 'WEB', 'Admin'), /must stay/);
  assert.throws(() => setChannel(db, 'ADMIN', 'OPS_USERS', 'APP', 'Admin'), /not built for phones/);
  resetDraft(db, 'RECOMMENDED', 'Admin');
  assert.throws(() => submitDraft(db, { by: 'Admin', byId: 'U1' }), /same as what is published/);
  for (const role of ['PARENT', 'TEACHER', 'FRONT_OFFICE', 'TRANSPORT']) assert.ok(tabsFor(db, role, userOf(db, role)).includes('SELF_PROFILE'), role);
});

test('web rules still apply on the phone: plan, school switch-off and personal grants', () => {
  const db = buildSeed(); const t = db.tenants[0]; const teacher = userOf(db, 'TEACHER');
  t.overrides = { ...t.overrides, STU_MEETINGS: false };                    // school switched the screen off on the web
  assert.ok(!tabsFor(db, 'TEACHER', teacher).includes('STU_MEETINGS'));
  t.overrides.STU_MEETINGS = undefined;
  const fo = userOf(db, 'FRONT_OFFICE');
  assert.ok(!tabsFor(db, 'FRONT_OFFICE', fo).includes('TRN_SHEETS'));
  fo.extra = ['TRN_SHEETS'];                                                 // given the screen by name on the web
  assert.ok(!tabsFor(db, 'FRONT_OFFICE', fo).includes('TRN_SHEETS'), 'a grant follows the role’s choice: website only by default');
  t.channels.published = { FRONT_OFFICE: { TRN_SHEETS: 'BOTH' } };
  assert.ok(tabsFor(db, 'FRONT_OFFICE', fo).includes('TRN_SHEETS'), 'once the role has it in the app, the grant shows there');
  assert.ok(!tabsFor(db, 'FRONT_OFFICE', userOf(db, 'FRONT_OFFICE') === fo ? { ...fo, extra: [] } : fo).includes('TRN_SHEETS'), 'without the grant, no tab');
  assert.ok(Object.keys(PHONE_READY).length <= 16, 'mobile stays small');
});

test('website deep links parse and are per school', () => {
  const db = buildSeed();
  assert.deepEqual(parseHash('#/s/SELF_REQUESTS'), { kind: 's', code: 'SELF_REQUESTS', embed: false });
  assert.deepEqual(parseHash('#/p/apply?embed'), { kind: 'p', code: 'apply', embed: true });
  assert.equal(parseHash('#/x/<script>'), null);
  assert.equal(linkFor(db, 's/SELF_FEES'), 'https://greenvalley.yourapp.com/#/s/SELF_FEES');
});
