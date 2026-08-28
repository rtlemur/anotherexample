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


## V1.1 preview second origin
The preview CORS Playground runs real browser-enforced cross-origin tests against `https://cors-preview.anotherexample.com`, which is mapped in Vercel to the `v1.1-preview` branch. Production should use a permanent second-origin hostname such as `cors.anotherexample.com` before merging the playground live.


## V1.1 URL-first CORS preview

The CORS Playground now leads with a developer's own URL, derives the browser origin for generated examples, and keeps the seven real-browser scenarios as a learning/debugging section. Client IP addresses are no longer included in public request snapshots. The page selects `cors-preview.anotherexample.com` outside production and `cors.anotherexample.com` on the production hostname.

## Diagnostic comparison iteration
The CORS page now leads with a two-test workflow: the developer's target API versus a controlled AnotherExample second-origin request. Arbitrary target URLs are not fetched server-side; this avoids turning the service into an open proxy/SSRF surface and preserves real browser CORS enforcement.

## Diagnostic hotfix
The first diagnostic build removed the `allowOrigin` control while legacy lab/scenario JavaScript still referenced it during page initialization. That exception prevented the **Build diagnostic tests** click handler from ever being attached. This build restores the control and adds a defensive initialization guard.

## Current stop point
Development paused August 27, 2026 on the V1.1 preview. The diagnostic front door works. The next iteration should make the post-click **Your diagnostic is ready** state unmistakable, place Test A/Test B first, and move request configuration into collapsed **Advanced options**. See `ROADMAP.md` for the full resume checklist.

## CORS Debugger iteration
Diagnosis-first flow: Test A and Test B appear immediately after starting; request configuration is under Advanced options. Product naming changed from CORS Playground to CORS Debugger.

## Diagnostic workflow refinement
Generated JavaScript is now secondary to the diagnostic workflow. Test A/Test B show concise summaries first, with code available on demand and explicit instructions to run both from the actual page origin in DevTools.
