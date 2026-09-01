// Run: npx tsx lib/spec.test.ts
// The one thing worth checking: an edit changes exactly what it says and nothing else.
import assert from 'node:assert/strict';
import { setPart, setLogo, colourFingerprint, conceptPrice, PARTS } from './spec';
import { CONCEPTS, selectConcepts } from './concepts';
import { logoGarmentIndex } from '../components/garments';

const base = CONCEPTS[0];

// 1. Editing one part moves exactly one hex.
const before = colourFingerprint(base);
const edited = setPart(base, 0, 'body', '#e8dcc0');
const after = colourFingerprint(edited);
const diffs = before.split(/[|,]/).filter((f, i) => f !== after.split(/[|,]/)[i]);
assert.equal(diffs.length, 1, `expected 1 colour change, got ${diffs.length}: ${diffs}`);
assert.equal(edited.garments[0].parts.body, '#e8dcc0');

// 2. The original is untouched -- edits are pure.
assert.equal(colourFingerprint(base), before, 'setPart mutated its input');

// 3. Non-colour fields survive an edit. This is the "collar cannot drift" claim.
assert.deepEqual(
  edited.garments.map((g) => [g.type, g.fabric, g.unitPrice]),
  base.garments.map((g) => [g.type, g.fabric, g.unitPrice]),
);
assert.deepEqual(edited.logo, base.logo);

// 4. Invalid edits are refused, not silently applied.
assert.throws(() => setPart(base, 0, 'sleeve_lining', '#000000'), /no part/);
assert.throws(() => setPart(base, 0, 'body', 'beige'), /bad hex/);
assert.throws(() => setPart(base, 99, 'body', '#000000'), /no garment/);

// 5. Every canned concept is renderable: parts declared == parts present.
for (const c of CONCEPTS) {
  for (const g of c.garments) {
    assert.deepEqual(
      Object.keys(g.parts).sort(),
      [...PARTS[g.type]].sort(),
      `${c.name}/${g.type} parts mismatch`,
    );
  }
  assert.ok(conceptPrice(c) > 0, `${c.name} priced at zero`);
}

// 6. Logo edits are patches, not replacements.
const noLogo = setLogo(base, { position: 'none' });
assert.equal(noLogo.logo.method, base.logo.method, 'method lost on position patch');
assert.equal(conceptPrice(noLogo), conceptPrice(base) - 35);

// 7. Both branches of the brief selector. The UI advertises "facilities
//    management" as the industrial path, so it had better lead with Technicians.
assert.equal(selectConcepts({ industry: 'facilities management' })[0].id, 'technicians');
assert.equal(selectConcepts({ industry: 'Luxury real estate' })[0].id, 'front-office');
assert.equal(selectConcepts({ industry: 'construction' })[0].id, 'technicians');
assert.equal(selectConcepts({ industry: 'boutique hotel' })[0].id, 'front-office');

// 8. Logo renders exactly as often as it is charged: once per concept, and
//    only when a garment can carry it.
for (const c of CONCEPTS) {
  const bearers = c.garments.filter((_, i) => i === logoGarmentIndex(c.garments));
  assert.equal(bearers.length, 1, `${c.name} has ${bearers.length} logo-bearing garments`);
}

console.log(`ok - ${CONCEPTS.length} concepts, edits surgical, both briefs route, logo priced once`);

// --- Refinement: a plain-words request becomes a patch, and only that patch.
import { refine } from './refine';

const rBase = CONCEPTS[0]; // shirt + chino + blazer
const legIdx = rBase.garments.findIndex((g) => g.type === 'chino');

// 5. A trouser request reaches the trouser, not the shirt. (This concept's
// chino is already navy, so use a colour that actually moves.)
const r1 = refine(rBase, 'make the trouser olive');
assert.ok(r1, 'expected a patch for "make the trouser olive"');
assert.equal(r1.concept.garments[legIdx].parts.leg, '#3d4a3a');
assert.equal(r1.patch, 'chino.parts.leg = #3d4a3a');

// 6. Exactly one colour moves -- the collar provably cannot drift.
const fpBefore = colourFingerprint(rBase);
const fpAfter = colourFingerprint(r1.concept);
const moved = fpBefore.split(/[|,]/).filter((f, i) => f !== fpAfter.split(/[|,]/)[i]);
assert.equal(moved.length, 1, `refine moved ${moved.length} colours: ${moved}`);

// 7. The input concept is untouched.
assert.equal(colourFingerprint(rBase), fpBefore, 'refine mutated its input');

// 8. A shirt request lands on the shirt, not the trousers.
const r2 = refine(rBase, 'try a sand shirt');
assert.ok(r2);
assert.equal(r2.concept.garments[0].parts.body, '#d6c19c');
assert.equal(r2.concept.garments[legIdx].parts.leg, rBase.garments[legIdx].parts.leg);

// 9. Logo placement is a logo patch, and leaves every colour alone.
const r3 = refine(rBase, 'move the logo to the sleeve');
assert.ok(r3);
assert.equal(r3.concept.logo.position, 'sleeve');
assert.equal(colourFingerprint(r3.concept), fpBefore, 'a logo move changed a colour');

// 10. Naming a region hits that region, not the body.
const r4 = refine(rBase, 'make the collar oxblood');
assert.ok(r4);
assert.equal(r4.concept.garments[0].parts.collar, '#7d2b2b');
assert.equal(r4.concept.garments[0].parts.body, rBase.garments[0].parts.body);

// 11. A blazer/jacket request reaches the blazer, not the first top. The
// blazer branch must stay ahead of TOP_WORDS, which also matches "blazer".
const blazerIdx = rBase.garments.findIndex((g) => g.type === 'blazer');
for (const phrase of ['make the blazer navy', 'make the jacket navy']) {
  const r = refine(rBase, phrase);
  assert.ok(r, `expected a patch for "${phrase}"`);
  assert.equal(r.patch, 'blazer.parts.body = #1b2a4a', `"${phrase}" hit the wrong garment`);
  assert.equal(r.concept.garments[blazerIdx].parts.body, '#1b2a4a');
  // The shirt -- the first top -- must be untouched.
  assert.equal(r.concept.garments[0].parts.body, rBase.garments[0].parts.body);
}

// 12. Nonsense is refused rather than guessed at.
assert.equal(refine(rBase, 'make it feel more premium'), null);
assert.equal(refine(rBase, ''), null);

console.log('spec + refine: all assertions passed');
