// Web regression: every role opens every screen; deep links; public enquiry; two tabs at once.
//   npm run build && npm run test:e2e         (CHROME_PATH=/path/to/chrome to use a local Chrome)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { serve } from '../store/serve.mjs';

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../dist');
let server, browser;
before(async () => { server = await serve(DIST); browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] }); });
after(async () => { await browser?.close(); server?.close(); });

async function open(ctx, hash = '#/login') {
  const page = await ctx.newPage(); page.setDefaultTimeout(8000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(server.url + hash);
  return { page, errors };
}
async function demo(page, label) {
  await page.getByRole('tab', { name: 'Demo quick access' }).click();
  await page.locator('.rolegrid button', { hasText: label }).first().click();
  await page.locator('nav.side, .topmenu').first().waitFor();
}

test('every demo role opens every screen without errors', async () => {
  const ROLES = ['Admin', 'Principal', 'Accountant', 'Teacher', 'Front Office', 'Parent', 'Transport team', 'Platform team', 'Teacher + Head of Teaching Staff', 'Teacher + Vice Principal'];
  for (const r of ROLES) {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    const { page, errors } = await open(ctx);
    await demo(page, r);
    const { MENU } = await import('../../src/data/menu.js');
    const viewAs = MENU.find((m) => m.code === 'VIEWAS').items.map((i) => i[1]);   // tested on their own below
    const items = (await page.locator('nav.side button.item').allInnerTexts()).filter((t) => !viewAs.includes(t));
    for (const it of items) { await page.locator('nav.side button.item', { hasText: it }).first().click(); await page.waitForTimeout(30); }
    assert.deepEqual(errors, [], r + ': ' + errors.join('; '));
    assert.ok(items.length > 0, r);
    await ctx.close();
  }
});

test('website deep link: parent lands on Requests after sign-in; a staff link is refused for a parent', async () => {
  const ctx = await browser.newContext();
  const { page } = await open(ctx);
  await page.evaluate(() => { location.hash = '#/s/SELF_REQUESTS'; });
  await page.getByText('Sign in to continue to').waitFor();
  await demo(page, 'Parent');
  await page.getByRole('heading', { name: 'Requests to school' }).waitFor();
  await page.goto(server.url + '#/s/STU_GATE');
  await page.locator('.toast', { hasText: 'not available' }).waitFor();
  await ctx.close();
});

test('public admission form: validates, then lands in the admissions pipeline', async () => {
  const ctx = await browser.newContext();
  const { page } = await open(ctx, '#/p/apply');
  await page.getByRole('button', { name: 'Send enquiry' }).click();
  await page.getByRole('alert').waitFor();
  for (const [l, v] of [["Child's first name", 'Asha'], ["Child's last name", 'Test'], ['Date of birth', '2019-06-01'], ["Parent's name", 'P Test'], ['Mobile', '9876543210']]) await page.getByLabel(l).fill(v);
  await page.getByLabel(/may contact me/).check();
  await page.getByRole('button', { name: 'Send enquiry' }).click();
  const ref = (await page.getByRole('status').innerText()).match(/APP-\d{4}-\d{4}/)[0];
  await page.goto(server.url + '#/login');
  await demo(page, 'Admin');
  await page.locator('nav.side button.item', { hasText: 'Admissions & Enquiries' }).click();
  await page.getByRole('tab', { name: /Applications/ }).click();
  assert.ok((await page.content()).includes(ref), 'enquiry visible to the school');
  await ctx.close();
});

test('two tabs at once: changes from one tab appear in the other and neither overwrites the other', async () => {
  const ctx = await browser.newContext();
  const a = (await open(ctx)).page; await demo(a, 'Parent');
  const b = (await open(ctx)).page; await demo(b, 'Parent');   // second tab, same browser (shares saved data)
  await b.locator('nav.side button.item', { hasText: 'Requests to School' }).click();
  const before = await b.locator('table tbody tr').count();
  await a.locator('nav.side button.item', { hasText: 'Requests to School' }).click();
  for (const reason of ['Wedding A', 'Wedding B']) {
    const tab = reason.endsWith('A') ? a : b;
    await tab.getByRole('button', { name: /^Leave \(child will be absent\)/ }).click();
    const d = new Date(Date.now() + (reason.endsWith('A') ? 10 : 20) * 864e5).toISOString().slice(0, 10);
    await tab.locator('.modal input[type=date]').first().fill(d);
    await tab.getByLabel(/Reason/).fill(reason);
    await tab.getByRole('button', { name: 'Send request' }).click();
    await tab.locator('.toast').waitFor();
  }
  await a.waitForTimeout(300);
  for (const tab of [a, b]) { const html = await tab.content(); assert.ok(html.includes('Wedding A') || (await tab.locator('table tbody tr').count()) >= before + 2, 'tab sees both'); }
  assert.equal(await b.locator('table tbody tr').count(), before + 2, 'second tab kept the first tab’s request');
  assert.equal(await a.locator('table tbody tr').count(), before + 2, 'first tab sees the second tab’s request');
  await ctx.close();
});

test('web & app screens: admin drafts, principal approves, menus change on the website', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const { page, errors } = await open(ctx);
  await demo(page, 'Admin');
  await page.locator('nav.side button.item', { hasText: 'Web & App Screens' }).click();
  await page.locator('main').getByRole('button', { name: 'Front Office', exact: true }).click();
  await page.getByRole('radiogroup', { name: 'Gate Desk: where it shows' }).getByRole('radio', { name: 'App only' }).click();
  await page.getByText('Draft — not live yet').waitFor();
  await page.getByRole('button', { name: /Send for approval \(1\)/ }).click();
  await page.locator('.modal input').fill('Gate on the tablet');
  await page.locator('.modal').getByRole('button', { name: 'Send' }).click();
  await page.getByText('Waiting for approval').first().waitFor();
  assert.ok(!(await page.getByRole('button', { name: 'Approve and publish' }).count()), 'the editor cannot approve');
  // Principal approves
  await page.evaluate(() => { sessionStorage.clear(); location.hash = '#/login'; location.reload(); });
  await demo(page, 'Principal');
  await page.locator('nav.side button.item', { hasText: 'Web & App Screens' }).click();
  await page.getByRole('button', { name: 'Approve and publish' }).click();
  await page.locator('.modal').getByRole('button', { name: 'Publish' }).click();
  await page.locator('.toast', { hasText: 'Published as version 2' }).waitFor();
  // Front Office no longer has the Gate Desk on the website
  await page.evaluate(() => { sessionStorage.clear(); location.hash = '#/login'; location.reload(); });
  await demo(page, 'Front Office');
  const items = await page.locator('nav.side button.item').allInnerTexts();
  assert.ok(!items.includes('Gate Desk'), 'gate desk is app only now');
  assert.ok(items.includes('Office Requests'));
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('guided demo walks through a workflow, switching people and screens', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const { page, errors } = await open(ctx, '#/p/guide');
  await page.getByRole('heading', { name: /User guide/ }).waitFor();
  await page.getByRole('button', { name: 'Start' }).first().click();          // Parent leave request workflow
  const bar = page.getByRole('region', { name: 'Guided demo' });
  await bar.getByText('step 1 of').waitFor();
  await page.getByRole('heading', { name: 'Requests to school' }).waitFor();
  await bar.getByRole('button', { name: 'Next step ›' }).click();
  await page.getByRole('heading', { name: /Coordinator/ }).waitFor();
  await bar.getByRole('button', { name: 'Next step ›' }).click();
  await bar.getByRole('button', { name: 'Next step ›' }).click();
  await page.getByRole('heading', { name: /route sheets/i }).waitFor();
  await bar.getByRole('button', { name: 'Next step ›' }).click();
  await bar.getByRole('button', { name: 'Finish ✓' }).click();
  await page.getByRole('heading', { name: 'User Guide & Demo' }).waitFor();
  assert.equal(await bar.count(), 0);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('every step of every guided demo opens the right screen for the right person', async () => {
  const { WORKFLOWS } = await import('../../src/data/guide.js');
  const { LABEL, MODULE_OF } = await import('../../src/data/menu.js');
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const { page, errors } = await open(ctx, '#/p/guide');
  ctx.on('page', (p) => p.close());                                  // public steps open a new tab; not needed here
  const bar = page.getByRole('region', { name: 'Guided demo' });
  const bad = [];
  for (const [w, wf] of WORKFLOWS.entries()) {
    if (w > 0) { await page.locator('nav.side button.item', { hasText: 'User Guide & Demo' }).click(); await page.getByRole('heading', { name: 'User Guide & Demo' }).waitFor(); }
    await page.getByRole('button', { name: 'Start' }).nth(w).click();
    for (const [i, s] of wf.steps.entries()) {
      if (i > 0) await bar.getByRole('button', { name: 'Next step ›' }).click();
      await bar.getByText(`step ${i + 1} of`).waitFor();
      if (s.public || s.needs) continue;            // public pages open in a new tab; 'needs' steps depend on an earlier action
      try { await page.locator('.crumbs', { hasText: s.screen === 'HOME' ? 'Main menu' : `${MODULE_OF[s.screen]} / ${LABEL[s.screen]}` }).waitFor({ timeout: 4000 }); }
      catch (e) { bad.push(`${wf.id} step ${i + 1}: expected ${LABEL[s.screen]}`); }
      if (await page.locator('.toast', { hasText: 'not available' }).count()) bad.push(`${wf.id} step ${i + 1}: not available toast`);
    }
    await bar.getByRole('button', { name: 'Finish ✓' }).click();
  }
  assert.deepEqual(bad, []);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('opens straight on the Main menu as Admin; Main menu button works from any screen', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const { page, errors } = await open(ctx, '');
  await page.getByRole('heading', { name: 'Main menu' }).waitFor();
  assert.ok((await page.locator('main section.card').count()) >= 12, 'every menu shown as a tile');
  await page.locator('main').getByRole('button', { name: 'Roles & Permissions' }).click();
  await page.locator('.crumbs', { hasText: 'Operations / Roles & Permissions' }).waitFor();
  await page.getByRole('button', { name: 'Main menu' }).first().click();
  await page.getByRole('heading', { name: 'Main menu' }).waitFor();
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Add user: designations follow the role; Parent has none', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const { page, errors } = await open(ctx, '#/s/OPS_USERS');
  await page.getByRole('button', { name: 'Add user' }).click();
  const modal = page.locator('.modal');
  await modal.getByRole('combobox', { name: /^Role/ }).selectOption('TRANSPORT');
  const opts = await modal.getByLabel(/Designation/).locator('option').allInnerTexts();
  assert.deepEqual(opts.slice(1), ['Transport In-charge', 'Transport Supervisor', 'Driver', 'Cleaner', 'Bus Helper / Attendant']);
  await modal.getByRole('combobox', { name: /^Role/ }).selectOption('PARENT');
  assert.equal(await modal.getByLabel('Designation: Parent').inputValue(), 'Parent');
  await modal.getByRole('combobox', { name: /^Role/ }).selectOption('TRANSPORT');
  await modal.getByLabel(/Designation/).selectOption('Driver');
  await modal.getByLabel('Full name').fill('Ravi Driver');
  await modal.getByLabel(/Sign-in ID/).fill('9876500001');
  await modal.getByRole('button', { name: 'Create and email link' }).click();
  await page.getByRole('cell', { name: 'Ravi Driver' }).waitFor();
  assert.ok((await page.locator('tr', { hasText: 'Ravi Driver' }).innerText()).includes('Driver'));
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('an account created in the phone app appears in Users for approval', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const { page, errors } = await open(ctx, '#/p/mobile');
  await page.getByLabel('School code').fill('GVS'); await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByLabel('First name').fill('Kiran'); await page.getByLabel('Last name').fill('Bus'); await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel(/Gmail \/ email or mobile/).fill('kiran.bus@example.com'); await page.getByRole('button', { name: 'Send verification code' }).click();
  const code = (await page.locator('text=/\\b\\d{6}\\b/').first().innerText().catch(() => '')).match(/\d{6}/)?.[0]
    || await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('school-app-demo-v7')); return d.outbox.find((m) => m.to === 'kiran.bus@example.com')?.body.match(/\d{6}/)?.[0]; });
  await page.getByLabel('Code').fill(code); await page.getByRole('button', { name: 'Verify' }).click();
  await page.getByLabel('Password', { exact: true }).fill('Strong@123'); await page.getByLabel('Confirm').fill('Strong@123'); await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel('I am a').selectOption('TRANSPORT');
  await page.getByLabel(/Designation in/).selectOption('Cleaner');
  await page.getByLabel(/I agree/).check();
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByRole('heading', { name: 'Account created' }).waitFor();
  const admin = await ctx.newPage();
  await admin.goto(server.url + '#/s/OPS_USERS');
  const row = admin.locator('tr', { hasText: 'Kiran Bus' });
  await row.waitFor();
  const text = await row.innerText();
  assert.match(text, /Transport team/); assert.match(text, /Cleaner/); assert.match(text, /Pending approval|Waiting/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Admin views the app as a parent: menus change, preview is read-only, phone view, back to Admin', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const { page, errors } = await open(ctx, '');
  await page.getByRole('heading', { name: 'Main menu' }).waitFor();
  await page.locator('nav.side button.item', { hasText: /^Parent$/ }).click();
  const bar = page.getByRole('region', { name: 'Viewing as another profile' });
  await bar.getByText('Rohit Sharma').waitFor();
  const items = await page.locator('nav.side button.item').allInnerTexts();
  assert.ok(items.includes('Requests to School') && !items.includes('Users'), 'parent menus only');
  await page.locator('nav.side button.item', { hasText: 'Requests to School' }).click();
  await page.getByRole('button', { name: /^Leave \(child will be absent\)/ }).click();
  await page.locator('.modal input[type=date]').first().fill(new Date(Date.now() + 9 * 864e5).toISOString().slice(0, 10));
  await page.getByLabel(/Reason/).fill('Preview test');
  await page.getByRole('button', { name: 'Send request' }).click();
  await page.locator('.toast', { hasText: 'Preview only' }).waitFor();
  await page.locator('.modal').getByRole('button', { name: /Cancel|Close/ }).first().click();
  await bar.getByRole('button', { name: 'Phone app' }).click();
  await page.locator('.m-tabs').waitFor();
  assert.deepEqual((await page.locator('.m-tabs .m-tab').allInnerTexts()).map((x) => x.trim()), ['Home', 'Requests', 'Fees', 'My child', 'Account']);
  await page.getByRole('button', { name: 'Back to Admin' }).click();
  await page.locator('nav.side button.item', { hasText: 'Users' }).waitFor();
  assert.equal(await page.getByRole('region', { name: 'Viewing as another profile' }).count(), 0);
  assert.deepEqual(errors.filter((e) => !/Preview only/.test(e)), []);
  await ctx.close();
});

test('Roles & Permissions: User management tab (profiles, departments, designations); no Access by designation tab', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const { page, errors } = await open(ctx, '#/s/OPS_ROLES');
  const tabs = (await page.getByRole('tab').allInnerTexts()).map((x) => x.trim());
  assert.deepEqual(tabs, ['User management', 'Role permissions']);
  const row = page.locator('tr', { hasText: 'Transport team' });
  assert.match(await row.innerText(), /Transport[\s\S]*Driver[\s\S]*Cleaner/);
  await page.getByRole('button', { name: 'Change department of Teacher' }).click();
  await page.getByLabel('Department for Teacher').fill('Teaching Staff');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.locator('tr', { hasText: 'Teaching Staff' }).first().waitFor();
  await page.getByLabel('New designation for Transport team').fill('Route Marshal');
  await page.getByLabel('New designation for Transport team').press('Enter');
  await row.getByText('Route Marshal').waitFor();
  await page.getByPlaceholder(/Librarian, Hostel Warden/).fill('Hostel Warden');
  await page.getByPlaceholder(/Hostel Warden, Assistant Warden/).fill('Hostel Warden, Assistant Warden');
  await page.getByLabel('Department').last().fill('Hostel');
  await page.getByRole('button', { name: 'Add profile' }).click();
  const w = page.locator('tr', { hasText: 'Assistant Warden' });
  await w.waitFor(); assert.match(await w.innerText(), /Hostel Warden[\s\S]*Hostel/);
  await page.goto(server.url + '#/s/OPS_USERS'); await page.reload();
  await page.getByRole('button', { name: 'Add user' }).click();
  await page.locator('.modal').getByRole('combobox', { name: /^Role/ }).selectOption({ label: 'Hostel Warden' });
  const opts = await page.locator('.modal').getByRole('combobox', { name: /Designation/ }).locator('option').allInnerTexts();
  assert.ok(opts.includes('Assistant Warden'), opts.join());
  assert.deepEqual(errors, []);
  await ctx.close();
});
