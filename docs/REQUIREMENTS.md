# School Management Platform — Requirements

Updated 18 Nov 2026 (release 12: dashboard insights with full and part time, salary by type, riders per route and bus breakdowns; route planning, pickup suggestions and a route map; student profile; attendance registers with date ranges; report cards replace Promote / Transfer; Add staff inside All Staff; My Leave with allowances and approver notifications; screen-by-screen user guide and FAQs; help documents; 20 conversion templates; release 11: a Settings menu for the setup screens, with Operations kept for user management and data upload; release 2: sign-in, user management, admissions, Data Analytics; release 3: pickup/drop/early-leave requests, class coordinators, transport manifests, SMS framework, account self-service, teacher-performance visibility; release 4: no cut-offs, driver route sheets with stop timings, optional attendant tracking, approved pickup list; release 5: leave, late arrival, teacher meetings and office requests, website links, mobile store app, concurrency fixes and full regression; release 6: Web & App Screens per role with approval workflow, recommended phone defaults, in-app user guide with guided demos; release 7: opens on a Main menu, designations by role, account creation in the app, Admin View as Profile; 7.1–7.5: User management with departments, access by department with read only / full access, access summary, standard profiles for Indian schools; release 8: question papers driven by topic selection, up to 10 sets, approval per set, question bank with topics, blueprints; release 10: nobody waits for approval (staff checked against the staff record), dashboard in sections (students, staff, transport, fees, enrolment) with year-on-year arrows, gender split and grade limits; release 9: accounts come from registration (Add user is Admin-only, with a reason), Users filters, copy a returning person's details from the archive, department, student and created columns, 25 per page, refresh, parents checked against the student record with no approval, no switched-off status, reset password for Admin or by permission, delete as a status with a view-only archive). Live, editable copy: https://claude.ai/artifact/7s89uC65LFcsiKfvBBeLdy

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
   - Question papers generated in Indian board formats from the topics chosen for each paper, in up to 10 sets, each approved before printing.
   - Co-scholastic grades and narrative assessment profiles.
7. **School's own formats.** Every printed or sent document uses a template. A school can use the standard one, edit a copy or upload its own, and choose a default per school, role or user.
8. **Easy onboarding.** Existing data comes in from Excel, CSV or photos of registers. Columns are mapped to app fields once and the mapping is saved.
9. **Branding.** Each school picks a layout template, colours and fonts. Colours are checked for readability.
10. **Website.** The app links to the school's existing website, or hosts a simple new one. Website pages can be added as menu items.
11. **Mobile.** Parents and staff use one store app (Google Play and App Store, built with Capacitor from the same code) with a small set of screens that each school switches on, under the same access rules as the website. The web app also installs as a PWA.
12. **Own sign-in page per school.** Each client gets its own sign-in page and accounts. People create an account Gmail-style with a Gmail/email or mobile number, verify it with a one-time code and set a password. Accounts open at once when the details match the school's records: parents against the student record, staff against the staff record. Account details go to their Gmail. OTP by SMS is built as a workflow and switches on when an SMS gateway is connected.
13. **User management.** Accounts open when registration details match the school's records. An Admin, or anyone given the Users screen by designation or personally, changes roles, designations and status. Schools can add their own roles.
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
| Starter | Up to 250 | Students, staff, academics, exams, fees, operations (users, roles, data import), settings (branding, bank details) |
| Growth | 251–500 | Insights, payroll, payment matching, promotions, concessions, custom brand colour, custom templates |
| Professional | 501–1,000 | Account statement, income & expenses, image (OCR) import |
| Enterprise | 1,000+ | Dedicated database option, white-label mobile app, custom fonts |

## Screens by module

16 menus hold 70 screens plus the sign-in pages, and all of them open in the test build. Column-level detail per screen is in the client review PDF (`docs/School_Platform_Client_Review.pdf`), and the visual designs are on the design canvas.

| Module | Screens | Key fields and actions |
| --- | --- | --- |
| Dashboard | Dashboard | Sections for students, staff, transport, fees and enrolment, each against last year (▲ / ▼); boys and girls; grade limits; needs-attention list and recent activity |
| Students | Insights, All Students, Student Profile, Admissions & Enquiries, New Admission, Attendance (register), Coordinator Desk, Parent Meetings, Office Requests, Gate Desk, Report Cards, Documents & ID Cards | Admission no. (generated), name, gender, DOB, class-section, house, guardian name/relation/mobile/email, transport band; profile in four parts (personal, academic, performance with rank, attendance); report cards by grade, section or student for an exam, a term or the year |
| Staff | Insights, All Staff (with Add staff and Edit), Staff Attendance (register), Leave Requests | Employee code, short code (timetable), department, designation, full or part time, mobile, email, basic pay; leave approvals, leave taken by staff, leave types and allowances |
| Academics | Classes & Sections, Boards Syllabus & Textbooks, Timetable | Board, chapters, topics; timetable cells "SUBJECT TEACHER", grade-wide blocks, teacher clash check |
| Exams | Question Papers, Approved Papers, Question Bank, Blueprints, Co-Scholastic Grades, Assessment Profiles | Papers per exam timetable; topics chosen per paper drive the questions; up to 10 sets, each approved separately; the set for the exam chosen until the start time; print, answer key, teacher's copy; A/B/C grades; subject comments and appreciation card |
| Fees | Insights, Collect Fee, Fee Request Emails, Payment Matching, Dues & Reminders, Receipts, Fee Structure, Concessions | Grades, instalment, due date; source, UTR, narration, amount, match status; invoice and receipt in the school's template |
| Transport | Daily Bus Manifest, Pickup & Drop Changes, Routes & Riders | Date, morning/afternoon trip, route; riders by stop with Will board / Not boarding / Absent / Check and the reason |
| Data Analytics | Report Catalogue, Top & Bottom Performers, Transport Reports, Teacher Performance, Admissions Funnel | Grade, sections, term, subject filters; Power BI pages |
| Payroll | Run Payroll, Payslips | Basic, HRA, DA, transport, PF, TDS, net; approve and post |
| Accounts | Account Statement, Income & Expenses | Ledger with running balance |
| Operations | User management: Users, Roles & Permissions · Data upload: Data Import, Help Documents & FAQs | Permission grid; 20 conversion templates and import mapping; the school's own help documents and FAQs. Always on |
| Settings | School setup: Appearance & Branding, Website & Links, Web & App Screens, Templates, Bank & Payment Details · Messages: SMS Gateway, Email & SMS Outbox | Template versions and defaults; bank holder, account (encrypted), IFSC, UPI ID, QR; theme; menu links. Always on |
| My Space | My Child, Requests to School, Fee Dues & Pay, My Payslips, My Leave, My Teaching Performance, My Account, My Preferences | Parent pay page with online pay or bank transfer + UTR; parents open published report cards; staff apply for leave and see what is left |
| Platform Console | Schools & Plans | Plan per school, module and sub-menu switches, add-ons, mobile app on/off |
| Help | User Guide & Demo, FAQs | Guided demos, the screen-by-screen flow, every menu explained, what each role sees — all following the school's plan and the person's access; FAQs by role and the school's documents |

## Accounts and sign-in

Each school (client) has its own sign-in page at `<school>.yourapp.com`, branded with its name, and its own set of accounts.

| Page | What happens |
| --- | --- |
| Sign in | Gmail/email or mobile + password. Or "Sign in with a code": a 6-digit code to the email (or by SMS once connected). Or "Forgot password": code, then a new password. |
| Create account — 1. Name | First and last name. |
| 2. Sign-in ID | A Gmail/email address **or** a 10-digit Indian mobile (+91 and spaces are accepted). It must not already have an account. |
| 3. Verify | Email: a 6-digit code goes to the inbox. Mobile: the OTP request is recorded as *gateway pending* and the test build shows the code on screen until an SMS gateway is connected. |
| 4. Password | 8+ characters with upper and lower case, a number and a symbol, and not their name. |
| 5. Profile | Parent (the student's admission number, name and grade, checked against the student record) or staff (employee code, checked with the name and sign-in ID against the staff record); a Gmail for account emails when they signed up with a mobile; consent under the DPDP Act 2023. |
| 6. Done | Details match the student or staff record: the account is **Active** at once (staff get the role and designation from the staff record). The account details (name, sign-in ID, mobile, requested access, status) are emailed to their Gmail. |

**Passwords are never emailed.** The account email confirms the sign-in ID and gives a link to change the password; staff created by an Admin get a set-password link instead of a temporary password. In production Amazon Cognito (one user pool per client) stores passwords, SES sends emails, and a DLT-registered SMS gateway sends OTPs.

**Sign-in rules.** 5 wrong passwords lock the account (unlock with a code or by the school). Codes are 6 digits, expire in 10 minutes, allow 5 tries and can be used once; at most 5 codes per address per hour. Locked and deleted accounts cannot sign in.

## User and role management

Operations → **Users** is open to Admins, and to anyone given the screen by designation or personally (e.g. a Vice Principal who is a Teacher).

- **No approvals:** accounts open when the registration details match the student or staff record.
- **Change role, designation or status** (Active, Locked, Deleted) for anyone; changes apply at the next sign-in and are logged with who and when.
- **Extra screens for one person**, on top of their role.
- **Add user:** Admin only, as an exception with a reason (people normally register on the website or in the app); creates the account and emails a set-password link.
- **Reset password:** emails a set-password link. Only the Admin role, or a person the Admin gives the permission to, sees it.
- **Rules:** nobody changes their own role; only an Admin can give the Admin role.

Operations → **Roles & Permissions** has three tabs (from release 7.1; access by department from 7.4; access levels and summary from 7.5):

- **User management:** every user profile (role), the **department** it belongs to, the designations it offers, how many people have it and how many screens it opens. Departments can be renamed (Parents have none). New profiles (e.g. Hostel Warden, Transport Manager) are added here with a department, starting screens and their own designations (Professional plan and above).
- **Permissions by department:** every menu and sub-menu of the side menu as a tree, per department, each set to No access, Read only or Full access. Every profile in a department has the same access; the Admin profile always has full access.
- **Access summary:** each person with their profile, department, designation and screens by level.

The Access by designation tab was removed. Rules set there before (Vice Principal and Head of Teaching Staff extras) still apply, but can't be edited in the app.

What a person can open = role permissions + personal grants (+ the existing designation extras), limited to what the school's plan switches on.

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

## Added 17 Nov 2026 (release 3)

- **SMS framework, connect later.** Every SMS (OTP, gate code, pickup/drop notice, fee reminder, absence alert) already goes through one queue. A vendor (MSG91, Amazon SNS, Gupshup, Twilio) or the school's own SMS API is connected from a settings screen when ready, with no code change.
- **Parents maintain their own accounts;** the school manages them in the back office (edit details, link children, close/delete).
- **Teacher performance is hidden from teachers** unless the Principal or the Head of Teaching Staff shares it; teachers then see their own results only, view-only.
- **Pickup, drop and early-leave requests** from parents go to the class's primary and secondary coordinators, the gate and the transport team, and feed a daily bus manifest for the morning pickup and afternoon drop.

## Parent requests, coordinators and the gate

```
Parent request (approved people only) → Early leave? ──no──→ Confirmed → Gate desk (photo, ID, code; hand over)
                                            │ yes                ↑        → Bus manifest + each driver's route sheet
                                            ↓                    │        → Parent: gate code by email + SMS
                         Coordinator desk (primary or secondary) ──approve┘
                         └──decline──→ Parent told, with the reason
```

| Request (My Space → Pickup & Leave Requests) | Trips affected | Needs | Confirmed |
| --- | --- | --- | --- |
| In-person pickup after school | Afternoon drop | A person from the child's approved pickup list | At once, any time |
| In-person drop in the morning | Morning pickup | — | At once, any time |
| Early leave | Afternoon drop | Time before 15:00, reason, a person from the approved pickup list | By a class coordinator |
| Own transport (one day or a date range) | Both | — | At once, any time |

- **Class coordinators:** Academics → Class Coordinators. Each section has a primary and a secondary coordinator (different people), set by the Principal or Admin. Both get every request for the section by email and see it on Students → **Coordinator Desk**; either can approve or decline (decline needs a reason, which goes to the parent).
- **Gate code:** approving a pickup or early leave creates a 4-digit gate code sent to the parent by email and SMS. Only a hash is stored.
- **Gate Desk (Front Office):** today's collections in time order. Staff check photo ID, enter the code and hand the child over. The time is recorded, and the coordinators and manifest update. A wrong code or an unapproved request means *do not release*.
- **Parents** see status and the gate code, and can cancel until the child is handed over.

## Transport

A new **Transport** menu and **Transport team** role (e.g. the Transport In-charge and bus attendants).

- **Daily Bus Manifest:** pick a date, the morning pickup or the afternoon drop, and a route. Every rider is listed by stop in boarding order with a status:
  - **Will board**
  - **Not boarding**, with the reason: own transport, parent dropping or collecting in person (with who), left early at a given time with the named collector, or leaving early at a set time
  - **Absent** (from attendance)
  - **Check**: a request is waiting for a coordinator
- The attendant marks Boarded or No-show. **Send to transport team** emails the manifest; in production it goes automatically at 06:30 and 14:30, and later changes are pushed as they happen.
- **Pickup & Drop Changes:** every request that affects the bus, today and coming days. Front Office sees it too.
- **Routes & Riders:** who normally rides each bus, by stop.

## SMS gateway (Settings → SMS Gateway)

1. **Provider:** our own SMS API (any HTTPS endpoint with a body template), MSG91 (Flow API v5), Amazon SNS (India DLT entity and template attributes), Gupshup or Twilio. Keys live in AWS Secrets Manager; only the reference is saved.
2. **DLT templates:** the text for each message (must match the DLT registration exactly) and its DLT template ID; MSG91 flow IDs where needed.
3. **Test and go live:** a dry run shows the exact request that will be sent. Going live sends everything still queued, except OTPs, which expire because they are only valid for 10 minutes.

Server side: `services/sms/dispatcher.mjs` sends queued messages with retries; `services/sms/webhook.mjs` records delivery reports. See `services/sms/README.md`.

## Account self-service

- **My Account (everyone):**
  - Change name.
  - Change Gmail or mobile, verified with a code to the new address.
  - Change password (current password required).
  - Notification choices; safety messages are always sent.
  - Parents: their linked children, and asking to link a sibling.
  - Asking to close the account.
- **School back office (Operations → Users):**
  - Edit anyone's name, email, mobile and linked children.
  - Handle link and close requests.
  - Delete an account (Edit → Status Deleted → reason → confirm): the sign-in is removed and a copy is kept in the view-only archive; fees, marks and receipts stay.

## Teacher performance visibility

Teachers never see the Teacher Performance report. On that page the Principal (role) or the Head of Teaching Staff (designation) can switch on **Share with teachers**. Each teacher then gets My Space → **My Teaching Performance**: their own subjects and sections only, view-only. Switching it off removes the screen. Every change is logged.

## Added 17 Nov 2026 (release 4)

### No cut-off times

Decided 17 Nov 2026. Pickup, drop and own-transport changes are confirmed whenever they are sent and appear on the driver's route sheet straight away. Early leave still needs a class coordinator, because the child leaves during the school day.

### Approved pickup list

Only approved people can collect a child in person or for an early leave.

- **The guardian on the student's record** is always on the list.
- **Others** (mother, grandparent, family driver and so on) are added by the parent on Pickup & Leave Requests. Each needs:
  - name, relation and mobile
  - a photo
  - photo ID type and its **last 4 digits only**
  - an optional valid-until date
- **School check:** new people show *Waiting for school check* until Front Office checks the ID and approves them (Gate Desk → Approve pickup people).
- **Removing:** parents can remove someone at any time.
- **At the gate:** the request form only offers approved people. The Gate Desk shows the collector's photo and ID type beside the gate code.

### Driver route sheets and stop timings

- **Transport → Routes, Stops & Timings:** for each route, the bus, driver and driver mobile, the attendant, when the bus reaches school (morning) and leaves school (afternoon), and the time at each stop for the morning pickup and afternoon drop. Times are checked: morning stops in order and before school; afternoon drops after the bus leaves.
- **Transport → Driver Route Sheets:** one sheet per route (Route #) for a chosen day. It shows the morning pickup and the afternoon drop by stop and time, every child with ✓ boards or ✗ do not wait (and why), and ? where a request still needs the coordinator.
  - **Send to all drivers:** each driver gets only their own route's sheet, as an SMS with a private link (read-only page for that route and day, refreshes when a parent changes a pickup or drop).
  - **Send this route** re-sends one route.
  - **What the driver sees** previews the phone view.
  - **Download all (Excel):** one tab per route.

### Attendant boarding tracking is optional

Marking Boarded / No-show on the bus is a function the platform team switches on or off per school (Platform Console → Schools & Plans → Functions → *Bus attendant boarding tracking*). It is off by default on every plan; the demo school has it on. When it's off, the manifest and route sheets have no tick column, and the database refuses boarding records for that school. The Functions list also shows the other optional capabilities (self sign-up, SMS OTP, custom templates, custom roles, OCR import) with their plan defaults.

## Added 17 Nov 2026 (release 5)

### More requests from parents

Parents raise everything from **Requests to School** (website and mobile app). The menu was renamed from Pickup & Leave Requests.

| Request | Who handles it | What happens |
| --- | --- | --- |
| In-person pickup, in-person drop, own transport | Confirmed at once | Coordinators and the bus team are told; the route sheet updates |
| Early leave | Class coordinator | Gate code sent to the parent; collector from the approved list |
| **Leave (child will be absent)** | Class coordinator | Reason required, up to 30 days in the app (45 in the database). When approved, attendance shows *Leave* for each school day and the bus does not wait |
| **Late arrival (parent drops the child)** | Confirmed at once | Time must be after 08:45 and before 15:00. The morning bus does not wait. The Gate Desk lists expected late arrivals; *Arrived* marks attendance *Late* |
| **Meet or call a teacher** | The teacher asked | The parent picks one of the child's subject teachers or class coordinators, how (in person, phone, video), a preferred day and time, and the topic. The teacher confirms a date and time or declines with a note (Students → **Parent Meetings**). No personal phone numbers are shared |
| **Other (certificate, TC, ID card, fee query, change of details)** | School office | Goes to Students → **Office Requests**; the office marks it done with a message, or declines |

- Coordinators only see attendance and transport requests, not meetings or office work.
- A parent can have one active request of a kind per child per day. Meetings are limited to one per teacher per day; office requests have no limit. The database enforces this even when the same request is sent twice at the same moment.

### Website links

Settings → Website & Links → **Links for the school website** gives each school its own addresses and ready-to-paste snippets.

| Address | Purpose |
| --- | --- |
| `https://<school>.yourapp.com/#/s/SELF_REQUESTS` | Requests to school (also Pay fees, My child, Timetable, Parent meetings, Driver route sheets) |
| `#/p/apply` | Public admission enquiry form, no sign-in; `#/p/apply?embed` for an iframe on the school website. Enquiries enter the Admissions pipeline with source *School website* |
| `#/p/privacy` | Privacy policy |
| `#/p/delete` | Delete an account without the app (code sent to the email or mobile) |

- A link to a signed-in screen asks the visitor to sign in, then opens that screen.
- If the person's role cannot see it, they get their home screen and a message. Access rules never change because of a link.
- Signed-in screens are linked, never embedded in other sites.

### Mobile app (Google Play and App Store)

One store app serves every school. People enter the school code once. Details and the release checklist are in `docs/MOBILE_STORE_CHECKLIST.md`.

- **Minimal features, switched per school:** Platform Console → Schools & Plans → **Mobile app** switches the app on for a school (from release 6 the screens are chosen per role in Web & App Screens). New schools start with the app off. Home and Account are always on, so account deletion stays reachable.
- **Same access rules as the website:** a tab shows only if the school offers it on the app **and** the person's plan, role, designation and personal grants allow it on the web.
  - Parent: Home, Requests, Fees, Account.
  - Teacher: Home, Attendance, Approvals, Meetings, Account.
  - Gate: Home, Gate, Account.
  - Transport: Home, Route sheet, Account.
  - Admin and Accounts stay on the website.
- **Phone features:** push notifications (with permission), works offline with a clear message, Android back button, native share, safe areas, 44 px touch targets, 16 px inputs.
- **Accounts:**
  - Parents can delete their own account in the app (password check) or on the web.
  - Staff accounts are closed by the school office on request.
  - Deleting an account removes its notification devices.
- **Builds:**
  - `mobile/` (Capacitor 8): Android targets API 36; iOS includes a privacy manifest, push entitlement and the encryption declaration.
  - CI: `.github/workflows/mobile.yml` builds the Android bundle and iOS app, and uploads to Play internal testing or TestFlight when the keys are added.
- **Preview:** `#/p/mobile` on the test link shows the app in a phone frame.

### Testing and capacity

The full results are in `docs/TEST_REPORT.md`.

- **Concurrency:** 10 tests where many people act at the same moment found 5 faults. All are fixed in migration 010:
  - receipt numbers collided when payments arrived together;
  - one bank line could be receipted twice;
  - a duplicate request could slip through;
  - the last seat could be taken twice;
  - the school setting has to be transaction-local on pooled connections.
- **Load:** 100 people × 20 actions gave 0 errors, p95 under 1.6 s. With 300 people, data stayed correct, but the manifest and dues screens slowed to about 4 s on a 2-CPU test database. Production needs RDS Proxy, a read replica for manifests and reports, and a short manifest cache.
- **Two browser tabs:** the test app merges changes made in another tab instead of overwriting them.
- **Store readiness:** 12 automated checks modelled on Google's pre-launch report and Apple review all pass:
  - crash crawl for every role;
  - access rules;
  - WCAG 2.1 AA;
  - touch targets;
  - phone-to-iPad layout;
  - privacy policy;
  - in-app and web account deletion;
  - offline use;
  - every request type;
  - start-up speed and bundle size;
  - native settings.
- **Regression:** CI runs everything on every push (`.github/workflows/tests.yml`):
  - 31 app tests;
  - 22 SQL checks;
  - 10 concurrency tests;
  - 4 web end-to-end tests;
  - 12 store checks.

## Added 17 Nov 2026 (release 6)

### Web & App Screens: what shows on the website and in the app, per role

Settings → **Web & App Screens**. For each role, each phone-ready screen is set to **Website + app**, **Website only** or **App only**.

- **Website only:** screens not built for phones (setup, finance, exams and so on) always show on the website only.
- **Always both:** Account stays on both, because store rules need account deletion inside the app.
- **Who can open a screen** is still set in Roles & Permissions; this only decides *where* it shows.
- **Designations and personal grants** follow the role's choice.

| Step | Who | What happens |
| --- | --- | --- |
| 1. Edit a draft | Admin or platform team | Changes go into a draft. A side-by-side preview shows the role's website menu and phone tab bar. Nothing changes for users. |
| 2. Send for approval | The editor | Optional note; the Principal is emailed. The draft is locked; the editor can take it back. |
| 3. Approve and publish, or send back | Principal or platform team, **not the editor** | Publish creates a new numbered version and emails the Admins. Send back needs a reason. |
| History | Anyone with the screen | Every version with who sent, who approved and what changed; *Restore as draft* reuses an older version (it goes through approval again). |

The Platform Console's Mobile app card now only switches the app on or off for a school and summarises each role's tabs.

### Recommended phone screens (version 1)

Chosen so most roles fit the 5-tab phone bar; schools change them through the workflow above.

| Role | Phone app tabs | Website only by default (phone-ready) |
| --- | --- | --- |
| Parent | Home, Requests, Fees, My child, Account | Timetable |
| Teacher | Home, Timetable, Attendance, Approvals, Meetings, Account (Meetings and Account under More) | Leave, Payslips |
| Front Office | Home, Gate, Office, Bus changes, Account | — |
| Transport team | Home, Route sheet, Manifest, Bus changes, Account | — |
| Principal | Home, Attendance, Approvals, Meetings, Office, Route sheet, Account | Leave, Manifest, Bus changes, Timetable, Payslips |
| Accountant | Home, Payslips, Account | — |
| Admin | Home, Account | All others |

Phone-ready screens: Requests to School, Fee Dues & Pay, My Child, Timetable, Attendance, Coordinator Desk (Approvals), Parent Meetings, Gate Desk, Office Requests, Driver Route Sheets, Daily Bus Manifest, Pickup & Drop Changes, Leave Requests, My Payslips, My Account.

### User guide and guided demos

- **Help → User Guide & Demo** (every role), also before sign-in at `#/p/guide` and linked from the sign-in page.
  - **16 guided demos** (release 7 adds: designations by role, View as a profile; the account demo now starts in the phone app) of the main workflows: leave, early leave with gate code, late arrival, meet a teacher, certificate request, website enquiry to enrolment, fee request to automatic matching, question paper, payroll, new account approval, Web & App Screens change, onboarding a school, a transport day, and results/teacher performance.
  - Press Start: a bar at the bottom shows each step, signs in as the right demo person and opens the right screen.
  - Steps show what to do and what you should see.
- **Every menu explained:** every main menu and sub-menu, with what it is for, how to use it, who can open it, the plan it comes with, and where it shows. Each has a **Try** button.
- **What each role sees** on the website and in the app, with a sign-in button per role.
- **Getting started:** links, demo accounts and tips.
- **Printable manual:** `docs/USER_GUIDE.md`, generated from the same content (`node app/scripts/user-guide.mjs`), and the shareable [User Guide doc](https://claude.ai/artifact/6ALh8LqsnVisEpf9Leq1LL) with screenshots.

## Added 17 Nov 2026 (release 7)

**Opens straight on the Main menu.** For testing, the website skips the sign-in page and opens as the school Admin on a new **Main menu** screen. It shows every menu and sub-menu as tiles. The sign-in page is still there through **Switch user** or `#/login`. The phone app still asks people to sign in.

**Side menu starts collapsed (release 7.3, simplified in 7.4).** Every group in the left menu (Students, Fees, Transport…) starts collapsed. Click a group, or press Enter on it, to open it.

**Main menu from every screen.** Every screen has a **⌂ Main menu** button in the top bar and a **Main menu** item at the top of the side menu. In the phone app, every tab except Home has a **‹** back button to Home.

**Designations follow the role (Operations → Users).** When you add or edit a user, the designation list shows only that role's designations:

| Role | Designations offered |
| --- | --- |
| Admin | School Administrator, IT Administrator, Office Manager |
| Principal | Principal, Vice Principal, Headmistress / Headmaster, Academic Director |
| Accountant | Accountant, Senior Accountant, Accounts Assistant, Cashier, Fee Clerk |
| Teacher | Pre-Primary Teacher, PRT, TGT, PGT, Class Teacher, Coordinator, Head of Department, Head of Teaching Staff, Vice Principal, Physical Education Teacher, Special Educator, Counsellor, Librarian, Lab Assistant |
| Front Office | Receptionist, Front Office Executive, Admissions Officer, Office Assistant, Gate / Security Staff |
| Transport team | Transport In-charge, Transport Supervisor, Driver, Cleaner, Bus Helper / Attendant |
| Parent | No designation: shown as **N/A** |

- Changing the role clears a designation that does not fit.
- Save is refused until a matching designation is picked.
- A school can add its own designations per role in **Roles & Permissions → User management** (release 7.1). A designation that is in use can't be removed.
- A custom role uses the list of the role it was based on.
- Adding a Parent asks for the child's admission number.

**Create an account from the app.** The phone app's sign-in page has **Create an account**, for parents and for staff (Teacher, Front Office, Transport team, Accountant, Principal).
- Staff pick their designation from their role's list.
- Parents give their child's admission number.
- The account goes into the same users table as Pending. It shows at the top of **Operations → Users** for approval, with the role and designation asked for already filled in.
- Passwords are never emailed.

**View as Profile (Admin only).** A new menu on the Main menu and in the side menu shows the app as a Parent, Teacher (class coordinator), Teacher + Vice Principal, Teacher + Head of Teaching Staff, Principal, Accountant, Front Office or Transport team. No sign-in is needed.
- A bar shows who you are viewing as. It switches between **Website** and **Phone app** and has **Back to Admin**.
- Viewing is read-only: anything that would save is blocked with a message. Ticking **Act as this person** lets changes through, saved under that person.
- The menu is for the Admin role only. It can't be given by designation, by a personal grant or to another role. This is checked both in the app and in the database.
- Each view is logged (`view_as_log`): who viewed whom, website or app, and whether they acted.

**Database (`013_designations_view_as.sql`):**
- `role_designations` holds the standard lists plus each school's extras, with row-level security.
- `designations_for()` returns a role's list.
- `designation_problem()` and two deferred constraint triggers make a designation fit the role, or the role asked for at sign-up. A parent's designation is always Parent.
- `set_user_designation()` sets a designation.
- View as menus, rows `VIEWAS` / `VA_*`, are for Admin only and enforced by triggers.
- `start_view_as()` / `end_view_as()` and `view_as_log` record each view.
- `v_user_directory` lists every account, pending sign-ups included.

## Added 17 Nov 2026 (release 7.1)

**User management tab.** Roles & Permissions now has two tabs, **User management** and **Role permissions**. The Access by designation tab is gone, and the separate Designations by role and Custom roles tabs are folded into User management.

| Profile | Department (default) |
| --- | --- |
| Admin | Administration |
| Principal | School Leadership |
| Accountant | Accounts & Finance |
| Teacher | Academics |
| Front Office | Front Office & Admissions |
| Transport team | Transport |
| Parent | Parents & Guardians (not a school department) |

- Each row shows the profile, its department (**Change** to rename it), the designations it offers (add or remove), how many people have it, and how many screens it opens (click to go to Role permissions).
- **Add a user profile:** name, department, the profile whose screens it starts with, and its designations. A school-added profile can be removed once nobody has it.
- Operations → Users shows each person's department under their role, and Add user shows the department next to the role.
- Existing designation extras (Vice Principal, Head of Teaching Staff) still work; they are no longer edited in the app.
- **Remove any designation (release 7.2):** every designation under *Designations offered* has a **×**, the standard ones included. It is refused while someone in that profile holds it (change their designation in Users first), and a profile keeps at least one. A removed designation is no longer offered in Add user, Edit user or sign-up; typing it in again brings it back. A profile copied from another also drops what was removed there.
- **Database (`014_role_departments.sql`):** `role_departments` (standard + school renames, row-level security), `roles.department` for school-added profiles, `department_of()`, `set_role_department()`; `v_user_directory` now includes the department. `015_designation_removals.sql`: `role_designation_removals`, `designations_for()` leaves removed ones out, `remove_role_designation()` (refused while held or for the last one), `add_role_designation()`.

## Added 17 Nov 2026 (release 7.4)

**Side menu.** Expand all / Collapse all are gone. Every group starts collapsed when the app is opened. A group stays open for that visit once the person opens it.

**Confirm before removing.** Removing a designation, or deleting a profile, asks for confirmation in a pop-up first.

**Delete a profile.** Every profile except Admin has **Delete**.
- It is refused while anyone has that profile; move them to another profile in Users first.
- A deleted profile is no longer offered in Add user, sign-up or View as Profile.
- A built-in profile can be restored (**Restore …**). A profile the school added is removed together with its designations.

**Standard profiles for Indian schools.** Researched departments, profiles and designations are listed beside Add a user profile, each with a one-click **Add**. The full list and sources are in `docs/INDIAN_SCHOOL_PROFILES.md`.

| Department | Profile | Starts with the screens of |
| --- | --- | --- |
| Library | Librarian | Teacher |
| Laboratories | Lab Staff | Teacher |
| Sports & Co-curricular | Sports Staff | Teacher |
| Student Welfare & Health | Counsellor, School Nurse | Teacher / Front Office |
| Hostel & Boarding | Hostel Staff | Front Office |
| IT & Systems | IT Staff | Front Office |
| Estate, Security & Housekeeping | Estate & Support Staff | Front Office |
| Human Resources | HR Staff | Accountant |

**Permissions by department** (replaces Role permissions).
- **Departments, not profiles.** Access is set per department, and every profile in a department opens the same screens.
- **Updated automatically.** Adding a profile to an existing department gives it that department's screens. Adding a profile with a new department, or moving a profile to one, adds that department to the list, starting with the screens of the profile it came from.
- **Every menu is listed.** All menus of the side menu appear, from Dashboard to Help. View as Profile is shown but locked, because it is Admin only.
- **Whole menu or single sub-menus.** Tick a main menu to give every sub-menu under it. A part-ticked menu shows a dash, and its counter reads, for example, "5 of 8".
- **Expand and collapse.** Main menus and the groups inside them (e.g. Exams → Papers) open and close, and all start collapsed.
- **Reset to standard** puts a department back to its profile's standard screens.
- The Admin profile always opens every screen. Sub-menus outside the school's plan are marked *Not in plan*.

**Database (`016_department_access.sql`):**
- `department_menu_permissions` (row-level security; View as Profile refused) holds each department's screens.
- `sync_department_permissions()` gives new departments their starting list.
- `set_department_menu()` gives or takes a sub-menu or a whole main menu.
- `v_user_screens` now uses the department list (Admin keeps its full list), plus designation extras and personal grants.
- `v_tenant_profiles`, `remove_profile()` (refused for Admin, or while anyone has the profile) and `restore_profile()` handle deleting and restoring profiles.

## Added 17 Nov 2026 (release 7.5)

**Access summary** (Roles & Permissions → third tab).
- One row per person: name, profile, department, designation, and the number of screens with full access and with read-only access.
- **Show access** lists every screen the person can open, grouped by main menu and marked Full or Read only. Hovering a screen shows where the access comes from: the department, the designation, or a personal grant.
- Search by name or designation, and filter by department or profile.

**Read only or full access.** In Permissions by department, every main menu, group and sub-menu has a choice of **No access**, **Read only** or **Full access**.
- Setting a main menu (or a group, e.g. Exams → Papers) sets every sub-menu under it. A menu whose sub-menus differ shows **Mixed** and a counter such as "1 full · 7 read only".
- **Read only** opens the screen with a notice ("Read only — you can view this screen but not change anything"), and every save on it is refused. This works on the website and in the phone app.
- Screens given by designation or to one person are full access. The Admin profile always has full access to everything.
- **Database (`017_access_levels.sql`):**
  - `department_menu_permissions.access_level` (FULL / READ).
  - `set_department_access()` sets a level for a sub-menu or a whole main menu.
  - `v_user_screens.access_level` gives the best level from any source.
  - `can_edit_screen()` is checked by the API before any save.
  - `v_access_summary` lists each person's screens with their levels.

## Added 17 Nov 2026 (release 8)

**Question papers, built around topics.** Exams → Papers now has four screens, modelled on the question-paper workflow schools already use: **Question Papers**, **Approved Papers**, **Question Bank** and **Blueprints**. The design is our own.

**Question Papers (the list).**
- Choose the exam (Periodic Test I, Half-yearly, Unit Test 2, Unit Test 3, Annual). The upcoming exam is chosen first.
- One row per class and subject on that exam's timetable: date, marks filled out of the total, and status. Status reads, for example, "Not started", "Draft · 0 / 2 approved" or "Approved · 1 / 3 approved · Set 2 chosen".
- **Start** makes the paper from the blueprint for that exam and class, picks the topics and builds Set 1. **Open** continues an existing paper. A subject with no questions in the bank shows "No question bank yet".

**The paper is driven by the topics chosen.**
- **1. Topics for this paper.** Every chapter of the class and subject is listed, with its term and the number of questions in each topic. The first selection comes from the blueprint's chapter rule (for example "Term 1, first third" for Periodic Test I, "Term 1, all" for Half-yearly, or the whole syllabus for the Annual exam). Another starting rule can be chosen per paper.
- Tick or untick a whole chapter, or open it and tick single topics. A chapter that is partly chosen is marked as such.
- With **Update the paper automatically when topics change** on (the default), every draft set is rebuilt at once from the chosen topics only. Questions the teacher locked stay, as long as their topic is still chosen. With it off, the topics change and the teacher regenerates when ready.
- **Difficulty mix** (Easy / Medium / Hard) is set per paper, and each section's questions follow it.
- **What the chosen topics hold.** A table shows, for each blueprint section, how many questions are needed, how many the chosen topics have (by difficulty), and how many are short. A shortfall is shown before generating, so the teacher can add topics or questions.

**Sets.**
- Up to 10 sets per paper (**Add a set**, **Make 10 sets**, **Remove set**). Each set shows how much it overlaps the others ("Set 2 · 0% overlap"). New sets avoid the questions on the other sets while the chosen topics have enough.
- For each set: marks and time against the blueprint, with a message if anything doesn't match. Tools: Generate / Regenerate, Fill empty slots, Shuffle the paper (within sections), Undo, Version history (the last 25 changes, each restorable).
- Each question: Move up / down, Replace (another question of the same kind from the chosen topics), Replace from the bank, Add OR (an internal choice from a different topic), Edit for this paper only (the bank keeps the original), Lock, Remove. Each section: Add from the bank, Write a new question (saved to the bank as a draft for review).
- **Bank picker:** filter by chapter, type, difficulty and marks, and search. Questions already used this year are tagged.

**Approval per set.**
- Draft → **Send for approval** → **Approve** or **Send back** (with a note). The sender can **Take back** a set before it is decided. An approver can **Reopen as draft** until the exam starts.
- Who approves: the Principal, the Admin, or a senior teacher (Vice Principal, Head of Teaching Staff, Head of Department, Academic Director, Coordinator). The approver must be someone other than the sender (the Admin excepted).
- A set waiting for approval, or approved, can't be changed. Each action asks for confirmation first.
- **Choose the set for the exam** from the approved sets. It can be changed until the paper's start time; after that it is fixed. The other sets are sealed.
- **Print** the paper, the **Answer key**, or the **Teacher's copy** (questions with answers and marks). **Viewed by** lists who opened the paper and when.

**Approved Papers.** By exam: each paper with "n of m sets approved", the chosen set, and Print / Answer key / Teacher's copy.

**Question Bank.** Pick a class and subject to see its chapters (with term and question counts), add or rename a chapter and its topics, and filter questions by chapter, type, difficulty and term. Questions can be added, edited, duplicated, approved and archived. Only approved questions go into papers. Question types: MCQ, True / False, Fill in the blank, One word, Assertion–Reason, Very short, Short, Long and Case-based.

**Blueprints** (replaces Paper Formats). Name, exam, total marks, time, classes, subjects, board, chapter rule and general instructions, plus sections: title, question types allowed, number of questions, marks each, and how many get an OR. The marks total is shown as sections change. Blueprints can be copied and archived. The demo has unit-test (25 marks) and term-exam (80 marks) blueprints for classes 6–8 and 9–10.

**Demo data.** NCERT chapter names for Class 6, 9 and 10 Mathematics and Class 8 and 10 Science, with a question bank of about 3,000 questions across topics, types and difficulties. Unit Test 2 has a Class 10 Mathematics paper with three sets (Set 2 approved and chosen) and a Class 6 Mathematics draft. The guided demo "Exams" walks through it: a teacher unticks a topic, adds a set and sends it; the Principal approves and chooses the set; the paper is printed from Approved Papers.

- **Database (`018_question_paper_workflow.sql`):**
  - `exams` and `exam_schedule` (each class × subject paper with date and start time); one paper per timetable entry.
  - Blueprints: `paper_formats.exam_kind`, `chapter_rule`, `archived`; `paper_format_sections.allowed_qtypes`; `chapters.term`.
  - `question_papers.exam_id`, `schedule_id`, `chosen_set_id`, `auto_update`; `paper_sets.set_no`, `status`, `submitted_by`, `decided_by`, `note`; `paper_questions.locked`, `edited_stem`, `edited_marks`.
  - `paper_versions` (snapshots for undo and history) and `paper_views`.
  - `generate_topic_set()` fills a set only from the chosen topics, follows the difficulty mix, spreads across topics, avoids other sets' questions, keeps locked questions and adds OR questions.
  - `set_paper_topics()` changes the topics and rebuilds the draft sets when automatic update is on.
  - `v_paper_topic_availability` shows what the chosen topics hold per section.
  - `decide_paper_set()` (submit, approve, send back, take back, reopen) and `choose_exam_set()` enforce the approval rules; a trigger blocks changes to submitted and approved sets.

## Added 18 Nov 2026 (release 9, revised in 9.1)

**Users screen (Operations → Users).**
- **Filters:** search (name, email, mobile, designation or student), **Role**, **Department** and **Status** (Waiting for approval, Active, Locked).
- **Columns:** Name, Sign-in ID, Role, **Department**, Designation, **Student (parents)**, **Created**, Last sign-in, Status.
  - **Student (parents):** each child's name, grade and admission number.
  - A parent's designation shows **N/A**.
- **25 users to a page**, with Previous, Next and page numbers.
- **↻ Refresh** loads the latest changes, including those made in Roles & Permissions. Accounts that no longer fit after a change are marked ⚠ with the reason.
- **Statuses:** Waiting for approval (staff sign-ups only), Active, Locked, Deleted. **Switched off** was removed; any switched-off accounts became Locked.
- **Reset password** shows only for the **Admin** role, or for a person the Admin gives the permission to (Edit user → Permissions → *Can reset passwords*). The database refuses a reset from anyone else.

**Parents never wait for approval.**
- When a parent registers (website or phone app), they give the student's **admission number**, **name** and **grade**.
- All three must match an enrolled student. Case, spacing and word order don't matter, and the first name must be included.
- On a match, the account is created **Active**, linked to the child, and the parent can sign in at once.
- A mismatch creates no account. The message is the same whichever detail was wrong, and it says how many tries are left. After 5 wrong tries, that email or mobile must go through the school office.
- Staff sign-ups still waited for approval in release 9; from release 10 they are checked against the staff record instead.
- **Add user** for a parent asks for the same three details and checks them the same way.
- Parent accounts that were waiting from before became Active if their child is on the record, or Locked if not. The database refuses any parent account left waiting for approval.

**Deleting and the archive.**
- **To delete:** Edit → Status **Deleted** → pick a reason (Left the school, Child left the school, Duplicate account, Asked to close the account, Other) → confirm. The sign-in is removed and a copy moves to **Users → Archived**.
- **Archived is view only.** Columns: Name, Sign-in ID, Role, Department, Designation, Student (parents), Email, Mobile, Created, Last sign-in, Deleted on, Reason, Deleted by.
- **Archive filters:** search, role, department, reason, and a deleted-between date range. 25 to a page.
- Accounts can't be brought back from the archive; Rejoin and its statuses were removed.
- **Someone coming back** is added as a new user. **Add user → Coming back? Copy details from the archive**: search by name, email, mobile or student, then **Copy details**.
  - This fills in the name, sign-in ID, email, role and designation, and for a parent the student's admission number, name and grade from today's record.
  - Anything that no longer fits is pointed out: a profile that no longer exists, a designation no longer offered, contact details that weren't kept, a child no longer enrolled, or a child's new grade.
  - The new account goes through the usual checks (parents against the student record). It records which archive entry it was copied from, and the archive entry stays unchanged.
- When people delete their own account (app or web), their sign-in ID, email and mobile are not kept, because they asked for them to be erased.

- **Database:**
  - `019_users_parents_archive.sql`:
    - `match_student()`.
    - `parent_signup_checks` (5 tries).
    - `users.updated_at`, `updated_by` and `last_change`, kept for the audit.
    - `user_archive` and `archive_user()`.
    - `close_account()` with a reason (archives first), and `close_own_account()`.
  - `020_users_status_reset.sql`:
    - `register_parent()` checks first, then creates the account Active, or creates nothing.
    - A deferred trigger stops any parent account being left Waiting for approval.
    - No DISABLED status.
    - `user_permissions`, `can_reset_passwords()` and `request_password_reset()`.
    - Rejoin removed.
    - `v_user_directory` shows the created date and N/A for parents.
  - `021_copy_from_archive.sql`:
    - `users.copied_from_archive`.
    - `v_archive_copy`: the archived details with today's state beside them (profile still exists, children still enrolled, contact details already in use).

## Added 18 Nov 2026 (release 9.3)

**Accounts come from registration.**
- **The normal way in:** parents and staff create their own accounts by registering on the school website or in the app. Parents are checked against the student record and are Active at once; staff waited for approval until release 10, which checks them against the staff record.
- **Add user is for exceptions.**
  - Only the **Admin** role sees it. People who can open Users by designation or personal grant (for example the Vice Principal) can't add anyone.
  - The Admin must give a reason: has no email or mobile of their own, needs help to register, coming back (details from the archive), or other (typed).
- **How each account was created** is shown in Edit user: Registered on the website, Registered in the app, Added by the Admin (with the reason), or Set up with the school (the first Admin accounts).
- **Database (`022_account_source.sql`):**
  - `users.created_via` (WEBSITE, APP, ADMIN, SETUP) and `admin_add_reason`, which is required for ADMIN.
  - A trigger refuses ADMIN-created accounts unless the person acting is an Admin.
  - `register_parent_via()` records the channel.
  - `v_user_source`.

## Added 18 Nov 2026 (release 10)

### Nobody waits for approval

Every account opens as soon as the details given at registration match the school's records.
- **Parents:** the student's admission number, name and grade must match the student record (release 9).
- **Staff:** the employee code, their name, and the email or mobile the school has on the staff record must match.
  - The role and designation come from the staff record. For example, PRT gives Teacher · PRT, and Driver gives Transport team.
  - Staff no longer pick a role at sign-up.
- **On a mismatch** nothing is created. The same message shows whichever detail was wrong, with the tries left (5 per sign-in ID).
- **The school's part** is keeping the student and staff records up to date (Staff → Add Staff), not approving accounts.
- **"Waiting for approval" is no longer a status.** Statuses are Active, Locked and Deleted. Older pending accounts became Active if they match a record, and Locked otherwise.
- **Database (`023_register_no_approval.sql`):**
  - `register_staff_via()` and `role_for_designation()`.
  - `users.staff_id`.
  - No PENDING status.

### Dashboard in sections

The dashboard has tabs. Each section compares this year with last year (2025-26) using ▲ / ▼ arrows.

| Section | Who sees it | What it shows |
| --- | --- | --- |
| Students | All staff | Total students with change; new enrolments this year (boys / girls); grades over their limit; seats free. For co-ed schools, a boys / girls table (last year, this year, change). A column per class split into boys and girls, with the grade limit marked and ▲ (over) / ▼ (seats free) above each column. A table of every grade against its limit, and new enrolments by class. **Edit grade limits** (Admin, Principal) sets the limit per grade and whether the school is co-educational. |
| Staff | Admin, Principal, Accountant | Total staff with change; joined this year; students per teacher against the norm (30); staff by department split men / women; men / women last year vs this year; list of joiners. |
| Transport | Admin, Principal, Transport, Front Office | Students on transport with change and share of students; seats used; full routes and routes under half full; riders per route against the bus's seats, with last year's riders. |
| Fees | Admin, Principal, Accountant | Collected, with change against the same time last year; collected as % of what is due so far against the target (95%); still to collect; overdue. By class against the target. |
| Enrolment | Admin, Principal | Accounts registered this year from the website, the app or added by the Admin, each with change; a bar of the split; the list of who registered (filter by source, search, 25 at a time). |
| Needs attention | Everyone | The previous to-do list and recent activity. |

Charts have a legend, a tooltip on hover and keyboard focus, a **Show as table** view, and colours checked for colour-blind readers in light and dark mode.

## Added 18 Nov 2026 (release 11)

### Settings menu

Screens that set up the school and the app, rather than day-to-day school work, are in a **Settings** menu. **Operations** keeps user management and data upload (revised in release 11.1).

| Menu | Group | Screens |
| --- | --- | --- |
| Operations | User management | Users; Roles & Permissions |
| Operations | Data upload | Data Import |
| Settings | School setup | Appearance & Branding; Website & Links; Web & App Screens; Templates; Bank & Payment Details (moved from Accounts) |
| Settings | Messages | SMS Gateway; Email & SMS Outbox |

- **Who sees what is unchanged.** Screen codes stay the same, so role, department, designation and personal permissions carry over. Settings shows only the screens a person already had. For example, the Accountant sees Bank & Payment Details, Templates and the Outbox.
- **Always on.** The Platform Console can't switch Operations or Settings off for a school, so the Admin can always reach Users and Roles. Single screens inside them can still be switched off.
- **Not moved:** My Preferences and My Account (personal, in My Space), View as Profile (Admin tool, its own menu), Fee Structure and Concessions (used in fee work, in Fees), and Classes & Sections (in Academics).
- **Database:** `024_settings_menu.sql` turns the Operations menu and plan feature into Settings, moves Bank & Payment Details under it, adds `menus.menu_group` for the groups and a trigger that stops Settings being switched off. `025_operations_menu.sql` brings Operations back with Users, Roles & Permissions and Data Import (and the self sign-up, custom roles and photo import functions), gives everyone who could open those screens the Operations menu, and stops Operations being switched off too.

## Added 18 Nov 2026 (release 12)

### 1. Dashboard: insights, not only counts

Every section now opens with **What this tells you**: a few plain-language observations worked out from the figures (for example "Part-time staff are 24% of the headcount but 12% of the salary bill", "R3 gained the most riders", "Bus KA-01-F-4414 broke down 3 times this year — book a full service"). Students, Fees and Enrolment have them too.

- **Staff:** full-time and part-time counts against last year; teaching and non-teaching; **salary paid this year** (April to last month) with the monthly bill; a table of salary **by employee type** (staff, monthly salary, paid this year, average per person, share of salary) and by staff group (teaching and leadership, office and accounts, transport); staff by department split full time / part time; men and women. The list of who joined this year was removed.
- **Transport:** riders against last year; **riders per route with the change against last year**; **buses** (in service, spare, under repair); **breakdowns this year** with delay and riders affected, and a table of every breakdown and of the fleet (last service, fitness date, breakdowns per bus). Transport, Admin and Principal can **Log a breakdown** (taking a bus off the road marks it Under repair until it is back in service).

### 2. Routes, Stops & Timings: route planning, pickup suggestions, route map

- **Plan the route.** Like a ride app, the planner compares the order of the stops: *Shortest drive*, *Farthest stop first* and, where stops are within 600 m walking of each other, *Fewer stops* — each with km, minutes and minutes saved, previewed on the map. **Use this route** reorders the stops and works the times out again so the bus still reaches school on time. The demo's R4 is 13 minutes shorter.
- **Pickup suggestions.** Riders who live nearer another stop (on their route, or another route with seats) — **Move**; and where two or more riders live more than 1.2 km from any stop, a **new stop** between their homes — **Add this stop**.
- **Route map.** A plan view of the route with the school, the stops in order, riders' homes, other routes and suggested stops. **Add a stop** by clicking the map (it goes where it adds the least driving), **Move** a stop, **Remove** one with no riders. Edit timings has **Work out times from the map**. Driver route sheets pick up every change.
- In production the map uses real coordinates and road distances from a maps service; the planning rules are the same.

### 3. Student Profile (Students → Student Profile)

Find a student by grade, section or name; four tabs:
- **Personal profile:** details, family and who else can collect, transport stop and times, fees.
- **Academic profile:** class, board, class teacher, coordinators, subjects and teachers, co-scholastic grades, teachers' comments.
- **Performance:** % per subject for Periodic Test 1, Half-yearly, Periodic Test 2 and Annual; overall %; **rank in the section and the grade**; compared with classmates (score, rank, "better than x% of the grade", grade average and top score, a strip showing where the student sits, and each subject against the grade average).
- **Attendance report:** month by month and for the year.

Parents see the same profile for their own child in My Child.

### 4. Attendance registers

Students → Attendance and Staff → Staff Attendance are registers: **one row per person, one column per day**, with **From / To** and quick ranges (Today, This week, This month, Last month). Tap a cell to switch Present → Absent → Late (staff: Absent → Half day). Approved leave shows as L and is locked; Sundays and school holidays are greyed; each row totals present, absent and %. The phone app uses 44 × 44 px cells.

### 5. Report Cards (replaces Promote / Transfer)

Promote / Transfer was a description screen only (moving a section to the next grade at year end and issuing transfer certificates); nothing ran behind it. It is replaced by **Report Cards**: pick grade, section, one student or all, and a **term, the whole year or one exam** → Generate → **Print / save as PDF** → **Publish to parents**. A card shows marks per exam, weighted %, CBSE grade (A1 … E), overall result, rank in section and grade, attendance for the term, co-scholastic grades, teachers' remarks and signature lines. Parents are notified and open, print or save it in **My Child → Report cards**.

### 6–8. Staff: Add staff in All Staff; My Leave; approvals with notifications

- **All Staff** has **Add staff** and **Edit** (department, designation, **full or part time**, joining date, pay); the separate Add Staff menu is gone.
- **My Space → My Leave** (every staff role): each leave type with **days a year, taken, waiting and left**; apply with dates or a half day and a reason; Sundays and holidays don't count. Standard types (changeable by Admin and Principal in Leave Requests → Leave types): casual 12 (up to 3 at a time), sick 10 (can be applied after the day), earned 15 (full-time staff, 7 days' notice), maternity 182, paternity 15, compensatory off 5, leave without pay (no limit).
- **Approvers are notified** in the app (🔔 bell in the top bar) and by email: teaching staff → the Principal and the Vice Principal; others → the Principal and the Admin; the Principal → the Admin. Nobody approves their own leave. Approving marks the staff register; the applicant is notified of the decision; the other approver's notification is cleared.
- **Staff → Leave Requests:** waiting for approval, all requests with filters, leave taken by each person, leave types.

### 9–11. Help: user guide by function, FAQs, help documents

- **User Guide & Demo** shows only what applies: *Menus I can open* (default), *Everything in our plan*, or *Everything the platform offers*. Guided demos that need menus outside the plan are hidden. New **Screen by screen** tab: for every screen, what it is for, the **steps in click order** and tips, with a Try button. Three new guided demos (staff leave, report cards, route planning). The functions switched on for the school are listed. `docs/USER_GUIDE.md` has the full screen-by-screen guide, the templates and the FAQs.
- **Help → FAQs:** 30 questions by topic, each shown only to the roles it applies to, with search; plus the school's own questions and documents.
- **Operations → Help Documents & FAQs:** the Admin adds documents (a link or an uploaded file, the menu it belongs to, who can see it, versioned) and the school's own FAQs.

### 11–12. Data Import: conversion templates

Operations → Data Import → **Templates**: 20 predefined templates, one per menu or table, with every column the app needs and a *How to fill* sheet (required, format, example, notes). Download one or **all in one workbook**.

- **Naming convention:** blank `NN_Name_Data.xlsx` (01_Class_Section_Data, 02_Student_Data, 03_Guardian_Data, 04_Staff_Data, 05_Staff_Salary_Data, 06_Leave_Balance_Data, 07_Fee_Structure_Data, 08_Fee_Payment_History_Data, 09_Fee_Concession_Data, 10_Transport_Route_Data, 11_Transport_Stop_Data, 12_Student_Transport_Data, 13_Subject_Teacher_Data, 14_Timetable_Data, 15_Exam_Marks_Data, 16_Student_Attendance_Data, 17_Staff_Attendance_Data, 18_Admission_Enquiry_Data, 19_Question_Bank_Data, 20_Bus_Fleet_Data); filled in `NN_Name_Data_<SCHOOL>_<YYYYMMDD>.xlsx`. The upload is recognised from the file name. Load in number order.
- **Loading:** students and staff go through column mapping and can be rolled back; leave balances, student transport, exam marks and both attendance templates are checked and loaded, and can be rolled back; the others are checked row by row and marked ready for the conversion team to load at go-live.

### Database (`026_release12.sql`)

New menus and permissions; full / part time on staff; school holidays; leave types, allowances, approvers, `apply_staff_leave()` and `decide_staff_leave()` with notifications and the staff register; in-app notifications; report cards and CBSE grades with a rank view; buses, breakdowns, route plans and map positions; staff by employment type; help documents and school FAQs; the 20 conversion templates and their columns.

## Database schema summary

PostgreSQL 15+, twenty-six migration files loaded in order. Every table carries `tenant_id` with row-level security; the app connects as a non-owner role and sets `app.tenant_id` per request. Full detail: `database/README.md`.

| File | Adds | Key tables, views and functions |
| --- | --- | --- |
| 001_core_schema.sql | Core school data | roles, users, menus, role_menu_permissions, staff, students, guardians, enrollments, fee_heads, invoices, payments, payroll, ledger_accounts, vouchers, voucher_lines; v_user_menu, v_student_dues, v_account_statement |
| 002_saas_config.sql | Plans and configuration | plans, plan_features, features (module → sub-menu → function), tenants, tenant_subscriptions, tenant_feature_overrides, tenant_limit_overrides, config_audit, analytics_reports; v_tenant_features, v_tenant_limits |
| 003_exams.sql | Exams | boards, textbooks, chapters, topics, questions, paper_formats, question_papers, paper_sets, paper_approvals, coscholastic_grades; generate_paper_set() |
| 004_theming.sql | Appearance | ui_templates, theme_presets, tenant_themes (versioned), user_ui_preferences; accessible_shade(), publish_theme() |
| 005_payments_timetable_web.sql | Fees, timetable, website | school_bank_accounts, fee_request_campaigns, fee_request_messages, payment_notifications, email_outbox; bell_periods, timetable_entries, timetable_entry_teachers; website_connections, menu_links; payment_plans, transport_bands; assessment_profiles; apply_payment(), match_payment_notification(), amount_in_words_inr() |
| 006_templates_import.sql | Templates and import | template_categories, template_fields, doc_templates, doc_template_versions, template_defaults; import_targets, import_target_fields, import_profiles, import_column_maps, import_value_maps, import_jobs, import_rows; resolve_template(), render_template(), map_and_validate_import(), commit_student_import(), rollback_student_import() |
| 007_auth_admissions_analytics.sql | Sign-up, user management, admissions, analytics | users (Pending status, login type, verified flags, requested role, designation), otp_requests, sms_gateway_config, designation_menu_access, user_menu_grants, user_role_changes; admission_enquiries, admission_status_history; exam_terms, exam_results, section_subject_teachers, transport_routes, transport_trips; request_otp(), verify_otp(), set_user_role(), enrol_applicant(); v_user_screens, v_admissions_by_grade_status, v_student_term_scores, v_grade_rankings, v_teacher_subject_performance, v_transport_route_summary |
| 008_requests_transport_sms.sql | SMS framework, accounts, coordinators, requests, transport | sms_gateway_config (provider, status, endpoint, secret ARN), sms_templates, sms_outbox, sms_delivery_reports; user_children, notification_prefs, account_requests; tenant_settings; class_coordinators; parent_requests, parent_request_history; boarding_log; queue_sms(), close_account(), set_teacher_perf_visibility(), decide_parent_request(), hand_over_student(), trip_manifest(); v_my_teaching_performance; Transport team role |
| 009_route_sheets_collectors.sql | No cut-offs, approved pickup list, stop timings, route sheets, optional attendant tracking | authorised_collectors, v_approved_collectors, parent_requests.collector_id; pickup_points am/pm times, transport_routes school times and attendant; route_sheet_shares, share_route_sheets(), driver_route_sheet(); FN_ATTENDANT_TRACKING enforced on boarding_log; ROUTE_SHEET SMS template |
| 010_concurrency_fixes.sql | Fixes from the concurrency tests | doc_counters + next_doc_no() (receipt numbers), apply_payment() re-checks and locks, one_active_request_per_day exclusion constraint (btree_gist), enrol_applicant() seat lock, hot-path indexes, app_context() (transaction-local school) |
| 011_requests_website_mobile.sql | Leave, late arrival, meetings, office requests; mobile app | parent_requests new kinds and fields, request_decider(), decide_parent_request() by coordinator / teacher / office, mark_late_arrival(), trip_manifest() with leave and late drop-ins; STU_MEETINGS, STU_OFFICE menus; mobile_screen_catalog, tenant_mobile_app, tenant_mobile_screens, v_user_mobile_screens, push_devices |
| 012_web_app_screens.sql | Web & App Screens | role_channel_defaults, channel_layouts (DRAFT → PENDING → PUBLISHED, versions, two-person rule), channel_layout_entries; start/submit/approve/send_back_channel_layout(), screen_channel(); v_user_web_screens, v_user_mobile_screens (replaces the 011 per-school switches) |
| 013_designations_view_as.sql | Designations by role, View as Profile | role_designations, designations_for(), designation_problem() with deferred constraint triggers on users and user_roles, set_user_designation(); VIEWAS / VA_* menus (Admin only, enforced on role, designation and personal grants); view_as_log, start_view_as(), end_view_as(); v_user_directory |
| 014_role_departments.sql | Departments per user profile | role_departments, roles.department, department_of(), set_role_department(); v_user_directory with department |
| 015_designation_removals.sql | Removing designations | role_designation_removals; designations_for() without removed ones; remove_role_designation(), add_role_designation() |
| 016_department_access.sql | Access by department; deleting a profile | department_menu_permissions, sync_department_permissions(), set_department_menu(); v_user_screens by department; v_tenant_profiles, tenant_profile_removals, remove_profile(), restore_profile() |
| 017_access_levels.sql | Read only or full access | department_menu_permissions.access_level, set_department_access(), v_user_screens.access_level, can_edit_screen(), v_access_summary |
| 018_question_paper_workflow.sql | Question papers by topic | exams, exam_schedule, blueprint chapter rules, set status and approval, locked questions, paper_versions, paper_views; generate_topic_set(), set_paper_topics(), v_paper_topic_availability, decide_paper_set(), choose_exam_set() |
| 019_users_parents_archive.sql | Users screen, parents checked against the student record, archive | match_student(), parent_signup_checks; users.updated_at / updated_by / last_change (audit); user_archive, archive_user(), close_account() with reason, close_own_account(); v_user_directory with department and students |
| 020_users_status_reset.sql | Parents never pending, no switched-off status, reset-password permission, view-only archive | register_parent(), parent_not_pending deferred trigger; users_status_check without DISABLED; user_permissions, can_reset_passwords(), request_password_reset(); rejoin removed; v_user_directory with created date, N/A for parents |
| 021_copy_from_archive.sql | Someone coming back: copy details from the archive | users.copied_from_archive; v_archive_copy (profile exists, children still enrolled, contact in use) |
| 022_account_source.sql | Accounts come from registration | users.created_via (WEBSITE / APP / ADMIN / SETUP), admin_add_reason; admin_added trigger (Admin only); register_parent_via(); v_user_source |
| 023_register_no_approval.sql | Nobody waits for approval | register_staff_via() (employee code, name, email/mobile on the staff record), role_for_designation(), users.staff_id; PENDING removed from users_status_check |
| 024_settings_menu.sql | Settings menu | Operations menu and feature renamed Settings; ACC_BANK moved under it; menus.menu_group; Settings can't be switched off (trigger) |
| 025_operations_menu.sql | Operations for user management and data upload | Operations menu and feature again, with OPS_USERS, OPS_ROLES, OPS_IMPORT (menu_group User management / Data upload); permissions copied to the Operations heading; Operations and Settings can't be switched off |
| 026_release12.sql | Release 12 | staff.employment_type; STU_PROFILE, STU_REPORTCARD, SELF_LEAVE, OPS_HELPDOCS, HELP_FAQ menus (STF_ADD, STU_PROMOTE removed); school_holidays, leave_types, leave_requests approvals, apply_staff_leave(), decide_staff_leave(), v_leave_balances; app_notifications; report_cards, cbse_grade(), v_student_term_rank; buses, bus_incidents, route_plans, v_fleet_summary; v_staff_by_type; help_documents, school_faqs; import_templates, import_template_columns, template_for_file() |

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
2. Questions come only from the topics chosen for the paper. Changing the topics rebuilds the draft sets (when automatic update is on); locked questions stay if their topic is still chosen.
3. Sets share no question while the chosen topics have enough. The difficulty mix and marks per section follow the blueprint; a set can't be sent for approval unless its marks match the blueprint.
4. Each set is Draft → Submitted → Approved or Sent back. Submitted and approved sets can't be edited. The approver is the Principal, Admin or a senior teacher, and not the person who sent it.
5. Only an approved set can be chosen for the exam, and the choice is fixed once the paper's start time passes.

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

1. One sign-in ID per account (email or mobile) per school. Accounts open at once when the details match the school's records: parents against the student record (admission number, name, grade), staff against the staff record (employee code, name, email or mobile on file). 5 wrong tries per sign-in ID, then the school office. Nobody waits for approval.
2. Passwords: 8+ characters, upper and lower case, number, symbol, not the person's name; never emailed or shown.
3. One-time codes: 6 digits, 10 minutes, 5 tries, single use, at most 5 per address per hour; only a hash is stored.
4. 5 wrong passwords lock the account.
5. Only Admins, or people given the Users screen by designation or personally, manage users. Nobody changes their own role; only an Admin gives the Admin role. Every change is logged.
6. A parent account is linked to a child by admission number, checked against the student record (name and grade too).
7. Deleting an account (Edit → Status Deleted) archives it first, with a reason. The school keeps the contact details of accounts it deletes; for people who delete their own account, only their name, role and children are kept. The archive is view only.
8. Statuses are Active, Locked and Deleted.
9. Only the Admin role, or a person the Admin gives the permission to, can reset passwords.
10. Accounts are created by registering on the website or in the app. Only the Admin adds someone directly, as an exception with a recorded reason.

**Admissions**

1. Moves allowed: Enquiry → Submitted → In review → Offered → Enrolled; Opted out from any open step (reason required); Opted out → Enquiry to reopen.
2. An offer needs the birth certificate and photo; enrolment needs a free seat in the grade.
3. Enrolment creates the student and guardian (siblings share a guardian by mobile) and emails the admission letter.

**Analytics**

1. Rankings club all sections of a grade unless sections are picked; ties share a rank.
2. Pass mark 33%; distinction 75%.
3. Teachers see rankings only for their own classes in Power BI.

**Pickup, drop and early leave**

1. No cut-off times: pickup, drop and own-transport changes are confirmed whenever they are sent. Early leave always needs a coordinator. Pickups and early leaves need a person from the child's approved pickup list.
2. Early leave is before 15:00, on one day; one request of a kind per child per day.
6. Approved pickup people need a photo and the last 4 digits of a photo ID, and are usable only after the school checks the ID.
7. Stop timings: morning stops in order and before the bus reaches school; afternoon drops after it leaves. Each driver receives only their own route's sheet.
8. Attendant boarding tracking works only where the platform team has switched it on.
3. Only the section's primary or secondary coordinator (or the Principal) can approve; declining needs a reason.
4. A child is released at the gate only for an approved request with the matching 4-digit code; hand-over time and staff are recorded.
5. Manifest order of precedence: Absent → Not boarding (approved request) → Check (request waiting) → Will board.

**Leave, late arrival, meetings and office requests (release 5)**

1. Leave needs a reason; the class coordinator approves; approved leave marks attendance *Leave* on each school day (not Sundays) and the bus does not wait.
2. Late arrival is after 08:45 and before 15:00 on one day, confirmed at once; the gate marks *Arrived* and attendance becomes *Late*.
3. A meeting can be asked only of the child's subject teachers or class coordinators, at most one per teacher per day; only that teacher replies, with a date and time, or declines with a note.
4. Office requests go to people with the Office Requests screen; any number may be open.
5. All duplicate checks are enforced by the database, so two taps at the same moment cannot create two requests.

**Web & App Screens (release 6)**

1. Only phone-ready screens can be put in the app; Account is always on both.
2. Only an Admin or the platform team edits; only the Principal or the platform team approves; the approver must be a different person; one open draft per school.
3. A draft or pending change never affects users; publishing creates a new version and keeps the old one.
4. "App only" removes the screen from that role's website menu; links to it from the website open the person's home screen.

**Mobile app and website links (release 5)**

1. A mobile tab shows only if the school has the app on, the screen is on for the app, and the website rules allow it for that person.
2. Home and Account can't be switched off; parents can delete their own account in the app or on the web.
3. Deep links never widen access; signed-in screens are not embedded in other sites.

**Simultaneous use (release 5)**

1. Receipt numbers come from a locked per-school counter; a bank line is receipted once even if two people match it together.
2. Enrolment locks the grade's sections, so the last seat is never given twice.
3. The API sets the school per transaction (`app_context`), never per connection.

**SMS and accounts**

1. Nothing is sent by SMS until a provider is live; SMS waits in the queue. Keys are never stored in the app or database.
2. Changing email or mobile needs a code sent to the new one; changing a password needs the current one.
3. Only people who manage users can delete accounts; deletion erases sign-in and contact details, not school records.
4. Teacher performance is visible to teachers only while shared by the Principal or Head of Teaching Staff, and then only their own results.

## Templates and data import

**Templates (Settings → Templates).** Eight document types ship with a standard template: fee invoice, fee receipt, fee request email, payment confirmation email, fee reminder SMS, payslip, admission letter and appreciation card. The database seeds 16 types; the rest (timetable, assessment profile, question paper, ID card and others) follow.

1. **Use standard** — nothing to do.
2. **Copy & edit** — edit HTML with `{{placeholders}}` and repeating rows `{{#items}}…{{/items}}`; live preview with sample data.
3. **Upload existing** — HTML is used directly. A PDF, Word file or image is kept as the reference copy, and the layout is rebuilt with placeholders.
4. **Choose who uses it** — the template used is the user's choice, else their role's, else the school default, else the standard.

**Data import (Operations → Data Import).** 20 conversion templates, one per menu (release 12, see above), plus any Excel, CSV or photo for students (with guardians) and staff through the steps below.

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

**Production back end (next phase).** Cognito sign-in with OTP, API on ECS Fargate, Aurora PostgreSQL with the twenty-six migrations (behind RDS Proxy, with a read replica for manifests and reports), SES email, an SMS gateway with DLT templates, Razorpay/Cashfree webhooks, Textract for photos, Power BI Embedded for Insights. All run in ap-south-1 (Mumbai).

**Automated tests (release 12).** See `docs/TEST_REPORT.md`: 70 app tests, 44 SQL check groups (007–026), 10 concurrency and load tests (`database/tests/concurrency/run.sh`), 32 web end-to-end tests (including the release 12 flows: dashboard insights and breakdowns, student profile, attendance registers, report cards to a parent, staff leave with notifications, route planning and a new stop, FAQs, help documents and templates; the dashboard sections, staff registration against the staff record, Add user for the Admin only with a reason, copying a returning person's details from the archive, the Users filters, columns, paging and Refresh, parent sign-up checked against the student record, delete as a status with the view-only archive, reset password by permission, the question-paper flow from topics to approval and print, the question bank and blueprints, every step of all 16 guided demos, Main menu, designations by role, app sign-up, View as, the User management tab, removing designations, the collapsed side menu, permissions by department with access levels, read-only screens, the access summary and deleting a profile) (`npm run test:e2e`) and 12 mobile store-readiness tests (`npm run test:store`), all run by `.github/workflows/tests.yml` and `mobile.yml`.

**Earlier automated tests.** `npm test` ran 21 checks on the business rules (including the approved pickup list, route sheets, the attendant-tracking switch, requests, gate codes, manifests, the SMS framework, performance visibility, sign-in and OTP, designation access, analytics and admissions), and `database/tests/007_checks.sql`, `008_checks.sql` and `009_checks.sql` test the SQL. The earlier checks cover amount in words, payment posting, fee requests and SMS fallback, auto-matching (link, narration, duplicate, unmatched), parent UTR then bank line, import mapping and rollback, paper sets without repeats, templates and sanitising. All pass. A browser run opened every screen for all ten demo sign-ins (eight roles plus two designations) with no errors.

**User-testing script.** Easiest: open the guide (`#/p/guide`) and run the guided demos. Or step by step:

- [ ] Phone app (`#/p/mobile`, GVS) → Create an account as a Parent → admission no. ADM-2025-0231, name Aarav Sharma, grade Grade VII (refused, 4 tries left) → Grade VIII → the account is ready; sign in at once
- [ ] Admin: Users → Role filter Parent → no parent waits for approval; designation N/A; Aarav Sharma · Grade VIII · ADM-2025-0231; Created date; Department filter; 25 to a page
- [ ] Admin: Roles & Permissions → rename the Teacher department; Users → ↻ Refresh → the Department column and filter show the new name
- [ ] Admin: Users → Edit a driver → Status Deleted → reason Left the school → confirm → Archived (view only) → filter by reason and date
- [ ] Admin: Users → Add user (Admin only) → pick a reason → create; Edit shows "Added by the Admin — reason"; as the Vice Principal there is no Add user
- [ ] Admin: Users → Add user → Coming back? search the driver's name → Copy details → Create → the driver is Active again; the archive entry is unchanged
- [ ] Admin: Users → Edit the Vice Principal → Permissions → Can reset passwords; sign in as the Vice Principal: Reset password shows; without the permission it doesn't
- [ ] Teacher: Exams → Question Papers → Unit Test 2 → Start Class 9 Mathematics → untick a chapter: the paper is rebuilt without it → Add a set → Send for approval; Principal: Approve → choose the set → Approved Papers → Print
- [ ] Admin: Main menu → View as Profile → Parent → switch to Phone app → try to send a request (blocked: preview only) → Back to Admin
- [ ] Admin: Users → Add user → Role Transport team: only Transport designations; Role Parent: designation N/A
- [ ] Phone app (`#/p/mobile`, school GVS) → Create an account as School staff: Kavya Iyer, kavya.iyer@example.com, employee code EMP-0131 → the account opens at once as Teacher · PRT
- [ ] Admin: Dashboard → Students (arrows, boys and girls, columns per class with grade limits; Edit grade limits) → Staff → Transport → Fees → Enrolment (filter by Mobile app)
- [ ] Admin: Web & App Screens → Front Office → Gate Desk "App only" → Send for approval; Principal approves; Front Office no longer has Gate Desk on the website, but has it in the phone preview
- [ ] Admin: Dashboard → Staff (full and part time, salary by employee type, What this tells you) → Transport (riders per route against last year, buses, breakdowns → Log a breakdown)
- [ ] Transport: Routes, Stops & Timings → R4 → Plan the route → Shortest drive → Use this route; R2 → Pickup suggestions → Add this stop → Route map; Driver Route Sheets show the new stop
- [ ] Teacher: Students → Student Profile → Aarav → Performance (ranks, compared with classmates) → Attendance report; Students → Attendance → This month → tap a cell
- [ ] Principal: Students → Report Cards → Grade VIII, A, Term 1 → Generate → Print → Publish; Parent: 🔔 → Report card ready → Open
- [ ] Teacher: My Space → My Leave → Casual leave next week → Send; Principal: 🔔 → Leave Requests → Approve; Staff Attendance shows L; Teacher: 🔔 shows the decision
- [ ] Admin: Staff → All Staff → Add staff (Part time); Operations → Help Documents & FAQs → add a question and a document; Parent: Help → FAQs shows them
- [ ] Admin: Operations → Data Import → Templates → Download all → fill 12_Student_Transport_Data → upload as 12_Student_Transport_Data_GVS_<date>.xlsx → Load → Import history → Roll back
- [ ] Anyone: Help → User Guide & Demo → Screen by screen; switch Menus I can open / Everything in our plan
- [ ] Admin: side menu → Operations → User management (Users, Roles & Permissions), Data upload (Data Import); Settings → School setup (Bank & Payment Details now here), Messages; Accountant: no Operations, Settings shows only Bank & Payment Details, Templates and the Outbox; Platform team: Schools & Plans → Operations and Settings show Always on
- [ ] Anyone: Help → User Guide & Demo → run a guided demo with Start / Next step

- [ ] Parent: Requests to School → Leave for next week; Coordinator (Sonia) approves; Attendance shows *On leave*; the route sheet says *On leave*
- [ ] Parent: Late arrival today at 10:30; Front Office: Gate Desk → Expected late arrivals → Arrived
- [ ] Parent: Meet or call a teacher → pick the Maths teacher; that teacher: Parent Meetings → Reply → confirm a time
- [ ] Parent: Other request → Bonafide certificate; Front Office: Office Requests → Mark done
- [ ] Admin: Website & Links → copy the admission form snippet; open `#/p/apply` signed out and send an enquiry; see it in Admissions
- [ ] Admin: Web & App Screens → Parent → Fee Dues & Pay "Website only" → send; Principal approves → phone preview as the parent: the Fees tab is gone
- [ ] Phone preview (`#/p/mobile`): school code GVS → each demo account → check the tabs; Account → Delete my account
- [ ] Parent: Pickup & Leave Requests → Approved pickup list → Add a person (with photo); Front Office: Gate Desk → Approve pickup people; the parent can now choose them for a pickup
- [ ] Transport: Routes, Stops & Timings → edit a stop time; Driver Route Sheets → Route R3 → What the driver sees → Send to all drivers
- [ ] Platform team: Schools & Plans → Functions → switch Bus attendant boarding tracking off for Green Valley; the Boarded / No-show column disappears
- [ ] Parent (rohit.s@example.com): Pickup & Leave Requests → Early leave tomorrow → the class coordinators get it
- [ ] Coordinator (sonia.teacher@example.com): Coordinator Desk → Approve; the parent sees the gate code
- [ ] Front Office (mobile 9845011200): Gate Desk → enter the code → Hand over
- [ ] Transport (transport@greenvalley.example.in): Daily Bus Manifest → morning and afternoon, today and tomorrow
- [ ] Head of Teaching Staff (murali.hots@example.com): Teacher Performance → Share with teachers; then the teacher sees My Teaching Performance
- [ ] Parent: My Account → change mobile, change password, ask to close the account; Admin handles it in Users
- [ ] Admin: Settings → SMS Gateway → choose MSG91 or Amazon SNS → fill DLT IDs → Dry run
- [ ] Staff: Create account with a Gmail that is not on the staff record → refused, tries left shown
- [ ] Anyone: Create account with a mobile number (code shown on screen until SMS is connected)
- [ ] Admin: Roles & Permissions → Permissions by department → Transport → tick Fees (whole menu) → expand it → untick Collect Fee; View as → Transport team shows Fees without Collect Fee
- [ ] Admin: Permissions by department → Transport → Transport → Routes, Stops & Timings: Read only; View as Transport team (tick Act as) → Edit timings → Save is refused with a Read only message
- [ ] Admin: Access summary → Transport department → Show access of Manjunath Gowda → screens marked Full / Read only
- [ ] Admin: User management → Add Hostel Staff from the standard list → it appears with department Hostel & Boarding → Delete it (confirm)
- [ ] Admin: Roles & Permissions → User management → rename Teacher's department; add a profile "Hostel Warden" (department Hostel, designations Hostel Warden, Assistant Warden); Users → Add user → Hostel Warden offers those designations
- [ ] Front Office: Admissions & Enquiries → Application form → move it to In review, Offered, Enrolled; check the summary by grade
- [ ] Principal: Data Analytics → Top & Bottom Performers → Grade IX, all sections, then pick S1 and W1
- [ ] Principal: Teacher Performance and Transport Reports with a grade filter
- [ ] Admin: Data Import → "Use a sample old-ERP export" → check the row messages → import → roll back from history
- [ ] Accountant: Fee Request Emails → Grade VIII → Preview → Send; then Payment Matching → simulate each kind; check remarks, receipts and the outbox
- [ ] Parent: Fee Dues & Pay → pay online; and pay by bank transfer with a UTR
- [ ] Teacher: Question Papers → open Class 6 Mathematics → Make 10 sets → check the overlap pills → Shuffle a set → Version history → restore the version before the shuffle
- [ ] Admin: Templates → Copy & edit the invoice → make it the school default → open an invoice in Dues
- [ ] Admin: Appearance → change template and colour → Publish
- [ ] Platform team: switch Payroll off for a school, then sign in as Accountant there

## Open questions

- Payment gateway: Razorpay or Cashfree? Who holds the merchant account, our company or each school?
- SMS provider and DLT sender ID: one for the platform, or per school?
- Which state boards come after Maharashtra, Karnataka, Tamil Nadu, Telangana and Andhra Pradesh, and who loads their chapters and topics?
- Question bank content: written by schools, licensed from a publisher, or AI-drafted then reviewed?
- Data retention for students who leave (and for rolled-back imports), and how long the archive of deleted accounts is kept.
- ~~Rejoining~~ — decided: someone coming back is added as a new user, with details copied from the archive (release 9.2).
- Should parent sign-up also ask for the student's date of birth? Classmates may know a child's name, grade and admission number.
- Plan prices per tier and add-on, to fill `plan_prices`.
- SMS OTP provider (MSG91, Gupshup or Amazon SNS) and the DLT-approved OTP template.
- ~~Can parents sign up themselves?~~ — decided: accounts come from registration on the website or in the app; the Admin adds someone only as an exception, with a reason (release 9.3).
- Should the teacher index be shown to teachers themselves, or only to the Principal?
- Admission fee and offer expiry: is 7 days right, and does an unaccepted offer move to Opted out automatically?
- ~~Cut-off times~~ — decided: no cut-offs; a route sheet is shared with every driver instead.
- Should bus attendants use a phone app to mark Boarded / No-show, with GPS for on-time reporting?
- ~~Pre-approved collectors~~ — decided: yes, approved pickup list per child with photo and ID check.
- Push notifications: Firebase Cloud Messaging for both platforms, or APNs directly for iOS?
- Google Play account: organisation (no 14-day closed test) — do we have a D-U-N-S number?
- ~~Mobile app: one shared app or branded apps~~ — decided: one shared multi-school app.
- Confirm the recommended phone screens per role (release 6 table) before the first store submission.
- Leave policy: are the standard allowances right (casual 12, sick 10, earned 15, compensatory off 5), and does unused leave carry forward?
- Report card format: does the school want its own layout (Settings → Templates), and is the weighting right (periodic tests 10% each, term exams 40% each)?
- Route map provider (Google Maps or OpenStreetMap) and whether drivers log breakdowns from the route sheet link.
- Year-end promotion and transfer certificates were never built (Promote / Transfer was a description only). Build them as a year-end step?
