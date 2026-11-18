# Mobile app — store release checklist (Google Play and Apple App Store)

## How the app is published

**One app serves every school ("YourApp School"), and your company publishes it.**
- A parent or staff member enters the school code once, for example `GVS`, and signs in.
- Branding, the screens offered and access rules come from that school's settings in the Platform Console → Mobile app.
- A new school needs **no new store submission**: switch the app on, choose its screens and give out the school code.

**Why one app and not a branded app per school.** Apple guideline 4.2.6 says apps made from a commercial template or app-generation service must be submitted by the provider of the app's content. In practice that means the school itself, under its own developer account. Guideline 4.3 also rejects many near-identical apps.
- A single multi-school app avoids both rules.
- If a large school insists on its own branded app, it must enrol in the Apple Developer Program (and Google Play as an organisation) and submit that build under its own account. The code supports this: change `appId` and `appName` in `mobile/capacitor.config.json`.

## What a person sees in the app

They see a tab only when all three of these are true:
- The school has the mobile app switched on (Platform Console → Schools & Plans → Mobile app).
- Their role's layout puts that screen in the app (**Settings → Web & App Screens**: Website + app / Website only / App only, changed through draft → approval by a different person → publish).
- The same rules as the website allow it: plan, school add-ons or switch-offs, role, designation, and screens granted by name.

Home and Account are always in the app, because account deletion must stay reachable.

| Role | Tabs (recommended layout) |
|---|---|
| Parent | Home · Requests · Fees · My child · Account |
| Teacher | Home · Timetable · Attendance · Approvals · More (Meetings, Account) |
| Front office | Home · Gate · Office · Bus changes · Account |
| Transport team | Home · Route sheet · Manifest · Bus changes · Account |
| Principal | Home · Attendance · Approvals · Meetings · More (Office, Route sheet, Account) |
| Accountant | Home · Payslips · Account |
| Admin | Home · Account (everything else on the website) |
| Platform team | Website only |

Data rules are enforced in the database:
- `screen_channel()` and `v_user_mobile_screens` give each person's tabs; `v_user_web_screens` their website menu.
- Row-level security keeps each school's data separate.

## Builds

| | Android | iOS |
|---|---|---|
| Project | `mobile/android` (Capacitor 8) | `mobile/ios` (Capacitor 8, Swift Package Manager) |
| Store minimum we meet | Target API 36 — required for new apps and updates from 31 Aug 2026 | Built with Xcode 26 / iOS 26 SDK — required for uploads from 28 Apr 2026 |
| CI | `.github/workflows/mobile.yml`, job `android` (Ubuntu) → signed `.aab` | Job `ios` (macOS 15) → simulator build; archive and TestFlight upload when keys are set |
| Signing secrets (GitHub → Settings → Secrets) | `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`, `PLAY_SERVICE_ACCOUNT_JSON` | `APP_STORE_CONNECT_KEY_ID`, `APP_STORE_CONNECT_ISSUER_ID`, `APP_STORE_CONNECT_KEY_P8` |
| Release | Actions → Mobile apps → Run workflow → tick "release" → Play **internal testing** track | Same → **TestFlight** |

Build locally:

```
cd mobile && npm install && npm run sync
```

Then open Android Studio or Xcode with `npx cap open android` or `npx cap open ios`.

## Before the first submission — accounts and listings

**Developer accounts and identity**
- [ ] **Google Play developer account as an Organisation** (needs a D-U-N-S number).
  - A *personal* account created after 13 Nov 2023 must first run a closed test with at least 12 testers opted in for 14 days in a row.
  - An organisation account does not have this requirement.
- [ ] **Apple Developer Program as an Organisation**, with the company name as seller.
- [ ] Change `appId` `com.yourapp.school` to your real reverse domain in:
  - `capacitor.config.json`;
  - `android/app/build.gradle`;
  - Xcode (Signing & Capabilities).

**Push notifications and icons**
- [ ] Push keys:
  - Firebase project with `google-services.json` in `mobile/android/app/` for Android.
  - APNs key in Firebase or your push service for iOS.
  - Enable Push Notifications in the Apple identifier.
- [ ] App icon and splash in all sizes: `npx @capacitor/assets generate` from a 1024 × 1024 icon.

**Privacy and data disclosures**
- [ ] **Privacy policy URL**: `https://<school>.yourapp.com/#/p/privacy` (the in-app version is at `#/p/privacy`). Have it legally reviewed, including against India's DPDP Act.
- [ ] **Google Play Data safety** form:
  - Data collected: name, email, phone, photos (people authorised to collect a child), device ID (push token).
  - Purpose: app functionality. Not shared. Not sold. Encrypted in transit.
  - Deletion is offered, with the web link `https://<school>.yourapp.com/#/p/delete`.
- [ ] **Apple App Privacy** labels:
  - Same data types, all "linked to the user" and "not used for tracking".
  - They match `ios/App/App/PrivacyInfo.xcprivacy`.

**Store listings**
- [ ] **Content and age rating** questionnaires (Play IARC and Apple age rating).
  - The app is used by parents and staff and has no user-generated public content.
  - Do **not** list it as designed for children. Children do not sign in.
- [ ] **Target audience** (Play): 18+.
- [ ] Store listing for each store:
  - title, short and long description;
  - at least 2 phone screenshots per store (use the web preview at `#/p/mobile` in a 390 × 844 window);
  - iPad screenshots, because the iOS app also runs on iPad;
  - support URL and email.

**Notes for Apple's reviewers** (App Review Information):
- [ ] Demo account: school code `GVS`, `rohit.s@example.com` / password from your secrets. Use a real reviewer account on production, not the test build.
- [ ] Note: "B2B app for schools using our platform. Parents and staff are invited by their school. Account deletion: Account tab → Delete my account."

## Every release

- [ ] `tests.yml` is green: unit, SQL checks, concurrency and load, e2e.
- [ ] `mobile.yml` checks job is green: 12 store-readiness tests.
- [ ] Bump the version. CI sets `versionCode` and `CURRENT_PROJECT_VERSION` from the run number.
- [ ] Manual pass on real devices:
  - one low-end Android (2–3 GB RAM, Android 10 or later);
  - one recent Android;
  - an older iPhone (iOS 16);
  - a current iPhone;
  - an iPad.
- [ ] Do the following on each device:
  - [ ] TalkBack and VoiceOver: sign in, send a leave request, open fees.
  - [ ] Largest font size: nothing cut off on Home, Requests and Account.
  - [ ] Airplane mode: the offline message shows; nothing crashes; it recovers when back online.
  - [ ] Notification permission denied, then allowed in Settings.
  - [ ] Delete account (parent) on a throw-away account.
  - [ ] Android back button: tab → Home → leaves the app.
- [ ] Play: upload to **internal testing**, then read the **pre-launch report** (crashes, accessibility, security), then go to production with a staged rollout of 10% → 50% → 100%.
- [ ] Apple: TestFlight internal, then external testers, then submit for review with the notes above.
- [ ] After release, watch Play Android vitals (crash rate under 1.09%, ANR rate under 0.47%) and App Store Connect crash reports for 48 hours.
