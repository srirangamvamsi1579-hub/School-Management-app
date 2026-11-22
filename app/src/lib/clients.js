// Release 17: the provider's clients (converted in Client Delivery, or running in their own app) and the Clients menu
import { MENU, LABEL, MODULE_OF, canSee, PLANS } from '../data/menu.js';
import { DEFAULT_RATE_CARD, demoConfig } from './pricing.js';
import * as dlv from './delivery.js';

const isClientSchool = (t) => !!(t && (t.env || t.trial || t.client || t.demo || (t.regNo && String(t.regNo) !== '100')));
const isProvider = (db, me, role) => ['PLATFORM', 'SALES'].includes(role) || (role === 'ADMIN' && !!me?.companyAdmin && !isClientSchool(db.tenants.find((t) => t.id === db.tenantId)));

// Every client: converted in Client Delivery, or running in its own app
export function clientList(db) {
  const rc = DEFAULT_RATE_CARD;
  const fromProjects = (db.provider?.projects || []).map((p) => {
    const uat = db.tenants.find((t) => t.id === (p.uatTenantId || p.tenantId));
    const live = db.tenants.find((t) => t.id === p.liveTenantId);
    if (!uat) return null;
    const L = (c) => p.links?.find((l) => l.code === c);
    const url = (c) => (L(c) && !dlv.isPlaceholder(L(c).url) ? L(c).url : null);
    return { id: 'P' + p.id, regNo: (live || uat).regNo, name: uat.schoolName || p.client, env: live ? 'Live + UAT/DEMO' : 'UAT/DEMO', version: p.version, plan: p.tierName,
      code: uat.code, tenant: live || uat, addons: uat.delivery?.addons || dlv.schoolFile(db, p).addons, ownApp: false,
      links: { app: url('TEST_BUILD'), website: url('TEST_SITE'), phone: url('TEST_APP'), requirements: url('REQ_DOC'), own: url('SITE'), branch: url('BRANCH') } };
  }).filter(Boolean);
  const own = (db.provider?.clients || []).map((c) => {
    const { overrides } = demoConfig({ ...rc, tiers: rc.tiers.map((x) => ({ ...x, includes: [] })) }, { tier: 'STARTER', addons: Object.fromEntries((c.addons || []).map((a) => [a, true])) });
    const tenant = db.tenants.find((t) => t.id === 'OWN-' + c.id) || { id: 'OWN-' + c.id, regNo: c.regNo, code: c.code, name: `${c.name} – ${c.env}`, schoolName: c.name, plan: 'ENTERPRISE', examBoard: c.board, env: 'UAT', overrides: { ...overrides, PROJECT: true, PRJ_LINKS: true, SP_ADDONS: true, SP_FEATURES: true },
      delivery: { projectNo: c.id, version: c.version, date: c.since, addons: c.addons, links: { SITE: c.website } } };
    return { id: c.id, regNo: c.regNo, name: c.name, env: c.env, version: tenant.delivery?.version || c.version, plan: tenant.delivery?.tier || c.plan, code: c.code, tenant, addons: tenant.delivery?.addons || c.addons, ownApp: true, sub: c.sub,
      links: { app: c.appUrl, website: c.appUrl + '#/p/site', phone: c.appUrl + '#/p/mobile', requirements: c.appUrl + '#/p/requirements', own: c.website,
        branch: `${dlv.DEFAULT_REPO}/tree/${c.branch}`, claude: c.artifact } };
  });
  return [...own, ...fromProjects].sort((a, b) => String(a.regNo).localeCompare(String(b.regNo), undefined, { numeric: true }));
}

// The Clients menu (provider only): All clients, then one sub-menu per client
export function clientsMenu(db, me, role) {
  if (!isProvider(db, me, role)) return [];
  const list = clientList(db);
  const items = [['CLI_ALL', 'All clients & links', 1], ['#C', 'Clients'], ...list.map((c) => ['CLI_' + c.id, `${c.name} (${c.regNo})`, 1])];
  items.forEach(([c, l]) => { if (c[0] !== '#') { LABEL[c] = l; MODULE_OF[c] = 'Clients'; } });
  return [{ code: 'CLIENTS', label: 'Clients', items }];
}

// Menus a school has, from its switches (for the preview)
export function menusOf(t) {
  const rank = PLANS.find((p) => p.code === t.plan)?.rank || 4;
  return MENU.filter((m) => !['PLATFORM', 'VIEWAS'].includes(m.code)).map((m) => ({ ...m, items: m.items.filter((i) => i[0][0] !== '#' && (canSee(i[0], 'ADMIN', rank, t.overrides) || (m.code === 'SERVICE_PROVIDER' && ['SP_ADDONS', 'SP_FEATURES'].includes(i[0]) && t.overrides.SP_ADDONS))) }))
    .filter((m) => m.items.length && (m.code !== 'SERVICE_PROVIDER' || m.items.every((i) => ['SP_ADDONS', 'SP_FEATURES'].includes(i[0]))));
}


// Release 17.1: share a client's links with other people by email. Only links go out — never login details;
// the service provider does not give login details to schools.
export const SHARE_LINKS = [['app', 'App (test build)'], ['website', 'Website'], ['phone', 'Phone app'], ['requirements', 'Requirements document'], ['own', "School's own website"]];
export function shareClientLinks(db, clientId, { emails, codes, message }, by) {
  const c = clientList(db).find((x) => x.id === clientId);
  if (!c) throw new Error('Client not found');
  const list = String(emails || '').split(/[,;\s]+/).map((e) => e.trim()).filter(Boolean);
  if (!list.length) throw new Error('Enter at least one email address');
  const bad = list.filter((e) => !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(e));
  if (bad.length) throw new Error(`Check ${bad.length > 1 ? 'these email addresses' : 'this email address'}: ${bad.join(', ')}`);
  const chosen = SHARE_LINKS.filter(([k]) => (codes || []).includes(k) && c.links[k]);
  if (!chosen.length) throw new Error('Choose at least one link to share');
  const to = [...new Set(list.map((e) => e.toLowerCase()))];
  const body = [`Hello,`, '', `${String(message || '').trim() || `Here are the links for ${c.name}.`}`, '',
    ...chosen.map(([k, l]) => `${l}: ${c.links[k]}`), '', 'Login details are not included in this email.', '', `${db.provider?.profile?.name || 'Service provider'}`].join('\n');
  db.outbox.unshift({ id: 'M' + (db.outbox.length + 1) + '-' + Math.random().toString(36).slice(2, 6), to: to.join(', '), kind: 'Client links', status: 'SENT', at: new Date().toISOString(),
    related: `${c.name} (${c.regNo})`, subject: `${c.name}: links (version ${c.version})`, body });
  db.provider.clientShares = [{ at: new Date().toISOString(), clientId, school: c.name, to, links: chosen.map(([k]) => k), by }, ...(db.provider.clientShares || [])].slice(0, 200);
  return { to, links: chosen.length, body };
}
