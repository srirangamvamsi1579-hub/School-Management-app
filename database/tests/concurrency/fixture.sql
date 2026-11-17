-- Test data for the concurrency and load tests (tenant 1). Loaded after all migrations.
SET client_min_messages = warning;
INSERT INTO academic_years (tenant_id, name, start_date, end_date, is_current) VALUES (1, '2026-27', CURRENT_DATE - 100, CURRENT_DATE + 200, TRUE);
INSERT INTO classes (tenant_id, name, level_no) VALUES (1, 'Grade VIII', 8), (1, 'Grade IX', 9);
-- Grade VIII: one section with ONE free seat (seat race). Grade IX: 10 sections, 1,000 students (load).
INSERT INTO sections (tenant_id, class_id, name, capacity) SELECT 1, class_id, 'A', 2 FROM classes WHERE level_no = 8;
INSERT INTO sections (tenant_id, class_id, name, capacity) SELECT 1, c.class_id, 'S' || g, 120 FROM classes c, generate_series(1, 10) g WHERE c.level_no = 9;
INSERT INTO subjects (tenant_id, code, name) VALUES (1, 'MAT', 'Mathematics'), (1, 'ENG', 'English');
INSERT INTO staff (tenant_id, employee_code, first_name, phone, join_date) SELECT 1, 'E' || g, 'Teacher' || g, '98000000' || lpad(g::text, 2, '0'), '2020-06-01' FROM generate_series(1, 20) g;
INSERT INTO users (tenant_id, username, email, password_hash, status) SELECT 1, 'staff' || g, 'staff' || g || '@x.in', 'COGNITO', 'ACTIVE' FROM generate_series(1, 20) g;
INSERT INTO user_roles SELECT u.user_id, r.role_id FROM users u, roles r WHERE u.username = 'staff1' AND r.code = 'ADMIN';
INSERT INTO students (tenant_id, admission_no, first_name, dob, admission_date)
SELECT 1, 'ADM-' || lpad(g::text, 5, '0'), 'Kid' || g, DATE '2012-01-01' + g, '2020-04-01' FROM generate_series(1, 1001) g;
INSERT INTO guardians (tenant_id, full_name, relation, phone, email) SELECT 1, 'Parent' || g, 'FATHER', '9' || lpad(g::text, 9, '0'), 'p' || g || '@example.com' FROM generate_series(1, 1001) g;
INSERT INTO student_guardians (tenant_id, student_id, guardian_id, is_primary) SELECT 1, s.student_id, g.guardian_id, TRUE FROM students s JOIN guardians g ON g.full_name = 'Parent' || substr(s.admission_no, 5)::int;
-- Student 1001 fills one of the two Grade VIII seats; the other 1,000 are in Grade IX
INSERT INTO enrollments (tenant_id, student_id, year_id, section_id)
SELECT 1, s.student_id, y.year_id, CASE WHEN s.admission_no = 'ADM-01001' THEN (SELECT section_id FROM sections WHERE capacity = 2)
                                        ELSE (SELECT section_id FROM sections WHERE name = 'S' || (1 + substr(s.admission_no, 5)::int % 10)) END
FROM students s, academic_years y;
-- Transport: 6 routes, 3 stops each, half the Grade IX students ride
INSERT INTO transport_bands (tenant_id, year_id, band_no) SELECT 1, year_id, g FROM academic_years, generate_series(1, 6) g;
INSERT INTO transport_routes (tenant_id, code, name, capacity, band_id, driver_phone) SELECT 1, 'R' || b.band_no, 'Zone ' || b.band_no, 100, b.band_id, '98450220' || lpad(b.band_no::text, 2, '0') FROM transport_bands b;
INSERT INTO pickup_points (tenant_id, name, band_id, route_id, stop_order, am_time, pm_time)
SELECT 1, r.code || '-stop' || k, r.band_id, r.route_id, k, TIME '07:00' + (k * INTERVAL '15 minutes'), TIME '16:30' - (k * INTERVAL '15 minutes') FROM transport_routes r, generate_series(1, 3) k;
UPDATE enrollments e SET pickup_point_id = (SELECT point_id FROM pickup_points ORDER BY point_id OFFSET (e.student_id % 18) LIMIT 1) WHERE e.student_id % 2 = 0;
-- Coordinators for every section
INSERT INTO class_coordinators SELECT 1, y.year_id, s.section_id, 'PRIMARY', (SELECT staff_id FROM staff WHERE employee_code = 'E1') FROM sections s, academic_years y;
INSERT INTO class_coordinators SELECT 1, y.year_id, s.section_id, 'SECONDARY', (SELECT staff_id FROM staff WHERE employee_code = 'E2') FROM sections s, academic_years y;
-- Fees: one invoice and one fee request message per Grade IX student
INSERT INTO fee_heads (tenant_id, name, frequency, income_account_id) SELECT 1, 'Tuition', 'TERM', account_id FROM ledger_accounts WHERE code = '4000' AND tenant_id = 1;
INSERT INTO fee_invoices (tenant_id, invoice_no, enrollment_id, due_date, gross_amount, net_amount)
SELECT 1, 'INV-' || lpad(e.enrollment_id::text, 6, '0'), e.enrollment_id, CURRENT_DATE + 20, 10000, 10000 FROM enrollments e;
INSERT INTO fee_invoice_items (tenant_id, invoice_id, fee_head_id, amount) SELECT 1, i.invoice_id, (SELECT fee_head_id FROM fee_heads), 10000 FROM fee_invoices i;
INSERT INTO fee_request_campaigns (tenant_id, title, class_ids, due_date, subject_template, body_template)
SELECT 1, 'Term 2', ARRAY[class_id], CURRENT_DATE + 20, 'Fee due', 'Dear {{guardian_name}}' FROM classes WHERE level_no = 9;
INSERT INTO fee_request_messages (tenant_id, campaign_id, student_id, to_email, amount_due, invoice_ids, status)
SELECT 1, (SELECT campaign_id FROM fee_request_campaigns), e.student_id, 'p@example.com', 10000, ARRAY[i.invoice_id], 'SENT'
FROM enrollments e JOIN fee_invoices i ON i.enrollment_id = e.enrollment_id;
-- Admissions: two offered applicants for Grade VIII (one free seat)
INSERT INTO admission_enquiries (tenant_id, app_no, year_id, class_id, child_first, dob, parent_name, parent_phone, docs, status)
SELECT 1, 'APP-' || g, y.year_id, c.class_id, 'Applicant' || g, '2013-03-01', 'Parent', '98765000' || lpad(g::text, 2, '0'), '{"birth_cert":true,"photo":true}', 'SUBMITTED'
FROM academic_years y, classes c, generate_series(1, 2) g WHERE c.level_no = 8;
UPDATE admission_enquiries SET status = 'IN_REVIEW'; UPDATE admission_enquiries SET status = 'OFFERED';
-- A second school, to prove one school never sees another's rows under concurrent load
INSERT INTO tenants (code, name, subdomain, status) VALUES ('OTHER', 'Other School', 'other', 'ACTIVE');
INSERT INTO students (tenant_id, admission_no, first_name, dob, admission_date) SELECT 2, 'OTH-' || g, 'Other' || g, '2012-01-01', '2020-04-01' FROM generate_series(1, 7) g;
-- Application role: not a superuser and not the table owner, so row-level security applies (as in production)
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN CREATE ROLE app_user LOGIN PASSWORD 'app_user_test_only'; END IF; END $$;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO app_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_user;
