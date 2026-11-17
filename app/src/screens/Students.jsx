import { useState } from 'react';
import { useStore } from '../data/store.js';
import { Page, Card, Field, Input, Select, Modal, Status, Stat, Progress, printPage } from '../components/ui.jsx';
import { inr, dmy, initials } from '../lib/format.js';
import { classLabel, guardianOf, fullName, admitStudent, log, balance, classOf } from '../lib/logic.js';
import { GROUPS, groupOf, BAND_TOTAL, baseTotal } from '../data/seed.js';

export function StudentList() {
  const { db, session } = useStore();
  const [q, setQ] = useState('');
  const [cls, setCls] = useState('');
  const [open, setOpen] = useState(null);
  const rows = db.students.filter((s) => s.status === 'Active' && (!cls || classOf(db, s)?.id === cls) &&
    (!q || (fullName(s) + ' ' + s.admNo + ' ' + (guardianOf(db, s)?.name || '')).toLowerCase().includes(q.toLowerCase())));
  const showFees = ['ADMIN', 'ACCOUNTANT', 'FRONT_OFFICE', 'PRINCIPAL'].includes(session.role);
  return (
    <Page title="All students" sub={`${rows.length} of ${db.students.filter((s) => s.status === 'Active').length} active students`}>
      <div className="row" style={{ marginBottom: 12 }}>
        <Input placeholder="Search name, admission no. or guardian" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 300 }} />
        <Select value={cls} onChange={(e) => setCls(e.target.value)} options={[['', 'All grades'], ...db.classes.map((c) => [c.id, c.name])]} />
      </div>
      <div className="tw">
        <table className="t">
          <thead><tr><th>Admission no.</th><th>Name</th><th>Class</th><th>Guardian</th><th>Mobile</th><th>Email</th><th>Transport</th>{showFees && <th className="num">Fee due</th>}</tr></thead>
          <tbody>
            {rows.map((s) => {
              const g = guardianOf(db, s);
              const due = db.invoices.filter((i) => i.studentId === s.id).reduce((a, i) => a + balance(i), 0);
              return (
                <tr key={s.id} onClick={() => setOpen(s)} style={{ cursor: 'pointer' }}>
                  <td>{s.admNo}</td><td className="b">{fullName(s)}</td><td>{classLabel(db, s)}</td><td>{g?.name}</td>
                  <td>{session.role === 'TEACHER' ? '••••' + g?.mobile.slice(-4) : g?.mobile}</td>
                  <td>{g?.email || <span className="pill bad">missing</span>}</td><td>{s.band ? 'Zone ' + 'ABCDEF'[s.band - 1] : '—'}</td>
                  {showFees && <td className="num">{inr(due)}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {open && <Modal title={fullName(open)} onClose={() => setOpen(null)}><StudentProfile s={open} /></Modal>}
    </Page>
  );
}

export function StudentProfile({ s }) {
  const { db } = useStore();
  const g = guardianOf(db, s);
  const invs = db.invoices.filter((i) => i.studentId === s.id);
  return (
    <div>
      <div className="row" style={{ gap: 16, marginBottom: 14 }}>
        <div className="logo" style={{ width: 64, height: 64, borderRadius: 32, fontSize: 22 }}>{initials(fullName(s))}</div>
        <div><h2 style={{ margin: 0 }}>{fullName(s)}</h2><div className="muted">{s.admNo} · {classLabel(db, s)} · Roll {s.roll} · {s.house} house</div></div>
      </div>
      <div className="grid g3" style={{ marginBottom: 14 }}>
        <Stat label="Attendance" value={s.attendance + '%'} /><Stat label="Date of birth" value={dmy(s.dob)} /><Stat label="Gender" value={s.gender} />
      </div>
      <div className="grid g2">
        <Card title="Guardian"><div className="b">{g?.name}</div><div>{g?.relation}</div><div>{g?.mobile}</div><div>{g?.email || <span className="pill bad">no email</span>}</div></Card>
        <Card title="Fees this year">
          <table className="t"><tbody>{invs.map((i) => <tr key={i.id}><td>{i.instalment}</td><td className="num">{inr(i.net)}</td><td><Status s={i.status} /></td></tr>)}</tbody></table>
        </Card>
      </div>
      <Card title="Term assessment profile (narrative)">
        <p className="small muted">Built from the school's own profile format: subject comments, appreciation cards and Coordinator / Vice Principal signatures. Teachers fill comments in Exams → Assessment Profiles.</p>
        {(db.profiles[s.id] || []).length ? db.profiles[s.id].map((c, i) => <p key={i}><b>{c.subject}:</b> {c.text}</p>) : <p className="muted">No comments entered yet for this term.</p>}
      </Card>
    </div>
  );
}

export function Admission() {
  const { db, run, notify, session } = useStore();
  const blank = { first: '', last: '', gender: 'Female', dob: '', sectionId: 'C1A', guardianName: '', relation: 'Father', mobile: '', email: '', band: 0, house: 'Blue' };
  const [f, setF] = useState(blank);
  const [done, setDone] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const err = !f.first ? 'First name is required' : !f.dob ? 'Date of birth is required' : !f.guardianName ? 'Guardian name is required'
    : !/^[6-9]\d{9}$/.test(f.mobile) ? 'Guardian mobile must be 10 digits starting 6–9' : f.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email) ? 'Email looks wrong' : '';
  const lv = parseInt(f.sectionId.slice(1), 10), gi = groupOf(lv);
  const submit = () => {
    const s = run((d) => { const st = admitStudent(d, f, session.role); log(d, session.role, 'Student admitted', `${st.admNo} ${st.first}`); return st; });
    setDone(s); setF(blank); notify(`Admitted ${s.first} — ${s.admNo}`);
  };
  return (
    <Page title="New admission" sub="Fields marked * are required. The admission number is generated on save.">
      {done && <div className="note" style={{ marginBottom: 14 }}>Saved <b>{done.first} {done.last}</b> as <b>{done.admNo}</b>. Fee invoices are created when the fee structure is applied for the year.</div>}
      <Card title="Student">
        <div className="form">
          <Field label="First name" req><Input value={f.first} onChange={set('first')} /></Field>
          <Field label="Last name"><Input value={f.last} onChange={set('last')} /></Field>
          <Field label="Gender" req><Select value={f.gender} onChange={set('gender')} options={['Female', 'Male', 'Other']} /></Field>
          <Field label="Date of birth" req><Input type="date" value={f.dob} onChange={set('dob')} /></Field>
          <Field label="Class & section" req><Select value={f.sectionId} onChange={set('sectionId')} options={db.sections.map((x) => [x.id, db.classes.find((c) => c.id === x.classId).name + '-' + x.name])} /></Field>
          <Field label="House"><Select value={f.house} onChange={set('house')} options={['Red', 'Blue', 'Green', 'Yellow']} /></Field>
        </div>
      </Card>
      <Card title="Guardian">
        <div className="form">
          <Field label="Guardian name" req><Input value={f.guardianName} onChange={set('guardianName')} /></Field>
          <Field label="Relation"><Select value={f.relation} onChange={set('relation')} options={['Father', 'Mother', 'Guardian']} /></Field>
          <Field label="Mobile" req><Input inputMode="numeric" maxLength={10} value={f.mobile} onChange={set('mobile')} placeholder="10 digits" /></Field>
          <Field label="Email (used for fee emails)"><Input type="email" value={f.email} onChange={set('email')} /></Field>
        </div>
      </Card>
      <Card title="Transport & fees">
        <div className="form">
          <Field label="School transport"><Select value={f.band} onChange={set('band')} options={[[0, 'Not using transport'], ...[1, 2, 3, 4, 5, 6].map((b) => [b, 'Pick-up zone ' + 'ABCDEF'[b - 1] + ' (band ' + b + ')'])]} /></Field>
          <div className="full note">Fee group <b>{GROUPS[gi].name}</b> · yearly total {inr(Number(f.band) ? BAND_TOTAL[f.band - 1][gi] : baseTotal(gi))} {Number(f.band) ? 'including transport' : '(transport not added)'}</div>
        </div>
      </Card>
      <div className="row end"><span className="muted small">{err}</span><button className="btn pri" disabled={!!err} onClick={submit}>Save admission</button></div>
    </Page>
  );
}

export function Attendance() {
  const { db, mutate, notify, session } = useStore();
  const [sec, setSec] = useState('C9S1');
  const list = db.students.filter((s) => s.sectionId === sec && s.status === 'Active');
  const key = sec + ':' + new Date().toISOString().slice(0, 10);
  const marks = db.attendance[key] || {};
  // L (approved leave) and LATE (parent dropped late) come from parent requests; tapping cycles Present ↔ Absent
  const toggle = (id) => mutate((d) => { const cur = d.attendance[key]?.[id] || 'P'; d.attendance[key] = { ...(d.attendance[key] || {}), [id]: cur === 'A' ? 'P' : 'A' }; });
  const LBL = { P: 'Present', A: 'Absent', L: 'On leave (approved)', LATE: 'Late — dropped by parent' };
  return (
    <Page title="Attendance" sub="Everyone starts Present — tap a name to mark Absent. Absent students' guardians get an SMS when you submit.">
      <div className="row" style={{ marginBottom: 12 }}>
        <Select aria-label="Class and section" value={sec} onChange={(e) => setSec(e.target.value)} options={db.sections.map((x) => [x.id, db.classes.find((c) => c.id === x.classId).name + '-' + x.name])} />
        <span className="muted">{new Date().toDateString()}</span>
      </div>
      <div className="grid g3">
        {list.map((s) => { const m = marks[s.id] || 'P'; const a = m === 'A'; return (
          <button key={s.id} className="card" style={{ textAlign: 'left', cursor: 'pointer', borderColor: a ? 'var(--bad)' : m !== 'P' ? 'var(--warn)' : undefined, background: a ? 'var(--bad-bg)' : undefined }} onClick={() => toggle(s.id)}>
            <div className="b">{s.roll}. {fullName(s)}</div><div className="small">{LBL[m] || m}</div>
          </button>); })}
      </div>
      <div className="row end"><button className="btn pri" onClick={() => { const n = Object.values(marks).filter((v) => v === 'A').length; mutate((d) => log(d, session.role, 'Attendance submitted', `${sec} · ${n} absent`)); notify(`Attendance saved · ${n} absent · SMS queued`); }}>Submit attendance</button></div>
    </Page>
  );
}

export function Documents() {
  const { db } = useStore();
  const [sec, setSec] = useState('C8A');
  const list = db.students.filter((s) => s.sectionId === sec);
  return (
    <Page title="Documents & ID cards" sub="Print ID cards for a section. Uploaded documents (birth certificate, TC, photos) are kept in S3 in production." actions={<button className="btn pri" onClick={() => printPage()}>Print</button>}>
      <div className="row noprint" style={{ marginBottom: 12 }}><Select aria-label="Class and section" value={sec} onChange={(e) => setSec(e.target.value)} options={db.sections.map((x) => [x.id, db.classes.find((c) => c.id === x.classId).name + '-' + x.name])} /></div>
      <div className="grid g3">
        {list.map((s) => (
          <div key={s.id} className="card" style={{ borderTop: '6px solid var(--brand)' }}>
            <div className="row"><div className="logo">{initials(fullName(s))}</div><div><div className="b">{fullName(s)}</div><div className="small">{classLabel(db, s)} · {s.admNo}</div></div></div>
            <div className="small" style={{ marginTop: 8 }}>Guardian: {guardianOf(db, s)?.name} · {guardianOf(db, s)?.mobile}</div>
            <div className="small">Blood group: — · House: {s.house}</div>
          </div>
        ))}
      </div>
    </Page>
  );
}

export function Promote() {
  const { db } = useStore();
  return (
    <Page title="Promote / transfer" sub="Moves a whole section to the next grade at year end, or issues a transfer certificate.">
      <Card><p>Year-end promotion runs once the result is published. Pick the source and target section, untick students who are detained or leaving, and confirm. Leaving students get a TC number and their status becomes <i>Transferred</i>; their records stay for reports.</p>
        <p className="muted small">{db.sections.length} sections ready for promotion to {db.year.replace(/\d+-(\d+)/, (m, y) => '20' + y + '-' + (Number(y) + 1))}.</p></Card>
    </Page>
  );
}
