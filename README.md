# contrast-checker

A single-page WCAG 2.1 contrast ratio checker. Open `index.html` in any browser — no build step, no server, no network calls.

## What it does

- Computes the contrast ratio between a text color and a background color using the WCAG 2.1 relative-luminance formula.
- Grades the pair against all four thresholds: AA (4.5:1), AAA (7:1), AA large text (3:1), AAA large text (4.5:1).
- Suggests the closest passing color, searching in 1% steps toward both black and white and reporting whichever direction gets there fastest.
- Live preview: the left half shows text over the background, the right half the reverse, so you judge it by eye as well as by number.

## Usage

Open `index.html` directly (`file://` works), or serve the folder with any static server:

```
npx serve .
```

Type a hex value (`#abc`, `abc`, `#aabbcc`), use the color pickers, or hit **Swap colors**. Click any suggestion chip to adopt it.

## Using the library

`contrast.js` is a UMD module: it attaches `window.Contrast` in the browser and `module.exports` in Node.

```js
const Contrast = require('./contrast.js');

Contrast.contrastRatio('#777777', '#ffffff');   // 4.478089453577214
Contrast.analyze('#767676', '#ffffff').best;    // 'AA'
Contrast.suggest('#8a8a8a', '#ffffff', 4.5);    // [{ color: '#757575', ratio: 4.61, steps: 15, direction: 'dark' }]
```

API: `parseHex`, `toHex`, `luminance`, `contrastRatio`, `formatRatio`, `grade`, `adjust`, `suggest`, `analyze`, `thresholds`.

`suggest` returns an empty array when the pair already passes, so it is safe to call unconditionally. `adjust` is the primitive: it walks one color toward black or white and returns the first step that clears the target, or `null` when the target is unreachable (nothing beats 21:1).

## Tests

```
node --test
```

18 checks across two files:

- `test/contrast.test.js` — parses every accepted hex form, rejects junk with the right error type, pins known ratios (black on white = 21.00:1, `#777777` on white = 4.48:1 which just misses AA, `#595959` = 7.00:1), checks ratio symmetry and the [1, 21] bounds over 500 random pairs, verifies `adjust` returns the *minimal* passing step by re-scanning every earlier step with an independent lerp, and covers both `suggest` branches (empty when passing, ordered minimal options when not).
- `test/page.test.js` — compiles every inline script with `vm.Script`, checks `contrast.js` loads before the page code, and confirms every `getElementById` target exists in the markup.

## Notes

- Alpha digits (`#rrggbbaa`) are parsed by dropping alpha — contrast is judged on the composited color, which the page does not model.
- The 0.03928 / 12.92 / 1.055 constants are from WCAG 2.1 §relative luminance. sRGB primaries here are treated as the standard 0.2126 / 0.7152 / 0.0722.

MIT licensed.
