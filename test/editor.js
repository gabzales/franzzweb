'use strict';
const assert = require('assert');
const E = require('../public/editor.js');
const { highlight: hl, langOf, buildPreview, inlineAssets } = E;

// bahasa dari ekstensi
assert.strictEqual(langOf('app.JS'), 'js'); assert.strictEqual(langOf('index.html'), 'html'); assert.strictEqual(langOf('Makefile'), ''); assert.strictEqual(langOf('a.tsx'), 'ts');

// semua teks di-escape: tidak ada tag mentah dari isi file yang lolos ke HTML pewarna
for (const lang of ['js', 'html', 'css', 'json', 'py', 'php', 'sql', 'md', 'sh', 'yml', '']) {
  const out = hl('<img src=x onerror=alert(1)> </script><script>alert(2)</script> "</b>" & <!-- <i> -->', lang);
  const stripped = out.replace(/<\/?span[^>]*>/g, '');
  assert.ok(!/<(?!\/?span)/i.test(out.replace(/<span class="t-[a-z]+">|<\/span>/g, '')), 'tag mentah lolos di bahasa ' + lang + ': ' + out);
  assert.ok(stripped.replace(/&(?:amp|lt|gt);/g, '').indexOf('<') < 0, 'karakter < tidak ter-escape (' + lang + ')');
}
// pewarna tidak menghilangkan atau menambah teks
const src = ['const a = `x${1}` + "s\\"q"; // k\n/* b */ foo(1.5e3, 0xFF)', '<div class="a" id=x>t&amp;<!-- c --></div><style>a{color:#fff}</style><script>let n=1;</script>', '.a:hover{color:red;margin:-1px}\n@media (x){#id{top:0}}'];
['js', 'html', 'css'].forEach((lang, i) => {
  const plain = hl(src[i], lang).replace(/<\/?span[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  assert.strictEqual(plain, src[i], 'teks berubah setelah diwarnai (' + lang + ')');
});
assert.match(hl('const a = 1 // x', 'js'), /t-kw">const<[\s\S]*t-nm">1<[\s\S]*t-cm">\/\/ x</);
assert.match(hl('{"k": [1, true]}', 'json'), /t-pr">"k"/);
assert.match(hl('<a href="u">', 'html'), /t-tg">&lt;a<[\s\S]*t-at">href<[\s\S]*t-st">"u"/);
assert.match(hl('<script>var x=1</script>', 'html'), /t-kw">var</, 'isi <script> diwarnai sebagai JS');

// file besar tidak membuat pewarna hang (linear)
const big = 'var a = "x"; // c\n'.repeat(40000), t0 = Date.now(); hl(big, 'js');
assert.ok(Date.now() - t0 < 1500, 'pewarna terlalu lambat: ' + (Date.now() - t0) + 'ms');
// string/komentar tak tertutup tidak menimbulkan loop tak berujung
hl('"abc\n\'x\n/* tak tertutup\n`tpl', 'js'); hl('<!-- x\n<script>y', 'html');

// pratinjau: file lain di tab disisipkan, </script> di dalam kode di-escape, penangkap console ditambahkan
const files = [{ name: 'index.html', text: '<head><link rel="stylesheet" href="s.css"></head><body><script src="a.js"></script><script src="https://cdn.x/y.js"></script></body>' }, { name: 's.css', text: 'p{color:red}' }, { name: 'a.js', text: 'var s="</script>";' }];
const p = buildPreview(files[0], files);
assert.match(p, /<style>p\{color:red\}<\/style>/); assert.ok(p.includes('var s="<\\/script>";'), 'penutup script harus di-escape'); assert.ok(p.includes('https://cdn.x/y.js'), 'src luar dibiarkan'); assert.match(p, /orbitRun/);
assert.ok(p.indexOf('orbitRun') < p.indexOf('<body>'), 'penangkap console dipasang sebelum skrip pengguna');
assert.match(buildPreview({ name: 'x.js', text: 'console.log(1)' }, []), /orbitRun[\s\S]*console\.log\(1\)/);
assert.strictEqual(buildPreview({ name: 'x.py', text: 'print(1)' }, []), null, 'jenis yang tidak bisa dijalankan');
assert.strictEqual(inlineAssets('<script src="x.js"></script>', []), '<script src="x.js"></script>');
console.log('TES EDITOR KODE LULUS');
