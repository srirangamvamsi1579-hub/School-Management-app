# Sources registry

Where each deliverable lives and what it was built from.

## Live links

| What | Link |
| --- | --- |
| User-testing web app | https://claude.ai/artifact/Ty6v98Gsnmu9HwVa6Qzqy2 |
| Requirements (editable doc) | https://claude.ai/artifact/7s89uC65LFcsiKfvBBeLdy |
| Screen designs (design canvas) | https://claude.ai/artifact/FHW9v2kHKtoA72u4pH6GuD |
| Code repository | https://github.com/srirangamvamsi1579-hub/School-Management-app |

## Inputs from the school (not stored in this public repo)

| Input | Used for |
| --- | --- |
| Fee structure document (2023) | Grade groups I–IV / V–VII / VIII–X / XI / XII, fee heads, six transport bands, payment plans, exclusions → `app/src/data/seed.js`, Fee Structure screen, `005` fee-structure tables |
| Sample fee invoice | Invoice layout (Sr / Description / Amount, Grand Total, Previous Outstanding, Advance, Net Payable, amount in words) → standard invoice template, `v_invoice_print`, `amount_in_words_inr()` |
| Sample term assessment profile | Narrative profile: subject comments, appreciation cards, Coordinator / Vice Principal signatures → Assessment Profiles screen, `assessment_profiles` tables |
| Grade IX daily timetable (image) | Sections S1–S3 / W1–W3, 12 periods, grade-wide blocks, teacher short codes → Timetable screen and `005` timetable tables |

Student names, invoice numbers and other personal details from these files are **not** used; all demo people are fictional.

## External references

- CBSE Class X sample paper pattern (sections A–E, 80 marks) — paper formats in `003_exams.sql` and `app/src/data/seed.js`
- NCERT Class X Mathematics chapter list — syllabus seed data
- WCAG 2.1 contrast ratio (4.5 : 1) — theming rules
