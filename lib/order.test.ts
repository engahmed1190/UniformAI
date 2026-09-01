// Run: npx tsx lib/order.test.ts
// The order is the quote, carried over. Anything the quote showed -- sets,
// upgrades, branding, total -- has to arrive on the order unchanged, or the
// demo's whole claim ("the spec becomes the transaction") is false.
import assert from 'node:assert/strict';
import { placeOrder } from './order';
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
assert.equal(o.lines.length, c.garments.length + 1);
assert.ok(o.lines.every((l) => l.qty === 42));
assert.match(o.lines[o.lines.length - 1].item, /logo/i);

// 3. The upgrade the buyer chose is named on its line.
assert.equal(o.lines[0].note, gradeName(c.garments[0], 1));

// 4. No logo, no branding line.
assert.equal(placeOrder(setLogo(c, { position: 'none' }), 40, 42, grades, per).lines.length, c.garments.length);

// 5. An ERP-shaped number and a due date after the placing date.
assert.match(o.id, /^SO-2026-\d{5}$/);
assert.ok(o.due > o.placed);

console.log('order: all assertions passed');

// 6. An order survives a reload with its dates still dates.
import { revive } from './order';
const back = revive(JSON.stringify(o));
assert.equal(back.due.getTime(), o.due.getTime());
assert.equal(back.id, o.id);
