# Schools

Each client school lives on its own branch, `school/<subdomain>`, cut from `dev`. Its set-up is in
`schools/<subdomain>/school.json` (downloaded from Service Provider › Client Delivery › Release & branch), so `main`
and `dev` hold only the product and every school's differences stay on its branch.

| Step | Where | Git |
|---|---|---|
| Convert to client | Client Delivery | `tools/release/school-branch.sh create <sub> school.json` → `school/<sub>` from `dev` |
| UAT / demo school ready | “<School> – UAT/DEMO” | `tools/release/school-branch.sh uat <sub> 1.0` → tag `<sub>-uat-v1.0` |
| Client approval and signing | Record client sign-off → “<School> – Live (date)” | `tools/release/school-branch.sh live <sub> 1.0` → tag `<sub>-v1.0` |
| Product fix | `dev` → `main` | `tools/release/school-branch.sh update <sub>` merges `dev` into the school's branch |

`.github/workflows/school-release.yml` tests and builds every school branch and keeps tagged builds as artifacts.
No secrets on any branch: keys stay in AWS Secrets Manager.
