// Release 17 upgrade of saved data (safe to run more than once): registration numbers for every school (100 = the service
// provider) and the provider's list of clients that run in their own app (shown under Clients).
import { assignRegNos } from '../lib/schoolLogin.js';
import { DEFAULT_RATE_CARD } from '../lib/pricing.js';

const PAGES = 'https://srirangamvamsi1579-hub.github.io/School-Management-app/';
export const OWN_APP_CLIENTS = [
  { id: 'VHS', regNo: '101', name: 'Vijayanikethan High School', env: 'UAT/DEMO', code: 'VHS-UAT', board: 'CBSE', sub: 'vijayanikethan',
    appUrl: PAGES + 'vijayanikethan/', website: 'https://www.vijayanikethancbse.com/', branch: 'school/vijayanikethan', version: '1.0', plan: 'All features',
    addons: DEFAULT_RATE_CARD.addons.map((a) => a.code), artifact: 'https://claude.ai/artifact/XYvWFeYJUSe7rxiqB4G3Lp', since: '2026-11-21' }
];
export function seedRelease17(db) {
  db.provider = db.provider || {};
  db.provider.clients = db.provider.clients || [];
  OWN_APP_CLIENTS.forEach((c) => { if (!db.provider.clients.some((x) => x.id === c.id)) db.provider.clients.push(structuredClone(c)); });
  assignRegNos(db);
  return db;
}
