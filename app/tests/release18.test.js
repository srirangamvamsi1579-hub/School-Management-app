// Release 18: Add-ons and Roles & Permissions in the provider's own app; Apply; basic items marked as add-ons;
// the school's Roles & Permissions follows what the provider applied, not the client type.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSeed } from '../src/data/seed.js';
import { screensFor } from '../src/lib/auth.js';
import * as dlv from '../src/lib/delivery.js';
import { clientList } from '../src/lib/clients.js';
import { tenantByReg } from '../src/lib/schoolLogin.js';

const provider = (db) => db.users.find((u) => u.companyAdmin);

test('the provider app has Add-ons and Roles & Permissions for the provider only, and lists the client schools to set up', () => {
  const db = buildSeed();
  db.tenantId = 'T1';
  const s = screensFor(db, provider(db), 'ADMIN');
  assert.ok(s.includes('SP_ADDONS') && s.includes('SP_FEATURES'));
  const other = db.users.find((u) => u.role === 'ADMIN' && !u.companyAdmin);
  if (other) assert.ok(!screensFor(db, other, 'ADMIN').includes('SP_ADDONS'), 'a school admin never sees them');
  const schools = dlv.managedSchools(db);
  assert.ok(schools.some((t) => t.ownApp === 'VHS'), 'Vijayanikethan (own app) can be set up');
  assert.ok(!schools.some((t) => t.id === 'T1'));
  assert.equal(tenantByReg(db, '101'), undefined, 'the own-app school is not a login in the provider app');
});

test('Apply: add-ons and basic items unselected, a basic item marked as add-on; applied set drives the school roles', () => {
  const db = buildSeed();
  const t = db.tenants.find((x) => x.ownApp === 'VHS');
  assert.ok(dlv.appliedSet(t).has('TRN_ROUTES'), 'all add-ons at first');
  dlv.setSchoolAddons(db, t.id, t.delivery.addons.filter((c) => c !== 'TRANSPORT' && c !== 'TIMINGS'), 'SP');
  dlv.setSchoolScreens(db, t.id, { FEE_CONC: false }, 'SP');                // uncheck a basic item
  dlv.markAsAddon(db, t.id, ['STU_DOCS'], true, 'SP');                      // basic → add-on
  assert.ok(dlv.isMarkedAddon(t, 'STU_DOCS') && !t.overrides.STU_DOCS);
  assert.ok(dlv.appliedSet(t).has('TRN_ROUTES') && dlv.appliedSet(t).has('FEE_CONC'), 'nothing changes for the school until Apply');
  const r = dlv.rebuildSchool(db, t.id, null, 'SP');
  assert.equal(r.version, '1.1');
  const a = dlv.appliedSet(t);
  assert.ok(!a.has('TRN_ROUTES') && !a.has('FEE_CONC') && !a.has('STU_DOCS') && a.has('STU_LIST') && a.has('OPS_ROLES'));
  // the mark survives selecting it again: it is now sold as an add-on of its own
  dlv.setSchoolScreens(db, t.id, { STU_DOCS: true }, 'SP');
  assert.ok(t.overrides.STU_DOCS && dlv.isMarkedAddon(t, 'STU_DOCS'));
  dlv.markAsAddon(db, t.id, ['STU_DOCS'], false, 'SP');
  assert.ok(!dlv.isMarkedAddon(t, 'STU_DOCS') && t.overrides.STU_DOCS);
  assert.throws(() => dlv.markAsAddon(db, t.id, ['OPS_USERS'], true, 'SP'), /basic/);
  assert.equal(clientList(db).find((c) => c.id === 'VHS').version, '1.1', 'Clients shows the applied version');
});

test('not by client type: two schools on different plans with the same selection offer the same screens', () => {
  const db = buildSeed();
  const t = db.tenants.find((x) => x.ownApp === 'VHS');
  const a1 = [...dlv.appliedSet(t)].sort().join();
  t.plan = 'STARTER';
  assert.equal([...dlv.appliedSet(t)].sort().join(), a1);
});

test('a client app picks up what the provider applied (same browser)', () => {
  const db = buildSeed();
  const t = db.tenants.find((x) => x.ownApp === 'VHS');
  dlv.setSchoolAddons(db, t.id, [], 'SP');
  dlv.markAsAddon(db, t.id, ['STU_DOCS'], true, 'SP');
  dlv.rebuildSchool(db, t.id, null, 'SP');
  const p = dlv.appliedPayload(t);
  const app = buildSeed();
  const target = app.tenants.find((x) => x.id === 'T2');
  target.delivery = { version: '1.0', addons: ['TRANSPORT'] };
  assert.ok(dlv.receiveApplied(app, 'T2', p));
  assert.equal(target.delivery.version, '1.1');
  assert.ok(!target.overrides.TRN_ROUTES && !target.overrides.STU_DOCS && target.overrides.STU_LIST);
  assert.ok(!dlv.receiveApplied(app, 'T2', p), 'only once');
});
