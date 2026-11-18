-- =====================================================================
-- 016  Access by department; deleting a profile
--      - department_menu_permissions: the screens of a department in a school. Every profile in that department
--        opens the same screens. The Admin profile keeps its own full list (role_menu_permissions).
--      - sync_department_permissions(): a department in use without a list gets one, copied from its first
--        profile (or the profile it was based on); run after adding a profile or changing its department
--      - set_department_menu(): give or take one sub-menu, or a whole main menu (all its sub-menus)
--      - v_user_screens now = Admin role list, or the person's department list, + designation extras + personal grants
--      - tenant_profile_removals / remove_profile() / restore_profile(): a school can delete a profile nobody has
--      Run after 001–015.
-- =====================================================================

CREATE TABLE department_menu_permissions (
  tenant_id  INTEGER NOT NULL REFERENCES tenants(tenant_id),
  department VARCHAR(80) NOT NULL,
  menu_id    INTEGER NOT NULL REFERENCES menus(menu_id) ON DELETE CASCADE,
  PRIMARY KEY (tenant_id, department, menu_id)
);
ALTER TABLE department_menu_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON department_menu_permissions
  USING (tenant_id = current_setting('app.tenant_id', true)::int) WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::int);
-- View as Profile stays Admin-only here too
CREATE TRIGGER view_as_admin_only BEFORE INSERT OR UPDATE ON department_menu_permissions FOR EACH ROW EXECUTE FUNCTION trg_view_as_admin_only();

CREATE TABLE tenant_profile_removals (
  tenant_id  INTEGER NOT NULL REFERENCES tenants(tenant_id),
  role_code  VARCHAR(30) NOT NULL,
  removed_by INTEGER REFERENCES users(user_id),
  removed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id, role_code)
);
ALTER TABLE tenant_profile_removals ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON tenant_profile_removals
  USING (tenant_id = current_setting('app.tenant_id', true)::int) WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::int);

-- Profiles a school uses: shared system roles not removed by the school, plus its own
CREATE OR REPLACE VIEW v_tenant_profiles WITH (security_invoker = true) AS
SELECT t.tenant_id, r.role_id, r.code, r.name, r.is_system, department_of(t.tenant_id, r.code) AS department
FROM tenants t JOIN roles r ON (r.tenant_id IS NULL OR r.tenant_id = t.tenant_id)
WHERE r.code NOT IN ('PLATFORM', 'STUDENT')
  AND NOT EXISTS (SELECT 1 FROM tenant_profile_removals x WHERE x.tenant_id = t.tenant_id AND x.role_code = r.code);

CREATE OR REPLACE FUNCTION sync_department_permissions(p_tenant INTEGER) RETURNS INTEGER
LANGUAGE plpgsql AS $$
DECLARE d RECORD; v_from INTEGER; n INTEGER := 0;
BEGIN
  FOR d IN SELECT department, array_agg(role_id ORDER BY (code = 'ADMIN'), role_id) AS roles
           FROM v_tenant_profiles WHERE tenant_id = p_tenant AND department IS NOT NULL GROUP BY department LOOP
    CONTINUE WHEN EXISTS (SELECT 1 FROM department_menu_permissions WHERE tenant_id = p_tenant AND department = d.department);
    v_from := d.roles[1];
    -- a school-added profile with no screens of its own starts from the profile it was based on
    IF NOT EXISTS (SELECT 1 FROM role_menu_permissions WHERE role_id = v_from AND can_view) THEN
      SELECT COALESCE(based_on_role_id, role_id) INTO v_from FROM roles WHERE role_id = v_from;
    END IF;
    INSERT INTO department_menu_permissions (tenant_id, department, menu_id)
    SELECT p_tenant, d.department, p.menu_id FROM role_menu_permissions p JOIN menus m ON m.menu_id = p.menu_id
    WHERE p.role_id = v_from AND p.can_view AND m.code <> 'VIEWAS' AND m.code NOT LIKE 'VA\_%'
    ON CONFLICT DO NOTHING;
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;

-- Give or take a sub-menu, or a main menu with all its sub-menus
CREATE OR REPLACE FUNCTION set_department_menu(p_tenant INTEGER, p_department VARCHAR, p_menu_code VARCHAR, p_on BOOLEAN) RETURNS INTEGER
LANGUAGE plpgsql AS $$
DECLARE v_ids INTEGER[]; n INTEGER;
BEGIN
  IF p_menu_code = 'VIEWAS' OR p_menu_code LIKE 'VA\_%' THEN RAISE EXCEPTION 'View as Profile is for the Admin role only' USING ERRCODE = 'check_violation'; END IF;
  SELECT array_agg(menu_id) INTO v_ids FROM menus
   WHERE code = p_menu_code OR parent_id = (SELECT menu_id FROM menus WHERE code = p_menu_code AND parent_id IS NULL);
  IF v_ids IS NULL THEN RAISE EXCEPTION 'No menu %', p_menu_code; END IF;
  IF p_on THEN
    INSERT INTO department_menu_permissions (tenant_id, department, menu_id) SELECT p_tenant, p_department, unnest(v_ids) ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM department_menu_permissions WHERE tenant_id = p_tenant AND department = p_department AND menu_id = ANY (v_ids);
  END IF;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

-- Screens each user can open: Admin = the Admin role list; everyone else = their department's list;
-- plus designation extras and personal grants; limited to what the school's plan switches on (same columns as before)
CREATE OR REPLACE VIEW v_user_screens WITH (security_invoker = true) AS
WITH granted AS (
  SELECT ur.user_id, p.menu_id FROM user_roles ur JOIN roles r ON r.role_id = ur.role_id AND r.code IN ('ADMIN', 'PLATFORM')
    JOIN role_menu_permissions p ON p.role_id = ur.role_id AND p.can_view
  UNION
  SELECT ur.user_id, dp.menu_id FROM user_roles ur JOIN roles r ON r.role_id = ur.role_id AND r.code NOT IN ('ADMIN', 'PLATFORM')
    JOIN users u ON u.user_id = ur.user_id
    JOIN department_menu_permissions dp ON dp.tenant_id = u.tenant_id AND dp.department = department_of(u.tenant_id, r.code)
  UNION
  SELECT u.user_id, d.menu_id FROM users u JOIN designation_menu_access d ON d.tenant_id = u.tenant_id AND d.designation_id = u.designation_id
  UNION
  SELECT g.user_id, g.menu_id FROM user_menu_grants g
)
SELECT u.tenant_id, u.user_id, m.menu_id, m.code, m.label, m.route
FROM granted gr
JOIN users u     ON u.user_id = gr.user_id AND u.status = 'ACTIVE'
JOIN menus m     ON m.menu_id = gr.menu_id AND m.is_active
JOIN features f  ON f.menu_id = m.menu_id
JOIN v_tenant_features tf ON tf.tenant_id = u.tenant_id AND tf.feature_id = f.feature_id AND tf.enabled;

-- Delete a profile nobody in the school has. A school-added profile is removed; a shared one is hidden for the school.
CREATE OR REPLACE FUNCTION remove_profile(p_tenant INTEGER, p_role VARCHAR, p_by INTEGER DEFAULT NULL) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE r roles%ROWTYPE; n INTEGER;
BEGIN
  IF p_role IN ('ADMIN', 'PLATFORM') THEN RAISE EXCEPTION 'The % profile cannot be deleted', initcap(p_role); END IF;
  SELECT * INTO r FROM roles WHERE code = p_role AND (tenant_id IS NULL OR tenant_id = p_tenant);
  IF NOT FOUND THEN RAISE EXCEPTION 'No profile %', p_role; END IF;
  SELECT count(*) INTO n FROM users u WHERE u.tenant_id = p_tenant AND u.status <> 'DISABLED'
     AND (EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.user_id AND ur.role_id = r.role_id)
          OR (u.requested_role = p_role AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.user_id)));
  IF n > 0 THEN RAISE EXCEPTION '% % the % profile — move them to another profile first', n, CASE WHEN n = 1 THEN 'person has' ELSE 'people have' END, r.name; END IF;
  IF r.tenant_id = p_tenant THEN
    DELETE FROM role_designations WHERE tenant_id = p_tenant AND role_code = p_role;
    DELETE FROM role_departments WHERE tenant_id = p_tenant AND role_code = p_role;
    DELETE FROM roles WHERE role_id = r.role_id;
  ELSE
    INSERT INTO tenant_profile_removals (tenant_id, role_code, removed_by) VALUES (p_tenant, p_role, p_by) ON CONFLICT DO NOTHING;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION restore_profile(p_tenant INTEGER, p_role VARCHAR) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM tenant_profile_removals WHERE tenant_id = p_tenant AND role_code = p_role;
  PERFORM sync_department_permissions(p_tenant);
END $$;

-- The demo school starts with a list per department
SELECT sync_department_permissions(tenant_id) FROM tenants;
