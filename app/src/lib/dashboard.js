// Dashboard figures, computed from the school's data. "Last year" comes from the closed 2025-26 year (db.history).
import { classOf, balance } from './logic.js';

export const yearStart = (db) => `${String(db.year || '2026-27').slice(0, 4)}-04-01`;
export const lastYearKey = (db) => { const y = +String(db.year || '2026-27').slice(0, 4); return `${y - 1}-${String(y).slice(2)}`; };
const last = (db) => (db.history || {})[lastYearKey(db)] || {};
export const GENDERS = [['Male', 'Boys'], ['Female', 'Girls']];
export const delta = (now, before) => (before == null ? null : now - before);

export function studentFigures(db) {
  const ly = last(db);
  const active = db.students.filter((s) => s.status === 'Active');
  const start = yearStart(db);
  const classes = db.classes.slice().sort((a, b) => a.level - b.level).map((c) => {
    const here = active.filter((s) => classOf(db, s)?.id === c.id);
    const g = Object.fromEntries(GENDERS.map(([k]) => [k, here.filter((s) => s.gender === k).length]));
    const before = GENDERS.reduce((a, [k]) => a + ((ly.studentsByClassGender || {})[c.id + ':' + k] || 0), 0);
    const limit = (db.gradeLimits || {})[c.id] ?? null;
    return { id: c.id, name: c.name, short: c.name.replace('Grade ', ''), boys: g.Male, girls: g.Female, total: here.length, before, limit,
      over: limit != null && here.length > limit ? here.length - limit : 0, free: limit != null && here.length < limit ? limit - here.length : 0,
      newThisYear: here.filter((s) => (s.joined || '') >= start).length };
  });
  const byGender = Object.fromEntries(GENDERS.map(([k]) => [k, active.filter((s) => s.gender === k).length]));
  const beforeByGender = Object.fromEntries(GENDERS.map(([k]) => [k, Object.entries(ly.studentsByClassGender || {}).filter(([key]) => key.endsWith(':' + k)).reduce((a, [, v]) => a + v, 0)]));
  const fresh = active.filter((s) => (s.joined || '') >= start);
  return { total: active.length, before: ly.studentsByClassGender ? classes.reduce((a, c) => a + c.before, 0) : null, byGender, beforeByGender,
    coEd: db.settings?.coEd ?? (byGender.Male > 0 && byGender.Female > 0), classes,
    newThisYear: fresh.length, newBefore: ly.newStudents ?? null, newByGender: Object.fromEntries(GENDERS.map(([k]) => [k, fresh.filter((s) => s.gender === k).length])),
    overGrades: classes.filter((c) => c.over > 0), underGrades: classes.filter((c) => c.free > 0), atLimit: classes.filter((c) => c.limit != null && c.total === c.limit) };
}

const TEACHING = ['Pre-Primary Teacher', 'PRT', 'TGT', 'PGT', 'Class Teacher', 'Coordinator', 'Head of Department', 'Head of Teaching Staff', 'Vice Principal', 'Physical Education Teacher', 'Special Educator'];
export function staffFigures(db) {
  const ly = last(db);
  const active = db.staff.filter((s) => s.status === 'Active');
  const start = yearStart(db);
  const depts = [...new Set(active.map((s) => s.dept))].map((d) => { const here = active.filter((s) => s.dept === d);
    return { name: d, boys: here.filter((s) => s.gender === 'Male').length, girls: here.filter((s) => s.gender === 'Female').length, total: here.length }; })
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  const teachers = active.filter((s) => TEACHING.includes(s.desig)).length;
  const students = db.students.filter((s) => s.status === 'Active').length;
  const norm = db.settings?.staffRatio || 30;
  const fresh = active.filter((s) => (s.join || '') >= start).sort((a, b) => (b.join || '').localeCompare(a.join || ''));
  return { total: active.length, before: ly.staff ?? null, byGender: Object.fromEntries(GENDERS.map(([k]) => [k, active.filter((s) => s.gender === k).length])),
    beforeByGender: ly.staffByGender || null, depts, teachers, ratio: teachers ? students / teachers : null, norm, newThisYear: fresh, newBefore: ly.newStaff ?? null };
}

export function transportFigures(db) {
  const ly = last(db);
  const riders = db.students.filter((s) => s.status === 'Active' && s.routeId);
  const routes = (db.routes || []).map((r) => { const n = riders.filter((s) => s.routeId === r.id).length;
    return { id: r.id, name: r.name, bus: r.bus, riders: n, capacity: r.capacity, before: (ly.ridersByRoute || {})[r.id] ?? null, use: r.capacity ? n / r.capacity : 0 }; });
  const students = db.students.filter((s) => s.status === 'Active').length;
  return { riders: riders.length, before: ly.riders ?? null, routes, seats: routes.reduce((a, r) => a + r.capacity, 0), share: students ? riders.length / students : 0,
    byGender: Object.fromEntries(GENDERS.map(([k]) => [k, riders.filter((s) => s.gender === k).length])),
    full: routes.filter((r) => r.riders >= r.capacity), low: routes.filter((r) => r.use < 0.5) };
}

export function feeDashboard(db) {
  const ly = last(db);
  const billed = db.invoices.reduce((a, i) => a + i.net, 0);
  const paid = db.invoices.reduce((a, i) => a + i.paid, 0);
  const overdueList = db.invoices.filter((i) => i.status === 'OVERDUE');
  const target = db.settings?.feeTarget || 95;
  // Collection is measured against what has fallen due so far (instalments not yet due don't count against the school)
  const today = new Date().toISOString().slice(0, 10);
  const dueNow = (i) => (i.due || i.date || '') <= today;
  const classes = db.classes.slice().sort((a, b) => a.level - b.level).map((c) => {
    const inv = db.invoices.filter((i) => { const s = db.students.find((x) => x.id === i.studentId); return s && classOf(db, s)?.id === c.id && dueNow(i); });
    const b = inv.reduce((a, i) => a + i.net, 0); const p = inv.reduce((a, i) => a + i.paid, 0);
    return { id: c.id, name: c.name, short: c.name.replace('Grade ', ''), billed: b, paid: p, pct: b ? Math.round((100 * p) / b) : 0 };
  });
  const dueBilled = db.invoices.filter(dueNow).reduce((a, i) => a + i.net, 0);
  const duePaid = db.invoices.filter(dueNow).reduce((a, i) => a + i.paid, 0);
  return { billed, paid, pct: billed ? Math.round((100 * paid) / billed) : 0, due: billed - paid, overdue: overdueList.reduce((a, i) => a + balance(i), 0),
    overdueCount: overdueList.length, overdueStudents: new Set(overdueList.map((i) => i.studentId)).size,
    paidBefore: ly.feesCollectedToDate ?? null, billedBefore: ly.feesBilled ?? null, target, classes, dueBilled, duePct: dueBilled ? Math.round((100 * duePaid) / dueBilled) : 0, belowTarget: classes.filter((c) => c.billed && c.pct < target) };
}

export const SOURCES = [['WEBSITE', 'Website'], ['APP', 'Mobile app'], ['ADMIN', 'Added by the Admin']];
export function registrationFigures(db) {
  const ly = last(db);
  const start = yearStart(db);
  const list = db.users.filter((u) => u.status !== 'DELETED' && u.source !== 'SEED').map((u) => ({ ...u, src: SOURCES.some(([k]) => k === u.source) ? u.source : 'WEBSITE' }))
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  const thisYear = list.filter((u) => (u.createdAt || '') >= start);
  const count = (l) => Object.fromEntries(SOURCES.map(([k]) => [k, l.filter((u) => u.src === k).length]));
  return { list, thisYear: thisYear.length, bySource: count(thisYear), allBySource: count(list), before: ly.registrations || null,
    beforeTotal: ly.registrations ? Object.values(ly.registrations).reduce((a, b) => a + b, 0) : null };
}
