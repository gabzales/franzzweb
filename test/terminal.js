'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Shell = require('../public/shell.js');
const Editor = require('../public/editor.js');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public/editor.css'), 'utf8');
const csp = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8')).headers[0].headers.find(h => h.key === 'Content-Security-Policy').value;
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
assert.deepStrictEqual(ids.filter((id, i) => ids.indexOf(id) !== i), [], 'HTML tidak boleh punya ID duplikat');
for (const id of ['codedlg', 'ce-ta', 'ce-ai', 'ce-term-btn', 'ce-term-box', 'ce-term-cmd', 'ce-term-out']) assert.ok(html.includes('id="' + id + '"'), 'elemen editor/terminal hilang: ' + id);
assert.ok(html.indexOf('<script src="shell.js"></script>') < html.indexOf('<script src="editor.js"></script>'), 'shell harus dimuat sebelum editor');
assert.match(css, /#codedlg\s*\{/); assert.match(css, /#ce-term-box/);
assert.match(csp, /worker-src[^;]*blob:/); assert.match(csp, /https:\/\/cdn\.jsdelivr\.net/); assert.match(csp, /'wasm-unsafe-eval'/);
const jsWorker = Editor.buildWorkerSource('javascript', 'console.log(2 + 2);', 'terminal-test-token');
const pyWorker = Editor.buildWorkerSource('python', 'print(2 + 2)', 'python-test-token');
assert.doesNotThrow(() => new vm.Script(jsWorker), 'worker JavaScript harus memiliki sintaks valid');
assert.doesNotThrow(() => new vm.Script(pyWorker), 'worker Python harus memiliki sintaks valid sebelum runtime dimuat');
assert.ok(pyWorker.includes('https://cdn.jsdelivr.net/pyodide/v314.0.7/full/'));
assert.ok(jsWorker.includes('terminal-test-token'));


assert.deepStrictEqual(Shell.tokenize('python -c "print(2 + 2)"'), ['python', '-c', 'print(2 + 2)']);
assert.deepStrictEqual(Shell.tokenize("echo 'hello world'"), ['echo', 'hello world']);
assert.throws(() => Shell.tokenize("echo 'unfinished"), /kutip/i);
assert.throws(() => Shell.resolvePath('/workspace', '../secret'), /ditolak/i);
assert.throws(() => Shell.resolvePath('/workspace', '../../../etc/passwd'), /ditolak/i);
assert.throws(() => Shell.resolvePath('/workspace/src', '/etc/passwd'), /ditolak/i);

let activeFile = { name: 'main.py', text: 'print("aktif")\n' };
let opened = null, downloaded = null, pyCalls = [], jsCalls = [], previewCalls = 0;
const shell = Shell.create({
  getActiveFile: () => activeFile,
  openFile: async (name, text) => { opened = { name, text }; activeFile = opened; },
  downloadFile: async (name, text) => { downloaded = { name, text }; },
  runPython: async (code, name) => { pyCalls.push({ code, name }); return 'PYTHON-OK'; },
  runJavaScript: async (code, name) => { jsCalls.push({ code, name }); return 'JS-OK'; },
  runPreview: async () => { previewCalls++; return 'PREVIEW-OK'; }
});

(async () => {
  shell.syncEditorFiles([{ name: 'main.py', text: activeFile.text }, { name: 'app.js', text: 'console.log(42);' }], 0, activeFile.text);
  assert.strictEqual((await shell.execute('pwd')).output, '/workspace');
  assert.strictEqual((await shell.execute('ls')).output, 'app.js\nmain.py');
  assert.strictEqual((await shell.execute('cat main.py')).output, 'print("aktif")\n');
  assert.strictEqual((await shell.execute('head -n 1 main.py')).output, 'print("aktif")');
  assert.strictEqual((await shell.execute('tail -n 1 main.py')).output, 'print("aktif")');
  assert.match((await shell.execute('grep print main.py')).output, /print/);
  assert.match((await shell.execute('wc main.py')).output, /main\.py$/);
  assert.match((await shell.execute('mkdir src')).output, /Folder dibuat/);
  assert.strictEqual((await shell.execute('cd src')).output, '/workspace/src');
  assert.strictEqual((await shell.execute('pwd')).output, '/workspace/src');
  assert.match((await shell.execute('cd /workspace')).output, /workspace$/);
  assert.match((await shell.execute('cp main.py copy.py')).output, /File disalin/);
  assert.strictEqual((await shell.execute('cat copy.py')).output, 'print("aktif")\n');
  assert.match((await shell.execute('mv copy.py renamed.py')).output, /File dipindahkan/);
  assert.strictEqual((await shell.execute('cat renamed.py')).output, 'print("aktif")\n');
  assert.match((await shell.execute('find .')).output, /renamed\.py/);
  assert.strictEqual((await shell.execute('python main.py')).output, 'PYTHON-OK');
  assert.deepStrictEqual(pyCalls.pop(), { code: 'print("aktif")\n', name: 'main.py' });
  assert.strictEqual((await shell.execute('python -c "print(2 + 2)"')).output, 'PYTHON-OK');
  assert.strictEqual(pyCalls.pop().code, 'print(2 + 2)');
  assert.strictEqual((await shell.execute('node app.js')).output, 'JS-OK');
  assert.deepStrictEqual(jsCalls.pop(), { code: 'console.log(42);', name: 'app.js' });
  assert.match((await shell.execute('nano scratch.py')).output, /Terbuka/);
  assert.deepStrictEqual(opened, { name: 'scratch.py', text: '' });
  assert.match((await shell.execute('save scratch.py')).output, /diunduh/);
  assert.deepStrictEqual(downloaded, { name: 'scratch.py', text: '' });
  assert.match((await shell.execute('pkg install python')).output, /bukan Termux/i);
  assert.match((await shell.execute('rm -rf /workspace')).output, /Error:/);
  assert.match((await shell.execute('rm /workspace/renamed.py')).output, /File dihapus/);
  assert.match((await shell.execute('cat /workspace/renamed.py')).output, /Error: File tidak ditemukan/);
  assert.strictEqual((await shell.execute('clear')).clear, true);
  assert.match((await shell.execute('help')).output, /python FILE\.py/);
  const messages = [], workerContext = {}; workerContext.self = workerContext; workerContext.postMessage = m => messages.push(m);
  vm.createContext(workerContext); vm.runInContext(jsWorker, workerContext);
  await new Promise(resolve => setTimeout(resolve, 15));
  assert.ok(messages.some(m => m.token === 'terminal-test-token' && /4/.test(m.output)), 'worker JavaScript harus mengirim balik output console');
  console.log('TES TERMINAL LULUS: UI editor asli tetap ada, CSP runner, path aman, workspace, operasi file, worker Python/JS, dan batas Termux.');
})().catch(err => { console.error(err); process.exitCode = 1; });
