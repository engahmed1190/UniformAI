// Run: npx tsx lib/guard.test.ts
// Regenerating replaces every kit on screen. If someone has customised one,
// that is destructive, so it asks first. This pins the wiring: every path
// that edits a kit has to mark the work, or the guard silently stops firing.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { translations } from './i18n';

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
// while "Saved kits" was a different destination in the nav. Labels come from
// the dictionary now, so the check moved with them: the English string still
// has to name the destination, in both languages.
for (const loc of ['en', 'ar'] as const) {
  assert.ok(translations[loc].design.chooseDifferent.length > 0,
    `${loc} is missing the label that says where the button goes`);
}
assert.match(translations.en.design.chooseDifferent, /different kit/,
  'the button must say where it goes');
// Comments stripped: the note explaining the rename mentions the old label,
// and the original test was careful not to fail on its own explanation.
const pageCode = page.replace(/\/\*[^]*?\*\/|\/\/[^\n]*/g, '');
assert.ok(!/Back to kits/.test(pageCode), 'that label named the wrong destination');

// 4. One h1 per page, and no h3 without an h2 above it. Home had neither.
// Titles come from the dictionary now, so this checks every page renders an
// h1 from a translation key rather than looking for one English string.
const h1s = [...page.matchAll(/<h1>\{t\(locale, '([\w.]+)'\)\}<\/h1>/g)].map((m) => m[1]);
assert.ok(h1s.includes('home.title'), 'every page needs a title, Home included');
assert.ok(h1s.length >= 5, `only ${h1s.length} pages carry an h1: ${h1s}`);
assert.ok(!/<h3>/.test(page), 'panel headings sit under the page h1, so they are h2');

// 4c. No component may hold a sentence of its own. A hardcoded string is
// invisible until someone reads that screen in the other language -- the
// editor's fallback shipped in English this way. Anything long enough to be
// prose, sitting in JSX or a text: field, has to come from the dictionary.
for (const rel of ['../app/page.tsx', '../components/configurator.tsx', '../components/shell.tsx']) {
  const src = readFileSync(new URL(rel, import.meta.url), 'utf8')
    .replace(/\/\*[^]*?\*\/|\/\/[^\n]*/g, '');
  // A quoted run with three or more words and sentence punctuation.
  const prose = [
    // A quoted run in JSX or a text: field.
    ...[...src.matchAll(/(?:text:|>)\s*'([A-Z][^']*[.?!][^']*)'/g)].map((m) => m[1]),
    // ...and the same thing passed as a prop. title="Nothing to configure yet"
    // shipped in English because the first pattern did not look here.
    ...[...src.matchAll(/\b(?:title|note|action|label|placeholder)="([A-Z][^"]{6,})"/g)].map((m) => m[1]),
  ];
  assert.equal(prose.length, 0, `${rel} holds its own prose: ${prose.slice(0, 2)}`);
}

// 4b. No component may carry its own English/Arabic branch: that is exactly
// the duplication the dictionary exists to prevent.
for (const [file, src] of [['page.tsx', page], ['shell.tsx', readFileSync(new URL('../components/shell.tsx', import.meta.url), 'utf8')]]) {
  assert.ok(!/locale === '(ar|en)' \?/.test(src),
    `${file} branches on locale inline -- put the string in lib/i18n.ts`);
}

// 5. A table header sits over its own data. `.tableCard th` set text-align
// and outranked a bare `.right` on specificity, so every heading rendered
// left while its numbers were right-aligned -- "Qty" sat 145px from its own
// column of figures. The override has to be at least as specific.
const css = readFileSync(new URL('../app/ui.module.css', import.meta.url), 'utf8');
assert.match(css, /\.tableCard th\.right\s*\{[^}]*text-align:\s*end/,
  'a right-aligned header needs a rule that beats .tableCard th');

// 5b. RTL: the stylesheet must stay on logical properties. A physical
// margin-left or text-align:left reads wrong in Arabic, and the only
// physical offsets allowed are symmetric pairs and centring.
const rules = css.replace(/\/\*[^]*?\*\//g, '');
const physical = [...rules.matchAll(/^\s*(margin|padding|border)-(left|right):|^\s*text-align:\s*(left|right)\b/gm)];
assert.equal(physical.length, 0,
  `physical directional properties found: ${physical.map((m) => m[0].trim())}`);

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
