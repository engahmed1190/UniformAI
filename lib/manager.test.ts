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

// The parser normalises an Arabic colour to an English token internally.
// The manager must translate it back before quoting the brief to the buyer.
const arWhy = whyTheseKits('ar', 'زي صيفي كحلي لفريق الموقع', CONCEPTS.slice(0, 3));
assert.match(arWhy, /كحلي/, 'the rationale should quote the colour in Arabic');
assert.doesNotMatch(arWhy, /navy/i, 'an internal colour token must not leak into Arabic');

// 3. Advice changes with the choice -- it is not one canned string.
const c = CONCEPTS[0];
const fabricAdviceLow = stepAdvice('en', 1, c, 0, hot, 40, 0.05);
const fabricAdviceHigh = stepAdvice('en', 1, c, 2, hot, 40, 0.05);
assert.notEqual(fabricAdviceLow, fabricAdviceHigh, 'fabric advice must react to the choice');
assert.match(fabricAdviceLow, /performance knit/i, 'a hot brief should push the knit');

// 4. Branding advice reflects the actual logo state.
const noLogo = setLogo(c, { position: 'none' });
assert.match(stepAdvice('en', 3, noLogo, 0, hot, 40, 0.05), /stop reading as a uniform/);
assert.match(stepAdvice('en', 3, setLogo(c, { method: 'print' }), 0, hot, 40, 0.05), /Print/);
assert.match(stepAdvice('en', 3, setLogo(c, { method: 'embroidery' }), 0, hot, 40, 0.05), /Embroidery/);

// 5. Quantity advice states the real spare count.
assert.match(stepAdvice('en', 4, c, 0, hot, 40, 0.1), /4 spare sets/);
assert.match(stepAdvice('en', 4, c, 0, hot, 40, 0), /Exactly 40 sets/);

// 5b. The sizes step advises on the choice that carries a consequence:
// committing the run now, or the spare stock that covers guessing later.
assert.match(stepAdvice('en', 4, c, 0, hot, 40, 0.1, 'allocate_now'), /locks the run/);
assert.match(stepAdvice('en', 4, c, 0, hot, 40, 0.1, 'collect_later'), /4 spare sets/);

// 5c. Fit advice only speaks when the cloth has nothing pointed left to say,
// so a hot brief still gets the knit rather than a note about the cut.
// The yard brief is deliberately heat-free: `hot` reads durable AND outdoor,
// so it can never prove the cut branch fires on its own.
const yard = 'Hard-wearing warehouse workwear for 40 store staff, dark colours';
assert.equal(readBrief(yard).heat, false, 'the yard brief must not read as heat');
assert.match(stepAdvice('en', 1, c, 0, yard, 40, 0.05), /bend and reach/,
  'a durable brief should push the relaxed cut');
assert.match(stepAdvice('en', 1, c, 0, desk, 40, 0.05), /front of house/,
  'a formal brief should push the slim cut');
assert.match(stepAdvice('en', 1, c, 0, hot, 40, 0.05), /performance knit/i,
  'heat outranks the cut -- one reason per note');
// A cut already right for the brief has nothing to say; the cloth line returns.
const relaxed = { ...c, garments: c.garments.map((g, i) => (i === 0 ? { ...g, fit: 'relaxed' as const } : g)) };
assert.match(stepAdvice('en', 1, relaxed, 0, yard, 40, 0.05), /standard grade/,
  'no advice to change a cut that is already relaxed');

// 6. Colour advice flips on how light the body actually is.
const lightTop = setPart(c, 0, 'body', '#ffffff');
const darkTop = setPart(c, 0, 'body', '#12161f');
assert.notEqual(stepAdvice('en', 2, lightTop, 0, hot, 40, 0.05), stepAdvice('en', 2, darkTop, 0, hot, 40, 0.05));
assert.match(stepAdvice('en', 2, lightTop, 0, hot, 40, 0.05), /show marks/);

// 7. The greeting and the order note say what the session's order actually
// is -- and nothing about an order that does not exist.
import { sampleOrder as placeOrder } from './order-fixture';
import { orderNote } from './manager';
assert.match(greeting('en', []), /Nothing needs your attention today/);
// The professional voice the assistant uses, in both languages.
assert.match(greeting('en', []), /^Good (morning|afternoon|evening), Mr\. Ahmed\./);
assert.match(greeting('ar', []), /^(صباح|مساء) الخير أستاذ أحمد\./);
assert.doesNotMatch(greeting('ar', []), /Ahmed| يا /);
assert.doesNotMatch(greeting('en', []), /polos|8th/, 'no order, no order news');
const placed = placeOrder(c, 40, 42, [], 500, new Date('2026-09-02T10:00:00Z'));
const sewing = placeOrder(c, 40, 42, [], 500, new Date('2026-08-20T10:00:00Z'), 'in_progress');
assert.match(greeting('en', [placed]), /Front Office/, 'the greeting names the real order');
assert.match(greeting('en', [placed, sewing]), /1 in production/, 'the greeting counts states');
// Home's cards count from the same groups, so sizes are never "in production".
import { GROUPS } from './manager';
assert.match(greeting('en', [placed, sewing]), /1 waiting on sizes, 1 in production/);
assert.deepEqual(Object.values(GROUPS).flat().sort(),
  ['awaiting', 'collecting_sizes', 'in_progress', 'quote_ready', 'quote_requested'], 'every open state in one group');
assert.ok(!(GROUPS.makingNow as readonly string[]).includes('collecting_sizes'));
assert.match(orderNote('en', placed), /23 Sep/, 'the note states the real due date');
assert.match(orderNote('en', sewing), /In production/, 'the note says where a production order is');
assert.match(orderNote('en', { ...sewing, state: 'delivered' as const }), /Delivered/);

const arrived = { ...sewing, state: 'delivered' as const, due: new Date('2026-10-20T10:00:00'),
  dates: { ...sewing.dates, delivered: new Date('2026-10-14T10:00:00') } };
assert.match(orderNote('en', arrived), /14 Oct/, 'a delivered order states the day it arrived');
assert.doesNotMatch(orderNote('en', arrived), /20 Oct/, 'not the planned day');

// 7b. Every workflow state has its own note; quote_closed and delivered are not open.
const ready = { ...placed, state: 'quote_ready' as const, total: 21000 };
assert.match(orderNote('en', ready), /21,000/, 'quote ready names the quoted total');
assert.match(orderNote('en', ready), /approve/i, 'quote ready asks for approval');
assert.match(orderNote('en', { ...placed, state: 'awaiting' as const }), /UniformAI is confirming/);
assert.match(orderNote('en', { ...placed, state: 'quote_requested' as const }), /pricing/);
assert.match(orderNote('en', { ...placed, state: 'quote_closed' as const }), /closed/);
assert.match(orderNote('en', { ...sewing, perDelivered: 60 }), /60% delivered/);
for (const st of ['quote_requested', 'quote_ready', 'quote_closed', 'awaiting'] as const) {
  assert.doesNotMatch(orderNote('en', { ...placed, state: st }), /collecting sizes/i, `${st} is not the sizes note`);
}
assert.match(greeting('en', [ready]), /quote/i, 'a ready quote leads the greeting');
assert.match(greeting('en', [ready]), /approv/i);
assert.doesNotMatch(greeting('en', [ready]), /sizes/);
const closed = { ...placed, state: 'quote_closed' as const };
assert.match(greeting('en', [closed, { ...placed, state: 'delivered' as const }]), /Nothing needs your attention/,
  'closed and delivered orders need nobody');
assert.match(greeting('en', [ready, placed]), /1 waiting for your approval/);
for (const locale of ['en', 'ar'] as const) {
  for (const st of ['quote_requested', 'quote_ready', 'quote_closed', 'awaiting', 'collecting_sizes', 'in_progress', 'delivered'] as const) {
    const o = { ...placed, state: st };
    for (const out of [orderNote(locale, o), greeting(locale, [o])]) {
      assert.doesNotMatch(out, /ERP|manager\.|orders\./, `${st}/${locale} leaked a key or ERP: ${out}`);
      if (locale === 'ar') assert.match(out, /[\u0600-\u06FF]/);
    }
  }
}

// 8. The quote note states the real spare count, not a hardcoded one.
assert.match(quoteNote('en', c, 40, 44), /40 people plus 4 spare/);
assert.match(quoteNote('en', c, 40, 40), /Covers 40 people\./);
assert.match(quoteNote('en', c, 40, 44, true), /every size assigned/);

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
import { type Locale, countOf } from './i18n';
const ARABIC_TEXT = /[؀-ۿ]/;
const hotAr = 'قمصان بولو صيفية لـ40 فني موقع، كحلي';
for (const [locale, brief] of [['en', hot], ['ar', hotAr]] as [Locale, string][]) {
  const check = (label: string, out: string) => {
    assert.ok(out.trim().length > 0, `${label} is empty in ${locale}`);
    if (locale === 'ar') assert.match(out, ARABIC_TEXT, `${label} is not Arabic: "${out}"`);
    else assert.doesNotMatch(out, ARABIC_TEXT, `${label} leaked Arabic into English`);
  };
  check('whyTheseKits', whyTheseKits(locale, brief, CONCEPTS.slice(0, 3)));
  for (let step = 0; step < 5; step++) {
    check(`stepAdvice(${step})`, stepAdvice(locale, step, c, 0, brief, 40, 0.05));
  }
  check('quoteNote', quoteNote(locale, c, 40, 44));
  check('greeting', greeting(locale, [placed]));
  check('greeting(none)', greeting(locale, []));
  check('orderNote', orderNote(locale, placed));
  check('orderNote(sewing)', orderNote(locale, sewing));
  check('orderNote(done)', orderNote(locale, { ...sewing, state: 'delivered' as const }));
}

// 11. The Arabic brief is read for the same signals as the English one --
// otherwise an Arabic customer gets generic advice while an English one gets
// advice tied to what they wrote.
assert.equal(readBrief(hotAr).heat, true, 'صيفية must read as heat');
assert.equal(readBrief(hotAr).outdoor, true, 'موقع must read as outdoor');
assert.equal(readBrief('قمصان رسمية لفريق الاستقبال').formal, true, 'رسمية must read as formal');
assert.equal(readBrief('ملابس عمل متينة للمستودع').durable, true, 'متينة must read as durable');

// 12. The note quotes the customer's own word, whichever script they wrote
// it in. The heat pattern captured only its English alternative, so an
// Arabic brief was told 'ذكرت «heat»' -- a word the customer never typed.
assert.match(whyTheseKits('ar', 'قمصان بولو صيفية لفريق الموقع', CONCEPTS.slice(0, 3)), /«صيفية»|«صيف»/,
  'an Arabic brief must be quoted in Arabic');
assert.doesNotMatch(whyTheseKits('ar', 'قمصان بولو صيفية لفريق الموقع', CONCEPTS.slice(0, 3)), /heat|summer/,
  'no English word may be quoted back at an Arabic customer');
assert.match(whyTheseKits('en', 'Summer polos', CONCEPTS.slice(0, 3)), /“summer”/);

// The Arabic greeting counts the noun and reads as a sentence: "طلب واحد"
// not "طلبات: 1", and UniformAI says "our team", not its own name.
const quoted = { ...placed, state: 'quote_ready' as const };
const pricing = { ...placed, state: 'quote_requested' as const };
const arMany = greeting('ar', [quoted, pricing, { ...pricing }, placed, sewing], 15);
assert.equal(arMany, 'مساء الخير أستاذ أحمد. لديكم الآن طلب واحد بانتظار موافقتكم، وطلبان لدى فريقنا، وطلب واحد بانتظار المقاسات، وطلب واحد قيد الإنتاج.');
assert.equal(countOf('ar', 'order', 3), '3 طلبات');
assert.equal(countOf('ar', 'order', 11), '11 طلبًا');
