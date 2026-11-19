// Campus Services (release 13): Library, Hostel, Homework, Online Classes, Inventory & Store, Events & Calendar
import { useState } from 'react';
import { useStore } from '../data/store.js';
import { Page, Card, Field, Input, Select, Modal, Pill, Stat, Tabs, Progress } from '../components/ui.jsx';
import { log } from '../lib/logic.js';
import { alert as sendAlert } from '../lib/alerts.js';
import { myChildren } from './Requests.jsx';
import {
  today, daysBetween, studentName, classOf, available, onLoan, fineFor, overdue, addBook, issueBook, returnBook,
  occupancy, freeBeds, residentsOf, allocate, vacate, hostelFee, setHomework, markHomework, homeworkStats, studentsInSection,
  scheduleClass, classAttendance, stockOf, lowStock, receiveStock, sellItem, salesTotal, EVENT_TYPES, AUDIENCES, addEvent, calendar, audienceUsers
} from '../lib/campus.js';

const inr = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
const dmy = (d) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const sectionOptions = (db) => db.sections.map((s) => [s.id, classOf(db, { sectionId: s.id })]);
const SUBJECTS = ['English', 'Mathematics', 'Science', 'Social Science', 'Hindi', 'Kannada', 'Computers', 'EVS', 'Physics', 'Chemistry', 'Biology'];

function useAct() {
  const { run, notify, session } = useStore();
  return { session, act: (fn, msg) => { try { const r = run(fn); notify(typeof msg === 'function' ? msg(r) : msg); return r || true; } catch (e) { notify(e.message); return false; } } };
}
const may = (session, roles) => roles.includes(session.role);

// Find a student by name or admission number
export function StudentPick({ value, onChange, label = 'Student', filter = () => true }) {
  const { db } = useStore();
  const [q, setQ] = useState('');
  const hits = q.length > 1 ? db.students.filter((s) => s.status === 'Active' && filter(s) && `${s.first} ${s.last} ${s.admNo}`.toLowerCase().includes(q.toLowerCase())).slice(0, 6) : [];
  return <Field label={label} req>
    {value ? <div className="row"><b>{studentName(db, value)}</b><span className="small muted">{classOf(db, db.students.find((s) => s.id === value))}</span><button type="button" className="btn sm" onClick={() => onChange(null)}>Change</button></div>
      : <><Input placeholder="Type a name or admission number" value={q} onChange={(e) => setQ(e.target.value)} aria-label={label + ' search'} />
        <div>{hits.map((s) => <button type="button" key={s.id} className="btn sm" style={{ margin: 3 }} onClick={() => { onChange(s.id); setQ(''); }}>{s.first} {s.last} · {classOf(db, s)}</button>)}</div></>}
  </Field>;
}

// ---------------------------------------------------------------- Library
export function Library() {
  const { db, session } = useStore();
  const { act } = useAct();
  const [tab, setTab] = useState('loans');
  const [q, setQ] = useState('');
  const [book, setBook] = useState(null);
  const [issue, setIssue] = useState({ studentId: null, bookId: '' });
  const can = may(session, ['ADMIN', 'PRINCIPAL', 'FRONT_OFFICE', 'TEACHER']);
  const L = db.library;
  const late = overdue(db);
  const open = L.loans.filter((l) => !l.returned);
  const fines = L.loans.reduce((s, l) => s + (l.returned ? l.fine : fineFor(l)), 0);
  const books = L.books.filter((b) => `${b.title} ${b.author} ${b.subject}`.toLowerCase().includes(q.toLowerCase()));
  const remind = (l) => {
    const s = db.students.find((x) => x.id === l.studentId);
    const parents = db.users.filter((u) => u.role === 'PARENT' && (u.linkedStudent === s.admNo || (u.children || []).includes(s.admNo)));
    act((d) => sendAlert(d, { to: parents.map((u) => u.id), title: `Library book overdue: ${L.books.find((b) => b.id === l.bookId).title}`, body: `${studentName(d, l.studentId)} was due to return it on ${dmy(l.due)}. Fine so far ${inr(fineFor(l))}.` }),
      parents.length ? `Reminder sent to ${parents.length} parent(s)` : 'No parent account linked — reminder not sent');
  };
  return <Page title="Library" sub={`Books, copies on the shelf, issue and return. Loans last ${L.rules.days} days; ${inr(L.rules.finePerDay)} a day fine when late; up to ${L.rules.maxBooks} books per student.`}>
    <div className="kpis"><Stat label="Titles" value={L.books.length} sub={`${L.books.reduce((s, b) => s + b.copies, 0)} copies`} /><Stat label="On loan" value={open.length} /><Stat label="Overdue" value={late.length} /><Stat label="Fines" value={inr(fines)} sub="returned and running" /></div>
    <Tabs tabs={[['loans', 'Issue & return'], ['catalogue', 'Catalogue'], ['overdue', `Overdue (${late.length})`]]} value={tab} onChange={setTab} />
    {tab === 'loans' && <div className="grid g-side">
      <Card title={`On loan (${open.length})`}><div className="tw"><table className="t"><thead><tr><th>Book</th><th>Student</th><th>Issued</th><th>Due</th><th /></tr></thead>
        <tbody>{open.sort((a, b) => a.due.localeCompare(b.due)).map((l) => <tr key={l.id}><td>{L.books.find((b) => b.id === l.bookId)?.title}</td><td>{studentName(db, l.studentId)}<div className="small muted">{classOf(db, db.students.find((s) => s.id === l.studentId))}</div></td><td>{dmy(l.issued)}</td>
          <td>{dmy(l.due)}{l.due < today() && <> <Pill kind="bad">{daysBetween(l.due, today())} days late</Pill></>}</td>
          <td>{can && <button className="btn sm" onClick={() => act((d) => returnBook(d, l.id), (r) => (r.fine ? `Returned — fine ${inr(r.fine)} to collect` : 'Returned on time'))}>Return</button>}</td></tr>)}</tbody></table></div></Card>
      {can && <Card title="Issue a book">
        <StudentPick value={issue.studentId} onChange={(v) => setIssue({ ...issue, studentId: v })} />
        <Field label="Book" req><Select aria-label="Book" value={issue.bookId} onChange={(e) => setIssue({ ...issue, bookId: e.target.value })} options={[['', 'Pick a book'], ...L.books.filter((b) => available(db, b.id) > 0).map((b) => [b.id, `${b.title} (${available(db, b.id)} on shelf)`])]} /></Field>
        <div className="row end"><button className="btn pri" onClick={() => { if (act((d) => issueBook(d, issue), (l) => `Issued — due back ${dmy(l.due)}`)) setIssue({ studentId: null, bookId: '' }); }}>Issue</button></div>
      </Card>}
    </div>}
    {tab === 'catalogue' && <Card title="Catalogue" right={<div className="row"><Input placeholder="Search title, author, subject" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search books" />{can && <button className="btn pri" onClick={() => setBook({ title: '', author: '', subject: 'Fiction', copies: 1, shelf: '' })}>Add book</button>}</div>}>
      <div className="tw"><table className="t"><thead><tr><th>Title</th><th>Author</th><th>Subject</th><th>Shelf</th><th>Copies</th><th>On shelf</th></tr></thead>
        <tbody>{books.map((b) => <tr key={b.id}><td className="b">{b.title}</td><td>{b.author}</td><td>{b.subject}</td><td>{b.shelf}</td><td>{b.copies}</td><td>{available(db, b.id)}{onLoan(db, b.id) > 0 && <span className="small muted"> · {onLoan(db, b.id)} out</span>}</td></tr>)}</tbody></table></div></Card>}
    {tab === 'overdue' && <Card title="Overdue books">{late.length ? <div className="tw"><table className="t"><thead><tr><th>Student</th><th>Book</th><th>Due</th><th>Days late</th><th>Fine so far</th><th /></tr></thead>
      <tbody>{late.map((l) => <tr key={l.id}><td>{studentName(db, l.studentId)}</td><td>{L.books.find((b) => b.id === l.bookId)?.title}</td><td>{dmy(l.due)}</td><td>{daysBetween(l.due, today())}</td><td>{inr(fineFor(l))}</td><td>{can && <button className="btn sm" onClick={() => remind(l)}>Remind parent</button>}</td></tr>)}</tbody></table></div> : <p className="muted">Nothing overdue.</p>}</Card>}
    {book && <Modal title="Add a book" onClose={() => setBook(null)} actions={<button className="btn pri" onClick={() => { if (act((d) => addBook(d, book), 'Book added')) setBook(null); }}>Save</button>}>
      <div className="form">
        <Field label="Title" req><Input value={book.title} onChange={(e) => setBook({ ...book, title: e.target.value })} /></Field>
        <Field label="Author"><Input value={book.author} onChange={(e) => setBook({ ...book, author: e.target.value })} /></Field>
        <Field label="Subject"><Select value={book.subject} onChange={(e) => setBook({ ...book, subject: e.target.value })} options={['Fiction', 'Non-fiction', 'Biography', 'Textbook', 'Reference', 'Science', 'History', 'Language', 'Computers', 'General']} /></Field>
        <Field label="Copies" req><Input type="number" min="1" value={book.copies} onChange={(e) => setBook({ ...book, copies: e.target.value })} /></Field>
        <Field label="Shelf"><Input value={book.shelf} onChange={(e) => setBook({ ...book, shelf: e.target.value })} placeholder="e.g. B-2" /></Field>
      </div></Modal>}
  </Page>;
}

// ---------------------------------------------------------------- Hostel
export function Hostel() {
  const { db, session } = useStore();
  const { act } = useAct();
  const [add, setAdd] = useState(null);
  const can = may(session, ['ADMIN', 'PRINCIPAL', 'FRONT_OFFICE', 'ACCOUNTANT']);
  const H = db.hostel;
  const occ = occupancy(db);
  const res = H.residents.filter((r) => !r.left);
  const stu = add?.studentId && db.students.find((s) => s.id === add.studentId);
  const rooms = stu ? H.rooms.filter((r) => { const b = H.blocks.find((x) => x.id === r.blockId); return (b.gender === 'Any' || b.gender === stu.gender) && freeBeds(db, r.id) > 0; }) : [];
  return <Page title="Hostel" sub={`Blocks, rooms and beds, who stays where, and the monthly hostel fee (room ${inr(H.fees.room)}, mess ${inr(H.fees.mess)}).`}
    actions={can && <button className="btn pri" onClick={() => setAdd({ studentId: null, roomId: '', mess: true })}>Give a bed</button>}>
    <div className="kpis"><Stat label="Beds" value={occ.reduce((s, b) => s + b.beds, 0)} /><Stat label="Occupied" value={res.length} sub={`${Math.round((100 * res.length) / Math.max(1, occ.reduce((s, b) => s + b.beds, 0)))}% full`} /><Stat label="Free beds" value={occ.reduce((s, b) => s + b.free, 0)} /><Stat label="Hostel fees a month" value={inr(res.reduce((s, r) => s + hostelFee(db, r), 0))} /></div>
    <div className="grid g2">{occ.map((b) => <Card key={b.id} title={b.name} right={<span className="small muted">Warden: {b.warden}</span>}>
      <div className="row small" style={{ marginBottom: 6 }}><span>{b.used} of {b.beds} beds · {b.free} free</span></div><Progress pct={b.pct} label={`${b.name} beds used`} />
      <div className="grid g3" style={{ gap: 8, marginTop: 10 }}>{H.rooms.filter((r) => r.blockId === b.id).map((r) => { const who = residentsOf(db, r.id); return <div key={r.id} className="card" style={{ padding: 8, margin: 0 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}><b>Room {r.no}</b><Pill kind={who.length >= r.beds ? 'warn' : 'ok'}>{who.length}/{r.beds}</Pill></div>
        <div className="small">{who.map((x) => studentName(db, x.studentId)).join(', ') || <span className="muted">Empty</span>}</div></div>; })}</div>
    </Card>)}</div>
    <Card title={`Residents (${res.length})`}><div className="tw"><table className="t"><thead><tr><th>Student</th><th>Class</th><th>Room</th><th>Since</th><th>Mess</th><th>Fee a month</th><th /></tr></thead>
      <tbody>{res.map((r) => { const room = H.rooms.find((x) => x.id === r.roomId); return <tr key={r.id}><td>{studentName(db, r.studentId)}</td><td>{classOf(db, db.students.find((s) => s.id === r.studentId))}</td><td>{H.blocks.find((b) => b.id === room.blockId).name.split(' (')[0]} · {room.no}</td><td>{dmy(r.from)}</td><td>{r.mess ? 'Yes' : 'No'}</td><td>{inr(hostelFee(db, r))}</td>
        <td>{can && <button className="btn sm" onClick={() => act((d) => vacate(d, r.id), `${studentName(db, r.studentId)} moved out — bed is free`)}>Vacate</button>}</td></tr>; })}</tbody></table></div></Card>
    {add && <Modal title="Give a bed" onClose={() => setAdd(null)} actions={<button className="btn pri" onClick={() => { if (act((d) => allocate(d, add), 'Bed given')) setAdd(null); }}>Save</button>}>
      <StudentPick value={add.studentId} onChange={(v) => setAdd({ ...add, studentId: v, roomId: '' })} />
      {stu && <Field label="Room (rooms with a free bed, right block)" req><Select aria-label="Room" value={add.roomId} onChange={(e) => setAdd({ ...add, roomId: e.target.value })} options={[['', rooms.length ? 'Pick a room' : 'No free bed in the right block'], ...rooms.map((r) => [r.id, `${H.blocks.find((b) => b.id === r.blockId).name} · Room ${r.no} · ${freeBeds(db, r.id)} free`])]} /></Field>}
      <label className="row small"><input type="checkbox" checked={add.mess} onChange={(e) => setAdd({ ...add, mess: e.target.checked })} /> Takes meals in the mess (+{inr(H.fees.mess)} a month)</label>
    </Modal>}
  </Page>;
}

// ---------------------------------------------------------------- Homework
const HW_MARK = { DONE: ['Done', 'ok'], LATE: ['Late', 'warn'], MISSING: ['Missing', 'bad'] };
export function Homework() {
  const { db, session } = useStore();
  const { act } = useAct();
  const parent = session.role === 'PARENT';
  const kids = parent ? myChildren(db, session) : [];
  const [sec, setSec] = useState(parent ? kids[0]?.sectionId : db.sections[0].id);
  const [open, setOpen] = useState(null);
  const [form, setForm] = useState(null);
  const can = may(session, ['ADMIN', 'PRINCIPAL', 'TEACHER']);
  const list = db.homework.filter((h) => h.sectionId === sec);
  if (parent) return <Page title="Homework" sub="Homework set for your child's class, and whether the teacher has marked it done.">
    {kids.map((k) => <Card key={k.id} title={`${k.first} · ${classOf(db, k)}`}>
      {db.homework.filter((h) => h.sectionId === k.sectionId).map((h) => <div key={h.id} className="row" style={{ borderTop: '1px solid var(--line)', padding: '8px 0', justifyContent: 'space-between' }}>
        <div><b>{h.title}</b><div className="small muted">{h.subject} · set {dmy(h.set)} · due {dmy(h.due)}</div>{h.details && <div className="small">{h.details}</div>}</div>
        {h.done[k.id] ? <Pill kind={HW_MARK[h.done[k.id]][1]}>{HW_MARK[h.done[k.id]][0]}</Pill> : <Pill>{h.due < today() ? 'Not marked' : 'Due'}</Pill>}</div>)}
    </Card>)}</Page>;
  const h = open && db.homework.find((x) => x.id === open);
  return <Page title="Homework" sub="Set homework for a class, then mark who has done it. Parents see it in the app with their child's status."
    actions={can && <button className="btn pri" onClick={() => setForm({ sectionId: sec, subject: 'English', title: '', details: '', due: today() })}>Set homework</button>}>
    <div className="row" style={{ marginBottom: 10 }}><Field label="Class"><Select aria-label="Class" value={sec} onChange={(e) => { setSec(e.target.value); setOpen(null); }} options={sectionOptions(db)} /></Field></div>
    <Card title={`Homework for ${classOf(db, { sectionId: sec })}`}>{list.length ? <div className="tw"><table className="t"><thead><tr><th>Homework</th><th>Subject</th><th>Set</th><th>Due</th><th>Done</th><th /></tr></thead>
      <tbody>{list.map((x) => { const st = homeworkStats(db, x); return <tr key={x.id}><td className="b">{x.title}</td><td>{x.subject}</td><td>{dmy(x.set)}</td><td>{dmy(x.due)}</td><td style={{ minWidth: 140 }}><Progress pct={st.pct} label={`${x.title} handed in`} /><div className="small muted">{st.done + st.late} of {st.total} · {st.late} late</div></td>
        <td><button className="btn sm" onClick={() => setOpen(x.id)}>{can ? 'Mark' : 'View'}</button></td></tr>; })}</tbody></table></div> : <p className="muted">No homework set for this class yet.</p>}</Card>
    {h && <Modal title={h.title} onClose={() => setOpen(null)}>
      <p className="small muted">{h.subject} · due {dmy(h.due)}</p>
      <div className="tw" style={{ maxHeight: 380 }}><table className="t"><tbody>{studentsInSection(db, h.sectionId).map((s) => <tr key={s.id}><td>{s.roll}. {s.first} {s.last}</td>
        <td><div className="row">{Object.entries(HW_MARK).map(([k, [l]]) => <button key={k} className={'btn sm' + (h.done[s.id] === k ? ' pri' : '')} disabled={!can} aria-pressed={h.done[s.id] === k} aria-label={`${l}: ${s.first} ${s.last}`} onClick={() => act((d) => markHomework(d, h.id, s.id, k), `${s.first}: ${l}`)}>{l}</button>)}</div></td></tr>)}</tbody></table></div>
    </Modal>}
    {form && <Modal title="Set homework" onClose={() => setForm(null)} actions={<button className="btn pri" onClick={() => { if (act((d) => { const x = setHomework(d, { ...form, by: session.name }); log(d, session.name, 'Homework set', `${classOf(d, { sectionId: x.sectionId })} · ${x.title}`); return x; }, 'Homework set — parents see it in the app')) { setSec(form.sectionId); setForm(null); } }}>Save</button>}>
      <div className="form">
        <Field label="Class" req><Select value={form.sectionId} onChange={(e) => setForm({ ...form, sectionId: e.target.value })} options={sectionOptions(db)} /></Field>
        <Field label="Subject" req><Select value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} options={SUBJECTS} /></Field>
        <Field label="What to do" req full><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Exercise 4.2, questions 1 to 10" /></Field>
        <Field label="Details" full><Input value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} /></Field>
        <Field label="Due" req><Input type="date" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} /></Field>
      </div></Modal>}
  </Page>;
}

// ---------------------------------------------------------------- Online classes
export function OnlineClasses() {
  const { db, session } = useStore();
  const { act } = useAct();
  const parent = session.role === 'PARENT';
  const kids = parent ? myChildren(db, session) : [];
  const [tab, setTab] = useState('next');
  const [form, setForm] = useState(null);
  const [att, setAtt] = useState(null);
  const can = may(session, ['ADMIN', 'PRINCIPAL', 'TEACHER']);
  const mine = parent ? db.onlineClasses.filter((c) => kids.some((k) => k.sectionId === c.sectionId)) : db.onlineClasses;
  const t = today();
  const next = mine.filter((c) => c.date >= t).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const past = mine.filter((c) => c.date < t).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  const c = att && db.onlineClasses.find((x) => x.id === att);
  const rows = tab === 'next' ? next : past;
  return <Page title="Online classes" sub={parent ? 'Live classes for your child: join from here at the time shown.' : 'Schedule live classes with a Google Meet, Zoom or Teams link; students and parents join from the app. Mark attendance afterwards.'}
    actions={can && <button className="btn pri" onClick={() => setForm({ sectionId: db.sections[0].id, subject: 'English', date: t, time: '16:00', minutes: 40, link: '' })}>Schedule a class</button>}>
    <Tabs tabs={[['next', `Coming up (${next.length})`], ['past', `Held (${past.length})`]]} value={tab} onChange={setTab} />
    <Card>{rows.length ? <div className="tw"><table className="t"><thead><tr><th>Date</th><th>Time</th><th>Class</th><th>Subject</th><th>Length</th><th>{tab === 'next' ? 'Link' : 'Attendance'}</th>{!parent && tab === 'past' && <th />}</tr></thead>
      <tbody>{rows.map((x) => { const a = classAttendance(db, x); return <tr key={x.id}><td>{dmy(x.date)}</td><td>{x.time}</td><td>{classOf(db, { sectionId: x.sectionId })}</td><td>{x.subject}</td><td>{x.minutes} min</td>
        <td>{tab === 'next' ? <a className="btn sm" href={x.link} target="_blank" rel="noreferrer">Join</a> : <>{a.present} of {a.total} ({a.pct}%)</>}</td>
        {!parent && tab === 'past' && <td>{can && <button className="btn sm" onClick={() => setAtt(x.id)}>Attendance</button>}</td>}</tr>; })}</tbody></table></div> : <p className="muted">{tab === 'next' ? 'No classes scheduled.' : 'No classes held yet.'}</p>}</Card>
    {form && <Modal title="Schedule an online class" onClose={() => setForm(null)} actions={<button className="btn pri" onClick={() => { if (act((d) => scheduleClass(d, { ...form, teacher: session.name }), 'Class scheduled — it shows in the app for the class')) setForm(null); }}>Save</button>}>
      <div className="form">
        <Field label="Class" req><Select value={form.sectionId} onChange={(e) => setForm({ ...form, sectionId: e.target.value })} options={sectionOptions(db)} /></Field>
        <Field label="Subject" req><Select value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} options={SUBJECTS} /></Field>
        <Field label="Date" req><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
        <Field label="Time" req><Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></Field>
        <Field label="Minutes" req><Input type="number" value={form.minutes} onChange={(e) => setForm({ ...form, minutes: e.target.value })} /></Field>
        <Field label="Meeting link" req full><Input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="https://meet.google.com/…" /></Field>
      </div></Modal>}
    {c && <Modal title={`Attendance · ${c.subject} · ${dmy(c.date)}`} onClose={() => setAtt(null)}>
      <div className="tw" style={{ maxHeight: 380 }}><table className="t"><tbody>{studentsInSection(db, c.sectionId).map((s) => { const here = c.attended.includes(s.id); return <tr key={s.id}><td>{s.roll}. {s.first} {s.last}</td>
        <td><label className="row small"><input type="checkbox" checked={here} onChange={() => act((d) => { const x = d.onlineClasses.find((y) => y.id === c.id); x.attended = here ? x.attended.filter((i) => i !== s.id) : [...x.attended, s.id]; }, here ? `${s.first} marked absent` : `${s.first} marked present`)} /> Attended</label></td></tr>; })}</tbody></table></div>
    </Modal>}
  </Page>;
}

// ---------------------------------------------------------------- Inventory & store
export function Inventory() {
  const { db, session } = useStore();
  const { act } = useAct();
  const [mode, setMode] = useState(null);   // { kind: 'IN' | 'SALE', ... }
  const can = may(session, ['ADMIN', 'PRINCIPAL', 'FRONT_OFFICE', 'ACCOUNTANT']);
  const I = db.inventory;
  const low = lowStock(db);
  const month = today().slice(0, 7) + '-01';
  const item = mode && I.items.find((i) => i.id === mode.itemId);
  return <Page title="Inventory & store" sub="Uniforms, books and stationery: stock in hand, sales to students and what needs re-ordering."
    actions={can && <><button className="btn" onClick={() => setMode({ kind: 'IN', itemId: '', qty: 1, note: '' })}>Receive stock</button><button className="btn pri" onClick={() => setMode({ kind: 'SALE', itemId: '', qty: 1, studentId: null })}>Sell to a student</button></>}>
    <div className="kpis"><Stat label="Items" value={I.items.length} /><Stat label="To re-order" value={low.length} sub={low.map((i) => i.name).join(', ') || 'None'} /><Stat label="Sales this month" value={inr(salesTotal(db, month))} /><Stat label="Sales this year" value={inr(salesTotal(db))} /></div>
    <Card title="Stock"><div className="tw"><table className="t"><thead><tr><th>Item</th><th>Category</th><th>Price</th><th>In stock</th><th>Re-order at</th><th /></tr></thead>
      <tbody>{I.items.map((i) => { const n = stockOf(db, i.id); return <tr key={i.id}><td className="b">{i.name}</td><td>{i.category}</td><td>{inr(i.price)}</td><td>{n} {i.unit}</td><td>{i.reorder}</td><td>{n <= i.reorder && <Pill kind="warn">Re-order</Pill>}</td></tr>; })}</tbody></table></div></Card>
    <Card title="Recent stock movements"><div className="tw"><table className="t"><thead><tr><th>Date</th><th>Item</th><th>Type</th><th>Qty</th><th>Student / note</th><th>Amount</th></tr></thead>
      <tbody>{[...I.moves].reverse().slice(0, 15).map((m) => <tr key={m.id}><td>{dmy(m.date)}</td><td>{I.items.find((i) => i.id === m.itemId)?.name}</td><td>{m.type === 'IN' ? 'Received' : m.type === 'SALE' ? 'Sold' : 'Issued'}</td><td>{m.qty > 0 ? '+' : ''}{m.qty}</td><td>{m.to ? studentName(db, m.to) : m.note}</td><td>{m.amount ? inr(m.amount) : '—'}</td></tr>)}</tbody></table></div></Card>
    {mode && <Modal title={mode.kind === 'IN' ? 'Receive stock' : 'Sell to a student'} onClose={() => setMode(null)} actions={<button className="btn pri" onClick={() => {
      const ok = mode.kind === 'IN' ? act((d) => receiveStock(d, { ...mode, by: session.name }), 'Stock added') : act((d) => sellItem(d, { ...mode, by: session.name }), (m) => `Sold — collect ${inr(m.amount)}`);
      if (ok) setMode(null); }}>Save</button>}>
      {mode.kind === 'SALE' && <StudentPick value={mode.studentId} onChange={(v) => setMode({ ...mode, studentId: v })} />}
      <div className="form">
        <Field label="Item" req><Select aria-label="Item" value={mode.itemId} onChange={(e) => setMode({ ...mode, itemId: e.target.value })} options={[['', 'Pick an item'], ...I.items.map((i) => [i.id, `${i.name} (${stockOf(db, i.id)} in stock)`])]} /></Field>
        <Field label="Quantity" req><Input type="number" min="1" value={mode.qty} onChange={(e) => setMode({ ...mode, qty: e.target.value })} /></Field>
        {mode.kind === 'IN' && <Field label="Supplier / note" full><Input value={mode.note} onChange={(e) => setMode({ ...mode, note: e.target.value })} /></Field>}
      </div>
      {mode.kind === 'SALE' && item && <p className="b">Amount: {inr((+mode.qty || 0) * item.price)}</p>}
    </Modal>}
  </Page>;
}

// ---------------------------------------------------------------- Events & calendar
const TYPE_KIND = { Holiday: 'ok', Exam: 'warn', 'Parent meeting': 'info', Circular: '', Sports: 'info', Event: 'info' };
export function Events() {
  const { db, session } = useStore();
  const { act } = useAct();
  const [past, setPast] = useState(false);
  const [form, setForm] = useState(null);
  const can = may(session, ['ADMIN', 'PRINCIPAL', 'FRONT_OFFICE']);
  const t = today();
  const audienceOk = (e) => e.audience === 'ALL' || (session.role === 'PARENT' ? e.audience === 'PARENTS' : e.audience === 'STAFF' || can);
  const items = calendar(db, past ? '0000' : t).filter(audienceOk);
  const months = [...new Set(items.map((e) => e.date.slice(0, 7)))];
  const notify = (e) => act((d) => { const n = sendAlert(d, { to: audienceUsers(d, e.audience).map((u) => u.id), title: `${e.type}: ${e.title}`, body: `${dmy(e.date)}${e.end !== e.date ? ' to ' + dmy(e.end) : ''}. ${e.details}`, screen: 'CMP_EVENTS', email: false }); d.events.find((x) => x.id === e.id).notified = true; return n; }, (n) => `Sent to ${n} people in the app`);
  return <Page title="Events & calendar" sub="School events, exams, parent meetings, circulars and holidays in one calendar. Send each one to parents and staff in the app."
    actions={<>{<label className="row small"><input type="checkbox" checked={past} onChange={(e) => setPast(e.target.checked)} /> Show past</label>}{can && <button className="btn pri" onClick={() => setForm({ title: '', date: t, end: '', type: 'Event', audience: 'ALL', details: '' })}>Add event</button>}</>}>
    {months.map((m) => <Card key={m} title={new Date(m + '-01T00:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}>
      {items.filter((e) => e.date.startsWith(m)).map((e) => <div key={e.id} className="row" style={{ borderTop: '1px solid var(--line)', padding: '8px 0', alignItems: 'flex-start' }}>
        <div style={{ width: 120 }} className="b">{dmy(e.date)}{e.end !== e.date && <div className="small muted">to {dmy(e.end)}</div>}</div>
        <div style={{ flex: 1 }}><div><b>{e.title}</b> <Pill kind={TYPE_KIND[e.type]}>{e.type}</Pill>{e.audience !== 'ALL' && <Pill>{AUDIENCES.find((a) => a[0] === e.audience)[1]} only</Pill>}</div>{e.details && <div className="small">{e.details}</div>}</div>
        {can && !e.holiday && (e.notified ? <span className="small muted">Sent</span> : <button className="btn sm" onClick={() => notify(e)}>Send to {AUDIENCES.find((a) => a[0] === e.audience)[1].toLowerCase()}</button>)}
      </div>)}</Card>)}
    {!months.length && <Card><p className="muted">Nothing on the calendar.</p></Card>}
    {form && <Modal title="Add event" onClose={() => setForm(null)} actions={<button className="btn pri" onClick={() => { if (act((d) => addEvent(d, { ...form, by: session.name }), 'Added to the calendar — send it when ready')) setForm(null); }}>Save</button>}>
      <div className="form">
        <Field label="Title" req full><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
        <Field label="Type"><Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} options={EVENT_TYPES} /></Field>
        <Field label="For"><Select value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} options={AUDIENCES} /></Field>
        <Field label="From" req><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
        <Field label="To (optional)"><Input type="date" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} /></Field>
        <Field label="Details" full><Input value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} /></Field>
      </div></Modal>}
  </Page>;
}
