'use strict';
const assert = require('assert');
const { getSettings, DEFAULTS } = require('../lib/api');

(async () => {
  const oldPrimary = process.env.GEMINI_MODEL;
  const oldFallback = process.env.GEMINI_FALLBACK_MODEL;
  delete process.env.GEMINI_MODEL;
  delete process.env.GEMINI_FALLBACK_MODEL;
  assert.strictEqual(DEFAULTS.model, 'gemini-3.8-flash');
  const defaultSettings = await getSettings({ get: async () => null });
  assert.strictEqual(defaultSettings.model, 'gemini-3.8-flash');
  const oldSaved = await getSettings({ get: async () => ({ model: 'gemini-3.5-flash', fallback: 'gemini-3.7-flash' }) });
  assert.strictEqual(oldSaved.model, 'gemini-3.6-flash');
  assert.strictEqual(oldSaved.fallback, 'gemini-3.8-flash');
  if (oldPrimary !== undefined) process.env.GEMINI_MODEL = oldPrimary;
  if (oldFallback !== undefined) process.env.GEMINI_FALLBACK_MODEL = oldFallback;
  console.log('TES MIGRASI MODEL GEMINI LULUS');
})().catch(e => { console.error(e); process.exit(1); });
