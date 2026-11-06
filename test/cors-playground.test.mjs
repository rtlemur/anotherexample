import assert from "node:assert/strict";
import { test } from "node:test";
import request from "supertest";
import app from "../server.js";
import {
  checkPreflight, compare, diagnosis, fetchSnippet, makeConfig, makeControl,
  parseEvidence, preflightCommand, scenariosFor,
} from "../public/cors-playground-core.mjs";
import { runPreflightProbe } from "../lib/cors-playground-probe.mjs";

const origin = "https://anotherexample.com";
const otherOrigin = "https://cors.anotherexample.com";
const scenarios = scenariosFor(origin);
const configure = (overrides, pageOrigin = origin) => makeConfig({
  url: "https://api.example.test/data", method: "GET", headers: "", body: "", contentType: "",
  credentials: "omit", redirect: "follow", expected: "readable", status: "", ...overrides,
}, pageOrigin);

test("Playground serves the live comparison and retains the code and URL copy controls", async () => {
  const { text } = await request(app).get("/cors/playground").expect(200);
  assert.match(text, /Run comparison/);
  assert.match(text, /id="copyFetch"/);
  assert.match(text, /id="copyUrl"/);
  assert.match(text, /type="module" src="\/cors-playground\.mjs\?v=2"/);
  const { text: entry } = await request(app).get("/cors-playground.mjs?v=2")
    .expect("Content-Type", /javascript/).expect("Cache-Control", "no-store").expect(200);
  assert.match(entry, /from "\/cors-playground-core\.mjs\?v=2"/);
  await request(app).get("/cors-playground-core.mjs?v=2")
    .expect("Content-Type", /javascript/).expect("Cache-Control", "no-store").expect(200);
});

test("built-in cases and controls use the other origin on either production hostname", () => {
  for (const [pageOrigin, expected] of [[origin, otherOrigin], [otherOrigin, origin]]) {
    for (const example of Object.values(scenariosFor(pageOrigin))) {
      const target = configure(example, pageOrigin);
      assert.equal(new URL(target.url).origin, expected);
      assert.equal(target.shape.crossOrigin, true);
      assert.equal(new URL(makeControl(target, pageOrigin).url).origin, expected);
    }
  }
});

test("control keeps method, credentials and preflight shape while substituting sample data", () => {
  const target = configure({ method: "PATCH", headers: "Authorization: Bearer PRIVATE\nX-Key: private\nAccept: A:B",
    body: '{"private":true}', contentType: "application/json", credentials: "include" });
  const control = makeControl(target, origin);
  assert.deepEqual(target.shape.names, ["accept", "authorization", "content-type", "x-key"]);
  assert.equal(control.method, target.method);
  assert.equal(control.credentials, target.credentials);
  assert.deepEqual(control.shape, target.shape);
  assert.match(control.url, /\/credentials$/);
  assert.doesNotMatch(JSON.stringify([...control.headers]) + control.body, /private/i);
  assert.equal(control.body, '{"control":true}');
});

test("a readable HTTP error differs from a browser failure and OPTIONS evidence explains a mismatch", () => {
  const http = configure(scenarios.http);
  assert.equal(compare(http, { kind: "readable", status: 401 }).tone, "good");
  assert.equal(compare(http, { kind: "failed" }).tone, "bad");
  assert.equal(compare(http, { kind: "timeout" }).tone, "warn");
  const target = configure(scenarios.headers);
  const evidence = parseEvidence("HTTP/1.1 200 Connection established\r\n\r\nHTTP/2 204\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Headers: Content-Type\r\n");
  assert.match(checkPreflight(target, evidence, origin)[0], /x-client/);
  assert.match(diagnosis(target, { kind: "readable" }, { kind: "failed" }, evidence, origin)[0], /preflight/);
});

test("generated snippets preserve the target request and leave Origin to the browser", () => {
  const target = configure({ method: "POST", url: "https://api.example.test/o'clock",
    headers: "Authorization: Bearer EXAMPLE", body: 'double " quotes' });
  const snippet = fetchSnippet(target);
  assert.match(snippet, /Bearer EXAMPLE/);
  assert.ok(snippet.includes(JSON.stringify(target.body)));
  assert.doesNotMatch(snippet, /"Origin"/);
  assert.ok(preflightCommand(target, origin).includes("o'\\''clock"));
  assert.doesNotMatch(preflightCommand(target, origin), /Bearer/);
  assert.throws(() => configure({ headers: "Origin: https://other.test" }), /browser manages/);
});

test("the probe route rejects unrelated URLs and sends credential-free OPTIONS to the lab only", async () => {
  const input = { url: "https://api.example.test/data", origin, method: "POST", names: ["content-type"] };
  await request(app).post("/api/cors/preflight-probe").send(input).expect(400);
  await request(app).post("/api/cors/preflight-probe").send({ ...input, url: otherOrigin + "/api/redirect" }).expect(400);
  await request(app).post("/api/cors/preflight-probe").send({ ...input, url: scenarios.json.url + "&target=other" }).expect(400);
  const result = await runPreflightProbe({ ...input, url: scenarios.json.url }, async (url, options) => {
    assert.equal(url, scenarios.json.url);
    assert.equal(options.method, "OPTIONS");
    assert.equal(options.redirect, "manual");
    assert.deepEqual(options.headers, { Origin: origin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type" });
    return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "X-Extra": "ignored" } });
  });
  assert.deepEqual(result, { status: 200, body: { source: "Separate OPTIONS probe", status: 204, headers: { "access-control-allow-origin": "*" } } });
});
