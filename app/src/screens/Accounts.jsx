import { useState } from 'react';
import { useStore } from '../data/store.js';
import { Page, Card, Field, Input, Status, Modal, Html, Stat, printPage } from '../components/ui.jsx';
import { inr, num, dmy } from '../lib/format.js';
import { renderFor, log, wordsINR } from '../lib/logic.js';
import { amountInWords } from '../lib/format.js';

const gross = (s) => s.salary.Basic + s.salary.HRA + s.salary.DA + s.salary.Transport;
const ded = (s) => s.salary.PF + s.salary.Tax;

export function RunPayroll() {
  const { db, run, notify, session } = useStore();
  const [done, setDone] = useState(db.audit.some((a) => a.action === 'Payroll posted'));
  const tot = db.staff.reduce((a, s) => ({ g: a.g + gross(s), d: a.d + ded(s) }), { g: 0, d: 0 });
  const post = () => {
    run((d) => {
      d.seq.voucher += 1;
      d.vouchers.unshift({ id: 'V' + d.seq.voucher, no: 'JV-PAY-NOV26', date: '2026-11-30', type: 'Journal', source: 'Payroll', narration: 'Salaries November 2026',
        lines: [{ account: '5000 Salaries', debit: tot.g, credit: 0 }, { account: '2100 PF Payable', debit: 0, credit: db.staff.reduce((a, s) => a + s.salary.PF, 0) },
          { account: '2110 TDS Payable', debit: 0, credit: db.staff.reduce((a, s) => a + s.salary.Tax, 0) }, { account: '1010 Bank Account', debit: 0, credit: tot.g - tot.d }] });
      log(d, session.role, 'Payroll posted', `November 2026 · net ₹${num(tot.g - tot.d)}`);
    });
    setDone(true); notify('Payroll posted to accounts; payslips ready');
  };
  return <Page title="Run payroll — November 2026" sub="Check, then post. Posting creates one journal voucher and the payslips." actions={<button className="btn pri" disabled={done} onClick={post}>{done ? 'Posted' : 'Approve & post'}</button>}>
    <div className="grid g3" style={{ marginBottom: 14 }}><Stat label="Gross" value={inr(tot.g)} /><Stat label="Deductions" value={inr(tot.d)} /><Stat label="Net to bank" value={inr(tot.g - tot.d)} /></div>
    <div className="tw"><table className="t"><thead><tr><th>Employee</th><th>Designation</th>{['Basic', 'HRA', 'DA', 'Transport'].map((k) => <th key={k} className="num">{k}</th>)}<th className="num">PF</th><th className="num">TDS</th><th className="num">Net</th></tr></thead>
      <tbody>{db.staff.map((s) => <tr key={s.id}><td className="b">{s.first} {s.last}</td><td>{s.desig}</td>{['Basic', 'HRA', 'DA', 'Transport'].map((k) => <td key={k} className="num">{num(s.salary[k])}</td>)}<td className="num">{num(s.salary.PF)}</td><td className="num">{num(s.salary.Tax)}</td><td className="num b">{num(gross(s) - ded(s))}</td></tr>)}</tbody></table></div>
  </Page>;
}

export function Payslips({ self }) {
  const { db, session } = useStore();
  const list = self ? db.staff.slice(0, 1) : db.staff;
  const [open, setOpen] = useState(self ? list[0].id : null);
  const s = db.staff.find((x) => x.id === open);
  const slip = s && renderFor(db, 'PAYSLIP', { month: 'November 2026', employee_name: s.first + ' ' + s.last, employee_code: s.code, designation: s.desig + ' — ' + s.dept,
    items: [['Basic', s.salary.Basic, ''], ['HRA', s.salary.HRA, ''], ['DA', s.salary.DA, ''], ['Transport', s.salary.Transport, ''], ['Provident fund', '', s.salary.PF], ['TDS', '', s.salary.Tax]].map(([component, e, d]) => ({ component, earning: e ? num(e) : '', deduction: d ? num(d) : '' })),
    gross: num(gross(s)), deductions: num(ded(s)), net: num(gross(s) - ded(s)), net_words: amountInWords(gross(s) - ded(s)) }, session.role);
  if (self) return <Page title="My payslips" actions={<button className="btn pri" onClick={() => printPage()}>Print</button>}><Html html={slip.body} /></Page>;
  return <Page title="Payslips"><div className="tw"><table className="t"><tbody>{list.map((x) => <tr key={x.id}><td>{x.code}</td><td className="b">{x.first} {x.last}</td><td>November 2026</td><td className="num">{inr(gross(x) - ded(x))}</td><td><button className="btn sm" onClick={() => setOpen(x.id)}>View</button></td></tr>)}</tbody></table></div>
    {s && <Modal title={'Payslip — ' + s.first} onClose={() => setOpen(null)} actions={<button className="btn pri" onClick={() => printPage()}>Print</button>}><Html html={slip.body} /></Modal>}</Page>;
}

export function BankDetails() {
  const { db, run, notify, session } = useStore();
  const [edit, setEdit] = useState(null);
  const b = db.bank;
  const ifscOk = (v) => /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v);
  const upiOk = (v) => /^[\w.-]{2,}@[a-z]{2,}$/i.test(v);
  const canApprove = ['PRINCIPAL', 'ADMIN'].includes(session.role);
  return <Page title="Bank & payment details" sub="Shown on invoices, fee emails and the parent pay page. Changes need a second person (Principal) to approve — this protects against fraud."
    actions={!edit && <button className="btn pri" onClick={() => setEdit({ ...b, account: '' })}>Request change</button>}>
    {b.pending && <div className="note warn" style={{ marginBottom: 14 }}>Change requested by {b.pending.by}: {b.pending.bank}, IFSC {b.pending.ifsc}, UPI {b.pending.upi}.
      {canApprove && b.pending.by !== session.role ? <> <button className="btn sm pri" onClick={() => { run((d) => { const p = d.bank.pending; Object.assign(d.bank, { holder: p.holder, bank: p.bank, branch: p.branch, ifsc: p.ifsc, upi: p.upi, account: p.account || d.bank.account, pending: null, verifiedBy: session.role }); log(d, session.role, 'Bank details approved', p.ifsc); }); notify('Bank details updated everywhere'); }}>Approve</button> <button className="btn sm" onClick={() => run((d) => { d.bank.pending = null; })}>Reject</button></> : ' Waiting for another approver.'}</div>}
    <div className="grid g2">
      <Card title="Bank account" right={<Status s={b.verified ? 'Approved' : 'Pending approval'} />}>
        <table className="t"><tbody>
          <tr><td className="muted">Account holder</td><td className="b">{b.holder}</td></tr><tr><td className="muted">Bank / branch</td><td>{b.bank}, {b.branch}</td></tr>
          <tr><td className="muted">Account number</td><td>•••• •••• {b.account.slice(-4)} <span className="small muted">(stored encrypted; full number only on printed invoices)</span></td></tr>
          <tr><td className="muted">IFSC</td><td>{b.ifsc}</td></tr><tr><td className="muted">Approved by</td><td>{b.verifiedBy}</td></tr></tbody></table>
      </Card>
      <Card title="UPI / scanner">
        <div className="row" style={{ gap: 16 }}>
          <QR text={`upi://pay?pa=${b.upi}&pn=${encodeURIComponent(b.holder)}`} />
          <div><div className="b" style={{ fontSize: 18 }}>{b.upi}</div><p className="small muted">Parents scan this with any UPI app. Each fee email also carries a personal pay link with the exact amount, so payments match automatically.</p></div>
        </div>
      </Card>
    </div>
    {edit && <Modal title="Request bank details change" onClose={() => setEdit(null)} actions={<button className="btn pri" disabled={!ifscOk(edit.ifsc) || !upiOk(edit.upi)} onClick={() => { run((d) => { d.bank.pending = { ...edit, by: session.role }; log(d, session.role, 'Bank change requested', edit.ifsc); }); setEdit(null); notify('Sent for approval'); }}>Send for approval</button>}>
      <div className="form" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <Field label="Account holder"><Input value={edit.holder} onChange={(e) => setEdit({ ...edit, holder: e.target.value })} /></Field>
        <Field label="Bank"><Input value={edit.bank} onChange={(e) => setEdit({ ...edit, bank: e.target.value })} /></Field>
        <Field label="Branch"><Input value={edit.branch} onChange={(e) => setEdit({ ...edit, branch: e.target.value })} /></Field>
        <Field label="New account number (leave blank to keep)"><Input value={edit.account} onChange={(e) => setEdit({ ...edit, account: e.target.value.replace(/\D/g, '') })} /></Field>
        <Field label={'IFSC ' + (edit.ifsc && !ifscOk(edit.ifsc) ? '— format AAAA0XXXXXX' : '')}><Input value={edit.ifsc} onChange={(e) => setEdit({ ...edit, ifsc: e.target.value.toUpperCase() })} /></Field>
        <Field label={'UPI ID ' + (edit.upi && !upiOk(edit.upi) ? '— looks wrong' : '')}><Input value={edit.upi} onChange={(e) => setEdit({ ...edit, upi: e.target.value })} /></Field>
      </div>
    </Modal>}
  </Page>;
}

// Simple visual placeholder for the UPI QR (production renders a real QR from the UPI string)
function QR({ text }) {
  let h = 0; for (const c of text) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const cells = [];
  for (let y = 0; y < 21; y++) for (let x = 0; x < 21; x++) {
    const finder = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
    const on = finder ? (x % 20 === 0 || y % 20 === 0 || x === 6 || y === 6 || x === 14 || y === 14 || ((x % 14 >= 2 && x % 14 <= 4) && (y % 14 >= 2 && y % 14 <= 4))) : ((h >> ((x * 7 + y * 3) % 31)) & 1) ^ ((x * y) % 3 === 0);
    if (on) cells.push(<rect key={x + '-' + y} x={x} y={y} width="1" height="1" />);
  }
  return <svg viewBox="-1 -1 23 23" width="120" height="120" style={{ background: '#fff', borderRadius: 6, flex: 'none' }} aria-label="UPI QR code (sample)"><g fill="#14171C">{cells}</g></svg>;
}

export function AccountStatement() {
  const { db } = useStore();
  const [acc, setAcc] = useState('1010 Bank Account');
  const accounts = [...new Set(db.vouchers.flatMap((v) => v.lines.map((l) => l.account)))].sort();
  let bal = 1250000;
  const rows = [...db.vouchers].reverse().flatMap((v) => v.lines.filter((l) => l.account === acc).map((l) => { bal += l.debit - l.credit; return { v, l, bal }; }));
  return <Page title="Account statement" sub="Every fee receipt and payroll run posts here automatically (double entry).">
    <div className="row" style={{ marginBottom: 12 }}><select className="i" value={acc} onChange={(e) => setAcc(e.target.value)}>{(accounts.length ? accounts : [acc]).map((a) => <option key={a}>{a}</option>)}</select>
      <span className="muted small">{rows.length} entries · opening ₹12,50,000 (sample)</span></div>
    <div className="tw"><table className="t"><thead><tr><th>Date</th><th>Voucher</th><th>Narration</th><th className="num">Debit</th><th className="num">Credit</th><th className="num">Balance</th></tr></thead>
      <tbody>{rows.length === 0 ? <tr><td colSpan={6} className="muted">No entries yet. Collect a fee or run payroll to see postings.</td></tr> : rows.reverse().map(({ v, l, bal: b }, i) => <tr key={i}><td>{dmy(v.date)}</td><td>{v.no}</td><td>{v.narration}</td><td className="num">{l.debit ? num(l.debit) : ''}</td><td className="num">{l.credit ? num(l.credit) : ''}</td><td className="num">{num(b)}</td></tr>)}</tbody></table></div>
  </Page>;
}

export function Expenses() {
  const { db, run, notify, session } = useStore();
  const [f, setF] = useState({ head: '5100 Electricity', amount: '', note: '' });
  const exp = db.vouchers.filter((v) => v.type === 'Payment');
  const add = () => { run((d) => { d.seq.voucher += 1; d.vouchers.unshift({ id: 'V' + d.seq.voucher, no: 'PV-' + d.seq.voucher, date: new Date().toISOString().slice(0, 10), type: 'Payment', source: 'Expenses', narration: f.note || f.head,
    lines: [{ account: f.head, debit: Number(f.amount), credit: 0 }, { account: '1010 Bank Account', debit: 0, credit: Number(f.amount) }] }); log(d, session.role, 'Expense recorded', f.head + ' ₹' + f.amount); }); setF({ ...f, amount: '', note: '' }); notify('Expense recorded'); };
  return <Page title="Income & expenses">
    <Card title="Record an expense"><div className="row">
      <select className="i" value={f.head} onChange={(e) => setF({ ...f, head: e.target.value })}>{['5100 Electricity', '5110 Water', '5200 Transport Fuel', '5300 Maintenance', '5400 Stationery'].map((h) => <option key={h}>{h}</option>)}</select>
      <Input type="number" placeholder="Amount" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /><Input placeholder="Note / bill no." value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
      <button className="btn pri" disabled={!(Number(f.amount) > 0)} onClick={add}>Save</button></div>
      {f.amount && <p className="small muted">{wordsINR(f.amount)}</p>}</Card>
    <div className="tw"><table className="t"><thead><tr><th>Date</th><th>Voucher</th><th>Head</th><th>Note</th><th className="num">Amount</th></tr></thead>
      <tbody>{exp.map((v) => <tr key={v.id}><td>{dmy(v.date)}</td><td>{v.no}</td><td>{v.lines[0].account}</td><td>{v.narration}</td><td className="num">{inr(v.lines[0].debit)}</td></tr>)}</tbody></table></div>
  </Page>;
}
