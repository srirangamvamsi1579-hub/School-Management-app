// Business rules of the test build. Each function changes the in-memory database (db)
// the same way the SQL functions do in the real platform (see /database).
import { amountInWords, num, todayISO, dmy, dmon } from './format.js';
import { CATEGORIES, renderTemplate, SAMPLE } from '../data/templates.js';
import { FORMATS } from '../data/seed.js';

export const sectionOf = (db, s) => db.sections.find((x) => x.id === s.sectionId);
export const classOf = (db, s) => db.classes.find((c) => c.id === sectionOf(db, s)?.classId);
export const classLabel = (db, s) => { const c = classOf(db, s), sec = sectionOf(db, s); return c ? `${c.name}-${sec.name}` : ''; };
export const guardianOf = (db, s) => db.guardians.find((g) => g.id === s.guardianId);
export const fullName = (s) => `${s.first} ${s.last || ''}`.trim();
export const openInvoices = (db, studentId) => db.invoices.filter((i) => i.studentId === studentId && i.status !== 'PAID' && i.status !== 'CANCELLED').sort((a, b) => a.due.localeCompare(b.due));
export const balance = (i) => i.net + (i.prev || 0) - (i.advance || 0) - i.paid;
export const tenantOf = (db) => db.tenants.find((t) => t.id === db.tenantId);

const INCOME = { Tuition: '4000 Tuition Fee Income', Transport: '4010 Transport Fee Income', Dining: '4020 Other Fee Income', Annual: '4020 Other Fee Income' };

export function log(db, who, action, detail) {
  db.audit.unshift({ at: new Date().toISOString(), who, action, detail });
  db.audit = db.audit.slice(0, 300);
}

// ---------- Templates ----------
export function resolveTemplate(db, category, role) {
  const d = db.templateDefaults[category] || {};
  const pick = (id) => db.templates.find((t) => t.id === id && t.status === 'ACTIVE');
  return pick(d['ROLE:' + role]) || pick(d.SCHOOL) || db.templates.find((t) => t.category === category && t.source === 'STANDARD');
}
export function renderFor(db, category, data, role = 'ADMIN') {
  const t = resolveTemplate(db, category, role);
  const all = { ...SAMPLE, school_name: tenantOf(db).name, school_short: tenantOf(db).code, accent: db.theme.color, ...data };
  return { template: t, subject: t?.subject ? renderTemplate(t.subject, all) : '', body: t ? renderTemplate(t.body, all) : '' };
}
export const categoryName = (code) => CATEGORIES.find((c) => c.code === code)?.name || code;

// ---------- Outbox ----------
export function queueEmail(db, { to, subject, body, kind, related }) {
  const e = { id: 'M' + (db.outbox.length + 1), to, subject, body, kind, related, status: to ? 'SENT' : 'NO_EMAIL', at: new Date().toISOString() };
  db.outbox.unshift(e);
  return e;
}

// ---------- Payments: receipt + invoices + voucher + confirmation ----------
export function recordPayment(db, { studentId, amount, mode, ref = '', by = 'System', invoiceIds = null, source = 'COUNTER', at = null }) {
  const student = db.students.find((s) => s.id === studentId);
  const invs = (invoiceIds ? invoiceIds.map((id) => db.invoices.find((i) => i.id === id)) : openInvoices(db, studentId)).filter(Boolean)
    .filter((i) => i.status !== 'PAID').sort((a, b) => a.due.localeCompare(b.due));
  db.seq.receipt += 1; db.seq.voucher += 1;
  const receiptNo = 'R-2026-' + String(db.seq.receipt).padStart(5, '0');
  const pay = { id: 'R' + db.seq.receipt, receiptNo, studentId, amount, mode, ref, at: at || new Date().toISOString(), by, source, allocations: [] };
  const credit = {};
  let remaining = amount;
  for (const inv of invs) {
    if (remaining <= 0) break;
    const part = Math.min(remaining, balance(inv));
    if (part <= 0) continue;
    pay.allocations.push({ invoiceId: inv.id, amount: part });
    inv.paid += part; inv.status = balance(inv) <= 0 ? 'PAID' : 'PARTIAL';
    const tot = inv.items.reduce((a, b) => a + b.amount, 0);
    let done = 0;
    inv.items.forEach((it, k) => {
      const share = k === inv.items.length - 1 ? part - done : Math.round(part * it.amount / tot);
      done += share;
      const acc = INCOME[it.head] || '4020 Other Fee Income';
      credit[acc] = (credit[acc] || 0) + share;
    });
    remaining -= part;
  }
  if (remaining > 0) credit['2200 Fee Advance'] = remaining;
  const lines = [{ account: mode === 'CASH' ? '1000 Cash in Hand' : '1010 Bank Account', debit: amount, credit: 0 }]
    .concat(Object.entries(credit).map(([account, c]) => ({ account, debit: 0, credit: c })));
  db.vouchers.unshift({ id: 'V' + db.seq.voucher, no: 'RV-' + receiptNo, date: (pay.at || '').slice(0, 10), type: 'Receipt', source: 'Fees',
    narration: `Fee received ${student.admNo} via ${mode}${ref ? ' ref ' + ref : ''}`, lines });
  db.payments.unshift(pay);
  const g = guardianOf(db, student);
  const conf = renderFor(db, 'PAYMENT_CONFIRMATION_EMAIL', {
    guardian_name: g?.name, student_name: fullName(student), amount: '₹' + num(amount), receipt_no: receiptNo, mode, reference: ref || '—',
    receipt_link: `https://${tenantOf(db).subdomain}.yourapp.com/receipts/${receiptNo}` });
  queueEmail(db, { to: g?.email, subject: conf.subject, body: conf.body, kind: 'Payment confirmation', related: receiptNo });
  log(db, by, 'Payment recorded', `${receiptNo} · ₹${num(amount)} · ${student.admNo}`);
  return pay;
}

// ---------- Fee request campaign per grade ----------
export function sendFeeRequests(db, { classIds, scope, dueDate, by }) {
  const t = tenantOf(db);
  const camp = { id: 'CP' + (db.campaigns.length + 1), title: '', classIds, scope, due: dueDate, at: new Date().toISOString(), by, counts: {} };
  const names = db.classes.filter((c) => classIds.includes(c.id)).map((c) => c.name.replace('Grade ', ''));
  camp.title = `${scope === 'INST' ? 'Installment III' : scope === 'OVERDUE' ? 'Overdue fees' : 'All unpaid fees'} · Grades ${names.join(', ')}`;
  let sent = 0, noEmail = 0, total = 0;
  db.students.filter((s) => s.status === 'Active' && classIds.includes(classOf(db, s)?.id)).forEach((s) => {
    let invs = openInvoices(db, s.id);
    if (scope === 'INST') invs = invs.filter((i) => i.instalment === 'Installment III');
    if (scope === 'OVERDUE') invs = invs.filter((i) => i.due < todayISO());
    if (!invs.length) return;
    const due = invs.reduce((a, i) => a + balance(i), 0);
    const g = guardianOf(db, s);
    const token = Math.random().toString(36).slice(2, 10);
    const msg = { id: 'FM' + (db.messages.length + 1), campaignId: camp.id, studentId: s.id, guardianId: g?.id, email: g?.email || '', due, invoiceIds: invs.map((i) => i.id),
      token, status: g?.email ? 'SENT' : 'SMS', paid: 0, remarks: g?.email ? '' : `SMS with pay link sent to ${g?.mobile?.slice(0, 2)}•••• ${g?.mobile?.slice(-4)}` };
    db.messages.push(msg);
    const r = renderFor(db, 'FEE_REQUEST_EMAIL', {
      guardian_name: g?.name, student_name: fullName(s), class: classLabel(db, s), instalment: invs[0].instalment, admission_no: s.admNo,
      amount_due: '₹' + num(due), due_date: dmy(dueDate), pay_link: `https://${t.subdomain}.yourapp.com/pay/${token}`,
      bank_details: `${db.bank.holder} · ${db.bank.bank}, ${db.bank.branch} · IFSC ${db.bank.ifsc} · UPI ${db.bank.upi}` });
    if (g?.email) { queueEmail(db, { to: g.email, subject: r.subject, body: r.body, kind: 'Fee request', related: msg.id }); sent++; }
    else { const sms = renderFor(db, 'FEE_REMINDER_SMS', { student_first: s.first, amount_due: '₹' + num(due), due_date: dmy(dueDate), pay_link: `https://${t.subdomain}.yourapp.com/pay/${token}` });
      queueEmail(db, { to: g?.mobile ? '+91 ' + g.mobile : '', subject: 'SMS', body: sms.body, kind: 'Fee reminder SMS', related: msg.id }); noEmail++; }
    total += due;
  });
  camp.counts = { sent, noEmail, total };
  db.campaigns.unshift(camp);
  log(db, by, 'Fee requests sent', `${camp.title} · ${sent} emails · ${noEmail} SMS`);
  return camp;
}

// ---------- Incoming payment → automatic matching ----------
export function receiveNotification(db, { source, ref, amount, mode, narration = '', token = null, payer = '' }) {
  const n = { id: 'N' + (db.notifications.length + 1), source, ref, amount: Number(amount), mode, narration, token, payer, at: new Date().toISOString(), status: 'UNMATCHED', result: '' };
  db.notifications.unshift(n);
  if (db.payments.some((p) => p.ref && p.ref === ref)) { n.status = 'DUPLICATE'; n.result = 'Reference already receipted — not counted twice'; return n; }
  const open = db.messages.filter((m) => ['SENT', 'SMS', 'OPENED', 'PARTIAL'].includes(m.status));
  let msg = null, how = '';
  if (token) { msg = db.messages.find((m) => m.token === token); how = 'pay link'; }
  const waiting = source !== 'UTR_SUBMITTED' && db.notifications.find((x) => x.status === 'WAITING' && x.ref === ref);
  if (!msg && waiting) { msg = db.messages.find((m) => m.id === waiting.messageId); how = 'UTR the parent entered'; waiting.status = 'CONFIRMED'; waiting.result = 'Bank line arrived'; }
  if (!msg && narration) {
    const hits = open.filter((m) => narration.toUpperCase().includes(db.students.find((s) => s.id === m.studentId).admNo.toUpperCase()));
    if (hits.length === 1) { msg = hits[0]; how = 'admission no. in narration'; }
  }
  if (!msg && source !== 'GATEWAY') {
    const hits = open.filter((m) => m.due - m.paid === n.amount);
    if (hits.length === 1) { msg = hits[0]; how = 'unique amount'; }
  }
  if (!msg) { n.result = 'No admission no. and no unique amount — needs a person'; return n; }
  if (source === 'UTR_SUBMITTED') { n.status = 'WAITING'; n.messageId = msg.id; n.result = 'Will confirm when the bank line arrives'; return n; }
  applyToMessage(db, n, msg, 'AUTO', how);
  return n;
}

export function applyToMessage(db, n, msg, kind, how = 'matched by accounts') {
  const pay = recordPayment(db, { studentId: msg.studentId, amount: n.amount, mode: n.mode, ref: n.ref, by: kind === 'AUTO' ? 'Auto-match' : 'Accounts', invoiceIds: msg.invoiceIds, source: n.source });
  msg.paid += n.amount;
  msg.status = msg.paid >= msg.due ? 'PAID' : 'PARTIAL';
  msg.remarks = `Paid ₹${num(n.amount)} by ${n.mode} on ${dmon(pay.at)} · ref ${n.ref} · receipt ${pay.receiptNo} · ${kind === 'AUTO' ? 'confirmed automatically' : 'matched by accounts'}` +
    (msg.status === 'PARTIAL' ? ` · ₹${num(msg.due - msg.paid)} still due` : '');
  n.status = kind === 'AUTO' ? 'AUTO' : 'MANUAL'; n.messageId = msg.id; n.result = `${pay.receiptNo} · ${how}`;
  return pay;
}

// ---------- Admission ----------
export function admitStudent(db, f, by) {
  const sec = db.sections.find((x) => x.id === f.sectionId);
  const cls = db.classes.find((c) => c.id === sec.classId);
  const gId = 'P' + (db.guardians.length + 1);
  db.guardians.push({ id: gId, name: f.guardianName, relation: f.relation, mobile: f.mobile, email: f.email || '' });
  const n = db.students.length + 1;
  const s = { id: 'S' + (900 + n), admNo: 'ADM-2026-' + String(400 + n).padStart(4, '0'), first: f.first, last: f.last, gender: f.gender, dob: f.dob,
    sectionId: sec.id, roll: db.students.filter((x) => x.sectionId === sec.id).length + 1, guardianId: gId, band: Number(f.band || 0), payPlan: 'THREE',
    status: 'Active', house: f.house || 'Blue', attendance: 100 };
  db.students.push(s);
  return s;
}

// ---------- Paper generator ----------
export function generatePaper(db, { chapters, mix, formatCode, sets = 3, title, by }) {
  const fmt = FORMATS.find((f) => f.code === formatCode);
  const pool = db.questions.filter((q) => q.status === 'Approved' && chapters.includes(q.chapter));
  const used = new Set();
  const result = [];
  const shortfall = [];
  for (let s = 0; s < sets; s++) {
    const qs = [];
    fmt.sections.forEach(([sec, type, count, marks]) => {
      const nE = Math.round(count * mix[0] / 100), nT = Math.round(count * mix[2] / 100), nI = Math.max(count - nE - nT, 0);
      const want = { EASY: nE, INTERMEDIATE: nI, TOUGH: nT };
      let got = 0;
      ['EASY', 'INTERMEDIATE', 'TOUGH', 'ANY'].forEach((d) => {
        const need = d === 'ANY' ? count - got : want[d];
        const cands = pool.filter((q) => q.type === type && !used.has(q.id) && (d === 'ANY' || q.difficulty === d))
          .sort((a, b) => a.used - b.used || a.id.localeCompare(b.id) * (s % 2 ? -1 : 1));
        cands.slice(0, Math.max(need, 0)).forEach((q) => { used.add(q.id); qs.push({ ...q, section: sec, marks }); got++; });
      });
      if (got < count && s === 0) shortfall.push(`${sec} ${type}: ${got}/${count}`);
    });
    result.push({ code: 'ABC'[s], questions: qs.map((q, i) => ({ ...q, no: i + 1 })) });
  }
  const all = result[0].questions;
  const tot = all.reduce((a, q) => a + q.marks, 0) || 1;
  const pct = (d) => Math.round(100 * all.filter((q) => q.difficulty === d).reduce((a, q) => a + q.marks, 0) / tot);
  db.seq.paper += 1;
  const paper = { id: 'PP' + db.seq.paper, title, formatCode, chapters, mix, sets: result, status: 'Draft', by, at: new Date().toISOString(),
    stats: { total: all.reduce((a, q) => a + q.marks, 0), easy: pct('EASY'), inter: pct('INTERMEDIATE'), tough: pct('TOUGH'),
      competency: Math.round(100 * all.filter((q) => q.competency).reduce((a, q) => a + q.marks, 0) / tot), shortfall } };
  db.papers.unshift(paper);
  log(db, by, 'Paper generated', `${title} · ${sets} sets`);
  return paper;
}

// ---------- Data import: suggestion, mapping, validation, commit ----------
export const IMPORT_FIELDS = {
  STUDENTS: [
    ['admission_no', 'Admission no.', 'TEXT', true, ['adm no', 'admn no', 'admission number', 'admno', 'enrollment no', 'scholar no']],
    ['first_name', 'First name', 'TEXT', true, ['student first name', 'given name', 'fname', 'student name', 'name of the student', 'name']],
    ['last_name', 'Last name', 'TEXT', false, ['surname', 'family name', 'lname']],
    ['dob', 'Date of birth', 'DATE', true, ['d o b', 'birth date', 'date of birth', 'birthday']],
    ['gender', 'Gender', 'ENUM:Male,Female,Other', true, ['sex', 'boy girl']],
    ['class', 'Class', 'CLASS', true, ['grade', 'std', 'standard', 'program', 'class name']],
    ['section', 'Section', 'TEXT', true, ['sec', 'division', 'div']],
    ['guardian_name', 'Guardian name', 'TEXT', true, ['father name', 'parent name', 'mother name', 'father s name', 'guardian']],
    ['guardian_mobile', 'Guardian mobile', 'PHONE', true, ['mobile', 'phone', 'contact', 'contact no', 'parent mobile', 'father mobile', 'whatsapp']],
    ['guardian_email', 'Guardian email', 'EMAIL', false, ['email', 'e mail', 'parent email', 'mail id']]
  ],
  STAFF: [
    ['employee_code', 'Employee code', 'TEXT', true, ['emp code', 'emp id', 'employee id', 'staff id']],
    ['first_name', 'First name', 'TEXT', true, ['name', 'staff name', 'employee name']],
    ['last_name', 'Last name', 'TEXT', false, ['surname']],
    ['department', 'Department', 'TEXT', true, ['dept']],
    ['designation', 'Designation', 'TEXT', true, ['post', 'role']],
    ['mobile', 'Mobile', 'PHONE', true, ['phone', 'contact']],
    ['email', 'Email', 'EMAIL', false, ['e mail', 'mail id']]
  ]
};

const norm = (h) => String(h || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export function suggestField(entity, header) {
  const h = norm(header);
  let best = null, score = 0;
  for (const [field, label, , , syn] of IMPORT_FIELDS[entity]) {
    let s = 0;
    if (norm(field) === h || norm(label) === h) s = 3;
    else if (syn.includes(h)) s = 2;
    else if (syn.some((x) => x.length > 3 && h.includes(x))) s = 1;
    if (s > score) { score = s; best = field; }
  }
  return best;
}

export function transform(v, t, dateFmt = 'DD/MM/YYYY') {
  if (v === undefined || v === null) return '';
  let s = String(v).trim();
  switch (t) {
    case 'UPPER': return s.toUpperCase();
    case 'TITLE': return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
    case 'FIRST_WORD': return s.split(/\s+/)[0];
    case 'AFTER_FIRST_WORD': return s.split(/\s+/).slice(1).join(' ');
    case 'PHONE_IN': return s.replace(/\D/g, '').slice(-10);
    case 'NUMBER': return s.replace(/[^0-9.-]/g, '');
    case 'DATE': {
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      if (/^\d{5}$/.test(s)) { const d = new Date(Math.round((Number(s) - 25569) * 86400000)); return d.toISOString().slice(0, 10); } // Excel serial
      const p = s.split(/[\/.\-]/);
      if (p.length !== 3) return '!' + s;
      let [d, m, y] = dateFmt.startsWith('MM') ? [p[1], p[0], p[2]] : [p[0], p[1], p[2]];
      if (y.length === 2) y = '20' + y;
      const iso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      const dt = new Date(iso + 'T00:00:00Z');
      return isNaN(dt) || dt.toISOString().slice(0, 10) !== iso ? '!' + s : iso;
    }
    default: return s;
  }
}

export function mapRows(db, entity, rows, profile) {
  const fields = IMPORT_FIELDS[entity];
  const seen = {};
  return rows.map((raw, i) => {
    const out = {}, msgs = [];
    for (const [field, label, type, req] of fields) {
      const col = profile.columns[field];
      let v = col ? raw[col] : profile.defaults?.[field];
      v = transform(v, profile.transforms[field] || 'TRIM', profile.dateFormat);
      const vm = profile.values?.[field];
      if (vm && v && vm[v] !== undefined) v = vm[v];
      if (vm && v) { const k = Object.keys(vm).find((x) => x.toLowerCase() === String(v).toLowerCase()); if (k) v = vm[k]; }
      if (!v) { if (req) msgs.push(['error', `${label} is missing`]); }
      else if (String(v).startsWith('!')) msgs.push(['error', `${label} "${String(v).slice(1)}" is not a valid date`]);
      else if (type.startsWith('ENUM') && !type.slice(5).split(',').includes(v)) msgs.push(['error', `${label} "${v}" not recognised — add a value mapping`]);
      else if (type === 'PHONE' && !/^[6-9]\d{9}$/.test(v)) msgs.push(['error', `${label} "${v}" is not a 10-digit mobile`]);
      else if (type === 'EMAIL' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) { msgs.push(['warning', `${label} "${v}" doesn't look like an email — left blank`]); v = ''; }
      else if (type === 'CLASS' && !db.classes.some((c) => c.name.toLowerCase() === String(v).toLowerCase())) msgs.push(['error', `Class "${v}" not set up — add a value mapping (e.g. 8th → Grade VIII)`]);
      out[field] = v;
    }
    if (entity === 'STUDENTS' && out.class && out.section) {
      const cls = db.classes.find((c) => c.name.toLowerCase() === String(out.class).toLowerCase());
      if (cls && !db.sections.some((x) => x.classId === cls.id && x.name.toLowerCase() === String(out.section).toLowerCase())) msgs.push(['error', `Section ${out.section} doesn't exist in ${cls.name}`]);
    }
    const key = out.admission_no || out.employee_code;
    if (key) {
      if (seen[key]) msgs.push(['error', 'Same number appears twice in the file']);
      seen[key] = true;
      if (entity === 'STUDENTS' && db.students.some((s) => s.admNo === key)) msgs.push(['error', `Admission no. ${key} already exists`]);
      if (entity === 'STAFF' && db.staff.some((s) => s.code === key)) msgs.push(['error', `Employee code ${key} already exists`]);
    }
    const status = msgs.some((m) => m[0] === 'error') ? 'ERROR' : msgs.length ? 'WARNING' : 'OK';
    return { rowNo: i + 1, raw, out, msgs, status };
  });
}

export function commitImport(db, entity, mapped, fileName, by) {
  if (mapped.some((r) => r.status === 'ERROR')) throw new Error('Fix the rows with errors first');
  const job = { id: 'J' + (db.importJobs.length + 1), entity, fileName, at: new Date().toISOString(), by, created: [], status: 'IMPORTED', rows: mapped.length };
  mapped.forEach((r) => {
    const o = r.out;
    if (entity === 'STUDENTS') {
      const cls = db.classes.find((c) => c.name.toLowerCase() === o.class.toLowerCase());
      const sec = db.sections.find((x) => x.classId === cls.id && x.name.toLowerCase() === o.section.toLowerCase());
      let g = db.guardians.find((x) => x.mobile === o.guardian_mobile);   // siblings share one guardian
      let newG = false;
      if (!g) { g = { id: 'P' + (db.guardians.length + 1), name: o.guardian_name, relation: 'Father', mobile: o.guardian_mobile, email: o.guardian_email || '' }; db.guardians.push(g); newG = true; }
      const s = { id: 'S' + (2000 + db.students.length), admNo: o.admission_no, first: o.first_name, last: o.last_name, gender: o.gender, dob: o.dob, sectionId: sec.id,
        roll: db.students.filter((x) => x.sectionId === sec.id).length + 1, guardianId: g.id, band: 0, payPlan: 'THREE', status: 'Active', house: 'Blue', attendance: 100, importedBy: job.id };
      db.students.push(s);
      job.created.push({ student: s.id, guardian: newG ? g.id : null });
    } else {
      const s = { id: 'E' + (100 + db.staff.length), code: o.employee_code, first: o.first_name, last: o.last_name, short: o.first_name.slice(0, 3).toUpperCase(), dept: o.department,
        desig: o.designation, mobile: o.mobile, email: o.email, join: todayISO(), salary: { Basic: 0, HRA: 0, DA: 0, Transport: 0, PF: 0, Tax: 0 }, status: 'Active', importedBy: job.id };
      db.staff.push(s);
      job.created.push({ staff: s.id });
    }
  });
  db.importJobs.unshift(job);
  log(db, by, 'Data imported', `${fileName} · ${mapped.length} ${entity.toLowerCase()}`);
  return job;
}

export function rollbackImport(db, jobId, by) {
  const job = db.importJobs.find((j) => j.id === jobId);
  const sIds = job.created.map((c) => c.student).filter(Boolean), gIds = job.created.map((c) => c.guardian).filter(Boolean), eIds = job.created.map((c) => c.staff).filter(Boolean);
  db.students = db.students.filter((s) => !sIds.includes(s.id));
  db.guardians = db.guardians.filter((g) => !gIds.includes(g.id));
  db.staff = db.staff.filter((s) => !eIds.includes(s.id));
  job.status = 'ROLLED BACK';
  log(db, by, 'Import rolled back', `${job.fileName}`);
}

export const wordsINR = (n) => 'INR ' + amountInWords(n) + ' only';
