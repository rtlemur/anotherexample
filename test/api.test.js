const test=require('node:test'); const assert=require('node:assert/strict'); const request=require('supertest'); const app=require('../server');
test('health',async()=>{const r=await request(app).get('/api/health');assert.equal(r.status,200);assert.equal(r.body.status,'ok');});
test('open CORS',async()=>{const r=await request(app).get('/api/cors/open').set('Origin','https://client.example');assert.equal(r.headers['access-control-allow-origin'],'*');});
test('credentialed CORS reflects origin',async()=>{const r=await request(app).get('/api/cors/credentials').set('Origin','https://client.example');assert.equal(r.headers['access-control-allow-origin'],'https://client.example');assert.equal(r.headers['access-control-allow-credentials'],'true');});
test('lab can omit origin',async()=>{const r=await request(app).get('/api/cors/lab?allowOrigin=none').set('Origin','https://client.example');assert.equal(r.headers['access-control-allow-origin'],undefined);});
test('sensitive headers are omitted',async()=>{const r=await request(app).get('/api/echo').set('Authorization','Bearer secret').set('x-vercel-test','secret');assert.equal(r.body.headers.authorization,undefined);assert.equal(r.body.headers['x-vercel-test'],undefined);});
test('status endpoint',async()=>{const r=await request(app).get('/api/status/418');assert.equal(r.status,418);});
