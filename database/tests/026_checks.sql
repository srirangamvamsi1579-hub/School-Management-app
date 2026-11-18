-- Checks for 026 (release 12). Rolled back.  Expect NOTICE: Release 12 menus ok, Staff leave ok, Report cards and transport ok, Templates ok
\set ON_ERROR_STOP 1
SET client_min_messages = notice;
BEGIN;
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM menus WHERE code IN ('STU_PROFILE', 'STU_REPORTCARD', 'SELF_LEAVE', 'OPS_HELPDOCS', 'HELP_FAQ', 'HELP_GUIDE')) = 6, 'new menus';
  ASSERT NOT EXISTS (SELECT 1 FROM menus WHERE code IN ('STU_PROMOTE', 'STF_ADD')), 'Promote and Add Staff gone';
  ASSERT (SELECT p.code FROM menus m JOIN menus p ON p.menu_id = m.parent_id WHERE m.code = 'OPS_HELPDOCS') = 'OPERATIONS', 'help documents under Operations';
  ASSERT (SELECT count(*) FROM plan_features pf JOIN features f USING (feature_id) WHERE f.code = 'STU_REPORTCARD') = (SELECT count(*) FROM plans), 'report cards in every plan';
  ASSERT EXISTS (SELECT 1 FROM role_menu_permissions p JOIN roles r USING (role_id) JOIN menus m USING (menu_id) WHERE r.code = 'ADMIN' AND m.code = 'STF_LIST' AND p.can_create), 'adding staff kept in All Staff';
  ASSERT EXISTS (SELECT 1 FROM role_menu_permissions p JOIN roles r USING (role_id) JOIN menus m USING (menu_id) WHERE r.code = 'TEACHER' AND m.code = 'SELF_LEAVE'), 'teachers have My Leave';
  ASSERT NOT EXISTS (SELECT 1 FROM role_menu_permissions p JOIN roles r USING (role_id) JOIN menus m USING (menu_id) WHERE r.code = 'TEACHER' AND r.tenant_id IS NULL AND m.code = 'STF_LEAVE'), 'teachers no longer approve';
  ASSERT EXISTS (SELECT 1 FROM designation_menu_access a JOIN designations d USING (designation_id) JOIN menus m USING (menu_id) WHERE d.name = 'Vice Principal' AND m.code = 'STF_LEAVE'), 'the Vice Principal approves';
  ASSERT (SELECT count(*) FROM leave_types WHERE tenant_id = 1) = 7, 'leave types';
  RAISE NOTICE 'Release 12 menus ok';
END $$;

-- People: a teacher (TGT), an accountant, the Principal, a Vice Principal and an Admin
INSERT INTO designations (tenant_id, name) VALUES (1, 'TGT'), (1, 'Principal'), (1, 'Accountant') ON CONFLICT DO NOTHING;
INSERT INTO staff (tenant_id, employee_code, first_name, last_name, gender, phone, join_date, designation_id, employment_type)
SELECT 1, v.code, v.f, v.l, v.g, v.ph, DATE '2020-06-01', d.designation_id, v.t FROM (VALUES
  ('EMP-9001', 'Sonia', 'Test', 'Female', '9845090001', 'TGT', 'FULL_TIME'), ('EMP-9002', 'Sana', 'Test', 'Female', '9845090002', 'Accountant', 'PART_TIME'),
  ('EMP-9003', 'Kavita', 'Test', 'Female', '9845090003', 'Principal', 'FULL_TIME'), ('EMP-9004', 'Meera', 'Test', 'Female', '9845090004', 'Vice Principal', 'FULL_TIME')
) AS v(code, f, l, g, ph, desig, t) JOIN designations d ON d.tenant_id = 1 AND d.name = v.desig;
INSERT INTO users (tenant_id, username, email, password_hash, status, full_name, staff_id, designation_id)
SELECT 1, v.u, v.u || '@example.com', 'COGNITO', 'ACTIVE', v.n, s.staff_id, s.designation_id FROM (VALUES ('t26', 'Sonia Test', 'EMP-9001'), ('a26', 'Sana Test', 'EMP-9002'), ('p26', 'Kavita Test', 'EMP-9003'), ('vp26', 'Meera Test', 'EMP-9004')) AS v(u, n, code)
JOIN staff s ON s.employee_code = v.code;
INSERT INTO users (tenant_id, username, email, password_hash, status, full_name) VALUES (1, 'ad26', 'ad26@example.com', 'COGNITO', 'ACTIVE', 'Admin Test');
INSERT INTO user_roles SELECT u.user_id, r.role_id FROM users u JOIN roles r ON r.tenant_id IS NULL AND (u.username, r.code) IN (('t26', 'TEACHER'), ('a26', 'ACCOUNTANT'), ('p26', 'PRINCIPAL'), ('vp26', 'TEACHER'), ('ad26', 'ADMIN'));

DO $$ DECLARE t INT; a INT; p INT; vp INT; ad INT; ts INT; ps INT; asf INT; l INT; mon DATE; BEGIN
  SELECT user_id INTO t FROM users WHERE username = 't26'; SELECT user_id INTO a FROM users WHERE username = 'a26';
  SELECT user_id INTO p FROM users WHERE username = 'p26'; SELECT user_id INTO vp FROM users WHERE username = 'vp26'; SELECT user_id INTO ad FROM users WHERE username = 'ad26';
  SELECT staff_id INTO ts FROM staff WHERE employee_code = 'EMP-9001'; SELECT staff_id INTO asf FROM staff WHERE employee_code = 'EMP-9002'; SELECT staff_id INTO ps FROM staff WHERE employee_code = 'EMP-9003';
  mon := current_date + 8 + ((8 - EXTRACT(DOW FROM current_date + 8)::int) % 7);        -- a Monday at least a week ahead
  ASSERT leave_approvers(ts) @> ARRAY[p, vp] AND NOT leave_approvers(ts) @> ARRAY[ad], 'teacher: Principal and Vice Principal';
  ASSERT leave_approvers(asf) @> ARRAY[p, ad] AND NOT leave_approvers(asf) @> ARRAY[vp], 'office staff: Principal and Admin';
  ASSERT leave_approvers(ps) = ARRAY[ad], 'the Principal: the Admin';
  ASSERT leave_days(1, mon, mon + 6) = 6, 'Sunday does not count';
  INSERT INTO school_holidays VALUES (1, mon + 1, 'Test holiday');
  ASSERT leave_days(1, mon, mon + 6) = 5, 'holidays do not count';
  BEGIN PERFORM apply_staff_leave(ts, 'CL', mon, mon + 5, 'Trip'); RAISE EXCEPTION 'too long';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%up to 3 days%' THEN RAISE; END IF; END;
  BEGIN PERFORM apply_staff_leave(asf, 'EL', mon, mon, 'Trip'); RAISE EXCEPTION 'part-time earned leave';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%full-time staff only%' THEN RAISE; END IF; END;
  BEGIN PERFORM apply_staff_leave(ts, 'PL', mon, mon, 'x'); RAISE EXCEPTION 'paternity for a woman';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%not available%' THEN RAISE; END IF; END;
  BEGIN PERFORM apply_staff_leave(ts, 'CL', current_date - 2, current_date - 2, 'Late'); RAISE EXCEPTION 'after the day';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Only sick leave%' THEN RAISE; END IF; END;
  l := apply_staff_leave(ts, 'CL', mon, mon + 2, 'Family function');
  ASSERT (SELECT days FROM leave_requests WHERE leave_id = l) = 2, 'two working days (one is a holiday)';
  ASSERT (SELECT count(*) FROM app_notifications WHERE screen_code = 'STF_LEAVE' AND user_id IN (p, vp)) = 2, 'both approvers notified';
  ASSERT EXISTS (SELECT 1 FROM email_outbox WHERE to_email = 'p26@example.com' AND kind = 'LEAVE'), 'and emailed';
  BEGIN PERFORM apply_staff_leave(ts, 'SL', mon, mon, 'Fever'); RAISE EXCEPTION 'overlap';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Overlaps%' THEN RAISE; END IF; END;
  BEGIN PERFORM decide_staff_leave(l, ad, 'APPROVED'); RAISE EXCEPTION 'admin is not an approver for a teacher';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'You are not an approver%' THEN RAISE; END IF; END;
  BEGIN PERFORM decide_staff_leave(l, p, 'DECLINED', ''); RAISE EXCEPTION 'decline without reason';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Give a reason%' THEN RAISE; END IF; END;
  PERFORM decide_staff_leave(l, vp, 'APPROVED');
  ASSERT (SELECT count(*) FROM staff_attendance WHERE staff_id = ts AND status = 'LEAVE') = 2, 'the register shows the leave days';
  ASSERT EXISTS (SELECT 1 FROM app_notifications WHERE user_id = t AND title LIKE 'Leave approved%'), 'the teacher is told';
  ASSERT NOT EXISTS (SELECT 1 FROM app_notifications WHERE user_id = p AND screen_code = 'STF_LEAVE' AND read_at IS NULL), 'the other approver no longer has it waiting';
  ASSERT (SELECT days_left FROM v_leave_balances WHERE staff_id = ts AND leave_code = 'CL') = 10, 'balance';
  BEGIN PERFORM decide_staff_leave(l, p, 'APPROVED'); RAISE EXCEPTION 'decided twice';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%already been decided%' THEN RAISE; END IF; END;
  FOR i IN 1..3 LOOP PERFORM apply_staff_leave(ts, 'CL', mon + 7 * i, mon + 7 * i + 2, 'Week ' || i); END LOOP;   -- 2 + 3 × 3 = 11 of 12
  BEGIN PERFORM apply_staff_leave(ts, 'CL', mon + 35, mon + 36, 'One more'); RAISE EXCEPTION 'over the allowance';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Only 1%' THEN RAISE; END IF; END;
  BEGIN UPDATE staff SET employment_type = 'CONTRACT' WHERE staff_id = ts; RAISE EXCEPTION 'type';
  EXCEPTION WHEN check_violation THEN NULL; END;
  ASSERT (SELECT staff FROM v_staff_by_type WHERE tenant_id = 1 AND employment_type = 'PART_TIME') >= 1, 'staff by type';
  RAISE NOTICE 'Staff leave ok';
END $$;

DO $$ DECLARE b1 INT; b2 INT; BEGIN
  ASSERT cbse_grade(91) = 'A1' AND cbse_grade(90.9) = 'A2' AND cbse_grade(33) = 'D' AND cbse_grade(32.9) = 'E', 'CBSE grades';
  INSERT INTO buses (tenant_id, registration, seats, status) VALUES (1, 'KA-01-T-0001', 40, 'IN_SERVICE') RETURNING bus_id INTO b1;
  INSERT INTO buses (tenant_id, registration, seats, status) VALUES (1, 'KA-01-T-0002', 32, 'SPARE') RETURNING bus_id INTO b2;
  INSERT INTO bus_incidents (tenant_id, bus_id, incident_date, kind, detail, trip, delay_min, covered_by) VALUES (1, b1, current_date, 'Breakdown', 'Test', 'AM', 40, b2);
  BEGIN INSERT INTO bus_incidents (tenant_id, bus_id, incident_date, kind, detail, trip) VALUES (1, b1, current_date + 1, 'Breakdown', 'Future', 'AM'); RAISE EXCEPTION 'future';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN INSERT INTO bus_incidents (tenant_id, bus_id, incident_date, kind, detail, trip, covered_by) VALUES (1, b1, current_date, 'Breakdown', 'Self', 'AM', b1); RAISE EXCEPTION 'covers itself';
  EXCEPTION WHEN check_violation THEN NULL; END;
  ASSERT (SELECT (buses, spare, incidents_this_year) FROM v_fleet_summary WHERE tenant_id = 1) = (2::bigint, 1::bigint, 1::bigint), 'fleet summary';
  BEGIN INSERT INTO help_documents (tenant_id, title, kind, url) VALUES (1, 'Bad', 'LINK', 'http://example.com'); RAISE EXCEPTION 'http';
  EXCEPTION WHEN check_violation THEN NULL; END;
  INSERT INTO help_documents (tenant_id, title, kind, url, menu_code, roles) VALUES (1, 'Handbook', 'LINK', 'https://www.example.com/h.pdf', 'HELP_FAQ', '{PARENT}');
  RAISE NOTICE 'Report cards and transport ok';
END $$;

DO $$ BEGIN
  ASSERT (SELECT count(*) FROM import_templates) = 20, '20 templates';
  ASSERT (SELECT count(*) FROM import_template_columns) = 141, 'every column';
  ASSERT template_for_file('02_Student_Data.xlsx') = 2 AND template_for_file('02_Student_Data_GVS_20261118.xlsx') = 2, 'student file';
  ASSERT template_for_file('02_Staff_Data.xlsx') IS NULL AND template_for_file('Students.xlsx') IS NULL, 'number and name must agree';
  ASSERT NOT EXISTS (SELECT 1 FROM import_templates t WHERE NOT EXISTS (SELECT 1 FROM import_template_columns c WHERE c.template_no = t.template_no AND c.required)), 'each has required columns';
  RAISE NOTICE 'Templates ok';
END $$;
ROLLBACK;
