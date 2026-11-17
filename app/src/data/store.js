// In-memory database for user testing. Saved to this browser (localStorage) so testers keep their
// changes between visits; "Reset demo data" puts everything back. In production these calls go to the API.
import { createContext, useContext, useState, useCallback, useEffect, createElement } from 'react';
import { buildSeed } from './seed.js';

const KEY = 'school-app-demo-v6';
const Ctx = createContext(null);

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const d = JSON.parse(raw); if (d.version === 6) return d; }
  } catch (e) { /* storage blocked — run from memory only */ }
  return buildSeed();
}
function save(db) {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* ignore */ }
}
// Several tabs (or a tester with the app open twice) share one copy. Every save bumps a revision;
// before changing anything we start from the newest saved copy, so one tab never overwrites another's work.
function latest(cur) {
  try { const raw = localStorage.getItem(KEY); if (raw) { const d = JSON.parse(raw); if (d.version === 6 && (d.rev || 0) > (cur.rev || 0)) return d; } } catch (e) { /* ignore */ }
  return cur;
}

export function StoreProvider({ children }) {
  const [db, setDb] = useState(load);
  const [session, setSession] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(KEY + '-s')) || null; } catch (e) { return null; }
  });
  const [toast, setToast] = useState(null);

  // mutate(fn): fn receives a copy it may change; returns fn's result
  const mutate = useCallback((fn) => {
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
    const base = latest(db);
    const next = structuredClone(base);
    const result = fn(next);          // throws → nothing saved
    next.rev = (base.rev || 0) + 1;
    save(next); setDb(next);
    return result;
  };

  const login = (s) => { setSession(s); try { sessionStorage.setItem(KEY + '-s', JSON.stringify(s)); } catch (e) { /* ignore */ } };
  const logout = () => { setSession(null); try { sessionStorage.removeItem(KEY + '-s'); } catch (e) { /* ignore */ } };
  const reset = () => { const d = buildSeed(); save(d); setDb(d); notify('Demo data reset'); };
  const notify = (msg, kind = 'ok') => { setToast({ msg, kind, id: Date.now() }); setTimeout(() => setToast(null), 3200); };

  // Another tab saved: show its changes here straight away
  useEffect(() => { const h = (e) => { if (e.key === KEY && e.newValue) { try { const d = JSON.parse(e.newValue); setDb((cur) => (d.version === 6 && (d.rev || 0) > (cur.rev || 0) ? d : cur)); } catch (x) { /* ignore */ } } };
    window.addEventListener('storage', h); return () => window.removeEventListener('storage', h); }, []);
  useEffect(() => { const h = (e) => notify(e.detail); document.addEventListener('app-toast', h); return () => document.removeEventListener('app-toast', h); }, []);
  return createElement(Ctx.Provider, { value: { db, mutate, run, session, login, logout, reset, toast, notify } }, children);
}

export const useStore = () => useContext(Ctx);
