// Run: npx tsx lib/pace.test.ts
import assert from 'node:assert/strict';
import { TYPING, typingMs } from './pace';

assert.equal(typingMs('', false), TYPING.min);
assert.equal(typingMs('x'.repeat(50), false), 800);
assert.equal(typingMs('x'.repeat(500), false), TYPING.max, 'a long reply still arrives within a second');
assert.equal(typingMs('x'.repeat(500), true), TYPING.reduced, 'reduced motion: a short, fixed beat');
console.log('pace: all assertions passed');
