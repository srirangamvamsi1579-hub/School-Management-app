import { useState } from 'react';
import { useStore } from '../data/store.js';
import { Page, Card, Field, Input, Select, Modal, Stat, Tabs } from '../components/ui.jsx';
import { dmy } from '../lib/format.js';
import { fullName, classLabel, guardianOf } from '../lib/logic.js';
import { REQ_TYPES, GROUPS, DECIDER, DISMISSAL, SCHOOL_START, MEET_MODES, MEET_SLOTS, OTHER_KINDS, teachersFor, markArrived, submitRequest, decide, cancelRequest, handOver, coordinatorsOf, staffName, sectionsCoordinatedBy, collectorsFor, addCollector, verifyCollector } from '../lib/pickup.js';

const KIND = { Submitted: 'warn', Approved: 'ok', Completed: 'ok', Declined: 'bad', Cancelled: '' };
const WAIT = { COORDINATOR: 'Waiting for coordinator', TEACHER: 'Waiting for teacher', OFFICE: 'With the office', AUTO: 'Submitted' };
export const ReqStatus = ({ s, type }) => <span className={'pill ' + (KIND[s] || '')}>{s === 'Submitted' ? WAIT[DECIDER[type] || 'COORDINATOR'] : s === 'Approved' && type === 'MEETING' ? 'Confirmed' : s === 'Completed' && type === 'OTHER' ? 'Done' : s}</span>;
const HINT = { EARLY_LEAVE: 'Needs coordinator approval; gate code sent to you', OWN_TRANSPORT: 'One day or a date range; confirmed at once', PICKUP: 'Confirmed at once; the driver\u2019s route sheet updates', DROP: 'Confirmed at once; the driver\u2019s route sheet updates',
  LEAVE: 'Coordinator approves; attendance shows Leave and the bus skips the stop', LATE_ARRIVAL: 'Confirmed at once; the gate and class teacher expect you', MEETING: 'Pick a teacher; they confirm a time with you', OTHER: 'Certificates, documents, queries — goes to the office' };
const detail = (db, r) => r.type === 'MEETING' ? `${staffName(db, r.teacherId)} · ${r.mode}${r.meetAt ? ` · ${dmy(r.meetAt.date)} ${r.meetAt.time}` : ' · ' + r.slot}` : r.type === 'OTHER' ? r.category : r.collector ? `${r.collector.name} (${r.collector.relation})` : '—';
const today = () => new Date().toISOString().slice(0, 10);
const when = (r) => `${dmy(r.dateFrom)}${r.dateTo && r.dateTo !== r.dateFrom ? ' – ' + dmy(r.dateTo) : ''}${r.time ? ' · ' + r.time : ''}`;

// Children linked to the signed-in parent (demo parent falls back to Aarav)
export function myChildren(db, session) {
  const u = db.users.find((x) => x.id === session.userId);
  const codes = (u?.children?.length ? u.children : [u?.linkedStudent || 'ADM-2025-0231']).filter(Boolean);
  return codes.map((c) => db.students.find((s) => s.admNo === c)).filter(Boolean);
}

export function ParentRequests() {
  const { db, run, notify, session } = useStore();
  const kids = myChildren(db, session);
  const me = db.users.find((u) => u.id === session.userId);
  const [form, setForm] = useState(null);
  const [err, setErr] = useState('');
  const g = kids[0] && guardianOf(db, kids[0]);
  const list = db.requests.filter((r) => kids.some((k) => k.id === r.studentId));
  const start = (type) => { setErr(''); const t0 = kids[0] ? teachersFor(db, kids[0].id)[0] : null; setForm({ type, studentId: kids[0]?.id, dateFrom: today(), dateTo: '', time: type === 'LATE_ARRIVAL' ? '10:00' : '12:00', reason: '', collectorId: g ? 'G-' + g.id : '', teacherId: t0?.id || '', mode: MEET_MODES[0], slot: MEET_SLOTS[2], category: OTHER_KINDS[0] }); };
  const save = () => {
    try { const r = run((d) => submitRequest(d, form, me || { name: session.name })); notify(r.status === 'Approved' ? `${r.no} confirmed — coordinators and transport informed` : `${r.no} sent to ${{ COORDINATOR: 'the class coordinators', TEACHER: staffName(db, r.teacherId), OFFICE: 'the school office' }[DECIDER[r.type]]}`); setForm(null); }
    catch (x) { setErr(x.message); }
  };
  if (!kids.length) return <Page title="Requests to school"><Card><p>No child is linked to your account yet. Ask the school office to link your child's admission number.</p></Card></Page>;
  const k = kids.find((x) => x.id === form?.studentId) || kids[0];
  const c = coordinatorsOf(db, k.sectionId);
  return (
    <Page title="Requests to school" sub="Leave, late arrival, in-person pickup or drop, early leave, own transport, a meeting with a teacher, or anything else. The right people at school see it straight away.">
      {GROUPS.map(([label, keys]) => <div key={label}><div className="small b muted" style={{ margin: '4px 0 6px' }}>{label}</div><div className="grid g4" style={{ marginBottom: 12 }}>
        {keys.map((key) => <button key={key} className="card" style={{ textAlign: 'left', cursor: 'pointer', marginBottom: 0 }} onClick={() => start(key)}>
          <div className="b">{REQ_TYPES[key].name}</div><div className="small muted" style={{ marginTop: 4 }}>{HINT[key]}</div></button>)}
      </div></div>)}
      <Card title={`Class coordinators — ${classLabel(db, k)}`}><p className="small">Primary: <b>{staffName(db, c.primary)}</b> · Secondary: <b>{staffName(db, c.secondary)}</b>{k.routeId ? <> · Bus {k.routeId}, stop {k.stop}</> : ' · Does not use school transport'}</p></Card>
      <Collectors kids={kids} />
      <Card title="My requests">
        {list.length === 0 ? <p className="muted">None yet.</p> : <div className="tw"><table className="t"><thead><tr><th>Ref</th><th>Child</th><th>Request</th><th>When</th><th>Details</th><th>Status</th><th>Gate code</th><th /></tr></thead>
          <tbody>{list.map((r) => { const s = db.students.find((x) => x.id === r.studentId); return <tr key={r.id}><td>{r.no}</td><td>{s.first}</td><td>{REQ_TYPES[r.type].name}</td><td>{when(r)}</td><td className="small">{detail(db, r)}</td>
            <td><ReqStatus s={r.status} type={r.type} />{r.history.at(-1).note && <div className="small muted">{r.history.at(-1).note}</div>}</td><td className="b">{r.status === 'Approved' && r.gateCode ? r.gateCode : '—'}</td>
            <td>{['Submitted', 'Approved'].includes(r.status) && <button className="btn sm" onClick={() => { try { run((d) => cancelRequest(d, r.id, session.name || 'Parent')); notify('Cancelled'); } catch (x) { notify(x.message); } }}>Cancel</button>}</td></tr>; })}</tbody></table></div>}
      </Card>
      {form && <Modal title={REQ_TYPES[form.type].name} onClose={() => setForm(null)} actions={<button className="btn pri" onClick={save}>Send request</button>}>
        <div className="form" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <Field label="Child"><Select value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })} options={kids.map((x) => [x.id, fullName(x) + ' · ' + classLabel(db, x)])} /></Field>
          {form.type === 'MEETING' && <Field label="Teacher" req><Select value={form.teacherId} onChange={(e) => setForm({ ...form, teacherId: e.target.value })} options={teachersFor(db, form.studentId).map((t) => [t.id, `${t.name} — ${t.subjects.join(', ')}`])} /></Field>}
          {form.type === 'MEETING' && <Field label="How"><Select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })} options={MEET_MODES} /></Field>}
          {form.type === 'OTHER' && <Field label="What do you need" req><Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} options={OTHER_KINDS} /></Field>}
          <Field label={['OWN_TRANSPORT', 'LEAVE'].includes(form.type) ? 'From' : form.type === 'MEETING' ? 'Preferred date' : form.type === 'OTHER' ? 'Needed by' : 'Date'} req><Input type="date" min={today()} value={form.dateFrom} onChange={(e) => setForm({ ...form, dateFrom: e.target.value })} /></Field>
          {form.type === 'MEETING' && <Field label="Preferred time"><Select value={form.slot} onChange={(e) => setForm({ ...form, slot: e.target.value })} options={MEET_SLOTS} /></Field>}
          {form.type === 'LATE_ARRIVAL' && <Field label={`Arriving at (after ${SCHOOL_START})`} req><Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></Field>}
          {['OWN_TRANSPORT', 'LEAVE'].includes(form.type) && <Field label="To (leave blank for one day)"><Input type="date" min={form.dateFrom} value={form.dateTo} onChange={(e) => setForm({ ...form, dateTo: e.target.value })} /></Field>}
          {form.type === 'EARLY_LEAVE' && <Field label={`Leave at (before ${DISMISSAL})`} req><Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></Field>}
          <Field label={form.type === 'MEETING' ? 'What would you like to discuss' : form.type === 'OTHER' ? 'Details' : 'Reason'} req={['LEAVE', 'MEETING', 'OTHER'].includes(form.type)} full><Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder={form.type === 'MEETING' ? 'e.g. progress in Maths this term' : form.type === 'OTHER' ? 'e.g. study certificate for passport application' : "e.g. doctor's appointment"} /></Field>
          {['PICKUP', 'EARLY_LEAVE'].includes(form.type) && <Field label="Person collecting (approved list)" req full>
            <Select value={form.collectorId} onChange={(e) => setForm({ ...form, collectorId: e.target.value })} options={[['', 'Choose…'], ...collectorsFor(db, form.studentId, { verifiedOnly: true }).map((c) => [c.id, `${c.name} (${c.relation})${c.isGuardian ? ' · guardian on record' : ''}`])]} /></Field>}
        </div>
        <p className="small muted" style={{ marginTop: 10 }}>{form.type === 'EARLY_LEAVE' ? 'The coordinator approves it; you then get a 4-digit gate code. The person collecting shows the code and photo ID at the gate.'
          : form.type === 'LEAVE' ? 'The class coordinator approves it. Attendance shows Leave for those days and the bus will not wait at your stop.'
          : form.type === 'MEETING' ? 'The teacher replies with a date and time. Personal phone numbers are not shared — calls go through the school.'
          : form.type === 'OTHER' ? 'The school office picks this up and tells you when it is ready.'
          : form.type === 'LATE_ARRIVAL' ? 'Confirmed straight away. The gate and the class coordinators expect your child; the morning bus will not wait.'
          : 'Confirmed straight away. The class coordinators are told and the driver\u2019s route sheet updates.'}{['PICKUP', 'EARLY_LEAVE'].includes(form.type) && ' Only people on the child\u2019s approved pickup list can collect; add others below and the school will verify them.'}</p>
        {err && <div className="note warn" role="alert">{err}</div>}
      </Modal>}
    </Page>
  );
}

export function CoordinatorDesk() {
  const { db, run, notify, session } = useStore();
  const me = db.users.find((u) => u.id === session.userId);
  const staffId = me?.staffId || (session.role === 'TEACHER' ? 'E1' : null);
  const all = ['PRINCIPAL', 'ADMIN'].includes(session.role);
  const mySecs = all ? db.sections.map((x) => x.id) : sectionsCoordinatedBy(db, staffId);
  const [day, setDay] = useState('UPCOMING');
  const [decline, setDecline] = useState(null);
  const [note, setNote] = useState('');
  const list = db.requests.filter((r) => !['MEETING', 'OTHER'].includes(r.type) && mySecs.includes(db.students.find((s) => s.id === r.studentId)?.sectionId) && (day === 'ALL' || (r.dateTo || r.dateFrom) >= today()));
  const waiting = list.filter((r) => r.status === 'Submitted');
  const act = (id, dec) => { try { run((d) => decide(d, id, dec, { by: session.name || session.role, staffId: all ? null : staffId, note })); notify(dec === 'Approved' ? 'Approved — parent, gate and bus team told' : 'Declined — parent told'); setDecline(null); setNote(''); } catch (x) { notify(x.message); } };
  if (!all && !mySecs.length) return <Page title="Coordinator desk"><Card><p>You are not a class coordinator for any section. The Principal assigns coordinators in Academics → Class Coordinators.</p></Card></Page>;
  return (
    <Page title="Coordinator desk" sub={all ? 'All sections (Principal / Admin view).' : `You coordinate ${mySecs.map((id) => { const x = db.sections.find((y) => y.id === id); return db.classes.find((c) => c.id === x.classId).name.replace('Grade ', '') + '-' + x.name; }).join(', ')}. Both the primary and secondary coordinator see every request and either can decide.`}>
      <div className="grid g4" style={{ marginBottom: 14 }}>
        <Stat label="Waiting for you" value={waiting.length} /><Stat label="Early leaves today" value={list.filter((r) => r.type === 'EARLY_LEAVE' && r.dateFrom === today() && r.status !== 'Declined' && r.status !== 'Cancelled').length} />
        <Stat label="Not taking the bus today" value={list.filter((r) => r.dateFrom <= today() && today() <= r.dateTo && ['Approved', 'Completed'].includes(r.status)).length} /><Stat label="Collected so far" value={list.filter((r) => r.status === 'Completed' && r.handedOverAt?.slice(0, 10) === today()).length} />
      </div>
      <Tabs tabs={[['UPCOMING', 'Today and upcoming'], ['ALL', 'All']]} value={day} onChange={setDay} />
      <div className="tw"><table className="t"><thead><tr><th>Ref</th><th>Student</th><th>Request</th><th>When</th><th>Reason</th><th>Collected by</th><th>Status</th><th /></tr></thead>
        <tbody>{list.length === 0 ? <tr><td colSpan={8} className="muted">Nothing here.</td></tr> : list.map((r) => { const s = db.students.find((x) => x.id === r.studentId); return <tr key={r.id}>
          <td>{r.no}</td><td className="b">{fullName(s)}<div className="small muted">{classLabel(db, s)}{s.routeId ? ` · bus ${s.routeId}` : ''}</div></td><td>{REQ_TYPES[r.type].name}</td><td>{when(r)}</td><td className="small">{r.reason}</td>
          <td className="small">{r.collector ? `${r.collector.name} (${r.collector.relation}) ${r.collector.mobile}` : '—'}</td>
          <td><ReqStatus s={r.status} type={r.type} />{r.handedOverAt && <div className="small muted">handed over {new Date(r.handedOverAt).toTimeString().slice(0, 5)}</div>}</td>
          <td>{r.status === 'Submitted' && <div className="row"><button className="btn sm pri" onClick={() => act(r.id, 'Approved')}>Approve</button><button className="btn sm" onClick={() => setDecline(r.id)}>Decline</button></div>}</td></tr>; })}</tbody></table></div>
      {decline && <Modal title="Decline request" onClose={() => setDecline(null)} actions={<button className="btn pri" disabled={!note} onClick={() => act(decline, 'Declined')}>Decline</button>}>
        <Field label="Reason (sent to the parent)"><Input value={note} onChange={(e) => setNote(e.target.value)} /></Field></Modal>}
    </Page>
  );
}

export function GateDesk() {
  const { db, run, notify, session } = useStore();
  const [codes, setCodes] = useState({});
  const [tab, setTab] = useState('today');
  const waiting = (db.collectors || []).filter((c) => c.status === 'PENDING').length;
  const list = db.requests.filter((r) => ['PICKUP', 'EARLY_LEAVE'].includes(r.type) && r.dateFrom <= today() && today() <= r.dateTo && ['Approved', 'Completed', 'Submitted'].includes(r.status))
    .sort((a, b) => (a.time || DISMISSAL).localeCompare(b.time || DISMISSAL));
  const late = db.requests.filter((r) => r.type === 'LATE_ARRIVAL' && r.dateFrom === today() && ['Approved', 'Completed'].includes(r.status)).sort((a, b) => a.time.localeCompare(b.time));
  const arrived = (r) => { try { run((d) => markArrived(d, r.id, session.name || session.role)); notify('Marked arrived — class coordinators told'); } catch (x) { notify(x.message); } };
  const go = (r) => { try { run((d) => handOver(d, r.id, codes[r.id] || '', session.name || session.role)); notify('Handed over — coordinators and parent records updated'); } catch (x) { notify(x.message); } };
  return (
    <Page title="Gate desk" sub="Today's early leaves and in-person pickups. Match the face to the photo, check the photo ID, enter the 4-digit code the collector gives you, then hand the child over.">
      <Tabs tabs={[['today', 'Today\u2019s collections'], ['verify', `Approve pickup people (${waiting})`]]} value={tab} onChange={setTab} />
      {tab === 'verify' ? <VerifyCollectors /> : <div className="tw"><table className="t"><thead><tr><th>Time</th><th>Student</th><th>Type</th><th>Collector</th><th>Status</th><th style={{ width: 230 }}>Gate code</th></tr></thead>
        <tbody>{list.length === 0 ? <tr><td colSpan={6} className="muted">No collections today.</td></tr> : list.map((r) => { const s = db.students.find((x) => x.id === r.studentId); return <tr key={r.id}>
          <td className="b">{r.time || DISMISSAL}</td><td className="b">{fullName(s)}<div className="small muted">{classLabel(db, s)}</div></td><td>{r.type === 'PICKUP' ? 'Pickup at dismissal' : 'Early leave'}</td>
          <td><div className="row"><Photo c={(db.collectors || []).find((c) => c.id === r.collector?.id) || r.collector} size={48} /><div>{r.collector?.name} ({r.collector?.relation})<div className="small muted">{r.collector?.mobile}{r.collector?.idLast4 ? ` · ${r.collector.idType} ••••${r.collector.idLast4}` : ''}</div></div></div></td><td><ReqStatus s={r.status} /></td>
          <td>{r.status === 'Approved' ? <div className="row"><Input aria-label="Gate code" maxLength={4} style={{ width: 80 }} value={codes[r.id] || ''} onChange={(e) => setCodes({ ...codes, [r.id]: e.target.value })} /><button className="btn sm pri" disabled={(codes[r.id] || '').length !== 4} onClick={() => go(r)}>Hand over</button></div>
            : r.status === 'Completed' ? <span className="small">Handed over {new Date(r.handedOverAt).toTimeString().slice(0, 5)}</span> : <span className="small muted">Not approved yet — do not release</span>}</td></tr>; })}</tbody></table></div>}
      {tab === 'today' && <Card title={`Expected late arrivals today (${late.length})`}>{late.length === 0 ? <p className="muted small">None.</p> : <div className="tw"><table className="t"><thead><tr><th>Expected</th><th>Student</th><th>Reason</th><th /></tr></thead>
        <tbody>{late.map((r) => { const s = db.students.find((x) => x.id === r.studentId); return <tr key={r.id}><td className="b">{r.time}</td><td>{fullName(s)}<div className="small muted">{classLabel(db, s)}</div></td><td className="small">{r.reason || '—'}</td>
          <td>{r.status === 'Completed' ? <span className="small">Arrived {new Date(r.arrivedAt).toTimeString().slice(0, 5)}</span> : <button className="btn sm pri" onClick={() => arrived(r)}>Arrived</button>}</td></tr>; })}</tbody></table></div>}</Card>}
    </Page>
  );
}

export function ClassCoordinators() {
  const { db, run, notify, session } = useStore();
  const teachers = db.staff.filter((s) => /GT|Coordinator/.test(s.desig));
  const set = (secId, lvl, v) => run((d) => { const c = d.coordinators[secId] || {}; d.coordinators[secId] = { ...c, [lvl]: v }; });
  return (
    <Page title="Class coordinators" sub="Each section has a primary and a secondary coordinator. Both receive every pickup, drop and early-leave request for the section; either can approve. They must be different people.">
      <div className="tw"><table className="t"><thead><tr><th>Class</th><th>Primary coordinator</th><th>Secondary coordinator</th><th className="num">Students</th><th className="num">Bus riders</th></tr></thead>
        <tbody>{db.sections.map((sec) => { const c = db.coordinators[sec.id] || {}; const cls = db.classes.find((x) => x.id === sec.classId); const kids = db.students.filter((s) => s.sectionId === sec.id && s.status === 'Active');
          return <tr key={sec.id}><td className="b">{cls.name}-{sec.name}</td>
            {['primary', 'secondary'].map((lvl) => <td key={lvl}><select className="i" aria-label={`${lvl} ${cls.name}-${sec.name}`} value={c[lvl] || ''} onChange={(e) => {
              const other = lvl === 'primary' ? c.secondary : c.primary;
              if (e.target.value && e.target.value === other) { notify('Primary and secondary must be different people'); return; }
              set(sec.id, lvl, e.target.value); notify('Saved');
            }}><option value="">— not set —</option>{teachers.map((t) => <option key={t.id} value={t.id}>{t.first} {t.last} ({t.short})</option>)}</select></td>)}
            <td className="num">{kids.length}</td><td className="num">{kids.filter((s) => s.routeId).length}</td></tr>; })}</tbody></table></div>
      {session.role !== 'ADMIN' && session.role !== 'PRINCIPAL' && <p className="small muted">Only the Principal or Admin can change coordinators.</p>}
    </Page>
  );
}

// ---------- Approved pickup list (parent side) ----------
const RELS = ['Mother', 'Father', 'Guardian', 'Grandparent', 'Uncle / Aunt', 'Elder sibling (18+)', 'Family driver', 'Neighbour'];
const ID_TYPES = ['Aadhaar', 'Driving licence', 'Passport', 'Voter ID', 'PAN'];
export const Photo = ({ c, size = 40 }) => c?.photo ? <img src={c.photo} alt={'Photo of ' + c.name} style={{ width: size, height: size, borderRadius: size / 2, objectFit: 'cover', flex: 'none' }} />
  : <div className="logo" style={{ width: size, height: size, borderRadius: size / 2, fontSize: size / 2.6 }} aria-hidden="true">{(c?.name || '?').split(' ').map((x) => x[0]).slice(0, 2).join('')}</div>;
const CST = { VERIFIED: ['ok', 'Approved'], PENDING: ['warn', 'Waiting for school check'], REVOKED: ['bad', 'Not approved'] };

function Collectors({ kids }) {
  const { db, run, notify, session } = useStore();
  const [sid, setSid] = useState(kids[0].id);
  const [f, setF] = useState(null);
  const [err, setErr] = useState('');
  const list = collectorsFor(db, sid);
  const onPhoto = (e) => { const file = e.target.files[0]; if (!file) return; if (file.size > 3e6) { setErr('Photo must be under 3 MB'); return; } const rd = new FileReader(); rd.onload = () => setF({ ...f, photo: rd.result }); rd.readAsDataURL(file); };
  const save = () => { try { run((d) => addCollector(d, { ...f, studentId: sid }, session.name || 'Parent')); notify('Added — the school will check their ID'); setF(null); setErr(''); } catch (x) { setErr(x.message); } };
  return (
    <Card title="Approved pickup list" right={<div className="row">{kids.length > 1 && <Select value={sid} onChange={(e) => setSid(e.target.value)} options={kids.map((k) => [k.id, k.first])} />}<button className="btn sm pri" onClick={() => { setErr(''); setF({ name: '', relation: 'Mother', mobile: '', idType: 'Aadhaar', idLast4: '', validUntil: '', photo: '' }); }}>Add a person</button></div>}>
      <p className="small muted">Only these people can collect {db.students.find((s) => s.id === sid).first} in person or for an early leave. The school checks each person's photo ID once before they are approved.</p>
      <div className="grid g3">{list.map((c) => <div key={c.id} className="row" style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 10 }}>
        <Photo c={c} /><div style={{ flex: 1 }}><div className="b small">{c.name}</div><div className="small muted">{c.relation} · {c.mobile}{c.validUntil ? ' · until ' + dmy(c.validUntil) : ''}</div>
          <span className={'pill ' + (c.isGuardian ? 'ok' : CST[c.status][0])}>{c.isGuardian ? 'Guardian on record' : CST[c.status][1]}</span></div>
        {!c.isGuardian && <button className="btn sm" aria-label={'Remove ' + c.name} onClick={() => run((d) => { const x = d.collectors.find((y) => y.id === c.id); x.status = 'REVOKED'; x.removedBy = session.name; })}>Remove</button>}</div>)}</div>
      {f && <Modal title="Add a person to the pickup list" onClose={() => setF(null)} actions={<button className="btn pri" onClick={save}>Add</button>}>
        <div className="form" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <Field label="Full name" req><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Relation"><Select value={f.relation} onChange={(e) => setF({ ...f, relation: e.target.value })} options={RELS} /></Field>
          <Field label="Mobile" req><Input maxLength={10} value={f.mobile} onChange={(e) => setF({ ...f, mobile: e.target.value.replace(/\D/g, '') })} /></Field>
          <Field label="Valid until (optional)"><Input type="date" value={f.validUntil} onChange={(e) => setF({ ...f, validUntil: e.target.value })} /></Field>
          <Field label="Photo ID type"><Select value={f.idType} onChange={(e) => setF({ ...f, idType: e.target.value })} options={ID_TYPES} /></Field>
          <Field label="Last 4 digits of the ID" req><Input maxLength={4} value={f.idLast4} onChange={(e) => setF({ ...f, idLast4: e.target.value.replace(/\D/g, '') })} /></Field>
          <Field label="Photo of the person" req full><div className="row">{f.photo && <Photo c={{ ...f }} size={56} />}<input type="file" accept="image/*" onChange={onPhoto} aria-label="Photo" /></div></Field>
        </div>
        <p className="small muted">Only the last 4 digits of the ID are kept. The gate sees the photo when they come.</p>
        {err && <div className="note warn" role="alert">{err}</div>}
      </Modal>}
    </Card>
  );
}

// ---------- School side: verify people parents have added ----------
export function VerifyCollectors() {
  const { db, run, notify, session } = useStore();
  const list = (db.collectors || []).filter((c) => c.status === 'PENDING');
  if (!list.length) return <p className="muted small">No one waiting to be checked.</p>;
  return <div className="tw"><table className="t"><thead><tr><th>Person</th><th>For student</th><th>Relation</th><th>Mobile</th><th>Photo ID</th><th>Added by</th><th /></tr></thead>
    <tbody>{list.map((c) => { const s = db.students.find((x) => x.id === c.studentId); return <tr key={c.id}><td><div className="row"><Photo c={c} /><b>{c.name}</b></div></td><td>{fullName(s)}<div className="small muted">{classLabel(db, s)}</div></td>
      <td>{c.relation}</td><td>{c.mobile}</td><td>{c.idType} ••••{c.idLast4}</td><td className="small">{c.addedBy}</td>
      <td><div className="row"><button className="btn sm pri" onClick={() => { run((d) => verifyCollector(d, c.id, true, session.name || session.role)); notify('Approved'); }}>ID checked — approve</button><button className="btn sm" onClick={() => { run((d) => verifyCollector(d, c.id, false, session.name || session.role)); notify('Not approved'); }}>Reject</button></div></td></tr>; })}</tbody></table></div>;
}

// ---------- Teacher: parent meeting requests addressed to me ----------
export function ParentMeetings() {
  const { db, run, notify, session } = useStore();
  const me = db.users.find((u) => u.id === session.userId);
  const all = ['PRINCIPAL', 'ADMIN'].includes(session.role);
  const staffId = me?.staffId || (session.role === 'TEACHER' ? 'E1' : null);
  const list = db.requests.filter((r) => r.type === 'MEETING' && (all || r.teacherId === staffId));
  const [pick, setPick] = useState(null);
  const [err, setErr] = useState('');
  const act = (dec) => { try { run((d) => decide(d, pick.id, dec, { by: session.name || session.role, staffId: all ? null : staffId, note: pick.note || '', meetAt: { date: pick.date, time: pick.time } })); notify(dec === 'Approved' ? 'Confirmed — the parent has been told' : 'Declined — the parent has been told'); setPick(null); } catch (x) { setErr(x.message); } };
  return (
    <Page title="Parent meetings" sub={all ? 'All meeting requests (Principal / Admin view).' : 'Parents asking to meet or call you. Confirm a time; the parent is told by email and in the app. Your personal number is never shared.'}>
      <div className="tw"><table className="t"><thead><tr><th>Ref</th><th>Student</th><th>Parent wants</th><th>Topic</th><th>Preferred</th>{all && <th>Teacher</th>}<th>Status</th><th /></tr></thead>
        <tbody>{list.length === 0 ? <tr><td colSpan={8} className="muted">No meeting requests.</td></tr> : list.map((r) => { const s = db.students.find((x) => x.id === r.studentId); return <tr key={r.id}><td>{r.no}</td>
          <td className="b">{fullName(s)}<div className="small muted">{classLabel(db, s)} · parent {guardianOf(db, s)?.name || ''}</div></td><td>{r.mode}</td><td className="small">{r.reason}</td><td className="small">{dmy(r.dateFrom)} · {r.slot}</td>{all && <td>{staffName(db, r.teacherId)}</td>}
          <td><ReqStatus s={r.status} type={r.type} />{r.meetAt && <div className="small">{dmy(r.meetAt.date)} {r.meetAt.time}</div>}</td>
          <td>{r.status === 'Submitted' && <button className="btn sm pri" onClick={() => { setErr(''); setPick({ id: r.id, date: r.dateFrom, time: '15:30', note: '' }); }}>Reply</button>}</td></tr>; })}</tbody></table></div>
      {pick && <Modal title="Reply to the parent" onClose={() => setPick(null)} actions={<><button className="btn" onClick={() => act('Declined')}>Decline</button><button className="btn pri" onClick={() => act('Approved')}>Confirm time</button></>}>
        <div className="form" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <Field label="Date" req><Input type="date" min={today()} value={pick.date} onChange={(e) => setPick({ ...pick, date: e.target.value })} /></Field>
          <Field label="Time" req><Input type="time" value={pick.time} onChange={(e) => setPick({ ...pick, time: e.target.value })} /></Field>
          <Field label="Note to parent (needed if you decline)" full><Input value={pick.note} onChange={(e) => setPick({ ...pick, note: e.target.value })} placeholder="e.g. Please come to the staff room, block B" /></Field>
        </div>{err && <div className="note warn" role="alert">{err}</div>}
      </Modal>}
    </Page>
  );
}

// ---------- Office: certificates, documents and other parent requests ----------
export function OfficeRequests() {
  const { db, run, notify, session } = useStore();
  const [tab, setTab] = useState('OPEN');
  const list = db.requests.filter((r) => r.type === 'OTHER' && (tab === 'ALL' || r.status === 'Submitted'));
  const [pick, setPick] = useState(null);
  const act = (dec) => { try { run((d) => decide(d, pick.id, dec, { by: session.name || session.role, note: pick.note })); notify(dec === 'Approved' ? 'Marked done — the parent has been told' : 'Declined — the parent has been told'); setPick(null); } catch (x) { notify(x.message); } };
  return (
    <Page title="Office requests" sub="Certificates, documents and queries sent by parents from the app or website.">
      <Tabs tabs={[['OPEN', 'Open'], ['ALL', 'All']]} value={tab} onChange={setTab} />
      <div className="tw"><table className="t"><thead><tr><th>Ref</th><th>Student</th><th>Needs</th><th>Details</th><th>Needed by</th><th>Status</th><th /></tr></thead>
        <tbody>{list.length === 0 ? <tr><td colSpan={7} className="muted">Nothing open.</td></tr> : list.map((r) => { const s = db.students.find((x) => x.id === r.studentId); return <tr key={r.id}><td>{r.no}</td>
          <td className="b">{fullName(s)}<div className="small muted">{classLabel(db, s)}</div></td><td>{r.category}</td><td className="small">{r.reason}</td><td>{dmy(r.dateFrom)}</td>
          <td><ReqStatus s={r.status} type={r.type} />{r.history.at(-1).note && <div className="small muted">{r.history.at(-1).note}</div>}</td>
          <td>{r.status === 'Submitted' && <button className="btn sm pri" onClick={() => setPick({ id: r.id, note: '' })}>Update</button>}</td></tr>; })}</tbody></table></div>
      {pick && <Modal title="Update the parent" onClose={() => setPick(null)} actions={<><button className="btn" disabled={!pick.note} onClick={() => act('Declined')}>Decline</button><button className="btn pri" onClick={() => act('Approved')}>Mark done</button></>}>
        <Field label="Message to the parent"><Input value={pick.note} onChange={(e) => setPick({ ...pick, note: e.target.value })} placeholder="e.g. Ready — collect from the office after 2 pm" /></Field></Modal>}
    </Page>
  );
}
