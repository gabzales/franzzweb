'use strict';
const assert = require('assert');
const { createFirestoreStore, persistent, readFirebaseConfig, hasFirebaseEnv } = require('../lib/db');

let forceFirestoreQueryError = false;

class Snapshot {
  constructor(data) { this.data = data || null; this.exists = !!data; }
  get(field) { return this.data ? this.data[field] : undefined; }
}
class FakeDoc {
  constructor(db, collection, id) { this.db = db; this.collection = collection; this.id = id; this.path = collection + '/' + id; }
  async get() { return new Snapshot(this.db.data.get(this.path)); }
  async set(data) { this.db.data.set(this.path, structuredClone(data)); }
  async delete() { this.db.data.delete(this.path); }
}
class FakeQuery {
  constructor(collection, filters = [], fields = null) { this.collection = collection; this.filters = filters; this.fields = fields; }
  where(field, op, value) { return new FakeQuery(this.collection, [...this.filters, [field, op, value]], this.fields); }
  select(...fields) { return new FakeQuery(this.collection, this.filters, fields); }
  async get() {
    if (forceFirestoreQueryError) throw new Error('PERMISSION_DENIED: test-only Firestore probe failure');
    const docs = [];
    for (const [path, data] of this.collection.db.data.entries()) {
      if (!path.startsWith(this.collection.name + '/')) continue;
      const ok = this.filters.every(([field, op, value]) => {
        const actual = data[field];
        if (op === '>=') return actual >= value;
        if (op === '<') return actual < value;
        if (op === '==') return actual === value;
        return false;
      });
      if (ok) docs.push({ get: field => data[field] });
    }
    return { docs };
  }
}
class FakeCollection {
  constructor(db, name) { this.db = db; this.name = name; }
  doc(id) { return new FakeDoc(this.db, this.name, id); }
  where(field, op, value) { return new FakeQuery(this, [[field, op, value]]); }
}
class FakeFirestore {
  constructor() { this.data = new Map(); this.tail = Promise.resolve(); }
  collection(name) { return new FakeCollection(this, name); }
  async runTransaction(callback) {
    const previous = this.tail;
    let release;
    this.tail = new Promise(resolve => { release = resolve; });
    await previous;
    try {
      const writes = [];
      const tx = {
        get: ref => ref.get(),
        create: (ref, value) => writes.push({ type: 'create', ref, value: structuredClone(value) }),
        set: (ref, value) => writes.push({ type: 'set', ref, value: structuredClone(value) }),
        delete: ref => writes.push({ type: 'delete', ref })
      };
      const result = await callback(tx);
      for (const write of writes) {
        if (write.type === 'create' && this.data.has(write.ref.path)) throw new Error('already exists');
        if (write.type === 'delete') this.data.delete(write.ref.path);
        else this.data.set(write.ref.path, write.value);
      }
      return result;
    } finally { release(); }
  }
}

(async () => {
  const old = {
    memory: process.env.ORBIT_MEMORY_DB,
    json: process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
    base64: process.env.FIREBASE_SERVICE_ACCOUNT_BASE64,
    project: process.env.FIREBASE_PROJECT_ID
  };
  try {
    delete process.env.ORBIT_MEMORY_DB;
    delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    delete process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
    delete process.env.FIREBASE_PROJECT_ID;
    assert.strictEqual(hasFirebaseEnv(), false);
    assert.strictEqual(persistent(), false, 'without Firebase config panel stays disabled');

    const credentials = {
      type: 'service_account',
      project_id: 'orbit-test-2026',
      client_email: 'orbit-test@orbit-test-2026.iam.gserviceaccount.com',
      private_key: 'PRIVATE KEY - TEST DATA ONLY'
    };
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify(credentials);
    assert.strictEqual(persistent(), true, 'valid service-account JSON enables persistent storage');
    const parsed = readFirebaseConfig();
    assert.strictEqual(parsed.projectId, 'orbit-test-2026');
    assert.ok(parsed.credentials.private_key.includes('TEST DATA ONLY'));
    process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 = Buffer.from(JSON.stringify(credentials)).toString('base64');
    assert.strictEqual(persistent(), false, 'using JSON and Base64 credential variables together is rejected');
    delete process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
    assert.strictEqual(persistent(), true, 'single JSON credential remains valid');
    process.env.FIREBASE_PROJECT_ID = 'a-different-project';
    assert.strictEqual(persistent(), false, 'mismatched project IDs are rejected');
    process.env.FIREBASE_PROJECT_ID = 'orbit-test-2026';

    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = '{broken';
    assert.strictEqual(persistent(), false, 'malformed credentials must not falsely enable panel');
    delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 = Buffer.from(JSON.stringify(credentials)).toString('base64');
    assert.strictEqual(persistent(), true, 'base64 credentials are supported');

    const firestore = new FakeFirestore();
    const db = createFirestoreStore(firestore);
    await db.set('user:alice/with/slash', { username: 'alice', quota: 12 });
    assert.deepStrictEqual(await db.get('user:alice/with/slash'), { username: 'alice', quota: 12 });
    assert.deepStrictEqual(await db.list('user:'), ['user:alice/with/slash']);
    assert.strictEqual(await db.get('user:missing'), null);
    await db.del('user:alice/with/slash');
    assert.strictEqual(await db.get('user:alice/with/slash'), null);

    assert.strictEqual(await db.createIfAbsent('user:gabz', { username: 'gabz' }), true);
    assert.strictEqual(await db.createIfAbsent('user:gabz', { username: 'duplicate' }), false);
    assert.deepStrictEqual(await db.get('user:gabz'), { username: 'gabz' });

    await Promise.all(Array.from({ length: 100 }, () => db.mutate('use:gabz:2026-10-09', current => ({ value: { n: (current && current.n || 0) + 1 }, result: true }))));
    assert.deepStrictEqual(await db.get('use:gabz:2026-10-09'), { n: 100 }, 'transactional updates preserve concurrent increments');
    await db.set('user:bravo', { username: 'bravo' });
    assert.deepStrictEqual((await db.list('user:')).sort(), ['user:bravo', 'user:gabz']);

    // Integration test: exercise API login and admin user creation using the mocked Firebase Admin SDK.
    const Module = require('module');
    const apiFirestore = new FakeFirestore();
    const app = { name: '[DEFAULT]', options: { projectId: 'orbit-test-2026' } };
    let apps = [];
    const fakeAppSdk = {
      getApps: () => apps,
      getApp: () => apps.find(candidate => candidate.name === '[DEFAULT]'),
      initializeApp: options => { const createdApp = { name: '[DEFAULT]', options }; apps = [createdApp]; return createdApp; },
      cert: serviceAccount => serviceAccount
    };
    const originalLoad = Module._load;
    Module._load = function (request, parent, isMain) {
      if (request === 'firebase-admin/app') return fakeAppSdk;
      if (request === 'firebase-admin/firestore') return { getFirestore: () => apiFirestore };
      return originalLoad.call(this, request, parent, isMain);
    };
    try {
      process.env.SESSION_SECRET = 'this-is-a-long-test-session-secret-123456789';
      process.env.ADMIN_USERNAME = 'owner-admin';
      process.env.ADMIN_PASSWORD = 'owner-admin-password';
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify(credentials);
      delete process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
      delete process.env.ORBIT_MEMORY_DB;
      const api = require('../lib/api');
      assert.deepStrictEqual((await api.status()).body, { configured: true, adminReady: true, panel: true });
      forceFirestoreQueryError = true;
      const failedProbe = await api.status();
      assert.strictEqual(failedProbe.body.panel, false, 'status must not claim Firestore is connected when live probe fails');
      assert.ok(failedProbe.body.storageError, 'status should explain that Firestore is unreachable');
      forceFirestoreQueryError = false;
      const adminLogin = await api.login({ username: 'owner-admin', password: 'owner-admin-password' });
      assert.strictEqual(adminLogin.status, 200, 'admin login should use mocked Firestore');
      const adminCtx = { auth: 'Bearer ' + adminLogin.body.token };
      const initial = await api.admin({ action: 'list' }, adminCtx);
      assert.strictEqual(initial.status, 200);
      assert.strictEqual(initial.body.users.length, 1, 'environment admin is saved to Firestore');
      const create = await api.admin({ action: 'createUser', username: 'fire-user', password: 'firestore-user-password', quota: 10 }, adminCtx);
      assert.strictEqual(create.status, 200, 'admin can create Firestore-backed user');
      const duplicate = await api.admin({ action: 'createUser', username: 'fire-user', password: 'firestore-user-password', quota: 10 }, adminCtx);
      assert.strictEqual(duplicate.status, 409, 'duplicate username is rejected transactionally');
      // Resetting the local memory map must not erase Firestore-backed accounts.
      require('../lib/db').resetMemory();
      const userLogin = await api.login({ username: 'fire-user', password: 'firestore-user-password' });
      assert.strictEqual(userLogin.status, 200, 'user survives in-memory reset because Firestore is persistent');
      const userMe = await api.me({}, { auth: 'Bearer ' + userLogin.body.token });
      assert.deepStrictEqual(userMe.body, { username: 'fire-user', role: 'user' });
      console.log('TES API FIRESTORE LOGIN/ADMIN LULUS (Firebase Admin SDK mocked; no live Firebase project)');
    } finally {
      Module._load = originalLoad;
    }
    console.log('TES FIRESTORE ADAPTER LULUS (fake Firestore; no live Firebase credentials required)');
  } finally {
    if (old.memory === undefined) delete process.env.ORBIT_MEMORY_DB; else process.env.ORBIT_MEMORY_DB = old.memory;
    if (old.json === undefined) delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON; else process.env.FIREBASE_SERVICE_ACCOUNT_JSON = old.json;
    if (old.base64 === undefined) delete process.env.FIREBASE_SERVICE_ACCOUNT_BASE64; else process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 = old.base64;
    if (old.project === undefined) delete process.env.FIREBASE_PROJECT_ID; else process.env.FIREBASE_PROJECT_ID = old.project;
  }
})().catch(error => { console.error(error.stack || error); process.exit(1); });
