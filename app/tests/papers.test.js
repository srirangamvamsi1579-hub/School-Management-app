// Question papers: built only from the chosen topics; sets avoid each other; blueprint checks; approval rules
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSeed } from '../src/data/seed.js';
import { newPaper, fillSet, emptySet, availability, overlap, setProblems, setMarks, blueprintMarks, blueprintFor, chaptersOf, topicKey, qById, chaptersByRule, topicsOfChapters, canApprove, paperStatus, shuffleSet } from '../src/lib/papers.js';

const start = (db, grade = 9, subject = 'Mathematics', examId = 'EX3') => {
  const exam = db.exams.find((e) => e.id === examId);
  const entry = db.examSchedule.find((s) => s.examId === examId && s.grade === grade && s.subject === subject);
  const p = newPaper(db, { exam, entry, by: 't' }); const bp = db.blueprints.find((b) => b.id === p.blueprintId);
  return { p, bp };
};
const topicsOf = (db, set) => set.slots.flatMap((x) => [x.qid, x.orQid]).filter(Boolean).map((id) => { const q = qById(db, id); return topicKey(q.chapter, q.topic); });

test('a new paper takes the blueprint for its exam and class, and the chapters the blueprint covers', () => {
  const db = buildSeed();
  const { p, bp } = start(db);
  assert.equal(bp.kind, 'UT2'); assert.equal(blueprintMarks(bp), 25);
  const chapters = chaptersOf(db, 9, 'Mathematics');
  assert.deepEqual(p.topics, topicsOfChapters(chapters, chaptersByRule(chapters, 'T2_THIRD')));
  assert.ok(p.topics.every((k) => chapters.find((c) => c.no === Number(k.split('|')[0])).term === 2), 'term 2 chapters for Unit Test 2');
});

test('every question comes from the chosen topics; changing the topics changes the paper', () => {
  const db = buildSeed();
  const { p, bp } = start(db);
  p.topics = [topicKey(1, 'Irrational numbers'), topicKey(2, 'Factorisation of polynomials'), topicKey(6, 'Pairs of angles')];
  fillSet(db, p, bp, 0);
  assert.ok(topicsOf(db, p.sets[0]).every((k) => p.topics.includes(k)), 'only chosen topics');
  assert.deepEqual(setProblems(db, p.sets[0], bp), [], 'matches the blueprint');
  assert.equal(setMarks(db, p.sets[0]), 25);
  const used = new Set(topicsOf(db, p.sets[0]));
  assert.ok(used.size >= 3, 'spread across the topics');
  p.topics = [topicKey(7, 'Congruence rules'), topicKey(8, 'Mid-point theorem')];
  fillSet(db, p, bp, 0);
  assert.ok(topicsOf(db, p.sets[0]).every((k) => p.topics.includes(k)), 'rebuilt from the new topics');
});

test('locked questions stay when the paper is rebuilt, if their topic is still chosen', () => {
  const db = buildSeed();
  const { p, bp } = start(db);
  fillSet(db, p, bp, 0);
  const keep = p.sets[0].slots[0]; keep.locked = true; const id = keep.qid;
  fillSet(db, p, bp, 0);
  assert.equal(p.sets[0].slots[0].qid, id);
  p.topics = p.topics.filter((k) => k !== topicKey(qById(db, id).chapter, qById(db, id).topic));
  fillSet(db, p, bp, 0);
  assert.notEqual(p.sets[0].slots[0].qid, id, 'dropped once its topic is unticked');
});

test('availability shows what the chosen topics hold per section, and the shortfall', () => {
  const db = buildSeed();
  const { p, bp } = start(db);
  const a = availability(db, p, bp);
  assert.equal(a.length, bp.sections.length);
  assert.ok(a.every((x) => x.available >= x.need), 'enough by default');
  p.topics = [topicKey(10, 'Area of a triangle')];
  const b = availability(db, p, bp);
  assert.ok(b.some((x) => x.short > 0), 'one topic is not enough');
  const short = fillSet(db, p, bp, 0);
  assert.ok(short.length > 0, 'shortfall reported');
});

test('sets avoid each other\'s questions while the topics allow; overlap is measured', () => {
  const db = buildSeed();
  const { p, bp } = start(db);
  p.topics = topicsOfChapters(chaptersOf(db, 9, 'Mathematics'), [1, 2, 3, 4, 5, 6]);
  for (let i = 1; i < 4; i++) p.sets.push(emptySet(bp, i + 1));
  p.sets.forEach((_, i) => fillSet(db, p, bp, i));
  p.sets.forEach((_, i) => assert.equal(overlap(p, i), 0, 'no overlap with plenty of questions'));
  p.topics = [topicKey(1, 'Irrational numbers'), topicKey(2, 'Zeroes of a polynomial')];
  for (let i = 4; i < 10; i++) p.sets.push(emptySet(bp, i + 1));
  p.sets.forEach((_, i) => fillSet(db, p, bp, i));
  assert.ok(p.sets.some((_, i) => overlap(p, i) > 0), 'few topics, many sets: overlap shows');
});

test('the internal choice (OR) gets a second question of the same kind; shuffle keeps sections', () => {
  const db = buildSeed();
  const { p, bp } = start(db);
  fillSet(db, p, bp, 0);
  const orSec = bp.sections.findIndex((s) => s.or > 0);
  const slot = p.sets[0].slots.find((x) => x.section === orSec);
  assert.ok(slot.orQid && slot.orQid !== slot.qid);
  assert.equal(qById(db, slot.orQid).marks, bp.sections[orSec].marks);
  const before = p.sets[0].slots.map((x) => x.section).join();
  shuffleSet(p.sets[0]);
  assert.equal(p.sets[0].slots.map((x) => x.section).join(), before);
});

test('approval: Principal, Admin and senior academic designations approve; status reads per set', () => {
  assert.ok(canApprove(null, 'PRINCIPAL')); assert.ok(canApprove({ designation: 'Vice Principal' }, 'TEACHER'));
  assert.ok(!canApprove({ designation: 'TGT' }, 'TEACHER'));
  const db = buildSeed();
  const p10 = db.qpapers.find((p) => p.grade === 10);
  assert.equal(paperStatus(p10).label, 'Approved'); assert.match(paperStatus(p10).sub, /1 \/ 3 approved · Set 2 chosen/);
  assert.equal(paperStatus(null).label, 'Not started');
  assert.equal(blueprintFor(db, db.exams.find((e) => e.id === 'EX2'), 7, 'English').id, 'BP2');
});
