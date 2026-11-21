// Release 16: a client's own schools.
// • Project → Project Links: inside the UAT/demo school (and later the live school) — the test build, website,
//   phone app, requirements document and the release links, for the client and our team.
// • #/p/site: the school's starter website; #/p/requirements: the requirements (scope) document of the school as agreed.
// Both work in the customer's own browser, from the set-up carried by the test-build link.
import { useMemo } from 'react';
import { useStore } from '../data/store.js';
import { tenantOf } from '../lib/logic.js';
import { Page, Card, Pill } from '../components/ui.jsx';
import { MENU, LABEL, canSee, PLANS } from '../data/menu.js';
import { BASIC, ALWAYS, DEFAULT_RATE_CARD } from '../lib/pricing.js';
import * as dlv from '../lib/delivery.js';

const here = () => (typeof location !== 'undefined' ? location.href.replace(/#.*$/, '') : '');
const ENV_LABEL = { UAT: 'UAT / demo', LIVE: 'Live' };

// Every link of this school: from the project (our browser) or from the set-up in the test-build link (the customer's browser)
export function schoolLinks(db, tenant) {
  const project = (db.provider?.projects || []).find((p) => [p.tenantId, p.uatTenantId, p.liveTenantId].includes(tenant.id));
  const d = tenant.delivery || {};
  const trial = d.trial ? here() + d.trial : null;
  const from = (code) => project?.links?.find((l) => l.code === code);
  const url = (code) => {
    const l = from(code);
    if (l && !dlv.isPlaceholder(l.url)) return l.url;
    if (trial && code === 'TEST_BUILD') return trial;
    if (trial && ['TEST_SITE', 'TEST_APP', 'REQ_DOC'].includes(code)) return trial + '?to=' + { TEST_SITE: 'site', TEST_APP: 'app', REQ_DOC: 'req' }[code];
    if (d.links?.[code]) return d.links[code];
    const branch = d.branch || project?.release?.branch;
    return { TEST_SITE: here() + '#/p/site', TEST_APP: here() + '#/p/mobile', REQ_DOC: here() + '#/p/requirements', TEST_BUILD: here() + '#/s/HOME', TEST_GUIDE: here() + '#/p/guide',
      BRANCH: branch ? `${(db.provider?.profile?.repo || dlv.DEFAULT_REPO).replace(/\/$/, '')}/tree/${branch}` : null }[code] || null;
  };
  const rows = [
    ['Test', 'TEST_BUILD', 'Test build', 'The school as agreed, with demo data, in your own browser'],
    ['Test', 'TEST_SITE', 'Website', 'The school’s starter website, with admissions and sign-in'],
    ['Test', 'TEST_APP', 'Phone app', `The app as parents and staff see it (school code ${tenant.code})`],
    ['Test', 'REQ_DOC', 'Requirements document', 'What this school includes: basic features, add-ons agreed and every menu'],
    ['Test', 'TEST_GUIDE', 'User guide and guided demos', 'How each screen works, step by step'],
    ['Live', 'SITE', 'School website', 'The school’s own website'],
    ['Live', 'WEB_PROD', 'Live website and sign-in', 'Opens after go-live'],
    ['Live', 'PLAY', 'Google Play', 'The app on Android'],
    ['Live', 'APPSTORE', 'App Store', 'The app on iPhone'],
    ['Release', 'BRANCH', 'School branch', `This school’s branch of the code${d.branch || project?.release?.branch ? ' (' + (d.branch || project.release.branch) + ')' : ''}`]
  ];
  return { project, rows: rows.map(([group, code, label, what]) => ({ group, code, label, what, url: url(code), version: from(code)?.version || d.version, status: from(code)?.status })) };
}

export function ProjectLinks() {
  const { db } = useStore();
  const tenant = tenantOf(db);
  const { project, rows } = useMemo(() => schoolLinks(db, tenant), [db, tenant]);
  const d = tenant.delivery || {};
  return <Page title="Project Links" sub={`${tenant.name} · ${ENV_LABEL[tenant.env] || 'school'} · version ${d.version || project?.version || '1.0'}${d.date ? ', ' + dlv.dmy(d.date) : ''}${d.projectNo ? ' · project ' + d.projectNo : ''}`}>
    <p className="small muted">{tenant.env === 'LIVE'
      ? `The live school, built after the client signed off version ${d.version || ''}${d.signedBy ? ' (' + d.signedBy + ')' : ''}. The test links stay for checking changes before they go live.`
      : 'The UAT / demo school: basic menus plus every add-on agreed with the client. Test here, then sign off; the live school is built from the signed version.'}</p>
    {['Test', 'Live', 'Release'].map((g) => <Card key={g} title={{ Test: 'Test and review', Live: 'Live', Release: 'Release' }[g]}>
      <div className="tw"><table className="t"><thead><tr><th>Link</th><th>What it is</th><th>Address</th></tr></thead>
        <tbody>{rows.filter((r) => r.group === g).map((r) => <tr key={r.code}><td className="b">{r.label}</td><td className="small">{r.what}</td>
          <td className="small" style={{ wordBreak: 'break-all', maxWidth: 420 }}>{r.url && !dlv.isPlaceholder(r.url)
            ? <a href={r.url} target="_blank" rel="noreferrer">Open{r.url.length < 80 ? ': ' + r.url : ''}</a>
            : <Pill kind="muted">To be added</Pill>}</td></tr>)}</tbody></table></div></Card>)}
  </Page>;
}

// The school's starter website, full page
export function PublicSite() {
  const { db } = useStore();
  const html = useMemo(() => dlv.tenantSiteHtml(db, tenantOf(db), here()), [db]);
  return <iframe title={`${tenantOf(db).name} website`} srcDoc={html} sandbox="allow-popups allow-top-navigation-by-user-activation" style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', border: 0 }} />;
}

// What the school includes, as agreed: printable
export function RequirementsPage() {
  const { db } = useStore();
  const tenant = tenantOf(db);
  const d = tenant.delivery || {};
  const rc = db.provider?.rateCard?.version >= 2 ? db.provider.rateCard : DEFAULT_RATE_CARD;
  const rank = PLANS.find((p) => p.code === tenant.plan)?.rank || 1;
  const project = (db.provider?.projects || []).find((p) => [p.tenantId, p.uatTenantId, p.liveTenantId].includes(tenant.id));
  const addons = d.addons || (project ? dlv.schoolFile(db, project).addons : []);
  const on = (c) => canSee(c, 'ADMIN', rank, tenant.overrides) || canSee(c, 'PARENT', rank, tenant.overrides);
  const menus = MENU.filter((m) => !['PLATFORM', 'SERVICE_PROVIDER', 'VIEWAS'].includes(m.code)).map((m) => ({ m, items: m.items.filter((i) => i[0][0] !== '#' && on(i[0])) })).filter((x) => x.items.length);
  return <div className="page" style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
    <h1 style={{ marginBottom: 4 }}>Requirements — {tenant.schoolName || tenant.name}</h1>
    <p className="muted">{ENV_LABEL[tenant.env] || 'School'} · {d.tier || PLANS.find((p) => p.code === tenant.plan)?.name} plan · version {d.version || project?.version || '1.0'}{d.date ? ' · ' + dlv.dmy(d.date) : ''}{d.projectNo ? ' · project ' + d.projectNo : ''} · board {tenant.examBoard || 'CBSE'}</p>
    <div className="row noprint" style={{ margin: '10px 0 18px' }}><button className="btn pri" onClick={() => window.print()}>Print / save as PDF</button><a className="btn" href="#/s/HOME">Open the test build</a></div>
    <h2>1. Basic features (every school)</h2>
    <ul>{BASIC.map(([c, t]) => <li key={c}>{t}</li>)}<li>Always there: {ALWAYS.map((c) => LABEL[c]).join(', ')}</li></ul>
    <h2>2. Add-ons agreed with the school</h2>
    {addons.length ? <ul>{addons.map((c) => <li key={c}>{rc.addons.find((a) => a.code === c)?.name || c}</li>)}</ul> : <p>None — the basic features only.</p>}
    <h2>3. Menus in this school</h2>
    <table className="t"><thead><tr><th>Menu</th><th>Screens</th></tr></thead>
      <tbody>{menus.map(({ m, items }) => <tr key={m.code}><td className="b">{m.label}</td><td>{items.map((i) => i[1]).join(', ')}</td></tr>)}</tbody></table>
    <h2>4. Sign-off</h2>
    <p>{tenant.env === 'LIVE' && d.signedBy ? `Signed off by ${d.signedBy} for version ${d.version}. The live school is built from this version.` : 'After testing, the school signs off this version; the live school is then built with exactly these menus.'}</p>
  </div>;
}

// Release 16.2: Service Provider › Add-ons for this School — the only provider screen in a client's own app.
// Tick an add-on to switch its menus on for this school, untick to take them off. The basic features always stay.
export function SchoolAddons() {
  const { db, run, notify, session } = useStore();
  const tenant = tenantOf(db);
  const rc = DEFAULT_RATE_CARD;
  const on = new Set(tenant.delivery?.addons || []);
  const save = (codes, msg) => { try { run((d) => dlv.setSchoolAddons(d, tenant.id, codes, session?.name || 'Service provider')); notify(msg); } catch (e) { notify(e.message); } };
  const toggle = (a) => {
    const next = new Set(on);
    if (next.has(a.code)) { next.delete(a.code); rc.addons.filter((x) => x.needs === a.code).forEach((x) => next.delete(x.code)); }
    else { next.add(a.code); if (a.needs) next.add(a.needs); }
    save(next, `${a.name}: ${on.has(a.code) ? 'switched off' : 'switched on'} for ${tenant.schoolName || tenant.name}`);
  };
  const groups = [...new Set(rc.addons.map((a) => a.group))];
  const log = tenant.delivery?.addonLog || [];
  return <Page title="Add-ons for this School" sub={`${tenant.name} · ${on.size} of ${rc.addons.length} add-ons on. Tick to add a feature, untick to remove it; the menus change at once.`}
    actions={<><button className="btn" onClick={() => save(rc.addons.map((a) => a.code), 'Every add-on switched on')}>Select all</button><button className="btn" onClick={() => save([], 'Every add-on switched off — basic features only')}>Clear all</button></>}>
    <Card title="Basic features (always included)">
      <ul className="small" style={{ margin: 0 }}>{BASIC.map(([c, t]) => <li key={c}>{t}</li>)}</ul>
    </Card>
    {groups.map((g) => <Card key={g} title={g}>
      <div className="tw"><table className="t"><thead><tr><th style={{ width: 70 }}>On</th><th>Add-on</th><th>What it adds</th></tr></thead>
        <tbody>{rc.addons.filter((a) => a.group === g).map((a) => <tr key={a.code}>
          <td><input type="checkbox" aria-label={a.name} checked={on.has(a.code)} onChange={() => toggle(a)} /></td>
          <td className="b">{a.name}{a.needs && <div className="small muted">Needs {rc.addons.find((x) => x.code === a.needs)?.name}</div>}</td>
          <td className="small">{[...(a.menus || []).map((m) => LABEL[m] || m), ...(a.functions?.length ? ['(function switched on inside its screens)'] : [])].join(', ') || a.blurb || '—'}</td></tr>)}</tbody></table></div>
    </Card>)}
    <Card title="Changes">{log.length ? <div className="tw"><table className="t"><thead><tr><th>When</th><th>By</th><th>Added</th><th>Removed</th></tr></thead>
      <tbody>{log.map((x, i) => <tr key={i}><td className="small">{new Date(x.at).toLocaleString('en-IN')}</td><td>{x.by}</td><td className="small">{x.added.join(', ') || '—'}</td><td className="small">{x.removed.join(', ') || '—'}</td></tr>)}</tbody></table></div>
      : <p className="small muted">No changes yet.</p>}</Card>
  </Page>;
}
