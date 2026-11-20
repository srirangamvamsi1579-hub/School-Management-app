// Release 15.1 upgrade of saved data (safe to run more than once):
// • F13 decision: the Accountant's department no longer opens Student Profile by default (give it personally if needed);
// • the new Data Analytics screens go into every department whose profile has them by default;
// • the saved price list's Data analytics add-on includes the new screens;
// • the QA enhancements are on the roadmap as backlog items.
import { ACCESS, ANL_NEW } from './menu.js';
import { departments, baseRoleOf } from '../lib/auth.js';
import { DEFAULT_RATE_CARD } from '../lib/pricing.js';
import { ROADMAP } from './providers.js';

export function seedRelease15(db) {
  db.flags = db.flags || {};
  const depts = Object.values(departments(db));
  if (!db.flags.r15AccountantProfile) {
    depts.forEach(({ name, profiles }) => {
      if (db.deptPerms?.[name] && profiles.some((p) => baseRoleOf(db, p.code) === 'ACCOUNTANT')) db.deptPerms[name] = db.deptPerms[name].filter((c) => c !== 'STU_PROFILE');
    });
    if (db.perms?.ACCOUNTANT) db.perms.ACCOUNTANT = db.perms.ACCOUNTANT.filter((c) => c !== 'STU_PROFILE');
    db.flags.r15AccountantProfile = true;
  }
  if (!db.flags.r15Analytics) {
    const NEW = [...ANL_NEW, 'STF_INS', 'ANL_HOME'];
    depts.forEach(({ name, profiles }) => {
      if (!db.deptPerms?.[name]) return;
      const add = profiles.flatMap((p) => (ACCESS[baseRoleOf(db, p.code)] || []).filter((c) => NEW.includes(c)));
      db.deptPerms[name] = [...new Set([...db.deptPerms[name], ...add])];
    });
    if (db.perms) Object.keys(db.perms).forEach((r) => { db.perms[r] = [...new Set([...db.perms[r], ...(ACCESS[baseRoleOf(db, r)] || []).filter((c) => NEW.includes(c))])]; });
    db.flags.r15Analytics = true;
  }
  const rc = db.provider?.rateCard;
  if (rc?.addons) {
    const mine = rc.addons.find((a) => a.code === 'ANALYTICS'), std = DEFAULT_RATE_CARD.addons.find((a) => a.code === 'ANALYTICS');
    if (mine && std) mine.menus = [...new Set([...(mine.menus || []), ...std.menus])];
  }
  if (db.provider) {
    db.provider.roadmap = db.provider.roadmap || [];
    ROADMAP.filter((r) => r.backlog && !db.provider.roadmap.some((x) => x.code === r.code)).forEach((r) => db.provider.roadmap.push({ code: r.code, status: 'Backlog', priority: r.priority }));
  }
  return db;
}
