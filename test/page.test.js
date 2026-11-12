'use strict';

// Static checks on the shipped page: every inline script must compile, and the
// ids the script reaches for must exist in the markup.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function inlineScripts(source) {
  const out = [];
  const re = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = re.exec(source)) !== null) {
    const attrs = match[1] || '';
    if (/\bsrc=/.test(attrs)) continue;
    out.push(match[2]);
  }
  return out;
}

test('index.html has at least one inline script', () => {
  assert.ok(inlineScripts(html).length >= 1);
});

test('every inline script parses', () => {
  for (const src of inlineScripts(html)) {
    assert.doesNotThrow(() => new vm.Script(src, { filename: 'index.html' }));
  }
});

test('the core file is loaded before the page script', () => {
  const srcIdx = html.indexOf('src="contrast.js"');
  const inlineIdx = html.indexOf("(function () {");
  assert.ok(srcIdx > -1, 'index.html must load contrast.js');
  assert.ok(srcIdx < inlineIdx, 'contrast.js must load before inline code');
});

test('every getElementById target exists in the markup', () => {
  const ids = new Set();
  const idRe = /\bid="([^"]+)"/g;
  let m;
  while ((m = idRe.exec(html)) !== null) ids.add(m[1]);
  const wanted = new Set();
  const wantRe = /getElementById\('([^']+)'\)/g;
  while ((m = wantRe.exec(html)) !== null) wanted.add(m[1]);
  assert.ok(wanted.size >= 8, 'expected the page to wire up several elements');
  for (const id of wanted) {
    assert.ok(ids.has(id), 'markup is missing id="' + id + '"');
  }
});

test('page renders with no network calls', () => {
  assert.ok(!/fetch\(|XMLHttpRequest|https?:\/\/[^\s"']+\.(js|css)/.test(html), 'page must be self-contained');
});
