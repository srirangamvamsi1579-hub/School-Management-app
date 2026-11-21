// Release 17: the service provider's Clients menu, and the provider's own links.
// • Clients › All clients: the provider's links (every function, the full requirements) next to each client's links
//   (only what that school has, its own requirements document).
// • Clients › <school>: the client's details and what its webpage and app look like.
// • #/p/platform: every function of the platform, with what it is for, how to use it, who gets it and how it is sold.
import { useMemo, useState } from 'react';
import { useStore } from '../data/store.js';
import { Page, Card, Pill, Tabs, Field, Input } from '../components/ui.jsx';
import { MENU, LABEL, MODULE_OF, FUNCTIONS, ACCESS, ROLES, canSee, PLANS } from '../data/menu.js';
import { SCREEN_HELP } from '../data/guide.js';
import { BASIC, ALWAYS, DEFAULT_RATE_CARD, demoConfig } from '../lib/pricing.js';
import * as dlv from '../lib/delivery.js';
import { PROVIDER_REG } from '../lib/schoolLogin.js';
import { clientList, clientsMenu, menusOf, SHARE_LINKS, shareClientLinks } from '../lib/clients.js';
export { clientsMenu };

const REQ_DOC = 'https://claude.ai/artifact/7s89uC65LFcsiKfvBBeLdy';
const here = () => (typeof location !== 'undefined' ? location.href.replace(/#.*$/, '') : '');
export function ClientsScreen({ code, go }) {
  const { db } = useStore();
  const list = useMemo(() => clientList(db), [db]);
  if (code === 'CLI_ALL') return <AllClients list={list} go={go} />;
  const c = list.find((x) => 'CLI_' + x.id === code);
  if (!c) return <Page title="Client not found"><p>This client is no longer in the list.</p></Page>;
  return <ClientView c={c} db={db} />;
}

const A = ({ href, children }) => (href ? <a href={href} target="_blank" rel="noreferrer">{children}</a> : <span className="muted">—</span>);

function AllClients({ list, go }) {
  const base = here();
  return <Page title="All clients & links" sub={`${list.length} client${list.length === 1 ? '' : 's'}. The provider's links cover every function of the platform; each client's links show only what that school has.`}>
    <Card title="Service provider links">
      <div className="tw"><table className="t"><thead><tr><th>Link</th><th>What it shows</th><th>Address</th></tr></thead><tbody>
        <tr><td className="b">Provider app</td><td className="small">Every menu and function, the Service Provider menus (sales, delivery, market) and Clients. Sign in with the provider's own login.</td><td className="small"><A href={base}>{base}</A></td></tr>
        <tr><td className="b">Platform requirements — every function</td><td className="small">Every menu, sub-menu and function: what it is for, how to use it, who gets it, basic or which add-on</td><td className="small"><A href={base + '#/p/platform'}>{base}#/p/platform</A></td></tr>
        <tr><td className="b">Full requirements document</td><td className="small">All releases, rules, database, hosting and testing</td><td className="small"><A href={REQ_DOC}>{REQ_DOC}</A></td></tr>
        <tr><td className="b">User guide and guided demos</td><td className="small">Every screen, step by step</td><td className="small"><A href={base + '#/p/guide'}>{base}#/p/guide</A></td></tr>
        <tr><td className="b">Code and school branches</td><td className="small">main → dev → school/&lt;name&gt;</td><td className="small"><A href={dlv.DEFAULT_REPO}>{dlv.DEFAULT_REPO}</A></td></tr>
      </tbody></table></div>
    </Card>
    <Card title="Client links (only what each school has)">
      {list.length ? <div className="tw"><table className="t"><thead><tr><th>Reg. no.</th><th>School</th><th>Version</th><th>App</th><th>Website</th><th>Phone app</th><th>Requirements</th><th>Own website</th><th /></tr></thead>
        <tbody>{list.map((c) => <tr key={c.id}><td className="b">{c.regNo}</td><td>{c.name}<div className="small muted">{c.env} · {c.plan}{c.ownApp ? ' · own app' : ''}</div></td><td>v{c.version}</td>
          <td className="small"><A href={c.links.app}>Open</A></td><td className="small"><A href={c.links.website}>Open</A></td><td className="small"><A href={c.links.phone}>Open</A></td>
          <td className="small"><A href={c.links.requirements}>Open</A></td><td className="small"><A href={c.links.own}>Open</A></td>
          <td><button className="btn sm" onClick={() => go('CLI_' + c.id)}>View</button></td></tr>)}</tbody></table></div>
        : <p className="small muted">No clients yet — convert a proposal in Client Delivery.</p>}
      <p className="small muted" style={{ marginTop: 8 }}>How they differ: a client's links open only that school (its registration number, its menus, its add-ons) and its requirements document lists only what it bought. The provider's links show the whole platform.</p>
    </Card>
  </Page>;
}

function ClientView({ c, db }) {
  const [tab, setTab] = useState('web');
  const t = c.tenant;
  const site = useMemo(() => dlv.tenantSiteHtml(db, t, c.ownApp ? c.links.app : here()), [db, t]);
  const menus = useMemo(() => menusOf(t), [t]);
  const rc = DEFAULT_RATE_CARD;
  return <Page title={`${c.name}`} sub={`Registration no. ${c.regNo} · ${c.env} · ${c.plan} · version ${c.version} · school code ${c.code}${c.ownApp ? ' · runs in its own app' : ''}`}>
    <Tabs tabs={[['web', 'Their webpage'], ['app', 'Their app'], ['links', 'Links'], ['share', 'Share by email'], ['what', 'What they have']]} value={tab} onChange={setTab} />
    {tab === 'share' && <ShareLinks c={c} />}
    {tab === 'web' && <Card title="What the school's webpage looks like" right={<A href={c.links.website}>Open in a new tab</A>}>
      <iframe title={`${c.name} webpage preview`} srcDoc={site} sandbox="" style={{ width: '100%', height: 640, border: '1px solid var(--line)', borderRadius: 8, background: '#fff' }} />
      {c.links.own && <p className="small" style={{ marginTop: 8 }}>The school's own website: <A href={c.links.own}>{c.links.own}</A></p>}
    </Card>}
    {tab === 'app' && <Card title="What the school's app looks like (Admin, Main menu)" right={<A href={c.links.app}>Open the app</A>}>
      <div className="row" style={{ alignItems: 'stretch', gap: 0, border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden', minHeight: 420 }} aria-label={`${c.name} app preview`}>
        <div style={{ width: 230, background: '#141c2f', color: '#fff', padding: 14 }}>
          <div className="row" style={{ gap: 8, marginBottom: 12 }}><span className="logo" style={{ width: 30, height: 30 }}>{c.name[0]}</span><b className="small">{t.name}</b></div>
          {menus.map((m) => <div key={m.code} className="small" style={{ opacity: 0.85, padding: '5px 0', letterSpacing: '.05em', textTransform: 'uppercase', fontSize: 11 }}>{m.label}</div>)}
        </div>
        <div style={{ flex: 1, padding: 16, background: 'var(--bg)' }}>
          <b>Main menu</b>
          <div className="grid g3" style={{ marginTop: 10 }}>{menus.map((m) => <div key={m.code} className="card" style={{ padding: 10 }}><b className="small">{m.label}</b>
            <div className="small muted">{m.items.slice(0, 5).map((i) => i[1]).join(' · ')}{m.items.length > 5 ? ` · +${m.items.length - 5} more` : ''}</div></div>)}</div>
        </div>
      </div>
      <p className="small muted" style={{ marginTop: 8 }}>{menus.length} menus, {menus.reduce((n, m) => n + m.items.length, 0)} screens. {`Registration no. ${c.regNo}. Login details are kept by the service provider and are not shared with the school.`}</p>
    </Card>}
    {tab === 'links' && <Card title="Links for this client">
      <div className="tw"><table className="t"><tbody>
        {[['App (test build)', c.links.app], ['Website', c.links.website], ['Phone app', c.links.phone], ['Requirements document (this school only)', c.links.requirements], ["School's own website", c.links.own], ['School branch', c.links.branch], ['Same app on Claude', c.links.claude]]
          .filter(([, u]) => u).map(([l, u]) => <tr key={l}><td className="b">{l}</td><td className="small" style={{ wordBreak: 'break-all' }}><A href={u}>{u.length > 110 ? u.slice(0, 110) + '…' : u}</A></td></tr>)}
      </tbody></table></div></Card>}
    {tab === 'what' && <Card title="What this school has">
      <p className="small"><b>Basic features:</b> {BASIC.map((b) => b[1]).join('; ')}.</p>
      <p className="small"><b>Add-ons ({(c.addons || []).length} of {rc.addons.length}):</b> {(c.addons || []).map((a) => rc.addons.find((x) => x.code === a)?.name || a).join(', ') || 'none'}.</p>
      <div className="tw"><table className="t"><thead><tr><th>Menu</th><th>Screens</th></tr></thead><tbody>{menus.map((m) => <tr key={m.code}><td className="b">{m.label}</td><td className="small">{m.items.map((i) => i[1]).join(', ')}</td></tr>)}</tbody></table></div>
    </Card>}
  </Page>;
}

// Share this client's links with others by email — links only, never login details
function ShareLinks({ c }) {
  const { db, run, notify, session } = useStore();
  const [f, setF] = useState({ emails: '', codes: SHARE_LINKS.filter(([k]) => c.links[k]).map(([k]) => k), message: '' });
  const [err, setErr] = useState('');
  const send = () => {
    setErr('');
    try { let r; run((d) => { r = shareClientLinks(d, c.id, f, session?.name || 'Service provider'); }); notify(`Links sent to ${r.to.join(', ')}`); setF({ ...f, emails: '', message: '' }); }
    catch (e) { setErr(e.message); }
  };
  const history = (db.provider?.clientShares || []).filter((x) => x.clientId === c.id);
  return <>
    <Card title={`Share ${c.name}'s links`}>
      <p className="small">Send the links to anyone — the school's staff, parents' representatives, a reviewer. <b>Only links are sent; login details are never included.</b></p>
      <div className="form">
        <Field label="Email addresses (separate with commas)" req><Input aria-label="Email addresses" value={f.emails} onChange={(e) => setF({ ...f, emails: e.target.value })} placeholder="name@example.com, other@example.com" /></Field>
        <fieldset className="f" style={{ border: 0, padding: 0 }}><legend className="small b">Links to include</legend>
          {SHARE_LINKS.filter(([k]) => c.links[k]).map(([k, l]) => <label key={k} className="row small"><input type="checkbox" aria-label={l} checked={f.codes.includes(k)} onChange={(e) => setF({ ...f, codes: e.target.checked ? [...f.codes, k] : f.codes.filter((x) => x !== k) })} />{l}</label>)}</fieldset>
        <Field label="Message (optional)"><Input aria-label="Message" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} placeholder={`Here are the links for ${c.name}.`} /></Field>
      </div>
      {err && <p className="err" role="alert">{err}</p>}
      <button className="btn pri" onClick={send}>Send links</button>
      <p className="small muted" style={{ marginTop: 8 }}>In the test build the email is kept in Settings › Email & SMS Outbox; in production it goes out through Amazon SES.</p>
    </Card>
    <Card title="Shared before">{history.length ? <div className="tw"><table className="t"><thead><tr><th>When</th><th>To</th><th>Links</th><th>By</th></tr></thead>
      <tbody>{history.map((x, i) => <tr key={i}><td className="small">{new Date(x.at).toLocaleString('en-IN')}</td><td className="small">{x.to.join(', ')}</td><td className="small">{x.links.map((k) => SHARE_LINKS.find(([a]) => a === k)?.[1]).join(', ')}</td><td>{x.by}</td></tr>)}</tbody></table></div>
      : <p className="small muted">Not shared yet.</p>}</Card>
  </>;
}

// #/p/platform — every function of the platform, for the service provider
export function PlatformRequirements() {
  const rc = DEFAULT_RATE_CARD;
  const basic = new Set([...BASIC.flatMap((b) => b[2]), ...ALWAYS]);
  const sold = (c) => basic.has(c) ? 'Basic (every school)' : rc.addons.find((a) => (a.menus || []).includes(c) || (a.functions || []).includes(c))?.name || 'Plan';
  const who = (c) => ROLES.filter((r) => (ACCESS[r.code] || []).includes(c)).map((r) => r.name).join(', ') || '—';
  return <div className="page" style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
    <h1 style={{ marginBottom: 4 }}>Platform requirements — every function</h1>
    <p className="muted">For the service provider (registration no. {PROVIDER_REG}). Every menu, sub-menu and function of the platform: what it is for, how to use it, who gets it, and how it is sold. A client's own requirements document lists only what that school has.</p>
    <div className="row noprint" style={{ margin: '10px 0 18px' }}><button className="btn pri" onClick={() => window.print()}>Print / save as PDF</button><a className="btn" href={REQ_DOC} target="_blank" rel="noreferrer">Full requirements document</a><a className="btn" href="#/login">Sign in</a></div>
    <h2>Basic features (every school)</h2>
    <ul>{BASIC.map(([c, t]) => <li key={c}>{t}</li>)}</ul>
    <h2>Every menu and screen</h2>
    {MENU.filter((m) => m.code !== 'VIEWAS').map((m) => <section key={m.code}>
      <h3 style={{ marginBottom: 6 }}>{m.label}</h3>
      <table className="t"><thead><tr><th style={{ width: '18%' }}>Screen</th><th>What it is for</th><th>How to use it</th><th style={{ width: '14%' }}>Who</th><th style={{ width: '14%' }}>Sold as</th></tr></thead>
        <tbody>{m.items.filter((i) => i[0][0] !== '#').map((i) => <tr key={i[0]}><td className="b">{i[1]}</td><td className="small">{SCREEN_HELP[i[0]]?.[0] || '—'}</td><td className="small">{SCREEN_HELP[i[0]]?.[1] || '—'}</td>
          <td className="small">{who(i[0])}</td><td className="small">{['SERVICE_PROVIDER', 'PLATFORM'].includes(m.code) ? 'Service provider only' : m.code === 'PROJECT' ? 'Client schools' : sold(i[0])}</td></tr>)}</tbody></table>
    </section>)}
    <h2>Functions inside screens</h2>
    <table className="t"><thead><tr><th>Function</th><th>Menu</th><th>Sold as</th></tr></thead>
      <tbody>{FUNCTIONS.map((f) => <tr key={f.code}><td>{f.name}</td><td>{MENU.find((m) => m.code === f.module)?.label}</td><td className="small">{sold(f.code)}</td></tr>)}</tbody></table>
    <h2>Add-ons</h2>
    <table className="t"><thead><tr><th>Add-on</th><th>Group</th><th>What it adds</th></tr></thead>
      <tbody>{rc.addons.map((a) => <tr key={a.code}><td className="b">{a.name}</td><td>{a.group}</td><td className="small">{(a.menus || []).map((m) => LABEL[m] || m).join(', ') || 'Switched on inside its screens'}</td></tr>)}</tbody></table>
  </div>;
}
