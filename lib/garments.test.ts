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

// 4. Only a back placement flips the view. Anything else stays front-on,
// otherwise the garment reads as transparent.
assert.match(src, /const isBackView = \(p\?: LogoPosition\) => p === 'back'/,
  'back view must be driven by the logo position');

// 5. Front-only detail is conditional, so a back view cannot show a placket
// or buttons through the garment.
for (const part of ['Polo', 'Shirt', 'Blazer']) {
  const fn = src.slice(src.indexOf(`function ${part}(`));
  const body = fn.slice(0, fn.indexOf('\n}'));
  assert.match(body, /\{ g, back \}/, `${part} must accept a back flag`);
  assert.match(body, /back \?/, `${part} must render differently from behind`);
}

console.log('garments: all assertions passed');
