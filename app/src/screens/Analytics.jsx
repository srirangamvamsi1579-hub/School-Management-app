import { useState } from 'react';
import { useStore } from '../data/store.js';
import { Page, Card, Select, Stat, Bars, Progress } from '../components/ui.jsx';
import { inr, num } from '../lib/format.js';
import { SUBJECTS, TERMS } from '../data/seed2.js';
import { rankReport, transportReport, teacherPerformance, admissionsSummary, PASS } from '../lib/analytics.js';

export const REPORTS = [
  { code: 'ANL_RANK', name: 'Top & bottom performers', pbi: 'Academic Performance · page “Top & Bottom 6”', view: 'v_student_term_scores', filters: 'Grade, Section(s), Term, Subject', roles: 'Admin, Principal, Teacher, Vice Principal' },
  { code: 'ANL_TEACHER', name: 'Teacher performance', pbi: 'Academic Performance · page “Teacher Impact”', view: 'v_teacher_subject_performance', filters: 'Grade, Subject, Term', roles: 'Admin, Principal, Vice Principal' },
  { code: 'ANL_TRANSPORT', name: 'Transport', pbi: 'Transport · pages “Routes” and “Riders by grade”', view: 'v_transport_route_summary', filters: 'Grade, Route', roles: 'Admin, Principal, Accountant' },
  { code: 'ANL_ADMISSIONS', name: 'Admissions funnel', pbi: 'Admissions · page “Funnel by grade”', view: 'v_admissions_by_grade_status', filters: 'Grade, Source, Year', roles: 'Admin, Principal, Front Office' }
];

const Pbi = ({ code }) => { const r = REPORTS.find((x) => x.code === code); return <p className="small muted noprint">Power BI: <b>{r.pbi}</b> · dataset view <code>{r.view}</code> · filtered to this school by row-level security. The figures below are calculated live from the test data with the same rules.</p>; };

function GradeFilter({ db, classId, setClassId, all = false }) {
  return <label className="f">Grade<Select value={classId} onChange={(e) => setClassId(e.target.value)} options={[...(all ? [['', 'All grades']] : []), ...db.classes.map((c) => [c.id, c.name])]} /></label>;
}

export function ReportCatalogue({ go }) {
  return <Page title="Data analytics" sub="Power BI reports for the school. Each opens with filters; the same reports are embedded here for staff who can see them.">
    <div className="grid g2">{REPORTS.map((r) => <Card key={r.code} title={r.name} right={<button className="btn sm pri" onClick={() => go(r.code)}>Open</button>}>
      <table className="t"><tbody><tr><td className="muted">Power BI</td><td>{r.pbi}</td></tr><tr><td className="muted">Filters</td><td>{r.filters}</td></tr><tr><td className="muted">Data</td><td><code>{r.view}</code></td></tr><tr><td className="muted">Who sees it</td><td>{r.roles}</td></tr></tbody></table></Card>)}</div>
    <p className="small muted">Refresh: nightly at 02:00 IST plus on demand. Report definitions and measures: docs/powerbi/REPORTS.md in the code repository.</p>
  </Page>;
}

export function TopBottom() {
  const { db } = useStore();
  const [classId, setClassId] = useState('C9');
  const [secs, setSecs] = useState([]);
  const [term, setTerm] = useState('Term 2');
  const [subject, setSubject] = useState('ALL');
  const sections = db.sections.filter((x) => x.classId === classId);
  const rep = rankReport(db, { classId, sectionIds: secs, term, subject, n: 6 });
  const cls = db.classes.find((c) => c.id === classId);
  const Table = ({ rows, title }) => <Card title={title}><table className="t"><thead><tr><th>Rank</th><th>Student</th><th>Section</th><th className="num">Score %</th>{term === 'Term 2' && <th className="num">vs Term 1</th>}<th className="num">Attendance</th></tr></thead>
    <tbody>{rows.map((r) => <tr key={r.id}><td>{r.rank}</td><td className="b">{r.name}<div className="small muted">{r.admNo}</div></td><td>{r.section}</td><td className="num b">{r.score}</td>
      {term === 'Term 2' && <td className="num" style={{ color: r.change < 0 ? 'var(--bad)' : 'var(--ok)' }}>{r.change > 0 ? '+' : ''}{r.change}</td>}<td className="num">{r.attendance}%</td></tr>)}</tbody></table></Card>;
  return <Page title="Top & bottom performers" sub={`Top 6 and bottom 6 in ${cls.name}${secs.length ? ' (selected sections)' : ', all sections together'}.`}>
    <Pbi code="ANL_RANK" />
    <Card>
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <GradeFilter db={db} classId={classId} setClassId={(v) => { setClassId(v); setSecs([]); }} />
        <label className="f">Term<Select value={term} onChange={(e) => setTerm(e.target.value)} options={TERMS} /></label>
        <label className="f">Subject<Select value={subject} onChange={(e) => setSubject(e.target.value)} options={[['ALL', 'All subjects (average)'], ...SUBJECTS]} /></label>
        <div className="f"><span className="small b">Sections</span><div className="row">
          <button className={'btn sm' + (!secs.length ? ' pri' : '')} onClick={() => setSecs([])}>All</button>
          {sections.map((x) => <button key={x.id} className={'btn sm' + (secs.includes(x.id) ? ' pri' : '')} aria-pressed={secs.includes(x.id)} onClick={() => setSecs(secs.includes(x.id) ? secs.filter((y) => y !== x.id) : [...secs, x.id])}>{x.name}</button>)}</div></div>
      </div>
    </Card>
    <div className="grid g4" style={{ marginBottom: 14 }}><Stat label="Students" value={rep.count} /><Stat label="Average score" value={rep.average + '%'} /><Stat label={`Passed (≥ ${PASS}%)`} value={rep.passRate + '%'} /><Stat label="Top score" value={(rep.top[0]?.score ?? 0) + '%'} sub={rep.top[0]?.name} /></div>
    {rep.count < 12 && <div className="note small" style={{ marginBottom: 12 }}>Only {rep.count} students in this selection, so the top and bottom lists overlap.</div>}
    <div className="grid g2"><Table rows={rep.top} title="Top 6" /><Table rows={rep.bottom} title="Bottom 6 — needs support" /></div>
    <Card title="Average by section"><Bars data={rep.bySection.map((x) => [x.section, x.average])} fmt={(v) => v + '%'} /></Card>
  </Page>;
}

export function TransportReports() {
  const { db } = useStore();
  const [classId, setClassId] = useState('');
  const rep = transportReport(db, { classId });
  return <Page title="Transport reports" sub="Riders, seat use, fee revenue and punctuality by route, and how many students in each grade use school transport.">
    <Pbi code="ANL_TRANSPORT" />
    <Card><div className="row"><GradeFilter db={db} classId={classId} setClassId={setClassId} all /></div></Card>
    <div className="grid g4" style={{ marginBottom: 14 }}><Stat label="Riders" value={rep.riders} sub={`of ${rep.seats} seats`} /><Stat label="Seat use" value={Math.round(100 * rep.riders / rep.seats) + '%'} />
      <Stat label="Transport fee (year)" value={inr(rep.revenue)} /><Stat label="Riders with overdue fees" value={rep.unpaid} /></div>
    <Card title="Routes"><div className="tw"><table className="t"><thead><tr><th>Route</th><th>Bus</th><th>Driver</th><th className="num">Km</th><th className="num">Riders</th><th style={{ width: 160 }}>Seat use</th><th className="num">Fee / year</th><th className="num">₹ per km</th><th className="num">On time</th></tr></thead>
      <tbody>{rep.routes.map((r) => <tr key={r.id}><td className="b">{r.id} · {r.name}</td><td>{r.bus}</td><td>{r.driver}</td><td className="num">{r.km}</td><td className="num">{r.riders} / {r.capacity}</td>
        <td><Progress pct={r.utilisation} /><span className="small">{r.utilisation}%{r.utilisation > 95 ? ' · full' : r.utilisation < 40 ? ' · under-used' : ''}</span></td><td className="num">{inr(r.revenue)}</td><td className="num">{num(r.perKm)}</td><td className="num">{r.onTime}%</td></tr>)}</tbody></table></div></Card>
    <Card title="Students using transport, by grade"><Bars data={rep.byGrade.map((g) => [g.grade.replace('Grade ', ''), g.share])} fmt={(v) => v + '%'} /></Card>
  </Page>;
}

export function TeacherPerformance() {
  const { db } = useStore();
  const [classId, setClassId] = useState('');
  const [subject, setSubject] = useState('ALL');
  const rows = teacherPerformance(db, { classId, subject });
  return <Page title="Teacher performance" sub="How each teacher's students are doing in the subject they teach, compared with the same grade and subject across the school, and Term 1 → Term 2.">
    <Pbi code="ANL_TEACHER" />
    <Card><div className="row"><GradeFilter db={db} classId={classId} setClassId={setClassId} all /><label className="f">Subject<Select value={subject} onChange={(e) => setSubject(e.target.value)} options={[['ALL', 'All subjects'], ...SUBJECTS]} /></label></div></Card>
    <div className="note small" style={{ marginBottom: 12 }}>Index: 50 = in line with the grade average. Each mark above or below the grade average moves it 3 points; each mark of improvement since Term 1 adds 1. Use it to start a conversation, not as a rating on its own — class mix and section size matter.</div>
    <div className="tw"><table className="t"><thead><tr><th>Teacher</th><th>Subject</th><th>Sections</th><th className="num">Students</th><th className="num">Term 1 avg</th><th className="num">Term 2 avg</th><th className="num">Change</th><th className="num">vs grade</th><th className="num">Pass %</th><th className="num">≥ 75%</th><th style={{ width: 140 }}>Index</th></tr></thead>
      <tbody>{rows.map((r) => <tr key={r.teacherId + r.subject}><td className="b">{r.teacher}<div className="small muted">{r.short}</div></td><td>{r.subject}</td><td className="small">{r.sections}</td><td className="num">{r.students}</td><td className="num">{r.term1}</td><td className="num b">{r.term2}</td>
        <td className="num" style={{ color: r.change < 0 ? 'var(--bad)' : 'var(--ok)' }}>{r.change > 0 ? '+' : ''}{r.change}</td><td className="num" style={{ color: r.vsGrade < 0 ? 'var(--bad)' : 'var(--ok)' }}>{r.vsGrade > 0 ? '+' : ''}{r.vsGrade}</td>
        <td className="num">{r.pass}%</td><td className="num">{r.distinction}%</td><td><Progress pct={r.index} /><span className="small">{r.index} · {r.band}</span></td></tr>)}</tbody></table></div>
  </Page>;
}

export function AdmissionsFunnel({ go }) {
  const { db } = useStore();
  const sum = admissionsSummary(db);
  return <Page title="Admissions funnel" sub="Enquiry to enrolment for 2027-28, all grades." actions={<button className="btn" onClick={() => go('STU_ADMISSIONS')}>Open admissions</button>}>
    <Pbi code="ANL_ADMISSIONS" />
    <div className="grid g4" style={{ marginBottom: 14 }}><Stat label="Enquiries" value={sum.totals.total} /><Stat label="Enrolled" value={sum.totals.Enrolled} /><Stat label="Conversion" value={sum.conversion + '%'} /><Stat label="Offer acceptance" value={sum.offerAccept + '%'} /></div>
    <div className="grid g2">
      <Card title="Reached each stage"><Bars data={sum.funnel.map((f) => [f.stage, f.count])} /></Card>
      <Card title="Applications by grade"><Bars data={sum.rows.map((r) => [r.grade.replace('Grade ', ''), r.total])} /></Card>
    </div>
    <Card title="Where enquiries come from"><table className="t"><tbody>{['Website', 'Walk-in', 'Referral', 'Social media', 'School fair'].map((s) => { const l = db.enquiries.filter((e) => e.source === s); return <tr key={s}><td>{s}</td><td className="num">{l.length}</td><td className="num">{l.filter((e) => e.status === 'Enrolled').length} enrolled</td></tr>; })}</tbody></table></Card>
  </Page>;
}
