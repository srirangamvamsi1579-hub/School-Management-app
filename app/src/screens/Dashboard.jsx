import { useStore } from '../data/store.js';
import { Page, Card, Stat, Bars, Progress, Status } from '../components/ui.jsx';
import { inr, num, dmon } from '../lib/format.js';
import { classOf, balance, fullName, classLabel, tenantOf } from '../lib/logic.js';
import { PLANS } from '../data/menu.js';
import { myChildren } from './Requests.jsx';

function feeFigures(db) {
  const billed = db.invoices.reduce((a, i) => a + i.net, 0);
  const paid = db.invoices.reduce((a, i) => a + i.paid, 0);
  const overdue = db.invoices.filter((i) => i.status === 'OVERDUE').reduce((a, i) => a + balance(i), 0);
  return { billed, paid, overdue, pct: Math.round((100 * paid) / (billed || 1)) };
}

export function Dashboard({ go }) {
  const { db, session } = useStore();
  const t = tenantOf(db);
  const f = feeFigures(db);
  const plan = PLANS.find((p) => p.code === t.plan);
  const active = db.students.filter((s) => s.status === 'Active');
  if (session.role === 'PARENT') return <ParentHome go={go} />;
  const byGrade = db.classes.map((c) => [c.name.replace('Grade ', ''), active.filter((s) => classOf(db, s)?.id === c.id).length]);
  const unmatched = db.notifications.filter((n) => n.status === 'UNMATCHED').length;
  return (
    <Page title={`Good day — ${t.name}`} sub={`Academic year ${db.year} · ${plan.name} plan (${plan.range} students)`}>
      <div className="grid g4" style={{ marginBottom: 16 }}>
        <Stat label="Students" value={num(active.length)} sub={plan.cap ? `${Math.round(100 * active.length / plan.cap)}% of plan limit` : 'No limit'} />
        <Stat label="Staff" value={db.staff.length} sub={`${db.staff.filter((s) => s.desig.includes('GT')).length} teachers`} />
        <Stat label="Fees collected" value={inr(f.paid)} sub={`${f.pct}% of ${inr(f.billed)} billed`} />
        <Stat label="Overdue" value={inr(f.overdue)} sub={`${db.invoices.filter((i) => i.status === 'OVERDUE').length} invoices`} />
      </div>
      <div className="grid g-side">
        <Card title="Students by grade"><Bars data={byGrade} /></Card>
        <Card title="Needs attention">
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9 }}>
            <li>{db.guardians.filter((g) => !g.email).length} guardians have no email — fee requests go by SMS</li>
            <li>{unmatched} incoming payment(s) waiting for a person to match {unmatched > 0 && <button className="btn sm" onClick={() => go('FEE_MATCHING')}>Open</button>}</li>
            <li>{db.questions.filter((q) => q.status === 'In review').length} questions waiting for review</li>
            <li>Installment III due 10 Dec — {db.invoices.filter((i) => i.instalment === 'Installment III' && i.status !== 'PAID').length} unpaid</li>
            {session.role === 'ADMIN' && db.users?.some((u) => u.status === 'PENDING') && <li>{db.users.filter((u) => u.status === 'PENDING').length} new account(s) waiting for approval <button className="btn sm" onClick={() => go('OPS_USERS')}>Review</button></li>}
            {['ADMIN', 'PRINCIPAL', 'FRONT_OFFICE'].includes(session.role) && db.enquiries && <li>{db.enquiries.filter((e) => ['Submitted', 'In review'].includes(e.status)).length} admission applications waiting on the school <button className="btn sm" onClick={() => go('STU_ADMISSIONS')}>Open</button></li>}
            {['ADMIN', 'PRINCIPAL', 'TEACHER'].includes(session.role) && db.requests && <li>{db.requests.filter((r) => r.status === 'Submitted').length} pickup / early-leave request(s) waiting for a class coordinator <button className="btn sm" onClick={() => go('STU_REQUESTS')}>Open</button></li>}
            {db.bank.pending && <li>Bank details change waiting for Principal approval</li>}
          </ul>
        </Card>
      </div>
      <Card title="Recent activity">
        {db.audit.length === 0 ? <p className="muted">Nothing yet — try collecting a fee, sending fee emails or importing data.</p>
          : <table className="t"><tbody>{db.audit.slice(0, 8).map((a, i) => <tr key={i}><td className="muted small">{dmon(a.at)}</td><td>{a.who}</td><td className="b">{a.action}</td><td>{a.detail}</td></tr>)}</tbody></table>}
      </Card>
    </Page>
  );
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
      <div className="row" style={{ marginTop: 16 }}><button className="btn pri" onClick={() => go('SELF_FEES')}>Pay fees</button><button className="btn" onClick={() => go('SELF_REQUESTS')}>Pickup / early leave request</button><button className="btn" onClick={() => go('SELF_CHILD')}>View profile</button><button className="btn" onClick={() => go('ACA_TIMETABLE')}>Timetable</button></div>
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
      <div className="grid g2"><Card title="Collected % by instalment"><Bars data={byInst} fmt={(v) => v + '%'} /></Card><Card title="Collected by mode"><Bars data={modes} fmt={(v) => '₹' + Math.round(v / 100000) + 'L'} /></Card></div></Page>;
  }
  if (code === 'STF_INS') {
    const depts = [...new Set(db.staff.map((s) => s.dept))].map((d) => [d.split(' ')[0], db.staff.filter((s) => s.dept === d).length]);
    return <Page title="Staff insights">{pbi}<Card title="Staff by department"><Bars data={depts} /></Card></Page>;
  }
  const att = db.classes.map((c) => { const l = active.filter((s) => classOf(db, s)?.id === c.id); return [c.name.replace('Grade ', ''), Math.round(l.reduce((a, s) => a + s.attendance, 0) / (l.length || 1))]; });
  return <Page title="Student insights">{pbi}
    <div className="grid g3" style={{ marginBottom: 16 }}><Stat label="Active students" value={active.length} /><Stat label="Girls / Boys" value={`${active.filter((s) => s.gender === 'Female').length} / ${active.filter((s) => s.gender === 'Male').length}`} /><Stat label="Use school transport" value={active.filter((s) => s.band).length} /></div>
    <Card title="Average attendance % by grade"><Bars data={att} fmt={(v) => v + '%'} /></Card>
    <Card title="Lowest attendance"><table className="t"><tbody>{[...active].sort((a, b) => a.attendance - b.attendance).slice(0, 5).map((s) => <tr key={s.id}><td>{fullName(s)}</td><td>{classLabel(db, s)}</td><td style={{ width: 200 }}><Progress pct={s.attendance} /></td><td className="num">{s.attendance}%</td></tr>)}</tbody></table></Card>
  </Page>;
}
export { Status };
