const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../public/cors-debugger.js'), 'utf8');
const generatorSource = source.slice(0, source.indexOf('function setProgress'));

function field(overrides = {}) {
  return {
    value: '', checked: false, textContent: '', attributes: {},
    classList: {
      classes: new Set(),
      add(name) { this.classes.add(name); },
      remove(name) { this.classes.delete(name); },
      contains(name) { return this.classes.has(name); }
    },
    setAttribute(name, value) { this.attributes[name] = value; },
    removeAttribute(name) { delete this.attributes[name]; },
    ...overrides
  };
}

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

function loadGenerators({body = '{}', headers = '', method = 'GET', credentials = false, stored = {}} = {}) {
  const elements = {
    method: field({value: method}),
    credentials: field({checked: credentials}),
    requestBody: field({value: body}),
    requestHeaders: field({value: headers}),
    diagnosticStatus: field(),
    siteUrl: field({value: 'https://app.example.test/page'}),
    targetUrl: field({value: 'https://api.example.test/data'}),
    originResult: field(),
    targetResult: field()
  };
  const context = vm.createContext({
    document: {getElementById: id => elements[id]},
    location: {hostname: 'localhost'},
    URL,
    URLSearchParams,
    Set,
    console,
    localStorage: storage(stored),
    sessionStorage: storage()
  });
  vm.runInContext(
    `${generatorSource}\nthis.generators = {bodyObject, parseHeaderLines, requestHeaders, validatedRequest, controlHeaders, requestSnippet, combinedDiagnosticSnippet, diagnosticControlUrl, storedUrlMemory};`,
    context
  );
  return {generators: context.generators, elements};
}

async function destinationsExecutedBy(snippet) {
  const destinations = [];
  const options = [];
  const context = vm.createContext({
    console: {log() {}, error() {}},
    fetch: async (destination, requestOptions) => {
      destinations.push(destination);
      options.push(requestOptions);
      return {
        status: 200,
        headers: {entries: () => [], [Symbol.iterator]: function* () {}},
        text: async () => ''
      };
    }
  });

  const script = new vm.Script(snippet);
  await script.runInContext(context);
  return {destinations, options};
}

const destinations = [
  "https://api.example.test/it's-here",
  'https://api.example.test/a\\backslash',
  'https://api.example.test/data?first=one&second=two',
  'https://api.example.test/data#response-fragment',
  'https://api.example.test/%27quoted%20content?value=%5C'
];

for (const destination of destinations) {
  test(`request snippet safely preserves ${destination}`, async () => {
    const {generators} = loadGenerators();
    const snippet = generators.requestSnippet(destination);

    assert.doesNotThrow(() => new vm.Script(snippet));
    assert.deepEqual((await destinationsExecutedBy(snippet)).destinations, [destination]);
    assert.ok(snippet.includes(JSON.stringify(destination)));
  });
}

test('combined diagnostic snippet safely preserves both URLs', async () => {
  const {generators} = loadGenerators();
  const target = "https://target.example.test/a\\path?name=O'Reilly#results";
  const control = 'https://control.example.test/%27baseline?encoded=%5C#control';
  const snippet = generators.combinedDiagnosticSnippet(target, control);

  assert.doesNotThrow(() => new vm.Script(snippet));
  assert.deepEqual((await destinationsExecutedBy(snippet)).destinations, [target, control]);
  assert.ok(snippet.includes(JSON.stringify(target)));
  assert.ok(snippet.includes(JSON.stringify(control)));
});

test('invalid JSON is rejected without substituting a fallback body', () => {
  const {generators} = loadGenerators({body: '{invalid', method: 'POST'});

  assert.throws(() => generators.bodyObject(), error => error.name === 'SyntaxError');
  assert.equal(generators.validatedRequest().valid, false);
  assert.doesNotMatch(generators.bodyObject.toString(), /playground/);
});

test('malformed header lines are rejected before code is generated', () => {
  const {generators, elements} = loadGenerators({headers: 'Authorization bearer-token'});

  assert.equal(generators.validatedRequest().valid, false);
  assert.equal(elements.requestHeaders.attributes['aria-invalid'], 'true');
  assert.equal(elements.diagnosticStatus.textContent, 'Each request header needs the format Name: value.');
});

test('body methods automatically add the JSON content type', () => {
  const {generators} = loadGenerators({body: '{"working":true}', method: 'PATCH'});

  assert.deepEqual(
    JSON.parse(JSON.stringify(generators.requestHeaders().headers)),
    {'Content-Type': 'application/json'}
  );
});

test('control preserves sensitive header names but replaces their values', async () => {
  const {generators} = loadGenerators({
    method: 'POST',
    body: '{"working":true}',
    headers: 'Authorization: Bearer actual-secret\nX-API-Key: key-secret\nX-Trace: safe-value'
  });
  const target = 'https://api.example.test/data';
  const control = generators.diagnosticControlUrl();
  const snippet = generators.combinedDiagnosticSnippet(target, control);
  const {options} = await destinationsExecutedBy(snippet);

  assert.equal(options[0].headers.Authorization, 'Bearer actual-secret');
  assert.equal(options[0].headers['X-API-Key'], 'key-secret');
  assert.equal(options[1].headers.Authorization, 'anotherexample-redacted');
  assert.equal(options[1].headers['X-API-Key'], 'anotherexample-redacted');
  assert.equal(options[1].headers['X-Trace'], 'safe-value');
  assert.equal(options[0].body, '{"working":true}');
  assert.equal(options[1].body, '{"anotherexample":"redacted"}');
  assert.match(control, /headers=Authorization%2C\+X-API-Key%2C\+X-Trace/);
  assert.doesNotMatch(control, /actual-secret|key-secret|safe-value/);
});

test('credentialed control reflects the requesting origin and allows the selected request shape', () => {
  const {generators} = loadGenerators({
    method: 'DELETE',
    credentials: true,
    headers: 'X-Request-ID: example'
  });
  const control = new URL(generators.diagnosticControlUrl());

  assert.equal(control.origin, 'https://cors-preview.anotherexample.com');
  assert.equal(control.searchParams.get('allowOrigin'), 'echo');
  assert.equal(control.searchParams.get('credentials'), 'true');
  assert.match(control.searchParams.get('methods'), /DELETE/);
  assert.match(control.searchParams.get('headers'), /X-Request-ID/);
});

test('the combined result prints exactly one of the four interface outcomes', () => {
  const {generators} = loadGenerators();
  const snippet = generators.combinedDiagnosticSnippet('https://target.test', 'https://control.test');

  for (const outcome of [
    'A worked · B worked',
    'A failed · B worked',
    'A failed · B failed',
    'A worked · B failed'
  ]) assert.match(snippet, new RegExp(outcome.replace('·', '·')));
});

test('saved URL memory rejects invalid entries, removes duplicates, and stays bounded', () => {
  const storedUrls = JSON.stringify({
    siteUrl: 'https://app.example.test/page',
    targetUrls: [
      'not a URL',
      'https://api.example.test/one',
      'https://api.example.test/one',
      'https://api.example.test/two',
      'https://api.example.test/three',
      'https://api.example.test/four',
      'https://api.example.test/five',
      'https://api.example.test/six'
    ]
  });
  const {generators} = loadGenerators({stored: {'anotherexample.corsDebugger.urls.v1': storedUrls}});
  const memory = JSON.parse(JSON.stringify(generators.storedUrlMemory()));

  assert.equal(memory.siteUrl, 'https://app.example.test/page');
  assert.deepEqual(memory.targetUrls, [
    'https://api.example.test/one',
    'https://api.example.test/two',
    'https://api.example.test/three',
    'https://api.example.test/four',
    'https://api.example.test/five'
  ]);
});
