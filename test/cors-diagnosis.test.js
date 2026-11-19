const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// Exercise the actual DOM-independent parser without executing page handlers.
const source = fs.readFileSync(path.join(__dirname, '../public/cors-diagnosis.js'), 'utf8');
const parser = source;
const diagnose = vm.runInNewContext(parser + '\nfindBrowserDiagnosis', {URL});

const families = {
  'missing-origin': [
    "Chrome: No 'Access-Control-Allow-Origin' header is present on the requested resource.",
    'missing Access-Control-Allow-Origin',
    'Firefox: CORS header ‘Access-Control-Allow-Origin’ missing',
    'Safari: Origin https://client.example is not allowed by Access-Control-Allow-Origin.',
  ],
  'origin-mismatch': [
    "The 'Access-Control-Allow-Origin' header has a value 'https://other.example' that does not match the supplied origin.",
    "CORS header 'Access-Control-Allow-Origin' does not match 'https://client.example'",
    'Access-Control-Allow-Origin returned a different origin',
    'Returned origin does not match requesting origin',
  ],
  'credentials-wildcard': [
    "The value of the 'Access-Control-Allow-Origin' header must not be the wildcard '*' when the request's credentials mode is 'include'.",
    "Credential is not supported if the CORS header 'Access-Control-Allow-Origin' is '*'",
    'Access-Control-Allow-Origin: * used with credentials',
    'Credentialed requests require an explicit origin',
  ],
  'allow-credentials': [
    "The value of the 'Access-Control-Allow-Credentials' header in the response is '' which must be 'true' when the request's credentials mode is 'include'.",
    "Reason: expected 'true' in CORS header 'Access-Control-Allow-Credentials'",
    'Credentials requested but Access-Control-Allow-Credentials missing',
    'Access-Control-Allow-Credentials invalid value false',
  ],
  method: [
    'Method PUT is not allowed by Access-Control-Allow-Methods in preflight response.',
    "Did not find method in CORS header 'Access-Control-Allow-Methods'",
    "invalid token 'bad method' in CORS header 'Access-Control-Allow-Methods'",
    'Requested method absent from Access-Control-Allow-Methods',
  ],
  header: [
    'Request header field authorization is not allowed by Access-Control-Allow-Headers in preflight response.',
    "missing token 'authorization' in CORS header 'Access-Control-Allow-Headers' from CORS preflight channel",
    "invalid token 'bad header' in CORS header 'Access-Control-Allow-Headers'",
    'Requested header absent from Access-Control-Allow-Headers',
  ],
  preflight: [
    "Response to preflight request doesn't pass access control check: It does not have HTTP ok status.",
    'CORS preflight channel did not succeed',
    'Preflight response is not successful',
    'Preflight response unsuccessful',
    'OPTIONS request rejected',
    'non-2xx preflight status',
  ],
  'multiple-origin': [
    "The 'Access-Control-Allow-Origin' header contains multiple values, but only one is allowed.",
    "Multiple CORS header 'Access-Control-Allow-Origin' not allowed",
    'More than one Access-Control-Allow-Origin header present',
    'More than one ACAO header present',
  ],
  redirect: [
    'Redirect is not allowed for a preflight request.',
    'CORS request external redirect not allowed',
    'Cross-origin redirect not permitted during CORS processing',
  ],
  scheme: [
    'CORS request not HTTP',
    "Access to fetch at 'file:///tmp/data.json' blocked by CORS policy: Cross origin requests are only supported for protocol schemes: http, https.",
    'Fetch API cannot load custom://resource. URL scheme custom is not supported.',
  ],
  dns: [
    'net::ERR_NAME_NOT_RESOLVED',
    'NS_ERROR_UNKNOWN_HOST',
    'A server with the specified hostname could not be found.',
  ],
  transport: [
    'net::ERR_CONNECTION_REFUSED',
    'net::ERR_TIMED_OUT',
    'net::ERR_CERT_AUTHORITY_INVALID',
  ],
  network: [
    'CORS request did not succeed. Status code: (null).',
    'TypeError: Failed to fetch',
    'TypeError: Failed to fetch https://preflight.example/data',
    'TypeError: Load failed',
    'NetworkError when attempting to fetch resource.',
    'TLS connection failed',
    'The network connection was lost.',
    'Mixed Content: The page requested an insecure resource. This request has been blocked.',
  ],
  'http-error': [
    "No 'Access-Control-Allow-Origin' header is present. GET https://api.example 503 (Service Unavailable). Status: 503",
    'Origin https://client.example is not allowed by Access-Control-Allow-Origin. Status code: 403',
    'HTTP/1.1 500 Internal Server Error. CORS request did not succeed.',
    'Blocked by CORS policy. Failed to load resource: the server responded with a status of 404',
  ],
};

for (const [family, messages] of Object.entries(families)) {
  for (const message of messages) {
    test(`${family}: ${message}`, () => {
      const result = diagnose(message);
      assert.equal(result.family, family);
      if (family === 'preflight') assert.equal(result.side, null);
      else assert.ok(['client', 'server', 'network'].includes(result.side));
      assert.ok(result.title && result.explanation);
      assert.ok(result.checks.length >= 2 && result.checks.length <= 4);
      if (family === 'network') {
        assert.match(result.explanation, /may not be a CORS configuration problem/);
        assert.equal(result.preflight, 'UNKNOWN');
      }
    });
  }
}

for (const message of [
  '', null, 'Something went wrong', 'ReferenceError: cors is not defined',
  'Cannot find module cors', 'CORS settings saved', 'TLS certificate settings loaded',
  'CORS tutorial at https://example.test:500/path', 'status: 500',
  'status: 200 CORS mystery', 'CORS preflight redirect configured',
  'TypeError: Cannot read properties of undefined',
]) {
  test(`unknown: ${message}`, () => {
    const result = diagnose(message);
    assert.equal(result.family, 'unknown');
    assert.equal(result.side, null);
    assert.equal(result.preflight, 'UNKNOWN');
    assert.equal(result.mainRequest, 'UNKNOWN');
  });
}

test('specific families beat generic fetch and load failures in either order', () => {
  for (const [family, messages] of Object.entries(families)) {
    if (family === 'network') continue;
    assert.equal(diagnose(`TypeError: Failed to fetch\n${messages[0]}\nLoad failed`).family, family);
    assert.equal(diagnose(`${messages[0]}\nTypeError: Failed to fetch`).family, family);
  }
});
test('a status error takes priority over the accompanying header failure', () => {
  const result = diagnose("HTTP 502 Bad Gateway. No 'Access-Control-Allow-Origin' header. Failed to fetch");
  assert.equal(result.family, 'http-error');
  assert.match(result.explanation, /primary problem/);
  assert.match(result.explanation, /same request/);
});
test('a specific header diagnosis preserves the preflight phase reported by Chrome', () => {
  const headerError = "No 'Access-Control-Allow-Origin' header is present on the requested resource.";
  const result = diagnose("Response to preflight request doesn't pass access control check: " + headerError);
  assert.equal(result.family, 'missing-origin');
  assert.equal(result.preflight, 'YES');
  assert.equal(result.mainRequest, 'NO');
  assert.equal(diagnose(headerError).preflight, 'MAYBE');
});
test('a specific transport error takes priority over a generic preflight failure', () => {
  const result = diagnose('CORS preflight channel did not succeed. net::ERR_CONNECTION_REFUSED');
  assert.equal(result.family, 'transport');
  assert.equal(result.side, 'network');
  assert.equal(result.preflight, 'YES');
});
test('a port number is not a server error status', () => {
  assert.equal(diagnose("No 'Access-Control-Allow-Origin' header for https://example.test:500/api").family, 'missing-origin');
});
test('HTTP 200 is retained without asserting JavaScript access', () => {
  assert.equal(diagnose('status: 200').family, 'success');
  assert.match(diagnose('status: 200').explanation, /does not prove/);
});

test('Firefox identifies a missing allow-origin header even with a successful HTTP status', () => {
  const message = 'Cross-Origin Request Blocked: The Same Origin Policy disallows reading the remote resource at https://api.example/data. (Reason: CORS header ‘Access-Control-Allow-Origin’ missing).';
  const reported = diagnose(message + ' Status code: 200.');
  assert.equal(reported.title, 'Missing Access-Control-Allow-Origin header');
  assert.match(reported.explanation, /reports HTTP 200/);
  assert.match(reported.explanation, /JavaScript on your page cannot read it/);
  assert.equal(reported.mainRequest, 'UNKNOWN');

  const noStatus = diagnose(message.replace('/data', '/status:200') + ' Status code: (null).');
  assert.equal(noStatus.title, reported.title);
  assert.doesNotMatch(noStatus.explanation, /HTTP 200/);
});

test('Chrome and Firefox name the request header the OPTIONS response needs to allow', () => {
  for (const message of [
    'Request header field authorization is not allowed by Access-Control-Allow-Headers in preflight response.',
    'Reason: missing token ‘authorization’ in CORS header ‘Access-Control-Allow-Headers’ from CORS preflight channel',
  ]) {
    const result = diagnose(message);
    assert.match(result.explanation, /the Authorization request header/);
    assert.match(result.checks[0], /add Authorization to Access-Control-Allow-Headers on the OPTIONS response/);
    assert.equal(result.preflight, 'YES');
  }

  const custom = diagnose('Request header field X-Client-Id is not allowed by Access-Control-Allow-Headers in preflight response.');
  assert.match(custom.checks[0], /add X-Client-Id/);
  const invalid = diagnose("invalid token 'bad header' in CORS header 'Access-Control-Allow-Headers'");
  assert.doesNotMatch(invalid.checks.join(' '), /add bad header/);
});

test('redirect guidance uses an explicitly identified HTTPS page and HTTP API URL', () => {
  const message = "Access to fetch at 'http://api.example/data' from origin 'https://client.example' has been blocked by CORS policy: Redirect is not allowed for a preflight request.";
  const result = diagnose(message);
  assert.equal(result.family, 'redirect');
  assert.match(result.explanation, /page uses HTTPS and the API URL starts with HTTP/);
  assert.match(result.checks.join(' '), /Check whether the HTTP URL redirects to HTTPS/);
  assert.equal(result.preflight, 'YES');

  const loggedRedirect = diagnose(message.replace("'http://api.example/data'", "'https://api.example/data' (redirected from 'http://api.example/data')"));
  assert.match(loggedRedirect.explanation, /shows an HTTP-to-HTTPS redirect/);
  assert.match(loggedRedirect.checks.join(' '), /Use the final HTTPS API URL directly/);

  for (const general of [
    message.replace('http://api.example', 'https://api.example'),
    message.replace(" from origin 'https://client.example'", '') + ' Other URL https://unrelated.example.',
  ]) {
    assert.equal(diagnose(general).family, 'redirect');
    assert.doesNotMatch(diagnose(general).explanation, /page uses HTTPS|HTTP-to-HTTPS/);
  }
});

test('Chrome no-cors suggestion gets a warning alongside the specific diagnosis', () => {
  const message = "No 'Access-Control-Allow-Origin' header is present on the requested resource.";
  const result = diagnose(message + " If an opaque response serves your needs, set the request's mode to 'no-cors' to fetch the resource with CORS disabled.");
  assert.equal(result.title, 'Missing Access-Control-Allow-Origin header');
  assert.match(result.explanation, /Avoid no-cors .* opaque to JavaScript/);
  const withoutSuggestion = diagnose(message + ' URL: https://api.example/no-cors.');
  assert.doesNotMatch(withoutSuggestion.explanation, /Avoid no-cors/);
});

test('failed preflight advice uses reported statuses and covers common causes when the status is unknown', () => {
  const message = "Response to preflight request doesn't pass access control check: It does not have HTTP ok status.";
  const noStatus = diagnose(message);
  assert.equal(noStatus.family, 'preflight');
  assert.match(noStatus.checks.join(' '), /401 or 403.*login middleware/);
  assert.match(noStatus.checks.join(' '), /404 or 405.*OPTIONS handler/);
  assert.match(noStatus.checks.join(' '), /If no response arrived/);
  assert.doesNotMatch(noStatus.explanation, /reports HTTP/);

  for (const status of [401, 403, 404, 405]) {
    const result = diagnose(message + ' Status code: ' + status + '.');
    assert.equal(result.family, 'preflight');
    assert.ok(result.explanation.includes('reports HTTP ' + status));
    assert.match(result.explanation, /Confirm that status on the OPTIONS request/);
    assert.equal(result.preflight, 'YES');
    if (status < 404) {
      assert.match(result.checks.join(' '), /keep authentication on the actual API request/i);
      assert.doesNotMatch(result.checks.join(' '), /404 or 405/);
    } else {
      assert.match(result.checks.join(' '), /OPTIONS handler/);
      assert.doesNotMatch(result.checks.join(' '), /401 or 403/);
    }
  }
  const chrome = diagnose(message + '\nOPTIONS https://api.example/data 405 (Method Not Allowed)');
  assert.match(chrome.explanation, /reports HTTP 405/);
  const conflicting = diagnose(message + '\nStatus code: 401.\nStatus code: 404.');
  assert.doesNotMatch(conflicting.explanation, /reports HTTP/);
});

const extract = vm.runInNewContext(source + '\nextractBrowserContext', {URL});
const chromeMessage = "Access to fetch at 'https://api.example/data?a=1' from origin 'https://client.example' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header";
test('extracts explicit Chrome target and requesting origin as context only', () => {
  assert.equal(extract(chromeMessage).origin, 'https://client.example');
  assert.equal(extract(chromeMessage).target, 'https://api.example/data?a=1');
  assert.equal(diagnose(chromeMessage).family, 'missing-origin');
});
test('extracts Firefox target without inventing its page origin', () => {
  const result = extract('Cross-Origin Request Blocked: The Same Origin Policy disallows reading the remote resource at https://api.example/data. (Reason: CORS header missing).');
  assert.equal(result.target, 'https://api.example/data');
  assert.equal(result.origin, undefined);
});
test('context ignores unrelated URLs and rejects malformed, credentialed, or conflicting requests', () => {
  for (const message of [
    "Access-Control-Allow-Origin header has a value 'https://allowed.example'",
    'Failed to fetch https://api.example',
    chromeMessage.replace('https://client.example', 'null'),
    chromeMessage.replace('https://client.example', 'https://client.example/path'),
    chromeMessage.replace('https://api.example/data?a=1', 'https://user:secret@api.example/data'),
    chromeMessage + '\n' + chromeMessage.replace('api.example', 'other.example'),
    chromeMessage.replace('https://api.example/data?a=1', 'https://invalid host/data'),
  ]) {
    assert.equal(extract(message).origin, undefined);
    assert.equal(extract(message).target, undefined);
  }
});
