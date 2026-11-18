-- Checks for 024 (Settings menu; Users, Roles and Data Import moved back to Operations in 025). Rolled back.  Expect NOTICE: Settings menu ok
\set ON_ERROR_STOP 1
SET client_min_messages = notice;
BEGIN;
DO $$ BEGIN
  ASSERT (SELECT label FROM menus WHERE code = 'SETTINGS' AND parent_id IS NULL) = 'Settings', 'Settings is a top menu';
  ASSERT (SELECT p.code FROM menus m JOIN menus p ON p.menu_id = m.parent_id WHERE m.code = 'ACC_BANK') = 'SETTINGS', 'bank details under Settings';
  ASSERT NOT EXISTS (SELECT 1 FROM menus m JOIN menus p ON p.menu_id = m.parent_id
                     WHERE m.code IN ('OPS_TEMPLATES', 'OPS_CHANNELS', 'OPS_APPEARANCE', 'OPS_WEBSITE', 'OPS_SMS') AND p.code <> 'SETTINGS'), 'setup screens under Settings';
  ASSERT (SELECT menu_group FROM menus WHERE code = 'OPS_SMS') = 'Messages', 'grouped';
  ASSERT EXISTS (SELECT 1 FROM role_menu_permissions p JOIN roles r ON r.role_id = p.role_id JOIN menus m ON m.menu_id = p.menu_id
                 WHERE r.code = 'ADMIN' AND m.code = 'ACC_BANK'), 'permissions carried over';
  BEGIN
    INSERT INTO tenant_feature_overrides (tenant_id, feature_id, is_enabled, source)
    SELECT 1, feature_id, FALSE, 'SCHOOL_DISABLED' FROM features WHERE code = 'SETTINGS';
    RAISE EXCEPTION 'switched off';
  EXCEPTION WHEN check_violation THEN NULL; END;
  RAISE NOTICE 'Settings menu ok';
END $$;
ROLLBACK;
