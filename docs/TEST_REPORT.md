# Test report — Releases 5 to 9 (regression, concurrency, mobile store readiness)

Date: 20 Nov 2026 · Build: `main` after release 15.1 (all analytics in Data Analytics). Earlier: release 13 (Campus Services: library, hostel, homework, online classes, inventory, events; Service Provider: price list, proposals, demo builder, competition comparison, market review and roadmap)

## Summary

| Suite | What it covers | Result |
|---|---|---|
| App unit tests (`app/tests/*.test.js`) | Fees, matching, roles, admissions, analytics, pickups, route sheets, SMS, new requests, mobile access rules, website links | **108 / 108 pass** (release 15.1 adds 5 in `release151.test.js`: every insight under Data Analytics and none left in Students, Staff or Fees; all 22 reports run with default filters, give KPIs and drill down; a class teacher sees only their sections and the Vice Principal sees all; the Accountant has no Student Profile by default and a grant by hand survives reloads; the nine QA enhancements are backlog items; release 15 adds 6 in `release15.test.js`: add-on-only menus follow the tier in existing schools and stay in step with the price list; the new admission number (≤ 10 characters, never reused); names, dates and duplicates in admissions and enquiries; amounts, counts and times; dates and duplicates in events, books, units and portfolios; parents only for their own children and mobile tidying; release 14.2 adds 1: the additional discount on the final amount — payable a year and one-time, total discount, profit after it, the 15% warning, the 20% cap — and the client's discount rows with no limits, approvals or margins; release 14.1 adds 7 in `release141.test.js`: plan names and the client PDF default, Service Provider only for our company's Admin and never inside a client, demo or trial school, converting a proposal into the school, documents and links, the test-build link opening the school as sold in another browser, filling links with history and sharing rules, regenerating a new version after the proposal changes, the converted seed client; release 14 added 13 in `release14.test.js`: tier bands and base prices, nothing free, basic features versus add-ons in the demo set-up, included and chosen add-ons, WhatsApp with no service, Timings needs Transport, the worked example, margin, profit, operating cost and the maximum discount for 12 plan and size combinations, the Demo Builder changing the proposal and its demo school, saved release 13 proposals upgraded, new menus and functions, curriculum and portfolios, backups round trip and checks, boards and WhatsApp links, the proposal PDF; the three release 13 pricing tests were retired and the attendance test no longer fails when a future day is a holiday; release 13 added 9 in `release13.test.js`: quotes match the pricing plan's worked quotes, tiers, minimums, included add-ons, discounts and warnings, a proposal turned into the demo's set-up, company menus only for the platform and sales teams, library limits and fines, hostel block and capacity, homework, online classes, store stock and the calendar, competitor data with country and source, upgrade of saved data; release 12 adds 8 in `release12.test.js`: menus and the upgrade of saved data, attendance registers, staff leave rules and approvals with notifications, route planning and new stops, CBSE grades, ranks and report cards, full/part-time and salary figures, bus fleet and breakdowns, insights, conversion templates with loading and roll back; release 10 adds 3: staff checked against the staff record, dashboard figures for students and for staff, transport, fees and registrations; release 9 adds 7 user tests: accounts from registration and Admin-only Add user; copying details from the archive; the student-record check for parents, try limit, students shown per parent, archive with and without contact details, no pending parents or switched-off status, N/A designation, reset-password permission; release 8 adds 7 question-paper tests: topics by chapter rule, questions only from chosen topics, rebuild on topic change, locked questions kept, shortfall, sets without overlap, OR and shuffle, approval; release 7 adds designations by role, app sign-up into users, View as Admin-only; 7.1 adds departments; 7.2 removing designations; 7.4 access by department, deleting profiles; 7.5 read only / full access) |
| Database checks (`database/tests/007–032_checks.sql`) | OTP, roles, admissions, analytics, SMS, accounts, visibility, requests, manifest, collectors, timings, route sheets, attendant switch, leave, late arrival, meetings, office requests, mobile screens | **76 / 76 check groups pass** (counted as the NOTICE lines each file prints; 033: nine analytics screens under Data Analytics, Sales Analytics, Accountant without Student Profile in the profile and the department, teachers' analytics own classes only, the add-on's new screens, nine backlog items; 027 now expects six or more Service Provider screens; 032: admission numbers per school and year, numbers already taken skipped, the year restarting at 0001, the duplicate finder, implausible dates of birth and negative marks refused; 031: additional discount up to 20%, approval when profit falls under 15%, the client view has no limits or margins; 030: one company tenant, company Admin only there, Service Provider allowed for our Admin and not a school's, plan names, one project per proposal marking it Won, documents per version, placeholders can't be Ready or shared, old link addresses kept, http refused, shared links marked Shared; 027 and 028 checks now expect six Service Provider screens; 029: new menus and access, the Starter / Pro / Pro+ catalogue and banded price function, zero prices refused, WhatsApp cost 0, proposal discount capped at its maximum, profit = price − operating cost, email marks it Sent and must attach a PDF, curriculum status, portfolio kinds, backup expiry and restore source, exam board, row-level security; 027 checks now use the release 14 plan codes; 028: the Admin has the five Service Provider screens, a Teacher or a department is still refused; 027: Campus and Service Provider menus by plan and role, company menus refused for school roles, library issue limits and fines, hostel block, capacity and one bed each, homework and online-class rules, stock never below zero, events, price list, proposals and demo schools, school isolation; 026: new menus and permissions, leave allowances, approvers, notifications, holidays and the register, report-card grades, fleet and breakdowns, help documents, the 20 conversion templates; 025: Users, Roles and Data Import under Operations, permissions kept, can't be switched off; 024: Settings menu, bank details moved, permissions kept, can't be switched off; 023: staff registration against the staff record, no Pending status; 022: how accounts are created, Admin-only adding with a reason; 021: copy from the archive; 019: parent registration matched to the student record, try limit, audit of changes, archive, self-deletion; 020: no pending parents, no switched-off status, reset-password permission, rejoin removed; 018: question papers by topic, rebuild, locks, availability, approval per set, choosing the set before the start time; 012: defaults, workflow, channels; 013: designation lists, fit, sign-up, View as; 014: departments; 015: removing designations; 016: department access, deleting profiles; 017: access levels). Checks now run on the school's calendar day (Asia/Kolkata) so they don't fail late in the UTC evening |
| Concurrency + load (`database/tests/concurrency`) | Many people acting at the same moment against PostgreSQL with row-level security | **10 / 10 pass** (5 failed before the 010 fixes) |
| Web end-to-end (`app/tests/e2e`) | 10 demo sign-ins open every screen; deep links; public admission form; two browser tabs at once | **42 / 42 pass** (release 15.1 adds 3 in `release15.test.mjs`: every Data Analytics screen and report opens with filters and a table without console errors, drill-down, CSV export and a filter narrowing the table; Admissions without the summary tab, linking to the funnel's status by grade; the Accountant without Student Profile; two older tests updated for the move (Fee Insights left Fees; the admissions list is the page); release 14.2: the sales flow also gives an additional 5% on the final amount and checks the payable amount and the margin card; release 14.1 adds client delivery: convert a proposal, fill in TestFlight, preview and download the UAT plan, the website preview, share with the customer, and the customer opening the test build in a fresh browser without our menus; release 14 adds 3 in `release14.test.mjs`: Pricing → Choose Pro → a 650-student proposal with margin, maximum discount and profit, Download PDF, Email proposal (Sent), the Demo Builder with the provider pre-filled changing the proposal, a Pro demo school presented as the Principal with portfolios and route map but no curriculum; the Admin editing prices with zero refused and Back to Pricing; backups downloaded and restored, WhatsApp links, the IB board scale, curriculum and a parent's portfolio; the two release 13 sales tests moved here; release 13 added 5 in `release13.test.mjs`: library issue and return, homework marked and seen by the parent, online class link check, events hidden by audience, hostel offers the right block, store refuses more than in stock, a proposal priced from the tiers turned into a demo school, presented as the Principal with route planning and ended, competitors and roadmap, company menus hidden from school users; release 12 adds 6 in `release12.test.mjs`: dashboard insights and logging a breakdown, student profile and the attendance register, report cards published to a parent, staff leave with notifications and Add staff in All Staff, route planning and a new stop on the route sheet, FAQs, help documents, the guide following access, and the templates; release 10: dashboard sections, arrows, gender table, grade-limit edit, registrations filtered by source; staff registration in the phone app refused then opened at once as Teacher · PRT; release 9: Add user only for the Admin and only with a reason, how each account was created, no Add user for the Vice Principal; a returning driver added again with details copied from the archive; Users columns (N/A, Created), role and department filters, no Switched off, Refresh after a Roles & Permissions change in another tab; parent sign-up in the phone app refused on a wrong grade then opened at once on a match; Deleted as a status in Edit, view-only archive with its columns and filters; 25 to a page with Next; Reset password for the Admin, for a granted person, and not without the permission; release 8: a question paper from start to print — untick a chapter and the paper is rebuilt without it, undo, add a set, a locked bank question survives regenerating, approval, choose the set, answer key, Approved Papers; question bank filters and add; blueprint edit; release 7.5: access levels per menu and sub-menu, read-only screens refuse saving, access summary; release 7.4: permissions tree by department, whole menu or single sub-menus, profile delete with confirmation; release 7.3: side menu starts collapsed, opens per group, Expand/Collapse all, remembered after reload; release 7.2: remove a designation, blocked while held, add it back; release 7.1: User management tab with departments and a new profile; release 7: opens on the Main menu, Main menu button, Add user designations, app sign-up appears in Users, View as a parent read-only + phone view; earlier: Web & App Screens approval in the browser; every step of all 14 guided demos) |
| Mobile store readiness (`app/tests/store`) | Checks modelled on Google Play's pre-launch report and Apple App Review | **12 / 12 pass** (release 12: the attendance register's cells are 44 × 44 px in the phone app and the greyed day headings meet contrast; release 9 fixed a timing bug where an older message's timer hid a newer one, which made test 10 fail when requests were sent quickly; 8 problems found and fixed in release 5; 3 more in release 6: an unlabeled day picker, a faded manifest row and an unfocusable timetable scroll area) |

A full QA cycle on 20 Nov 2026 (390 cases across every menu, role, tier and add-on; `app/qa/`) found 14 findings; release 15 fixed 12 and the retest passes 388 / 390 (the 2 left wait for a decision).

Everything runs in GitHub Actions: `.github/workflows/tests.yml` on every push, and `.github/workflows/mobile.yml` before any store build.

## 1. Can the model take many users at the same time?

Each test starts all its transactions at the same instant from separate database connections. It uses a non-superuser role, so row-level security applies just as it does in production.

| # | What happened at the same moment | Before fix | After fix (migration 010) |
|---|---|---|---|
| 1 | 20 parents pay at once | **19 of 20 failed** — receipt number from `COUNT(*)+1` collided | 20/20, every receipt unique (per-school counter row, locked) |
| 2 | Two accounts staff match the same bank line | **Receipted twice** | Once — the second sees "already matched" |
| 3 | Counter payment + online payment for one invoice | Correct (invoice capped) | Correct; invoices now locked during allocation |
| 4 | Parent taps Send on phone and website together | **Two requests possible** (check in a trigger can race) | One — database exclusion constraint |
| 5 | Primary and secondary coordinator approve together | Correct (row lock) | Correct |
| 6 | Two gate desks hand over the same child | Correct | Correct |
| 7 | Two applicants enrolled for the last seat | **3 children in a 2-seat section** | Second one refused — sections locked before counting |
| 8 | Same one-time code submitted twice | Correct | Correct |
| 9 | 60 transactions for two schools through a shared pool | Test exposed that the school must be set per transaction | 60/60 saw only their school; a connection with no school set gets an error, never data |
| 10 | Load test | 372 errors (receipt clashes) | 0 errors |

**Load results.** These come from a test database on a 2-CPU / 7 GB machine with a pool of 40 connections.

| Users acting together | Actions | Throughput | Errors | p95: request · manifest · payment · dues |
|---|---|---|---|---|
| 100 × 20 actions | 2,000 | ~225 / s | 0 | 0.5 s · 1.6 s · 0.9 s · 1.2 s |
| 300 × 10 actions | 3,000 | ~190 / s | 0 | 0.3 s · 4.1 s · 2.5 s · 3.8 s |

**Conclusion:**
- The data stays correct under simultaneous use.
- Speed is fine up to about 100 people acting in the same second on this small machine.
- Above that, the heavier screens (bus manifest, dues) queue for a database connection.
- For a large school or many schools, plan the following:
  - A larger RDS instance.
  - RDS Proxy in front of it.
  - A read replica for manifests, route sheets and Power BI.
  - Caching each day's manifest for about 30 seconds.

Indexes for these screens were added in 010.

**Rules the API must follow** (enforced in code review):
- Start every request with `BEGIN; SELECT app_context(:school, :user); …; COMMIT;`, so the school setting never outlives a transaction.
- Connect as the application role, never as the table owner.

**Two browser tabs:** the test app now merges changes made in another tab. Each save starts from the newest copy and other tabs update straight away. The e2e test sends a request from each of two tabs and checks that both survive.

## 2. Regression

The following were rerun after the release-5 changes:
- all unit tests;
- all SQL checks from releases 2–4;
- the web click-through for 10 demo sign-ins: every screen, no console errors.

None broke. Old checks were adjusted for one intentional change: `decide_parent_request` gained an optional meeting-time argument.

## 3. Mobile app — store readiness

| # | Check | Why the stores care | Result |
|---|---|---|---|
| 1 | Launch and open every tab, for 5 roles, with no errors | Play pre-launch crawler; Apple 2.1 (crashes) | Pass |
| 2 | Each role sees only its tabs | Data protection; Apple 5.1 | Pass |
| 3 | Accessibility (axe-core, WCAG 2.1 AA) on every screen | Play accessibility report; Apple accessibility review | Pass after fixes |
| 4 | Every control at least 44 × 44 px | Android 48 dp, Apple 44 pt | Pass after fixes |
| 5 | No sideways scrolling from a 320 px phone to iPad | Apple 2.4.1 (iPad), layout | Pass after fixes |
| 6 | Privacy policy before sign-in; reviewer demo account works | Apple 5.1.1, 2.1 (demo account) | Pass |
| 7 | Account deletion inside the app | Apple 5.1.1(v); Google Play | Pass |
| 8 | Account deletion on the web, without the app | Google Play web-link requirement | Pass |
| 9 | Works offline with a clear message | Apple 4.2 (not a bare website) | Pass |
| 10 | A parent can raise all 8 kinds of request on a phone | Feature check | Pass |
| 11 | First screen < 3 s, bundle < 5 MB, no third-party or cleartext calls | Performance; Play data safety | 0.1 s, 0.9 MB, none |
| 12 | Native settings | Store submission checks | Pass — see below |

The native settings checked in test 12 are:
- target API 36;
- no backup of school data;
- notification permission declared;
- no sensitive permissions;
- iOS privacy manifest present in the bundle;
- encryption flag set;
- arm64 only;
- push entitlement;
- no secrets in the app.

**Problems the store tests found, all fixed:**
1. On the Fees screen a wide table made the page wider than the phone, which pushed the tab bar off screen. Wide tables now scroll inside their card.
2. Content could cover the bottom tab bar. The bar is now fixed above content.
3. A missing favicon caused a 404 on every launch.
4. Grey secondary text was below 4.5:1 contrast. Darker grey is now used on phones and on the web tabs.
5. On/off switches were 36 × 20 px. They now have a 66 × 44 px touch area.
6. The class picker on Attendance had no label for screen readers.
7. Scrollable tables could not be reached by keyboard or screen reader. They are now focusable regions.
8. The privacy policy and web deletion pages did not open inside the app.

**What automated tests cannot cover** (done by people before submission — see `MOBILE_STORE_CHECKLIST.md`):
- real-device runs on low-end Android and an older iPhone;
- VoiceOver and TalkBack walk-throughs;
- push notifications end to end with real FCM / APNs keys;
- a 14-day closed test, if the Play account is a new personal account.
