-- =====================================================================
-- 019  Users screen: parents checked against the student record, last change, archive of deleted accounts, rejoin
--      - open_parent_account(): a parent gives admission no., student name and grade; on a match the account is
--        Active and linked to the child at once (no approval). Wrong tries are counted per sign-in ID (5 allowed).
--      - users.updated_at / updated_by / last_change, kept by a trigger and by the functions below
--      - user_archive: a copy of every deleted account (contact details only when the school deleted it)
--      - close_account() now archives first and records the reason; close_own_account() for the person themselves
--      - rejoin_user(): a new account from an archive entry, checked against today's profiles and student record
--      - v_user_directory: department, students of parents (admission no., name, grade), last sign-in, last change
--      Run after 001–018.
-- =====================================================================

ALTER TABLE users
  ADD COLUMN updated_at  TIMESTAMP,
  ADD COLUMN updated_by  INTEGER REFERENCES users(user_id),
  ADD COLUMN last_change VARCHAR(200),
  ADD COLUMN rejoined_from BIGINT;

-- Who changed an account and when (the API sets app.user_id per request)
CREATE OR REPLACE FUNCTION trg_user_touched() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.full_name, NEW.email, NEW.phone, NEW.status, NEW.designation_id) IS DISTINCT FROM (OLD.full_name, OLD.email, OLD.phone, OLD.status, OLD.designation_id) THEN
    NEW.updated_at := CURRENT_TIMESTAMP;
    NEW.updated_by := COALESCE(NULLIF(current_setting('app.user_id', true), '')::int, NEW.updated_by);
    IF NEW.last_change IS NOT DISTINCT FROM OLD.last_change THEN
      NEW.last_change := concat_ws(', ',
        CASE WHEN NEW.status IS DISTINCT FROM OLD.status THEN 'status → ' || NEW.status END,
        CASE WHEN NEW.designation_id IS DISTINCT FROM OLD.designation_id THEN 'designation' END,
        CASE WHEN NEW.full_name IS DISTINCT FROM OLD.full_name THEN 'name' END,
        CASE WHEN (NEW.email, NEW.phone) IS DISTINCT FROM (OLD.email, OLD.phone) THEN 'contact details' END);
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER user_touched BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION trg_user_touched();

-- ---------------------------------------------------------------------
-- 1. PARENTS: CHECKED AGAINST THE STUDENT RECORD
-- ---------------------------------------------------------------------
CREATE TABLE parent_signup_checks (
  tenant_id  INTEGER NOT NULL REFERENCES tenants(tenant_id),
  sign_in_id VARCHAR(120) NOT NULL,
  wrong      INTEGER NOT NULL DEFAULT 0,
  last_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id, sign_in_id)
);

-- The student whose admission no., name and grade all match (name: every word typed is in the student's name,
-- including the first name; case and order don't matter). NULL when nothing matches.
CREATE OR REPLACE FUNCTION match_student(p_tenant INT, p_adm VARCHAR, p_name VARCHAR, p_grade INT) RETURNS INT LANGUAGE sql STABLE AS $$
  SELECT s.student_id
  FROM students s
  JOIN enrollments e ON e.student_id = s.student_id AND e.status = 'STUDYING'
  JOIN academic_years y ON y.year_id = e.year_id AND y.is_current
  JOIN sections sc ON sc.section_id = e.section_id
  JOIN classes c ON c.class_id = sc.class_id
  WHERE s.tenant_id = p_tenant AND s.admission_no = upper(trim(p_adm)) AND s.status = 'ACTIVE' AND c.level_no = p_grade
    AND regexp_split_to_array(lower(trim(p_name)), '\s+') <@ regexp_split_to_array(lower(trim(s.first_name || ' ' || COALESCE(s.last_name, ''))), '\s+')
    AND lower(s.first_name) = ANY (regexp_split_to_array(lower(trim(p_name)), '\s+'))
$$;

-- Called at the end of a parent's sign-up (after the code is verified). On a match the account is Active and linked.
-- On no match nothing is opened, and the try is counted; after 5 the sign-in ID has to go through the school office.
CREATE OR REPLACE FUNCTION open_parent_account(p_user INT, p_adm VARCHAR, p_name VARCHAR, p_grade INT) RETURNS INT
LANGUAGE plpgsql AS $$
DECLARE v_t INT; v_id VARCHAR; v_student INT; v_wrong INT;
BEGIN
  SELECT tenant_id, COALESCE(email, phone) INTO v_t, v_id FROM users WHERE user_id = p_user AND status = 'PENDING' AND requested_role = 'PARENT' FOR UPDATE;
  IF v_t IS NULL THEN RAISE EXCEPTION 'No parent sign-up waiting for this account'; END IF;
  SELECT wrong INTO v_wrong FROM parent_signup_checks WHERE tenant_id = v_t AND sign_in_id = v_id;
  IF COALESCE(v_wrong, 0) >= 5 THEN RAISE EXCEPTION 'Too many tries with details that don''t match — please contact the school office'; END IF;
  v_student := match_student(v_t, p_adm, p_name, p_grade);
  IF v_student IS NULL THEN
    INSERT INTO parent_signup_checks (tenant_id, sign_in_id, wrong) VALUES (v_t, v_id, 1)
    ON CONFLICT (tenant_id, sign_in_id) DO UPDATE SET wrong = parent_signup_checks.wrong + 1, last_at = CURRENT_TIMESTAMP;
    RETURN NULL;   -- the API shows one message for every mismatch, so it doesn't reveal which detail was wrong
  END IF;
  DELETE FROM parent_signup_checks WHERE tenant_id = v_t AND sign_in_id = v_id;
  INSERT INTO user_roles (user_id, role_id) SELECT p_user, role_id FROM roles WHERE code = 'PARENT' ON CONFLICT DO NOTHING;
  INSERT INTO user_children (tenant_id, user_id, student_id) VALUES (v_t, p_user, v_student) ON CONFLICT DO NOTHING;
  UPDATE users SET status = 'ACTIVE', linked_admission_no = upper(trim(p_adm)), approved_at = CURRENT_TIMESTAMP,
         last_change = 'signed up · matched ' || upper(trim(p_adm)) WHERE user_id = p_user;
  RETURN v_student;
END $$;

-- ---------------------------------------------------------------------
-- 2. ARCHIVE OF DELETED ACCOUNTS
-- ---------------------------------------------------------------------
CREATE TABLE user_archive (
  archive_id   BIGSERIAL PRIMARY KEY,
  tenant_id    INTEGER NOT NULL REFERENCES tenants(tenant_id),
  user_id      INTEGER NOT NULL REFERENCES users(user_id),
  full_name    VARCHAR(120),
  sign_in_id   VARCHAR(120),                      -- NULL when the person deleted their own account
  email        VARCHAR(120),
  phone        VARCHAR(20),
  role_codes   VARCHAR(200),
  department   VARCHAR(80),
  designation  VARCHAR(60),
  children     JSONB NOT NULL DEFAULT '[]',       -- [{admission_no, name, grade}]
  menu_grants  JSONB NOT NULL DEFAULT '[]',
  joined_at    TIMESTAMP,
  last_login_at TIMESTAMP,
  deleted_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_by   INTEGER REFERENCES users(user_id),
  reason       VARCHAR(60) NOT NULL,
  self_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  rejoined_at  TIMESTAMP,
  rejoined_by  INTEGER REFERENCES users(user_id),
  rejoined_user_id INTEGER REFERENCES users(user_id)
);
CREATE INDEX user_archive_search ON user_archive (tenant_id, deleted_at DESC);
ALTER TABLE user_archive ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON user_archive USING (tenant_id = current_setting('app.tenant_id', true)::int) WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::int);
ALTER TABLE parent_signup_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON parent_signup_checks USING (tenant_id = current_setting('app.tenant_id', true)::int) WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::int);

CREATE OR REPLACE FUNCTION archive_user(p_user INT, p_by INT, p_reason VARCHAR, p_self BOOLEAN) RETURNS BIGINT LANGUAGE sql AS $$
  INSERT INTO user_archive (tenant_id, user_id, full_name, sign_in_id, email, phone, role_codes, department, designation, children, menu_grants, joined_at, last_login_at, deleted_by, reason, self_deleted)
  SELECT u.tenant_id, u.user_id, u.full_name,
         CASE WHEN p_self THEN NULL ELSE COALESCE(u.email, u.phone) END, CASE WHEN p_self THEN NULL ELSE u.email END, CASE WHEN p_self THEN NULL ELSE u.phone END,
         r.codes, department_of(u.tenant_id, split_part(r.codes, ',', 1)), d.name,
         COALESCE((SELECT jsonb_agg(jsonb_build_object('admission_no', s.admission_no, 'name', trim(s.first_name || ' ' || COALESCE(s.last_name, '')), 'grade', c.name) ORDER BY s.admission_no)
                   FROM user_children uc JOIN students s ON s.student_id = uc.student_id
                   LEFT JOIN enrollments e ON e.student_id = s.student_id LEFT JOIN academic_years y ON y.year_id = e.year_id AND y.is_current
                   LEFT JOIN sections sc ON sc.section_id = e.section_id AND y.year_id IS NOT NULL LEFT JOIN classes c ON c.class_id = sc.class_id
                   WHERE uc.user_id = u.user_id), '[]'::jsonb),
         COALESCE((SELECT jsonb_agg(m.code) FROM user_menu_grants g JOIN menus m ON m.menu_id = g.menu_id WHERE g.user_id = u.user_id), '[]'::jsonb),
         u.created_at, u.last_login_at, p_by, COALESCE(p_reason, CASE WHEN p_self THEN 'Asked to close the account' ELSE 'Other' END), p_self
  FROM users u
  LEFT JOIN designations d ON d.designation_id = u.designation_id
  CROSS JOIN LATERAL (SELECT COALESCE((SELECT string_agg(r.code, ',' ORDER BY r.code) FROM user_roles ur JOIN roles r ON r.role_id = ur.role_id WHERE ur.user_id = u.user_id), u.requested_role) AS codes) r
  WHERE u.user_id = p_user
  RETURNING archive_id;
$$;

-- Deleting by the school: archived with the reason, then the account is closed as before
DROP FUNCTION close_account(INT, INT);
CREATE OR REPLACE FUNCTION close_account(p_actor INT, p_user INT, p_reason VARCHAR DEFAULT 'Other', p_self BOOLEAN DEFAULT FALSE) RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE v_arch BIGINT;
BEGIN
  IF NOT p_self THEN
    IF NOT can_manage_users(p_actor) THEN RAISE EXCEPTION 'Not allowed to manage users'; END IF;
    IF p_actor = p_user THEN RAISE EXCEPTION 'You cannot delete your own account here'; END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM users WHERE user_id = p_user AND status = 'DELETED') THEN RAISE EXCEPTION 'This account is already closed'; END IF;
  v_arch := archive_user(p_user, p_actor, p_reason, p_self);
  DELETE FROM user_roles WHERE user_id = p_user;
  DELETE FROM user_children WHERE user_id = p_user;
  DELETE FROM user_menu_grants WHERE user_id = p_user;
  UPDATE users SET status = 'DELETED', full_name = 'Closed account', username = 'deleted-' || user_id, email = NULL, phone = NULL,
         cognito_sub = NULL, password_hash = 'DELETED', deleted_at = CURRENT_TIMESTAMP, deleted_by = p_actor, last_change = 'deleted · ' || p_reason WHERE user_id = p_user;
  UPDATE account_requests SET status = 'DONE', decided_by = p_actor, decided_at = CURRENT_TIMESTAMP WHERE user_id = p_user AND kind = 'CLOSE' AND status = 'PENDING';
  RETURN v_arch;
  -- the API also calls Cognito AdminDeleteUser for the user pool
END $$;
-- The person closes their own account (app or web): email and mobile are not kept in the archive
CREATE OR REPLACE FUNCTION close_own_account(p_user INT) RETURNS BIGINT LANGUAGE sql AS $$
  SELECT close_account(p_user, p_user, 'Asked to close the account', TRUE);
$$;

-- Rejoin: a new account from the archive. Designation and children are checked against today's state;
-- children no longer studying are left out. The person gets a set-password link (sent by the API).
CREATE OR REPLACE FUNCTION rejoin_user(p_actor INT, p_archive BIGINT, p_sign_in VARCHAR, p_role VARCHAR, p_designation VARCHAR DEFAULT NULL) RETURNS INT
LANGUAGE plpgsql AS $$
DECLARE a user_archive%ROWTYPE; v_user INT; v_kids INT;
BEGIN
  IF NOT can_manage_users(p_actor) THEN RAISE EXCEPTION 'Not allowed to manage users'; END IF;
  SELECT * INTO a FROM user_archive WHERE archive_id = p_archive FOR UPDATE;
  IF a.archive_id IS NULL THEN RAISE EXCEPTION 'No such archive entry'; END IF;
  IF a.rejoined_at IS NOT NULL THEN RAISE EXCEPTION 'Already rejoined'; END IF;
  IF EXISTS (SELECT 1 FROM users WHERE tenant_id = a.tenant_id AND status <> 'DELETED' AND (lower(email) = lower(p_sign_in) OR phone = p_sign_in)) THEN RAISE EXCEPTION 'That sign-in ID already has an account'; END IF;
  IF NOT EXISTS (SELECT 1 FROM v_tenant_profiles WHERE tenant_id = a.tenant_id AND code = p_role) THEN RAISE EXCEPTION 'The % profile does not exist', p_role; END IF;
  INSERT INTO users (tenant_id, username, email, phone, password_hash, status, full_name, login_type, requested_role, designation_id, rejoined_from, last_change, updated_at, updated_by)
  VALUES (a.tenant_id, 'rejoin-' || a.archive_id, CASE WHEN p_sign_in LIKE '%@%' THEN lower(p_sign_in) END, CASE WHEN p_sign_in NOT LIKE '%@%' THEN p_sign_in END,
          'COGNITO', 'ACTIVE', a.full_name, CASE WHEN p_sign_in LIKE '%@%' THEN 'EMAIL' ELSE 'MOBILE' END, p_role,
          CASE WHEN p_role <> 'PARENT' THEN (SELECT designation_id FROM designations WHERE tenant_id = a.tenant_id AND name = p_designation) END,
          a.archive_id, 'rejoined from the archive', CURRENT_TIMESTAMP, p_actor)
  RETURNING user_id INTO v_user;
  INSERT INTO user_roles (user_id, role_id) SELECT v_user, role_id FROM roles WHERE code = p_role;
  IF p_role = 'PARENT' THEN
    INSERT INTO user_children (tenant_id, user_id, student_id, linked_by)
    SELECT a.tenant_id, v_user, s.student_id, p_actor FROM jsonb_array_elements(a.children) k JOIN students s ON s.tenant_id = a.tenant_id AND s.admission_no = k->>'admission_no' AND s.status = 'ACTIVE';
    GET DIAGNOSTICS v_kids = ROW_COUNT;
    IF v_kids = 0 THEN RAISE EXCEPTION 'None of the children are enrolled now — add the parent with a current admission number'; END IF;
  ELSE
    IF designation_problem(v_user) IS NOT NULL THEN RAISE EXCEPTION '%', designation_problem(v_user); END IF;
  END IF;
  INSERT INTO user_menu_grants (tenant_id, user_id, menu_id) SELECT a.tenant_id, v_user, m.menu_id FROM jsonb_array_elements_text(a.menu_grants) c JOIN menus m ON m.code = c ON CONFLICT DO NOTHING;
  UPDATE user_archive SET rejoined_at = CURRENT_TIMESTAMP, rejoined_by = p_actor, rejoined_user_id = v_user WHERE archive_id = p_archive;
  RETURN v_user;
END $$;

-- ---------------------------------------------------------------------
-- 3. USERS SCREEN
-- ---------------------------------------------------------------------
DROP VIEW v_user_directory;
CREATE VIEW v_user_directory WITH (security_invoker = true) AS
SELECT u.user_id, u.tenant_id, COALESCE(u.full_name, u.username) AS name, COALESCE(u.email, u.phone) AS sign_in_id, u.status,
       x.role_code, department_of(u.tenant_id, split_part(x.role_code, ',', 1)) AS department,
       u.requested_role, d.name AS designation, u.linked_admission_no, u.created_at,
       designation_problem(u.user_id) AS designation_problem,
       (SELECT jsonb_agg(jsonb_build_object('admission_no', s.admission_no, 'name', trim(s.first_name || ' ' || COALESCE(s.last_name, '')), 'grade', c.name) ORDER BY s.admission_no)
          FROM user_children uc JOIN students s ON s.student_id = uc.student_id
          LEFT JOIN enrollments e ON e.student_id = s.student_id AND e.year_id = (SELECT year_id FROM academic_years WHERE is_current AND tenant_id = u.tenant_id LIMIT 1)
          LEFT JOIN sections sc ON sc.section_id = e.section_id LEFT JOIN classes c ON c.class_id = sc.class_id
         WHERE uc.user_id = u.user_id) AS students,
       u.last_login_at, u.updated_at AS last_change_at, u.last_change, ub.full_name AS last_change_by
FROM users u
LEFT JOIN designations d ON d.designation_id = u.designation_id
LEFT JOIN users ub ON ub.user_id = u.updated_by
CROSS JOIN LATERAL (SELECT COALESCE((SELECT string_agg(r.code, ',' ORDER BY r.code) FROM user_roles ur JOIN roles r ON r.role_id = ur.role_id WHERE ur.user_id = u.user_id), u.requested_role) AS role_code) x
WHERE u.status <> 'DELETED';
