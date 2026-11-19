// Release 13 in the browser: Campus Services (library, hostel, homework to a parent, online classes, store, events)
// and the Service Provider menus (price list, proposal → demo school → present → end demo, competitors, roadmap).
//   npm run build && CHROME_PATH=/usr/bin/google-chrome node --test tests/e2e/release13.test.mjs
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

test('sales: proposal priced from tiers → demo school → present as Principal → end demo', async () => {
  const { ctx, page, errors } = await start();
  await as(page, 'Sales & marketing');
  const nav = await page.locator('nav.side').innerText();
  assert.match(nav, /Service Provider/i); assert.doesNotMatch(nav, /Students|Fees/i);
  await go(page, 'SP_PROPOSAL');
  await page.getByRole('button', { name: 'New proposal' }).click();
  await page.getByLabel('School name').fill('Hillview School');
  await page.getByLabel('Students').fill('650');
  await page.getByRole('button', { name: /Use Professional/ }).click();
  await page.getByLabel('Messaging').selectOption('SMS');
  await page.getByLabel('Transport').selectOption('PLUS');
  await page.getByLabel('Buses').fill('8');
  await page.getByRole('switch', { name: /Data Analytics/ }).click();
  const price = page.locator('.card', { has: page.getByRole('heading', { name: 'Price', exact: true }) });
  await price.getByText('₹5,850').waitFor();
  assert.match(await price.innerText(), /Monthly total\s*₹11,125/);   // 5,850 plan + 975 SMS + 2,800 for 8 buses + 1,500 analytics minimum; question bank included
  await page.getByRole('button', { name: 'Save and build demo' }).click();
  await page.getByRole('heading', { name: 'Demo builder' }).waitFor();
  assert.match(await page.getByLabel('Start from').locator('option:checked').innerText(), /Hillview School/);
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Create demo school' }).click();
  await page.getByText('Demo script').waitFor();
  await page.getByRole('button', { name: 'Open as Principal' }).click();
  await page.getByText(/Sales demo for/).waitFor();
  assert.match(await page.locator('nav.side .school').innerText(), /Hillview School \(demo\)[\s\S]*Professional plan/);
  await go(page, 'TRN_ROUTES');
  await page.getByRole('tab', { name: 'Plan the route' }).waitFor();
  await page.getByRole('button', { name: 'End demo' }).click();
  await page.getByRole('heading', { name: 'Demo builder' }).waitFor();
  assert.match(await page.locator('nav.side .school').innerText(), /Green Valley/);
  await go(page, 'SP_COMPARE');
  await page.getByRole('heading', { name: 'Competition comparison' }).waitFor();
  await page.getByLabel('Providers').selectOption('ALL');
  const t = await page.locator('table.compare').innerText();
  assert.match(t, /Arbor MIS[\s\S]*United Kingdom/); assert.match(t, /Route planning/);
  await page.getByText('Our edge').waitFor();
  await go(page, 'SP_MARKET');
  await page.getByRole('tab', { name: /Future enhancements/ }).click();
  await page.getByLabel('Status of Live bus GPS tracking for parents').selectOption('Planned');
  await page.getByText('Roadmap updated').waitFor();
  await go(page, 'SP_RATES');
  await page.getByText('Only the platform team and the Admin can change prices').waitFor();
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('the Admin has Service Provider and can add a Sales & marketing user; other school users never see it', async () => {
  const { ctx, page, errors } = await start();
  await as(page, 'Admin');
  assert.match(await page.locator('nav.side').innerText(), /Service Provider/i);
  await go(page, 'SP_RATES');
  await page.getByRole('heading', { name: 'Price list & tiers' }).waitFor();
  await page.getByLabel('Growth per student').fill('11');
  await page.getByRole('button', { name: 'Save price list' }).click();
  await page.getByText(/Price list saved/).waitFor();
  await go(page, 'SP_PROPOSAL');
  await page.getByRole('button', { name: 'New proposal' }).click();
  await page.locator('.card', { has: page.getByRole('heading', { name: 'Price', exact: true }) }).getByText('₹4,400').first().waitFor();   // 400 × ₹11
  await go(page, 'OPS_USERS');
  await page.getByRole('button', { name: 'Add user' }).click();
  const role = page.locator('.modal').getByRole('combobox', { name: /^Role/ });
  const roles = await role.locator('option').allInnerTexts();
  assert.ok(roles.includes('Sales & marketing') && !roles.includes('Platform team'), roles.join());
  await role.selectOption('SALES');
  const des = await page.locator('.modal').getByRole('combobox', { name: /Designation/ }).locator('option').allInnerTexts();
  assert.ok(des.includes('Marketing Manager') && des.includes('Sales Executive'), des.join());
  await page.locator('.modal').getByRole('button', { name: 'Close' }).click();
  await as(page, 'Principal');
  assert.doesNotMatch(await page.locator('nav.side').innerText(), /Service Provider/i);
  await go(page, 'SP_RATES');
  assert.equal(await page.getByRole('heading', { name: 'Price list & tiers' }).count(), 0);
  await as(page, 'Platform team');
  await go(page, 'PLT_SCHOOLS');
  await page.getByRole('button', { name: /Sunrise Public School/ }).click();
  assert.doesNotMatch(await page.locator('.card').first().innerText() + await page.locator('.card').nth(1).innerText(), /Service Provider/);
  assert.deepEqual(errors, []);
  await ctx.close();
});
