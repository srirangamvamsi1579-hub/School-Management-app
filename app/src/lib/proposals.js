// Proposals and their demo schools (release 14). The Proposal Builder and the Demo Builder both change a proposal
// through saveOptions, so the two always agree, and a proposal's demo school is set up again to match.
import { DEFAULT_RATE_CARD, tierOf, demoConfig, demoCode } from './pricing.js';

import { clean, emailOk } from './validate.js';

// Release 15: what a proposal still needs before it can be emailed, downloaded or converted.
// Drafts save as you type, so these are checked at those steps (and shown next to the fields).
export const phoneOk = (v) => { const d = String(v || '').replace(/[\s\-()+]/g, ''); return /^\d{10,13}$/.test(d); };
export function proposalProblems(o) {
  return [!clean(o.client) && 'school name', !clean(o.poc?.name) && 'point of contact', !emailOk(o.poc?.email) && 'a valid contact email',
    !phoneOk(o.poc?.phone) && 'a valid contact number (10 to 13 digits)'].filter(Boolean);
}
const rcOf = (db) => (db.provider?.rateCard?.version >= 2 ? db.provider.rateCard : DEFAULT_RATE_CARD);
const todayIso = () => new Date().toISOString().slice(0, 10);

// Save a proposal's choices; if it has a demo school, that school is set up again to match.
export function saveOptions(d, id, options) {
  const rc = rcOf(d);
  const p = d.provider.proposals.find((x) => x.id === id);
  p.options = options; p.updated = todayIso();
  const t = p.demoId && d.tenants.find((x) => x.id === p.demoId);
  if (t) {
    const cfg = demoConfig(rc, options);
    Object.assign(t, { plan: cfg.plan, overrides: cfg.overrides, mobile: { enabled: true, appStatus: cfg.branded ? 'Branded app (demo preview)' : 'Shared app' } });
    t.demo = { ...t.demo, client: options.client || t.demo.client, tier: tierOf(rc, options.tier).name };
  }
  return p;
}
export function newProposal(d, options, by) {
  d.provider.proposals = d.provider.proposals || [];
  d.seq.proposal = (d.seq.proposal || 0) + 1;
  const p = { id: 'PR' + d.seq.proposal + '-' + Math.random().toString(36).slice(2, 5), no: `PROP-${todayIso().slice(0, 4)}-${String(d.seq.proposal).padStart(3, '0')}`, status: 'Draft', created: todayIso(), by, options };
  d.provider.proposals.unshift(p);
  return p;
}
// Create the demo school for a proposal (or set it up again)
export function makeDemo(d, id, by) {
  const rc = rcOf(d);
  const p = d.provider.proposals.find((x) => x.id === id);
  const o = p.options;
  const cfg = demoConfig(rc, o);
  const existing = p.demoId && d.tenants.find((t) => t.id === p.demoId);
  if (existing) return saveOptions(d, id, o) && existing;
  const name = (o.client || 'Demo school').replace(/\s*\(example\)$/, '');
  const code = demoCode(name, d.tenants.map((x) => x.code));
  d.seq.demo = (d.seq.demo || 0) + 1;
  const t = { id: 'TD' + d.seq.demo, code, name: `${name} (demo)`, subdomain: 'demo-' + code.toLowerCase(), plan: cfg.plan, status: 'Demo', overrides: cfg.overrides, examBoard: 'CBSE',
    mobile: { enabled: true, appStatus: cfg.branded ? 'Branded app (demo preview)' : 'Shared app' }, renews: '—',
    demo: { proposalId: id, client: o.client || name, tier: tierOf(rc, o.tier).name, by: by.name, byUser: by.userId, byRole: by.role, created: todayIso() } };
  d.tenants.push(t); d.provider.demos = [...(d.provider.demos || []), t.id];
  p.demoId = t.id;
  return t;
}

