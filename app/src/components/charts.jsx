// Small chart kit for the dashboard. Marks carry the series colour; all text uses text colours.
// Every chart has a legend (two or more series), a tooltip on hover and keyboard focus, and a table view.
import { useState, useRef } from 'react';

const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString('en-IN'));

// ▲ 6 vs 2025-26 — the arrow and colour say direction and whether that direction is good
export function Delta({ now, before, period, upGood = true, unit = '', pct = false, short = false }) {
  if (before == null) return <span className="small muted">{short ? '—' : `No figure for ${period}`}</span>;
  const d = now - before;
  const word = d > 0 ? 'up' : d < 0 ? 'down' : 'no change';
  const good = d === 0 ? null : (d > 0) === upGood;
  const rel = before ? Math.round((100 * Math.abs(d)) / before) : null;
  return <span className={'delta ' + (good == null ? 'flat' : good ? 'good' : 'bad')} aria-label={`${word} ${Math.abs(d)}${unit} compared with ${period}`}>
    <span aria-hidden="true">{d > 0 ? '▲' : d < 0 ? '▼' : '▬'}</span> {d === 0 ? 'No change' : `${fmt(Math.abs(d))}${unit}`}{pct && rel != null && d !== 0 ? ` (${rel}%)` : ''}{!short && <span className="muted"> vs {period}</span>}
  </span>;
}

export function Kpi({ label, value, children, sub }) {
  return <div className="kpi"><div className="kpi-label">{label}</div><div className="kpi-value">{value}</div>{children && <div className="kpi-delta">{children}</div>}{sub && <div className="small muted">{sub}</div>}</div>;
}

function useTip() {
  const [tip, setTip] = useState(null);
  const box = useRef(null);
  const show = (e, content) => {
    const r = box.current?.getBoundingClientRect(); const t = e.currentTarget.getBoundingClientRect();
    setTip({ content, x: t.left - (r?.left || 0) + t.width / 2, y: t.top - (r?.top || 0) });
  };
  return { tip, box, show, hide: () => setTip(null) };
}
function Tip({ tip }) {
  if (!tip) return null;
  return <div className="viz-tip" role="status" style={{ left: tip.x, top: tip.y }}>{tip.content}</div>;
}
export function Legend({ items }) {
  return <div className="viz-legend">{items.map(([name, color, kind]) => <span key={name}>{kind === 'line' ? <i className="key-line" style={{ background: color }} /> : <i className="key" style={{ background: color }} />}{name}</span>)}</div>;
}
function TableToggle({ label, open, setOpen }) {
  return <button className="linkish small" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Hide table' : 'Show as table'}<span className="sr"> — {label}</span></button>;
}

// Stacked columns: one column per category, parts stacked from the baseline, total on the cap, optional limit tick
export function StackedColumns({ label, rows, series, limitName, height = 220 }) {
  const { tip, box, show, hide } = useTip();
  const [table, setTable] = useState(false);
  const max = Math.max(1, ...rows.map((r) => Math.max(r.parts.reduce((a, b) => a + b, 0), r.limit || 0)));
  const step = max <= 10 ? 2 : max <= 25 ? 5 : max <= 60 ? 10 : Math.ceil(max / 5 / 10) * 10;
  const top = Math.ceil(max / step) * step;
  const slot = 52, bar = 24, padL = 34, padB = 26, padT = 18, w = padL + rows.length * slot + 8, h = height;
  const y = (v) => padT + (h - padT - padB) * (1 - v / top);
  const ticks = []; for (let v = 0; v <= top; v += step) ticks.push(v);
  return <figure className="viz" aria-label={label}>
    <div className="viz-head"><Legend items={[...series.map((s) => [s.name, s.color]), ...(limitName ? [[limitName, 'var(--ink)', 'line']] : [])]} /><TableToggle label={label} open={table} setOpen={setTable} /></div>
    <div className="viz-scroll" ref={box}>
      <svg width={w} height={h} role="img" aria-label={label}>
        {ticks.map((v) => <g key={v}><line x1={padL} x2={w - 4} y1={y(v)} y2={y(v)} className={v === 0 ? 'axis' : 'grid'} /><text x={padL - 6} y={y(v) + 4} className="tick" textAnchor="end">{v}</text></g>)}
        {rows.map((r, i) => {
          const x = padL + i * slot + (slot - bar) / 2; let acc = 0;
          const total = r.parts.reduce((a, b) => a + b, 0);
          const segs = r.parts.map((v, k) => { const y0 = y(acc), y1 = y(acc + v); acc += v; return { v, k, y0, y1 }; }).filter((s) => s.v > 0);
          return <g key={r.label}>
            {segs.map((s, j) => { const isTop = j === segs.length - 1; const gap = j > 0 ? 2 : 0; const hh = Math.max(0, s.y0 - s.y1 - gap);
              const d = isTop ? `M${x},${s.y0 - gap} v${-(hh - 4)} q0,-4 4,-4 h${bar - 8} q4,0 4,4 v${hh - 4} z` : `M${x},${s.y0 - gap} v${-hh} h${bar} v${hh} z`;
              const text = `${r.label} · ${series[s.k].name}: ${s.v}`;
              return <path key={s.k} d={d} fill={series[s.k].color} className="mark" tabIndex={0} aria-label={text}
                onPointerMove={(e) => show(e, <><b>{s.v}</b> {series[s.k].name}<div className="muted">{r.label} · {total} in all{r.limit != null ? ` · limit ${r.limit}` : ''}</div></>)} onPointerLeave={hide}
                onFocus={(e) => show(e, <><b>{s.v}</b> {series[s.k].name}<div className="muted">{r.label} · {total} in all</div></>)} onBlur={hide} />; })}
            {r.limit != null && <line x1={x - 5} x2={x + bar + 5} y1={y(r.limit)} y2={y(r.limit)} className="limit"><title>{`${r.label} limit ${r.limit}`}</title></line>}
            <text x={x + bar / 2} y={Math.min(y(total), r.limit != null ? y(r.limit) : h) - 5} className="cap" textAnchor="middle">{total}</text>
            <text x={x + bar / 2} y={h - 8} className="tick" textAnchor="middle">{r.label}</text>
            {r.flag && <text x={x + bar / 2} y={padT - 6} className={'flag ' + r.flag.kind} textAnchor="middle" aria-label={r.flag.text}>{r.flag.kind === 'over' ? '▲' : '▼'}</text>}
          </g>;
        })}
      </svg>
      <Tip tip={tip} />
    </div>
    {table && <table className="t small" aria-label={label + ' (table)'}><thead><tr><th>{rows.length ? 'Class' : ''}</th>{series.map((s) => <th key={s.name}>{s.name}</th>)}<th>Total</th>{limitName && <th>{limitName}</th>}</tr></thead>
      <tbody>{rows.map((r) => <tr key={r.label}><td>{r.label}</td>{r.parts.map((v, k) => <td key={k}>{v}</td>)}<td className="b">{r.parts.reduce((a, b) => a + b, 0)}</td>{limitName && <td>{r.limit ?? '—'}</td>}</tr>)}</tbody></table>}
  </figure>;
}

// Horizontal bars: one row per item. Optional parts (stacked, with legend), a track (capacity) and a target mark.
export function Bars({ label, rows, series, valueText = (r) => fmt(r.value), target, targetName, max: maxIn }) {
  const { tip, box, show, hide } = useTip();
  const [table, setTable] = useState(false);
  const max = maxIn || Math.max(1, ...rows.map((r) => Math.max(r.track || 0, r.parts ? r.parts.reduce((a, b) => a + b, 0) : r.value)));
  const legend = [...(series && series.length > 1 ? series.map((s) => [s.name, s.color]) : []), ...(rows.some((r) => r.track) ? [['Seats', 'var(--track)']] : []), ...(target != null ? [[targetName, 'var(--ink)', 'line']] : [])];
  return <figure className="viz" aria-label={label}>
    <div className="viz-head">{legend.length > 0 ? <Legend items={legend} /> : <span />}<TableToggle label={label} open={table} setOpen={setTable} /></div>
    <div className="hbars" ref={box}>
      {rows.map((r) => { const parts = r.parts || [r.value]; let acc = 0;
        return <div key={r.label} className="hbar-row">
          <div className="hbar-label">{r.label}{r.note && <div className="small muted">{r.note}</div>}</div>
          <div className="hbar-plot">
            {r.track != null && <div className="hbar-track" style={{ width: `${(100 * r.track) / max}%` }} />}
            {parts.map((v, k) => { const left = acc; acc += v; const last = k === parts.length - 1;
              const name = series ? series[k].name : label;
              return v > 0 && <div key={k} className={'hbar' + (last ? ' end' : '')} tabIndex={0} aria-label={`${r.label} · ${name}: ${v}`}
                style={{ left: `calc(${(100 * left) / max}% + ${k ? 2 : 0}px)`, width: `calc(${(100 * v) / max}% - ${k ? 2 : 0}px)`, background: series ? series[k].color : 'var(--s1)' }}
                onPointerMove={(e) => show(e, <><b>{fmt(v)}</b> {series ? series[k].name : ''}<div className="muted">{r.label}{r.tipNote ? ' · ' + r.tipNote : ''}</div></>)} onPointerLeave={hide}
                onFocus={(e) => show(e, <><b>{fmt(v)}</b> {series ? series[k].name : ''}<div className="muted">{r.label}</div></>)} onBlur={hide} />; })}
            {target != null && <div className="hbar-target" style={{ left: `${(100 * target) / max}%` }} title={`${targetName} ${target}`} />}
          </div>
          <div className="hbar-value">{valueText(r)}{r.flag && <span className={'flag-chip ' + (r.flag.kind === 'low' ? 'over' : r.flag.kind)}>{r.flag.kind === 'over' ? '▲' : r.flag.kind === 'ok' ? '✓' : '▼'} {r.flag.text}</span>}</div>
        </div>; })}
      <Tip tip={tip} />
    </div>
    {table && <table className="t small" aria-label={label + ' (table)'}><thead><tr><th>Item</th>{(series || [{ name: 'Value' }]).map((s) => <th key={s.name}>{s.name}</th>)}{rows.some((r) => r.track != null) && <th>Seats</th>}</tr></thead>
      <tbody>{rows.map((r) => <tr key={r.label}><td>{r.label}</td>{(r.parts || [r.value]).map((v, k) => <td key={k}>{fmt(v)}</td>)}{rows.some((x) => x.track != null) && <td>{fmt(r.track)}</td>}</tr>)}</tbody></table>}
  </figure>;
}

// One whole split into parts (tall segmented bar): share printed inside each block that fits
export function SegmentBar({ label, parts }) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  return <figure className="viz" aria-label={label}>
    <div className="segbar" role="img" aria-label={label + ': ' + parts.map((p) => `${p.name} ${p.value}`).join(', ')}>
      {parts.filter((p) => p.value > 0).map((p) => { const share = Math.round((100 * p.value) / total);
        return <div key={p.name} className="seg" style={{ flex: p.value, background: p.color }} title={`${p.name}: ${p.value} (${share}%)`}>{share >= 12 ? `${share}%` : ''}</div>; })}
    </div>
    <Legend items={parts.map((p) => [`${p.name} · ${p.value}`, p.color])} />
  </figure>;
}
