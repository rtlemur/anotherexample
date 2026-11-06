const primaryOrigin = "https://anotherexample.com";
const secondOrigin = "https://cors.anotherexample.com";
const lab = "/api/cors/lab";
export const methods = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];

export function controlOriginFor(pageOrigin) {
  return pageOrigin === secondOrigin ? primaryOrigin : secondOrigin;
}

export function supportsProbe(url) {
  const endpoint = new URL(url);
  return [primaryOrigin, secondOrigin].includes(endpoint.origin) &&
    ["/api/cors/open", "/api/cors/credentials", lab].includes(endpoint.pathname) &&
    [...endpoint.searchParams.keys()].every(key => ["allowOrigin", "credentials", "preflightStatus", "headers", "status"].includes(key));
}
const simpleMethods = ["GET", "HEAD", "POST"];
const jsonRequest = { method: "POST", contentType: "application/json", body: '{"example":true}' };
const scenarioSettings = {
  simple: { url: lab + "?allowOrigin=*", expected: "readable", status: 200 },
  json: { ...jsonRequest, url: lab + "?allowOrigin=*", expected: "readable", status: 200 },
  origin: { url: lab + "?allowOrigin=none", expected: "failed" },
  "wrong-origin": { url: lab + "?allowOrigin=https://wrong.example", expected: "failed" },
  options: { ...jsonRequest, url: lab + "?allowOrigin=*&preflightStatus=403", expected: "failed" },
  headers: { headers: "X-Client: playground", url: lab + "?allowOrigin=*&headers=Content-Type", expected: "failed" },
  credentials: { url: lab + "?allowOrigin=*&credentials=true", credentials: "include", expected: "failed" },
  reflected: { url: lab + "?allowOrigin=echo&credentials=true", credentials: "include", expected: "readable", status: 200 },
  http: { url: lab + "?allowOrigin=*&status=401", expected: "readable", status: 401 },
};
export function scenariosFor(pageOrigin) {
  const controlOrigin = controlOriginFor(pageOrigin);
  return Object.fromEntries(Object.entries(scenarioSettings).map(([name, settings]) =>
    [name, { ...settings, url: controlOrigin + settings.url }]));
}

const token = /^[!#$%&'*+.^_|~0-9a-z-]+$/i;
const forbiddenHeader = /^(?:accept-charset|accept-encoding|access-control-request-headers|access-control-request-method|connection|content-length|cookie2?|date|dnt|expect|host|keep-alive|origin|referer|set-cookie|te|trailer|transfer-encoding|upgrade|user-agent|via|proxy-.*|sec-.*)$/i;
const unsafeBytes = /[\x00-\x08\x0a-\x1f"():<>?@[\]{}\x7f]/;
const textTypes = ["application/x-www-form-urlencoded", "multipart/form-data", "text/plain"];
const headerNames = new Set(["accept", "accept-language", "content-language", "content-type", "range"]);
export const evidenceHeaders = [
  "access-control-allow-origin", "access-control-allow-credentials", "access-control-allow-methods",
  "access-control-allow-headers", "access-control-max-age", "location", "vary",
];

export function parseHeaders(text) {
  const headers = new Headers();
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    const colon = line.indexOf(":");
    const name = line.slice(0, Math.max(0, colon)).trim();
    if (!token.test(name)) throw new Error("Header line " + (index + 1) + " needs a valid name followed by a colon.");
    if (forbiddenHeader.test(name)) throw new Error("The browser manages " + name + ". Remove it from the header list.");
    const value = line.slice(colon + 1).trim();
    if (/^x-http-method(?:-override)?$|^x-method-override$/i.test(name) && /(?:^|,)\s*(CONNECT|TRACE|TRACK)\s*(?:,|$)/i.test(value)) {
      throw new Error("The browser disallows the method override on line " + (index + 1) + ".");
    }
    if (headers.has(name) && name.toLowerCase() === "content-type") throw new Error("Enter a single Content-Type.");
    try { headers.append(name, value); }
    catch { throw new Error("Header line " + (index + 1) + " contains an invalid value."); }
  }
  return headers;
}

function mimeType(value = "") {
  return value.split(";", 1)[0].trim().toLowerCase();
}

function safelisted(name, value) {
  if (!headerNames.has(name) || value.length > 128) return false;
  if (name === "accept") return !unsafeBytes.test(value);
  if (name === "content-type") return !unsafeBytes.test(value) && textTypes.includes(mimeType(value));
  if (name === "range") {
    const range = /^bytes=(\d+)-(\d*)$/.exec(value);
    return Boolean(range && (!range[2] || BigInt(range[1]) <= BigInt(range[2])));
  }
  return /^[0-9a-z *,.;=-]*$/i.test(value);
}

export function preflightShape(method, headers, crossOrigin) {
  const names = [...headers].filter(([name, value]) => !safelisted(name, value)).map(([name]) => name).sort();
  const methodNeedsCheck = !simpleMethods.includes(method);
  return { required: crossOrigin && (methodNeedsCheck || names.length > 0), names, methodNeedsCheck, crossOrigin };
}

export function makeConfig(fields, pageOrigin) {
  let url;
  try { url = new URL(fields.url.trim()); }
  catch { throw new Error("Enter a complete target URL, starting with https:// or http://."); }
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("Use an HTTP or HTTPS URL without a username or password.");
  }
  url.hash = "";
  const headers = parseHeaders(fields.headers);
  const bodyAllowed = !["GET", "HEAD"].includes(fields.method);
  const body = bodyAllowed && fields.body.length ? fields.body : undefined;
  if (body && new TextEncoder().encode(body).length > 16384) throw new Error("Keep the request body under 16 KB.");
  if (bodyAllowed && !headers.has("content-type") && (fields.contentType || body !== undefined)) {
    headers.set("content-type", fields.contentType || "text/plain;charset=UTF-8");
  }
  const expectedStatus = fields.expected === "readable" && fields.status !== "" ? Number(fields.status) : null;
  if (expectedStatus !== null && (!Number.isInteger(expectedStatus) || expectedStatus < 200 || expectedStatus > 599)) {
    throw new Error("Enter an HTTP status from 200 to 599, or leave it blank.");
  }
  return {
    url: url.href, method: fields.method, headers, body, credentials: fields.credentials, redirect: fields.redirect,
    expected: fields.expected, expectedStatus, shape: preflightShape(fields.method, headers, url.origin !== pageOrigin),
  };
}

export function makeControl(target, pageOrigin) {
  const headers = new Headers();
  for (const [name, value] of target.headers) {
    const safe = safelisted(name, value);
    if (name === "content-type") {
      const type = mimeType(value);
      if (safe) headers.set(name, type);
      else headers.set(name, type === "application/json" ? type : "application/octet-stream");
    } else if (name === "range" && safe) {
      headers.set(name, "bytes=0-0");
    } else if (name === "authorization") {
      headers.set(name, "Bearer anotherexample-control");
    } else if (headerNames.has(name) && !safe) {
      headers.set(name, "x".repeat(129));
    } else {
      headers.set(name, name === "accept" ? "*/*" : name.endsWith("-language") ? "en" : "sample");
    }
  }
  const type = headers.get("content-type");
  let body;
  if (target.body !== undefined) {
    if (type === "application/json") body = '{"control":true}';
    else if (type === "application/x-www-form-urlencoded") body = "example=control";
    else body = "control";
  }
  const endpoint = target.credentials === "include" ? "credentials" : "open";
  return {
    ...target, url: controlOriginFor(pageOrigin) + "/api/cors/" + endpoint, headers, body,
    expected: "readable", expectedStatus: target.method === "OPTIONS" ? 204 : 200,
    shape: preflightShape(target.method, headers, true),
  };
}

export function compare(config, result) {
  if (result.kind === "timeout" || result.kind === "unexpected") return { text: "Inconclusive", tone: "warn" };
  const matches = config.expected === result.kind && (config.expectedStatus === null || config.expectedStatus === result.status);
  return matches ? { text: "Matches expected", tone: "good" } : { text: "Mismatch", tone: "bad" };
}

function list(value) {
  return value ? value.split(",").map(item => item.trim()).filter(Boolean) : [];
}

export function checkPreflight(config, evidence, origin) {
  if (!evidence) return null;
  const headers = evidence.headers;
  const credentialed = config.credentials === "include";
  const allowOrigin = headers["access-control-allow-origin"];
  if (evidence.status >= 300 && evidence.status < 400) {
    return ["The OPTIONS response redirected (HTTP " + evidence.status + ").", "Use the final HTTPS URL and have it answer OPTIONS directly."];
  }
  if (evidence.status < 200 || evidence.status >= 300) {
    return ["The OPTIONS response returned HTTP " + evidence.status + ".", "Allow unauthenticated OPTIONS to reach the CORS handler, then rerun the same request."];
  }
  if (!allowOrigin) return ["The OPTIONS response is missing Access-Control-Allow-Origin.", "Allow the request origin on OPTIONS and on the actual response, then rerun."];
  if (allowOrigin !== origin && (allowOrigin !== "*" || credentialed)) {
    return [credentialed && allowOrigin === "*" ? "Wildcard allow-origin conflicts with credentials." : "The OPTIONS allow-origin value doesn’t match this page’s origin.",
      "Return the exact origin " + origin + " and add Vary: Origin when selecting it dynamically."];
  }
  if (credentialed && headers["access-control-allow-credentials"] !== "true") {
    return ["The OPTIONS response doesn’t allow credentials.", "Return Access-Control-Allow-Credentials: true on OPTIONS and the actual response, or retest with credentials omitted."];
  }
  const allowedMethods = list(headers["access-control-allow-methods"]);
  if (config.shape.methodNeedsCheck && !allowedMethods.includes(config.method) && (credentialed || !allowedMethods.includes("*"))) {
    return [config.method + " is missing from Access-Control-Allow-Methods.", "Allow " + config.method + " in the OPTIONS response and rerun."];
  }
  const allowedHeaders = list(headers["access-control-allow-headers"]).map(name => name.toLowerCase());
  const missing = config.shape.names.filter(name => !allowedHeaders.includes(name) &&
    (name === "authorization" || credentialed || !allowedHeaders.includes("*")));
  if (missing.length) {
    return ["The OPTIONS response doesn’t allow " + missing.join(", ") + ".", "Add the missing names to Access-Control-Allow-Headers, or remove them from the request and retest."];
  }
  return null;
}

export function diagnosis(config, control, target, evidence, origin) {
  const status = compare(config, target);
  if (target.kind === "timeout") return ["Target timed out", "The browser exceeded the 10-second limit.", "Check the URL and server latency, then retry with a lightweight endpoint."];
  if (target.kind === "unexpected") return ["Browser response unavailable", "The browser returned a response the playground couldn’t inspect.", "Check the Network tab and rerun from the original application origin."];
  if (target.kind === "readable") {
    if (status.tone === "bad") return ["The target response was readable",
      config.expected === "failed" ? "This origin was allowed. The original application may send from a different origin or use different credentials." : "The browser received HTTP " + target.status + " instead of the expected HTTP " + config.expectedStatus + ".",
      config.expected === "failed" ? "Compare the original app’s Origin, headers, and credentials in DevTools." : "Check the target’s response body, authentication, and URL, then rerun."];
    if (target.status >= 400) return ["Readable HTTP " + target.status, "The browser could read the server’s error response.", "Use the response details to check the application’s authentication, route, or input."];
    return ["Target matched the expectation", "The browser could read the target response from this origin."];
  }
  if (control.kind !== "readable") {
    return ["Control also failed", "A shared network, browser, or request issue may be involved.", "Try the Simple GET test case first. Check network access and DevTools if it fails."];
  }
  const preflightFailure = checkPreflight(config, evidence, origin);
  if (preflightFailure) return ["Likely cause · preflight", ...preflightFailure];
  const url = new URL(config.url);
  if (origin.startsWith("https:") && url.protocol === "http:" && !/^(localhost|.*\.localhost|127(?:\.\d{1,3}){3}|\[::1\])$/.test(url.hostname)) {
    return ["Likely cause · mixed content", "An HTTPS page normally cannot fetch this HTTP target.", "Use the target’s HTTPS URL and rerun."];
  }
  const scenarios = scenariosFor(origin);
  if (config.url === scenarios.origin.url && config.shape.crossOrigin) {
    return ["Likely cause · missing allow-origin", "This test endpoint omits Access-Control-Allow-Origin.", "Switch to Simple GET or allow this page’s origin on the actual response and rerun."];
  }
  if (config.url === scenarios["wrong-origin"].url && config.shape.crossOrigin) {
    return ["Likely cause · origin mismatch", "This test endpoint allows https://wrong.example.",
      "Configure the endpoint to allow " + origin + " and rerun."];
  }
  if (config.url === scenarios.credentials.url && config.credentials === "include" && config.shape.crossOrigin) {
    return ["Likely cause · credentials with wildcard", "This test endpoint returns Access-Control-Allow-Origin: *.", "Set credentials to Omit and rerun, or configure an explicit allow-origin plus Access-Control-Allow-Credentials: true."];
  }
  if (config.shape.required && evidence) {
    return ["The OPTIONS probe allowed this request", "The browser still failed. The actual response, redirect chain, or browser policy may differ from the probe.", "Inspect the OPTIONS and actual request in DevTools. Check CORS headers on every response, including errors."];
  }
  if (config.shape.required) return ["Likely causes · OPTIONS or actual response", "The browser couldn’t provide a readable response. A failed preflight, CORS headers on the actual response, or a network error can look alike here.", "Check OPTIONS in DevTools or run the generated command. Remove one custom header or use GET on a safe endpoint, then rerun."];
  if (config.credentials === "include") return ["Likely causes · origin or credentials policy", "Credentialed cross-origin reads require an explicit allow-origin and Access-Control-Allow-Credentials: true.", "Omit credentials for one retest, then check DevTools for the exact browser error."];
  return ["Likely causes · response policy or network", "The browser couldn’t provide a readable response. Missing allow-origin, redirects, and network failures can look alike here.",
    "Open DevTools and check the actual response for Access-Control-Allow-Origin. If it never arrived, check the URL, TLS, and connectivity."];
}

export function fetchSnippet(config) {
  const options = { method: config.method, mode: "cors", credentials: config.credentials, redirect: config.redirect,
    referrerPolicy: "no-referrer" };
  if ([...config.headers].length) options.headers = Object.fromEntries(config.headers);
  if (config.body !== undefined) options.body = config.body;
  return "const response = await fetch(" + JSON.stringify(config.url) + ", " + JSON.stringify(options, null, 2) + ");\n" +
    'console.log("HTTP", response.status, Object.fromEntries(response.headers), await response.text());';
}

const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";
export function preflightCommand(config, origin) {
  const args = ["curl -sS -D - -o /dev/null --max-time 12 -X OPTIONS", "-H " + quote("Origin: " + origin),
    "-H " + quote("Access-Control-Request-Method: " + config.method)];
  if (config.shape.names.length) args.push("-H " + quote("Access-Control-Request-Headers: " + config.shape.names.join(", ")));
  args.push("-- " + quote(config.url));
  return args.join(" \\\n  ");
}

export function parseEvidence(text) {
  const lines = text.trim().split(/\r?\n/);
  let status = null;
  let headers = {};
  for (const line of lines) {
    const match = /^HTTP\/\S+\s+([2-5]\d\d)(?:\s|$)/i.exec(line);
    if (match) { status = Number(match[1]); headers = {}; continue; }
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const name = line.slice(0, colon).trim().toLowerCase();
    if (!evidenceHeaders.includes(name)) continue;
    const value = line.slice(colon + 1).trim();
    headers[name] = name in headers ? headers[name] + ", " + value : value;
  }
  if (status === null) throw new Error("Paste the curl output including an HTTP status line, such as HTTP/2 204.");
  return { status, headers, source: "Pasted OPTIONS response" };
}
