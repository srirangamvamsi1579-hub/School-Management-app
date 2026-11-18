-- Checks for 021 (copy details from the archive). Rolled back.  Expect NOTICE: Copy from archive ok
\set ON_ERROR_STOP 1
SET client_min_messages = notice;
BEGIN;
INSERT INTO users (tenant_id, username, email, password_hash, status, full_name) VALUES
 (1,'adm21','adm21@example.com','COGNITO','ACTIVE','Asha Admin'), (1,'drv21','driver21@example.com','COGNITO','ACTIVE','Ravi Driver');
INSERT INTO user_roles SELECT u.user_id, r.role_id FROM users u JOIN roles r ON (u.username, r.code) IN (('adm21','ADMIN'),('drv21','TRANSPORT'));
DO $$ DECLARE a INT; d INT; ar BIGINT; n INT; BEGIN
  SELECT user_id INTO a FROM users WHERE username = 'adm21'; SELECT user_id INTO d FROM users WHERE username = 'drv21';
  ar := close_account(a, d, 'Left the school');
  ASSERT (SELECT (profile_exists, contact_in_use) FROM v_archive_copy WHERE archive_id = ar) = (TRUE, FALSE), 'offered for copying';
  INSERT INTO users (tenant_id, username, email, password_hash, status, full_name, copied_from_archive)
  VALUES (1, 'drv21b', 'driver21@example.com', 'COGNITO', 'ACTIVE', 'Ravi Driver', ar) RETURNING user_id INTO n;
  ASSERT (SELECT contact_in_use FROM v_archive_copy WHERE archive_id = ar), 'email now in use again';
  ASSERT (SELECT copied_from_archive FROM users WHERE user_id = n) = ar;
  ASSERT EXISTS (SELECT 1 FROM user_archive WHERE archive_id = ar), 'the archive entry stays';
  RAISE NOTICE 'Copy from archive ok';
END $$;
ROLLBACK;
