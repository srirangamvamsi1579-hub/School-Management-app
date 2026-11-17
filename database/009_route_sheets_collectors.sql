-- =====================================================================
-- 009  No cut-off times for bus changes, stop timings and driver route sheets,
--      optional attendant tracking (platform switch), approved pickup people.
--      Run after 001–008.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. NO CUT-OFFS: bus changes are confirmed whenever they are sent; early leave still needs a coordinator
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_parent_request_new() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_today DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
  IF NEW.date_from < v_today THEN RAISE EXCEPTION 'Pick today or a later date'; END IF;
  IF EXISTS (SELECT 1 FROM parent_requests r WHERE r.student_id = NEW.student_id AND r.kind = NEW.kind AND r.status IN ('SUBMITTED','APPROVED')
             AND NEW.date_from BETWEEN r.date_from AND r.date_to) THEN RAISE EXCEPTION 'There is already a request of this kind for that day'; END IF;
  IF NEW.kind IN ('PICKUP','EARLY_LEAVE') THEN
    IF NEW.collector_id IS NULL OR NOT EXISTS (SELECT 1 FROM v_approved_collectors c WHERE c.collector_id = NEW.collector_id AND c.student_id = NEW.student_id) THEN
      RAISE EXCEPTION 'Choose a person from the child''s approved pickup list';
    END IF;
    SELECT c.name, c.relation, c.phone INTO NEW.collector_name, NEW.collector_relation, NEW.collector_phone FROM v_approved_collectors c WHERE c.collector_id = NEW.collector_id;
  END IF;
  IF NEW.kind <> 'EARLY_LEAVE' THEN NEW.status := 'APPROVED'; NEW.decided_at := CURRENT_TIMESTAMP; END IF;
  RETURN NEW;
END $$;

-- ---------------------------------------------------------------------
-- 2. APPROVED PICKUP PEOPLE (per child)
--    Guardians on the student's record are always approved. Others are added by the parent with a photo and
--    the last 4 digits of a photo ID, and must be checked by the school before they can collect.
-- ---------------------------------------------------------------------
CREATE TABLE authorised_collectors (
  collector_id  SERIAL PRIMARY KEY,
  tenant_id     INTEGER NOT NULL REFERENCES tenants(tenant_id),
  student_id    INTEGER NOT NULL REFERENCES students(student_id),
  name          VARCHAR(120) NOT NULL,
  relation      VARCHAR(30) NOT NULL,
  phone         VARCHAR(10) NOT NULL CHECK (phone ~ '^[6-9][0-9]{9}$'),
  photo_url     VARCHAR(255) NOT NULL,                    -- private S3 object; shown at the gate
  id_type       VARCHAR(20) NOT NULL CHECK (id_type IN ('Aadhaar','Driving licence','Passport','Voter ID','PAN')),
  id_last4      CHAR(4) NOT NULL CHECK (id_last4 ~ '^[0-9]{4}$'),   -- never the full ID number
  valid_until   DATE,
  status        VARCHAR(8) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','VERIFIED','REVOKED')),
  added_by      INTEGER REFERENCES users(user_id),
  verified_by   INTEGER REFERENCES users(user_id),
  verified_at   TIMESTAMP,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (student_id, phone),
  CHECK (status <> 'VERIFIED' OR verified_by IS NOT NULL)
);
-- Guardian ids are offset so both kinds share one id space in the view (guardians: negative ids)
CREATE VIEW v_approved_collectors WITH (security_invoker = true) AS
SELECT ac.tenant_id, ac.student_id, ac.collector_id, ac.name, ac.relation, ac.phone, ac.photo_url, FALSE AS is_guardian
FROM authorised_collectors ac
WHERE ac.status = 'VERIFIED' AND (ac.valid_until IS NULL OR ac.valid_until >= CURRENT_DATE)
UNION ALL
SELECT sg.tenant_id, sg.student_id, -g.guardian_id, g.full_name, initcap(COALESCE(g.relation, 'Guardian')), g.phone, NULL, TRUE
FROM student_guardians sg JOIN guardians g ON g.guardian_id = sg.guardian_id;

ALTER TABLE parent_requests ADD COLUMN collector_id INTEGER;      -- id from v_approved_collectors (negative = guardian on record)

-- ---------------------------------------------------------------------
-- 3. STOP TIMINGS AND DRIVER ROUTE SHEETS
-- ---------------------------------------------------------------------
ALTER TABLE pickup_points ADD COLUMN am_time TIME, ADD COLUMN pm_time TIME;
ALTER TABLE transport_routes ADD COLUMN school_arrive TIME DEFAULT '08:45', ADD COLUMN school_leave TIME DEFAULT '15:15',
                             ADD COLUMN attendant_name VARCHAR(80);

-- Timings must make sense: morning stops in order and before school; afternoon drops after the bus leaves
CREATE OR REPLACE FUNCTION trg_stop_times() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE r transport_routes%ROWTYPE;
BEGIN
  SELECT * INTO r FROM transport_routes WHERE route_id = NEW.route_id;
  IF NEW.am_time IS NOT NULL AND NEW.am_time >= r.school_arrive THEN RAISE EXCEPTION 'Morning pickup at % must be before the bus reaches school (%)', NEW.am_time, r.school_arrive; END IF;
  IF NEW.pm_time IS NOT NULL AND NEW.pm_time <= r.school_leave THEN RAISE EXCEPTION 'Afternoon drop at % must be after the bus leaves school (%)', NEW.pm_time, r.school_leave; END IF;
  IF EXISTS (SELECT 1 FROM pickup_points p WHERE p.route_id = NEW.route_id AND p.point_id <> NEW.point_id AND p.stop_order < NEW.stop_order AND p.am_time >= NEW.am_time) THEN
    RAISE EXCEPTION 'Morning times must get later stop by stop';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER stop_times BEFORE INSERT OR UPDATE OF am_time, pm_time, stop_order ON pickup_points FOR EACH ROW EXECUTE FUNCTION trg_stop_times();

-- Private, per-route, per-day links sent to drivers (token stored as a hash)
CREATE TABLE route_sheet_shares (
  share_id    BIGSERIAL PRIMARY KEY,
  tenant_id   INTEGER NOT NULL REFERENCES tenants(tenant_id),
  route_id    INTEGER NOT NULL REFERENCES transport_routes(route_id),
  sheet_date  DATE NOT NULL,
  token_hash  VARCHAR(64) NOT NULL,
  sent_to     VARCHAR(10) NOT NULL,                         -- the route's driver mobile
  sms_id      BIGINT REFERENCES sms_outbox(sms_id),
  sent_by     INTEGER REFERENCES users(user_id),
  sent_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at  TIMESTAMP NOT NULL,
  UNIQUE (route_id, sheet_date, token_hash)
);

-- Create one share per route for a day and queue the SMS to that route's driver only. Returns the raw tokens for the links.
CREATE OR REPLACE FUNCTION share_route_sheets(p_tenant INT, p_date DATE, p_user INT)
RETURNS TABLE (route_code VARCHAR, driver_phone VARCHAR, token TEXT) LANGUAGE plpgsql AS $$
#variable_conflict use_column
DECLARE r RECORD; v_token TEXT; v_sms BIGINT;
BEGIN
  FOR r IN SELECT * FROM transport_routes WHERE tenant_id = p_tenant AND driver_phone IS NOT NULL ORDER BY code LOOP
    v_token := md5(random()::text || clock_timestamp()::text);
    v_sms := CASE WHEN EXISTS (SELECT 1 FROM sms_templates t WHERE t.tenant_id = p_tenant AND t.purpose = 'ROUTE_SHEET')
                  THEN queue_sms(p_tenant, r.driver_phone, 'ROUTE_SHEET', jsonb_build_object('route', r.code, 'date', to_char(p_date, 'DD-MM-YYYY'), 'link', '/route-sheet/' || r.code || '/' || p_date || '?t=' || v_token), r.code) END;
    INSERT INTO route_sheet_shares (tenant_id, route_id, sheet_date, token_hash, sent_to, sms_id, sent_by, expires_at)
    VALUES (p_tenant, r.route_id, p_date, md5(v_token), r.driver_phone, v_sms, p_user, p_date + INTERVAL '1 day 6 hours');
    route_code := r.code; driver_phone := r.driver_phone; token := v_token; RETURN NEXT;
  END LOOP;
END $$;

-- The driver's page: one route, one day, only with a valid token. Timings come from pickup_points, status from trip_manifest().
CREATE OR REPLACE FUNCTION driver_route_sheet(p_route_code TEXT, p_date DATE, p_token TEXT)
RETURNS TABLE (trip TEXT, stop_time TIME, stop_name VARCHAR, student_name TEXT, grade VARCHAR, section VARCHAR, status TEXT, reason TEXT)
LANGUAGE plpgsql STABLE AS $$
#variable_conflict use_column
BEGIN
  IF NOT EXISTS (SELECT 1 FROM route_sheet_shares s JOIN transport_routes r ON r.route_id = s.route_id
                 WHERE r.code = p_route_code AND s.sheet_date = p_date AND s.token_hash = md5(p_token) AND s.expires_at > CURRENT_TIMESTAMP) THEN
    RAISE EXCEPTION 'Link expired or not valid for this route';
  END IF;
  RETURN QUERY
  SELECT d.dir, CASE WHEN d.dir = 'AM' THEN pp.am_time ELSE pp.pm_time END, m.stop_name, m.student_name, m.grade, m.section, m.status, m.reason
  FROM (VALUES ('AM'), ('PM')) d(dir)
  CROSS JOIN LATERAL trip_manifest(p_date, d.dir) m
  JOIN transport_routes r ON r.code = m.route_code AND r.code = p_route_code
  JOIN pickup_points pp ON pp.route_id = r.route_id AND pp.name = m.stop_name
  ORDER BY d.dir, CASE WHEN d.dir = 'AM' THEN pp.am_time ELSE pp.pm_time END, m.student_name;
END $$;

-- ---------------------------------------------------------------------
-- 4. ATTENDANT BOARDING TRACKING IS OPTIONAL
--    A FUNCTION feature in no plan: the platform team switches it on per school (tenant_feature_overrides).
--    boarding_log only accepts rows for schools where it is on.
-- ---------------------------------------------------------------------
INSERT INTO features (parent_id, code, name, kind, is_addon_eligible, sort_order)
SELECT f.feature_id, 'FN_ATTENDANT_TRACKING', 'Bus attendant boarding tracking (Boarded / No-show)', 'FUNCTION', TRUE, 601 FROM features f WHERE f.code = 'TRANSPORT';

CREATE OR REPLACE FUNCTION trg_boarding_needs_feature() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM v_tenant_features tf WHERE tf.tenant_id = NEW.tenant_id AND tf.code = 'FN_ATTENDANT_TRACKING' AND tf.enabled) THEN
    RAISE EXCEPTION 'Attendant boarding tracking is not switched on for this school';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER boarding_needs_feature BEFORE INSERT OR UPDATE ON boarding_log FOR EACH ROW EXECUTE FUNCTION trg_boarding_needs_feature();

-- ---------------------------------------------------------------------
-- 5. RLS, SMS TEMPLATE, MENU
-- ---------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['authorised_collectors','route_sheet_shares'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY tenant_isolation ON %I USING (tenant_id = current_setting('app.tenant_id', true)::int)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::int)$p$, t);
  END LOOP;
END $$;

ALTER TABLE sms_templates DROP CONSTRAINT sms_templates_purpose_check;
ALTER TABLE sms_templates ADD CONSTRAINT sms_templates_purpose_check CHECK (purpose IN ('OTP','FEE_REMINDER','PICKUP_NOTICE','GATE_CODE','ABSENT_ALERT','ROUTE_SHEET'));
INSERT INTO sms_templates (tenant_id, purpose, body) VALUES (1, 'ROUTE_SHEET', '{{school}} bus {{route}} {{date}}: boarding AM/PM {{board}}, changes {{changes}}. Sheet: {{link}}');

UPDATE menus SET label = 'Routes, Stops & Timings' WHERE code = 'TRN_ROUTES';
INSERT INTO menus (parent_id, code, label, route, sort_order)
SELECT m.menu_id, 'TRN_SHEETS', 'Driver Route Sheets', '/transport/route-sheets', 2 FROM menus m WHERE m.code = 'TRANSPORT';
INSERT INTO features (parent_id, code, name, kind, menu_id, sort_order)
SELECT pf.feature_id, m.code, m.label, 'SUBMENU', m.menu_id, m.sort_order FROM menus m JOIN features pf ON pf.code = 'TRANSPORT' WHERE m.code = 'TRN_SHEETS';
INSERT INTO plan_features (plan_id, feature_id) SELECT p.plan_id, f.feature_id FROM features f CROSS JOIN plans p WHERE f.code = 'TRN_SHEETS' ON CONFLICT DO NOTHING;
INSERT INTO role_menu_permissions (role_id, menu_id, can_view, can_create, can_edit, can_delete, can_approve, data_scope)
SELECT r.role_id, m.menu_id, TRUE, r.code <> 'PRINCIPAL', FALSE, FALSE, FALSE, 'ALL'
FROM roles r JOIN menus m ON m.code = 'TRN_SHEETS' WHERE r.code IN ('ADMIN','PRINCIPAL','TRANSPORT') ON CONFLICT DO NOTHING;
