// Question papers seed: chapters and topics per class and subject (NCERT names), a generated question bank,
// exams with their timetable, blueprints, and a few papers in different states.
import { rng } from '../lib/format.js';
import { CHAPTERS } from './seed.js';
import { newPaper, fillSet, blueprintFor, snapshot, emptySet } from '../lib/papers.js';

const T = (n, half) => (n <= half ? 1 : 2);
const MATHS_9 = [['Number Systems', ['Irrational numbers', 'Real numbers and their decimals']], ['Polynomials', ['Zeroes of a polynomial', 'Factorisation of polynomials']],
  ['Coordinate Geometry', ['Cartesian system']], ['Linear Equations in Two Variables', ['Solutions of a linear equation', 'Graph of a linear equation']],
  ["Introduction to Euclid's Geometry", ['Axioms and postulates']], ['Lines and Angles', ['Pairs of angles', 'Parallel lines and a transversal']],
  ['Triangles', ['Congruence rules', 'Properties of a triangle']], ['Quadrilaterals', ['Properties of a parallelogram', 'Mid-point theorem']],
  ['Circles', ['Chords and their properties', 'Cyclic quadrilaterals']], ["Heron's Formula", ['Area of a triangle']],
  ['Surface Areas and Volumes', ['Cones and spheres']], ['Statistics', ['Graphs of data', 'Mean of grouped data']]].map(([name, topics], i) => ({ no: i + 1, name, term: T(i + 1, 6), topics }));
const MATHS_6 = [['Patterns in Mathematics', ['Number patterns', 'Visualising sequences']], ['Lines and Angles', ['Lines, rays and segments', 'Measuring angles']],
  ['Number Play', ['Supercells and digit sums']], ['Data Handling and Presentation', ['Pictographs', 'Bar graphs']], ['Prime Time', ['Primes and composites', 'Divisibility rules']],
  ['Perimeter and Area', ['Perimeter', 'Area of rectangles and squares']], ['Fractions', ['Equivalent fractions', 'Adding and subtracting fractions']],
  ['Playing with Constructions', ['Circles and arcs']], ['Symmetry', ['Line symmetry', 'Rotational symmetry']], ['The Other Side of Zero', ['Integers on the number line']]]
  .map(([name, topics], i) => ({ no: i + 1, name, term: T(i + 1, 5), topics }));
const SCIENCE_10 = [['Chemical Reactions and Equations', ['Types of chemical reactions', 'Balancing equations']], ['Acids, Bases and Salts', ['The pH scale', 'Salts and their uses']],
  ['Metals and Non-metals', ['Physical and chemical properties', 'Reactivity series']], ['Carbon and its Compounds', ['Covalent bonding', 'Homologous series']],
  ['Life Processes', ['Nutrition', 'Respiration']], ['Control and Coordination', ['Nervous system', 'Hormones in animals']],
  ['How do Organisms Reproduce?', ['Asexual reproduction', 'Sexual reproduction in plants']], ['Heredity', ["Mendel's experiments"]],
  ['Light – Reflection and Refraction', ['Spherical mirrors', 'Lenses']], ['The Human Eye and the Colourful World', ['Defects of vision', 'Dispersion of light']],
  ['Electricity', ["Ohm's law", 'Resistors in series and parallel']], ['Magnetic Effects of Electric Current', ['Magnetic field lines', 'Electromagnets']],
  ['Our Environment', ['Ecosystems and food chains']]].map(([name, topics], i) => ({ no: i + 1, name, term: T(i + 1, 7), topics }));
const SCIENCE_8 = [['Crop Production and Management', ['Agricultural practices']], ['Microorganisms: Friend and Foe', ['Useful microorganisms', 'Harmful microorganisms']],
  ['Coal and Petroleum', ['Fossil fuels']], ['Combustion and Flame', ['Types of combustion']], ['Conservation of Plants and Animals', ['Biodiversity and reserves']],
  ['Reproduction in Animals', ['Modes of reproduction']], ['Force and Pressure', ['Types of force', 'Pressure']], ['Friction', ['Factors affecting friction']],
  ['Sound', ['Vibration and propagation', 'Loudness and pitch']], ['Chemical Effects of Electric Current', ['Electroplating']], ['Light', ['Laws of reflection', 'The human eye']]]
  .map(([name, topics], i) => ({ no: i + 1, name, term: T(i + 1, 6), topics }));

const STEMS = {
  MCQ: (t, d) => `${d === 'TOUGH' ? 'Choose the correct statement' : 'Which of the following is correct'} about ${t.toLowerCase()}? (a) … (b) … (c) … (d) …`,
  TF: (t) => `True or false: a stated property of ${t.toLowerCase()} holds in every case.`,
  FIB: (t) => `Fill in the blank on ${t.toLowerCase()}: ________ .`,
  OW: (t) => `Answer in one word: the term used for the key idea in ${t.toLowerCase()}.`,
  AR: (t) => `Assertion (A): a statement about ${t.toLowerCase()}. Reason (R): the rule that explains it.`,
  VSA: (t, d) => `${d === 'EASY' ? 'State' : 'State and apply'} the key result of ${t.toLowerCase()} to the given values.`,
  SA: (t, d) => `${d === 'TOUGH' ? 'Prove or justify' : 'Solve'} the following on ${t.toLowerCase()}, showing each step.`,
  LA: (t) => `A real-life problem on ${t.toLowerCase()}: model it, solve it and interpret the answer.`,
  CASE: (t) => `Case study on ${t.toLowerCase()} with three sub-parts (1 + 1 + 2 marks).`
};
const MARKS = { MCQ: 1, TF: 1, FIB: 1, OW: 1, AR: 1, VSA: 2, SA: 3, LA: 5, CASE: 4 };

export function seedPapers(db) {
  const r = rng(29);
  const MATHS_10 = CHAPTERS.map(([no, name, topics]) => ({ no, name, term: T(no, 7), topics }));   // read here: seed.js imports this file's caller
  db.bankChapters = {
    '10|Mathematics': MATHS_10, '9|Mathematics': MATHS_9, '6|Mathematics': MATHS_6, '10|Science': SCIENCE_10, '8|Science': SCIENCE_8
  };
  // Existing Class X Maths questions: mark their term; add the 1-mark kinds the blueprints use
  db.questions.forEach((q) => { q.term = MATHS_10.find((c) => c.no === q.chapter)?.term || 1; });
  let n = db.questions.length;
  const add = (grade, subject, chapters, types) => chapters.forEach((c) => c.topics.forEach((topic) => types.forEach((type) => ['EASY', 'INTERMEDIATE', 'TOUGH'].forEach((difficulty) => {
    db.questions.push({ id: 'Q' + (++n), board: 'CBSE', grade, subject, chapter: c.no, topic, term: c.term, type, marks: MARKS[type], difficulty,
      competency: r() > 0.5, text: STEMS[type](topic, difficulty), options: null, source: 'Teacher', status: r() > 0.96 ? 'In review' : 'Approved', used: Math.floor(r() * 2) });
  }))));
  add(10, 'Mathematics', MATHS_10, ['TF', 'FIB', 'OW']);
  add(9, 'Mathematics', MATHS_9, ['MCQ', 'TF', 'FIB', 'AR', 'VSA', 'SA', 'LA', 'CASE']);
  add(6, 'Mathematics', MATHS_6, ['MCQ', 'TF', 'FIB', 'OW', 'VSA', 'SA', 'LA', 'CASE']);
  add(10, 'Science', SCIENCE_10, ['MCQ', 'AR', 'VSA', 'SA', 'LA', 'CASE']);
  add(8, 'Science', SCIENCE_8, ['MCQ', 'TF', 'FIB', 'OW', 'VSA', 'SA', 'LA', 'CASE']);
  // A few real questions with model answers
  const real = [
    [6, 'Mathematics', 6, 'Perimeter', 'FIB', 'EASY', 'Perimeter of a rectangle = 2 × (length + ____).', 'breadth'],
    [6, 'Mathematics', 7, 'Equivalent fractions', 'MCQ', 'EASY', 'Which fraction is equivalent to 2/3? (a) 3/4 (b) 4/6 (c) 6/8 (d) 5/6', '(b) 4/6'],
    [6, 'Mathematics', 6, 'Area of rectangles and squares', 'TF', 'INTERMEDIATE', 'Two shapes with the same area always have the same perimeter.', 'False'],
    [6, 'Mathematics', 7, 'Adding and subtracting fractions', 'LA', 'INTERMEDIATE', 'Sita ate 2/5 of a cake and her brother ate 1/3 of it. What fraction did they eat together, and what fraction is left?', '2/5 + 1/3 = 11/15 eaten; 4/15 left'],
    [9, 'Mathematics', 1, 'Irrational numbers', 'MCQ', 'EASY', 'Which of these is irrational? (a) 0.25 (b) √16 (c) √2 (d) 7/3', '(c) √2'],
    [10, 'Science', 11, "Ohm's law", 'VSA', 'EASY', 'A 12 V battery drives 0.5 A through a resistor. Find its resistance.', 'R = V/I = 12/0.5 = 24 Ω'],
    [10, 'Science', 2, 'The pH scale', 'MCQ', 'EASY', 'A solution turns red litmus blue. Its pH is likely to be (a) 1 (b) 4 (c) 5 (d) 10', '(d) 10']
  ];
  real.forEach(([grade, subject, chapter, topic, type, difficulty, text, answer]) => db.questions.push({ id: 'Q' + (++n), board: 'CBSE', grade, subject, chapter, topic,
    term: db.bankChapters[`${grade}|${subject}`].find((c) => c.no === chapter).term, type, marks: MARKS[type], difficulty, competency: true, text, answer, options: null, source: 'Teacher', status: 'Approved', used: 0 }));

  // Blueprints (sections: types, how many, marks each, how many with an internal OR choice)
  const S = (title, types, count, marks, or = 0) => ({ title, types, count, marks, or });
  const UT = [S('Section A', ['MCQ', 'TF', 'FIB', 'OW', 'AR'], 5, 1), S('Section B', ['VSA'], 3, 2), S('Section C', ['SA'], 3, 3), S('Section D', ['LA'], 1, 5, 1)];
  const BIG_9_10 = [S('Section A', ['MCQ', 'AR', 'TF', 'FIB'], 20, 1), S('Section B', ['VSA'], 5, 2, 2), S('Section C', ['SA'], 6, 3, 2), S('Section D', ['LA'], 4, 5, 2), S('Section E', ['CASE'], 3, 4)];
  const BIG_6_8 = [S('Section A', ['MCQ', 'TF', 'FIB', 'OW'], 20, 1), S('Section B', ['VSA'], 5, 2), S('Section C', ['SA'], 6, 3, 1), S('Section D', ['LA'], 4, 5, 1), S('Section E', ['CASE'], 3, 4)];
  const ins = ['All questions are compulsory.', 'Internal choice is given in some questions; attempt only one of the alternatives.', 'Marks are shown in brackets [ ] against each question.'];
  const bp = (id, name, kind, fromGrade, toGrade, minutes, chapterRule, sections) => ({ id, name, kind, fromGrade, toGrade, subjects: 'ALL', board: 'CBSE', minutes, chapterRule, sections, instructions: ins, archived: false });
  db.blueprints = [
    bp('BP1', 'Periodic Test I (classes 6–10)', 'PT1', 6, 10, 45, 'T1_THIRD', UT),
    bp('BP2', 'Half-yearly (classes 6–8)', 'HY', 6, 8, 180, 'T1_T2_THIRD', BIG_6_8),
    bp('BP3', 'Half-yearly (classes 9–10)', 'HY', 9, 10, 180, 'T1_T2_THIRD', BIG_9_10),
    bp('BP4', 'Unit Test 2 (classes 6–10)', 'UT2', 6, 10, 45, 'T2_THIRD', UT),
    bp('BP5', 'Unit Test 3 (classes 6–10)', 'UT3', 6, 10, 45, 'T2_MIDDLE', UT),
    bp('BP6', 'Annual (classes 6–8)', 'ANNUAL', 6, 8, 180, 'ALL', BIG_6_8),
    bp('BP7', 'Annual (classes 9–10)', 'ANNUAL', 9, 10, 180, 'ALL', BIG_9_10)
  ];

  // Exams and their timetable (class, subject, date)
  db.exams = [
    { id: 'EX1', name: 'Periodic Test I', kind: 'PT1', from: '2026-07-20' }, { id: 'EX2', name: 'Half-yearly Examination', kind: 'HY', from: '2026-09-21' },
    { id: 'EX3', name: 'Unit Test 2', kind: 'UT2', from: '2026-12-01' }, { id: 'EX4', name: 'Unit Test 3', kind: 'UT3', from: '2027-01-18' },
    { id: 'EX5', name: 'Annual Examination', kind: 'ANNUAL', from: '2027-03-01' }];
  const rows = [[6, 'Mathematics'], [6, 'English'], [7, 'English'], [8, 'Science'], [8, 'English'], [9, 'Mathematics'], [9, 'English'], [10, 'Mathematics'], [10, 'Science'], [10, 'English']];
  const addDays = (iso, k) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + k); return d.toISOString().slice(0, 10); };
  db.examSchedule = db.exams.flatMap((e) => rows.map(([grade, subject], i) => ({ examId: e.id, grade, subject, date: addDays(e.from, (i % 5) + (subject === 'English' ? 0 : 1)) })));

  // Papers: Unit Test 2 — Class 10 Maths approved (set 2 chosen), Class 6 Maths draft with two sets
  db.qpapers = [];
  const make = (examId, grade, subject, sets) => {
    const exam = db.exams.find((e) => e.id === examId); const entry = db.examSchedule.find((s) => s.examId === examId && s.grade === grade && s.subject === subject);
    const p = newPaper(db, { exam, entry, by: 'Sonia Mehta' }); const b = blueprintFor(db, exam, grade, subject);
    for (let i = 1; i < sets; i++) p.sets.push(emptySet(b, i + 1));
    p.sets.forEach((_, i) => fillSet(db, p, b, i)); snapshot(p, 'Generated', 'Sonia Mehta'); db.qpapers.push(p); return p;
  };
  const p10 = make('EX3', 10, 'Mathematics', 3);
  p10.sets.forEach((s, i) => { s.status = i === 1 ? 'Approved' : 'Submitted'; s.submittedBy = 'Sonia Mehta'; if (i === 1) s.decidedBy = 'Dr. Kavita Menon'; });
  p10.chosenSet = 2;
  make('EX3', 6, 'Mathematics', 2);
  return db;
}
