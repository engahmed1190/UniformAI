// Run: npx tsx lib/evidence.test.ts
import assert from 'node:assert/strict';
import { type Source, changesSince, remember, sourceKey } from './evidence';

const bin = (qty: number): Source => ({
  doctype: 'Bin', name: 'b1', title: 'Polo Navy XL', detail: 'Stores', qty,
  readAt: '2026-09-28T10:00:00Z',
});

// A record seen for the first time has nothing to compare against.
const seen = new Map<string, Source>();
assert.equal(changesSince(seen, [bin(260)]).size, 0);

// Asked again after a stock reconciliation: the quantity change is reported
// with both values, which is what the card shows as 260 → 40.
remember(seen, [bin(260)]);
const changed = changesSince(seen, [bin(40)]);
assert.deepEqual(changed.get(sourceKey(bin(40))), [{ field: 'qty', from: 260, to: 40 }]);

// Unchanged records report nothing, and a changed status is caught too.
assert.equal(changesSince(seen, [bin(260)]).size, 0);
const order: Source = {
  doctype: 'Sales Order', name: 'SAL-ORD-2026-00002', title: 'SAL-ORD-2026-00002',
  detail: 'To Deliver and Bill', date: '2026-10-19', readAt: 'r',
};
remember(seen, [order]);
const shipped = changesSince(seen, [{ ...order, detail: 'To Bill' }]);
assert.deepEqual(shipped.get(sourceKey(order)),
  [{ field: 'detail', from: 'To Deliver and Bill', to: 'To Bill' }]);

console.log('evidence: all assertions passed');
