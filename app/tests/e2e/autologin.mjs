// Release 17 made every visit start on the School login page. The older browser tests were written for the build that
// opened signed in as the school Admin; this keeps that starting point for them (except where they open #/login or a
// public page), so they keep testing their own feature. The School login itself is tested in release17.test.mjs.
const KEY = 'school-app-demo-v9-s';
const SCRIPT = `(() => { try {
  if (/^#\\/(login|p\\/)/.test(location.hash) || sessionStorage.getItem('${KEY}')) return;
  sessionStorage.setItem('${KEY}', JSON.stringify({ role: 'ADMIN', userId: 'U1', name: 'Admin user', auto: true }));
} catch (e) {} })();`;
export function withAutoAdmin(browser) {
  const newContext = browser.newContext.bind(browser);
  browser.newContext = async (...a) => { const ctx = await newContext(...a); await ctx.addInitScript(SCRIPT); return ctx; };
  browser.newPage = async (...a) => (await browser.newContext(...a)).newPage();
  return browser;
}
