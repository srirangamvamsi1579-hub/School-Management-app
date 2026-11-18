-- Checks for 009: run on a database with all migrations loaded. One transaction, rolled back.
-- psql -d school -f database/tests/009_checks.sql   (expect NOTICE lines: Collectors ok, No cut-off ok, Timings ok, Route sheets ok, Attendant switch ok)
\set ON_ERROR_STOP 1
SET client_min_messages = notice;
SET TIME ZONE 'Asia/Kolkata';   -- the school's calendar day (checks use CURRENT_DATE)
BEGIN;
INSERT INTO academic_years (tenant_id, name, start_date, end_date, is_current) VALUES (1,'2026-27', CURRENT_DATE - 100, CURRENT_DATE + 200, TRUE);
INSERT INTO classes (tenant_id, name, level_no) VALUES (1,'Grade VIII',8);
INSERT INTO sections (tenant_id, class_id, name) SELECT 1, class_id, 'A' FROM classes;
INSERT INTO users (tenant_id, username, email, password_hash, status) VALUES (1,'fo','fo@x.in','COGNITO','ACTIVE');
INSERT INTO students (tenant_id, admission_no, first_name, dob, admission_date) VALUES (1,'ADM-1','Aarav','2013-01-01','2020-04-01');
INSERT INTO guardians (tenant_id, full_name, relation, phone) VALUES (1, 'Rohit Sharma', 'FATHER', '9812344410');
INSERT INTO student_guardians (tenant_id, student_id, guardian_id, is_primary) SELECT 1, (SELECT student_id FROM students), (SELECT guardian_id FROM guardians), TRUE;
INSERT INTO transport_bands (tenant_id, year_id, band_no) SELECT 1, year_id, 3 FROM academic_years;
INSERT INTO transport_routes (tenant_id, code, name, capacity, band_id, driver_phone, school_arrive, school_leave) SELECT 1, 'R3', 'Zone C', 32, band_id, '9845022003', '08:45', '15:15' FROM transport_bands;
INSERT INTO pickup_points (tenant_id, name, band_id, route_id, stop_order, am_time, pm_time) SELECT 1, 'HSR BDA Complex', band_id, (SELECT route_id FROM transport_routes), 1, '07:25', '16:14' FROM transport_bands;
INSERT INTO pickup_points (tenant_id, name, band_id, route_id, stop_order, am_time, pm_time) SELECT 1, 'Agara Lake', band_id, (SELECT route_id FROM transport_routes), 2, '07:47', '15:52' FROM transport_bands;
INSERT INTO enrollments (tenant_id, student_id, year_id, section_id, pickup_point_id) SELECT 1, (SELECT student_id FROM students), year_id, (SELECT section_id FROM sections), (SELECT point_id FROM pickup_points WHERE name = 'Agara Lake') FROM academic_years;

DO $$ DECLARE s INT; c INT; BEGIN
  SELECT student_id INTO s FROM students;
  ASSERT (SELECT count(*) FROM v_approved_collectors WHERE student_id = s) = 1, 'guardian on record is approved';
  INSERT INTO authorised_collectors (tenant_id, student_id, name, relation, phone, photo_url, id_type, id_last4) VALUES (1, s, 'Meena Sharma', 'Mother', '9812344411', 's3://photos/ms.jpg', 'Aadhaar', '4417') RETURNING collector_id INTO c;
  ASSERT (SELECT count(*) FROM v_approved_collectors WHERE student_id = s) = 1, 'pending person not approved yet';
  BEGIN INSERT INTO parent_requests (tenant_id, ref_no, student_id, requested_by, kind, date_from, date_to, collector_id) VALUES (1, 'R-1', s, (SELECT user_id FROM users WHERE username = 'fo'), 'PICKUP', CURRENT_DATE + 1, CURRENT_DATE + 1, c);
        RAISE EXCEPTION 'pending collector accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Choose a person%' THEN RAISE; END IF; END;
  BEGIN UPDATE authorised_collectors SET status = 'VERIFIED' WHERE collector_id = c; RAISE EXCEPTION 'verified without checker'; EXCEPTION WHEN check_violation THEN NULL; END;
  UPDATE authorised_collectors SET status = 'VERIFIED', verified_by = (SELECT user_id FROM users WHERE username = 'fo'), verified_at = now() WHERE collector_id = c;
  INSERT INTO parent_requests (tenant_id, ref_no, student_id, requested_by, kind, date_from, date_to, collector_id) VALUES (1, 'R-1', s, (SELECT user_id FROM users WHERE username = 'fo'), 'PICKUP', CURRENT_DATE + 1, CURRENT_DATE + 1, c);
  ASSERT (SELECT collector_name || '/' || collector_phone FROM parent_requests WHERE ref_no = 'R-1') = 'Meena Sharma/9812344411', 'collector copied from the approved list';
  RAISE NOTICE 'Collectors ok';
END $$;

DO $$ DECLARE s INT; BEGIN
  SELECT student_id INTO s FROM students;
  INSERT INTO parent_requests (tenant_id, ref_no, student_id, requested_by, kind, date_from, date_to) VALUES (1, 'R-2', s, (SELECT user_id FROM users WHERE username = 'fo'), 'DROP', CURRENT_DATE, CURRENT_DATE);
  ASSERT (SELECT status FROM parent_requests WHERE ref_no = 'R-2') = 'APPROVED', 'same-day drop confirmed at once (no cut-off)';
  RAISE NOTICE 'No cut-off ok';
END $$;

DO $$ BEGIN
  BEGIN UPDATE pickup_points SET am_time = '08:50' WHERE name = 'Agara Lake'; RAISE EXCEPTION 'after school arrival accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Morning pickup%' THEN RAISE; END IF; END;
  BEGIN UPDATE pickup_points SET am_time = '07:20' WHERE name = 'Agara Lake'; RAISE EXCEPTION 'out of order accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Morning times%' THEN RAISE; END IF; END;
  BEGIN UPDATE pickup_points SET pm_time = '15:00' WHERE name = 'Agara Lake'; RAISE EXCEPTION 'drop before leaving accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Afternoon drop%' THEN RAISE; END IF; END;
  RAISE NOTICE 'Timings ok';
END $$;

DO $$ DECLARE t TEXT; BEGIN
  SELECT token INTO t FROM share_route_sheets(1, CURRENT_DATE + 1, (SELECT user_id FROM users WHERE username = 'fo'));
  ASSERT (SELECT count(*) FROM route_sheet_shares) = 1 AND (SELECT sent_to FROM route_sheet_shares) = '9845022003', 'shared with the route driver only';
  ASSERT (SELECT count(*) FROM sms_outbox WHERE purpose = 'ROUTE_SHEET' AND destination = '9845022003') = 1, 'SMS queued';
  ASSERT (SELECT status FROM driver_route_sheet('R3', CURRENT_DATE + 1, t) WHERE trip = 'PM') = 'NOT_BOARDING', 'pickup shows on the afternoon sheet';
  ASSERT (SELECT stop_time FROM driver_route_sheet('R3', CURRENT_DATE + 1, t) WHERE trip = 'AM') = '07:47', 'morning stop time';
  BEGIN PERFORM * FROM driver_route_sheet('R3', CURRENT_DATE + 1, 'wrong'); RAISE EXCEPTION 'bad token accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Link expired%' THEN RAISE; END IF; END;
  RAISE NOTICE 'Route sheets ok';
END $$;

DO $$ DECLARE e INT; BEGIN
  SELECT enrollment_id INTO e FROM enrollments;
  BEGIN INSERT INTO boarding_log (tenant_id, trip_date, direction, enrollment_id, status) VALUES (1, CURRENT_DATE, 'AM', e, 'BOARDED'); RAISE EXCEPTION 'tracking without switch';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Attendant boarding tracking is not%' THEN RAISE; END IF; END;
  INSERT INTO tenant_feature_overrides (tenant_id, feature_id, is_enabled, source) SELECT 1, feature_id, TRUE, 'ADDON' FROM features WHERE code = 'FN_ATTENDANT_TRACKING';
  INSERT INTO boarding_log (tenant_id, trip_date, direction, enrollment_id, status) VALUES (1, CURRENT_DATE, 'AM', e, 'BOARDED');
  RAISE NOTICE 'Attendant switch ok';
END $$;
ROLLBACK;
