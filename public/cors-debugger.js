const $=id=>document.getElementById(id);

function validHttpUrl(value){
  try { const u=new URL(value); return ['http:','https:'].includes(u.protocol)?u:null; } catch { return null; }
}
function targetUrl(){
  const v=$('targetUrl').value.trim(), u=validHttpUrl(v);
  $('targetResult').textContent = !v ? 'The API/resource your page is trying to reach. Test A uses this URL exactly as entered.' : u ? 'Test A uses this URL exactly as entered · Target origin: '+u.origin : 'Enter a complete URL beginning with http:// or https://';
  return u ? u.href : 'https://api.example.com/data';
}
function bodyObject(){
  try{return JSON.parse($('requestBody').value||'{}')}catch{return {playground:'test'}}
}
function requestSnippet(destination){
  const method = $('method').value;
  const opts = [];

  if (method !== 'GET') {
    opts.push(
      `method: '${method}'`,
      "headers: { 'Content-Type': 'application/json' }",
      `body: JSON.stringify(${JSON.stringify(bodyObject())})`
    );
  }

  if ($('credentials').checked) {
    opts.push("credentials: 'include'");
  }

  return `fetch('${destination}'${opts.length ? `, {\n  ${opts.join(',\n  ')}\n}` : ''})
  .then(async r => ({
    status: r.status,
    headers: Object.fromEntries(r.headers),
    body: await r.text()
  }))
  .then(console.log)
  .catch(console.error);`;
}

function combinedDiagnosticSnippet(target, control) {
  const method = $('method').value;
  const optionLines = [];

  if (method !== 'GET') {
    optionLines.push(
      `method: '${method}'`,
      "headers: { 'Content-Type': 'application/json' }",
      `body: JSON.stringify(${JSON.stringify(bodyObject())})`
    );
  }

  if ($('credentials').checked) {
    optionLines.push("credentials: 'include'");
  }

  const options = optionLines.length
    ? `{\n      ${optionLines.join(',\n      ')}\n    }`
    : '{}';

  return `(async () => {
  async function runTest(label, url) {
    console.log('\\n=== ' + label + ' ===');

    try {
      const response = await fetch(url, ${options});
      const body = await response.text();

      const result = {
        success: true,
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body
      };

      console.log(result);
      return result;
    } catch (error) {
      const result = {
        success: false,
        error: String(error)
      };

      console.error(result);
      return result;
    }
  }

  const testA = await runTest(
    'TEST A — Your API',
    '${target}'
  );

  const testB = await runTest(
    'TEST B — Controlled baseline',
    '${control}'
  );

 console.log('\\n=== AnotherExample comparison ===');

let conclusion;

if (testA.success && testB.success) {
  conclusion =
    'A works, B works — basic cross-origin access works for this request shape. Reproduce the exact failing method, headers, body, and credentials.';
}
else if (!testA.success && testB.success) {
  conclusion =
    'A fails, B works — the controlled baseline succeeded, so investigate the target API CORS configuration or response first.';
}
else if (!testA.success && !testB.success) {
  conclusion =
    'A fails, B fails — compare the browser errors and verify the request shape, credentials, browser policy, extensions, and environment.';
}
else {
  conclusion =
    'A works, B fails — this is unusual. Recheck the controlled comparison settings and browser environment.';
}

console.log({
  testA,
  testB,
  conclusion
});

console.log('\\n' + conclusion);
})();`;
}

function requestShapeSummary(){
  const method=$('method').value;
  const creds=$('credentials').checked ? 'credentials included' : 'no credentials';
  return `${method} · ${creds}`;
}
function updateDiagnostic(){
  enteredOrigin();
  const target=targetUrl();
  const control=diagnosticControlUrl();
  highlightCode($('targetFetch'),requestSnippet(target));
  highlightCode($('controlFetch'),requestSnippet(control));
  if($('targetSummary')) $('targetSummary').textContent=`${target} · ${requestShapeSummary()}`;
  if($('controlSummary')) $('controlSummary').textContent=`${new URL(control).origin}/api/cors/lab · ${requestShapeSummary()}`;
}
function enteredOrigin(){
  const value=$('siteUrl').value.trim();
  if(!value){$('originResult').textContent='Example: https://app.example.com/page → origin https://app.example.com';return 'https://your-site.example';}
  try{
    const u=new URL(value);
    if(!['http:','https:'].includes(u.protocol)) throw new Error();
    $('originResult').innerHTML='Browser origin: <code>'+u.origin+'</code>';
    return u.origin;
  }catch{
    $('originResult').textContent='Enter a complete URL beginning with http:// or https://';
    return 'https://your-site.example';
  }
}
const LAB_ORIGIN=location.hostname==='anotherexample.com'||location.hostname==='www.anotherexample.com'
  ? 'https://cors.anotherexample.com'
  : 'https://cors-preview.anotherexample.com';

function diagnosticControlUrl(){
  const method=$('method').value;
  const credentialed=$('credentials').checked;
  const allowedMethods=[...new Set(['GET','POST',method,'OPTIONS'])].join(', ');
  const controlParams=new URLSearchParams({
    allowOrigin: credentialed ? 'echo' : '*',
    credentials: String(credentialed),
    methods: allowedMethods,
    headers: 'Content-Type',
    preflightStatus: '204',
    delay: '0'
  });
  return LAB_ORIGIN+'/api/cors/lab?'+controlParams.toString();
}
function markDiagnosticStale(){
  const status=$('diagnosticStatus');
  if(status) status.textContent='Inputs changed — run diagnosis again';
  const diagnostic=$('diagnostic');
  if(diagnostic) diagnostic.style.display='none';
  const button=$('startDiagnosis');
  if(button){
    button.textContent='Start CORS diagnosis';
    button.disabled=false;
  }
}

['method','allowOrigin','methods','headers','credentials','preflight','delay'].forEach(id=>$(id).addEventListener('change',()=>{
  if(id==='credentials' && $('credentials').checked && $('allowOrigin').value==='*'){
    $('allowOrigin').value='echo';
  }
  markDiagnosticStale();
  updateDiagnostic();
}));
$('siteUrl').addEventListener('input',()=>{markDiagnosticStale();updateDiagnostic()});
$('targetUrl').addEventListener('input',()=>{markDiagnosticStale();updateDiagnostic()});
$('requestBody').addEventListener('input',()=>{markDiagnosticStale();updateDiagnostic()});
$('startDiagnosis').onclick=()=>{
  if($('credentials').checked && $('allowOrigin').value==='*'){
    $('allowOrigin').value='echo';
  }
  const source=validHttpUrl($('siteUrl').value.trim()), target=validHttpUrl($('targetUrl').value.trim());
  enteredOrigin();targetUrl();
  if(!source||!target){$('diagnostic').style.display='none';return;}
  updateDiagnostic();
  $('diagnostic').style.display='block';
  $('diagnosticStatus').textContent='Diagnostic ready';
  $('startDiagnosis').textContent='Start CORS diagnosis';
  $('startDiagnosis').disabled=false;
  $('diagnostic').scrollIntoView({behavior:'smooth',block:'start'});
};
     
$('toggleTarget').onclick=()=>{
  const pre=$('targetFetch'), show=pre.style.display==='none';
  pre.style.display=show?'block':'none';
  $('toggleTarget').setAttribute('aria-expanded', String(show));
  $('toggleTarget').textContent=show?'Hide generated code':'View generated code';
};
$('toggleControl').onclick=()=>{
  const pre=$('controlFetch'), show=pre.style.display==='none';
  pre.style.display=show?'block':'none';
  $('toggleControl').setAttribute('aria-expanded', String(show));
  $('toggleControl').textContent=show?'Hide generated code':'View generated code';
};

// Keep classification independent of the DOM. Specific policy failures precede
// generic network messages, which browsers often append to the same error.
function browserDiagnosis(family, title, side, explanation, checks, preflight = 'MAYBE') {
  return {
    family, title, side,
    explanation: explanation + ' Inspect the ' + side + ' first.',
    summary: preflight === 'YES'
      ? 'The message identifies a failed preflight; the main request may not have been sent.'
      : 'This message alone does not establish whether a preflight occurred.',
    preflight,
    mainRequest: preflight === 'YES' ? 'NO' : 'UNKNOWN',
    likelyCause: explanation,
    checks
  };
}

const browserDiagnosisRules = [
  {
    matches: t => /access-control-allow-origin|\bacao\b/.test(t) && /multiple|more than one|only one.*allowed/.test(t),
    diagnosis: browserDiagnosis('multiple-origin', 'Multiple allowed-origin headers', 'server',
      'The response supplies multiple Access-Control-Allow-Origin headers or values; the browser requires a single allowed origin.',
      ['Inspect raw response headers in DevTools or server logs', 'Check whether both the application and proxy add the header', 'Return one allowed origin, not a comma-separated list'])
  },
  {
    matches: t => /credential/.test(t) && (/wildcard/.test(t) || /access-control-allow-origin[^\n]*\*/.test(t) || /explicit (?:allowed )?origin/.test(t)),
    diagnosis: browserDiagnosis('credentials-wildcard', 'Credentials cannot use a wildcard origin', 'server',
      'Credentialed requests require an explicit allowed origin instead of Access-Control-Allow-Origin: *.',
      ['Return the exact permitted requesting origin', 'Return Access-Control-Allow-Credentials: true for permitted credentialed requests', 'Check whether the client actually needs credentials'])
  },
  {
    matches: t => /access-control-allow-credentials/.test(t) && /missing|expected|must be|not.*true|invalid|is not|does not|is \'\'/.test(t),
    diagnosis: browserDiagnosis('allow-credentials', 'Missing or invalid Allow-Credentials', 'server',
      'The credentialed request requires Access-Control-Allow-Credentials with the case-sensitive value true; the message reports it missing or invalid.',
      ['Inspect the OPTIONS and final response in DevTools or server logs', 'Return Access-Control-Allow-Credentials: true for approved credentialed access', 'Check whether the client sends credentials (credentials: "include" or withCredentials = true)'])
  },
  {
    matches: t => /access-control-allow-methods/.test(t) && /not allowed|missing|absent|did not find|invalid token|not (?:present|listed|permitted)/.test(t),
    diagnosis: browserDiagnosis('method', 'Method rejected by preflight', 'server',
      'The allowed-methods response omits the requested method or contains an invalid method token.',
      ['Compare Access-Control-Request-Method with Access-Control-Allow-Methods', 'Use valid comma-separated HTTP method tokens', 'Check that OPTIONS receives a successful response'], 'YES')
  },
  {
    matches: t => /access-control-allow-headers/.test(t) && /not allowed|missing|absent|did not find|invalid token|not (?:present|listed|permitted)/.test(t),
    diagnosis: browserDiagnosis('header', 'Request header rejected by preflight', 'server',
      'The allowed-headers response omits a requested header or contains an invalid header-name token.',
      ['Compare Access-Control-Request-Headers with Access-Control-Allow-Headers', 'Use valid comma-separated header names', 'Check that OPTIONS receives a successful response'], 'YES')
  },
  {
    matches: t => /access-control-allow-origin|returned origin/.test(t) && /does not match|doesn\'t match|mismatch|different origin/.test(t),
    diagnosis: browserDiagnosis('origin-mismatch', 'Allowed origin does not match', 'server',
      'The response names an allowed origin different from the requesting page origin.',
      ['Compare the page origin with the response header in DevTools', 'Check scheme, hostname, and port', 'Check proxy configuration and cached responses for the wrong origin'])
  },
  {
    matches: t => /access-control-allow-origin/.test(t) && /missing|no ["']?access-control-allow-origin["']? header|origin .*not allowed by/.test(t),
    diagnosis: browserDiagnosis('missing-origin', 'Origin not allowed by server', 'server',
      'The browser reports a missing allowed-origin header or an origin it does not permit. “Origin is not allowed” alone does not distinguish a missing header from a mismatched value.',
      ['Inspect the OPTIONS and final response headers in DevTools or server logs', 'Ensure the server permits the exact page origin', 'Check error responses and proxy responses for missing headers'])
  },
  {
    matches: t => /redirect/.test(t) && /not allowed|not permitted|disallowed|blocked/.test(t) && /cors|cross-origin|preflight/.test(t),
    diagnosis: browserDiagnosis('redirect', 'CORS redirect blocked', 'server',
      'The browser reports a redirect it cannot follow during CORS processing. This may affect a preflight or the main request.',
      ['Inspect the redirect chain and Location in DevTools or server logs', 'Use the final API URL directly', 'Check authentication, HTTPS, and proxy redirects on OPTIONS'])
  },
  {
    matches: t => /cors request not https?\b|cross origin requests are only supported for protocol schemes|url scheme .*not supported|unsupported (?:url )?scheme/.test(t) ||
      (/cors|cross-origin|cross origin/.test(t) && /(?:file|[a-z][a-z0-9+.-]*):\/\//.test(t) && /scheme|protocol/.test(t) && /not|only|unsupported|blocked/.test(t)),
    diagnosis: browserDiagnosis('scheme', 'Unsupported request scheme', 'client',
      'The request uses a scheme the browser does not support for this cross-origin fetch, such as file:// or a custom protocol.',
      ['Serve local pages through an HTTP or HTTPS development server', 'Check the target URL scheme', 'Use an HTTP or HTTPS API URL'], 'UNKNOWN')
  },
  {
    matches: t => /preflight/.test(t) && /unsuccessful|did not succeed|fail|reject|non-2xx|not.*(?:ok|successful|2xx)|doesn\'t pass|does not pass/.test(t) || /options request (?:was )?rejected/.test(t),
    diagnosis: browserDiagnosis('preflight', 'Preflight failed', 'server',
      'The OPTIONS preflight failed. This message alone may not distinguish a rejected response from a transport failure.',
      ['Inspect the OPTIONS status and browser network error', 'Ensure OPTIONS returns a successful 2xx response without authentication redirects', 'Check allowed origin, method, and headers', 'If no response arrived, check connectivity and TLS'], 'YES')
  },
  {
    matches: t => /err_(?:name_not_resolved|connection_[a-z_]+|timed_out|cert_[a-z_]+|ssl_[a-z_]+)|cors request did not succeed|failed to fetch|load failed|networkerror when attempting to fetch resource|network request failed|request timed out|network connection was lost|could not connect to the server|server with the specified hostname could not be found|mixed content.*(?:blocked|insecure)|(?:tls|ssl|certificate|dns|connection).*(?:error|failed|failure|invalid|expired|refused|timed out)/.test(t),
    diagnosis: browserDiagnosis('network', 'CORS or network failure — cause unclear', 'network',
      'This may not be a CORS configuration problem. The message alone cannot distinguish CORS from connectivity, DNS, TLS, mixed-content blocking, or another browser restriction.',
      ['Look for a more specific Console or Network error for the same request', 'Check target availability, DNS, and TLS certificates', 'Check for an HTTPS page requesting an insecure HTTP resource', 'Inspect OPTIONS and the main request in DevTools; blocked headers are not available to page JavaScript'], 'UNKNOWN')
  }
];

function findBrowserDiagnosis(text) {
  const normalized = String(text || '').trim().toLowerCase()
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ');
  const matched = browserDiagnosisRules.find(rule => rule.matches(normalized));
  // Require a status label, HTTP prefix, or standard status reason; a URL port
  // or arbitrary number alongside the word CORS is not HTTP-error evidence.
  const httpError = /\b(?:status(?: code| of)?|http(?:\/\d(?:\.\d)?)?)[\s:='"(]+[45]\d{2}\b|\b[45]\d{2}\s+(?:bad request|unauthorized|forbidden|not found|internal server error|bad gateway|service unavailable|gateway timeout)\b/.test(normalized);
  const corsComplaint = matched && !['network', 'scheme'].includes(matched.diagnosis.family) ||
    /blocked by cors|cors (?:error|request did not succeed)|access.control (?:check|checks).*fail/.test(normalized);
  if (httpError && corsComplaint) {
    return browserDiagnosis('http-error', 'HTTP error with a CORS complaint', 'server',
      'The message includes a 4xx/5xx response and a CORS complaint. The underlying server or upstream error may be the primary problem; its error response may simply lack CORS headers. Confirm both messages refer to the same request.',
      ['Correlate the status and CORS message with the same URL in DevTools', 'Inspect server and proxy logs for the underlying HTTP error', 'Check CORS headers on error responses as well as successful responses', 'Do not rely on page JavaScript to read a blocked response'], /preflight|options/.test(normalized) ? 'YES' : 'MAYBE');
  }
  if (matched) return matched.diagnosis;
  if (/^status\s*:\s*200\b/.test(normalized) && !/cors|blocked|error|fail/.test(normalized)) {
    return {
      ...browserDiagnosis('success', 'Successful HTTP response', 'client',
        'The pasted result reports HTTP 200, which alone does not prove JavaScript could read the response.',
        ['Compare with the controlled test', 'Confirm JavaScript could read the response'], 'UNKNOWN'),
      mainRequest: 'YES'
    };
  }
  return {
    family: 'unknown', side: null,
    title: normalized ? 'Result not recognized yet' : 'Paste a browser result first',
    explanation: 'There is not enough evidence to identify the cause or choose a client, server, or network fix.',
    summary: 'The message does not establish whether a preflight occurred.',
    preflight: 'UNKNOWN', mainRequest: 'UNKNOWN',
    likelyCause: 'Unknown; keep the original browser message rather than guessing.',
    checks: ['Copy the complete Console message for the failing request', 'Inspect the matching request in the Network tab']
  };
}

function renderDiagnosis(diagnosis) {
  const explanationBox = $('browserExplanation');
  const preflightPanel = $('preflightDiagnosisPanel');
  const preflightBox = $('preflightDiagnosis');

  explanationBox.style.display = 'block';
  explanationBox.innerHTML =
    '<strong>' + diagnosis.title + '</strong><br>' +
    diagnosis.explanation;

  const badge = diagnosis.mainRequest === 'YES' ? ['200 OK', 'ok'] : diagnosis.preflight === 'YES' ? ['Preflight failed', 'bad'] : diagnosis.preflight === 'MAYBE' ? ['CORS blocked', 'bad'] : null;
  if (badge) explanationBox.prepend(resultBadge(...badge));
  $('preflightSummary').textContent = diagnosis.summary;

  preflightPanel.style.display = 'block';
  preflightBox.className = 'status bad';

  const checks = diagnosis.checks
    .map(check => '• ' + check + '<br>')
    .join('');

  preflightBox.innerHTML =
    '<strong>Preflight likely happened: ' + diagnosis.preflight + '</strong><br>' +
    '<strong>Main request likely sent: ' + diagnosis.mainRequest + '</strong><br><br>' +
    '<strong>Likely cause:</strong><br>' +
    diagnosis.likelyCause +
    '<br><br>' +
    '<strong>Check next:</strong><br>' +
    checks;
}

function bindBrowserResultInterpreter() {
  const input = $('browserResult');
  let timer;
  let composing = false;
  let lastDiagnosis = null;

  // Announce the short explanation politely; keep the detailed checks readable
  // without a second, lengthy live announcement on every edit.
  $('preflightDiagnosis').setAttribute('aria-live', 'off');

  function update() {
    clearTimeout(timer);
    if (!input.value.trim()) {
      lastDiagnosis = null;
      $('browserExplanation').style.display = 'none';
      $('preflightDiagnosisPanel').style.display = 'none';
      return;
    }
    const diagnosis = findBrowserDiagnosis(input.value);
    const signature = JSON.stringify(diagnosis);
    if (signature !== lastDiagnosis) {
      renderDiagnosis(diagnosis);
      lastDiagnosis = signature;
    }
  }

  function schedule() {
    clearTimeout(timer);
    if (!input.value.trim()) {
      update();
    } else if (!composing) {
      timer = setTimeout(update, 400);
    }
  }

  input.addEventListener('input', schedule);
  input.addEventListener('compositionstart', () => {
    composing = true;
    clearTimeout(timer);
  });
  input.addEventListener('compositionend', () => {
    composing = false;
    schedule();
  });
  $('explainBrowserResult').onclick = update;
}
bindBrowserResultInterpreter();
updateDiagnostic();
copyControl('copyTarget', () => $('targetFetch').textContent);
copyControl('copyControl', () => $('controlFetch').textContent);
copyControl('copyCombined', () => combinedDiagnosticSnippet(targetUrl(), diagnosticControlUrl()));
