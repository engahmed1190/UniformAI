// Run: npx tsx lib/cards.test.ts
import assert from 'node:assert/strict';
import { CONCEPTS } from './concepts';
import { sampleOrder } from './order-fixture';
import type { Order, Workflow } from './order';
import type { Invoice } from './invoices';
import { LOCALES } from './i18n';
import { billingDoc, invoicesCard, orderCard } from './cards';

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
assert.equal(v.nowLabel, 'Order confirmed');
v = orderCard('en', order('collecting_sizes'), []);
assert.deepEqual(v.action?.act, { k: 'sizes', order: 'SAL-ORD-2026-00011' });
assert.equal(v.nowLabel, 'Sizes received');
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
    for (const text of [view.title, view.meta, view.next, ...view.steps.map((x) => x.label)]) {
      assert.doesNotMatch(text, /journey\.|orders\.|\{\w+\}|ERPNext|UA-/, text);
    }
  }
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
