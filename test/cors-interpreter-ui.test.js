const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../public/cors-debugger.js'), 'utf8');
const interpreter = source.slice(source.indexOf('function browserDiagnosis('), source.indexOf('\nupdateDiagnostic();', source.indexOf('function renderDiagnosis')));

function setup() {
  const elements = new Map();
  let writes = 0;
  let parses = 0;
  let now = 0;
  let nextTimer = 0;
  const timers = new Map();
  const $ = id => {
    if (!elements.has(id)) {
      let html = '';
      elements.set(id, {
        value: '', style: {}, attributes: {}, listeners: {},
        get innerHTML() { return html; },
        set innerHTML(value) { html = value; writes++; },
        setAttribute(name, value) { this.attributes[name] = value; },
        addEventListener(name, listener) { this.listeners[name] = listener; },
        prepend() {},
        focus() { assert.fail('Must not move focus'); },
        scrollIntoView() { assert.fail('Must not scroll'); },
      });
    }
    return elements.get(id);
  };
  const context = vm.createContext({
    $, resultBadge: () => ({}),
    setTimeout(fn, delay) { const id = ++nextTimer; timers.set(id, {fn, due: now + delay}); return id; },
    clearTimeout(id) { timers.delete(id); },
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
  return { $, input, advance, get writes() { return writes; }, get parses() { return parses; } };
}

test('paste automatically diagnoses after 400ms; edits restart the debounce', () => {
  const ui = setup();
  ui.input("No 'Access-Control-Allow-Origin' header");
  ui.advance(399);
  assert.equal(ui.parses, 0);
  ui.advance(1);
  assert.match(ui.$('browserExplanation').innerHTML, /Origin not allowed by server/);
  assert.equal(ui.$('browserExplanation').style.display, 'block');
  ui.input('TypeError: Failed to fetch');
  ui.advance(300);
  ui.input('Access-Control-Allow-Origin: * used with credentials');
  ui.advance(399);
  assert.equal(ui.parses, 1);
  ui.advance(1);
  assert.match(ui.$('browserExplanation').innerHTML, /Credentials cannot use a wildcard origin/);
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
  assert.equal(ui.$('browserExplanation').style.display, 'none');
  assert.equal(ui.$('preflightDiagnosisPanel').style.display, 'none');
  ui.input('Failed to fetch');
  ui.advance(400);
  assert.equal(ui.$('browserExplanation').style.display, 'block');
});

test('manual button diagnoses immediately and cancels the pending automatic update', () => {
  const ui = setup();
  ui.input('CORS preflight channel did not succeed');
  ui.$('explainBrowserResult').onclick();
  assert.match(ui.$('browserExplanation').innerHTML, /Preflight failed/);
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
  assert.equal(ui.$('preflightDiagnosis').attributes['aria-live'], 'off');
  const markup = fs.readFileSync(path.join(__dirname, '../public/cors.html'), 'utf8');
  assert.match(markup, /id="browserExplanation"[^>]*aria-live="polite"/);
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
