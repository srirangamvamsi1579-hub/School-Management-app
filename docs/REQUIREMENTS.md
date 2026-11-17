# School Management Platform — Requirements

As of 17 Nov 2026. Live, editable copy: https://claude.ai/artifact/7s89uC65LFcsiKfvBBeLdy

One platform runs Indian K-12 schools of every size, from under 250 to over 1,000 students. Each school gets only the modules its plan includes, and every person sees only the menus their role allows.

## Expectations

1. **Multi-school SaaS.** One code base and one database. Every row carries the school (tenant) id, and row-level security stops one school seeing another's data.
2. **Configurable like AWS.** The platform team switches modules, sub-menus and functions on or off per school. The plan sets the defaults, and add-ons go on top. This drives pricing.
3. **Role-based menus.** A sub-menu shows only if it is switched on for the school **and** the role has permission.
4. **Insights.** Each main menu has an Insights page backed by an embedded Power BI report, filtered to the school.
5. **Fees end to end.**
   - Fee structure, invoices in the school's format and bank/UPI details.
   - Fee request emails per grade, sent to guardians.
   - Automatic payment matching, receipts, ledger posting and a confirmation email.
6. **Exams.**
   - Board-linked syllabus (CBSE, CISCE, IB, state boards) and a question bank tagged Easy / Intermediate / Tough.
   - Question papers generated in Indian board formats, with approval before printing.
   - Co-scholastic grades and narrative assessment profiles.
7. **School's own formats.** Every printed or sent document uses a template. A school can use the standard one, edit a copy or upload its own, and choose a default per school, role or user.
8. **Easy onboarding.** Existing data comes in from Excel, CSV or photos of registers. Columns are mapped to app fields once and the mapping is saved.
9. **Branding.** Each school picks a layout template, colours and fonts. Colours are checked for readability.
10. **Website.** The app links to the school's existing website, or hosts a simple new one. Website pages can be added as menu items.
11. **Mobile.** Parents and teachers use the app on phones. It is an installable web app (PWA) now; iOS and Android store apps come later from the same code (Capacitor).

### Out of scope for the test build

Real sign-in, real email/SMS sending, the payment gateway, OCR and Power BI embedding all need cloud services. The test build simulates them in the browser so the screens and rules can be tested.

## Users, roles and plans

Seven roles see different menus. Four plans decide which modules a school has. Anything one tier up can be sold as an add-on.

| Role | Who | Main work |
| --- | --- | --- |
| Admin | School office head / IT | Setup, users, roles, templates, data import, branding, website links |
| Principal | Principal, vice principal | Insights, approvals (papers, bank details, leave), fee follow-up |
| Accountant | Accounts staff | Fee collection, fee emails, payment matching, payroll, bank details, statements |
| Teacher | Teaching staff | Attendance, timetable, question bank and papers, co-scholastic grades, profiles |
| Front Office | Reception | Admissions, documents and ID cards, fee counter |
| Parent | Guardian | Child's profile, timetable, fee dues and pay |
| Platform team | Our company | Schools, plans, add-ons, switching modules on and off |

| Plan | Students | Adds |
| --- | --- | --- |
| Starter | Up to 250 | Students, staff, academics, exams, fees, accounts (bank details), operations |
| Growth | 251–500 | Insights, payroll, payment matching, promotions, concessions, custom brand colour, custom templates |
| Professional | 501–1,000 | Account statement, income & expenses, image (OCR) import |
| Enterprise | 1,000+ | Dedicated database option, white-label mobile app, custom fonts |

## Screens by module

11 modules hold 46 screens, and all of them open in the test build. Column-level detail per screen is in the client review PDF (`docs/School_Platform_Client_Review.pdf`), and the visual designs are on the design canvas.

| Module | Screens | Key fields and actions |
| --- | --- | --- |
| Dashboard | Dashboard | Students vs plan limit, staff, fees collected, overdue, needs-attention list, recent activity |
| Students | Insights, All Students, New Admission, Attendance, Promote / Transfer, Documents & ID Cards | Admission no. (generated), name, gender, DOB, class-section, house, guardian name/relation/mobile/email, transport band |
| Staff | Insights, All Staff, Add Staff, Staff Attendance, Leave Requests | Employee code, short code (timetable), department, designation, mobile, email, basic pay |
| Academics | Classes & Sections, Boards Syllabus & Textbooks, Timetable | Board, chapters, topics; timetable cells "SUBJECT TEACHER", grade-wide blocks, teacher clash check |
| Exams | Question Papers, Approved Papers, Question Bank, Paper Formats, Co-Scholastic Grades, Assessment Profiles | Format, chapters, difficulty mix, Sets A/B/C; approve and lock; print; A/B/C grades; subject comments and appreciation card |
| Fees | Insights, Collect Fee, Fee Request Emails, Payment Matching, Dues & Reminders, Receipts, Fee Structure, Concessions | Grades, instalment, due date; source, UTR, narration, amount, match status; invoice and receipt in the school's template |
| Payroll | Run Payroll, Payslips | Basic, HRA, DA, transport, PF, TDS, net; approve and post |
| Accounts | Bank & Payment Details, Account Statement, Income & Expenses | Holder, bank, branch, account (encrypted), IFSC, UPI ID, QR; ledger with running balance |
| Operations | Users, Roles & Permissions, Templates, Data Import, Appearance & Branding, Website & Links, Email & SMS Outbox | Permission grid; template versions and defaults; import mapping; theme; menu links |
| My Space | My Child, Fee Dues & Pay, My Payslips, My Preferences | Parent pay page with online pay or bank transfer + UTR |
| Platform Console | Schools & Plans | Plan per school, module and sub-menu switches, add-ons |

## Database schema summary

PostgreSQL 15+, six migration files loaded in order. Every table carries `tenant_id` with row-level security; the app connects as a non-owner role and sets `app.tenant_id` per request. Full detail: `database/README.md`.

| File | Adds | Key tables, views and functions |
| --- | --- | --- |
| 001_core_schema.sql | Core school data | roles, users, menus, role_menu_permissions, staff, students, guardians, enrollments, fee_heads, invoices, payments, payroll, ledger_accounts, vouchers, voucher_lines; v_user_menu, v_student_dues, v_account_statement |
| 002_saas_config.sql | Plans and configuration | plans, plan_features, features (module → sub-menu → function), tenants, tenant_subscriptions, tenant_feature_overrides, tenant_limit_overrides, config_audit, analytics_reports; v_tenant_features, v_tenant_limits |
| 003_exams.sql | Exams | boards, textbooks, chapters, topics, questions, paper_formats, question_papers, paper_sets, paper_approvals, coscholastic_grades; generate_paper_set() |
| 004_theming.sql | Appearance | ui_templates, theme_presets, tenant_themes (versioned), user_ui_preferences; accessible_shade(), publish_theme() |
| 005_payments_timetable_web.sql | Fees, timetable, website | school_bank_accounts, fee_request_campaigns, fee_request_messages, payment_notifications, email_outbox; bell_periods, timetable_entries, timetable_entry_teachers; website_connections, menu_links; payment_plans, transport_bands; assessment_profiles; apply_payment(), match_payment_notification(), amount_in_words_inr() |
| 006_templates_import.sql | Templates and import | template_categories, template_fields, doc_templates, doc_template_versions, template_defaults; import_targets, import_target_fields, import_profiles, import_column_maps, import_value_maps, import_jobs, import_rows; resolve_template(), render_template(), map_and_validate_import(), commit_student_import(), rollback_student_import() |

The test build keeps the same entities in browser memory (`app/src/data`) and runs the same rules in JavaScript (`app/src/lib/logic.js`).

## Business rules and restrictions

**Access and data**

1. A school never sees another school's rows (row-level security on every table, tested).
2. A menu shows only when it is in the plan or an add-on, is not switched off for the school, and the role has permission. The Platform team sees everything; schools cannot change their own plan.
3. Teachers see guardian mobiles masked (last 4 digits). Fee amounts are hidden from teachers.
4. Every configuration change, approval, payment and import is written to the audit log with who and when.
5. Plan limits: student count is checked against the plan cap (250 / 500 / 1,000); the dashboard shows usage.

**Fees and payments**

1. A fee request goes to the guardian email on file. No email means an SMS with the pay link, and the message is marked SMS.
2. Each request carries a personal pay token. Incoming payments are matched in this order: pay token → admission number in the bank narration → a unique outstanding amount. Anything else waits for a person.
3. A payment reference (UTR / gateway id) is receipted once only; repeats are marked Duplicate.
4. A UTR entered by a parent stays Waiting until the matching bank line arrives.
5. A matched payment creates, in one step: receipt, invoice allocation (oldest due first), balanced voucher (debit bank/cash, credit fee income by head, extra to Fee Advance), remarks on the request and a confirmation email.
6. Bank details change only after a second person (Principal) approves. The account number is stored encrypted and shown masked on screen. IFSC must match `AAAA0XXXXXX`; UPI ID must look like `name@bank`.
7. Amounts in words use the Indian system (lakh, crore), matching the school's invoice.

**Exams**

1. Only Approved questions go into papers. Teacher-added questions go to review first.
2. Sets A, B and C share no question. The difficulty mix and marks per section follow the chosen board format.
3. A paper is Draft → Pending approval → Approved (locked) → Printed. Approved papers can't be edited; a new version is made instead.

**Timetable**

1. A teacher can't be in two places in the same period (clash check).
2. Grade-wide blocks (electives, PT, assemblies) cover every section and can't be overwritten by a section period.

**Templates and import**

1. Uploaded HTML is cleaned: scripts, frames and event handlers are removed.
2. Each template save is a new version; old versions are kept.
3. Import rows with errors are skipped; warnings import with the field blank. Every import can be rolled back as a whole.

**Branding**

1. Brand colours that fail 4.5 : 1 contrast with white text are darkened automatically.
2. Custom colours need Growth or above; custom fonts and white-label apps need Enterprise.

## Templates and data import

**Templates (Operations → Templates).** Eight document types ship with a standard template: fee invoice, fee receipt, fee request email, payment confirmation email, fee reminder SMS, payslip, admission letter and appreciation card. The database seeds 16 types; the rest (timetable, assessment profile, question paper, ID card and others) follow.

1. **Use standard** — nothing to do.
2. **Copy & edit** — edit HTML with `{{placeholders}}` and repeating rows `{{#items}}…{{/items}}`; live preview with sample data.
3. **Upload existing** — HTML is used directly. A PDF, Word file or image is kept as the reference copy, and the layout is rebuilt with placeholders.
4. **Choose who uses it** — the template used is the user's choice, else their role's, else the school default, else the standard.

**Data import (Operations → Data Import).** Students (with guardians) and staff in the test build; fees, marks and payroll history follow the same pattern.

1. **Upload** an Excel (.xlsx), CSV, or a photo (.jpg / .png) of a register. Photos go through Amazon Textract in production; in the test build the rows are typed or pasted.
2. **Map columns.** The app suggests a field for each heading from a synonym list ("Adm No" → admission no., "Father Name" → guardian name). A saved mapping is reused automatically when the headings match.
3. **Transform.** Per field: first word / rest (split a full name), date (DD/MM/YYYY or MM/DD/YYYY, Excel serials), Indian mobile (strip +91 and spaces), upper case, title case.
4. **Map values.** Unknown values ("Boy", "8th", "VIII") are mapped once to app values (Male, Grade VIII) and remembered.
5. **Check.** Each row is OK, Warning or Error, with the reason: missing required field, invalid date, bad mobile, unknown class or section, duplicate in file, already exists.
6. **Import** valid rows. Siblings sharing a guardian mobile get one guardian record. The job can be rolled back.

## Hosting, environments and testing

**Test link now:** [School Management Platform — Test build](https://claude.ai/artifact/Ty6v98Gsnmu9HwVa6Qzqy2). Data stays in the tester's browser; "Reset demo data" starts over. Printing works only on the hosted site, not in this preview.

**Hosting the web app.** The build is a static site (`app/dist`), so it runs on any web host. For AWS, `deploy/aws/static-site.yaml` creates a private S3 bucket and CloudFront with HTTPS and security headers; `deploy/aws/deploy.sh` builds, tests and uploads. Other hosts (Netlify, Vercel, cPanel): upload `app/dist`, or the one-file build `app/dist-single/index.html`.

**Environments.** GitHub Actions (`.github/workflows/deploy.yml`):

1. Every push and pull request: install, run tests, build.
2. Push to main: deploy to **dev** automatically.
3. **Pre-prod**: deploys after a named reviewer approves in GitHub.
4. **Prod**: deploys after a second approval.

One-time setup: create the dev, preprod and prod environments in GitHub, add required reviewers to preprod and prod, and add the secret `AWS_DEPLOY_ROLE_ARN` (an IAM role for GitHub OIDC).

**Production back end (next phase).** Cognito sign-in with OTP, API on ECS Fargate, Aurora PostgreSQL with the six migrations, SES email, an SMS gateway with DLT templates, Razorpay/Cashfree webhooks, Textract for photos, Power BI Embedded for Insights. All run in ap-south-1 (Mumbai).

**Automated tests.** `npm test` runs 8 checks on the business rules: amount in words, payment posting, fee requests and SMS fallback, auto-matching (link, narration, duplicate, unmatched), parent UTR then bank line, import mapping and rollback, paper sets without repeats, templates and sanitising. All pass. A browser run opened every screen for all seven roles with no errors.

**User-testing script.**

- [ ] Admin: Data Import → "Use a sample old-ERP export" → check the row messages → import → roll back from history
- [ ] Accountant: Fee Request Emails → Grade VIII → Preview → Send; then Payment Matching → simulate each kind; check remarks, receipts and the outbox
- [ ] Parent: Fee Dues & Pay → pay online; and pay by bank transfer with a UTR
- [ ] Teacher: Question Papers → generate 3 sets → send for approval; Principal approves
- [ ] Admin: Templates → Copy & edit the invoice → make it the school default → open an invoice in Dues
- [ ] Admin: Appearance → change template and colour → Publish
- [ ] Platform team: switch Payroll off for a school, then sign in as Accountant there

## Open questions

- Payment gateway: Razorpay or Cashfree? Who holds the merchant account, our company or each school?
- SMS provider and DLT sender ID: one for the platform, or per school?
- Which state boards come after Maharashtra, Karnataka, Tamil Nadu, Telangana and Andhra Pradesh, and who loads their chapters and topics?
- Question bank content: written by schools, licensed from a publisher, or AI-drafted then reviewed?
- Data retention for students who leave (and for rolled-back imports).
- Plan prices per tier and add-on, to fill `plan_prices`.
