const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../public/cors-debugger.js'), 'utf8');
const snippetFunctions = source.slice(0, source.indexOf('function requestShapeSummary'));

function loadGenerators(bodyValue = '{}') {
  const elements = {
    method: {value: 'GET'},
    credentials: {checked: false},
    requestBody: {value: bodyValue},
  };
  const context = vm.createContext({
    document: {getElementById: id => elements[id]},
    URL,
  });
  vm.runInContext(
    `${snippetFunctions}\nthis.generators = {bodyObject, validatedBody, requestSnippet, combinedDiagnosticSnippet};`,
    context,
  );
  return context.generators;
}

function loadDebugger() {
  const listeners = {};
  const element = (overrides = {}) => ({
    value: '', checked: false, disabled: false, textContent: '', innerHTML: '',
    style: {display: 'none'}, attributes: {},
    addEventListener(type, listener) { listeners[`${this.id}:${type}`] = listener; },
    setAttribute(name, value) { this.attributes[name] = value; },
    removeAttribute(name) { delete this.attributes[name]; },
    scrollIntoView() {},
    ...overrides,
  });
  const ids = ['method', 'allowOrigin', 'methods', 'headers', 'credentials', 'preflight',
    'delay', 'siteUrl', 'targetUrl', 'requestBody', 'requestBodyError', 'diagnosticStatus',
    'diagnostic', 'startDiagnosis', 'targetFetch', 'controlFetch', 'targetSummary',
    'controlSummary', 'toggleTarget', 'toggleControl', 'copyTarget', 'copyControl',
    'copyCombined', 'originResult', 'targetResult'];
  const elements = Object.fromEntries(ids.map(id => [id, element({id})]));
  Object.assign(elements.method, {value: 'POST'});
  Object.assign(elements.allowOrigin, {value: '*'});
  Object.assign(elements.methods, {value: 'GET, POST, OPTIONS'});
  Object.assign(elements.headers, {value: 'Content-Type'});
  Object.assign(elements.preflight, {value: '204'});
  Object.assign(elements.delay, {value: '0'});
  Object.assign(elements.siteUrl, {value: 'https://app.example.test/page'});
  Object.assign(elements.targetUrl, {value: 'https://api.example.test/data'});
  Object.assign(elements.requestBody, {value: '{"working":true}'});

  const context = vm.createContext({
    document: {getElementById: id => elements[id]},
    location: {hostname: 'localhost'}, URL, URLSearchParams,
    highlightCode: (target, value) => { target.textContent = value; },
    copyControl() {},
  });
  vm.runInContext(source, context);
  return {context, elements, listeners};
}

async function destinationsExecutedBy(snippet) {
  const destinations = [];
  const context = vm.createContext({
    console: {log() {}, error() {}},
    fetch: async destination => {
      destinations.push(destination);
      return {
        status: 200,
        headers: {entries: () => [], [Symbol.iterator]: function* () {}},
        text: async () => '',
      };
    },
  });

  const script = new vm.Script(snippet);
  await script.runInContext(context);
  return destinations;
}

const destinations = [
  "https://api.example.test/it's-here",
  'https://api.example.test/a\\backslash',
  'https://api.example.test/data?first=one&second=two',
  'https://api.example.test/data#response-fragment',
  'https://api.example.test/%27quoted%20content?value=%5C',
];

for (const destination of destinations) {
  test(`request snippet safely preserves ${destination}`, async () => {
    const {requestSnippet} = loadGenerators();
    const snippet = requestSnippet(destination);

    assert.doesNotThrow(() => new vm.Script(snippet));
    assert.deepEqual(await destinationsExecutedBy(snippet), [destination]);
    assert.ok(snippet.includes(JSON.stringify(destination)));
  });
}

test('combined diagnostic snippet safely preserves both URLs', async () => {
  const {combinedDiagnosticSnippet} = loadGenerators();
  const target = "https://target.example.test/a\\path?name=O'Reilly#results";
  const control = 'https://control.example.test/%27baseline?encoded=%5C#control';
  const snippet = combinedDiagnosticSnippet(target, control);

  assert.doesNotThrow(() => new vm.Script(snippet));
  assert.deepEqual(await destinationsExecutedBy(snippet), [target, control]);
  assert.ok(snippet.includes(JSON.stringify(target)));
  assert.ok(snippet.includes(JSON.stringify(control)));
});

test('invalid JSON is rejected without substituting a fallback body', () => {
  const {bodyObject, requestSnippet} = loadGenerators('{invalid');

  assert.throws(() => bodyObject(), error => error.name === 'SyntaxError');
  assert.throws(() => requestSnippet('https://example.test'), error => error.name === 'SyntaxError');
  assert.doesNotMatch(bodyObject.toString(), /playground/);
});

test('diagnosis is prevented while JSON is invalid', () => {
  const {elements, listeners} = loadDebugger();
  elements.requestBody.value = '{invalid';
  listeners['requestBody:input']();
  elements.startDiagnosis.onclick();

  assert.equal(elements.requestBody.attributes['aria-invalid'], 'true');
  assert.equal(elements.requestBodyError.textContent, 'Enter valid JSON before starting the diagnosis.');
  assert.equal(elements.targetFetch.textContent, '');
  assert.equal(elements.controlFetch.textContent, '');
  assert.equal(elements.diagnostic.style.display, 'none');
});

test('valid JSON works and correcting invalid JSON clears validation', () => {
  const {elements, listeners} = loadDebugger();
  elements.requestBody.value = '{invalid';
  listeners['requestBody:input']();
  elements.requestBody.value = '{"corrected":true}';
  listeners['requestBody:input']();

  assert.equal(elements.requestBody.attributes['aria-invalid'], undefined);
  assert.equal(elements.requestBodyError.textContent, '');
  assert.match(elements.targetFetch.textContent, /"corrected":true/);
  elements.startDiagnosis.onclick();
  assert.equal(elements.diagnostic.style.display, 'block');

  elements.requestBody.value = '';
  listeners['requestBody:input']();
  assert.equal(elements.requestBody.attributes['aria-invalid'], undefined);
  assert.match(elements.targetFetch.textContent, /JSON\.stringify\(\{\}\)/);
});
