// Release 12 in the browser: dashboard insights, student profile, attendance register, report cards to a parent,
// staff leave with notifications, route planning and new stops, FAQs and help documents, conversion templates.
//   npm run build && CHROME_PATH=/usr/bin/google-chrome node --test tests/e2e/release12.test.mjs
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
  await page.waitForTimeout(300);          // let the home screen settle before deep links
}
const go = async (page, code) => { await page.goto(server.url + '#/s/' + code); await page.waitForTimeout(150); };

test('dashboard: insights, full and part time, salary by type, buses and breakdowns; log a breakdown', async () => {
  const { ctx, page, errors } = await start();
  await as(page, 'Admin');
  await go(page, 'DASH');
  await page.getByRole('tab', { name: 'Staff' }).click();
  await page.getByRole('list', { name: 'Staff insights' }).waitFor();
  await page.getByText('Part time', { exact: true }).first().waitFor();
  const salary = page.getByRole('table', { name: 'Salary by employee type' });
  assert.match(await salary.innerText(), /Full time[\s\S]*Part time[\s\S]*Total/);
  assert.equal(await page.getByText('Joined this year').count(), 0, 'joining list removed');
  await page.getByRole('tab', { name: 'Transport' }).click();
  await page.getByRole('table', { name: 'Riders per route against last year' }).waitFor();
  assert.equal(await page.getByRole('table', { name: 'Bus breakdowns' }).locator('tbody tr').count(), 5);
  await page.getByRole('button', { name: 'Log a breakdown' }).click();
  await page.getByLabel('Details').fill('Flat tyre at the depot gate');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByRole('table', { name: 'Bus breakdowns' }).getByText('Flat tyre at the depot gate').waitFor();
  for (const tab of ['Students', 'Fees', 'Enrolment']) { await page.getByRole('tab', { name: tab }).click(); await page.getByRole('list', { name: tab + ' insights' }).waitFor(); }
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('student profile: four parts, rank against classmates; attendance register by range', async () => {
  const { ctx, page, errors } = await start();
  await as(page, 'Teacher');
  await go(page, 'STU_PROFILE');
  await page.getByRole('heading', { name: 'Aarav Sharma' }).waitFor();
  await page.getByRole('tab', { name: 'Academic profile' }).click(); await page.getByText('Subjects and teachers').waitFor();
  await page.getByRole('tab', { name: 'Performance' }).click();
  const marks = page.getByRole('table', { name: 'Marks by subject and exam' });
  assert.match(await marks.innerText(), /Rank in section[\s\S]*Rank in grade/);
  await page.getByText('Better than').first().waitFor();
  await page.getByRole('tab', { name: 'Attendance report' }).click();
  await page.getByRole('table', { name: 'Attendance by month' }).waitFor();
  await go(page, 'STU_ATT');
  const reg = page.getByRole('table', { name: 'Attendance register C8A' });
  await reg.waitFor();
  assert.equal(await reg.locator('tbody tr').count(), 4);
  await page.getByRole('button', { name: 'This week' }).click();
  const cols = await reg.locator('thead th').count();
  assert.equal(cols, 1 + 7 + 3, 'name, 7 days, 3 totals');
  const today = new Date().toISOString().slice(0, 10);
  const cell = reg.getByRole('button', { name: new RegExp(`^1\\. Aarav Sharma, ${today}: `) });
  if (await cell.count()) { const before = await cell.getAttribute('aria-label'); await cell.click(); assert.notEqual(await cell.getAttribute('aria-label'), before, 'tap changes the mark'); }
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('report cards: generate for a section, publish, the parent is told and opens it', async () => {
  const { ctx, page, errors } = await start();
  await as(page, 'Principal');
  await go(page, 'STU_REPORTCARD');
  await page.getByLabel('Section', { exact: true }).selectOption({ label: 'A' });
  await page.getByRole('button', { name: 'Generate' }).click();
  assert.equal(await page.locator('article.rc').count(), 4);
  await page.getByRole('button', { name: /Publish to parents/ }).click();
  await page.locator('.toast', { hasText: 'published' }).waitFor();
  await as(page, 'Parent');
  await page.getByRole('button', { name: /Notifications, \d+ unread/ }).click();
  await page.getByText('Report card ready: Aarav Sharma').click();
  await page.getByRole('heading', { name: /My child/ }).waitFor();
  await page.getByRole('button', { name: 'Open' }).first().click();
  await page.getByRole('article', { name: 'Report card Aarav Sharma' }).waitFor();
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('staff leave: teacher applies, approvers are notified, Principal approves, teacher is told; Add staff inside All Staff', async () => {
  const { ctx, page, errors } = await start();
  await as(page, 'Teacher');
  await go(page, 'SELF_LEAVE');
  await page.getByRole('table', { name: 'My leave balances' }).waitFor();
  const d = new Date(); d.setUTCDate(d.getUTCDate() + 8); if (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() + 1);
  const day = d.toISOString().slice(0, 10);
  await page.getByLabel('From', { exact: true }).fill(day); await page.getByLabel('To', { exact: true }).fill(day);
  await page.getByLabel('Reason').fill('Family function');
  await page.getByRole('button', { name: 'Send for approval' }).click();
  await page.locator('.toast', { hasText: 'Sent for approval to' }).waitFor();
  await page.getByRole('table', { name: 'My leave requests' }).getByText('Waiting for approval').first().waitFor();
  await as(page, 'Principal');
  await page.getByRole('button', { name: /Notifications, \d+ unread/ }).click();
  await page.getByText('Leave to approve: Sonia Mehta').first().click();
  await page.getByRole('heading', { name: 'Leave requests' }).waitFor();
  const row = page.getByRole('table', { name: 'Leave waiting for approval' }).locator('tr', { hasText: 'Sonia Mehta' });
  await row.getByRole('button', { name: 'Approve' }).click();
  await page.locator('.toast', { hasText: 'Approved' }).waitFor();
  await as(page, 'Teacher');
  await page.getByRole('button', { name: /Notifications, \d+ unread/ }).click();
  await page.getByText('Leave approved: Casual leave').waitFor();
  // Add Staff now lives in All Staff
  await as(page, 'Admin');
  await go(page, 'STF_LIST');
  await page.getByRole('button', { name: 'Add staff' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel('First name').fill('Tara'); await dlg.getByLabel('Short code (timetable)').fill('TAR'); await dlg.getByLabel('Mobile').fill('9845099911');
  await dlg.getByLabel('Employment type').selectOption('Part time');
  await page.getByRole('button', { name: 'Save staff' }).click();
  await page.locator('.toast', { hasText: 'They can now register' }).waitFor();
  await page.getByLabel('Employment type').selectOption('Part time');
  await page.locator('table.t').getByText('Tara').waitFor();
  assert.equal(await page.locator('nav.side button.item', { hasText: /^Add Staff$/ }).count(), 0);
  await go(page, 'STF_ATT');
  await page.getByRole('table', { name: 'Staff attendance register' }).waitFor();
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('routes: plan R4 shorter, add the suggested stop on R2, route sheet shows it', async () => {
  const { ctx, page, errors } = await start();
  await as(page, 'Transport team');
  await go(page, 'TRN_ROUTES');
  await page.getByRole('button', { name: /^R4/ }).click();
  await page.getByRole('tab', { name: 'Plan the route' }).click();
  await page.getByRole('button', { name: /Shortest drive/ }).click();
  await page.getByRole('button', { name: 'Use this route' }).click();
  await page.locator('.toast', { hasText: 'now follows' }).waitFor();
  await page.getByRole('tab', { name: 'Plan the route' }).click();
  assert.match(await page.locator('.opt').first().innerText(), /Shortest drive|Keep the current order/);
  await page.getByRole('button', { name: /^R2/ }).click();
  await page.getByRole('tab', { name: /Pickup suggestions/ }).click();
  await page.getByRole('button', { name: 'Add this stop' }).click();
  await page.getByLabel('Stop name (a landmark parents know)').fill('Lake View Gate');
  await page.getByRole('button', { name: 'Add stop' }).click();
  await page.getByRole('table', { name: 'Stops on R2' }).getByText('Lake View Gate').waitFor();
  await page.getByRole('tab', { name: 'Route map' }).click();
  await page.getByRole('img', { name: /Map of R2: .*Lake View Gate/ }).waitFor();
  await go(page, 'TRN_SHEETS');
  await page.getByRole('button', { name: 'R2', exact: true }).click();
  await page.getByText('Lake View Gate').first().waitFor();
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('help: FAQs for the role, school FAQ and document added in Operations, guide follows access, templates', async () => {
  const { ctx, page, errors } = await start();
  await as(page, 'Admin');
  await go(page, 'OPS_HELPDOCS');
  await page.getByRole('tab', { name: /School FAQs/ }).click();
  await page.getByRole('button', { name: 'Add a question' }).click();
  await page.getByLabel('Question', { exact: true }).fill('When is the annual day?');
  await page.getByLabel('Answer', { exact: true }).fill('On 20 December, in the school ground.');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByRole('table', { name: 'School FAQs' }).getByText('When is the annual day?').waitFor();
  await page.getByRole('tab', { name: /Documents/ }).click();
  await page.getByRole('button', { name: 'Add a document' }).click();
  await page.getByLabel('Title').fill('Parent handbook');
  await page.getByLabel('Link (https://…)').fill('https://www.example.com/handbook.pdf');
  await page.getByRole('button', { name: 'Save' }).click();
  await go(page, 'OPS_IMPORT');
  const tpl = page.getByRole('table', { name: 'Conversion templates' });
  assert.equal(await tpl.locator('tbody tr').count(), 20);
  await tpl.getByText('02_Student_Data.xlsx').waitFor();
  await as(page, 'Parent');
  await go(page, 'HELP_FAQ');
  await page.getByText('When is the annual day?').click();
  await page.getByText('On 20 December').waitFor();
  await page.getByRole('link', { name: /Open/ }).first().waitFor();
  assert.equal(await page.getByText('How do I mark attendance?').count(), 0, 'staff questions hidden from parents');
  await go(page, 'HELP_GUIDE');
  await page.getByRole('tab', { name: 'Screen by screen' }).click();
  await page.getByText('Fee Dues & Pay').first().waitFor();
  assert.equal(await page.getByRole('list', { name: 'Run Payroll steps' }).count() + await page.locator('[aria-label="Run Payroll steps"]').count(), 0, 'only what a parent can open');
  await page.getByRole('button', { name: /Everything the platform offers/ }).click();
  await page.locator('[aria-label="Run Payroll steps"]').waitFor();
  assert.deepEqual(errors, []);
  await ctx.close();
});
