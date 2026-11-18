-- =====================================================================
-- 024  Settings menu
--      The Operations menu becomes Settings: how the school and the app are set up (people and access, branding,
--      website, screens, templates, bank details, SMS, data import). Bank & Payment Details moves here from Accounts.
--      Menu codes don't change, so role, department and personal permissions carry over.
--      Settings can't be switched off for a school, so the Admin can always reach Users and Roles.
--      Run after 001–023.
-- =====================================================================

UPDATE menus SET code = 'SETTINGS', label = 'Settings', icon = 'settings', sort_order = 95 WHERE code = 'OPERATIONS';
UPDATE features SET code = 'SETTINGS', name = 'Settings' WHERE code = 'OPERATIONS';

-- Bank & Payment Details: from Accounts to Settings (menu and plan feature)
UPDATE menus SET parent_id = (SELECT menu_id FROM menus WHERE code = 'SETTINGS'), route = '/settings/bank' WHERE code = 'ACC_BANK';
UPDATE features SET parent_id = (SELECT feature_id FROM features WHERE code = 'SETTINGS') WHERE code = 'ACC_BANK';

-- Groups inside Settings (the side menu shows a heading for each)
ALTER TABLE menus ADD COLUMN menu_group VARCHAR(40);
UPDATE menus m SET menu_group = v.grp, sort_order = v.ord FROM (VALUES
  ('OPS_USERS', 'People & access', 1), ('OPS_ROLES', 'People & access', 2),
  ('OPS_APPEARANCE', 'School setup', 3), ('OPS_WEBSITE', 'School setup', 4), ('OPS_CHANNELS', 'School setup', 5),
  ('OPS_TEMPLATES', 'School setup', 6), ('ACC_BANK', 'School setup', 7),
  ('OPS_SMS', 'Messages', 8), ('OPS_IMPORT', 'Data', 10)
) AS v(code, grp, ord) WHERE m.code = v.code;

-- Never switched off for a school
DELETE FROM tenant_feature_overrides o USING features f WHERE o.feature_id = f.feature_id AND f.code = 'SETTINGS' AND NOT o.is_enabled;
CREATE OR REPLACE FUNCTION trg_settings_always_on() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NOT NEW.is_enabled AND EXISTS (SELECT 1 FROM features WHERE feature_id = NEW.feature_id AND code = 'SETTINGS') THEN
    RAISE EXCEPTION 'Settings can''t be switched off for a school' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER settings_always_on BEFORE INSERT OR UPDATE ON tenant_feature_overrides FOR EACH ROW EXECUTE FUNCTION trg_settings_always_on();
