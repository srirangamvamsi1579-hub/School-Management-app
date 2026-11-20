// Release 14 demo data (all fictional) and the upgrade of saved test data: the Starter / Pro / Pro+ price list,
// the service provider's profile, sample proposals with a point of contact, curriculum plans, portfolios,
// backup history and the exam board. Safe to run more than once.
import { ACCESS } from './menu.js';
import { DEFAULT_RATE_CARD, blankOptions, upgradeOptions } from '../lib/pricing.js';
import { departments, baseRoleOf } from '../lib/auth.js';

export const NEW_CODES_14 = ['ACA_CURRICULUM', 'STU_PORTFOLIO', 'OPS_BACKUP'];
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return iso(d); };

// The company selling the platform. Pre-filled in the Demo Builder and printed on every proposal.
export const DEFAULT_PROFILE = {
  name: 'YourApp School Systems (example)', product: 'YourApp School Platform', contact: 'Sales team', designation: 'Sales & marketing',
  email: 'sales@yourapp.example.com', phone: '+91 80000 00000', website: 'https://yourapp.example.com', city: 'Bengaluru, Karnataka',
  about: 'We build school software for Indian schools: admissions to report cards, fees, transport and a phone app for every parent. Your data stays in India, and our team sets the school up and trains your staff.'
};

const UNITS = {
  Mathematics: [['Rational numbers', 'Jun', 10], ['Linear equations in one variable', 'Jul', 12], ['Understanding quadrilaterals', 'Aug', 10], ['Data handling', 'Sep', 8], ['Squares and square roots', 'Oct', 10], ['Comparing quantities', 'Nov', 12], ['Algebraic expressions', 'Dec', 12], ['Mensuration', 'Jan', 12], ['Exponents and powers', 'Feb', 8]],
  Science: [['Crop production and management', 'Jun', 8], ['Microorganisms', 'Jul', 10], ['Coal and petroleum', 'Aug', 6], ['Combustion and flame', 'Sep', 8], ['Conservation of plants and animals', 'Oct', 8], ['Reproduction in animals', 'Nov', 10], ['Force and pressure', 'Dec', 10], ['Light', 'Jan', 10]],
  English: [['The best Christmas present in the world', 'Jun', 8], ['The tsunami', 'Jul', 8], ['Glimpses of the past', 'Aug', 10], ['Bepin Choudhury\'s lapse of memory', 'Sep', 8], ['The summit within', 'Oct', 8], ['This is Jody\'s fawn', 'Nov', 8], ['A visit to Cambridge', 'Dec', 8]]
};
const TAUGHT_TO = 'Nov';   // units up to October fully taught, November half

export function seedRelease14(db) {
  if (db.release >= 14) return db;
  const today = iso(new Date());
  db.seq = db.seq || {};

  // ---- Service Provider: profile, price list, proposals ----
  db.provider = db.provider || {};
  db.provider.profile = { ...DEFAULT_PROFILE, ...(db.provider.profile || {}) };
  db.provider.rateCard = structuredClone(DEFAULT_RATE_CARD);
  const samples = {
    PR1: { ...blankOptions(), client: 'Sample Public School (example)', city: 'Mysuru', board: 'CBSE', students: 400, buses: 4, tier: 'PRO', addons: { SMS: true, TRANSPORT: true }, discountPct: 5,
      poc: { name: 'Mrs. Lakshmi Iyer', designation: 'Principal', email: 'principal@samplepublic.example.com', phone: '+91 90000 11111' } },
    PR2: { ...blankOptions(), client: 'Example International Academy', city: 'Pune', board: 'IB / Cambridge', students: 2000, buses: 25, residents: 120, tier: 'PRO_PLUS', hosting: 'DEDICATED_DB', addons: { HOSTEL: true, BRANDED_APP: true, SMS: true, ACCOUNTS: true }, discountPct: 8,
      poc: { name: 'Mr. Arvind Kulkarni', designation: 'Trust secretary', email: 'secretary@exampleacademy.example.com', phone: '+91 90000 22222' } },
    PR3: { ...blankOptions(), client: 'Little Steps School (example)', city: 'Hubballi', board: 'State board', students: 180, tier: 'STARTER', addons: { WHATSAPP: true },
      poc: { name: 'Ms. Farida Shaikh', designation: 'Owner', email: 'owner@littlesteps.example.com', phone: '+91 90000 33333' } }
  };
  db.provider.proposals = (db.provider.proposals || []).map((p) => (samples[p.id] ? { ...p, options: samples[p.id] } : { ...p, options: upgradeOptions(p.options) }));
  if (!db.provider.proposals.length) db.provider.proposals = [
    { id: 'PR1', no: 'PROP-2026-001', status: 'Sent', created: addDays(today, -6), by: 'Sales team', options: samples.PR1 },
    { id: 'PR2', no: 'PROP-2026-002', status: 'Draft', created: addDays(today, -1), by: 'Sales team', options: samples.PR2 },
    { id: 'PR3', no: 'PROP-2026-003', status: 'Won', created: addDays(today, -20), by: 'Sales team', options: samples.PR3 }
  ];
  db.seq.proposal = Math.max(db.seq.proposal || 0, db.provider.proposals.length);
  // Demo schools made before release 14 point at their proposal by id; keep them, mark the tier name
  db.tenants.filter((t) => t.demo).forEach((t) => { t.demo.tier = { Growth: 'Pro', Professional: 'Pro', Enterprise: 'Pro+', Free: 'Starter' }[t.demo.tier] || t.demo.tier; });

  // ---- Exam board for the schools ----
  db.tenants.forEach((t) => { if (!t.examBoard) t.examBoard = t.id === 'T4' ? 'CAMBRIDGE' : 'CBSE'; });

  // ---- Curriculum plans: Grade VIII ----
  db.curriculum = [];
  let n = 0;
  const upto = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
  Object.entries(UNITS).forEach(([subject, list]) => list.forEach(([title, month, periods]) => {
    const i = upto.indexOf(month); const cut = upto.indexOf(TAUGHT_TO);
    const taught = i < cut ? periods : i === cut ? Math.floor(periods / 2) : 0;
    db.curriculum.push({ id: 'UN' + ++n, classId: 'C8', subject, title, month, periods, outcomes: '', taught, status: taught === 0 ? 'Planned' : taught >= periods ? 'Taught' : 'In progress', by: 'Ms. Sonia (SON)' });
  }));
  db.seq.unit = n;

  // ---- Portfolios: a few Grade VIII students, and the demo parent's child ----
  const active = db.students.filter((s) => s.status === 'Active');
  const parentKid = db.students.find((s) => db.guardians.find((g) => g.id === s.guardianId)?.name === 'Rohit Sharma');
  const kids = [...new Set([parentKid, ...active.filter((s) => s.sectionId === 'C8A').slice(0, 4)].filter(Boolean))];
  const ITEMS = [
    ['Science fair model: water filter', 'Project', 'Science', -40, 'Built a three-layer sand and charcoal filter and explained it clearly to the judges.'],
    ['Essay: my favourite festival', 'Work sample', 'English', -25, 'Well organised, with vivid description. Watch punctuation in long sentences.'],
    ['Reflection on Term 1', 'Reflection', '', -15, 'Sets two clear goals for Term 2: neater geometry and reading every day.'],
    ['Inter-house athletics: 100 m, second place', 'Sports', '', -8, '']
  ];
  db.portfolios = [];
  let pf = 0;
  kids.forEach((s, k) => ITEMS.slice(0, k === 0 ? 4 : 2).forEach(([title, kind, subject, days, note]) => {
    db.portfolios.push({ id: 'PF' + ++pf, studentId: s.id, title, kind, subject, date: addDays(today, days - k), note, shared: true, by: 'Ms. Sonia (SON)' });
  }));
  db.seq.portfolio = pf;

  // ---- Backups: the last week's nightly backups ----
  db.backup = { schedule: 'DAILY', time: '02:00', keepDays: 30, history: [] };
  for (let i = 0; i < 7; i++) { const d = new Date(); d.setDate(d.getDate() - i); d.setHours(2, 0, 0, 0); if (d > new Date()) continue; db.backup.history.push({ id: 'BK-A' + i, at: d.toISOString(), kind: 'Automatic', by: 'System', size: 1400000 + i * 3000, status: 'OK' }); }
  db.seq.backup = 0;

  // ---- Access: the new screens in every department's list ----
  Object.values(departments(db)).forEach(({ name, profiles }) => {
    if (!db.deptPerms?.[name]) return;
    const add = profiles.flatMap((p) => (ACCESS[baseRoleOf(db, p.code)] || []).filter((c) => NEW_CODES_14.includes(c)));
    db.deptPerms[name] = [...new Set([...db.deptPerms[name], ...add])];
  });
  if (db.perms) Object.keys(db.perms).forEach((r) => { db.perms[r] = [...new Set([...db.perms[r], ...(ACCESS[baseRoleOf(db, r)] || []).filter((c) => NEW_CODES_14.includes(c))])]; });
  db.release = 14;
  return db;
}
