-- Checks for 031 (release 14.2). Rolled back. Expect NOTICE: Additional discount ok
\set ON_ERROR_STOP 1
SET client_min_messages = notice;
BEGIN;
DO $$ DECLARE pr INTEGER; BEGIN
  INSERT INTO sales_proposals (proposal_no, client_name, students, plan_code, options, monthly_total, yearly_total, discount_pct, final_discount_pct, operating_cost, profit, payable_year_one)
  VALUES ('PROP-2026-960', 'Hillview School (example)', 650, 'PRO', '{}', 23667, 284003, 10, 5, 234003, 50000, 328128) RETURNING proposal_id INTO pr;
  BEGIN UPDATE sales_proposals SET final_discount_pct = 25 WHERE proposal_id = pr; RAISE EXCEPTION 'over 20 percent';
  EXCEPTION WHEN check_violation THEN NULL; END;
  -- 39,203 / 2,84,003 = 13.8% profit: under the 15% floor, so it needs the owner's approval
  BEGIN UPDATE sales_proposals SET operating_cost = 244800, profit = 39203 WHERE proposal_id = pr; RAISE EXCEPTION 'profit under the floor without approval';
  EXCEPTION WHEN check_violation THEN NULL; END;
  ASSERT NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'v_proposal_client_discount' AND column_name IN ('max_discount_pct', 'profit', 'operating_cost', 'gross_margin_pct')), 'client view has no limits or margins';
  RAISE NOTICE 'Additional discount ok';
END $$;
ROLLBACK;
