// Release 18 upgrade of saved data (safe to run more than once): the service provider's own app gets the Add-ons and
// Roles & Permissions menus, and each client that runs in its own app is kept as a school the provider can set up.
import { computeOverrides } from '../lib/delivery.js';

export function seedRelease18(db) {
  const t1 = db.tenants?.find((t) => t.id === 'T1');
  if (!t1 || (typeof window !== 'undefined' && window.__SCHOOL_APP__)) return db;   // not in a client's own app
  t1.overrides = { ...(t1.overrides || {}), SP_ADDONS: true, SP_FEATURES: true };
  (db.provider?.clients || []).forEach((c) => {
    if (db.tenants.some((t) => t.id === 'OWN-' + c.id)) return;
    const t = { id: 'OWN-' + c.id, ownApp: c.id, regNo: String(c.regNo), code: c.code, name: `${c.name} – ${c.env}`, schoolName: c.name, subdomain: c.sub, plan: 'ENTERPRISE', status: 'Onboarding', examBoard: c.board, env: 'UAT',
      overrides: { PROJECT: true, PRJ_LINKS: true, SP_ADDONS: true, SP_FEATURES: true },
      delivery: { projectNo: c.id, version: c.version, date: c.since, addons: [...(c.addons || [])], screens: {}, links: { SITE: c.website } } };
    t.overrides = computeOverrides(t);
    t.delivery.builtAddons = [...t.delivery.addons]; t.delivery.builtOverrides = { ...t.overrides };
    db.tenants.push(t);
  });
  return db;
}
