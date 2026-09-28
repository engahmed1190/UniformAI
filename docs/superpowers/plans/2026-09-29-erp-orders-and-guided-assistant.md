# ERPNext Sales Workflow, Demo Data and Guided Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The UniformAI app runs on ERPNext's sales workflow (Quotation → approval → Sales Order → Delivery Note), shows months of real ERPNext history, and answers account questions through a guided, model-free assistant.

**Architecture:** Pure mapping code in `lib/orders.ts` turns a kit into document lines and a Quotation / Sales Order / Delivery Note chain into the app's `Order`. Server-only code in `lib/sales.ts` reads and writes that chain through `lib/erp.ts` with two keys (read-only, and a draft-only Portal user). The seed script builds the demo account through ERPNext's own mapping methods and can reset the demo's starting point.

**Tech Stack:** Next.js 16 route handlers, TypeScript, `tsx` + `node:assert` tests (`npm test`), ERPNext v15 REST (`/api/resource`, `/api/method`).

**Spec:** `docs/superpowers/specs/2026-09-29-erp-orders-and-guided-assistant-design.md`

## Global Constraints

- The customer is always `BrainWise Technology`, set on the server; no request body can change it.
- The customer never sees the word ERPNext, an ERP URL, an item code or a raw ERP status.
- The app only creates drafts. Submit, cancel and delete happen in ERPNext by UniformAI's team (or the seed).
- Custom fields: `uniformai_kit` (Long Text, hidden, allow on submit) and `uniformai_ref` (Data, read only, allow on submit) on Quotation, Sales Order, Delivery Note, Sales Invoice.
- Seeded refs start with `demo-`; app-created refs start with `app-`. Reset never touches `app-` or unmarked documents.
- Every date lies in fiscal year 2026 and on or before today.
- Permissions are granted through `frappe.core.page.permission_manager.permission_manager.add`/`update`, never a bare `Custom DocPerm` insert.
- Next.js: read `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` before writing a route. Dynamic segments in Next 16 receive `params` as a Promise.
- Tests follow the repo's style: a `lib/*.test.ts` file run with `npx tsx`, plain `assert`, ends by printing `<name>: all assertions passed`.

## Review Focus

1. **Approving twice** (double tap, or two tabs): the second approve must be refused, not make a second Sales Order. Test in Task 5.
2. **ERPNext down while approving or requesting:** the dialog shows an error and nothing is half-created in the app. Test in Task 5.
3. **A Quotation the team marked Lost or that expired:** shows "Quote closed", no Approve button. Test in Task 4.
4. **Reset while the live demo's Sales Order is submitted:** reset cancels it (children first) instead of failing on links. Checked in Task 3's rehearsal step.
5. **A Sales Order or Quotation made by hand in ERPNext with no kit JSON:** lists without a garment drawing instead of crashing the Orders screen. Test in Task 4.

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/orders.ts` | Pure. Kit → document lines; document chain → `Order`; workflow states. |
| `lib/orders.test.ts` | Tests for the above. |
| `lib/sales.ts` | Server-only. Read the customer's chains; create a draft Quotation; approve a Quotation into a draft Sales Order. |
| `lib/sales.test.ts` | Tests with a stubbed `fetch`. |
| `lib/erp.ts` | Adds `insert` and `call`, each taking which key to use. |
| `scripts/seed-erp.ts` | Demo data and `--reset`. |
| `app/api/orders/route.ts` | `GET` orders. |
| `app/api/quotes/route.ts` | `POST` request quote. |
| `app/api/quotes/[name]/approve/route.ts` | `POST` approve. |
| `lib/order.ts` | `Order` type and workflow stages (replaces the six production stages). |
| `lib/manager.ts` | Notes for the workflow states. |
| `lib/answers.ts`, `lib/answers.test.ts` | Guided assistant sentences. |
| `lib/ask.ts`, `app/api/ask/route.ts`, `components/ask-erp.tsx` | Guided assistant. |
| `app/page.tsx`, `lib/i18n.ts`, `app/ui.module.css` | Screens. |

Tasks 1–3 build the demo data and can run before any screen changes. Tasks 4–7 move the app onto the workflow. Task 8 replaces the assistant. Task 9 is the rehearsal.

---

### Task 1: Kit → document lines

**Files:**
- Create: `lib/orders.ts`
- Test: `lib/orders.test.ts`

**Interfaces:**
- Produces:
  - `type Kit = { concept: Concept; staff: number; sets: number; grades: number[]; sizePlan: SizePlan }`
  - `type DocLine = { item_code: string; qty: number; rate: number; description: string }`
  - `MTO_ITEM: Record<GarmentType, string>`, `LOGO_ITEM: Record<LogoMethod, string>`
  - `kitLines(kit: Kit): DocLine[]`
  - `kitEstimate(kit: Kit): number` (= `conceptPriceAt(concept, grades) * sets`)

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx lib/orders.test.ts`
Expected: FAIL, `Cannot find module './orders'`.

- [ ] **Step 3: Implement**

```ts
// lib/orders.ts
// The sales workflow's documents, as the app sees them. Pure: no fetch, so
// both the seed script and the server routes share one set of rules, and
// the totals ERPNext holds come from the same arithmetic as the quote.

import {
  type Concept, type GarmentType, type LogoMethod, type SizePlan,
  LOGO_PRICE, conceptPriceAt, gradeName, gradesFor,
} from './spec';
import { colourName } from './refine';

export type Kit = { concept: Concept; staff: number; sets: number; grades: number[]; sizePlan: SizePlan };
export type DocLine = { item_code: string; qty: number; rate: number; description: string };

export const MTO_ITEM: Record<GarmentType, string> = {
  polo: 'UA-MTO-POLO', cargo: 'UA-MTO-CARGO', shirt: 'UA-MTO-SHIRT',
  chino: 'UA-MTO-CHINO', blazer: 'UA-MTO-BLAZER',
};
export const LOGO_ITEM: Record<LogoMethod, string> = { embroidery: 'UA-EMBROIDERY', print: 'UA-PRINT' };

export const kitEstimate = (kit: Kit) => conceptPriceAt(kit.concept, kit.grades) * kit.sets;

/** One made-to-order line per garment and one logo line. The description is
 *  what UniformAI's team reads when reviewing the quotation in ERPNext. */
export function kitLines(kit: Kit): DocLine[] {
  const lines = kit.concept.garments.map((g, i) => {
    const grade = kit.grades[i] ?? 0;
    const colours = Object.entries(g.parts).map(([part, hex]) => `${colourName(hex)} ${part}`).join(', ');
    return {
      item_code: MTO_ITEM[g.type],
      qty: kit.sets,
      rate: g.unitPrice + (gradesFor(g.type)[grade]?.delta ?? 0),
      description: `${colours} · ${gradeName(g, grade)} · ${g.fit} fit`,
    };
  });
  const { logo } = kit.concept;
  if (logo.position !== 'none') {
    lines.push({
      item_code: LOGO_ITEM[logo.method], qty: kit.sets, rate: LOGO_PRICE[logo.method],
      description: `${logo.method} logo, ${logo.position.replace('_', ' ')}`,
    });
  }
  return lines;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx tsx lib/orders.test.ts`
Expected: `orders: all assertions passed`

- [ ] **Step 5: Commit**

```bash
git add lib/orders.ts lib/orders.test.ts
git commit -m "Price a kit as made-to-order document lines"
```

---

### Task 2: Seed masters, custom fields and the Portal user

**Files:**
- Modify: `scripts/seed-erp.ts` (replaces the whole file; Task 3 adds the chains)
- Modify: `.env.example` (adds `ERP_WRITE_KEY`)

**Interfaces:**
- Consumes: `MTO_ITEM`, `LOGO_ITEM` from Task 1.
- Produces, on `uniform.localhost`: the custom fields; items `UA-MTO-*`; customers BrainWise Technology (with contact and address), Delta Hotels, Nile Logistics; role UniformAI Portal and user `portal@uniform.localhost`; reader read on Quotation and Delivery Note; stock scenario Polo Sand M at 0. Helpers `api`, `find`, `list`, `create`, `submit`, `cancel`, `remove`, `call`, `grant` inside the script, used by Task 3.

- [ ] **Step 1: Write the seed's first half**

Rewrite `scripts/seed-erp.ts` with: the HTTP helpers; `ensureCustomField(dt, fieldname, props)` creating `Custom Field` `${dt}-${fieldname}`; `grant(parent, role, ptypes)` calling `permission_manager.add` then `update` for each extra ptype; customers (+ `Contact` Ahmed Osama and a Cairo `Address` linked to BrainWise); item group "Made to order"; the five `UA-MTO-*` items (non-stock); the existing ready-stock templates, variants and opening receipt (kept as they are); a Material Issue (`remarks: 'UniformAI demo stock-out'`) that issues all of `UA-POLO-SAND-M`; and a one-time cleanup of the first seed's documents (Sales Invoice `remarks = 'UniformAI management sample invoice'`, the Delivery Notes against `po_no UNIFORMAI-SAMPLE-*`, then those Sales Orders and `UNIFORMAI-DELTA`: cancel, then delete). The full script is in the repo after this task; its key helpers:

```ts
async function grant(parent: string, role: string, extra: string[] = []) {
  if (!(await find('Custom DocPerm', [['parent', '=', parent], ['role', '=', role]]))) {
    await call('frappe.core.page.permission_manager.permission_manager.add', { parent, role, permlevel: 0 });
  }
  for (const ptype of extra) {
    await call('frappe.core.page.permission_manager.permission_manager.update',
      { doctype: parent, role, permlevel: 0, ptype, value: 1 });
  }
}

async function ensureCustomField(dt: string, fieldname: string, props: Record<string, unknown>) {
  if (!(await find('Custom Field', [['name', '=', `${dt}-${fieldname}`]]))) {
    await create('Custom Field', { dt, fieldname, ...props });
  }
}

for (const dt of ['Quotation', 'Sales Order', 'Delivery Note', 'Sales Invoice']) {
  await ensureCustomField(dt, 'uniformai_kit',
    { label: 'UniformAI kit', fieldtype: 'Long Text', hidden: 1, allow_on_submit: 1 });
  await ensureCustomField(dt, 'uniformai_ref',
    { label: 'UniformAI ref', fieldtype: 'Data', read_only: 1, allow_on_submit: 1 });
}

for (const dt of ['Sales Order', 'Sales Invoice', 'Item', 'Bin', 'Warehouse', 'Customer', 'Quotation', 'Delivery Note']) {
  await grant(dt, 'API Reader');
}
for (const dt of ['Quotation', 'Sales Order']) await grant(dt, 'UniformAI Portal', ['create']);
for (const dt of ['Customer', 'Item', 'Address', 'Account']) await grant(dt, 'UniformAI Portal');
```

Done 2026-09-29. The live probe (Step 3) found the Portal user needs read on
**Address** (the quote fills in the customer's address) and **Account** (the
receivable account sets the currency); both are in the seed. Submit, cancel,
delete and editing a customer are refused (403).

- [ ] **Step 2: Run the seed and generate the Portal key**

Run: `set -a; . ./.env.local; set +a; npx tsx scripts/seed-erp.ts`
Expected: finishes without error. Then generate the key for `portal@uniform.localhost` (`frappe.core.doctype.user.user.generate_keys` as Administrator) and set `ERP_WRITE_KEY=key:secret` in `.env.local`; add `ERP_WRITE_KEY=` to `.env.example`.

- [ ] **Step 3: Probe the Portal user's permissions against the live site**

With `ERP_WRITE_KEY`: insert a draft Quotation for BrainWise (`uniformai_ref: 'probe'`, one `UA-MTO-POLO` line), have the seed key submit it, call `erpnext.selling.doctype.quotation.quotation.make_sales_order` with the Portal key, and insert the mapped Sales Order with the Portal key. Then also try `frappe.client.submit` with the Portal key on the Sales Order.
Expected: every create succeeds; the Portal submit is refused with 403. For each 403 on a create or map, `grant` read on exactly the doctype the error names, rerun, and record it in the seed. Clean up: cancel and delete the probe documents with the seed key.

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-erp.ts .env.example
git commit -m "Seed the workflow's masters, custom fields and a draft-only Portal user"
```

---

### Task 3: Seed the document chains, the history, and reset

**Files:**
- Modify: `scripts/seed-erp.ts`

**Interfaces:**
- Consumes: Task 1's `kitLines`, `kitEstimate`, `Kit`; Task 2's helpers.
- Produces, on `uniform.localhost`: the refs and states in the spec's "Demo data" tables; `npm run seed:erp -- --reset`.

- [ ] **Step 1: Write the chain builder**

```ts
type Stop = 'quote-draft' | 'quote' | 'order' | 'partial' | 'delivered' | 'invoiced';
type Chain = {
  ref: string; customer: string; kit: string; staff: number; date: string; stop: Stop;
  sizes?: 'later' | 'allocated'; discount?: number; rates?: Partial<Record<GarmentType, number>>;
};

const byRef = (doctype: string, ref: string) => find(doctype, [['uniformai_ref', '=', ref]]);

async function chain(c: Chain) {
  const kit = kitFor(c);                     // Kit from CONCEPTS, sets = ceil(staff * 1.05)
  const lines = kitLines(kit).map((l) => {   // the team's price for this deal, if it differs
    const type = (Object.entries(MTO_ITEM).find(([, code]) => code === l.item_code)?.[0]) as GarmentType | undefined;
    return type && c.rates?.[type] ? { ...l, rate: c.rates[type]! } : l;
  });
  const current = c.stop === 'quote-draft' || c.stop === 'quote';
  let q = await byRef('Quotation', c.ref) ?? await create('Quotation', {
    quotation_to: 'Customer', party_name: c.customer, company, order_type: 'Sales',
    transaction_date: c.date,
    // ERPNext will not turn an expired quotation into an order, so the
    // back-dated history carries no validity date.
    ...(current ? { valid_till: plus(c.date, 30) } : {}),
    items: lines, uniformai_kit: JSON.stringify(kit), uniformai_ref: c.ref,
    ...(c.discount ? { apply_discount_on: 'Grand Total', additional_discount_percentage: c.discount } : {}),
  });
  if (c.stop === 'quote-draft') return;
  q = await submit(q);
  if (c.stop === 'quote') return;

  const soDate = plus(c.date, 1);
  let so = await byRef('Sales Order', c.ref);
  if (!so) {
    const mapped = await call<Doc>('erpnext.selling.doctype.quotation.quotation.make_sales_order', { source_name: q.name });
    const due = plus(soDate, 21);
    so = await submit(await create('Sales Order', {
      ...mapped, transaction_date: soDate, delivery_date: due,
      items: (mapped.items as Doc[]).map((i) => ({ ...i, delivery_date: due })),
    }));
  }
  if (c.stop === 'order') return;

  const dnDate = plus(soDate, c.stop === 'partial' ? 14 : 21);
  if (!(await byRef('Delivery Note', c.ref))) {
    const mapped = await call<Doc>('erpnext.selling.doctype.sales_order.sales_order.make_delivery_note', { source_name: so.name });
    const items = (mapped.items as Doc[]).map((i) => ({ ...i, qty: c.stop === 'partial' ? Math.floor(Number(i.qty) / 2) : i.qty }));
    await submit(await create('Delivery Note', { ...mapped, items, set_posting_time: 1, posting_date: dnDate }));
  }
  if (c.stop !== 'invoiced') return;

  if (!(await byRef('Sales Invoice', c.ref))) {
    const mapped = await call<Doc>('erpnext.selling.doctype.sales_order.sales_order.make_sales_invoice', { source_name: so.name });
    await submit(await create('Sales Invoice', {
      ...mapped, set_posting_time: 1, posting_date: dnDate, due_date: plus(dnDate, 30),
    }));
  }
}
```

- [ ] **Step 2: Declare the demo account**

```ts
const T = (days: number) => plus(isoDay(new Date()), -days);   // days before today
const CURRENT: Chain[] = [
  { ref: 'demo-front-office', customer: BRAINWISE, kit: 'front-office', staff: 18, date: T(0), stop: 'quote-draft' },
  { ref: 'demo-technicians', customer: BRAINWISE, kit: 'technicians', staff: 40, date: T(2), stop: 'quote', discount: 5 },
  { ref: 'demo-operations', customer: BRAINWISE, kit: 'operations', staff: 24, date: T(10), stop: 'order', sizes: 'later' },
  { ref: 'demo-management-now', customer: BRAINWISE, kit: 'management', staff: 12, date: T(20), stop: 'partial', sizes: 'allocated' },
  { ref: 'demo-delta', customer: 'Delta Hotels', kit: 'front-office', staff: 30, date: T(15), stop: 'order' },
  { ref: 'demo-nile', customer: 'Nile Logistics', kit: 'operations', staff: 50, date: T(6), stop: 'quote' },
];
const HISTORY: Chain[] = [
  { ref: 'demo-hist-01', customer: BRAINWISE, kit: 'operations', staff: 20, date: '2026-01-15', stop: 'invoiced', sizes: 'allocated' },
  { ref: 'demo-hist-02', customer: BRAINWISE, kit: 'technicians', staff: 30, date: '2026-03-10', stop: 'invoiced', sizes: 'allocated' },
  { ref: 'demo-hist-03', customer: BRAINWISE, kit: 'front-office', staff: 10, date: '2026-04-08', stop: 'invoiced', sizes: 'allocated' },
  { ref: 'demo-hist-04', customer: BRAINWISE, kit: 'management', staff: 12, date: '2026-06-03', stop: 'invoiced', sizes: 'allocated', rates: { blazer: 1420 } },
  { ref: 'demo-hist-05', customer: BRAINWISE, kit: 'operations', staff: 8, date: '2026-07-12', stop: 'invoiced', sizes: 'allocated' },
  { ref: 'demo-hist-06', customer: BRAINWISE, kit: 'management', staff: 12, date: '2026-08-05', stop: 'invoiced', sizes: 'allocated' },
  { ref: 'demo-hist-07', customer: BRAINWISE, kit: 'technicians', staff: 6, date: '2026-09-01', stop: 'invoiced', sizes: 'allocated' },
];
```

`demo-hist-07` (a September reorder, delivered 23 Sep) is in addition to the spec's six, so the last month has completed history as well as open orders. Every `HISTORY` date plus 22 days is on or before today (29 Sep 2026); the script asserts it.

- [ ] **Step 3: Write reset**

`--reset` handles `CURRENT` refs only. `HISTORY` has fixed dates and never changes, so it is kept. The steps:
- For each of Sales Invoice, Delivery Note, Sales Order, Quotation, in that order: list documents whose `uniformai_ref` is in the `CURRENT` refs, cancel those with `docstatus = 1`, then delete. Documents the app made from a seeded quote carry the same ref (ERPNext's mapping copies it), so they go too.
- Post one Stock Reconciliation (`remarks: 'UniformAI demo stock reset'`) setting every `UA-` variant's Bin back to its seeded quantity (Navy XL: Stores 260; Sand M: 0; others: Stores 80, Finished Goods 40), only for the Bins that differ.
- Then seed as normal.

- [ ] **Step 4: Run it, twice, and check the account**

Run: `npm run seed:erp`, then `npm run seed:erp` again.
Expected: the second run creates nothing (it logs "exists" for every ref). Then with the read key:
- Quotations for BrainWise: `demo-front-office` Draft; `demo-technicians` Open with `grand_total` 5% under `kitEstimate`; the rest Ordered.
- Sales Orders for BrainWise: `demo-operations` To Deliver and Bill; `demo-management-now` 50% delivered; every `demo-hist-*` Completed.
- `UA-POLO-SAND-M` Bins at 0; `UA-POLO-NAVY-XL` at 260 in Stores.

- [ ] **Step 5: Rehearse reset**

With the Portal key, approve `demo-technicians` into a draft Sales Order and submit it with the seed key; set Navy XL to 40 with a hand-made Stock Reconciliation. Run `npm run seed:erp -- --reset`.
Expected: `demo-technicians` is a fresh Open quotation with no Sales Order; Navy XL is 260 again; the hand-made reconciliation still exists; `demo-hist-*` untouched.

- [ ] **Step 6: Commit**

```bash
git add scripts/seed-erp.ts
git commit -m "Seed the demo account through ERPNext's own sales mapping, with reset"
```

---

### Task 4: Documents → the app's orders

**Files:**
- Modify: `lib/orders.ts`, `lib/order.ts`
- Test: `lib/orders.test.ts`

**Interfaces:**
- Consumes: `Kit`, `kitEstimate` (Task 1).
- Produces:
  - In `lib/order.ts`: `type Workflow = 'quote_requested' | 'quote_ready' | 'quote_closed' | 'awaiting' | 'collecting_sizes' | 'in_progress' | 'delivered'`; `STEPS = ['requested', 'issued', 'approved', 'confirmed', 'delivered'] as const`; `Order` gains `state: Workflow`, `quote?: string`, `salesOrder?: string`, `deliveryNote?: string`, `dates: Partial<Record<typeof STEPS[number], Date>>`, `estimate: number`, `perDelivered: number`, and `concept`/`lines` become optional (absent without kit JSON). `stage`, `STAGES`, `STAGE_KEYS`, `stageDate` and `progress` are removed; `status(o)` returns the `Workflow`.
  - In `lib/orders.ts`: `type QuoteRow`, `SalesOrderRow`, `DeliveryRow` (the list-API fields named in the spec's Flow) and `toOrders(quotes: QuoteRow[], orders: SalesOrderRow[], deliveries: DeliveryRow[]): Order[]`, newest first.

- [ ] **Step 1: Write the failing tests**, appended to `lib/orders.test.ts`: one assertion per row of the spec's States table, built from document rows only; the chain join (a Sales Order row with `prevdoc_docname` finds its quote, a Delivery Note row with `against_sales_order` finds its order); a Sales Order with no quote and no kit JSON maps with `concept === undefined`; a quote whose `grand_total` differs from `kitEstimate` keeps both, and `total` is the quoted one; `status: 'Lost'` and `'Expired'` map to `quote_closed`.
- [ ] **Step 2:** Run `npx tsx lib/orders.test.ts`, expect FAIL (`toOrders` missing).
- [ ] **Step 3: Implement** `toOrders` and the `lib/order.ts` changes. State rules: quote `docstatus 0` → `quote_requested`; `docstatus 1` and status `Open`/`Replied` with no Sales Order → `quote_ready`; `Lost`/`Expired` → `quote_closed`; Sales Order `docstatus 0` → `awaiting`; `docstatus 1`: `per_delivered >= 100` → `delivered`, else sizes complete (`sizePlan.mode === 'allocate_now'` and `allocatedSizeCount(allocation, cuts) === sets`) → `in_progress`, else `collecting_sizes`. `lines` come from `placeOrder`'s existing line builder applied to the kit, so the Orders screen's line table keeps working.
- [ ] **Step 4:** Run `npx tsx lib/orders.test.ts`, expect PASS. Run `npx tsc --noEmit`; fix every caller of the removed stage API that the compiler lists (they are rewritten in Task 6; here, make them compile against `status()` and `STEPS`).
- [ ] **Step 5: Commit** `git commit -m "Read an order's state from its ERPNext documents"`

---

### Task 5: Server reads and writes, and the routes

**Files:**
- Create: `lib/sales.ts`, `lib/sales.test.ts`, `app/api/orders/route.ts`, `app/api/quotes/route.ts`, `app/api/quotes/[name]/approve/route.ts`
- Modify: `lib/erp.ts`

**Interfaces:**
- Consumes: `toOrders`, `kitLines`, `Kit` (Tasks 1, 4).
- Produces:
  - `lib/erp.ts`: `list`/`get` unchanged (read key); `insert(doctype, doc, key: 'write')` and `call(method, args, key: 'read' | 'write')`.
  - `lib/sales.ts`: `listOrders(): Promise<Order[]>`; `requestQuote(input: unknown): Promise<Order>`; `approveQuote(name: string): Promise<Order>`; `class SalesError extends Error { status: 400 | 404 | 409 }`.
  - Routes: `GET /api/orders` → `Order[]`; `POST /api/quotes` → `Order` (201); `POST /api/quotes/[name]/approve` → `Order`. Errors: `SalesError` → its status with `{ error }`; `ErpError` → 502.

- [ ] **Step 1: Write the failing tests** in `lib/sales.test.ts`, stubbing `fetch` as `lib/ask.test.ts` does:
  - `requestQuote` with a body carrying `customer: 'Delta Hotels'`, `rate`, `total` sends a Quotation with `party_name: 'BrainWise Technology'` and the rates from `kitLines`, and `uniformai_ref` starting `app-`.
  - `requestQuote` with a missing or malformed kit throws `SalesError` 400 and sends nothing.
  - `approveQuote` refuses (409) a draft quote, a quote with status `Ordered`, and (404) another customer's quote, sending no write.
  - Approving the same quote twice: the second call sees the first Sales Order (the read returns it) and refuses with 409.
  - An `ErpError` from the insert propagates (the route maps it to 502).
- [ ] **Step 2:** Run `npx tsx lib/sales.test.ts`, expect FAIL.
- [ ] **Step 3: Implement** `lib/erp.ts` `insert`/`call` (same `request` with the chosen key; `ERP_WRITE_KEY` required only for writes), `lib/sales.ts` (validation of the kit shape: known concept garment types, `staff` and `sets` positive integers ≤ 5000, `grades` integers 0–2; approve reads the quote with the read key, checks `party_name`, `docstatus === 1`, status `Open`/`Replied`, and no Sales Order row with `prevdoc_docname = name`, then calls `make_sales_order` and inserts with the write key, delivery date today + 21), and the three routes.
- [ ] **Step 4:** Run `npx tsx lib/sales.test.ts` and `npm test`, expect PASS. Then live: `curl -s localhost:3100/api/orders` returns the seeded orders with the states from Task 3.
- [ ] **Step 5: Commit** `git commit -m "Request and approve quotes through ERPNext, and list the customer's orders"`

---

### Task 6: Workflow states on the screens and in the notes

**Files:**
- Modify: `lib/manager.ts`, `lib/manager.test.ts`, `lib/i18n.ts`, `app/page.tsx` (StatusPill, Orders timeline, Home counts)

**Interfaces:**
- Consumes: `Workflow`, `STEPS`, `status()` (Task 4).
- Produces: `orderNote(locale, o)` and `greeting(locale, name, orders)` per state; i18n keys `orders.state.<Workflow>` and `orders.step.<step>` in both languages.

- [ ] **Step 1: Failing tests** in `lib/manager.test.ts`: `orderNote` for `quote_ready` names the quoted total and asks for approval; for `awaiting` says UniformAI is confirming; `greeting` with one `quote_ready` order leads with it.
- [ ] **Step 2:** Run, expect FAIL.
- [ ] **Step 3: Implement** the notes and strings; the timeline renders `STEPS` with each reached step's document number (`quote`, `salesOrder`, `deliveryNote`) and date from `o.dates`; the pill and Home counts use `status()` (Home groups: waiting on you = `quote_ready`; with UniformAI = `quote_requested` + `awaiting`; in production = `collecting_sizes` + `in_progress`; delivered).
- [ ] **Step 4:** `npm test` and `npx tsc --noEmit` pass.
- [ ] **Step 5: Commit** `git commit -m "Show the sales workflow on the order timeline and in the notes"`

---

### Task 7: The app on live orders

**Files:**
- Modify: `app/page.tsx`, `lib/i18n.ts`, `app/ui.module.css`
- Delete: `lib/erp-samples.json`

**Interfaces:**
- Consumes: the Task 5 routes.

- [ ] **Step 1:** Replace the orders `useEffect` (localStorage and samples) with a `loadOrders()` that fetches `/api/orders` into `orders`, a `loadState: 'loading' | 'ready' | 'failed'`, called on mount, on entering Orders or Home, and on `window` `focus`. Remove the `orders` localStorage writes and the `erpSamples` import; delete `lib/erp-samples.json`.
- [ ] **Step 2:** Quote dialog: the confirm action becomes "Request quote" → `POST /api/quotes` with `{concept, staff, sets, grades, sizePlan}`; while pending the button reads "Requesting…" and is disabled; on success, toast the quote number, reload orders, open Orders on it; on failure, show the error in the dialog.
- [ ] **Step 3:** Orders: on `quote_ready`, show the quoted lines and total (and "Estimate" beside it when different) and an "Approve quote" button → `POST /api/quotes/<quote>/approve`, "Approving…" while pending, error beside the button, reload on success. On `loadState === 'failed'`, show "We couldn't load your orders" with "Try again".
- [ ] **Step 4:** In the browser, in Arabic and English: every seeded state renders; Request quote creates a draft visible in ERPNext; submitting it in ERPNext and focusing the app tab shows Quote ready; Approve creates a draft Sales Order; submitting it shows the confirmed state; stopping ERPNext shows the load error.
- [ ] **Step 5: Commit** `git commit -m "Run the app's orders on ERPNext's sales workflow"`

---

### Task 8: The guided assistant

**Files:**
- Create: `lib/answers.ts`, `lib/answers.test.ts`
- Modify: `lib/ask.ts`, `lib/ask.test.ts`, `app/api/ask/route.ts`, `components/ask-erp.tsx`, `lib/i18n.ts`, `package.json`, `.env.example`

**Interfaces:**
- Consumes: `listOrders` (Task 5), `Source`/`changesSince` (`lib/evidence.ts`).
- Produces: `POST /api/ask {intent, params}` → `{ rows, sources, step }`; `answer(locale, intent, rows): string`; `options(): Promise<{ item: string; colours: string[]; sizes: string[] }[]>`.

- [ ] **Step 1: Failing tests** in `lib/answers.test.ts`: `orders` with 3 orders counts them by state; `order` for `quote_ready` says it awaits their approval; `stock` with 260 says yes and the number; `stock` with a Bin at 0 says out of stock; `stock` with no rows and `price` with no rows say there is no record; each in `ar` and `en`. In `lib/ask.test.ts`: `options` groups variant attributes per template; an unknown intent is rejected.
- [ ] **Step 2:** Run, expect FAIL.
- [ ] **Step 3: Implement.** `lib/ask.ts`: delete `ask()`, `SYSTEM`, `TOOLS` and the Anthropic import; keep `checkStock`, `lastPrice`; `orders`/`order` intents call `listOrders` and build Sales Order / Quotation sources from it; add `options`. Route: validate `intent` against the five, run it, return JSON. Component: the button flow in the spec (menu → orders / stock garment → colour → size / price garment), taps shown as the customer's messages, "Check again" re-running the last stock params, cards and the change check as today, no text input. `npm uninstall @anthropic-ai/sdk`; remove `ANTHROPIC_*` from `.env.example`.
- [ ] **Step 4:** `npm test`, `npx tsc --noEmit` pass; in the browser, every path of the flow in both languages, and 260 → 40 via Check again after a live reconciliation.
- [ ] **Step 5: Commit** `git commit -m "Replace the model with a guided assistant built from ERPNext data"`

---

### Task 9: Rehearsal and README

**Files:**
- Modify: `README.md`

- [ ] **Step 1:** `npm run seed:erp -- --reset`, then run the spec's rehearsal table top to bottom; every row as expected.
- [ ] **Step 2:** README: the three keys, `npm run seed:erp` / `-- --reset`, the demo script (the rehearsal table's actions in order), and that orders now live in ERPNext.
- [ ] **Step 3: Commit** `git commit -m "Document the ERPNext demo and its reset"`
