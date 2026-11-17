-- =====================================================================
-- School Management System — Database Schema (PostgreSQL / SQLite-friendly)
-- Modules: Security & Menus · Academics · Students · Staff · Fees ·
--          Payroll · Accounts (double-entry) · Audit
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. SECURITY, ROLES & PROFILE-BASED MENUS (Operations > User Management)
-- ---------------------------------------------------------------------
CREATE TABLE roles (
  role_id       SERIAL PRIMARY KEY,
  code          VARCHAR(30) UNIQUE NOT NULL,      -- ADMIN, PRINCIPAL, ACCOUNTANT, TEACHER, FRONT_OFFICE, PARENT, STUDENT
  name          VARCHAR(60) NOT NULL,
  is_system     BOOLEAN DEFAULT FALSE,            -- system roles cannot be deleted
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
  user_id       SERIAL PRIMARY KEY,
  username      VARCHAR(60) UNIQUE NOT NULL,
  email         VARCHAR(120) UNIQUE,
  phone         VARCHAR(20),
  password_hash VARCHAR(255) NOT NULL,
  person_type   VARCHAR(10) NOT NULL CHECK (person_type IN ('STAFF','STUDENT','GUARDIAN')),
  person_id     INTEGER NOT NULL,                 -- staff_id / student_id / guardian_id
  status        VARCHAR(10) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','LOCKED','DISABLED')),
  must_reset_pw BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMP,
  created_by    INTEGER REFERENCES users(user_id),
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_roles (
  user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
  role_id INTEGER REFERENCES roles(role_id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

-- Menu tree: top-level menus have parent_id NULL, sub-menus point to parent
CREATE TABLE menus (
  menu_id    SERIAL PRIMARY KEY,
  parent_id  INTEGER REFERENCES menus(menu_id),
  code       VARCHAR(40) UNIQUE NOT NULL,
  label      VARCHAR(60) NOT NULL,
  route      VARCHAR(120),
  icon       VARCHAR(40),
  sort_order INTEGER DEFAULT 0,
  is_active  BOOLEAN DEFAULT TRUE
);

-- What each role can see/do on each menu. The sidebar = menus with can_view = TRUE
CREATE TABLE role_menu_permissions (
  role_id     INTEGER REFERENCES roles(role_id) ON DELETE CASCADE,
  menu_id     INTEGER REFERENCES menus(menu_id) ON DELETE CASCADE,
  can_view    BOOLEAN DEFAULT FALSE,
  can_create  BOOLEAN DEFAULT FALSE,
  can_edit    BOOLEAN DEFAULT FALSE,
  can_delete  BOOLEAN DEFAULT FALSE,
  can_approve BOOLEAN DEFAULT FALSE,
  data_scope  VARCHAR(12) DEFAULT 'ALL' CHECK (data_scope IN ('ALL','OWN_CLASS','OWN_CHILD','SELF')),
  PRIMARY KEY (role_id, menu_id)
);

CREATE TABLE audit_logs (
  log_id     BIGSERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES users(user_id),
  action     VARCHAR(20) NOT NULL,              -- LOGIN, CREATE, UPDATE, DELETE, APPROVE, EXPORT
  entity     VARCHAR(40),
  entity_id  INTEGER,
  old_values TEXT,                              -- JSON
  new_values TEXT,                              -- JSON
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- 2. ACADEMIC SETUP
-- ---------------------------------------------------------------------
CREATE TABLE academic_years (
  year_id    SERIAL PRIMARY KEY,
  name       VARCHAR(20) UNIQUE NOT NULL,       -- e.g. 2026-27
  start_date DATE NOT NULL,
  end_date   DATE NOT NULL,
  is_current BOOLEAN DEFAULT FALSE
);

CREATE TABLE classes (
  class_id   SERIAL PRIMARY KEY,
  name       VARCHAR(30) NOT NULL,              -- Nursery, Grade 1 ... Grade 12
  level_no   INTEGER NOT NULL
);

CREATE TABLE sections (
  section_id       SERIAL PRIMARY KEY,
  class_id         INTEGER REFERENCES classes(class_id),
  name             VARCHAR(10) NOT NULL,        -- A, B, C
  class_teacher_id INTEGER,                     -- FK staff(staff_id), added below
  capacity         INTEGER DEFAULT 40,
  UNIQUE (class_id, name)
);

CREATE TABLE subjects (
  subject_id SERIAL PRIMARY KEY,
  code       VARCHAR(15) UNIQUE NOT NULL,
  name       VARCHAR(60) NOT NULL
);

-- ---------------------------------------------------------------------
-- 3. STAFF
-- ---------------------------------------------------------------------
CREATE TABLE departments  (department_id  SERIAL PRIMARY KEY, name VARCHAR(60) UNIQUE NOT NULL);
CREATE TABLE designations (designation_id SERIAL PRIMARY KEY, name VARCHAR(60) UNIQUE NOT NULL,
                           is_teaching BOOLEAN DEFAULT FALSE);

CREATE TABLE staff (
  staff_id        SERIAL PRIMARY KEY,
  employee_code   VARCHAR(20) UNIQUE NOT NULL,
  first_name      VARCHAR(60) NOT NULL,
  last_name       VARCHAR(60),
  gender          VARCHAR(10),
  dob             DATE,
  phone           VARCHAR(20) NOT NULL,
  email           VARCHAR(120),
  address         TEXT,
  photo_url       VARCHAR(255),
  department_id   INTEGER REFERENCES departments(department_id),
  designation_id  INTEGER REFERENCES designations(designation_id),
  employment_type VARCHAR(12) CHECK (employment_type IN ('PERMANENT','CONTRACT','PART_TIME')),
  join_date       DATE NOT NULL,
  qualification   VARCHAR(120),
  bank_name       VARCHAR(80),
  bank_account_enc VARCHAR(255),                -- store encrypted / tokenised, never plain text
  tax_id_enc      VARCHAR(255),                 -- PAN / SIN etc., encrypted
  status          VARCHAR(12) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','ON_LEAVE','RESIGNED','TERMINATED')),
  exit_date       DATE,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE sections ADD CONSTRAINT fk_section_teacher
  FOREIGN KEY (class_teacher_id) REFERENCES staff(staff_id);

CREATE TABLE staff_attendance (
  id        BIGSERIAL PRIMARY KEY,
  staff_id  INTEGER REFERENCES staff(staff_id),
  att_date  DATE NOT NULL,
  status    VARCHAR(10) CHECK (status IN ('PRESENT','ABSENT','HALF_DAY','LEAVE')),
  UNIQUE (staff_id, att_date)
);

CREATE TABLE leave_requests (
  leave_id    SERIAL PRIMARY KEY,
  staff_id    INTEGER REFERENCES staff(staff_id),
  leave_type  VARCHAR(20),                      -- CASUAL, SICK, EARNED, UNPAID
  from_date   DATE NOT NULL,
  to_date     DATE NOT NULL,
  reason      TEXT,
  status      VARCHAR(10) DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  approved_by INTEGER REFERENCES users(user_id)
);

-- ---------------------------------------------------------------------
-- 4. STUDENTS & GUARDIANS
-- ---------------------------------------------------------------------
CREATE TABLE students (
  student_id     SERIAL PRIMARY KEY,
  admission_no   VARCHAR(20) UNIQUE NOT NULL,
  first_name     VARCHAR(60) NOT NULL,
  last_name      VARCHAR(60),
  gender         VARCHAR(10),
  dob            DATE NOT NULL,
  blood_group    VARCHAR(5),
  photo_url      VARCHAR(255),
  address        TEXT,
  previous_school VARCHAR(120),
  admission_date DATE NOT NULL,
  status         VARCHAR(12) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','TRANSFERRED','LEFT','ALUMNI')),
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE guardians (
  guardian_id SERIAL PRIMARY KEY,
  full_name   VARCHAR(120) NOT NULL,
  relation    VARCHAR(20),                      -- FATHER, MOTHER, GUARDIAN
  phone       VARCHAR(20) NOT NULL,
  email       VARCHAR(120),
  occupation  VARCHAR(80),
  address     TEXT
);

CREATE TABLE student_guardians (
  student_id  INTEGER REFERENCES students(student_id) ON DELETE CASCADE,
  guardian_id INTEGER REFERENCES guardians(guardian_id) ON DELETE CASCADE,
  is_primary  BOOLEAN DEFAULT FALSE,
  PRIMARY KEY (student_id, guardian_id)
);

-- Links a student to a class/section for a given year (history is kept per year)
CREATE TABLE enrollments (
  enrollment_id SERIAL PRIMARY KEY,
  student_id    INTEGER REFERENCES students(student_id),
  year_id       INTEGER REFERENCES academic_years(year_id),
  section_id    INTEGER REFERENCES sections(section_id),
  roll_no       INTEGER,
  status        VARCHAR(12) DEFAULT 'STUDYING' CHECK (status IN ('STUDYING','PROMOTED','DETAINED','LEFT')),
  UNIQUE (student_id, year_id)
);

CREATE TABLE student_attendance (
  id            BIGSERIAL PRIMARY KEY,
  enrollment_id INTEGER REFERENCES enrollments(enrollment_id),
  att_date      DATE NOT NULL,
  status        VARCHAR(10) CHECK (status IN ('PRESENT','ABSENT','LATE','LEAVE')),
  marked_by     INTEGER REFERENCES users(user_id),
  UNIQUE (enrollment_id, att_date)
);

CREATE TABLE student_documents (
  doc_id      SERIAL PRIMARY KEY,
  student_id  INTEGER REFERENCES students(student_id) ON DELETE CASCADE,
  doc_type    VARCHAR(30),                      -- BIRTH_CERT, TC, ID_PROOF, PHOTO
  file_url    VARCHAR(255) NOT NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- 5. FEES
-- ---------------------------------------------------------------------
CREATE TABLE fee_heads (
  fee_head_id   SERIAL PRIMARY KEY,
  name          VARCHAR(60) UNIQUE NOT NULL,     -- Tuition, Admission, Transport, Exam, Lab
  frequency     VARCHAR(10) CHECK (frequency IN ('ONE_TIME','MONTHLY','TERM','ANNUAL')),
  is_refundable BOOLEAN DEFAULT FALSE,
  income_account_id INTEGER                      -- FK ledger_accounts, added below
);

-- Amount per fee head per class per year
CREATE TABLE fee_structures (
  structure_id SERIAL PRIMARY KEY,
  year_id      INTEGER REFERENCES academic_years(year_id),
  class_id     INTEGER REFERENCES classes(class_id),
  fee_head_id  INTEGER REFERENCES fee_heads(fee_head_id),
  amount       NUMERIC(12,2) NOT NULL,
  due_day      INTEGER,                          -- day of month / term due date rule
  UNIQUE (year_id, class_id, fee_head_id)
);

CREATE TABLE fee_concessions (
  concession_id SERIAL PRIMARY KEY,
  enrollment_id INTEGER REFERENCES enrollments(enrollment_id),
  fee_head_id   INTEGER REFERENCES fee_heads(fee_head_id),
  kind          VARCHAR(8) CHECK (kind IN ('PERCENT','FLAT')),
  value         NUMERIC(10,2) NOT NULL,
  reason        VARCHAR(120),                    -- Sibling, Staff ward, Merit
  approved_by   INTEGER REFERENCES users(user_id)
);

-- Generated per student per period from fee_structures minus concessions
CREATE TABLE fee_invoices (
  invoice_id    SERIAL PRIMARY KEY,
  invoice_no    VARCHAR(20) UNIQUE NOT NULL,
  enrollment_id INTEGER REFERENCES enrollments(enrollment_id),
  period_label  VARCHAR(20),                     -- Nov 2026 / Term 2
  due_date      DATE NOT NULL,
  gross_amount  NUMERIC(12,2) NOT NULL,
  concession    NUMERIC(12,2) DEFAULT 0,
  late_fee      NUMERIC(12,2) DEFAULT 0,
  net_amount    NUMERIC(12,2) NOT NULL,
  paid_amount   NUMERIC(12,2) DEFAULT 0,
  status        VARCHAR(10) DEFAULT 'DUE' CHECK (status IN ('DUE','PARTIAL','PAID','OVERDUE','CANCELLED'))
);

CREATE TABLE fee_invoice_items (
  item_id     SERIAL PRIMARY KEY,
  invoice_id  INTEGER REFERENCES fee_invoices(invoice_id) ON DELETE CASCADE,
  fee_head_id INTEGER REFERENCES fee_heads(fee_head_id),
  amount      NUMERIC(12,2) NOT NULL
);

CREATE TABLE fee_payments (
  payment_id   SERIAL PRIMARY KEY,
  receipt_no   VARCHAR(20) UNIQUE NOT NULL,
  student_id   INTEGER REFERENCES students(student_id),
  amount       NUMERIC(12,2) NOT NULL,
  mode         VARCHAR(10) CHECK (mode IN ('CASH','CARD','UPI','BANK','CHEQUE','ONLINE')),
  txn_ref      VARCHAR(60),
  paid_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  collected_by INTEGER REFERENCES users(user_id),
  status       VARCHAR(10) DEFAULT 'SUCCESS' CHECK (status IN ('SUCCESS','BOUNCED','REFUNDED','VOID'))
);

-- One payment can settle several invoices
CREATE TABLE payment_allocations (
  payment_id INTEGER REFERENCES fee_payments(payment_id) ON DELETE CASCADE,
  invoice_id INTEGER REFERENCES fee_invoices(invoice_id),
  amount     NUMERIC(12,2) NOT NULL,
  PRIMARY KEY (payment_id, invoice_id)
);

-- ---------------------------------------------------------------------
-- 6. PAYROLL (Salaries)
-- ---------------------------------------------------------------------
CREATE TABLE salary_components (
  component_id SERIAL PRIMARY KEY,
  name         VARCHAR(60) UNIQUE NOT NULL,      -- Basic, HRA, DA, Transport, PF, Tax, Advance recovery
  kind         VARCHAR(10) CHECK (kind IN ('EARNING','DEDUCTION')),
  calc_type    VARCHAR(12) CHECK (calc_type IN ('FIXED','PCT_OF_BASIC')),
  default_value NUMERIC(12,2)
);

CREATE TABLE staff_salary_structures (
  staff_id       INTEGER REFERENCES staff(staff_id),
  component_id   INTEGER REFERENCES salary_components(component_id),
  amount         NUMERIC(12,2) NOT NULL,
  effective_from DATE NOT NULL,
  PRIMARY KEY (staff_id, component_id, effective_from)
);

CREATE TABLE salary_advances (
  advance_id   SERIAL PRIMARY KEY,
  staff_id     INTEGER REFERENCES staff(staff_id),
  amount       NUMERIC(12,2) NOT NULL,
  installments INTEGER DEFAULT 1,
  balance      NUMERIC(12,2) NOT NULL,
  issued_on    DATE NOT NULL,
  approved_by  INTEGER REFERENCES users(user_id)
);

CREATE TABLE payroll_runs (
  run_id      SERIAL PRIMARY KEY,
  pay_month   INTEGER NOT NULL CHECK (pay_month BETWEEN 1 AND 12),
  pay_year    INTEGER NOT NULL,
  status      VARCHAR(10) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','APPROVED','PAID')),
  prepared_by INTEGER REFERENCES users(user_id),
  approved_by INTEGER REFERENCES users(user_id),
  approved_at TIMESTAMP,
  UNIQUE (pay_month, pay_year)
);

CREATE TABLE payslips (
  payslip_id   SERIAL PRIMARY KEY,
  run_id       INTEGER REFERENCES payroll_runs(run_id) ON DELETE CASCADE,
  staff_id     INTEGER REFERENCES staff(staff_id),
  working_days INTEGER,
  paid_days    NUMERIC(5,1),
  gross_pay    NUMERIC(12,2) NOT NULL,
  deductions   NUMERIC(12,2) NOT NULL,
  net_pay      NUMERIC(12,2) NOT NULL,
  paid_on      DATE,
  UNIQUE (run_id, staff_id)
);

CREATE TABLE payslip_lines (
  payslip_id   INTEGER REFERENCES payslips(payslip_id) ON DELETE CASCADE,
  component_id INTEGER REFERENCES salary_components(component_id),
  amount       NUMERIC(12,2) NOT NULL,
  PRIMARY KEY (payslip_id, component_id)
);

-- ---------------------------------------------------------------------
-- 7. ACCOUNTS (double-entry ledger → Account Statements)
-- ---------------------------------------------------------------------
CREATE TABLE ledger_accounts (
  account_id SERIAL PRIMARY KEY,
  code       VARCHAR(10) UNIQUE NOT NULL,        -- 1000 Cash, 1010 Bank, 4000 Fee Income, 5000 Salaries
  name       VARCHAR(80) NOT NULL,
  acc_type   VARCHAR(10) CHECK (acc_type IN ('ASSET','LIABILITY','EQUITY','INCOME','EXPENSE')),
  parent_id  INTEGER REFERENCES ledger_accounts(account_id),
  opening_balance NUMERIC(14,2) DEFAULT 0,
  is_active  BOOLEAN DEFAULT TRUE
);

ALTER TABLE fee_heads ADD CONSTRAINT fk_feehead_income
  FOREIGN KEY (income_account_id) REFERENCES ledger_accounts(account_id);

-- Every money movement becomes one voucher with balanced lines
CREATE TABLE vouchers (
  voucher_id   SERIAL PRIMARY KEY,
  voucher_no   VARCHAR(20) UNIQUE NOT NULL,
  voucher_date DATE NOT NULL,
  voucher_type VARCHAR(10) CHECK (voucher_type IN ('RECEIPT','PAYMENT','JOURNAL','CONTRA')),
  source_type  VARCHAR(15) CHECK (source_type IN ('FEE_PAYMENT','PAYROLL','EXPENSE','REFUND','MANUAL')),
  source_id    INTEGER,                           -- payment_id / run_id / expense_id
  narration    VARCHAR(255),
  created_by   INTEGER REFERENCES users(user_id),
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE voucher_lines (
  line_id    BIGSERIAL PRIMARY KEY,
  voucher_id INTEGER REFERENCES vouchers(voucher_id) ON DELETE CASCADE,
  account_id INTEGER REFERENCES ledger_accounts(account_id),
  debit      NUMERIC(14,2) DEFAULT 0,
  credit     NUMERIC(14,2) DEFAULT 0,
  CHECK (debit >= 0 AND credit >= 0 AND (debit = 0 OR credit = 0))
);

CREATE TABLE expenses (
  expense_id  SERIAL PRIMARY KEY,
  account_id  INTEGER REFERENCES ledger_accounts(account_id),   -- expense category
  paid_from_account_id INTEGER REFERENCES ledger_accounts(account_id), -- cash / bank
  vendor      VARCHAR(120),
  amount      NUMERIC(12,2) NOT NULL,
  expense_date DATE NOT NULL,
  bill_url    VARCHAR(255),
  status      VARCHAR(10) DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','PAID','REJECTED')),
  approved_by INTEGER REFERENCES users(user_id)
);

-- ---------------------------------------------------------------------
-- 8. USEFUL VIEWS
-- ---------------------------------------------------------------------
-- Sidebar for a logged-in user (union of all their roles)
CREATE VIEW v_user_menu AS
SELECT ur.user_id, m.menu_id, m.parent_id, m.code, m.label, m.route, m.icon, m.sort_order,
       BOOL_OR(p.can_create)  AS can_create,
       BOOL_OR(p.can_edit)    AS can_edit,
       BOOL_OR(p.can_delete)  AS can_delete,
       BOOL_OR(p.can_approve) AS can_approve
FROM user_roles ur
JOIN role_menu_permissions p ON p.role_id = ur.role_id AND p.can_view
JOIN menus m ON m.menu_id = p.menu_id AND m.is_active
GROUP BY ur.user_id, m.menu_id, m.parent_id, m.code, m.label, m.route, m.icon, m.sort_order;

-- Account statement with running balance (filter by account_id and date range)
CREATE VIEW v_account_statement AS
SELECT l.account_id, v.voucher_date, v.voucher_no, v.voucher_type, v.narration,
       l.debit, l.credit,
       SUM(l.debit - l.credit) OVER (PARTITION BY l.account_id
                                     ORDER BY v.voucher_date, v.voucher_id, l.line_id) AS running_balance
FROM voucher_lines l
JOIN vouchers v ON v.voucher_id = l.voucher_id;

-- Student fee dues
CREATE VIEW v_student_dues AS
SELECT s.student_id, s.admission_no, s.first_name || ' ' || COALESCE(s.last_name,'') AS student_name,
       c.name AS class_name, sec.name AS section,
       SUM(i.net_amount - i.paid_amount) AS balance_due,
       MIN(i.due_date) FILTER (WHERE i.status IN ('DUE','PARTIAL','OVERDUE')) AS oldest_due
FROM fee_invoices i
JOIN enrollments e ON e.enrollment_id = i.enrollment_id
JOIN students s ON s.student_id = e.student_id
JOIN sections sec ON sec.section_id = e.section_id
JOIN classes c ON c.class_id = sec.class_id
WHERE i.status <> 'CANCELLED'
GROUP BY s.student_id, s.admission_no, s.first_name, s.last_name, c.name, sec.name;

-- ---------------------------------------------------------------------
-- 9. SEED: ROLES, MENU TREE, DEFAULT PERMISSIONS
-- ---------------------------------------------------------------------
INSERT INTO roles (code, name, is_system) VALUES
 ('ADMIN','Administrator',TRUE), ('PRINCIPAL','Principal',TRUE), ('ACCOUNTANT','Accountant',TRUE),
 ('TEACHER','Teacher',TRUE), ('FRONT_OFFICE','Front Office',TRUE), ('PARENT','Parent',TRUE), ('STUDENT','Student',TRUE);

-- Top-level menus
INSERT INTO menus (code,label,route,icon,sort_order) VALUES
 ('DASHBOARD','Dashboard','/dashboard','home',1),
 ('STUDENTS','Students',NULL,'users',2),
 ('STAFF','Staff',NULL,'briefcase',3),
 ('ACADEMICS','Academics',NULL,'book',4),
 ('FEES','Fees',NULL,'receipt',5),
 ('PAYROLL','Payroll',NULL,'wallet',6),
 ('ACCOUNTS','Accounts',NULL,'ledger',7),
 ('OPERATIONS','Operations',NULL,'shield',8),
 ('SELF','My Space',NULL,'user',9);

-- Sub-menus
INSERT INTO menus (parent_id,code,label,route,sort_order)
SELECT m.menu_id, s.code, s.label, s.route, s.ord FROM menus m JOIN (VALUES
 ('STUDENTS','STU_LIST','All Students','/students',1),
 ('STUDENTS','STU_ADMIT','New Admission','/students/new',2),
 ('STUDENTS','STU_ATT','Attendance','/students/attendance',3),
 ('STUDENTS','STU_PROMOTE','Promote / Transfer','/students/promote',4),
 ('STUDENTS','STU_DOCS','Documents & ID Cards','/students/documents',5),
 ('STAFF','STF_LIST','All Staff','/staff',1),
 ('STAFF','STF_ADD','Add Staff','/staff/new',2),
 ('STAFF','STF_ATT','Staff Attendance','/staff/attendance',3),
 ('STAFF','STF_LEAVE','Leave Requests','/staff/leave',4),
 ('STAFF','STF_DEPT','Departments & Designations','/staff/setup',5),
 ('ACADEMICS','ACA_YEAR','Academic Years','/academics/years',1),
 ('ACADEMICS','ACA_CLASS','Classes & Sections','/academics/classes',2),
 ('ACADEMICS','ACA_SUBJ','Subjects','/academics/subjects',3),
 ('FEES','FEE_COLLECT','Collect Fee','/fees/collect',1),
 ('FEES','FEE_DUES','Dues & Reminders','/fees/dues',2),
 ('FEES','FEE_RECEIPTS','Receipts','/fees/receipts',3),
 ('FEES','FEE_STRUCT','Fee Structure','/fees/structure',4),
 ('FEES','FEE_CONC','Concessions','/fees/concessions',5),
 ('FEES','FEE_REFUND','Refunds','/fees/refunds',6),
 ('PAYROLL','PAY_RUN','Run Payroll','/payroll/run',1),
 ('PAYROLL','PAY_SLIPS','Payslips','/payroll/payslips',2),
 ('PAYROLL','PAY_STRUCT','Salary Structure','/payroll/structure',3),
 ('PAYROLL','PAY_ADV','Advances & Deductions','/payroll/advances',4),
 ('ACCOUNTS','ACC_STMT','Account Statement','/accounts/statement',1),
 ('ACCOUNTS','ACC_EXP','Income & Expenses','/accounts/expenses',2),
 ('ACCOUNTS','ACC_BOOKS','Cash & Bank Book','/accounts/books',3),
 ('ACCOUNTS','ACC_COA','Chart of Accounts','/accounts/chart',4),
 ('ACCOUNTS','ACC_RPT','Financial Reports','/accounts/reports',5),
 ('OPERATIONS','OPS_USERS','Users','/ops/users',1),
 ('OPERATIONS','OPS_ROLES','Roles & Permissions','/ops/roles',2),
 ('OPERATIONS','OPS_AUDIT','Audit Log','/ops/audit',3),
 ('OPERATIONS','OPS_SETTINGS','School Settings','/ops/settings',4),
 ('SELF','SELF_PROFILE','My Profile','/me',1),
 ('SELF','SELF_CHILD','My Child','/me/child',2),
 ('SELF','SELF_FEES','Fee Dues & Pay','/me/fees',3),
 ('SELF','SELF_PAYSLIP','My Payslips','/me/payslips',4)
) AS s(parent,code,label,route,ord) ON m.code = s.parent;

-- Helper: grant(role, menu codes, view, create, edit, delete, approve, scope)
-- ADMIN: everything
INSERT INTO role_menu_permissions
SELECT r.role_id, m.menu_id, TRUE,TRUE,TRUE,TRUE,TRUE,'ALL'
FROM roles r CROSS JOIN menus m WHERE r.code='ADMIN' AND m.code NOT IN ('SELF_CHILD','SELF_FEES');

-- PRINCIPAL: view all academic/people modules, approve payroll/leave/concessions, view finance reports
INSERT INTO role_menu_permissions
SELECT r.role_id, m.menu_id, TRUE, FALSE, FALSE, FALSE,
       m.code IN ('PAYROLL','PAY_RUN','STAFF','STF_LEAVE','FEES','FEE_CONC','FEE_REFUND','ACCOUNTS','ACC_EXP'), 'ALL'
FROM roles r CROSS JOIN menus m
WHERE r.code='PRINCIPAL' AND m.code IN
 ('DASHBOARD','STUDENTS','STU_LIST','STU_ATT','STAFF','STF_LIST','STF_ATT','STF_LEAVE','ACADEMICS','ACA_YEAR','ACA_CLASS','ACA_SUBJ',
  'FEES','FEE_DUES','FEE_CONC','FEE_REFUND','PAYROLL','PAY_RUN','PAY_SLIPS','ACCOUNTS','ACC_STMT','ACC_EXP','ACC_RPT',
  'OPERATIONS','OPS_AUDIT','SELF','SELF_PROFILE','SELF_PAYSLIP');

-- ACCOUNTANT: full Fees, Payroll, Accounts; view students/staff
INSERT INTO role_menu_permissions
SELECT r.role_id, m.menu_id, TRUE,
       m.code NOT IN ('STUDENTS','STU_LIST','STAFF','STF_LIST'),
       m.code NOT IN ('STUDENTS','STU_LIST','STAFF','STF_LIST'),
       FALSE, FALSE, 'ALL'
FROM roles r CROSS JOIN menus m
WHERE r.code='ACCOUNTANT' AND (m.code IN ('DASHBOARD','STUDENTS','STU_LIST','STAFF','STF_LIST','SELF','SELF_PROFILE','SELF_PAYSLIP')
   OR m.code IN ('FEES','PAYROLL','ACCOUNTS')
   OR m.parent_id IN (SELECT menu_id FROM menus WHERE code IN ('FEES','PAYROLL','ACCOUNTS')));

-- TEACHER: own class students + attendance, own leave & payslips
INSERT INTO role_menu_permissions
SELECT r.role_id, m.menu_id, TRUE, m.code IN ('STU_ATT','STF_LEAVE'), m.code='STU_ATT', FALSE, FALSE,
       CASE WHEN m.code IN ('STUDENTS','STU_LIST','STU_ATT') THEN 'OWN_CLASS' ELSE 'SELF' END
FROM roles r CROSS JOIN menus m
WHERE r.code='TEACHER' AND m.code IN ('DASHBOARD','STUDENTS','STU_LIST','STU_ATT','STAFF','STF_LEAVE','SELF','SELF_PROFILE','SELF_PAYSLIP');

-- FRONT OFFICE: admissions, documents, collect fee & receipts
INSERT INTO role_menu_permissions
SELECT r.role_id, m.menu_id, TRUE,
       m.code IN ('STU_ADMIT','STU_DOCS','FEE_COLLECT'), m.code IN ('STU_LIST','STU_DOCS'), FALSE, FALSE, 'ALL'
FROM roles r CROSS JOIN menus m
WHERE r.code='FRONT_OFFICE' AND m.code IN ('DASHBOARD','STUDENTS','STU_LIST','STU_ADMIT','STU_DOCS','FEES','FEE_COLLECT','FEE_RECEIPTS','FEE_DUES','SELF','SELF_PROFILE','SELF_PAYSLIP');

-- PARENT: own child only
INSERT INTO role_menu_permissions
SELECT r.role_id, m.menu_id, TRUE, m.code='SELF_FEES', FALSE, FALSE, FALSE, 'OWN_CHILD'
FROM roles r CROSS JOIN menus m
WHERE r.code='PARENT' AND m.code IN ('DASHBOARD','SELF','SELF_PROFILE','SELF_CHILD','SELF_FEES');

-- STUDENT: self only
INSERT INTO role_menu_permissions
SELECT r.role_id, m.menu_id, TRUE, FALSE, FALSE, FALSE, FALSE, 'SELF'
FROM roles r CROSS JOIN menus m
WHERE r.code='STUDENT' AND m.code IN ('DASHBOARD','SELF','SELF_PROFILE','SELF_FEES');

-- Default chart of accounts
INSERT INTO ledger_accounts (code,name,acc_type) VALUES
 ('1000','Cash in Hand','ASSET'), ('1010','Bank Account','ASSET'), ('1100','Fees Receivable','ASSET'),
 ('2000','Salaries Payable','LIABILITY'), ('2100','Statutory Deductions Payable','LIABILITY'),
 ('2200','Fee Advance / Deposits','LIABILITY'), ('3000','Capital Fund','EQUITY'),
 ('4000','Tuition Fee Income','INCOME'), ('4010','Transport Fee Income','INCOME'), ('4020','Other Fee Income','INCOME'),
 ('5000','Salaries & Wages','EXPENSE'), ('5100','Utilities','EXPENSE'), ('5200','Maintenance','EXPENSE'),
 ('5300','Stationery & Supplies','EXPENSE');

-- ---------------------------------------------------------------------
-- 10. POSTING RULES (implement in the service layer / triggers)
-- Fee payment received   : Dr Cash/Bank            Cr Fee Income (per fee head)
-- Payroll approved       : Dr Salaries & Wages     Cr Salaries Payable, Cr Statutory Deductions
-- Payroll paid           : Dr Salaries Payable     Cr Bank
-- Expense paid           : Dr Expense category     Cr Cash/Bank
-- Fee refund             : Dr Fee Income           Cr Cash/Bank
-- ---------------------------------------------------------------------

-- Indexes for common lookups
CREATE INDEX idx_enroll_section ON enrollments(section_id, year_id);
CREATE INDEX idx_invoice_status ON fee_invoices(status, due_date);
CREATE INDEX idx_payment_student ON fee_payments(student_id, paid_at);
CREATE INDEX idx_vline_account ON voucher_lines(account_id);
CREATE INDEX idx_voucher_date ON vouchers(voucher_date);
CREATE INDEX idx_audit_user ON audit_logs(user_id, created_at);
