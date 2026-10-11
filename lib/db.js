'use strict';

// FRANZZ Orbit storage adapter.
// Production: Cloud Firestore through the server-only Firebase Admin SDK.
// Tests without network: ORBIT_MEMORY_DB=1 selects an in-memory implementation.
// With no Firebase credentials, memory storage remains available only for best-effort
// login throttling; persistent() stays false so the Admin panel is not falsely enabled.

let mem = null;
const COLLECTION = 'orbitStore';
const FIREBASE_JSON_ENV = 'FIREBASE_SERVICE_ACCOUNT_JSON';
const FIREBASE_BASE64_ENV = 'FIREBASE_SERVICE_ACCOUNT_BASE64';

function hasFirebaseEnv() {
  return !!(String(process.env[FIREBASE_JSON_ENV] || '').trim() ||
    String(process.env[FIREBASE_BASE64_ENV] || '').trim() ||
    String(process.env.FIREBASE_PROJECT_ID || '').trim());
}

function readFirebaseConfig() {
  const json = String(process.env[FIREBASE_JSON_ENV] || '').trim();
  const base64 = String(process.env[FIREBASE_BASE64_ENV] || '').trim();
  if ((!json && !base64) || (json && base64)) return null;

  let credentials;
  try {
    const raw = json || Buffer.from(base64, 'base64').toString('utf8');
    credentials = JSON.parse(raw);
  } catch (_) {
    return null;
  }
  if (!credentials || typeof credentials !== 'object' ||
      typeof credentials.client_email !== 'string' ||
      typeof credentials.private_key !== 'string' ||
      !credentials.client_email.trim() || !credentials.private_key.includes('PRIVATE KEY')) {
    return null;
  }
  credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
  const envProjectId = String(process.env.FIREBASE_PROJECT_ID || '').trim();
  const embeddedProjectId = String(credentials.project_id || '').trim();
  if (envProjectId && embeddedProjectId && envProjectId !== embeddedProjectId) return null;
  const projectId = envProjectId || embeddedProjectId;
  if (!projectId || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) return null;
  return { projectId, credentials };
}

function serialClone(value) {
  if (value === undefined) return null;
  return JSON.parse(JSON.stringify(value));
}

function outcomeOf(value, updater) {
  const outcome = updater(serialClone(value));
  if (!outcome || typeof outcome !== 'object' || !Object.prototype.hasOwnProperty.call(outcome, 'value')) {
    throw new Error('db.mutate updater harus mengembalikan { value, result? }.');
  }
  return outcome;
}

function createMemoryStore() {
  mem = mem || new Map();
  const data = mem;
  return {
    get: async key => (data.has(String(key)) ? JSON.parse(data.get(String(key))) : null),
    set: async (key, value) => { data.set(String(key), JSON.stringify(value)); },
    del: async key => { data.delete(String(key)); },
    list: async prefix => [...data.keys()].filter(key => key.startsWith(String(prefix))),
    createIfAbsent: async (key, value) => {
      key = String(key);
      if (data.has(key)) return false;
      data.set(key, JSON.stringify(value));
      return true;
    },
    mutate: async (key, updater) => {
      key = String(key);
      const current = data.has(key) ? JSON.parse(data.get(key)) : null;
      const outcome = outcomeOf(current, updater);
      data.set(key, JSON.stringify(outcome.value));
      return serialClone(outcome.result);
    }
  };
}

function createFirestoreStore(firestore) {
  if (!firestore || typeof firestore.collection !== 'function' || typeof firestore.runTransaction !== 'function') {
    throw new Error('Klien Firestore tidak valid.');
  }
  const collection = firestore.collection(COLLECTION);
  const refFor = key => {
    const raw = String(key);
    // Base64URL keeps '/', '.', and other special characters out of Firestore document IDs.
    const id = Buffer.from(raw, 'utf8').toString('base64url');
    if (!id) throw new Error('Kunci database kosong.');
    return collection.doc(id);
  };

  return {
    get: async key => {
      const snap = await refFor(key).get();
      return snap.exists ? (snap.get('value') === undefined ? null : snap.get('value')) : null;
    },
    set: async (key, value) => {
      await refFor(key).set({ key: String(key), value });
    },
    del: async key => { await refFor(key).delete(); },
    list: async prefix => {
      prefix = String(prefix);
      // Prefix range query uses Firestore's automatically maintained single-field index.
      const query = collection.where('key', '>=', prefix).where('key', '<', prefix + '\uf8ff');
      const snap = await query.select('key').get();
      return snap.docs.map(doc => doc.get('key')).filter(key => typeof key === 'string' && key.startsWith(prefix));
    },
    createIfAbsent: async (key, value) => {
      const rawKey = String(key), ref = refFor(rawKey);
      return firestore.runTransaction(async tx => {
        const snap = await tx.get(ref);
        if (snap.exists) return false;
        tx.create(ref, { key: rawKey, value });
        return true;
      });
    },
    mutate: async (key, updater) => {
      const rawKey = String(key), ref = refFor(rawKey);
      return firestore.runTransaction(async tx => {
        const snap = await tx.get(ref);
        const current = snap.exists ? snap.get('value') : null;
        const outcome = await updater(serialClone(current));
        if (!outcome || typeof outcome !== 'object' || !Object.prototype.hasOwnProperty.call(outcome, 'value')) {
          throw new Error('db.mutate updater harus mengembalikan { value, result? }.');
        }
        tx.set(ref, { key: rawKey, value: outcome.value });
        return serialClone(outcome.result);
      });
    }
  };
}

function createConfiguredFirestoreStore(config) {
  // Require Firebase lazily so the app's no-database mode and unit tests do not need
  // credentials or initialize external services.
  const appSdk = require('firebase-admin/app');
  const firestoreSdk = require('firebase-admin/firestore');
  const apps = appSdk.getApps();
  let app;
  const defaultApp = apps.find(candidate => candidate.name === '[DEFAULT]');
  if (defaultApp) {
    app = defaultApp;
    const existingProject = app.options && app.options.projectId;
    if (existingProject && existingProject !== config.projectId) {
      throw new Error('Firebase app sudah diinisialisasi dengan project ID berbeda.');
    }
  } else {
    app = appSdk.initializeApp({
      credential: appSdk.cert(config.credentials),
      projectId: config.projectId
    });
  }
  return createFirestoreStore(firestoreSdk.getFirestore(app));
}

async function store() {
  if (process.env.ORBIT_MEMORY_DB === '1') return createMemoryStore();
  if (!hasFirebaseEnv()) return createMemoryStore();

  const config = readFirebaseConfig();
  if (!config) {
    throw new Error('Konfigurasi Firestore tidak valid. Periksa FIREBASE_SERVICE_ACCOUNT_JSON (atau FIREBASE_SERVICE_ACCOUNT_BASE64) dan FIREBASE_PROJECT_ID.');
  }
  return createConfiguredFirestoreStore(config);
}

// Only a test flag or valid Firebase service-account config enables persistent features.
function persistent() {
  if (process.env.ORBIT_MEMORY_DB === '1') return true;
  return !!readFirebaseConfig();
}

// Read-only live probe: validates that credentials can reach Firestore and can read
// the collection. This is intentionally separate from persistent(), which only
// validates the shape/matching of environment variables.
async function checkFirestoreConnection() {
  if (process.env.ORBIT_MEMORY_DB === '1') return { ok: true, mode: 'memory' };
  const config = readFirebaseConfig();
  if (!config) throw new Error('Konfigurasi Firestore belum valid.');
  const db = createConfiguredFirestoreStore(config);
  await db.list('__franzz_orbit_healthcheck_never_used__');
  return { ok: true, mode: 'firestore' };
}

function resetMemory() { mem = null; }

module.exports = {
  store,
  persistent,
  checkFirestoreConnection,
  resetMemory,
  createFirestoreStore,
  readFirebaseConfig,
  hasFirebaseEnv,
  COLLECTION
};
