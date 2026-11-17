-- =====================================================================
-- 007  Accounts & sign-up, user/role management, admissions pipeline,
--      marks, transport routes and Data Analytics views
-- Run after 001–006.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. ACCOUNTS, SIGN-UP AND ONE-TIME CODES
--    Production sign-in is an Amazon Cognito user pool per client (school).
--    This table keeps the school's own record of each account; passwords live
--    in Cognito (password_hash = 'COGNITO').
-- ---------------------------------------------------------------------
ALTER TABLE users ALTER COLUMN person_type DROP NOT NULL;
ALTER TABLE users ALTER COLUMN person_id   DROP NOT NULL;      -- unknown until the school links the account
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;
ALTER TABLE users ADD CONSTRAINT users_status_check CHECK (status IN ('PENDING','ACTIVE','LOCKED','DISABLED'));
ALTER TABLE users
  ADD COLUMN full_name        VARCHAR(120),
  ADD COLUMN login_type       VARCHAR(6) DEFAULT 'EMAIL' CHECK (login_type IN ('EMAIL','MOBILE')),
  ADD COLUMN email_verified   BOOLEAN DEFAULT FALSE,
  ADD COLUMN phone_verified   BOOLEAN DEFAULT FALSE,
  ADD COLUMN cognito_sub      VARCHAR(64),
  ADD COLUMN requested_role   VARCHAR(30),                       -- what the person asked for at sign-up
  ADD COLUMN linked_admission_no VARCHAR(20),                    -- parents: child's admission number given at sign-up
  ADD COLUMN designation_id   INTEGER REFERENCES designations(designation_id),
  ADD COLUMN failed_logins    INTEGER DEFAULT 0,
  ADD COLUMN approved_by      INTEGER REFERENCES users(user_id),
  ADD COLUMN approved_at      TIMESTAMP,
  ADD COLUMN consent_at       TIMESTAMP;                         -- DPDP Act consent given at sign-up
ALTER TABLE users ADD CONSTRAINT users_has_login CHECK (email IS NOT NULL OR phone IS NOT NULL);
CREATE UNIQUE INDEX users_tenant_phone ON users (tenant_id, phone) WHERE phone IS NOT NULL;

-- Codes sent to verify an email or mobile, to sign in without a password, or to reset a password.
-- SMS is part of the workflow but the gateway is not connected yet: such requests stay GATEWAY_PENDING.
CREATE TABLE otp_requests (
  otp_id       BIGSERIAL PRIMARY KEY,
  tenant_id    INTEGER NOT NULL REFERENCES tenants(tenant_id),
  destination  VARCHAR(120) NOT NULL,                  -- email address or 10-digit mobile
  channel      VARCHAR(5)  NOT NULL CHECK (channel IN ('EMAIL','SMS')),
  purpose      VARCHAR(8)  NOT NULL CHECK (purpose IN ('SIGNUP','SIGNIN','RESET')),
  code_hash    VARCHAR(128) NOT NULL,                  -- never store the code itself
  status       VARCHAR(16) NOT NULL DEFAULT 'SENT' CHECK (status IN ('SENT','GATEWAY_PENDING','USED','EXPIRED','BLOCKED')),
  attempts     INTEGER NOT NULL DEFAULT 0 CHECK (attempts <= 5),
  expires_at   TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '10 minutes'),
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX ON otp_requests (tenant_id, destination, purpose, created_at DESC);

-- SMS provider settings per school (filled in when the gateway is connected)
CREATE TABLE sms_gateway_config (
  tenant_id        INTEGER PRIMARY KEY REFERENCES tenants(tenant_id),
  provider         VARCHAR(30),                         -- e.g. MSG91, Gupshup, Amazon SNS
  sender_id        VARCHAR(6),                          -- DLT header
  dlt_entity_id    VARCHAR(30),
  otp_template_id  VARCHAR(30),                         -- DLT-approved OTP template
  is_active        BOOLEAN NOT NULL DEFAULT FALSE
);

-- Limit: 5 codes per destination per hour
CREATE OR REPLACE FUNCTION request_otp(p_tenant INT, p_dest TEXT, p_channel TEXT, p_purpose TEXT, OUT otp_id BIGINT, OUT code TEXT, OUT status TEXT)
LANGUAGE plpgsql AS $$
DECLARE v_recent INT; v_sms_on BOOLEAN;
BEGIN
  SELECT count(*) INTO v_recent FROM otp_requests o
   WHERE o.tenant_id = p_tenant AND o.destination = p_dest AND o.created_at > CURRENT_TIMESTAMP - INTERVAL '1 hour';
  IF v_recent >= 5 THEN RAISE EXCEPTION 'Too many codes requested — try again in an hour'; END IF;
  UPDATE otp_requests o SET status = 'EXPIRED' WHERE o.tenant_id = p_tenant AND o.destination = p_dest AND o.purpose = p_purpose AND o.status IN ('SENT','GATEWAY_PENDING');
  SELECT COALESCE(g.is_active, FALSE) INTO v_sms_on FROM sms_gateway_config g WHERE g.tenant_id = p_tenant;
  code   := lpad((floor(random() * 1000000))::int::text, 6, '0');
  status := CASE WHEN p_channel = 'SMS' AND NOT COALESCE(v_sms_on, FALSE) THEN 'GATEWAY_PENDING' ELSE 'SENT' END;
  INSERT INTO otp_requests (tenant_id, destination, channel, purpose, code_hash, status)
  VALUES (p_tenant, p_dest, p_channel, p_purpose, md5(p_tenant || ':' || p_dest || ':' || code), status)
  RETURNING otp_requests.otp_id INTO otp_id;
  -- the caller (API) hands `code` to SES / the SMS gateway and never returns it to the browser
END $$;

CREATE OR REPLACE FUNCTION verify_otp(p_tenant INT, p_dest TEXT, p_purpose TEXT, p_code TEXT) RETURNS TEXT
LANGUAGE plpgsql AS $$
DECLARE r otp_requests%ROWTYPE;
BEGIN
  SELECT * INTO r FROM otp_requests WHERE tenant_id = p_tenant AND destination = p_dest AND purpose = p_purpose
     AND status IN ('SENT','GATEWAY_PENDING') ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RETURN 'NO_CODE'; END IF;
  IF r.expires_at < CURRENT_TIMESTAMP THEN UPDATE otp_requests SET status = 'EXPIRED' WHERE otp_id = r.otp_id; RETURN 'EXPIRED'; END IF;
  IF r.attempts >= 5 THEN UPDATE otp_requests SET status = 'BLOCKED' WHERE otp_id = r.otp_id; RETURN 'BLOCKED'; END IF;
  IF r.code_hash <> md5(p_tenant || ':' || p_dest || ':' || p_code) THEN
    UPDATE otp_requests SET attempts = attempts + 1 WHERE otp_id = r.otp_id; RETURN 'WRONG';
  END IF;
  UPDATE otp_requests SET status = 'USED' WHERE otp_id = r.otp_id;
  RETURN 'OK';
END $$;

-- ---------------------------------------------------------------------
-- 2. USER & ROLE MANAGEMENT
-- ---------------------------------------------------------------------
-- Custom roles per school already use roles.tenant_id (002); record which role each was copied from
ALTER TABLE roles ADD COLUMN based_on_role_id INTEGER REFERENCES roles(role_id);

-- Extra screens by designation (e.g. a Vice Principal who is a Teacher can manage users)
CREATE TABLE designation_menu_access (
  tenant_id      INTEGER NOT NULL REFERENCES tenants(tenant_id),
  designation_id INTEGER NOT NULL REFERENCES designations(designation_id) ON DELETE CASCADE,
  menu_id        INTEGER NOT NULL REFERENCES menus(menu_id) ON DELETE CASCADE,
  PRIMARY KEY (tenant_id, designation_id, menu_id)
);
-- Extra screens for one person
CREATE TABLE user_menu_grants (
  tenant_id  INTEGER NOT NULL REFERENCES tenants(tenant_id),
  user_id    INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  menu_id    INTEGER NOT NULL REFERENCES menus(menu_id) ON DELETE CASCADE,
  granted_by INTEGER REFERENCES users(user_id),
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, menu_id)
);
CREATE TABLE user_role_changes (
  change_id   BIGSERIAL PRIMARY KEY,
  tenant_id   INTEGER NOT NULL REFERENCES tenants(tenant_id),
  user_id     INTEGER NOT NULL REFERENCES users(user_id),
  old_role    VARCHAR(30), new_role VARCHAR(30),
  old_status  VARCHAR(10), new_status VARCHAR(10),
  changed_by  INTEGER NOT NULL REFERENCES users(user_id),
  changed_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Screens each user can open: role permissions + designation extras + personal grants, limited to what the plan switches on
CREATE VIEW v_user_screens WITH (security_invoker = true) AS
WITH granted AS (
  SELECT ur.user_id, p.menu_id FROM user_roles ur JOIN role_menu_permissions p ON p.role_id = ur.role_id AND p.can_view
  UNION
  SELECT u.user_id, d.menu_id FROM users u JOIN designation_menu_access d ON d.tenant_id = u.tenant_id AND d.designation_id = u.designation_id
  UNION
  SELECT g.user_id, g.menu_id FROM user_menu_grants g
)
SELECT u.tenant_id, u.user_id, m.menu_id, m.code, m.label, m.route
FROM granted gr
JOIN users u     ON u.user_id = gr.user_id AND u.status = 'ACTIVE'
JOIN menus m     ON m.menu_id = gr.menu_id AND m.is_active
JOIN features f  ON f.menu_id = m.menu_id
JOIN v_tenant_features tf ON tf.tenant_id = u.tenant_id AND tf.feature_id = f.feature_id AND tf.enabled;

CREATE OR REPLACE FUNCTION can_manage_users(p_user INT) RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.role_id = ur.role_id WHERE ur.user_id = p_user AND r.code = 'ADMIN')
      OR EXISTS (SELECT 1 FROM v_user_screens s WHERE s.user_id = p_user AND s.code = 'OPS_USERS');
$$;

-- Approve a sign-up or change someone's role / status. Rules: only people who can manage users;
-- nobody changes their own role; only an Admin can hand out the Admin role.
CREATE OR REPLACE FUNCTION set_user_role(p_actor INT, p_user INT, p_role_code TEXT, p_status TEXT DEFAULT NULL) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE v_old_role TEXT; v_old_status TEXT; v_role INT; v_tenant INT;
BEGIN
  IF NOT can_manage_users(p_actor) THEN RAISE EXCEPTION 'Not allowed to manage users'; END IF;
  IF p_actor = p_user THEN RAISE EXCEPTION 'You cannot change your own role'; END IF;
  SELECT u.tenant_id, u.status INTO v_tenant, v_old_status FROM users u WHERE u.user_id = p_user;
  SELECT r.role_id INTO v_role FROM roles r WHERE r.code = p_role_code AND (r.tenant_id IS NULL OR r.tenant_id = v_tenant);
  IF v_role IS NULL THEN RAISE EXCEPTION 'Unknown role %', p_role_code; END IF;
  IF p_role_code = 'ADMIN' AND NOT EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.role_id = ur.role_id WHERE ur.user_id = p_actor AND r.code = 'ADMIN') THEN
    RAISE EXCEPTION 'Only an Admin can give the Admin role';
  END IF;
  SELECT string_agg(r.code, ',') INTO v_old_role FROM user_roles ur JOIN roles r ON r.role_id = ur.role_id WHERE ur.user_id = p_user;
  DELETE FROM user_roles WHERE user_id = p_user;
  INSERT INTO user_roles (user_id, role_id) VALUES (p_user, v_role);
  UPDATE users SET status = COALESCE(p_status, status), failed_logins = 0,
         approved_by = CASE WHEN v_old_status = 'PENDING' THEN p_actor ELSE approved_by END,
         approved_at = CASE WHEN v_old_status = 'PENDING' THEN CURRENT_TIMESTAMP ELSE approved_at END
   WHERE user_id = p_user;
  INSERT INTO user_role_changes (tenant_id, user_id, old_role, new_role, old_status, new_status, changed_by)
  VALUES (v_tenant, p_user, v_old_role, p_role_code, v_old_status, COALESCE(p_status, v_old_status), p_actor);
END $$;

-- ---------------------------------------------------------------------
-- 3. ADMISSIONS: ENQUIRY → SUBMITTED → IN REVIEW → OFFERED → ENROLLED, or OPTED OUT
-- ---------------------------------------------------------------------
CREATE TABLE admission_enquiries (
  enquiry_id      SERIAL PRIMARY KEY,
  tenant_id       INTEGER NOT NULL REFERENCES tenants(tenant_id),
  app_no          VARCHAR(20) NOT NULL,
  year_id         INTEGER NOT NULL REFERENCES academic_years(year_id),
  class_id        INTEGER NOT NULL REFERENCES classes(class_id),          -- grade applied for
  child_first     VARCHAR(60) NOT NULL,
  child_last      VARCHAR(60),
  gender          VARCHAR(10),
  dob             DATE,
  previous_school VARCHAR(120),
  parent_name     VARCHAR(120) NOT NULL,
  parent_phone    VARCHAR(10) NOT NULL CHECK (parent_phone ~ '^[6-9][0-9]{9}$'),
  parent_email    VARCHAR(120),
  address         TEXT,
  sibling_admission_no VARCHAR(20),
  source          VARCHAR(20) CHECK (source IN ('Walk-in','Website','Referral','Social media','School fair')),
  needs_transport BOOLEAN DEFAULT FALSE,
  status          VARCHAR(10) NOT NULL DEFAULT 'ENQUIRY' CHECK (status IN ('ENQUIRY','SUBMITTED','IN_REVIEW','OFFERED','ENROLLED','OPTED_OUT')),
  interview_date  DATE,
  opt_out_reason  VARCHAR(40),
  docs            JSONB NOT NULL DEFAULT '{"birth_cert":false,"photo":false,"report_card":false}',
  consent_at      TIMESTAMP,
  student_id      INTEGER REFERENCES students(student_id),
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, app_no),
  CHECK (status <> 'OPTED_OUT' OR opt_out_reason IS NOT NULL),
  CHECK (status <> 'ENROLLED' OR student_id IS NOT NULL)
);
CREATE TABLE admission_status_history (
  history_id  BIGSERIAL PRIMARY KEY,
  tenant_id   INTEGER NOT NULL REFERENCES tenants(tenant_id),
  enquiry_id  INTEGER NOT NULL REFERENCES admission_enquiries(enquiry_id) ON DELETE CASCADE,
  from_status VARCHAR(10), to_status VARCHAR(10) NOT NULL,
  note        TEXT,
  changed_by  INTEGER REFERENCES users(user_id),
  changed_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Allowed moves, documents before an offer, and history on every change
CREATE OR REPLACE FUNCTION trg_admission_status() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE ok BOOLEAN;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('ENQUIRY','SUBMITTED') THEN RAISE EXCEPTION 'New records start as Enquiry or Submitted'; END IF;
    INSERT INTO admission_status_history (tenant_id, enquiry_id, from_status, to_status) VALUES (NEW.tenant_id, NEW.enquiry_id, NULL, NEW.status);
    RETURN NEW;
  END IF;
  IF NEW.status = OLD.status THEN NEW.updated_at := CURRENT_TIMESTAMP; RETURN NEW; END IF;
  ok := (OLD.status, NEW.status) IN (('ENQUIRY','SUBMITTED'),('SUBMITTED','IN_REVIEW'),('IN_REVIEW','OFFERED'),('OFFERED','ENROLLED'),('OPTED_OUT','ENQUIRY'))
        OR (NEW.status = 'OPTED_OUT' AND OLD.status IN ('ENQUIRY','SUBMITTED','IN_REVIEW','OFFERED'));
  IF NOT ok THEN RAISE EXCEPTION 'Cannot move an application from % to %', OLD.status, NEW.status; END IF;
  IF NEW.status = 'OFFERED' AND NOT ((NEW.docs->>'birth_cert')::boolean AND (NEW.docs->>'photo')::boolean) THEN
    RAISE EXCEPTION 'Birth certificate and photo must be received before an offer';
  END IF;
  NEW.updated_at := CURRENT_TIMESTAMP;
  INSERT INTO admission_status_history (tenant_id, enquiry_id, from_status, to_status, note, changed_by)
  VALUES (NEW.tenant_id, NEW.enquiry_id, OLD.status, NEW.status, NEW.opt_out_reason, NULLIF(current_setting('app.user_id', true), '')::int);
  RETURN NEW;
END $$;
CREATE TRIGGER admission_status BEFORE UPDATE ON admission_enquiries FOR EACH ROW EXECUTE FUNCTION trg_admission_status();
CREATE TRIGGER admission_status_ins AFTER INSERT ON admission_enquiries FOR EACH ROW EXECUTE FUNCTION trg_admission_status();

-- Enrol an offered applicant: student + guardian + enrolment in the section with most space
CREATE OR REPLACE FUNCTION enrol_applicant(p_enquiry INT, p_admission_no TEXT) RETURNS INT
LANGUAGE plpgsql AS $$
DECLARE e admission_enquiries%ROWTYPE; v_student INT; v_guardian INT; v_section INT;
BEGIN
  SELECT * INTO e FROM admission_enquiries WHERE enquiry_id = p_enquiry FOR UPDATE;
  IF e.status <> 'OFFERED' THEN RAISE EXCEPTION 'Only an offered applicant can be enrolled (status is %)', e.status; END IF;
  SELECT s.section_id INTO v_section FROM sections s
    LEFT JOIN enrollments en ON en.section_id = s.section_id AND en.year_id = e.year_id
   WHERE s.class_id = e.class_id AND s.tenant_id = e.tenant_id
   GROUP BY s.section_id, s.capacity HAVING count(en.enrollment_id) < s.capacity
   ORDER BY count(en.enrollment_id), s.section_id LIMIT 1;
  IF v_section IS NULL THEN RAISE EXCEPTION 'No free seat in this grade'; END IF;
  INSERT INTO students (tenant_id, admission_no, first_name, last_name, gender, dob, previous_school, admission_date, address)
  VALUES (e.tenant_id, p_admission_no, e.child_first, e.child_last, e.gender, e.dob, e.previous_school, CURRENT_DATE, e.address) RETURNING student_id INTO v_student;
  SELECT g.guardian_id INTO v_guardian FROM guardians g WHERE g.tenant_id = e.tenant_id AND g.phone = e.parent_phone LIMIT 1;   -- siblings share a guardian
  IF v_guardian IS NULL THEN
    INSERT INTO guardians (tenant_id, full_name, relation, phone, email) VALUES (e.tenant_id, e.parent_name, 'GUARDIAN', e.parent_phone, e.parent_email) RETURNING guardian_id INTO v_guardian;
  END IF;
  INSERT INTO student_guardians (tenant_id, student_id, guardian_id, is_primary) VALUES (e.tenant_id, v_student, v_guardian, TRUE);
  INSERT INTO enrollments (tenant_id, student_id, year_id, section_id) VALUES (e.tenant_id, v_student, e.year_id, v_section);
  UPDATE admission_enquiries SET student_id = v_student, status = 'ENROLLED' WHERE enquiry_id = p_enquiry;
  RETURN v_student;
END $$;

CREATE VIEW v_admissions_by_grade_status WITH (security_invoker = true) AS
SELECT e.tenant_id, e.year_id, c.class_id, c.name AS grade, c.level_no,
       count(*)                                         AS total,
       count(*) FILTER (WHERE e.status = 'ENQUIRY')     AS enquiry,
       count(*) FILTER (WHERE e.status = 'SUBMITTED')   AS submitted,
       count(*) FILTER (WHERE e.status = 'IN_REVIEW')   AS in_review,
       count(*) FILTER (WHERE e.status = 'OFFERED')     AS offered,
       count(*) FILTER (WHERE e.status = 'ENROLLED')    AS enrolled,
       count(*) FILTER (WHERE e.status = 'OPTED_OUT')   AS opted_out
FROM admission_enquiries e JOIN classes c ON c.class_id = e.class_id
GROUP BY e.tenant_id, e.year_id, c.class_id, c.name, c.level_no;

-- ---------------------------------------------------------------------
-- 4. MARKS, SUBJECT TEACHERS AND TRANSPORT ROUTES (analytics inputs)
-- ---------------------------------------------------------------------
CREATE TABLE exam_terms (
  term_id   SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(tenant_id),
  year_id   INTEGER NOT NULL REFERENCES academic_years(year_id),
  name      VARCHAR(30) NOT NULL,                  -- Term 1, Term 2, Periodic Test 1 …
  sort_order INTEGER NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, year_id, name)
);
CREATE TABLE exam_results (
  result_id      BIGSERIAL PRIMARY KEY,
  tenant_id      INTEGER NOT NULL REFERENCES tenants(tenant_id),
  enrollment_id  INTEGER NOT NULL REFERENCES enrollments(enrollment_id),
  term_id        INTEGER NOT NULL REFERENCES exam_terms(term_id),
  subject_id     INTEGER NOT NULL REFERENCES subjects(subject_id),
  marks_obtained NUMERIC(5,1) NOT NULL,
  max_marks      NUMERIC(5,1) NOT NULL DEFAULT 100 CHECK (max_marks > 0),
  is_absent      BOOLEAN DEFAULT FALSE,
  CHECK (marks_obtained BETWEEN 0 AND max_marks),
  UNIQUE (enrollment_id, term_id, subject_id)
);
CREATE TABLE section_subject_teachers (
  tenant_id  INTEGER NOT NULL REFERENCES tenants(tenant_id),
  year_id    INTEGER NOT NULL REFERENCES academic_years(year_id),
  section_id INTEGER NOT NULL REFERENCES sections(section_id),
  subject_id INTEGER NOT NULL REFERENCES subjects(subject_id),
  staff_id   INTEGER NOT NULL REFERENCES staff(staff_id),
  PRIMARY KEY (year_id, section_id, subject_id)
);
CREATE TABLE transport_routes (
  route_id    SERIAL PRIMARY KEY,
  tenant_id   INTEGER NOT NULL REFERENCES tenants(tenant_id),
  code        VARCHAR(10) NOT NULL,
  name        VARCHAR(80) NOT NULL,
  bus_reg_no  VARCHAR(15),
  capacity    INTEGER NOT NULL CHECK (capacity > 0),
  driver_name VARCHAR(80), driver_phone VARCHAR(10),
  route_km    NUMERIC(5,1),
  band_id     INTEGER REFERENCES transport_bands(band_id),
  UNIQUE (tenant_id, code)
);
ALTER TABLE pickup_points ADD COLUMN route_id INTEGER REFERENCES transport_routes(route_id);
CREATE TABLE transport_trips (                          -- daily run log from the bus app / GPS
  trip_id     BIGSERIAL PRIMARY KEY,
  tenant_id   INTEGER NOT NULL REFERENCES tenants(tenant_id),
  route_id    INTEGER NOT NULL REFERENCES transport_routes(route_id),
  trip_date   DATE NOT NULL,
  direction   VARCHAR(4) NOT NULL CHECK (direction IN ('AM','PM')),
  on_time     BOOLEAN NOT NULL,
  UNIQUE (route_id, trip_date, direction)
);

-- One row per student, term and subject, with the percentage
CREATE VIEW v_student_term_scores WITH (security_invoker = true) AS
SELECT r.tenant_id, en.year_id, t.term_id, t.name AS term, c.class_id, c.name AS grade, s.section_id, s.name AS section,
       st.student_id, st.admission_no, st.first_name || ' ' || COALESCE(st.last_name, '') AS student_name,
       sub.subject_id, sub.name AS subject, round(100 * r.marks_obtained / r.max_marks, 1) AS pct
FROM exam_results r
JOIN exam_terms t   ON t.term_id = r.term_id
JOIN enrollments en ON en.enrollment_id = r.enrollment_id
JOIN students st    ON st.student_id = en.student_id AND st.status = 'ACTIVE'
JOIN sections s     ON s.section_id = en.section_id
JOIN classes c      ON c.class_id = s.class_id
JOIN subjects sub   ON sub.subject_id = r.subject_id;

-- Overall score per student and term, ranked within the GRADE (all sections together) and within the section.
-- Top 6: grade_rank <= 6.  Bottom 6: grade_rank_from_bottom <= 6.  Filter by section_id to narrow.
CREATE VIEW v_grade_rankings WITH (security_invoker = true) AS
WITH s AS (
  SELECT tenant_id, year_id, term_id, term, class_id, grade, section_id, section, student_id, admission_no, student_name, round(avg(pct), 1) AS score
  FROM v_student_term_scores GROUP BY 1,2,3,4,5,6,7,8,9,10,11
)
SELECT s.*,
       rank() OVER (PARTITION BY tenant_id, term_id, class_id ORDER BY score DESC)             AS grade_rank,
       rank() OVER (PARTITION BY tenant_id, term_id, class_id ORDER BY score ASC)              AS grade_rank_from_bottom,
       rank() OVER (PARTITION BY tenant_id, term_id, section_id ORDER BY score DESC)           AS section_rank,
       count(*) OVER (PARTITION BY tenant_id, term_id, class_id)                               AS grade_size
FROM s;

-- How each teacher's students do in the subject they teach, against the grade average for that subject
CREATE VIEW v_teacher_subject_performance WITH (security_invoker = true) AS
WITH taught AS (
  SELECT sc.*, sst.staff_id FROM v_student_term_scores sc
  JOIN section_subject_teachers sst ON sst.year_id = sc.year_id AND sst.section_id = sc.section_id AND sst.subject_id = sc.subject_id
), grade_avg AS (
  SELECT tenant_id, term_id, class_id, subject_id, avg(pct) AS grade_avg FROM v_student_term_scores GROUP BY 1,2,3,4
)
SELECT t.tenant_id, t.year_id, t.term_id, t.term, t.staff_id, sf.first_name || ' ' || COALESCE(sf.last_name, '') AS teacher,
       t.subject_id, t.subject, t.class_id, t.grade,
       count(DISTINCT t.student_id)                                    AS students,
       round(avg(t.pct), 1)                                            AS avg_pct,
       round(avg(t.pct) - avg(g.grade_avg), 1)                         AS vs_grade,
       round(100.0 * count(*) FILTER (WHERE t.pct >= 33) / count(*))   AS pass_pct,
       round(100.0 * count(*) FILTER (WHERE t.pct >= 75) / count(*))   AS distinction_pct
FROM taught t
JOIN grade_avg g ON g.tenant_id = t.tenant_id AND g.term_id = t.term_id AND g.class_id = t.class_id AND g.subject_id = t.subject_id
JOIN staff sf    ON sf.staff_id = t.staff_id
GROUP BY t.tenant_id, t.year_id, t.term_id, t.term, t.staff_id, sf.first_name, sf.last_name, t.subject_id, t.subject, t.class_id, t.grade;

CREATE VIEW v_transport_route_summary WITH (security_invoker = true) AS
SELECT r.tenant_id, r.route_id, r.code, r.name, r.bus_reg_no, r.capacity, r.route_km,
       count(DISTINCT en.enrollment_id)                                          AS riders,
       round(100.0 * count(DISTINCT en.enrollment_id) / r.capacity)              AS seat_use_pct,
       (SELECT round(100.0 * count(*) FILTER (WHERE tt.on_time) / NULLIF(count(*), 0))
          FROM transport_trips tt WHERE tt.route_id = r.route_id AND tt.trip_date > CURRENT_DATE - 30) AS on_time_pct_30d
FROM transport_routes r
LEFT JOIN pickup_points pp ON pp.route_id = r.route_id
LEFT JOIN enrollments en   ON en.pickup_point_id = pp.point_id AND en.status = 'STUDYING'
GROUP BY r.tenant_id, r.route_id, r.code, r.name, r.bus_reg_no, r.capacity, r.route_km;

-- ---------------------------------------------------------------------
-- 5. ROW-LEVEL SECURITY
-- ---------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['otp_requests','sms_gateway_config','designation_menu_access','user_menu_grants','user_role_changes',
                           'admission_enquiries','admission_status_history','exam_terms','exam_results','section_subject_teachers',
                           'transport_routes','transport_trips'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY tenant_isolation ON %I USING (tenant_id = current_setting('app.tenant_id', true)::int)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::int)$p$, t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 6. MENUS, FEATURES, PLANS, PERMISSIONS, POWER BI CATALOGUE
-- ---------------------------------------------------------------------
INSERT INTO menus (parent_id, code, label, route, sort_order)
SELECT m.menu_id, 'STU_ADMISSIONS', 'Admissions & Enquiries', '/students/admissions', 3 FROM menus m WHERE m.code = 'STUDENTS';
INSERT INTO menus (code, label, route, icon, sort_order) VALUES ('ANALYTICS', 'Data Analytics', '/analytics', 'chart', 65);
INSERT INTO menus (parent_id, code, label, route, sort_order)
SELECT m.menu_id, v.code, v.label, v.route, v.ord FROM menus m JOIN (VALUES
 ('ANL_HOME','Report Catalogue','/analytics',1), ('ANL_RANK','Top & Bottom Performers','/analytics/rank',2),
 ('ANL_TRANSPORT','Transport Reports','/analytics/transport',3), ('ANL_TEACHER','Teacher Performance','/analytics/teachers',4),
 ('ANL_ADMISSIONS','Admissions Funnel','/analytics/admissions',5)
) AS v(code, label, route, ord) ON m.code = 'ANALYTICS';

INSERT INTO features (code, name, kind, menu_id, sort_order) SELECT code, label, 'MODULE', menu_id, sort_order FROM menus WHERE code = 'ANALYTICS';
INSERT INTO features (parent_id, code, name, kind, menu_id, sort_order)
SELECT pf.feature_id, m.code, m.label, 'SUBMENU', m.menu_id, m.sort_order
FROM menus m JOIN menus pm ON pm.menu_id = m.parent_id JOIN features pf ON pf.code = pm.code
WHERE m.code IN ('STU_ADMISSIONS','ANL_HOME','ANL_RANK','ANL_TRANSPORT','ANL_TEACHER','ANL_ADMISSIONS');
INSERT INTO features (parent_id, code, name, kind, sort_order)
SELECT f.feature_id, v.code, v.name, 'FUNCTION', 500 + v.ord FROM features f JOIN (VALUES
 ('OPERATIONS','FN_SELF_SIGNUP','Self sign-up with Gmail or mobile',1),
 ('OPERATIONS','FN_SMS_OTP','OTP by SMS (needs SMS gateway)',2)
) AS v(module, code, name, ord) ON f.code = v.module;
INSERT INTO plan_features (plan_id, feature_id)
SELECT p.plan_id, f.feature_id FROM features f JOIN (VALUES
 ('STU_ADMISSIONS',1),('FN_SELF_SIGNUP',1),('FN_SMS_OTP',2),
 ('ANALYTICS',2),('ANL_HOME',2),('ANL_RANK',2),('ANL_TRANSPORT',2),('ANL_TEACHER',2),('ANL_ADMISSIONS',2)
) AS v(code, r) ON f.code = v.code JOIN plans p ON p.tier_rank >= v.r ON CONFLICT DO NOTHING;

INSERT INTO role_menu_permissions (role_id, menu_id, can_view, can_create, can_edit, can_delete, can_approve, data_scope)
SELECT r.role_id, m.menu_id, TRUE, v.cr, v.cr, r.code = 'ADMIN', v.ap, v.scope
FROM (VALUES
 ('ADMIN','STU_ADMISSIONS',TRUE,TRUE,'ALL'), ('PRINCIPAL','STU_ADMISSIONS',TRUE,TRUE,'ALL'), ('FRONT_OFFICE','STU_ADMISSIONS',TRUE,FALSE,'ALL'),
 ('ADMIN','ANL_HOME',FALSE,FALSE,'ALL'), ('ADMIN','ANL_RANK',FALSE,FALSE,'ALL'), ('ADMIN','ANL_TRANSPORT',FALSE,FALSE,'ALL'), ('ADMIN','ANL_TEACHER',FALSE,FALSE,'ALL'), ('ADMIN','ANL_ADMISSIONS',FALSE,FALSE,'ALL'),
 ('PRINCIPAL','ANL_HOME',FALSE,FALSE,'ALL'), ('PRINCIPAL','ANL_RANK',FALSE,FALSE,'ALL'), ('PRINCIPAL','ANL_TRANSPORT',FALSE,FALSE,'ALL'), ('PRINCIPAL','ANL_TEACHER',FALSE,FALSE,'ALL'), ('PRINCIPAL','ANL_ADMISSIONS',FALSE,FALSE,'ALL'),
 ('ACCOUNTANT','ANL_HOME',FALSE,FALSE,'ALL'), ('ACCOUNTANT','ANL_TRANSPORT',FALSE,FALSE,'ALL'),
 ('TEACHER','ANL_RANK',FALSE,FALSE,'OWN_CLASS'), ('FRONT_OFFICE','ANL_ADMISSIONS',FALSE,FALSE,'ALL')
) AS v(role, code, cr, ap, scope)
JOIN roles r ON r.code = v.role JOIN menus m ON m.code = v.code
ON CONFLICT DO NOTHING;

INSERT INTO analytics_reports (feature_id, code, title, variant, pbi_page_name, sort_order)
SELECT f.feature_id, v.code, v.title, 'POWERBI', v.page, v.ord FROM features f JOIN (VALUES
 ('ANL_RANK','RPT_TOP_BOTTOM','Top & bottom 6 per grade','TopBottom6',1),
 ('ANL_TEACHER','RPT_TEACHER_IMPACT','Teacher performance','TeacherImpact',1),
 ('ANL_TRANSPORT','RPT_TRANSPORT_ROUTES','Transport routes','Routes',1),
 ('ANL_TRANSPORT','RPT_TRANSPORT_GRADES','Riders by grade','RidersByGrade',2),
 ('ANL_ADMISSIONS','RPT_ADMISSIONS_FUNNEL','Admissions funnel by grade','Funnel',1)
) AS v(feature, code, title, page, ord) ON f.code = v.feature;

-- Seed: designations used by the access rules, and the demo school's extras for a Vice Principal
INSERT INTO designations (tenant_id, name, is_teaching)
SELECT 1, v.name, v.t FROM (VALUES ('Vice Principal',TRUE),('Admissions Officer',FALSE),('IT Administrator',FALSE)) AS v(name, t)
WHERE NOT EXISTS (SELECT 1 FROM designations d WHERE d.tenant_id = 1 AND d.name = v.name);
INSERT INTO designation_menu_access (tenant_id, designation_id, menu_id)
SELECT 1, d.designation_id, m.menu_id FROM designations d JOIN menus m ON m.code IN ('OPS_USERS','OPS_ROLES','STU_ADMISSIONS','ANL_RANK','ANL_TEACHER')
WHERE d.tenant_id = 1 AND d.name = 'Vice Principal';
INSERT INTO designation_menu_access (tenant_id, designation_id, menu_id)
SELECT 1, d.designation_id, m.menu_id FROM designations d JOIN menus m ON m.code = 'STU_ADMISSIONS'
WHERE d.tenant_id = 1 AND d.name = 'Admissions Officer';
