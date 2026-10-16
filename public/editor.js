/* Editor Kode FRANZZ Orbit. Tanpa library luar (CSP hanya mengizinkan skrip dari situs sendiri).
   Textarea transparan di atas lapisan <pre> berwarna: pengetikan, undo/redo, dan keyboard ponsel tetap asli browser.
   Teks apa pun yang masuk ke HTML sudah di-escape lebih dulu; jawaban AI hanya lewat textContent. */
(function (root) {
  'use strict';

  // ------------------------------------------------------------------ pewarna sintaks
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  var JS_KW = 'async await break case catch class const continue debugger default delete do else export extends finally for from function get if import in instanceof let new of return set static super switch this throw try typeof var void while with yield null true false undefined NaN';
  var TS_KW = JS_KW + ' interface type enum implements namespace declare readonly private public protected abstract as is keyof';
  var P = {
    lc: '\\/\\/[^\\n]*', bc: '\\/\\*[\\s\\S]*?(?:\\*\\/|$)', hash: '#[^\\n]*', dash: '--[^\\n]*',
    s2: '"(?:\\\\.|[^"\\\\\\n])*"?', s1: "'(?:\\\\.|[^'\\\\\\n])*'?", bt: '`(?:\\\\[\\s\\S]|[^`\\\\])*`?',
    num: '\\b(?:0x[\\da-fA-F]+|\\d+\\.?\\d*(?:[eE][+-]?\\d+)?)\\b',
    fn: '\\b[A-Za-z_$][\\w$]*(?=\\s*\\()', ty: '\\b[A-Z][\\w$]*\\b'
  };
  function kw(list) { return '\\b(?:' + list.trim().split(/\s+/).join('|') + ')\\b'; }
  function make(parts, flags) {
    return { re: new RegExp(parts.map(function (p) { return '(' + p[1] + ')'; }).join('|'), flags || 'g'), cls: parts.map(function (p) { return p[0]; }) };
  }
  function run(L, text) {
    var re = L.re, out = '', last = 0, m;
    re.lastIndex = 0;
    while ((m = re.exec(text))) {
      if (m[0] === '') { re.lastIndex++; continue; }
      if (m.index > last) out += esc(text.slice(last, m.index));
      var k = 1; while (k < m.length && m[k] === undefined) k++;
      out += '<span class="t-' + L.cls[k - 1] + '">' + esc(m[0]) + '</span>';
      last = m.index + m[0].length;
    }
    return out + esc(text.slice(last));
  }
  function cfamily(words, extra) {
    return make([['cm', P.lc], ['cm', P.bc]].concat(extra || [], [['st', P.s2], ['st', P.s1], ['nm', P.num], ['kw', kw(words)], ['fn', P.fn], ['ty', P.ty]]));
  }
  var LANGS = {
    js: cfamily(JS_KW, [['st', P.bt]]),
    ts: cfamily(TS_KW, [['st', P.bt]]),
    json: make([['pr', '"(?:\\\\.|[^"\\\\\\n])*"(?=\\s*:)'], ['st', P.s2], ['nm', '-?\\b\\d+\\.?\\d*(?:[eE][+-]?\\d+)?\\b'], ['kw', '\\b(?:true|false|null)\\b']]),
    java: cfamily('abstract boolean break byte case catch char class const continue default do double else enum extends final finally float for if implements import instanceof int interface long new null package private protected public return short static super switch this throw throws try void volatile while true false var val fun'),
    c: cfamily('auto bool break case catch char class const continue default delete do double else enum explicit extern false float for goto if inline int long namespace new nullptr private protected public register return short signed sizeof static struct switch template this throw true try typedef typename union unsigned using virtual void volatile while string var'),
    go: cfamily('break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var nil true false', [['st', P.bt]]),
    rs: cfamily('as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while'),
    dart: cfamily('abstract as async await break case catch class const continue default do dynamic else enum extends false final finally for get if implements import in is late new null on required return set static super switch this throw true try var void while with yield'),
    php: cfamily('abstract and array as break case catch class clone const continue declare default do echo else elseif empty endforeach endif endwhile extends final finally fn for foreach function global if implements include include_once instanceof interface isset list match namespace new null or print private protected public require require_once return static switch throw trait true false try unset use var while yield', [['cm', P.hash], ['pr', '\\$[A-Za-z_]\\w*']]),
    py: make([['cm', P.hash], ['st', '"""[\\s\\S]*?(?:"""|$)'], ['st', "'''[\\s\\S]*?(?:'''|$)"], ['st', P.s2], ['st', P.s1], ['nm', P.num], ['kw', kw('and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield None True False self')], ['fn', P.fn], ['ty', P.ty]]),
    sh: make([['cm', P.hash], ['st', P.s2], ['st', P.s1], ['pr', '\\$\\{?[A-Za-z_]\\w*\\}?'], ['kw', kw('if then else elif fi for while do done case esac function in return echo export local cd exit source')], ['nm', P.num]]),
    yml: make([['cm', P.hash], ['pr', '^[ \\t-]*[\\w.-]+(?=\\s*:)'], ['st', P.s2], ['st', P.s1], ['kw', '\\b(?:true|false|null|yes|no)\\b'], ['nm', P.num]], 'gm'),
    sql: make([['cm', P.dash], ['cm', P.bc], ['st', P.s1], ['nm', P.num], ['kw', kw('select from where insert into values update set delete create table alter drop index join left right inner outer on as and or not null primary key foreign references order by group having limit offset distinct union all count sum avg min max like in is between case when then else end default unique auto_increment if exists')], ['fn', P.fn]], 'gi'),
    md: make([['kw', '^#{1,6}[^\\n]*'], ['st', '`[^`\\n]+`'], ['fn', '\\*\\*[^*\\n]+\\*\\*'], ['cm', '^>[^\\n]*']], 'gm'),
    css: make([['cm', P.bc], ['st', P.s2], ['st', P.s1], ['kw', '@[\\w-]+'], ['nm', '#[\\da-fA-F]{3,8}\\b'], ['ty', '[.#][A-Za-z_-][\\w-]*'], ['pr', '[a-z-]+(?=\\s*:\\s*[^;{}\\n]*[;}])'], ['nm', '-?\\b\\d*\\.?\\d+(?:px|em|rem|%|vh|vw|vmin|vmax|ms|s|deg|fr)?'], ['fn', P.fn]])
  };

  function tagHtml(tag) {
    var m = /^(<\/?)([\w:-]+)([\s\S]*?)(\/?>)$/.exec(tag);
    if (!m) return esc(tag);
    var attrs = '', last = 0, a, re = /([^\s=\/>"']+)(\s*=\s*)?("[^"]*"|'[^']*'|[^\s"'>]+)?/g, body = m[3];
    while ((a = re.exec(body))) {
      if (a[0] === '') { re.lastIndex++; continue; }
      attrs += esc(body.slice(last, a.index)) + '<span class="t-at">' + esc(a[1]) + '</span>' + esc(a[2] || '') + (a[3] ? '<span class="t-st">' + esc(a[3]) + '</span>' : '');
      last = a.index + a[0].length;
    }
    attrs += esc(body.slice(last));
    return '<span class="t-tg">' + esc(m[1] + m[2]) + '</span>' + attrs + '<span class="t-tg">' + esc(m[4]) + '</span>';
  }
  var HTML_RE = /<!--[\s\S]*?(?:-->|$)|(<script\b[^>]*>)([\s\S]*?)(<\/script>|$)|(<style\b[^>]*>)([\s\S]*?)(<\/style>|$)|<\/?[A-Za-z][^<>]*>|&[#\w]+;/gi;
  function highlightHtml(text) {
    var out = '', last = 0, m;
    HTML_RE.lastIndex = 0;
    while ((m = HTML_RE.exec(text))) {
      if (m[0] === '') { HTML_RE.lastIndex++; continue; }
      if (m.index > last) out += esc(text.slice(last, m.index));
      var s = m[0];
      if (s.charAt(0) === '&') out += '<span class="t-nm">' + esc(s) + '</span>';
      else if (s.slice(0, 4) === '<!--') out += '<span class="t-cm">' + esc(s) + '</span>';
      else if (m[1] !== undefined) out += tagHtml(m[1]) + highlight(m[2], 'js') + (m[3] ? tagHtml(m[3]) : '');
      else if (m[4] !== undefined) out += tagHtml(m[4]) + highlight(m[5], 'css') + (m[6] ? tagHtml(m[6]) : '');
      else out += tagHtml(s);
      last = m.index + s.length;
    }
    return out + esc(text.slice(last));
  }
  function highlight(text, lang) {
    if (lang === 'html') return highlightHtml(text);
    var L = LANGS[lang];
    return L ? run(L, text) : esc(text);
  }

  var EXT = { js: 'js', mjs: 'js', cjs: 'js', jsx: 'js', ts: 'ts', tsx: 'ts', json: 'json', html: 'html', htm: 'html', ejs: 'html', xml: 'html', svg: 'html', vue: 'html', css: 'css', scss: 'css', php: 'php', py: 'py', java: 'java', kt: 'java', c: 'c', h: 'c', cpp: 'c', cs: 'c', go: 'go', rs: 'rs', dart: 'dart', sql: 'sql', sh: 'sh', bash: 'sh', yml: 'yml', yaml: 'yml', md: 'md' };
  function langOf(name) { var m = /\.([A-Za-z0-9]+)$/.exec(String(name || '')); return m ? (EXT[m[1].toLowerCase()] || '') : ''; }
  var AI_EXT = { javascript: 'js', js: 'js', node: 'js', typescript: 'ts', ts: 'ts', html: 'html', css: 'css', json: 'json', python: 'py', py: 'py', php: 'php', java: 'java', kotlin: 'kt', c: 'c', cpp: 'cpp', 'c++': 'cpp', csharp: 'cs', cs: 'cs', go: 'go', rust: 'rs', dart: 'dart', sql: 'sql', bash: 'sh', sh: 'sh', yaml: 'yml', yml: 'yml', markdown: 'md', xml: 'xml', jsx: 'jsx', tsx: 'tsx' };
  var COMMENT = { js: ['// '], ts: ['// '], java: ['// '], c: ['// '], go: ['// '], rs: ['// '], dart: ['// '], php: ['// '], py: ['# '], sh: ['# '], yml: ['# '], sql: ['-- '], html: ['<!-- ', ' -->'], css: ['/* ', ' */'] };

  // ------------------------------------------------------------------ pratinjau
  var CAPTURE = '<script>(function(){var P=function(t,a){try{parent.postMessage({orbitRun:1,t:t,m:Array.prototype.map.call(a,function(x){try{return typeof x==="string"?x:JSON.stringify(x)}catch(e){return String(x)}}).join(" ")},"*")}catch(e){}};["log","info","warn","error"].forEach(function(k){var o=console[k];console[k]=function(){P(k,arguments);try{o.apply(console,arguments)}catch(e){}}});window.addEventListener("error",function(e){P("error",[e.message+(e.lineno?" (baris "+e.lineno+")":"")])});window.addEventListener("unhandledrejection",function(e){P("error",["Promise ditolak: "+(e.reason&&e.reason.message||e.reason)])});})();<\/script>';
  function inlineAssets(html, files) {
    var byName = {}; files.forEach(function (f) { byName[f.name] = f.text; });
    html = html.replace(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi, function (all, href) {
      return /stylesheet/i.test(all) && Object.prototype.hasOwnProperty.call(byName, href) ? '<style>' + byName[href].replace(/<\/style/gi, '<\\/style') + '</style>' : all;
    });
    return html.replace(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>\s*<\/script>/gi, function (all, src) {
      return Object.prototype.hasOwnProperty.call(byName, src) ? '<script>' + byName[src].replace(/<\/script/gi, '<\\/script') + '<\/script>' : all;
    });
  }
  function buildPreview(file, files) {
    var lang = langOf(file.name);
    if (lang === 'html') {
      var h = inlineAssets(file.text, files);
      return /<head[^>]*>/i.test(h) ? h.replace(/<head[^>]*>/i, function (t) { return t + CAPTURE; }) : CAPTURE + h;
    }
    if (lang === 'js') return '<!doctype html><meta charset="utf-8">' + CAPTURE + '<body><script>' + file.text.replace(/<\/script/gi, '<\\/script') + '<\/script>';
    return null;
  }

  var SAMPLE = '<!doctype html>\n<html lang="id">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>Halo Orbit</title>\n  <style>\n    body { font-family: system-ui, sans-serif; padding: 24px; }\n    button { padding: 10px 16px; border-radius: 10px; border: 0; background: #7B3FE4; color: #fff; }\n  </style>\n</head>\n<body>\n  <h1>Halo dari Editor Kode</h1>\n  <button id="btn">Klik saya</button>\n  <script>\n    var n = 0;\n    document.getElementById("btn").addEventListener("click", function () {\n      n++;\n      console.log("Diklik " + n + " kali");\n    });\n  </script>\n</body>\n</html>\n';

  // ------------------------------------------------------------------ antarmuka (hanya di browser)
  function init(h) {
    var $ = function (s) { return document.querySelector(s); };
    var el = h.el;
    var dlg = $('#codedlg'), ta = $('#ce-ta'), hlEl = $('#ce-hl'), mk = $('#ce-mk'), gut = $('#ce-gut'), wrap = $('#ce-wrap');
    var IND = '  ', FILES = [], ACT = 0, loaded = false, saveT = 0, rafT = 0, guard = false, lastLines = 0, lastLang = null;
    var OPEN = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'", '`': '`' }, CLOSE = ')]}"\'`';

    // ---- penyimpanan lokal (hanya di browser ini)
    function load() {
      try {
        var j = JSON.parse(localStorage.getItem('orbit_code') || 'null');
        if (j && Array.isArray(j.files) && j.files.length) {
          FILES = j.files.slice(0, 30).map(function (f) { return { name: String((f && f.name) || 'file.txt').slice(0, 60), text: String((f && f.text) || '') }; });
          ACT = Math.min(Math.max(0, j.act | 0), FILES.length - 1);
        }
      } catch (e) {}
      if (!FILES.length) { FILES = [{ name: 'index.html', text: SAMPLE }]; ACT = 0; }
    }
    function persist() {
      clearTimeout(saveT);
      try { localStorage.setItem('orbit_code', JSON.stringify({ files: FILES, act: ACT })); stat('Tersimpan di browser ini'); return true; }
      catch (e) { stat('Penyimpanan browser penuh. Unduh file supaya tidak hilang.'); return false; }
    }
    function later() { clearTimeout(saveT); saveT = setTimeout(persist, 500); }
    var statMsg = '';
    function stat(msg) { statMsg = msg || ''; pos(); }
    function pos() {
      var v = ta.value, s = ta.selectionStart, ln = v.slice(0, s).split('\n'), f = FILES[ACT];
      $('#ce-stat').textContent = 'Baris ' + ln.length + ', Kol ' + (ln[ln.length - 1].length + 1) + ' • ' + (langOf(f && f.name) || 'teks') + ' • ' + v.split('\n').length + ' baris' + (statMsg ? ' • ' + statMsg : '');
    }

    // ---- render lapisan warna + nomor baris
    function render() {
      rafT = 0;
      var v = ta.value, f = FILES[ACT], lang = langOf(f && f.name);
      hlEl.innerHTML = (v.length < 400000 ? highlight(v, lang) : esc(v)) + '\n ';
      var n = v.split('\n').length;
      if (n !== lastLines) { var a = []; for (var i = 1; i <= n; i++) a.push(i); gut.textContent = a.join('\n') + '\n '; lastLines = n; }
      marks(); sync(); pos();
    }
    function schedule() { if (!rafT) rafT = requestAnimationFrame(render); }
    function sync() {
      hlEl.scrollTop = ta.scrollTop; hlEl.scrollLeft = ta.scrollLeft; mk.scrollTop = ta.scrollTop; mk.scrollLeft = ta.scrollLeft; gut.scrollTop = ta.scrollTop;
    }
    ta.addEventListener('scroll', sync);
    ta.addEventListener('input', function () { FILES[ACT].text = ta.value; later(); schedule(); if (!$('#ce-find').classList.contains('hide')) findAll(false); });
    document.addEventListener('selectionchange', function () { if (document.activeElement === ta) pos(); });

    // ---- menyisipkan teks lewat perintah browser supaya undo/redo tetap bekerja
    function ins(txt) {
      guard = true;
      try {
        ta.focus({ preventScroll: true });
        var ok = false;
        try { ok = document.execCommand('insertText', false, txt); } catch (e) {}
        if (!ok) { ta.setRangeText(txt, ta.selectionStart, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input', { bubbles: true })); }
      } finally { guard = false; }
    }
    function del() {
      guard = true;
      try { var ok = false; try { ok = document.execCommand('delete'); } catch (e) {} if (!ok) { ta.setRangeText('', ta.selectionStart, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input', { bubbles: true })); } }
      finally { guard = false; }
    }
    function replaceRange(s, e, txt, selS, selE) {
      ta.setSelectionRange(s, e); ins(txt);
      if (selS !== undefined) ta.setSelectionRange(selS, selE === undefined ? selS : selE);
    }
    function lineBounds(v, s, e) {
      var ls = v.lastIndexOf('\n', s - 1) + 1, le = e > s && v.charAt(e - 1) === '\n' ? e - 1 : e;
      var nl = v.indexOf('\n', le); return [ls, nl < 0 ? v.length : nl];
    }
    function indentLines(out) {
      var v = ta.value, s = ta.selectionStart, e = ta.selectionEnd, b = lineBounds(v, s, e), blk = v.slice(b[0], b[1]);
      var nb = blk.split('\n').map(function (ln) {
        if (!out) return ln.length || blk.indexOf('\n') < 0 ? IND + ln : ln;
        return ln.replace(/^(?: {1,2}|\t)/, '');
      }).join('\n');
      if (nb === blk) return;
      replaceRange(b[0], b[1], nb, b[0], b[0] + nb.length);
    }
    function toggleComment() {
      var f = FILES[ACT], c = COMMENT[langOf(f.name)];
      if (!c) { stat('Komentar belum didukung untuk jenis file ini'); return; }
      var v = ta.value, s = ta.selectionStart, e = ta.selectionEnd, b = lineBounds(v, s, e), lines = v.slice(b[0], b[1]).split('\n');
      var live = lines.filter(function (l) { return l.trim(); });
      var on = live.length && live.every(function (l) { var t = l.trim(); return t.indexOf(c[0].trim()) === 0 && (!c[1] || t.slice(-c[1].trim().length) === c[1].trim()); });
      var nb = lines.map(function (l) {
        if (!l.trim()) return l;
        var ind = /^\s*/.exec(l)[0], body = l.slice(ind.length);
        if (on) { body = body.slice(c[0].trim().length).replace(/^ /, ''); if (c[1]) body = body.replace(new RegExp(' ?' + c[1].trim().replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&') + '$'), ''); return ind + body; }
        return ind + c[0] + body + (c[1] || '');
      }).join('\n');
      replaceRange(b[0], b[1], nb, b[0], b[0] + nb.length);
    }

    ta.addEventListener('beforeinput', function (ev) {
      if (guard) return;
      var t = ev.inputType, v = ta.value, s = ta.selectionStart, e = ta.selectionEnd, lang = langOf(FILES[ACT].name);
      if (t === 'insertText' && ev.data && ev.data.length === 1) {
        var c = ev.data, nx = v.charAt(e);
        if (s === e && CLOSE.indexOf(c) >= 0 && nx === c) { ev.preventDefault(); ta.setSelectionRange(s + 1, s + 1); return; }
        if (Object.prototype.hasOwnProperty.call(OPEN, c)) {
          var q = c === '"' || c === "'" || c === '`', cl = OPEN[c];
          if (s !== e) { ev.preventDefault(); var sel = v.slice(s, e); ins(c + sel + cl); ta.setSelectionRange(s + 1, s + 1 + sel.length); return; }
          if (q && /[\w]/.test(v.charAt(s - 1))) return; // mis. don't
          if (/[\w$]/.test(nx)) return;
          if (lang === 'html' && c === "'") return;
          ev.preventDefault(); ins(c + cl); ta.setSelectionRange(s + 1, s + 1);
        }
      } else if (t === 'insertLineBreak' || t === 'insertParagraph') {
        ev.preventDefault();
        var ls = v.lastIndexOf('\n', s - 1) + 1, line = v.slice(ls, s), ind = /^[ \t]*/.exec(line)[0], pv = v.charAt(s - 1), n2 = v.charAt(e);
        if (s === e && ((pv === '{' && n2 === '}') || (pv === '[' && n2 === ']') || (pv === '(' && n2 === ')'))) {
          ins('\n' + ind + IND + '\n' + ind); var p = s + 1 + ind.length + IND.length; ta.setSelectionRange(p, p);
        } else {
          var more = /[{(\[]$/.test(line.trim()) || ((lang === 'py' || lang === 'yml') && /:$/.test(line.trim())) ? IND : '';
          ins('\n' + ind + more);
        }
      } else if (t === 'deleteContentBackward' && s === e && s > 0) {
        var pc = v.charAt(s - 1);
        if (Object.prototype.hasOwnProperty.call(OPEN, pc) && OPEN[pc] === v.charAt(s)) { ev.preventDefault(); ta.setSelectionRange(s - 1, s + 1); del(); }
      }
    });
    ta.addEventListener('keydown', function (ev) {
      var k = ev.key, mod = ev.ctrlKey || ev.metaKey;
      if (k === 'Tab' && !mod && !ev.altKey) {
        ev.preventDefault();
        if (ev.shiftKey) indentLines(true);
        else if (ta.selectionStart !== ta.selectionEnd && ta.value.slice(ta.selectionStart, ta.selectionEnd).indexOf('\n') >= 0) indentLines(false);
        else ins(IND);
      } else if (mod && (k === 's' || k === 'S')) { ev.preventDefault(); persist(); }
      else if (mod && (k === 'f' || k === 'F')) { ev.preventDefault(); showFind(true); }
      else if (mod && k === 'Enter') { ev.preventDefault(); runPreview(); }
      else if (mod && k === '/') { ev.preventDefault(); toggleComment(); }
    });

    // ---- berkas dan tab
    function tabs() {
      var box = $('#ce-tabs'); box.textContent = '';
      FILES.forEach(function (f, i) {
        var t = el('div', 'ce-tab' + (i === ACT ? ' on' : '')), n = el('button', 'ce-tn', f.name), x = el('button', 'ce-tx', '×');
        n.type = 'button'; x.type = 'button'; x.setAttribute('aria-label', 'Tutup ' + f.name); n.setAttribute('role', 'tab'); n.setAttribute('aria-selected', i === ACT ? 'true' : 'false');
        n.addEventListener('click', function () {
          if (i !== ACT) { select(i); return; }
          var nm = prompt('Nama file:', f.name); nm = nm && nm.trim().replace(/[\\/:*?"<>|]/g, '').slice(0, 60);
          if (nm) { f.name = nm; lastLang = null; tabs(); render(); later(); }
        });
        x.addEventListener('click', function () { closeFile(i); });
        t.appendChild(n); t.appendChild(x); box.appendChild(t);
      });
      var on = box.querySelector('.on'); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    function select(i) { FILES[ACT].text = ta.value; ACT = Math.max(0, Math.min(FILES.length - 1, i)); ta.value = FILES[ACT].text; ta.scrollTop = 0; ta.scrollLeft = 0; tabs(); lastLines = 0; render(); persist(); }
    function newFile(name, text) {
      if (FILES.length >= 30) { stat('Maksimal 30 file'); return; }
      FILES[ACT].text = ta.value;
      FILES.push({ name: name || 'baru-' + (FILES.length + 1) + '.js', text: text || '' }); ACT = FILES.length - 1;
      ta.value = FILES[ACT].text; tabs(); lastLines = 0; render(); persist(); ta.focus();
    }
    function closeFile(i) {
      var f = FILES[i]; if (i === ACT) f.text = ta.value;
      if (f.text.trim() && !confirm('Tutup ' + f.name + '? Isinya hilang dari editor kalau belum kamu unduh.')) return;
      FILES.splice(i, 1);
      if (!FILES.length) FILES.push({ name: 'baru.txt', text: '' });
      if (ACT >= FILES.length) ACT = FILES.length - 1; else if (i < ACT) ACT--;
      ta.value = FILES[ACT].text; tabs(); lastLines = 0; render(); persist();
    }
    function download() {
      var f = FILES[ACT]; f.text = ta.value;
      var a = document.createElement('a'), url = URL.createObjectURL(new Blob([f.text], { type: 'text/plain;charset=utf-8' }));
      a.href = url; a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      stat('Diunduh: ' + f.name);
    }
    function openLocal(files) {
      Array.prototype.slice.call(files || [], 0, 10).forEach(function (file) {
        if (file.size > 500000) { stat(file.name + ' terlalu besar (maks 500 KB)'); return; }
        var r = new FileReader();
        r.onload = function () {
          var tx = String(r.result || '');
          if (tx.indexOf('\u0000') >= 0) { stat(file.name + ' bukan file teks'); return; }
          newFile(file.name.slice(0, 60), tx);
        };
        r.onerror = function () { stat('Gagal membaca ' + file.name); };
        r.readAsText(file);
      });
    }

    // ---- cari dan ganti (lapisan <mark> di belakang teks)
    var M = [], MI = -1, caseSens = false;
    function showFind(on) {
      var f = $('#ce-find'); f.classList.toggle('hide', !on);
      if (on) {
        var sel = ta.value.slice(ta.selectionStart, ta.selectionEnd);
        if (sel && sel.indexOf('\n') < 0) $('#ce-q').value = sel;
        $('#ce-q').focus(); $('#ce-q').select(); findAll(true);
      } else { M = []; MI = -1; marks(); ta.focus(); }
    }
    function findAll(jump) {
      var q = $('#ce-q').value, v = ta.value; M = []; MI = -1;
      if (q) {
        var hay = caseSens ? v : v.toLowerCase(), nd = caseSens ? q : q.toLowerCase(), i = 0;
        while (M.length < 5000 && (i = hay.indexOf(nd, i)) >= 0) { M.push(i); i += Math.max(1, nd.length); }
      }
      if (M.length) {
        var from = ta.selectionStart; MI = 0;
        for (var k = 0; k < M.length; k++) if (M[k] >= from) { MI = k; break; }
        if (jump) goMatch(MI, false);
      }
      marks(); counter();
    }
    function counter() { $('#ce-cnt').textContent = $('#ce-q').value ? (M.length ? (MI + 1) + '/' + M.length : 'Tidak ada') : ''; }
    function marks() {
      var q = $('#ce-q').value;
      if ($('#ce-find').classList.contains('hide') || !q || !M.length) { mk.textContent = ''; return; }
      var v = ta.value, out = '', last = 0;
      M.forEach(function (s, i) { out += esc(v.slice(last, s)) + '<mark' + (i === MI ? ' class="cur"' : '') + '>' + esc(v.slice(s, s + q.length)) + '</mark>'; last = s + q.length; });
      mk.innerHTML = out + esc(v.slice(last)) + '\n '; sync();
    }
    function metrics() {
      var cs = getComputedStyle(ta), lh = parseFloat(cs.lineHeight) || 20, m = $('#ce-m'); return { lh: lh, cw: (m.getBoundingClientRect().width / 10) || 8 };
    }
    function goMatch(i, focus) {
      if (!M.length) return;
      MI = (i + M.length) % M.length; var s = M[MI], q = $('#ce-q').value.length, v = ta.value;
      var line = v.slice(0, s).split('\n').length - 1, col = s - (v.lastIndexOf('\n', s - 1) + 1), mt = metrics();
      ta.scrollTop = Math.max(0, line * mt.lh - ta.clientHeight / 3);
      ta.scrollLeft = col * mt.cw > ta.clientWidth - 60 ? Math.max(0, col * mt.cw - ta.clientWidth / 2) : 0;
      ta.setSelectionRange(s, s + q); if (focus) ta.focus({ preventScroll: true });
      marks(); counter(); sync();
    }
    function replaceCur() {
      if (MI < 0) return; var q = $('#ce-q').value, s = M[MI];
      replaceRange(s, s + q.length, $('#ce-r').value); findAll(false);
      if (M.length) goMatch(Math.min(MI, M.length - 1), false);
    }
    function replaceAll() {
      var q = $('#ce-q').value; if (!q || !M.length) return;
      var v = ta.value, rep = $('#ce-r').value, out = '', last = 0;
      M.forEach(function (s) { out += v.slice(last, s) + rep; last = s + q.length; });
      out += v.slice(last); var n = M.length;
      ta.setSelectionRange(0, v.length); ins(out); findAll(false); stat('Diganti ' + n + ' tempat');
    }

    // ---- jalankan (HTML / JavaScript) dalam iframe sandbox
    var conBox = $('#ce-con'), pf = $('#ce-pf');
    function runPreview() {
      var f = FILES[ACT]; f.text = ta.value;
      var doc = buildPreview(f, FILES);
      if (doc === null) { stat('Jalankan hanya untuk file HTML dan JavaScript'); return; }
      conBox.textContent = ''; $('#ce-prevbox').classList.remove('hide'); pf.srcdoc = doc; stat('Dijalankan: ' + f.name);
    }
    window.addEventListener('message', function (e) {
      if (e.source !== pf.contentWindow || !e.data || e.data.orbitRun !== 1) return;
      var d = e.data, line = document.createElement('div');
      line.className = 'ce-cl ' + (['warn', 'error'].indexOf(d.t) >= 0 ? d.t : 'log'); line.textContent = String(d.m == null ? '' : d.m).slice(0, 2000);
      conBox.appendChild(line); while (conBox.childNodes.length > 200) conBox.removeChild(conBox.firstChild); conBox.scrollTop = conBox.scrollHeight;
    });

    // ---- baris tombol bantu (ponsel)
    (function keys() {
      var box = $('#ce-keys');
      [['Tab', IND], ['{', '{'], ['}', '}'], ['(', '('], [')', ')'], ['[', '['], [']', ']'], [';', ';'], ['"', '"'], ["'", "'"], ['<', '<'], ['>', '>'], ['/', '/'], ['=', '='], ['$', '$'], ['.', '.'], ['↶', 'undo'], ['↷', 'redo']].forEach(function (k) {
        var b = el('button', 'ce-k', k[0]); b.type = 'button';
        b.addEventListener('pointerdown', function (e) { e.preventDefault(); });
        b.addEventListener('click', function () {
          ta.focus({ preventScroll: true });
          if (k[1] === 'undo' || k[1] === 'redo') { try { document.execCommand(k[1]); } catch (e) {} schedule(); return; }
          if (k[1] === IND) { ins(IND); return; }
          if (CLOSE.indexOf(k[1]) >= 0 && ta.value.charAt(ta.selectionEnd) === k[1] && ta.selectionStart === ta.selectionEnd) { ta.setSelectionRange(ta.selectionStart + 1, ta.selectionStart + 1); return; }
          if (OPEN[k[1]] && ta.selectionStart === ta.selectionEnd && !/[\w$]/.test(ta.value.charAt(ta.selectionEnd))) { var p = ta.selectionStart; ins(k[1] + OPEN[k[1]]); ta.setSelectionRange(p + 1, p + 1); return; }
          ins(k[1]);
        });
        box.appendChild(b);
      });
    })();

    // ---- asisten AI (memakai /api/chat, mode koding; 1 pesan = 1 kuota)
    var CHAT = [], busy = false, logEl = $('#ce-log');
    function aiOpen(on) {
      var s = $('#ce-side'), show = on === undefined ? s.classList.contains('hide') : !!on;
      s.classList.toggle('hide', !show); $('#ce-ai').classList.toggle('on', show);
      if (show) $('#ce-in').focus();
    }
    function addMsg(cls, text) {
      var m = el('div', 'ce-m ' + cls, text); logEl.appendChild(m); logEl.scrollTop = logEl.scrollHeight; return m;
    }
    function copy(text) {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { stat('Disalin'); }, function () { prompt('Salin kode ini:', text); });
      else prompt('Salin kode ini:', text);
    }
    function applyCode(code, how) {
      if (how === 'insert') { ins(code); stat('Kode disisipkan'); return; }
      if (how === 'file') { var e = AI_EXT[String(arguments[2] || '').toLowerCase()] || 'txt'; newFile('ai-' + (FILES.length + 1) + '.' + e, code); return; }
      var has = ta.selectionStart !== ta.selectionEnd;
      if (!has && !confirm('Ganti seluruh isi ' + FILES[ACT].name + ' dengan kode ini? (Bisa dibatalkan dengan Undo.)')) return;
      if (!has) ta.setSelectionRange(0, ta.value.length);
      ins(code); stat(has ? 'Seleksi diganti' : 'Isi file diganti');
    }
    function aiRender(box, text) {
      box.textContent = '';
      String(text || '').split('```').forEach(function (part, i) {
        if (i % 2 === 0) { if (part.trim()) { var d = el('div'); h.renderMd(d, part.trim()); box.appendChild(d); } return; }
        var m = /^([\w+#.-]*)[ \t]*\n/.exec(part), lang = m ? m[1] : '', code = part.replace(/^[\w+#.-]*[ \t]*\n/, '').replace(/\n$/, '');
        if (!code.trim()) return;
        var cb = el('div', 'ce-cb'), hd = el('div', 'ce-ch'), pre = el('pre'), cd = el('code');
        hd.appendChild(el('span', 'ce-lang', lang || 'kode'));
        [['Salin', function () { copy(code); }], ['Sisipkan', function () { applyCode(code, 'insert'); }], ['Ganti', function () { applyCode(code, 'replace'); }], ['File baru', function () { applyCode(code, 'file', lang); }]].forEach(function (a) {
          var b = el('button', 'ce-cbn', a[0]); b.type = 'button'; b.addEventListener('click', a[1]); hd.appendChild(b);
        });
        cd.textContent = code; pre.appendChild(cd); cb.appendChild(hd); cb.appendChild(pre); box.appendChild(cb);
      });
    }
    async function aiSend(text) {
      text = String(text || '').trim(); if (!text || busy) return;
      busy = true; $('#ce-send').disabled = true;
      var f = FILES[ACT]; f.text = ta.value;
      var sel = ta.selectionStart !== ta.selectionEnd ? ta.value.slice(ta.selectionStart, ta.selectionEnd) : '';
      CHAT.push({ role: 'user', text: text }); addMsg('u', text);
      var w = addMsg('a', 'Sedang menulis…');
      try {
        var j = await h.call('/api/chat', { mode: 'code', messages: CHAT.slice(-12), code: { name: f.name, lang: langOf(f.name), text: f.text.slice(0, 30000), sel: sel.slice(0, 8000) } });
        aiRender(w, j.text); CHAT.push({ role: 'assistant', text: j.text });
      } catch (e) {
        CHAT.pop(); w.classList.add('e'); w.textContent = e instanceof TypeError ? 'Tidak bisa menghubungi server (' + e.message + ').' : e.message;
        $('#ce-in').value = text;
      } finally { busy = false; $('#ce-send').disabled = false; logEl.scrollTop = logEl.scrollHeight; }
    }
    var QUICK = [
      ['Tulis kode', null, 'Contoh: buatkan halaman login dengan HTML + CSS yang rapi dan responsif'],
      ['Jelaskan', 'Jelaskan kode ini secara singkat dan jelas (bagian yang dipilih, atau seluruh file).'],
      ['Review', 'Review kode ini: temukan bug, masalah keamanan, dan hal yang bisa diperbaiki, urut dari yang paling penting. Sertakan perbaikannya.'],
      ['Perbaiki', 'Perbaiki bug atau error di kode ini, lalu berikan kode lengkap hasil perbaikannya.']
    ];
    (function quick() {
      var box = $('#ce-quick');
      QUICK.forEach(function (q) {
        var b = el('button', 'ce-qb', q[0]); b.type = 'button';
        b.addEventListener('click', function () { if (q[1]) aiSend(q[1]); else { $('#ce-in').placeholder = q[2]; $('#ce-in').focus(); } });
        box.appendChild(b);
      });
    })();
    $('#ce-send').addEventListener('click', function () { var v = $('#ce-in').value; $('#ce-in').value = ''; aiSend(v); });
    $('#ce-in').addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('#ce-send').click(); } });
    $('#ce-clr').addEventListener('click', function () { CHAT = []; logEl.textContent = ''; });
    $('#ce-sx').addEventListener('click', function () { aiOpen(false); });

    // ---- tombol atas
    $('#ce-close').addEventListener('click', function () { dlg.close(); });
    $('#ce-new').addEventListener('click', function () { newFile(); });
    $('#ce-openb').addEventListener('click', function () { $('#ce-file').click(); });
    $('#ce-file').addEventListener('change', function () { openLocal(this.files); this.value = ''; });
    $('#ce-dl').addEventListener('click', download);
    $('#ce-findb').addEventListener('click', function () { showFind($('#ce-find').classList.contains('hide')); });
    $('#ce-run').addEventListener('click', runPreview);
    $('#ce-ai').addEventListener('click', function () { aiOpen(); });
    $('#ce-pclose').addEventListener('click', function () { $('#ce-prevbox').classList.add('hide'); pf.srcdoc = ''; });
    $('#ce-pclear').addEventListener('click', function () { conBox.textContent = ''; });
    $('#ce-q').addEventListener('input', function () { findAll(true); });
    $('#ce-q').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); goMatch(MI + (e.shiftKey ? -1 : 1), false); } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); showFind(false); } });
    $('#ce-r').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); replaceCur(); } });
    $('#ce-fp').addEventListener('click', function () { goMatch(MI - 1, false); });
    $('#ce-fn').addEventListener('click', function () { goMatch(MI + 1, false); });
    $('#ce-case').addEventListener('click', function () { caseSens = !caseSens; this.classList.toggle('on', caseSens); findAll(true); });
    $('#ce-rep').addEventListener('click', replaceCur);
    $('#ce-repall').addEventListener('click', replaceAll);
    $('#ce-fx').addEventListener('click', function () { showFind(false); });

    // ---- ukuran mengikuti keyboard layar (visualViewport)
    function fit() {
      if (!dlg.open) return;
      var vv = window.visualViewport;
      if (vv) { dlg.style.top = vv.offsetTop + 'px'; dlg.style.height = vv.height + 'px'; }
    }
    if (window.visualViewport) { window.visualViewport.addEventListener('resize', fit); window.visualViewport.addEventListener('scroll', fit); }
    // Esc / tombol Back: tutup bilah cari dulu, baru editornya
    dlg.addEventListener('cancel', function (e) { if (!$('#ce-find').classList.contains('hide')) { e.preventDefault(); showFind(false); } });
    dlg.addEventListener('close', function () { FILES[ACT].text = ta.value; persist(); dlg.style.height = ''; dlg.style.top = ''; });
    window.addEventListener('pagehide', function () { if (loaded) { FILES[ACT].text = ta.value; persist(); } });

    function open(withAI) {
      if (!loaded) { load(); loaded = true; ta.value = FILES[ACT].text; tabs(); lastLines = 0; }
      if (!dlg.open) dlg.showModal();
      fit(); render(); aiOpen(!!withAI);
      if (!withAI) ta.focus({ preventScroll: true });
    }
    return { open: open };
  }

  var api = { init: init, highlight: highlight, langOf: langOf, buildPreview: buildPreview, inlineAssets: inlineAssets };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.OrbitEditor = api;
})(typeof window !== 'undefined' ? window : this);
