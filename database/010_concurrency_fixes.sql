-- =====================================================================
-- 010  Fixes found by the concurrency tests (database/tests/concurrency)
--      1. Receipt numbers collided when payments arrived at the same moment
--      2. The same bank line could be receipted twice by two people matching it at once
--      3. Invoices are locked while a payment is allocated to them
--      4. The same parent request sent twice at once (phone + website) created two requests
--      5. Two applicants enrolled at once could both take the last seat
--      6. Indexes for the queries the load test exercises most
--      Run after 001–009.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Gap-free, collision-free document numbers per school and year
-- ---------------------------------------------------------------------
CREATE TABLE doc_counters (
  tenant_id INTEGER NOT NULL REFERENCES tenants(tenant_id),
  doc_type  VARCHAR(20) NOT NULL,          -- RECEIPT, INVOICE, VOUCHER, APPLICATION, REQUEST …
  year      INTEGER NOT NULL,
  last_no   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, doc_type, year)
);
ALTER TABLE doc_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON doc_counters USING (tenant_id = current_setting('app.tenant_id', true)::int)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::int);

-- One row per school/type/year; the UPSERT locks that row, so concurrent callers queue and each gets the next number
CREATE OR REPLACE FUNCTION next_doc_no(p_tenant INT, p_type TEXT, p_year INT) RETURNS INTEGER LANGUAGE sql AS $$
  INSERT INTO doc_counters (tenant_id, doc_type, year, last_no) VALUES (p_tenant, p_type, p_year, 1)
  ON CONFLICT (tenant_id, doc_type, year) DO UPDATE SET last_no = doc_counters.last_no + 1
  RETURNING last_no;
$$;
-- Start each school's receipt counter after the receipts it already has
INSERT INTO doc_counters (tenant_id, doc_type, year, last_no)
SELECT tenant_id, 'RECEIPT', extract(year FROM paid_at)::int, count(*) FROM fee_payments GROUP BY 1, 3
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------
-- 2 + 3. apply_payment: refuse a notification someone else has just matched; lock invoices; use the counter
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION apply_payment(p_notification BIGINT, p_message BIGINT, p_user INTEGER, p_status TEXT)
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE n payment_notifications%ROWTYPE; m fee_request_messages%ROWTYPE; s students%ROWTYPE;
        v_pay INTEGER; v_receipt TEXT; v_voucher INTEGER; remaining NUMERIC; inv RECORD; part NUMERIC;
        item RECORD; item_total NUMERIC; credited NUMERIC; line_amt NUMERIC; bank_ledger INTEGER; v_remarks TEXT;
        v_seq INTEGER; t tenants%ROWTYPE;
BEGIN
  SELECT * INTO n FROM payment_notifications WHERE notification_id = p_notification FOR UPDATE;
  IF n.match_status IN ('AUTO_MATCHED','MANUAL_MATCHED') OR n.matched_payment_id IS NOT NULL THEN
    RAISE EXCEPTION 'This payment was already matched (receipt id %)', n.matched_payment_id USING ERRCODE = 'unique_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM fee_payments WHERE tenant_id = n.tenant_id AND txn_ref = n.external_ref) THEN
    RAISE EXCEPTION 'Reference % is already receipted', n.external_ref USING ERRCODE = 'unique_violation';
  END IF;
  SELECT * INTO m FROM fee_request_messages WHERE message_id = p_message FOR UPDATE;
  SELECT * INTO s FROM students WHERE student_id = m.student_id;
  SELECT * INTO t FROM tenants WHERE tenant_id = n.tenant_id;

  v_seq := next_doc_no(n.tenant_id, 'RECEIPT', extract(year FROM n.paid_at)::int);
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

  remaining := n.amount;
  FOR inv IN SELECT * FROM fee_invoices WHERE invoice_id = ANY (m.invoice_ids) AND status IN ('DUE','PARTIAL','OVERDUE')
             ORDER BY due_date, invoice_id FOR UPDATE LOOP                      -- lock: another payment waits, then sees the new balance
    EXIT WHEN remaining <= 0;
    part := LEAST(remaining, inv.net_amount - inv.paid_amount);
    CONTINUE WHEN part <= 0;
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
  IF remaining > 0 THEN
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

-- ---------------------------------------------------------------------
-- 4. One active request of a kind per child per day, enforced by the database even for simultaneous inserts
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE parent_requests ADD CONSTRAINT one_active_request_per_day
  EXCLUDE USING gist (student_id WITH =, kind WITH =, daterange(date_from, date_to, '[]') WITH &&)
  WHERE (status IN ('SUBMITTED','APPROVED'));

-- ---------------------------------------------------------------------
-- 5. Enrolment: lock the grade's sections before counting seats, so two enrolments queue instead of both taking the last seat
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION enrol_applicant(p_enquiry INT, p_admission_no TEXT) RETURNS INT
LANGUAGE plpgsql AS $$
DECLARE e admission_enquiries%ROWTYPE; v_student INT; v_guardian INT; v_section INT;
BEGIN
  SELECT * INTO e FROM admission_enquiries WHERE enquiry_id = p_enquiry FOR UPDATE;
  IF e.status <> 'OFFERED' THEN RAISE EXCEPTION 'Only an offered applicant can be enrolled (status is %)', e.status; END IF;
  PERFORM 1 FROM sections WHERE class_id = e.class_id AND tenant_id = e.tenant_id ORDER BY section_id FOR UPDATE;
  SELECT s.section_id INTO v_section FROM sections s
    LEFT JOIN enrollments en ON en.section_id = s.section_id AND en.year_id = e.year_id AND en.status = 'STUDYING'
   WHERE s.class_id = e.class_id AND s.tenant_id = e.tenant_id
   GROUP BY s.section_id, s.capacity HAVING count(en.enrollment_id) < s.capacity
   ORDER BY count(en.enrollment_id), s.section_id LIMIT 1;
  IF v_section IS NULL THEN RAISE EXCEPTION 'No free seat in this grade'; END IF;
  INSERT INTO students (tenant_id, admission_no, first_name, last_name, gender, dob, previous_school, admission_date, address)
  VALUES (e.tenant_id, p_admission_no, e.child_first, e.child_last, e.gender, e.dob, e.previous_school, CURRENT_DATE, e.address) RETURNING student_id INTO v_student;
  SELECT g.guardian_id INTO v_guardian FROM guardians g WHERE g.tenant_id = e.tenant_id AND g.phone = e.parent_phone LIMIT 1;
  IF v_guardian IS NULL THEN
    INSERT INTO guardians (tenant_id, full_name, relation, phone, email) VALUES (e.tenant_id, e.parent_name, 'GUARDIAN', e.parent_phone, e.parent_email) RETURNING guardian_id INTO v_guardian;
  END IF;
  INSERT INTO student_guardians (tenant_id, student_id, guardian_id, is_primary) VALUES (e.tenant_id, v_student, v_guardian, TRUE);
  INSERT INTO enrollments (tenant_id, student_id, year_id, section_id) VALUES (e.tenant_id, v_student, e.year_id, v_section);
  UPDATE admission_enquiries SET student_id = v_student, status = 'ENROLLED' WHERE enquiry_id = p_enquiry;
  RETURN v_student;
END $$;

-- ---------------------------------------------------------------------
-- 6. Indexes for the hot paths (manifest, dues, payments, requests, rankings)
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS enrollments_section_idx      ON enrollments (section_id);
CREATE INDEX IF NOT EXISTS enrollments_pickup_idx       ON enrollments (pickup_point_id) WHERE pickup_point_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS enrollments_student_idx      ON enrollments (student_id);
CREATE INDEX IF NOT EXISTS fee_invoices_enrollment_idx  ON fee_invoices (enrollment_id);
CREATE INDEX IF NOT EXISTS payment_alloc_invoice_idx    ON payment_allocations (invoice_id);
CREATE INDEX IF NOT EXISTS fee_payments_ref_idx         ON fee_payments (tenant_id, txn_ref);
CREATE INDEX IF NOT EXISTS student_guardians_student_idx ON student_guardians (student_id);
CREATE INDEX IF NOT EXISTS parent_requests_student_idx  ON parent_requests (student_id, kind);
CREATE INDEX IF NOT EXISTS exam_results_enrollment_idx  ON exam_results (enrollment_id);
CREATE INDEX IF NOT EXISTS fee_request_messages_student ON fee_request_messages (student_id);

-- ---------------------------------------------------------------------
-- 7. How the API must set the school for each request (connection pools)
--    Always transaction-local, so a pooled connection never keeps the last school:
--      BEGIN; SELECT app_context(:tenant, :user); …queries…; COMMIT;
--    A connection used without it fails closed (the RLS policies raise an error) instead of showing data.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_context(p_tenant INT, p_user INT) RETURNS VOID LANGUAGE sql AS $$
  SELECT set_config('app.tenant_id', p_tenant::text, true), set_config('app.user_id', COALESCE(p_user::text, ''), true);
$$;
