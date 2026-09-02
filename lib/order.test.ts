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
assert.ok(o.lines[o.lines.length - 1].logo, 'the last line is the branding line');

// 3. The upgrade the buyer chose is named on its line.
assert.equal(o.lines[0].fabric, gradeName(c.garments[0], 1));

// 4. No logo, no branding line.
assert.equal(placeOrder(setLogo(c, { position: 'none' }), 40, 42, grades, per).lines.length, c.garments.length);

// 5. An ERP-shaped number and a due date after the placing date.
assert.match(o.id, /^SO-2026-\d{8}$/);
assert.ok(o.due > o.placed);


// 6. An order survives a reload with its dates still dates.
import { revive } from './order';
const [back] = revive(JSON.stringify([o]));
assert.equal(back.due.getTime(), o.due.getTime());
assert.equal(back.id, o.id);

// 7. Stage drives status and progress -- one source, so the pill, the bar
// and the timeline cannot disagree.
import { status, progress } from './order';
assert.equal(o.stage, 1, 'a fresh order is waiting on sizes');
assert.equal(status(o), 'Collecting sizes');
assert.equal(status({ ...o, stage: 3 }), 'In production');
assert.equal(status({ ...o, stage: 5 }), 'Delivered');
assert.equal(progress({ ...o, stage: 1 }), 0);
assert.equal(progress({ ...o, stage: 5 }), 100);
assert.ok(progress({ ...o, stage: 3 }) > progress({ ...o, stage: 2 }));
assert.equal(placeOrder(c, 40, 42, grades, per, new Date(), 5).stage, 5);

// 8. A list round-trips.
assert.equal(revive(JSON.stringify([o, o])).length, 2);

console.log('order: all assertions passed');

// 9. Ids increase with time. Seconds-mod-100000 wrapped, so two orders a few
// seconds apart could come back in the wrong order -- and after ~27 hours two
// orders could collide outright.
// Walk the whole year, including a day rollover and New Year's Eve. The old
// seconds-mod-100000 wrapped every ~27 hours, so a newer order sorted behind
// an older one; a later local/UTC mix produced "SO-2027-000-1" on 31 Dec.
const stamps: Date[] = [];
for (let d = 0; d < 366; d += 3) {
  for (const sec of [0, 1, 5, 3600, 43200, 86399]) {
    stamps.push(new Date(new Date(2026, 0, 1).getTime() + d * 864e5 + sec * 1000));
  }
}
const ids = stamps.map((t) => placeOrder(c, 40, 42, [], 500, t).id);
for (let i = 1; i < ids.length; i++) {
  assert.ok(ids[i] > ids[i - 1], `${ids[i]} placed later must sort after ${ids[i - 1]}`);
}
assert.equal(new Set(ids).size, ids.length, 'ids collided');
assert.ok(
  placeOrder(c, 40, 42, [], 500, new Date(2027, 0, 1, 0, 0, 1)).id >
  placeOrder(c, 40, 42, [], 500, new Date(2026, 11, 31, 23, 59, 59)).id,
  'the new year must sort after the old one',
);

// 10. Order lines hold data, not sentences. An order placed in Arabic and
// reopened in English -- or the reverse -- must read in the language the
// buyer is looking at, so the line stores what it IS and the screen says it.
const line = o.lines[0];
assert.ok('garment' in line || 'logo' in line, 'a line must name what it is, not a rendered string');
const logoLine = o.lines[o.lines.length - 1];
assert.equal(logoLine.logo, 'embroidery', 'the logo line stores the method');
assert.equal(logoLine.position, 'left_chest', 'and the placement');
assert.equal(line.garment, c.garments[0].type, 'a garment line stores its type');
assert.ok(line.colour?.startsWith('#'), 'and its colour as the stored hex');

// A completed measurement breakdown follows the accepted quote into the
// order. It is order data, not part of the reusable saved kit.
const plan = { mode: 'allocate_now' as const, allocation: { women: { M: 22 }, men: { L: 20 } } };
const sized = placeOrder(c, 40, 42, grades, per, new Date('2026-09-02T10:00:00Z'), 2, plan);
assert.deepEqual(sized.sizePlan, plan);
assert.equal(sized.stage, 2, 'complete sizes can move straight to cutting');
