// Builds docs/USER_GUIDE.md from the same data the in-app guide uses (src/data/guide.js, src/data/menu.js).
//   node scripts/user-guide.mjs
import fs from 'node:fs';
import { MENU, ACCESS, PLANS, MIN_RANK, PHONE_READY, RECOMMENDED, CHANNELS, mobileTabs, webScreens, channelIn } from '../src/data/menu.js';
import { SCREEN_HELP, WORKFLOWS, DEMO_PEOPLE } from '../src/data/guide.js';
import { buildSeed } from '../src/data/seed.js';

const db = buildSeed();
const t = db.tenants.find((x) => x.id === db.tenantId);
const SITE = 'https://srirangamvamsi1579-hub.github.io/School-Management-app/';
const NAMES = { ADMIN: 'Admin', PRINCIPAL: 'Principal', ACCOUNTANT: 'Accountant', TEACHER: 'Teacher', FRONT_OFFICE: 'Front Office', PARENT: 'Parent', TRANSPORT: 'Transport team', PLATFORM: 'Platform team' };
const ORDER = ['PARENT', 'TEACHER', 'FRONT_OFFICE', 'TRANSPORT', 'PRINCIPAL', 'ACCOUNTANT', 'ADMIN', 'PLATFORM'];
const label = Object.fromEntries(MENU.flatMap((m) => m.items.map((i) => [i[0], i[1]])));
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
  `- Emails and SMS are simulated: read them in Operations → Email & SMS Outbox, or the Test inbox on the sign-in page.`,
  `- Data stays in your browser; two tabs stay in step. Admins can reset it (Operations → Reset demo data).`,
  `- A school sees only the modules in its plan (Starter, Growth, Professional, Enterprise) or switched on for it. A person sees only the screens their role, designation or personal grants allow.`, '');

p(`## 2. What each role sees`, '', `Website menus and phone tabs with the recommended layout. Schools change this in **Operations → Web & App Screens** (section 3).`, '',
  `| Role | Website (main menus and sub-menus) | Phone app tabs |`, `| --- | --- | --- |`);
ORDER.forEach((r) => { const perms = { [r]: ACCESS[r] }; const web = webScreens(t, r, perms); const app = r === 'PLATFORM' ? [] : mobileTabs({ ...t, mobile: { enabled: true } }, r, perms);
  p(`| **${NAMES[r]}** | ${MENU.filter((m) => m.items.some((i) => web.includes(i[0]))).map((m) => `**${m.label}:** ${m.items.filter((i) => web.includes(i[0])).map((i) => i[1]).join(', ')}`).join('<br>')} | ${app.length ? app.map((x) => x[1]).join(', ') : 'Website only'} |`); });
p('');

p(`## 3. Web & App Screens (choosing what goes on the website and in the app)`, '',
  `**Operations → Web & App Screens.** For each role, each phone-ready screen is set to *Website + app*, *Website only* or *App only*. Screens not built for phones always stay on the website. Account is always on both, because the app stores require account deletion inside the app.`, '',
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

p(`## 6. Mobile app`, '',
  `- One app in Google Play and the App Store serves every school. On first open, enter the school code (from the school website or welcome email), then sign in with the same email or mobile and password as the website.`,
  `- The platform team switches the app on per school (Platform Console → Schools & Plans → Mobile app). New schools start with it off.`,
  `- Tabs follow section 3. More than five tabs: the extra ones are under **More**.`,
  `- Works offline with saved information; turn notifications on from Home.`,
  `- Parents delete their account in **Account → Delete my account**, or on the web at #/p/delete.`, '',
  `## 7. Common questions`, '',
  `- **A menu is missing.** Check the school's plan and switches (Platform Console), the role's permissions (Operations → Roles & Permissions), and whether the screen is set to *App only* for the role (Web & App Screens).`,
  `- **A link from the school website says "not available".** The person's role can't open that screen on the website; they are taken to their home screen.`,
  `- **A parent can't choose a pickup person.** New pickup people must be checked by the Front Office first (Gate Desk → Approve pickup people).`,
  `- **The coordinator doesn't see a request.** Meetings go to the teacher asked, certificates to the office; coordinators see leave, early leave and transport requests for their sections.`,
  `- **A change to app screens isn't showing.** It must be approved and published; people see it at their next sign-in or app refresh.`, '');
fs.writeFileSync(new URL('../../docs/USER_GUIDE.md', import.meta.url), L.join('\n'));
console.log('docs/USER_GUIDE.md', L.length, 'lines');
