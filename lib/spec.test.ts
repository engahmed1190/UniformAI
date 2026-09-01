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
