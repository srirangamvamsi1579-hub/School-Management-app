// Menu tree, plan gating and default role access.
// Mirrors the database seed (menus, plan_features, role_menu_permissions) so the
// test app behaves like the real platform.

export const PLANS = [
  { code: 'STARTER', name: 'Starter', rank: 1, range: 'Up to 250 students', cap: 250 },
  { code: 'GROWTH', name: 'Growth', rank: 2, range: '251 – 500', cap: 500 },
  { code: 'PROFESSIONAL', name: 'Professional', rank: 3, range: '501 – 1,000', cap: 1000 },
  { code: 'ENTERPRISE', name: 'Enterprise', rank: 4, range: '1,000+', cap: null }
];

// Demo sign-in shortcuts (the real sign-in uses accounts — see lib/auth.js)
export const ROLES = [
  { code: 'ADMIN', name: 'Admin', user: 'Admin user' },
  { code: 'PRINCIPAL', name: 'Principal', user: 'Dr. Kavita Menon' },
  { code: 'ACCOUNTANT', name: 'Accountant', user: 'Sana Khan' },
  { code: 'TEACHER', name: 'Teacher', user: 'Ms. Sonia (SON)' },
  { code: 'FRONT_OFFICE', name: 'Front Office', user: 'Anita Rao' },
  { code: 'PARENT', name: 'Parent', user: 'Rohit Sharma' },
  { code: 'TRANSPORT', name: 'Transport team', user: 'Manjunath Gowda' },
  { code: 'PLATFORM', name: 'Platform team', user: 'Your company' }
];

// [code, label, minPlanRank, screen]  — '#' codes are section headings
export const MENU = [
  { code: 'DASHBOARD', label: 'Dashboard', icon: 'home', min: 1, items: [['DASH', 'Dashboard', 1]] },
  { code: 'STUDENTS', label: 'Students', icon: 'users', min: 1, items: [
    ['STU_INS', 'Insights', 2], ['STU_LIST', 'All Students', 1], ['STU_ADMISSIONS', 'Admissions & Enquiries', 1], ['STU_ADMIT', 'New Admission', 1], ['STU_ATT', 'Attendance', 1], ['STU_REQUESTS', 'Coordinator Desk', 1], ['STU_MEETINGS', 'Parent Meetings', 1], ['STU_OFFICE', 'Office Requests', 1], ['STU_GATE', 'Gate Desk', 1],
    ['STU_PROMOTE', 'Promote / Transfer', 2], ['STU_DOCS', 'Documents & ID Cards', 1]] },
  { code: 'STAFF', label: 'Staff', icon: 'brief', min: 1, items: [
    ['STF_INS', 'Insights', 2], ['STF_LIST', 'All Staff', 1], ['STF_ADD', 'Add Staff', 1], ['STF_ATT', 'Staff Attendance', 1], ['STF_LEAVE', 'Leave Requests', 1]] },
  { code: 'ACADEMICS', label: 'Academics', icon: 'book', min: 1, items: [
    ['ACA_CLASS', 'Classes & Sections', 1], ['ACA_COORD', 'Class Coordinators', 1], ['ACA_SYLLABUS', 'Boards, Syllabus & Textbooks', 1], ['ACA_TIMETABLE', 'Timetable', 1]] },
  { code: 'EXAMS', label: 'Exams', icon: 'exam', min: 1, items: [
    ['#P', 'Papers'], ['EXM_QP', 'Question Papers', 1], ['EXM_APPROVED', 'Approved Papers', 1], ['EXM_QB', 'Question Bank', 1], ['EXM_FORMATS', 'Paper Formats', 1],
    ['#C', 'Co-Scholastic'], ['EXM_COSCH', 'Co-Scholastic Grades', 1], ['#R', 'Reports'], ['EXM_PROFILE', 'Assessment Profiles', 1]] },
  { code: 'FEES', label: 'Fees', icon: 'receipt', min: 1, items: [
    ['FEE_INS', 'Insights', 2], ['FEE_COLLECT', 'Collect Fee', 1], ['FEE_REQUESTS', 'Fee Request Emails', 1], ['FEE_MATCHING', 'Payment Matching', 2],
    ['FEE_DUES', 'Dues & Reminders', 1], ['FEE_RECEIPTS', 'Receipts', 1], ['FEE_STRUCT', 'Fee Structure', 1], ['FEE_CONC', 'Concessions', 2]] },
  { code: 'TRANSPORT', label: 'Transport', icon: 'bus', min: 1, items: [
    ['TRN_MANIFEST', 'Daily Bus Manifest', 1], ['TRN_SHEETS', 'Driver Route Sheets', 1], ['TRN_CHANGES', 'Pickup & Drop Changes', 1], ['TRN_ROUTES', 'Routes, Stops & Timings', 1]] },
  { code: 'ANALYTICS', label: 'Data Analytics', icon: 'chart', min: 2, items: [
    ['ANL_HOME', 'Report Catalogue', 2], ['ANL_RANK', 'Top & Bottom Performers', 2], ['ANL_TRANSPORT', 'Transport Reports', 2], ['ANL_TEACHER', 'Teacher Performance', 2], ['ANL_ADMISSIONS', 'Admissions Funnel', 2]] },
  { code: 'PAYROLL', label: 'Payroll', icon: 'wallet', min: 2, items: [['PAY_RUN', 'Run Payroll', 2], ['PAY_SLIPS', 'Payslips', 2]] },
  { code: 'ACCOUNTS', label: 'Accounts', icon: 'chart', min: 1, items: [
    ['ACC_BANK', 'Bank & Payment Details', 1], ['ACC_STMT', 'Account Statement', 3], ['ACC_EXP', 'Income & Expenses', 3]] },
  { code: 'OPERATIONS', label: 'Operations', icon: 'shield', min: 1, items: [
    ['OPS_USERS', 'Users', 1], ['OPS_ROLES', 'Roles & Permissions', 1], ['OPS_TEMPLATES', 'Templates', 1], ['OPS_IMPORT', 'Data Import', 1],
    ['OPS_CHANNELS', 'Web & App Screens', 1], ['OPS_APPEARANCE', 'Appearance & Branding', 1], ['OPS_WEBSITE', 'Website & Links', 1], ['OPS_OUTBOX', 'Email & SMS Outbox', 1], ['OPS_SMS', 'SMS Gateway', 1]] },
  { code: 'SELF', label: 'My Space', icon: 'user', min: 1, items: [
    ['SELF_CHILD', 'My Child', 1], ['SELF_REQUESTS', 'Requests to School', 1], ['SELF_FEES', 'Fee Dues & Pay', 1], ['SELF_PAYSLIP', 'My Payslips', 2], ['SELF_MYPERF', 'My Teaching Performance', 2], ['SELF_PROFILE', 'My Account', 1], ['SELF_PREFS', 'My Preferences', 1]] },
  // Admin only: see the app as each profile sees it, without signing in as them
  { code: 'VIEWAS', label: 'View as Profile', icon: 'eye', min: 1, items: [['VA_PARENT', 'Parent', 1], ['VA_TEACHER', 'Teacher (class coordinator)', 1], ['VA_VP', 'Teacher + Vice Principal', 1], ['VA_HOTS', 'Teacher + Head of Teaching Staff', 1], ['VA_PRINCIPAL', 'Principal', 1], ['VA_ACCOUNTANT', 'Accountant', 1], ['VA_FRONT_OFFICE', 'Front Office', 1], ['VA_TRANSPORT', 'Transport team', 1]] },
  { code: 'PLATFORM', label: 'Platform Console', icon: 'cloud', min: 1, items: [['PLT_SCHOOLS', 'Schools & Plans', 1]] },
  { code: 'HELP', label: 'Help', icon: 'book', min: 1, items: [['HELP_GUIDE', 'User Guide & Demo', 1]] }
];

const ALL = MENU.flatMap((m) => m.items.map((i) => i[0])).filter((c) => c[0] !== '#');

export const ACCESS = {
  ADMIN: ALL.filter((c) => !['SELF_CHILD', 'SELF_FEES', 'SELF_REQUESTS', 'SELF_MYPERF', 'PLT_SCHOOLS'].includes(c)),
  PRINCIPAL: ['DASH', 'OPS_CHANNELS', 'HELP_GUIDE', 'STU_INS', 'STU_LIST', 'STU_ADMISSIONS', 'STU_ATT', 'STU_REQUESTS', 'STU_MEETINGS', 'STU_OFFICE', 'ACA_COORD', 'TRN_MANIFEST', 'TRN_SHEETS', 'TRN_CHANGES', 'TRN_ROUTES', 'SELF_PROFILE', 'ANL_HOME', 'ANL_RANK', 'ANL_TRANSPORT', 'ANL_TEACHER', 'ANL_ADMISSIONS', 'STF_INS', 'STF_LIST', 'STF_ATT', 'STF_LEAVE', 'ACA_CLASS', 'ACA_SYLLABUS', 'ACA_TIMETABLE',
    'EXM_QP', 'EXM_APPROVED', 'EXM_QB', 'EXM_FORMATS', 'EXM_COSCH', 'EXM_PROFILE', 'FEE_INS', 'FEE_REQUESTS', 'FEE_MATCHING', 'FEE_DUES', 'FEE_STRUCT', 'FEE_CONC',
    'PAY_RUN', 'PAY_SLIPS', 'ACC_BANK', 'ACC_STMT', 'ACC_EXP', 'OPS_TEMPLATES', 'SELF_PAYSLIP', 'SELF_PREFS'],
  ACCOUNTANT: ['HELP_GUIDE', 'DASH', 'STU_LIST', 'STF_LIST', 'SELF_PROFILE', 'ANL_HOME', 'ANL_TRANSPORT', 'FEE_INS', 'FEE_COLLECT', 'FEE_REQUESTS', 'FEE_MATCHING', 'FEE_DUES', 'FEE_RECEIPTS', 'FEE_STRUCT', 'FEE_CONC',
    'PAY_RUN', 'PAY_SLIPS', 'ACC_BANK', 'ACC_STMT', 'ACC_EXP', 'OPS_TEMPLATES', 'OPS_OUTBOX', 'SELF_PAYSLIP', 'SELF_PREFS'],
  TEACHER: ['HELP_GUIDE', 'DASH', 'STU_LIST', 'STU_ATT', 'STU_REQUESTS', 'STU_MEETINGS', 'ANL_RANK', 'SELF_PROFILE', 'STF_LEAVE', 'ACA_SYLLABUS', 'ACA_TIMETABLE', 'EXM_QP', 'EXM_APPROVED', 'EXM_QB', 'EXM_COSCH', 'EXM_PROFILE',
    'OPS_TEMPLATES', 'SELF_PAYSLIP', 'SELF_PREFS'],
  FRONT_OFFICE: ['HELP_GUIDE', 'DASH', 'STU_LIST', 'STU_GATE', 'STU_OFFICE', 'TRN_CHANGES', 'SELF_PROFILE', 'STU_ADMISSIONS', 'STU_ADMIT', 'ANL_ADMISSIONS', 'STU_DOCS', 'FEE_COLLECT', 'FEE_DUES', 'FEE_RECEIPTS', 'OPS_TEMPLATES', 'SELF_PAYSLIP', 'SELF_PREFS'],
  PARENT: ['HELP_GUIDE', 'DASH', 'ACA_TIMETABLE', 'SELF_CHILD', 'SELF_REQUESTS', 'SELF_FEES', 'SELF_PROFILE', 'SELF_PREFS'],
  TRANSPORT: ['HELP_GUIDE', 'TRN_MANIFEST', 'TRN_SHEETS', 'TRN_CHANGES', 'TRN_ROUTES', 'ANL_TRANSPORT', 'SELF_PROFILE', 'SELF_PREFS'],
  PLATFORM: ['PLT_SCHOOLS', 'OPS_CHANNELS', 'HELP_GUIDE']
};

export const MIN_RANK = Object.fromEntries(MENU.flatMap((m) => m.items.filter((i) => i[0][0] !== '#').map((i) => [i[0], Math.max(i[2], m.min)])));
export const MODULE_MIN = Object.fromEntries(MENU.map((m) => [m.code, m.min]));
export const LABEL = Object.fromEntries(MENU.flatMap((m) => m.items.map((i) => [i[0], i[1]])));
LABEL.HOME = 'Main menu';
export const MODULE_OF = Object.fromEntries(MENU.flatMap((m) => m.items.map((i) => [i[0], m.label])));

// Is this sub-menu switched on for the school (plan rank, add-ons, switched off) and allowed for the role?
export function canSee(code, role, rank, overrides = {}, perms = null) {
  const list = perms?.[role] || ACCESS[role] || [];
  if (!list.includes(code)) return false;
  const mod = MENU.find((m) => m.items.some((i) => i[0] === code));
  const modOn = overrides[mod.code] !== undefined ? overrides[mod.code] : rank >= mod.min;
  if (!modOn && role !== 'PLATFORM') return false;
  const on = overrides[code] !== undefined ? overrides[code] : rank >= (MIN_RANK[code] || 1);
  return on || role === 'PLATFORM';
}

// Functions inside modules (not menus). minRank = plan from which it is on by default; null = off unless
// the platform team switches it on for the school (Platform Console → Schools & Plans → Functions).
export const FUNCTIONS = [
  { code: 'FN_ATTENDANT_TRACKING', module: 'TRANSPORT', name: 'Bus attendant boarding tracking (Boarded / No-show)', minRank: null },
  { code: 'FN_SELF_SIGNUP', module: 'OPERATIONS', name: 'Self sign-up with Gmail or mobile', minRank: 1 },
  { code: 'FN_SMS_OTP', module: 'OPERATIONS', name: 'OTP and alerts by SMS (needs an SMS provider)', minRank: 2 },
  { code: 'FN_CUSTOM_TEMPLATES', module: 'OPERATIONS', name: 'Edit and upload own templates', minRank: 2 },
  { code: 'FN_CUSTOM_ROLES', module: 'OPERATIONS', name: 'Custom roles', minRank: 3 },
  { code: 'FN_IMAGE_IMPORT', module: 'OPERATIONS', name: 'Import from photos / scans (OCR)', minRank: 3 }
];
export function funcOn(tenant, code) {
  if (tenant.overrides?.[code] !== undefined) return !!tenant.overrides[code];
  const f = FUNCTIONS.find((x) => x.code === code);
  const rank = PLANS.find((p) => p.code === tenant.plan).rank;
  return !!f && f.minRank !== null && rank >= f.minRank;
}

// ---------- Website or mobile app, per role (Operations → Web & App Screens) ----------
// Each school decides, for each role, whether a screen shows on the WEBSITE, in the MOBILE APP, or BOTH.
// Only phone-ready screens (built and store-tested for phones) can go in the app; every other screen is website only.
// Access itself is still decided by the plan, role, designation and personal grants — this only picks where it shows.
// [code]: [tab label, icon]
export const PHONE_READY = {
  SELF_REQUESTS: ['Requests', 'send'], SELF_FEES: ['Fees', 'receipt'], SELF_CHILD: ['My child', 'user'], ACA_TIMETABLE: ['Timetable', 'calendar'],
  STU_ATT: ['Attendance', 'check'], STU_REQUESTS: ['Approvals', 'inbox'], STU_MEETINGS: ['Meetings', 'chat'], STU_GATE: ['Gate', 'shield'],
  STU_OFFICE: ['Office', 'inbox'], TRN_SHEETS: ['Route sheet', 'bus'], TRN_MANIFEST: ['Manifest', 'list'], TRN_CHANGES: ['Bus changes', 'bus'],
  STF_LEAVE: ['Leave', 'calendar'], SELF_PAYSLIP: ['Payslips', 'receipt'], SELF_PROFILE: ['Account', 'settings']
};
export const CHANNELS = { BOTH: 'Website + app', WEB: 'Website only', APP: 'App only' };
// Recommended defaults (17 Nov 2026), chosen so most roles fit the 5-tab phone bar. Anything not listed shows on the website only.
export const RECOMMENDED = {
  PARENT: { SELF_REQUESTS: 'BOTH', SELF_FEES: 'BOTH', SELF_CHILD: 'BOTH', SELF_PROFILE: 'BOTH' },
  TEACHER: { STU_ATT: 'BOTH', STU_REQUESTS: 'BOTH', STU_MEETINGS: 'BOTH', ACA_TIMETABLE: 'BOTH', SELF_PROFILE: 'BOTH' },
  FRONT_OFFICE: { STU_GATE: 'BOTH', STU_OFFICE: 'BOTH', TRN_CHANGES: 'BOTH', SELF_PROFILE: 'BOTH' },
  TRANSPORT: { TRN_SHEETS: 'BOTH', TRN_MANIFEST: 'BOTH', TRN_CHANGES: 'BOTH', SELF_PROFILE: 'BOTH' },
  PRINCIPAL: { STU_REQUESTS: 'BOTH', STU_MEETINGS: 'BOTH', STU_OFFICE: 'BOTH', STU_ATT: 'BOTH', TRN_SHEETS: 'BOTH', SELF_PROFILE: 'BOTH' },
  ACCOUNTANT: { SELF_PAYSLIP: 'BOTH', SELF_PROFILE: 'BOTH' },
  ADMIN: { SELF_PROFILE: 'BOTH' }
};
// Account must stay reachable in the app (store rules: account deletion) and on the website
export const LOCKED_BOTH = ['SELF_PROFILE'];

// Where a screen shows for a role, from a layout ({ ROLE: { CODE: channel } }); unlisted → recommended → website
export function channelIn(layout, role, code) {
  if (!PHONE_READY[code]) return 'WEB';
  if (LOCKED_BOTH.includes(code)) return 'BOTH';
  return layout?.[role]?.[code] || RECOMMENDED[role]?.[code] || 'WEB';
}
export const publishedLayout = (tenant) => tenant.channels?.published || {};
export const onWeb = (tenant, role, code) => role === 'PLATFORM' || channelIn(publishedLayout(tenant), role, code) !== 'APP';
export const onApp = (tenant, role, code) => channelIn(publishedLayout(tenant), role, code) !== 'WEB';

// Tabs for this person in the mobile app: the school has the app on, the screen is set to the app for their role,
// and the same web access rules allow it (plan, add-ons, role, designation, personal grants)
export function mobileTabs(tenant, role, perms, layout = publishedLayout(tenant)) {
  if (!tenant.mobile?.enabled || role === 'PLATFORM') return [];
  const rank = PLANS.find((p) => p.code === tenant.plan).rank;
  const codes = Object.keys(PHONE_READY).filter((code) => channelIn(layout, role, code) !== 'WEB' && canSee(code, role, rank, tenant.overrides, perms));
  // Account always last
  codes.sort((a, b) => (a === 'SELF_PROFILE') - (b === 'SELF_PROFILE'));
  return [['M_HOME', 'Home', 'home'], ...codes.map((c) => [c, ...PHONE_READY[c]])];
}
// Website menu codes for this person (same rules, minus screens set to app only)
export function webScreens(tenant, role, perms, layout = publishedLayout(tenant)) {
  const rank = PLANS.find((p) => p.code === tenant.plan).rank;
  return MENU.flatMap((m) => m.items.map((i) => i[0])).filter((c) => c[0] !== '#' && canSee(c, role, rank, tenant.overrides, perms) && (role === 'PLATFORM' || channelIn(layout, role, c) !== 'APP'));
}

// Which demo profile each View-as item shows: a role, and optionally a designation
export const VIEW_AS = { VA_PARENT: ['PARENT'], VA_TEACHER: ['TEACHER', 'TGT'], VA_VP: ['TEACHER', 'Vice Principal'], VA_HOTS: ['TEACHER', 'Head of Teaching Staff'], VA_PRINCIPAL: ['PRINCIPAL'], VA_ACCOUNTANT: ['ACCOUNTANT'], VA_FRONT_OFFICE: ['FRONT_OFFICE'], VA_TRANSPORT: ['TRANSPORT'] };
export const viewAsUser = (db, code) => { const [role, desig] = VIEW_AS[code] || []; return db.users.find((u) => u.role === role && u.status === 'ACTIVE' && (!desig || u.designation === desig)) || null; };
