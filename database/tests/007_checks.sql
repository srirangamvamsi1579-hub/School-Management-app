-- Checks for 007: run on a database with 001-007 loaded. Everything runs in one transaction and is rolled back.
-- psql -d school -f database/tests/007_checks.sql   (expect four NOTICE lines: OTP ok, Roles ok, Admissions ok, Analytics ok)
\set ON_ERROR_STOP 1
SET client_min_messages = notice;
BEGIN;
INSERT INTO academic_years (tenant_id, name, start_date, end_date, is_current) VALUES (1,'2027-28','2027-04-01','2028-03-31',TRUE);
INSERT INTO classes (tenant_id, name, level_no) VALUES (1,'Grade IX',9);
INSERT INTO sections (tenant_id, class_id, name, capacity) SELECT 1, class_id, n, 3 FROM classes, (VALUES ('S1'),('S2')) v(n);
INSERT INTO subjects (tenant_id, code, name) VALUES (1,'MAT','Mathematics'),(1,'ENG','English');
INSERT INTO staff (tenant_id, employee_code, first_name, phone, join_date) VALUES (1,'E1','Murali','9800000001','2020-06-01'),(1,'E2','Prasad','9800000002','2020-06-01');
INSERT INTO exam_terms (tenant_id, year_id, name, sort_order) SELECT 1, year_id, 'Term 2', 2 FROM academic_years;
-- 1. OTP
DO $$ DECLARE r RECORD; BEGIN
  SELECT * INTO r FROM request_otp(1, 'a@gmail.com', 'EMAIL', 'SIGNUP');
  ASSERT r.status = 'SENT';
  ASSERT verify_otp(1, 'a@gmail.com', 'SIGNUP', '000000') IN ('WRONG','OK');
  ASSERT verify_otp(1, 'a@gmail.com', 'SIGNUP', r.code) = 'OK', 'right code';
  ASSERT verify_otp(1, 'a@gmail.com', 'SIGNUP', r.code) = 'NO_CODE', 'code used once';
  SELECT * INTO r FROM request_otp(1, '9876543210', 'SMS', 'SIGNIN');
  ASSERT r.status = 'GATEWAY_PENDING', 'SMS waits for gateway';
  RAISE NOTICE 'OTP ok';
END $$;
-- 2. Roles
INSERT INTO users (tenant_id, username, email, password_hash, status) VALUES (1,'admin','admin@x.in','COGNITO','ACTIVE'),(1,'teach','t@gmail.com','COGNITO','ACTIVE'),(1,'new','new@gmail.com','COGNITO','PENDING');
INSERT INTO user_roles SELECT u.user_id, r.role_id FROM users u JOIN roles r ON (u.username,r.code) IN (('admin','ADMIN'),('teach','TEACHER'));
DO $$ DECLARE a INT; t INT; n INT; BEGIN
  SELECT user_id INTO a FROM users WHERE username='admin'; SELECT user_id INTO t FROM users WHERE username='teach'; SELECT user_id INTO n FROM users WHERE username='new';
  BEGIN PERFORM set_user_role(t, n, 'PARENT', 'ACTIVE'); RAISE EXCEPTION 'teacher should not manage users'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Not allowed%' THEN RAISE; END IF; END;
  BEGIN PERFORM set_user_role(a, a, 'TEACHER'); RAISE EXCEPTION 'self change'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%own role%' THEN RAISE; END IF; END;
  PERFORM set_user_role(a, n, 'PARENT', 'ACTIVE');
  ASSERT (SELECT status FROM users WHERE user_id=n) = 'ACTIVE' AND (SELECT approved_by FROM users WHERE user_id=n) = a;
  ASSERT (SELECT count(*) FROM user_role_changes WHERE user_id=n) = 1;
  -- designation grant lets the teacher manage users
  UPDATE users SET designation_id = (SELECT designation_id FROM designations WHERE tenant_id=1 AND name='Vice Principal') WHERE user_id=t;
  ASSERT can_manage_users(t), 'VP designation opens Users';
  RAISE NOTICE 'Roles ok';
END $$;
-- 3. Admissions
INSERT INTO admission_enquiries (tenant_id, app_no, year_id, class_id, child_first, child_last, dob, parent_name, parent_phone, parent_email, status)
SELECT 1,'APP-1', year_id, (SELECT class_id FROM classes), 'Ira','Rao','2012-05-01','Deepa Rao','9876500001','d@example.com','SUBMITTED' FROM academic_years;
DO $$ DECLARE e INT; s INT; BEGIN
  SELECT enquiry_id INTO e FROM admission_enquiries WHERE app_no='APP-1';
  BEGIN UPDATE admission_enquiries SET status='ENROLLED' WHERE enquiry_id=e; RAISE EXCEPTION 'bad move allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Cannot move%' THEN RAISE; END IF; END;
  UPDATE admission_enquiries SET status='IN_REVIEW', interview_date='2026-11-30' WHERE enquiry_id=e;
  BEGIN UPDATE admission_enquiries SET status='OFFERED' WHERE enquiry_id=e; RAISE EXCEPTION 'offer without docs'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Birth certificate%' THEN RAISE; END IF; END;
  UPDATE admission_enquiries SET docs='{"birth_cert":true,"photo":true,"report_card":false}', status='OFFERED' WHERE enquiry_id=e;
  s := enrol_applicant(e, 'ADM-2027-0001');
  ASSERT (SELECT status FROM admission_enquiries WHERE enquiry_id=e) = 'ENROLLED';
  ASSERT (SELECT count(*) FROM enrollments WHERE student_id=s) = 1;
  ASSERT (SELECT count(*) FROM admission_status_history WHERE enquiry_id=e) = 4, 'history rows';
  ASSERT (SELECT enrolled FROM v_admissions_by_grade_status) = 1;
  RAISE NOTICE 'Admissions ok';
END $$;
-- 4. Analytics: 6 students across 2 sections
INSERT INTO students (tenant_id, admission_no, first_name, dob, admission_date) SELECT 1, 'T'||i, 'Kid'||i, '2012-01-01', '2026-04-01' FROM generate_series(1,6) i;
INSERT INTO enrollments (tenant_id, student_id, year_id, section_id)
SELECT 1, st.student_id, (SELECT year_id FROM academic_years), (SELECT section_id FROM sections WHERE name = CASE WHEN substr(st.admission_no,2)::int <= 3 THEN 'S1' ELSE 'S2' END) FROM students st WHERE admission_no LIKE 'T%';
INSERT INTO exam_results (tenant_id, enrollment_id, term_id, subject_id, marks_obtained)
SELECT 1, en.enrollment_id, (SELECT term_id FROM exam_terms), sub.subject_id, 30 + substr(st.admission_no,2)::int * 10
FROM enrollments en JOIN students st ON st.student_id = en.student_id AND st.admission_no LIKE 'T%' CROSS JOIN subjects sub;
INSERT INTO section_subject_teachers SELECT 1, (SELECT year_id FROM academic_years), s.section_id, sub.subject_id, CASE WHEN s.name='S1' THEN (SELECT staff_id FROM staff WHERE employee_code='E1') ELSE (SELECT staff_id FROM staff WHERE employee_code='E2') END FROM sections s CROSS JOIN subjects sub;
DO $$ BEGIN
  ASSERT (SELECT admission_no FROM v_grade_rankings WHERE grade_rank = 1) = 'T6', 'top student across sections';
  ASSERT (SELECT admission_no FROM v_grade_rankings WHERE grade_rank_from_bottom = 1) = 'T1';
  ASSERT (SELECT count(*) FROM v_grade_rankings WHERE grade_rank <= 6) = 6;
  ASSERT (SELECT max(grade_size) FROM v_grade_rankings) = 6;
  ASSERT (SELECT vs_grade FROM v_teacher_subject_performance WHERE teacher='Prasad ' AND subject='Mathematics') = 15, 'S2 teacher 15 above grade';
  RAISE NOTICE 'Analytics ok';
END $$;
ROLLBACK;
