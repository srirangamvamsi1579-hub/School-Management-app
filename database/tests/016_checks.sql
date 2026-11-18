-- Checks for 016 (access by department, deleting a profile). One transaction, rolled back.
-- Expect NOTICE lines: Department access ok, Profiles ok
\set ON_ERROR_STOP 1
SET client_min_messages = notice;
SET TIME ZONE 'Asia/Kolkata';
BEGIN;
SET CONSTRAINTS ALL IMMEDIATE;
INSERT INTO users (tenant_id, username, email, password_hash, status) VALUES
 (1,'adm','adm@example.com','COGNITO','ACTIVE'), (1,'drv','drv@example.com','COGNITO','ACTIVE'), (1,'tm','tm@example.com','COGNITO','ACTIVE');
INSERT INTO user_roles SELECT u.user_id, r.role_id FROM users u JOIN roles r ON (u.username, r.code) IN (('adm','ADMIN'),('drv','TRANSPORT'));
DO $$ DECLARE drv INT; tm INT; adm INT; BEGIN
  SELECT user_id INTO drv FROM users WHERE username = 'drv';
  SELECT user_id INTO tm FROM users WHERE username = 'tm';
  SELECT user_id INTO adm FROM users WHERE username = 'adm';
  ASSERT EXISTS (SELECT 1 FROM department_menu_permissions WHERE tenant_id = 1 AND department = 'Transport'), 'Transport has a list';
  ASSERT EXISTS (SELECT 1 FROM v_user_screens WHERE user_id = drv AND code = 'TRN_SHEETS'), 'driver sees route sheets via department';
  -- whole main menu
  PERFORM set_department_menu(1, 'Transport', 'FEES', TRUE);
  ASSERT EXISTS (SELECT 1 FROM v_user_screens WHERE user_id = drv AND code = 'FEE_DUES'), 'whole Fees menu given';
  PERFORM set_department_menu(1, 'Transport', 'FEE_COLLECT', FALSE);
  ASSERT NOT EXISTS (SELECT 1 FROM v_user_screens WHERE user_id = drv AND code = 'FEE_COLLECT'), 'one sub-menu taken back';
  ASSERT EXISTS (SELECT 1 FROM v_user_screens WHERE user_id = drv AND code = 'FEE_DUES'), 'others stay';
  BEGIN PERFORM set_department_menu(1, 'Transport', 'VA_PARENT', TRUE); RAISE EXCEPTION 'view as given';
  EXCEPTION WHEN check_violation THEN NULL; END;
  -- a new profile joining Transport gets the same screens; one in a new department starts from its base
  INSERT INTO roles (tenant_id, code, name, is_system, based_on_role_id, department) SELECT 1, 'R_TM', 'Transport Manager', FALSE, role_id, 'Transport' FROM roles WHERE code = 'FRONT_OFFICE';
  INSERT INTO user_roles SELECT tm, role_id FROM roles WHERE code = 'R_TM';
  ASSERT EXISTS (SELECT 1 FROM v_user_screens WHERE user_id = tm AND code = 'FEE_DUES'), 'joined Transport, same screens';
  INSERT INTO roles (tenant_id, code, name, is_system, based_on_role_id, department) SELECT 1, 'R_HOSTEL', 'Hostel Staff', FALSE, role_id, 'Hostel & Boarding' FROM roles WHERE code = 'FRONT_OFFICE';
  ASSERT sync_department_permissions(1) = 1, 'one new department';
  ASSERT EXISTS (SELECT 1 FROM department_menu_permissions dp JOIN menus m USING (menu_id) WHERE dp.department = 'Hostel & Boarding' AND m.code = 'STU_GATE'), 'started from Front Office';
  ASSERT EXISTS (SELECT 1 FROM v_user_screens WHERE user_id = adm AND code = 'OPS_USERS'), 'Admin keeps everything';
  RAISE NOTICE 'Department access ok';
  -- deleting profiles
  BEGIN PERFORM remove_profile(1, 'ADMIN'); RAISE EXCEPTION 'admin deleted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'The Admin profile cannot%' THEN RAISE; END IF; END;
  BEGIN PERFORM remove_profile(1, 'TRANSPORT'); RAISE EXCEPTION 'deleted while held';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '1 person has the Transport team profile%' THEN RAISE; END IF; END;
  PERFORM remove_profile(1, 'ACCOUNTANT');
  ASSERT NOT EXISTS (SELECT 1 FROM v_tenant_profiles WHERE tenant_id = 1 AND code = 'ACCOUNTANT'), 'hidden for the school';
  ASSERT EXISTS (SELECT 1 FROM roles WHERE code = 'ACCOUNTANT'), 'shared role kept for other schools';
  PERFORM restore_profile(1, 'ACCOUNTANT');
  ASSERT EXISTS (SELECT 1 FROM v_tenant_profiles WHERE tenant_id = 1 AND code = 'ACCOUNTANT'), 'restored';
  PERFORM remove_profile(1, 'R_HOSTEL');
  ASSERT NOT EXISTS (SELECT 1 FROM roles WHERE code = 'R_HOSTEL'), 'school-added profile removed';
  RAISE NOTICE 'Profiles ok';
END $$;
ROLLBACK;
