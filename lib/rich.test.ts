// Run: npx tsx lib/rich.test.ts
import assert from 'node:assert/strict';
import { splitCodes } from './rich';

const en = 'Order SAL-ORD-2026-00047 for EGP 27,451 is ready.';
assert.deepEqual(splitCodes(en), [
  { text: 'Order ', code: false }, { text: 'SAL-ORD-2026-00047', code: true },
  { text: ' for ', code: false }, { text: 'EGP 27,451', code: true }, { text: ' is ready.', code: false },
]);
for (const id of ['SAL-QTN-2026-00074', 'ACC-SINV-2026-00010', 'MAT-DN-2026-00014', 'CASE-2026-00002']) {
  assert.deepEqual(splitCodes(id), [{ text: id, code: true }]);
}
const ar = 'تم تسليم الطلب ⁨SAL-ORD-2026-00046⁩، وفاتورته ⁨ACC-SINV-2026-00010⁩ بقيمة ⁨EGP 14,345⁩ جاهزة';
assert.equal(splitCodes(ar).map((p) => p.text).join(''), ar, 'nothing is lost or reordered');
assert.deepEqual(splitCodes(ar).filter((p) => p.code).map((p) => p.text), ['SAL-ORD-2026-00046', 'ACC-SINV-2026-00010', 'EGP 14,345']);
assert.deepEqual(splitCodes(''), []);
assert.deepEqual(splitCodes('No codes here.'), [{ text: 'No codes here.', code: false }]);
// A list's comma after an amount is the sentence's, not the amount's.
assert.deepEqual(splitCodes('EGP 9,000, EGP 1,250.50 and EGP 800.').filter((p) => p.code).map((p) => p.text),
  ['EGP 9,000', 'EGP 1,250.50', 'EGP 800']);
console.log('rich: all assertions passed');
