'use strict';
process.env.ORBIT_MEMORY_DB = '1';
process.env.SESSION_SECRET = 'rahasia-sesi-yang-panjang-sekali-0123456789';
process.env.ADMIN_USERNAME = 'boss';
process.env.ADMIN_PASSWORD = 'rahasia-admin';
const assert = require('assert');
const api = require('../lib/api');
const db = require('../lib/db');
(async () => {
  db.resetMemory();
  assert.strictEqual((await api.login({ username: 'ghost-account', password: 'password-salah' })).status, 401);
  assert.ok(!(await db.createMemoryStore().list('lock:')).some(k => k === 'lock:ghost-account'), 'username tidak dikenal tidak membuat dokumen lock');

  delete process.env.ORBIT_MEMORY_DB;
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON = 'bukan-json';
  const login = await api.login({ username: 'boss', password: 'rahasia-admin' });
  assert.strictEqual(login.status, 200, 'admin env tetap bisa login jika konfigurasi Firestore tidak valid');
  assert.strictEqual((await api.me({}, { auth: 'Bearer ' + login.body.token })).status, 200);
  const status = await api.status();
  assert.strictEqual(status.body.panel, false, 'panel tetap nonaktif jika Firestore invalid');
  assert.ok(status.body.storageError);
  console.log('TES HARDENING LOGIN LULUS');
})().catch(e => { console.error('GAGAL:', e.stack || e.message); process.exit(1); });
