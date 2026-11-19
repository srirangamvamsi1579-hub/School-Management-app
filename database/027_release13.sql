-- =====================================================================
-- 027  Release 13: Campus Services (library, hostel, homework, online classes, inventory & store,
--      events & calendar) and the Service Provider menus for our own sales and marketing team
--      (price list and tiers, proposals, demo schools, competitors, market review and roadmap).
--      Run after 001–026.
--
--      Menus: new module Campus Services (CAMPUS) with CMP_EVENTS, CMP_HOMEWORK (every plan), CMP_CLASSES,
--      CMP_LIBRARY (Growth+), CMP_INVENTORY (Professional+), CMP_HOSTEL (Enterprise; add-on below).
--      New module Service Provider (SERVICE_PROVIDER): SP_RATES, SP_PROPOSAL, SP_DEMO (group Sales),
--      SP_COMPARE, SP_MARKET (group Market) — for the platform team and the new SALES role only, never sold to schools.
--      New function FN_ROUTE_PLANNING (Transport Plus: route options, map, pickup suggestions), Professional+.
-- =====================================================================

-- ---------- Menus ----------
INSERT INTO menus (code, label, icon, sort_order)
SELECT v.code, v.label, v.icon, v.ord FROM (VALUES ('CAMPUS', 'Campus Services', 'book', 68), ('SERVICE_PROVIDER', 'Service Provider', 'brief', 92)) AS v(code, label, icon, ord)
WHERE NOT EXISTS (SELECT 1 FROM menus WHERE code = v.code);
INSERT INTO menus (parent_id, code, label, route, sort_order, menu_group)
SELECT p.menu_id, v.code, v.label, v.route, v.ord, v.grp FROM (VALUES
  ('CAMPUS', 'CMP_EVENTS', 'Events & Calendar', '/campus/events', 1, NULL),
  ('CAMPUS', 'CMP_HOMEWORK', 'Homework', '/campus/homework', 2, NULL),
  ('CAMPUS', 'CMP_CLASSES', 'Online Classes', '/campus/online-classes', 3, NULL),
  ('CAMPUS', 'CMP_LIBRARY', 'Library', '/campus/library', 4, NULL),
  ('CAMPUS', 'CMP_INVENTORY', 'Inventory & Store', '/campus/inventory', 5, NULL),
  ('CAMPUS', 'CMP_HOSTEL', 'Hostel', '/campus/hostel', 6, NULL),
  ('SERVICE_PROVIDER', 'SP_RATES', 'Price List & Tiers', '/provider/prices', 1, 'Sales'),
  ('SERVICE_PROVIDER', 'SP_PROPOSAL', 'Proposal Builder', '/provider/proposals', 2, 'Sales'),
  ('SERVICE_PROVIDER', 'SP_DEMO', 'Demo Builder', '/provider/demos', 3, 'Sales'),
  ('SERVICE_PROVIDER', 'SP_COMPARE', 'Competition Comparison', '/provider/competition', 4, 'Market'),
  ('SERVICE_PROVIDER', 'SP_MARKET', 'Market Review & Roadmap', '/provider/market', 5, 'Market')
) AS v(parent, code, label, route, ord, grp) JOIN menus p ON p.code = v.parent
WHERE NOT EXISTS (SELECT 1 FROM menus WHERE code = v.code);

-- ---------- Plan features: Campus by tier; Service Provider is never a school feature ----------
INSERT INTO features (code, name, kind, menu_id, is_addon_eligible, sort_order)
SELECT 'CAMPUS', 'Campus Services', 'MODULE', menu_id, TRUE, 68 FROM menus WHERE code = 'CAMPUS' AND NOT EXISTS (SELECT 1 FROM features WHERE code = 'CAMPUS');
INSERT INTO features (parent_id, code, name, kind, menu_id, is_addon_eligible, addon_price, sort_order)
SELECT pf.feature_id, m.code, m.label, 'SUBMENU', m.menu_id, TRUE, v.price, m.sort_order
FROM (VALUES ('CMP_EVENTS', NULL::numeric), ('CMP_HOMEWORK', NULL), ('CMP_CLASSES', 1.00), ('CMP_LIBRARY', 0.50), ('CMP_INVENTORY', 500.00), ('CMP_HOSTEL', 15.00)) AS v(code, price)
JOIN menus m ON m.code = v.code JOIN features pf ON pf.code = 'CAMPUS'
WHERE NOT EXISTS (SELECT 1 FROM features WHERE code = m.code);
INSERT INTO features (parent_id, code, name, kind, is_addon_eligible, addon_price, sort_order)
SELECT feature_id, 'FN_ROUTE_PLANNING', 'Route planning, route map and pickup suggestions (Transport Plus)', 'FUNCTION', TRUE, 350.00, 20
FROM features WHERE code = 'TRANSPORT' AND NOT EXISTS (SELECT 1 FROM features WHERE code = 'FN_ROUTE_PLANNING');
INSERT INTO plan_features (plan_id, feature_id)
SELECT p.plan_id, f.feature_id FROM plans p JOIN (VALUES ('CAMPUS', 1), ('CMP_EVENTS', 1), ('CMP_HOMEWORK', 1), ('CMP_CLASSES', 2), ('CMP_LIBRARY', 2), ('CMP_INVENTORY', 3), ('CMP_HOSTEL', 4), ('FN_ROUTE_PLANNING', 3)) AS v(code, rank)
  ON p.tier_rank >= v.rank JOIN features f ON f.code = v.code
ON CONFLICT DO NOTHING;

-- ---------- Roles: our company's sales and marketing team ----------
-- No department: these are our company's people, never part of a school's department lists
INSERT INTO roles (code, name, is_system) SELECT 'SALES', 'Sales & marketing', TRUE WHERE NOT EXISTS (SELECT 1 FROM roles WHERE code = 'SALES' AND tenant_id IS NULL);
INSERT INTO roles (code, name, is_system) SELECT 'PLATFORM', 'Platform team', TRUE WHERE NOT EXISTS (SELECT 1 FROM roles WHERE code = 'PLATFORM' AND tenant_id IS NULL);

-- Who opens which new screen (V = view, C = view + create/edit). Teachers see homework and classes for their own classes.
INSERT INTO role_menu_permissions (role_id, menu_id, can_view, can_create, can_edit, data_scope)
SELECT r.role_id, m.menu_id, TRUE, v.edit, v.edit, v.scope FROM (VALUES
  ('ADMIN', 'CMP_EVENTS', TRUE, 'ALL'), ('ADMIN', 'CMP_HOMEWORK', TRUE, 'ALL'), ('ADMIN', 'CMP_CLASSES', TRUE, 'ALL'), ('ADMIN', 'CMP_LIBRARY', TRUE, 'ALL'), ('ADMIN', 'CMP_INVENTORY', TRUE, 'ALL'), ('ADMIN', 'CMP_HOSTEL', TRUE, 'ALL'),
  ('PRINCIPAL', 'CMP_EVENTS', TRUE, 'ALL'), ('PRINCIPAL', 'CMP_HOMEWORK', TRUE, 'ALL'), ('PRINCIPAL', 'CMP_CLASSES', TRUE, 'ALL'), ('PRINCIPAL', 'CMP_LIBRARY', TRUE, 'ALL'), ('PRINCIPAL', 'CMP_INVENTORY', TRUE, 'ALL'), ('PRINCIPAL', 'CMP_HOSTEL', TRUE, 'ALL'),
  ('TEACHER', 'CMP_EVENTS', FALSE, 'ALL'), ('TEACHER', 'CMP_HOMEWORK', TRUE, 'OWN_CLASS'), ('TEACHER', 'CMP_CLASSES', TRUE, 'OWN_CLASS'), ('TEACHER', 'CMP_LIBRARY', TRUE, 'ALL'),
  ('FRONT_OFFICE', 'CMP_EVENTS', TRUE, 'ALL'), ('FRONT_OFFICE', 'CMP_LIBRARY', TRUE, 'ALL'), ('FRONT_OFFICE', 'CMP_INVENTORY', TRUE, 'ALL'), ('FRONT_OFFICE', 'CMP_HOSTEL', TRUE, 'ALL'),
  ('ACCOUNTANT', 'CMP_EVENTS', FALSE, 'ALL'), ('ACCOUNTANT', 'CMP_INVENTORY', TRUE, 'ALL'), ('ACCOUNTANT', 'CMP_HOSTEL', TRUE, 'ALL'),
  ('PARENT', 'CMP_EVENTS', FALSE, 'OWN_CHILD'), ('PARENT', 'CMP_HOMEWORK', FALSE, 'OWN_CHILD'), ('PARENT', 'CMP_CLASSES', FALSE, 'OWN_CHILD'),
  ('TRANSPORT', 'CMP_EVENTS', FALSE, 'ALL'),
  ('PLATFORM', 'SP_RATES', TRUE, 'ALL'), ('PLATFORM', 'SP_PROPOSAL', TRUE, 'ALL'), ('PLATFORM', 'SP_DEMO', TRUE, 'ALL'), ('PLATFORM', 'SP_COMPARE', TRUE, 'ALL'), ('PLATFORM', 'SP_MARKET', TRUE, 'ALL'),
  ('SALES', 'SP_RATES', FALSE, 'ALL'), ('SALES', 'SP_PROPOSAL', TRUE, 'ALL'), ('SALES', 'SP_DEMO', TRUE, 'ALL'), ('SALES', 'SP_COMPARE', FALSE, 'ALL'), ('SALES', 'SP_MARKET', TRUE, 'ALL')
) AS v(role, menu, edit, scope) JOIN roles r ON r.code = v.role AND r.tenant_id IS NULL JOIN menus m ON m.code = v.menu
ON CONFLICT (role_id, menu_id) DO NOTHING;
-- Schools that already set access by department get the new Campus screens for the same people
INSERT INTO department_menu_permissions (tenant_id, department, menu_id)
SELECT DISTINCT d.tenant_id, d.department, n.menu_id FROM department_menu_permissions d JOIN menus o ON o.menu_id = d.menu_id
JOIN (VALUES ('STU_ATT', 'CMP_HOMEWORK'), ('STU_ATT', 'CMP_CLASSES'), ('STU_ATT', 'CMP_EVENTS'), ('STU_GATE', 'CMP_LIBRARY'), ('STU_GATE', 'CMP_EVENTS'),
  ('FEE_COLLECT', 'CMP_INVENTORY'), ('FEE_COLLECT', 'CMP_HOSTEL'), ('SELF_CHILD', 'CMP_HOMEWORK'), ('SELF_CHILD', 'CMP_CLASSES'), ('SELF_CHILD', 'CMP_EVENTS')) AS v(had, gets) ON v.had = o.code
JOIN menus n ON n.code = v.gets ON CONFLICT DO NOTHING;
-- Company menus are never given to a school role, a department or a designation
CREATE OR REPLACE FUNCTION no_provider_menus_for_schools() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM menus m JOIN menus p ON p.menu_id = m.parent_id WHERE m.menu_id = NEW.menu_id AND p.code = 'SERVICE_PROVIDER') THEN
    IF TG_TABLE_NAME <> 'role_menu_permissions' THEN
      RAISE EXCEPTION 'Service Provider menus are for the platform and sales teams only';
    ELSIF NOT EXISTS (SELECT 1 FROM roles WHERE role_id = (to_jsonb(NEW) ->> 'role_id')::int AND code IN ('PLATFORM', 'SALES') AND tenant_id IS NULL) THEN
      RAISE EXCEPTION 'Service Provider menus are for the platform and sales teams only';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_rmp_provider BEFORE INSERT OR UPDATE ON role_menu_permissions FOR EACH ROW EXECUTE FUNCTION no_provider_menus_for_schools();
CREATE TRIGGER trg_dmp_provider BEFORE INSERT OR UPDATE ON department_menu_permissions FOR EACH ROW EXECUTE FUNCTION no_provider_menus_for_schools();
CREATE TRIGGER trg_dma_provider BEFORE INSERT OR UPDATE ON designation_menu_access FOR EACH ROW EXECUTE FUNCTION no_provider_menus_for_schools();

-- =====================================================================
-- Library
-- =====================================================================
CREATE TABLE library_rules (
  tenant_id     INTEGER PRIMARY KEY REFERENCES tenants(tenant_id),
  loan_days     INTEGER NOT NULL DEFAULT 14 CHECK (loan_days BETWEEN 1 AND 90),
  fine_per_day  NUMERIC(8,2) NOT NULL DEFAULT 2 CHECK (fine_per_day >= 0),
  max_books     INTEGER NOT NULL DEFAULT 2 CHECK (max_books BETWEEN 1 AND 10)
);
CREATE TABLE library_books (
  book_id    SERIAL PRIMARY KEY,
  tenant_id  INTEGER NOT NULL REFERENCES tenants(tenant_id),
  title      VARCHAR(200) NOT NULL CHECK (btrim(title) <> ''),
  author     VARCHAR(120),
  subject    VARCHAR(40) NOT NULL DEFAULT 'General',
  copies     INTEGER NOT NULL CHECK (copies >= 1),
  shelf      VARCHAR(20),
  isbn       VARCHAR(20)
);
CREATE INDEX ON library_books (tenant_id);
CREATE TABLE library_loans (
  loan_id     SERIAL PRIMARY KEY,
  tenant_id   INTEGER NOT NULL REFERENCES tenants(tenant_id),
  book_id     INTEGER NOT NULL REFERENCES library_books(book_id),
  student_id  INTEGER NOT NULL REFERENCES students(student_id),
  issued_on   DATE NOT NULL DEFAULT CURRENT_DATE,
  due_on      DATE NOT NULL,
  returned_on DATE,
  fine        NUMERIC(8,2) NOT NULL DEFAULT 0,
  issued_by   INTEGER REFERENCES users(user_id),
  CHECK (due_on >= issued_on), CHECK (returned_on IS NULL OR returned_on >= issued_on)
);
CREATE INDEX ON library_loans (tenant_id, student_id) WHERE returned_on IS NULL;
-- Issue a book: a copy must be on the shelf; the student is under the limit and has nothing overdue.
-- Locks the book row so two desks can't lend the last copy at once.
CREATE OR REPLACE FUNCTION library_issue(p_tenant INT, p_book INT, p_student INT, p_on DATE DEFAULT CURRENT_DATE, p_by INT DEFAULT NULL) RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE r library_rules%ROWTYPE; v_copies INT; v_out INT; v_id INT;
BEGIN
  SELECT * INTO r FROM library_rules WHERE tenant_id = p_tenant;
  IF NOT FOUND THEN r.loan_days := 14; r.fine_per_day := 2; r.max_books := 2; END IF;
  SELECT copies INTO v_copies FROM library_books WHERE book_id = p_book AND tenant_id = p_tenant FOR UPDATE;
  IF v_copies IS NULL THEN RAISE EXCEPTION 'Book not found'; END IF;
  SELECT count(*) INTO v_out FROM library_loans WHERE book_id = p_book AND returned_on IS NULL;
  IF v_out >= v_copies THEN RAISE EXCEPTION 'No copy of this book is on the shelf'; END IF;
  PERFORM 1 FROM students WHERE student_id = p_student AND tenant_id = p_tenant FOR UPDATE;
  IF (SELECT count(*) FROM library_loans WHERE student_id = p_student AND returned_on IS NULL) >= r.max_books THEN RAISE EXCEPTION 'Student already has % books', r.max_books; END IF;
  IF EXISTS (SELECT 1 FROM library_loans WHERE student_id = p_student AND returned_on IS NULL AND due_on < p_on) THEN RAISE EXCEPTION 'Student has an overdue book — return it first'; END IF;
  INSERT INTO library_loans (tenant_id, book_id, student_id, issued_on, due_on, issued_by) VALUES (p_tenant, p_book, p_student, p_on, p_on + r.loan_days, p_by) RETURNING loan_id INTO v_id;
  RETURN v_id;
END $$;
CREATE OR REPLACE FUNCTION library_return(p_loan INT, p_on DATE DEFAULT CURRENT_DATE) RETURNS NUMERIC LANGUAGE plpgsql AS $$
DECLARE l library_loans%ROWTYPE; v_rate NUMERIC;
BEGIN
  SELECT * INTO l FROM library_loans WHERE loan_id = p_loan FOR UPDATE;
  IF NOT FOUND OR l.returned_on IS NOT NULL THEN RAISE EXCEPTION 'This book is not on loan'; END IF;
  SELECT coalesce((SELECT fine_per_day FROM library_rules WHERE tenant_id = l.tenant_id), 2) INTO v_rate;
  UPDATE library_loans SET returned_on = p_on, fine = greatest(0, p_on - l.due_on) * v_rate WHERE loan_id = p_loan;
  RETURN greatest(0, p_on - l.due_on) * v_rate;
END $$;
CREATE VIEW v_library_overdue AS
  SELECT l.tenant_id, l.loan_id, l.student_id, b.title, l.due_on, CURRENT_DATE - l.due_on AS days_late,
         (CURRENT_DATE - l.due_on) * coalesce(r.fine_per_day, 2) AS fine_so_far
  FROM library_loans l JOIN library_books b USING (book_id) LEFT JOIN library_rules r ON r.tenant_id = l.tenant_id
  WHERE l.returned_on IS NULL AND l.due_on < CURRENT_DATE;

-- =====================================================================
-- Hostel
-- =====================================================================
CREATE TABLE hostel_blocks (
  block_id   SERIAL PRIMARY KEY,
  tenant_id  INTEGER NOT NULL REFERENCES tenants(tenant_id),
  name       VARCHAR(80) NOT NULL,
  gender     VARCHAR(10) NOT NULL DEFAULT 'Any' CHECK (gender IN ('Male', 'Female', 'Any')),
  warden     VARCHAR(80),
  room_fee   NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (room_fee >= 0),
  mess_fee   NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (mess_fee >= 0),
  UNIQUE (tenant_id, name)
);
CREATE TABLE hostel_rooms (
  room_id    SERIAL PRIMARY KEY,
  tenant_id  INTEGER NOT NULL REFERENCES tenants(tenant_id),
  block_id   INTEGER NOT NULL REFERENCES hostel_blocks(block_id),
  room_no    VARCHAR(10) NOT NULL,
  beds       INTEGER NOT NULL CHECK (beds BETWEEN 1 AND 20),
  UNIQUE (block_id, room_no)
);
CREATE TABLE hostel_residents (
  resident_id SERIAL PRIMARY KEY,
  tenant_id   INTEGER NOT NULL REFERENCES tenants(tenant_id),
  student_id  INTEGER NOT NULL REFERENCES students(student_id),
  room_id     INTEGER NOT NULL REFERENCES hostel_rooms(room_id),
  from_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  mess        BOOLEAN NOT NULL DEFAULT TRUE,
  left_on     DATE,
  CHECK (left_on IS NULL OR left_on >= from_date)
);
-- One bed per student at a time
CREATE UNIQUE INDEX hostel_one_bed ON hostel_residents (student_id) WHERE left_on IS NULL;
-- Right block for the student, and no more residents than beds (room row locked against a race)
CREATE OR REPLACE FUNCTION hostel_check_bed() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_beds INT; v_gender VARCHAR; v_student_gender VARCHAR;
BEGIN
  IF NEW.left_on IS NOT NULL THEN RETURN NEW; END IF;
  SELECT r.beds, b.gender INTO v_beds, v_gender FROM hostel_rooms r JOIN hostel_blocks b USING (block_id) WHERE r.room_id = NEW.room_id FOR UPDATE OF r;
  SELECT gender INTO v_student_gender FROM students WHERE student_id = NEW.student_id;
  IF v_gender <> 'Any' AND v_student_gender IS DISTINCT FROM v_gender THEN RAISE EXCEPTION 'This block is for % students', lower(v_gender); END IF;
  IF (SELECT count(*) FROM hostel_residents WHERE room_id = NEW.room_id AND left_on IS NULL AND resident_id IS DISTINCT FROM NEW.resident_id) >= v_beds THEN RAISE EXCEPTION 'Room is full'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_hostel_bed BEFORE INSERT OR UPDATE OF room_id, left_on ON hostel_residents FOR EACH ROW EXECUTE FUNCTION hostel_check_bed();
CREATE VIEW v_hostel_occupancy AS
  SELECT b.tenant_id, b.block_id, b.name, sum(r.beds) AS beds, sum(r.used) AS used, sum(r.beds) - sum(r.used) AS free
  FROM hostel_blocks b
  JOIN (SELECT rm.room_id, rm.block_id, rm.beds, (SELECT count(*) FROM hostel_residents h WHERE h.room_id = rm.room_id AND h.left_on IS NULL) AS used FROM hostel_rooms rm) r USING (block_id)
  GROUP BY b.tenant_id, b.block_id, b.name;

-- =====================================================================
-- Homework and online classes
-- =====================================================================
CREATE TABLE homework (
  homework_id SERIAL PRIMARY KEY,
  tenant_id   INTEGER NOT NULL REFERENCES tenants(tenant_id),
  section_id  INTEGER NOT NULL REFERENCES sections(section_id),
  subject     VARCHAR(40) NOT NULL,
  title       VARCHAR(200) NOT NULL CHECK (btrim(title) <> ''),
  details     TEXT,
  set_on      DATE NOT NULL DEFAULT CURRENT_DATE,
  due_on      DATE NOT NULL,
  set_by      INTEGER REFERENCES users(user_id),
  CHECK (due_on >= set_on)
);
CREATE INDEX ON homework (tenant_id, section_id, due_on);
CREATE TABLE homework_status (
  homework_id INTEGER NOT NULL REFERENCES homework(homework_id) ON DELETE CASCADE,
  student_id  INTEGER NOT NULL REFERENCES students(student_id),
  tenant_id   INTEGER NOT NULL REFERENCES tenants(tenant_id),
  status      VARCHAR(8) NOT NULL CHECK (status IN ('DONE', 'LATE', 'MISSING')),
  marked_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (homework_id, student_id)
);
CREATE TABLE online_classes (
  online_class_id SERIAL PRIMARY KEY,
  tenant_id   INTEGER NOT NULL REFERENCES tenants(tenant_id),
  section_id  INTEGER NOT NULL REFERENCES sections(section_id),
  subject     VARCHAR(40) NOT NULL,
  class_date  DATE NOT NULL,
  start_time  TIME NOT NULL,
  minutes     INTEGER NOT NULL CHECK (minutes BETWEEN 10 AND 180),
  meeting_url VARCHAR(400) NOT NULL CHECK (meeting_url ~ '^https://[^[:space:]]+\.[^[:space:]]+'),
  teacher_id  INTEGER REFERENCES users(user_id),
  UNIQUE (section_id, class_date, start_time)
);
CREATE TABLE online_class_attendance (
  online_class_id INTEGER NOT NULL REFERENCES online_classes(online_class_id) ON DELETE CASCADE,
  student_id      INTEGER NOT NULL REFERENCES students(student_id),
  tenant_id       INTEGER NOT NULL REFERENCES tenants(tenant_id),
  PRIMARY KEY (online_class_id, student_id)
);

-- =====================================================================
-- Inventory & store
-- =====================================================================
CREATE TABLE inventory_items (
  item_id       SERIAL PRIMARY KEY,
  tenant_id     INTEGER NOT NULL REFERENCES tenants(tenant_id),
  name          VARCHAR(120) NOT NULL,
  category      VARCHAR(40) NOT NULL DEFAULT 'General',
  unit          VARCHAR(20) NOT NULL DEFAULT 'piece',
  price         NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  reorder_level INTEGER NOT NULL DEFAULT 0 CHECK (reorder_level >= 0),
  UNIQUE (tenant_id, name)
);
CREATE TABLE inventory_moves (
  move_id    SERIAL PRIMARY KEY,
  tenant_id  INTEGER NOT NULL REFERENCES tenants(tenant_id),
  item_id    INTEGER NOT NULL REFERENCES inventory_items(item_id),
  qty        INTEGER NOT NULL CHECK (qty <> 0),
  kind       VARCHAR(6) NOT NULL CHECK (kind IN ('IN', 'SALE', 'ISSUE', 'ADJUST')),
  student_id INTEGER REFERENCES students(student_id),
  amount     NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  moved_on   DATE NOT NULL DEFAULT CURRENT_DATE,
  note       VARCHAR(200),
  moved_by   INTEGER REFERENCES users(user_id),
  CHECK ((kind = 'IN' AND qty > 0) OR (kind IN ('SALE', 'ISSUE') AND qty < 0) OR kind = 'ADJUST'),
  CHECK (kind <> 'SALE' OR student_id IS NOT NULL)
);
CREATE INDEX ON inventory_moves (tenant_id, item_id);
-- Stock never goes below zero (item row locked so two counters can't sell the last piece twice)
CREATE OR REPLACE FUNCTION inventory_check_stock() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_stock INT;
BEGIN
  PERFORM 1 FROM inventory_items WHERE item_id = NEW.item_id FOR UPDATE;
  SELECT coalesce(sum(qty), 0) INTO v_stock FROM inventory_moves WHERE item_id = NEW.item_id;
  IF v_stock + NEW.qty < 0 THEN RAISE EXCEPTION 'Only % in stock', v_stock; END IF;
  IF NEW.kind = 'SALE' AND NEW.amount = 0 THEN NEW.amount := -NEW.qty * (SELECT price FROM inventory_items WHERE item_id = NEW.item_id); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_inventory_stock BEFORE INSERT ON inventory_moves FOR EACH ROW EXECUTE FUNCTION inventory_check_stock();
CREATE VIEW v_inventory_stock AS
  SELECT i.tenant_id, i.item_id, i.name, i.category, i.price, i.reorder_level, coalesce(sum(m.qty), 0) AS in_stock,
         coalesce(sum(m.qty), 0) <= i.reorder_level AS reorder
  FROM inventory_items i LEFT JOIN inventory_moves m USING (item_id) GROUP BY i.tenant_id, i.item_id;

-- =====================================================================
-- Events & calendar
-- =====================================================================
CREATE TABLE school_events (
  event_id   SERIAL PRIMARY KEY,
  tenant_id  INTEGER NOT NULL REFERENCES tenants(tenant_id),
  title      VARCHAR(160) NOT NULL CHECK (btrim(title) <> ''),
  start_date DATE NOT NULL,
  end_date   DATE NOT NULL,
  kind       VARCHAR(20) NOT NULL DEFAULT 'Event' CHECK (kind IN ('Event', 'Exam', 'Holiday', 'Parent meeting', 'Circular', 'Sports')),
  audience   VARCHAR(8) NOT NULL DEFAULT 'ALL' CHECK (audience IN ('ALL', 'PARENTS', 'STAFF')),
  details    TEXT,
  notified_at TIMESTAMP,
  created_by INTEGER REFERENCES users(user_id),
  CHECK (end_date >= start_date)
);
CREATE INDEX ON school_events (tenant_id, start_date);

-- Row-level security on the new school tables
DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['library_rules', 'library_books', 'library_loans', 'hostel_blocks', 'hostel_rooms', 'hostel_residents', 'homework', 'homework_status',
    'online_classes', 'online_class_attendance', 'inventory_items', 'inventory_moves', 'school_events'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY tenant_isolation ON %I USING (tenant_id = current_setting('app.tenant_id', true)::int) WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::int)$p$, t);
  END LOOP;
END $$;

-- =====================================================================
-- Service Provider (our company, not a school): price list, proposals, demo schools, competitors, roadmap.
-- These tables have no tenant_id and no school role is given access to them.
-- =====================================================================
CREATE TABLE price_lists (
  price_list_id SERIAL PRIMARY KEY,
  version       INTEGER NOT NULL UNIQUE,
  card          JSONB NOT NULL CHECK (jsonb_typeof(card -> 'plans') = 'array' AND jsonb_typeof(card -> 'addons') = 'array'),
  is_current    BOOLEAN NOT NULL DEFAULT FALSE,
  created_by    INTEGER REFERENCES users(user_id),
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX price_lists_one_current ON price_lists (is_current) WHERE is_current;
CREATE TABLE sales_proposals (
  proposal_id   SERIAL PRIMARY KEY,
  proposal_no   VARCHAR(20) NOT NULL UNIQUE,
  client_name   VARCHAR(160) NOT NULL CHECK (btrim(client_name) <> ''),
  city          VARCHAR(60),
  students      INTEGER NOT NULL CHECK (students > 0),
  plan_code     VARCHAR(20) NOT NULL CHECK (plan_code IN ('FREE', 'STARTER', 'GROWTH', 'PROFESSIONAL', 'ENTERPRISE')),
  options       JSONB NOT NULL,
  price_list_id INTEGER REFERENCES price_lists(price_list_id),
  monthly_total NUMERIC(12,2) NOT NULL CHECK (monthly_total >= 0),
  yearly_total  NUMERIC(12,2) NOT NULL CHECK (yearly_total >= 0),
  discount_pct  NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (discount_pct BETWEEN 0 AND 20),
  discount_approved_by INTEGER REFERENCES users(user_id),
  status        VARCHAR(8) NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Sent', 'Won', 'Lost')),
  created_by    INTEGER REFERENCES users(user_id),
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (discount_pct <= 10 OR discount_approved_by IS NOT NULL)     -- above 10% needs the owner's approval
);
-- A demo school is a tenant flagged as a demo, linked to the proposal it shows
ALTER TABLE tenants ADD COLUMN is_demo BOOLEAN NOT NULL DEFAULT FALSE, ADD COLUMN demo_proposal_id INTEGER REFERENCES sales_proposals(proposal_id);
CREATE TABLE competitors (
  code        VARCHAR(20) PRIMARY KEY,
  name        VARCHAR(80) NOT NULL,
  country     VARCHAR(60) NOT NULL,
  region      VARCHAR(6) NOT NULL CHECK (region IN ('India', 'Global')),
  price_text  VARCHAR(200) NOT NULL,
  source_url  VARCHAR(400) CHECK (source_url ~ '^https://'),
  checked_on  DATE NOT NULL
);
CREATE TABLE competitor_features (
  code        VARCHAR(20) NOT NULL REFERENCES competitors(code) ON DELETE CASCADE,
  feature     VARCHAR(20) NOT NULL,
  mark        CHAR(1) NOT NULL CHECK (mark IN ('Y', 'A', 'N')),
  PRIMARY KEY (code, feature)
);
CREATE TABLE roadmap_items (
  code      VARCHAR(20) PRIMARY KEY,
  title     VARCHAR(160) NOT NULL,
  why       TEXT,
  seen_at   VARCHAR(120),
  country   VARCHAR(60) NOT NULL,
  priority  VARCHAR(6) NOT NULL CHECK (priority IN ('Now', 'Next', 'Later')),
  effort    CHAR(1) NOT NULL CHECK (effort IN ('S', 'M', 'L')),
  status    VARCHAR(12) NOT NULL DEFAULT 'Idea' CHECK (status IN ('Idea', 'Planned', 'In progress', 'Released'))
);
INSERT INTO competitors (code, name, country, region, price_text, source_url, checked_on) VALUES
  ('FEDENA', 'Fedena', 'India', 'India', 'Web $999–$1,699 a year; web + app $1,599–$2,299 a year', 'https://softwarefinder.com/enterprise-resource-planning-software/fedena', '2026-11-18'),
  ('TEACHMINT', 'Teachmint', 'India', 'India', 'Free basic; ₹2K–₹15K a month paid', 'https://codingclave.com/guides/school-management-software-cost-india-2026', '2026-11-18'),
  ('ENTAB', 'Entab CampusCare', 'India', 'India', '₹25K–₹4L a year; ₹30–₹80 per student a month cited', 'https://codingclave.com/blog/best-school-management-software-india', '2026-11-18'),
  ('DEVRYON', 'Devryon', 'India', 'India', '₹6–₹16 per student a month', 'https://gleeful-whisper-cloud.lovable.app/school-erp', '2026-11-18'),
  ('ASKCAMPUS', 'AskCampus', 'India', 'India', '₹2,999/month up to 200; ₹7,999 up to 1,000; ₹18,999 up to 5,000', 'https://askcampus.pages.dev/pricing', '2026-11-18'),
  ('GRADELINK', 'Gradelink', 'USA', 'Global', 'From $121 a month up to 50 students', 'https://www.capterra.com/p/118900/Gradelink-SIS/pricing/', '2026-11-18'),
  ('ARBOR', 'Arbor MIS', 'United Kingdom', 'Global', 'Primary Core £1,575 + £2.35 per pupil a year', 'https://assets.applytosupply.digitalmarketplace.service.gov.uk/g-cloud-14/documents/92647/909733380395847-pricing-document-2024-11-21-1116.pdf', '2026-11-18'),
  ('CLASSTER', 'Classter', 'Greece', 'Global', 'From €1.50 to €4.50 per active student a year', 'https://edtechimpact.com/products/classter', '2026-11-18');
INSERT INTO competitor_features (code, feature, mark) VALUES
  ('FEDENA', 'LIBRARY', 'Y'), ('FEDENA', 'HOSTEL', 'Y'), ('FEDENA', 'APPFREE', 'N'), ('DEVRYON', 'HOSTEL', 'Y'), ('DEVRYON', 'QR', 'Y'), ('DEVRYON', 'AI', 'Y'),
  ('TEACHMINT', 'ONLINE', 'Y'), ('TEACHMINT', 'LMS', 'Y'), ('ARBOR', 'STATUTORY', 'Y'), ('ARBOR', 'AI', 'Y'), ('CLASSTER', 'LIBRARY', 'Y'), ('CLASSTER', 'LMS', 'Y');
INSERT INTO roadmap_items (code, title, seen_at, country, priority, effort) VALUES
  ('GPS', 'Live bus GPS tracking for parents', 'Premium Indian ERPs', 'India', 'Now', 'M'),
  ('WHATSAPP', 'WhatsApp Business notifications', 'Indian vendors', 'India', 'Now', 'S'),
  ('QR', 'QR / biometric attendance', 'Devryon', 'India', 'Next', 'M'),
  ('AIREMARKS', 'AI-drafted report-card remarks', 'Toddle, Arbor', 'India / United Kingdom', 'Next', 'S'),
  ('UDISE', 'Government returns: UDISE+ and APAAR ID exports', 'Arbor (UK statutory returns)', 'United Kingdom → India', 'Next', 'M'),
  ('LMS', 'Curriculum planning and student portfolios (LMS)', 'Toddle, Classter', 'India / Greece', 'Later', 'L');
