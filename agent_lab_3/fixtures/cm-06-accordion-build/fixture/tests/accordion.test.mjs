// Public tests (r200 contract). Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAccordion, toggle, moveFocus, renderHtml } from '../accordion.mjs';

const items = [
  { id: 'a', title: 'Alpha', content: 'First' },
  { id: 'b', title: 'Beta', content: 'Second' },
  { id: 'c', title: 'Gamma', content: 'Third' },
];

test('createAccordion: single mode keeps only the first initiallyOpen id; unknown ids are dropped', () => {
  const s = createAccordion(items, { initiallyOpen: ['b', 'c', 'zzz'] });
  assert.deepEqual(s.open, ['b']);
  assert.equal(s.focus, 0);
});

test('toggle: opens and closes without mutating the input state', () => {
  const s0 = createAccordion(items);
  const s1 = toggle(s0, 'a');
  assert.deepEqual(s1.open, ['a']);
  assert.deepEqual(s0.open, []);
  assert.deepEqual(toggle(s1, 'a').open, []);
  assert.equal(toggle(s1, 'nope'), s1);
});

test('toggle: single mode closes the previously open panel', () => {
  let s = createAccordion(items, { initiallyOpen: ['a'] });
  s = toggle(s, 'b');
  assert.deepEqual(s.open, ['b']);
  s = toggle(s, 'c');
  assert.deepEqual(s.open, ['c']);
});

test('moveFocus: ArrowDown wraps, Home and End hit the first and last header', () => {
  let s = createAccordion(items);
  s = moveFocus(s, 'ArrowDown'); assert.equal(s.focus, 1);
  s = moveFocus(s, 'ArrowDown'); s = moveFocus(s, 'ArrowDown'); assert.equal(s.focus, 0, 'wraps');
  s = moveFocus(s, 'End'); assert.equal(s.focus, 2);
  s = moveFocus(s, 'Home'); assert.equal(s.focus, 0);
  assert.equal(moveFocus(s, 'Tab'), s);
});

test('renderHtml: aria-expanded, hidden and aria-controls follow the contract', () => {
  const s = createAccordion(items, { initiallyOpen: ['b'] });
  const html = renderHtml(s);
  assert.match(html, /<button class="acc-btn" id="acc-btn-a" aria-expanded="false" aria-controls="acc-panel-a">Alpha<\/button>/);
  assert.match(html, /<button class="acc-btn" id="acc-btn-b" aria-expanded="true" aria-controls="acc-panel-b">Beta<\/button>/);
  assert.match(html, /<div class="acc-panel" id="acc-panel-a" role="region" aria-labelledby="acc-btn-a" hidden>First<\/div>/);
  assert.match(html, /<div class="acc-panel" id="acc-panel-b" role="region" aria-labelledby="acc-btn-b">Second<\/div>/);
});
