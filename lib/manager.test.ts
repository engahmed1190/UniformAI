// Run: npx tsx lib/manager.test.ts
// The account manager must only ever say things the data supports, and must
// never just read the control back to the user.
import assert from 'node:assert/strict';
import { readBrief, whyTheseKits, stepAdvice, greeting, quoteNote } from './manager';
import { CONCEPTS, selectConcepts } from './concepts';
import { setLogo, setPart } from './spec';

const hot = 'Summer polos for 40 site technicians in Cairo, navy';
const desk = 'Smart shirts for the front desk team';

// 1. Brief signals are read, not guessed.
assert.equal(readBrief(hot).heat, true);
assert.equal(readBrief(hot).outdoor, true);
assert.equal(readBrief(desk).formal, true);
assert.equal(readBrief(desk).heat, false);

// 2. The kit rationale cites the brief and names the cheapest option.
const why = whyTheseKits(hot, CONCEPTS.slice(0, 3));
assert.match(why, /breathable/, 'a hot brief should mention breathability');
assert.match(why, /EGP/, 'the rationale should quote a real price');

// 3. Advice changes with the choice -- it is not one canned string.
const c = CONCEPTS[0];
const fabricAdviceLow = stepAdvice(0, c, 0, hot, 40, 0.05);
const fabricAdviceHigh = stepAdvice(0, c, 2, hot, 40, 0.05);
assert.notEqual(fabricAdviceLow, fabricAdviceHigh, 'fabric advice must react to the choice');
assert.match(fabricAdviceLow, /performance knit/i, 'a hot brief should push the knit');

// 4. Branding advice reflects the actual logo state.
const noLogo = setLogo(c, { position: 'none' });
assert.match(stepAdvice(2, noLogo, 0, hot, 40, 0.05), /No branding/);
assert.match(stepAdvice(2, setLogo(c, { method: 'print' }), 0, hot, 40, 0.05), /Print/);
assert.match(stepAdvice(2, setLogo(c, { method: 'embroidery' }), 0, hot, 40, 0.05), /Embroidery/);

// 5. Quantity advice states the real spare count.
assert.match(stepAdvice(3, c, 0, hot, 40, 0.1), /4 spare sets/);
assert.match(stepAdvice(3, c, 0, hot, 40, 0), /Exactly 40 sets/);

// 6. Colour advice flips on how light the body actually is.
const lightTop = setPart(c, 0, 'body', '#ffffff');
const darkTop = setPart(c, 0, 'body', '#12161f');
assert.notEqual(stepAdvice(1, lightTop, 0, hot, 40, 0.05), stepAdvice(1, darkTop, 0, hot, 40, 0.05));
assert.match(stepAdvice(1, lightTop, 0, hot, 40, 0.05), /show marks/);

// 7. The greeting reflects whether anything is waiting.
assert.match(greeting('Ahmed', 0), /Nothing needs you today/);
assert.match(greeting('Ahmed', 2), /2 quotes need your approval/);

// 8. The quote note states the real spare count, not a hardcoded one.
assert.match(quoteNote(c, 40, 44), /40 people with 4 spare sets/);
assert.match(quoteNote(c, 40, 40), /covers 40 people\./);

// 9. The brief's literal instructions are carried out, and only claimed when
// they are. This is the demo's whole credibility: quoting a brief back while
// ignoring it reads as fake.
const navy = selectConcepts({ industry: 'Summer polos for 40 technicians, navy, logo on the chest' });
assert.equal(navy[0].garments[0].parts.body, '#1b2a4a', 'a navy brief must produce a navy top');
assert.equal(navy[0].logo.position, 'left_chest', 'a chest brief must put the logo on the chest');
assert.equal(navy[0].garments[1].parts.leg, CONCEPTS[3].garments[1].parts.leg,
  'the trouser keeps the seed colour -- the brief named a polo, not a suit');
assert.match(whyTheseKits('Summer polos, navy, logo on the chest', navy), /navy.*chest/);
assert.doesNotMatch(whyTheseKits(desk, CONCEPTS.slice(0, 3)), /as you asked/,
  'a brief naming no colour or placement must not claim to have honoured one');

console.log('manager: all assertions passed');
