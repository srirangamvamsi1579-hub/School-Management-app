-- =====================================================================
-- 026  Release 12: dashboard insights data, route planning, student profile and report cards,
--      staff leave with allowances and approvals, notifications, help documents and FAQs, conversion templates.
--      Run after 001–025.
--
--      Menus: Students → Student Profile (STU_PROFILE) and Report Cards (STU_REPORTCARD, replaces Promote / Transfer);
--      Staff → Add Staff is removed (adding staff is inside All Staff; its permissions move to STF_LIST);
--      My Space → My Leave (SELF_LEAVE); Operations → Help Documents & FAQs (OPS_HELPDOCS); Help → FAQs (HELP_FAQ).
-- =====================================================================

-- ---------- Staff: full time / part time ----------
-- The dashboard splits staff into full time and part time; permanent and contract staff both count as full time
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_employment_type_check;
UPDATE staff SET employment_type = CASE WHEN employment_type = 'PART_TIME' THEN 'PART_TIME' ELSE 'FULL_TIME' END;
ALTER TABLE staff ALTER COLUMN employment_type SET DEFAULT 'FULL_TIME', ALTER COLUMN employment_type SET NOT NULL,
  ADD CONSTRAINT staff_employment_type_check CHECK (employment_type IN ('FULL_TIME', 'PART_TIME'));

-- ---------- Menus and plan features ----------
-- Help may not be in the menu table yet
INSERT INTO menus (code, label, icon, sort_order) SELECT 'HELP', 'Help', 'book', 99 WHERE NOT EXISTS (SELECT 1 FROM menus WHERE code = 'HELP');
INSERT INTO menus (parent_id, code, label, route, sort_order) SELECT menu_id, 'HELP_GUIDE', 'User Guide & Demo', '/help/guide', 1 FROM menus WHERE code = 'HELP' AND NOT EXISTS (SELECT 1 FROM menus WHERE code = 'HELP_GUIDE');
INSERT INTO features (code, name, kind, menu_id, is_addon_eligible, sort_order)
SELECT m.code, m.label, 'MODULE', m.menu_id, FALSE, 99 FROM menus m WHERE m.code = 'HELP' AND NOT EXISTS (SELECT 1 FROM features WHERE code = 'HELP');

UPDATE menus SET code = 'STU_REPORTCARD', label = 'Report Cards', route = '/students/report-cards' WHERE code = 'STU_PROMOTE';
UPDATE features SET code = 'STU_REPORTCARD', name = 'Report Cards' WHERE code = 'STU_PROMOTE';

INSERT INTO menus (parent_id, code, label, route, sort_order)
SELECT p.menu_id, v.code, v.label, v.route, v.ord FROM (VALUES
  ('STUDENTS', 'STU_PROFILE', 'Student Profile', '/students/profile', 2),
  ('SELF', 'SELF_LEAVE', 'My Leave', '/me/leave', 5),
  ('OPERATIONS', 'OPS_HELPDOCS', 'Help Documents & FAQs', '/ops/help-docs', 9),
  ('HELP', 'HELP_GUIDE', 'User Guide & Demo', '/help/guide', 1),
  ('HELP', 'HELP_FAQ', 'FAQs', '/help/faq', 2)
) AS v(parent, code, label, route, ord) JOIN menus p ON p.code = v.parent
WHERE NOT EXISTS (SELECT 1 FROM menus WHERE code = v.code);
UPDATE menus SET menu_group = 'Data upload' WHERE code = 'OPS_HELPDOCS';

INSERT INTO features (parent_id, code, name, kind, menu_id, is_addon_eligible, sort_order)
SELECT pf.feature_id, m.code, m.label, 'SUBMENU', m.menu_id, FALSE, m.sort_order
FROM menus m JOIN menus p ON p.menu_id = m.parent_id JOIN features pf ON pf.code = p.code
WHERE m.code IN ('STU_PROFILE', 'SELF_LEAVE', 'OPS_HELPDOCS', 'HELP_GUIDE', 'HELP_FAQ') AND NOT EXISTS (SELECT 1 FROM features WHERE code = m.code);
-- Every plan (Report Cards used to be Growth and above as Promote / Transfer)
INSERT INTO plan_features (plan_id, feature_id)
SELECT p.plan_id, f.feature_id FROM plans p CROSS JOIN features f
WHERE f.code IN ('STU_PROFILE', 'STU_REPORTCARD', 'SELF_LEAVE', 'OPS_HELPDOCS', 'HELP', 'HELP_GUIDE', 'HELP_FAQ') ON CONFLICT DO NOTHING;

-- Add Staff is inside All Staff: whoever could add staff keeps All Staff, then the sub-menu goes
INSERT INTO role_menu_permissions (role_id, menu_id, can_view, can_create, can_edit, data_scope)
SELECT p.role_id, l.menu_id, TRUE, TRUE, TRUE, 'ALL' FROM role_menu_permissions p JOIN menus a ON a.menu_id = p.menu_id AND a.code = 'STF_ADD' CROSS JOIN menus l
WHERE l.code = 'STF_LIST' AND p.can_view ON CONFLICT (role_id, menu_id) DO UPDATE SET can_create = TRUE, can_edit = TRUE;
INSERT INTO department_menu_permissions (tenant_id, department, menu_id)
SELECT d.tenant_id, d.department, l.menu_id FROM department_menu_permissions d JOIN menus a ON a.menu_id = d.menu_id AND a.code = 'STF_ADD' CROSS JOIN menus l WHERE l.code = 'STF_LIST' ON CONFLICT DO NOTHING;
DELETE FROM plan_features WHERE feature_id IN (SELECT feature_id FROM features WHERE code = 'STF_ADD');
DELETE FROM tenant_feature_overrides WHERE feature_id IN (SELECT feature_id FROM features WHERE code = 'STF_ADD');
DELETE FROM features WHERE code = 'STF_ADD';
DELETE FROM menus WHERE code = 'STF_ADD';

-- New screens for the people who already had the related ones
INSERT INTO role_menu_permissions (role_id, menu_id, can_view, data_scope)
SELECT DISTINCT p.role_id, n.menu_id, TRUE, 'ALL' FROM role_menu_permissions p JOIN menus o ON o.menu_id = p.menu_id
JOIN (VALUES ('STU_LIST', 'STU_PROFILE'), ('SELF_PROFILE', 'HELP_GUIDE'), ('SELF_PROFILE', 'HELP_FAQ')) AS v(had, gets) ON v.had = o.code
JOIN menus n ON n.code = v.gets WHERE p.can_view ON CONFLICT DO NOTHING;
-- My Leave for every staff role (everyone with a login except parents and the platform team)
INSERT INTO role_menu_permissions (role_id, menu_id, can_view, can_create, data_scope)
SELECT r.role_id, m.menu_id, TRUE, TRUE, 'SELF' FROM roles r CROSS JOIN menus m
WHERE m.code = 'SELF_LEAVE' AND r.code IN ('ADMIN', 'PRINCIPAL', 'ACCOUNTANT', 'TEACHER', 'FRONT_OFFICE', 'TRANSPORT') ON CONFLICT DO NOTHING;
INSERT INTO role_menu_permissions (role_id, menu_id, can_view, can_create, can_edit, data_scope)
SELECT r.role_id, m.menu_id, TRUE, TRUE, TRUE, CASE WHEN r.code = 'TEACHER' THEN 'OWN_CLASS' ELSE 'ALL' END FROM roles r CROSS JOIN menus m
WHERE m.code = 'STU_REPORTCARD' AND r.code IN ('ADMIN', 'PRINCIPAL', 'TEACHER') ON CONFLICT DO NOTHING;
INSERT INTO role_menu_permissions (role_id, menu_id, can_view, can_create, can_edit, data_scope)
SELECT r.role_id, m.menu_id, TRUE, TRUE, TRUE, 'ALL' FROM roles r CROSS JOIN menus m WHERE m.code = 'OPS_HELPDOCS' AND r.code = 'ADMIN' ON CONFLICT DO NOTHING;
-- Teachers apply in My Leave; approving stays with the Principal, the Vice Principal (by designation) and the Admin
DELETE FROM role_menu_permissions WHERE role_id = (SELECT role_id FROM roles WHERE code = 'TEACHER' AND tenant_id IS NULL) AND menu_id = (SELECT menu_id FROM menus WHERE code = 'STF_LEAVE');
INSERT INTO designation_menu_access (tenant_id, designation_id, menu_id)
SELECT d.tenant_id, d.designation_id, m.menu_id FROM designations d CROSS JOIN menus m WHERE d.name = 'Vice Principal' AND m.code = 'STF_LEAVE' ON CONFLICT DO NOTHING;

-- ---------- School holidays (attendance registers and leave days skip them, and Sundays) ----------
CREATE TABLE school_holidays (
  tenant_id    INTEGER NOT NULL REFERENCES tenants(tenant_id),
  holiday_date DATE NOT NULL,
  name         VARCHAR(80) NOT NULL,
  PRIMARY KEY (tenant_id, holiday_date)
);
CREATE OR REPLACE FUNCTION is_school_day(p_tenant INT, p_day DATE) RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT EXTRACT(DOW FROM p_day) <> 0 AND NOT EXISTS (SELECT 1 FROM school_holidays WHERE tenant_id = p_tenant AND holiday_date = p_day)
$$;

-- ---------- Staff leave: types with yearly allowance, requests, approvals ----------
CREATE TABLE leave_types (
  tenant_id     INTEGER NOT NULL REFERENCES tenants(tenant_id),
  code          VARCHAR(6) NOT NULL,
  name          VARCHAR(60) NOT NULL,
  days_per_year NUMERIC(5,1) CHECK (days_per_year IS NULL OR days_per_year >= 0),   -- NULL = no limit (leave without pay)
  max_at_once   NUMERIC(5,1),
  notice_days   INTEGER NOT NULL DEFAULT 0,
  gender        VARCHAR(10) CHECK (gender IN ('Male', 'Female')),
  full_time_only BOOLEAN NOT NULL DEFAULT FALSE,
  after_the_day BOOLEAN NOT NULL DEFAULT FALSE,           -- can be applied after the day (sick leave)
  note          VARCHAR(200),
  PRIMARY KEY (tenant_id, code)
);
INSERT INTO leave_types (tenant_id, code, name, days_per_year, max_at_once, notice_days, gender, full_time_only, after_the_day, note)
SELECT t.tenant_id, v.* FROM tenants t CROSS JOIN (VALUES
  ('CL', 'Casual leave', 12, 3, 0, NULL, FALSE, FALSE, 'Up to 3 days at a time.'),
  ('SL', 'Sick leave', 10, NULL, 0, NULL, FALSE, TRUE, 'A medical certificate is needed for more than 2 days.'),
  ('EL', 'Earned leave', 15, NULL, 7, NULL, TRUE, FALSE, 'Apply at least 7 days ahead. Full-time staff only.'),
  ('ML', 'Maternity leave', 182, NULL, 0, 'Female', FALSE, FALSE, '26 weeks (Maternity Benefit Act).'),
  ('PL', 'Paternity leave', 15, NULL, 0, 'Male', FALSE, FALSE, 'Within 6 months of the birth.'),
  ('CO', 'Compensatory off', 5, 2, 0, NULL, FALSE, FALSE, 'For working on a school holiday or event day.'),
  ('LOP', 'Leave without pay', NULL, NULL, 0, NULL, FALSE, FALSE, 'No limit; salary is cut for these days.')
) AS v(code, name, days, maxo, notice, gender, fto, after, note);

ALTER TABLE leave_requests
  ADD COLUMN leave_code   VARCHAR(6),
  ADD COLUMN half_day     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN days         NUMERIC(5,1),
  ADD COLUMN approver_ids INTEGER[] NOT NULL DEFAULT '{}',
  ADD COLUMN decided_at   TIMESTAMPTZ,
  ADD COLUMN decision_note VARCHAR(300),
  ADD COLUMN requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD CONSTRAINT leave_half_one_day CHECK (NOT half_day OR from_date = to_date),
  ADD CONSTRAINT leave_dates CHECK (to_date >= from_date);
ALTER TABLE leave_requests DROP CONSTRAINT IF EXISTS leave_requests_status_check;
UPDATE leave_requests SET status = 'DECLINED' WHERE status = 'REJECTED';
ALTER TABLE leave_requests ALTER COLUMN status TYPE VARCHAR(10);
ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_status_check CHECK (status IN ('PENDING', 'APPROVED', 'DECLINED', 'CANCELLED'));
UPDATE leave_requests SET leave_code = CASE leave_type WHEN 'CASUAL' THEN 'CL' WHEN 'SICK' THEN 'SL' WHEN 'EARNED' THEN 'EL' ELSE 'LOP' END WHERE leave_code IS NULL;

-- Leave emails use the outbox too
ALTER TABLE email_outbox DROP CONSTRAINT IF EXISTS email_outbox_kind_check;
ALTER TABLE email_outbox ADD CONSTRAINT email_outbox_kind_check CHECK (kind IN ('FEE_REQUEST','FEE_REMINDER','PAYMENT_CONFIRMATION','OTHER','LEAVE','REPORT_CARD'));

-- In-app notifications (the bell); emails are queued separately
CREATE TABLE app_notifications (
  notification_id BIGSERIAL PRIMARY KEY,
  tenant_id   INTEGER NOT NULL REFERENCES tenants(tenant_id),
  user_id     INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  title       VARCHAR(160) NOT NULL,
  body        VARCHAR(500),
  screen_code VARCHAR(40),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at     TIMESTAMPTZ
);
CREATE INDEX ON app_notifications (user_id, read_at);

-- 3.0 → 3, 2.5 → 2.5 (for messages)
CREATE OR REPLACE FUNCTION num_txt(p NUMERIC) RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$ SELECT CASE WHEN p = trunc(p) THEN trunc(p)::text ELSE p::text END $$;

-- Working days a leave covers
CREATE OR REPLACE FUNCTION leave_days(p_tenant INT, p_from DATE, p_to DATE, p_half BOOLEAN DEFAULT FALSE) RETURNS NUMERIC LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN p_half THEN 0.5 ELSE (SELECT count(*) FROM generate_series(p_from, p_to, interval '1 day') d WHERE is_school_day(p_tenant, d::date))::numeric END
$$;
-- Taken + waiting for one leave type this academic year (April to March)
CREATE OR REPLACE FUNCTION leave_used(p_staff INT, p_code VARCHAR, p_on DATE DEFAULT current_date) RETURNS NUMERIC LANGUAGE sql STABLE AS $$
  SELECT COALESCE(sum(days), 0) FROM leave_requests
  WHERE staff_id = p_staff AND leave_code = p_code AND status IN ('PENDING', 'APPROVED')
    AND from_date >= make_date(EXTRACT(YEAR FROM p_on - interval '3 months')::int, 4, 1)
$$;
-- Approvers: teaching staff → the Principal and the Vice Principal; others → the Principal and the Admin;
-- the Principal → the Admin. Never the person themself.
CREATE OR REPLACE FUNCTION leave_approvers(p_staff INT) RETURNS INTEGER[] LANGUAGE sql STABLE AS $$
  WITH me AS (SELECT s.tenant_id, s.staff_id, d.name AS desig, (SELECT user_id FROM users WHERE staff_id = s.staff_id LIMIT 1) AS self
              FROM staff s LEFT JOIN designations d ON d.designation_id = s.designation_id WHERE s.staff_id = p_staff),
  staff_users AS (SELECT u.user_id, r.code AS role, d.name AS user_desig FROM users u JOIN me ON u.tenant_id = me.tenant_id
                  JOIN user_roles ur ON ur.user_id = u.user_id JOIN roles r ON r.role_id = ur.role_id
                  LEFT JOIN designations d ON d.designation_id = u.designation_id
                  WHERE u.status = 'ACTIVE' AND u.user_id IS DISTINCT FROM me.self)
  SELECT COALESCE(array_agg(DISTINCT user_id ORDER BY user_id), '{}') FROM staff_users, me
  WHERE CASE WHEN me.desig = 'Principal' THEN role = 'ADMIN'
             WHEN me.desig ~ '(Teacher|PRT|TGT|PGT|Coordinator|Head of|Special Educator|Counsellor|Librarian)' THEN role = 'PRINCIPAL' OR user_desig = 'Vice Principal'
             ELSE role IN ('PRINCIPAL', 'ADMIN') END
$$;

CREATE OR REPLACE FUNCTION apply_staff_leave(p_staff INT, p_code VARCHAR, p_from DATE, p_to DATE, p_reason VARCHAR, p_half BOOLEAN DEFAULT FALSE)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE st RECORD; t RECORD; n NUMERIC; id INT; who TEXT; appr INT[];
BEGIN
  SELECT s.*, COALESCE(s.gender, '') AS g INTO st FROM staff s WHERE staff_id = p_staff;
  SELECT * INTO t FROM leave_types WHERE tenant_id = st.tenant_id AND code = p_code;
  IF t IS NULL THEN RAISE EXCEPTION 'Unknown leave type %', p_code; END IF;
  IF t.gender IS NOT NULL AND t.gender <> st.g THEN RAISE EXCEPTION '% is not available for this staff member', t.name; END IF;
  IF t.full_time_only AND st.employment_type <> 'FULL_TIME' THEN RAISE EXCEPTION '% is for full-time staff only', t.name; END IF;
  IF p_to < p_from THEN RAISE EXCEPTION 'The last day is before the first day'; END IF;
  IF p_half AND p_from <> p_to THEN RAISE EXCEPTION 'A half day is for one date only'; END IF;
  IF COALESCE(trim(p_reason), '') = '' THEN RAISE EXCEPTION 'Give a reason'; END IF;
  IF NOT t.after_the_day AND p_from < current_date THEN RAISE EXCEPTION 'Only sick leave can be applied after the day'; END IF;
  IF t.notice_days > 0 AND p_from < current_date + t.notice_days THEN RAISE EXCEPTION '% must be applied at least % days ahead', t.name, t.notice_days; END IF;
  n := leave_days(st.tenant_id, p_from, p_to, p_half);
  IF n = 0 THEN RAISE EXCEPTION 'These dates are all holidays'; END IF;
  IF t.max_at_once IS NOT NULL AND n > t.max_at_once THEN RAISE EXCEPTION '% is up to % days at a time', t.name, num_txt(t.max_at_once); END IF;
  IF t.days_per_year IS NOT NULL AND leave_used(p_staff, p_code, p_from) + n > t.days_per_year THEN
    RAISE EXCEPTION 'Only % day(s) of % left', num_txt(t.days_per_year - leave_used(p_staff, p_code, p_from)), lower(t.name); END IF;
  PERFORM 1 FROM leave_requests WHERE staff_id = p_staff AND status IN ('PENDING', 'APPROVED') AND from_date <= p_to AND to_date >= p_from FOR UPDATE;
  IF FOUND THEN RAISE EXCEPTION 'Overlaps another leave request'; END IF;
  appr := leave_approvers(p_staff);
  IF cardinality(appr) = 0 THEN RAISE EXCEPTION 'Nobody can approve this leave yet (no active Principal or Admin)'; END IF;
  INSERT INTO leave_requests (tenant_id, staff_id, leave_type, leave_code, from_date, to_date, half_day, days, reason, status, approver_ids)
  VALUES (st.tenant_id, p_staff, upper(t.name), p_code, p_from, p_to, p_half, n, trim(p_reason), 'PENDING', appr) RETURNING leave_id INTO id;
  who := st.first_name || COALESCE(' ' || st.last_name, '');
  INSERT INTO app_notifications (tenant_id, user_id, title, body, screen_code)
  SELECT st.tenant_id, a, 'Leave to approve: ' || who, t.name || ', ' || num_txt(n) || ' day(s) from ' || to_char(p_from, 'DD-MM-YYYY') || '. Reason: ' || trim(p_reason), 'STF_LEAVE' FROM unnest(appr) a;
  INSERT INTO email_outbox (tenant_id, to_email, subject, body, kind, related_id)
  SELECT st.tenant_id, u.email, 'Leave to approve: ' || who, '<p>' || t.name || ', ' || num_txt(n) || ' day(s) from ' || to_char(p_from, 'DD-MM-YYYY') || '. Open the app to approve or decline.</p>', 'LEAVE', id
  FROM users u WHERE u.user_id = ANY (appr) AND u.email IS NOT NULL;
  RETURN id;
END $$;

CREATE OR REPLACE FUNCTION decide_staff_leave(p_leave INT, p_user INT, p_decision VARCHAR, p_note VARCHAR DEFAULT NULL) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE r RECORD; d DATE; self INT;
BEGIN
  SELECT * INTO r FROM leave_requests WHERE leave_id = p_leave FOR UPDATE;
  IF r IS NULL OR r.status <> 'PENDING' THEN RAISE EXCEPTION 'This request has already been decided'; END IF;
  IF p_decision NOT IN ('APPROVED', 'DECLINED') THEN RAISE EXCEPTION 'Approve or decline'; END IF;
  IF NOT p_user = ANY (r.approver_ids) THEN RAISE EXCEPTION 'You are not an approver for this request'; END IF;
  IF p_decision = 'DECLINED' AND COALESCE(trim(p_note), '') = '' THEN RAISE EXCEPTION 'Give a reason for declining'; END IF;
  UPDATE leave_requests SET status = p_decision, approved_by = p_user, decided_at = now(), decision_note = NULLIF(trim(p_note), '') WHERE leave_id = p_leave;
  IF p_decision = 'APPROVED' THEN
    FOR d IN SELECT g::date FROM generate_series(r.from_date, r.to_date, interval '1 day') g LOOP
      IF is_school_day(r.tenant_id, d) THEN
        INSERT INTO staff_attendance (tenant_id, staff_id, att_date, status) VALUES (r.tenant_id, r.staff_id, d, CASE WHEN r.half_day THEN 'HALF_DAY' ELSE 'LEAVE' END)
        ON CONFLICT (staff_id, att_date) DO UPDATE SET status = EXCLUDED.status;
      END IF;
    END LOOP;
  END IF;
  SELECT user_id INTO self FROM users WHERE staff_id = r.staff_id LIMIT 1;
  IF self IS NOT NULL THEN
    INSERT INTO app_notifications (tenant_id, user_id, title, body, screen_code)
    VALUES (r.tenant_id, self, 'Leave ' || lower(p_decision) || ': ' || initcap(lower(r.leave_type)), to_char(r.from_date, 'DD-MM-YYYY') || COALESCE(' — ' || NULLIF(trim(p_note), ''), ''), 'SELF_LEAVE');
  END IF;
  -- Other approvers no longer need to act
  UPDATE app_notifications SET read_at = now() WHERE screen_code = 'STF_LEAVE' AND read_at IS NULL AND user_id = ANY (r.approver_ids)
    AND title = 'Leave to approve: ' || (SELECT first_name || COALESCE(' ' || last_name, '') FROM staff WHERE staff_id = r.staff_id);
END $$;

-- Leave per person this year: allowed, taken, waiting, left
CREATE VIEW v_leave_balances AS
SELECT s.tenant_id, s.staff_id, s.employee_code, t.code AS leave_code, t.name AS leave_name, t.days_per_year,
       COALESCE(sum(l.days) FILTER (WHERE l.status = 'APPROVED'), 0) AS taken,
       COALESCE(sum(l.days) FILTER (WHERE l.status = 'PENDING'), 0) AS waiting,
       t.days_per_year - COALESCE(sum(l.days) FILTER (WHERE l.status IN ('APPROVED', 'PENDING')), 0) AS days_left
FROM staff s JOIN leave_types t ON t.tenant_id = s.tenant_id
     AND (t.gender IS NULL OR t.gender = s.gender) AND (NOT t.full_time_only OR s.employment_type = 'FULL_TIME')
LEFT JOIN leave_requests l ON l.staff_id = s.staff_id AND l.leave_code = t.code
     AND l.from_date >= make_date(EXTRACT(YEAR FROM current_date - interval '3 months')::int, 4, 1)
GROUP BY s.tenant_id, s.staff_id, s.employee_code, t.code, t.name, t.days_per_year;

-- ---------- Report cards published to parents ----------
CREATE TABLE report_cards (
  report_id     BIGSERIAL PRIMARY KEY,
  tenant_id     INTEGER NOT NULL REFERENCES tenants(tenant_id),
  enrollment_id INTEGER NOT NULL REFERENCES enrollments(enrollment_id),
  scope         VARCHAR(10) NOT NULL CHECK (scope IN ('T1_TERM', 'T2_TERM', 'YEAR', 'PT1', 'T1', 'PT2', 'T2')),
  title         VARCHAR(80) NOT NULL,
  pdf_key       VARCHAR(255),                        -- the PDF in the school's private storage
  published_by  INTEGER REFERENCES users(user_id),
  published_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (enrollment_id, scope)                      -- publishing again replaces the earlier copy
);
CREATE OR REPLACE FUNCTION cbse_grade(p_pct NUMERIC) RETURNS VARCHAR LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN p_pct IS NULL THEN NULL WHEN p_pct >= 91 THEN 'A1' WHEN p_pct >= 81 THEN 'A2' WHEN p_pct >= 71 THEN 'B1' WHEN p_pct >= 61 THEN 'B2'
              WHEN p_pct >= 51 THEN 'C1' WHEN p_pct >= 41 THEN 'C2' WHEN p_pct >= 33 THEN 'D' ELSE 'E' END
$$;
-- Rank of each student in the section and grade for a term (overall % across subjects; ties share a rank)
CREATE VIEW v_student_term_rank AS
SELECT x.*, rank() OVER (PARTITION BY x.tenant_id, x.term_id, x.section_id ORDER BY x.overall_pct DESC) AS section_rank,
       rank() OVER (PARTITION BY x.tenant_id, x.term_id, x.class_id ORDER BY x.overall_pct DESC) AS grade_rank,
       count(*) OVER (PARTITION BY x.tenant_id, x.term_id, x.class_id) AS grade_size
FROM (SELECT r.tenant_id, r.term_id, e.enrollment_id, e.section_id, sec.class_id,
             round(avg(100 * r.marks_obtained / r.max_marks), 1) AS overall_pct
      FROM exam_results r JOIN enrollments e ON e.enrollment_id = r.enrollment_id JOIN sections sec ON sec.section_id = e.section_id
      GROUP BY r.tenant_id, r.term_id, e.enrollment_id, e.section_id, sec.class_id) x;

-- ---------- Transport: fleet, breakdowns, map positions, route plans ----------
CREATE TABLE buses (
  bus_id          SERIAL PRIMARY KEY,
  tenant_id       INTEGER NOT NULL REFERENCES tenants(tenant_id),
  registration    VARCHAR(20) NOT NULL,
  seats           INTEGER NOT NULL CHECK (seats > 0),
  status          VARCHAR(12) NOT NULL DEFAULT 'IN_SERVICE' CHECK (status IN ('IN_SERVICE', 'SPARE', 'UNDER_REPAIR', 'RETIRED')),
  route_id        INTEGER REFERENCES transport_routes(route_id),
  fitness_until   DATE,
  insurance_until DATE,
  last_service    DATE,
  UNIQUE (tenant_id, registration)
);
CREATE TABLE bus_incidents (
  incident_id   BIGSERIAL PRIMARY KEY,
  tenant_id     INTEGER NOT NULL REFERENCES tenants(tenant_id),
  bus_id        INTEGER NOT NULL REFERENCES buses(bus_id),
  route_id      INTEGER REFERENCES transport_routes(route_id),
  incident_date DATE NOT NULL CHECK (incident_date <= current_date),
  kind          VARCHAR(20) NOT NULL CHECK (kind IN ('Breakdown', 'Flat tyre', 'Battery', 'Accident', 'Other')),
  detail        VARCHAR(300) NOT NULL,
  trip          VARCHAR(2) NOT NULL CHECK (trip IN ('AM', 'PM')),
  delay_min     INTEGER NOT NULL DEFAULT 0 CHECK (delay_min >= 0),
  covered_by    INTEGER REFERENCES buses(bus_id),
  riders        INTEGER NOT NULL DEFAULT 0,
  logged_by     INTEGER REFERENCES users(user_id),
  logged_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (covered_by IS DISTINCT FROM bus_id)
);
ALTER TABLE pickup_points ADD COLUMN latitude NUMERIC(9,6), ADD COLUMN longitude NUMERIC(9,6);
-- Riders' approximate home location for pickup suggestions (rounded to about 100 m; never shown to other parents)
ALTER TABLE enrollments ADD COLUMN home_lat NUMERIC(7,4), ADD COLUMN home_lng NUMERIC(7,4);
CREATE TABLE route_plans (
  plan_id       BIGSERIAL PRIMARY KEY,
  tenant_id     INTEGER NOT NULL REFERENCES tenants(tenant_id),
  route_id      INTEGER NOT NULL REFERENCES transport_routes(route_id),
  option_code   VARCHAR(12) NOT NULL CHECK (option_code IN ('SHORTEST', 'OUTSIDE_IN', 'FEWER_STOPS', 'MANUAL')),
  km            NUMERIC(6,1) NOT NULL,
  minutes       INTEGER NOT NULL,
  minutes_saved INTEGER NOT NULL DEFAULT 0,
  stops_merged  INTEGER NOT NULL DEFAULT 0,
  applied_by    INTEGER REFERENCES users(user_id),
  applied_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Fleet and breakdowns this academic year
CREATE VIEW v_fleet_summary AS
SELECT b.tenant_id, count(*) FILTER (WHERE b.status <> 'RETIRED') AS buses, count(*) FILTER (WHERE b.status = 'IN_SERVICE') AS in_service,
       count(*) FILTER (WHERE b.status = 'SPARE') AS spare, count(*) FILTER (WHERE b.status = 'UNDER_REPAIR') AS under_repair,
       (SELECT count(*) FROM bus_incidents i WHERE i.tenant_id = b.tenant_id AND i.incident_date >= make_date(EXTRACT(YEAR FROM current_date - interval '3 months')::int, 4, 1)) AS incidents_this_year
FROM buses b GROUP BY b.tenant_id;

-- ---------- Staff by employment type (dashboard) ----------
CREATE VIEW v_staff_by_type AS
SELECT s.tenant_id, s.employment_type, count(*) AS staff,
       COALESCE(sum(pay.monthly), 0) AS monthly_gross
FROM staff s LEFT JOIN LATERAL (
  SELECT sum(ss.amount) AS monthly FROM staff_salary_structures ss JOIN salary_components c ON c.component_id = ss.component_id
  WHERE ss.staff_id = s.staff_id AND c.kind = 'EARNING'
    AND ss.effective_from = (SELECT max(effective_from) FROM staff_salary_structures x WHERE x.staff_id = ss.staff_id AND x.component_id = ss.component_id AND x.effective_from <= current_date)
) pay ON TRUE
WHERE s.status IN ('ACTIVE', 'ON_LEAVE')
GROUP BY s.tenant_id, s.employment_type;

-- ---------- Help documents and the school's own FAQs ----------
CREATE TABLE help_documents (
  doc_id    BIGSERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(tenant_id),
  title     VARCHAR(120) NOT NULL,
  kind      VARCHAR(4) NOT NULL CHECK (kind IN ('LINK', 'FILE')),
  url       VARCHAR(500) CHECK (url IS NULL OR url LIKE 'https://%'),
  file_key  VARCHAR(255),
  menu_code VARCHAR(40) REFERENCES menus(code) ON UPDATE CASCADE,
  roles     TEXT[] NOT NULL DEFAULT '{ALL}',
  version   INTEGER NOT NULL DEFAULT 1,
  added_by  INTEGER REFERENCES users(user_id),
  added_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((kind = 'LINK' AND url IS NOT NULL) OR (kind = 'FILE' AND file_key IS NOT NULL)),
  CHECK (cardinality(roles) > 0)
);
CREATE TABLE school_faqs (
  faq_id    BIGSERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(tenant_id),
  topic     VARCHAR(60) NOT NULL,
  question  VARCHAR(300) NOT NULL,
  answer    TEXT NOT NULL,
  roles     TEXT[] NOT NULL DEFAULT '{ALL}' CHECK (cardinality(roles) > 0),
  added_by  INTEGER REFERENCES users(user_id),
  added_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Conversion templates (one per menu; the same list for every school) ----------
CREATE TABLE import_templates (
  template_no    INTEGER PRIMARY KEY CHECK (template_no BETWEEN 1 AND 99),
  name           VARCHAR(40) NOT NULL UNIQUE CHECK (name ~ '^[A-Za-z_]+$'),
  file_name      VARCHAR(80) NOT NULL UNIQUE,
  menu_label     VARCHAR(120) NOT NULL,
  entity         VARCHAR(30) NOT NULL,
  description    VARCHAR(300) NOT NULL,
  loads_directly BOOLEAN NOT NULL DEFAULT FALSE,
  CHECK (file_name = lpad(template_no::text, 2, '0') || '_' || name || '_Data.xlsx')
);
CREATE TABLE import_template_columns (
  template_no INTEGER NOT NULL REFERENCES import_templates(template_no) ON DELETE CASCADE,
  col_order   INTEGER NOT NULL,
  heading     VARCHAR(60) NOT NULL,
  required    BOOLEAN NOT NULL,
  format      VARCHAR(200) NOT NULL,
  example     VARCHAR(200),
  notes       VARCHAR(200),
  PRIMARY KEY (template_no, col_order),
  UNIQUE (template_no, heading)
);
-- Which template a file belongs to: NN_Name_Data.xlsx (blank) or NN_Name_Data_<SCHOOL>_<YYYYMMDD>.xlsx (filled in)
CREATE OR REPLACE FUNCTION template_for_file(p_file VARCHAR) RETURNS INTEGER LANGUAGE sql STABLE AS $$
  SELECT t.template_no FROM import_templates t
  WHERE p_file ~* ('^' || lpad(t.template_no::text, 2, '0') || '_' || t.name || '_Data(_[A-Za-z0-9]+_[0-9]{8})?\.(xlsx|xls|csv)$')
$$;
ALTER TABLE import_jobs ADD COLUMN template_no INTEGER REFERENCES import_templates(template_no);

-- Row-level security on the new school tables
DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['school_holidays', 'leave_types', 'app_notifications', 'report_cards', 'buses', 'bus_incidents', 'route_plans', 'help_documents', 'school_faqs'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY tenant_isolation ON %I USING (tenant_id = current_setting('app.tenant_id', true)::int) WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::int)$p$, t);
  END LOOP;
END $$;
INSERT INTO import_templates (template_no, name, file_name, menu_label, entity, description, loads_directly) VALUES
  (1, 'Class_Section', '01_Class_Section_Data.xlsx', 'Academics → Classes & Sections', 'CLASSES', 'Every class and section, with the class teacher and seats.', FALSE),
  (2, 'Student', '02_Student_Data.xlsx', 'Students → All Students', 'STUDENTS', 'One row per student with the main guardian. Siblings share the guardian mobile.', TRUE),
  (3, 'Guardian', '03_Guardian_Data.xlsx', 'Students → All Students (guardians)', 'GUARDIANS', 'Extra guardians (mother, grandparent) beyond the main guardian in 02.', FALSE),
  (4, 'Staff', '04_Staff_Data.xlsx', 'Staff → All Staff', 'STAFF', 'Every employee, teaching and non-teaching.', TRUE),
  (5, 'Staff_Salary', '05_Staff_Salary_Data.xlsx', 'Payroll → Run Payroll', 'SALARY', 'Monthly salary structure per employee.', FALSE),
  (6, 'Leave_Balance', '06_Leave_Balance_Data.xlsx', 'Staff → Leave Requests', 'LEAVE', 'Leave already taken this year, so balances start right.', TRUE),
  (7, 'Fee_Structure', '07_Fee_Structure_Data.xlsx', 'Fees → Fee Structure', 'FEE_STRUCTURE', 'Fee heads and amounts per class for the year.', FALSE),
  (8, 'Fee_Payment_History', '08_Fee_Payment_History_Data.xlsx', 'Fees → Receipts', 'FEE_PAYMENTS', 'Payments already received this year, so dues are right from day one.', FALSE),
  (9, 'Fee_Concession', '09_Fee_Concession_Data.xlsx', 'Fees → Concessions', 'CONCESSIONS', 'Sibling, staff-ward and merit concessions.', FALSE),
  (10, 'Transport_Route', '10_Transport_Route_Data.xlsx', 'Transport → Routes, Stops & Timings', 'ROUTES', 'Each bus route with the bus, driver and attendant.', FALSE),
  (11, 'Transport_Stop', '11_Transport_Stop_Data.xlsx', 'Transport → Routes, Stops & Timings', 'STOPS', 'Stops on each route in order, with times and map location.', FALSE),
  (12, 'Student_Transport', '12_Student_Transport_Data.xlsx', 'Transport → Routes, Stops & Timings (riders)', 'RIDERS', 'Which route and stop each rider uses.', TRUE),
  (13, 'Subject_Teacher', '13_Subject_Teacher_Data.xlsx', 'Academics → Timetable', 'SUBJECT_TEACHERS', 'Who teaches which subject in each section.', FALSE),
  (14, 'Timetable', '14_Timetable_Data.xlsx', 'Academics → Timetable', 'TIMETABLE', 'The weekly timetable, one row per period.', FALSE),
  (15, 'Exam_Marks', '15_Exam_Marks_Data.xlsx', 'Students → Student Profile / Report Cards', 'MARKS', 'Marks already given this year, per student, subject and exam.', TRUE),
  (16, 'Student_Attendance', '16_Student_Attendance_Data.xlsx', 'Students → Attendance', 'ATTENDANCE', 'Daily attendance so far this year, one row per student per day (or monthly totals).', TRUE),
  (17, 'Staff_Attendance', '17_Staff_Attendance_Data.xlsx', 'Staff → Staff Attendance', 'STAFF_ATTENDANCE', 'Staff attendance so far this year.', TRUE),
  (18, 'Admission_Enquiry', '18_Admission_Enquiry_Data.xlsx', 'Students → Admissions & Enquiries', 'ENQUIRIES', 'Open enquiries and applications for next year.', FALSE),
  (19, 'Question_Bank', '19_Question_Bank_Data.xlsx', 'Exams → Question Bank', 'QUESTIONS', 'Questions the teachers already have, tagged by chapter and difficulty.', FALSE),
  (20, 'Bus_Fleet', '20_Bus_Fleet_Data.xlsx', 'Dashboard → Transport', 'BUSES', 'Every school bus, including spares, and its fitness dates.', FALSE);

INSERT INTO import_template_columns (template_no, col_order, heading, required, format, example, notes) VALUES
  (1, 1, 'Class', TRUE, 'TEXT', 'Grade VIII', 'As the school writes it: Nursery, LKG, UKG, Grade I … Grade XII'),
  (1, 2, 'Section', TRUE, 'TEXT', 'A', NULL),
  (1, 3, 'Board', TRUE, 'ENUM:CBSE|ICSE|IB|State', 'CBSE', NULL),
  (1, 4, 'Class teacher employee code', FALSE, 'TEXT', 'EMP-0012', NULL),
  (1, 5, 'Seats', FALSE, 'NUMBER', '40', NULL),
  (1, 6, 'Room', FALSE, 'TEXT', '204', NULL),
  (2, 1, 'Admission no', TRUE, 'TEXT', 'ADM-2019-7701', 'Keep the numbers from your old system'),
  (2, 2, 'First name', TRUE, 'TEXT', 'Riya', NULL),
  (2, 3, 'Last name', FALSE, 'TEXT', 'Kulkarni', NULL),
  (2, 4, 'Date of birth', TRUE, 'DATE', '14/03/2013', NULL),
  (2, 5, 'Gender', TRUE, 'ENUM:Male|Female|Other', 'Female', NULL),
  (2, 6, 'Class', TRUE, 'TEXT', 'Grade VIII', NULL),
  (2, 7, 'Section', TRUE, 'TEXT', 'A', NULL),
  (2, 8, 'Roll no', FALSE, 'NUMBER', '12', NULL),
  (2, 9, 'Date of admission', FALSE, 'DATE', '01/04/2019', NULL),
  (2, 10, 'House', FALSE, 'TEXT', 'Blue', NULL),
  (2, 11, 'Blood group', FALSE, 'TEXT', 'B+', NULL),
  (2, 12, 'Guardian name', TRUE, 'TEXT', 'Anil Kulkarni', NULL),
  (2, 13, 'Guardian relation', TRUE, 'ENUM:Father|Mother|Guardian', 'Father', NULL),
  (2, 14, 'Guardian mobile', TRUE, 'PHONE', '9845011223', NULL),
  (2, 15, 'Guardian email', FALSE, 'EMAIL', 'anil.k@example.com', NULL),
  (2, 16, 'Address', FALSE, 'TEXT', '12, 4th Cross, Indiranagar', NULL),
  (2, 17, 'Transport needed', FALSE, 'YESNO', 'Yes', NULL),
  (3, 1, 'Admission no', TRUE, 'TEXT', 'ADM-2019-7701', NULL),
  (3, 2, 'Guardian name', TRUE, 'TEXT', 'Meena Kulkarni', NULL),
  (3, 3, 'Relation', TRUE, 'ENUM:Father|Mother|Guardian|Grandparent', 'Mother', NULL),
  (3, 4, 'Mobile', TRUE, 'PHONE', '9845011224', NULL),
  (3, 5, 'Email', FALSE, 'EMAIL', 'meena.k@example.com', NULL),
  (3, 6, 'Occupation', FALSE, 'TEXT', 'Doctor', NULL),
  (3, 7, 'Can collect the child', FALSE, 'YESNO', 'Yes', NULL),
  (4, 1, 'Employee code', TRUE, 'TEXT', 'EMP-0012', NULL),
  (4, 2, 'First name', TRUE, 'TEXT', 'Sonia', NULL),
  (4, 3, 'Last name', FALSE, 'TEXT', 'Mehta', NULL),
  (4, 4, 'Gender', TRUE, 'ENUM:Male|Female|Other', 'Female', NULL),
  (4, 5, 'Date of birth', FALSE, 'DATE', '02/05/1988', NULL),
  (4, 6, 'Department', TRUE, 'TEXT', 'English', NULL),
  (4, 7, 'Designation', TRUE, 'TEXT', 'TGT', NULL),
  (4, 8, 'Employment type', TRUE, 'ENUM:Full time|Part time', 'Full time', NULL),
  (4, 9, 'Date of joining', TRUE, 'DATE', '01/06/2019', NULL),
  (4, 10, 'Mobile', TRUE, 'PHONE', '9845012345', NULL),
  (4, 11, 'Email', FALSE, 'EMAIL', 'sonia.m@example.com', NULL),
  (4, 12, 'Short code (timetable)', FALSE, 'TEXT', 'SON', NULL),
  (5, 1, 'Employee code', TRUE, 'TEXT', 'EMP-0012', NULL),
  (5, 2, 'Basic', TRUE, 'AMOUNT', '32000', NULL),
  (5, 3, 'HRA', FALSE, 'AMOUNT', '12800', NULL),
  (5, 4, 'DA', FALSE, 'AMOUNT', '3200', NULL),
  (5, 5, 'Transport allowance', FALSE, 'AMOUNT', '1600', NULL),
  (5, 6, 'PF deduction', FALSE, 'AMOUNT', '3840', NULL),
  (5, 7, 'Tax deduction (TDS)', FALSE, 'AMOUNT', '1500', NULL),
  (5, 8, 'Bank IFSC', FALSE, 'TEXT', 'HDFC0001234', NULL),
  (5, 9, 'Account last 4 digits', FALSE, 'TEXT', '4417', 'Only the last 4 digits are kept'),
  (6, 1, 'Employee code', TRUE, 'TEXT', 'EMP-0012', NULL),
  (6, 2, 'Leave type', TRUE, 'ENUM:Casual leave|Sick leave|Earned leave|Maternity leave|Paternity leave|Compensatory off|Leave without pay', 'Casual leave', NULL),
  (6, 3, 'Days taken this year', TRUE, 'NUMBER', '3', NULL),
  (6, 4, 'Carried forward', FALSE, 'NUMBER', '0', NULL),
  (7, 1, 'Class', TRUE, 'TEXT', 'Grade VIII', NULL),
  (7, 2, 'Fee head', TRUE, 'TEXT', 'Tuition fee', NULL),
  (7, 3, 'Amount for the year', TRUE, 'AMOUNT', '84000', NULL),
  (7, 4, 'Instalments', TRUE, 'ENUM:1|3|4|12', '3', NULL),
  (7, 5, 'First due date', TRUE, 'DATE', '10/04/2026', NULL),
  (8, 1, 'Admission no', TRUE, 'TEXT', 'ADM-2019-7701', NULL),
  (8, 2, 'Receipt no', TRUE, 'TEXT', 'R-0412', NULL),
  (8, 3, 'Date', TRUE, 'DATE', '05/04/2026', NULL),
  (8, 4, 'Amount', TRUE, 'AMOUNT', '28000', NULL),
  (8, 5, 'Mode', TRUE, 'ENUM:Cash|UPI|Card|Bank transfer|Cheque', 'UPI', NULL),
  (8, 6, 'Reference (UTR / cheque no)', FALSE, 'TEXT', '612345678901', NULL),
  (8, 7, 'Instalment', FALSE, 'TEXT', 'Term 1', NULL),
  (9, 1, 'Admission no', TRUE, 'TEXT', 'ADM-2019-7701', NULL),
  (9, 2, 'Concession', TRUE, 'TEXT', 'Sibling', NULL),
  (9, 3, 'Percent', FALSE, 'PERCENT', '10', NULL),
  (9, 4, 'Amount', FALSE, 'AMOUNT', NULL, NULL),
  (9, 5, 'Approved by', FALSE, 'TEXT', 'Principal', NULL),
  (10, 1, 'Route no', TRUE, 'TEXT', 'R1', NULL),
  (10, 2, 'Route name', TRUE, 'TEXT', 'Zone A — Indiranagar', NULL),
  (10, 3, 'Bus registration', TRUE, 'TEXT', 'KA-01-F-4411', NULL),
  (10, 4, 'Seats', TRUE, 'NUMBER', '40', NULL),
  (10, 5, 'Driver name', TRUE, 'TEXT', 'Ramesh K', NULL),
  (10, 6, 'Driver mobile', TRUE, 'PHONE', '9845022001', NULL),
  (10, 7, 'Attendant name', FALSE, 'TEXT', 'Lakshmi B', NULL),
  (10, 8, 'Reaches school (morning)', TRUE, 'TIME', '08:45', NULL),
  (10, 9, 'Leaves school (afternoon)', TRUE, 'TIME', '15:15', NULL),
  (11, 1, 'Route no', TRUE, 'TEXT', 'R1', NULL),
  (11, 2, 'Stop order', TRUE, 'NUMBER', '1', NULL),
  (11, 3, 'Stop name (landmark)', TRUE, 'TEXT', '100 Feet Road', NULL),
  (11, 4, 'Morning pickup', TRUE, 'TIME', '07:35', NULL),
  (11, 5, 'Afternoon drop', TRUE, 'TIME', '16:05', NULL),
  (11, 6, 'Latitude', FALSE, 'NUMBER', '12.9719', NULL),
  (11, 7, 'Longitude', FALSE, 'NUMBER', '77.6412', NULL),
  (12, 1, 'Admission no', TRUE, 'TEXT', 'ADM-2019-7701', NULL),
  (12, 2, 'Route no', TRUE, 'TEXT', 'R1', NULL),
  (12, 3, 'Stop name (landmark)', TRUE, 'TEXT', '100 Feet Road', NULL),
  (12, 4, 'Uses', TRUE, 'ENUM:Both ways|Morning only|Afternoon only', 'Both ways', NULL),
  (13, 1, 'Class', TRUE, 'TEXT', 'Grade VIII', NULL),
  (13, 2, 'Section', TRUE, 'TEXT', 'A', NULL),
  (13, 3, 'Subject', TRUE, 'TEXT', 'Mathematics', NULL),
  (13, 4, 'Employee code', TRUE, 'TEXT', 'EMP-0026', NULL),
  (13, 5, 'Periods per week', FALSE, 'NUMBER', '6', NULL),
  (14, 1, 'Class', TRUE, 'TEXT', 'Grade VIII', NULL),
  (14, 2, 'Section', TRUE, 'TEXT', 'A', NULL),
  (14, 3, 'Day', TRUE, 'ENUM:Mon|Tue|Wed|Thu|Fri|Sat', 'Mon', NULL),
  (14, 4, 'Period', TRUE, 'NUMBER', '1', NULL),
  (14, 5, 'Subject', TRUE, 'TEXT', 'English', NULL),
  (14, 6, 'Employee code', TRUE, 'TEXT', 'EMP-0012', NULL),
  (15, 1, 'Admission no', TRUE, 'TEXT', 'ADM-2019-7701', NULL),
  (15, 2, 'Exam', TRUE, 'ENUM:Periodic Test 1|Half-yearly exam|Periodic Test 2|Annual exam', 'Periodic Test 1', NULL),
  (15, 3, 'Subject', TRUE, 'TEXT', 'Mathematics', NULL),
  (15, 4, 'Marks obtained', TRUE, 'NUMBER', '38', NULL),
  (15, 5, 'Maximum marks', TRUE, 'NUMBER', '50', NULL),
  (16, 1, 'Admission no', TRUE, 'TEXT', 'ADM-2019-7701', NULL),
  (16, 2, 'Date', TRUE, 'DATE', '03/04/2026', 'Or the first day of the month when giving monthly totals'),
  (16, 3, 'Status', FALSE, 'ENUM:Present|Absent|Late|Leave', 'Present', NULL),
  (16, 4, 'Days present (monthly)', FALSE, 'NUMBER', NULL, NULL),
  (16, 5, 'Working days (monthly)', FALSE, 'NUMBER', NULL, NULL),
  (17, 1, 'Employee code', TRUE, 'TEXT', 'EMP-0012', NULL),
  (17, 2, 'Date', TRUE, 'DATE', '03/04/2026', NULL),
  (17, 3, 'Status', TRUE, 'ENUM:Present|Absent|Half day|Leave', 'Present', NULL),
  (18, 1, 'Child name', TRUE, 'TEXT', 'Advik Rao', NULL),
  (18, 2, 'Grade applied for', TRUE, 'TEXT', 'Grade I', NULL),
  (18, 3, 'Parent name', TRUE, 'TEXT', 'Rakesh Rao', NULL),
  (18, 4, 'Mobile', TRUE, 'PHONE', '9845099001', NULL),
  (18, 5, 'Email', FALSE, 'EMAIL', 'rakesh.r@example.com', NULL),
  (18, 6, 'Source', FALSE, 'ENUM:Website|Walk-in|Referral|Social media|School fair', 'Walk-in', NULL),
  (18, 7, 'Status', TRUE, 'ENUM:Enquiry|Submitted|In review|Offered|Enrolled|Opted out', 'Enquiry', NULL),
  (18, 8, 'Enquiry date', TRUE, 'DATE', '12/10/2026', NULL),
  (19, 1, 'Class', TRUE, 'TEXT', 'Grade X', NULL),
  (19, 2, 'Subject', TRUE, 'TEXT', 'Mathematics', NULL),
  (19, 3, 'Chapter', TRUE, 'TEXT', 'Real Numbers', NULL),
  (19, 4, 'Topic', FALSE, 'TEXT', 'Euclid’s division lemma', NULL),
  (19, 5, 'Type', TRUE, 'ENUM:MCQ|True / False|Fill in the blank|One word|Assertion–Reason|Very short|Short|Long|Case-based', 'Short', NULL),
  (19, 6, 'Difficulty', TRUE, 'ENUM:Easy|Medium|Hard', 'Medium', NULL),
  (19, 7, 'Marks', TRUE, 'NUMBER', '3', NULL),
  (19, 8, 'Question', TRUE, 'TEXT', 'Show that any positive odd integer is of the form 4q+1 or 4q+3.', NULL),
  (19, 9, 'Answer', FALSE, 'TEXT', NULL, NULL),
  (19, 10, 'Options (MCQ, separated by |)', FALSE, 'TEXT', NULL, NULL),
  (20, 1, 'Bus registration', TRUE, 'TEXT', 'KA-01-F-4411', NULL),
  (20, 2, 'Seats', TRUE, 'NUMBER', '40', NULL),
  (20, 3, 'Status', TRUE, 'ENUM:In service|Spare|Under repair', 'In service', NULL),
  (20, 4, 'Route no', FALSE, 'TEXT', 'R1', NULL),
  (20, 5, 'Fitness certificate valid until', FALSE, 'DATE', '31/03/2027', NULL),
  (20, 6, 'Insurance valid until', FALSE, 'DATE', '15/01/2027', NULL),
  (20, 7, 'Last service date', FALSE, 'DATE', '10/10/2026', NULL);
