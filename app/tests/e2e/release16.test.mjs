// Release 16 in the browser: Convert to client → “<School> – UAT/DEMO” with Project Links, website, app and requirements
// opened by the client; client approval and signing → “<School> – Live (date)”; the school's branch.
//   npm run build && CHROME_PATH=/usr/bin/google-chrome node --test tests/e2e/release16.test.mjs
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
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, acceptDownloads: true });
  const page = await ctx.newPage(); page.setDefaultTimeout(8000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(server.url + '#/login?demo');
  return { ctx, page, errors };
}
async function as(page, label) {
  await page.getByRole('tab', { name: 'Demo quick access' }).click();
  await page.locator('.rolegrid button', { hasText: label }).first().click();
  await page.locator('nav.side, .topmenu').first().waitFor();
}
const local = (url) => server.url + url.slice(url.indexOf('#'));

test('convert → UAT/DEMO school with Project Links; the client opens website, app and requirements; sign-off builds the live school', async () => {
  const { ctx, page, errors } = await start();
  await as(page, 'Sales & marketing');
  await page.goto(server.url + '#/s/SP_DELIVERY');
  const pick = page.getByLabel('Proposal to convert');
  await pick.selectOption(await pick.locator('option', { hasText: 'PROP-2026-001' }).getAttribute('value'));
  await page.getByRole('button', { name: 'Convert to client' }).click();
  await page.getByRole('heading', { name: /Sample Public School \(example\) · CP-/ }).waitFor();
  assert.match(await page.locator('main').first().innerText(), /UAT\/demo school: Sample Public School – UAT\/DEMO/);
  const href = async (name) => page.getByRole('row', { name }).getByRole('link').getAttribute('href');
  const build = await href(/Customer test build/), site = await href(/UAT website/), app = await href(/UAT phone app/), req = await href(/Requirements document/);
  assert.match(site, /\?to=site$/); assert.match(app, /\?to=app$/); assert.match(req, /\?to=req$/);

  // The client, in their own browser
  const cust = await browser.newContext({ viewport: { width: 1300, height: 900 } });
  const c = await cust.newPage(); const cerr = []; c.on('pageerror', (e) => cerr.push(e.message));
  await c.goto(local(req));
  await c.getByRole('heading', { name: /Requirements — Sample Public School/ }).waitFor();
  assert.match(await c.locator('body').innerText(), /Basic features[\s\S]*Add-ons agreed[\s\S]*Menus in this school/);
  await c.goto('about:blank'); await c.goto(local(site));
  assert.match(await c.locator('iframe').getAttribute('srcdoc'), /Welcome to Sample Public School – UAT\/DEMO/);
  await c.goto('about:blank'); await c.goto(local(build));
  await c.locator('nav.side').waitFor();
  assert.match(await c.locator('nav.side').innerText(), /UAT\/DEMO[\s\S]*Project/i);
  await c.goto('about:blank'); await c.goto(server.url + '#/s/PRJ_LINKS');
  await c.getByRole('heading', { name: 'Project Links' }).waitFor();
  for (const n of ['Test build', 'Website', 'Phone app', 'Requirements document']) assert.ok(await c.getByRole('row', { name: new RegExp('^' + n) }).getByRole('link').count(), n);
  assert.match(await c.getByRole('row', { name: /School branch/ }).innerText(), /school\//);
  await cust.close();

  // Client approval and signing → the live school
  await page.getByRole('button', { name: 'Record client sign-off' }).click();
  const dlg = page.getByRole('dialog', { name: 'Client approval and signing' });
  await dlg.getByLabel('Signed by').fill('Principal, Sample Public School');
  await dlg.getByLabel('Agreement reference').fill('SO-2026-01');
  await dlg.getByRole('button', { name: 'Sign off and build the live school' }).click();
  await page.getByText('Signed off: live school built').waitFor();
  assert.match(await page.locator('main').first().innerText(), /Live school: Sample Public School – Live \(/);
  assert.equal(await page.getByRole('button', { name: 'Record client sign-off' }).count(), 0);
  await page.getByRole('tab', { name: 'Release & branch' }).click();
  assert.match(await page.locator('main').first().innerText(), /school\/samplepublicschool[\s\S]*samplepublicschool-v1\.0[\s\S]*Principal, Sample Public School/);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download school.json' }).click()]);
  assert.equal(dl.suggestedFilename(), 'school.json');
  await page.getByLabel('Project status').selectOption('Live');
  await page.getByText('Status: Live').first().waitFor();
  assert.deepEqual([...errors, ...cerr], []);
  await ctx.close();
});
