import { useState } from 'react';
import { useStore } from '../data/store.js';
import { Page, Card, Field, Select, Html, printPage } from '../components/ui.jsx';
import { log, fullName, classLabel, renderFor, tenantOf } from '../lib/logic.js';
import { funcOn } from '../data/menu.js';
import { BOARDS, boardOf } from '../lib/release14.js';

const AREAS = ['Work education', 'Art education', 'Health & physical education', 'Discipline', 'Life skills'];
export function CoScholastic() {
  const { db, mutate, notify } = useStore();
  const [sec, setSec] = useState('C8A');
  const list = db.students.filter((s) => s.sectionId === sec);
  const g = (sid, a) => db.cosch[sid + ':' + a] || '';
  // Board integration: the grading scale follows the school's exam board (CBSE when the add-on is off)
  const board = BOARDS[funcOn(tenantOf(db), 'FN_BOARD') ? boardOf(tenantOf(db)) : 'CBSE'];
  return <Page title="Co-scholastic grades" sub={`${board.name} scale (${board.cosch.join(' / ')}) per area, Term 2`} actions={<button className="btn pri" onClick={() => notify('Grades saved')}>Save</button>}>
    <div className="row" style={{ marginBottom: 12 }}><Select value={sec} onChange={(e) => setSec(e.target.value)} options={db.sections.map((x) => [x.id, db.classes.find((c) => c.id === x.classId).name + '-' + x.name])} /></div>
    <div className="tw"><table className="t"><thead><tr><th>Student</th>{AREAS.map((a) => <th key={a}>{a}</th>)}</tr></thead>
      <tbody>{list.map((s) => <tr key={s.id}><td className="b">{fullName(s)}</td>{AREAS.map((a) => <td key={a}><select className="i" value={g(s.id, a)} onChange={(e) => mutate((d) => { d.cosch[s.id + ':' + a] = e.target.value; })}><option value="">—</option>{board.cosch.map((x) => <option key={x}>{x}</option>)}</select></td>)}</tr>)}</tbody></table></div>
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
