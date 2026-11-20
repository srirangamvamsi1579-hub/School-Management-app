-- =====================================================================
-- 029  Release 14: Starter / Pro / Pro+ sales catalogue, proposals with a point of contact, margin, profit,
--      operating cost and maximum discount, proposal emails with the PDF; and the new add-ons in schools:
--      Curriculum Planning (LMS), Portfolios, Backups & Restore, Board integration, WhatsApp, Timings.
--      Run after 001–028.
--
--      Nothing is free: every tier band, add-on, storage and development price must be above zero.
--      WhatsApp is the one add-on with no outside provider cost (phone to phone): its cost is 0 and its
--      provider is recorded as 'No service needed'.
-- =====================================================================

-- ---------- Menus ----------
INSERT INTO menus (parent_id, code, label, route, sort_order, menu_group)
SELECT p.menu_id, v.code, v.label, v.route, v.ord, v.grp FROM (VALUES
  ('STUDENTS', 'STU_PORTFOLIO', 'Portfolios', '/students/portfolios', 30, NULL),
  ('ACADEMICS', 'ACA_CURRICULUM', 'Curriculum Planning', '/academics/curriculum', 30, NULL),
  ('SETTINGS', 'OPS_BACKUP', 'Backups & Restore', '/settings/backups', 30, 'Data')
) AS v(parent, code, label, route, ord, grp) JOIN menus p ON p.code = v.parent
WHERE NOT EXISTS (SELECT 1 FROM menus WHERE code = v.code);

-- ---------- Features: the new screens and functions, and the plans that have them ----------
INSERT INTO features (parent_id, code, name, kind, menu_id, is_addon_eligible, addon_price, sort_order)
SELECT pf.feature_id, m.code, m.label, 'SUBMENU', m.menu_id, TRUE, v.price, m.sort_order
FROM (VALUES ('STU_PORTFOLIO', 'STUDENTS', 20.00), ('ACA_CURRICULUM', 'ACADEMICS', 25.00), ('OPS_BACKUP', 'SETTINGS', 10.00)) AS v(code, parent, price)
JOIN menus m ON m.code = v.code LEFT JOIN features pf ON pf.code = v.parent
WHERE NOT EXISTS (SELECT 1 FROM features WHERE code = m.code);
INSERT INTO features (parent_id, code, name, kind, is_addon_eligible, addon_price, sort_order)
SELECT pf.feature_id, v.code, v.name, 'FUNCTION', TRUE, v.price, 30
FROM (VALUES ('FN_STOP_TIMINGS', 'TRANSPORT', 'Stop timings: worked out from the route and edited (Timings)', 1000.00),
             ('FN_WHATSAPP', 'SETTINGS', 'WhatsApp messages from the school phone (no service needed)', 6000.00),
             ('FN_BOARD', 'EXAMS', 'Board integration: board selection in the Exams menu', 15.00)) AS v(code, parent, name, price)
LEFT JOIN features pf ON pf.code = v.parent
WHERE NOT EXISTS (SELECT 1 FROM features WHERE code = v.code);
INSERT INTO plan_features (plan_id, feature_id)
SELECT p.plan_id, f.feature_id FROM plans p JOIN (VALUES ('OPS_BACKUP', 2), ('ACA_CURRICULUM', 3), ('STU_PORTFOLIO', 3), ('FN_STOP_TIMINGS', 1), ('FN_WHATSAPP', 2), ('FN_BOARD', 2)) AS v(code, rank)
  ON p.tier_rank >= v.rank JOIN features f ON f.code = v.code
ON CONFLICT DO NOTHING;

INSERT INTO role_menu_permissions (role_id, menu_id, can_view, can_create, can_edit, data_scope)
SELECT r.role_id, m.menu_id, TRUE, v.edit, v.edit, v.scope FROM (VALUES
  ('ADMIN', 'STU_PORTFOLIO', TRUE, 'ALL'), ('ADMIN', 'ACA_CURRICULUM', TRUE, 'ALL'), ('ADMIN', 'OPS_BACKUP', TRUE, 'ALL'),
  ('PRINCIPAL', 'STU_PORTFOLIO', TRUE, 'ALL'), ('PRINCIPAL', 'ACA_CURRICULUM', TRUE, 'ALL'),
  ('TEACHER', 'STU_PORTFOLIO', TRUE, 'OWN_CLASS'), ('TEACHER', 'ACA_CURRICULUM', TRUE, 'OWN_CLASS'),
  ('PARENT', 'STU_PORTFOLIO', FALSE, 'OWN_CHILD')
) AS v(role, menu, edit, scope) JOIN roles r ON r.code = v.role AND r.tenant_id IS NULL JOIN menus m ON m.code = v.menu
ON CONFLICT (role_id, menu_id) DO NOTHING;

-- =====================================================================
-- School add-ons
-- =====================================================================
-- Board integration: the school's exam board decides grading scales and report formats in Exams
ALTER TABLE tenants ADD COLUMN exam_board VARCHAR(10) NOT NULL DEFAULT 'CBSE' CHECK (exam_board IN ('CBSE', 'ICSE', 'STATE', 'IB', 'CAMBRIDGE'));

-- Curriculum planning (LMS): units by class, subject and month, and periods taught
CREATE TABLE curriculum_units (
  unit_id    SERIAL PRIMARY KEY,
  tenant_id  INTEGER NOT NULL REFERENCES tenants(tenant_id),
  class_id   INTEGER NOT NULL REFERENCES classes(class_id),
  subject    VARCHAR(40) NOT NULL,
  title      VARCHAR(200) NOT NULL CHECK (btrim(title) <> ''),
  month      CHAR(3) NOT NULL CHECK (month IN ('Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar')),
  periods    INTEGER NOT NULL CHECK (periods BETWEEN 1 AND 60),
  taught     INTEGER NOT NULL DEFAULT 0 CHECK (taught >= 0),
  outcomes   TEXT,
  status     VARCHAR(12) GENERATED ALWAYS AS (CASE WHEN taught = 0 THEN 'Planned' WHEN taught >= periods THEN 'Taught' ELSE 'In progress' END) STORED,
  created_by INTEGER REFERENCES users(user_id),
  CHECK (taught <= periods)
);
CREATE INDEX ON curriculum_units (tenant_id, class_id, subject);

-- Student portfolios: work samples, projects, reflections; shared items show to parents
CREATE TABLE portfolio_items (
  item_id    SERIAL PRIMARY KEY,
  tenant_id  INTEGER NOT NULL REFERENCES tenants(tenant_id),
  student_id INTEGER NOT NULL REFERENCES students(student_id),
  title      VARCHAR(200) NOT NULL CHECK (btrim(title) <> ''),
  kind       VARCHAR(12) NOT NULL CHECK (kind IN ('Work sample', 'Project', 'Reflection', 'Certificate', 'Art', 'Sports')),
  subject    VARCHAR(40),
  item_date  DATE NOT NULL,
  note       TEXT,
  file_key   VARCHAR(300),                       -- S3 key of an uploaded file, if any
  shared     BOOLEAN NOT NULL DEFAULT TRUE,
  created_by INTEGER REFERENCES users(user_id),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX ON portfolio_items (tenant_id, student_id, item_date DESC);

-- Backups: schedule per school and the backups taken (files are in S3, encrypted, second region)
CREATE TABLE backup_settings (
  tenant_id INTEGER PRIMARY KEY REFERENCES tenants(tenant_id),
  schedule  VARCHAR(6) NOT NULL DEFAULT 'DAILY' CHECK (schedule IN ('DAILY', 'WEEKLY')),
  run_at    TIME NOT NULL DEFAULT '02:00',
  keep_days INTEGER NOT NULL DEFAULT 30 CHECK (keep_days IN (7, 30, 90))
);
CREATE TABLE backups (
  backup_id   SERIAL PRIMARY KEY,
  tenant_id   INTEGER NOT NULL REFERENCES tenants(tenant_id),
  kind        VARCHAR(10) NOT NULL CHECK (kind IN ('AUTOMATIC', 'ON_DEMAND', 'RESTORE')),
  taken_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  size_bytes  BIGINT NOT NULL DEFAULT 0 CHECK (size_bytes >= 0),
  storage_key VARCHAR(300),
  restored_from INTEGER REFERENCES backups(backup_id),
  status      VARCHAR(6) NOT NULL DEFAULT 'OK' CHECK (status IN ('OK', 'FAILED')),
  taken_by    INTEGER REFERENCES users(user_id),
  CHECK (kind <> 'RESTORE' OR restored_from IS NOT NULL)
);
CREATE INDEX ON backups (tenant_id, taken_at DESC);
-- Backups older than the school's keep period, ready for the nightly clean-up job
CREATE VIEW backups_to_expire AS
  SELECT b.* FROM backups b JOIN backup_settings s USING (tenant_id)
  WHERE b.kind = 'AUTOMATIC' AND b.taken_at < CURRENT_TIMESTAMP - make_interval(days => s.keep_days);

DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['curriculum_units', 'portfolio_items', 'backup_settings', 'backups'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY tenant_isolation ON %I USING (tenant_id = current_setting('app.tenant_id', true)::int) WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::int)$p$, t);
  END LOOP;
END $$;

-- =====================================================================
-- Sales catalogue (our company, not a school): tiers, bands, add-ons, development, costs and rules
-- =====================================================================
CREATE TABLE provider_profile (
  profile_id  INTEGER PRIMARY KEY DEFAULT 1 CHECK (profile_id = 1),   -- one row: the company selling the platform
  name        VARCHAR(120) NOT NULL,
  product     VARCHAR(120) NOT NULL,
  contact     VARCHAR(80) NOT NULL,
  designation VARCHAR(60),
  email       VARCHAR(120) NOT NULL CHECK (email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  phone       VARCHAR(20) NOT NULL,
  website     VARCHAR(160),
  city        VARCHAR(80),
  about       TEXT
);
CREATE TABLE sales_settings (
  settings_id     INTEGER PRIMARY KEY DEFAULT 1 CHECK (settings_id = 1),
  min_students    INTEGER NOT NULL CHECK (min_students > 0),
  storage_rate    NUMERIC(8,2) NOT NULL CHECK (storage_rate > 0),     -- per student a year
  storage_min     NUMERIC(10,2) NOT NULL CHECK (storage_min >= 0),
  storage_cost    NUMERIC(8,2) NOT NULL CHECK (storage_cost >= 0),
  overhead_sales_pct NUMERIC(5,2) NOT NULL CHECK (overhead_sales_pct >= 0),
  overhead_dev_pct   NUMERIC(5,2) NOT NULL CHECK (overhead_dev_pct >= 0),
  overhead_admin_pct NUMERIC(5,2) NOT NULL CHECK (overhead_admin_pct >= 0),
  industry_margin_low  NUMERIC(5,2) NOT NULL,
  industry_margin_high NUMERIC(5,2) NOT NULL CHECK (industry_margin_high >= industry_margin_low),
  profit_floor_pct NUMERIC(5,2) NOT NULL CHECK (profit_floor_pct BETWEEN 0 AND 90),
  sales_discount_pct NUMERIC(5,2) NOT NULL CHECK (sales_discount_pct >= 0),
  max_discount_pct   NUMERIC(5,2) NOT NULL CHECK (max_discount_pct >= sales_discount_pct AND max_discount_pct <= 50)
);
CREATE TABLE sales_tiers (
  tier_code  VARCHAR(10) PRIMARY KEY CHECK (tier_code IN ('STARTER', 'PRO', 'PRO_PLUS')),
  name       VARCHAR(20) NOT NULL,
  tagline    VARCHAR(200) NOT NULL,
  run_cost   NUMERIC(8,2) NOT NULL CHECK (run_cost >= 0),        -- cloud, email, support per student a year
  support    VARCHAR(120) NOT NULL,
  is_pick    BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL
);
CREATE TABLE sales_bands (
  band_no       INTEGER PRIMARY KEY,
  from_students INTEGER NOT NULL CHECK (from_students >= 1),
  to_students   INTEGER CHECK (to_students IS NULL OR to_students >= from_students)
);
CREATE TABLE sales_tier_rates (
  tier_code VARCHAR(10) NOT NULL REFERENCES sales_tiers(tier_code) ON DELETE CASCADE,
  band_no   INTEGER NOT NULL REFERENCES sales_bands(band_no),
  rate      NUMERIC(8,2) NOT NULL CHECK (rate > 0),               -- per student a year: no tier is free
  PRIMARY KEY (tier_code, band_no)
);
CREATE TABLE sales_addons (
  addon_code VARCHAR(12) PRIMARY KEY,
  name       VARCHAR(120) NOT NULL,
  group_name VARCHAR(20) NOT NULL,
  unit       VARCHAR(8) NOT NULL CHECK (unit IN ('student', 'bus', 'resident', 'school')),
  rate       NUMERIC(10,2) NOT NULL CHECK (rate > 0),             -- a year: no add-on is free
  min_amount NUMERIC(10,2),
  min_qty    INTEGER,
  cost       NUMERIC(10,2) NOT NULL CHECK (cost >= 0),            -- our cost per unit a year
  setup      NUMERIC(10,2) CHECK (setup > 0),
  provider   VARCHAR(80),                                         -- outside service needed, or 'No service needed'
  needs      VARCHAR(12) REFERENCES sales_addons(addon_code),
  menu_codes TEXT[] NOT NULL DEFAULT '{}',
  function_codes TEXT[] NOT NULL DEFAULT '{}',
  CHECK (provider IS DISTINCT FROM 'No service needed' OR cost = 0)
);
CREATE TABLE sales_tier_addons (
  tier_code  VARCHAR(10) NOT NULL REFERENCES sales_tiers(tier_code) ON DELETE CASCADE,
  addon_code VARCHAR(12) NOT NULL REFERENCES sales_addons(addon_code),
  PRIMARY KEY (tier_code, addon_code)
);
CREATE TABLE sales_development (
  item_code VARCHAR(12) NOT NULL CHECK (item_code IN ('WEB_DESIGN', 'DB_SETUP')),
  tier_code VARCHAR(10) NOT NULL REFERENCES sales_tiers(tier_code) ON DELETE CASCADE,
  price     NUMERIC(10,2) NOT NULL CHECK (price > 0),
  cost_pct  NUMERIC(5,2) NOT NULL CHECK (cost_pct BETWEEN 0 AND 100),
  PRIMARY KEY (item_code, tier_code)
);

-- Tier price for a number of students: each band's students at that band's rate (like tax slabs)
CREATE FUNCTION sales_tier_price(p_tier VARCHAR, p_students INTEGER) RETURNS NUMERIC LANGUAGE sql STABLE AS $$
  SELECT COALESCE(SUM(GREATEST(0, LEAST(GREATEST(p_students, s.min_students), COALESCE(b.to_students, 2147483647)) - b.from_students + 1) * r.rate), 0)
  FROM sales_bands b JOIN sales_tier_rates r ON r.band_no = b.band_no AND r.tier_code = p_tier CROSS JOIN sales_settings s
$$;

-- Seed the launch catalogue (matches app/src/lib/pricing.js)
INSERT INTO provider_profile (name, product, contact, designation, email, phone, website, city, about) VALUES
  ('YourApp School Systems (example)', 'YourApp School Platform', 'Sales team', 'Sales & marketing', 'sales@yourapp.example.com', '+91 80000 00000', 'https://yourapp.example.com', 'Bengaluru, Karnataka',
   'We build school software for Indian schools: admissions to report cards, fees, transport and a phone app for every parent.');
INSERT INTO sales_settings VALUES (1, 200, 12, 3000, 6, 25, 15, 10, 70, 80, 15, 10, 20);
INSERT INTO sales_tiers VALUES
  ('STARTER', 'Starter', 'The office and classroom basics, working from day one.', 50, 'Email support, reply in 2 working days', FALSE, 1),
  ('PRO', 'Pro', 'Dashboards, desks and homework: the school runs from one screen.', 65, 'Email and phone, next working day', TRUE, 2),
  ('PRO_PLUS', 'Pro+', 'Buses on the map, boards in exams, learning plans and portfolios.', 85, 'Named contact, same day; priority onboarding', FALSE, 3);
INSERT INTO sales_bands VALUES (1, 1, 300), (2, 301, 700), (3, 701, 1500), (4, 1501, NULL);
INSERT INTO sales_tier_rates SELECT t, b, r FROM (VALUES
  ('STARTER', 1, 280), ('STARTER', 2, 250), ('STARTER', 3, 220), ('STARTER', 4, 190),
  ('PRO', 1, 420), ('PRO', 2, 380), ('PRO', 3, 340), ('PRO', 4, 300),
  ('PRO_PLUS', 1, 600), ('PRO_PLUS', 2, 540), ('PRO_PLUS', 3, 480), ('PRO_PLUS', 4, 420)) AS v(t, b, r);
INSERT INTO sales_addons (addon_code, name, group_name, unit, rate, min_amount, min_qty, cost, setup, provider, menu_codes, function_codes) VALUES
  ('DASHBOARD', 'Dashboard menu', 'Screens', 'student', 20, 5000, NULL, 3, NULL, NULL, '{DASH}', '{}'),
  ('DESKS', 'Students desks: Coordinator Desk, Gate Desk, Parent Meetings', 'Screens', 'student', 30, 7500, NULL, 5, NULL, NULL, '{STU_REQUESTS,STU_GATE,STU_MEETINGS}', '{}'),
  ('BRANDING', 'Templates, appearance and branding', 'Screens', 'school', 12000, NULL, NULL, 1500, 10000, NULL, '{OPS_TEMPLATES,OPS_APPEARANCE}', '{FN_CUSTOM_TEMPLATES}'),
  ('CHANNELS', 'Web and app screens', 'Screens', 'school', 10000, NULL, NULL, 1000, NULL, NULL, '{OPS_CHANNELS}', '{}'),
  ('BACKUP', 'Backups and restore', 'Data', 'student', 10, 3000, NULL, 4, NULL, NULL, '{OPS_BACKUP}', '{}'),
  ('TRANSPORT', 'Transport routes and route map', 'Transport', 'bus', 3000, NULL, 2, 400, NULL, NULL, '{TRN_MANIFEST,TRN_SHEETS,TRN_CHANGES,TRN_ROUTES,ANL_TRANSPORT}', '{FN_ATTENDANT_TRACKING,FN_ROUTE_PLANNING}'),
  ('WHATSAPP', 'WhatsApp messages', 'Messages', 'school', 6000, NULL, NULL, 0, NULL, 'No service needed', '{}', '{FN_WHATSAPP}'),
  ('SMS', 'SMS alerts and OTP', 'Messages', 'student', 18, 6000, NULL, 15, 2500, 'SMS gateway (DLT registered)', '{OPS_SMS}', '{FN_SMS_OTP}'),
  ('BOARD', 'Board integration', 'Academics', 'student', 15, 4000, NULL, 2, NULL, NULL, '{}', '{FN_BOARD}'),
  ('HOMEWORK', 'Homework and assignments', 'Academics', 'student', 15, 4000, NULL, 3, NULL, NULL, '{CMP_HOMEWORK}', '{}'),
  ('LMS', 'LMS: curriculum planning', 'Academics', 'student', 25, 6000, NULL, 4, NULL, NULL, '{ACA_CURRICULUM}', '{}'),
  ('PORTFOLIO', 'Student portfolios', 'Academics', 'student', 20, 5000, NULL, 6, NULL, NULL, '{STU_PORTFOLIO}', '{}'),
  ('QBANK', 'Question bank and papers', 'Academics', 'student', 20, 5000, NULL, 3, NULL, NULL, '{EXM_QP,EXM_APPROVED,EXM_QB,EXM_FORMATS}', '{}'),
  ('ONLINE', 'Online classes', 'Academics', 'student', 15, 4000, NULL, 4, NULL, NULL, '{CMP_CLASSES}', '{}'),
  ('ANALYTICS', 'Data analytics (Power BI reports)', 'Office', 'student', 30, 9000, NULL, 10, NULL, NULL, '{ANL_HOME,ANL_RANK,ANL_TEACHER,ANL_ADMISSIONS,STU_INS,STF_INS,FEE_INS,SELF_MYPERF}', '{}'),
  ('PAYROLL', 'Payroll', 'Office', 'school', 9000, NULL, NULL, 900, NULL, NULL, '{PAY_RUN,PAY_SLIPS,SELF_PAYSLIP}', '{}'),
  ('ACCOUNTS', 'Accounts', 'Office', 'school', 9000, NULL, NULL, 900, NULL, NULL, '{ACC_STMT,ACC_EXP}', '{}'),
  ('LIBRARY', 'Library', 'Campus', 'student', 8, 3000, NULL, 1, NULL, NULL, '{CMP_LIBRARY}', '{}'),
  ('INVENTORY', 'Inventory and store', 'Campus', 'school', 8000, NULL, NULL, 800, NULL, NULL, '{CMP_INVENTORY}', '{}'),
  ('HOSTEL', 'Hostel', 'Campus', 'resident', 180, 12000, NULL, 20, NULL, NULL, '{CMP_HOSTEL}', '{}'),
  ('BRANDED_APP', 'Branded app in the stores', 'Campus', 'school', 18000, NULL, NULL, 8500, 40000, 'Apple and Google developer accounts', '{}', '{}');
INSERT INTO sales_addons (addon_code, name, group_name, unit, rate, min_qty, cost, needs, function_codes) VALUES
  ('TIMINGS', 'Timings', 'Transport', 'bus', 1000, 2, 100, 'TRANSPORT', '{FN_STOP_TIMINGS}');
INSERT INTO sales_tier_addons SELECT t, a FROM (VALUES
  ('PRO', 'DASHBOARD'), ('PRO', 'DESKS'), ('PRO', 'BRANDING'), ('PRO', 'HOMEWORK'), ('PRO', 'QBANK'), ('PRO', 'WHATSAPP'), ('PRO', 'BACKUP')) AS v(t, a);
INSERT INTO sales_tier_addons SELECT 'PRO_PLUS', addon_code FROM sales_tier_addons WHERE tier_code = 'PRO';
INSERT INTO sales_tier_addons SELECT 'PRO_PLUS', a FROM unnest(ARRAY['TRANSPORT', 'TIMINGS', 'CHANNELS', 'BOARD', 'LMS', 'PORTFOLIO', 'ANALYTICS', 'PAYROLL']) a;
INSERT INTO sales_development SELECT i, t, p, 60 FROM (VALUES
  ('WEB_DESIGN', 'STARTER', 20000), ('WEB_DESIGN', 'PRO', 30000), ('WEB_DESIGN', 'PRO_PLUS', 45000),
  ('DB_SETUP', 'STARTER', 10000), ('DB_SETUP', 'PRO', 15000), ('DB_SETUP', 'PRO_PLUS', 25000)) AS v(i, t, p);

-- The price list JSON (kept for history) now holds tiers instead of the old plans
ALTER TABLE price_lists DROP CONSTRAINT IF EXISTS price_lists_card_check;
ALTER TABLE price_lists ADD CONSTRAINT price_lists_card_check CHECK (
  (COALESCE(jsonb_typeof(card -> 'tiers'), '') = 'array' OR COALESCE(jsonb_typeof(card -> 'plans'), '') = 'array') AND COALESCE(jsonb_typeof(card -> 'addons'), '') = 'array');

-- ---------- Proposals: new tiers, point of contact, business case ----------
ALTER TABLE sales_proposals DROP CONSTRAINT IF EXISTS sales_proposals_plan_code_check;
UPDATE sales_proposals SET plan_code = CASE plan_code WHEN 'FREE' THEN 'STARTER' WHEN 'STARTER' THEN 'STARTER' WHEN 'ENTERPRISE' THEN 'PRO_PLUS' ELSE 'PRO' END;
ALTER TABLE sales_proposals ADD CONSTRAINT sales_proposals_plan_code_check CHECK (plan_code IN ('STARTER', 'PRO', 'PRO_PLUS')),
  ADD COLUMN poc_name        VARCHAR(80),
  ADD COLUMN poc_designation VARCHAR(60),
  ADD COLUMN poc_email       VARCHAR(120) CHECK (poc_email IS NULL OR poc_email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  ADD COLUMN poc_phone       VARCHAR(20),
  ADD COLUMN one_time_total  NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (one_time_total >= 0),
  ADD COLUMN operating_cost  NUMERIC(12,2) CHECK (operating_cost >= 0),
  ADD COLUMN profit          NUMERIC(12,2),
  ADD COLUMN gross_margin_pct NUMERIC(5,2),
  ADD COLUMN max_discount_pct NUMERIC(5,2) NOT NULL DEFAULT 20 CHECK (max_discount_pct BETWEEN 0 AND 50),
  ADD COLUMN show_internal   BOOLEAN NOT NULL DEFAULT TRUE;
-- The discount can never go over the proposal's own maximum (which keeps profit at the floor)
ALTER TABLE sales_proposals ADD CONSTRAINT sales_proposals_discount_max CHECK (discount_pct <= max_discount_pct);
ALTER TABLE sales_proposals ADD CONSTRAINT sales_proposals_profit CHECK (profit IS NULL OR operating_cost IS NULL OR profit = yearly_total - operating_cost);

-- Proposal emails, with the PDF that went with them; sending marks a draft as Sent
CREATE TABLE sales_proposal_emails (
  email_id    SERIAL PRIMARY KEY,
  proposal_id INTEGER NOT NULL REFERENCES sales_proposals(proposal_id) ON DELETE CASCADE,
  to_email    VARCHAR(120) NOT NULL CHECK (to_email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  cc          VARCHAR(250),
  subject     VARCHAR(200) NOT NULL,
  body        TEXT NOT NULL,
  pdf_name    VARCHAR(160) NOT NULL CHECK (pdf_name LIKE '%.pdf'),
  pdf_key     VARCHAR(300),                      -- S3 key of the PDF as sent
  pdf_bytes   INTEGER NOT NULL CHECK (pdf_bytes > 0),
  sent_by     INTEGER REFERENCES users(user_id),
  sent_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE FUNCTION proposal_emailed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE sales_proposals SET status = 'Sent' WHERE proposal_id = NEW.proposal_id AND status = 'Draft';
  RETURN NEW;
END $$;
CREATE TRIGGER trg_proposal_emailed AFTER INSERT ON sales_proposal_emails FOR EACH ROW EXECUTE FUNCTION proposal_emailed();
