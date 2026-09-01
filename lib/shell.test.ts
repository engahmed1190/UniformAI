// Run: npx tsx lib/shell.test.ts
// The phone nav drops two destinations into a sheet and leaves one out
// entirely. That is a deliberate choice, so it needs a guard: a page that
// is reachable from nowhere is worse than a crowded bar.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../components/shell.tsx', import.meta.url), 'utf8');
const list = (name: string) => {
  const m = src.match(new RegExp(`const ${name}[^=]*=\\s*\\[([^\\]]*)\\]`));
  if (!m) throw new Error(`no ${name}`);
  return [...m[1].matchAll(/'([a-z]+)'/g)].map((x) => x[1]);
};

const nav = [...src.matchAll(/\['(\w+)', '[^']*'\]/g)].map((m) => m[1]);
const phone = list('PHONE_NAV');
const more = list('MORE_NAV');

// 1. Four targets on the bar. Six at 390px gave each 62px, which wrapped
// "New uniform" onto two lines; five is the usual ceiling and we use four.
assert.equal(phone.length + 1, 4, 'the phone bar is three destinations plus More');

// 2. Every page still reachable on a phone, except configure -- which you
// enter by opening a kit. Tapping it cold lands on "Nothing to configure
// yet", so it does not earn a permanent slot.
const reachable = new Set([...phone, ...more]);
for (const page of nav) {
  if (page === 'configure') {
    assert.ok(!reachable.has(page), 'configure is reached by opening a kit, not from the bar');
    continue;
  }
  assert.ok(reachable.has(page), `${page} is unreachable on a phone`);
}

// 3. The two lists must not overlap, or a page shows up twice.
for (const p of phone) assert.ok(!more.includes(p), `${p} is in both the bar and More`);

// 4. More carries the badge count of what it hides, otherwise a pending
// order inside the sheet is invisible from the bar.
assert.match(src, /moreCount/, 'More must total the counts it hides');

console.log('shell: all assertions passed');
