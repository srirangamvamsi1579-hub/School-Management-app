// Question papers: blueprints, topic-driven generation, sets, versions and approval.
// A paper belongs to one exam, class and subject. Its questions come only from the topics chosen for it, so changing
// the topics changes what can be (and, with "Update automatically", what is) on the paper.

export const TYPES = {
  MCQ: { name: 'Multiple choice', marks: 1 }, TF: { name: 'True or false', marks: 1 }, FIB: { name: 'Fill in the blank', marks: 1 },
  OW: { name: 'One word', marks: 1 }, AR: { name: 'Assertion and reason', marks: 1 }, VSA: { name: 'Very short answer', marks: 2 },
  SA: { name: 'Short answer', marks: 3 }, LA: { name: 'Long answer', marks: 5 }, CASE: { name: 'Case-based', marks: 4 }
};
export const DIFFS = [['EASY', 'Easy'], ['INTERMEDIATE', 'Medium'], ['TOUGH', 'Hard']];
export const diffName = (d) => (DIFFS.find((x) => x[0] === d) || [d, d])[1];
export const MAX_SETS = 10;

// Which chapters a blueprint covers by default (teachers can change the topics on each paper)
export const CHAPTER_RULES = [
  ['T1_THIRD', 'Term 1, first third'], ['T1_TWO_THIRDS', 'Term 1, first two-thirds'], ['T1_ALL', 'All of term 1'],
  ['T2_THIRD', 'Term 2, first third'], ['T2_MIDDLE', 'Term 2, middle third'], ['T2_TWO_THIRDS', 'Term 2, first two-thirds'], ['T2_ALL', 'All of term 2'],
  ['T1_T2_THIRD', 'Term 1 and the first third of term 2'], ['ALL', 'The whole syllabus'], ['CHOSEN', 'Chapters chosen for each paper']
];
export const ruleName = (r) => (CHAPTER_RULES.find((x) => x[0] === r) || [r, r])[1];

export const bankKey = (grade, subject) => `${grade}|${subject}`;
export const chaptersOf = (db, grade, subject) => db.bankChapters?.[bankKey(grade, subject)] || [];
export const bankOf = (db, grade, subject, all = false) => db.questions.filter((q) => q.grade === grade && q.subject === subject && (all ? q.status !== 'Archived' : q.status === 'Approved'));
export const topicKey = (ch, topic) => `${ch}|${topic}`;
export const qById = (db, id) => db.questions.find((q) => q.id === id);
export const classLabelOf = (g) => (g === 0 ? 'UKG' : 'Class ' + g);

export function chaptersByRule(chapters, rule) {
  const t1 = chapters.filter((c) => c.term === 1), t2 = chapters.filter((c) => c.term === 2);
  const part = (list, a, b) => list.slice(Math.floor(list.length * a), Math.ceil(list.length * b));
  const pick = {
    T1_THIRD: part(t1, 0, 1 / 3), T1_TWO_THIRDS: part(t1, 0, 2 / 3), T1_ALL: t1, T2_THIRD: part(t2, 0, 1 / 3), T2_MIDDLE: part(t2, 1 / 3, 2 / 3),
    T2_TWO_THIRDS: part(t2, 0, 2 / 3), T2_ALL: t2, T1_T2_THIRD: [...t1, ...part(t2, 0, 1 / 3)], ALL: chapters, CHOSEN: chapters
  }[rule] || chapters;
  return pick.map((c) => c.no);
}
export const topicsOfChapters = (chapters, nos) => chapters.filter((c) => nos.includes(c.no)).flatMap((c) => c.topics.map((t) => topicKey(c.no, t)));

// Blueprint that fits an exam, class and subject (most specific first)
export function blueprintFor(db, exam, grade, subject) {
  const fits = (db.blueprints || []).filter((b) => !b.archived && b.kind === exam.kind && grade >= b.fromGrade && grade <= b.toGrade && (b.subjects === 'ALL' || b.subjects === subject));
  return fits.sort((a, b) => (a.subjects === 'ALL') - (b.subjects === 'ALL') || (a.toGrade - a.fromGrade) - (b.toGrade - b.fromGrade))[0] || null;
}
export const blueprintMarks = (bp) => bp.sections.reduce((s, x) => s + x.count * x.marks, 0);
export const sectionLabel = (bp, i) => bp.sections[i].title || 'Section ' + 'ABCDEFGH'[i];

// A fresh, empty set laid out by the blueprint
export function emptySet(bp, no) {
  const slots = bp.sections.flatMap((s, si) => Array.from({ length: s.count }, () => ({ section: si, qid: null, orQid: null, locked: false, edit: null })));
  return { no, status: 'Draft', slots, submittedBy: null, decidedBy: null, note: '' };
}

export function newPaper(db, { exam, entry, by }) {
  const bp = blueprintFor(db, exam, entry.grade, entry.subject);
  if (!bp) throw new Error('No blueprint fits this exam, class and subject — add one in Blueprints');
  const chapters = chaptersOf(db, entry.grade, entry.subject);
  const topics = topicsOfChapters(chapters, chaptersByRule(chapters, bp.chapterRule));
  return { id: 'QP' + Date.now().toString(36) + Math.floor(Math.random() * 1e4), examId: exam.id, grade: entry.grade, subject: entry.subject, date: entry.date,
    blueprintId: bp.id, topics, mix: [30, 50, 20], auto: true, sets: [emptySet(bp, 1)], chosenSet: null, startTime: '09:00',
    versions: [], views: [], createdBy: by, at: new Date().toISOString() };
}

// How many questions the chosen topics hold for each section of the blueprint (what the paper can be made from)
export function availability(db, paper, bp) {
  const pool = bankOf(db, paper.grade, paper.subject).filter((q) => paper.topics.includes(topicKey(q.chapter, q.topic)));
  return bp.sections.map((s) => {
    const fit = pool.filter((q) => s.types.includes(q.type) && q.marks === s.marks);
    const need = s.count + (s.or || 0);
    return { need, available: fit.length, byDiff: DIFFS.map(([d]) => fit.filter((q) => q.difficulty === d).length), short: Math.max(0, need - fit.length) };
  });
}

// Spread a difficulty mix (percent) over n slots, largest remainder first
function spread(n, mix) {
  const raw = mix.map((p) => (n * p) / 100), base = raw.map(Math.floor);
  let left = n - base.reduce((a, b) => a + b, 0);
  raw.map((r, i) => [r - base[i], i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left-- > 0) base[i]++; });
  return base.flatMap((c, i) => Array(c).fill(DIFFS[i][0]));
}

// Fill (or refill) one set. Locked slots stay if their question is still in the chosen topics. Questions on the other
// sets are avoided, so sets overlap only when the topics don't hold enough questions.
export function fillSet(db, paper, bp, setIdx, { onlyEmpty = false, avoid = [] } = {}) {
  const set = paper.sets[setIdx];
  const inTopics = (q) => q && paper.topics.includes(topicKey(q.chapter, q.topic));
  const pool = bankOf(db, paper.grade, paper.subject).filter(inTopics);
  const otherSets = new Set(paper.sets.filter((_, i) => i !== setIdx).flatMap((s) => s.slots.flatMap((x) => [x.qid, x.orQid])).filter(Boolean));
  const taken = new Set(avoid);
  const topicCount = {};
  set.slots.forEach((sl) => {
    const keep = (sl.locked || (onlyEmpty && sl.qid)) && inTopics(qById(db, sl.qid));
    if (!keep) { sl.qid = null; sl.orQid = null; sl.edit = null; sl.locked = false; return; }
    taken.add(sl.qid); if (sl.orQid) taken.add(sl.orQid);
    const q = qById(db, sl.qid); topicCount[q.topic] = (topicCount[q.topic] || 0) + 1;
  });
  const short = [];
  bp.sections.forEach((s, si) => {
    const slots = set.slots.filter((x) => x.section === si);
    const want = spread(slots.length, paper.mix);
    const cands = pool.filter((q) => s.types.includes(q.type) && q.marks === s.marks);
    const pickOne = (diff, avoidTopic) => {
      let best = null, bestScore = Infinity;
      for (const q of cands) {
        if (taken.has(q.id)) continue;
        const score = (otherSets.has(q.id) ? 1000 : 0) + (q.difficulty === diff ? 0 : 40) + (topicCount[q.topic] || 0) * 12 + (q.used || 0) * 4
          + (avoidTopic && q.topic === avoidTopic ? 30 : 0) + Math.random() * 10;
        if (score < bestScore) { best = q; bestScore = score; }
      }
      if (best) { taken.add(best.id); topicCount[best.topic] = (topicCount[best.topic] || 0) + 1; }
      return best;
    };
    let orLeft = s.or || 0;
    slots.forEach((sl, k) => {
      if (!sl.qid) { const q = pickOne(want[k]); if (q) sl.qid = q.id; else short.push(sectionLabel(bp, si)); }
      if (orLeft > 0 && sl.qid) { orLeft--; if (!sl.orQid) { const q = pickOne(qById(db, sl.qid).difficulty, qById(db, sl.qid).topic); if (q) sl.orQid = q.id; } }
    });
  });
  return [...new Set(short)];
}

export function shuffleSet(set) {
  const bySec = {};
  set.slots.forEach((s, i) => { if (!s.locked) (bySec[s.section] = bySec[s.section] || []).push(i); });
  Object.values(bySec).forEach((idx) => {
    const vals = idx.map((i) => set.slots[i]);
    for (let i = vals.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [vals[i], vals[j]] = [vals[j], vals[i]]; }
    idx.forEach((i, k) => { set.slots[i] = vals[k]; });
  });
}

export function setMarks(db, set) { return set.slots.reduce((t, s) => t + (s.qid ? (s.edit?.marks || qById(db, s.qid)?.marks || 0) : 0), 0); }
export function setQuestionCount(set) { return set.slots.filter((s) => s.qid).length; }
// Share of this set's questions that are also on another set of the same paper
export function overlap(paper, i) {
  const mine = paper.sets[i].slots.map((s) => s.qid).filter(Boolean);
  if (!mine.length) return 0;
  const others = new Set(paper.sets.filter((_, k) => k !== i).flatMap((s) => s.slots.flatMap((x) => [x.qid, x.orQid])).filter(Boolean));
  return Math.round((mine.filter((q) => others.has(q)).length / mine.length) * 100);
}

// Problems that stop a set matching its blueprint
export function setProblems(db, set, bp) {
  const out = [];
  bp.sections.forEach((s, si) => {
    const filled = set.slots.filter((x) => x.section === si && x.qid).length;
    if (filled < s.count) out.push(`${sectionLabel(bp, si)} has ${filled} of ${s.count} questions.`);
    if (filled > s.count) out.push(`${sectionLabel(bp, si)} has ${filled} questions; the blueprint asks for ${s.count}.`);
  });
  const m = setMarks(db, set), target = blueprintMarks(bp);
  if (m !== target) out.push(`The questions add up to ${m} marks; the paper is out of ${target}.`);
  return out;
}

export function snapshot(paper, label, by) {
  paper.versions = [{ at: new Date().toISOString(), by, label, sets: structuredClone(paper.sets), topics: [...paper.topics] }, ...(paper.versions || [])].slice(0, 25);
}

// Status of a paper for the list: Not started / Draft / Submitted / n of m approved
export function paperStatus(paper) {
  if (!paper) return { label: 'Not started', kind: 'muted' };
  const ap = paper.sets.filter((s) => s.status === 'Approved').length;
  if (ap) return { label: 'Approved', kind: 'ok', sub: `${ap} / ${paper.sets.length} approved${paper.chosenSet ? ` · Set ${paper.chosenSet} chosen` : ''}` };
  if (paper.sets.some((s) => s.status === 'Submitted')) return { label: 'Submitted for approval', kind: 'warn' };
  if (paper.sets.some((s) => s.status === 'Sent back')) return { label: 'Sent back', kind: 'bad' };
  return { label: 'Draft', kind: 'info', sub: paper.sets.length > 1 ? `0 / ${paper.sets.length} approved` : null };
}

// Approvers: the Principal, Admin, and senior academic designations
export const APPROVER_DESIGNATIONS = ['Vice Principal', 'Head of Teaching Staff', 'Head of Department', 'Academic Director', 'Coordinator'];
export const canApprove = (user, role) => ['PRINCIPAL', 'ADMIN'].includes(role) || APPROVER_DESIGNATIONS.includes(user?.designation);

// Model answers: stored for questions that have one; otherwise a marking hint from the type and topic
export function answerFor(q) {
  if (!q) return '';
  if (q.answer) return q.answer;
  const h = [...q.id].reduce((a, c) => a + c.charCodeAt(0), 0);
  return {
    MCQ: `(${'abcd'[h % 4]})`, AR: `(${'abcd'[h % 4]}) — see the marking scheme`, TF: h % 2 ? 'True' : 'False',
    FIB: `Key term from “${q.topic}”`, OW: `Key word from “${q.topic}”`,
    VSA: `Two points on ${q.topic.toLowerCase()} (1 + 1)`, SA: `Three steps on ${q.topic.toLowerCase()} (1 + 1 + 1)`,
    LA: `Full working on ${q.topic.toLowerCase()}: method 2, working 2, answer 1`, CASE: `Sub-parts 1 + 1 + 2 on ${q.topic.toLowerCase()}`
  }[q.type] || '';
}
