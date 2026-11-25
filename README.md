# School Management Platform

Multi-school SaaS for Indian K-12 schools (≤250 to 1,000+ students): own sign-in page per school with Gmail/mobile sign-up, account self-service, user and role management, admissions pipeline, parent requests (leave, late arrival, pickup/drop, early leave, own transport, meet a teacher, office requests) with class coordinators, teachers' meeting inbox and a gate desk, a mobile app for Google Play and the App Store with per-role Web & App Screens (approval workflow), an in-app user guide with guided demos, transport bus manifests and per-route driver route sheets, an approved pickup list, an SMS gateway framework, students, staff, academics and timetable, exams and question papers, fees with automatic payment matching, payroll, accounts, Data Analytics (Power BI), templates, data import and per-school branding. The service provider decides, per school, which add-ons and which basic items each school has, and every user sees only the menus their role allows.

**Current release:** 18 — Add-ons and Roles & Permissions in the service provider's own app, Apply, basic items as add-ons (see `docs/REQUIREMENTS.md` §18).

## Links and logins

> **Demo only.** These are test logins for user testing, with fictional data. This repository is public, so anyone can read them here. Change them before any real school uses the app. The service provider never gives login details to schools.

### Service provider (our company)

| What | Link | Username | Password |
| --- | --- | --- | --- |
| Provider app (sign-in page) | https://srirangamvamsi1579-hub.github.io/School-Management-app/ | `Admin` | `Admin1234!` |
| Service Provider › Add-ons | https://srirangamvamsi1579-hub.github.io/School-Management-app/#/s/SP_ADDONS | `Admin` | `Admin1234!` |
| Service Provider › Roles & Permissions (provider) | https://srirangamvamsi1579-hub.github.io/School-Management-app/#/s/SP_FEATURES | `Admin` | `Admin1234!` |
| Clients (each client's webpage, app, links, share by email) | https://srirangamvamsi1579-hub.github.io/School-Management-app/#/s/CLI_ALL | `Admin` | `Admin1234!` |
| Platform requirements (every function, for the provider) | https://srirangamvamsi1579-hub.github.io/School-Management-app/#/p/platform | — | — |
| User guide with guided demos | https://srirangamvamsi1579-hub.github.io/School-Management-app/#/p/guide | — | — |
| Provider app on Claude | https://claude.ai/artifact/Ty6v98Gsnmu9HwVa6Qzqy2 | `Admin` | `Admin1234!` |

### Clients (schools)

Client logins follow the school's registration number: `Client<reg. no.>` / `Client<reg. no.>!` — for example `Client101` / `Client101!`, `Client102` / `Client102!`. The provider is registration no. 100.

| School | Reg. no. | Link | Username | Password |
| --- | --- | --- | --- | --- |
| Vijayanikethan High School – UAT/DEMO (own app) | 101 | https://srirangamvamsi1579-hub.github.io/School-Management-app/vijayanikethan/ | `Client101` | `Client101!` |
| Vijayanikethan app on Claude | 101 | https://claude.ai/artifact/XYvWFeYJUSe7rxiqB4G3Lp | `Client101` | `Client101!` |
| Vijayanikethan school website (client's own) | — | https://www.vijayanikethancbse.com/ | — | — |
| Schools converted in the provider app | 102, 103, … | provider app, sign in with the school's number | `Client<no>` | `Client<no>!` |

- Five wrong tries lock a login; the provider unlocks it.
- The provider's `Admin` login does not work in a client's own app, and `Client<no>` logins never see the provider's menus in the provider app.

### Older demo accounts (full test login page)

The full test sign-in page, with demo quick access and the school picker, is at https://srirangamvamsi1579-hub.github.io/School-Management-app/#/login?demo. Its demo accounts use the password `Demo@123`: admin@greenvalley.example.in, principal@greenvalley.example.in, sana.accounts@example.com, sonia.teacher@example.com, meera.vp@example.com (Teacher + Vice Principal), mobile 9845011200 (Front Office), rohit.s@example.com (Parent), transport@greenvalley.example.in (Transport), murali.hots@example.com (Head of Teaching Staff).

### Repository and branches

| What | Link |
| --- | --- |
| Repository | https://github.com/srirangamvamsi1579-hub/School-Management-app |
| `main` (product) | https://github.com/srirangamvamsi1579-hub/School-Management-app/tree/main |
| `dev` | https://github.com/srirangamvamsi1579-hub/School-Management-app/tree/dev |
| `school/vijayanikethan` (Vijayanikethan's set-up) | https://github.com/srirangamvamsi1579-hub/School-Management-app/tree/school/vijayanikethan |
| `gh-pages` (published test builds) | https://github.com/srirangamvamsi1579-hub/School-Management-app/tree/gh-pages |
| Requirements | [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) |
| Test report | [docs/TEST_REPORT.md](docs/TEST_REPORT.md) |
| User guide | [docs/USER_GUIDE.md](docs/USER_GUIDE.md) |

Data stays in each browser (in-memory test database). GitHub Pages can take a few minutes to show a new version. The Claude artifacts and GitHub Pages copies keep separate data.

## Setting up a school (service provider)

1. Sign in as `Admin`, open **Service Provider › Add-ons** or **Roles & Permissions (provider)** and pick the school at the top.
2. Tick or untick add-ons, basic features, menus and functions. **Mark as add-on** turns a basic item into an add-on for that school; **Basic again** undoes it.
3. Press **Apply (v1.x)**: the selection becomes the school's next version. The school's own Operations › Roles & Permissions lists exactly what was applied, not what its plan or client type gives.
4. A client running in its own app (Vijayanikethan) picks up the applied version the next time it is opened in the same browser. To publish for everyone, **Download build file** and commit it to the school's branch as `schools/<subdomain>/rebuild.json`; the `school-release.yml` workflow rebuilds and republishes `gh-pages/<subdomain>/`.

## Release management

- Branches: `main` → `dev` → `school/<subdomain>` (one branch per school). Scripts: `tools/release/school-branch.sh` (create, uat, live, update, list).
- New client app: `node app/scripts/client-app.mjs <config.json>` writes `app/dist-client/<subdomain>/index.html` and the school's `school.json` / `links.json`.
- A school's life cycle: Convert to client → "School – UAT/DEMO" → client sign-off → "School – Live (date)".

## What's in this repo

| Folder | Contents |
| --- | --- |
| `app/` | React 18 + Vite web app for user testing: in-memory demo data, sign-in, every screen, public pages, installable as a PWA. `npm run build:mobile` builds the mobile app; `scripts/client-app.mjs` builds a client's own app. |
| `mobile/` | Capacitor store app (Android `android/`, iOS `ios/`) wrapping the mobile build — see `docs/MOBILE_STORE_CHECKLIST.md`. |
| `services/sms/` | SMS dispatcher and delivery-report handling for when a vendor is connected (see its README). |
| `database/` | PostgreSQL 15+ schema: 34 migrations (001–034), run in order, plus SQL checks and concurrency/load tests (see `database/README.md`). |
| `deploy/aws/` | CloudFormation (S3 + CloudFront + HTTPS) and `deploy.sh`. |
| `.github/workflows/` | `tests.yml` full regression on every push; `mobile.yml` store-readiness tests and Android/iOS builds; `deploy.yml` test → dev → pre-prod (approval) → prod (approval); `school-release.yml` rebuilds and republishes a school's app from its branch. |
| `schools/` | How each school's branch holds its set-up (`school.json`, `config.json`, `rebuild.json`). |
| `docs/` | `REQUIREMENTS.md`, `USER_GUIDE.md`, `TEST_REPORT.md`, `MOBILE_STORE_CHECKLIST.md`, `INDIAN_SCHOOL_PROFILES.md`, `powerbi/REPORTS.md`, client review PDF. |
| `design/` | Screen designs (design canvas source files). |
| `tools/` | `pdf/` regenerates the client review PDF; `release/` school branch script. |

## Technologies

React 18, Vite 5 (single-file build for hosting), JavaScript (ES modules), jsPDF, SheetJS (xlsx), Web Crypto (SHA-256 password hashes), Capacitor (iOS and Android), PostgreSQL 15+ with row-level security, Node test runner, Playwright + Chrome, axe-core, GitHub Actions, GitHub Pages. Planned for production on AWS: RDS/Aurora PostgreSQL, S3, CloudFront, Cognito, Secrets Manager, SES, SNS (or MSG91/Gupshup for SMS), Textract, and Power BI for analytics.

## Run the app locally

```bash
cd app
npm install
npm run dev          # http://localhost:5173
npm test             # 123 unit tests (node --test)
CHROME_PATH=/usr/bin/google-chrome npm run test:e2e   # 46 browser tests (after npm run build)
npm run build        # static site in app/dist  → any web host
npm run build:single # one self-contained file: app/dist-single/index.html
```

## Host it

- **GitHub Pages:** copy `app/dist-single/index.html` to the `gh-pages` branch root, and each client app to `gh-pages/<subdomain>/index.html`.
- **AWS:** `deploy/aws/deploy.sh dev` (needs the AWS CLI and credentials). Creates a private S3 bucket + CloudFront distribution and prints the web link. Use `preprod` / `prod` for the other environments.
- **GitHub Actions:** see the header of `.github/workflows/deploy.yml` for the one-time setup (environments with required reviewers, `AWS_DEPLOY_ROLE_ARN` secret).

## Database

```bash
createdb school
for f in database/0*.sql; do psql -d school -v ON_ERROR_STOP=1 -f "$f"; done
psql -d school -f database/tests/034_checks.sql   # optional checks, rolled back
```

Every table has `tenant_id` with row-level security. The application must connect as a non-owner role and run `SET app.tenant_id = '<id>'` per request.

## Status

User-testing build. Real email/SMS sending (messages appear in the test inbox and outbox), the payment gateway, OCR for photo imports and Power BI embedding are simulated in the browser; `docs/REQUIREMENTS.md` lists the production services for each. Open questions are at the end of `docs/REQUIREMENTS.md` (e.g. the custom-roles tier).

All names and data in the demo are fictional.
