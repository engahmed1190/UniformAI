// Run: npx tsx lib/garments.test.ts
// Logo placement is a claim about a real garment, so the drawing has to
// agree with the words. These pin the two things that were wrong.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../components/garments.tsx', import.meta.url), 'utf8');

// The flats are drawn front-on with the garment centred at x=100.
const CENTRE = 100;
const xOf = (key: string) => {
  const m = src.match(new RegExp(`${key}:\\s*\\{\\s*x:\\s*(\\d+)`));
  if (!m) throw new Error(`no coordinate for ${key}`);
  return Number(m[1]);
};

// 1. On a front view the wearer's left chest faces the viewer's right-hand
// side of the screen -- i.e. a LOWER x. Getting this backwards put the badge
// on the wrong breast.
assert.ok(xOf('left_chest') < CENTRE,
  `left chest must render left of centre on a front view, got ${xOf('left_chest')}`);
assert.ok(xOf('right_chest') > CENTRE,
  `right chest must render right of centre, got ${xOf('right_chest')}`);

// 2. The two chest positions must be mirror images, not arbitrary points.
assert.equal(
  CENTRE - xOf('left_chest'),
  xOf('right_chest') - CENTRE,
  'chest positions must be symmetric about the centre line',
);

// 3. A back logo sits on the centre line.
assert.equal(xOf('back'), CENTRE, 'a back logo belongs on the centre seam');

// 4. The sleeve badge must sit clear of the cuff band. The cuff runs from
// x=36 to x=59 on the left sleeve; a badge overlapping it was the "square on
// the sleeve" report -- the badge sat on top of a white cuff.
const sleeveX = xOf('sleeve');
const sleeveW = Number(src.match(/sleeve:\s*\{[^}]*w:\s*(\d+)/)![1]);
assert.ok(sleeveX - sleeveW / 2 >= 46,
  `sleeve badge starts at ${sleeveX - sleeveW / 2}, inside the cuff band (ends x=59)`);

// 5. Every placement carries a width and size, so a long company name is
// scaled to its placement instead of running off the garment.
for (const key of ['left_chest', 'right_chest', 'sleeve', 'back']) {
  const entry = src.match(new RegExp(`${key}:\\s*\\{([^}]*)\\}`))![1];
  assert.match(entry, /w:\s*\d/, `${key} needs a width to scale text into`);
  assert.match(entry, /size:\s*[\d.]/, `${key} needs a font size`);
}
// Long names are squeezed into the placement; short ones are left alone,
// since textLength stretches as readily as it shrinks.
assert.match(src, /textLength: spot\.w/,
  'a long name must be constrained to the placement width');
assert.match(src, /text\.length > spot\.w/,
  'the constraint must be conditional, or short text gets stretched');

// 6. The logo colour is a spec field, not a hardcoded fill.
assert.match(src, /fill=\{logo\?\.colour \?\? '#ffffff'\}/,
  'logo colour must come from the spec, defaulting to white');

// 7. Only a back placement flips the view. Anything else stays front-on,
// otherwise the garment reads as transparent.
assert.match(src, /const isBackView = \(p\?: LogoPosition\) => p === 'back'/,
  'back view must be driven by the logo position');

// 8. Front-only detail is conditional, so a back view cannot show a placket
// or buttons through the garment.
for (const part of ['Polo', 'Shirt', 'Blazer']) {
  const fn = src.slice(src.indexOf(`function ${part}(`));
  const body = fn.slice(0, fn.indexOf('\n}'));
  assert.match(body, /\{ g, back \}/, `${part} must accept a back flag`);
  assert.match(body, /back \?/, `${part} must render differently from behind`);
}

console.log('garments: all assertions passed');
