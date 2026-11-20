-- =====================================================================
-- 032  Release 15: fixes from the November 2026 QA cycle.
--      • Admission numbers: running number + surname initial + year of joining, at most 10 characters
--        (e.g. 0042R2026). The running number restarts each year and never goes back, so a removed
--        student never frees a number.
--      • A duplicate check the API runs before saving an admission.
--      • Question marks 1 to 20; dates of birth that fit a school child (new rows; older rows untouched).
--      Run after 001–031.
-- =====================================================================

CREATE TABLE admission_counters (
  tenant_id  INTEGER NOT NULL REFERENCES tenants(tenant_id),
  join_year  SMALLINT NOT NULL CHECK (join_year BETWEEN 2000 AND 2100),
  last_no    INTEGER NOT NULL DEFAULT 0 CHECK (last_no BETWEEN 0 AND 99999),
  PRIMARY KEY (tenant_id, join_year)
);

-- First letter A–Z of the surname, else of the first name, else X (names in other scripts)
CREATE OR REPLACE FUNCTION admission_initial(p_last TEXT, p_first TEXT) RETURNS CHAR(1) LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(substring(upper(COALESCE(p_last, '')) FROM '[A-Z]'), substring(upper(COALESCE(p_first, '')) FROM '[A-Z]'), 'X')::CHAR(1);
$$;

-- Next admission number for a school and year. The counter row is locked by the upsert, so two admissions at the
-- same moment get different numbers. Numbers already taken (imports from an old system) are skipped.
CREATE OR REPLACE FUNCTION next_admission_no(p_tenant INT, p_last TEXT, p_first TEXT, p_year INT) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE v_no INT; v_adm TEXT;
BEGIN
  LOOP
    INSERT INTO admission_counters (tenant_id, join_year, last_no) VALUES (p_tenant, p_year, 1)
      ON CONFLICT (tenant_id, join_year) DO UPDATE SET last_no = admission_counters.last_no + 1
      RETURNING last_no INTO v_no;
    v_adm := lpad(v_no::TEXT, 4, '0') || admission_initial(p_last, p_first) || p_year::TEXT;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM students WHERE tenant_id = p_tenant AND admission_no = v_adm);
  END LOOP;
  RETURN v_adm;   -- 9 or 10 characters
END $$;

-- Possible duplicates of a child about to be admitted: same name and date of birth, or same first name and
-- guardian phone. The app shows them and saves only if the person confirms.
CREATE OR REPLACE FUNCTION find_duplicate_students(p_tenant INT, p_first TEXT, p_last TEXT, p_dob DATE, p_phone TEXT)
RETURNS TABLE (student_id INT, admission_no VARCHAR, full_name TEXT) LANGUAGE sql STABLE AS $$
  SELECT s.student_id, s.admission_no, trim(s.first_name || ' ' || COALESCE(s.last_name, ''))
    FROM students s
   WHERE s.tenant_id = p_tenant AND s.status = 'ACTIVE' AND lower(trim(s.first_name)) = lower(trim(p_first))
     AND ((lower(COALESCE(trim(s.last_name), '')) = lower(COALESCE(trim(p_last), '')) AND s.dob = p_dob)
       OR EXISTS (SELECT 1 FROM student_guardians sg JOIN guardians g ON g.guardian_id = sg.guardian_id
                   WHERE sg.student_id = s.student_id AND right(regexp_replace(g.phone, '\D', '', 'g'), 10) = right(regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g'), 10)));
$$;

-- A question carries 1 to 20 marks (also when edited for one paper)
ALTER TABLE questions ADD CONSTRAINT questions_marks_range CHECK (marks > 0 AND marks <= 20) NOT VALID;
ALTER TABLE paper_questions ADD CONSTRAINT paper_questions_edited_marks_range CHECK (edited_marks IS NULL OR (edited_marks > 0 AND edited_marks <= 20)) NOT VALID;

-- A school child: born before joining and less than 21 years before it
ALTER TABLE students ADD CONSTRAINT students_dob_plausible CHECK (dob < admission_date AND dob > admission_date - INTERVAL '21 years') NOT VALID;
