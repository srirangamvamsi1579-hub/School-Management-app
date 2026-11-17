# Database (PostgreSQL 15+)

Run the files in order. Each one builds on the one before.

| Order | File | Adds |
| --- | --- | --- |
| 1 | `001_core_schema.sql` | Roles, users, menus and permissions; staff, students, guardians, classes; fees, invoices, payments; payroll; double-entry ledger; views `v_user_menu`, `v_student_dues`, `v_account_statement` |
| 2 | `002_saas_config.sql` | Plans, limits, feature catalogue (module → sub-menu → function), tenants, subscriptions, per-school overrides, config audit, Power BI report catalogue; `tenant_id` + row-level security on every table |
| 3 | `003_exams.sql` | Boards, textbooks, chapters, topics, question bank, paper formats (CBSE, ICSE, IB, state), papers and sets, approvals, prints, co-scholastic grades; `generate_paper_set()` |
| 4 | `004_theming.sql` | UI templates, theme presets, fonts, versioned school themes, user preferences; contrast functions |
| 5 | `005_payments_timetable_web.sql` | Bank/UPI details, fee request campaigns and messages, email outbox, payment notifications and auto-matching, `apply_payment()`; timetable; website and menu links; fee structure (grade groups, transport bands, payment plans); invoice print view; assessment profiles |
| 6 | `006_templates_import.sql` | Document templates (standard / uploaded / custom, versions, defaults by school, role, user); data import (targets, synonyms, saved mappings, value maps, jobs, rows, commit, rollback) |
| 7 | `007_auth_admissions_analytics.sql` | Sign-up and sign-in support (Pending accounts, one-time codes with SMS gateway placeholder), user management (designation access, personal grants, role-change log, `set_user_role()`), admissions pipeline with status rules and `enrol_applicant()`, marks, subject teachers, transport routes and the Data Analytics views (`v_grade_rankings`, `v_teacher_subject_performance`, `v_transport_route_summary`, `v_admissions_by_grade_status`) |
| 8 | `008_requests_transport_sms.sql` | SMS gateway framework (provider config, DLT templates, outbox, delivery reports), account self-service and deletion, teacher-performance sharing setting, class coordinators, parent pickup / drop / early-leave requests with cut-offs and gate codes, boarding log and `trip_manifest()`, Transport team role |
| 9 | `009_route_sheets_collectors.sql` | No cut-off times; approved pickup people per child (photo, ID last 4, school verification); stop timings and per-route driver route sheets with private links; attendant boarding tracking as an optional platform-switched function |
| 10 | `010_concurrency_fixes.sql` | Fixes found by the concurrency tests: collision-free receipt numbers (`doc_counters`), payment matching re-check and invoice locks, database-enforced one-request-per-day (btree_gist exclusion), seat lock on enrolment, hot-path indexes, `app_context()` for transaction-local school context |
| 11 | `011_requests_website_mobile.sql` | Leave, late arrival, meet-a-teacher and office requests with the right decider; leave and late marks in attendance and the manifest; mobile app switches per school and `v_user_mobile_screens`; push devices removed on account deletion |

```bash
createdb school
for f in 00*.sql; do psql -d school -v ON_ERROR_STOP=1 -f "$f"; done
```

## Rules the database enforces

- Row-level security on `tenant_id` using `current_setting('app.tenant_id', true)`. Connect as a non-owner role; views use `security_invoker`.
- Feature visibility: `v_user_menu` = role permission ∩ `v_tenant_features` (plan defaults + overrides).
- Payments: one receipt per reference (unique per tenant + source + reference); matching by pay token → admission no. in narration → unique amount; every receipt posts a balanced voucher.
- Timetable: a teacher can't be in two entries in the same period; grade-wide blocks can't be overlapped.
- Themes: brand colours are darkened until white text reaches 4.5 : 1 contrast.
- Templates: every save creates a new version.
- Accounts: one-time codes are stored only as a hash, expire in 10 minutes, allow 5 tries; SMS codes stay `GATEWAY_PENDING` until `sms_gateway_config.is_active`.
- Users: only an Admin or someone with the Users screen (by role, designation or grant) can change roles; nobody changes their own; only an Admin gives Admin.
- Parent requests: bus changes auto-confirmed (no cut-offs, 009); pickups and early leaves need a person on the approved list; only the section's coordinators decide; release at the gate needs the matching code (hash stored).
- SMS: nothing is sent until the school's gateway is LIVE; OTP text is blanked after sending; stale OTPs expire on go-live.
- Admissions: only forward one step or to Opted out (reason required); an offer needs birth certificate and photo; every change is kept in `admission_status_history`.

Tested on PostgreSQL 16: all eleven files load cleanly into an empty database. `tests/007_checks.sql` to `011_checks.sql` check the rules (run after loading all files; they roll themselves back).

**Concurrency and load:** `tests/concurrency/run.sh` builds a fresh database with 1,000 students and two schools, then fires simultaneous transactions as a non-superuser role (so row-level security applies): parallel payments, double matching, duplicate requests, double approvals and hand-overs, the last seat, double OTP use, school isolation over a connection pool, and a 100-user load test. Results: `docs/TEST_REPORT.md`.

**API rule:** every request runs `BEGIN; SELECT app_context(:school, :user); …; COMMIT;`. The setting is transaction-local, so a pooled connection never carries one school's context into another request.
