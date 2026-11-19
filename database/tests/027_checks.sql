-- Checks for 027 (release 13). Rolled back.
-- Expect NOTICE: Release 13 menus ok, Library ok, Hostel ok, Homework and classes ok, Store and events ok, Service Provider ok, Tenant isolation ok
\set ON_ERROR_STOP 1
SET client_min_messages = notice;
BEGIN;
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM menus m JOIN menus p ON p.menu_id = m.parent_id WHERE p.code = 'CAMPUS') = 6, 'six Campus screens';
  ASSERT (SELECT count(*) FROM menus m JOIN menus p ON p.menu_id = m.parent_id WHERE p.code = 'SERVICE_PROVIDER') = 5, 'five Service Provider screens';
  ASSERT (SELECT string_agg(DISTINCT m.menu_group, ',' ORDER BY m.menu_group) FROM menus m JOIN menus p ON p.menu_id = m.parent_id WHERE p.code = 'SERVICE_PROVIDER') = 'Market,Sales', 'grouped Sales / Market';
  ASSERT (SELECT min(p.tier_rank) FROM plan_features pf JOIN plans p USING (plan_id) JOIN features f USING (feature_id) WHERE f.code = 'CMP_HOSTEL') = 4, 'hostel in Enterprise';
  ASSERT (SELECT min(p.tier_rank) FROM plan_features pf JOIN plans p USING (plan_id) JOIN features f USING (feature_id) WHERE f.code = 'CMP_LIBRARY') = 2, 'library from Growth';
  ASSERT (SELECT count(*) FROM plan_features pf JOIN features f USING (feature_id) WHERE f.code = 'CMP_HOMEWORK') = (SELECT count(*) FROM plans), 'homework in every plan';
  ASSERT (SELECT min(p.tier_rank) FROM plan_features pf JOIN plans p USING (plan_id) JOIN features f USING (feature_id) WHERE f.code = 'FN_ROUTE_PLANNING') = 3, 'route planning from Professional';
  ASSERT NOT EXISTS (SELECT 1 FROM features WHERE code LIKE 'SP\_%' OR code = 'SERVICE_PROVIDER'), 'company menus are not plan features';
  ASSERT EXISTS (SELECT 1 FROM roles WHERE code = 'SALES' AND tenant_id IS NULL), 'sales role';
  ASSERT EXISTS (SELECT 1 FROM role_menu_permissions p JOIN roles r USING (role_id) JOIN menus m USING (menu_id) WHERE r.code = 'SALES' AND m.code = 'SP_PROPOSAL' AND p.can_create), 'sales builds proposals';
  ASSERT EXISTS (SELECT 1 FROM role_menu_permissions p JOIN roles r USING (role_id) JOIN menus m USING (menu_id) WHERE r.code = 'SALES' AND m.code = 'SP_RATES' AND NOT p.can_edit), 'sales only views prices';
  ASSERT NOT EXISTS (SELECT 1 FROM role_menu_permissions p JOIN roles r USING (role_id) JOIN menus m USING (menu_id) JOIN menus pm ON pm.menu_id = m.parent_id WHERE pm.code = 'SERVICE_PROVIDER' AND r.code NOT IN ('PLATFORM', 'SALES', 'ADMIN')), 'no school role but the Admin has company menus (028)';
  ASSERT EXISTS (SELECT 1 FROM role_menu_permissions p JOIN roles r USING (role_id) JOIN menus m USING (menu_id) WHERE r.code = 'PARENT' AND m.code = 'CMP_HOMEWORK' AND p.data_scope = 'OWN_CHILD' AND NOT p.can_edit), 'parents view their child''s homework';
  BEGIN
    INSERT INTO role_menu_permissions (role_id, menu_id, can_view) SELECT r.role_id, m.menu_id, TRUE FROM roles r, menus m WHERE r.code = 'PRINCIPAL' AND r.tenant_id IS NULL AND m.code = 'SP_RATES';
    RAISE EXCEPTION 'principal given a company menu';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM LIKE 'Service Provider menus%', SQLERRM; END;
  RAISE NOTICE 'Release 13 menus ok';
END $$;

-- A school with two classes and students
INSERT INTO classes (tenant_id, name, level_no) VALUES (1, 'Grade IX', 9);
INSERT INTO sections (tenant_id, class_id, name) SELECT 1, class_id, 'A' FROM classes WHERE name = 'Grade IX' AND tenant_id = 1;
INSERT INTO students (tenant_id, admission_no, first_name, dob, admission_date, gender)
SELECT 1, 'ADM-27' || g, 'Student' || g, DATE '2011-01-01', DATE '2020-04-01', CASE WHEN g % 2 = 0 THEN 'Female' ELSE 'Male' END FROM generate_series(1, 8) g;

DO $$ DECLARE b INT; b1 INT; s1 INT; s2 INT; s3 INT; l1 INT; l2 INT; f NUMERIC; BEGIN
  SELECT student_id INTO s1 FROM students WHERE admission_no = 'ADM-271'; SELECT student_id INTO s2 FROM students WHERE admission_no = 'ADM-272'; SELECT student_id INTO s3 FROM students WHERE admission_no = 'ADM-273';
  INSERT INTO library_rules (tenant_id) VALUES (1);
  INSERT INTO library_books (tenant_id, title, copies) VALUES (1, 'Wings of Fire', 1) RETURNING book_id INTO b;
  INSERT INTO library_books (tenant_id, title, copies) VALUES (1, 'Malgudi Days', 3) RETURNING book_id INTO b1;
  l1 := library_issue(1, b, s1, DATE '2026-12-01');
  ASSERT (SELECT due_on FROM library_loans WHERE loan_id = l1) = DATE '2026-12-15', '14-day loan';
  BEGIN PERFORM library_issue(1, b, s2, DATE '2026-12-01'); RAISE EXCEPTION 'lent a copy that was out'; EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM LIKE 'No copy%', SQLERRM; END;
  l2 := library_issue(1, b1, s1, DATE '2026-12-01');
  BEGIN PERFORM library_issue(1, b1, s1, DATE '2026-12-01'); RAISE EXCEPTION 'third book'; EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM LIKE 'Student already has 2%', SQLERRM; END;
  f := library_return(l1, DATE '2026-12-20');
  ASSERT f = 10, 'fine 5 days × 2';
  BEGIN PERFORM library_issue(1, b, s1, DATE '2026-12-30'); RAISE EXCEPTION 'borrowed with an overdue book'; EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM LIKE '%overdue%', SQLERRM; END;
  BEGIN PERFORM library_return(l1); RAISE EXCEPTION 'returned twice'; EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM LIKE '%not on loan%', SQLERRM; END;
  RAISE NOTICE 'Library ok';
END $$;

DO $$ DECLARE bb INT; bg INT; r INT; boy INT; girl INT; girl2 INT; girl3 INT; res INT; BEGIN
  SELECT student_id INTO boy FROM students WHERE admission_no = 'ADM-271'; SELECT student_id INTO girl FROM students WHERE admission_no = 'ADM-272';
  SELECT student_id INTO girl2 FROM students WHERE admission_no = 'ADM-274'; SELECT student_id INTO girl3 FROM students WHERE admission_no = 'ADM-276';
  INSERT INTO hostel_blocks (tenant_id, name, gender, room_fee, mess_fee) VALUES (1, 'Boys', 'Male', 6500, 3500) RETURNING block_id INTO bb;
  INSERT INTO hostel_blocks (tenant_id, name, gender) VALUES (1, 'Girls', 'Female') RETURNING block_id INTO bg;
  INSERT INTO hostel_rooms (tenant_id, block_id, room_no, beds) VALUES (1, bg, '201', 2) RETURNING room_id INTO r;
  BEGIN INSERT INTO hostel_residents (tenant_id, student_id, room_id) VALUES (1, boy, r); RAISE EXCEPTION 'boy in the girls block'; EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM LIKE '%for female%', SQLERRM; END;
  INSERT INTO hostel_residents (tenant_id, student_id, room_id) VALUES (1, girl, r) RETURNING resident_id INTO res;
  INSERT INTO hostel_residents (tenant_id, student_id, room_id) VALUES (1, girl2, r);
  BEGIN INSERT INTO hostel_residents (tenant_id, student_id, room_id) VALUES (1, girl3, r); RAISE EXCEPTION 'over capacity'; EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'Room is full', SQLERRM; END;
  BEGIN INSERT INTO hostel_residents (tenant_id, student_id, room_id) VALUES (1, girl, r); RAISE EXCEPTION 'two beds'; EXCEPTION WHEN unique_violation OR raise_exception THEN NULL; END;
  UPDATE hostel_residents SET left_on = CURRENT_DATE + 1 WHERE resident_id = res;
  INSERT INTO hostel_residents (tenant_id, student_id, room_id) VALUES (1, girl3, r);
  ASSERT (SELECT free FROM v_hostel_occupancy WHERE block_id = bg) = 0, 'occupancy view';
  RAISE NOTICE 'Hostel ok';
END $$;

DO $$ DECLARE sec INT; h INT; s1 INT; BEGIN
  SELECT s.section_id INTO sec FROM sections s JOIN classes c USING (class_id) WHERE c.name = 'Grade IX' AND s.tenant_id = 1 LIMIT 1; SELECT student_id INTO s1 FROM students WHERE admission_no = 'ADM-271';
  BEGIN INSERT INTO homework (tenant_id, section_id, subject, title, set_on, due_on) VALUES (1, sec, 'Maths', 'Ex 1', DATE '2026-12-05', DATE '2026-12-01'); RAISE EXCEPTION 'due before set'; EXCEPTION WHEN check_violation THEN NULL; END;
  INSERT INTO homework (tenant_id, section_id, subject, title, due_on) VALUES (1, sec, 'Maths', 'Ex 1', CURRENT_DATE + 2) RETURNING homework_id INTO h;
  INSERT INTO homework_status VALUES (h, s1, 1, 'DONE');
  BEGIN INSERT INTO homework_status VALUES (h, (SELECT student_id FROM students WHERE admission_no = 'ADM-272'), 1, 'MAYBE'); RAISE EXCEPTION 'bad status'; EXCEPTION WHEN check_violation THEN NULL; END;
  INSERT INTO online_classes (tenant_id, section_id, subject, class_date, start_time, minutes, meeting_url) VALUES (1, sec, 'Maths', CURRENT_DATE + 1, '16:00', 40, 'https://meet.example.com/abc');
  BEGIN INSERT INTO online_classes (tenant_id, section_id, subject, class_date, start_time, minutes, meeting_url) VALUES (1, sec, 'English', CURRENT_DATE + 1, '16:00', 40, 'https://meet.example.com/x'); RAISE EXCEPTION 'clash'; EXCEPTION WHEN unique_violation THEN NULL; END;
  BEGIN INSERT INTO online_classes (tenant_id, section_id, subject, class_date, start_time, minutes, meeting_url) VALUES (1, sec, 'English', CURRENT_DATE + 1, '17:00', 40, 'http://meet.example.com/x'); RAISE EXCEPTION 'plain http'; EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN INSERT INTO online_classes (tenant_id, section_id, subject, class_date, start_time, minutes, meeting_url) VALUES (1, sec, 'English', CURRENT_DATE + 1, '18:00', 300, 'https://meet.example.com/x'); RAISE EXCEPTION 'too long'; EXCEPTION WHEN check_violation THEN NULL; END;
  RAISE NOTICE 'Homework and classes ok';
END $$;

DO $$ DECLARE i INT; s1 INT; amt NUMERIC; BEGIN
  SELECT student_id INTO s1 FROM students WHERE admission_no = 'ADM-271';
  INSERT INTO inventory_items (tenant_id, name, price, reorder_level) VALUES (1, 'School tie', 120, 5) RETURNING item_id INTO i;
  INSERT INTO inventory_moves (tenant_id, item_id, qty, kind) VALUES (1, i, 6, 'IN');
  INSERT INTO inventory_moves (tenant_id, item_id, qty, kind, student_id) VALUES (1, i, -2, 'SALE', s1) RETURNING amount INTO amt;
  ASSERT amt = 240, 'sale priced from the item';
  BEGIN INSERT INTO inventory_moves (tenant_id, item_id, qty, kind, student_id) VALUES (1, i, -5, 'SALE', s1); RAISE EXCEPTION 'sold more than in stock'; EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'Only 4 in stock', SQLERRM; END;
  BEGIN INSERT INTO inventory_moves (tenant_id, item_id, qty, kind) VALUES (1, i, -1, 'SALE'); RAISE EXCEPTION 'sale without a student'; EXCEPTION WHEN check_violation THEN NULL; END;
  ASSERT (SELECT reorder FROM v_inventory_stock WHERE item_id = i), 'at re-order level';
  BEGIN INSERT INTO school_events (tenant_id, title, start_date, end_date) VALUES (1, 'Trip', DATE '2026-12-10', DATE '2026-12-01'); RAISE EXCEPTION 'ends before it starts'; EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN INSERT INTO school_events (tenant_id, title, start_date, end_date, audience) VALUES (1, 'Trip', DATE '2026-12-10', DATE '2026-12-10', 'ALUMNI'); RAISE EXCEPTION 'bad audience'; EXCEPTION WHEN check_violation THEN NULL; END;
  INSERT INTO school_events (tenant_id, title, start_date, end_date, kind, audience) VALUES (1, 'Sports Day', DATE '2026-12-10', DATE '2026-12-10', 'Sports', 'ALL');
  RAISE NOTICE 'Store and events ok';
END $$;

DO $$ DECLARE pl INT; pr INT; t INT; BEGIN
  INSERT INTO price_lists (version, card, is_current) VALUES (1, '{"plans": [], "addons": []}', TRUE) RETURNING price_list_id INTO pl;
  BEGIN INSERT INTO price_lists (version, card, is_current) VALUES (2, '{"plans": [], "addons": []}', TRUE); RAISE EXCEPTION 'two current price lists'; EXCEPTION WHEN unique_violation THEN NULL; END;
  BEGIN INSERT INTO price_lists (version, card) VALUES (3, '{"plans": 1}'); RAISE EXCEPTION 'bad card'; EXCEPTION WHEN check_violation THEN NULL; END;
  INSERT INTO sales_proposals (proposal_no, client_name, students, plan_code, options, price_list_id, monthly_total, yearly_total) VALUES ('PROP-T-001', 'Example School', 400, 'GROWTH', '{}', pl, 5200, 57200) RETURNING proposal_id INTO pr;
  BEGIN INSERT INTO sales_proposals (proposal_no, client_name, students, plan_code, options, monthly_total, yearly_total, discount_pct) VALUES ('PROP-T-002', 'X', 400, 'GROWTH', '{}', 1, 1, 15); RAISE EXCEPTION 'big discount without approval'; EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN INSERT INTO sales_proposals (proposal_no, client_name, students, plan_code, options, monthly_total, yearly_total, status) VALUES ('PROP-T-003', 'X', 400, 'GROWTH', '{}', 1, 1, 'Maybe'); RAISE EXCEPTION 'bad status'; EXCEPTION WHEN check_violation THEN NULL; END;
  INSERT INTO tenants (code, name, subdomain, is_demo, demo_proposal_id) VALUES ('DEXS', 'Example School (demo)', 'demo-dexs', TRUE, pr) RETURNING tenant_id INTO t;
  ASSERT (SELECT is_demo FROM tenants WHERE tenant_id = t), 'demo school';
  ASSERT (SELECT count(*) FROM competitors) >= 8 AND NOT EXISTS (SELECT 1 FROM competitors WHERE country IS NULL OR source_url IS NULL), 'competitors with country and source';
  ASSERT (SELECT count(DISTINCT region) FROM competitors) = 2, 'Indian and global';
  ASSERT NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name IN ('price_lists', 'sales_proposals', 'competitors', 'roadmap_items') AND column_name = 'tenant_id'), 'company tables have no school';
  RAISE NOTICE 'Service Provider ok';
END $$;

-- Another school can't see this school's library, hostel, homework, store or events
DO $$ DECLARE n INT; BEGIN
  CREATE ROLE rls27 NOLOGIN; GRANT SELECT ON library_books, hostel_residents, homework, inventory_items, school_events TO rls27;
  SET LOCAL ROLE rls27; PERFORM set_config('app.tenant_id', '2', true);
  SELECT (SELECT count(*) FROM library_books) + (SELECT count(*) FROM hostel_residents) + (SELECT count(*) FROM homework) + (SELECT count(*) FROM inventory_items) + (SELECT count(*) FROM school_events) INTO n;
  ASSERT n = 0, 'tenant 2 sees nothing of tenant 1';
  PERFORM set_config('app.tenant_id', '1', true);
  ASSERT (SELECT count(*) FROM library_books) = 2, 'tenant 1 sees its own books';
  RESET ROLE;
  RAISE NOTICE 'Tenant isolation ok';
END $$;
ROLLBACK;
