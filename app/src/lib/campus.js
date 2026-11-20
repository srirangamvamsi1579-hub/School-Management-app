// Campus Services: library, hostel, homework, online classes, inventory & store, events & calendar.
// Pure functions on the in-memory database; each throws an Error with a plain message when a rule is broken.

import { same, duplicateError, realDate } from './validate.js';
const iso = (d) => new Date(d).toISOString().slice(0, 10);
export const today = () => iso(Date.now());
export const addDays = (date, n) => { const d = new Date(date + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
export const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000);
const nextId = (db, key, prefix) => { db.seq[key] = (db.seq[key] || 0) + 1; return prefix + db.seq[key]; };
export const studentName = (db, id) => { const s = db.students.find((x) => x.id === id); return s ? `${s.first} ${s.last}` : id; };
export const classOf = (db, s) => { const sec = db.sections.find((x) => x.id === s.sectionId); const cls = sec && db.classes.find((c) => c.id === sec.classId); return cls ? `${cls.name}-${sec.name}` : '—'; };

// ---------------------------------------------------------------- Library
export const LIBRARY_RULES = { days: 14, finePerDay: 2, maxBooks: 2 };
export const onLoan = (db, bookId) => db.library.loans.filter((l) => l.bookId === bookId && !l.returned).length;
export const available = (db, bookId) => (db.library.books.find((b) => b.id === bookId)?.copies || 0) - onLoan(db, bookId);
export const fineFor = (loan, on = today(), rules = LIBRARY_RULES) => Math.max(0, daysBetween(loan.due, loan.returned || on)) * rules.finePerDay;
export const overdue = (db, on = today()) => db.library.loans.filter((l) => !l.returned && l.due < on);

export function addBook(db, { title, author, subject, copies, shelf, allowDuplicate = false }) {
  if (!String(title || '').trim()) throw new Error('Enter the book title');
  if (!(+copies >= 1) || !Number.isInteger(+copies)) throw new Error('Copies must be a whole number, 1 or more');
  const twin = !allowDuplicate && db.library.books.find((x) => same(x.title, title) && same(x.author, author));
  if (twin) throw duplicateError(`“${twin.title}”${twin.author ? ' by ' + twin.author : ''} is already in the library (${twin.copies} copies) — add copies to it instead`);
  const b = { id: nextId(db, 'book', 'BK'), title: title.trim(), author: (author || '').trim(), subject: subject || 'General', copies: +copies, shelf: shelf || '' };
  db.library.books.push(b); return b;
}
export function issueBook(db, { bookId, studentId, on = today(), rules = db.library.rules || LIBRARY_RULES }) {
  const b = db.library.books.find((x) => x.id === bookId);
  if (!b) throw new Error('Pick a book');
  if (!db.students.some((s) => s.id === studentId)) throw new Error('Pick a student');
  if (available(db, bookId) < 1) throw new Error(`No copy of “${b.title}” is on the shelf`);
  const mine = db.library.loans.filter((l) => l.studentId === studentId && !l.returned);
  if (mine.length >= rules.maxBooks) throw new Error(`${studentName(db, studentId)} already has ${rules.maxBooks} books`);
  if (mine.some((l) => l.due < on)) throw new Error(`${studentName(db, studentId)} has an overdue book — return it first`);
  const loan = { id: nextId(db, 'loan', 'LN'), bookId, studentId, issued: on, due: addDays(on, rules.days), returned: null, fine: 0 };
  db.library.loans.push(loan); return loan;
}
export function returnBook(db, loanId, on = today()) {
  const l = db.library.loans.find((x) => x.id === loanId);
  if (!l || l.returned) throw new Error('This book is not on loan');
  l.returned = on; l.fine = fineFor(l, on, db.library.rules || LIBRARY_RULES);
  return l;
}

// ---------------------------------------------------------------- Hostel
export const residentsOf = (db, roomId) => db.hostel.residents.filter((r) => r.roomId === roomId && !r.left);
export const freeBeds = (db, roomId) => (db.hostel.rooms.find((r) => r.id === roomId)?.beds || 0) - residentsOf(db, roomId).length;
export function occupancy(db) {
  return db.hostel.blocks.map((b) => {
    const rooms = db.hostel.rooms.filter((r) => r.blockId === b.id);
    const beds = rooms.reduce((s, r) => s + r.beds, 0);
    const used = rooms.reduce((s, r) => s + residentsOf(db, r.id).length, 0);
    return { ...b, rooms: rooms.length, beds, used, free: beds - used, pct: beds ? Math.round((100 * used) / beds) : 0 };
  });
}
export function allocate(db, { studentId, roomId, from = today(), mess = true }) {
  const s = db.students.find((x) => x.id === studentId);
  if (!s) throw new Error('Pick a student');
  const room = db.hostel.rooms.find((r) => r.id === roomId);
  if (!room) throw new Error('Pick a room');
  if (db.hostel.residents.some((r) => r.studentId === studentId && !r.left)) throw new Error(`${studentName(db, studentId)} already has a bed`);
  const block = db.hostel.blocks.find((b) => b.id === room.blockId);
  if (block.gender !== 'Any' && s.gender !== block.gender) throw new Error(`${block.name} is for ${block.gender.toLowerCase()} students`);
  if (freeBeds(db, roomId) < 1) throw new Error(`Room ${room.no} is full`);
  const r = { id: nextId(db, 'resident', 'HR'), studentId, roomId, from, mess: !!mess, left: null };
  db.hostel.residents.push(r); return r;
}
export function vacate(db, residentId, on = today()) {
  const r = db.hostel.residents.find((x) => x.id === residentId && !x.left);
  if (!r) throw new Error('Not a current resident');
  r.left = on; return r;
}
export const hostelFee = (db, r) => (db.hostel.fees?.room || 0) + (r.mess ? db.hostel.fees?.mess || 0 : 0);

// ---------------------------------------------------------------- Homework
export const studentsInSection = (db, sectionId) => db.students.filter((s) => s.sectionId === sectionId && s.status === 'Active');
export function setHomework(db, { sectionId, subject, title, details = '', due, by, on = today() }) {
  if (!db.sections.some((s) => s.id === sectionId)) throw new Error('Pick a class');
  if (!String(subject || '').trim()) throw new Error('Pick a subject');
  if (!String(title || '').trim()) throw new Error('Enter what the homework is');
  if (!due || due < on) throw new Error('Due date must be today or later');
  const h = { id: nextId(db, 'hw', 'HW'), sectionId, subject, title: title.trim(), details, set: on, due, by, done: {} };
  db.homework.unshift(h); return h;
}
export function markHomework(db, hwId, studentId, status) {
  const h = db.homework.find((x) => x.id === hwId);
  if (!h) throw new Error('Homework not found');
  if (!['DONE', 'LATE', 'MISSING'].includes(status)) throw new Error('Unknown status');
  h.done[studentId] = status; return h;
}
export function homeworkStats(db, h) {
  const kids = studentsInSection(db, h.sectionId);
  const done = kids.filter((k) => h.done[k.id] === 'DONE').length, late = kids.filter((k) => h.done[k.id] === 'LATE').length;
  return { total: kids.length, done, late, pending: kids.length - done - late, pct: kids.length ? Math.round((100 * (done + late)) / kids.length) : 0 };
}

// ---------------------------------------------------------------- Online classes
export function scheduleClass(db, { sectionId, subject, date, time, minutes = 40, link, teacher, on = today(), now = new Date().toTimeString().slice(0, 5) }) {
  if (!db.sections.some((s) => s.id === sectionId)) throw new Error('Pick a class');
  if (!/^https:\/\/\S+\.\S+/.test(link || '')) throw new Error('Paste the meeting link (it must start with https://)');
  if (!date || date < on) throw new Error('Pick today or a later date');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time || '')) throw new Error('Use HH:MM for the time');
  if (date === on && time <= now) throw new Error(`${time} today has already passed — pick a later time`);
  if (!(+minutes >= 10 && +minutes <= 180)) throw new Error('Length must be 10 to 180 minutes');
  const clash = db.onlineClasses.find((c) => c.sectionId === sectionId && c.date === date && c.time === time);
  if (clash) throw new Error(`This class already has ${clash.subject} at ${time}`);
  const c = { id: nextId(db, 'oc', 'OC'), sectionId, subject, date, time, minutes: +minutes, link, teacher, attended: [] };
  db.onlineClasses.push(c); return c;
}
export const classAttendance = (db, c) => { const n = studentsInSection(db, c.sectionId).length; return { present: c.attended.length, total: n, pct: n ? Math.round((100 * c.attended.length) / n) : 0 }; };

// ---------------------------------------------------------------- Inventory & store
export const stockOf = (db, itemId) => db.inventory.moves.filter((m) => m.itemId === itemId).reduce((s, m) => s + m.qty, 0);
export const lowStock = (db) => db.inventory.items.filter((i) => stockOf(db, i.id) <= i.reorder);
export function receiveStock(db, { itemId, qty, note = '', on = today(), by }) {
  if (!db.inventory.items.some((i) => i.id === itemId)) throw new Error('Pick an item');
  if (!(Number.isInteger(+qty) && +qty > 0)) throw new Error('Quantity must be a whole number above 0');
  const m = { id: nextId(db, 'move', 'MV'), itemId, qty: +qty, type: 'IN', note, date: on, by, amount: 0 };
  db.inventory.moves.push(m); return m;
}
export function sellItem(db, { itemId, qty, studentId, on = today(), by, issue = false }) {
  const item = db.inventory.items.find((i) => i.id === itemId);
  if (!item) throw new Error('Pick an item');
  if (!(Number.isInteger(+qty) && +qty > 0)) throw new Error('Quantity must be a whole number above 0');
  if (stockOf(db, itemId) < +qty) throw new Error(`Only ${stockOf(db, itemId)} ${item.unit} of ${item.name} in stock`);
  if (!issue && !db.students.some((s) => s.id === studentId)) throw new Error('Pick the student buying it');
  const m = { id: nextId(db, 'move', 'MV'), itemId, qty: -(+qty), type: issue ? 'ISSUE' : 'SALE', to: studentId || null, date: on, by, amount: issue ? 0 : +qty * item.price };
  db.inventory.moves.push(m); return m;
}
export const salesTotal = (db, from = '0000') => db.inventory.moves.filter((m) => m.type === 'SALE' && m.date >= from).reduce((s, m) => s + m.amount, 0);

// ---------------------------------------------------------------- Events & calendar
export const EVENT_TYPES = ['Event', 'Exam', 'Holiday', 'Parent meeting', 'Circular', 'Sports'];
export const AUDIENCES = [['ALL', 'Everyone'], ['PARENTS', 'Parents'], ['STAFF', 'Staff']];
export function addEvent(db, { title, date, end, type = 'Event', audience = 'ALL', details = '', by, allowDuplicate = false }) {
  if (!String(title || '').trim()) throw new Error('Enter a title');
  if (!date) throw new Error('Pick a date');
  if (!realDate(date) || (end && !realDate(end))) throw new Error('Pick a valid date');
  if (end && end < date) throw new Error('End date is before the start date');
  if (!EVENT_TYPES.includes(type)) throw new Error('Unknown type');
  const twin = !allowDuplicate && db.events.find((x) => x.date === date && same(x.title, title));
  if (twin) throw duplicateError(`“${twin.title}” is already on the calendar on ${date}`);
  const e = { id: nextId(db, 'event', 'EV'), title: title.trim(), date, end: end || date, type, audience, details, by, notified: false };
  db.events.push(e); db.events.sort((a, b) => a.date.localeCompare(b.date)); return e;
}
// Calendar = school events + holidays, in date order
export function calendar(db, from = '0000', to = '9999') {
  const hol = (db.holidays || []).map((h) => ({ id: 'H-' + h.date, title: h.name, date: h.date, end: h.date, type: 'Holiday', audience: 'ALL', holiday: true }));
  return [...db.events, ...hol].filter((e) => e.end >= from && e.date <= to).sort((a, b) => a.date.localeCompare(b.date));
}
export const audienceUsers = (db, audience) => db.users.filter((u) => u.status === 'ACTIVE' && !['PLATFORM', 'SALES'].includes(u.role) && (audience === 'ALL' || (audience === 'PARENTS' ? u.role === 'PARENT' : u.role !== 'PARENT')));
