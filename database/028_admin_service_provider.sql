-- =====================================================================
-- 028  Release 13.2: the Admin role gets the Service Provider menu (price list, proposals, demos,
--      competitors, market review), and the Admin can manage Sales & marketing accounts.
--      The trigger from 027 still refuses these menus for every other school role, for any
--      department and for any designation. Run after 027.
--      Note: ADMIN is shared by every school, so in production every school's Admin sees these
--      screens. Before go-live, limit this to our own company's Admin (an open question).
-- =====================================================================
CREATE OR REPLACE FUNCTION no_provider_menus_for_schools() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM menus m JOIN menus p ON p.menu_id = m.parent_id WHERE m.menu_id = NEW.menu_id AND p.code = 'SERVICE_PROVIDER') THEN
    IF TG_TABLE_NAME <> 'role_menu_permissions' THEN
      RAISE EXCEPTION 'Service Provider menus are for the platform team, the sales team and the Admin only';
    ELSIF NOT EXISTS (SELECT 1 FROM roles WHERE role_id = (to_jsonb(NEW) ->> 'role_id')::int AND code IN ('PLATFORM', 'SALES', 'ADMIN') AND tenant_id IS NULL) THEN
      RAISE EXCEPTION 'Service Provider menus are for the platform team, the sales team and the Admin only';
    END IF;
  END IF;
  RETURN NEW;
END $$;

INSERT INTO role_menu_permissions (role_id, menu_id, can_view, can_create, can_edit, data_scope)
SELECT r.role_id, m.menu_id, TRUE, TRUE, TRUE, 'ALL'
FROM roles r JOIN menus m ON m.code IN ('SP_RATES', 'SP_PROPOSAL', 'SP_DEMO', 'SP_COMPARE', 'SP_MARKET')
WHERE r.code = 'ADMIN' AND r.tenant_id IS NULL
ON CONFLICT (role_id, menu_id) DO NOTHING;
