// Run: npx tsx lib/manager.test.ts
// The account manager must only ever say things the data supports, and must
// never just read the control back to the user.
import assert from 'node:assert/strict';
import { readBrief, whyTheseKits, stepAdvice, greeting, quoteNote } from './manager';
import { CONCEPTS, selectConcepts } from './concepts';
import { setLogo, setPart, colourFingerprint } from './spec';

const hot = 'Summer polos for 40 site technicians in Cairo, navy';
const desk = 'Smart shirts for the front desk team';

// 1. Brief signals are read, not guessed.
assert.equal(readBrief(hot).heat, true);
assert.equal(readBrief(hot).outdoor, true);
assert.equal(readBrief(desk).formal, true);
assert.equal(readBrief(desk).heat, false);

// 2. The kit rationale cites the brief and names the cheapest option.
const why = whyTheseKits('en', hot, CONCEPTS.slice(0, 3));
assert.match(why, /breathable/, 'a hot brief should mention breathability');
assert.match(why, /EGP/, 'the rationale should quote a real price');

// 3. Advice changes with the choice -- it is not one canned string.
const c = CONCEPTS[0];
const fabricAdviceLow = stepAdvice('en', 0, c, 0, hot, 40, 0.05);
const fabricAdviceHigh = stepAdvice('en', 0, c, 2, hot, 40, 0.05);
assert.notEqual(fabricAdviceLow, fabricAdviceHigh, 'fabric advice must react to the choice');
assert.match(fabricAdviceLow, /performance knit/i, 'a hot brief should push the knit');

// 4. Branding advice reflects the actual logo state.
const noLogo = setLogo(c, { position: 'none' });
assert.match(stepAdvice('en', 2, noLogo, 0, hot, 40, 0.05), /stop reading as a uniform/);
assert.match(stepAdvice('en', 2, setLogo(c, { method: 'print' }), 0, hot, 40, 0.05), /Print/);
assert.match(stepAdvice('en', 2, setLogo(c, { method: 'embroidery' }), 0, hot, 40, 0.05), /Embroidery/);

// 5. Quantity advice states the real spare count.
assert.match(stepAdvice('en', 3, c, 0, hot, 40, 0.1), /4 spare sets/);
assert.match(stepAdvice('en', 3, c, 0, hot, 40, 0), /Exactly 40 sets/);

// 6. Colour advice flips on how light the body actually is.
const lightTop = setPart(c, 0, 'body', '#ffffff');
const darkTop = setPart(c, 0, 'body', '#12161f');
assert.notEqual(stepAdvice('en', 1, lightTop, 0, hot, 40, 0.05), stepAdvice('en', 1, darkTop, 0, hot, 40, 0.05));
assert.match(stepAdvice('en', 1, lightTop, 0, hot, 40, 0.05), /show marks/);

// 7. The greeting and the order note say what the session's order actually
// is -- and nothing about an order that does not exist.
import { placeOrder } from './order';
import { orderNote } from './manager';
assert.match(greeting('en', 'Ahmed', []), /Nothing needs you today/);
assert.doesNotMatch(greeting('en', 'Ahmed', []), /polos|8th/, 'no order, no order news');
const placed = placeOrder(c, 40, 42, [], 500, new Date('2026-09-02T10:00:00Z'));
const sewing = placeOrder(c, 40, 42, [], 500, new Date('2026-08-20T10:00:00Z'), 3);
assert.match(greeting('en', 'Ahmed', [placed]), /Front Office/, 'the greeting names the real order');
assert.match(greeting('en', 'Ahmed', [placed, sewing]), /1 in production/, 'the greeting counts states');
assert.match(orderNote('en', placed), /23 Sep/, 'the note states the real due date');
assert.match(orderNote('en', sewing), /Sewing/, 'the note says where a production order is');
assert.match(orderNote('en', { ...sewing, stage: 5 }), /Delivered/);

// 8. The quote note states the real spare count, not a hardcoded one.
assert.match(quoteNote('en', c, 40, 44), /40 people plus 4 spare/);
assert.match(quoteNote('en', c, 40, 40), /Covers 40 people\./);

// 8b. The note quotes the word the customer actually wrote. "Summer" is a
// fair reason to reach for a breathable weave, but reporting it as "you
// mentioned heat" is a claim they can check and find false.
assert.match(whyTheseKits('en', 'Summer polos, navy', CONCEPTS.slice(0, 3)), /“summer”/);
assert.doesNotMatch(whyTheseKits('en', 'Summer polos, navy', CONCEPTS.slice(0, 3)), /you mentioned heat/);
assert.match(whyTheseKits('en', 'Hot weather kit for drivers', CONCEPTS.slice(0, 3)), /“hot”/);

// 9. The brief's literal instructions are carried out, and only claimed when
// they are. This is the demo's whole credibility: quoting a brief back while
// ignoring it reads as fake.
// The seeds are module-level and every generate maps over them, so a mutating
// applyBrief would poison the second brief a presenter types. Fingerprint
// before, compare after -- reading the seed after the call proves nothing.
const seedsBefore = CONCEPTS.map(colourFingerprint);
const trouserBefore = CONCEPTS[3].garments[1].parts.leg;
const navy = selectConcepts({ industry: 'Summer polos for 40 technicians, navy, logo on the chest' });
assert.equal(navy[0].garments[0].parts.body, '#1b2a4a', 'a navy brief must produce a navy top');
assert.equal(navy[0].logo.position, 'left_chest', 'a chest brief must put the logo on the chest');
assert.deepEqual(CONCEPTS.map(colourFingerprint), seedsBefore, 'selectConcepts mutated the seeds');
assert.equal(navy[0].garments[1].parts.leg, trouserBefore,
  'the trouser keeps the seed colour -- the brief named a polo, not a suit');
// A brief naming a colour family is still a colour instruction.
assert.equal(selectConcepts({ industry: 'warehouse workwear, dark colours' })[0].garments[0].parts.body,
  '#12161f', '"dark colours" must reach the garments like any other colour word');
assert.match(whyTheseKits('en', 'Summer polos, navy, logo on the chest', navy), /navy.*chest/);
assert.doesNotMatch(whyTheseKits('en', desk, CONCEPTS.slice(0, 3)), /logo on the/,
  'a brief naming no colour or placement must not claim to have honoured one');

// The note quotes the word the customer actually wrote. "Summer" reported
// back as "you mentioned heat" is a claim they can check and find false.
assert.match(whyTheseKits('en', 'Summer polos, navy', CONCEPTS.slice(0, 3)), /“summer”/);
assert.doesNotMatch(whyTheseKits('en', 'Summer polos, navy', CONCEPTS.slice(0, 3)), /mentioned heat/);

console.log('manager: all assertions passed');

// 10. Every sentence the manager writes exists in both languages. These are
// generated at runtime, so a missing Arabic branch shows up as English text
// inside an RTL page -- the most visible way a translation ships broken.
import { type Locale } from './i18n';
const ARABIC_TEXT = /[؀-ۿ]/;
const hotAr = 'قمصان بولو صيفية لـ40 فني موقع، كحلي';
for (const [locale, brief] of [['en', hot], ['ar', hotAr]] as [Locale, string][]) {
  const check = (label: string, out: string) => {
    assert.ok(out.trim().length > 0, `${label} is empty in ${locale}`);
    if (locale === 'ar') assert.match(out, ARABIC_TEXT, `${label} is not Arabic: "${out}"`);
    else assert.doesNotMatch(out, ARABIC_TEXT, `${label} leaked Arabic into English`);
  };
  check('whyTheseKits', whyTheseKits(locale, brief, CONCEPTS.slice(0, 3)));
  for (let step = 0; step < 4; step++) {
    check(`stepAdvice(${step})`, stepAdvice(locale, step, c, 0, brief, 40, 0.05));
  }
  check('quoteNote', quoteNote(locale, c, 40, 44));
  check('greeting', greeting(locale, 'Ahmed', [placed]));
  check('greeting(none)', greeting(locale, 'Ahmed', []));
  check('orderNote', orderNote(locale, placed));
  check('orderNote(sewing)', orderNote(locale, sewing));
  check('orderNote(done)', orderNote(locale, { ...sewing, stage: 5 }));
}

// 11. The Arabic brief is read for the same signals as the English one --
// otherwise an Arabic customer gets generic advice while an English one gets
// advice tied to what they wrote.
assert.equal(readBrief(hotAr).heat, true, 'صيفية must read as heat');
assert.equal(readBrief(hotAr).outdoor, true, 'موقع must read as outdoor');
assert.equal(readBrief('قمصان رسمية لفريق الاستقبال').formal, true, 'رسمية must read as formal');
assert.equal(readBrief('ملابس عمل متينة للمستودع').durable, true, 'متينة must read as durable');
