// lib/policy.test.ts
// Run: npx tsx lib/policy.test.ts
import assert from 'node:assert/strict';
import { CONCEPTS } from './concepts';
import { POLICY, acceptsSets, plan } from './policy';
import { parseKit } from './sales';

assert.equal(POLICY.minimumSets, 10);
assert.equal(POLICY.sparePercent, 5);

// People -> sets: 5% spares rounded up, then raised to the minimum.
assert.deepEqual(plan(40), { people: 40, sets: 42, spareSets: 2, moqApplied: false });
assert.deepEqual(plan(20), { people: 20, sets: 21, spareSets: 1, moqApplied: false });
assert.deepEqual(plan(10), { people: 10, sets: 11, spareSets: 1, moqApplied: false });
assert.deepEqual(plan(6), { people: 6, sets: 10, spareSets: 4, moqApplied: true });

// The server's rule: max(people, MOQ) <= sets <= max(2 x people, MOQ).
assert.ok(acceptsSets(4, 10), 'a four-person MOQ plan is accepted');
assert.ok(!acceptsSets(6, 9), 'below the minimum');
assert.ok(acceptsSets(40, 80));
assert.ok(!acceptsSets(40, 81));
assert.ok(!acceptsSets(40, 39));
assert.ok(!acceptsSets(40, 41.5));
assert.ok(!acceptsSets(0, 10));
assert.ok(!acceptsSets(501, 526));
assert.ok(!acceptsSets(10.5, 11));

// parseKit follows the rule.
const kit = { concept: CONCEPTS[0], staff: 4, sets: 10, grades: [], sizePlan: { mode: 'collect_later', allocation: {} } };
assert.doesNotThrow(() => parseKit(kit));
assert.throws(() => parseKit({ ...kit, sets: 9 }), /Invalid sets/);

console.log('policy: all assertions passed');
