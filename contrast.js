/* contrast.js — WCAG 2.1 contrast ratio math. Works in Node and the browser. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Contrast = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // WCAG 2.1 relative luminance constants.
  var AA_NORMAL = 4.5;
  var AAA_NORMAL = 7;
  var AA_LARGE = 3;
  var AAA_LARGE = 4.5;

  function parseHex(input) {
    if (typeof input !== 'string') {
      throw new TypeError('color must be a string');
    }
    var s = input.trim().replace(/^#/, '');
    if (!/^[0-9a-fA-F]+$/.test(s)) {
      throw new RangeError('not a hex color: ' + input);
    }
    if (s.length === 3) {
      s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    }
    if (s.length === 8) {
      s = s.slice(0, 6); // ignore alpha; contrast is judged on the composited color
    }
    if (s.length !== 6) {
      throw new RangeError('not a hex color: ' + input);
    }
    return {
      r: parseInt(s.slice(0, 2), 16),
      g: parseInt(s.slice(2, 4), 16),
      b: parseInt(s.slice(4, 6), 16)
    };
  }

  function toHex(rgb) {
    var clamp = function (v) {
      v = Math.round(v);
      if (v < 0) return 0;
      if (v > 255) return 255;
      return v;
    };
    var h = function (v) {
      var out = clamp(v).toString(16);
      return out.length === 1 ? '0' + out : out;
    };
    return '#' + h(rgb.r) + h(rgb.g) + h(rgb.b);
  }

  function channelToLinear(v) {
    var c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }

  function luminance(rgb) {
    return (
      0.2126 * channelToLinear(rgb.r) +
      0.7152 * channelToLinear(rgb.g) +
      0.0722 * channelToLinear(rgb.b)
    );
  }

  function contrastRatio(a, b) {
    var la = luminance(parseHex(toHex(parseHex(a))));
    var lb = luminance(parseHex(toHex(parseHex(b))));
    var hi = Math.max(la, lb);
    var lo = Math.min(la, lb);
    return (hi + 0.05) / (lo + 0.05);
  }

  function formatRatio(ratio) {
    return ratio.toFixed(2) + ':1';
  }

  function grade(ratio) {
    return {
      aaNormal: ratio >= AA_NORMAL,
      aaaNormal: ratio >= AAA_NORMAL,
      aaLarge: ratio >= AA_LARGE,
      aaaLarge: ratio >= AAA_LARGE,
      best: ratio >= AAA_NORMAL
        ? 'AAA'
        : ratio >= AA_NORMAL
        ? 'AA'
        : ratio >= AA_LARGE
        ? 'AA Large'
        : 'Fail'
    };
  }

  function mix(a, b, t) {
    var ca = parseHex(a);
    var cb = parseHex(b);
    return {
      r: ca.r + (cb.r - ca.r) * t,
      g: ca.g + (cb.g - ca.g) * t,
      b: ca.b + (cb.b - ca.b) * t
    };
  }

  // Walk `fg` toward `toward` in 1% steps until it clears `target` against `bg`.
  // Returns { color, ratio, steps } or null when even the far end fails.
  function adjust(fg, bg, toward, target) {
    target = target == null ? AA_NORMAL : target;
    toward = toward === 'black' ? '#000000' : '#ffffff';
    for (var i = 1; i <= 100; i++) {
      var candidate = toHex(mix(fg, toward, i / 100));
      var ratio = contrastRatio(candidate, bg);
      if (ratio >= target) {
        return { color: candidate, ratio: ratio, steps: i };
      }
    }
    return null;
  }

  // Both directions, best (fewest steps) first.
  function suggest(fg, bg, target) {
    target = target == null ? AA_NORMAL : target;
    if (contrastRatio(fg, bg) >= target) {
      return []; // already passes, nothing to change
    }
    var options = [];
    [['dark', 'black'], ['light', 'white']].forEach(function (pair) {
      var result = adjust(fg, bg, pair[1], target);
      if (result) {
        result.direction = pair[0];
        options.push(result);
      }
    });
    options.sort(function (x, y) {
      return x.steps - y.steps;
    });
    return options;
  }

  function analyze(fg, bg) {
    var ratio = contrastRatio(fg, bg);
    var g = grade(ratio);
    return {
      fg: toHex(parseHex(fg)),
      bg: toHex(parseHex(bg)),
      ratio: ratio,
      formatted: formatRatio(ratio),
      ...g
    };
  }

  return {
    parseHex: parseHex,
    toHex: toHex,
    luminance: luminance,
    contrastRatio: contrastRatio,
    formatRatio: formatRatio,
    grade: grade,
    adjust: adjust,
    suggest: suggest,
    analyze: analyze,
    thresholds: {
      AA_NORMAL: AA_NORMAL,
      AAA_NORMAL: AAA_NORMAL,
      AA_LARGE: AA_LARGE,
      AAA_LARGE: AAA_LARGE
    }
  };
});
