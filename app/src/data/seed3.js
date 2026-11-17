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
  db.version = 3;
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
    status: 'Approved', gateCode: '', history: [{ status: 'Submitted', at: new Date().toISOString(), by: 'Parent' }, { status: 'Approved', at: new Date().toISOString(), by: 'Automatic (before cut-off)' }], createdAt: new Date().toISOString(), ...extra }; };
  db.requests.push(
    mk(aarav, 'PICKUP', { reason: 'Dentist appointment at 4 pm', collector: { name: 'Rohit Sharma', relation: 'Father', mobile: '9812344410' }, gateCode: '4821' }),
    mk(riders[3], 'EARLY_LEAVE', { time: '12:30', reason: 'Family function', collector: { name: 'Meena ' + riders[3].last, relation: 'Mother', mobile: '9845099001' }, status: 'Submitted', history: [{ status: 'Submitted', at: new Date().toISOString(), by: 'Parent' }] }),
    mk(riders[7], 'DROP', { reason: 'Going with parent to work' }),
    mk(riders[11], 'OWN_TRANSPORT', { dateFrom: today, dateTo: tomorrow, reason: 'Bus route under repair near home' }),
    mk(riders[15], 'EARLY_LEAVE', { time: '11:00', reason: 'Medical check-up', collector: { name: 'Anil ' + riders[15].last, relation: 'Father', mobile: '9845099002' }, gateCode: '7390' })
  );
  const ab = riders[20];
  db.attendance[ab.sectionId + ':' + today] = { [ab.id]: 'A' };
  return db;
}
