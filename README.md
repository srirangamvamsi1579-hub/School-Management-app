# School Management Platform

Multi-school SaaS for Indian K-12 schools (≤250 to 1,000+ students): students, staff, academics and timetable, exams and question papers, fees with automatic payment matching, payroll, accounts, templates, data import and per-school branding. Modules switch on per school by plan, AWS-console style, and every user sees only the menus their role allows.

**Try it:** [User-testing build](https://claude.ai/artifact/Ty6v98Gsnmu9HwVa6Qzqy2) (data stays in your browser; pick a school and any role).

## What's in this repo

| Folder | Contents |
| --- | --- |
| `app/` | React + Vite web app for user testing. In-memory demo data, all 46 screens, installable as a PWA. |
| `database/` | PostgreSQL schema: six migrations, run in order (see `database/README.md`). |
| `deploy/aws/` | CloudFormation (S3 + CloudFront + HTTPS) and `deploy.sh`. |
| `.github/workflows/` | CI/CD: test → dev → pre-prod (approval) → prod (approval). |
| `docs/` | `REQUIREMENTS.md` (expectations, screens, schema, rules), client review PDF with every menu and column. |
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

Sign in as **Admin, Principal, Accountant, Teacher, Front Office, Parent** or **Platform team**. Change the school on the sign-in page to see how the plan (Starter → Enterprise) changes the menus. "Reset demo data" in the top bar starts over.

## Host it

- **AWS:** `deploy/aws/deploy.sh dev` (needs the AWS CLI and credentials). Creates a private S3 bucket + CloudFront distribution and prints the web link. Use `preprod` / `prod` for the other environments.
- **GitHub Actions:** see the header of `.github/workflows/deploy.yml` for the one-time setup (environments with required reviewers, `AWS_DEPLOY_ROLE_ARN` secret).
- **Any other web host** (Netlify, Vercel, cPanel, GitHub Pages): upload the contents of `app/dist`, or just `app/dist-single/index.html`.

## Database

```bash
createdb school
for f in database/00*.sql; do psql -d school -v ON_ERROR_STOP=1 -f "$f"; done
```

Every table has `tenant_id` with row-level security. The application must connect as a non-owner role and run `SET app.tenant_id = '<id>'` per request.

## Mobile

The web app is responsive and installable (PWA) on iOS and Android today. Store apps are planned by wrapping the same build with Capacitor (`npx cap add ios android`).

## Status

User-testing build. Sign-in, email/SMS sending, the payment gateway, OCR for photo imports and Power BI embedding are simulated in the browser; `docs/REQUIREMENTS.md` lists the production services for each.

All names and data in the demo are fictional.
