// Users: parents checked against the student record, archive of deleted accounts, rejoining.
import { roleName, allRoles, normId, normMobile } from './auth.js';
import { departmentOf, designationsFor } from '../data/designations.js';

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean);
export const studentName = (s) => `${s.first} ${s.last || ''}`.trim();
export const gradeOf = (db, s) => { const sec = db.sections.find((x) => x.id === s.sectionId); return db.classes.find((c) => c.id === sec?.classId); };
export const gradeOptions = (db) => db.classes.slice().sort((a, b) => a.level - b.level).map((c) => [String(c.level), c.name]);
export const childrenOf = (u) => (u.children && u.children.length ? u.children : u.linkedStudent ? [u.linkedStudent] : []);
// What the Users screen shows for a parent: admission no., name and grade of each child
export const childLines = (db, u) => childrenOf(u).map((adm) => { const s = db.students.find((x) => x.admNo === adm); const g = s && gradeOf(db, s);
  return s ? { adm, name: studentName(s), grade: g?.name || '', ok: true } : { adm, name: 'Not found', grade: '', ok: false }; });

export const MAX_PARENT_TRIES = 5;
// A parent gives the admission no., the student's name and grade. All three must match an enrolled student.
// Every word of the name typed must be in the student's name, and the first name must be there (order and case don't matter).
export function checkStudent(db, { admissionNo, studentName: typed, grade }) {
  const adm = String(admissionNo || '').trim().toUpperCase();
  if (!/^ADM-\d{4}-\d{4}$/.test(adm)) return { error: "Enter the admission number as on the school ID card, like ADM-2025-0231" };
  if (norm(typed).length === 0) return { error: "Enter the student's name" };
  if (!grade) return { error: "Pick the student's grade" };
  const s = db.students.find((x) => x.admNo === adm && x.status !== 'Left');
  const g = s && gradeOf(db, s);
  const words = norm(studentName(s || { first: '' }));
  const typedWords = norm(typed);
  const nameOk = s && typedWords.every((w) => words.includes(w)) && typedWords.includes(norm(s.first)[0]);
  if (!s || !nameOk || String(g?.level) !== String(grade)) return { error: "These details don't match the school's records. Check the admission number, the student's name and grade, or contact the school office." };
  return { student: s, grade: g };
}
// Wrong tries are counted per sign-in ID so details can't be guessed one by one
export function parentTriesLeft(db, id) { return MAX_PARENT_TRIES - ((db.parentChecks || {})[id] || 0); }
export function noteParentTry(db, id, ok) { db.parentChecks = db.parentChecks || {}; if (ok) delete db.parentChecks[id]; else db.parentChecks[id] = (db.parentChecks[id] || 0) + 1; }

export function touch(u, by) { u.updatedAt = new Date().toISOString(); u.updatedBy = by; }

// Deleting an account keeps a copy in the archive so the school can look the person up later or bring them back.
// When the person deletes their own account, their email and mobile are not kept (they asked for them to be erased).
export const ARCHIVE_REASONS = ['Left the school', "Child left the school", 'Duplicate account', 'Asked to close the account', 'Other'];
export function archiveUser(db, u, { by, reason, self }) {
  db.userArchive = db.userArchive || [];
  db.seq.archive = (db.seq.archive || 0) + 1;
  const kids = childLines(db, u);
  const entry = { id: 'A' + db.seq.archive, userId: u.id, name: u.name, login: self ? '' : u.login, loginType: u.loginType, email: self ? '' : u.email || '', mobile: self ? '' : u.mobile || '',
    role: u.role || u.requestedRole, roleName: roleName(db, u.role || u.requestedRole), department: departmentOf(db, u.role || u.requestedRole), designation: u.designation || null,
    children: kids.map((k) => ({ adm: k.adm, name: k.name, grade: k.grade })), extra: [...(u.extra || [])], createdAt: u.createdAt || null, lastLogin: u.lastLogin || null,
    deletedAt: new Date().toISOString(), deletedBy: by, reason: reason || (self ? 'Asked to close the account' : 'Other'), self: !!self };
  db.userArchive.unshift(entry);
  return entry;
}

// Close an account: archive a copy, then remove the sign-in and clear the live record. Records the school must keep (fees, marks) stay.
export function deleteAccount(db, userId, by, { reason, self = false } = {}) {
  const u = db.users.find((x) => x.id === userId);
  archiveUser(db, u, { by, reason, self });
  Object.assign(u, { status: 'DELETED', name: 'Closed account', login: 'deleted-' + u.id, email: '', mobile: '', pw: '', children: [], extra: [], deletedAt: new Date().toISOString(), deletedBy: by });
  return u;
}

// Parents never wait for approval: a parent with a child on the student record is Active; "Switched off" is no longer a status.
// Runs on saved demo data too, so older copies follow the same rules.
export function normalizeUsers(db) {
  (db.users || []).forEach((u) => {
    const parent = (u.role || u.requestedRole) === 'PARENT';
    if (u.status === 'DISABLED') u.status = 'LOCKED';
    if (!u.source) u.source = ['ADMIN', 'PLATFORM'].includes(u.role) ? 'SEED' : 'WEBSITE';
    if (!parent && u.status === 'PENDING') {
      // staff: verified against the staff record, or locked until the school office sorts it out
      const st = (db.staff || []).find((x) => x.status === 'Active' && [String(x.email || '').toLowerCase(), x.mobile && normMobile(x.mobile)].includes(u.login));
      const role = st && roleForStaff(db, st);
      Object.assign(u, role ? { role, designation: st.desig, status: 'ACTIVE', staffId: st.id } : { role: u.role || u.requestedRole, status: 'LOCKED', note: 'Not on the staff record' });
    }
    if (parent && u.status === 'PENDING') {
      const kids = childrenOf(u).filter((k) => db.students.some((s) => s.admNo === k && s.status !== 'Left'));
      Object.assign(u, kids.length ? { role: 'PARENT', status: 'ACTIVE', children: kids, designation: 'Parent' } : { role: 'PARENT', status: 'LOCKED', designation: 'Parent', note: 'Admission number not on the student record' });
    }
  });
  (db.userArchive || []).forEach((a) => { delete a.rejoined; });
  return db;
}
// Parents have no designation: shown as N/A
export const designationLabel = (u) => ((u.role || u.requestedRole) === 'PARENT' ? 'N/A' : u.designation || '—');
// Reset password: the Admin role, or people given the permission one by one (Edit user → Permissions)
export const RESET_PW = 'RESET_PASSWORDS';
export const canResetPasswords = (me, role) => role === 'ADMIN' || role === 'PLATFORM' || !!me?.perms?.includes(RESET_PW);

// Someone coming back: find them in the archive and copy what still fits today into Add user.
export function archiveMatches(db, text) {
  const t = String(text || '').trim().toLowerCase();
  if (t.length < 2) return [];
  return (db.userArchive || []).filter((a) => (a.name + ' ' + a.login + ' ' + a.email + ' ' + a.mobile + ' ' + a.children.map((k) => k.name + ' ' + k.adm).join(' ')).toLowerCase().includes(t)).slice(0, 5);
}
export function fromArchive(db, a, { roles, fit }) {
  const notes = [];
  const roleOk = roles.some((r) => r.code === a.role);
  if (!roleOk) notes.push(`The ${a.roleName} profile no longer exists — pick a role.`);
  const role = roleOk ? a.role : '';
  const designation = role && role !== 'PARENT' ? fit(role, a.designation) : '';
  if (role && role !== 'PARENT' && a.designation && designation !== a.designation) notes.push(`${a.designation} is no longer offered — pick a designation.`);
  const id = a.login || a.email || a.mobile || '';
  if (!id) notes.push('Their sign-in ID, email and mobile were not kept — enter them again.');
  let kid = null;
  if (role === 'PARENT') {
    const now = a.children.map((k) => db.students.find((s) => s.admNo === k.adm && s.status !== 'Left')).filter(Boolean);
    a.children.filter((k) => !now.some((s) => s.admNo === k.adm)).forEach((k) => notes.push(`${k.name} (${k.adm}) is no longer enrolled.`));
    kid = now[0] || null;
    if (kid) { const g = gradeOf(db, kid); if (g?.name !== a.children.find((k) => k.adm === kid.admNo)?.grade) notes.push(`${studentName(kid)} is now in ${g?.name}.`); }
  }
  return { fields: { name: a.name, identifier: id, email: a.email || '', role, designation, admissionNo: kid?.admNo || '', studentName: kid ? studentName(kid) : '', grade: kid ? String(gradeOf(db, kid)?.level || '') : '', fromArchive: a.id }, notes };
}

// Accounts are created when people register on the website or in the app. The Admin can add someone only as an exception, with a reason.
export const ADD_REASONS = ['Has no email or mobile of their own', 'Needs help to register', 'Coming back (details from the archive)', 'Other'];
export const canAddUsers = (role) => role === 'ADMIN' || role === 'PLATFORM';
export const sourceLabel = (u) => (u.source === 'APP' ? 'Registered in the app' : u.source === 'ADMIN' ? 'Added by the Admin' + (u.addReason ? ' — ' + u.addReason : '') : u.source === 'SEED' ? 'Set up with the school' : 'Registered on the website');

// Staff register against the staff record: employee code, their name and the email or mobile the school has for them.
// On a match the account is Active straight away, with the role and designation from the staff record — nobody approves it.
const STAFF_ROLE_ORDER = ['TEACHER', 'PRINCIPAL', 'ACCOUNTANT', 'FRONT_OFFICE', 'TRANSPORT'];
export function roleForStaff(db, st) {
  const roles = [...STAFF_ROLE_ORDER, ...(db.customRoles || []).map((r) => r.code)].filter((r) => allRoles(db).some((x) => x.code === r));
  return roles.find((r) => designationsFor(db, r).map((d) => (Array.isArray(d) ? d[0] : d)).includes(st.desig)) || null;
}
export function checkStaff(db, { employeeCode, first, last, identifier }) {
  const code = String(employeeCode || '').trim().toUpperCase();
  if (!/^EMP-\d{3,6}$/.test(code)) return { error: 'Enter your employee code as on your staff ID card, like EMP-0012' };
  const st = (db.staff || []).find((x) => x.code === code && x.status === 'Active');
  const words = norm(st ? `${st.first} ${st.last}` : '');
  const typed = norm(`${first} ${last || ''}`);
  const nameOk = st && typed.length && typed.every((w) => words.includes(w)) && typed.includes(norm(st.first)[0]);
  const id = normId(identifier || '');
  const contactOk = st && (id === String(st.email || '').toLowerCase() || (st.mobile && id === normMobile(st.mobile)));
  const role = st && roleForStaff(db, st);
  if (!st || !nameOk || !contactOk || !role) return { error: "These details don't match the school's staff record. Use the email or mobile the school has for you, or contact the school office." };
  return { staff: st, role, designation: st.desig };
}
