// Release 17: School login (registration no., username, password), registration numbers, the provider's Clients menu
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSeed } from '../src/data/seed.js';
import { schoolSignIn, sha256Hex, storePassword, noteWrongTry, tenantByReg, PROVIDER_REG } from '../src/lib/schoolLogin.js';
import { clientList, clientsMenu } from '../src/lib/clients.js';

test('registration numbers: 100 the provider, 101 Vijayanikethan, 102+ converted clients, 201+ other schools', () => {
  const db = buildSeed();
  assert.equal(tenantByReg(db, '100').id, 'T1');
  assert.equal(db.provider.clients.find((c) => c.id === 'VHS').regNo, '101');
  const regs = db.tenants.map((t) => t.regNo);
  assert.equal(new Set(regs).size, regs.length, 'unique');
  assert.ok(db.tenants.filter((t) => t.env).every((t) => Number(t.regNo) >= 102 && Number(t.regNo) < 200));
});

test('the provider signs in with 100 / admin and its password; the password is kept only as a hash', async () => {
  const db = buildSeed();
  const ok = await schoolSignIn(db, { regNo: '100', username: 'Admin', password: 'admin1234' });
  assert.ok(ok.ok && ok.provider); assert.ok(db.users.find((u) => u.id === ok.userId).companyAdmin);
  assert.match((await schoolSignIn(db, { regNo: '100', username: 'admin', password: 'admin123' })).error, /Wrong/);
  assert.match((await schoolSignIn(db, { regNo: '100', username: 'root', password: 'admin1234' })).error, /Wrong/);
  assert.match((await schoolSignIn(db, { regNo: '777', username: 'admin', password: 'x' })).error, /No school/);
  assert.ok(!JSON.stringify(db).includes('admin1234'), 'no plain password in the data');
  assert.throws(() => storePassword(db, 'T1', 'x'), /set by the platform/);
});

test('a school: first sign-in sets the Admin password, then only it works; 5 wrong tries lock the school', async () => {
  const db = buildSeed();
  const t = tenantByReg(db, '201');
  assert.ok((await schoolSignIn(db, { regNo: '201', username: 'admin' })).needsPassword);
  storePassword(db, t.id, await sha256Hex('Sunrise#2026x'));
  assert.ok((await schoolSignIn(db, { regNo: '201', username: 'admin', password: 'Sunrise#2026x' })).ok);
  for (let i = 0; i < 5; i++) noteWrongTry(db, t.id);
  assert.match((await schoolSignIn(db, { regNo: '201', username: 'admin', password: 'Sunrise#2026x' })).error, /Too many/);
});

test('Clients menu: only for the provider in its own school; every client listed with its own links', () => {
  const db = buildSeed();
  const admin = db.users.find((u) => u.companyAdmin);
  const menu = clientsMenu(db, admin, 'ADMIN');
  assert.equal(menu[0].code, 'CLIENTS');
  const items = menu[0].items.map((i) => i[0]);
  assert.ok(items.includes('CLI_ALL') && items.includes('CLI_VHS'));
  const list = clientList(db);
  const v = list.find((c) => c.id === 'VHS');
  assert.match(v.links.requirements, /vijayanikethan\/#\/p\/requirements$/); assert.equal(v.links.own, 'https://www.vijayanikethancbse.com/');
  assert.ok(list.some((c) => !c.ownApp), 'converted clients too');
  db.tenantId = tenantByReg(db, '201').id;
  assert.deepEqual(clientsMenu(db, admin, 'ADMIN'), [], 'not inside another school');
  db.tenantId = 'T1';
  assert.deepEqual(clientsMenu(db, db.users.find((u) => u.role === 'PRINCIPAL'), 'PRINCIPAL'), []);
});
