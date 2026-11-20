-- Checks for 029 (release 14). Rolled back.
-- Expect NOTICE: Release 14 menus ok, Sales catalogue ok, Nothing free ok, Proposals ok, Curriculum and portfolios ok, Backups and board ok, Release 14 isolation ok
\set ON_ERROR_STOP 1
SET client_min_messages = notice;
BEGIN;
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM menus WHERE code IN ('STU_PORTFOLIO', 'ACA_CURRICULUM', 'OPS_BACKUP')) = 3, 'three new screens';
  ASSERT (SELECT menu_group FROM menus WHERE code = 'OPS_BACKUP') = 'Data', 'backups under Data';
  ASSERT (SELECT min(p.tier_rank) FROM plan_features JOIN plans p USING (plan_id) JOIN features f USING (feature_id) WHERE f.code = 'ACA_CURRICULUM') = 3, 'LMS from Professional';
  ASSERT (SELECT count(*) FROM features WHERE code IN ('FN_STOP_TIMINGS', 'FN_WHATSAPP', 'FN_BOARD') AND kind = 'FUNCTION') = 3, 'three new functions';
  ASSERT EXISTS (SELECT 1 FROM role_menu_permissions p JOIN roles r USING (role_id) JOIN menus m USING (menu_id) WHERE r.code = 'PARENT' AND m.code = 'STU_PORTFOLIO' AND NOT p.can_edit AND p.data_scope = 'OWN_CHILD'), 'parents view their child''s portfolio';
  ASSERT NOT EXISTS (SELECT 1 FROM role_menu_permissions p JOIN roles r USING (role_id) JOIN menus m USING (menu_id) WHERE m.code = 'OPS_BACKUP' AND r.code <> 'ADMIN'), 'only the Admin restores';
  RAISE NOTICE 'Release 14 menus ok';
END $$;

DO $$ BEGIN
  ASSERT (SELECT string_agg(name, ',' ORDER BY sort_order) FROM sales_tiers) = 'Starter,Pro,Pro+', 'three tiers';
  ASSERT sales_tier_price('PRO', 400) = 300 * 420 + 100 * 380, 'bands like slabs';
  ASSERT sales_tier_price('PRO', 650) = 259000, 'the worked example';
  ASSERT sales_tier_price('STARTER', 50) = 56000, 'small schools pay for 200 (base price)';
  ASSERT sales_tier_price('PRO_PLUS', 2000) = 300 * 600 + 400 * 540 + 800 * 480 + 500 * 420, 'all four bands';
  ASSERT (SELECT count(*) FROM sales_tier_addons WHERE tier_code = 'STARTER') = 0, 'Starter is the basic features only';
  ASSERT (SELECT count(*) FROM sales_tier_addons WHERE tier_code = 'PRO_PLUS') = 15, 'Pro+ includes Pro and eight more';
  ASSERT NOT EXISTS (SELECT addon_code FROM sales_tier_addons WHERE tier_code = 'PRO' EXCEPT SELECT addon_code FROM sales_tier_addons WHERE tier_code = 'PRO_PLUS'), 'Pro+ has everything in Pro';
  ASSERT (SELECT needs FROM sales_addons WHERE addon_code = 'TIMINGS') = 'TRANSPORT', 'timings needs transport';
  ASSERT (SELECT cost = 0 AND provider = 'No service needed' FROM sales_addons WHERE addon_code = 'WHATSAPP'), 'WhatsApp: no service needed';
  ASSERT (SELECT count(*) FROM sales_development) = 6, 'web design and database set-up for each tier';
  RAISE NOTICE 'Sales catalogue ok';
END $$;

DO $$ BEGIN
  BEGIN UPDATE sales_tier_rates SET rate = 0 WHERE tier_code = 'STARTER' AND band_no = 1; RAISE EXCEPTION 'free tier allowed';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN UPDATE sales_addons SET rate = 0 WHERE addon_code = 'WHATSAPP'; RAISE EXCEPTION 'free add-on allowed';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN UPDATE sales_addons SET cost = 5 WHERE addon_code = 'WHATSAPP'; RAISE EXCEPTION 'no-service add-on with a cost';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN UPDATE sales_settings SET storage_rate = 0; RAISE EXCEPTION 'free storage allowed';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN UPDATE sales_development SET price = 0 WHERE item_code = 'WEB_DESIGN' AND tier_code = 'PRO'; RAISE EXCEPTION 'free development allowed';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN INSERT INTO provider_profile (profile_id, name, product, contact, email, phone) VALUES (2, 'x', 'x', 'x', 'a@b.example.com', '1'); RAISE EXCEPTION 'second profile';
  EXCEPTION WHEN check_violation THEN NULL; END;
  RAISE NOTICE 'Nothing free ok';
END $$;

DO $$ DECLARE pid INTEGER; BEGIN
  INSERT INTO sales_proposals (proposal_no, client_name, students, plan_code, options, monthly_total, yearly_total, discount_pct, max_discount_pct, operating_cost, profit, poc_name, poc_email, poc_phone)
  VALUES ('PROP-2026-901', 'Hillview School (example)', 650, 'PRO', '{}', 24912.50, 298950, 10, 13.5, 244800, 54150, 'Mrs. Asha Rao', 'principal@hillview.example.com', '+91 90000 44444') RETURNING proposal_id INTO pid;
  BEGIN UPDATE sales_proposals SET discount_pct = 14 WHERE proposal_id = pid; RAISE EXCEPTION 'over the maximum discount';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN UPDATE sales_proposals SET plan_code = 'GROWTH' WHERE proposal_id = pid; RAISE EXCEPTION 'old plan code';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN UPDATE sales_proposals SET poc_email = 'not-an-email' WHERE proposal_id = pid; RAISE EXCEPTION 'bad email';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN UPDATE sales_proposals SET profit = 1 WHERE proposal_id = pid; RAISE EXCEPTION 'profit must be revenue minus operating cost';
  EXCEPTION WHEN check_violation THEN NULL; END;
  INSERT INTO sales_proposal_emails (proposal_id, to_email, subject, body, pdf_name, pdf_bytes) VALUES (pid, 'principal@hillview.example.com', 'Proposal', 'Dear …', 'PROP-2026-901-Hillview-School.pdf', 98000);
  ASSERT (SELECT status FROM sales_proposals WHERE proposal_id = pid) = 'Sent', 'emailing marks it Sent';
  BEGIN INSERT INTO sales_proposal_emails (proposal_id, to_email, subject, body, pdf_name, pdf_bytes) VALUES (pid, 'x@y.example.com', 'P', 'B', 'proposal.docx', 10); RAISE EXCEPTION 'non-PDF attachment';
  EXCEPTION WHEN check_violation THEN NULL; END;
  RAISE NOTICE 'Proposals ok';
END $$;

DO $$ DECLARE c INTEGER; s INTEGER; u INTEGER; BEGIN
  SELECT class_id INTO c FROM classes LIMIT 1; SELECT student_id INTO s FROM students LIMIT 1;
  IF c IS NULL THEN INSERT INTO classes (tenant_id, name, level_no) VALUES (1, 'Grade VIII (check)', 8) RETURNING class_id INTO c; END IF;
  INSERT INTO curriculum_units (tenant_id, class_id, subject, title, month, periods, taught) VALUES (1, c, 'Mathematics', 'Linear equations', 'Jul', 12, 0) RETURNING unit_id INTO u;
  ASSERT (SELECT status FROM curriculum_units WHERE unit_id = u) = 'Planned';
  UPDATE curriculum_units SET taught = 6 WHERE unit_id = u; ASSERT (SELECT status FROM curriculum_units WHERE unit_id = u) = 'In progress';
  UPDATE curriculum_units SET taught = 12 WHERE unit_id = u; ASSERT (SELECT status FROM curriculum_units WHERE unit_id = u) = 'Taught';
  BEGIN UPDATE curriculum_units SET taught = 13 WHERE unit_id = u; RAISE EXCEPTION 'taught more than planned';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN INSERT INTO curriculum_units (tenant_id, class_id, subject, title, month, periods) VALUES (1, c, 'Science', 'X', 'May', 5); RAISE EXCEPTION 'May is a holiday month';
  EXCEPTION WHEN check_violation THEN NULL; END;
  IF s IS NOT NULL THEN
    INSERT INTO portfolio_items (tenant_id, student_id, title, kind, item_date) VALUES (1, s, 'Science fair model', 'Project', CURRENT_DATE);
    BEGIN INSERT INTO portfolio_items (tenant_id, student_id, title, kind, item_date) VALUES (1, s, 'Poem', 'Poem', CURRENT_DATE); RAISE EXCEPTION 'unknown kind';
    EXCEPTION WHEN check_violation THEN NULL; END;
  END IF;
  RAISE NOTICE 'Curriculum and portfolios ok';
END $$;

DO $$ DECLARE b INTEGER; BEGIN
  INSERT INTO backup_settings (tenant_id) VALUES (1) ON CONFLICT DO NOTHING;
  INSERT INTO backups (tenant_id, kind, taken_at, size_bytes) VALUES (1, 'AUTOMATIC', CURRENT_TIMESTAMP - interval '40 days', 1400000), (1, 'AUTOMATIC', CURRENT_TIMESTAMP - interval '2 days', 1400000);
  ASSERT (SELECT count(*) FROM backups_to_expire WHERE tenant_id = 1) = 1, 'only the 40-day-old backup expires (kept 30 days)';
  SELECT backup_id INTO b FROM backups WHERE tenant_id = 1 ORDER BY taken_at DESC LIMIT 1;
  INSERT INTO backups (tenant_id, kind, restored_from) VALUES (1, 'RESTORE', b);
  BEGIN INSERT INTO backups (tenant_id, kind) VALUES (1, 'RESTORE'); RAISE EXCEPTION 'restore without a source';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN UPDATE backup_settings SET keep_days = 45 WHERE tenant_id = 1; RAISE EXCEPTION 'keep days 7, 30 or 90';
  EXCEPTION WHEN check_violation THEN NULL; END;
  ASSERT (SELECT exam_board FROM tenants WHERE tenant_id = 1) = 'CBSE', 'CBSE by default';
  UPDATE tenants SET exam_board = 'IB' WHERE tenant_id = 1;
  BEGIN UPDATE tenants SET exam_board = 'XYZ' WHERE tenant_id = 1; RAISE EXCEPTION 'unknown board';
  EXCEPTION WHEN check_violation THEN NULL; END;
  RAISE NOTICE 'Backups and board ok';
END $$;

DO $$ BEGIN
  ASSERT (SELECT bool_and(relrowsecurity) FROM pg_class WHERE relname IN ('curriculum_units', 'portfolio_items', 'backup_settings', 'backups')), 'row-level security on the school tables';
  ASSERT NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name IN ('sales_tiers', 'sales_addons', 'sales_proposal_emails', 'provider_profile') AND column_name = 'tenant_id'), 'sales tables belong to our company, not a school';
  RAISE NOTICE 'Release 14 isolation ok';
END $$;
ROLLBACK;
