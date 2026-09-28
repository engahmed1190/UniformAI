// Run: npx tsx lib/order.test.ts
// The order is the quote, carried over. Anything the quote showed -- sets,
// upgrades, branding, total -- has to arrive on the order unchanged, or the
// demo's whole claim ("the spec becomes the transaction") is false.
import assert from 'node:assert/strict';
import { sampleOrder as placeOrder } from './order-fixture';
import { CONCEPTS } from './concepts';
import { setLogo, gradeName, conceptPriceAt } from './spec';

const c = CONCEPTS[1];
const grades = [1, 0];
const per = conceptPriceAt(c, grades);
const o = placeOrder(c, 40, 42, grades, per, new Date('2026-09-02T10:00:00Z'));

// 1. Money and quantity are the quote's, not recomputed.
assert.equal(o.total, per * 42);
assert.equal(o.sets, 42);
assert.equal(o.staff, 40);

// 2. One line per garment, plus one for the logo, each for every set.
assert.equal(o.lines!.length, c.garments.length + 1);
assert.ok(o.lines!.every((l) => l.qty === 42));
assert.ok(o.lines![o.lines!.length - 1].logo, 'the last line is the branding line');

// 3. The upgrade the buyer chose is named on its line.
assert.equal(o.lines![0].fabric, gradeName(c.garments[0], 1));

// 4. No logo, no branding line.
assert.equal(placeOrder(setLogo(c, { position: 'none' }), 40, 42, grades, per).lines!.length, c.garments.length);

// 5. A due date after the placing date.
assert.ok(o.due > o.placed);

// 6. An order from the API gets its dates back as Dates, and the rest untouched.
import { fromJson, timeline as tl0 } from './order';
const back = fromJson(JSON.parse(JSON.stringify(o)));
assert.equal(back.due.getTime(), o.due.getTime());
assert.equal(back.dates.issued!.getTime(), o.dates.issued!.getTime());
assert.equal(back.id, o.id);
assert.equal(fromJson(JSON.parse(JSON.stringify({ ...o, dates: {} }))).state, o.state);

// The quote number shows on the "Quote issued" step as well as "Quote requested".
{
  const q = tl0({ ...o, quote: 'QTN-1' });
  assert.equal(q[0].doc, 'QTN-1');
  assert.equal(q[1].doc, 'QTN-1');
}

// 7. The state drives status -- one source, so the pill and the notes cannot disagree.
import { status } from './order';
assert.equal(o.state, 'collecting_sizes', 'a fresh order is waiting on sizes');
assert.equal(status(o), 'collecting_sizes');
assert.equal(status({ ...o, state: 'in_progress' }), 'in_progress');
assert.equal(placeOrder(c, 40, 42, grades, per, new Date(), 'delivered').perDelivered, 100);

console.log('order: all assertions passed');

// 10. Order lines hold data, not sentences. An order placed in Arabic and
// reopened in English -- or the reverse -- must read in the language the
// buyer is looking at, so the line stores what it IS and the screen says it.
const line = o.lines![0];
assert.ok('garment' in line || 'logo' in line, 'a line must name what it is, not a rendered string');
const logoLine = o.lines![o.lines!.length - 1];
assert.equal(logoLine.logo, 'embroidery', 'the logo line stores the method');
assert.equal(logoLine.position, 'left_chest', 'and the placement');
assert.equal(line.garment, c.garments[0].type, 'a garment line stores its type');
assert.ok(line.colour?.startsWith('#'), 'and its colour as the stored hex');

// A completed measurement breakdown follows the accepted quote into the
// order. It is order data, not part of the reusable saved kit.
const plan = { mode: 'allocate_now' as const, allocation: { women: { M: 22 }, men: { L: 20 } } };
const sized = placeOrder(c, 40, 42, grades, per, new Date('2026-09-02T10:00:00Z'), 'in_progress', plan);
assert.deepEqual(sized.sizePlan, plan);
assert.equal(sized.state, 'in_progress', 'complete sizes can move straight to in progress');

// Timeline: exactly the reached steps, the current one as Now, delivery only at 100%.
import { timeline as tl } from './order';
{
  const d = new Date('2026-09-02T10:00:00Z');
  const base = placeOrder(CONCEPTS[0], 40, 42, [], 500, d);
  const shape = (o: typeof base) => tl(o).map((x) => (x.reached ? 'R' : x.now ? 'N' : '-')).join('');
  assert.equal(shape(base), 'RRRRN', 'collecting sizes: four reached, delivery is Now');
  assert.equal(shape(placeOrder(CONCEPTS[0], 40, 42, [], 500, d, 'delivered')), 'RRRRR');
  assert.equal(shape(placeOrder(CONCEPTS[0], 40, 42, [], 500, d, 'quote_ready')), 'RRN--');
  assert.equal(shape(placeOrder(CONCEPTS[0], 40, 42, [], 500, d, 'quote_closed')), 'RR---', 'a closed quote has no Now');
  const part = tl({ ...base, state: 'in_progress', perDelivered: 60, salesOrder: 'SAL-ORD-2026-00016' });
  assert.equal(part[4].reached, false);
  assert.equal(part[4].partial, 60);
  assert.equal(part[3].doc, 'SAL-ORD-2026-00016');
}
