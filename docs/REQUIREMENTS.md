# School Management Platform — Requirements

Updated 17 Nov 2026 (release 2: sign-in, user management, admissions, Data Analytics; release 3: pickup/drop/early-leave requests, class coordinators, transport manifests, SMS framework, account self-service, teacher-performance visibility; release 4: no cut-offs, driver route sheets with stop timings, optional attendant tracking, approved pickup list; release 5: leave, late arrival, teacher meetings and office requests, website links, mobile store app, concurrency fixes and full regression; release 6: Web & App Screens per role with approval workflow, recommended phone defaults, in-app user guide with guided demos; release 7: opens on a Main menu, designations by role, account creation in the app, Admin View as Profile). Live, editable copy: https://claude.ai/artifact/7s89uC65LFcsiKfvBBeLdy

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
11. **Mobile.** Parents and staff use one store app (Google Play and App Store, built with Capacitor from the same code) with a small set of screens that each school switches on, under the same access rules as the website. The web app also installs as a PWA.
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

14 modules hold 67 screens plus the sign-in pages, and all of them open in the test build. Column-level detail per screen is in the client review PDF (`docs/School_Platform_Client_Review.pdf`), and the visual designs are on the design canvas.

| Module | Screens | Key fields and actions |
| --- | --- | --- |
| Dashboard | Dashboard | Students vs plan limit, staff, fees collected, overdue, needs-attention list, recent activity |
| Students | Insights, All Students, Admissions & Enquiries, New Admission, Attendance, Coordinator Desk, Parent Meetings, Office Requests, Gate Desk, Promote / Transfer, Documents & ID Cards | Admission no. (generated), name, gender, DOB, class-section, house, guardian name/relation/mobile/email, transport band |
| Staff | Insights, All Staff, Add Staff, Staff Attendance, Leave Requests | Employee code, short code (timetable), department, designation, mobile, email, basic pay |
| Academics | Classes & Sections, Boards Syllabus & Textbooks, Timetable | Board, chapters, topics; timetable cells "SUBJECT TEACHER", grade-wide blocks, teacher clash check |
| Exams | Question Papers, Approved Papers, Question Bank, Paper Formats, Co-Scholastic Grades, Assessment Profiles | Format, chapters, difficulty mix, Sets A/B/C; approve and lock; print; A/B/C grades; subject comments and appreciation card |
| Fees | Insights, Collect Fee, Fee Request Emails, Payment Matching, Dues & Reminders, Receipts, Fee Structure, Concessions | Grades, instalment, due date; source, UTR, narration, amount, match status; invoice and receipt in the school's template |
| Transport | Daily Bus Manifest, Pickup & Drop Changes, Routes & Riders | Date, morning/afternoon trip, route; riders by stop with Will board / Not boarding / Absent / Check and the reason |
| Data Analytics | Report Catalogue, Top & Bottom Performers, Transport Reports, Teacher Performance, Admissions Funnel | Grade, sections, term, subject filters; Power BI pages |
| Payroll | Run Payroll, Payslips | Basic, HRA, DA, transport, PF, TDS, net; approve and post |
| Accounts | Bank & Payment Details, Account Statement, Income & Expenses | Holder, bank, branch, account (encrypted), IFSC, UPI ID, QR; ledger with running balance |
| Operations | Users, Roles & Permissions, Templates, Data Import, Web & App Screens, Appearance & Branding, Website & Links, Email & SMS Outbox | Permission grid; template versions and defaults; import mapping; theme; menu links |
| My Space | My Child, Requests to School, Fee Dues & Pay, My Payslips, My Teaching Performance, My Account, My Preferences | Parent pay page with online pay or bank transfer + UTR |
| Platform Console | Schools & Plans | Plan per school, module and sub-menu switches, add-ons, mobile app on/off |
| Help | User Guide & Demo | Guided demos, every menu explained, what each role sees |

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

## SMS gateway (Operations → SMS Gateway)

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
  - Delete an account (type DELETE to confirm): sign-in and contact details are erased; fees, marks and receipts stay.

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

Operations → Website & Links → **Links for the school website** gives each school its own addresses and ready-to-paste snippets.

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

Operations → **Web & App Screens**. For each role, each phone-ready screen is set to **Website + app**, **Website only** or **App only**.

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
| Parent | No designation: marked **Parent** |

- Changing the role clears a designation that does not fit.
- Save is refused until a matching designation is picked.
- A school can add its own designations per role in **Roles & Permissions → Designations by role**. A designation that is in use can't be removed.
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

## Database schema summary

PostgreSQL 15+, thirteen migration files loaded in order. Every table carries `tenant_id` with row-level security; the app connects as a non-owner role and sets `app.tenant_id` per request. Full detail: `database/README.md`.

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

**Production back end (next phase).** Cognito sign-in with OTP, API on ECS Fargate, Aurora PostgreSQL with the thirteen migrations (behind RDS Proxy, with a read replica for manifests and reports), SES email, an SMS gateway with DLT templates, Razorpay/Cashfree webhooks, Textract for photos, Power BI Embedded for Insights. All run in ap-south-1 (Mumbai).

**Automated tests (release 7).** See `docs/TEST_REPORT.md`: 40 app tests, 29 SQL checks (007–013), 10 concurrency and load tests (`database/tests/concurrency/run.sh`), 11 web end-to-end tests (including every step of all 16 guided demos, Main menu, designations by role, app sign-up and View as) (`npm run test:e2e`) and 12 mobile store-readiness tests (`npm run test:store`), all run by `.github/workflows/tests.yml` and `mobile.yml`.

**Earlier automated tests.** `npm test` ran 21 checks on the business rules (including the approved pickup list, route sheets, the attendant-tracking switch, requests, gate codes, manifests, the SMS framework, performance visibility, sign-in and OTP, designation access, analytics and admissions), and `database/tests/007_checks.sql`, `008_checks.sql` and `009_checks.sql` test the SQL. The earlier checks cover amount in words, payment posting, fee requests and SMS fallback, auto-matching (link, narration, duplicate, unmatched), parent UTR then bank line, import mapping and rollback, paper sets without repeats, templates and sanitising. All pass. A browser run opened every screen for all ten demo sign-ins (eight roles plus two designations) with no errors.

**User-testing script.** Easiest: open the guide (`#/p/guide`) and run the guided demos. Or step by step:

- [ ] Admin: Main menu → View as Profile → Parent → switch to Phone app → try to send a request (blocked: preview only) → Back to Admin
- [ ] Admin: Users → Add user → Role Transport team: only Transport designations; Role Parent: marked Parent
- [ ] Phone app (`#/p/mobile`, school GVS) → Create an account as Transport team / Driver → Admin sees it in Users, waiting for approval
- [ ] Admin: Web & App Screens → Front Office → Gate Desk "App only" → Send for approval; Principal approves; Front Office no longer has Gate Desk on the website, but has it in the phone preview
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
- [ ] Admin: Operations → SMS Gateway → choose MSG91 or Amazon SNS → fill DLT IDs → Dry run
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
- ~~Cut-off times~~ — decided: no cut-offs; a route sheet is shared with every driver instead.
- Should bus attendants use a phone app to mark Boarded / No-show, with GPS for on-time reporting?
- ~~Pre-approved collectors~~ — decided: yes, approved pickup list per child with photo and ID check.
- Push notifications: Firebase Cloud Messaging for both platforms, or APNs directly for iOS?
- Google Play account: organisation (no 14-day closed test) — do we have a D-U-N-S number?
- ~~Mobile app: one shared app or branded apps~~ — decided: one shared multi-school app.
- Confirm the recommended phone screens per role (release 6 table) before the first store submission.
