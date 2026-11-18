-- Checks for 019/020 (parents checked against the student record, audit of changes, archive). One transaction, rolled back.
-- Expect NOTICE lines: Parent sign-up ok, Archive ok
\set ON_ERROR_STOP 1
SET client_min_messages = notice;
SET TIME ZONE 'Asia/Kolkata';
BEGIN;
INSERT INTO academic_years (tenant_id, name, start_date, end_date, is_current) VALUES (1,'2026-27x', CURRENT_DATE - 100, CURRENT_DATE + 200, TRUE);
INSERT INTO classes (tenant_id, name, level_no) VALUES (1,'Grade VIII',8);
INSERT INTO sections (tenant_id, class_id, name) SELECT 1, class_id, 'A' FROM classes WHERE name = 'Grade VIII';
INSERT INTO students (tenant_id, admission_no, first_name, last_name, dob, admission_date) VALUES
 (1,'ADM-2025-0231','Aarav','Sharma','2013-01-01','2020-04-01'), (1,'ADM-2025-0232','Diya','Rao','2013-01-01','2020-04-01');
INSERT INTO enrollments (tenant_id, student_id, year_id, section_id)
SELECT 1, s.student_id, (SELECT year_id FROM academic_years WHERE name = '2026-27x'), (SELECT section_id FROM sections sc JOIN classes c USING (class_id) WHERE c.name = 'Grade VIII') FROM students s WHERE s.admission_no LIKE 'ADM-2025-023%';
INSERT INTO designations (tenant_id, name) VALUES (1, 'Driver') ON CONFLICT DO NOTHING;
INSERT INTO users (tenant_id, username, email, password_hash, status, full_name) VALUES (1,'adm19','adm19@example.com','COGNITO','ACTIVE','Asha Admin');
INSERT INTO user_roles SELECT u.user_id, r.role_id FROM users u, roles r WHERE u.username = 'adm19' AND r.code = 'ADMIN';

DO $$ DECLARE p INT; g INT; i INT; BEGIN
  ASSERT match_student(1, 'adm-2025-0231', ' AARAV sharma ', 8) IS NOT NULL, 'case and spaces';
  ASSERT match_student(1, 'ADM-2025-0231', 'Sharma Aarav', 8) IS NOT NULL, 'order';
  ASSERT match_student(1, 'ADM-2025-0231', 'Aarav', 8) IS NOT NULL, 'first name';
  ASSERT match_student(1, 'ADM-2025-0231', 'Sharma', 8) IS NULL, 'surname alone';
  ASSERT match_student(1, 'ADM-2025-0231', 'Aarav Sharma', 7) IS NULL, 'wrong grade';
  ASSERT match_student(1, 'ADM-2025-0231', 'Diya Rao', 8) IS NULL, 'another child''s name';
  ASSERT register_parent(1, 'neha@example.com', 'Neha Sharma', NULL, 'ADM-2025-0231', 'Aarav Sharma', 7) IS NULL, 'mismatch creates nothing';
  ASSERT NOT EXISTS (SELECT 1 FROM users WHERE email = 'neha@example.com'), 'no account on a mismatch';
  p := register_parent(1, 'neha@example.com', 'Neha Sharma', NULL, 'ADM-2025-0231', 'Aarav Sharma', 8);
  ASSERT (SELECT status FROM users WHERE user_id = p) = 'ACTIVE', 'active at once';
  UPDATE users SET username = 'par19' WHERE user_id = p;
  ASSERT EXISTS (SELECT 1 FROM user_roles ur JOIN roles r USING (role_id) WHERE ur.user_id = p AND r.code = 'PARENT'), 'parent role';
  ASSERT NOT EXISTS (SELECT 1 FROM parent_signup_checks WHERE sign_in_id = 'neha@example.com'), 'tries cleared';
  ASSERT (SELECT students->0->>'name' FROM v_user_directory WHERE user_id = p) = 'Aarav Sharma', 'directory shows the student';
  ASSERT (SELECT students->0->>'grade' FROM v_user_directory WHERE user_id = p) = 'Grade VIII';
  ASSERT (SELECT designation FROM v_user_directory WHERE user_id = p) = 'N/A', 'parent designation N/A';
  -- five wrong tries lock the sign-in ID out of self-service
  FOR i IN 1..5 LOOP PERFORM register_parent(1, 'guess@example.com', 'Guesser', NULL, 'ADM-2025-0232', 'Diya Rao', 9); END LOOP;
  BEGIN PERFORM register_parent(1, 'guess@example.com', 'Guesser', NULL, 'ADM-2025-0232', 'Diya Rao', 8); RAISE EXCEPTION 'sixth try allowed';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Too many tries%' THEN RAISE; END IF; END;
  ASSERT NOT EXISTS (SELECT 1 FROM users WHERE email = 'guess@example.com');
  -- edits are tracked for the audit
  PERFORM set_config('app.user_id', (SELECT user_id FROM users WHERE username = 'adm19')::text, true);
  UPDATE users SET phone = '9812344411' WHERE user_id = p;
  ASSERT (SELECT (last_change, updated_by) FROM users WHERE user_id = p) = ('contact details'::varchar, (SELECT user_id FROM users WHERE username = 'adm19')), 'edit tracked';
  RAISE NOTICE 'Parent sign-up ok';
END $$;

DO $$ DECLARE a INT; p INT; t INT; ar BIGINT; ar2 BIGINT; BEGIN
  SELECT user_id INTO a FROM users WHERE username = 'adm19';
  SELECT user_id INTO p FROM users WHERE username = 'par19';
  INSERT INTO users (tenant_id, username, email, password_hash, status, full_name) VALUES (1,'drv19','driver19@example.com','COGNITO','ACTIVE','Ravi Driver') RETURNING user_id INTO t;
  INSERT INTO user_roles SELECT t, role_id FROM roles WHERE code = 'TRANSPORT';
  UPDATE users SET designation_id = (SELECT designation_id FROM designations WHERE tenant_id = 1 AND name = 'Driver') WHERE user_id = t;
  -- deleted by the school: details kept
  ar := close_account(a, t, 'Left the school');
  ASSERT (SELECT status FROM users WHERE user_id = t) = 'DELETED';
  ASSERT NOT EXISTS (SELECT 1 FROM v_user_directory WHERE user_id = t), 'off the Users screen';
  ASSERT (SELECT email FROM user_archive WHERE archive_id = ar) = 'driver19@example.com';
  ASSERT (SELECT (department, designation, reason) FROM user_archive WHERE archive_id = ar) = ('Transport'::varchar, 'Driver'::varchar, 'Left the school'::varchar), 'archived details';
  BEGIN PERFORM close_account(a, t); RAISE EXCEPTION 'closed twice';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%already closed%' THEN RAISE; END IF; END;
  -- deleted by the parent: email and mobile not kept, the child is
  ar2 := close_own_account(p);
  ASSERT (SELECT (email, phone, sign_in_id) IS NOT DISTINCT FROM (NULL::varchar, NULL::varchar, NULL::varchar) FROM user_archive WHERE archive_id = ar2), 'contact details not kept';
  ASSERT (SELECT children->0->>'admission_no' FROM user_archive WHERE archive_id = ar2) = 'ADM-2025-0231', 'child kept';
  RAISE NOTICE 'Archive ok';
END $$;
ROLLBACK;
