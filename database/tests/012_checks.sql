-- Checks for 012 (Web & App Screens). One transaction, rolled back.  Expect NOTICE lines: Defaults ok, Workflow ok, Channels ok
\set ON_ERROR_STOP 1
SET client_min_messages = notice;
SET TIME ZONE 'Asia/Kolkata';   -- the school's calendar day (checks use CURRENT_DATE)
BEGIN;
INSERT INTO academic_years (tenant_id, name, start_date, end_date, is_current) VALUES (1,'2026-27', CURRENT_DATE - 100, CURRENT_DATE + 200, TRUE);
INSERT INTO users (tenant_id, username, email, password_hash, status) VALUES (1,'adm','a@x.in','COGNITO','ACTIVE'),(1,'adm2','a2@x.in','COGNITO','ACTIVE'),(1,'prin','p@x.in','COGNITO','ACTIVE'),(1,'gate','g@x.in','COGNITO','ACTIVE'),(1,'parent','pa@example.com','COGNITO','ACTIVE');
INSERT INTO user_roles SELECT u.user_id, r.role_id FROM users u JOIN roles r ON (u.username, r.code) IN (('adm','ADMIN'),('adm2','ADMIN'),('prin','PRINCIPAL'),('gate','FRONT_OFFICE'),('parent','PARENT'));
CREATE TEMP VIEW k AS SELECT (SELECT user_id FROM users WHERE username='adm') adm, (SELECT user_id FROM users WHERE username='adm2') adm2,
  (SELECT user_id FROM users WHERE username='prin') prin, (SELECT user_id FROM users WHERE username='gate') gate, (SELECT user_id FROM users WHERE username='parent') parent;

DO $$ DECLARE x k%ROWTYPE; BEGIN SELECT * INTO x FROM k;
  ASSERT screen_channel(1,'FRONT_OFFICE','STU_GATE') = 'BOTH', 'recommended: gate on both';
  ASSERT screen_channel(1,'ADMIN','OPS_USERS') = 'WEB', 'not phone-ready = website';
  ASSERT screen_channel(1,'PARENT','SELF_PROFILE') = 'BOTH', 'account locked on both';
  ASSERT EXISTS (SELECT 1 FROM v_user_mobile_screens WHERE user_id = x.gate AND code = 'STU_GATE'), 'gate tab in the app';
  ASSERT EXISTS (SELECT 1 FROM v_user_web_screens WHERE user_id = x.gate AND code = 'STU_GATE'), 'gate on the website';
  ASSERT NOT EXISTS (SELECT 1 FROM v_user_mobile_screens WHERE user_id = x.parent AND code IN ('STU_GATE','STU_REQUESTS')), 'parent never gets staff tabs';
  RAISE NOTICE 'Defaults ok';
END $$;

DO $$ DECLARE x k%ROWTYPE; l INT; v INT; BEGIN SELECT * INTO x FROM k;
  BEGIN PERFORM start_channel_draft(1, x.prin); RAISE EXCEPTION 'principal edited'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Only an Admin%' THEN RAISE; END IF; END;
  l := start_channel_draft(1, x.adm);
  ASSERT start_channel_draft(1, x.adm2) = l, 'one open draft per school';
  INSERT INTO channel_layout_entries VALUES (l, 1, 'FRONT_OFFICE', 'STU_GATE', 'APP'), (l, 1, 'PARENT', 'SELF_FEES', 'WEB');
  BEGIN INSERT INTO channel_layout_entries VALUES (l, 1, 'PARENT', 'SELF_PROFILE', 'WEB'); RAISE EXCEPTION 'account moved'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%must stay%' THEN RAISE; END IF; END;
  ASSERT screen_channel(1,'FRONT_OFFICE','STU_GATE') = 'BOTH', 'draft is not live';
  PERFORM submit_channel_layout(l, x.adm, 'Gate on the tablet');
  BEGIN INSERT INTO channel_layout_entries VALUES (l, 1, 'PARENT', 'SELF_CHILD', 'WEB'); RAISE EXCEPTION 'edited while pending'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Only a draft%' THEN RAISE; END IF; END;
  BEGIN PERFORM approve_channel_layout(l, x.adm); RAISE EXCEPTION 'self approved'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'A different person%' THEN RAISE; END IF; END;
  BEGIN PERFORM approve_channel_layout(l, x.adm2); RAISE EXCEPTION 'admin approved'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Only the Principal%' THEN RAISE; END IF; END;
  BEGIN PERFORM send_back_channel_layout(l, x.prin, ''); RAISE EXCEPTION 'sent back without reason'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Say what%' THEN RAISE; END IF; END;
  v := approve_channel_layout(l, x.prin);
  ASSERT v = 1 AND screen_channel(1,'FRONT_OFFICE','STU_GATE') = 'APP', 'published';
  BEGIN PERFORM approve_channel_layout(l, x.prin); RAISE EXCEPTION 'approved twice'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Nothing is waiting%' THEN RAISE; END IF; END;
  RAISE NOTICE 'Workflow ok';
END $$;

DO $$ DECLARE x k%ROWTYPE; l INT; BEGIN SELECT * INTO x FROM k;
  ASSERT NOT EXISTS (SELECT 1 FROM v_user_web_screens WHERE user_id = x.gate AND code = 'STU_GATE'), 'gate gone from the website';
  ASSERT EXISTS (SELECT 1 FROM v_user_mobile_screens WHERE user_id = x.gate AND code = 'STU_GATE'), 'gate still in the app';
  ASSERT NOT EXISTS (SELECT 1 FROM v_user_mobile_screens WHERE user_id = x.parent AND code = 'SELF_FEES'), 'fees website only';
  ASSERT EXISTS (SELECT 1 FROM v_user_web_screens WHERE user_id = x.parent AND code = 'SELF_FEES'), 'fees on the website';
  -- restore version 1 as a draft, send, approve → version 2 equals version 1
  l := start_channel_draft(1, x.adm, 1);
  DELETE FROM channel_layout_entries WHERE layout_id = l;
  PERFORM submit_channel_layout(l, x.adm2); PERFORM approve_channel_layout(l, x.prin);
  ASSERT (SELECT version FROM channel_layouts WHERE status = 'PUBLISHED') = 2 AND (SELECT count(*) FROM channel_layouts WHERE status = 'SUPERSEDED') = 1, 'history kept';
  ASSERT screen_channel(1,'FRONT_OFFICE','STU_GATE') = 'BOTH', 'back to recommended';
  UPDATE tenant_mobile_app SET enabled = FALSE WHERE tenant_id = 1;
  ASSERT NOT EXISTS (SELECT 1 FROM v_user_mobile_screens), 'app off';
  RAISE NOTICE 'Channels ok';
END $$;
ROLLBACK;
