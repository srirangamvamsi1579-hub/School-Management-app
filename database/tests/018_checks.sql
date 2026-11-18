-- Checks for 018 (question papers by topic, sets, approval). One transaction, rolled back.  Expect NOTICE: Question papers ok
\set ON_ERROR_STOP 1
SET client_min_messages = notice;
SET TIME ZONE 'Asia/Kolkata';
BEGIN;
INSERT INTO users (tenant_id, username, email, password_hash, status, full_name) VALUES
 (1,'tch','tch@example.com','COGNITO','ACTIVE','Tara Teacher'), (1,'prn','prn@example.com','COGNITO','ACTIVE','Prem Principal');
INSERT INTO user_roles SELECT u.user_id, r.role_id FROM users u JOIN roles r ON (u.username, r.code) IN (('tch','TEACHER'),('prn','PRINCIPAL'));
DO $$
DECLARE tch INT; prn INT; tb INT; fmt INT; ex INT; sch INT; pap INT; s1 INT; s2 INT; c INT; t INT; r RECORD; kept BIGINT; v_topics INT[];
BEGIN
  SELECT user_id INTO tch FROM users WHERE username = 'tch';
  SELECT user_id INTO prn FROM users WHERE username = 'prn';
  INSERT INTO textbooks (board_id, grade_level, subject_name, title, tenant_id)
  SELECT board_id, 9, 'Mathematics', 'Test Maths 9', 1 FROM boards WHERE code = 'CBSE' RETURNING textbook_id INTO tb;
  -- 3 chapters × 2 topics; each topic has 1-mark MCQs (one per difficulty, twice) and 3-mark SAs (one per difficulty)
  FOR c IN 1..3 LOOP
    INSERT INTO chapters (textbook_id, chapter_no, title, term) VALUES (tb, c, 'Chapter ' || c, 1);
    FOR t IN 1..2 LOOP
      INSERT INTO topics (chapter_id, sort_order, title) SELECT chapter_id, t, 'Ch' || c || ' topic ' || t FROM chapters WHERE textbook_id = tb AND chapter_no = c;
    END LOOP;
  END LOOP;
  INSERT INTO questions (tenant_id, topic_id, qtype, marks, difficulty, stem, status)
  SELECT 1, tp.topic_id, 'MCQ', 1, d, tp.title || ' MCQ ' || d || ' ' || n, 'APPROVED'
  FROM topics tp JOIN chapters ch USING (chapter_id), unnest(ARRAY['EASY','INTERMEDIATE','TOUGH']) d, generate_series(1, 2) n WHERE ch.textbook_id = tb;
  INSERT INTO questions (tenant_id, topic_id, qtype, marks, difficulty, stem, status)
  SELECT 1, tp.topic_id, 'SA', 3, d, tp.title || ' SA ' || d, 'APPROVED'
  FROM topics tp JOIN chapters ch USING (chapter_id), unnest(ARRAY['EASY','INTERMEDIATE','TOUGH']) d WHERE ch.textbook_id = tb;
  -- blueprint: A 4 × 1 (MCQ), B 2 × 3 (SA) with one OR  = 10 marks
  INSERT INTO paper_formats (tenant_id, code, name, total_marks, duration_min, exam_kind, chapter_rule)
  VALUES (1, 'T_UT', 'Test unit test', 10, 40, 'UT2', 'CHOSEN') RETURNING format_id INTO fmt;
  INSERT INTO paper_format_sections (format_id, section_code, line_no, section_title, qtype, question_count, marks_each, internal_choices) VALUES
   (fmt, 'A', 1, 'Objective', 'MCQ', 4, 1, 0), (fmt, 'B', 1, 'Short answer', 'SA', 2, 3, 1);
  INSERT INTO exams (tenant_id, name, exam_kind, starts_on) VALUES (1, 'Unit Test 2', 'UT2', CURRENT_DATE + 10) RETURNING exam_id INTO ex;
  INSERT INTO exam_schedule (tenant_id, exam_id, grade, subject, exam_date) VALUES (1, ex, 9, 'Mathematics', CURRENT_DATE + 10) RETURNING schedule_id INTO sch;
  INSERT INTO question_papers (tenant_id, title, exam_type, textbook_id, format_id, exam_id, schedule_id, easy_pct, intermediate_pct, tough_pct, created_by)
  VALUES (1, 'UT2 Class 9 Mathematics', 'UNIT_TEST', tb, fmt, ex, sch, 25, 50, 25, tch) RETURNING paper_id INTO pap;
  BEGIN
    INSERT INTO question_papers (tenant_id, title, exam_type, format_id, schedule_id) VALUES (1, 'dup', 'UNIT_TEST', fmt, sch);
    RAISE EXCEPTION 'two papers for one timetable entry';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  INSERT INTO paper_sets (paper_id, set_code, set_no) VALUES (pap, 'A', 1) RETURNING set_id INTO s1;
  INSERT INTO paper_sets (paper_id, set_code, set_no) VALUES (pap, 'B', 2) RETURNING set_id INTO s2;

  -- topics: chapters 1 and 2 only
  SELECT array_agg(tp.topic_id) INTO v_topics FROM topics tp JOIN chapters ch USING (chapter_id) WHERE ch.textbook_id = tb AND ch.chapter_no IN (1, 2);
  ASSERT set_paper_topics(pap, v_topics, tch) = 2, 'both draft sets built when topics are set';
  ASSERT (SELECT count(*) FROM paper_questions WHERE set_id = s1) = 6, 'set 1 full';
  ASSERT (SELECT sum(marks) FROM paper_questions WHERE set_id = s1) = 10, 'set 1 = 10 marks';
  ASSERT NOT EXISTS (SELECT 1 FROM paper_questions pq JOIN questions q ON q.question_id IN (pq.question_id, pq.or_question_id)
                     JOIN topics tp USING (topic_id) JOIN chapters ch USING (chapter_id)
                     WHERE pq.set_id IN (s1, s2) AND ch.chapter_no = 3), 'only the chosen topics';
  ASSERT (SELECT count(*) FROM paper_questions WHERE set_id = s1 AND or_question_id IS NOT NULL) = 1, 'one OR in section B';
  ASSERT NOT EXISTS (SELECT 1 FROM paper_questions a JOIN paper_questions b ON a.question_id = b.question_id WHERE a.set_id = s1 AND b.set_id = s2 AND a.section_code = 'A'),
         'sets do not share MCQs while the bank has enough';
  ASSERT (SELECT count(DISTINCT tp.chapter_id) FROM paper_questions pq JOIN questions q USING (question_id) JOIN topics tp USING (topic_id) WHERE pq.set_id = s1 AND pq.section_code = 'A') = 2,
         'section A spread across both chosen chapters';
  ASSERT (SELECT count(*) FILTER (WHERE q.difficulty = 'EASY') FROM paper_questions pq JOIN questions q USING (question_id) WHERE pq.set_id = s1 AND pq.section_code = 'A') = 1, 'difficulty mix';
  FOR r IN SELECT * FROM v_paper_topic_availability WHERE paper_id = pap LOOP
    ASSERT r.short = 0, 'nothing short for ' || r.section_code;
  END LOOP;

  -- lock a chapter-2 question, then switch the paper to chapters 2 and 3: the lock survives, chapter 1 is gone
  SELECT pq.question_id INTO kept FROM paper_questions pq JOIN questions q USING (question_id) JOIN topics tp USING (topic_id) JOIN chapters ch USING (chapter_id)
   WHERE pq.set_id = s1 AND ch.chapter_no = 2 ORDER BY pq.q_no LIMIT 1;
  UPDATE paper_questions SET locked = TRUE WHERE set_id = s1 AND question_id = kept;
  SELECT array_agg(tp.topic_id) INTO v_topics FROM topics tp JOIN chapters ch USING (chapter_id) WHERE ch.textbook_id = tb AND ch.chapter_no IN (2, 3);
  PERFORM set_paper_topics(pap, v_topics, tch);
  ASSERT EXISTS (SELECT 1 FROM paper_questions WHERE set_id = s1 AND question_id = kept AND locked), 'locked question kept';
  ASSERT NOT EXISTS (SELECT 1 FROM paper_questions pq JOIN questions q ON q.question_id IN (pq.question_id, pq.or_question_id) JOIN topics tp USING (topic_id) JOIN chapters ch USING (chapter_id)
                     WHERE pq.set_id IN (s1, s2) AND ch.chapter_no = 1), 'rebuilt from the new topics';
  ASSERT (SELECT count(*) FROM paper_questions WHERE set_id = s1) = 6, 'still full';
  ASSERT (SELECT count(*) FROM paper_versions WHERE paper_id = pap) = 2, 'a version before each topic change';
  ASSERT jsonb_array_length((SELECT snapshot->'sets' FROM paper_versions WHERE paper_id = pap ORDER BY version_id DESC LIMIT 1)) = 2, 'snapshot holds both sets';

  -- a locked question whose topic is unticked goes
  SELECT array_agg(tp.topic_id) INTO v_topics FROM topics tp JOIN chapters ch USING (chapter_id) WHERE ch.textbook_id = tb AND ch.chapter_no = 3;
  PERFORM set_paper_topics(pap, v_topics, tch);
  ASSERT NOT EXISTS (SELECT 1 FROM paper_questions WHERE set_id = s1 AND question_id = kept), 'locked question of an unticked topic removed';
  ASSERT EXISTS (SELECT 1 FROM v_paper_topic_availability WHERE paper_id = pap AND section_code = 'B' AND available = 6), 'availability follows the topics';

  -- automatic update off: topics change, sets stay
  UPDATE question_papers SET auto_update = FALSE WHERE paper_id = pap;
  SELECT array_agg(tp.topic_id) INTO v_topics FROM topics tp JOIN chapters ch USING (chapter_id) WHERE ch.textbook_id = tb;
  ASSERT set_paper_topics(pap, v_topics, tch) = 0, 'no rebuild when automatic update is off';

  -- approval per set
  BEGIN PERFORM decide_paper_set(s1, 'APPROVE', prn); RAISE EXCEPTION 'approved a draft';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Only a submitted%' THEN RAISE; END IF; END;
  ASSERT decide_paper_set(s1, 'SUBMIT', tch) = 'SUBMITTED', 'submitted';
  BEGIN UPDATE paper_questions SET locked = TRUE WHERE set_id = s1; RAISE EXCEPTION 'edited a submitted set';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%can''t be changed' THEN RAISE; END IF; END;
  BEGIN PERFORM generate_topic_set(s1); RAISE EXCEPTION 'regenerated a submitted set';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%only a draft%' THEN RAISE; END IF; END;
  BEGIN PERFORM decide_paper_set(s1, 'APPROVE', tch); RAISE EXCEPTION 'teacher approved';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Only the Principal%' THEN RAISE; END IF; END;
  BEGIN PERFORM decide_paper_set(s1, 'SEND_BACK', prn, ''); RAISE EXCEPTION 'sent back without a note';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Say what%' THEN RAISE; END IF; END;
  BEGIN PERFORM choose_exam_set(pap, s1, prn); RAISE EXCEPTION 'chose an unapproved set';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Only an approved%' THEN RAISE; END IF; END;
  ASSERT decide_paper_set(s1, 'APPROVE', prn) = 'APPROVED', 'approved';
  PERFORM choose_exam_set(pap, s1, prn);
  ASSERT (SELECT chosen_set_id FROM question_papers WHERE paper_id = pap) = s1, 'set chosen';
  BEGIN PERFORM choose_exam_set(pap, s1, tch); RAISE EXCEPTION 'teacher chose the set';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Only the Principal%' THEN RAISE; END IF; END;
  -- a draft with the wrong marks can't be sent
  DELETE FROM paper_questions WHERE set_id = s2 AND section_code = 'A' AND q_no = (SELECT min(q_no) FROM paper_questions WHERE set_id = s2);
  BEGIN PERFORM decide_paper_set(s2, 'SUBMIT', tch); RAISE EXCEPTION 'sent a 9-mark paper';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'The questions add up to 9%' THEN RAISE; END IF; END;
  -- reopen clears the chosen set; after the start time nothing can change
  ASSERT decide_paper_set(s1, 'REOPEN', prn) = 'DRAFT', 'reopened';
  ASSERT (SELECT chosen_set_id FROM question_papers WHERE paper_id = pap) IS NULL, 'chosen set cleared';
  PERFORM decide_paper_set(s1, 'SUBMIT', tch); PERFORM decide_paper_set(s1, 'APPROVE', prn);
  UPDATE exam_schedule SET exam_date = CURRENT_DATE - 1 WHERE schedule_id = sch;
  BEGIN PERFORM choose_exam_set(pap, s1, prn); RAISE EXCEPTION 'chose after the start';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'The paper has started%' THEN RAISE; END IF; END;
  ASSERT (SELECT count(*) FROM paper_approvals WHERE paper_id = pap) = 5, 'every decision logged';
  INSERT INTO paper_views (paper_id, user_id) VALUES (pap, prn) ON CONFLICT DO NOTHING;
  INSERT INTO paper_views (paper_id, user_id) VALUES (pap, prn) ON CONFLICT DO NOTHING;
  ASSERT (SELECT count(*) FROM paper_views WHERE paper_id = pap) = 1, 'one view a day';
  RAISE NOTICE 'Question papers ok';
END $$;
ROLLBACK;
