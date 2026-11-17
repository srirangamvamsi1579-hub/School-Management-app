// The user guide stays in step with the app: every menu is explained, every demo step can be opened by its person
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSeed } from '../src/data/seed.js';
import { MENU, PLANS, canSee, onWeb } from '../src/data/menu.js';
import { SCREEN_HELP, WORKFLOWS, DEMO_PEOPLE } from '../src/data/guide.js';
import { screensFor } from '../src/lib/auth.js';
import fs from 'node:fs';
// screens/index.js maps codes to components (JSX, so read it as text here)
const INDEX = fs.readFileSync(new URL('../src/screens/index.js', import.meta.url), 'utf8');

test('every main menu and sub-menu has a screen and a guide entry', () => {
  const codes = MENU.flatMap((m) => m.items.map((i) => i[0])).filter((c) => c[0] !== '#');
  assert.ok(codes.length >= 67);
  for (const c of codes) {
    assert.ok(new RegExp('\\b' + c + '\\s*:').test(INDEX), 'no screen for ' + c);
    assert.ok(SCREEN_HELP[c]?.[0] && SCREEN_HELP[c]?.[1], 'no guide text for ' + c);
  }
});

test('every guided-demo step opens for the person it signs in as', () => {
  const db = buildSeed(); const t = db.tenants.find((x) => x.id === db.tenantId);
  const rank = PLANS.find((p) => p.code === t.plan).rank;
  for (const w of WORKFLOWS) for (const [i, s] of w.steps.entries()) {
    if (s.public) { assert.match(s.public, /^#\//); continue; }
    const u = db.users.find((x) => x.id === s.as);
    assert.ok(u && DEMO_PEOPLE[s.as], `${w.id} step ${i + 1}: unknown person ${s.as}`);
    const perms = { [u.role]: screensFor(db, u, u.role) };
    const ok = !!s.needs || (canSee(s.screen, u.role, rank, t.overrides, perms) && onWeb(t, u.role, s.screen));
    assert.ok(ok, `${w.id} step ${i + 1}: ${u.name} cannot open ${s.screen}`);
  }
});
