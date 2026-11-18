import { useState } from 'react';
import { useStore } from '../data/store.js';
import { Page, Card, Field, Input, Select, Status, Tabs, Modal, Stat } from '../components/ui.jsx';
import { Register, RangeFilter, Legend, useRange } from '../components/Register.jsx';
import { staffMark, setStaffMark } from '../lib/attendance.js';
import { leaveTypes, balances, checkLeave, leaveDays, applyLeave, decideLeave, cancelLeave, canApprove, approversFor, LEAVE_STATUS } from '../lib/leave.js';
import { gross } from '../lib/dashboard.js';
import { inr, num, dmy, todayISO } from '../lib/format.js';
import { log } from '../lib/logic.js';
import { CHAPTERS } from '../data/seed.js';

const DEPTS = ['English', 'Mathematics', 'Science', 'Social Science', 'Languages', 'Computers', 'Primary', 'Sports', 'Leadership', 'Accounts', 'Administration', 'Transport'];
const DESIGS = ['PRT', 'TGT', 'PGT', 'Coordinator', 'Head of Department', 'Vice Principal', 'Principal', 'Accountant', 'Office Assistant', 'Receptionist', 'Transport In-charge', 'Driver', 'Bus Helper / Attendant'];

export function StaffList() {
  const { db, session } = useStore();
  const pay = ['ADMIN', 'ACCOUNTANT', 'PRINCIPAL'].includes(session.role);
  const canAdd = ['ADMIN', 'PRINCIPAL'].includes(session.role);
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('');
  const [type, setType] = useState('');
  const [form, setForm] = useState(null);
  const rows = db.staff.filter((s) => (!dept || s.dept === dept) && (!type || (s.type || 'Full time') === type) && (!q || `${s.first} ${s.last} ${s.code} ${s.desig}`.toLowerCase().includes(q.toLowerCase())));
  const depts = [...new Set(db.staff.map((s) => s.dept))].sort();
  return (
    <Page title="All staff" sub={`${rows.length} of ${db.staff.length} staff · ${db.staff.filter((s) => (s.type || 'Full time') === 'Full time').length} full time · ${db.staff.filter((s) => s.type === 'Part time').length} part time`}
      actions={canAdd && <button className="btn pri" onClick={() => setForm({})}>Add staff</button>}>
      <div className="row" style={{ marginBottom: 12 }}>
        <Input placeholder="Search name, code or designation" aria-label="Search staff" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 260 }} />
        <Select aria-label="Department" value={dept} onChange={(e) => setDept(e.target.value)} options={[['', 'All departments'], ...depts]} />
        <Select aria-label="Employment type" value={type} onChange={(e) => setType(e.target.value)} options={[['', 'Full and part time'], 'Full time', 'Part time']} />
      </div>
      <div className="tw"><table className="t">
        <thead><tr><th>Code</th><th>Name</th><th>Short code</th><th>Department</th><th>Designation</th><th>Type</th><th>Mobile</th><th>Email</th>{pay && <th className="num">Gross / month</th>}<th>Status</th>{canAdd && <th />}</tr></thead>
        <tbody>{rows.map((s) => <tr key={s.id}><td>{s.code}</td><td className="b">{s.first} {s.last}</td><td>{s.short}</td><td>{s.dept}</td><td>{s.desig}</td><td>{s.type || 'Full time'}</td><td>{s.mobile}</td><td>{s.email}</td>
          {pay && <td className="num">{inr(gross(s))}</td>}<td><Status s={s.status} /></td>{canAdd && <td><button className="btn sm" onClick={() => setForm(s)}>Edit</button></td>}</tr>)}</tbody>
      </table></div>
      {form && <StaffForm staff={form.id ? form : null} onClose={() => setForm(null)} />}
    </Page>
  );
}

// Add or edit a staff member (opened from All Staff). Adding to the staff record is what lets the person register for an account.
export function StaffForm({ staff, onClose }) {
  const { db, run, notify, session } = useStore();
  const blank = { first: '', last: '', short: '', gender: 'Female', dept: 'Science', desig: 'TGT', type: 'Full time', mobile: '', email: '', join: todayISO(), basic: 30000 };
  const [f, setF] = useState(staff ? { ...staff, basic: staff.salary?.Basic || 0 } : blank);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const dupe = db.staff.find((x) => x.id !== staff?.id && (x.mobile === f.mobile || (f.email && x.email === f.email)));
  const err = !f.first ? 'First name is required' : !/^[6-9]\d{9}$/.test(f.mobile) ? 'Mobile must be 10 digits' : !f.short ? 'Short code is used on the timetable' : f.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email) ? 'Email looks wrong' : dupe ? `${dupe.first} ${dupe.last} already has this mobile or email` : !(+f.basic > 0) ? 'Basic pay must be more than 0' : '';
  const save = () => {
    const st = run((d) => {
      const b = Number(f.basic);
      const salary = { Basic: b, HRA: Math.round(b * 0.4), DA: Math.round(b * 0.1), Transport: f.type === 'Part time' ? 0 : 1600, PF: Math.round(b * 0.12), Tax: staff?.salary?.Tax || 0 };
      if (staff) { const x = d.staff.find((y) => y.id === staff.id); Object.assign(x, { first: f.first, last: f.last, short: f.short.toUpperCase(), gender: f.gender, dept: f.dept, desig: f.desig, type: f.type, mobile: f.mobile, email: f.email, join: f.join, salary }); log(d, session.role, 'Staff updated', x.code); return x; }
      const n = d.staff.length + 1;
      const x = { id: 'E' + (100 + n), code: 'EMP-' + String(300 + n).padStart(4, '0'), first: f.first, last: f.last, short: f.short.toUpperCase(), gender: f.gender, dept: f.dept, desig: f.desig, type: f.type, mobile: f.mobile, email: f.email, join: f.join, salary, status: 'Active' };
      d.staff.push(x); log(d, session.role, 'Staff added', x.code + ' ' + x.first); return x;
    });
    notify(staff ? `Saved ${st.first}` : `Added ${st.first} — employee code ${st.code}. They can now register with this code.`); onClose();
  };
  return <Modal title={staff ? `Edit ${staff.first} ${staff.last} · ${staff.code}` : 'Add staff'} onClose={onClose} actions={<><span className="small muted">{err}</span><button className="btn pri" disabled={!!err} onClick={save}>{staff ? 'Save' : 'Save staff'}</button></>}>
    <div className="form">
      <Field label="First name" req><Input value={f.first} onChange={set('first')} /></Field>
      <Field label="Last name"><Input value={f.last} onChange={set('last')} /></Field>
      <Field label="Gender"><Select value={f.gender} onChange={set('gender')} options={['Female', 'Male', 'Other']} /></Field>
      <Field label="Short code (timetable)" req><Input value={f.short} onChange={set('short')} maxLength={10} /></Field>
      <Field label="Department"><Select value={f.dept} onChange={set('dept')} options={[...new Set([...DEPTS, f.dept])]} /></Field>
      <Field label="Designation"><Select value={f.desig} onChange={set('desig')} options={[...new Set([...DESIGS, f.desig])]} /></Field>
      <Field label="Employment type"><Select value={f.type} onChange={set('type')} options={['Full time', 'Part time']} /></Field>
      <Field label="Date of joining"><Input type="date" value={f.join} onChange={set('join')} /></Field>
      <Field label="Mobile" req><Input value={f.mobile} onChange={set('mobile')} maxLength={10} /></Field>
      <Field label="Email"><Input value={f.email} onChange={set('email')} /></Field>
      <Field label="Basic pay / month"><Input type="number" value={f.basic} onChange={set('basic')} /></Field>
    </div>
    {!staff && <p className="small muted">The employee code is generated on save. The person registers on the website or app with this code, their name and this mobile or email — no approval is needed.</p>}
  </Modal>;
}

export function StaffAttendance() {
  const { db, mutate, session } = useStore();
  const [dept, setDept] = useState('');
  const [range, setRange] = useRange();
  const can = ['ADMIN', 'PRINCIPAL'].includes(session.role);
  const list = db.staff.filter((s) => s.status === 'Active' && (!dept || s.dept === dept)).sort((a, b) => a.dept.localeCompare(b.dept) || a.first.localeCompare(b.first));
  const rows = list.map((s) => ({ id: s.id, name: `${s.first} ${s.last}`, sub: `${s.desig} · ${s.type || 'Full time'}`, s }));
  const t = todayISO();
  const today = list.map((s) => staffMark(db, s, t));
  return <Page title="Staff attendance register" sub="One row per staff member, one column per day. Approved leave shows as L (½ for a half day) and can't be changed here; tap any other day to switch Present → Absent → Half day.">
    <Card><div className="row" style={{ alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
      <label className="f">Department<Select aria-label="Department" value={dept} onChange={(e) => setDept(e.target.value)} options={[['', 'All departments'], ...[...new Set(db.staff.map((s) => s.dept))].sort()]} /></label>
      <RangeFilter range={range} setRange={setRange} />
    </div>
    <div className="row small" style={{ marginTop: 8, gap: 14 }}><span>Today: <b>{today.filter((m) => m === 'P' || m === 'HALF').length}</b> present</span><span><b>{today.filter((m) => m === 'A').length}</b> absent</span><span><b>{today.filter((m) => m === 'L').length}</b> on leave</span></div>
    <Legend /></Card>
    <Register db={db} rows={rows} range={range} label="Staff attendance register" next={{ P: 'A', A: 'HALF', HALF: 'P' }} mark={(r, d) => staffMark(db, r.s, d)}
      onSet={can ? (r, d, m) => mutate((x) => setStaffMark(x, x.staff.find((y) => y.id === r.id), d, m)) : null} canEdit={(r, d, m) => m !== 'L'} />
    {!can && <p className="small muted">Only the Admin and the Principal change staff attendance.</p>}
  </Page>;
}

const leaveName = (db, code) => leaveTypes(db).find((t) => t.code === code)?.name || code;
const staffName = (db, id) => { const s = db.staff.find((x) => x.id === id); return s ? `${s.first} ${s.last}` : '—'; };
const when = (r) => (r.from === r.to ? dmy(r.from) : `${dmy(r.from)} – ${dmy(r.to)}`) + (r.half ? ' (half day)' : '');

// Staff → Leave Requests: approvers decide; everyone with the screen sees all requests, the summary and the leave types
export function Leave() {
  const { db, run, notify, session } = useStore();
  const me = db.users.find((u) => u.id === session.userId);
  const [tab, setTab] = useState('pending');
  const [decline, setDecline] = useState(null);
  const [fs, setFs] = useState({ status: '', type: '', staff: '' });
  const [types, setTypes] = useState(null);
  const all = db.staffLeaves || [];
  const pending = all.filter((r) => r.status === 'PENDING');
  const mine = pending.filter((r) => canApprove(db, me?.id, r));
  const canEditTypes = ['ADMIN', 'PRINCIPAL'].includes(session.role);
  const act = (id, decision, note = '') => { try { run((d) => decideLeave(d, id, decision, me, note)); notify(decision === 'APPROVED' ? 'Approved — the staff member is told and the register shows the leave' : 'Declined — the staff member is told why'); setDecline(null); } catch (e) { notify(e.message); } };
  const list = all.filter((r) => (!fs.status || r.status === fs.status) && (!fs.type || r.type === fs.type) && (!fs.staff || r.staffId === fs.staff));
  const row = (r, actions) => <tr key={r.id}><td className="b">{staffName(db, r.staffId)}</td><td>{leaveName(db, r.type)}</td><td>{when(r)}</td><td className="num">{r.days}</td><td className="small">{r.reason}</td>
    <td><Status s={LEAVE_STATUS[r.status]} />{r.decidedBy && <div className="small muted">{r.decidedBy}{r.note ? ' — ' + r.note : ''}</div>}</td>{actions && <td>{actions}</td>}</tr>;
  const staffWithLeave = db.staff.filter((s) => s.status === 'Active');
  return <Page title="Leave requests" sub="Approvers are told in the app and by email when a request comes in: the Principal and Vice Principal for teaching staff, the Principal and Admin for everyone else. Staff apply in My Space → My Leave.">
    <Tabs tabs={[['pending', `Waiting for approval (${pending.length})`], ['all', `All requests (${all.length})`], ['summary', 'Leave taken by staff'], ['types', 'Leave types']]} value={tab} onChange={setTab} />
    {tab === 'pending' && <div className="tw" style={{ marginTop: 12 }}><table className="t" aria-label="Leave waiting for approval"><thead><tr><th>Staff</th><th>Leave</th><th>Dates</th><th className="num">Days</th><th>Reason</th><th>Status</th><th /></tr></thead>
      <tbody>{pending.length ? pending.map((r) => row(r, canApprove(db, me?.id, r) ? <div className="row"><button className="btn sm pri" onClick={() => act(r.id, 'APPROVED')}>Approve</button><button className="btn sm" onClick={() => setDecline({ id: r.id, note: '' })}>Decline</button></div>
        : <span className="small muted">For {r.approvers.map((u) => db.users.find((x) => x.id === u)?.name).filter(Boolean).join(' or ')}</span>)) : <tr><td colSpan={7} className="muted">Nothing waiting.</td></tr>}</tbody></table>
      <p className="small muted">{mine.length ? `${mine.length} waiting for you.` : 'None of these are waiting for you.'}</p></div>}
    {tab === 'all' && <div style={{ marginTop: 12 }}><div className="row" style={{ marginBottom: 10 }}>
      <Select aria-label="Status" value={fs.status} onChange={(e) => setFs({ ...fs, status: e.target.value })} options={[['', 'Any status'], ...Object.entries(LEAVE_STATUS)]} />
      <Select aria-label="Leave type" value={fs.type} onChange={(e) => setFs({ ...fs, type: e.target.value })} options={[['', 'Any leave type'], ...leaveTypes(db).map((t) => [t.code, t.name])]} />
      <Select aria-label="Staff member" value={fs.staff} onChange={(e) => setFs({ ...fs, staff: e.target.value })} options={[['', 'All staff'], ...staffWithLeave.map((s) => [s.id, `${s.first} ${s.last}`])]} /></div>
      <div className="tw"><table className="t" aria-label="All leave requests"><thead><tr><th>Staff</th><th>Leave</th><th>Dates</th><th className="num">Days</th><th>Reason</th><th>Status</th></tr></thead><tbody>{list.map((r) => row(r))}</tbody></table></div></div>}
    {tab === 'summary' && <div className="tw" style={{ marginTop: 12 }}><table className="t small" aria-label="Leave taken by staff"><thead><tr><th>Staff</th><th>Type</th>{leaveTypes(db).map((t) => <th key={t.code} className="num">{t.name.replace(' leave', '')}</th>)}<th className="num">Total taken</th><th className="num">Waiting</th></tr></thead>
      <tbody>{staffWithLeave.map((s) => { const b = balances(db, s.id); const cell = (code) => { const x = b.find((y) => y.code === code); return x ? `${x.taken}${x.days != null ? ' / ' + x.days : ''}` : '—'; };
        return <tr key={s.id}><td className="b">{s.first} {s.last}</td><td>{s.type || 'Full time'}</td>{leaveTypes(db).map((t) => <td key={t.code} className="num">{cell(t.code)}</td>)}<td className="num b">{b.reduce((a, x) => a + x.taken, 0)}</td><td className="num">{b.reduce((a, x) => a + x.pending, 0) || '—'}</td></tr>; })}</tbody></table>
      <p className="small muted">Taken / allowed this year. — means the leave type doesn't apply (for example earned leave for part-time staff).</p></div>}
    {tab === 'types' && <Card title="Leave types and how much staff can take each year" right={canEditTypes && !types && <button className="btn sm" onClick={() => setTypes(leaveTypes(db).map((t) => ({ ...t })))}>Change allowances</button>}>
      <table className="t" aria-label="Leave types"><thead><tr><th>Leave type</th><th className="num">Days a year</th><th className="num">Most at a time</th><th>Who</th><th>Rules</th></tr></thead>
        <tbody>{(types || leaveTypes(db)).map((t, i) => <tr key={t.code}><td className="b">{t.name}</td>
          <td className="num">{types && t.days != null ? <Input type="number" min="0" aria-label={t.name + ' days'} value={t.days} onChange={(e) => setTypes(types.map((x, k) => (k === i ? { ...x, days: e.target.value } : x)))} style={{ width: 80 }} /> : t.days ?? 'No limit'}</td>
          <td className="num">{t.maxAtOnce || '—'}</td><td>{t.gender ? (t.gender === 'Female' ? 'Women' : 'Men') : t.fullTimeOnly ? 'Full-time staff' : 'Everyone'}</td><td className="small">{t.note}</td></tr>)}</tbody></table>
      {types && <div className="row end" style={{ marginTop: 10 }}><button className="btn" onClick={() => setTypes(null)}>Cancel</button><button className="btn pri" onClick={() => {
        if (types.some((t) => t.days != null && !(+t.days >= 0))) { notify('Days must be 0 or more'); return; }
        run((d) => { d.leaveTypes = types.map((t) => ({ ...t, days: t.days == null ? null : +t.days })); log(d, session.name || session.role, 'Leave allowances changed', ''); }); setTypes(null); notify('Leave allowances saved'); }}>Save</button></div>}
    </Card>}
    {decline && <Modal title="Decline leave" onClose={() => setDecline(null)} actions={<button className="btn pri" onClick={() => act(decline.id, 'DECLINED', decline.note)}>Decline</button>}>
      <Field label="Reason (sent to the staff member)" req><Input value={decline.note} onChange={(e) => setDecline({ ...decline, note: e.target.value })} placeholder="e.g. Exam week — please choose other dates" /></Field></Modal>}
  </Page>;
}

// My Space → My Leave: leave types with what is left, apply, and my requests
export function MyLeave() {
  const { db, run, notify, session } = useStore();
  const me = db.users.find((u) => u.id === session.userId);
  const st = db.staff.find((s) => s.id === me?.staffId);
  const [f, setF] = useState({ type: 'CL', from: todayISO(), to: todayISO(), half: false, reason: '' });
  if (!st) return <Page title="My leave"><Card><p>Your account isn't linked to a staff record, so there is no leave to show. The school office links it in Operations → Users.</p></Card></Page>;
  const b = balances(db, st.id);
  const mine = (db.staffLeaves || []).filter((r) => r.staffId === st.id);
  const err = checkLeave(db, st, f);
  const days = f.from && f.to && f.to >= f.from ? leaveDays(db, f.from, f.to, f.half) : 0;
  const apply = () => { try { const r = run((d) => applyLeave(d, d.staff.find((x) => x.id === st.id), f, me)); notify(`Sent for approval to ${r.approvers.map((u) => db.users.find((x) => x.id === u)?.name).filter(Boolean).join(' and ')}`); setF({ ...f, reason: '' }); } catch (e) { notify(e.message); } };
  const cancel = (id) => { try { run((d) => cancelLeave(d, id, me.name)); notify('Leave cancelled'); } catch (e) { notify(e.message); } };
  return <Page title="My leave" sub={`${st.first} ${st.last} · ${st.desig} · ${st.type || 'Full time'} · leave year ${db.year}`}>
    <div className="kpis">{b.filter((x) => x.days != null).slice(0, 4).map((x) => <Stat key={x.code} label={x.name} value={`${x.left} left`} sub={`${x.taken} taken${x.pending ? ` · ${x.pending} waiting` : ''} · ${x.days} a year`} />)}</div>
    <div className="grid g-side">
      <Card title="Apply for leave">
        <div className="form">
          <Field label="Leave type" req><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} options={b.map((x) => [x.code, `${x.name}${x.left != null ? ` (${x.left} left)` : ''}`])} /></Field>
          <Field label="Half day"><label className="row small"><input type="checkbox" checked={f.half} onChange={(e) => setF({ ...f, half: e.target.checked, to: e.target.checked ? f.from : f.to })} />Half day (one date)</label></Field>
          <Field label="From" req><Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value, to: f.half || e.target.value > f.to ? e.target.value : f.to })} /></Field>
          <Field label="To" req><Input type="date" value={f.to} disabled={f.half} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
          <Field label="Reason" req full><Input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="e.g. Family function" /></Field>
        </div>
        <p className="small">{days ? <>This is <b>{days} working day{days === 1 ? '' : 's'}</b> (Sundays and school holidays don't count).</> : null} {leaveTypes(db).find((t) => t.code === f.type)?.note}</p>
        <div className="row end"><span className="small" style={{ color: 'var(--bad)' }}>{err}</span><button className="btn pri" disabled={!!err} onClick={apply}>Send for approval</button></div>
        <p className="small muted">Goes to {approversFor(db, st).map((u) => db.users.find((x) => x.id === u)?.name).filter(Boolean).join(' and ') || 'the Principal'}, who are told in the app and by email.</p>
      </Card>
      <Card title="Leave I can take this year">
        <table className="t small" aria-label="My leave balances"><thead><tr><th>Leave type</th><th className="num">A year</th><th className="num">Taken</th><th className="num">Waiting</th><th className="num">Left</th></tr></thead>
          <tbody>{b.map((x) => <tr key={x.code}><td>{x.name}</td><td className="num">{x.days ?? 'No limit'}</td><td className="num">{x.taken}</td><td className="num">{x.pending || '—'}</td><td className="num b">{x.left ?? '—'}</td></tr>)}</tbody></table>
      </Card>
    </div>
    <Card title={`My requests (${mine.length})`}>
      <div className="tw"><table className="t" aria-label="My leave requests"><thead><tr><th>Leave</th><th>Dates</th><th className="num">Days</th><th>Reason</th><th>Status</th><th /></tr></thead>
        <tbody>{mine.length ? mine.map((r) => <tr key={r.id}><td>{leaveName(db, r.type)}</td><td>{when(r)}</td><td className="num">{r.days}</td><td className="small">{r.reason}</td>
          <td><Status s={LEAVE_STATUS[r.status]} />{r.decidedBy && <div className="small muted">{r.decidedBy}{r.note ? ' — ' + r.note : ''}</div>}</td>
          <td>{(r.status === 'PENDING' || (r.status === 'APPROVED' && r.from > todayISO())) && <button className="btn sm" onClick={() => cancel(r.id)}>Cancel</button>}</td></tr>) : <tr><td colSpan={6} className="muted">No leave applied this year.</td></tr>}</tbody></table></div>
    </Card>
  </Page>;
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
