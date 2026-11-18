import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSeed } from '../src/data/seed.js';
import { studentFigures, staffFigures, transportFigures, feeDashboard, registrationFigures, lastYearKey } from '../src/lib/dashboard.js';

test('students: totals, last year, gender, per class, new this year, grade limits', () => {
  const db = buildSeed();
  const f = studentFigures(db);
  assert.equal(lastYearKey(db), '2025-26');
  assert.equal(f.total, db.students.filter((s) => s.status === 'Active').length);
  assert.equal(f.byGender.Male + f.byGender.Female, f.total);
  assert.equal(f.classes.reduce((a, c) => a + c.total, 0), f.total, 'every student in one class');
  assert.ok(f.classes.every((c) => c.boys + c.girls === c.total));
  assert.equal(f.before, f.classes.reduce((a, c) => a + c.before, 0));
  assert.equal(f.beforeByGender.Male + f.beforeByGender.Female, f.before);
  assert.ok(f.newThisYear > 0 && f.newThisYear === f.classes.reduce((a, c) => a + c.newThisYear, 0));
  assert.ok(f.overGrades.length > 0 && f.underGrades.length > 0, 'demo has grades over and under their limit');
  for (const c of f.classes) assert.ok(c.over === 0 || c.free === 0, 'never both over and free');
  db.gradeLimits.C1 = 0;
  assert.equal(studentFigures(db).classes[0].over, studentFigures(db).classes[0].total, 'limit change shows at once');
  db.settings.coEd = false;
  assert.equal(studentFigures(db).coEd, false);
});

test('staff, transport, fees and registrations', () => {
  const db = buildSeed();
  const s = staffFigures(db);
  assert.equal(s.total, db.staff.filter((x) => x.status === 'Active').length);
  assert.equal(s.depts.reduce((a, d) => a + d.total, 0), s.total);
  assert.ok(s.newThisYear.every((x) => x.join >= '2026-04-01'));
  assert.ok(s.ratio > 0 && s.teachers > 0);
  const t = transportFigures(db);
  assert.equal(t.routes.reduce((a, r) => a + r.riders, 0), t.riders);
  assert.ok(t.share > 0 && t.share <= 1);
  const f = feeDashboard(db);
  assert.equal(f.paid + f.due, f.billed);
  assert.ok(f.duePct >= f.pct, 'measured against what is due so far');
  assert.ok(f.classes.every((c) => c.pct >= 0 && c.pct <= 100));
  const r = registrationFigures(db);
  assert.ok(r.list.every((u) => ['WEBSITE', 'APP', 'ADMIN'].includes(u.src)));
  assert.equal(Object.values(r.bySource).reduce((a, b) => a + b, 0), r.thisYear);
  assert.ok(!r.list.some((u) => u.source === 'SEED'), 'accounts set up with the school are not registrations');
});
