// Builds docs/USER_GUIDE.md from the same data the in-app guide uses (src/data/guide.js, src/data/menu.js).
//   node scripts/user-guide.mjs
import fs from 'node:fs';
import { MENU, ACCESS, PLANS, MIN_RANK, PHONE_READY, RECOMMENDED, CHANNELS, mobileTabs, webScreens, channelIn } from '../src/data/menu.js';
import { SCREEN_HELP, WORKFLOWS, DEMO_PEOPLE } from '../src/data/guide.js';
import { SCREEN_FLOW } from '../src/data/guideFlows.js';
import { FAQS, FAQ_TOPICS } from '../src/data/faq.js';
import { TEMPLATES, templateFile, LOAD_ORDER_NOTE } from '../src/lib/importTemplates.js';
import { buildSeed } from '../src/data/seed.js';

const db = buildSeed();
const t = db.tenants.find((x) => x.id === db.tenantId);
const SITE = 'https://srirangamvamsi1579-hub.github.io/School-Management-app/';
const NAMES = { ADMIN: 'Admin', PRINCIPAL: 'Principal', ACCOUNTANT: 'Accountant', TEACHER: 'Teacher', FRONT_OFFICE: 'Front Office', PARENT: 'Parent', TRANSPORT: 'Transport team', PLATFORM: 'Platform team', SALES: 'Sales & marketing' };
const ORDER = ['PARENT', 'TEACHER', 'FRONT_OFFICE', 'TRANSPORT', 'PRINCIPAL', 'ACCOUNTANT', 'ADMIN', 'PLATFORM', 'SALES'];
const label = { ...Object.fromEntries(MENU.flatMap((m) => m.items.map((i) => [i[0], i[1]]))), HOME: 'Main menu' };
const esc = (x) => String(x).replace(/\|/g, '\\|');
const L = [];
const p = (...x) => L.push(...x);

p(`# User Guide — School Management Platform`, '',
  `For schools, parents and our support team. It covers every menu and sub-menu, what each role sees on the website and in the mobile app, and step-by-step demos of the main workflows. Shareable doc version with screenshots: https://claude.ai/artifact/6ALh8LqsnVisEpf9Leq1LL. The same guide is inside the app: **Help → User Guide & Demo**, where every demo runs with a guide bar that signs you in as the right person.`, '',
  `## 1. Getting started`, '',
  `| What | Where |`, `| --- | --- |`,
  `| Website (test build) | ${SITE} |`,
  `| User guide with live demos (no sign-in) | ${SITE}#/p/guide |`,
  `| Mobile app preview (school code **GVS**) | ${SITE}#/p/mobile |`,
  `| Public admission form | ${SITE}#/p/apply |`,
  `| Any screen directly | ${SITE}#/s/<CODE>, e.g. #/s/SELF_REQUESTS |`, '',
  `**Demo accounts** — password for all: \`Demo@123\`. On the sign-in page, *Demo quick access* signs in without a password.`, '',
  `| Person | Sign-in |`, `| --- | --- |`,
  ...Object.entries(DEMO_PEOPLE).map(([id, n]) => `| ${n} | ${db.users.find((u) => u.id === id)?.login} |`), '',
  `**Good to know**`, '',
  `- Emails and SMS are simulated: read them in Settings → Email & SMS Outbox, or the Test inbox on the sign-in page.`,
  `- Data stays in your browser; two tabs stay in step. Admins can reset it (Reset demo data button at the top).`,
  `- A school sees only the modules in its plan (Starter, Growth, Professional, Enterprise) or switched on for it. A person sees only the screens their role, designation or personal grants allow.`, '');

p(`## 2. What each role sees`, '', `Website menus and phone tabs with the recommended layout. Schools change this in **Settings → Web & App Screens** (section 3).`, '',
  `| Role | Website (main menus and sub-menus) | Phone app tabs |`, `| --- | --- | --- |`);
ORDER.forEach((r) => { const perms = { [r]: ACCESS[r] }; const web = webScreens(t, r, perms); const app = r === 'PLATFORM' ? [] : mobileTabs({ ...t, mobile: { enabled: true } }, r, perms);
  p(`| **${NAMES[r]}** | ${MENU.filter((m) => m.items.some((i) => web.includes(i[0]))).map((m) => `**${m.label}:** ${m.items.filter((i) => web.includes(i[0])).map((i) => i[1]).join(', ')}`).join('<br>')} | ${app.length ? app.map((x) => x[1]).join(', ') : 'Website only'} |`); });
p('');

p(`## 3. Web & App Screens (choosing what goes on the website and in the app)`, '',
  `**Settings → Web & App Screens.** For each role, each phone-ready screen is set to *Website + app*, *Website only* or *App only*. Screens not built for phones always stay on the website. Account is always on both, because the app stores require account deletion inside the app.`, '',
  `**Workflow**`, '',
  `1. **Edit a draft** (Admin or platform team): pick a role and change where screens show. The preview shows that role's website menu and phone tabs. Nothing changes for users yet.`,
  `2. **Send for approval** with a note. The Principal is emailed. The draft is locked while it waits; the editor can take it back.`,
  `3. **Approve and publish** (Principal or platform team — a different person from the editor), or **Send back** with a reason.`,
  `4. Published layouts are numbered versions. **History** shows who changed what; *Restore as draft* brings an earlier version back through the same approval.`, '',
  `Who can open a screen is still set in Roles & Permissions; this only decides where it shows. Designations and personal grants follow the role's choice.`, '',
  `**Recommended layout (version 1)** — chosen so most roles fit the 5-tab phone bar:`, '',
  `| Phone-ready screen | ${['PARENT', 'TEACHER', 'FRONT_OFFICE', 'TRANSPORT', 'PRINCIPAL', 'ACCOUNTANT', 'ADMIN'].map((r) => NAMES[r]).join(' | ')} |`, `| --- |${' --- |'.repeat(7)}`,
  ...Object.keys(PHONE_READY).map((c) => `| ${label[c]} | ${['PARENT', 'TEACHER', 'FRONT_OFFICE', 'TRANSPORT', 'PRINCIPAL', 'ACCOUNTANT', 'ADMIN'].map((r) => (ACCESS[r].includes(c) ? CHANNELS[channelIn({}, r, c)] : '—')).join(' | ')} |`), '',
  `"—" means the role cannot open the screen at all.`, '');

p(`## 4. Guided demos`, '', `In the app: **Help → User Guide & Demo → Guided demos → Start**. Each step names the person and the screen; the guide bar signs you in and opens it.`, '');
WORKFLOWS.forEach((w, k) => { p(`### 4.${k + 1} ${w.title}`, '', `*${w.roles} · about ${w.time}*`, '');
  w.steps.forEach((s, i) => p(`${i + 1}. **${s.public ? 'Without signing in' : DEMO_PEOPLE[s.as]}${s.screen ? ` → ${label[s.screen]}` : ` → ${s.public}`}:** ${s.do}  \n   *You should see:* ${s.check}`)); p(''); });

p(`## 5. Every menu explained`, '');
MENU.forEach((m, k) => { p(`### 5.${k + 1} ${m.label}${m.min > 1 ? ` (from the ${PLANS[m.min - 1].name} plan)` : ''}`, '', `| Sub-menu | What it is for | How to use it | Who can open it | Where |`, `| --- | --- | --- | --- | --- |`);
  m.items.filter((i) => i[0][0] !== '#').forEach(([c, l]) => { const [what, how] = SCREEN_HELP[c]; const who = ORDER.filter((r) => ACCESS[r].includes(c));
    const app = who.filter((r) => r !== 'PLATFORM' && PHONE_READY[c] && channelIn({}, r, c) !== 'WEB');
    p(`| **${l}**${MIN_RANK[c] > 1 ? ` <br>*${PLANS[MIN_RANK[c] - 1].name}+*` : ''} | ${esc(what)} | ${esc(how)} | ${who.map((r) => NAMES[r]).join(', ')} | ${PHONE_READY[c] ? (app.length ? `Website; app for ${app.map((r) => NAMES[r]).join(', ')}` : 'Website (can be added to the app)') : 'Website'} |`); });
  p(''); });

p(`## 6. Screen by screen`, '', `How to use each screen, in the order you click through it. In the app (Help → User Guide & Demo → Screen by screen) this list follows the school's plan, the functions switched on and the person's access; here every screen is listed.`, '');
MENU.forEach((m, k) => { const items = m.items.filter((i) => i[0][0] !== '#' && !i[0].startsWith('VA_')); if (!items.length) return; p(`### 6.${k + 1} ${m.label}`, '');
  items.forEach(([c, l]) => { const f = SCREEN_FLOW[c]; if (!f) return; p(`**${l}** — ${SCREEN_HELP[c]?.[0] || ''}`, '', ...f.flow.map((st, i) => `${i + 1}. ${st}`), ...(f.tips.length ? ['', ...f.tips.map((x) => `- *${x}*`)] : []), ''); });
  if (m.code === 'VIEWAS') p(`**View as Profile (any profile)**`, '', ...SCREEN_FLOW.VA_PARENT.flow.map((st, i) => `${i + 1}. ${st}`), ''); });

p(`## 7. Mobile app`, '',
  `- One app in Google Play and the App Store serves every school. On first open, enter the school code (from the school website or welcome email), then sign in with the same email or mobile and password as the website.`,
  `- The platform team switches the app on per school (Platform Console → Schools & Plans → Mobile app). New schools start with it off.`,
  `- Tabs follow section 3. More than five tabs: the extra ones are under **More**.`,
  `- Works offline with saved information; turn notifications on from Home.`,
  `- Parents delete their account in **Account → Delete my account**, or on the web at #/p/delete.`, '');

p(`## 8. Moving data in: conversion templates`, '', `**Operations → Data Import → Templates.** ${LOAD_ORDER_NOTE} Blank template: \`NN_Name_Data.xlsx\`. Filled-in file: \`NN_Name_Data_<SCHOOL>_<YYYYMMDD>.xlsx\` — the app recognises the template from the name.`, '',
  `| No | File | Menu | Required columns | All columns |`, `| --- | --- | --- | --- | --- |`,
  ...TEMPLATES.map((t) => `| ${String(t.no).padStart(2, '0')} | ${templateFile(t)} | ${t.menu} | ${t.cols.filter((c) => c[1]).map((c) => c[0]).join(', ')} | ${t.cols.length} |`), '');

p(`## 9. Frequently asked questions`, '', `In the app: **Help → FAQs** (each person sees the questions for their role, plus the school's own questions and documents from Operations → Help Documents & FAQs).`, '');
FAQ_TOPICS.forEach((topic) => { const l = FAQS.filter((f) => f.topic === topic); if (!l.length) return; p(`### ${topic}`, ''); l.forEach((f) => p(`**${f.q}** ${f.roles.includes('ALL') ? '' : `*(${f.roles.map((r) => NAMES[r]).join(', ')})*`}  `, f.a, '')); });
fs.writeFileSync(new URL('../../docs/USER_GUIDE.md', import.meta.url), L.join('\n'));
console.log('docs/USER_GUIDE.md', L.length, 'lines');
