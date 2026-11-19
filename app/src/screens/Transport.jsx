import { useState } from 'react';
import * as XLSX from 'xlsx';
import { funcOn } from '../data/menu.js';
import { tenantOf } from '../lib/logic.js';
import { useStore } from '../data/store.js';
import { Page, Card, Stat, Tabs, Input, printPage } from '../components/ui.jsx';
import { dmy } from '../lib/format.js';
import { fullName, classLabel } from '../lib/logic.js';
import { manifest, sendManifest, REQ_TYPES, staffName, coordinatorsOf, routeSheet, shareRouteSheets } from '../lib/pickup.js';
import { Modal, Field } from '../components/ui.jsx';
import { ReqStatus } from './Requests.jsx';
import { routeOptions, applyOption, pickupSuggestions, moveRider, addStop, moveStop, removeStop, timingsFor, km, SCHOOL, SPEED_KMH, STOP_MIN, KM_PER_UNIT } from '../lib/routing.js';

const today = () => new Date().toISOString().slice(0, 10);
const ST = { BOARD: ['ok', 'Will board'], NOT_BOARDING: ['', 'Not boarding'], ABSENT: ['bad', 'Absent'], CHECK: ['warn', 'Check'] };

export function BusManifest() {
  const { db, run, mutate, notify, session } = useStore();
  const [date, setDate] = useState(today());
  const [trip, setTrip] = useState(new Date().getHours() < 11 ? 'AM' : 'PM');
  const [route, setRoute] = useState('ALL');
  const m = manifest(db, date, trip);
  const tracking = funcOn(tenantOf(db), 'FN_ATTENDANT_TRACKING');
  const routes = m.routes.filter((r) => route === 'ALL' || r.id === route);
  const mark = (sid, v) => mutate((d) => { d.boarding[`${date}:${trip}:${sid}`] = v; });
  return (
    <Page title="Daily bus manifest" sub={`${trip === 'AM' ? 'Morning pickup' : 'Afternoon drop'} · ${dmy(date)}. Built from attendance and parents' pickup, drop, early-leave and own-transport requests, so the bus doesn't wait for a child who isn't coming.`}
      actions={<><button className="btn" onClick={printPage}>Print</button><button className="btn pri" onClick={() => { run((d) => sendManifest(d, date, trip, session.name || session.role)); notify('Manifest emailed to the transport team'); }}>Send to transport team</button></>}>
      <Card><div className="row" style={{ alignItems: 'flex-end' }}>
        <label className="f">Date<Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <div className="f"><span className="small b">Trip</span><div className="row"><button className={'btn sm' + (trip === 'AM' ? ' pri' : '')} onClick={() => setTrip('AM')}>Morning pickup</button><button className={'btn sm' + (trip === 'PM' ? ' pri' : '')} onClick={() => setTrip('PM')}>Afternoon drop</button></div></div>
        <div className="f"><span className="small b">Route</span><div className="row"><button className={'btn sm' + (route === 'ALL' ? ' pri' : '')} onClick={() => setRoute('ALL')}>All</button>{db.routes.map((r) => <button key={r.id} className={'btn sm' + (route === r.id ? ' pri' : '')} onClick={() => setRoute(r.id)}>{r.id}</button>)}</div></div>
      </div><p className="small muted" style={{ marginTop: 8 }}>Sent automatically at 06:30 for the morning pickup and 14:30 for the afternoon drop (scheduled job in production); changes after that are pushed to the bus attendant as they happen.{tracking ? '' : ' Attendant boarding tracking is not switched on for this school (optional; Platform Console).'}</p></Card>
      <div className="grid g4" style={{ marginBottom: 14 }}><Stat label="Riders" value={m.total} /><Stat label="Will board" value={m.boarding} /><Stat label="Not boarding" value={m.notBoarding} sub="absent, early leave, collected, own transport" /><Stat label="Check with coordinator" value={m.check} sub="request waiting for approval" /></div>
      {routes.map((r) => <Card key={r.id} title={`${r.id} · ${r.name}`} right={<span className="small">Bus {r.bus} · {r.driver} · <b>{r.boarding}</b> boarding / {r.rows.length}</span>}>
        <div className="tw" style={{ maxHeight: 'none' }}><table className="t"><thead><tr><th>#</th><th>Stop</th><th>Student</th><th>Class</th><th>Status</th><th>Why</th><th>Parent mobile</th>{tracking && <th className="noprint">Attendant</th>}</tr></thead>
          <tbody>{r.rows.map((x, i) => <tr key={x.id} style={{ background: x.status === 'BOARD' ? undefined : 'var(--bg)' }}><td>{i + 1}</td><td>{x.stop}</td><td className="b">{x.name}</td><td>{x.cls}</td><td><span className={'pill ' + ST[x.status][0]}>{ST[x.status][1]}</span></td>
            <td className="small">{x.reason}</td><td className="small">{x.guardian}</td>
            {tracking && <td className="noprint">{x.status === 'BOARD' || x.status === 'CHECK' ? <div className="row"><button className={'btn sm' + (x.board === true ? ' pri' : '')} onClick={() => mark(x.id, true)}>Boarded</button><button className={'btn sm' + (x.board === false ? ' pri' : '')} onClick={() => mark(x.id, false)}>No-show</button></div> : <span className="small muted">skip</span>}</td>}</tr>)}</tbody></table></div>
      </Card>)}
    </Page>
  );
}

export function TransportChanges() {
  const { db } = useStore();
  const [tab, setTab] = useState('today');
  const t = today();
  const list = db.requests.filter((r) => db.students.find((s) => s.id === r.studentId)?.routeId && !['Cancelled'].includes(r.status) && (tab === 'today' ? r.dateFrom <= t && t <= r.dateTo : r.dateFrom > t))
    .sort((a, b) => a.dateFrom.localeCompare(b.dateFrom));
  return (
    <Page title="Pickup & drop changes" sub="Every parent request that changes who rides the bus. Coordinators approve; the transport team and gate see the same list.">
      <Tabs tabs={[['today', 'Today'], ['next', 'Coming days']]} value={tab} onChange={setTab} />
      <div className="tw"><table className="t"><thead><tr><th>Date</th><th>Trips</th><th>Student</th><th>Route / stop</th><th>Change</th><th>Collector</th><th>Coordinators</th><th>Status</th></tr></thead>
        <tbody>{list.length === 0 ? <tr><td colSpan={8} className="muted">No changes.</td></tr> : list.map((r) => { const s = db.students.find((x) => x.id === r.studentId); const c = coordinatorsOf(db, s.sectionId); return <tr key={r.id}>
          <td>{dmy(r.dateFrom)}{r.dateTo !== r.dateFrom ? ' – ' + dmy(r.dateTo) : ''}</td><td>{REQ_TYPES[r.type].trips.map((x) => (x === 'AM' ? 'Morning' : 'Afternoon')).join(' + ')}</td>
          <td className="b">{fullName(s)}<div className="small muted">{classLabel(db, s)}</div></td><td>{s.routeId} · {s.stop}</td><td>{REQ_TYPES[r.type].short}{r.time ? ` at ${r.time}` : ''}</td>
          <td className="small">{r.collector ? `${r.collector.name} (${r.collector.relation})` : '—'}</td><td className="small">{staffName(db, c.primary)} / {staffName(db, c.secondary)}</td><td><ReqStatus s={r.status} /></td></tr>; })}</tbody></table></div>
    </Page>
  );
}

export function RoutesRiders({ go }) {
  const { db, run, notify, session } = useStore();
  const [rid, setRid] = useState(db.routes[0].id);
  const [tab, setTab] = useState('stops');
  const [edit, setEdit] = useState(null);
  const [pick, setPick] = useState(null);          // route option being previewed
  const [mode, setMode] = useState(null);          // map: 'add' | { move: stopName }
  const [newStop, setNewStop] = useState(null);    // { x, y, name, riders }
  const can = ['ADMIN', 'TRANSPORT', 'PRINCIPAL'].includes(session.role);
  const planning = funcOn(tenantOf(db), 'FN_ROUTE_PLANNING');   // Transport Plus
  const r = db.routes.find((x) => x.id === rid);
  const kids = db.students.filter((s) => s.status === 'Active' && s.routeId === r.id);
  const opts = routeOptions(db, r.id);
  const cur = opts.find((o) => o.key === 'CURRENT');
  const preview = opts.find((o) => o.key === pick) || null;
  const sug = pickupSuggestions(db);
  const mineSug = { moves: sug.moves.filter((m) => m.fromRoute === r.id || m.toRoute === r.id), newStops: sug.newStops.filter((n) => n.routeId === r.id) };
  const okTime = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
  const save = () => {
    const bad = !okTime(edit.schoolArrive) || !okTime(edit.schoolLeave) || edit.stops.some((x) => !okTime(x.am) || !okTime(x.pm)) ? 'Use HH:MM times'
      : edit.stops.some((x, i) => i && x.am <= edit.stops[i - 1].am) ? 'Morning times must get later stop by stop'
      : edit.stops.some((x) => x.am >= edit.schoolArrive) ? 'Morning pickups must be before the bus reaches school'
      : edit.stops.some((x) => x.pm <= edit.schoolLeave) ? 'Afternoon drops must be after the bus leaves school'
      : !/^[6-9]\d{9}$/.test(edit.driverMobile) ? 'Driver mobile must be 10 digits' : '';
    if (bad) { notify(bad); return; }
    run((d) => { const x = d.routes.find((y) => y.id === edit.id); Object.assign(x, edit); });
    notify('Timings saved — drivers see them on their next route sheet'); setEdit(null);
  };
  const tryRun = (fn, msg) => { try { run(fn); notify(msg); return true; } catch (e) { notify(e.message); return false; } };
  const onMap = (pt) => {
    if (!can) return;
    if (mode === 'add') { setNewStop({ x: pt.x, y: pt.y, name: '', riders: [] }); setMode(null); }
    else if (mode?.move) { tryRun((d) => moveStop(d, r.id, mode.move, pt.x, pt.y), `${mode.move} moved — times worked out again`); setMode(null); }
  };
  return (
    <Page title="Routes, stops & timings" sub="Each route's bus, driver, attendant and stop times, the route map, and suggestions for a shorter route and better pickup points — then build the drivers' route sheets.">
      <div className="row" style={{ marginBottom: 10, flexWrap: 'wrap' }}>{db.routes.map((x) => <button key={x.id} className={'btn sm' + (x.id === rid ? ' pri' : '')} onClick={() => { setRid(x.id); setPick(null); setMode(null); }}>{x.id} · {x.name.split(' — ')[1] || x.name}</button>)}</div>
      <div className="kpis">
        <Stat label="Riders" value={`${kids.length} / ${r.capacity}`} sub={`${Math.round((100 * kids.length) / r.capacity)}% of seats`} />
        <Stat label="Morning drive" value={`${cur.minutes} min`} sub={`${cur.km} km · ${r.stops.length} stops`} />
        <Stat label="Best option" value={opts[0].key === 'CURRENT' || opts[0].saveMin <= 0 ? 'Already shortest' : `${opts[0].saveMin} min shorter`} sub={opts[0].key === 'CURRENT' || opts[0].saveMin <= 0 ? 'No change suggested' : opts[0].name} />
        <Stat label="Pickup suggestions" value={mineSug.moves.length + mineSug.newStops.length} sub={`${mineSug.moves.length} nearer stop · ${mineSug.newStops.length} new stop`} />
      </div>
      <Tabs tabs={[['stops', 'Stops & timings'], ...(planning ? [['plan', 'Plan the route'], ['suggest', `Pickup suggestions (${mineSug.moves.length + mineSug.newStops.length})`], ['map', 'Route map']] : [])]} value={tab} onChange={setTab} />
      {!planning && <p className="small muted">Route planning, the route map and pickup suggestions come with Transport Plus. Ask your platform team to switch it on.</p>}
      <div style={{ marginTop: 12 }}>
      {tab === 'stops' && <Card title={`${r.id} · ${r.name}`} right={can && <div className="row"><button className="btn sm" onClick={() => setEdit(structuredClone(r))}>Edit timings</button>{planning && <button className="btn sm" onClick={() => { setTab('map'); setMode('add'); }}>Add a stop</button>}</div>}>
        <p className="small">Bus {r.bus} · Driver {r.driver} ({r.driverMobile}) · Attendant {r.attendant}</p>
        <table className="t" aria-label={`Stops on ${r.id}`}><thead><tr><th>#</th><th>Stop</th><th className="num">Morning pickup</th><th className="num">Afternoon drop</th><th className="num">Riders</th><th className="num">From school</th>{can && <th />}</tr></thead>
          <tbody>{r.stops.map((st) => <tr key={st.name}><td>{st.order}</td><td>{st.name}</td><td className="num">{st.am}</td><td className="num">{st.pm}</td><td className="num">{kids.filter((k) => k.stop === st.name).length}</td><td className="num">{st.x != null ? km(st, SCHOOL).toFixed(1) + ' km' : '—'}</td>
            {can && <td><div className="row">{planning && <button className="btn sm" onClick={() => { setTab('map'); setMode({ move: st.name }); }}>Move on map</button>}<button className="btn sm" onClick={() => tryRun((d) => removeStop(d, r.id, st.name), `${st.name} removed`)}>Remove</button></div></td>}</tr>)}
            <tr><td /><td className="b">School</td><td className="num b">arrive {r.schoolArrive}</td><td className="num b">leave {r.schoolLeave}</td><td /><td />{can && <td />}</tr></tbody></table>
        <div className="row end" style={{ marginTop: 10 }}><button className="btn" onClick={() => go && go('TRN_SHEETS')}>Open driver route sheets</button></div>
      </Card>}
      {tab === 'plan' && <div className="grid g-side">
        <Card title="Choose a route">
          <p className="small muted" style={{ marginTop: 0 }}>Like a ride app: the planner compares orders of the stops and picks the shortest drive. Pick an option to preview it on the map, then use it. Times are worked out from the map distances ({SPEED_KMH} km/h, {STOP_MIN} min a stop) so the bus still reaches school by {r.schoolArrive}.</p>
          <div style={{ display: 'grid', gap: 8 }}>{opts.map((o, i) => <button key={o.key} className={'opt' + (pick === o.key ? ' on' : '')} onClick={() => setPick(o.key)} aria-pressed={pick === o.key}>
            <div className="row" style={{ justifyContent: 'space-between' }}><b>{o.name}{i === 0 && o.key !== 'CURRENT' && o.saveMin > 0 ? ' · suggested' : ''}</b><span className="small">{o.km} km · {o.minutes} min{o.saveMin > 0 ? <b style={{ color: 'var(--ok)' }}> · {o.saveMin} min shorter</b> : ''}</span></div>
            <div className="small muted">{o.desc}</div><div className="small">{o.names.join(' → ')} → School</div>
            {o.merges.length > 0 && <div className="small">Combines: {o.merges.map((m) => `${m.from} into ${m.into} (${m.riders} riders walk ${Math.round(m.walkKm * 1000)} m)`).join('; ')}</div>}</button>)}</div>
          {can && preview && preview.key !== 'CURRENT' && <div className="row end" style={{ marginTop: 10 }}><button className="btn pri" onClick={() => { if (tryRun((d) => applyOption(d, r.id, preview.key, session.name || session.role), `${r.id} now follows “${preview.name}” — new stop times are on the route sheet`)) { setPick(null); setTab('stops'); } }}>Use this route</button></div>}
          {(db.routePlans || []).filter((x) => x.routeId === r.id).length > 0 && <p className="small muted">Changed before: {(db.routePlans || []).filter((x) => x.routeId === r.id).map((x) => `${x.option} by ${x.by} (${dmy(x.at.slice(0, 10))})`).join('; ')}</p>}
        </Card>
        <Card title="Preview"><RouteMap db={db} route={r} order={(preview || cur).order} kids={kids} /></Card>
      </div>}
      {tab === 'suggest' && <div className="grid g2">
        <Card title="Nearer pickup points">
          <p className="small muted" style={{ marginTop: 0 }}>Riders who live closer to another stop — on this route or another route with seats free. Moving them shortens their walk; tell the parents first.</p>
          {mineSug.moves.length ? <table className="t small" aria-label="Nearer pickup points"><thead><tr><th>Student</th><th>Now</th><th>Suggested</th><th className="num">Walk</th>{can && <th />}</tr></thead>
            <tbody>{mineSug.moves.map((m) => <tr key={m.studentId}><td className="b">{m.name}</td><td>{m.fromRoute} · {m.fromStop}</td><td>{m.toRoute} · {m.toStop}</td><td className="num">{m.nowKm} → {m.newKm} km</td>
              {can && <td><button className="btn sm" onClick={() => tryRun((d) => moveRider(d, m.studentId, m.toRoute, m.toStop), `${m.name} now boards at ${m.toStop}`)}>Move</button></td>}</tr>)}</tbody></table> : <p className="muted small">Every rider on {r.id} already uses their nearest stop.</p>}
        </Card>
        <Card title="New stops">
          <p className="small muted" style={{ marginTop: 0 }}>Where two or more riders live more than 1.2 km from any stop, a new stop between their homes.</p>
          {mineSug.newStops.length ? mineSug.newStops.map((n, i) => <div key={i} className="note" style={{ marginBottom: 8 }}>
            <b>{n.riders.length} riders</b> ({n.riders.map((x) => x.name).join(', ')}) walk {n.nowKm} km on average today; a stop here cuts it to {n.newKm} km.
            {can && <div className="row" style={{ marginTop: 6 }}><button className="btn sm pri" onClick={() => { setNewStop({ x: n.x, y: n.y, name: '', riders: n.riders.map((x) => x.id) }); }}>Add this stop</button><button className="btn sm" onClick={() => setTab('map')}>See on the map</button></div>}</div>)
            : <p className="muted small">No group of riders on {r.id} lives far from a stop.</p>}
        </Card>
      </div>}
      {tab === 'map' && <div className="grid g-side">
        <Card title={`Route map · ${r.id}`} right={can && <div className="row">
          <button className={'btn sm' + (mode === 'add' ? ' pri' : '')} onClick={() => setMode(mode === 'add' ? null : 'add')}>{mode === 'add' ? 'Click the map…' : 'Add a stop'}</button>
          {mode && <button className="btn sm" onClick={() => setMode(null)}>Cancel</button>}</div>}>
          <RouteMap db={db} route={r} order={r.stops} kids={kids} suggestions={mineSug.newStops} onPick={mode ? onMap : null} />
          <p className="small muted">{mode === 'add' ? 'Click where the new stop should be.' : mode?.move ? `Click the new place for ${mode.move}.` : 'The blue line is the morning drive; small dots are riders’ homes; dashed circles are suggested new stops. Use Add a stop, or Move on map in the stop list, as new stops come up.'}</p>
        </Card>
        <Card title="Stops in order"><ol className="small" style={{ paddingLeft: 18 }}>{r.stops.map((st) => <li key={st.name}>{st.name} · {st.am} / {st.pm} · {kids.filter((k) => k.stop === st.name).length} riders
          {can && <button className="btn sm" style={{ marginLeft: 6 }} onClick={() => setMode({ move: st.name })}>Move</button>}</li>)}<li>School · arrive {r.schoolArrive}</li></ol>
          <p className="small muted">In production the map shows streets (Google Maps or OpenStreetMap) and road distances; here it is a plan view with straight-line distances.</p></Card>
      </div>}
      </div>
      {newStop && <Modal title={`New stop on ${r.id}`} onClose={() => setNewStop(null)} actions={<button className="btn pri" onClick={() => { if (tryRun((d) => addStop(d, r.id, newStop), `${newStop.name} added — the route order and times are worked out again`)) { setNewStop(null); setTab('stops'); } }}>Add stop</button>}>
        <Field label="Stop name (a landmark parents know)" req><Input value={newStop.name} onChange={(e) => setNewStop({ ...newStop, name: e.target.value })} placeholder="e.g. Agara Lake Gate" /></Field>
        <p className="small">It goes into the route where it adds the least driving; the morning and afternoon times are worked out again. {newStop.riders.length ? `${newStop.riders.length} rider(s) will board here.` : ''}</p>
        {kids.length > 0 && <Field label="Riders who will board here (optional)"><div style={{ maxHeight: 160, overflow: 'auto' }}>{kids.sort((a, b) => km(a.home || SCHOOL, newStop) - km(b.home || SCHOOL, newStop)).slice(0, 8).map((k) => <label key={k.id} className="row small"><input type="checkbox" checked={newStop.riders.includes(k.id)}
          onChange={(e) => setNewStop({ ...newStop, riders: e.target.checked ? [...newStop.riders, k.id] : newStop.riders.filter((x) => x !== k.id) })} />{fullName(k)} · now {k.stop}{k.home ? ` · ${km(k.home, newStop).toFixed(1)} km from here` : ''}</label>)}</div></Field>}
      </Modal>}
      {edit && <Modal title={`Edit ${edit.id} · ${edit.name}`} onClose={() => setEdit(null)} actions={<button className="btn pri" onClick={save}>Save</button>}>
        <div className="form">
          <Field label="Driver"><Input value={edit.driver} onChange={(e) => setEdit({ ...edit, driver: e.target.value })} /></Field>
          <Field label="Driver mobile (gets the route sheet)"><Input maxLength={10} value={edit.driverMobile} onChange={(e) => setEdit({ ...edit, driverMobile: e.target.value })} /></Field>
          <Field label="Attendant"><Input value={edit.attendant} onChange={(e) => setEdit({ ...edit, attendant: e.target.value })} /></Field>
          <Field label="Reaches school (morning)"><Input type="time" value={edit.schoolArrive} onChange={(e) => setEdit({ ...edit, schoolArrive: e.target.value })} /></Field>
          <Field label="Leaves school (afternoon)"><Input type="time" value={edit.schoolLeave} onChange={(e) => setEdit({ ...edit, schoolLeave: e.target.value })} /></Field>
        </div>
        <table className="t" style={{ marginTop: 12 }}><thead><tr><th>Stop</th><th>Morning pickup</th><th>Afternoon drop</th></tr></thead>
          <tbody>{edit.stops.map((st, i) => <tr key={st.name}><td>{st.order}. {st.name}</td>
            <td><Input type="time" aria-label={st.name + ' morning'} value={st.am} onChange={(e) => { const stops = [...edit.stops]; stops[i] = { ...st, am: e.target.value }; setEdit({ ...edit, stops }); }} /></td>
            <td><Input type="time" aria-label={st.name + ' afternoon'} value={st.pm} onChange={(e) => { const stops = [...edit.stops]; stops[i] = { ...st, pm: e.target.value }; setEdit({ ...edit, stops }); }} /></td></tr>)}</tbody></table>
        <div className="row" style={{ marginTop: 10 }}><button className="btn sm" onClick={() => setEdit({ ...edit, stops: timingsFor(edit.stops, edit.schoolArrive, edit.schoolLeave) })}>Work out times from the map</button><span className="small muted">Fills every stop from the distances on the map and the school times above.</span></div>
      </Modal>}
    </Page>
  );
}

// Plan view of a route, zoomed to fit it: school, stops in order joined by the morning drive, riders' homes,
// suggested new stops, and other routes' stops faint. 1 map unit = 0.5 km.
function RouteMap({ db, route, order, kids, suggestions = [], onPick }) {
  const pts = [SCHOOL, ...order.filter((s) => s.x != null), ...route.stops.filter((s) => s.x != null), ...kids.filter((k) => k.home).map((k) => k.home), ...suggestions];
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const span = Math.max(12, Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) + 8;
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  const vb = [cx - span / 2, cy - span / 2, span, span];
  const u = span / 100;                                // size unit so text and dots look the same at any zoom
  const step = [2, 4, 10, 20].find((g) => span / g <= 12) || 20;
  const grid = []; for (let g = Math.ceil(vb[0] / step) * step; g < vb[0] + span; g += step) grid.push(['x', g]); for (let g = Math.ceil(vb[1] / step) * step; g < vb[1] + span; g += step) grid.push(['y', g]);
  const click = (e) => { if (!onPick) return; const b = e.currentTarget.getBoundingClientRect(); onPick({ x: vb[0] + ((e.clientX - b.left) / b.width) * span, y: vb[1] + ((e.clientY - b.top) / b.height) * span }); };
  const line = [...order.filter((s) => s.x != null), SCHOOL];
  return <svg className={'routemap' + (onPick ? ' placing' : '')} viewBox={vb.join(' ')} onClick={click} role="img" aria-label={`Map of ${route.id}: ${order.map((s) => s.name).join(', ')}, then school`}>
    {grid.map(([k, g]) => (k === 'x' ? <line key={'x' + g} x1={g} y1={vb[1]} x2={g} y2={vb[1] + span} stroke="var(--line)" strokeWidth={0.2 * u} /> : <line key={'y' + g} x1={vb[0]} y1={g} x2={vb[0] + span} y2={g} stroke="var(--line)" strokeWidth={0.2 * u} />))}
    {db.routes.filter((x) => x.id !== route.id).map((x) => <g key={x.id} opacity=".4">{x.stops.filter((s) => s.x != null).map((s) => <circle key={s.name} cx={s.x} cy={s.y} r={0.9 * u} fill="var(--ink-3)"><title>{x.id} · {s.name}</title></circle>)}</g>)}
    {kids.filter((k) => k.home).map((k) => <circle key={k.id} cx={k.home.x} cy={k.home.y} r={0.8 * u} fill="var(--s2)" opacity=".8"><title>{fullName(k)} · boards at {k.stop}</title></circle>)}
    {suggestions.map((n, i) => <circle key={i} cx={n.x} cy={n.y} r={3.5 * u} fill="none" stroke="var(--s3)" strokeWidth={0.6 * u} strokeDasharray={`${1.5 * u} ${u}`}><title>Suggested new stop for {n.riders.length} riders</title></circle>)}
    <polyline points={line.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="var(--s1)" strokeWidth={0.9 * u} strokeLinejoin="round" />
    {order.filter((s) => s.x != null).map((s, i) => <g key={s.name}><circle cx={s.x} cy={s.y} r={2.4 * u} fill="var(--s1)" stroke="var(--surface)" strokeWidth={0.5 * u} />
      <text x={s.x} y={s.y + 1 * u} fontSize={2.8 * u} textAnchor="middle" fill="#fff" fontWeight="700">{i + 1}</text>
      <text x={s.x + 3.4 * u} y={s.y - 2 * u} fontSize={2.8 * u} fill="var(--ink)" stroke="var(--surface)" strokeWidth={0.6 * u} paintOrder="stroke">{s.name} · {s.am}</text></g>)}
    <rect x={SCHOOL.x - 2.4 * u} y={SCHOOL.y - 2.4 * u} width={4.8 * u} height={4.8 * u} rx={u} fill="var(--ink)" />
    <text x={SCHOOL.x} y={SCHOOL.y + 6 * u} fontSize={3 * u} textAnchor="middle" fill="var(--ink)" fontWeight="700" stroke="var(--surface)" strokeWidth={0.6 * u} paintOrder="stroke">School · {route.schoolArrive}</text>
    <text x={vb[0] + 1.5 * u} y={vb[1] + span - 1.5 * u} fontSize={2.4 * u} fill="var(--ink-3)">1 square = {step * KM_PER_UNIT} km</text>
  </svg>;
}

// ---------- Driver route sheets: one per route, shared with that route's driver only ----------
const MARK = { BOARD: '✓', NOT_BOARDING: '✗', ABSENT: '✗', CHECK: '?' };
function Sheet({ db, sh, compact, tracking }) {
  const r = sh.route;
  const block = (trip) => <div style={{ marginTop: 12 }}>
    <div className="b" style={{ marginBottom: 6 }}>{trip === 'AM' ? `Morning pickup → school by ${r.schoolArrive}` : `Afternoon drop · leave school ${r.schoolLeave}`} · board {trip === 'AM' ? sh.am.board : sh.pm.board}</div>
    <table className="t"><thead><tr><th>Time</th><th>Stop</th><th>Student</th>{!compact && <th>Class</th>}<th>Today</th>{tracking && !compact && <th>Tick</th>}</tr></thead>
      <tbody>{(trip === 'AM' ? sh.stops : [...sh.stops].reverse()).flatMap((st) => { const rows = trip === 'AM' ? st.morning : st.afternoon;
        return rows.length ? rows.map((x, i) => <tr key={trip + x.id} style={{ background: x.status !== 'BOARD' ? 'var(--warn-bg)' : undefined }}>
          <td className="b">{i === 0 ? (trip === 'AM' ? st.am : st.pm) : ''}</td><td>{i === 0 ? st.name : ''}</td><td className={x.status === 'BOARD' ? '' : 'b'}>{MARK[x.status]} {x.name}</td>{!compact && <td>{x.cls}</td>}
          <td className="small">{x.status === 'BOARD' ? 'Boards' : x.reason}</td>{tracking && !compact && <td>☐</td>}</tr>)
          : [<tr key={trip + st.name}><td className="b">{trip === 'AM' ? st.am : st.pm}</td><td>{st.name}</td><td className="muted small" colSpan={compact ? 2 : tracking ? 4 : 3}>no riders</td></tr>]; })}</tbody></table></div>;
  return <div>
    <div className="row" style={{ justifyContent: 'space-between' }}><div><div className="b" style={{ fontSize: 16 }}>{r.id} · {r.name}</div><div className="small muted">{dmy(sh.date)} · Bus {r.bus} · Driver {r.driver} · Attendant {r.attendant}</div></div>
      <div className="small">{sh.changes ? <span className="pill warn">{sh.changes} change(s) this day</span> : <span className="pill ok">No changes</span>}</div></div>
    {block('AM')}{block('PM')}
    <p className="small muted" style={{ marginTop: 8 }}>✗ = do not wait for this child. ? = request waiting for the class coordinator — call the school before leaving the stop. School transport desk: {tenantOf(db).name}.</p>
  </div>;
}

export function DriverRouteSheets() {
  const { db, run, notify, session } = useStore();
  const [date, setDate] = useState(today());
  const [route, setRoute] = useState(db.routes[0].id);
  const [phone, setPhone] = useState(false);
  const tracking = funcOn(tenantOf(db), 'FN_ATTENDANT_TRACKING');
  const sh = routeSheet(db, route, date);
  const shares = db.routeShares.filter((x) => x.date === date);
  const excel = () => {
    const wb = XLSX.utils.book_new();
    db.routes.forEach((rt) => {
      const one = routeSheet(db, rt.id, date);
      const rows = [[`${rt.id} · ${rt.name}`, `Bus ${rt.bus}`, `Driver ${rt.driver} ${rt.driverMobile}`, `Attendant ${rt.attendant}`, dmy(date)], [],
        ['Trip', 'Time', 'Stop', 'Student', 'Class', 'Today', 'Reason']];
      ['AM', 'PM'].forEach((trip) => (trip === 'AM' ? one.stops : [...one.stops].reverse()).forEach((st) => (trip === 'AM' ? st.morning : st.afternoon).forEach((x) =>
        rows.push([trip === 'AM' ? `Morning (school ${rt.schoolArrive})` : `Afternoon (leave ${rt.schoolLeave})`, trip === 'AM' ? st.am : st.pm, st.name, x.name, x.cls, x.status === 'BOARD' ? 'Boards' : x.status === 'CHECK' ? 'Check' : 'Not boarding', x.reason]))));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), rt.id);
    });
    try { XLSX.writeFile(wb, `route-sheets-${date}.xlsx`); } catch (e) { notify('Downloads are off in this preview — use the hosted site'); }
  };
  return (
    <Page title="Driver route sheets" sub="One sheet per route (Route #) with the stop timings for the morning pickup and the afternoon drop, and who will and won't board today. Each driver receives only their own route's sheet."
      actions={<><button className="btn" onClick={excel}>Download all (Excel, one tab per route)</button><button className="btn" onClick={printPage}>Print</button>
        <button className="btn pri" onClick={() => { const sent = run((d) => shareRouteSheets(d, date, session.name || session.role)); notify(`Sent to ${sent.length} drivers — each gets only their route`); }}>Send to all drivers</button></>}>
      <Card><div className="row" style={{ alignItems: 'flex-end' }}>
        <label className="f">Date<Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <div className="f"><span className="small b">Route #</span><div className="row">{db.routes.map((r) => <button key={r.id} className={'btn sm' + (route === r.id ? ' pri' : '')} onClick={() => setRoute(r.id)}>{r.id}</button>)}</div></div>
        <button className="btn sm" onClick={() => { run((d) => shareRouteSheets(d, date, session.name || session.role, [route])); notify(`Sent to the ${route} driver`); }}>Send this route</button>
        <button className="btn sm" onClick={() => setPhone(true)}>What the driver sees</button>
      </div>
      <p className="small muted" style={{ marginTop: 8 }}>Drivers get an SMS with a private link (once SMS is connected; queued until then). The link opens a read-only sheet for that route and day, and refreshes when a parent changes a pickup or drop. Sent today: {shares.length ? [...new Set(shares.map((x) => x.routeId))].join(', ') : 'none yet'}.</p></Card>
      <Card><Sheet db={db} sh={sh} tracking={tracking} /></Card>
      {phone && <Modal title={`Driver link · ${route}`} onClose={() => setPhone(false)}><div style={{ maxWidth: 380, margin: '0 auto', border: '8px solid #14171C', borderRadius: 24, padding: 12 }}><Sheet db={db} sh={sh} compact tracking={false} /></div></Modal>}
    </Page>
  );
}
