// anotherexample.com — a permanent second origin for browser and integration testing.
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const MAX_DELAY_MS = 10000;

app.disable('x-powered-by');
app.set('trust proxy', true);
app.use(express.json({ limit: '64kb', strict: false }));
app.use(express.urlencoded({ extended: false, limit: '64kb' }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));

function noStore(res) {
  res.set('Cache-Control', 'no-store');
}

function publicHeaders(req) {
  const hiddenExact = new Set([
    'authorization',
    'proxy-authorization',
    'cookie',
    'forwarded',
    'x-real-ip',
    'x-invocation-id',
  ]);
  const hiddenPrefixes = ['x-vercel-', 'x-forwarded-', 'x-middleware-'];

  return Object.fromEntries(
    Object.entries(req.headers).filter(([name]) => {
      const lower = name.toLowerCase();
      return !hiddenExact.has(lower) && !hiddenPrefixes.some(prefix => lower.startsWith(prefix));
    })
  );
}

function requestSnapshot(req) {
  return {
    method: req.method,
    path: req.originalUrl,
    query: req.query,
    headers: publicHeaders(req),
    body: req.body ?? null,
    ip: req.ip,
    timestamp: new Date().toISOString(),
    note: 'Sensitive and hosting-provider headers are omitted.',
  };
}

function hasTestCookie(req) {
  const raw = req.get('Cookie') || '';
  return raw.split(';').some(part => part.trim().startsWith('anotherexample_test='));
}

// Open CORS: useful for basic cross-origin fetches without credentials.
app.use('/api/cors/open', (req, res, next) => {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': req.get('Access-Control-Request-Headers') || 'Content-Type, Authorization',
    'Access-Control-Max-Age': '600',
  });
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.all('/api/cors/open', (req, res) => {
  noStore(res);
  res.json({
    mode: 'open',
    message: 'Permissive CORS response using Access-Control-Allow-Origin: *.',
    ...requestSnapshot(req),
  });
});

// Credentialed CORS: reflects the caller's Origin and permits credentials.
app.use('/api/cors/credentials', (req, res, next) => {
  const origin = req.get('Origin');
  if (origin) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Vary', 'Origin');
  }
  res.set({
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': req.get('Access-Control-Request-Headers') || 'Content-Type, Authorization',
    'Access-Control-Max-Age': '600',
  });
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.all('/api/cors/credentials', (req, res) => {
  noStore(res);
  res.json({
    mode: 'credentials',
    message: 'Credentialed CORS response. The request Origin is reflected when present.',
    ...requestSnapshot(req),
  });
});

// Backwards-compatible original route.
app.use('/api/cors', (req, res, next) => {
  if (req.path !== '/') return next();
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': req.get('Access-Control-Request-Headers') || 'Content-Type, Authorization',
    'Access-Control-Max-Age': '600',
  });
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.all('/api/cors', (req, res) => {
  noStore(res);
  res.json({ message: 'Permissive CORS response. See /api/cors/open and /api/cors/credentials.', ...requestSnapshot(req) });
});

// Echo the request. Test data only: never send real secrets or production credentials.
app.all('/api/echo', (req, res) => {
  noStore(res);
  res.json(requestSnapshot(req));
});

// Return an arbitrary HTTP status code for client error-handling tests.
app.all('/api/status/:code', (req, res) => {
  const code = Number(req.params.code);
  if (!Number.isInteger(code) || code < 200 || code > 599) {
    return res.status(400).json({ error: 'Status code must be an integer from 200 to 599.' });
  }
  noStore(res);
  if (code === 204 || code === 304) return res.status(code).end();
  res.status(code).json({ status: code, message: `Intentional test response with HTTP ${code}.` });
});

// Delay a response by up to 10 seconds.
app.all('/api/delay/:ms', async (req, res) => {
  const ms = Number(req.params.ms);
  if (!Number.isInteger(ms) || ms < 0 || ms > MAX_DELAY_MS) {
    return res.status(400).json({ error: `Delay must be an integer from 0 to ${MAX_DELAY_MS} milliseconds.` });
  }
  await new Promise(resolve => setTimeout(resolve, ms));
  noStore(res);
  res.json({ delayed: ms, unit: 'milliseconds' });
});

// Safe redirect tests. Targets are intentionally fixed to prevent this service becoming an open redirector.
app.get('/api/redirect', (req, res) => {
  const status = Number(req.query.status || 302);
  const target = req.query.target || 'health';
  const targets = {
    health: '/api/health',
    home: '/',
    example: 'https://example.com/',
  };
  if (![301, 302, 303, 307, 308].includes(status)) {
    return res.status(400).json({ error: 'status must be one of 301, 302, 303, 307, or 308.' });
  }
  if (!targets[target]) {
    return res.status(400).json({ error: 'target must be health, home, or example.' });
  }
  noStore(res);
  res.redirect(status, targets[target]);
});

// Cookie tests. SameSite=None requires Secure in modern browsers.
app.get('/api/cookie/set', (req, res) => {
  const sameSiteInput = String(req.query.sameSite || 'Lax').toLowerCase();
  const sameSiteMap = { lax: 'Lax', strict: 'Strict', none: 'None' };
  const sameSite = sameSiteMap[sameSiteInput];
  if (!sameSite) return res.status(400).json({ error: 'sameSite must be Lax, Strict, or None.' });
  res.cookie('anotherexample_test', 'present', {
    httpOnly: false,
    secure: sameSite === 'None',
    sameSite,
    maxAge: 60 * 60 * 1000,
  });
  noStore(res);
  res.json({ set: true, cookie: 'anotherexample_test', sameSite, secure: sameSite === 'None' });
});

app.get('/api/cookie/check', (req, res) => {
  noStore(res);
  res.json({ cookie: 'anotherexample_test', received: hasTestCookie(req) });
});

app.get('/api/cookie/clear', (req, res) => {
  res.clearCookie('anotherexample_test');
  noStore(res);
  res.json({ cleared: true, cookie: 'anotherexample_test' });
});

app.get('/api/health', (req, res) => {
  noStore(res);
  res.json({ status: 'ok', domain: 'anotherexample.com' });
});

// Friendly JSON for oversized request bodies.
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body too large. Maximum body size is 64 KB.' });
  }
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON body.' });
  }
  next(err);
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`anotherexample.com running on http://localhost:${PORT}`));
}

module.exports = app;
