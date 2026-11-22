// Release 17.1: login with username and password only. The username names the school:
// • Admin → the service provider (registration no. 100); its password is checked against a stored SHA-256 hash only.
// • Client<no> (e.g. Client101) → the school with that registration number; password Client<no>! for now.
// • In a client's own app only that client's username is accepted. The provider does not give login details to schools.
// Demo build: hashes live in the browser. In production this is Amazon Cognito (one user pool per school).

export const PROVIDER_REG = '100';
const RESERVED = [...new Set(['101', ...(typeof window !== 'undefined' && window.__SCHOOL_APP__?.regNo ? [String(window.__SCHOOL_APP__.regNo)] : [])])];   // 101: Vijayanikethan High School (runs in its own app)
const PROVIDER_HASH = '5ce41ada64f1e8ffb0acfaafa622b141438f3a5777785e7f0b830fb73e40d3d6';   // sha256 of the provider's password
export async function sha256Hex(text) {
  const b = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(text)));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
const onlyReg = () => (typeof window !== 'undefined' && window.__SCHOOL_APP__?.regNo) || null;
export const lockedReg = onlyReg;
export const tenantByReg = (db, reg) => { const all = db.tenants.filter((t) => !t.ownApp && String(t.regNo) === String(reg).trim()); return all.find((t) => t.env === 'LIVE') || all.find((t) => t.trial) || all[0]; };   // UAT and live share the school's number; live wins once built
const adminOf = (db) => db.users.find((u) => u.role === 'ADMIN' && u.status === 'ACTIVE');

// Which school a username signs in to: Admin → 100, Client101 → 101
export function regOfUsername(username) {
  const u = String(username || '').trim();
  if (/^admin$/i.test(u)) return PROVIDER_REG;
  const m = /^client(\d{3,6})$/i.exec(u);
  return m ? m[1] : null;
}
export const usernameFor = (regNo) => (String(regNo) === PROVIDER_REG ? 'Admin' : 'Client' + regNo);
// → { ok, tenantId, userId, name, provider } | { error, wrong?, tenantId? }
export async function schoolSignIn(db, { username, password }) {
  const reg = regOfUsername(username);
  if (!String(username || '').trim() || !password) return { error: 'Enter your username and password' };
  if (!reg) return { error: 'Wrong username or password' };
  const only = onlyReg();
  if (only && reg !== String(only)) return { error: 'Wrong username or password' };
  const t = tenantByReg(db, reg);
  if (!t) return { error: 'Wrong username or password' };
  if (((t.adminLogin || {}).tries || 0) >= 5) return { error: 'Too many wrong passwords — ask the service provider to unlock this login' };
  const hash = reg === PROVIDER_REG ? PROVIDER_HASH : t.adminLogin?.pwHash || await sha256Hex(`Client${reg}!`);
  if ((await sha256Hex(password)) !== hash) return { error: 'Wrong username or password', wrong: true, tenantId: t.id };
  const a = reg === PROVIDER_REG ? db.users.find((u) => u.companyAdmin) || adminOf(db) : adminOf(db);
  return { ok: true, tenantId: t.id, userId: a.id, name: a.name, provider: reg === PROVIDER_REG, regNo: reg };
}
export function noteWrongTry(db, tenantId) { const t = db.tenants.find((x) => x.id === tenantId); if (t) t.adminLogin = { ...(t.adminLogin || {}), tries: ((t.adminLogin || {}).tries || 0) + 1 }; }
export function clearTries(db, tenantId) { const t = db.tenants.find((x) => x.id === tenantId); if (t?.adminLogin) t.adminLogin.tries = 0; }
export function unlockLogin(db, regNo) { const t = tenantByReg(db, regNo); if (t) t.adminLogin = { ...(t.adminLogin || {}), tries: 0 }; return t; }
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
