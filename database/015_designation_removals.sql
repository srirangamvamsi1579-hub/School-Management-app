-- =====================================================================
-- 015  User management: a school can remove any designation from a profile, standard ones included
--      - role_designation_removals: designations a school no longer offers for a profile
--      - designations_for() leaves them out (a profile copied from another also drops what was removed there)
--      - remove_role_designation(): refused while someone in the school holds it, or if it is the profile's last one
--      - add_role_designation(): adds a designation, or brings back a removed standard one
--      Run after 001–014.
-- =====================================================================

CREATE TABLE role_designation_removals (
  tenant_id   INTEGER NOT NULL REFERENCES tenants(tenant_id),
  role_code   VARCHAR(30) NOT NULL,
  designation VARCHAR(60) NOT NULL,
  removed_by  INTEGER REFERENCES users(user_id),
  removed_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id, role_code, designation)
);
ALTER TABLE role_designation_removals ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON role_designation_removals
  USING (tenant_id = current_setting('app.tenant_id', true)::int) WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::int);

CREATE OR REPLACE FUNCTION designations_for(p_tenant INTEGER, p_role VARCHAR) RETURNS SETOF VARCHAR
LANGUAGE sql STABLE AS $$
  WITH base AS (
    SELECT p_role AS code
    UNION SELECT b.code FROM roles r JOIN roles b ON b.role_id = r.based_on_role_id WHERE r.code = p_role
  ), offered AS (
    SELECT DISTINCT ON (rd.designation) rd.designation, rd.tenant_id IS NOT NULL AS extra, rd.sort_order, rd.role_code
    FROM role_designations rd JOIN base ON base.code = rd.role_code
    WHERE rd.tenant_id IS NULL OR rd.tenant_id = p_tenant
    ORDER BY rd.designation, extra
  )
  SELECT o.designation FROM offered o
  WHERE NOT EXISTS (                                   -- removed for this profile, or for the profile it was copied from
    SELECT 1 FROM role_designation_removals x
    WHERE x.tenant_id = p_tenant AND x.designation = o.designation
      AND (x.role_code = p_role
           OR (x.role_code IN (SELECT code FROM base WHERE code <> p_role)
               AND NOT EXISTS (SELECT 1 FROM role_designations own WHERE own.tenant_id = p_tenant AND own.role_code = p_role AND own.designation = o.designation))))
  ORDER BY o.extra, o.sort_order, o.designation;
$$;

CREATE OR REPLACE FUNCTION remove_role_designation(p_tenant INTEGER, p_role VARCHAR, p_designation VARCHAR, p_by INTEGER DEFAULT NULL) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE n INTEGER;
BEGIN
  IF p_role = 'PARENT' THEN RAISE EXCEPTION 'Parents have no designation to remove'; END IF;
  IF NOT p_designation IN (SELECT designations_for(p_tenant, p_role)) THEN RETURN; END IF;
  SELECT count(*) INTO n FROM users u JOIN designations d ON d.designation_id = u.designation_id
   WHERE u.tenant_id = p_tenant AND d.name = p_designation
     AND (EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.role_id = ur.role_id WHERE ur.user_id = u.user_id AND r.code = p_role)
          OR (u.requested_role = p_role AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.user_id)));
  IF n > 0 THEN RAISE EXCEPTION '% % “%” — change their designation first', n, CASE WHEN n = 1 THEN 'person has' ELSE 'people have' END, p_designation; END IF;
  IF (SELECT count(*) FROM designations_for(p_tenant, p_role)) <= 1 THEN RAISE EXCEPTION 'A profile needs at least one designation'; END IF;
  DELETE FROM role_designations WHERE tenant_id = p_tenant AND role_code = p_role AND designation = p_designation;
  IF p_designation IN (SELECT designations_for(p_tenant, p_role)) THEN       -- a standard (or inherited) one: record the removal
    INSERT INTO role_designation_removals (tenant_id, role_code, designation, removed_by) VALUES (p_tenant, p_role, p_designation, p_by)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION add_role_designation(p_tenant INTEGER, p_role VARCHAR, p_designation VARCHAR) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  IF p_role = 'PARENT' THEN RAISE EXCEPTION 'Parents have no designation'; END IF;
  IF length(trim(COALESCE(p_designation, ''))) < 2 THEN RAISE EXCEPTION 'Enter a designation'; END IF;
  DELETE FROM role_designation_removals WHERE tenant_id = p_tenant AND role_code = p_role AND lower(designation) = lower(trim(p_designation));
  IF NOT EXISTS (SELECT 1 FROM designations_for(p_tenant, p_role) x WHERE lower(x) = lower(trim(p_designation))) THEN
    INSERT INTO role_designations (tenant_id, role_code, designation, sort_order) VALUES (p_tenant, p_role, trim(p_designation), 100);
  END IF;
END $$;
