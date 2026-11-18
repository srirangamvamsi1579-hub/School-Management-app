-- =====================================================================
-- 021  Someone coming back: Add user can copy details from an archived account.
--      The archive stays view only; the new account just records which entry it was copied from.
--      Run after 001–020.
-- =====================================================================
ALTER TABLE users ADD COLUMN copied_from_archive BIGINT REFERENCES user_archive(archive_id);

-- What Add user offers to copy: the archived details, with today's state beside them
CREATE OR REPLACE VIEW v_archive_copy WITH (security_invoker = true) AS
SELECT a.archive_id, a.tenant_id, a.full_name, a.sign_in_id, a.email, a.phone, a.role_codes, a.designation, a.deleted_at,
       EXISTS (SELECT 1 FROM v_tenant_profiles p WHERE p.tenant_id = a.tenant_id AND p.code = split_part(a.role_codes, ',', 1)) AS profile_exists,
       (SELECT jsonb_agg(jsonb_build_object('admission_no', k->>'admission_no', 'name', k->>'name', 'grade_then', k->>'grade',
                 'still_enrolled', s.student_id IS NOT NULL)) FROM jsonb_array_elements(a.children) k
          LEFT JOIN students s ON s.tenant_id = a.tenant_id AND s.admission_no = k->>'admission_no' AND s.status = 'ACTIVE') AS children_now,
       EXISTS (SELECT 1 FROM users u WHERE u.tenant_id = a.tenant_id AND u.status <> 'DELETED' AND (lower(u.email) = lower(a.email) OR u.phone = a.phone)) AS contact_in_use
FROM user_archive a;
