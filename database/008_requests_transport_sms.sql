-- =====================================================================
-- 008  SMS gateway framework, parent self-service accounts, teacher-performance
--      visibility, class coordinators, parent pickup / drop / early-leave requests,
--      gate handover and daily bus manifests.  Run after 001–007.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. SMS GATEWAY FRAMEWORK
--    Every SMS is written to sms_outbox. A dispatcher (services/sms/dispatcher.mjs)
--    sends QUEUED rows only for schools whose gateway is LIVE; until then they wait.
-- ---------------------------------------------------------------------
ALTER TABLE sms_gateway_config
  ADD COLUMN status               VARCHAR(14) NOT NULL DEFAULT 'NOT_CONNECTED' CHECK (status IN ('NOT_CONNECTED','TESTING','LIVE','SUSPENDED')),
  ADD COLUMN endpoint_url         VARCHAR(255) CHECK (endpoint_url IS NULL OR endpoint_url LIKE 'https://%'),
  ADD COLUMN http_method          VARCHAR(6) DEFAULT 'POST' CHECK (http_method IN ('POST','GET')),
  ADD COLUMN auth_header          VARCHAR(60),
  ADD COLUMN body_template        TEXT,                     -- custom API: JSON with {{to}}, {{message}}, {{template_id}}, {{sender}}, {{entity_id}}
  ADD COLUMN secret_arn           VARCHAR(255),             -- AWS Secrets Manager; the key itself is never stored here
  ADD COLUMN aws_region           VARCHAR(20),
  ADD COLUMN account_user         VARCHAR(80),              -- Gupshup user id / Twilio account SID
  ADD COLUMN messaging_service_id VARCHAR(80),
  ADD COLUMN last_test_at         TIMESTAMP,
  ADD COLUMN last_test_ok         BOOLEAN,
  ADD COLUMN webhook_token        VARCHAR(64) DEFAULT md5(random()::text);
ALTER TABLE sms_gateway_config ADD CONSTRAINT sms_provider_known CHECK (provider IS NULL OR provider IN ('CUSTOM_HTTP','MSG91','AWS_SNS','GUPSHUP','TWILIO'));
ALTER TABLE sms_gateway_config ADD CONSTRAINT sms_live_needs_provider CHECK (status <> 'LIVE' OR (provider IS NOT NULL AND (sender_id IS NOT NULL OR provider = 'TWILIO')));

CREATE TABLE sms_templates (
  tenant_id          INTEGER NOT NULL REFERENCES tenants(tenant_id),
  purpose            VARCHAR(16) NOT NULL CHECK (purpose IN ('OTP','FEE_REMINDER','PICKUP_NOTICE','GATE_CODE','ABSENT_ALERT')),
  body               VARCHAR(500) NOT NULL,              -- must match the DLT-registered text exactly
  dlt_template_id    VARCHAR(30),
  vendor_template_id VARCHAR(60),                        -- e.g. MSG91 flow id
  PRIMARY KEY (tenant_id, purpose)
);

CREATE TABLE sms_outbox (
  sms_id              BIGSERIAL PRIMARY KEY,
  tenant_id           INTEGER NOT NULL REFERENCES tenants(tenant_id),
  destination         VARCHAR(10) NOT NULL CHECK (destination ~ '^[6-9][0-9]{9}$'),
  purpose             VARCHAR(16) NOT NULL,
  body                VARCHAR(500) NOT NULL,              -- OTP bodies are blanked once sent (see trigger)
  vars                JSONB NOT NULL DEFAULT '{}',
  status              VARCHAR(10) NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED','SENT','DELIVERED','FAILED','EXPIRED')),
  attempts            INTEGER NOT NULL DEFAULT 0,
  provider            VARCHAR(12),
  provider_message_id VARCHAR(80),
  last_error          VARCHAR(300),
  related_ref         VARCHAR(40),
  expires_at          TIMESTAMP,                          -- OTPs: 10 minutes
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at             TIMESTAMP, delivered_at TIMESTAMP
);
CREATE INDEX sms_outbox_queue ON sms_outbox (status, created_at) WHERE status = 'QUEUED';
CREATE INDEX ON sms_outbox (provider_message_id);

CREATE TABLE sms_delivery_reports (
  report_id   BIGSERIAL PRIMARY KEY,
  tenant_id   INTEGER NOT NULL REFERENCES tenants(tenant_id),
  provider    VARCHAR(12) NOT NULL,
  provider_message_id VARCHAR(80),
  status      VARCHAR(10) NOT NULL,
  raw         JSONB,
  received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Queue an SMS using the school's template for that purpose
CREATE OR REPLACE FUNCTION queue_sms(p_tenant INT, p_to TEXT, p_purpose TEXT, p_vars JSONB, p_ref TEXT DEFAULT NULL) RETURNS BIGINT
LANGUAGE plpgsql AS $$
DECLARE v_body TEXT; k TEXT; v_id BIGINT;
BEGIN
  SELECT body INTO v_body FROM sms_templates WHERE tenant_id = p_tenant AND purpose = p_purpose;
  IF v_body IS NULL THEN RAISE EXCEPTION 'No SMS template for %', p_purpose; END IF;
  FOR k IN SELECT jsonb_object_keys(p_vars) LOOP v_body := replace(v_body, '{{' || k || '}}', p_vars->>k); END LOOP;
  INSERT INTO sms_outbox (tenant_id, destination, purpose, body, vars, related_ref, expires_at)
  VALUES (p_tenant, right(regexp_replace(p_to, '\D', '', 'g'), 10), p_purpose, v_body, p_vars - 'code', p_ref,
          CASE WHEN p_purpose = 'OTP' THEN CURRENT_TIMESTAMP + INTERVAL '10 minutes' END)
  RETURNING sms_id INTO v_id;
  RETURN v_id;
END $$;

-- Going live: expired OTPs are not sent late
CREATE OR REPLACE FUNCTION trg_sms_go_live() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'LIVE' AND OLD.status IS DISTINCT FROM 'LIVE' THEN
    UPDATE sms_outbox SET status = 'EXPIRED' WHERE tenant_id = NEW.tenant_id AND status = 'QUEUED' AND expires_at < CURRENT_TIMESTAMP;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER sms_go_live AFTER UPDATE OF status ON sms_gateway_config FOR EACH ROW EXECUTE FUNCTION trg_sms_go_live();

-- Codes are not kept in the outbox after sending
CREATE OR REPLACE FUNCTION trg_sms_blank_otp() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.purpose = 'OTP' AND NEW.status IN ('SENT','DELIVERED','FAILED','EXPIRED') THEN NEW.body := regexp_replace(NEW.body, '\d{4,8}', '******', 'g'); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER sms_blank_otp BEFORE UPDATE OF status ON sms_outbox FOR EACH ROW EXECUTE FUNCTION trg_sms_blank_otp();

-- request_otp(): now accepts CHANGE (verify a new email / mobile) and reads the gateway status column
ALTER TABLE otp_requests DROP CONSTRAINT otp_requests_purpose_check;
ALTER TABLE otp_requests ADD CONSTRAINT otp_requests_purpose_check CHECK (purpose IN ('SIGNUP','SIGNIN','RESET','CHANGE'));
CREATE OR REPLACE FUNCTION request_otp(p_tenant INT, p_dest TEXT, p_channel TEXT, p_purpose TEXT, OUT otp_id BIGINT, OUT code TEXT, OUT status TEXT)
LANGUAGE plpgsql AS $$
DECLARE v_recent INT; v_live BOOLEAN;
BEGIN
  SELECT count(*) INTO v_recent FROM otp_requests o WHERE o.tenant_id = p_tenant AND o.destination = p_dest AND o.created_at > CURRENT_TIMESTAMP - INTERVAL '1 hour';
  IF v_recent >= 5 THEN RAISE EXCEPTION 'Too many codes requested — try again in an hour'; END IF;
  UPDATE otp_requests o SET status = 'EXPIRED' WHERE o.tenant_id = p_tenant AND o.destination = p_dest AND o.purpose = p_purpose AND o.status IN ('SENT','GATEWAY_PENDING');
  SELECT g.status = 'LIVE' INTO v_live FROM sms_gateway_config g WHERE g.tenant_id = p_tenant;
  code   := lpad((floor(random() * 1000000))::int::text, 6, '0');
  status := CASE WHEN p_channel = 'SMS' AND NOT COALESCE(v_live, FALSE) THEN 'GATEWAY_PENDING' ELSE 'SENT' END;
  INSERT INTO otp_requests (tenant_id, destination, channel, purpose, code_hash, status)
  VALUES (p_tenant, p_dest, p_channel, p_purpose, md5(p_tenant || ':' || p_dest || ':' || code), status) RETURNING otp_requests.otp_id INTO otp_id;
  IF p_channel = 'SMS' AND EXISTS (SELECT 1 FROM sms_templates t WHERE t.tenant_id = p_tenant AND t.purpose = 'OTP') THEN
    PERFORM queue_sms(p_tenant, p_dest, 'OTP', jsonb_build_object('code', code), 'OTP-' || otp_id);
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2. ACCOUNTS: SELF-SERVICE AND ADMIN CONTROLS
-- ---------------------------------------------------------------------
ALTER TABLE users DROP CONSTRAINT users_status_check;
ALTER TABLE users ADD CONSTRAINT users_status_check CHECK (status IN ('PENDING','ACTIVE','LOCKED','DISABLED','DELETED'));
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP, ADD COLUMN deleted_by INTEGER REFERENCES users(user_id);
ALTER TABLE users DROP CONSTRAINT users_has_login;
ALTER TABLE users ADD CONSTRAINT users_has_login CHECK (status = 'DELETED' OR email IS NOT NULL OR phone IS NOT NULL);

CREATE TABLE user_children (                         -- a parent account can hold several children
  tenant_id  INTEGER NOT NULL REFERENCES tenants(tenant_id),
  user_id    INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(student_id),
  linked_by  INTEGER REFERENCES users(user_id),
  linked_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, student_id)
);
CREATE TABLE notification_prefs (
  user_id INTEGER PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
  tenant_id INTEGER NOT NULL REFERENCES tenants(tenant_id),
  by_email BOOLEAN NOT NULL DEFAULT TRUE, by_sms BOOLEAN NOT NULL DEFAULT TRUE, by_app BOOLEAN NOT NULL DEFAULT TRUE
  -- safety messages (gate codes, absence, transport changes) ignore these and are always sent
);
CREATE TABLE account_requests (
  request_id SERIAL PRIMARY KEY,
  tenant_id  INTEGER NOT NULL REFERENCES tenants(tenant_id),
  user_id    INTEGER NOT NULL REFERENCES users(user_id),
  kind       VARCHAR(12) NOT NULL CHECK (kind IN ('CLOSE','LINK_CHILD')),
  detail     VARCHAR(40),                            -- admission no. for LINK_CHILD
  status     VARCHAR(10) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','DONE','REJECTED')),
  decided_by INTEGER REFERENCES users(user_id), decided_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Close (delete) an account: sign-in and contact details erased; school records (fees, marks) stay
CREATE OR REPLACE FUNCTION close_account(p_actor INT, p_user INT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF NOT can_manage_users(p_actor) THEN RAISE EXCEPTION 'Not allowed to manage users'; END IF;
  IF p_actor = p_user THEN RAISE EXCEPTION 'You cannot delete your own account here'; END IF;
  DELETE FROM user_roles WHERE user_id = p_user;
  DELETE FROM user_children WHERE user_id = p_user;
  DELETE FROM user_menu_grants WHERE user_id = p_user;
  UPDATE users SET status = 'DELETED', full_name = 'Closed account', username = 'deleted-' || user_id, email = NULL, phone = NULL,
         cognito_sub = NULL, password_hash = 'DELETED', deleted_at = CURRENT_TIMESTAMP, deleted_by = p_actor WHERE user_id = p_user;
  UPDATE account_requests SET status = 'DONE', decided_by = p_actor, decided_at = CURRENT_TIMESTAMP WHERE user_id = p_user AND kind = 'CLOSE' AND status = 'PENDING';
  -- the API also calls Cognito AdminDeleteUser for the user pool
END $$;

-- ---------------------------------------------------------------------
-- 3. SCHOOL SETTINGS: TEACHER PERFORMANCE VISIBILITY
-- ---------------------------------------------------------------------
CREATE TABLE tenant_settings (
  tenant_id  INTEGER NOT NULL REFERENCES tenants(tenant_id),
  key        VARCHAR(60) NOT NULL,
  value      JSONB NOT NULL,
  updated_by INTEGER REFERENCES users(user_id),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id, key)
);

-- Only the Principal (role) or the Head of Teaching Staff (designation) may share teacher performance with teachers
CREATE OR REPLACE FUNCTION set_teacher_perf_visibility(p_actor INT, p_shared BOOLEAN) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_tenant INT;
BEGIN
  SELECT tenant_id INTO v_tenant FROM users WHERE user_id = p_actor;
  IF NOT (EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.role_id = ur.role_id WHERE ur.user_id = p_actor AND r.code = 'PRINCIPAL')
       OR EXISTS (SELECT 1 FROM users u JOIN designations d ON d.designation_id = u.designation_id WHERE u.user_id = p_actor AND d.name = 'Head of Teaching Staff')) THEN
    RAISE EXCEPTION 'Only the Principal or the Head of Teaching Staff can change this';
  END IF;
  INSERT INTO tenant_settings (tenant_id, key, value, updated_by) VALUES (v_tenant, 'teacher_perf_shared', to_jsonb(p_shared), p_actor)
  ON CONFLICT (tenant_id, key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = CURRENT_TIMESTAMP;
END $$;

-- What a teacher sees: only their own rows, and only while sharing is on (app.user_id = signed-in user)
CREATE VIEW v_my_teaching_performance WITH (security_invoker = true) AS
SELECT p.* FROM v_teacher_subject_performance p
JOIN users u ON u.person_type = 'STAFF' AND u.person_id = p.staff_id AND u.user_id = NULLIF(current_setting('app.user_id', true), '')::int
WHERE EXISTS (SELECT 1 FROM tenant_settings s WHERE s.tenant_id = p.tenant_id AND s.key = 'teacher_perf_shared' AND s.value = 'true'::jsonb);

-- ---------------------------------------------------------------------
-- 4. CLASS COORDINATORS (primary + secondary per section)
-- ---------------------------------------------------------------------
CREATE TABLE class_coordinators (
  tenant_id  INTEGER NOT NULL REFERENCES tenants(tenant_id),
  year_id    INTEGER NOT NULL REFERENCES academic_years(year_id),
  section_id INTEGER NOT NULL REFERENCES sections(section_id),
  level      VARCHAR(9) NOT NULL CHECK (level IN ('PRIMARY','SECONDARY')),
  staff_id   INTEGER NOT NULL REFERENCES staff(staff_id),
  PRIMARY KEY (year_id, section_id, level),
  UNIQUE (year_id, section_id, staff_id)                -- primary and secondary are different people
);

-- ---------------------------------------------------------------------
-- 5. PARENT REQUESTS: IN-PERSON PICKUP / DROP, EARLY LEAVE, OWN TRANSPORT
-- ---------------------------------------------------------------------
CREATE TABLE parent_requests (
  request_id      SERIAL PRIMARY KEY,
  tenant_id       INTEGER NOT NULL REFERENCES tenants(tenant_id),
  ref_no          VARCHAR(16) NOT NULL,
  student_id      INTEGER NOT NULL REFERENCES students(student_id),
  requested_by    INTEGER NOT NULL REFERENCES users(user_id),
  kind            VARCHAR(14) NOT NULL CHECK (kind IN ('PICKUP','DROP','EARLY_LEAVE','OWN_TRANSPORT')),
  date_from       DATE NOT NULL,
  date_to         DATE NOT NULL,
  leave_time      TIME,
  reason          VARCHAR(200),
  collector_name  VARCHAR(120),
  collector_relation VARCHAR(30),
  collector_phone VARCHAR(10) CHECK (collector_phone IS NULL OR collector_phone ~ '^[6-9][0-9]{9}$'),
  status          VARCHAR(10) NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED','APPROVED','DECLINED','CANCELLED','COMPLETED')),
  gate_code_hash  VARCHAR(64),
  decided_by      INTEGER REFERENCES staff(staff_id),
  decided_at      TIMESTAMP,
  decline_reason  VARCHAR(200),
  handed_over_at  TIMESTAMP,
  handed_over_by  INTEGER REFERENCES users(user_id),
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, ref_no),
  CHECK (date_to >= date_from),
  CHECK (kind <> 'EARLY_LEAVE' OR (leave_time IS NOT NULL AND leave_time < TIME '15:00' AND date_to = date_from)),
  CHECK (kind NOT IN ('PICKUP','EARLY_LEAVE') OR (collector_name IS NOT NULL AND collector_phone IS NOT NULL)),
  CHECK (status <> 'DECLINED' OR decline_reason IS NOT NULL)
);
CREATE INDEX ON parent_requests (tenant_id, date_from, date_to);
CREATE TABLE parent_request_history (
  history_id BIGSERIAL PRIMARY KEY,
  tenant_id  INTEGER NOT NULL REFERENCES tenants(tenant_id),
  request_id INTEGER NOT NULL REFERENCES parent_requests(request_id) ON DELETE CASCADE,
  status     VARCHAR(12) NOT NULL,
  actor      VARCHAR(80),
  note       VARCHAR(200),
  at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Which trips a request affects
CREATE OR REPLACE FUNCTION request_trips(p_kind TEXT) RETURNS TEXT[] LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_kind WHEN 'DROP' THEN ARRAY['AM'] WHEN 'OWN_TRANSPORT' THEN ARRAY['AM','PM'] ELSE ARRAY['PM'] END;
$$;

-- New requests: bus-only changes before the cut-off are approved at once; early leave and late changes wait for a coordinator.
-- Cut-offs: morning trip — 20:00 the evening before; afternoon trip — 12:00 the same day.
CREATE OR REPLACE FUNCTION trg_parent_request_new() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_late BOOLEAN; v_now TIMESTAMP := CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata';
BEGIN
  IF NEW.date_from < v_now::date THEN RAISE EXCEPTION 'Pick today or a later date'; END IF;
  IF EXISTS (SELECT 1 FROM parent_requests r WHERE r.student_id = NEW.student_id AND r.kind = NEW.kind AND r.status IN ('SUBMITTED','APPROVED')
             AND NEW.date_from BETWEEN r.date_from AND r.date_to) THEN RAISE EXCEPTION 'There is already a request of this kind for that day'; END IF;
  v_late := ('AM' = ANY (request_trips(NEW.kind)) AND (NEW.date_from = v_now::date OR (NEW.date_from = v_now::date + 1 AND v_now::time > TIME '20:00')))
         OR ('PM' = ANY (request_trips(NEW.kind)) AND NEW.date_from = v_now::date AND v_now::time > TIME '12:00');
  IF NEW.kind <> 'EARLY_LEAVE' AND NOT v_late THEN NEW.status := 'APPROVED'; NEW.decided_at := CURRENT_TIMESTAMP; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER parent_request_new BEFORE INSERT ON parent_requests FOR EACH ROW EXECUTE FUNCTION trg_parent_request_new();

-- A coordinator (primary or secondary of the child's section) approves or declines. Returns the gate code (approve, pickup/early leave).
CREATE OR REPLACE FUNCTION decide_parent_request(p_request INT, p_staff INT, p_approve BOOLEAN, p_note TEXT DEFAULT NULL) RETURNS TEXT
LANGUAGE plpgsql AS $$
DECLARE r parent_requests%ROWTYPE; v_code TEXT;
BEGIN
  SELECT * INTO r FROM parent_requests WHERE request_id = p_request FOR UPDATE;
  IF r.status <> 'SUBMITTED' THEN RAISE EXCEPTION 'Already %', lower(r.status); END IF;
  IF NOT EXISTS (SELECT 1 FROM class_coordinators c JOIN enrollments e ON e.section_id = c.section_id AND e.year_id = c.year_id
                 WHERE e.student_id = r.student_id AND e.status = 'STUDYING' AND c.staff_id = p_staff) THEN
    RAISE EXCEPTION 'Only this class''s coordinators can decide';
  END IF;
  IF p_approve THEN
    IF r.kind IN ('PICKUP','EARLY_LEAVE') THEN v_code := lpad((floor(random() * 10000))::int::text, 4, '0'); END IF;
    UPDATE parent_requests SET status = 'APPROVED', decided_by = p_staff, decided_at = CURRENT_TIMESTAMP,
           gate_code_hash = CASE WHEN v_code IS NOT NULL THEN md5(request_id || ':' || v_code) END WHERE request_id = p_request;
  ELSE
    IF p_note IS NULL THEN RAISE EXCEPTION 'Give a reason for declining'; END IF;
    UPDATE parent_requests SET status = 'DECLINED', decided_by = p_staff, decided_at = CURRENT_TIMESTAMP, decline_reason = p_note WHERE request_id = p_request;
  END IF;
  INSERT INTO parent_request_history (tenant_id, request_id, status, actor, note) VALUES (r.tenant_id, p_request, CASE WHEN p_approve THEN 'APPROVED' ELSE 'DECLINED' END, 'staff:' || p_staff, p_note);
  RETURN v_code;     -- the API emails / SMSes it to the parent; only the hash is kept
END $$;

-- Gate: hand over only with the right code
CREATE OR REPLACE FUNCTION hand_over_student(p_request INT, p_code TEXT, p_user INT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE r parent_requests%ROWTYPE;
BEGIN
  SELECT * INTO r FROM parent_requests WHERE request_id = p_request FOR UPDATE;
  IF r.status <> 'APPROVED' THEN RAISE EXCEPTION 'Not approved — do not release'; END IF;
  IF r.gate_code_hash IS DISTINCT FROM md5(p_request || ':' || p_code) THEN RAISE EXCEPTION 'Gate code does not match'; END IF;
  UPDATE parent_requests SET status = 'COMPLETED', handed_over_at = CURRENT_TIMESTAMP, handed_over_by = p_user WHERE request_id = p_request;
  INSERT INTO parent_request_history (tenant_id, request_id, status, actor) VALUES (r.tenant_id, p_request, 'HANDED_OVER', 'user:' || p_user);
END $$;

-- ---------------------------------------------------------------------
-- 6. TRANSPORT: DAILY MANIFEST AND BOARDING LOG
-- ---------------------------------------------------------------------
ALTER TABLE pickup_points ADD COLUMN stop_order INTEGER;
CREATE TABLE boarding_log (
  tenant_id     INTEGER NOT NULL REFERENCES tenants(tenant_id),
  trip_date     DATE NOT NULL,
  direction     VARCHAR(2) NOT NULL CHECK (direction IN ('AM','PM')),
  enrollment_id INTEGER NOT NULL REFERENCES enrollments(enrollment_id),
  status        VARCHAR(9) NOT NULL CHECK (status IN ('BOARDED','NO_SHOW')),
  marked_by     INTEGER REFERENCES users(user_id),
  marked_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (trip_date, direction, enrollment_id)
);

-- Who boards which bus on a date and trip, and why someone won't:
-- ABSENT (attendance), NOT_BOARDING (approved / completed request), CHECK (request waiting for a coordinator), BOARD.
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
    SELECT DISTINCT ON (r.student_id) r.student_id, r.status, r.kind, r.leave_time, r.collector_name, r.collector_relation, r.handed_over_at
    FROM parent_requests r
    WHERE p_date BETWEEN r.date_from AND r.date_to AND p_direction = ANY (request_trips(r.kind)) AND r.status IN ('SUBMITTED','APPROVED','COMPLETED')
    ORDER BY r.student_id, (r.status = 'SUBMITTED'), r.created_at DESC
  )
  SELECT rd.code, rd.rname, rd.stop_order, rd.stop, rd.student_id, rd.sname, rd.grade, rd.section,
    CASE WHEN a.status = 'ABSENT' THEN 'ABSENT' WHEN q.status IN ('APPROVED','COMPLETED') THEN 'NOT_BOARDING' WHEN q.status = 'SUBMITTED' THEN 'CHECK' ELSE 'BOARD' END,
    CASE WHEN a.status = 'ABSENT' THEN 'Marked absent today'
         WHEN q.status = 'SUBMITTED' THEN 'Request waiting for coordinator'
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

-- ---------------------------------------------------------------------
-- 7. ROW-LEVEL SECURITY
-- ---------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['sms_templates','sms_outbox','sms_delivery_reports','user_children','notification_prefs','account_requests','tenant_settings',
                           'class_coordinators','parent_requests','parent_request_history','boarding_log'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY tenant_isolation ON %I USING (tenant_id = current_setting('app.tenant_id', true)::int)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::int)$p$, t);
  END LOOP;
END $$;
-- Parents see only requests for their own children
CREATE POLICY parent_own_children ON parent_requests AS RESTRICTIVE
  USING (NOT EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.role_id = ur.role_id WHERE ur.user_id = NULLIF(current_setting('app.user_id', true), '')::int AND r.code = 'PARENT')
         OR student_id IN (SELECT uc.student_id FROM user_children uc WHERE uc.user_id = NULLIF(current_setting('app.user_id', true), '')::int));

-- ---------------------------------------------------------------------
-- 8. ROLE, MENUS, FEATURES, PERMISSIONS, SEED
-- ---------------------------------------------------------------------
INSERT INTO roles (code, name, is_system) VALUES ('TRANSPORT', 'Transport team', TRUE);
INSERT INTO designations (tenant_id, name, is_teaching)
SELECT 1, v.name, v.t FROM (VALUES ('Head of Teaching Staff', TRUE), ('Transport In-charge', FALSE)) AS v(name, t)
WHERE NOT EXISTS (SELECT 1 FROM designations d WHERE d.tenant_id = 1 AND d.name = v.name);

UPDATE menus SET label = 'My Account' WHERE code = 'SELF_PROFILE';
INSERT INTO menus (code, label, route, icon, sort_order) VALUES ('TRANSPORT', 'Transport', NULL, 'bus', 60);
INSERT INTO menus (parent_id, code, label, route, sort_order)
SELECT m.menu_id, v.code, v.label, v.route, v.ord FROM menus m JOIN (VALUES
 ('STUDENTS','STU_REQUESTS','Coordinator Desk','/students/requests',6),
 ('STUDENTS','STU_GATE','Gate Desk','/students/gate',7),
 ('ACADEMICS','ACA_COORD','Class Coordinators','/academics/coordinators',6),
 ('TRANSPORT','TRN_MANIFEST','Daily Bus Manifest','/transport/manifest',1),
 ('TRANSPORT','TRN_CHANGES','Pickup & Drop Changes','/transport/changes',2),
 ('TRANSPORT','TRN_ROUTES','Routes & Riders','/transport/routes',3),
 ('OPERATIONS','OPS_SMS','SMS Gateway','/ops/sms',9),
 ('SELF','SELF_REQUESTS','Pickup & Leave Requests','/me/requests',2),
 ('SELF','SELF_MYPERF','My Teaching Performance','/me/performance',6)
) AS v(parent, code, label, route, ord) ON m.code = v.parent;

INSERT INTO features (code, name, kind, menu_id, sort_order) SELECT code, label, 'MODULE', menu_id, sort_order FROM menus WHERE code = 'TRANSPORT';
INSERT INTO features (parent_id, code, name, kind, menu_id, sort_order)
SELECT pf.feature_id, m.code, m.label, 'SUBMENU', m.menu_id, m.sort_order
FROM menus m JOIN menus pm ON pm.menu_id = m.parent_id JOIN features pf ON pf.code = pm.code
WHERE m.code IN ('STU_REQUESTS','STU_GATE','ACA_COORD','TRN_MANIFEST','TRN_CHANGES','TRN_ROUTES','OPS_SMS','SELF_REQUESTS','SELF_MYPERF');
INSERT INTO plan_features (plan_id, feature_id)
SELECT p.plan_id, f.feature_id FROM features f JOIN (VALUES
 ('TRANSPORT',1),('TRN_MANIFEST',1),('TRN_CHANGES',1),('TRN_ROUTES',1),('STU_REQUESTS',1),('STU_GATE',1),('ACA_COORD',1),('OPS_SMS',1),('SELF_REQUESTS',1),('SELF_MYPERF',2)
) AS v(code, r) ON f.code = v.code JOIN plans p ON p.tier_rank >= v.r ON CONFLICT DO NOTHING;

INSERT INTO role_menu_permissions (role_id, menu_id, can_view, can_create, can_edit, can_delete, can_approve, data_scope)
SELECT r.role_id, m.menu_id, TRUE, v.cr, v.cr, FALSE, v.ap, v.scope
FROM (VALUES
 ('ADMIN','STU_REQUESTS',FALSE,TRUE,'ALL'), ('ADMIN','STU_GATE',TRUE,FALSE,'ALL'), ('ADMIN','ACA_COORD',TRUE,FALSE,'ALL'), ('ADMIN','OPS_SMS',TRUE,FALSE,'ALL'),
 ('ADMIN','TRANSPORT',FALSE,FALSE,'ALL'), ('ADMIN','TRN_MANIFEST',TRUE,FALSE,'ALL'), ('ADMIN','TRN_CHANGES',FALSE,FALSE,'ALL'), ('ADMIN','TRN_ROUTES',TRUE,FALSE,'ALL'),
 ('PRINCIPAL','STU_REQUESTS',FALSE,TRUE,'ALL'), ('PRINCIPAL','ACA_COORD',TRUE,FALSE,'ALL'),
 ('PRINCIPAL','TRANSPORT',FALSE,FALSE,'ALL'), ('PRINCIPAL','TRN_MANIFEST',FALSE,FALSE,'ALL'), ('PRINCIPAL','TRN_CHANGES',FALSE,FALSE,'ALL'), ('PRINCIPAL','TRN_ROUTES',FALSE,FALSE,'ALL'),
 ('TEACHER','STU_REQUESTS',FALSE,TRUE,'OWN_CLASS'),                       -- coordinators only see their sections
 ('FRONT_OFFICE','STU_GATE',TRUE,FALSE,'ALL'), ('FRONT_OFFICE','TRANSPORT',FALSE,FALSE,'ALL'), ('FRONT_OFFICE','TRN_CHANGES',FALSE,FALSE,'ALL'),
 ('TRANSPORT','TRANSPORT',FALSE,FALSE,'ALL'), ('TRANSPORT','TRN_MANIFEST',TRUE,FALSE,'ALL'), ('TRANSPORT','TRN_CHANGES',FALSE,FALSE,'ALL'), ('TRANSPORT','TRN_ROUTES',FALSE,FALSE,'ALL'),
 ('TRANSPORT','SELF',FALSE,FALSE,'SELF'), ('TRANSPORT','SELF_PROFILE',TRUE,FALSE,'SELF'),
 ('PARENT','SELF_REQUESTS',TRUE,FALSE,'OWN_CHILD'), ('PARENT','SELF_PROFILE',TRUE,FALSE,'SELF')
) AS v(role, code, cr, ap, scope)
JOIN roles r ON r.code = v.role JOIN menus m ON m.code = v.code
ON CONFLICT DO NOTHING;
-- SELF_MYPERF is not given to any role: v_my_teaching_performance returns rows only while tenant_settings.teacher_perf_shared is true,
-- and the API adds the menu for teachers at that time (same rule as the app's screensFor()).

INSERT INTO sms_templates (tenant_id, purpose, body) VALUES
 (1,'OTP','{{code}} is your {{school}} verification code. Valid 10 minutes. Do not share.'),
 (1,'FEE_REMINDER','{{school}}: Fee of {{amount}} for {{student}} is due {{date}}. Pay: {{link}}'),
 (1,'PICKUP_NOTICE','{{school}}: {{student}} will not take the bus ({{trip}}) on {{date}}. Reason: {{reason}}.'),
 (1,'GATE_CODE','{{school}}: Early leave for {{student}} at {{time}} approved. Gate code {{code}}. Collector: {{collector}}.'),
 (1,'ABSENT_ALERT','{{school}}: {{student}} is marked absent today ({{date}}). Contact the class coordinator if this is wrong.');
INSERT INTO sms_gateway_config (tenant_id, status) VALUES (1, 'NOT_CONNECTED') ON CONFLICT (tenant_id) DO NOTHING;
