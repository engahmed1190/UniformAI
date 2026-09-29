// Run: npx tsx lib/cards.test.ts
import assert from 'node:assert/strict';
import { CONCEPTS } from './concepts';
import { sampleOrder } from './order-fixture';
import type { Order, Workflow } from './order';
import type { Invoice } from './invoices';
import { LOCALES } from './i18n';
import { type Actor, type CardStepKey, billingDoc, invoicesCard, orderCard } from './cards';

const QUOTE_STATES: Workflow[] = ['quote_requested', 'quote_ready', 'quote_closed'];
const order = (state: Workflow): Order => ({
  ...sampleOrder(CONCEPTS[0], 40, 42, [], 650, new Date('2026-09-20T10:00:00'), state),
  quote: 'SAL-QTN-2026-00031',
  salesOrder: QUOTE_STATES.includes(state) ? undefined : 'SAL-ORD-2026-00011',
});
const bill = (over: Partial<Invoice> = {}): Invoice => ({
  name: 'ACC-SINV-2026-00010', date: '2026-09-29', due: '2026-10-29', total: 14345, outstanding: 14345,
  status: 'unpaid', order: 'SAL-ORD-2026-00011', ...over,
});
const bar = (o: Order, inv: Invoice[] = []) => orderCard('en', o, inv).steps.map((s) => s.state[0]).join('');

// The bar: done / now / todo, from the workflow.
assert.equal(bar(order('quote_requested')), 'ntttttt');
assert.equal(bar(order('quote_ready')), 'dnttttt');
assert.equal(bar(order('awaiting')), 'ddntttt');
assert.equal(bar(order('collecting_sizes')), 'dddnttt');
assert.equal(bar(order('in_progress')), 'ddddntt');
assert.equal(bar(order('delivered')), 'ddddddn');
assert.equal(bar(order('delivered'), [bill()]), 'ddddddd');
assert.equal(bar(order('quote_closed')), 'dtttttt');

// Who acts next, the key date, and one action.
let v = orderCard('en', order('quote_ready'), []);
assert.equal(v.next, 'Waiting on you');
assert.deepEqual(v.action?.act, { k: 'approve', quote: 'SAL-QTN-2026-00031', total: 27300 });
assert.equal(v.date, undefined);
assert.equal(v.id, 'SAL-QTN-2026-00031');
assert.match(v.meta, /^42 sets · EGP.27,300$/);
v = orderCard('en', order('awaiting'), []);
assert.match(v.next, /^With our team/);
assert.match(v.date ?? '', /^Expected delivery /);
assert.equal(v.action, undefined);
assert.equal(v.nowLabel, 'Confirmation by our team');
v = orderCard('en', order('collecting_sizes'), []);
assert.deepEqual(v.action?.act, { k: 'sizes', order: 'SAL-ORD-2026-00011' });
assert.equal(v.nowLabel, 'Your sizes');
v = orderCard('en', order('delivered'), [bill()]);
assert.equal(v.next, 'Complete');
assert.match(v.date ?? '', /^Delivered /);
assert.deepEqual(v.action?.act, { k: 'invoices' });
assert.equal(orderCard('en', order('delivered'), [bill({ order: 'SAL-ORD-2026-99999' })]).action, undefined, 'another order\'s invoice');
assert.equal(orderCard('en', order('quote_closed'), []).next, 'Closed');
for (const locale of LOCALES) {
  for (const s of ['quote_requested', 'quote_ready', 'awaiting', 'collecting_sizes', 'in_progress', 'delivered'] as Workflow[]) {
    const view = orderCard(locale, order(s), [bill()]);
    assert.equal(view.steps.length, 7);
    for (const text of [view.title, view.meta, view.next, view.progress ?? 'x', ...view.steps.map((x) => x.label)]) {
      assert.doesNotMatch(text, /journey\.|orders\.|\{\w+\}|ERPNext|UA-/, text);
    }
  }
}

// Every state: the current step is named as awaited, its owner is the one
// the "next" line names, and only the customer's steps carry a primary.
type Want = { now?: CardStepKey; actor?: Actor; act?: string; next: RegExp; progress?: string };
const WANT: [string, Order, Invoice[], Want][] = [
  ['quote_requested', order('quote_requested'), [], { now: 'quote', actor: 'team', next: /^With our team · usually within one working day$/, progress: 'Step 1 of 7 · Pricing by our team' }],
  ['quote_ready', order('quote_ready'), [], { now: 'approved', actor: 'you', act: 'approve', next: /^Waiting on you$/, progress: 'Step 2 of 7 · Your approval' }],
  ['awaiting', order('awaiting'), [], { now: 'confirmed', actor: 'team', next: /^With our team · usually within one working day$/, progress: 'Step 3 of 7 · Confirmation by our team' }],
  ['collecting_sizes', order('collecting_sizes'), [], { now: 'sizes', actor: 'you', act: 'sizes', next: /^Waiting on you$/, progress: 'Step 4 of 7 · Your sizes' }],
  ['in_progress', order('in_progress'), [], { now: 'production', actor: 'team', next: /^With our team$/, progress: 'Step 5 of 7 · In production' }],
  ['delivered, not yet invoiced', order('delivered'), [], { now: 'invoiced', actor: 'team', next: /^With our team · usually within one working day$/, progress: 'Step 7 of 7 · Invoice' }],
  ['delivered and invoiced', order('delivered'), [bill()], { act: 'invoices', next: /^Complete$/ }],
  ['quote_closed', order('quote_closed'), [], { next: /^Closed$/ }],
];
for (const [name, o, inv, want] of WANT) {
  const view = orderCard('en', o, inv);
  const now = view.steps.find((x) => x.state === 'now');
  assert.equal(now?.key, want.now, name);
  assert.equal(view.actor, want.actor, name);
  assert.equal(view.action?.act.k, want.act, name);
  assert.match(view.next, want.next, name);
  assert.equal(view.progress, want.progress, name);
  // A primary only where the customer acts (or to see the finished order's invoice).
  assert.equal(!!view.action, view.actor === 'you' || (!now && !!inv.length), name);
  // Done steps read as done; the current and later ones never do.
  for (const step of view.steps) {
    const past = ['Quote issued', 'Approved by you', 'Order confirmed', 'Sizes received', 'Produced', 'Delivered', 'Invoiced'];
    assert.equal(past.includes(step.label), step.state === 'done', `${name}: ${step.label}`);
  }
  // Arabic names the same step in the progress line.
  const ar = orderCard('ar', o, inv);
  assert.equal(ar.actor, want.actor, name);
  if (ar.progress) assert.ok(ar.progress.includes(ar.nowLabel ?? '?'), name);
}

// Invoices: outstanding first, overdue pinned (oldest due first), paid collapsed, one action.
const invoices: Invoice[] = [
  bill({ name: 'ACC-SINV-2026-00010', date: '2026-09-29', due: '2026-10-29', outstanding: 14345 }),
  bill({ name: 'ACC-SINV-2026-00008', date: '2026-08-30', due: '2026-09-28', outstanding: 5000, status: 'overdue' }),
  bill({ name: 'ACC-SINV-2026-00007', date: '2026-08-27', due: '2026-09-26', outstanding: 9000, status: 'overdue' }),
  bill({ name: 'ACC-SINV-2026-00005', date: '2026-07-30', due: '2026-08-29', outstanding: 0, status: 'paid' }),
];
assert.equal(billingDoc(invoices), 'ACC-SINV-2026-00007', 'the oldest overdue invoice');
assert.equal(billingDoc([invoices[0], invoices[3]]), 'ACC-SINV-2026-00010', 'else the newest unpaid');
assert.equal(billingDoc([invoices[3]]), undefined);
const card = invoicesCard('en', invoices);
assert.match(card.outstanding, /^EGP.28,345 outstanding$/);
assert.equal(card.open, 'Open invoices: 3');
assert.deepEqual(card.rows.map((r) => r.id), ['ACC-SINV-2026-00007', 'ACC-SINV-2026-00008', 'ACC-SINV-2026-00010']);
assert.match(card.rows[0].note, /^Overdue since /);
assert.equal(card.paid, 'Paid invoices: 1');
assert.deepEqual(card.action?.act, { k: 'contact', topic: 'billing', doc: 'ACC-SINV-2026-00007' });
assert.equal(card.action?.label, 'Discuss invoice ACC-SINV-2026-00007');
assert.equal(invoicesCard('en', [invoices[3]]).action, undefined);

console.log('cards: all assertions passed');
