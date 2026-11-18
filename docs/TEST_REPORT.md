# Test report — Releases 5 and 6 (regression, concurrency, mobile store readiness)

Date: 17 Nov 2026 · Build: `main` after release 6 (Web & App Screens, user guide)

## Summary

| Suite | What it covers | Result |
|---|---|---|
| App unit tests (`app/tests/*.test.js`) | Fees, matching, roles, admissions, analytics, pickups, route sheets, SMS, new requests, mobile access rules, website links | **41 / 41 pass** (release 7 adds designations by role, app sign-up into users, View as Admin-only; 7.1 adds departments) |
| Database checks (`database/tests/007–014_checks.sql`) | OTP, roles, admissions, analytics, SMS, accounts, visibility, requests, manifest, collectors, timings, route sheets, attendant switch, leave, late arrival, meetings, office requests, mobile screens | **27 / 27 check groups pass** (counted as the NOTICE lines each file prints; 012: defaults, workflow, channels; 013: designation lists, fit, sign-up, View as; 014: departments). Checks now run on the school's calendar day (Asia/Kolkata) so they don't fail late in the UTC evening |
| Concurrency + load (`database/tests/concurrency`) | Many people acting at the same moment against PostgreSQL with row-level security | **10 / 10 pass** (5 failed before the 010 fixes) |
| Web end-to-end (`app/tests/e2e`) | 10 demo sign-ins open every screen; deep links; public admission form; two browser tabs at once | **12 / 12 pass** (release 7.1: User management tab with departments and a new profile; release 7: opens on the Main menu, Main menu button, Add user designations, app sign-up appears in Users, View as a parent read-only + phone view; earlier: Web & App Screens approval in the browser; every step of all 14 guided demos) |
| Mobile store readiness (`app/tests/store`) | Checks modelled on Google Play's pre-launch report and Apple App Review | **12 / 12 pass** (8 problems found and fixed in release 5; 3 more in release 6: an unlabeled day picker, a faded manifest row and an unfocusable timetable scroll area) |

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
