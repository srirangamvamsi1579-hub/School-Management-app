// Web regression: every role opens every screen; deep links; public enquiry; two tabs at once.
//   npm run build && npm run test:e2e         (CHROME_PATH=/path/to/chrome to use a local Chrome)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { withAutoAdmin } from './autologin.mjs';
import { serve } from '../store/serve.mjs';

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../dist');
let server, browser;
before(async () => { server = await serve(DIST); browser = withAutoAdmin(await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] })); });
after(async () => { await browser?.close(); server?.close(); });

// Most tests click through the side menu, so they start with every group expanded (the default is collapsed;
// see the 'side menu starts collapsed' test). Set once per tab; a test's own toggles are kept.
const { MENU: ALL_MENUS } = await import('../../src/data/menu.js');
const EXPANDED = JSON.stringify(Object.fromEntries(ALL_MENUS.map((m) => [m.code, true])));
async function open(ctx, hash = '#/login?demo', { collapsed = false } = {}) {
  if (!collapsed && !ctx._expanded) { ctx._expanded = true; await ctx.addInitScript((v) => { if (!sessionStorage.getItem('school-side-open')) sessionStorage.setItem('school-side-open', v); }, EXPANDED); }
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
  await page.goto(server.url + '#/login?demo');
  await demo(page, 'Admin');
  await page.locator('nav.side button.item', { hasText: 'Admissions & Enquiries' }).click();
  await page.getByPlaceholder(/Search child/).fill(ref);   // release 15.1: the list is the page now; summaries moved to Data Analytics
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
  await page.evaluate(() => { sessionStorage.clear(); location.hash = '#/login?demo'; location.reload(); });
  await demo(page, 'Principal');
  await page.locator('nav.side button.item', { hasText: 'Web & App Screens' }).click();
  await page.getByRole('button', { name: 'Approve and publish' }).click();
  await page.locator('.modal').getByRole('button', { name: 'Publish' }).click();
  await page.locator('.toast', { hasText: 'Published as version 2' }).waitFor();
  // Front Office no longer has the Gate Desk on the website
  await page.evaluate(() => { sessionStorage.clear(); location.hash = '#/login?demo'; location.reload(); });
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

test('signed in as Admin it opens on the Main menu; Main menu button works from any screen', async () => {
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
  assert.equal(await modal.getByLabel('Designation: N/A').inputValue(), 'N/A');
  await modal.getByRole('combobox', { name: /^Role/ }).selectOption('TRANSPORT');
  await modal.getByLabel(/Designation/).selectOption('Driver');
  await modal.getByLabel('Full name').fill('Ravi Driver');
  await modal.getByLabel(/Sign-in ID/).fill('9876500001');
  await modal.getByRole('button', { name: 'Create and email link' }).click();
  await page.locator('.toast', { hasText: 'Say why this person is being added' }).waitFor();
  await modal.getByLabel(/Why is this person being added/).selectOption('Needs help to register');
  await modal.getByRole('button', { name: 'Create and email link' }).click();
  await page.getByRole('cell', { name: 'Ravi Driver', exact: true }).waitFor();
  assert.ok((await page.locator('tr', { hasText: 'Ravi Driver' }).innerText()).includes('Driver'));
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('staff register in the phone app against the staff record: the account opens at once with the role from the record', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const { page, errors } = await open(ctx, '#/p/mobile');
  await page.getByLabel('School code').fill('GVS'); await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByLabel('First name').fill('Kavya'); await page.getByLabel('Last name').fill('Iyer'); await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel(/Gmail \/ email or mobile/).fill('kavya.iyer@example.com'); await page.getByRole('button', { name: 'Send verification code' }).click();
  const code = await page.evaluate(() => JSON.parse(localStorage.getItem('school-app-demo-v9')).outbox.find((m) => m.to === 'kavya.iyer@example.com')?.body.match(/\d{6}/)?.[0]);
  await page.getByLabel('Code').fill(code); await page.getByRole('button', { name: 'Verify' }).click();
  await page.getByLabel('Password', { exact: true }).fill('Strong@123'); await page.getByLabel('Confirm').fill('Strong@123'); await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel('I am a').selectOption('STAFF');
  await page.getByLabel('Employee code').fill('EMP-0999');
  await page.getByLabel(/I agree/).check();
  await page.getByRole('button', { name: 'Create account' }).click();
  assert.match(await page.getByRole('alert').innerText(), /don't match the school's staff record[\s\S]*4 tries left/);
  await page.getByLabel('Employee code').fill('EMP-0131');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByRole('heading', { name: 'Your account is ready' }).waitFor();
  await page.getByText(/open as Teacher · PRT/).waitFor();
  const admin = await ctx.newPage();
  await admin.goto(server.url + '#/s/OPS_USERS');
  const text = await admin.locator('tr', { hasText: 'kavya.iyer@example.com' }).innerText();
  assert.match(text, /Teacher[\s\S]*Academics[\s\S]*PRT[\s\S]*ACTIVE/i);
  assert.equal(await admin.getByText(/Waiting for approval|Pending/).count(), 0, 'nobody waits for approval');
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
  assert.deepEqual((await page.locator('.m-tabs .m-tab').allInnerTexts()).map((x) => x.trim()), ['Home', 'Requests', 'Fees', 'My child', 'More']);
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
  assert.deepEqual(tabs, ['User management', 'Permissions by department', 'Access summary']);
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
  await page.getByLabel('Department', { exact: true }).last().fill('Hostel');
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

test('User management: remove any designation (blocked while someone holds it), then add it back', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const { page, errors } = await open(ctx, '#/s/OPS_ROLES');
  const row = page.locator('tr', { hasText: 'Transport team' });
  await row.getByRole('button', { name: 'Remove Cleaner from Transport team' }).click();
  const dlg = page.getByRole('dialog', { name: 'Remove this designation?' });
  await dlg.getByRole('button', { name: 'Cancel' }).click();
  assert.equal(await row.getByRole('button', { name: 'Remove Cleaner from Transport team' }).count(), 1, 'Cancel keeps it');
  await row.getByRole('button', { name: 'Remove Cleaner from Transport team' }).click();
  await dlg.getByRole('button', { name: 'Remove', exact: true }).click();
  await page.locator('.toast', { hasText: 'Removed “Cleaner”' }).waitFor();
  assert.equal(await row.getByRole('button', { name: 'Remove Cleaner from Transport team' }).count(), 0);
  await row.getByRole('button', { name: 'Remove Transport In-charge from Transport team' }).click();
  await page.locator('.toast', { hasText: 'change their designation in Users first' }).waitFor();
  assert.equal(await row.getByRole('button', { name: 'Remove Transport In-charge from Transport team' }).count(), 1, 'held by Manjunath, so kept');
  await page.locator('nav.side button.item', { hasText: /^Users$/ }).click();
  await page.getByRole('button', { name: 'Add user' }).click();
  await page.locator('.modal').getByRole('combobox', { name: /^Role/ }).selectOption('TRANSPORT');
  const opts = await page.locator('.modal').getByRole('combobox', { name: /Designation/ }).locator('option').allInnerTexts();
  assert.ok(!opts.includes('Cleaner') && opts.includes('Driver'), opts.join());
  await page.locator('.modal').getByRole('button', { name: 'Close' }).click();
  await page.locator('nav.side button.item', { hasText: 'Roles & Permissions' }).click();
  await page.getByLabel('New designation for Transport team').fill('cleaner');
  await page.getByLabel('New designation for Transport team').press('Enter');
  await page.locator('tr', { hasText: 'Transport team' }).getByRole('button', { name: 'Remove Cleaner from Transport team' }).waitFor();
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('side menu starts collapsed; groups open on click or Enter; no Expand all; stays as left after a reload', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const { page, errors } = await open(ctx, '', { collapsed: true });
  await page.getByRole('heading', { name: 'Main menu' }).waitFor();
  const side = page.locator('nav.side');
  const n = await side.locator('.mod').count();
  assert.ok(n >= 12, 'every menu group listed');
  assert.equal(await side.locator('[aria-expanded="true"]').count(), 0, 'all collapsed');
  assert.equal(await side.getByRole('button', { name: /Expand all|Collapse all/ }).count(), 0, 'no Expand all / Collapse all');
  assert.deepEqual(await side.locator('button.item').allInnerTexts(), ['⌂ Main menu'], 'no sub-menus shown');
  await side.getByRole('button', { name: /^Fees/ }).click();
  await side.locator('button.item', { hasText: 'Collect Fee' }).waitFor();
  await side.getByRole('button', { name: /^Fees/ }).press('Enter');
  assert.equal(await side.locator('button.item', { hasText: 'Collect Fee' }).count(), 0, 'keyboard collapses it');
  await page.locator('main').getByRole('button', { name: 'Roles & Permissions' }).click();
  await page.locator('.crumbs', { hasText: 'Operations / Roles & Permissions' }).waitFor();
  assert.equal(await side.locator('[aria-expanded="true"]').count(), 0, 'opening a screen does not expand the menu');
  await side.getByRole('button', { name: /^Transport/ }).click();
  await page.reload(); await page.locator('nav.side').waitFor();
  assert.equal(await page.locator('nav.side [aria-expanded="true"]').count(), 1, 'kept for this visit');
  const fresh = await ctx.newPage(); await fresh.goto(server.url); await fresh.locator('nav.side').waitFor();
  assert.equal(await fresh.locator('nav.side [aria-expanded="true"]').count(), 0, 'a new visit starts collapsed');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Permissions by department: every menu listed; No access / Read only / Full access for a whole menu or single sub-menus; expand/collapse levels', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  const { page, errors } = await open(ctx, '#/s/OPS_ROLES');
  await page.getByRole('tab', { name: 'Permissions by department' }).click();
  await page.getByRole('option', { name: /^Transport/ }).click();
  const tree = page.getByRole('tree', { name: 'Menus for Transport' });
  const { MENU } = await import('../../src/data/menu.js');
  for (const m of MENU.filter((x) => !['PLATFORM', 'SERVICE_PROVIDER'].includes(x.code))) assert.equal(await tree.getByLabel('Access to all of ' + m.label, { exact: true }).count(), 1, m.label + ' listed');
  assert.equal(await tree.getByLabel('Access to Collect Fee', { exact: true }).count(), 0, 'collapsed at first');
  await tree.getByLabel('Access to all of Fees', { exact: true }).selectOption('READ');
  await tree.getByRole('button', { name: 'Expand Fees' }).click();
  assert.equal(await tree.getByLabel('Access to Collect Fee', { exact: true }).inputValue(), 'READ', 'whole menu read only');
  await tree.getByLabel('Access to Dues & Reminders', { exact: true }).selectOption('FULL');
  await tree.getByLabel('Access to Collect Fee', { exact: true }).selectOption('NONE');
  assert.equal(await tree.getByLabel('Access to all of Fees', { exact: true }).inputValue(), 'MIXED');
  await tree.getByRole('button', { name: 'Collapse Fees' }).click();
  assert.equal(await tree.getByLabel('Access to Collect Fee', { exact: true }).count(), 0);
  await tree.getByRole('button', { name: 'Expand Exams' }).click();
  await tree.getByRole('button', { name: /^Expand Exams / }).first().click();
  await tree.getByLabel('Access to all of Papers', { exact: true }).selectOption('FULL');
  assert.equal(await tree.getByLabel('Access to Question Bank', { exact: true }).inputValue(), 'FULL', 'group level sets its sub-menus');
  await page.locator('nav.side button.item', { hasText: /^Transport team$/ }).click();
  await page.getByRole('region', { name: 'Viewing as another profile' }).waitFor();
  const items = await page.locator('nav.side button.item').allInnerTexts();
  assert.ok(items.includes('Dues & Reminders') && items.includes('Receipts') && !items.includes('Collect Fee'), items.join());
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Read only: the screen opens with a notice and nothing on it can be saved; full access saves', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  const { page, errors } = await open(ctx, '#/s/OPS_ROLES');
  await page.getByRole('tab', { name: 'Permissions by department' }).click();
  await page.getByRole('option', { name: /^Transport/ }).click();
  const tree = page.getByRole('tree', { name: 'Menus for Transport' });
  await tree.getByRole('button', { name: 'Expand Transport' }).click();
  await tree.getByLabel('Access to Routes, Stops & Timings', { exact: true }).selectOption('READ');
  await page.locator('nav.side button.item', { hasText: /^Transport team$/ }).click();
  const bar = page.getByRole('region', { name: 'Viewing as another profile' });
  await bar.getByLabel(/Act as this person/).check();
  await page.locator('nav.side button.item', { hasText: 'Routes, Stops & Timings' }).click();
  await page.locator('.ro-bar', { hasText: 'Read only — you can view this screen' }).waitFor();
  await page.getByRole('button', { name: 'Edit timings' }).first().click();
  await page.locator('.modal').getByRole('button', { name: 'Save' }).click();
  await page.locator('.toast', { hasText: 'Read only — you can view “Routes, Stops & Timings”' }).waitFor();
  await page.locator('.modal').getByRole('button', { name: 'Close' }).click();
  await page.locator('nav.side button.item', { hasText: 'Driver Route Sheets' }).click();
  await page.locator('.crumbs', { hasText: 'Driver Route Sheets' }).waitFor();
  assert.equal(await page.locator('.ro-bar').count(), 0, 'full-access screen has no notice');
  assert.deepEqual(errors.filter((e) => !/Read only/.test(e)), []);
  await ctx.close();
});

test('Access summary: each person with profile, department, designation and their screens by level', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  const { page, errors } = await open(ctx, '#/s/OPS_ROLES');
  await page.getByRole('tab', { name: 'Permissions by department' }).click();
  await page.getByRole('option', { name: /^Transport/ }).click();
  await page.getByRole('tree').getByLabel('Access to all of Fees', { exact: true }).selectOption('READ');
  await page.getByRole('tab', { name: 'Access summary' }).click();
  const row = page.locator('tr', { hasText: 'Manjunath Gowda' });
  const text = await row.innerText();
  assert.match(text, /Transport team[\s\S]*Transport[\s\S]*Transport In-charge/);
  assert.match(text, /\b7\b/, '7 read-only Fees screens (Fee Insights moved to Data Analytics in 15.1)');
  await page.getByRole('button', { name: 'Show access of Manjunath Gowda' }).click();
  const details = page.locator('tr', { hasText: 'Access comes from the department (Transport)' });
  assert.match(await details.innerText(), /Collect Fee\s*Read only/);
  assert.match(await details.innerText(), /Driver Route Sheets\s*Full/);
  await page.getByLabel('Department', { exact: true }).selectOption('Academics');
  const names = await page.locator('tbody tr td:first-child b').allInnerTexts();
  assert.ok(names.includes('Sonia Mehta') && !names.includes('Manjunath Gowda'), names.join());
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('User management: delete a profile after confirming (blocked while people have it); add a standard profile; restore', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  const { page, errors } = await open(ctx, '#/s/OPS_ROLES');
  await page.getByRole('button', { name: 'Delete profile Accountant' }).click();
  await page.locator('.toast', { hasText: 'move them to another profile' }).waitFor();
  await page.getByRole('button', { name: 'Add Hostel Staff' }).click();
  const row = page.locator('tr', { hasText: 'Hostel Staff' });
  assert.match(await row.innerText(), /Hostel & Boarding[\s\S]*Hostel Warden/);
  await page.getByRole('button', { name: 'Delete profile Hostel Staff' }).click();
  const dlg = page.getByRole('dialog', { name: 'Delete this profile?' });
  await dlg.getByRole('button', { name: 'Delete profile' }).click();
  assert.equal(await page.locator('tr', { hasText: 'Hostel Staff' }).count(), 0);
  await page.getByRole('button', { name: 'Add Hostel Staff' }).waitFor();
  await page.evaluate(() => { const k = 'school-app-demo-v9'; const d = JSON.parse(localStorage.getItem(k)); d.users = d.users.filter((u) => u.role !== 'ACCOUNTANT'); localStorage.setItem(k, JSON.stringify(d)); });
  await page.reload();
  await page.getByRole('button', { name: 'Delete profile Accountant' }).click();
  await page.getByRole('dialog', { name: 'Delete this profile?' }).getByRole('button', { name: 'Delete profile' }).click();
  await page.getByRole('button', { name: 'Restore Accountant' }).waitFor();
  await page.goto(server.url + '#/s/OPS_USERS'); await page.getByRole('button', { name: 'Add user' }).click();
  const roles = await page.locator('.modal').getByRole('combobox', { name: /^Role/ }).locator('option').allInnerTexts();
  assert.ok(!roles.includes('Accountant'), roles.join());
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Question paper: start, rebuild from the chosen topics, sets, approval, choose the set, print', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const { page, errors } = await open(ctx, '#/s/EXM_QP');
  await page.getByRole('heading', { name: 'Question papers' }).waitFor();
  await page.getByRole('button', { name: 'Start Class 9 Mathematics' }).click();
  await page.getByRole('heading', { name: 'Unit Test 2 — Mathematics' }).waitFor();
  await page.getByText('The paper matches its blueprint.').waitFor();
  assert.match(await page.locator('.stat', { hasText: 'Marks' }).innerText(), /25 \/ 25/);
  // the paper follows the topics: untick a chapter, every question then comes from the other chapters
  const tags = async () => (await page.locator('.slot .small.muted').allInnerTexts()).map((t) => Number((t.match(/ch\. (\d+)/) || [])[1])).filter(Boolean);
  const chs = [...new Set(await tags())];
  const drop = chs[0];
  const chip = page.getByRole('tree', { name: 'Chapters and topics' }).locator('button.chip', { hasText: new RegExp(`^${drop}\\. `) });
  await chip.click();
  await page.locator('.toast', { hasText: 'Paper rebuilt from the chosen topics' }).waitFor();
  assert.ok(!(await tags()).includes(drop), `chapter ${drop} gone after unticking it`);
  assert.equal(await page.getByRole('table', { name: 'Questions available for each section' }).locator('tbody tr').count(), 4);
  // undo brings the chapter back
  await page.getByRole('button', { name: 'Undo' }).click();
  await page.waitForFunction((d) => [...document.querySelectorAll('.slot .small.muted')].some((e) => e.textContent.includes('ch. ' + d + ' ')), drop);
  // sets
  await page.getByRole('button', { name: 'Add a set' }).click();
  await page.getByRole('tab', { name: /Set 2/ }).waitFor();
  assert.equal(await page.locator('.pill', { hasText: /Set \d · \d+% overlap/ }).count(), 2);
  // pick a question from the bank: it is locked so regenerating keeps it
  await page.getByRole('tab', { name: /^Set 1/ }).click();
  await page.getByRole('button', { name: 'Replace question 1 from the bank' }).click();
  const dlg = page.getByRole('dialog', { name: 'Add a question from the bank' });
  const first = dlg.getByRole('button', { name: /^Add / }).first();
  const chosen = (await first.getAttribute('aria-label')).slice(4);
  await first.click();
  await page.getByRole('button', { name: 'Regenerate' }).click();
  assert.ok((await page.locator('.slot').first().innerText()).includes(chosen), 'locked question kept');
  // approval and the set for the exam
  await page.getByRole('button', { name: 'Send for approval' }).click();
  await page.getByRole('dialog', { name: 'Send for approval?' }).getByRole('button', { name: 'Confirm' }).click();
  await page.getByText('Sent for approval — locked until it is approved or sent back.').waitFor();
  assert.ok(await page.getByRole('button', { name: 'Regenerate' }).isDisabled(), 'locked while waiting');
  await page.locator('main').getByRole('button', { name: 'Approve', exact: true }).click();
  await page.getByRole('dialog', { name: 'Approve this set?' }).getByRole('button', { name: 'Confirm' }).click();
  await page.getByRole('radiogroup', { name: 'Set for the exam' }).getByLabel(/Set 1/).check();
  await page.getByText('Set 1 is the set for the exam. The other sets are sealed.').waitFor();
  await page.getByRole('button', { name: 'Answer key' }).click();
  await page.getByRole('heading', { name: 'Answer key — Set 1' }).waitFor();
  await page.getByRole('button', { name: '← Back' }).click();
  await page.getByRole('button', { name: '← Question papers' }).click();
  assert.match(await page.locator('tr', { hasText: 'Class 9' }).filter({ hasText: 'Mathematics' }).innerText(), /Approved[\s\S]*1 \/ 2 approved · Set 1 chosen/);
  // Approved papers
  await page.locator('nav.side button.item', { hasText: 'Approved Papers' }).click();
  await page.getByRole('button', { name: 'Print set 1 of Class 9 Mathematics' }).click();
  await page.getByRole('heading', { name: 'Question paper — Set 1' }).waitFor();
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Question bank and Blueprints: chapters with topics, filters, add a question; edit a blueprint', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const { page, errors } = await open(ctx, '#/s/EXM_QB');
  await page.getByLabel('Class and subject').selectOption('9|Mathematics');
  await page.getByRole('button', { name: /^7\. Triangles/ }).click();
  await page.getByLabel('Difficulty filter').selectOption('TOUGH');
  const rows = await page.locator('tbody tr').allInnerTexts();
  assert.ok(rows.length > 0 && rows.every((r) => /^7\t/.test(r) && /Hard/.test(r)), 'filtered to chapter 7, hard');
  await page.getByRole('button', { name: 'Add a question' }).click();
  const m = page.getByRole('dialog', { name: 'Add a question' });
  await m.getByLabel('Question', { exact: true }).fill('Prove that the angles opposite equal sides of a triangle are equal.');
  await m.getByRole('button', { name: 'Save' }).click();
  await page.locator('.toast', { hasText: 'Question added' }).waitFor();
  await page.locator('nav.side button.item', { hasText: 'Blueprints' }).click();
  await page.getByRole('button', { name: 'Edit Unit Test 2 (classes 6–10)' }).click();
  const bp = page.getByRole('dialog', { name: /Edit Unit Test 2/ });
  await bp.getByText('Sections (25 marks)').waitFor();
  await bp.getByRole('button', { name: 'Add a section' }).click();
  await bp.getByText('Sections (31 marks)').waitFor();
  await bp.getByRole('button', { name: 'Close' }).click();
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Users: role and department filters, department column, student details for parents, N/A designation, created date, no Switched off, no screens column; Refresh picks up Roles & Permissions changes', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const { page, errors } = await open(ctx, '#/s/OPS_USERS');
  const users = page.getByRole('table', { name: 'Users' });
  const heads = (await users.locator('thead th').allInnerTexts()).map((x) => x.trim()).filter(Boolean);
  assert.deepEqual(heads, ['Name', 'Sign-in ID', 'Role', 'Department', 'Designation', 'Student (parents)', 'Created', 'Last sign-in', 'Status']);
  await page.getByLabel('Role filter').selectOption('PARENT');
  const rows = await users.locator('tbody tr').allInnerTexts();
  assert.ok(rows.length > 0 && rows.every((r) => /Parent/.test(r)), 'only parents');
  assert.match(rows.find((r) => r.includes('Rohit Sharma')), /N\/A[\s\S]*Aarav Sharma[\s\S]*Grade VIII[\s\S]*ADM-2025-0231[\s\S]*01 Apr 2026/);
  assert.ok(rows.every((r) => !/Pending/.test(r)), 'no parent waits for approval');
  assert.deepEqual((await page.getByLabel('Status filter').locator('option').allInnerTexts()), ['All statuses', 'Active', 'Locked'], 'no Switched off, nobody waiting for approval');
  await page.getByLabel('Role filter').selectOption('');
  await page.getByLabel('Department filter').selectOption('Transport');
  assert.ok((await users.locator('tbody tr').allInnerTexts()).every((r) => /Transport/.test(r)), 'only the Transport department');
  await page.getByLabel('Department filter').selectOption('');
  // Roles & Permissions changes in another tab; Refresh brings them in
  const other = await ctx.newPage();
  await other.goto(server.url + '#/s/OPS_ROLES');
  await other.getByRole('button', { name: 'Change department of Teacher' }).click();
  await other.getByLabel('Department for Teacher').fill('Teaching Staff');
  await other.getByRole('button', { name: 'Save', exact: true }).click();
  await other.locator('tr', { hasText: 'Teaching Staff' }).first().waitFor();
  await page.getByRole('button', { name: 'Refresh users' }).click();
  await page.locator('.toast').waitFor();
  await page.getByLabel('Department filter').selectOption('Teaching Staff');
  assert.ok((await users.locator('tbody tr').count()) > 0);
  assert.ok((await users.locator('tbody tr').allInnerTexts()).every((r) => /Teacher[\s\S]*Teaching Staff/.test(r)));
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Parent sign-up: admission no., student name and grade checked against the student record; a match opens the account with no approval', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const { page, errors } = await open(ctx, '#/p/mobile');
  await page.getByLabel('School code').fill('GVS'); await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByLabel('First name').fill('Neha'); await page.getByLabel('Last name').fill('Sharma'); await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel(/Gmail \/ email or mobile/).fill('neha.sharma@example.com'); await page.getByRole('button', { name: 'Send verification code' }).click();
  const code = await page.evaluate(() => JSON.parse(localStorage.getItem('school-app-demo-v9')).outbox.find((m) => m.to === 'neha.sharma@example.com')?.body.match(/\d{6}/)?.[0]);
  await page.getByLabel('Code').fill(code); await page.getByRole('button', { name: 'Verify' }).click();
  await page.getByLabel('Password', { exact: true }).fill('Strong@123'); await page.getByLabel('Confirm').fill('Strong@123'); await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel("Student's admission number").fill('ADM-2025-0231');
  await page.getByLabel("Student's name").fill('Aarav Sharma');
  await page.getByLabel("Student's grade").selectOption({ label: 'Grade VII' });
  await page.getByLabel(/I agree/).check();
  await page.getByRole('button', { name: 'Create account' }).click();
  assert.match(await page.getByRole('alert').innerText(), /don't match the school's records[\s\S]*4 tries left/);
  await page.getByLabel("Student's grade").selectOption({ label: 'Grade VIII' });
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByRole('heading', { name: 'Your account is ready' }).waitFor();
  const admin = await ctx.newPage();
  await admin.goto(server.url + '#/s/OPS_USERS');
  const row = admin.locator('tr', { hasText: 'neha.sharma@example.com' });
  const text = await row.innerText();
  assert.match(text, /Parent/); assert.match(text, /Aarav Sharma[\s\S]*Grade VIII[\s\S]*ADM-2025-0231/); assert.match(text, /ACTIVE|Active/i);
  assert.doesNotMatch(text, /Pending/);
  // and the parent can sign in straight away
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Email or mobile').fill('neha.sharma@example.com');
  await page.getByLabel('Password').fill('Strong@123');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.locator('.m-tabs .m-tab', { hasText: 'Requests' }).waitFor();
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Users: Delete is a status in Edit; the archive is view only; 25 per page; reset password only for Admin or a granted person', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1700, height: 1000 } });
  const { page, errors } = await open(ctx, '#/s/OPS_USERS');
  const users = page.getByRole('table', { name: 'Users' });
  await page.getByLabel('Role filter').selectOption('TRANSPORT');
  const name = (await users.locator('tbody tr').first().locator('td').first().innerText()).split('\n')[0].trim();
  await page.getByRole('button', { name: 'Edit ' + name }).click();
  const m = page.getByRole('dialog', { name: /^Edit user/ });
  assert.deepEqual(await m.getByLabel('Status').locator('option').allInnerTexts(), ['Active', 'Locked', 'Deleted (moves to Archived)']);
  await m.getByLabel('Status').selectOption('DELETED');
  await m.getByLabel('Reason for deleting').selectOption('Left the school');
  await m.getByRole('button', { name: 'Delete and archive' }).click();
  await page.getByRole('dialog', { name: `Delete ${name}?` }).getByRole('button', { name: 'Delete', exact: true }).click();
  await page.locator('.toast', { hasText: 'kept under Archived' }).waitFor();
  assert.equal(await users.locator('tr', { hasText: name }).count(), 0, 'gone from Users');
  await page.getByRole('tab', { name: /Archived \(1\)/ }).click();
  const arch = page.getByRole('table', { name: 'Archived users' });
  assert.deepEqual((await arch.locator('thead th').allInnerTexts()).map((x) => x.trim()), ['Name', 'Sign-in ID', 'Role', 'Department', 'Designation', 'Student (parents)', 'Email', 'Mobile', 'Created', 'Last sign-in', 'Deleted on', 'Reason', 'Deleted by']);
  assert.match(await arch.locator('tr', { hasText: name }).innerText(), /Transport team[\s\S]*Transport[\s\S]*Left the school/);
  assert.equal(await arch.getByRole('button').count(), 0, 'view only');
  assert.equal(await page.getByText(/Rejoin/).count(), 0, 'no rejoin');
  await page.getByLabel('Reason filter').selectOption('Duplicate account');
  assert.equal(await arch.locator('tbody tr').count(), 0, 'filtered out');
  // 25 a page
  await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('school-app-demo-v9'));
    for (let i = 1; i <= 40; i++) d.users.push({ id: 'T' + i, name: 'Test Teacher ' + String(i).padStart(2, '0'), login: `tt${i}@example.com`, loginType: 'EMAIL', email: `tt${i}@example.com`, mobile: '', role: 'TEACHER', designation: 'TGT', status: 'ACTIVE', createdAt: '2026-06-01T09:00:00Z', extra: [] });
    d.rev = (d.rev || 0) + 1; localStorage.setItem('school-app-demo-v9', JSON.stringify(d)); });
  await page.reload();
  await page.getByRole('tab', { name: 'Users', exact: true }).waitFor();
  assert.equal(await users.locator('tbody tr').count(), 25);
  const pager = page.getByRole('navigation', { name: 'Pages of users' });
  assert.match(await pager.innerText(), /Showing 1–25 of \d+ users/);
  await pager.getByRole('button', { name: 'Next ›' }).click();
  assert.match(await pager.innerText(), /Showing 26–/);
  await pager.getByRole('button', { name: 'Page 1' }).click();
  // Reset password: Admin sees it; the Vice Principal (Users screen by designation) doesn't until given the permission
  assert.ok(await page.getByRole('button', { name: 'Reset password' }).count() > 0, 'Admin can reset');
  const vp = await page.evaluate(() => JSON.parse(localStorage.getItem('school-app-demo-v9')).users.find((u) => u.designation === 'Vice Principal' && u.role === 'TEACHER'));
  await page.getByLabel('Search users').fill(vp.name);
  await page.getByRole('button', { name: 'Edit ' + vp.name }).click();
  await page.getByLabel(/Can reset passwords/).check();
  await page.getByRole('dialog', { name: /^Edit user/ }).getByRole('button', { name: 'Save' }).click();
  await page.evaluate((v) => { sessionStorage.setItem('school-app-demo-v9-s', JSON.stringify({ role: v.role, userId: v.id, name: v.name })); location.hash = '#/s/OPS_USERS'; location.reload(); }, vp);
  await users.waitFor();
  assert.ok(await page.getByRole('button', { name: 'Reset password' }).count() > 0, 'granted person can reset');
  await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('school-app-demo-v9')); d.users.forEach((u) => { u.perms = []; }); d.rev += 1; localStorage.setItem('school-app-demo-v9', JSON.stringify(d)); location.reload(); });
  await users.waitFor();
  assert.equal(await page.getByRole('button', { name: 'Reset password' }).count(), 0, 'not without the permission');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Users: someone coming back is added with details copied from the archive', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const { page, errors } = await open(ctx, '#/s/OPS_USERS');
  const users = page.getByRole('table', { name: 'Users' });
  await page.getByLabel('Role filter').selectOption('TRANSPORT');
  const name = (await users.locator('tbody tr').first().locator('td').first().innerText()).split('\n')[0].trim();
  const login = (await users.locator('tbody tr').first().locator('td').nth(1).innerText()).split('\n')[0].trim();
  await page.getByRole('button', { name: 'Edit ' + name }).click();
  const m = page.getByRole('dialog', { name: /^Edit user/ });
  await m.getByLabel('Status').selectOption('DELETED');
  await m.getByRole('button', { name: 'Delete and archive' }).click();
  await page.getByRole('dialog', { name: `Delete ${name}?` }).getByRole('button', { name: 'Delete', exact: true }).click();
  await page.locator('.toast', { hasText: 'kept under Archived' }).waitFor();
  // they come back
  await page.getByRole('button', { name: 'Add user' }).click();
  const add = page.getByRole('dialog', { name: 'Add user' });
  await add.getByLabel('Search the archive to copy').fill(name.split(' ')[0]);
  await add.getByRole('button', { name: 'Copy details of ' + name }).click();
  await add.getByText(`Details copied from ${name}'s archived account — everything still fits.`).waitFor();
  assert.equal(await add.getByLabel('Full name').inputValue(), name);
  assert.equal(await add.getByLabel(/Sign-in ID/).inputValue(), login);
  assert.equal(await add.getByRole('combobox', { name: /^Role/ }).inputValue(), 'TRANSPORT');
  await add.getByRole('button', { name: 'Create and email link' }).click();
  await page.locator('.toast', { hasText: 'set-password link was emailed' }).waitFor();
  assert.match(await users.locator('tr', { hasText: login }).innerText(), /Transport team[\s\S]*ACTIVE/i);
  // the archive stays as it was: view only, no rejoin status
  await page.getByRole('tab', { name: /Archived/ }).click();
  const arch = page.getByRole('table', { name: 'Archived users' });
  assert.ok(await arch.locator('tr', { hasText: name }).count() === 1);
  assert.equal(await arch.getByRole('button').count(), 0);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Users: accounts come from registration; only the Admin can add someone, with a reason; each account shows how it was created', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const { page, errors } = await open(ctx, '#/s/OPS_USERS');
  await page.getByText(/Parents and staff open their own accounts by registering/).waitFor();
  await page.getByRole('button', { name: 'Edit Rohit Sharma' }).click();
  await page.getByRole('dialog', { name: /^Edit user/ }).getByText(/How the account was created: Registered (on the website|in the app)/).waitFor();
  await page.getByRole('dialog', { name: /^Edit user/ }).getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Add user' }).click();
  const add = page.getByRole('dialog', { name: 'Add user' });
  await add.getByText(/Add someone here only as an exception/).waitFor();
  await add.getByLabel('Full name').fill('Lakshmi Amma');
  await add.getByRole('combobox', { name: /^Role/ }).selectOption('FRONT_OFFICE');
  await add.getByLabel(/Designation/).selectOption({ index: 1 });
  await add.getByLabel(/Sign-in ID/).fill('9876500077');
  await add.getByLabel(/Why is this person being added/).selectOption('Has no email or mobile of their own');
  await add.getByRole('button', { name: 'Create and email link' }).click();
  await page.locator('.toast', { hasText: 'Account created' }).waitFor();
  await page.getByRole('button', { name: 'Edit Lakshmi Amma' }).click();
  await page.getByRole('dialog', { name: /^Edit user/ }).getByText('How the account was created: Added by the Admin — Has no email or mobile of their own', { exact: false }).waitFor();
  // the Vice Principal can open Users (by designation) but can't add anyone
  const vp = await page.evaluate(() => JSON.parse(localStorage.getItem('school-app-demo-v9')).users.find((u) => u.designation === 'Vice Principal' && u.role === 'TEACHER'));
  await page.evaluate((v) => { sessionStorage.setItem('school-app-demo-v9-s', JSON.stringify({ role: v.role, userId: v.id, name: v.name })); location.hash = '#/s/OPS_USERS'; location.reload(); }, vp);
  await page.getByRole('table', { name: 'Users' }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Add user' }).count(), 0, 'no Add user for the Vice Principal');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Dashboard: students, staff, transport, fees and enrolment sections with arrows, gender split, grade limits and registrations by source', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const { page, errors } = await open(ctx, '#/s/DASH');
  const tabs = (await page.getByRole('tab').allInnerTexts()).map((x) => x.trim());
  assert.deepEqual(tabs, ['Students', 'Staff', 'Transport', 'Fees', 'Enrolment', 'Needs attention']);
  await page.getByRole('tab', { name: 'Students', exact: true }).click();
  const students = page.getByRole('region', { name: 'Students' });
  assert.match(await students.locator('.kpi').first().innerText(), /Total students\s+\d+\s+[▲▼▬][\s\S]*vs 2025-26/);
  await students.getByRole('table', { name: 'Students', exact: true }).waitFor();             // boys and girls, last year vs this year
  assert.ok(await students.locator('path.mark').count() >= 12, 'a column per class');
  await students.locator('path.mark').first().focus();
  await page.locator('.viz-tip').waitFor();
  await students.getByRole('button', { name: /Show as table — Students by class/ }).click();
  await students.getByRole('table', { name: 'Students by class (table)' }).waitFor();
  assert.ok(await students.getByRole('table', { name: 'Grade limits' }).getByText(/over|free/).count() > 0);
  // the Admin changes a grade limit and the indicator follows
  await students.getByRole('button', { name: 'Edit grade limits' }).click();
  await page.getByRole('dialog', { name: 'Grade limits' }).getByLabel('Grade I', { exact: true }).fill('1');
  await page.getByRole('dialog', { name: 'Grade limits' }).getByRole('button', { name: 'Save' }).click();
  assert.match(await students.getByRole('table', { name: 'Grade limits' }).locator('tr', { hasText: 'Grade I' }).first().innerText(), /▲ \d+ over/);
  for (const [tab, re] of [['Staff', /Total staff[\s\S]*vs 2025-26[\s\S]*Students per teacher/], ['Transport', /Students on school transport[\s\S]*Seats used/],
    ['Fees', /Fees collected[\s\S]*Collected of what is due so far/], ['Enrolment', /Accounts registered this year[\s\S]*Website[\s\S]*Mobile app[\s\S]*Added by the Admin/]]) {
    await page.getByRole('tab', { name: tab, exact: true }).click();
    assert.match(await page.locator('main .kpis').innerText(), re, tab);
  }
  await page.getByLabel('Registered from').selectOption('APP');
  const rows = await page.getByRole('table', { name: 'Registrations' }).locator('tbody tr').allInnerTexts();
  assert.ok(rows.length > 0 && rows.every((r) => /Mobile app/.test(r)));
  assert.deepEqual(errors, []);
  await ctx.close();
});
