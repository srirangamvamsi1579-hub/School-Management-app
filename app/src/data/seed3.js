// Demo data for coordinators, transport stops, parent requests and SMS settings (all fictional).
import { rng } from '../lib/format.js';
import { hashPassword } from '../lib/auth.js';
import { PURPOSES } from '../lib/sms.js';

const STOPS = {
  R1: ['100 Feet Road', 'CMH Road', 'Domlur Flyover'], R2: ['Forum Mall', 'Sony Signal', 'Ejipura'], R3: ['HSR BDA Complex', 'Agara Lake', '27th Main'],
  R4: ['ITPL Gate', 'Hope Farm', 'Kundalahalli'], R5: ['Dommasandra', 'Kodathi', 'Wipro Gate'], R6: ['Infosys Gate 1', 'Hosa Road', 'Singasandra']
};

export function extendSeed3(db) {
  const r = rng(43);
  db.version = 7;
  db.users.forEach((u) => { if (u.role === 'PARENT' || u.requestedRole === 'PARENT') u.designation = 'Parent'; });
  db.roleDesignations = {};
  // Mobile app: on for two schools, so the console switch can be tried
  db.tenants.forEach((t) => { t.mobile = { enabled: ['T1', 'T2'].includes(t.id), appStatus: t.id === 'T1' ? 'Live in test build' : 'Not published' };
    // Web & App Screens: everyone starts on the recommended layout (version 1)
    t.channels = { published: {}, version: 1, draft: null, status: 'PUBLISHED',
      history: [{ version: 1, at: new Date(Date.now() - 2 * 864e5).toISOString(), submittedBy: 'Platform team', approvedBy: 'Platform team', note: 'Recommended defaults', layout: {}, changes: [] }] }; });
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);

  // Primary and secondary class coordinator for every section
  const teachers = db.staff.filter((s) => /GT/.test(s.desig));
  db.coordinators = {};
  db.sections.forEach((sec, k) => { db.coordinators[sec.id] = { primary: sec.teacherId, secondary: teachers[(k + 5) % teachers.length].id === sec.teacherId ? teachers[(k + 6) % teachers.length].id : teachers[(k + 5) % teachers.length].id }; });
  db.coordinators.C8A = { primary: 'E1', secondary: 'E3' };   // demo teacher Sonia coordinates Aarav's class

  // Stops along each route
  db.students.forEach((s) => { if (s.routeId) { const k = Math.floor(r() * 3); s.stop = STOPS[s.routeId][k]; s.stopNo = k + 1; } });
  const aarav = db.students.find((s) => s.admNo === 'ADM-2025-0231');
  Object.assign(aarav, { band: 3, routeId: 'R3', stop: 'Agara Lake', stopNo: 2 });

  // More accounts: transport in-charge and head of teaching staff
  db.users.push(
    { id: 'U20', name: 'Manjunath Gowda', login: 'transport@greenvalley.example.in', loginType: 'EMAIL', email: 'transport@greenvalley.example.in', mobile: '9845011300', role: 'TRANSPORT', designation: 'Transport In-charge',
      status: 'ACTIVE', verified: true, salt: 'gvs', pw: hashPassword('Demo@123', 'gvs'), failed: 0, createdAt: '2026-04-01T09:00:00Z', lastLogin: null, extra: [] },
    { id: 'U21', name: 'Murali Krishnan', login: 'murali.hots@example.com', loginType: 'EMAIL', email: 'murali.hots@example.com', mobile: '9845011301', role: 'TEACHER', designation: 'Head of Teaching Staff',
      status: 'ACTIVE', verified: true, salt: 'gvs', pw: hashPassword('Demo@123', 'gvs'), failed: 0, createdAt: '2026-04-01T09:00:00Z', lastLogin: null, extra: [], staffId: 'E3' });
  db.users.forEach((u) => { if (u.designation === 'Vice Principal') u.staffId = 'E8'; });
  db.users.forEach((u) => { if (u.role === 'TEACHER' && u.login === 'sonia.teacher@example.com') u.staffId = 'E1'; if (u.role === 'PARENT' || u.requestedRole === 'PARENT') u.children = u.linkedStudent ? [u.linkedStudent] : []; });
  db.designationAccess['Head of Teaching Staff'] = ['ANL_RANK', 'ANL_TEACHER'];
  db.settings = { teacherPerfShared: false, teacherPerfBy: null, teacherPerfAt: null };
  db.accountRequests = [];

  // SMS: framework ready, no provider yet
  db.smsConfig = { provider: 'NONE', status: 'NOT_CONNECTED', sender: '', entityId: '', templates: Object.fromEntries(PURPOSES.map(([k, , text]) => [k, { text, dltId: '', vendorTemplateId: '' }])), tests: [] };
  db.smsQueue = [];

  // Parent requests and an absence for today, so the manifests have something to show
  db.requests = []; db.boarding = {}; db.seq.request = 0;
  const riders = db.students.filter((s) => s.routeId && s.id !== aarav.id);
  const mk = (s, type, extra) => { db.seq.request += 1; return { id: 'Q' + db.seq.request, no: 'REQ-' + String(db.seq.request).padStart(5, '0'), studentId: s.id, userId: null, type, dateFrom: today, dateTo: today, time: '', reason: '', collector: null,
    status: 'Approved', gateCode: '', history: [{ status: 'Submitted', at: new Date().toISOString(), by: 'Parent' }, { status: 'Approved', at: new Date().toISOString(), by: 'Confirmed automatically' }], createdAt: new Date().toISOString(), ...extra }; };
  db.requests.push(
    mk(aarav, 'PICKUP', { reason: 'Dentist appointment at 4 pm', collector: { name: 'Rohit Sharma', relation: 'Father', mobile: '9812344410' }, gateCode: '4821' }),
    mk(riders[3], 'EARLY_LEAVE', { time: '12:30', reason: 'Family function', collector: { name: 'Meena ' + riders[3].last, relation: 'Mother', mobile: '9845099001' }, status: 'Submitted', history: [{ status: 'Submitted', at: new Date().toISOString(), by: 'Parent' }] }),
    mk(riders[7], 'DROP', { reason: 'Going with parent to work' }),
    mk(riders[11], 'OWN_TRANSPORT', { dateFrom: today, dateTo: tomorrow, reason: 'Bus route under repair near home' }),
    mk(riders[15], 'EARLY_LEAVE', { time: '11:00', reason: 'Medical check-up', collector: { name: 'Anil ' + riders[15].last, relation: 'Father', mobile: '9845099002' }, gateCode: '7390' })
  );
  // Leave, late arrival, a meeting request and an office request (release 5)
  const nextWeek = new Date(Date.now() + 6 * 864e5).toISOString().slice(0, 10);
  const pend = (by = 'Parent') => ({ status: 'Submitted', history: [{ status: 'Submitted', at: new Date().toISOString(), by }] });
  db.requests.push(
    mk(riders[5], 'LEAVE', { dateFrom: tomorrow, dateTo: nextWeek, reason: 'Family wedding out of town', ...pend() }),
    mk(riders[9], 'LATE_ARRIVAL', { time: '10:30', reason: 'Eye test in the morning' }),
    mk(aarav, 'MEETING', { dateFrom: tomorrow, dateTo: tomorrow, teacherId: 'E1', mode: 'In person at school', slot: 'After school (15:15–16:30)', reason: 'How Aarav is settling into Grade 8 and his Maths homework', ...pend('Rohit Sharma') }),
    mk(aarav, 'OTHER', { dateFrom: nextWeek, dateTo: nextWeek, category: 'Bonafide / study certificate', reason: 'Needed for a passport application', ...pend('Rohit Sharma') })
  );
  // Stop timings: morning pickup (bus reaches school 08:45) and afternoon drop (leaves school 15:15)
  const AM_START = { R1: '07:35', R2: '07:30', R3: '07:25', R4: '07:10', R5: '07:05', R6: '07:00' };
  const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3)); const toTime = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const DRIVER_MOB = ['9845022001', '9845022002', '9845022003', '9845022004', '9845022005', '9845022006'];
  const ATTENDANTS = ['Lakshmi B', 'Savitha R', 'Geetha N', 'Parvathi K', 'Shobha M', 'Revathi S'];
  db.routes.forEach((r, i) => {
    const gap = Math.round((toMin('08:45') - 15 - toMin(AM_START[r.id])) / 3);
    r.schoolArrive = '08:45'; r.schoolLeave = '15:15'; r.driverMobile = DRIVER_MOB[i]; r.attendant = ATTENDANTS[i];
    r.stops = STOPS[r.id].map((name, k) => ({ name, order: k + 1, am: toTime(toMin(AM_START[r.id]) + k * gap), pm: toTime(toMin('15:15') + 15 + (2 - k) * gap) }));
  });
  db.routeShares = [];
  db.seq.collector = 0;

  // Approved pickup people (besides the guardian on record)
  const ph = (initials, hue) => 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" fill="hsl(${hue},45%,80%)"/><circle cx="40" cy="30" r="15" fill="hsl(${hue},35%,45%)"/><path d="M12 80c4-20 52-20 56 0z" fill="hsl(${hue},35%,45%)"/><text x="40" y="76" font-size="11" text-anchor="middle" font-family="Arial" fill="#fff">${initials}</text></svg>`);
  db.collectors = [
    { id: 'AC1', studentId: aarav.id, name: 'Meena Sharma', relation: 'Mother', mobile: '9812344411', photo: ph('MS', 330), idType: 'Aadhaar', idLast4: '4417', validUntil: '', status: 'VERIFIED', addedBy: 'Rohit Sharma', verifiedBy: 'Anita Rao' },
    { id: 'AC2', studentId: aarav.id, name: 'Kamala Sharma', relation: 'Grandparent', mobile: '9812344412', photo: ph('KS', 200), idType: 'Voter ID', idLast4: '8820', validUntil: '', status: 'VERIFIED', addedBy: 'Rohit Sharma', verifiedBy: 'Anita Rao' },
    { id: 'AC3', studentId: aarav.id, name: 'Raju Naik', relation: 'Family driver', mobile: '9812344413', photo: ph('RN', 120), idType: 'Driving licence', idLast4: '3051', validUntil: '', status: 'PENDING', addedBy: 'Rohit Sharma' }
  ];
  db.seq.collector = 3;
  db.requests[0].collector = { id: 'AC1', name: 'Meena Sharma', relation: 'Mother', mobile: '9812344411', idType: 'Aadhaar', idLast4: '4417' };

  const ab = riders[20];
  db.attendance[ab.sectionId + ':' + today] = { [ab.id]: 'A' };
  return db;
}
