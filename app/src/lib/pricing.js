// Service Provider → pricing (release 14). Three tiers (Starter, Pro, Pro+) priced per student a year in
// student bands, paid add-ons, one-time development (web page design, database set-up) and data storage.
// Nothing is free: every line has a price and a running cost, so each proposal shows its operating cost,
// gross margin against the SaaS industry standard, profit, and the most discount it can take.
// Prices are in rupees a year, before GST.
import { MENU, FUNCTIONS, PROVIDER_MODULES } from '../data/menu.js';

export const GST = 18;

// ---------------------------------------------------------------- What every tier includes
// [code, label, the screens it switches on]
export const BASIC = [
  ['ADMISSIONS', 'Admissions: enquiry to enrolment', ['STU_ADMISSIONS', 'STU_ADMIT', 'STU_DOCS']],
  ['RECORDS', 'Student and staff records, with photos', ['STU_LIST', 'STU_PROFILE', 'STF_LIST', 'ACA_CLASS', 'ACA_COORD', 'ACA_SYLLABUS']],
  ['ATTENDANCE', 'Roll call, staff attendance and leave', ['STU_ATT', 'STF_ATT', 'STF_LEAVE', 'SELF_LEAVE']],
  ['FEES', 'Fee structures, counter collection and receipts', ['FEE_STRUCT', 'FEE_COLLECT', 'FEE_RECEIPTS', 'FEE_DUES', 'FEE_CONC', 'FEE_MATCHING', 'ACC_BANK']],
  ['EXAMS', 'Exams, marks and report cards', ['STU_REPORTCARD', 'EXM_COSCH', 'EXM_PROFILE']],
  ['TIMETABLE', 'Timetable and school calendar', ['ACA_TIMETABLE', 'CMP_EVENTS']],
  ['NOTICES', 'Notices, phone app and parent portal', ['SELF_CHILD', 'SELF_REQUESTS', 'SELF_FEES', 'SELF_PROFILE', 'SELF_PREFS', 'STU_OFFICE', 'OPS_WEBSITE']],
  ['EMAIL', 'Basic email service (fee requests, receipts, alerts)', ['FEE_REQUESTS', 'OPS_OUTBOX']]
];
// Always there, whatever is bought: sign-in, users and roles, data import, help
export const ALWAYS = ['OPS_USERS', 'OPS_ROLES', 'OPS_IMPORT', 'OPS_HELPDOCS', 'HELP_GUIDE', 'HELP_FAQ'];

// ---------------------------------------------------------------- The price list
// Bands: the first 300 students at the first rate, the next 400 at the second, and so on (like tax slabs),
// so a school never pays less by adding a student. Schools under minStudents pay for minStudents.
export const DEFAULT_RATE_CARD = {
  version: 2,
  minStudents: 200,
  bands: [[1, 300], [301, 700], [701, 1500], [1501, null]],
  tiers: [
    { code: 'STARTER', name: 'Starter', tagline: 'The office and classroom basics, working from day one.', rates: [280, 250, 220, 190], runCost: 50,
      support: 'Email support, reply in 2 working days', includes: [] },
    { code: 'PRO', name: 'Pro', tagline: 'Dashboards, desks and homework: the school runs from one screen.', pick: true, rates: [420, 380, 340, 300], runCost: 65,
      support: 'Email and phone, next working day', includes: ['DASHBOARD', 'DESKS', 'BRANDING', 'HOMEWORK', 'QBANK', 'WHATSAPP', 'BACKUP'] },
    { code: 'PRO_PLUS', name: 'Pro+', tagline: 'Buses on the map, boards in exams, learning plans and portfolios.', rates: [600, 540, 480, 420], runCost: 85,
      support: 'Named contact, same day; priority onboarding', includes: ['DASHBOARD', 'DESKS', 'BRANDING', 'HOMEWORK', 'QBANK', 'WHATSAPP', 'BACKUP', 'TRANSPORT', 'TIMINGS', 'CHANNELS', 'BOARD', 'LMS', 'PORTFOLIO', 'ANALYTICS', 'PAYROLL'] }
  ],
  // Data storage: database, photos and documents, per student a year (every school pays it)
  storage: { name: 'Database and data storage (records, photos, documents)', rate: 12, min: 3000, cost: 6 },
  // One-time development, by tier. cost = our people's time.
  development: [
    { code: 'WEB_DESIGN', name: 'Web page design: school website, parent portal and admission pages in the school\'s look', price: { STARTER: 20000, PRO: 30000, PRO_PLUS: 45000 }, costPct: 60 },
    { code: 'DB_SETUP', name: 'Database set-up and data migration (students, staff, fees, past records)', price: { STARTER: 10000, PRO: 15000, PRO_PLUS: 25000 }, costPct: 60 }
  ],
  // unit: student | bus | resident | school. rate and min a year; cost = our running cost per unit a year.
  // provider: the outside service it needs (cost passed on), or 'No service needed'.
  addons: [
    { code: 'DASHBOARD', group: 'Screens', name: 'Dashboard menu', desc: 'What changed this month, alerts and to-dos on the first screen', unit: 'student', rate: 20, min: 5000, cost: 3, menus: ['DASH'] },
    { code: 'DESKS', group: 'Screens', name: 'Students desks: Coordinator Desk, Gate Desk, Parent Meetings', desc: 'Approvals by class coordinators, gate passes and early pick-ups, parent meeting bookings', unit: 'student', rate: 30, min: 7500, cost: 5, menus: ['STU_REQUESTS', 'STU_GATE', 'STU_MEETINGS'] },
    { code: 'BRANDING', group: 'Screens', name: 'Templates, appearance and branding', desc: 'School colours and logo, editable letters, receipts and report card templates', unit: 'school', rate: 12000, cost: 1500, setup: 10000, setupName: 'Branding set-up (colours, logo, templates)', menus: ['OPS_TEMPLATES', 'OPS_APPEARANCE'], functions: ['FN_CUSTOM_TEMPLATES'] },
    { code: 'CHANNELS', group: 'Screens', name: 'Web and app screens', desc: 'Choose, for each role, which screens show on the website and which in the phone app', unit: 'school', rate: 10000, cost: 1000, menus: ['OPS_CHANNELS'] },
    { code: 'BACKUP', group: 'Data', name: 'Backups and restore', desc: 'Daily automatic backups kept 30 days, backup on demand, restore from a backup file', unit: 'student', rate: 10, min: 3000, cost: 4, menus: ['OPS_BACKUP'] },
    { code: 'TRANSPORT', group: 'Transport', name: 'Transport routes and route map', desc: 'Routes, stops, riders, bus manifest, driver sheets, route map and route planning', unit: 'bus', rate: 3000, minQty: 2, cost: 400, menus: ['TRN_MANIFEST', 'TRN_SHEETS', 'TRN_CHANGES', 'TRN_ROUTES', 'ANL_TRANSPORT'], functions: ['FN_ATTENDANT_TRACKING', 'FN_ROUTE_PLANNING'] },
    { code: 'TIMINGS', group: 'Transport', name: 'Timings', desc: 'Stop times worked out from the route and edited by the transport team; shown on drivers\' sheets', unit: 'bus', rate: 1000, minQty: 2, cost: 100, needs: 'TRANSPORT', functions: ['FN_STOP_TIMINGS'] },
    { code: 'WHATSAPP', group: 'Messages', name: 'WhatsApp messages', desc: 'Send dues reminders and notices from the school phone to the parent\'s WhatsApp', unit: 'school', rate: 6000, cost: 0, provider: 'No service needed', providerNote: 'Phone to phone (WhatsApp click-to-chat), not sent through the app or website, so there is no provider cost', functions: ['FN_WHATSAPP'] },
    { code: 'SMS', group: 'Messages', name: 'SMS alerts and OTP', desc: '5 SMS per student a month: OTP, absence and dues alerts', unit: 'student', rate: 18, min: 6000, cost: 15, provider: 'SMS gateway (DLT registered)', setup: 2500, setupName: 'DLT sender ID and template set-up', noDiscount: true, menus: ['OPS_SMS'], functions: ['FN_SMS_OTP'] },
    { code: 'BOARD', group: 'Academics', name: 'Board integration', desc: 'Pick the exam board (CBSE, ICSE, State board, IB, Cambridge) in the Exams menu; grades and report formats follow it', unit: 'student', rate: 15, min: 4000, cost: 2, functions: ['FN_BOARD'] },
    { code: 'HOMEWORK', group: 'Academics', name: 'Homework and assignments', desc: 'Set homework and assignments; parents see them with their child\'s status', unit: 'student', rate: 15, min: 4000, cost: 3, menus: ['CMP_HOMEWORK'], inspired: true },
    { code: 'LMS', group: 'Academics', name: 'LMS: curriculum planning', desc: 'Units and weeks for each class and subject, and how much is taught', unit: 'student', rate: 25, min: 6000, cost: 4, menus: ['ACA_CURRICULUM'], inspired: true },
    { code: 'PORTFOLIO', group: 'Academics', name: 'Student portfolios', desc: 'Best work, projects and teacher comments for each student, shared with parents', unit: 'student', rate: 20, min: 5000, cost: 6, menus: ['STU_PORTFOLIO'], inspired: true },
    { code: 'QBANK', group: 'Academics', name: 'Question bank and papers', desc: 'Question bank, blueprints and ten-set question papers', unit: 'student', rate: 20, min: 5000, cost: 3, menus: ['EXM_QP', 'EXM_APPROVED', 'EXM_QB', 'EXM_FORMATS'] },
    { code: 'ONLINE', group: 'Academics', name: 'Online classes', desc: 'Schedule live classes with a meeting link', unit: 'student', rate: 15, min: 4000, cost: 4, menus: ['CMP_CLASSES'] },
    { code: 'ANALYTICS', group: 'Office', name: 'Data analytics (Power BI reports)', desc: 'Insights for students, staff and fees; report catalogue and performance', unit: 'student', rate: 30, min: 9000, cost: 10, menus: ['ANL_HOME', 'ANL_RANK', 'ANL_TEACHER', 'ANL_ADMISSIONS', 'STU_INS', 'STF_INS', 'FEE_INS', 'SELF_MYPERF'] },
    { code: 'PAYROLL', group: 'Office', name: 'Payroll', desc: 'Run payroll, payslips for staff', unit: 'school', rate: 9000, cost: 900, menus: ['PAY_RUN', 'PAY_SLIPS', 'SELF_PAYSLIP'] },
    { code: 'ACCOUNTS', group: 'Office', name: 'Accounts', desc: 'Account statement, income and expenses', unit: 'school', rate: 9000, cost: 900, menus: ['ACC_STMT', 'ACC_EXP'] },
    { code: 'LIBRARY', group: 'Campus', name: 'Library', desc: 'Books, issue and return, overdue fines', unit: 'student', rate: 8, min: 3000, cost: 1, menus: ['CMP_LIBRARY'] },
    { code: 'INVENTORY', group: 'Campus', name: 'Inventory and store', desc: 'Uniform and stationery stock and sales', unit: 'school', rate: 8000, cost: 800, menus: ['CMP_INVENTORY'] },
    { code: 'HOSTEL', group: 'Campus', name: 'Hostel', desc: 'Blocks, rooms, beds and hostel fees', unit: 'resident', rate: 180, min: 12000, cost: 20, menus: ['CMP_HOSTEL'] },
    { code: 'BRANDED_APP', group: 'Campus', name: 'Branded app in the stores', desc: 'The school\'s own app in Google Play and the App Store', unit: 'school', rate: 18000, cost: 8500, provider: 'Apple and Google developer accounts', setup: 40000, setupName: 'Branded app set-up and store listing' }
  ],
  hosting: [
    { code: 'SHARED', name: 'Shared AWS, Mumbai (data kept in India)', setup: 0, yearly: 0 },
    { code: 'DEDICATED_DB', name: 'Dedicated database on AWS', setup: 15000, yearly: 96000, costPct: 70 },
    { code: 'DEDICATED_STACK', name: 'Dedicated AWS stack', setup: 50000, yearly: 300000, costPct: 75, note: 'plus AWS usage at cost' },
    { code: 'ON_PREM', name: "School's own server (on-premise)", setup: 150000, pct: 20, costPct: 50, note: '20% of the subscription a year for remote maintenance' }
  ],
  // How the business runs: overheads as % of the list price, the SaaS gross-margin band, and the profit we keep
  economics: { overheads: { sales: 25, development: 15, admin: 10 }, industryMargin: [70, 80], profitFloor: 15 },
  salesDiscount: 10,     // sales can give this much; above needs the owner's approval
  maxDiscount: 20        // never more than this, whatever the margin
};

export const OVERHEAD_NAMES = { sales: 'Sales and marketing', development: 'Product development', admin: 'Administration and finance' };
export const UNIT = { student: 'student', bus: 'bus', resident: 'hostel resident', school: 'school' };

export const rupees = (n) => (n < 0 ? '−' : '') + '₹' + Math.round(Math.abs(n)).toLocaleString('en-IN');
export const pct = (n) => (Math.round(n * 10) / 10).toString().replace(/\.0$/, '') + '%';
export const tierOf = (rc, code) => rc.tiers.find((t) => t.code === code) || rc.tiers[0];
export const addonOf = (rc, code) => rc.addons.find((a) => a.code === code);
export const bandLabel = ([from, to]) => (to ? `${from.toLocaleString('en-IN')}–${to.toLocaleString('en-IN')}` : `${from.toLocaleString('en-IN')}+`);
export const included = (rc, tierCode, code) => tierOf(rc, tierCode).includes.includes(code);
export const rateText = (a) => (a.unit === 'school' ? `${rupees(a.rate)} a year` : `${rupees(a.rate)} per ${UNIT[a.unit]} a year${a.min ? `, minimum ${rupees(a.min)}` : ''}${a.minQty ? `, minimum ${a.minQty} buses` : ''}`);

// Tier price for a number of students, by band
export function tierPrice(rc, tierCode, students) {
  const t = tierOf(rc, tierCode);
  const billed = Math.max(rc.minStudents, Math.round(+students || 0));
  const bands = [];
  rc.bands.forEach(([from, to], i) => {
    const qty = Math.max(0, Math.min(billed, to ?? Infinity) - from + 1);
    if (qty > 0) bands.push({ from, to, qty, rate: t.rates[i], amount: qty * t.rates[i] });
  });
  return { billed, bands, amount: bands.reduce((s, b) => s + b.amount, 0) };
}
// Starting price of a tier: the minimum billed students
export const basePrice = (rc, tierCode) => tierPrice(rc, tierCode, rc.minStudents).amount;

const round2 = (n) => Math.round(n * 100) / 100;

export const blankOptions = (rc = DEFAULT_RATE_CARD) => ({
  client: '', city: '', board: 'CBSE', students: 400, buses: 0, residents: 0,
  poc: { name: '', designation: 'Principal', email: '', phone: '' },
  tier: (rc.tiers.find((t) => t.pick) || rc.tiers[0]).code, addons: {}, hosting: 'SHARED',
  discountPct: 0, interState: false, showInternal: true
});

// Add-ons that apply: chosen, or included in the tier. Timings only with Transport.
export function activeAddons(rc, o) {
  const t = tierOf(rc, o.tier);
  const on = rc.addons.filter((a) => t.includes.includes(a.code) || o.addons?.[a.code]).map((a) => a.code);
  return on.filter((c) => !addonOf(rc, c).needs || on.includes(addonOf(rc, c).needs));
}

function addonQty(a, o, students) {
  if (a.unit === 'student') return students;
  if (a.unit === 'bus') return Math.max(a.minQty || 0, +o.buses || 0);
  if (a.unit === 'resident') return +o.residents || 0;
  return 1;
}

// A quote: recurring lines a year, one-time lines, discount, GST, and the business case
export function quote(rc, o) {
  const tier = tierOf(rc, o.tier);
  const students = Math.max(0, Math.round(+o.students || 0));
  const tp = tierPrice(rc, tier.code, students);
  const warnings = [];
  const lines = [];        // recurring a year
  const oneTime = [];
  const runBasis = Math.max(students, rc.minStudents);
  // Development (one-time, every proposal)
  rc.development.forEach((d) => { const amt = d.price[tier.code]; oneTime.push({ code: d.code, label: d.name, amount: amt, cost: amt * d.costPct / 100 }); });

  lines.push({ code: 'TIER', label: `${tier.name} plan · ${tp.billed.toLocaleString('en-IN')} students${tp.billed > students ? ' (minimum billed)' : ''}`, amount: tp.amount, cost: runBasis * tier.runCost, discountable: true, bands: tp.bands });
  lines.push({ code: 'STORAGE', label: rc.storage.name, amount: Math.max(students * rc.storage.rate, rc.storage.min), cost: runBasis * rc.storage.cost, discountable: false });

  for (const a of rc.addons) {
    const inTier = tier.includes.includes(a.code);
    if (!inTier && !o.addons?.[a.code]) continue;
    if (a.needs && !activeAddons(rc, o).includes(a.code)) { warnings.push(`${a.name} needs ${addonOf(rc, a.needs).name}.`); continue; }
    const qty = addonQty(a, o, students);
    if (a.unit === 'resident' && !qty) warnings.push('Enter the number of hostel residents.');
    const price = a.unit === 'school' ? a.rate : Math.max(qty * a.rate, a.min || 0);
    const cost = (a.unit === 'school' ? 1 : qty) * a.cost;
    const qtyText = a.unit === 'school' ? '' : ` · ${qty.toLocaleString('en-IN')} ${UNIT[a.unit]}${qty === 1 ? '' : a.unit === 'bus' ? 'es' : 's'}`;
    lines.push({ code: a.code, label: a.name + qtyText, amount: inTier ? 0 : price, listValue: price, cost, included: inTier, discountable: !inTier && !a.noDiscount, provider: a.provider });
    if (a.setup && !inTier) oneTime.push({ code: a.code + '_SETUP', label: a.setupName, amount: a.setup, cost: a.setup * 0.6 });
    else if (a.setup && inTier) oneTime.push({ code: a.code + '_SETUP', label: a.setupName + ` (included in ${tier.name})`, amount: 0, cost: a.setup * 0.6, included: true });
  }

  // Hosting
  const h = rc.hosting.find((x) => x.code === (o.hosting || 'SHARED')) || rc.hosting[0];
  if (h.code !== 'SHARED') {
    const sub = lines.reduce((s, l) => s + l.amount, 0);
    const amt = h.pct ? sub * h.pct / 100 : h.yearly;
    lines.push({ code: 'HOSTING', label: h.name + (h.note ? ` (${h.note})` : ''), amount: round2(amt), cost: round2(amt * h.costPct / 100), discountable: false });
    if (h.setup) oneTime.push({ code: 'HOSTING_SETUP', label: h.name + ' set-up', amount: h.setup, cost: h.setup * 0.6 });
  }

  // Discount on the plan and add-ons (not storage, SMS or hosting, which are passed-on costs)
  const listTotal = round2(lines.reduce((s, l) => s + l.amount, 0));
  const discountable = lines.filter((l) => l.discountable).reduce((s, l) => s + l.amount, 0);
  const runningCost = round2(lines.reduce((s, l) => s + l.cost, 0));
  const ovPct = Object.values(rc.economics.overheads).reduce((s, v) => s + v, 0);
  const overheads = Object.fromEntries(Object.entries(rc.economics.overheads).map(([k, v]) => [k, round2(listTotal * v / 100)]));
  const overheadTotal = round2(listTotal * ovPct / 100);
  // Most discount that keeps profit at the floor: (1 − f)(L − dD) ≥ C + O  →  d ≤ (L − (C + O)/(1 − f)) / D
  const f = rc.economics.profitFloor / 100;
  const marginMax = discountable > 0 ? Math.max(0, (listTotal - (runningCost + overheadTotal) / (1 - f)) / discountable * 100) : 0;
  const maxDiscountPct = Math.floor(Math.min(rc.maxDiscount, marginMax) * 2) / 2;

  let d = Math.max(0, +o.discountPct || 0);
  if (d > maxDiscountPct) { warnings.push(`The most discount this proposal can take is ${pct(maxDiscountPct)} (keeps profit at ${rc.economics.profitFloor}%). Discount set to ${pct(maxDiscountPct)}.`); d = maxDiscountPct; }
  if (d > rc.salesDiscount) warnings.push(`A discount above ${rc.salesDiscount}% needs the owner's approval.`);
  const discount = round2(discountable * d / 100);

  const recurring = round2(listTotal - discount);
  const oneTimeTotal = oneTime.reduce((s, l) => s + l.amount, 0);
  const oneTimeCost = round2(oneTime.reduce((s, l) => s + l.cost, 0));
  const tax = (n) => round2(n * GST / 100);
  const yearOne = round2(recurring + oneTimeTotal);
  const grossMarginPct = recurring ? (recurring - runningCost) / recurring * 100 : 0;
  const operatingCost = round2(runningCost + overheadTotal);
  const profit = round2(recurring - operatingCost);
  const [lo, hi] = rc.economics.industryMargin;
  return {
    tier, students, billed: tp.billed, bands: tp.bands, lines, oneTime, listTotal, discountable, discountPct: d, discount, recurring, oneTimeTotal, yearOne,
    perStudentYear: students ? round2(recurring / students) : 0, monthly: round2(recurring / 12),
    yearOneGst: tax(yearOne), yearOneTotal: round2(yearOne + tax(yearOne)), recurringWithGst: round2(recurring + tax(recurring)),
    gstSplit: o.interState ? [['IGST 18%', tax(yearOne)]] : [['CGST 9%', round2(tax(yearOne) / 2)], ['SGST 9%', round2(tax(yearOne) / 2)]],
    economics: {
      revenue: recurring, runningCost, overheads, overheadTotal, operatingCost, profit, profitPct: recurring ? profit / recurring * 100 : 0,
      grossMarginPct, industry: [lo, hi], marginStatus: grossMarginPct >= lo ? (grossMarginPct > hi ? 'Above' : 'Within') : 'Below',
      oneTimeRevenue: oneTimeTotal, oneTimeCost, oneTimeProfit: round2(oneTimeTotal - oneTimeCost),
      maxDiscountPct, salesDiscount: rc.salesDiscount, profitFloor: rc.economics.profitFloor
    },
    warnings
  };
}

// What a year costs by school size (tier price + storage), like the price table on a pricing page
export const SIZES = [200, 400, 600, 1000, 2000];
export const yearCost = (rc, tierCode, n) => tierPrice(rc, tierCode, n).amount + Math.max(n * rc.storage.rate, rc.storage.min);

// The offering for a proposal: basic features, the tier's add-ons and the ones chosen
export function offering(rc, o) {
  const t = tierOf(rc, o.tier);
  const on = activeAddons(rc, o);
  return {
    basic: BASIC.map(([code, label]) => ({ code, label })),
    inTier: rc.addons.filter((a) => t.includes.includes(a.code) && on.includes(a.code)),
    chosen: rc.addons.filter((a) => !t.includes.includes(a.code) && on.includes(a.code))
  };
}

// ---------------------------------------------------------------- The demo school for a proposal
// Every screen and function is set on or off explicitly, so the demo shows exactly what is being sold.
export function demoConfig(rc, o) {
  const on = new Set([...ALWAYS, ...BASIC.flatMap((b) => b[2])]);
  const fns = new Set(['FN_SELF_SIGNUP', 'FN_CUSTOM_ROLES']);
  for (const code of activeAddons(rc, o)) { const a = addonOf(rc, code); (a.menus || []).forEach((m) => on.add(m)); (a.functions || []).forEach((f) => fns.add(f)); }
  const overrides = {};
  MENU.filter((m) => !PROVIDER_MODULES.includes(m.code) && m.code !== 'VIEWAS').forEach((m) => {
    const items = m.items.filter((i) => i[0][0] !== '#').map((i) => i[0]);
    items.forEach((c) => { overrides[c] = on.has(c); });
    overrides[m.code] = items.some((c) => on.has(c));
  });
  FUNCTIONS.forEach((f) => { overrides[f.code] = fns.has(f.code); });
  return { plan: 'ENTERPRISE', overrides, mobile: true, branded: !!o.addons?.BRANDED_APP };
}

// Short code for a demo school from the client's name
export function demoCode(name, taken = []) {
  const base = (String(name).replace(/[^A-Za-z ]/g, '').split(/\s+/).filter(Boolean).map((w) => w[0]).join('').toUpperCase() || 'DEM').slice(0, 3).padEnd(3, 'X');
  let code = 'D' + base; let i = 2;
  while (taken.includes(code)) code = 'D' + base.slice(0, 2) + i++;
  return code;
}

// Proposals saved before release 14 (Free/Starter/Growth/Professional/Enterprise) → the new shape
export function upgradeOptions(o) {
  if (o.poc && o.tier) return o;
  const tier = { FREE: 'STARTER', STARTER: 'STARTER', GROWTH: 'PRO', PROFESSIONAL: 'PRO', ENTERPRISE: 'PRO_PLUS' }[o.plan] || 'PRO';
  const map = { ANALYTICS: 'ANALYTICS', QBANK: 'QBANK', PAYROLL: 'PAYROLL', LIBRARY: 'LIBRARY', LEARNING: 'ONLINE', INVENTORY: 'INVENTORY', HOSTEL: 'HOSTEL', BRANDED_APP: 'BRANDED_APP' };
  const addons = {};
  Object.entries(o.addons || {}).forEach(([k, v]) => { if (v && map[k]) addons[map[k]] = true; });
  if (o.messaging === 'SMS') addons.SMS = true;
  if (o.transport && o.transport !== 'NONE') addons.TRANSPORT = true;
  if (o.transport === 'PLUS') addons.TIMINGS = true;
  return { client: o.client || '', city: o.city || '', board: o.board || 'CBSE', students: o.students || 400, buses: o.buses || 0, residents: o.residents || 0,
    poc: { name: '', designation: o.contact || 'Principal', email: '', phone: '' }, tier, addons, hosting: o.hosting === 'NON_AWS' ? 'DEDICATED_STACK' : (o.hosting || 'SHARED'),
    discountPct: +o.discountPct || 0, interState: !!o.interState, showInternal: true };
}
