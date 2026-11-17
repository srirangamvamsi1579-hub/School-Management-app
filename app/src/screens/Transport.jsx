import { useState } from 'react';
import { useStore } from '../data/store.js';
import { Page, Card, Stat, Tabs, Input, printPage } from '../components/ui.jsx';
import { dmy } from '../lib/format.js';
import { fullName, classLabel } from '../lib/logic.js';
import { manifest, sendManifest, REQ_TYPES, staffName, coordinatorsOf } from '../lib/pickup.js';
import { ReqStatus } from './Requests.jsx';

const today = () => new Date().toISOString().slice(0, 10);
const ST = { BOARD: ['ok', 'Will board'], NOT_BOARDING: ['', 'Not boarding'], ABSENT: ['bad', 'Absent'], CHECK: ['warn', 'Check'] };

export function BusManifest() {
  const { db, run, mutate, notify, session } = useStore();
  const [date, setDate] = useState(today());
  const [trip, setTrip] = useState(new Date().getHours() < 11 ? 'AM' : 'PM');
  const [route, setRoute] = useState('ALL');
  const m = manifest(db, date, trip);
  const routes = m.routes.filter((r) => route === 'ALL' || r.id === route);
  const mark = (sid, v) => mutate((d) => { d.boarding[`${date}:${trip}:${sid}`] = v; });
  return (
    <Page title="Daily bus manifest" sub={`${trip === 'AM' ? 'Morning pickup' : 'Afternoon drop'} · ${dmy(date)}. Built from attendance and parents' pickup, drop, early-leave and own-transport requests, so the bus doesn't wait for a child who isn't coming.`}
      actions={<><button className="btn" onClick={printPage}>Print</button><button className="btn pri" onClick={() => { run((d) => sendManifest(d, date, trip, session.name || session.role)); notify('Manifest emailed to the transport team'); }}>Send to transport team</button></>}>
      <Card><div className="row" style={{ alignItems: 'flex-end' }}>
        <label className="f">Date<Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <div className="f"><span className="small b">Trip</span><div className="row"><button className={'btn sm' + (trip === 'AM' ? ' pri' : '')} onClick={() => setTrip('AM')}>Morning pickup</button><button className={'btn sm' + (trip === 'PM' ? ' pri' : '')} onClick={() => setTrip('PM')}>Afternoon drop</button></div></div>
        <div className="f"><span className="small b">Route</span><div className="row"><button className={'btn sm' + (route === 'ALL' ? ' pri' : '')} onClick={() => setRoute('ALL')}>All</button>{db.routes.map((r) => <button key={r.id} className={'btn sm' + (route === r.id ? ' pri' : '')} onClick={() => setRoute(r.id)}>{r.id}</button>)}</div></div>
      </div><p className="small muted" style={{ marginTop: 8 }}>Sent automatically at 06:30 for the morning pickup and 14:30 for the afternoon drop (scheduled job in production); changes after that are pushed to the bus attendant as they happen.</p></Card>
      <div className="grid g4" style={{ marginBottom: 14 }}><Stat label="Riders" value={m.total} /><Stat label="Will board" value={m.boarding} /><Stat label="Not boarding" value={m.notBoarding} sub="absent, early leave, collected, own transport" /><Stat label="Check with coordinator" value={m.check} sub="request waiting for approval" /></div>
      {routes.map((r) => <Card key={r.id} title={`${r.id} · ${r.name}`} right={<span className="small">Bus {r.bus} · {r.driver} · <b>{r.boarding}</b> boarding / {r.rows.length}</span>}>
        <div className="tw" style={{ maxHeight: 'none' }}><table className="t"><thead><tr><th>#</th><th>Stop</th><th>Student</th><th>Class</th><th>Status</th><th>Why</th><th>Parent mobile</th><th className="noprint">Attendant</th></tr></thead>
          <tbody>{r.rows.map((x, i) => <tr key={x.id} style={{ opacity: x.status === 'BOARD' ? 1 : 0.75 }}><td>{i + 1}</td><td>{x.stop}</td><td className="b">{x.name}</td><td>{x.cls}</td><td><span className={'pill ' + ST[x.status][0]}>{ST[x.status][1]}</span></td>
            <td className="small">{x.reason}</td><td className="small">{x.guardian}</td>
            <td className="noprint">{x.status === 'BOARD' || x.status === 'CHECK' ? <div className="row"><button className={'btn sm' + (x.board === true ? ' pri' : '')} onClick={() => mark(x.id, true)}>Boarded</button><button className={'btn sm' + (x.board === false ? ' pri' : '')} onClick={() => mark(x.id, false)}>No-show</button></div> : <span className="small muted">skip</span>}</td></tr>)}</tbody></table></div>
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
  const { db } = useStore();
  return (
    <Page title="Routes & riders" sub="Who normally rides each bus, by stop.">
      <div className="grid g2">{db.routes.map((r) => { const kids = db.students.filter((s) => s.status === 'Active' && s.routeId === r.id).sort((a, b) => a.stopNo - b.stopNo);
        return <Card key={r.id} title={`${r.id} · ${r.name}`} right={<span className="small">{kids.length}/{r.capacity} seats · {r.bus}</span>}>
          <table className="t"><tbody>{kids.map((s) => <tr key={s.id}><td className="small muted">{s.stop}</td><td>{fullName(s)}</td><td className="small">{classLabel(db, s)}</td></tr>)}</tbody></table></Card>; })}</div>
    </Page>
  );
}
