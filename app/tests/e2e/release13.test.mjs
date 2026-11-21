// Release 13 in the browser: Campus Services (library, hostel, homework to a parent, online classes, store, events)
// and the Service Provider menus (price list, proposal → demo school → present → end demo, competitors, roadmap).
//   npm run build && CHROME_PATH=/usr/bin/google-chrome node --test tests/e2e/release13.test.mjs
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

async function start() {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
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
const go = async (page, code) => { await page.goto(server.url + '#/s/' + code); await page.waitForTimeout(150); };
// Search by admission number so the right Aarav is picked (there are three)
const pickStudent = async (page, scope, q) => { await scope.getByLabel('Student search').fill(q); await scope.locator('button', { hasText: ' · ' }).first().click(); };

test('library: issue a book, return it, catalogue; front office', async () => {
  const { ctx, page, errors } = await start();
  await as(page, 'Front Office');
  await go(page, 'CMP_LIBRARY');
  await page.getByRole('heading', { name: 'Library' }).waitFor();
  const before = await page.locator('.stat', { hasText: 'On loan' }).locator('.v').innerText();
  await pickStudent(page, page, 'ADM-2025-0231');
  await page.getByLabel('Book', { exact: true }).selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Issue', exact: true }).click();
  await page.getByText(/Issued — due back/).waitFor();
  assert.equal(+(await page.locator('.stat', { hasText: 'On loan' }).locator('.v').innerText()), +before + 1);
  await page.getByRole('button', { name: 'Return' }).first().click();
  await page.getByText(/Returned/).first().waitFor();
  await page.getByRole('tab', { name: 'Catalogue' }).click();
  await page.getByRole('button', { name: 'Add book' }).click();
  const dlg = page.getByRole('dialog', { name: 'Add a book' });
  await dlg.getByLabel('Title').fill('The Test Book'); await dlg.getByRole('button', { name: 'Save' }).click();
  await page.getByRole('cell', { name: 'The Test Book' }).waitFor();
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('homework reaches the parent; online class scheduled; events sent', async () => {
  const { ctx, page, errors } = await start();
  await as(page, 'Teacher');
  await go(page, 'CMP_HOMEWORK');
  await page.getByRole('button', { name: 'Set homework' }).click();
  const dlg = page.getByRole('dialog', { name: 'Set homework' });
  await dlg.getByRole('combobox').first().selectOption('C8A');   // Aarav's class, 8-A
  await dlg.getByLabel('What to do').fill('Chapter 5 map work');
  await dlg.getByRole('button', { name: 'Save' }).click();
  await page.getByRole('cell', { name: 'Chapter 5 map work' }).waitFor();
  await page.getByRole('row', { name: /Chapter 5 map work/ }).getByRole('button', { name: 'Mark' }).click();
  await page.getByRole('dialog').getByRole('button', { name: /^Done: Aarav/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
  await go(page, 'CMP_CLASSES');
  await page.getByRole('button', { name: 'Schedule a class' }).click();
  const oc = page.getByRole('dialog', { name: 'Schedule an online class' });
  await oc.getByLabel('Meeting link').fill('http://bad.example.com');
  await oc.getByRole('button', { name: 'Save' }).click();
  await page.getByText(/must start with https/).waitFor();
  await oc.getByLabel('Meeting link').fill('https://meet.example.com/test-class');
  await oc.getByLabel('Date').fill(new Date(Date.now() + 864e5).toISOString().slice(0, 10));   // a time that hasn't passed, whatever the clock
  await oc.getByLabel('Time').fill('19:15');
  await oc.getByRole('button', { name: 'Save' }).click();
  await page.getByText('Class scheduled').waitFor();
  await as(page, 'Parent');
  await go(page, 'CMP_HOMEWORK');
  await page.getByText('Chapter 5 map work').waitFor();
  await page.getByText('Done', { exact: true }).first().waitFor();
  await go(page, 'CMP_EVENTS');
  await page.getByText('Parent–teacher meeting, Term 1').waitFor();
  assert.equal(await page.getByText('Staff training: first aid').count(), 0, 'staff-only event hidden from parents');
  assert.equal(await page.getByRole('button', { name: 'Add event' }).count(), 0);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('hostel and store: right block, stock limits', async () => {
  const { ctx, page, errors } = await start();
  await as(page, 'Admin');
  await go(page, 'CMP_HOSTEL');
  await page.getByRole('heading', { name: 'Hostel' }).waitFor();
  await page.getByRole('button', { name: 'Give a bed' }).click();
  const dlg = page.getByRole('dialog', { name: 'Give a bed' });
  await pickStudent(page, dlg, 'ADM-2025-0231');
  const opts = await dlg.getByLabel('Room').locator('option').allInnerTexts();
  assert.ok(opts.slice(1).every((o) => /Tagore House/.test(o)), 'a boy is offered the boys block only');
  await dlg.getByLabel('Room').selectOption({ index: 1 });
  await dlg.getByRole('button', { name: 'Save' }).click();
  await page.getByText('Bed given').waitFor();
  await go(page, 'CMP_INVENTORY');
  await page.getByRole('button', { name: 'Sell to a student' }).click();
  const sell = page.getByRole('dialog', { name: 'Sell to a student' });
  await pickStudent(page, sell, 'ADM-2025-0231');
  await sell.getByLabel('Item').selectOption(await sell.getByLabel('Item').locator('option', { hasText: 'School belt' }).getAttribute('value'));
  await sell.getByLabel('Quantity').fill('500');
  await sell.getByRole('button', { name: 'Save' }).click();
  await page.getByText(/^Only \d+ piece of School belt in stock/).waitFor();
  await sell.getByLabel('Quantity').fill('1');
  await sell.getByRole('button', { name: 'Save' }).click();
  await page.getByText('Sold — collect ₹150').waitFor();
  assert.deepEqual(errors, []);
  await ctx.close();
});

// The sales and Admin price-list tests moved to release14.test.mjs (Starter / Pro / Pro+, PDF, email, linked demo).

