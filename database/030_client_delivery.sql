-- =====================================================================
-- 030  Release 14.1: Service Provider only for our own company's Admin; client delivery when a proposal is won
--      (the client's school, versioned documents, a register of links with environment, version and date, and
--      what was shared with the customer); sales plan names on the school plans.
--      Run after 001–029.
-- =====================================================================

-- ---------- Our company: one tenant, and the Admins in it who may open Service Provider ----------
ALTER TABLE tenants ADD COLUMN is_company BOOLEAN NOT NULL DEFAULT FALSE;
CREATE UNIQUE INDEX tenants_one_company ON tenants (is_company) WHERE is_company;
ALTER TABLE users ADD COLUMN is_company_admin BOOLEAN NOT NULL DEFAULT FALSE;
-- Only an Admin of our company's tenant can be a company Admin
CREATE FUNCTION company_admin_check() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.is_company_admin AND NOT EXISTS (SELECT 1 FROM tenants WHERE tenant_id = NEW.tenant_id AND is_company) THEN
    RAISE EXCEPTION 'Only an Admin of our own company can see Service Provider';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_company_admin BEFORE INSERT OR UPDATE OF is_company_admin, tenant_id ON users FOR EACH ROW EXECUTE FUNCTION company_admin_check();

-- Who may open the company menus: the platform and sales teams, and our company's Admins
CREATE FUNCTION provider_menu_allowed(p_user INTEGER) RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM user_roles ur JOIN roles r USING (role_id) WHERE ur.user_id = p_user AND r.code IN ('PLATFORM', 'SALES'))
      OR EXISTS (SELECT 1 FROM users u JOIN tenants t USING (tenant_id) JOIN user_roles ur ON ur.user_id = u.user_id JOIN roles r ON r.role_id = ur.role_id
                 WHERE u.user_id = p_user AND r.code = 'ADMIN' AND u.is_company_admin AND t.is_company)
$$;
-- The screens a person sees, with company menus removed for everyone else (the API reads this view)
CREATE VIEW v_user_screens_effective WITH (security_invoker = true) AS
  SELECT s.* FROM v_user_screens s
  WHERE s.code NOT IN ('SP_RATES', 'SP_PROPOSAL', 'SP_DEMO', 'SP_DELIVERY', 'SP_COMPARE', 'SP_MARKET') OR provider_menu_allowed(s.user_id);

-- ---------- Plan names follow the sales plans ----------
UPDATE plans SET name = CASE code WHEN 'STARTER' THEN 'Starter' WHEN 'GROWTH' THEN 'Pro' WHEN 'PROFESSIONAL' THEN 'Pro+' WHEN 'ENTERPRISE' THEN 'Pro+ Enterprise' ELSE name END;

-- ---------- Client Delivery menu ----------
INSERT INTO menus (parent_id, code, label, route, sort_order, menu_group)
SELECT p.menu_id, 'SP_DELIVERY', 'Client Delivery', '/provider/delivery', 4, 'Delivery' FROM menus p WHERE p.code = 'SERVICE_PROVIDER'
  AND NOT EXISTS (SELECT 1 FROM menus WHERE code = 'SP_DELIVERY');
INSERT INTO role_menu_permissions (role_id, menu_id, can_view, can_create, can_edit, data_scope)
SELECT r.role_id, m.menu_id, TRUE, TRUE, TRUE, 'ALL' FROM roles r, menus m
WHERE r.code IN ('PLATFORM', 'SALES', 'ADMIN') AND r.tenant_id IS NULL AND m.code = 'SP_DELIVERY'
ON CONFLICT (role_id, menu_id) DO NOTHING;

-- =====================================================================
-- Client delivery (our company's tables: no tenant_id of their own; each project points at the client's school)
-- =====================================================================
CREATE TABLE client_projects (
  project_id   SERIAL PRIMARY KEY,
  project_no   VARCHAR(20) NOT NULL UNIQUE,
  proposal_id  INTEGER NOT NULL UNIQUE REFERENCES sales_proposals(proposal_id),     -- one project per proposal
  client_tenant_id INTEGER NOT NULL UNIQUE REFERENCES tenants(tenant_id),
  version      VARCHAR(10) NOT NULL DEFAULT '1.0' CHECK (version ~ '^[0-9]+\.[0-9]+$'),
  options_hash VARCHAR(16) NOT NULL,                     -- what was sold; a change means a new version is due
  status       VARCHAR(16) NOT NULL DEFAULT 'Onboarding' CHECK (status IN ('Onboarding', 'Customer testing', 'Live')),
  created_by   INTEGER REFERENCES users(user_id),
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Converting needs a won proposal; converting marks it Won
CREATE FUNCTION project_from_won_proposal() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT status FROM sales_proposals WHERE proposal_id = NEW.proposal_id) = 'Lost' THEN
    RAISE EXCEPTION 'A lost proposal can''t be converted';
  END IF;
  UPDATE sales_proposals SET status = 'Won' WHERE proposal_id = NEW.proposal_id AND status <> 'Won';
  RETURN NEW;
END $$;
CREATE TRIGGER trg_project_won BEFORE INSERT ON client_projects FOR EACH ROW EXECUTE FUNCTION project_from_won_proposal();

CREATE TABLE project_documents (
  project_id  INTEGER NOT NULL REFERENCES client_projects(project_id) ON DELETE CASCADE,
  doc_code    VARCHAR(10) NOT NULL CHECK (doc_code IN ('ORDER', 'WEBSITE', 'APP', 'HOSTING', 'DATA', 'UAT', 'GOLIVE', 'LINKS')),
  version     VARCHAR(10) NOT NULL CHECK (version ~ '^[0-9]+\.[0-9]+$'),
  generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  pdf_key     VARCHAR(300),                            -- S3 key of the PDF for this version
  PRIMARY KEY (project_id, doc_code, version)
);

CREATE TABLE project_links (
  link_id     SERIAL PRIMARY KEY,
  project_id  INTEGER NOT NULL REFERENCES client_projects(project_id) ON DELETE CASCADE,
  link_code   VARCHAR(12) NOT NULL,
  link_group  VARCHAR(10) NOT NULL CHECK (link_group IN ('Testing', 'Website', 'Hosting', 'AWS', 'Mobile', 'Release')),
  label       VARCHAR(120) NOT NULL,
  environment VARCHAR(12) NOT NULL CHECK (environment IN ('Test', 'Dev', 'Pre-prod', 'Production', 'All')),
  url         TEXT NOT NULL,
  version     VARCHAR(20) NOT NULL DEFAULT '—',
  link_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  status      VARCHAR(12) NOT NULL DEFAULT 'Placeholder' CHECK (status IN ('Placeholder', 'Planned', 'Ready', 'Shared')),
  note        TEXT,
  updated_by  INTEGER REFERENCES users(user_id),
  UNIQUE (project_id, link_code),
  -- a placeholder still has a part in < > to fill in; anything else must not
  CHECK ((status = 'Placeholder') = (url ~ '<[^>]*>')),
  -- live links are https (the AWS database line may be a description)
  CHECK (status IN ('Placeholder', 'Planned') OR url LIKE 'https://%' OR link_group = 'AWS')
);
-- Every change keeps the old address, version and date
CREATE TABLE project_link_history (
  link_id    INTEGER NOT NULL REFERENCES project_links(link_id) ON DELETE CASCADE,
  url        TEXT NOT NULL,
  version    VARCHAR(20) NOT NULL,
  link_date  DATE NOT NULL,
  changed_by INTEGER REFERENCES users(user_id),
  changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE FUNCTION keep_link_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.url IS DISTINCT FROM OLD.url OR NEW.version IS DISTINCT FROM OLD.version THEN
    INSERT INTO project_link_history (link_id, url, version, link_date, changed_by) VALUES (OLD.link_id, OLD.url, OLD.version, OLD.link_date, NEW.updated_by);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_link_history BEFORE UPDATE ON project_links FOR EACH ROW EXECUTE FUNCTION keep_link_history();

-- What was sent to the customer, and which version
CREATE TABLE project_shares (
  share_id   SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES client_projects(project_id) ON DELETE CASCADE,
  to_email   VARCHAR(120) NOT NULL CHECK (to_email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  version    VARCHAR(10) NOT NULL,
  link_codes TEXT[] NOT NULL DEFAULT '{}',
  doc_codes  TEXT[] NOT NULL DEFAULT '{}',
  sent_by    INTEGER REFERENCES users(user_id),
  sent_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (cardinality(link_codes) + cardinality(doc_codes) > 0)
);
-- Placeholders are never shared; shared links are marked Shared
CREATE FUNCTION share_links() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM project_links WHERE project_id = NEW.project_id AND link_code = ANY (NEW.link_codes) AND status = 'Placeholder') THEN
    RAISE EXCEPTION 'Placeholder links can''t be shared';
  END IF;
  UPDATE project_links SET status = 'Shared' WHERE project_id = NEW.project_id AND link_code = ANY (NEW.link_codes);
  RETURN NEW;
END $$;
CREATE TRIGGER trg_share_links BEFORE INSERT ON project_shares FOR EACH ROW EXECUTE FUNCTION share_links();
