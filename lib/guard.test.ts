// Run: npx tsx lib/guard.test.ts
// Regenerating replaces every kit on screen. If someone has customised one,
// that is destructive, so it asks first. This pins the wiring: every path
// that edits a kit has to mark the work, or the guard silently stops firing.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');

// 1. generate() asks before throwing customised work away, and the check
// comes before any state is touched -- a confirm after setBusy would leave
// the app spinning on a cancel.
const gen = page.slice(page.indexOf('function generate('));
const body = gen.slice(0, gen.indexOf('\n  }'));
assert.match(body, /if \(edited && !confirm\(/, 'generate must ask before replacing edited kits');
assert.ok(
  body.indexOf('confirm(') < body.indexOf('setBusy(true)'),
  'the question has to come before the app starts working',
);
assert.ok(
  body.indexOf('setEdited(false)') < body.indexOf('setConcepts('),
  'fresh kits start unedited',
);

// 2. Every route that changes a kit marks it. These are separate handlers:
// the configurator's spec patches, and the fabric grades and spare, which
// live in page.tsx and would otherwise bypass the flag entirely.
const cfg = page.slice(page.indexOf('<Configurator'));
const cfgProps = cfg.slice(0, cfg.indexOf('/>'));
for (const handler of ['onChange', 'onGradesChange', 'onSpareChange']) {
  const at = cfgProps.indexOf(`${handler}={`);
  assert.ok(at > 0, `${handler} not passed to the configurator`);
  // Read to the end of THIS prop only. A fixed-width window ran on into the
  // next handler and found its setEdited, so the check passed with the flag
  // removed -- verified by deleting it and watching this test still pass.
  const from = cfgProps.slice(at + handler.length + 1);
  let depth = 0;
  let end = from.length;
  for (let i = 0; i < from.length; i++) {
    if (from[i] === '{') depth++;
    else if (from[i] === '}' && --depth === 0) { end = i; break; }
  }
  assert.match(from.slice(0, end), /setEdited\(true\)/,
    `${handler} must mark the kit as edited`);
}

// 3. A button says where it goes. The old label pointed at the design page
// while "Saved kits" was a different destination in the nav. Checked on the
// rendered label, not the file, so the comment explaining the rename does
// not fail its own test.
const labels = [...page.matchAll(/>\s*([A-Z][^<>{}]{3,40}?)\s*<\/button>/g)].map((m) => m[1]);
assert.ok(!labels.includes('Back to kits'), 'that label named the wrong destination');
assert.ok(labels.includes('Choose a different kit'), 'the button must say where it goes');

// 4. One h1 per page, and no h3 without an h2 above it. Home had neither.
assert.match(page, /<h1>Home<\/h1>/, 'every page needs a title, Home included');
assert.ok(!/<h3>/.test(page), 'panel headings sit under the page h1, so they are h2');

// 5. A table header sits over its own data. `.tableCard th` set text-align
// and outranked a bare `.right` on specificity, so every heading rendered
// left while its numbers were right-aligned -- "Qty" sat 145px from its own
// column of figures. The override has to be at least as specific.
const css = readFileSync(new URL('../app/ui.module.css', import.meta.url), 'utf8');
assert.match(css, /\.tableCard th\.right\s*\{[^}]*text-align:\s*right/,
  'a right-aligned header needs a rule that beats .tableCard th');

// Every th carrying .right must have a td under it that also does, or the
// column is aligned one way in the head and the other in the body.
const pageSrc = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
for (const head of pageSrc.match(/<tr><th[^]*?<\/tr>/g) ?? []) {
  const cols = head.match(/<th[^>]*>/g) ?? [];
  cols.forEach((th, i) => {
    if (!th.includes('s.right')) return;
    // Find the matching cell position in the first body row after this head.
    const after = pageSrc.slice(pageSrc.indexOf(head) + head.length);
    const row = after.slice(0, after.indexOf('</tr>'));
    const tds = row.match(/<td[^>]*>/g) ?? [];
    assert.ok(tds[i]?.includes('s.right'),
      `column ${i + 1} is right-aligned in the header but not in the body`);
  });
}

console.log('guard: all assertions passed');
