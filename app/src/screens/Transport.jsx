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

export function RoutesRiders() {
  const { db, run, notify, session } = useStore();
  const [edit, setEdit] = useState(null);
  const can = ['ADMIN', 'TRANSPORT', 'PRINCIPAL'].includes(session.role);
  const okTime = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
  const save = () => {
    const bad = !okTime(edit.schoolArrive) || !okTime(edit.schoolLeave) || edit.stops.some((s) => !okTime(s.am) || !okTime(s.pm)) ? 'Use HH:MM times'
      : edit.stops.some((s, i) => i && s.am <= edit.stops[i - 1].am) ? 'Morning times must get later stop by stop'
      : edit.stops.some((s) => s.am >= edit.schoolArrive) ? 'Morning pickups must be before the bus reaches school'
      : edit.stops.some((s) => s.pm <= edit.schoolLeave) ? 'Afternoon drops must be after the bus leaves school'
      : !/^[6-9]\d{9}$/.test(edit.driverMobile) ? 'Driver mobile must be 10 digits' : '';
    if (bad) { notify(bad); return; }
    run((d) => { const r = d.routes.find((x) => x.id === edit.id); Object.assign(r, edit); });
    notify('Timings saved — drivers see them on their next route sheet'); setEdit(null);
  };
  return (
    <Page title="Routes, stops & timings" sub="Each route's bus, driver, attendant and the time the bus reaches each stop: morning pickup and afternoon drop. These timings print on the drivers' route sheets.">
      <div className="grid g2">{db.routes.map((r) => { const kids = db.students.filter((s) => s.status === 'Active' && s.routeId === r.id);
        return <Card key={r.id} title={`${r.id} · ${r.name}`} right={can && <button className="btn sm" onClick={() => setEdit(structuredClone(r))}>Edit timings</button>}>
          <p className="small">Bus {r.bus} · Driver {r.driver} ({r.driverMobile}) · Attendant {r.attendant} · {kids.length}/{r.capacity} seats</p>
          <table className="t"><thead><tr><th>#</th><th>Stop</th><th className="num">Morning pickup</th><th className="num">Afternoon drop</th><th className="num">Riders</th></tr></thead>
            <tbody>{r.stops.map((st) => <tr key={st.name}><td>{st.order}</td><td>{st.name}</td><td className="num">{st.am}</td><td className="num">{st.pm}</td><td className="num">{kids.filter((k) => k.stop === st.name).length}</td></tr>)}
              <tr><td /><td className="b">School</td><td className="num b">arrive {r.schoolArrive}</td><td className="num b">leave {r.schoolLeave}</td><td /></tr></tbody></table></Card>; })}</div>
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
      </Modal>}
    </Page>
  );
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
