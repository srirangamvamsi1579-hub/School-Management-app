import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from './data/store.js';
import { MENU, PLANS, ROLES, LABEL, MODULE_OF, canSee, onWeb } from './data/menu.js';
import { applyTheme } from './lib/theme.js';
import { tenantOf } from './lib/logic.js';
import { screensFor, roleName } from './lib/auth.js';
import Login from './screens/Login.jsx';
import { SCREENS, Placeholder } from './screens/index.js';
import { PublicEnquiry, PrivacyPolicy, DeleteAccountRequest } from './screens/Public.jsx';
import MobileApp from './mobile/MobileApp.jsx';
import HelpGuide, { DemoBar } from './screens/Guide.jsx';
import { parseHash } from './lib/links.js';

export default function App() {
  const { db, session, logout, toast, reset, notify } = useStore();
  const [hash, setHash] = useState(() => (typeof location !== 'undefined' ? location.hash : ''));
  const link = parseHash(hash);
  const [screen, setScreen] = useState(() => (link?.kind === 's' ? link.code : null));
  const [navOpen, setNavOpen] = useState(false);
  const [openMods, setOpenMods] = useState({});
  const [armed, setArmed] = useState(false);
  useEffect(() => { applyTheme(db.theme); }, [db.theme]);

  const tenant = tenantOf(db);
  const rank = PLANS.find((p) => p.code === tenant.plan).rank;
  const role = session?.role;
  const me = db.users?.find((u) => u.id === session?.userId) || null;
  const perms = useMemo(() => (role ? { [role]: screensFor(db, me, role) } : null), [db.perms, db.designationAccess, me, role]);
  const visible = useMemo(() => (role ? MENU.map((m) => ({ ...m, items: m.items.filter((i, k, arr) => {
    // Website menu: allowed for the role (plan, add-ons, role, designation, grants) and not set to "app only"
    const show = (c) => canSee(c, role, rank, tenant.overrides, perms) && onWeb(tenant, role, c);
    if (i[0][0] !== '#') return show(i[0]);
    const next = arr.slice(k + 1).find((x) => x[0][0] === '#');
    const until = next ? arr.indexOf(next) : arr.length;
    return arr.slice(k + 1, until).some((x) => show(x[0]));
  }) })).filter((m) => m.items.some((i) => i[0][0] !== '#')) : []), [role, rank, tenant, perms]);
  const links = db.links.filter((l) => role && l.roles.includes(role));

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
    if (want && visible.some((m) => m.items.some((i) => i[0] === want))) { try { sessionStorage.removeItem('demo-screen'); } catch (e) { /* ignore */ } if (want !== screen) { setScreen(want); return; } }
    const ok = visible.some((m) => m.items.some((i) => i[0] === screen));
    if (!ok && visible.length) {
      if (screen && LABEL[screen] && !switched) notify(`“${LABEL[screen]}” is not available for your account on the website — opened your home screen`);
      const home = role === 'PLATFORM' ? 'PLT_SCHOOLS' : visible[0].items.find((i) => i[0][0] !== '#')[0];
      setScreen(home);
    }
  }, [visible, screen, demoTick]);
  useEffect(() => { if (session && screen && visible.some((m) => m.items.some((i) => i[0] === screen))) { try { history.replaceState(null, '', '#/s/' + screen); } catch (e) { /* sandboxed frame */ } } }, [screen, session, visible]);

  if (link?.kind === 'p' && link.code === 'apply') return <PublicEnquiry embed={link.embed} />;
  if (link?.kind === 'p' && link.code === 'privacy') return <PrivacyPolicy />;
  if (link?.kind === 'p' && link.code === 'delete') return <DeleteAccountRequest />;
  if (link?.kind === 'p' && link.code === 'mobile') return <MobileApp preview={window.innerWidth > 500} />;
  if (link?.kind === 'p' && link.code === 'guide' && !session) return <HelpGuide />;
  if (!session) return <><Login next={link?.kind === 's' ? LABEL[link.code] : null} /><DemoBar /></>;

  const go = (code) => { setScreen(code); setNavOpen(false); };
  const Screen = SCREENS[screen] || Placeholder;
  const topnav = db.theme.template === 'TOPNAV';
  const user = ROLES.find((r) => r.code === role);

  const sideNav = (
    <nav className={'side' + (navOpen ? ' open' : '')} aria-label="Main menu">
      <div className="school"><div className="logo">{tenant.name[0]}</div><div><div className="b" style={{ fontSize: 13 }}>{tenant.name}</div><div className="small" style={{ opacity: .7 }}>{PLANS.find((p) => p.rank === rank).name} plan</div></div></div>
      {links.filter((l) => l.under === 'TOP').map((l) => <a key={l.id} className="item" href={l.url} target="_blank" rel="noreferrer">{l.label}<span className="ext">↗</span></a>)}
      {visible.map((m) => {
        const closed = openMods[m.code] === false;
        return (
          <div key={m.code}>
            <div className="mod" onClick={() => setOpenMods({ ...openMods, [m.code]: closed })}>{m.label}<span>{closed ? '+' : '–'}</span></div>
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
          <span className="crumbs">{MODULE_OF[screen]} / <b style={{ color: 'var(--ink)' }}>{LABEL[screen]}</b></span>
          <span className="sp" />
          <span className="pill info">Test build · in-memory data</span>
          <span className="small"><b>{session.name || user?.user}</b> · {roleName(db, role)}{me?.designation ? ' · ' + me.designation : ''}</span>
          <button className="btn sm" onClick={() => { if (armed) { reset(); setArmed(false); } else { setArmed(true); setTimeout(() => setArmed(false), 4000); } }}>{armed ? 'Click again to reset' : 'Reset demo data'}</button>
          <button className="btn sm" onClick={logout}>Switch user</button>
        </header>
        <main className="content"><Screen go={go} code={screen} /></main>
        <DemoBar />
      </div>
      {toast && <div className="toast" role="status">{toast.msg}</div>}
    </div>
  );
}
