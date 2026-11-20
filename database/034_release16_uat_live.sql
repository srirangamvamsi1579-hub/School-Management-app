-- =====================================================================
-- 034  Release 16: every client gets a UAT / demo school and, after approval and signing, a live school.
--      • Convert to client → "<School> – UAT/DEMO": basic menus + every add-on agreed with the client, and Project → Project Links
--        (test build, website, phone app, requirements document, release links).
--      • Client approval and signing (client_project_signoffs) → "<School> – Live (date)" with the same menus.
--      • Each school has its own git branch, school/<subdomain>, cut from dev; UAT tags <sub>-uat-vN.N, live tags <sub>-vN.N.
--      Run after 001–033.
-- =====================================================================

-- ---------- Which environment a school is ----------
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS environment VARCHAR(4) CHECK (environment IN ('UAT', 'LIVE'));

-- ---------- Project → Project Links: only in client schools ----------
INSERT INTO menus (parent_id, code, label, route, sort_order) SELECT NULL, 'PROJECT', 'Project', NULL, 90 WHERE NOT EXISTS (SELECT 1 FROM menus WHERE code = 'PROJECT');
INSERT INTO menus (parent_id, code, label, route, sort_order) SELECT m.menu_id, 'PRJ_LINKS', 'Project Links', '/project/links', 1 FROM menus m
WHERE m.code = 'PROJECT' AND NOT EXISTS (SELECT 1 FROM menus WHERE code = 'PRJ_LINKS');
INSERT INTO role_menu_permissions (role_id, menu_id, can_view, can_create, can_edit, data_scope)
SELECT r.role_id, m.menu_id, TRUE, FALSE, FALSE, 'ALL' FROM roles r, menus m
WHERE r.code IN ('ADMIN', 'PRINCIPAL') AND r.tenant_id IS NULL AND m.code IN ('PROJECT', 'PRJ_LINKS')
ON CONFLICT (role_id, menu_id) DO NOTHING;
CREATE OR REPLACE FUNCTION project_menu_allowed(p_tenant INTEGER) RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM tenants WHERE tenant_id = p_tenant AND environment IS NOT NULL)
$$;

-- ---------- Client projects: UAT school, live school, branch ----------
ALTER TABLE client_projects DROP CONSTRAINT IF EXISTS client_projects_status_check;
UPDATE client_projects SET status = CASE status WHEN 'Live' THEN 'Live' ELSE 'UAT / Demo' END;
ALTER TABLE client_projects ALTER COLUMN status SET DEFAULT 'UAT / Demo';
ALTER TABLE client_projects
  ADD COLUMN IF NOT EXISTS live_tenant_id INTEGER UNIQUE REFERENCES tenants(tenant_id),
  ADD COLUMN IF NOT EXISTS git_base   VARCHAR(20) NOT NULL DEFAULT 'dev' CHECK (git_base IN ('dev', 'main')),
  ADD COLUMN IF NOT EXISTS git_branch VARCHAR(60) UNIQUE CHECK (git_branch ~ '^school/[a-z0-9-]{2,40}$'),
  ADD COLUMN IF NOT EXISTS live_version VARCHAR(10) CHECK (live_version ~ '^[0-9]+\.[0-9]+$');
ALTER TABLE client_projects ADD CONSTRAINT client_projects_status_check CHECK (status IN ('UAT / Demo', 'Signed off', 'Live'));
COMMENT ON COLUMN client_projects.client_tenant_id IS 'The UAT / demo school (release 16)';
UPDATE client_projects p SET git_branch = 'school/' || regexp_replace(lower(t.subdomain), '^uat-', '')
FROM tenants t WHERE t.tenant_id = p.client_tenant_id AND p.git_branch IS NULL AND lower(t.subdomain) ~ '^[a-z0-9-]{2,44}$';
UPDATE tenants t SET environment = 'UAT' FROM client_projects p WHERE p.client_tenant_id = t.tenant_id AND t.environment IS NULL;

-- Client approval and signing, per version
CREATE TABLE IF NOT EXISTS client_project_signoffs (
  signoff_id   SERIAL PRIMARY KEY,
  project_id   INTEGER NOT NULL REFERENCES client_projects(project_id),
  version      VARCHAR(10) NOT NULL CHECK (version ~ '^[0-9]+\.[0-9]+$'),
  signed_by    VARCHAR(120) NOT NULL CHECK (btrim(signed_by) <> ''),
  designation  VARCHAR(80),
  signed_on    DATE NOT NULL CHECK (signed_on <= CURRENT_DATE),
  reference    VARCHAR(80),
  recorded_by  INTEGER REFERENCES users(user_id),
  recorded_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (project_id, version)
);

-- A live school (and the Signed off / Live statuses) only after the client signed that version
CREATE OR REPLACE FUNCTION client_project_live_check() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IN ('Signed off', 'Live') AND NEW.live_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Record the client''s approval and signing first — that builds the live school';
  END IF;
  IF NEW.live_tenant_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM client_project_signoffs s WHERE s.project_id = NEW.project_id AND s.version = NEW.live_version) THEN
    RAISE EXCEPTION 'The live school is built only from a version the client signed off';
  END IF;
  IF NEW.live_tenant_id IS NOT NULL AND NEW.live_tenant_id = NEW.client_tenant_id THEN
    RAISE EXCEPTION 'The live school is a separate school from the UAT / demo school';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_client_project_live ON client_projects;
CREATE TRIGGER trg_client_project_live BEFORE INSERT OR UPDATE ON client_projects FOR EACH ROW EXECUTE FUNCTION client_project_live_check();

-- Where each client's schools stand
CREATE OR REPLACE VIEW v_client_environments AS
SELECT p.project_no, p.status, p.version, p.git_branch, p.git_base,
       u.code AS uat_code, u.name AS uat_school, l.code AS live_code, l.name AS live_school, p.live_version,
       (SELECT max(signed_on) FROM client_project_signoffs s WHERE s.project_id = p.project_id) AS last_signed_on,
       regexp_replace(p.git_branch, '^school/', '') || '-uat-v' || p.version AS uat_tag,
       CASE WHEN p.live_version IS NOT NULL THEN regexp_replace(p.git_branch, '^school/', '') || '-v' || p.live_version END AS live_tag
FROM client_projects p JOIN tenants u ON u.tenant_id = p.client_tenant_id LEFT JOIN tenants l ON l.tenant_id = p.live_tenant_id;
