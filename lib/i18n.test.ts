// Run: npx tsx lib/i18n.test.ts
// The rules that keep two languages honest: the dictionaries must agree on
// keys, Arabic must actually be Arabic, and the plural forms must be the
// ones Arabic really uses -- not English's two-way singular/plural.
import assert from 'node:assert/strict';
import {
  type Locale, LOCALES, t, dir, translations,
  formatCurrency, formatNumber, formatDate, spareMessage,
} from './i18n';

// 1. Direction. The whole RTL layer hangs off this one function.
assert.equal(dir('ar'), 'rtl');
assert.equal(dir('en'), 'ltr');
assert.deepEqual(LOCALES, ['en', 'ar']);

// 2. Every key in one dictionary exists in the other, with a real value.
// A missing Arabic key renders English inside an RTL page -- the single most
// visible way a translation ships broken.
const flatten = (o: object, prefix = ''): string[] =>
  Object.entries(o).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? flatten(v, `${prefix}${k}.`) : [`${prefix}${k}`]);
const enKeys = flatten(translations.en).sort();
const arKeys = flatten(translations.ar).sort();
assert.deepEqual(arKeys, enKeys, `keys differ: only in en = ${
  enKeys.filter((k) => !arKeys.includes(k))}; only in ar = ${
  arKeys.filter((k) => !enKeys.includes(k))}`);
assert.ok(enKeys.length > 80, `only ${enKeys.length} keys -- the inventory is not covered`);

// 3. No Arabic value is left as English or a TODO. Latin letters in an Arabic
// value mean a string was never translated -- except the product name.
const ARABIC = /[؀-ۿ]/;
for (const key of arKeys) {
  const v = t('ar', key);
  assert.ok(v.length > 0, `${key} is empty in Arabic`);
  assert.doesNotMatch(v, /TODO/i, `${key} is still a TODO`);
  const withoutBrand = v.replace(/UniformAI|EGP|BW|\{\w+\}|%|\d/g, '').trim();
  if (withoutBrand.length > 1) {
    assert.match(v, ARABIC, `${key} has no Arabic in it: "${v}"`);
  }
}

// 4. Interpolation, in both directions.
assert.match(t('en', 'quote.coversPeople', { people: 40, spare: 2 }), /40/);
assert.match(t('ar', 'quote.coversPeople', { people: 40, spare: 2 }), /40/);

// 5. A missing key returns the key rather than throwing or rendering blank.
assert.equal(t('en', 'nope.not.here'), 'nope.not.here');

// 6. Arabic plurals. Arabic has singular, dual and two plural forms -- the
// reason a naive `${n} sets` reads wrong to every Arabic speaker.
assert.match(spareMessage('ar', 1), /احتياطي واحد|طقم/);
assert.match(spareMessage('ar', 2), /طقمان|طقمين/, 'two takes the dual form');
assert.match(spareMessage('ar', 5), /أطقم/, '3-10 takes the plural');
assert.match(spareMessage('ar', 40), /طقم/, '11+ takes the accusative singular');
assert.notEqual(spareMessage('ar', 1), spareMessage('ar', 2));
assert.notEqual(spareMessage('ar', 2), spareMessage('ar', 5));
assert.match(spareMessage('en', 2), /2 spare/);

// 7. Money and numbers keep Western digits in both languages: Egyptian
// business software shows 28,896 and EGP, not ٢٨٬٨٩٦.
for (const l of LOCALES) {
  assert.match(formatCurrency(l as Locale, 28896), /28[,،]?896/, `${l} currency digits`);
  assert.match(formatCurrency(l as Locale, 28896), /EGP/, `${l} keeps the EGP code`);
  assert.doesNotMatch(formatNumber(l as Locale, 1234), /[٠-٩]/, `${l} must not use Arabic-Indic digits`);
}
assert.equal(formatCurrency('en', 688.4), 'EGP 688');

// 8. Dates are localised but stay readable.
const d = new Date(2026, 8, 19);
assert.match(formatDate('en', d), /Sep/);
assert.match(formatDate('ar', d), ARABIC);
assert.doesNotMatch(formatDate('ar', d), /[٠-٩]/, 'dates keep Western digits too');

console.log('i18n: all assertions passed');

// 9. Kit names are stored data used as display text. The id stays stable and
// the label translates, so an order placed in Arabic still reads correctly
// after a switch to English -- and vice versa.
import { kitName } from './i18n';
assert.equal(kitName('en', 'technicians'), 'Technicians');
assert.match(kitName('ar', 'technicians'), ARABIC);
// A saved copy carries a -v2 suffix; the base name still resolves.
assert.match(kitName('ar', 'technicians-v2'), /2/);
assert.match(kitName('ar', 'technicians-v2'), ARABIC);
// An unknown id falls back to itself rather than rendering blank.
assert.equal(kitName('ar', 'bespoke-thing'), 'bespoke-thing');
