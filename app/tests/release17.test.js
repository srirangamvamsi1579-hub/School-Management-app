// Release 17 / 17.1: login with username and password (Admin = service provider, Client<no> = that client),
// registration numbers, the provider's Clients menu, sharing a client's links by email (never login details)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSeed } from '../src/data/seed.js';
import { schoolSignIn, noteWrongTry, tenantByReg, regOfUsername, usernameFor, unlockLogin } from '../src/lib/schoolLogin.js';
import { clientList, clientsMenu, shareClientLinks } from '../src/lib/clients.js';

test('registration numbers: 100 the provider, 101 Vijayanikethan, 102+ converted clients, 201+ other schools', () => {
  const db = buildSeed();
  assert.equal(tenantByReg(db, '100').id, 'T1');
  assert.equal(db.provider.clients.find((c) => c.id === 'VHS').regNo, '101');
  const regs = db.tenants.map((t) => t.regNo);
  assert.equal(new Set(regs).size, regs.length, 'unique');
  assert.ok(db.tenants.filter((t) => t.env).every((t) => Number(t.regNo) >= 102 && Number(t.regNo) < 200));
  assert.equal(regOfUsername('Admin'), '100'); assert.equal(regOfUsername('Client101'), '101'); assert.equal(regOfUsername('teacher'), null);
  assert.equal(usernameFor('102'), 'Client102');
});

test('the provider signs in as Admin with its password; kept only as a hash; wrong details refused the same way', async () => {
  const db = buildSeed();
  const ok = await schoolSignIn(db, { username: 'Admin', password: 'Admin1234!' });
  assert.ok(ok.ok && ok.provider); assert.equal(ok.regNo, '100'); assert.ok(db.users.find((u) => u.id === ok.userId).companyAdmin);
  for (const bad of [{ username: 'Admin', password: 'Admin1234' }, { username: 'root', password: 'Admin1234!' }, { username: 'Client999', password: 'Client999!' }])
    assert.equal((await schoolSignIn(db, bad)).error, 'Wrong username or password');
  assert.match((await schoolSignIn(db, { username: 'Admin' })).error, /Enter your username and password/);
  assert.ok(!JSON.stringify(db).includes('Admin1234'), 'no plain password in the data');
});

test('a client signs in as Client<no> with Client<no>!; 5 wrong tries lock it until the provider unlocks', async () => {
  const db = buildSeed();
  const reg = db.tenants.find((t) => t.env).regNo;
  const r = await schoolSignIn(db, { username: 'client' + reg, password: `Client${reg}!` });
  assert.ok(r.ok && !r.provider); assert.equal(db.tenants.find((t) => t.id === r.tenantId).regNo, reg);
  assert.ok((await schoolSignIn(db, { username: 'Client201', password: 'Client201!' })).ok, 'other schools follow the same pattern');
  for (let i = 0; i < 5; i++) noteWrongTry(db, r.tenantId);
  assert.match((await schoolSignIn(db, { username: 'Client' + reg, password: `Client${reg}!` })).error, /Too many/);
  unlockLogin(db, reg);
  assert.ok((await schoolSignIn(db, { username: 'Client' + reg, password: `Client${reg}!` })).ok);
});

test('Clients menu only for the provider; a client’s links are shared by email without login details', () => {
  const db = buildSeed();
  const admin = db.users.find((u) => u.companyAdmin);
  const items = clientsMenu(db, admin, 'ADMIN')[0].items.map((i) => i[0]);
  assert.ok(items.includes('CLI_ALL') && items.includes('CLI_VHS'));
  const v = clientList(db).find((c) => c.id === 'VHS');
  assert.match(v.links.requirements, /vijayanikethan\/#\/p\/requirements$/);
  assert.throws(() => shareClientLinks(db, 'VHS', { emails: '', codes: ['app'] }, 'P'), /at least one email/);
  assert.throws(() => shareClientLinks(db, 'VHS', { emails: 'ok@example.com, not-an-email', codes: ['app'] }, 'P'), /not-an-email/);
  assert.throws(() => shareClientLinks(db, 'VHS', { emails: 'ok@example.com', codes: [] }, 'P'), /at least one link/);
  const r = shareClientLinks(db, 'VHS', { emails: 'principal@vijayanikethan.example.com; Office@Example.com', codes: ['app', 'requirements', 'own'] }, 'P');
  assert.deepEqual(r.to, ['principal@vijayanikethan.example.com', 'office@example.com']);
  const mail = db.outbox[0];
  assert.equal(mail.kind, 'Client links'); assert.match(mail.body, /vijayanikethan\/#\/p\/requirements/); assert.match(mail.body, /Login details are not included/);
  assert.doesNotMatch(mail.body, /Client101|password|Admin1234/i);
  assert.equal(db.provider.clientShares[0].clientId, 'VHS');
  db.tenantId = tenantByReg(db, '201').id;
  assert.deepEqual(clientsMenu(db, admin, 'ADMIN'), [], 'not inside another school');
});
