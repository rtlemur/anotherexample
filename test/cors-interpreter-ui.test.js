const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const parser = fs.readFileSync(path.join(__dirname, '../public/cors-diagnosis.js'), 'utf8');
const source = fs.readFileSync(path.join(__dirname, '../public/cors-error-interpreter.js'), 'utf8');
const interpreter = parser + source.slice(source.indexOf('function renderDiagnosis('));

function setup({storageBlocked = false} = {}) {
  const elements = new Map();
  let writes = 0;
  let parses = 0;
  let now = 0;
  let nextTimer = 0;
  const timers = new Map();
  const carried = new Map();
  const destinations = [];
  const $ = id => {
    if (!elements.has(id)) {
      elements.set(id, {
        value: '', scrollHeight: 90, style: {}, listeners: {}, children: [], textContent: '',
        replaceChildren(...children) {
          this.children = children;
          this.textContent = children.map(child => child.textContent).join('\n');
          writes++;
        },
        addEventListener(name, listener) { this.listeners[name] = listener; },
        focus() { assert.fail('Must not move focus'); },
        scrollIntoView() { assert.fail('Must not scroll'); },
      });
    }
    return elements.get(id);
  };
  const context = vm.createContext({
    $, URL, document: {createElement(localName) { return {localName, textContent: ''}; }},
    setTimeout(fn, delay) { const id = ++nextTimer; timers.set(id, {fn, due: now + delay}); return id; },
    clearTimeout(id) { timers.delete(id); },
    sessionStorage: {
      setItem(key, value) {
        if (storageBlocked) throw new Error('Storage blocked');
        carried.set(key, value);
      }
    },
    location: {assign(url) { destinations.push(url); }},
  });
  vm.runInContext(interpreter, context);
  const parser = context.findBrowserDiagnosis;
  context.findBrowserDiagnosis = text => { parses++; return parser(text); };
  function advance(ms) {
    now += ms;
    for (const [id, task] of [...timers]) {
      if (task.due <= now) { timers.delete(id); task.fn(); }
    }
  }
  function input(value) {
    $('browserResult').value = value;
    $('browserResult').listeners.input();
  }
  return { $, input, advance, carried, destinations, get writes() { return writes; }, get parses() { return parses; } };
}

test('the error handoff stores the current error in the tab and uses a URL without the error', () => {
  const ui = setup();
  ui.input('First error');
  ui.input('net::ERR_NAME_NOT_RESOLVED');
  ui.$('continueDebugger').onclick();
  assert.equal(ui.carried.get('anotherexample.corsDebugger.error.v1'), 'net::ERR_NAME_NOT_RESOLVED');
  assert.deepEqual(ui.destinations, ['/cors?from=explainer']);
  ui.input('');
  assert.equal(ui.$('continueDebugger').disabled, true);
});

test('a blocked handoff explains recovery and stays on the Explainer', () => {
  const ui = setup({storageBlocked: true});
  ui.input('Failed to fetch');
  ui.$('continueDebugger').onclick();
  assert.equal(ui.destinations.length, 0);
  assert.match(ui.$('handoffStatus').textContent, /Copy it/);
});

test('paste automatically diagnoses after 400ms; edits restart the debounce', () => {
  const ui = setup();
  ui.input("No 'Access-Control-Allow-Origin' header");
  ui.advance(399);
  assert.equal(ui.parses, 0);
  ui.advance(1);
  assert.match(ui.$('browserExplanation').textContent, /Origin not allowed by server/);
  assert.equal(ui.$('preflightDiagnosisPanel').hidden, false);
  ui.input('TypeError: Failed to fetch');
  ui.advance(300);
  ui.input('Access-Control-Allow-Origin: * used with credentials');
  ui.advance(399);
  assert.equal(ui.parses, 1);
  ui.advance(1);
  assert.match(ui.$('browserExplanation').textContent, /Credentials cannot use a wildcard origin/);
  assert.equal(ui.parses, 2);
});

test('clearing hides stale results, cancels pending work, and never diagnoses empty text', () => {
  const ui = setup();
  ui.input('Failed to fetch');
  ui.advance(400);
  ui.input('CORS preflight channel did not succeed');
  ui.input('   ');
  ui.advance(1000);
  ui.$('explainBrowserResult').onclick();
  assert.equal(ui.parses, 1);
  assert.equal(ui.$('browserExplanation').textContent, '');
  assert.equal(ui.$('preflightDiagnosisPanel').hidden, true);
  ui.input('Failed to fetch');
  ui.advance(400);
  assert.match(ui.$('browserExplanation').textContent, /cause unclear/);
});

test('manual diagnosis renders one heading and a checklist and cancels the automatic update', () => {
  const ui = setup();
  ui.input('CORS preflight channel did not succeed');
  ui.$('explainBrowserResult').onclick();
  const [heading, description] = ui.$('browserExplanation').children;
  assert.deepEqual([heading.localName, heading.textContent], ['h3', 'Preflight failed']);
  assert.equal(description.localName, 'p');
  assert.equal(ui.$('browserExplanation').children.length, 2);
  const checklist = ui.$('preflightChecks');
  assert.ok(checklist.children.length && checklist.children.every(item => item.localName === 'li'));
  assert.doesNotMatch(checklist.textContent, /Likely cause|Preflight failed/);
  assert.ok(!checklist.textContent.includes(description.textContent));
  assert.equal(ui.parses, 1);
  ui.advance(1000);
  assert.equal(ui.parses, 1);
});

test('equivalent diagnoses do not rewrite live regions or repeat announcements', () => {
  const ui = setup();
  ui.input('Failed to fetch');
  ui.advance(400);
  const writes = ui.writes;
  ui.input('TypeError: Failed to fetch');
  ui.advance(400);
  assert.equal(ui.writes, writes);
  const markup = fs.readFileSync(path.join(__dirname, '../public/cors-errors.html'), 'utf8');
  assert.match(markup, /id="browserExplanation" aria-live="polite" aria-atomic="true"><\/div>/);
  assert.match(markup, /<ul id="preflightChecks"><\/ul>/);
});

test('IME composition waits until composition ends before scheduling', () => {
  const ui = setup();
  ui.input('Failed to fetch');
  ui.$('browserResult').listeners.compositionstart();
  ui.input('Load failed');
  ui.advance(1000);
  assert.equal(ui.parses, 0);
  ui.$('browserResult').listeners.compositionend();
  ui.advance(400);
  assert.equal(ui.parses, 1);
});

test('textarea grows, caps long input, and shrinks when cleared', () => {
  const ui = setup();
  ui.$('browserResult').scrollHeight = 150;
  ui.input('Failed to fetch');
  assert.equal(ui.$('browserResult').style.height, '152px');
  ui.$('browserResult').scrollHeight = 1000;
  ui.input('Failed to fetch\n'.repeat(50));
  assert.equal(ui.$('browserResult').style.height, '220px');
  ui.$('browserResult').scrollHeight = 90;
  ui.input('');
  assert.equal(ui.$('browserResult').style.height, '92px');
});

test('context updates even for equivalent diagnoses and clears with the input', () => {
  const ui = setup();
  const message = "Access to fetch at 'https://api.example/data' from origin 'https://client.example' has been blocked by CORS policy";
  ui.input(message);
  ui.advance(400);
  assert.match(ui.$('errorContext').textContent, /https:\/\/api.example\/data/);
  ui.input(message.replace('api.example', 'other.example'));
  ui.advance(400);
  assert.match(ui.$('errorContext').textContent, /https:\/\/other.example\/data/);
  ui.input('');
  assert.equal(ui.$('errorContext').hidden, true);
  assert.equal(ui.$('errorContext').textContent, '');
});
