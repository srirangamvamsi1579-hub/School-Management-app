// Release 16: a client's own schools.
// • Project → Project Links: inside the UAT/demo school (and later the live school) — the test build, website,
//   phone app, requirements document and the release links, for the client and our team.
// • #/p/site: the school's starter website; #/p/requirements: the requirements (scope) document of the school as agreed.
// Both work in the customer's own browser, from the set-up carried by the test-build link.
import { useMemo, useState } from 'react';
import { saveFile } from '../lib/saveFile.js';
import { useStore } from '../data/store.js';
import { tenantOf } from '../lib/logic.js';
import { Page, Card, Pill, Input, Select } from '../components/ui.jsx';
import { MENU, LABEL, canSee, PLANS, FUNCTIONS } from '../data/menu.js';
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
    <ul>{BASIC.map(([c, t, menus]) => { const off = menus.filter((m) => !on(m)); return <li key={c}>{t}{off.length === menus.length ? ' — switched off for this school' : off.length ? ` — without ${off.map((m) => LABEL[m] || m).join(', ')}` : ''}</li>; })}
      <li>Always there: {ALWAYS.filter(on).map((c) => LABEL[c]).join(', ')}</li></ul>
    <h2>2. Add-ons agreed with the school</h2>
    {addons.length ? <ul>{addons.map((c) => <li key={c}>{rc.addons.find((a) => a.code === c)?.name || c}</li>)}</ul> : <p>None — the basic features only.</p>}
    <h2>3. Menus in this school</h2>
    <table className="t"><thead><tr><th>Menu</th><th>Screens</th></tr></thead>
      <tbody>{menus.map(({ m, items }) => <tr key={m.code}><td className="b">{m.label}</td><td>{items.map((i) => i[1]).join(', ')}</td></tr>)}</tbody></table>
    <h2>4. Sign-off</h2>
    <p>{tenant.env === 'LIVE' && d.signedBy ? `Signed off by ${d.signedBy} for version ${d.version}. The live school is built from this version.` : 'After testing, the school signs off this version; the live school is then built with exactly these menus.'}</p>
  </div>;
}

// Release 16.3: Service Provider › Add-ons for this School — select / unselect, then Rebuild app.
// The rebuild makes a new version and every output follows it: menus and screens, phone tabs, requirements document,
// website, Project Links, and the build file that republishes the hosted app for everyone.
const STEPS = ['Check the selection (add-ons and menus that need each other)', 'Switch the menus, screens and functions', 'Update the phone app tabs', 'Rewrite the requirements document',
  'Update the website and Project Links', 'Make the build file for the school’s branch'];

// Shared by both provider screens: what changed since the last build, Rebuild, Undo, and the build file
// Release 18: in the service provider's own app the two screens set up a client school picked at the top; in a client's
// own app they set up that school. Apply makes the selection the next version (add-ons and basic items alike).
const TARGET = 'sp-target-school';
function useRebuild() {
  const { db, run, notify, session } = useStore();
  const here0 = tenantOf(db);
  const remote = !here0.delivery;   // the provider's own app
  const schools = remote ? dlv.managedSchools(db) : [here0];
  const [pick, setPick] = useState(() => { try { return sessionStorage.getItem(TARGET) || ''; } catch (e) { return ''; } });
  const tenant = schools.find((t) => t.id === pick) || schools[0] || here0;
  const choose = (id) => { setPick(id); try { sessionStorage.setItem(TARGET, id); } catch (e) { /* ignore */ } };
  const rc = DEFAULT_RATE_CARD;
  const d = tenant.delivery || {};
  const by = session?.name || 'Service provider';
  const [build, setBuild] = useState(null);
  const live = new Set(d.addons || []), built = new Set(dlv.builtAddons(tenant));
  const addonName = (c) => rc.addons.find((a) => a.code === c)?.name || c;
  const pend = dlv.pendingChanges(tenant);
  const changes = { added: [...live].filter((c) => !built.has(c)), removed: [...built].filter((c) => !live.has(c)), shown: pend.shown, hidden: pend.hidden };
  const pending = changes.added.length + changes.removed.length + pend.shown.length + pend.hidden.length;
  const busy = !!build && !build.done;
  const act = (fn, msg) => { try { run(fn); setBuild(null); if (msg) notify(msg); } catch (e) { notify(e.message); } };
  const rebuild = async () => {
    for (let i = 0; i < STEPS.length; i++) { setBuild({ step: i }); await new Promise((r) => setTimeout(r, 300)); }
    try {
      let result, payload;
      run((db2) => { result = dlv.rebuildSchool(db2, tenant.id, null, by); payload = dlv.appliedPayload(result.tenant);
        const own = db2.provider?.clients?.find((c) => 'OWN-' + c.id === tenant.id); if (own) Object.assign(own, { version: result.version, addons: [...payload.addons], plan: result.tenant.delivery.tier }); });
      if (tenant.ownApp && tenant.subdomain) { try { localStorage.setItem(dlv.applyKey(tenant.subdomain), JSON.stringify(payload)); } catch (e) { /* ignore */ } }
      setBuild({ step: STEPS.length, done: true, result }); notify(`Applied: ${tenant.schoolName || tenant.name} is now version ${result.version}`);
    }
    catch (e) { setBuild(null); notify(e.message); }
  };
  const undo = () => act((db2) => { const t = db2.tenants.find((x) => x.id === tenant.id); dlv.setSchoolAddons(db2, t.id, dlv.builtAddons(t), by); t.overrides = { ...(t.delivery.builtOverrides || t.overrides) };
    t.delivery.screens = Object.fromEntries(Object.entries(t.delivery.screens || {}).filter(([c, on]) => !!t.overrides[c] === !!on)); }, `Back to version ${d.version || '1.0'}`);
  const downloadConfig = () => saveFile('rebuild.json', JSON.stringify(dlv.rebuildConfig(db.tenants.find((x) => x.id === tenant.id) || tenant), null, 2))
    .then(() => notify(`rebuild.json saved — commit it to schools/${tenant.liveSubdomain || tenant.subdomain}/ on the school's branch; GitHub rebuilds and republishes the app for everyone`)).catch(() => {});
  const summary = [changes.added.length && 'showing ' + changes.added.map(addonName).join(', '), changes.removed.length && 'hiding ' + changes.removed.map(addonName).join(', '),
    changes.shown.length && 'menus shown: ' + changes.shown.map(dlv.switchName).join(', '), changes.hidden.length && 'menus hidden: ' + changes.hidden.map(dlv.switchName).join(', ')].filter(Boolean).join(' · ');
  const RebuildButton = () => <button className="btn pri" disabled={!pending || busy} onClick={rebuild}>Apply (v{dlv.nextVersion(d.version)})</button>;
  const clientId = tenant.ownApp || (db.provider?.projects || []).find((p) => [p.tenantId, p.uatTenantId, p.liveTenantId].includes(tenant.id))?.id;
  const Picker = () => remote ? <Card title="School">
    {schools.length ? <div className="row" style={{ alignItems: 'center', flexWrap: 'wrap' }}><Select aria-label="School to set up" value={tenant.id} onChange={(e) => choose(e.target.value)}
      options={schools.map((t) => [t.id, `${t.schoolName || t.name}${t.env ? ' – ' + (t.env === 'LIVE' ? 'Live' : 'UAT/DEMO') : ''} (reg. ${t.regNo}) · v${t.delivery?.version || '1.0'}`])} style={{ maxWidth: 420 }} />
      <span className="small muted">Select or unselect below, then <b>Apply</b>. The school’s menus and its own Roles & Permissions follow what is applied.</span></div>
      : <p className="small muted">No client schools yet — convert a proposal in Client Delivery first.</p>}</Card> : null;
  const Status = ({ go }) => <Card title={pending ? `Changes not applied yet (${pending})` : 'Everything is applied'}>
    {pending ? <><p className="small">{summary}</p><div className="row"><RebuildButton /><button className="btn" disabled={busy} onClick={undo}>Undo changes</button></div></>
      : !build?.done && <p className="small muted">Tick or untick add-ons, basic items, menus or functions{remote ? '' : ' — the menus show or hide at once'} — then Apply.</p>}
    {build && <ol className="small" style={{ marginTop: 10 }} aria-label="Apply steps">{STEPS.map((x, i) => <li key={x}>{i < build.step || build.done ? '✓ ' : i === build.step ? '… ' : '○ '}{x}</li>)}</ol>}
    {build?.done && <div className="note" role="status" style={{ marginTop: 10 }}>
      <b>Version {build.result.version} is applied</b> — {build.result.addons.length} add-ons, {build.result.menus} screens and menus. {remote ? `${tenant.schoolName || tenant.name} has changed:` : 'The app has changed:'}
      {remote ? <div className="row" style={{ marginTop: 8, flexWrap: 'wrap' }}>
        {clientId && <button className="btn sm" onClick={() => go('CLI_' + (tenant.ownApp ? clientId : 'P' + clientId))}>See the school in Clients</button>}
        {tenant.ownApp && <span className="small muted">Its own app picks this up the next time it is opened in this browser; download the build file to publish it for everyone.</span>}
        <button className="btn sm pri" onClick={downloadConfig}>Download build file (publish for everyone)</button></div>
      : <div className="row" style={{ marginTop: 8, flexWrap: 'wrap' }}>
        <button className="btn sm" onClick={() => go('HOME')}>Main menu</button>
        <button className="btn sm" onClick={() => go('OPS_ROLES')}>School’s Roles & Permissions</button>
        <a className="btn sm" href="#/p/requirements" target="_blank" rel="noreferrer">Requirements document</a>
        <a className="btn sm" href="#/p/site" target="_blank" rel="noreferrer">Website</a>
        <a className="btn sm" href="#/p/mobile" target="_blank" rel="noreferrer">Phone app</a>
        <button className="btn sm" onClick={() => go('PRJ_LINKS')}>Project Links</button>
        <button className="btn sm pri" onClick={downloadConfig}>Download build file (publish for everyone)</button></div>}</div>}
  </Card>;
  const Sticky = () => pending > 0 && !busy ? <div className="noprint" role="region" aria-label="Changes not applied" style={{ position: 'sticky', bottom: 12, zIndex: 5, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '10px 14px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: '0 4px 16px rgba(0,0,0,.12)' }}>
    <span className="small b">{pending} change{pending > 1 ? 's' : ''} not applied yet · {summary}</span><span style={{ flex: 1 }} />
    <button className="btn" onClick={undo}>Undo changes</button><button className="btn pri" onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); rebuild(); }}>Apply (v{dlv.nextVersion(d.version)})</button></div> : null;
  const Builds = () => <Card title="Applied versions">{(d.builds || []).length ? <div className="tw"><table className="t"><thead><tr><th>Version</th><th>When</th><th>By</th><th>Added</th><th>Removed</th><th className="num">Add-ons</th></tr></thead>
    <tbody>{d.builds.map((x) => <tr key={x.version + x.at}><td className="b">v{x.version}</td><td className="small">{new Date(x.at).toLocaleString('en-IN')}</td><td>{x.by}</td>
      <td className="small">{[...x.added, ...(x.shown || [])].join(', ') || '—'}</td><td className="small">{[...x.removed, ...(x.hidden || [])].join(', ') || '—'}</td><td className="num">{x.addons}</td></tr>)}</tbody></table></div>
    : <p className="small muted">First version v{d.version || '1.0'}. Each Apply is listed here.</p>}</Card>;
  return { db, tenant, rc, d, by, live, built, busy, pending, act, RebuildButton, Status, Sticky, Builds, addonName, Picker, remote };
}

// Release 18: mark a basic item (or a basic feature's menus) as an add-on for the school, or make it basic again
function MarkButton({ tenant, codes, name, busy, act, by }) {
  const free = codes.filter((c) => dlv.BASIC_SCREENS.has(c) && !dlv.LOCKED.has(c));
  if (!free.length) return null;
  const marked = free.every((c) => dlv.isMarkedAddon(tenant, c));
  return marked ? <button className="btn sm" disabled={busy} aria-label={'Make ' + name + ' basic again'} onClick={() => act((db2) => dlv.markAsAddon(db2, tenant.id, free, false, by), `${name} is basic again — Apply to make it the next version`)}>Basic again</button>
    : <button className="btn sm" disabled={busy} aria-label={'Mark ' + name + ' as add-on'} onClick={() => act((db2) => dlv.markAsAddon(db2, tenant.id, free, true, by), `${name} marked as an add-on and unselected — Apply to make it the next version`)}>Mark as add-on</button>;
}
// Release 18: the basic features, each with a tick box (the provider can uncheck basic items too) and Mark as add-on
function BasicCard({ tenant, busy, act, by, go }) {
  const o = tenant.overrides || {};
  const built = tenant.delivery?.builtOverrides || o;
  const rows = BASIC.map(([c, title, menus]) => ({ c, title, menus: menus.filter((m) => !dlv.LOCKED.has(m)) })).filter((r) => r.menus.length);
  const set = (menus, on, title) => act((db2) => dlv.setSchoolScreens(db2, tenant.id, Object.fromEntries(menus.map((m) => [m, on])), by), `${title} ${on ? 'selected' : 'unselected'} — Apply to make it the next version`);
  return <Card title="Basic features">
    <p className="small muted" style={{ marginTop: 0 }}>Basic items can be unchecked or marked as add-ons for this school too. Single screens: <button className="linkbtn" onClick={() => go('SP_FEATURES')}>Roles & Permissions</button>. Main menu, Users, Roles & Permissions and My Account always stay.</p>
    <div className="tw"><table className="t"><thead><tr><th style={{ width: 70 }}>Select</th><th>Basic feature</th><th>Screens</th><th>Now</th><th /></tr></thead>
      <tbody>{rows.map((r) => { const on = r.menus.every((m) => o[m]), some = r.menus.some((m) => o[m]), was = r.menus.every((m) => built[m]);
        const marked = r.menus.every((m) => dlv.isMarkedAddon(tenant, m));
        return <tr key={r.c}>
          <td><input type="checkbox" aria-label={'Basic: ' + r.title} checked={on} disabled={busy} ref={(el) => { if (el) el.indeterminate = some && !on; }} onChange={() => set(r.menus, !on, r.title)} /></td>
          <td className="b">{r.title}{marked && <div className="small muted">Marked as add-on</div>}</td>
          <td className="small">{r.menus.map((m) => LABEL[m] || m).join(', ')}</td>
          <td>{on === was ? (on ? <Pill kind="ok">Applied</Pill> : <Pill kind="muted">Not in the app</Pill>) : on ? <Pill kind="info">Selected · Apply to add</Pill> : <Pill kind="warn">Unselected · Apply to remove</Pill>}</td>
          <td><MarkButton tenant={tenant} codes={r.menus} name={r.title} busy={busy} act={act} by={by} /></td></tr>; })}</tbody></table></div>
  </Card>;
}

// Service Provider › Add-ons for this School
export function SchoolAddons({ go }) {
  const { tenant, rc, d, by, live, built, busy, pending, act, RebuildButton, Status, Sticky, Builds, addonName, Picker, remote } = useRebuild();
  const apply = (codes, msg) => act((db2) => dlv.setSchoolAddons(db2, tenant.id, [...codes], by), msg);
  const toggle = (a) => {
    const next = new Set(live);
    if (next.has(a.code)) { next.delete(a.code); rc.addons.filter((x) => x.needs === a.code).forEach((x) => next.delete(x.code)); }
    else { next.add(a.code); if (a.needs) next.add(a.needs); }
    apply(next, `${a.name} ${live.has(a.code) ? 'unselected' : 'selected'} — Apply to make it the next version`);
  };
  const groups = [...new Set(rc.addons.map((a) => a.group))];
  return <Page title={remote ? 'Add-ons' : 'Add-ons for this School'} sub={`${tenant.name} · version ${d.version || '1.0'} (${d.date ? dlv.dmy(d.date) : '—'}) · ${live.size} of ${rc.addons.length} add-ons on${pending ? ` · ${pending} change${pending > 1 ? 's' : ''} not applied yet` : ''}`}
    actions={<><button className="btn" disabled={busy} onClick={() => apply(rc.addons.map((a) => a.code), 'Every add-on shown')}>Select all</button>
      <button className="btn" disabled={busy} onClick={() => apply([], 'Every add-on hidden — basic features only')}>Unselect all</button><RebuildButton /></>}>
    <Picker />
    <Card title="How it works">
      <ol className="small" style={{ margin: 0 }}><li><b>Select or unselect</b> add-ons below (or single menus in <button className="linkbtn" onClick={() => go('SP_FEATURES')}>Roles & Permissions</button>): their menus show or hide straight away.</li>
        <li><b>Apply</b>: the changes become the next version; the school’s Roles & Permissions, phone app, requirements document, website and Project Links follow what is applied (not the school’s plan or client type).</li>
        <li><b>Publish for everyone</b>: download the build file and commit it to the school's branch; the hosted app is rebuilt and republished by GitHub.</li></ol>
    </Card>
    <Status go={go} />
    <BasicCard tenant={tenant} busy={busy} act={act} by={by} go={go} />
    {groups.map((g) => <Card key={g} title={g}>
      <div className="tw"><table className="t"><thead><tr><th style={{ width: 70 }}>Select</th><th>Add-on</th><th>What it adds</th><th>Now</th></tr></thead>
        <tbody>{rc.addons.filter((a) => a.group === g).map((a) => <tr key={a.code}>
          <td><input type="checkbox" aria-label={a.name} checked={live.has(a.code)} disabled={busy} onChange={() => toggle(a)} /></td>
          <td className="b">{a.name}{a.needs && <div className="small muted">Needs {addonName(a.needs)}</div>}</td>
          <td className="small">{(a.menus || []).map((m) => LABEL[m] || m).join(', ') || (a.functions?.length ? 'Switched on inside its screens' : '—')}</td>
          <td>{built.has(a.code) ? (live.has(a.code) ? <Pill kind="ok">Applied</Pill> : <Pill kind="warn">Unselected · Apply to remove</Pill>) : live.has(a.code) ? <Pill kind="info">Selected · Apply to add</Pill> : <Pill kind="muted">Not in the app</Pill>}</td></tr>)}</tbody></table></div>
    </Card>)}
    <Sticky /><Builds />
  </Page>;
}

// Release 16.4: Service Provider › Roles & Permissions — every menu, sub-menu and function of the app. Anything outside the
// basic features can be marked on or off for this school on its own (an add-on of one screen); Rebuild applies it like add-ons.
// The school's own Operations › Roles & Permissions then lists only what is switched on here.
export function SchoolFeatures({ go }) {
  const { tenant, rc, d, by, busy, pending, act, RebuildButton, Status, Sticky, Builds, Picker, remote } = useRebuild();
  const [open, setOpen] = useState({});
  const [q, setQ] = useState('');
  const o = tenant.overrides || {};
  const built = d.builtOverrides || o;
  const marks = d.screens || {};
  const fns = (mod) => FUNCTIONS.filter((f) => f.module === mod);
  const mods = MENU.filter((m) => !['PLATFORM', 'SERVICE_PROVIDER', 'VIEWAS', 'PROJECT'].includes(m.code));
  const set = (codes, on) => act((db2) => dlv.setSchoolScreens(db2, tenant.id, Object.fromEntries(codes.filter((c) => !dlv.LOCKED.has(c)).map((c) => [c, on])), by),
    `${codes.length === 1 ? dlv.switchName(codes[0]) : codes.filter((c) => !dlv.LOCKED.has(c)).length + ' menus and functions'} ${on ? 'selected' : 'unselected'} — Apply to make it the next version`);
  const source = (c) => dlv.LOCKED.has(c) ? <Pill kind="ok">Always on</Pill> : dlv.isMarkedAddon(tenant, c) ? <Pill kind="info">Basic · marked as add-on</Pill> : marks[c] !== undefined ? <Pill kind="info">{dlv.BASIC_SCREENS.has(c) ? (marks[c] ? 'Basic' : 'Basic · switched off here') : marks[c] ? 'Set here (add-on of its own)' : 'Set here'}</Pill>
    : dlv.BASIC_SCREENS.has(c) ? <Pill kind="ok">Basic</Pill>
    : dlv.addonOfScreen(c) ? <Pill>{dlv.addonOfScreen(c).name}</Pill> : <Pill kind="muted">Add-on of its own</Pill>;
  const state = (c) => !!built[c] === !!o[c] ? (o[c] ? <Pill kind="ok">Applied</Pill> : <Pill kind="muted">Not in the app</Pill>)
    : o[c] ? <Pill kind="info">Selected · Apply to add</Pill> : <Pill kind="warn">Unselected · Apply to remove</Pill>;
  const match = (txt) => !q || txt.toLowerCase().includes(q.toLowerCase());
  const counts = { on: dlv.SWITCHABLE.filter((c) => o[c]).length, all: dlv.SWITCHABLE.length, hand: Object.keys(marks).length };
  return <Page title={remote ? 'Roles & Permissions (provider)' : 'Roles & Permissions (for this school)'} sub={`${tenant.name} · version ${d.version || '1.0'} · ${counts.on} of ${counts.all} menus and functions on · ${counts.hand} set here by hand${pending ? ` · ${pending} change${pending > 1 ? 's' : ''} not applied yet` : ''}`}
    actions={<><button className="btn" disabled={busy} onClick={() => set(dlv.SWITCHABLE, true)}>Select all</button><button className="btn" disabled={busy} onClick={() => set(dlv.SWITCHABLE, false)}>Unselect all</button>
      <button className="btn" disabled={busy || !counts.hand} onClick={() => act((db2) => dlv.setSchoolScreens(db2, tenant.id, Object.fromEntries(Object.keys(marks).map((c) => [c, null])), by), 'Every menu follows its add-on again')}>Follow add-ons</button><RebuildButton /></>}>
    <Picker />
    <Card title="How it works">
      <ul className="small" style={{ margin: 0 }}>
        <li>Every menu, sub-menu and function of the app — <b>basic ones included</b>. Tick or untick any of them on its own: a screen ticked here becomes an add-on of its own for this school, an unticked one (even a basic one) leaves the app. Only Main menu, Users, Roles & Permissions, My Account and these provider screens stay on, so the app can still be run and managed.</li>
        <li>Each item shows where it comes from: <b>Basic</b>, an add-on, or <b>Add-on of its own</b>. Use <b>Mark as add-on</b> to sell a basic item separately: it is unticked and is no longer part of the basic features for this school.</li>
        <li><b>Apply</b> makes the selection the next version, as for <button className="linkbtn" onClick={() => go('SP_ADDONS')}>Add-ons</button>.</li>
        <li>The school’s own Operations › Roles & Permissions lists exactly what is applied here — not what its plan or client type would give it — so the school gives its departments only what it has.</li></ul>
    </Card>
    <Status go={go} />
    <Card title="Menus and functions" right={<Input aria-label="Search menus" placeholder="Search menus" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 220 }} />}>
      <div className="tree" role="tree" aria-label="Menus and functions for this school">{mods.map((m) => {
        const items = m.items.filter((i) => i[0][0] !== '#').map((i) => i[0]).concat(fns(m.code).map((f) => f.code));
        const shown = items.filter((c) => match(dlv.switchName(c)) || match(m.label));
        if (!shown.length) return null;
        const free = items.filter((c) => !dlv.LOCKED.has(c));
        const onN = items.filter((c) => o[c] || dlv.LOCKED.has(c)).length;
        const all = free.length && free.every((c) => o[c]), none = free.every((c) => !o[c]);
        const isOpen = open[m.code] || !!q;
        return <div key={m.code} role="treeitem" aria-expanded={isOpen} className="tree-mod">
          <div className="tree-row mod-row">
            <button className="tree-tg" aria-expanded={isOpen} aria-label={(isOpen ? 'Collapse ' : 'Expand ') + m.label} onClick={() => setOpen({ ...open, [m.code]: !open[m.code] })}>{isOpen ? '▾' : '▸'}</button>
            <input type="checkbox" aria-label={'All of ' + m.label} disabled={busy || !free.length} checked={!!all || !free.length} ref={(el) => { if (el) el.indeterminate = !all && !none; }} onChange={() => set(free, !all)} />
            <b style={{ flex: 1 }}>{m.label}</b><span className="small muted">{onN} of {items.length} on</span></div>
          {isOpen && <div role="group">{shown.map((c) => <div key={c} role="treeitem" className="tree-row leaf">
            <input type="checkbox" aria-label={dlv.switchName(c)} checked={!!o[c] || dlv.LOCKED.has(c)} disabled={busy || dlv.LOCKED.has(c)} onChange={() => set([c], !o[c])} />
            <span style={{ flex: 1 }}>{dlv.switchName(c)}{c.startsWith('FN_') && <span className="small muted"> · function</span>}</span>
            {source(c)} {dlv.LOCKED.has(c) ? null : state(c)}
            <MarkButton tenant={tenant} codes={[c]} name={dlv.switchName(c)} busy={busy} act={act} by={by} /></div>)}</div>}
        </div>; })}</div>
    </Card>
    <Sticky /><Builds />
  </Page>;
}
