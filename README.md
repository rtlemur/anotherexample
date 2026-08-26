# anotherexample.com

A permanent second origin for browser, CORS, cookie, redirect, and integration testing.

## Run locally
```bash
npm install
npm start
```

## Test
```bash
npm test
```

## Main endpoints
- `ANY /api/echo`
- `ANY /api/cors/open`
- `ANY /api/cors/credentials`
- `ANY /api/cors/lab` — configurable CORS response for the playground
- `ANY /api/status/:code`
- `ANY /api/delay/:ms`
- `GET /api/redirect`
- `GET /api/cookie/set|check|clear`
- `GET /api/health`

## CORS playground
Visit `/cors`. The current V1.1 playground configures and inspects CORS responses. Because the page and lab endpoint share an origin, it explains the browser behavior that a real cross-origin caller should expect. V1.2 will add a deliberately separate host so the browser can enforce the scenarios live inside the playground.

## Safety
Public API requests are rate limited. Reflected request data omits authorization, cookies, Vercel/internal proxy headers, and related infrastructure metadata. Use test data only.

See `ROADMAP.md` for product direction.
