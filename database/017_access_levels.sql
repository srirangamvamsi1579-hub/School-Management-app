-- =====================================================================
-- 017  Read only or full access, per main menu and sub-menu, per department
--      - department_menu_permissions.access_level: FULL (open and change) or READ (open, change nothing)
--      - set_department_access(): set NONE / READ / FULL for a sub-menu or a whole main menu
--      - v_user_screens gains access_level (last column): the best level from any source; designation extras
--        and personal grants are full; the Admin profile is full everywhere
--      - can_edit_screen(): what the API checks before saving anything from a screen
--      - v_access_summary: each person, profile, department, designation and screen with its level
--      Run after 001–016.
-- =====================================================================

ALTER TABLE department_menu_permissions
  ADD COLUMN access_level VARCHAR(4) NOT NULL DEFAULT 'FULL' CHECK (access_level IN ('FULL', 'READ'));

CREATE OR REPLACE FUNCTION set_department_access(p_tenant INTEGER, p_department VARCHAR, p_menu_code VARCHAR, p_level VARCHAR) RETURNS INTEGER
LANGUAGE plpgsql AS $$
DECLARE v_ids INTEGER[]; n INTEGER;
BEGIN
  IF p_level NOT IN ('NONE', 'READ', 'FULL') THEN RAISE EXCEPTION 'Level must be NONE, READ or FULL'; END IF;
  IF p_menu_code = 'VIEWAS' OR p_menu_code LIKE 'VA\_%' THEN RAISE EXCEPTION 'View as Profile is for the Admin role only' USING ERRCODE = 'check_violation'; END IF;
  SELECT array_agg(menu_id) INTO v_ids FROM menus
   WHERE code = p_menu_code OR parent_id = (SELECT menu_id FROM menus WHERE code = p_menu_code AND parent_id IS NULL);
  IF v_ids IS NULL THEN RAISE EXCEPTION 'No menu %', p_menu_code; END IF;
  IF p_level = 'NONE' THEN
    DELETE FROM department_menu_permissions WHERE tenant_id = p_tenant AND department = p_department AND menu_id = ANY (v_ids);
  ELSE
    INSERT INTO department_menu_permissions (tenant_id, department, menu_id, access_level) SELECT p_tenant, p_department, unnest(v_ids), p_level
    ON CONFLICT (tenant_id, department, menu_id) DO UPDATE SET access_level = EXCLUDED.access_level;
  END IF;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

-- Same columns as 016 plus access_level at the end
CREATE OR REPLACE VIEW v_user_screens WITH (security_invoker = true) AS
WITH granted AS (
  SELECT ur.user_id, p.menu_id, 'FULL'::varchar AS lvl FROM user_roles ur JOIN roles r ON r.role_id = ur.role_id AND r.code IN ('ADMIN', 'PLATFORM')
    JOIN role_menu_permissions p ON p.role_id = ur.role_id AND p.can_view
  UNION
  SELECT ur.user_id, dp.menu_id, dp.access_level FROM user_roles ur JOIN roles r ON r.role_id = ur.role_id AND r.code NOT IN ('ADMIN', 'PLATFORM')
    JOIN users u ON u.user_id = ur.user_id
    JOIN department_menu_permissions dp ON dp.tenant_id = u.tenant_id AND dp.department = department_of(u.tenant_id, r.code)
  UNION
  SELECT u.user_id, d.menu_id, 'FULL' FROM users u JOIN designation_menu_access d ON d.tenant_id = u.tenant_id AND d.designation_id = u.designation_id
  UNION
  SELECT g.user_id, g.menu_id, 'FULL' FROM user_menu_grants g
), best AS (
  SELECT user_id, menu_id, CASE WHEN bool_or(lvl = 'FULL') THEN 'FULL' ELSE 'READ' END AS access_level FROM granted GROUP BY user_id, menu_id
)
SELECT u.tenant_id, u.user_id, m.menu_id, m.code, m.label, m.route, b.access_level
FROM best b
JOIN users u     ON u.user_id = b.user_id AND u.status = 'ACTIVE'
JOIN menus m     ON m.menu_id = b.menu_id AND m.is_active
JOIN features f  ON f.menu_id = m.menu_id
JOIN v_tenant_features tf ON tf.tenant_id = u.tenant_id AND tf.feature_id = f.feature_id AND tf.enabled;

CREATE OR REPLACE FUNCTION can_edit_screen(p_user INTEGER, p_code VARCHAR) RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM v_user_screens WHERE user_id = p_user AND code = p_code AND access_level = 'FULL');
$$;

CREATE OR REPLACE VIEW v_access_summary WITH (security_invoker = true) AS
SELECT s.tenant_id, s.user_id, COALESCE(u.full_name, u.username) AS name, r.name AS profile,
       department_of(u.tenant_id, r.code) AS department, d.name AS designation,
       pm.label AS menu, s.label AS sub_menu, s.code, s.access_level
FROM v_user_screens s
JOIN users u ON u.user_id = s.user_id
JOIN user_roles ur ON ur.user_id = u.user_id JOIN roles r ON r.role_id = ur.role_id
LEFT JOIN designations d ON d.designation_id = u.designation_id
JOIN menus m ON m.menu_id = s.menu_id LEFT JOIN menus pm ON pm.menu_id = m.parent_id;
