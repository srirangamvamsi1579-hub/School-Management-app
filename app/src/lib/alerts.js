// In-app notifications (the bell in the top bar). Kept in db.alerts; db.notifications holds bank payment notices.
import { queueEmail } from './logic.js';

export function alert(db, { to, title, body = '', screen = null, email = true }) {
  db.alerts = db.alerts || [];
  db.seq.alert = (db.seq.alert || 0) + 1;
  const ids = [...new Set(to)].filter(Boolean);
  ids.forEach((userId) => {
    db.alerts.unshift({ id: 'N' + db.seq.alert + '-' + userId, userId, title, body, screen, at: new Date().toISOString(), read: false });
    const u = db.users.find((x) => x.id === userId);
    const addr = u?.email || (u?.login?.includes('@') ? u.login : null);
    if (email && addr) queueEmail(db, { to: addr, subject: title, body: `<p>${body}</p>${screen ? '<p>Open the app to act on it.</p>' : ''}`, kind: 'ALERT' });
  });
  return ids.length;
}
export const alertsFor = (db, userId) => (db.alerts || []).filter((a) => a.userId === userId);
export const unreadFor = (db, userId) => alertsFor(db, userId).filter((a) => !a.read).length;
export function markRead(db, userId, id = null) {
  (db.alerts || []).forEach((a) => { if (a.userId === userId && (!id || a.id === id)) a.read = true; });
}
