// Run: npx tsx lib/answers.test.ts
import assert from 'node:assert/strict';
import { answer, type OrderRow } from './answers';

const order = (o: Partial<OrderRow> = {}): OrderRow => ({
  id: 'SO-1', state: 'in_progress', due: '2026-10-20', total: 28896, perDelivered: 0,
  lines: [{ garment: 'polo', qty: 40 }, { logo: 'print', qty: 40 }], ...o,
});
const bin = (qty: number, warehouse = 'Stores - UA') =>
  ({ item_name: 'Polo Navy XL', warehouse, actual_qty: qty });

for (const locale of ['en', 'ar'] as const) {
  const none = answer(locale, 'stock', []);

  // orders: counted by state, in the customer's words.
  const three = answer(locale, 'orders', [
    order({ id: 'A', state: 'quote_ready' }), order({ id: 'B' }), order({ id: 'C' })]);
  assert.match(three, /3/);
  assert.match(three, /2/);
  assert.equal(answer(locale, 'orders', []), none);
  // 13 orders are counted as 13 whatever the screen shows.
  const many = answer(locale, 'orders', Array.from({ length: 13 }, (_, i) =>
    order({ id: `O${i}`, state: i < 9 ? 'in_progress' : 'delivered' })));
  assert.match(many, /13/);
  assert.match(many, /9/);
  assert.match(many, /4/);

  // order: a ready quote waits for their approval.
  const ready = answer(locale, 'order', [order({ id: 'QTN-1', state: 'quote_ready' })]);
  assert.match(ready, locale === 'en' ? /approval/ : /موافقتك/);
  assert.match(ready, /QTN-1/);
  assert.match(answer(locale, 'order', [order()]), /40/);
  assert.equal(answer(locale, 'order', []), none);

  // stock: yes and the number; a Bin at 0 is out of stock; no rows is no record.
  const yes = answer(locale, 'stock', [bin(260)]);
  assert.match(yes, /260/);
  assert.ok(!yes.includes(' - UA'));
  const out = answer(locale, 'stock', [bin(0)]);
  assert.notEqual(out, none);
  assert.match(out, locale === 'en' ? /out of stock/ : /نفد/);
  const two = answer(locale, 'stock', [bin(200), bin(60, 'Dispatch - UA')]);
  assert.match(two, /260/);
  assert.match(two, /Dispatch/);

  // price: the rate and the invoice, or no record.
  const price = answer(locale, 'price', [
    { name: 'SINV-9', posting_date: '2026-08-01', items: [{ item_name: 'Blazer', rate: 1480 }] }]);
  assert.match(price, /1[,،]?480/);
  assert.match(price, /SINV-9/);
  assert.equal(answer(locale, 'price', []), none);

  // The customer never reads a system name.
  for (const text of [three, ready, yes, out, price]) assert.doesNotMatch(text, /ERP|http/i);
}
assert.notEqual(answer('en', 'stock', []), answer('ar', 'stock', []));
console.log('answers: all assertions passed');
