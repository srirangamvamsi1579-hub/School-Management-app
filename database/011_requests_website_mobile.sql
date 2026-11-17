-- =====================================================================
-- 011  Release 5: more parent requests, website links and the mobile app
--      1. New request kinds: LEAVE, LATE_ARRIVAL, MEETING (meet or call a teacher), OTHER (office)
--      2. Who decides: coordinators (early leave, leave), the teacher asked (meeting), the office (other)
--      3. Leave marks attendance LEAVE; a late arrival marks LATE when the gate records it
--      4. Bus manifest knows about leave and late drop-ins
--      5. Mobile app: per-school switch, per-screen switches, device tokens for notifications
--      6. Website admission enquiries
--      Run after 001–010.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Request kinds and their fields
-- ---------------------------------------------------------------------
ALTER TABLE parent_requests DROP CONSTRAINT parent_requests_kind_check;
ALTER TABLE parent_requests ADD CONSTRAINT parent_requests_kind_check
  CHECK (kind IN ('PICKUP','DROP','EARLY_LEAVE','OWN_TRANSPORT','LEAVE','LATE_ARRIVAL','MEETING','OTHER'));
ALTER TABLE parent_requests
  ADD COLUMN arrival_time     TIME,                                         -- LATE_ARRIVAL: when the parent will drop the child
  ADD COLUMN arrived_at       TIMESTAMP,
  ADD COLUMN teacher_staff_id INTEGER REFERENCES staff(staff_id),           -- MEETING: the teacher asked
  ADD COLUMN meet_mode        VARCHAR(20) CHECK (meet_mode IN ('IN_PERSON','PHONE','VIDEO')),
  ADD COLUMN meet_slot        VARCHAR(40),                                  -- parent's preferred time of day
  ADD COLUMN meet_at          TIMESTAMP,                                    -- confirmed by the teacher
  ADD COLUMN office_category  VARCHAR(40),                                  -- OTHER: certificate, TC, ID card, fee query …
  ADD COLUMN reply_note       VARCHAR(200);
ALTER TABLE parent_requests ADD CONSTRAINT leave_needs_reason      CHECK (kind <> 'LEAVE' OR reason IS NOT NULL);
ALTER TABLE parent_requests ADD CONSTRAINT late_arrival_window     CHECK (kind <> 'LATE_ARRIVAL' OR (arrival_time > TIME '08:45' AND arrival_time < TIME '15:00' AND date_to = date_from));
ALTER TABLE parent_requests ADD CONSTRAINT meeting_needs_teacher   CHECK (kind <> 'MEETING' OR (teacher_staff_id IS NOT NULL AND meet_mode IS NOT NULL AND reason IS NOT NULL AND date_to = date_from));
ALTER TABLE parent_requests ADD CONSTRAINT office_needs_details    CHECK (kind <> 'OTHER' OR (office_category IS NOT NULL AND reason IS NOT NULL));
ALTER TABLE parent_requests ADD CONSTRAINT leave_at_most_45_days   CHECK (kind <> 'LEAVE' OR date_to - date_from <= 45);

-- One active request per child, kind and day — except meetings (one per teacher per day) and office requests (any number)
ALTER TABLE parent_requests DROP CONSTRAINT one_active_request_per_day;
ALTER TABLE parent_requests ADD CONSTRAINT one_active_request_per_day
  EXCLUDE USING gist (student_id WITH =, kind WITH =, daterange(date_from, date_to, '[]') WITH &&)
  WHERE (status IN ('SUBMITTED','APPROVED') AND kind NOT IN ('MEETING','OTHER'));
ALTER TABLE parent_requests ADD CONSTRAINT one_meeting_per_teacher_per_day
  EXCLUDE USING gist (student_id WITH =, teacher_staff_id WITH =, daterange(date_from, date_to, '[]') WITH &&)
  WHERE (status IN ('SUBMITTED','APPROVED') AND kind = 'MEETING');

-- Which trips a request changes
CREATE OR REPLACE FUNCTION request_trips(p_kind TEXT) RETURNS TEXT[] LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_kind WHEN 'DROP' THEN ARRAY['AM'] WHEN 'LATE_ARRIVAL' THEN ARRAY['AM']
                     WHEN 'OWN_TRANSPORT' THEN ARRAY['AM','PM'] WHEN 'LEAVE' THEN ARRAY['AM','PM']
                     WHEN 'MEETING' THEN ARRAY[]::text[] WHEN 'OTHER' THEN ARRAY[]::text[] ELSE ARRAY['PM'] END;
$$;
CREATE OR REPLACE FUNCTION request_decider(p_kind TEXT) RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN p_kind IN ('EARLY_LEAVE','LEAVE') THEN 'COORDINATOR' WHEN p_kind = 'MEETING' THEN 'TEACHER'
              WHEN p_kind = 'OTHER' THEN 'OFFICE' ELSE 'AUTO' END;
$$;

-- New request: checks, then bus-only changes and late arrivals are confirmed at once; the rest wait for a person
CREATE OR REPLACE FUNCTION trg_parent_request_new() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_today DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
  IF NEW.date_from < v_today THEN RAISE EXCEPTION 'Pick today or a later date'; END IF;
  IF NEW.kind NOT IN ('MEETING','OTHER') AND EXISTS (SELECT 1 FROM parent_requests r WHERE r.student_id = NEW.student_id AND r.kind = NEW.kind
       AND r.status IN ('SUBMITTED','APPROVED') AND NEW.date_from BETWEEN r.date_from AND r.date_to) THEN
    RAISE EXCEPTION 'There is already a request of this kind for that day';
  END IF;
  IF NEW.kind IN ('PICKUP','EARLY_LEAVE') THEN
    IF NEW.collector_id IS NULL OR NOT EXISTS (SELECT 1 FROM v_approved_collectors c WHERE c.collector_id = NEW.collector_id AND c.student_id = NEW.student_id) THEN
      RAISE EXCEPTION 'Choose a person from the child''s approved pickup list';
    END IF;
    SELECT c.name, c.relation, c.phone INTO NEW.collector_name, NEW.collector_relation, NEW.collector_phone FROM v_approved_collectors c WHERE c.collector_id = NEW.collector_id;
  END IF;
  -- A meeting can only be asked of the child's own subject teachers or class coordinators
  IF NEW.kind = 'MEETING' AND NOT EXISTS (
       SELECT 1 FROM enrollments e
       LEFT JOIN section_subject_teachers t ON t.section_id = e.section_id AND t.year_id = e.year_id AND t.staff_id = NEW.teacher_staff_id
       LEFT JOIN class_coordinators c ON c.section_id = e.section_id AND c.year_id = e.year_id AND c.staff_id = NEW.teacher_staff_id
       WHERE e.student_id = NEW.student_id AND e.status = 'STUDYING' AND (t.staff_id IS NOT NULL OR c.staff_id IS NOT NULL)) THEN
    RAISE EXCEPTION 'Choose one of your child''s teachers';
  END IF;
  IF request_decider(NEW.kind) = 'AUTO' THEN NEW.status := 'APPROVED'; NEW.decided_at := CURRENT_TIMESTAMP; END IF;
  RETURN NEW;
END $$;

-- ---------------------------------------------------------------------
-- 2 + 3. Decisions, by the right person
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS decide_parent_request(INT, INT, BOOLEAN, TEXT);
CREATE OR REPLACE FUNCTION decide_parent_request(p_request INT, p_staff INT, p_approve BOOLEAN, p_note TEXT DEFAULT NULL, p_meet_at TIMESTAMP DEFAULT NULL) RETURNS TEXT
LANGUAGE plpgsql AS $$
DECLARE r parent_requests%ROWTYPE; v_code TEXT; v_who TEXT; v_enr INT; v_status TEXT;
BEGIN
  SELECT * INTO r FROM parent_requests WHERE request_id = p_request FOR UPDATE;      -- second decider waits, then sees the decision
  IF r.status <> 'SUBMITTED' THEN RAISE EXCEPTION 'Already %', lower(r.status); END IF;
  v_who := request_decider(r.kind);
  IF v_who = 'COORDINATOR' AND NOT EXISTS (SELECT 1 FROM class_coordinators c JOIN enrollments e ON e.section_id = c.section_id AND e.year_id = c.year_id
                 WHERE e.student_id = r.student_id AND e.status = 'STUDYING' AND c.staff_id = p_staff) THEN
    RAISE EXCEPTION 'Only this class''s coordinators can decide';
  END IF;
  IF v_who = 'TEACHER' AND p_staff IS DISTINCT FROM r.teacher_staff_id THEN RAISE EXCEPTION 'Only the teacher who was asked can reply'; END IF;
  IF v_who = 'OFFICE' AND NOT EXISTS (SELECT 1 FROM users u JOIN v_user_screens s ON s.user_id = u.user_id AND s.code = 'STU_OFFICE'
                 WHERE u.person_type = 'STAFF' AND u.person_id = p_staff) THEN
    RAISE EXCEPTION 'Only the school office can complete this';
  END IF;
  IF p_approve THEN
    IF v_who = 'TEACHER' AND (p_meet_at IS NULL OR p_meet_at::date < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date) THEN
      RAISE EXCEPTION 'Pick the date and time for the meeting';
    END IF;
    IF r.kind IN ('PICKUP','EARLY_LEAVE') THEN v_code := lpad((floor(random() * 10000))::int::text, 4, '0'); END IF;
    v_status := CASE WHEN v_who = 'OFFICE' THEN 'COMPLETED' ELSE 'APPROVED' END;
    UPDATE parent_requests SET status = v_status, decided_by = p_staff, decided_at = CURRENT_TIMESTAMP, meet_at = p_meet_at, reply_note = p_note,
           gate_code_hash = CASE WHEN v_code IS NOT NULL THEN md5(request_id || ':' || v_code) END WHERE request_id = p_request;
    IF r.kind = 'LEAVE' THEN                                  -- attendance shows Leave on every school day of the leave
      SELECT enrollment_id INTO v_enr FROM enrollments WHERE student_id = r.student_id AND status = 'STUDYING' ORDER BY enrollment_id DESC LIMIT 1;
      INSERT INTO student_attendance (tenant_id, enrollment_id, att_date, status)
      SELECT r.tenant_id, v_enr, d::date, 'LEAVE' FROM generate_series(r.date_from, r.date_to, interval '1 day') d WHERE extract(dow FROM d) <> 0
      ON CONFLICT (enrollment_id, att_date) DO UPDATE SET status = 'LEAVE';
    END IF;
  ELSE
    IF p_note IS NULL THEN RAISE EXCEPTION 'Give a reason for declining'; END IF;
    v_status := 'DECLINED';
    UPDATE parent_requests SET status = 'DECLINED', decided_by = p_staff, decided_at = CURRENT_TIMESTAMP, decline_reason = p_note WHERE request_id = p_request;
  END IF;
  INSERT INTO parent_request_history (tenant_id, request_id, status, actor, note) VALUES (r.tenant_id, p_request, v_status, 'staff:' || p_staff, p_note);
  RETURN v_code;
END $$;

-- Gate: a child the parent said they would drop late has arrived
CREATE OR REPLACE FUNCTION mark_late_arrival(p_request INT, p_user INT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE r parent_requests%ROWTYPE; v_enr INT;
BEGIN
  SELECT * INTO r FROM parent_requests WHERE request_id = p_request FOR UPDATE;
  IF r.kind <> 'LATE_ARRIVAL' OR r.status <> 'APPROVED' THEN RAISE EXCEPTION 'Not an expected late arrival'; END IF;
  UPDATE parent_requests SET status = 'COMPLETED', arrived_at = CURRENT_TIMESTAMP WHERE request_id = p_request;
  SELECT enrollment_id INTO v_enr FROM enrollments WHERE student_id = r.student_id AND status = 'STUDYING' ORDER BY enrollment_id DESC LIMIT 1;
  INSERT INTO student_attendance (tenant_id, enrollment_id, att_date, status, marked_by) VALUES (r.tenant_id, v_enr, r.date_from, 'LATE', p_user)
  ON CONFLICT (enrollment_id, att_date) DO UPDATE SET status = 'LATE', marked_by = p_user;
  INSERT INTO parent_request_history (tenant_id, request_id, status, actor) VALUES (r.tenant_id, p_request, 'ARRIVED', 'user:' || p_user);
END $$;

-- ---------------------------------------------------------------------
-- 4. Bus manifest: leave and late drop-ins
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trip_manifest(p_date DATE, p_direction TEXT)
RETURNS TABLE (route_code VARCHAR, route_name VARCHAR, stop_order INT, stop_name VARCHAR, student_id INT, student_name TEXT, grade VARCHAR, section VARCHAR,
               status TEXT, reason TEXT, boarding VARCHAR)
LANGUAGE sql STABLE SECURITY INVOKER AS $$
  WITH riders AS (
    SELECT tr.code, tr.name AS rname, pp.stop_order, pp.name AS stop, st.student_id, st.first_name || ' ' || COALESCE(st.last_name, '') AS sname,
           c.name AS grade, s.name AS section, e.enrollment_id
    FROM enrollments e
    JOIN students st        ON st.student_id = e.student_id AND st.status = 'ACTIVE'
    JOIN sections s         ON s.section_id = e.section_id
    JOIN classes c          ON c.class_id = s.class_id
    JOIN pickup_points pp   ON pp.point_id = e.pickup_point_id
    JOIN transport_routes tr ON tr.route_id = pp.route_id
    JOIN academic_years y   ON y.year_id = e.year_id AND p_date BETWEEN y.start_date AND y.end_date
    WHERE e.status = 'STUDYING'
  ), req AS (
    SELECT DISTINCT ON (r.student_id) r.student_id, r.status, r.kind, r.leave_time, r.arrival_time, r.reason, r.collector_name, r.collector_relation, r.handed_over_at
    FROM parent_requests r
    WHERE p_date BETWEEN r.date_from AND r.date_to AND p_direction = ANY (request_trips(r.kind)) AND r.status IN ('SUBMITTED','APPROVED','COMPLETED')
    ORDER BY r.student_id, (r.status = 'SUBMITTED'), r.created_at DESC
  )
  SELECT rd.code, rd.rname, rd.stop_order, rd.stop, rd.student_id, rd.sname, rd.grade, rd.section,
    CASE WHEN a.status = 'ABSENT' THEN 'ABSENT' WHEN q.status IN ('APPROVED','COMPLETED') OR a.status = 'LEAVE' THEN 'NOT_BOARDING' WHEN q.status = 'SUBMITTED' THEN 'CHECK' ELSE 'BOARD' END,
    CASE WHEN a.status = 'ABSENT' THEN 'Marked absent today'
         WHEN q.status = 'SUBMITTED' THEN 'Request waiting for coordinator'
         WHEN q.kind = 'LEAVE' OR a.status = 'LEAVE' THEN 'On leave' || COALESCE(' — ' || q.reason, '')
         WHEN q.kind = 'LATE_ARRIVAL' THEN 'Parent dropping at ' || to_char(q.arrival_time, 'HH24:MI')
         WHEN q.kind = 'EARLY_LEAVE' AND q.handed_over_at IS NOT NULL THEN 'Left early at ' || to_char(q.handed_over_at AT TIME ZONE 'Asia/Kolkata', 'HH24:MI') || ' with ' || q.collector_name || ' (' || q.collector_relation || ')'
         WHEN q.kind = 'EARLY_LEAVE' THEN 'Leaving early at ' || to_char(q.leave_time, 'HH24:MI') || ' with ' || q.collector_name
         WHEN q.kind = 'PICKUP' THEN 'Collected in person by ' || q.collector_name || ' (' || q.collector_relation || ')'
         WHEN q.kind = 'DROP' THEN 'Parent dropping in person'
         WHEN q.kind = 'OWN_TRANSPORT' THEN 'Own transport' END,
    b.status
  FROM riders rd
  LEFT JOIN student_attendance a ON a.enrollment_id = rd.enrollment_id AND a.att_date = p_date
  LEFT JOIN req q ON q.student_id = rd.student_id
  LEFT JOIN boarding_log b ON b.enrollment_id = rd.enrollment_id AND b.trip_date = p_date AND b.direction = p_direction
  ORDER BY rd.code, CASE WHEN p_direction = 'AM' THEN rd.stop_order ELSE -rd.stop_order END, rd.sname;
$$;

-- Menus: teachers' meeting inbox and the office inbox
UPDATE menus SET label = 'Requests to School' WHERE code = 'SELF_REQUESTS';
INSERT INTO menus (parent_id, code, label, route, sort_order)
SELECT m.menu_id, v.code, v.label, v.route, v.ord FROM menus m JOIN (VALUES
 ('STUDENTS','STU_MEETINGS','Parent Meetings','/students/meetings',8),
 ('STUDENTS','STU_OFFICE','Office Requests','/students/office',9)
) AS v(parent, code, label, route, ord) ON m.code = v.parent;
INSERT INTO features (parent_id, code, name, kind, menu_id, sort_order)
SELECT pf.feature_id, m.code, m.label, 'SUBMENU', m.menu_id, m.sort_order FROM menus m JOIN features pf ON pf.code = 'STUDENTS' WHERE m.code IN ('STU_MEETINGS','STU_OFFICE');
INSERT INTO plan_features (plan_id, feature_id) SELECT p.plan_id, f.feature_id FROM features f CROSS JOIN plans p WHERE f.code IN ('STU_MEETINGS','STU_OFFICE') ON CONFLICT DO NOTHING;
INSERT INTO role_menu_permissions (role_id, menu_id, can_view, can_create, can_edit, can_delete, can_approve, data_scope)
SELECT r.role_id, m.menu_id, TRUE, FALSE, FALSE, FALSE, TRUE, v.scope
FROM (VALUES ('ADMIN','STU_MEETINGS','ALL'), ('ADMIN','STU_OFFICE','ALL'), ('PRINCIPAL','STU_MEETINGS','ALL'), ('PRINCIPAL','STU_OFFICE','ALL'),
             ('TEACHER','STU_MEETINGS','SELF'), ('FRONT_OFFICE','STU_OFFICE','ALL')) AS v(role, code, scope)
JOIN roles r ON r.code = v.role JOIN menus m ON m.code = v.code ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------
-- 5. Mobile app: one store app for all schools; each school switches it on and picks screens
-- ---------------------------------------------------------------------
CREATE TABLE mobile_screen_catalog (
  code        VARCHAR(30) PRIMARY KEY,          -- a menus.code, or M_HOME
  tab_label   VARCHAR(20) NOT NULL,
  default_on  BOOLEAN NOT NULL,
  locked      BOOLEAN NOT NULL DEFAULT FALSE,   -- cannot be switched off (account deletion must stay reachable)
  sort_order  INTEGER NOT NULL
);
INSERT INTO mobile_screen_catalog VALUES
 ('M_HOME','Home',TRUE,TRUE,1), ('SELF_REQUESTS','Requests',TRUE,FALSE,2), ('SELF_FEES','Fees',TRUE,FALSE,3), ('SELF_CHILD','My child',FALSE,FALSE,4),
 ('ACA_TIMETABLE','Timetable',FALSE,FALSE,5), ('STU_ATT','Attendance',TRUE,FALSE,6), ('STU_REQUESTS','Approvals',TRUE,FALSE,7), ('STU_MEETINGS','Meetings',TRUE,FALSE,8),
 ('STU_GATE','Gate',TRUE,FALSE,9), ('TRN_SHEETS','Route sheet',TRUE,FALSE,10), ('TRN_MANIFEST','Manifest',FALSE,FALSE,11), ('SELF_PROFILE','Account',TRUE,TRUE,12);

CREATE TABLE tenant_mobile_app (
  tenant_id   INTEGER PRIMARY KEY REFERENCES tenants(tenant_id),
  enabled     BOOLEAN NOT NULL DEFAULT FALSE,   -- new schools start with the app off
  updated_by  INTEGER REFERENCES users(user_id),
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE tenant_mobile_screens (
  tenant_id  INTEGER NOT NULL REFERENCES tenants(tenant_id),
  code       VARCHAR(30) NOT NULL REFERENCES mobile_screen_catalog(code),
  enabled    BOOLEAN NOT NULL,
  PRIMARY KEY (tenant_id, code)
);
-- Locked screens cannot be switched off
CREATE OR REPLACE FUNCTION trg_mobile_locked() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NOT NEW.enabled AND (SELECT locked FROM mobile_screen_catalog WHERE code = NEW.code) THEN RAISE EXCEPTION '% must stay on in the mobile app', NEW.code; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER mobile_locked BEFORE INSERT OR UPDATE ON tenant_mobile_screens FOR EACH ROW EXECUTE FUNCTION trg_mobile_locked();

-- What each person sees in the app = school's mobile switches ∩ the same screens the website allows them
CREATE VIEW v_user_mobile_screens WITH (security_invoker = true) AS
SELECT u.tenant_id, u.user_id, c.code, c.tab_label, c.sort_order
FROM users u
JOIN tenant_mobile_app a ON a.tenant_id = u.tenant_id AND a.enabled
CROSS JOIN mobile_screen_catalog c
LEFT JOIN tenant_mobile_screens ts ON ts.tenant_id = u.tenant_id AND ts.code = c.code
WHERE u.status = 'ACTIVE'
  AND (c.locked OR COALESCE(ts.enabled, c.default_on))
  AND (c.code = 'M_HOME' OR EXISTS (SELECT 1 FROM v_user_screens s WHERE s.user_id = u.user_id AND s.code = c.code));

-- Phones registered for notifications; removed when an account is deleted
CREATE TABLE push_devices (
  device_id   BIGSERIAL PRIMARY KEY,
  tenant_id   INTEGER NOT NULL REFERENCES tenants(tenant_id),
  user_id     INTEGER NOT NULL REFERENCES users(user_id),
  platform    VARCHAR(8) NOT NULL CHECK (platform IN ('ANDROID','IOS')),
  token       VARCHAR(400) NOT NULL,
  app_version VARCHAR(20),
  last_seen   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (platform, token)
);
CREATE OR REPLACE FUNCTION trg_user_deleted_devices() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'DELETED' AND OLD.status IS DISTINCT FROM 'DELETED' THEN DELETE FROM push_devices WHERE user_id = NEW.user_id; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER user_deleted_devices AFTER UPDATE OF status ON users FOR EACH ROW EXECUTE FUNCTION trg_user_deleted_devices();

ALTER TABLE tenant_mobile_app ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_mobile_screens ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON tenant_mobile_app USING (tenant_id = current_setting('app.tenant_id', true)::int);
CREATE POLICY tenant_isolation ON tenant_mobile_screens USING (tenant_id = current_setting('app.tenant_id', true)::int);
CREATE POLICY tenant_isolation ON push_devices USING (tenant_id = current_setting('app.tenant_id', true)::int);

INSERT INTO tenant_mobile_app (tenant_id, enabled) VALUES (1, TRUE);

-- ---------------------------------------------------------------------
-- 6. Website: the public admission form records its source; the API rate-limits by IP and uses a hidden spam field
-- ---------------------------------------------------------------------
ALTER TABLE admission_enquiries DROP CONSTRAINT IF EXISTS admission_enquiries_source_check;
ALTER TABLE admission_enquiries ADD CONSTRAINT admission_enquiries_source_check
  CHECK (source IN ('Walk-in','Website','School website','Referral','Social media','School fair','Mobile app'));
