-- 033 checks: analytics menus, F13, add-on screens, backlog
DO $$
DECLARE v_n INT;
BEGIN
  SELECT count(*) INTO v_n FROM menus m JOIN menus p ON p.menu_id = m.parent_id
  WHERE p.code = 'ANALYTICS' AND m.code IN ('STU_INS', 'STF_INS', 'FEE_INS', 'ANL_ATTENDANCE', 'ANL_EXAMS', 'ANL_TIMETABLE', 'ANL_ACADEMICS', 'ANL_COMMS', 'ANL_CAMPUS');
  IF v_n <> 9 THEN RAISE EXCEPTION 'expected 9 analytics screens under Data Analytics, got %', v_n; END IF;
  RAISE NOTICE '033 ok: every insight is under Data Analytics (9 screens)';

  SELECT count(*) INTO v_n FROM menus m JOIN menus p ON p.menu_id = m.parent_id WHERE p.code = 'SERVICE_PROVIDER' AND m.code = 'SP_ANALYTICS';
  IF v_n <> 1 THEN RAISE EXCEPTION 'Sales Analytics missing'; END IF;
  RAISE NOTICE '033 ok: Service Provider › Sales Analytics';

  SELECT count(*) INTO v_n FROM role_menu_permissions rmp JOIN roles r ON r.role_id = rmp.role_id JOIN menus m ON m.menu_id = rmp.menu_id
  WHERE r.code = 'ACCOUNTANT' AND r.tenant_id IS NULL AND m.code = 'STU_PROFILE';
  IF v_n <> 0 THEN RAISE EXCEPTION 'Accountant still opens Student Profile by default'; END IF;
  SELECT count(*) INTO v_n FROM department_menu_permissions d JOIN menus m ON m.menu_id = d.menu_id
  WHERE m.code = 'STU_PROFILE' AND d.department IN (SELECT department FROM role_departments WHERE role_code = 'ACCOUNTANT');
  IF v_n <> 0 THEN RAISE EXCEPTION 'Accounts department still opens Student Profile'; END IF;
  RAISE NOTICE '033 ok: F13 — Accounts & Finance has no Student Profile by default';

  SELECT count(*) INTO v_n FROM role_menu_permissions rmp JOIN roles r ON r.role_id = rmp.role_id JOIN menus m ON m.menu_id = rmp.menu_id
  WHERE r.code = 'TEACHER' AND r.tenant_id IS NULL AND m.code IN ('ANL_EXAMS', 'ANL_ATTENDANCE', 'ANL_ACADEMICS') AND rmp.data_scope = 'OWN_CLASS';
  IF v_n <> 3 THEN RAISE EXCEPTION 'teacher analytics should be own classes only, got %', v_n; END IF;
  RAISE NOTICE '033 ok: teachers see exam, attendance and syllabus reports for their own classes';

  SELECT count(*) INTO v_n FROM sales_addons WHERE addon_code = 'ANALYTICS' AND menu_codes @> '{ANL_ATTENDANCE,ANL_EXAMS,ANL_TIMETABLE,ANL_ACADEMICS,ANL_COMMS,ANL_CAMPUS}';
  IF v_n <> 1 THEN RAISE EXCEPTION 'analytics add-on lacks the new screens'; END IF;
  RAISE NOTICE '033 ok: the Data analytics add-on opens the new screens';

  SELECT count(*) INTO v_n FROM roadmap_items WHERE status = 'Backlog' AND code LIKE 'QA\_%';
  IF v_n <> 9 THEN RAISE EXCEPTION 'expected 9 backlog items, got %', v_n; END IF;
  RAISE NOTICE '033 ok: 9 QA enhancements on the roadmap as Backlog';
END $$;
