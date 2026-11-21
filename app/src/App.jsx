import { useEffect, useMemo, useRef, useState } from 'react';
import { DemoEndBar } from './screens/Provider.jsx';
import { BoardBar } from './screens/Release14.jsx';
import { useStore } from './data/store.js';
import { MENU, PLANS, ROLES, LABEL, MODULE_OF, canSee, onWeb, viewAsUser, funcOn } from './data/menu.js';
import { applyTheme } from './lib/theme.js';
import { tenantOf } from './lib/logic.js';
import { screensFor, roleName, accessLevel } from './lib/auth.js';
import Login from './screens/Login.jsx';
import { SCREENS, Placeholder } from './screens/index.js';
import { alertsFor, unreadFor, markRead } from './lib/alerts.js';
import { PublicEnquiry, PrivacyPolicy, DeleteAccountRequest } from './screens/Public.jsx';
import { PublicSite, RequirementsPage } from './screens/Project.jsx';
import { ClientsScreen, clientsMenu, PlatformRequirements } from './screens/Clients.jsx';
import MobileApp from './mobile/MobileApp.jsx';
import HelpGuide, { DemoBar } from './screens/Guide.jsx';
import { parseHash } from './lib/links.js';

export default function App() {
  const { db, session, logout, toast, reset, notify, viewAs, setViewAs, readOnly, setScreenLock } = useStore();
  const [hash, setHash] = useState(() => (typeof location !== 'undefined' ? location.hash : ''));
  const link = parseHash(hash);
  const [screen, setScreen] = useState(() => (link?.kind === 's' ? link.code : null));
  const [navOpen, setNavOpen] = useState(false);
  // Side menu groups are collapsed when the app opens; a group stays open for this visit once the person opens it
  const [openMods, setOpenModsRaw] = useState(() => { try { return JSON.parse(sessionStorage.getItem('school-side-open') || '{}') || {}; } catch (e) { return {}; } });
  const setOpenMods = (v) => { setOpenModsRaw(v); try { sessionStorage.setItem('school-side-open', JSON.stringify(v)); } catch (e) { /* storage off */ } };
  const [armed, setArmed] = useState(false);
  useEffect(() => { applyTheme(db.theme); }, [db.theme]);

  const tenant = tenantOf(db);
  const rank = PLANS.find((p) => p.code === tenant.plan).rank;
  const role = session?.role;
  const me = db.users?.find((u) => u.id === session?.userId) || null;
  const perms = useMemo(() => (role ? { [role]: screensFor(db, me, role) } : null), [db.perms, db.deptPerms, db.roleDepartments, db.customRoles, db.removedProfiles, db.designationAccess, me, role]);
  const visible = useMemo(() => (role ? MENU.map((m) => ({ ...m, items: m.items.filter((i, k, arr) => {
    // Website menu: allowed for the role (plan, add-ons, role, designation, grants) and not set to "app only"
    const show = (c) => canSee(c, role, rank, tenant.overrides, perms) && onWeb(tenant, role, c);
    if (i[0][0] !== '#') return show(i[0]);
    const next = arr.slice(k + 1).find((x) => x[0][0] === '#');
    const until = next ? arr.indexOf(next) : arr.length;
    return arr.slice(k + 1, until).some((x) => show(x[0]));
  }) })).filter((m) => m.items.some((i) => i[0][0] !== '#')).concat(clientsMenu(db, me, role)) : []), [role, rank, tenant, perms, db.provider?.clients, db.provider?.projects, db.tenants]);
  const links = db.links.filter((l) => role && l.roles.includes(role));
  // Read-only screens: the person can look but not change anything (set per department in Roles & Permissions)
  const level = role && screen ? accessLevel(db, me, role, screen) : null;
  const locked = level === 'READ' && !(viewAs && readOnly);
  useEffect(() => { setScreenLock(locked ? LABEL[screen] : null); }, [locked, screen]);

  // Website links (#/s/SCREEN) open that screen after sign-in; the role's access rules still decide
  useEffect(() => { const h = () => { setHash(location.hash); const l = parseHash(location.hash); if (l?.kind === 's') setScreen(l.code); }; window.addEventListener('hashchange', h); return () => window.removeEventListener('hashchange', h); }, []);
  const [demoTick, setDemoTick] = useState(0);
  useEffect(() => { const h = () => { setHash(location.hash.startsWith('#/p/') ? '' : location.hash); setDemoTick((n) => n + 1); }; window.addEventListener('demo-go', h); return () => window.removeEventListener('demo-go', h); }, []);
  // Don't complain about the previous person's screen right after switching user (guided demo, Switch user)
  const lastUser = useRef(session?.userId);
  useEffect(() => {
    const switched = lastUser.current !== session?.userId; lastUser.current = session?.userId;
    // A guided-demo step (or "Try") asked for a screen: open it once it is in this person's menu
    let want = null; try { want = sessionStorage.getItem('demo-screen'); } catch (e) { /* ignore */ }
    if (want && (want === 'HOME' || visible.some((m) => m.items.some((i) => i[0] === want)))) { try { sessionStorage.removeItem('demo-screen'); } catch (e) { /* ignore */ } if (want !== screen) { setScreen(want); return; } }
    const ok = screen === 'HOME' || visible.some((m) => m.items.some((i) => i[0] === screen));
    if (!ok && visible.length) {
      if (screen && LABEL[screen] && !switched) notify(`“${LABEL[screen]}” is not available for your account on the website — opened your home screen`);
      const home = 'HOME';                                  // the Main menu: every menu this person can open
      setScreen(home);
    }
  }, [visible, screen, demoTick]);
  useEffect(() => { if (session && screen && (screen === 'HOME' || visible.some((m) => m.items.some((i) => i[0] === screen)))) { try { history.replaceState(null, '', '#/s/' + screen); } catch (e) { /* sandboxed frame */ } } }, [screen, session, visible]);

  if (link?.kind === 'p' && link.code === 'apply') return <PublicEnquiry embed={link.embed} />;
  if (link?.kind === 'p' && link.code === 'privacy') return <PrivacyPolicy />;
  if (link?.kind === 'p' && link.code === 'delete') return <DeleteAccountRequest />;
  if (link?.kind === 'p' && link.code === 'site') return <PublicSite />;
  if (link?.kind === 'p' && link.code === 'requirements') return <RequirementsPage />;
  if (link?.kind === 'p' && link.code === 'platform') return <PlatformRequirements />;
  if (link?.kind === 'p' && link.code === 'mobile') return <MobileApp preview={window.innerWidth > 500} />;
  if (link?.kind === 'p' && link.code === 'guide' && !session) return <HelpGuide />;
  if (!session) return <><Login next={link?.kind === 's' ? LABEL[link.code] : null} /><DemoBar /></>;

  const go = (code) => {
    setNavOpen(false);
    if (code.startsWith('VA_')) {                          // Admin: View as Profile
      const u = viewAsUser(db, code);
      if (!u) { notify('No account with this profile yet — add one in Operations → Users'); return; }
      setViewAs({ userId: u.id, code, mode: 'web', act: false }); setScreen('HOME'); return;
    }
    setScreen(code);
  };
  const backToAdmin = () => { const from = viewAs?.code; setViewAs(null); setScreen(from || 'HOME'); };
  const vaUser = viewAs ? db.users.find((u) => u.id === viewAs.userId) : null;
  const viewBar = viewAs && vaUser && (
    <div className="va-bar noprint" role="region" aria-label="Viewing as another profile">
      <span className="pill info">Viewing as</span>
      <b>{vaUser.name}</b><span className="small">{roleName(db, vaUser.role)}{vaUser.designation && vaUser.designation !== 'Parent' ? ' · ' + vaUser.designation : ''}</span>
      <div className="seg" role="group" aria-label="Show">
        <button className={'btn sm' + (viewAs.mode === 'web' ? ' pri' : '')} aria-pressed={viewAs.mode === 'web'} onClick={() => setViewAs({ ...viewAs, mode: 'web' })}>Website</button>
        <button className={'btn sm' + (viewAs.mode === 'app' ? ' pri' : '')} aria-pressed={viewAs.mode === 'app'} onClick={() => setViewAs({ ...viewAs, mode: 'app' })}>Phone app</button>
      </div>
      <label className="row small"><input type="checkbox" checked={!!viewAs.act} onChange={(e) => setViewAs({ ...viewAs, act: e.target.checked })} />Act as this person (changes are saved as them)</label>
      <span className="sp" />
      <button className="btn sm pri" onClick={backToAdmin}>Back to Admin</button>
    </div>
  );
  if (viewAs && vaUser && viewAs.mode === 'app') return (
    <div className="va-phone">{viewBar}
      <p className="small muted" style={{ textAlign: 'center' }}>{readOnly ? 'Preview only: you can open every tab; changes are blocked.' : 'Acting as this person: changes are saved under their name.'}</p>
      <MobileApp preview school={tenant.code} />
    </div>
  );
  const Screen = SCREENS[screen] || (screen?.startsWith('CLI_') ? ClientsScreen : Placeholder);
  const topnav = db.theme.template === 'TOPNAV';
  const user = ROLES.find((r) => r.code === role);

  const sideNav = (
    <nav className={'side' + (navOpen ? ' open' : '')} aria-label="Main menu">
      <div className="school"><div className="logo">{tenant.name[0]}</div><div><div className="b" style={{ fontSize: 13 }}>{tenant.name}</div><div className="small" style={{ opacity: .7 }}>{tenant.demo ? tenant.demo.tier : tenant.trial ? tenant.trial.tier : PLANS.find((p) => p.rank === rank).name} plan</div></div></div>
      <button className={'item' + (screen === 'HOME' ? ' on' : '')} onClick={() => go('HOME')} aria-current={screen === 'HOME' ? 'page' : undefined}>⌂ Main menu</button>
      {links.filter((l) => l.under === 'TOP').map((l) => <a key={l.id} className="item" href={l.url} target="_blank" rel="noreferrer">{l.label}<span className="ext">↗</span></a>)}
      {visible.map((m) => {
        // Collapsed unless the person opened it
        const closed = !openMods[m.code];
        const toggle = () => setOpenMods({ ...openMods, [m.code]: closed });
        return (
          <div key={m.code}>
            <div className="mod" role="button" tabIndex={0} aria-expanded={!closed} onClick={toggle} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }}>{m.label}<span aria-hidden="true">{closed ? '+' : '–'}</span></div>
            {!closed && m.items.map((i) => (i[0][0] === '#'
              ? <div key={i[0]} className="head">{i[1]}</div>
              : <button key={i[0]} className={'item' + (screen === i[0] ? ' on' : '')} onClick={() => go(i[0])} aria-current={screen === i[0] ? 'page' : undefined}>{i[1]}</button>))}
            {!closed && links.filter((l) => l.under === m.code).map((l) => <a key={l.id} className="item" href={l.url} target="_blank" rel="noreferrer">{l.label}<span className="ext">↗</span></a>)}
          </div>
        );
      })}
    </nav>
  );

  const topMenu = (
    <div className="topmenu">
      <div className="logo" style={{ marginRight: 8 }}>{tenant.name[0]}</div>
      {visible.map((m) => (
        <select key={m.code} aria-label={m.label} value={m.items.some((i) => i[0] === screen) ? screen : ''} onChange={(e) => go(e.target.value)}>
          <option value="" disabled>{m.label}</option>
          {m.items.filter((i) => i[0][0] !== '#').map((i) => <option key={i[0]} value={i[0]}>{i[1]}</option>)}
        </select>
      ))}
    </div>
  );

  return (
    <div className={'app' + (topnav ? ' topnav' : '')}>
      {topnav ? topMenu : sideNav}
      <div className="main">
        <header className="topbar">
          {!topnav && <button className="btn sm mob-only" onClick={() => setNavOpen(!navOpen)} aria-label="Menu">☰</button>}
          <button className="btn sm" onClick={() => go('HOME')} aria-label="Main menu" disabled={screen === 'HOME'}>⌂ Main menu</button>
          <span className="crumbs">{screen === 'HOME' ? <b style={{ color: 'var(--ink)' }}>Main menu</b> : <>{MODULE_OF[screen]} / <b style={{ color: 'var(--ink)' }}>{LABEL[screen]}</b></>}</span>
          <span className="sp" />
          <span className="pill info">Test build · in-memory data</span>
          <Bell userId={viewAs ? null : session.userId} go={go} />
          <span className="small"><b>{session.name || user?.user}</b> · {roleName(db, role)}{me?.designation ? ' · ' + me.designation : ''}</span>
          <button className="btn sm" onClick={() => { if (armed) { reset(); setArmed(false); } else { setArmed(true); setTimeout(() => setArmed(false), 4000); } }}>{armed ? 'Click again to reset' : 'Reset demo data'}</button>
          {!viewAs && <button className="btn sm" onClick={logout}>Switch user</button>}
        </header>
        {viewBar}
        <DemoEndBar tenant={tenant} />
        {tenant.trial && <div className="ro-bar" role="status" style={{ background: 'var(--info-bg, #e8f0fe)' }}>Customer test build: <b>{tenant.name}</b> · {tenant.trial.tier} plan · version {tenant.trial.version} · {tenant.trial.date} · demo data, kept in this browser only.</div>}
        {locked && <div className="ro-bar" role="status">Read only — you can view this screen but not change anything. Your school sets this in Roles &amp; Permissions.</div>}
        <main className={'content' + (locked ? ' ro' : '')}>{/^EXM_/.test(screen) && funcOn(tenant, 'FN_BOARD') && <BoardBar />}<Screen go={go} code={screen} menus={visible} /></main>
        <DemoBar />
      </div>
      {toast && <div className="toast" role="status">{toast.msg}</div>}
    </div>
  );
}

// Notifications for the signed-in person (leave to approve, decisions, report cards …)
function Bell({ userId, go }) {
  const { db, mutate } = useStore();
  const [open, setOpen] = useState(false);
  if (!userId) return null;
  const mine = alertsFor(db, userId).slice(0, 30);
  const n = unreadFor(db, userId);
  const pick = (a) => { mutate((d) => markRead(d, userId, a.id)); setOpen(false); if (a.screen) go(a.screen); };
  return <>
    <button className="btn sm bell" aria-label={`Notifications${n ? `, ${n} unread` : ''}`} aria-expanded={open} onClick={() => setOpen(!open)}>🔔{n > 0 && <span className="n">{n}</span>}</button>
    {open && <div className="alerts-pop" role="dialog" aria-label="Notifications">
      <div className="row" style={{ justifyContent: 'space-between', padding: '2px 6px 8px' }}><b>Notifications</b>{n > 0 && <button className="btn sm" onClick={() => mutate((d) => markRead(d, userId))}>Mark all read</button>}</div>
      {mine.length ? mine.map((a) => <button key={a.id} className={'a' + (a.read ? '' : ' unread')} onClick={() => pick(a)}><div className="b small">{a.title}</div><div className="small">{a.body}</div><div className="small muted">{new Date(a.at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div></button>)
        : <p className="small muted" style={{ padding: 6 }}>Nothing new.</p>}
    </div>}
  </>;
}
