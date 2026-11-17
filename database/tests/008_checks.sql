-- Checks for 008: run on a database with all migrations loaded. One transaction, rolled back.
-- psql -d school -f database/tests/008_checks.sql   (expect NOTICE lines: SMS ok, Accounts ok, Visibility ok, Requests ok, Manifest ok)
\set ON_ERROR_STOP 1
SET client_min_messages = notice;
BEGIN;
INSERT INTO academic_years (tenant_id, name, start_date, end_date, is_current) VALUES (1,'2026-27', CURRENT_DATE - 100, CURRENT_DATE + 200, TRUE);
INSERT INTO classes (tenant_id, name, level_no) VALUES (1,'Grade VIII',8);
INSERT INTO sections (tenant_id, class_id, name) SELECT 1, class_id, 'A' FROM classes;
INSERT INTO staff (tenant_id, employee_code, first_name, phone, join_date) VALUES (1,'E1','Sonia','9800000001','2020-06-01'),(1,'E2','Murali','9800000002','2020-06-01'),(1,'E3','Other','9800000003','2020-06-01');
INSERT INTO users (tenant_id, username, email, password_hash, status) VALUES (1,'admin','admin@x.in','COGNITO','ACTIVE'),(1,'parent','p@example.com','COGNITO','ACTIVE'),(1,'principal','pr@x.in','COGNITO','ACTIVE'),(1,'hots','h@x.in','COGNITO','ACTIVE'),(1,'teach','t@x.in','COGNITO','ACTIVE');
INSERT INTO user_roles SELECT u.user_id, r.role_id FROM users u JOIN roles r ON (u.username, r.code) IN (('admin','ADMIN'),('parent','PARENT'),('principal','PRINCIPAL'),('hots','TEACHER'),('teach','TEACHER'));
UPDATE users SET designation_id = (SELECT designation_id FROM designations WHERE tenant_id = 1 AND name = 'Head of Teaching Staff') WHERE username = 'hots';
INSERT INTO students (tenant_id, admission_no, first_name, dob, admission_date) VALUES (1,'ADM-1','Aarav','2013-01-01','2020-04-01'),(1,'ADM-2','Diya','2013-01-01','2020-04-01');
INSERT INTO transport_bands (tenant_id, year_id, band_no) SELECT 1, year_id, 3 FROM academic_years;
INSERT INTO transport_routes (tenant_id, code, name, capacity, band_id) SELECT 1, 'R3', 'Zone C', 32, band_id FROM transport_bands;
INSERT INTO pickup_points (tenant_id, name, band_id, route_id, stop_order) SELECT 1, 'Agara Lake', band_id, (SELECT route_id FROM transport_routes), 2 FROM transport_bands;
INSERT INTO enrollments (tenant_id, student_id, year_id, section_id, pickup_point_id)
SELECT 1, st.student_id, (SELECT year_id FROM academic_years), (SELECT section_id FROM sections), (SELECT point_id FROM pickup_points) FROM students st;
INSERT INTO class_coordinators SELECT 1, (SELECT year_id FROM academic_years), (SELECT section_id FROM sections), v.l, (SELECT staff_id FROM staff WHERE employee_code = v.c) FROM (VALUES ('PRIMARY','E1'),('SECONDARY','E2')) v(l,c);
INSERT INTO guardians (tenant_id, full_name, relation, phone) VALUES (1, 'Rohit', 'FATHER', '9812344410');
INSERT INTO student_guardians (tenant_id, student_id, guardian_id, is_primary) SELECT 1, student_id, (SELECT guardian_id FROM guardians), TRUE FROM students WHERE admission_no = 'ADM-1';
INSERT INTO user_children SELECT 1, (SELECT user_id FROM users WHERE username='parent'), student_id FROM students WHERE admission_no = 'ADM-1';

DO $$ DECLARE r RECORD; BEGIN
  SELECT * INTO r FROM request_otp(1, '9845011200', 'SMS', 'SIGNIN');
  ASSERT r.status = 'GATEWAY_PENDING';
  ASSERT (SELECT status FROM sms_outbox WHERE related_ref = 'OTP-' || r.otp_id) = 'QUEUED', 'OTP SMS queued';
  ASSERT (SELECT vars FROM sms_outbox WHERE related_ref = 'OTP-' || r.otp_id) = '{}'::jsonb, 'code not kept in vars';
  PERFORM queue_sms(1, '+91 98450 11201', 'FEE_REMINDER', '{"school":"GVS","amount":"₹10","student":"A","date":"10 Dec","link":"x"}');
  BEGIN UPDATE sms_gateway_config SET status = 'LIVE' WHERE tenant_id = 1; RAISE EXCEPTION 'live without provider'; EXCEPTION WHEN check_violation THEN NULL; END;
  UPDATE sms_outbox SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 minute' WHERE purpose = 'OTP';
  UPDATE sms_gateway_config SET provider = 'MSG91', sender_id = 'GVSSCH', secret_arn = 'arn:x', status = 'LIVE' WHERE tenant_id = 1;
  ASSERT (SELECT status FROM sms_outbox WHERE purpose = 'OTP') = 'EXPIRED', 'stale OTP expired on go-live';
  ASSERT (SELECT body FROM sms_outbox WHERE purpose = 'OTP') NOT SIMILAR TO '%[0-9]{6}%', 'OTP body blanked';
  ASSERT (SELECT status FROM sms_outbox WHERE purpose = 'FEE_REMINDER') = 'QUEUED', 'fee reminder waits for dispatcher';
  RAISE NOTICE 'SMS ok';
END $$;

DO $$ DECLARE a INT; p INT; BEGIN
  SELECT user_id INTO a FROM users WHERE username='admin'; SELECT user_id INTO p FROM users WHERE username='parent';
  INSERT INTO account_requests (tenant_id, user_id, kind) VALUES (1, p, 'CLOSE');
  PERFORM close_account(a, p);
  ASSERT (SELECT status = 'DELETED' AND email IS NULL AND phone IS NULL FROM users WHERE user_id = p);
  ASSERT NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = p) AND NOT EXISTS (SELECT 1 FROM user_children WHERE user_id = p);
  ASSERT (SELECT status FROM account_requests WHERE user_id = p) = 'DONE';
  RAISE NOTICE 'Accounts ok';
END $$;

DO $$ BEGIN
  BEGIN PERFORM set_teacher_perf_visibility((SELECT user_id FROM users WHERE username='teach'), TRUE); RAISE EXCEPTION 'teacher shared'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Only the Principal%' THEN RAISE; END IF; END;
  PERFORM set_teacher_perf_visibility((SELECT user_id FROM users WHERE username='hots'), TRUE);
  PERFORM set_teacher_perf_visibility((SELECT user_id FROM users WHERE username='principal'), FALSE);
  ASSERT (SELECT value FROM tenant_settings WHERE key = 'teacher_perf_shared') = 'false'::jsonb;
  RAISE NOTICE 'Visibility ok';
END $$;

-- requests (requested_by = admin, since the parent account was closed above)
INSERT INTO parent_requests (tenant_id, ref_no, student_id, requested_by, kind, date_from, date_to, leave_time, reason, collector_id)
SELECT 1, 'REQ-1', (SELECT student_id FROM students WHERE admission_no='ADM-1'), (SELECT user_id FROM users WHERE username='admin'), 'EARLY_LEAVE', CURRENT_DATE + 1, CURRENT_DATE + 1, '11:30', 'Doctor', -(SELECT guardian_id FROM guardians);
INSERT INTO parent_requests (tenant_id, ref_no, student_id, requested_by, kind, date_from, date_to)
SELECT 1, 'REQ-2', (SELECT student_id FROM students WHERE admission_no='ADM-2'), (SELECT user_id FROM users WHERE username='admin'), 'OWN_TRANSPORT', CURRENT_DATE + 2, CURRENT_DATE + 3;
DO $$ DECLARE rid INT; code TEXT; BEGIN
  SELECT request_id INTO rid FROM parent_requests WHERE ref_no = 'REQ-1';
  ASSERT (SELECT status FROM parent_requests WHERE request_id = rid) = 'SUBMITTED', 'early leave waits';
  ASSERT (SELECT status FROM parent_requests WHERE ref_no = 'REQ-2') = 'APPROVED', 'own transport confirmed at once';
  BEGIN PERFORM decide_parent_request(rid, (SELECT staff_id FROM staff WHERE employee_code='E3'), TRUE); RAISE EXCEPTION 'non-coordinator decided'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Only this class%' THEN RAISE; END IF; END;
  code := decide_parent_request(rid, (SELECT staff_id FROM staff WHERE employee_code='E2'), TRUE);
  ASSERT code ~ '^\d{4}$';
  BEGIN PERFORM hand_over_student(rid, CASE WHEN code = '0000' THEN '1111' ELSE '0000' END, 1); RAISE EXCEPTION 'wrong code accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Gate code%' THEN RAISE; END IF; END;
  PERFORM hand_over_student(rid, code, (SELECT user_id FROM users WHERE username='admin'));
  ASSERT (SELECT status FROM parent_requests WHERE request_id = rid) = 'COMPLETED';
  BEGIN INSERT INTO parent_requests (tenant_id, ref_no, student_id, requested_by, kind, date_from, date_to, leave_time, collector_name, collector_phone)
        SELECT 1, 'REQ-3', student_id, 1, 'EARLY_LEAVE', CURRENT_DATE + 1, CURRENT_DATE + 1, '15:30', 'X', '9812344410' FROM students WHERE admission_no='ADM-2';
        RAISE EXCEPTION 'late early-leave accepted'; EXCEPTION WHEN check_violation OR raise_exception THEN IF SQLERRM LIKE 'late early%' THEN RAISE; END IF; END;
  RAISE NOTICE 'Requests ok';
END $$;

DO $$ BEGIN
  ASSERT (SELECT count(*) FROM trip_manifest(CURRENT_DATE + 5, 'AM') WHERE status = 'BOARD') = 2, 'both ride normally';
  ASSERT (SELECT status FROM trip_manifest(CURRENT_DATE + 1, 'PM') WHERE student_name LIKE 'Aarav%') = 'NOT_BOARDING';
  ASSERT (SELECT reason FROM trip_manifest(CURRENT_DATE + 1, 'PM') WHERE student_name LIKE 'Aarav%') LIKE 'Left early at % with Rohit (Father)';
  ASSERT (SELECT status FROM trip_manifest(CURRENT_DATE + 1, 'AM') WHERE student_name LIKE 'Aarav%') = 'BOARD', 'early leave does not affect the morning';
  ASSERT (SELECT reason FROM trip_manifest(CURRENT_DATE + 3, 'AM') WHERE student_name LIKE 'Diya%') = 'Own transport';
  INSERT INTO student_attendance (tenant_id, enrollment_id, att_date, status) SELECT 1, enrollment_id, CURRENT_DATE + 5, 'ABSENT' FROM enrollments e JOIN students s USING (student_id) WHERE s.admission_no = 'ADM-2';
  ASSERT (SELECT status FROM trip_manifest(CURRENT_DATE + 5, 'AM') WHERE student_name LIKE 'Diya%') = 'ABSENT';
  RAISE NOTICE 'Manifest ok';
END $$;
ROLLBACK;
