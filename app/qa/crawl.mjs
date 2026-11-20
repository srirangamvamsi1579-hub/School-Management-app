// Inventory: open every screen as the Admin (and Platform for its screens), list buttons, fields and the fields of each "add" dialog
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import { serve } from '../tests/store/serve.mjs';
import { MENU, LABEL } from '../src/data/menu.js';
const server = await serve(new URL('../dist', import.meta.url).pathname);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 } });
const page = await ctx.newPage(); page.setDefaultTimeout(3000);
const fieldsOf = (root) => root.evaluate((el) => [...el.querySelectorAll('input,select,textarea')].filter((i) => i.offsetParent !== null).map((i) => {
  const lab = i.getAttribute('aria-label') || i.closest('label')?.innerText?.trim() || i.closest('.field,.f')?.querySelector('label,span')?.innerText?.trim() || i.id || i.name || i.placeholder || '';
  return { label: lab.split('\n')[0].slice(0, 60), tag: i.tagName.toLowerCase(), type: i.type || '', required: i.required || !!i.closest('.field,.f')?.innerText?.includes('*'), min: i.min || '', max: i.max || '', maxLength: i.maxLength > 0 ? i.maxLength : '', pattern: i.pattern || '', options: i.tagName === 'SELECT' ? [...i.options].slice(0, 12).map((o) => o.text) : undefined };
}));
const out = [];
await page.goto(server.url + '#/s/HOME'); await page.waitForTimeout(800);
const ADD = /^(add|new|set|give|sell|receive|schedule|issue|create|apply|log|edit prices|back up now|convert)/i;
for (const m of MENU) for (const it of m.items) {
  const code = it[0]; if (code[0] === '#') continue;
  await page.goto(server.url + '#/s/' + code); await page.waitForTimeout(350);
  const heading = await page.locator('main h1').first().innerText().catch(() => '');
  const buttons = await page.locator('main button').evaluateAll((bs) => [...new Set(bs.filter((x) => x.offsetParent).map((x) => x.innerText.trim()).filter(Boolean))]).catch(() => []);
  const fields = await fieldsOf(page.locator('main')).catch(() => []);
  const dialogs = [];
  for (const bt of buttons.filter((t) => ADD.test(t)).slice(0, 4)) {
    try {
      await page.locator('main button', { hasText: bt }).first().click(); await page.waitForTimeout(250);
      const dlg = page.locator('.modal, [role=dialog]').first();
      if (await dlg.count()) { dialogs.push({ button: bt, title: await dlg.locator('h2,h3').first().innerText().catch(() => ''), fields: await fieldsOf(dlg) });
        await page.keyboard.press('Escape'); await page.waitForTimeout(100);
        const close = page.locator('.modal button', { hasText: /Close|Cancel|×/ }).first(); if (await close.count()) await close.click().catch(() => {}); }
      else { await page.goto(server.url + '#/s/' + code); await page.waitForTimeout(250); }
    } catch (e) { dialogs.push({ button: bt, error: e.message.split('\n')[0] }); }
  }
  out.push({ module: m.label, code, label: LABEL[code], heading, opened: !!heading, buttons, fields, dialogs });
}
writeFileSync(new URL('./inventory.json', import.meta.url), JSON.stringify(out, null, 1));
console.log(out.length, 'screens;', out.filter((s) => !s.opened).map((s) => s.code).join(' '), '| dialogs', out.reduce((n, s) => n + s.dialogs.length, 0), '| fields', out.reduce((n, s) => n + s.fields.length + s.dialogs.reduce((k, d) => k + (d.fields?.length || 0), 0), 0));
await b.close(); server.close();
