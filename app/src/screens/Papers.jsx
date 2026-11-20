// Exams → Papers: Question papers (list + editor), Approved papers, Question bank, Blueprints.
// A paper is built from the topics chosen for it: change the topics and the paper is rebuilt from those topics.
import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../data/store.js';
import { Page, Card, Field, Input, Select, Modal, Pill, Stat, printPage } from '../components/ui.jsx';
import { dmon } from '../lib/format.js';
import { log } from '../lib/logic.js';
import {
  TYPES, DIFFS, diffName, MAX_SETS, CHAPTER_RULES, ruleName, chaptersOf, bankOf, topicKey, qById, classLabelOf, blueprintFor, blueprintMarks, sectionLabel,
  emptySet, newPaper, availability, fillSet, shuffleSet, setMarks, setQuestionCount, overlap, setProblems, snapshot, paperStatus, canApprove, answerFor, chaptersByRule, topicsOfChapters
} from '../lib/papers.js';

const today = () => new Date().toISOString().slice(0, 10);
const typeName = (t) => TYPES[t]?.name || t;
const upcomingExam = (db) => (db.exams.find((e) => e.from >= today()) || db.exams[db.exams.length - 1]).id;
const meOf = (db, session) => db.users.find((u) => u.id === session.userId);
const examStarted = (paper) => new Date(`${paper.date}T${paper.startTime || '09:00'}:00`) <= new Date();

// ---------------------------------------------------------------- Question papers: list
// Release 15 (QA F07): a question carries 1 to 20 whole marks
const marksOk = (m) => Number.isInteger(Number(m)) && Number(m) >= 1 && Number(m) <= 20;

export function QuestionPapers() {
  const { db, run, notify, session } = useStore();
  const [examId, setExamId] = useState(() => upcomingExam(db));
  const [open, setOpen] = useState(() => { try { return sessionStorage.getItem('qp-open'); } catch (e) { return null; } });
  const go = (id) => { setOpen(id); try { id ? sessionStorage.setItem('qp-open', id) : sessionStorage.removeItem('qp-open'); } catch (e) { /* ignore */ } };
  if (open && db.qpapers.some((p) => p.id === open)) return <PaperEditor id={open} back={() => go(null)} />;
  const exam = db.exams.find((e) => e.id === examId);
  const rows = db.examSchedule.filter((s) => s.examId === examId).sort((a, b) => a.grade - b.grade || a.subject.localeCompare(b.subject));
  const start = (entry) => {
    try {
      const p = run((d) => { const x = newPaper(d, { exam, entry, by: session.name }); const bp = d.blueprints.find((b) => b.id === x.blueprintId); fillSet(d, x, bp, 0); snapshot(x, 'Started', session.name); d.qpapers.push(x); log(d, session.name, 'Question paper started', `${exam.name} · ${classLabelOf(entry.grade)} ${entry.subject}`); return x; });
      notify('Paper started from the chapters this exam covers — change the topics to rebuild it'); go(p.id);
    } catch (e) { notify(e.message); }
  };
  return <Page title="Question papers" sub="Build each exam paper from the question bank, from the topics you choose. Send each set for approval, choose the set for the exam and print it. Papers stay confidential.">
    <div className="row" style={{ marginBottom: 12 }}><Field label="Exam"><Select value={examId} onChange={(e) => setExamId(e.target.value)} options={db.exams.map((e) => [e.id, e.name])} aria-label="Exam" /></Field></div>
    <div className="tw" style={{ maxHeight: 'none' }}><table className="t"><thead><tr><th>Class</th><th>Subject</th><th>Date</th><th>Marks</th><th>Question paper</th><th /></tr></thead>
      <tbody>{rows.map((r) => {
        const paper = db.qpapers.find((p) => p.examId === examId && p.grade === r.grade && p.subject === r.subject);
        const bp = paper ? db.blueprints.find((b) => b.id === paper.blueprintId) : blueprintFor(db, exam, r.grade, r.subject);
        const hasBank = chaptersOf(db, r.grade, r.subject).length > 0;
        const st = paperStatus(paper);
        return <tr key={r.grade + r.subject}>
          <td>{classLabelOf(r.grade)}</td><td>{r.subject}</td><td>{dmon(r.date)}</td>
          <td>{paper ? setMarks(db, paper.sets[0]) : '—'} / {bp ? blueprintMarks(bp) : '—'}</td>
          <td><Pill kind={st.kind}>{st.label}</Pill>{st.sub && <div className="small muted">{st.sub}</div>}</td>
          <td>{paper ? <button className="btn sm" aria-label={`Open ${classLabelOf(r.grade)} ${r.subject}`} onClick={() => go(paper.id)}>Open</button>
            : !hasBank ? <span className="small muted">No question bank yet</span>
              : !bp ? <span className="small muted">No blueprint fits</span>
                : <button className="btn sm pri" aria-label={`Start ${classLabelOf(r.grade)} ${r.subject}`} onClick={() => start(r)}>Start</button>}</td>
        </tr>; })}</tbody></table></div>
  </Page>;
}

// ---------------------------------------------------------------- Question papers: editor
function PaperEditor({ id, back }) {
  const { db, run, mutate, notify, session, readOnly, screenLock } = useStore();
  const paper = db.qpapers.find((p) => p.id === id);
  const exam = db.exams.find((e) => e.id === paper.examId);
  const bp = db.blueprints.find((b) => b.id === paper.blueprintId);
  const chapters = chaptersOf(db, paper.grade, paper.subject);
  const me = meOf(db, session);
  const who = session.name || session.role;
  const approver = canApprove(me, session.role);
  const [si, setSi] = useState(0);
  const [openCh, setOpenCh] = useState({});
  const [picker, setPicker] = useState(null);       // { slot, section, mode: 'replace' | 'add' | 'or' }
  const [edit, setEdit] = useState(null);            // { slot, text, marks }
  const [write, setWrite] = useState(null);          // a new question for a section
  const [confirm, setConfirm] = useState(null);      // a status change
  const [showHist, setShowHist] = useState(false);
  const [printing, setPrinting] = useState(null);    // { mode, set }
  const set = paper.sets[Math.min(si, paper.sets.length - 1)];
  const editable = set.status === 'Draft' || set.status === 'Sent back';
  const avail = useMemo(() => availability(db, paper, bp), [db.questions, paper.topics, bp]);
  const problems = setProblems(db, set, bp);
  const started = examStarted(paper);

  // Who has seen this confidential paper (once a day per person)
  useEffect(() => { if (readOnly || screenLock) return; const d0 = today();
    if (!(paper.views || []).some((v) => v.who === who && v.at.slice(0, 10) === d0)) mutate((d) => { const p = d.qpapers.find((x) => x.id === id); p.views = [{ who, at: new Date().toISOString() }, ...(p.views || [])].slice(0, 50); }); }, [id]);

  // Every change: keep the version before it (for Undo and Version history)
  const change = (label, fn, msg) => { try { run((d) => { const p = d.qpapers.find((x) => x.id === id); snapshot(p, label, who); fn(p, d); }); if (msg) notify(msg); } catch (e) { if (!/Read only|Preview only/.test(e.message)) notify(e.message); } };
  const refillDrafts = (p, d, { onlyCurrent = false } = {}) => { let short = [];
    p.sets.forEach((s, i) => { if ((s.status === 'Draft' || s.status === 'Sent back') && (!onlyCurrent || i === si)) short = [...short, ...fillSet(d, p, d.blueprints.find((b) => b.id === p.blueprintId), i)]; });
    return [...new Set(short)]; };

  // Topics: the paper is rebuilt from the chosen topics when "Update automatically" is on
  const setTopics = (topics, label) => change(label, (p, d) => { p.topics = topics; if (p.auto) { const s = refillDrafts(p, d); if (s.length) notify('Not enough questions in the chosen topics for ' + s.join(', ')); } },
    paper.auto ? 'Paper rebuilt from the chosen topics' : 'Topics saved — press Generate to rebuild the paper');
  const toggleTopic = (k) => setTopics(paper.topics.includes(k) ? paper.topics.filter((x) => x !== k) : [...paper.topics, k], 'Topics changed');
  const chState = (c) => { const ks = c.topics.map((t) => topicKey(c.no, t)); const n = ks.filter((k) => paper.topics.includes(k)).length; return n === 0 ? 'none' : n === ks.length ? 'all' : 'some'; };
  const toggleChapter = (c) => { const ks = c.topics.map((t) => topicKey(c.no, t)); setTopics(chState(c) === 'all' ? paper.topics.filter((k) => !ks.includes(k)) : [...new Set([...paper.topics, ...ks])], 'Chapter ' + (chState(c) === 'all' ? 'removed' : 'added')); };
  const countIn = (c, t) => bankOf(db, paper.grade, paper.subject).filter((q) => q.chapter === c.no && (!t || q.topic === t)).length;

  const slotIdx = (k) => set.slots.indexOf(k);
  const onSet = (fn) => (p, d) => fn(p.sets[si], p, d);
  const move = (i, dir) => { const j = i + dir; if (j < 0 || j >= set.slots.length || set.slots[j].section !== set.slots[i].section) return; change('Moved a question', onSet((s) => { [s.slots[i], s.slots[j]] = [s.slots[j], s.slots[i]]; })); };
  const replaceAuto = (i) => change('Replaced a question', onSet((s, p, d) => { const old = [s.slots[i].qid, s.slots[i].orQid].filter(Boolean); const hadOr = !!s.slots[i].orQid;
    s.slots[i] = { ...s.slots[i], qid: null, orQid: null, edit: null, locked: false };
    const short = fillSet(d, p, d.blueprints.find((b) => b.id === p.blueprintId), si, { onlyEmpty: true, avoid: old });
    if (!s.slots[i].qid) { s.slots[i].qid = old[0]; if (hadOr) s.slots[i].orQid = old[1] || null; throw new Error('No other question in the chosen topics fits this slot — choose more topics'); }
    if (short.length) { /* other empty slots stayed empty */ } }), 'Replaced from the chosen topics');
  const clearSlot = (i) => change('Removed a question', onSet((s) => { const sec = s.slots[i].section; const inSec = s.slots.filter((x) => x.section === sec).length;
    if (inSec > bp.sections[sec].count) s.slots.splice(i, 1); else s.slots[i] = { section: sec, qid: null, orQid: null, locked: false, edit: null }; }));
  const fillEmpty = () => change('Filled empty slots', (p, d) => fillSet(d, p, bp, si, { onlyEmpty: true }), 'Empty slots filled from the chosen topics');
  const generate = () => change(setQuestionCount(set) ? 'Regenerated' : 'Generated', (p, d) => { const s = fillSet(d, p, bp, si); if (s.length) setTimeout(() => notify('Not enough questions in the chosen topics for ' + s.join(', ')), 0); },
    `Set ${set.no} ${setQuestionCount(set) ? 'regenerated' : 'generated'} from ${paper.topics.length} topics`);
  const addSets = (k) => change(k > 1 ? 'Made sets' : 'Added a set', (p, d) => { for (let n = 0; n < k && p.sets.length < MAX_SETS; n++) { p.sets.push(emptySet(bp, p.sets.length + 1)); fillSet(d, p, bp, p.sets.length - 1); } },
    k > 1 ? `Now ${Math.min(MAX_SETS, paper.sets.length + k)} sets — each avoids the questions of the others where the topics allow` : 'Set added');
  const removeSet = () => { change('Removed a set', (p) => { p.sets.splice(si, 1); p.sets.forEach((s, i) => { s.no = i + 1; }); if (p.chosenSet > p.sets.length) p.chosenSet = null; }); setSi(Math.max(0, si - 1)); };
  const undo = () => { if (!paper.versions?.length) { notify('Nothing to undo'); return; }
    run((d) => { const p = d.qpapers.find((x) => x.id === id); const [v, ...rest] = p.versions; p.sets = v.sets; p.topics = v.topics; p.versions = rest; }); notify('Undone: ' + paper.versions[0].label.toLowerCase()); };
  const restore = (v) => { change('Restored an earlier version', (p) => { p.sets = structuredClone(v.sets); p.topics = [...v.topics]; }, 'Earlier version restored'); setShowHist(false); };

  // Approval for each set
  const status = (to, note = '') => change('Status: ' + to, onSet((s, p) => { s.status = to; s.note = note;
    if (to === 'Submitted') s.submittedBy = who; if (to === 'Approved' || to === 'Sent back') s.decidedBy = who; if (to !== 'Approved' && p.chosenSet === s.no) p.chosenSet = null; }),
    { Submitted: `Set ${set.no} sent for approval`, Approved: `Set ${set.no} approved`, 'Sent back': `Set ${set.no} sent back`, Draft: `Set ${set.no} is a draft again` }[to]);
  const askStatus = (to) => {
    if (to === 'Submitted' && problems.length) { notify('Fix first: ' + problems[0]); return; }
    if (to === 'Approved' && set.submittedBy === who && session.role !== 'ADMIN') { notify('Someone other than the person who sent it must approve it'); return; }
    setConfirm({ to, note: '' });
  };
  const choose = (no) => change('Chose the set for the exam', (p) => { p.chosenSet = no; }, no ? `Set ${no} is the set for the exam` : 'No set chosen');

  if (printing) return <PaperPrint paper={paper} setIdx={printing.set} mode={printing.mode} back={() => setPrinting(null)} />;
  const st = paperStatus(paper);
  const secRows = (sec) => set.slots.map((x, i) => [x, i]).filter(([x]) => x.section === sec);
  let num = 0;
  return <Page title={`${exam.name} — ${paper.subject}`} sub={`${classLabelOf(paper.grade)} · ${paper.subject} · ${exam.name} · CBSE · ${dmon(paper.date)}`}
    actions={<><button className="btn" onClick={back}>← Question papers</button><Pill kind={st.kind}>{st.label}</Pill></>}>
    <div className="grid qp-grid" style={{ alignItems: 'start' }}>
      <div>
        <Card title="1. Topics for this paper" right={<span className="small muted">{paper.topics.length} topics</span>}>
          <div className="form" style={{ gridTemplateColumns: '1fr' }}>
            <Field label="Blueprint"><Select aria-label="Blueprint" value={paper.blueprintId} disabled={!editable} onChange={(e) => change('Changed blueprint', (p, d) => { const nb = d.blueprints.find((b) => b.id === e.target.value); p.blueprintId = nb.id;
              p.sets.forEach((s, i) => { if (s.status === 'Draft' || s.status === 'Sent back') { p.sets[i] = { ...emptySet(nb, s.no) }; fillSet(d, p, nb, i); } }); }, 'Blueprint changed — draft sets rebuilt')}
              options={db.blueprints.filter((b) => !b.archived && paper.grade >= b.fromGrade && paper.grade <= b.toGrade).map((b) => [b.id, `${b.name} · ${blueprintMarks(b)} marks`])} /></Field>
            <Field label="Start from"><Select aria-label="Start from" value="" onChange={(e) => e.target.value && setTopics(topicsOfChapters(chapters, chaptersByRule(chapters, e.target.value)), 'Chose ' + ruleName(e.target.value))}
              options={[['', 'Pick a part of the syllabus…'], ...CHAPTER_RULES.filter((r) => r[0] !== 'CHOSEN')]} /></Field>
          </div>
          <label className="small" style={{ margin: '8px 0', display: 'flex', gap: 8, alignItems: 'flex-start' }}><input type="checkbox" style={{ marginTop: 3 }} checked={!!paper.auto} onChange={(e) => change('Auto update ' + (e.target.checked ? 'on' : 'off'), (p) => { p.auto = e.target.checked; })} />
            Update the paper automatically when topics change (locked questions stay)</label>
          <div className="topic-list" role="tree" aria-label="Chapters and topics">{chapters.map((c) => { const s = chState(c);
            return <div key={c.no} role="treeitem" aria-expanded={!!openCh[c.no]}>
              <div className="row topic-ch">
                <button className="tree-tg" aria-label={(openCh[c.no] ? 'Hide topics of ' : 'Show topics of ') + c.name} onClick={() => setOpenCh({ ...openCh, [c.no]: !openCh[c.no] })}>{openCh[c.no] ? '▾' : '▸'}</button>
                <button className={'chip' + (s === 'all' ? ' on' : s === 'some' ? ' part' : '')} aria-pressed={s === 'all' ? 'true' : s === 'some' ? 'mixed' : 'false'} onClick={() => toggleChapter(c)}>{c.no}. {c.name} <span className="muted">T{c.term}</span></button>
                <span className="small muted" style={{ marginLeft: 'auto' }}>{countIn(c)} q</span></div>
              {openCh[c.no] && c.topics.map((t) => <label key={t} className="row small topic-row"><input type="checkbox" aria-label={`Topic ${t}`} checked={paper.topics.includes(topicKey(c.no, t))} onChange={() => toggleTopic(topicKey(c.no, t))} />{t}<span className="muted" style={{ marginLeft: 'auto' }}>{countIn(c, t)}</span></label>)}
            </div>; })}</div>
          <h3 style={{ margin: '14px 0 6px' }}>Difficulty mix</h3>
          <div className="row small" style={{ gap: 12, flexWrap: 'wrap' }}>{DIFFS.map(([d, name], k) => <label key={d} className="row">{name}
            <Input type="number" min="0" max="100" step="5" style={{ width: 70 }} aria-label={name + ' %'} value={paper.mix[k]} onChange={(e) => { const mix = [...paper.mix]; mix[k] = Math.max(0, Math.min(100, Number(e.target.value) || 0)); const rest = 100 - mix[k]; const o = [0, 1, 2].filter((x) => x !== k); const tot = paper.mix[o[0]] + paper.mix[o[1]] || 1;
              mix[o[0]] = Math.round(rest * paper.mix[o[0]] / tot); mix[o[1]] = rest - mix[o[0]]; change('Changed difficulty mix', (p, d2) => { p.mix = mix; if (p.auto) refillDrafts(p, d2); }); }} />%</label>)}</div>
          <h3 style={{ margin: '14px 0 6px' }}>What the chosen topics hold</h3>
          <table className="t small" aria-label="Questions available for each section"><thead><tr><th>Section</th><th>Needs</th><th>In topics</th><th>Easy / Med / Hard</th></tr></thead>
            <tbody>{bp.sections.map((s, i) => <tr key={i}><td>{sectionLabel(bp, i)} <span className="muted">{s.types.map(typeName).join(', ')} · {s.marks} mark{s.marks > 1 ? 's' : ''}</span></td><td>{avail[i].need}</td>
              <td>{avail[i].short ? <Pill kind="bad">{avail[i].available} — {avail[i].short} short</Pill> : avail[i].available}</td><td>{avail[i].byDiff.join(' / ')}</td></tr>)}</tbody></table>
          {avail.some((a) => a.short) && <p className="small" style={{ color: 'var(--bad, #B42318)' }}>Choose more topics, or add questions to the bank, for the sections that are short.</p>}
        </Card>
        <div style={{ height: 14 }} />
        <Card title="Choose the set for the exam">
          <p className="small">The paper starts at {paper.startTime || '09:00'} on {dmon(paper.date)}. The choice can be made or changed until then.</p>
          {paper.sets.filter((s) => s.status === 'Approved').length === 0 ? <p className="small muted">No set is approved yet. Only an approved set can be given in the exam.</p>
            : <div role="radiogroup" aria-label="Set for the exam">{paper.sets.filter((s) => s.status === 'Approved').map((s) => <label key={s.no} className="row small"><input type="radio" name="chosen" disabled={started || !approver} checked={paper.chosenSet === s.no} onChange={() => choose(s.no)} />Set {s.no}{paper.chosenSet === s.no ? ' — chosen' : ''}</label>)}</div>}
          {paper.chosenSet && <p className="small">Set {paper.chosenSet} is the set for the exam. The other sets are sealed.</p>}
          <div className="row" style={{ marginTop: 8 }}><Field label="The paper starts at"><Input type="time" value={paper.startTime || '09:00'} disabled={started} onChange={(e) => change('Changed start time', (p) => { p.startTime = e.target.value; })} /></Field></div>
          {!approver && <p className="small muted">The Principal or a senior teacher chooses the set.</p>}
        </Card>
        <div style={{ height: 14 }} />
        <Card title="Viewed by"><p className="small muted">Papers are confidential: everyone who opens this one is listed.</p>
          {(paper.views || []).slice(0, 8).map((v, i) => <div key={i} className="small">{v.who} · {new Date(v.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</div>)}</Card>
      </div>

      <div>
        <Card title="2. Sets" right={<span className="small muted">Set {set.no} · {paper.sets.length} of up to {MAX_SETS} sets</span>}>
          <div className="tabs" role="tablist" aria-label="Sets">{paper.sets.map((s, i) => <button key={s.no} role="tab" aria-selected={i === si} className={i === si ? 'on' : ''} onClick={() => setSi(i)}>Set {s.no} <span className="small muted">{s.status === 'Draft' ? '' : '· ' + s.status}</span></button>)}</div>
          <div className="row small" style={{ gap: 6, flexWrap: 'wrap', margin: '8px 0' }}>{paper.sets.map((s, i) => <span key={s.no} className="pill">Set {s.no} · {overlap(paper, i)}% overlap</span>)}</div>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <button className="btn sm" disabled={paper.sets.length >= MAX_SETS} onClick={() => addSets(1)}>Add a set</button>
            <button className="btn sm" disabled={paper.sets.length >= MAX_SETS} onClick={() => addSets(MAX_SETS - paper.sets.length)}>Make {MAX_SETS} sets</button>
            {paper.sets.length > 1 && editable && <button className="btn sm" onClick={removeSet}>Remove set {set.no}</button>}
          </div>
        </Card>
        <div style={{ height: 14 }} />
        <Card title={`3. Set ${set.no}`} right={<Pill kind={{ Approved: 'ok', Submitted: 'warn', 'Sent back': 'bad' }[set.status] || 'info'}>{set.status}</Pill>}>
          <div className="grid g3" style={{ marginBottom: 10 }}>
            <Stat label="Marks" value={`${setMarks(db, set)} / ${blueprintMarks(bp)}`} sub={`${setQuestionCount(set)} questions`} />
            <Stat label="Time" value={`${bp.minutes} min`} sub={bp.name} />
            <Stat label="Overlap with other sets" value={overlap(paper, si) + '%'} />
          </div>
          {problems.length ? <div className="note warn" role="status">{problems.map((p, i) => <div key={i}>{p}</div>)}</div> : <div className="note ok" role="status">The paper matches its blueprint.</div>}
          {set.note && <p className="small"><b>Note:</b> {set.note}</p>}
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', margin: '10px 0' }}>
            <button className="btn pri" disabled={!editable} onClick={generate}>{setQuestionCount(set) ? 'Regenerate' : 'Generate'}</button>
            <button className="btn" disabled={!editable || !set.slots.some((x) => !x.qid)} onClick={fillEmpty}>Fill empty slots</button>
            <button className="btn" disabled={!editable} onClick={() => change('Shuffled', onSet((s) => shuffleSet(s)), 'Questions shuffled within each section')}>Shuffle the paper</button>
            <button className="btn" disabled={!paper.versions?.length} onClick={undo}>Undo</button>
            <button className="btn" onClick={() => setShowHist(true)}>Version history</button>
          </div>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            {editable && <button className="btn pri" onClick={() => askStatus('Submitted')}>Send for approval</button>}
            {set.status === 'Submitted' && approver && <><button className="btn pri" onClick={() => askStatus('Approved')}>Approve</button><button className="btn" onClick={() => askStatus('Sent back')}>Send back</button></>}
            {set.status === 'Submitted' && set.submittedBy === who && <button className="btn" onClick={() => askStatus('Draft')}>Take back</button>}
            {set.status === 'Approved' && approver && !started && <button className="btn" onClick={() => askStatus('Draft')}>Reopen as draft</button>}
            <span className="sp" />
            <button className="btn" onClick={() => setPrinting({ mode: 'paper', set: si })}>Print the paper</button>
            <button className="btn" onClick={() => setPrinting({ mode: 'key', set: si })}>Answer key</button>
            <button className="btn" onClick={() => setPrinting({ mode: 'teacher', set: si })}>Teacher's copy</button>
          </div>
          {!editable && <p className="small muted">{set.status === 'Approved' ? 'Approved sets are locked.' : 'Sent for approval — locked until it is approved or sent back.'}</p>}
        </Card>
        <div style={{ height: 14 }} />
        {bp.sections.map((s, sec) => { const rows = secRows(sec); const filled = rows.filter(([x]) => x.qid).length; const withOr = rows.filter(([x]) => x.orQid).length;
          return <Card key={sec} title={sectionLabel(bp, sec)} right={<span className="small muted">{filled} of {s.count} · {s.count} × {s.marks} = {s.count * s.marks} marks{withOr ? ` · ${withOr} with internal choice` : ''}</span>}>
            <div className="small muted" style={{ marginBottom: 6 }}>{s.types.map(typeName).join(', ')}</div>
            {rows.map(([x, i]) => { const q = qById(db, x.qid); const oq = qById(db, x.orQid); num += 1; const n = num;
              if (!q) return <div key={i} className="slot empty"><span>{n}.</span><span className="muted" style={{ flex: 1 }}>No question for this slot.</span>
                {editable && <><button className="btn sm" aria-label={`Pick from the bank for ${sectionLabel(bp, sec)}, slot ${n}`} onClick={() => setPicker({ slot: i, section: sec, mode: 'replace' })}>Pick from the bank</button><button className="btn sm" onClick={fillEmpty}>Fill automatically</button></>}</div>;
              return <div key={i} className={'slot' + (x.locked ? ' locked' : '')}>
                <div className="row" style={{ alignItems: 'flex-start' }}>
                  <span className="b" style={{ width: 28 }}>{n}.</span>
                  <div style={{ flex: 1 }}>{x.edit?.text || q.text} <span className="muted">[{x.edit?.marks || q.marks}]</span>
                    <div className="small muted">{typeName(q.type)} · {diffName(q.difficulty)} · ch. {q.chapter} · {q.topic}{x.edit ? ' · edited for this paper' : ''}{x.locked ? ' · locked' : ''}</div>
                    {oq && <div className="or"><b>OR</b> {oq.text} <span className="muted">[{oq.marks}]</span><div className="small muted">{typeName(oq.type)} · {diffName(oq.difficulty)} · ch. {oq.chapter} · {oq.topic}</div></div>}</div>
                </div>
                {editable && <div className="row slot-acts">
                  <button className="btn sm" aria-label={`Move question ${n} up`} onClick={() => move(i, -1)}>↑</button>
                  <button className="btn sm" aria-label={`Move question ${n} down`} onClick={() => move(i, 1)}>↓</button>
                  <button className="btn sm" aria-label={`Replace question ${n}`} onClick={() => replaceAuto(i)}>Replace</button>
                  <button className="btn sm" aria-label={`Replace question ${n} from the bank`} onClick={() => setPicker({ slot: i, section: sec, mode: 'replace' })}>From the bank</button>
                  {oq ? <button className="btn sm" aria-label={`Remove OR of question ${n}`} onClick={() => change('Removed OR', onSet((s2) => { s2.slots[i].orQid = null; }))}>Remove OR</button>
                    : <button className="btn sm" aria-label={`Add OR to question ${n}`} onClick={() => setPicker({ slot: i, section: sec, mode: 'or' })}>Add OR</button>}
                  <button className="btn sm" aria-label={`Edit question ${n} for this paper`} onClick={() => setEdit({ slot: i, text: x.edit?.text || q.text, marks: x.edit?.marks || q.marks })}>Edit</button>
                  <button className="btn sm" aria-pressed={x.locked} aria-label={`${x.locked ? 'Unlock' : 'Lock'} question ${n}`} onClick={() => change(x.locked ? 'Unlocked' : 'Locked', onSet((s2) => { s2.slots[i].locked = !s2.slots[i].locked; }))}>{x.locked ? 'Unlock' : 'Lock'}</button>
                  <button className="btn sm danger" aria-label={`Remove question ${n}`} onClick={() => clearSlot(i)}>Remove</button></div>}
              </div>; })}
            {editable && <div className="row" style={{ gap: 6, marginTop: 6 }}>
              <button className="btn sm" aria-label={`Add from the bank to ${sectionLabel(bp, sec)}`} onClick={() => setPicker({ slot: null, section: sec, mode: 'add' })}>Add from the bank</button>
              <button className="btn sm" aria-label={`Write a new question in ${sectionLabel(bp, sec)}`} onClick={() => setWrite({ section: sec, type: s.types[0], difficulty: 'INTERMEDIATE', topic: paper.topics[0] || '', text: '', answer: '' })}>Write a new question</button></div>}
          </Card>; })}
      </div>
    </div>

    {picker && <BankPicker paper={paper} bp={bp} set={set} picker={picker} onClose={() => setPicker(null)} onPick={(q) => {
      change(picker.mode === 'or' ? 'Added OR' : picker.mode === 'add' ? 'Added a question' : 'Replaced from the bank', onSet((s) => {
        if (picker.mode === 'or') s.slots[picker.slot].orQid = q.id;
        else if (picker.mode === 'add') { const last = s.slots.map((x, k) => [x, k]).filter(([x]) => x.section === picker.section).pop(); s.slots.splice((last ? last[1] : s.slots.length - 1) + 1, 0, { section: picker.section, qid: q.id, orQid: null, locked: true, edit: null }); }
        else s.slots[picker.slot] = { ...s.slots[picker.slot], qid: q.id, edit: null, locked: true };
      }), 'Question added — it is locked so regenerating keeps it'); setPicker(null); }} />}
    {edit && <Modal title="Edit for this paper" onClose={() => setEdit(null)} actions={<button className="btn pri" disabled={edit.text.trim().length < 5 || !marksOk(edit.marks)} onClick={() => { change('Edited a question', onSet((s) => { s.slots[edit.slot].edit = { text: edit.text.trim(), marks: Number(edit.marks) }; s.slots[edit.slot].locked = true; }), 'Changed on this paper only — the bank keeps the original'); setEdit(null); }}>Save</button>}>
      <Field label="Question" full><textarea className="i" rows={4} value={edit.text} onChange={(e) => setEdit({ ...edit, text: e.target.value })} /></Field>
      <Field label="Marks"><Input type="number" min="1" max="20" value={edit.marks} onChange={(e) => setEdit({ ...edit, marks: e.target.value })} /></Field>
      <p className="small muted">The change is only on this paper. The question bank keeps the original.</p>
    </Modal>}
    {write && <Modal title={`Write a new question in ${sectionLabel(bp, write.section)}`} onClose={() => setWrite(null)} actions={<button className="btn pri" disabled={write.text.trim().length < 10 || !write.topic} onClick={() => {
      change('Wrote a new question', (p, d) => { const [ch, topic] = write.topic.split('|'); const c = chapters.find((x) => x.no === Number(ch)); const q = { id: 'Q' + (d.questions.length + 1) + '-' + Date.now().toString(36), board: 'CBSE', grade: p.grade, subject: p.subject, chapter: c.no, topic, term: c.term,
        type: write.type, marks: bp.sections[write.section].marks, difficulty: write.difficulty, competency: false, text: write.text.trim(), answer: write.answer.trim() || null, options: null, source: 'Written for a paper', status: 'Approved', used: 0 };
        d.questions.push(q); const s = p.sets[si]; const last = s.slots.map((x, k) => [x, k]).filter(([x]) => x.section === write.section).pop(); const empty = s.slots.findIndex((x) => x.section === write.section && !x.qid);
        if (empty >= 0) s.slots[empty] = { ...s.slots[empty], qid: q.id, locked: true }; else s.slots.splice(last[1] + 1, 0, { section: write.section, qid: q.id, orQid: null, locked: true, edit: null }); }, 'Question written, added to the paper and saved in the bank'); setWrite(null); }}>Add to the paper</button>}>
      <div className="form" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <Field label="Topic"><Select value={write.topic} onChange={(e) => setWrite({ ...write, topic: e.target.value })} options={paper.topics.map((k) => [k, `ch. ${k.split('|')[0]} · ${k.split('|')[1]}`])} /></Field>
        <Field label="Type"><Select value={write.type} onChange={(e) => setWrite({ ...write, type: e.target.value })} options={bp.sections[write.section].types.map((t) => [t, typeName(t)])} /></Field>
        <Field label="Difficulty"><Select value={write.difficulty} onChange={(e) => setWrite({ ...write, difficulty: e.target.value })} options={DIFFS} /></Field>
        <Field label="Marks"><Input value={bp.sections[write.section].marks} disabled /></Field>
        <Field label="Question" full><textarea className="i" rows={3} value={write.text} onChange={(e) => setWrite({ ...write, text: e.target.value })} /></Field>
        <Field label="Answer (for the answer key)" full><Input value={write.answer} onChange={(e) => setWrite({ ...write, answer: e.target.value })} /></Field>
      </div>
    </Modal>}
    {confirm && <Modal title={{ Submitted: 'Send for approval?', Approved: 'Approve this set?', 'Sent back': 'Send this set back?', Draft: 'Make this set a draft again?' }[confirm.to]} onClose={() => setConfirm(null)}
      actions={<><button className="btn" onClick={() => setConfirm(null)}>Cancel</button><button className="btn pri" disabled={confirm.to === 'Sent back' && confirm.note.trim().length < 3} onClick={() => { status(confirm.to, confirm.note.trim()); setConfirm(null); }}>Confirm</button></>}>
      <p>{{ Submitted: `Set ${set.no} is locked while it waits for approval.`, Approved: `Set ${set.no} will be locked and can be chosen for the exam.`, 'Sent back': 'The teacher sees your note and can change the set.', Draft: `Set ${set.no} can be changed again and must be approved again.` }[confirm.to]}</p>
      {(confirm.to === 'Sent back' || confirm.to === 'Approved') && <Field label={confirm.to === 'Sent back' ? 'What needs changing' : 'Note (optional)'} full><Input value={confirm.note} onChange={(e) => setConfirm({ ...confirm, note: e.target.value })} /></Field>}
    </Modal>}
    {showHist && <Modal title="Version history" onClose={() => setShowHist(false)}>
      {(paper.versions || []).length === 0 ? <p className="muted">No earlier versions.</p> : paper.versions.map((v, i) => <div key={i} className="row" style={{ justifyContent: 'space-between', borderBottom: '1px solid var(--line)', padding: '6px 0' }}>
        <div><b className="small">Before: {v.label}</b><div className="small muted">{v.by} · {new Date(v.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })} · {v.sets.length} set{v.sets.length > 1 ? 's' : ''} · {v.topics.length} topics</div></div>
        <button className="btn sm" onClick={() => restore(v)}>Restore</button></div>)}
    </Modal>}
  </Page>;
}

// Pick a question from the bank for a section (filters: chapter, type, difficulty, search)
function BankPicker({ paper, bp, set, picker, onClose, onPick }) {
  const { db } = useStore();
  const sec = bp.sections[picker.section];
  const [f, setF] = useState({ scope: 'TOPICS', chapter: '', type: '', diff: '', q: '' });
  const chapters = chaptersOf(db, paper.grade, paper.subject);
  const onThis = new Set(set.slots.flatMap((x) => [x.qid, x.orQid]).filter(Boolean));
  const onOthers = new Set(paper.sets.filter((s) => s !== set).flatMap((s) => s.slots.flatMap((x) => [x.qid, x.orQid])).filter(Boolean));
  const list = bankOf(db, paper.grade, paper.subject).filter((q) => sec.types.includes(q.type) && q.marks === sec.marks && !onThis.has(q.id)
    && (f.scope === 'ALL' || paper.topics.includes(topicKey(q.chapter, q.topic))) && (!f.chapter || q.chapter === Number(f.chapter)) && (!f.type || q.type === f.type)
    && (!f.diff || q.difficulty === f.diff) && (!f.q || q.text.toLowerCase().includes(f.q.toLowerCase())));
  return <Modal title={picker.mode === 'or' ? 'Pick the OR question' : 'Add a question from the bank'} onClose={onClose}>
    <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
      <Select aria-label="Scope" value={f.scope} onChange={(e) => setF({ ...f, scope: e.target.value })} options={[['TOPICS', 'Chosen topics'], ['ALL', 'Whole bank']]} />
      <Select aria-label="Chapter" value={f.chapter} onChange={(e) => setF({ ...f, chapter: e.target.value })} options={[['', 'All chapters'], ...chapters.map((c) => [c.no, `${c.no}. ${c.name}`])]} />
      <Select aria-label="Type" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} options={[['', 'All types'], ...sec.types.map((t) => [t, typeName(t)])]} />
      <Select aria-label="Difficulty" value={f.diff} onChange={(e) => setF({ ...f, diff: e.target.value })} options={[['', 'Any difficulty'], ...DIFFS]} />
      <Input aria-label="Search" placeholder="Search" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} style={{ maxWidth: 200 }} />
    </div>
    <p className="small muted">{list.length} questions · {sec.marks} mark{sec.marks > 1 ? 's' : ''} each</p>
    <div style={{ maxHeight: 380, overflow: 'auto' }}>{list.slice(0, 80).map((q) => <div key={q.id} className="row" style={{ justifyContent: 'space-between', borderBottom: '1px solid var(--line)', padding: '6px 0', alignItems: 'flex-start' }}>
      <div style={{ flex: 1 }}><span>[{q.marks}] {q.text}</span><div className="small muted">{typeName(q.type)} · {diffName(q.difficulty)} · ch. {q.chapter} · {q.topic}
        {onOthers.has(q.id) && <span className="pill" style={{ marginLeft: 6 }}>On another set</span>}{q.used > 0 && <span className="pill" style={{ marginLeft: 6 }}>Used before</span>}</div></div>
      <button className="btn sm" aria-label={'Add ' + q.text.slice(0, 40)} onClick={() => onPick(q)}>Add</button></div>)}</div>
  </Modal>;
}

// Print views: the paper, the answer key, or the teacher's copy (paper + topic, difficulty and answer for each question)
function PaperPrint({ paper, setIdx, mode, back }) {
  const { db, mutate, readOnly, screenLock, session } = useStore();
  const exam = db.exams.find((e) => e.id === paper.examId);
  const bp = db.blueprints.find((b) => b.id === paper.blueprintId);
  const set = paper.sets[setIdx];
  const school = db.tenants?.[0]?.name || 'School';
  const title = { paper: 'Question paper', key: 'Answer key', teacher: "Teacher's copy" }[mode];
  const doPrint = () => { if (!readOnly && !screenLock) mutate((d) => log(d, session.name, title + ' printed', `${exam.name} · ${classLabelOf(paper.grade)} ${paper.subject} · Set ${set.no}`)); printPage(); };
  let n = 0;
  return <Page title={`${title} — Set ${set.no}`} sub={`${exam.name} · ${classLabelOf(paper.grade)} · ${paper.subject}`}
    actions={<><button className="btn" onClick={back}>← Back</button><button className="btn pri" onClick={doPrint}>Print</button></>}>
    <div className="paper">
      <div style={{ textAlign: 'center' }}><b style={{ fontSize: 18 }}>{school}</b><br />{exam.name} · {classLabelOf(paper.grade)} · {paper.subject} · Set {set.no}<br />
        Time: {bp.minutes} minutes · Maximum marks: {blueprintMarks(bp)}{mode !== 'paper' && <><br /><b>{title.toUpperCase()} — CONFIDENTIAL</b></>}</div>
      {mode === 'paper' && <><p><b>General instructions:</b></p><ol style={{ marginTop: 0 }}>{bp.instructions.map((x, i) => <li key={i}>{x}</li>)}</ol></>}
      {bp.sections.map((s, sec) => <div key={sec}><div className="sec">{sectionLabel(bp, sec).toUpperCase()} <span style={{ fontWeight: 400 }}>({s.count} × {s.marks} = {s.count * s.marks} marks)</span></div>
        {set.slots.filter((x) => x.section === sec && x.qid).map((x, k) => { const q = qById(db, x.qid); const oq = qById(db, x.orQid); n += 1;
          return <div key={k} style={{ margin: '6px 0' }}>
            <div style={{ display: 'flex', gap: 8 }}><span style={{ width: 26 }}>{n}.</span><span style={{ flex: 1 }}>{mode === 'key' ? <b>{answerFor(q)}</b> : (x.edit?.text || q.text)}
              {mode === 'teacher' && <div className="small" style={{ color: '#4B5563' }}>Answer: {answerFor(q)} · {typeName(q.type)} · {diffName(q.difficulty)} · ch. {q.chapter} · {q.topic}</div>}</span><span>[{x.edit?.marks || q.marks}]</span></div>
            {oq && <div style={{ display: 'flex', gap: 8, marginLeft: 26 }}><span style={{ flex: 1 }}><b>OR</b> {mode === 'key' ? answerFor(oq) : oq.text}{mode === 'teacher' && <div className="small" style={{ color: '#4B5563' }}>Answer: {answerFor(oq)} · ch. {oq.chapter} · {oq.topic}</div>}</span><span>[{oq.marks}]</span></div>}
          </div>; })}</div>)}
    </div>
  </Page>;
}

// ---------------------------------------------------------------- Approved papers
export function ApprovedPapers({ go }) {
  const { db } = useStore();
  const [examId, setExamId] = useState(() => upcomingExam(db));
  const [printing, setPrinting] = useState(null);
  if (printing) { const p = db.qpapers.find((x) => x.id === printing.id); return <PaperPrint paper={p} setIdx={printing.set} mode={printing.mode} back={() => setPrinting(null)} />; }
  const list = db.qpapers.filter((p) => p.examId === examId && p.sets.some((s) => s.status === 'Approved')).sort((a, b) => a.grade - b.grade);
  return <Page title="Approved papers" sub="Papers that are approved and ready for the exam. Print a set, its answer key or the teacher's copy here. To write or change a set, go to Question papers.">
    <div className="row" style={{ marginBottom: 12 }}><Field label="Exam"><Select aria-label="Exam" value={examId} onChange={(e) => setExamId(e.target.value)} options={db.exams.map((e) => [e.id, e.name])} /></Field></div>
    {list.length === 0 ? <Card><p>No approved papers for this exam yet. Build them in <button className="btn sm" onClick={() => go('EXM_QP')}>Question papers</button>.</p></Card>
      : <div className="grid g2">{list.map((p) => { const ap = p.sets.map((s, i) => [s, i]).filter(([s]) => s.status === 'Approved'); const shown = p.chosenSet ? ap.filter(([s]) => s.no === p.chosenSet) : ap;
        return <Card key={p.id} title={`${classLabelOf(p.grade)} · ${p.subject}`} right={<span className="small muted">{dmon(p.date)}</span>}>
          <p className="small">{ap.length} of {p.sets.length} sets approved</p>
          <p className="small">{p.chosenSet ? `Set ${p.chosenSet} is the set for the exam. The other sets are sealed.` : 'No set chosen yet — choose one in Question papers before the exam.'}</p>
          {shown.map(([s, i]) => <div key={s.no} className="row" style={{ gap: 6, flexWrap: 'wrap', borderTop: '1px solid var(--line)', padding: '6px 0' }}>
            <b>Set {s.no}</b>{p.chosenSet === s.no && <Pill kind="ok">Chosen</Pill>}<span className="sp" />
            <button className="btn sm" aria-label={`Print set ${s.no} of ${classLabelOf(p.grade)} ${p.subject}`} onClick={() => setPrinting({ id: p.id, set: i, mode: 'paper' })}>Print</button>
            <button className="btn sm" onClick={() => setPrinting({ id: p.id, set: i, mode: 'key' })}>Answer key</button>
            <button className="btn sm" onClick={() => setPrinting({ id: p.id, set: i, mode: 'teacher' })}>Teacher's copy</button></div>)}
        </Card>; })}</div>}
  </Page>;
}

// ---------------------------------------------------------------- Question bank
export function QuestionBank() {
  const { db, run, notify, session } = useStore();
  const keys = Object.keys(db.bankChapters || {}).sort((a, b) => Number(a.split('|')[0]) - Number(b.split('|')[0]) || a.localeCompare(b));
  const [key, setKey] = useState(keys[keys.length - 1]);
  const [f, setF] = useState({ chapter: '', type: '', diff: '', term: '', status: '', q: '' });
  const [q, setQ] = useState(null);
  const [ch, setCh] = useState(null);
  const [grade, subject] = [Number(key.split('|')[0]), key.split('|')[1]];
  const chapters = chaptersOf(db, grade, subject);
  const me = meOf(db, session);
  const approver = canApprove(me, session.role);
  const all = bankOf(db, grade, subject, true);
  const rows = all.filter((x) => (!f.chapter || x.chapter === Number(f.chapter)) && (!f.type || x.type === f.type) && (!f.diff || x.difficulty === f.diff)
    && (!f.term || x.term === Number(f.term)) && (!f.status || x.status === f.status) && (!f.q || x.text.toLowerCase().includes(f.q.toLowerCase())));
  const save = () => { const c = chapters.find((x) => x.no === Number(q.chapter));
    run((d) => { const data = { grade, subject, board: 'CBSE', chapter: c.no, topic: q.topic, term: c.term, type: q.type, marks: Number(q.marks), difficulty: q.difficulty, text: q.text.trim(), answer: q.answer?.trim() || null, competency: !!q.competency };
      if (q.id) Object.assign(d.questions.find((x) => x.id === q.id), data);
      else d.questions.push({ ...data, id: 'Q' + (d.questions.length + 1) + '-' + Date.now().toString(36), options: null, source: 'Teacher', status: approver ? 'Approved' : 'In review', used: 0 });
      log(d, session.name, q.id ? 'Question edited' : 'Question added', q.text.slice(0, 40)); });
    notify(q.id ? 'Question saved' : approver ? 'Question added' : 'Question sent for review'); setQ(null); };
  const setStatus = (x, s) => { run((d) => { d.questions.find((y) => y.id === x.id).status = s; log(d, session.name, 'Question ' + s.toLowerCase(), x.text.slice(0, 40)); }); notify('Question ' + s.toLowerCase()); };
  const saveChapter = () => { run((d) => { const list = d.bankChapters[key]; if (ch.no) Object.assign(list.find((c) => c.no === ch.no), { name: ch.name, term: Number(ch.term), topics: ch.topics.split(',').map((t) => t.trim()).filter(Boolean) });
    else list.push({ no: list.length + 1, name: ch.name.trim(), term: Number(ch.term), topics: ch.topics.split(',').map((t) => t.trim()).filter(Boolean) }); log(d, session.name, 'Chapter saved', ch.name); }); notify('Chapter saved'); setCh(null); };
  return <Page title="Question bank" sub="Chapters, topics and questions per class and subject, for building question papers. Papers only use approved questions from the topics chosen for them."
    actions={<button className="btn pri" onClick={() => setQ({ chapter: chapters[0]?.no, topic: chapters[0]?.topics[0], type: 'MCQ', marks: 1, difficulty: 'EASY', text: '', answer: '' })}>Add a question</button>}>
    <div className="row" style={{ marginBottom: 12 }}><Field label="Class and subject"><Select aria-label="Class and subject" value={key} onChange={(e) => { setKey(e.target.value); setF({ chapter: '', type: '', diff: '', term: '', status: '', q: '' }); }}
      options={keys.map((k) => [k, `${classLabelOf(Number(k.split('|')[0]))} — ${k.split('|')[1]} (${bankOf(db, Number(k.split('|')[0]), k.split('|')[1], true).length} questions)`])} /></Field></div>
    <div className="grid g-side" style={{ alignItems: 'start' }}>
      <Card title="Chapters" right={<button className="btn sm" onClick={() => setCh({ name: '', term: 1, topics: '' })}>Add a chapter</button>}>
        {chapters.map((c) => <div key={c.no} className="row" style={{ justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--line)' }}>
          <button className="linkish" onClick={() => setF({ ...f, chapter: f.chapter === String(c.no) ? '' : String(c.no) })} aria-pressed={f.chapter === String(c.no)}><b>{c.no}. {c.name}</b><div className="small muted">Term {c.term} · {all.filter((x) => x.chapter === c.no).length} questions · {c.topics.join(', ')}</div></button>
          <button className="btn sm" aria-label={'Edit chapter ' + c.name} onClick={() => setCh({ no: c.no, name: c.name, term: c.term, topics: c.topics.join(', ') })}>Edit</button></div>)}
      </Card>
      <Card title={`${rows.length} questions`}>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          <Select aria-label="Chapter filter" value={f.chapter} onChange={(e) => setF({ ...f, chapter: e.target.value })} options={[['', 'All chapters'], ...chapters.map((c) => [String(c.no), `${c.no}. ${c.name}`])]} />
          <Select aria-label="Type filter" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} options={[['', 'All types'], ...Object.keys(TYPES).map((t) => [t, typeName(t)])]} />
          <Select aria-label="Difficulty filter" value={f.diff} onChange={(e) => setF({ ...f, diff: e.target.value })} options={[['', 'All levels'], ...DIFFS]} />
          <Select aria-label="Term filter" value={f.term} onChange={(e) => setF({ ...f, term: e.target.value })} options={[['', 'Both terms'], ['1', 'Term 1'], ['2', 'Term 2']]} />
          <Select aria-label="Status filter" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} options={[['', 'All statuses'], ['Approved', 'Approved'], ['In review', 'In review']]} />
          <Input aria-label="Search questions" placeholder="Search" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} style={{ maxWidth: 180 }} />
        </div>
        <div className="tw" style={{ maxHeight: 620 }}><table className="t"><thead><tr><th>Ch.</th><th>Question</th><th>Type</th><th>Marks</th><th>Level</th><th>Used</th><th>Status</th><th /></tr></thead>
          <tbody>{rows.slice(0, 200).map((x) => <tr key={x.id}><td>{x.chapter}</td><td style={{ maxWidth: 420 }}>{x.text}<div className="small muted">{x.topic}</div></td><td>{typeName(x.type)}</td><td>{x.marks}</td><td>{diffName(x.difficulty)}</td><td>{x.used || 0}</td>
            <td><Pill kind={x.status === 'Approved' ? 'ok' : 'warn'}>{x.status}</Pill></td>
            <td><div className="row" style={{ gap: 4 }}><button className="btn sm" onClick={() => setQ({ ...x })}>Edit</button>
              <button className="btn sm" onClick={() => setQ({ ...x, id: null, text: x.text + ' (copy)' })}>Duplicate</button>
              {x.status === 'In review' && approver && <button className="btn sm pri" onClick={() => setStatus(x, 'Approved')}>Approve</button>}
              <button className="btn sm" onClick={() => setStatus(x, 'Archived')}>Archive</button></div></td></tr>)}</tbody></table></div>
        {rows.length > 200 && <p className="small muted">Showing 200 of {rows.length} — narrow the filters.</p>}
      </Card>
    </div>
    {q && <Modal title={q.id ? 'Edit question' : 'Add a question'} onClose={() => setQ(null)} actions={<><span className="small muted" role="status">{marksOk(q.marks) ? '' : 'Marks must be a whole number from 1 to 20'}</span><button className="btn pri" disabled={!q.text || q.text.trim().length < 10 || !marksOk(q.marks)} onClick={save}>Save</button></>}>
      <div className="form" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <Field label="Chapter"><Select value={q.chapter} onChange={(e) => { const c = chapters.find((x) => x.no === Number(e.target.value)); setQ({ ...q, chapter: c.no, topic: c.topics[0] }); }} options={chapters.map((c) => [c.no, `${c.no}. ${c.name}`])} /></Field>
        <Field label="Topic"><Select value={q.topic} onChange={(e) => setQ({ ...q, topic: e.target.value })} options={chapters.find((c) => c.no === Number(q.chapter))?.topics || []} /></Field>
        <Field label="Type"><Select value={q.type} onChange={(e) => setQ({ ...q, type: e.target.value, marks: TYPES[e.target.value].marks })} options={Object.keys(TYPES).map((t) => [t, typeName(t)])} /></Field>
        <Field label="Marks"><Input type="number" min="1" max="20" value={q.marks} onChange={(e) => setQ({ ...q, marks: e.target.value })} /></Field>
        <Field label="Difficulty"><Select value={q.difficulty} onChange={(e) => setQ({ ...q, difficulty: e.target.value })} options={DIFFS} /></Field>
        <Field label="Question" full><textarea className="i" rows={3} value={q.text} onChange={(e) => setQ({ ...q, text: e.target.value })} /></Field>
        <Field label="Answer (for the answer key)" full><Input value={q.answer || ''} onChange={(e) => setQ({ ...q, answer: e.target.value })} /></Field>
      </div>
      {!approver && !q.id && <p className="small muted">New questions from teachers go to review before papers can use them.</p>}
    </Modal>}
    {ch && <Modal title={ch.no ? 'Edit chapter' : 'Add a chapter'} onClose={() => setCh(null)} actions={<button className="btn pri" disabled={ch.name.trim().length < 3 || !ch.topics.trim()} onClick={saveChapter}>Save</button>}>
      <div className="form" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <Field label="Title"><Input value={ch.name} onChange={(e) => setCh({ ...ch, name: e.target.value })} /></Field>
        <Field label="Term"><Select value={ch.term} onChange={(e) => setCh({ ...ch, term: e.target.value })} options={[[1, 'Term 1'], [2, 'Term 2']]} /></Field>
        <Field label="Topics (comma separated)" full><Input value={ch.topics} onChange={(e) => setCh({ ...ch, topics: e.target.value })} /></Field>
      </div>
    </Modal>}
  </Page>;
}

// ---------------------------------------------------------------- Blueprints
export function Blueprints() {
  const { db, run, notify, session } = useStore();
  const [edit, setEdit] = useState(null);
  const kinds = db.exams.map((e) => [e.kind, e.name]);
  const subjects = [...new Set(Object.keys(db.bankChapters || {}).map((k) => k.split('|')[1]))];
  const list = db.blueprints.filter((b) => !b.archived);
  const blank = () => ({ name: '', kind: kinds[0][0], fromGrade: 6, toGrade: 10, subjects: 'ALL', minutes: 45, chapterRule: 'T1_THIRD', instructions: 'All questions are compulsory.', sections: [{ title: 'Section A', types: ['MCQ'], count: 5, marks: 1, or: 0 }] });
  const save = () => { run((d) => { const data = { ...edit, instructions: String(edit.instructions).split('\n').map((x) => x.trim()).filter(Boolean), fromGrade: Number(edit.fromGrade), toGrade: Number(edit.toGrade), minutes: Number(edit.minutes),
    sections: edit.sections.map((s) => ({ ...s, count: Number(s.count), marks: Number(s.marks), or: Number(s.or || 0) })) };
    if (edit.id) Object.assign(d.blueprints.find((b) => b.id === edit.id), data); else d.blueprints.push({ ...data, id: 'BP' + (d.blueprints.length + 1) + Date.now().toString(36).slice(-3), board: 'CBSE', archived: false });
    log(d, session.name, 'Blueprint saved', edit.name); }); notify('Blueprint saved'); setEdit(null); };
  const secOf = (i, patch) => setEdit({ ...edit, sections: edit.sections.map((s, k) => (k === i ? { ...s, ...patch } : s)) });
  const total = edit ? edit.sections.reduce((t, s) => t + Number(s.count || 0) * Number(s.marks || 0), 0) : 0;
  const grades = Array.from({ length: 12 }, (_, i) => [i + 1, 'Class ' + (i + 1)]);
  return <Page title="Blueprints" sub="The pattern of each kind of paper: sections, question types, marks, internal choice and which chapters it covers. A paper picks the blueprint that fits its exam, class and subject."
    actions={<button className="btn pri" onClick={() => setEdit(blank())}>New blueprint</button>}>
    <div className="tw" style={{ maxHeight: 'none' }}><table className="t"><thead><tr><th>Blueprint</th><th>Classes</th><th>Marks and time</th><th>Sections</th><th>Chapters</th><th /></tr></thead>
      <tbody>{list.map((b) => <tr key={b.id}><td className="b">{b.name}</td><td>Class {b.fromGrade}–{b.toGrade} · {b.subjects === 'ALL' ? 'All subjects' : b.subjects}</td><td>{blueprintMarks(b)} · {b.minutes} min</td>
        <td>{b.sections.map((s) => `${s.count}×${s.marks}`).join(' + ')}</td><td>{ruleName(b.chapterRule)}</td>
        <td><div className="row" style={{ gap: 4 }}><button className="btn sm" aria-label={'Edit ' + b.name} onClick={() => setEdit({ ...structuredClone(b), instructions: b.instructions.join('\n') })}>Edit</button>
          <button className="btn sm" onClick={() => setEdit({ ...structuredClone(b), id: null, name: b.name + ' (copy)', instructions: b.instructions.join('\n') })}>Copy</button>
          <button className="btn sm" disabled={db.qpapers.some((p) => p.blueprintId === b.id)} title={db.qpapers.some((p) => p.blueprintId === b.id) ? 'Papers use it' : ''} onClick={() => { run((d) => { d.blueprints.find((x) => x.id === b.id).archived = true; }); notify('Blueprint archived'); }}>Archive</button></div></td></tr>)}</tbody></table></div>
    {edit && <Modal title={edit.id ? 'Edit ' + edit.name : 'New blueprint'} onClose={() => setEdit(null)} actions={<button className="btn pri" disabled={edit.name.trim().length < 3 || !edit.sections.length || edit.sections.some((s) => !s.types.length)} onClick={save}>Save blueprint</button>}>
      <div className="form" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        <Field label="Name" full><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
        <Field label="Exam"><Select value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value })} options={kinds} /></Field>
        <Field label="From class"><Select value={edit.fromGrade} onChange={(e) => setEdit({ ...edit, fromGrade: e.target.value })} options={grades} /></Field>
        <Field label="To class"><Select value={edit.toGrade} onChange={(e) => setEdit({ ...edit, toGrade: e.target.value })} options={grades} /></Field>
        <Field label="Subjects"><Select value={edit.subjects} onChange={(e) => setEdit({ ...edit, subjects: e.target.value })} options={[['ALL', 'All subjects'], ...subjects.map((s) => [s, s])]} /></Field>
        <Field label="Minutes"><Input type="number" value={edit.minutes} onChange={(e) => setEdit({ ...edit, minutes: e.target.value })} /></Field>
        <Field label="Chapters"><Select value={edit.chapterRule} onChange={(e) => setEdit({ ...edit, chapterRule: e.target.value })} options={CHAPTER_RULES} /></Field>
        <Field label="General instructions (one per line)" full><textarea className="i" rows={3} value={edit.instructions} onChange={(e) => setEdit({ ...edit, instructions: e.target.value })} /></Field>
      </div>
      <h3 style={{ margin: '12px 0 6px' }}>Sections ({total} marks)</h3>
      {edit.sections.map((s, i) => <div key={i} className="card" style={{ padding: 10, marginBottom: 8 }}>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <Field label="Title"><Input value={s.title} onChange={(e) => secOf(i, { title: e.target.value })} /></Field>
          <Field label="Questions"><Input type="number" min="1" style={{ width: 80 }} value={s.count} onChange={(e) => secOf(i, { count: e.target.value })} /></Field>
          <Field label="Marks each"><Input type="number" min="1" style={{ width: 80 }} value={s.marks} onChange={(e) => secOf(i, { marks: e.target.value })} /></Field>
          <Field label="With OR"><Input type="number" min="0" style={{ width: 80 }} value={s.or || 0} onChange={(e) => secOf(i, { or: e.target.value })} /></Field>
          <button className="btn sm danger" aria-label={'Remove section ' + s.title} onClick={() => setEdit({ ...edit, sections: edit.sections.filter((_, k) => k !== i) })}>Remove</button>
        </div>
        <div className="row small" style={{ gap: 10, flexWrap: 'wrap', marginTop: 6 }}>{Object.keys(TYPES).map((t) => <label key={t} className="row"><input type="checkbox" checked={s.types.includes(t)} onChange={() => secOf(i, { types: s.types.includes(t) ? s.types.filter((x) => x !== t) : [...s.types, t] })} />{typeName(t)}</label>)}</div>
      </div>)}
      <button className="btn sm" onClick={() => setEdit({ ...edit, sections: [...edit.sections, { title: 'Section ' + 'ABCDEFGH'[edit.sections.length], types: ['SA'], count: 2, marks: 3, or: 0 }] })}>Add a section</button>
    </Modal>}
  </Page>;
}
