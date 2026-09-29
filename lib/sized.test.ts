// lib/sized.test.ts
// Run: npx tsx lib/sized.test.ts
import assert from 'node:assert/strict';
import { CONCEPTS } from './concepts';
import { type Kit, kitLines } from './orders';
import { cutsOf } from './size-run';
import { type GarmentSize, type SizeAllocation, SIZES } from './spec';
import { type SoItem, sizedItems, sizedVariants } from './sized';

const concept = CONCEPTS.find((c) => c.id === 'technicians')!; // Sand polo, Khaki cargo, printed logo
const kit: Kit = { concept, staff: 40, sets: 42, grades: [], sizePlan: { mode: 'collect_later', allocation: {} } };
const soItems = (k: Kit): SoItem[] => kitLines(k).map((l, i) => ({
  name: `row-${i + 1}`, item_code: l.item_code, qty: l.qty, rate: l.rate,
  uom: 'Nos', conversion_factor: 1, delivery_date: '2026-10-20', warehouse: 'Stores - UA',
}));
const items = soItems(kit);
const run: SizeAllocation = { men: { S: 5, M: 10, L: 6 }, women: { XS: 3, M: 12, '3XL': 6 } };
const rows = sizedItems(items, kit, run);

// 1. The branding line stays, by its row name: it carries the quotation link.
const kept = rows.filter((r) => r.docname);
assert.deepEqual(kept.map((r) => [r.docname, r.item_code]),
  items.filter((i) => i.item_code === 'UA-PRINT').map((i) => [i.name, 'UA-PRINT']));

// 2. Each garment line becomes new variant lines: quantities add up to the
//    line, the rate is the line's, and no line is empty.
for (const line of items.filter((i) => i.item_code.startsWith('UA-MTO-'))) {
  const type = line.item_code.slice('UA-MTO-'.length);
  const variants = rows.filter((r) => r.item_code.startsWith(`UA-SIZED-${type}-`));
  assert.equal(variants.length, 6, type);
  assert.equal(variants.reduce((n, r) => n + r.qty, 0), line.qty, type);
  assert.ok(variants.every((r) => !r.docname && r.rate === line.rate && r.qty > 0 && r.warehouse === 'Stores - UA'));
}
assert.ok(rows.some((r) => r.item_code === 'UA-SIZED-POLO-SAND-WOMEN-3XL' && r.qty === 6));
assert.ok(rows.some((r) => r.item_code === 'UA-SIZED-CARGO-KHAKI-MEN-S' && r.qty === 5));
assert.ok(!rows.some((r) => r.item_code.startsWith('UA-MTO-')), 'every garment line is replaced');

// 3. The order's value does not move.
const value = (xs: { qty: number; rate: number }[]) => xs.reduce((n, r) => n + r.qty * r.rate, 0);
assert.equal(value(rows), value(items));

// 4. Refused: a run that does not add up, a second apply, and an order
//    without a branding line (nothing would keep the quotation link).
assert.throws(() => sizedItems(items, kit, { men: { M: 41 } }), /size run has 41/);
assert.throws(() => sizedItems(rows.map((r, i) => ({ ...r, name: r.docname ?? `new-${i}` })), kit, run), /already applied/);
assert.throws(() => sizedItems(items.filter((i) => i.item_code !== 'UA-PRINT'), kit, run), /branding line/);

// 5. The seed makes every variant a sample kit can need: each of its cuts in
//    every size a size run accepts.
const seeded = new Set(sizedVariants(CONCEPTS).map((v) => v.item_code));
for (const c of CONCEPTS) {
  const k: Kit = { ...kit, concept: c, sets: SIZES.length * cutsOf(c).length };
  const every = Object.fromEntries(cutsOf(c).map((cut) =>
    [cut, Object.fromEntries(SIZES.map((s) => [s, 1])) as Record<GarmentSize, number>]));
  for (const r of sizedItems(soItems(k), k, every).filter((r) => !r.docname)) {
    assert.ok(seeded.has(r.item_code), `${c.id}: ${r.item_code} is not seeded`);
  }
}

console.log('sized: all assertions passed');
