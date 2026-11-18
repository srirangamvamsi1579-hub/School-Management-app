-- Checks for 013 (designations by role, sign-ups, View as). One transaction, rolled back.
-- Expect NOTICE lines: Lists ok, Fit ok, Sign-up ok, View as ok
\set ON_ERROR_STOP 1
SET client_min_messages = notice;
SET TIME ZONE 'Asia/Kolkata';   -- the school's calendar day (checks use CURRENT_DATE)
BEGIN;
SET CONSTRAINTS ALL IMMEDIATE;     -- check each statement, so a bad designation fails at once

DO $$ BEGIN
  ASSERT ARRAY(SELECT designations_for(1, 'TRANSPORT')) = ARRAY['Transport In-charge','Transport Supervisor','Driver','Cleaner','Bus Helper / Attendant']::varchar[], 'transport list';
  ASSERT ARRAY(SELECT designations_for(1, 'PARENT')) = ARRAY['Parent']::varchar[], 'parent list';
  ASSERT NOT ('Driver' = ANY (ARRAY(SELECT designations_for(1, 'TEACHER')))), 'no driver for teachers';
  INSERT INTO role_designations (tenant_id, role_code, designation, sort_order) VALUES (1, 'TRANSPORT', 'Route Marshal', 9);
  ASSERT 'Route Marshal' = ANY (ARRAY(SELECT designations_for(1, 'TRANSPORT'))), 'school extra offered';
  INSERT INTO roles (tenant_id, code, name, is_system, based_on_role_id) SELECT 1, 'R_TRANSPORT_MGR', 'Transport Manager', FALSE, role_id FROM roles WHERE code = 'TRANSPORT';
  ASSERT 'Driver' = ANY (ARRAY(SELECT designations_for(1, 'R_TRANSPORT_MGR'))), 'custom role uses its base list';
  RAISE NOTICE 'Lists ok';
END $$;

INSERT INTO users (tenant_id, username, email, password_hash, status) VALUES
 (1,'drv','drv@example.com','COGNITO','ACTIVE'), (1,'tch','tch@example.com','COGNITO','ACTIVE'), (1,'par','par@example.com','COGNITO','ACTIVE'),
 (1,'adm','adm@example.com','COGNITO','ACTIVE'), (1,'fo','fo@example.com','COGNITO','ACTIVE');
INSERT INTO user_roles SELECT u.user_id, r.role_id FROM users u JOIN roles r ON (u.username, r.code) IN
 (('drv','TRANSPORT'),('tch','TEACHER'),('par','PARENT'),('adm','ADMIN'),('fo','FRONT_OFFICE'));

DO $$ DECLARE drv INT; tch INT; par INT; BEGIN
  SELECT user_id INTO drv FROM users WHERE username = 'drv';
  SELECT user_id INTO tch FROM users WHERE username = 'tch';
  SELECT user_id INTO par FROM users WHERE username = 'par';
  PERFORM set_user_designation(drv, 'Driver');
  PERFORM set_user_designation(tch, 'PGT');
  PERFORM set_user_designation(par, 'TGT');                     -- a parent is always just Parent
  ASSERT (SELECT d.name FROM users u JOIN designations d USING (designation_id) WHERE u.user_id = par) = 'Parent', 'parent marked Parent';
  BEGIN PERFORM set_user_designation(drv, 'PGT'); RAISE EXCEPTION 'driver got PGT';
  EXCEPTION WHEN check_violation THEN IF SQLERRM NOT LIKE '%not a designation for TRANSPORT%' THEN RAISE; END IF; END;
  BEGIN UPDATE users SET designation_id = (SELECT designation_id FROM users WHERE user_id = drv) WHERE user_id = tch; RAISE EXCEPTION 'teacher got Driver';
  EXCEPTION WHEN check_violation THEN NULL; END;
  -- Changing the role re-checks the designation
  BEGIN INSERT INTO user_roles SELECT par, role_id FROM roles WHERE code = 'TEACHER'; RAISE EXCEPTION 'parent+teacher kept Parent';
  EXCEPTION WHEN check_violation THEN NULL; END;
  RAISE NOTICE 'Fit ok';
END $$;

-- A sign-up from the app: Pending, the role asked for, a designation from that role; it shows in the user directory
DO $$ DECLARE s INT; BEGIN
  INSERT INTO users (tenant_id, username, email, password_hash, status, full_name, requested_role)
  VALUES (1, 'kiran', 'kiran.bus@example.com', 'COGNITO', 'PENDING', 'Kiran Bus', 'TRANSPORT') RETURNING user_id INTO s;
  PERFORM set_user_designation(s, 'Cleaner');
  ASSERT (SELECT role_code || '|' || designation || '|' || status FROM v_user_directory WHERE user_id = s) = 'TRANSPORT|Cleaner|PENDING', 'pending sign-up listed';
  BEGIN PERFORM set_user_designation(s, 'Principal'); RAISE EXCEPTION 'sign-up got Principal';
  EXCEPTION WHEN check_violation THEN NULL; END;
  INSERT INTO users (tenant_id, username, email, password_hash, status, full_name, requested_role, linked_admission_no)
  VALUES (1, 'newpar', 'new.parent@example.com', 'COGNITO', 'ACTIVE', 'New Parent', 'PARENT', 'ADM-2025-0001') RETURNING user_id INTO s;
  PERFORM set_user_designation(s, NULL);
  ASSERT (SELECT designation FROM v_user_directory WHERE user_id = s) = 'N/A', 'parent designation shown as N/A (020)';
  RAISE NOTICE 'Sign-up ok';
END $$;

DO $$ DECLARE adm INT; fo INT; par INT; v INT; BEGIN
  SELECT user_id INTO adm FROM users WHERE username = 'adm';
  SELECT user_id INTO fo FROM users WHERE username = 'fo';
  SELECT user_id INTO par FROM users WHERE username = 'par';
  ASSERT (SELECT count(*) FROM role_menu_permissions p JOIN menus m USING (menu_id) JOIN roles r USING (role_id) WHERE m.code LIKE 'VA\_%' AND r.code <> 'ADMIN') = 0, 'VA menus admin only';
  ASSERT (SELECT count(*) FROM menus WHERE code LIKE 'VA\_%') = 8, 'eight profiles';
  BEGIN INSERT INTO role_menu_permissions (role_id, menu_id, can_view) SELECT r.role_id, m.menu_id, TRUE FROM roles r, menus m WHERE r.code = 'PRINCIPAL' AND m.code = 'VA_PARENT';
    RAISE EXCEPTION 'principal got View as'; EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN INSERT INTO user_menu_grants (tenant_id, user_id, menu_id) SELECT 1, fo, menu_id FROM menus WHERE code = 'VA_PARENT';
    RAISE EXCEPTION 'personal grant of View as'; EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN PERFORM start_view_as(fo, par); RAISE EXCEPTION 'front office viewed as';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Only an active Admin%' THEN RAISE; END IF; END;
  v := start_view_as(adm, par, 'APP');
  PERFORM start_view_as(adm, fo, 'WEB', TRUE);
  ASSERT (SELECT ended_at IS NOT NULL FROM view_as_log WHERE view_id = v), 'previous view closed';
  ASSERT (SELECT count(*) FROM view_as_log WHERE admin_user_id = adm AND ended_at IS NULL AND acted) = 1, 'one open view, acting';
  PERFORM end_view_as(adm);
  ASSERT NOT EXISTS (SELECT 1 FROM view_as_log WHERE admin_user_id = adm AND ended_at IS NULL), 'ended';
  RAISE NOTICE 'View as ok';
END $$;
ROLLBACK;
