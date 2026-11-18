-- Checks for 014 (departments per user profile). One transaction, rolled back.  Expect NOTICE: Departments ok
\set ON_ERROR_STOP 1
SET client_min_messages = notice;
SET TIME ZONE 'Asia/Kolkata';
BEGIN;
DO $$ DECLARE s INT; BEGIN
  ASSERT department_of(1, 'TRANSPORT') = 'Transport', 'standard department';
  ASSERT department_of(1, 'TEACHER') = 'Academics', 'teachers in Academics';
  PERFORM set_role_department(1, 'TEACHER', 'Teaching Staff');
  ASSERT department_of(1, 'TEACHER') = 'Teaching Staff', 'school renamed it';
  PERFORM set_role_department(1, 'TEACHER', 'Academics & Teaching');
  ASSERT (SELECT count(*) FROM role_departments WHERE tenant_id = 1 AND role_code = 'TEACHER') = 1, 'one row per school and profile';
  INSERT INTO roles (tenant_id, code, name, is_system, based_on_role_id) SELECT 1, 'R_TRANSPORT_MGR', 'Transport Manager', FALSE, role_id FROM roles WHERE code = 'TRANSPORT';
  ASSERT department_of(1, 'R_TRANSPORT_MGR') = 'Transport', 'new profile takes its base department';
  INSERT INTO roles (tenant_id, code, name, is_system, based_on_role_id, department) SELECT 1, 'R_WARDEN', 'Hostel Warden', FALSE, role_id, 'Hostel' FROM roles WHERE code = 'FRONT_OFFICE';
  ASSERT department_of(1, 'R_WARDEN') = 'Hostel', 'new profile with its own department';
  BEGIN PERFORM set_role_department(1, 'PARENT', 'X'); RAISE EXCEPTION 'parent got a department';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Parents are not%' THEN RAISE; END IF; END;
  INSERT INTO users (tenant_id, username, email, password_hash, status, full_name, requested_role)
  VALUES (1, 'kiran', 'kiran.bus@example.com', 'COGNITO', 'PENDING', 'Kiran Bus', 'TRANSPORT') RETURNING user_id INTO s;
  ASSERT (SELECT department FROM v_user_directory WHERE user_id = s) = 'Transport', 'pending sign-up shows its department';
  RAISE NOTICE 'Departments ok';
END $$;
ROLLBACK;
