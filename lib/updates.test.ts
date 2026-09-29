// Run: npx tsx lib/updates.test.ts
// "Since we last spoke": what changed between two reads, and never the
// customer's own writes.
import assert from 'node:assert/strict';
import { CONCEPTS } from './concepts';
import { sampleOrder } from './order-fixture';
import type { Order, Workflow } from './order';
import type { Invoice } from './invoices';
import { type Seen, newsSince, orderKey, withOrder } from './updates';
import { newsTurn } from './journey';

const QUOTE_STATES: Workflow[] = ['quote_requested', 'quote_ready', 'quote_closed'];
const order = (state: Workflow, over: Partial<Order> = {}): Order => {
  const o = sampleOrder(CONCEPTS[0], 40, 42, [], 650, new Date('2026-09-20T10:00:00'), state);
  const so = QUOTE_STATES.includes(state) ? undefined : 'SAL-ORD-2026-00011';
  return { ...o, id: so ?? 'SAL-QTN-2026-00031', quote: 'SAL-QTN-2026-00031', salesOrder: so, ...over };
};
const inv = (over: Partial<Invoice> = {}): Invoice => ({
  name: 'ACC-SINV-2026-00010', date: '2026-09-29', due: '2026-10-29', total: 14345, outstanding: 14345,
  status: 'unpaid', order: 'SAL-ORD-2026-00011', ...over,
});

// The first read is the baseline: no news, the greeting covers it.
let r = newsSince(null, [order('quote_ready')], []);
assert.deepEqual(r.news, []);
assert.deepEqual(r.seen, { orders: { 'SAL-QTN-2026-00031': 'quote_ready' }, invoices: {} });

// The team issues a requested quote.
const requested = newsSince(null, [order('quote_requested')], []).seen;
r = newsSince(requested, [order('quote_ready')], []);
assert.deepEqual(r.news.map((n) => n.k), ['quote_ready']);

// The key survives quote -> order (id changes to SAL-ORD-…): approve then confirm is one change.
let seen: Seen = withOrder(requested, order('awaiting'));
assert.equal(orderKey(order('awaiting')), 'SAL-QTN-2026-00031');
assert.deepEqual(newsSince(seen, [order('awaiting')], []).news, [], 'the customer\'s own approval is not news');
r = newsSince(seen, [order('collecting_sizes')], []);
assert.deepEqual(r.news.map((n) => n.k), ['confirmed']);

// Sizes the customer sent are not news; sizes the team applied are.
seen = withOrder(r.seen, order('in_progress'));
assert.deepEqual(newsSince(seen, [order('in_progress')], []).news, []);
assert.deepEqual(newsSince(r.seen, [order('in_progress')], []).news.map((n) => n.k), ['production']);

// Delivered and invoiced in one read fold into one line.
seen = newsSince(null, [order('in_progress')], []).seen;
r = newsSince(seen, [order('delivered')], [inv()]);
assert.equal(r.news.length, 1);
assert.equal(r.news[0].k, 'delivered');
assert.equal((r.news[0] as { invoice?: Invoice }).invoice?.name, 'ACC-SINV-2026-00010');

// An invoice on its own, then paid.
seen = newsSince(null, [order('delivered')], []).seen;
r = newsSince(seen, [order('delivered')], [inv({ order: undefined })]);
assert.deepEqual(r.news.map((n) => n.k), ['invoiced']);
r = newsSince(r.seen, [order('delivered')], [inv({ status: 'paid', outstanding: 0 })]);
assert.deepEqual(r.news.map((n) => n.k), ['paid']);

// An orders-only read keeps the invoice baseline; with none yet, no invoice is "new".
seen = newsSince(null, [order('delivered')], [inv()]).seen;
assert.deepEqual(newsSince(seen, [order('delivered')]).seen.invoices, { 'ACC-SINV-2026-00010': 'unpaid' });
const ordersOnly = newsSince(null, [order('delivered')]).seen;
assert.equal(ordersOnly.invoices, null);
assert.deepEqual(newsSince(ordersOnly, [order('delivered')], [inv()]).news, []);

// The turn: one sentence, a button for what the customer can do, first one primary.
const ready = newsSince(requested, [order('quote_ready')], []).news;
const confirmed = newsSince(withOrder(requested, order('awaiting')), [order('collecting_sizes', { quote: 'SAL-QTN-2026-00031' })], []).news;
let turn = newsTurn('en', [...ready, ...confirmed]);
assert.match(turn.say, /^Since we last spoke: quotation SAL-QTN-2026-00031 is ready for your approval \(EGP.27,300\); /);
assert.match(turn.say, /confirmed order SAL-ORD-2026-00011/);
assert.deepEqual(turn.buttons.map((b) => b.act.k), ['approve', 'sizes']);
assert.equal(turn.buttons.filter((b) => b.primary).length, 1);
assert.ok(turn.buttons[0].primary);
turn = newsTurn('ar', ready);
assert.ok(turn.say.startsWith('منذ حديثنا الأخير:'));
assert.ok(turn.say.includes('SAL-QTN-2026-00031'));
turn = newsTurn('en', newsSince(newsSince(null, [order('in_progress')], []).seen, [order('delivered')], [inv()]).news);
assert.match(turn.say, /order SAL-ORD-2026-00011 has been delivered, and invoice ACC-SINV-2026-00010 for EGP.14,345 is ready\.$/);
assert.deepEqual(turn.buttons.map((b) => b.act), [{ k: 'invoices' }]);

console.log('updates: all assertions passed');
