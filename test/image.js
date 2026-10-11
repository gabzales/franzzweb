'use strict';
const assert = require('assert');
process.env.ORBIT_MEMORY_DB = '1';
process.env.SESSION_SECRET = 'rahasia-sesi-yang-panjang-sekali-0123456789';
process.env.ADMIN_USERNAME = 'boss';
process.env.ADMIN_PASSWORD = 'rahasia-admin';
process.env.GEMINI_API_KEY = 'AIza-contoh-kunci-yang-cukup-panjang-123';
process.env.GEMINI_IMAGE_MODEL = 'gemini-nano-banana-2.1';
const api = require('../lib/api');
const realFetch = global.fetch;
const testData = Buffer.from('fake-image-data-for-contract-test').toString('base64');
const outputData = Buffer.from('mock-output-image'.repeat(20)).toString('base64');
let received = null;
let mockImageResponseData = outputData;
global.fetch = async (url, options) => {
  assert.strictEqual(String(url), 'https://generativelanguage.googleapis.com/v1beta/interactions');
  received = JSON.parse(options.body);
  return {
    ok: true, status: 200,
    text: async () => JSON.stringify({ output_text: 'Selesai', output_image: { data: mockImageResponseData, mime_type: 'image/jpeg' } })
  };
};
(async () => {
  const login = await api.login({ username: 'boss', password: 'rahasia-admin' });
  const ctx = { auth: 'Bearer ' + login.body.token };

  let r = await api.image({ action: 'other', prompt: 'coba' }, ctx);
  assert.strictEqual(r.status, 400, 'mode gambar tervalidasi');
  r = await api.image({ action: 'edit', prompt: 'hapus latar' }, ctx);
  assert.strictEqual(r.status, 400, 'edit tanpa foto ditolak');
  assert.strictEqual(received, null, 'input invalid tidak memanggil vendor');

  r = await api.image({ action: 'generate', prompt: 'Ilustrasi langit senja ungu', aspectRatio: '16:9' }, ctx);
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.imageData, outputData);
  assert.strictEqual(r.body.mimeType, 'image/jpeg');
  assert.strictEqual(received.model, 'gemini-nano-banana-2.1');
  assert.strictEqual(received.response_format.aspect_ratio, '16:9');
  assert.strictEqual(received.response_format.image_size, '1K');
  assert.strictEqual(typeof received.input, 'string');

  r = await api.image({ action: 'edit', prompt: 'Buat latarnya putih', imageData: testData, mimeType: 'image/png' }, ctx);
  assert.strictEqual(r.status, 200);
  assert.ok(Array.isArray(received.input), 'edit mengirim prompt dan gambar sebagai input multimodal');
  assert.strictEqual(received.input[1].type, 'image');
  assert.strictEqual(received.input[1].mime_type, 'image/png');

  mockImageResponseData = 'A'.repeat(3800001);
  r = await api.image({ action: 'generate', prompt: 'Ilustrasi ukuran besar' }, ctx);
  assert.strictEqual(r.status, 502, 'hasil gambar yang terlalu besar ditolak sebelum dikirim ke klien');
  mockImageResponseData = outputData;

  r = await api.image({ action: 'edit', prompt: 'edit', imageData: 'invalid data!' }, ctx);
  assert.strictEqual(r.status, 413, 'data foto invalid ditolak');

  const H = require('../api/[name].js');
  const res = { code: 0, setHeader() {}, status(c) { res.code = c; return res; }, json(b) { res.body = b; return res; } };
  await H({ method: 'POST', query: { name: 'image' }, headers: { authorization: 'Bearer ' + login.body.token, 'content-length': '100' }, body: { action: 'generate', prompt: 'Gambar laut malam' } }, res);
  assert.strictEqual(res.code, 200, 'route /api/image terhubung');
  global.fetch = realFetch;
  console.log('TES BUAT GAMBAR / EDIT FOTO LULUS');
})().catch(e => { global.fetch = realFetch; console.error(e); process.exit(1); });
