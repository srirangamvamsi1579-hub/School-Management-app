// Service Provider → Competition comparison and Market review. Public prices and features of other school
// software, Indian and global, as found on vendor and directory pages on 18 Nov 2026. Most prices are
// "from" prices; real quotes depend on modules and negotiation. Foreign prices use approximate rates.
// Feature marks: Y = offered, A = paid add-on or higher plan only, N = not offered, ? = not stated in the sources we read.
// fsrc = the pages each provider's feature marks come from (checked 18 Nov 2026; Devryon's from its own comparison page).

export const AS_OF = '2026-11-18';
export const FX = { USD: 88, GBP: 112, EUR: 100 };   // approximate rupees per unit, Nov 2026

export const FEATURES = [
  ['ADMISSIONS', 'Admissions & enquiries', 'Core'], ['ATTENDANCE', 'Attendance register', 'Core'], ['REPORTCARD', 'Report cards / gradebook', 'Core'],
  ['FEES', 'Fees and online payment', 'Core'], ['TIMETABLE', 'Timetable', 'Core'], ['EVENTS', 'Events & calendar', 'Core'],
  ['PAYROLL', 'Payroll & HR', 'Staff'], ['LEAVE', 'Staff leave with approvals', 'Staff'],
  ['QBANK', 'Question bank & paper builder', 'Teaching'], ['HOMEWORK', 'Homework & assignments', 'Teaching'], ['ONLINE', 'Online / live classes', 'Teaching'], ['LMS', 'LMS: curriculum planning, portfolios', 'Teaching'],
  ['TRANSPORT', 'Transport management', 'Transport'], ['ROUTEPLAN', 'Route planning & pickup suggestions', 'Transport'], ['GPS', 'Live bus GPS tracking', 'Transport'],
  ['LIBRARY', 'Library', 'Campus'], ['HOSTEL', 'Hostel', 'Campus'], ['INVENTORY', 'Inventory & store', 'Campus'],
  ['APP', 'Parent & staff mobile app', 'Platform'], ['APPFREE', 'App included in the base price', 'Platform'], ['ANALYTICS', 'Analytics dashboards', 'Platform'],
  ['AI', 'AI features', 'Platform'], ['QR', 'QR / biometric attendance', 'Platform'], ['MULTI', 'Multi-branch / group', 'Platform'],
  ['IMPORT', 'Data import templates for switching', 'Platform'], ['ONPREM', 'On-premise option', 'Platform'], ['STATUTORY', 'Government / board returns', 'Platform']
];

// price(students) → rupees a year: a number, a [low, high] range, or null when it can't be worked out.
export const PROVIDERS = [
  { code: 'US', name: 'Our platform', country: 'India', region: 'India', us: true, model: 'Per student a month; flat Starter; add-ons',
    priceText: 'Starter ₹1,800/month flat; ₹10 / ₹9 / ₹8 per student a month', price: null, source: null,
    f: { ADMISSIONS: 'Y', ATTENDANCE: 'Y', REPORTCARD: 'Y', FEES: 'Y', TIMETABLE: 'Y', EVENTS: 'Y', PAYROLL: 'Y', LEAVE: 'Y', QBANK: 'Y', HOMEWORK: 'Y', ONLINE: 'Y', LMS: 'N', TRANSPORT: 'Y', ROUTEPLAN: 'Y', GPS: 'N', LIBRARY: 'Y', HOSTEL: 'Y', INVENTORY: 'Y', APP: 'Y', APPFREE: 'Y', ANALYTICS: 'A', AI: 'N', QR: 'N', MULTI: 'Y', IMPORT: 'Y', ONPREM: 'A', STATUTORY: 'N' } },
  { code: 'FEDENA', name: 'Fedena', country: 'India', region: 'India', model: 'Flat yearly plans; web or web + app',
    priceText: 'Web $999–$1,699 a year; web + app $1,599–$2,299 a year', price: () => [1599 * FX.USD, 2299 * FX.USD],
    source: 'https://softwarefinder.com/enterprise-resource-planning-software/fedena',
    f: { ADMISSIONS: 'Y', ATTENDANCE: 'Y', REPORTCARD: 'Y', FEES: 'Y', TIMETABLE: 'Y', EVENTS: 'Y', PAYROLL: 'Y', LEAVE: 'Y', HOMEWORK: 'A', LMS: 'A', TRANSPORT: 'Y', LIBRARY: 'A', HOSTEL: 'A', INVENTORY: 'A', APP: 'A', APPFREE: 'N', MULTI: 'Y', IMPORT: 'Y', ONPREM: 'Y' }, fsrc: ['https://msb-io.github.io/Fedena/Feature-Tour.html', 'https://fedena.com/feature-tour/addon-modules', 'https://trustradius.com/products/fedena/reviews'] },
  { code: 'TEACHMINT', name: 'Teachmint', country: 'India', region: 'India', model: 'Free basic; paid monthly',
    priceText: 'Free basic; ₹2K–₹15K a month paid', price: () => [0, 15000 * 12],
    source: 'https://codingclave.com/guides/school-management-software-cost-india-2026',
    f: { ADMISSIONS: 'Y', ATTENDANCE: 'Y', REPORTCARD: 'Y', FEES: 'Y', EVENTS: 'Y', PAYROLL: 'Y', ONLINE: 'Y', LMS: 'Y', TRANSPORT: 'Y', GPS: 'Y', LIBRARY: 'Y', HOSTEL: 'Y', INVENTORY: 'Y', APP: 'Y' }, fsrc: ['https://blog.teachmint.com/how-can-teachmint-help-schools-realize-their-true-potential', 'https://blog.teachmint.com/what-is-at-the-heart-of-any-erp-system', 'https://www.goodfirms.co/software/teachmint?page=3'] },
  { code: 'ENTAB', name: 'Entab CampusCare', country: 'India', region: 'India', model: 'Per-module annual licence, quoted',
    priceText: '₹25K–₹4L a year; ₹30–₹80 per student a month cited', price: (n) => [30 * 12 * n, 80 * 12 * n],
    source: 'https://codingclave.com/blog/best-school-management-software-india',
    f: { ADMISSIONS: 'Y', ATTENDANCE: 'Y', REPORTCARD: 'Y', FEES: 'Y', EVENTS: 'Y', PAYROLL: 'Y', HOMEWORK: 'Y', TRANSPORT: 'Y', ROUTEPLAN: 'Y', GPS: 'Y', LIBRARY: 'Y', HOSTEL: 'Y', INVENTORY: 'Y', APP: 'Y', MULTI: 'Y', ONPREM: 'Y' }, fsrc: ['https://www.entab.in/school-management-software.html', 'https://entab.in/entab-blog-gps-track.html', 'https://entab.in/mobile-apps.html', 'https://www.softwaresuggest.com/campuscare'] },
  { code: 'DEVRYON', name: 'Devryon', country: 'India', region: 'India', model: 'Per student a month, apps included',
    priceText: '₹6–₹16 per student a month', price: (n) => [6 * 12 * n, 16 * 12 * n],
    source: 'https://gleeful-whisper-cloud.lovable.app/school-erp',
    f: { ADMISSIONS: 'Y', ATTENDANCE: 'Y', REPORTCARD: 'Y', FEES: 'Y', TIMETABLE: 'Y', PAYROLL: 'Y', ONLINE: 'Y', TRANSPORT: 'Y', LIBRARY: 'Y', HOSTEL: 'Y', APP: 'Y', APPFREE: 'Y', AI: 'Y', QR: 'Y' }, fsrc: ['https://gleeful-whisper-cloud.lovable.app/alternative/fedena'] },
  { code: 'ASKCAMPUS', name: 'AskCampus', country: 'India', region: 'India', model: 'Flat by size band, no module add-ons',
    priceText: '₹2,999/month up to 200; ₹7,999 up to 1,000; ₹18,999 up to 5,000', price: (n) => (n <= 200 ? 2999 : n <= 1000 ? 7999 : n <= 5000 ? 18999 : null) * 12 || null,
    source: 'https://askcampus.pages.dev/pricing', f: {} },
  { code: 'TACHY', name: 'TACHY School ERP', country: 'India', region: 'India', model: 'Per student a year',
    priceText: 'From ₹49 per student a year', price: (n) => 49 * n, source: 'https://tachy.in/school-erp-for-bengaluru-schools-pricing-features-setup/', f: {} },
  { code: 'MYCLASSCAMPUS', name: 'MyClassCampus', country: 'India', region: 'India', model: 'Yearly, quoted',
    priceText: '₹15K–₹1L a year', price: () => [15000, 100000], source: 'https://codingclave.com/guides/school-management-software-cost-india-2026', f: { ADMISSIONS: 'Y', ATTENDANCE: 'Y', REPORTCARD: 'Y', FEES: 'Y', TIMETABLE: 'Y', EVENTS: 'Y', PAYROLL: 'Y', HOMEWORK: 'Y', TRANSPORT: 'Y', GPS: 'Y', LIBRARY: 'Y', HOSTEL: 'Y', INVENTORY: 'Y', APP: 'Y', QR: 'Y' }, fsrc: ['https://startuptalky.com/my-class-campus-education-erp/', 'https://www.techimply.com/profile/myclasscampus', 'https://www.saasworthy.com/product/myclasscampus'] },
  { code: 'VIDYALAYA', name: 'Vidyalaya', country: 'India', region: 'India', model: 'Yearly, quoted',
    priceText: '₹30K–₹3L a year', price: () => [30000, 300000], source: 'https://codingclave.com/guides/school-management-software-cost-india-2026', f: {} },
  // ---- Global ----
  { code: 'GRADELINK', name: 'Gradelink', country: 'USA', region: 'Global', model: 'Tiered by enrolled students, monthly',
    priceText: 'From $121 a month up to 50 students; $200 for 101–150', price: (n) => (n <= 50 ? 121 : n <= 150 ? 200 : null) * 12 * FX.USD || null,
    source: 'https://www.capterra.com/p/118900/Gradelink-SIS/pricing/',
    f: { ADMISSIONS: 'Y', ATTENDANCE: 'Y', REPORTCARD: 'Y', FEES: 'Y', TIMETABLE: 'Y', EVENTS: 'Y', HOMEWORK: 'Y', APP: 'Y', APPFREE: 'Y' }, fsrc: ['https://gradelink.com/?p=26012214', 'https://www.sourceforge.net/software/product/Olly', 'https://www.gradelink.com/wp-content/uploads/2021/08/GradelinkBrochure2021.pdf'] },
  { code: 'SYCAMORE', name: 'Sycamore', country: 'USA', region: 'Global', model: 'Per student a month, all modules',
    priceText: '$4 per student a month', price: (n) => 4 * 12 * n * FX.USD, source: 'https://sycamoreleaf.com/compare/gradelink-vs-sycamore/', f: { ADMISSIONS: 'Y', ATTENDANCE: 'Y', REPORTCARD: 'Y', FEES: 'Y', TIMETABLE: 'Y', LIBRARY: 'Y', APP: 'Y', APPFREE: 'Y' }, fsrc: ['https://sycamoreleaf.com/llms.txt', 'https://sycamoreschool.com/jumpstart/'] },
  { code: 'ARBOR', name: 'Arbor MIS', country: 'United Kingdom', region: 'Global', model: 'Base licence + per pupil a year',
    priceText: 'Primary Core £1,575 + £2.35 per pupil a year (2024–25 G-Cloud list)', price: (n) => (1575 + 2.35 * n) * FX.GBP,
    source: 'https://assets.applytosupply.digitalmarketplace.service.gov.uk/g-cloud-14/documents/92647/909733380395847-pricing-document-2024-11-21-1116.pdf',
    f: { ATTENDANCE: 'Y', REPORTCARD: 'A', FEES: 'A', HOMEWORK: 'Y', APP: 'A', AI: 'Y', MULTI: 'Y', STATUTORY: 'Y' }, fsrc: ['https://assets.applytosupply.digitalmarketplace.service.gov.uk/g-cloud-14/documents/92647/909733380395847-pricing-document-2025-12-09-0956.pdf', 'https://www.applytosupply.digitalmarketplace.service.gov.uk/g-cloud/services/713386037909337'] },
  { code: 'BROMCOM', name: 'Bromcom MIS', country: 'United Kingdom', region: 'Global', model: 'Base cost + per pupil a year',
    priceText: 'Secondary Standard £3,250 + £9.50 per pupil a year (2026 G-Cloud list)', price: (n) => (3250 + 9.5 * n) * FX.GBP,
    source: 'https://assets.applytosupply.digitalmarketplace.service.gov.uk/g-cloud-15/documents/93515/618716886907305-pricing-document-2026-01-30-1315.pdf', f: { ATTENDANCE: 'Y' } },
  { code: 'SIMS', name: 'SIMS (ParentPay Group)', country: 'United Kingdom', region: 'Global', model: 'Base charge + per pupil a year',
    priceText: 'Primary £1,670 + £4.45 per pupil a year, with support and hosting', price: (n) => (1670 + 4.45 * n) * FX.GBP,
    source: 'https://assets.applytosupply.digitalmarketplace.service.gov.uk/g-cloud-15/documents/724272/258259663679996-pricing-document-2026-01-30-1359.pdf', f: { ATTENDANCE: 'Y' } },
  { code: 'CLASSTER', name: 'Classter', country: 'Greece', region: 'Global', model: 'Per active student a year, by modules',
    priceText: 'From €1.50 to €4.50 per active student a year, by modules', price: (n) => [1.5 * n * FX.EUR, 4.5 * n * FX.EUR],
    source: 'https://edtechimpact.com/products/classter',
    f: { ADMISSIONS: 'Y', ATTENDANCE: 'Y', REPORTCARD: 'Y', FEES: 'Y', TIMETABLE: 'Y', PAYROLL: 'Y', ONLINE: 'Y', LMS: 'Y', TRANSPORT: 'Y', ROUTEPLAN: 'Y', LIBRARY: 'Y', INVENTORY: 'Y', APP: 'Y' }, fsrc: ['https://edtechimpact.com/products/classter', 'https://www.classter.com/book-a-demo-with-classter-for-higher-education', 'https://www.classter.com/benefits/organizational/procedural/operations/', 'https://www.getapp.com/education-childcare-software/a/classter/'] },
  { code: 'TODDLE', name: 'Toddle', country: 'India (sells in 100+ countries)', region: 'Global', model: 'Quoted, tiered by users',
    priceText: 'Quote only', price: null, source: 'https://softwarefinder.com/lms/toddle',
    f: { ATTENDANCE: 'Y', REPORTCARD: 'Y', HOMEWORK: 'Y', LMS: 'Y', AI: 'Y' } }
];

export const mark = (p, code) => p.f[code] || '?';
export const priceRange = (p, n) => { const v = p.price ? p.price(n) : null; if (v === null || v === undefined || Number.isNaN(v)) return null; return Array.isArray(v) ? v : [v, v]; };

// Market review: what the market looks like and where it is going
export const MARKET = {
  india: [
    'Most Indian school software is sold per student per year: about ₹50–₹120 from budget vendors, ₹120–₹300 from standard vendors and ₹300–₹600 from premium vendors with apps, biometrics and GPS.',
    'Free and flat-price offers (Teachmint free basic, AskCampus flat bands, TACHY from ₹49 a student a year) push prices down for small schools.',
    'Competitors sell thin base plans and charge for transport, library, hostel, HR and the parent app; a free app on every plan is a clear difference.',
    'Schools buy between January and March for an April start; switching usually follows a bad renewal or a missing feature (transport, report cards).'
  ],
  global: [
    { country: 'United Kingdom', text: 'Cloud MIS sold to state schools and trusts through public price lists (G-Cloud): a base licence plus a per-pupil fee. Arbor reports 12,000+ schools; statutory returns and AI absence handling are selling points.', who: 'Arbor, Bromcom, SIMS' },
    { country: 'USA', text: 'Private K-12 systems publish per-student or tiered prices ($121 a month for 50 students; $4 per student a month) with parent apps and tuition billing included.', who: 'Gradelink, Sycamore' },
    { country: 'Greece / Europe', text: 'All-in-one SIS + LMS priced per active student by module (from €1.50), with library, transport, CRM and alumni modules.', who: 'Classter' },
    { country: 'India → global', text: 'AI-first learning platforms (curriculum planning, portfolios, progress reports) sold to international and IB schools in 100+ countries.', who: 'Toddle' }
  ],
  takeaways: [
    'Global prices are 5–30 times Indian prices for the same school size; Indian buyers will not pay for features they can\'t see in a demo.',
    'Where global products lead — AI help for teachers, LMS and portfolios, statutory returns — is our roadmap, not our price list.',
    'Our clearest edge in India: route planning, a free app on every plan, staff leave with approvals, and import templates that make switching easy.'
  ]
};

export const ROADMAP = [
  { code: 'GPS', title: 'Live bus GPS tracking for parents', why: 'Most Indian competitors list it; parents ask for it first after route sheets.', seenAt: 'Teachmint, Entab, MyClassCampus', country: 'India', priority: 'Now', effort: 'M' },
  { code: 'WHATSAPP', title: 'WhatsApp Business notifications', why: 'Parents read WhatsApp more than SMS; cost per message is similar.', seenAt: 'Indian vendors (SMS/WhatsApp packs)', country: 'India', priority: 'Now', effort: 'S' },
  { code: 'FLATPACK', title: 'Flat-price “school pack” option', why: 'Flat bands answer the “per-student pricing punishes growth” objection.', seenAt: 'AskCampus', country: 'India', priority: 'Now', effort: 'S' },
  { code: 'QR', title: 'QR / biometric attendance', why: 'Speeds up morning attendance and staff sign-in.', seenAt: 'Devryon', country: 'India', priority: 'Next', effort: 'M' },
  { code: 'AITT', title: 'AI timetable generator', why: 'Timetabling takes days each April; competitors advertise doing it in minutes.', seenAt: 'Devryon', country: 'India', priority: 'Next', effort: 'L' },
  { code: 'AIREMARKS', title: 'AI-drafted report-card remarks', why: 'Saves teachers hours at term end; the teacher always edits and approves.', seenAt: 'Toddle, Arbor', country: 'India / United Kingdom', priority: 'Next', effort: 'S' },
  { code: 'CHAT', title: 'Parent–teacher chat in the app', why: 'Moves school WhatsApp groups into a record the school controls.', seenAt: 'Teachmint', country: 'India', priority: 'Next', effort: 'M' },
  { code: 'TESTS', title: 'Online tests with auto-marking', why: 'Uses the question bank we already have.', seenAt: 'Teachmint, Classter', country: 'India / Greece', priority: 'Next', effort: 'M' },
  { code: 'UDISE', title: 'Government returns: UDISE+ and APAAR ID exports', why: 'Like UK statutory returns: saves the office a week each year.', seenAt: 'Arbor (UK statutory returns)', country: 'United Kingdom → India', priority: 'Next', effort: 'M' },
  { code: 'AIABSENCE', title: 'AI absence assistant (parent message → absence entry)', why: 'Cuts front-office calls each morning.', seenAt: 'Arbor Auto Absence', country: 'United Kingdom', priority: 'Later', effort: 'M' },
  { code: 'LMS', title: 'Curriculum planning and student portfolios (LMS)', why: 'Needed for international and IB schools.', seenAt: 'Toddle, Classter', country: 'India / Greece', priority: 'Later', effort: 'L' },
  { code: 'INTL', title: 'International curricula and multiple currencies', why: 'Opens Gulf and South-East Asian schools that follow Indian or IB boards.', seenAt: 'Toddle, Classter', country: 'Global', priority: 'Later', effort: 'L' },
  { code: 'ALUMNI', title: 'Alumni records', why: 'Useful for fundraising and admissions marketing.', seenAt: 'Classter', country: 'Greece', priority: 'Later', effort: 'S' },
  // Release 15.1: enhancements found in the November 2026 QA cycle, kept as backlog items until scheduled
  { code: 'QA_API_RULES', title: 'Business rules in the API layer too', why: 'Imports and integrations must not bypass the checks the forms make.', seenAt: 'QA cycle, Nov 2026', country: 'Internal', priority: 'Now', effort: 'M', backlog: true },
  { code: 'QA_PLAN_RECORD', title: 'Plan and add-on record per school', why: 'One source for billing and menus; shown in Schools & plans.', seenAt: 'QA cycle, Nov 2026', country: 'Internal', priority: 'Now', effort: 'M', backlog: true },
  { code: 'QA_MERGE', title: 'Merge duplicate students and enquiries', why: 'Duplicates saved with “Save anyway” need a clean-up tool.', seenAt: 'QA cycle, Nov 2026', country: 'Internal', priority: 'Now', effort: 'M', backlog: true },
  { code: 'QA_INLINE', title: 'Field messages next to each field', why: 'Faster data entry: every problem shown at once, where it is.', seenAt: 'QA cycle, Nov 2026', country: 'Internal', priority: 'Next', effort: 'M', backlog: true },
  { code: 'QA_OVERPAY', title: 'Confirm unusually large fee amounts', why: 'Fewer cash-entry errors at the counter.', seenAt: 'QA cycle, Nov 2026', country: 'Internal', priority: 'Next', effort: 'S', backlog: true },
  { code: 'QA_AGERULE', title: 'Age-for-class settings per school and board', why: 'States set different age cut-offs for Grade I.', seenAt: 'QA cycle, Nov 2026', country: 'Internal', priority: 'Next', effort: 'S', backlog: true },
  { code: 'QA_ADDCOPIES', title: '“Add copies” from the duplicate-book message', why: 'One click instead of finding the book.', seenAt: 'QA cycle, Nov 2026', country: 'Internal', priority: 'Next', effort: 'S', backlog: true },
  { code: 'QA_CAPS', title: 'Offer name capitalisation before saving', why: 'Tidy records (“KIRAN RAO” → “Kiran Rao”), shown first.', seenAt: 'QA cycle, Nov 2026', country: 'Internal', priority: 'Later', effort: 'S', backlog: true },
  { code: 'QA_ALERTS', title: 'Screen-reader alerts for form errors', why: 'Accessibility: errors announced as they appear.', seenAt: 'QA cycle, Nov 2026', country: 'Internal', priority: 'Later', effort: 'S', backlog: true },
  { code: 'HEALTH', title: 'Health and infirmary records', why: 'Asked for by boarding schools with hostels.', seenAt: 'Classter (medical data)', country: 'Greece', priority: 'Later', effort: 'S' }
];
export const ROADMAP_STATUS = ['Backlog', 'Idea', 'Planned', 'In progress', 'Released'];
