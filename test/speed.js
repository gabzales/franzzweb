'use strict';
const assert = require('assert');
const { answer, thinkingFor } = require('../lib/gemini');
const gem = o => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(o) }] } }] }) });
const mk = n => Array.from({ length: n }, (_, i) => ({ id: 'q' + (i + 1), title: 'Soal ' + (i + 1), type: 'text', options: [], required: false }));
const real = global.fetch;

(async () => {
  assert.deepStrictEqual(thinkingFor('gemini-3.8-flash'), { thinkingLevel: 'low' });
  assert.deepStrictEqual(thinkingFor('gemini-2.5-flash'), { thinkingBudget: 0 });
  assert.strictEqual(thinkingFor('model-lain'), null);

  // pengaturan berpikir terkirim; jika ditolak 400, diulang tanpa pengaturan itu
  const bodies = [];
  global.fetch = async (u, o) => { const b = JSON.parse(o.body); bodies.push(b.generationConfig); return b.generationConfig.thinkingConfig ? { ok: false, status: 400 } : gem({ answers: [{ id: 'q1', text: 'ok' }] }); };
  assert.strictEqual((await answer({ key: 'k', models: ['gemini-3.8-flash'], questions: mk(1), delays: [1] })).length, 1);
  assert.deepStrictEqual(bodies.map(g => !!g.thinkingConfig), [true, false], 'harus coba dengan lalu tanpa thinkingConfig');

  // 20 soal -> 3 panggilan paralel, hasil digabung berurutan
  let calls = 0, active = 0, peak = 0;
  global.fetch = async (u, o) => {
    calls++; active++; peak = Math.max(peak, active); await new Promise(r => setTimeout(r, 30)); active--;
    const ids = JSON.parse(JSON.parse(o.body).contents[0].parts[0].text.split('Questions: ')[1]).map(q => q.id);
    return gem({ answers: ids.map(id => ({ id, text: 'jawab-' + id })) });
  };
  const t0 = Date.now();
  const out = await answer({ key: 'k', models: ['m-one'], questions: mk(20), delays: [1] });
  assert.strictEqual(calls, 3); assert.ok(peak >= 2, 'harus berjalan paralel'); assert.strictEqual(out.length, 20);
  assert.deepStrictEqual(out.map(a => a.id), mk(20).map(q => q.id), 'urutan terjaga');
  assert.ok(Date.now() - t0 < 85, 'paralel harus lebih cepat dari berurutan (3x30ms)');

  // satu bagian gagal -> bagian lain tetap dipakai; semua gagal -> error
  let n = 0;
  global.fetch = async (u, o) => (++n === 2 ? { ok: false, status: 403 } : gem({ answers: [{ id: 'q1', text: 'x' }] }));
  assert.ok((await answer({ key: 'k', models: ['m-one'], questions: mk(20), delays: [1] })).length >= 1);
  global.fetch = async () => ({ ok: false, status: 403 });
  await assert.rejects(answer({ key: 'k', models: ['m-one'], questions: mk(20), delays: [1] }), /ditolak/);

  // esai dipisah dari pilihan/isian singkat (3 esai per panggilan), urutan akhir tetap mengikuti urutan soal
  const mix = [
    { id: 'q1', title: 'a', type: 'single', options: ['x', 'y'] }, { id: 'q2', title: 'b', type: 'essay', options: [] },
    { id: 'q3', title: 'c', type: 'text', options: [] }, { id: 'q4', title: 'd', type: 'essay', options: [] },
    { id: 'q5', title: 'e', type: 'multi', options: ['x', 'y'] }, { id: 'q6', title: 'f', type: 'essay', options: [] },
    { id: 'q7', title: 'g', type: 'essay', options: [] }
  ];
  const sizes = [];
  global.fetch = async (u, o) => {
    const qs = JSON.parse(JSON.parse(o.body).contents[0].parts[0].text.split('Questions: ')[1]);
    sizes.push(qs.map(q => q.type === 'essay' ? 'E' : 'L').join(''));
    return gem({ answers: qs.map(q => ({ id: q.id, text: 'j-' + q.id })) });
  };
  const mixOut = await answer({ key: 'k', models: ['m-one'], questions: mix, delays: [1] });
  assert.deepStrictEqual(sizes.slice().sort(), ['E', 'EEE', 'LLL'], 'esai terpisah dari soal ringan, maks 3 per panggilan');
  assert.deepStrictEqual(mixOut.map(a => a.id), mix.map(q => q.id), 'urutan jawaban mengikuti soal');

  // error sementara: model cadangan langsung dipakai tanpa menunggu jeda retry
  const seen = [];
  global.fetch = async (u) => { const m = /models\/([^:]+):/.exec(u)[1]; seen.push(m); return m === 'm-utama' ? { ok: false, status: 503, text: async () => '' } : gem({ answers: [{ id: 'q1', text: 'ok' }] }); };
  const t1 = Date.now();
  const fb = await answer({ key: 'k', models: ['m-utama', 'm-cadangan'], questions: mk(1), delays: [400, 400] });
  assert.strictEqual(fb.length, 1); assert.deepStrictEqual(seen, ['m-utama', 'm-cadangan']);
  assert.ok(Date.now() - t1 < 200, 'tidak menunggu jeda retry sebelum model cadangan');
  // kedua model sama-sama sementara gagal: tetap diulang berjeda lalu berhasil
  let flaky = 0;
  global.fetch = async () => (++flaky < 3 ? { ok: false, status: 503, text: async () => '' } : gem({ answers: [{ id: 'q1', text: 'ok' }] }));
  assert.strictEqual((await answer({ key: 'k', models: ['m-a', 'm-b'], questions: mk(1), delays: [5, 5] })).length, 1);
  assert.strictEqual(flaky, 3);
  // batas harian pada model utama: tidak diulang, langsung model berikutnya
  const day = JSON.stringify({ error: { details: [{ violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel' }] }] } });
  const order = [];
  global.fetch = async (u) => { const m = /models\/([^:]+):/.exec(u)[1]; order.push(m); return m === 'm-a' ? { ok: false, status: 429, text: async () => day } : gem({ answers: [{ id: 'q1', text: 'ok' }] }); };
  assert.strictEqual((await answer({ key: 'k', models: ['m-a', 'm-b'], questions: mk(1), delays: [5, 5] })).length, 1);
  assert.deepStrictEqual(order, ['m-a', 'm-b']);
  global.fetch = real;
  console.log('TES KECEPATAN LULUS');
})().catch(e => { console.error('GAGAL:', e.stack || e.message); process.exit(1); });
