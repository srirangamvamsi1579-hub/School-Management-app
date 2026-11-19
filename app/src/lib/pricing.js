// Service Provider → pricing. The rate card (plans, add-ons, hosting), a quote for one client's choices,
// and the app set-up (plan + switches) that a proposal turns into for a sales demo.
// Prices are in rupees, before GST. Defaults follow the Packaging, Pricing & Go-to-Market Plan (18 Nov 2026).
import { MENU, PLANS, FUNCTIONS, PROVIDER_MODULES } from '../data/menu.js';

export const GST = 18;

// Tiers. rank = app plan rank (Free runs on the Starter plan with some screens switched off).
export const DEFAULT_RATE_CARD = {
  version: 1,
  annualMonths: 11,               // annual plan paid up front = 11 months
  maxSalesDiscount: 10,           // sales can give this much; above needs owner approval
  maxDiscount: 20,                // never more than this
  plans: [
    { code: 'FREE', name: 'Free', appPlan: 'STARTER', rank: 1, cap: 100, flat: 0, setup: 0, support: 'FAQ and community' },
    { code: 'STARTER', name: 'Starter', appPlan: 'STARTER', rank: 1, cap: 250, flat: 1800, setup: 0, assistedSetup: 5000, support: 'Email, 2 working days' },
    { code: 'GROWTH', name: 'Growth', appPlan: 'GROWTH', rank: 2, cap: 500, perStudent: 10, min: 2500, setup: 10000, support: 'Email and phone, next day' },
    { code: 'PROFESSIONAL', name: 'Professional', appPlan: 'PROFESSIONAL', rank: 3, cap: 1000, perStudent: 9, min: 4500, setup: 25000, support: 'Named contact, same day' },
    { code: 'ENTERPRISE', name: 'Enterprise', appPlan: 'ENTERPRISE', rank: 4, cap: null, perStudent: 8, min: 8000, setup: 50000, support: 'Account manager, 4-hour priority' }
  ],
  // unit: student | bus | resident | flat. includedFrom: plan rank from which it costs nothing (null = always paid).
  // menus / functions: what the add-on switches on in the app (used by the Demo Builder).
  addons: [
    { code: 'SMS', name: 'SMS alerts and OTP (5 SMS per student a month)', unit: 'student', rate: 1.5, min: 500, setup: 2500, setupName: 'DLT sender ID and template setup', includedFrom: null, functions: ['FN_SMS_OTP'] },
    { code: 'TRANSPORT_BASIC', name: 'Transport Basic (routes, stops, riders, route sheets)', unit: 'bus', rate: 150, minQty: 2, includedFrom: null, menus: ['TRANSPORT'], functions: ['FN_ATTENDANT_TRACKING'] },
    { code: 'TRANSPORT_PLUS', name: 'Transport Plus (route planning and pickup suggestions)', unit: 'bus', rate: 350, minQty: 5, includedFrom: null, menus: ['TRANSPORT'], functions: ['FN_ATTENDANT_TRACKING', 'FN_ROUTE_PLANNING'] },
    { code: 'ANALYTICS', name: 'Data Analytics (Power BI reports)', unit: 'student', rate: 2, min: 1500, includedFrom: null, menus: ['ANALYTICS', 'STU_INS', 'STF_INS', 'FEE_INS'] },
    { code: 'QBANK', name: 'Question Bank & Papers', unit: 'student', rate: 1, min: 750, includedFrom: 3, menus: ['EXM_QP', 'EXM_APPROVED', 'EXM_QB', 'EXM_FORMATS'] },
    { code: 'PAYROLL', name: 'Payroll', unit: 'flat', rate: 500, includedFrom: 2, menus: ['PAYROLL'] },
    { code: 'LIBRARY', name: 'Library', unit: 'student', rate: 0.5, min: 300, includedFrom: 2, menus: ['CMP_LIBRARY'] },
    { code: 'LEARNING', name: 'Online Classes (homework is in every plan)', unit: 'student', rate: 1, min: 500, includedFrom: 2, menus: ['CMP_CLASSES'] },
    { code: 'INVENTORY', name: 'Inventory & Store', unit: 'flat', rate: 500, includedFrom: 3, menus: ['CMP_INVENTORY'] },
    { code: 'HOSTEL', name: 'Hostel (per resident)', unit: 'resident', rate: 15, min: 1000, includedFrom: 4, menus: ['CMP_HOSTEL'] },
    { code: 'BRANDED_APP', name: 'Branded app in the stores', unit: 'flat', rate: 1500, setup: 40000, setupName: 'Branded app setup and store listing', includedFrom: null }
  ],
  hosting: [
    { code: 'SHARED', name: 'Shared AWS, Mumbai', setup: 0, monthly: 0 },
    { code: 'DEDICATED_DB', name: 'Dedicated database on AWS', setup: 15000, monthly: 8000 },
    { code: 'DEDICATED_STACK', name: 'Dedicated AWS stack', setup: 50000, monthly: 25000, note: 'plus AWS usage at cost' },
    { code: 'NON_AWS', name: 'Non-AWS cloud (Azure, Google Cloud, Indian provider)', setup: 150000, monthly: 30000, note: 'quoted after a scoping call; cloud usage at cost', enterpriseOnly: true },
    { code: 'ON_PREM', name: "School's own server (on-premise)", setup: 150000, monthlyPct: 20, note: 'plan price plus 20% for remote maintenance', enterpriseOnly: true }
  ]
};

export const MESSAGING = [['APP', 'App notices only (no email, no SMS)'], ['EMAIL', 'Email and app'], ['SMS', 'SMS, email and app']];
export const TRANSPORT = [['NONE', 'No buses'], ['BASIC', 'Buses, records only (Transport Basic)'], ['PLUS', 'Large fleet with route planning (Transport Plus)']];
export const OPTIONAL = ['ANALYTICS', 'QBANK', 'PAYROLL', 'LIBRARY', 'LEARNING', 'INVENTORY', 'HOSTEL', 'BRANDED_APP'];

export const rupees = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
export const rateText = (r) => (r % 1 ? '₹' + r.toFixed(2) : rupees(r));
export const planOf = (rc, code) => rc.plans.find((p) => p.code === code);
export const addonOf = (rc, code) => rc.addons.find((a) => a.code === code);

// Smallest paid tier that fits the student count (Free only when asked for and it fits)
export function planFor(rc, students, { allowFree = false } = {}) {
  const fits = rc.plans.filter((p) => (allowFree || p.code !== 'FREE') && (p.cap === null || students <= p.cap));
  return fits[0] || rc.plans[rc.plans.length - 1];
}

export const blankOptions = (rc = DEFAULT_RATE_CARD) => ({
  client: '', city: '', board: 'CBSE', contact: '', students: 400, buses: 0, residents: 0,
  plan: planFor(rc, 400).code, messaging: 'EMAIL', transport: 'NONE', addons: {}, hosting: 'SHARED',
  billing: 'ANNUAL', discountPct: 0, interState: false, assisted: false
});

const round2 = (n) => Math.round(n * 100) / 100;

// A quote: recurring lines a month, one-time lines, totals, GST, warnings
export function quote(rc, o) {
  const plan = planOf(rc, o.plan);
  if (!plan) throw new Error('Unknown plan ' + o.plan);
  const students = Math.max(0, Math.round(+o.students || 0));
  const monthly = []; const oneTime = []; const warnings = [];
  if (plan.cap !== null && students > plan.cap) warnings.push(`${students} students is over the ${plan.name} limit of ${plan.cap}; ${planFor(rc, students).name} fits.`);

  // Plan line
  const planAmt = plan.flat !== undefined ? plan.flat : Math.max(students * plan.perStudent, plan.min || 0);
  monthly.push({ code: 'PLAN', label: `${plan.name} plan` + (plan.flat !== undefined ? (plan.flat ? ' (flat)' : '') : ` · ${students} students × ${rupees(plan.perStudent)}`) + (plan.min && students * plan.perStudent < plan.min ? ' (minimum)' : ''), amount: planAmt, discountable: true });
  if (plan.code === 'FREE' && (o.messaging === 'SMS' || o.transport !== 'NONE' || OPTIONAL.some((c) => o.addons?.[c]))) warnings.push('Add-ons need a paid plan: move this school to Starter.');

  const addLine = (a, qty, label) => {
    if (a.includedFrom !== null && plan.rank >= a.includedFrom && plan.code !== 'FREE') { monthly.push({ code: a.code, label: `${a.name} — included in ${plan.name}`, amount: 0, included: true }); return; }
    let amount;
    if (a.unit === 'flat') amount = a.rate;
    else {
      const q = Math.max(qty, a.minQty || 0);
      amount = Math.max(q * a.rate, a.min || 0);
      label = label || `${a.name} · ${q} ${a.unit === 'student' ? 'students' : a.unit === 'bus' ? 'buses' : 'residents'} × ${rateText(a.rate)}`;
      if (a.minQty && qty < a.minQty) label += ` (minimum ${a.minQty})`;
      else if (a.min && q * a.rate < a.min) label += ' (minimum)';
    }
    monthly.push({ code: a.code, label: label || a.name, amount: round2(amount), discountable: !['SMS', 'ANALYTICS'].includes(a.code) });
    if (a.setup) oneTime.push({ code: a.code + '_SETUP', label: a.setupName || a.name + ' setup', amount: a.setup });
  };

  if (o.messaging === 'SMS') addLine(addonOf(rc, 'SMS'), students);
  if (o.transport === 'BASIC') addLine(addonOf(rc, 'TRANSPORT_BASIC'), +o.buses || 0);
  if (o.transport === 'PLUS') addLine(addonOf(rc, 'TRANSPORT_PLUS'), +o.buses || 0);
  if (o.transport !== 'NONE' && !(+o.buses > 0)) warnings.push('Enter the number of buses.');
  for (const code of OPTIONAL) {
    if (!o.addons?.[code]) continue;
    const a = addonOf(rc, code);
    if (code === 'PAYROLL' && plan.rank >= 2) { monthly.push({ code, label: 'Payroll — included in ' + plan.name, amount: 0, included: true }); continue; }
    addLine(a, code === 'HOSTEL' ? (+o.residents || 0) : students);
    if (code === 'HOSTEL' && !(+o.residents > 0)) warnings.push('Enter the number of hostel residents.');
  }

  // Hosting
  const h = rc.hosting.find((x) => x.code === (o.hosting || 'SHARED'));
  if (h.enterpriseOnly && plan.code !== 'ENTERPRISE') warnings.push(`${h.name} is offered to Enterprise schools only.`);
  if (h.code !== 'SHARED') {
    const sub = monthly.reduce((s, l) => s + l.amount, 0);
    const amt = h.monthlyPct ? sub * h.monthlyPct / 100 : h.monthly;
    monthly.push({ code: 'HOSTING', label: `${h.name}${h.monthlyPct ? ` (${h.monthlyPct}% of the plan and add-ons)` : ''}${h.note && !h.monthlyPct ? ' — ' + h.note : ''}`, amount: round2(amt), discountable: false });
    if (h.setup) oneTime.push({ code: 'HOSTING_SETUP', label: h.name + ' setup', amount: h.setup });
  }

  // Onboarding
  const setup = plan.code === 'STARTER' && o.assisted ? plan.assistedSetup : plan.setup;
  if (setup) oneTime.unshift({ code: 'ONBOARDING', label: 'Onboarding, data migration and training', amount: setup });

  // Discount on discountable recurring lines
  let pct = Math.max(0, +o.discountPct || 0);
  if (pct > rc.maxDiscount) { warnings.push(`Discount capped at ${rc.maxDiscount}%.`); pct = rc.maxDiscount; }
  if (pct > rc.maxSalesDiscount) warnings.push(`A discount above ${rc.maxSalesDiscount}% needs the owner's approval.`);
  const discountable = monthly.filter((l) => l.discountable).reduce((s, l) => s + l.amount, 0);
  const discount = round2(discountable * pct / 100);
  if (discount) monthly.push({ code: 'DISCOUNT', label: `Discount ${pct}% (plan and add-ons, not SMS or analytics)`, amount: -discount });

  const monthlyTotal = round2(monthly.reduce((s, l) => s + l.amount, 0));
  const months = o.billing === 'MONTHLY' ? 12 : rc.annualMonths;
  const yearly = round2(monthlyTotal * months);
  const oneTimeTotal = oneTime.reduce((s, l) => s + l.amount, 0);
  const tax = (n) => round2(n * GST / 100);
  const firstInvoice = o.billing === 'MONTHLY' ? oneTimeTotal + monthlyTotal : oneTimeTotal + yearly;
  return {
    plan, students, monthly, oneTime, monthlyTotal, months, yearly, oneTimeTotal,
    firstInvoice, firstInvoiceGst: tax(firstInvoice), firstInvoiceTotal: round2(firstInvoice + tax(firstInvoice)),
    yearlyGst: tax(yearly), yearlyWithGst: round2(yearly + tax(yearly)),
    perStudentYear: students ? round2(yearly / students) : 0,
    gstSplit: o.interState ? [['IGST 18%', tax(firstInvoice)]] : [['CGST 9%', round2(tax(firstInvoice) / 2)], ['SGST 9%', round2(tax(firstInvoice) / 2)]],
    warnings
  };
}

// Screens the Free plan leaves out (it runs on the Starter plan)
export const FREE_OFF = ['STU_REPORTCARD', 'FEE_REQUESTS', 'FEE_MATCHING', 'FEE_DUES', 'ACCOUNTS', 'STF_ATT', 'STF_LEAVE', 'ACA_TIMETABLE', 'EXAMS', 'CMP_HOMEWORK', 'CMP_EVENTS'];

// What the app looks like for these choices: plan + module/sub-menu/function switches.
// Every priced option is set explicitly (on or off), so the demo shows exactly what the client is buying.
export function demoConfig(rc, o) {
  const plan = planOf(rc, o.plan);
  const overrides = {};
  const set = (codes = [], on) => codes.forEach((c) => { overrides[c] = on; });
  // Transport
  set(['TRANSPORT'], o.transport !== 'NONE');
  set(['FN_ATTENDANT_TRACKING'], o.transport !== 'NONE');
  set(['FN_ROUTE_PLANNING'], o.transport === 'PLUS');
  // Messaging
  set(['FN_SMS_OTP'], o.messaging === 'SMS');
  // Optional add-ons: on when chosen or included in the tier
  for (const code of OPTIONAL) {
    const a = addonOf(rc, code);
    if (!a.menus) continue;
    const included = a.includedFrom !== null && plan.rank >= a.includedFrom && plan.code !== 'FREE';
    set(a.menus, !!o.addons?.[code] || included);
  }
  if (plan.code === 'FREE') set(FREE_OFF, false);
  return { plan: plan.appPlan, overrides, mobile: true, branded: !!o.addons?.BRANDED_APP };
}

// Short code for a demo school from the client's name
export function demoCode(name, taken = []) {
  const base = (String(name).replace(/[^A-Za-z ]/g, '').split(/\s+/).filter(Boolean).map((w) => w[0]).join('').toUpperCase() || 'DEM').slice(0, 3).padEnd(3, 'X');
  let code = 'D' + base; let i = 2;
  while (taken.includes(code)) code = 'D' + base.slice(0, 2) + i++;
  return code;
}

// What the school gets for these choices: each main menu and the sub-menus switched on
export function featureList(rc, o, cfg = demoConfig(rc, o)) {
  const rank = PLANS.find((p) => p.code === cfg.plan).rank;
  const ov = cfg.overrides;
  const on = (code, min) => (ov[code] !== undefined ? ov[code] : rank >= min);
  return MENU.filter((m) => ![...PROVIDER_MODULES, 'VIEWAS', 'SELF'].includes(m.code))
    .map((m) => ({ code: m.code, label: m.label, on: ['OPERATIONS', 'SETTINGS'].includes(m.code) || on(m.code, m.min),
      items: m.items.filter((i) => i[0][0] !== '#').map((i) => ({ code: i[0], label: i[1], on: on(i[0], Math.max(i[2], m.min)) })) }))
    .map((m) => ({ ...m, items: m.on ? m.items : m.items.map((i) => ({ ...i, on: false })) }));
}
export function functionList(cfg) {
  const rank = PLANS.find((p) => p.code === cfg.plan).rank;
  return FUNCTIONS.map((f) => ({ ...f, on: cfg.overrides[f.code] !== undefined ? cfg.overrides[f.code] : f.minRank !== null && rank >= f.minRank }));
}
