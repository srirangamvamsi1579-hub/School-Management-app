-- Checks for 011: run on a database with all migrations loaded. One transaction, rolled back.
-- psql -d school -f database/tests/011_checks.sql   (expect NOTICE lines: Leave ok, Late arrival ok, Meeting ok, Office ok, Mobile ok)
\set ON_ERROR_STOP 1
SET client_min_messages = notice;
BEGIN;
INSERT INTO academic_years (tenant_id, name, start_date, end_date, is_current) VALUES (1,'2026-27', CURRENT_DATE - 100, CURRENT_DATE + 200, TRUE);
INSERT INTO classes (tenant_id, name, level_no) VALUES (1,'Grade VIII',8);
INSERT INTO sections (tenant_id, class_id, name) SELECT 1, class_id, 'A' FROM classes;
INSERT INTO subjects (tenant_id, code, name) VALUES (1,'MATH-T','Maths') ON CONFLICT DO NOTHING;
INSERT INTO staff (tenant_id, employee_code, first_name, phone, join_date) VALUES (1,'E1','Sonia','9800000001','2020-06-01'),(1,'E2','Murali','9800000002','2020-06-01'),(1,'E3','Anita','9800000003','2020-06-01'),(1,'E9','Stranger','9800000009','2020-06-01');
INSERT INTO users (tenant_id, username, email, password_hash, status) VALUES (1,'parent','p@example.com','COGNITO','ACTIVE'),(1,'teach','t@x.in','COGNITO','ACTIVE'),(1,'office','o@x.in','COGNITO','ACTIVE'),(1,'stranger','s@x.in','COGNITO','ACTIVE');
UPDATE users u SET person_type = 'STAFF', person_id = s.staff_id FROM staff s WHERE (u.username, s.employee_code) IN (('teach','E2'),('office','E3'),('stranger','E9'));
INSERT INTO user_roles SELECT u.user_id, r.role_id FROM users u JOIN roles r ON (u.username, r.code) IN (('parent','PARENT'),('teach','TEACHER'),('office','FRONT_OFFICE'),('stranger','TEACHER'));
INSERT INTO students (tenant_id, admission_no, first_name, dob, admission_date) VALUES (1,'ADM-1','Aarav','2013-01-01','2020-04-01');
INSERT INTO transport_bands (tenant_id, year_id, band_no) SELECT 1, year_id, 3 FROM academic_years;
INSERT INTO transport_routes (tenant_id, code, name, capacity, band_id) SELECT 1, 'R3', 'Zone C', 32, band_id FROM transport_bands;
INSERT INTO pickup_points (tenant_id, name, band_id, route_id, stop_order) SELECT 1, 'Agara Lake', band_id, (SELECT route_id FROM transport_routes), 2 FROM transport_bands;
INSERT INTO enrollments (tenant_id, student_id, year_id, section_id, pickup_point_id) SELECT 1, (SELECT student_id FROM students), year_id, (SELECT section_id FROM sections), (SELECT point_id FROM pickup_points) FROM academic_years;
INSERT INTO class_coordinators SELECT 1, (SELECT year_id FROM academic_years), (SELECT section_id FROM sections), 'PRIMARY', (SELECT staff_id FROM staff WHERE employee_code = 'E1');
INSERT INTO section_subject_teachers SELECT 1, (SELECT year_id FROM academic_years), (SELECT section_id FROM sections), (SELECT subject_id FROM subjects WHERE code = 'MATH-T'), (SELECT staff_id FROM staff WHERE employee_code = 'E2');
CREATE TEMP VIEW k AS SELECT (SELECT student_id FROM students) s, (SELECT user_id FROM users WHERE username = 'parent') p,
  (SELECT staff_id FROM staff WHERE employee_code = 'E1') coord, (SELECT staff_id FROM staff WHERE employee_code = 'E2') teacher,
  (SELECT staff_id FROM staff WHERE employee_code = 'E3') office, (SELECT staff_id FROM staff WHERE employee_code = 'E9') stranger;

DO $$ DECLARE x k%ROWTYPE; r INT; BEGIN
  SELECT * INTO x FROM k;
  BEGIN INSERT INTO parent_requests (tenant_id, ref_no, student_id, requested_by, kind, date_from, date_to) VALUES (1,'L-0',x.s,x.p,'LEAVE',CURRENT_DATE+1,CURRENT_DATE+3);
        RAISE EXCEPTION 'leave without reason'; EXCEPTION WHEN check_violation THEN NULL; END;
  INSERT INTO parent_requests (tenant_id, ref_no, student_id, requested_by, kind, date_from, date_to, reason) VALUES (1,'L-1',x.s,x.p,'LEAVE',CURRENT_DATE+1,CURRENT_DATE+3,'Wedding') RETURNING request_id INTO r;
  ASSERT (SELECT status FROM parent_requests WHERE request_id = r) = 'SUBMITTED', 'leave waits for a coordinator';
  ASSERT (SELECT status FROM trip_manifest(CURRENT_DATE+2, 'AM')) = 'CHECK', 'bus sees it is pending';
  BEGIN PERFORM decide_parent_request(r, x.teacher, TRUE); RAISE EXCEPTION 'non-coordinator decided'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Only this class%' THEN RAISE; END IF; END;
  PERFORM decide_parent_request(r, x.coord, TRUE);
  ASSERT (SELECT count(*) FROM student_attendance WHERE status = 'LEAVE') >= 2, 'attendance marked LEAVE';
  ASSERT (SELECT reason FROM trip_manifest(CURRENT_DATE+2, 'PM')) LIKE 'On leave%', 'manifest: on leave';
  RAISE NOTICE 'Leave ok';
END $$;

DO $$ DECLARE x k%ROWTYPE; r INT; BEGIN
  SELECT * INTO x FROM k;
  BEGIN INSERT INTO parent_requests (tenant_id, ref_no, student_id, requested_by, kind, date_from, date_to, arrival_time) VALUES (1,'A-0',x.s,x.p,'LATE_ARRIVAL',CURRENT_DATE+5,CURRENT_DATE+5,'08:00');
        RAISE EXCEPTION 'arrival before school accepted'; EXCEPTION WHEN check_violation THEN NULL; END;
  INSERT INTO parent_requests (tenant_id, ref_no, student_id, requested_by, kind, date_from, date_to, arrival_time) VALUES (1,'A-1',x.s,x.p,'LATE_ARRIVAL',CURRENT_DATE+5,CURRENT_DATE+5,'10:30') RETURNING request_id INTO r;
  ASSERT (SELECT status FROM parent_requests WHERE request_id = r) = 'APPROVED', 'confirmed at once';
  ASSERT (SELECT reason FROM trip_manifest(CURRENT_DATE+5, 'AM')) = 'Parent dropping at 10:30', 'morning bus told';
  ASSERT (SELECT status FROM trip_manifest(CURRENT_DATE+5, 'PM')) = 'BOARD', 'still rides home';
  PERFORM mark_late_arrival(r, x.p);
  ASSERT (SELECT status FROM student_attendance WHERE att_date = CURRENT_DATE+5) = 'LATE', 'attendance LATE';
  BEGIN PERFORM mark_late_arrival(r, x.p); RAISE EXCEPTION 'arrived twice'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Not an expected%' THEN RAISE; END IF; END;
  RAISE NOTICE 'Late arrival ok';
END $$;

DO $$ DECLARE x k%ROWTYPE; r INT; BEGIN
  SELECT * INTO x FROM k;
  BEGIN INSERT INTO parent_requests (tenant_id, ref_no, student_id, requested_by, kind, date_from, date_to, teacher_staff_id, meet_mode, reason) VALUES (1,'M-0',x.s,x.p,'MEETING',CURRENT_DATE+10,CURRENT_DATE+10,x.stranger,'PHONE','Maths');
        RAISE EXCEPTION 'stranger teacher accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Choose one of your child%' THEN RAISE; END IF; END;
  INSERT INTO parent_requests (tenant_id, ref_no, student_id, requested_by, kind, date_from, date_to, teacher_staff_id, meet_mode, reason) VALUES (1,'M-1',x.s,x.p,'MEETING',CURRENT_DATE+10,CURRENT_DATE+10,x.teacher,'PHONE','Maths') RETURNING request_id INTO r;
  INSERT INTO parent_requests (tenant_id, ref_no, student_id, requested_by, kind, date_from, date_to, teacher_staff_id, meet_mode, reason) VALUES (1,'M-2',x.s,x.p,'MEETING',CURRENT_DATE+10,CURRENT_DATE+10,x.coord,'IN_PERSON','Settling in');
  BEGIN INSERT INTO parent_requests (tenant_id, ref_no, student_id, requested_by, kind, date_from, date_to, teacher_staff_id, meet_mode, reason) VALUES (1,'M-3',x.s,x.p,'MEETING',CURRENT_DATE+10,CURRENT_DATE+10,x.teacher,'VIDEO','again');
        RAISE EXCEPTION 'duplicate meeting accepted'; EXCEPTION WHEN exclusion_violation THEN NULL; END;
  BEGIN PERFORM decide_parent_request(r, x.coord, TRUE, NULL, (CURRENT_DATE + 11) + TIME '15:30'); RAISE EXCEPTION 'other teacher replied'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Only the teacher%' THEN RAISE; END IF; END;
  BEGIN PERFORM decide_parent_request(r, x.teacher, TRUE); RAISE EXCEPTION 'no time accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Pick the date%' THEN RAISE; END IF; END;
  PERFORM decide_parent_request(r, x.teacher, TRUE, 'Staff room', (CURRENT_DATE + 11) + TIME '15:30');
  ASSERT (SELECT meet_at FROM parent_requests WHERE request_id = r) = (CURRENT_DATE + 11) + TIME '15:30', 'time saved';
  ASSERT (SELECT count(*) FROM trip_manifest(CURRENT_DATE+10, 'PM') WHERE status <> 'BOARD') = 0, 'meetings never change the bus';
  RAISE NOTICE 'Meeting ok';
END $$;

DO $$ DECLARE x k%ROWTYPE; r INT; BEGIN
  SELECT * INTO x FROM k;
  INSERT INTO parent_requests (tenant_id, ref_no, student_id, requested_by, kind, date_from, date_to, office_category, reason) VALUES (1,'O-1',x.s,x.p,'OTHER',CURRENT_DATE+7,CURRENT_DATE+7,'Bonafide certificate','Passport') RETURNING request_id INTO r;
  INSERT INTO parent_requests (tenant_id, ref_no, student_id, requested_by, kind, date_from, date_to, office_category, reason) VALUES (1,'O-2',x.s,x.p,'OTHER',CURRENT_DATE+7,CURRENT_DATE+7,'Fee query','Q');
  BEGIN PERFORM decide_parent_request(r, x.teacher, TRUE); RAISE EXCEPTION 'teacher completed office work'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Only the school office%' THEN RAISE; END IF; END;
  PERFORM decide_parent_request(r, x.office, TRUE, 'Ready at the office');
  ASSERT (SELECT status FROM parent_requests WHERE request_id = r) = 'COMPLETED', 'office marks done';
  RAISE NOTICE 'Office ok';
END $$;

DO $$ DECLARE x k%ROWTYPE; BEGIN
  SELECT * INTO x FROM k;
  ASSERT (SELECT array_agg(code ORDER BY sort_order) FROM v_user_mobile_screens WHERE user_id = x.p) @> ARRAY['M_HOME','SELF_REQUESTS']::varchar[], 'parent tabs';
  ASSERT NOT EXISTS (SELECT 1 FROM v_user_mobile_screens WHERE user_id = x.p AND code IN ('STU_REQUESTS','STU_GATE','STU_MEETINGS')), 'parent never gets staff tabs';
  ASSERT EXISTS (SELECT 1 FROM v_user_mobile_screens m JOIN users u USING (user_id) WHERE u.username = 'office' AND m.code = 'STU_GATE'), 'gate on phone for front office';
  INSERT INTO push_devices (tenant_id, user_id, platform, token) VALUES (1, x.p, 'ANDROID', 'tok-1');
  UPDATE users SET status = 'DELETED' WHERE user_id = x.p;
  ASSERT NOT EXISTS (SELECT 1 FROM push_devices WHERE user_id = x.p), 'devices removed on deletion';
  ASSERT NOT EXISTS (SELECT 1 FROM v_user_mobile_screens WHERE user_id = x.p), 'deleted account sees nothing';
  UPDATE tenant_mobile_app SET enabled = FALSE WHERE tenant_id = 1;
  ASSERT NOT EXISTS (SELECT 1 FROM v_user_mobile_screens), 'app off for the school';
  RAISE NOTICE 'Mobile ok';
END $$;
ROLLBACK;
