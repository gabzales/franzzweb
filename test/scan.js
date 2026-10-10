'use strict';
process.env.ORBIT_MEMORY_DB = '1';
process.env.SESSION_SECRET = 'rahasia-sesi-yang-panjang-sekali-0123456789';
process.env.ADMIN_USERNAME = 'boss';
process.env.ADMIN_PASSWORD = 'rahasia-admin';
process.env.GEMINI_API_KEY = 'AIza-contoh-kunci-yang-cukup-panjang-123';
process.env.GEMINI_MODEL = 'gemini-test';
const assert = require('assert');
const api = require('../lib/api');
const { resetMemory } = require('../lib/db');
const H = require('../api/[name].js');
const bearer = token => ({ auth: 'Bearer ' + token });
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString('base64');
const image = { mimeType: 'image/jpeg', data: jpeg };
let replyStatus = 200, sent = null;
const realFetch = global.fetch;
global.fetch = async (url, options) => {
  sent = { url, options, body: JSON.parse(options.body) };
  if (replyStatus !== 200) return { ok: false, status: replyStatus, text: async () => 'blocked' };
  return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: '**Langkah 1:** kenali konsep.\n\n**Jawaban:** hasilnya 42.' }] } }] }) };
};
(async () => {
  resetMemory();
  const A = (await api.login({ username: 'boss', password: 'rahasia-admin' })).body.token;
  assert.strictEqual((await api.scan({ image }, {})).status, 401, 'scan wajib login');
  assert.strictEqual((await api.scan({}, bearer(A))).status, 400, 'foto wajib diisi');
  assert.strictEqual((await api.scan({ image: { mimeType: 'image/svg+xml', data: jpeg } }, bearer(A))).status, 400, 'SVG ditolak');
  assert.strictEqual((await api.scan({ image: { mimeType: 'image/jpeg', data: Buffer.from('<html>').toString('base64') } }, bearer(A))).status, 400, 'signature gambar divalidasi');
  let r = await api.scan({ image, instruction: 'Jelaskan perlahan' }, bearer(A));
  assert.strictEqual(r.status, 200);
  assert.match(r.body.text, /Jawaban/);
  assert.ok(sent.url.includes('/gemini-test:generateContent'));
  assert.strictEqual(sent.body.contents[0].parts[0].text.includes('langkah penyelesaian'), true);
  assert.deepStrictEqual(sent.body.contents[0].parts[1].inline_data, { mime_type: 'image/jpeg', data: jpeg });

  process.env.GEMINI_MODEL = 'gemini-3.8-flash';
  r = await api.scan({ image }, bearer(A));
  assert.strictEqual(r.status, 200);
  assert.ok(!Object.prototype.hasOwnProperty.call(sent.body.generationConfig, 'temperature'), 'Scan Soal Gemini 3.x tidak boleh mengirim temperature');
  process.env.GEMINI_MODEL = 'gemini-test';

  assert.strictEqual((await api.admin({ action: 'createUser', username: 'murid', password: 'password123', quota: 1 }, bearer(A))).status, 200);
  const U = (await api.login({ username: 'murid', password: 'password123' })).body.token;
  replyStatus = 403;
  assert.strictEqual((await api.scan({ image }, bearer(U))).status, 502, 'kegagalan Gemini ditangani');
  replyStatus = 200;
  assert.strictEqual((await api.scan({ image }, bearer(U))).status, 200, 'kuota dikembalikan ketika Gemini gagal');
  assert.strictEqual((await api.scan({ image }, bearer(U))).status, 429, 'scan tetap menghitung kuota setelah sukses');

  const res = { code: 0, body: null, setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await H({ method: 'POST', query: { name: 'scan' }, headers: {}, body: { oversized: 'x'.repeat(2500000) } }, res);
  assert.strictEqual(res.code, 413, 'pembatasan ukuran body tetap bekerja meski Content-Length kosong');
  global.fetch = realFetch;
  console.log('TES SCAN SOAL LULUS');
})().catch(e => { global.fetch = realFetch; console.error('GAGAL:', e.stack || e.message); process.exit(1); });
