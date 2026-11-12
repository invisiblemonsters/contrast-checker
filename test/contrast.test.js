'use strict';

const test = require('node:test');
const assert = require('node:assert');
const C = require('../contrast.js');

// Reference values computed independently from the WCAG 2.1 definition.
const KNOWN = [
  ['#000000', '#ffffff', 21.0],
  ['#ffffff', '#000000', 21.0],
  ['#ffffff', '#ffffff', 1.0],
  ['#777777', '#ffffff', 4.478089],
  ['#767676', '#ffffff', 4.542225],
  ['#595959', '#ffffff', 7.004729],
  ['#1a1aff', '#ffffff', 7.967583],
  ['#ff0000', '#00ff00', 2.913938],
  ['#336699', '#102030', 2.754067]
];

test('parseHex accepts 3, 6 and 8 digit forms', () => {
  assert.deepStrictEqual(C.parseHex('#abc'), { r: 170, g: 187, b: 204 });
  assert.deepStrictEqual(C.parseHex('abc'), { r: 170, g: 187, b: 204 });
  assert.deepStrictEqual(C.parseHex('  #AABBCC  '), { r: 170, g: 187, b: 204 });
  assert.deepStrictEqual(C.parseHex('#11223344'), { r: 17, g: 34, b: 51 });
  assert.deepStrictEqual(C.parseHex('#000000'), { r: 0, g: 0, b: 0 });
});

test('parseHex rejects junk with the right error type', () => {
  const bad = ['', '#', 'xyz', '#ggg', '12', '#12345', '#1234567', '#123456789,'];
  for (const value of bad) {
    assert.throws(
      () => C.parseHex(value),
      (err) => err.name === 'RangeError',
      'expected RangeError for ' + JSON.stringify(value)
    );
  }
  assert.throws(() => C.parseHex(null), (err) => err.name === 'TypeError');
  assert.throws(() => C.parseHex(123456), (err) => err.name === 'TypeError');
});

test('toHex round-trips and clamps', () => {
  for (const [hex] of KNOWN) {
    assert.strictEqual(C.toHex(C.parseHex(hex)), hex);
  }
  assert.strictEqual(C.toHex({ r: -20, g: 300, b: 7.6 }), '#00ff08');
});

test('luminance bounds', () => {
  assert.strictEqual(C.luminance({ r: 0, g: 0, b: 0 }), 0);
  assert.ok(Math.abs(C.luminance({ r: 255, g: 255, b: 255 }) - 1) < 1e-12);
  const mid = C.luminance({ r: 128, g: 128, b: 128 });
  assert.ok(mid > 0.2 && mid < 0.22);
});

test('known contrast ratios', () => {
  for (const [fg, bg, expected] of KNOWN) {
    const got = C.contrastRatio(fg, bg);
    assert.ok(
      Math.abs(got - expected) < 1e-6,
      fg + ' on ' + bg + ': expected ' + expected + ', got ' + got
    );
    // symmetric
    assert.ok(Math.abs(C.contrastRatio(bg, fg) - got) < 1e-12);
  }
});

test('ratio is always within [1, 21]', () => {
  let seed = 12345;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  for (let i = 0; i < 500; i++) {
    const a = C.toHex({ r: rnd() * 255, g: rnd() * 255, b: rnd() * 255 });
    const b = C.toHex({ r: rnd() * 255, g: rnd() * 255, b: rnd() * 255 });
    const r = C.contrastRatio(a, b);
    assert.ok(r >= 1 - 1e-12 && r <= 21 + 1e-12, a + '/' + b + ' -> ' + r);
  }
});

test('grade boundaries match WCAG thresholds', () => {
  assert.deepStrictEqual(C.grade(21), {
    aaNormal: true,
    aaaNormal: true,
    aaLarge: true,
    aaaLarge: true,
    best: 'AAA'
  });
  assert.strictEqual(C.grade(4.5).aaNormal, true);
  assert.strictEqual(C.grade(4.4999).aaNormal, false);
  assert.strictEqual(C.grade(4.4999).best, 'AA Large');
  assert.strictEqual(C.grade(7).aaaNormal, true);
  assert.strictEqual(C.grade(6.99).best, 'AA');
  assert.strictEqual(C.grade(2.9).best, 'Fail');
  // #777 on white is the classic "just misses AA" case
  assert.strictEqual(C.analyze('#777777', '#ffffff').best, 'AA Large');
  assert.strictEqual(C.analyze('#767676', '#ffffff').best, 'AA');
});

test('formatRatio uses two decimals', () => {
  assert.strictEqual(C.formatRatio(21), '21.00:1');
  assert.strictEqual(C.formatRatio(4.478089), '4.48:1');
  assert.strictEqual(C.formatRatio(1), '1.00:1');
});

test('analyze normalizes shorthand input', () => {
  const out = C.analyze('#abc', '#000');
  assert.strictEqual(out.fg, '#aabbcc');
  assert.strictEqual(out.bg, '#000000');
  assert.ok(out.ratio > 8 && out.ratio < 12);
});

// local lerp so minimality is checked against an independent implementation of the step scan
function lerpHex(fg, toward, t) {
  const a = C.parseHex(fg);
  const b = C.parseHex(toward);
  return C.toHex({
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t
  });
}

test('adjust returns the first passing step (minimal)', () => {
  const cases = [
    ['#777777', '#ffffff', 'black', 4.5],
    ['#777777', '#000000', 'white', 4.5],
    ['#336699', '#102030', 'white', 4.5],
    ['#ff0000', '#00ff00', 'black', 3],
    ['#123456', '#f0f0f0', 'white', 7]
  ];
  for (const [fg, bg, toward, target] of cases) {
    const res = C.adjust(fg, bg, toward, target);
    assert.ok(res, 'expected a result for ' + fg + '/' + bg);
    assert.ok(res.ratio >= target, 'result must pass');
    assert.strictEqual(res.color, lerpHex(fg, toward === 'black' ? '#000000' : '#ffffff', res.steps / 100));
    assert.ok(res.color.startsWith('#') && res.color.length === 7);
    for (let i = 1; i < res.steps; i++) {
      const earlier = lerpHex(fg, toward === 'black' ? '#000000' : '#ffffff', i / 100);
      assert.ok(
        C.contrastRatio(earlier, bg) < target,
        'step ' + i + ' already passed for ' + fg + '/' + bg + ' toward ' + toward
      );
    }
  }
});

test('adjust returns null when the target is unreachable', () => {
  // 21 is the physical maximum: asking for more can never be satisfied
  assert.strictEqual(C.adjust('#000000', '#ffffff', 'black', 21.5), null);
  assert.strictEqual(C.adjust('#ffffff', '#000000', 'white', 21.5), null);
  assert.strictEqual(C.adjust('#ff0000', '#000000', 'white', 21.0001), null);
});

test('suggest: ordered by steps, all options pass, deduped direction', () => {
  const out = C.suggest('#8a8a8a', '#ffffff', 4.5);
  assert.ok(out.length >= 1);
  for (let i = 1; i < out.length; i++) {
    assert.ok(out[i - 1].steps <= out[i].steps, 'options must be steps-ascending');
  }
  for (const opt of out) {
    assert.ok(opt.ratio >= 4.5);
    assert.ok(opt.direction === 'dark' || opt.direction === 'light');
  }
  // black text on white always has a dark option (contrast only grows toward black)
  const dark = C.suggest('#cccccc', '#ffffff', 7).find((o) => o.direction === 'dark');
  assert.ok(dark, 'expected a dark suggestion');
  assert.strictEqual(C.contrastRatio(dark.color, '#ffffff'), dark.ratio);
});

test('suggest on an already-passing color gives the identity-ish minimal step', () => {
  const out = C.suggest('#000000', '#ffffff', 4.5);
  // already 21:1, so no change is needed at all — no options should be produced
  assert.deepStrictEqual(out, []);
});
