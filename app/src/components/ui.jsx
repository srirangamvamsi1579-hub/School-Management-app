import { useState } from 'react';

export const Page = ({ title, sub, actions, children }) => (
  <>
    <div className="page-h"><div><h1>{title}</h1>{sub && <p>{sub}</p>}</div>{actions && <div className="row noprint">{actions}</div>}</div>
    {children}
  </>
);
export const Card = ({ title, right, children, className = '' }) => (
  <div className={'card ' + className}>
    {(title || right) && <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}><h2 style={{ margin: 0 }}>{title}</h2>{right}</div>}
    {children}
  </div>
);
export const Stat = ({ label, value, sub }) => <div className="stat"><div className="l">{label}</div><div className="v">{value}</div>{sub && <div className="s">{sub}</div>}</div>;
export const Pill = ({ kind = '', children }) => <span className={'pill ' + kind}>{children}</span>;

const STATUS = { PAID: 'ok', AUTO: 'ok', Active: 'ok', ACTIVE: 'ok', Approved: 'ok', OK: 'ok', SENT: 'info', IMPORTED: 'ok', MANUAL: 'ok', Printed: 'ok',
  PARTIAL: 'warn', WAITING: 'warn', DUE: 'warn', 'In review': 'warn', WARNING: 'warn', SMS: 'warn', Draft: 'warn', 'Pending approval': 'warn', DRAFT: 'warn',
  CONFIRMED: 'ok', 'On leave': 'warn', OVERDUE: 'bad', UNMATCHED: 'bad', ERROR: 'bad', NO_EMAIL: 'bad', DUPLICATE: 'bad', 'ROLLED BACK': '', Inactive: '' };
export const Status = ({ s }) => <Pill kind={STATUS[s] || ''}>{String(s).replace('_', ' ')}</Pill>;

export function Field({ label, req, children, full }) {
  return <label className={'f' + (full ? ' full' : '')}><span className={req ? 'req' : ''}>{label}</span>{children}</label>;
}
export const Input = (p) => <input className="i" {...p} />;
export const Select = ({ options, ...p }) => (
  <select className="i" {...p}>{options.map((o) => (Array.isArray(o) ? <option key={o[0]} value={o[0]}>{o[1]}</option> : <option key={o} value={o}>{o}</option>))}</select>
);

export function Tabs({ tabs, value, onChange }) {
  return <div className="tabs" role="tablist">{tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={value === k} className={value === k ? 'on' : ''} onClick={() => onChange(k)}>{l}</button>)}</div>;
}
export function useTabs(first) { return useState(first); }

export function Modal({ title, onClose, children, actions }) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}><h2 style={{ margin: 0 }}>{title}</h2><button className="btn sm" onClick={onClose}>Close</button></div>
        {children}
        {actions && <div className="row end" style={{ marginTop: 14 }}>{actions}</div>}
      </div>
    </div>
  );
}

export const Switch = ({ on, onClick, label }) => <button type="button" className={'switch' + (on ? ' on' : '')} role="switch" aria-checked={on} aria-label={label} onClick={onClick} />;

export function Bars({ data, fmt = (v) => v }) {
  const max = Math.max(...data.map((d) => d[1]), 1);
  return (
    <div className="chart">
      {data.map(([l, v]) => <div className="c" key={l} title={`${l}: ${fmt(v)}`}><span>{fmt(v)}</span><i style={{ height: `${(v / max) * 100}%` }} /><span>{l}</span></div>)}
    </div>
  );
}
export const Progress = ({ pct }) => <div className="bar" aria-valuenow={pct} role="progressbar"><i style={{ width: Math.min(100, pct) + '%' }} /></div>;

export function Html({ html, className = 'doc' }) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

// Printing is blocked inside the claude.ai preview frame; works on the hosted site.
export function printPage() {
  let framed = true;
  try { framed = window.self !== window.top; } catch (e) { framed = true; }
  if (framed) { document.dispatchEvent(new CustomEvent('app-toast', { detail: 'Printing is off in this preview — open the hosted site to print.' })); return; }
  window.print();
}
