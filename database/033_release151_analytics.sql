-- =====================================================================
-- 033  Release 15.1: every analytic moves into Data Analytics, with full reports.
--      • New Data Analytics screens: Attendance, Exam Results, Timetable & Cover, Syllabus Coverage,
--        Parent Communication, Campus Trends; Student, Staff and Fee Insights move under Data Analytics.
--      • Service Provider › Sales Analytics (proposal and market KPIs).
--      • The Data analytics add-on opens the new screens.
--      • Decision on QA finding F13: the Accounts & Finance department does not open Student Profile by
--        default. A school can still give it to a person or the department by hand.
--      • The nine enhancements from the QA cycle are roadmap items with the new status 'Backlog'.
--      Run after 001–032.
-- =====================================================================

-- ---------- Menus ----------
INSERT INTO menus (parent_id, code, label, route, sort_order)
SELECT p.menu_id, v.code, v.label, v.route, v.ord FROM (VALUES
  ('ANALYTICS', 'ANL_ATTENDANCE', 'Attendance', '/analytics/attendance', 6),
  ('ANALYTICS', 'ANL_EXAMS', 'Exam Results', '/analytics/exams', 7),
  ('ANALYTICS', 'ANL_TIMETABLE', 'Timetable & Cover', '/analytics/timetable', 8),
  ('ANALYTICS', 'ANL_ACADEMICS', 'Syllabus Coverage', '/analytics/syllabus', 9),
  ('ANALYTICS', 'ANL_COMMS', 'Parent Communication', '/analytics/communication', 12),
  ('ANALYTICS', 'ANL_CAMPUS', 'Campus Trends', '/analytics/campus', 13),
  ('SERVICE_PROVIDER', 'SP_ANALYTICS', 'Sales Analytics', '/provider/analytics', 5)
) AS v(parent, code, label, route, ord) JOIN menus p ON p.code = v.parent
WHERE NOT EXISTS (SELECT 1 FROM menus WHERE code = v.code);

-- The three Insights screens move under Data Analytics (same screen, same permissions)
UPDATE menus m SET parent_id = a.menu_id, route = v.route, label = v.label
FROM (VALUES ('STU_INS', '/analytics/students', 'Student Insights'), ('STF_INS', '/analytics/staff', 'Staff Insights'), ('FEE_INS', '/analytics/fees', 'Fee Insights')) AS v(code, route, label),
     menus a
WHERE m.code = v.code AND a.code = 'ANALYTICS';

-- Sales Analytics: the same people as the other company menus, and kept from everyone else
INSERT INTO role_menu_permissions (role_id, menu_id, can_view, can_create, can_edit, data_scope)
SELECT r.role_id, m.menu_id, TRUE, FALSE, FALSE, 'ALL' FROM roles r, menus m
WHERE r.code IN ('PLATFORM', 'SALES', 'ADMIN') AND r.tenant_id IS NULL AND m.code = 'SP_ANALYTICS'
ON CONFLICT (role_id, menu_id) DO NOTHING;
CREATE OR REPLACE VIEW v_user_screens_effective WITH (security_invoker = true) AS
  SELECT s.* FROM v_user_screens s
  WHERE s.code NOT IN ('SP_RATES', 'SP_PROPOSAL', 'SP_DEMO', 'SP_DELIVERY', 'SP_ANALYTICS', 'SP_COMPARE', 'SP_MARKET') OR provider_menu_allowed(s.user_id);

-- ---------- Standard profiles ----------
INSERT INTO role_menu_permissions (role_id, menu_id, can_view, can_create, can_edit, data_scope)
SELECT r.role_id, m.menu_id, TRUE, FALSE, FALSE, v.scope FROM (VALUES
  ('ADMIN', 'ANL_ATTENDANCE', 'ALL'), ('ADMIN', 'ANL_EXAMS', 'ALL'), ('ADMIN', 'ANL_TIMETABLE', 'ALL'), ('ADMIN', 'ANL_ACADEMICS', 'ALL'), ('ADMIN', 'ANL_COMMS', 'ALL'), ('ADMIN', 'ANL_CAMPUS', 'ALL'),
  ('PRINCIPAL', 'ANL_ATTENDANCE', 'ALL'), ('PRINCIPAL', 'ANL_EXAMS', 'ALL'), ('PRINCIPAL', 'ANL_TIMETABLE', 'ALL'), ('PRINCIPAL', 'ANL_ACADEMICS', 'ALL'), ('PRINCIPAL', 'ANL_COMMS', 'ALL'), ('PRINCIPAL', 'ANL_CAMPUS', 'ALL'),
  ('ACCOUNTANT', 'STF_INS', 'ALL'),
  ('TEACHER', 'ANL_HOME', 'OWN_CLASS'), ('TEACHER', 'ANL_EXAMS', 'OWN_CLASS'), ('TEACHER', 'ANL_ATTENDANCE', 'OWN_CLASS'), ('TEACHER', 'ANL_ACADEMICS', 'OWN_CLASS')
) AS v(role, menu, scope) JOIN roles r ON r.code = v.role AND r.tenant_id IS NULL JOIN menus m ON m.code = v.menu
ON CONFLICT (role_id, menu_id) DO NOTHING;

-- Departments already in use get the new screens their profiles have by default
INSERT INTO department_menu_permissions (tenant_id, department, menu_id)
SELECT DISTINCT d.tenant_id, d.department, rmp.menu_id
FROM department_menu_permissions d
JOIN role_departments rd ON rd.department = d.department AND (rd.tenant_id = d.tenant_id OR rd.tenant_id IS NULL)
JOIN roles r ON r.code = rd.role_code AND r.tenant_id IS NULL
JOIN role_menu_permissions rmp ON rmp.role_id = r.role_id
JOIN menus m ON m.menu_id = rmp.menu_id AND m.code IN ('ANL_ATTENDANCE', 'ANL_EXAMS', 'ANL_TIMETABLE', 'ANL_ACADEMICS', 'ANL_COMMS', 'ANL_CAMPUS', 'STF_INS', 'ANL_HOME')
ON CONFLICT DO NOTHING;

-- ---------- F13: Accounts & Finance without Student Profile by default (one time; a later grant by hand stays) ----------
DELETE FROM department_menu_permissions d USING menus m
WHERE d.menu_id = m.menu_id AND m.code = 'STU_PROFILE'
  AND d.department IN (SELECT department FROM role_departments WHERE role_code = 'ACCOUNTANT');
DELETE FROM role_menu_permissions rmp USING roles r, menus m
WHERE rmp.role_id = r.role_id AND r.code = 'ACCOUNTANT' AND r.tenant_id IS NULL AND rmp.menu_id = m.menu_id AND m.code = 'STU_PROFILE';

-- ---------- The Data analytics add-on opens the new screens ----------
UPDATE sales_addons SET menu_codes = ARRAY(SELECT DISTINCT unnest(menu_codes || '{ANL_ATTENDANCE,ANL_EXAMS,ANL_TIMETABLE,ANL_ACADEMICS,ANL_COMMS,ANL_CAMPUS}'::TEXT[]) ORDER BY 1)
WHERE addon_code = 'ANALYTICS';

-- ---------- Backlog: enhancements from the QA cycle, not built yet ----------
ALTER TABLE roadmap_items DROP CONSTRAINT IF EXISTS roadmap_items_status_check;
ALTER TABLE roadmap_items ADD CONSTRAINT roadmap_items_status_check CHECK (status IN ('Backlog', 'Idea', 'Planned', 'In progress', 'Released'));
INSERT INTO roadmap_items (code, title, why, seen_at, country, priority, effort, status) VALUES
  ('QA_API_RULES', 'Business rules in the API layer too', 'Imports and integrations must not bypass the checks the forms make.', 'QA cycle, Nov 2026', 'Internal', 'Now', 'M', 'Backlog'),
  ('QA_PLAN_RECORD', 'Plan and add-on record per school', 'One source for billing and menus; shown in Schools & plans.', 'QA cycle, Nov 2026', 'Internal', 'Now', 'M', 'Backlog'),
  ('QA_MERGE', 'Merge duplicate students and enquiries', 'Duplicates saved with "Save anyway" need a clean-up tool.', 'QA cycle, Nov 2026', 'Internal', 'Now', 'M', 'Backlog'),
  ('QA_INLINE', 'Field messages next to each field', 'Faster data entry: every problem shown at once, where it is.', 'QA cycle, Nov 2026', 'Internal', 'Next', 'M', 'Backlog'),
  ('QA_OVERPAY', 'Confirm unusually large fee amounts', 'Fewer cash-entry errors at the counter.', 'QA cycle, Nov 2026', 'Internal', 'Next', 'S', 'Backlog'),
  ('QA_AGERULE', 'Age-for-class settings per school and board', 'States set different age cut-offs for Grade I.', 'QA cycle, Nov 2026', 'Internal', 'Next', 'S', 'Backlog'),
  ('QA_ADDCOPIES', '"Add copies" from the duplicate-book message', 'One click instead of finding the book.', 'QA cycle, Nov 2026', 'Internal', 'Next', 'S', 'Backlog'),
  ('QA_CAPS', 'Offer name capitalisation before saving', 'Tidy records, shown to the user first.', 'QA cycle, Nov 2026', 'Internal', 'Later', 'S', 'Backlog'),
  ('QA_ALERTS', 'Screen-reader alerts for form errors', 'Accessibility: errors announced as they appear.', 'QA cycle, Nov 2026', 'Internal', 'Later', 'S', 'Backlog')
ON CONFLICT (code) DO NOTHING;
