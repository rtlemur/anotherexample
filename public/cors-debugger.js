const $ = id => document.getElementById(id);

const LAB_ORIGIN = location.hostname === 'anotherexample.com' || location.hostname === 'www.anotherexample.com'
  ? 'https://cors.anotherexample.com'
  : 'https://cors-preview.anotherexample.com';

const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const SENSITIVE_HEADERS = new Set([
  'authorization', 'proxy-authorization', 'cookie', 'set-cookie',
  'x-api-key', 'api-key', 'x-auth-token', 'x-access-token'
]);

const outcomeCopy = {
  'a-fail-b-work': {
    title: 'The target failed; the control worked',
    intro: 'The comparison narrowed the investigation without pretending to know more than the browser revealed.',
    a: ['bad', '✕ Test A — Your API', 'Browser JavaScript could not read the response.'],
    b: ['ok', '✓ Test B — Known-good control', 'The same CORS-related request shape was readable.'],
    observed: 'A failed and B worked in the same page and browser.',
    suggests: 'Cross-origin access works for this request shape. Inspect the target API response or its CORS configuration first.',
    unknown: 'The comparison alone does not identify the missing or incorrect response header.',
    next: 'Paste Test A’s red Console message to narrow it down.',
    clue: true
  },
  'both-work': {
    title: 'Both reproduced requests worked',
    intro: 'The browser could read both responses for the request shape you entered.',
    a: ['ok', '✓ Test A — Your API', 'The reproduced target request was readable.'],
    b: ['ok', '✓ Test B — Known-good control', 'The controlled request was readable.'],
    observed: 'A and B both worked in the same page and browser.',
    suggests: 'Basic cross-origin access works for this reproduced request.',
    unknown: 'The original failure may differ in method, headers, body, credentials, redirect path, or environment.',
    next: 'Compare this request with the original failure and change one difference at a time.',
    clue: false
  },
  'both-fail': {
    title: 'Both requests failed',
    intro: 'The control did not isolate the target API, so start with what both tests share.',
    a: ['bad', '✕ Test A — Your API', 'Browser JavaScript could not read the response.'],
    b: ['bad', '✕ Test B — Known-good control', 'The controlled response was not readable either.'],
    observed: 'A and B both failed in the same page and browser.',
    suggests: 'A shared request detail, browser policy, extension, network condition, DNS, TLS, or mixed-content rule may be involved.',
    unknown: 'The outcome does not establish whether the two failures have the same cause.',
    next: 'Compare both Console messages and verify the generated request shape.',
    clue: true
  },
  'a-work-b-fail': {
    title: 'The target worked; the control failed',
    intro: 'This is an unusual control result and should not be turned into advice about the target API.',
    a: ['ok', '✓ Test A — Your API', 'The target response was readable.'],
    b: ['bad', '✕ Test B — Known-good control', 'The control did not behave as expected.'],
    observed: 'A worked and B failed in the same page and browser.',
    suggests: 'The generated control, AnotherExample endpoint, or browser environment needs checking.',
    unknown: 'This result does not show a CORS defect in the target API.',
    next: 'Build and run the comparison once more. If it repeats, report the control result.',
    clue: false
  }
};

function validHttpUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url : null;
  } catch {
    return null;
  }
}

function currentMethod() {
  return $('method').value;
}

function enteredOrigin() {
  const value = $('siteUrl').value.trim();
  const url = validHttpUrl(value);
  if (!value) {
    $('originResult').textContent = 'Example: https://app.example.com/page → origin https://app.example.com';
    return 'https://your-site.example';
  }
  if (!url) {
    $('originResult').textContent = 'Enter a complete URL beginning with http:// or https://';
    return 'https://your-site.example';
  }
  $('originResult').textContent = 'Browser origin: ' + url.origin;
  return url.origin;
}

function targetUrl() {
  const value = $('targetUrl').value.trim();
  const url = validHttpUrl(value);
  $('targetResult').textContent = !value
    ? 'Test A uses this URL exactly as entered.'
    : url
      ? 'Target origin: ' + url.origin
      : 'Enter a complete URL beginning with http:// or https://';
  return url ? url.href : 'https://api.example.com/data';
}

function bodyObject() {
  if (!BODY_METHODS.has(currentMethod())) return null;
  const value = $('requestBody').value.trim();
  return value ? JSON.parse(value) : null;
}

function parseHeaderLines(value = $('requestHeaders').value) {
  const headers = {};
  const invalid = [];
  for (const line of String(value || '').split(/\r?\n/)) {
    if (!line.trim()) continue;
    const colon = line.indexOf(':');
    const name = colon < 0 ? '' : line.slice(0, colon).trim();
    const headerValue = colon < 0 ? '' : line.slice(colon + 1).trim();
    if (!name || !/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name)) {
      invalid.push(line.trim());
      continue;
    }
    headers[name] = headerValue;
  }
  return {headers, invalid};
}

function requestHeaders() {
  const parsed = parseHeaderLines();
  const headers = {...parsed.headers};
  if (BODY_METHODS.has(currentMethod()) && !Object.keys(headers).some(name => name.toLowerCase() === 'content-type')) {
    headers['Content-Type'] = 'application/json';
  }
  return {...parsed, headers};
}

function validatedRequest() {
  const status = $('diagnosticStatus');
  const bodyField = $('requestBody');
  const headerField = $('requestHeaders');
  let body;
  try {
    body = bodyObject();
    bodyField.removeAttribute('aria-invalid');
  } catch {
    bodyField.setAttribute('aria-invalid', 'true');
    status.textContent = 'Invalid JSON — fix the request body before building the comparison.';
    status.classList.add('validation-error');
    return {valid: false};
  }
  const parsedHeaders = requestHeaders();
  if (parsedHeaders.invalid.length) {
    headerField.setAttribute('aria-invalid', 'true');
    status.textContent = 'Each request header needs the format Name: value.';
    status.classList.add('validation-error');
    return {valid: false};
  }
  headerField.removeAttribute('aria-invalid');
  status.classList.remove('validation-error');
  return {valid: true, body, headers: parsedHeaders.headers};
}

function controlHeaders(headers) {
  return Object.fromEntries(Object.entries(headers).map(([name, value]) => [
    name,
    SENSITIVE_HEADERS.has(name.toLowerCase()) ? 'anotherexample-redacted' : value
  ]));
}

function optionsSource(body, headers, forControl = false) {
  const lines = [];
  const method = currentMethod();
  if (method !== 'GET') lines.push('method: ' + JSON.stringify(method));
  const finalHeaders = forControl ? controlHeaders(headers) : headers;
  if (Object.keys(finalHeaders).length) lines.push('headers: ' + JSON.stringify(finalHeaders, null, 2));
  if (BODY_METHODS.has(method) && body !== null) {
    const finalBody = forControl ? {anotherexample: 'redacted'} : body;
    lines.push('body: JSON.stringify(' + JSON.stringify(finalBody) + ')');
  }
  if ($('credentials').checked) lines.push("credentials: 'include'");
  return lines.length ? '{\n      ' + lines.join(',\n      ') + '\n    }' : '{}';
}

function requestSnippet(destination, body = bodyObject(), headers = requestHeaders().headers, forControl = false) {
  return `fetch(${JSON.stringify(destination)}, ${optionsSource(body, headers, forControl)})
  .then(async response => ({
    status: response.status,
    headers: Object.fromEntries(response.headers),
    body: await response.text()
  }))
  .then(console.log)
  .catch(console.error);`;
}

function combinedDiagnosticSnippet(target, control, body = bodyObject(), headers = requestHeaders().headers) {
  const targetOptions = optionsSource(body, headers, false);
  const controlOptions = optionsSource(body, headers, true);
  return `(async () => {
  async function runTest(label, url, options) {
    console.log('\\n=== ' + label + ' ===');
    try {
      const response = await fetch(url, options);
      const result = {
        success: true,
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body: await response.text()
      };
      console.log(result);
      return result;
    } catch (error) {
      const result = {success: false, error: String(error)};
      console.error(result);
      return result;
    }
  }

  const testA = await runTest(
    'TEST A — Your API',
    ${JSON.stringify(target)},
    ${targetOptions}
  );

  const testB = await runTest(
    'TEST B — Known-good control',
    ${JSON.stringify(control)},
    ${controlOptions}
  );

  const conclusion = testA.success && testB.success
    ? 'A worked · B worked'
    : !testA.success && testB.success
      ? 'A failed · B worked'
      : !testA.success && !testB.success
        ? 'A failed · B failed'
        : 'A worked · B failed';

  console.log('\\n=== AnotherExample outcome ===');
  console.log(conclusion);
  console.log({testA, testB, conclusion});
})();`;
}

function diagnosticControlUrl(headers = requestHeaders().headers) {
  const method = currentMethod();
  const credentialed = $('credentials').checked;
  const allowedMethods = [...new Set(['GET', 'POST', method, 'OPTIONS'])].join(', ');
  const allowedHeaders = Object.keys(headers).join(', ');
  const controlParams = new URLSearchParams({
    allowOrigin: credentialed ? 'echo' : '*',
    credentials: String(credentialed),
    methods: allowedMethods,
    headers: allowedHeaders,
    preflightStatus: '204',
    delay: '0'
  });
  return LAB_ORIGIN + '/api/cors/lab?' + controlParams.toString();
}

function requestShapeSummary(headers = requestHeaders().headers) {
  const credentialLabel = $('credentials').checked ? 'credentials included' : 'no credentials';
  const headerLabel = Object.keys(headers).length ? Object.keys(headers).join(', ') : 'no custom headers';
  return `${currentMethod()} · ${credentialLabel} · ${headerLabel}`;
}

function setProgress(step) {
  document.querySelectorAll('[data-progress]').forEach(item => {
    item.classList.toggle('active', Number(item.dataset.progress) <= step);
  });
}

function reveal(panel, step, scroll = true) {
  panel.hidden = false;
  setProgress(step);
  if (scroll) {
    panel.focus({preventScroll: true});
    panel.scrollIntoView({behavior: 'smooth', block: 'start'});
  }
}

function hideLaterPanels() {
  for (const id of ['diagnostic', 'diagnosisPanel', 'browserCluePanel', 'fixPanel']) $(id).hidden = true;
  setProgress(1);
}

function updateControlSummary() {
  const origin = enteredOrigin();
  $('controlOrigin').textContent = validHttpUrl($('siteUrl').value.trim()) ? origin : 'Waiting for a page URL';
  $('controlMethod').textContent = currentMethod();
}

function markDiagnosticStale() {
  hideLaterPanels();
  const status = $('diagnosticStatus');
  status.textContent = 'Inputs changed — build the comparison again.';
  $('startDiagnosis').textContent = 'Build the A + B comparison';
  updateControlSummary();
}

function updateDiagnosticCode() {
  updateControlSummary();
  const target = targetUrl();
  const validation = validatedRequest();
  if (!validation.valid) {
    for (const id of ['targetFetch', 'controlFetch', 'combinedFetch']) highlightCode($(id), '');
    return false;
  }
  const control = diagnosticControlUrl(validation.headers);
  highlightCode($('targetFetch'), requestSnippet(target, validation.body, validation.headers, false));
  highlightCode($('controlFetch'), requestSnippet(control, validation.body, validation.headers, true));
  highlightCode($('combinedFetch'), combinedDiagnosticSnippet(target, control, validation.body, validation.headers));
  $('targetSummary').textContent = `${target} · ${requestShapeSummary(validation.headers)}`;
  $('controlSummary').textContent = `${new URL(control).origin}/api/cors/lab · ${requestShapeSummary(validation.headers)}`;
  $('runOrigin').textContent = enteredOrigin();
  return true;
}

function setResultBox(element, result) {
  element.className = 'test-result ' + result[0];
  element.replaceChildren();
  const heading = document.createElement('strong');
  const detail = document.createElement('span');
  heading.textContent = result[1];
  detail.textContent = result[2];
  element.append(heading, detail);
}

function renderOutcome(key) {
  const outcome = outcomeCopy[key];
  document.querySelectorAll('.outcome-button').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.outcome === key));
  });
  $('diagnosisTitle').textContent = outcome.title;
  $('diagnosisIntro').textContent = outcome.intro;
  setResultBox($('aResult'), outcome.a);
  setResultBox($('bResult'), outcome.b);
  $('observedText').textContent = outcome.observed;
  $('suggestsText').textContent = outcome.suggests;
  $('unknownText').textContent = outcome.unknown;
  $('nextText').textContent = outcome.next;
  $('showBrowserClue').hidden = !outcome.clue;
  $('browserCluePanel').hidden = true;
  $('fixPanel').hidden = true;
  reveal($('diagnosisPanel'), 3);
}

function renderBrowserExplanation(diagnosis) {
  const box = $('browserExplanation');
  box.hidden = false;
  box.className = 'status ' + (diagnosis.family === 'success' ? 'ok' : diagnosis.family === 'unknown' ? '' : 'bad');
  box.replaceChildren();
  const title = document.createElement('strong');
  const explanation = document.createElement('span');
  title.textContent = diagnosis.title;
  explanation.textContent = diagnosis.explanation;
  box.append(title, document.createElement('br'), explanation);

  const context = extractBrowserContext($('browserResult').value);
  $('errorContext').textContent = [
    context.origin && 'Page origin: ' + context.origin,
    context.target && 'Target URL: ' + context.target
  ].filter(Boolean).join(' · ');
  $('errorContext').hidden = !$('errorContext').textContent;
}

function flowStep(number, title, detail, state, style = '') {
  const step = document.createElement('div');
  step.className = 'flow-step ' + style;
  const marker = document.createElement('span');
  marker.className = 'flow-number';
  marker.textContent = number;
  const copy = document.createElement('div');
  const heading = document.createElement('strong');
  const small = document.createElement('small');
  heading.textContent = title;
  small.textContent = detail;
  copy.append(heading, small);
  const label = document.createElement('span');
  label.className = 'flow-state';
  label.textContent = state;
  step.append(marker, copy, label);
  return step;
}

function renderBrowserFlow(diagnosis) {
  const flow = $('browserFlow');
  flow.replaceChildren();
  const headerNames = Object.keys(requestHeaders().headers);
  flow.append(flowStep('1', 'Prepare request', `${currentMethod()}${headerNames.length ? ' with ' + headerNames.join(', ') : ''}`, 'Known', 'ok'));

  if (diagnosis.preflight === 'YES') {
    flow.append(flowStep('2', 'OPTIONS preflight', 'The browser message identifies a preflight.', 'Sent', 'ok'));
  } else if (diagnosis.preflight === 'NO') {
    flow.append(flowStep('2', 'OPTIONS preflight', 'This request did not require one.', 'Skipped', 'muted'));
  } else {
    flow.append(flowStep('2', 'OPTIONS preflight', 'The message does not establish this.', 'Unknown'));
  }

  const corsFamilies = new Set(['multiple-origin', 'credentials-wildcard', 'allow-credentials', 'method', 'header', 'origin-mismatch', 'missing-origin', 'redirect', 'preflight']);
  const corsFailure = corsFamilies.has(diagnosis.family);
  flow.append(flowStep('3', 'Check CORS response', corsFailure ? diagnosis.title : 'The available evidence is incomplete.', corsFailure ? 'Failed' : 'Unknown', corsFailure ? 'bad' : ''));

  const mainState = diagnosis.mainRequest === 'YES' ? ['Sent', 'ok'] : diagnosis.mainRequest === 'NO' ? ['Stopped', 'muted'] : ['Unknown', ''];
  flow.append(flowStep('4', 'Send actual request', diagnosis.mainRequest === 'NO' ? 'The browser likely stopped before the main request.' : 'Check the matching Network entry.', mainState[0], mainState[1]));
}

function fixExamples() {
  const origin = enteredOrigin();
  const method = currentMethod();
  const headers = Object.keys(requestHeaders().headers);
  const credentials = $('credentials').checked;
  const expressFields = [
    `  origin: ${JSON.stringify(origin)}`,
    `  methods: [${JSON.stringify(method)}]`,
    headers.length ? `  allowedHeaders: ${JSON.stringify(headers)}` : null,
    credentials ? '  credentials: true' : null
  ].filter(Boolean).join(',\n');
  const nginxHeaders = headers.length
    ? `\n  add_header Access-Control-Allow-Headers ${JSON.stringify(headers.join(', '))} always;`
    : '';
  const nginxCredentials = credentials
    ? '\n  add_header Access-Control-Allow-Credentials "true" always;'
    : '';
  return {
    express: `import cors from 'cors';\n\napp.use(cors({\n${expressFields}\n}));`,
    nginx: `location / {\n  add_header Access-Control-Allow-Origin ${JSON.stringify(origin)} always;\n  add_header Vary "Origin" always;\n  add_header Access-Control-Allow-Methods ${JSON.stringify(method + ', OPTIONS')} always;${nginxHeaders}${nginxCredentials}\n\n  if ($request_method = OPTIONS) { return 204; }\n}`,
    fastapi: `from fastapi.middleware.cors import CORSMiddleware\n\napp.add_middleware(\n    CORSMiddleware,\n    allow_origins=[${JSON.stringify(origin)}],\n    allow_methods=[${JSON.stringify(method)}],\n    allow_headers=${JSON.stringify(headers)},\n    allow_credentials=${credentials ? 'True' : 'False'},\n)`
  };
}

function renderFix(diagnosis) {
  $('fixDiagnosis').replaceChildren();
  const title = document.createElement('strong');
  const detail = document.createElement('span');
  title.textContent = diagnosis.title;
  detail.textContent = diagnosis.likelyCause;
  $('fixDiagnosis').append(title, detail);

  $('fixChecks').replaceChildren(...diagnosis.checks.map(check => {
    const item = document.createElement('li');
    item.textContent = check;
    return item;
  }));
  renderBrowserFlow(diagnosis);

  const supportedFamilies = new Set([
    'multiple-origin', 'credentials-wildcard', 'allow-credentials', 'method',
    'header', 'origin-mismatch', 'missing-origin', 'preflight'
  ]);
  $('codeFixSection').hidden = !supportedFamilies.has(diagnosis.family);
  if (!$('codeFixSection').hidden) {
    document.querySelectorAll('.framework-tab').forEach(tab => tab.setAttribute('aria-selected', String(tab.dataset.stack === 'express')));
    highlightCode($('fixCode'), fixExamples().express);
  }
  reveal($('fixPanel'), 4);
}

function explainBrowserResult() {
  const text = $('browserResult').value.trim();
  if (!text) {
    $('browserExplanation').hidden = true;
    $('fixPanel').hidden = true;
    return;
  }
  const diagnosis = findBrowserDiagnosis(text);
  renderBrowserExplanation(diagnosis);
  renderFix(diagnosis);
}

for (const id of ['siteUrl', 'targetUrl', 'requestHeaders', 'requestBody']) {
  $(id).addEventListener('input', markDiagnosticStale);
}
for (const id of ['method', 'credentials']) {
  $(id).addEventListener('change', markDiagnosticStale);
}

$('startDiagnosis').onclick = () => {
  const source = validHttpUrl($('siteUrl').value.trim());
  const target = validHttpUrl($('targetUrl').value.trim());
  enteredOrigin();
  targetUrl();
  if (!source || !target) {
    $('diagnosticStatus').textContent = 'Enter both complete URLs before building the comparison.';
    return;
  }
  if (!updateDiagnosticCode()) return;
  $('diagnosticStatus').textContent = 'Comparison ready.';
  reveal($('diagnostic'), 2);
};

function bindCodeToggle(buttonId, codeId, shownLabel = 'Hide generated code', hiddenLabel = 'View generated code') {
  $(buttonId).onclick = () => {
    const code = $(codeId);
    code.hidden = !code.hidden;
    $(buttonId).setAttribute('aria-expanded', String(!code.hidden));
    $(buttonId).textContent = code.hidden ? hiddenLabel : shownLabel;
  };
}

bindCodeToggle('toggleCombined', 'combinedFetch');
bindCodeToggle('toggleTarget', 'targetFetch', 'Hide code', 'View code');
bindCodeToggle('toggleControl', 'controlFetch', 'Hide code', 'View code');

document.querySelectorAll('.outcome-button').forEach(button => {
  button.addEventListener('click', () => renderOutcome(button.dataset.outcome));
});

$('chooseAgain').onclick = () => $('diagnostic').scrollIntoView({behavior: 'smooth', block: 'center'});
$('showBrowserClue').onclick = () => reveal($('browserCluePanel'), 3);
$('explainBrowserResult').onclick = explainBrowserResult;
$('browserResult').addEventListener('input', () => {
  $('browserExplanation').hidden = true;
  $('fixPanel').hidden = true;
  setProgress(3);
});

document.querySelectorAll('.framework-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.framework-tab').forEach(other => other.setAttribute('aria-selected', String(other === tab)));
    highlightCode($('fixCode'), fixExamples()[tab.dataset.stack]);
  });
});

copyControl('copyTarget', () => $('targetFetch').textContent);
copyControl('copyControl', () => $('controlFetch').textContent);
copyControl('copyCombined', () => $('combinedFetch').textContent);
copyControl('copyFix', () => $('fixCode').textContent);
copyControl('retest', () => $('combinedFetch').textContent);

updateControlSummary();
