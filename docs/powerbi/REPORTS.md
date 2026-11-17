# Power BI — Data Analytics reports

The **Data Analytics** menu (Growth plan and above) embeds these reports. One shared semantic model serves every school; row-level security limits each viewer to their school.

## Data source and refresh

- Source: Aurora PostgreSQL → Redshift Serverless (zero-ETL), read through the views below. They are created in `database/007_auth_admissions_analytics.sql`.
- Refresh: nightly at 02:00 IST, plus on-demand refresh after results are published.
- Capacity: Fabric F-SKU; embedded for customers ("app owns data") with an embed token per viewer.

## Row-level security

| Role | Rule (DAX on each table with `tenant_id`) | Used for |
| --- | --- | --- |
| Tenant | `[tenant_id] = VALUE(USERPRINCIPALNAME())` — the embed token's effective identity is the school's tenant id | Everyone |
| TeacherSections | Tenant rule **and** `[section_id]` in the teacher's sections (identity `tenant:staff`, looked up in `section_subject_teachers`) | Teachers opening Top & Bottom (their own classes only) |

## Tables (from views)

| Table | View | Grain |
| --- | --- | --- |
| Scores | `v_student_term_scores` | student × term × subject (percentage) |
| Rankings | `v_grade_rankings` | student × term, with `grade_rank`, `grade_rank_from_bottom`, `section_rank`, `grade_size` |
| TeacherSubject | `v_teacher_subject_performance` | teacher × subject × grade × term |
| Routes | `v_transport_route_summary` | route |
| Riders | `enrollments` + `pickup_points` + `transport_routes` | student on a route |
| Admissions | `admission_enquiries` + `admission_status_history`, `v_admissions_by_grade_status` | application / status change |
| Dim Grade, Dim Section, Dim Term, Dim Subject, Dim Staff | `classes`, `sections`, `exam_terms`, `subjects`, `staff` | — |

## Report 1 — Academic Performance

**Page "Top & Bottom 6"**

- **Slicers:** Grade (single select, required), Section (multi-select; empty = all sections together), Term, Subject ("All subjects" = average of subjects).
- **Visuals:**
  - Two tables, Top 6 and Bottom 6: rank, student, section, score %, change vs previous term, attendance.
  - Cards: students, average, pass % (≥ 33), top score.
  - A column chart of the average by section.
- **Ranking rule:** students are ranked across the selected sections of the grade. Ties share a rank (`RANKX … DENSE` is not used, so a tie at 6 can show 7 rows).

```DAX
Score % := AVERAGE ( Scores[pct] )
Rank in selection :=
    IF ( HASONEVALUE ( Scores[student_id] ),
         RANKX ( ALLSELECTED ( Scores[student_id] ), [Score %], , DESC, Skip ) )
Rank from bottom :=
    IF ( HASONEVALUE ( Scores[student_id] ),
         RANKX ( ALLSELECTED ( Scores[student_id] ), [Score %], , ASC, Skip ) )
Is Top 6 := IF ( [Rank in selection] <= 6, 1 )        -- visual filter: Is Top 6 = 1
Is Bottom 6 := IF ( [Rank from bottom] <= 6, 1 )
Pass % := DIVIDE ( COUNTROWS ( FILTER ( VALUES ( Scores[student_id] ), [Score %] >= 33 ) ), DISTINCTCOUNT ( Scores[student_id] ) )
Change vs previous term :=
    VAR cur = [Score %]
    VAR prevTerm = CALCULATE ( MAX ( 'Dim Term'[sort_order] ) ) - 1
    RETURN cur - CALCULATE ( [Score %], 'Dim Term'[sort_order] = prevTerm, ALL ( 'Dim Term' ) )
```

**Page "Teacher Impact"**

- **Slicers:** Grade, Subject, Term.
- **Columns:** teacher, subject, sections, students, Term 1 avg, Term 2 avg, change, vs grade, pass %, ≥ 75 %, index.

```DAX
Grade subject avg := CALCULATE ( [Score %], ALLEXCEPT ( Scores, Scores[class_id], Scores[subject_id], Scores[term_id] ) )
Vs grade := [Score %] - [Grade subject avg]
Improvement := [Score %] - [Previous term score %]
Teacher index := MAX ( 0, MIN ( 100, 50 + 3 * [Vs grade] + [Improvement] ) )   -- 50 = in line with the grade
Distinction % := DIVIDE ( COUNTROWS ( FILTER ( Scores, Scores[pct] >= 75 ) ), COUNTROWS ( Scores ) )
```

The index starts a conversation; it is not an appraisal score on its own. Class mix, section size and attendance are shown beside it.

## Report 2 — Transport

**Page "Routes"**

- **Slicers:** Grade, Route.
- **Visuals:**
  - Table per route: bus, driver, km, riders / seats, seat use %, transport fee per year, ₹ per km, on-time % over the last 30 days.
  - Cards: riders, seat use, fee revenue, riders with overdue fees.

**Page "Riders by grade"**

- Share of students using transport in each grade, with riders by route and grade as a matrix.

```DAX
Riders := DISTINCTCOUNT ( Riders[student_id] )
Seat use % := DIVIDE ( [Riders], SUM ( Routes[capacity] ) )
On-time % := DIVIDE ( CALCULATE ( COUNTROWS ( Trips ), Trips[on_time] = TRUE () ), COUNTROWS ( Trips ) )
Transport fee := SUMX ( Riders, RELATED ( 'Band Fees'[amount] ) )
```

## Report 3 — Admissions

**Page "Funnel by grade"**

- **Slicers:** Grade (multi), Source, Year.
- **Visuals:**
  - A funnel of everyone who reached each stage (from status history).
  - A matrix of grade × current status.
  - Conversion and offer-acceptance cards.
  - A bar chart of enquiries by source.

```DAX
Reached stage := CALCULATE ( DISTINCTCOUNT ( History[enquiry_id] ), History[to_status] = SELECTEDVALUE ( 'Dim Stage'[status] ) )
Conversion % := DIVIDE ( CALCULATE ( COUNTROWS ( Admissions ), Admissions[status] = "ENROLLED" ), COUNTROWS ( Admissions ) )
Offer acceptance % := DIVIDE ( CALCULATE ( COUNTROWS ( Admissions ), Admissions[status] = "ENROLLED" ),
                               CALCULATE ( DISTINCTCOUNT ( History[enquiry_id] ), History[to_status] = "OFFERED" ) )
```

## Catalogue

The reports are registered in `analytics_reports` (codes `RPT_TOP_BOTTOM`, `RPT_TEACHER_IMPACT`, `RPT_TRANSPORT_ROUTES`, `RPT_TRANSPORT_GRADES`, `RPT_ADMISSIONS_FUNNEL`). The Power BI workspace and report GUIDs are filled in once the reports are published.
