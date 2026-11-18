-- =====================================================================
-- 023  Nobody waits for approval
--      Staff register against the staff record (employee code, name, and the email or mobile the school has for them);
--      on a match the account is Active with the role and designation from the record. Parents were already checked
--      against the student record (020). Waiting for approval (PENDING) is no longer a status.
--      Run after 001–022.
-- =====================================================================

-- The role for a staff designation (teaching designations go to Teacher first)
CREATE OR REPLACE FUNCTION role_for_designation(p_tenant INT, p_designation VARCHAR) RETURNS VARCHAR LANGUAGE sql STABLE AS $$
  SELECT r FROM unnest(ARRAY['TEACHER', 'PRINCIPAL', 'ACCOUNTANT', 'FRONT_OFFICE', 'TRANSPORT']) WITH ORDINALITY AS t(r, o)
  WHERE EXISTS (SELECT 1 FROM designations_for(p_tenant, r) d WHERE d = p_designation)
  ORDER BY o LIMIT 1;
$$;

-- Existing pending accounts: staff on the staff record become Active, the rest Locked
UPDATE users u SET status = 'ACTIVE'
WHERE u.status = 'PENDING' AND EXISTS (SELECT 1 FROM staff s WHERE s.tenant_id = u.tenant_id AND s.status = 'ACTIVE' AND (lower(s.email) = lower(u.email) OR s.phone = u.phone));
UPDATE users SET status = 'LOCKED' WHERE status = 'PENDING';
DROP TRIGGER parent_not_pending ON users;
DROP FUNCTION trg_parent_not_pending();
ALTER TABLE users DROP CONSTRAINT users_status_check;
ALTER TABLE users ADD CONSTRAINT users_status_check CHECK (status IN ('ACTIVE', 'LOCKED', 'DELETED'));
ALTER TABLE users ADD COLUMN staff_id INTEGER REFERENCES staff(staff_id);

CREATE OR REPLACE FUNCTION register_staff_via(p_channel VARCHAR, p_tenant INT, p_sign_in VARCHAR, p_first VARCHAR, p_last VARCHAR,
                                              p_employee_code VARCHAR, p_cognito_sub VARCHAR DEFAULT NULL) RETURNS INT
LANGUAGE plpgsql AS $$
DECLARE v_id VARCHAR := lower(trim(p_sign_in)); v_email BOOLEAN := p_sign_in LIKE '%@%'; st staff%ROWTYPE; v_desig VARCHAR; v_role VARCHAR; v_wrong INT; v_user INT;
        typed TEXT[] := regexp_split_to_array(lower(trim(p_first || ' ' || COALESCE(p_last, ''))), '\s+');
BEGIN
  IF p_channel NOT IN ('WEBSITE', 'APP') THEN RAISE EXCEPTION 'Staff register on the website or in the app'; END IF;
  IF EXISTS (SELECT 1 FROM users WHERE tenant_id = p_tenant AND status <> 'DELETED' AND (lower(email) = v_id OR phone = v_id)) THEN RAISE EXCEPTION 'An account already uses this'; END IF;
  SELECT wrong INTO v_wrong FROM parent_signup_checks WHERE tenant_id = p_tenant AND sign_in_id = v_id;
  IF COALESCE(v_wrong, 0) >= 5 THEN RAISE EXCEPTION 'Too many tries with details that don''t match — please contact the school office'; END IF;
  SELECT * INTO st FROM staff WHERE tenant_id = p_tenant AND employee_code = upper(trim(p_employee_code)) AND status = 'ACTIVE';
  SELECT name INTO v_desig FROM designations WHERE designation_id = st.designation_id;
  v_role := role_for_designation(p_tenant, v_desig);
  IF st.staff_id IS NULL OR v_role IS NULL
     OR NOT (typed <@ regexp_split_to_array(lower(st.first_name || ' ' || COALESCE(st.last_name, '')), '\s+') AND lower(st.first_name) = ANY (typed))
     OR NOT (lower(st.email) = v_id OR st.phone = v_id) THEN
    INSERT INTO parent_signup_checks (tenant_id, sign_in_id, wrong) VALUES (p_tenant, v_id, 1)
    ON CONFLICT (tenant_id, sign_in_id) DO UPDATE SET wrong = parent_signup_checks.wrong + 1, last_at = CURRENT_TIMESTAMP;
    RETURN NULL;   -- nothing is created; one message for every mismatch
  END IF;
  DELETE FROM parent_signup_checks WHERE tenant_id = p_tenant AND sign_in_id = v_id;
  INSERT INTO users (tenant_id, username, email, phone, password_hash, status, full_name, login_type, requested_role, designation_id, staff_id,
                     cognito_sub, email_verified, phone_verified, approved_at, consent_at, created_via)
  VALUES (p_tenant, 's-' || p_tenant || '-' || v_id, CASE WHEN v_email THEN v_id END, CASE WHEN v_email THEN st.phone ELSE v_id END, 'COGNITO', 'ACTIVE',
          trim(p_first || ' ' || COALESCE(p_last, '')), CASE WHEN v_email THEN 'EMAIL' ELSE 'MOBILE' END, v_role, st.designation_id, st.staff_id,
          p_cognito_sub, v_email, NOT v_email, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, p_channel)
  RETURNING user_id INTO v_user;
  INSERT INTO user_roles (user_id, role_id) SELECT v_user, role_id FROM roles WHERE code = v_role;
  RETURN v_user;
END $$;
