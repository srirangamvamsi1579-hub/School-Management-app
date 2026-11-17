-- =====================================================================
-- 012  Web & App Screens: per role, which screens show on the website, in the mobile app, or both
--      - Phone-ready catalogue (screens built and store-tested for phones); others are website only
--      - Recommended defaults per role
--      - Layouts per school: DRAFT → PENDING (sent for approval) → PUBLISHED (new version); SUPERSEDED kept as history
--      - Two-person rule: the approver must be a different person, with the Principal or Platform role
--      - v_user_web_screens and v_user_mobile_screens apply the published layout on top of v_user_screens
--      Replaces the per-school screen switches from 011 (tenant_mobile_screens). Run after 001–011.
-- =====================================================================

DROP VIEW IF EXISTS v_user_mobile_screens;
DROP TABLE IF EXISTS tenant_mobile_screens;
DROP FUNCTION IF EXISTS trg_mobile_locked();

-- Phone-ready catalogue (011 created it; add the screens made phone-ready since)
ALTER TABLE mobile_screen_catalog DROP COLUMN default_on;
INSERT INTO mobile_screen_catalog (code, tab_label, locked, sort_order) VALUES
 ('STU_OFFICE','Office',FALSE,10), ('TRN_CHANGES','Bus changes',FALSE,13), ('STF_LEAVE','Leave',FALSE,14), ('SELF_PAYSLIP','Payslips',FALSE,15)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE role_channel_defaults (                -- recommended layout, used where a school has not chosen
  role_code  VARCHAR(30) NOT NULL,
  menu_code  VARCHAR(30) NOT NULL REFERENCES mobile_screen_catalog(code),
  channel    VARCHAR(4)  NOT NULL CHECK (channel IN ('BOTH','WEB','APP')),
  PRIMARY KEY (role_code, menu_code)
);
INSERT INTO role_channel_defaults VALUES
 ('PARENT','SELF_REQUESTS','BOTH'), ('PARENT','SELF_FEES','BOTH'), ('PARENT','SELF_CHILD','BOTH'),
 ('TEACHER','STU_ATT','BOTH'), ('TEACHER','STU_REQUESTS','BOTH'), ('TEACHER','STU_MEETINGS','BOTH'), ('TEACHER','ACA_TIMETABLE','BOTH'),
 ('FRONT_OFFICE','STU_GATE','BOTH'), ('FRONT_OFFICE','STU_OFFICE','BOTH'), ('FRONT_OFFICE','TRN_CHANGES','BOTH'),
 ('TRANSPORT','TRN_SHEETS','BOTH'), ('TRANSPORT','TRN_MANIFEST','BOTH'), ('TRANSPORT','TRN_CHANGES','BOTH'),
 ('PRINCIPAL','STU_REQUESTS','BOTH'), ('PRINCIPAL','STU_MEETINGS','BOTH'), ('PRINCIPAL','STU_OFFICE','BOTH'), ('PRINCIPAL','STU_ATT','BOTH'), ('PRINCIPAL','TRN_SHEETS','BOTH'),
 ('ACCOUNTANT','SELF_PAYSLIP','BOTH');

CREATE TABLE channel_layouts (
  layout_id     SERIAL PRIMARY KEY,
  tenant_id     INTEGER NOT NULL REFERENCES tenants(tenant_id),
  status        VARCHAR(12) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PENDING','PUBLISHED','SUPERSEDED','DISCARDED')),
  version       INTEGER,                                    -- set when published
  created_by    INTEGER NOT NULL REFERENCES users(user_id),
  submitted_by  INTEGER REFERENCES users(user_id),
  submitted_at  TIMESTAMP,
  submit_note   VARCHAR(300),
  approved_by   INTEGER REFERENCES users(user_id),
  approved_at   TIMESTAMP,
  return_note   VARCHAR(300),                               -- reason when sent back
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (status <> 'PUBLISHED' OR (approved_by IS NOT NULL AND approved_by <> submitted_by))
);
CREATE UNIQUE INDEX one_live_layout   ON channel_layouts (tenant_id) WHERE status = 'PUBLISHED';
CREATE UNIQUE INDEX one_open_layout   ON channel_layouts (tenant_id) WHERE status IN ('DRAFT','PENDING');
CREATE UNIQUE INDEX layout_version    ON channel_layouts (tenant_id, version) WHERE version IS NOT NULL;

CREATE TABLE channel_layout_entries (
  layout_id  INTEGER NOT NULL REFERENCES channel_layouts(layout_id) ON DELETE CASCADE,
  tenant_id  INTEGER NOT NULL REFERENCES tenants(tenant_id),
  role_code  VARCHAR(30) NOT NULL,
  menu_code  VARCHAR(30) NOT NULL REFERENCES mobile_screen_catalog(code),
  channel    VARCHAR(4) NOT NULL CHECK (channel IN ('BOTH','WEB','APP')),
  PRIMARY KEY (layout_id, role_code, menu_code)
);
-- Locked screens (Account) stay on both, and only open drafts can be edited
CREATE OR REPLACE FUNCTION trg_layout_entry() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT locked FROM mobile_screen_catalog WHERE code = NEW.menu_code) AND NEW.channel <> 'BOTH' THEN
    RAISE EXCEPTION '% must stay on the website and in the app', NEW.menu_code;
  END IF;
  IF (SELECT status FROM channel_layouts WHERE layout_id = NEW.layout_id) <> 'DRAFT' THEN
    RAISE EXCEPTION 'Only a draft can be changed';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER layout_entry BEFORE INSERT OR UPDATE ON channel_layout_entries FOR EACH ROW EXECUTE FUNCTION trg_layout_entry();

ALTER TABLE channel_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_layout_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON channel_layouts USING (tenant_id = current_setting('app.tenant_id', true)::int) WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::int);
CREATE POLICY tenant_isolation ON channel_layout_entries USING (tenant_id = current_setting('app.tenant_id', true)::int) WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::int);

CREATE OR REPLACE FUNCTION has_role(p_user INT, p_codes TEXT[]) RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.role_id = ur.role_id WHERE ur.user_id = p_user AND r.code = ANY (p_codes));
$$;

-- Open a draft: a copy of the live layout (or of a chosen earlier version)
CREATE OR REPLACE FUNCTION start_channel_draft(p_tenant INT, p_user INT, p_from_version INT DEFAULT NULL) RETURNS INT LANGUAGE plpgsql AS $$
DECLARE v_src INT; v_new INT;
BEGIN
  IF NOT has_role(p_user, ARRAY['ADMIN','PLATFORM']) THEN RAISE EXCEPTION 'Only an Admin or the platform team edits the layout'; END IF;
  IF EXISTS (SELECT 1 FROM channel_layouts WHERE tenant_id = p_tenant AND status = 'PENDING') THEN RAISE EXCEPTION 'A change is waiting for approval'; END IF;
  SELECT layout_id INTO v_new FROM channel_layouts WHERE tenant_id = p_tenant AND status = 'DRAFT';
  IF v_new IS NOT NULL THEN RETURN v_new; END IF;
  SELECT layout_id INTO v_src FROM channel_layouts WHERE tenant_id = p_tenant AND
    CASE WHEN p_from_version IS NULL THEN status = 'PUBLISHED' ELSE version = p_from_version END;
  INSERT INTO channel_layouts (tenant_id, created_by) VALUES (p_tenant, p_user) RETURNING layout_id INTO v_new;
  INSERT INTO channel_layout_entries (layout_id, tenant_id, role_code, menu_code, channel)
  SELECT v_new, p_tenant, role_code, menu_code, channel FROM channel_layout_entries WHERE layout_id = v_src;
  RETURN v_new;
END $$;

CREATE OR REPLACE FUNCTION submit_channel_layout(p_layout INT, p_user INT, p_note TEXT DEFAULT NULL) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE l channel_layouts%ROWTYPE;
BEGIN
  SELECT * INTO l FROM channel_layouts WHERE layout_id = p_layout FOR UPDATE;
  IF l.status <> 'DRAFT' THEN RAISE EXCEPTION 'Only a draft can be sent for approval'; END IF;
  IF NOT has_role(p_user, ARRAY['ADMIN','PLATFORM']) THEN RAISE EXCEPTION 'Only an Admin or the platform team sends layouts'; END IF;
  UPDATE channel_layouts SET status = 'PENDING', submitted_by = p_user, submitted_at = CURRENT_TIMESTAMP, submit_note = p_note, return_note = NULL WHERE layout_id = p_layout;
END $$;

CREATE OR REPLACE FUNCTION approve_channel_layout(p_layout INT, p_user INT) RETURNS INT LANGUAGE plpgsql AS $$
DECLARE l channel_layouts%ROWTYPE; v INT;
BEGIN
  SELECT * INTO l FROM channel_layouts WHERE layout_id = p_layout FOR UPDATE;    -- two approvers at once: the second waits, then sees PUBLISHED
  IF l.status <> 'PENDING' THEN RAISE EXCEPTION 'Nothing is waiting for approval'; END IF;
  IF p_user = l.submitted_by THEN RAISE EXCEPTION 'A different person must approve the change'; END IF;
  IF NOT has_role(p_user, ARRAY['PRINCIPAL','PLATFORM']) THEN RAISE EXCEPTION 'Only the Principal or the platform team approves'; END IF;
  SELECT COALESCE(max(version), 0) + 1 INTO v FROM channel_layouts WHERE tenant_id = l.tenant_id;
  UPDATE channel_layouts SET status = 'SUPERSEDED' WHERE tenant_id = l.tenant_id AND status = 'PUBLISHED';
  UPDATE channel_layouts SET status = 'PUBLISHED', version = v, approved_by = p_user, approved_at = CURRENT_TIMESTAMP WHERE layout_id = p_layout;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION send_back_channel_layout(p_layout INT, p_user INT, p_note TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF p_note IS NULL OR trim(p_note) = '' THEN RAISE EXCEPTION 'Say what should change'; END IF;
  IF NOT has_role(p_user, ARRAY['PRINCIPAL','PLATFORM']) THEN RAISE EXCEPTION 'Only the Principal or the platform team approves'; END IF;
  UPDATE channel_layouts SET status = 'DRAFT', return_note = p_note WHERE layout_id = p_layout AND status = 'PENDING';
  IF NOT FOUND THEN RAISE EXCEPTION 'Nothing is waiting for approval'; END IF;
END $$;

-- Where a screen shows for a role in a school: published choice → recommended → website
CREATE OR REPLACE FUNCTION screen_channel(p_tenant INT, p_role TEXT, p_code TEXT) RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM mobile_screen_catalog c WHERE c.code = p_code) THEN 'WEB'
    WHEN (SELECT locked FROM mobile_screen_catalog c WHERE c.code = p_code) THEN 'BOTH'
    ELSE COALESCE(
      (SELECT e.channel FROM channel_layout_entries e JOIN channel_layouts l ON l.layout_id = e.layout_id AND l.status = 'PUBLISHED'
        WHERE l.tenant_id = p_tenant AND e.role_code = p_role AND e.menu_code = p_code),
      (SELECT d.channel FROM role_channel_defaults d WHERE d.role_code = p_role AND d.menu_code = p_code),
      'WEB') END;
$$;

-- Website menu per person: allowed screens minus those set to app only for every one of their roles
CREATE VIEW v_user_web_screens WITH (security_invoker = true) AS
SELECT s.* FROM v_user_screens s
WHERE EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.role_id = ur.role_id
              WHERE ur.user_id = s.user_id AND screen_channel(s.tenant_id, r.code, s.code) IN ('BOTH','WEB'));

-- Phone tabs per person: the school has the app on, and a role of theirs puts an allowed screen in the app
CREATE VIEW v_user_mobile_screens WITH (security_invoker = true) AS
SELECT u.tenant_id, u.user_id, c.code, c.tab_label, c.sort_order
FROM users u
JOIN tenant_mobile_app a ON a.tenant_id = u.tenant_id AND a.enabled
CROSS JOIN mobile_screen_catalog c
WHERE u.status = 'ACTIVE'
  AND (c.code = 'M_HOME' OR (
       EXISTS (SELECT 1 FROM v_user_screens s WHERE s.user_id = u.user_id AND s.code = c.code)
   AND EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.role_id = ur.role_id
               WHERE ur.user_id = u.user_id AND screen_channel(u.tenant_id, r.code, c.code) IN ('BOTH','APP'))));

-- Menu entry
INSERT INTO menus (parent_id, code, label, route, sort_order)
SELECT m.menu_id, 'OPS_CHANNELS', 'Web & App Screens', '/operations/channels', 5 FROM menus m WHERE m.code = 'OPERATIONS';
INSERT INTO features (parent_id, code, name, kind, menu_id, sort_order)
SELECT pf.feature_id, m.code, m.label, 'SUBMENU', m.menu_id, m.sort_order FROM menus m JOIN features pf ON pf.code = 'OPERATIONS' WHERE m.code = 'OPS_CHANNELS';
INSERT INTO plan_features (plan_id, feature_id) SELECT p.plan_id, f.feature_id FROM features f CROSS JOIN plans p WHERE f.code = 'OPS_CHANNELS' ON CONFLICT DO NOTHING;
INSERT INTO role_menu_permissions (role_id, menu_id, can_view, can_create, can_edit, can_delete, can_approve, data_scope)
SELECT r.role_id, m.menu_id, TRUE, v.edit, v.edit, FALSE, v.approve, 'ALL'
FROM (VALUES ('ADMIN', TRUE, FALSE), ('PRINCIPAL', FALSE, TRUE)) AS v(role, edit, approve)
JOIN roles r ON r.code = v.role JOIN menus m ON m.code = 'OPS_CHANNELS' ON CONFLICT DO NOTHING;
