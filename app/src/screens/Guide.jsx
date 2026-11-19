// Help → User Guide & Demo: guided end-to-end demos, every menu explained, and what each role sees.
// The demo bar (bottom of the screen) walks through a workflow step by step, signing in as the right person.
import { useEffect, useState } from 'react';
import { useStore } from '../data/store.js';
import { Page, Card, Tabs } from '../components/ui.jsx';
import { MENU, ACCESS, PLANS, MIN_RANK, LABEL, CHANNELS, PHONE_READY, channelIn, publishedLayout, mobileTabs, webScreens, canSee, FUNCTIONS, funcOn, ALWAYS_ON } from '../data/menu.js';
import { SCREEN_FLOW } from '../data/guideFlows.js';
import { docsFor } from './Help.jsx';
import { SCREEN_HELP, WORKFLOWS, DEMO_PEOPLE } from '../data/guide.js';
import { tenantOf } from '../lib/logic.js';
import { roleName, rolePerms, screensFor } from '../lib/auth.js';

const KEY = 'school-demo-run';
const ROLE_ORDER = ['PARENT', 'TEACHER', 'FRONT_OFFICE', 'TRANSPORT', 'PRINCIPAL', 'ACCOUNTANT', 'ADMIN', 'PLATFORM', 'SALES'];
const HOME_USER = { ADMIN: 'U1', PRINCIPAL: 'U2', ACCOUNTANT: 'U3', TEACHER: 'U4', FRONT_OFFICE: 'U5', PARENT: 'U6', PLATFORM: 'U8', TRANSPORT: 'U20', SALES: 'U-SALES' };
export const readRun = () => { try { return JSON.parse(sessionStorage.getItem(KEY)); } catch (e) { return null; } };
const saveRun = (r) => { try { r ? sessionStorage.setItem(KEY, JSON.stringify(r)) : sessionStorage.removeItem(KEY); } catch (e) { /* ignore */ } window.dispatchEvent(new Event('demo-run')); };

// Sign in as the step's person and open its screen
export function useDemoNav() {
  const { db, session, login, logout } = useStore();
  return (wfId, i) => {
    const wf = WORKFLOWS.find((w) => w.id === wfId); const st = wf.steps[i];
    saveRun({ wf: wfId, i });
    if (st.public) {
      if (st.public === '#/') { logout(); location.hash = '#/'; } else window.open(location.href.split('#')[0] + st.public, '_blank');
      return;
    }
    const u = db.users.find((x) => x.id === st.as);
    openAs(login, session, u, st.screen);
  };
}
// Ask the app to open a screen once this person is signed in (App picks it up; no reliance on hash timing)
function openAs(login, session, u, screen) {
  try { screen ? sessionStorage.setItem('demo-screen', screen) : sessionStorage.removeItem('demo-screen'); } catch (e) { /* ignore */ }
  if (u && session?.userId !== u.id) login({ role: u.role, userId: u.id, name: u.name });
  window.dispatchEvent(new Event('demo-go'));
}
export const signInAs = (login, db, id, screen, session = null) => openAs(login, session, db.users.find((x) => x.id === id), screen);

export function DemoBar() {
  const [run, setRun] = useState(readRun);
  const go = useDemoNav();
  useEffect(() => { const h = () => setRun(readRun()); window.addEventListener('demo-run', h); return () => window.removeEventListener('demo-run', h); }, []);
  useEffect(() => { document.body.classList.toggle('demo-on', !!run); return () => document.body.classList.remove('demo-on'); }, [run]);
  if (!run) return null;
  const wf = WORKFLOWS.find((w) => w.id === run.wf); if (!wf) return null;
  const st = wf.steps[run.i]; const last = run.i === wf.steps.length - 1;
  return (
    <aside className="demo-bar noprint" role="region" aria-label="Guided demo">
      <div className="row"><span className="pill info">Demo · step {run.i + 1} of {wf.steps.length}</span><b className="small" style={{ flex: 1 }}>{wf.title}</b>
        <button className="btn sm" onClick={() => saveRun(null)} aria-label="End the demo">End demo</button></div>
      <p style={{ margin: '8px 0 4px' }}><b>{st.public ? 'Without signing in' : DEMO_PEOPLE[st.as]}</b>{st.screen ? <> → <b>{LABEL[st.screen]}</b></> : ''}: {st.do}</p>
      <p className="small muted" style={{ margin: '0 0 8px' }}>You should see: {st.check}{st.needs ? ` Note: ${st.needs}` : ''}</p>
      <div className="row">
        <button className="btn sm" disabled={run.i === 0} onClick={() => go(wf.id, run.i - 1)}>‹ Back</button>
        <button className="btn sm" onClick={() => go(wf.id, run.i)}>{st.public ? 'Open the page' : 'Take me there'}</button>
        <span className="sp" />
        {last ? <button className="btn sm pri" onClick={() => { saveRun(null); location.hash = '#/s/HELP_GUIDE'; }}>Finish ✓</button>
          : <button className="btn sm pri" onClick={() => go(wf.id, run.i + 1)}>Next step ›</button>}
      </div>
    </aside>
  );
}

export default function HelpGuide() {
  const { db, session, login } = useStore();
  const [tab, setTab] = useState('demos');
  const [open, setOpen] = useState(null);
  const go = useDemoNav();
  const t = tenantOf(db);
  const layout = publishedLayout(t);
  const rank = PLANS.find((p) => p.code === t.plan).rank;
  const planOf = (code) => PLANS.find((p) => p.rank === (MIN_RANK[code] || 1))?.name;
  const whoCan = (code) => ROLE_ORDER.filter((r) => (['PLATFORM', 'SALES'].includes(r) ? ACCESS[r].includes(code) : (rolePerms(db, r)).includes(code)));
  // What the guide covers: the menus this person can open, everything in the school's plan, or everything the platform offers
  const [scope, setScope] = useState(session && !['PLATFORM', 'SALES'].includes(session.role) ? 'MINE' : 'SCHOOL');
  const me = session ? db.users.find((u) => u.id === session.userId) : null;
  const inPlan = (code) => { const mod = MENU.find((m) => m.items.some((i) => i[0] === code)); if (!mod) return true; const ov = t.overrides || {};
    const modOn = ALWAYS_ON.includes(mod.code) || (ov[mod.code] !== undefined ? ov[mod.code] : rank >= mod.min); return modOn && (ov[code] !== undefined ? ov[code] : rank >= (MIN_RANK[code] || 1)); };
  const mineList = session ? screensFor(db, me, session.role) : [];
  const shown = (code) => (scope === 'ALL' ? true : scope === 'SCHOOL' ? inPlan(code) : inPlan(code) && (session?.role === 'ADMIN' ? ACCESS.ADMIN.includes(code) : mineList.includes(code)) && canSee(code, session.role, rank, t.overrides, { [session.role]: mineList }));
  const menus = MENU.map((m) => ({ ...m, items: m.items.filter((i) => i[0][0] !== '#' && shown(i[0])) })).filter((m) => m.items.length);
  const demoOk = (w) => w.steps.every((st) => !st.screen || inPlan(st.screen));
  const flows = WORKFLOWS.filter((w) => scope === 'ALL' || demoOk(w));
  const scopeBar = <div className="row small" style={{ margin: '10px 0', flexWrap: 'wrap' }} role="group" aria-label="What the guide covers"><b>Showing:</b>
    {[...(session && !['PLATFORM', 'SALES'].includes(session.role) ? [['MINE', 'Menus I can open']] : []), ['SCHOOL', `Everything in our plan (${PLANS.find((p) => p.rank === rank).name})`], ['ALL', 'Everything the platform offers']].map(([k, l]) =>
      <button key={k} className={'btn sm' + (scope === k ? ' pri' : '')} aria-pressed={scope === k} onClick={() => setScope(k)}>{l}</button>)}
    <span className="muted">{menus.reduce((a, m) => a + m.items.length, 0)} screens</span></div>;
  const body = (
    <>
      <Tabs tabs={[['demos', `Guided demos (${flows.length})`], ['flow', 'Screen by screen'], ['menus', 'Every menu explained'], ['roles', 'What each role sees'], ['start', 'Getting started']]} value={tab} onChange={setTab} />
      {tab !== 'roles' && tab !== 'start' && scopeBar}

      {tab === 'demos' && <div style={{ marginTop: 12 }}>
        <p className="small muted">Press <b>Start</b>. A bar at the bottom shows each step, signs you in as the right person and opens the right screen. Data is demo data in your browser; the “Reset demo data” button at the top (Admin) starts over.</p>
        {flows.length < WORKFLOWS.length && <p className="small muted">{WORKFLOWS.length - flows.length} more demo(s) use menus outside {scope === 'MINE' ? 'your access or ' : ''}the school’s plan; choose “Everything the platform offers” to see them.</p>}
        <div className="grid g2">{flows.map((w) => <Card key={w.id} title={w.title} right={<span className="small muted">{w.time}{!demoOk(w) ? ' · needs a higher plan' : ''}</span>}>
          <p className="small" style={{ marginTop: 0 }}>{w.roles}</p>
          {open === w.id ? <ol className="small" style={{ paddingLeft: 18 }}>{w.steps.map((s, i) => <li key={i} className="guide-step"><b>{s.public ? 'No sign-in' : DEMO_PEOPLE[s.as]}{s.screen ? ` → ${LABEL[s.screen]}` : ''}:</b> {s.do} <span className="muted">Check: {s.check}</span></li>)}</ol>
            : <p className="small muted">{w.steps.length} steps: {w.steps.map((s) => (s.screen ? LABEL[s.screen] : 'public page')).join(' → ')}</p>}
          <div className="row"><button className="btn pri sm" onClick={() => go(w.id, 0)}>Start</button><button className="btn sm" aria-expanded={open === w.id} onClick={() => setOpen(open === w.id ? null : w.id)}>{open === w.id ? 'Hide steps' : 'Show steps'}</button></div>
        </Card>)}</div>
      </div>}

      {tab === 'flow' && <div style={{ marginTop: 4 }}>
        <p className="small muted">For each screen: what it is for, the steps in the order you click through them, and tips. Only the screens selected above are listed, so the guide changes with the school’s plan, the functions switched on and your access.</p>
        {menus.map((m) => <Card key={m.code} title={m.label}>
          {m.items.map(([code, label]) => { const fl = SCREEN_FLOW[code]; const [what] = SCREEN_HELP[code] || ['']; const who = whoCan(code); const try1 = who.find((r) => HOME_USER[r]);
            return <div key={code} style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
              <div className="row" style={{ justifyContent: 'space-between' }}><b>{label}</b>{try1 && <button className="btn sm" onClick={() => signInAs(login, db, HOME_USER[try1], code, session)} aria-label={`Try ${label}`}>Try</button>}</div>
              {what && <div className="small">{what}</div>}
              {fl && <div className="flow" aria-label={`${label} steps`}>{fl.flow.map((st, i) => <span key={i} style={{ display: 'contents' }}>{i > 0 && <span className="arr">→</span>}<span className="s">{i + 1}. {st}</span></span>)}</div>}
              {fl?.tips?.length > 0 && <ul className="small muted" style={{ margin: '4px 0 0', paddingLeft: 18 }}>{fl.tips.map((x, i) => <li key={i}>{x}</li>)}</ul>}
              <div className="small muted">Who: {who.map((r) => roleName(db, r)).join(', ') || '—'} · from {planOf(code)}</div>
            </div>; })}
        </Card>)}
        {session && docsFor(db, session.role).length > 0 && <Card title="School documents"><ul className="small">{docsFor(db, session.role).map((d) => <li key={d.id}>{d.kind === 'FILE' ? <a href={d.data} download={d.fileName}>{d.title}</a> : <a href={d.url} target="_blank" rel="noreferrer">{d.title}</a>}</li>)}</ul></Card>}
      </div>}

      {tab === 'menus' && <div style={{ marginTop: 12 }}>
        <p className="small muted">Every main menu and sub-menu: what it is for, how to use it, who can open it, the plan it comes with, and where it shows. A school sees only the menus in its plan or switched on for it; a person sees only those their role, designation or personal grants allow.</p>
        {menus.map((m) => <Card key={m.code} title={`${m.label}${m.min > 1 ? ` · from ${PLANS[m.min - 1].name}` : ''}`}>
          <div className="tw"><table className="t"><thead><tr><th>Sub-menu</th><th>What it is for</th><th>How to use it</th><th>Who can open it</th><th>Where</th><th /></tr></thead>
            <tbody>{m.items.map(([code, label]) => { const [what, how] = SCREEN_HELP[code] || ['', '']; const who = whoCan(code);
              const app = who.filter((r) => !['PLATFORM', 'SALES'].includes(r) && PHONE_READY[code] && channelIn(layout, r, code) !== 'WEB');
              const try1 = who.find((r) => HOME_USER[r]);
              return <tr key={code}><td className="b">{label}<div className="small muted">from {planOf(code)}</div></td><td className="small">{what}</td><td className="small">{how}</td>
                <td className="small">{who.map((r) => roleName(db, r)).join(', ') || '—'}</td>
                <td className="small">{PHONE_READY[code] ? (app.length ? <>Website; app for {app.map((r) => roleName(db, r)).join(', ')}</> : 'Website (phone-ready)') : 'Website'}</td>
                <td>{try1 && <button className="btn sm" onClick={() => signInAs(login, db, HOME_USER[try1], code, session)} aria-label={`Open ${label} as ${roleName(db, try1)}`}>Try</button>}</td></tr>; })}</tbody></table></div>
        </Card>)}
      </div>}

      {tab === 'roles' && <div className="grid g2" style={{ marginTop: 12 }}>{ROLE_ORDER.map((r) => { const perms = { [r]: rolePerms(db, r) };
        const web = webScreens(t, r, perms); const app = mobileTabs({ ...t, mobile: { enabled: true } }, r, perms);
        return <Card key={r} title={roleName(db, r)} right={HOME_USER[r] && <button className="btn sm" onClick={() => signInAs(login, db, HOME_USER[r])}>Sign in as {DEMO_PEOPLE[HOME_USER[r]].split(' (')[0]}</button>}>
          <div className="small"><b>Website ({web.length}):</b> {MENU.filter((m) => m.items.some((i) => web.includes(i[0]))).map((m) => `${m.label} (${m.items.filter((i) => web.includes(i[0])).map((i) => i[1]).join(', ')})`).join(' · ')}</div>
          <div className="small" style={{ marginTop: 6 }}><b>Phone app:</b> {['PLATFORM', 'SALES'].includes(r) ? 'Website only' : app.map((x) => x[1]).join(', ')}</div>
        </Card>; })}</div>}

      {tab === 'start' && <div className="grid g2" style={{ marginTop: 12 }}>
        <Card title="Links">
          <ul className="small" style={{ paddingLeft: 18 }}>
            <li><b>Website (this app):</b> sign in with a demo account, or use Demo quick access on the sign-in page.</li>
            <li><b>Phone app preview:</b> <a href="#/p/mobile" target="_blank" rel="noreferrer">#/p/mobile</a> — school code <span className="kbd">GVS</span>.</li>
            <li><b>Public admission form:</b> <a href="#/p/apply" target="_blank" rel="noreferrer">#/p/apply</a></li>
            <li><b>Privacy policy:</b> <a href="#/p/privacy" target="_blank" rel="noreferrer">#/p/privacy</a> · <b>Delete an account:</b> <a href="#/p/delete" target="_blank" rel="noreferrer">#/p/delete</a></li>
            <li><b>Any screen directly:</b> add <span className="kbd">#/s/CODE</span>, e.g. <span className="kbd">#/s/SELF_REQUESTS</span>.</li>
          </ul></Card>
        <Card title="Demo accounts (password Demo@123)">
          <div className="tw"><table className="t"><thead><tr><th>Person</th><th>Sign-in</th><th /></tr></thead>
            <tbody>{Object.entries(DEMO_PEOPLE).map(([id, label]) => { const u = db.users.find((x) => x.id === id); return u && <tr key={id}><td className="small">{label}</td><td className="small"><span className="kbd">{u.login}</span></td>
              <td><button className="btn sm" onClick={() => signInAs(login, db, id)}>Sign in</button></td></tr>; })}</tbody></table></div></Card>
        <Card title="Things to know">
          <ul className="small" style={{ paddingLeft: 18 }}>
            <li>Emails and SMS are not really sent: read them in Settings → Email & SMS Outbox, or in the Test inbox on the sign-in page.</li>
            <li>Data stays in this browser. Two tabs stay in step. Reset with the Reset demo data button at the top (Admin), or the link at the bottom of the sign-in page.</li>
            <li>Plans: Starter, Growth, Professional, Enterprise. The demo school is on {PLANS.find((p) => p.rank === rank).name}. Menus marked “from Growth” or higher need that plan or an add-on.</li>
          </ul></Card>
        <Card title="Functions switched on for this school">
          <table className="t small"><tbody>{FUNCTIONS.map((f) => <tr key={f.code}><td>{f.name}</td><td>{funcOn(t, f.code) ? <span className="pill ok">On</span> : <span className="pill">Off</span>}</td></tr>)}</tbody></table>
          <p className="small muted">The platform team switches these per school. The guide and demos follow what is switched on.</p></Card>
      </div>}
    </>
  );
  if (!session) return <div className="login"><main className="box" style={{ maxWidth: 1100 }}><div className="row"><h1 style={{ flex: 1 }}>User guide — {t.name}</h1><a className="small" href="#/">Sign in</a></div>{body}</main><DemoBar /></div>;
  return <Page title="User Guide & Demo" sub="Guided demos, the screen-by-screen flow of every menu, every menu explained, and what each role sees — following what your school has switched on and what you can open.">{body}</Page>;
}
