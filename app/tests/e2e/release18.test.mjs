// Release 18 in the browser: the provider app's Add-ons and Roles & Permissions (provider) for a client school,
// Apply, basic items unchecked or marked as add-ons, and the client's own app picking up what was applied.
//   npm run build && CHROME_PATH=/usr/bin/google-chrome node --test tests/e2e/release18.test.mjs
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

test('provider app: pick Vijayanikethan, unselect an add-on and a basic item, mark a basic item as add-on, Apply', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1350, height: 950 } });
  const page = await ctx.newPage(); page.setDefaultTimeout(8000); const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(server.url);
  await page.getByLabel('Username').fill('Admin'); await page.getByLabel('Password', { exact: true }).fill('Admin1234!');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('heading', { name: 'Main menu' }).waitFor();
  await page.goto(server.url + '#/s/SP_ADDONS');
  await page.getByRole('heading', { name: 'Add-ons', exact: true }).waitFor();
  const pick = page.getByLabel('School to set up');
  const opt = await pick.locator('option', { hasText: 'Vijayanikethan' }).getAttribute('value');
  await pick.selectOption(opt);
  await page.getByRole('checkbox', { name: 'Transport routes and route map', exact: true }).uncheck();
  await page.getByRole('checkbox', { name: /^Basic: Fee structures/ }).uncheck();
  assert.match(await page.locator('main').innerText(), /Changes not applied yet/);
  await page.getByRole('button', { name: 'Mark Admissions: enquiry to enrolment as add-on' }).click();
  await page.getByRole('button', { name: 'Apply (v1.1)' }).first().click();
  await page.getByText('Version 1.1 is applied').waitFor();
  const main = await page.locator('main').innerText();
  assert.match(main, /Everything is applied/); assert.match(main, /Marked as add-on/);
  // Roles & Permissions (provider): the same school, single items, Basic again
  await page.goto(server.url + '#/s/SP_FEATURES');
  await page.getByRole('heading', { name: 'Roles & Permissions (provider)' }).waitFor();
  assert.equal(await page.getByLabel('School to set up').inputValue(), opt);
  await page.getByRole('button', { name: 'Search menus' }).count();
  await page.getByLabel('Search menus').fill('Documents');
  await page.getByRole('button', { name: /^Make .* basic again$/ }).first().click();
  assert.match(await page.locator('main').innerText(), /not applied yet/);
  await page.getByRole('button', { name: 'Apply (v1.2)' }).first().click();
  await page.getByText('Version 1.2 is applied').waitFor();
  // the client app on the same address picks it up
  const applied = await page.evaluate(() => JSON.parse(localStorage.getItem('school-app-applied-vijayanikethan')));
  assert.equal(applied.version, '1.2'); assert.ok(!applied.addons.includes('TRANSPORT'));
  await page.goto(server.url + '#/s/CLI_VHS');
  assert.match(await page.locator('main').innerText(), /version 1\.2/);
  assert.deepEqual(errors, []);
  await ctx.close();
});
