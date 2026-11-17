-- =====================================================================
-- MIGRATION 005 — Bank & UPI details, fee request emails per grade,
-- automatic payment matching (receipt + invoice + accounts + confirmation
-- email), class timetables, and linking menus to the school website.
-- Run AFTER migrations 001–004 (PostgreSQL 15+).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. SCHOOL BANK ACCOUNTS & UPI ("scanner" = UPI QR code)
-- ---------------------------------------------------------------------
CREATE TABLE school_bank_accounts (
  bank_account_id   SERIAL PRIMARY KEY,
  tenant_id         INTEGER NOT NULL REFERENCES tenants(tenant_id),
  purpose           VARCHAR(10) NOT NULL DEFAULT 'FEES' CHECK (purpose IN ('FEES','SALARY','GENERAL')),
  display_name      VARCHAR(80) NOT NULL,              -- shown to parents, e.g. "Fee collection account"
  account_holder    VARCHAR(120) NOT NULL,             -- name exactly as in the bank
  bank_name         VARCHAR(80) NOT NULL,
  branch            VARCHAR(80),
  account_number_enc TEXT NOT NULL,                    -- encrypted by the app (KMS); never stored in plain text
  account_last4     CHAR(4) NOT NULL,                  -- for lists and logs
  ifsc              VARCHAR(11) NOT NULL CHECK (ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$'),
  account_type      VARCHAR(10) DEFAULT 'CURRENT' CHECK (account_type IN ('CURRENT','SAVINGS')),
  upi_id            VARCHAR(80) CHECK (upi_id IS NULL OR upi_id ~ '^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+$'),
  upi_qr_url        VARCHAR(255),                      -- uploaded QR image (S3)
  ledger_account_id INTEGER REFERENCES ledger_accounts(account_id),   -- 1010 Bank Account
  is_default_for_fees BOOLEAN DEFAULT FALSE,
  is_active         BOOLEAN DEFAULT TRUE,
  verified_by       INTEGER REFERENCES users(user_id),  -- second person confirms details before parents see them
  verified_at       TIMESTAMP,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX one_default_fee_account ON school_bank_accounts(tenant_id) WHERE is_default_for_fees AND is_active;

-- ---------------------------------------------------------------------
-- 2. FEE REQUEST CAMPAIGNS (one email per guardian, chosen grades)
-- ---------------------------------------------------------------------
CREATE TABLE fee_request_campaigns (
  campaign_id      SERIAL PRIMARY KEY,
  tenant_id        INTEGER NOT NULL REFERENCES tenants(tenant_id),
  title            VARCHAR(120) NOT NULL,
  year_id          INTEGER REFERENCES academic_years(year_id),
  class_ids        INTEGER[] NOT NULL,                 -- grades included
  only_overdue     BOOLEAN DEFAULT FALSE,
  due_date         DATE NOT NULL,
  channel          VARCHAR(10) NOT NULL DEFAULT 'EMAIL' CHECK (channel IN ('EMAIL','SMS','WHATSAPP')),
  subject_template TEXT NOT NULL,
  body_template    TEXT NOT NULL,                      -- placeholders: {{guardian_name}} {{student_name}} {{class}} {{amount_due}} {{due_date}} {{pay_link}} {{bank_details}} {{upi_id}}
  bank_account_id  INTEGER REFERENCES school_bank_accounts(bank_account_id),
  include_upi_qr   BOOLEAN DEFAULT TRUE,
  include_pay_link BOOLEAN DEFAULT TRUE,
  reminder_days    INTEGER[] DEFAULT '{3,0,-3}',       -- days before (+) / after (-) the due date
  status           VARCHAR(10) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','SCHEDULED','SENT','CLOSED')),
  scheduled_at     TIMESTAMP,
  sent_at          TIMESTAMP,
  created_by       INTEGER REFERENCES users(user_id),
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE fee_request_messages (
  message_id    BIGSERIAL PRIMARY KEY,
  tenant_id     INTEGER NOT NULL REFERENCES tenants(tenant_id),
  campaign_id   INTEGER NOT NULL REFERENCES fee_request_campaigns(campaign_id) ON DELETE CASCADE,
  student_id    INTEGER NOT NULL REFERENCES students(student_id),
  guardian_id   INTEGER REFERENCES guardians(guardian_id),
  to_email      VARCHAR(120),
  amount_due    NUMERIC(12,2) NOT NULL,
  invoice_ids   INTEGER[] NOT NULL,
  pay_token     UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),   -- the personal payment link
  status        VARCHAR(10) NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED','SENT','OPENED','PARTIAL','PAID','BOUNCED','NO_CONTACT')),
  sent_at       TIMESTAMP, opened_at TIMESTAMP, paid_at TIMESTAMP,
  paid_amount   NUMERIC(12,2) DEFAULT 0,
  payment_id    INTEGER REFERENCES fee_payments(payment_id),
  remarks       TEXT                                              -- filled in automatically when paid
);

CREATE TABLE email_outbox (
  email_id     BIGSERIAL PRIMARY KEY,
  tenant_id    INTEGER NOT NULL REFERENCES tenants(tenant_id),
  to_email     VARCHAR(120) NOT NULL,
  subject      TEXT NOT NULL,
  body         TEXT NOT NULL,
  kind         VARCHAR(20) NOT NULL CHECK (kind IN ('FEE_REQUEST','FEE_REMINDER','PAYMENT_CONFIRMATION','OTHER')),
  related_id   BIGINT,
  status       VARCHAR(10) NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED','SENT','FAILED')),
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sent_at      TIMESTAMP
);  -- a worker (Amazon SES) sends QUEUED rows and updates status

-- ---------------------------------------------------------------------
-- 3. INCOMING PAYMENT NOTIFICATIONS → automatic matching
--    GATEWAY        : payment-gateway webhook for the pay link (most reliable)
--    UTR_SUBMITTED  : parent paid by bank transfer / UPI and typed the reference on the pay page
--    BANK_STATEMENT : line from the bank statement import or bank API
-- ---------------------------------------------------------------------
CREATE TABLE payment_notifications (
  notification_id BIGSERIAL PRIMARY KEY,
  tenant_id       INTEGER NOT NULL REFERENCES tenants(tenant_id),
  source          VARCHAR(16) NOT NULL CHECK (source IN ('GATEWAY','UTR_SUBMITTED','BANK_STATEMENT')),
  external_ref    VARCHAR(80) NOT NULL,             -- gateway payment id or UTR
  amount          NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  paid_at         TIMESTAMP NOT NULL,
  mode            VARCHAR(10) NOT NULL CHECK (mode IN ('UPI','CARD','BANK','ONLINE','CHEQUE')),
  payer_name      VARCHAR(120),
  narration       TEXT,                             -- bank narration, often contains the admission no.
  pay_token       UUID,                             -- present when it came through the personal link
  bank_account_id INTEGER REFERENCES school_bank_accounts(bank_account_id),
  raw             JSONB,
  match_status    VARCHAR(16) NOT NULL DEFAULT 'UNMATCHED' CHECK (match_status IN ('UNMATCHED','AUTO_MATCHED','MANUAL_MATCHED','DUPLICATE','REJECTED')),
  matched_message_id BIGINT REFERENCES fee_request_messages(message_id),
  matched_payment_id INTEGER REFERENCES fee_payments(payment_id),
  matched_by      INTEGER REFERENCES users(user_id),
  note            TEXT,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX one_notification_per_ref ON payment_notifications(tenant_id, source, external_ref);

-- ---------------------------------------------------------------------
-- 4. FUNCTIONS
-- ---------------------------------------------------------------------
-- Fill a template from a key/value JSON
CREATE OR REPLACE FUNCTION fill_template(tpl TEXT, vals JSONB) RETURNS TEXT LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE k TEXT; v TEXT; out TEXT := tpl;
BEGIN
  FOR k, v IN SELECT * FROM jsonb_each_text(vals) LOOP
    out := replace(out, '{{' || k || '}}', COALESCE(v, ''));
  END LOOP;
  RETURN out;
END $$;

-- Create one message per student with open dues in the chosen grades, picking the primary guardian's email
CREATE OR REPLACE FUNCTION generate_fee_requests(p_campaign INTEGER) RETURNS TABLE (queued INTEGER, no_contact INTEGER, total_due NUMERIC)
LANGUAGE plpgsql AS $$
DECLARE c fee_request_campaigns%ROWTYPE; t tenants%ROWTYPE; b school_bank_accounts%ROWTYPE; r RECORD;
        v_msg BIGINT; v_token UUID; vals JSONB; bank_txt TEXT; q INT := 0; nc INT := 0; tot NUMERIC := 0;
BEGIN
  SELECT * INTO c FROM fee_request_campaigns WHERE campaign_id = p_campaign;
  SELECT * INTO t FROM tenants WHERE tenant_id = c.tenant_id;
  SELECT * INTO b FROM school_bank_accounts WHERE bank_account_id = c.bank_account_id;
  bank_txt := CASE WHEN b.bank_account_id IS NULL THEN '' ELSE
     'Account name: ' || b.account_holder || E'\nBank: ' || b.bank_name || COALESCE(', ' || b.branch, '') ||
     E'\nAccount no.: [shown on the secure payment page]' || E'\nIFSC: ' || b.ifsc ||
     COALESCE(E'\nUPI ID: ' || b.upi_id, '') END;

  FOR r IN
    SELECT s.student_id, s.first_name || ' ' || COALESCE(s.last_name,'') AS student_name, s.admission_no,
           cl.name || '-' || sec.name AS class_name, g.guardian_id, g.full_name AS guardian_name, g.email,
           SUM(i.net_amount - i.paid_amount) AS due, array_agg(i.invoice_id ORDER BY i.due_date) AS inv
    FROM enrollments e
    JOIN students s ON s.student_id = e.student_id AND s.status = 'ACTIVE'
    JOIN sections sec ON sec.section_id = e.section_id
    JOIN classes cl ON cl.class_id = sec.class_id AND cl.class_id = ANY (c.class_ids)
    JOIN fee_invoices i ON i.enrollment_id = e.enrollment_id AND i.status IN ('DUE','PARTIAL','OVERDUE')
         AND (NOT c.only_overdue OR i.due_date < CURRENT_DATE)
    LEFT JOIN student_guardians sg ON sg.student_id = s.student_id AND sg.is_primary
    LEFT JOIN guardians g ON g.guardian_id = sg.guardian_id
    WHERE e.year_id = c.year_id AND e.tenant_id = c.tenant_id
    GROUP BY s.student_id, s.first_name, s.last_name, s.admission_no, cl.name, sec.name, g.guardian_id, g.full_name, g.email
  LOOP
    INSERT INTO fee_request_messages (tenant_id, campaign_id, student_id, guardian_id, to_email, amount_due, invoice_ids, status)
    VALUES (c.tenant_id, c.campaign_id, r.student_id, r.guardian_id, r.email, r.due, r.inv,
            CASE WHEN r.email IS NULL THEN 'NO_CONTACT' ELSE 'QUEUED' END)
    RETURNING message_id, pay_token INTO v_msg, v_token;
    tot := tot + r.due;
    IF r.email IS NULL THEN nc := nc + 1; CONTINUE; END IF;
    vals := jsonb_build_object(
      'guardian_name', r.guardian_name, 'student_name', r.student_name, 'class', r.class_name,
      'admission_no', r.admission_no, 'amount_due', '₹' || to_char(r.due, 'FM99,99,99,990.00'),
      'due_date', to_char(c.due_date, 'DD Mon YYYY'),
      'pay_link', CASE WHEN c.include_pay_link THEN 'https://' || t.subdomain || '.yourapp.com/pay/' || v_token ELSE '' END,
      'bank_details', bank_txt, 'upi_id', COALESCE(b.upi_id, ''), 'school_name', t.name);
    INSERT INTO email_outbox (tenant_id, to_email, subject, body, kind, related_id)
    VALUES (c.tenant_id, r.email, fill_template(c.subject_template, vals), fill_template(c.body_template, vals), 'FEE_REQUEST', v_msg);
    q := q + 1;
  END LOOP;
  UPDATE fee_request_campaigns SET status = 'SENT', sent_at = CURRENT_TIMESTAMP WHERE campaign_id = p_campaign;
  queued := q; no_contact := nc; total_due := tot; RETURN NEXT;
END $$;

-- Record a confirmed payment against a fee request: receipt, invoices, accounts, message remarks, confirmation email
CREATE OR REPLACE FUNCTION apply_payment(p_notification BIGINT, p_message BIGINT, p_user INTEGER, p_status TEXT)
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE n payment_notifications%ROWTYPE; m fee_request_messages%ROWTYPE; s students%ROWTYPE;
        v_pay INTEGER; v_receipt TEXT; v_voucher INTEGER; remaining NUMERIC; inv RECORD; part NUMERIC;
        item RECORD; item_total NUMERIC; credited NUMERIC; line_amt NUMERIC; bank_ledger INTEGER; v_remarks TEXT;
        v_seq INTEGER; t tenants%ROWTYPE;
BEGIN
  SELECT * INTO n FROM payment_notifications WHERE notification_id = p_notification FOR UPDATE;
  SELECT * INTO m FROM fee_request_messages WHERE message_id = p_message FOR UPDATE;
  SELECT * INTO s FROM students WHERE student_id = m.student_id;
  SELECT * INTO t FROM tenants WHERE tenant_id = n.tenant_id;

  SELECT COUNT(*) + 1 INTO v_seq FROM fee_payments WHERE tenant_id = n.tenant_id;
  v_receipt := 'R-' || to_char(n.paid_at, 'YYYY') || '-' || lpad(v_seq::text, 5, '0');
  INSERT INTO fee_payments (receipt_no, student_id, amount, mode, txn_ref, paid_at, collected_by, tenant_id)
  VALUES (v_receipt, m.student_id, n.amount, n.mode, n.external_ref, n.paid_at, p_user, n.tenant_id) RETURNING payment_id INTO v_pay;

  SELECT COALESCE(sb.ledger_account_id, la.account_id) INTO bank_ledger
  FROM ledger_accounts la LEFT JOIN school_bank_accounts sb ON sb.bank_account_id = n.bank_account_id
  WHERE la.tenant_id = n.tenant_id AND la.code = '1010';
  INSERT INTO vouchers (voucher_no, voucher_date, voucher_type, source_type, source_id, narration, created_by, tenant_id)
  VALUES ('RV-' || v_receipt, n.paid_at::date, 'RECEIPT', 'FEE_PAYMENT', v_pay,
          'Fee received ' || s.admission_no || ' via ' || n.mode || ' ref ' || n.external_ref, p_user, n.tenant_id)
  RETURNING voucher_id INTO v_voucher;
  INSERT INTO voucher_lines (voucher_id, account_id, debit, credit, tenant_id) VALUES (v_voucher, bank_ledger, n.amount, 0, n.tenant_id);

  -- settle invoices oldest first; credit each fee head's income account in proportion
  remaining := n.amount;
  FOR inv IN SELECT * FROM fee_invoices WHERE invoice_id = ANY (m.invoice_ids) AND status IN ('DUE','PARTIAL','OVERDUE') ORDER BY due_date LOOP
    EXIT WHEN remaining <= 0;
    part := LEAST(remaining, inv.net_amount - inv.paid_amount);
    INSERT INTO payment_allocations (payment_id, invoice_id, amount, tenant_id) VALUES (v_pay, inv.invoice_id, part, n.tenant_id);
    UPDATE fee_invoices SET paid_amount = paid_amount + part,
           status = CASE WHEN paid_amount + part >= net_amount THEN 'PAID' ELSE 'PARTIAL' END
    WHERE invoice_id = inv.invoice_id;
    SELECT SUM(amount) INTO item_total FROM fee_invoice_items WHERE invoice_id = inv.invoice_id;
    credited := 0;
    FOR item IN SELECT fi.amount, COALESCE(fh.income_account_id, (SELECT account_id FROM ledger_accounts WHERE tenant_id = n.tenant_id AND code = '4000')) AS acc,
                       row_number() OVER (ORDER BY fi.item_id DESC) AS rn
                FROM fee_invoice_items fi JOIN fee_heads fh ON fh.fee_head_id = fi.fee_head_id
                WHERE fi.invoice_id = inv.invoice_id ORDER BY fi.item_id LOOP
      line_amt := CASE WHEN item.rn = 1 THEN part - credited ELSE round(part * item.amount / item_total, 2) END;
      credited := credited + line_amt;
      INSERT INTO voucher_lines (voucher_id, account_id, debit, credit, tenant_id) VALUES (v_voucher, item.acc, 0, line_amt, n.tenant_id);
    END LOOP;
    remaining := remaining - part;
  END LOOP;
  IF remaining > 0 THEN   -- paid more than due → advance
    INSERT INTO voucher_lines (voucher_id, account_id, debit, credit, tenant_id)
    SELECT v_voucher, account_id, 0, remaining, n.tenant_id FROM ledger_accounts WHERE tenant_id = n.tenant_id AND code = '2200';
  END IF;

  v_remarks := 'Paid ₹' || to_char(n.amount, 'FM99,99,99,990.00') || ' by ' || n.mode || ' on ' || to_char(n.paid_at, 'DD Mon YYYY HH24:MI') ||
               ' · ref ' || n.external_ref || ' · receipt ' || v_receipt ||
               CASE WHEN p_status = 'MANUAL_MATCHED' THEN ' · matched by accounts' ELSE ' · confirmed automatically' END;
  UPDATE fee_request_messages SET paid_amount = paid_amount + n.amount, paid_at = n.paid_at, payment_id = v_pay, remarks = v_remarks,
         status = CASE WHEN paid_amount + n.amount >= amount_due THEN 'PAID' ELSE 'PARTIAL' END
  WHERE message_id = m.message_id;
  UPDATE payment_notifications SET match_status = p_status, matched_message_id = m.message_id, matched_payment_id = v_pay, matched_by = p_user
  WHERE notification_id = n.notification_id;

  IF m.to_email IS NOT NULL THEN
    INSERT INTO email_outbox (tenant_id, to_email, subject, body, kind, related_id)
    VALUES (n.tenant_id, m.to_email, 'Payment received — ' || s.first_name || ' (' || v_receipt || ')',
            'Dear Parent,' || E'\n\nWe have received ₹' || to_char(n.amount, 'FM99,99,99,990.00') || ' towards fees for ' || s.first_name ||
            ' (' || s.admission_no || ').' || E'\nReceipt: ' || v_receipt || E'\nMode: ' || n.mode || ' · Ref: ' || n.external_ref ||
            E'\nDownload: https://' || t.subdomain || '.yourapp.com/receipts/' || v_receipt || E'\n\nThank you,\n' || t.name,
            'PAYMENT_CONFIRMATION', v_pay);
  END IF;
  RETURN v_pay;
END $$;

-- Try to match a notification automatically; leaves it UNMATCHED for the accounts team if unsure
CREATE OR REPLACE FUNCTION match_payment_notification(p_notification BIGINT) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE n payment_notifications%ROWTYPE; v_msg BIGINT; cnt INT;
BEGIN
  SELECT * INTO n FROM payment_notifications WHERE notification_id = p_notification;
  IF n.match_status <> 'UNMATCHED' THEN RETURN n.match_status; END IF;
  -- same reference already paid through another channel → duplicate, never double-count
  IF EXISTS (SELECT 1 FROM fee_payments WHERE tenant_id = n.tenant_id AND txn_ref = n.external_ref) THEN
    UPDATE payment_notifications SET match_status = 'DUPLICATE', note = 'Reference already receipted' WHERE notification_id = n.notification_id;
    RETURN 'DUPLICATE';
  END IF;
  -- 1) personal pay link
  IF n.pay_token IS NOT NULL THEN
    SELECT message_id INTO v_msg FROM fee_request_messages WHERE pay_token = n.pay_token AND tenant_id = n.tenant_id;
  END IF;
  -- 2) admission number in the bank narration, with an open request
  IF v_msg IS NULL AND n.narration IS NOT NULL THEN
    SELECT COUNT(*), MIN(m.message_id) INTO cnt, v_msg FROM fee_request_messages m JOIN students s ON s.student_id = m.student_id
    WHERE m.tenant_id = n.tenant_id AND m.status IN ('SENT','OPENED','QUEUED','PARTIAL')
      AND position(upper(s.admission_no) IN upper(n.narration)) > 0;
    IF cnt <> 1 THEN v_msg := NULL; END IF;
  END IF;
  -- 3) exact amount, only one open request with that amount in the last 45 days
  IF v_msg IS NULL AND n.source <> 'GATEWAY' THEN
    SELECT COUNT(*), MIN(m.message_id) INTO cnt, v_msg FROM fee_request_messages m JOIN fee_request_campaigns c USING (campaign_id)
    WHERE m.tenant_id = n.tenant_id AND m.status IN ('SENT','OPENED','QUEUED') AND m.amount_due = n.amount
      AND c.sent_at >= n.paid_at - INTERVAL '45 days';
    IF cnt <> 1 THEN v_msg := NULL; END IF;
  END IF;
  IF v_msg IS NULL THEN RETURN 'UNMATCHED'; END IF;
  PERFORM apply_payment(n.notification_id, v_msg, NULL, 'AUTO_MATCHED');
  RETURN 'AUTO_MATCHED';
END $$;

-- Accounts team matches one by hand from the review queue
CREATE OR REPLACE FUNCTION manual_match_payment(p_notification BIGINT, p_message BIGINT, p_user INTEGER) RETURNS INTEGER
LANGUAGE sql AS $$ SELECT apply_payment(p_notification, p_message, p_user, 'MANUAL_MATCHED') $$;

-- Match automatically as soon as a notification arrives
CREATE OR REPLACE FUNCTION trg_match_on_insert() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN PERFORM match_payment_notification(NEW.notification_id); RETURN NULL; END $$;
CREATE TRIGGER match_on_insert AFTER INSERT ON payment_notifications FOR EACH ROW EXECUTE FUNCTION trg_match_on_insert();

-- ---------------------------------------------------------------------
-- 5. DAILY TIMETABLE  (matches a grade sheet: sections as rows, time slots as columns,
--    grade-wide blocks such as Elective / PT / Assembly, and two teachers sharing a period)
-- ---------------------------------------------------------------------
ALTER TABLE staff ADD COLUMN short_code VARCHAR(12);          -- "SON", "KIR", "Pr Prasad" as printed on the sheet

CREATE TABLE bell_periods (
  period_id  SERIAL PRIMARY KEY,
  tenant_id  INTEGER NOT NULL REFERENCES tenants(tenant_id),
  year_id    INTEGER NOT NULL REFERENCES academic_years(year_id),
  bell_set   VARCHAR(20) NOT NULL DEFAULT 'HIGH_SCHOOL',     -- primary and high school can ring differently
  period_no  INTEGER NOT NULL,
  label      VARCHAR(30) NOT NULL,                           -- "9.10–9.40", "Lunch"
  start_time TIME NOT NULL,
  end_time   TIME NOT NULL CHECK (end_time > start_time),
  is_break   BOOLEAN DEFAULT FALSE,
  UNIQUE (tenant_id, year_id, bell_set, period_no)
);

CREATE TABLE timetable_entries (
  entry_id    SERIAL PRIMARY KEY,
  tenant_id   INTEGER NOT NULL REFERENCES tenants(tenant_id),
  year_id     INTEGER NOT NULL REFERENCES academic_years(year_id),
  class_id    INTEGER NOT NULL REFERENCES classes(class_id),
  section_id  INTEGER REFERENCES sections(section_id),        -- NULL = whole grade (Elective, PT, Assembly)
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 6),
  period_id   INTEGER NOT NULL REFERENCES bell_periods(period_id),
  period_span INTEGER NOT NULL DEFAULT 1 CHECK (period_span BETWEEN 1 AND 4),
  subject_id  INTEGER REFERENCES subjects(subject_id),
  activity    VARCHAR(80),                                    -- "PT for Boys / Collab Games", "SLC / Cabinet meet"
  room        VARCHAR(20)
);
CREATE UNIQUE INDEX one_entry_per_section_slot ON timetable_entries(section_id, day_of_week, period_id) WHERE section_id IS NOT NULL;

-- One or more teachers per entry (split language groups, team teaching)
CREATE TABLE timetable_entry_teachers (
  entry_id    INTEGER NOT NULL REFERENCES timetable_entries(entry_id) ON DELETE CASCADE,
  staff_id    INTEGER NOT NULL REFERENCES staff(staff_id),
  group_label VARCHAR(30),                                    -- "Hindi group", "Boys"
  tenant_id   INTEGER NOT NULL REFERENCES tenants(tenant_id),
  year_id     INTEGER NOT NULL, day_of_week INTEGER NOT NULL, period_id INTEGER NOT NULL,   -- copied for the clash check
  PRIMARY KEY (entry_id, staff_id),
  UNIQUE (staff_id, year_id, day_of_week, period_id)          -- a teacher can't be in two places
);

-- A section slot can't also be covered by a grade-wide block, and vice versa
CREATE OR REPLACE FUNCTION trg_timetable_block_check() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE pno INT; clash INT;
BEGIN
  SELECT period_no INTO pno FROM bell_periods WHERE period_id = NEW.period_id;
  SELECT COUNT(*) INTO clash FROM timetable_entries e JOIN bell_periods b ON b.period_id = e.period_id
  WHERE e.entry_id <> COALESCE(NEW.entry_id, -1) AND e.class_id = NEW.class_id AND e.day_of_week = NEW.day_of_week
    AND (e.section_id IS NULL OR NEW.section_id IS NULL OR e.section_id = NEW.section_id)
    AND int4range(b.period_no, b.period_no + e.period_span) && int4range(pno, pno + NEW.period_span);
  IF clash > 0 THEN RAISE EXCEPTION 'Slot already taken for this class on this day'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER timetable_block_check BEFORE INSERT OR UPDATE ON timetable_entries FOR EACH ROW EXECUTE FUNCTION trg_timetable_block_check();

CREATE TABLE timetable_substitutions (
  sub_id        SERIAL PRIMARY KEY,
  tenant_id     INTEGER NOT NULL REFERENCES tenants(tenant_id),
  entry_id      INTEGER NOT NULL REFERENCES timetable_entries(entry_id),
  sub_date      DATE NOT NULL,
  substitute_id INTEGER NOT NULL REFERENCES staff(staff_id),
  reason        VARCHAR(120),
  UNIQUE (entry_id, sub_date)
);

-- ---------------------------------------------------------------------
-- 6. WEBSITE CONNECTION & MENU LINKS
-- ---------------------------------------------------------------------
CREATE TABLE website_connections (
  tenant_id        INTEGER PRIMARY KEY REFERENCES tenants(tenant_id),
  mode             VARCHAR(10) NOT NULL CHECK (mode IN ('EXISTING','NEW')),
  site_url         VARCHAR(255),                     -- existing site, e.g. https://www.greenvalley.edu.in
  app_domain       VARCHAR(120),                     -- e.g. app.greenvalley.edu.in (CNAME to the platform; Enterprise)
  embed_origins    TEXT[] DEFAULT '{}',              -- sites allowed to embed widgets (Content-Security-Policy frame-ancestors)
  verified_at      TIMESTAMP,                        -- DNS TXT record checked
  updated_by       INTEGER REFERENCES users(user_id),
  updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Extra menu items that open web pages, placed under any main menu
CREATE TABLE menu_links (
  link_id      SERIAL PRIMARY KEY,
  tenant_id    INTEGER NOT NULL REFERENCES tenants(tenant_id),
  parent_menu_id INTEGER REFERENCES menus(menu_id),  -- NULL = new top-level menu
  label        VARCHAR(60) NOT NULL,
  url          VARCHAR(500) NOT NULL CHECK (url ~ '^https://'),
  open_mode    VARCHAR(10) NOT NULL DEFAULT 'NEW_TAB' CHECK (open_mode IN ('NEW_TAB','SAME_TAB','EMBEDDED')),
  role_codes   TEXT[] NOT NULL DEFAULT '{ADMIN}',    -- who sees the link
  pass_context BOOLEAN DEFAULT FALSE,                -- append ?school=&role= (never personal data)
  sort_order   INTEGER DEFAULT 99,
  is_active    BOOLEAN DEFAULT TRUE,
  created_by   INTEGER REFERENCES users(user_id),
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Public pages the platform hosts for the school (new site, or embedded into the existing one)
CREATE TABLE public_pages (
  page_id     SERIAL PRIMARY KEY,
  tenant_id   INTEGER NOT NULL REFERENCES tenants(tenant_id),
  kind        VARCHAR(20) NOT NULL CHECK (kind IN ('PAY_FEES','ADMISSION_ENQUIRY','PARENT_LOGIN','NOTICES','TIMETABLE','CONTACT','CUSTOM')),
  title       VARCHAR(120) NOT NULL,
  slug        VARCHAR(60) NOT NULL,
  content     JSONB,
  published   BOOLEAN DEFAULT FALSE,
  UNIQUE (tenant_id, slug)
);

-- Menu items a user sees = platform menus they're allowed (v_user_menu) + the school's links for their roles
CREATE VIEW v_user_menu_links WITH (security_invoker = true) AS
SELECT u.user_id, l.link_id, l.parent_menu_id, l.label, l.url, l.open_mode, l.sort_order
FROM users u
JOIN menu_links l ON l.tenant_id = u.tenant_id AND l.is_active
WHERE EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.role_id = ur.role_id
              WHERE ur.user_id = u.user_id AND r.code = ANY (l.role_codes));

-- ---------------------------------------------------------------------
-- 7. ROW-LEVEL SECURITY
-- ---------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['school_bank_accounts','fee_request_campaigns','fee_request_messages','email_outbox','payment_notifications',
                           'bell_periods','timetable_entries','timetable_entry_teachers','timetable_substitutions','website_connections','menu_links','public_pages'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY tenant_isolation ON %I
      USING (tenant_id = current_setting('app.tenant_id', true)::int)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::int)$p$, t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 8. MENUS, FEATURES, PLANS, PERMISSIONS
-- ---------------------------------------------------------------------
INSERT INTO menus (parent_id, code, label, route, sort_order)
SELECT m.menu_id, v.code, v.label, v.route, v.ord FROM menus m JOIN (VALUES
 ('ACCOUNTS','ACC_BANK','Bank & Payment Details','/accounts/bank',0),
 ('FEES','FEE_REQUESTS','Fee Request Emails','/fees/requests',2),
 ('FEES','FEE_MATCHING','Payment Matching','/fees/matching',3),
 ('ACADEMICS','ACA_TIMETABLE','Timetable','/academics/timetable',5),
 ('OPERATIONS','OPS_WEBSITE','Website & Links','/ops/website',6)
) AS v(parent, code, label, route, ord) ON m.code = v.parent;

INSERT INTO features (parent_id, code, name, kind, menu_id, sort_order)
SELECT pf.feature_id, m.code, m.label, 'SUBMENU', m.menu_id, m.sort_order
FROM menus m JOIN menus pm ON pm.menu_id = m.parent_id JOIN features pf ON pf.code = pm.code
WHERE m.code IN ('ACC_BANK','FEE_REQUESTS','FEE_MATCHING','ACA_TIMETABLE','OPS_WEBSITE');
INSERT INTO features (parent_id, code, name, kind, sort_order)
SELECT f.feature_id, v.code, v.name, 'FUNCTION', 300 + v.ord FROM features f JOIN (VALUES
 ('FEES','FN_BANK_STATEMENT_MATCH','Bank statement import & auto-matching',1),
 ('OPERATIONS','FN_WEBSITE_WIDGETS','Website widgets (pay fees, enquiry, notices)',2)
) AS v(module, code, name, ord) ON f.code = v.module;

-- Bank & Payment Details is needed on every plan, so the Accounts menu now appears on all plans
-- (its other sub-menus stay Professional+)
INSERT INTO plan_features (plan_id, feature_id)
SELECT p.plan_id, f.feature_id FROM features f JOIN (VALUES
 ('ACCOUNTS',1),('ACC_BANK',1),('FEE_REQUESTS',1),('ACA_TIMETABLE',1),('OPS_WEBSITE',1),
 ('FEE_MATCHING',2),('FN_BANK_STATEMENT_MATCH',2),('FN_WEBSITE_WIDGETS',2)
) AS v(code, min_rank) ON f.code = v.code JOIN plans p ON p.tier_rank >= v.min_rank
ON CONFLICT DO NOTHING;

INSERT INTO role_menu_permissions (role_id, menu_id, can_view, can_create, can_edit, can_delete, can_approve, data_scope)
SELECT r.role_id, m.menu_id, TRUE,
       r.code IN ('ADMIN','ACCOUNTANT') OR (r.code = 'TEACHER' AND FALSE),
       r.code IN ('ADMIN','ACCOUNTANT'),
       r.code = 'ADMIN',
       r.code IN ('ADMIN','PRINCIPAL') AND m.code = 'ACC_BANK',      -- bank details need a second person to verify
       CASE WHEN r.code = 'TEACHER' THEN 'OWN_CLASS' ELSE 'ALL' END
FROM roles r JOIN menus m ON
     (r.code IN ('ADMIN') AND m.code IN ('ACC_BANK','FEE_REQUESTS','FEE_MATCHING','ACA_TIMETABLE','OPS_WEBSITE'))
  OR (r.code = 'ACCOUNTANT' AND m.code IN ('ACCOUNTS','ACC_BANK','FEE_REQUESTS','FEE_MATCHING'))
  OR (r.code = 'PRINCIPAL' AND m.code IN ('ACC_BANK','FEE_REQUESTS','FEE_MATCHING','ACA_TIMETABLE'))
  OR (r.code IN ('TEACHER','STUDENT','PARENT') AND m.code = 'ACA_TIMETABLE')
ON CONFLICT DO NOTHING;
-- Admin also edits the timetable
UPDATE role_menu_permissions p SET can_create = TRUE, can_edit = TRUE
FROM roles r, menus m WHERE p.role_id = r.role_id AND p.menu_id = m.menu_id AND r.code = 'ADMIN' AND m.code = 'ACA_TIMETABLE';
-- Parents and students reach the timetable through the Academics menu; make sure the parent module is visible to them
INSERT INTO role_menu_permissions (role_id, menu_id, can_view, data_scope)
SELECT r.role_id, m.menu_id, TRUE, CASE WHEN r.code = 'PARENT' THEN 'OWN_CHILD' ELSE 'SELF' END
FROM roles r JOIN menus m ON m.code = 'ACADEMICS' WHERE r.code IN ('PARENT','STUDENT','TEACHER')
ON CONFLICT DO NOTHING;


-- =====================================================================
-- 9. FEE STRUCTURE AS SCHOOLS PUBLISH IT
--    Grade groups (I–IV, V–VII, VIII–X, XI, XII), transport by pick-up-point band,
--    payment options (single with discount, instalments, finance partner),
--    charges billed per use (uniforms, books, excursions, dining / transport arrears)
-- =====================================================================
CREATE TABLE fee_grade_groups (
  group_id   SERIAL PRIMARY KEY,
  tenant_id  INTEGER NOT NULL REFERENCES tenants(tenant_id),
  name       VARCHAR(20) NOT NULL,                  -- "I–IV"
  level_from INTEGER NOT NULL, level_to INTEGER NOT NULL,
  sort_order INTEGER DEFAULT 0,
  UNIQUE (tenant_id, name)
);
ALTER TABLE fee_structures ADD COLUMN group_id INTEGER REFERENCES fee_grade_groups(group_id);   -- set instead of class_id
ALTER TABLE fee_structures ALTER COLUMN class_id DROP NOT NULL;
ALTER TABLE fee_heads ADD COLUMN billing_basis VARCHAR(12) NOT NULL DEFAULT 'FIXED' CHECK (billing_basis IN ('FIXED','BAND','PER_USE'));
ALTER TABLE fee_heads ADD COLUMN show_in_structure BOOLEAN DEFAULT TRUE;

CREATE TABLE transport_bands (
  band_id    SERIAL PRIMARY KEY,
  tenant_id  INTEGER NOT NULL REFERENCES tenants(tenant_id),
  year_id    INTEGER NOT NULL REFERENCES academic_years(year_id),
  band_no    INTEGER NOT NULL,                      -- 1–6
  description VARCHAR(120),                         -- distance range or area list
  UNIQUE (tenant_id, year_id, band_no)
);
CREATE TABLE transport_band_fees (
  band_id   INTEGER NOT NULL REFERENCES transport_bands(band_id) ON DELETE CASCADE,
  group_id  INTEGER NOT NULL REFERENCES fee_grade_groups(group_id),
  amount    NUMERIC(12,2) NOT NULL,                 -- yearly
  tenant_id INTEGER NOT NULL REFERENCES tenants(tenant_id),
  PRIMARY KEY (band_id, group_id)
);
CREATE TABLE pickup_points (
  point_id  SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(tenant_id),
  route     VARCHAR(40), name VARCHAR(80) NOT NULL,
  band_id   INTEGER NOT NULL REFERENCES transport_bands(band_id)
);
ALTER TABLE enrollments ADD COLUMN pickup_point_id INTEGER REFERENCES pickup_points(point_id);

CREATE TABLE payment_plans (
  plan_id        SERIAL PRIMARY KEY,
  tenant_id      INTEGER NOT NULL REFERENCES tenants(tenant_id),
  year_id        INTEGER NOT NULL REFERENCES academic_years(year_id),
  code           VARCHAR(20) NOT NULL,              -- SINGLE, THREE_INST, FINANCE
  name           VARCHAR(60) NOT NULL,
  discount_pct   NUMERIC(5,2) DEFAULT 0,            -- 5% for single payment
  discount_heads TEXT[] DEFAULT '{Tuition}',        -- which heads the discount applies to
  choose_by      DATE,                              -- "option available till June"
  partner_name   VARCHAR(60),                       -- finance partner, pays the school on the parent's behalf
  notes          TEXT,
  UNIQUE (tenant_id, year_id, code)
);
CREATE TABLE payment_plan_instalments (
  plan_id     INTEGER NOT NULL REFERENCES payment_plans(plan_id) ON DELETE CASCADE,
  inst_no     INTEGER NOT NULL,
  label       VARCHAR(30) NOT NULL,                 -- "Instalment III"
  due_month   INTEGER NOT NULL CHECK (due_month BETWEEN 1 AND 12),
  due_day     INTEGER NOT NULL DEFAULT 10,
  share_pct   NUMERIC(5,2) NOT NULL,                -- of the yearly fee
  tenant_id   INTEGER NOT NULL REFERENCES tenants(tenant_id),
  PRIMARY KEY (plan_id, inst_no)
);
ALTER TABLE enrollments ADD COLUMN payment_plan_id INTEGER REFERENCES payment_plans(plan_id);

-- Invoice fields used by the printed invoice
ALTER TABLE fee_invoices ADD COLUMN invoice_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE fee_invoices ADD COLUMN instalment_label VARCHAR(30);
ALTER TABLE fee_invoices ADD COLUMN previous_outstanding NUMERIC(12,2) DEFAULT 0;
ALTER TABLE fee_invoices ADD COLUMN advance_applied NUMERIC(12,2) DEFAULT 0;

-- Indian-format amount in words: 103070 → "One Lakh, Three Thousand And Seventy"
CREATE OR REPLACE FUNCTION amount_in_words_inr(amt NUMERIC) RETURNS TEXT LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  ones TEXT[] := ARRAY['One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen',
                       'Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  tens TEXT[] := ARRAY['','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  n BIGINT := floor(amt); parts TEXT[] := '{}'; crore INT; lakh INT; thou INT; hund INT; rest INT; tail TEXT := '';
BEGIN
  IF n = 0 THEN RETURN 'Zero'; END IF;
  crore := n / 10000000; n := n % 10000000;
  lakh := n / 100000;    n := n % 100000;
  thou := n / 1000;      n := n % 1000;
  hund := n / 100;       rest := n % 100;
  IF crore > 0 THEN parts := parts || (amount_in_words_inr(crore) || ' Crore'); END IF;
  IF lakh > 0 THEN parts := parts || ((CASE WHEN lakh < 20 THEN ones[lakh] ELSE tens[lakh/10] || CASE WHEN lakh%10>0 THEN ' ' || ones[lakh%10] ELSE '' END END) || ' Lakh'); END IF;
  IF thou > 0 THEN parts := parts || ((CASE WHEN thou < 20 THEN ones[thou] ELSE tens[thou/10] || CASE WHEN thou%10>0 THEN ' ' || ones[thou%10] ELSE '' END END) || ' Thousand'); END IF;
  IF hund > 0 THEN parts := parts || (ones[hund] || ' Hundred'); END IF;
  IF rest > 0 THEN
    tail := CASE WHEN rest < 20 THEN ones[rest] ELSE tens[rest/10] || CASE WHEN rest%10>0 THEN ' ' || ones[rest%10] ELSE '' END END;
  END IF;
  RETURN array_to_string(parts, ', ') || CASE WHEN tail <> '' THEN CASE WHEN array_length(parts,1) > 0 THEN ' And ' ELSE '' END || tail ELSE '' END;
END $$;

-- What the printed invoice reads
CREATE VIEW v_invoice_print WITH (security_invoker = true) AS
SELECT i.invoice_id, i.tenant_id, i.invoice_no, i.invoice_date, i.due_date, i.instalment_label,
       s.first_name || ' ' || COALESCE(s.last_name,'') AS student_name, s.admission_no, cl.name AS program,
       i.net_amount AS grand_total, i.previous_outstanding, i.advance_applied,
       i.net_amount + i.previous_outstanding - i.advance_applied AS net_payable,
       'INR ' || amount_in_words_inr(i.net_amount + i.previous_outstanding - i.advance_applied) || ' only' AS net_payable_words
FROM fee_invoices i
JOIN enrollments e ON e.enrollment_id = i.enrollment_id
JOIN students s ON s.student_id = e.student_id
JOIN sections sec ON sec.section_id = e.section_id
JOIN classes cl ON cl.class_id = sec.class_id;

-- =====================================================================
-- 10. ASSESSMENT PROFILE (narrative term report + appreciation cards)
-- =====================================================================
CREATE TABLE assessment_profiles (
  profile_id    SERIAL PRIMARY KEY,
  tenant_id     INTEGER NOT NULL REFERENCES tenants(tenant_id),
  enrollment_id INTEGER NOT NULL REFERENCES enrollments(enrollment_id),
  term_code     VARCHAR(12) NOT NULL CHECK (term_code IN ('TERM1','TERM2','FINAL')),
  headline      VARCHAR(200),                      -- one-line appreciation at the top
  observations  TEXT,                              -- "Our observations"
  in_class      TEXT,                              -- conduct and learning in class
  projects      TEXT,                              -- assessment projects
  closing_note  TEXT,
  status        VARCHAR(12) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','REVIEWED','PUBLISHED')),
  written_by    INTEGER REFERENCES users(user_id),
  reviewed_by   INTEGER REFERENCES users(user_id),  -- coordinator
  published_at  TIMESTAMP,
  UNIQUE (enrollment_id, term_code)
);
CREATE TABLE profile_subject_comments (
  profile_id  INTEGER NOT NULL REFERENCES assessment_profiles(profile_id) ON DELETE CASCADE,
  subject_id  INTEGER NOT NULL REFERENCES subjects(subject_id),
  subject_group VARCHAR(30),                        -- Language · Math & Sciences · Social Sciences
  comment     TEXT NOT NULL,
  teacher_id  INTEGER REFERENCES staff(staff_id),
  tenant_id   INTEGER NOT NULL REFERENCES tenants(tenant_id),
  PRIMARY KEY (profile_id, subject_id)
);
CREATE TABLE comment_bank (                        -- reusable phrases teachers pick from
  phrase_id  SERIAL PRIMARY KEY,
  tenant_id  INTEGER REFERENCES tenants(tenant_id),
  area       VARCHAR(30) NOT NULL,                  -- Conduct · Learning · Subject
  phrase     TEXT NOT NULL
);
CREATE TABLE appreciation_cards (
  card_id     SERIAL PRIMARY KEY,
  tenant_id   INTEGER NOT NULL REFERENCES tenants(tenant_id),
  student_id  INTEGER NOT NULL REFERENCES students(student_id),
  year_id     INTEGER REFERENCES academic_years(year_id),
  title       VARCHAR(60) DEFAULT 'Bravo!',
  message     TEXT NOT NULL,
  design      VARCHAR(20) DEFAULT 'BORDER' CHECK (design IN ('BORDER','STARS','PLAIN')),
  signed_by   INTEGER[],                            -- staff ids whose stored signatures print
  issued_on   DATE DEFAULT CURRENT_DATE
);
ALTER TABLE staff ADD COLUMN signature_url VARCHAR(255);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['fee_grade_groups','transport_bands','transport_band_fees','pickup_points','payment_plans',
                           'payment_plan_instalments','assessment_profiles','profile_subject_comments','appreciation_cards'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY tenant_isolation ON %I
      USING (tenant_id = current_setting('app.tenant_id', true)::int)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::int)$p$, t);
  END LOOP;
  ALTER TABLE comment_bank ENABLE ROW LEVEL SECURITY;
  CREATE POLICY shared_or_own ON comment_bank USING (tenant_id IS NULL OR tenant_id = current_setting('app.tenant_id', true)::int)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::int);
END $$;

INSERT INTO menus (parent_id, code, label, route, sort_order)
SELECT m.menu_id, 'EXM_PROFILE', 'Assessment Profiles', '/exams/profiles', 6 FROM menus m WHERE m.code = 'EXAMS';
INSERT INTO features (parent_id, code, name, kind, menu_id, sort_order)
SELECT pf.feature_id, m.code, m.label, 'SUBMENU', m.menu_id, m.sort_order FROM menus m JOIN features pf ON pf.code = 'EXAMS' WHERE m.code = 'EXM_PROFILE';
INSERT INTO plan_features (plan_id, feature_id) SELECT p.plan_id, f.feature_id FROM features f, plans p WHERE f.code = 'EXM_PROFILE';
INSERT INTO role_menu_permissions (role_id, menu_id, can_view, can_create, can_edit, can_approve, data_scope)
SELECT r.role_id, m.menu_id, TRUE, r.code IN ('ADMIN','TEACHER'), r.code IN ('ADMIN','TEACHER'), r.code IN ('ADMIN','PRINCIPAL'),
       CASE WHEN r.code = 'TEACHER' THEN 'OWN_CLASS' ELSE 'ALL' END
FROM roles r JOIN menus m ON m.code = 'EXM_PROFILE' WHERE r.code IN ('ADMIN','PRINCIPAL','TEACHER');
