import { useState } from 'react';
import { useStore } from '../data/store.js';
import { Page, Card, Field, Input, Select, Modal, Status, Stat, Progress, Tabs, printPage, Hint } from '../components/ui.jsx';
import { Register, RangeFilter, Legend, useRange } from '../components/Register.jsx';
import { studentMark, setStudentMark, NEXT_MARK, studentMonths, summarize } from '../lib/attendance.js';
import { performance, standing, gradeOf, subjectsOf, reportCard, SCOPES } from '../lib/results.js';
import { alert } from '../lib/alerts.js';
import { inr, dmy, dmon, initials, todayISO } from '../lib/format.js';
import { classLabel, guardianOf, fullName, admitStudent, admissionProblems, log, balance, classOf, tenantOf } from '../lib/logic.js';
import { GROUPS, groupOf, BAND_TOTAL, baseTotal } from '../data/seed.js';
import { mobileNote } from '../lib/validate.js';

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

// Student profile in four parts: personal, academic, performance (tests, %, rank against classmates) and attendance
export function StudentProfile({ s, start = 'personal' }) {
  const { db, session } = useStore();
  const [tab, setTab] = useState(start);
  const g = guardianOf(db, s);
  const teacher = session.role === 'TEACHER';
  return (
    <div>
      <div className="row" style={{ gap: 16, marginBottom: 10 }}>
        <div className="logo" style={{ width: 64, height: 64, borderRadius: 32, fontSize: 22 }}>{initials(fullName(s))}</div>
        <div><h2 style={{ margin: 0 }}>{fullName(s)}</h2><div className="muted">{s.admNo} · {classLabel(db, s)} · Roll {s.roll} · {s.house} house</div></div>
      </div>
      <Tabs tabs={[['personal', 'Personal profile'], ['academic', 'Academic profile'], ['performance', 'Performance'], ['attendance', 'Attendance report']]} value={tab} onChange={setTab} />
      <div style={{ marginTop: 12 }}>
        {tab === 'personal' && <PersonalTab s={s} g={g} teacher={teacher} />}
        {tab === 'academic' && <AcademicTab s={s} />}
        {tab === 'performance' && <PerformanceTab s={s} />}
        {tab === 'attendance' && <AttendanceTab s={s} />}
      </div>
    </div>
  );
}

function PersonalTab({ s, g, teacher }) {
  const { db, session } = useStore();
  const route = db.routes.find((r) => r.id === s.routeId);
  const stop = route?.stops.find((x) => x.name === s.stop);
  const extra = (db.collectors || []).filter((c) => c.studentId === s.id && c.status === 'VERIFIED');
  const mask = (m) => (teacher ? '••••' + String(m || '').slice(-4) : m);
  const invs = db.invoices.filter((i) => i.studentId === s.id);
  const showFees = ['ADMIN', 'ACCOUNTANT', 'FRONT_OFFICE', 'PRINCIPAL', 'PARENT'].includes(session.role);
  return <div className="grid g2">
    <Card title="About the student"><table className="t"><tbody>
      <tr><td className="muted">Full name</td><td className="b">{fullName(s)}</td></tr><tr><td className="muted">Admission no.</td><td>{s.admNo}</td></tr>
      <tr><td className="muted">Date of birth</td><td>{dmy(s.dob)}</td></tr><tr><td className="muted">Gender</td><td>{s.gender}</td></tr>
      <tr><td className="muted">Joined the school</td><td>{s.joined ? dmy(s.joined) : '—'}</td></tr><tr><td className="muted">House</td><td>{s.house}</td></tr>
      <tr><td className="muted">Status</td><td><Status s={s.status} /></td></tr></tbody></table></Card>
    <Card title="Family and contact"><table className="t"><tbody>
      <tr><td className="muted">Guardian</td><td className="b">{g?.name} <span className="small muted">({g?.relation})</span></td></tr>
      <tr><td className="muted">Mobile</td><td>{mask(g?.mobile)}</td></tr><tr><td className="muted">Email</td><td>{g?.email || <span className="pill bad">no email</span>}</td></tr>
      <tr><td className="muted">Can also collect</td><td>{extra.length ? extra.map((c) => `${c.name} (${c.relation})`).join(', ') : '—'}</td></tr></tbody></table></Card>
    <Card title="Transport"><p style={{ margin: 0 }}>{route ? <>{route.id} · {route.name}<br /><span className="small">Stop: <b>{s.stop}</b>{stop ? ` · pickup ${stop.am} · drop ${stop.pm}` : ''} · Bus {route.bus}</span></> : 'Does not use school transport.'}</p></Card>
    {showFees && <Card title="Fees this year"><table className="t"><tbody>{invs.map((i) => <tr key={i.id}><td>{i.instalment}</td><td className="num">{inr(i.net)}</td><td><Status s={i.status} /></td></tr>)}</tbody></table></Card>}
  </div>;
}

function AcademicTab({ s }) {
  const { db } = useStore();
  const sec = db.sections.find((x) => x.id === s.sectionId);
  const cls = db.classes.find((c) => c.id === sec?.classId);
  const staffName = (id) => { const t = db.staff.find((x) => x.id === id); return t ? `${t.first} ${t.last}` : '—'; };
  const co = db.coordinators?.[s.sectionId] || {};
  const cosch = Object.entries(db.cosch || {}).filter(([k, v]) => k.startsWith(s.id + ':') && v);
  return <div className="grid g2">
    <Card title="Class"><table className="t"><tbody>
      <tr><td className="muted">Class and section</td><td className="b">{classLabel(db, s)}</td></tr><tr><td className="muted">Roll number</td><td>{s.roll}</td></tr>
      <tr><td className="muted">Board</td><td>{cls?.board || '—'}</td></tr><tr><td className="muted">Class teacher</td><td>{staffName(sec?.teacherId)}</td></tr>
      <tr><td className="muted">Class coordinators</td><td>{staffName(co.primary)} (primary) · {staffName(co.secondary)}</td></tr>
      <tr><td className="muted">Academic year</td><td>{db.year}</td></tr></tbody></table></Card>
    <Card title="Subjects and teachers"><table className="t"><tbody>{subjectsOf(db, s).map((sub) => <tr key={sub}><td>{sub}</td><td>{staffName(db.subjectTeachers?.[s.sectionId + ':' + sub])}</td></tr>)}</tbody></table></Card>
    <Card title="Co-scholastic grades">{cosch.length ? <table className="t"><tbody>{cosch.map(([k, v]) => <tr key={k}><td>{k.slice(s.id.length + 1)}</td><td className="b">{v}</td></tr>)}</tbody></table> : <p className="muted small">Not graded yet (Exams → Co-Scholastic Grades).</p>}</Card>
    <Card title="Teachers’ comments this term">{(db.profiles[s.id] || []).length ? db.profiles[s.id].map((c, i) => <p key={i}><b>{c.subject}:</b> {c.text}</p>) : <p className="muted small">No comments entered yet (Exams → Assessment Profiles).</p>}</Card>
  </div>;
}

// Where the student stands among classmates: each dot is one classmate's score, the big dot is this student
export function StandingDots({ st }) {
  if (!st) return null;
  const lo = Math.min(...st.all), hi = Math.max(...st.all), x = (v) => (hi === lo ? 50 : 4 + (92 * (v - lo)) / (hi - lo));
  return <div aria-label={`Rank ${st.rank} of ${st.of}`}><div className="dots">{st.all.map((v, i) => <i key={i} style={{ left: x(v) + '%' }} />)}<i className="me" style={{ left: x(st.pct) + '%' }} /></div>
    <div className="row small muted" style={{ justifyContent: 'space-between' }}><span>Lowest {lo}%</span><span>Average {st.average}%</span><span>Top {st.top}%</span></div></div>;
}

function PerformanceTab({ s }) {
  const { db } = useStore();
  const p = performance(db, s);
  const done = p.exams.filter((e) => e.pct != null);
  const [exam, setExam] = useState(done[done.length - 1]?.code || 'T1');
  const e = p.exams.find((x) => x.code === exam);
  return <div>
    <Card title="Tests and exams (%)">
      <div className="tw"><table className="t" aria-label="Marks by subject and exam"><thead><tr><th>Subject</th>{p.exams.map((x) => <th key={x.code} className="num">{x.name}</th>)}</tr></thead>
        <tbody>{p.rows.map((r) => <tr key={r.subject}><td>{r.subject}</td>{p.exams.map((x) => <td key={x.code} className="num">{r[x.code] == null ? '—' : r[x.code] + '%'}</td>)}</tr>)}
          <tr className="b"><td>Overall</td>{p.exams.map((x) => <td key={x.code} className="num">{x.pct == null ? '—' : x.pct + '%'}</td>)}</tr>
          <tr><td>Rank in section</td>{p.exams.map((x) => <td key={x.code} className="num">{x.section ? `${x.section.rank} of ${x.section.of}` : '—'}</td>)}</tr>
          <tr><td>Rank in grade</td>{p.exams.map((x) => <td key={x.code} className="num">{x.grade ? `${x.grade.rank} of ${x.grade.of}` : '—'}</td>)}</tr></tbody></table></div>
    </Card>
    <Card title="Compared with classmates" right={<Select aria-label="Exam" value={exam} onChange={(ev) => setExam(ev.target.value)} options={p.exams.map((x) => [x.code, x.name])} />}>
      {e?.grade ? <div className="grid g2">
        <div><div className="kpis" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <Stat label="Score" value={e.pct + '%'} sub={`Grade ${gradeOf(e.pct)}`} />
          <Stat label="Rank in grade" value={`${e.grade.rank} / ${e.grade.of}`} sub={`Better than ${e.grade.betterThan}% of the grade`} />
          <Stat label="Rank in section" value={`${e.section.rank} / ${e.section.of}`} sub={`Section average ${e.section.average}%`} /></div>
          <StandingDots st={e.grade} />
          <p className="small">{e.pct >= e.grade.average ? `${r1(e.pct - e.grade.average)} points above` : `${r1(e.grade.average - e.pct)} points below`} the grade average; {r1(e.grade.top - e.pct)} points behind the top score.</p></div>
        <div><table className="t small" aria-label="Subjects against the grade"><thead><tr><th>Subject</th><th className="num">Score</th><th className="num">Grade average</th><th className="num">Rank in grade</th></tr></thead>
          <tbody>{p.rows.map((r) => { const st = standing(db, s, [exam], 'grade', r.subject); return <tr key={r.subject}><td>{r.subject}</td><td className="num">{r[exam]}%</td><td className="num">{st?.average}%</td><td className="num">{st ? `${st.rank} / ${st.of}` : '—'}</td></tr>; })}</tbody></table></div>
      </div> : <p className="muted">No marks for this exam yet.</p>}
    </Card>
  </div>;
}
const r1 = (n) => Math.round(n * 10) / 10;

function AttendanceTab({ s }) {
  const { db } = useStore();
  const months = studentMonths(db, s);
  const total = summarize(months.flatMap((m) => [...Array(m.P).fill('P'), ...Array(m.A || 0).fill('A'), ...Array(m.L || 0).fill('L'), ...Array(m.LATE || 0).fill('LATE')]));
  return <div>
    <div className="kpis"><Stat label="Attendance this year" value={(total.pct ?? '—') + '%'} sub={`${total.present} of ${total.days} school days`} /><Stat label="Absent" value={total.A || 0} /><Stat label="On leave" value={total.L || 0} /><Stat label="Late" value={total.LATE || 0} /></div>
    <Card title="Month by month"><table className="t" aria-label="Attendance by month"><thead><tr><th>Month</th><th className="num">School days</th><th className="num">Present</th><th className="num">Absent</th><th className="num">Leave</th><th className="num">Late</th><th className="num">%</th><th style={{ width: '30%' }} /></tr></thead>
      <tbody>{months.map((m) => <tr key={m.month}><td>{dmon(m.month + '-01').replace(/^\d+ /, '')}</td><td className="num">{m.days}</td><td className="num">{m.present}</td><td className="num">{m.A || 0}</td><td className="num">{m.L || 0}</td><td className="num">{m.LATE || 0}</td><td className="num b">{m.pct}%</td><td><Progress pct={m.pct} /></td></tr>)}</tbody></table>
      <p className="small muted">Day-by-day marks are in Students → Attendance (the register).</p></Card>
  </div>;
}

// Students → Student Profile: find a student, then the four parts of the profile
export function StudentProfiles() {
  const { db } = useStore();
  const [cls, setCls] = useState(db.classes.find((c) => c.name === 'Grade VIII')?.id || db.classes[0].id);
  const [sec, setSec] = useState('');
  const [q, setQ] = useState('');
  const list = db.students.filter((s) => s.status === 'Active' && classOf(db, s)?.id === cls && (!sec || s.sectionId === sec) && (!q || (fullName(s) + ' ' + s.admNo).toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => a.sectionId.localeCompare(b.sectionId) || a.roll - b.roll);
  const [id, setId] = useState(null);
  const cur = db.students.find((s) => s.id === id) || list[0];
  return <Page title="Student profile" sub="Personal and academic profile, test results with rank against classmates, and the attendance report.">
    <div className="grid g-side" style={{ gridTemplateColumns: '260px 1fr' }}>
      <Card title="Find a student">
        <Select aria-label="Grade" value={cls} onChange={(e) => { setCls(e.target.value); setSec(''); setId(null); }} options={db.classes.slice().sort((a, b) => a.level - b.level).map((c) => [c.id, c.name])} />
        <Select aria-label="Section" value={sec} onChange={(e) => { setSec(e.target.value); setId(null); }} options={[['', 'All sections'], ...db.sections.filter((x) => x.classId === cls).map((x) => [x.id, 'Section ' + x.name])]} />
        <Input placeholder="Name or admission no." aria-label="Search students" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginTop: 6, width: '100%' }} />
        <div style={{ marginTop: 8, maxHeight: 420, overflow: 'auto' }}>{list.map((s) => <button key={s.id} className={'item' + (cur?.id === s.id ? ' on' : '')} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 8px', border: 0, background: cur?.id === s.id ? 'var(--info-bg)' : 'none', borderRadius: 6, cursor: 'pointer' }} onClick={() => setId(s.id)}>
          <div className="b">{fullName(s)}</div><div className="small muted">{classLabel(db, s)} · {s.admNo}</div></button>)}
          {!list.length && <p className="muted small">No students match.</p>}</div>
      </Card>
      <Card>{cur ? <StudentProfile key={cur.id} s={cur} /> : <p className="muted">Pick a student.</p>}</Card>
    </div>
  </Page>;
}

export function Admission() {
  const { db, run, notify, session } = useStore();
  const blank = { first: '', last: '', gender: 'Female', dob: '', sectionId: 'C1A', guardianName: '', relation: 'Father', mobile: '', email: '', band: 0, house: 'Blue' };
  const [f, setF] = useState(blank);
  const [done, setDone] = useState(null);
  const [dup, setDup] = useState('');
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setDup(''); };
  const chk = admissionProblems(db, f);
  const err = chk.error;
  const lv = parseInt(f.sectionId.slice(1), 10), gi = groupOf(lv);
  const submit = (allowDuplicate = false) => {
    try {
      const s = run((d) => { const st = admitStudent(d, { ...f, allowDuplicate }, session.role); log(d, session.role, 'Student admitted', `${st.admNo} ${st.first}`); return st; });
      setDone(s); setF(blank); setDup(''); notify(`Admitted ${s.first} — ${s.admNo}`);
    } catch (e) { if (e.code === 'DUPLICATE') setDup(e.message); else notify(e.message); }
  };
  return (
    <Page title="New admission" sub="Fields marked * are required. The admission number is generated on save: running number + surname initial + year of joining, e.g. 0042R2026.">
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
          <Field label="Mobile" req><Input inputMode="tel" maxLength={16} value={f.mobile} onChange={set('mobile')} placeholder="10 digits" aria-label="Mobile" aria-describedby="adm-mob" /><Hint id="adm-mob">{mobileNote(f.mobile)}</Hint></Field>
          <Field label="Email (used for fee emails)"><Input type="email" value={f.email} onChange={set('email')} /></Field>
        </div>
      </Card>
      <Card title="Transport & fees">
        <div className="form">
          <Field label="School transport"><Select value={f.band} onChange={set('band')} options={[[0, 'Not using transport'], ...[1, 2, 3, 4, 5, 6].map((b) => [b, 'Pick-up zone ' + 'ABCDEF'[b - 1] + ' (band ' + b + ')'])]} /></Field>
          <div className="full note">Fee group <b>{GROUPS[gi].name}</b> · yearly total {inr(Number(f.band) ? BAND_TOTAL[f.band - 1][gi] : baseTotal(gi))} {Number(f.band) ? 'including transport' : '(transport not added)'}</div>
        </div>
      </Card>
      {!err && chk.warning && <div className="note warn" style={{ marginBottom: 10 }}>{chk.warning}</div>}
      {dup && <div className="note warn" role="alert" style={{ marginBottom: 10 }}>{dup}. <button className="btn" onClick={() => submit(true)}>Save anyway</button></div>}
      <div className="row end"><span className="muted small">{err}</span><button className="btn pri" disabled={!!err || !!dup} onClick={() => submit()}>Save admission</button></div>
    </Page>
  );
}

export function Attendance() {
  const { db, mutate, notify, session } = useStore();
  const [sec, setSec] = useState('C8A');
  const [range, setRange] = useRange();
  const list = db.students.filter((s) => s.sectionId === sec && s.status === 'Active').sort((a, b) => a.roll - b.roll);
  const t = todayISO();
  const rows = list.map((s) => ({ id: s.id, name: `${s.roll}. ${fullName(s)}`, s }));
  const absentToday = list.filter((s) => studentMark(db, s, t) === 'A').length;
  return (
    <Page title="Attendance register" sub="One row per student, one column per day. Everyone starts Present each day — tap a cell to mark Absent or Late. Approved leave (L) comes from parent requests; Sundays and school holidays are greyed out.">
      <Card><div className="row" style={{ alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
        <label className="f">Class and section<Select aria-label="Class and section" value={sec} onChange={(e) => setSec(e.target.value)} options={db.sections.map((x) => [x.id, db.classes.find((c) => c.id === x.classId).name + '-' + x.name])} /></label>
        <RangeFilter range={range} setRange={setRange} />
      </div><Legend /></Card>
      <Register db={db} rows={rows} range={range} label={`Attendance register ${sec}`} next={NEXT_MARK} mark={(r, d) => studentMark(db, r.s, d)}
        onSet={(r, d, m) => mutate((x) => setStudentMark(x, x.students.find((y) => y.id === r.id), d, m))} />
      <div className="row end" style={{ marginTop: 12 }}><span className="small muted">Today: {absentToday} absent of {list.length}</span>
        <button className="btn pri" onClick={() => { mutate((d) => log(d, session.role, 'Attendance submitted', `${sec} · ${t} · ${absentToday} absent`)); notify(`Attendance saved · ${absentToday} absent · SMS queued to their guardians`); }}>Submit today’s attendance</button></div>
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

// Students → Report Cards (replaces Promote / Transfer): generate report cards for a grade, section or one student,
// for an exam, a term or the whole year; print or save as PDF; publish so parents can open them in My Child.
export function ReportCards() {
  const { db, run, notify, session } = useStore();
  const [cls, setCls] = useState(db.classes.find((c) => c.name === 'Grade VIII')?.id || db.classes[0].id);
  const [sec, setSec] = useState('');
  const [who, setWho] = useState('');
  const [scope, setScope] = useState('T1_TERM');
  const [cards, setCards] = useState(null);
  const pool = db.students.filter((s) => s.status === 'Active' && classOf(db, s)?.id === cls && (!sec || s.sectionId === sec)).sort((a, b) => a.sectionId.localeCompare(b.sectionId) || a.roll - b.roll);
  const gen = () => setCards((who ? pool.filter((s) => s.id === who) : pool).map((s) => reportCard(db, s, scope)));
  const publish = () => {
    const n = run((d) => {
      cards.forEach((c) => { d.reportCards = (d.reportCards || []).filter((x) => !(x.studentId === c.student.id && x.scope === scope));
        d.reportCards.unshift({ id: 'RC' + (d.reportCards.length + 1) + '-' + c.student.id, studentId: c.student.id, scope, title: c.title, at: new Date().toISOString(), by: session.name || session.role });
        const parents = d.users.filter((u) => u.role === 'PARENT' && u.status === 'ACTIVE' && (u.children || []).includes(c.student.admNo)).map((u) => u.id);
        alert(d, { to: parents, title: `Report card ready: ${c.name}`, body: `${c.title} for ${c.name} (${c.cls}) is ready to view and print in My Child.`, screen: 'SELF_CHILD' }); });
      log(d, session.name || session.role, 'Report cards published', `${cards.length} · ${scope}`); return cards.length;
    });
    notify(`${n} report card${n === 1 ? '' : 's'} published — parents are told and can open them in My Child`);
  };
  const published = (db.reportCards || []).filter((x) => pool.some((s) => s.id === x.studentId));
  return <Page title="Report cards" sub="Generate the academic profile (report card) for a grade, a section or one student — for a single exam, a term or the whole year. Print it, save it as a PDF, and publish it so parents can open it in My Child."
    actions={cards && <><button className="btn" onClick={printPage}>Print / save as PDF</button><button className="btn pri" onClick={publish}>Publish to parents ({cards.length})</button></>}>
    <Card className="noprint"><div className="row" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <label className="f">Grade<Select aria-label="Grade" value={cls} onChange={(e) => { setCls(e.target.value); setSec(''); setWho(''); setCards(null); }} options={db.classes.slice().sort((a, b) => a.level - b.level).map((c) => [c.id, c.name])} /></label>
      <label className="f">Section<Select aria-label="Section" value={sec} onChange={(e) => { setSec(e.target.value); setWho(''); setCards(null); }} options={[['', 'All sections'], ...db.sections.filter((x) => x.classId === cls).map((x) => [x.id, x.name])]} /></label>
      <label className="f">Student<Select aria-label="Student" value={who} onChange={(e) => { setWho(e.target.value); setCards(null); }} options={[['', `All (${pool.length})`], ...pool.map((s) => [s.id, `${fullName(s)} · ${classLabel(db, s)}`])]} /></label>
      <label className="f">Term or exam<Select aria-label="Term or exam" value={scope} onChange={(e) => { setScope(e.target.value); setCards(null); }} options={SCOPES.map(([k, l]) => [k, l])} /></label>
      <button className="btn pri" onClick={gen}>Generate</button>
    </div>
    <p className="small muted" style={{ marginTop: 8 }}>Marks come from the marks register; grades use the CBSE 8-point scale (A1 91–100 … E below 33). Attendance covers the term. Comments come from Exams → Assessment Profiles and co-scholastic grades from Exams → Co-Scholastic Grades. Already published for this selection: {published.length}.</p></Card>
    {cards && (cards.length ? cards.map((c) => <ReportCard key={c.student.id} c={c} />) : <Card><p className="muted">No students match.</p></Card>)}
  </Page>;
}

export function ReportCard({ c }) {
  const { db } = useStore();
  const t = tenantOf(db);
  return <article className="rc" aria-label={`Report card ${c.name}`}>
    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div><h2>{t.name}</h2><div className="small">Report card · {c.title} · Academic year {db.year}</div></div>
      <div className="small" style={{ textAlign: 'right' }}>Result: <b>{c.result}</b><br />Overall {c.pct ?? '—'}% · Grade <b>{c.grade}</b></div>
    </div>
    <table><tbody><tr><td><b>{c.name}</b></td><td>Admission no. {c.student.admNo}</td><td>Class {c.cls}</td><td>Roll {c.student.roll}</td><td>DOB {dmy(c.student.dob)}</td></tr></tbody></table>
    <table aria-label="Marks"><thead><tr><th>Subject</th>{c.exams.map((e) => <th key={e.code}>{e.name} %</th>)}<th>{c.exams.length > 1 ? 'Weighted %' : '%'}</th><th>Grade</th></tr></thead>
      <tbody>{c.rows.map((r) => <tr key={r.subject}><td>{r.subject}</td>{r.marks.map((m, i) => <td key={i}>{m ?? '—'}</td>)}<td><b>{r.pct ?? '—'}</b></td><td>{r.grade}</td></tr>)}
        <tr><td><b>Overall</b></td>{c.exams.map((e) => <td key={e.code} />)}<td><b>{c.pct ?? '—'}</b></td><td><b>{c.grade}</b></td></tr></tbody></table>
    <table><tbody><tr><td>Rank in section: <b>{c.section ? `${c.section.rank} of ${c.section.of}` : '—'}</b></td><td>Rank in grade: <b>{c.gradeRank ? `${c.gradeRank.rank} of ${c.gradeRank.of}` : '—'}</b></td>
      <td>Grade average: {c.gradeRank?.average ?? '—'}%</td><td>Attendance {dmy(c.attFrom)}–{dmy(c.attTo)}: <b>{c.attendance.present} / {c.attendance.days}</b> ({c.attendance.pct ?? '—'}%)</td></tr></tbody></table>
    {c.cosch.length > 0 && <table aria-label="Co-scholastic"><thead><tr><th>Co-scholastic area</th><th>Grade</th></tr></thead><tbody>{c.cosch.map((x) => <tr key={x.area}><td>{x.area}</td><td>{x.grade}</td></tr>)}</tbody></table>}
    <p style={{ marginTop: 10 }}><b>Teachers’ remarks:</b> {c.remarks.length ? c.remarks.join(' · ') : 'Keep up the steady effort.'}</p>
    <div className="sig"><div>Class teacher</div><div>Parent</div><div>Principal</div></div>
  </article>;
}

// Parents: report cards the school has published for their child (open, print or save as PDF)
export function ChildReportCards({ s }) {
  const { db } = useStore();
  const [open, setOpen] = useState(null);
  const mine = (db.reportCards || []).filter((x) => x.studentId === s.id);
  return <Card title={`Report cards — ${fullName(s)}`}>
    {mine.length ? <table className="t"><tbody>{mine.map((x) => <tr key={x.id}><td className="b">{x.title}</td><td className="small muted">Published {dmon(x.at)} by {x.by}</td><td><button className="btn sm" onClick={() => setOpen(x)}>Open</button></td></tr>)}</tbody></table>
      : <p className="muted small">No report card has been published yet. The school publishes them after each term.</p>}
    {open && <Modal title={open.title} onClose={() => setOpen(null)} actions={<button className="btn pri" onClick={printPage}>Print / save as PDF</button>}><ReportCard c={reportCard(db, s, open.scope)} /></Modal>}
  </Card>;
}
