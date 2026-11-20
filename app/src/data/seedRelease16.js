// Release 16 upgrade of saved data (safe to run more than once): client projects get a UAT / demo school, a sign-off record
// and their own release branch; the Project → Project Links menu is switched on in client schools; Principals get it.
import { ACCESS } from './menu.js';
import { departments, baseRoleOf } from '../lib/auth.js';
import { DEFAULT_REPO, schoolBranch, ENV_NAME } from '../lib/delivery.js';

const OLD = { Onboarding: 'UAT / Demo', 'Customer testing': 'UAT / Demo', Live: 'Live' };
export function seedRelease16(db) {
  db.flags = db.flags || {};
  if (db.provider) db.provider.profile && (db.provider.profile.repo = db.provider.profile.repo || DEFAULT_REPO);
  (db.provider?.projects || []).forEach((p) => {
    const t = db.tenants.find((x) => x.id === p.tenantId);
    if (!t) return;
    if (OLD[p.status] && !p.uatTenantId) {
      const wasLive = p.status === 'Live';
      p.status = OLD[p.status];
      const sub = t.subdomain.replace(/^uat-/, '');
      if (wasLive) { t.env = 'LIVE'; p.liveTenantId = t.id; p.live = { version: p.version, date: p.updated || p.created, pending: null }; }
      else { t.env = 'UAT'; t.schoolName = t.schoolName || t.name; t.name = `${t.schoolName} – ${ENV_NAME.UAT}`; t.liveCode = t.code; t.code = t.code + '-UAT'; t.liveSubdomain = sub; t.subdomain = 'uat-' + sub; }
      p.uatTenantId = wasLive ? null : t.id; p.signoffs = p.signoffs || [];
      p.release = p.release || { repo: DEFAULT_REPO, base: 'dev', branch: schoolBranch(sub), created: p.created };
    }
    [p.uatTenantId, p.liveTenantId].forEach((id) => { const x = db.tenants.find((y) => y.id === id); if (x) { x.overrides = { ...x.overrides, PROJECT: true, PRJ_LINKS: true }; x.delivery = x.delivery || { projectNo: p.no, version: p.version, date: p.updated, branch: p.release?.branch }; } });
  });
  if (!db.flags.r16ProjectLinks) {
    Object.values(departments(db)).forEach(({ name, profiles }) => {
      if (db.deptPerms?.[name] && profiles.some((x) => ACCESS[baseRoleOf(db, x.code)]?.includes('PRJ_LINKS'))) db.deptPerms[name] = [...new Set([...db.deptPerms[name], 'PRJ_LINKS'])];
    });
    if (db.perms?.PRINCIPAL) db.perms.PRINCIPAL = [...new Set([...db.perms.PRINCIPAL, 'PRJ_LINKS'])];
    db.flags.r16ProjectLinks = true;
  }
  return db;
}
