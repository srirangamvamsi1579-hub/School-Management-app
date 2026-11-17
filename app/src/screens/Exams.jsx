import { useState } from 'react';
import { useStore } from '../data/store.js';
import { Page, Card, Field, Input, Select, Status, Modal, Html, Stat, printPage } from '../components/ui.jsx';
import { dmon, num } from '../lib/format.js';
import { generatePaper, log, fullName, classLabel, renderFor } from '../lib/logic.js';
import { CHAPTERS, FORMATS } from '../data/seed.js';

export function QuestionPapers() {
  const { db, run, notify, session } = useStore();
  const [fmt, setFmt] = useState('UT25');
  const [chs, setChs] = useState([1, 2, 4]);
  const [mix, setMix] = useState([30, 50, 20]);
  const [title, setTitle] = useState('Unit Test 2 — Mathematics — Class X');
  const [view, setView] = useState(null);
  const setEasy = (e) => { const v = Number(e.target.value); setMix([v, Math.max(0, 100 - v - mix[2]), mix[2]]); };
  const setTough = (e) => { const v = Number(e.target.value); setMix([mix[0], Math.max(0, 100 - mix[0] - v), v]); };
  const gen = () => {
    const p = run((d) => generatePaper(d, { chapters: chs, mix, formatCode: fmt, sets: 3, title, by: session.role }));
    notify('3 sets generated — no question repeats across sets'); setView(p.id);
  };
  const paper = db.papers.find((p) => p.id === view);
  if (paper) return <PaperPreview paper={paper} back={() => setView(null)} />;
  return (
    <Page title="Question papers" sub="Pick the board format, chapters and difficulty mix. The app picks questions from the approved bank and makes Sets A, B and C.">
      <div className="grid g-side">
        <Card title="New paper">
          <div className="form" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <Field label="Title" full><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
            <Field label="Board / class / subject"><Select options={['CBSE · Class X · Mathematics']} /></Field>
            <Field label="Paper format"><Select value={fmt} onChange={(e) => setFmt(e.target.value)} options={FORMATS.map((f) => [f.code, `${f.name} (${f.marks} marks, ${f.minutes} min)`])} /></Field>
          </div>
          <h3 style={{ marginTop: 14 }}>Chapters</h3>
          <div className="grid g2" style={{ gap: 4 }}>
            {CHAPTERS.map(([n, name]) => <label key={n} className="row small"><input type="checkbox" checked={chs.includes(n)} onChange={() => setChs(chs.includes(n) ? chs.filter((x) => x !== n) : [...chs, n].sort((a, b) => a - b))} />{n}. {name}</label>)}
          </div>
          <h3 style={{ marginTop: 14 }}>Difficulty mix</h3>
          <div className="grid g3">
            <Field label={`Easy ${mix[0]}%`}><input type="range" min="0" max="100" step="5" value={mix[0]} onChange={setEasy} /></Field>
            <Field label={`Intermediate ${mix[1]}%`}><div className="small muted" style={{ paddingTop: 6 }}>Remainder</div></Field>
            <Field label={`Tough ${mix[2]}%`}><input type="range" min="0" max="100" step="5" value={mix[2]} onChange={setTough} /></Field>
          </div>
          <div className="row end" style={{ marginTop: 12 }}><button className="btn pri" disabled={!chs.length} onClick={gen}>Generate 3 sets</button></div>
        </Card>
        <Card title="Recent papers">
          {db.papers.length === 0 ? <p className="muted">None yet.</p> : db.papers.map((p) => <div key={p.id} className="row" style={{ justifyContent: 'space-between', borderBottom: '1px solid var(--line)', padding: '6px 0' }}>
            <div><div className="b small">{p.title}</div><div className="small muted">{dmon(p.at)} · {p.stats.total} marks</div></div><div className="row"><Status s={p.status} /><button className="btn sm" onClick={() => setView(p.id)}>Open</button></div></div>)}
        </Card>
      </div>
    </Page>
  );
}

function PaperPreview({ paper, back }) {
  const { run, notify, session } = useStore();
  const [set, setSet] = useState(0);
  const [key, setKey] = useState(false);
  const fmt = FORMATS.find((f) => f.code === paper.formatCode);
  const qs = paper.sets[set].questions;
  const secs = [...new Set(qs.map((q) => q.section))];
  const act = (status, msg) => { run((d) => { const p = d.papers.find((x) => x.id === paper.id); p.status = status; if (status === 'Approved') { p.approvedBy = session.role; } log(d, session.role, 'Paper ' + status.toLowerCase(), p.title); }); notify(msg); };
  return (
    <Page title={paper.title} sub={`${fmt.name} · Set ${paper.sets[set].code}`}
      actions={<><button className="btn" onClick={back}>Back</button>{paper.sets.map((s, i) => <button key={s.code} className={'btn' + (i === set ? ' pri' : '')} onClick={() => setSet(i)}>Set {s.code}</button>)}
        <button className="btn" onClick={() => setKey(!key)}>{key ? 'Hide' : 'Show'} answer key info</button>
        {paper.status === 'Draft' && <button className="btn pri" onClick={() => act('Pending approval', 'Sent to the Principal for approval')}>Send for approval</button>}
        {paper.status === 'Pending approval' && ['PRINCIPAL', 'ADMIN'].includes(session.role) && <button className="btn pri" onClick={() => act('Approved', 'Paper approved and locked')}>Approve & lock</button>}
        {paper.status === 'Approved' && <button className="btn pri" onClick={() => { act('Printed', 'Print logged'); setTimeout(() => printPage(), 50); }}>Print</button>}</>}>
      <div className="grid g4 noprint" style={{ marginBottom: 14 }}>
        <Stat label="Total marks" value={paper.stats.total} sub={`target ${fmt.marks}`} /><Stat label="Easy / Inter / Tough" value={`${paper.stats.easy}/${paper.stats.inter}/${paper.stats.tough}`} sub={`asked ${paper.mix.join('/')}`} />
        <Stat label="Competency-based" value={paper.stats.competency + '%'} sub="CBSE expects ≥ 50% in board years" /><Stat label="Status" value={<Status s={paper.status} />} />
      </div>
      {paper.stats.shortfall.length > 0 && <div className="note warn noprint" style={{ marginBottom: 12 }}>Not enough approved questions for: {paper.stats.shortfall.join(', ')}. Add questions in the bank or choose more chapters.</div>}
      <div className="paper">
        <div style={{ textAlign: 'center' }}><b style={{ fontSize: 18 }}>[SCHOOL NAME]</b><br />{paper.title} · Set {paper.sets[set].code}<br />Time: {fmt.minutes} minutes · Maximum marks: {fmt.marks}</div>
        <p><b>General instructions:</b></p><ol style={{ marginTop: 0 }}>{fmt.instructions.map((x, i) => <li key={i}>{x}</li>)}</ol>
        {secs.map((s) => (
          <div key={s}>
            <div className="sec">SECTION {s}</div>
            {qs.filter((q) => q.section === s).map((q) => (
              <div key={q.no} style={{ display: 'flex', gap: 8, margin: '6px 0' }}>
                <span style={{ width: 26 }}>{q.no}.</span><span style={{ flex: 1 }}>{q.text}{q.options && <div>{q.options.join('   ')}</div>}
                  {key && <div className="small" style={{ color: '#6B7280' }}>[{q.difficulty.toLowerCase()} · ch {q.chapter} · {q.topic}]</div>}</span><span>[{q.marks}]</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Page>
  );
}

export function ApprovedPapers({ go }) {
  const { db } = useStore();
  const list = db.papers.filter((p) => p.status !== 'Draft');
  return <Page title="Approved papers" sub="Papers sent for approval, approved (locked) and printed. Approved papers can't be edited — make a new version instead.">
    {list.length === 0 ? <Card><p>No papers yet. Generate one in <button className="btn sm" onClick={() => go('EXM_QP')}>Question Papers</button> and send it for approval.</p></Card> :
      <div className="tw"><table className="t"><thead><tr><th>Paper</th><th>Format</th><th>Marks</th><th>Created</th><th>Approved by</th><th>Status</th></tr></thead>
        <tbody>{list.map((p) => <tr key={p.id}><td className="b">{p.title}</td><td>{FORMATS.find((f) => f.code === p.formatCode).name}</td><td>{p.stats.total}</td><td>{dmon(p.at)}</td><td>{p.approvedBy || '—'}</td><td><Status s={p.status} /></td></tr>)}</tbody></table></div>}
  </Page>;
}

export function QuestionBank() {
  const { db, run, notify, session } = useStore();
  const [ch, setCh] = useState('');
  const [diff, setDiff] = useState('');
  const [type, setType] = useState('');
  const [add, setAdd] = useState(null);
  const rows = db.questions.filter((q) => (!ch || q.chapter === Number(ch)) && (!diff || q.difficulty === diff) && (!type || q.type === type));
  const save = () => { run((d) => { d.questions.unshift({ ...add, id: 'Q' + (d.questions.length + 1), board: 'CBSE', grade: 10, subject: 'Mathematics', chapter: Number(add.chapter),
    marks: { MCQ: 1, AR: 1, VSA: 2, SA: 3, LA: 5, CASE: 4 }[add.type], status: session.role === 'TEACHER' ? 'In review' : 'Approved', used: 0, source: 'Teacher' }); log(d, session.role, 'Question added', add.text.slice(0, 40)); });
    notify(session.role === 'TEACHER' ? 'Question sent for review' : 'Question added'); setAdd(null); };
  return (
    <Page title="Question bank" sub={`${num(db.questions.length)} questions · CBSE Class X Mathematics`} actions={<button className="btn pri" onClick={() => setAdd({ chapter: 1, topic: CHAPTERS[0][2][0], type: 'MCQ', difficulty: 'EASY', text: '', competency: false })}>Add question</button>}>
      <div className="row" style={{ marginBottom: 12 }}>
        <Select value={ch} onChange={(e) => setCh(e.target.value)} options={[['', 'All chapters'], ...CHAPTERS.map(([n, name]) => [n, n + '. ' + name])]} />
        <Select value={diff} onChange={(e) => setDiff(e.target.value)} options={[['', 'All levels'], ['EASY', 'Easy'], ['INTERMEDIATE', 'Intermediate'], ['TOUGH', 'Tough']]} />
        <Select value={type} onChange={(e) => setType(e.target.value)} options={[['', 'All types'], 'MCQ', 'AR', 'VSA', 'SA', 'LA', 'CASE']} />
        <span className="muted small">{rows.length} shown</span>
      </div>
      <div className="tw"><table className="t"><thead><tr><th>Ch.</th><th>Topic</th><th>Type</th><th>Marks</th><th>Level</th><th>Question</th><th>Used</th><th>Status</th></tr></thead>
        <tbody>{rows.slice(0, 200).map((q) => <tr key={q.id}><td>{q.chapter}</td><td>{q.topic}</td><td>{q.type}</td><td>{q.marks}</td><td>{q.difficulty[0] + q.difficulty.slice(1).toLowerCase()}</td><td style={{ maxWidth: 420 }}>{q.text}</td><td>{q.used}</td><td><Status s={q.status} /></td></tr>)}</tbody></table></div>
      {add && <Modal title="Add question" onClose={() => setAdd(null)} actions={<button className="btn pri" disabled={add.text.length < 10} onClick={save}>Save</button>}>
        <div className="form">
          <Field label="Chapter"><Select value={add.chapter} onChange={(e) => { const c = CHAPTERS.find((x) => x[0] === Number(e.target.value)); setAdd({ ...add, chapter: c[0], topic: c[2][0] }); }} options={CHAPTERS.map(([n, name]) => [n, n + '. ' + name])} /></Field>
          <Field label="Topic"><Select value={add.topic} onChange={(e) => setAdd({ ...add, topic: e.target.value })} options={CHAPTERS.find((x) => x[0] === Number(add.chapter))[2]} /></Field>
          <Field label="Type"><Select value={add.type} onChange={(e) => setAdd({ ...add, type: e.target.value })} options={['MCQ', 'AR', 'VSA', 'SA', 'LA', 'CASE']} /></Field>
          <Field label="Difficulty"><Select value={add.difficulty} onChange={(e) => setAdd({ ...add, difficulty: e.target.value })} options={[['EASY', 'Easy'], ['INTERMEDIATE', 'Intermediate'], ['TOUGH', 'Tough']]} /></Field>
          <Field label="Question text" full><textarea className="i" style={{ fontFamily: 'inherit', fontSize: 14 }} value={add.text} onChange={(e) => setAdd({ ...add, text: e.target.value })} /></Field>
          <label className="row small"><input type="checkbox" checked={add.competency} onChange={(e) => setAdd({ ...add, competency: e.target.checked })} />Competency-based</label>
        </div>
        <p className="small muted">Questions written by teachers go to review before they can be used in papers.</p>
      </Modal>}
    </Page>
  );
}

export function PaperFormats() {
  return <Page title="Paper formats" sub="Indian board patterns the generator follows. Schools can add their own.">
    <div className="grid g2">{FORMATS.map((f) => <Card key={f.code} title={f.name} right={<span className="pill">{f.marks} marks · {f.minutes} min</span>}>
      <table className="t"><thead><tr><th>Section</th><th>Type</th><th className="num">Questions</th><th className="num">Marks each</th><th className="num">Total</th></tr></thead>
        <tbody>{f.sections.map(([s, t, n, m, attempt], i) => <tr key={i}><td>{s}</td><td>{t}</td><td className="num">{n}{attempt ? ` (attempt ${attempt})` : ''}</td><td className="num">{m}</td><td className="num">{(attempt || n) * m}</td></tr>)}</tbody></table></Card>)}</div>
  </Page>;
}

const AREAS = ['Work education', 'Art education', 'Health & physical education', 'Discipline', 'Life skills'];
export function CoScholastic() {
  const { db, mutate, notify } = useStore();
  const [sec, setSec] = useState('C8A');
  const list = db.students.filter((s) => s.sectionId === sec);
  const g = (sid, a) => db.cosch[sid + ':' + a] || '';
  return <Page title="Co-scholastic grades" sub="CBSE 3-point scale (A / B / C) per area, Term 2" actions={<button className="btn pri" onClick={() => notify('Grades saved')}>Save</button>}>
    <div className="row" style={{ marginBottom: 12 }}><Select value={sec} onChange={(e) => setSec(e.target.value)} options={db.sections.map((x) => [x.id, db.classes.find((c) => c.id === x.classId).name + '-' + x.name])} /></div>
    <div className="tw"><table className="t"><thead><tr><th>Student</th>{AREAS.map((a) => <th key={a}>{a}</th>)}</tr></thead>
      <tbody>{list.map((s) => <tr key={s.id}><td className="b">{fullName(s)}</td>{AREAS.map((a) => <td key={a}><select className="i" value={g(s.id, a)} onChange={(e) => mutate((d) => { d.cosch[s.id + ':' + a] = e.target.value; })}><option value="">—</option><option>A</option><option>B</option><option>C</option></select></td>)}</tr>)}</tbody></table></div>
  </Page>;
}

const SUBJECTS = ['English', 'Mathematics', 'Science', 'Social Science', 'Hindi'];
const BANK = ['Shows steady progress and participates actively in class discussions.', 'Works carefully and asks thoughtful questions.', 'Needs to revise regularly and complete homework on time.', 'Explains ideas clearly and helps classmates.'];
export function AssessmentProfiles() {
  const { db, run, notify, session } = useStore();
  const [sid, setSid] = useState(db.students.find((s) => s.admNo === 'ADM-2025-0231').id);
  const s = db.students.find((x) => x.id === sid);
  const existing = db.profiles[sid] || [];
  const [draft, setDraft] = useState({});
  const val = (sub) => draft[sub] ?? existing.find((c) => c.subject === sub)?.text ?? '';
  const card = renderFor(db, 'APPRECIATION_CARD', { title: 'Bravo!', message: 'For focus and care in the second-term assessments.', student_name: fullName(s), month: 'November 2026' }, session.role);
  return <Page title="Assessment profiles" sub="Narrative term report in the school's format — subject comments, an appreciation card and signatures."
    actions={<><button className="btn" onClick={() => printPage()}>Print</button><button className="btn pri" onClick={() => { run((d) => { d.profiles[sid] = SUBJECTS.map((sub) => ({ subject: sub, text: val(sub) })).filter((c) => c.text); log(d, session.role, 'Profile saved', s.admNo); }); notify('Profile saved'); }}>Save</button></>}>
    <div className="row noprint" style={{ marginBottom: 12 }}><Select value={sid} onChange={(e) => { setSid(e.target.value); setDraft({}); }} options={db.students.filter((x) => x.sectionId === 'C8A').map((x) => [x.id, fullName(x) + ' · ' + x.admNo])} /></div>
    <div className="grid g-side">
      <Card title={`${fullName(s)} · ${classLabel(db, s)} · Term 2`}>
        {SUBJECTS.map((sub) => <div key={sub} style={{ marginBottom: 12 }}><Field label={sub}><textarea className="i" style={{ fontFamily: 'inherit', fontSize: 14, minHeight: 60 }} value={val(sub)} onChange={(e) => setDraft({ ...draft, [sub]: e.target.value })} /></Field>
          <div className="row noprint">{BANK.map((b, i) => <button key={i} className="btn sm" onClick={() => setDraft({ ...draft, [sub]: (val(sub) + ' ' + b).trim() })}>+ {b.split(' ').slice(0, 3).join(' ')}…</button>)}</div></div>)}
        <div className="row" style={{ justifyContent: 'space-between', marginTop: 24 }}><span>Coordinator ________</span><span>Vice Principal ________</span></div>
      </Card>
      <Card title="Appreciation card" right={<span className="small muted">{card.template?.name}</span>}><Html html={card.body} /></Card>
    </div>
  </Page>;
}
