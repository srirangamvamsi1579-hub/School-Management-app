import { useEffect, useMemo, useState } from 'react';
import { useStore } from './data/store.js';
import { MENU, PLANS, ROLES, LABEL, MODULE_OF, canSee } from './data/menu.js';
import { applyTheme } from './lib/theme.js';
import { tenantOf } from './lib/logic.js';
import { screensFor, roleName } from './lib/auth.js';
import Login from './screens/Login.jsx';
import { SCREENS, Placeholder } from './screens/index.js';

export default function App() {
  const { db, session, logout, toast, reset } = useStore();
  const [screen, setScreen] = useState(null);
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
    if (i[0][0] !== '#') return canSee(i[0], role, rank, tenant.overrides, perms);
    const next = arr.slice(k + 1).find((x) => x[0][0] === '#');
    const until = next ? arr.indexOf(next) : arr.length;
    return arr.slice(k + 1, until).some((x) => canSee(x[0], role, rank, tenant.overrides, perms));
  }) })).filter((m) => m.items.some((i) => i[0][0] !== '#')) : []), [role, rank, tenant, perms]);
  const links = db.links.filter((l) => role && l.roles.includes(role));

  useEffect(() => {
    const ok = visible.some((m) => m.items.some((i) => i[0] === screen));
    if (!ok && visible.length) setScreen(visible[0].items.find((i) => i[0][0] !== '#')[0]);
  }, [visible, screen]);

  if (!session) return <Login />;

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
      </div>
      {toast && <div className="toast" role="status">{toast.msg}</div>}
    </div>
  );
}
