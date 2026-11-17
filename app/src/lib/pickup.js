// Parent requests (in-person pickup / drop, early leave, own transport), class coordinators,
// gate handover and the bus manifests built from them.
import { queueSms } from './sms.js';
import { fullName, classLabel, guardianOf, tenantOf, log } from './logic.js';

export const REQ_TYPES = {
  PICKUP: { name: 'In-person pickup after school', trips: ['PM'], short: 'Parent collecting in person' },
  DROP: { name: 'In-person drop in the morning', trips: ['AM'], short: 'Parent dropping in person' },
  EARLY_LEAVE: { name: 'Early leave (collected during the day)', trips: ['PM'], short: 'Left school early' },
  OWN_TRANSPORT: { name: 'Coming and going by own transport', trips: ['AM', 'PM'], short: 'Own transport' }
};
export const DISMISSAL = '15:00';
// No cut-off times: bus changes are confirmed whenever they are sent and reach the driver's route sheet at once.
// Early leave still needs a class coordinator, because a child leaves during the school day.

const today = () => new Date().toISOString().slice(0, 10);
const now = () => new Date().toTimeString().slice(0, 5);
export const covers = (r, date) => r.dateFrom <= date && date <= (r.dateTo || r.dateFrom);
export const coordinatorsOf = (db, sectionId) => db.coordinators[sectionId] || {};
export const staffName = (db, id) => { const s = db.staff.find((x) => x.id === id); return s ? `${s.first} ${s.last}` : '—'; };
export const sectionsCoordinatedBy = (db, staffId) => Object.entries(db.coordinators).filter(([, c]) => c.primary === staffId || c.secondary === staffId).map(([s]) => s);

export const needsCoordinator = (type) => type === 'EARLY_LEAVE';

// ---------- Authorised (pre-approved) people who may collect a child ----------
// The guardians on the child's record are always authorised. Others are added by the parent and verified by the school.
export function collectorsFor(db, studentId, { verifiedOnly = false } = {}) {
  const s = db.students.find((x) => x.id === studentId);
  const g = guardianOf(db, s);
  const own = g ? [{ id: 'G-' + g.id, studentId, name: g.name, relation: g.relation, mobile: g.mobile, status: 'VERIFIED', isGuardian: true }] : [];
  const today = new Date().toISOString().slice(0, 10);
  return own.concat((db.collectors || []).filter((c) => c.studentId === studentId && c.status !== 'REVOKED' && (!c.validUntil || c.validUntil >= today) && (!verifiedOnly || c.status === 'VERIFIED')));
}
export function addCollector(db, f, by) {
  if (!f.name?.trim()) throw new Error('Name is required');
  if (!/^[6-9]\d{9}$/.test(f.mobile || '')) throw new Error('10-digit mobile is required');
  if (!f.photo) throw new Error('A photo is required so the gate can recognise them');
  if (!/^\d{4}$/.test(f.idLast4 || '')) throw new Error('Last 4 digits of their photo ID are required');
  if (collectorsFor(db, f.studentId).some((c) => c.mobile === f.mobile)) throw new Error('This person is already on the list');
  db.seq.collector = (db.seq.collector || 0) + 1;
  const c = { id: 'AC' + db.seq.collector, studentId: f.studentId, name: f.name.trim(), relation: f.relation, mobile: f.mobile, photo: f.photo, idType: f.idType, idLast4: f.idLast4,
    validUntil: f.validUntil || '', status: 'PENDING', addedBy: by, addedAt: new Date().toISOString() };
  db.collectors.push(c);
  log(db, by, 'Authorised person added', `${c.name} for ${db.students.find((x) => x.id === f.studentId).admNo} — waiting for school check`);
  return c;
}
export function verifyCollector(db, id, ok, by) {
  const c = db.collectors.find((x) => x.id === id);
  c.status = ok ? 'VERIFIED' : 'REVOKED'; c.verifiedBy = by; c.verifiedAt = new Date().toISOString();
  log(db, by, ok ? 'Authorised person verified' : 'Authorised person rejected', c.name);
  return c;
}

function notify(db, { to, subject, body, kind, related }) {
  db.outbox.unshift({ id: 'M' + (db.outbox.length + 1), to, subject, body, kind, related, status: to ? 'SENT' : 'NO_EMAIL', at: new Date().toISOString() });
}
function tellCoordinators(db, r, s, what) {
  const sec = db.sections.find((x) => x.id === s.sectionId);
  const c = coordinatorsOf(db, sec.id);
  [['Primary', c.primary], ['Secondary', c.secondary]].forEach(([lvl, id]) => {
    const st = db.staff.find((x) => x.id === id);
    if (st) notify(db, { to: st.email, kind: 'Coordinator alert', related: r.no, subject: `${what}: ${fullName(s)} (${classLabel(db, s)}) — ${REQ_TYPES[r.type].name}`,
      body: `<p>${lvl} coordinator for ${classLabel(db, s)}.</p><p><b>${fullName(s)}</b> · ${REQ_TYPES[r.type].name} · ${r.dateFrom}${r.dateTo && r.dateTo !== r.dateFrom ? ' to ' + r.dateTo : ''}${r.time ? ' at ' + r.time : ''}.</p><p>Reason: ${r.reason || '—'}${r.collector?.name ? `<br>Collected by: ${r.collector.name} (${r.collector.relation}), ${r.collector.mobile}` : ''}</p><p>Status: ${r.status}</p>` });
  });
}
function tellTransport(db, r, s) {
  if (!s.band) return;
  db.users.filter((u) => u.role === 'TRANSPORT' && u.status === 'ACTIVE' && u.email).forEach((u) => notify(db, { to: u.email, kind: 'Transport change', related: r.no,
    subject: `Bus change ${r.dateFrom}: ${fullName(s)} (${s.routeId}) — ${REQ_TYPES[r.type].short}`, body: `<p>Route ${s.routeId}, stop ${s.stop || '—'}: <b>${fullName(s)}</b> (${classLabel(db, s)}) will not board ${REQ_TYPES[r.type].trips.join(' and ')} on ${r.dateFrom}${r.dateTo && r.dateTo !== r.dateFrom ? '–' + r.dateTo : ''}. ${REQ_TYPES[r.type].short}.</p>` }));
}

export function submitRequest(db, f, user) {
  const s = db.students.find((x) => x.id === f.studentId);
  if (f.dateFrom < today()) throw new Error('Pick today or a later date');
  if (f.dateTo && f.dateTo < f.dateFrom) throw new Error('End date is before the start date');
  if (f.type === 'EARLY_LEAVE') {
    if (!f.time || f.time >= DISMISSAL) throw new Error(`Early leave time must be before ${DISMISSAL}`);
    if (f.dateFrom === today() && f.time <= now()) throw new Error('That time has already passed');
  }
  if (['PICKUP', 'EARLY_LEAVE'].includes(f.type)) {
    const c = collectorsFor(db, s.id, { verifiedOnly: true }).find((x) => x.id === f.collectorId);
    if (!c) throw new Error('Choose a person from the child\u2019s approved pickup list');
    f = { ...f, collector: { id: c.id, name: c.name, relation: c.relation, mobile: c.mobile, photo: c.photo || null, idType: c.idType, idLast4: c.idLast4 } };
  }
  if (db.requests.some((x) => x.studentId === s.id && x.type === f.type && ['Submitted', 'Approved'].includes(x.status) && covers(x, f.dateFrom))) throw new Error('There is already a request of this kind for that day');
  db.seq.request = (db.seq.request || 0) + 1;
  const r = { id: 'Q' + db.seq.request, no: 'REQ-' + String(db.seq.request).padStart(5, '0'), studentId: s.id, userId: user?.id, type: f.type, dateFrom: f.dateFrom, dateTo: f.type === 'EARLY_LEAVE' ? f.dateFrom : (f.dateTo || f.dateFrom),
    time: f.type === 'EARLY_LEAVE' ? f.time : '', reason: f.reason || '', collector: ['PICKUP', 'EARLY_LEAVE'].includes(f.type) ? f.collector : null,
    status: 'Submitted', gateCode: '', history: [{ status: 'Submitted', at: new Date().toISOString(), by: user?.name || 'Parent' }], createdAt: new Date().toISOString() };
  // Bus changes are confirmed straight away; early leave waits for a coordinator
  if (!needsCoordinator(r.type)) approve(db, r, 'Confirmed automatically');
  db.requests.unshift(r);
  tellCoordinators(db, r, s, r.status === 'Approved' ? 'For your information' : 'Needs your approval');
  if (r.status === 'Approved') tellTransport(db, r, s);
  log(db, user?.name || 'Parent', 'Parent request', `${r.no} ${REQ_TYPES[r.type].name} · ${fullName(s)}`);
  return r;
}

function approve(db, r, by) {
  r.status = 'Approved';
  r.history.push({ status: 'Approved', at: new Date().toISOString(), by });
  if (['PICKUP', 'EARLY_LEAVE'].includes(r.type)) r.gateCode = String(Math.floor(1000 + Math.random() * 9000));
}

export function decide(db, id, decision, { by, staffId, note = '' }) {
  const r = db.requests.find((x) => x.id === id);
  const s = db.students.find((x) => x.id === r.studentId);
  const c = coordinatorsOf(db, s.sectionId);
  if (staffId && ![c.primary, c.secondary].includes(staffId)) throw new Error('Only this class’s coordinators can decide');
  if (r.status !== 'Submitted') throw new Error('Already ' + r.status.toLowerCase());
  if (decision === 'Approved') approve(db, r, by);
  else { if (!note) throw new Error('Give a reason for declining'); r.status = 'Declined'; r.history.push({ status: 'Declined', at: new Date().toISOString(), by, note }); }
  const g = guardianOf(db, s);
  const school = tenantOf(db).name;
  notify(db, { to: g?.email, kind: 'Request update', related: r.no, subject: `${r.no} ${r.status.toLowerCase()} — ${fullName(s)}`,
    body: `<p>Your request (${REQ_TYPES[r.type].name}, ${r.dateFrom}${r.time ? ' at ' + r.time : ''}) was <b>${r.status.toLowerCase()}</b> by the class coordinator.${note ? ' Note: ' + note : ''}</p>${r.gateCode ? `<p>Gate code for collection: <b style="font-size:20px">${r.gateCode}</b> — the person collecting shows this and photo ID at the gate.</p>` : ''}` });
  if (r.gateCode && g?.mobile) queueSms(db, { to: g.mobile, purpose: 'GATE_CODE', vars: { student: s.first, time: r.time || DISMISSAL, code: r.gateCode, collector: r.collector?.name || '' }, related: r.no, schoolName: school });
  if (r.status === 'Approved') tellTransport(db, r, s);
  log(db, by, 'Request ' + r.status.toLowerCase(), r.no);
  return r;
}

export function cancelRequest(db, id, by) {
  const r = db.requests.find((x) => x.id === id);
  if (!['Submitted', 'Approved'].includes(r.status) || r.handedOverAt) throw new Error('This request can no longer be cancelled');
  r.status = 'Cancelled'; r.history.push({ status: 'Cancelled', at: new Date().toISOString(), by });
  tellCoordinators(db, r, db.students.find((x) => x.id === r.studentId), 'Cancelled by parent');
  return r;
}

// Gate desk: the collector gives the code; the student is handed over and the time recorded
export function handOver(db, id, code, by) {
  const r = db.requests.find((x) => x.id === id);
  if (r.status !== 'Approved') throw new Error('Not approved');
  if (String(code).trim() !== r.gateCode) throw new Error('Gate code does not match — do not hand over; call the parent');
  r.handedOverAt = new Date().toISOString(); r.handedOverBy = by; r.status = 'Completed';
  r.history.push({ status: 'Handed over', at: r.handedOverAt, by });
  const s = db.students.find((x) => x.id === r.studentId);
  tellCoordinators(db, r, s, 'Collected');
  log(db, by, 'Student handed over', `${r.no} · ${fullName(s)} to ${r.collector?.name}`);
  return r;
}

// ---------- Bus manifest for a date and trip ----------
export function manifest(db, date, trip) {
  const absent = (s) => (db.attendance[s.sectionId + ':' + date] || {})[s.id] === 'A';
  const rows = db.students.filter((s) => s.status === 'Active' && s.band).map((s) => {
    const reqs = db.requests.filter((r) => r.studentId === s.id && covers(r, date) && REQ_TYPES[r.type].trips.includes(trip) && !['Declined', 'Cancelled'].includes(r.status));
    const done = reqs.find((r) => ['Approved', 'Completed'].includes(r.status));
    const pending = reqs.find((r) => r.status === 'Submitted');
    let status = 'BOARD', reason = '';
    if (absent(s)) { status = 'ABSENT'; reason = 'Marked absent today'; }
    else if (done) {
      status = 'NOT_BOARDING';
      reason = done.type === 'EARLY_LEAVE' ? (done.handedOverAt ? `Left early at ${new Date(done.handedOverAt).toTimeString().slice(0, 5)} with ${done.collector.name} (${done.collector.relation})` : `Leaving early at ${done.time} with ${done.collector.name} (${done.collector.relation})`)
        : done.type === 'PICKUP' ? `Collected in person by ${done.collector.name} (${done.collector.relation})` : REQ_TYPES[done.type].short;
    } else if (pending) { status = 'CHECK'; reason = `${REQ_TYPES[pending.type].short} — waiting for coordinator`; }
    const board = db.boarding[`${date}:${trip}:${s.id}`];
    return { id: s.id, name: fullName(s), cls: classLabel(db, s), routeId: s.routeId, stop: s.stop || '', stopNo: s.stopNo || 0, guardian: guardianOf(db, s)?.mobile, status, reason, board };
  });
  const routes = db.routes.map((rt) => {
    const l = rows.filter((x) => x.routeId === rt.id).sort((a, b) => (trip === 'AM' ? a.stopNo - b.stopNo : b.stopNo - a.stopNo) || a.name.localeCompare(b.name));
    return { ...rt, rows: l, boarding: l.filter((x) => x.status === 'BOARD').length, notBoarding: l.filter((x) => ['NOT_BOARDING', 'ABSENT'].includes(x.status)).length, check: l.filter((x) => x.status === 'CHECK').length };
  });
  return { date, trip, routes, total: rows.length, boarding: rows.filter((x) => x.status === 'BOARD').length, notBoarding: rows.filter((x) => ['NOT_BOARDING', 'ABSENT'].includes(x.status)).length, check: rows.filter((x) => x.status === 'CHECK').length };
}

export function sendManifest(db, date, trip, by) {
  const m = manifest(db, date, trip);
  const html = m.routes.map((r) => `<h4>${r.id} · ${r.name} · bus ${r.bus} · ${r.driver}</h4><p>Board: ${r.boarding} · Not boarding: ${r.notBoarding}${r.check ? ` · Check: ${r.check}` : ''}</p><ul>${r.rows.filter((x) => x.status !== 'BOARD').map((x) => `<li><b>${x.name}</b> (${x.cls}) — ${x.reason}</li>`).join('')}</ul>`).join('');
  db.users.filter((u) => u.role === 'TRANSPORT' && u.status === 'ACTIVE' && u.email).forEach((u) => notify(db, { to: u.email, kind: 'Bus manifest', related: `${date} ${trip}`,
    subject: `${trip === 'AM' ? 'Morning pickup' : 'Afternoon drop'} manifest ${date}: ${m.boarding} boarding, ${m.notBoarding} not boarding`, body: html }));
  log(db, by, 'Manifest sent', `${date} ${trip}`);
  return m;
}

// ---------- Driver route sheet: one route, one day, with stop timings ----------
export function routeSheet(db, routeId, date) {
  const rt = db.routes.find((r) => r.id === routeId);
  const am = manifest(db, date, 'AM').routes.find((r) => r.id === routeId);
  const pm = manifest(db, date, 'PM').routes.find((r) => r.id === routeId);
  const stops = (rt.stops || []).map((st) => ({ ...st,
    morning: am.rows.filter((x) => x.stop === st.name), afternoon: pm.rows.filter((x) => x.stop === st.name) }));
  return { route: rt, date, stops, am: { board: am.boarding, not: am.notBoarding, check: am.check }, pm: { board: pm.boarding, not: pm.notBoarding, check: pm.check },
    changes: [...am.rows, ...pm.rows].filter((x) => x.status !== 'BOARD').length };
}

// Each driver gets only their own route's sheet (link by email / SMS); the link opens a read-only page for that day
export function shareRouteSheets(db, date, by, routeIds = null) {
  const school = tenantOf(db).name;
  const sent = [];
  db.routes.filter((r) => !routeIds || routeIds.includes(r.id)).forEach((r) => {
    const sh = routeSheet(db, r.id, date);
    const token = Math.random().toString(36).slice(2, 10);
    const link = `https://${tenantOf(db).subdomain}.yourapp.com/route-sheet/${r.id}/${date}?t=${token}`;
    db.routeShares.unshift({ routeId: r.id, date, token, to: r.driverMobile, at: new Date().toISOString(), by });
    queueSms(db, { to: r.driverMobile, purpose: 'ROUTE_SHEET', vars: { route: r.id, date, board: sh.am.board + '/' + sh.pm.board, changes: sh.changes, link }, related: r.id + ' ' + date, schoolName: school });
    sent.push(r.id);
  });
  db.routeShares = db.routeShares.slice(0, 200);
  log(db, by, 'Route sheets shared', `${date} · ${sent.join(', ')}`);
  return sent;
}
