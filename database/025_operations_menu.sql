-- =====================================================================
-- 025  Operations menu back for user management and data upload
--      Operations: Users, Roles & Permissions (User management) and Data Import (Data upload).
--      Settings keeps the setup screens (branding, website, screens, templates, bank details, SMS, outbox).
--      Menu codes don't change, so permissions carry over. Both menus are always on for a school.
--      Run after 001–024.
-- =====================================================================

INSERT INTO menus (code, label, icon, sort_order) VALUES ('OPERATIONS', 'Operations', 'shield', 8);
INSERT INTO features (code, name, kind, menu_id, is_addon_eligible, sort_order)
SELECT 'OPERATIONS', 'Operations', 'MODULE', menu_id, FALSE, 8 FROM menus WHERE code = 'OPERATIONS';
INSERT INTO plan_features (plan_id, feature_id)
SELECT p.plan_id, f.feature_id FROM plans p CROSS JOIN features f WHERE f.code = 'OPERATIONS' ON CONFLICT DO NOTHING;

UPDATE menus m SET parent_id = (SELECT menu_id FROM menus WHERE code = 'OPERATIONS'), menu_group = v.grp, sort_order = v.ord
FROM (VALUES ('OPS_USERS', 'User management', 1), ('OPS_ROLES', 'User management', 2), ('OPS_IMPORT', 'Data upload', 3)) AS v(code, grp, ord)
WHERE m.code = v.code;
UPDATE features SET parent_id = (SELECT feature_id FROM features WHERE code = 'OPERATIONS')
WHERE code IN ('OPS_USERS', 'OPS_ROLES', 'OPS_IMPORT', 'FN_SELF_SIGNUP', 'FN_CUSTOM_ROLES', 'FN_IMAGE_IMPORT');

-- Whoever could open the moved screens keeps the Operations heading too
INSERT INTO role_menu_permissions (role_id, menu_id, can_view, data_scope)
SELECT DISTINCT p.role_id, o.menu_id, TRUE, 'ALL'
FROM role_menu_permissions p JOIN menus m ON m.menu_id = p.menu_id AND m.code IN ('OPS_USERS', 'OPS_ROLES', 'OPS_IMPORT')
CROSS JOIN menus o WHERE o.code = 'OPERATIONS' AND p.can_view ON CONFLICT DO NOTHING;
INSERT INTO department_menu_permissions (tenant_id, department, menu_id)
SELECT DISTINCT d.tenant_id, d.department, o.menu_id
FROM department_menu_permissions d JOIN menus m ON m.menu_id = d.menu_id AND m.code IN ('OPS_USERS', 'OPS_ROLES', 'OPS_IMPORT')
CROSS JOIN menus o WHERE o.code = 'OPERATIONS' ON CONFLICT DO NOTHING;

-- Neither Operations nor Settings can be switched off for a school
CREATE OR REPLACE FUNCTION trg_settings_always_on() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NOT NEW.is_enabled AND EXISTS (SELECT 1 FROM features WHERE feature_id = NEW.feature_id AND code IN ('SETTINGS', 'OPERATIONS')) THEN
    RAISE EXCEPTION 'Operations and Settings can''t be switched off for a school' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
