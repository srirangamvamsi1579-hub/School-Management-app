-- Checks for 022 (accounts come from registration). Rolled back.  Expect NOTICE: Account source ok
\set ON_ERROR_STOP 1
SET client_min_messages = notice;
BEGIN;
INSERT INTO users (tenant_id, username, email, password_hash, status, full_name) VALUES
 (1,'adm22','adm22@example.com','COGNITO','ACTIVE','Asha Admin'), (1,'vp22','vp22@example.com','COGNITO','ACTIVE','Meera VP');
INSERT INTO user_roles SELECT u.user_id, r.role_id FROM users u JOIN roles r ON (u.username, r.code) IN (('adm22','ADMIN'),('vp22','TEACHER'));
DO $$ DECLARE a INT; v INT; n INT; BEGIN
  SELECT user_id INTO a FROM users WHERE username = 'adm22'; SELECT user_id INTO v FROM users WHERE username = 'vp22';
  -- a staff sign-up from the app
  INSERT INTO users (tenant_id, username, email, password_hash, status, full_name, requested_role, created_via)
  VALUES (1, 'app22', 'app22@example.com', 'COGNITO', 'PENDING', 'App Teacher', 'TEACHER', 'APP') RETURNING user_id INTO n;
  ASSERT (SELECT how_created FROM v_user_source WHERE user_id = n) = 'Registered in the app';
  -- the Vice Principal can't add anyone
  PERFORM set_config('app.user_id', v::text, true);
  BEGIN INSERT INTO users (tenant_id, username, email, password_hash, status, full_name, created_via, admin_add_reason)
        VALUES (1, 'x22', 'x22@example.com', 'COGNITO', 'ACTIVE', 'X', 'ADMIN', 'Needs help to register'); RAISE EXCEPTION 'VP added a user';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  -- the Admin can, with a reason
  PERFORM set_config('app.user_id', a::text, true);
  BEGIN INSERT INTO users (tenant_id, username, email, password_hash, status, full_name, created_via)
        VALUES (1, 'y22', 'y22@example.com', 'COGNITO', 'ACTIVE', 'Y', 'ADMIN'); RAISE EXCEPTION 'added without a reason';
  EXCEPTION WHEN check_violation THEN NULL; END;
  INSERT INTO users (tenant_id, username, email, password_hash, status, full_name, created_via, admin_add_reason)
  VALUES (1, 'z22', 'z22@example.com', 'COGNITO', 'ACTIVE', 'Lakshmi Amma', 'ADMIN', 'Has no email or mobile of their own') RETURNING user_id INTO n;
  ASSERT (SELECT how_created FROM v_user_source WHERE user_id = n) = 'Added by the Admin — Has no email or mobile of their own';
  BEGIN PERFORM register_parent_via('ADMIN', 1, 'p22@example.com', 'P', NULL, 'ADM-1', 'A', 8); RAISE EXCEPTION 'parent via admin channel';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Parents register%' THEN RAISE; END IF; END;
  RAISE NOTICE 'Account source ok';
END $$;
ROLLBACK;
