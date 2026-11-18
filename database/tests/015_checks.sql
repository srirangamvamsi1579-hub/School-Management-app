-- Checks for 015 (removing designations). One transaction, rolled back.  Expect NOTICE: Removals ok
\set ON_ERROR_STOP 1
SET client_min_messages = notice;
SET TIME ZONE 'Asia/Kolkata';
BEGIN;
SET CONSTRAINTS ALL IMMEDIATE;
INSERT INTO users (tenant_id, username, email, password_hash, status) VALUES (1,'inch','inch@example.com','COGNITO','ACTIVE');
INSERT INTO user_roles SELECT u.user_id, r.role_id FROM users u, roles r WHERE u.username = 'inch' AND r.code = 'TRANSPORT';
DO $$ DECLARE u INT; BEGIN
  SELECT user_id INTO u FROM users WHERE username = 'inch';
  PERFORM set_user_designation(u, 'Transport In-charge');
  PERFORM remove_role_designation(1, 'TRANSPORT', 'Cleaner');
  ASSERT NOT 'Cleaner' = ANY (ARRAY(SELECT designations_for(1, 'TRANSPORT'))), 'standard designation removed';
  ASSERT 'Driver' = ANY (ARRAY(SELECT designations_for(1, 'TRANSPORT'))), 'others stay';
  BEGIN PERFORM remove_role_designation(1, 'TRANSPORT', 'Transport In-charge'); RAISE EXCEPTION 'removed while held';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '1 person has%' THEN RAISE; END IF; END;
  INSERT INTO roles (tenant_id, code, name, is_system, based_on_role_id) SELECT 1, 'R_TM', 'Transport Manager', FALSE, role_id FROM roles WHERE code = 'TRANSPORT';
  ASSERT NOT 'Cleaner' = ANY (ARRAY(SELECT designations_for(1, 'R_TM'))), 'copied profile drops it too';
  PERFORM add_role_designation(1, 'R_TM', 'Cleaner');
  ASSERT 'Cleaner' = ANY (ARRAY(SELECT designations_for(1, 'R_TM'))), 'copied profile can add it back for itself';
  BEGIN PERFORM set_user_designation(u, 'Cleaner'); RAISE EXCEPTION 'removed designation still accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  PERFORM add_role_designation(1, 'TRANSPORT', 'cleaner');
  ASSERT 'Cleaner' = ANY (ARRAY(SELECT designations_for(1, 'TRANSPORT'))), 'brought back';
  ASSERT (SELECT count(*) FROM role_designations WHERE tenant_id = 1 AND role_code = 'TRANSPORT') = 0, 'no duplicate extra row';
  PERFORM add_role_designation(1, 'TRANSPORT', 'Route Marshal');
  PERFORM remove_role_designation(1, 'TRANSPORT', 'Route Marshal');
  ASSERT NOT EXISTS (SELECT 1 FROM role_designations WHERE tenant_id = 1 AND designation = 'Route Marshal'), 'school extra deleted';
  RAISE NOTICE 'Removals ok';
END $$;
ROLLBACK;
