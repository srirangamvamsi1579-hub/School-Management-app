// In-memory database for user testing. Saved to this browser (localStorage) so testers keep their
// changes between visits; "Reset demo data" puts everything back. In production these calls go to the API.
import { createContext, useContext, useState, useCallback, useEffect, useRef, createElement } from 'react';
import { buildSeed } from './seed.js';

const KEY = 'school-app-demo-v9';
const Ctx = createContext(null);

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const d = JSON.parse(raw); if (d.version === 9) return d; }
  } catch (e) { /* storage blocked — run from memory only */ }
  return buildSeed();
}
function save(db) {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* ignore */ }
}
// Several tabs (or a tester with the app open twice) share one copy. Every save bumps a revision;
// before changing anything we start from the newest saved copy, so one tab never overwrites another's work.
function latest(cur) {
  try { const raw = localStorage.getItem(KEY); if (raw) { const d = JSON.parse(raw); if (d.version === 9 && (d.rev || 0) > (cur.rev || 0)) return d; } } catch (e) { /* ignore */ }
  return cur;
}

export function StoreProvider({ children }) {
  const [db, setDb] = useState(load);
  // Test build: open straight into the main screen as the Admin (the sign-in page is still there after "Switch user")
  const [session, setSession] = useState(() => {
    let s = null; try { s = JSON.parse(sessionStorage.getItem(KEY + '-s')); } catch (e) { /* ignore */ }
    if (s !== null && s !== undefined) return s.signedOut ? null : s;
    if (typeof location !== 'undefined' && /^#\/(p\/|login)/.test(location.hash)) return null;
    if ((typeof import.meta.env !== 'undefined' && import.meta.env.VITE_TARGET === 'mobile') || (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.())) return null;   // the phone app always asks who you are
    const a = load().users.find((u) => u.role === 'ADMIN' && u.status === 'ACTIVE');
    return a ? { role: a.role, userId: a.id, name: a.name, auto: true } : null;
  });
  // Admin "View as": see the app exactly as another profile sees it. Read-only unless the Admin switches on "act as".
  const [viewAs, setViewAsState] = useState(() => { try { return JSON.parse(sessionStorage.getItem(KEY + '-va')) || null; } catch (e) { return null; } });
  const setViewAs = (v) => { setViewAsState(v); try { v ? sessionStorage.setItem(KEY + '-va', JSON.stringify(v)) : sessionStorage.removeItem(KEY + '-va'); } catch (e) { /* ignore */ } };
  const viewed = viewAs && session?.role === 'ADMIN' ? db.users.find((u) => u.id === viewAs.userId) : null;
  const effective = viewed ? { role: viewed.role, userId: viewed.id, name: viewed.name, viewAs: true, by: session } : session;
  const readOnly = !!viewed && !viewAs.act;
  const [toast, setToast] = useState(null);
  const readOnlyRef = useRef(false);
  // Read-only access to the screen in front of the person (set by the app shell from the department's access level)
  const [screenLock, setScreenLock] = useState(null);
  const lockRef = useRef(null);
  lockRef.current = screenLock;
  const lockMsg = () => `Read only — you can view “${lockRef.current}” but not change anything`;

  // mutate(fn): fn receives a copy it may change; returns fn's result
  const mutate = useCallback((fn) => {
    if (readOnlyRef.current) { notify('Preview only — switch on “Act as this person” to make changes'); return undefined; }
    if (lockRef.current) { notify(lockMsg()); return undefined; }
    let result;
    setDb((prev) => {
      const base = latest(prev);
      const next = structuredClone(base);
      result = fn(next);
      next.rev = (base.rev || 0) + 1;
      save(next);
      return next;
    });
    return result;
  }, []);

  // Synchronous variant for actions whose result the screen needs immediately
  const run = (fn) => {
    if (readOnly) { notify('Preview only — switch on “Act as this person” to make changes'); throw new Error('Preview only — switch on “Act as this person” to make changes'); }
    if (lockRef.current) { const m = lockMsg(); notify(m); throw new Error(m); }
    const base = latest(db);
    const next = structuredClone(base);
    const result = fn(next);          // throws → nothing saved
    next.rev = (base.rev || 0) + 1;
    save(next); setDb(next);
    return result;
  };

  const login = (s) => { setViewAs(null); setSession(s); try { sessionStorage.setItem(KEY + '-s', JSON.stringify(s)); } catch (e) { /* ignore */ } };
  const logout = () => { setViewAs(null); setSession(null); try { sessionStorage.setItem(KEY + '-s', JSON.stringify({ signedOut: true })); } catch (e) { /* ignore */ } };
  const reset = () => { const d = buildSeed(); save(d); setDb(d); notify('Demo data reset'); };
  const notify = (msg, kind = 'ok') => { setToast({ msg, kind, id: Date.now() }); setTimeout(() => setToast(null), 3200); };

  // Another tab saved: show its changes here straight away
  useEffect(() => { const h = (e) => { if (e.key === KEY && e.newValue) { try { const d = JSON.parse(e.newValue); setDb((cur) => (d.version === 9 && (d.rev || 0) > (cur.rev || 0) ? d : cur)); } catch (x) { /* ignore */ } } };
    window.addEventListener('storage', h); return () => window.removeEventListener('storage', h); }, []);
  useEffect(() => { const h = (e) => notify(e.detail); document.addEventListener('app-toast', h); return () => document.removeEventListener('app-toast', h); }, []);
  readOnlyRef.current = readOnly;
  return createElement(Ctx.Provider, { value: { db, mutate, run, session: effective, realSession: session, viewAs: viewed ? viewAs : null, setViewAs, readOnly, screenLock, setScreenLock, login, logout, reset, toast, notify } }, children);
}

export const useStore = () => useContext(Ctx);
