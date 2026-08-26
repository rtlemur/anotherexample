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
- Generated fetch and curl examples
- Plain-English explanation of expected browser behavior
- Basic API rate limiting
- Automated API tests
- Privacy/acceptable-use notes and security contact path

## V1.2 — True two-origin demonstration
- Add a deliberately separate hostname/origin for the playground
- Let visitors observe real browser CORS enforcement without bringing their own app
- Verify credentialed requests and preflight behavior across the two origins

## Future tools
Build only if usage/search data supports them:
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
- OpenAPI and enterprise features until demand exists

## Success signals
- Repeat visitors
- Growth in `/cors` usage
- Developers linking to or bookmarking AnotherExample
- Organic search traffic to specific testing problems
- Requests for persistence, privacy, higher limits, or team features
