/* FRANZZ Orbit terminal core.
 * A small in-browser workspace shell; it never runs a real OS shell or server-side commands.
 * File operations are confined to /workspace and parent traversal is blocked.
 */
(function (root) {
  'use strict';

  function tokenize(line) {
    var out = [], token = '', quote = '', escaped = false, started = false;
    line = String(line || '');
    for (var i = 0; i < line.length; i++) {
      var c = line.charAt(i);
      if (escaped) { token += c; escaped = false; started = true; continue; }
      if (c === '\\' && quote !== "'") { escaped = true; started = true; continue; }
      if (quote) { if (c === quote) quote = ''; else token += c; started = true; continue; }
      if (c === '"' || c === "'") { quote = c; started = true; continue; }
      if (/\s/.test(c)) { if (started) { out.push(token); token = ''; started = false; } continue; }
      token += c; started = true;
    }
    if (escaped) token += '\\';
    if (quote) throw new Error('Tanda kutip belum ditutup.');
    if (started) out.push(token);
    return out;
  }

  function resolvePath(cwd, input) {
    var value = String(input == null || input === '' ? '.' : input).replace(/\\/g, '/');
    if (/[\x00-\x1f\x7f]/.test(value)) throw new Error('Nama path tidak valid.');
    var absolute = value === '/workspace' || value.indexOf('/workspace/') === 0;
    if (value.charAt(0) === '/' && !absolute) throw new Error('Akses di luar /workspace ditolak.');
    if (value === '/workspace') return '/workspace';
    var base = absolute ? value.slice('/workspace/'.length) : (cwd === '/workspace' ? '' : cwd.slice('/workspace/'.length) + '/') + value;
    var stack = [];
    base.split('/').forEach(function (part) {
      if (!part || part === '.') return;
      if (part === '..') { if (!stack.length) throw new Error('Akses di luar /workspace ditolak.'); stack.pop(); return; }
      if (part.length > 180) throw new Error('Nama path terlalu panjang.');
      stack.push(part);
    });
    return '/workspace' + (stack.length ? '/' + stack.join('/') : '');
  }

  function create(options) {
    options = options || {};
    var files = Object.create(null), dirs = Object.create(null), cwd = '/workspace';
    dirs['/workspace'] = true;

    function ensureDir(path) {
      path = resolvePath(cwd, path);
      var bits = path.split('/').filter(Boolean), cur = '';
      bits.forEach(function (part) { cur += '/' + part; dirs[cur] = true; });
      dirs['/workspace'] = true;
      return path;
    }
    function writeFile(path, text) {
      path = resolvePath(cwd, path);
      if (path === '/workspace') throw new Error('Path harus berupa nama file.');
      var parent = path.slice(0, path.lastIndexOf('/')) || '/workspace';
      ensureDir(parent);
      files[path] = String(text == null ? '' : text);
      return path;
    }
    function readFile(path) {
      path = resolvePath(cwd, path);
      if (!Object.prototype.hasOwnProperty.call(files, path)) throw new Error('File tidak ditemukan: ' + path.slice('/workspace/'.length));
      return files[path];
    }
    function children(path) {
      path = resolvePath(cwd, path || '.');
      if (!dirs[path]) throw new Error('Direktori tidak ditemukan: ' + path);
      var prefix = path === '/workspace' ? '/workspace/' : path + '/', names = Object.create(null);
      Object.keys(files).forEach(function (p) {
        if (p.indexOf(prefix) !== 0) return;
        var tail = p.slice(prefix.length), part = tail.split('/')[0];
        if (part) names[part] = tail.indexOf('/') >= 0 || dirs[prefix + part] ? 'dir' : 'file';
      });
      Object.keys(dirs).forEach(function (p) {
        if (p.indexOf(prefix) !== 0) return;
        var tail = p.slice(prefix.length), part = tail.split('/')[0];
        if (part) names[part] = 'dir';
      });
      return Object.keys(names).sort().map(function (n) { return names[n] === 'dir' ? n + '/' : n; });
    }
    function isDir(path) { return !!dirs[resolvePath(cwd, path)]; }
    function isFile(path) { return Object.prototype.hasOwnProperty.call(files, resolvePath(cwd, path)); }
    function rmFile(path) {
      path = resolvePath(cwd, path);
      if (!Object.prototype.hasOwnProperty.call(files, path)) {
        if (dirs[path]) throw new Error('rm hanya menghapus file. Folder tidak dihapus.');
        throw new Error('File tidak ditemukan: ' + path.slice('/workspace/'.length));
      }
      delete files[path];
    }
    function safeEditorName(name) {
      name = String(name || '');
      return !!name && name !== '.' && name !== '..' && name.length <= 60 && !/[\\/\x00-\x1f\x7f]/.test(name);
    }
    function active() {
      var f = typeof options.getActiveFile === 'function' ? options.getActiveFile() : null;
      return f && { name: String(f.name || 'main.txt'), text: String(f.text || '') };
    }
    function resolveEditorPath(name) {
      var p = resolvePath(cwd, name);
      if (p.slice(0, '/workspace/'.length) !== '/workspace/' || p.slice('/workspace/'.length).indexOf('/') >= 0) {
        throw new Error('Editor hanya membuka file di /workspace. Pindahkan/copy file dari subfolder terlebih dahulu.');
      }
      return p;
    }
    function help() {
      return [
        'Perintah FRANZZ Shell (workspace browser):',
        'help  pwd  ls [-la] [DIR]  cd DIR  cat FILE  echo TEKS  date  whoami  uname',
        'mkdir DIR  touch FILE  rm FILE  cp SUMBER TUJUAN  mv SUMBER TUJUAN',
        'head [-n N] FILE  tail [-n N] FILE  grep TEKS FILE  wc FILE  find [DIR]',
        'nano FILE / open FILE  run  python FILE.py  python -c "print(2 + 2)"  node FILE.js  save [FILE]  clear',
        'Python dijalankan dengan Pyodide di Web Worker terisolasi. JavaScript memakai worker sandbox.',
        'Bukan Termux/Linux penuh: tidak ada pkg/apt, root, shell server, atau modul Node.js native.'
      ].join('\n');
    }

    async function execute(line) {
      var raw = String(line || '').trim();
      if (!raw) return { output: '' };
      var parts = tokenize(raw), cmd = parts[0], args = parts.slice(1), path, text;
      try {
        if (cmd === 'help') return { output: help() };
        if (cmd === 'pwd') return { output: cwd };
        if (cmd === 'whoami') return { output: 'franzz-user (browser sandbox)' };
        if (cmd === 'uname') return { output: 'FRANZZ Orbit Web Workspace / browser sandbox' };
        if (cmd === 'date') return { output: new Date().toString() };
        if (cmd === 'echo') return { output: args.join(' ') };
        if (cmd === 'clear') return { output: '', clear: true };
        if (cmd === 'ls') {
          var dirArg = args.filter(function (a) { return a.charAt(0) !== '-'; })[0] || '.';
          var list = children(dirArg);
          return { output: list.join('\n') || '(folder kosong)' };
        }
        if (cmd === 'cd') {
          if (args.length > 1) throw new Error('Gunakan cd [DIR].');
          path = resolvePath(cwd, args[0] || '/workspace');
          if (!dirs[path]) throw new Error('Direktori tidak ditemukan: ' + path);
          cwd = path; return { output: cwd };
        }
        if (cmd === 'cat') {
          if (args.length !== 1) throw new Error('Gunakan cat FILE.');
          return { output: readFile(args[0]) };
        }
        if (cmd === 'mkdir') {
          if (!args.length) throw new Error('Gunakan mkdir DIR.');
          args.forEach(ensureDir); return { output: 'Folder dibuat: ' + args.join(', ') };
        }
        if (cmd === 'touch') {
          if (!args.length) throw new Error('Gunakan touch FILE.');
          args.forEach(function (name) { path = resolvePath(cwd, name); if (dirs[path]) throw new Error('Path sudah berupa folder.'); if (!Object.prototype.hasOwnProperty.call(files, path)) writeFile(path, ''); });
          return { output: 'File siap: ' + args.join(', ') };
        }
        if (cmd === 'rm') {
          if (args.length !== 1 || args[0].indexOf('-') === 0) throw new Error('Gunakan rm FILE. Folder dan opsi destruktif tidak didukung.');
          rmFile(args[0]); return { output: 'File dihapus dari workspace: ' + args[0] };
        }
        if (cmd === 'cp' || cmd === 'mv') {
          if (args.length !== 2) throw new Error('Gunakan ' + cmd + ' SUMBER TUJUAN.');
          var from = resolvePath(cwd, args[0]), to = resolvePath(cwd, args[1]);
          if (!Object.prototype.hasOwnProperty.call(files, from)) throw new Error('File sumber tidak ditemukan: ' + args[0]);
          if (dirs[to]) to = resolvePath(to, from.split('/').pop());
          if (from === to) throw new Error('Sumber dan tujuan sama.');
          writeFile(to, files[from]); if (cmd === 'mv') delete files[from];
          return { output: (cmd === 'cp' ? 'File disalin: ' : 'File dipindahkan: ') + to };
        }
        if (cmd === 'head' || cmd === 'tail') {
          if (!args.length) throw new Error('Gunakan ' + cmd + ' [-n JUMLAH] FILE.');
          var hi = args.indexOf('-n'), count = hi >= 0 ? Number(args[hi + 1]) : 10, fileArg = args[args.length - 1];
          if (hi >= 0 && (!Number.isInteger(count) || count < 1 || count > 500)) throw new Error('Jumlah baris harus 1–500.');
          if (hi >= 0 && hi + 2 >= args.length) throw new Error('Nama file belum diisi.');
          var lines = readFile(fileArg).split(/\r?\n/); if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
          return { output: (cmd === 'head' ? lines.slice(0, count) : lines.slice(-count)).join('\n') };
        }
        if (cmd === 'grep') {
          if (args.length < 2) throw new Error('Gunakan grep TEKS FILE.');
          var needle = args.slice(0, -1).join(' '), grepped = readFile(args[args.length - 1]).split(/\r?\n/).filter(function (s) { return s.indexOf(needle) >= 0; });
          return { output: grepped.join('\n') || '(tidak ada baris cocok)' };
        }
        if (cmd === 'wc') {
          if (args.length !== 1) throw new Error('Gunakan wc FILE.');
          text = readFile(args[0]);
          return { output: (text ? text.split(/\r?\n/).length : 0) + ' ' + (text.trim() ? text.trim().split(/\s+/).length : 0) + ' ' + text.length + ' ' + args[0] };
        }
        if (cmd === 'find') {
          path = resolvePath(cwd, args[0] || '.'); if (!dirs[path]) throw new Error('Direktori tidak ditemukan: ' + path);
          var prefix = path === '/workspace' ? '/workspace/' : path + '/';
          var matches = Object.keys(files).concat(Object.keys(dirs).filter(function (p) { return p !== '/workspace'; })).filter(function (p) { return p.indexOf(prefix) === 0; }).sort();
          return { output: matches.join('\n') || '(tidak ada file)' };
        }
        if (cmd === 'nano' || cmd === 'open') {
          if (args.length !== 1) throw new Error('Gunakan nano NAMA_FILE.');
          path = resolveEditorPath(args[0]); if (!Object.prototype.hasOwnProperty.call(files, path)) writeFile(path, '');
          if (typeof options.openFile !== 'function') throw new Error('Editor tidak tersedia.');
          await options.openFile(path.slice('/workspace/'.length), files[path]);
          return { output: 'Terbuka di editor: ' + path.slice('/workspace/'.length) };
        }
        if (cmd === 'save') {
          var current = active(), name = args[0] || (current && current.name) || 'file.txt';
          path = resolvePath(cwd, name);
          if (!Object.prototype.hasOwnProperty.call(files, path)) {
            if (current && (name === current.name || path === resolvePath('/workspace', current.name))) writeFile(path, current.text);
            else throw new Error('File tidak ditemukan: ' + name);
          }
          if (typeof options.downloadFile !== 'function') throw new Error('Unduh file tidak tersedia.');
          await options.downloadFile(path.slice('/workspace/'.length).split('/').pop(), files[path]);
          return { output: 'File diunduh: ' + path.slice('/workspace/'.length) };
        }
        if (cmd === 'python' || cmd === 'python3') {
          if (args[0] === '--version' || args[0] === '-V') return { output: 'Python melalui Pyodide (runtime browser; internet diperlukan saat pertama kali).' };
          var pyCode, pyName;
          if (args[0] === '-c') {
            pyCode = args.slice(1).join(' '); if (!pyCode) throw new Error('Gunakan python -c "print(2 + 2)".'); pyName = '<command>';
          } else {
            var pyFile = args[0] || (active() && active().name);
            if (!pyFile) throw new Error('Pilih file Python atau gunakan python -c "print(2 + 2)".');
            path = resolvePath(cwd, pyFile);
            pyCode = Object.prototype.hasOwnProperty.call(files, path) ? files[path] : null;
            if (pyCode == null) { var a = active(); if (a && (pyFile === a.name || path === resolvePath('/workspace', a.name))) pyCode = a.text; }
            if (pyCode == null) throw new Error('File Python tidak ditemukan: ' + pyFile);
            pyName = pyFile;
          }
          if (typeof options.runPython !== 'function') throw new Error('Runner Python tidak tersedia di browser ini.');
          return { output: await options.runPython(pyCode, pyName) };
        }
        if (cmd === 'node' || cmd === 'nodejs') {
          if (args[0] === '--version' || args[0] === '-v') return { output: 'Runner JavaScript browser tersedia; bukan Node.js penuh dan modul Node tidak tersedia.' };
          var jsCode, jsName;
          if (args[0] === '-e' || args[0] === '-c') { jsCode = args.slice(1).join(' '); if (!jsCode) throw new Error('Gunakan node -e "console.log(2 + 2)".'); jsName = '<command>'; }
          else {
            jsName = args[0] || (active() && active().name);
            if (!jsName) throw new Error('Gunakan node FILE.js atau node -e "console.log(2+2)".');
            path = resolvePath(cwd, jsName); jsCode = Object.prototype.hasOwnProperty.call(files, path) ? files[path] : null;
            if (jsCode == null) { var b = active(); if (b && (jsName === b.name || path === resolvePath('/workspace', b.name))) jsCode = b.text; }
            if (jsCode == null) throw new Error('File JavaScript tidak ditemukan: ' + jsName);
          }
          if (typeof options.runJavaScript !== 'function') throw new Error('Runner JavaScript tidak tersedia.');
          return { output: await options.runJavaScript(jsCode, jsName) };
        }
        if (cmd === 'run') {
          var f = active(); if (!f) throw new Error('Tidak ada file yang terbuka.');
          var ext = /\.([a-z0-9]+)$/i.exec(f.name), e = ext ? ext[1].toLowerCase() : '';
          if (e === 'py') return { output: await options.runPython(f.text, f.name) };
          if (['js', 'mjs', 'cjs'].indexOf(e) >= 0) return { output: await options.runJavaScript(f.text, f.name) };
          if (['html', 'htm'].indexOf(e) >= 0) return { output: await options.runPreview() };
          throw new Error('Runner lokal tidak mendukung .' + (e || 'tanpa-ekstensi') + '. AI tetap bisa membuat dan menjelaskan kode; jalankan dengan runtime yang sesuai.');
        }
        if (cmd === 'apt' || cmd === 'pkg' || cmd === 'sudo' || cmd === 'su') throw new Error('Perintah ini tidak tersedia: shell web bukan Termux/Linux penuh dan tidak memiliki root/package manager.');
        throw new Error('Perintah tidak dikenal: ' + cmd + '. Ketik help untuk daftar perintah.');
      } catch (err) { return { output: 'Error: ' + String(err && err.message || err), error: true }; }
    }

    return {
      execute: execute,
      writeFile: writeFile,
      readFile: readFile,
      isFile: isFile,
      isDir: isDir,
      resolvePath: function (path) { return resolvePath(cwd, path); },
      setCwd: function (path) { path = resolvePath(cwd, path); if (!dirs[path]) throw new Error('Direktori tidak ditemukan: ' + path); cwd = path; },
      getCwd: function () { return cwd; },
      syncEditorFile: function (name, text) { if (safeEditorName(name)) writeFile('/workspace/' + name, text); },
      syncEditorFiles: function (list, activeIndex, activeText) {
        (list || []).forEach(function (f, i) { if (f && safeEditorName(f.name)) writeFile('/workspace/' + f.name, i === activeIndex ? activeText : f.text); });
      },
      listFiles: function () { return Object.keys(files).sort(); }
    };
  }

  var api = { tokenize: tokenize, resolvePath: resolvePath, create: create };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.OrbitShell = api;
})(typeof window !== 'undefined' ? window : this);
