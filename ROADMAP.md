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


## V1.1 — Diagnostic workflow refinement
- Use **Request origin / page URL** language so beginners can enter a URL while experienced developers see the origin model immediately.
- Replace **known-good** wording with **controlled second origin** and use **narrow down** rather than overclaiming certainty.
- Make the post-click task explicit: open DevTools on the real page and run Test A and Test B from that browser origin.
- Keep generated JavaScript available but secondary. Default UI shows concise request summaries rather than long query-string URLs.
- Preserve technical honesty: typing an external URL does not let AnotherExample execute code from that origin.
- State explicitly that A/B comparison narrows likely causes but does not prove a unique root cause.
- Future opportunity: structured result paste/import or a lightweight helper, only if it preserves true page-origin execution and does not introduce unsafe proxy behavior.


## V1.1 — Diagnosis button state fix
- Keep **Start CORS diagnosis** as the permanent primary action label.
- Show **Diagnostic ready** as separate text beside the button after a diagnostic is prepared.
- If the origin, target URL, body, or request options change, invalidate the previous diagnostic immediately:
  - hide stale diagnostic output,
  - show **Inputs changed — run diagnosis again** beside the button,
  - keep the button active and labeled **Start CORS diagnosis**.
- A page reload is no longer required to start a second diagnosis.


# STOP POINT — August 28, 2026

Do not merge V1.1 to `main` yet. Current work remains on `v1.1-preview`.

## Current product state
- V1.1 is now positioned as **CORS Debugger**.
- Front door accepts **Request origin / page URL** and **Target API URL**.
- Primary CTA remains **Start CORS diagnosis**.
- Diagnostic readiness is separate status text; changing inputs invalidates the previous diagnostic and allows another run without reloading.
- Post-click workflow presents:
  - **Test A — Your real API**
  - **Test B — Controlled origin**
  - concise request summaries
  - Copy Test buttons
  - generated code hidden until requested
  - interpretation guidance
- Language uses **controlled second origin** and **narrow down** rather than overclaiming a definitive diagnosis.
- Tests must be run from the developer's actual page/browser origin. AnotherExample does not crawl, proxy, or execute arbitrary code from a typed external URL.

## Functional validation completed
1. **Controlled cross-origin GET success — PASS**
   - Test B returned HTTP 200 from `cors-preview.anotherexample.com`.
2. **Real non-CORS network failure observed**
   - `api.jsonplaceholder.dev/posts/1` timed out with `net::ERR_TIMED_OUT`.
   - Important product lesson: `TypeError: Failed to fetch` is not necessarily CORS.
3. **Missing Access-Control-Allow-Origin — PASS**
   - Deliberate `allowOrigin=none` test was blocked by Chrome with:
     `No 'Access-Control-Allow-Origin' header is present on the requested resource.`
4. **POST + application/json + successful preflight — PASS**
   - POST returned HTTP 200 with the lab configured to allow the request.
   - Controlled Test B also returned HTTP 200.
5. **Preflight method rejection — PASS**
   - PUT + JSON against a lab response advertising only GET was blocked by Chrome with:
     `Method PUT is not allowed by Access-Control-Allow-Methods in preflight response.`

## Testing lessons
- Chrome may show its self-XSS warning and require the user to type `allow pasting` before pasted DevTools snippets are accepted. This is real UX friction in the current copy/paste workflow.
- Console `TypeError: Failed to fetch` is generic; DevTools Console/Network details are needed to distinguish CORS from DNS, timeout, TLS, redirect, connectivity, and other failures.
- A POST can trigger preflight because of `Content-Type: application/json`, but POST itself is a CORS-safelisted method. For a clean Access-Control-Allow-Methods rejection test, PUT was used.
- Do not encode the earlier mistaken assumption that POST must be rejected when ACA-Methods advertises GET; the validated method-rejection case is PUT.

## Next session — resume here
Run the credentials matrix:
1. **Credentials + wildcard origin** — expected browser CORS failure.
2. **Credentials + echoed/requesting origin** — expected success.
3. Verify Test A and Test B behavior for both.
4. Record exact Chrome errors/results.
5. Then review remaining edge cases: malformed URL, unreachable server, redirects, HTTP/HTTPS, and any request-header/preflight cases worth including.
6. Update interpretation copy so **A fails, B works** explicitly includes connectivity/DNS/TLS/redirect/server-response possibilities, not only CORS configuration.
7. Reassess whether DevTools copy/paste is acceptable for V1.1 or whether a later structured-result/helper workflow belongs on the roadmap.
8. Only after the functional matrix is satisfactory should V1.1 be prepared for merge to `main` and production `cors.anotherexample.com`.

## Immediate next test
Start with **credentials + wildcard origin**. Keep the production branch untouched until the credentials and remaining core tests pass.


# ROADMAP UPDATE — August 29, 2026

## Product direction
Continue deeper as a **CORS diagnostic workflow**, not broader as a generic CORS playground.

**Core promise:** “My browser request is failing. Help me narrow down why.”

The differentiator remains the controlled comparison:
- **Test A — Your real API**
- **Test B — AnotherExample controlled second origin**
- Both use the same request shape and are run from the developer's actual page/browser origin.

The A/B result narrows the investigation; it must not be presented as proof of one root cause.

## Immediate work — finish validation
1. Credentials + wildcard origin — expected browser CORS failure.
2. Credentials + echoed/requesting origin — expected success when credentials and explicit origin are permitted.
3. Record exact browser results.
4. Test malformed URLs, unreachable/timeouts, redirects, relevant HTTP/HTTPS/secure-context behavior, and disallowed request headers/preflight.
5. Update interpretation copy from observed browser behavior.

## V1.1 next feature — Paste Console Result / Explain This Error

### Workflow
**Step 1 — Describe the request**
Origin/page URL, target API URL, method, credentials, and headers/body as needed.

**Step 2 — Run the controlled comparison**
Test A against the real target and Test B against AnotherExample, from the real browser origin.

**Step 3 — Paste the browser result**
Add a prominent **Paste Console Result** / **Explain this browser error** input.

**Step 4 — Explain and narrow down**
Classify recognizable errors deterministically where possible and explain:
- what the browser reported,
- which phase failed (network, preflight, response, credentials, etc.),
- implicated CORS header/request property,
- what to inspect next,
- when evidence is insufficient to call it CORS.

### Initial deterministic classifications
Prioritize:
- missing `Access-Control-Allow-Origin`
- origin mismatch
- wildcard origin with credentials
- method not allowed by `Access-Control-Allow-Methods`
- header not allowed by `Access-Control-Allow-Headers`
- preflight/OPTIONS redirect or rejection
- generic `TypeError: Failed to fetch`
- `ERR_TIMED_OUT`
- recognizable DNS/name-resolution failures
- recognizable TLS/certificate failures
- redirect failures
- other network/server failures where evidence is sufficient

## Interpretation rules
**A fails / B works:** Controlled cross-origin request succeeded. Investigate the target side first: connectivity, DNS, TLS, redirects, authentication, server response, request configuration, or CORS. Use the browser error to narrow further.

**A works / B works:** Basic cross-origin access works for the generated request shape. Compare the exact failing app request: method, headers, body, credentials, and environment.

**A fails / B fails:** Comparison alone is insufficient. Compare both browser errors and inspect request shape, environment, connectivity, browser policy, credentials, extensions, and CORS. Do not claim it cannot be CORS.

## UX direction
- Keep **Start CORS diagnosis** as the permanent CTA.
- Keep readiness/status text separate.
- Keep generated JavaScript secondary/hidden by default.
- Preserve privacy message: AnotherExample does not crawl, proxy, or modify the target.
- Consider scannable Test A/Test B result cards after functionality is proven.
- Test expanded-code responsiveness before changing the two-column layout.
- Chrome's DevTools paste warning is known workflow friction and should remain on the usability list.

## Technical guardrails
- `Failed to fetch` is not synonymous with CORS.
- The A/B matrix alone does not identify a root cause.
- DevTools Console/Network detail is key evidence.
- Do not add an incorrect generic warning about HTTP pages requesting the HTTPS control endpoint as “mixed content”; test secure-context/cookie/localhost/PNA nuances separately.
- Do not add arbitrary server-side URL fetching/proxying; preserve true browser-origin testing and avoid SSRF/open-proxy risk.

## Product strategy
1. Finish/validate CORS diagnostic core.
2. Add deterministic **Paste Console Result / Explain This Error**.
3. Test whether developers understand and use it.
4. Improve DevTools handoff if copy/paste friction proves material.
5. Build SEO/problem pages around real errors the debugger explains.
6. Measure usage and repeat behavior.
7. Then evaluate monetization.

Potential later paid features:
- persistent/private configurable endpoints
- saved diagnostics/history/configurations
- shareable debugging sessions
- higher rate limits/API keys
- team/shared environments
- retention/business controls

Do not add accounts, billing, database infrastructure, or AI-dependent diagnosis merely to enlarge V1.1. Classify common browser errors deterministically first so the tool remains fast, predictable, inexpensive, and privacy-conscious.

## V1.1 “finished enough to ship”
Ship when:
- core CORS matrix is validated in a real browser,
- stale-state/input bugs are fixed,
- wording does not overclaim,
- A/B workflow is understandable without documentation,
- common pasted browser errors can be classified/explained usefully,
- unknown cases clearly say when cause cannot be determined,
- preview hostname is replaced by the permanent production controlled origin,
- production is retested before merging to `main`.

## Iteration — Credentials validation build
Prepared the next preview iteration specifically for the two remaining credential checks. Scenario wording now labels the expected browser behavior without changing the underlying lab mechanics:
- Credentials + wildcard — expected browser block.
- Credentials done right — expected success with reflected requesting origin and `Access-Control-Allow-Credentials: true`.

Next action: upload this build to `v1.1-preview`, then run and record both cases before making further functional changes.

## Setup workflow repair — August 29, 2026
The diagnosis setup is now intentionally uninterrupted:

1. Request origin / page URL
2. Target API URL
3. Advanced request options (collapsed)
4. Try a CORS scenario
5. Start CORS diagnosis
6. Diagnostic results

Additional UX clarification:
- `Test B — Allow-Origin response` renamed to `Controlled comparison — Allow-Origin response`.
- Test A continues to use the Target API URL exactly as entered.
- Named scenario selection is shown explicitly.
- Manually changing scenario/request settings clears the named preset and shows `Custom configuration`.
- Copy Test A and Copy Test B remain preserved in the diagnostic results.

No production merge. Validate on v1.1-preview first.

## Request-options cleanup — August 29, 2026
- Renamed `Advanced request options` to `Request options`.
- Clarified normal request settings versus controlled-comparison response settings.
- Removed the competing `Run test from this playground` primary button from the setup workflow.
- `Start CORS diagnosis` is now the single primary action for the diagnostic setup.
- Preserved Copy Test A / Copy Test B and existing scenario presets.

## Four-step diagnostic workflow — August 29, 2026
The setup is now presented as a diagnostic procedure rather than a generic form:

1. **What are you testing?** — request origin and target API.
2. **Describe the request** — method, credentials, JSON body; applies to both tests.
3. **Configure the controlled comparison** — optional/collapsible; affects AnotherExample only.
4. **Try a CORS scenario** — optional presets; selecting one fills the relevant request/comparison settings.

`Start CORS diagnosis` remains the single primary action after all setup steps.
The diagnostic result area still contains Copy Test A and Copy Test B.
