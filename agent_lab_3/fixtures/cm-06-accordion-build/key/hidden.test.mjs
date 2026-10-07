// Hidden tests for cm-06 (sealed; run by NEXUS against the delivered accordion.mjs + accordion.css in the same folder).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createAccordion, toggle, moveFocus, renderHtml } from './accordion.mjs';

const items = [
  { id: 'a', title: 'Alpha & <b>Omega</b>', content: 'First "quoted" & <i>styled</i>' },
  { id: 'b', title: 'Beta', content: 'Second' },
  { id: 'c', title: 'Gamma', content: 'Third' },
];

test('H1 single mode: opening a second panel closes the first (regression r214)', () => {
  let s = createAccordion(items, { initiallyOpen: ['a'] });
  s = toggle(s, 'b');
  assert.deepEqual(s.open, ['b']);
});

test('H2 multiple mode: both stay open; closing one keeps the other', () => {
  let s = createAccordion(items, { allowMultiple: true, initiallyOpen: ['a', 'b'] });
  assert.deepEqual(s.open, ['a', 'b']);
  s = toggle(s, 'c'); assert.deepEqual(s.open, ['a', 'b', 'c']);
  s = toggle(s, 'b'); assert.deepEqual(s.open, ['a', 'c']);
});

test('H3 End focuses the last header (index n-1), ArrowUp wraps from the first to the last', () => {
  let s = createAccordion(items);
  assert.equal(moveFocus(s, 'End').focus, 2);
  assert.equal(moveFocus(s, 'ArrowUp').focus, 2);
  assert.equal(moveFocus(createAccordion([]), 'End').focus, 0);
});

test('H4 aria-controls references the panel id, not an index', () => {
  const html = renderHtml(createAccordion(items));
  for (const id of ['a', 'b', 'c']) assert.match(html, new RegExp(`id="acc-btn-${id}" aria-expanded="false" aria-controls="acc-panel-${id}"`));
  assert.doesNotMatch(html, /aria-controls="acc-panel-\d"/);
});

test('H5 titles and content are HTML-escaped', () => {
  const html = renderHtml(createAccordion(items));
  assert.match(html, /Alpha &amp; &lt;b&gt;Omega&lt;\/b&gt;<\/button>/);
  assert.match(html, /First &quot;quoted&quot; &amp; &lt;i&gt;styled&lt;\/i&gt;<\/div>/);
  assert.doesNotMatch(html, /<b>Omega<\/b>/);
});

test('H6 immutability: toggle and moveFocus never mutate their input', () => {
  const s0 = createAccordion(items, { initiallyOpen: ['a'] });
  const frozen = JSON.stringify(s0);
  toggle(s0, 'b'); moveFocus(s0, 'End'); renderHtml(s0);
  assert.equal(JSON.stringify(s0), frozen);
});

test('H7 CSS: the hidden attribute wins; no rule sets display on .acc-panel without [hidden]', () => {
  const css = readFileSync(new URL('./accordion.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].map((m) => ({ sel: m[1].trim(), body: m[2] }));
  const hiddenRule = rules.find((r) => /\.acc-panel\[hidden\]/.test(r.sel));
  assert.ok(hiddenRule && /display\s*:\s*none/.test(hiddenRule.body), '.acc-panel[hidden] { display: none } must exist');
  for (const r of rules) {
    if (/acc-panel/.test(r.sel) && !/\[hidden\]/.test(r.sel)) assert.doesNotMatch(r.body, /display\s*:/, `rule "${r.sel}" must not set display`);
  }
});
