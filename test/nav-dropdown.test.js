const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadDropdownBehavior() {
  const listeners = {};
  const summary = {focused: false, focus() { this.focused = true; }};
  const inside = {};
  const dropdown = {
    open: true,
    contains(target) { return target === inside || target === summary; },
    removeAttribute(name) { if (name === 'open') this.open = false; },
    querySelector(selector) { return selector === 'summary' ? summary : null; }
  };
  const document = {
    querySelectorAll(selector) { return selector === '.nav-dropdown' ? [dropdown] : []; },
    addEventListener(type, listener) { listeners[type] = listener; }
  };
  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'nav-dropdown.js'), 'utf8');
  vm.runInNewContext(source, {document});
  return {dropdown, inside, listeners, summary};
}

test('clicking outside dismisses an open navigation dropdown', () => {
  const {dropdown, listeners} = loadDropdownBehavior();
  listeners.click({target: {}});
  assert.equal(dropdown.open, false);
});

test('clicks within the navigation dropdown leave native details behavior alone', () => {
  const {dropdown, inside, listeners, summary} = loadDropdownBehavior();
  listeners.click({target: summary});
  assert.equal(dropdown.open, true);
  listeners.click({target: inside});
  assert.equal(dropdown.open, true);
});

test('Escape dismisses the dropdown and returns focus to its summary', () => {
  const {dropdown, listeners, summary} = loadDropdownBehavior();
  listeners.keydown({key: 'Escape'});
  assert.equal(dropdown.open, false);
  assert.equal(summary.focused, true);
});
