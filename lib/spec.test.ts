// Run: npx tsx lib/spec.test.ts
// The one thing worth checking: an edit changes exactly what it says and nothing else.
import assert from 'node:assert/strict';
import { type Concept, setPart, setLogo, cloneConcept, colourFingerprint, conceptPrice, PARTS } from './spec';
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

// 12. A colour named alongside the logo recolours the LOGO, not the shirt.
// This was a real bug: "make the logo gold" fell through to the colour
// branch and silently repainted the first top's body.
const r5 = refine(rBase, 'make the logo gold');
assert.ok(r5);
assert.equal(r5.concept.logo.colour, '#c8a24a');
assert.equal(r5.patch, 'logo.colour = #c8a24a');
// The half that actually catches the bug: no garment colour moved.
assert.equal(colourFingerprint(r5.concept), fpBefore, 'a logo recolour touched a garment');

// 13. The mirror case: an over-eager logo gate must not swallow normal
// colour edits. "make the shirt gold" still has to reach the shirt.
const r6 = refine(rBase, 'make the shirt gold');
assert.ok(r6);
assert.equal(r6.concept.garments[0].parts.body, '#c8a24a');
assert.equal(r6.concept.logo.colour, rBase.logo.colour);
assert.notEqual(colourFingerprint(r6.concept), fpBefore);

// 14. Placement and colour in one sentence carry both.
const r7 = refine(rBase, 'print the logo on the sleeve in white');
assert.ok(r7);
assert.equal(r7.concept.logo.method, 'print');
assert.equal(r7.concept.logo.position, 'sleeve');
assert.equal(r7.concept.logo.colour, '#ffffff');
assert.equal(colourFingerprint(r7.concept), fpBefore);

// 15. setLogo validates its hex the same way setPart does.
assert.throws(() => setLogo(rBase, { colour: 'gold' }), /bad hex/);

// 16. Nonsense is refused rather than guessed at.
assert.equal(refine(rBase, 'make it feel more premium'), null);
assert.equal(refine(rBase, ''), null);

console.log('spec + refine: all assertions passed');

// The ask box must understand the controls sitting right above it. A text
// field that knows less than the panel beside it reads as decoration.
const fab = refine(CONCEPTS[1], 'use the performance knit');
assert.deepEqual(fab?.grades, [2, 0], 'the knit applies to the polo, not the woven cargo');
assert.equal(fab?.concept, CONCEPTS[1], 'a fabric edit must not touch the garments');

// A grade named for another family must be refused, never substituted. Taking
// index 2 of the woven list would bill fine worsted at +120 while the note
// confirmed a performance knit.
const noKnit = refine(CONCEPTS[0], 'use the performance knit');
assert.equal(noKnit?.grades, undefined, 'wovens have no performance knit');
assert.match(noKnit!.note, /performance knit is not available/i);
assert.match(noKnit!.note, /Brushed twill|Fine worsted/, 'a refusal must say what is on offer');
assert.equal(refine(CONCEPTS[1], '10% spare')?.spare, 0.1);
assert.equal(refine(CONCEPTS[1], 'no spare')?.spare, 0);
assert.equal(refine(CONCEPTS[1], 'make me a sandwich'), null, 'unknown asks must not guess');
console.log('refine: fabric and spare assertions passed');

// Multi-part requests. These three were not merely unsupported before -- they
// were silently WRONG: "navy polo with a gold logo" made the LOGO navy, and
// "polo navy and trousers olive" turned the trousers navy and dropped olive.
const multi = refine(CONCEPTS[1], 'navy polo with a gold logo');
assert.match(multi!.patch, /polo\.parts\.body = #1b2a4a/, 'the polo takes the first colour');
assert.match(multi!.patch, /logo\.colour = #c8a24a/, 'the logo takes its own colour');

const two = refine(CONCEPTS[1], 'make the polo navy and the trousers olive');
assert.match(two!.patch, /polo\.parts\.body = #1b2a4a/);
assert.match(two!.patch, /cargo\.parts\.leg = #3d4a3a/, 'the second clause must not be dropped');

// Partial success: apply what was understood, name what was not.
const half = refine(CONCEPTS[1], 'make me a sandwich and the trouser navy');
assert.match(half!.patch, /cargo\.parts\.leg = #1b2a4a/, 'the understood half still applies');
assert.match(half!.note, /did not follow/, 'the ignored half has to be admitted');
assert.doesNotMatch(half!.patch, /sandwich/);

// Non-spec edits must not clone the concept, or every fabric ask trips the
// unsaved-work guard.
const nonSpec = refine(CONCEPTS[1], 'use the performance knit and 10% spare');
assert.equal(nonSpec!.concept, CONCEPTS[1], 'fabric/spare edits must not touch the garments');
assert.deepEqual(nonSpec!.grades, [2, 0]);
assert.equal(nonSpec!.spare, 0.1);

// A single clause still takes the original path unchanged.
assert.equal(refine(CONCEPTS[1], 'make the trouser navy')!.patch, 'cargo.parts.leg = #1b2a4a');
console.log('refine: multi-part assertions passed');

// "right chest" must not be swallowed by the plain "chest" rule -- in either
// parser. The refine table matched \bchest\b first; the brief only knew one
// chest at all.
import { briefWishes } from './refine';
const rc = refine(rBase, 'move the logo to the right chest');
assert.equal(rc?.concept.logo.position, 'right_chest', 'refine: right chest landed on the left');
assert.equal(briefWishes('navy polos, logo on the right chest').logo, 'right_chest', 'brief: right chest landed on the left');
assert.equal(briefWishes('logo on the chest').logo, 'left_chest', 'brief: plain chest still means left');

// An edited kit is a different kit. Saving deduped on id alone, and an edit
// keeps the seed's id, so customising a saved kit and saving it again kept
// the old one silently while the toast claimed it had saved. kitKey is what
// the library dedupes on: same id AND same content.
import { kitKey } from './spec';
const reworked = refine(rBase, 'make the polo sand')!.concept;
assert.equal(reworked.id, rBase.id, 'an edit does not rename the kit');
assert.notEqual(kitKey(reworked), kitKey(rBase), 'an edited kit is a different kit to save');
assert.equal(kitKey(rBase), kitKey(cloneConcept(rBase)), 'the same kit is the same kit');
assert.notEqual(
  kitKey(setLogo(rBase, { position: 'sleeve' })), kitKey(rBase),
  'a branding change is a different kit too');

// A saved copy of an edited kit gets its own id and a name that tells it
// apart from the original -- three cards all reading "Technicians" is not a
// library, and duplicate ids made React drop one of them.
import { asSavedKit, sameKit } from './spec';
const copy1 = asSavedKit(reworked, [rBase]);
assert.notEqual(copy1.id, rBase.id, 'a saved copy needs its own id');
assert.notEqual(copy1.name, rBase.name, 'a saved copy needs its own name');
assert.equal(colourFingerprint(copy1), colourFingerprint(reworked), 'renaming must not recolour');
const copy2 = asSavedKit(refine(rBase, 'make the polo slate')!.concept, [rBase, copy1]);
assert.notEqual(copy2.id, copy1.id, 'two copies must not collide');
assert.notEqual(copy2.name, copy1.name);
// An unedited kit keeps its own name.
assert.equal(asSavedKit(rBase, []).name, rBase.name);
assert.equal(asSavedKit(rBase, []).id, rBase.id);

// Saving the same kit twice must not make a second copy. asSavedKit mints a
// new id, so a key that includes the id stopped matching on the second save
// and the library grew a v2, v3, v4 of one unchanged kit.
let lib: Concept[] = [rBase];
const saveInto = (c: Concept) => {
  if (lib.some((x) => sameKit(x, c))) return null;
  const k = asSavedKit(c, lib); lib = [...lib, k]; return k.name;
};
const fresh = refine(rBase, 'make the polo sand')!.concept;
assert.equal(saveInto(fresh), 'Front Office v2', 'first save makes a copy');
assert.equal(saveInto(fresh), null, 'saving the same kit again must be a no-op');
assert.equal(lib.length, 2, `library grew to ${lib.length}`);

// Every reply the editor gives back is in the customer's language. These are
// the AI's own voice, so English here is the most visible way the feature
// ships half-done.
import { type Locale } from './i18n';
const ARABIC_REPLY = /[؀-ۿ]/;
const asks: [Locale, string][] = [
  ['en', 'make the trouser navy'], ['en', 'use the performance knit'],
  ['en', 'add 10% spare'], ['en', 'no logo'], ['en', 'move the logo to the sleeve'],
  ['ar', 'make the trouser navy'], ['ar', 'use the performance knit'],
  ['ar', 'add 10% spare'], ['ar', 'no logo'], ['ar', 'move the logo to the sleeve'],
];
for (const [loc, ask] of asks) {
  const r = refine(rBase, ask, [], loc);
  assert.ok(r, `"${ask}" should still be understood in ${loc}`);
  assert.ok(r.note.length > 0, `"${ask}" gave an empty note in ${loc}`);
  if (loc === 'ar') {
    assert.match(r.note, ARABIC_REPLY, `${loc} "${ask}" replied in English: "${r.note}"`);
  } else {
    assert.doesNotMatch(r.note, ARABIC_REPLY, `en "${ask}" leaked Arabic`);
  }
  // The patch line is proof of what changed: code, not prose, in both.
  assert.doesNotMatch(r.patch, ARABIC_REPLY, 'the patch line stays machine-readable');
}

// A reply that names a cloth we cannot offer must still read as one sentence:
// "خامة performance knit لـهذه القطع" mixed the request's own English back
// into Arabic prose. The cloth names stay Latin -- they are catalogue data --
// but the sentence around them is built for the script it is read in.
const woven = CONCEPTS[0];   // Front Office: all wovens, so a knit is refused
const refused = refine(woven, 'use the performance knit', [], 'ar');
assert.ok(refused, 'the refusal is still an answer');
assert.doesNotMatch(refused.note, /\bfor\b|\bI can offer\b|\bthere is no\b/i,
  `English prose left in an Arabic refusal: "${refused.note}"`);
assert.match(refused.note, /[؀-ۿ]/, 'the refusal is Arabic');
