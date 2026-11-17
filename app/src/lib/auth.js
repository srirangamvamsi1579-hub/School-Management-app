// Accounts, sign-up, OTP and sign-in rules for the test build.
// Production: Amazon Cognito user pool per client (school) — passwords hashed by Cognito, email codes via SES,
// SMS codes via an Indian DLT-registered SMS gateway. The flow and statuses below are the same.
import { ACCESS } from '../data/menu.js';

// Demo-only hash (FNV-1a, 2,000 rounds with salt). Never used in production — Cognito stores passwords.
export function hashPassword(pw, salt) {
  let h = 0x811c9dc5, s = salt + ':' + pw;
  for (let round = 0; round < 2000; round++) {
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    s = h.toString(16) + s.length;
  }
  return h.toString(16).padStart(8, '0');
}

export const isEmail = (v) => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(String(v).trim());
export const isGmail = (v) => /^[a-z0-9.+_-]+@(gmail|googlemail)\.com$/i.test(String(v).trim());
export const normMobile = (v) => String(v).replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '').slice(-10);
export const isMobile = (v) => /^[6-9]\d{9}$/.test(normMobile(v)) && !/[a-z@]/i.test(v);
export const idType = (v) => (isEmail(v) ? 'EMAIL' : isMobile(v) ? 'MOBILE' : null);
export const normId = (v) => (isEmail(v) ? String(v).trim().toLowerCase() : normMobile(v));

export function passwordProblems(pw, name = '') {
  const p = [];
  if (pw.length < 8) p.push('at least 8 characters');
  if (!/[A-Z]/.test(pw)) p.push('an upper-case letter');
  if (!/[a-z]/.test(pw)) p.push('a lower-case letter');
  if (!/\d/.test(pw)) p.push('a number');
  if (!/[^A-Za-z0-9]/.test(pw)) p.push('a symbol');
  if (name && name.split(' ')[0].length > 2 && pw.toLowerCase().includes(name.split(' ')[0].toLowerCase())) p.push('no part of your name');
  return p;
}

export const findUser = (db, id) => db.users.find((u) => u.login === normId(id) || (u.email && u.email === normId(id)) || (u.mobile && u.mobile === normId(id)));

// ---------- One-time codes ----------
// Email codes go to the outbox (SES in production). SMS is planned: the request is recorded with status
// GATEWAY_PENDING so the workflow is ready; the test build shows the code on screen instead.
export function sendOtp(db, { to, channel, purpose, schoolName }) {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const req = { id: 'O' + (db.otp.length + 1), to, channel, purpose, code, at: Date.now(), expires: Date.now() + 10 * 60000, tries: 0,
    status: channel === 'SMS' ? 'GATEWAY_PENDING' : 'SENT' };
  db.otp.unshift(req);
  db.otp = db.otp.slice(0, 50);
  if (channel === 'EMAIL') {
    db.outbox.unshift({ id: 'M' + (db.outbox.length + 1), to, kind: 'Verification code', status: 'SENT', at: new Date().toISOString(), related: req.id,
      subject: `${code} is your ${schoolName} verification code`,
      body: `<p>Your verification code is</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>It expires in 10 minutes. If you didn't ask for this, ignore this email.</p><p>${schoolName}</p>` });
  } else {
    db.outbox.unshift({ id: 'M' + (db.outbox.length + 1), to: '+91 ' + to, kind: 'OTP SMS (gateway not connected)', status: 'NO_EMAIL', at: new Date().toISOString(), related: req.id,
      subject: 'SMS', body: `${code} is your ${schoolName} OTP. Valid 10 min. Do not share.` });
  }
  return req;
}

export function checkOtp(db, { to, purpose, code }) {
  const req = db.otp.find((o) => o.to === to && o.purpose === purpose && o.status !== 'USED');
  if (!req) return 'No code was sent — ask for a new one';
  if (Date.now() > req.expires) return 'Code expired — ask for a new one';
  if (req.tries >= 5) return 'Too many tries — ask for a new one';
  req.tries += 1;
  if (req.code !== String(code).trim()) return `Wrong code (${5 - req.tries} tries left)`;
  req.status = 'USED';
  return null;
}

// ---------- Sign-up ----------
export function createAccount(db, f) {
  const id = normId(f.identifier);
  const type = idType(f.identifier);
  const salt = Math.random().toString(36).slice(2, 8);
  db.seq.user += 1;
  const u = { id: 'U' + db.seq.user, name: f.name.trim(), login: id, loginType: type, email: type === 'EMAIL' ? id : (f.email || '').toLowerCase(), mobile: type === 'MOBILE' ? id : normMobile(f.mobile || ''),
    role: null, requestedRole: f.requestedRole, designation: f.designation || null, status: 'PENDING', verified: true, salt, pw: hashPassword(f.password, salt), failed: 0,
    createdAt: new Date().toISOString(), lastLogin: null, extra: [], linkedStudent: f.admissionNo || null, note: f.note || '' };
  db.users.push(u);
  return u;
}

// Account details go to the person's Gmail / email. The password itself is never emailed: the email confirms
// the sign-in ID and gives a link to change the password if it wasn't them.
export function accountEmail(db, u, schoolName, kind) {
  if (!u.email) return null;
  const rows = [['Name', u.name], ['Sign-in ID', u.login], ['Mobile', u.mobile || '—'], ['Account type', u.role ? roleName(db, u.role) : 'Requested: ' + roleName(db, u.requestedRole)],
    ['Designation', u.designation || '—'], ['Status', u.status === 'PENDING' ? 'Waiting for school approval' : 'Active']];
  const subject = kind === 'APPROVED' ? `Your ${schoolName} account is ready` : kind === 'RESET' ? `${schoolName}: set a new password` : `Welcome to ${schoolName} — your account details`;
  const lead = kind === 'APPROVED' ? 'The school has approved your account. You can sign in now.' : kind === 'RESET' ? 'An administrator asked for your password to be reset. Use the link below to choose a new one. The link works once, for 24 hours.' : 'Thanks for signing up. Here are your account details. The school will approve your account shortly.';
  const body = `<p>Dear ${u.name},</p><p>${lead}</p><table style="border-collapse:collapse">${rows.map(([k, v]) => `<tr><td style="padding:3px 12px 3px 0;color:#6B7280">${k}</td><td><b>${v}</b></td></tr>`).join('')}</table>` +
    `<p>Your password is the one you chose — we never send passwords by email.</p><p><a href="https://${db.tenants.find((t) => t.id === db.tenantId).subdomain}.yourapp.com/account/password">${kind === 'RESET' ? 'Set a new password' : 'Change password'}</a></p><p>${schoolName}</p>`;
  const e = { id: 'M' + (db.outbox.length + 1), to: u.email, kind: 'Account email', status: 'SENT', at: new Date().toISOString(), related: u.id, subject, body };
  db.outbox.unshift(e);
  return e;
}

// ---------- Sign-in ----------
export function signIn(db, identifier, password) {
  const u = findUser(db, identifier);
  if (!u) return { error: 'No account with that email or mobile' };
  if (u.status === 'LOCKED') return { error: 'Account locked after 5 wrong passwords — use “Forgot password” or ask the school office' };
  if (u.status === 'DISABLED') return { error: 'This account has been switched off by the school' };
  if (u.pw !== hashPassword(password, u.salt)) {
    u.failed += 1;
    if (u.failed >= 5) u.status = 'LOCKED';
    return { error: u.status === 'LOCKED' ? 'Account locked after 5 wrong passwords' : `Wrong password (${5 - u.failed} tries left)` };
  }
  if (u.status === 'PENDING') return { error: 'Your account is waiting for the school to approve it. You will get an email when it is ready.' };
  u.failed = 0; u.lastLogin = new Date().toISOString();
  return { user: u };
}

export function setPassword(db, u, password) {
  u.salt = Math.random().toString(36).slice(2, 8); u.pw = hashPassword(password, u.salt); u.failed = 0;
  if (u.status === 'LOCKED') u.status = 'ACTIVE';
}

// ---------- Roles ----------
export const BUILT_IN = [['ADMIN', 'Admin'], ['PRINCIPAL', 'Principal'], ['ACCOUNTANT', 'Accountant'], ['TEACHER', 'Teacher'], ['FRONT_OFFICE', 'Front Office'], ['PARENT', 'Parent'], ['PLATFORM', 'Platform team']];
export const allRoles = (db) => [...BUILT_IN.map(([code, name]) => ({ code, name, builtIn: true })), ...(db.customRoles || [])];
export const roleName = (db, code) => allRoles(db).find((r) => r.code === code)?.name || code || '—';

// Screens a person can open = their role's permissions + their designation's extras + screens given to them by name
export function screensFor(db, user, role) {
  const base = db.perms?.[role] || ACCESS[role] || [];
  const extra = [...(user && db.designationAccess?.[user.designation] || []), ...(user?.extra || [])];
  return [...new Set([...base, ...extra])];
}
export const canManageUsers = (db, user, role) => role === 'ADMIN' || screensFor(db, user, role).includes('OPS_USERS');
