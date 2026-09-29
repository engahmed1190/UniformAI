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
  type Turn, approveTurn, approvedTurn, caseTurn, failTurn, invoicesTurn, menuTurn, moreTurn,
  movedTurn, orderTurn, quoteShownTurn, refusedId, planTurn, quoteSentTurn, sizesSentTurn, teamTurn, waitingButtons, holdsWrite,
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
  // Greeting: up to two waiting items, then New and Contact, then Orders; More holds the rest.
  let turn = keep(menuTurn(locale, [order('quote_ready'), order('collecting_sizes')], 15));
  assert.deepEqual(turn.buttons.map((b) => b.act.k), ['approve', 'sizes', 'new', 'sendContact', 'more']);
  assert.deepEqual(primary(turn), { k: 'approve', quote: 'SAL-QTN-2026-00031', total: 27300 });
  const three = [order('quote_ready'), order('collecting_sizes'), order('quote_ready', { quote: 'SAL-QTN-2026-00032' })];
  turn = keep(menuTurn(locale, three, 15));
  assert.deepEqual(turn.buttons.map((b) => b.act.k), ['approve', 'sizes', 'new', 'sendContact', 'more']);
  turn = keep(moreTurn(locale, three));
  assert.deepEqual(turn.buttons.map((b) => b.act), [
    { k: 'approve', quote: 'SAL-QTN-2026-00032', total: 27300 }, { k: 'orders' }, { k: 'invoices' }, { k: 'more', from: 3 },
  ]);
  turn = keep(moreTurn(locale, three, 3));
  assert.deepEqual(turn.buttons.map((b) => b.act.k), ['stock', 'price']);
  turn = keep(menuTurn(locale, [], 9));
  assert.deepEqual(turn.buttons.map((b) => b.act.k), ['new', 'sendContact', 'orders', 'more']);
  assert.equal(primary(turn), undefined);
  assert.match(turn.say, locale === 'en' ? /^Good morning, Mr\. Ahmed\./ : /^صباح الخير أستاذ أحمد\./);
  turn = keep(menuTurn(locale, [order('collecting_sizes')], 15, true));
  assert.deepEqual(primary(turn), { k: 'sizes', order: 'SAL-ORD-2026-00011' });
  assert.equal(waitingButtons(locale, [order('awaiting'), order('in_progress')]).length, 0);
  keep(moreTurn(locale, []));

  // 1. Request -> quote -> approve.
  turn = keep(teamTurn(locale));
  assert.deepEqual(turn.buttons.map((b) => b.act), CONCEPTS.map((c) => ({ k: 'people', kit: c.id })).slice(0, 4));
  turn = keep(planTurn(locale, 'technicians', 40));
  assert.deepEqual(primary(turn), { k: 'requestQuote', kit: 'technicians', people: 40, sets: 42 });
  turn = keep(planTurn(locale, 'technicians', 6));
  assert.deepEqual(primary(turn), { k: 'requestQuote', kit: 'technicians', people: 6, sets: 10 });
  assert.deepEqual(turn.buttons.map((b) => b.act.k), ['requestQuote'], 'the people form requests in one tap');
  keep(quoteSentTurn(locale, order('quote_requested')));
  turn = keep(orderTurn(locale, order('quote_requested')));
  assert.ok(!turn.buttons.some((b) => b.act.k === 'approve'), 'a draft quote is never approvable');
  turn = keep(orderTurn(locale, order('quote_ready')));
  assert.deepEqual(turn.card?.k === 'order' && turn.card.view.action?.act, { k: 'approve', quote: 'SAL-QTN-2026-00031', total: 27300 });
  assert.deepEqual(turn.buttons.map((b) => b.act.k), ['viewQuote', 'sendContact']);
  // After the card: the review sentence and View are not repeated.
  turn = keep(quoteShownTurn(locale, order('quote_ready')));
  assert.ok(!turn.buttons.some((b) => b.act.k === 'viewQuote'));
  assert.notEqual(turn.say, orderTurn(locale, order('quote_ready')).say);
  assert.deepEqual(primary(turn), { k: 'approve', quote: 'SAL-QTN-2026-00031', total: 27300 });
  turn = keep(approveTurn(locale, 'SAL-QTN-2026-00031', 27300));
  assert.ok(turn.buttons.some((b) => b.act.k === 'viewQuote'), 'the greeting skips the quote turn, so View is here');
  assert.deepEqual(primary(turn), { k: 'approveNow', quote: 'SAL-QTN-2026-00031' });
  // A double tap on Approve must not land on the confirmation.
  const cardApprove = orderTurn(locale, order('quote_ready')).card;
  assert.notEqual(turn.buttons.find((b) => b.primary)?.label, cardApprove?.k === 'order' ? cardApprove.view.action?.label : '');
  assert.notEqual(turn.buttons.findIndex((b) => b.primary), 0, 'the confirmation is not where the greeting\'s Approve was');
  turn = keep(approvedTurn(locale, order('awaiting')));
  assert.ok(turn.say.includes('SAL-ORD-2026-00011'));

  // 2. The team confirms; the order advances.
  keep(orderTurn(locale, order('awaiting')));
  keep(orderTurn(locale, order('quote_closed')));

  // 3. Sizes.
  turn = keep(orderTurn(locale, order('collecting_sizes')));
  assert.deepEqual(turn.card?.k === 'order' && turn.card.view.action?.act, { k: 'sizes', order: 'SAL-ORD-2026-00011' });
  assert.equal(primary(turn), undefined, 'the card holds the one primary');
  keep(sizesSentTurn(locale, order('in_progress')));

  // 4. Delivery and invoices.
  keep(orderTurn(locale, order('in_progress')));
  keep(orderTurn(locale, order('in_progress', { perDelivered: 50 })));
  turn = keep(orderTurn(locale, order('delivered')));
  assert.ok(turn.buttons.some((b) => b.act.k === 'sendContact'));
  turn = keep(invoicesTurn(locale, invoices));
  assert.equal(turn.card?.k, 'invoices');
  assert.deepEqual(turn.card?.k === 'invoices' && turn.card.view.action?.act, { k: 'sendContact', topic: 'billing', doc: 'ACC-SINV-2026-00006' },
    'the case names the overdue invoice');
  turn = keep(invoicesTurn(locale, [invoices[2]]));
  assert.equal(turn.card?.k === 'invoices' && turn.card.view.action, undefined);
  assert.equal(invoicesTurn(locale, []).card, undefined);

  // 5. Contact our team: one tap sends, from the greeting and from Discuss.
  assert.deepEqual(menuTurn(locale, [], 15).buttons.find((b) => b.act.k === 'sendContact')?.act, { k: 'sendContact', topic: 'general' });
  assert.deepEqual(orderTurn(locale, order('awaiting')).buttons[0].act, { k: 'sendContact', topic: 'order', doc: 'SAL-ORD-2026-00011' });
  turn = keep(caseTurn(locale, 'CASE-2026-00008', 'ACC-SINV-2026-00006'));
  assert.ok(turn.say.includes('ACC-SINV-2026-00006') && turn.say.includes('CASE-2026-00008'));
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

// News waits behind a turn that holds a write; it may replace a plain turn.
for (const locale of LOCALES as readonly Locale[]) {
  assert.ok(holdsWrite(approveTurn(locale, 'Q', 27300).buttons));
  assert.ok(holdsWrite(failTurn(locale, { k: 'sendSizes', order: 'O', run: {} }).buttons), 'a size run to retry');
  assert.ok(holdsWrite(planTurn(locale, 'technicians', 40).buttons));
  // Contact sends on its first tap, with nothing typed: it may be replaced.
  assert.ok(!holdsWrite(menuTurn(locale, [], 15).buttons));
  assert.ok(!holdsWrite(menuTurn(locale, [order('quote_ready')], 15).buttons));
  assert.ok(!holdsWrite(orderTurn(locale, order('quote_ready')).buttons));
}

// English specifics a customer would read.
assert.match(approveTurn('en', 'Q', 27300).buttons[1].label, /^Yes, approve EGP.27,300$/);
assert.match(movedTurn('en', order('awaiting')).say, /^This has already moved on, so I have made no change\. Order SAL-ORD-2026-00011 is with our team;/);
assert.match(planTurn('en', 'technicians', 6).say, /minimum .* 10 sets/);
assert.equal(invoicesTurn('en', invoices).say, 'One invoice is past due. The rest are on time.');
assert.equal(invoicesTurn('en', [invoices[1]]).say, 'One invoice is past due.');
assert.equal(invoicesTurn('en', [invoices[0]]).say, 'All your open invoices are on time.');
assert.equal(invoicesTurn('en', [invoices[2]]).say, 'You have no unpaid invoices.');

// Every reply says who acts next and when.
const bill: Invoice = { name: 'ACC-SINV-2026-00010', date: '2026-09-29', due: '2026-10-29', total: 14345,
  outstanding: 14345, status: 'unpaid', order: 'SAL-ORD-2026-00011' };
assert.match(orderTurn('en', order('delivered'), [bill]).say,
  /Invoice ACC-SINV-2026-00010 for EGP.14,345 is attached to this delivery, due on 29 Oct\.$/);
assert.match(orderTurn('en', order('delivered')).say, /accounts team will send the invoice within one working day\.$/);
// A refused write on a delivered order names its invoice, like the card does.
{
  const moved = movedTurn('en', order('delivered'), [bill]);
  assert.ok(moved.say.includes('ACC-SINV-2026-00010'));
  assert.deepEqual(moved.card?.k === 'order' && moved.card.view.action?.act, { k: 'invoices' });
  all.push(moved);
}
for (const state of ['quote_requested', 'quote_ready', 'awaiting'] as Workflow[]) {
  assert.match(orderTurn('en', order(state)).say, /within one working day/, state);
}
assert.match(orderTurn('en', order('collecting_sizes')).say, /next step is yours/);
assert.match(orderTurn('en', order('in_progress')).say, /Nothing else is needed from you\.$/);
assert.match(quoteSentTurn('en', order('quote_requested')).say, /within one working day.*approve\.$/);
assert.match(approvedTurn('en', order('awaiting')).say, /within one working day, and then I will ask you for the sizes\.$/);
assert.match(sizesSentTurn('en', order('in_progress')).say, /Production starts now; expected delivery .+\. Nothing else is needed from you\.$/);
assert.match(caseTurn('en', 'CASE-2026-00007').say, /within one working day\.$/);
// Arabic counts and wording from the audit.
assert.ok(planTurn('ar', 'technicians', 18).say.includes('لفريق من 18 موظفًا'));
assert.ok(planTurn('ar', 'technicians', 18).say.includes('19 طقمًا'));
assert.ok(!planTurn('ar', 'technicians', 18).say.includes('من الأطقم'));
assert.ok(caseTurn('ar', 'CASE-2026-00007').say.includes('أحلت طلب التواصل'));

// The voice rules, over every turn above.
for (const turn of all) {
  assert.ok(turn.buttons.filter((b) => b.act.k !== 'more').length <= 4, `too many buttons: ${turn.say}`);
  assert.ok(turn.buttons.filter((b) => b.primary).length <= 1, `two primaries: ${turn.say}`);
  const card = turn.card?.k === 'order'
    ? [turn.card.view.title, turn.card.view.meta, turn.card.view.next, turn.card.view.date ?? 'x', turn.card.view.action?.label ?? 'x']
    : turn.card ? [turn.card.view.outstanding, turn.card.view.open, turn.card.view.paid ?? 'x', turn.card.view.action?.label ?? 'x',
      ...turn.card.view.rows.flatMap((r) => [r.label, r.note])] : [];
  for (const text of [turn.say, ...turn.buttons.map((b) => b.label), ...card]) {
    assert.ok(text.trim(), 'empty text');
    assert.doesNotMatch(text, /ERPNext|UA-|https?:|journey\.|\{\w+\}|Draft|To Deliver|Based on \d+ records?|Records checked|found in|Checked at/, text);
  }
}

console.log('journey: all assertions passed');
