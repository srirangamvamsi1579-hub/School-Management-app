// Web & App Screens: which screens each role sees on the website and in the mobile app.
// Workflow: an Admin (or the platform team) edits a DRAFT → sends it for approval → the Principal (or the
// platform team) approves and it is PUBLISHED as a new version, or sends it back with a reason. A different
// person must approve. Every published version is kept and can be restored as a new draft.
import { PHONE_READY, RECOMMENDED, LOCKED_BOTH, LABEL, channelIn } from '../data/menu.js';
import { tenantOf, log } from './logic.js';

export const CAN_EDIT = ['ADMIN', 'PLATFORM'];
export const CAN_APPROVE = ['PRINCIPAL', 'PLATFORM'];
export const LAYOUT_ROLES = ['PARENT', 'TEACHER', 'FRONT_OFFICE', 'TRANSPORT', 'PRINCIPAL', 'ACCOUNTANT', 'ADMIN'];

const clone = (x) => JSON.parse(JSON.stringify(x || {}));
const state = (db) => { const t = tenantOf(db); t.channels = t.channels || { published: {}, version: 1, history: [], draft: null, status: 'PUBLISHED' }; return t.channels; };
const mail = (db, to, subject, body, related) => db.outbox.unshift({ id: 'M' + (db.outbox.length + 1) + '-' + Math.random().toString(36).slice(2, 6), to, kind: 'Web & app screens', status: 'SENT', at: new Date().toISOString(), subject, body, related });
const people = (db, roles) => db.users.filter((u) => roles.includes(u.role) && u.status === 'ACTIVE' && u.email);

// Every difference between two layouts, for every role and phone-ready screen
export function diffLayouts(from, to, roles = LAYOUT_ROLES) {
  const out = [];
  roles.forEach((role) => Object.keys(PHONE_READY).forEach((code) => {
    const a = channelIn(from, role, code), b = channelIn(to, role, code);
    if (a !== b) out.push({ role, code, label: LABEL[code], from: a, to: b });
  }));
  return out;
}
export const currentDraft = (db) => state(db).draft;

export function startDraft(db, by) {
  const c = state(db);
  if (c.status === 'PENDING') throw new Error('A change is waiting for approval — approve it or send it back first');
  if (!c.draft) { c.draft = clone(c.published); c.status = 'DRAFT'; c.draftBy = by; c.rejectNote = null; }
  return c.draft;
}
export function setChannel(db, role, code, channel, by) {
  if (!PHONE_READY[code]) throw new Error(`${LABEL[code]} is not built for phones — it stays on the website`);
  if (LOCKED_BOTH.includes(code)) throw new Error(`${LABEL[code]} must stay on the website and in the app`);
  if (!['BOTH', 'WEB', 'APP'].includes(channel)) throw new Error('Unknown choice');
  const d = startDraft(db, by);
  d[role] = { ...(d[role] || {}), [code]: channel };
  return d;
}
export function resetDraft(db, to, by) {
  const c = state(db);
  if (c.status === 'PENDING') throw new Error('Waiting for approval — cannot change now');
  c.draft = to === 'RECOMMENDED' ? clone(Object.fromEntries(Object.entries(RECOMMENDED))) : clone(c.published);
  c.status = 'DRAFT'; c.draftBy = by;
}
export function discardDraft(db, by) {
  const c = state(db);
  c.draft = null; c.status = 'PUBLISHED'; c.rejectNote = null;
  log(db, by, 'Web & app screens draft discarded', '');
}
export function submitDraft(db, { by, byId, note = '' }) {
  const c = state(db);
  if (c.status !== 'DRAFT' || !c.draft) throw new Error('Nothing to send — make a change first');
  const changes = diffLayouts(c.published, c.draft);
  if (!changes.length) throw new Error('The draft is the same as what is published');
  c.status = 'PENDING'; c.submittedBy = by; c.submittedById = byId; c.submittedAt = new Date().toISOString(); c.submitNote = note; c.rejectNote = null;
  people(db, CAN_APPROVE.filter((r) => r !== 'PLATFORM')).forEach((u) => mail(db, u.email, `Please approve: changes to app and website screens (${changes.length})`,
    `<p>${by} has changed where screens show for ${[...new Set(changes.map((x) => x.role))].length} role(s).</p><p>${note || ''}</p><p>Review in Operations → Web & App Screens.</p>`, 'channels'));
  log(db, by, 'Web & app screens sent for approval', `${changes.length} change(s)`);
  return changes;
}
export function withdraw(db, by) {
  const c = state(db);
  if (c.status !== 'PENDING') throw new Error('Nothing is waiting for approval');
  c.status = 'DRAFT'; log(db, by, 'Web & app screens approval withdrawn', '');
}
export function approve(db, { by, byId, note = '' }) {
  const c = state(db);
  if (c.status !== 'PENDING') throw new Error('Nothing is waiting for approval');
  if (byId && byId === c.submittedById) throw new Error('A different person must approve the change');
  const changes = diffLayouts(c.published, c.draft);
  c.version = (c.version || 1) + 1;
  c.published = c.draft; c.draft = null; c.status = 'PUBLISHED';
  c.history = [{ version: c.version, at: new Date().toISOString(), submittedBy: c.submittedBy, approvedBy: by, note: [c.submitNote, note].filter(Boolean).join(' — '), layout: clone(c.published), changes }, ...(c.history || [])];
  people(db, ['ADMIN']).forEach((u) => mail(db, u.email, `Published: app and website screens, version ${c.version}`, `<p>${by} approved ${changes.length} change(s). People see them at their next sign-in or app refresh.</p>`, 'channels'));
  log(db, by, 'Web & app screens published', 'version ' + c.version);
  return c.version;
}
export function sendBack(db, { by, byId, note }) {
  const c = state(db);
  if (c.status !== 'PENDING') throw new Error('Nothing is waiting for approval');
  if (!note?.trim()) throw new Error('Say what should change');
  c.status = 'DRAFT'; c.rejectNote = note; c.rejectedBy = by;
  const editor = db.users.find((u) => u.id === c.submittedById);
  if (editor?.email) mail(db, editor.email, 'Sent back: app and website screens', `<p>${by}: ${note}</p>`, 'channels');
  log(db, by, 'Web & app screens sent back', note);
}
export function restoreVersion(db, version, by) {
  const c = state(db);
  if (c.status === 'PENDING') throw new Error('Waiting for approval — cannot change now');
  const h = (c.history || []).find((x) => x.version === version);
  if (!h) throw new Error('No such version');
  c.draft = clone(h.layout); c.status = 'DRAFT'; c.draftBy = by;
}
