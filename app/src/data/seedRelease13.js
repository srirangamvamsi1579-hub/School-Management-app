// Release 13 demo data (all fictional) and the upgrade of saved test data: Campus Services (library, hostel,
// homework, online classes, inventory & store, events), the Sales & marketing team, the price list,
// sample proposals and the roadmap. Safe to run more than once.
import { ACCESS } from './menu.js';
import { DEFAULT_RATE_CARD, blankOptions } from '../lib/pricing.js';
import { ROADMAP } from './providers.js';
import { departments, baseRoleOf } from '../lib/auth.js';
import { addDays } from '../lib/campus.js';

const BOOKS = [
  ['The Jungle Book', 'Rudyard Kipling', 'Fiction', 3], ['Wings of Fire', 'A. P. J. Abdul Kalam', 'Biography', 4], ['Malgudi Days', 'R. K. Narayan', 'Fiction', 3],
  ['Panchatantra Stories', 'Retold', 'Fiction', 5], ['Ignited Minds', 'A. P. J. Abdul Kalam', 'Non-fiction', 2], ['The Story of My Experiments with Truth', 'M. K. Gandhi', 'Biography', 2],
  ['NCERT Mathematics Class 8', 'NCERT', 'Textbook', 6], ['NCERT Science Class 9', 'NCERT', 'Textbook', 6], ['Oxford Student Atlas', 'Oxford', 'Reference', 4],
  ['Black Beauty', 'Anna Sewell', 'Fiction', 2], ['Treasure Island', 'R. L. Stevenson', 'Fiction', 2], ['A Brief History of Time', 'Stephen Hawking', 'Science', 2],
  ['Tenali Raman Tales', 'Retold', 'Fiction', 4], ['The Discovery of India', 'Jawaharlal Nehru', 'History', 2], ['Concise English Dictionary', 'Oxford', 'Reference', 5],
  ['Hindi Vyakaran', 'Various', 'Language', 4], ['Basic Computer Skills', 'Various', 'Computers', 3], ['Little Women', 'Louisa May Alcott', 'Fiction', 2],
  ['Physics for Class 11', 'H. C. Verma', 'Textbook', 3], ['Ruskin Bond Omnibus', 'Ruskin Bond', 'Fiction', 3]
];
const ITEMS = [
  ['Uniform shirt (white)', 'Uniform', 'piece', 450, 30, 120], ['Uniform trousers / skirt', 'Uniform', 'piece', 550, 25, 90], ['School tie', 'Uniform', 'piece', 120, 20, 60],
  ['School belt', 'Uniform', 'piece', 150, 20, 18], ['Sports T-shirt (house colour)', 'Uniform', 'piece', 350, 25, 70], ['Notebook, 200 pages', 'Stationery', 'piece', 60, 100, 400],
  ['Geometry box', 'Stationery', 'piece', 180, 15, 35], ['School diary 2026-27', 'Stationery', 'piece', 120, 40, 22], ['ID card holder and lanyard', 'Accessories', 'piece', 50, 30, 150],
  ['School bag', 'Accessories', 'piece', 950, 10, 14]
];

const iso = (d) => d.toISOString().slice(0, 10);

export const NEW_CODES_13 = ['CMP_EVENTS', 'CMP_HOMEWORK', 'CMP_CLASSES', 'CMP_LIBRARY', 'CMP_INVENTORY', 'CMP_HOSTEL'];

export function seedRelease13(db) {
  if (db.release >= 13) return db;
  const today = iso(new Date());
  const active = db.students.filter((s) => s.status === 'Active');
  db.seq = db.seq || {};

  // ---- Library ----
  db.library = { rules: { days: 14, finePerDay: 2, maxBooks: 2 }, books: [], loans: [] };
  BOOKS.forEach(([title, author, subject, copies], i) => db.library.books.push({ id: 'BK' + (i + 1), title, author, subject, copies, shelf: `${String.fromCharCode(65 + (i % 6))}-${1 + (i % 4)}` }));
  db.seq.book = BOOKS.length;
  const readers = active.filter((_, i) => i % 9 === 0).slice(0, 18);
  readers.forEach((s, i) => {
    const issued = addDays(today, -(3 + ((i * 5) % 24)));
    const ret = i % 4 === 0 ? addDays(issued, 9) : null;
    db.library.loans.push({ id: 'LN' + (i + 1), bookId: 'BK' + (1 + ((i * 7) % BOOKS.length)), studentId: s.id, issued, due: addDays(issued, 14), returned: ret, fine: 0 });
  });
  db.seq.loan = readers.length;

  // ---- Hostel ----
  db.hostel = { blocks: [{ id: 'HB1', name: 'Tagore House (boys)', gender: 'Male', warden: 'Mr. Ramesh K' }, { id: 'HB2', name: 'Sarojini House (girls)', gender: 'Female', warden: 'Ms. Lakshmi P' }],
    rooms: [], residents: [], fees: { room: 6500, mess: 3500 } };
  ['HB1', 'HB2'].forEach((b, bi) => { for (let r = 1; r <= 8; r++) db.hostel.rooms.push({ id: `${b}-${100 + r}`, blockId: b, no: `${bi + 1}${String(r).padStart(2, '0')}`, beds: r <= 6 ? 3 : 4 }); });
  const senior = active.filter((s) => { const sec = db.sections.find((x) => x.id === s.sectionId); const c = sec && db.classes.find((x) => x.id === sec.classId); return c && c.level >= 6; });
  let n = 0;
  for (const s of senior.filter((_, i) => i % 5 === 0).slice(0, 34)) {
    const block = s.gender === 'Female' ? 'HB2' : 'HB1';
    const room = db.hostel.rooms.filter((r) => r.blockId === block).find((r) => db.hostel.residents.filter((x) => x.roomId === r.id).length < r.beds);
    if (!room) continue;
    db.hostel.residents.push({ id: 'HR' + ++n, studentId: s.id, roomId: room.id, from: `${db.year.slice(0, 4)}-04-05`, mess: n % 6 !== 0, left: null });
  }
  db.seq.resident = n;

  // ---- Homework ----
  db.homework = [];
  const secs = db.sections.slice(0, 12);
  const SUBJ = ['English', 'Mathematics', 'Science', 'Social Science', 'Hindi'];
  secs.forEach((sec, i) => {
    for (let k = 0; k < 2; k++) {
      const set = addDays(today, -(k * 3 + (i % 3)));
      const subject = SUBJ[(i + k) % SUBJ.length];
      const kids = active.filter((s) => s.sectionId === sec.id);
      const done = {};
      if (k === 1) kids.forEach((s, j) => { done[s.id] = j % 7 === 0 ? 'MISSING' : j % 5 === 0 ? 'LATE' : 'DONE'; });
      db.homework.push({ id: 'HW' + (db.homework.length + 1), sectionId: sec.id, subject, title: k ? `${subject}: revision worksheet ${i + 1}` : `${subject}: exercise ${2 + i} — questions 1 to 10`,
        details: k ? 'Complete the worksheet shared in class.' : 'Write neatly in the homework notebook.', set, due: addDays(set, 2), by: 'Class teacher', done });
    }
  });
  db.seq.hw = db.homework.length;

  // ---- Online classes ----
  db.onlineClasses = [];
  secs.slice(0, 8).forEach((sec, i) => {
    const kids = active.filter((s) => s.sectionId === sec.id);
    db.onlineClasses.push({ id: 'OC' + (2 * i + 1), sectionId: sec.id, subject: SUBJ[i % SUBJ.length], date: addDays(today, -(2 + (i % 3))), time: '16:00', minutes: 40, link: `https://meet.example.com/gvs-${sec.id.toLowerCase()}-rev`, teacher: 'Class teacher', attended: kids.filter((_, j) => j % 6 !== 0).map((s) => s.id) });
    db.onlineClasses.push({ id: 'OC' + (2 * i + 2), sectionId: sec.id, subject: SUBJ[(i + 2) % SUBJ.length], date: addDays(today, 1 + (i % 4)), time: i % 2 ? '17:00' : '16:30', minutes: 45, link: `https://meet.example.com/gvs-${sec.id.toLowerCase()}-doubt`, teacher: 'Class teacher', attended: [] });
  });
  db.seq.oc = db.onlineClasses.length;

  // ---- Inventory & store ----
  db.inventory = { items: [], moves: [] };
  let mv = 0;
  ITEMS.forEach(([name, category, unit, price, reorder, opening], i) => {
    const id = 'IT' + (i + 1);
    db.inventory.items.push({ id, name, category, unit, price, reorder });
    db.inventory.moves.push({ id: 'MV' + ++mv, itemId: id, qty: opening, type: 'IN', note: 'Opening stock', date: `${db.year.slice(0, 4)}-04-01`, by: 'Store', amount: 0 });
  });
  active.filter((_, i) => i % 11 === 0).slice(0, 24).forEach((s, j) => {
    const it = db.inventory.items[j % db.inventory.items.length]; const q = 1 + (j % 3);
    db.inventory.moves.push({ id: 'MV' + ++mv, itemId: it.id, qty: -q, type: 'SALE', to: s.id, date: addDays(today, -(j % 20)), by: 'Front office', amount: q * it.price });
  });
  db.seq.move = mv;

  // ---- Events & calendar ----
  const ev = (o, k) => ({ id: 'EV' + k, end: o.date, audience: 'ALL', details: '', by: 'Principal', notified: true, ...o });
  db.events = [
    ev({ title: 'Annual Sports Day', date: addDays(today, 12), type: 'Sports', details: 'Parents welcome from 8:30 am. House colours.' }, 1),
    ev({ title: 'Parent–teacher meeting, Term 1', date: addDays(today, 5), type: 'Parent meeting', audience: 'PARENTS', details: 'Meet class teachers 9 am to 12 noon.' }, 2),
    ev({ title: 'Periodic Test 2 begins', date: addDays(today, 20), end: addDays(today, 26), type: 'Exam', details: 'Timetable in the app.' }, 3),
    ev({ title: 'Science exhibition', date: addDays(today, 33), type: 'Event' }, 4),
    ev({ title: 'Circular: winter uniform from next Monday', date: addDays(today, -2), type: 'Circular', audience: 'PARENTS' }, 5),
    ev({ title: 'Staff training: first aid', date: addDays(today, 8), type: 'Event', audience: 'STAFF' }, 6)
  ].sort((a, b) => a.date.localeCompare(b.date));
  db.seq.event = 6;

  // Green Valley (the main demo school) takes the Hostel add-on so testers can see it
  const gv = db.tenants.find((t) => t.id === 'T1');
  if (gv) gv.overrides = { ...gv.overrides, CMP_HOSTEL: true };

  // ---- Sales & marketing team (your company) ----
  if (!db.users.some((u) => u.role === 'SALES')) {
    db.users.push({ id: 'U-SALES', name: 'Sales team', login: 'sales@yourapp.example.com', loginType: 'EMAIL', email: 'sales@yourapp.example.com', mobile: '', role: 'SALES', designation: 'Sales Executive',
      status: 'ACTIVE', verified: true, salt: 'gvs', pw: db.users.find((u) => u.role === 'PLATFORM')?.pw || '', failed: 0, createdAt: '2026-11-18T09:00:00Z', lastLogin: null, extra: [], linkedStudent: null, source: 'SEED' });
  }

  // ---- Service Provider: price list, sample proposals, roadmap ----
  db.provider = db.provider || {};
  db.provider.rateCard = structuredClone(DEFAULT_RATE_CARD);
  const p1 = { ...blankOptions(), client: 'Sample Public School (example)', city: 'Mysuru', contact: 'Principal', students: 400, plan: 'GROWTH', messaging: 'SMS', transport: 'BASIC', buses: 4 };
  const p2 = { ...blankOptions(), client: 'Example International Academy', city: 'Pune', contact: 'Trust secretary', board: 'CBSE', students: 2000, plan: 'ENTERPRISE', messaging: 'EMAIL', transport: 'PLUS', buses: 25, residents: 120, hosting: 'DEDICATED_DB', addons: { ANALYTICS: true, BRANDED_APP: true, HOSTEL: true } };
  const p3 = { ...blankOptions(), client: 'Little Steps School (example)', city: 'Hubballi', contact: 'Owner', students: 180, plan: 'STARTER', messaging: 'APP', transport: 'NONE' };
  db.provider.proposals = [
    { id: 'PR1', no: 'PROP-2026-001', status: 'Sent', created: addDays(today, -6), by: 'Sales team', options: p1 },
    { id: 'PR2', no: 'PROP-2026-002', status: 'Draft', created: addDays(today, -1), by: 'Sales team', options: p2 },
    { id: 'PR3', no: 'PROP-2026-003', status: 'Won', created: addDays(today, -20), by: 'Sales team', options: p3 }
  ];
  db.seq.proposal = 3;
  db.provider.demos = [];
  db.provider.roadmap = ROADMAP.map((r) => ({ code: r.code, status: r.code === 'WHATSAPP' ? 'Planned' : 'Idea', priority: r.priority }));

  // ---- Access: the new screens in every department's list ----
  Object.values(departments(db)).forEach(({ name, profiles }) => {
    if (!db.deptPerms?.[name]) return;
    const add = profiles.flatMap((p) => (ACCESS[baseRoleOf(db, p.code)] || []).filter((c) => NEW_CODES_13.includes(c)));
    db.deptPerms[name] = [...new Set([...db.deptPerms[name], ...add])];
  });
  if (db.perms) Object.keys(db.perms).forEach((r) => { db.perms[r] = [...new Set([...db.perms[r], ...(ACCESS[baseRoleOf(db, r)] || []).filter((c) => NEW_CODES_13.includes(c))])]; });
  db.release = 13;
  return db;
}
