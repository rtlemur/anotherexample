const assert = require('node:assert/strict');
const { test } = require('node:test');
const request = require('supertest');
const app = require('../server');

const message = { name: 'Test User', email: 'test@example.com', message: 'Hello' };
const validCheck = { success: true, action: 'contact', hostname: 'anotherexample.com' };
const verificationUrl = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
let nextIp = 1;

function post(form) {
  return request(app).post('/api/contact').set('X-Forwarded-For', '192.0.2.' + nextIp++).send(form);
}

test('contact delivery requires a verified Turnstile token', async t => {
  const config = { TURNSTILE_SITE_KEY: 'public-site-key', TURNSTILE_SECRET_KEY: 'private-key', RESEND_API_KEY: 'test-email-key' };
  const saved = Object.fromEntries(Object.keys(config).map(key => [key, process.env[key]]));
  Object.assign(process.env, config);
  t.after(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  let verification = validCheck;
  let providerUnavailable = false;
  let emailRejected = false;
  const calls = t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url === verificationUrl) {
      assert.equal(options.method, 'POST');
      assert.equal(options.body.get('secret'), config.TURNSTILE_SECRET_KEY);
      assert.equal(options.body.get('response'), 'widget-token');
      return providerUnavailable ? new Response(null, { status: 503 }) : Response.json(verification);
    }
    assert.equal(url, 'https://api.resend.com/emails');
    const email = JSON.parse(options.body);
    assert.equal(email.reply_to, message.email);
    assert.match(email.text, /Hello/);
    return emailRejected
      ? Response.json({ name: 'validation_error', message: 'Rejected for testing' }, { status: 422 })
      : Response.json({ id: 'test-email' });
  });

  await request(app).get('/api/contact/config').expect('Cache-Control', 'no-store')
    .expect(200, { siteKey: config.TURNSTILE_SITE_KEY });

  await post(message).expect(403);
  await post({ ...message, 'cf-turnstile-response': ['widget-token', 'other'] }).expect(403);
  await post({ ...message, 'cf-turnstile-response': 'x'.repeat(2049) }).expect(403);
  await post({ ...message, website: 'bot.example' }).expect(200, { sent: true });
  assert.equal(calls.mock.callCount(), 0);

  const submission = { ...message, 'cf-turnstile-response': 'widget-token' };
  for (const result of [
    { success: false, 'error-codes': ['timeout-or-duplicate'] },
    { ...validCheck, action: 'other-form' },
    { ...validCheck, hostname: 'other.example' },
    { success: true, action: 'contact' }
  ]) {
    verification = result;
    await post(submission).expect(403);
  }
  providerUnavailable = true;
  await post(submission).expect(503);
  providerUnavailable = false;
  assert.deepEqual(calls.mock.calls.map(call => call.arguments[0]), Array(5).fill(verificationUrl));

  verification = validCheck;
  await post(submission).expect(200, { sent: true });
  emailRejected = true;
  await post(submission).expect(500);
  assert.deepEqual(calls.mock.calls.slice(5).map(call => call.arguments[0]), [
    verificationUrl, 'https://api.resend.com/emails',
    verificationUrl, 'https://api.resend.com/emails'
  ]);

  delete process.env.TURNSTILE_SECRET_KEY;
  await request(app).get('/api/contact/config').expect(503);
  await post(submission).expect(503);
  assert.equal(calls.mock.callCount(), 9);
});
