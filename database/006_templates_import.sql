-- =====================================================================
-- MIGRATION 006 — Template library (standard + school's own, editable,
-- per-user preference) and Data Import with field & value mapping
-- (Excel / CSV / scanned images) to load existing school data.
-- Run AFTER migrations 001–005 (PostgreSQL 15+).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. TEMPLATE LIBRARY
-- ---------------------------------------------------------------------
CREATE TABLE template_categories (
  category     VARCHAR(30) PRIMARY KEY,
  name         VARCHAR(80) NOT NULL,
  module       VARCHAR(20) NOT NULL,              -- menu module the output belongs to
  output       VARCHAR(10) NOT NULL CHECK (output IN ('A4','A4_LAND','EMAIL','SMS','CARD','XLSX')),
  sort_order   INTEGER DEFAULT 0
);

-- Placeholders a template in a category may use, with sample values for preview
CREATE TABLE template_fields (
  category   VARCHAR(30) NOT NULL REFERENCES template_categories(category),
  field_key  VARCHAR(60) NOT NULL,                  -- used as {{field_key}}; lists use {{#items}} … {{/items}}
  label      VARCHAR(80) NOT NULL,
  data_path  VARCHAR(120),                          -- where the value comes from, e.g. students.admission_no
  sample     TEXT,
  PRIMARY KEY (category, field_key)
);

CREATE TABLE doc_templates (
  template_id    SERIAL PRIMARY KEY,
  tenant_id      INTEGER REFERENCES tenants(tenant_id),        -- NULL = platform standard template
  category       VARCHAR(30) NOT NULL REFERENCES template_categories(category),
  name           VARCHAR(120) NOT NULL,
  source         VARCHAR(10) NOT NULL CHECK (source IN ('STANDARD','UPLOADED','CUSTOM')),
  based_on       INTEGER REFERENCES doc_templates(template_id), -- copied from a standard template
  body           TEXT NOT NULL,                                 -- HTML (or text for SMS) with {{placeholders}}
  subject        TEXT,                                          -- emails
  page_settings  JSONB DEFAULT '{"size":"A4","orientation":"portrait","margin_mm":15}',
  original_file_url VARCHAR(255),                               -- the school's own sample (PDF / Word / image) kept for reference
  status         VARCHAR(10) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','ACTIVE','ARCHIVED')),
  version_no     INTEGER NOT NULL DEFAULT 1,
  created_by     INTEGER REFERENCES users(user_id),
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE doc_template_versions (
  template_id INTEGER NOT NULL REFERENCES doc_templates(template_id) ON DELETE CASCADE,
  version_no  INTEGER NOT NULL,
  body        TEXT NOT NULL,
  subject     TEXT,
  saved_by    INTEGER REFERENCES users(user_id),
  saved_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (template_id, version_no)
);

-- Which template is used: a user's own choice beats their role's default, which beats the school default, then the standard
CREATE TABLE template_defaults (
  default_id  SERIAL PRIMARY KEY,
  tenant_id   INTEGER NOT NULL REFERENCES tenants(tenant_id),
  category    VARCHAR(30) NOT NULL REFERENCES template_categories(category),
  scope       VARCHAR(6) NOT NULL CHECK (scope IN ('SCHOOL','ROLE','USER')),
  role_id     INTEGER REFERENCES roles(role_id),
  user_id     INTEGER REFERENCES users(user_id),
  template_id INTEGER NOT NULL REFERENCES doc_templates(template_id),
  CHECK ((scope = 'SCHOOL' AND role_id IS NULL AND user_id IS NULL) OR (scope = 'ROLE' AND role_id IS NOT NULL) OR (scope = 'USER' AND user_id IS NOT NULL))
);
CREATE UNIQUE INDEX one_default_per_scope ON template_defaults(tenant_id, category, scope, COALESCE(role_id, 0), COALESCE(user_id, 0));

-- Keep every saved version
CREATE OR REPLACE FUNCTION trg_template_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.body IS DISTINCT FROM OLD.body OR NEW.subject IS DISTINCT FROM OLD.subject) THEN
    NEW.version_no := OLD.version_no + 1;
  END IF;
  NEW.updated_at := CURRENT_TIMESTAMP;
  RETURN NEW;
END $$;
CREATE TRIGGER template_version BEFORE UPDATE ON doc_templates FOR EACH ROW EXECUTE FUNCTION trg_template_version();
CREATE OR REPLACE FUNCTION trg_template_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO doc_template_versions (template_id, version_no, body, subject, saved_by)
  VALUES (NEW.template_id, NEW.version_no, NEW.body, NEW.subject, NEW.created_by)
  ON CONFLICT DO NOTHING;
  RETURN NULL;
END $$;
CREATE TRIGGER template_history AFTER INSERT OR UPDATE ON doc_templates FOR EACH ROW EXECUTE FUNCTION trg_template_history();

-- Pick the template for a user and category
CREATE OR REPLACE FUNCTION resolve_template(p_tenant INTEGER, p_category VARCHAR, p_user INTEGER) RETURNS INTEGER
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    (SELECT d.template_id FROM template_defaults d JOIN doc_templates t USING (template_id)
      WHERE d.tenant_id = p_tenant AND d.category = p_category AND d.scope = 'USER' AND d.user_id = p_user AND t.status = 'ACTIVE' LIMIT 1),
    (SELECT d.template_id FROM template_defaults d JOIN doc_templates t USING (template_id) JOIN user_roles ur ON ur.role_id = d.role_id AND ur.user_id = p_user
      WHERE d.tenant_id = p_tenant AND d.category = p_category AND d.scope = 'ROLE' AND t.status = 'ACTIVE' LIMIT 1),
    (SELECT d.template_id FROM template_defaults d JOIN doc_templates t USING (template_id)
      WHERE d.tenant_id = p_tenant AND d.category = p_category AND d.scope = 'SCHOOL' AND t.status = 'ACTIVE' LIMIT 1),
    (SELECT template_id FROM doc_templates WHERE tenant_id IS NULL AND category = p_category AND status = 'ACTIVE' ORDER BY template_id LIMIT 1))
$$;

-- Simple renderer used for previews and server-side PDFs: {{key}} and one repeating block {{#items}}…{{/items}}
CREATE OR REPLACE FUNCTION render_template(p_body TEXT, p_data JSONB) RETURNS TEXT LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE out TEXT := p_body; blk TEXT; item JSONB; rendered TEXT := ''; k TEXT; v TEXT; one TEXT; s INT; e INT;
BEGIN
  s := position('{{#items}}' IN out); e := position('{{/items}}' IN out);
  IF s > 0 AND e > s THEN
    blk := substr(out, s + 10, e - s - 10);
    FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(p_data->'items', '[]'::jsonb)) LOOP
      one := blk;
      FOR k, v IN SELECT * FROM jsonb_each_text(item) LOOP one := replace(one, '{{' || k || '}}', COALESCE(v, '')); END LOOP;
      rendered := rendered || one;
    END LOOP;
    out := substr(out, 1, s - 1) || rendered || substr(out, e + 10);
  END IF;
  FOR k, v IN SELECT key, value FROM jsonb_each_text(p_data - 'items') LOOP
    out := replace(out, '{{' || k || '}}', COALESCE(v, ''));
  END LOOP;
  RETURN out;
END $$;

-- ---------------------------------------------------------------------
-- 2. DATA IMPORT WITH MAPPING
--    Upload (Excel / CSV / JPEG / PDF) → extract rows → map columns → map values
--    → validate → preview → commit (or roll back the whole job)
-- ---------------------------------------------------------------------
-- What can be imported, and the fields of each target
CREATE TABLE import_targets (
  entity     VARCHAR(20) PRIMARY KEY,               -- STUDENTS, STAFF, FEE_STRUCTURE, OPENING_DUES, QUESTIONS, TIMETABLE …
  name       VARCHAR(60) NOT NULL,
  load_order INTEGER NOT NULL,
  depends_on TEXT[] DEFAULT '{}'
);
CREATE TABLE import_target_fields (
  entity      VARCHAR(20) NOT NULL REFERENCES import_targets(entity),
  field       VARCHAR(40) NOT NULL,
  label       VARCHAR(80) NOT NULL,
  data_type   VARCHAR(10) NOT NULL CHECK (data_type IN ('TEXT','DATE','NUMBER','PHONE','EMAIL','ENUM','LOOKUP')),
  required    BOOLEAN DEFAULT FALSE,
  allowed     TEXT[],                               -- for ENUM
  synonyms    TEXT[] DEFAULT '{}',                  -- header names seen in schools' sheets, used for auto-mapping
  sort_order  INTEGER DEFAULT 0,
  PRIMARY KEY (entity, field)
);

-- A saved mapping, reused every time the school uploads the same kind of sheet
CREATE TABLE import_profiles (
  profile_id   SERIAL PRIMARY KEY,
  tenant_id    INTEGER NOT NULL REFERENCES tenants(tenant_id),
  entity       VARCHAR(20) NOT NULL REFERENCES import_targets(entity),
  name         VARCHAR(80) NOT NULL,                -- "Old ERP student export"
  source_kind  VARCHAR(6) NOT NULL CHECK (source_kind IN ('XLSX','CSV','IMAGE','PDF')),
  sheet_name   VARCHAR(60),
  header_row   INTEGER DEFAULT 1,
  date_format  VARCHAR(12) DEFAULT 'DD-MM-YYYY',
  created_by   INTEGER REFERENCES users(user_id),
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE import_column_maps (
  profile_id    INTEGER NOT NULL REFERENCES import_profiles(profile_id) ON DELETE CASCADE,
  target_field  VARCHAR(40) NOT NULL,
  source_column VARCHAR(80),                         -- header in the uploaded sheet; NULL = use default_value
  transform     VARCHAR(20) DEFAULT 'TRIM' CHECK (transform IN ('NONE','TRIM','UPPER','TITLE','DATE','PHONE_IN','NUMBER','FIRST_WORD','AFTER_FIRST_WORD')),
  default_value TEXT,
  PRIMARY KEY (profile_id, target_field)
);
-- Value translation, e.g. Gender "Boy" → "Male", Class "8th" → "Grade 8"
CREATE TABLE import_value_maps (
  profile_id   INTEGER NOT NULL REFERENCES import_profiles(profile_id) ON DELETE CASCADE,
  target_field VARCHAR(40) NOT NULL,
  source_value VARCHAR(120) NOT NULL,
  mapped_value VARCHAR(120) NOT NULL,
  PRIMARY KEY (profile_id, target_field, source_value)
);

CREATE TABLE import_jobs (
  job_id       SERIAL PRIMARY KEY,
  tenant_id    INTEGER NOT NULL REFERENCES tenants(tenant_id),
  profile_id   INTEGER REFERENCES import_profiles(profile_id),
  entity       VARCHAR(20) NOT NULL REFERENCES import_targets(entity),
  file_name    VARCHAR(200) NOT NULL,
  file_url     VARCHAR(255),                         -- staging bucket; deleted after commit
  file_kind    VARCHAR(6) NOT NULL CHECK (file_kind IN ('XLSX','CSV','IMAGE','PDF')),
  extraction   VARCHAR(12) DEFAULT 'PARSER' CHECK (extraction IN ('PARSER','OCR')),   -- images / scans go through OCR (e.g. Amazon Textract)
  status       VARCHAR(12) NOT NULL DEFAULT 'UPLOADED' CHECK (status IN ('UPLOADED','EXTRACTED','MAPPED','VALIDATED','IMPORTED','ROLLED_BACK','FAILED')),
  rows_total   INTEGER DEFAULT 0, rows_ok INTEGER DEFAULT 0, rows_warning INTEGER DEFAULT 0, rows_error INTEGER DEFAULT 0,
  created_by   INTEGER REFERENCES users(user_id),
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  committed_at TIMESTAMP
);
CREATE TABLE import_rows (
  job_id     INTEGER NOT NULL REFERENCES import_jobs(job_id) ON DELETE CASCADE,
  row_no     INTEGER NOT NULL,
  raw        JSONB NOT NULL,                         -- exactly as uploaded / extracted
  mapped     JSONB,                                  -- after column + value mapping and transforms
  status     VARCHAR(8) DEFAULT 'PENDING' CHECK (status IN ('PENDING','OK','WARNING','ERROR','SKIPPED','IMPORTED')),
  messages   TEXT[] DEFAULT '{}',
  ocr_confidence NUMERIC(5,2),                       -- for image rows; low confidence → WARNING
  created_ids JSONB,                                 -- what the commit created, for roll back
  PRIMARY KEY (job_id, row_no)
);

-- Suggest a mapping for one uploaded header (exact name, synonym, or contained word)
CREATE OR REPLACE FUNCTION suggest_target_field(p_entity VARCHAR, p_header TEXT) RETURNS VARCHAR LANGUAGE sql STABLE AS $$
  WITH h AS (SELECT regexp_replace(lower(trim(p_header)), '[^a-z0-9]+', ' ', 'g') AS v)
  SELECT f.field FROM import_target_fields f, h
  WHERE f.entity = p_entity AND (
        regexp_replace(lower(f.field), '_', ' ', 'g') = h.v OR lower(f.label) = h.v
     OR EXISTS (SELECT 1 FROM unnest(f.synonyms) s WHERE lower(s) = h.v)
     OR EXISTS (SELECT 1 FROM unnest(f.synonyms) s WHERE h.v LIKE '%' || lower(s) || '%' AND length(s) > 3))
  ORDER BY CASE WHEN regexp_replace(lower(f.field), '_', ' ', 'g') = h.v OR lower(f.label) = h.v THEN 0
                WHEN EXISTS (SELECT 1 FROM unnest(f.synonyms) s WHERE lower(s) = h.v) THEN 1 ELSE 2 END, f.sort_order
  LIMIT 1
$$;

-- Apply one transform
CREATE OR REPLACE FUNCTION import_transform(v TEXT, t VARCHAR, date_fmt VARCHAR) RETURNS TEXT LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE d TEXT;
BEGIN
  IF v IS NULL THEN RETURN NULL; END IF;
  v := trim(v);
  RETURN CASE t
    WHEN 'NONE' THEN v WHEN 'TRIM' THEN v WHEN 'UPPER' THEN upper(v) WHEN 'TITLE' THEN initcap(lower(v))
    WHEN 'NUMBER' THEN regexp_replace(v, '[^0-9.\-]', '', 'g')
    WHEN 'PHONE_IN' THEN right(regexp_replace(v, '[^0-9]', '', 'g'), 10)
    WHEN 'FIRST_WORD' THEN split_part(v, ' ', 1)
    WHEN 'AFTER_FIRST_WORD' THEN NULLIF(trim(substr(v, length(split_part(v, ' ', 1)) + 1)), '')
    WHEN 'DATE' THEN CASE WHEN v ~ '^\d{4}-\d{2}-\d{2}$' THEN v
                          ELSE to_char(to_date(replace(replace(v, '/', '-'), '.', '-'), replace(date_fmt, '/', '-')), 'YYYY-MM-DD') END
    ELSE v END;
EXCEPTION WHEN others THEN RETURN '!' || v;   -- marks a value that could not be converted
END $$;

-- Map + validate every row of a job; returns counts
CREATE OR REPLACE FUNCTION map_and_validate_import(p_job INTEGER) RETURNS TABLE (ok INTEGER, warnings INTEGER, errors INTEGER)
LANGUAGE plpgsql AS $$
DECLARE j import_jobs%ROWTYPE; pr import_profiles%ROWTYPE; r RECORD; f RECORD; m JSONB; msgs TEXT[]; val TEXT; mv TEXT; st TEXT;
        c_ok INT := 0; c_w INT := 0; c_e INT := 0;
BEGIN
  SELECT * INTO j FROM import_jobs WHERE job_id = p_job;
  SELECT * INTO pr FROM import_profiles WHERE profile_id = j.profile_id;
  FOR r IN SELECT * FROM import_rows WHERE job_id = p_job ORDER BY row_no LOOP
    m := '{}'::jsonb; msgs := '{}';
    FOR f IN SELECT tf.*, cm.source_column, cm.transform, cm.default_value
             FROM import_target_fields tf LEFT JOIN import_column_maps cm ON cm.profile_id = pr.profile_id AND cm.target_field = tf.field
             WHERE tf.entity = j.entity ORDER BY tf.sort_order LOOP
      val := COALESCE(NULLIF(r.raw ->> f.source_column, ''), f.default_value);
      val := import_transform(val, COALESCE(f.transform, 'TRIM'), pr.date_format);
      SELECT mapped_value INTO mv FROM import_value_maps WHERE profile_id = pr.profile_id AND target_field = f.field AND lower(source_value) = lower(val);
      IF mv IS NOT NULL THEN val := mv; END IF;
      IF val IS NULL OR val = '' THEN
        IF f.required THEN msgs := msgs || ('ERROR: ' || f.label || ' is missing'); END IF;
      ELSIF left(val, 1) = '!' THEN
        msgs := msgs || ('ERROR: ' || f.label || ' "' || substr(val, 2) || '" could not be read as ' || lower(f.data_type));
      ELSIF f.data_type = 'ENUM' AND NOT (val = ANY (f.allowed)) THEN
        msgs := msgs || ('ERROR: ' || f.label || ' "' || val || '" is not one of ' || array_to_string(f.allowed, ', ') || ' — add a value mapping');
      ELSIF f.data_type = 'PHONE' AND val !~ '^[6-9][0-9]{9}$' THEN
        msgs := msgs || ('ERROR: ' || f.label || ' "' || val || '" is not a 10-digit mobile');
      ELSIF f.data_type = 'EMAIL' AND val !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
        msgs := msgs || ('WARNING: ' || f.label || ' "' || val || '" does not look like an email; it will be left blank');
        val := NULL;
      END IF;
      m := m || jsonb_build_object(f.field, val);
      mv := NULL;
    END LOOP;
    IF r.ocr_confidence IS NOT NULL AND r.ocr_confidence < 85 THEN msgs := msgs || ('WARNING: read from an image with ' || r.ocr_confidence || '% confidence — please check'); END IF;
    -- duplicates inside the school
    IF j.entity = 'STUDENTS' AND EXISTS (SELECT 1 FROM students s WHERE s.tenant_id = j.tenant_id AND s.admission_no = m->>'admission_no') THEN
      msgs := msgs || ('ERROR: admission no. ' || (m->>'admission_no') || ' already exists');
    END IF;
    st := CASE WHEN EXISTS (SELECT 1 FROM unnest(msgs) x WHERE x LIKE 'ERROR%') THEN 'ERROR' WHEN array_length(msgs, 1) > 0 THEN 'WARNING' ELSE 'OK' END;
    UPDATE import_rows SET mapped = m, messages = msgs, status = st WHERE job_id = p_job AND row_no = r.row_no;
    IF st = 'OK' THEN c_ok := c_ok + 1; ELSIF st = 'WARNING' THEN c_w := c_w + 1; ELSE c_e := c_e + 1; END IF;
  END LOOP;
  -- duplicates inside the file
  UPDATE import_rows x SET status = 'ERROR', messages = x.messages || ARRAY['ERROR: same admission no. appears twice in the file']
  WHERE x.job_id = p_job AND j.entity = 'STUDENTS' AND x.status <> 'ERROR'
    AND (SELECT COUNT(*) FROM import_rows y WHERE y.job_id = p_job AND y.mapped->>'admission_no' = x.mapped->>'admission_no') > 1;
  SELECT COUNT(*) FILTER (WHERE status = 'OK'), COUNT(*) FILTER (WHERE status = 'WARNING'), COUNT(*) FILTER (WHERE status = 'ERROR')
    INTO c_ok, c_w, c_e FROM import_rows WHERE job_id = p_job;
  UPDATE import_jobs SET status = 'VALIDATED', rows_total = c_ok + c_w + c_e, rows_ok = c_ok, rows_warning = c_w, rows_error = c_e WHERE job_id = p_job;
  ok := c_ok; warnings := c_w; errors := c_e; RETURN NEXT;
END $$;

-- Commit a validated STUDENTS job (students + primary guardian + enrolment). Refuses if any row has an error.
CREATE OR REPLACE FUNCTION commit_student_import(p_job INTEGER, p_year INTEGER) RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE j import_jobs%ROWTYPE; r RECORD; v_student INT; v_guardian INT; v_section INT; n INT := 0; m JSONB;
BEGIN
  SELECT * INTO j FROM import_jobs WHERE job_id = p_job FOR UPDATE;
  IF j.status <> 'VALIDATED' THEN RAISE EXCEPTION 'Validate the job first'; END IF;
  IF j.rows_error > 0 THEN RAISE EXCEPTION 'Fix the % rows with errors first', j.rows_error; END IF;
  FOR r IN SELECT * FROM import_rows WHERE job_id = p_job AND status IN ('OK','WARNING') ORDER BY row_no LOOP
    m := r.mapped;
    SELECT s.section_id INTO v_section FROM sections s JOIN classes c ON c.class_id = s.class_id
    WHERE s.tenant_id = j.tenant_id AND lower(c.name) = lower(m->>'class') AND lower(s.name) = lower(m->>'section');
    IF v_section IS NULL THEN RAISE EXCEPTION 'Row %: class % section % not set up', r.row_no, m->>'class', m->>'section'; END IF;
    INSERT INTO students (admission_no, first_name, last_name, dob, gender, admission_date, tenant_id)
    VALUES (m->>'admission_no', m->>'first_name', m->>'last_name', (m->>'dob')::date, m->>'gender', COALESCE((m->>'admission_date')::date, CURRENT_DATE), j.tenant_id)
    RETURNING student_id INTO v_student;
    v_guardian := NULL;
    IF m->>'guardian_mobile' IS NOT NULL THEN
      SELECT guardian_id INTO v_guardian FROM guardians WHERE tenant_id = j.tenant_id AND phone = m->>'guardian_mobile';   -- siblings share one guardian
      IF v_guardian IS NULL THEN
        INSERT INTO guardians (full_name, relation, phone, email, tenant_id)
        VALUES (COALESCE(m->>'guardian_name', 'Guardian'), upper(COALESCE(m->>'relation', 'GUARDIAN')), m->>'guardian_mobile', m->>'guardian_email', j.tenant_id)
        RETURNING guardian_id INTO v_guardian;
      END IF;
      INSERT INTO student_guardians (student_id, guardian_id, is_primary, tenant_id) VALUES (v_student, v_guardian, TRUE, j.tenant_id);
    END IF;
    INSERT INTO enrollments (student_id, year_id, section_id, roll_no, tenant_id) VALUES (v_student, p_year, v_section, NULLIF(m->>'roll_no','')::int, j.tenant_id);
    UPDATE import_rows SET status = 'IMPORTED', created_ids = jsonb_build_object('student_id', v_student, 'guardian_id', v_guardian) WHERE job_id = p_job AND row_no = r.row_no;
    n := n + 1;
  END LOOP;
  UPDATE import_jobs SET status = 'IMPORTED', committed_at = CURRENT_TIMESTAMP WHERE job_id = p_job;
  RETURN n;
END $$;

-- Undo a whole import (only while nothing else refers to the new records)
CREATE OR REPLACE FUNCTION rollback_student_import(p_job INTEGER) RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE n INT;
BEGIN
  DELETE FROM enrollments WHERE student_id IN (SELECT (created_ids->>'student_id')::int FROM import_rows WHERE job_id = p_job AND status = 'IMPORTED');
  DELETE FROM student_guardians WHERE student_id IN (SELECT (created_ids->>'student_id')::int FROM import_rows WHERE job_id = p_job AND status = 'IMPORTED');
  DELETE FROM students WHERE student_id IN (SELECT (created_ids->>'student_id')::int FROM import_rows WHERE job_id = p_job AND status = 'IMPORTED');
  GET DIAGNOSTICS n = ROW_COUNT;
  DELETE FROM guardians g WHERE g.guardian_id IN (SELECT (created_ids->>'guardian_id')::int FROM import_rows WHERE job_id = p_job AND status = 'IMPORTED')
    AND NOT EXISTS (SELECT 1 FROM student_guardians sg WHERE sg.guardian_id = g.guardian_id);
  UPDATE import_rows SET status = 'SKIPPED', created_ids = NULL WHERE job_id = p_job AND status = 'IMPORTED';
  UPDATE import_jobs SET status = 'ROLLED_BACK' WHERE job_id = p_job;
  RETURN n;
END $$;

-- ---------------------------------------------------------------------
-- 3. ROW-LEVEL SECURITY
-- ---------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['template_defaults','import_profiles','import_jobs'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY tenant_isolation ON %I USING (tenant_id = current_setting('app.tenant_id', true)::int)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::int)$p$, t);
  END LOOP;
  ALTER TABLE doc_templates ENABLE ROW LEVEL SECURITY;
  CREATE POLICY shared_or_own ON doc_templates USING (tenant_id IS NULL OR tenant_id = current_setting('app.tenant_id', true)::int)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::int);
END $$;

-- ---------------------------------------------------------------------
-- 4. SEED: template categories, fields, standard templates, import targets
-- ---------------------------------------------------------------------
INSERT INTO template_categories VALUES
 ('FEE_INVOICE','Fee invoice','FEES','A4',1), ('FEE_RECEIPT','Fee receipt','FEES','A4',2), ('FEE_STRUCTURE','Fee structure (parent copy)','FEES','A4_LAND',3),
 ('FEE_REQUEST_EMAIL','Fee request email','FEES','EMAIL',4), ('PAYMENT_CONFIRMATION_EMAIL','Payment confirmation email','FEES','EMAIL',5),
 ('FEE_REMINDER_SMS','Fee reminder SMS','FEES','SMS',6), ('TIMETABLE','Class timetable','ACADEMICS','A4_LAND',7),
 ('ASSESSMENT_PROFILE','Assessment profile','EXAMS','A4',8), ('REPORT_CARD','Report card','EXAMS','A4',9),
 ('QUESTION_PAPER','Question paper','EXAMS','A4',10), ('APPRECIATION_CARD','Appreciation card','EXAMS','CARD',11),
 ('PAYSLIP','Payslip','PAYROLL','A4',12), ('ID_CARD','Student ID card','STUDENTS','CARD',13),
 ('ADMISSION_LETTER','Admission letter','STUDENTS','A4',14), ('TRANSFER_CERTIFICATE','Transfer certificate','STUDENTS','A4',15),
 ('ACCOUNT_STATEMENT','Account statement','ACCOUNTS','A4',16);

INSERT INTO template_fields VALUES
 ('FEE_INVOICE','school_name','School name','tenants.name','[School Name]'),
 ('FEE_INVOICE','school_address','School address','school_settings.address','[Address]'),
 ('FEE_INVOICE','student_name','Student name','students.first_name + last_name','AARAV SHARMA'),
 ('FEE_INVOICE','admission_no','Admission no.','students.admission_no','ADM-2025-0231'),
 ('FEE_INVOICE','program','Program / grade','classes.name','GRADE VIII'),
 ('FEE_INVOICE','instalment','Instalment','fee_invoices.instalment_label','Installment III'),
 ('FEE_INVOICE','invoice_no','Invoice no.','fee_invoices.invoice_no','INV-GVS-08301'),
 ('FEE_INVOICE','invoice_date','Invoice date','fee_invoices.invoice_date','01-12-2026'),
 ('FEE_INVOICE','due_date','Due date','fee_invoices.due_date','10-12-2026'),
 ('FEE_INVOICE','items','Fee lines (repeat)','fee_invoice_items','[{"sr":"1","description":"Tuition","amount":"60,890.00"}]'),
 ('FEE_INVOICE','grand_total','Grand total','v_invoice_print.grand_total','1,03,070.00'),
 ('FEE_INVOICE','previous_outstanding','Previous outstanding','v_invoice_print.previous_outstanding','0.00'),
 ('FEE_INVOICE','advance','Total advance','v_invoice_print.advance_applied','0.00'),
 ('FEE_INVOICE','net_payable','Net payable','v_invoice_print.net_payable','1,03,070.00'),
 ('FEE_INVOICE','net_payable_words','Net payable in words','v_invoice_print.net_payable_words','INR One Lakh, Three Thousand And Seventy only'),
 ('FEE_INVOICE','bank_details','Bank & UPI block','school_bank_accounts','SBI MG Road · IFSC SBIN0001234 · UPI schoolfees@sbi'),
 ('FEE_INVOICE','pay_link','Pay link','fee_request_messages.pay_token','https://demo.yourapp.com/pay/…');

INSERT INTO doc_templates (tenant_id, category, name, source, body, status) VALUES
 (NULL, 'FEE_INVOICE', 'Standard fee invoice (A4)', 'STANDARD',
  '<header><img src="{{logo}}"><h2>{{school_name}}</h2><p>{{school_address}}</p></header><h3 class="c">FEES</h3>' ||
  '<table class="meta"><tr><td>Student Name:</td><td>{{student_name}}</td><td>Fee Invoice No:</td><td>{{invoice_no}}</td></tr>' ||
  '<tr><td>Admission No:</td><td>{{admission_no}}</td><td>Date:</td><td>{{invoice_date}}</td></tr>' ||
  '<tr><td>Program:</td><td>{{program}}</td><td>Due Date:</td><td>{{due_date}}</td></tr><tr><td>Installment:</td><td>{{instalment}}</td></tr></table>' ||
  '<table class="items"><tr><th>Sr</th><th>Description</th><th>Amount</th></tr>{{#items}}<tr><td>{{sr}}</td><td>{{description}}</td><td>₹ {{amount}}</td></tr>{{/items}}</table>' ||
  '<p class="r">Grand Total: ₹ {{grand_total}}</p><p>Previous Outstanding Amount: ₹ {{previous_outstanding}}</p><p>Total Advance: ₹ {{advance}}</p>' ||
  '<p><b>Net Payable: ₹ {{net_payable}}</b></p><p>Net Payable Amount (in words): {{net_payable_words}}</p>' ||
  '<div class="pay">How to pay: {{bank_details}} · {{pay_link}}</div><footer>This is a Computer Generated Statement and Does Not Require a Signature</footer>', 'ACTIVE'),
 (NULL, 'FEE_REQUEST_EMAIL', 'Standard fee request email', 'STANDARD',
  '<p>Dear {{guardian_name}},</p><p>The {{instalment}} fee for {{student_name}} ({{class}}) of {{amount_due}} is due on {{due_date}}.</p><p><a href="{{pay_link}}">Pay now</a></p><p>{{bank_details}}</p>', 'ACTIVE'),
 (NULL, 'FEE_REMINDER_SMS', 'Standard fee reminder SMS', 'STANDARD',
  '{{school_short}}: Fee of {{amount_due}} for {{student_first}} due {{due_date}}. Pay: {{pay_link}}', 'ACTIVE'),
 (NULL, 'TIMETABLE', 'Grade day view (sections × periods)', 'STANDARD', '<!-- rendered from timetable_entries; grade-wide blocks merge across sections -->', 'ACTIVE'),
 (NULL, 'ASSESSMENT_PROFILE', 'Term assessment profile (narrative)', 'STANDARD', '<!-- headline, observations, in class, subject comments by group, projects, signatures -->', 'ACTIVE'),
 (NULL, 'FEE_STRUCTURE', 'Fee structure by grade group & transport band', 'STANDARD', '<!-- base fee table, band totals, payment options, exclusions, notes -->', 'ACTIVE');
UPDATE doc_templates SET subject = 'Fee due: {{student_name}} ({{class}}) — {{amount_due}} by {{due_date}}' WHERE category = 'FEE_REQUEST_EMAIL';

INSERT INTO import_targets VALUES
 ('CLASSES','Classes & sections',1,'{}'), ('STAFF','Staff',2,'{}'), ('STUDENTS','Students & guardians',3,'{CLASSES}'),
 ('FEE_STRUCTURE','Fee structure',4,'{CLASSES}'), ('OPENING_DUES','Opening fee dues',5,'{STUDENTS,FEE_STRUCTURE}'),
 ('SALARY','Salary structure',6,'{STAFF}'), ('OPENING_BALANCES','Opening balances',7,'{}'),
 ('QUESTIONS','Question bank',8,'{}'), ('TIMETABLE','Timetable',9,'{CLASSES,STAFF}');

INSERT INTO import_target_fields (entity, field, label, data_type, required, allowed, synonyms, sort_order) VALUES
 ('STUDENTS','admission_no','Admission no.','TEXT',TRUE,NULL,'{adm no,admn no,admission number,adm. no,admno,enrollment no,sr no,scholar no}',1),
 ('STUDENTS','first_name','First name','TEXT',TRUE,NULL,'{student first name,given name,fname,student name,name of the student,name}',2),
 ('STUDENTS','last_name','Last name','TEXT',FALSE,NULL,'{surname,family name,lname}',3),
 ('STUDENTS','dob','Date of birth','DATE',TRUE,NULL,'{d o b,birth date,date of birth,birthday}',4),
 ('STUDENTS','gender','Gender','ENUM',TRUE,'{Male,Female,Other}','{sex,boy girl}',5),
 ('STUDENTS','class','Class','TEXT',TRUE,NULL,'{grade,std,standard,program,class name}',6),
 ('STUDENTS','section','Section','TEXT',TRUE,NULL,'{sec,division,div}',7),
 ('STUDENTS','roll_no','Roll no.','NUMBER',FALSE,NULL,'{roll,roll number}',8),
 ('STUDENTS','admission_date','Admission date','DATE',FALSE,NULL,'{date of admission,doa,joining date}',9),
 ('STUDENTS','guardian_name','Guardian name','TEXT',TRUE,NULL,'{father name,parent name,mother name,father s name,guardian}',10),
 ('STUDENTS','relation','Relation','ENUM',FALSE,'{Father,Mother,Guardian}','{relationship}',11),
 ('STUDENTS','guardian_mobile','Guardian mobile','PHONE',TRUE,NULL,'{mobile,phone,contact,contact no,parent mobile,father mobile,whatsapp}',12),
 ('STUDENTS','guardian_email','Guardian email','EMAIL',FALSE,NULL,'{email,e mail,parent email,mail id}',13);

-- ---------------------------------------------------------------------
-- 5. MENUS, FEATURES, PLANS, PERMISSIONS
-- ---------------------------------------------------------------------
INSERT INTO menus (parent_id, code, label, route, sort_order)
SELECT m.menu_id, v.code, v.label, v.route, v.ord FROM menus m JOIN (VALUES
 ('OPERATIONS','OPS_TEMPLATES','Templates','/ops/templates',7),
 ('OPERATIONS','OPS_IMPORT','Data Import','/ops/import',8)
) AS v(parent, code, label, route, ord) ON m.code = v.parent;
INSERT INTO features (parent_id, code, name, kind, menu_id, sort_order)
SELECT pf.feature_id, m.code, m.label, 'SUBMENU', m.menu_id, m.sort_order FROM menus m JOIN features pf ON pf.code = 'OPERATIONS'
WHERE m.code IN ('OPS_TEMPLATES','OPS_IMPORT');
INSERT INTO features (parent_id, code, name, kind, sort_order)
SELECT f.feature_id, v.code, v.name, 'FUNCTION', 400 + v.ord FROM features f JOIN (VALUES
 ('OPERATIONS','FN_CUSTOM_TEMPLATES','Edit & upload own templates',1),
 ('OPERATIONS','FN_IMAGE_IMPORT','Import from images / scans (OCR)',2)
) AS v(module, code, name, ord) ON f.code = v.module;
INSERT INTO plan_features (plan_id, feature_id)
SELECT p.plan_id, f.feature_id FROM features f JOIN (VALUES ('OPS_TEMPLATES',1),('OPS_IMPORT',1),('FN_CUSTOM_TEMPLATES',2),('FN_IMAGE_IMPORT',3)) AS v(code, r)
ON f.code = v.code JOIN plans p ON p.tier_rank >= v.r ON CONFLICT DO NOTHING;
INSERT INTO role_menu_permissions (role_id, menu_id, can_view, can_create, can_edit, can_delete, can_approve, data_scope)
SELECT r.role_id, m.menu_id, TRUE, TRUE, TRUE, r.code = 'ADMIN', r.code = 'ADMIN', 'ALL'
FROM roles r JOIN menus m ON m.code IN ('OPS_TEMPLATES','OPS_IMPORT') WHERE r.code = 'ADMIN'
UNION ALL
SELECT r.role_id, m.menu_id, TRUE, FALSE, FALSE, FALSE, FALSE, 'SELF'          -- everyone else can pick their preferred template
FROM roles r JOIN menus m ON m.code = 'OPS_TEMPLATES' WHERE r.code IN ('PRINCIPAL','ACCOUNTANT','TEACHER','FRONT_OFFICE')
ON CONFLICT DO NOTHING;
