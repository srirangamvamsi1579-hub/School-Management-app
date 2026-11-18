-- =====================================================================
-- 013  Designations follow the role; app sign-ups land in users; Admin "View as Profile"
--      - role_designations: the designations offered for each role (standard list + a school's own extras)
--      - designations_for(): the list for a role (a custom role uses the list of the role it was based on)
--      - A user's designation must fit their role (or the role asked for at sign-up); a parent's is "Parent"
--        Checked at commit (constraint triggers), so the role and designation can be set in either order
--      - set_user_designation(): sets it by name and adds the school's designation row if needed
--      - View as Profile: menus VIEWAS / VA_*, for the Admin role only (never by designation or personal grant)
--      - view_as_log: who viewed the app as whom, website or phone, and whether they acted as that person
--      Run after 001–012.
-- =====================================================================

CREATE TABLE role_designations (
  role_designation_id SERIAL PRIMARY KEY,
  tenant_id   INTEGER REFERENCES tenants(tenant_id),        -- NULL = standard list for every school
  role_code   VARCHAR(30) NOT NULL,
  designation VARCHAR(60) NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  UNIQUE NULLS NOT DISTINCT (tenant_id, role_code, designation)
);
INSERT INTO role_designations (tenant_id, role_code, designation, sort_order)
SELECT NULL, v.role_code, v.designation, v.n FROM (VALUES
 ('ADMIN','School Administrator',1), ('ADMIN','IT Administrator',2), ('ADMIN','Office Manager',3),
 ('PRINCIPAL','Principal',1), ('PRINCIPAL','Vice Principal',2), ('PRINCIPAL','Headmistress / Headmaster',3), ('PRINCIPAL','Academic Director',4),
 ('ACCOUNTANT','Accountant',1), ('ACCOUNTANT','Senior Accountant',2), ('ACCOUNTANT','Accounts Assistant',3), ('ACCOUNTANT','Cashier',4), ('ACCOUNTANT','Fee Clerk',5),
 ('TEACHER','Pre-Primary Teacher',1), ('TEACHER','PRT',2), ('TEACHER','TGT',3), ('TEACHER','PGT',4), ('TEACHER','Class Teacher',5), ('TEACHER','Coordinator',6),
 ('TEACHER','Head of Department',7), ('TEACHER','Head of Teaching Staff',8), ('TEACHER','Vice Principal',9), ('TEACHER','Physical Education Teacher',10),
 ('TEACHER','Special Educator',11), ('TEACHER','Counsellor',12), ('TEACHER','Librarian',13), ('TEACHER','Lab Assistant',14),
 ('FRONT_OFFICE','Receptionist',1), ('FRONT_OFFICE','Front Office Executive',2), ('FRONT_OFFICE','Admissions Officer',3), ('FRONT_OFFICE','Office Assistant',4), ('FRONT_OFFICE','Gate / Security Staff',5),
 ('TRANSPORT','Transport In-charge',1), ('TRANSPORT','Transport Supervisor',2), ('TRANSPORT','Driver',3), ('TRANSPORT','Cleaner',4), ('TRANSPORT','Bus Helper / Attendant',5),
 ('PARENT','Parent',1)
) AS v(role_code, designation, n);

ALTER TABLE role_designations ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON role_designations
  USING (tenant_id IS NULL OR tenant_id = current_setting('app.tenant_id', true)::int)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::int);   -- schools add extras; the standard list is platform-owned

-- The list for a role in a school. A custom role uses the list of the system role it was based on.
CREATE OR REPLACE FUNCTION designations_for(p_tenant INTEGER, p_role VARCHAR) RETURNS SETOF VARCHAR
LANGUAGE sql STABLE AS $$
  WITH base AS (
    SELECT p_role AS code
    UNION SELECT b.code FROM roles r JOIN roles b ON b.role_id = r.based_on_role_id WHERE r.code = p_role
  )
  SELECT designation FROM (
    SELECT DISTINCT ON (rd.designation) rd.designation, rd.tenant_id IS NOT NULL AS extra, rd.sort_order
    FROM role_designations rd JOIN base ON base.code = rd.role_code
    WHERE rd.tenant_id IS NULL OR rd.tenant_id = p_tenant
    ORDER BY rd.designation, extra
  ) x ORDER BY extra, sort_order, designation;
$$;

-- Why a user's designation does not fit (NULL = fine)
CREATE OR REPLACE FUNCTION designation_problem(p_user INTEGER) RETURNS TEXT
LANGUAGE plpgsql STABLE AS $$
DECLARE u users%ROWTYPE; v_name VARCHAR; v_roles VARCHAR[];
BEGIN
  SELECT * INTO u FROM users WHERE user_id = p_user;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT array_agg(r.code) INTO v_roles FROM user_roles ur JOIN roles r ON r.role_id = ur.role_id WHERE ur.user_id = p_user;
  IF v_roles IS NULL AND u.requested_role IS NOT NULL THEN v_roles := ARRAY[u.requested_role]; END IF;   -- sign-up waiting for approval
  IF v_roles IS NULL OR v_roles <@ ARRAY['PLATFORM','STUDENT']::varchar[] THEN RETURN NULL; END IF;
  SELECT name INTO v_name FROM designations WHERE designation_id = u.designation_id;
  IF v_roles = ARRAY['PARENT']::varchar[] THEN
    RETURN CASE WHEN v_name IS NULL OR v_name = 'Parent' THEN NULL ELSE 'A parent has no designation other than Parent' END;
  END IF;
  IF v_name IS NULL THEN RETURN NULL; END IF;                -- staff may be saved before a designation is picked
  v_roles := array_remove(v_roles, 'PARENT');               -- a staff member who is also a parent keeps a staff designation
  IF EXISTS (SELECT 1 FROM unnest(v_roles) rc WHERE v_name IN (SELECT designations_for(u.tenant_id, rc))) THEN RETURN NULL; END IF;
  RETURN format('“%s” is not a designation for %s', v_name, array_to_string(v_roles, ' / '));
END $$;

CREATE OR REPLACE FUNCTION trg_designation_fits() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_problem TEXT;
BEGIN
  v_problem := designation_problem(NEW.user_id);
  IF v_problem IS NOT NULL THEN RAISE EXCEPTION '%', v_problem USING ERRCODE = 'check_violation'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER users_designation_fits AFTER INSERT OR UPDATE OF designation_id, requested_role ON users
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION trg_designation_fits();
CREATE CONSTRAINT TRIGGER user_roles_designation_fits AFTER INSERT OR UPDATE ON user_roles
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION trg_designation_fits();

-- Set a designation by name. Parents always get "Parent". The school's designation row is added if missing.
CREATE OR REPLACE FUNCTION set_user_designation(p_user INTEGER, p_name VARCHAR) RETURNS INTEGER
LANGUAGE plpgsql AS $$
DECLARE v_tenant INTEGER; v_id INTEGER; v_parent BOOLEAN;
BEGIN
  SELECT tenant_id INTO v_tenant FROM users WHERE user_id = p_user;
  SELECT COALESCE(bool_and(r.code = 'PARENT'), (SELECT requested_role = 'PARENT' FROM users WHERE user_id = p_user))
    INTO v_parent FROM user_roles ur JOIN roles r ON r.role_id = ur.role_id WHERE ur.user_id = p_user;
  IF v_parent THEN p_name := 'Parent'; END IF;
  IF p_name IS NULL OR p_name = '' THEN UPDATE users SET designation_id = NULL WHERE user_id = p_user; RETURN NULL; END IF;
  SELECT designation_id INTO v_id FROM designations WHERE tenant_id = v_tenant AND name = p_name;
  IF v_id IS NULL THEN
    INSERT INTO designations (tenant_id, name, is_teaching)
    VALUES (v_tenant, p_name, p_name IN (SELECT designations_for(v_tenant, 'TEACHER')) AND p_name NOT IN ('Librarian','Lab Assistant','Counsellor'))
    RETURNING designation_id INTO v_id;
  END IF;
  UPDATE users SET designation_id = v_id WHERE user_id = p_user;
  RETURN v_id;
END $$;

-- ---------------------------------------------------------------------
-- View as Profile (Admin only)
-- ---------------------------------------------------------------------
INSERT INTO menus (parent_id, code, label, route, icon, sort_order) VALUES (NULL, 'VIEWAS', 'View as Profile', '/view-as', 'eye', 90);
INSERT INTO menus (parent_id, code, label, route, sort_order)
SELECT m.menu_id, v.code, v.label, '/view-as/' || lower(substr(v.code, 4)), v.n
FROM menus m CROSS JOIN (VALUES
 ('VA_PARENT','Parent',1), ('VA_TEACHER','Teacher (class coordinator)',2), ('VA_VP','Teacher + Vice Principal',3), ('VA_HOTS','Teacher + Head of Teaching Staff',4),
 ('VA_PRINCIPAL','Principal',5), ('VA_ACCOUNTANT','Accountant',6), ('VA_FRONT_OFFICE','Front Office',7), ('VA_TRANSPORT','Transport team',8)
) AS v(code, label, n) WHERE m.code = 'VIEWAS';
INSERT INTO role_menu_permissions (role_id, menu_id, can_view, data_scope)
SELECT r.role_id, m.menu_id, TRUE, 'ALL' FROM roles r JOIN menus m ON m.code = 'VIEWAS' OR m.code LIKE 'VA\_%' WHERE r.code = 'ADMIN';

-- Never given to anyone else: not to another role, not by designation, not as a personal grant
CREATE OR REPLACE FUNCTION trg_view_as_admin_only() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_code VARCHAR; v_role VARCHAR;
BEGIN
  SELECT code INTO v_code FROM menus WHERE menu_id = NEW.menu_id;
  IF v_code IS NULL OR NOT (v_code = 'VIEWAS' OR v_code LIKE 'VA\_%') THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME = 'role_menu_permissions' THEN
    SELECT code INTO v_role FROM roles WHERE role_id = NEW.role_id;
    IF v_role = 'ADMIN' THEN RETURN NEW; END IF;
  END IF;
  RAISE EXCEPTION 'View as Profile is for the Admin role only' USING ERRCODE = 'check_violation';
END $$;
CREATE TRIGGER view_as_admin_only BEFORE INSERT OR UPDATE ON role_menu_permissions FOR EACH ROW EXECUTE FUNCTION trg_view_as_admin_only();
CREATE TRIGGER view_as_admin_only BEFORE INSERT OR UPDATE ON designation_menu_access FOR EACH ROW EXECUTE FUNCTION trg_view_as_admin_only();
CREATE TRIGGER view_as_admin_only BEFORE INSERT OR UPDATE ON user_menu_grants FOR EACH ROW EXECUTE FUNCTION trg_view_as_admin_only();

CREATE TABLE view_as_log (
  view_id        SERIAL PRIMARY KEY,
  tenant_id      INTEGER NOT NULL REFERENCES tenants(tenant_id),
  admin_user_id  INTEGER NOT NULL REFERENCES users(user_id),
  viewed_user_id INTEGER NOT NULL REFERENCES users(user_id),
  channel        VARCHAR(3) NOT NULL DEFAULT 'WEB' CHECK (channel IN ('WEB','APP')),
  acted          BOOLEAN NOT NULL DEFAULT FALSE,      -- TRUE once the admin switched on "Act as this person"
  started_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at       TIMESTAMP
);
CREATE INDEX view_as_log_admin ON view_as_log (tenant_id, admin_user_id, started_at DESC);
ALTER TABLE view_as_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON view_as_log USING (tenant_id = current_setting('app.tenant_id', true)::int) WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::int);

CREATE OR REPLACE FUNCTION start_view_as(p_admin INTEGER, p_viewed INTEGER, p_channel VARCHAR DEFAULT 'WEB', p_act BOOLEAN DEFAULT FALSE) RETURNS INTEGER
LANGUAGE plpgsql AS $$
DECLARE a users%ROWTYPE; v users%ROWTYPE; v_id INTEGER;
BEGIN
  SELECT * INTO a FROM users WHERE user_id = p_admin;
  SELECT * INTO v FROM users WHERE user_id = p_viewed;
  IF NOT EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.role_id = ur.role_id WHERE ur.user_id = p_admin AND r.code = 'ADMIN') OR a.status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'Only an active Admin can view the app as another profile';
  END IF;
  IF v.tenant_id IS DISTINCT FROM a.tenant_id THEN RAISE EXCEPTION 'That account is not in your school'; END IF;
  IF v.status <> 'ACTIVE' THEN RAISE EXCEPTION 'That account is not active'; END IF;
  IF EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.role_id = ur.role_id WHERE ur.user_id = p_viewed AND r.code = 'PLATFORM') THEN
    RAISE EXCEPTION 'Platform accounts cannot be viewed';
  END IF;
  UPDATE view_as_log SET ended_at = CURRENT_TIMESTAMP WHERE admin_user_id = p_admin AND ended_at IS NULL;
  INSERT INTO view_as_log (tenant_id, admin_user_id, viewed_user_id, channel, acted) VALUES (a.tenant_id, p_admin, p_viewed, p_channel, p_act)
  RETURNING view_id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION end_view_as(p_admin INTEGER) RETURNS VOID LANGUAGE sql AS $$
  UPDATE view_as_log SET ended_at = CURRENT_TIMESTAMP WHERE admin_user_id = p_admin AND ended_at IS NULL;
$$;

-- Users screen: every account, including sign-ups from the website or the app that are waiting for approval
CREATE OR REPLACE VIEW v_user_directory WITH (security_invoker = true) AS
SELECT u.user_id, u.tenant_id, COALESCE(u.full_name, u.username) AS name, COALESCE(u.email, u.phone) AS sign_in_id, u.status,
       COALESCE((SELECT string_agg(r.code, ',' ORDER BY r.code) FROM user_roles ur JOIN roles r ON r.role_id = ur.role_id WHERE ur.user_id = u.user_id), u.requested_role) AS role_code,
       u.requested_role, d.name AS designation, u.linked_admission_no, u.created_at,
       designation_problem(u.user_id) AS designation_problem
FROM users u LEFT JOIN designations d ON d.designation_id = u.designation_id;
