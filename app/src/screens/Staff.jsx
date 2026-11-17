import { useState } from 'react';
import { useStore } from '../data/store.js';
import { Page, Card, Field, Input, Select, Status, Tabs } from '../components/ui.jsx';
import { inr, num } from '../lib/format.js';
import { log } from '../lib/logic.js';
import { CHAPTERS } from '../data/seed.js';

export function StaffList() {
  const { db, session } = useStore();
  const pay = ['ADMIN', 'ACCOUNTANT', 'PRINCIPAL'].includes(session.role);
  return (
    <Page title="All staff" sub={`${db.staff.length} staff members`}>
      <div className="tw"><table className="t">
        <thead><tr><th>Code</th><th>Name</th><th>Short code</th><th>Department</th><th>Designation</th><th>Mobile</th><th>Email</th>{pay && <th className="num">Gross / month</th>}<th>Status</th></tr></thead>
        <tbody>{db.staff.map((s) => <tr key={s.id}><td>{s.code}</td><td className="b">{s.first} {s.last}</td><td>{s.short}</td><td>{s.dept}</td><td>{s.desig}</td><td>{s.mobile}</td><td>{s.email}</td>
          {pay && <td className="num">{inr(s.salary.Basic + s.salary.HRA + s.salary.DA + s.salary.Transport)}</td>}<td><Status s={s.status} /></td></tr>)}</tbody>
      </table></div>
    </Page>
  );
}

export function AddStaff() {
  const { run, notify, session } = useStore();
  const blank = { first: '', last: '', short: '', dept: 'Science', desig: 'TGT', mobile: '', email: '', basic: 30000 };
  const [f, setF] = useState(blank);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const err = !f.first ? 'First name is required' : !/^[6-9]\d{9}$/.test(f.mobile) ? 'Mobile must be 10 digits' : !f.short ? 'Short code is used on the timetable' : '';
  const save = () => {
    const s = run((d) => {
      const b = Number(f.basic);
      const st = { id: 'E' + (100 + d.staff.length), code: 'EMP-' + String(300 + d.staff.length).padStart(4, '0'), first: f.first, last: f.last, short: f.short.toUpperCase(), dept: f.dept, desig: f.desig,
        mobile: f.mobile, email: f.email, join: new Date().toISOString().slice(0, 10), salary: { Basic: b, HRA: Math.round(b * 0.4), DA: Math.round(b * 0.1), Transport: 1600, PF: Math.round(b * 0.12), Tax: 0 }, status: 'Active' };
      d.staff.push(st); log(d, session.role, 'Staff added', st.code + ' ' + st.first); return st;
    });
    notify(`Added ${s.first} — ${s.code}`); setF(blank);
  };
  return (
    <Page title="Add staff">
      <Card><div className="form">
        <Field label="First name" req><Input value={f.first} onChange={set('first')} /></Field>
        <Field label="Last name"><Input value={f.last} onChange={set('last')} /></Field>
        <Field label="Short code (timetable)" req><Input value={f.short} onChange={set('short')} maxLength={10} /></Field>
        <Field label="Department"><Select value={f.dept} onChange={set('dept')} options={['English', 'Mathematics', 'Science', 'Social Science', 'Languages', 'Computers', 'Sports', 'Accounts', 'Administration']} /></Field>
        <Field label="Designation"><Select value={f.desig} onChange={set('desig')} options={['PRT', 'TGT', 'PGT', 'Coordinator', 'Accountant', 'Office Assistant', 'Driver']} /></Field>
        <Field label="Mobile" req><Input value={f.mobile} onChange={set('mobile')} maxLength={10} /></Field>
        <Field label="Email"><Input value={f.email} onChange={set('email')} /></Field>
        <Field label="Basic pay / month"><Input type="number" value={f.basic} onChange={set('basic')} /></Field>
      </div></Card>
      <div className="row end"><span className="small muted">{err}</span><button className="btn pri" disabled={!!err} onClick={save}>Save staff</button></div>
    </Page>
  );
}

export function StaffAttendance() {
  const { db } = useStore();
  return <Page title="Staff attendance" sub="Biometric or app check-in; today's summary"><div className="tw"><table className="t"><thead><tr><th>Name</th><th>Department</th><th>In</th><th>Out</th><th>Status</th></tr></thead>
    <tbody>{db.staff.map((s, i) => <tr key={s.id}><td>{s.first} {s.last}</td><td>{s.dept}</td><td>{i % 9 === 4 ? '—' : `08:${String(30 + (i * 7) % 29).padStart(2, '0')}`}</td><td>—</td><td><Status s={i % 9 === 4 ? 'On leave' : 'Active'} /></td></tr>)}</tbody></table></div></Page>;
}

export function Leave() {
  const { db, session, notify } = useStore();
  const [reqs, setReqs] = useState([{ who: 'Kiran Kumar', type: 'Casual', from: '2026-11-20', days: 1, status: 'Pending approval' }, { who: 'Sonia Mehta', type: 'Sick', from: '2026-11-12', days: 2, status: 'Approved' }]);
  const can = ['ADMIN', 'PRINCIPAL'].includes(session.role);
  return <Page title="Leave requests" actions={session.role === 'TEACHER' && <button className="btn pri" onClick={() => { setReqs([{ who: 'Sonia Mehta', type: 'Casual', from: '2026-11-25', days: 1, status: 'Pending approval' }, ...reqs]); notify('Leave request sent to Principal'); }}>Apply for leave</button>}>
    <div className="tw"><table className="t"><thead><tr><th>Staff</th><th>Type</th><th>From</th><th>Days</th><th>Status</th><th /></tr></thead>
      <tbody>{reqs.map((r, i) => <tr key={i}><td>{r.who}</td><td>{r.type}</td><td>{r.from}</td><td>{r.days}</td><td><Status s={r.status} /></td>
        <td>{can && r.status === 'Pending approval' && <button className="btn sm" onClick={() => setReqs(reqs.map((x, k) => (k === i ? { ...x, status: 'Approved' } : x)))}>Approve</button>}</td></tr>)}</tbody></table></div>
    <p className="small muted">{db.staff.length} staff · leave balances are kept per leave type in production.</p></Page>;
}

export function Classes() {
  const { db } = useStore();
  return <Page title="Classes & sections" sub="Grade IX uses the six sections from the school's timetable (S1–S3, W1–W3)."><div className="tw"><table className="t">
    <thead><tr><th>Class</th><th>Board</th><th>Sections</th><th className="num">Students</th></tr></thead>
    <tbody>{db.classes.map((c) => { const secs = db.sections.filter((x) => x.classId === c.id); return <tr key={c.id}><td className="b">{c.name}</td><td>{c.board}</td>
      <td>{secs.map((x) => { const t = db.staff.find((s) => s.id === x.teacherId); return <span key={x.id} className="pill" style={{ marginRight: 4 }}>{x.name} · {t?.short}</span>; })}</td>
      <td className="num">{db.students.filter((s) => secs.some((x) => x.id === s.sectionId)).length}</td></tr>; })}</tbody></table></div></Page>;
}

export function Syllabus() {
  const { db } = useStore();
  const [tab, setTab] = useState('CBSE');
  const boards = [['CBSE', 'CBSE'], ['ICSE', 'CISCE (ICSE/ISC)'], ['IB', 'IB (PYP/MYP/DP)'], ['STATE', 'State boards']];
  return (
    <Page title="Boards, syllabus & textbooks" sub="Teachers pick topics from here when building a question paper.">
      <Tabs tabs={boards} value={tab} onChange={setTab} />
      {tab === 'CBSE' ? (
        <Card title="Class X · Mathematics · NCERT textbook" right={<span className="small muted">{db.questions.length} questions in the bank</span>}>
          <table className="t"><thead><tr><th>Ch.</th><th>Chapter</th><th>Topics</th><th className="num">Questions</th></tr></thead>
            <tbody>{CHAPTERS.map(([n, name, topics]) => <tr key={n}><td>{n}</td><td className="b">{name}</td><td>{topics.join(' · ')}</td><td className="num">{num(db.questions.filter((q) => q.chapter === n).length)}</td></tr>)}</tbody></table>
        </Card>
      ) : <Card><p>Chapters and topics for this board are loaded per grade by the platform team. In the test build only CBSE Class X Mathematics is filled in.</p>
        <p className="muted small">{tab === 'ICSE' ? 'ICSE uses a two-section paper (Section A compulsory, any four from Section B).' : tab === 'IB' ? 'IB MYP is assessed on criteria A–D (0–8 each) instead of marks per question.' : 'Maharashtra, Karnataka, Tamil Nadu, Telangana and Andhra Pradesh templates are included.'}</p></Card>}
    </Page>
  );
}
