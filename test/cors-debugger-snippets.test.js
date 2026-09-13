const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../public/cors-debugger.js'), 'utf8');
const snippetFunctions = source.slice(0, source.indexOf('function requestShapeSummary'));

function loadGenerators() {
  const elements = {
    method: {value: 'GET'},
    credentials: {checked: false},
    requestBody: {value: '{}'},
  };
  const context = vm.createContext({
    document: {getElementById: id => elements[id]},
    URL,
  });
  vm.runInContext(
    `${snippetFunctions}\nthis.generators = {requestSnippet, combinedDiagnosticSnippet};`,
    context,
  );
  return context.generators;
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
