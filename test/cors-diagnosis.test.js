const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// Exercise the actual DOM-independent parser without executing page handlers.
const source = fs.readFileSync(path.join(__dirname, '../public/cors-debugger.js'), 'utf8');
const parser = source.slice(source.indexOf('function browserDiagnosis('), source.indexOf('\nfunction renderDiagnosis'));
const diagnose = vm.runInNewContext(parser + '\nfindBrowserDiagnosis');

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
  network: [
    'CORS request did not succeed. Status code: (null).',
    'TypeError: Failed to fetch',
    'TypeError: Load failed',
    'NetworkError when attempting to fetch resource.',
    'net::ERR_NAME_NOT_RESOLVED',
    'net::ERR_CONNECTION_REFUSED',
    'net::ERR_TIMED_OUT',
    'net::ERR_CERT_AUTHORITY_INVALID',
    'TLS connection failed',
    'The network connection was lost.',
    'A server with the specified hostname could not be found.',
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
      assert.ok(['client', 'server', 'network'].includes(result.side));
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
test('a port number is not a server error status', () => {
  assert.equal(diagnose("No 'Access-Control-Allow-Origin' header for https://example.test:500/api").family, 'missing-origin');
});
test('HTTP 200 is retained without asserting JavaScript access', () => {
  assert.equal(diagnose('status: 200').family, 'success');
  assert.match(diagnose('status: 200').explanation, /does not prove/);
});
