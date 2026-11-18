-- Checks for 020 (no pending parents, no switched-off status, reset-password permission, view-only archive). Rolled back.
-- Expect NOTICE: Users statuses and reset ok
\set ON_ERROR_STOP 1
SET client_min_messages = notice;
BEGIN;
INSERT INTO users (tenant_id, username, email, password_hash, status, full_name) VALUES
 (1,'adm20','adm20@example.com','COGNITO','ACTIVE','Asha Admin'), (1,'vp20','vp20@example.com','COGNITO','ACTIVE','Meera VP'), (1,'t20','t20@example.com','COGNITO','ACTIVE','Tara Teacher');
INSERT INTO user_roles SELECT u.user_id, r.role_id FROM users u JOIN roles r ON (u.username, r.code) IN (('adm20','ADMIN'),('vp20','TEACHER'),('t20','TEACHER'));
DO $$ DECLARE a INT; v INT; t INT; BEGIN
  SELECT user_id INTO a FROM users WHERE username = 'adm20'; SELECT user_id INTO v FROM users WHERE username = 'vp20'; SELECT user_id INTO t FROM users WHERE username = 't20';
  BEGIN UPDATE users SET status = 'DISABLED' WHERE user_id = t; RAISE EXCEPTION 'switched off allowed';
  EXCEPTION WHEN check_violation THEN NULL; END;
  -- nobody waits for approval (023): PENDING is no longer a status
  BEGIN INSERT INTO users (tenant_id, username, email, password_hash, status, full_name, requested_role) VALUES (1,'pp20','pp20@example.com','COGNITO','PENDING','Pending Parent','PARENT');
        RAISE EXCEPTION 'pending allowed';
  EXCEPTION WHEN check_violation THEN NULL; END;
  -- reset password
  ASSERT can_reset_passwords(a), 'admin';
  ASSERT NOT can_reset_passwords(v), 'not without the permission';
  BEGIN PERFORM request_password_reset(v, t); RAISE EXCEPTION 'reset without permission';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN INSERT INTO user_permissions (tenant_id, user_id, permission, granted_by) VALUES (1, v, 'RESET_PASSWORDS', t); RAISE EXCEPTION 'a teacher granted it';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  INSERT INTO user_permissions (tenant_id, user_id, permission, granted_by) VALUES (1, v, 'RESET_PASSWORDS', a);
  ASSERT can_reset_passwords(v), 'granted';
  PERFORM request_password_reset(v, t);
  -- the archive has no rejoin
  ASSERT NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'rejoin_user'), 'rejoin removed';
  ASSERT NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_archive' AND column_name LIKE 'rejoined%'), 'no rejoin columns';
  ASSERT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'v_user_directory' AND column_name = 'created_at')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'v_user_directory' AND column_name = 'last_change'), 'created date instead of last change';
  RAISE NOTICE 'Users statuses and reset ok';
END $$;
ROLLBACK;
