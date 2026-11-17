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

async function open(ctx, hash = '') {
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
    const items = await page.locator('nav.side button.item').allInnerTexts();
    for (const it of items) { await page.locator('nav.side button.item', { hasText: it }).first().click(); await page.waitForTimeout(30); }
    assert.deepEqual(errors, [], r + ': ' + errors.join('; '));
    assert.ok(items.length > 0, r);
    await ctx.close();
  }
});

test('website deep link: parent lands on Requests after sign-in; a staff link is refused for a parent', async () => {
  const ctx = await browser.newContext();
  const { page } = await open(ctx, '#/s/SELF_REQUESTS');
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
  await page.goto(server.url + '#/');
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
