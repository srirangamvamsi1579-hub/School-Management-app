-- Checks for 023 (staff checked against the staff record; nobody waits for approval). Rolled back.  Expect NOTICE: Staff registration ok
\set ON_ERROR_STOP 1
SET client_min_messages = notice;
BEGIN;
INSERT INTO designations (tenant_id, name) VALUES (1, 'PRT') ON CONFLICT DO NOTHING;
INSERT INTO staff (tenant_id, employee_code, first_name, last_name, phone, email, join_date, designation_id)
SELECT 1, 'EMP-0131', 'Kavya', 'Iyer', '9845077001', 'kavya.iyer@example.com', '2026-11-16', designation_id FROM designations WHERE tenant_id = 1 AND name = 'PRT';
DO $$ DECLARE u INT; i INT; BEGIN
  ASSERT role_for_designation(1, 'PRT') = 'TEACHER', 'PRT is a teacher';
  ASSERT register_staff_via('APP', 1, 'kavya.iyer@example.com', 'Kavya', 'Iyer', 'EMP-0999') IS NULL, 'wrong code';
  ASSERT register_staff_via('APP', 1, 'other@example.com', 'Kavya', 'Iyer', 'EMP-0131') IS NULL, 'email not on the staff record';
  ASSERT register_staff_via('APP', 1, 'kavya.iyer@example.com', 'Divya', 'Iyer', 'EMP-0131') IS NULL, 'wrong name';
  ASSERT NOT EXISTS (SELECT 1 FROM users WHERE email = 'kavya.iyer@example.com'), 'nothing created';
  u := register_staff_via('APP', 1, 'kavya.iyer@example.com', 'kavya', 'IYER', 'emp-0131');
  ASSERT (SELECT (status, created_via) FROM users WHERE user_id = u) = ('ACTIVE'::varchar, 'APP'::varchar), 'active at once';
  ASSERT (SELECT role_code || '|' || designation FROM v_user_directory WHERE user_id = u) = 'TEACHER|PRT', 'role and designation from the staff record';
  ASSERT (SELECT staff_id FROM users WHERE user_id = u) IS NOT NULL, 'linked to the staff record';
  ASSERT NOT EXISTS (SELECT 1 FROM parent_signup_checks WHERE sign_in_id = 'kavya.iyer@example.com'), 'tries cleared';
  BEGIN PERFORM register_staff_via('ADMIN', 1, 'x@example.com', 'X', 'Y', 'EMP-0131'); RAISE EXCEPTION 'admin channel';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Staff register%' THEN RAISE; END IF; END;
  FOR i IN 1..5 LOOP PERFORM register_staff_via('WEBSITE', 1, 'guess23@example.com', 'G', 'H', 'EMP-0131'); END LOOP;
  BEGIN PERFORM register_staff_via('WEBSITE', 1, 'guess23@example.com', 'G', 'H', 'EMP-0131'); RAISE EXCEPTION 'sixth try';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Too many tries%' THEN RAISE; END IF; END;
  BEGIN UPDATE users SET status = 'PENDING' WHERE user_id = u; RAISE EXCEPTION 'pending allowed';
  EXCEPTION WHEN check_violation THEN NULL; END;
  RAISE NOTICE 'Staff registration ok';
END $$;
ROLLBACK;
