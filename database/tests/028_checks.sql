-- Checks for 028 (release 13.2). Rolled back. Expect NOTICE: Admin has Service Provider ok
\set ON_ERROR_STOP 1
BEGIN;
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM role_menu_permissions p JOIN roles r USING (role_id) JOIN menus m USING (menu_id)
          WHERE r.code = 'ADMIN' AND r.tenant_id IS NULL AND m.code LIKE 'SP\_%' AND p.can_edit) = 6, 'Admin has all six Service Provider screens (030 adds Client Delivery)';
  BEGIN
    INSERT INTO role_menu_permissions (role_id, menu_id, can_view) SELECT r.role_id, m.menu_id, TRUE FROM roles r, menus m WHERE r.code = 'TEACHER' AND r.tenant_id IS NULL AND m.code = 'SP_PROPOSAL';
    RAISE EXCEPTION 'teacher given a company menu';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM LIKE 'Service Provider menus are for the platform team, the sales team and the Admin only', SQLERRM; END;
  BEGIN
    INSERT INTO department_menu_permissions (tenant_id, department, menu_id) SELECT 1, 'Administration', menu_id FROM menus WHERE code = 'SP_RATES';
    RAISE EXCEPTION 'department given a company menu';
  EXCEPTION WHEN raise_exception THEN NULL; END;
  RAISE NOTICE 'Admin has Service Provider ok';
END $$;
ROLLBACK;
