-- =====================================================================
-- MIGRATION 002 — Multi-tenant SaaS: plans by school size, configurable
-- modules / sub-menus / functions, add-ons, limits, Power BI insights.
-- Run AFTER school_schema.sql (PostgreSQL 15+).
--
--   Plan tiers (by enrolled students)
--     STARTER       up to 250
--     GROWTH        251 – 500
--     PROFESSIONAL  501 – 1,000
--     ENTERPRISE    1,000+
--
--   What a person sees =  feature enabled for their school (plan + add-ons − switched off)
--                       ∩ menu allowed for their role (role_menu_permissions)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. PLANS, PRICES, LIMITS
-- ---------------------------------------------------------------------
CREATE TABLE plans (
  plan_id      SERIAL PRIMARY KEY,
  code         VARCHAR(20) UNIQUE NOT NULL,
  name         VARCHAR(40) NOT NULL,
  tier_rank    INTEGER UNIQUE NOT NULL,           -- 1 = smallest
  min_students INTEGER NOT NULL DEFAULT 0,
  max_students INTEGER,                           -- NULL = no upper limit
  description  VARCHAR(200),
  is_public    BOOLEAN DEFAULT TRUE
);

CREATE TABLE plan_prices (
  plan_id           INTEGER REFERENCES plans(plan_id),
  billing_period    VARCHAR(10) CHECK (billing_period IN ('MONTHLY','ANNUAL')),
  currency          CHAR(3) NOT NULL,
  price_per_student NUMERIC(10,2) NOT NULL,
  minimum_charge    NUMERIC(12,2) DEFAULT 0,       -- floor so small schools still cover cost
  effective_from    DATE NOT NULL,
  PRIMARY KEY (plan_id, billing_period, currency, effective_from)
);

CREATE TABLE limit_types (
  limit_code VARCHAR(30) PRIMARY KEY,
  name       VARCHAR(60) NOT NULL,
  unit       VARCHAR(20)
);

CREATE TABLE plan_limits (
  plan_id     INTEGER REFERENCES plans(plan_id),
  limit_code  VARCHAR(30) REFERENCES limit_types(limit_code),
  limit_value INTEGER,                            -- NULL = unlimited
  PRIMARY KEY (plan_id, limit_code)
);

-- ---------------------------------------------------------------------
-- 2. FEATURE CATALOG — module → sub-menu → function (the "console tree")
-- ---------------------------------------------------------------------
CREATE TABLE features (
  feature_id        SERIAL PRIMARY KEY,
  parent_id         INTEGER REFERENCES features(feature_id),
  code              VARCHAR(40) UNIQUE NOT NULL,
  name              VARCHAR(80) NOT NULL,
  kind              VARCHAR(10) NOT NULL CHECK (kind IN ('MODULE','SUBMENU','FUNCTION')),
  menu_id           INTEGER REFERENCES menus(menu_id),   -- set for MODULE / SUBMENU
  is_addon_eligible BOOLEAN DEFAULT TRUE,                -- can be sold to a lower plan
  addon_price       NUMERIC(10,2),                       -- list price per period, optional
  sort_order        INTEGER DEFAULT 0
);

-- Which features each plan includes; variant lets one feature differ by plan
-- (e.g. Insights: BASIC charts on Growth, POWERBI on Professional, POWERBI_CUSTOM on Enterprise)
CREATE TABLE plan_features (
  plan_id    INTEGER REFERENCES plans(plan_id),
  feature_id INTEGER REFERENCES features(feature_id),
  variant    VARCHAR(20),
  PRIMARY KEY (plan_id, feature_id)
);

-- ---------------------------------------------------------------------
-- 3. TENANTS (schools), SUBSCRIPTIONS, OVERRIDES, USAGE
-- ---------------------------------------------------------------------
CREATE TABLE tenants (
  tenant_id        SERIAL PRIMARY KEY,
  code             VARCHAR(20) UNIQUE NOT NULL,
  name             VARCHAR(120) NOT NULL,
  subdomain        VARCHAR(60) UNIQUE NOT NULL,    -- greenvalley.yourapp.com
  deployment_model VARCHAR(10) DEFAULT 'POOLED' CHECK (deployment_model IN ('POOLED','DEDICATED')),
  db_cluster_ref   VARCHAR(120),                   -- set when DEDICATED (Enterprise)
  aws_region       VARCHAR(20) DEFAULT 'ap-south-1',
  status           VARCHAR(10) DEFAULT 'TRIAL' CHECK (status IN ('TRIAL','ACTIVE','SUSPENDED','CANCELLED')),
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tenant_subscriptions (
  subscription_id      SERIAL PRIMARY KEY,
  tenant_id            INTEGER REFERENCES tenants(tenant_id),
  plan_id              INTEGER REFERENCES plans(plan_id),
  billing_period       VARCHAR(10) CHECK (billing_period IN ('MONTHLY','ANNUAL')),
  contracted_students  INTEGER NOT NULL,
  starts_on            DATE NOT NULL,
  ends_on              DATE,
  status               VARCHAR(10) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','EXPIRED','CANCELLED')),
  negotiated_price     NUMERIC(12,2)               -- NULL = list price
);
CREATE UNIQUE INDEX one_active_subscription ON tenant_subscriptions(tenant_id) WHERE status = 'ACTIVE';

-- Per-school switches on top of the plan: buy an add-on, run a trial, or turn something off
CREATE TABLE tenant_feature_overrides (
  tenant_id   INTEGER REFERENCES tenants(tenant_id),
  feature_id  INTEGER REFERENCES features(feature_id),
  is_enabled  BOOLEAN NOT NULL,
  source      VARCHAR(20) NOT NULL CHECK (source IN ('ADDON','TRIAL','CUSTOM','SCHOOL_DISABLED')),
  valid_until DATE,                                -- trials / time-boxed add-ons expire
  price       NUMERIC(10,2),
  changed_by  VARCHAR(80),
  changed_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id, feature_id)
);

CREATE TABLE tenant_limit_overrides (
  tenant_id   INTEGER REFERENCES tenants(tenant_id),
  limit_code  VARCHAR(30) REFERENCES limit_types(limit_code),
  limit_value INTEGER,
  valid_until DATE,
  PRIMARY KEY (tenant_id, limit_code)
);

CREATE TABLE tenant_usage_daily (
  tenant_id       INTEGER REFERENCES tenants(tenant_id),
  usage_date      DATE NOT NULL,
  active_students INTEGER,
  staff_users     INTEGER,
  storage_mb      INTEGER,
  sms_sent        INTEGER,
  pbi_report_views INTEGER,
  PRIMARY KEY (tenant_id, usage_date)
);

CREATE TABLE config_audit (
  audit_id    BIGSERIAL PRIMARY KEY,
  tenant_id   INTEGER REFERENCES tenants(tenant_id),
  feature_id  INTEGER REFERENCES features(feature_id),
  action      VARCHAR(20),                          -- PLAN_CHANGE, ENABLE, DISABLE, LIMIT_CHANGE
  old_value   TEXT,
  new_value   TEXT,
  changed_by  VARCHAR(80),
  changed_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- 4. POWER BI — one Insights sub-menu per main menu, mapped to reports
-- ---------------------------------------------------------------------
CREATE TABLE analytics_reports (
  report_id        SERIAL PRIMARY KEY,
  feature_id       INTEGER REFERENCES features(feature_id),   -- the module's Insights sub-menu
  code             VARCHAR(40) UNIQUE NOT NULL,
  title            VARCHAR(80) NOT NULL,
  variant          VARCHAR(20) NOT NULL CHECK (variant IN ('BASIC','POWERBI','POWERBI_CUSTOM')),
  pbi_workspace_id VARCHAR(64),                    -- Power BI workspace (GUID)
  pbi_report_id    VARCHAR(64),                    -- Power BI report (GUID)
  pbi_page_name    VARCHAR(80),
  rls_role         VARCHAR(40) DEFAULT 'Tenant',   -- RLS role; effective identity = tenant_id
  tenant_id        INTEGER REFERENCES tenants(tenant_id),     -- NULL = standard report for all
  sort_order       INTEGER DEFAULT 0,
  is_active        BOOLEAN DEFAULT TRUE
);

-- ---------------------------------------------------------------------
-- 5. SEED: plans, limits, Insights menus, feature tree, plan contents
-- ---------------------------------------------------------------------
INSERT INTO plans (code, name, tier_rank, min_students, max_students, description) VALUES
 ('STARTER',      'Starter',      1,    0,  250, 'Core school records, fees and parent app'),
 ('GROWTH',       'Growth',       2,  251,  500, 'Adds payroll, concessions, SMS and basic insights'),
 ('PROFESSIONAL', 'Professional', 3,  501, 1000, 'Adds accounts, online payments, workflows, Power BI'),
 ('ENTERPRISE',   'Enterprise',   4, 1001, NULL, 'Multi-campus, SSO, API, custom Power BI, dedicated database');

INSERT INTO limit_types VALUES
 ('STUDENTS','Enrolled students','students'), ('STAFF_USERS','Staff logins','users'),
 ('STORAGE_GB','Document storage','GB'), ('SMS_PER_MONTH','SMS credits','per month'),
 ('BRANCHES','Campuses / branches','branches'), ('CUSTOM_REPORTS','Custom Power BI reports','reports');

INSERT INTO plan_limits (plan_id, limit_code, limit_value)
SELECT p.plan_id, v.code, CASE p.tier_rank WHEN 1 THEN v.l1 WHEN 2 THEN v.l2 WHEN 3 THEN v.l3 ELSE v.l4 END
FROM plans p CROSS JOIN (VALUES
 ('STUDENTS',       250,  500, 1000, NULL::int),
 ('STAFF_USERS',     25,   60,  150, NULL),
 ('STORAGE_GB',      10,   25,  100, 500),
 ('SMS_PER_MONTH',  500, 2000, 5000, 20000),
 ('BRANCHES',         1,    1,    2, NULL),
 ('CUSTOM_REPORTS',   0,    0,    0, 5)
) AS v(code, l1, l2, l3, l4);

-- Insights sub-menu inside each main menu
INSERT INTO menus (parent_id, code, label, route, sort_order)
SELECT m.menu_id, v.code, 'Insights', v.route, 0
FROM menus m JOIN (VALUES
 ('STUDENTS','STU_INS','/students/insights'), ('STAFF','STF_INS','/staff/insights'),
 ('FEES','FEE_INS','/fees/insights'),         ('PAYROLL','PAY_INS','/payroll/insights'),
 ('ACCOUNTS','ACC_INS','/accounts/insights'), ('OPERATIONS','OPS_INS','/ops/insights')
) AS v(parent, code, route) ON m.code = v.parent;

-- Admin & Principal see every Insights page; Accountant sees the finance ones
INSERT INTO role_menu_permissions (role_id, menu_id, can_view, data_scope)
SELECT r.role_id, m.menu_id, TRUE, 'ALL' FROM roles r JOIN menus m ON m.code LIKE '%\_INS'
WHERE r.code IN ('ADMIN','PRINCIPAL')
   OR (r.code = 'ACCOUNTANT' AND m.code IN ('FEE_INS','PAY_INS','ACC_INS'));

-- Every menu becomes a feature (top-level = MODULE, child = SUBMENU)
INSERT INTO features (code, name, kind, menu_id, sort_order)
SELECT code, label, 'MODULE', menu_id, sort_order FROM menus WHERE parent_id IS NULL;
INSERT INTO features (parent_id, code, name, kind, menu_id, sort_order)
SELECT pf.feature_id, m.code, m.label, 'SUBMENU', m.menu_id, m.sort_order
FROM menus m JOIN menus pm ON pm.menu_id = m.parent_id JOIN features pf ON pf.code = pm.code;

-- Functions: capabilities inside a module that are not menus of their own
INSERT INTO features (parent_id, code, name, kind, is_addon_eligible, sort_order)
SELECT f.feature_id, v.code, v.name, 'FUNCTION', v.addon, 100 + v.ord
FROM features f JOIN (VALUES
 ('DASHBOARD','FN_INBOX','Notifications inbox',TRUE,1),
 ('STUDENTS','FN_BULK_IMPORT','Bulk import from Excel',TRUE,1),
 ('STUDENTS','FN_ID_CARDS','ID card printing',TRUE,2),
 ('STUDENTS','FN_ONLINE_ADMISSION','Online admission form',TRUE,3),
 ('STAFF','FN_LEAVE_WORKFLOW','Leave approval workflow',TRUE,1),
 ('STAFF','FN_BIOMETRIC','Biometric attendance sync',TRUE,2),
 ('ACADEMICS','FN_MULTI_CAMPUS','Multiple campuses / branches',TRUE,1),
 ('FEES','FN_SMS_REMIND','SMS fee reminders',TRUE,1),
 ('FEES','FN_PAYMENT_GATEWAY','Online payment gateway',TRUE,2),
 ('FEES','FN_PAYMENT_LINKS','Payment links',TRUE,3),
 ('FEES','FN_WHATSAPP','WhatsApp receipts & reminders',TRUE,4),
 ('PAYROLL','FN_PAYROLL_APPROVAL','Payroll approval workflow',TRUE,1),
 ('PAYROLL','FN_BANK_FILE','Bank transfer file',TRUE,2),
 ('PAYROLL','FN_STATUTORY','Statutory reports (PF, tax)',TRUE,3),
 ('ACCOUNTS','FN_BANK_RECON','Bank reconciliation',TRUE,1),
 ('ACCOUNTS','FN_BUDGETS','Budgets & variance',TRUE,2),
 ('OPERATIONS','FN_CUSTOM_ROLES','Custom roles',TRUE,1),
 ('OPERATIONS','FN_SSO','Single sign-on (Google / Microsoft)',FALSE,2),
 ('OPERATIONS','FN_API','Open API access',FALSE,3),
 ('OPERATIONS','FN_AUDIT_EXPORT','Audit log export',TRUE,4),
 ('OPERATIONS','FN_BRANDING','Custom domain & branding',TRUE,5),
 ('SELF','FN_PARENT_APP','Parent mobile app',TRUE,1),
 ('SELF','FN_TEACHER_APP','Teacher mobile app',TRUE,2)
) AS v(module, code, name, addon, ord) ON f.code = v.module;

-- Lowest plan (tier_rank) that includes each feature
CREATE TEMP TABLE feature_min_tier (code VARCHAR(40) PRIMARY KEY, min_rank INT);
INSERT INTO feature_min_tier VALUES
 ('DASHBOARD',1),('STUDENTS',1),('STAFF',1),('ACADEMICS',1),('FEES',1),('PAYROLL',2),('ACCOUNTS',3),('OPERATIONS',1),('SELF',1),
 ('STU_LIST',1),('STU_ADMIT',1),('STU_ATT',1),('STU_DOCS',1),('STU_PROMOTE',2),('STU_INS',2),
 ('STF_LIST',1),('STF_ADD',1),('STF_ATT',1),('STF_LEAVE',1),('STF_DEPT',1),('STF_INS',2),
 ('ACA_YEAR',1),('ACA_CLASS',1),('ACA_SUBJ',1),
 ('FEE_COLLECT',1),('FEE_DUES',1),('FEE_RECEIPTS',1),('FEE_STRUCT',1),('FEE_CONC',2),('FEE_REFUND',2),('FEE_INS',2),
 ('PAY_RUN',2),('PAY_SLIPS',2),('PAY_STRUCT',2),('PAY_ADV',3),('PAY_INS',2),
 ('ACC_STMT',3),('ACC_EXP',3),('ACC_BOOKS',3),('ACC_COA',3),('ACC_RPT',3),('ACC_INS',3),
 ('OPS_USERS',1),('OPS_ROLES',1),('OPS_AUDIT',3),('OPS_SETTINGS',1),('OPS_INS',3),
 ('SELF_PROFILE',1),('SELF_CHILD',1),('SELF_FEES',1),('SELF_PAYSLIP',2),
 ('FN_INBOX',1),('FN_BULK_IMPORT',2),('FN_ID_CARDS',2),('FN_ONLINE_ADMISSION',3),('FN_LEAVE_WORKFLOW',2),('FN_BIOMETRIC',4),
 ('FN_MULTI_CAMPUS',4),('FN_SMS_REMIND',2),('FN_PAYMENT_GATEWAY',3),('FN_PAYMENT_LINKS',3),('FN_WHATSAPP',3),
 ('FN_PAYROLL_APPROVAL',3),('FN_BANK_FILE',3),('FN_STATUTORY',3),('FN_BANK_RECON',4),('FN_BUDGETS',4),
 ('FN_CUSTOM_ROLES',3),('FN_SSO',4),('FN_API',4),('FN_AUDIT_EXPORT',4),('FN_BRANDING',4),
 ('FN_PARENT_APP',1),('FN_TEACHER_APP',2);

INSERT INTO plan_features (plan_id, feature_id, variant)
SELECT p.plan_id, f.feature_id,
       CASE WHEN f.code LIKE '%\_INS' THEN
         CASE WHEN p.tier_rank = 2 THEN 'BASIC' WHEN p.tier_rank = 3 THEN 'POWERBI' ELSE 'POWERBI_CUSTOM' END END
FROM features f JOIN feature_min_tier t ON t.code = f.code
JOIN plans p ON p.tier_rank >= t.min_rank;

-- Power BI report pages behind each Insights sub-menu (GUIDs filled in after publishing)
INSERT INTO analytics_reports (feature_id, code, title, variant, pbi_page_name, sort_order)
SELECT f.feature_id, v.code, v.title, 'POWERBI', v.page, v.ord
FROM features f JOIN (VALUES
 ('STU_INS','RPT_ENROLMENT','Enrolment & capacity','Enrolment',1),
 ('STU_INS','RPT_ATTENDANCE','Attendance patterns','Attendance',2),
 ('STU_INS','RPT_AT_RISK','Students at risk','AtRisk',3),
 ('STF_INS','RPT_STAFF_MIX','Staff mix & ratio','StaffMix',1),
 ('STF_INS','RPT_LEAVE','Leave & absence','Leave',2),
 ('FEE_INS','RPT_COLLECTION','Collection vs billed','Collection',1),
 ('FEE_INS','RPT_DEFAULTERS','Overdue ageing & defaulters','Defaulters',2),
 ('FEE_INS','RPT_PAY_MODES','Payment modes','Modes',3),
 ('FEE_INS','RPT_CONCESSIONS','Concessions given','Concessions',4),
 ('PAY_INS','RPT_PAYROLL_COST','Payroll cost by department','Cost',1),
 ('PAY_INS','RPT_PAYROLL_TREND','Salary trend & headcount','Trend',2),
 ('ACC_INS','RPT_INCOME_EXP','Income vs expenses','IncomeExpense',1),
 ('ACC_INS','RPT_CASHFLOW','Cash flow & bank balance','CashFlow',2),
 ('ACC_INS','RPT_EXP_CATEGORY','Expense by category','Expenses',3),
 ('OPS_INS','RPT_ADOPTION','Logins & app adoption','Adoption',1)
) AS v(feature, code, title, page, ord) ON f.code = v.feature;

-- ---------------------------------------------------------------------
-- 6. EFFECTIVE FEATURES PER SCHOOL
--    enabled = (active override ? override : in plan) AND parent enabled
-- ---------------------------------------------------------------------
CREATE VIEW v_tenant_features AS
WITH RECURSIVE cur AS (
  SELECT s.tenant_id, s.plan_id FROM tenant_subscriptions s
  WHERE s.status = 'ACTIVE' AND CURRENT_DATE >= s.starts_on AND (s.ends_on IS NULL OR CURRENT_DATE <= s.ends_on)
), base AS (
  SELECT c.tenant_id, f.feature_id, f.parent_id, f.code, f.kind, pf.variant,
         (o.feature_id IS NOT NULL AND (o.valid_until IS NULL OR o.valid_until >= CURRENT_DATE)) AS has_override,
         o.is_enabled AS override_on, o.source AS override_source,
         (pf.feature_id IS NOT NULL) AS in_plan
  FROM cur c CROSS JOIN features f
  LEFT JOIN plan_features pf ON pf.plan_id = c.plan_id AND pf.feature_id = f.feature_id
  LEFT JOIN tenant_feature_overrides o ON o.tenant_id = c.tenant_id AND o.feature_id = f.feature_id
), flagged AS (
  SELECT b.*, CASE WHEN has_override THEN override_on ELSE in_plan END AS self_on,
         CASE WHEN has_override THEN override_source WHEN in_plan THEN 'PLAN' ELSE 'NOT_IN_PLAN' END AS source
  FROM base b
), tree AS (
  SELECT tenant_id, feature_id, code, kind, variant, source, self_on AS enabled FROM flagged WHERE parent_id IS NULL
  UNION ALL
  SELECT f.tenant_id, f.feature_id, f.code, f.kind, f.variant, f.source, (f.self_on AND t.enabled)
  FROM flagged f JOIN tree t ON t.tenant_id = f.tenant_id AND f.parent_id = t.feature_id
)
SELECT * FROM tree;

-- Effective limits per school
CREATE VIEW v_tenant_limits AS
SELECT s.tenant_id, pl.limit_code,
       CASE WHEN o.limit_code IS NOT NULL AND (o.valid_until IS NULL OR o.valid_until >= CURRENT_DATE)
            THEN o.limit_value ELSE pl.limit_value END AS limit_value
FROM tenant_subscriptions s
JOIN plan_limits pl ON pl.plan_id = s.plan_id
LEFT JOIN tenant_limit_overrides o ON o.tenant_id = s.tenant_id AND o.limit_code = pl.limit_code
WHERE s.status = 'ACTIVE';

-- ---------------------------------------------------------------------
-- 7. MULTI-TENANCY: tenant_id on every school table + row-level security
--    The app sets:  SET app.tenant_id = '<id>'  per request/transaction,
--    and connects as a NON-OWNER role (table owners bypass RLS).
-- ---------------------------------------------------------------------
INSERT INTO tenants (code, name, subdomain, status) VALUES ('DEMO', 'Demo School', 'demo', 'ACTIVE');
INSERT INTO tenant_subscriptions (tenant_id, plan_id, billing_period, contracted_students, starts_on)
SELECT 1, plan_id, 'ANNUAL', 800, DATE '2026-04-01' FROM plans WHERE code = 'PROFESSIONAL';

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','audit_logs','academic_years','classes','sections','subjects','departments','designations',
    'staff','staff_attendance','leave_requests','students','guardians','student_guardians','enrollments',
    'student_attendance','student_documents','fee_heads','fee_structures','fee_concessions','fee_invoices',
    'fee_invoice_items','fee_payments','payment_allocations','salary_components','staff_salary_structures',
    'salary_advances','payroll_runs','payslips','payslip_lines','ledger_accounts','vouchers','voucher_lines','expenses']
  LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN tenant_id INTEGER REFERENCES tenants(tenant_id)', t);
    EXECUTE format('UPDATE %I SET tenant_id = 1', t);                       -- existing rows → demo school
    EXECUTE format('ALTER TABLE %I ALTER COLUMN tenant_id SET NOT NULL', t);
    EXECUTE format('CREATE INDEX ON %I (tenant_id)', t);
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY tenant_isolation ON %I
                     USING (tenant_id = current_setting('app.tenant_id', true)::int)
                     WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::int)$p$, t);
  END LOOP;
END $$;

-- Roles: system roles are shared (tenant_id NULL); custom roles belong to one school
ALTER TABLE roles ADD COLUMN tenant_id INTEGER REFERENCES tenants(tenant_id);
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_or_system ON roles
  USING (tenant_id IS NULL OR tenant_id = current_setting('app.tenant_id', true)::int)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::int);

-- Business keys become unique per school instead of globally
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('users','users_username_key','username'), ('users','users_email_key','email'),
    ('students','students_admission_no_key','admission_no'), ('staff','staff_employee_code_key','employee_code'),
    ('fee_invoices','fee_invoices_invoice_no_key','invoice_no'), ('fee_payments','fee_payments_receipt_no_key','receipt_no'),
    ('vouchers','vouchers_voucher_no_key','voucher_no'), ('ledger_accounts','ledger_accounts_code_key','code'),
    ('academic_years','academic_years_name_key','name'), ('subjects','subjects_code_key','code'),
    ('fee_heads','fee_heads_name_key','name'), ('departments','departments_name_key','name'),
    ('designations','designations_name_key','name'), ('salary_components','salary_components_name_key','name'),
    ('payroll_runs','payroll_runs_pay_month_pay_year_key','pay_month, pay_year'), ('roles','roles_code_key','code')
  ) AS v(tbl, cons, cols)
  LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', r.tbl, r.cons);
    EXECUTE format('ALTER TABLE %I ADD UNIQUE (tenant_id, %s)', r.tbl, r.cols);
  END LOOP;
END $$;

-- Reporting views must respect RLS of the person querying them
ALTER VIEW v_account_statement SET (security_invoker = true);
ALTER VIEW v_student_dues      SET (security_invoker = true);

-- ---------------------------------------------------------------------
-- 8. SIDEBAR = role permission ∩ feature enabled for the user's school
-- ---------------------------------------------------------------------
DROP VIEW v_user_menu;
CREATE VIEW v_user_menu WITH (security_invoker = true) AS
SELECT u.tenant_id, ur.user_id, m.menu_id, m.parent_id, m.code, m.label, m.route, m.icon, m.sort_order,
       MAX(tf.variant)        AS variant,          -- e.g. Insights BASIC vs POWERBI
       BOOL_OR(p.can_create)  AS can_create,
       BOOL_OR(p.can_edit)    AS can_edit,
       BOOL_OR(p.can_delete)  AS can_delete,
       BOOL_OR(p.can_approve) AS can_approve
FROM users u
JOIN user_roles ur            ON ur.user_id = u.user_id
JOIN role_menu_permissions p  ON p.role_id = ur.role_id AND p.can_view
JOIN menus m                  ON m.menu_id = p.menu_id AND m.is_active
JOIN features f               ON f.menu_id = m.menu_id
JOIN v_tenant_features tf     ON tf.tenant_id = u.tenant_id AND tf.feature_id = f.feature_id AND tf.enabled
GROUP BY u.tenant_id, ur.user_id, m.menu_id, m.parent_id, m.code, m.label, m.route, m.icon, m.sort_order;

-- Quick check for one school: SELECT code, kind, source, enabled FROM v_tenant_features WHERE tenant_id = 1;
