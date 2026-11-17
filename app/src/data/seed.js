// Demo data for user testing. All names are fictional.
import { rng, roman } from '../lib/format.js';
import { STANDARD_TEMPLATES } from './templates.js';
import { extendSeed } from './seed2.js';

const FIRST_M = ['Aarav', 'Kabir', 'Arjun', 'Ishaan', 'Rohan', 'Vihaan', 'Aditya', 'Reyansh', 'Krishna', 'Dev', 'Nikhil', 'Farhan', 'Siddharth', 'Yash', 'Aryan'];
const FIRST_F = ['Diya', 'Aditi', 'Kavya', 'Neha', 'Isha', 'Ananya', 'Meher', 'Pooja', 'Saanvi', 'Myra', 'Riya', 'Tara', 'Zoya', 'Avni', 'Sara'];
const LAST = ['Sharma', 'Patel', 'Khan', 'Reddy', 'Nair', 'Rao', 'Iyer', 'Gupta', 'Das', 'Joshi', 'Kulkarni', 'Menon', 'Bhat', 'Singh', 'Jain'];

export const GROUPS = [
  { id: 'G1', name: 'I–IV', from: 1, to: 4 }, { id: 'G2', name: 'V–VII', from: 5, to: 7 }, { id: 'G3', name: 'VIII–X', from: 8, to: 10 },
  { id: 'G4', name: 'XI', from: 11, to: 11 }, { id: 'G5', name: 'XII', from: 12, to: 12 }
];
export const BASE_FEE = { Tuition: [126090, 130650, 143310, 207930, 233610], Dining: [34350, 34470, 37860, 40800, 41040], Annual: [7500, 7500, 7500, 7500, 7500] };
export const PREV_FEE = { Tuition: [114600, 118800, 130260, 189000, 212400], Dining: [30000, 30000, 33000, 35100, 35100], Annual: [7500, 7500, 7500, 7500, 7500] };
// Total incl. transport per band (rows) × group (columns)
export const BAND_TOTAL = [[196620, 201180, 218790, 301080, 327000], [207960, 212460, 231990, 307650, 333570], [215730, 220380, 242190, 314100, 340020],
  [221050, 225780, 247410, 322230, 348150], [226170, 230730, 252690, 332370, 358290], [230220, 234960, 257310, 336360, 362280]];

export const groupOf = (level) => GROUPS.findIndex((g) => level >= g.from && level <= g.to);
export const baseTotal = (gi) => BASE_FEE.Tuition[gi] + BASE_FEE.Dining[gi] + BASE_FEE.Annual[gi];
export const transportFor = (gi, band) => (band ? BAND_TOTAL[band - 1][gi] - baseTotal(gi) : 0);

export const CHAPTERS = [
  [1, 'Real Numbers', ['Fundamental Theorem of Arithmetic', 'HCF and LCM', 'Proving irrationality']],
  [2, 'Polynomials', ['Zeroes of a polynomial', 'Zeroes and coefficients']],
  [3, 'Pair of Linear Equations in Two Variables', ['Graphical method', 'Substitution & elimination', 'Consistency']],
  [4, 'Quadratic Equations', ['Factorisation', 'Nature of roots', 'Word problems']],
  [5, 'Arithmetic Progressions', ['nth term', 'Sum of n terms']],
  [6, 'Triangles', ['Similar figures', 'Basic proportionality theorem', 'Similarity criteria']],
  [7, 'Coordinate Geometry', ['Distance formula', 'Section formula']],
  [8, 'Introduction to Trigonometry', ['Trigonometric ratios', 'Specific angles', 'Identities']],
  [9, 'Some Applications of Trigonometry', ['Heights and distances']],
  [10, 'Circles', ['Tangent to a circle', 'Tangents from a point']],
  [11, 'Areas Related to Circles', ['Sector and segment']],
  [12, 'Surface Areas and Volumes', ['Combined solids — area', 'Combined solids — volume']],
  [13, 'Statistics', ['Mean', 'Mode and median']],
  [14, 'Probability', ['Theoretical probability']]
];

export const FORMATS = [
  { code: 'CBSE_X', name: 'CBSE Class X — board pattern', marks: 80, minutes: 180,
    sections: [['A', 'MCQ', 18, 1], ['A', 'AR', 2, 1], ['B', 'VSA', 5, 2], ['C', 'SA', 6, 3], ['D', 'LA', 4, 5], ['E', 'CASE', 3, 4]],
    instructions: ['This question paper has 38 questions in five sections — A, B, C, D and E. All questions are compulsory.', 'Section A has 20 multiple-choice questions (including 2 Assertion–Reason) of 1 mark each.', 'Section B has 5 questions of 2 marks, Section C 6 questions of 3 marks and Section D 4 questions of 5 marks.', 'Section E has 3 case-based units of 4 marks each.', 'Internal choice is provided in some questions.'] },
  { code: 'PT40', name: 'Periodic test — 40 marks', marks: 40, minutes: 90,
    sections: [['A', 'MCQ', 10, 1], ['B', 'VSA', 5, 2], ['C', 'SA', 4, 3], ['D', 'LA', 1, 5], ['E', 'CASE', 1, 3]], instructions: ['All questions are compulsory.'] },
  { code: 'UT25', name: 'Unit test — 25 marks', marks: 25, minutes: 45,
    sections: [['A', 'MCQ', 5, 1], ['B', 'VSA', 5, 2], ['C', 'LA', 2, 5]], instructions: ['All questions are compulsory.'] },
  { code: 'ICSE_X', name: 'ICSE Class X — two sections', marks: 80, minutes: 150,
    sections: [['A', 'MCQ', 15, 1], ['A', 'VSA', 5, 3], ['A', 'SA', 5, 2], ['B', 'LA', 6, 10, 4]], instructions: ['Section A is compulsory. Attempt any four questions from Section B.', 'The intended marks for questions or parts of questions are given in brackets [ ].'] }
];

const STEMS = {
  MCQ: (t) => `Which of the following is true about ${t.toLowerCase()}?`,
  AR: (t) => `Assertion (A): a statement about ${t.toLowerCase()}. Reason (R): the rule that explains it.`,
  VSA: (t) => `State and apply the key result of ${t.toLowerCase()} to the given values.`,
  SA: (t) => `Solve the following problem on ${t.toLowerCase()}, showing each step.`,
  LA: (t) => `A real-life problem on ${t.toLowerCase()}: model it, solve it and interpret the answer.`,
  CASE: (t) => `Case study on ${t.toLowerCase()} with three sub-parts (1 + 1 + 2 marks).`
};
const MARKS = { MCQ: 1, AR: 1, VSA: 2, SA: 3, LA: 5, CASE: 4 };

export function buildSeed() {
  const r = rng(11);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const db = {
    version: 1,
    tenants: [
      { id: 'T1', code: 'GVS', name: 'Green Valley School', subdomain: 'greenvalley', plan: 'PROFESSIONAL', status: 'Active', overrides: {}, renews: '2027-03-31' },
      { id: 'T2', code: 'SPS', name: 'Sunrise Public School', subdomain: 'sunrise', plan: 'STARTER', status: 'Active', overrides: { PAYROLL: true, PAY_RUN: true, PAY_SLIPS: true }, renews: '2027-06-30' },
      { id: 'T3', code: 'SMA', name: 'St. Mary’s Academy', subdomain: 'stmarys', plan: 'GROWTH', status: 'Active', overrides: {}, renews: '2027-01-31' },
      { id: 'T4', code: 'LVI', name: 'Lakeview International', subdomain: 'lakeview', plan: 'ENTERPRISE', status: 'Active', overrides: {}, renews: '2027-03-31' }
    ],
    tenantId: 'T1',
    year: '2026-27',
    classes: [], sections: [], students: [], guardians: [], staff: [], invoices: [], payments: [], vouchers: [],
    campaigns: [], messages: [], outbox: [], notifications: [], questions: [], papers: [], cosch: {}, profiles: {},
    attendance: {}, links: [], importProfiles: [], importJobs: [], audit: [], seq: { receipt: 400, invoice: 8300, voucher: 3100, paper: 10 },
    bank: { holder: '[School] Educational Society', bank: 'State Bank of India', branch: 'MG Road', account: '302145674821', ifsc: 'SBIN0001234',
      upi: 'schoolfees@sbi', qr: null, verified: true, verifiedBy: 'Principal', pending: null },
    theme: { template: 'CLASSIC', color: '#2147C7', side: 'DARK', radius: 10, density: 'COMFORTABLE', font: 'Inter', mode: 'LIGHT' },
    website: { mode: 'EXISTING', url: 'https://www.greenvalley.example.in', verified: true },
    templates: STANDARD_TEMPLATES.map((t) => ({ ...t })),
    templateDefaults: {},
    perms: null
  };

  // Staff (short codes as printed on the timetable)
  const STAFF = [['Sonia', 'Mehta', 'SON', 'English', 'TGT'], ['Shalini', 'Hegde', 'SH', 'English', 'TGT'], ['Murali', 'Krishnan', 'M', 'Mathematics', 'PGT'],
    ['Prasad', 'Rao', 'Pr Prasad', 'Mathematics', 'PGT'], ['Suresh', 'Nair', 'SN', 'Mathematics', 'TGT'], ['Saurabh', 'Verma', 'SAUR', 'Languages', 'TGT'],
    ['Irfan', 'Ali', 'IR', 'Languages', 'TGT'], ['Kiran', 'Kumar', 'KIR', 'Science', 'PGT'], ['Avinash', 'Pillai', 'AVI', 'Science', 'TGT'],
    ['Prudhvi', 'Raj', 'Prud', 'Science', 'TGT'], ['Sanchita', 'Bose', 'SANCH', 'Social Science', 'TGT'], ['Sandeep', 'Joshi', 'SAND', 'Social Science', 'TGT'],
    ['Ravi', 'Teja', 'COMP', 'Computers', 'TGT'], ['Sana', 'Khan', 'SK', 'Accounts', 'Accountant'], ['Anita', 'Rao', 'AR', 'Administration', 'Office Assistant']];
  db.staff = STAFF.map(([first, last, short, dept, desig], i) => ({
    id: 'E' + (i + 1), code: 'EMP-' + String(12 + i * 7).padStart(4, '0'), first, last, short, dept, desig,
    mobile: '98' + String(10000000 + Math.floor(r() * 89999999)), email: first.toLowerCase() + '@school.example.in', join: '2019-06-01',
    salary: { Basic: 30000 + Math.floor(r() * 20) * 1000, HRA: 0, DA: 0, Transport: 1600, PF: 0, Tax: 1500 }, status: 'Active'
  }));
  db.staff.forEach((s) => { s.salary.HRA = Math.round(s.salary.Basic * 0.4); s.salary.DA = Math.round(s.salary.Basic * 0.1); s.salary.PF = Math.round(s.salary.Basic * 0.12); });

  // Classes I–XII; IX has the six sections from the school's timetable, others A/B
  for (let lv = 1; lv <= 12; lv++) {
    const cls = { id: 'C' + lv, name: 'Grade ' + roman[lv - 1], level: lv, board: 'CBSE' };
    db.classes.push(cls);
    const secs = lv === 9 ? ['S1', 'S2', 'S3', 'W1', 'W2', 'W3'] : ['A', 'B'];
    secs.forEach((s, k) => db.sections.push({ id: cls.id + s, classId: cls.id, name: s, teacherId: db.staff[(lv + k) % 13].id, capacity: 40 }));
  }

  // Students: 4 per section (fewer in IX sections) → ~120
  let adm = 200;
  db.sections.forEach((sec) => {
    const n = sec.classId === 'C9' ? 3 : 4;
    for (let k = 0; k < n; k++) {
      const female = r() > 0.5;
      const first = female ? pick(FIRST_F) : pick(FIRST_M), last = pick(LAST);
      const gId = 'P' + (db.guardians.length + 1);
      const hasEmail = r() > 0.08;
      const gFirst = female ? pick(['Rohit', 'Anil', 'Suresh', 'Vikram', 'Imran', 'Rajesh']) : pick(['Rohit', 'Anil', 'Meena', 'Neha', 'Imran', 'Sunita']);
      db.guardians.push({ id: gId, name: gFirst + ' ' + last, relation: ['Meena', 'Neha', 'Sunita'].includes(gFirst) ? 'Mother' : 'Father',
        mobile: '9' + String(800000000 + Math.floor(r() * 199999999)), email: hasEmail ? gFirst.toLowerCase() + '.' + last.toLowerCase() + (adm % 7) + '@example.com' : '' });
      const level = parseInt(sec.classId.slice(1), 10);
      db.students.push({ id: 'S' + (++adm), admNo: 'ADM-' + (2014 + Math.min(level, 11)) + '-' + String(adm).padStart(4, '0'), first, last,
        gender: female ? 'Female' : 'Male', dob: `${2020 - level}-0${1 + Math.floor(r() * 9)}-1${Math.floor(r() * 9)}`, sectionId: sec.id, roll: k + 1,
        guardianId: gId, band: r() > 0.25 ? 1 + Math.floor(r() * 6) : 0, payPlan: 'THREE', status: 'Active', house: pick(['Red', 'Blue', 'Green', 'Yellow']),
        attendance: 88 + Math.floor(r() * 12) });
    }
  });
  // Make the first Grade VIII student match the screens and emails used in the design
  const s8 = db.students.find((s) => s.sectionId === 'C8A');
  Object.assign(s8, { first: 'Aarav', last: 'Sharma', gender: 'Male', admNo: 'ADM-2025-0231', band: 3 });
  Object.assign(db.guardians.find((g) => g.id === s8.guardianId), { name: 'Rohit Sharma', relation: 'Father', mobile: '9812344410', email: 'rohit.s@example.com' });

  // Invoices: three instalments per student; I and II mostly paid, III due 10 Dec
  const INST = [['Installment I', '2026-04-01', '2026-04-10'], ['Installment II', '2026-08-01', '2026-08-10'], ['Installment III', '2026-12-01', '2026-12-10']];
  db.students.forEach((s) => {
    const level = parseInt(s.sectionId.slice(1), 10), gi = groupOf(level);
    const yearly = { Tuition: BASE_FEE.Tuition[gi], Dining: BASE_FEE.Dining[gi], Transport: transportFor(gi, s.band) };
    INST.forEach(([label, date, due], k) => {
      const items = Object.entries(yearly).filter(([, v]) => v > 0).map(([head, v]) => ({ head, amount: Math.round(v / 3) }));
      if (k === 0) items.push({ head: 'Annual', amount: BASE_FEE.Annual[gi] });
      const net = items.reduce((a, b) => a + b.amount, 0);
      const inv = { id: 'I' + (++db.seq.invoice), no: 'INV-GVS-' + String(db.seq.invoice).padStart(5, '0'), studentId: s.id, instalment: label,
        date, due, items, net, paid: 0, status: 'DUE', prev: 0, advance: 0 };
      db.invoices.push(inv);
    });
  });
  // Instalment III for Aarav exactly as on the school's invoice sample
  const aInv = db.invoices.filter((i) => i.studentId === s8.id)[2];
  aInv.items = [{ head: 'Tuition', amount: 60890 }, { head: 'Dining', amount: 16320 }, { head: 'Transport', amount: 25860 }];
  aInv.net = 103070; aInv.no = 'INV-GVS-08301';

  // Mark history paid (Instalment I all, II 92%)
  db.invoices.forEach((inv, idx) => {
    if (inv.instalment === 'Installment I' || (inv.instalment === 'Installment II' && r() < 0.92)) {
      const mode = pick(['UPI', 'UPI', 'BANK', 'CARD', 'CASH']);
      const p = { id: 'R' + (++db.seq.receipt), receiptNo: 'R-2026-' + String(db.seq.receipt).padStart(5, '0'), studentId: inv.studentId, amount: inv.net,
        mode, ref: mode === 'CASH' ? '' : 'UTR' + (500000 + idx), at: inv.due.slice(0, 8) + '0' + (1 + (idx % 8)), by: 'Seed', allocations: [{ invoiceId: inv.id, amount: inv.net }] };
      inv.paid = inv.net; inv.status = 'PAID';
      db.payments.push(p);
    } else if (inv.due < '2026-11-17') inv.status = 'OVERDUE';
  });

  // Timetable — Grade IX Friday as on the school's sheet; other days derived from it
  db.periods = ['9.10–9.40', '9.40–10.10', '10.15–10.45', '10.45–11.15', '11.20–11.50', '11.50–12.20', '12.20–12.45', '12.45–1.15', '1.15–1.45', '1.45–2.15', '2.15–2.45', '2.45–3.00'];
  db.timetable = {
    C9: {
      FRI: { S1: ['MATH M', 'ENG SON/SH', 'COMP', 'BIO KIR'], S2: ['MATH Pr Prasad', 'MATH SN', 'LANG SAUR/IR', 'ENG SON/SH'],
        S3: ['LANG SAUR/IR', 'LANG SAUR/IR', 'BIO KIR', 'PHY AVI'], W1: ['PHY Prud', 'HIST SANCH', 'COMP', 'MATH Pr Prasad'],
        W2: ['ENG SON/SH', 'COMP', 'MATH SN', 'PHY Prud'], W3: ['HIST SANCH', 'MATH Pr Prasad', 'ENG SON/SH', 'GEO SAND'] },
      blocks: { FRI: { p4: 'ELECTIVE', p5: 'PT for Boys / Collab Games', p6: 'PT for Girls / Collab Games', p9: 'SLC / Cabinet meet', p10: 'Music assembly · Quiz · Current affairs · Debate', p12: 'Collaboration' } }
    }
  };

  // Question bank: Class X Maths — 2 per topic per type per difficulty
  let qn = 0;
  CHAPTERS.forEach(([ch, , topics]) => topics.forEach((topic) => Object.keys(STEMS).forEach((type) => ['EASY', 'INTERMEDIATE', 'TOUGH'].forEach((diff) => {
    for (let k = 0; k < 2; k++) {
      db.questions.push({ id: 'Q' + (++qn), board: 'CBSE', grade: 10, subject: 'Mathematics', chapter: ch, topic, type, marks: MARKS[type], difficulty: diff,
        competency: r() > 0.5, text: STEMS[type](topic) + (k ? ' (variant B)' : ''), options: type === 'MCQ' || type === 'AR' ? ['(a) …', '(b) …', '(c) …', '(d) …'] : null,
        source: r() > 0.9 ? 'AI draft' : 'Teacher', status: r() > 0.93 ? 'In review' : 'Approved', used: Math.floor(r() * 3) });
    }
  }))));
  // A few real sample questions shown first
  const real = [
    [1, 'HCF and LCM', 'MCQ', 'EASY', 'The HCF of 84 and 126 is (a) 14 (b) 21 (c) 42 (d) 84'],
    [2, 'Zeroes of a polynomial', 'MCQ', 'EASY', 'If 2 is a zero of x² − 5x + k, then k is (a) 3 (b) 6 (c) −6 (d) 10'],
    [4, 'Factorisation', 'VSA', 'EASY', 'Find the roots of 3x² − 5x + 2 = 0 by factorisation.'],
    [7, 'Section formula', 'VSA', 'INTERMEDIATE', 'Find the point dividing the join of A(−2, 5) and B(8, −5) in the ratio 3 : 2.'],
    [1, 'Proving irrationality', 'SA', 'INTERMEDIATE', 'Prove that √3 is irrational.'],
    [4, 'Word problems', 'LA', 'TOUGH', 'A delivery van covers 240 km at a uniform speed. If its speed were 20 km/h more, the trip would take 1 hour less. Find the usual speed.'],
    [9, 'Heights and distances', 'CASE', 'INTERMEDIATE', 'A school ramp rises 1.5 m at 30°. (i) Length of the ramp (ii) Horizontal distance (iii) tan θ if it starts 6 m away.']
  ];
  real.forEach(([chapter, topic, type, difficulty, text], i) => Object.assign(db.questions[i * 37 % db.questions.length], { chapter, topic, type, difficulty, text, marks: MARKS[type], status: 'Approved', source: 'Teacher', options: null }));

  // Menu links to the school's existing website
  db.links = [
    { id: 'L1', label: 'School website', under: 'TOP', url: 'https://www.greenvalley.example.in', open: 'NEW_TAB', roles: ['ADMIN', 'PRINCIPAL', 'ACCOUNTANT', 'TEACHER', 'FRONT_OFFICE', 'PARENT'] },
    { id: 'L2', label: 'Transport routes map', under: 'FEES', url: 'https://www.greenvalley.example.in/transport', open: 'NEW_TAB', roles: ['ADMIN', 'PARENT'] },
    { id: 'L3', label: 'Circulars', under: 'SELF', url: 'https://www.greenvalley.example.in/circulars', open: 'NEW_TAB', roles: ['TEACHER', 'PARENT'] }
  ];

  // Saved import mapping (re-used each time the old ERP export is uploaded)
  db.importProfiles = [{ id: 'M1', name: 'Old ERP student export', entity: 'STUDENTS', dateFormat: 'DD/MM/YYYY',
    columns: { admission_no: 'Adm No', first_name: 'Student Name', last_name: 'Student Name', dob: 'D.O.B', gender: 'Sex', class: 'Std', section: 'Div', guardian_name: 'Father Name', guardian_mobile: 'Mobile', guardian_email: 'E-mail' },
    transforms: { first_name: 'FIRST_WORD', last_name: 'AFTER_FIRST_WORD', dob: 'DATE', guardian_mobile: 'PHONE_IN', section: 'UPPER', guardian_name: 'TITLE' },
    values: { gender: { Boy: 'Male', Girl: 'Female', M: 'Male', F: 'Female' }, class: { '8th': 'Grade VIII', VIII: 'Grade VIII', '9th': 'Grade IX' } } }];

  return extendSeed(db);
}
