# Client Assistant (Demo) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the floating assistant into a guided account manager on every screen that walks a customer from quotation request to approval, sizes, delivery, invoices and a support case, on live ERPNext data, in English and formal Arabic.

**Architecture:** A pure `lib/journey.ts` turns the customer's orders and invoices into one turn: a sentence plus at most four buttons, each naming an `Act`. `components/ask-erp.tsx` (the existing dock, same look) runs the act: a pure turn, an existing `/api/ask` read, or a call to one of four thin new routes. The routes reuse `lib/erp.ts` keys and `salesFailure`; state still comes from `listOrders()`, now also reading `UniformAI Size Run` records.

**Tech Stack:** Next.js 16 route handlers (`params` is a Promise), React 19, TypeScript, ERPNext v15 REST, tests with `tsx` + `node:assert` (`npm test` runs every `lib/*.test.ts`).

**Spec:** `docs/superpowers/specs/2026-09-29-client-assistant-design.md`. This plan is a deliberately trimmed demo cut of it; the out-of-scope list below wins over the spec.

## Global Constraints

- Demo only. Do not build: durable request-id idempotency, unique indexes, expected-total or validity preconditions, rate limiting, a typed error hierarchy, a production live-site probe, graph/property tests, voice-contract tests, change-an-answer, park & resume, transcript persistence, reorder, scripted failure paths, responsive/a11y polish beyond focus, Escape and `aria-live`.
- This demo is a trusted local presentation, not a deployable customer portal. Bind Next.js to `127.0.0.1:3100` only; do not expose these fixed-customer write routes on a shared network. Keep a synchronous UI write lock and server-side duplicate checks for size runs so a double click cannot create two records.
- The existing approve lock in `lib/sales.ts` stays as it is.
- No LLM. Every turn is built by code from records.
- The customer never sees "ERPNext", an ERP URL, an item code (`UA-…`) or a raw ERPNext status ("Draft", "To Deliver and Bill"). Document numbers (SAL-QTN-…, SAL-ORD-…, CASE-…) are fine.
- Policy: MOQ **10** made-to-order sets; recommended spares **5%**, rounded up.
- Voice: professional account manager, "Mr. Ahmed" / "أستاذ أحمد"; Arabic is formal (plural address, كم). Every English key has an Arabic key with the same `{placeholders}` (enforced by `lib/i18n.test.ts`).
- At most four journey buttons per turn; the dock adds a quiet "Menu" button outside that count.
- Next.js 16: read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` before adding routes. GET handlers are dynamic by default.
- Never start or kill the dev server; it runs at `http://127.0.0.1:3100`. Before a rehearsal, verify the listener is loopback-only with `ss -ltnp | grep ':3100'`.

## Review Focus

- The launcher on Design and Configure must not cover the fixed action/price bar (Task 8 `raised`); check it by eye.
- A quote requested in the chat is a draft: the chat must say "sent for review" and never offer Approve until the team submits it.
- ERPNext down while the dock opens: the menu turn becomes the calm "can't reach" turn with Try again, never a blank sheet.
- Arabic turns wrap Latin values (document numbers, EGP) in bidi isolates; assert on `includes(name)`, never on whole Arabic strings.
- A reset after a rehearsal must remove app-made quotations, orders, size runs and assistant-created cases, including cancelled app documents, or the menu's "waiting" button points at leftovers. It must not delete cases entered by staff.

---

### Task 1: The policy, and MOQ in the existing quote path

**Files:**
- Create: `lib/policy.ts`
- Modify: `lib/sales.ts` (`parseKit`, the `sets` check), `app/page.tsx:190` (`sets`)
- Test: `lib/policy.test.ts`

**Interfaces:**
- Consumes: `parseKit` from `lib/sales.ts`.
- Produces: `POLICY = { minimumSets: 10, sparePercent: 5 }`; `type QuantityPlan = { people: number; sets: number; spareSets: number; moqApplied: boolean }`; `plan(people: number): QuantityPlan`; `acceptsSets(people: number, sets: number): boolean`.

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx lib/policy.test.ts`
Expected: FAIL, cannot find module `./policy`.

- [ ] **Step 3: Implement**

```ts
// lib/policy.ts
// The commercial rules a customer is told, in one place so the page, the
// server and the assistant quote the same numbers.

export const POLICY = { minimumSets: 10, sparePercent: 5 } as const;

export type QuantityPlan = { people: number; sets: number; spareSets: number; moqApplied: boolean };

/** People -> sets: spares rounded up, then raised to the minimum order.
 *  Integer maths, so 40 people is 42 sets and never 43. */
export function plan(people: number): QuantityPlan {
  const wanted = Math.ceil((people * (100 + POLICY.sparePercent)) / 100);
  const sets = Math.max(wanted, POLICY.minimumSets);
  return { people, sets, spareSets: sets - people, moqApplied: wanted < POLICY.minimumSets };
}

/** What the server accepts for a made-to-order request. */
export function acceptsSets(people: number, sets: number): boolean {
  return Number.isInteger(people)
    && people >= 1
    && people <= 500
    && Number.isInteger(sets)
    && sets >= Math.max(people, POLICY.minimumSets)
    && sets <= Math.max(2 * people, POLICY.minimumSets);
}
```

In `lib/sales.ts`, add `import { acceptsSets } from './policy';` and replace

```ts
  if (!count(sets) || sets < staff || sets > staff * 2) throw bad('sets');
```

with

```ts
  if (!count(sets) || !acceptsSets(staff, sets)) throw bad('sets');
```

In `app/page.tsx`, add `import { POLICY } from '@/lib/policy';` and replace line 190

```ts
  const sets = Math.ceil(staff * (1 + spare));
```

with

```ts
  // Never below the minimum order; the quote dialog shows the final count.
  const sets = Math.max(Math.ceil(staff * (1 + spare)), POLICY.minimumSets);
```

- [ ] **Step 4: Run the tests**

Run: `npm test && npx tsc --noEmit`
Expected: every file prints its "all assertions passed" line; `sales.test.ts`'s existing bad cases (`sets: 5`, `sets: 21` at staff 10) still fail as before; no type errors.

- [ ] **Step 5: Commit**

```bash
git add lib/policy.ts lib/policy.test.ts lib/sales.ts app/page.tsx
git commit -F - <<'EOF'
Add the commercial policy: a 10-set minimum and 5% spares, enforced on quote requests

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 2: Seed additions: Size Run, contact cases, payments, a cleaner reset

**Files:**
- Modify: `scripts/seed-erp.ts` (header comment, `masters`, `reset`, `seed`; new `ensureSizeRunDoctype`, `pay`)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces on `uniform.localhost`: DocType `UniformAI Size Run` (`sales_order` Link to Sales Order, `allocation` JSON), readable by API Reader, create + read for UniformAI Portal; Portal may create `Issue`; Issues named `CASE-.YYYY.-`; history invoices hist-01..05 paid, hist-06 overdue, hist-07 unpaid. `--reset` also removes size runs, assistant-created BrainWise Issues and every `app-` chain, including cancelled app documents, while preserving staff-created cases.

- [ ] **Step 1: The Size Run doctype and Issue setup**

Below `ensureCustomField` add:

```ts
const SIZE_RUN = 'UniformAI Size Run';

/** Insert-only record of the size breakdown a customer sent for an order.
 *  The app never writes the Sales Order; the team reads size runs here. */
async function ensureSizeRunDoctype() {
  if (await find('DocType', [['name', '=', SIZE_RUN]])) return;
  await create('DocType', {
    name: SIZE_RUN, module: 'Selling', custom: 1,
    autoname: 'format:SIZE-RUN-{#####}', naming_rule: 'Expression',
    fields: [
      { fieldname: 'sales_order', fieldtype: 'Link', options: 'Sales Order', label: 'Sales Order',
        reqd: 1, in_list_view: 1, in_standard_filter: 1 },
      { fieldname: 'allocation', fieldtype: 'JSON', label: 'Size run', reqd: 1 },
    ],
    permissions: [
      { role: 'System Manager', read: 1, write: 1, create: 1, delete: 1 },
      { role: 'Sales User', read: 1 },
      { role: 'UniformAI Portal', read: 1, create: 1 },
      { role: 'API Reader', read: 1 },
    ],
  });
  console.log(`created DocType ${SIZE_RUN}`);
}
```

In `masters`, after the Portal's `for (const dt of ['Customer', 'Item', 'Address', 'Account'])` grant line, add:

```ts
  await ensureSizeRunDoctype();
  // Contact our team: the Portal opens a case, nothing more.
  await grant('Issue', 'UniformAI Portal', ['create']);
  // Cases read as CASE-2026-00007, not ERPNext's ISS- prefix.
  for (const [property, value] of [['options', 'CASE-.YYYY.-'], ['default', 'CASE-.YYYY.-']]) {
    await ensure('Property Setter', [['name', '=', `Issue-naming_series-${property}`]], {
      doctype_or_field: 'DocField', doc_type: 'Issue', field_name: 'naming_series',
      property, property_type: 'Text', value,
    });
  }
```

- [ ] **Step 2: Pay the history, leaving one overdue and one unpaid**

The dates already give the three states: hist-06 (quoted 2026-08-05) is delivered and invoiced 2026-08-27, due 2026-09-26, so past due; hist-07 (2026-09-01) is invoiced 2026-09-23, due 2026-10-23. Below `chain` add:

```ts
/** History invoices left open on purpose: hist-06 is past due, hist-07 is
 *  not due yet. Every other history invoice is paid, once. */
const UNPAID = new Set(['demo-hist-06', 'demo-hist-07']);

async function pay(ref: string, company: Doc) {
  const invoice = await find('Sales Invoice', [['uniformai_ref', '=', ref], ['docstatus', '=', 1]]);
  if (!invoice || Number(invoice.outstanding_amount) <= 0) return;
  const mapped = await call<Doc>('erpnext.accounts.doctype.payment_entry.payment_entry.get_payment_entry',
    { dt: 'Sales Invoice', dn: invoice.name });
  const paid = plus(String(invoice.posting_date), 14);
  const day = paid > TODAY ? TODAY : paid;
  const entry = await submit(await create('Payment Entry', {
    ...mapped,
    paid_to: mapped.paid_to || company.default_cash_account,
    posting_date: day, reference_no: ref, reference_date: day,
  }));
  console.log(`${ref}: payment ${entry.name}`);
}
```

In `seed()`, after the chain loop:

```ts
  for (const c of HISTORY) if (!UNPAID.has(c.ref)) await pay(c.ref, company);
```

- [ ] **Step 3: Reset removes size runs, cases and what the app made**

Replace the first half of `reset` (up to the stock comment) with:

```ts
async function reset(stock: Awaited<ReturnType<typeof masters>>, company: string) {
  const refs = CURRENT.map((c) => c.ref);
  // Rehearsals leave app- documents behind (the mapping copies the ref onto
  // the order, delivery and invoice). They go too, so every run starts clean.
  const byRefs = async (doctype: string) => {
    const found = [
      ...await list(doctype, [['uniformai_ref', 'in', refs]], ['name', 'docstatus']),
      ...await list(doctype, [['uniformai_ref', 'like', 'app-%']], ['name', 'docstatus']),
    ];
    return [...new Map(found.map((doc) => [doc.name, doc])).values()];
  };
  // A size run links to its order and would block deleting it.
  const orders = (await byRefs('Sales Order')).map((o) => o.name);
  if (orders.length) {
    for (const run of await list(SIZE_RUN, [['sales_order', 'in', orders]])) {
      await remove(SIZE_RUN, run.name);
      console.log(`reset: removed size run ${run.name}`);
    }
  }
  // Only the assistant's tagged cases are disposable. Staff-created BrainWise
  // cases are account history and must survive a rehearsal reset.
  for (const issue of await list('Issue', [
    ['customer', '=', BRAINWISE], ['subject', 'like', '[UniformAI assistant]%'],
  ])) {
    await remove('Issue', issue.name);
    console.log(`reset: removed case ${issue.name}`);
  }
  for (const doctype of ['Sales Invoice', 'Delivery Note', 'Sales Order', 'Quotation']) {
    for (const doc of await byRefs(doctype)) {
      await discard(doctype, doc);
      console.log(`reset: removed ${doctype} ${doc.name}`);
    }
  }
```

Keep the stock reconciliation part unchanged. `seed()` needs no other change: the `pay` loop from Step 2 uses `company`, which is already the `find('Company', [])` result with every field, `default_cash_account` included.

Update the header usage line for `--reset` to: `put the demo orders, stock, size runs, assistant-created cases and everything the app made back to the starting point, then seed`.

- [ ] **Step 4: Run and verify**

Run: `npm run seed:erp -- --reset`
Expected: `created DocType UniformAI Size Run` (first run only), `demo-hist-01: payment …` through `demo-hist-05` (first run only), exit 0. A second `npm run seed:erp -- --reset` prints no payment lines.

Before the first reset check, create one manual BrainWise Issue with a subject that does not start `[UniformAI assistant]`. After reset, verify that it remains while an assistant-created Issue is gone. Also verify that no `app-%` Quotation, Sales Order, Delivery Note or Sales Invoice remains at any `docstatus`.

Then:

```bash
set -a; . ./.env.local; set +a
curl -s -G -H "Authorization: token $ERP_READ_KEY" "$ERP_URL/api/resource/Sales%20Invoice" \
  --data-urlencode 'fields=["uniformai_ref","outstanding_amount","due_date"]' \
  --data-urlencode 'filters=[["customer","=","BrainWise Technology"],["docstatus","=",1]]'
curl -s -H "Authorization: token $ERP_READ_KEY" "$ERP_URL/api/resource/UniformAI%20Size%20Run"
```

Expected: seven invoices; outstanding 0 for hist-01..05; hist-06 outstanding > 0 with a due date before today; hist-07 outstanding > 0 with a due date after today. The second curl answers `{"data":[]}`.

If `get_payment_entry` fails on a missing account, set the company's Default Cash Account in ERPNext (Company > Accounts) and rerun; note what you set in this step.

- [ ] **Step 5: Commit**

```bash
git add scripts/seed-erp.ts
git commit -F - <<'EOF'
Seed the Size Run doctype, contact cases and paid history; reset clears size runs, cases and app orders

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 3: Server reads: size runs in the order state, quotation detail, invoices

**Files:**
- Create: `lib/quote-view.ts`, `lib/invoices.ts`, `lib/fetch-mock.ts`, `app/api/quotes/[name]/route.ts`, `app/api/invoices/route.ts`
- Modify: `lib/orders.ts` (`toOrders`), `lib/sales.ts` (`listOrders`, new `SIZE_RUN`, `quoteDetail`, `listInvoices`)
- Test: `lib/sales-reads.test.ts`

**Interfaces:**
- Consumes: `list`, `get`, `ErpError` from `lib/erp.ts`; `MTO_ITEM`, `LOGO_ITEM` from `lib/orders.ts`.
- Produces:
  - `toOrders(quotes, orders, deliveries, sized: ReadonlySet<string> = new Set())`: a submitted order in `sized` is `in_progress`.
  - `SIZE_RUN = 'UniformAI Size Run'` (exported from `lib/sales.ts`).
  - `lib/quote-view.ts`: `type QuoteLine = { kind: 'garment'; garment: GarmentType; qty: number; rate: number; amount: number } | { kind: 'branding'; method: LogoMethod; qty; rate; amount } | { kind: 'other'; qty; rate; amount }`; `type QuoteView = { name: string; validTill: string | null; lines: QuoteLine[]; sets: number; discountPct: number; total: number }`; `toQuoteView(doc: Record<string, unknown>): QuoteView`.
  - `lib/invoices.ts`: `type InvoiceStatus = 'paid' | 'unpaid' | 'overdue'`; `type Invoice = { name: string; date: string; due: string; total: number; outstanding: number; status: InvoiceStatus }`; `toInvoice(row: InvoiceRow, today: string): Invoice`.
  - `quoteDetail(name: string): Promise<QuoteView>` (404 unless the customer's and issued); `listInvoices(): Promise<Invoice[]>` (newest first).
  - `lib/fetch-mock.ts`: `mockErp(routes: Record<string, (s: Seen) => unknown>): { seen: Seen[]; posts(): Seen[] }`.
  - `GET /api/quotes/[name]` → `QuoteView`; `GET /api/invoices` → `Invoice[]`.

- [ ] **Step 1: The test-only fetch stub**

```ts
// lib/fetch-mock.ts
// Test-only: answers the ERP client's fetch from a table of path prefixes
// (longest match wins) and records every call. Unmatched paths answer 404.

export type Seen = { url: URL; init?: RequestInit };

export function mockErp(routes: Record<string, (s: Seen) => unknown>) {
  process.env.ERP_URL = 'http://uniform.localhost:8000';
  process.env.ERP_READ_KEY = 'reader:secret';
  process.env.ERP_WRITE_KEY = 'portal:secret';
  const seen: Seen[] = [];
  const keys = Object.keys(routes).sort((a, b) => b.length - a.length);
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const s = { url, init };
    seen.push(s);
    const key = keys.find((k) => decodeURIComponent(url.pathname).startsWith(k));
    if (!key) return new Response('{}', { status: 404 });
    const out = routes[key](s);
    return out instanceof Response ? out : new Response(JSON.stringify(out), { status: 200 });
  }) as typeof fetch;
  return { seen, posts: () => seen.filter((x) => x.init?.method === 'POST') };
}
```

- [ ] **Step 2: Write the failing test**

```ts
// lib/sales-reads.test.ts
// Run: npx tsx lib/sales-reads.test.ts
import assert from 'node:assert/strict';
import { CONCEPTS } from './concepts';
import { mockErp } from './fetch-mock';
import { toInvoice } from './invoices';
import { toQuoteView } from './quote-view';
import { listInvoices, listOrders, quoteDetail } from './sales';

const kit = { concept: CONCEPTS[0], staff: 10, sets: 11, grades: [], sizePlan: { mode: 'collect_later', allocation: {} } };
const QTN = { name: 'SAL-QTN-1', party_name: 'BrainWise Technology', status: 'Ordered', docstatus: 1,
  transaction_date: '2026-09-20', grand_total: 7150, uniformai_kit: JSON.stringify(kit) };
const SO = { name: 'SAL-ORD-1', customer: 'BrainWise Technology', status: 'To Deliver and Bill', docstatus: 1,
  transaction_date: '2026-09-21', delivery_date: '2026-10-12', per_delivered: 0, grand_total: 7150,
  uniformai_kit: JSON.stringify(kit), prevdoc_docname: 'SAL-QTN-1' };
const chain = (runs?: { sales_order: string }[]) => ({
  '/api/resource/Quotation': () => ({ data: [QTN] }),
  '/api/resource/Sales Order': () => ({ data: [SO] }),
  '/api/resource/Delivery Note': () => ({ data: [] }),
  ...(runs ? { '/api/resource/UniformAI Size Run': () => ({ data: runs }) } : {}),
});

async function main() {
  // 1. A site without the Size Run doctype (404) still lists orders.
  mockErp(chain());
  assert.equal((await listOrders())[0].state, 'collecting_sizes');

  // 2. A size run on record moves the order to In progress.
  mockErp(chain([{ sales_order: 'SAL-ORD-1' }]));
  assert.equal((await listOrders())[0].state, 'in_progress');

  // 3. The quotation view carries names and money only.
  const doc = {
    name: 'SAL-QTN-2', party_name: 'BrainWise Technology', docstatus: 1, valid_till: '2026-10-27',
    terms: 'staff terms', additional_discount_percentage: 5, grand_total: 27451.2, rounded_total: 27451,
    items: [
      { item_code: 'UA-MTO-POLO', qty: 42, rate: 300, amount: 12600, description: 'Internal: rush' },
      { item_code: 'UA-EMBROIDERY', qty: 42, rate: 40, amount: 1680, description: 'left chest' },
    ],
  };
  const view = toQuoteView(doc);
  assert.deepEqual(view.lines.map((l) => (l.kind === 'garment' ? l.garment : l.kind)), ['polo', 'branding']);
  assert.equal(view.sets, 42);
  assert.equal(view.discountPct, 5);
  assert.equal(view.total, 27451);
  for (const leak of [/UA-/, /Internal/, /terms/, /description/, /party_name/]) {
    assert.doesNotMatch(JSON.stringify(view), leak);
  }

  // 4. Another customer's, or a draft, quotation reads as not found.
  for (const over of [{ party_name: 'Delta Hotels' }, { docstatus: 0 }]) {
    mockErp({ '/api/resource/Quotation/': () => ({ data: { ...doc, ...over } }) });
    await assert.rejects(quoteDetail('SAL-QTN-2'), { status: 404 });
  }
  mockErp({ '/api/resource/Quotation/': () => ({ data: doc }) });
  assert.equal((await quoteDetail('SAL-QTN-2')).total, 27451);

  // 5. Invoice status comes from what is owed and the due day.
  const row = { name: 'INV-1', posting_date: '2026-08-27', due_date: '2026-09-26', grand_total: 9000 };
  assert.equal(toInvoice({ ...row, outstanding_amount: 0 }, '2026-09-29').status, 'paid');
  assert.equal(toInvoice({ ...row, outstanding_amount: 9000 }, '2026-09-29').status, 'overdue');
  assert.equal(toInvoice({ ...row, outstanding_amount: 9000 }, '2026-09-20').status, 'unpaid');
  assert.equal(toInvoice({ ...row, outstanding_amount: 9000 }, '2026-09-26').status, 'unpaid', 'due today is not late');

  const erp = mockErp({ '/api/resource/Sales Invoice': () => ({ data: [{ ...row, outstanding_amount: 0 }] }) });
  const invoices = await listInvoices();
  assert.equal(invoices[0].status, 'paid');
  const filters = erp.seen[0].url.searchParams.get('filters') ?? '';
  assert.match(filters, /BrainWise Technology/);
  assert.match(filters, /is_return/);

  console.log('sales-reads: all assertions passed');
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx tsx lib/sales-reads.test.ts`
Expected: FAIL, cannot find module `./invoices`.

- [ ] **Step 4: Implement the pure modules**

```ts
// lib/invoices.ts
// An invoice as the customer sees it. Paid / Unpaid / Overdue come from what
// is still owed and the due day, never ERPNext's stored status, which only
// moves when its scheduler runs.

export type InvoiceStatus = 'paid' | 'unpaid' | 'overdue';
export type Invoice = { name: string; date: string; due: string; total: number; outstanding: number; status: InvoiceStatus };
export type InvoiceRow = {
  name: string; posting_date: string; due_date?: string | null; grand_total: number; outstanding_amount: number;
};

export function toInvoice(r: InvoiceRow, today: string): Invoice {
  const outstanding = Number(r.outstanding_amount) || 0;
  const due = r.due_date || r.posting_date;
  return {
    name: r.name, date: r.posting_date, due, total: Number(r.grand_total) || 0, outstanding,
    status: outstanding <= 0 ? 'paid' : due < today ? 'overdue' : 'unpaid',
  };
}
```

```ts
// lib/quote-view.ts
// What the customer may see of an issued quotation, built field by field:
// garments and branding by name, quantities, discount and total. Never item
// codes, descriptions, terms or internal fields.

import type { GarmentType, LogoMethod } from './spec';
import { LOGO_ITEM, MTO_ITEM } from './orders';

type Money = { qty: number; rate: number; amount: number };
export type QuoteLine =
  | ({ kind: 'garment'; garment: GarmentType } & Money)
  | ({ kind: 'branding'; method: LogoMethod } & Money)
  | ({ kind: 'other' } & Money);
export type QuoteView = {
  name: string; validTill: string | null; lines: QuoteLine[]; sets: number; discountPct: number; total: number;
};

const GARMENT = Object.fromEntries(Object.entries(MTO_ITEM).map(([g, code]) => [code, g])) as Record<string, GarmentType>;
const LOGO = Object.fromEntries(Object.entries(LOGO_ITEM).map(([m, code]) => [code, m])) as Record<string, LogoMethod>;
const n = (v: unknown) => Number(v) || 0;

export function toQuoteView(doc: Record<string, unknown>): QuoteView {
  const items = Array.isArray(doc.items) ? doc.items as Record<string, unknown>[] : [];
  const lines: QuoteLine[] = items.map((i) => {
    const money = { qty: n(i.qty), rate: n(i.rate), amount: n(i.amount) || n(i.qty) * n(i.rate) };
    const code = String(i.item_code ?? '');
    if (GARMENT[code]) return { kind: 'garment', garment: GARMENT[code], ...money };
    if (LOGO[code]) return { kind: 'branding', method: LOGO[code], ...money };
    return { kind: 'other', ...money };
  });
  return {
    name: String(doc.name),
    validTill: typeof doc.valid_till === 'string' ? doc.valid_till : null,
    lines,
    sets: lines.find((l) => l.kind === 'garment')?.qty ?? 0,
    discountPct: n(doc.additional_discount_percentage),
    total: n(doc.rounded_total) || n(doc.grand_total),
  };
}
```

- [ ] **Step 5: Size runs in `toOrders` and `listOrders`; the two reads**

`lib/orders.ts`: change the signature and the order-state line:

```ts
export function toOrders(
  quotes: QuoteRow[], orders: SalesOrderRow[], deliveries: DeliveryRow[],
  /** Sales Orders with a size run on record: their sizes are complete. */
  sized: ReadonlySet<string> = new Set(),
): Order[] {
```

```ts
        : sizesComplete(kit) || sized.has(o.name) ? 'in_progress' : 'collecting_sizes';
```

`lib/sales.ts`: change the erp import to `import { ErpError, call, get, insert, list } from './erp';`, add the imports `import { type Invoice, type InvoiceRow, toInvoice } from './invoices';`, `import { type QuoteView, toQuoteView } from './quote-view';` and `import { SIZES } from './spec';`, then:

```ts
export const SIZE_RUN = 'UniformAI Size Run';

type StoredRun = { sales_order: string; allocation: string };

/** Stored runs are only evidence that sizes are complete when every cut and
 *  size belongs to the order, counts are non-negative integers, and the total
 *  matches the order. */
function storedRunTotal(value: string, allowedCuts: ReadonlySet<string>): number | null {
  try {
    const cuts = JSON.parse(value) as unknown;
    if (!cuts || typeof cuts !== 'object' || Array.isArray(cuts)) return null;
    let total = 0;
    for (const [cut, sizes] of Object.entries(cuts)) {
      if (!allowedCuts.has(cut)) return null;
      if (!sizes || typeof sizes !== 'object' || Array.isArray(sizes)) return null;
      for (const [size, count] of Object.entries(sizes)) {
        if (!(SIZES as string[]).includes(size)) return null;
        if (!Number.isInteger(count) || (count as number) < 0) return null;
        total += count as number;
      }
    }
    return total;
  } catch { return null; }
}

/** Orders with stored size-run data. A site seeded before the doctype existed
 *  answers 403 or 404: that is "no runs yet", not an outage. */
async function sizeRuns(): Promise<StoredRun[]> {
  try {
    return await list<StoredRun>(SIZE_RUN, { fields: ['sales_order', 'allocation'], orderBy: 'creation desc', limit: 2000 });
  } catch (error) {
    if (error instanceof ErpError && (error.status === 403 || error.status === 404)) return [];
    throw error;
  }
}
```

In `listOrders`, add `sizeRuns()` as a fourth entry of the `Promise.all` (destructure `runs`), and end with. Rebuilding once is intentional: stored runs are validated against the set count read from the customer's order, and malformed/manual records do not advance its state.

```ts
  const base = toOrders(quotes, [...orders.values()], notes);
  const bySalesOrder = new Map(base.flatMap((o) => o.salesOrder ? [[o.salesOrder, o] as const] : []));
  const sized = new Set(runs.flatMap((run) => {
    const order = bySalesOrder.get(run.sales_order);
    if (!order?.concept) return [];
    const cuts = new Set(order.concept.cuts?.length ? order.concept.cuts : ['men', 'women']);
    return storedRunTotal(run.allocation, cuts) === order.sets ? [run.sales_order] : [];
  }));
  return toOrders(quotes, [...orders.values()], notes, sized);
```

Extend `lib/sales-live.test.ts` with two Size Run fixtures for the same confirmed order: malformed JSON (or a total one below `sets`) must leave it at `collecting_sizes`; a valid allocation using only that concept's cuts and `SIZES` must move it to `in_progress`.

Below `chainOf`:

```ts
/** An issued quotation of the customer's. Missing, another customer's and
 *  not yet issued all read as not found. */
export async function quoteDetail(name: string): Promise<QuoteView> {
  let doc: Record<string, unknown>;
  try {
    doc = await get<Record<string, unknown>>('Quotation', name);
  } catch (error) {
    if ((error as { status?: number }).status === 404) throw new SalesError('Quote not found', 404);
    throw error;
  }
  if (doc.party_name !== CUSTOMER || doc.docstatus !== 1) throw new SalesError('Quote not found', 404);
  return toQuoteView(doc);
}

/** The customer's submitted invoices, newest first, with a derived status. */
export async function listInvoices(): Promise<Invoice[]> {
  const rows = await list<InvoiceRow>('Sales Invoice', {
    fields: ['name', 'posting_date', 'due_date', 'grand_total', 'outstanding_amount'],
    filters: [['customer', '=', CUSTOMER], ['docstatus', '=', 1], ['is_return', '=', 0]],
    orderBy: 'posting_date desc', limit: 50,
  });
  const today = isoDay();
  return rows.map((r) => toInvoice(r, today));
}
```

- [ ] **Step 6: The routes**

```ts
// app/api/quotes/[name]/route.ts
import { quoteDetail } from '@/lib/sales';
import { salesFailure } from '@/lib/sales-http';

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  try {
    const { name } = await params;
    return Response.json(await quoteDetail(name));
  } catch (error) {
    return salesFailure(error);
  }
}
```

```ts
// app/api/invoices/route.ts
import { listInvoices } from '@/lib/sales';
import { salesFailure } from '@/lib/sales-http';

export async function GET() {
  try {
    return Response.json(await listInvoices());
  } catch (error) {
    return salesFailure(error);
  }
}
```

- [ ] **Step 7: Run the tests and a live read**

Run: `npm test && npx tsc --noEmit`
Expected: all pass (the existing `sales.test.ts` and `ask.test.ts` stubs answer 404 for the Size Run read, which now means "no runs"). If a stub counts calls (`seen.length`), bump its expected count by one and say so in the commit.

Then: `curl -s http://127.0.0.1:3100/api/invoices` shows seven invoices with `paid`, one `overdue`, one `unpaid`; `curl -s http://127.0.0.1:3100/api/quotes/<the Technicians SAL-QTN from /api/orders>` shows `discountPct: 5` and no `UA-`.

- [ ] **Step 8: Commit**

```bash
git add lib/fetch-mock.ts lib/invoices.ts lib/quote-view.ts lib/orders.ts lib/sales.ts lib/sales-reads.test.ts app/api/quotes/[name]/route.ts app/api/invoices/route.ts
git commit -F - <<'EOF'
Read size runs into the order state, and serve a customer-safe quotation view and invoices

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 4: Server writes: the size run and the contact case

**Files:**
- Create: `lib/size-run.ts`, `app/api/orders/[name]/sizes/route.ts`, `app/api/contact/route.ts`
- Modify: `lib/sales.ts` (`sendSizes`, `openCase`)
- Test: `lib/sales-writes.test.ts`

**Interfaces:**
- Consumes: Task 3's `SIZE_RUN`, `listOrders`, `mockErp`; `SIZES`, `SizeAllocation`, `GarmentCut`, `GarmentSize`, `Concept` from `lib/spec.ts`.
- Produces:
  - `lib/size-run.ts` (browser-safe): `cutsOf(concept?: Concept): GarmentCut[]`; `runTotal(run: SizeAllocation): number`; `parseRun(input: unknown, cuts: GarmentCut[], sets: number): SizeAllocation | null`; `proposedSplit(cuts: GarmentCut[], sets: number): SizeAllocation`.
  - `sendSizes(name: string, input: unknown): Promise<Order>`: 404 not the customer's order, 409 not collecting sizes, 400 bad run.
  - `type Topic = 'general' | 'order' | 'billing'` (exported from `lib/sales.ts`); `openCase(input: unknown): Promise<{ name: string }>`; body `{ topic, document? }`.
  - `POST /api/orders/[name]/sizes` body `{ allocation }` → `Order`; `POST /api/contact` → 201 `{ name }`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/sales-writes.test.ts
// Run: npx tsx lib/sales-writes.test.ts
import assert from 'node:assert/strict';
import { CONCEPTS } from './concepts';
import { mockErp } from './fetch-mock';
import { openCase, sendSizes } from './sales';
import { parseRun, proposedSplit, runTotal } from './size-run';

const kit = { concept: CONCEPTS[0], staff: 10, sets: 11, grades: [], sizePlan: { mode: 'collect_later', allocation: {} } };
const QTN = { name: 'SAL-QTN-1', party_name: 'BrainWise Technology', status: 'Ordered', docstatus: 1,
  transaction_date: '2026-09-20', grand_total: 7150, uniformai_kit: JSON.stringify(kit) };
const SO = { name: 'SAL-ORD-1', customer: 'BrainWise Technology', status: 'To Deliver and Bill', docstatus: 1,
  transaction_date: '2026-09-21', delivery_date: '2026-10-12', per_delivered: 0, grand_total: 7150,
  uniformai_kit: JSON.stringify(kit), prevdoc_docname: 'SAL-QTN-1' };
const auth = (init?: RequestInit) => (init?.headers as Record<string, string>).Authorization;

/** The order chain, plus whatever the size-run and Issue endpoints do. */
function erp(extra: Record<string, (s: { init?: RequestInit }) => unknown> = {}) {
  let recorded = false;
  return mockErp({
    '/api/resource/Quotation': () => ({ data: [QTN] }),
    '/api/resource/Sales Order': () => ({ data: [SO] }),
    '/api/resource/Delivery Note': () => ({ data: [] }),
    '/api/resource/UniformAI Size Run': (s) => {
      if (s.init?.method === 'POST') { recorded = true; return { data: { name: 'SIZE-RUN-00001' } }; }
      return { data: recorded ? [{ sales_order: 'SAL-ORD-1' }] : [] };
    },
    ...extra,
  });
}

async function main() {
  // 1. Pure helpers.
  const split = proposedSplit(['men', 'women'], 26);
  assert.equal(runTotal(split), 26);
  assert.deepEqual(split.men, { M: 4, L: 3, S: 3, XL: 3 });
  assert.deepEqual(parseRun(split, ['men', 'women'], 26), split);
  assert.equal(parseRun(split, ['men', 'women'], 25), null, 'must add up to the order');
  assert.equal(parseRun({ kids: { M: 26 } }, ['men', 'women'], 26), null, 'unknown cut');
  assert.equal(parseRun({ men: { M: 2.5 } }, ['men'], 2.5), null, 'whole sets only');
  assert.equal(parseRun({ men: { XXL: 26 } }, ['men'], 26), null, 'unknown size');

  // 2. A run that does not add up is refused before anything is written.
  let x = erp();
  await assert.rejects(sendSizes('SAL-ORD-1', { men: { M: 5 }, women: { M: 5 } }), { status: 400 });
  assert.equal(x.posts().length, 0);

  // 3. Not the customer's order.
  x = erp();
  await assert.rejects(sendSizes('SAL-ORD-9', proposedSplit(['men', 'women'], 11)), { status: 404 });
  assert.equal(x.posts().length, 0);

  // 4. A complete run is recorded with the Portal key and the order moves on.
  x = erp();
  const order = await sendSizes('SAL-ORD-1', proposedSplit(['men', 'women'], 11));
  const [post] = x.posts();
  assert.equal(auth(post.init), 'token portal:secret');
  const body = JSON.parse(String(post.init!.body));
  assert.equal(body.sales_order, 'SAL-ORD-1');
  assert.equal(runTotal(JSON.parse(body.allocation)), 11);
  assert.equal(order.state, 'in_progress');

  // 5. Once sizes are in, a second run is refused.
  await assert.rejects(sendSizes('SAL-ORD-1', proposedSplit(['men', 'women'], 11)), { status: 409 });

  // 6. Contact: bad topic, someone else's document, then a real case.
  const issue = { '/api/resource/Issue': () => ({ data: { name: 'CASE-2026-00001' } }) };
  x = erp(issue);
  await assert.rejects(openCase({ topic: 'gossip' }), { status: 400 });
  await assert.rejects(openCase({ topic: 'order', document: 'SAL-ORD-9' }), { status: 404 });
  assert.equal(x.posts().length, 0);
  assert.deepEqual(await openCase({ topic: 'order', document: 'SAL-ORD-1' }), { name: 'CASE-2026-00001' });
  const caseDoc = JSON.parse(String(x.posts()[0].init!.body));
  assert.equal(caseDoc.customer, 'BrainWise Technology');
  assert.equal(caseDoc.raised_by, 'ahmed.osama@brainwise.example');
  assert.equal(caseDoc.via_customer_portal, 0);
  assert.match(caseDoc.subject, /^\[UniformAI assistant\]/);
  assert.match(caseDoc.subject, /SAL-ORD-1/);
  assert.deepEqual(await openCase({ topic: 'general' }), { name: 'CASE-2026-00001' });

  console.log('sales-writes: all assertions passed');
}

main().catch((e) => { console.error(e); process.exit(1); });
```

Also add a same-tick concurrency assertion: hold the first Size Run insert promise open, call `sendSizes` again for that order, and assert the second call rejects with 409 and the fetch stub records only one POST. This covers the server lock independently of the React click guard.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx lib/sales-writes.test.ts`
Expected: FAIL, cannot find module `./size-run`.

- [ ] **Step 3: Implement `lib/size-run.ts`**

```ts
// lib/size-run.ts
// The size breakdown a customer sends for a confirmed order. Pure, so the
// dock's form and the server share one rule.

import { type Concept, type GarmentCut, type GarmentSize, type SizeAllocation, SIZES } from './spec';

export const cutsOf = (concept?: Concept): GarmentCut[] =>
  concept?.cuts?.length ? concept.cuts : ['men', 'women'];

export const runTotal = (run: SizeAllocation): number =>
  Object.values(run).reduce((n, sizes) => n + Object.values(sizes ?? {}).reduce((m, v) => m + (v ?? 0), 0), 0);

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Only the order's cuts and known sizes, whole counts, adding up to the
 *  order's sets. Anything else is null. */
export function parseRun(input: unknown, cuts: GarmentCut[], sets: number): SizeAllocation | null {
  if (!isObject(input)) return null;
  const run: SizeAllocation = {};
  for (const [cut, sizes] of Object.entries(input)) {
    if (!cuts.includes(cut as GarmentCut) || !isObject(sizes)) return null;
    const clean: Partial<Record<GarmentSize, number>> = {};
    for (const [size, n] of Object.entries(sizes)) {
      if (!(SIZES as string[]).includes(size) || !Number.isInteger(n) || (n as number) < 0) return null;
      if (n) clean[size as GarmentSize] = n as number;
    }
    run[cut as GarmentCut] = clean;
  }
  return runTotal(run) === sets ? run : null;
}

/** An even starting point over S to XL of each cut, any remainder to M,
 *  then L, so the customer adjusts rather than taps from zero. */
export function proposedSplit(cuts: GarmentCut[], sets: number): SizeAllocation {
  const order: GarmentSize[] = ['M', 'L', 'S', 'XL'];
  const run: SizeAllocation = {};
  cuts.forEach((cut, i) => {
    const share = Math.floor(sets / cuts.length) + (i < sets % cuts.length ? 1 : 0);
    run[cut] = Object.fromEntries(order.map((z, j) => [z, Math.floor(share / 4) + (j < share % 4 ? 1 : 0)]));
  });
  return run;
}
```

- [ ] **Step 4: Implement `sendSizes` and `openCase` in `lib/sales.ts`**

Add `import { cutsOf, parseRun } from './size-run';`, then below `listInvoices`:

```ts
// ---- size run and contact --------------------------------------------------

const findOrder = async (name: string) => (await listOrders()).find((o) => o.salesOrder === name);
const recordingSizes = new Set<string>();

/** Record the customer's size run for a confirmed order. Insert-only: the
 *  Sales Order itself is never written. */
export async function sendSizes(name: string, input: unknown): Promise<Order> {
  if (recordingSizes.has(name)) throw new SalesError('Sizes are already being recorded', 409);
  recordingSizes.add(name);
  try {
    const order = await findOrder(name);
    if (!order) throw new SalesError('Order not found', 404);
    if (order.state !== 'collecting_sizes') throw new SalesError('This order is not waiting for sizes', 409);
    const run = parseRun(input, cutsOf(order.concept), order.sets);
    if (!run) throw bad('size run');
    await insert(SIZE_RUN, { sales_order: name, allocation: JSON.stringify(run) }, 'write');
    return (await findOrder(name)) ?? order;
  } finally {
    recordingSizes.delete(name);
  }
}

export const TOPICS = ['general', 'order', 'billing'] as const;
export type Topic = typeof TOPICS[number];
const ABOUT: Record<Topic, string> = { general: 'a general question', order: 'an order', billing: 'billing' };
const CUSTOMER_EMAIL = 'ahmed.osama@brainwise.example'; // seeded primary contact

/** Contact our team: one Issue for the team, about one of the customer's own
 *  documents or a topic. The transcript is never sent. */
export async function openCase(input: unknown): Promise<{ name: string }> {
  if (!isObject(input) || !TOPICS.includes(input.topic as Topic)) throw bad('request');
  const topic = input.topic as Topic;
  const doc = input.document;
  if (doc !== undefined) {
    const mine = typeof doc === 'string' && (await listOrders()).some((o) => o.quote === doc || o.salesOrder === doc);
    if (!mine) throw new SalesError('Order not found', 404);
  }
  const about = typeof doc === 'string' ? doc : ABOUT[topic];
  const created = await insert<{ name: string }>('Issue', {
    subject: `[UniformAI assistant] Please contact ${CUSTOMER} about ${about}`,
    customer: CUSTOMER,
    raised_by: CUSTOMER_EMAIL,
    via_customer_portal: 0,
    description: `Asked from the UniformAI assistant. Topic: ${topic}.${typeof doc === 'string' ? ` Document: ${doc}.` : ''}`,
  }, 'write');
  return { name: created.name };
}
```

- [ ] **Step 5: The routes**

```ts
// app/api/orders/[name]/sizes/route.ts
import { sendSizes } from '@/lib/sales';
import { salesFailure } from '@/lib/sales-http';

export async function POST(request: Request, { params }: { params: Promise<{ name: string }> }) {
  let body: { allocation?: unknown };
  try {
    body = await request.json() as typeof body;
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }
  try {
    const { name } = await params;
    return Response.json(await sendSizes(name, body?.allocation), { status: 201 });
  } catch (error) {
    return salesFailure(error);
  }
}
```

```ts
// app/api/contact/route.ts
import { openCase } from '@/lib/sales';
import { salesFailure } from '@/lib/sales-http';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }
  try {
    return Response.json(await openCase(body), { status: 201 });
  } catch (error) {
    return salesFailure(error);
  }
}
```

- [ ] **Step 6: Run the tests and one live case**

Run: `npm test && npx tsc --noEmit`
Expected: all pass.

Then: `curl -s -X POST http://127.0.0.1:3100/api/contact -H 'content-type: application/json' -d '{"topic":"general"}'`
Expected: `{"name":"CASE-2026-…"}`. It shows in ERPNext under Support > Issue. `npm run seed:erp -- --reset` removes it.

- [ ] **Step 7: Commit**

```bash
git add lib/size-run.ts lib/sales.ts lib/sales-writes.test.ts app/api/orders/[name]/sizes/route.ts app/api/contact/route.ts
git commit -F - <<'EOF'
Record a customer's size run and open a contact case, both insert-only for the Portal user

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 5: The account-manager copy, English and formal Arabic

**Files:**
- Modify: `lib/i18n.ts` (a `journey` block in `en` after `erpAsk`, and the same in `ar`)
- Test: `lib/i18n.test.ts` (existing: key parity, Arabic script, placeholder parity)

**Interfaces:**
- Consumes: nothing.
- Produces: every `journey.*` key Tasks 6–8 use. Placeholders: `{id}`, `{quote}`, `{total}`, `{sets}`, `{people}`, `{spare}`, `{min}`, `{price}`, `{date}`, `{pct}`, `{run}`, `{done}`, `{left}`, `{count}`, `{status}`, `{qty}`, `{rate}`.

- [ ] **Step 1: Add the English block** (in `en`, after the closing `},` of `erpAsk`)

```ts
  journey: {
    hello: 'Good day, Mr. Ahmed. What can I help you with today?',
    again: 'Is there anything else I can help with?',
    more: 'Of course. What would you like to look at?',
    team: 'Of course. Which team are we dressing?',
    people: 'How many people will wear this uniform?',
    peopleEcho: '{count} people.',
    plan: 'For {people} people I recommend {sets} sets, which leaves {spare} for replacements and new starters. The estimate is {price}, before our team reviews it.',
    planMoq: 'Our minimum for a made-to-order uniform is {min} sets, so for {people} people I recommend {sets} sets; the other {spare} serve as spares. The estimate is {price}, before our team reviews it.',
    stage: {
      quote_requested: 'I have sent quotation {quote} to our team for review. We normally confirm the price within one working day.',
      quote_ready: 'Quotation {quote} is ready for your review: {total} for {sets} sets. Would you like to review the details or approve it?',
      quote_closed: 'Quotation {quote} is no longer open, so I cannot approve that price. Our team can prepare a new one at today\'s prices.',
      awaiting: 'I have received your approval. Order {id} is now with our team for confirmation.',
      collecting_sizes: 'Your order {id} is confirmed. I need sizes for all {sets} sets before our production team can continue.',
      in_progress: 'Everything we need from you is complete. Order {id} is in progress, with delivery expected on {date}.',
      in_progress_part: 'Order {id} is being delivered: {pct}% has arrived so far, and the rest is expected by {date}.',
      delivered: 'All {sets} sets of order {id} were delivered on {date}.',
    },
    confirmApprove: 'Please confirm that you approve quotation {id} for {total}. Our team will then confirm the order.',
    quoteSent: 'Thank you, Mr. Ahmed. I have sent quotation {id} to our team for review. We normally confirm the price within one working day.',
    approved: 'Thank you. I have passed your approval to our team, and order {id} is now awaiting their confirmation.',
    sizesAsk: 'Please enter the sizes for order {id}: {sets} sets in total.',
    sizesLeft: '{done} assigned, {left} left.',
    confirmSizes: 'Please confirm the size run for {id}: {run}. It becomes the production plan for this order.',
    sizesSent: 'Thank you, Mr. Ahmed. I have received all {sets} sizes for {id}, and the order is now in progress.',
    cut: { men: 'Men', women: 'Women', unisex: 'Unisex' },
    contactAbout: 'I will ask the team to contact you about {id}.',
    contactBilling: 'I will ask our accounts team to contact you about your invoices.',
    contactGeneral: 'I will ask a member of our team to contact you to hear the details.',
    caseSent: 'Thank you. I have passed this to the team as {id}. Someone will contact you, normally within one working day.',
    invLatest: 'Your latest invoice, {id}, is {status}.',
    invNone: 'You have no unpaid invoices.',
    invOpen: 'Open invoices: {count}, with {total} outstanding in total.',
    invLate: 'Past due: {count}, the oldest since {date}.',
    invDue: 'Due {date}',
    invWord: { paid: 'paid', unpaid: 'not yet paid', overdue: 'past due' },
    inv: { paid: 'Paid', unpaid: 'Unpaid', overdue: 'Overdue' },
    noOrder: 'I could not find that order on your account.',
    failed: 'I can\'t reach your account records right now. Please try again in a moment.',
    quote: { title: 'Quotation {id}', other: 'Other item', each: '{qty} × {rate}', discount: 'Includes a {pct}% discount', total: 'Total', valid: 'Valid until {date}' },
    btnNew: 'Start a new uniform request', btnOrders: 'Check my quotations and orders', btnMore: 'More',
    btnMenu: 'Menu', btnInvoices: 'Invoices', btnStock: 'Check stock', btnPrice: 'Last price paid',
    btnContact: 'Ask the team to contact me', btnDiscuss: 'Discuss with our team', btnNotNow: 'Not now',
    btnReview: 'Review quotation {id}', btnSendSizes: 'Send sizes for {id}', btnApprove: 'Approve {total}',
    btnView: 'View quotation', btnShow: 'Show order', btnSizes: 'Enter the sizes', btnSendRun: 'Send the size run',
    btnAdjust: 'Adjust', btnRetry: 'Try again', btnRequest: 'Request a quotation for {sets} sets',
    btnChangePeople: 'Change the number', btnContinue: 'Continue', btnReviewRun: 'Review the size run',
    btnSplit: 'Use a proposed split',
  },
```

- [ ] **Step 2: Add the Arabic block** (in `ar`, after its `erpAsk`)

```ts
  journey: {
    hello: 'أهلًا بكم أستاذ أحمد. كيف يمكنني مساعدتكم اليوم؟',
    again: 'هل هناك ما يمكنني مساعدتكم فيه أيضًا؟',
    more: 'بكل سرور. ما الذي تودّون الاطلاع عليه؟',
    team: 'بكل سرور. لأي فريق نُعدّ الزي؟',
    people: 'كم عدد الموظفين الذين سيرتدون هذا الزي؟',
    peopleEcho: 'عدد الموظفين: {count}.',
    plan: 'لعدد {people} من الموظفين أوصي بـ {sets} من الأطقم، يبقى منها {spare} للاستبدال وللموظفين الجدد. التقدير المبدئي {price} قبل مراجعة فريقنا.',
    planMoq: 'الحد الأدنى للزي المصنوع حسب الطلب {min} من الأطقم، لذا أوصي لعدد {people} من الموظفين بـ {sets} من الأطقم، ويبقى {spare} منها احتياطيًا. التقدير المبدئي {price} قبل مراجعة فريقنا.',
    stage: {
      quote_requested: 'أرسلت عرض السعر {quote} إلى فريقنا للمراجعة، ونؤكد السعر عادةً خلال يوم عمل واحد.',
      quote_ready: 'عرض السعر {quote} جاهز لمراجعتكم: {total} مقابل {sets} من الأطقم. هل تودّون مراجعة التفاصيل أم الموافقة عليه؟',
      quote_closed: 'لم يعد عرض السعر {quote} مفتوحًا، لذا لا يمكنني اعتماد ذلك السعر. ويمكن لفريقنا إعداد عرض جديد بأسعار اليوم.',
      awaiting: 'استلمت موافقتكم، والطلب {id} الآن لدى فريقنا لتأكيده.',
      collecting_sizes: 'تم تأكيد طلبكم {id}. أحتاج إلى مقاسات الأطقم جميعها، وعددها {sets}، قبل أن يواصل فريق الإنتاج.',
      in_progress: 'اكتمل كل ما نحتاجه منكم. الطلب {id} قيد التنفيذ، والتسليم متوقع في {date}.',
      in_progress_part: 'يجري تسليم الطلب {id}: وصل {pct}% حتى الآن، والباقي متوقع بحلول {date}.',
      delivered: 'تم تسليم أطقم الطلب {id} جميعها، وعددها {sets}، في {date}.',
    },
    confirmApprove: 'أرجو تأكيد موافقتكم على عرض السعر {id} بقيمة {total}، ثم يؤكد فريقنا الطلب.',
    quoteSent: 'شكرًا لكم أستاذ أحمد. أرسلت عرض السعر {id} إلى فريقنا للمراجعة، ونؤكد السعر عادةً خلال يوم عمل واحد.',
    approved: 'شكرًا لكم. أحلت موافقتكم إلى فريقنا، والطلب {id} الآن بانتظار تأكيده.',
    sizesAsk: 'أرجو إدخال مقاسات الطلب {id}، وإجمالي الأطقم {sets}.',
    sizesLeft: 'تم توزيع {done}، ويتبقى {left}.',
    confirmSizes: 'أرجو تأكيد توزيع المقاسات للطلب {id}: {run}. وسيُعتمد خطةً للإنتاج في هذا الطلب.',
    sizesSent: 'شكرًا لكم أستاذ أحمد. استلمت مقاسات الطلب {id} كاملةً، وعددها {sets}، وأصبح الطلب قيد التنفيذ.',
    cut: { men: 'رجالي', women: 'نسائي', unisex: 'للجنسين' },
    contactAbout: 'سأطلب من الفريق التواصل معكم بشأن {id}.',
    contactBilling: 'سأطلب من فريق الحسابات التواصل معكم بشأن فواتيركم.',
    contactGeneral: 'سأطلب من أحد أعضاء فريقنا التواصل معكم للاستماع إلى التفاصيل.',
    caseSent: 'شكرًا لكم. أحلت الطلب إلى الفريق برقم مرجعي {id}، وسيتواصل معكم أحد أعضاء الفريق عادةً خلال يوم عمل واحد.',
    invLatest: 'فاتورتكم الأخيرة {id} {status}.',
    invNone: 'لا توجد لديكم فواتير غير مسدّدة.',
    invOpen: 'عدد الفواتير المفتوحة {count}، بإجمالي مستحق {total}.',
    invLate: 'منها {count} تجاوزت موعد استحقاقها، أقدمها منذ {date}.',
    invDue: 'تستحق في {date}',
    invWord: { paid: 'مسدّدة', unpaid: 'لم تُسدَّد بعد', overdue: 'تجاوزت موعد استحقاقها' },
    inv: { paid: 'مسدّدة', unpaid: 'غير مسدّدة', overdue: 'متأخرة' },
    noOrder: 'لم أجد هذا الطلب في حسابكم.',
    failed: 'يتعذّر عليّ الوصول إلى سجلات حسابكم الآن. أرجو المحاولة مرة أخرى بعد قليل.',
    quote: { title: 'عرض السعر {id}', other: 'بند آخر', each: '{qty} × {rate}', discount: 'يشمل خصمًا بنسبة {pct}%', total: 'الإجمالي', valid: 'ساري حتى {date}' },
    btnNew: 'بدء طلب زي جديد', btnOrders: 'عروض الأسعار والطلبات', btnMore: 'المزيد',
    btnMenu: 'القائمة', btnInvoices: 'الفواتير', btnStock: 'الاستعلام عن المخزون', btnPrice: 'آخر سعر مدفوع',
    btnContact: 'أرجو أن يتواصل معي الفريق', btnDiscuss: 'التحدث مع فريقنا', btnNotNow: 'ليس الآن',
    btnReview: 'مراجعة عرض السعر {id}', btnSendSizes: 'إرسال المقاسات للطلب {id}', btnApprove: 'الموافقة على {total}',
    btnView: 'عرض تفاصيل عرض السعر', btnShow: 'عرض الطلب', btnSizes: 'إدخال المقاسات', btnSendRun: 'إرسال توزيع المقاسات',
    btnAdjust: 'تعديل', btnRetry: 'المحاولة مرة أخرى', btnRequest: 'طلب عرض سعر لعدد {sets} من الأطقم',
    btnChangePeople: 'تغيير العدد', btnContinue: 'متابعة', btnReviewRun: 'مراجعة توزيع المقاسات',
    btnSplit: 'استخدام توزيع مقترح',
  },
```

- [ ] **Step 3: Run the i18n test**

Run: `npx tsx lib/i18n.test.ts`
Expected: `i18n: all assertions passed` (parity, Arabic script and placeholder checks cover the new block; `{qty} × {rate}` has no words to translate and passes the length rule).

- [ ] **Step 4: Commit**

```bash
git add lib/i18n.ts
git commit -F - <<'EOF'
Write the account manager's lines in English and formal Arabic

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 6: The conversation script (`lib/journey.ts`)

**Files:**
- Create: `lib/journey.ts`
- Test: `lib/journey.test.ts`

**Interfaces:**
- Consumes: `Order` (`lib/order.ts`), `Invoice` (Task 3), `plan`, `POLICY` (Task 1), `Topic` is redeclared here (browser-safe; same three values as `lib/sales.ts`), `sampleOrder` (`lib/order-fixture.ts`, tests only), Task 5's keys.
- Produces:
  - `type Topic = 'general' | 'order' | 'billing'`
  - `type Act = { k: 'menu' } | { k: 'more' } | { k: 'orders' } | { k: 'order'; id: string } | { k: 'show'; id: string } | { k: 'stock' } | { k: 'price' } | { k: 'invoices' } | { k: 'new' } | { k: 'people'; kit: string } | { k: 'plan'; kit: string; people: number } | { k: 'requestQuote'; kit: string; people: number; sets: number } | { k: 'viewQuote'; quote: string } | { k: 'approve'; quote: string; total: number } | { k: 'approveNow'; quote: string } | { k: 'sizes'; order: string } | { k: 'sendSizes'; order: string; run: SizeAllocation } | { k: 'contact'; topic: Topic; doc?: string } | { k: 'sendContact'; topic: Topic; doc?: string }`
  - `type Button = { label: string; act: Act; primary?: boolean }`; `type Turn = { say: string; buttons: Button[] }`
  - `menuTurn(locale, orders: Order[], again?: boolean)`, `moreTurn(locale)`, `teamTurn(locale)`, `planTurn(locale, kit: string, people: number)`, `orderTurn(locale, o: Order)`, `approveTurn(locale, quote: string, total: number)`, `sizeConfirmTurn(locale, o: Order, run: SizeAllocation)`, `contactTurn(locale, topic: Topic, doc?: string)`, `invoicesTurn(locale, invoices: Invoice[])`, `quoteSentTurn(locale, o)`, `approvedTurn(locale, o)`, `sizesSentTurn(locale, o)`, `caseTurn(locale, name: string)`, `failTurn(locale, retry: Act)`, `noOrderTurn(locale)`; all return `Turn`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/journey.test.ts
// Run: npx tsx lib/journey.test.ts
// One happy path per journey, in both languages, plus the voice rules every
// turn must keep: at most four buttons, no system words, no missing keys.
import assert from 'node:assert/strict';
import { CONCEPTS } from './concepts';
import { sampleOrder } from './order-fixture';
import type { Order, Workflow } from './order';
import type { Invoice } from './invoices';
import { LOCALES, type Locale } from './i18n';
import {
  type Turn, approveTurn, approvedTurn, caseTurn, contactTurn, failTurn, invoicesTurn, menuTurn, moreTurn,
  orderTurn, planTurn, quoteSentTurn, sizeConfirmTurn, sizesSentTurn, teamTurn,
} from './journey';

const QUOTE_STATES: Workflow[] = ['quote_requested', 'quote_ready', 'quote_closed'];
const order = (state: Workflow, over: Partial<Order> = {}): Order => ({
  ...sampleOrder(CONCEPTS[0], 40, 42, [], 650, new Date('2026-09-20T10:00:00'), state),
  quote: 'SAL-QTN-2026-00031',
  salesOrder: QUOTE_STATES.includes(state) ? undefined : 'SAL-ORD-2026-00011',
  ...over,
});
const invoices: Invoice[] = [
  { name: 'ACC-SINV-2026-00007', date: '2026-09-23', due: '2026-10-23', total: 8000, outstanding: 8000, status: 'unpaid' },
  { name: 'ACC-SINV-2026-00006', date: '2026-08-27', due: '2026-09-26', total: 9000, outstanding: 9000, status: 'overdue' },
  { name: 'ACC-SINV-2026-00005', date: '2026-07-30', due: '2026-08-29', total: 5000, outstanding: 0, status: 'paid' },
];

const all: Turn[] = [];
const keep = (turn: Turn) => { all.push(turn); return turn; };
const primary = (turn: Turn) => turn.buttons.find((b) => b.primary)?.act;

for (const locale of LOCALES as readonly Locale[]) {
  // Menu: the newest waiting action leads (orders arrive newest first).
  let turn = keep(menuTurn(locale, [order('quote_ready'), order('collecting_sizes')]));
  assert.deepEqual(primary(turn), { k: 'order', id: 'SAL-QTN-2026-00031' });
  turn = keep(menuTurn(locale, [order('collecting_sizes'), order('quote_ready')]));
  assert.deepEqual(primary(turn), { k: 'sizes', order: 'SAL-ORD-2026-00011' });
  assert.ok(turn.buttons.some((b) => b.act.k === 'more'));
  turn = keep(menuTurn(locale, [order('collecting_sizes')], true));
  assert.deepEqual(primary(turn), { k: 'sizes', order: 'SAL-ORD-2026-00011' });
  keep(moreTurn(locale));

  // 1. Request -> quote -> approve.
  turn = keep(teamTurn(locale));
  assert.deepEqual(turn.buttons.map((b) => b.act), CONCEPTS.map((c) => ({ k: 'people', kit: c.id })).slice(0, 4));
  turn = keep(planTurn(locale, 'technicians', 40));
  assert.deepEqual(primary(turn), { k: 'requestQuote', kit: 'technicians', people: 40, sets: 42 });
  turn = keep(planTurn(locale, 'technicians', 6));
  assert.deepEqual(primary(turn), { k: 'requestQuote', kit: 'technicians', people: 6, sets: 10 });
  keep(quoteSentTurn(locale, order('quote_requested')));
  turn = keep(orderTurn(locale, order('quote_requested')));
  assert.ok(!turn.buttons.some((b) => b.act.k === 'approve'), 'a draft quote is never approvable');
  turn = keep(orderTurn(locale, order('quote_ready')));
  assert.deepEqual(primary(turn), { k: 'approve', quote: 'SAL-QTN-2026-00031', total: 27300 });
  assert.ok(turn.buttons.some((b) => b.act.k === 'viewQuote'));
  turn = keep(approveTurn(locale, 'SAL-QTN-2026-00031', 27300));
  assert.deepEqual(primary(turn), { k: 'approveNow', quote: 'SAL-QTN-2026-00031' });
  turn = keep(approvedTurn(locale, order('awaiting')));
  assert.ok(turn.say.includes('SAL-ORD-2026-00011'));

  // 2. The team confirms; the order advances.
  keep(orderTurn(locale, order('awaiting')));
  keep(orderTurn(locale, order('quote_closed')));

  // 3. Sizes.
  turn = keep(orderTurn(locale, order('collecting_sizes')));
  assert.deepEqual(primary(turn), { k: 'sizes', order: 'SAL-ORD-2026-00011' });
  const run = { men: { M: 21 }, women: { S: 21 } };
  turn = keep(sizeConfirmTurn(locale, order('collecting_sizes'), run));
  assert.deepEqual(primary(turn), { k: 'sendSizes', order: 'SAL-ORD-2026-00011', run });
  keep(sizesSentTurn(locale, order('in_progress')));

  // 4. Delivery and invoices.
  keep(orderTurn(locale, order('in_progress')));
  keep(orderTurn(locale, order('in_progress', { perDelivered: 50 })));
  turn = keep(orderTurn(locale, order('delivered')));
  assert.ok(turn.buttons.some((b) => b.act.k === 'invoices'));
  turn = keep(invoicesTurn(locale, invoices));
  assert.ok(turn.say.includes('ACC-SINV-2026-00007'));
  keep(invoicesTurn(locale, [invoices[2]]));

  // 5. Contact our team.
  turn = keep(contactTurn(locale, 'order', 'SAL-ORD-2026-00011'));
  assert.deepEqual(primary(turn), { k: 'sendContact', topic: 'order', doc: 'SAL-ORD-2026-00011' });
  keep(contactTurn(locale, 'general'));
  turn = keep(caseTurn(locale, 'CASE-2026-00007'));
  assert.ok(turn.say.includes('CASE-2026-00007'));
  keep(failTurn(locale, { k: 'menu' }));
}

// English specifics a customer would read.
assert.match(planTurn('en', 'technicians', 6).say, /minimum .* 10 sets/);
assert.match(invoicesTurn('en', invoices).say, /not yet paid.*Open invoices: 2.*Past due: 1/);
assert.equal(invoicesTurn('en', [invoices[2]]).say, 'Your latest invoice, ACC-SINV-2026-00005, is paid. You have no unpaid invoices.');

// The voice rules, over every turn above.
for (const turn of all) {
  assert.ok(turn.buttons.length <= 4, `too many buttons: ${turn.say}`);
  assert.ok(turn.buttons.filter((b) => b.primary).length <= 1, `two primaries: ${turn.say}`);
  for (const text of [turn.say, ...turn.buttons.map((b) => b.label)]) {
    assert.ok(text.trim(), 'empty text');
    assert.doesNotMatch(text, /ERPNext|UA-|https?:|journey\.|\{\w+\}|Draft|To Deliver/, text);
  }
}

console.log('journey: all assertions passed');
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx lib/journey.test.ts`
Expected: FAIL, cannot find module `./journey`.

- [ ] **Step 3: Implement**

```ts
// lib/journey.ts
// The account manager's side of the conversation: from the customer's
// records to one turn, a sentence and at most four buttons. Each button
// names an Act; the dock runs it. Pure: no fetch and no React.

import type { Order } from './order';
import type { Invoice } from './invoices';
import { CONCEPTS } from './concepts';
import { type GarmentCut, type SizeAllocation, SIZES, conceptPriceAt } from './spec';
import { POLICY, plan } from './policy';
import { type Locale, formatCurrency, formatDate, kitName, t } from './i18n';

export type Topic = 'general' | 'order' | 'billing';
export type Act =
  | { k: 'menu' } | { k: 'more' } | { k: 'orders' } | { k: 'order'; id: string } | { k: 'show'; id: string }
  | { k: 'stock' } | { k: 'price' } | { k: 'invoices' }
  | { k: 'new' } | { k: 'people'; kit: string } | { k: 'plan'; kit: string; people: number }
  | { k: 'requestQuote'; kit: string; people: number; sets: number }
  | { k: 'viewQuote'; quote: string } | { k: 'approve'; quote: string; total: number } | { k: 'approveNow'; quote: string }
  | { k: 'sizes'; order: string } | { k: 'sendSizes'; order: string; run: SizeAllocation }
  | { k: 'contact'; topic: Topic; doc?: string } | { k: 'sendContact'; topic: Topic; doc?: string };
export type Button = { label: string; act: Act; primary?: boolean };
export type Turn = { say: string; buttons: Button[] };

const money = formatCurrency;
const day = (locale: Locale, iso: string) => formatDate(locale, new Date(`${iso}T12:00:00`));
const docOf = (o: Order) => o.salesOrder ?? o.quote ?? o.id;
const btn = (locale: Locale, key: string, act: Act, values?: Record<string, string | number>, primary = false): Button =>
  ({ label: t(locale, `journey.${key}`, values), act, ...(primary ? { primary } : {}) });
const discuss = (locale: Locale, doc: string) => btn(locale, 'btnDiscuss', { k: 'contact', topic: 'order', doc });

/** The newest thing waiting on the customer (orders arrive newest first):
 *  a quote to approve or sizes to send. */
function waiting(locale: Locale, orders: Order[]): Button | undefined {
  const o = orders.find((x) => (x.state === 'quote_ready' && x.quote) || (x.state === 'collecting_sizes' && x.salesOrder));
  if (!o) return undefined;
  return o.state === 'quote_ready'
    ? btn(locale, 'btnReview', { k: 'order', id: o.quote! }, { id: o.quote! }, true)
    : btn(locale, 'btnSendSizes', { k: 'sizes', order: o.salesOrder! }, { id: o.salesOrder! }, true);
}

export function menuTurn(locale: Locale, orders: Order[], again = false): Turn {
  const next = waiting(locale, orders);
  return {
    say: t(locale, again ? 'journey.again' : 'journey.hello'),
    buttons: [
      ...(next ? [next] : []),
      btn(locale, 'btnNew', { k: 'new' }),
      btn(locale, 'btnOrders', { k: 'orders' }),
      btn(locale, 'btnMore', { k: 'more' }),
    ],
  };
}

export const moreTurn = (locale: Locale): Turn => ({
  say: t(locale, 'journey.more'),
  buttons: [
    btn(locale, 'btnInvoices', { k: 'invoices' }),
    btn(locale, 'btnStock', { k: 'stock' }),
    btn(locale, 'btnPrice', { k: 'price' }),
    btn(locale, 'btnContact', { k: 'contact', topic: 'general' }),
  ],
});

export const teamTurn = (locale: Locale): Turn => ({
  say: t(locale, 'journey.team'),
  buttons: CONCEPTS.slice(0, 4).map((c) => ({ label: kitName(locale, c.id), act: { k: 'people', kit: c.id } })),
});

/** People -> sets, said with the arithmetic, never silently raised. */
export function planTurn(locale: Locale, kit: string, people: number): Turn {
  const p = plan(people);
  const concept = CONCEPTS.find((c) => c.id === kit) ?? CONCEPTS[0];
  const values = {
    people: p.people, sets: p.sets, spare: p.spareSets, min: POLICY.minimumSets,
    price: money(locale, conceptPriceAt(concept, []) * p.sets),
  };
  return {
    say: t(locale, p.moqApplied ? 'journey.planMoq' : 'journey.plan', values),
    buttons: [
      btn(locale, 'btnRequest', { k: 'requestQuote', kit, people, sets: p.sets }, { sets: p.sets }, true),
      btn(locale, 'btnChangePeople', { k: 'people', kit }),
    ],
  };
}

/** Where an order is, who owns the next step, and the buttons for it. */
export function orderTurn(locale: Locale, o: Order): Turn {
  const id = docOf(o);
  const quote = o.quote ?? id;
  const total = money(locale, o.total);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const values = { id, quote, total, sets: o.sets, date: day(locale, iso(o.due)), pct: Math.round(o.perDelivered) };
  const say = (key: string, extra = {}) => t(locale, `journey.stage.${key}`, { ...values, ...extra });
  if (o.state === 'quote_ready') {
    return {
      say: say('quote_ready'),
      buttons: [
        btn(locale, 'btnApprove', { k: 'approve', quote, total: o.total }, { total }, true),
        btn(locale, 'btnView', { k: 'viewQuote', quote }),
        discuss(locale, quote),
      ],
    };
  }
  if (o.state === 'collecting_sizes' && o.salesOrder) {
    return {
      say: say('collecting_sizes'),
      buttons: [btn(locale, 'btnSizes', { k: 'sizes', order: o.salesOrder }, undefined, true), discuss(locale, id)],
    };
  }
  if (o.state === 'delivered') {
    return {
      say: say('delivered', { date: day(locale, iso(o.dates.delivered ?? o.due)) }),
      buttons: [btn(locale, 'btnInvoices', { k: 'invoices' }), discuss(locale, id)],
    };
  }
  const key = o.state === 'in_progress' && o.perDelivered > 0 ? 'in_progress_part' : o.state;
  return { say: say(key), buttons: [discuss(locale, id)] };
}

export const approveTurn = (locale: Locale, quote: string, total: number): Turn => ({
  say: t(locale, 'journey.confirmApprove', { id: quote, total: money(locale, total) }),
  buttons: [
    btn(locale, 'btnApprove', { k: 'approveNow', quote }, { total: money(locale, total) }, true),
    btn(locale, 'btnNotNow', { k: 'menu' }),
  ],
});

/** "Men: S 4, M 10; Women: …", skipping empty cuts and sizes. */
export function runText(locale: Locale, run: SizeAllocation): string {
  const comma = locale === 'ar' ? '، ' : ', ';
  return (Object.entries(run) as [GarmentCut, Partial<Record<string, number>>][])
    .map(([cut, sizes]) => [cut, SIZES.filter((z) => sizes?.[z]).map((z) => `${z} ${sizes[z]}`)] as const)
    .filter(([, parts]) => parts.length)
    .map(([cut, parts]) => `${t(locale, `journey.cut.${cut}`)}: ${parts.join(comma)}`)
    .join(locale === 'ar' ? '؛ ' : '; ');
}

export const sizeConfirmTurn = (locale: Locale, o: Order, run: SizeAllocation): Turn => ({
  say: t(locale, 'journey.confirmSizes', { id: docOf(o), run: runText(locale, run) }),
  buttons: [
    btn(locale, 'btnSendRun', { k: 'sendSizes', order: docOf(o), run }, undefined, true),
    btn(locale, 'btnAdjust', { k: 'sizes', order: docOf(o) }),
  ],
});

export function contactTurn(locale: Locale, topic: Topic, doc?: string): Turn {
  const say = doc ? t(locale, 'journey.contactAbout', { id: doc })
    : t(locale, topic === 'billing' ? 'journey.contactBilling' : 'journey.contactGeneral');
  return {
    say,
    buttons: [
      btn(locale, 'btnContact', { k: 'sendContact', topic, ...(doc ? { doc } : {}) }, undefined, true),
      btn(locale, 'btnNotNow', { k: 'menu' }),
    ],
  };
}

/** Latest invoice first, then what is open and what is past due. Neutral:
 *  "past due", never "payment required". */
export function invoicesTurn(locale: Locale, invoices: Invoice[]): Turn {
  const open = invoices.filter((i) => i.status !== 'paid');
  const late = open.filter((i) => i.status === 'overdue').map((i) => i.due).sort();
  const said: string[] = [];
  if (invoices[0]) {
    said.push(t(locale, 'journey.invLatest', {
      id: invoices[0].name, status: t(locale, `journey.invWord.${invoices[0].status}`),
    }));
  }
  said.push(open.length
    ? t(locale, 'journey.invOpen', { count: open.length, total: money(locale, open.reduce((n, i) => n + i.outstanding, 0)) })
    : t(locale, 'journey.invNone'));
  if (late.length) said.push(t(locale, 'journey.invLate', { count: late.length, date: day(locale, late[0]) }));
  return { say: said.join(' '), buttons: [btn(locale, 'btnDiscuss', { k: 'contact', topic: 'billing' })] };
}

const showOrder = (locale: Locale, o: Order) => btn(locale, 'btnShow', { k: 'show', id: docOf(o) }, undefined, true);

export const quoteSentTurn = (locale: Locale, o: Order): Turn =>
  ({ say: t(locale, 'journey.quoteSent', { id: o.quote ?? o.id }), buttons: [showOrder(locale, o)] });
export const approvedTurn = (locale: Locale, o: Order): Turn =>
  ({ say: t(locale, 'journey.approved', { id: docOf(o) }), buttons: [showOrder(locale, o)] });
export const sizesSentTurn = (locale: Locale, o: Order): Turn =>
  ({ say: t(locale, 'journey.sizesSent', { id: docOf(o), sets: o.sets }), buttons: [showOrder(locale, o)] });
export const caseTurn = (locale: Locale, name: string): Turn =>
  ({ say: t(locale, 'journey.caseSent', { id: name }), buttons: [] });
export const failTurn = (locale: Locale, retry: Act): Turn =>
  ({ say: t(locale, 'journey.failed'), buttons: [btn(locale, 'btnRetry', retry, undefined, true)] });
export const noOrderTurn = (locale: Locale): Turn =>
  ({ say: t(locale, 'journey.noOrder'), buttons: [btn(locale, 'btnOrders', { k: 'orders' })] });
```

- [ ] **Step 4: Run the tests**

Run: `npm test && npx tsc --noEmit`
Expected: `journey: all assertions passed`, and every other file still passes. If `CONCEPTS` order differs from the teamTurn assertion, the assertion reads it from `CONCEPTS` already; if it has fewer than four concepts the slice still holds.

- [ ] **Step 5: Commit**

```bash
git add lib/journey.ts lib/journey.test.ts
git commit -F - <<'EOF'
Script the account manager's conversation as pure turns over the customer's records

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 7: Action UIs inside the chat

**Files:**
- Create: `components/chat-actions.tsx`
- Modify: `app/ui.module.css` (append after the `.evQuestion` rule)

**Interfaces:**
- Consumes: `QuoteView` (Task 3), `Invoice` (Task 3), `cutsOf`, `proposedSplit`, `runTotal` (Task 4), `Order`, `SIZES`, `SizeAllocation`, Task 5's keys.
- Produces (all client components):
  - `PeopleForm({ locale, onSubmit }: { locale: Locale; onSubmit: (people: number) => void })`
  - `QuoteCard({ view, locale }: { view: QuoteView; locale: Locale })`
  - `InvoiceList({ rows, locale }: { rows: Invoice[]; locale: Locale })`
  - `SizeRunForm({ order, locale, onReview }: { order: Order; locale: Locale; onReview: (run: SizeAllocation) => void })`
  - CSS classes `evPrimary`, `evPanel`, `evRun`, `evRunLeft`, `evRow`, `evLines`, `evTotal`, `evChip`, `evChip_paid`, `evChip_unpaid`, `evChip_overdue`, `evLauncherRaised`.

No unit test: the logic (`proposedSplit`, `runTotal`, the view) is tested in Tasks 3–4; these render it. Task 8 checks them in the browser.

- [ ] **Step 1: The components**

```tsx
// components/chat-actions.tsx
'use client';

// The few things the conversation asks the customer to fill in or look at:
// a number of people, a quotation, invoices, and the size run.

import { useState } from 'react';
import s from '@/app/ui.module.css';
import { type Locale, formatCurrency, formatDate, formatNumber, t } from '@/lib/i18n';
import type { Order } from '@/lib/order';
import type { QuoteView } from '@/lib/quote-view';
import type { Invoice } from '@/lib/invoices';
import { type GarmentCut, type GarmentSize, type SizeAllocation, SIZES } from '@/lib/spec';
import { cutsOf, proposedSplit, runTotal } from '@/lib/size-run';

const day = (locale: Locale, iso: string) => formatDate(locale, new Date(`${iso}T12:00:00`));

export function PeopleForm({ locale, onSubmit }: { locale: Locale; onSubmit: (people: number) => void }) {
  const [people, setPeople] = useState(20);
  const ok = Number.isInteger(people) && people >= 1 && people <= 500;
  return (
    <form className={s.evPanel} onSubmit={(e) => { e.preventDefault(); if (ok) onSubmit(people); }}>
      <input type="number" min={1} max={500} inputMode="numeric" value={people} autoFocus
        aria-label={t(locale, 'journey.people')} onChange={(e) => setPeople(Math.floor(Number(e.target.value)))} />
      <button type="submit" className={s.evPrimary} disabled={!ok}>{t(locale, 'journey.btnContinue')}</button>
    </form>
  );
}

export function QuoteCard({ view, locale }: { view: QuoteView; locale: Locale }) {
  const money = (n: number) => formatCurrency(locale, n);
  const what = (l: QuoteView['lines'][number]) =>
    l.kind === 'garment' ? t(locale, `garments.${l.garment}`)
      : l.kind === 'branding' ? t(locale, l.method === 'print' ? 'branding.printedLogo' : 'branding.embroideredLogo')
        : t(locale, 'journey.quote.other');
  return (
    <section className={s.evCard} aria-label={t(locale, 'journey.quote.title', { id: view.name })}>
      <div className={s.evTop}>
        <span className={s.evKind}>{t(locale, 'erpAsk.kindQuotation')}</span>
        <span className={s.evId}>{view.name}</span>
      </div>
      <ul className={s.evLines}>
        {view.lines.map((l, i) => (
          <li key={i}>
            <span>{what(l)}</span>
            <span>{t(locale, 'journey.quote.each', { qty: formatNumber(locale, l.qty), rate: money(l.rate) })}</span>
          </li>
        ))}
      </ul>
      {view.discountPct > 0 && <p>{t(locale, 'journey.quote.discount', { pct: view.discountPct })}</p>}
      <p className={s.evTotal}><span>{t(locale, 'journey.quote.total')}</span><b>{money(view.total)}</b></p>
      {view.validTill && <p>{t(locale, 'journey.quote.valid', { date: day(locale, view.validTill) })}</p>}
    </section>
  );
}

export function InvoiceList({ rows, locale }: { rows: Invoice[]; locale: Locale }) {
  if (!rows.length) return null;
  return (
    <ul className={s.evLines}>
      {rows.slice(0, 6).map((r) => (
        <li key={r.name}>
          <span className={s.evId}>{r.name}</span>
          <span>{formatCurrency(locale, r.total)}</span>
          <span className={`${s.evChip} ${s[`evChip_${r.status}`]}`}>{t(locale, `journey.inv.${r.status}`)}</span>
          <small>{t(locale, 'journey.invDue', { date: day(locale, r.due) })}</small>
        </li>
      ))}
    </ul>
  );
}

export function SizeRunForm({ order, locale, onReview }: {
  order: Order; locale: Locale; onReview: (run: SizeAllocation) => void;
}) {
  const cuts = cutsOf(order.concept);
  const [run, setRun] = useState<SizeAllocation>({});
  const done = runTotal(run);
  const set = (cut: GarmentCut, size: GarmentSize, n: number) =>
    setRun((r) => ({ ...r, [cut]: { ...r[cut], [size]: Math.max(0, Math.floor(n) || 0) } }));
  return (
    <div className={s.evPanel}>
      {cuts.map((cut) => (
        <fieldset key={cut} className={s.evRun}>
          <legend>{t(locale, `journey.cut.${cut}`)}</legend>
          {SIZES.map((size) => (
            <label key={size}>
              <span>{size}</span>
              <input type="number" min={0} max={order.sets} inputMode="numeric"
                value={run[cut]?.[size] ?? 0} onChange={(e) => set(cut, size, Number(e.target.value))} />
            </label>
          ))}
        </fieldset>
      ))}
      <p className={s.evRunLeft} aria-live="polite">
        {t(locale, 'journey.sizesLeft', { done, left: Math.max(0, order.sets - done) })}
      </p>
      <div className={s.evRow}>
        <button type="button" onClick={() => setRun(proposedSplit(cuts, order.sets))}>
          {t(locale, 'journey.btnSplit')}
        </button>
        <button type="button" className={s.evPrimary} disabled={done !== order.sets} onClick={() => onReview(run)}>
          {t(locale, 'journey.btnReviewRun')}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: The styles** (append to `app/ui.module.css` after `.evQuestion`)

```css
/* The conversation's own controls: one primary per turn, small forms. */
.evSuggest button.evPrimary,
.evPrimary {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
.evSuggest button.evPrimary:hover,
.evPrimary:hover:not(:disabled) { background: var(--accent-hover); color: #fff; }
.evPrimary:disabled { opacity: 0.5; cursor: not-allowed; }

.evPanel { display: grid; gap: var(--s3); padding: var(--s3); border: 1px solid var(--line); border-radius: var(--r); background: var(--surface); }
.evPanel input { width: 100%; padding: 8px 10px; border: 1px solid var(--line-2); border-radius: var(--r-sm); font: inherit; }
.evPanel button { padding: 10px 14px; border: 1px solid var(--line); border-radius: var(--r); background: var(--surface); font: inherit; cursor: pointer; }
.evRow { display: flex; gap: var(--s2); flex-wrap: wrap; }
.evRun { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: var(--s1); margin: 0; padding: 0; border: 0; }
.evRun legend { font-weight: 600; margin-bottom: var(--s1); }
.evRun label { display: grid; gap: 2px; text-align: center; font-size: var(--t-xs); color: var(--text-2); }
.evRun input { padding: 6px 2px; text-align: center; }
.evRunLeft { margin: 0; color: var(--text-2); font-size: var(--t-sm); }

.evLines { list-style: none; margin: var(--s2) 0; padding: 0; display: grid; gap: var(--s1); font-size: var(--t-sm); }
.evLines li { display: flex; flex-wrap: wrap; gap: var(--s2); justify-content: space-between; align-items: baseline; }
.evTotal { display: flex; justify-content: space-between; margin: var(--s2) 0 0; padding-top: var(--s2); border-top: 1px solid var(--line); }
.evChip { padding: 1px 8px; border-radius: 999px; font-size: var(--t-xs); }
.evChip_paid { background: var(--good-soft); color: var(--good); }
.evChip_unpaid { background: var(--sunken); color: var(--text-2); }
.evChip_overdue { background: var(--warn-soft); color: var(--warn); }

/* Above the fixed action and price bars on Design and Configure. */
.evLauncherRaised { inset-block-end: calc(88px + var(--s4)); }
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/chat-actions.tsx app/ui.module.css
git commit -F - <<'EOF'
Add the chat's quotation card, invoice list, people form and size-run form

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 8: The chat on every screen

**Files:**
- Modify: `components/ask-erp.tsx`, `app/page.tsx` (the `page === 'orders'` block and the end of the shell)

**Interfaces:**
- Consumes: everything from `lib/journey.ts` (Task 6), `components/chat-actions.tsx` (Task 7), `fromJson` and `Order` (`lib/order.ts`), `CONCEPTS`, the four routes (Tasks 3–4), the existing `/api/quotes` and `/api/quotes/[name]/approve`.
- Produces: `AskErp` props become `{ locale; request?: AskRequest | null; onOpenOrder?: (id: string) => void; onChanged?: () => void; raised?: boolean }`. Mounted once in `app/page.tsx`.

- [ ] **Step 1: Types and state in `components/ask-erp.tsx`**

Add imports:

```ts
import { CONCEPTS } from '@/lib/concepts';
import { type Order, fromJson } from '@/lib/order';
import type { QuoteView } from '@/lib/quote-view';
import type { Invoice } from '@/lib/invoices';
import {
  type Act, type Button, type Turn as JourneyTurn, approveTurn, approvedTurn, caseTurn, contactTurn, failTurn,
  invoicesTurn, menuTurn, moreTurn, noOrderTurn, orderTurn, planTurn, quoteSentTurn, sizeConfirmTurn,
  sizesSentTurn, teamTurn,
} from '@/lib/journey';
import { InvoiceList, PeopleForm, QuoteCard, SizeRunForm } from './chat-actions';
```

Extend the log and the stage:

```ts
type Turn = { role: 'user'; content: string } | { role: 'prompt'; content: string } | Answer
  | { role: 'quote'; view: QuoteView } | { role: 'invoices'; rows: Invoice[] };

type Stage =
  | { k: 'turn'; buttons: Button[]; home?: boolean }
  | { k: 'people'; kit: string }
  | { k: 'sizes'; order: Order }
  | { k: 'garment'; intent: 'stock' | 'price' }
  | { k: 'colour'; item: string }
  | { k: 'size'; item: string; colour: string }
  | { k: 'orders'; ids: string[] }
  | { k: 'stock' }
  | { k: 'price' };
```

(`menu` and `order` stages are gone; the journey owns both.) Change `useState<Stage>({ k: 'menu' })` to `useState<Stage>({ k: 'turn', buttons: [] })`, in `read`'s catch change `setStage({ k: 'menu' })` to `setStage({ k: 'turn', buttons: [] })`, delete the `else if (intent === 'order') setStage(...)` line, and in `promptFor` drop the `next.k === 'menu'` branch (start the chain at `next.k === 'garment'`). Delete the `menu()` function. Change `type Choice` to `{ label: string; tap: () => void; primary?: boolean }`.

Change the component signature to:

```ts
export function AskErp({ locale, request, onOpenOrder, onChanged, raised }: {
  locale: Locale;
  request?: AskRequest | null;
  /** Shows an order on the Orders screen. */
  onOpenOrder?: (id: string) => void;
  /** Something was written: the page reloads its orders. */
  onChanged?: () => void;
  /** Lift the launcher above a fixed action bar. */
  raised?: boolean;
}) {
```

- [ ] **Step 2: Run an act**

Add inside the component, immediately after `read` and before the order-card effect (that effect uses `actRef`):

```ts
  // React state disables the controls after render; this ref closes the
  // same-tick double-click window before any write request can start.
  const actionLock = useRef(false);

  /** A journey turn: its sentence in the log, its buttons as the choices. */
  const say = (turn: JourneyTurn, home = false) => {
    setTurns((all) => [...all, { role: 'prompt', content: turn.say }]);
    setStage({ k: 'turn', buttons: turn.buttons, home });
  };
  const echo = (content?: string) => { if (content) setTurns((all) => [...all, { role: 'user', content }]); };
  async function api<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(path, body === undefined ? { cache: 'no-store' } : {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(String(res.status));
    return res.json() as Promise<T>;
  }
  const myOrders = async () => (await api<Order[]>('/api/orders')).map(fromJson);
  const findIn = (orders: Order[], id: string) => orders.find((o) => [o.id, o.quote, o.salesOrder].includes(id));

  /** What a button does. Pure turns answer at once; the rest read or write
   *  first. `tapped` is the button's label, echoed as the customer's words. */
  const act = async (a: Act, tapped?: string) => {
    if (busy || actionLock.current) return;
    if (a.k === 'orders') return void read('orders', {}, tapped);
    if (a.k === 'stock' || a.k === 'price') { purpose.current = a.k; return void read('options', {}, tapped); }
    echo(tapped);
    if (a.k === 'more') return say(moreTurn(locale));
    if (a.k === 'new') return say(teamTurn(locale));
    if (a.k === 'plan') return say(planTurn(locale, a.kit, a.people));
    if (a.k === 'approve') return say(approveTurn(locale, a.quote, a.total));
    if (a.k === 'contact') return say(contactTurn(locale, a.topic, a.doc));
    if (a.k === 'people') {
      setTurns((all) => [...all, { role: 'prompt', content: t(locale, 'journey.people') }]);
      return setStage({ k: 'people', kit: a.kit });
    }
    actionLock.current = true;
    setBusy(true);
    try {
      if (a.k === 'menu') {
        say(menuTurn(locale, await myOrders(), turns.length > 0), true);
      } else if (a.k === 'order' || a.k === 'show') {
        const o = findIn(await myOrders(), a.id);
        if (a.k === 'show' && o) onOpenOrder?.(o.id);
        say(o ? orderTurn(locale, o) : noOrderTurn(locale));
      } else if (a.k === 'viewQuote') {
        const view = await api<QuoteView>(`/api/quotes/${encodeURIComponent(a.quote)}`);
        setTurns((all) => [...all, { role: 'quote', view }]);
        const o = findIn(await myOrders(), a.quote);
        say(o ? orderTurn(locale, o) : noOrderTurn(locale));
      } else if (a.k === 'invoices') {
        const rows = await api<Invoice[]>('/api/invoices');
        setTurns((all) => [...all, { role: 'invoices', rows }]);
        say(invoicesTurn(locale, rows));
      } else if (a.k === 'sizes') {
        const o = findIn(await myOrders(), a.order);
        if (!o || o.state !== 'collecting_sizes') say(o ? orderTurn(locale, o) : noOrderTurn(locale));
        else {
          setTurns((all) => [...all, { role: 'prompt', content: t(locale, 'journey.sizesAsk', { id: a.order, sets: o.sets }) }]);
          setStage({ k: 'sizes', order: o });
        }
      } else if (a.k === 'requestQuote') {
        const concept = CONCEPTS.find((c) => c.id === a.kit) ?? CONCEPTS[0];
        const o = fromJson(await api<Order>('/api/quotes', {
          concept, staff: a.people, sets: a.sets, grades: [], sizePlan: { mode: 'collect_later', allocation: {} },
        }));
        onChanged?.();
        say(quoteSentTurn(locale, o));
      } else if (a.k === 'approveNow') {
        const o = fromJson(await api<Order>(`/api/quotes/${encodeURIComponent(a.quote)}/approve`, {}));
        onChanged?.();
        say(approvedTurn(locale, o));
      } else if (a.k === 'sendSizes') {
        const o = fromJson(await api<Order>(`/api/orders/${encodeURIComponent(a.order)}/sizes`, { allocation: a.run }));
        onChanged?.();
        say(sizesSentTurn(locale, o));
      } else if (a.k === 'sendContact') {
        const c = await api<{ name: string }>('/api/contact', { topic: a.topic, ...(a.doc ? { document: a.doc } : {}) });
        say(caseTurn(locale, c.name));
      }
    } catch {
      say(failTurn(locale, a));
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  };
  // Effects below always call the latest act.
  const actRef = useRef(act);
  actRef.current = act;
```

- [ ] **Step 3: Opening, the order-card request, and the choices**

Replace the existing request effect body's `void read('order', …)` line with:

```ts
    void actRef.current({ k: 'order', id: request.orderId }, t(locale, 'erpAsk.btnDetails', { id: request.orderId }));
```

and its dependency list with `[request, busy, locale]`. Add, next to it:

```ts
  // First open: the account manager greets and offers what is waiting.
  useEffect(() => {
    if (open && !turns.length) void actRef.current({ k: 'menu' });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Focus lands in the sheet when it opens.
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (open) closeButton.current?.focus(); }, [open]);
```

Replace `toMenu` and the `choices` expression's first and `orders`/`order` branches:

```ts
  const toMenu: Choice = { label: t(locale, 'journey.btnMenu'), tap: () => void act({ k: 'menu' }, t(locale, 'journey.btnMenu')) };
  const fromButtons = (bs: Button[]): Choice[] =>
    bs.map((b) => ({ label: b.label, primary: b.primary, tap: () => void act(b.act, b.label) }));
```

```ts
  const choices: Choice[] = stage.k === 'turn' ? [...fromButtons(stage.buttons), ...(stage.home ? [] : [toMenu])]
    : stage.k === 'people' || stage.k === 'sizes' ? [toMenu]
    : stage.k === 'garment' ? [
```

continuing with the existing `garment`, `colour`, `size` and `stock` branches exactly as they are, and replacing the `orders` branch with (three open orders at most, so the turn stays at four buttons):

```ts
          : stage.k === 'orders' ? [
            ...stage.ids.slice(0, 3).map((id) => ({
              label: t(locale, 'erpAsk.btnDetails', { id }),
              tap: () => void act({ k: 'order', id }, t(locale, 'erpAsk.btnDetails', { id })),
            })),
            toMenu,
          ]
```

Delete the `stage.k === 'order'` branch. In the `stock` branch, `btnAnother`'s tap becomes `() => void act({ k: 'stock' }, t(locale, 'erpAsk.btnAnother'))`.

- [ ] **Step 4: Render**

Launcher: `className={`${s.evLauncher} ${raised ? s.evLauncherRaised : ''}`}`. Close button: add `ref={closeButton}`. Delete the `{!turns.length && (<div className={s.evIntro}>…</div>)}` block (the greeting is now a turn). In the turns map, add two cases before the `Reply` fallback:

```tsx
        ) : turn.role === 'quote' ? (
          <QuoteCard key={index} view={turn.view} locale={locale} />
        ) : turn.role === 'invoices' ? (
          <InvoiceList key={index} rows={turn.rows} locale={locale} />
```

Before the choices list:

```tsx
        {!busy && stage.k === 'people' && (
          <PeopleForm locale={locale}
            onSubmit={(people) => void act({ k: 'plan', kit: stage.kit, people }, t(locale, 'journey.peopleEcho', { count: people }))} />
        )}
        {!busy && stage.k === 'sizes' && (
          <SizeRunForm key={stage.order.id} order={stage.order} locale={locale}
            onReview={(run) => { echo(t(locale, 'journey.btnReviewRun')); say(sizeConfirmTurn(locale, stage.order, run)); }} />
        )}
```

and in the choices list, give the button `className={c.primary ? s.evPrimary : undefined}`.

- [ ] **Step 5: Mount once in `app/page.tsx`**

In the `page === 'orders'` block, delete the `<AskErp … />` element (keep `<Orders … />`; the fragment can go). After `{toast && …}` add:

```tsx
      {/* The account manager, on every screen. */}
      <AskErp locale={locale} request={erpRequest}
        raised={page === 'configure' || (page === 'design' && !!concepts && !busy)}
        onOpenOrder={(id) => { setFocusOrder({ id, n: Date.now() }); setPage('orders'); }}
        onChanged={() => void loadOrders()} />
```

- [ ] **Step 6: Check it in the browser**

Run: `npm test && npx tsc --noEmit`, then `npm run seed:erp -- --reset`.

At `http://127.0.0.1:3100`, on each of Home, Design, Configure, Saved kits, Orders and Settings: the launcher is there, and on Configure it sits above the price bar. Open it: "Good day, Mr. Ahmed…" with [Review quotation SAL-QTN-…] first. Tap it: the quote-ready sentence, [Approve EGP 27,451] [View quotation] [Discuss with our team] and Menu. View quotation shows the card with garment names, the 5% discount and no `UA-`. Escape closes the sheet; focus starts on its close button. Switch to Arabic in the top bar and reopen: every line is Arabic and right-to-left. Do not approve yet (Task 9 runs the journey).

- [ ] **Step 7: Commit**

```bash
git add components/ask-erp.tsx app/page.tsx
git commit -F - <<'EOF'
Run the guided account-manager conversation in the assistant, on every screen

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 9: One live end-to-end run, and the demo script

**Files:**
- Create: `scripts/team.ts`
- Create: `scripts/demo-check.ts`
- Modify: `package.json` (`dev`, `team`, `demo:check`), `README.md` (the "Orders run on ERPNext" intro paragraph on the assistant, the `--reset` paragraph, and "Demo script")

**Interfaces:**
- Consumes: the whole app; `ERP_URL`, `ERP_SEED_KEY`.
- Produces: `npm run team -- issue <quotation>`, `npm run team -- confirm <sales order>`, `npm run team -- deliver <sales order>`; `npm run demo:check` fails fast unless the customer routes expose the exact clean starting state.

- [ ] **Step 1: The team script**

```ts
// scripts/team.ts
// Plays UniformAI's team during a demo or rehearsal: the steps staff take in
// ERPNext's desk, through its API with the seed key. The desk works too.
//
//   npm run team -- issue SAL-QTN-2026-00032     submit the quotation (price confirmed)
//   npm run team -- confirm SAL-ORD-2026-00015   submit the sales order
//   npm run team -- deliver SAL-ORD-2026-00015   deliver in full and invoice, due in 30 days

import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());
const ERP_URL = process.env.ERP_URL?.replace(/\/$/, '');
const KEY = process.env.ERP_SEED_KEY;
if (!ERP_URL || !KEY) throw new Error('ERP_URL and ERP_SEED_KEY are required');

type Doc = Record<string, unknown> & { name: string };

/** Frappe mapped documents contain client-only `__*` markers. They must not
 *  be sent back through the resource insertion API. */
function clean<T>(value: T): T {
  if (Array.isArray(value)) return value.map(clean) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !key.startsWith('__'))
      .map(([key, child]) => [key, clean(child)])) as T;
  }
  return value;
}

async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${ERP_URL}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `token ${KEY}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res.json() as Promise<T>;
}
const resource = (doctype: string, name = '') =>
  `/api/resource/${encodeURIComponent(doctype)}${name ? `/${encodeURIComponent(name)}` : ''}`;
const get = async (doctype: string, name: string) => (await api<{ data: Doc }>(resource(doctype, name))).data;
const insert = async (doctype: string, doc: Record<string, unknown>) => (await api<{ data: Doc }>(resource(doctype), doc)).data;
const call = async <T>(method: string, args: Record<string, unknown>) =>
  (await api<{ message: T }>(`/api/method/${method}`, args)).message;
const submit = (doc: Doc) => call<Doc>('frappe.client.submit', { doc });
const SO = 'erpnext.selling.doctype.sales_order.sales_order';

async function main() {
  const [verb, name] = process.argv.slice(2);
  if (verb === 'issue' && name) {
    console.log(`issued ${(await submit(await get('Quotation', name))).name}`);
  } else if (verb === 'confirm' && name) {
    console.log(`confirmed ${(await submit(await get('Sales Order', name))).name}`);
  } else if (verb === 'deliver' && name) {
    const note = await submit(await insert('Delivery Note', clean(await call<Doc>(`${SO}.make_delivery_note`, { source_name: name }))));
    const due = new Date();
    due.setDate(due.getDate() + 30);
    const invoice = await submit(await insert('Sales Invoice', {
      ...clean(await call<Doc>(`${SO}.make_sales_invoice`, { source_name: name })), due_date: due.toISOString().slice(0, 10),
    }));
    console.log(`delivered ${note.name}, invoiced ${invoice.name}`);
  } else {
    console.log('usage: npm run team -- issue <quotation> | confirm <sales order> | deliver <sales order>');
    process.exit(1);
  }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
```

In `package.json`, make the local trust boundary executable instead of documentary and add the team command:

```json
"dev": "next dev --webpack -H 127.0.0.1 -p 3100",
"team": "tsx scripts/team.ts"
```

- [ ] **Step 2: The live run**

`npm run seed:erp -- --reset && npm run demo:check`, then in the browser at `http://127.0.0.1:3100`, in English:

1. Open the assistant. Tap [Start a new uniform request] → [Front Office] → people 6 → [Continue]. Expected: the minimum-order sentence, 10 sets, 4 spares. [Change the number] → 18 → the plain plan with 19 sets. [Request a quotation for 19 sets]. Expected: "Thank you, Mr. Ahmed. I have sent quotation SAL-QTN-… to our team…". Note the number.
2. `npm run team -- issue <that SAL-QTN>`. In the chat, Menu. Expected: [Review quotation <that SAL-QTN>] leads (it is now the newest order with something waiting). Open it → [View quotation] shows garments, quantities, total and validity → [Approve EGP …] → the confirmation → [Approve EGP …]. Expected: "…order SAL-ORD-… is now awaiting their confirmation." [Show order] opens Orders at Awaiting confirmation.
3. `npm run team -- confirm <that SAL-ORD>`. Menu. Expected: [Send sizes for <that SAL-ORD>] leads (newer than the seeded Technicians quote). Tap → [Use a proposed split] → the line reads "19 assigned, 0 left." → [Review the size run] → the run in words → [Send the size run]. Expected: "…received all 19 sizes… now in progress." The Orders timeline shows In progress; ERPNext's UniformAI Size Run list has one record.
4. `npm run team -- deliver <that SAL-ORD>`. Menu → [Check my quotations and orders] → Details of the order: "All 19 sets … were delivered on …" → [Invoices]: the new invoice Unpaid first, hist-06 Overdue, the rest Paid, with the open total.
5. [Discuss with our team] → [Ask the team to contact me]. Expected: "…passed this to the team as CASE-2026-…". ERPNext Support > Issue lists it for BrainWise Technology.
6. Switch to Arabic and repeat step 4's reads (orders, invoices): every sentence Arabic, numbers Western, document numbers readable.
7. On every screen the launcher shows and does not cover an action bar. Nowhere in the chat: "ERPNext", a `UA-` code, a link to the ERP, or "Draft"/"To Deliver".
8. `npm run seed:erp -- --reset`: the app order, its size run, invoice and the case are gone; Technicians is back at Quote ready.

Fix anything that fails in the task that owns it, rerun `npm test`, and repeat the step.

- [ ] **Step 3: The README**

In "Orders run on ERPNext", replace the paragraph starting "The Orders screen has a guided assistant" with:

```md
The assistant is on every screen: a guided account manager, in English and
formal Arabic, with no language model. Each button is one fixed read or one
insert-only write: request a quotation, approve it, send the size run, see
invoices (Paid / Unpaid / Overdue, worked out from what is owed and the due
date) and ask the team to get in touch (an ERPNext Issue, named CASE-…). The
minimum order is 10 sets, with 5% spares recommended (`lib/policy.ts`).
```

Replace the `--reset` paragraph with:

```md
`--reset` removes the current demo orders, everything the app made (app-
references), their size runs and `[UniformAI assistant]` contact cases, and
puts stock back with its own reconciliation. It keeps history, staff-created
BrainWise cases and other documents made by hand.
```

Replace "### Demo script" and its list with:

```md
### Demo script

`npm run seed:erp -- --reset && npm run demo:check` first. UniformAI's side is played in ERPNext's
desk or with `npm run team -- issue|confirm|deliver <document>`.

1. Open the assistant on Home: a greeting, and the Technicians quotation
   waiting for review.
2. Start a new uniform request: Front Office, 6 people. The minimum order
   (10 sets) is explained, not applied silently. Change to 18 people and
   request the quotation for 19 sets.
3. As the team, issue that quotation. In the assistant: review it, view the
   quotation (names and money only), approve. ERPNext has a draft Sales Order.
4. As the team, confirm the order. The assistant asks for sizes; use the
   proposed split, review, send. The order moves to In progress.
5. As the team, deliver. The order reads Delivered; Invoices shows the new
   one Unpaid, one Overdue and the history Paid.
6. Discuss with our team: a CASE-… reference, visible in ERPNext as an Issue.
7. Switch to Arabic and ask again: the same conversation, formal Arabic.
8. Stock and last price still work from More: Polo, Navy, XL is 260 in Stores.
9. `npm run seed:erp -- --reset && npm run demo:check` to start over.
```

- [ ] **Step 4: Add the readiness check**

Create `scripts/demo-check.ts`. It deliberately uses the same customer-facing routes as the demo, so a green check covers route wiring as well as ERP data. It expects the clean seed exactly; an app document left by a rehearsal changes the order count and fails the check.

```ts
// scripts/demo-check.ts
import assert from 'node:assert/strict';

const BASE = process.env.DEMO_URL ?? 'http://127.0.0.1:3100';

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, init);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

type Order = { state: string };
type Invoice = { status: string };

async function main() {
  const health = await json<{ ok: boolean }>('/api/ask');
  assert.equal(health.ok, true, 'ERP records must be reachable');
  const orders = await json<Order[]>('/api/orders');
  const count = (state: string) => orders.filter((order) => order.state === state).length;
  assert.equal(orders.length, 11, 'expected the 11 clean seeded order chains; run seed:erp -- --reset');
  assert.equal(count('quote_requested'), 1, 'one draft quotation');
  assert.equal(count('quote_ready'), 1, 'one issued quotation ready for review');
  assert.equal(count('collecting_sizes'), 1, 'one confirmed order waiting for sizes');
  assert.equal(count('in_progress'), 1, 'one partially delivered order in progress');
  assert.equal(count('delivered'), 7, 'seven delivered history orders');

  const invoices = await json<Invoice[]>('/api/invoices');
  assert.equal(invoices.filter((row) => row.status === 'paid').length, 5, 'five paid history invoices');
  assert.equal(invoices.filter((row) => row.status === 'overdue').length, 1, 'one overdue history invoice');
  assert.equal(invoices.filter((row) => row.status === 'unpaid').length, 1, 'one unpaid history invoice');

  const stock = await json<{ rows: unknown[] }>('/api/ask', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ intent: 'stock', params: { item: 'Polo', colour: 'Navy', size: 'XL' } }),
  });
  assert.match(JSON.stringify(stock.rows), /260/, 'Navy Polo XL must have 260 in Stores');
  console.log('demo: ready');
}

main().catch((error) => {
  console.error(`demo: not ready: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
```

Add `"demo:check": "tsx scripts/demo-check.ts"` to `package.json`. Run `npm run demo:check`; expected: `demo: ready`. Temporarily create an assistant quotation, run it again and confirm it fails with the reset hint; then reset and confirm it passes.

- [ ] **Step 5: Final check and commit**

Run: `npm test && npx tsc --noEmit && npm run demo:check`
Expected: all pass and the final line is `demo: ready`.

```bash
git add scripts/team.ts scripts/demo-check.ts package.json README.md
git commit -F - <<'EOF'
Add repeatable team and readiness scripts for the account-manager demo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 10: Standard variant lines: sized items and the team's apply-sizes step

ERPNext sells an item with variants one variant per line (its sales item query filters `has_variants = 0`, so a template cannot be sold) and changes a submitted order's lines with the standard Update Items (`erpnext.controllers.accounts_controller.update_child_qty_rate`). This task follows that. Quotes and the Sales Order keep one made-to-order line per garment (`UA-MTO-POLO × 42`), because sizes are unknown when the price is agreed. The customer's sizes still arrive as a `UniformAI Size Run`, and the Portal user still never writes a Sales Order. The team then applies the run with Update Items: each garment line is replaced by its colour × cut × size variant lines (`UA-SIZED-…`). Those lines add up to the old quantity at the old rate, so the grand total does not move. The branding line stays. Nothing new reaches the customer.

Cuts map to a third attribute, `Uniform Cut` (Men / Women / Unisex). The size run is keyed by cut, so one template per garment covers every cut, the way colour and size are covered, with no template per cut.

Verified against `apps/erpnext` v15 (`controllers/accounts_controller.py`):
- `update_child_qty_rate(parent_doctype, trans_items, parent_doctype_name, child_docname="items")`, where `trans_items` is a JSON **string** of rows. A row with `docname` updates that line (only qty, rate, uom, conversion factor and delivery date). A row without one adds a line, and the item's name, description and group come from the Item master (`set_order_defaults`). A line left out of `trans_items` is **deleted** (`validate_and_delete_children`).
- Deleting a line is refused if it has `delivered_qty`, `ordered_qty`, `work_order_qty` or `billed_amt`, so sizes must be applied before `deliver`. A new Sales Order line needs a warehouse (`is_warehouse_required_for_new_child_item` is always true for Sales Order Item), so each row passes the old line's.
- New lines get no `prevdoc_docname` (quotation link). `listOrders` finds an order's quotation, and hides the quote, through `items.prevdoc_docname`, and so does `approveQuote`'s "already approved" check. The branding line keeps the link. So `sizes` refuses an order that has no branding line.
- `SalesOrder.update_prevdoc_status` only re-runs the quotation's `set_status` and does not recompute `Quotation Item.ordered_qty`, so the quotation stays "Ordered".

Checked and left unchanged: `toOrders`/`listOrders` (state comes from `docstatus`, `per_delivered` and size runs, and lines and sets come from `uniformai_kit`, never from item codes). The delivery reads (`items.against_sales_order`, which is on every mapped line). The invoice reads (header fields only). `toQuoteView` (it reads the Quotation, which is never touched). `seed-erp.ts:400` (it sets rates on the *quotation's* MTO lines when the seed creates one). `make_delivery_note`/`make_sales_invoice` map line by line, so they now map one line per variant, and non-stock items need no stock. `lib/ask.ts` does need changes: `options()` and `variantsFor` pick templates by `has_variants`, and the new sized templates would enter the stock menu and could win the "polo" name match. `lastPrice` only knows `UA-MTO-*` and ready-stock codes, but a sized order's invoice carries `UA-SIZED-*`.

**Files:**
- Create: `lib/sized.ts`
- Create: `lib/sized.test.ts`
- Modify: `scripts/seed-erp.ts` (imports; `COLOURS` moves to `lib/sized.ts`; the attribute loop in `masters`; new sized templates and variants after the made-to-order items)
- Modify: `scripts/team.ts` (new `sizes` verb)
- Modify: `lib/ask.ts` (`variantsFor`, `lastPrice`, `options`), `lib/ask.test.ts` (cases 6 and 9)
- Modify: `README.md` (the "Orders run on ERPNext" paragraph and the "Demo script" Task 9 wrote)

**Interfaces:**
- Consumes: `MTO_ITEM`, `LOGO_ITEM`, `type Kit`, `kitLines` from `lib/orders.ts`; `parseRun(input, cuts, sets): SizeAllocation | null`, `cutsOf`, `proposedSplit` from `lib/size-run.ts`; `SIZES` (XS…3XL), `type GarmentCut`, `type GarmentSize`, `type GarmentType`, `type Garment`, `type Concept`, `type SizeAllocation` from `lib/spec.ts`; from Task 9's `scripts/team.ts`: `api`, `resource`, `get`, `call`, `type Doc`.
- Produces: `SIZED_PREFIX = 'UA-SIZED-'`; `CUT_ATTRIBUTE = 'Uniform Cut'`; `CUT_VALUE: Record<GarmentCut, string>`; `COLOUR_NAMES: Record<string, string>` (hex → Uniform Colour value); `sizedTemplate(type: GarmentType): string` (`UA-SIZED-POLO`); `garmentColour(g: Garment): string | undefined`; `sizedCode(type, colour, cut, size): string` (`UA-SIZED-POLO-SAND-WOMEN-3XL`); `type SizedVariant = { item_code; template; type; colour; cut; size }`; `sizedVariants(concepts: Concept[]): SizedVariant[]`; `type SoItem`, `type TransItem`; `sizedItems(items: SoItem[], kit: Kit, run: SizeAllocation): TransItem[]`; the command `npm run team -- sizes <sales order>`.

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx lib/sized.test.ts`
Expected: FAIL with `Cannot find module './sized'`.

- [ ] **Step 3: Write `lib/sized.ts`**

```ts
// lib/sized.ts
// Made-to-order garments by size, the way ERPNext sells anything with
// variants: one Sales Order line per variant. Quotes and confirmed orders
// carry one UA-MTO-* line per garment because sizes are unknown then; once
// the customer's size run is in, the team replaces each of those lines with
// its colour x cut x size variants through ERPNext's Update Items. Pure, so
// the seed (which makes the variants) and the team script (which uses them)
// share one naming rule.

import {
  type Concept, type Garment, type GarmentCut, type GarmentSize, type GarmentType, type SizeAllocation,
  SIZES, cutsOf,
} from './spec';
import { type Kit, LOGO_ITEM, MTO_ITEM } from './orders';

export const SIZED_PREFIX = 'UA-SIZED-';
export const CUT_ATTRIBUTE = 'Uniform Cut';
export const CUT_VALUE: Record<GarmentCut, string> = { men: 'Men', women: 'Women', unisex: 'Unisex' };
/** The colour a garment is known by (body, else leg), as a Uniform Colour value. */
export const COLOUR_NAMES: Record<string, string> = {
  '#1b2a4a': 'Navy', '#ffffff': 'White', '#2f3640': 'Charcoal',
  '#dfe6ef': 'Pale Blue', '#3d4a3a': 'Olive', '#c8b393': 'Sand',
  '#7a6a4f': 'Khaki', '#6a5c44': 'Khaki',
};

const code = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export const sizedTemplate = (type: GarmentType) => `${SIZED_PREFIX}${code(type)}`;
export const garmentColour = (g: Garment): string | undefined =>
  COLOUR_NAMES[(g.parts.body ?? g.parts.leg ?? Object.values(g.parts)[0] ?? '').toLowerCase()];
export const sizedCode = (type: GarmentType, colour: string, cut: GarmentCut, size: GarmentSize) =>
  `${sizedTemplate(type)}-${code(colour)}-${code(CUT_VALUE[cut])}-${size}`;

export type SizedVariant = {
  item_code: string; template: string; type: GarmentType; colour: string; cut: GarmentCut; size: GarmentSize;
};

/** Every variant the sample concepts can need: each garment's colour, in
 *  each of the concept's cuts, in every size a size run accepts. */
export function sizedVariants(concepts: Concept[]): SizedVariant[] {
  const all = new Map<string, SizedVariant>();
  for (const c of concepts) for (const g of c.garments) {
    const colour = garmentColour(g);
    if (!colour) continue;
    for (const cut of cutsOf(c)) for (const size of SIZES) {
      const item_code = sizedCode(g.type, colour, cut, size);
      all.set(item_code, { item_code, template: sizedTemplate(g.type), type: g.type, colour, cut, size });
    }
  }
  return [...all.values()];
}

/** A Sales Order line as ERPNext returns it: the fields Update Items reads. */
export type SoItem = {
  name: string; item_code: string; qty: number; rate: number;
  uom: string; conversion_factor: number; delivery_date: string; warehouse?: string | null;
};
/** One row of Update Items' trans_items. With docname it keeps that line;
 *  without, it adds one. A line left out is deleted. */
export type TransItem = Omit<SoItem, 'name' | 'warehouse'> & { docname?: string; warehouse?: string };

const MTO = new Set<string>(Object.values(MTO_ITEM));
const LOGO = new Set<string>(Object.values(LOGO_ITEM));

/** The order's lines with each made-to-order garment line replaced by its
 *  size variants: same rate, quantities adding up to the line's. */
export function sizedItems(items: SoItem[], kit: Kit, run: SizeAllocation): TransItem[] {
  if (!items.some((i) => MTO.has(i.item_code))) throw new Error('sizes are already applied');
  // New lines carry no quotation reference; the branding line keeps the link.
  if (!items.some((i) => LOGO.has(i.item_code))) {
    throw new Error('no branding line to keep the quotation link; apply these sizes in the desk');
  }
  const pending = [...kit.concept.garments];
  return items.flatMap((line) => {
    const keep: TransItem = {
      item_code: line.item_code, qty: line.qty, rate: line.rate, uom: line.uom,
      conversion_factor: line.conversion_factor, delivery_date: line.delivery_date,
      ...(line.warehouse ? { warehouse: line.warehouse } : {}),
    };
    if (!MTO.has(line.item_code)) return [{ docname: line.name, ...keep }];
    // Lines pair with garments in order, so a kit with two polos stays two lines.
    const at = pending.findIndex((g) => MTO_ITEM[g.type] === line.item_code);
    if (at < 0) throw new Error(`${line.item_code}: not a garment of this kit`);
    const [garment] = pending.splice(at, 1);
    const colour = garmentColour(garment);
    if (!colour) throw new Error(`${line.item_code}: no Uniform Colour for ${garment.parts.body ?? garment.parts.leg}`);
    const rows = cutsOf(kit.concept).flatMap((cut) => SIZES.flatMap((size) => {
      const qty = run[cut]?.[size] ?? 0;
      return qty > 0 ? [{ ...keep, item_code: sizedCode(garment.type, colour, cut, size), qty }] : [];
    }));
    const total = rows.reduce((n, r) => n + r.qty, 0);
    if (total !== line.qty) throw new Error(`${line.item_code}: the size run has ${total}, the line ${line.qty}`);
    return rows;
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx tsx lib/sized.test.ts`
Expected: `sized: all assertions passed`.

- [ ] **Step 5: Seed the sized templates and variants**

In `scripts/seed-erp.ts`, import the shared rule and drop the local colour map (the ready stock uses the same names):

```ts
import { type GarmentType, type SizePlan, LABELS, SIZES as SIZE_RUN_SIZES, allocatedSizeCount } from '../lib/spec';
import { COLOUR_NAMES, CUT_ATTRIBUTE, CUT_VALUE, garmentColour, sizedTemplate, sizedVariants } from '../lib/sized';
```

Delete `const COLOURS: Record<string, string> = { … };`. In `masters`, change the colour pick to `set.add(garmentColour(g) ?? 'Navy');`, and make `colourValues` cover the shared map so the two can't drift: `const colourValues = [...new Set(Object.values(COLOUR_NAMES))];`.

`ensure()` only creates. An older site's `Uniform Size` has S to XL, but a size run accepts XS to 3XL, so add a helper under `ensureCustomField` that also adds missing values:

```ts
/** Create the attribute, or add the values an older seed's copy lacks. The
 *  whole child table is sent back, existing rows included, so none is lost. */
async function ensureAttribute(attribute_name: string, values: string[]) {
  const row = (attribute_value: string, idx: number) =>
    ({ attribute_value, abbr: code(attribute_value).slice(0, 8), idx });
  const found = await find('Item Attribute', [['attribute_name', '=', attribute_name]]);
  if (!found) {
    await create('Item Attribute', { attribute_name, item_attribute_values: values.map((v, i) => row(v, i + 1)) });
    return;
  }
  const path = `/api/resource/Item%20Attribute/${encodeURIComponent(found.name)}`;
  const have = (await api<{ data: { item_attribute_values: { attribute_value: string }[] } }>(path))
    .data.item_attribute_values;
  const missing = values.filter((v) => !have.some((h) => h.attribute_value === v));
  if (!missing.length) return;
  await api(path, { method: 'PUT', body: JSON.stringify({
    item_attribute_values: [...have, ...missing.map((v, i) => row(v, have.length + i + 1))],
  }) });
  console.log(`${attribute_name}: added ${missing.join(', ')}`);
}
```

Replace the attribute loop in `masters` (`for (const [name, values] of [[COLOUR, colourValues], [SIZE, SIZES]] as const) { await ensure('Item Attribute', …) }`) with:

```ts
  await ensureAttribute(COLOUR, colourValues);
  await ensureAttribute(SIZE, SIZE_RUN_SIZES);
  await ensureAttribute(CUT_ATTRIBUTE, Object.values(CUT_VALUE));
```

After the made-to-order `for (const [type, item_code] of Object.entries(MTO_ITEM) …)` loop, add:

```ts
  // Made to order, by size: what a garment line becomes once the team applies
  // the customer's size run (npm run team -- sizes). Non-stock like UA-MTO-*,
  // so delivery needs no stock. Separate templates, because ERPNext will not
  // turn an item that has transactions into a template.
  for (const type of Object.keys(MTO_ITEM) as GarmentType[]) {
    await ensure('Item', [['item_code', '=', sizedTemplate(type)]], {
      item_code: sizedTemplate(type), item_name: `${TEMPLATES[type]} (sized to order)`, item_group: mtoGroup,
      stock_uom: 'Nos', is_stock_item: 0, has_variants: 1,
      attributes: [{ attribute: COLOUR }, { attribute: CUT_ATTRIBUTE }, { attribute: SIZE }],
    });
  }
  for (const v of sizedVariants(CONCEPTS)) {
    await ensure('Item', [['item_code', '=', v.item_code]], {
      item_code: v.item_code, item_name: `${TEMPLATES[v.type]} ${v.colour} ${CUT_VALUE[v.cut]} ${v.size}`,
      item_group: mtoGroup, stock_uom: 'Nos', is_stock_item: 0, variant_of: v.template,
      attributes: [
        { attribute: COLOUR, attribute_value: v.colour },
        { attribute: CUT_ATTRIBUTE, attribute_value: CUT_VALUE[v.cut] },
        { attribute: SIZE, attribute_value: v.size },
      ],
    });
  }
```

The local `SIZES` (S to XL) stays for ready stock. Run `npx tsc --noEmit`, then `npm run seed:erp`. Expected: `Uniform Size: added XS, 2XL, 3XL` on the first run, then the templates and 140 variants (10 garment colours × 2 cuts × 7 sizes). A second `npm run seed:erp` makes nothing new. In the desk, Item list filtered on `variant_of = UA-SIZED-POLO` shows 28 rows: Navy and Sand, Men and Women, XS to 3XL.

- [ ] **Step 6: Write the failing assistant tests**

In `lib/ask.test.ts`, case 6: add a sized template and a variant of it to the replies, and leave the expected `options()` result as it is. Olive must not appear under Polo:

```ts
  replies = [
    [{ name: 'UA-POLO', item_name: 'Polo' }, { name: 'UA-BLAZER', item_name: 'Blazer' },
     { name: 'UA-MTO-POLO', item_name: 'Made Polo' }, { name: 'UA-EMPTY', item_name: 'Empty' },
     { name: 'UA-SIZED-POLO', item_name: 'Polo (sized to order)' }],
    [
      { name: 'SP1', variant_of: 'UA-SIZED-POLO', attribute: 'Uniform Colour', attribute_value: 'Olive' },
      { name: 'SP1', variant_of: 'UA-SIZED-POLO', attribute: 'Uniform Size', attribute_value: '3XL' },
      // … the existing P1, P2, P3 and B1 rows unchanged …
    ],
  ];
```

Before the `// 5. A timeout` block, add:

```ts
// 9. Once sizes are applied, an invoice bills UA-SIZED-<garment>-… variants:
  // the last price reads those too, and the stock check stays on ready stock
  // even when a sized template is listed first.
  replies = [
    [{ name: 'Blazer', item_name: 'Blazer' }, { name: 'UA-SIZED-BLAZER', item_name: 'Blazer (sized to order)' }],
    [{ name: 'UA-BLAZER-NAVY-M' }, { name: 'UA-SIZED-BLAZER-NAVY-MEN-M' }],
    [{ name: 'INV-9', posting_date: '2026-09-20', currency: 'EGP', item_code: 'UA-SIZED-BLAZER-NAVY-MEN-M', rate: 1500, qty: 7 }],
  ];
  const sizedPrice = await run('price', { item: 'Blazer' });
  assert.deepEqual([sizedPrice.rows[0].name, sizedPrice.sources[0].rate], ['INV-9', 1500]);
  assert.ok(seen.at(-2)!.url.searchParams.get('filters')!.includes('UA-SIZED-BLAZER'));
  replies = [[{ name: 'UA-SIZED-POLO', item_name: 'Polo (sized to order)' }, { name: 'Polo', item_name: 'Polo' }], []];
  await checkStock({ item: 'Polo' });
  assert.equal(JSON.parse(seen.at(-1)!.url.searchParams.get('filters')!).at(-1).join('|'), 'variant_of|in|Polo');
```

Run: `npx tsx lib/ask.test.ts`
Expected: FAIL. `options()` lists Olive and 3XL under a second "Polo (sized to order)" entry, and the price case finds no `UA-SIZED-BLAZER` in the variant filter.

- [ ] **Step 7: Keep sized templates out of stock, and in the last price**

In `lib/ask.ts`, add `import { SIZED_PREFIX } from './sized';` and replace `variantsFor`:

```ts
/** The garment word the item codes use: "Cargo Trouser" -> CARGO. */
const garmentWord = (item: unknown) => text(item).split(/\s+/)[0].toUpperCase();

/** The ready-stock template the customer named, and its variants. With
 *  `sized`, also the variants of the same garment made to order by size
 *  (UA-SIZED-<word>), which a sized order's invoice bills. */
async function variantsFor(itemInput: unknown, sized = false): Promise<ItemRow[]> {
  const wanted = text(itemInput).toLowerCase();
  if (!wanted) return [];
  const templates = await list<ItemRow>('Item', {
    fields: ['name', 'item_name'],
    filters: [['has_variants', '=', 1]],
    limit: 100,
  });
  const template = templates.find((row) => !row.name.startsWith(SIZED_PREFIX) &&
    [row.name, row.item_name].some((v) => String(v ?? '').toLowerCase().includes(wanted)));
  if (!template) return [];
  const names = sized ? [template.name, `${SIZED_PREFIX}${garmentWord(itemInput)}`] : [template.name];
  const joined = await list<ItemRow>('Item', {
    fields: ['name', 'item_name', 'variant_of', 'attributes.attribute', 'attributes.attribute_value'],
    filters: [['variant_of', 'in', names]],
    limit: 2000,
  });
  return groupJoined(joined, ['attribute', 'attribute_value'], 'attributes') as ItemRow[];
}
```

In `lastPrice`, read both and reuse the word:

```ts
  const variants = await variantsFor(input.item, true);
  if (!variants.length) return { rows: [], sources: [] };
  // What the customer paid for a garment was billed as a ready-stock variant,
  // as the garment made to order (UA-MTO-<word>), or, once sizes were
  // applied, as its sized variants (UA-SIZED-<word>-…), all at one rate.
  const codes = [...variants.map((row) => row.name), `UA-MTO-${garmentWord(input.item)}`];
```

In `options()`, keep sized templates out of the stock menu:

```ts
  const ready = templates.filter((row) => !row.name.startsWith('UA-MTO-') && !row.name.startsWith(SIZED_PREFIX));
```

Run: `npx tsx lib/ask.test.ts`
Expected: `ask: all assertions passed`.

- [ ] **Step 8: The team's apply-sizes command**

In `scripts/team.ts`, add to the header's usage lines:

```ts
//   npm run team -- sizes SAL-ORD-2026-00015     apply the customer's size run (Update Items)
```

Add the imports under `@next/env`:

```ts
import { type Kit } from '../lib/orders';
import { cutsOf, parseRun } from '../lib/size-run';
import { type SoItem, sizedItems } from '../lib/sized';
```

Add, after `const SO = …`:

```ts
type OrderDoc = Doc & {
  docstatus: number; per_delivered: number; per_billed: number; grand_total: number;
  uniformai_kit?: string | null; items: SoItem[];
};

/** The team applies a confirmed order's sizes the way the desk's Update
 *  Items does: each made-to-order garment line is replaced by its colour,
 *  cut and size variants at the same rate, so the total does not move. The
 *  customer's newest Size Run wins; a kit sized at quote time is used when
 *  there is none. ERPNext refuses to delete a delivered, billed or ordered
 *  line, so this runs before `deliver`. */
async function applySizes(name: string): Promise<string> {
  const order = await get('Sales Order', name) as OrderDoc;
  if (order.docstatus !== 1) throw new Error(`${name} is not confirmed yet`);
  if (order.per_delivered > 0 || order.per_billed > 0) throw new Error(`${name} is already delivered or billed in part`);
  const kit = order.uniformai_kit ? JSON.parse(order.uniformai_kit) as Kit : null;
  if (!kit) throw new Error(`${name} was not made by the app`);
  const runs = await api<{ data: { allocation: unknown }[] }>(`${resource('UniformAI Size Run')}?${new URLSearchParams({
    fields: JSON.stringify(['allocation']), filters: JSON.stringify([['sales_order', '=', name]]),
    order_by: 'creation desc', limit_page_length: '1',
  })}`);
  const stored = runs.data[0]?.allocation
    ?? (kit.sizePlan?.mode === 'allocate_now' ? kit.sizePlan.allocation : undefined);
  const run = parseRun(typeof stored === 'string' ? JSON.parse(stored) : stored, cutsOf(kit.concept), kit.sets);
  if (!run) throw new Error(`${name} has no complete size run yet`);
  const trans = sizedItems(order.items, kit, run);
  await call('erpnext.controllers.accounts_controller.update_child_qty_rate', {
    parent_doctype: 'Sales Order', parent_doctype_name: name, child_docname: 'items',
    trans_items: JSON.stringify(trans),
  });
  const after = await get('Sales Order', name);
  if (Number(after.grand_total) !== Number(order.grand_total)) {
    throw new Error(`${name}: the total moved from ${order.grand_total} to ${after.grand_total}`);
  }
  return `sized ${name}: ${trans.filter((t) => !t.docname).length} size lines, total ${after.grand_total}`;
}
```

In `main`, before the `else` usage branch:

```ts
  } else if (verb === 'sizes' && name) {
    console.log(await applySizes(name));
```

and change the usage line to `'usage: npm run team -- issue <quotation> | confirm <sales order> | sizes <sales order> | deliver <sales order>'`.

Run: `npx tsc --noEmit`. Expected: no errors. Then, against the clean seed (`npm run seed:erp -- --reset`):
- `npm run team -- sizes <the seeded Collecting sizes SAL-ORD>`. Expected: exits 1 with `… has no complete size run yet`.
- `npm run team -- sizes <the seeded In progress SAL-ORD>`. Expected: exits 1 with `… is already delivered or billed in part`.

- [ ] **Step 9: Re-run the live journey with sizes applied**

`npm run seed:erp -- --reset && npm run demo:check`, then Task 9 Step 2's steps 1 to 3 as written: request 19 sets for Front Office, issue, approve, confirm, send the proposed split. Then:

1. `npm run team -- sizes <that SAL-ORD>`. Expected: `sized SAL-ORD-…: N size lines, total …` with the same total as before. In the desk, the Sales Order's items are `UA-SIZED-SHIRT-WHITE-…`, `UA-SIZED-CHINO-NAVY-…` and `UA-SIZED-BLAZER-NAVY-…` lines plus the unchanged embroidery line. Each garment's lines add up to 19 at the old rate, and the grand total is unchanged. The quotation still reads Ordered.
2. In the app, Menu, and the Orders screen. Expected: the order still reads In progress, [Review quotation …] does not come back for its quotation, and the chat shows no item code.
3. `npm run team -- sizes <that SAL-ORD>` again. Expected: exits 1 with `sizes are already applied`.
4. Continue with Task 9 Step 2's steps 4 to 8. At step 4, `deliver` makes a Delivery Note and a Sales Invoice with one line per size variant, and the invoice total equals the order's. Then: "All 19 sets … were delivered", the new invoice Unpaid. At More, "Last price paid, Blazer" answers from the new invoice at the blazer's quoted rate. "Stock availability, Polo, Navy, XL" still reads 260 in Stores.

Fix anything that fails in the step that owns it, rerun `npm test`, and repeat.

- [ ] **Step 10: The README**

In "Orders run on ERPNext", after the paragraph Task 9 added ("The assistant is on every screen…"), add:

```md
Sizes follow ERPNext's standard for variants. Quotations and orders are
priced on one made-to-order line per garment (`UA-MTO-…`), since sizes are
not known yet. The customer's sizes arrive as a UniformAI Size Run; the team
applies them with the Sales Order's Update Items (`npm run team -- sizes
<order>`), which replaces each garment line with its colour, cut and size
variants (`UA-SIZED-…`, non-stock) at the same rate, so the total is
unchanged. Delivery notes and invoices then list each size.
```

Replace the "### Demo script" section Task 9 wrote with:

```md
### Demo script

`npm run seed:erp -- --reset && npm run demo:check` first. UniformAI's side is played in ERPNext's
desk or with `npm run team -- issue|confirm|sizes|deliver <document>`.

1. Open the assistant on Home: a greeting, and the Technicians quotation
   waiting for review.
2. Start a new uniform request: Front Office, 6 people. The minimum order
   (10 sets) is explained, not applied silently. Change to 18 people and
   request the quotation for 19 sets.
3. As the team, issue that quotation. In the assistant: review it, view the
   quotation (names and money only), approve. ERPNext has a draft Sales Order.
4. As the team, confirm the order. The assistant asks for sizes; use the
   proposed split, review, send. The order moves to In progress.
5. As the team, apply the sizes. In ERPNext the order now lists each garment
   by colour, cut and size, at the same total; the customer sees no change.
6. As the team, deliver. The order reads Delivered; Invoices shows the new
   one Unpaid, one Overdue and the history Paid.
7. Discuss with our team: a CASE-… reference, visible in ERPNext as an Issue.
8. Switch to Arabic and ask again: the same conversation, formal Arabic.
9. Stock and last price still work from More: Polo, Navy, XL is 260 in Stores.
10. `npm run seed:erp -- --reset && npm run demo:check` to start over.
```

- [ ] **Step 11: Final check and commit**

Run: `npm test && npx tsc --noEmit && npm run seed:erp -- --reset && npm run demo:check`
Expected: every test file passes, including `sized: all assertions passed`. The reset leaves the sized items in place (they are masters, not app documents), and the final line is `demo: ready`.

```bash
git add lib/sized.ts lib/sized.test.ts lib/ask.ts lib/ask.test.ts scripts/seed-erp.ts scripts/team.ts README.md
git commit -F - <<'EOF'
Apply a customer's size run as standard variant lines with Update Items

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```
