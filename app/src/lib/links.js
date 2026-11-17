// Deep links: every screen has its own address, so the school's website can link straight to it.
//   #/s/<SCREEN>   a screen inside the app (the visitor signs in first; access rules still apply)
//   #/p/apply      public admission enquiry form (no sign-in), add ?embed to drop the page frame for an iframe
import { tenantOf } from './logic.js';

export const WEBSITE_LINKS = [
  ['s/SELF_REQUESTS', 'Requests to school', 'Parents: leave, late arrival, pickup / drop, early leave, meet a teacher, certificates'],
  ['s/SELF_FEES', 'Pay fees', 'Parents: dues and online payment'],
  ['s/SELF_CHILD', 'My child', 'Parents: profile, attendance, results'],
  ['s/ACA_TIMETABLE', 'Timetable', 'Parents and staff'],
  ['s/STU_MEETINGS', 'Parent meetings', 'Teachers: meeting requests addressed to them'],
  ['s/TRN_SHEETS', 'Driver route sheets', 'Transport team'],
  ['p/apply', 'Admission enquiry form', 'Anyone — no sign-in needed']
];

export function parseHash(h) {
  const m = /^#\/(s|p)\/([A-Za-z_]+)(\?embed)?/.exec(h || '');
  return m ? { kind: m[1], code: m[2], embed: !!m[3] } : null;
}
export const schoolBase = (db) => `https://${tenantOf(db).subdomain}.yourapp.com/`;
export const linkFor = (db, path, base = schoolBase(db)) => `${base}#/${path}`;
export const buttonSnippet = (url, label) => `<a href="${url}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#1d4ed8;color:#fff;text-decoration:none;font:600 15px system-ui">${label}</a>`;
export const iframeSnippet = (url) => `<iframe src="${url}?embed" title="Admission enquiry" style="width:100%;min-height:980px;border:0" loading="lazy"></iframe>`;
