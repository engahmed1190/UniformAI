// lib/journey.test.ts
// Run: npx tsx lib/journey.test.ts
// One happy path per journey, in both languages, plus the voice rules every
// turn must keep: at most four buttons, no system words, no missing keys.
import assert from 'node:assert/strict';
import { CONCEPTS } from './concepts';
import { sampleOrder } from './order-fixture';
import type { Order, Workflow } from './order';
import type { Invoice } from './invoices';
import { LOCALES, type Locale } from './i18n';
import {
  type Turn, approveTurn, approvedTurn, caseTurn, contactTurn, failTurn, invoicesTurn, menuTurn, moreTurn,
  movedTurn, orderTurn, refusedId, planTurn, quoteSentTurn, sizeConfirmTurn, sizesSentTurn, teamTurn,
} from './journey';

const QUOTE_STATES: Workflow[] = ['quote_requested', 'quote_ready', 'quote_closed'];
const order = (state: Workflow, over: Partial<Order> = {}): Order => ({
  ...sampleOrder(CONCEPTS[0], 40, 42, [], 650, new Date('2026-09-20T10:00:00'), state),
  quote: 'SAL-QTN-2026-00031',
  salesOrder: QUOTE_STATES.includes(state) ? undefined : 'SAL-ORD-2026-00011',
  ...over,
});
const invoices: Invoice[] = [
  { name: 'ACC-SINV-2026-00007', date: '2026-09-23', due: '2026-10-23', total: 8000, outstanding: 8000, status: 'unpaid' },
  { name: 'ACC-SINV-2026-00006', date: '2026-08-27', due: '2026-09-26', total: 9000, outstanding: 9000, status: 'overdue' },
  { name: 'ACC-SINV-2026-00005', date: '2026-07-30', due: '2026-08-29', total: 5000, outstanding: 0, status: 'paid' },
];

const all: Turn[] = [];
const keep = (turn: Turn) => { all.push(turn); return turn; };
const primary = (turn: Turn) => turn.buttons.find((b) => b.primary)?.act;

for (const locale of LOCALES as readonly Locale[]) {
  // Menu: the newest waiting action leads (orders arrive newest first).
  let turn = keep(menuTurn(locale, [order('quote_ready'), order('collecting_sizes')]));
  assert.deepEqual(primary(turn), { k: 'order', id: 'SAL-QTN-2026-00031' });
  turn = keep(menuTurn(locale, [order('collecting_sizes'), order('quote_ready')]));
  assert.deepEqual(primary(turn), { k: 'sizes', order: 'SAL-ORD-2026-00011' });
  assert.ok(turn.buttons.some((b) => b.act.k === 'more'));
  turn = keep(menuTurn(locale, [order('collecting_sizes')], true));
  assert.deepEqual(primary(turn), { k: 'sizes', order: 'SAL-ORD-2026-00011' });
  keep(moreTurn(locale));

  // 1. Request -> quote -> approve.
  turn = keep(teamTurn(locale));
  assert.deepEqual(turn.buttons.map((b) => b.act), CONCEPTS.map((c) => ({ k: 'people', kit: c.id })).slice(0, 4));
  turn = keep(planTurn(locale, 'technicians', 40));
  assert.deepEqual(primary(turn), { k: 'requestQuote', kit: 'technicians', people: 40, sets: 42 });
  turn = keep(planTurn(locale, 'technicians', 6));
  assert.deepEqual(primary(turn), { k: 'requestQuote', kit: 'technicians', people: 6, sets: 10 });
  keep(quoteSentTurn(locale, order('quote_requested')));
  turn = keep(orderTurn(locale, order('quote_requested')));
  assert.ok(!turn.buttons.some((b) => b.act.k === 'approve'), 'a draft quote is never approvable');
  turn = keep(orderTurn(locale, order('quote_ready')));
  assert.deepEqual(primary(turn), { k: 'approve', quote: 'SAL-QTN-2026-00031', total: 27300 });
  assert.ok(turn.buttons.some((b) => b.act.k === 'viewQuote'));
  turn = keep(approveTurn(locale, 'SAL-QTN-2026-00031', 27300));
  assert.deepEqual(primary(turn), { k: 'approveNow', quote: 'SAL-QTN-2026-00031' });
  // A double tap on Approve must not land on the confirmation.
  const first = orderTurn(locale, order('quote_ready')).buttons.findIndex((b) => b.primary);
  const confirm = turn.buttons.findIndex((b) => b.primary);
  assert.notEqual(confirm, first, 'the confirmation sits where Approve was');
  assert.notEqual(turn.buttons[confirm].label, orderTurn(locale, order('quote_ready')).buttons[first].label);
  turn = keep(approvedTurn(locale, order('awaiting')));
  assert.ok(turn.say.includes('SAL-ORD-2026-00011'));

  // 2. The team confirms; the order advances.
  keep(orderTurn(locale, order('awaiting')));
  keep(orderTurn(locale, order('quote_closed')));

  // 3. Sizes.
  turn = keep(orderTurn(locale, order('collecting_sizes')));
  assert.deepEqual(primary(turn), { k: 'sizes', order: 'SAL-ORD-2026-00011' });
  const run = { men: { M: 21 }, women: { S: 21 } };
  turn = keep(sizeConfirmTurn(locale, order('collecting_sizes'), run));
  assert.deepEqual(primary(turn), { k: 'sendSizes', order: 'SAL-ORD-2026-00011', run });
  // Adjust keeps what was entered.
  assert.deepEqual(turn.buttons.find((b) => b.act.k === 'sizes')?.act, { k: 'sizes', order: 'SAL-ORD-2026-00011', run });
  keep(sizesSentTurn(locale, order('in_progress')));

  // 4. Delivery and invoices.
  keep(orderTurn(locale, order('in_progress')));
  keep(orderTurn(locale, order('in_progress', { perDelivered: 50 })));
  turn = keep(orderTurn(locale, order('delivered')));
  assert.ok(turn.buttons.some((b) => b.act.k === 'invoices'));
  turn = keep(invoicesTurn(locale, invoices));
  assert.ok(turn.say.includes('ACC-SINV-2026-00007'));
  keep(invoicesTurn(locale, [invoices[2]]));

  // 5. Contact our team.
  turn = keep(contactTurn(locale, 'order', 'SAL-ORD-2026-00011'));
  assert.deepEqual(primary(turn), { k: 'sendContact', topic: 'order', doc: 'SAL-ORD-2026-00011' });
  keep(contactTurn(locale, 'general'));
  turn = keep(caseTurn(locale, 'CASE-2026-00007'));
  assert.ok(turn.say.includes('CASE-2026-00007'));
  keep(failTurn(locale, { k: 'menu' }));

  // A refused write says nothing changed and where things stand, with no Try again.
  turn = keep(movedTurn(locale, order('in_progress')));
  assert.ok(turn.say.includes('SAL-ORD-2026-00011'));
  assert.ok(!turn.buttons.some((b) => b.act.k === 'sendSizes' || b.act.k === 'approveNow'));
  turn = keep(movedTurn(locale));
  assert.deepEqual(turn.buttons.map((b) => b.act), [{ k: 'orders' }]);
}

assert.equal(refusedId({ k: 'approveNow', quote: 'Q1' }), 'Q1');
assert.equal(refusedId({ k: 'sendSizes', order: 'O1', run: {} }), 'O1');
assert.equal(refusedId({ k: 'viewQuote', quote: 'Q2' }), 'Q2');
assert.equal(refusedId({ k: 'menu' }), undefined);

// English specifics a customer would read.
assert.match(approveTurn('en', 'Q', 27300).buttons[1].label, /^Yes, approve EGP.27,300$/);
assert.match(movedTurn('en', order('awaiting')).say, /^This has already moved on, so I have made no change\. I have received/);
assert.match(planTurn('en', 'technicians', 6).say, /minimum .* 10 sets/);
assert.match(invoicesTurn('en', invoices).say, /not yet paid.*Open invoices: 2.*Past due: 1/);
assert.equal(invoicesTurn('en', [invoices[2]]).say, 'Your latest invoice, ACC-SINV-2026-00005, is paid. You have no unpaid invoices.');

// The voice rules, over every turn above.
for (const turn of all) {
  assert.ok(turn.buttons.length <= 4, `too many buttons: ${turn.say}`);
  assert.ok(turn.buttons.filter((b) => b.primary).length <= 1, `two primaries: ${turn.say}`);
  for (const text of [turn.say, ...turn.buttons.map((b) => b.label)]) {
    assert.ok(text.trim(), 'empty text');
    assert.doesNotMatch(text, /ERPNext|UA-|https?:|journey\.|\{\w+\}|Draft|To Deliver/, text);
  }
}

console.log('journey: all assertions passed');
