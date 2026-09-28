// Run: npx tsx lib/orders.test.ts
import assert from 'node:assert/strict';
import { CONCEPTS } from './concepts';
import { type Kit, kitEstimate, kitLines } from './orders';

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

console.log('orders: all assertions passed');
