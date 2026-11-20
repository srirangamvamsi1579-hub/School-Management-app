-- 034 checks: UAT / live schools, sign-off before live, branch per school, Project Links menu
DO $$
DECLARE v_prop INT; v_uat INT; v_live INT; v_proj INT; v_n INT;
BEGIN
  SELECT count(*) INTO v_n FROM menus c JOIN menus p ON p.menu_id = c.parent_id WHERE p.code = 'PROJECT' AND c.code = 'PRJ_LINKS';
  IF v_n <> 1 THEN RAISE EXCEPTION 'Project Links menu missing'; END IF;
  RAISE NOTICE '034 ok: Project → Project Links';

  INSERT INTO tenants (code, name, subdomain, environment) VALUES ('CHK-UAT', 'Check School – UAT/DEMO', 'uat-checkschool', 'UAT') RETURNING tenant_id INTO v_uat;
  INSERT INTO tenants (code, name, subdomain, environment) VALUES ('CHK', 'Check School – Live (20 Nov 2026)', 'checkschool', 'LIVE') RETURNING tenant_id INTO v_live;
  IF NOT project_menu_allowed(v_uat) THEN RAISE EXCEPTION 'UAT school should have Project Links'; END IF;
  SELECT proposal_id INTO v_prop FROM sales_proposals WHERE status <> 'Lost' AND proposal_id NOT IN (SELECT proposal_id FROM client_projects) LIMIT 1;
  IF v_prop IS NULL THEN
    INSERT INTO sales_proposals (proposal_no, client_name, students, plan_code, options, monthly_total, yearly_total) VALUES ('PROP-CHK-034', 'Check School', 400, 'PRO', '{}', 1, 1) RETURNING proposal_id INTO v_prop;
  END IF;
  INSERT INTO client_projects (project_no, proposal_id, client_tenant_id, options_hash, git_branch) VALUES ('CP-CHK-034', v_prop, v_uat, 'abc', 'school/checkschool') RETURNING project_id INTO v_proj;
  IF (SELECT status FROM client_projects WHERE project_id = v_proj) <> 'UAT / Demo' THEN RAISE EXCEPTION 'new projects start as UAT / Demo'; END IF;
  BEGIN UPDATE client_projects SET git_branch = 'feature/x' WHERE project_id = v_proj; RAISE EXCEPTION 'bad branch accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  RAISE NOTICE '034 ok: new project is UAT / Demo on school/<sub>';

  BEGIN UPDATE client_projects SET status = 'Live' WHERE project_id = v_proj; RAISE EXCEPTION 'went live without sign-off';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'went live%' THEN RAISE; END IF; END;
  BEGIN UPDATE client_projects SET live_tenant_id = v_live, live_version = '1.0', status = 'Signed off' WHERE project_id = v_proj; RAISE EXCEPTION 'live school without a signed version';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'live school without%' THEN RAISE; END IF; END;
  BEGIN INSERT INTO client_project_signoffs (project_id, version, signed_by, signed_on) VALUES (v_proj, '1.0', 'X', CURRENT_DATE + 1); RAISE EXCEPTION 'future signing accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  RAISE NOTICE '034 ok: no live school or Live status before the client signs';

  INSERT INTO client_project_signoffs (project_id, version, signed_by, designation, signed_on) VALUES (v_proj, '1.0', 'Principal of Check School', 'Principal', CURRENT_DATE);
  UPDATE client_projects SET live_tenant_id = v_live, live_version = '1.0', status = 'Signed off' WHERE project_id = v_proj;
  BEGIN UPDATE client_projects SET live_tenant_id = v_uat WHERE project_id = v_proj; RAISE EXCEPTION 'UAT used as live';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM = 'UAT used as live' THEN RAISE; END IF; WHEN unique_violation THEN NULL; END;
  SELECT count(*) INTO v_n FROM v_client_environments WHERE project_no = 'CP-CHK-034' AND live_tag = 'checkschool-v1.0' AND uat_tag = 'checkschool-uat-v1.0';
  IF v_n <> 1 THEN RAISE EXCEPTION 'environment view wrong'; END IF;
  RAISE NOTICE '034 ok: signed version builds the live school; tags checkschool-uat-v1.0 / checkschool-v1.0';
  DELETE FROM client_projects WHERE project_id = v_proj;  -- tidy (signoffs reference it)
EXCEPTION WHEN foreign_key_violation THEN RAISE NOTICE '034 ok: checks done (rows kept)';
END $$;
