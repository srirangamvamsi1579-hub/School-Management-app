-- =====================================================================
-- MIGRATION 003 — Exams: boards & textbooks, question bank, paper
-- formats (Indian board patterns), paper generator, approval & printing,
-- co-scholastic grading.  Run AFTER school_schema.sql and
-- school_saas_migration.sql (PostgreSQL 15+).
--
-- Content note: chapter / topic structure is reference data. Question text
-- must be written by the school, generated as original drafts and reviewed,
-- or licensed — do not copy questions from publishers' books.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. BOARDS → TEXTBOOKS → CHAPTERS → TOPICS   (shared library, tenant_id NULL)
-- ---------------------------------------------------------------------
CREATE TABLE boards (
  board_id    SERIAL PRIMARY KEY,
  code        VARCHAR(20) UNIQUE NOT NULL,         -- CBSE, CISCE_ICSE, CISCE_ISC, IB_MYP, IB_DP, STATE_MH ...
  name        VARCHAR(120) NOT NULL,
  board_type  VARCHAR(15) NOT NULL CHECK (board_type IN ('NATIONAL','STATE','INTERNATIONAL')),
  state_name  VARCHAR(60),
  grade_from  INTEGER, grade_to INTEGER
);

-- Which board(s) a school follows, and for which grades (a school can run two)
CREATE TABLE school_boards (
  tenant_id  INTEGER NOT NULL REFERENCES tenants(tenant_id),
  board_id   INTEGER NOT NULL REFERENCES boards(board_id),
  grade_from INTEGER NOT NULL, grade_to INTEGER NOT NULL,
  affiliation_no VARCHAR(40),
  PRIMARY KEY (tenant_id, board_id)
);
ALTER TABLE classes  ADD COLUMN board_id INTEGER REFERENCES boards(board_id);
ALTER TABLE subjects ADD COLUMN board_subject_code VARCHAR(10);   -- e.g. CBSE 041 Mathematics Standard

CREATE TABLE textbooks (
  textbook_id   SERIAL PRIMARY KEY,
  board_id      INTEGER NOT NULL REFERENCES boards(board_id),
  grade_level   INTEGER NOT NULL,
  subject_name  VARCHAR(80) NOT NULL,
  subject_code  VARCHAR(10),
  title         VARCHAR(160) NOT NULL,
  publisher     VARCHAR(80),
  edition       VARCHAR(20),
  is_prescribed BOOLEAN DEFAULT TRUE,
  tenant_id     INTEGER REFERENCES tenants(tenant_id)   -- NULL = shared library; set = a school's own book
);

CREATE TABLE chapters (
  chapter_id  SERIAL PRIMARY KEY,
  textbook_id INTEGER NOT NULL REFERENCES textbooks(textbook_id) ON DELETE CASCADE,
  chapter_no  INTEGER NOT NULL,
  title       VARCHAR(160) NOT NULL,
  unit_name   VARCHAR(80),
  board_weightage INTEGER,                              -- marks in the board blueprint, if published
  UNIQUE (textbook_id, chapter_no)
);

CREATE TABLE topics (
  topic_id   SERIAL PRIMARY KEY,
  chapter_id INTEGER NOT NULL REFERENCES chapters(chapter_id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  title      VARCHAR(200) NOT NULL,
  learning_outcome VARCHAR(300)
);

-- ---------------------------------------------------------------------
-- 2. QUESTION BANK
-- ---------------------------------------------------------------------
CREATE TABLE questions (
  question_id      BIGSERIAL PRIMARY KEY,
  tenant_id        INTEGER REFERENCES tenants(tenant_id),     -- NULL = licensed shared library
  parent_id        BIGINT REFERENCES questions(question_id),  -- sub-parts of a case / source based question
  topic_id         INTEGER NOT NULL REFERENCES topics(topic_id),
  qtype            VARCHAR(20) NOT NULL CHECK (qtype IN
                     ('MCQ','ASSERTION_REASON','FILL_BLANK','TRUE_FALSE','MATCH','VSA','SA','LA',
                      'CASE_BASED','SOURCE_BASED','MAP','DIAGRAM')),
  marks            NUMERIC(4,1) NOT NULL,
  difficulty       VARCHAR(12) NOT NULL CHECK (difficulty IN ('EASY','INTERMEDIATE','TOUGH')),
  cognitive_level  VARCHAR(12) CHECK (cognitive_level IN ('REMEMBER','UNDERSTAND','APPLY','ANALYSE','EVALUATE','CREATE')),
  is_competency    BOOLEAN DEFAULT FALSE,                      -- CBSE competency-based question
  stem             TEXT NOT NULL,                              -- supports LaTeX / Markdown
  options          JSONB,                                      -- ["...","...","...","..."] for MCQ
  answer           TEXT,
  marking_scheme   TEXT,                                       -- step marks
  media_url        VARCHAR(255),
  language         VARCHAR(10) DEFAULT 'en',
  source           VARCHAR(12) NOT NULL DEFAULT 'TEACHER' CHECK (source IN ('TEACHER','AI_DRAFT','LICENSED','SCHOOL_ARCHIVE')),
  status           VARCHAR(12) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','IN_REVIEW','APPROVED','RETIRED')),
  created_by       INTEGER REFERENCES users(user_id),
  reviewed_by      INTEGER REFERENCES users(user_id),
  times_used       INTEGER DEFAULT 0,
  last_used_on     DATE,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_q_pick ON questions(topic_id, qtype, marks, difficulty) WHERE status = 'APPROVED';

-- ---------------------------------------------------------------------
-- 3. PAPER FORMATS (blueprints) — board patterns + school's own tests
-- ---------------------------------------------------------------------
CREATE TABLE paper_formats (
  format_id    SERIAL PRIMARY KEY,
  tenant_id    INTEGER REFERENCES tenants(tenant_id),   -- NULL = shared template
  board_id     INTEGER REFERENCES boards(board_id),
  code         VARCHAR(40) UNIQUE NOT NULL,
  name         VARCHAR(160) NOT NULL,
  grade_from   INTEGER, grade_to INTEGER,
  subject_code VARCHAR(10),
  total_marks  INTEGER NOT NULL,
  duration_min INTEGER NOT NULL,
  competency_target_pct INTEGER,
  general_instructions TEXT
);

CREATE TABLE paper_format_sections (
  format_id      INTEGER REFERENCES paper_formats(format_id) ON DELETE CASCADE,
  section_code   VARCHAR(5) NOT NULL,                  -- A, B, C ... or I, II
  line_no        INTEGER NOT NULL,                     -- one section can mix types (MCQ + Assertion-Reason)
  section_title  VARCHAR(120),
  qtype          VARCHAR(20) NOT NULL,
  question_count INTEGER NOT NULL,
  marks_each     NUMERIC(4,1) NOT NULL,
  attempt_count  INTEGER,                              -- e.g. ICSE "attempt any 4 of 6"; NULL = all
  internal_choices INTEGER DEFAULT 0,                  -- questions that get an OR alternative
  PRIMARY KEY (format_id, section_code, line_no)
);

-- ---------------------------------------------------------------------
-- 4. QUESTION PAPERS, SETS, APPROVAL, PRINTING
-- ---------------------------------------------------------------------
CREATE TABLE question_papers (
  paper_id        SERIAL PRIMARY KEY,
  tenant_id       INTEGER NOT NULL REFERENCES tenants(tenant_id),
  title           VARCHAR(160) NOT NULL,
  exam_type       VARCHAR(12) NOT NULL CHECK (exam_type IN ('UNIT_TEST','PERIODIC','HALF_YEARLY','ANNUAL','PRE_BOARD','SAMPLE','PRACTICE')),
  year_id         INTEGER REFERENCES academic_years(year_id),
  class_id        INTEGER REFERENCES classes(class_id),
  subject_id      INTEGER REFERENCES subjects(subject_id),
  textbook_id     INTEGER REFERENCES textbooks(textbook_id),
  format_id       INTEGER NOT NULL REFERENCES paper_formats(format_id),
  easy_pct        INTEGER NOT NULL DEFAULT 30,
  intermediate_pct INTEGER NOT NULL DEFAULT 50,
  tough_pct       INTEGER NOT NULL DEFAULT 20,
  avoid_used_within_days INTEGER DEFAULT 365,
  exam_date       DATE,
  set_count       INTEGER DEFAULT 1,
  status          VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN
                    ('DRAFT','SUBMITTED','CHANGES_REQUESTED','APPROVED','LOCKED','PRINTED')),
  created_by      INTEGER REFERENCES users(user_id),
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CHECK (easy_pct + intermediate_pct + tough_pct = 100)
);

CREATE TABLE paper_topics (
  paper_id INTEGER REFERENCES question_papers(paper_id) ON DELETE CASCADE,
  topic_id INTEGER REFERENCES topics(topic_id),
  PRIMARY KEY (paper_id, topic_id)
);

CREATE TABLE paper_sets (
  set_id   SERIAL PRIMARY KEY,
  paper_id INTEGER NOT NULL REFERENCES question_papers(paper_id) ON DELETE CASCADE,
  set_code VARCHAR(2) NOT NULL,                       -- A, B, C
  UNIQUE (paper_id, set_code)
);

CREATE TABLE paper_questions (
  set_id       INTEGER REFERENCES paper_sets(set_id) ON DELETE CASCADE,
  q_no         INTEGER NOT NULL,
  section_code VARCHAR(5) NOT NULL,
  question_id  BIGINT NOT NULL REFERENCES questions(question_id),
  marks        NUMERIC(4,1) NOT NULL,
  or_question_id BIGINT REFERENCES questions(question_id),   -- internal choice
  PRIMARY KEY (set_id, q_no)
);

CREATE TABLE paper_approvals (
  approval_id BIGSERIAL PRIMARY KEY,
  paper_id    INTEGER NOT NULL REFERENCES question_papers(paper_id) ON DELETE CASCADE,
  action      VARCHAR(20) NOT NULL CHECK (action IN ('SUBMIT','REQUEST_CHANGES','APPROVE','LOCK','UNLOCK')),
  acted_by    INTEGER REFERENCES users(user_id),
  comment     TEXT,
  acted_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE paper_prints (
  print_id     BIGSERIAL PRIMARY KEY,
  paper_id     INTEGER NOT NULL REFERENCES question_papers(paper_id),
  set_id       INTEGER REFERENCES paper_sets(set_id),
  copies       INTEGER NOT NULL,
  with_answer_key BOOLEAN DEFAULT FALSE,
  watermark    VARCHAR(60) DEFAULT 'CONFIDENTIAL',
  printed_by   INTEGER REFERENCES users(user_id),
  printed_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- 5. CO-SCHOLASTIC
-- ---------------------------------------------------------------------
CREATE TABLE grade_scales (
  scale_code VARCHAR(12) NOT NULL,                     -- 3POINT, 5POINT
  grade      VARCHAR(3) NOT NULL,
  label      VARCHAR(40),
  sort_order INTEGER,
  PRIMARY KEY (scale_code, grade)
);

CREATE TABLE coscholastic_areas (
  area_id    SERIAL PRIMARY KEY,
  tenant_id  INTEGER REFERENCES tenants(tenant_id),    -- NULL = board default
  board_id   INTEGER REFERENCES boards(board_id),
  code       VARCHAR(20) NOT NULL,
  name       VARCHAR(80) NOT NULL,
  grade_from INTEGER, grade_to INTEGER,
  scale_code VARCHAR(12) NOT NULL
);

CREATE TABLE coscholastic_grades (
  enrollment_id INTEGER NOT NULL REFERENCES enrollments(enrollment_id),
  area_id       INTEGER NOT NULL REFERENCES coscholastic_areas(area_id),
  term_no       INTEGER NOT NULL CHECK (term_no IN (1,2)),
  grade         VARCHAR(3) NOT NULL,
  remark        VARCHAR(200),
  graded_by     INTEGER REFERENCES users(user_id),
  graded_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  tenant_id     INTEGER NOT NULL REFERENCES tenants(tenant_id),
  PRIMARY KEY (enrollment_id, area_id, term_no)
);

-- ---------------------------------------------------------------------
-- 6. ROW-LEVEL SECURITY
--    School-owned rows: tenant_id = app.tenant_id.
--    Shared library rows (tenant_id NULL) are readable by every school, writable by none.
-- ---------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['textbooks','questions','paper_formats','coscholastic_areas'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY shared_or_own ON %I
      USING (tenant_id IS NULL OR tenant_id = current_setting('app.tenant_id', true)::int)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::int)$p$, t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['question_papers','coscholastic_grades','school_boards'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY tenant_isolation ON %I
      USING (tenant_id = current_setting('app.tenant_id', true)::int)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::int)$p$, t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 7. PAPER GENERATOR
--    For each blueprint line: split the question count across Easy /
--    Intermediate / Tough by the paper's percentages, pick approved
--    questions from the selected topics (least used first, not used in
--    the last N days, never repeated within the set), then top up from
--    any difficulty if the bank runs short. Returns shortfalls.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_paper_set(p_paper_id INTEGER, p_set_code VARCHAR DEFAULT 'A')
RETURNS TABLE (section_code VARCHAR, qtype VARCHAR, needed INTEGER, picked INTEGER)
LANGUAGE plpgsql AS $$
DECLARE
  p      question_papers%ROWTYPE;
  s      RECORD;
  v_set  INTEGER;
  v_qno  INTEGER := 0;
  n_e INTEGER; n_t INTEGER; n_i INTEGER; got INTEGER;
  d      TEXT;
  want   INTEGER;
BEGIN
  SELECT * INTO p FROM question_papers WHERE paper_id = p_paper_id;
  INSERT INTO paper_sets (paper_id, set_code) VALUES (p_paper_id, p_set_code)
  ON CONFLICT (paper_id, set_code) DO UPDATE SET set_code = EXCLUDED.set_code
  RETURNING set_id INTO v_set;
  DELETE FROM paper_questions WHERE set_id = v_set;

  FOR s IN SELECT * FROM paper_format_sections f WHERE f.format_id = p.format_id ORDER BY f.section_code, f.line_no LOOP
    n_e := round(s.question_count * p.easy_pct / 100.0);
    n_t := round(s.question_count * p.tough_pct / 100.0);
    n_i := GREATEST(s.question_count - n_e - n_t, 0);
    got := 0;
    FOREACH d IN ARRAY ARRAY['EASY','INTERMEDIATE','TOUGH','ANY'] LOOP
      want := CASE d WHEN 'EASY' THEN n_e WHEN 'INTERMEDIATE' THEN n_i WHEN 'TOUGH' THEN n_t
                     ELSE s.question_count - got END;
      CONTINUE WHEN want <= 0;
      WITH pick AS (
        SELECT q.question_id, q.marks FROM questions q
        JOIN paper_topics pt ON pt.paper_id = p.paper_id AND pt.topic_id = q.topic_id
        WHERE q.status = 'APPROVED' AND q.parent_id IS NULL
          AND q.qtype = s.qtype AND q.marks = s.marks_each
          AND (d = 'ANY' OR q.difficulty = d)
          AND (q.tenant_id IS NULL OR q.tenant_id = p.tenant_id)
          AND (q.last_used_on IS NULL OR q.last_used_on < CURRENT_DATE - p.avoid_used_within_days OR d = 'ANY')
          AND NOT EXISTS (SELECT 1 FROM paper_questions x WHERE x.set_id = v_set AND x.question_id = q.question_id)
          AND (d = 'ANY' OR NOT EXISTS (SELECT 1 FROM paper_questions x JOIN paper_sets o ON o.set_id = x.set_id
                                         WHERE o.paper_id = p.paper_id AND o.set_id <> v_set AND x.question_id = q.question_id))
        ORDER BY q.times_used, random()
        LIMIT want
      ), numbered AS (
        SELECT question_id, marks, row_number() OVER () AS rn FROM pick
      )
      INSERT INTO paper_questions (set_id, q_no, section_code, question_id, marks)
      SELECT v_set, v_qno + rn, s.section_code, question_id, marks FROM numbered;
      GET DIAGNOSTICS want = ROW_COUNT;
      v_qno := v_qno + want;
      got := got + want;
    END LOOP;
    section_code := s.section_code; qtype := s.qtype; needed := s.question_count; picked := got;
    RETURN NEXT;
  END LOOP;
END $$;

-- Paper statistics: achieved difficulty mix (by marks), competency share, chapter coverage
CREATE VIEW v_paper_stats WITH (security_invoker = true) AS
SELECT ps.paper_id, ps.set_code,
       SUM(pq.marks)                                                     AS total_marks,
       ROUND(100.0 * SUM(pq.marks) FILTER (WHERE q.difficulty = 'EASY') / NULLIF(SUM(pq.marks),0))         AS easy_pct,
       ROUND(100.0 * SUM(pq.marks) FILTER (WHERE q.difficulty = 'INTERMEDIATE') / NULLIF(SUM(pq.marks),0)) AS intermediate_pct,
       ROUND(100.0 * SUM(pq.marks) FILTER (WHERE q.difficulty = 'TOUGH') / NULLIF(SUM(pq.marks),0))        AS tough_pct,
       ROUND(100.0 * SUM(pq.marks) FILTER (WHERE q.is_competency) / NULLIF(SUM(pq.marks),0))               AS competency_pct,
       COUNT(DISTINCT t.chapter_id)                                      AS chapters_covered
FROM paper_sets ps
JOIN paper_questions pq ON pq.set_id = ps.set_id
JOIN questions q ON q.question_id = pq.question_id
JOIN topics t ON t.topic_id = q.topic_id
GROUP BY ps.paper_id, ps.set_code;

-- When a paper is locked, mark its questions as used
CREATE OR REPLACE FUNCTION trg_paper_locked() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'LOCKED' AND OLD.status IS DISTINCT FROM 'LOCKED' THEN
    UPDATE questions q SET times_used = times_used + 1, last_used_on = COALESCE(NEW.exam_date, CURRENT_DATE)
    WHERE q.question_id IN (SELECT pq.question_id FROM paper_questions pq JOIN paper_sets s ON s.set_id = pq.set_id WHERE s.paper_id = NEW.paper_id);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER paper_locked AFTER UPDATE OF status ON question_papers FOR EACH ROW EXECUTE FUNCTION trg_paper_locked();

-- ---------------------------------------------------------------------
-- 8. SEED: boards, formats, co-scholastic scales, a sample textbook
-- ---------------------------------------------------------------------
INSERT INTO boards (code, name, board_type, state_name, grade_from, grade_to) VALUES
 ('CBSE',       'Central Board of Secondary Education',                'NATIONAL',      NULL, 1, 12),
 ('CISCE_ICSE', 'CISCE — ICSE (Class 10)',                              'NATIONAL',      NULL, 1, 10),
 ('CISCE_ISC',  'CISCE — ISC (Class 12)',                               'NATIONAL',      NULL, 11, 12),
 ('IB_PYP',     'International Baccalaureate — Primary Years',          'INTERNATIONAL', NULL, 1, 5),
 ('IB_MYP',     'International Baccalaureate — Middle Years',           'INTERNATIONAL', NULL, 6, 10),
 ('IB_DP',      'International Baccalaureate — Diploma',                'INTERNATIONAL', NULL, 11, 12),
 ('STATE_MH',   'Maharashtra State Board',                              'STATE', 'Maharashtra', 1, 12),
 ('STATE_KA',   'Karnataka State Board',                                'STATE', 'Karnataka', 1, 12),
 ('STATE_TN',   'Tamil Nadu State Board',                               'STATE', 'Tamil Nadu', 1, 12),
 ('STATE_TS',   'Telangana State Board',                                'STATE', 'Telangana', 1, 12),
 ('STATE_AP',   'Andhra Pradesh State Board',                           'STATE', 'Andhra Pradesh', 1, 12);

INSERT INTO paper_formats (board_id, code, name, grade_from, grade_to, subject_code, total_marks, duration_min, competency_target_pct, general_instructions)
SELECT b.board_id, v.code, v.name, v.gf, v.gt, v.sc, v.tm, v.dur, v.comp, v.instr
FROM (VALUES
 ('CBSE','CBSE_X_MATHS_STD','CBSE Class X Mathematics (Standard) — board pattern',10,10,'041',80,180,50,
  'This paper has 38 questions in five sections A–E. Section A: 20 MCQs of 1 mark. Section B: 5 questions of 2 marks. Section C: 6 questions of 3 marks. Section D: 4 questions of 5 marks. Section E: 3 case-based units of 4 marks. All questions are compulsory; internal choice is given in some questions.'),
 ('CBSE','CBSE_X_SCIENCE','CBSE Class X Science — board pattern',10,10,'086',80,180,50,
  'This paper has 39 questions in five sections A–E. All questions are compulsory; internal choice is given in some questions.'),
 ('CISCE_ICSE','ICSE_X_80','ICSE Class X — two-section paper (80 marks)',10,10,NULL,80,120,NULL,
  'Section A is compulsory. Attempt any four questions from Section B. The intended marks for questions or parts of questions are given in brackets [ ].'),
 ('CBSE','SCHOOL_UNIT_TEST_25','Unit test — 25 marks (school format)',3,10,NULL,25,45,30,
  'All questions are compulsory.'),
 ('CBSE','SCHOOL_PERIODIC_40','Periodic test — 40 marks (school format)',6,10,NULL,40,90,40,
  'All questions are compulsory. Internal choice is given in some questions.')
) AS v(board, code, name, gf, gt, sc, tm, dur, comp, instr)
JOIN boards b ON b.code = v.board;

INSERT INTO paper_format_sections (format_id, section_code, line_no, section_title, qtype, question_count, marks_each, attempt_count, internal_choices)
SELECT f.format_id, v.sec, v.ln, v.title, v.qtype, v.cnt, v.mk, v.att, v.oc
FROM (VALUES
 ('CBSE_X_MATHS_STD','A',1,'Section A — Multiple choice','MCQ',18,1,NULL,0),
 ('CBSE_X_MATHS_STD','A',2,'Section A — Assertion & Reason','ASSERTION_REASON',2,1,NULL,0),
 ('CBSE_X_MATHS_STD','B',1,'Section B — Very short answer','VSA',5,2,NULL,2),
 ('CBSE_X_MATHS_STD','C',1,'Section C — Short answer','SA',6,3,NULL,2),
 ('CBSE_X_MATHS_STD','D',1,'Section D — Long answer','LA',4,5,NULL,2),
 ('CBSE_X_MATHS_STD','E',1,'Section E — Case based','CASE_BASED',3,4,NULL,3),
 ('CBSE_X_SCIENCE','A',1,'Section A — Multiple choice','MCQ',16,1,NULL,0),
 ('CBSE_X_SCIENCE','A',2,'Section A — Assertion & Reason','ASSERTION_REASON',4,1,NULL,0),
 ('CBSE_X_SCIENCE','B',1,'Section B — Very short answer','VSA',6,2,NULL,2),
 ('CBSE_X_SCIENCE','C',1,'Section C — Short answer','SA',7,3,NULL,2),
 ('CBSE_X_SCIENCE','D',1,'Section D — Long answer','LA',3,5,NULL,3),
 ('CBSE_X_SCIENCE','E',1,'Section E — Case based','CASE_BASED',3,4,NULL,3),
 ('ICSE_X_80','A',1,'Section A — compulsory (objective & short)','MCQ',15,1,NULL,0),
 ('ICSE_X_80','A',2,'Section A — compulsory (very short)','VSA',5,3,NULL,0),
 ('ICSE_X_80','A',3,'Section A — compulsory (short)','SA',5,2,NULL,0),
 ('ICSE_X_80','B',1,'Section B — attempt any four','LA',6,10,4,0),
 ('SCHOOL_PERIODIC_40','A',1,'Section A — Objective','MCQ',10,1,NULL,0),
 ('SCHOOL_PERIODIC_40','B',1,'Section B — Very short answer','VSA',5,2,NULL,1),
 ('SCHOOL_PERIODIC_40','C',1,'Section C — Short answer','SA',4,3,NULL,1),
 ('SCHOOL_PERIODIC_40','D',1,'Section D — Long answer','LA',1,5,NULL,1),
 ('SCHOOL_PERIODIC_40','E',1,'Section E — Case based','CASE_BASED',1,3,NULL,0),
 ('SCHOOL_UNIT_TEST_25','A',1,'Section A — Objective','MCQ',5,1,NULL,0),
 ('SCHOOL_UNIT_TEST_25','B',1,'Section B — Very short answer','VSA',5,2,NULL,1),
 ('SCHOOL_UNIT_TEST_25','C',1,'Section C — Long answer','LA',2,5,NULL,1)
) AS v(fmt, sec, ln, title, qtype, cnt, mk, att, oc)
JOIN paper_formats f ON f.code = v.fmt;

-- Co-scholastic grading scales and CBSE default areas
INSERT INTO grade_scales VALUES
 ('3POINT','A','Outstanding',1), ('3POINT','B','Very good',2), ('3POINT','C','Fair',3),
 ('5POINT','A','Outstanding',1), ('5POINT','B','Excellent',2), ('5POINT','C','Very good',3),
 ('5POINT','D','Good',4), ('5POINT','E','Needs improvement',5);

INSERT INTO coscholastic_areas (board_id, code, name, grade_from, grade_to, scale_code)
SELECT b.board_id, v.code, v.name, v.gf, v.gt, v.sc
FROM boards b CROSS JOIN (VALUES
 ('WORK_EDU','Work Education',1,8,'3POINT'), ('ART_EDU','Art Education',1,8,'3POINT'),
 ('HPE','Health & Physical Education',1,8,'3POINT'), ('DISCIPLINE','Discipline',1,8,'3POINT'),
 ('WORK_EDU_SR','Work Education',9,10,'5POINT'), ('ART_EDU_SR','Art Education',9,10,'5POINT'),
 ('HPE_SR','Health & Physical Education',9,10,'5POINT'), ('DISCIPLINE_SR','Discipline',9,10,'5POINT')
) AS v(code, name, gf, gt, sc)
WHERE b.code = 'CBSE';

-- Sample shared textbook: chapter list for NCERT Mathematics, Class X (CBSE)
INSERT INTO textbooks (board_id, grade_level, subject_name, subject_code, title, publisher, edition)
SELECT board_id, 10, 'Mathematics', '041', 'Mathematics — Textbook for Class X', 'NCERT', '2026-27'
FROM boards WHERE code = 'CBSE';

INSERT INTO chapters (textbook_id, chapter_no, title, unit_name)
SELECT t.textbook_id, v.no, v.title, v.unit FROM textbooks t CROSS JOIN (VALUES
 (1,'Real Numbers','Number Systems'), (2,'Polynomials','Algebra'), (3,'Pair of Linear Equations in Two Variables','Algebra'),
 (4,'Quadratic Equations','Algebra'), (5,'Arithmetic Progressions','Algebra'), (6,'Triangles','Geometry'),
 (7,'Coordinate Geometry','Coordinate Geometry'), (8,'Introduction to Trigonometry','Trigonometry'),
 (9,'Some Applications of Trigonometry','Trigonometry'), (10,'Circles','Geometry'),
 (11,'Areas Related to Circles','Mensuration'), (12,'Surface Areas and Volumes','Mensuration'),
 (13,'Statistics','Statistics & Probability'), (14,'Probability','Statistics & Probability')
) AS v(no, title, unit)
WHERE t.title = 'Mathematics — Textbook for Class X';

INSERT INTO topics (chapter_id, sort_order, title)
SELECT c.chapter_id, v.ord, v.title FROM chapters c JOIN (VALUES
 (1,1,'Fundamental Theorem of Arithmetic'), (1,2,'HCF and LCM by prime factorisation'), (1,3,'Proving irrationality'),
 (2,1,'Zeroes of a polynomial'), (2,2,'Relation between zeroes and coefficients'),
 (3,1,'Graphical method'), (3,2,'Substitution and elimination'), (3,3,'Consistency of a pair of equations'),
 (4,1,'Solving by factorisation'), (4,2,'Nature of roots'), (4,3,'Word problems'),
 (5,1,'nth term of an AP'), (5,2,'Sum of first n terms'),
 (6,1,'Similar figures'), (6,2,'Basic proportionality theorem'), (6,3,'Criteria for similarity'),
 (7,1,'Distance formula'), (7,2,'Section formula'),
 (8,1,'Trigonometric ratios'), (8,2,'Ratios of specific angles'), (8,3,'Trigonometric identities'),
 (9,1,'Heights and distances'),
 (10,1,'Tangent to a circle'), (10,2,'Number of tangents from a point'),
 (11,1,'Area of sector and segment'),
 (12,1,'Surface area of combined solids'), (12,2,'Volume of combined solids'),
 (13,1,'Mean of grouped data'), (13,2,'Mode and median of grouped data'),
 (14,1,'Theoretical probability')
) AS v(ch, ord, title) ON c.chapter_no = v.ch
JOIN textbooks t ON t.textbook_id = c.textbook_id AND t.title = 'Mathematics — Textbook for Class X';

-- ---------------------------------------------------------------------
-- 9. MENUS, FEATURES, PLANS, PERMISSIONS
-- ---------------------------------------------------------------------
INSERT INTO menus (code, label, route, icon, sort_order) VALUES ('EXAMS','Exams',NULL,'clipboard',5);
INSERT INTO menus (parent_id, code, label, route, sort_order)
SELECT m.menu_id, v.code, v.label, v.route, v.ord FROM menus m JOIN (VALUES
 ('EXAMS','EXM_QP','Question Papers','/exams/papers',1),
 ('EXAMS','EXM_APPROVED','Approved Papers','/exams/approved',2),
 ('EXAMS','EXM_QB','Question Bank','/exams/bank',3),
 ('EXAMS','EXM_FORMATS','Paper Formats','/exams/formats',4),
 ('EXAMS','EXM_COSCH','Co-Scholastic','/exams/co-scholastic',5),
 ('ACADEMICS','ACA_SYLLABUS','Boards, Syllabus & Textbooks','/academics/syllabus',4)
) AS v(parent, code, label, route, ord) ON m.code = v.parent;

INSERT INTO features (code, name, kind, menu_id, sort_order)
SELECT code, label, 'MODULE', menu_id, sort_order FROM menus WHERE code = 'EXAMS';
INSERT INTO features (parent_id, code, name, kind, menu_id, sort_order)
SELECT pf.feature_id, m.code, m.label, 'SUBMENU', m.menu_id, m.sort_order
FROM menus m JOIN menus pm ON pm.menu_id = m.parent_id JOIN features pf ON pf.code = pm.code
WHERE m.code IN ('EXM_QP','EXM_APPROVED','EXM_QB','EXM_FORMATS','EXM_COSCH','ACA_SYLLABUS');
INSERT INTO features (parent_id, code, name, kind, is_addon_eligible, sort_order)
SELECT f.feature_id, v.code, v.name, 'FUNCTION', TRUE, 100 + v.ord FROM features f JOIN (VALUES
 ('EXAMS','FN_AUTO_GENERATE','Auto-generate paper from topics & difficulty',1),
 ('EXAMS','FN_MULTI_SETS','Multiple sets (A / B / C) & shuffling',2),
 ('EXAMS','FN_SAMPLE_PAPERS','Sample & practice papers',3),
 ('EXAMS','FN_BOARD_LIBRARY','Board syllabus & textbook library',4),
 ('EXAMS','FN_AI_QUESTIONS','AI-drafted questions (teacher review)',5),
 ('EXAMS','FN_LICENSED_BANK','Licensed question library',6)
) AS v(module, code, name, ord) ON f.code = v.module;

INSERT INTO plan_features (plan_id, feature_id)
SELECT p.plan_id, f.feature_id FROM features f JOIN (VALUES
 ('EXAMS',1),('EXM_QP',1),('EXM_APPROVED',1),('EXM_QB',1),('EXM_FORMATS',1),('EXM_COSCH',1),('ACA_SYLLABUS',1),
 ('FN_AUTO_GENERATE',2),('FN_MULTI_SETS',2),('FN_SAMPLE_PAPERS',2),('FN_BOARD_LIBRARY',2),
 ('FN_AI_QUESTIONS',3),('FN_LICENSED_BANK',4)
) AS v(code, min_rank) ON f.code = v.code
JOIN plans p ON p.tier_rank >= v.min_rank;

-- Teachers write questions and draft papers; Principal approves; Admin everything
INSERT INTO role_menu_permissions (role_id, menu_id, can_view, can_create, can_edit, can_delete, can_approve, data_scope)
SELECT r.role_id, m.menu_id, TRUE,
       CASE WHEN r.code = 'ADMIN' THEN TRUE WHEN r.code = 'TEACHER' THEN m.code IN ('EXM_QP','EXM_QB','EXM_COSCH') ELSE FALSE END,
       CASE WHEN r.code = 'ADMIN' THEN TRUE WHEN r.code = 'TEACHER' THEN m.code IN ('EXM_QP','EXM_QB','EXM_COSCH') ELSE FALSE END,
       r.code = 'ADMIN',
       r.code IN ('ADMIN','PRINCIPAL') AND m.code IN ('EXM_QP','EXM_QB'),
       CASE WHEN r.code = 'TEACHER' AND m.code = 'EXM_COSCH' THEN 'OWN_CLASS' ELSE 'ALL' END
FROM roles r JOIN menus m ON m.code IN ('EXAMS','EXM_QP','EXM_APPROVED','EXM_QB','EXM_FORMATS','EXM_COSCH','ACA_SYLLABUS')
WHERE r.code IN ('ADMIN','PRINCIPAL')
   OR (r.code = 'TEACHER' AND m.code IN ('EXAMS','EXM_QP','EXM_APPROVED','EXM_QB','EXM_COSCH','ACA_SYLLABUS'));
