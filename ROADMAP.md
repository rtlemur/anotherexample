# AnotherExample Product Roadmap

## Mission
Make `anotherexample.com` the simplest, most trustworthy permanent second origin for browser and integration testing.

## Product principles
1. **Useful before clever.** A developer should get value without creating an account.
2. **Own the second-origin niche.** Do not become a generic collection of unrelated developer utilities.
3. **Real browser behavior.** Prefer tests that demonstrate actual CORS, cookie, iframe, redirect, and origin behavior.
4. **Trust by default.** Never reflect credentials or hosting-provider secrets; minimize stored/logged data.
5. **Stay cheap and simple.** GitHub + Vercel + Express until usage proves we need more.
6. **Measure before monetizing.** Free tools build adoption; paid features follow demonstrated demand.

## V1 — Live
- Request echo with sensitive-header filtering
- Open and credentialed CORS endpoints
- Status, delay, redirect, cookie, and health endpoints
- Vercel Web Analytics
- Request/body safety limits

## V1.1 — CORS Playground
- Dedicated `/cors` interactive tool
- Preset success/failure scenarios
- Configurable CORS laboratory endpoint
- Real two-origin browser enforcement using a separate CORS hostname
- Generated fetch and curl examples
- Plain-English expected result plus the browser's actual success/blocked result
- Basic API rate limiting
- Automated API tests
- Privacy/acceptable-use notes and security contact path

## V1.2 — Visual Request Debugger
- Turn raw echo output into a readable request inspector
- Highlight method, Origin, relevant CORS/cookie headers, body, and timing
- Explain what the browser sent versus what the server received
- Keep sensitive credentials and hosting-provider headers filtered

## Future tools
Build only if usage/search data supports them:
- OpenAPI mock-data generator
- Live OpenAPI mock APIs on persistent/shareable URLs
- Saved request history and shareable test configurations
- Cookie / SameSite playground
- iframe / CSP / framing playground
- Redirect tester
- Referrer / Origin header tester
- postMessage playground
- Cross-origin isolation tests

## Monetization hypotheses — not yet committed
Keep public utility endpoints free. Possible paid features after adoption:
- Persistent/private configurable endpoints
- Saved test configurations and history
- Higher rate limits/API keys
- Team/shared environments
- Longer retention and business controls

## Deliberately postponed
- Accounts and billing
- Database
- Supabase/Lovable Cloud or another backend platform
- CAPTCHA unless abuse requires it
- Heavy observability stacks
- Generic JSON/JWT/regex/formatter tools
- Accounts, billing, and enterprise controls until demand exists

## Success signals
- Repeat visitors
- Growth in `/cors` usage
- Developers linking to or bookmarking AnotherExample
- Organic search traffic to specific testing problems
- Requests for persistence, privacy, higher limits, or team features


### V1.1 UX direction
- Lead with **Test your URL** rather than a generic app/demo framing.
- Generate code developers can run from their own site against a known second origin.
- Keep real browser scenarios as supporting diagnostics and education.
- Explain likely causes for expected CORS failures while preserving the browser's actual fetch result.

### V1.1 diagnostic front door
- Ask for **Your page URL** and **Target API URL** first.
- Generate Test A for the developer's real API and Test B for AnotherExample's known-good second origin.
- Do not proxy or server-fetch arbitrary target URLs; tests are generated for the developer to run in their own browser context.
- Interpret the A/B comparison without pretending JavaScript can see browser-only CORS error details.


---

## STOP POINT — August 27, 2026

V1.1 preview is intentionally paused here. Do not merge to `main` yet.

### What is working
- The product direction is now a **CORS diagnostic/debugging tool**, not merely a generic CORS playground.
- The front door asks for:
  - **Your page URL** — where the browser request originates.
  - **Target API URL** — the API/resource the developer is trying to reach.
- **Build diagnostic tests** works and reveals the next diagnostic section.
- The controlled comparison concept is established:
  - **Test A:** the developer's real target API.
  - **Test B:** AnotherExample's known-good second origin.
- Preview second origin: `https://cors-preview.anotherexample.com`
- Intended production second origin: `https://cors.anotherexample.com`
- Real-browser CORS scenarios were previously validated after Vercel Authentication was disabled.
- Client IP information is omitted from request echo output.

### UX issue discovered at stop point
The post-click transition is not obvious enough. The button works, but the page scroll/reveal can make it appear that nothing happened.

### NEXT SESSION — immediate work
1. Change the page/product label from **CORS Playground** to **CORS Debugger** (working choice).
2. Make the post-click state unmistakable:
   - prominent **Your diagnostic is ready** heading;
   - show Test A and Test B immediately;
   - clearly explain the three comparison outcomes.
3. Move **Configure the request** below the primary diagnostic flow.
4. Rename it **Advanced options** and collapse it by default.
5. Retest the complete page URL → target API URL → diagnostic workflow on desktop.
6. Test GET first, then POST/preflight and credentials.
7. Only after the UX and browser behavior are solid, prepare V1.1 for merge to `main`.

### Product positioning
Primary user problem:
> **My CORS request is failing. Tell me why.**

AnotherExample's differentiator is the controlled comparison against a real, known-good second origin. It should help a developer distinguish among frontend/request-shape problems, target API CORS configuration, and browser-enforced CORS behavior.

Avoid positioning AnotherExample as a CORS proxy. Arbitrary target URLs should not be fetched server-side merely to imitate a proxy; preserve real browser enforcement and avoid open-proxy/SSRF risk.

### Discovery / SEO plan
Build search discovery around real developer problems and browser error language rather than generic keyword pages.

Initial topic/query targets:
- why isn't my CORS working
- why am I getting a CORS error
- how to fix a CORS error
- CORS works in Postman/curl but not browser
- CORS preflight failed
- No Access-Control-Allow-Origin header
- CORS Failed to fetch
- CORS credentials wildcard error
- OPTIONS request CORS error
- CORS works locally but not in production

Future focused pages may include:
- `/cors/access-control-allow-origin-missing`
- `/cors/preflight-failed`
- `/cors/credentials-wildcard`
- `/cors/failed-to-fetch`

Each problem page should explain the specific failure clearly and lead naturally into the **CORS Debugger** so the visitor can test rather than only read.

SEO principle: useful problem-specific content first; no thin keyword-variant pages or keyword stuffing.

### Later roadmap — after V1.1
- Visual Request Debugger.
- OpenAPI mock-data generator.
- Live OpenAPI mock APIs.
- Saved request history/shareable configurations.
- Cookie/SameSite testing.
- iframe/CSP/framing testing.
- Redirect/referrer/origin/postMessage/cross-origin-isolation tools.
- Monetization only after usage signals justify it: persistent/private endpoints, saved configurations, API keys/higher limits, teams/shared environments, and related infrastructure features.

### Resume point
When work resumes, start with the **post-click diagnostic UX**. Do not reopen the broader product strategy unless testing uncovers a reason to do so.

## V1.1 — CORS Debugger iteration (August 28, 2026)
- Renamed primary tool **CORS Debugger**.
- Hero targets the user/search problem: **“Why won’t my CORS work?”**
- Primary action: **Start CORS diagnosis**.
- Post-click state begins with prominent **DIAGNOSTIC READY** and Test A/Test B.
- Comparison outcomes appear beside the tests.
- Request configuration moved into collapsed **Advanced options**.
- Next validation: desktop workflow, GET, POST/preflight, credentials, then production-readiness review.
- SEO/discovery remains planned around real CORS failure-language queries and focused problem pages; avoid thin keyword variants.
