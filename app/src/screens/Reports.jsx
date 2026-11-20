// Release 15.1: Data Analytics reports (Power BI-style): filters, KPIs, a chart, a drill-down table and export.
// The same component draws every report in REPORT_DEFS; each screen of Data Analytics shows its reports as tabs.
import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { useStore } from '../data/store.js';
import { Page, Card, Select, Input, Stat, Tabs } from '../components/ui.jsx';
import { REPORT_DEFS, reportsFor, defaultFilters, scopeFor, aggregate, kpis, fmtValue, monthLabel, MOVED } from '../lib/reports.js';
import { EXAMS } from '../lib/results.js';
import { SUBJECTS, ADM_STATUSES } from '../data/seed2.js';
import { DEFAULT_RATE_CARD, quote } from '../lib/pricing.js';
import { saveFile, saveWorkbook } from '../lib/saveFile.js';
import { LABEL } from '../data/menu.js';

const STATUS_OPTIONS = {
  ADM_FUNNEL: ADM_STATUSES, FEE_AGEING: ['DUE', 'PARTIAL', 'OVERDUE'], COM_REACH: ['SENT', 'NO_EMAIL', 'QUEUED_NO_GATEWAY', 'DELIVERED', 'READ'],
  COM_TURNAROUND: ['Submitted', 'Approved', 'Declined', 'Cancelled', 'Done'], SP_SALES: ['Draft', 'Sent', 'Won', 'Lost']
};
const showKey = (dim, k) => (dim.time && /^\d{4}-\d{2}$/.test(k) ? monthLabel(k) : k);
const rcOf = (db) => (db.provider?.rateCard?.version >= 2 ? db.provider.rateCard : DEFAULT_RATE_CARD);

// ---------- Filter bar ----------
function FilterBar({ def, f, setF, db, scope }) {
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value, ...(k === 'classId' ? { sectionId: '', studentId: '' } : k === 'sectionId' ? { studentId: '' } : {}) });
  const secs = db.sections.filter((s) => (!f.classId || s.classId === f.classId) && (scope.all || scope.sections?.has(s.id)));
  const classes = db.classes.filter((c) => scope.all || db.sections.some((s) => s.classId === c.id && scope.sections?.has(s.id)));
  const kids = db.students.filter((s) => s.status !== 'Left' && (f.sectionId ? s.sectionId === f.sectionId : f.classId ? s.sectionId.startsWith(f.classId) && db.sections.find((x) => x.id === s.sectionId)?.classId === f.classId : false));
  const heads = [...new Set(db.invoices.flatMap((i) => i.items.map((x) => x.head)))];
  const el = {
    dates: <><label className="f">From<Input type="date" aria-label="From" value={f.from} onChange={set('from')} /></label><label className="f">To<Input type="date" aria-label="To" value={f.to} onChange={set('to')} /></label></>,
    year: <label className="f">Academic year<Select aria-label="Academic year" value={f.year} onChange={set('year')} options={[db.year || '2026-27']} /></label>,
    classId: <label className="f">Class<Select aria-label="Class" value={f.classId} onChange={set('classId')} options={[['', 'All classes'], ...classes.map((c) => [c.id, c.name])]} /></label>,
    sectionId: <label className="f">Section<Select aria-label="Section" value={f.sectionId} onChange={set('sectionId')} options={[['', 'All sections'], ...secs.map((s) => [s.id, `${db.classes.find((c) => c.id === s.classId)?.name}-${s.name}`])]} /></label>,
    studentId: <label className="f">Student<Select aria-label="Student" value={f.studentId} onChange={set('studentId')} disabled={!kids.length} options={[['', kids.length ? 'All students' : 'Pick a class first'], ...kids.map((s) => [s.id, `${s.first} ${s.last || ''} · ${s.admNo}`])]} /></label>,
    staffId: <label className="f">Staff<Select aria-label="Staff" value={f.staffId} onChange={set('staffId')} options={[['', 'All staff'], ...db.staff.map((s) => [s.id, `${s.first} ${s.last}`])]} /></label>,
    subject: <label className="f">Subject<Select aria-label="Subject" value={f.subject} onChange={set('subject')} options={[['', 'All subjects'], ...SUBJECTS.map((s) => [s, s])]} /></label>,
    feeHead: <label className="f">Fee type<Select aria-label="Fee type" value={f.feeHead} onChange={set('feeHead')} options={[['', 'All fee types'], ...heads.map((h) => [h, h])]} /></label>,
    status: <label className="f">Status<Select aria-label="Status" value={f.status} onChange={set('status')} options={[['', 'Any status'], ...(STATUS_OPTIONS[def.code] || []).map((s) => [s, s])]} /></label>,
    exam: <label className="f">{def.filters.includes('exam2') ? 'From exam' : 'Exam'}<Select aria-label="Exam" value={f.exam} onChange={set('exam')} options={EXAMS.map((e) => [e.code, e.name])} /></label>,
    exam2: <label className="f">To exam<Select aria-label="Compare with" value={f.exam2} onChange={set('exam2')} options={EXAMS.map((e) => [e.code, e.name])} /></label>
  };
  return <div className="report-filters" role="group" aria-label="Report filters">{def.filters.map((k) => <span key={k} style={{ display: 'contents' }}>{el[k]}</span>)}
    <button className="btn sm" onClick={() => setF(defaultFilters(db))}>Reset filters</button></div>;
}

// ---------- Charts (SVG; every chart has the same numbers in the table under it) ----------
function Chart({ def, rows, dim, m, m2, onPick, db, facts }) {
  const label = `${def.name}: ${m.label} by ${dim.label.toLowerCase()}`;
  if (!rows.length) return <p className="muted">No data for these filters.</p>;
  if (def.visual === 'heatmap' && def.cols && dim.key === def.dims[0].key) {
    const weeks = [...new Set(facts.map((x) => x[def.cols]))].sort();
    const people = rows.slice(0, 25);
    return <div className="tw" role="img" aria-label={`${label}, weekly, ${people.length} lowest first`}>
      <table className="t heat"><thead><tr><th>{dim.label}</th>{weeks.map((w) => <th key={w} className="num small">{w.slice(8)}/{w.slice(5, 7)}</th>)}<th className="num">Overall</th></tr></thead>
        <tbody>{people.map((r) => <tr key={r.key}><td><button className="linkbtn" onClick={() => onPick(r.key)}>{r.key}</button></td>{weeks.map((w) => { const c = r.facts.find((x) => x[def.cols] === w); const p = c && c.d ? Math.round((100 * c.p) / c.d) : null;
          return <td key={w} className="num small" title={p == null ? 'No school days' : `${p}%`} style={{ background: p == null ? undefined : `color-mix(in srgb, var(--bad) ${Math.round(Math.max(0, 100 - p) * 2.5)}%, transparent)` }}>{p == null ? '—' : p}</td>; })}
          <td className="num b">{fmtValue(m, r[m.key])}</td></tr>)}</tbody></table>
      <p className="small muted">Week starting (day/month). Darker = more absence. Lowest 25 shown; the full list is in the table below.</p></div>;
  }
  if (def.visual === 'line' && dim.time) {
    const W = 640, H = 200, P = 34, max = Math.max(...rows.map((r) => r[m.key]), 1), min = Math.min(0, ...rows.map((r) => r[m.key]));
    const x = (i) => P + (i * (W - 2 * P)) / Math.max(1, rows.length - 1), y = (v) => H - P - ((v - min) * (H - 2 * P)) / (max - min || 1);
    return <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} style={{ width: '100%', maxWidth: W }}>
      <line x1={P} y1={H - P} x2={W - P} y2={H - P} stroke="var(--line)" />
      <polyline fill="none" stroke="var(--brand)" strokeWidth="2" points={rows.map((r, i) => `${x(i)},${y(r[m.key])}`).join(' ')} />
      {rows.map((r, i) => <g key={r.key} tabIndex={0} role="button" aria-label={`${showKey(dim, r.key)}: ${fmtValue(m, r[m.key])}`} onClick={() => onPick(r.key)} onKeyDown={(e) => e.key === 'Enter' && onPick(r.key)} style={{ cursor: 'pointer' }}>
        <circle cx={x(i)} cy={y(r[m.key])} r="5" fill="var(--brand)" stroke="var(--card, #fff)" strokeWidth="2"><title>{`${showKey(dim, r.key)}: ${fmtValue(m, r[m.key])}`}</title></circle>
        <text x={x(i)} y={H - P + 16} textAnchor="middle" fontSize="11" fill="var(--muted)">{showKey(dim, r.key)}</text></g>)}
    </svg>;
  }
  if (def.visual === 'combo' && m2) {
    const W = 640, H = 220, P = 34, max = Math.max(...rows.map((r) => Math.max(r[m.key], r[m2.key])), 1), bw = (W - 2 * P) / rows.length;
    const y = (v) => H - P - (v * (H - 2 * P)) / max;
    return <div><svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${def.name}: ${m.label} and ${m2.label} by ${dim.label.toLowerCase()}, target ${def.target}%`} style={{ width: '100%', maxWidth: W }}>
      <line x1={P} y1={H - P} x2={W - P} y2={H - P} stroke="var(--line)" />
      {rows.map((r, i) => { const x0 = P + i * bw; return <g key={r.key} style={{ cursor: 'pointer' }} onClick={() => onPick(r.key)}>
        <rect x={x0 + bw * 0.12} y={y(r[m.key])} width={bw * 0.36} height={H - P - y(r[m.key])} rx="3" fill="var(--muted)" opacity=".45"><title>{`${showKey(dim, r.key)} ${m.label}: ${fmtValue(m, r[m.key])}`}</title></rect>
        <rect x={x0 + bw * 0.52} y={y(r[m2.key])} width={bw * 0.36} height={H - P - y(r[m2.key])} rx="3" fill="var(--brand)"><title>{`${showKey(dim, r.key)} ${m2.label}: ${fmtValue(m2, r[m2.key])}`}</title></rect>
        <line x1={x0 + bw * 0.08} x2={x0 + bw * 0.92} y1={y((r[m.key] * def.target) / 100)} y2={y((r[m.key] * def.target) / 100)} stroke="var(--bad)" strokeDasharray="4 3" />
        <text x={x0 + bw / 2} y={H - P + 16} textAnchor="middle" fontSize="11" fill="var(--muted)">{showKey(dim, r.key)}</text></g>; })}
    </svg><p className="small muted"><span style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--muted)', opacity: .45 }} /> {m.label} · <span style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--brand)' }} /> {m2.label} · <span style={{ color: 'var(--bad)' }}>- - -</span> target {def.target}%</p></div>;
  }
  if (def.visual === 'diverging') {
    const top = rows.slice(0, 6), bottom = rows.slice(-6).reverse().filter((r) => !top.includes(r)), list = [...top, ...bottom];
    const max = Math.max(...list.map((r) => Math.abs(r[m.key])), 1);
    return <div role="img" aria-label={`${label}: 6 biggest gains and 6 biggest drops`}>{list.map((r) => { const v = r[m.key]; const w = (50 * Math.abs(v)) / max;
      return <div key={r.key} className="row" style={{ marginBottom: 4 }}><button className="linkbtn small" style={{ width: 170, textAlign: 'right' }} onClick={() => onPick(r.key)}>{r.key}</button>
        <div style={{ flex: 1, position: 'relative', height: 18 }}><div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, borderLeft: '1px solid var(--line)' }} />
          <div title={`${r.key}: ${fmtValue(m, v)}`} style={{ position: 'absolute', height: 14, top: 2, borderRadius: 3, left: v >= 0 ? '50%' : `${50 - w}%`, width: `${w}%`, background: v >= 0 ? 'var(--brand)' : 'var(--bad)' }} /></div>
        <span className="small b" style={{ width: 56, textAlign: 'right' }}>{fmtValue(m, v)}</span></div>; })}</div>;
  }
  // bar and funnel: horizontal bars of the chosen measure; click a bar to drill
  const max = Math.max(...rows.map((r) => r[m.key]), 1);
  const shown = rows.slice(0, 15);
  return <div role="group" aria-label={label}>{shown.map((r, i) => <div key={r.key} className="row" style={{ marginBottom: 6, justifyContent: def.visual === 'funnel' ? 'center' : undefined }}>
    <button className="linkbtn small" style={{ width: 170, textAlign: 'right' }} aria-label={`${showKey(dim, r.key)}: ${fmtValue(m, r[m.key])}`} onClick={() => onPick(r.key)}>{showKey(dim, r.key)}</button>
    <div style={{ flex: 1 }}><div title={`${showKey(dim, r.key)}: ${fmtValue(m, r[m.key])}`} style={{ height: 20, width: `${Math.max(1, (100 * r[m.key]) / max)}%`, margin: def.visual === 'funnel' ? '0 auto' : undefined, background: 'var(--brand)', opacity: def.visual === 'funnel' ? 1 - i * 0.12 : 0.85, borderRadius: 4 }} /></div>
    <span className="small b" style={{ width: 90, textAlign: 'right' }}>{fmtValue(m, r[m.key])}{def.visual === 'funnel' && i > 0 && shown[i - 1][m.key] ? <span className="muted"> ({Math.round((100 * r[m.key]) / shown[i - 1][m.key])}%)</span> : ''}</span></div>)}
    {rows.length > 15 && <p className="small muted">Top 15 of {rows.length}; all of them are in the table below.</p>}</div>;
}

// ---------- One report ----------
export function ReportView({ def }) {
  const { db, session } = useStore();
  const [f, setF] = useState(() => defaultFilters(db));
  const [path, setPath] = useState([]);     // drill-down: [{ dim, key }]
  const [mKey, setMKey] = useState(def.visual === 'combo' ? def.measures[1].key : def.measures[0].key);
  const scope = useMemo(() => scopeFor(db, session), [db, session]);
  const extra = useMemo(() => (def.code === 'SP_SALES' ? { value: (p) => { try { return quote(rcOf(db), p.options).recurring; } catch (e) { return 0; } } } : null), [db, def.code]);
  const all = useMemo(() => def.rows(db, f, scope, extra), [db, f, scope, def, extra]);
  const facts = all.filter((x) => path.every((p) => String(x[p.dim]) === String(p.key)));
  const level = Math.min(path.length, def.dims.length - 1);
  const { dim, rows } = aggregate(db, def, facts, def.dims[level].key, all);
  const m = def.visual === 'combo' ? def.measures[0] : def.measures.find((x) => x.key === mKey) || def.measures[0];
  const m2 = def.visual === 'combo' ? def.measures[1] : null;
  const canDrill = path.length < def.dims.length - 1;
  const pick = (key) => { if (canDrill) setPath([...path, { dim: dim.key, key }]); };
  const k = kpis(db, def, facts);
  const filterText = def.filters.map((x) => (x === 'dates' ? `${f.from} to ${f.to}` : f[x] ? `${x}: ${f[x]}` : '')).filter(Boolean).join('; ');
  const sheet = () => [[def.name], [`Filters: ${filterText || 'none'}${path.length ? '; ' + path.map((p) => `${p.dim} = ${p.key}`).join('; ') : ''}`], [], [dim.label, ...def.measures.map((x) => x.label)], ...rows.map((r) => [showKey(dim, r.key), ...def.measures.map((x) => r[x.key])])];
  const toCsv = () => saveFile(`${def.code}_${f.from}_${f.to}.csv`, sheet().map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n'));
  const toXlsx = () => { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheet()), def.code.slice(0, 31)); return saveWorkbook(XLSX, wb, `${def.code}_${f.from}_${f.to}.xlsx`); };
  return <div className="report" aria-label={def.name}>
    <p className="small muted" style={{ marginTop: 0 }}>{def.purpose}. Source: {def.source}. Who sees it: {def.roles}. {!scope.all && <b>{scope.label}.</b>} {def.note || ''}</p>
    <FilterBar def={def} f={f} setF={(x) => { setF(x); setPath([]); }} db={db} scope={scope} />
    <div className="grid g4" style={{ margin: '12px 0' }}>{k.map((x) => <Stat key={x.key} label={x.label} value={fmtValue(x, x.value)} sub={path.length ? path.map((p) => p.key).join(' › ') : 'for these filters'} />)}</div>
    <Card title={<span>{m.label} by {dim.label.toLowerCase()}</span>} right={<div className="row">
      {!m2 && def.measures.length > 1 && <Select aria-label="Measure to chart" value={mKey} onChange={(e) => setMKey(e.target.value)} options={def.measures.map((x) => [x.key, x.label])} />}
      <button className="btn sm" onClick={toCsv}>Export CSV</button><button className="btn sm" onClick={toXlsx}>Export Excel</button></div>}>
      <nav className="row small" aria-label="Drill-down path" style={{ marginBottom: 8 }}>
        <button className="linkbtn" onClick={() => setPath([])} aria-current={!path.length ? 'true' : undefined}>All</button>
        {path.map((p, i) => <span key={i}>› <button className="linkbtn" onClick={() => setPath(path.slice(0, i + 1))}>{showKey(def.dims.find((d) => d.key === p.dim) || {}, p.key)}</button></span>)}
        {canDrill && <span className="muted">· click a {dim.label.toLowerCase()} to see it by {def.dims[level + 1].label.toLowerCase()}</span>}
      </nav>
      <Chart def={def} rows={rows} dim={dim} m={m} m2={m2} onPick={pick} db={db} facts={facts} />
    </Card>
    <Card title="Table">
      <div className="tw"><table className="t" aria-label={`${def.name} table`}><thead><tr><th>{dim.label}</th>{def.measures.map((x) => <th key={x.key} className="num">{x.label}</th>)}</tr></thead>
        <tbody>{rows.length ? rows.map((r) => <tr key={r.key}><td>{canDrill ? <button className="linkbtn" onClick={() => pick(r.key)}>{showKey(dim, r.key)}</button> : showKey(dim, r.key)}</td>{def.measures.map((x) => <td key={x.key} className="num">{fmtValue(x, r[x.key])}</td>)}</tr>)
          : <tr><td colSpan={def.measures.length + 1} className="muted">No data for these filters.</td></tr>}</tbody></table></div>
    </Card>
  </div>;
}

// ---------- A Data Analytics screen: its reports as tabs, after any overview the screen already had ----------
export function ReportTabs({ screen, intro = true }) {
  const list = reportsFor(screen);
  const [tab, setTab] = useState(() => { try { const t = sessionStorage.getItem('anl-tab'); if (t && list.some((r) => r.code === t)) { sessionStorage.removeItem('anl-tab'); return t; } } catch (e) { /* ignore */ } return list[0]?.code; });
  if (!list.length) return null;
  const def = list.find((r) => r.code === tab) || list[0];
  return <section aria-label="Reports" style={{ marginTop: intro ? 18 : 0 }}>
    {intro && <h2 style={{ marginBottom: 8 }}>Reports</h2>}
    {list.length > 1 && <Tabs tabs={list.map((r) => [r.code, r.name])} value={def.code} onChange={setTab} />}
    <ReportView key={def.code} def={def} />
  </section>;
}
// New screens that are only reports
export function AnalyticsScreen({ code }) {
  const list = reportsFor(code);
  return <Page title={LABEL[code]} sub={`${list.length} report${list.length > 1 ? 's' : ''} · filters, drill-down and export · in production each is a Power BI page filtered to this school`}>
    <ReportTabs screen={code} intro={false} />
  </Page>;
}
// An existing screen (overview) followed by its reports
export const withReports = (Overview) => function WithReports(props) { return <><Overview {...props} /><div className="content-tail"><ReportTabs screen={props.code} /></div></>; };

// The catalogue lists every report, and what moved here
export function AllReports({ go, menus }) {
  const can = (code) => (menus || []).some((mm) => mm.items.some((i) => i[0] === code));
  const open = (r) => { try { sessionStorage.setItem('anl-tab', r.code); } catch (e) { /* ignore */ } go(r.screen); };
  const mods = [...new Set(REPORT_DEFS.map((r) => r.module))];
  return <>
    <Card title={`Report catalogue — ${REPORT_DEFS.length} reports`}>
      <div className="tw"><table className="t"><thead><tr><th>Module</th><th>Report</th><th>Purpose</th><th>Filters</th><th>Visual</th><th>Who sees it</th><th>Source menu</th><th /></tr></thead>
        <tbody>{mods.flatMap((mo) => REPORT_DEFS.filter((r) => r.module === mo).map((r, i) => <tr key={r.code}><td className="b">{i ? '' : mo}</td><td>{r.name}</td><td className="small">{r.purpose}</td>
          <td className="small">{r.filters.map((x) => ({ dates: 'Date range', year: 'Academic year', classId: 'Class', sectionId: 'Section', studentId: 'Student', staffId: 'Staff', subject: 'Subject', feeHead: 'Fee type', status: 'Status', exam: 'Exam', exam2: 'Compare with' }[x])).join(', ')}</td>
          <td className="small">{r.visual}</td><td className="small">{r.roles}</td><td className="small">{r.source}</td>
          <td>{can(r.screen) ? <button className="btn sm pri" onClick={() => open(r)}>Open</button> : <span className="small muted">Not for your role</span>}</td></tr>))}</tbody></table></div>
    </Card>
    <Card title="Moved into Data Analytics (release 15.1)">
      <table className="t"><thead><tr><th>Was in</th><th>Now in</th></tr></thead><tbody>{MOVED.map(([a, b]) => <tr key={a}><td>{a}</td><td>{b}</td></tr>)}</tbody></table>
      <p className="small muted">The working menus keep only the counts people work from (for example books on loan, beds free, dues totals).</p>
    </Card></>;
}
