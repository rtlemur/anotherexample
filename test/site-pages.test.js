const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../server');

for (const [route, active] of [['/', '/'], ['/index.html', '/'], ['/cors', '/cors'], ['/cors/playground', '/cors/playground'], ['/cors/errors', '/cors/errors'], ['/contact', '/contact']]) {
  test(`${route} has shared navigation, active state, and contact footer`, async () => {
    const response = await request(app).get(route).expect(200);
    assert.match(response.text, /class="site-nav" aria-label="Main navigation"/);
    assert.ok(response.text.includes(`href="${active}" aria-current="page"`));
    for (const url of ['/', '/cors', '/cors/playground', '/cors/errors', '/contact']) assert.ok(response.text.includes(`href="${url}"`));
    assert.match(response.text, /class="site-footer"><a href="\/contact">Contact AnotherExample/);
  });
}
test('unknown URL returns branded HTML with 404 status and recovery links', async () => {
  const response = await request(app).get('/missing-page').expect(404);
  assert.match(response.text, /404 — Page not found/);
  assert.match(response.text, /href="\/cors"/);
  assert.doesNotMatch(response.text, /Cannot GET|aria-current/);
});
test('existing malformed JSON error handling is preserved', async () => {
  const response = await request(app).post('/api/echo').set('Content-Type', 'application/json').send('{').expect(400);
  assert.equal(response.body.error, 'Invalid JSON body.');
});

test('error page keeps compact input, local privacy note, and manual fallback', async () => {
  const {text} = await request(app).get('/cors/errors').expect(200);
  assert.match(text, /id="browserResult"\s+rows="3"\s+aria-describedby="errorPrivacy"/);
  assert.match(text, /Before you paste/);
  assert.match(text, /Remove anything private first\. Analysis stays local in your browser\./);
  assert.ok(text.indexOf('id="errorPrivacy"') < text.indexOf('<textarea'));
  assert.match(text, /id="explainBrowserResult"/);
  for (const script of ['/cors-diagnosis.js', '/cors-error-interpreter.js']) {
    assert.ok(text.includes(`src="${script}"`));
    await request(app).get(script).expect(200);
  }
});

test('missing Allow-Origin guide is reachable and routes into the tools', async () => {
  const {text} = await request(app).get('/cors/no-access-control-allow-origin').expect(200);
  assert.match(text, /No ‘Access-Control-Allow-Origin’ header is present/);
  assert.match(text, /href="\/cors"/);
  assert.match(text, /href="\/cors\/errors"/);
  assert.match(text, /href="\/cors\/playground"/);
  assert.match(text, /https:\/\/cors\.anotherexample\.com\/api\/cors\/open/);
});

test('preflight guide is reachable and demonstrates failing and successful OPTIONS responses', async () => {
  const {text} = await request(app).get('/cors/preflight-failed').expect(200);
  assert.match(text, /CORS preflight \/ OPTIONS request failed/);
  assert.match(text, /preflightStatus=403/);
  assert.match(text, /preflightStatus=204/);
  assert.match(text, /Access-Control-Allow-Methods/);
  assert.match(text, /Access-Control-Allow-Headers/);
  assert.match(text, /https:\/\/cors\.anotherexample\.com\/api\/cors\/lab/);
  assert.match(text, /href="\/cors"/);
  assert.match(text, /href="\/cors\/errors"/);
  assert.match(text, /href="\/cors\/playground"/);
});

test('local-vs-production guide is reachable and links to related troubleshooting', async () => {
  const {text} = await request(app).get('/cors/works-locally-but-not-in-production').expect(200);
  assert.match(text, /CORS works locally but fails in production/);
  assert.match(text, /location\.origin/);
  assert.match(text, /allowOrigin=echo/);
  assert.match(text, /href="\/cors\/blocked-by-cors-policy"/);
  assert.match(text, /href="\/cors\/preflight-failed"/);
  assert.match(text, /href="\/cors\/no-access-control-allow-origin"/);
  assert.match(text, /https:\/\/cors\.anotherexample\.com\/api\/cors\/lab/);
});

test('blocked-by-policy guide is reachable and routes to specific CORS causes', async () => {
  const {text} = await request(app).get('/cors/blocked-by-cors-policy').expect(200);
  assert.match(text, /Blocked by CORS policy: what it means and what to check/);
  assert.match(text, /href="\/cors\/no-access-control-allow-origin"/);
  assert.match(text, /href="\/cors\/preflight-failed"/);
  assert.match(text, /href="\/cors\/works-locally-but-not-in-production"/);
  assert.match(text, /https:\/\/cors\.anotherexample\.com\/api\/cors\/open/);
  assert.match(text, /href="\/cors\/errors"/);
});

test('debugger links to error explainer and homepage greeting is removed', async () => {
  const debuggerPage = await request(app).get('/cors').expect(200);
  assert.match(debuggerPage.text, /href="\/cors\/errors"/);
  assert.doesNotMatch(debuggerPage.text, /id="browserResult"/);
  for (const route of ['/']) {
    const page = await request(app).get(route).expect(200);
    assert.doesNotMatch(page.text, /Hi and Welcome/);
  }
});

test('shared styles explicitly cover visited links, hover, focus, and wrapping navigation', async () => {
  const {text} = await request(app).get('/site.css').expect(200);
  assert.match(text, /\.site-nav\{[^}]*flex-wrap:wrap/);
  assert.match(text, /\.site-footer a:link,\.site-footer a:visited\{color:var\(--accent\)\}/);
  assert.match(text, /\.site-footer a:hover\{[^}]*color:var\(--text\)/);
  assert.match(text, /\.site-footer a:focus-visible\{[^}]*outline:2px solid var\(--accent\)/);
});
