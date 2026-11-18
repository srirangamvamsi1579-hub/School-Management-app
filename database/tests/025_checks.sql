-- Checks for 025 (Operations menu for user management and data upload). Rolled back.  Expect NOTICE: Operations menu ok
\set ON_ERROR_STOP 1
SET client_min_messages = notice;
BEGIN;
DO $$ BEGIN
  ASSERT (SELECT label FROM menus WHERE code = 'OPERATIONS' AND parent_id IS NULL) = 'Operations', 'Operations is a top menu';
  ASSERT (SELECT count(*) FROM menus m JOIN menus p ON p.menu_id = m.parent_id
          WHERE p.code = 'OPERATIONS' AND m.code IN ('OPS_USERS', 'OPS_ROLES', 'OPS_IMPORT')) = 3, 'users, roles and import under Operations';
  ASSERT (SELECT string_agg(m.code, ',' ORDER BY m.code) FROM menus m JOIN menus p ON p.menu_id = m.parent_id WHERE p.code = 'OPERATIONS')
         = 'OPS_HELPDOCS,OPS_IMPORT,OPS_ROLES,OPS_USERS', 'nothing else under Operations (Help Documents & FAQs joins in 026)';
  ASSERT (SELECT menu_group FROM menus WHERE code = 'OPS_USERS') = 'User management', 'grouped';
  ASSERT (SELECT menu_group FROM menus WHERE code = 'OPS_IMPORT') = 'Data upload', 'grouped';
  ASSERT EXISTS (SELECT 1 FROM role_menu_permissions p JOIN roles r USING (role_id) JOIN menus m USING (menu_id)
                 WHERE r.code = 'ADMIN' AND m.code = 'OPS_USERS' AND p.can_view), 'Admin keeps Users';
  ASSERT EXISTS (SELECT 1 FROM role_menu_permissions p JOIN roles r USING (role_id) JOIN menus m USING (menu_id)
                 WHERE r.code = 'ADMIN' AND m.code = 'OPERATIONS'), 'Admin has the Operations heading';
  ASSERT (SELECT count(*) FROM plan_features pf JOIN features f USING (feature_id) WHERE f.code = 'OPERATIONS') = (SELECT count(*) FROM plans), 'in every plan';
  ASSERT (SELECT p.code FROM features f JOIN features p ON p.feature_id = f.parent_id WHERE f.code = 'FN_CUSTOM_ROLES') = 'OPERATIONS', 'custom roles function under Operations';
  BEGIN
    INSERT INTO tenant_feature_overrides (tenant_id, feature_id, is_enabled, source)
    SELECT 1, feature_id, FALSE, 'SCHOOL_DISABLED' FROM features WHERE code = 'OPERATIONS';
    RAISE EXCEPTION 'switched off';
  EXCEPTION WHEN check_violation THEN NULL; END;
  RAISE NOTICE 'Operations menu ok';
END $$;
ROLLBACK;
