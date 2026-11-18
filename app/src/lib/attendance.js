// Attendance registers for students and staff: one mark per person per school day.
// Marks saved by teachers / the office are kept; earlier school days in the demo that nobody marked are filled
// from each student's attendance rate (deterministic), so ranges and reports have history to show.
import { todayISO } from './format.js';

// Well-mixed hash (FNV-1a + avalanche) so made-up absences are spread out, not in runs of days
const h = (s) => { let x = 2166136261; for (const c of String(s)) { x ^= c.charCodeAt(0); x = Math.imul(x, 16777619); } x ^= x >>> 13; x = Math.imul(x, 0x5bd1e995); x ^= x >>> 15; return x >>> 0; };
export const MARKS = {
  P: ['Present', 'P'], A: ['Absent', 'A'], L: ['On leave', 'L'], LATE: ['Late', 'Lt'], HALF: ['Half day', '½'], H: ['Holiday', '–']
};
export const yearStartOf = (db) => `${String(db.year || '2026-27').slice(0, 4)}-04-01`;

export function days(from, to) {
  const out = []; if (!from || !to || from > to) return out;
  const d = new Date(from + 'T00:00:00Z'); const end = new Date(to + 'T00:00:00Z');
  while (d <= end && out.length < 400) { out.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1); }
  return out;
}
export const weekday = (iso) => new Date(iso + 'T00:00:00Z').getUTCDay();
export const isSchoolDay = (db, iso) => weekday(iso) !== 0 && !(db.holidays || []).some((x) => x.date === iso);
export const holidayName = (db, iso) => (weekday(iso) === 0 ? 'Sunday' : (db.holidays || []).find((x) => x.date === iso)?.name || '');
export const monthRange = (iso = todayISO()) => { const y = +iso.slice(0, 4), m = +iso.slice(5, 7); const last = new Date(Date.UTC(y, m, 0)).getUTCDate(); return [iso.slice(0, 8) + '01', iso.slice(0, 8) + String(last).padStart(2, '0')]; };

// ---------- Students ----------
export function studentMark(db, s, date, today = todayISO()) {
  const saved = db.attendance[s.sectionId + ':' + date]?.[s.id];
  if (saved) return saved;
  if (!isSchoolDay(db, date)) return 'H';
  if (date > today || date < (s.joined && s.joined > yearStartOf(db) ? s.joined : yearStartOf(db))) return null;
  if (date === today) return 'P';                         // everyone starts present today until marked
  return h(s.id + date) % 100 < (s.attendance || 95) ? 'P' : 'A';
}
export function setStudentMark(db, s, date, mark) {
  const k = s.sectionId + ':' + date;
  db.attendance[k] = { ...(db.attendance[k] || {}), [s.id]: mark };
}
export const NEXT_MARK = { P: 'A', A: 'LATE', LATE: 'P' };   // tapping a cell cycles Present → Absent → Late; leave comes from approved requests

export function summarize(marks) {
  const c = { P: 0, A: 0, L: 0, LATE: 0, HALF: 0, days: 0 };
  marks.forEach((m) => { if (!m || m === 'H') return; c.days++; c[m] = (c[m] || 0) + 1; });
  const present = c.P + c.LATE + c.HALF * 0.5;
  return { ...c, present, pct: c.days ? Math.round((1000 * present) / c.days) / 10 : null };
}
export const studentSummary = (db, s, from, to) => summarize(days(from, to).map((d) => studentMark(db, s, d)));

// Month-by-month attendance for a student, from the start of the year (or joining) to today
export function studentMonths(db, s, today = todayISO()) {
  const out = []; let d = yearStartOf(db).slice(0, 7);
  while (d <= today.slice(0, 7)) {
    const [from, to] = monthRange(d + '-01');
    const sum = studentSummary(db, s, from, to < today ? to : today);
    if (sum.days) out.push({ month: d, ...sum });
    const [y, m] = d.split('-').map(Number); d = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  }
  return out;
}

// ---------- Staff ----------
export function staffMark(db, st, date, today = todayISO()) {
  const saved = db.staffAttendance?.[date]?.[st.id];
  if (saved) return saved;
  if (!isSchoolDay(db, date)) return 'H';
  if (st.join && date < st.join) return null;
  const onLeave = (db.staffLeaves || []).find((r) => r.staffId === st.id && r.status === 'APPROVED' && !r.imported && r.from <= date && r.to >= date);
  if (onLeave) return onLeave.half ? 'HALF' : 'L';      // approved leave shows ahead of time too
  if (date > today) return null;
  if (date === today) return 'P';
  return h(st.id + date) % 100 < 96 ? 'P' : 'A';
}
export function setStaffMark(db, st, date, mark) {
  db.staffAttendance = db.staffAttendance || {};
  db.staffAttendance[date] = { ...(db.staffAttendance[date] || {}), [st.id]: mark };
}
export const staffSummary = (db, st, from, to) => summarize(days(from, to).map((d) => staffMark(db, st, d)));
