# School Management Platform — Requirements

Updated 17 Nov 2026 (release 2: sign-in, user management, admissions, Data Analytics). Live, editable copy: https://claude.ai/artifact/7s89uC65LFcsiKfvBBeLdy

One platform runs Indian K-12 schools of every size, from under 250 to over 1,000 students. Each school gets only the modules its plan includes, and every person sees only the menus their role allows.

## Expectations

1. **Multi-school SaaS.** One code base and one database. Every row carries the school (tenant) id, and row-level security stops one school seeing another's data.
2. **Configurable like AWS.** The platform team switches modules, sub-menus and functions on or off per school. The plan sets the defaults, and add-ons go on top. This drives pricing.
3. **Role-based menus.** A sub-menu shows only if it is switched on for the school **and** the person's role, designation or personal grant allows it.
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
12. **Own sign-in page per school.** Each client gets its own sign-in page and accounts. People create an account Gmail-style with a Gmail/email or mobile number, verify it with a one-time code, set a password and wait for the school to approve. Account details go to their Gmail. OTP by SMS is built as a workflow and switches on when an SMS gateway is connected.
13. **User management.** An Admin, or anyone given the Users screen by designation or personally, approves sign-ups and changes roles, designations and status. Schools can add their own roles.
14. **Admissions.** Enquiries and application forms move through Enquiry → Submitted → In review → Offered → Enrolled, or Opted out, with a summary by grade.
15. **Data Analytics.** A separate menu of Power BI reports: top 6 and bottom 6 per grade (sections together or picked), transport, teacher performance and the admissions funnel.

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

12 modules hold 52 screens plus the sign-in pages, and all of them open in the test build. Column-level detail per screen is in the client review PDF (`docs/School_Platform_Client_Review.pdf`), and the visual designs are on the design canvas.

| Module | Screens | Key fields and actions |
| --- | --- | --- |
| Dashboard | Dashboard | Students vs plan limit, staff, fees collected, overdue, needs-attention list, recent activity |
| Students | Insights, All Students, Admissions & Enquiries, New Admission, Attendance, Promote / Transfer, Documents & ID Cards | Admission no. (generated), name, gender, DOB, class-section, house, guardian name/relation/mobile/email, transport band |
| Staff | Insights, All Staff, Add Staff, Staff Attendance, Leave Requests | Employee code, short code (timetable), department, designation, mobile, email, basic pay |
| Academics | Classes & Sections, Boards Syllabus & Textbooks, Timetable | Board, chapters, topics; timetable cells "SUBJECT TEACHER", grade-wide blocks, teacher clash check |
| Exams | Question Papers, Approved Papers, Question Bank, Paper Formats, Co-Scholastic Grades, Assessment Profiles | Format, chapters, difficulty mix, Sets A/B/C; approve and lock; print; A/B/C grades; subject comments and appreciation card |
| Fees | Insights, Collect Fee, Fee Request Emails, Payment Matching, Dues & Reminders, Receipts, Fee Structure, Concessions | Grades, instalment, due date; source, UTR, narration, amount, match status; invoice and receipt in the school's template |
| Data Analytics | Report Catalogue, Top & Bottom Performers, Transport Reports, Teacher Performance, Admissions Funnel | Grade, sections, term, subject filters; Power BI pages |
| Payroll | Run Payroll, Payslips | Basic, HRA, DA, transport, PF, TDS, net; approve and post |
| Accounts | Bank & Payment Details, Account Statement, Income & Expenses | Holder, bank, branch, account (encrypted), IFSC, UPI ID, QR; ledger with running balance |
| Operations | Users, Roles & Permissions, Templates, Data Import, Appearance & Branding, Website & Links, Email & SMS Outbox | Permission grid; template versions and defaults; import mapping; theme; menu links |
| My Space | My Child, Fee Dues & Pay, My Payslips, My Preferences | Parent pay page with online pay or bank transfer + UTR |
| Platform Console | Schools & Plans | Plan per school, module and sub-menu switches, add-ons |

## Accounts and sign-in

Each school (client) has its own sign-in page at `<school>.yourapp.com`, branded with its name, and its own set of accounts.

| Page | What happens |
| --- | --- |
| Sign in | Gmail/email or mobile + password. Or "Sign in with a code": a 6-digit code to the email (or by SMS once connected). Or "Forgot password": code, then a new password. |
| Create account — 1. Name | First and last name. |
| 2. Sign-in ID | A Gmail/email address **or** a 10-digit Indian mobile (+91 and spaces are accepted). It must not already have an account. |
| 3. Verify | Email: a 6-digit code goes to the inbox. Mobile: the OTP request is recorded as *gateway pending* and the test build shows the code on screen until an SMS gateway is connected. |
| 4. Password | 8+ characters with upper and lower case, a number and a symbol, and not their name. |
| 5. Profile | Parent (child's admission number) or staff (designation); a Gmail for account emails when they signed up with a mobile; consent under the DPDP Act 2023. |
| 6. Done | Account is **Waiting for approval**. The account details (name, sign-in ID, mobile, requested access, status) are emailed to their Gmail. |

**Passwords are never emailed.** The account email confirms the sign-in ID and gives a link to change the password; staff created by an Admin get a set-password link instead of a temporary password. In production Amazon Cognito (one user pool per client) stores passwords, SES sends emails, and a DLT-registered SMS gateway sends OTPs.

**Sign-in rules.** 5 wrong passwords lock the account (unlock with a code or by the school). Codes are 6 digits, expire in 10 minutes, allow 5 tries and can be used once; at most 5 codes per address per hour. Pending accounts cannot sign in.

## User and role management

Operations → **Users** is open to Admins, and to anyone given the screen by designation or personally (e.g. a Vice Principal who is a Teacher).

- **Approve sign-ups:** review the details, pick the role, set status to Active; the person is emailed that the account is ready.
- **Change role, designation or status** (Active, Locked, Switched off) for anyone; changes apply at the next sign-in and are logged with who and when.
- **Extra screens for one person**, on top of their role.
- **Add user:** creates the account and emails a set-password link.
- **Reset password:** emails a set-password link.
- **Rules:** nobody changes their own role; only an Admin can give the Admin role.

Operations → **Roles & Permissions** has three tabs: the role × screen matrix, **access by designation** (screens a designation opens without changing the role), and **custom roles** (e.g. Transport Manager, copied from an existing role, Professional plan and above).

What a person can open = role permissions + designation extras + personal grants, limited to what the school's plan switches on.

## Admissions pipeline

Students → **Admissions & Enquiries** tracks every enquiry and application for next year, from the first call to enrolment.

```
Enquiry → Submitted → In review → Offered → Enrolled
   └──────────┴───────────┴──────────┴──→ Opted out (reason required) ──reopen──→ Enquiry
```

| Status | Meaning | What the app does |
| --- | --- | --- |
| Enquiry | A parent called, walked in or asked online | Records child, grade, parent, mobile, email, source, transport need; acknowledgement email |
| Submitted | Application form completed (by the office, or by the parent on the website form) | Needs date of birth and consent; tracks documents (birth certificate, photo, report card); acknowledgement email |
| In review | The school is assessing | Interaction / assessment date; email to the parent |
| Offered | A seat is offered | Only when birth certificate and photo are in; offer email asks the parent to accept within 7 days |
| Enrolled | Parent accepted and paid | Creates the student (admission number, guardian, section with most space) and emails the admission letter |
| Opted out | Parent withdrew or the school declined | Reason required (chose another school, fees, distance, relocated, not eligible, no response); can be reopened as an Enquiry |

**Summary by grade.** Grade × status counts (click a count to open those applications), seats still free per grade (40 per section minus enrolled; shown red when offers exceed them), a funnel of everyone who reached each stage, and cards for applications waiting on the school, offers out, offer acceptance and conversion. Grade buttons filter everything.

## Data Analytics

A separate **Data Analytics** menu (Growth plan and above) embeds Power BI reports, filtered to the school by row-level security. Report definitions, DAX measures and security roles: `docs/powerbi/REPORTS.md`.

| Report | Filters | What it shows | Who sees it |
| --- | --- | --- | --- |
| Top & Bottom Performers | Grade (required), sections (none picked = all sections together), term, subject or all subjects | Top 6 and bottom 6 in the grade: rank, student, section, score %, change since last term, attendance; students, average, pass % (≥ 33), top score; average by section | Admin, Principal, Vice Principal; Teachers (own classes in Power BI) |
| Teacher Performance | Grade, subject | Per teacher and subject: sections, students, Term 1 and Term 2 averages, change, difference from the grade average for that subject, pass %, % at 75+, an index (50 = in line with the grade) | Admin, Principal, Vice Principal |
| Transport Reports | Grade | Per route: bus, driver, km, riders / seats, seat use (full, under-used), fee per year, ₹ per km, on-time %; riders, seat use, fee revenue, riders with overdue fees; share of each grade using transport | Admin, Principal, Accountant |
| Admissions Funnel | Grade, source, year | Everyone who reached each stage, applications by grade, conversion, offer acceptance, enquiries and enrolments by source | Admin, Principal, Front Office |
| Report Catalogue | — | Each report's Power BI page, data view, filters and audience | Admin, Principal, Accountant |

The teacher index is a starting point for a conversation, not an appraisal score on its own: class mix, section size and attendance sit beside it. Marks come from `exam_results` (Term 1, Term 2 and any periodic tests); subject teachers per section from `section_subject_teachers`.

## Database schema summary

PostgreSQL 15+, seven migration files loaded in order. Every table carries `tenant_id` with row-level security; the app connects as a non-owner role and sets `app.tenant_id` per request. Full detail: `database/README.md`.

| File | Adds | Key tables, views and functions |
| --- | --- | --- |
| 001_core_schema.sql | Core school data | roles, users, menus, role_menu_permissions, staff, students, guardians, enrollments, fee_heads, invoices, payments, payroll, ledger_accounts, vouchers, voucher_lines; v_user_menu, v_student_dues, v_account_statement |
| 002_saas_config.sql | Plans and configuration | plans, plan_features, features (module → sub-menu → function), tenants, tenant_subscriptions, tenant_feature_overrides, tenant_limit_overrides, config_audit, analytics_reports; v_tenant_features, v_tenant_limits |
| 003_exams.sql | Exams | boards, textbooks, chapters, topics, questions, paper_formats, question_papers, paper_sets, paper_approvals, coscholastic_grades; generate_paper_set() |
| 004_theming.sql | Appearance | ui_templates, theme_presets, tenant_themes (versioned), user_ui_preferences; accessible_shade(), publish_theme() |
| 005_payments_timetable_web.sql | Fees, timetable, website | school_bank_accounts, fee_request_campaigns, fee_request_messages, payment_notifications, email_outbox; bell_periods, timetable_entries, timetable_entry_teachers; website_connections, menu_links; payment_plans, transport_bands; assessment_profiles; apply_payment(), match_payment_notification(), amount_in_words_inr() |
| 006_templates_import.sql | Templates and import | template_categories, template_fields, doc_templates, doc_template_versions, template_defaults; import_targets, import_target_fields, import_profiles, import_column_maps, import_value_maps, import_jobs, import_rows; resolve_template(), render_template(), map_and_validate_import(), commit_student_import(), rollback_student_import() |
| 007_auth_admissions_analytics.sql | Sign-up, user management, admissions, analytics | users (Pending status, login type, verified flags, requested role, designation), otp_requests, sms_gateway_config, designation_menu_access, user_menu_grants, user_role_changes; admission_enquiries, admission_status_history; exam_terms, exam_results, section_subject_teachers, transport_routes, transport_trips; request_otp(), verify_otp(), set_user_role(), enrol_applicant(); v_user_screens, v_admissions_by_grade_status, v_student_term_scores, v_grade_rankings, v_teacher_subject_performance, v_transport_route_summary |

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

**Accounts and access**

1. One sign-in ID per account (email or mobile) per school; new accounts start as Waiting for approval and cannot sign in until approved.
2. Passwords: 8+ characters, upper and lower case, number, symbol, not the person's name; never emailed or shown.
3. One-time codes: 6 digits, 10 minutes, 5 tries, single use, at most 5 per address per hour; only a hash is stored.
4. 5 wrong passwords lock the account.
5. Only Admins, or people given the Users screen by designation or personally, manage users. Nobody changes their own role; only an Admin gives the Admin role. Every change is logged.
6. A parent account is linked to a child by admission number; the school checks it before approving.

**Admissions**

1. Moves allowed: Enquiry → Submitted → In review → Offered → Enrolled; Opted out from any open step (reason required); Opted out → Enquiry to reopen.
2. An offer needs the birth certificate and photo; enrolment needs a free seat in the grade.
3. Enrolment creates the student and guardian (siblings share a guardian by mobile) and emails the admission letter.

**Analytics**

1. Rankings club all sections of a grade unless sections are picked; ties share a rank.
2. Pass mark 33%; distinction 75%.
3. Teachers see rankings only for their own classes in Power BI.

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

**Automated tests.** `npm test` runs 14 checks on the business rules (including sign-in, sign-up and OTP, designation access, top/bottom 6, transport, teacher performance and admissions), and `database/tests/007_checks.sql` tests the new SQL. The earlier checks cover amount in words, payment posting, fee requests and SMS fallback, auto-matching (link, narration, duplicate, unmatched), parent UTR then bank line, import mapping and rollback, paper sets without repeats, templates and sanitising. All pass. A browser run opened every screen for all seven roles with no errors.

**User-testing script.**

- [ ] Anyone: Create account with a Gmail → read the code in the test inbox → set a password → try to sign in (waiting for approval)
- [ ] Anyone: Create account with a mobile number (code shown on screen until SMS is connected)
- [ ] Admin: Users → Review the new sign-up → pick the role → Active; the person can now sign in
- [ ] Admin: Roles & Permissions → Access by designation; then sign in as "Teacher + Vice Principal" and open Users
- [ ] Front Office: Admissions & Enquiries → Application form → move it to In review, Offered, Enrolled; check the summary by grade
- [ ] Principal: Data Analytics → Top & Bottom Performers → Grade IX, all sections, then pick S1 and W1
- [ ] Principal: Teacher Performance and Transport Reports with a grade filter
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
- SMS OTP provider (MSG91, Gupshup or Amazon SNS) and the DLT-approved OTP template.
- Can parents sign up themselves, or only accounts the school creates? (Both are built; self sign-up is a plan function.)
- Should the teacher index be shown to teachers themselves, or only to the Principal?
- Admission fee and offer expiry: is 7 days right, and does an unaccepted offer move to Opted out automatically?
