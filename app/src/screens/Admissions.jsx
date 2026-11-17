import { useState } from 'react';
import { useStore } from '../data/store.js';
import { Page, Card, Field, Input, Select, Status, Modal, Tabs, Stat } from '../components/ui.jsx';
import { dmy, roman } from '../lib/format.js';
import { ADM_STATUSES } from '../data/seed2.js';
import { admissionsSummary, addEnquiry, moveEnquiry, NEXT } from '../lib/analytics.js';

const KIND = { Enquiry: '', Submitted: 'info', 'In review': 'warn', Offered: 'warn', Enrolled: 'ok', 'Opted out': 'bad' };
const Pill = ({ s }) => <span className={'pill ' + (KIND[s] || '')}>{s}</span>;
const gradeName = (n) => 'Grade ' + roman[n - 1];

export function Admissions({ go }) {
  const { db, run, notify, session } = useStore();
  const [tab, setTab] = useState('summary');
  const [grades, setGrades] = useState([]);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [form, setForm] = useState(null);
  const [open, setOpen] = useState(null);
  const sum = admissionsSummary(db, { grades });
  const list = db.enquiries.filter((e) => (!grades.length || grades.includes(e.grade)) && (!status || e.status === status) && (!q || (e.first + ' ' + e.last + e.parent + e.no + e.mobile).toLowerCase().includes(q.toLowerCase())));
  const by = session.name || session.role;
  const toggleGrade = (n) => setGrades(grades.includes(n) ? grades.filter((x) => x !== n) : [...grades, n]);
  return (
    <Page title="Admissions & enquiries" sub="Every enquiry and application for 2027-28, from first call to enrolment. Statuses: Enquiry → Submitted → In review → Offered → Enrolled, or Opted out at any step."
      actions={<><button className="btn" onClick={() => setForm({ application: false })}>New enquiry</button><button className="btn pri" onClick={() => setForm({ application: true })}>Application form</button></>}>
      <div className="row" style={{ marginBottom: 12 }}>
        <span className="small b">Grades:</span>
        <button className={'btn sm' + (grades.length === 0 ? ' pri' : '')} onClick={() => setGrades([])}>All</button>
        {db.classes.map((c) => <button key={c.id} className={'btn sm' + (grades.includes(c.level) ? ' pri' : '')} onClick={() => toggleGrade(c.level)} aria-pressed={grades.includes(c.level)}>{roman[c.level - 1]}</button>)}
      </div>
      <div className="grid g4" style={{ marginBottom: 14 }}>
        <Stat label="Enquiries & applications" value={sum.totals.total} sub={grades.length ? 'for the selected grades' : 'all grades'} />
        <Stat label="Waiting on the school" value={sum.totals.Submitted + sum.totals['In review']} sub="submitted or in review" />
        <Stat label="Offers out" value={sum.totals.Offered} sub={`${sum.offerAccept}% of offers accepted so far`} />
        <Stat label="Enrolled" value={sum.totals.Enrolled} sub={`${sum.conversion}% of all enquiries · ${sum.totals['Opted out']} opted out`} />
      </div>
      <Tabs tabs={[['summary', 'Summary by grade'], ['list', `Applications (${list.length})`]]} value={tab} onChange={setTab} />
      {tab === 'summary' && <>
        <Card title="Status by grade" right={<span className="small muted">Click a number to see those applications</span>}>
          <div className="tw"><table className="t"><thead><tr><th>Grade</th>{ADM_STATUSES.map((s) => <th key={s} className="num">{s}</th>)}<th className="num">Total</th><th className="num">Seats free</th></tr></thead>
            <tbody>{sum.rows.map((r) => <tr key={r.grade}><td className="b">{r.grade}</td>{ADM_STATUSES.map((s) => <td key={s} className="num">{r[s] ? <button className="btn sm" onClick={() => { setGrades([r.level]); setStatus(s); setTab('list'); }}>{r[s]}</button> : <span className="muted">0</span>}</td>)}
              <td className="num b">{r.total}</td><td className="num" style={{ color: r.Offered + r.Enrolled > r.seats ? 'var(--bad)' : undefined }}>{r.seats}</td></tr>)}
              <tr><td className="b">Total</td>{ADM_STATUSES.map((s) => <td key={s} className="num b">{sum.totals[s]}</td>)}<td className="num b">{sum.totals.total}</td><td /></tr></tbody></table></div>
          <p className="small muted" style={{ marginTop: 8 }}>Seats free = 40 per section minus students already enrolled. Red means offers and enrolments are more than the free seats.</p>
        </Card>
        <Card title="Funnel — everyone who reached each stage">
          {sum.funnel.map((f) => <div key={f.stage} className="row" style={{ marginBottom: 6 }}><span style={{ width: 90 }} className="small">{f.stage}</span>
            <div style={{ flex: 1 }}><div style={{ height: 22, width: `${(100 * f.count) / (sum.funnel[0].count || 1)}%`, minWidth: 2, background: 'var(--brand)', opacity: 0.85, borderRadius: 4 }} /></div><span className="small b" style={{ width: 40, textAlign: 'right' }}>{f.count}</span></div>)}
        </Card>
      </>}
      {tab === 'list' && <>
        <div className="row" style={{ marginBottom: 12 }}><Input placeholder="Search child, parent, mobile, APP no." value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 280 }} />
          <Select value={status} onChange={(e) => setStatus(e.target.value)} options={[['', 'All statuses'], ...ADM_STATUSES]} /></div>
        <div className="tw"><table className="t"><thead><tr><th>App no.</th><th>Child</th><th>Grade</th><th>Parent</th><th>Mobile</th><th>Source</th><th>Updated</th><th>Status</th><th /></tr></thead>
          <tbody>{list.map((e) => <tr key={e.id}><td>{e.no}</td><td className="b">{e.first} {e.last}</td><td>{roman[e.grade - 1]}</td><td>{e.parent}</td><td>{e.mobile}</td><td>{e.source}</td>
            <td className="small">{dmy(e.history.at(-1).at)}</td><td><Pill s={e.status} /></td><td><button className="btn sm" onClick={() => setOpen(e.id)}>Open</button></td></tr>)}</tbody></table></div>
      </>}
      {form && <EnquiryForm application={form.application} onClose={() => setForm(null)} onSave={(f) => { const e = run((d) => addEnquiry(d, f, by)); notify(`${e.no} saved${e.email ? ' — acknowledgement emailed' : ''}`); setForm(null); }} />}
      {open && <EnquiryDetail id={open} onClose={() => setOpen(null)} go={go} />}
    </Page>
  );
}

function EnquiryForm({ application, onClose, onSave }) {
  const [f, setF] = useState({ first: '', last: '', gender: 'Female', dob: '', grade: 1, prevSchool: '', parent: '', mobile: '', email: '', source: 'Walk-in', transport: false, address: '', siblings: '', birthCert: false, photo: false, reportCard: false, consent: false, application });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const err = !f.first ? "Child's first name is required" : !f.parent ? 'Parent name is required' : !/^[6-9]\d{9}$/.test(f.mobile) ? 'Mobile must be 10 digits starting 6–9'
    : f.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email) ? 'Email looks wrong' : application && !f.dob ? 'Date of birth is required on the application' : application && !f.consent ? 'Parent consent is required' : '';
  return (
    <Modal title={application ? 'Application form — 2027-28' : 'New enquiry'} onClose={onClose} actions={<><span className="small muted">{err}</span><button className="btn pri" disabled={!!err} onClick={() => onSave(f)}>{application ? 'Submit application' : 'Save enquiry'}</button></>}>
      {application && <p className="small muted">The same form is published on the school website for parents to fill in themselves; it arrives here as “Submitted”.</p>}
      <h3>Child</h3>
      <div className="form">
        <Field label="First name" req><Input value={f.first} onChange={set('first')} /></Field>
        <Field label="Last name"><Input value={f.last} onChange={set('last')} /></Field>
        <Field label="Gender"><Select value={f.gender} onChange={set('gender')} options={['Female', 'Male', 'Other']} /></Field>
        <Field label="Date of birth" req={application}><Input type="date" value={f.dob} onChange={set('dob')} /></Field>
        <Field label="Applying for" req><Select value={f.grade} onChange={set('grade')} options={Array.from({ length: 12 }, (_, i) => [i + 1, gradeName(i + 1)])} /></Field>
        <Field label="Current / previous school"><Input value={f.prevSchool} onChange={set('prevSchool')} /></Field>
      </div>
      <h3 style={{ marginTop: 14 }}>Parent / guardian</h3>
      <div className="form">
        <Field label="Name" req><Input value={f.parent} onChange={set('parent')} /></Field>
        <Field label="Mobile" req><Input value={f.mobile} maxLength={10} onChange={set('mobile')} /></Field>
        <Field label="Email (Gmail)"><Input value={f.email} onChange={set('email')} /></Field>
        <Field label="How did you hear about us?"><Select value={f.source} onChange={set('source')} options={['Walk-in', 'Website', 'Referral', 'Social media', 'School fair']} /></Field>
        {application && <Field label="Address" full><Input value={f.address} onChange={set('address')} /></Field>}
        {application && <Field label="Siblings in this school (admission no.)"><Input value={f.siblings} onChange={set('siblings')} /></Field>}
      </div>
      <div className="row" style={{ marginTop: 12 }}><label className="row small"><input type="checkbox" checked={f.transport} onChange={set('transport')} />Needs school transport</label></div>
      {application && <><h3 style={{ marginTop: 14 }}>Documents received</h3>
        <div className="row">{[['birthCert', 'Birth certificate'], ['photo', 'Passport photo'], ['reportCard', 'Last report card']].map(([k, l]) => <label key={k} className="row small" style={{ marginRight: 12 }}><input type="checkbox" checked={f[k]} onChange={set(k)} />{l}</label>)}</div>
        <label className="row small" style={{ marginTop: 10 }}><input type="checkbox" checked={f.consent} onChange={set('consent')} />Parent consents to the school processing this information for admission (DPDP Act 2023).</label></>}
    </Modal>
  );
}

function EnquiryDetail({ id, onClose, go }) {
  const { db, run, notify, session } = useStore();
  const e = db.enquiries.find((x) => x.id === id);
  const [to, setTo] = useState(NEXT[e.status][0] || '');
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [interview, setInterview] = useState(e.interview);
  const [err, setErr] = useState('');
  const move = () => {
    try {
      const res = run((d) => moveEnquiry(d, id, to, { by: session.name || session.role, note, reason, interview }));
      notify(to === 'Enrolled' ? `Enrolled as ${res.student.admNo} — admission letter emailed` : `Moved to ${to}`);
      setNote(''); setReason(''); setErr(''); setTo(NEXT[to]?.[0] || '');
    } catch (x) { setErr(x.message); }
  };
  const doc = (k) => run((d) => { const x = d.enquiries.find((y) => y.id === id); x.docs[k] = !x.docs[k]; });
  return (
    <Modal title={`${e.first} ${e.last} · ${e.no}`} onClose={onClose}>
      <div className="grid g2">
        <div>
          <p><Pill s={e.status} /> · {gradeName(e.grade)} · {e.year}</p>
          <table className="t"><tbody>
            <tr><td className="muted">Date of birth</td><td>{dmy(e.dob)}</td></tr><tr><td className="muted">Previous school</td><td>{e.prevSchool || '—'}</td></tr>
            <tr><td className="muted">Parent</td><td>{e.parent} · {e.mobile}<br />{e.email || 'no email'}</td></tr><tr><td className="muted">Source</td><td>{e.source}</td></tr>
            <tr><td className="muted">Transport</td><td>{e.transport ? 'Needed' : 'No'}</td></tr>{e.interview && <tr><td className="muted">Interaction</td><td>{dmy(e.interview)}</td></tr>}
            {e.reason && <tr><td className="muted">Opt-out reason</td><td>{e.reason}</td></tr>}</tbody></table>
          <h3 style={{ marginTop: 12 }}>Documents</h3>
          <div className="row">{[['birthCert', 'Birth certificate'], ['photo', 'Photo'], ['reportCard', 'Report card']].map(([k, l]) => <label key={k} className="row small" style={{ marginRight: 10 }}><input type="checkbox" checked={e.docs[k]} disabled={e.status === 'Enrolled'} onChange={() => doc(k)} />{l}</label>)}</div>
        </div>
        <div>
          <h3>History</h3>
          {e.history.map((h, i) => <div key={i} className="small" style={{ padding: '4px 0', borderBottom: '1px solid var(--line)' }}><Pill s={h.status} /> {dmy(h.at)} · {h.by}{h.note ? ' — ' + h.note : ''}</div>)}
          {NEXT[e.status].length > 0 && <div className="card" style={{ marginTop: 12 }}>
            <h3>Move to</h3>
            <div className="row">{NEXT[e.status].map((s) => <button key={s} className={'btn sm' + (to === s ? ' pri' : '')} onClick={() => { setTo(s); setErr(''); }}>{s}</button>)}</div>
            {to === 'In review' && <div style={{ marginTop: 8 }}><Field label="Interaction / assessment date"><Input type="date" value={interview} onChange={(x) => setInterview(x.target.value)} /></Field></div>}
            {to === 'Opted out' && <div style={{ marginTop: 8 }}><Field label="Reason" req><Select value={reason} onChange={(x) => setReason(x.target.value)} options={[['', 'Pick one'], 'Chose another school', 'Fees', 'Distance', 'Relocated', 'Not eligible', 'No response']} /></Field></div>}
            <div style={{ marginTop: 8 }}><Field label="Note"><Input value={note} onChange={(x) => setNote(x.target.value)} /></Field></div>
            {to === 'Enrolled' && <p className="small muted">Enrolling creates the student record (admission number, section with most space, guardian) and emails the admission letter.</p>}
            {err && <div className="note warn small" style={{ marginTop: 8 }}>{err}</div>}
            <div className="row end" style={{ marginTop: 8 }}><button className="btn pri" disabled={!to} onClick={move}>Move to {to}</button></div>
          </div>}
          {e.studentId && <button className="btn" style={{ marginTop: 10 }} onClick={() => { onClose(); go('STU_LIST'); }}>Open in All Students</button>}
        </div>
      </div>
    </Modal>
  );
}
