// Main menu: every menu and sub-menu this person can open, as tiles. Reachable from every screen (top bar → Main menu).
import { useStore } from '../data/store.js';
import { Page } from '../components/ui.jsx';
import { MENU, LABEL, viewAsUser } from '../data/menu.js';
import { roleName } from '../lib/auth.js';

export default function MainMenu({ go, menus = [] }) {
  const { db, session } = useStore();
  const me = db.users.find((u) => u.id === session.userId);
  const mods = menus.filter((m) => m.code !== 'VIEWAS');
  const va = menus.find((m) => m.code === 'VIEWAS');
  return (
    <Page title={`Main menu`} sub={`${session.name || ''} · ${roleName(db, session.role)}${me?.designation && me.designation !== 'Parent' ? ' · ' + me.designation : ''}. Every menu you can open; the side menu has the same list.`}>
      {va && <section className="card" style={{ borderColor: 'var(--brand)' }} aria-label="View as profile">
        <div className="row" style={{ justifyContent: 'space-between' }}><h2 style={{ margin: 0, fontSize: 16 }}>View as Profile <span className="small muted">(Admin only)</span></h2><span className="small muted">See exactly what each profile sees, without signing in as them</span></div>
        <div className="grid g4" style={{ marginTop: 10 }}>{va.items.map(([code, label]) => { const u = viewAsUser(db, code); return <button key={code} className="card" style={{ textAlign: 'left', cursor: u ? 'pointer' : 'default', marginBottom: 0 }} disabled={!u} onClick={() => go(code)}>
          <div className="b">{label}</div><div className="small muted">{u ? u.name : 'No account with this profile yet'}</div></button>; })}</div>
      </section>}
      <div className="grid g3">{mods.map((m) => <section key={m.code} className="card" aria-label={m.label} style={{ marginBottom: 0 }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>{m.label}</h2>
        <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>{m.items.filter((i) => i[0][0] !== '#').map(([code, label]) => <button key={code} className="btn sm" onClick={() => go(code)}>{label}</button>)}</div>
      </section>)}</div>
    </Page>
  );
}
