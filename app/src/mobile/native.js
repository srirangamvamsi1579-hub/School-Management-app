// Thin bridge to the phone's native features. Inside the store app (Capacitor) the plugins are
// registered on window.Capacitor.Plugins; in a browser every call falls back to a web equivalent,
// so the same code runs in the web preview, the tests and on the phone.
const cap = () => (typeof window !== 'undefined' ? window.Capacitor : null);
export const isNative = () => !!cap()?.isNativePlatform?.();
export const platform = () => cap()?.getPlatform?.() || 'web';
const plugin = (name) => cap()?.Plugins?.[name];

// Push notifications: request permission, register, and report the device token to the school server
export async function enablePush(onToken) {
  const P = plugin('PushNotifications');
  if (P) {
    const perm = await P.requestPermissions();
    if (perm.receive !== 'granted') return 'denied';
    P.addListener('registration', (t) => onToken?.(t.value));
    await P.register();
    return 'granted';
  }
  if (typeof Notification === 'undefined') return 'unsupported';
  try { return await Notification.requestPermission(); } catch (e) { return 'unsupported'; }
}

// Small key-value store that survives app restarts (school code, last screen)
export async function getPref(key) {
  const P = plugin('Preferences');
  if (P) return (await P.get({ key })).value;
  try { return localStorage.getItem('m-' + key); } catch (e) { return null; }
}
export async function setPref(key, value) {
  const P = plugin('Preferences');
  if (P) return P.set({ key, value: String(value) });
  try { localStorage.setItem('m-' + key, String(value)); } catch (e) { /* ignore */ }
}

// Native share sheet (route sheet, receipt link); web falls back to navigator.share or copy
export async function share({ title, text, url }) {
  const P = plugin('Share');
  if (P) return P.share({ title, text, url, dialogTitle: title });
  if (navigator.share) return navigator.share({ title, text, url });
  await navigator.clipboard?.writeText(url || text);
  return 'copied';
}

// Android hardware back button: go back a tab, or leave the app from Home
export function onBack(handler) {
  const A = plugin('App');
  if (!A) return () => {};
  const sub = A.addListener('backButton', handler);
  return () => sub?.remove?.();
}
export const exitApp = () => plugin('App')?.exitApp?.();

// Online / offline
export function onNetwork(cb) {
  const N = plugin('Network');
  if (N) { const s = N.addListener('networkStatusChange', (x) => cb(x.connected)); N.getStatus().then((x) => cb(x.connected)); return () => s?.remove?.(); }
  const on = () => cb(true), off = () => cb(false);
  window.addEventListener('online', on); window.addEventListener('offline', off); cb(navigator.onLine !== false);
  return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
}
