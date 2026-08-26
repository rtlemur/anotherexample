# anotherexample.com

A permanent second origin for browser, CORS, cookie, redirect, and integration testing.

## Endpoints

- `ANY /api/echo` — reflect request details as JSON.
- `ANY /api/cors` — backwards-compatible permissive CORS endpoint.
- `ANY /api/cors/open` — permissive `Access-Control-Allow-Origin: *` endpoint.
- `ANY /api/cors/credentials` — reflects `Origin` and permits credentials.
- `ANY /api/status/:code` — intentional HTTP status (200–599).
- `ANY /api/delay/:ms` — intentional delay (0–10,000 ms).
- `GET /api/redirect?target=health|home|example&status=302` — safe redirect testing.
- `GET /api/cookie/set?sameSite=Lax|Strict|None` — set a test cookie.
- `GET /api/cookie/check` — report the incoming Cookie header.
- `GET /api/cookie/clear` — clear the test cookie.
- `GET /api/health` — health check.

## Safety

Use test data only. Do not send production credentials, API keys, session tokens, personal data, or other secrets to public testing endpoints.

Request bodies are limited to 64 KB. Delay tests are capped at 10 seconds. Redirect targets are predefined so the service cannot be used as a general-purpose open redirector.

## Local development

```bash
npm install
npm start
```

Then open `http://localhost:3000`.


## Analytics

Vercel Web Analytics is enabled in the HTML shell using the official `/_vercel/insights/script.js` integration. No React or Next.js conversion is required. Analytics must also be enabled for the Vercel project in the Vercel dashboard.
