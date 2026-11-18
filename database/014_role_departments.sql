-- =====================================================================
-- 014  User management: the department each user profile (role) belongs to
--      - role_departments: standard department per profile; a school can rename it for its own profiles
--      - roles.department for profiles a school adds (custom roles)
--      - department_of(): the department for a profile in a school
--      - v_user_directory gains the department
--      Access by designation (007 designation_menu_access) is no longer edited in the app; existing rows still apply.
--      Run after 001–013.
-- =====================================================================

CREATE TABLE role_departments (
  role_department_id SERIAL PRIMARY KEY,
  tenant_id  INTEGER REFERENCES tenants(tenant_id),          -- NULL = standard for every school
  role_code  VARCHAR(30) NOT NULL,
  department VARCHAR(80) NOT NULL,
  UNIQUE NULLS NOT DISTINCT (tenant_id, role_code)
);
INSERT INTO role_departments (tenant_id, role_code, department) VALUES
 (NULL,'ADMIN','Administration'), (NULL,'PRINCIPAL','School Leadership'), (NULL,'ACCOUNTANT','Accounts & Finance'),
 (NULL,'TEACHER','Academics'), (NULL,'FRONT_OFFICE','Front Office & Admissions'), (NULL,'TRANSPORT','Transport'),
 (NULL,'PARENT','Parents & Guardians');
ALTER TABLE role_departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON role_departments
  USING (tenant_id IS NULL OR tenant_id = current_setting('app.tenant_id', true)::int)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::int);

ALTER TABLE roles ADD COLUMN department VARCHAR(80);         -- profiles a school adds

-- School's own name → the profile's own department (custom) → the department of the profile it was based on → standard
CREATE OR REPLACE FUNCTION department_of(p_tenant INTEGER, p_role VARCHAR) RETURNS VARCHAR
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    (SELECT department FROM role_departments WHERE tenant_id = p_tenant AND role_code = p_role),
    (SELECT department FROM roles WHERE code = p_role AND department IS NOT NULL),
    (SELECT rd.department FROM roles r JOIN roles b ON b.role_id = r.based_on_role_id
       JOIN role_departments rd ON rd.role_code = b.code AND (rd.tenant_id = p_tenant OR rd.tenant_id IS NULL)
     WHERE r.code = p_role ORDER BY rd.tenant_id NULLS LAST LIMIT 1),
    (SELECT department FROM role_departments WHERE tenant_id IS NULL AND role_code = p_role));
$$;

-- Rename a profile's department for one school (one row per school and profile)
CREATE OR REPLACE FUNCTION set_role_department(p_tenant INTEGER, p_role VARCHAR, p_department VARCHAR) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  IF p_role = 'PARENT' THEN RAISE EXCEPTION 'Parents are not part of a school department'; END IF;
  IF length(trim(COALESCE(p_department, ''))) < 2 THEN RAISE EXCEPTION 'Enter a department name'; END IF;
  INSERT INTO role_departments (tenant_id, role_code, department) VALUES (p_tenant, p_role, trim(p_department))
  ON CONFLICT (tenant_id, role_code) DO UPDATE SET department = EXCLUDED.department;
END $$;

DROP VIEW IF EXISTS v_user_directory;
CREATE VIEW v_user_directory WITH (security_invoker = true) AS
SELECT u.user_id, u.tenant_id, COALESCE(u.full_name, u.username) AS name, COALESCE(u.email, u.phone) AS sign_in_id, u.status,
       x.role_code, department_of(u.tenant_id, split_part(x.role_code, ',', 1)) AS department,
       u.requested_role, d.name AS designation, u.linked_admission_no, u.created_at,
       designation_problem(u.user_id) AS designation_problem
FROM users u
LEFT JOIN designations d ON d.designation_id = u.designation_id
CROSS JOIN LATERAL (SELECT COALESCE((SELECT string_agg(r.code, ',' ORDER BY r.code) FROM user_roles ur JOIN roles r ON r.role_id = ur.role_id WHERE ur.user_id = u.user_id), u.requested_role) AS role_code) x;
