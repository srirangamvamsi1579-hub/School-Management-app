import { useState } from 'react';
import { useStore } from '../data/store.js';
import { Page, Card, Field, Input, Select, Status, Modal, Html, Stat, Tabs, printPage } from '../components/ui.jsx';
import { inr, num, dmy, dmon } from '../lib/format.js';
import { fullName, classLabel, guardianOf, openInvoices, balance, recordPayment, sendFeeRequests, receiveNotification, applyToMessage, renderFor, wordsINR, tenantOf, log } from '../lib/logic.js';
import { GROUPS, BASE_FEE, PREV_FEE, BAND_TOTAL } from '../data/seed.js';
import { myChildren } from './Requests.jsx';

const findStudent = (db, q) => db.students.filter((s) => (fullName(s) + ' ' + s.admNo).toLowerCase().includes(q.toLowerCase())).slice(0, 8);

export function CollectFee() {
  const { db, run, notify, session } = useStore();
  const [q, setQ] = useState('Aarav');
  const [sid, setSid] = useState(null);
  const [amt, setAmt] = useState('');
  const [mode, setMode] = useState('UPI');
  const [ref, setRef] = useState('');
  const [receipt, setReceipt] = useState(null);
  const s = db.students.find((x) => x.id === sid);
  const open = s ? openInvoices(db, s.id) : [];
  const due = open.reduce((a, i) => a + balance(i), 0);
  const pay = () => {
    const p = run((d) => recordPayment(d, { studentId: sid, amount: Number(amt), mode, ref, by: session.role }));
    notify(`Receipt ${p.receiptNo} · confirmation email queued`); setReceipt(p.id); setAmt(''); setRef('');
  };
  return (
    <Page title="Collect fee" sub="Counter collection. Receipt, ledger voucher and the parent's confirmation email are created together.">
      <div className="grid g-side">
        <div>
          <Card title="1. Find student">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or admission no." style={{ width: '100%' }} />
            <div style={{ marginTop: 8 }}>{q.length > 1 && findStudent(db, q).map((x) => <button key={x.id} className={'btn sm' + (x.id === sid ? ' pri' : '')} style={{ margin: 3 }} onClick={() => { setSid(x.id); setAmt(String(openInvoices(db, x.id).reduce((a, i) => a + balance(i), 0))); }}>{fullName(x)} · {x.admNo}</button>)}</div>
          </Card>
          {s && <Card title={`2. Open invoices — ${fullName(s)} (${classLabel(db, s)})`}>
            {open.length === 0 ? <p className="muted">Nothing due.</p> : <table className="t"><thead><tr><th>Invoice</th><th>Instalment</th><th>Due date</th><th className="num">Balance</th><th>Status</th></tr></thead>
              <tbody>{open.map((i) => <tr key={i.id}><td>{i.no}</td><td>{i.instalment}</td><td>{dmy(i.due)}</td><td className="num">{inr(balance(i))}</td><td><Status s={i.status} /></td></tr>)}</tbody></table>}
          </Card>}
        </div>
        <Card title="3. Payment">
          {!s ? <p className="muted">Pick a student first.</p> : <>
            <div className="grid" style={{ gap: 10 }}>
              <Field label="Amount (₹)" req><Input type="number" value={amt} onChange={(e) => setAmt(e.target.value)} /></Field>
              <Field label="Mode"><Select value={mode} onChange={(e) => setMode(e.target.value)} options={['UPI', 'CASH', 'CARD', 'BANK', 'CHEQUE']} /></Field>
              {mode !== 'CASH' && <Field label="Reference / UTR / cheque no." req><Input value={ref} onChange={(e) => setRef(e.target.value)} /></Field>}
            </div>
            <p className="small muted">{amt ? wordsINR(amt) : ''}{Number(amt) > due ? ' · extra goes to advance' : ''}</p>
            <button className="btn pri" style={{ width: '100%' }} disabled={!(Number(amt) > 0) || (mode !== 'CASH' && !ref)} onClick={pay}>Save & print receipt</button>
          </>}
        </Card>
      </div>
      {receipt && <ReceiptModal id={receipt} onClose={() => setReceipt(null)} />}
    </Page>
  );
}

function ReceiptModal({ id, onClose }) {
  const { db, session } = useStore();
  const p = db.payments.find((x) => x.id === id);
  const s = db.students.find((x) => x.id === p.studentId);
  const items = p.allocations.map((a) => { const i = db.invoices.find((x) => x.id === a.invoiceId); return { description: i.instalment + ' (' + i.no + ')', amount: num(a.amount) + '.00' }; });
  const r = renderFor(db, 'FEE_RECEIPT', { receipt_no: p.receiptNo, date: dmy(p.at), student_name: fullName(s).toUpperCase(), admission_no: s.admNo, program: classLabel(db, s),
    amount: inr(p.amount), amount_words: wordsINR(p.amount), mode: p.mode, reference: p.ref, items }, session.role);
  return <Modal title={'Receipt ' + p.receiptNo} onClose={onClose} actions={<button className="btn pri" onClick={() => printPage()}>Print</button>}><Html html={r.body} /><p className="small muted">Template: {r.template?.name}</p></Modal>;
}

export function InvoiceView({ inv, onClose }) {
  const { db, session } = useStore();
  const s = db.students.find((x) => x.id === inv.studentId);
  const r = renderFor(db, 'FEE_INVOICE', {
    student_name: fullName(s).toUpperCase(), admission_no: s.admNo, program: classLabel(db, s).split('-')[0].toUpperCase(), instalment: inv.instalment, invoice_no: inv.no,
    invoice_date: dmy(inv.date), due_date: dmy(inv.due), items: inv.items.map((it, k) => ({ sr: String(k + 1), description: it.head, amount: num(it.amount) + '.00' })),
    grand_total: num(inv.net) + '.00', previous_outstanding: num(inv.prev) + '.00', advance: num(inv.advance) + '.00', net_payable: num(balance(inv)) + '.00', net_payable_words: wordsINR(balance(inv)),
    bank_details: `${db.bank.holder} · ${db.bank.bank}, ${db.bank.branch} · A/c ••••${db.bank.account.slice(-4)} · IFSC ${db.bank.ifsc} · UPI ${db.bank.upi}`,
    pay_link: `https://${tenantOf(db).subdomain}.yourapp.com/pay/…` }, session.role);
  return <Modal title={'Invoice ' + inv.no} onClose={onClose} actions={<button className="btn pri" onClick={() => printPage()}>Print</button>}><Html html={r.body} /><p className="small muted">Template: {r.template?.name} — change it in Settings → Templates.</p></Modal>;
}

export function FeeRequests() {
  const { db, run, notify, session } = useStore();
  const [classIds, setClassIds] = useState(['C8']);
  const [scope, setScope] = useState('INST');
  const [due, setDue] = useState('2026-12-10');
  const [preview, setPreview] = useState(null);
  const [camp, setCamp] = useState(null);
  const doSend = () => { const c = run((d) => sendFeeRequests(d, { classIds, scope, dueDate: due, by: session.role })); notify(`${c.counts.sent} emails and ${c.counts.noEmail} SMS queued`); setCamp(c.id); };
  const c = db.campaigns.find((x) => x.id === camp);
  const msgs = c ? db.messages.filter((m) => m.campaignId === c.id) : [];
  const pv = () => {
    const s = db.students.find((x) => x.admNo === 'ADM-2025-0231');
    const g = guardianOf(db, s);
    const inv = openInvoices(db, s.id);
    setPreview(renderFor(db, 'FEE_REQUEST_EMAIL', { guardian_name: g.name, student_name: fullName(s), class: classLabel(db, s), instalment: inv[0]?.instalment || 'Installment III', admission_no: s.admNo,
      amount_due: inr(inv.reduce((a, i) => a + balance(i), 0)), due_date: dmy(due), pay_link: `https://${tenantOf(db).subdomain}.yourapp.com/pay/7f3a9c21`,
      bank_details: `${db.bank.holder} · ${db.bank.bank}, ${db.bank.branch} · IFSC ${db.bank.ifsc} · UPI ${db.bank.upi}` }, session.role));
  };
  return (
    <Page title="Fee request emails" sub="One email per student, sent to the guardian's email on file, with the amount due, a personal pay link and the school's bank/UPI details. Guardians without email get an SMS.">
      <div className="grid g-side">
        <Card title="New request">
          <h3>Grades</h3>
          <div className="row">{db.classes.map((cl) => <label key={cl.id} className="pill" style={{ cursor: 'pointer', background: classIds.includes(cl.id) ? 'var(--brand-soft)' : undefined }}>
            <input type="checkbox" checked={classIds.includes(cl.id)} onChange={() => setClassIds(classIds.includes(cl.id) ? classIds.filter((x) => x !== cl.id) : [...classIds, cl.id])} style={{ marginRight: 4 }} />{cl.name.replace('Grade ', '')}</label>)}</div>
          <div className="form" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 12 }}>
            <Field label="What to ask for"><Select value={scope} onChange={(e) => setScope(e.target.value)} options={[['INST', 'Installment III'], ['OVERDUE', 'Overdue only'], ['ALL', 'Everything unpaid']]} /></Field>
            <Field label="Due date in email"><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
          </div>
          <div className="row end" style={{ marginTop: 12 }}><button className="btn" onClick={pv}>Preview email</button><button className="btn pri" disabled={!classIds.length} onClick={doSend}>Send to guardians</button></div>
        </Card>
        <Card title="Past campaigns">{db.campaigns.length === 0 ? <p className="muted">None yet.</p> : db.campaigns.map((x) => <div key={x.id} style={{ borderBottom: '1px solid var(--line)', padding: '6px 0', cursor: 'pointer' }} onClick={() => setCamp(x.id)}>
          <div className="b small">{x.title}</div><div className="small muted">{dmon(x.at)} · {x.counts.sent} emails · {x.counts.noEmail} SMS · {inr(x.counts.total)}</div></div>)}</Card>
      </div>
      {c && <Card title={c.title} right={<span className="small muted">Remarks fill in by themselves as payments arrive (see Payment Matching)</span>}>
        <div className="tw"><table className="t"><thead><tr><th>Student</th><th>Class</th><th>Sent to</th><th className="num">Due</th><th className="num">Paid</th><th>Status</th><th>Remarks</th></tr></thead>
          <tbody>{msgs.map((m) => { const s = db.students.find((x) => x.id === m.studentId); return <tr key={m.id}><td className="b">{fullName(s)}</td><td>{classLabel(db, s)}</td><td>{m.email || <span className="pill warn">SMS</span>}</td>
            <td className="num">{inr(m.due)}</td><td className="num">{inr(m.paid)}</td><td><Status s={m.status} /></td><td className="small">{m.remarks}</td></tr>; })}</tbody></table></div>
      </Card>}
      {preview && <Modal title={'Subject: ' + preview.subject} onClose={() => setPreview(null)}><Html html={preview.body} /><p className="small muted">Template: {preview.template?.name}</p></Modal>}
    </Page>
  );
}

export function PaymentMatching() {
  const { db, run, notify, session } = useStore();
  const [tab, setTab] = useState('feed');
  const [f, setF] = useState({ source: 'BANK_STATEMENT', amount: '', ref: '', narration: '', mode: 'NEFT' });
  const [manual, setManual] = useState(null);
  const open = db.messages.filter((m) => ['SENT', 'SMS', 'PARTIAL'].includes(m.status));
  const add = (data) => { const n = run((d) => receiveNotification(d, data)); notify(n.status === 'AUTO' ? 'Matched automatically — receipt and email done' : n.status === 'DUPLICATE' ? 'Duplicate — ignored' : n.status === 'WAITING' ? 'Waiting for the bank line' : 'Needs a person to match'); };
  const sim = (kind) => {
    if (!open.length) { notify('Send fee request emails first (Fees → Fee Request Emails)'); return; }
    const m = open[Math.floor(Math.random() * open.length)];
    const s = db.students.find((x) => x.id === m.studentId);
    const ref = 'UTR' + Math.floor(1e8 + Math.random() * 9e8);
    if (kind === 'gw') add({ source: 'GATEWAY', ref: 'pay_' + Math.random().toString(36).slice(2, 8), amount: m.due - m.paid, mode: 'UPI', token: m.token });
    if (kind === 'narr') add({ source: 'BANK_STATEMENT', ref, amount: m.due - m.paid, mode: 'NEFT', narration: `NEFT/${ref}/${guardianOf(db, s).name.toUpperCase()}/${s.admNo} FEES` });
    if (kind === 'none') add({ source: 'BANK_STATEMENT', ref, amount: 25000, mode: 'IMPS', narration: `IMPS/${ref}/SCHOOL FEES` });
  };
  const counts = ['AUTO', 'MANUAL', 'UNMATCHED', 'WAITING', 'DUPLICATE'].map((k) => [k, db.notifications.filter((n) => n.status === k).length]);
  return (
    <Page title="Payment matching" sub="Payments arrive from the payment gateway, from parents entering a UTR, and from the bank statement. The app matches them by pay link, then by admission number in the narration, then by a unique amount.">
      <div className="grid g4" style={{ marginBottom: 14 }}>{counts.slice(0, 4).map(([k, v]) => <Stat key={k} label={k[0] + k.slice(1).toLowerCase()} value={v} />)}</div>
      <Tabs tabs={[['feed', 'Incoming payments'], ['add', 'Add / simulate']]} value={tab} onChange={setTab} />
      {tab === 'add' ? (
        <div className="grid g2">
          <Card title="Simulate (for testing)">
            <div className="grid" style={{ gap: 8 }}>
              <button className="btn" onClick={() => sim('gw')}>Parent pays via pay link (gateway webhook)</button>
              <button className="btn" onClick={() => sim('narr')}>Bank line with admission no. in narration</button>
              <button className="btn" onClick={() => sim('none')}>Bank line with nothing to match on</button>
            </div>
            <p className="small muted">In production these come from the gateway webhook (Razorpay/Cashfree), the parent's “I've paid” form, and the bank statement file or bank API.</p>
          </Card>
          <Card title="Enter a bank line">
            <div className="grid" style={{ gap: 8 }}>
              <Field label="Amount"><Input type="number" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
              <Field label="UTR / reference"><Input value={f.ref} onChange={(e) => setF({ ...f, ref: e.target.value })} /></Field>
              <Field label="Narration"><Input value={f.narration} onChange={(e) => setF({ ...f, narration: e.target.value })} placeholder="e.g. NEFT/…/ADM-2025-0231" /></Field>
              <button className="btn pri" disabled={!f.amount || !f.ref} onClick={() => { add({ ...f, amount: Number(f.amount) }); setF({ ...f, amount: '', ref: '', narration: '' }); }}>Add</button>
            </div>
          </Card>
        </div>
      ) : (
        <div className="tw"><table className="t"><thead><tr><th>Received</th><th>Source</th><th>Reference</th><th>Narration</th><th className="num">Amount</th><th>Status</th><th>Result</th><th /></tr></thead>
          <tbody>{db.notifications.length === 0 ? <tr><td colSpan={8} className="muted">Nothing yet — use “Add / simulate”.</td></tr> : db.notifications.map((n) => <tr key={n.id}><td className="small">{dmon(n.at)}</td><td>{n.source.replace('_', ' ')}</td><td>{n.ref}</td><td className="small">{n.narration}</td>
            <td className="num">{inr(n.amount)}</td><td><Status s={n.status} /></td><td className="small">{n.result}</td><td>{n.status === 'UNMATCHED' && <button className="btn sm" onClick={() => setManual(n.id)}>Match</button>}</td></tr>)}</tbody></table></div>
      )}
      {manual && <Modal title="Match payment to a fee request" onClose={() => setManual(null)}>
        <p>{inr(db.notifications.find((n) => n.id === manual).amount)} · {db.notifications.find((n) => n.id === manual).narration}</p>
        <div className="tw"><table className="t"><tbody>{open.map((m) => { const s = db.students.find((x) => x.id === m.studentId); return <tr key={m.id}><td>{fullName(s)}</td><td>{s.admNo}</td><td className="num">{inr(m.due - m.paid)}</td>
          <td><button className="btn sm pri" onClick={() => { run((d) => { const n = d.notifications.find((x) => x.id === manual); const msg = d.messages.find((x) => x.id === m.id); applyToMessage(d, n, msg, 'MANUAL'); log(d, session.role, 'Payment matched by hand', n.ref); }); setManual(null); notify('Matched — receipt and confirmation email done'); }}>This one</button></td></tr>; })}</tbody></table></div>
      </Modal>}
    </Page>
  );
}

export function Dues() {
  const { db, run, notify, session } = useStore();
  const [inv, setInv] = useState(null);
  const rows = db.invoices.filter((i) => i.status === 'OVERDUE' || (i.status !== 'PAID' && i.instalment === 'Installment III'));
  return <Page title="Dues & reminders" sub={`${rows.length} unpaid invoices · ${inr(rows.reduce((a, i) => a + balance(i), 0))}`}
    actions={<button className="btn pri" onClick={() => { const c = run((d) => sendFeeRequests(d, { classIds: d.classes.map((x) => x.id), scope: 'OVERDUE', dueDate: '2026-11-30', by: session.role })); notify(`Reminders: ${c.counts.sent} emails, ${c.counts.noEmail} SMS`); }}>Remind all overdue</button>}>
    <div className="tw"><table className="t"><thead><tr><th>Invoice</th><th>Student</th><th>Class</th><th>Instalment</th><th>Due</th><th className="num">Balance</th><th>Status</th><th /></tr></thead>
      <tbody>{rows.map((i) => { const s = db.students.find((x) => x.id === i.studentId); return <tr key={i.id}><td>{i.no}</td><td className="b">{fullName(s)}</td><td>{classLabel(db, s)}</td><td>{i.instalment}</td><td>{dmy(i.due)}</td><td className="num">{inr(balance(i))}</td><td><Status s={i.status} /></td><td><button className="btn sm" onClick={() => setInv(i)}>Invoice</button></td></tr>; })}</tbody></table></div>
    {inv && <InvoiceView inv={inv} onClose={() => setInv(null)} />}
  </Page>;
}

export function Receipts() {
  const { db } = useStore();
  const [open, setOpen] = useState(null);
  return <Page title="Receipts" sub={`${db.payments.length} receipts · ${inr(db.payments.reduce((a, p) => a + p.amount, 0))}`}>
    <div className="tw"><table className="t"><thead><tr><th>Receipt</th><th>Date</th><th>Student</th><th>Mode</th><th>Reference</th><th>By</th><th className="num">Amount</th><th /></tr></thead>
      <tbody>{db.payments.slice(0, 300).map((p) => { const s = db.students.find((x) => x.id === p.studentId); return s && <tr key={p.id}><td>{p.receiptNo}</td><td>{dmy(p.at)}</td><td>{fullName(s)}</td><td>{p.mode}</td><td>{p.ref}</td><td>{p.by}</td><td className="num">{inr(p.amount)}</td><td><button className="btn sm" onClick={() => setOpen(p.id)}>View</button></td></tr>; })}</tbody></table></div>
    {open && <ReceiptModal id={open} onClose={() => setOpen(null)} />}
  </Page>;
}

export function FeeStructure() {
  const [tab, setTab] = useState('base');
  return <Page title="Fee structure 2026-27" sub="From the school's fee structure: five grade groups, three heads, six transport bands and three ways to pay.">
    <Tabs tabs={[['base', 'Fees by grade group'], ['transport', 'Totals with transport'], ['plans', 'Payment plans']]} value={tab} onChange={setTab} />
    {tab === 'base' && <Card><table className="t"><thead><tr><th>Head</th>{GROUPS.map((g) => <th key={g.id} className="num">{g.name}</th>)}</tr></thead>
      <tbody>{Object.keys(BASE_FEE).map((h) => <tr key={h}><td className="b">{h}</td>{BASE_FEE[h].map((v, i) => <td key={i} className="num">{inr(v)}<div className="small muted">was {inr(PREV_FEE[h][i])}</div></td>)}</tr>)}
        <tr><td className="b">Total</td>{GROUPS.map((g, i) => <td key={i} className="num b">{inr(BASE_FEE.Tuition[i] + BASE_FEE.Dining[i] + BASE_FEE.Annual[i])}</td>)}</tr></tbody></table></Card>}
    {tab === 'transport' && <Card><table className="t"><thead><tr><th>Transport band</th>{GROUPS.map((g) => <th key={g.id} className="num">{g.name}</th>)}</tr></thead>
      <tbody>{BAND_TOTAL.map((r, b) => <tr key={b}><td>Band {b + 1} · pick-up zone {'ABCDEF'[b]}</td>{r.map((v, i) => <td key={i} className="num">{inr(v)}</td>)}</tr>)}</tbody></table></Card>}
    {tab === 'plans' && <div className="grid g3">
      <Card title="Single payment"><p>Full year in one payment by 30 June.</p><p className="b">5% discount on tuition</p></Card>
      <Card title="Three instalments"><p>Instalment I — April (includes annual fee)<br />Instalment II — August<br />Instalment III — December</p></Card>
      <Card title="Education finance"><p>Monthly payments through a finance partner (e.g. Eduvanz). The school is paid in full; the parent repays the partner.</p></Card>
      <Card title="Not included" className="full"><p className="small">Uniforms, books, field trips, and optional activities are billed separately, as in the school's document.</p></Card>
    </div>}
  </Page>;
}

export function Concessions() {
  return <Page title="Concessions" sub="Sibling, staff-ward and merit concessions. Each needs Principal approval and shows on the invoice as a separate line.">
    <Card><table className="t"><thead><tr><th>Type</th><th>Rule</th><th>Applies to</th></tr></thead><tbody>
      <tr><td>Sibling</td><td>10% on tuition for the second child onwards</td><td>Tuition</td></tr>
      <tr><td>Staff ward</td><td>50% on tuition</td><td>Tuition</td></tr>
      <tr><td>Single payment</td><td>5% on tuition if paid in full by 30 June</td><td>Tuition</td></tr></tbody></table></Card>
  </Page>;
}

// Parent: dues and the page the pay link opens
export function ParentFees() {
  const { db, run, notify, session } = useStore();
  const kid = myChildren(db, session)[0] || db.students.find((s) => s.admNo === 'ADM-2025-0231');
  const invs = db.invoices.filter((i) => i.studentId === kid.id);
  const open = invs.filter((i) => i.status !== 'PAID');
  const [step, setStep] = useState(null);
  const [utr, setUtr] = useState('');
  const [inv, setInv] = useState(null);
  const total = open.reduce((a, i) => a + balance(i), 0);
  const msg = db.messages.find((m) => m.studentId === kid.id && m.status !== 'PAID');
  const payOnline = () => {
    run((d) => {
      let m = d.messages.find((x) => x.studentId === kid.id && x.status !== 'PAID');
      if (!m) { m = { id: 'FM' + (d.messages.length + 1), campaignId: null, studentId: kid.id, due: total, paid: 0, invoiceIds: open.map((i) => i.id), token: 'parent' + Date.now(), status: 'SENT', remarks: '' }; d.messages.push(m); }
      receiveNotification(d, { source: 'GATEWAY', ref: 'pay_' + Math.random().toString(36).slice(2, 8), amount: m.due - m.paid, mode: 'UPI', token: m.token });
    });
    setStep('done'); notify('Payment successful — receipt emailed');
  };
  return <Page title="Fee dues & pay" sub={`${fullName(kid)} · ${classLabel(db, kid)}`}>
    <div className="grid g-side">
      <Card title="Invoices"><table className="t"><tbody>{invs.map((i) => <tr key={i.id}><td>{i.instalment}</td><td>{dmy(i.due)}</td><td className="num">{inr(i.net)}</td><td><Status s={i.status} /></td><td><button className="btn sm" onClick={() => setInv(i)}>View</button></td></tr>)}</tbody></table></Card>
      <Card title="Pay now">
        {total === 0 || step === 'done' ? <div className="note">All paid. Thank you! The receipt has been emailed{msg ? '' : ''}.</div> : <>
          <div className="stat" style={{ marginBottom: 10 }}><div className="l">Amount due</div><div className="v">{inr(total)}</div><div className="s">{wordsINR(total)}</div></div>
          <button className="btn pri" style={{ width: '100%', marginBottom: 8 }} onClick={payOnline}>Pay online (UPI / card / net banking)</button>
          <button className="btn" style={{ width: '100%' }} onClick={() => setStep('bank')}>I'll pay by bank transfer / UPI app</button>
          {step === 'bank' && <div style={{ marginTop: 12 }}>
            <div className="note small">{db.bank.holder}<br />{db.bank.bank}, {db.bank.branch}<br />A/c ••••{db.bank.account.slice(-4)} (full number on the printed invoice) · IFSC {db.bank.ifsc}<br />UPI: <b>{db.bank.upi}</b><br />Write <b>{kid.admNo}</b> in the remarks.</div>
            <Field label="After paying, enter the UTR / reference"><Input value={utr} onChange={(e) => setUtr(e.target.value)} /></Field>
            <button className="btn pri" style={{ marginTop: 8 }} disabled={utr.length < 6} onClick={() => { run((d) => receiveNotification(d, { source: 'UTR_SUBMITTED', ref: utr, amount: total, mode: 'UPI', narration: kid.admNo })); setStep('wait'); notify('Thanks — we will confirm when the bank shows it'); }}>Submit</button>
          </div>}
          {step === 'wait' && <div className="note" style={{ marginTop: 10 }}>Received your reference. The school confirms it against the bank statement, usually the next working day.</div>}
        </>}
      </Card>
    </div>
    {inv && <InvoiceView inv={inv} onClose={() => setInv(null)} />}
  </Page>;
}
