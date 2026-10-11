'use strict';
const fs = require('fs');
const assert = require('assert');
const routeFile = fs.readFileSync(require.resolve('../api/[name].js'), 'utf8');
const apiFile = fs.readFileSync(require.resolve('../lib/api.js'), 'utf8');
const studyFile = fs.readFileSync(require.resolve('../lib/study.js'), 'utf8');
const html = fs.readFileSync(require.resolve('../public/index.html'), 'utf8');
for (const [route, method] of Object.entries({status:'GET',me:'GET',login:'POST',page:'POST',fill:'POST',analyze:'POST',chat:'POST',image:'POST',study:'POST',gemini:'POST',admin:'POST'})) {
  assert(routeFile.includes(`${route}: '${method}'`), `API route ${route} ${method} must exist`);
  assert(apiFile.includes(`async function ${route}(`) || apiFile.includes(`function ${route}(`), `handler ${route} must exist`);
}
for (const tool of ['tutor','ask','explain','summary','check','quiz']) assert(html.includes(`id: '${tool}'`), `web tool ${tool} is missing`);
for (const mode of ['tutor','explain','summary']) assert(studyFile.includes(`${mode}:`), `mode ${mode} is missing`);
for (const endpoint of ['/api/chat','/api/image','/api/analyze','/api/gemini','/api/study']) assert(html.includes(endpoint), `front-end endpoint ${endpoint} is missing`);
console.log('TES KONTRAK KLIEN WEB/API LULUS');
