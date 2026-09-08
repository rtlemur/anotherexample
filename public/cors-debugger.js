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

const browserDiagnosisRules = [
  {
    matches: text =>
      text.includes("no 'access-control-allow-origin' header") ||
      text.includes('no access-control-allow-origin header'),

    title: 'Missing Access-Control-Allow-Origin',

    explanation:
      'The target responded, but the browser says its response does not include an Access-Control-Allow-Origin header permitting your page. Check the target API’s CORS configuration.',

    summary:
      'This browser message does not prove whether a preflight occurred. Here’s what the result suggests.',

    preflight: 'MAYBE',
    mainRequest: 'POSSIBLY',

    likelyCause:
      'The server response does not include an Access-Control-Allow-Origin header that permits the requesting page.',

    checks: [
      'Confirm the server sends Access-Control-Allow-Origin',
      'Make sure it matches the requesting origin when needed',
      'Check both the OPTIONS response and the final response',
      'Do not assume the request failed just because browser JavaScript cannot read the response'
    ]
  },

  {
    matches: text =>
      text.includes('must not be the wildcard') &&
      text.includes('credentials'),

    title: 'Credentials cannot use a wildcard origin',

    explanation:
      'The request includes credentials, but the response uses Access-Control-Allow-Origin: *. Credentialed requests need an explicit allowed origin.',

    summary:
      'This browser message points to a credentials and origin-policy mismatch.',

    preflight: 'MAYBE',
    mainRequest: 'POSSIBLY',

    likelyCause:
      'The request includes credentials, but the server allows every origin with Access-Control-Allow-Origin: *.',

    checks: [
      'Replace * with the exact requesting origin',
      'Return Access-Control-Allow-Credentials: true',
      'Make sure the browser request uses credentials: include only when needed'
    ]
  },

  {
    matches: text =>
      text.includes('is not allowed by access-control-allow-methods'),

    title: 'Method rejected by preflight',

    explanation:
      'The requested HTTP method is not permitted by Access-Control-Allow-Methods in the preflight response.',

    summary:
      'The browser result indicates that an OPTIONS preflight checked the requested method and rejected it.',

    preflight: 'YES',
    mainRequest: 'NO',

    likelyCause:
      'The requested HTTP method is not listed in Access-Control-Allow-Methods.',

    checks: [
      'Confirm the server handles OPTIONS',
      'Confirm the preflight response returns 2xx',
      'Add the requested method to Access-Control-Allow-Methods'
    ]
  },

  {
    matches: text =>
      text.includes('is not allowed by access-control-allow-headers') ||
      (
        text.includes('request header field') &&
        text.includes('not allowed')
      ),

    title: 'Request header rejected by preflight',

    explanation:
      'A requested header is not permitted by Access-Control-Allow-Headers in the preflight response.',

    summary:
      'The browser result indicates that an OPTIONS preflight checked the requested headers and rejected one of them.',

    preflight: 'YES',
    mainRequest: 'NO',

    likelyCause:
      'A request header is not listed in Access-Control-Allow-Headers.',

    checks: [
      'Confirm the server handles OPTIONS',
      'Confirm the preflight response returns 2xx',
      'Add the requested header to Access-Control-Allow-Headers'
    ]
  },

  {
    matches: text =>
      text.includes('redirect is not allowed for a preflight') ||
      (
        text.includes('preflight') &&
        text.includes('redirect')
      ),

    title: 'Preflight was redirected',

    explanation:
      'The browser will not follow this redirect for the CORS preflight. Check authentication, proxy, hosting, or URL redirects affecting OPTIONS.',

    summary:
      'The browser result indicates that the OPTIONS preflight was redirected instead of answered directly.',

    preflight: 'YES',
    mainRequest: 'NO',

    likelyCause:
      'The OPTIONS preflight was redirected instead of answering the browser directly.',

    checks: [
      'Check for HTTP → HTTPS redirects',
      'Check login or authentication redirects',
      'Check proxy, CDN, or hosting rules affecting OPTIONS',
      'Make sure the final API URL handles OPTIONS directly'
    ]
  },

  {
    matches: text =>
      text.includes("response to preflight request doesn't pass access control check") ||
      text.includes('response to preflight request does not pass access control check'),

    title: 'Preflight access-control check failed',

    explanation:
      'The browser sent an OPTIONS preflight, but the response did not satisfy CORS requirements.',

    summary:
      'The browser result indicates that an OPTIONS preflight occurred and failed before the main request could continue.',

    preflight: 'YES',
    mainRequest: 'NO',

    likelyCause:
      'The preflight response did not satisfy one or more CORS requirements.',

    checks: [
      'Check the OPTIONS response status',
      'Check Access-Control-Allow-Origin',
      'Check Access-Control-Allow-Methods',
      'Check Access-Control-Allow-Headers'
    ]
  },

  {
    matches: text =>
      text.includes('access-control-allow-origin') &&
      text.includes('does not match'),

    title: 'Allowed origin does not match',

    explanation:
      'The server sent Access-Control-Allow-Origin, but it names a different origin than the page making the request.',

    summary:
      'This browser message shows that the server sent an Access-Control-Allow-Origin header, but it did not permit the requesting page.',

    preflight: 'MAYBE',
    mainRequest: 'POSSIBLY',

    likelyCause:
      'Access-Control-Allow-Origin names a different origin than the page making the request.',

    checks: [
      'Compare the browser page origin with Access-Control-Allow-Origin',
      'Watch for http vs https differences',
      'Watch for different ports or subdomains',
      'If credentials are used, return the exact allowed origin instead of *'
    ]
  },

  {
    matches: text =>
      text.includes('err_timed_out') ||
      text.includes('timed out'),

    title: 'Connection timed out — not enough evidence for CORS',

    explanation:
      'The browser did not receive a usable response. Check server availability, connectivity, DNS, firewall/proxy behavior, and the target URL before treating this as CORS.',

    summary:
      'This result points to a connection problem rather than a clear CORS diagnosis.',

    preflight: 'UNKNOWN',
    mainRequest: 'UNKNOWN',

    likelyCause:
      'The browser could not complete the network request.',

    checks: [
      'Check that the target server is reachable',
      'Check DNS and network connectivity',
      'Check firewall or proxy behavior',
      'Confirm the target URL is correct'
    ]
  },

  {
    matches: text =>
      text.includes('err_name_not_resolved'),

    title: 'DNS / hostname problem',

    explanation:
      'The browser could not resolve the target hostname. Fix that before investigating CORS.',

    summary:
      'This result points to a hostname or DNS failure rather than a clear CORS problem.',

    preflight: 'UNKNOWN',
    mainRequest: 'UNKNOWN',

    likelyCause:
      'The browser could not resolve the target hostname.',

    checks: [
      'Confirm the hostname is spelled correctly',
      'Check DNS resolution',
      'Confirm the domain is active and reachable'
    ]
  },

  {
    matches: text =>
      text.includes('err_cert') ||
      text.includes('certificate') ||
      text.includes('tls'),

    title: 'TLS / certificate problem',

    explanation:
      'Resolve the secure-connection or certificate problem before diagnosing CORS.',

    summary:
      'This result points to a TLS or certificate failure rather than a clear CORS problem.',

    preflight: 'UNKNOWN',
    mainRequest: 'UNKNOWN',

    likelyCause:
      'The browser could not establish a trusted secure connection.',

    checks: [
      'Check the TLS certificate',
      'Check hostname and certificate matching',
      'Check certificate expiration',
      'Resolve the HTTPS problem before diagnosing CORS'
    ]
  },

  {
    matches: text =>
      text.includes('failed to fetch'),

    title: 'Failed to fetch — generic browser failure',

    explanation:
      'This message alone does not identify the cause. Look for the more specific Console or Network error immediately above it.',

    summary:
      'The browser result is too generic to identify whether preflight or the main request failed.',

    preflight: 'UNKNOWN',
    mainRequest: 'UNKNOWN',

    likelyCause:
      'The browser did not provide enough detail in this message alone.',

    checks: [
      'Look for a more specific Console error',
      'Check the Network tab',
      'Look for an OPTIONS request',
      'Check whether the target request was sent'
    ]
  },

  {
    matches: text =>
      text.includes('status: 200') ||
      text.includes('status:200'),

    title: 'Successful HTTP response',

    explanation:
      'The pasted result shows HTTP 200. The request reached the server successfully; compare this with any browser-policy errors and the controlled result.',

    summary:
      'The pasted result shows that the browser received an HTTP 200 response.',

    preflight: 'UNKNOWN',
    mainRequest: 'YES',

    likelyCause:
      'The request reached the server successfully.',

    checks: [
      'Compare this result with the controlled test',
      'Check for browser-policy errors',
      'Confirm JavaScript could read the response'
    ]
  }
];

function findBrowserDiagnosis(text) {
  const normalized = (text || '').trim().toLowerCase();

  if (!normalized) {
    return {
      title: 'Paste a browser result first',
      explanation:
        'Copy the relevant Console error or result and paste it above.',
      summary:
        'AnotherExample needs a browser result before it can diagnose the request.',
      preflight: 'UNKNOWN',
      mainRequest: 'UNKNOWN',
      likelyCause:
        'No browser result was provided.',
      checks: [
        'Paste the relevant browser Console or Network result'
      ]
    };
  }

  return browserDiagnosisRules.find(rule => rule.matches(normalized)) || {
    title: 'Result not recognized yet',

    explanation:
      'This first version does not recognize that message confidently. Keep the original Console text; the classifier can be expanded without guessing.',

    summary:
      'AnotherExample does not have enough evidence to make a specific preflight diagnosis from this message.',

    preflight: 'UNKNOWN',
    mainRequest: 'UNKNOWN',

    likelyCause:
      'The browser message does not match a known diagnosis pattern yet.',

    checks: [
      'Keep the original browser message',
      'Check the Network tab for OPTIONS and the main request',
      'Compare the result with the controlled test'
    ]
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

$('explainBrowserResult').onclick = () => {
  const diagnosis = findBrowserDiagnosis($('browserResult').value);
  renderDiagnosis(diagnosis);
};
updateDiagnostic();
copyControl('copyTarget', () => $('targetFetch').textContent);
copyControl('copyControl', () => $('controlFetch').textContent);
copyControl('copyCombined', () => combinedDiagnosticSnippet(targetUrl(), diagnosticControlUrl()));
