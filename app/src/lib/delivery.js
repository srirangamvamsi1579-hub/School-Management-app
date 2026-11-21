// Client delivery (release 14.1). When a proposal is won it is converted into a client project:
// the school is created with exactly what was bought, a set of documents is generated (scope, website, app build,
// hosting and AWS, data migration, testing, go-live, links register), a starter website page is made, and a
// register of every link the customer and our team need — test build, website, hosting, AWS, Play Store, App Store —
// each with an environment, a version and a date. Links not yet known are placeholders until the team fills them in.
import { PLANS, PHONE_READY, RECOMMENDED, LABEL } from '../data/menu.js';
import { DEFAULT_RATE_CARD, quote, offering, tierOf, demoConfig, rupees, pct, activeAddons } from './pricing.js';
import { TEMPLATES } from './importTemplates.js';
import { proposalProblems } from './proposals.js';

const rcOf = (db) => (db.provider?.rateCard?.version >= 2 ? db.provider.rateCard : DEFAULT_RATE_CARD);
const todayIso = () => new Date().toISOString().slice(0, 10);
export const dmy = (d) => new Date((d || '').length === 10 ? d + 'T00:00:00' : d || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
// Release 16: a client goes UAT / demo school → client approval and signing → live school
export const PROJECT_STATUS = ['UAT / Demo', 'Signed off', 'Live'];
export const ENV_NAME = { UAT: 'UAT/DEMO', LIVE: 'Live' };
export const DEFAULT_REPO = 'https://github.com/srirangamvamsi1579-hub/School-Management-app';
export const schoolBranch = (sub) => `school/${sub}`;
// Placeholder: still to be filled in · Planned: the address we will use, not live yet · Ready: live · Shared: sent to the customer
export const LINK_STATUS = ['Placeholder', 'Planned', 'Ready', 'Shared'];
// The sales plans run on these app plans (the Platform Console shows the same names)
export const APP_PLAN = { STARTER: 'STARTER', PRO: 'GROWTH', PRO_PLUS: 'PROFESSIONAL' };

// A stable fingerprint of what was sold, so we can tell when the proposal changed after conversion
export const optionsHash = (o) => { const s = JSON.stringify(o); let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(16); };
export const bumpVersion = (v) => { const [a, b] = String(v || '1.0').split('.').map(Number); return `${a}.${(b || 0) + 1}`; };
const slug = (s) => String(s || 'school').toLowerCase().replace(/\(example\)/g, '').replace(/[^a-z0-9]+/g, '').slice(0, 20) || 'school';

// ---------------------------------------------------------------- Shareable test build
// The test build keeps its data in the visitor's browser, so a link can't point at a school in our browser.
// Instead the link carries the school's set-up (name, code, plan and the screens switched on); opening it
// creates that school in the customer's own browser, with the demo data, exactly as sold.
const b64 = (s) => (typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(s))) : Buffer.from(s, 'utf8').toString('base64')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = (s) => { const t = s.replace(/-/g, '+').replace(/_/g, '/'); return typeof atob === 'function' ? decodeURIComponent(escape(atob(t))) : Buffer.from(t, 'base64').toString('utf8'); };
// Short: the add-ons that are on (included in the plan or bought); the screens follow from them
export function trialPayload(tenant, project, rc = DEFAULT_RATE_CARD) {
  return { v: 2, c: tenant.code, n: tenant.name, s: tenant.subdomain, p: tenant.plan, t: project.tierName, b: tenant.examBoard || 'CBSE', ver: project.version, d: project.updated || project.created,
    a: tenant.delivery?.addons || activeAddons(rc, project.options), k: tenant.env || 'UAT', no: project.no, sa: tenant.overrides?.SP_ADDONS ? 1 : undefined,
    l: Object.fromEntries((project.links || []).filter((l) => PROJECT_MENU_LINKS.includes(l.code) && !TRIAL_CODES.includes(l.code) && !['TEST_GUIDE', 'BRANCH'].includes(l.code) && ['Ready', 'Shared'].includes(l.status) && !isPlaceholder(l.url)).map((l) => [l.code, l.url])), r: project.release?.branch };
}
// Links shown in the school's own Project → Project Links menu
// The four links that are the test build itself (they open from the trial link, so they are never carried inside it)
export const TRIAL_CODES = ['TEST_BUILD', 'TEST_SITE', 'TEST_APP', 'REQ_DOC'];
export const PROJECT_MENU_LINKS = ['SITE', 'TEST_BUILD', 'TEST_SITE', 'TEST_APP', 'REQ_DOC', 'TEST_GUIDE', 'WEB_PROD', 'PLAY', 'APPSTORE', 'BRANCH'];
export const trialLink = (base, tenant, project, rc) => `${String(base).replace(/#.*$/, '')}#/try/${b64(JSON.stringify(trialPayload(tenant, project, rc)))}`;
export function readTrial(hash) {
  const m = /^#\/try\/([A-Za-z0-9_-]+)/.exec(hash || '');
  if (!m) return null;
  try { const p = JSON.parse(unb64(m[1])); return p && p.v === 2 && p.c && Array.isArray(p.a) ? p : null; } catch (e) { return null; }
}
// Put the school from a trial link into this browser's data (replacing an older version of the same school)
export function applyTrial(db, p, hash = '') {
  // Same switches as the sold school: basic features plus the add-ons in the link
  const rc = DEFAULT_RATE_CARD;
  const addons = Object.fromEntries(p.a.filter((c) => rc.addons.some((x) => x.code === c)).map((c) => [c, true]));
  const { overrides } = demoConfig({ ...rc, tiers: rc.tiers.map((t) => ({ ...t, includes: [] })) }, { tier: 'STARTER', addons });
  overrides.PROJECT = true; overrides.PRJ_LINKS = true;
  if (p.sa) overrides.SP_ADDONS = true;            // release 16.2: the provider switches add-ons for this school
  // The client's own website: the side menu's "School website" opens it, and the phone app starts on this school
  if (p.l?.SITE && /^https:\/\//.test(p.l.SITE)) {
    (db.links || []).filter((l) => l.label === 'School website').forEach((l) => { l.url = p.l.SITE; });
    if (db.website) db.website.url = p.l.SITE;
  }
  const t = { id: 'TT-' + p.c, code: p.c, name: p.n, subdomain: p.s, plan: PLANS.some((x) => x.code === p.p) ? p.p : 'ENTERPRISE', status: 'Customer testing', overrides, examBoard: p.b,
    mobile: { enabled: p.m, appStatus: 'Shared app' }, renews: '—', trial: { tier: p.t, version: p.ver, date: p.d }, env: p.k || 'UAT',
    delivery: { projectNo: p.no, version: p.ver, date: p.d, tier: p.t, addons: p.a, branch: p.r, links: p.l || {}, trial: String(hash).replace(/\?.*$/, '') } };
  db.tenants = db.tenants.filter((x) => x.id !== t.id);
  db.tenants.push(t);
  db.tenantId = t.id;
  return t;
}

// ---------------------------------------------------------------- Links register
// [group, code, label, environment, url builder (ctx) → url; a url with <…> is a placeholder to fill in]
export const LINK_GROUPS = ['Testing', 'Website', 'Hosting', 'AWS', 'Mobile', 'Release'];
export const LINK_TYPES = [
  ['Testing', 'TEST_BUILD', 'Customer test build (the school as sold, demo data)', 'Test', (c) => trialLink(c.testBase, c.tenant, c.project, c.rc)],
  ['Testing', 'TEST_SITE', 'UAT website (starter page with this school\'s links)', 'Test', (c) => trialLink(c.testBase, c.tenant, c.project, c.rc) + '?to=site'],
  ['Testing', 'TEST_APP', 'UAT phone app (school code {code})', 'Test', (c) => trialLink(c.testBase, c.tenant, c.project, c.rc) + '?to=app'],
  ['Testing', 'REQ_DOC', 'Requirements document (scope of the school as agreed)', 'Test', (c) => trialLink(c.testBase, c.tenant, c.project, c.rc) + '?to=req'],
  ['Testing', 'TEST_GUIDE', 'User guide and guided demos', 'Test', (c) => c.testBase + '#/p/guide'],
  ['Website', 'SITE', 'School website (starter page)', 'Production', (c) => `https://www.<${c.sub}-domain>/`],
  ['Website', 'PORTAL', 'Parent and staff sign-in', 'Production', (c) => `https://${c.sub}.yourapp.com/`],
  ['Website', 'ADMISSION', 'Admission enquiry form', 'Production', (c) => `https://${c.sub}.yourapp.com/#/p/apply`],
  ['Website', 'PRIVACY', 'Privacy policy (needed by the stores)', 'Production', (c) => `https://${c.sub}.yourapp.com/#/p/privacy`],
  ['Website', 'DELETE', 'Delete an account (needed by the stores)', 'Production', (c) => `https://${c.sub}.yourapp.com/#/p/delete`],
  ['Hosting', 'WEB_DEV', 'Web app — development', 'Dev', (c) => `https://dev-${c.sub}.yourapp.com/`],
  ['Hosting', 'WEB_PREPROD', 'Web app — pre-production (customer sign-off)', 'Pre-prod', (c) => `https://preprod-${c.sub}.yourapp.com/`],
  ['Hosting', 'WEB_PROD', 'Web app — production', 'Production', (c) => `https://${c.sub}.yourapp.com/`],
  ['AWS', 'AWS_STACK', 'AWS CloudFormation stack (ap-south-1, Mumbai)', 'Production', (c) => `https://ap-south-1.console.aws.amazon.com/cloudformation/home#/stacks?filteringText=school-${c.sub}<-stack-id>`],
  ['AWS', 'AWS_CDN', 'CloudFront distribution', 'Production', () => 'https://<distribution-id>.cloudfront.net/'],
  ['AWS', 'AWS_DB', 'Database', 'Production', (c) => (c.hosting === 'SHARED' ? 'Shared Aurora PostgreSQL cluster (ap-south-1), school row-level security' : `https://ap-south-1.console.aws.amazon.com/rds/home#database:id=<school-${c.sub}-db>`)],
  ['Mobile', 'PLAY_TEST', 'Google Play internal testing', 'Test', (c) => `https://play.google.com/apps/internaltest/<${c.branded ? 'branded-app' : 'shared-app'}-test-id>`],
  ['Mobile', 'PLAY', 'Google Play listing', 'Production', (c) => `https://play.google.com/store/apps/details?id=${c.bundle}`],
  ['Mobile', 'TESTFLIGHT', 'Apple TestFlight', 'Test', () => 'https://testflight.apple.com/join/<invite-code>'],
  ['Mobile', 'APPSTORE', 'App Store listing', 'Production', (c) => `https://apps.apple.com/in/app/${c.branded ? slug(c.client) : 'yourapp-school-platform'}/id<apple-id>`],
  ['Release', 'BRANCH', 'School branch (from dev)', 'All', (c) => `${c.repo}/tree/${schoolBranch(c.sub)}`],
  ['Release', 'UAT_TAG', 'UAT build tag', 'Test', (c) => `${c.repo}/releases/tag/${c.sub}-uat-v${c.project.version}`],
  ['Release', 'RELEASE', 'Live release tag (after sign-off)', 'Production', (c) => c.project.live ? `${c.repo}/releases/tag/${c.sub}-v${c.project.live.version}` : `${c.repo}/releases/tag/${c.sub}-v<signed-version>`]
];
export const isPlaceholder = (url) => /<[^>]*>/.test(url);

function linkCtx(db, project) {
  const tenant = db.tenants.find((t) => t.id === project.tenantId);
  const prof = db.provider?.profile || {};
  const o = project.options;
  return { rc: rcOf(db), tenant, project, repo: (prof.repo || DEFAULT_REPO).replace(/\/$/, ''), testBase: prof.testSite || 'https://yourapp.example.com/test/', sub: tenant.liveSubdomain || tenant.subdomain, client: o.client, hosting: o.hosting || 'SHARED',
    branded: !!o.addons?.BRANDED_APP, bundle: o.addons?.BRANDED_APP ? `com.yourapp.${slug(o.client)}` : 'com.yourapp.school' };
}
// Build or refresh the register: auto links follow the project version; a link the team filled in keeps its URL
export function refreshLinks(db, project, by) {
  const ctx = linkCtx(db, project);
  const now = todayIso();
  const prev = Object.fromEntries((project.links || []).map((l) => [l.code, l]));
  project.links = LINK_TYPES.map(([group, code, label, env, make]) => {
    const auto = make(ctx).replace('{code}', ctx.tenant.code);
    const old = prev[code];
    const generated = group === 'Testing' || ['BRANCH', 'UAT_TAG'].includes(code);
    if (old && old.edited) return old;                        // the team set this link; keep it
    const url = auto;
    const changed = !old || old.url !== url || old.version !== project.version;
    const l = { code, group, label: label.replace('{code}', ctx.tenant.code), env, url, auto: generated, edited: false,
      version: generated ? project.version : (old?.version && old.version !== '—' ? old.version : isPlaceholder(url) ? '—' : project.version), date: changed && generated ? now : (old?.date || now),
      status: isPlaceholder(url) ? 'Placeholder' : generated ? (old?.status === 'Shared' && !changed ? 'Shared' : 'Ready') : (['Ready', 'Shared'].includes(old?.status) && !changed ? old.status : 'Planned'), note: old?.note || '', history: old?.history || [] };
    if (old && changed && old.url !== url && !isPlaceholder(old.url)) l.history = [{ url: old.url, version: old.version, date: old.date, by }, ...l.history].slice(0, 20);
    return l;
  });
  return project.links;
}
export function setLink(db, projectId, code, { url, version, note, live = true }, by) {
  const p = db.provider.projects.find((x) => x.id === projectId);
  const l = p.links.find((x) => x.code === code);
  const u = String(url || '').trim();
  if (!u) throw new Error('Enter the link');
  if (!isPlaceholder(u) && !/^https:\/\//.test(u) && l.group !== 'AWS') throw new Error('Links must start with https://');
  if (u !== l.url || (version && version !== l.version)) l.history = [{ url: l.url, version: l.version, date: l.date, by }, ...(l.history || [])].slice(0, 20);
  Object.assign(l, { url: u, version: String(version || l.version), note: note ?? l.note, date: todayIso(), edited: true, status: isPlaceholder(u) ? 'Placeholder' : live ? 'Ready' : 'Planned', by });
  return l;
}

// ---------------------------------------------------------------- Documents
export const DOC_TYPES = [
  ['ORDER', 'Order confirmation and scope of work'],
  ['WEBSITE', 'Website requirements'],
  ['APP', 'Mobile app build requirements (Google Play and App Store)'],
  ['HOSTING', 'Hosting and AWS requirements'],
  ['DATA', 'Data migration plan'],
  ['UAT', 'Customer testing (UAT) plan'],
  ['GOLIVE', 'Go-live checklist'],
  ['LINKS', 'Links register']
];
const MILESTONES = [['Kick-off and set-up', 0], ['Data templates returned by the school', 10], ['Data loaded, customer testing starts', 17], ['Customer sign-off', 31], ['Go-live', 38]];

// One document's content: { code, title, version, date, sections: [{ h, p?, bullets?, table? }] }
export function buildDoc(db, project, code) {
  const rc = rcOf(db);
  const o = project.options;
  const q = quote(rc, o);
  const off = offering(rc, o);
  const tenant = db.tenants.find((t) => t.id === project.tenantId);
  const prof = db.provider?.profile || {};
  const found = (c) => project.links.find((l) => l.code === c);
  const link = (c) => { const l = found(c); return l && l.url.length > 100 ? { ...l, url: l.url.slice(0, 72) + '… (full link in the email and in Client Delivery)' } : l; };
  const meta = (project.documents || []).find((d) => d.code === code) || { version: project.version, date: project.updated || project.created };
  const title = DOC_TYPES.find((d) => d[0] === code)[1];
  const intro = { h: 'About this document', p: `${title} for ${o.client}${o.city ? ', ' + o.city : ''}. Project ${project.no}, from proposal ${project.proposalNo}. Version ${meta.version}, ${dmy(meta.date)}. Prepared by ${prof.name}; contact ${prof.contact}, ${prof.email}, ${prof.phone}.` };
  const sold = [...off.basic.map((b) => b.label), ...off.inTier.map((a) => a.name), ...off.chosen.map((a) => a.name)];
  const S = [];
  if (code === 'ORDER') {
    S.push(intro,
      { h: 'Customer', table: { cols: ['', ''], rows: [['School', o.client], ['City', o.city || '—'], ['Board', o.board || '—'], ['Students', String(q.students)], ['Point of contact', [o.poc?.name, o.poc?.designation].filter(Boolean).join(', ') || '—'], ['Email ID', o.poc?.email || '—'], ['Contact number', o.poc?.phone || '—'], ['School code', tenant.code]] } },
      { h: `Plan: ${q.tier.name}`, bullets: sold },
      { h: 'Price', table: { cols: ['Item', 'Amount'], rows: [...q.lines.map((l) => [l.label, l.included ? 'Included' : rupees(l.amount)]), ...(q.discount ? [[`Discount ${pct(q.discountPct)} on the plan and add-ons`, rupees(-q.discount)]] : []), ...(q.finalDiscountPct ? [[`Additional discount ${pct(q.finalDiscountPct)} on the final amount (a year)`, rupees(-q.finalDiscountRecurring)]] : []), ['Payable a year (before GST)', rupees(q.recurring)], ...q.oneTime.map((l) => [l.label + ' (one-time)', l.included ? 'Included' : rupees(l.amount)]), ...(q.finalDiscountOneTime ? [[`Additional discount ${pct(q.finalDiscountPct)} on one-time items`, rupees(-q.finalDiscountOneTime)]] : []), ['Year one payable with GST', rupees(q.yearOneTotal)]] } },
      { h: 'Timeline', table: { cols: ['Milestone', 'Target date'], rows: MILESTONES.map(([m, d]) => [m, dmy(addDays(project.created, d))]) } },
      { h: 'Terms', bullets: [`Prices exclude GST at 18%. Billing once per academic year; one-time items are invoiced at kick-off.`, 'The school owns its data and can export it at any time.', 'Payment within 15 days of the invoice.', 'Changes to the scope after sign-off are quoted separately and issued as a new version of this document.'] });
  }
  if (code === 'WEBSITE') {
    S.push(intro,
      { h: 'Addresses', table: { cols: ['What', 'Address', 'Status'], rows: ['SITE', 'PORTAL', 'ADMISSION', 'PRIVACY', 'DELETE'].map((c) => [link(c).label, link(c).url, link(c).status]) } },
      { h: 'Pages on the school website', bullets: ['Home: name, logo, a welcome line, admissions open banner', 'About: history, vision, leadership, board and affiliation number', 'Admissions: process, fees summary and the enquiry form (embedded from the platform)', 'Academics: classes, curriculum and calendar', 'Parents: sign in, pay fees, phone app download buttons', 'Contact: address, map, phone, email, office hours', 'Privacy policy and account deletion pages (links above; required by the app stores)'] },
      { h: 'From the school', bullets: ['Logo (SVG or PNG, 1024 px) and school colours', 'Photos of the campus (at least 6, landscape)', 'Text for About, Admissions and Academics', 'The domain name and access to its DNS (to point www and the portal to us)', 'Affiliation number, address, phone and email for the footer'] },
      { h: 'What we deliver', bullets: [`A starter page generated from this project (version ${project.version}), ready to be filled with the school's content`, 'Links from the website to sign-in, fees, admission enquiry and the phone app', 'HTTPS on every address; hosting on our AWS account in Mumbai', o.addons?.BRANDING || tierOf(rc, o.tier).includes.includes('BRANDING') ? 'Branding add-on: the school\'s colours and logo on the portal, letters, receipts and report cards' : 'Standard platform look (the branding add-on adds the school\'s colours and templates)'] });
  }
  if (code === 'APP') {
    const branded = !!o.addons?.BRANDED_APP;
    const ctx = linkCtx(db, project);
    const roles = Object.keys(RECOMMENDED).map((r) => [r, Object.keys(RECOMMENDED[r]).filter((c) => PHONE_READY[c] && tenant.overrides[c] !== false).map((c) => PHONE_READY[c][0]).join(', ')]);
    S.push(intro,
      { h: 'Which app', p: branded ? `Branded app: the school's own app in both stores, built from the shared code, published under our developer accounts in the school's name (or the school's own accounts if it prefers).` : `Shared app: parents and staff install “${prof.product}” and enter the school code ${tenant.code} once. No store work is needed for the school; the links below are for the shared app.` },
      { h: 'Identifiers', table: { cols: ['', 'Android', 'iOS'], rows: [['App name', branded ? o.client.replace(/\s*\(example\)$/, '') : prof.product, branded ? o.client.replace(/\s*\(example\)$/, '') : prof.product], ['Package / bundle ID', ctx.bundle, ctx.bundle], ['School code', tenant.code, tenant.code], ['Version', project.version, project.version]] } },
      { h: 'Store links', table: { cols: ['Link', 'Address', 'Status'], rows: ['PLAY_TEST', 'PLAY', 'TESTFLIGHT', 'APPSTORE', 'PRIVACY', 'DELETE'].map((c) => [link(c).label, link(c).url, link(c).status]) } },
      { h: 'Screens in the app, by role', table: { cols: ['Role', 'Tabs'], rows: roles.map(([r, t]) => [r.replace('_', ' ').toLowerCase().replace(/^./, (x) => x.toUpperCase()), t || 'Website only']) } },
      { h: 'Store requirements', bullets: ['Google Play: organisation developer account (D-U-N-S number), target API 36, data safety form, content rating, internal testing track before production', 'Apple: organisation developer account, privacy manifest, App Privacy answers, TestFlight testing before review', 'Account deletion inside the app and on the web (links above)', 'Privacy policy page (link above)', 'Push notifications with permission; no tracking'] },
      ...(branded ? [{ h: 'Assets from the school (branded app)', bullets: ['App icon 1024 × 1024 PNG, no transparency', 'Feature graphic 1024 × 500 (Google Play)', 'Screenshots: phone 1080 × 1920 (Play) and 6.7" 1290 × 2796 (Apple), at least 3 each — we can produce these from the test build', 'Short description (80 characters) and full description', 'Support email and phone'] }] : []));
  }
  if (code === 'HOSTING') {
    const h = rc.hosting.find((x) => x.code === (o.hosting || 'SHARED'));
    S.push(intro,
      { h: 'Hosting option', p: `${h.name}${h.note ? ' — ' + h.note : ''}. Region ap-south-1 (Mumbai); data stays in India.` },
      { h: 'Environments', table: { cols: ['Environment', 'Address', 'Who deploys', 'Status'], rows: [['Development', link('WEB_DEV').url, 'Automatically on every change', link('WEB_DEV').status], ['Pre-production', link('WEB_PREPROD').url, 'After our reviewer approves; the school tests here', link('WEB_PREPROD').status], ['Production', link('WEB_PROD').url, 'After a second approval', link('WEB_PROD').status]] } },
      { h: 'AWS', table: { cols: ['Part', 'Address', 'Status'], rows: ['AWS_STACK', 'AWS_CDN', 'AWS_DB'].map((c) => [link(c).label, link(c).url, link(c).status]) } },
      { h: 'Services', bullets: ['S3 and CloudFront for the web app, with HTTPS (ACM certificate) and security headers', 'API on ECS Fargate behind an application load balancer', `Aurora PostgreSQL${o.hosting === 'SHARED' || !o.hosting ? ' (shared cluster, the school\'s rows separated by row-level security)' : ' (dedicated to the school)'}, RDS Proxy and a read replica for reports`, 'Cognito sign-in (one user pool for the school), SES email, SMS through a DLT-registered gateway', 'Secrets in AWS Secrets Manager; nothing secret in the app or the database', tierOf(rc, o.tier).includes.includes('BACKUP') || o.addons?.BACKUP ? 'Backups add-on: nightly backups kept 30 days, copied to a second region in India' : 'Standard AWS backups (7 days)'] },
      { h: 'DNS records the school adds', table: { cols: ['Name', 'Type', 'Points to'], rows: [[`www.<school-domain>`, 'CNAME', link('AWS_CDN').url.replace('https://', '').replace(/\/$/, '')], [`portal.<school-domain> (optional)`, 'CNAME', `${tenant.subdomain}.yourapp.com`]] } });
  }
  if (code === 'DATA') {
    const needs = TEMPLATES.filter((t) => !(/Transport|Stop|Fleet/.test(t.name) && tenant.overrides.TRANSPORT === false) && !(/Question_Bank/.test(t.name) && tenant.overrides.EXM_QB === false) && !(/Salary/.test(t.name) && tenant.overrides.PAYROLL === false));
    S.push(intro,
      { h: 'Templates to fill', p: 'Download the templates in the app (Operations → Data Import → Templates). Fill them in number order and name each file NN_Name_Data_' + tenant.code + '_<YYYYMMDD>.xlsx.', table: { cols: ['No.', 'Template', 'For'], rows: needs.map((t) => [String(t.no).padStart(2, '0'), t.name + '_Data', t.menu]) } },
      { h: 'Steps', bullets: ['We send the templates with this plan', 'The school fills them and returns them by the date in the timeline', 'We load them to pre-production; every load can be rolled back', 'The school checks a sample of records in customer testing', 'Signed-off data is loaded to production at go-live'] });
  }
  if (code === 'UAT') {
    const steps = [['Sign in as the Admin and open the Main menu', 'Every menu bought is there; nothing else'], ['Students: open a student profile with photo', 'Details, attendance and fees show'], ['Admissions: add an enquiry and move it to Enrolled', 'The student is created'], ['Attendance: mark today for one class', 'The register saves'], ['Fees: collect a fee and print the receipt', 'Receipt in the school format'], ['Exams: open report cards for one class', 'Marks and grades show'], ['Timetable and calendar: open both', 'Periods and events show'], ['Parent: sign in on the phone preview', 'Child, fees and notices show']];
    off.inTier.concat(off.chosen).forEach((a) => { const first = (a.menus || [])[0]; if (first && LABEL[first]) steps.push([`${a.name}: open ${LABEL[first]}`, 'The screen opens and works with the demo data']); else if (a.functions?.length) steps.push([`${a.name}`, 'The function shows where described in the user guide']); });
    S.push(intro,
      { h: 'Where to test', table: { cols: ['Link', 'Address', 'Version'], rows: ['TEST_BUILD', 'TEST_SITE', 'TEST_APP', 'REQ_DOC', 'TEST_GUIDE', 'WEB_PREPROD'].map((c) => [link(c).label, link(c).url, link(c).version]) } },
      { h: 'How to sign in', p: 'The test build opens as the school Admin. Use Switch user → Demo quick access to try the other roles (Principal, Teacher, Parent, Accountant, Front office, Transport). Data stays in your browser; Reset demo data starts over.' },
      { h: 'Tests', table: { cols: ['#', 'Do', 'You should see', 'Pass / fail'], rows: steps.map(([d, s], i) => [String(i + 1), d, s, '']) } },
      { h: 'Sign-off', table: { cols: ['', 'Name', 'Date', 'Signature'], rows: [['For the school', o.poc?.name || '', '', ''], ['For ' + prof.name, prof.contact, '', '']] } });
  }
  if (code === 'GOLIVE') {
    S.push(intro, { h: 'Before go-live', table: { cols: ['Item', 'Owner', 'Done'], rows: [['Customer testing signed off', 'School', ''], ['Data loaded to production and checked', 'Us + school', ''], ['Users created (staff from the staff record; parents register)', 'Us', ''], ['Domain DNS records added', 'School', ''], ['Production web app live with HTTPS', 'Us', link('WEB_PROD').status === 'Ready' ? 'Link ready' : ''], ['SMS sender ID and DLT templates approved', 'Us + school', o.addons?.SMS ? '' : 'Not bought'], ['Phone app available (shared app or branded app approved in both stores)', 'Us', ''], ['Staff training (2 sessions) and parent announcement sent', 'Us + school', ''], ['First invoice raised', 'Us', '']] } },
      { h: 'Go-live day', bullets: ['Switch the school to Live in the Platform Console', 'Send the parent and staff announcement with the app links', 'Our support line is staffed from 7 am for the first week'] });
  }
  if (code === 'LINKS') {
    S.push(intro, ...LINK_GROUPS.map((g) => ({ h: g, table: { cols: ['Link', 'Environment', 'Address', 'Version', 'Date', 'Status'], rows: project.links.filter((l) => l.group === g).map((x) => link(x.code)).map((l) => [l.label, l.env, l.url, l.version, dmy(l.date), l.status]) } })));
  }
  return { code, title, version: meta.version, date: meta.date, client: o.client, projectNo: project.no, sections: S };
}

// ---------------------------------------------------------------- Starter website page
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function websiteHtml(db, project) {
  const o = project.options;
  return siteHtml({ name: o.client.replace(/\s*\(example\)$/, ''), board: o.board, city: o.city, colour: db.theme?.color, product: db.provider?.profile?.product,
    branded: !!o.addons?.BRANDED_APP, ref: project.no, version: project.version, date: project.updated || project.created, code: (() => { const t = db.tenants.find((x) => x.id === project.tenantId); return t?.liveCode || t?.code; })(), link: (c) => project.links.find((l) => l.code === c)?.url || '#' });
}
// Release 16: the website of a UAT/demo or live school, from the set-up the school was built with (works in the customer's browser too)
export function tenantSiteHtml(db, tenant, base = '') {
  const d = tenant.delivery || {};
  const home = base.replace(/#.*$/, '');
  const own = { PORTAL: home + '#/s/HOME', ADMISSION: home + '#/p/apply', PRIVACY: home + '#/p/privacy', DELETE: home + '#/p/delete', ...(tenant.env === 'LIVE' ? {} : { PLAY: home + '#/p/mobile', APPSTORE: home + '#/p/mobile' }) };
  return siteHtml({ name: tenant.name, board: tenant.examBoard, colour: db.theme?.color, product: db.provider?.profile?.product, ref: d.projectNo || tenant.code, code: tenant.code, version: d.version || '1.0', date: d.date,
    link: (c) => d.links?.[c] && !isPlaceholder(d.links[c]) ? d.links[c] : own[c] || '#' });
}
function siteHtml({ name, board, city, colour: col, product, branded, ref, version, date, link, code }) {
  const o = { board, city, addons: { BRANDED_APP: branded } };
  const prof = { product };
  const project = { no: ref, version, updated: date, options: o };
  const real = (c) => !/<[^>]*>/.test(link(c)) && link(c) !== '#';
  const btn = (c, label, pri) => `<a class="btn${pri ? ' pri' : ''}" href="${real(c) ? esc(link(c)) : '#'}"${real(c) ? '' : ' aria-disabled="true" title="Link to be added"'}>${esc(label)}</a>`;
  const colour = col || '#1F4D3F';
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(name)}${o.city ? ' — ' + esc(o.city) : ''}</title>
<meta name="description" content="${esc(name)}, a ${esc(o.board || '')} school${o.city ? ' in ' + esc(o.city) : ''}. Admissions, parent portal and school app.">
<!-- Starter page generated for project ${esc(project.no)}, version ${esc(project.version)}, ${esc(dmy(project.updated || project.created))}. Replace the placeholder text with the school's own. -->
<style>
:root{--brand:${esc(colour)};--ink:#1d2a26;--muted:#5b6b66;--tint:#f2f6f4}
*{box-sizing:border-box}body{margin:0;font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--ink)}
header{display:flex;justify-content:space-between;align-items:center;padding:14px 6vw;border-bottom:1px solid #e5ebe8;position:sticky;top:0;background:#fff}
header b{font-size:18px}nav a{margin-left:18px;color:var(--ink);text-decoration:none}
.hero{padding:72px 6vw;background:var(--tint)}.hero h1{font-size:clamp(28px,5vw,46px);margin:0 0 12px;line-height:1.15}.hero p{max-width:640px;color:var(--muted);font-size:18px}
.btn{display:inline-block;padding:12px 20px;border-radius:8px;border:2px solid var(--brand);color:var(--brand);text-decoration:none;font-weight:600;margin:8px 10px 0 0}
.btn.pri{background:var(--brand);color:#fff}.btn[aria-disabled]{opacity:.55;cursor:not-allowed}
section{padding:56px 6vw}section h2{margin-top:0;font-size:28px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px}
.card{border:1px solid #e5ebe8;border-radius:12px;padding:20px}.card h3{margin:0 0 6px}
footer{padding:32px 6vw;background:var(--brand);color:#fff}footer a{color:#fff}
</style></head><body>
<header><b>${esc(name)}</b><nav aria-label="Main"><a href="#about">About</a><a href="#admissions">Admissions</a><a href="#parents">Parents</a><a href="#contact">Contact</a></nav></header>
<main>
<div class="hero"><h1>Welcome to ${esc(name)}</h1><p>A ${esc(o.board || '')} school${o.city ? ' in ' + esc(o.city) : ''}. [One line about the school's vision — to be written by the school.]</p>
${btn('ADMISSION', 'Admission enquiry', true)}${btn('PORTAL', 'Parent and staff sign-in')}</div>
<section id="about"><h2>About us</h2><p>[History, vision and leadership — to be written by the school.]</p></section>
<section id="admissions" style="background:var(--tint)"><h2>Admissions</h2><div class="grid">
<div class="card"><h3>1. Enquire</h3><p>Send an enquiry online; the office calls you back.</p></div>
<div class="card"><h3>2. Apply</h3><p>Complete the application with the child's documents.</p></div>
<div class="card"><h3>3. Join</h3><p>Accept the offer and pay the admission fee.</p></div></div>
${btn('ADMISSION', 'Start an enquiry', true)}</section>
<section id="parents"><h2>For parents</h2><p>Attendance, fees, homework, notices and requests to the school — on the website and in the phone app${project.options.addons?.BRANDED_APP ? '' : ` (install “${esc(prof.product || 'the school app')}” and enter the school code <b>${esc(code)}</b>)`}.</p>
${btn('PORTAL', 'Sign in')}${btn('PLAY', 'Get it on Google Play')}${btn('APPSTORE', 'Download on the App Store')}</section>
<section id="contact" style="background:var(--tint)"><h2>Contact</h2><p>[Address, phone, email and office hours — to be added.]</p></section>
</main>
<footer><p>© ${new Date().getFullYear()} ${esc(name)} · <a href="${real('PRIVACY') ? esc(link('PRIVACY')) : '#'}">Privacy policy</a> · <a href="${real('DELETE') ? esc(link('DELETE')) : '#'}">Delete an account</a></p></footer>
</body></html>`;
}

// ---------------------------------------------------------------- Convert a proposal into a client project
export function convertProposal(db, proposalId, by) {
  const rc = rcOf(db);
  const p = db.provider.proposals.find((x) => x.id === proposalId);
  if (!p) throw new Error('Proposal not found');
  const o = p.options;
  if (!String(o.client || '').trim()) throw new Error('The proposal needs the school name');
  const miss = proposalProblems(o);
  if (miss.length) throw new Error('The proposal needs ' + miss.join(', '));
  db.provider.projects = db.provider.projects || [];
  const existing = db.provider.projects.find((x) => x.proposalId === proposalId);
  if (existing) return existing;
  const name = o.client.replace(/\s*\(example\)$/, '');
  const taken = db.tenants.map((t) => t.code);
  let code = name.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3).padEnd(3, 'S'); let i = 2;
  while (taken.includes(code)) code = code.slice(0, 2) + i++;
  let sub = slug(name); let j = 2;
  while (db.tenants.some((t) => t.subdomain === sub)) sub = slug(name) + j++;
  const cfg = schoolConfig(rc, o);
  db.seq.client = (db.seq.client || 0) + 1;
  // Release 16: the client's UAT / demo school — basic menus plus every add-on agreed with the client, and the Project menu
  const tenant = { id: 'TC' + db.seq.client, code: code + '-UAT', liveCode: code, name: `${name} – ${ENV_NAME.UAT}`, schoolName: name, env: 'UAT', subdomain: 'uat-' + sub, liveSubdomain: sub,
    plan: APP_PLAN[o.tier] || 'GROWTH', status: 'Customer testing', overrides: cfg.overrides, examBoard: o.board || 'CBSE',
    mobile: { enabled: true, appStatus: cfg.branded ? 'Branded app (to build)' : 'Shared app' }, renews: '—', client: { proposalId } };
  db.tenants.push(tenant);
  db.seq.project = (db.seq.project || 0) + 1;
  const project = { id: 'CP' + db.seq.project, no: `CP-${todayIso().slice(0, 4)}-${String(db.seq.project).padStart(3, '0')}`, proposalId, proposalNo: p.no, tenantId: tenant.id, uatTenantId: tenant.id, liveTenantId: null,
    client: o.client, tierName: tierOf(rc, o.tier).name, options: structuredClone(o), optionsHash: optionsHash(o), version: '1.0', status: 'UAT / Demo', created: todayIso(), updated: todayIso(), by, shares: [], signoffs: [], live: null,
    release: { repo: (db.provider?.profile?.repo || DEFAULT_REPO).replace(/\/$/, ''), base: 'dev', branch: schoolBranch(sub), created: todayIso() },
    log: [{ at: new Date().toISOString(), by, what: `Converted from ${p.no}: UAT/demo school ${tenant.name} (${tenant.code}) set up; branch ${schoolBranch(sub)} from dev` }] };
  tenant.delivery = { projectNo: project.no, version: '1.0', date: todayIso(), branch: project.release.branch };
  refreshLinks(db, project, by);
  project.documents = DOC_TYPES.map(([c]) => ({ code: c, version: '1.0', date: todayIso() }));
  db.provider.projects.unshift(project);
  p.status = 'Won'; p.projectId = project.id; p.won = todayIso();
  return project;
}
// Every client school: the basic menus plus every add-on agreed with the client (included in the plan or bought), and the Project menu
export function schoolConfig(rc, o) {
  const cfg = demoConfig(rc, o);
  cfg.overrides = { ...cfg.overrides, PROJECT: true, PRJ_LINKS: true };
  return cfg;
}

// Release 16: client approval and signing → the live school (first sign-off), or the signed version applied to it (later sign-offs)
export function signOff(db, projectId, { signedBy, designation, date, reference }, by) {
  const project = db.provider.projects.find((x) => x.id === projectId);
  if (!project) throw new Error('Project not found');
  const who = String(signedBy || '').trim();
  if (!who) throw new Error('Enter who signed for the school');
  const on = String(date || todayIso());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(on) || isNaN(new Date(on + 'T00:00:00'))) throw new Error('Enter the date it was signed');
  if (on > todayIso()) throw new Error('The signing date can\'t be in the future');
  if (proposalChanged(db, project)) throw new Error('The proposal has changed — regenerate the UAT school first, so the client signs off what they tested');
  if (project.live && !project.live.pending) throw new Error(`Version ${project.version} is already signed off and live`);
  const uat = db.tenants.find((t) => t.id === project.uatTenantId || t.id === project.tenantId);
  const sign = { version: project.version, signedBy: who, designation: String(designation || '').trim(), date: on, reference: String(reference || '').trim(), by, at: new Date().toISOString() };
  project.signoffs = [sign, ...(project.signoffs || [])];
  const name = uat.schoolName || project.client.replace(/\s*\(example\)$/, '');
  let live = db.tenants.find((t) => t.id === project.liveTenantId);
  if (!live) {
    db.seq.client = (db.seq.client || 0) + 1;
    live = { id: 'TC' + db.seq.client, code: uat.liveCode || uat.code.replace(/-UAT$/, ''), name: `${name} – ${ENV_NAME.LIVE} (${dmy(on)})`, schoolName: name, env: 'LIVE', subdomain: uat.liveSubdomain || uat.subdomain.replace(/^uat-/, ''),
      plan: uat.plan, status: 'Onboarding', overrides: structuredClone(uat.overrides), examBoard: uat.examBoard, mobile: structuredClone(uat.mobile), renews: addDays(on, 365), client: { proposalId: project.proposalId } };
    db.tenants.push(live);
    project.liveTenantId = live.id;
  } else Object.assign(live, { plan: uat.plan, overrides: structuredClone(uat.overrides), examBoard: uat.examBoard });
  live.delivery = { projectNo: project.no, version: project.version, date: on, branch: project.release?.branch, signedBy: who };
  project.live = { version: project.version, date: on, pending: null };
  project.status = 'Signed off';
  refreshLinks(db, project, by);
  project.log.unshift({ at: new Date().toISOString(), by, what: `Signed off v${project.version} by ${who}${sign.designation ? ' (' + sign.designation + ')' : ''} on ${dmy(on)}${sign.reference ? ', ref ' + sign.reference : ''}: live school ${live.name} (${live.code}); tag ${live.subdomain}-v${project.version} on ${project.release?.branch}` });
  return project;
}
export function setProjectStatus(db, projectId, status, by) {
  const project = db.provider.projects.find((x) => x.id === projectId);
  if (!PROJECT_STATUS.includes(status)) throw new Error('Unknown status');
  if (status !== 'UAT / Demo' && !project.liveTenantId) throw new Error('Record the client\'s approval and signing first — that builds the live school');
  project.status = status;
  const live = db.tenants.find((t) => t.id === project.liveTenantId);
  if (live) live.status = status === 'Live' ? 'Active' : 'Onboarding';
  project.log.unshift({ at: new Date().toISOString(), by, what: 'Status: ' + status });
  return project;
}
// Release 16.2: switch add-ons on or off for one school (Service Provider › Add-ons for this School). The basic features stay on.
export function setSchoolAddons(db, tenantId, codes, by) {
  const rc = DEFAULT_RATE_CARD;
  const t = db.tenants.find((x) => x.id === tenantId);
  if (!t) throw new Error('School not found');
  const known = new Set(rc.addons.map((a) => a.code));
  let set = new Set([...codes].filter((c) => known.has(c)));
  rc.addons.forEach((a) => { if (a.needs && set.has(a.code) && !set.has(a.needs)) set.delete(a.code); });   // Timings needs Transport
  const before = new Set(t.delivery?.addons || []);
  const { overrides } = demoConfig({ ...rc, tiers: rc.tiers.map((x) => ({ ...x, includes: [] })) }, { tier: 'STARTER', addons: Object.fromEntries([...set].map((c) => [c, true])) });
  const keep = Object.fromEntries(['PROJECT', 'PRJ_LINKS', 'SP_ADDONS'].filter((k) => t.overrides?.[k]).map((k) => [k, true]));
  t.overrides = { ...overrides, ...keep };
  t.delivery = { ...(t.delivery || {}), builtAddons: t.delivery?.builtAddons || [...before], addons: [...set] };   // the last build stays recorded while menus change
  const added = [...set].filter((c) => !before.has(c)), removed = [...before].filter((c) => !set.has(c));
  const name = (c) => rc.addons.find((a) => a.code === c)?.name || c;
  if (added.length || removed.length) {
    t.delivery.addonLog = [{ at: new Date().toISOString(), by, added: added.map(name), removed: removed.map(name) }, ...(t.delivery.addonLog || [])].slice(0, 50);
  }
  return t;
}

// Release 16.3: Rebuild the app from the add-ons selected — a new version, with every output following it:
// menus and screens, phone tabs, requirements document, website, Project Links and the build file for the school's branch.
export const nextVersion = (v = '1.0') => { const [a, b] = String(v).split('.').map(Number); return `${a || 1}.${(b || 0) + 1}`; };
// Menus change as add-ons are ticked (setSchoolAddons); Rebuild turns what changed since the last build into the next version.
export const builtAddons = (t) => t.delivery?.builtAddons || t.delivery?.addons || [];
export function rebuildSchool(db, tenantId, codes, by) {
  const t = db.tenants.find((x) => x.id === tenantId);
  if (!t) throw new Error('School not found');
  if (codes) setSchoolAddons(db, tenantId, codes, by);
  const built = [...builtAddons(t)].sort().join();
  if (built === [...(t.delivery?.addons || [])].sort().join()) throw new Error('Nothing to rebuild — select or unselect an add-on first');
  const prev = new Set(builtAddons(t));
  const d = t.delivery;
  const version = nextVersion(d.version);
  const rc = DEFAULT_RATE_CARD;
  const menus = Object.entries(t.overrides).filter(([k, v]) => v && LABEL[k]).length;
  d.version = version; d.date = new Date().toISOString().slice(0, 10);
  const nm = (c) => rc.addons.find((a) => a.code === c)?.name || c;
  d.builds = [{ version, at: new Date().toISOString(), by, addons: d.addons.length, menus, added: d.addons.filter((c) => !prev.has(c)).map(nm), removed: [...prev].filter((c) => !d.addons.includes(c)).map(nm) }, ...(d.builds || [])].slice(0, 30);
  d.builtAddons = [...d.addons];
  const label = d.addons.length === rc.addons.length ? 'All features' : d.addons.length ? `Basic + ${d.addons.length} add-ons` : 'Basic';
  if (t.trial) Object.assign(t.trial, { version, tier: label });
  d.tier = label;
  const project = (db.provider?.projects || []).find((p) => [p.tenantId, p.uatTenantId, p.liveTenantId].includes(t.id));
  if (project) { project.version = version; project.updated = d.date; if (t.overrides.SP_ADDONS) project.tierName = label; refreshLinks(db, project, by); }
  return { tenant: t, version, addons: d.addons.map((c) => rc.addons.find((a) => a.code === c)?.name || c), menus };
}
// The file that rebuilds and republishes this school's app for everyone (commit it as schools/<sub>/config.json)
export function rebuildConfig(t, base = {}) {
  const d = t.delivery || {};
  return { ...base, school: t.schoolName || t.name.replace(/ – .*$/, ''), version: d.version, addons: d.addons || [], addonsMenu: !!t.overrides?.SP_ADDONS, allAddons: false, built: d.date };
}

// The school's file on its branch (schools/<subdomain>/school.json): what the build for this school switches on
export function schoolFile(db, project) {
  const rc = rcOf(db);
  const uat = db.tenants.find((t) => t.id === project.uatTenantId || t.id === project.tenantId);
  const live = db.tenants.find((t) => t.id === project.liveTenantId);
  return { school: uat.schoolName || project.client, project: project.no, proposal: project.proposalNo, version: project.version, plan: project.tierName, board: uat.examBoard,
    addons: uat.delivery?.addons || activeAddons(rc, project.options), branch: project.release?.branch, base: project.release?.base || 'dev',
    uat: { code: uat.code, subdomain: uat.subdomain, name: uat.name },
    live: live ? { code: live.code, subdomain: live.subdomain, name: live.name, signedVersion: project.live?.version, signedOn: project.live?.date } : null,
    screens: Object.entries(uat.overrides).filter(([, v]) => v).map(([k]) => k).sort() };
}

// The proposal changed after conversion: bring the school, documents and links up to date as a new version
export function proposalChanged(db, project) {
  const p = db.provider.proposals.find((x) => x.id === project.proposalId);
  return !!p && optionsHash(p.options) !== project.optionsHash;
}
export function regenerate(db, projectId, by) {
  const rc = rcOf(db);
  const project = db.provider.projects.find((x) => x.id === projectId);
  const p = db.provider.proposals.find((x) => x.id === project.proposalId);
  project.options = structuredClone(p.options); project.optionsHash = optionsHash(p.options);
  project.client = p.options.client; project.tierName = tierOf(rc, p.options.tier).name;
  project.version = bumpVersion(project.version); project.updated = todayIso();
  const t = db.tenants.find((x) => x.id === project.tenantId);
  const cfg = schoolConfig(rc, p.options);
  Object.assign(t, { overrides: cfg.overrides, plan: APP_PLAN[p.options.tier] || t.plan });
  if (t.delivery) Object.assign(t.delivery, { version: project.version, date: todayIso() });
  // The live school changes only after the client signs off this version
  if (project.live) project.live.pending = project.version;
  project.documents = DOC_TYPES.map(([c]) => ({ code: c, version: project.version, date: todayIso() }));
  refreshLinks(db, project, by);
  project.log.unshift({ at: new Date().toISOString(), by, what: `Version ${project.version}: documents and links regenerated from ${p.no}` });
  return project;
}
// Share links and documents with the customer: an email to the point of contact; shared links are marked with the date
export function shareWithCustomer(db, projectId, { to, cc, linkCodes, docCodes, message }, by) {
  const project = db.provider.projects.find((x) => x.id === projectId);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(to || '').trim())) throw new Error('Enter the customer\'s email ID');
  const links = project.links.filter((l) => linkCodes.includes(l.code));
  if (links.some((l) => l.status === 'Placeholder')) throw new Error('Placeholder links can\'t be shared — fill them in first');
  if (!links.length && !docCodes.length) throw new Error('Pick at least one link or document');
  const docs = DOC_TYPES.filter(([c]) => docCodes.includes(c));
  const prof = db.provider?.profile || {};
  const body = `<p>${String(message || '').replace(/</g, '&lt;').replace(/\n/g, '<br>')}</p>` +
    (links.length ? `<p><b>Links (version ${project.version})</b></p><ul>${links.map((l) => `<li>${l.label} — ${l.env}: <a href="${l.url}">${l.url.length > 80 ? l.url.slice(0, 77) + '…' : l.url}</a> (v${l.version}, ${dmy(l.date)})</li>`).join('')}</ul>` : '') +
    (docs.length ? `<p><b>Documents attached (PDF, version ${project.version})</b></p><ul>${docs.map(([, t]) => `<li>${t}</li>`).join('')}</ul>` : '') +
    `<p>${prof.contact}, ${prof.name} · ${prof.phone} · ${prof.email}</p>`;
  db.outbox.unshift({ id: 'M' + (db.outbox.length + 1) + '-' + Math.random().toString(36).slice(2, 6), to: to + (cc ? `, cc ${cc}` : ''), kind: 'Client delivery', status: 'SENT', at: new Date().toISOString(), related: project.no,
    subject: `${project.client}: links and documents, version ${project.version}`, body, attachments: docs.map(([c]) => `${project.no}-${c}-v${project.version}.pdf`) });
  links.forEach((l) => { l.status = 'Shared'; l.sharedOn = todayIso(); });
  project.shares.unshift({ at: new Date().toISOString(), to, links: links.map((l) => l.code), docs: docCodes, version: project.version, by });
  project.log.unshift({ at: new Date().toISOString(), by, what: `Shared ${links.length} links and ${docs.length} documents with ${to}` });
  return project;
}
