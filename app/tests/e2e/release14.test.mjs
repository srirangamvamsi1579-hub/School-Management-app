// Release 14 in the browser: Pricing (Starter / Pro / Pro+), a proposal with margin, discount, PDF and email,
// the Demo Builder changing the linked proposal and its demo school, the Admin editing prices, and the new add-ons
// in a school (backups, WhatsApp, board integration, curriculum, portfolios, timings).
//   npm run build && CHROME_PATH=/usr/bin/google-chrome node --test tests/e2e/release14.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
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
const go = async (page, code) => { await page.goto(server.url + '#/s/' + code); await page.waitForTimeout(150); };
const card = (page, title) => page.locator('.card', { has: page.getByRole('heading', { name: title, exact: true }) });

test('sales: pricing → Choose Pro → proposal with margin and discount → PDF → email → linked demo', async () => {
  const { ctx, page, errors } = await start();
  await as(page, 'Sales & marketing');
  await go(page, 'SP_RATES');
  await page.getByRole('heading', { name: 'Pricing' }).waitFor();
  assert.equal(await page.getByText(/launch prices/i).count(), 0, 'no confusing reset label');
  await page.getByRole('button', { name: 'Back to Home' }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Edit prices' }).count(), 0, 'sales can view, not edit');
  const tiers = await page.locator('.tier h3').allInnerTexts();
  assert.deepEqual(tiers, ['Starter', 'Pro', 'Pro+']);
  await page.getByRole('button', { name: 'Choose Pro', exact: true }).click();

  // Proposal editor opens with Pro
  await page.getByRole('button', { name: 'Pro selected' }).waitFor();
  await page.getByLabel('School name').fill('Hillview School');
  await page.getByLabel('Students', { exact: true }).fill('650');
  await page.getByLabel('Point of contact').fill('Mrs. Asha Rao');
  await page.getByLabel('Contact email').fill('principal@hillview.example.com');
  await page.getByLabel('Contact number').fill('+91 90000 44444');
  await page.getByRole('switch', { name: 'Transport routes and route map' }).click();
  await page.getByLabel('Buses').fill('8');
  await page.getByRole('switch', { name: 'Timings' }).click();
  await page.getByRole('switch', { name: 'SMS alerts and OTP' }).click();
  await page.getByRole('switch', { name: 'Data analytics (Power BI reports)' }).click();
  const price = card(page, 'Price');
  await price.getByText('₹3,30,000').first().waitFor();          // Pro ₹2,59,000 by band + storage + transport + timings + SMS + analytics
  const margin = card(page, 'Margin and profit');
  assert.match(await margin.innerText(), /Maximum allowable discount\s*13\.5%/);
  assert.match(await margin.innerText(), /Gross margin[\s\S]*within/);
  await page.getByLabel('Discount %', { exact: true }).fill('10');
  await price.getByText('₹2,98,950').first().waitFor();
  assert.match(await margin.innerText(), /Profit\s*₹[\d,]+ · 18\.2%/);
  assert.match(await margin.innerText(), /Operating cost\s*₹/);
  await page.getByLabel('Additional discount %').fill('5');
  await price.getByText('₹2,84,003').first().waitFor();            // 5% more on the final amount: ₹2,98,950 × 0.95
  assert.match(await margin.innerText(), /Additional discount on the final amount\s*5%/);
  await page.getByLabel('Additional discount %').fill('0');
  await price.getByText('₹2,98,950').first().waitFor();

  // PDF
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download PDF' }).click()]);
  assert.match(dl.suggestedFilename(), /^PROP-\d{4}-\d{3}-Hillview-School\.pdf$/);
  const file = await dl.path();
  assert.equal(fs.readFileSync(file).subarray(0, 4).toString(), '%PDF');
  assert.ok(fs.statSync(file).size > 30000);

  // Email
  await page.getByRole('button', { name: 'Email proposal' }).click();
  const mail = page.getByRole('dialog', { name: /Email proposal/ });
  assert.equal(await mail.getByLabel('Email to').inputValue(), 'principal@hillview.example.com');
  assert.match(await mail.getByLabel('Message').inputValue(), /Please contact Sales team/);
  await mail.getByRole('button', { name: 'Send email' }).click();
  await page.getByText(/Proposal emailed to principal@hillview.example.com with the PDF attached/).waitFor();
  assert.equal(await page.getByLabel('Proposal status').inputValue(), 'Sent');

  // Demo Builder: provider pre-filled, changes go to the proposal and the demo school
  await page.getByRole('button', { name: 'Build demo' }).click();
  await page.getByRole('heading', { name: 'Demo builder' }).waitFor();
  assert.match(await page.getByLabel('Client').locator('option:checked').innerText(), /Hillview School/);
  await page.locator('.provider-card', { hasText: 'YourApp School Systems (example)' }).waitFor();
  assert.equal(await page.getByLabel('Contact email').inputValue(), 'principal@hillview.example.com');
  await page.getByRole('button', { name: 'Create demo school' }).click();
  await page.getByText('Demo school Hillview School (demo) is ready').waitFor();
  await page.getByRole('switch', { name: 'Student portfolios' }).click();
  await page.getByText(/Portfolios/).first().waitFor();
  await page.getByRole('button', { name: 'Open as Principal' }).click();
  await page.getByText(/Sales demo for/).waitFor();
  assert.match(await page.locator('nav.side .school').innerText(), /Hillview School \(demo\)[\s\S]*Pro plan/);
  assert.match(await page.locator('nav.side').innerText(), /TRANSPORT/i);
  await go(page, 'STU_PORTFOLIO');
  await page.getByRole('heading', { name: 'Portfolios' }).waitFor();
  await go(page, 'ACA_CURRICULUM');
  assert.equal(await page.getByRole('heading', { name: 'Curriculum planning' }).count(), 0, 'LMS not bought');
  await go(page, 'TRN_ROUTES');
  await page.getByRole('tab', { name: 'Route map' }).waitFor();
  await page.getByRole('button', { name: 'Edit timings' }).waitFor();
  await page.getByRole('button', { name: 'End demo' }).click();
  await page.getByRole('heading', { name: 'Demo builder' }).waitFor();
  await page.getByRole('button', { name: /^Open proposal/ }).click();
  await card(page, 'Price').getByText(/Student portfolios · 650 students/).waitFor();   // the proposal changed with the demo

  // Competitors and roadmap still work with the new tiers
  await go(page, 'SP_COMPARE');
  await page.getByLabel('Our plan').selectOption('STARTER');
  await page.getByText(/our Starter tier costs/).waitFor();
  await go(page, 'SP_MARKET');
  await page.getByRole('tab', { name: /Future enhancements/ }).click();
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('the Admin edits prices; Back to Pricing leaves the editor; school users never see it', async () => {
  const { ctx, page, errors } = await start();
  await as(page, 'Admin');
  await go(page, 'SP_RATES');
  await page.getByRole('heading', { name: 'Pricing' }).waitFor();
  await page.getByRole('button', { name: 'Edit prices' }).click();
  await page.getByLabel('Starter rate 1–300').fill('0');
  await page.getByRole('button', { name: 'Save prices' }).click();
  await page.getByText(/no plan is free/).waitFor();
  await page.getByRole('button', { name: 'Back to Pricing' }).click();
  await page.getByRole('heading', { name: 'Pricing' }).waitFor();
  await page.getByRole('button', { name: 'Edit prices' }).click();
  await page.getByLabel('Pro rate 1–300').fill('450');
  await page.getByRole('button', { name: 'Save prices' }).click();
  await page.getByText(/Prices saved/).waitFor();
  await page.locator('#tier-PRO .tier-price', { hasText: '₹450' }).waitFor();
  await page.getByRole('button', { name: 'Choose Pro', exact: true }).click();
  await card(page, 'Price').getByText('₹1,73,000').first().waitFor();   // 300 × ₹450 + 100 × ₹380
  await as(page, 'Principal');
  assert.doesNotMatch(await page.locator('nav.side').innerText(), /Service Provider/i);
  await go(page, 'SP_RATES');
  assert.equal(await page.getByRole('heading', { name: 'Pricing' }).count(), 0);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('add-ons in a school: backups, WhatsApp, board, curriculum, portfolios', async () => {
  const { ctx, page, errors } = await start();
  await as(page, 'Admin');
  await go(page, 'OPS_BACKUP');
  await page.getByRole('heading', { name: 'Backups & restore' }).waitFor();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Back up now' }).click()]);
  assert.match(dl.suggestedFilename(), /^backup-GVS-.*\.json$/);
  const backupFile = await dl.path();
  await page.getByText(/Backup downloaded/).waitFor();
  await page.getByLabel('Backup file').setInputFiles(backupFile);
  const dlg = page.getByRole('dialog', { name: 'Restore this backup?' });
  await dlg.getByText(/students/).waitFor();
  await dlg.getByRole('button', { name: 'Restore' }).click();
  await page.getByText('Data restored from the backup').waitFor();
  await go(page, 'FEE_DUES');
  const wa = page.getByRole('link', { name: /WhatsApp .*parent/ }).first();
  assert.match(await wa.getAttribute('href'), /^https:\/\/wa\.me\/91\d{10}\?text=Dear%20parent/);
  await go(page, 'EXM_COSCH');
  await page.getByRole('combobox', { name: 'Exam board' }).selectOption('IB');
  await page.getByText(/^IB scale/).waitFor();
  await go(page, 'ACA_CURRICULUM');
  await page.getByRole('heading', { name: 'Curriculum planning' }).waitFor();
  await page.getByText('Linear equations in one variable').waitFor();
  await as(page, 'Parent');
  await go(page, 'STU_PORTFOLIO');
  await page.getByText('Science fair model: water filter').waitFor();
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('client delivery: convert a proposal, fill a link, documents, website, share, and the customer opens the test build', async () => {
  const { ctx, page, errors } = await start();
  await as(page, 'Sales & marketing');
  await go(page, 'SP_DELIVERY');
  await page.getByRole('heading', { name: 'Client delivery' }).waitFor();
  await page.getByRole('cell', { name: 'Little Steps School (example)' }).waitFor();   // the Won sample, converted
  const pick = page.getByLabel('Proposal to convert');
  await pick.selectOption(await pick.locator('option', { hasText: 'PROP-2026-001' }).getAttribute('value'));
  await page.getByRole('button', { name: 'Convert to client' }).click();
  await page.getByText(/Sample Public School \(example\) converted/).waitFor();
  await page.getByRole('heading', { name: /Sample Public School \(example\) · CP-/ }).waitFor();
  const testRow = page.getByRole('row', { name: /Customer test build/ });
  assert.match(await testRow.innerText(), /Ready/);
  const trial = await testRow.getByRole('link').getAttribute('href');
  assert.match(trial, /#\/try\//);
  const tf = page.getByRole('row', { name: /Apple TestFlight/ });
  assert.match(await tf.innerText(), /Placeholder/);
  await tf.getByRole('button', { name: 'Fill in' }).click();
  await page.getByLabel('Link address').fill('https://testflight.apple.com/join/AbC123');
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await page.getByText('Link saved').waitFor();
  assert.match(await page.getByRole('row', { name: /Apple TestFlight/ }).innerText(), /Ready/);
  await page.getByRole('tab', { name: /Documents/ }).click();
  await page.getByRole('row', { name: /Customer testing \(UAT\) plan/ }).getByRole('button', { name: 'Preview' }).click();
  await page.getByRole('dialog').getByRole('heading', { name: 'Where to test' }).waitFor();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('dialog').getByRole('button', { name: 'Download PDF' }).click()]);
  assert.match(dl.suggestedFilename(), /^CP-\d{4}-\d{3}-UAT-v1\.0\.pdf$/);
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
  await page.getByRole('tab', { name: 'Website' }).click();
  assert.match(await page.locator('iframe[title="Website preview"]').getAttribute('srcdoc'), /Welcome to Sample Public School/);
  await page.getByRole('button', { name: 'Share with customer' }).click();
  const share = page.getByRole('dialog', { name: /Share with/ });
  assert.equal(await share.getByLabel('Share to').inputValue(), 'principal@samplepublic.example.com');
  assert.ok(await share.getByRole('checkbox', { name: /Google Play internal testing/ }).isDisabled(), 'placeholders cannot be shared');
  await share.getByRole('button', { name: 'Send email' }).click();
  await page.getByText('Sent to principal@samplepublic.example.com').waitFor();
  await page.getByRole('tab', { name: 'Links' }).click();
  assert.match(await page.getByRole('row', { name: /Customer test build/ }).innerText(), /Shared/);
  // The customer opens the test build in their own browser
  const cust = await browser.newContext({ viewport: { width: 1300, height: 900 } });
  const cp = await cust.newPage(); const cerr = [];
  cp.on('pageerror', (e) => cerr.push(e.message));
  await cp.goto(server.url + trial.slice(trial.indexOf('#')));
  await cp.getByText(/Customer test build: Sample Public School/).waitFor();
  const nav = await cp.locator('nav.side').innerText();
  assert.match(nav, /Sample Public School[\s\S]*Pro plan/); assert.doesNotMatch(nav, /Service Provider/i);
  await cust.close();
  assert.deepEqual([...errors, ...cerr], []);
  await ctx.close();
});
