// Run: npx tsx lib/orders.test.ts
import assert from 'node:assert/strict';
import { CONCEPTS } from './concepts';
import {
  type Kit, type QuoteRow, type SalesOrderRow, type DeliveryRow, kitEstimate, kitLines, toOrders,
} from './orders';

const kit = (id: string, grades: number[] = []): Kit => {
  const concept = CONCEPTS.find((c) => c.id === id)!;
  return { concept, staff: 40, sets: 42, grades, sizePlan: { mode: 'collect_later', allocation: {} } };
};

// 1. The lines of every sample kit, at every grade mix, sum to the estimate.
for (const c of CONCEPTS) {
  for (const grades of [[], [1, 1, 1], [2, 0, 1]]) {
    const k = kit(c.id, grades);
    const sum = kitLines(k).reduce((s, l) => s + l.qty * l.rate, 0);
    assert.equal(sum, kitEstimate(k), `${c.id} ${grades}`);
  }
}

// 2. One made-to-order line per garment, one logo line, sets as the quantity.
const tech = kitLines(kit('technicians'));
assert.deepEqual(tech.map((l) => l.item_code), ['UA-MTO-POLO', 'UA-MTO-CARGO', 'UA-PRINT']);
assert.ok(tech.every((l) => l.qty === 42));
assert.match(tech[0].description, /Cotton Pique 220 GSM/);

// 3. No logo, no logo line.
const plain = kit('technicians');
plain.concept = { ...plain.concept, logo: { ...plain.concept.logo, position: 'none' } };
assert.ok(!kitLines(plain).some((l) => l.item_code.startsWith('UA-PRINT')));

// 4. Documents to orders. Rows are built by hand, as ERPNext's list API returns them.
const day = (d: string) => new Date(`${d}T10:00:00`);
const K = kit('technicians');
const kitJson = (k: Kit = K) => JSON.stringify(k);
const quote = (o: Partial<QuoteRow> = {}): QuoteRow => ({
  name: 'QTN-1', party_name: 'Acme', status: 'Draft', docstatus: 0, transaction_date: '2026-09-01',
  grand_total: kitEstimate(K), uniformai_kit: kitJson(), ...o,
});
const so = (o: Partial<SalesOrderRow> = {}): SalesOrderRow => ({
  name: 'SO-1', customer: 'Acme', status: 'To Deliver and Bill', docstatus: 1, transaction_date: '2026-09-03',
  per_delivered: 0, grand_total: kitEstimate(K), uniformai_kit: kitJson(), quotation: 'QTN-1', ...o,
});
const dn = (o: Partial<DeliveryRow> = {}): DeliveryRow => ({
  name: 'DN-1', posting_date: '2026-09-10', docstatus: 1, against_sales_order: 'SO-1', ...o,
});
const one = (q: QuoteRow[], s: SalesOrderRow[] = [], d: DeliveryRow[] = []) => {
  const r = toOrders(q, s, d);
  assert.equal(r.length, 1);
  return r[0];
};
const allocated = (n: number): Kit => ({
  ...K, sizePlan: { mode: 'allocate_now', allocation: { men: { M: n } } },
});

// A size run on record moves the order on and dates the "Sizes received" step.
{
  const [r] = toOrders([quote({ docstatus: 1, status: 'Ordered' })], [so()], [], new Map([['SO-1', '2026-09-05']]));
  assert.equal(r.state, 'in_progress');
  assert.equal(r.dates.sized?.getDate(), 5);
  assert.equal(one([quote({ docstatus: 1, status: 'Ordered' })], [so()]).dates.sized, undefined);
}

// The States table, one row each.
assert.equal(one([quote()]).state, 'quote_requested');
assert.equal(one([quote({ docstatus: 1, status: 'Open' })]).state, 'quote_ready');
assert.equal(one([quote({ docstatus: 1, status: 'Replied' })]).state, 'quote_ready');
assert.equal(one([quote({ docstatus: 1, status: 'Lost' })]).state, 'quote_closed');
assert.equal(one([quote({ docstatus: 1, status: 'Expired' })]).state, 'quote_closed');
assert.equal(one([quote({ docstatus: 1, status: 'Ordered' })], [so({ docstatus: 0 })]).state, 'awaiting');
assert.equal(one([quote({ docstatus: 1 })], [so()]).state, 'collecting_sizes');
assert.equal(one([quote({ docstatus: 1 })], [so({ uniformai_kit: kitJson(allocated(41)) })]).state,
  'collecting_sizes', 'allocated short of sets is still collecting');
assert.equal(one([quote({ docstatus: 1 })], [so({ uniformai_kit: kitJson(allocated(42)) })]).state, 'in_progress');
assert.equal(one([quote({ docstatus: 1 })], [so({ per_delivered: 60, uniformai_kit: kitJson(allocated(42)) })]).state,
  'in_progress', 'a partial delivery is still in progress');
assert.equal(one([quote({ docstatus: 1 })], [so({ per_delivered: 100 })], [dn()]).state, 'delivered');

// The chain joins, and each reached step carries its document and day.
const chain = one([quote({ docstatus: 1 })], [so({ per_delivered: 100 })],
  [dn({ posting_date: '2026-09-08' }), dn({ name: 'DN-2', posting_date: '2026-09-12' }), dn({ name: 'DN-3', docstatus: 0, posting_date: '2026-09-20' })]);
assert.equal(chain.id, 'SO-1');
assert.deepEqual([chain.quote, chain.salesOrder, chain.deliveryNote], ['QTN-1', 'SO-1', 'DN-2']);
assert.deepEqual(chain.dates, {
  requested: day('2026-09-01'), issued: day('2026-09-01'),
  approved: day('2026-09-03'), confirmed: day('2026-09-03'), delivered: day('2026-09-12'),
});
const early = one([quote()]);
assert.equal(early.id, 'QTN-1');
assert.deepEqual(Object.keys(early.dates), ['requested'], 'a draft quote has only been requested');
assert.deepEqual(Object.keys(one([quote({ docstatus: 1, status: 'Open' })]).dates), ['requested', 'issued']);
assert.equal(one([quote({ docstatus: 1 })], [so({ docstatus: 0 })]).dates.confirmed, undefined, 'a draft order is not confirmed');
assert.equal(one([quote({ docstatus: 1 })], [so()]).dates.delivered, undefined);

// A hand-made Sales Order: no quote, no kit JSON.
const hand = one([], [so({ quotation: null, uniformai_kit: null })]);
assert.equal(hand.concept, undefined);
assert.equal(hand.lines, undefined);
assert.equal(hand.quote, undefined);
assert.equal(hand.placed.getTime(), day('2026-09-03').getTime());
assert.equal(hand.estimate, hand.total);
assert.equal(hand.dates.requested, undefined);
// Malformed kit JSON is no kit, not a crash.
assert.equal(one([quote({ uniformai_kit: '{oops' })]).concept, undefined);
// So is JSON that parses but has the wrong shape.
const { logo: _logo, ...noLogo } = K.concept;
for (const bad of [
  '{"concept":{"garments":[{}]}}',
  JSON.stringify({ ...K, concept: noLogo }),
  JSON.stringify({ ...K, grades: undefined }),
  JSON.stringify({ ...K, sets: undefined }),
  JSON.stringify({ ...K, concept: { ...K.concept, garments: [{ type: 'polo' }] } }),
  JSON.stringify({ ...K, sizePlan: { mode: 'allocate_now' } }),
]) {
  const m = one([quote({ docstatus: 1, uniformai_kit: bad, grand_total: 777 })], [so({ uniformai_kit: bad, grand_total: 777 })]);
  assert.equal(m.concept, undefined, bad);
  assert.equal(m.lines, undefined, bad);
  assert.equal(m.estimate, 777, bad);
}

// Price: the quote's total wins, the estimate stays beside it.
const priced = one([quote({ docstatus: 1, grand_total: 99999 })]);
assert.equal(priced.total, 99999);
assert.equal(priced.estimate, kitEstimate(K));
assert.equal(one([quote({ docstatus: 1, grand_total: 99999 })], [so({ grand_total: 88888 })]).total, 88888, 'the order total wins once there is one');
assert.equal(priced.lines!.length, K.concept.garments.length + 1, 'lines come from the kit');

// Due: the order's delivery date, else three weeks from placing.
assert.equal(one([quote()]).due.getTime(), day('2026-09-22').getTime());
assert.equal(one([quote({ docstatus: 1 })], [so({ delivery_date: '2026-10-05' })]).due.getTime(), day('2026-10-05').getTime());

// Cancelled documents are ignored; drafts of Delivery Notes too.
assert.equal(toOrders([quote({ docstatus: 2 })], [], []).length, 0);
assert.equal(one([quote({ docstatus: 1, status: 'Open' })], [so({ docstatus: 2 })]).state, 'quote_ready', 'a cancelled order leaves the quote open');
assert.equal(one([quote({ docstatus: 1 })], [so({ per_delivered: 100 })], [dn({ docstatus: 2 })]).deliveryNote, undefined);

// Newest first, and a Sales Order only joins its own quote.
const two = toOrders([quote(), quote({ name: 'QTN-2', transaction_date: '2026-09-05' })], [], []);
assert.deepEqual(two.map((o) => o.id), ['QTN-2', 'QTN-1']);

// An issued quote past its valid_till is closed; on or after today it is still ready.
const pad = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const inDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return pad(d); };
assert.equal(one([quote({ docstatus: 1, status: 'Open', valid_till: inDays(-1) })]).state, 'quote_closed');
assert.equal(one([quote({ docstatus: 1, status: 'Open', valid_till: inDays(0) })]).state, 'quote_ready');
assert.equal(one([quote({ docstatus: 1, status: 'Open', valid_till: inDays(5) })]).state, 'quote_ready');

console.log('orders: all assertions passed');
