// Attendance register: one row per person, one column per day, like the paper register.
// Tap a cell to switch Present → Absent → Late. Leave and holidays come from approvals and the school calendar.
import { useState } from 'react';
import { Input } from './ui.jsx';
import { days, weekday, holidayName, monthRange, summarize, MARKS } from '../lib/attendance.js';
import { todayISO } from '../lib/format.js';

const WD = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const shift = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

export function useRange() {
  const [range, setRange] = useState(() => monthRange());
  return [range, setRange];
}

export function RangeFilter({ range, setRange }) {
  const t = todayISO();
  const mon = shift(t, -((weekday(t) + 6) % 7));
  const lastMonth = monthRange(shift(monthRange(t)[0], -1));
  return <div className="row" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
    <label className="f">From<Input type="date" value={range[0]} max={range[1]} onChange={(e) => setRange([e.target.value, range[1]])} aria-label="From date" /></label>
    <label className="f">To<Input type="date" value={range[1]} min={range[0]} onChange={(e) => setRange([range[0], e.target.value])} aria-label="To date" /></label>
    <div className="row">
      <button className="btn sm" onClick={() => setRange([t, t])}>Today</button>
      <button className="btn sm" onClick={() => setRange([mon, shift(mon, 6)])}>This week</button>
      <button className="btn sm" onClick={() => setRange(monthRange(t))}>This month</button>
      <button className="btn sm" onClick={() => setRange(lastMonth)}>Last month</button>
    </div>
  </div>;
}

export const Legend = () => <div className="legend-row" aria-label="Key">{Object.entries(MARKS).map(([k, [name, short]]) => <span key={k}><b>{short}</b> {name}</span>)}<span className="muted">Tap a cell to change it (Present → Absent → Late). Leave comes from approved requests.</span></div>;

// rows: [{ id, name, sub }]; mark(row, date) → code | null; onSet(row, date, code) or null when read only
export function Register({ db, rows, range, mark, onSet, next, label, canEdit = (row, d, m) => true }) {
  const list = days(range[0], range[1]);
  const t = todayISO();
  if (list.length > 93) return <p className="note">Pick a range of up to three months to see the register (this one has {list.length} days). The totals below still cover the whole range.</p>;
  return <div className="reg-wrap"><table className="reg" aria-label={label}>
    <thead><tr><th className="name">Name</th>{list.map((d) => { const off = holidayName(db, d); return <th key={d} className={(off ? 'off' : '') + (d === t ? ' today' : '')} title={off || undefined} scope="col">
      <div>{+d.slice(8)}</div><div className="muted" style={{ fontWeight: 400 }}>{WD[weekday(d)]}</div></th>; })}
      <th className="tot">P</th><th className="tot">A</th><th className="tot">%</th></tr></thead>
    <tbody>{rows.map((r) => { const marks = list.map((d) => mark(r, d)); const sum = summarize(marks);
      return <tr key={r.id}><td className="name"><div className="b">{r.name}</div>{r.sub && <div className="small muted">{r.sub}</div>}</td>
        {list.map((d, i) => { const m = marks[i]; const off = m === 'H';
          if (off) return <td key={d} className="off" title={holidayName(db, d)}>–</td>;
          if (!m) return <td key={d} />;
          const locked = !onSet || m === 'L' || d > t || !canEdit(r, d, m);
          return <td key={d}><button className={'m ' + m} disabled={locked} aria-label={`${r.name}, ${d}: ${MARKS[m][0]}`} title={MARKS[m][0]}
            onClick={() => onSet(r, d, next[m] || 'P')}>{MARKS[m][1]}</button></td>; })}
        <td className="tot">{sum.present}</td><td className="tot">{sum.A || 0}</td><td className="tot">{sum.pct ?? '—'}</td></tr>; })}</tbody>
  </table></div>;
}
