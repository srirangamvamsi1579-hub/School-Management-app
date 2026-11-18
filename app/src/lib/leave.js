// Staff leave: leave types with yearly entitlement, balances, applying, and approval with notifications.
import { days, isSchoolDay } from './attendance.js';
import { alert } from './alerts.js';
import { log } from './logic.js';
import { todayISO, dmy } from './format.js';

// Entitlement per academic year. null days = no limit (leave without pay). gender = only offered to that gender.
export const DEFAULT_LEAVE_TYPES = [
  { code: 'CL', name: 'Casual leave', days: 12, maxAtOnce: 3, note: 'Up to 3 days at a time.' },
  { code: 'SL', name: 'Sick leave', days: 10, maxAtOnce: null, note: 'A medical certificate is needed for more than 2 days. Can be applied after the day.' },
  { code: 'EL', name: 'Earned leave', days: 15, maxAtOnce: null, note: 'Apply at least 7 days ahead. Full-time staff only.', fullTimeOnly: true, notice: 7 },
  { code: 'ML', name: 'Maternity leave', days: 182, maxAtOnce: null, note: '26 weeks (Maternity Benefit Act).', gender: 'Female' },
  { code: 'PL', name: 'Paternity leave', days: 15, maxAtOnce: null, note: 'Within 6 months of the birth.', gender: 'Male' },
  { code: 'CO', name: 'Compensatory off', days: 5, maxAtOnce: 2, note: 'For working on a school holiday or event day.' },
  { code: 'LOP', name: 'Leave without pay', days: null, maxAtOnce: null, note: 'No limit; salary is cut for these days.' }
];
export const leaveTypes = (db) => db.leaveTypes || DEFAULT_LEAVE_TYPES;
export const typesFor = (db, st) => leaveTypes(db).filter((t) => (!t.gender || t.gender === st.gender) && (!t.fullTimeOnly || (st.type || 'Full time') === 'Full time'));
export const LEAVE_STATUS = { PENDING: 'Waiting for approval', APPROVED: 'Approved', DECLINED: 'Declined', CANCELLED: 'Cancelled' };

// Working days the leave covers (Sundays and school holidays don't count). A half day counts 0.5.
export const leaveDays = (db, from, to, half = false) => (half ? 0.5 : days(from, to).filter((d) => isSchoolDay(db, d)).length);

export function balances(db, staffId) {
  const st = db.staff.find((s) => s.id === staffId);
  const mine = (db.staffLeaves || []).filter((r) => r.staffId === staffId);
  return typesFor(db, st).map((t) => {
    const taken = mine.filter((r) => r.type === t.code && r.status === 'APPROVED').reduce((a, r) => a + r.days, 0);
    const pending = mine.filter((r) => r.type === t.code && r.status === 'PENDING').reduce((a, r) => a + r.days, 0);
    return { ...t, taken, pending, left: t.days == null ? null : Math.max(0, t.days - taken - pending) };
  });
}

// Who approves: the Principal and the Vice Principal for teaching staff; the Principal and the Admin for everyone else.
// The Principal's own leave goes to the Admin. Nobody approves their own leave.
const TEACHING = /Teacher|PRT|TGT|PGT|Coordinator|Head of|Special Educator|Counsellor|Librarian/;
export function approversFor(db, st) {
  const self = db.users.find((u) => u.staffId === st.id);
  const active = db.users.filter((u) => u.status === 'ACTIVE' && u.id !== self?.id);
  const principal = active.filter((u) => u.role === 'PRINCIPAL');
  const vp = active.filter((u) => u.designation === 'Vice Principal');
  const admin = active.filter((u) => u.role === 'ADMIN');
  if (self?.role === 'PRINCIPAL' || st.desig === 'Principal') return admin.map((u) => u.id);
  return [...principal, ...(TEACHING.test(st.desig) ? vp : admin)].map((u) => u.id);
}
export const canApprove = (db, userId, req) => (req.approvers || []).includes(userId);

export function checkLeave(db, st, f, today = todayISO()) {
  const t = leaveTypes(db).find((x) => x.code === f.type);
  if (!t) return 'Choose a leave type';
  if (!typesFor(db, st).some((x) => x.code === t.code)) return `${t.name} is not available for this staff member`;
  if (!f.from || !f.to) return 'Choose the dates';
  if (f.to < f.from) return 'The last day is before the first day';
  if (f.half && f.from !== f.to) return 'A half day is for one date only';
  if (!f.reason || f.reason.trim().length < 3) return 'Give a short reason';
  if (t.code !== 'SL' && f.from < today) return 'Only sick leave can be applied after the day';
  if (t.notice && f.from < addDays(today, t.notice)) return `${t.name} must be applied at least ${t.notice} days ahead`;
  const n = leaveDays(db, f.from, f.to, f.half);
  if (!n) return 'These dates are all holidays';
  if (t.maxAtOnce && n > t.maxAtOnce) return `${t.name} is up to ${t.maxAtOnce} days at a time`;
  const b = balances(db, st.id).find((x) => x.code === t.code);
  if (b.left != null && n > b.left) return `Only ${b.left} day(s) of ${t.name.toLowerCase()} left`;
  const clash = (db.staffLeaves || []).find((r) => r.staffId === st.id && ['PENDING', 'APPROVED'].includes(r.status) && r.from <= f.to && r.to >= f.from);
  if (clash) return `Overlaps your ${leaveTypes(db).find((x) => x.code === clash.type)?.name.toLowerCase()} from ${dmy(clash.from)}`;
  return '';
}
const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

export function applyLeave(db, st, f, byUser) {
  const err = checkLeave(db, st, f);
  if (err) throw new Error(err);
  db.staffLeaves = db.staffLeaves || [];
  db.seq.leave = (db.seq.leave || 0) + 1;
  const t = leaveTypes(db).find((x) => x.code === f.type);
  const r = { id: 'LV' + db.seq.leave, staffId: st.id, type: f.type, from: f.from, to: f.to, half: !!f.half, days: leaveDays(db, f.from, f.to, f.half), reason: f.reason.trim(),
    status: 'PENDING', approvers: approversFor(db, st), at: new Date().toISOString(), by: byUser?.name || `${st.first} ${st.last}` };
  db.staffLeaves.unshift(r);
  const n = alert(db, { to: r.approvers, title: `Leave to approve: ${st.first} ${st.last}`, body: `${t.name}, ${r.days} day(s), ${dmy(r.from)}${r.to !== r.from ? ' to ' + dmy(r.to) : ''}. Reason: ${r.reason}`, screen: 'STF_LEAVE' });
  log(db, r.by, 'Leave applied', `${t.name} ${r.days}d · ${n} approver(s) told`);
  return r;
}

export function decideLeave(db, id, decision, approver, note = '') {
  const r = db.staffLeaves.find((x) => x.id === id);
  if (!r || r.status !== 'PENDING') throw new Error('This request has already been decided');
  if (!canApprove(db, approver.id, r)) throw new Error('You are not an approver for this request');
  if (decision === 'DECLINED' && !note.trim()) throw new Error('Give a reason for declining');
  r.status = decision; r.decidedBy = approver.name; r.decidedAt = new Date().toISOString(); r.note = note.trim();
  const st = db.staff.find((s) => s.id === r.staffId);
  const self = db.users.find((u) => u.staffId === r.staffId);
  const t = leaveTypes(db).find((x) => x.code === r.type);
  alert(db, { to: [self?.id], title: `Leave ${decision === 'APPROVED' ? 'approved' : 'declined'}: ${t.name}`, body: `${dmy(r.from)}${r.to !== r.from ? ' to ' + dmy(r.to) : ''} · by ${approver.name}${r.note ? ' — ' + r.note : ''}`, screen: 'SELF_LEAVE' });
  // Other approvers no longer need to act
  (db.alerts || []).forEach((a) => { if (a.screen === 'STF_LEAVE' && a.title.endsWith(`${st.first} ${st.last}`) && r.approvers.includes(a.userId)) a.read = true; });
  log(db, approver.name, 'Leave ' + decision.toLowerCase(), `${st.first} ${st.last} · ${t.name} ${r.days}d`);
  return r;
}

export function cancelLeave(db, id, by) {
  const r = db.staffLeaves.find((x) => x.id === id);
  if (!r || !['PENDING', 'APPROVED'].includes(r.status)) throw new Error('This request can no longer be cancelled');
  if (r.status === 'APPROVED' && r.from <= todayISO()) throw new Error('Approved leave that has started can only be changed by the Principal');
  r.status = 'CANCELLED'; r.decidedBy = by; r.decidedAt = new Date().toISOString();
  return r;
}
