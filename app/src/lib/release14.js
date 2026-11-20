// Release 14 add-ons: exam boards, curriculum planning (LMS), student portfolios, backups & restore, WhatsApp links.

// ---------------------------------------------------------------- Board integration
export const BOARDS = {
  CBSE: { name: 'CBSE', scheme: 'Scholastic: 9-point grades A1 to E. Co-scholastic: A, B, C.', cosch: ['A', 'B', 'C'], report: 'CBSE report card (Term 1 + Term 2)' },
  ICSE: { name: 'ICSE / ISC (CISCE)', scheme: 'Marks in percent; internal assessment 20%. Co-scholastic: A to E.', cosch: ['A', 'B', 'C', 'D', 'E'], report: 'CISCE progress report' },
  STATE: { name: 'State board', scheme: 'Marks and grades as the state sets; CCE for primary. Co-scholastic: Outstanding to Satisfactory.', cosch: ['Outstanding', 'Very good', 'Good', 'Satisfactory'], report: 'State board progress card' },
  IB: { name: 'IB', scheme: 'Grades 1 to 7 for each subject against IB criteria. Approaches to learning: 1 to 7.', cosch: ['7', '6', '5', '4', '3', '2', '1'], report: 'IB report (criteria and grades)' },
  CAMBRIDGE: { name: 'Cambridge', scheme: 'Grades A* to G (IGCSE). Co-scholastic: A* to E.', cosch: ['A*', 'A', 'B', 'C', 'D', 'E'], report: 'Cambridge progress report' }
};
export const boardOf = (tenant) => BOARDS[tenant?.examBoard] ? tenant.examBoard : 'CBSE';
export function setBoard(db, tenantId, code) {
  if (!BOARDS[code]) throw new Error('Pick a board');
  db.tenants.find((t) => t.id === tenantId).examBoard = code;
  return BOARDS[code];
}

// ---------------------------------------------------------------- Curriculum planning (LMS)
export const UNIT_STATUS = ['Planned', 'In progress', 'Taught'];
export const MONTHS = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
export function addUnit(db, { classId, subject, title, month, periods, outcomes = '', by }) {
  if (!classId || !subject) throw new Error('Pick the class and subject');
  if (!String(title || '').trim()) throw new Error('Enter the unit name');
  if (!MONTHS.includes(month)) throw new Error('Pick the month');
  const p = Math.round(+periods);
  if (!(p >= 1 && p <= 60)) throw new Error('Periods must be 1 to 60');
  db.curriculum = db.curriculum || [];
  db.seq.unit = (db.seq.unit || 0) + 1;
  const u = { id: 'UN' + db.seq.unit, classId, subject, title: String(title).trim(), month, periods: p, outcomes, status: 'Planned', taught: 0, by };
  db.curriculum.push(u);
  return u;
}
export function setUnitProgress(db, id, taught) {
  const u = (db.curriculum || []).find((x) => x.id === id);
  if (!u) throw new Error('Unit not found');
  u.taught = Math.max(0, Math.min(u.periods, Math.round(+taught || 0)));
  u.status = u.taught === 0 ? 'Planned' : u.taught >= u.periods ? 'Taught' : 'In progress';
  return u;
}
export function coverage(units) {
  const planned = units.reduce((s, u) => s + u.periods, 0);
  const taught = units.reduce((s, u) => s + u.taught, 0);
  return { planned, taught, pct: planned ? Math.round(100 * taught / planned) : 0, units: units.length, done: units.filter((u) => u.status === 'Taught').length };
}

// ---------------------------------------------------------------- Student portfolios
export const PORTFOLIO_KINDS = ['Work sample', 'Project', 'Reflection', 'Certificate', 'Art', 'Sports'];
export function addPortfolioItem(db, { studentId, title, kind, subject = '', date, note = '', shared = true, by }) {
  if (!db.students.some((s) => s.id === studentId)) throw new Error('Pick the student');
  if (!String(title || '').trim()) throw new Error('Enter a title');
  if (!PORTFOLIO_KINDS.includes(kind)) throw new Error('Pick the kind of item');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) throw new Error('Enter the date');
  db.portfolios = db.portfolios || [];
  db.seq.portfolio = (db.seq.portfolio || 0) + 1;
  const it = { id: 'PF' + db.seq.portfolio, studentId, title: String(title).trim(), kind, subject, date, note, shared: !!shared, by };
  db.portfolios.unshift(it);
  return it;
}
export const portfolioOf = (db, studentId, parentView = false) => (db.portfolios || []).filter((p) => p.studentId === studentId && (!parentView || p.shared)).sort((a, b) => b.date.localeCompare(a.date));

// ---------------------------------------------------------------- Backups & restore
// A backup is the whole school's data as one JSON file. Daily automatic backups are kept for keepDays.
const SKIP = ['backup'];
export function backupJson(db) {
  const data = Object.fromEntries(Object.entries(db).filter(([k]) => !SKIP.includes(k)));
  return JSON.stringify({ kind: 'school-backup', schoolCode: db.tenants?.find((t) => t.id === db.tenantId)?.code, at: new Date().toISOString(), data });
}
export function recordBackup(db, { kind, by, size }) {
  db.backup = db.backup || { schedule: 'DAILY', time: '02:00', keepDays: 30, history: [] };
  db.seq.backup = (db.seq.backup || 0) + 1;
  const b = { id: 'BK-' + db.seq.backup, at: new Date().toISOString(), kind, by, size, status: 'OK' };
  db.backup.history.unshift(b);
  db.backup.history = db.backup.history.slice(0, 60);
  return b;
}
// Check a backup file before restoring it: right kind, same school, has the main tables
export function readBackup(text, db) {
  let f;
  try { f = JSON.parse(text); } catch (e) { throw new Error('This is not a backup file (it could not be read).'); }
  if (f?.kind !== 'school-backup' || !f.data) throw new Error('This is not a backup file from this app.');
  const code = db.tenants?.find((t) => t.id === db.tenantId)?.code;
  if (f.schoolCode && code && f.schoolCode !== code) throw new Error(`This backup is for school ${f.schoolCode}, not ${code}.`);
  for (const k of ['students', 'users', 'tenants', 'invoices']) if (!Array.isArray(f.data[k])) throw new Error(`The backup has no ${k}; it may be damaged.`);
  if (f.data.version !== db.version) throw new Error('The backup is from a different version of the app.');
  return f;
}
export function restoreBackup(db, f, by) {
  const keep = db.backup;
  Object.keys(db).forEach((k) => { if (!SKIP.includes(k)) delete db[k]; });
  Object.assign(db, structuredClone(f.data));
  db.backup = keep;
  recordBackup(db, { kind: `Restored from ${new Date(f.at).toLocaleString('en-IN')}`, by, size: 0 });
  return db;
}
export const sizeText = (bytes) => (bytes >= 1048576 ? (bytes / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(bytes / 1024)) + ' KB');

// ---------------------------------------------------------------- WhatsApp (phone to phone, no service)
// Opens WhatsApp on the staff member's phone or computer with the message ready; nothing is sent by the app.
export function whatsappLink(mobile, text) {
  const digits = String(mobile || '').replace(/\D/g, '');
  const to = digits.length === 10 ? '91' + digits : digits;
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
}
export const whatsappShare = (text) => `https://wa.me/?text=${encodeURIComponent(text)}`;
