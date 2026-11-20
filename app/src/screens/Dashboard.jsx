import { useState } from 'react';
import { useStore } from '../data/store.js';
import { Page, Card, Stat, Bars as MiniBars, Progress, Status, Tabs, Modal, Field, Input, Select } from '../components/ui.jsx';
import { Delta, Kpi, StackedColumns, Bars, SegmentBar } from '../components/charts.jsx';
import { studentFigures, staffFigures, transportFigures, feeDashboard, registrationFigures, lastYearKey, GENDERS, SOURCES, studentInsights, staffInsights, transportInsights, feeInsights, enrolInsights } from '../lib/dashboard.js';
import { roleName } from '../lib/auth.js';
import { inr, num, dmon } from '../lib/format.js';
import { classOf, balance, fullName, classLabel, tenantOf, log } from '../lib/logic.js';
import { PLANS } from '../data/menu.js';
import { myChildren } from './Requests.jsx';

function feeFigures(db) {
  const billed = db.invoices.reduce((a, i) => a + i.net, 0);
  const paid = db.invoices.reduce((a, i) => a + i.paid, 0);
  const overdue = db.invoices.filter((i) => i.status === 'OVERDUE').reduce((a, i) => a + balance(i), 0);
  return { billed, paid, overdue, pct: Math.round((100 * paid) / (billed || 1)) };
}

const REPORT_OF = { STUDENTS: ['STU_INS', 'Student Insights'], STAFF: ['STF_INS', 'Staff Insights'], TRANSPORT: ['ANL_TRANSPORT', 'Transport Reports'], FEES: ['FEE_INS', 'Fee Insights'], ENROL: ['ANL_ADMISSIONS', 'Admissions Funnel'] };
export function Dashboard({ go, menus }) {
  const { db, session } = useStore();
  const t = tenantOf(db);
  const plan = PLANS.find((p) => p.code === t.plan);
  const role = session.role;
  const tabs = [['STUDENTS', 'Students'], ...(['ADMIN', 'PRINCIPAL', 'ACCOUNTANT', 'PLATFORM'].includes(role) ? [['STAFF', 'Staff']] : []),
    ...(['ADMIN', 'PRINCIPAL', 'TRANSPORT', 'FRONT_OFFICE', 'PLATFORM'].includes(role) ? [['TRANSPORT', 'Transport']] : []),
    ...(['ADMIN', 'PRINCIPAL', 'ACCOUNTANT', 'PLATFORM'].includes(role) ? [['FEES', 'Fees']] : []),
    ...(['ADMIN', 'PRINCIPAL', 'PLATFORM'].includes(role) ? [['ENROL', 'Enrolment']] : []), ['ACTIVITY', 'Needs attention']];
  const [tab, setTab] = useState(() => { try { return sessionStorage.getItem('dash-tab') || 'STUDENTS'; } catch (e) { return 'STUDENTS'; } });
  const pick = (k) => { setTab(k); try { sessionStorage.setItem('dash-tab', k); } catch (e) { /* ignore */ } };
  const cur = tabs.some(([k]) => k === tab) ? tab : 'STUDENTS';
  if (role === 'PARENT') return <ParentHome go={go} />;
  const period = lastYearKey(db);
  return (
    <Page title={`Good day — ${t.name}`} sub={`Academic year ${db.year} · compared with ${period} · ${plan.name} plan (${plan.range} students)`}>
      <div className="dash-tabs"><Tabs tabs={tabs} value={cur} onChange={pick} /></div>
      {REPORT_OF[cur] && (menus || []).some((m) => m.items.some((i) => i[0] === REPORT_OF[cur][0])) && <p className="small noprint" style={{ margin: '0 0 10px' }}>The detail, with filters, drill-down and export: <button className="linkbtn" onClick={() => go(REPORT_OF[cur][0])}>Data Analytics › {REPORT_OF[cur][1]} →</button></p>}
      {cur === 'STUDENTS' && <StudentsSection period={period} plan={plan} />}
      {cur === 'STAFF' && <StaffSection period={period} />}
      {cur === 'TRANSPORT' && <TransportSection period={period} />}
      {cur === 'FEES' && <FeesSection period={period} />}
      {cur === 'ENROL' && <EnrolmentSection period={period} />}
      {cur === 'ACTIVITY' && <Activity go={go} />}
    </Page>
  );
}

// Last year vs this year, by gender
function GenderMatrix({ label, now, before, period, year }) {
  const rows = [...GENDERS.map(([k, name]) => [name, now[k] || 0, before ? before[k] ?? null : null]),
    ['Total', GENDERS.reduce((a, [k]) => a + (now[k] || 0), 0), before ? GENDERS.reduce((a, [k]) => a + (before[k] || 0), 0) : null]];
  return <table className="t matrix" aria-label={label}><thead><tr><th>{label}</th><th>{period}</th><th>{year}</th><th>Change</th></tr></thead>
    <tbody>{rows.map(([n, v, b]) => <tr key={n} className={n === 'Total' ? 'b' : ''}><td>{n}</td><td>{b ?? '—'}</td><td>{v}</td><td><Delta now={v} before={b} period={period} short /></td></tr>)}</tbody></table>;
}

// What the figures mean: a short list of observations under the headline numbers
function InsightList({ items, label }) {
  if (!items.length) return null;
  return <Card title="What this tells you" className="insights"><ul aria-label={label + ' insights'}>{items.map((x, i) => <li key={i}>{x}</li>)}</ul></Card>;
}

const GSERIES = [{ name: 'Boys', color: 'var(--s1)' }, { name: 'Girls', color: 'var(--s2)' }];

function StudentsSection({ period, plan }) {
  const { db, run, notify, session } = useStore();
  const f = studentFigures(db);
  const [edit, setEdit] = useState(null);
  const canEdit = ['ADMIN', 'PRINCIPAL'].includes(session.role);
  const rows = f.classes.map((c) => ({ label: c.short, parts: f.coEd ? [c.boys, c.girls] : [c.total], limit: c.limit,
    flag: c.over ? { kind: 'over', text: `${c.over} over the limit` } : c.free ? { kind: 'under', text: `${c.free} seats free` } : null }));
  const saveLimits = () => {
    const bad = Object.values(edit.limits).find((v) => v === '' || !(+v >= 0));
    if (bad !== undefined) { notify('Each grade limit must be a number'); return; }
    run((d) => { d.gradeLimits = Object.fromEntries(Object.entries(edit.limits).map(([k, v]) => [k, +v])); d.settings = { ...(d.settings || {}), coEd: edit.coEd }; log(d, session.name || session.role, 'Grade limits changed', ''); });
    notify('Grade limits saved'); setEdit(null);
  };
  return <section className="dash-section" aria-label="Students">
    <div className="kpis">
      <Kpi label="Total students" value={num(f.total)} sub={plan.cap ? `${Math.round((100 * f.total) / plan.cap)}% of the ${plan.name} plan limit` : null}><Delta now={f.total} before={f.before} period={period} pct /></Kpi>
      <Kpi label="New enrolments this year" value={num(f.newThisYear)} sub={f.coEd ? `${f.newByGender.Male} boys · ${f.newByGender.Female} girls` : null}><Delta now={f.newThisYear} before={f.newBefore} period={period} /></Kpi>
      <Kpi label="Grades over their limit" value={f.overGrades.length} sub={f.overGrades.length ? f.overGrades.map((c) => `${c.name} +${c.over}`).join(' · ') : 'Every grade is within its limit'} />
      <Kpi label="Seats free within limits" value={num(f.underGrades.reduce((a, c) => a + c.free, 0))} sub={`in ${f.underGrades.length} grade${f.underGrades.length === 1 ? '' : 's'}`} />
    </div>
    <InsightList items={studentInsights(db)} label="Students" />
    <div className="grid g-side">
      <Card title={f.coEd ? "Students by class, boys and girls" : "Students by class"} right={canEdit && <button className="btn sm" onClick={() => setEdit({ limits: { ...db.gradeLimits }, coEd: f.coEd })}>Edit grade limits</button>}>
        <StackedColumns label="Students by class" rows={rows} series={f.coEd ? GSERIES : [{ name: 'Students', color: 'var(--s1)' }]} limitName="Grade limit" />
        <p className="small muted" style={{ marginTop: 6 }}>▲ above a column: more students than the grade limit · ▼ seats still free.</p>
      </Card>
      <div>
        {f.coEd && <Card title="Boys and girls"><GenderMatrix label="Students" now={f.byGender} before={f.before == null ? null : f.beforeByGender} period={period} year={db.year} /></Card>}
      </div>
    </div>
    <div className="grid g2">
      <Card title="Against the grade limits">
          <table className="t small" aria-label="Grade limits"><thead><tr><th>Class</th><th>Students</th><th>Limit</th><th>Against the limit</th></tr></thead>
            <tbody>{f.classes.map((c) => <tr key={c.id}><td>{c.name}</td><td>{c.total}</td><td>{c.limit ?? '—'}</td>
              <td>{c.over ? <span className="flag-chip over">▲ {c.over} over</span> : c.free ? <span className="flag-chip under">▼ {c.free} free</span> : c.limit != null ? <span className="flag-chip ok">At limit</span> : '—'}</td></tr>)}</tbody></table>
      </Card>
      <Card title="New enrolments this year, by class">
        <Bars label="New enrolments by class" rows={f.classes.filter((c) => c.newThisYear).map((c) => ({ label: c.name, value: c.newThisYear }))} />
      </Card>
    </div>
    {edit && <Modal title="Grade limits" onClose={() => setEdit(null)} actions={<button className="btn pri" onClick={saveLimits}>Save</button>}>
      <p className="small muted">The most students each grade should have this year (all its sections together). The dashboard shows ▲ when a grade is over its limit and ▼ when seats are free.</p>
      <div className="form" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>{db.classes.slice().sort((a, b) => a.level - b.level).map((c) => <Field key={c.id} label={c.name}><Input type="number" min="0" value={edit.limits[c.id] ?? ''} onChange={(e) => setEdit({ ...edit, limits: { ...edit.limits, [c.id]: e.target.value } })} /></Field>)}</div>
      <label className="row small" style={{ marginTop: 10 }}><input type="checkbox" checked={edit.coEd} onChange={(e) => setEdit({ ...edit, coEd: e.target.checked })} />Co-educational school (show boys and girls)</label>
    </Modal>}
  </section>;
}

function StaffSection({ period }) {
  const { db } = useStore();
  const f = staffFigures(db);
  const ratioOk = f.ratio != null && f.ratio <= f.norm;
  const [ft, pt] = f.byType;
  const TSERIES = [{ name: 'Full time', color: 'var(--s1)' }, { name: 'Part time', color: 'var(--s2)' }];
  return <section className="dash-section" aria-label="Staff">
    <div className="kpis">
      <Kpi label="Total staff" value={f.total} sub={`${f.teachers} teaching · ${f.nonTeaching} non-teaching`}><Delta now={f.total} before={f.before} period={period} pct /></Kpi>
      <Kpi label="Full time" value={ft.count} sub={`${ft.headShare}% of staff`}><Delta now={ft.count} before={ft.before} period={period} /></Kpi>
      <Kpi label="Part time" value={pt.count} sub={`${pt.headShare}% of staff`}><Delta now={pt.count} before={pt.before} period={period} /></Kpi>
      <Kpi label="Salary paid this year" value={inr(f.paidTotal)} sub={`${f.months} month${f.months === 1 ? '' : 's'} · ${inr(f.payroll)} a month`} />
      <Kpi label="Students per teacher" value={f.ratio == null ? '—' : f.ratio.toFixed(1)} sub={`School norm: up to ${f.norm}`}>
        <span className={'flag-chip ' + (ratioOk ? 'ok' : 'over')}>{ratioOk ? '✓ Within the norm' : '▲ Above the norm'}</span></Kpi>
    </div>
    <InsightList items={staffInsights(db)} label="Staff" />
    <div className="grid g-side">
      <Card title="Salary by employee type">
        <table className="t" aria-label="Salary by employee type"><thead><tr><th>Type</th><th className="num">Staff</th><th className="num">Monthly salary</th><th className="num">Paid this year</th><th className="num">Average per person / month</th><th className="num">Share of salary</th></tr></thead>
          <tbody>{f.byType.map((t) => <tr key={t.type}><td className="b">{t.type}</td><td className="num">{t.count}</td><td className="num">{inr(t.monthly)}</td><td className="num">{inr(t.paid)}</td><td className="num">{inr(t.avg)}</td><td className="num">{t.share}%</td></tr>)}
            <tr className="b"><td>Total</td><td className="num">{f.total}</td><td className="num">{inr(f.payroll)}</td><td className="num">{inr(f.paidTotal)}</td><td className="num">{inr(Math.round(f.payroll / Math.max(1, f.total)))}</td><td className="num">100%</td></tr></tbody></table>
        <table className="t small" aria-label="Salary by staff group" style={{ marginTop: 12 }}><thead><tr><th>Staff group</th><th className="num">Full time</th><th className="num">Part time</th><th className="num">Monthly salary</th><th className="num">Paid this year</th></tr></thead>
          <tbody>{f.categories.map((c) => <tr key={c.name}><td>{c.name}</td><td className="num">{c['Full time']}</td><td className="num">{c['Part time']}</td><td className="num">{inr(c.monthly)}</td><td className="num">{inr(c.paid)}</td></tr>)}</tbody></table>
        <p className="small muted" style={{ marginTop: 6 }}>Gross salary (basic, HRA, DA and transport allowance) for the months paid so far this year, April to last month; staff who joined during the year count from their joining month.</p>
      </Card>
      <Card title="Full time and part time">
        <table className="t matrix" aria-label="Staff by employment type"><thead><tr><th>Staff</th><th>{period}</th><th>{db.year}</th><th>Change</th></tr></thead>
          <tbody>{f.byType.map((t) => <tr key={t.type}><td>{t.type}</td><td>{t.before ?? '—'}</td><td>{t.count}</td><td><Delta now={t.count} before={t.before} period={period} short /></td></tr>)}
            <tr className="b"><td>Total</td><td>{f.before ?? '—'}</td><td>{f.total}</td><td><Delta now={f.total} before={f.before} period={period} short /></td></tr></tbody></table>
        <table className="t matrix" aria-label="Staff by gender" style={{ marginTop: 12 }}><thead><tr><th>Staff</th><th>{period}</th><th>{db.year}</th><th>Change</th></tr></thead>
          <tbody>{[['Men', 'Male'], ['Women', 'Female']].map(([n, k]) => <tr key={k}><td>{n}</td><td>{f.beforeByGender?.[k] ?? '—'}</td><td>{f.byGender[k]}</td><td><Delta now={f.byGender[k]} before={f.beforeByGender?.[k]} period={period} short /></td></tr>)}</tbody></table>
      </Card>
    </div>
    <Card title="Staff by department, full time and part time">
      <Bars label="Staff by department" rows={f.depts.map((d) => ({ label: d.name, parts: [d.full, d.part], value: d.total }))} series={TSERIES} valueText={(r) => r.value} />
    </Card>
  </section>;
}

function TransportSection({ period }) {
  const { db, run, notify, session } = useStore();
  const f = transportFigures(db);
  const canLog = ['ADMIN', 'PRINCIPAL', 'TRANSPORT'].includes(session.role);
  const [bd, setBd] = useState(null);
  const saveBd = () => {
    const r = db.routes.find((x) => x.id === bd.routeId);
    const err = !bd.date || bd.date > new Date().toISOString().slice(0, 10) ? 'Pick the date (today or earlier)' : !bd.detail.trim() ? 'Say what happened' : !(+bd.delayMin >= 0) ? 'Delay must be minutes' : '';
    if (err) { notify(err); return; }
    run((d) => { d.busIncidents = d.busIncidents || []; d.busIncidents.unshift({ id: 'BI' + (d.busIncidents.length + 1) + '-' + Date.now().toString(36), date: bd.date, routeId: r.id, bus: r.bus, kind: bd.kind, detail: bd.detail.trim(), delayMin: +bd.delayMin, trip: bd.trip,
      replacedBy: bd.cover || null, students: d.students.filter((s) => s.status === 'Active' && s.routeId === r.id).length, by: session.name || session.role });
      if (bd.offRoad) { const b = (d.buses || []).find((x) => x.reg === r.bus); if (b) b.status = 'Under repair'; }
      log(d, session.name || session.role, 'Bus breakdown logged', `${r.id} ${bd.kind}`); });
    notify('Breakdown logged'); setBd(null);
  };
  return <section className="dash-section" aria-label="Transport">
    <div className="kpis">
      <Kpi label="Students on school transport" value={f.riders} sub={`${Math.round(100 * f.share)}% of students · ${f.byGender.Male} boys · ${f.byGender.Female} girls`}><Delta now={f.riders} before={f.before} period={period} pct /></Kpi>
      <Kpi label="Buses" value={f.buses.length} sub={`${f.inService} in service · ${f.spare} spare${f.repair ? ` · ${f.repair} under repair` : ''}`}><Delta now={f.buses.length} before={f.busesBefore} period={period} /></Kpi>
      <Kpi label="Breakdowns this year" value={f.incidents.length} sub={`${f.delayMin} minutes of delay · ${f.affected} riders affected`}><Delta now={f.incidents.length} before={f.incidentsBefore} period={`all of ${period}`} upGood={false} /></Kpi>
      <Kpi label="Seats used" value={`${Math.round((100 * f.riders) / (f.seats || 1))}%`} sub={`${f.riders} of ${f.seats} seats on ${f.routes.length} routes`} />
    </div>
    <InsightList items={transportInsights(db)} label="Transport" />
    <div className="grid g-side">
      <Card title="Riders by route, against the seats on the bus">
        <Bars label="Riders by route" rows={f.routes.map((r) => ({ label: `${r.id} · ${r.name}`, value: r.riders, track: r.capacity, tipNote: `${r.capacity} seats`,
          flag: r.riders > r.capacity ? { kind: 'over', text: `${r.riders - r.capacity} over` } : r.use < 0.5 ? { kind: 'under', text: 'under half full' } : null,
          note: r.before == null ? null : `${period}: ${r.before} riders` }))} valueText={(r) => `${r.value} / ${r.track}`} />
      </Card>
      <Card title="Change in riders per route">
        <table className="t" aria-label="Riders per route against last year"><thead><tr><th>Route</th><th className="num">{period}</th><th className="num">{db.year}</th><th>Change</th><th className="num">Breakdowns</th></tr></thead>
          <tbody>{f.routes.map((r) => <tr key={r.id}><td className="b">{r.id}</td><td className="num">{r.before ?? '—'}</td><td className="num">{r.riders}</td><td><Delta now={r.riders} before={r.before} period={period} short /></td><td className="num">{r.incidents || '—'}</td></tr>)}</tbody></table>
      </Card>
    </div>
    <Card title={`Bus breakdowns this year (${f.incidents.length})`} right={canLog && <button className="btn sm" onClick={() => setBd({ date: new Date().toISOString().slice(0, 10), routeId: db.routes[0].id, kind: 'Breakdown', detail: '', delayMin: 30, trip: 'AM', cover: f.buses.find((b) => b.status === 'Spare')?.reg || '', offRoad: false })}>Log a breakdown</button>}>
      {f.incidents.length ? <div className="tw"><table className="t small" aria-label="Bus breakdowns"><thead><tr><th>Date</th><th>Route</th><th>Bus</th><th>What happened</th><th>Trip</th><th className="num">Delay</th><th className="num">Riders</th><th>Cover</th></tr></thead>
        <tbody>{f.incidents.map((b) => <tr key={b.id}><td>{dmon(b.date)}</td><td>{b.routeId}</td><td>{b.bus}</td><td><b>{b.kind}</b> — {b.detail}</td><td>{b.trip === 'AM' ? 'Morning' : 'Afternoon'}</td><td className="num">{b.delayMin} min</td><td className="num">{b.students}</td><td>{b.replacedBy ? `Spare ${b.replacedBy}` : 'Repaired on the spot'}</td></tr>)}</tbody></table></div>
        : <p className="muted">No breakdowns this year.</p>}
      <table className="t small" aria-label="Bus fleet" style={{ marginTop: 12 }}><thead><tr><th>Bus</th><th className="num">Seats</th><th>Status</th><th>Route</th><th>Last service</th><th>Fitness valid until</th><th className="num">Breakdowns</th></tr></thead>
        <tbody>{f.buses.map((b) => <tr key={b.reg}><td className="b">{b.reg}{canLog && b.status === 'Under repair' && <button className="btn sm" style={{ marginLeft: 6 }} onClick={() => { run((d) => { d.buses.find((x) => x.reg === b.reg).status = b.routeId ? 'In service' : 'Spare'; }); notify(`${b.reg} back in service`); }}>Back in service</button>}</td><td className="num">{b.seats}</td><td><Status s={b.status} /></td><td>{b.routeId || '—'}</td><td>{b.lastService ? dmon(b.lastService) : '—'}</td><td>{b.fitnessUntil ? dmon(b.fitnessUntil) : '—'}</td><td className="num">{f.byBus.find(([r]) => r === b.reg)?.[1] || '—'}</td></tr>)}</tbody></table>
    </Card>
    {bd && <Modal title="Log a bus breakdown" onClose={() => setBd(null)} actions={<button className="btn pri" onClick={saveBd}>Save</button>}>
      <div className="form">
        <Field label="Date" req><Input type="date" value={bd.date} onChange={(e) => setBd({ ...bd, date: e.target.value })} /></Field>
        <Field label="Route" req><Select value={bd.routeId} onChange={(e) => setBd({ ...bd, routeId: e.target.value })} options={db.routes.map((r) => [r.id, `${r.id} · ${r.bus}`])} /></Field>
        <Field label="What happened" req><Select value={bd.kind} onChange={(e) => setBd({ ...bd, kind: e.target.value })} options={['Breakdown', 'Flat tyre', 'Battery', 'Accident', 'Other']} /></Field>
        <Field label="Trip"><Select value={bd.trip} onChange={(e) => setBd({ ...bd, trip: e.target.value })} options={[['AM', 'Morning'], ['PM', 'Afternoon']]} /></Field>
        <Field label="Details" req full><Input value={bd.detail} onChange={(e) => setBd({ ...bd, detail: e.target.value })} placeholder="e.g. Engine overheated near ITPL" /></Field>
        <Field label="Delay (minutes)"><Input type="number" min="0" value={bd.delayMin} onChange={(e) => setBd({ ...bd, delayMin: e.target.value })} /></Field>
        <Field label="Covered by"><Select value={bd.cover} onChange={(e) => setBd({ ...bd, cover: e.target.value })} options={[['', 'Repaired on the spot'], ...f.buses.filter((b) => b.status === 'Spare').map((b) => [b.reg, 'Spare ' + b.reg])]} /></Field>
      </div>
      <label className="row small" style={{ marginTop: 8 }}><input type="checkbox" checked={bd.offRoad} onChange={(e) => setBd({ ...bd, offRoad: e.target.checked })} />Bus taken off the road (mark it Under repair)</label>
    </Modal>}
  </section>;
}

function FeesSection({ period }) {
  const { db } = useStore();
  const f = feeDashboard(db);
  return <section className="dash-section" aria-label="Fees">
    <div className="kpis">
      <Kpi label="Fees collected" value={inr(f.paid)} sub={`${f.pct}% of the year's ${inr(f.billed)} billed`}><Delta now={f.paid} before={f.paidBefore} period={`the same time in ${period}`} pct /></Kpi>
      <Kpi label="Collected of what is due so far" value={`${f.duePct}%`} sub={`Target ${f.target}% · ${inr(f.dueBilled)} due so far`}><span className={'flag-chip ' + (f.duePct >= f.target ? 'ok' : 'over')}>{f.duePct >= f.target ? '✓ On target' : `▼ ${f.target - f.duePct} points below target`}</span></Kpi>
      <Kpi label="Still to collect this year" value={inr(f.due)} sub="Includes instalments not yet due" />
      <Kpi label="Overdue" value={inr(f.overdue)} sub={`${f.overdueCount} invoices · ${f.overdueStudents} students`} />
    </div>
    <InsightList items={feeInsights(db)} label="Fees" />
    <Card title={`Collected by class, as % of what is due so far · target ${f.target}%`}>
      <Bars label="Fee collection by class" rows={f.classes.filter((c) => c.billed).map((c) => ({ label: c.name, value: c.pct, tipNote: `${inr(c.paid)} of ${inr(c.billed)}`,
        flag: c.pct < f.target ? { kind: 'low', text: `${f.target - c.pct} below` } : { kind: 'ok', text: 'on target' } }))} max={100} target={f.target} targetName="Target" valueText={(r) => r.value + '%'} />
    </Card>
  </section>;
}

function EnrolmentSection({ period }) {
  const { db } = useStore();
  const f = registrationFigures(db);
  const [src, setSrc] = useState('');
  const [q, setQ] = useState('');
  const [n, setN] = useState(25);
  const colors = { WEBSITE: 'var(--s1)', APP: 'var(--s2)', ADMIN: 'var(--s3)' };
  const list = f.list.filter((u) => (!src || u.src === src) && (!q || (u.name + u.login).toLowerCase().includes(q.toLowerCase())));
  return <section className="dash-section" aria-label="Enrolment">
    <div className="kpis">
      <Kpi label="Accounts registered this year" value={f.thisYear}><Delta now={f.thisYear} before={f.beforeTotal} period={period} /></Kpi>
      {SOURCES.map(([k, name]) => <Kpi key={k} label={name} value={f.bySource[k]}><Delta now={f.bySource[k]} before={f.before?.[k]} period={period} /></Kpi>)}
    </div>
    <InsightList items={enrolInsights(db)} label="Enrolment" />
    <Card title="How people registered this year">
      <SegmentBar label="Registrations by source" parts={SOURCES.map(([k, name]) => ({ name, value: f.bySource[k], color: colors[k] }))} />
    </Card>
    <Card title="Who registered">
      <div className="row" style={{ marginBottom: 10 }}>
        <Select aria-label="Registered from" value={src} onChange={(e) => setSrc(e.target.value)} options={[['', 'Website, app and Admin'], ...SOURCES]} />
        <Input placeholder="Search name or sign-in ID" aria-label="Search registrations" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="small muted">{list.length} accounts</span></div>
      <table className="t" aria-label="Registrations"><thead><tr><th>Name</th><th>Sign-in ID</th><th>Role</th><th>Registered from</th><th>Date</th><th>Status</th></tr></thead>
        <tbody>{list.slice(0, n).map((u) => <tr key={u.id}><td className="b">{u.name}</td><td>{u.login}</td><td>{roleName(db, u.role || u.requestedRole)}</td>
          <td>{SOURCES.find(([k]) => k === u.src)[1]}{u.src === 'ADMIN' && u.addReason ? <div className="small muted">{u.addReason}</div> : null}</td><td>{u.createdAt ? dmon(u.createdAt) : '—'}</td><td><Status s={u.status} /></td></tr>)}</tbody></table>
      {list.length > n && <button className="btn sm" style={{ marginTop: 8 }} onClick={() => setN(n + 25)}>Show the next {Math.min(25, list.length - n)}</button>}
    </Card>
  </section>;
}

function Activity({ go }) {
  const { db, session } = useStore();
  const unmatched = db.notifications.filter((n) => n.status === 'UNMATCHED').length;
  return <>
    <Card title="Needs attention">
      <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9 }}>
        <li>{db.guardians.filter((g) => !g.email).length} guardians have no email — fee requests go by SMS</li>
        <li>{unmatched} incoming payment(s) waiting for a person to match {unmatched > 0 && <button className="btn sm" onClick={() => go('FEE_MATCHING')}>Open</button>}</li>
        <li>{db.questions.filter((q) => q.status === 'In review').length} questions waiting for review</li>
        {['ADMIN', 'PRINCIPAL', 'FRONT_OFFICE'].includes(session.role) && db.enquiries && <li>{db.enquiries.filter((e) => ['Submitted', 'In review'].includes(e.status)).length} admission applications waiting on the school <button className="btn sm" onClick={() => go('STU_ADMISSIONS')}>Open</button></li>}
        {['ADMIN', 'PRINCIPAL', 'TEACHER'].includes(session.role) && db.requests && <li>{db.requests.filter((r) => r.status === 'Submitted').length} pickup / early-leave request(s) waiting for a class coordinator <button className="btn sm" onClick={() => go('STU_REQUESTS')}>Open</button></li>}
        {db.bank.pending && <li>Bank details change waiting for Principal approval</li>}
      </ul>
    </Card>
    <Card title="Recent activity">
      {db.audit.length === 0 ? <p className="muted">Nothing yet — try collecting a fee, sending fee emails or importing data.</p>
        : <table className="t"><tbody>{db.audit.slice(0, 8).map((a, i) => <tr key={i}><td className="muted small">{dmon(a.at)}</td><td>{a.who}</td><td className="b">{a.action}</td><td>{a.detail}</td></tr>)}</tbody></table>}
    </Card>
  </>;
}

function ParentHome({ go }) {
  const { db, session } = useStore();
  const kid = myChildren(db, session)[0] || db.students.find((s) => s.admNo === 'ADM-2025-0231');
  const u = db.users.find((x) => x.id === session.userId);
  const due = db.invoices.filter((i) => i.studentId === kid.id && i.status !== 'PAID');
  return (
    <Page title={`Welcome, ${(u?.name || session.name || 'Rohit').split(' ')[0]}`} sub={`${fullName(kid)} · ${classLabel(db, kid)}`}>
      <div className="grid g3">
        <Stat label="Attendance" value={kid.attendance + '%'} />
        <Stat label="Fees due" value={inr(due.reduce((a, i) => a + balance(i), 0))} sub={due[0] ? 'Next: ' + dmon(due[0].due) : 'All paid'} />
        <Stat label="House" value={kid.house} />
      </div>
      <div className="row" style={{ marginTop: 16 }}><button className="btn pri" onClick={() => go('SELF_FEES')}>Pay fees</button><button className="btn" onClick={() => go('SELF_REQUESTS')}>Requests to school</button><button className="btn" onClick={() => go('SELF_CHILD')}>View profile</button><button className="btn" onClick={() => go('ACA_TIMETABLE')}>Timetable</button></div>
    </Page>
  );
}

// Insights pages — in production these are Power BI reports embedded with the school's row-level filter.
export function Insights({ code }) {
  const { db } = useStore();
  const f = feeFigures(db);
  const active = db.students.filter((s) => s.status === 'Active');
  const pbi = <p className="small muted">In production this page embeds the matching Power BI report, filtered to this school only (row-level security role “Tenant”). The figures below are computed live from the test data.</p>;
  if (code === 'FEE_INS') {
    const byInst = ['Installment I', 'Installment II', 'Installment III'].map((k) => { const l = db.invoices.filter((i) => i.instalment === k); return [k.replace('Installment ', 'Inst '), Math.round(100 * l.reduce((a, i) => a + i.paid, 0) / (l.reduce((a, i) => a + i.net, 0) || 1))]; });
    const modes = ['UPI', 'BANK', 'CARD', 'CASH'].map((m) => [m, db.payments.filter((p) => p.mode === m).reduce((a, p) => a + p.amount, 0)]);
    return <Page title="Fee insights" sub="Collection, dues and payment modes">{pbi}
      <div className="grid g4" style={{ marginBottom: 16 }}><Stat label="Billed" value={inr(f.billed)} /><Stat label="Collected" value={inr(f.paid)} /><Stat label="Collection %" value={f.pct + '%'} /><Stat label="Overdue" value={inr(f.overdue)} /></div>
      <div className="grid g2"><Card title="Collected % by instalment"><MiniBars data={byInst} fmt={(v) => v + '%'} /></Card><Card title="Collected by mode"><MiniBars data={modes} fmt={(v) => '₹' + Math.round(v / 100000) + 'L'} /></Card></div></Page>;
  }
  if (code === 'STF_INS') {
    const depts = [...new Set(db.staff.map((s) => s.dept))].map((d) => [d.split(' ')[0], db.staff.filter((s) => s.dept === d).length]);
    return <Page title="Staff insights">{pbi}<Card title="Staff by department"><MiniBars data={depts} /></Card></Page>;
  }
  const att = db.classes.map((c) => { const l = active.filter((s) => classOf(db, s)?.id === c.id); return [c.name.replace('Grade ', ''), Math.round(l.reduce((a, s) => a + s.attendance, 0) / (l.length || 1))]; });
  return <Page title="Student insights">{pbi}
    <div className="grid g3" style={{ marginBottom: 16 }}><Stat label="Active students" value={active.length} /><Stat label="Girls / Boys" value={`${active.filter((s) => s.gender === 'Female').length} / ${active.filter((s) => s.gender === 'Male').length}`} /><Stat label="Use school transport" value={active.filter((s) => s.band).length} /></div>
    <Card title="Average attendance % by grade"><MiniBars data={att} fmt={(v) => v + '%'} /></Card>
    <Card title="Lowest attendance"><table className="t"><tbody>{[...active].sort((a, b) => a.attendance - b.attendance).slice(0, 5).map((s) => <tr key={s.id}><td>{fullName(s)}</td><td>{classLabel(db, s)}</td><td style={{ width: 200 }}><Progress pct={s.attendance} /></td><td className="num">{s.attendance}%</td></tr>)}</tbody></table></Card>
  </Page>;
}
export { Status };
