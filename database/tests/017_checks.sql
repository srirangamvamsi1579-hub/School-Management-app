-- Checks for 017 (read only / full access). One transaction, rolled back.  Expect NOTICE: Access levels ok
\set ON_ERROR_STOP 1
SET client_min_messages = notice;
SET TIME ZONE 'Asia/Kolkata';
BEGIN;
INSERT INTO users (tenant_id, username, email, password_hash, status, full_name) VALUES
 (1,'drv','drv@example.com','COGNITO','ACTIVE','Ravi Driver'), (1,'adm','adm@example.com','COGNITO','ACTIVE','Asha Admin');
INSERT INTO user_roles SELECT u.user_id, r.role_id FROM users u JOIN roles r ON (u.username, r.code) IN (('drv','TRANSPORT'),('adm','ADMIN'));
DO $$ DECLARE drv INT; adm INT; BEGIN
  SELECT user_id INTO drv FROM users WHERE username = 'drv';
  SELECT user_id INTO adm FROM users WHERE username = 'adm';
  ASSERT can_edit_screen(drv, 'TRN_SHEETS'), 'full by default';
  PERFORM set_department_access(1, 'Transport', 'TRN_SHEETS', 'READ');
  ASSERT EXISTS (SELECT 1 FROM v_user_screens WHERE user_id = drv AND code = 'TRN_SHEETS' AND access_level = 'READ'), 'read only';
  ASSERT NOT can_edit_screen(drv, 'TRN_SHEETS'), 'cannot save';
  PERFORM set_department_access(1, 'Transport', 'FEES', 'READ');
  ASSERT (SELECT count(*) FROM v_user_screens WHERE user_id = drv AND code LIKE 'FEE\_%' AND access_level = 'READ') >= 5, 'whole menu read only';
  PERFORM set_department_access(1, 'Transport', 'FEE_DUES', 'FULL');
  ASSERT can_edit_screen(drv, 'FEE_DUES'), 'one sub-menu full';
  PERFORM set_department_access(1, 'Transport', 'FEE_COLLECT', 'NONE');
  ASSERT NOT EXISTS (SELECT 1 FROM v_user_screens WHERE user_id = drv AND code = 'FEE_COLLECT'), 'no access';
  INSERT INTO user_menu_grants (tenant_id, user_id, menu_id) SELECT 1, drv, menu_id FROM menus WHERE code = 'TRN_SHEETS';
  ASSERT can_edit_screen(drv, 'TRN_SHEETS'), 'personal grant is full';
  ASSERT can_edit_screen(adm, 'OPS_USERS'), 'admin full';
  ASSERT EXISTS (SELECT 1 FROM v_access_summary WHERE user_id = drv AND department = 'Transport' AND sub_menu = 'Dues & Reminders' AND access_level = 'FULL'), 'summary';
  BEGIN PERFORM set_department_access(1, 'Transport', 'VA_PARENT', 'READ'); RAISE EXCEPTION 'view as given';
  EXCEPTION WHEN check_violation THEN NULL; END;
  RAISE NOTICE 'Access levels ok';
END $$;
ROLLBACK;
