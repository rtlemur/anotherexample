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
test('sensitive headers are omitted',async()=>{
  const r=await request(app)
    .get('/api/echo')
    .set('Authorization','Bearer secret')
    .set('Proxy-Authorization','Basic secret')
    .set('Cookie','session=secret')
    .set('X-API-Key','secret')
    .set('API-Key','secret')
    .set('X-Auth-Token','secret')
    .set('Referer','https://private.example/path?token=secret')
    .set('x-vercel-test','secret')
    .set('X-Safe-Debug-Header','visible');

  for(const header of ['authorization','proxy-authorization','cookie','x-api-key','api-key','x-auth-token','referer','x-vercel-test']){
    assert.equal(r.body.headers[header],undefined,`${header} should be omitted`);
  }
  assert.equal(r.body.headers['x-safe-debug-header'],'visible');
});
test('status endpoint',async()=>{const r=await request(app).get('/api/status/418');assert.equal(r.status,418);});

test('open CORS preflight returns the permissive OPTIONS contract',async()=>{
  const r=await request(app)
    .options('/api/cors/open')
    .set('Origin','https://client.example')
    .set('Access-Control-Request-Method','PATCH')
    .set('Access-Control-Request-Headers','X-Test, Authorization');

  assert.equal(r.status,204);
  assert.equal(r.text,'');
  assert.equal(r.headers['access-control-allow-origin'],'*');
  assert.equal(r.headers['access-control-allow-methods'],'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  assert.equal(r.headers['access-control-allow-headers'],'X-Test, Authorization');
  assert.equal(r.headers['access-control-max-age'],'600');
  assert.equal(r.headers['cache-control'],'no-store');
});

test('credentialed CORS preflight reflects the origin and allows credentials',async()=>{
  const r=await request(app)
    .options('/api/cors/credentials')
    .set('Origin','https://client.example')
    .set('Access-Control-Request-Method','DELETE')
    .set('Access-Control-Request-Headers','X-Credential-Test');

  assert.equal(r.status,204);
  assert.equal(r.text,'');
  assert.equal(r.headers['access-control-allow-origin'],'https://client.example');
  assert.equal(r.headers['access-control-allow-credentials'],'true');
  assert.equal(r.headers['access-control-allow-methods'],'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  assert.equal(r.headers['access-control-allow-headers'],'X-Credential-Test');
  assert.equal(r.headers['access-control-max-age'],'600');
  assert.match(r.headers.vary,/Origin/);
  assert.equal(r.headers['cache-control'],'no-store');
});

test('CORS lab OPTIONS supports default and configured preflight statuses',async()=>{
  const cases=[
    ['/api/cors/lab',204],
    ['/api/cors/lab?preflightStatus=200',200],
    ['/api/cors/lab?preflightStatus=418',418],
    ['/api/cors/lab?preflightStatus=invalid',204],
    ['/api/cors/lab?preflightStatus=600',204],
  ];

  for(const [url,status] of cases){
    const r=await request(app).options(url).set('Origin','https://client.example');
    assert.equal(r.status,status,url);
    assert.equal(r.text,'',url);
    assert.equal(r.headers['access-control-allow-origin'],'*',url);
    assert.equal(r.headers['cache-control'],'no-store',url);
  }
});

test('CORS lab applies configured response status',async()=>{
  const created=await request(app).get('/api/cors/lab?status=201');
  assert.equal(created.status,201);
  assert.equal(created.body.mode,'lab');

  const noContent=await request(app).get('/api/cors/lab?status=204');
  assert.equal(noContent.status,204);
  assert.equal(noContent.text,'');

  for(const status of ['not-a-number','199','600']){
    const r=await request(app).get(`/api/cors/lab?status=${status}`);
    assert.equal(r.status,200,status);
    assert.equal(r.body.mode,'lab',status);
  }
});

test('CORS lab applies configured response delay',async()=>{
  const started=Date.now();
  const r=await request(app).get('/api/cors/lab?delay=50');
  const elapsed=Date.now()-started;

  assert.equal(r.status,200);
  assert.equal(r.body.configuration.delay,50);
  assert.ok(elapsed>=40,`expected at least 40ms of delay, observed ${elapsed}ms`);
});

test('redirect accepts every documented target and redirect status',async()=>{
  const targets={health:'/api/health',home:'/',example:'https://example.com/'};
  for(const [target,location] of Object.entries(targets)){
    for(const status of [301,302,303,307,308]){
      const r=await request(app).get('/api/redirect').query({target,status});
      assert.equal(r.status,status,`${target} with ${status}`);
      assert.equal(r.headers.location,location,`${target} with ${status}`);
      assert.equal(r.headers['cache-control'],'no-store',`${target} with ${status}`);
    }
  }
});

test('redirect rejects unknown targets and unsupported statuses',async()=>{
  for(const target of ['unknown','https://attacker.example','../api/health']){
    const r=await request(app).get('/api/redirect').query({target});
    assert.equal(r.status,400,target);
    assert.deepEqual(r.body,{error:'target must be health, home, or example.'},target);
  }
  for(const status of ['invalid',200,300,304,309]){
    const r=await request(app).get('/api/redirect').query({status});
    assert.equal(r.status,400,String(status));
    assert.deepEqual(r.body,{error:'status must be one of 301, 302, 303, 307, or 308.'},String(status));
  }
});

test('cookie set emits the requested SameSite policy',async()=>{
  for(const sameSite of ['Lax','Strict','None']){
    const r=await request(app).get('/api/cookie/set').query({sameSite});
    const cookie=r.headers['set-cookie'][0];
    assert.equal(r.status,200,sameSite);
    assert.deepEqual(r.body,{set:true,cookie:'anotherexample_test',sameSite,secure:sameSite==='None'});
    assert.match(cookie,/^anotherexample_test=present;/);
    assert.match(cookie,new RegExp(`; SameSite=${sameSite}(?:;|$)`,'i'));
    assert.match(cookie,/; Path=\//);
    if(sameSite==='None') assert.match(cookie,/; Secure(?:;|$)/);
    else assert.doesNotMatch(cookie,/; Secure(?:;|$)/);
  }
});

test('cookie check detects the test cookie',async()=>{
  const r=await request(app)
    .get('/api/cookie/check')
    .set('Cookie','unrelated=value; anotherexample_test=present');
  assert.equal(r.status,200);
  assert.deepEqual(r.body,{cookie:'anotherexample_test',received:true});
});

test('cookie clear expires the same cookie on the same path',async()=>{
  const setResponse=await request(app).get('/api/cookie/set?sameSite=Lax');
  const clearResponse=await request(app).get('/api/cookie/clear');
  const created=setResponse.headers['set-cookie'][0];
  const cleared=clearResponse.headers['set-cookie'][0];

  assert.equal(clearResponse.status,200);
  assert.deepEqual(clearResponse.body,{cleared:true,cookie:'anotherexample_test'});
  assert.match(created,/^anotherexample_test=present;/);
  assert.match(cleared,/^anotherexample_test=;/);
  assert.match(created,/; Path=\//);
  assert.match(cleared,/; Path=\//);
  assert.match(cleared,/; Expires=Thu, 01 Jan 1970 00:00:00 GMT/);
});

test('status endpoint accepts the full documented range and preserves empty statuses',async()=>{
  for(const status of [200,201,204,304,418,599]){
    const r=await request(app).get(`/api/status/${status}`);
    assert.equal(r.status,status,String(status));
    if(status===204||status===304) assert.equal(r.text,'',String(status));
    else assert.deepEqual(r.body,{status,message:`Intentional test response with HTTP ${status}.`},String(status));
  }
});

test('status endpoint rejects invalid status codes',async()=>{
  for(const status of ['invalid','200.5',199,600]){
    const r=await request(app).get(`/api/status/${status}`);
    assert.equal(r.status,400,String(status));
    assert.deepEqual(r.body,{error:'Status code must be an integer from 200 to 599.'},String(status));
  }
});

test('delay endpoint waits for valid integer delays',async()=>{
  const immediate=await request(app).get('/api/delay/0');
  assert.equal(immediate.status,200);
  assert.deepEqual(immediate.body,{delayed:0,unit:'milliseconds'});

  const started=Date.now();
  const delayed=await request(app).get('/api/delay/50');
  const elapsed=Date.now()-started;
  assert.equal(delayed.status,200);
  assert.deepEqual(delayed.body,{delayed:50,unit:'milliseconds'});
  assert.ok(elapsed>=40,`expected at least 40ms of delay, observed ${elapsed}ms`);
});

test('delay endpoint rejects invalid delay values',async()=>{
  for(const delay of ['invalid','1.5','-1','10001']){
    const r=await request(app).get(`/api/delay/${delay}`);
    assert.equal(r.status,400,delay);
    assert.deepEqual(r.body,{error:'Delay must be an integer from 0 to 10000 milliseconds.'},delay);
  }
});
