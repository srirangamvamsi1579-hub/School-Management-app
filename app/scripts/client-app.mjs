// Release 16.1: set up a client's UAT/demo school and its own app from the command line.
//   node scripts/client-app.mjs <config.json>
// Creates the proposal and converts it (basic menus + agreed add-ons, Project Links, branch school/<sub>),
// fills the client's own website, and writes: schools/<sub>/school.json, schools/<sub>/links.json and
// dist-client/<sub>/index.html (the single-file app that opens straight into this school, with its own saved data).
import fs from 'node:fs';
import path from 'node:path';
import { buildSeed } from '../src/data/seed.js';
import { blankOptions, DEFAULT_RATE_CARD as RC } from '../src/lib/pricing.js';
import { newProposal } from '../src/lib/proposals.js';
import * as D from '../src/lib/delivery.js';

const cfg = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
// Release 16.3: a rebuild.json next to the config (downloaded from Add-ons for this School › Rebuild app) sets the add-ons and version
const rebuildFile = path.join(path.dirname(path.resolve(process.argv[2])), 'rebuild.json');
if (fs.existsSync(rebuildFile)) { const r = JSON.parse(fs.readFileSync(rebuildFile, 'utf8')); Object.assign(cfg, { addons: r.addons, screens: r.screens || {}, version: r.version, addonsMenu: r.addonsMenu ?? cfg.addonsMenu, allAddons: false }); }
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const db = buildSeed();
db.provider.profile.testSite = cfg.appUrl;                       // every generated link points into the client's own app
const p = newProposal(db, { ...blankOptions(RC), ...cfg.options }, 'Release script');
const cp = D.convertProposal(db, p.id, 'Release script');
if (cfg.subdomain) {                                              // a cleaner address than the one made from the name
  const t = db.tenants.find((x) => x.id === cp.uatTenantId);
  Object.assign(t, { liveSubdomain: cfg.subdomain, subdomain: 'uat-' + cfg.subdomain });
  cp.release.branch = D.schoolBranch(cfg.subdomain); t.delivery.branch = cp.release.branch;
  D.refreshLinks(db, cp, 'Release script');
}
for (const [code, url] of Object.entries(cfg.links || {})) D.setLink(db, cp.id, code, { url }, 'Release script');
if (cfg.allAddons || Array.isArray(cfg.addons)) {                                              // every feature, and the add-ons menu to switch them per school
  const t = db.tenants.find((x) => x.id === cp.uatTenantId);
  if (cfg.allAddons || cfg.addonsMenu) { t.overrides.SP_ADDONS = true; t.overrides.SP_FEATURES = true; }
  D.setSchoolAddons(db, t.id, cfg.allAddons ? RC.addons.map((a) => a.code) : cfg.addons, 'Release script');
  if (cfg.screens && Object.keys(cfg.screens).length) D.setSchoolScreens(db, t.id, cfg.screens, 'Release script');
  t.delivery.addonLog = []; t.delivery.builtAddons = [...t.delivery.addons]; t.delivery.builtOverrides = { ...t.overrides };   // the published build
  t.plan = 'ENTERPRISE'; cp.tierName = cfg.allAddons || cfg.addons.length === RC.addons.length ? 'All features' : `Basic + ${cfg.addons.length} add-ons`;
}
if (cfg.version) {                                                // the version from the rebuild
  const t = db.tenants.find((x) => x.id === cp.uatTenantId);
  cp.version = cfg.version; t.delivery.version = cfg.version;
}
D.refreshLinks(db, cp, 'Release script');                         // the test-build links now carry the filled links
const uat = db.tenants.find((t) => t.id === cp.uatTenantId);
const sub = uat.liveSubdomain;
const file = D.schoolFile(db, cp);
const links = Object.fromEntries(cp.links.filter((l) => !D.isPlaceholder(l.url)).map((l) => [l.code, { label: l.label, url: l.url, status: l.status, version: l.version }]));
const dir = path.join(root, 'schools', sub);
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'school.json'), JSON.stringify(file, null, 2) + '\n');
fs.writeFileSync(path.join(dir, 'links.json'), JSON.stringify({ school: uat.name, code: uat.code, project: cp.no, generated: new Date().toISOString().slice(0, 10), links }, null, 2) + '\n');
// The client's own app: the single-file build, opening on this school, with its own saved data
const trial = cp.links.find((l) => l.code === 'TEST_BUILD').url;
const hash = trial.slice(trial.indexOf('#'));
const html = fs.readFileSync(path.join(root, 'app/dist-single/index.html'), 'utf8');
const boot = `<script>window.__SCHOOL_APP__={storeKey:'school-app-${sub}${cfg.storeVersion ? '-' + cfg.storeVersion : ''}-v${cp.version}',school:${JSON.stringify(uat.name)}};` +
  `(function(){var h=location.hash,k='school-app-${sub}${cfg.storeVersion ? '-' + cfg.storeVersion : ''}-v${cp.version}',to={'#/p/site':'?to=site','#/p/mobile':'?to=app','#/p/requirements':'?to=req'};` +
  `if(h.indexOf('#/try/')===0)return;` +
  `var saved=null;try{saved=localStorage.getItem(k)}catch(e){}` +
  `if(!saved)location.replace(location.pathname+location.search+${JSON.stringify(hash)}+(to[h]||''));` +
  `else if(!h||h==='#'||h==='#/')location.replace(location.pathname+location.search+'#/s/HOME');})();</script>`;
const out = html.replace('<head>', '<head>' + boot).replace(/<title>[^<]*<\/title>/, `<title>${uat.name}</title>`);
const outDir = path.join(root, 'app/dist-client', sub);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'index.html'), out);
console.log(JSON.stringify({ sub, school: uat.name, code: uat.code, branch: cp.release.branch, links: Object.fromEntries(Object.entries(links).map(([k, v]) => [k, v.url])) }, null, 2));
