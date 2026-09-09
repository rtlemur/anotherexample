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

updateDiagnostic();
copyControl('copyTarget', () => $('targetFetch').textContent);
copyControl('copyControl', () => $('controlFetch').textContent);
copyControl('copyCombined', () => combinedDiagnosticSnippet(targetUrl(), diagnosticControlUrl()));
