// Run: npx tsx lib/garments.test.ts
// Logo placement is a claim about a real garment, so the drawing has to
// agree with the words. These pin the two things that were wrong.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../components/garments.tsx', import.meta.url), 'utf8');

import { ANATOMY, CENTRE, type TopType, placementFor } from './placement';

const TOPS: TopType[] = ['polo', 'shirt', 'blazer'];

// 1. On a front view the wearer's left chest faces the viewer's left-hand
// side of the drawing -- a LOWER x -- and the right chest mirrors it. Getting
// this backwards put the badge on the wrong breast.
for (const top of TOPS) {
  const left = placementFor(top, 'left_chest')!;
  const right = placementFor(top, 'right_chest')!;
  assert.ok(left.x < CENTRE, `${top}: left chest must sit left of centre, got ${left.x}`);
  assert.ok(right.x > CENTRE, `${top}: right chest must sit right of centre, got ${right.x}`);
  assert.equal(CENTRE - left.x, right.x - CENTRE,
    `${top}: chest positions must be symmetric about the centre line`);
}

// 2. A back print sits on the centre seam.
for (const top of TOPS) {
  assert.equal(placementFor(top, 'back')!.x, CENTRE,
    `${top}: a back logo belongs on the centre seam`);
}

// 3. Every badge fits inside the gap it is placed in, on every top. This is
// the assertion a single shared coordinate could not satisfy: the blazer's
// chest panel is half the shirt's and sits further out, because the lapel
// crosses exactly where a shirt's placket-to-armhole panel is.
for (const top of TOPS) {
  const a = ANATOMY[top];

  const chest = placementFor(top, 'left_chest')!;
  assert.ok(chest.x - chest.w / 2 >= a.chestOuterX,
    `${top}: chest badge starts at ${chest.x - chest.w / 2}, outboard of the armhole at ${a.chestOuterX}`);
  assert.ok(chest.x + chest.w / 2 <= a.chestInnerX,
    `${top}: chest badge ends at ${chest.x + chest.w / 2}, over the placket/lapel at ${a.chestInnerX}`);

  const sleeve = placementFor(top, 'sleeve')!;
  assert.ok(sleeve.x - sleeve.w / 2 >= a.sleeveOuterX,
    `${top}: sleeve badge starts at ${sleeve.x - sleeve.w / 2}, outside the sleeve edge at ${a.sleeveOuterX}`);
  assert.ok(sleeve.x + sleeve.w / 2 <= a.armholeX,
    `${top}: sleeve badge ends at ${sleeve.x + sleeve.w / 2}, past the armhole seam at ${a.armholeX}`);
}

// 4. The blazer is the case that proves the placement is per-garment: its
// chest badge must sit outboard of where a shirt's does, because the lapel
// takes the inboard half of the panel.
assert.ok(placementFor('blazer', 'left_chest')!.x < placementFor('shirt', 'left_chest')!.x,
  'a blazer chest badge sits further out than a shirt one, clear of the lapel');
assert.ok(placementFor('blazer', 'sleeve')!.x < placementFor('shirt', 'sleeve')!.x,
  'a blazer sleeve badge sits further out, matching its narrower armhole');

// A garment that carries no logo has no placement at all.
assert.equal(placementFor('chino', 'left_chest'), undefined, 'a trouser has no chest');

// 5. Every placement carries a usable width and a legible size, so a long
// company name is scaled into its placement instead of running off the
// garment -- and is never scaled into nothing.
for (const top of TOPS) {
  for (const key of ['left_chest', 'right_chest', 'sleeve', 'back'] as const) {
    const p = placementFor(top, key)!;
    assert.ok(p.w > 8, `${top}/${key}: ${p.w} is too narrow to set a name in`);
    assert.ok(p.size >= 4.5, `${top}/${key}: ${p.size}px is below legible`);
  }
}
// Long names are squeezed into the placement; short ones are left alone,
// since textLength stretches as readily as it shrinks.
assert.match(src, /textLength: spot\.w/,
  'a long name must be constrained to the placement width');
assert.match(src, /text\.length > spot\.w/,
  'the constraint must be conditional, or short text gets stretched');

// 6. The logo colour is a spec field, not a hardcoded fill. The fallback is
// computed from the cloth behind it: Front Office's shirt body is #ffffff,
// and a white default rendered a logo you had to hunt for on the demo's own
// second kit.
assert.match(src, /fill=\{logo\?\.colour \?\? readableOn\(/,
  'logo colour must come from the spec, falling back to something readable');
assert.match(src, /function readableOn/, 'the fallback has to be defined');

// Fit is the only one of these options that changes the silhouette. Sizes
// stay in the order table and gender selects a production block.
assert.match(src, /const FIT_WIDTH = \{ slim: 0\.92, regular: 1, relaxed: 1\.08 \}/,
  'fit needs three distinct width multipliers');
assert.match(src, /scale\(\$\{width\} 1\)/,
  'the renderer must apply fit horizontally without changing garment height');

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
