// Release 14.1: client delivery on conversion; Service Provider only for our company's Admin; plan names; client PDF
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSeed } from '../src/data/seed.js';
import { PLANS, canSee } from '../src/data/menu.js';
import { screensFor } from '../src/lib/auth.js';
import { blankOptions, DEFAULT_RATE_CARD as RC } from '../src/lib/pricing.js';
import { newProposal, saveOptions } from '../src/lib/proposals.js';
import * as D from '../src/lib/delivery.js';
import { buildDocPdf } from '../src/lib/docPdf.js';
import { buildProposalPdf } from '../src/lib/proposalPdf.js';

const o = (x) => ({ ...blankOptions(RC), client: 'Hillview School', city: 'Mysuru', students: 650, buses: 8, tier: 'PRO', addons: { TRANSPORT: true, TIMINGS: true },
  poc: { name: 'Mrs. Asha Rao', designation: 'Principal', email: 'principal@hillview.example.com', phone: '+91 90000 44444' }, ...x });

test('plans have the sales names; client PDFs leave out internal figures by default', () => {
  assert.deepEqual(PLANS.map((p) => p.name), ['Starter', 'Pro', 'Pro+', 'Pro+ Enterprise']);
  assert.equal(blankOptions().showInternal, false);
  const db = buildSeed(); const p = db.provider.proposals[0];
  const client = buildProposalPdf({ proposal: p, rc: db.provider.rateCard, profile: db.provider.profile }).getNumberOfPages();
  const internal = buildProposalPdf({ proposal: { ...p, options: { ...p.options, showInternal: true } }, rc: db.provider.rateCard, profile: db.provider.profile }).getNumberOfPages();
  assert.ok(internal >= client);
});

test('Service Provider is for our company\'s Admin only, and never inside a client, demo or trial school', () => {
  const db = buildSeed();
  const company = db.users.find((u) => u.role === 'ADMIN' && u.companyAdmin);
  assert.ok(company, 'the test build Admin is our company Admin');
  assert.ok(screensFor(db, company, 'ADMIN').includes('SP_DELIVERY'));
  const school = { ...company, companyAdmin: false };
  assert.ok(!screensFor(db, school, 'ADMIN').some((c) => c.startsWith('SP_')), 'a school Admin never sees our menus');
  assert.ok(!canSee('SP_RATES', 'ADMIN', 4, {}, { ADMIN: screensFor(db, school, 'ADMIN') }));
  db.tenantId = db.provider.projects[0].tenantId;                // inside the converted client's school
  assert.ok(!screensFor(db, company, 'ADMIN').some((c) => c.startsWith('SP_')));
  assert.ok(screensFor(db, null, 'SALES').includes('SP_DELIVERY'), 'sales has client delivery');
});

test('converting a proposal creates the school, documents and links, and marks it Won', () => {
  const db = buildSeed();
  const p = newProposal(db, o(), 'Sales team');
  assert.throws(() => D.convertProposal(db, newProposal(db, o({ poc: { name: 'X' } }), 'S').id, 'S'), /email ID/);
  const cp = D.convertProposal(db, p.id, 'Sales team');
  assert.equal(p.status, 'Won'); assert.equal(p.projectId, cp.id);
  assert.equal(D.convertProposal(db, p.id, 'x').id, cp.id, 'one project per proposal');
  const t = db.tenants.find((x) => x.id === cp.tenantId);
  assert.equal(t.plan, 'GROWTH'); assert.equal(t.status, 'Onboarding'); assert.equal(t.overrides.DASH, true); assert.equal(t.overrides.ACA_CURRICULUM, false);
  assert.equal(cp.version, '1.0'); assert.equal(cp.documents.length, 8);
  const byCode = Object.fromEntries(cp.links.map((l) => [l.code, l]));
  assert.equal(byCode.TEST_BUILD.status, 'Ready'); assert.equal(byCode.TEST_BUILD.version, '1.0');
  assert.equal(byCode.WEB_PROD.status, 'Planned'); assert.equal(byCode.PLAY_TEST.status, 'Placeholder'); assert.equal(byCode.TESTFLIGHT.status, 'Placeholder');
  D.LINK_GROUPS.forEach((g) => assert.ok(cp.links.some((l) => l.group === g), g));
  for (const [c] of D.DOC_TYPES) {
    const d = D.buildDoc(db, cp, c);
    assert.ok(d.sections.length >= 3, c); assert.equal(d.version, '1.0');
    assert.equal(Buffer.from(buildDocPdf(d, db.provider.profile).output('arraybuffer')).subarray(0, 4).toString(), '%PDF');
  }
  assert.match(JSON.stringify(D.buildDoc(db, cp, 'ORDER')), /Transport routes and route map/);
  assert.match(D.websiteHtml(db, cp), /Welcome to Hillview School[\s\S]*Admission enquiry/);
});

test('the test-build link opens the school as sold in another browser', () => {
  const db = buildSeed();
  const cp = D.convertProposal(db, newProposal(db, o({ addons: { PORTFOLIO: true } }), 'S').id, 'S');
  const url = cp.links.find((l) => l.code === 'TEST_BUILD').url;
  assert.ok(url.length < 600, 'short enough to share');
  const p = D.readTrial(url.slice(url.indexOf('#')));
  const other = buildSeed();
  const t = D.applyTrial(other, p);
  assert.equal(other.tenantId, t.id); assert.equal(t.name, 'Hillview School'); assert.equal(t.trial.version, '1.0');
  const sold = db.tenants.find((x) => x.id === cp.tenantId).overrides;
  ['DASH', 'STU_PORTFOLIO', 'TRN_ROUTES', 'FN_STOP_TIMINGS', 'ACA_CURRICULUM', 'STU_ADMISSIONS'].forEach((c) => assert.equal(t.overrides[c], sold[c], c));
  D.applyTrial(other, p); assert.equal(other.tenants.filter((x) => x.code === t.code).length, 1, 'opening it again replaces it');
  assert.equal(D.readTrial('#/try/not-a-link'), null);
});

test('links: fill a placeholder, history kept, planned to live, only filled links can be shared', () => {
  const db = buildSeed();
  const cp = D.convertProposal(db, newProposal(db, o(), 'S').id, 'S');
  assert.throws(() => D.setLink(db, cp.id, 'TESTFLIGHT', { url: 'http://x.example.com' }, 'S'), /https/);
  D.setLink(db, cp.id, 'TESTFLIGHT', { url: 'https://testflight.apple.com/join/AbC123', version: '1.0 (build 7)' }, 'S');
  const tf = cp.links.find((l) => l.code === 'TESTFLIGHT');
  assert.equal(tf.status, 'Ready'); assert.equal(tf.history.length, 1); assert.match(tf.history[0].url, /<invite-code>/);
  D.setLink(db, cp.id, 'WEB_PROD', { url: cp.links.find((l) => l.code === 'WEB_PROD').url, live: false }, 'S');
  assert.equal(cp.links.find((l) => l.code === 'WEB_PROD').status, 'Planned');
  assert.throws(() => D.shareWithCustomer(db, cp.id, { to: 'principal@hillview.example.com', linkCodes: ['PLAY_TEST'], docCodes: [] }, 'S'), /Placeholder/);
  assert.throws(() => D.shareWithCustomer(db, cp.id, { to: 'bad', linkCodes: ['TEST_BUILD'], docCodes: [] }, 'S'), /email ID/);
  D.shareWithCustomer(db, cp.id, { to: 'principal@hillview.example.com', linkCodes: ['TEST_BUILD', 'TESTFLIGHT'], docCodes: ['UAT', 'LINKS'], message: 'Hello' }, 'S');
  assert.equal(cp.links.find((l) => l.code === 'TEST_BUILD').status, 'Shared');
  assert.equal(db.outbox[0].kind, 'Client delivery'); assert.deepEqual(db.outbox[0].attachments.length, 2); assert.match(db.outbox[0].body, /version 1\.0/);
});

test('a change to the proposal after conversion is regenerated as the next version', () => {
  const db = buildSeed();
  const p = newProposal(db, o(), 'S');
  const cp = D.convertProposal(db, p.id, 'S');
  D.setLink(db, cp.id, 'TESTFLIGHT', { url: 'https://testflight.apple.com/join/AbC123' }, 'S');
  const before = cp.links.find((l) => l.code === 'TEST_BUILD').url;
  assert.equal(D.proposalChanged(db, cp), false);
  saveOptions(db, p.id, { ...p.options, addons: { ...p.options.addons, LMS: true } });
  assert.equal(D.proposalChanged(db, cp), true);
  D.regenerate(db, cp.id, 'S');
  assert.equal(cp.version, '1.1'); assert.equal(D.proposalChanged(db, cp), false);
  assert.equal(db.tenants.find((t) => t.id === cp.tenantId).overrides.ACA_CURRICULUM, true);
  const tb = cp.links.find((l) => l.code === 'TEST_BUILD');
  assert.notEqual(tb.url, before); assert.equal(tb.version, '1.1'); assert.equal(tb.history[0].version, '1.0');
  assert.equal(cp.links.find((l) => l.code === 'TESTFLIGHT').url, 'https://testflight.apple.com/join/AbC123', 'links the team filled in are kept');
  assert.ok(cp.documents.every((d) => d.version === '1.1'));
});

test('the seed has a converted client for the Won sample proposal', () => {
  const db = buildSeed();
  assert.equal(db.provider.projects.length, 1);
  assert.equal(db.provider.proposals.find((p) => p.id === 'PR3').projectId, db.provider.projects[0].id);
});
