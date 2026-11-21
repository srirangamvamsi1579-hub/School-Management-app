// Release 16: Convert to client → "<School> – UAT/DEMO" (basic menus + agreed add-ons + Project Links);
// client approval and signing → "<School> – Live (date)"; each school has its own branch from dev.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSeed } from '../src/data/seed.js';
import { PLANS, canSee, ACCESS } from '../src/data/menu.js';
import { blankOptions, DEFAULT_RATE_CARD as RC, BASIC } from '../src/lib/pricing.js';
import { newProposal, saveOptions } from '../src/lib/proposals.js';
import * as D from '../src/lib/delivery.js';
import { seedRelease16 } from '../src/data/seedRelease16.js';

const o = (x) => ({ ...blankOptions(RC), client: 'Hillview School', city: 'Mysuru', students: 650, buses: 8, tier: 'STARTER', addons: { TRANSPORT: true, PORTFOLIO: true },
  poc: { name: 'Mrs. Asha Rao', designation: 'Principal', email: 'principal@hillview.example.com', phone: '+91 90000 44444' }, ...x });
const rank = (t) => PLANS.find((p) => p.code === t.plan).rank;
const sees = (t, c, role = 'ADMIN') => canSee(c, role, rank(t), t.overrides);

test('Convert to client builds “<School> – UAT/DEMO” with the basic menus, the agreed add-ons and Project Links', () => {
  const db = buildSeed();
  const cp = D.convertProposal(db, newProposal(db, o(), 'S').id, 'Sales team');
  const uat = db.tenants.find((t) => t.id === cp.uatTenantId);
  assert.equal(uat.name, 'Hillview School – UAT/DEMO'); assert.equal(uat.env, 'UAT'); assert.match(uat.code, /-UAT$/); assert.match(uat.subdomain, /^uat-/);
  assert.equal(cp.status, 'UAT / Demo'); assert.equal(cp.liveTenantId, null);
  BASIC.flatMap(([, , menus]) => menus).filter((c) => ACCESS.ADMIN.includes(c)).forEach((c) => assert.ok(sees(uat, c), 'basic ' + c));
  ['TRN_ROUTES', 'STU_PORTFOLIO'].forEach((c) => assert.ok(sees(uat, c), 'agreed add-on ' + c));
  ['ACA_CURRICULUM', 'PAY_RUN'].forEach((c) => assert.ok(!sees(uat, c), 'not agreed ' + c));
  assert.ok(sees(uat, 'PRJ_LINKS') && sees(uat, 'PRJ_LINKS', 'PRINCIPAL') && !sees(uat, 'PRJ_LINKS', 'PARENT'));
  const school = db.tenants.find((t) => !t.client && !t.isDemo && t.env === undefined && t.overrides);
  if (school) assert.ok(!sees(school, 'PRJ_LINKS'), 'not in ordinary schools');
  const L = Object.fromEntries(cp.links.map((l) => [l.code, l]));
  ['TEST_BUILD', 'TEST_SITE', 'TEST_APP', 'REQ_DOC'].forEach((c) => assert.equal(L[c].status, 'Ready', c));
  assert.match(L.TEST_SITE.url, /#\/try\/.+\?to=site$/); assert.match(L.TEST_APP.url, /\?to=app$/); assert.match(L.REQ_DOC.url, /\?to=req$/);
  assert.equal(cp.release.branch, 'school/hillviewschool'); assert.equal(cp.release.base, 'dev');
  assert.match(L.BRANCH.url, /\/tree\/school\/hillviewschool$/); assert.equal(L.RELEASE.status, 'Placeholder');
  assert.ok(L.TEST_BUILD.url.length < 600, 'short enough to share');
});

test('the same link opens the UAT school, its website, phone app and requirements in the client’s browser', () => {
  const db = buildSeed();
  const cp = D.convertProposal(db, newProposal(db, o(), 'S').id, 'S');
  const site = cp.links.find((l) => l.code === 'TEST_SITE').url;
  const p = D.readTrial(site.slice(site.indexOf('#')));
  assert.ok(p, 'the website link is a test-build link');
  const other = buildSeed();
  const t = D.applyTrial(other, p, site.slice(site.indexOf('#')));
  assert.equal(t.name, 'Hillview School – UAT/DEMO'); assert.equal(t.env, 'UAT'); assert.equal(t.overrides.PRJ_LINKS, true);
  assert.equal(t.delivery.projectNo, cp.no); assert.equal(t.delivery.branch, 'school/hillviewschool'); assert.ok(!/\?to=/.test(t.delivery.trial));
  const html = D.tenantSiteHtml(other, t, 'https://example.com/app/');
  assert.match(html, /Welcome to Hillview School – UAT\/DEMO/); assert.match(html, /https:\/\/example\.com\/app\/#\/p\/apply/);
});

test('client approval and signing builds “<School> – Live (date)”; later versions wait for a new sign-off', () => {
  const db = buildSeed();
  const prop = newProposal(db, o(), 'S');
  const cp = D.convertProposal(db, prop.id, 'S');
  assert.throws(() => D.setProjectStatus(db, cp.id, 'Live', 'S'), /sign/);
  assert.throws(() => D.signOff(db, cp.id, { signedBy: ' ', date: '2026-11-19' }, 'S'), /who signed/);
  assert.throws(() => D.signOff(db, cp.id, { signedBy: 'Mrs. Asha Rao', date: '2999-01-01' }, 'S'), /future/);
  D.signOff(db, cp.id, { signedBy: 'Mrs. Asha Rao', designation: 'Principal', date: '2026-11-19', reference: 'SO-1' }, 'S');
  const uat = db.tenants.find((t) => t.id === cp.uatTenantId), live = db.tenants.find((t) => t.id === cp.liveTenantId);
  assert.equal(live.name, 'Hillview School – Live (19 Nov 2026)'); assert.equal(live.env, 'LIVE'); assert.equal(live.code, uat.code.replace(/-UAT$/, ''));
  assert.equal(live.subdomain, 'hillviewschool'); assert.deepEqual(live.overrides, uat.overrides); assert.equal(live.status, 'Onboarding');
  assert.equal(cp.status, 'Signed off'); assert.equal(cp.signoffs.length, 1);
  assert.match(cp.links.find((l) => l.code === 'RELEASE').url, /releases\/tag\/hillviewschool-v1\.0$/);
  assert.throws(() => D.signOff(db, cp.id, { signedBy: 'X', date: '2026-11-19' }, 'S'), /already signed off/);
  D.setProjectStatus(db, cp.id, 'Live', 'S'); assert.equal(live.status, 'Active');
  // a change after sign-off: the UAT school changes, the live one waits for the client
  saveOptions(db, prop.id, o({ addons: { TRANSPORT: true, PORTFOLIO: true, LMS: true } }), 'S');
  assert.throws(() => D.signOff(db, cp.id, { signedBy: 'Mrs. Asha Rao', date: '2026-11-20' }, 'S'), /regenerate/);
  D.regenerate(db, cp.id, 'S');
  assert.ok(sees(uat, 'ACA_CURRICULUM')); assert.ok(!sees(live, 'ACA_CURRICULUM')); assert.equal(cp.live.pending, '1.1');
  D.signOff(db, cp.id, { signedBy: 'Mrs. Asha Rao', date: '2026-11-20' }, 'S');
  assert.ok(sees(live, 'ACA_CURRICULUM')); assert.equal(cp.live.version, '1.1'); assert.equal(cp.signoffs.length, 2);
  assert.equal(db.tenants.filter((t) => t.schoolName === 'Hillview School').length, 2, 'one UAT and one live school');
  const f = D.schoolFile(db, cp);
  assert.equal(f.branch, 'school/hillviewschool'); assert.equal(f.live.signedVersion, '1.1'); assert.ok(f.addons.includes('LMS'));
});

test('saved projects from before are upgraded: UAT school, branch, Project Links', () => {
  const db = buildSeed();
  const cp = D.convertProposal(db, newProposal(db, o(), 'S').id, 'S');
  const t = db.tenants.find((x) => x.id === cp.tenantId);
  // as release 15 saved it
  Object.assign(t, { name: 'Hillview School', code: 'HSS', subdomain: 'hillviewschool', status: 'Onboarding' }); delete t.env; delete t.liveCode; delete t.liveSubdomain; delete t.schoolName;
  delete t.overrides.PRJ_LINKS; delete t.overrides.PROJECT; delete t.delivery;
  Object.assign(cp, { status: 'Onboarding' }); delete cp.uatTenantId; delete cp.release; delete cp.signoffs;
  seedRelease16(db);
  assert.equal(cp.status, 'UAT / Demo'); assert.equal(t.name, 'Hillview School – UAT/DEMO'); assert.equal(t.code, 'HSS-UAT');
  assert.equal(cp.release.branch, 'school/hillviewschool'); assert.equal(t.overrides.PRJ_LINKS, true);
  seedRelease16(db); assert.equal(t.code, 'HSS-UAT', 'runs once');
});

test('a client app with every feature: Service Provider has only “Add-ons for this School”, which switches add-ons per school', () => {
  const db = buildSeed();
  const cp = D.convertProposal(db, newProposal(db, o(), 'S').id, 'S');
  const t = db.tenants.find((x) => x.id === cp.uatTenantId);
  assert.ok(!sees(t, 'SP_ADDONS'), 'off unless set up for the client');
  t.overrides.SP_ADDONS = true;
  D.setSchoolAddons(db, t.id, RC.addons.map((a) => a.code), 'P');
  assert.ok(sees(t, 'SP_ADDONS') && sees(t, 'DASH') && sees(t, 'PAY_RUN') && sees(t, 'TRN_ROUTES'));
  ['SP_RATES', 'SP_PROPOSAL', 'SP_DEMO', 'SP_DELIVERY', 'SP_ANALYTICS', 'SP_COMPARE', 'SP_MARKET'].forEach((c) => assert.ok(!(D.schoolFile(db, cp).screens.includes(c)), c));
  assert.ok(!sees(t, 'SP_ADDONS', 'PRINCIPAL'), 'Admin only');
  D.setSchoolAddons(db, t.id, RC.addons.map((a) => a.code).filter((c) => !['DASHBOARD', 'PAYROLL', 'TRANSPORT'].includes(c)), 'P');
  assert.ok(!sees(t, 'DASH') && !sees(t, 'PAY_RUN') && !sees(t, 'TRN_ROUTES'), 'switched off');
  assert.ok(!t.delivery.addons.includes('TIMINGS'), 'Timings goes with Transport');
  assert.ok(sees(t, 'STU_ADMISSIONS') && sees(t, 'PRJ_LINKS') && sees(t, 'SP_ADDONS'), 'basics, Project Links and the add-ons menu stay');
  assert.equal(t.delivery.addonLog[0].removed.length, 4);
  const p = D.readTrial(D.trialLink('https://x.example/', t, cp).replace(/^[^#]*/, ''));
  assert.equal(p.sa, 1); assert.ok(!p.a.includes('DASHBOARD'));
});

test('Rebuild app: the selection becomes a new version and every output follows it', () => {
  const db = buildSeed();
  const cp = D.convertProposal(db, newProposal(db, o(), 'S').id, 'S');
  const t = db.tenants.find((x) => x.id === cp.uatTenantId);
  t.overrides.SP_ADDONS = true;
  D.setSchoolAddons(db, t.id, RC.addons.map((a) => a.code), 'P');
  t.delivery.builtAddons = [...t.delivery.addons]; t.delivery.builtOverrides = { ...t.overrides };   // as published
  assert.throws(() => D.rebuildSchool(db, t.id, RC.addons.map((a) => a.code), 'P'), /Nothing to rebuild/);
  const r = D.rebuildSchool(db, t.id, RC.addons.map((a) => a.code).filter((c) => c !== 'DASHBOARD'), 'P');
  assert.equal(r.version, '1.1'); assert.equal(t.delivery.version, '1.1'); assert.equal(cp.version, '1.1');
  assert.ok(!sees(t, 'DASH'));
  assert.deepEqual(t.delivery.builtAddons, t.delivery.addons);
  D.setSchoolAddons(db, t.id, t.delivery.addons.filter((c) => c !== 'PAYROLL'), 'P');   // menus hide at once…
  assert.ok(!sees(t, 'PAY_RUN')); assert.ok(t.delivery.builtAddons.includes('PAYROLL'), '…the build is unchanged until Rebuild');
  D.setSchoolAddons(db, t.id, t.delivery.builtAddons, 'P'); // undo
  assert.equal(t.delivery.builds[0].removed[0], 'Dashboard menu');
  const p = D.readTrial(cp.links.find((l) => l.code === 'TEST_BUILD').url.replace(/^[^#]*/, ''));
  assert.equal(p.ver, '1.1'); assert.ok(!p.a.includes('DASHBOARD'), 'the shared links carry the rebuilt app');
  const f = D.rebuildConfig(t);
  assert.equal(f.version, '1.1'); assert.ok(!f.addons.includes('DASHBOARD')); assert.equal(f.addonsMenu, true);
});

test('Roles & Permissions (provider): any non-basic menu or function switched on its own; Rebuild applies it; basics locked', () => {
  const db = buildSeed();
  const cp = D.convertProposal(db, newProposal(db, o(), 'S').id, 'S');
  const t = db.tenants.find((x) => x.id === cp.uatTenantId);
  t.overrides.SP_ADDONS = true; t.overrides.SP_FEATURES = true;
  D.setSchoolAddons(db, t.id, ['TRANSPORT'], 'P');
  t.delivery.builtAddons = [...t.delivery.addons]; t.delivery.builtOverrides = { ...t.overrides };
  assert.ok(sees(t, 'SP_FEATURES') && !sees(t, 'SP_FEATURES', 'PRINCIPAL'));
  assert.throws(() => D.setSchoolScreens(db, t.id, { OPS_USERS: false }, 'P'), /needed to run and manage/);
  // basic screens can be switched off too, and back on
  D.setSchoolScreens(db, t.id, { STU_ADMISSIONS: false, FEE_COLLECT: false }, 'P');
  assert.ok(!sees(t, 'STU_ADMISSIONS') && !sees(t, 'FEE_COLLECT') && sees(t, 'STU_LIST'));
  D.setSchoolScreens(db, t.id, { STU_ADMISSIONS: true, FEE_COLLECT: true }, 'P');
  assert.ok(sees(t, 'STU_ADMISSIONS') && sees(t, 'FEE_COLLECT'));
  // one screen of an add-on that is not bought, and one screen of a bought add-on taken away
  D.setSchoolScreens(db, t.id, { CMP_LIBRARY: true, TRN_MANIFEST: false, FN_WHATSAPP: true }, 'P');
  assert.ok(sees(t, 'CMP_LIBRARY'), 'one screen of an add-on not bought');
  assert.ok(!sees(t, 'TRN_MANIFEST'), 'hidden at once'); assert.ok(sees(t, 'TRN_ROUTES'), 'the rest of Transport stays');
  assert.equal(t.overrides.FN_WHATSAPP, true);
  const pend = D.pendingChanges(t);
  assert.ok(pend.hidden.includes('TRN_MANIFEST') && pend.shown.includes('FN_WHATSAPP'));
  const r = D.rebuildSchool(db, t.id, null, 'P');
  assert.equal(r.version, '1.1'); assert.ok(t.delivery.builds[0].hidden.length >= 1);
  assert.deepEqual(D.pendingChanges(t), { shown: [], hidden: [] });
  assert.match(t.delivery.tier, /set by hand/);
  // the marks travel in the shared link and the build file
  const p = D.readTrial(cp.links.find((l) => l.code === 'TEST_BUILD').url.replace(/^[^#]*/, ''));
  assert.equal(p.x.TRN_MANIFEST, false); assert.equal(p.x.FN_WHATSAPP, true);
  const other = buildSeed(); const t2 = D.applyTrial(other, p, '');
  assert.equal(t2.overrides.TRN_MANIFEST, false); assert.equal(t2.overrides.SP_FEATURES, true);
  assert.equal(D.rebuildConfig(t).screens.TRN_MANIFEST, false);
  // switching the add-on off and on again resets its single-screen marks
  D.setSchoolAddons(db, t.id, [], 'P'); D.setSchoolAddons(db, t.id, ['TRANSPORT'], 'P');
  assert.ok(sees(t, 'TRN_MANIFEST'));
});
