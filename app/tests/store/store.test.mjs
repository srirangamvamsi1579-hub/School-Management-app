// Store-readiness tests: the checks Google Play's pre-launch report and Apple's App Review apply,
// run automatically against the mobile build before every store upload.
//   npm run build:mobile && npm run test:store        (CHROME_PATH=/path/to/chrome to use a local Chrome)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { serve } from './serve.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '../..');
const MOBILE = path.resolve(APP, '../mobile');
const DIST = path.join(APP, 'dist-mobile');
const AXE = fs.readFileSync(path.join(APP, 'node_modules/axe-core/axe.min.js'), 'utf8');
const PW = 'Demo@123';
const PEOPLE = { PARENT: 'rohit.s@example.com', TEACHER: 'sonia.teacher@example.com', FRONT_OFFICE: '9845011200', PRINCIPAL: 'principal@greenvalley.example.in', TRANSPORT: 'transport@greenvalley.example.in' };
const PHONES = [['Small phone (iPhone SE)', 320, 568], ['Android phone', 360, 800], ['iPhone 15', 390, 844], ['iPad', 820, 1180]];
let server, browser;
const report = [];

before(async () => {
  assert.ok(fs.existsSync(path.join(DIST, 'index.html')), 'run npm run build:mobile first');
  server = await serve(DIST);
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] });
});
after(async () => {
  await browser?.close(); server?.close();
  fs.writeFileSync(path.join(APP, 'tests/store/last-report.json'), JSON.stringify(report, null, 2));
});

async function phone(w = 390, h = 844, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, ...opts });
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on('pageerror', (e) => errors.push('page error: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()}: ${r.url()}`); });
  const requests = [];
  page.on('request', (r) => requests.push(r.url()));
  return { ctx, page, errors, requests };
}
async function signIn(page, who) {
  await page.goto(server.url);
  await page.getByLabel('School code').fill('GVS');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Email or mobile').fill(who);
  await page.getByLabel('Password', { exact: true }).fill(PW);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.locator('.m-tabs').waitFor();
}
const tabs = (page) => page.locator('.m-tabs .m-tab').allInnerTexts();
async function everyTab(page, fn) {
  const names = await tabs(page);
  for (const n of names) {
    if (n.trim() === 'More') {                       // screens behind "More" get the same checks
      await page.locator('.m-tabs .m-tab', { hasText: 'More' }).click();
      const extra = (await page.locator('.m-sheet-item').allInnerTexts()).map((x) => x.trim()).filter((x) => x !== 'Close');
      await page.locator('.m-sheet-item', { hasText: 'Close' }).click();
      for (const e of extra) { await page.locator('.m-tabs .m-tab', { hasText: 'More' }).click(); await page.locator('.m-sheet-item', { hasText: e }).click(); await page.waitForTimeout(80); await fn(e); }
      continue;
    }
    await page.locator('.m-tabs .m-tab', { hasText: n }).click();
    await page.waitForTimeout(80);
    await fn(n.trim());
  }
}
// axe-core: WCAG 2.1 A/AA rules (Play pre-launch and Apple accessibility reviews look for the same things)
async function axe(page) {
  await page.addScriptTag({ content: AXE });
  return page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } })).violations
    .filter((v) => ['serious', 'critical'].includes(v.impact)).map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, sample: v.nodes[0]?.target?.join(' ') })));
}
// Touch targets: Android asks for 48 dp, Apple for 44 pt. Every control must be at least 44 × 44 CSS px
// (links inside sentences are exempt, as in WCAG 2.5.8).
async function smallTargets(page) {
  return page.evaluate(() => [...document.querySelectorAll('button, [role=tab], input:not([type=hidden]), select, textarea, a.btn')]
    .filter((e) => { const r = e.getBoundingClientRect(); const st = getComputedStyle(e); return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && !e.closest('[aria-hidden=true]'); })
    .map((e) => { const r = e.getBoundingClientRect(); const small = ['checkbox', 'radio'].includes(e.type) ? (r.width < 20 || (e.closest('label')?.getBoundingClientRect().height || 0) < 44) : (r.height < 44 || r.width < 44); return small ? `${e.tagName.toLowerCase()} "${(e.innerText || e.getAttribute('aria-label') || e.name || e.type || '').trim().slice(0, 30)}" ${Math.round(r.width)}×${Math.round(r.height)}` : null; })
    .filter(Boolean));
}
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test('1. Launches and every tab opens without errors, for every role (pre-launch crawl)', async () => {
  for (const [role, who] of Object.entries(PEOPLE)) {
    const { ctx, page, errors } = await phone();
    await signIn(page, who);
    const seen = [];
    await everyTab(page, async (n) => { seen.push(n); assert.ok((await page.locator('#m-main').innerText()).length > 20, `${role} → ${n} is empty`); });
    report.push({ check: 'crawl', role, tabs: seen, errors });
    assert.deepEqual(errors, [], `${role}: ${errors.join('; ')}`);
    await ctx.close();
  }
});

test('2. Access rules: each role sees only its own tabs; parents never see staff screens', async () => {
  const expect = { PARENT: ['Home', 'Requests', 'Fees', 'Account'], TEACHER: ['Home', 'Attendance', 'Approvals', 'Meetings', 'Account'], FRONT_OFFICE: ['Home', 'Gate', 'Account'], TRANSPORT: ['Home', 'Route sheet', 'Account'] };
  for (const [role, want] of Object.entries(expect)) {
    const { ctx, page } = await phone(); await signIn(page, PEOPLE[role]);
    assert.deepEqual((await tabs(page)).map((x) => x.trim()), want, role);
    await ctx.close();
  }
});

test('3. Accessibility (WCAG 2.1 AA via axe-core) on every screen', async () => {
  const found = [];
  for (const role of ['PARENT', 'TEACHER', 'FRONT_OFFICE', 'TRANSPORT', 'PRINCIPAL']) {
    const { ctx, page } = await phone(); await signIn(page, PEOPLE[role]);
    await everyTab(page, async (n) => { for (const v of await axe(page)) found.push(`${role}/${n}: ${v.id} (${v.impact}, ${v.n}×) ${v.sample}`); });
    await ctx.close();
  }
  { const { ctx, page } = await phone(); await page.goto(server.url); for (const v of await axe(page)) found.push(`school code: ${v.id}`); await ctx.close(); }
  report.push({ check: 'axe', violations: found });
  assert.deepEqual(found, []);
});

test('4. Touch targets are at least 44 × 44 px', async () => {
  const found = [];
  for (const role of ['PARENT', 'TEACHER', 'FRONT_OFFICE', 'TRANSPORT', 'PRINCIPAL']) {
    const { ctx, page } = await phone(); await signIn(page, PEOPLE[role]);
    await everyTab(page, async (n) => { for (const s of await smallTargets(page)) found.push(`${role}/${n}: ${s}`); });
    await ctx.close();
  }
  report.push({ check: 'touch targets', small: found });
  assert.deepEqual(found, []);
});

test('5. Fits every screen size: no sideways scrolling (small phone to iPad)', async () => {
  const found = [];
  for (const [label, w, h] of PHONES) {
    const { ctx, page } = await phone(w, h); await signIn(page, PEOPLE.PARENT);
    await everyTab(page, async (n) => { const o = await overflow(page); if (o > 1) found.push(`${label}/${n}: ${o}px too wide`); });
    await ctx.close();
  }
  report.push({ check: 'layout', overflow: found });
  assert.deepEqual(found, []);
});

test('6. Reviewer demo account signs in; privacy policy is reachable before sign-in', async () => {
  const { ctx, page } = await phone();
  await page.goto(server.url);
  await page.getByRole('link', { name: 'Privacy policy' }).click();
  await page.getByRole('heading', { name: 'Privacy policy' }).waitFor();
  assert.match(await page.content(), /Delete|delete/);
  await signIn(page, PEOPLE.PARENT);
  await ctx.close();
});

test('7. Account deletion inside the app (Apple 5.1.1(v), Google Play account deletion)', async () => {
  const { ctx, page } = await phone(); await signIn(page, PEOPLE.PARENT);
  await page.locator('.m-tabs .m-tab', { hasText: 'Account' }).click();
  await page.getByRole('button', { name: 'Delete my account' }).click();
  await page.getByLabel('Enter your password to confirm').fill(PW);
  await page.getByRole('button', { name: 'Delete permanently' }).click();
  await page.getByLabel('Email or mobile').waitFor();                         // signed out
  await page.getByLabel('Email or mobile').fill(PEOPLE.PARENT);
  await page.getByLabel('Password', { exact: true }).fill(PW);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('alert').waitFor();
  assert.match(await page.getByRole('alert').innerText(), /No account/);
  await ctx.close();
});

test('8. Account deletion on the web without the app (Google Play web link)', async () => {
  const { ctx, page } = await phone();
  await page.goto(server.url + '#/p/delete');
  await page.getByLabel('Email or mobile').fill(PEOPLE.TEACHER);
  await page.getByRole('button', { name: 'Send code' }).click();
  const code = (await page.locator('text=/the code is \\d{6}/').innerText()).match(/\d{6}/)[0];
  await page.getByLabel('6-digit code').fill(code);
  await page.getByRole('button', { name: 'Delete my account' }).click();
  await page.getByRole('status').waitFor();
  await ctx.close();
});

test('9. Works offline: tells the person and keeps showing saved information', async () => {
  const { ctx, page, errors } = await phone(); await signIn(page, PEOPLE.PARENT);
  await ctx.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await page.locator('.m-offline').waitFor();
  await page.locator('.m-tabs .m-tab', { hasText: 'Requests' }).click();
  assert.ok((await page.locator('#m-main').innerText()).includes('Requests'));
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('10. A parent can raise every kind of request from the phone', async () => {
  const { ctx, page, errors } = await phone(); await signIn(page, PEOPLE.PARENT);
  await page.locator('.m-tabs .m-tab', { hasText: 'Requests' }).click();
  for (const [card, fill] of [['Leave (child will be absent)', async () => page.getByLabel(/Reason/).fill('Family wedding')],
    ['Late arrival', async () => {}], ['Meet or call a teacher', async () => page.getByLabel(/discuss/).fill('Maths progress')], ['Other request', async () => page.getByLabel(/Details/).fill('Bonafide certificate')]]) {
    await page.getByRole('button', { name: new RegExp('^' + card.replace(/[()]/g, '\\$&')) }).click();
    const d = new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10);
    await page.locator('.modal input[type=date]').first().fill(d);
    await fill();
    await page.getByRole('button', { name: 'Send request' }).click();
    await page.locator('.toast').waitFor();
    assert.ok(!(await page.locator('.modal').count()), card + ' did not send: ' + (await page.locator('[role=alert]').allInnerTexts()).join());
  }
  const rows = await page.locator('table tbody tr').count();
  assert.ok(rows >= 4);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('11. Starts fast and stays small; no cleartext or third-party network calls', async () => {
  const { ctx, page, requests } = await phone();
  const t0 = Date.now(); await page.goto(server.url); await page.getByLabel('School code').waitFor(); const ms = Date.now() - t0;
  const size = fs.readdirSync(path.join(DIST, 'assets')).reduce((a, f) => a + fs.statSync(path.join(DIST, 'assets', f)).size, 0);
  const outside = requests.filter((u) => !u.startsWith(server.url) && !u.startsWith('data:'));
  report.push({ check: 'performance', firstScreenMs: ms, webBundleKB: Math.round(size / 1024), outside });
  assert.ok(ms < 3000, `first screen took ${ms} ms`);
  assert.ok(size < 5 * 1024 * 1024, `bundle ${size} bytes`);
  assert.deepEqual(outside, []);
  await ctx.close();
});

test('12. Native project settings the stores check', () => {
  const vars = fs.readFileSync(path.join(MOBILE, 'android/variables.gradle'), 'utf8');
  assert.match(vars, /targetSdkVersion = 36/, 'Play: target API 36');
  const man = fs.readFileSync(path.join(MOBILE, 'android/app/src/main/AndroidManifest.xml'), 'utf8');
  assert.match(man, /allowBackup="false"/); assert.match(man, /POST_NOTIFICATIONS/); assert.doesNotMatch(man, /usesCleartextTraffic="true"/);
  assert.doesNotMatch(man, /READ_CONTACTS|ACCESS_FINE_LOCATION|READ_SMS|RECORD_AUDIO|QUERY_ALL_PACKAGES/, 'no sensitive permissions');
  const cfg = JSON.parse(fs.readFileSync(path.join(MOBILE, 'capacitor.config.json'), 'utf8'));
  assert.equal(cfg.android.webContentsDebuggingEnabled, false);
  const plist = fs.readFileSync(path.join(MOBILE, 'ios/App/App/Info.plist'), 'utf8');
  assert.match(plist, /ITSAppUsesNonExemptEncryption<\/key>\s*<false\/>/); assert.doesNotMatch(plist, /armv7/);
  assert.doesNotMatch(plist, /NS(Location|Contacts|Microphone)\w*UsageDescription/, 'no usage strings for features the app does not use');
  const pbx = fs.readFileSync(path.join(MOBILE, 'ios/App/App.xcodeproj/project.pbxproj'), 'utf8');
  assert.match(pbx, /PrivacyInfo.xcprivacy in Resources/, 'Apple privacy manifest in the app bundle');
  assert.match(pbx, /CODE_SIGN_ENTITLEMENTS = App\/App.entitlements/);
  const bundle = fs.readdirSync(path.join(DIST, 'assets')).map((f) => fs.readFileSync(path.join(DIST, 'assets', f), 'utf8')).join('');
  assert.doesNotMatch(bundle, /AKIA[0-9A-Z]{16}|BEGIN (RSA )?PRIVATE KEY|sk_live_/, 'no secrets in the app');
});
