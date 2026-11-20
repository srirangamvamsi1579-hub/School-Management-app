-- 032 checks: admission numbers, duplicates, marks and date-of-birth rules
DO $$
DECLARE v_t INT; v_a TEXT; v_b TEXT; v_c TEXT; v_n INT;
BEGIN
  SELECT tenant_id INTO v_t FROM tenants ORDER BY tenant_id LIMIT 1;
  v_a := next_admission_no(v_t, 'Rao', 'Kiran', 2031);
  v_b := next_admission_no(v_t, NULL, 'Anu', 2031);
  v_c := next_admission_no(v_t, 'श्री', '', 2031);
  IF v_a <> '0001R2031' OR v_b <> '0002A2031' OR v_c <> '0003X2031' THEN RAISE EXCEPTION 'admission numbers wrong: %, %, %', v_a, v_b, v_c; END IF;
  IF length(v_a) > 10 THEN RAISE EXCEPTION 'admission number longer than 10'; END IF;
  RAISE NOTICE '032 ok: admission numbers % % % (number + surname initial + year, 9 characters)', v_a, v_b, v_c;

  -- A number already in use (imported) is skipped
  INSERT INTO students (tenant_id, admission_no, first_name, last_name, dob, admission_date) VALUES (v_t, '0004K2031', 'Kavya', 'K', '2024-01-01', '2031-04-01');
  v_a := next_admission_no(v_t, 'Kumar', 'Kavya', 2031);
  IF v_a <> '0005K2031' THEN RAISE EXCEPTION 'taken number not skipped: %', v_a; END IF;
  RAISE NOTICE '032 ok: a number already taken is skipped (%)', v_a;

  -- The year restarts the running number
  IF next_admission_no(v_t, 'Rao', 'Kiran', 2032) <> '0001R2032' THEN RAISE EXCEPTION 'year did not restart'; END IF;
  RAISE NOTICE '032 ok: each year starts again at 0001';

  -- Duplicate finder: same name and date of birth
  SELECT count(*) INTO v_n FROM find_duplicate_students(v_t, ' kavya ', 'k', '2024-01-01', NULL);
  IF v_n <> 1 THEN RAISE EXCEPTION 'duplicate not found (%)', v_n; END IF;
  RAISE NOTICE '032 ok: possible duplicate found by name and date of birth';

  -- Implausible date of birth refused
  BEGIN
    INSERT INTO students (tenant_id, admission_no, first_name, dob, admission_date) VALUES (v_t, '0099Z2031', 'Future', '2032-01-01', '2031-04-01');
    RAISE EXCEPTION 'future date of birth accepted';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE '032 ok: date of birth after joining refused';
  END;
  BEGIN
    INSERT INTO students (tenant_id, admission_no, first_name, dob, admission_date) VALUES (v_t, '0098Z2031', 'Old', '1981-01-01', '2031-04-01');
    RAISE EXCEPTION 'age 50 accepted';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE '032 ok: child older than 21 at joining refused';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    UPDATE questions SET marks = -2 WHERE question_id = (SELECT min(question_id) FROM questions);
    IF FOUND THEN RAISE EXCEPTION 'negative marks accepted'; END IF;
    RAISE NOTICE '032 ok: no questions to test marks on';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE '032 ok: marks of -2 refused (1 to 20 only)';
  END;
END $$;
