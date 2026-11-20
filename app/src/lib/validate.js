// Release 15 (QA fixes): shared field rules, used by the forms AND the business functions behind them,
// so imports, the public website form and the future API get the same checks as the screens.
// Auto-corrections here are the safe ones the QA report proposed: trim spaces, tidy a mobile number,
// round money to paise. Each returns the corrected value so the form can show it before saving.

// ---------- Text ----------
export const clean = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
// Letters in any script, spaces, full stop, apostrophe, hyphen
const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M} .'’-]*$/u;
export function nameProblem(v, label = 'Name', required = true) {
  const s = clean(v);
  if (!s) return required ? `${label} is required` : '';
  if (!NAME_RE.test(s)) return `${label}: use letters, spaces and . ' - only`;
  if (s.length > 60) return `${label} is too long (60 characters at most)`;
  return '';
}

// ---------- Mobile (India) ----------
// "+91 98450 12399", "098450-12399", "91 9845012399" → "9845012399". Anything else is left as typed (and then refused).
export function cleanMobile(v) {
  const raw = String(v ?? '').trim();
  if (/[a-z@]/i.test(raw)) return raw;
  let d = raw.replace(/[\s\-().]/g, '');
  if (/^\+?91\d{10}$/.test(d)) d = d.replace(/^\+?91/, '');
  else if (/^0\d{10}$/.test(d)) d = d.slice(1);
  return /^\d+$/.test(d) ? d : raw;
}
export const mobileOk = (v) => /^[6-9]\d{9}$/.test(cleanMobile(v));
export function mobileProblem(v, label = 'Mobile', required = true) {
  if (!clean(v)) return required ? `${label} is required` : '';
  return mobileOk(v) ? '' : `${label} must be 10 digits starting 6–9`;
}
// The note a form shows when it tidied the number: "Saved as 9845012399"
export const mobileNote = (v) => (mobileOk(v) && cleanMobile(v) !== String(v).trim() ? `Will be saved as ${cleanMobile(v)} (spaces, dashes and +91 removed)` : '');

// ---------- Email ----------
export const emailOk = (v) => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(String(v ?? '').trim());
export const emailProblem = (v, label = 'Email', required = false) => (!clean(v) ? (required ? `${label} is required` : '') : emailOk(v) ? '' : `${label} looks wrong`);

// ---------- Dates ----------
export const todayIso = () => new Date().toISOString().slice(0, 10);
export const addDaysIso = (iso, n) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
export const addMonthsIso = (iso, n) => { const d = new Date(iso + 'T00:00:00'); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0, 10); };
// A real calendar date written YYYY-MM-DD (2026-13-45 and 2026-02-31 are not)
export function realDate(v) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v ?? ''))) return false;
  const d = new Date(v + 'T00:00:00');
  return !isNaN(d) && d.toISOString().slice(0, 10) === v;
}
const yearsBetween = (from, to) => (new Date(to + 'T00:00:00') - new Date(from + 'T00:00:00')) / (365.25 * 864e5);

// Date of birth for a child joining `level` (Grade I = 1 … XII = 12) in the year starting `yearStart`.
// Refused: not a real date, in the future, or an age below 2½ or above 20. Warned (not refused): more than
// 2 years away from the usual age for the class (Grade I ≈ 6 at the start of the year).
export function dobCheck(dob, { level = null, yearStart = null, label = 'Date of birth' } = {}) {
  if (!dob) return { error: `${label} is required` };
  if (!realDate(dob)) return { error: `${label}: enter a real date` };
  if (dob > todayIso()) return { error: `${label} can't be in the future` };
  const age = yearsBetween(dob, todayIso());
  if (age < 2.5) return { error: `${label}: the child would be under 2½ years old` };
  if (age > 20) return { error: `${label}: the child would be over 20 years old` };
  if (level != null) {
    const at = yearsBetween(dob, yearStart || todayIso()), usual = Number(level) + 5;
    if (Math.abs(at - usual) > 2) return { warning: `Age ${Math.floor(at)} is unusual for this class (usually about ${usual}) — check the date of birth and class` };
  }
  return {};
}
// Joining date for staff: a real date, not more than 6 months ahead
export function joinProblem(v) {
  if (!v) return '';
  if (!realDate(v)) return 'Date of joining: enter a real date';
  if (v > addMonthsIso(todayIso(), 6)) return 'Date of joining is more than 6 months ahead';
  if (v < '1960-01-01') return 'Date of joining looks wrong';
  return '';
}

// ---------- Numbers and money ----------
export const isWhole = (v) => v !== '' && v !== null && Number.isInteger(Number(v));
export const roundMoney = (v) => Math.round(Number(v) * 100) / 100;
// The note a form shows when an amount was rounded: "Will be saved as ₹12.35"
export const moneyNote = (v) => (v !== '' && isFinite(Number(v)) && roundMoney(v) !== Number(v) ? `Will be saved as ₹${roundMoney(v).toFixed(2)} (rounded to paise)` : '');

// ---------- Duplicates ----------
export const same = (a, b) => clean(a).toLowerCase() === clean(b).toLowerCase();
export function duplicateError(message) { const e = new Error(message); e.code = 'DUPLICATE'; return e; }
