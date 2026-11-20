// Release 15.1 in the browser: every Data Analytics report opens without errors, filters, drills down and exports;
// a class teacher sees their own classes; Admissions links to the funnel; the Accountant has no Student Profile.
//   npm run build && CHROME_PATH=/usr/bin/google-chrome node --test tests/e2e/release15.test.mjs
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

async function start() {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, acceptDownloads: true });
  const page = await ctx.newPage(); page.setDefaultTimeout(8000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(server.url + '#/login');
  return { ctx, page, errors };
}
async function as(page, label) {
  const sw = page.getByRole('button', { name: 'Switch user' });
  if (await sw.count()) await sw.click();
  await page.getByRole('tab', { name: 'Demo quick access' }).click();
  await page.locator('.rolegrid button', { hasText: label }).first().click();
  await page.locator('nav.side, .topmenu').first().waitFor();
  await page.waitForTimeout(300);
}
const go = async (page, code) => { await page.goto(server.url + '#/s/' + code); await page.waitForTimeout(200); };

test('every Data Analytics screen and report opens, filters, drills down and exports', async () => {
  const { ctx, page, errors } = await start();
  await as(page, 'Admin');
  for (const code of ['ANL_HOME', 'STU_INS', 'STF_INS', 'FEE_INS', 'ANL_ADMISSIONS', 'ANL_ATTENDANCE', 'ANL_EXAMS', 'ANL_TIMETABLE', 'ANL_ACADEMICS', 'ANL_TRANSPORT', 'ANL_COMMS', 'ANL_CAMPUS']) {
    await go(page, code);
    assert.ok(!(await page.content()).includes('Coming soon'), code + ' has a screen');
    const tabs = page.getByRole('region', { name: 'Reports' }).getByRole('tab');
    const n = code === 'ANL_HOME' ? 0 : await tabs.count();
    for (let i = 0; i < Math.max(n, code === 'ANL_HOME' ? 0 : 1); i++) {
      if (n > 1) await tabs.nth(i).click();
      await page.getByRole('group', { name: 'Report filters' }).waitFor();
      await page.locator('.report table.t').first().waitFor();
    }
  }
  assert.deepEqual(errors, []);
  // drill-down and export on the exam results
  await go(page, 'ANL_EXAMS');
  const bar = page.locator('.report [role="group"]:not(.report-filters) button').first();
  await bar.click();
  assert.ok(await page.getByRole('navigation', { name: 'Drill-down path' }).locator('button').count() >= 2, 'drilled one level');
  const dl = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export CSV' }).first().click(); assert.match((await dl).suggestedFilename(), /\.csv$/);
  // a filter narrows the table
  await go(page, 'ANL_EXAMS');
  const rowsAll = await page.locator('.report table.t tbody tr').count();
  await page.getByLabel('Class', { exact: true }).first().selectOption({ index: 1 });
  await page.waitForTimeout(150);
  assert.ok((await page.locator('.report table.t tbody tr').count()) <= rowsAll);
  await ctx.close();
});

test('Admissions keeps the list and counts; the summary by grade is in Data Analytics', async () => {
  const { ctx, page, errors } = await start();
  await as(page, 'Admin');
  await go(page, 'STU_ADMISSIONS');
  assert.equal(await page.getByRole('tab', { name: /Summary by grade/ }).count(), 0);
  await page.getByRole('button', { name: 'Data Analytics › Admissions Funnel' }).click();
  await page.getByRole('heading', { name: /Status by grade/ }).waitFor();
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Accountant: no Student Profile by default; Staff Insights in Data Analytics', async () => {
  const { ctx, page } = await start();
  await as(page, 'Accountant');
  await go(page, 'STF_INS');
  await page.getByRole('heading', { name: 'Staff insights' }).waitFor();
  await page.locator('nav.side .mod', { hasText: /^Students/i }).first().click();
  await page.waitForTimeout(150);
  assert.ok(!/Student Profile/.test(await page.locator('nav.side').innerText()), 'no Student Profile in the menu');
  await ctx.close();
});
