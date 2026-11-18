# School Management Platform

Multi-school SaaS for Indian K-12 schools (≤250 to 1,000+ students): own sign-in page per school with Gmail/mobile sign-up, account self-service, user and role management, admissions pipeline, parent requests (leave, late arrival, pickup/drop, early leave, own transport, meet a teacher, office requests) with class coordinators, teachers' meeting inbox and a gate desk, a mobile app for Google Play and the App Store with per-role Web & App Screens (approval workflow), an in-app user guide with guided demos, transport bus manifests and per-route driver route sheets, an approved pickup list, an SMS gateway framework, students, staff, academics and timetable, exams and question papers, fees with automatic payment matching, payroll, accounts, Data Analytics (Power BI), templates, data import and per-school branding. Modules switch on per school by plan, AWS-console style, and every user sees only the menus their role allows.

**User guide with guided demos:** https://srirangamvamsi1579-hub.github.io/School-Management-app/#/p/guide

**Try it:** [User-testing build](https://claude.ai/artifact/Ty6v98Gsnmu9HwVa6Qzqy2) or the public copy at https://srirangamvamsi1579-hub.github.io/School-Management-app/ (data stays in your browser).

## What's in this repo

| Folder | Contents |
| --- | --- |
| `app/` | React + Vite web app for user testing. In-memory demo data, sign-in and sign-up pages, all 67 screens, public admission form and website deep links, installable as a PWA. `npm run build:mobile` builds the mobile app. |
| `mobile/` | Capacitor 8 store app (Android `android/`, iOS `ios/`) wrapping the mobile build — see `docs/MOBILE_STORE_CHECKLIST.md`. |
| `services/sms/` | SMS dispatcher and delivery-report handling for when a vendor is connected (see its README). |
| `database/` | PostgreSQL schema: twelve migrations, run in order, plus SQL checks and concurrency/load tests (see `database/README.md`). |
| `deploy/aws/` | CloudFormation (S3 + CloudFront + HTTPS) and `deploy.sh`. |
| `.github/workflows/` | `tests.yml` full regression on every push; `mobile.yml` store-readiness tests and Android/iOS builds; `deploy.yml` CI/CD: test → dev → pre-prod (approval) → prod (approval). |
| `docs/` | `REQUIREMENTS.md` (expectations, screens, schema, rules), `USER_GUIDE.md` (user manual), `TEST_REPORT.md` (regression, concurrency, load, store readiness), `MOBILE_STORE_CHECKLIST.md`, `powerbi/REPORTS.md` (report pages, DAX, security), client review PDF. |
| `design/` | Screen designs (design canvas source files) and the link to the live canvas. |
| `tools/pdf/` | Script that regenerates the client review PDF. |

## Run the app locally

```bash
cd app
npm install
npm run dev          # http://localhost:5173
npm test             # business-rule tests (node --test)
npm run build        # static site in app/dist  → any web host
npm run build:single # one self-contained file: app/dist-single/index.html
```

The test website opens straight on the **Main menu** as the school Admin. Use **View as Profile** to see any profile's website or phone app, or **Switch user** to sign in. Demo accounts (password `Demo@123`): admin@greenvalley.example.in, principal@greenvalley.example.in, sana.accounts@example.com, sonia.teacher@example.com, meera.vp@example.com (Teacher + Vice Principal), mobile 9845011200 (Front Office), rohit.s@example.com (Parent), transport@greenvalley.example.in (Transport) or murali.hots@example.com (Head of Teaching Staff). Or use **Demo quick access**, or **Create account** to try the sign-up flow (codes appear in the "Test inbox" panel). Change the school on the sign-in page to see how the plan (Starter → Enterprise) changes the menus. "Reset demo data" in the top bar starts over.

## Host it

- **AWS:** `deploy/aws/deploy.sh dev` (needs the AWS CLI and credentials). Creates a private S3 bucket + CloudFront distribution and prints the web link. Use `preprod` / `prod` for the other environments.
- **GitHub Actions:** see the header of `.github/workflows/deploy.yml` for the one-time setup (environments with required reviewers, `AWS_DEPLOY_ROLE_ARN` secret).
- **Any other web host** (Netlify, Vercel, cPanel, GitHub Pages): upload the contents of `app/dist`, or just `app/dist-single/index.html`.

## Database

```bash
createdb school
for f in database/00*.sql; do psql -d school -v ON_ERROR_STOP=1 -f "$f"; done
psql -d school -f database/tests/007_checks.sql   # optional checks, rolled back
psql -d school -f database/tests/008_checks.sql
psql -d school -f database/tests/009_checks.sql
```

Every table has `tenant_id` with row-level security. The application must connect as a non-owner role and run `SET app.tenant_id = '<id>'` per request.

## Mobile

The web app is responsive and installable (PWA) on iOS and Android today. Store apps are planned by wrapping the same build with Capacitor (`npx cap add ios android`).

## Status

User-testing build. Real email/SMS sending (codes and emails appear in the test inbox and outbox), the payment gateway, OCR for photo imports and Power BI embedding are simulated in the browser; `docs/REQUIREMENTS.md` lists the production services for each.

All names and data in the demo are fictional.
