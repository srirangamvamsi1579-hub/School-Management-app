// Release 17 in the browser: the School login (registration no., username, password), the provider's Clients menu with each
// client's webpage and app, the provider's links against each client's, and a school's first sign-in.
//   npm run build && CHROME_PATH=/usr/bin/google-chrome node --test tests/e2e/release17.test.mjs
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

const signIn = async (page, reg, user, pw) => {
  await page.getByLabel('School registration no.').fill(reg); await page.getByLabel('Username').fill(user);
  await page.getByLabel('Password', { exact: true }).fill(pw); await page.getByRole('button', { name: 'Sign in' }).click();
};

test('School login: the provider (100) gets Service Provider and Clients; each client shows its webpage, app and links', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1350, height: 950 } });
  const page = await ctx.newPage(); page.setDefaultTimeout(8000); const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(server.url);
  await page.getByRole('form', { name: 'School login' }).waitFor();
  await signIn(page, '100', 'admin', 'not-the-password');
  assert.match(await page.getByRole('alert').innerText(), /Wrong username or password/);
  await signIn(page, '999', 'admin', 'x');
  assert.match(await page.getByRole('alert').innerText(), /No school with that registration number/);
  await signIn(page, '100', 'admin', 'admin1234');
  await page.getByRole('heading', { name: 'Main menu' }).waitFor();
  const nav = await page.locator('nav.side').innerText();
  assert.match(nav, /Service Provider/i); assert.match(nav, /Clients/i);
  await page.goto(server.url + '#/s/CLI_ALL');
  await page.getByRole('heading', { name: 'All clients & links' }).waitFor();
  const all = await page.locator('main').innerText();
  assert.match(all, /Service provider links \(registration no\. 100\)[\s\S]*Platform requirements — every function/);
  assert.match(all, /101[\s\S]*Vijayanikethan High School/);
  await page.getByRole('row', { name: /Vijayanikethan/ }).getByRole('button', { name: 'View' }).click();
  await page.getByRole('heading', { name: 'Vijayanikethan High School' }).waitFor();
  assert.match(await page.locator('iframe').getAttribute('srcdoc'), /Welcome to Vijayanikethan High School/);
  await page.getByRole('tab', { name: 'Their app' }).click();
  assert.match(await page.getByLabel('Vijayanikethan High School app preview').innerText(), /Main menu[\s\S]*Students/);
  await page.getByRole('tab', { name: 'Links' }).click();
  assert.match(await page.locator('main').innerText(), /vijayanikethan\/#\/p\/requirements[\s\S]*vijayanikethancbse\.com/);
  // a converted client from Client Delivery is listed too (Little Steps School, demo data)
  assert.match(all, /Little Steps School/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('a school signs in with its own number: first sign-in sets the Admin password; no provider menus', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1350, height: 950 } });
  const page = await ctx.newPage(); page.setDefaultTimeout(8000);
  await page.goto(server.url + '#/login');
  await signIn(page, '201', 'admin', '');
  await page.getByRole('form', { name: 'Set the Admin password' }).waitFor();
  await page.getByLabel('New password').fill('short'); await page.getByLabel('Confirm password').fill('short');
  await page.getByRole('button', { name: 'Save and sign in' }).click();
  assert.match(await page.getByRole('alert').innerText(), /Password needs/);
  await page.getByLabel('New password').fill('Sunrise#2026x'); await page.getByLabel('Confirm password').fill('Sunrise#2026x');
  await page.getByRole('button', { name: 'Save and sign in' }).click();
  await page.getByRole('heading', { name: 'Main menu' }).waitFor();
  const nav = await page.locator('nav.side').innerText();
  assert.match(await page.locator('body').innerText(), /Sunrise Public School/);
  assert.doesNotMatch(nav, /Service Provider|Clients/i);
  // the password now works, and only it
  await page.getByRole('button', { name: 'Switch user' }).click();
  await signIn(page, '201', 'admin', 'wrong');
  assert.match(await page.getByRole('alert').innerText(), /Wrong username or password/);
  await signIn(page, '201', 'admin', 'Sunrise#2026x');
  await page.getByRole('heading', { name: 'Main menu' }).waitFor();
  await page.goto(server.url + '#/p/platform');
  await page.getByRole('heading', { name: 'Platform requirements — every function' }).waitFor();
  assert.ok((await page.locator('table').count()) > 15);
  await ctx.close();
});
