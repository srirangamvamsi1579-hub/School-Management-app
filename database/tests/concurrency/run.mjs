// Concurrency and load tests for the school database.
// Every scenario fires real parallel transactions from separate connections at the same moment
// (a barrier releases them together) and then checks the data is still correct.
// Usage: PGHOST=/tmp/pgt PGPORT=5499 PGDATABASE=conc node run.mjs   (DB loaded with all migrations + fixture.sql)
import pg from 'pg';

const admin = new pg.Pool({ user: process.env.PGADMIN || 'postgres', max: 5 });
const app = new pg.Pool({ user: 'app_user', password: process.env.APP_DB_PASSWORD || 'app_user_test_only', max: Number(process.env.POOL || 40) });
const results = [];
const q1 = async (sql, p = []) => (await admin.query(sql, p)).rows;

// Run fn in a transaction on its own connection with the school set for this transaction only (SET LOCAL)
async function tx(fn, tenant = 1, user = null) {
  const c = await app.connect();
  try {
    await c.query('BEGIN');
    await c.query("SELECT set_config('app.tenant_id', $1, true), set_config('app.user_id', $2, true)", [String(tenant), user ? String(user) : '']);
    const r = await fn(c);
    await c.query('COMMIT');
    return { ok: true, r };
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    return { ok: false, err: e.message };
  } finally { c.release(); }
}
// Start n copies of fn at the same instant
async function together(n, fn) {
  let release; const gate = new Promise((r) => { release = r; }); let ready = 0;
  const runs = Array.from({ length: n }, (_, i) => tx(async (c) => { await c.query('SELECT 1'); ready++; if (ready === n) release(); await gate; return fn(c, i); }));
  return Promise.all(runs);
}
function check(name, ok, detail) { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`); }

const staff1 = (await q1("SELECT user_id FROM users WHERE username = 'staff1'"))[0].user_id;
const msgs = await q1('SELECT message_id, student_id, invoice_ids[1] AS invoice_id FROM fee_request_messages ORDER BY message_id');
const staffId = async (code) => (await q1('SELECT staff_id FROM staff WHERE employee_code = $1', [code]))[0].staff_id;
const notif = async (ref, amount, msg) => (await q1(`INSERT INTO payment_notifications (tenant_id, source, external_ref, amount, paid_at, mode, narration)
  VALUES (1, 'GATEWAY', $1, $2, now(), 'UPI', $3) RETURNING notification_id`, [ref, amount, 'msg ' + msg]))[0].notification_id;

// 1. Twenty parents pay at the same moment: every payment must get its own receipt number
{
  const set = msgs.slice(0, 20);
  const ns = []; for (const m of set) ns.push(await notif('PAY-A-' + m.message_id, 10000, m.message_id));
  const r = await together(20, (c, i) => c.query("SELECT apply_payment($1, $2, $3, 'AUTO_MATCHED') AS p", [ns[i], set[i].message_id, staff1]));
  const failed = r.filter((x) => !x.ok);
  const dup = await q1("SELECT receipt_no, count(*) FROM fee_payments GROUP BY 1 HAVING count(*) > 1");
  check('20 simultaneous payments, unique receipts', failed.length === 0 && dup.length === 0, `${20 - failed.length}/20 succeeded${failed[0] ? ' · first error: ' + failed[0].err : ''}`);
}
// 2. Two accounts staff match the same bank line at once: it must be receipted once
{
  const m = msgs[30]; const n = await notif('PAY-B-1', 10000, m.message_id);
  await together(2, (c) => c.query("SELECT apply_payment($1, $2, $3, 'MANUAL_MATCHED')", [n, m.message_id, staff1]));
  const cnt = (await q1("SELECT count(*)::int AS n FROM fee_payments WHERE txn_ref = 'PAY-B-1'"))[0].n;
  check('Same bank line matched twice at once', cnt === 1, `${cnt} receipt(s) for one bank line`);
}
// 3. Two different payments for the same invoice arrive together (counter + online): invoice must not be over-paid
{
  const m = msgs[40]; const a = await notif('PAY-C-1', 10000, m.message_id); const b = await notif('PAY-C-2', 10000, m.message_id);
  await together(2, (c, i) => c.query("SELECT apply_payment($1, $2, $3, 'AUTO_MATCHED')", [[a, b][i], m.message_id, staff1]));
  const inv = (await q1('SELECT paid_amount::float AS paid, net_amount::float AS net FROM fee_invoices WHERE invoice_id = $1', [m.invoice_id]))[0];
  const alloc = (await q1('SELECT COALESCE(sum(amount), 0)::float AS s FROM payment_allocations WHERE invoice_id = $1', [m.invoice_id]))[0].s;
  check('Two payments for one invoice at once', inv.paid <= inv.net && alloc <= inv.net, `invoice ₹${inv.net} · recorded paid ₹${inv.paid} · allocated ₹${alloc} (extra should go to advance)`);
}
// 4. A parent taps "send" on the phone and the website together: one request, not two
{
  const s = msgs[50].student_id;
  const r = await together(2, (c) => c.query("INSERT INTO parent_requests (tenant_id, ref_no, student_id, requested_by, kind, date_from, date_to) VALUES (1, 'DUP-' || substr(md5(random()::text), 1, 10), $1, $2, 'OWN_TRANSPORT', CURRENT_DATE + 3, CURRENT_DATE + 3)", [s, staff1]));
  const cnt = (await q1("SELECT count(*)::int AS n FROM parent_requests WHERE student_id = $1 AND kind = 'OWN_TRANSPORT' AND status IN ('SUBMITTED','APPROVED')", [s]))[0].n;
  check('Same request sent twice at once', cnt === 1, `${cnt} active request(s); ${r.filter((x) => x.ok).length} insert(s) accepted`);
}
// 5. Primary and secondary coordinator approve the same early leave at once
let earlyId, gateCode;
{
  const s = msgs[60].student_id; const g = (await q1('SELECT guardian_id FROM student_guardians WHERE student_id = $1', [s]))[0].guardian_id;
  earlyId = (await q1("INSERT INTO parent_requests (tenant_id, ref_no, student_id, requested_by, kind, date_from, date_to, leave_time, collector_id) VALUES (1, 'EL-1', $1, $2, 'EARLY_LEAVE', CURRENT_DATE + 1, CURRENT_DATE + 1, '11:00', $3) RETURNING request_id", [s, staff1, -g]))[0].request_id;
  const [e1, e2] = [await staffId('E1'), await staffId('E2')];
  const r = await together(2, (c, i) => c.query('SELECT decide_parent_request($1, $2, TRUE) AS code', [earlyId, [e1, e2][i]]));
  const ok = r.filter((x) => x.ok); gateCode = ok[0]?.r.rows[0].code;
  check('Two coordinators approve at once', ok.length === 1, `${ok.length} approval(s); other: ${r.find((x) => !x.ok)?.err || '—'}`);
}
// 6. Gate staff at two desks hand over the same child at once
{
  const r = await together(2, (c) => c.query('SELECT hand_over_student($1, $2, $3)', [earlyId, gateCode, staff1]));
  check('Same child handed over twice at once', r.filter((x) => x.ok).length === 1, `${r.filter((x) => x.ok).length} hand-over(s) recorded`);
}
// 7. Two offered applicants enrolled at once for the last seat
{
  const apps = await q1("SELECT enquiry_id FROM admission_enquiries ORDER BY enquiry_id");
  const r = await together(2, (c, i) => c.query('SELECT enrol_applicant($1, $2)', [apps[i].enquiry_id, 'ADM-NEW-' + i]));
  const seat = (await q1("SELECT s.capacity, count(e.*)::int AS n FROM sections s LEFT JOIN enrollments e ON e.section_id = s.section_id WHERE s.capacity = 2 GROUP BY s.capacity"))[0];
  check('Last seat taken twice at once', seat.n <= seat.capacity, `${seat.n} enrolled in a section of ${seat.capacity}; ${r.filter((x) => x.ok).length} enrolment(s) accepted`);
}
// 8. The same one-time code submitted twice at once (double tap)
{
  const code = (await q1("SELECT code FROM request_otp(1, 'tap@example.com', 'EMAIL', 'SIGNIN')"))[0].code;
  const r = await together(2, (c) => c.query("SELECT verify_otp(1, 'tap@example.com', 'SIGNIN', $1) AS v", [code]));
  const oks = r.filter((x) => x.ok && x.r.rows[0].v === 'OK').length;
  check('Same code used twice at once', oks === 1, `${oks} accepted`);
}
// 9. Schools stay separate under concurrent load with pooled connections
{
  const want = Object.fromEntries((await q1('SELECT tenant_id, count(*)::int AS n FROM students GROUP BY 1')).map((x) => [x.tenant_id, x.n]));
  const r = await Promise.all(Array.from({ length: 60 }, (_, i) => tx((c) => c.query('SELECT count(*)::int AS n FROM students'), i % 2 ? 1 : 2)));
  const wrong = r.filter((x, i) => !x.ok || x.r.rows[0].n !== want[i % 2 ? 1 : 2]);
  // a pooled connection after its transaction ends must not still carry the last school
  const c = await app.connect(); let leak;
  try { leak = (await c.query('SELECT count(*)::int AS n FROM students')).rows[0].n; } catch (e) { leak = 'error: ' + e.message.slice(0, 60); } finally { c.release(); }
  check('School isolation with 60 parallel pooled transactions', wrong.length === 0 && (leak === 0 || String(leak).startsWith('error')), `${60 - wrong.length}/60 saw only their school; connection without a school: ${leak}`);
}
// 10. Load: many users at once (parents sending requests, transport opening manifests, accounts receipting)
{
  const users = Number(process.env.USERS || 100), ops = Number(process.env.OPS || 20);
  const lat = { request: [], manifest: [], payment: [], dues: [] }; let errors = 0, expected = 0; const t0 = Date.now();
  const studs = msgs.slice(100);
  await Promise.all(Array.from({ length: users }, async (_, u) => {
    for (let k = 0; k < ops; k++) {
      const pick = (u * ops + k) % 10; const s = studs[(u * 37 + k * 11) % studs.length];
      const kind = pick < 4 ? 'request' : pick < 6 ? 'manifest' : pick < 8 ? 'dues' : 'payment';
      const st = performance.now();
      const r = await tx(async (c) => {
        if (kind === 'request') return c.query("INSERT INTO parent_requests (tenant_id, ref_no, student_id, requested_by, kind, date_from, date_to) VALUES (1, md5(random()::text)::varchar(16), $1, $2, 'OWN_TRANSPORT', CURRENT_DATE + $3::int, CURRENT_DATE + $3::int)", [s.student_id, staff1, 5 + (u + k) % 120]);
        if (kind === 'manifest') return c.query("SELECT count(*) FROM trip_manifest(CURRENT_DATE + 5, 'PM')");
        if (kind === 'dues') return c.query('SELECT * FROM v_student_dues WHERE student_id = $1', [s.student_id]);
        const n = (await c.query("INSERT INTO payment_notifications (tenant_id, source, external_ref, amount, paid_at, mode) VALUES (1, 'BANK_STATEMENT', md5(random()::text), 100, now(), 'BANK') RETURNING notification_id")).rows[0].notification_id;
        return c.query("SELECT apply_payment($1, $2, $3, 'MANUAL_MATCHED')", [n, s.message_id, staff1]);
      });
      lat[kind].push(performance.now() - st);
      if (!r.ok) { if (/already a request|conflicting key|exclusion/i.test(r.err)) expected++; else { errors++; if (errors < 4) console.log('   load error:', kind, r.err); } }
    }
  }));
  const secs = (Date.now() - t0) / 1000; const total = users * ops;
  const p = (a, q) => { const s = [...a].sort((x, y) => x - y); return s.length ? Math.round(s[Math.floor(q * (s.length - 1))]) : 0; };
  const line = Object.entries(lat).map(([k, a]) => `${k} p50 ${p(a, 0.5)} ms / p95 ${p(a, 0.95)} ms`).join(' · ');
  check(`Load: ${users} users × ${ops} actions`, errors === 0, `${total} actions in ${secs.toFixed(1)} s (${Math.round(total / secs)}/s), ${errors} unexpected errors, ${expected} duplicate-request refusals · ${line}`);
}
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} passed`);
await admin.end(); await app.end();
process.exitCode = results.every((r) => r.ok) ? 0 : 1;
