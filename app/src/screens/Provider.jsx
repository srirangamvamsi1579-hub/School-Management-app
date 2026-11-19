// Service Provider (release 13): your company's sales and marketing screens.
// Price List & Tiers → Proposal Builder → Demo Builder, plus Competition Comparison and Market Review & Roadmap.
import { useMemo, useState } from 'react';
import { useStore } from '../data/store.js';
import { Page, Card, Field, Input, Select, Modal, Pill, Stat, Tabs, Switch, printPage } from '../components/ui.jsx';
import { PLANS, LABEL } from '../data/menu.js';
import {
  DEFAULT_RATE_CARD, MESSAGING, TRANSPORT, OPTIONAL, GST, rupees, rateText, planFor, planOf, addonOf, blankOptions, quote, demoConfig, demoCode, featureList, functionList
} from '../lib/pricing.js';
import { PROVIDERS, FEATURES, AS_OF, FX, MARKET, ROADMAP, ROADMAP_STATUS, mark, priceRange } from '../data/providers.js';

const rcOf = (db) => db.provider?.rateCard || DEFAULT_RATE_CARD;
const dmy = (d) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const todayIso = () => new Date().toISOString().slice(0, 10);
const lakh = (n) => (n >= 100000 ? '₹' + (n / 100000).toFixed(n >= 1000000 ? 1 : 2).replace(/\.?0+$/, '') + ' lakh' : rupees(n));
const PROPOSAL_STATUS = ['Draft', 'Sent', 'Won', 'Lost'];
const STATUS_KIND = { Draft: 'warn', Sent: 'info', Won: 'ok', Lost: 'bad', Idea: '', Planned: 'info', 'In progress': 'warn', Released: 'ok' };
const includedText = (rc, a) => (a.includedFrom ? `Included from ${rc.plans.find((p) => p.rank === a.includedFrom && p.code !== 'FREE')?.name}` : 'Always paid');

// ================================================================ Price List & Tiers
export function PriceList() {
  const { db, session, run, notify } = useStore();
  const can = ['PLATFORM', 'ADMIN'].includes(session.role);   // Sales views; the platform team and the Admin change prices
  const [rc, setRc] = useState(() => structuredClone(rcOf(db)));
  const dirty = JSON.stringify(rc) !== JSON.stringify(rcOf(db));
  const setPlan = (i, k, v) => setRc({ ...rc, plans: rc.plans.map((p, j) => (j === i ? { ...p, [k]: v === '' ? undefined : +v } : p)) });
  const setAddon = (i, k, v) => setRc({ ...rc, addons: rc.addons.map((a, j) => (j === i ? { ...a, [k]: v === '' || v === 'null' ? (k === 'includedFrom' ? null : undefined) : +v } : a)) });
  const setHost = (i, k, v) => setRc({ ...rc, hosting: rc.hosting.map((h, j) => (j === i ? { ...h, [k]: +v } : h)) });
  const num = (v, on, label) => <Input type="number" step="any" aria-label={label} value={v ?? ''} disabled={!can} onChange={(e) => on(e.target.value)} style={{ width: 90 }} />;
  const save = () => { const bad = rc.plans.some((p) => p.code !== 'FREE' && !(p.flat >= 0 || p.perStudent > 0)); if (bad) { notify('Every paid plan needs a flat price or a price per student'); return; }
    run((d) => { d.provider = d.provider || {}; d.provider.rateCard = { ...rc, version: (rcOf(d).version || 1) + 1 }; }); notify('Price list saved — new proposals use it straight away'); };
  return <Page title="Price list & tiers" sub={`What each tier costs, which add-ons each tier includes, and hosting. Prices are a month, in rupees, before ${GST}% GST. Annual plans pay ${rc.annualMonths} months for 12.`}
    actions={can && <><button className="btn" onClick={() => setRc(structuredClone(DEFAULT_RATE_CARD))}>Back to the launch prices</button><button className="btn pri" disabled={!dirty} onClick={save}>Save price list</button></>}>
    {!can && <p className="small muted">Only the platform team and the Admin can change prices. You can see them and use them in proposals.</p>}
    <Card title="Tiers">
      <div className="tw"><table className="t"><thead><tr><th>Tier</th><th>Students up to</th><th>Flat a month</th><th>Per student a month</th><th>Minimum a month</th><th>Onboarding (one-time)</th><th>Support</th></tr></thead>
        <tbody>{rc.plans.map((p, i) => <tr key={p.code}><td className="b">{p.name}</td><td>{p.cap ?? 'No limit'}</td><td>{p.perStudent ? '—' : num(p.flat, (v) => setPlan(i, 'flat', v), `${p.name} flat price`)}</td>
          <td>{p.perStudent !== undefined ? num(p.perStudent, (v) => setPlan(i, 'perStudent', v), `${p.name} per student`) : '—'}</td><td>{p.perStudent !== undefined ? num(p.min, (v) => setPlan(i, 'min', v), `${p.name} minimum`) : '—'}</td>
          <td>{num(p.setup, (v) => setPlan(i, 'setup', v), `${p.name} onboarding`)}</td><td className="small">{p.support}</td></tr>)}</tbody></table></div>
    </Card>
    <Card title="Add-ons and what each tier includes">
      <div className="tw"><table className="t"><thead><tr><th>Add-on</th><th>Charged per</th><th>Rate a month</th><th>Minimum</th><th>One-time</th>{rc.plans.filter((p) => p.code !== 'FREE').map((p) => <th key={p.code}>{p.name}</th>)}<th>Included from</th></tr></thead>
        <tbody>{rc.addons.map((a, i) => <tr key={a.code}><td className="b">{a.name}</td><td>{a.unit === 'flat' ? 'School' : a.unit}</td><td>{num(a.rate, (v) => setAddon(i, 'rate', v), `${a.name} rate`)}</td>
          <td>{a.unit === 'bus' ? <>{num(a.minQty, (v) => setAddon(i, 'minQty', v), `${a.name} minimum buses`)} buses</> : a.unit === 'flat' ? '—' : num(a.min, (v) => setAddon(i, 'min', v), `${a.name} minimum`)}</td>
          <td>{a.setup !== undefined ? num(a.setup, (v) => setAddon(i, 'setup', v), `${a.name} one-time`) : '—'}</td>
          {rc.plans.filter((p) => p.code !== 'FREE').map((p) => <td key={p.code}>{a.includedFrom !== null && p.rank >= a.includedFrom ? <Pill kind="ok">Included</Pill> : <span className="small">{a.unit === 'flat' ? rupees(a.rate) : rateText(a.rate) + ' / ' + a.unit}</span>}</td>)}
          <td><Select aria-label={`${a.name} included from`} disabled={!can} value={String(a.includedFrom)} onChange={(e) => setAddon(i, 'includedFrom', e.target.value)} options={[['null', 'Always paid'], ...PLANS.map((p) => [String(p.rank), p.name])]} /></td></tr>)}</tbody></table></div>
      <p className="small muted">Messaging: email and app notices are free on every tier; SMS is the paid add-on. Transport Basic or Plus is chosen per school; Plus adds route planning and pickup suggestions.</p>
    </Card>
    <Card title="Hosting">
      <div className="tw"><table className="t"><thead><tr><th>Option</th><th>One-time</th><th>A month</th><th>Note</th></tr></thead>
        <tbody>{rc.hosting.map((h, i) => <tr key={h.code}><td className="b">{h.name}{h.enterpriseOnly && <> <Pill>Enterprise only</Pill></>}</td><td>{num(h.setup, (v) => setHost(i, 'setup', v), `${h.name} one-time`)}</td>
          <td>{h.monthlyPct ? <>{num(h.monthlyPct, (v) => setHost(i, 'monthlyPct', v), `${h.name} percent`)}% of plan</> : num(h.monthly, (v) => setHost(i, 'monthly', v), `${h.name} monthly`)}</td><td className="small">{h.note || ''}</td></tr>)}</tbody></table></div>
    </Card>
    <Card title="Rules"><div className="form">
      <Field label="Annual plan: months charged for 12"><Input type="number" disabled={!can} value={rc.annualMonths} onChange={(e) => setRc({ ...rc, annualMonths: +e.target.value })} /></Field>
      <Field label="Discount sales can give (%)"><Input type="number" disabled={!can} value={rc.maxSalesDiscount} onChange={(e) => setRc({ ...rc, maxSalesDiscount: +e.target.value })} /></Field>
      <Field label="Highest discount allowed (%)"><Input type="number" disabled={!can} value={rc.maxDiscount} onChange={(e) => setRc({ ...rc, maxDiscount: +e.target.value })} /></Field>
    </div></Card>
  </Page>;
}

// ================================================================ Proposal Builder
function QuoteCard({ rc, o, q }) {
  return <Card title="Price" right={<Pill kind="info">{q.plan.name}</Pill>}>
    {q.warnings.map((w) => <div key={w} className="ro-bar" role="status" style={{ marginBottom: 6 }}>{w}</div>)}
    <table className="t"><tbody>
      <tr><th colSpan={2}>Every month</th></tr>
      {q.monthly.map((l) => <tr key={l.code}><td className="small">{l.label}</td><td style={{ textAlign: 'right' }}>{l.included ? <Pill kind="ok">Included</Pill> : rupees(l.amount)}</td></tr>)}
      <tr><td className="b">Monthly total</td><td className="b" style={{ textAlign: 'right' }}>{rupees(q.monthlyTotal)}</td></tr>
      {q.oneTime.length > 0 && <><tr><th colSpan={2}>One-time</th></tr>{q.oneTime.map((l) => <tr key={l.code}><td className="small">{l.label}</td><td style={{ textAlign: 'right' }}>{rupees(l.amount)}</td></tr>)}</>}
    </tbody></table>
    <div className="kpis" style={{ marginTop: 10 }}>
      <Stat label={o.billing === 'MONTHLY' ? 'A year (12 monthly bills)' : `A year (${q.months} months billed)`} value={rupees(q.yearly)} sub={`${rupees(q.yearlyWithGst)} with GST`} />
      <Stat label="Per student a year" value={rupees(q.perStudentYear)} sub="before GST" />
      <Stat label="First invoice" value={rupees(q.firstInvoiceTotal)} sub={`incl. ${rupees(q.firstInvoiceGst)} GST`} />
    </div>
  </Card>;
}

function ProposalForm({ o, set, rc }) {
  const plan = planOf(rc, o.plan);
  const fit = planFor(rc, +o.students || 0, { allowFree: o.plan === 'FREE' });
  const up = (k, v) => set({ ...o, [k]: v });
  return <>
    <Card title="1. Client"><div className="form">
      <Field label="School name" req><Input value={o.client} onChange={(e) => up('client', e.target.value)} /></Field>
      <Field label="City"><Input value={o.city} onChange={(e) => up('city', e.target.value)} /></Field>
      <Field label="Board"><Select value={o.board} onChange={(e) => up('board', e.target.value)} options={['CBSE', 'ICSE', 'State board', 'IB / Cambridge', 'Mixed']} /></Field>
      <Field label="Contact (role)"><Input value={o.contact} onChange={(e) => up('contact', e.target.value)} placeholder="e.g. Principal" /></Field>
    </div></Card>
    <Card title="2. Size and tier"><div className="form">
      <Field label="Students" req><Input type="number" min="1" value={o.students} onChange={(e) => up('students', e.target.value)} /></Field>
      <Field label="Tier" req><Select aria-label="Tier" value={o.plan} onChange={(e) => up('plan', e.target.value)} options={rc.plans.map((p) => [p.code, `${p.name} (${p.cap ? 'up to ' + p.cap : (rc.plans[rc.plans.length - 2]?.cap || 0) + 1 + '+'} students)`])} /></Field>
      <div style={{ alignSelf: 'end', paddingBottom: 6 }}>{fit.code !== o.plan ? <button type="button" className="btn sm" onClick={() => up('plan', fit.code)}>Use {fit.name} — fits {o.students} students</button> : <span className="small muted">{plan.name} fits this size.</span>}</div>
    </div></Card>
    <Card title="3. Messaging and transport"><div className="form">
      <Field label="Messages to parents and staff"><Select aria-label="Messaging" value={o.messaging} onChange={(e) => up('messaging', e.target.value)} options={MESSAGING} /></Field>
      <Field label="Transport"><Select aria-label="Transport" value={o.transport} onChange={(e) => up('transport', e.target.value)} options={TRANSPORT} /></Field>
      {o.transport !== 'NONE' && <Field label="Buses"><Input type="number" min="0" value={o.buses} onChange={(e) => up('buses', e.target.value)} /></Field>}
    </div></Card>
    <Card title="4. Add-ons">
      {OPTIONAL.map((code) => { const a = addonOf(rc, code); const inc = a.includedFrom !== null && plan.rank >= a.includedFrom && plan.code !== 'FREE';
        return <div key={code} className="row" style={{ borderTop: '1px solid var(--line)', padding: '6px 0' }}>
          <Switch on={inc || !!o.addons[code]} label={a.name} onClick={() => !inc && set({ ...o, addons: { ...o.addons, [code]: !o.addons[code] } })} />
          <span style={{ flex: 1 }}>{a.name}</span>
          {inc ? <Pill kind="ok">Included in {plan.name}</Pill> : <span className="small muted">{a.unit === 'flat' ? rupees(a.rate) + ' a month' : `${rateText(a.rate)} per ${a.unit} a month${a.min ? ', min ' + rupees(a.min) : ''}`}{a.setup ? ` + ${rupees(a.setup)} one-time` : ''}</span>}
          {code === 'HOSTEL' && (o.addons.HOSTEL || inc) && <Input type="number" aria-label="Hostel residents" value={o.residents} onChange={(e) => up('residents', e.target.value)} style={{ width: 90 }} placeholder="Residents" />}
        </div>; })}
    </Card>
    <Card title="5. Hosting and billing"><div className="form">
      <Field label="Hosting"><Select aria-label="Hosting" value={o.hosting} onChange={(e) => up('hosting', e.target.value)} options={rc.hosting.map((h) => [h.code, h.name])} /></Field>
      <Field label="Billing"><Select aria-label="Billing" value={o.billing} onChange={(e) => up('billing', e.target.value)} options={[['ANNUAL', `Annual, paid up front (${rc.annualMonths} months)`], ['MONTHLY', 'Monthly']]} /></Field>
      <Field label="Discount %"><Input type="number" min="0" value={o.discountPct} onChange={(e) => up('discountPct', e.target.value)} /></Field>
      <label className="row small"><input type="checkbox" checked={o.interState} onChange={(e) => up('interState', e.target.checked)} /> School is in another state (IGST)</label>
      {o.plan === 'STARTER' && <label className="row small"><input type="checkbox" checked={o.assisted} onChange={(e) => up('assisted', e.target.checked)} /> Assisted onboarding ({rupees(plan.assistedSetup)})</label>}
    </div></Card>
  </>;
}

function ProposalDoc({ p, rc }) {
  const o = p.options; const q = quote(rc, o); const feats = featureList(rc, o).filter((m) => m.on);
  const valid = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  return <div className="doc">
    <h1 style={{ marginBottom: 4 }}>Proposal for {o.client || 'your school'}</h1>
    <p className="muted">{p.no} · {dmy(p.created)} · valid until {dmy(valid)}{o.city ? ' · ' + o.city : ''}</p>
    <h2>Recommended: {q.plan.name} tier</h2>
    <p>For {q.students} students{o.transport !== 'NONE' ? `, ${o.buses} buses` : ''}. {q.plan.name} costs {rupees(q.monthlyTotal)} a month with the options below; on the annual plan that is {rupees(q.yearly)} a year ({rupees(q.perStudentYear)} per student), plus GST. A free phone app for every parent and staff member is included.</p>
    <h2>What the school gets</h2>
    <ul>{feats.map((m) => <li key={m.code}><b>{m.label}:</b> {m.items.filter((i) => i.on).map((i) => i.label).join(', ')}</li>)}</ul>
    <p className="small">Messages: {MESSAGING.find((x) => x[0] === o.messaging)[1]}. Hosting: {rc.hosting.find((h) => h.code === o.hosting).name}, data kept in India. Support: {q.plan.support}.</p>
    <h2>Price</h2>
    <table className="t"><thead><tr><th>Item</th><th style={{ textAlign: 'right' }}>A month</th></tr></thead><tbody>
      {q.monthly.map((l) => <tr key={l.code}><td>{l.label}</td><td style={{ textAlign: 'right' }}>{l.included ? 'Included' : rupees(l.amount)}</td></tr>)}
      <tr><td className="b">Monthly total</td><td className="b" style={{ textAlign: 'right' }}>{rupees(q.monthlyTotal)}</td></tr></tbody></table>
    {q.oneTime.length > 0 && <table className="t" style={{ marginTop: 8 }}><thead><tr><th>One-time</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead><tbody>{q.oneTime.map((l) => <tr key={l.code}><td>{l.label}</td><td style={{ textAlign: 'right' }}>{rupees(l.amount)}</td></tr>)}</tbody></table>}
    <table className="t" style={{ marginTop: 8 }}><tbody>
      <tr><td>{o.billing === 'MONTHLY' ? 'First month + one-time' : `Year one: ${q.months} months billed for 12 + one-time`}</td><td style={{ textAlign: 'right' }}>{rupees(q.firstInvoice)}</td></tr>
      {q.gstSplit.map(([k, v]) => <tr key={k}><td>{k}</td><td style={{ textAlign: 'right' }}>{rupees(v)}</td></tr>)}
      <tr><td className="b">First invoice total</td><td className="b" style={{ textAlign: 'right' }}>{rupees(q.firstInvoiceTotal)}</td></tr></tbody></table>
    <h2>Terms</h2>
    <ul className="small"><li>Prices exclude GST at {GST}%. Student numbers are checked each October on annual plans.</li><li>Every table can be exported at any time; data is kept 90 days after the contract ends.</li><li>Payment by bank transfer or UPI within 15 days of the invoice. If the school deducts TDS, please send the certificate.</li></ul>
  </div>;
}

export function ProposalBuilder({ go }) {
  const { db, run, notify, session } = useStore();
  const rc = rcOf(db);
  const list = db.provider?.proposals || [];
  const [edit, setEdit] = useState(null);     // { id?, options }
  const [view, setView] = useState(null);
  const [filter, setFilter] = useState('ALL');
  const q = useMemo(() => (edit ? quote(rc, { ...edit.options, students: +edit.options.students || 0 }) : null), [edit, rc]);
  const save = (thenDemo) => {
    if (!String(edit.options.client).trim()) { notify('Enter the school name'); return null; }
    const id = run((d) => {
      d.provider.proposals = d.provider.proposals || [];
      if (edit.id) { const p = d.provider.proposals.find((x) => x.id === edit.id); p.options = edit.options; p.updated = todayIso(); return p.id; }
      d.seq.proposal = (d.seq.proposal || 0) + 1;
      const p = { id: 'PR' + d.seq.proposal, no: `PROP-${todayIso().slice(0, 4)}-${String(d.seq.proposal).padStart(3, '0')}`, status: 'Draft', created: todayIso(), by: session.name, options: edit.options };
      d.provider.proposals.unshift(p); return p.id;
    });
    notify('Proposal saved'); setEdit({ ...edit, id });
    if (thenDemo) { try { sessionStorage.setItem('sp-demo-from', id); } catch (e) { /* ignore */ } go('SP_DEMO'); }
    return id;
  };
  const setStatus = (id, status) => { run((d) => { d.provider.proposals.find((p) => p.id === id).status = status; }); notify(`Marked ${status}`); };
  if (edit) return <Page title={edit.id ? `Proposal ${list.find((p) => p.id === edit.id)?.no}` : 'New proposal'} sub="Pick the tier and options; the price works itself out from the price list. Save it, print it for the client, or build a demo from it."
    actions={<><button className="btn" onClick={() => setEdit(null)}>Back to proposals</button><button className="btn" onClick={() => { const id = save(false); if (id) setView(id); }}>Save and preview</button><button className="btn" onClick={() => save(true)}>Save and build demo</button><button className="btn pri" onClick={() => save(false)}>Save</button></>}>
    <div className="grid g-side"><div><ProposalForm o={edit.options} set={(options) => setEdit({ ...edit, options })} rc={rc} /></div><div><QuoteCard rc={rc} o={edit.options} q={q} /></div></div>
    {view && <Modal title="Proposal" onClose={() => setView(null)} actions={<button className="btn pri" onClick={printPage}>Print or save as PDF</button>}><ProposalDoc p={(db.provider.proposals || []).find((x) => x.id === view)} rc={rc} /></Modal>}
  </Page>;
  const rows = list.filter((p) => filter === 'ALL' || p.status === filter);
  const won = list.filter((p) => p.status === 'Won').reduce((s, p) => s + quote(rc, p.options).yearly, 0);
  const open = list.filter((p) => ['Draft', 'Sent'].includes(p.status)).reduce((s, p) => s + quote(rc, p.options).yearly, 0);
  return <Page title="Proposals" sub="Build a priced proposal from the tiers and add-ons, print it for the client, and track it to won or lost."
    actions={<button className="btn pri" onClick={() => setEdit({ options: blankOptions(rc) })}>New proposal</button>}>
    <div className="kpis"><Stat label="Proposals" value={list.length} /><Stat label="Open (draft or sent)" value={lakh(open)} sub="a year" /><Stat label="Won" value={lakh(won)} sub="a year" /><Stat label="Win rate" value={(() => { const d = list.filter((p) => ['Won', 'Lost'].includes(p.status)); return d.length ? Math.round((100 * d.filter((p) => p.status === 'Won').length) / d.length) + '%' : '—'; })()} /></div>
    <Card right={<Select aria-label="Status filter" value={filter} onChange={(e) => setFilter(e.target.value)} options={[['ALL', 'All'], ...PROPOSAL_STATUS]} />}>
      <div className="tw"><table className="t"><thead><tr><th>Proposal</th><th>School</th><th>Students</th><th>Tier</th><th>A month</th><th>A year</th><th>Status</th><th /></tr></thead>
        <tbody>{rows.map((p) => { const x = quote(rc, p.options); return <tr key={p.id}><td className="b">{p.no}<div className="small muted">{dmy(p.created)} · {p.by}</div></td><td>{p.options.client}<div className="small muted">{p.options.city}</div></td><td>{p.options.students}</td><td>{x.plan.name}</td><td>{rupees(x.monthlyTotal)}</td><td>{rupees(x.yearly)}</td>
          <td><Select aria-label={`Status of ${p.no}`} value={p.status} onChange={(e) => setStatus(p.id, e.target.value)} options={PROPOSAL_STATUS} /></td>
          <td><div className="row"><button className="btn sm" onClick={() => setEdit({ id: p.id, options: structuredClone(p.options) })}>Open</button><button className="btn sm" onClick={() => setView(p.id)}>Preview</button>
            <button className="btn sm" onClick={() => { try { sessionStorage.setItem('sp-demo-from', p.id); } catch (e) { /* ignore */ } go('SP_DEMO'); }}>Build demo</button></div></td></tr>; })}</tbody></table></div>
    </Card>
    {view && <Modal title="Proposal" onClose={() => setView(null)} actions={<button className="btn pri" onClick={printPage}>Print or save as PDF</button>}><ProposalDoc p={list.find((x) => x.id === view)} rc={rc} /></Modal>}
  </Page>;
}

// ================================================================ Demo Builder
const DEMO_ROLES = [['PRINCIPAL', 'Principal'], ['ADMIN', 'Admin'], ['TEACHER', 'Teacher'], ['PARENT', 'Parent'], ['ACCOUNTANT', 'Accountant'], ['FRONT_OFFICE', 'Front office'], ['TRANSPORT', 'Transport team']];
// What to show, in order, for these choices: [screen, role to show it as, what to say]
export function demoScript(o, cfg) {
  const on = (c) => cfg.overrides[c] !== false;
  const s = [['DASH', 'PRINCIPAL', 'Start with the dashboard: what changed this month, not just counts.'],
    ['STU_PROFILE', 'PRINCIPAL', 'One student: personal, academic and performance with rank in class.'],
    ['STU_ATT', 'TEACHER', 'Attendance as a register: tap present or absent for the month.'],
    ['FEE_COLLECT', 'ACCOUNTANT', 'Collect a fee and print the receipt; parents pay online too.']];
  if (on('STU_REPORTCARD')) s.push(['STU_REPORTCARD', 'PRINCIPAL', 'Report cards by grade, term or exam — print or let parents view them.']);
  if (cfg.overrides.TRANSPORT) s.push(['TRN_ROUTES', 'TRANSPORT', o.transport === 'PLUS' ? 'Route options, pickup suggestions and the route map (Transport Plus).' : 'Routes, stops and timings, and the driver route sheets.']);
  if (cfg.overrides.PAYROLL !== false && cfg.plan !== 'STARTER') s.push(['PAY_RUN', 'ACCOUNTANT', 'Run payroll and print payslips.']);
  s.push(['STF_LEAVE', 'PRINCIPAL', 'A leave request arrives with an alert; approve it in one tap.']);
  if (cfg.overrides.CMP_LIBRARY) s.push(['CMP_LIBRARY', 'FRONT_OFFICE', 'Library: issue a book and see overdue fines.']);
  if (cfg.overrides.CMP_HOSTEL) s.push(['CMP_HOSTEL', 'FRONT_OFFICE', 'Hostel: blocks, rooms, free beds and monthly fees.']);
  s.push(['CMP_HOMEWORK', 'TEACHER', 'Set homework; parents see it with their child\'s status.']);
  if (cfg.overrides.CMP_CLASSES) s.push(['CMP_CLASSES', 'TEACHER', 'Schedule an online class with a meeting link.']);
  if (cfg.overrides.ANALYTICS) s.push(['ANL_HOME', 'PRINCIPAL', 'Data Analytics: the report catalogue.']);
  if (cfg.overrides.EXM_QB) s.push(['EXM_QB', 'TEACHER', 'Question bank and paper builder.']);
  s.push(['SELF_CHILD', 'PARENT', 'The parent view: child, fees, requests — the same on the free app.']);
  return s;
}

export function DemoBuilder({ go }) {
  const { db, run, notify, session, login } = useStore();
  const rc = rcOf(db);
  const proposals = db.provider?.proposals || [];
  const demos = db.tenants.filter((t) => t.demo);
  const [step, setStep] = useState(1);
  const [src, setSrc] = useState(() => { let id = null; try { id = sessionStorage.getItem('sp-demo-from'); sessionStorage.removeItem('sp-demo-from'); } catch (e) { /* ignore */ } return id && proposals.some((p) => p.id === id) ? id : (proposals[0]?.id || 'QUICK'); });
  const [quick, setQuick] = useState(() => blankOptions(rc));
  const o = src === 'QUICK' ? quick : proposals.find((p) => p.id === src)?.options || quick;
  const base = useMemo(() => demoConfig(rc, o), [rc, o]);
  const [extra, setExtra] = useState({});
  const cfg = { ...base, overrides: { ...base.overrides, ...extra } };
  const feats = featureList(rc, o, cfg);
  const [name, setName] = useState('');
  const schoolName = name || (o.client ? o.client.replace(/\s*\(example\)$/, '') : 'Demo school');
  const [made, setMade] = useState(null);
  const tenant = db.tenants.find((t) => t.id === made);
  const pick = (id) => { setSrc(id); setExtra({}); setName(''); setMade(null); };
  const toggle = (code, cur) => setExtra({ ...extra, [code]: !cur });
  const create = () => {
    const t = run((d) => {
      const code = demoCode(schoolName, d.tenants.map((x) => x.code));
      d.seq.demo = (d.seq.demo || 0) + 1;
      const t = { id: 'TD' + d.seq.demo, code, name: `${schoolName} (demo)`, subdomain: 'demo-' + code.toLowerCase(), plan: cfg.plan, status: 'Demo', overrides: cfg.overrides,
        mobile: { enabled: true, appStatus: cfg.branded ? 'Branded app (demo preview)' : 'Shared app' }, renews: '—',
        demo: { proposalId: src === 'QUICK' ? null : src, client: o.client || schoolName, tier: planOf(rc, o.plan).name, by: session.name, byUser: session.userId, byRole: session.role, created: todayIso() } };
      d.tenants.push(t); d.provider.demos = [...(d.provider.demos || []), t.id];
      return t;
    });
    setMade(t.id); setStep(5); notify(`Demo school ${t.name} is ready`);
  };
  const present = (tenantId, role) => {
    const u = db.users.find((x) => x.role === role && x.status === 'ACTIVE' && !['Vice Principal', 'Head of Teaching Staff'].includes(x.designation));
    if (!u) { notify('No demo user for that role'); return; }
    run((d) => { d.provider.returnTenant = d.provider.returnTenant || d.tenantId; d.provider.presenter = { userId: session.userId, role: session.role, name: session.name }; d.tenantId = tenantId; });
    login({ role: u.role, userId: u.id, name: u.name });
    notify(`Showing the demo as ${u.name} — use “End demo” at the top to come back`);
  };
  const remove = (id) => { run((d) => { if (d.tenantId === id) d.tenantId = d.provider.returnTenant || 'T1'; d.tenants = d.tenants.filter((t) => t.id !== id); d.provider.demos = (d.provider.demos || []).filter((x) => x !== id); }); notify('Demo school removed'); if (made === id) setMade(null); };
  const STEPS = ['Client and tier', 'What the demo shows', 'Name the demo school', 'Create', 'Present'];
  return <Page title="Demo builder" sub="Turn a proposal into a working demo school: the client's tier and add-ons decide which menus and functions are on. Then present it as the Principal, a teacher or a parent on the client visit.">
    <div className="tabs" role="tablist" aria-label="Steps">{STEPS.map((s, i) => <button key={s} role="tab" aria-selected={step === i + 1} className={step === i + 1 ? 'on' : ''} onClick={() => (i + 1 < 5 || made) && setStep(i + 1)}>{i + 1}. {s}</button>)}</div>
    {step === 1 && <Card title="1. Which client?">
      <Field label="Start from"><Select aria-label="Start from" value={src} onChange={(e) => pick(e.target.value)} options={[...proposals.map((p) => [p.id, `${p.no} · ${p.options.client} · ${planOf(rc, p.options.plan).name}`]), ['QUICK', 'Quick demo — pick a tier and options here']]} /></Field>
      {src === 'QUICK' ? <ProposalForm o={quick} set={setQuick} rc={rc} /> : <p className="small">{o.client}: {o.students} students, {planOf(rc, o.plan).name} tier, {MESSAGING.find((m) => m[0] === o.messaging)[1].toLowerCase()}, {TRANSPORT.find((m) => m[0] === o.transport)[1].toLowerCase()}{OPTIONAL.filter((c) => o.addons?.[c]).length ? ', with ' + OPTIONAL.filter((c) => o.addons?.[c]).map((c) => addonOf(rc, c).name.split(' (')[0]).join(', ') : ''}. <a href="#/s/SP_PROPOSAL">Change it in the proposal</a>.</p>}
      <div className="row end"><button className="btn pri" onClick={() => setStep(2)}>Next</button></div>
    </Card>}
    {step === 2 && <Card title="2. What the demo shows" right={<span className="small muted">From the {planOf(rc, o.plan).name} tier and the add-ons. Switch anything on or off for this demo only.</span>}>
      <div className="grid g3">{feats.map((m) => <div key={m.code} className="card" style={{ margin: 0 }}>
        <div className="row"><Switch on={m.on} label={m.label} onClick={() => !['OPERATIONS', 'SETTINGS'].includes(m.code) && toggle(m.code, m.on)} /><b>{m.label}</b></div>
        {m.on && <div className="small" style={{ marginTop: 6 }}>{m.items.map((i) => <label key={i.code} className="row"><input type="checkbox" checked={i.on} onChange={() => toggle(i.code, i.on)} />{i.label}</label>)}</div>}</div>)}</div>
      <h3>Functions</h3><div className="row small" style={{ flexWrap: 'wrap' }}>{functionList(cfg).map((f) => <label key={f.code} className="row" style={{ marginRight: 12 }}><input type="checkbox" checked={f.on} onChange={() => toggle(f.code, f.on)} />{f.name}</label>)}</div>
      <div className="row end"><button className="btn" onClick={() => setStep(1)}>Back</button><button className="btn pri" onClick={() => setStep(3)}>Next</button></div>
    </Card>}
    {step === 3 && <Card title="3. Name the demo school"><div className="form">
      <Field label="Name shown in the demo"><Input value={schoolName} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Plan in the app"><Input value={PLANS.find((p) => p.code === cfg.plan).name + (o.plan === 'FREE' ? ' (Free: some screens off)' : '')} disabled /></Field>
      <Field label="Phone app"><Input value={cfg.branded ? 'Branded app preview' : 'Shared free app'} disabled /></Field></div>
      <p className="small muted">The demo uses the fictional demo data (students, staff, buses) with the client's name and set-up, so nothing real is shown.</p>
      <div className="row end"><button className="btn" onClick={() => setStep(2)}>Back</button><button className="btn pri" onClick={() => setStep(4)}>Next</button></div></Card>}
    {step === 4 && <Card title="4. Create the demo school">
      <p>Creates <b>{schoolName} (demo)</b> on the <b>{PLANS.find((p) => p.code === cfg.plan).name}</b> plan with {Object.values(cfg.overrides).filter(Boolean).length} switches on and {Object.values(cfg.overrides).filter((v) => v === false).length} off. It shows in Platform Console → Schools & Plans as a demo and can be removed after the visit.</p>
      <div className="row end"><button className="btn" onClick={() => setStep(3)}>Back</button><button className="btn pri" onClick={create}>Create demo school</button></div></Card>}
    {step === 5 && tenant && <Card title={`5. Present ${tenant.name}`}>
      <p className="small">Open the demo as one of these people. A bar at the top of every screen says it's a demo and has <b>End demo</b> to bring you back here.</p>
      <div className="row" style={{ flexWrap: 'wrap', marginBottom: 12 }}>{DEMO_ROLES.map(([r, l]) => <button key={r} className="btn" onClick={() => present(tenant.id, r)}>Open as {l}</button>)}</div>
      <h3>Demo script</h3>
      <ol>{demoScript(o, { ...cfg, plan: tenant.plan, overrides: tenant.overrides }).map(([code, role, say]) => <li key={code} style={{ marginBottom: 6 }}><b>{LABEL[code]}</b> <span className="small muted">as {DEMO_ROLES.find((x) => x[0] === role)?.[1]}</span> — {say}</li>)}</ol>
    </Card>}
    <Card title={`Demo schools (${demos.length})`}>{demos.length ? <div className="tw"><table className="t"><thead><tr><th>Demo school</th><th>Client</th><th>Tier</th><th>Created</th><th /></tr></thead>
      <tbody>{demos.map((t) => <tr key={t.id}><td className="b">{t.name}<div className="small muted">code {t.code}</div></td><td>{t.demo.client}</td><td>{t.demo.tier}</td><td>{dmy(t.demo.created)} · {t.demo.by}</td>
        <td><div className="row"><button className="btn sm" onClick={() => { setMade(t.id); setStep(5); }}>Present</button><button className="btn sm" onClick={() => remove(t.id)}>Remove</button></div></td></tr>)}</tbody></table></div> : <p className="muted">No demo schools yet.</p>}</Card>
  </Page>;
}

// End-demo bar for the app shell
export function DemoEndBar({ tenant }) {
  const { db, run, login, notify } = useStore();
  if (!tenant?.demo) return null;
  const end = () => {
    const p = db.provider?.presenter;
    run((d) => { d.tenantId = d.provider.returnTenant && d.tenants.some((t) => t.id === d.provider.returnTenant) ? d.provider.returnTenant : 'T1'; d.provider.returnTenant = null; d.provider.presenter = null; });
    const u = (p && db.users.find((x) => x.id === p.userId)) || db.users.find((x) => x.role === 'SALES');
    if (u) login({ role: u.role, userId: u.id, name: u.name });
    window.location.hash = '#/s/SP_DEMO';
    notify('Demo ended');
  };
  return <div className="ro-bar" role="status" style={{ background: 'var(--info-bg, #e8f0fe)' }}>Sales demo for <b>{tenant.demo.client}</b> · {tenant.demo.tier} tier · fictional data. <button className="btn sm" onClick={end}>End demo</button></div>;
}

// ================================================================ Competition Comparison
const MARK = { Y: ['✓', 'ok', 'Offered'], A: ['Add-on', 'warn', 'Paid add-on or higher plan'], N: ['✗', 'bad', 'Not offered'], '?': ['?', '', 'Not stated in the sources'] };
export function Competition() {
  const { db } = useStore();
  const rc = rcOf(db);
  const [n, setN] = useState(400);
  const [region, setRegion] = useState('India');
  const [group, setGroup] = useState('ALL');
  const students = Math.max(1, +n || 1);
  const ours = quote(rc, { ...blankOptions(rc), students, plan: planFor(rc, students).code });
  const provs = PROVIDERS.filter((p) => p.us || region === 'ALL' || p.region === region);
  const priceOf = (p) => (p.us ? [ours.yearly, ours.yearly] : priceRange(p, students));
  const others = PROVIDERS.filter((p) => !p.us);
  const known = (code) => others.filter((p) => mark(p, code) !== '?');
  const edge = FEATURES.filter(([c]) => mark(PROVIDERS[0], c) === 'Y' && known(c).length >= 2 && known(c).filter((p) => mark(p, c) === 'Y').length / known(c).length < 0.5);
  const unique = FEATURES.filter(([c]) => mark(PROVIDERS[0], c) === 'Y' && !others.some((p) => mark(p, c) === 'Y'));
  const gaps = FEATURES.filter(([c]) => mark(PROVIDERS[0], c) !== 'Y' && others.some((p) => mark(p, c) === 'Y'));
  const priced = PROVIDERS.filter((p) => !p.us && priceOf(p)).map((p) => [p, (priceOf(p)[0] + priceOf(p)[1]) / 2]);
  const cheaper = priced.filter(([, v]) => v < ours.yearly).length;
  const feats = FEATURES.filter((f) => group === 'ALL' || f[2] === group);
  return <Page title="Competition comparison" sub={`What we offer against Indian and global school software, with an estimated yearly price at the top for a school of the size you enter. Public prices as of ${dmy(AS_OF)}.`}>
    <div className="row" style={{ marginBottom: 10, flexWrap: 'wrap' }}>
      <Field label="Students"><Input type="number" min="1" aria-label="Students" value={n} onChange={(e) => setN(e.target.value)} style={{ width: 110 }} /></Field>
      <Field label="Providers"><Select aria-label="Providers" value={region} onChange={(e) => setRegion(e.target.value)} options={[['India', 'Indian'], ['Global', 'Global'], ['ALL', 'All']]} /></Field>
      <Field label="Features"><Select aria-label="Feature group" value={group} onChange={(e) => setGroup(e.target.value)} options={[['ALL', 'All features'], ...[...new Set(FEATURES.map((f) => f[2]))]]} /></Field>
    </div>
    <div className="grid g3">
      <Card title="Our edge"><p className="small muted">We offer these; fewer than half the competitors that mention the feature offer it. “None listed”: no competitor page we read mentions it — check before claiming it in a pitch.</p><ul className="small">{[...new Set([...unique, ...edge])].map(([c, l]) => <li key={c}>{l}{unique.some((u) => u[0] === c) && <> <Pill kind="ok">None listed</Pill></>}</li>)}</ul></Card>
      <Card title="Gaps to close"><p className="small muted">At least one competitor offers these and we don't (or only as an add-on).</p><ul className="small">{gaps.map(([c, l]) => <li key={c}>{l} — {others.filter((p) => mark(p, c) === 'Y').map((p) => p.name).join(', ')}</li>)}</ul></Card>
      <Card title="Price position"><p>For {students} students our {ours.plan.name} tier costs <b>{rupees(ours.yearly)}</b> a year ({rupees(ours.perStudentYear)} per student) before add-ons.</p>
        <p className="small">{cheaper} of {priced.length} priced competitors cost less at this size (mid-point of their range); {priced.length - cheaper} cost more. Global prices are converted at about ₹{FX.USD}/$, ₹{FX.GBP}/£ and ₹{FX.EUR}/€.</p></Card>
    </div>
    <Card title="Feature and price comparison">
      <div className="tw" style={{ maxHeight: 'none' }}><table className="t compare"><thead>
        <tr><th>Provider</th>{provs.map((p) => <th key={p.code} className={p.us ? 'us' : ''}>{p.name}<div className="small muted" style={{ fontWeight: 400 }}>{p.country}</div></th>)}</tr>
        <tr><th>Est. a year for {students} students</th>{provs.map((p) => { const v = priceOf(p); return <th key={p.code} className={p.us ? 'us' : ''} style={{ fontWeight: 600 }}>{v ? (v[0] === v[1] ? lakh(v[0]) : `${lakh(v[0])}–${lakh(v[1])}`) : <span className="muted">Quote / not for this size</span>}</th>; })}</tr>
        <tr><th className="small">Pricing</th>{provs.map((p) => <th key={p.code} className={'small' + (p.us ? ' us' : '')} style={{ fontWeight: 400 }}>{p.priceText}</th>)}</tr>
      </thead><tbody>
        {feats.map(([c, l, g], i) => <tr key={c}>{<td>{(i === 0 || feats[i - 1][2] !== g) && <div className="small muted">{g}</div>}{l}</td>}{provs.map((p) => { const m = MARK[mark(p, c)]; return <td key={p.code} className={p.us ? 'us' : ''} title={m[2]}>{m[1] ? <Pill kind={m[1]}>{m[0]}</Pill> : <span className="muted">{m[0]}</span>}</td>; })}</tr>)}
      </tbody></table></div>
      <p className="small muted">✓ offered · Add-on = paid extra or higher plan only · ✗ not offered · ? not stated in the pages we read (it may still exist). Our column reflects this release.</p>
    </Card>
    <Card title="Sources"><ul className="small">{PROVIDERS.filter((p) => p.source).map((p) => <li key={p.code}><a href={p.source} target="_blank" rel="noreferrer">{p.name}</a> — {p.country} · price{p.fsrc?.length ? <> · features: {p.fsrc.map((u, i) => <a key={u} href={u} target="_blank" rel="noreferrer" style={{ marginRight: 6 }}>[{i + 1}]</a>)}</> : <> · features not checked yet</>}</li>)}</ul></Card>
  </Page>;
}

// ================================================================ Market Review & Roadmap
export function MarketReview() {
  const { db, run, notify } = useStore();
  const [tab, setTab] = useState('india');
  const saved = db.provider?.roadmap || [];
  const rows = ROADMAP.map((r) => ({ ...r, ...(saved.find((x) => x.code === r.code) || {}), status: saved.find((x) => x.code === r.code)?.status || 'Idea' }));
  const setRow = (code, k, v) => { run((d) => { d.provider.roadmap = d.provider.roadmap || []; const x = d.provider.roadmap.find((y) => y.code === code); if (x) x[k] = v; else d.provider.roadmap.push({ code, [k]: v }); }); notify('Roadmap updated'); };
  const india = PROVIDERS.filter((p) => p.region === 'India' && !p.us); const global = PROVIDERS.filter((p) => p.region === 'Global');
  return <Page title="Market review & roadmap" sub={`The Indian and global school-software market, and the features we plan to add next, with where each idea comes from. As of ${dmy(AS_OF)}.`}>
    <Tabs tabs={[['india', 'Indian market'], ['global', 'Global market'], ['take', 'What it means for us'], ['road', `Future enhancements (${rows.length})`]]} value={tab} onChange={setTab} />
    {tab === 'india' && <>
      <Card title="Indian market"><ul>{MARKET.india.map((t) => <li key={t} style={{ marginBottom: 6 }}>{t}</li>)}</ul></Card>
      <Card title="Indian providers"><div className="tw"><table className="t"><thead><tr><th>Provider</th><th>Country</th><th>How they charge</th><th>Published price</th><th>Source</th></tr></thead>
        <tbody>{india.map((p) => <tr key={p.code}><td className="b">{p.name}</td><td>{p.country}</td><td>{p.model}</td><td>{p.priceText}</td><td><a href={p.source} target="_blank" rel="noreferrer">Link</a></td></tr>)}</tbody></table></div></Card></>}
    {tab === 'global' && <>
      <Card title="By country"><div className="tw"><table className="t"><thead><tr><th>Country</th><th>Providers</th><th>What the market looks like</th></tr></thead>
        <tbody>{MARKET.global.map((g) => <tr key={g.country}><td className="b">{g.country}</td><td>{g.who}</td><td>{g.text}</td></tr>)}</tbody></table></div></Card>
      <Card title="Global providers"><div className="tw"><table className="t"><thead><tr><th>Provider</th><th>Country</th><th>How they charge</th><th>Published price</th><th>Source</th></tr></thead>
        <tbody>{global.map((p) => <tr key={p.code}><td className="b">{p.name}</td><td>{p.country}</td><td>{p.model}</td><td>{p.priceText}</td><td><a href={p.source} target="_blank" rel="noreferrer">Link</a></td></tr>)}</tbody></table></div></Card></>}
    {tab === 'take' && <Card title="What it means for us"><ul>{MARKET.takeaways.map((t) => <li key={t} style={{ marginBottom: 6 }}>{t}</li>)}</ul></Card>}
    {tab === 'road' && <>
      <div className="kpis">{ROADMAP_STATUS.map((s) => <Stat key={s} label={s} value={rows.filter((r) => r.status === s).length} />)}</div>
      {['Now', 'Next', 'Later'].map((pr) => <Card key={pr} title={pr === 'Now' ? 'Now (next release)' : pr === 'Next' ? 'Next (within 6 months)' : 'Later'}>
        <div className="tw"><table className="t"><thead><tr><th>Enhancement</th><th>Why</th><th>Seen at</th><th>Country</th><th>Effort</th><th>Priority</th><th>Status</th></tr></thead>
          <tbody>{rows.filter((r) => r.priority === pr).map((r) => <tr key={r.code}><td className="b">{r.title}</td><td className="small">{r.why}</td><td className="small">{r.seenAt}</td><td className="small">{r.country}</td><td>{{ S: 'Small', M: 'Medium', L: 'Large' }[r.effort]}</td>
            <td><Select aria-label={`Priority of ${r.title}`} value={r.priority} onChange={(e) => setRow(r.code, 'priority', e.target.value)} options={['Now', 'Next', 'Later']} /></td>
            <td><Select aria-label={`Status of ${r.title}`} value={r.status} onChange={(e) => setRow(r.code, 'status', e.target.value)} options={ROADMAP_STATUS} /></td></tr>)}</tbody></table></div></Card>)}
      <p className="small muted">Released in this version (release 13): Library, Hostel, Homework, Online Classes, Inventory & Store, Events & Calendar — the gaps against Fedena, Devryon, Teachmint and Classter.</p></>}
  </Page>;
}
