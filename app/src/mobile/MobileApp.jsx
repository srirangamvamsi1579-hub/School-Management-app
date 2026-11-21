// The mobile app (Play Store / App Store). Minimal features, switched per school in the Platform Console,
// and filtered by the same access rules as the website, so a parent never sees staff screens and a
// teacher only sees what their role and designation allow.
import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../data/store.js';
import { mobileTabs, PLANS, LABEL } from '../data/menu.js';
import { tenantOf, fullName, classLabel, openInvoices, balance } from '../lib/logic.js';
import { screensFor, signIn, roleName, accessLevel } from '../lib/auth.js';
import { applyTheme } from '../lib/theme.js';
import { SCREENS } from '../screens/index.js';
import { myChildren } from '../screens/Requests.jsx';
import { REQ_TYPES, sectionsCoordinatedBy } from '../lib/pickup.js';
import { parseHash } from '../lib/links.js';
import { PrivacyPolicy, DeleteAccountRequest } from '../screens/Public.jsx';
import { SignUp } from '../screens/Login.jsx';
import { isNative, platform, enablePush, getPref, setPref, onBack, exitApp, onNetwork } from './native.js';

const ICON = { book: 'M4 4h7a3 3 0 013 3v13a2 2 0 00-2-2H4zM20 4h-7a3 3 0 00-3 3v13a2 2 0 012-2h8z', video: 'M3 6h12v12H3zM15 10l6-3v10l-6-3', home: 'M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1z', send: 'M3 12l18-8-8 18-2-8z', receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6', user: 'M12 12a4 4 0 100-8 4 4 0 000 8zm-8 9c0-4 4-6 8-6s8 2 8 6',
  calendar: 'M4 6h16v15H4zM4 10h16M8 3v4M16 3v4', check: 'M4 12l5 5L20 6', inbox: 'M4 4h16v16H4zM4 13h5l1 3h4l1-3h5', chat: 'M4 5h16v11H9l-5 4z', shield: 'M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z', bus: 'M5 4h14v12H5zM5 11h14M8 19v-3M16 19v-3', list: 'M8 6h12M8 12h12M8 18h12M4 6h0M4 12h0M4 18h0', more: 'M5 12h.01M12 12h.01M19 12h.01', settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z' };
export const Icon = ({ name, size = 22 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICON[name] || ICON.list} /></svg>;

export default function MobileApp({ preview = false, school: fixedSchool = null }) {
  const { db, session, login, logout, toast, setScreenLock } = useStore();
  const [school, setSchool] = useState(null);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState('M_HOME');
  const [more, setMore] = useState(false);
  const [online, setOnline] = useState(true);
  const [hash, setHash] = useState(() => location.hash);
  useEffect(() => { const h = () => setHash(location.hash); window.addEventListener('hashchange', h); return () => window.removeEventListener('hashchange', h); }, []);
  useEffect(() => { if (fixedSchool) { setSchool(fixedSchool); setReady(true); return; } getPref('school').then((v) => { setSchool(v); setReady(true); }); }, [fixedSchool]);
  useEffect(() => onNetwork(setOnline), []);
  useEffect(() => { applyTheme(db.theme); }, [db.theme]);
  // Anything that scrolls sideways (wide tables) must be reachable by keyboard and screen readers
  useEffect(() => { const fix = () => document.querySelectorAll('.mobile .tw, .mobile .card, .mobile .m-body div').forEach((el) => {
      if (!el.matches('.tw, .card') && !/(auto|scroll)/.test(getComputedStyle(el).overflowX)) return;
      if (el.scrollWidth > el.clientWidth + 1) { if (!el.hasAttribute('tabindex')) { el.tabIndex = 0; el.setAttribute('role', 'region'); el.setAttribute('aria-label', (el.querySelector('h2')?.innerText || 'Table') + ' — scroll sideways'); } } });
    fix(); const mo = new MutationObserver(fix); mo.observe(document.body, { childList: true, subtree: true }); return () => mo.disconnect(); }, []);
  useEffect(() => onBack(() => { if (more) setMore(false); else if (tab !== 'M_HOME') setTab('M_HOME'); else exitApp(); }), [tab, more]);

  const tenant = tenantOf(db);
  const me = db.users.find((u) => u.id === session?.userId) || null;
  const role = session?.role;
  const perms = useMemo(() => (role ? { [role]: screensFor(db, me, role) } : null), [db.perms, db.deptPerms, db.roleDepartments, db.customRoles, db.removedProfiles, db.designationAccess, me, role, db.settings]);
  const tabs = role ? mobileTabs(tenant, role, perms) : [];
  useEffect(() => { if (role && !tabs.some((t) => t[0] === tab)) setTab('M_HOME'); }, [tabs.map((t) => t[0]).join(), tab, role]);
  // Read-only tabs: the person can look but not change anything
  const roTab = !!role && tab !== 'M_HOME' && accessLevel(db, me, role, tab) === 'READ';
  useEffect(() => { setScreenLock?.(roTab ? LABEL[tab] : null); return () => setScreenLock?.(null); }, [roTab, tab]);

  const shell = (body, bar = null) => (
    <div className={'mobile' + (preview ? ' framed' : '')} data-platform={platform()}>
      {!online && <div className="m-offline" role="status">You are offline — showing the last saved information. Changes are sent when you are back online.</div>}
      {body}{bar}
      {toast && <div className="toast" role="status">{toast.msg}</div>}
    </div>
  );
  // Public pages open inside the app too (privacy policy, delete account), with a way back
  const pub = parseHash(hash);
  if (pub?.kind === 'p' && ['privacy', 'delete'].includes(pub.code)) return shell(<><div className="m-top"><button className="btn m-link" style={{ color: 'inherit' }} onClick={() => { location.hash = ''; }}>‹ Back</button></div>{pub.code === 'privacy' ? <PrivacyPolicy /> : <DeleteAccountRequest />}</>);
  if (!ready) return shell(<div className="m-center" aria-busy="true">Loading…</div>);
  if (!school) return shell(<SchoolPicker onPick={async (code) => { await setPref('school', code); setSchool(code); }} />);
  const t = db.tenants.find((x) => x.code === school);
  if (!session) return shell(<MobileSignIn school={t} onChange={async () => { await setPref('school', ''); setSchool(null); }} login={login} />);
  if (!tenant.mobile?.enabled) return shell(<div className="m-center"><h1>{tenant.name}</h1><p>Your school has not switched on the mobile app yet. Please use the website: {tenant.subdomain}.yourapp.com</p><button className="btn" onClick={logout}>Sign out</button></div>);

  const Screen = tab === 'M_HOME' ? MobileHome : SCREENS[tab];
  const shown = tabs.length > 5 ? [...tabs.slice(0, 4), ['MORE', 'More', 'more']] : tabs;
  const go = (code) => { setTab(code); setMore(false); window.scrollTo?.(0, 0); };
  return shell(
    <>
      <header className="m-top">{tab !== 'M_HOME' ? <button className="m-back" onClick={() => go('M_HOME')} aria-label="Back to Home">‹</button> : <div className="logo" aria-hidden="true">{tenant.name[0]}</div>}<div style={{ flex: 1, minWidth: 0 }}><div className="b m-trunc">{tab === 'M_HOME' ? tenant.name : LABEL[tab]}</div><div className="small m-trunc">{session.name} · {roleName(db, role)}</div></div></header>
      <main className="m-body" id="m-main">{roTab && <div className="ro-bar" role="status">Read only — you can view this but not change anything.</div>}{Screen ? <Screen go={go} code={tab} tabs={tabs} /> : <p>Not available.</p>}</main>
      {more && <div className="m-sheet" role="dialog" aria-label="More">{tabs.slice(4).map(([code, label, icon]) => <button key={code} className="m-sheet-item" onClick={() => go(code)}><Icon name={icon} />{label}</button>)}<button className="m-sheet-item" onClick={() => setMore(false)}>Close</button></div>}
    </>,
    <nav className="m-tabs" aria-label="Main">{shown.map(([code, label, icon]) => <button key={code} className={'m-tab' + ((code === tab || (code === 'MORE' && tabs.slice(4).some((x) => x[0] === tab))) ? ' on' : '')} aria-current={code === tab ? 'page' : undefined}
      onClick={() => (code === 'MORE' ? setMore(!more) : go(code))}><Icon name={icon} /><span>{label}</span></button>)}</nav>
  );
}

function SchoolPicker({ onPick }) {
  const { db } = useStore();
  // A client's test build (or its own app) starts on that school's code
  const own = db.tenants.find((t) => t.id === db.tenantId && t.env);
  const [code, setCode] = useState(own?.code || '');
  const [err, setErr] = useState('');
  const pick = () => { const t = db.tenants.find((x) => x.code.toLowerCase() === code.trim().toLowerCase() || x.subdomain === code.trim().toLowerCase()); if (!t) { setErr('No school with that code. The school office can tell you the code.'); return; } onPick(t.code); };
  return <main className="m-center">
    <h1>Welcome</h1><p>Enter your school code. You find it on the school's website or in the welcome email.</p>
    <label className="m-field"><span>School code</span><input className="i" autoCapitalize="characters" autoComplete="off" value={code} onChange={(e) => { setCode(e.target.value); setErr(''); }} onKeyDown={(e) => e.key === 'Enter' && pick()} /></label>
    {err && <p className="note warn" role="alert">{err}</p>}
    <button className="btn pri m-wide" onClick={pick}>Continue</button>
    <p className="small muted">{own ? `Your school: ${own.code} (${own.name})` : 'Demo code: GVS (Green Valley School)'}</p>
    <p className="small"><a href="#/p/privacy">Privacy policy</a></p>
  </main>;
}

function MobileSignIn({ school, onChange, login }) {
  const { db, run } = useStore();
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [demo, setDemo] = useState(false);
  const [signup, setSignup] = useState(false);
  const go = () => { const r = run((d) => signIn(d, id.trim(), pw)); if (r.error) { setErr(r.error); return; } login({ role: r.user.role, userId: r.user.id, name: r.user.name }); };
  const demoUsers = db.users.filter((u) => u.status === 'ACTIVE' && ['PARENT', 'TEACHER', 'FRONT_OFFICE', 'TRANSPORT', 'PRINCIPAL'].includes(u.role) && !['Vice Principal'].includes(u.designation));
  if (signup) return <main className="m-center"><button className="btn m-link" onClick={() => setSignup(false)}>‹ Back to sign in</button><SignUp compact onDone={() => setSignup(false)} /></main>;
  return <main className="m-center">
    <div className="logo" style={{ width: 56, height: 56, fontSize: 24 }} aria-hidden="true">{school.name[0]}</div>
    <h1 style={{ marginBottom: 0 }}>{school.name}</h1><button className="btn m-link" onClick={onChange}>Not your school? Change</button>
    <label className="m-field"><span>Email or mobile</span><input className="i" autoComplete="username" inputMode="email" autoCapitalize="none" value={id} onChange={(e) => setId(e.target.value)} /></label>
    <label className="m-field"><span>Password</span><input className="i" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go()} /></label>
    {err && <p className="note warn" role="alert">{err}</p>}
    <button className="btn pri m-wide" onClick={go} disabled={!id || !pw}>Sign in</button>
    <button className="btn m-wide" onClick={() => setSignup(true)}>Create an account</button>
    <p className="small muted">Parents and school staff can create their own account here. Your details are checked against the school's records, so the account opens straight away — no waiting for approval. <a href="#/p/privacy">Privacy</a></p>
    <button className="btn m-link" onClick={() => setDemo(!demo)} aria-expanded={demo}>Demo accounts (test build)</button>
    {demo && <div className="m-list">{demoUsers.map((u) => <button key={u.id} className="m-row" onClick={() => login({ role: u.role, userId: u.id, name: u.name })}><b>{u.name}</b><span className="small muted">{roleName(db, u.role)}{u.designation ? ' · ' + u.designation : ''} · {u.login}</span></button>)}<p className="small muted">Password for every demo account: Demo@123</p></div>}
  </main>;
}

// Home: a short summary for the person's role, plus their latest messages
function MobileHome({ go, tabs }) {
  const { db, session } = useStore();
  const [push, setPush] = useState(null);
  const me = db.users.find((u) => u.id === session.userId);
  const has = (c) => tabs.some((t) => t[0] === c);
  const today = new Date().toISOString().slice(0, 10);
  const kids = session.role === 'PARENT' ? myChildren(db, session) : [];
  const mine = me?.staffId;
  const secs = mine ? sectionsCoordinatedBy(db, mine) : [];
  const waiting = db.requests.filter((r) => r.status === 'Submitted' && !['MEETING', 'OTHER'].includes(r.type) && (['PRINCIPAL', 'ADMIN'].includes(session.role) || secs.includes(db.students.find((s) => s.id === r.studentId)?.sectionId))).length;
  const meetings = db.requests.filter((r) => r.type === 'MEETING' && r.status === 'Submitted' && (session.role === 'PRINCIPAL' || r.teacherId === mine)).length;
  const gate = db.requests.filter((r) => ['PICKUP', 'EARLY_LEAVE', 'LATE_ARRIVAL'].includes(r.type) && r.dateFrom <= today && today <= r.dateTo && r.status === 'Approved').length;
  const inbox = db.outbox.filter((m) => m.to && (m.to === me?.email || m.to === me?.mobile)).slice(0, 5);
  const card = (title, body, code, cta) => <section className="card m-card"><h2>{title}</h2>{body}{code && has(code) && <button className="btn pri m-wide" onClick={() => go(code)}>{cta}</button>}</section>;
  return <>
    {kids.map((k) => { const att = (db.attendance[k.sectionId + ':' + today] || {})[k.id] || 'P'; const rt = db.routes.find((r) => r.id === k.routeId); const st = rt?.stops?.find((s) => s.name === k.stop);
      const open = db.requests.filter((r) => r.studentId === k.id && ['Submitted', 'Approved'].includes(r.status) && (r.dateTo || r.dateFrom) >= today);
      const due = openInvoices(db, k.id).reduce((a, i) => a + balance(i), 0);
      return card(fullName(k), <><p className="small muted">{classLabel(db, k)}</p>
        <dl className="m-dl"><dt>Today</dt><dd>{{ P: 'Present', A: 'Absent', L: 'On leave', LATE: 'Arrived late' }[att] || att}</dd>
          {st && <><dt>Bus</dt><dd>{rt.id} · {k.stop} · pickup {st.am}, drop {st.pm}</dd></>}
          <dt>Open requests</dt><dd>{open.length ? open.map((r) => REQ_TYPES[r.type].short).join(', ') : 'None'}</dd>
          {has('SELF_FEES') && <><dt>Fees due</dt><dd>{due > 0 ? '₹' + due.toLocaleString('en-IN') : 'Nothing due'}</dd></>}</dl></>, 'SELF_REQUESTS', 'New request');
    })}
    {has('STU_REQUESTS') && card('Waiting for your approval', <p className="m-big">{waiting}</p>, 'STU_REQUESTS', 'Open approvals')}
    {has('STU_MEETINGS') && card('Parent meeting requests', <p className="m-big">{meetings}</p>, 'STU_MEETINGS', 'Reply to parents')}
    {has('STU_GATE') && card('Collections and late arrivals today', <p className="m-big">{gate}</p>, 'STU_GATE', 'Open gate desk')}
    {has('TRN_SHEETS') && card('Today’s routes', <p className="small">{db.routes.length} routes · sheets update the moment a parent sends a change.</p>, 'TRN_SHEETS', 'Open route sheets')}
    <section className="card m-card"><h2>Notifications</h2>
      {push === null ? <button className="btn m-wide" onClick={async () => setPush(await enablePush())}>Turn on notifications</button> : <p className="small">Notifications: {push === 'granted' ? 'on' : push === 'denied' ? 'off — you can change this in your phone settings' : 'not available on this device'}</p>}
      {inbox.length === 0 ? <p className="small muted">No messages yet.</p> : <ul className="m-inbox">{inbox.map((m) => <li key={m.id}><b>{m.subject}</b><span className="small muted">{new Date(m.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span></li>)}</ul>}
    </section>
    <p className="small muted" style={{ textAlign: 'center' }}>{isNative() ? platform() + ' app' : 'Mobile app preview'} · <a href="#/p/privacy">Privacy policy</a></p>
  </>;
}
