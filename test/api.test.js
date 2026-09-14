const test=require('node:test'); const assert=require('node:assert/strict'); const { spawnSync }=require('node:child_process'); const request=require('supertest'); const app=require('../server');
test('server loads without RESEND_API_KEY',()=>{const env={...process.env};delete env.RESEND_API_KEY;const r=spawnSync(process.execPath,['-e',"require('./server')"],{cwd:require('node:path').join(__dirname,'..'),env,encoding:'utf8'});assert.equal(r.status,0,r.stderr);});
test('unrelated routes work without RESEND_API_KEY',async()=>{const previousKey=process.env.RESEND_API_KEY;delete process.env.RESEND_API_KEY;try{const r=await request(app).get('/api/health');assert.equal(r.status,200);assert.equal(r.body.status,'ok');}finally{if(previousKey===undefined)delete process.env.RESEND_API_KEY;else process.env.RESEND_API_KEY=previousKey;}});
test('valid contact submission returns 503 without RESEND_API_KEY',async()=>{const previousKey=process.env.RESEND_API_KEY;delete process.env.RESEND_API_KEY;try{const r=await request(app).post('/api/contact').send({name:'Test User',email:'test@example.com',message:'Hello'});assert.equal(r.status,503);assert.deepEqual(r.body,{error:'Email sending is currently unavailable.'});}finally{if(previousKey===undefined)delete process.env.RESEND_API_KEY;else process.env.RESEND_API_KEY=previousKey;}});
test('invalid contact submissions are validated without RESEND_API_KEY',async()=>{const previousKey=process.env.RESEND_API_KEY;delete process.env.RESEND_API_KEY;try{const missingMessage=await request(app).post('/api/contact').send({email:'test@example.com'});assert.equal(missingMessage.status,400);assert.deepEqual(missingMessage.body,{error:'Invalid contact form submission.'});const invalidEmail=await request(app).post('/api/contact').send({email:'invalid',message:'Hello'});assert.equal(invalidEmail.status,400);assert.deepEqual(invalidEmail.body,{error:'Please enter a valid email address.'});}finally{if(previousKey===undefined)delete process.env.RESEND_API_KEY;else process.env.RESEND_API_KEY=previousKey;}});
test('malformed JSON receives 400 and is not cached',async()=>{const r=await request(app).post('/api/echo').set('Content-Type','application/json').send('{"invalid"');assert.equal(r.status,400);assert.deepEqual(r.body,{error:'Invalid JSON body.'});assert.equal(r.headers['cache-control'],'no-store');});
test('oversized API bodies receive 413 and are not cached',async()=>{const r=await request(app).post('/api/echo').set('Content-Type','application/json').send(JSON.stringify('x'.repeat(64*1024)));assert.equal(r.status,413);assert.deepEqual(r.body,{error:'Request body too large. Maximum body size is 64 KB.'});assert.equal(r.headers['cache-control'],'no-store');});
test('API validation errors are not cached',async()=>{const r=await request(app).get('/api/status/not-a-code');assert.equal(r.status,400);assert.deepEqual(r.body,{error:'Status code must be an integer from 200 to 599.'});assert.equal(r.headers['cache-control'],'no-store');});
test('successful API responses preserve their behavior and are not cached',async()=>{const r=await request(app).get('/api/health');assert.equal(r.status,200);assert.deepEqual(r.body,{status:'ok',domain:'anotherexample.com'});assert.equal(r.headers['cache-control'],'no-store');});
test('open CORS',async()=>{const r=await request(app).get('/api/cors/open').set('Origin','https://client.example');assert.equal(r.headers['access-control-allow-origin'],'*');});
test('credentialed CORS reflects origin',async()=>{const r=await request(app).get('/api/cors/credentials').set('Origin','https://client.example');assert.equal(r.headers['access-control-allow-origin'],'https://client.example');assert.equal(r.headers['access-control-allow-credentials'],'true');});
test('lab can omit origin',async()=>{const r=await request(app).get('/api/cors/lab?allowOrigin=none').set('Origin','https://client.example');assert.equal(r.headers['access-control-allow-origin'],undefined);});
test('lab rejects invalid configured response header values',async()=>{
  for(const parameter of ['allowOrigin','methods','headers','expose','maxAge']){
    const query=new URLSearchParams({[parameter]:'valid\r\nInjected: value'});
    const r=await request(app).get(`/api/cors/lab?${query}`);
    assert.equal(r.status,400,`${parameter} should return 400 rather than 500`);
    assert.deepEqual(r.body,{error:`Invalid ${parameter} query parameter: value cannot be used as an HTTP response header.`});
  }
});
test('lab preserves valid custom response header values',async()=>{
  const query=new URLSearchParams({allowOrigin:'https://custom.example',methods:'GET, PATCH',headers:'X-Custom, Content-Type',expose:'X-Trace',maxAge:'1200',credentials:'true'});
  const r=await request(app).get(`/api/cors/lab?${query}`);
  assert.equal(r.status,200);
  assert.equal(r.headers['access-control-allow-origin'],'https://custom.example');
  assert.equal(r.headers['access-control-allow-methods'],'GET, PATCH');
  assert.equal(r.headers['access-control-allow-headers'],'X-Custom, Content-Type');
  assert.equal(r.headers['access-control-expose-headers'],'X-Trace');
  assert.equal(r.headers['access-control-max-age'],'1200');
  assert.equal(r.headers['access-control-allow-credentials'],'true');
});
test('lab preserves default response header behavior',async()=>{
  const r=await request(app).get('/api/cors/lab');
  assert.equal(r.status,200);
  assert.equal(r.headers['access-control-allow-origin'],'*');
  assert.equal(r.headers['access-control-allow-methods'],'GET, POST, OPTIONS');
  assert.equal(r.headers['access-control-allow-headers'],'Content-Type');
  assert.equal(r.headers['access-control-expose-headers'],undefined);
  assert.equal(r.headers['access-control-max-age'],undefined);
});
test('sensitive headers are omitted',async()=>{const r=await request(app).get('/api/echo').set('Authorization','Bearer secret').set('x-vercel-test','secret');assert.equal(r.body.headers.authorization,undefined);assert.equal(r.body.headers['x-vercel-test'],undefined);});
test('status endpoint',async()=>{const r=await request(app).get('/api/status/418');assert.equal(r.status,418);});
