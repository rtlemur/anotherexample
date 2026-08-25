# anotherexample.com

The permanent "second domain" for cross-origin and integration testing.

## Run locally

```bash
npm install
npm start
```

Then visit `http://localhost:3000`.

## Endpoints

- `GET/POST /api/echo` — echoes back method, headers, query, body, IP
- `GET/POST /api/cors` — same, but with permissive CORS headers so you can fetch it from any origin
- `GET /api/health` — health check

## Deploying

**Vercel (recommended, free tier)**
1. Push this folder to a GitHub repo.
2. Import the repo at vercel.com — it auto-detects the Express app.
   (If you want serverless functions instead of a long-running server, the
   `api/` folder convention works too — ask if you want it restructured that way.)
3. Point `anotherexample.com`'s DNS at Vercel (they'll give you the exact A/CNAME records).

**Cloudflare Pages / Workers** works similarly and is also free at this scale.

## Next endpoints to add (from the original plan)
- `/api/redirect?to=` — controlled redirect chain testing
- `/api/cookie/set` + `/api/cookie/check` — cross-origin cookie testing
- `/api/status/:code` — force arbitrary HTTP status codes
- `/api/delay/:seconds` — artificial latency for timeout testing
- `/api/iframe-test` — a page meant to be embedded cross-origin
