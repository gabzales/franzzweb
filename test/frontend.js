'use strict';
const assert = require('assert');
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '../public/index.html'), 'utf8');
const apiSource = fs.readFileSync(require('path').join(__dirname, '../lib/api.js'), 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
assert.deepStrictEqual(duplicates, [], 'ID elemen statis tidak boleh duplikat');
for (const text of ['Scan Soal', 'Buka ChatGPT', 'Tutor AI', 'Tanya AI', 'Penjelasan lengkap', 'Ringkas Materi', 'Cek Jawaban', 'Latihan Soal']) {
  assert.ok(html.includes(text), 'menu harus mencakup: ' + text);
}
assert.ok(html.includes("call('/api/scan'"), 'UI scan harus terhubung ke endpoint scan');
assert.ok(html.includes("window.open('https://chatgpt.com/'"), 'aksi Buka ChatGPT harus membuka tab baru');
assert.ok(apiSource.includes("const DEFAULTS = { model: 'gemini-3.8-flash'"), 'model Gemini bawaan harus model stabil terbaru yang dipilih proyek');
assert.ok(html.includes('function setFrameSandbox(url)'), 'iframe sandbox harus disetel berdasar origin');
assert.ok(html.includes("sameOrigin ? '' : ' allow-same-origin'"), 'izin same-origin tidak boleh diberikan pada dokumen se-origin');
console.log('TES FRONTEND STATIS LULUS');
