// Conversion templates: one predefined Excel template per menu / table, with every column the app needs,
// so a new school can load its existing data. File names follow one convention so uploads are recognised.
//   Blank template:   NN_<Name>_Data.xlsx                  e.g. 01_Student_Data.xlsx
//   Filled-in upload: NN_<Name>_Data_<SCHOOL>_<YYYYMMDD>.xlsx  e.g. 01_Student_Data_GVS_20261118.xlsx
// Columns: [heading, required, format, example, notes]. Formats: TEXT, NUMBER, DATE (DD/MM/YYYY), TIME (HH:MM),
// PHONE (10-digit Indian mobile), EMAIL, AMOUNT (rupees), PERCENT, YESNO, or ENUM:a|b|c.
export const LOAD_ORDER_NOTE = 'Load in number order: classes before students, students before fees, marks and attendance, routes before riders.';

export const TEMPLATES = [
  { no: 1, name: 'Class_Section', menu: 'Academics → Classes & Sections', entity: 'CLASSES', desc: 'Every class and section, with the class teacher and seats.', cols: [
    ['Class', true, 'TEXT', 'Grade VIII', 'As the school writes it: Nursery, LKG, UKG, Grade I … Grade XII'], ['Section', true, 'TEXT', 'A'], ['Board', true, 'ENUM:CBSE|ICSE|IB|State', 'CBSE'],
    ['Class teacher employee code', false, 'TEXT', 'EMP-0012'], ['Seats', false, 'NUMBER', '40'], ['Room', false, 'TEXT', '204']] },
  { no: 2, name: 'Student', menu: 'Students → All Students', entity: 'STUDENTS', desc: 'One row per student with the main guardian. Siblings share the guardian mobile.', cols: [
    ['Admission no', true, 'TEXT', 'ADM-2019-7701', 'Keep the numbers from your old system'], ['First name', true, 'TEXT', 'Riya'], ['Last name', false, 'TEXT', 'Kulkarni'],
    ['Date of birth', true, 'DATE', '14/03/2013'], ['Gender', true, 'ENUM:Male|Female|Other', 'Female'], ['Class', true, 'TEXT', 'Grade VIII'], ['Section', true, 'TEXT', 'A'],
    ['Roll no', false, 'NUMBER', '12'], ['Date of admission', false, 'DATE', '01/04/2019'], ['House', false, 'TEXT', 'Blue'], ['Blood group', false, 'TEXT', 'B+'],
    ['Guardian name', true, 'TEXT', 'Anil Kulkarni'], ['Guardian relation', true, 'ENUM:Father|Mother|Guardian', 'Father'], ['Guardian mobile', true, 'PHONE', '9845011223'],
    ['Guardian email', false, 'EMAIL', 'anil.k@example.com'], ['Address', false, 'TEXT', '12, 4th Cross, Indiranagar'], ['Transport needed', false, 'YESNO', 'Yes']] },
  { no: 3, name: 'Guardian', menu: 'Students → All Students (guardians)', entity: 'GUARDIANS', desc: 'Extra guardians (mother, grandparent) beyond the main guardian in 02.', cols: [
    ['Admission no', true, 'TEXT', 'ADM-2019-7701'], ['Guardian name', true, 'TEXT', 'Meena Kulkarni'], ['Relation', true, 'ENUM:Father|Mother|Guardian|Grandparent', 'Mother'],
    ['Mobile', true, 'PHONE', '9845011224'], ['Email', false, 'EMAIL', 'meena.k@example.com'], ['Occupation', false, 'TEXT', 'Doctor'], ['Can collect the child', false, 'YESNO', 'Yes']] },
  { no: 4, name: 'Staff', menu: 'Staff → All Staff', entity: 'STAFF', desc: 'Every employee, teaching and non-teaching.', cols: [
    ['Employee code', true, 'TEXT', 'EMP-0012'], ['First name', true, 'TEXT', 'Sonia'], ['Last name', false, 'TEXT', 'Mehta'], ['Gender', true, 'ENUM:Male|Female|Other', 'Female'],
    ['Date of birth', false, 'DATE', '02/05/1988'], ['Department', true, 'TEXT', 'English'], ['Designation', true, 'TEXT', 'TGT'], ['Employment type', true, 'ENUM:Full time|Part time', 'Full time'],
    ['Date of joining', true, 'DATE', '01/06/2019'], ['Mobile', true, 'PHONE', '9845012345'], ['Email', false, 'EMAIL', 'sonia.m@example.com'], ['Short code (timetable)', false, 'TEXT', 'SON']] },
  { no: 5, name: 'Staff_Salary', menu: 'Payroll → Run Payroll', entity: 'SALARY', desc: 'Monthly salary structure per employee.', cols: [
    ['Employee code', true, 'TEXT', 'EMP-0012'], ['Basic', true, 'AMOUNT', '32000'], ['HRA', false, 'AMOUNT', '12800'], ['DA', false, 'AMOUNT', '3200'], ['Transport allowance', false, 'AMOUNT', '1600'],
    ['PF deduction', false, 'AMOUNT', '3840'], ['Tax deduction (TDS)', false, 'AMOUNT', '1500'], ['Bank IFSC', false, 'TEXT', 'HDFC0001234'], ['Account last 4 digits', false, 'TEXT', '4417', 'Only the last 4 digits are kept']] },
  { no: 6, name: 'Leave_Balance', menu: 'Staff → Leave Requests', entity: 'LEAVE', desc: 'Leave already taken this year, so balances start right.', cols: [
    ['Employee code', true, 'TEXT', 'EMP-0012'], ['Leave type', true, 'ENUM:Casual leave|Sick leave|Earned leave|Maternity leave|Paternity leave|Compensatory off|Leave without pay', 'Casual leave'],
    ['Days taken this year', true, 'NUMBER', '3'], ['Carried forward', false, 'NUMBER', '0']] },
  { no: 7, name: 'Fee_Structure', menu: 'Fees → Fee Structure', entity: 'FEE_STRUCTURE', desc: 'Fee heads and amounts per class for the year.', cols: [
    ['Class', true, 'TEXT', 'Grade VIII'], ['Fee head', true, 'TEXT', 'Tuition fee'], ['Amount for the year', true, 'AMOUNT', '84000'], ['Instalments', true, 'ENUM:1|3|4|12', '3'], ['First due date', true, 'DATE', '10/04/2026']] },
  { no: 8, name: 'Fee_Payment_History', menu: 'Fees → Receipts', entity: 'FEE_PAYMENTS', desc: 'Payments already received this year, so dues are right from day one.', cols: [
    ['Admission no', true, 'TEXT', 'ADM-2019-7701'], ['Receipt no', true, 'TEXT', 'R-0412'], ['Date', true, 'DATE', '05/04/2026'], ['Amount', true, 'AMOUNT', '28000'],
    ['Mode', true, 'ENUM:Cash|UPI|Card|Bank transfer|Cheque', 'UPI'], ['Reference (UTR / cheque no)', false, 'TEXT', '612345678901'], ['Instalment', false, 'TEXT', 'Term 1']] },
  { no: 9, name: 'Fee_Concession', menu: 'Fees → Concessions', entity: 'CONCESSIONS', desc: 'Sibling, staff-ward and merit concessions.', cols: [
    ['Admission no', true, 'TEXT', 'ADM-2019-7701'], ['Concession', true, 'TEXT', 'Sibling'], ['Percent', false, 'PERCENT', '10'], ['Amount', false, 'AMOUNT', ''], ['Approved by', false, 'TEXT', 'Principal']] },
  { no: 10, name: 'Transport_Route', menu: 'Transport → Routes, Stops & Timings', entity: 'ROUTES', desc: 'Each bus route with the bus, driver and attendant.', cols: [
    ['Route no', true, 'TEXT', 'R1'], ['Route name', true, 'TEXT', 'Zone A — Indiranagar'], ['Bus registration', true, 'TEXT', 'KA-01-F-4411'], ['Seats', true, 'NUMBER', '40'],
    ['Driver name', true, 'TEXT', 'Ramesh K'], ['Driver mobile', true, 'PHONE', '9845022001'], ['Attendant name', false, 'TEXT', 'Lakshmi B'], ['Reaches school (morning)', true, 'TIME', '08:45'], ['Leaves school (afternoon)', true, 'TIME', '15:15']] },
  { no: 11, name: 'Transport_Stop', menu: 'Transport → Routes, Stops & Timings', entity: 'STOPS', desc: 'Stops on each route in order, with times and map location.', cols: [
    ['Route no', true, 'TEXT', 'R1'], ['Stop order', true, 'NUMBER', '1'], ['Stop name (landmark)', true, 'TEXT', '100 Feet Road'], ['Morning pickup', true, 'TIME', '07:35'], ['Afternoon drop', true, 'TIME', '16:05'],
    ['Latitude', false, 'NUMBER', '12.9719'], ['Longitude', false, 'NUMBER', '77.6412']] },
  { no: 12, name: 'Student_Transport', menu: 'Transport → Routes, Stops & Timings (riders)', entity: 'RIDERS', desc: 'Which route and stop each rider uses.', cols: [
    ['Admission no', true, 'TEXT', 'ADM-2019-7701'], ['Route no', true, 'TEXT', 'R1'], ['Stop name (landmark)', true, 'TEXT', '100 Feet Road'], ['Uses', true, 'ENUM:Both ways|Morning only|Afternoon only', 'Both ways']] },
  { no: 13, name: 'Subject_Teacher', menu: 'Academics → Timetable', entity: 'SUBJECT_TEACHERS', desc: 'Who teaches which subject in each section.', cols: [
    ['Class', true, 'TEXT', 'Grade VIII'], ['Section', true, 'TEXT', 'A'], ['Subject', true, 'TEXT', 'Mathematics'], ['Employee code', true, 'TEXT', 'EMP-0026'], ['Periods per week', false, 'NUMBER', '6']] },
  { no: 14, name: 'Timetable', menu: 'Academics → Timetable', entity: 'TIMETABLE', desc: 'The weekly timetable, one row per period.', cols: [
    ['Class', true, 'TEXT', 'Grade VIII'], ['Section', true, 'TEXT', 'A'], ['Day', true, 'ENUM:Mon|Tue|Wed|Thu|Fri|Sat', 'Mon'], ['Period', true, 'NUMBER', '1'], ['Subject', true, 'TEXT', 'English'], ['Employee code', true, 'TEXT', 'EMP-0012']] },
  { no: 15, name: 'Exam_Marks', menu: 'Students → Student Profile / Report Cards', entity: 'MARKS', desc: 'Marks already given this year, per student, subject and exam.', cols: [
    ['Admission no', true, 'TEXT', 'ADM-2019-7701'], ['Exam', true, 'ENUM:Periodic Test 1|Half-yearly exam|Periodic Test 2|Annual exam', 'Periodic Test 1'], ['Subject', true, 'TEXT', 'Mathematics'],
    ['Marks obtained', true, 'NUMBER', '38'], ['Maximum marks', true, 'NUMBER', '50']] },
  { no: 16, name: 'Student_Attendance', menu: 'Students → Attendance', entity: 'ATTENDANCE', desc: 'Daily attendance so far this year, one row per student per day (or monthly totals).', cols: [
    ['Admission no', true, 'TEXT', 'ADM-2019-7701'], ['Date', true, 'DATE', '03/04/2026', 'Or the first day of the month when giving monthly totals'], ['Status', false, 'ENUM:Present|Absent|Late|Leave', 'Present'],
    ['Days present (monthly)', false, 'NUMBER', ''], ['Working days (monthly)', false, 'NUMBER', '']] },
  { no: 17, name: 'Staff_Attendance', menu: 'Staff → Staff Attendance', entity: 'STAFF_ATTENDANCE', desc: 'Staff attendance so far this year.', cols: [
    ['Employee code', true, 'TEXT', 'EMP-0012'], ['Date', true, 'DATE', '03/04/2026'], ['Status', true, 'ENUM:Present|Absent|Half day|Leave', 'Present']] },
  { no: 18, name: 'Admission_Enquiry', menu: 'Students → Admissions & Enquiries', entity: 'ENQUIRIES', desc: 'Open enquiries and applications for next year.', cols: [
    ['Child name', true, 'TEXT', 'Advik Rao'], ['Grade applied for', true, 'TEXT', 'Grade I'], ['Parent name', true, 'TEXT', 'Rakesh Rao'], ['Mobile', true, 'PHONE', '9845099001'],
    ['Email', false, 'EMAIL', 'rakesh.r@example.com'], ['Source', false, 'ENUM:Website|Walk-in|Referral|Social media|School fair', 'Walk-in'], ['Status', true, 'ENUM:Enquiry|Submitted|In review|Offered|Enrolled|Opted out', 'Enquiry'], ['Enquiry date', true, 'DATE', '12/10/2026']] },
  { no: 19, name: 'Question_Bank', menu: 'Exams → Question Bank', entity: 'QUESTIONS', desc: 'Questions the teachers already have, tagged by chapter and difficulty.', cols: [
    ['Class', true, 'TEXT', 'Grade X'], ['Subject', true, 'TEXT', 'Mathematics'], ['Chapter', true, 'TEXT', 'Real Numbers'], ['Topic', false, 'TEXT', 'Euclid’s division lemma'],
    ['Type', true, 'ENUM:MCQ|True / False|Fill in the blank|One word|Assertion–Reason|Very short|Short|Long|Case-based', 'Short'], ['Difficulty', true, 'ENUM:Easy|Medium|Hard', 'Medium'],
    ['Marks', true, 'NUMBER', '3'], ['Question', true, 'TEXT', 'Show that any positive odd integer is of the form 4q+1 or 4q+3.'], ['Answer', false, 'TEXT', ''], ['Options (MCQ, separated by |)', false, 'TEXT', '']] },
  { no: 20, name: 'Bus_Fleet', menu: 'Dashboard → Transport', entity: 'BUSES', desc: 'Every school bus, including spares, and its fitness dates.', cols: [
    ['Bus registration', true, 'TEXT', 'KA-01-F-4411'], ['Seats', true, 'NUMBER', '40'], ['Status', true, 'ENUM:In service|Spare|Under repair', 'In service'], ['Route no', false, 'TEXT', 'R1'],
    ['Fitness certificate valid until', false, 'DATE', '31/03/2027'], ['Insurance valid until', false, 'DATE', '15/01/2027'], ['Last service date', false, 'DATE', '10/10/2026']] }
];
export const pad = (n) => String(n).padStart(2, '0');
export const templateFile = (t) => `${pad(t.no)}_${t.name}_Data.xlsx`;
export const uploadFile = (t, school, date) => `${pad(t.no)}_${t.name}_Data_${school}_${date.replace(/-/g, '')}.xlsx`;
// Which template a file name belongs to (blank or filled-in), or null
export function templateForFile(fileName) {
  const m = String(fileName).match(/^(\d{2})_([A-Za-z_]+?)_Data(?:_[A-Za-z0-9]+_\d{8})?\.(xlsx|xls|csv)$/i);
  if (!m) return null;
  const t = TEMPLATES.find((x) => x.no === Number(m[1]));
  return t && t.name.toLowerCase() === m[2].toLowerCase() ? t : null;
}

const isDate = (v) => { const m = String(v).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if (!m) return false; const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1])); return d.getUTCDate() === +m[1] && d.getUTCMonth() === +m[2] - 1; };
export function checkValue(fmt, v) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  if (fmt === 'NUMBER' || fmt === 'AMOUNT' || fmt === 'PERCENT') return isNaN(Number(s.replace(/,/g, ''))) ? 'should be a number' : fmt === 'PERCENT' && (+s < 0 || +s > 100) ? 'should be 0–100' : '';
  if (fmt === 'DATE') return isDate(s) ? '' : 'should be a date like 14/03/2013';
  if (fmt === 'TIME') return /^([01]\d|2[0-3]):[0-5]\d$/.test(s) ? '' : 'should be a time like 07:35';
  if (fmt === 'PHONE') return /^[6-9]\d{9}$/.test(s.replace(/^\+?91|[\s-]/g, '')) ? '' : 'should be a 10-digit mobile';
  if (fmt === 'EMAIL') return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s) ? '' : 'is not a valid email';
  if (fmt === 'YESNO') return /^(yes|no|y|n)$/i.test(s) ? '' : 'should be Yes or No';
  if (fmt.startsWith('ENUM:')) { const opts = fmt.slice(5).split('|'); return opts.some((o) => o.toLowerCase() === s.toLowerCase()) ? '' : `should be one of ${opts.join(', ')}`; }
  return '';
}
// Check a filled-in template: headings, then every row. Returns { missing, extra, rows: [{ rowNo, status, msgs }] }
export function checkTemplate(t, rows) {
  const headers = Object.keys(rows[0] || {});
  const norm = (x) => String(x).toLowerCase().replace(/[^a-z0-9]+/g, '');
  const missing = t.cols.filter(([c, req]) => req && !headers.some((hd) => norm(hd) === norm(c))).map((c) => c[0]);
  const extra = headers.filter((hd) => !t.cols.some(([c]) => norm(c) === norm(hd)));
  const colOf = Object.fromEntries(t.cols.map(([c]) => [c, headers.find((hd) => norm(hd) === norm(c))]));
  const out = rows.map((r, i) => {
    const msgs = [];
    t.cols.forEach(([c, req, fmt]) => { const v = colOf[c] ? r[colOf[c]] : ''; if (req && !String(v ?? '').trim()) msgs.push(`${c} is missing`); else { const e = checkValue(fmt, v); if (e) msgs.push(`${c} ${e}`); } });
    return { rowNo: i + 2, status: msgs.length ? 'ERROR' : 'OK', msgs };
  });
  return { missing, extra, rows: out, ok: out.filter((r) => r.status === 'OK').length };
}

// ---------- Loading templates that go straight into the app (students and staff use the column-mapping import) ----------
// Each load records what it changed so Import history → Roll back can put it back.
const EXAM_CODE = { 'periodic test 1': ['T1', 'PT1'], 'half-yearly exam': ['T1', 'T1'], 'periodic test 2': ['T2', 'PT2'], 'annual exam': ['T2', 'T2'] };
const STATUS_CODE = { present: 'P', absent: 'A', late: 'LATE', leave: 'L', 'half day': 'HALF' };
const toISO = (v) => { const m = String(v).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null; };
export const LOADERS = {
  Student_Transport: (db, r, undo) => {
    const s = db.students.find((x) => x.admNo === r['Admission no']); const rt = db.routes.find((x) => x.id === String(r['Route no']).trim());
    if (!s) return `Admission no ${r['Admission no']} not found`; if (!rt) return `Route ${r['Route no']} not found`;
    if (!rt.stops.some((x) => x.name.toLowerCase() === String(r['Stop name (landmark)']).trim().toLowerCase())) return `Stop “${r['Stop name (landmark)']}” is not on ${rt.id}`;
    undo.push(['student', s.id, { routeId: s.routeId, stop: s.stop }]);
    s.routeId = rt.id; s.stop = rt.stops.find((x) => x.name.toLowerCase() === String(r['Stop name (landmark)']).trim().toLowerCase()).name; return '';
  },
  Exam_Marks: (db, r, undo) => {
    const s = db.students.find((x) => x.admNo === r['Admission no']); const e = EXAM_CODE[String(r.Exam).toLowerCase()];
    if (!s) return `Admission no ${r['Admission no']} not found`; if (!e) return `Exam “${r.Exam}” not recognised`;
    const max = Number(r['Maximum marks']), got = Number(r['Marks obtained']);
    if (!(max > 0) || got < 0 || got > max) return 'Marks must be between 0 and the maximum';
    if (e[1].startsWith('PT')) return '';            // periodic tests are kept with the term marks in this test build
    const key = s.id + ':' + r.Subject; const m = db.marks[key] || [null, null];
    undo.push(['marks', key, [...m]]);
    m[e[0] === 'T1' ? 0 : 1] = Math.round((100 * got) / max); db.marks[key] = m; return '';
  },
  Student_Attendance: (db, r, undo) => {
    const s = db.students.find((x) => x.admNo === r['Admission no']); const d = toISO(r.Date); const m = STATUS_CODE[String(r.Status || '').toLowerCase()];
    if (!s) return `Admission no ${r['Admission no']} not found`; if (!d) return 'Date not valid'; if (!m) return 'Daily status is needed (monthly totals are kept for reports only)';
    const k = s.sectionId + ':' + d; undo.push(['att', k, s.id, db.attendance[k]?.[s.id] ?? null]);
    db.attendance[k] = { ...(db.attendance[k] || {}), [s.id]: m }; return '';
  },
  Staff_Attendance: (db, r, undo) => {
    const st = db.staff.find((x) => x.code === r['Employee code']); const d = toISO(r.Date); const m = STATUS_CODE[String(r.Status || '').toLowerCase()];
    if (!st) return `Employee code ${r['Employee code']} not found`; if (!d || !m) return 'Date or status not valid';
    db.staffAttendance = db.staffAttendance || {}; undo.push(['satt', d, st.id, db.staffAttendance[d]?.[st.id] ?? null]);
    db.staffAttendance[d] = { ...(db.staffAttendance[d] || {}), [st.id]: m }; return '';
  },
  Leave_Balance: (db, r, undo, job) => {
    const st = db.staff.find((x) => x.code === r['Employee code']); const t = (db.leaveTypes || []).find((x) => x.name.toLowerCase() === String(r['Leave type']).toLowerCase());
    if (!st) return `Employee code ${r['Employee code']} not found`; if (!t) return `Leave type “${r['Leave type']}” not recognised`;
    const n = Number(r['Days taken this year']); if (!(n >= 0)) return 'Days taken must be a number';
    if (!n) return '';
    db.staffLeaves = db.staffLeaves || []; const id = 'LVI-' + job.id + '-' + st.id + '-' + t.code;
    db.staffLeaves.push({ id, staffId: st.id, type: t.code, from: String(db.year).slice(0, 4) + '-04-01', to: String(db.year).slice(0, 4) + '-04-01', half: false, days: n, reason: 'Taken before moving to the app (imported)', imported: true, status: 'APPROVED', approvers: [], decidedBy: 'Imported', at: new Date().toISOString() });
    undo.push(['leave', id]); return '';
  }
};
export function loadTemplate(db, t, rows, fileName, by) {
  const job = { id: 'J' + (db.importJobs.length + 1), entity: `${pad(t.no)} ${t.name.replace(/_/g, ' ')}`, template: t.name, fileName, at: new Date().toISOString(), by, created: [], undo: [], status: 'IMPORTED', rows: 0, skipped: 0 };
  const errors = [];
  rows.forEach((r, i) => { const e = LOADERS[t.name](db, r, job.undo, job); if (e) { errors.push({ rowNo: i + 2, msg: e }); job.skipped++; } else job.rows++; });
  db.importJobs.unshift(job);
  return { job, errors };
}
export function undoTemplate(db, job) {
  [...(job.undo || [])].reverse().forEach((u) => {
    if (u[0] === 'student') Object.assign(db.students.find((s) => s.id === u[1]) || {}, u[2]);
    if (u[0] === 'marks') db.marks[u[1]] = u[2];
    if (u[0] === 'att') { if (u[3] == null) delete db.attendance[u[1]]?.[u[2]]; else db.attendance[u[1]][u[2]] = u[3]; }
    if (u[0] === 'satt') { if (u[3] == null) delete db.staffAttendance[u[1]]?.[u[2]]; else db.staffAttendance[u[1]][u[2]] = u[3]; }
    if (u[0] === 'leave') db.staffLeaves = db.staffLeaves.filter((x) => x.id !== u[1]);
  });
}
// Record a template that was checked but is loaded by the conversion step (not straight into the test build)
export function recordChecked(db, t, fileName, by, ok, bad) {
  const job = { id: 'J' + (db.importJobs.length + 1), entity: `${pad(t.no)} ${t.name.replace(/_/g, ' ')}`, template: t.name, fileName, at: new Date().toISOString(), by, created: [], status: 'CHECKED', rows: ok, skipped: bad };
  db.importJobs.unshift(job);
  return job;
}
