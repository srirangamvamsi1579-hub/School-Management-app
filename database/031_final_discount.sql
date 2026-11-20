-- =====================================================================
-- 031  Release 14.2: an additional discount on the final proposal (everything payable, every year and one-time),
--      on top of the discount on the plan and add-ons. The client's PDF shows only the discounts applied and the
--      amount payable; the maximum discount and approval limits stay internal.
--      Run after 001–030.
-- =====================================================================
ALTER TABLE sales_proposals
  ADD COLUMN final_discount_pct NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (final_discount_pct BETWEEN 0 AND 20),
  ADD COLUMN payable_year_one  NUMERIC(12,2) CHECK (payable_year_one >= 0);   -- year one after both discounts, before GST

-- An additional discount that takes profit under the floor needs the owner's approval, like a large plan discount
ALTER TABLE sales_proposals ADD CONSTRAINT sales_proposals_final_discount_approval
  CHECK (final_discount_pct = 0 OR profit IS NULL OR yearly_total = 0 OR profit / yearly_total * 100 >= 15 OR discount_approved_by IS NOT NULL);

-- What the client is shown about discounts: only what was applied (never the limits)
CREATE VIEW v_proposal_client_discount AS
  SELECT proposal_id, proposal_no, discount_pct, final_discount_pct, payable_year_one FROM sales_proposals;
