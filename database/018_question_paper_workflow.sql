-- =====================================================================
-- 018  Question papers: exams and their timetable, blueprints, topic-driven sets, approval per set
--      - exams, exam_schedule: each exam's class × subject papers with date and start time
--      - paper_formats become blueprints: exam kind, chapter rule, archive; a section line can allow several
--        question types (allowed_qtypes) and an internal choice (OR)
--      - question_papers: exam, schedule entry, chosen set, start time, "update automatically"
--      - paper_sets: up to 10 per paper, each with its own status DRAFT → SUBMITTED → APPROVED / SENT_BACK
--      - paper_questions: locked questions (kept when regenerating), per-paper edits
--      - paper_versions (for undo and history), paper_views (who opened a confidential paper)
--      - generate_topic_set(): fills a set ONLY from the paper's chosen topics, avoiding other sets' questions,
--        following the difficulty mix and spreading across topics; locked questions stay if their topic is chosen
--      - set_paper_topics(): changing the topics rebuilds the draft sets when "update automatically" is on
--      - v_paper_topic_availability: what the chosen topics hold for each blueprint section
--      - decide_paper_set(), choose_exam_set(): approval rules and the set for the exam
--      Run after 001–017.
-- =====================================================================

CREATE TABLE exams (
  exam_id    SERIAL PRIMARY KEY,
  tenant_id  INTEGER NOT NULL REFERENCES tenants(tenant_id),
  name       VARCHAR(80) NOT NULL,                       -- Unit Test 2, Half-yearly Examination …
  exam_kind  VARCHAR(12) NOT NULL,                       -- PT1, HY, UT2, UT3, ANNUAL …
  starts_on  DATE NOT NULL,
  UNIQUE (tenant_id, name)
);
CREATE TABLE exam_schedule (
  schedule_id SERIAL PRIMARY KEY,
  tenant_id   INTEGER NOT NULL REFERENCES tenants(tenant_id),
  exam_id     INTEGER NOT NULL REFERENCES exams(exam_id) ON DELETE CASCADE,
  grade       INTEGER NOT NULL,
  subject     VARCHAR(60) NOT NULL,
  exam_date   DATE NOT NULL,
  start_time  TIME NOT NULL DEFAULT '09:00',
  UNIQUE (exam_id, grade, subject)
);

ALTER TABLE paper_formats
  ADD COLUMN exam_kind    VARCHAR(12),
  ADD COLUMN chapter_rule VARCHAR(16) NOT NULL DEFAULT 'CHOSEN' CHECK (chapter_rule IN
    ('T1_THIRD','T1_TWO_THIRDS','T1_ALL','T2_THIRD','T2_MIDDLE','T2_TWO_THIRDS','T2_ALL','T1_T2_THIRD','ALL','CHOSEN')),
  ADD COLUMN archived     BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE paper_format_sections ADD COLUMN allowed_qtypes TEXT[];   -- several types in one section line (NULL = qtype only)

ALTER TABLE chapters ADD COLUMN term SMALLINT CHECK (term IN (1, 2));

ALTER TABLE question_papers
  ADD COLUMN exam_id      INTEGER REFERENCES exams(exam_id),
  ADD COLUMN schedule_id  INTEGER REFERENCES exam_schedule(schedule_id),
  ADD COLUMN chosen_set_id INTEGER,
  ADD COLUMN auto_update  BOOLEAN NOT NULL DEFAULT TRUE;
CREATE UNIQUE INDEX question_papers_one_per_schedule ON question_papers (schedule_id) WHERE schedule_id IS NOT NULL;

ALTER TABLE paper_sets
  ADD COLUMN set_no       INTEGER,
  ADD COLUMN status       VARCHAR(10) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','SUBMITTED','APPROVED','SENT_BACK')),
  ADD COLUMN submitted_by INTEGER REFERENCES users(user_id),
  ADD COLUMN decided_by   INTEGER REFERENCES users(user_id),
  ADD COLUMN note         TEXT;
ALTER TABLE question_papers ADD CONSTRAINT question_papers_chosen_set_fk FOREIGN KEY (chosen_set_id) REFERENCES paper_sets(set_id);

ALTER TABLE paper_questions
  ADD COLUMN locked       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN edited_stem  TEXT,                          -- changed for this paper only; the bank keeps the original
  ADD COLUMN edited_marks NUMERIC(4,1);

CREATE TABLE paper_versions (
  version_id BIGSERIAL PRIMARY KEY,
  paper_id   INTEGER NOT NULL REFERENCES question_papers(paper_id) ON DELETE CASCADE,
  label      VARCHAR(80) NOT NULL,
  created_by INTEGER REFERENCES users(user_id),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  snapshot   JSONB NOT NULL                              -- topics + every set's questions before the change
);
CREATE TABLE paper_views (
  paper_id  INTEGER NOT NULL REFERENCES question_papers(paper_id) ON DELETE CASCADE,
  user_id   INTEGER NOT NULL REFERENCES users(user_id),
  viewed_on DATE NOT NULL DEFAULT CURRENT_DATE,
  first_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (paper_id, user_id, viewed_on)
);

DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['exams', 'exam_schedule'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (tenant_id = current_setting(''app.tenant_id'', true)::int) WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true)::int)', t);
  END LOOP;
END $$;

-- Who may approve paper sets: Principal, Admin, or a senior academic designation
CREATE OR REPLACE FUNCTION can_approve_papers(p_user INTEGER) RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.role_id = ur.role_id WHERE ur.user_id = p_user AND r.code IN ('PRINCIPAL', 'ADMIN'))
      OR EXISTS (SELECT 1 FROM users u JOIN designations d ON d.designation_id = u.designation_id
                 WHERE u.user_id = p_user AND d.name IN ('Vice Principal', 'Head of Teaching Staff', 'Head of Department', 'Academic Director', 'Coordinator'));
$$;

-- Snapshot before a change (Undo restores the latest)
CREATE OR REPLACE FUNCTION snapshot_paper(p_paper INTEGER, p_label VARCHAR, p_by INTEGER) RETURNS BIGINT LANGUAGE sql AS $$
  INSERT INTO paper_versions (paper_id, label, created_by, snapshot)
  SELECT p_paper, p_label, p_by, jsonb_build_object(
    'topics', COALESCE((SELECT jsonb_agg(topic_id ORDER BY topic_id) FROM paper_topics WHERE paper_id = p_paper), '[]'::jsonb),
    'sets', COALESCE((SELECT jsonb_agg(jsonb_build_object('set_id', s.set_id, 'questions',
              COALESCE((SELECT jsonb_agg(to_jsonb(q) - 'set_id' ORDER BY q.q_no) FROM paper_questions q WHERE q.set_id = s.set_id), '[]'::jsonb)) ORDER BY s.set_no)
            FROM paper_sets s WHERE s.paper_id = p_paper), '[]'::jsonb))
  RETURNING version_id;
$$;

-- Fill a set from the paper's chosen topics only.
--  * Locked questions stay if their topic is still chosen; everything else is picked again.
--  * Each blueprint section line takes questions of its allowed types and marks.
--  * Difficulty follows the paper's mix; ties go to the least-used topic on this set, then the least-used question.
--  * Questions on the paper's other sets are only used when the chosen topics run out.
--  * Section lines with internal_choices get an OR question of the same kind.
CREATE OR REPLACE FUNCTION generate_topic_set(p_set INTEGER) RETURNS TABLE (section_code VARCHAR, needed INTEGER, picked INTEGER)
LANGUAGE plpgsql AS $$
DECLARE
  st paper_sets%ROWTYPE; p question_papers%ROWTYPE; s RECORD;
  v_qno INTEGER; k INTEGER; v_diff TEXT; v_q BIGINT; v_or BIGINT; v_types TEXT[]; n_e INTEGER; n_t INTEGER; got INTEGER; ors INTEGER;
BEGIN
  SELECT * INTO st FROM paper_sets WHERE set_id = p_set;
  IF st.status NOT IN ('DRAFT', 'SENT_BACK') THEN RAISE EXCEPTION 'Set % is % — only a draft can be regenerated', st.set_no, lower(st.status); END IF;
  SELECT * INTO p FROM question_papers WHERE paper_id = st.paper_id;
  -- drop unlocked questions, and locked ones whose topic is no longer chosen
  DELETE FROM paper_questions pq WHERE pq.set_id = p_set AND (NOT pq.locked OR NOT EXISTS (
    SELECT 1 FROM questions q JOIN paper_topics t ON t.topic_id = q.topic_id AND t.paper_id = p.paper_id WHERE q.question_id = pq.question_id));
  SELECT COALESCE(max(q_no), 0) INTO v_qno FROM paper_questions WHERE set_id = p_set;
  FOR s IN SELECT f.* FROM paper_format_sections f WHERE f.format_id = p.format_id ORDER BY f.section_code, f.line_no LOOP
    v_types := COALESCE(s.allowed_qtypes, ARRAY[s.qtype]);
    n_e := round(s.question_count * p.easy_pct / 100.0); n_t := round(s.question_count * p.tough_pct / 100.0);
    SELECT count(*) INTO got FROM paper_questions pq WHERE pq.set_id = p_set AND pq.section_code = s.section_code AND pq.locked;
    ors := s.internal_choices;
    FOR k IN got + 1 .. s.question_count LOOP
      v_diff := CASE WHEN k <= n_e THEN 'EASY' WHEN k > s.question_count - n_t THEN 'TOUGH' ELSE 'INTERMEDIATE' END;
      SELECT q.question_id INTO v_q FROM questions q
        JOIN paper_topics t ON t.topic_id = q.topic_id AND t.paper_id = p.paper_id
       WHERE q.status = 'APPROVED' AND q.parent_id IS NULL AND q.qtype = ANY (v_types) AND q.marks = s.marks_each
         AND (q.tenant_id IS NULL OR q.tenant_id = p.tenant_id)
         AND NOT EXISTS (SELECT 1 FROM paper_questions x WHERE x.set_id = p_set AND (x.question_id = q.question_id OR x.or_question_id = q.question_id))
       ORDER BY
         EXISTS (SELECT 1 FROM paper_questions x JOIN paper_sets o ON o.set_id = x.set_id
                 WHERE o.paper_id = p.paper_id AND o.set_id <> p_set AND (x.question_id = q.question_id OR x.or_question_id = q.question_id)),
         (q.difficulty <> v_diff),
         (SELECT count(*) FROM paper_questions x JOIN questions y ON y.question_id = x.question_id WHERE x.set_id = p_set AND y.topic_id = q.topic_id),
         q.times_used, random()
       LIMIT 1;
      EXIT WHEN v_q IS NULL;
      v_or := NULL;
      IF ors > 0 THEN
        SELECT q.question_id INTO v_or FROM questions q JOIN paper_topics t ON t.topic_id = q.topic_id AND t.paper_id = p.paper_id
         WHERE q.status = 'APPROVED' AND q.parent_id IS NULL AND q.qtype = ANY (v_types) AND q.marks = s.marks_each AND q.question_id <> v_q
           AND NOT EXISTS (SELECT 1 FROM paper_questions x WHERE x.set_id = p_set AND (x.question_id = q.question_id OR x.or_question_id = q.question_id))
         ORDER BY (q.topic_id = (SELECT topic_id FROM questions WHERE question_id = v_q)), q.times_used, random() LIMIT 1;
        ors := ors - 1;
      END IF;
      v_qno := v_qno + 1;
      INSERT INTO paper_questions (set_id, q_no, section_code, question_id, marks, or_question_id)
      SELECT p_set, v_qno, s.section_code, v_q, marks, v_or FROM questions WHERE question_id = v_q;
      got := got + 1; v_q := NULL;
    END LOOP;
    section_code := s.section_code; needed := s.question_count; picked := got;
    RETURN NEXT;
  END LOOP;
END $$;

-- Change the topics; with "update automatically" the draft sets are rebuilt from the new topics
CREATE OR REPLACE FUNCTION set_paper_topics(p_paper INTEGER, p_topics INTEGER[], p_by INTEGER) RETURNS INTEGER
LANGUAGE plpgsql AS $$
DECLARE v_auto BOOLEAN; s RECORD; n INTEGER := 0;
BEGIN
  PERFORM snapshot_paper(p_paper, 'Topics changed', p_by);
  DELETE FROM paper_topics WHERE paper_id = p_paper;
  INSERT INTO paper_topics (paper_id, topic_id) SELECT p_paper, unnest(p_topics) ON CONFLICT DO NOTHING;
  SELECT auto_update INTO v_auto FROM question_papers WHERE paper_id = p_paper;
  IF v_auto THEN
    FOR s IN SELECT set_id FROM paper_sets WHERE paper_id = p_paper AND status IN ('DRAFT', 'SENT_BACK') ORDER BY set_no LOOP
      PERFORM generate_topic_set(s.set_id); n := n + 1;
    END LOOP;
  END IF;
  RETURN n;   -- sets rebuilt
END $$;

-- What the chosen topics hold for each blueprint section line
CREATE OR REPLACE VIEW v_paper_topic_availability WITH (security_invoker = true) AS
SELECT p.paper_id, f.section_code, f.line_no, f.question_count + f.internal_choices AS needed,
       count(q.question_id) AS available,
       count(q.question_id) FILTER (WHERE q.difficulty = 'EASY') AS easy,
       count(q.question_id) FILTER (WHERE q.difficulty = 'INTERMEDIATE') AS medium,
       count(q.question_id) FILTER (WHERE q.difficulty = 'TOUGH') AS hard,
       GREATEST(0, f.question_count + f.internal_choices - count(q.question_id)) AS short
FROM question_papers p
JOIN paper_format_sections f ON f.format_id = p.format_id
LEFT JOIN paper_topics t ON t.paper_id = p.paper_id
LEFT JOIN questions q ON q.topic_id = t.topic_id AND q.status = 'APPROVED' AND q.parent_id IS NULL
                     AND q.qtype = ANY (COALESCE(f.allowed_qtypes, ARRAY[f.qtype])) AND q.marks = f.marks_each
GROUP BY p.paper_id, f.section_code, f.line_no, f.question_count, f.internal_choices;

-- Approved and submitted sets can't be changed
CREATE OR REPLACE FUNCTION trg_paper_set_locked() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_status TEXT;
BEGIN
  SELECT status INTO v_status FROM paper_sets WHERE set_id = COALESCE(NEW.set_id, OLD.set_id);
  IF v_status IN ('SUBMITTED', 'APPROVED') THEN RAISE EXCEPTION 'This set is %; it can''t be changed', lower(v_status); END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER paper_set_locked BEFORE INSERT OR UPDATE OR DELETE ON paper_questions FOR EACH ROW EXECUTE FUNCTION trg_paper_set_locked();

-- Approval per set: SUBMIT (draft must match the blueprint's marks), APPROVE / SEND_BACK (an approver, not the
-- person who sent it), TAKE_BACK (the sender), REOPEN (an approver, before the exam starts)
CREATE OR REPLACE FUNCTION decide_paper_set(p_set INTEGER, p_action VARCHAR, p_by INTEGER, p_note TEXT DEFAULT NULL) RETURNS VARCHAR
LANGUAGE plpgsql AS $$
DECLARE st paper_sets%ROWTYPE; v_marks NUMERIC; v_target INTEGER; v_paper question_papers%ROWTYPE; v_new VARCHAR;
BEGIN
  SELECT * INTO st FROM paper_sets WHERE set_id = p_set FOR UPDATE;
  SELECT * INTO v_paper FROM question_papers WHERE paper_id = st.paper_id;
  IF p_action = 'SUBMIT' THEN
    IF st.status NOT IN ('DRAFT', 'SENT_BACK') THEN RAISE EXCEPTION 'Only a draft can be sent for approval'; END IF;
    SELECT COALESCE(sum(COALESCE(edited_marks, marks)), 0) INTO v_marks FROM paper_questions WHERE set_id = p_set;
    SELECT total_marks INTO v_target FROM paper_formats WHERE format_id = v_paper.format_id;
    IF v_marks <> v_target THEN RAISE EXCEPTION 'The questions add up to % marks; the paper is out of %', v_marks, v_target; END IF;
    v_new := 'SUBMITTED'; UPDATE paper_sets SET status = v_new, submitted_by = p_by, note = NULL WHERE set_id = p_set;
  ELSIF p_action IN ('APPROVE', 'SEND_BACK') THEN
    IF st.status <> 'SUBMITTED' THEN RAISE EXCEPTION 'Only a submitted set can be approved or sent back'; END IF;
    IF NOT can_approve_papers(p_by) THEN RAISE EXCEPTION 'Only the Principal or a senior teacher can approve papers'; END IF;
    IF st.submitted_by = p_by THEN RAISE EXCEPTION 'Someone other than the person who sent it must approve it'; END IF;
    IF p_action = 'SEND_BACK' AND length(trim(COALESCE(p_note, ''))) < 3 THEN RAISE EXCEPTION 'Say what needs changing'; END IF;
    v_new := CASE p_action WHEN 'APPROVE' THEN 'APPROVED' ELSE 'SENT_BACK' END;
    UPDATE paper_sets SET status = v_new, decided_by = p_by, note = p_note WHERE set_id = p_set;
  ELSIF p_action = 'TAKE_BACK' THEN
    IF st.status <> 'SUBMITTED' OR st.submitted_by <> p_by THEN RAISE EXCEPTION 'Only the sender can take back a submitted set'; END IF;
    v_new := 'DRAFT'; UPDATE paper_sets SET status = v_new WHERE set_id = p_set;
  ELSIF p_action = 'REOPEN' THEN
    IF st.status <> 'APPROVED' OR NOT can_approve_papers(p_by) THEN RAISE EXCEPTION 'Only an approver can reopen an approved set'; END IF;
    IF (SELECT exam_date + start_time FROM exam_schedule WHERE schedule_id = v_paper.schedule_id) <= now()::timestamp THEN RAISE EXCEPTION 'The exam has started'; END IF;
    v_new := 'DRAFT'; UPDATE paper_sets SET status = v_new WHERE set_id = p_set;
    UPDATE question_papers SET chosen_set_id = NULL WHERE paper_id = st.paper_id AND chosen_set_id = p_set;
  ELSE RAISE EXCEPTION 'Unknown action %', p_action;
  END IF;
  INSERT INTO paper_approvals (paper_id, action, acted_by, comment)
  VALUES (st.paper_id, CASE p_action WHEN 'SUBMIT' THEN 'SUBMIT' WHEN 'APPROVE' THEN 'APPROVE' WHEN 'SEND_BACK' THEN 'REQUEST_CHANGES' ELSE 'UNLOCK' END, p_by, p_note);
  RETURN v_new;
END $$;

-- The set given in the exam: an approved set, chosen by an approver, until the paper starts
CREATE OR REPLACE FUNCTION choose_exam_set(p_paper INTEGER, p_set INTEGER, p_by INTEGER) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE v_start TIMESTAMP;
BEGIN
  IF NOT can_approve_papers(p_by) THEN RAISE EXCEPTION 'Only the Principal or a senior teacher chooses the set'; END IF;
  SELECT es.exam_date + es.start_time INTO v_start FROM question_papers qp JOIN exam_schedule es ON es.schedule_id = qp.schedule_id WHERE qp.paper_id = p_paper;
  IF v_start <= now()::timestamp THEN RAISE EXCEPTION 'The paper has started; the set can no longer be changed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM paper_sets WHERE set_id = p_set AND paper_id = p_paper AND status = 'APPROVED') THEN
    RAISE EXCEPTION 'Only an approved set can be given in the exam';
  END IF;
  UPDATE question_papers SET chosen_set_id = p_set WHERE paper_id = p_paper;
END $$;
