// Service Provider: your company's sales and marketing screens.
// Release 14: Price List & Tiers (Starter, Pro, Pro+), Proposal Builder and Demo Builder share one set of
// choices — whatever the Demo Builder changes, the linked proposal (and its demo school) changes too.
// Competition Comparison and Market Review & Roadmap are unchanged from release 13.
import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../data/store.js';
import { Page, Card, Field, Input, Select, Modal, Pill, Stat, Tabs, Switch } from '../components/ui.jsx';
import { LABEL } from '../data/menu.js';
import {
  DEFAULT_RATE_CARD, GST, BASIC, SIZES, OVERHEAD_NAMES, UNIT, rupees, pct, tierOf, addonOf, basePrice, tierPrice, yearCost, bandLabel, rateText, blankOptions, quote,
  activeAddons, demoConfig, demoCode
} from '../lib/pricing.js';
import { DEFAULT_PROFILE } from '../data/seedRelease14.js';
import { saveOptions, newProposal, makeDemo, proposalProblems, phoneOk } from '../lib/proposals.js';
import * as dlv from '../lib/delivery.js';
import { saveFile } from '../lib/saveFile.js';
import { PROVIDERS, FEATURES, AS_OF, FX, MARKET, ROADMAP, ROADMAP_STATUS, mark, priceRange } from '../data/providers.js';

const rcOf = (db) => (db.provider?.rateCard?.version >= 2 ? db.provider.rateCard : DEFAULT_RATE_CARD);
const profileOf = (db) => ({ ...DEFAULT_PROFILE, ...(db.provider?.profile || {}) });
const dmy = (d) => (d ? new Date(d.length === 10 ? d + 'T00:00:00' : d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const todayIso = () => new Date().toISOString().slice(0, 10);
const lakh = (n) => (n >= 100000 ? '₹' + (n / 100000).toFixed(n >= 1000000 ? 1 : 2).replace(/\.?0+$/, '') + ' lakh' : rupees(n));
const okEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '').trim());
const PROPOSAL_STATUS = ['Draft', 'Sent', 'Won', 'Lost'];
const STATUS_KIND = { Draft: 'warn', Sent: 'info', Won: 'ok', Lost: 'bad', Idea: '', Planned: 'info', 'In progress': 'warn', Released: 'ok' };
const BOARDS = ['CBSE', 'ICSE', 'State board', 'IB / Cambridge', 'Mixed'];
const stash = (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) { /* ignore */ } };
const unstash = (k) => { let v = null; try { v = sessionStorage.getItem(k); sessionStorage.removeItem(k); } catch (e) { /* ignore */ } return v; };

function TierCards({ rc, value, students, onChoose, chooseLabel = (t) => `Choose ${t.name}`, compact = false }) {
  return <div className="tiers" role="list" aria-label="Plans">{rc.tiers.map((t, i) => {
    const on = t.code === value;
    const prev = rc.tiers[i - 1];
    const adds = t.includes.filter((c) => !prev?.includes.includes(c)).map((c) => addonOf(rc, c)?.name).filter(Boolean);
    return <div key={t.code} role="listitem" id={'tier-' + t.code} className={'tier' + (on ? ' on' : '') + (t.pick ? ' pick' : '')} aria-label={`${t.name} plan`}>
      {(on || t.pick) && <div className="tier-flag">{on ? 'Selected plan' : 'Our pick for most schools'}</div>}
      <h3>{t.name}</h3>
      <p className="small muted">{t.tagline}</p>
      <div className="tier-price">{rupees(t.rates[0])}<span> per student / year</span></div>
      <div className="small muted">about {rupees(t.rates[0] / 12)} a child a month · from <b>{rupees(basePrice(rc, t.code))}</b> a year</div>
      {students > 0 && <div className="small" style={{ marginTop: 4 }}>{students.toLocaleString('en-IN')} students: <b>{rupees(tierPrice(rc, t.code, students).amount)}</b> a year for the plan</div>}
      {onChoose && <button type="button" className={'btn' + (on ? ' pri' : '')} aria-pressed={on} onClick={() => onChoose(t.code)} style={{ margin: '10px 0' }}>{on ? `${t.name} selected` : chooseLabel(t)}</button>}
      {compact ? <div className="small muted">{i === 0 ? 'The 8 basic features' : `${prev.name} + ${adds.length} add-ons: ${adds.slice(0, 3).join(', ')}${adds.length > 3 ? '…' : ''}`}</div> : <>
        <div className="small b">{i === 0 ? 'Included:' : `Everything in ${prev.name}, plus:`}</div>
        <ul className="small">{(i === 0 ? BASIC.map((b) => b[1]) : adds).map((x) => <li key={x}>{x}</li>)}</ul>
        <div className="small muted">Support: {t.support}</div></>}
    </div>;
  })}</div>;
}

function AddonPicker({ rc, o, set }) {
  const t = tierOf(rc, o.tier);
  const on = activeAddons(rc, o);
  const up = (k, v) => set({ ...o, [k]: v });
  const groups = [...new Set(rc.addons.map((a) => a.group))];
  return <div className="addons">{groups.map((g) => <div key={g}><div className="small b muted" style={{ margin: '10px 0 4px', textTransform: 'uppercase', letterSpacing: '.05em' }}>{g}</div>
    {rc.addons.filter((a) => a.group === g).map((a) => {
      const inc = t.includes.includes(a.code);
      const blocked = a.needs && !on.includes(a.needs);
      return <div key={a.code} className="addon-row">
        <Switch on={inc || (!!o.addons?.[a.code] && !blocked)} label={a.name} onClick={() => !inc && !blocked && set({ ...o, addons: { ...o.addons, [a.code]: !o.addons?.[a.code] } })} />
        <div style={{ flex: 1, minWidth: 200 }}><b>{a.name}</b>{a.inspired && <span className="small muted"> · popular in Indian school apps</span>}<div className="small muted">{a.desc}</div>
          {blocked && <div className="small" style={{ color: 'var(--warn)' }}>Needs {addonOf(rc, a.needs).name}.</div>}</div>
        {a.provider === 'No service needed' && <Pill kind="ok">No service needed</Pill>}
        {inc ? <Pill kind="ok">Included in {t.name}</Pill> : <span className="small" style={{ minWidth: 150, textAlign: 'right' }}>{rateText(a)}{a.setup ? <><br />+ {rupees(a.setup)} one-time</> : ''}</span>}
        {a.unit === 'bus' && a.code === 'TRANSPORT' && on.includes('TRANSPORT') && <Input type="number" min="0" aria-label="Buses" value={o.buses} onChange={(e) => up('buses', e.target.value)} style={{ width: 80 }} placeholder="Buses" />}
        {a.unit === 'resident' && on.includes(a.code) && <Input type="number" min="0" aria-label="Hostel residents" value={o.residents} onChange={(e) => up('residents', e.target.value)} style={{ width: 90 }} placeholder="Residents" />}
      </div>;
    })}</div>)}</div>;
}

function ClientFields({ o, set, title = 'Client and point of contact' }) {
  const up = (k, v) => set({ ...o, [k]: v });
  const poc = (k, v) => set({ ...o, poc: { ...o.poc, [k]: v } });
  return <Card title={title}><div className="form">
    <Field label="School name" req><Input value={o.client} onChange={(e) => up('client', e.target.value)} /></Field>
    <Field label="City"><Input value={o.city} onChange={(e) => up('city', e.target.value)} /></Field>
    <Field label="Board"><Select aria-label="Board" value={o.board} onChange={(e) => up('board', e.target.value)} options={BOARDS} /></Field>
    <Field label="Students" req><Input type="number" min="1" aria-label="Students" value={o.students} onChange={(e) => up('students', e.target.value)} /></Field>
    <Field label="Point of contact" req><Input aria-label="Point of contact" value={o.poc?.name || ''} onChange={(e) => poc('name', e.target.value)} placeholder="e.g. Mrs. Lakshmi Iyer" /></Field>
    <Field label="Designation"><Input aria-label="Designation" value={o.poc?.designation || ''} onChange={(e) => poc('designation', e.target.value)} placeholder="e.g. Principal" /></Field>
    <Field label="Email ID" req><Input type="email" aria-label="Contact email" value={o.poc?.email || ''} onChange={(e) => poc('email', e.target.value)} placeholder="name@school.example.com" /></Field>
    <Field label="Contact number" req><Input type="tel" aria-label="Contact number" value={o.poc?.phone || ''} onChange={(e) => poc('phone', e.target.value)} placeholder="+91 …" /></Field>
  </div>{o.poc?.email && !okEmail(o.poc.email) && <p className="small" style={{ color: 'var(--bad)' }}>Check the email ID.</p>}
    {o.poc?.phone && !phoneOk(o.poc.phone) && <p className="small" style={{ color: 'var(--bad)' }}>Check the contact number: 10 to 13 digits.</p>}</Card>;
}

function DiscountField({ o, set, q }) {
  return <>
    <Field label={`Discount % on the plan and add-ons (most for this proposal: ${pct(q.economics.maxDiscountPct)})`}>
      <Input type="number" min="0" step="0.5" max={q.economics.maxDiscountPct} aria-label="Discount %" value={o.discountPct} onChange={(e) => set({ ...o, discountPct: e.target.value })} /></Field>
    <Field label="Additional discount % on the final amount">
      <Input type="number" min="0" step="0.5" aria-label="Additional discount %" value={o.finalDiscountPct || 0} onChange={(e) => set({ ...o, finalDiscountPct: e.target.value })} /></Field>
    <p className="small muted" style={{ gridColumn: '1 / -1', margin: 0 }}>The client's PDF shows only the discount applied and the amount payable; limits and approvals stay internal.</p>
  </>;
}

// Price, discount and the business case for a proposal
function PriceSummary({ rc, q, compact }) {
  const e = q.economics;
  return <>
    <Card title="Price" right={<Pill kind="info">{q.tier.name}</Pill>}>
      {q.warnings.map((w) => <div key={w} className="ro-bar" role="status" style={{ marginBottom: 6 }}>{w}</div>)}
      <div className="kpis" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <Stat label="A year" value={rupees(q.recurring)} sub={`${rupees(q.perStudentYear)} per student`} />
        <Stat label="Year one with GST" value={rupees(q.yearOneTotal)} sub={`incl. ${rupees(q.oneTimeTotal)} one-time`} />
      </div>
      {!compact && <table className="t"><tbody>
        <tr><th colSpan={2}>Every year</th></tr>
        {q.lines.map((l) => <tr key={l.code}><td className="small">{l.label}{l.provider === 'No service needed' && <> <Pill kind="ok">No service needed</Pill></>}</td><td style={{ textAlign: 'right' }}>{l.included ? <Pill kind="ok">Included</Pill> : rupees(l.amount)}</td></tr>)}
        {q.discount > 0 && <tr><td className="small">Discount {pct(q.discountPct)} (plan and add-ons)</td><td style={{ textAlign: 'right' }}>{rupees(-q.discount)}</td></tr>}
        {q.finalDiscountPct > 0 && <tr><td className="small">Additional discount {pct(q.finalDiscountPct)}</td><td style={{ textAlign: 'right' }}>{rupees(-q.finalDiscountRecurring)}</td></tr>}
        <tr><td className="b">Payable a year</td><td className="b" style={{ textAlign: 'right' }}>{rupees(q.recurring)}</td></tr>
        <tr><th colSpan={2}>One-time</th></tr>
        {q.oneTime.map((l) => <tr key={l.code}><td className="small">{l.label}</td><td style={{ textAlign: 'right' }}>{l.included ? <Pill kind="ok">Included</Pill> : rupees(l.amount)}</td></tr>)}
        {q.finalDiscountPct > 0 && q.oneTimeList > 0 && <tr><td className="small">Additional discount {pct(q.finalDiscountPct)}</td><td style={{ textAlign: 'right' }}>{rupees(-q.finalDiscountOneTime)}</td></tr>}
        <tr><td className="b">Payable one-time</td><td className="b" style={{ textAlign: 'right' }}>{rupees(q.oneTimeTotal)}</td></tr>
        <tr><td>Year one before GST</td><td style={{ textAlign: 'right' }}>{rupees(q.yearOne)}</td></tr>
        {q.gstSplit.map(([k, v]) => <tr key={k}><td className="small">{k}</td><td style={{ textAlign: 'right' }}>{rupees(v)}</td></tr>)}
        <tr><td className="b">Year one total</td><td className="b" style={{ textAlign: 'right' }}>{rupees(q.yearOneTotal)}</td></tr>
      </tbody></table>}
    </Card>
    <Card title="Margin and profit" right={<span className="small muted">internal</span>}>
      <table className="t"><tbody>
        <tr><td>Discount applied</td><td style={{ textAlign: 'right' }}>{q.discount ? `${pct(q.discountPct)} · ${rupees(q.discount)}` : 'None'}</td></tr>
        {q.finalDiscountPct > 0 && <tr><td>Additional discount on the final amount</td><td style={{ textAlign: 'right' }}>{pct(q.finalDiscountPct)} · {rupees(q.finalDiscount)}</td></tr>}
        <tr><td>Maximum allowable discount</td><td className="b" style={{ textAlign: 'right' }}>{pct(e.maxDiscountPct)}</td></tr>
        <tr><td>Running cost <span className="small muted">(cloud, storage, email, services, support)</span></td><td style={{ textAlign: 'right' }}>{rupees(e.runningCost)}</td></tr>
        {Object.entries(e.overheads).map(([k, v]) => <tr key={k}><td className="small">{OVERHEAD_NAMES[k]} ({rc.economics.overheads[k]}%)</td><td style={{ textAlign: 'right' }}>{rupees(v)}</td></tr>)}
        <tr><td className="b">Operating cost</td><td className="b" style={{ textAlign: 'right' }}>{rupees(e.operatingCost)}</td></tr>
        <tr><td className="b">Profit</td><td className="b" style={{ textAlign: 'right' }}>{rupees(e.profit)} · {pct(e.profitPct)}</td></tr>
        <tr><td>Gross margin <span className="small muted">(industry standard {e.industry[0]}–{e.industry[1]}%)</span></td><td style={{ textAlign: 'right' }}><Pill kind={e.marginStatus === 'Below' ? 'bad' : 'ok'}>{pct(e.grossMarginPct)} · {e.marginStatus.toLowerCase()}</Pill></td></tr>
        <tr><td className="small">One-time development profit</td><td className="small" style={{ textAlign: 'right' }}>{rupees(e.oneTimeProfit)} of {rupees(e.oneTimeRevenue)}</td></tr>
      </tbody></table>
      <p className="small muted">Most discount keeps profit at {e.profitFloor}% or more, never over {rc.maxDiscount}%. Over {e.salesDiscount}% needs the owner's approval.</p>
    </Card>
  </>;
}

// ================================================================ Price List & Tiers
export function PriceList({ go }) {
  const { db, session } = useStore();
  const rc = rcOf(db);
  const can = ['PLATFORM', 'ADMIN'].includes(session.role);   // Sales views; the platform team and the Admin change prices
  const [edit, setEdit] = useState(false);
  const [n, setN] = useState(400);
  const students = Math.max(1, +n || 1);
  const choose = (code) => { stash('sp-new-tier', code); go('SP_PROPOSAL'); };
  if (edit) return <EditPrices rc={rc} back={() => setEdit(false)} />;
  const groups = [...new Set(rc.addons.map((a) => a.group))];
  return <Page title="Pricing" sub={`Three plans, priced per student a year. Rates fall as the school grows. Every feature has a price; add-ons can be added to any plan. Prices are before ${GST}% GST.`}
    actions={<><button className="btn" onClick={() => go('HOME')}>Back to Home</button>{can && <button className="btn pri" onClick={() => setEdit(true)}>Edit prices</button>}</>}>
    <nav className="row" aria-label="Jump to a plan" style={{ marginBottom: 10, flexWrap: 'wrap' }}>
      {rc.tiers.map((t) => <a key={t.code} className="btn sm" href={'#tier-' + t.code} onClick={(e) => { e.preventDefault(); document.getElementById('tier-' + t.code)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}>{t.name}: from {lakh(basePrice(rc, t.code))}</a>)}
      <span className="small muted">Pick a plan to start a proposal with it.</span>
    </nav>
    <TierCards rc={rc} students={students} onChoose={choose} chooseLabel={(t) => (t.code === 'STARTER' ? 'Start with Starter' : `Choose ${t.name}`)} value={null} />
    <div className="grid g2" style={{ marginTop: 14 }}>
      <Card title="What a year costs" right={<label className="row small">School size <Input type="number" min="1" aria-label="School size" value={n} onChange={(e) => setN(e.target.value)} style={{ width: 90 }} /></label>}>
        <table className="t"><thead><tr><th>Children</th>{rc.tiers.map((t) => <th key={t.code} style={{ textAlign: 'right' }}>{t.name}</th>)}</tr></thead>
          <tbody>{[...new Set([...SIZES, students])].sort((a, b) => a - b).map((s) => <tr key={s} className={s === students ? 'hl' : ''}><td className={s === students ? 'b' : ''}>{s <= rc.minStudents ? `${rc.minStudents} or fewer` : s.toLocaleString('en-IN')}</td>{rc.tiers.map((t) => <td key={t.code} style={{ textAlign: 'right' }}>{rupees(yearCost(rc, t.code, s))}</td>)}</tr>)}</tbody></table>
        <p className="small muted">Plan price plus data storage ({rupees(rc.storage.rate)} a student a year), before GST. Schools under {rc.minStudents} students pay for {rc.minStudents}.</p>
      </Card>
      <Card title="Price bands (per student a year)">
        <table className="t"><thead><tr><th>Students</th>{rc.tiers.map((t) => <th key={t.code} style={{ textAlign: 'right' }}>{t.name}</th>)}</tr></thead>
          <tbody>{rc.bands.map((b, i) => <tr key={i}><td>{i === 0 ? `First ${b[1]}` : bandLabel(b)}</td>{rc.tiers.map((t) => <td key={t.code} style={{ textAlign: 'right' }}>{rupees(t.rates[i])}</td>)}</tr>)}</tbody></table>
        <p className="small muted">Like tax slabs: a school of 400 pays the first 300 students at the first rate and the next 100 at the second.</p>
        <h3 style={{ marginTop: 12 }}>One-time development</h3>
        <table className="t"><thead><tr><th>Item</th>{rc.tiers.map((t) => <th key={t.code} style={{ textAlign: 'right' }}>{t.name}</th>)}</tr></thead>
          <tbody>{rc.development.map((d) => <tr key={d.code}><td className="small">{d.name}</td>{rc.tiers.map((t) => <td key={t.code} style={{ textAlign: 'right' }}>{rupees(d.price[t.code])}</td>)}</tr>)}</tbody></table>
      </Card>
    </div>
    <Card title="Compare the plans">
      <div className="tw"><table className="t"><thead><tr><th>Feature</th>{rc.tiers.map((t) => <th key={t.code}>{t.name}</th>)}</tr></thead><tbody>
        <tr><td colSpan={4} className="small b muted">Basic features: in every plan</td></tr>
        {BASIC.map(([c, l]) => <tr key={c}><td>{l}</td>{rc.tiers.map((t) => <td key={t.code}><Pill kind="ok">Yes</Pill></td>)}</tr>)}
        <tr><td colSpan={4} className="small b muted">Add-ons: in the plan where marked, a paid extra otherwise</td></tr>
        {rc.addons.map((a) => <tr key={a.code}><td>{a.name}{a.provider === 'No service needed' && <> <Pill kind="ok">No service needed</Pill></>}</td>{rc.tiers.map((t) => <td key={t.code}>{t.includes.includes(a.code) ? <Pill kind="ok">Yes</Pill> : <span className="small">{rupees(a.rate)}{a.unit === 'school' ? '' : ' / ' + UNIT[a.unit]}</span>}</td>)}</tr>)}
      </tbody></table></div>
    </Card>
    <Card title="Add-ons">
      {groups.map((g) => <div key={g}><h3 style={{ marginTop: 10 }}>{g}</h3><div className="tw"><table className="t"><thead><tr><th>Add-on</th><th>What it does</th><th>Price</th><th>Outside service</th><th>Included in</th></tr></thead>
        <tbody>{rc.addons.filter((a) => a.group === g).map((a) => <tr key={a.code}><td className="b">{a.name}</td><td className="small">{a.desc}{a.needs && <> · needs {addonOf(rc, a.needs).name}</>}</td><td className="small">{rateText(a)}{a.setup ? ` + ${rupees(a.setup)} one-time` : ''}</td>
          <td className="small">{a.provider === 'No service needed' ? <><Pill kind="ok">No service needed</Pill><div className="muted">{a.providerNote}</div></> : a.provider || '—'}</td>
          <td>{rc.tiers.filter((t) => t.includes.includes(a.code)).map((t) => t.name).join(', ') || <span className="small muted">Paid in every plan</span>}</td></tr>)}</tbody></table></div></div>)}
    </Card>
    <Card title="Costs, margin and discount rules" right={<span className="small muted">internal</span>}>
      <div className="grid g3">
        <div><h3>Running cost per student a year</h3><table className="t"><tbody>{rc.tiers.map((t) => <tr key={t.code}><td>{t.name} (cloud, email, support)</td><td style={{ textAlign: 'right' }}>{rupees(t.runCost)}</td></tr>)}<tr><td>Data storage</td><td style={{ textAlign: 'right' }}>{rupees(rc.storage.cost)}</td></tr></tbody></table></div>
        <div><h3>Overheads (% of list price)</h3><table className="t"><tbody>{Object.entries(rc.economics.overheads).map(([k, v]) => <tr key={k}><td>{OVERHEAD_NAMES[k]}</td><td style={{ textAlign: 'right' }}>{v}%</td></tr>)}</tbody></table></div>
        <div><h3>Margin and discount</h3><table className="t"><tbody>
          <tr><td>Industry gross margin (SaaS)</td><td style={{ textAlign: 'right' }}>{rc.economics.industryMargin[0]}–{rc.economics.industryMargin[1]}%</td></tr>
          <tr><td>Profit kept at least</td><td style={{ textAlign: 'right' }}>{rc.economics.profitFloor}%</td></tr>
          <tr><td>Sales can give, without approval</td><td style={{ textAlign: 'right' }}>{rc.salesDiscount}%</td></tr>
          <tr><td>Never more than</td><td style={{ textAlign: 'right' }}>{rc.maxDiscount}%</td></tr></tbody></table></div>
      </div>
      <p className="small muted">Each proposal works out its own maximum discount: the most it can take while profit stays at the floor after running cost and overheads.</p>
    </Card>
    {!can && <p className="small muted">Only the platform team and the Admin can change prices. You can see them and use them in proposals.</p>}
  </Page>;
}

function EditPrices({ rc: start, back }) {
  const { run, notify } = useStore();
  const [rc, setRc] = useState(() => structuredClone(start));
  const dirty = JSON.stringify(rc) !== JSON.stringify(start);
  const num = (v, on, label, w = 90) => <Input type="number" step="any" min="0" aria-label={label} value={v ?? ''} onChange={(e) => on(e.target.value === '' ? undefined : +e.target.value)} style={{ width: w }} />;
  const setTier = (i, f) => setRc({ ...rc, tiers: rc.tiers.map((t, j) => (j === i ? f(structuredClone(t)) : t)) });
  const setAddon = (i, k, v) => setRc({ ...rc, addons: rc.addons.map((a, j) => (j === i ? { ...a, [k]: v } : a)) });
  const save = () => {
    if (rc.tiers.some((t) => t.rates.some((r) => !(r > 0)))) { notify('Every band needs a price above zero — no plan is free'); return; }
    if (rc.addons.some((a) => !(a.rate > 0))) { notify('Every add-on needs a price above zero'); return; }
    run((d) => { d.provider.rateCard = { ...rc, version: Math.max(2, rc.version) }; d.provider.priceVersion = (d.provider.priceVersion || 1) + 1; });
    notify('Prices saved — proposals use them straight away'); back();
  };
  return <Page title="Edit prices" sub="Change plan rates, add-on prices and costs. Nothing can be free: every price must be above zero."
    actions={<><button className="btn" onClick={back}>Back to Pricing</button><button className="btn pri" disabled={!dirty} onClick={save}>Save prices</button></>}>
    <Card title="Plans: price per student a year, by band"><div className="tw"><table className="t"><thead><tr><th>Plan</th>{rc.bands.map((b) => <th key={b[0]}>{bandLabel(b)}</th>)}<th>Running cost / student</th>{rc.development.map((d) => <th key={d.code}>{d.code === 'WEB_DESIGN' ? 'Web page design' : 'Database set-up'}</th>)}</tr></thead>
      <tbody>{rc.tiers.map((t, i) => <tr key={t.code}><td className="b">{t.name}</td>{t.rates.map((r, k) => <td key={k}>{num(r, (v) => setTier(i, (x) => { x.rates[k] = v; return x; }), `${t.name} rate ${bandLabel(rc.bands[k])}`)}</td>)}
        <td>{num(t.runCost, (v) => setTier(i, (x) => ({ ...x, runCost: v })), `${t.name} running cost`)}</td>
        {rc.development.map((d, k) => <td key={d.code}>{num(d.price[t.code], (v) => setRc({ ...rc, development: rc.development.map((x, j) => (j === k ? { ...x, price: { ...x.price, [t.code]: v } } : x)) }), `${t.name} ${d.code}`)}</td>)}</tr>)}</tbody></table></div>
      <div className="form" style={{ marginTop: 10 }}>
        <Field label="Minimum students billed">{num(rc.minStudents, (v) => setRc({ ...rc, minStudents: v }), 'Minimum students billed')}</Field>
        <Field label="Data storage per student a year">{num(rc.storage.rate, (v) => setRc({ ...rc, storage: { ...rc.storage, rate: v } }), 'Storage price')}</Field>
        <Field label="Storage cost per student a year">{num(rc.storage.cost, (v) => setRc({ ...rc, storage: { ...rc.storage, cost: v } }), 'Storage cost')}</Field>
      </div></Card>
    <Card title="Add-ons"><div className="tw"><table className="t"><thead><tr><th>Add-on</th><th>Per</th><th>Price a year</th><th>Minimum</th><th>One-time</th><th>Our cost per unit a year</th><th>Included in</th></tr></thead>
      <tbody>{rc.addons.map((a, i) => <tr key={a.code}><td className="b">{a.name}</td><td>{UNIT[a.unit]}</td><td>{num(a.rate, (v) => setAddon(i, 'rate', v), `${a.name} price`)}</td>
        <td>{a.unit === 'school' ? '—' : a.unit === 'bus' ? <>{num(a.minQty, (v) => setAddon(i, 'minQty', v), `${a.name} minimum buses`, 60)} buses</> : num(a.min, (v) => setAddon(i, 'min', v), `${a.name} minimum`)}</td>
        <td>{a.setup !== undefined ? num(a.setup, (v) => setAddon(i, 'setup', v), `${a.name} one-time`) : '—'}</td>
        <td>{a.provider === 'No service needed' ? <Pill kind="ok">No service needed (₹0)</Pill> : num(a.cost, (v) => setAddon(i, 'cost', v), `${a.name} cost`)}</td>
        <td><div className="row">{rc.tiers.map((t, k) => <label key={t.code} className="row small"><input type="checkbox" checked={t.includes.includes(a.code)} onChange={(e) => setTier(k, (x) => ({ ...x, includes: e.target.checked ? [...x.includes, a.code] : x.includes.filter((c) => c !== a.code) }))} />{t.name}</label>)}</div></td></tr>)}</tbody></table></div></Card>
    <Card title="Margin and discount rules"><div className="form">
      {Object.entries(rc.economics.overheads).map(([k, v]) => <Field key={k} label={`${OVERHEAD_NAMES[k]} (% of list price)`}>{num(v, (x) => setRc({ ...rc, economics: { ...rc.economics, overheads: { ...rc.economics.overheads, [k]: x } } }), OVERHEAD_NAMES[k])}</Field>)}
      <Field label="Profit kept at least (%)">{num(rc.economics.profitFloor, (v) => setRc({ ...rc, economics: { ...rc.economics, profitFloor: v } }), 'Profit floor')}</Field>
      <Field label="Discount sales can give (%)">{num(rc.salesDiscount, (v) => setRc({ ...rc, salesDiscount: v }), 'Sales discount')}</Field>
      <Field label="Highest discount allowed (%)">{num(rc.maxDiscount, (v) => setRc({ ...rc, maxDiscount: v }), 'Highest discount')}</Field>
    </div></Card>
  </Page>;
}

// ================================================================ Proposal Builder
function EmailProposal({ p, rc, profile, onClose }) {
  const { run, notify, session } = useStore();
  const o = p.options;
  const q = quote(rc, o);
  const [f, setF] = useState(() => ({
    to: o.poc?.email || '', cc: profile.email,
    subject: `Proposal ${p.no}: ${profile.product} for ${o.client}`,
    body: `Dear ${o.poc?.name || 'Sir / Madam'},\n\nThank you for meeting us. Please find attached our proposal for ${o.client}: the ${q.tier.name} plan for ${q.students} students at ${rupees(q.recurring)} a year (${rupees(q.yearOneTotal)} in year one including one-time development and GST).\n\nWe would be glad to set up a demo for your team or answer any questions. Please contact ${profile.contact} on ${profile.phone} or reply to this email.\n\nWarm regards,\n${session.name}\n${profile.name}\n${profile.phone} · ${profile.email}`
  }));
  const send = async () => {
    if (!okEmail(f.to)) { notify('Enter a valid email ID for the client'); return; }
    let size = 0; let name = `${p.no}.pdf`;
    try { const m = await import('../lib/proposalPdf.js'); const bytes = m.proposalPdfBytes({ proposal: p, rc, profile }); size = bytes.byteLength; name = m.proposalFileName(p); } catch (e) { /* PDF made when sent in production */ }
    run((d) => {
      const x = d.provider.proposals.find((y) => y.id === p.id);
      d.outbox.unshift({ id: 'M' + (d.outbox.length + 1) + '-' + Math.random().toString(36).slice(2, 6), to: f.to + (f.cc ? `, cc ${f.cc}` : ''), kind: 'Proposal', status: 'SENT', at: new Date().toISOString(), related: x.no,
        subject: f.subject, body: f.body.split('\n').map((l) => `<p>${l.replace(/</g, '&lt;') || '&nbsp;'}</p>`).join('') + `<p><b>Attached:</b> ${name} (${Math.max(1, Math.round(size / 1024))} KB)</p>`, attachment: { name, size } });
      x.status = x.status === 'Draft' ? 'Sent' : x.status; x.sent = [...(x.sent || []), { to: f.to, at: new Date().toISOString(), by: session.name }];
    });
    notify(`Proposal emailed to ${f.to} with the PDF attached`); onClose();
  };
  return <Modal title={`Email proposal ${p.no}`} onClose={onClose} actions={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn pri" onClick={send}>Send email</button></>}>
    <div className="form">
      <Field label="To" req full><Input type="email" aria-label="Email to" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
      <Field label="Cc" full><Input aria-label="Email cc" value={f.cc} onChange={(e) => setF({ ...f, cc: e.target.value })} /></Field>
      <Field label="Subject" full><Input aria-label="Subject" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></Field>
      <Field label="Message" full><textarea className="i" aria-label="Message" rows={10} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} style={{ fontFamily: 'inherit' }} /></Field>
    </div>
    <p className="small muted">The proposal PDF is attached. The email is recorded in Settings → Email &amp; SMS Outbox and the proposal is marked Sent.</p>
  </Modal>;
}

function PdfPreview({ p, rc, profile, onClose }) {
  const [url, setUrl] = useState(null);
  useEffect(() => { import('../lib/proposalPdf.js').then((m) => setUrl(m.buildProposalPdf({ proposal: p, rc, profile }).output('bloburl'))).catch(() => setUrl('')); }, [p, rc, profile]);
  return <Modal title={`Proposal ${p.no} (PDF)`} onClose={onClose} actions={<button className="btn pri" onClick={() => downloadPdf(p, rc, profile)}>Download PDF</button>}>
    {url ? <iframe title="Proposal PDF" src={String(url)} style={{ width: '100%', height: '70vh', border: '1px solid var(--line)' }} /> : <p className="muted">{url === '' ? 'The preview could not be made here; use Download PDF.' : 'Making the PDF…'}</p>}
  </Modal>;
}
const downloadPdf = (p, rc, profile) => import('../lib/proposalPdf.js').then((m) => m.downloadProposalPdf({ proposal: p, rc, profile })).catch(() => {});

function ProposalEditor({ id, back, go }) {
  const { db, run, notify, session } = useStore();
  const rc = rcOf(db); const profile = profileOf(db);
  const p = db.provider.proposals.find((x) => x.id === id);
  const [modal, setModal] = useState(null);
  const o = p.options;
  const q = useMemo(() => quote(rc, o), [rc, o]);
  const set = (options) => run((d) => saveOptions(d, id, options));
  const ready = () => { const miss = proposalProblems(o); if (miss.length) { notify('Fill in: ' + miss.join(', ')); return false; } return true; };
  const demo = p.demoId && db.tenants.find((t) => t.id === p.demoId);
  return <Page title={`Proposal ${p.no}${o.client ? ' · ' + o.client : ''}`} sub="Choices save as you go. The Demo Builder uses the same choices, so the demo always matches this proposal."
    actions={<><button className="btn" onClick={back}>Back to proposals</button><button className="btn" onClick={() => ready() && setModal('pdf')}>Preview PDF</button><button className="btn" onClick={() => ready() && downloadPdf(p, rc, profile)}>Download PDF</button>
      <button className="btn" onClick={() => { stash('sp-demo-from', id); go('SP_DEMO'); }}>{demo ? 'Open demo' : 'Build demo'}</button><button className="btn pri" onClick={() => ready() && setModal('email')}>Email proposal</button></>}>
    <div className="grid g-side"><div>
      <ClientFields o={o} set={set} />
      <Card title="Plan"><TierCards rc={rc} value={o.tier} students={+o.students || 0} onChoose={(tier) => set({ ...o, tier })} /></Card>
      <Card title="Add-ons"><AddonPicker rc={rc} o={o} set={set} /></Card>
      <Card title="Hosting, discount and GST"><div className="form">
        <Field label="Hosting"><Select aria-label="Hosting" value={o.hosting} onChange={(e) => set({ ...o, hosting: e.target.value })} options={rc.hosting.map((h) => [h.code, h.name])} /></Field>
        <DiscountField o={o} set={set} q={q} />
        <label className="row small"><input type="checkbox" checked={!!o.interState} onChange={(e) => set({ ...o, interState: e.target.checked })} /> School is in another state (IGST)</label>
        <label className="row small"><input type="checkbox" checked={o.showInternal === true} onChange={(e) => set({ ...o, showInternal: e.target.checked })} /> Internal copy: include margin, profit and operating cost in the PDF</label>
      </div></Card>
    </div><div className="sticky-side"><PriceSummary rc={rc} q={q} />
      <Card title="Status"><Select aria-label="Proposal status" value={p.status} onChange={(e) => { const v = e.target.value; if (v === 'Won' && !p.projectId) { if (!ready()) return; try { run((d) => dlv.convertProposal(d, id, session.name)); notify('Won: converted to a client — school, documents and links are ready in Client Delivery'); } catch (err) { notify(err.message); } return; } run((d) => { d.provider.proposals.find((x) => x.id === id).status = v; }); }} options={PROPOSAL_STATUS} />
        {p.projectId ? <button className="btn sm pri" style={{ marginTop: 8 }} onClick={() => { stash('sp-open-project', p.projectId); go('SP_DELIVERY'); }}>Open client delivery</button>
          : <button className="btn sm" style={{ marginTop: 8 }} onClick={() => { if (!ready()) return; try { const pr = run((d) => dlv.convertProposal(d, id, session.name)); notify(`Converted to client ${pr.no}`); stash('sp-open-project', pr.id); go('SP_DELIVERY'); } catch (err) { notify(err.message); } }}>Convert to client</button>}
        {(p.sent || []).map((s) => <div key={s.at} className="small muted" style={{ marginTop: 4 }}>Emailed to {s.to} · {dmy(s.at)} · {s.by}</div>)}
        {demo && <div className="small" style={{ marginTop: 6 }}>Demo school: <b>{demo.name}</b> (updates with this proposal)</div>}</Card>
    </div></div>
    {modal === 'pdf' && <PdfPreview p={p} rc={rc} profile={profile} onClose={() => setModal(null)} />}
    {modal === 'email' && <EmailProposal p={p} rc={rc} profile={profile} onClose={() => setModal(null)} />}
  </Page>;
}

export function ProposalBuilder({ go, menus }) {
  const { db, run, session } = useStore();
  const rc = rcOf(db);
  const list = db.provider?.proposals || [];
  const [open, setOpen] = useState(() => { const tier = unstash('sp-new-tier'); const id = unstash('sp-open-proposal'); return id && list.some((p) => p.id === id) ? id : tier ? { tier } : null; });
  const [filter, setFilter] = useState('ALL');
  const create = (tier) => { const p = run((d) => newProposal(d, { ...blankOptions(rcOf(d)), ...(tier ? { tier } : {}) }, session.name)); setOpen(p.id); };
  useEffect(() => { if (open && typeof open === 'object') create(open.tier); }, []);   // came from a plan's “Choose” button
  if (open && typeof open === 'object') return null;
  if (open && list.some((p) => p.id === open)) return <ProposalEditor id={open} back={() => setOpen(null)} go={go} />;
  const rows = list.filter((p) => filter === 'ALL' || p.status === filter);
  const yearOf = (p) => quote(rc, p.options).recurring;
  return <Page title="Proposals" sub="Build a priced proposal from a plan and add-ons, download it as a PDF or email it to the client, and track it to won or lost."
    actions={<><button className="btn" onClick={() => go('SP_RATES')}>Back to Pricing</button><button className="btn pri" onClick={() => create(null)}>New proposal</button></>}>
    <div className="kpis">{PROPOSAL_STATUS.map((st) => <Stat key={st} label={st} value={list.filter((p) => p.status === st).length} />)}</div>
    {(menus || []).some((m) => m.items.some((i) => i[0] === 'SP_ANALYTICS')) && <p className="small muted" style={{ marginTop: -6 }}>Pipeline value, won value and win rate are in <button className="linkbtn" onClick={() => go('SP_ANALYTICS')}>Service Provider › Sales Analytics</button>.</p>}
    <Card right={<Select aria-label="Status filter" value={filter} onChange={(e) => setFilter(e.target.value)} options={[['ALL', 'All'], ...PROPOSAL_STATUS]} />}>
      <div className="tw"><table className="t"><thead><tr><th>Proposal</th><th>School</th><th>Contact</th><th>Students</th><th>Plan</th><th>A year</th><th>Discount</th><th>Status</th><th /></tr></thead>
        <tbody>{rows.map((p) => { const x = quote(rc, p.options); return <tr key={p.id}><td className="b">{p.no}<div className="small muted">{dmy(p.created)} · {p.by}</div></td><td>{p.options.client || <span className="muted">Not named yet</span>}<div className="small muted">{p.options.city}</div></td>
          <td className="small">{p.options.poc?.name}<div className="muted">{p.options.poc?.email}</div></td><td>{p.options.students}</td><td>{x.tier.name}</td><td>{rupees(x.recurring)}</td><td>{x.discountPct ? pct(x.discountPct) : '—'}</td>
          <td><Pill kind={STATUS_KIND[p.status]}>{p.status}</Pill></td>
          <td><div className="row"><button className="btn sm" onClick={() => setOpen(p.id)}>Open</button>
            <button className="btn sm" onClick={() => { stash('sp-demo-from', p.id); go('SP_DEMO'); }}>{p.demoId ? 'Demo' : 'Build demo'}</button></div></td></tr>; })}</tbody></table></div>
    </Card>
  </Page>;
}

// ================================================================ Demo Builder
const DEMO_ROLES = [['PRINCIPAL', 'Principal'], ['ADMIN', 'Admin'], ['TEACHER', 'Teacher'], ['PARENT', 'Parent'], ['ACCOUNTANT', 'Accountant'], ['FRONT_OFFICE', 'Front office'], ['TRANSPORT', 'Transport team']];
// What to show, in order, for these choices: [screen, role to show it as, what to say]
export function demoScript(o, cfg) {
  const on = (c) => cfg.overrides[c] === true;
  const s = [];
  if (on('DASH')) s.push(['DASH', 'PRINCIPAL', 'Start with the dashboard: what changed this month, not just counts.']);
  s.push(['STU_ADMISSIONS', 'FRONT_OFFICE', 'An enquiry becomes an admission in a few steps.'],
    ['STU_PROFILE', 'PRINCIPAL', 'One student: details with photo, attendance, fees and marks.'],
    ['STU_ATT', 'TEACHER', 'Roll call as a register: tap present or absent.'],
    ['FEE_COLLECT', 'ACCOUNTANT', 'Collect a fee at the counter and print the receipt.'],
    ['STU_REPORTCARD', 'PRINCIPAL', 'Report cards by term or exam — print or let parents view them.']);
  if (on('STU_REQUESTS')) s.push(['STU_REQUESTS', 'TEACHER', 'Coordinator Desk: approve requests from parents in one place.']);
  if (on('STU_GATE')) s.push(['STU_GATE', 'FRONT_OFFICE', 'Gate Desk: early pick-ups and gate passes.']);
  if (on('TRN_ROUTES')) s.push(['TRN_ROUTES', 'TRANSPORT', on('FN_STOP_TIMINGS') ? 'Routes, the route map and stop timings.' : 'Routes, stops and the route map.']);
  if (on('CMP_HOMEWORK')) s.push(['CMP_HOMEWORK', 'TEACHER', 'Set homework; parents see it with their child\'s status.']);
  if (on('ACA_CURRICULUM')) s.push(['ACA_CURRICULUM', 'TEACHER', 'Curriculum plan: units by month and how much is taught.']);
  if (on('STU_PORTFOLIO')) s.push(['STU_PORTFOLIO', 'TEACHER', 'A student\'s portfolio of best work.']);
  if (on('FN_BOARD')) s.push(['EXM_COSCH', 'PRINCIPAL', 'Board integration: pick the board; grades follow it.']);
  if (on('OPS_BACKUP')) s.push(['OPS_BACKUP', 'ADMIN', 'Backups: nightly backups and restore.']);
  if (on('ANL_HOME')) s.push(['ANL_HOME', 'PRINCIPAL', 'Data analytics: the report catalogue.']);
  s.push(['SELF_CHILD', 'PARENT', 'The parent view on the free phone app: child, fees, notices.']);
  return s;
}

export function DemoBuilder({ go }) {
  const { db, run, notify, session, login } = useStore();
  const rc = rcOf(db);
  const proposals = db.provider?.proposals || [];
  const demos = db.tenants.filter((t) => t.demo);
  const [src, setSrc] = useState(() => { const id = unstash('sp-demo-from'); return id && proposals.some((p) => p.id === id) ? id : proposals[0]?.id || ''; });
  const [editProv, setEditProv] = useState(false);
  const p = proposals.find((x) => x.id === src);
  const profile = profileOf(db);
  if (!p) return <Page title="Demo builder" sub="Set up a demo school for a client visit."><Card><button className="btn pri" onClick={() => { const x = run((d) => newProposal(d, blankOptions(rcOf(d)), session.name)); setSrc(x.id); }}>Start a new client</button></Card></Page>;
  const o = p.options;
  const q = quote(rc, o);
  const set = (options) => run((d) => saveOptions(d, p.id, options));
  const tenant = p.demoId && db.tenants.find((t) => t.id === p.demoId);
  const setProfile = (k, v) => run((d) => { d.provider.profile = { ...profileOf(d), [k]: v }; });
  const create = () => {
    if (!String(o.client).trim()) { notify('Enter the school name'); return; }
    const t = run((d) => makeDemo(d, p.id, session)); notify(`Demo school ${t.name} is ready`);
  };
  const present = (tenantId, role) => {
    const u = db.users.find((x) => x.role === role && x.status === 'ACTIVE' && !['Vice Principal', 'Head of Teaching Staff'].includes(x.designation));
    if (!u) { notify('No demo user for that role'); return; }
    run((d) => { d.provider.returnTenant = d.provider.returnTenant || d.tenantId; d.provider.presenter = { userId: session.userId, role: session.role, name: session.name }; d.tenantId = tenantId; });
    login({ role: u.role, userId: u.id, name: u.name });
    notify(`Showing the demo as ${u.name} — use “End demo” at the top to come back`);
  };
  const remove = (id) => { run((d) => { if (d.tenantId === id) d.tenantId = d.provider.returnTenant || 'T1'; d.tenants = d.tenants.filter((t) => t.id !== id); d.provider.demos = (d.provider.demos || []).filter((x) => x !== id); d.provider.proposals.forEach((x) => { if (x.demoId === id) delete x.demoId; }); }); notify('Demo school removed'); };
  return <Page title="Demo builder" sub="Four short steps. Everything you pick here updates the linked proposal straight away, and the demo school follows it."
    actions={<><button className="btn" onClick={() => { const x = run((d) => newProposal(d, blankOptions(rcOf(d)), session.name)); setSrc(x.id); }}>New client</button>
      <button className="btn" onClick={() => { stash('sp-open-proposal', p.id); go('SP_PROPOSAL'); }}>Open proposal {p.no}</button></>}>
    <div className="row" style={{ marginBottom: 10, flexWrap: 'wrap' }}>
      <Field label="Client"><Select aria-label="Client" value={src} onChange={(e) => setSrc(e.target.value)} options={proposals.map((x) => [x.id, `${x.options.client || 'New client'} · ${x.no} · ${tierOf(rc, x.options.tier).name}`])} /></Field>
      <span className="small muted" style={{ alignSelf: 'end', paddingBottom: 8 }}>Linked to proposal <b>{p.no}</b> · changes save as you go</span>
    </div>
    <div className="grid g-side"><div>
      <Card title="1. Service provider" right={<button className="btn sm" onClick={() => setEditProv(!editProv)}>{editProv ? 'Done' : 'Change'}</button>}>
        {editProv ? <div className="form">
          {[['name', 'Company'], ['product', 'Product'], ['contact', 'Contact person'], ['designation', 'Designation'], ['email', 'Email ID'], ['phone', 'Contact number'], ['website', 'Website'], ['city', 'City']].map(([k, l]) =>
            <Field key={k} label={l}><Input aria-label={'Provider ' + l} value={profile[k] || ''} onChange={(e) => setProfile(k, e.target.value)} /></Field>)}
          <Field label="About us (opens the proposal)" full><textarea className="i" rows={3} aria-label="About us" value={profile.about} onChange={(e) => setProfile('about', e.target.value)} style={{ fontFamily: 'inherit' }} /></Field>
        </div> : <div className="provider-card"><b>{profile.name}</b><div className="small">{profile.contact}, {profile.designation} · {profile.email} · {profile.phone}</div><div className="small muted">{profile.website} · {profile.city}</div></div>}
      </Card>
      <ClientFields o={o} set={set} title="2. Client and point of contact" />
      <Card title="3. Plan"><TierCards compact rc={rc} value={o.tier} students={+o.students || 0} onChoose={(tier) => set({ ...o, tier })} /></Card>
      <Card title="4. Add-ons and discount"><AddonPicker rc={rc} o={o} set={set} /><div className="form" style={{ marginTop: 10 }}><DiscountField o={o} set={set} q={q} /></div></Card>
    </div><div className="sticky-side">
      <Card title="Demo school">
        {tenant ? <><p className="small">{tenant.name} is set up as <b>{tierOf(rc, o.tier).name}</b> with {activeAddons(rc, o).length} add-ons on. It changes with every choice you make here.</p>
          <div className="row" style={{ flexWrap: 'wrap' }}>{DEMO_ROLES.map(([r, l]) => <button key={r} className="btn sm" onClick={() => present(tenant.id, r)}>Open as {l}</button>)}</div></>
          : <><p className="small">Creates <b>{(o.client || 'Demo school').replace(/\s*\(example\)$/, '')} (demo)</b> with exactly these screens, using fictional students and staff.</p><button className="btn pri" onClick={create}>Create demo school</button></>}
      </Card>
      <PriceSummary rc={rc} q={q} compact />
      {tenant && <Card title="Demo script"><ol className="small">{demoScript(o, { overrides: tenant.overrides }).map(([code, role, say]) => <li key={code} style={{ marginBottom: 5 }}><b>{LABEL[code]}</b> <span className="muted">as {DEMO_ROLES.find((x) => x[0] === role)?.[1]}</span> — {say}</li>)}</ol></Card>}
    </div></div>
    <Card title={`Demo schools (${demos.length})`}>{demos.length ? <div className="tw"><table className="t"><thead><tr><th>Demo school</th><th>Client</th><th>Plan</th><th>Created</th><th /></tr></thead>
      <tbody>{demos.map((t) => <tr key={t.id}><td className="b">{t.name}<div className="small muted">code {t.code}</div></td><td>{t.demo.client}</td><td>{t.demo.tier}</td><td>{dmy(t.demo.created)} · {t.demo.by}</td>
        <td><div className="row">{t.demo.proposalId && proposals.some((x) => x.id === t.demo.proposalId) && <button className="btn sm" onClick={() => setSrc(t.demo.proposalId)}>Select</button>}<button className="btn sm" onClick={() => remove(t.id)}>Remove</button></div></td></tr>)}</tbody></table></div> : <p className="muted">No demo schools yet.</p>}</Card>
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
  const [tier, setTier] = useState('PRO');
  const [region, setRegion] = useState('India');
  const [group, setGroup] = useState('ALL');
  const students = Math.max(1, +n || 1);
  const ours = quote(rc, { ...blankOptions(rc), students, tier });
  const provs = PROVIDERS.filter((p) => p.us || region === 'ALL' || p.region === region);
  const priceOf = (p) => (p.us ? [ours.recurring, ours.recurring] : priceRange(p, students));
  const others = PROVIDERS.filter((p) => !p.us);
  const known = (code) => others.filter((p) => mark(p, code) !== '?');
  const edge = FEATURES.filter(([c]) => mark(PROVIDERS[0], c) === 'Y' && known(c).length >= 2 && known(c).filter((p) => mark(p, c) === 'Y').length / known(c).length < 0.5);
  const unique = FEATURES.filter(([c]) => mark(PROVIDERS[0], c) === 'Y' && !others.some((p) => mark(p, c) === 'Y'));
  const gaps = FEATURES.filter(([c]) => mark(PROVIDERS[0], c) !== 'Y' && others.some((p) => mark(p, c) === 'Y'));
  const priced = PROVIDERS.filter((p) => !p.us && priceOf(p)).map((p) => [p, (priceOf(p)[0] + priceOf(p)[1]) / 2]);
  const cheaper = priced.filter(([, v]) => v < ours.recurring).length;
  const feats = FEATURES.filter((f) => group === 'ALL' || f[2] === group);
  return <Page title="Competition comparison" sub={`What we offer against Indian and global school software, with an estimated yearly price at the top for a school of the size you enter. Public prices as of ${dmy(AS_OF)}.`}>
    <div className="row" style={{ marginBottom: 10, flexWrap: 'wrap' }}>
      <Field label="Students"><Input type="number" min="1" aria-label="Students" value={n} onChange={(e) => setN(e.target.value)} style={{ width: 110 }} /></Field>
      <Field label="Our plan"><Select aria-label="Our plan" value={tier} onChange={(e) => setTier(e.target.value)} options={rc.tiers.map((x) => [x.code, x.name])} /></Field>
      <Field label="Providers"><Select aria-label="Providers" value={region} onChange={(e) => setRegion(e.target.value)} options={[['India', 'Indian'], ['Global', 'Global'], ['ALL', 'All']]} /></Field>
      <Field label="Features"><Select aria-label="Feature group" value={group} onChange={(e) => setGroup(e.target.value)} options={[['ALL', 'All features'], ...[...new Set(FEATURES.map((f) => f[2]))]]} /></Field>
    </div>
    <div className="grid g3">
      <Card title="Our edge"><p className="small muted">We offer these; fewer than half the competitors that mention the feature offer it. “None listed”: no competitor page we read mentions it — check before claiming it in a pitch.</p><ul className="small">{[...new Set([...unique, ...edge])].map(([c, l]) => <li key={c}>{l}{unique.some((u) => u[0] === c) && <> <Pill kind="ok">None listed</Pill></>}</li>)}</ul></Card>
      <Card title="Gaps to close"><p className="small muted">At least one competitor offers these and we don't (or only as an add-on).</p><ul className="small">{gaps.map(([c, l]) => <li key={c}>{l} — {others.filter((p) => mark(p, c) === 'Y').map((p) => p.name).join(', ')}</li>)}</ul></Card>
      <Card title="Price position"><p>For {students} students our {ours.tier.name} tier costs <b>{rupees(ours.recurring)}</b> a year ({rupees(ours.perStudentYear)} per student) before add-ons.</p>
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
  const rows = ROADMAP.map((r) => ({ ...r, ...(saved.find((x) => x.code === r.code) || {}), status: saved.find((x) => x.code === r.code)?.status || (r.backlog ? 'Backlog' : 'Idea') }));
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

// ================================================================ Client Delivery (release 14.1)
const LINK_KIND = { Placeholder: 'warn', Planned: '', Ready: 'info', Shared: 'ok' };
function DocPreview({ d }) {
  return <div className="doc">
    <h1 style={{ marginBottom: 2 }}>{d.title}</h1><p className="muted">{d.client} · {d.projectNo} · version {d.version} · {dlv.dmy(d.date)}</p>
    {d.sections.map((s) => <div key={s.h}><h2>{s.h}</h2>{s.p && <p>{s.p}</p>}{s.bullets && <ul>{s.bullets.map((b) => <li key={b}>{b}</li>)}</ul>}
      {s.table && <div className="tw"><table className="t">{s.table.cols.some(Boolean) && <thead><tr>{s.table.cols.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>}<tbody>{s.table.rows.map((r, i) => <tr key={i}>{r.map((c, k) => <td key={k} className={k === 0 && !s.table.cols[0] ? 'b' : 'small'} style={{ wordBreak: 'break-all' }}>{c}</td>)}</tr>)}</tbody></table></div>}</div>)}
  </div>;
}
const copyText = (t, notify) => { try { navigator.clipboard.writeText(t).then(() => notify('Link copied'), () => notify('Copy blocked here — select the link and copy it')); } catch (e) { notify('Copy blocked here — select the link and copy it'); } };

function ProjectView({ id, back }) {
  const { db, run, notify, session } = useStore();
  const profile = profileOf(db);
  const project = db.provider.projects.find((x) => x.id === id);
  const tenant = db.tenants.find((t) => t.id === project.tenantId);
  const [tab, setTab] = useState('links');
  const [edit, setEdit] = useState(null);       // link being edited
  const [view, setView] = useState(null);       // document code being previewed
  const [share, setShare] = useState(null);
  const changed = dlv.proposalChanged(db, project);
  const act = (fn, msg) => { try { run(fn); notify(msg); return true; } catch (e) { notify(e.message); return false; } };
  const html = useMemo(() => dlv.websiteHtml(db, project), [db, project]);
  const ready = project.links.filter((l) => ['Ready', 'Shared'].includes(l.status)).length;
  const docOf = (c) => dlv.buildDoc(db, project, c);
  const pdf = (c) => import('../lib/docPdf.js').then((m) => m.downloadDocPdf(docOf(c), profile)).catch((e) => notify(e.message || 'The PDF could not be saved'));
  return <Page title={`${project.client} · ${project.no}`} sub={`Converted from ${project.proposalNo} on ${dlv.dmy(project.created)}. ${project.tierName} plan · school code ${tenant.code} · version ${project.version} (${dlv.dmy(project.updated)}).`}
    actions={<><button className="btn" onClick={back}>Back to clients</button><button className="btn pri" onClick={() => setShare({ to: project.options.poc?.email || '', cc: profile.email, links: project.links.filter((l) => l.group === 'Testing').map((l) => l.code), docs: ['UAT', 'LINKS'], message: `Dear ${project.options.poc?.name || 'Sir / Madam'},\n\nThank you for choosing ${profile.product}. Please find below the links for testing your school's set-up, and the documents for this version. Do get in touch with any questions.` })}>Share with customer</button></>}>
    {changed && <div className="ro-bar" role="status" style={{ marginBottom: 10 }}>The proposal has changed since version {project.version}. <button className="btn sm pri" onClick={() => act((d) => dlv.regenerate(d, id, session.name), `Version ${dlv.bumpVersion(project.version)}: school, documents and links brought up to date`)}>Regenerate as version {dlv.bumpVersion(project.version)}</button></div>}
    <div className="kpis">
      <Stat label="Status" value={<Select aria-label="Project status" value={project.status} onChange={(e) => act((d) => { const p = d.provider.projects.find((x) => x.id === id); p.status = e.target.value; d.tenants.find((t) => t.id === p.tenantId).status = e.target.value === 'Live' ? 'Active' : e.target.value; p.log.unshift({ at: new Date().toISOString(), by: session.name, what: 'Status: ' + e.target.value }); }, 'Status: ' + e.target.value)} options={dlv.PROJECT_STATUS} />} />
      <Stat label="Version" value={project.version} sub={dlv.dmy(project.updated)} />
      <Stat label="Links live" value={`${ready} / ${project.links.length}`} sub={`${project.links.filter((l) => l.status === 'Planned').length} planned · ${project.links.filter((l) => l.status === 'Placeholder').length} placeholders to fill`} />
      <Stat label="Shared with the customer" value={project.shares.length} sub={project.shares[0] ? dlv.dmy(project.shares[0].at) : 'not yet'} />
    </div>
    <Tabs tabs={[['links', 'Links'], ['docs', `Documents (${dlv.DOC_TYPES.length})`], ['site', 'Website'], ['log', 'History']]} value={tab} onChange={setTab} />
    {tab === 'links' && dlv.LINK_GROUPS.map((g) => <Card key={g} title={g}>
      <div className="tw"><table className="t"><thead><tr><th>Link</th><th>Environment</th><th>Address</th><th>Version</th><th>Date</th><th>Status</th><th /></tr></thead>
        <tbody>{project.links.filter((l) => l.group === g).map((l) => <tr key={l.code}><td className="b">{l.label}{l.note && <div className="small muted">{l.note}</div>}</td><td>{l.env}</td>
          <td className="small" style={{ wordBreak: 'break-all', maxWidth: 380 }}>{['Placeholder', 'Planned'].includes(l.status) ? <span className="muted">{l.url}</span> : <a href={l.url} target="_blank" rel="noreferrer">{l.url.length > 90 ? l.url.slice(0, 87) + '…' : l.url}</a>}{l.history?.length > 0 && <div className="muted">{l.history.length} earlier version{l.history.length > 1 ? 's' : ''}</div>}</td>
          <td>{l.version}</td><td>{dlv.dmy(l.date)}</td><td><Pill kind={LINK_KIND[l.status]}>{l.status}</Pill></td>
          <td><div className="row">{l.status !== 'Placeholder' && <button className="btn sm" onClick={() => copyText(l.url, notify)}>Copy</button>}{l.status === 'Planned' && <button className="btn sm" onClick={() => act((d) => dlv.setLink(d, id, l.code, { url: l.url, version: project.version, note: l.note }, session.name), `${l.label}: marked live`)}>Mark live</button>}{!l.auto && <button className="btn sm" onClick={() => setEdit({ code: l.code, url: l.url, version: l.version === '—' ? project.version : l.version, note: l.note || '', live: true })}>{l.status === 'Placeholder' ? 'Fill in' : 'Edit'}</button>}</div></td></tr>)}</tbody></table></div>
      {g === 'Testing' && <p className="small muted">The test build link carries the school's set-up, so the customer opens exactly what was sold (with demo data) in their own browser. It changes with each version.</p>}
      {g === 'Mobile' && <p className="small muted">{project.options.addons?.BRANDED_APP ? `Branded app ${'com.yourapp.'}…: fill in the store links once the builds are uploaded to internal testing and TestFlight.` : 'Shared app: the store links are the shared app’s; parents enter the school code.'}</p>}
    </Card>)}
    {tab === 'docs' && <Card title="Documents" right={<span className="small muted">Generated from the proposal and this project. Version {project.version}.</span>}>
      <div className="tw"><table className="t"><thead><tr><th>Document</th><th>Version</th><th>Date</th><th /></tr></thead>
        <tbody>{dlv.DOC_TYPES.map(([c, t]) => { const m = project.documents.find((d) => d.code === c); return <tr key={c}><td className="b">{t}</td><td>{m.version}</td><td>{dlv.dmy(m.date)}</td>
          <td><div className="row"><button className="btn sm" onClick={() => setView(c)}>Preview</button><button className="btn sm" onClick={() => pdf(c)}>Download PDF</button></div></td></tr>; })}</tbody></table></div></Card>}
    {tab === 'site' && <Card title="Starter website page" right={<div className="row"><button className="btn sm" onClick={() => saveFile(`${tenant.subdomain}-website-v${project.version}.html`, html).catch(() => {})}>Download HTML</button></div>}>
      <p className="small muted">Generated for version {project.version} with the school's name, admissions, parent sign-in and app buttons. Buttons whose link is still a placeholder are greyed until it is filled in. Upload it to the school's website hosting, or send it to the school's web designer.</p>
      <iframe title="Website preview" srcDoc={html} sandbox="" style={{ width: '100%', height: 560, border: '1px solid var(--line)', borderRadius: 8 }} /></Card>}
    {tab === 'log' && <Card title="History"><ul className="small">{project.log.map((l, i) => <li key={i}>{new Date(l.at).toLocaleString('en-IN')} · {l.by} · {l.what}</li>)}</ul>
      {project.shares.length > 0 && <><h3>Shared</h3><div className="tw"><table className="t"><thead><tr><th>When</th><th>To</th><th>Version</th><th>Links</th><th>Documents</th></tr></thead><tbody>{project.shares.map((s, i) => <tr key={i}><td>{dlv.dmy(s.at)}</td><td>{s.to}</td><td>{s.version}</td><td>{s.links.length}</td><td>{s.docs.length}</td></tr>)}</tbody></table></div></>}</Card>}
    {edit && <Modal title="Link" onClose={() => setEdit(null)} actions={<button className="btn pri" onClick={() => { if (act((d) => dlv.setLink(d, id, edit.code, edit, session.name), 'Link saved')) setEdit(null); }}>Save</button>}>
      <p className="small">{project.links.find((l) => l.code === edit.code).label}</p>
      <div className="form"><Field label="Address" full><Input aria-label="Link address" value={edit.url} onChange={(e) => setEdit({ ...edit, url: e.target.value })} /></Field>
        <Field label="Version"><Input aria-label="Link version" value={edit.version} onChange={(e) => setEdit({ ...edit, version: e.target.value })} /></Field>
        <Field label="Note" full><Input aria-label="Link note" value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} placeholder="e.g. build 14, uploaded to internal testing" /></Field>
        <label className="row small"><input type="checkbox" checked={edit.live} onChange={(e) => setEdit({ ...edit, live: e.target.checked })} /> This link is live now (otherwise it stays Planned)</label></div>
      <p className="small muted">Replace the part in &lt; &gt; with the real value. The old address is kept in the link's history with its version and date.</p></Modal>}
    {view && <Modal title={dlv.DOC_TYPES.find((d) => d[0] === view)[1]} onClose={() => setView(null)} actions={<button className="btn pri" onClick={() => pdf(view)}>Download PDF</button>}><DocPreview d={docOf(view)} /></Modal>}
    {share && <Modal title={`Share with ${project.client}`} onClose={() => setShare(null)} actions={<><button className="btn" onClick={() => setShare(null)}>Cancel</button><button className="btn pri" onClick={() => { if (act((d) => dlv.shareWithCustomer(d, id, { to: share.to, cc: share.cc, linkCodes: share.links, docCodes: share.docs, message: share.message }, session.name), `Sent to ${share.to}`)) setShare(null); }}>Send email</button></>}>
      <div className="form"><Field label="To" req><Input type="email" aria-label="Share to" value={share.to} onChange={(e) => setShare({ ...share, to: e.target.value })} /></Field><Field label="Cc"><Input aria-label="Share cc" value={share.cc} onChange={(e) => setShare({ ...share, cc: e.target.value })} /></Field>
        <Field label="Message" full><textarea className="i" rows={5} aria-label="Share message" value={share.message} onChange={(e) => setShare({ ...share, message: e.target.value })} style={{ fontFamily: 'inherit' }} /></Field></div>
      <h3>Links</h3>{project.links.map((l) => <label key={l.code} className="row small"><input type="checkbox" disabled={l.status === 'Placeholder'} checked={share.links.includes(l.code)} onChange={() => setShare({ ...share, links: share.links.includes(l.code) ? share.links.filter((x) => x !== l.code) : [...share.links, l.code] })} />{l.label} <span className="muted">({l.env}{l.status === 'Placeholder' ? ', placeholder' : l.status === 'Planned' ? ', planned address' : ''})</span></label>)}
      <h3>Documents (attached as PDF)</h3>{dlv.DOC_TYPES.map(([c, t]) => <label key={c} className="row small"><input type="checkbox" checked={share.docs.includes(c)} onChange={() => setShare({ ...share, docs: share.docs.includes(c) ? share.docs.filter((x) => x !== c) : [...share.docs, c] })} />{t}</label>)}
    </Modal>}
  </Page>;
}

export function ClientDelivery({ go }) {
  const { db, run, notify, session } = useStore();
  const projects = db.provider?.projects || [];
  const won = (db.provider?.proposals || []).filter((p) => !p.projectId && p.status !== 'Lost');
  const [open, setOpen] = useState(() => { const id = unstash('sp-open-project'); return id && projects.some((p) => p.id === id) ? id : null; });
  const [pick, setPick] = useState('');
  if (open && projects.some((p) => p.id === open)) return <ProjectView id={open} back={() => setOpen(null)} />;
  const convert = (pid) => { try { const p = run((d) => dlv.convertProposal(d, pid, session.name)); notify(`${p.client} converted: school, documents and links created`); setOpen(p.id); } catch (e) { notify(e.message); } };
  return <Page title="Client delivery" sub="When a proposal is won, convert it: the school is set up as sold, the documents (scope, website, app build, hosting and AWS, data migration, testing, go-live, links) and a starter website are generated, and every link the customer and our team need is listed with its version and date."
    actions={<button className="btn" onClick={() => go('SP_PROPOSAL')}>Back to proposals</button>}>
    <Card title="Convert a proposal"><div className="row" style={{ flexWrap: 'wrap' }}>
      <Select aria-label="Proposal to convert" value={pick} onChange={(e) => setPick(e.target.value)} options={[['', 'Pick a proposal…'], ...won.map((p) => [p.id, `${p.no} · ${p.options.client || 'Not named'} · ${p.status}`])]} />
      <button className="btn pri" disabled={!pick} onClick={() => convert(pick)}>Convert to client</button>
      <span className="small muted">Marks the proposal Won. Setting a proposal to Won converts it too.</span></div></Card>
    <Card title={`Clients (${projects.length})`}>{projects.length ? <div className="tw"><table className="t"><thead><tr><th>Project</th><th>School</th><th>Plan</th><th>Version</th><th>Status</th><th>Links live</th><th>Last shared</th><th /></tr></thead>
      <tbody>{projects.map((p) => <tr key={p.id}><td className="b">{p.no}<div className="small muted">{p.proposalNo} · {dlv.dmy(p.created)}</div></td><td>{p.client}</td><td>{p.tierName}</td><td>{p.version}{dlv.proposalChanged(db, p) && <> <Pill kind="warn">Proposal changed</Pill></>}</td><td>{p.status}</td>
        <td>{p.links.filter((l) => ['Ready', 'Shared'].includes(l.status)).length} / {p.links.length}</td><td>{p.shares[0] ? dlv.dmy(p.shares[0].at) : '—'}</td><td><button className="btn sm" onClick={() => setOpen(p.id)}>Open</button></td></tr>)}</tbody></table></div> : <p className="muted">No clients yet. Convert a won proposal above.</p>}</Card>
  </Page>;
}
