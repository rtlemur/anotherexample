const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../public/nav-dropdown.js'), 'utf8');

function setup() {
  const listeners = {};
  const summary = {focusCalls: 0, focus() { this.focusCalls++; }};
  const link = {};
  const dropdown = {
    open: true,
    contains(target) { return target === this || target === summary || target === link; },
    querySelector(selector) {
      assert.equal(selector, 'summary');
      return summary;
    }
  };
  const document = {
    querySelectorAll(selector) {
      assert.equal(selector, '.nav-dropdown');
      return [dropdown];
    },
    addEventListener(type, listener) { listeners[type] = listener; }
  };
  vm.runInNewContext(source, {document});
  return {dropdown, link, listeners, summary};
}

test('clicking outside closes an open navigation dropdown', () => {
  const {dropdown, listeners} = setup();
  listeners.click({target: {}});
  assert.equal(dropdown.open, false);
});

test('clicking inside leaves native dropdown and link behavior alone', () => {
  const {dropdown, link, listeners, summary} = setup();
  listeners.click({target: link});
  assert.equal(dropdown.open, true);
  listeners.click({target: summary});
  assert.equal(dropdown.open, true);
});

test('Escape closes an open navigation dropdown and restores summary focus', () => {
  const {dropdown, listeners, summary} = setup();
  listeners.keydown({key: 'Escape'});
  assert.equal(dropdown.open, false);
  assert.equal(summary.focusCalls, 1);
});
