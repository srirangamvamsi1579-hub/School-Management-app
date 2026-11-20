-- Checks for 030 (release 14.1). Rolled back.
-- Expect NOTICE: Company Admin ok, Client delivery ok, Links register ok
\set ON_ERROR_STOP 1
SET client_min_messages = notice;
BEGIN;
DO $$ DECLARE comp INTEGER; school INTEGER; ua INTEGER; ub INTEGER; adm INTEGER; BEGIN
  ASSERT (SELECT string_agg(name, ',' ORDER BY tier_rank) FROM plans) = 'Starter,Pro,Pro+,Pro+ Enterprise', 'plans use the sales names';
  ASSERT EXISTS (SELECT 1 FROM menus WHERE code = 'SP_DELIVERY' AND menu_group = 'Delivery'), 'client delivery menu';
  INSERT INTO tenants (code, name, subdomain, is_company) VALUES ('OURCO', 'Our company', 'ourco', TRUE) RETURNING tenant_id INTO comp;
  INSERT INTO tenants (code, name, subdomain) VALUES ('SCH1', 'A school', 'sch1') RETURNING tenant_id INTO school;
  BEGIN INSERT INTO tenants (code, name, subdomain, is_company) VALUES ('OURCO2', 'Second', 'ourco2', TRUE); RAISE EXCEPTION 'two company tenants';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  SELECT role_id INTO adm FROM roles WHERE code = 'ADMIN' AND tenant_id IS NULL;
  INSERT INTO users (tenant_id, username, email, full_name, password_hash, is_company_admin) VALUES (comp, 'coadmin', 'admin@ourco.example.com', 'Company Admin', 'x', TRUE) RETURNING user_id INTO ua;
  INSERT INTO users (tenant_id, username, email, full_name, password_hash) VALUES (school, 'schadmin', 'admin@sch1.example.com', 'School Admin', 'x') RETURNING user_id INTO ub;
  INSERT INTO user_roles VALUES (ua, adm), (ub, adm);
  BEGIN UPDATE users SET is_company_admin = TRUE WHERE user_id = ub; RAISE EXCEPTION 'school Admin made company Admin';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM LIKE 'Only an Admin of our own company%', SQLERRM; END;
  ASSERT provider_menu_allowed(ua), 'our company Admin sees Service Provider';
  ASSERT NOT provider_menu_allowed(ub), 'a school Admin does not';
  RAISE NOTICE 'Company Admin ok';
END $$;

DO $$ DECLARE pr INTEGER; t INTEGER; cp INTEGER; BEGIN
  INSERT INTO sales_proposals (proposal_no, client_name, students, plan_code, options, monthly_total, yearly_total, poc_email)
  VALUES ('PROP-2026-950', 'Hillview School (example)', 650, 'PRO', '{}', 27500, 330000, 'principal@hillview.example.com') RETURNING proposal_id INTO pr;
  INSERT INTO tenants (code, name, subdomain) VALUES ('HVS', 'Hillview School', 'hillview') RETURNING tenant_id INTO t;
  INSERT INTO client_projects (project_no, proposal_id, client_tenant_id, options_hash) VALUES ('CP-2026-950', pr, t, 'abc123') RETURNING project_id INTO cp;
  ASSERT (SELECT status FROM sales_proposals WHERE proposal_id = pr) = 'Won', 'converting marks the proposal Won';
  BEGIN INSERT INTO client_projects (project_no, proposal_id, client_tenant_id, options_hash) VALUES ('CP-2026-951', pr, t, 'x'); RAISE EXCEPTION 'two projects for one proposal';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  BEGIN UPDATE client_projects SET version = 'v2' WHERE project_id = cp; RAISE EXCEPTION 'bad version';
  EXCEPTION WHEN check_violation THEN NULL; END;
  INSERT INTO project_documents (project_id, doc_code, version) SELECT cp, d, '1.0' FROM unnest(ARRAY['ORDER', 'WEBSITE', 'APP', 'HOSTING', 'DATA', 'UAT', 'GOLIVE', 'LINKS']) d;
  INSERT INTO project_documents (project_id, doc_code, version) VALUES (cp, 'UAT', '1.1');
  ASSERT (SELECT count(*) FROM project_documents WHERE project_id = cp) = 9, 'documents kept per version';
  BEGIN INSERT INTO project_documents (project_id, doc_code, version) VALUES (cp, 'MEMO', '1.0'); RAISE EXCEPTION 'unknown document';
  EXCEPTION WHEN check_violation THEN NULL; END;
  RAISE NOTICE 'Client delivery ok';
END $$;

DO $$ DECLARE cp INTEGER; l INTEGER; BEGIN
  SELECT project_id INTO cp FROM client_projects WHERE project_no = 'CP-2026-950';
  INSERT INTO project_links (project_id, link_code, link_group, label, environment, url, version, status)
  VALUES (cp, 'TEST_BUILD', 'Testing', 'Customer test build', 'Test', 'https://test.example.com/#/try/abc', '1.0', 'Ready'),
         (cp, 'WEB_PROD', 'Hosting', 'Web app — production', 'Production', 'https://hillview.yourapp.com/', '1.0', 'Planned');
  INSERT INTO project_links (project_id, link_code, link_group, label, environment, url) VALUES (cp, 'TESTFLIGHT', 'Mobile', 'Apple TestFlight', 'Test', 'https://testflight.apple.com/join/<invite-code>') RETURNING link_id INTO l;
  BEGIN UPDATE project_links SET status = 'Ready' WHERE link_id = l; RAISE EXCEPTION 'placeholder marked ready';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN INSERT INTO project_shares (project_id, to_email, version, link_codes) VALUES (cp, 'principal@hillview.example.com', '1.0', ARRAY['TESTFLIGHT']); RAISE EXCEPTION 'placeholder shared';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM LIKE 'Placeholder links%', SQLERRM; END;
  UPDATE project_links SET url = 'https://testflight.apple.com/join/AbC123', version = '1.0 (build 7)', status = 'Ready' WHERE link_id = l;
  ASSERT (SELECT count(*) FROM project_link_history WHERE link_id = l AND url LIKE '%<invite-code>%') = 1, 'old address kept';
  BEGIN UPDATE project_links SET url = 'http://insecure.example.com/' WHERE link_id = l; RAISE EXCEPTION 'http allowed';
  EXCEPTION WHEN check_violation THEN NULL; END;
  INSERT INTO project_shares (project_id, to_email, version, link_codes, doc_codes) VALUES (cp, 'principal@hillview.example.com', '1.0', ARRAY['TEST_BUILD', 'TESTFLIGHT'], ARRAY['UAT']);
  ASSERT (SELECT count(*) FROM project_links WHERE project_id = cp AND status = 'Shared') = 2, 'shared links marked Shared';
  BEGIN INSERT INTO project_shares (project_id, to_email, version) VALUES (cp, 'principal@hillview.example.com', '1.0'); RAISE EXCEPTION 'empty share';
  EXCEPTION WHEN check_violation THEN NULL; END;
  RAISE NOTICE 'Links register ok';
END $$;
ROLLBACK;
