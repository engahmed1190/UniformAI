import assert from 'node:assert/strict';
import { suggestions } from './suggest';
import { CONCEPTS } from './concepts';
import { conceptPriceAt, setLogo, setPart } from './spec';
import { refine } from './refine';
import { translations } from './i18n';
import { contrast } from './manager';

const ops = CONCEPTS[1];          // polo + cargo, both at grade 0
const office = CONCEPTS[0];       // shirt + chino + blazer, all woven
const HOT = 'Summer polos for 40 site staff in Cairo';
const asks = () => Object.entries(translations.en.suggest)
  .filter(([k]) => k.startsWith('ask'));

// 1. The gate. A brief that mentions heat on a kit already quoted at the
// performance grade has nothing to propose: repeating a choice already made
// is what turns a designer back into a form.
{
  const cold = suggestions('en', ops, [0, 0], 'Twenty polos', 20);
  assert.equal(cold.length, 0, 'a brief with no signal must produce silence');

  const hot = suggestions('en', ops, [0, 0], HOT, 42);
  assert.ok(hot.some((s) => /performance/i.test(s.ask)), 'a heat brief must reach for the knit');

  const already = suggestions('en', ops, [2, 0], HOT, 42);
  assert.ok(!already.some((s) => /performance/i.test(s.ask)),
    'the knit must not be offered to a kit already wearing it');
}

// 2. The invariant the whole module rests on: a suggestion is a working ask.
// If one stops parsing -- a reworded string, a renamed grade -- it becomes a
// button that looks right and does nothing, which is the failure this file
// exists to catch.
for (const c of CONCEPTS) {
  for (const s of suggestions('en', c, [0, 0, 0], 'Hot site work on a tight budget', 30)) {
    const applied = refine(c, s.ask, [0, 0, 0], 'en');
    assert.ok(applied, `${c.id}: the suggestion "${s.ask}" no longer parses`);
    assert.equal(applied!.patch, s.patch, `${c.id}: "${s.ask}" promised a patch it does not apply`);
  }
}

// 3. Every ask in the catalogue means the same thing in both languages. The
// Arabic goes through toParserWords into English tokens, so a rewrite on
// either side can silently stop landing -- an Arabic button that renders
// perfectly and changes nothing is a bug this app has already shipped once.
for (const c of CONCEPTS) {
  for (const [key, en] of asks()) {
    const ar = (translations.ar.suggest as Record<string, string>)[key];
    const grades = c.garments.map(() => 0);
    assert.equal(
      refine(c, ar, grades, 'ar')?.patch ?? null,
      refine(c, en, grades, 'en')?.patch ?? null,
      `${c.id}: the Arabic "${key}" does not land the same patch as the English`,
    );
  }
}

// 4. The reason carries a real number, not a decorative one. The budget line
// claims a saving; the saving has to be the difference the quote will show.
{
  const dear = suggestions('en', ops, [2, 2], 'Tight budget for 40 staff', 42);
  const drop = dear.find((s) => /standard/i.test(s.ask));
  assert.ok(drop, 'a kit quoted above standard on a budget brief must offer the drop');
  const saving = conceptPriceAt(ops, [2, 2]) - conceptPriceAt(ops, [0, 0]);
  assert.match(drop!.why, new RegExp(String(saving)), 'the per-person saving must be the real delta');
  assert.match(drop!.why, new RegExp(String(saving * 42).replace(/\B(?=(\d{3})+$)/g, ',')),
    'the run total must be the delta across the sets');
}

// 5. The logo check. Gold on sand is two good colours that cannot be worn
// together, and no swatch picker shows you that -- it is the one thing here
// the buyer could not have seen for themselves.
{
  const sand = setLogo(setPart(ops, 0, 'body', '#d6c19c'), { colour: '#c8a24a' });
  assert.ok(contrast('#c8a24a', '#d6c19c') < 2.2, 'brass on sand must read as too close');
  const warned = suggestions('en', sand, [0, 0], 'Twenty polos', 20);
  assert.ok(warned.some((s) => /logo/i.test(s.ask)), 'an unreadable logo must be called out');

  // Navy body, white logo: the default, and it must never be nagged about.
  const fine = suggestions('en', ops, [0, 0], 'Twenty polos', 20);
  assert.ok(!fine.some((s) => /logo/i.test(s.ask)), 'a legible logo must draw no comment');

  // Nothing to be illegible against once the branding is off.
  const bare = setLogo(sand, { position: 'none' });
  assert.ok(!suggestions('en', bare, [0, 0], 'Twenty polos', 20).some((s) => /logo/i.test(s.ask)),
    'an unbranded kit has no logo to complain about');
}

// 6. A cloth the kit cannot take is not offered. Front Office is all woven,
// so the performance knit does not exist for it: refine says so politely and
// the gate drops the card rather than showing a button that apologises.
assert.ok(
  !suggestions('en', office, [0, 0, 0], HOT, 42).some((s) => /performance/i.test(s.ask)),
  'a woven kit must not be offered a knit it cannot be made in',
);

// 7. Two at most. The card earns its place by saying the thing worth saying.
for (const locale of ['en', 'ar'] as const) {
  const many = suggestions(locale, ops, [2, 2], 'Hot outdoor site work, formal, tight budget', 42);
  assert.ok(many.length <= 2, `${locale}: at most two proposals at a time`);
}

console.log('suggest: all assertions passed');
