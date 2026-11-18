-- =====================================================================
-- 022  Accounts come from registration
--      Parents and staff create their own accounts on the school website or in the app. The Admin can add someone
--      only as an exception, with a reason. Every account records how it was created.
--      Run after 001–021.
-- =====================================================================
ALTER TABLE users
  ADD COLUMN created_via VARCHAR(8) NOT NULL DEFAULT 'WEBSITE' CHECK (created_via IN ('WEBSITE', 'APP', 'ADMIN', 'SETUP')),
  ADD COLUMN admin_add_reason VARCHAR(120),
  ADD CONSTRAINT users_admin_add_reason CHECK (created_via <> 'ADMIN' OR length(trim(COALESCE(admin_add_reason, ''))) >= 3);

-- Existing Admin and platform accounts were set up with the school
UPDATE users u SET created_via = 'SETUP' WHERE EXISTS (SELECT 1 FROM user_roles ur JOIN roles r USING (role_id) WHERE ur.user_id = u.user_id AND r.code IN ('ADMIN', 'PLATFORM'));

-- Only an Admin adds someone directly (the API sets app.user_id to the person acting)
CREATE OR REPLACE FUNCTION trg_admin_added() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_actor INT := NULLIF(current_setting('app.user_id', true), '')::int;
BEGIN
  IF NEW.created_via = 'ADMIN' AND NOT EXISTS (SELECT 1 FROM user_roles ur JOIN roles r USING (role_id) WHERE ur.user_id = v_actor AND r.code IN ('ADMIN', 'PLATFORM')) THEN
    RAISE EXCEPTION 'Only the Admin can add a user; everyone else registers on the website or in the app' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER admin_added BEFORE INSERT ON users FOR EACH ROW EXECUTE FUNCTION trg_admin_added();

-- Parents registering: record the channel (website or app)
CREATE OR REPLACE FUNCTION register_parent_via(p_channel VARCHAR, p_tenant INT, p_sign_in VARCHAR, p_full_name VARCHAR, p_cognito_sub VARCHAR,
                                               p_adm VARCHAR, p_student_name VARCHAR, p_grade INT, p_phone VARCHAR DEFAULT NULL) RETURNS INT
LANGUAGE plpgsql AS $$
DECLARE v_user INT;
BEGIN
  IF p_channel NOT IN ('WEBSITE', 'APP') THEN RAISE EXCEPTION 'Parents register on the website or in the app'; END IF;
  v_user := register_parent(p_tenant, p_sign_in, p_full_name, p_cognito_sub, p_adm, p_student_name, p_grade, p_phone);
  IF v_user IS NOT NULL THEN UPDATE users SET created_via = p_channel WHERE user_id = v_user; END IF;
  RETURN v_user;
END $$;

-- The Users screen shows how each account was created (in Edit)
CREATE OR REPLACE VIEW v_user_source WITH (security_invoker = true) AS
SELECT u.user_id, u.tenant_id, u.created_via, u.admin_add_reason, u.created_at,
       CASE u.created_via WHEN 'APP' THEN 'Registered in the app' WHEN 'WEBSITE' THEN 'Registered on the website'
            WHEN 'ADMIN' THEN 'Added by the Admin — ' || u.admin_add_reason ELSE 'Set up with the school' END AS how_created
FROM users u;
