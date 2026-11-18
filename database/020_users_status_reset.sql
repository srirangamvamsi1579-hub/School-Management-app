-- =====================================================================
-- 020  Users screen follow-up
--      - Parents are never pending: register_parent() checks the student first and creates the account Active,
--        or creates nothing. A deferred check stops any parent account from being left Waiting for approval.
--      - "Switched off" (DISABLED) is no longer a status; existing ones become Locked.
--      - Reset password: the Admin role, or a person given the RESET_PASSWORDS permission.
--      - The archive is view only: rejoin is removed.
--      - v_user_directory: shows the created date instead of the last change; parents' designation is N/A.
--      Run after 001–019.
-- =====================================================================

-- 1. Statuses: no DISABLED; pending parents with a child on the record become Active, the rest Locked
UPDATE users SET status = 'LOCKED' WHERE status = 'DISABLED';
ALTER TABLE users DROP CONSTRAINT users_status_check;
ALTER TABLE users ADD CONSTRAINT users_status_check CHECK (status IN ('PENDING', 'ACTIVE', 'LOCKED', 'DELETED'));

INSERT INTO user_roles (user_id, role_id)
SELECT u.user_id, r.role_id FROM users u JOIN roles r ON r.code = 'PARENT' WHERE u.status = 'PENDING' AND u.requested_role = 'PARENT' ON CONFLICT DO NOTHING;
INSERT INTO user_children (tenant_id, user_id, student_id)
SELECT u.tenant_id, u.user_id, s.student_id FROM users u JOIN students s ON s.tenant_id = u.tenant_id AND s.admission_no = u.linked_admission_no AND s.status = 'ACTIVE'
WHERE u.status = 'PENDING' AND u.requested_role = 'PARENT' ON CONFLICT DO NOTHING;
UPDATE users u SET status = CASE WHEN EXISTS (SELECT 1 FROM user_children c WHERE c.user_id = u.user_id) THEN 'ACTIVE' ELSE 'LOCKED' END
WHERE u.status = 'PENDING' AND u.requested_role = 'PARENT';

-- A parent account can't be left waiting for approval (checked at the end of the transaction)
CREATE OR REPLACE FUNCTION trg_parent_not_pending() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'PENDING' AND (NEW.requested_role = 'PARENT' OR EXISTS (SELECT 1 FROM user_roles ur JOIN roles r USING (role_id) WHERE ur.user_id = NEW.user_id AND r.code = 'PARENT')) THEN
    RAISE EXCEPTION 'Parent accounts are never waiting for approval: they are checked against the student record when they register' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER parent_not_pending AFTER INSERT OR UPDATE OF status, requested_role ON users DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION trg_parent_not_pending();

-- 2. Parent registration in one step: check first, then create the account Active (or nothing)
DROP FUNCTION open_parent_account(INT, VARCHAR, VARCHAR, INT);
CREATE OR REPLACE FUNCTION register_parent(p_tenant INT, p_sign_in VARCHAR, p_full_name VARCHAR, p_cognito_sub VARCHAR,
                                           p_adm VARCHAR, p_student_name VARCHAR, p_grade INT, p_phone VARCHAR DEFAULT NULL) RETURNS INT
LANGUAGE plpgsql AS $$
DECLARE v_id VARCHAR := lower(trim(p_sign_in)); v_student INT; v_wrong INT; v_user INT; v_email BOOLEAN := p_sign_in LIKE '%@%';
BEGIN
  IF EXISTS (SELECT 1 FROM users WHERE tenant_id = p_tenant AND status <> 'DELETED' AND (lower(email) = v_id OR phone = v_id)) THEN RAISE EXCEPTION 'An account already uses this'; END IF;
  SELECT wrong INTO v_wrong FROM parent_signup_checks WHERE tenant_id = p_tenant AND sign_in_id = v_id;
  IF COALESCE(v_wrong, 0) >= 5 THEN RAISE EXCEPTION 'Too many tries with details that don''t match — please contact the school office'; END IF;
  v_student := match_student(p_tenant, p_adm, p_student_name, p_grade);
  IF v_student IS NULL THEN
    INSERT INTO parent_signup_checks (tenant_id, sign_in_id, wrong) VALUES (p_tenant, v_id, 1)
    ON CONFLICT (tenant_id, sign_in_id) DO UPDATE SET wrong = parent_signup_checks.wrong + 1, last_at = CURRENT_TIMESTAMP;
    RETURN NULL;   -- nothing is created; the API shows one message for every mismatch
  END IF;
  DELETE FROM parent_signup_checks WHERE tenant_id = p_tenant AND sign_in_id = v_id;
  INSERT INTO users (tenant_id, username, email, phone, password_hash, status, full_name, login_type, requested_role, linked_admission_no, cognito_sub, email_verified, phone_verified, approved_at, consent_at)
  VALUES (p_tenant, 'p-' || p_tenant || '-' || v_id, CASE WHEN v_email THEN v_id END, CASE WHEN v_email THEN p_phone ELSE v_id END, 'COGNITO', 'ACTIVE', p_full_name,
          CASE WHEN v_email THEN 'EMAIL' ELSE 'MOBILE' END, 'PARENT', upper(trim(p_adm)), p_cognito_sub, v_email, NOT v_email, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  RETURNING user_id INTO v_user;
  INSERT INTO user_roles (user_id, role_id) SELECT v_user, role_id FROM roles WHERE code = 'PARENT';
  INSERT INTO user_children (tenant_id, user_id, student_id) VALUES (p_tenant, v_user, v_student);
  RETURN v_user;
END $$;

-- 3. Reset password: Admin role, or a person given the permission
CREATE TABLE user_permissions (
  tenant_id  INTEGER NOT NULL REFERENCES tenants(tenant_id),
  user_id    INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  permission VARCHAR(40) NOT NULL CHECK (permission IN ('RESET_PASSWORDS')),
  granted_by INTEGER REFERENCES users(user_id),
  granted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, permission)
);
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON user_permissions USING (tenant_id = current_setting('app.tenant_id', true)::int) WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::int);

CREATE OR REPLACE FUNCTION can_reset_passwords(p_user INT) RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.role_id = ur.role_id WHERE ur.user_id = p_user AND r.code IN ('ADMIN', 'PLATFORM'))
      OR EXISTS (SELECT 1 FROM user_permissions WHERE user_id = p_user AND permission = 'RESET_PASSWORDS');
$$;
-- Only an Admin hands out the permission
CREATE OR REPLACE FUNCTION trg_permission_granted() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.role_id = ur.role_id WHERE ur.user_id = NEW.granted_by AND r.code IN ('ADMIN', 'PLATFORM')) THEN
    RAISE EXCEPTION 'Only an Admin can give the reset-password permission' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER permission_granted BEFORE INSERT OR UPDATE ON user_permissions FOR EACH ROW EXECUTE FUNCTION trg_permission_granted();
-- The API calls this before sending a set-password link
CREATE OR REPLACE FUNCTION request_password_reset(p_actor INT, p_user INT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF NOT can_reset_passwords(p_actor) THEN RAISE EXCEPTION 'Only the Admin, or someone given the permission, can reset passwords' USING ERRCODE = 'insufficient_privilege'; END IF;
  IF NOT EXISTS (SELECT 1 FROM users WHERE user_id = p_user AND status IN ('ACTIVE', 'LOCKED')) THEN RAISE EXCEPTION 'No such active account'; END IF;
  UPDATE users SET failed_logins = 0 WHERE user_id = p_user;
END $$;

-- 4. The archive is view only
DROP FUNCTION rejoin_user(INT, BIGINT, VARCHAR, VARCHAR, VARCHAR);
ALTER TABLE user_archive DROP COLUMN rejoined_at, DROP COLUMN rejoined_by, DROP COLUMN rejoined_user_id;
ALTER TABLE users DROP COLUMN rejoined_from;

-- 5. Users screen
DROP VIEW v_user_directory;
CREATE VIEW v_user_directory WITH (security_invoker = true) AS
SELECT u.user_id, u.tenant_id, COALESCE(u.full_name, u.username) AS name, COALESCE(u.email, u.phone) AS sign_in_id, u.status,
       x.role_code, department_of(u.tenant_id, split_part(x.role_code, ',', 1)) AS department,
       u.requested_role, CASE WHEN x.role_code = 'PARENT' THEN 'N/A' ELSE d.name END AS designation, u.linked_admission_no,
       u.created_at, u.last_login_at, designation_problem(u.user_id) AS designation_problem,
       (SELECT jsonb_agg(jsonb_build_object('admission_no', s.admission_no, 'name', trim(s.first_name || ' ' || COALESCE(s.last_name, '')), 'grade', c.name) ORDER BY s.admission_no)
          FROM user_children uc JOIN students s ON s.student_id = uc.student_id
          LEFT JOIN enrollments e ON e.student_id = s.student_id AND e.year_id = (SELECT year_id FROM academic_years WHERE is_current AND tenant_id = u.tenant_id LIMIT 1)
          LEFT JOIN sections sc ON sc.section_id = e.section_id LEFT JOIN classes c ON c.class_id = sc.class_id
         WHERE uc.user_id = u.user_id) AS students
FROM users u
LEFT JOIN designations d ON d.designation_id = u.designation_id
CROSS JOIN LATERAL (SELECT COALESCE((SELECT string_agg(r.code, ',' ORDER BY r.code) FROM user_roles ur JOIN roles r ON r.role_id = ur.role_id WHERE ur.user_id = u.user_id), u.requested_role) AS role_code) x
WHERE u.status <> 'DELETED';
