// Release 17: School login — registration number, username and password.
// • 100 is the service provider (our company): username admin; the password is checked against a stored SHA-256 hash only.
// • Every school and client has its own registration number; its Admin (username admin) sets a password on first sign-in.
// • In a client's own app only that client's registration number is accepted.
// Demo build: hashes live in the browser. In production this is Amazon Cognito (one user pool per school).
import { passwordProblems } from './auth.js';

export const PROVIDER_REG = '100';
const RESERVED = [...new Set(['101', ...(typeof window !== 'undefined' && window.__SCHOOL_APP__?.regNo ? [String(window.__SCHOOL_APP__.regNo)] : [])])];   // 101: Vijayanikethan High School (runs in its own app)
const PROVIDER_HASH = 'ac9689e2272427085e35b9d3e3e8bed88cb3434828b43b86fc0596cad4c6e270';   // sha256 of the provider's demo password
export async function sha256Hex(text) {
  const b = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(text)));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
const onlyReg = () => (typeof window !== 'undefined' && window.__SCHOOL_APP__?.regNo) || null;
export const lockedReg = onlyReg;
export const tenantByReg = (db, reg) => { const all = db.tenants.filter((t) => String(t.regNo) === String(reg).trim()); return all.find((t) => t.env === 'LIVE') || all.find((t) => t.trial) || all[0]; };   // UAT and live share the school's number; live wins once built
const adminOf = (db) => db.users.find((u) => u.role === 'ADMIN' && u.status === 'ACTIVE');

// → { ok, tenantId, userId, name } | { needsPassword: true, tenantId } | { error }
export async function schoolSignIn(db, { regNo, username, password }) {
  const reg = String(regNo || '').trim(), user = String(username || '').trim().toLowerCase();
  if (!reg || !user) return { error: 'Enter the registration number and username' };
  const only = onlyReg();
  if (only && reg !== String(only)) return { error: 'This app is for registration number ' + only };
  const t = tenantByReg(db, reg);
  if (!t) return { error: 'No school with that registration number' };
  const login = t.adminLogin || {};
  if ((login.tries || 0) >= 5) return { error: 'Too many wrong passwords — ask the service provider to unlock this school' };
  if (user !== (login.username || 'admin')) return { error: 'Wrong username or password', wrong: true, tenantId: t.id };
  const hash = reg === PROVIDER_REG ? PROVIDER_HASH : login.pwHash;
  if (!hash) return { needsPassword: true, tenantId: t.id };
  if (!password || (await sha256Hex(password)) !== hash) return { error: 'Wrong username or password', wrong: true, tenantId: t.id };
  const a = reg === PROVIDER_REG ? db.users.find((u) => u.companyAdmin) || adminOf(db) : adminOf(db);
  return { ok: true, tenantId: t.id, userId: a.id, name: a.name, provider: reg === PROVIDER_REG };
}
export function noteWrongTry(db, tenantId) { const t = db.tenants.find((x) => x.id === tenantId); if (t) t.adminLogin = { ...(t.adminLogin || {}), tries: ((t.adminLogin || {}).tries || 0) + 1 }; }
export function clearTries(db, tenantId) { const t = db.tenants.find((x) => x.id === tenantId); if (t?.adminLogin) t.adminLogin.tries = 0; }
// First sign-in of a school's Admin: choose the password (same rules as every account)
export function passwordFor(password, confirm, name = 'Admin') {
  const p = passwordProblems(password, name);
  if (p.length) return 'Password needs ' + p.join(', ');
  if (password !== confirm) return 'The two passwords are different';
  return null;
}
export function storePassword(db, tenantId, hash) {
  const t = db.tenants.find((x) => x.id === tenantId);
  if (String(t.regNo) === PROVIDER_REG) throw new Error('The service provider password is set by the platform');
  t.adminLogin = { username: 'admin', pwHash: hash, tries: 0, set: new Date().toISOString().slice(0, 10) };
}
// Registration numbers: 100 the provider, 101+ clients (in the order they are converted), 201+ other schools
export function assignRegNos(db) {
  db.seq = db.seq || {};
  const used = new Set(db.tenants.map((t) => t.regNo).filter(Boolean).map(String));
  (db.provider?.clients || []).forEach((c) => used.add(String(c.regNo)));
  RESERVED.forEach((r) => used.add(r));
  const next = (from) => { let n = from; while (used.has(String(n))) n++; used.add(String(n)); return String(n); };
  db.tenants.forEach((t) => {
    if (t.regNo) return;
    if (t.id === 'T1') t.regNo = PROVIDER_REG;
    else if (t.trial && typeof window !== 'undefined' && window.__SCHOOL_APP__?.regNo) t.regNo = String(window.__SCHOOL_APP__.regNo);   // the client's own app
    else if (t.client || t.env || t.trial) t.regNo = next(101);
    else t.regNo = next(201);
  });
}
