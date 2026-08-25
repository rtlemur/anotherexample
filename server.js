// anotherexample.com — the permanent "second domain" for cross-origin testing
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---- CORS test endpoint ----
// Permissive CORS so devs can hit this from any origin to test cross-origin fetches.
app.use('/api/cors', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.all('/api/cors', (req, res) => {
  res.json({
    message: 'This response was served with permissive CORS headers.',
    method: req.method,
    receivedHeaders: req.headers,
    receivedBody: req.body || null,
  });
});

// ---- Echo endpoint ----
// Returns everything about the incoming request — headers, method, query, IP.
app.all('/api/echo', (req, res) => {
  res.json({
    method: req.method,
    path: req.originalUrl,
    query: req.query,
    headers: req.headers,
    body: req.body || null,
    ip: req.ip,
    timestamp: new Date().toISOString(),
  });
});

// ---- Health check ----
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', domain: 'anotherexample.com' });
});

app.listen(PORT, () => {
  console.log(`anotherexample.com test server running on port ${PORT}`);
});
