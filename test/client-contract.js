'use strict';
const fs = require('fs');
const assert = require('assert');
const routeFile = fs.readFileSync(require.resolve('../api/[name].js'), 'utf8');
const apiFile = fs.readFileSync(require.resolve('../lib/api.js'), 'utf8');
const studyFile = fs.readFileSync(require.resolve('../lib/study.js'), 'utf8');
const html = fs.readFileSync(require.resolve('../public/index.html'), 'utf8');
for (const [route, method] of Object.entries({status:'GET',me:'GET',login:'POST',page:'POST',fill:'POST',analyze:'POST',chat:'POST',image:'POST',code:'POST',study:'POST',gemini:'POST',admin:'POST'})) {
  assert(routeFile.includes(`${route}: '${method}'`), `API route ${route} ${method} must exist`);
  assert(apiFile.includes(`async function ${route}(`) || apiFile.includes(`function ${route}(`), `handler ${route} must exist`);
}
for (const tool of ['tutor','ask','explain','summary','check','quiz']) assert(html.includes(`id: '${tool}'`), `web tool ${tool} is missing`);
for (const mode of ['tutor','explain','summary']) assert(studyFile.includes(`${mode}:`), `mode ${mode} is missing`);
for (const endpoint of ['/api/chat','/api/image','/api/code','/api/analyze','/api/gemini','/api/study']) assert(html.includes(endpoint), `front-end endpoint ${endpoint} is missing`);
assert(apiFile.includes("'essay'"), 'API must accept essay fields');
assert(html.includes("tag === 'textarea' ? 'essay' : 'text'"), 'browser textarea should be recognized as essay');
assert(html.includes("q.type === 'text' || q.type === 'essay'"), 'browser should fill essay fields');
console.log('TES KONTRAK KLIEN WEB/API + ESAI LULUS');

assert(html.includes('id="bot-code"'), 'Coding Lab must be available from the robot popup');
assert(html.includes('id="codedlg"'), 'Coding Lab dialog is missing');
assert(html.includes('v314.0.7/full/pyodide.js'), 'Web Python runtime must be pinned to a stable version');
assert(html.includes("setAttribute('sandbox','allow-scripts')"), 'Local code runner must be sandboxed');
console.log('TES CODING LAB UI + RUNNER SANDBOX LULUS');
