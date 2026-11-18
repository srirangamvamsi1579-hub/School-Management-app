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

export const TEACHING = ['Pre-Primary Teacher', 'PRT', 'TGT', 'PGT', 'Class Teacher', 'Coordinator', 'Head of Department', 'Head of Teaching Staff', 'Vice Principal', 'Physical Education Teacher', 'Special Educator'];
export const EMP_TYPES = ['Full time', 'Part time'];
export const gross = (s) => (s.salary?.Basic || 0) + (s.salary?.HRA || 0) + (s.salary?.DA || 0) + (s.salary?.Transport || 0);
// Salary months already paid this year: April up to last month
export function monthsPaid(db, today = new Date().toISOString().slice(0, 10)) {
  const y = +yearStart(db).slice(0, 4);
  const m = (+today.slice(0, 4) - y) * 12 + (+today.slice(5, 7)) - 4;
  return Math.max(0, Math.min(12, m));
}
// Months an employee has been paid this year (joined part-way through: from their joining month)
const paidMonthsFor = (db, s, n) => { if (!s.join || s.join < yearStart(db)) return n; const y = +yearStart(db).slice(0, 4); const j = (+s.join.slice(0, 4) - y) * 12 + (+s.join.slice(5, 7)) - 4; return Math.max(0, n - j - (+s.join.slice(8, 10) > 15 ? 1 : 0)); };
const categoryOf = (s) => (s.dept === 'Transport' ? 'Transport' : TEACHING.includes(s.desig) || s.desig === 'Principal' ? 'Teaching & leadership' : 'Office & accounts');
export function staffFigures(db) {
  const ly = last(db);
  const active = db.staff.filter((s) => s.status === 'Active');
  const depts = [...new Set(active.map((s) => s.dept))].map((d) => { const here = active.filter((s) => s.dept === d);
    return { name: d, boys: here.filter((s) => s.gender === 'Male').length, girls: here.filter((s) => s.gender === 'Female').length, full: here.filter((s) => (s.type || 'Full time') === 'Full time').length, part: here.filter((s) => s.type === 'Part time').length, total: here.length }; })
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  const teachers = active.filter((s) => TEACHING.includes(s.desig)).length;
  const students = db.students.filter((s) => s.status === 'Active').length;
  const norm = db.settings?.staffRatio || 30;
  const n = monthsPaid(db);
  const paidOf = (l) => l.reduce((a, s) => a + gross(s) * paidMonthsFor(db, s, n), 0);
  const payroll = active.reduce((a, s) => a + gross(s), 0);
  const byType = EMP_TYPES.map((t) => { const l = active.filter((s) => (s.type || 'Full time') === t); const monthly = l.reduce((a, s) => a + gross(s), 0);
    return { type: t, count: l.length, before: ly.staffByType?.[t] ?? null, monthly, paid: paidOf(l), avg: l.length ? Math.round(monthly / l.length) : 0, share: payroll ? Math.round((100 * monthly) / payroll) : 0, headShare: active.length ? Math.round((100 * l.length) / active.length) : 0 }; });
  const categories = ['Teaching & leadership', 'Office & accounts', 'Transport'].map((c) => { const l = active.filter((s) => categoryOf(s) === c);
    return { name: c, ...Object.fromEntries(EMP_TYPES.map((t) => [t, l.filter((s) => (s.type || 'Full time') === t).length])), count: l.length, monthly: l.reduce((a, s) => a + gross(s), 0), paid: paidOf(l) }; });
  const today = new Date().toISOString().slice(0, 10);
  const leaves = db.staffLeaves || [];
  const onLeaveToday = leaves.filter((r) => r.status === 'APPROVED' && r.from <= today && r.to >= today).length;
  const fresh = active.filter((s) => (s.join || '') >= yearStart(db));
  return { total: active.length, before: ly.staff ?? null, byGender: Object.fromEntries(GENDERS.map(([k]) => [k, active.filter((s) => s.gender === k).length])),
    beforeByGender: ly.staffByGender || null, depts, teachers, nonTeaching: active.length - teachers, ratio: teachers ? students / teachers : null, norm,
    newThisYear: fresh, newBefore: ly.newStaff ?? null, byType, categories, payroll, months: n, paidTotal: byType.reduce((a, t) => a + t.paid, 0),
    onLeaveToday, pendingLeave: leaves.filter((r) => r.status === 'PENDING').length, leaveDaysTaken: leaves.filter((r) => r.status === 'APPROVED').reduce((a, r) => a + r.days, 0) };
}

export function transportFigures(db) {
  const ly = last(db);
  const riders = db.students.filter((s) => s.status === 'Active' && s.routeId);
  const routes = (db.routes || []).map((r) => { const n = riders.filter((s) => s.routeId === r.id).length; const before = (ly.ridersByRoute || {})[r.id] ?? null;
    return { id: r.id, name: r.name, bus: r.bus, riders: n, capacity: r.capacity, before, change: before == null ? null : n - before, use: r.capacity ? n / r.capacity : 0,
      incidents: (db.busIncidents || []).filter((b) => b.routeId === r.id && b.date >= yearStart(db)).length }; });
  const students = db.students.filter((s) => s.status === 'Active').length;
  const buses = db.buses || (db.routes || []).map((r) => ({ reg: r.bus, seats: r.capacity, status: 'In service', routeId: r.id }));
  const incidents = (db.busIncidents || []).filter((b) => b.date >= yearStart(db)).sort((a, b) => b.date.localeCompare(a.date));
  const byBus = Object.entries(incidents.reduce((a, b) => ({ ...a, [b.bus]: (a[b.bus] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1]);
  return { riders: riders.length, before: ly.riders ?? null, routes, seats: routes.reduce((a, r) => a + r.capacity, 0), share: students ? riders.length / students : 0,
    byGender: Object.fromEntries(GENDERS.map(([k]) => [k, riders.filter((s) => s.gender === k).length])),
    full: routes.filter((r) => r.riders >= r.capacity), low: routes.filter((r) => r.use < 0.5),
    buses, busesBefore: ly.buses ?? null, inService: buses.filter((b) => b.status === 'In service').length, spare: buses.filter((b) => b.status === 'Spare').length, repair: buses.filter((b) => b.status === 'Under repair').length,
    incidents, incidentsBefore: ly.busIncidents ?? null, byBus, delayMin: incidents.reduce((a, b) => a + (b.delayMin || 0), 0), affected: incidents.reduce((a, b) => a + (b.students || 0), 0) };
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

// ---------- Insights: what the figures mean, in plain words (a few lines per section, most useful first) ----------
const pctOf = (a, b) => (b ? Math.round((100 * a) / b) : 0);
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
export function studentInsights(db) {
  const f = studentFigures(db); const out = [];
  if (f.before != null) { const d = f.total - f.before; out.push(`${d >= 0 ? 'Up' : 'Down'} ${Math.abs(d)} students (${Math.abs(pctOf(d, f.before))}%) on last year.`); }
  const grew = f.classes.filter((c) => c.before).map((c) => ({ ...c, d: c.total - c.before })).sort((a, b) => b.d - a.d);
  if (grew[0]?.d > 0) out.push(`${grew[0].name} grew the most (+${grew[0].d}); ${grew[grew.length - 1].d < 0 ? `${grew[grew.length - 1].name} shrank the most (${grew[grew.length - 1].d}).` : 'no grade shrank.'}`);
  if (f.overGrades.length) out.push(`${f.overGrades.map((c) => c.name).join(', ')} ${f.overGrades.length === 1 ? 'is' : 'are'} over the grade limit — stop new admissions there or open a section.`);
  if (f.underGrades.length) { const most = [...f.underGrades].sort((a, b) => b.free - a.free)[0]; out.push(`Most seats free in ${most.name} (${most.free}) — point new enquiries there.`); }
  if (f.coEd) { const g = f.byGender; out.push(`Girls are ${pctOf(g.Female, g.Male + g.Female)}% of students${f.beforeByGender ? ` (${pctOf(f.beforeByGender.Female, f.beforeByGender.Male + f.beforeByGender.Female)}% last year)` : ''}.`); }
  const low = db.students.filter((s) => s.status === 'Active' && (s.attendance || 100) < 90);
  if (low.length) out.push(`${plural(low.length, 'student')} ${low.length === 1 ? 'is' : 'are'} below 90% attendance this year — the class coordinators can follow up.`);
  return out;
}
export function staffInsights(db) {
  const f = staffFigures(db); const out = [];
  const [ft, pt] = f.byType;
  out.push(`${ft.count} full-time and ${pt.count} part-time staff. Part-time staff are ${pt.headShare}% of the headcount but ${pt.share}% of the salary bill.`);
  out.push(`Salary paid this year: ${inrShort(f.paidTotal)} over ${plural(f.months, 'month')}; the monthly bill is ${inrShort(f.payroll)} (${inrShort(Math.round(f.payroll / Math.max(1, f.total)))} per person on average).`);
  if (ft.before != null) { const d = ft.count - ft.before, e = pt.count - pt.before; out.push(`Since last year: full-time ${d >= 0 ? '+' : ''}${d}, part-time ${e >= 0 ? '+' : ''}${e}.`); }
  if (f.ratio != null) out.push(f.ratio <= f.norm ? `${f.ratio.toFixed(1)} students per teacher — within the school norm of ${f.norm}.` : `${f.ratio.toFixed(1)} students per teacher — above the norm of ${f.norm}; plan for another teacher.`);
  const big = [...f.depts].sort((a, b) => b.part - a.part)[0];
  if (big?.part) out.push(`${big.name} relies most on part-time staff (${big.part} of ${big.total}).`);
  if (f.pendingLeave) out.push(`${plural(f.pendingLeave, 'leave request')} waiting for approval${f.onLeaveToday ? `; ${f.onLeaveToday} on leave today` : ''}.`);
  return out;
}
export function transportInsights(db) {
  const f = transportFigures(db); const out = [];
  const grew = f.routes.filter((r) => r.change != null).sort((a, b) => b.change - a.change);
  if (grew.length) out.push(`${grew[0].id} gained the most riders (${grew[0].change >= 0 ? '+' : ''}${grew[0].change})${grew[grew.length - 1].change < 0 ? `; ${grew[grew.length - 1].id} lost ${-grew[grew.length - 1].change}` : ''}.`);
  if (f.full.length) out.push(`${f.full.map((r) => r.id).join(', ')} ${f.full.length === 1 ? 'is' : 'are'} full — new riders there need another route or a bigger bus.`);
  if (f.low.length) out.push(`${f.low.map((r) => r.id).join(', ')} ${f.low.length === 1 ? 'is' : 'are'} under half full — see Routes, Stops & Timings for a shorter route or combining stops.`);
  if (f.byBus[0]?.[1] >= 2) out.push(`Bus ${f.byBus[0][0]} broke down ${f.byBus[0][1]} times this year — book a full service or replace it.`);
  out.push(`${plural(f.incidents.length, 'breakdown')} this year${f.incidentsBefore != null ? ` (${f.incidentsBefore} in all of last year)` : ''}, ${f.delayMin} minutes of delay in total; ${f.spare ? `the spare bus covered ${f.incidents.filter((b) => b.replacedBy).length} of them` : 'there is no spare bus'}.`);
  return out;
}
export function feeInsights(db) {
  const f = feeDashboard(db); const out = [];
  if (f.paidBefore != null) { const d = f.paid - f.paidBefore; out.push(`${inrShort(Math.abs(d))} ${d >= 0 ? 'more' : 'less'} collected than by this time last year.`); }
  out.push(f.duePct >= f.target ? `${f.duePct}% of what is due has come in — on target (${f.target}%).` : `${f.duePct}% of what is due has come in — ${plural(f.target - f.duePct, 'point')} short of the ${f.target}% target.`);
  const worst = [...f.belowTarget].sort((a, b) => a.pct - b.pct).slice(0, 3);
  if (worst.length) out.push(`Furthest behind: ${worst.map((c) => `${c.name} (${c.pct}%)`).join(', ')} — send reminders from Dues & Reminders.`);
  if (f.overdueStudents) out.push(`${plural(f.overdueStudents, 'family')} owe ${inrShort(f.overdue)} past the due date.`.replace('familys', 'families'));
  return out;
}
export function enrolInsights(db) {
  const f = registrationFigures(db); const out = [];
  const total = f.thisYear || 1;
  const parts = [['APP', 'the app'], ['WEBSITE', 'the website']].filter(([k]) => f.bySource[k]).map(([k, w]) => `${pctOf(f.bySource[k], total)}% from ${w}`);
  if (parts.length) out.push(`Of ${plural(f.thisYear, 'account')} opened this year, ${parts.join(' and ')}.`);
  if (f.before) { const was = Object.values(f.before).reduce((a, b) => a + b, 0); const appWas = pctOf(f.before.APP || 0, was); out.push(`App sign-ups were ${appWas}% last year and ${pctOf(f.bySource.APP, total)}% now${pctOf(f.bySource.APP, total) > appWas ? ' — parents are moving to the app' : ''}.`); }
  if (f.bySource.ADMIN > 0) out.push(`${plural(f.bySource.ADMIN, 'account')} added by the Admin — each has a recorded reason in Users.`);
  return out;
}
const inrShort = (n) => (n >= 1e7 ? `₹${(n / 1e7).toFixed(2)} crore` : n >= 1e5 ? `₹${(n / 1e5).toFixed(2)} lakh` : `₹${Math.round(n).toLocaleString('en-IN')}`);
