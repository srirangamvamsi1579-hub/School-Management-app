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

const signIn = async (page, user, pw) => {
  await page.getByLabel('Username').fill(user);
  await page.getByLabel('Password', { exact: true }).fill(pw); await page.getByRole('button', { name: 'Sign in' }).click();
};

test('Login page: username and password only; Admin is the service provider with Service Provider and Clients', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1350, height: 950 } });
  const page = await ctx.newPage(); page.setDefaultTimeout(8000); const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(server.url);
  const form = page.getByRole('form', { name: 'Login' });
  await form.waitFor();
  assert.equal(await form.locator('input').count(), 2, 'username and password only');
  assert.equal(await page.getByRole('tab', { name: 'Demo quick access' }).count(), 0);
  assert.equal(await page.getByLabel('School registration no.').count(), 0);
  await signIn(page, 'Admin', 'Admin1234');
  assert.equal(await page.getByRole('alert').innerText(), 'Wrong username or password');
  await signIn(page, 'Admin', 'Admin1234!');
  await page.getByRole('heading', { name: 'Main menu' }).waitFor();
  const nav = await page.locator('nav.side').innerText();
  assert.match(nav, /Service Provider/i); assert.match(nav, /Clients/i);
  await page.goto(server.url + '#/s/CLI_ALL');
  await page.getByRole('heading', { name: 'All clients & links' }).waitFor();
  const all = await page.locator('main').innerText();
  assert.match(all, /Platform requirements — every function/); assert.match(all, /101[\s\S]*Vijayanikethan High School/); assert.match(all, /Little Steps School/);
  assert.doesNotMatch(all, /Client101|Admin1234/);
  await page.getByRole('row', { name: /Vijayanikethan/ }).getByRole('button', { name: 'View' }).click();
  await page.getByRole('heading', { name: 'Vijayanikethan High School' }).waitFor();
  assert.match(await page.locator('iframe').getAttribute('srcdoc'), /Welcome to Vijayanikethan High School/);
  await page.getByRole('tab', { name: 'Their app' }).click();
  assert.match(await page.getByLabel('Vijayanikethan High School app preview').innerText(), /Main menu[\s\S]*Students/);
  // share the links by email — links only
  await page.getByRole('tab', { name: 'Share by email' }).click();
  await page.getByLabel('Email addresses').fill('principal@vijayanikethan.example.com, wrong-address');
  await page.getByRole('button', { name: 'Send links' }).click();
  assert.match(await page.getByRole('alert').innerText(), /wrong-address/);
  await page.getByLabel('Email addresses').fill('principal@vijayanikethan.example.com, office@example.com');
  await page.getByRole('checkbox', { name: 'Phone app' }).uncheck();
  await page.getByRole('button', { name: 'Send links' }).click();
  await page.getByText('Links sent to principal@vijayanikethan.example.com, office@example.com').waitFor();
  assert.match(await page.getByRole('main').innerText(), /Shared before[\s\S]*office@example\.com/);
  await page.goto(server.url + '#/s/OPS_OUTBOX');
  await page.getByText(/Vijayanikethan High School: links/).first().waitFor();
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('a client signs in as Client<no>: its own school, no provider menus; the platform requirements page', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1350, height: 950 } });
  const page = await ctx.newPage(); page.setDefaultTimeout(8000);
  await page.goto(server.url + '#/login');
  await signIn(page, 'Client201', 'Client201');
  assert.equal(await page.getByRole('alert').innerText(), 'Wrong username or password');
  await signIn(page, 'Client201', 'Client201!');
  await page.getByRole('heading', { name: 'Main menu' }).waitFor();
  assert.match(await page.locator('body').innerText(), /Sunrise Public School/);
  assert.doesNotMatch(await page.locator('nav.side').innerText(), /Service Provider|Clients/i);
  await page.goto(server.url + '#/p/platform');
  await page.getByRole('heading', { name: 'Platform requirements — every function' }).waitFor();
  assert.ok((await page.locator('table').count()) > 15);
  await ctx.close();
});
