// Release 14 screens: Curriculum Planning (LMS), Portfolios, Backups & Restore, and the exam board bar.
import { useState } from 'react';
import { useStore } from '../data/store.js';
import { Page, Card, Field, Input, Select, Modal, Pill, Stat, Progress } from '../components/ui.jsx';
import { log, tenantOf } from '../lib/logic.js';
import { myChildren } from './Requests.jsx';
import { StudentPick } from './Campus.jsx';
import {
  BOARDS, boardOf, setBoard, UNIT_STATUS, MONTHS, addUnit, setUnitProgress, coverage, PORTFOLIO_KINDS, addPortfolioItem, portfolioOf,
  backupJson, recordBackup, readBackup, restoreBackup, sizeText
} from '../lib/release14.js';

const dmy = (d) => (d ? new Date(d.length === 10 ? d + 'T00:00:00' : d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const dmyt = (d) => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const today = () => new Date().toISOString().slice(0, 10);
const SUBJECTS = ['English', 'Mathematics', 'Science', 'Social Science', 'Hindi', 'Kannada', 'Computers', 'EVS'];
const STATUS_KIND = { Planned: '', 'In progress': 'warn', Taught: 'ok' };

function useAct() {
  const { run, notify } = useStore();
  return (fn, msg) => { try { const r = run(fn); notify(typeof msg === 'function' ? msg(r) : msg); return r || true; } catch (e) { notify(e.message); return false; } };
}

// ---------------------------------------------------------------- Board bar (Board integration add-on)
export function BoardBar() {
  const { db, session } = useStore();
  const act = useAct();
  const t = tenantOf(db);
  const code = boardOf(t);
  const can = ['ADMIN', 'PRINCIPAL'].includes(session.role);
  return <div className="ro-bar board-bar" role="region" aria-label="Exam board settings" style={{ background: 'var(--card)', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
    <b>Exam board</b>
    <Select aria-label="Exam board" value={code} disabled={!can} onChange={(e) => act((d) => { setBoard(d, d.tenantId, e.target.value); log(d, session.name, 'Exam board changed', e.target.value); }, `Exam board: ${BOARDS[e.target.value].name}. Grades and report formats in Exams follow it.`)}
      options={Object.entries(BOARDS).map(([k, b]) => [k, b.name])} />
    <span className="small">{BOARDS[code].scheme} Report format: {BOARDS[code].report}.</span>
    {!can && <span className="small muted">The Admin or Principal changes the board.</span>}
  </div>;
}

// ---------------------------------------------------------------- Curriculum Planning (LMS)
export function Curriculum() {
  const { db, session } = useStore();
  const act = useAct();
  const [cls, setCls] = useState('C8');
  const [subject, setSubject] = useState('Mathematics');
  const [form, setForm] = useState(null);
  const can = ['ADMIN', 'PRINCIPAL', 'TEACHER'].includes(session.role);
  const units = (db.curriculum || []).filter((u) => u.classId === cls && u.subject === subject).sort((a, b) => MONTHS.indexOf(a.month) - MONTHS.indexOf(b.month));
  const all = (db.curriculum || []).filter((u) => u.classId === cls);
  const c = coverage(units);
  const className = db.classes.find((x) => x.id === cls)?.name;
  return <Page title="Curriculum planning" sub="Plan each subject's units month by month for the year, then record the periods taught. Coordinators see how much of the syllabus is covered."
    actions={can && <button className="btn pri" onClick={() => setForm({ classId: cls, subject, title: '', month: 'Jun', periods: 8, outcomes: '' })}>Add a unit</button>}>
    <div className="row" style={{ marginBottom: 10, flexWrap: 'wrap' }}>
      <Field label="Class"><Select aria-label="Class" value={cls} onChange={(e) => setCls(e.target.value)} options={db.classes.map((x) => [x.id, x.name])} /></Field>
      <Field label="Subject"><Select aria-label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} options={SUBJECTS} /></Field>
    </div>
    <div className="kpis">
      <Stat label="Units planned" value={c.units} sub={`${c.done} taught`} />
      <Stat label="Periods" value={`${c.taught} / ${c.planned}`} sub="taught / planned" />
      <Stat label="Syllabus covered" value={c.pct + '%'} sub={`${className} ${subject}`} />
      <Stat label="All subjects" value={coverage(all).pct + '%'} sub={`${className}, ${new Set(all.map((u) => u.subject)).size} subjects`} />
    </div>
    <Card title={`${className} · ${subject}`}>{units.length ? <div className="tw"><table className="t"><thead><tr><th>Month</th><th>Unit</th><th>Learning outcomes</th><th>Periods</th><th>Taught</th><th>Status</th></tr></thead>
      <tbody>{units.map((u) => <tr key={u.id}><td>{u.month}</td><td className="b">{u.title}</td><td className="small">{u.outcomes || '—'}</td><td>{u.periods}</td>
        <td style={{ minWidth: 160 }}><div className="row"><Input type="number" min="0" max={u.periods} aria-label={`Periods taught: ${u.title}`} disabled={!can} value={u.taught} style={{ width: 70 }}
          onChange={(e) => act((d) => setUnitProgress(d, u.id, e.target.value), (x) => `${x.title}: ${x.taught} of ${x.periods} periods`)} /><Progress pct={Math.round(100 * u.taught / u.periods)} label={`${u.title} taught`} /></div></td>
        <td><Pill kind={STATUS_KIND[u.status]}>{u.status}</Pill></td></tr>)}</tbody></table></div> : <p className="muted">No units planned for {className} {subject} yet. {can && 'Use “Add a unit”.'}</p>}</Card>
    {form && <Modal title="Add a unit" onClose={() => setForm(null)} actions={<button className="btn pri" onClick={() => { if (act((d) => { const u = addUnit(d, { ...form, by: session.name }); log(d, session.name, 'Unit planned', `${u.classId} ${u.subject} · ${u.title}`); return u; }, 'Unit added to the plan')) { setCls(form.classId); setSubject(form.subject); setForm(null); } }}>Save</button>}>
      <div className="form">
        <Field label="Class" req><Select value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })} options={db.classes.map((x) => [x.id, x.name])} /></Field>
        <Field label="Subject" req><Select value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} options={SUBJECTS} /></Field>
        <Field label="Unit" req full><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Linear equations in one variable" /></Field>
        <Field label="Month" req><Select value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })} options={MONTHS} /></Field>
        <Field label="Periods" req><Input type="number" min="1" max="60" value={form.periods} onChange={(e) => setForm({ ...form, periods: e.target.value })} /></Field>
        <Field label="Learning outcomes" full><Input value={form.outcomes} onChange={(e) => setForm({ ...form, outcomes: e.target.value })} placeholder="What students should be able to do" /></Field>
      </div></Modal>}
  </Page>;
}

// ---------------------------------------------------------------- Portfolios
function PortfolioItems({ items }) {
  if (!items.length) return <p className="muted">Nothing in the portfolio yet.</p>;
  return <div className="grid g3">{items.map((p) => <div key={p.id} className="card" style={{ margin: 0 }}>
    <div className="row" style={{ justifyContent: 'space-between' }}><Pill kind="info">{p.kind}</Pill>{!p.shared && <Pill>Not shared with parents</Pill>}</div>
    <h3 style={{ margin: '8px 0 4px' }}>{p.title}</h3>
    <div className="small muted">{[p.subject, dmy(p.date), p.by].filter(Boolean).join(' · ')}</div>
    {p.note && <p className="small" style={{ marginBottom: 0 }}>{p.note}</p>}
  </div>)}</div>;
}
export function Portfolios() {
  const { db, session } = useStore();
  const act = useAct();
  const parent = session.role === 'PARENT';
  const [sid, setSid] = useState(() => (db.portfolios || [])[0]?.studentId || '');
  const [form, setForm] = useState(null);
  if (parent) return <Page title="Portfolio" sub="Your child's best work, projects and teachers' comments, shared by the school.">
    {myChildren(db, session).map((k) => <Card key={k.id} title={`${k.first} ${k.last}`}><PortfolioItems items={portfolioOf(db, k.id, true)} /></Card>)}</Page>;
  const can = ['ADMIN', 'PRINCIPAL', 'TEACHER'].includes(session.role);
  const s = db.students.find((x) => x.id === sid);
  const recent = (db.portfolios || []).slice(0, 6);
  return <Page title="Portfolios" sub="Collect each student's best work, projects, reflections and certificates with a teacher's comment. Items marked shared show to parents."
    actions={can && s && <button className="btn pri" onClick={() => setForm({ studentId: sid, title: '', kind: 'Work sample', subject: 'English', date: today(), note: '', shared: true })}>Add to portfolio</button>}>
    <div style={{ maxWidth: 420 }}><StudentPick value={sid} onChange={setSid} label="Student" /></div>
    {s ? <Card title={`${s.first} ${s.last} · ${s.admNo}`} right={<span className="small muted">{portfolioOf(db, sid).length} items</span>}><PortfolioItems items={portfolioOf(db, sid)} /></Card>
      : <Card title="Added recently"><div className="tw"><table className="t"><tbody>{recent.map((p) => { const st = db.students.find((x) => x.id === p.studentId); return <tr key={p.id}><td className="b">{st?.first} {st?.last}</td><td>{p.title}</td><td>{p.kind}</td><td>{dmy(p.date)}</td><td><button className="btn sm" onClick={() => setSid(p.studentId)}>Open</button></td></tr>; })}</tbody></table></div></Card>}
    {form && <Modal title={`Add to ${s.first}'s portfolio`} onClose={() => setForm(null)} actions={<button className="btn pri" onClick={() => { if (act((d) => addPortfolioItem(d, { ...form, by: session.name }), 'Added to the portfolio')) setForm(null); }}>Save</button>}>
      <div className="form">
        <Field label="Title" req full><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Science fair model: water filter" /></Field>
        <Field label="Kind" req><Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} options={PORTFOLIO_KINDS} /></Field>
        <Field label="Subject"><Select value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} options={['', ...SUBJECTS]} /></Field>
        <Field label="Date" req><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
        <Field label="Teacher's comment" full><Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
        <label className="row small"><input type="checkbox" checked={form.shared} onChange={(e) => setForm({ ...form, shared: e.target.checked })} /> Share with parents</label>
      </div></Modal>}
  </Page>;
}

// ---------------------------------------------------------------- Backups & Restore
export function Backups() {
  const { db, run, notify, session } = useStore();
  const [file, setFile] = useState(null);     // { name, parsed } waiting for confirmation
  const b = db.backup || { schedule: 'DAILY', time: '02:00', keepDays: 30, history: [] };
  const can = session.role === 'ADMIN';
  const take = () => {
    const json = backupJson(db);
    const code = tenantOf(db).code;
    const name = `backup-${code}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`;
    try { const url = URL.createObjectURL(new Blob([json], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); } catch (e) { /* download blocked */ }
    run((d) => { recordBackup(d, { kind: 'On demand', by: session.name, size: json.length }); log(d, session.name, 'Backup taken', name); });
    notify(`Backup downloaded: ${name}`);
  };
  const pick = (e) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    f.text().then((text) => { try { setFile({ name: f.name, parsed: readBackup(text, db) }); } catch (err) { notify(err.message); } });
  };
  const restore = () => { run((d) => { restoreBackup(d, file.parsed, session.name); log(d, session.name, 'Restored from backup', file.name); }); notify('Data restored from the backup'); setFile(null); };
  const setRule = (k, v) => { run((d) => { d.backup = { ...b, ...d.backup, [k]: v }; }); notify('Backup schedule saved'); };
  const auto = b.history.filter((h) => h.kind === 'Automatic');
  return <Page title="Backups & restore" sub="The school's data is backed up automatically every night and kept for the days you choose. Take a backup now to download it, or restore the school from a backup file."
    actions={can && <button className="btn pri" onClick={take}>Back up now</button>}>
    <div className="kpis">
      <Stat label="Last backup" value={b.history[0] ? dmyt(b.history[0].at) : '—'} sub={b.history[0]?.kind} />
      <Stat label="Automatic backups kept" value={auto.length} sub={`last ${b.keepDays} days`} />
      <Stat label="Size of a backup" value={sizeText(backupJson(db).length)} sub="all the school's records" />
    </div>
    <Card title="Schedule"><div className="form">
      <Field label="How often"><Select aria-label="How often" disabled={!can} value={b.schedule} onChange={(e) => setRule('schedule', e.target.value)} options={[['DAILY', 'Every night'], ['WEEKLY', 'Every Sunday night']]} /></Field>
      <Field label="At"><Select aria-label="Backup time" disabled={!can} value={b.time} onChange={(e) => setRule('time', e.target.value)} options={['01:00', '02:00', '03:00', '04:00']} /></Field>
      <Field label="Keep for"><Select aria-label="Keep backups for" disabled={!can} value={String(b.keepDays)} onChange={(e) => setRule('keepDays', +e.target.value)} options={[['7', '7 days'], ['30', '30 days'], ['90', '90 days']]} /></Field>
    </div><p className="small muted">Backups are encrypted and stored in a second AWS region in India. Only the Admin can restore.</p></Card>
    {can && <Card title="Restore from a backup file">
      <p className="small">Pick a backup file downloaded from this screen. You'll see what it contains before anything changes. Restoring replaces today's data with the backup's.</p>
      <label className="btn"><input type="file" accept=".json,application/json" onChange={pick} style={{ display: 'none' }} aria-label="Backup file" />Choose backup file</label>
    </Card>}
    <Card title="Backup history"><div className="tw"><table className="t"><thead><tr><th>When</th><th>Kind</th><th>By</th><th>Size</th><th>Status</th></tr></thead>
      <tbody>{b.history.slice(0, 20).map((h) => <tr key={h.id}><td>{dmyt(h.at)}</td><td>{h.kind}</td><td>{h.by}</td><td>{h.size ? sizeText(h.size) : '—'}</td><td><Pill kind="ok">{h.status}</Pill></td></tr>)}</tbody></table></div></Card>
    {file && <Modal title="Restore this backup?" onClose={() => setFile(null)} actions={<><button className="btn" onClick={() => setFile(null)}>Cancel</button><button className="btn pri" onClick={restore}>Restore</button></>}>
      <p><b>{file.name}</b>, taken {dmyt(file.parsed.at)}.</p>
      <p className="small">It has {file.parsed.data.students.length} students, {file.parsed.data.users.length} users and {file.parsed.data.invoices.length} invoices. Everything entered after the backup was taken will be replaced.</p>
    </Modal>}
  </Page>;
}
