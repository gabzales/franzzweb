'use strict';
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync(require.resolve('../public/index.html'), 'utf8');
const api = fs.readFileSync(require.resolve('../lib/api.js'), 'utf8');
for (const id of ['codedlg','code-command','code-command-run','code-editor','code-out','code-run']) {
  assert(html.includes(`id="${id}"`), `Coding Lab terminal control ${id} is missing`);
}
for (const command of ["command === 'help'", "command === 'pwd'", "command === 'ls'", "command === 'cd'", "command === 'cat'", "command === 'mkdir'", "command === 'touch'", "command === 'rm'", "command === 'python'", "command === 'node'", "command === 'echo'"]) assert(html.includes(command), `Terminal command missing: ${command}`);
assert(html.includes('v314.0.7/full/pyodide.js'), 'Pin Pyodide runtime for reproducible browser Python');
assert(html.includes("setAttribute('sandbox','allow-scripts')"), 'Code execution must remain in a browser sandbox');
assert(html.includes('Akses di luar /workspace ditolak.'), 'Terminal must reject workspace path traversal');
const vercel = JSON.parse(fs.readFileSync(require.resolve('../vercel.json'), 'utf8'));
const csp = vercel.headers.find(h => h.headers.some(x => x.key === 'Content-Security-Policy')).headers.find(x => x.key === 'Content-Security-Policy').value;
assert(csp.includes('https://cdn.jsdelivr.net') && csp.includes('wasm-unsafe-eval'), 'CSP must allow the pinned Pyodide loader and WebAssembly runtime');
assert(!csp.includes("'unsafe-eval'"), 'Do not broadly enable eval in the app CSP');
assert(!html.includes('new Function('), 'Sandbox runner should avoid eval/new Function under the app CSP');
assert(api.includes('async function code('), 'Code generation endpoint must remain available');
assert(!/child_process|execSync|spawnSync|require\(['"]vm['"]\)/.test(api), 'Server API must not execute submitted code locally');

// Execute the actual in-page shell functions with a small DOM shim for behavioral regression tests.
const start = html.indexOf('  var codeWorkspace = Object.create(null)');
const end = html.indexOf("  $('#code-command-run').addEventListener", start);
assert(start >= 0 && end > start, 'Could not locate shell implementation');
const elements = {
  '#code-editor': { value: 'print("hello")', addEventListener() {}, click() {} },
  '#code-language': { value: 'Python', dispatchEvent() {} },
  '#code-run': { click() {} }, '#code-save': { click() {} }
};
const ctx = { $, codingOutput: v => { ctx.output = String(v); }, Event: function Event() {}, Date, Object, String, Error, RegExp, Array, setTimeout, clearTimeout };
function $(sel) { return elements[sel] || (elements[sel] = { value: '', addEventListener() {}, click() {}, dispatchEvent() {} }); }
ctx.$ = $;
vm.runInNewContext(html.slice(start, end) + '\nglobalThis.shellApi = {shellCommand, shellPath, codeWorkspace, codeWorkspaceDirs};', ctx);
const sh = ctx.shellApi;
assert.strictEqual(sh.shellCommand('pwd'), '/workspace');
assert.match(sh.shellCommand('help'), /python main.py/);
assert.strictEqual(sh.shellCommand('echo hello "from coding lab"'), 'hello from coding lab');
assert.strictEqual(sh.shellCommand('touch demo.txt'), 'File sesi dibuat: /workspace/demo.txt');
assert.strictEqual(sh.shellCommand('ls'), 'demo.txt\nmain.py');
assert.strictEqual(sh.shellCommand('cat main.py'), 'print("hello")');
assert.strictEqual(sh.shellCommand('cat demo.txt'), '');
assert.strictEqual(sh.shellCommand('grep hello main.py'), 'print("hello")');
assert.strictEqual(sh.shellCommand('head -n 1 main.py'), 'print("hello")');
assert.strictEqual(sh.shellCommand('tail -n 1 main.py'), 'print("hello")');
assert.match(sh.shellCommand('wc main.py'), /^1 \d+ \d+ main\.py$/);
assert.match(sh.shellCommand('cp main.py copy.py'), /File disalin/);
assert.strictEqual(sh.shellCommand('cat copy.py'), 'print("hello")');
assert.match(sh.shellCommand('mv copy.py moved.py'), /File dipindahkan/);
assert.strictEqual(sh.shellCommand('cat moved.py'), 'print("hello")');
assert.match(sh.shellCommand('find .'), /moved\.py/);
assert.strictEqual(sh.shellCommand('mkdir src'), 'Folder sesi dibuat: /workspace/src');
assert.strictEqual(sh.shellCommand('cd src'), '/workspace/src');
assert.strictEqual(sh.shellCommand('pwd'), '/workspace/src');
assert.strictEqual(sh.shellPath('/workspace/demo.txt'), '/workspace/demo.txt', 'absolute workspace paths should not be re-based to cwd');
let escaped = false; try { sh.shellPath('../../etc/passwd'); } catch (e) { escaped = true; }
assert(escaped, 'path traversal should be rejected');
assert.strictEqual(sh.shellCommand('rm /workspace/demo.txt'), 'File sesi dihapus.');
assert.strictEqual(sh.shellCommand('python --version').startsWith('Python 3.14'), true);
console.log('TES TERMINAL WEB: perintah dasar, file workspace, path guard, sandbox browser, dan larangan eksekusi di server lulus');
