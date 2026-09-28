# ERP-grounded assistant: design

Date: 2026-09-28
Status: implemented

## Why

A client asked to see the assistant answer questions *against our ERP* and
show where each answer came from. The demo has to make one claim believable
in about four minutes: **the assistant reads the ERP, cites the record it
read, and says so when the ERP does not know.**

Today every assistant line in the app is derived from data the app holds
(`lib/manager.ts`), and the ERP is only named at stand-in seams
(`lib/order.ts:35`, `lib/order.ts:108`). This adds the first real ERP read and
the first real model call.

## What the client sees

- A launcher on the **Orders** screen opens the existing dock (`s.dock`,
  `s.dockPanel`): the same assistant, now answering account questions. The
  configure screen's designer chat is unchanged.
- Each answer is followed by **"Checked N records"** and one chip per record:
  doctype, name, one status line, the time it was read. A chip opens that
  record in ERPNext (`/app/<doctype-slug>/<name>`) in a new tab.
- An answer built from no records has no chips and says the ERP holds nothing
  matching.
- The page opens in Arabic (the app's default). Questions may be Arabic or
  English; the answer is in the language asked. ERP data (item names, record
  names) stays as ERPNext stores it.

### Demo script (~4 min)

1. **Order.** On Orders, ask about the order in production by the id shown on
   screen: *"هل الطلب <id> في موعده؟"*. The id is the ERP name the seed
   assigned (see `lib/erp-samples.json`). The answer gives the ERP status, delivery
   date and % delivered, with a Sales Order chip. Click it: ERPNext opens on
   the same record.
2. **Stock.** *"عندكم 200 بولو كحلي مقاس XL؟"*. The answer gives quantities per
   warehouse from `Bin` records.
3. **The live change.** In ERPNext, submit a Stock Reconciliation that drops
   Navy Polo XL to 40. Ask again: the answer changes. This is the proof that
   nothing is scripted.
4. **Price.** *"How much did we pay per blazer last time?"* cites the Sales
   Invoice.
5. **Honesty.** *"Do you have pink hazmat suits?"*: "I couldn't find that in
   our system", with no chip.
6. **Scope.** Ask for an order belonging to another customer (Delta Hotels):
   not found. The assistant runs as one customer, enforced in server code.

The assistant does **not** report production stages ("Sewing", "Checks").
ERPNext does not hold them; the app's timeline is app-side. The assistant says
only what the ERP knows: status, delivery date, % delivered, % billed.

## Architecture

```
Orders screen ──POST /api/ask {question, history, locale}──▶ route.ts
                                                          │
                                        lib/ask.ts: loop, max 5 rounds
                                          │  claude-opus-5 + 3 tools
                                          ▼
                                   lib/erp.ts ──token (read-only)──▶ ERPNext
                                          │
◀──── {answer, sources[], trace[]} ───────┘
```

One new dependency: `@anthropic-ai/sdk`. Secrets are read only on the server,
from `.env.local`:

```
ERP_URL=http://uniform.localhost:8000
ERP_READ_KEY=key:secret     # "API Reader" user: read-only, used by the app
ERP_SEED_KEY=key:secret     # Administrator: used only by the seed script
ANTHROPIC_API_KEY=...       # or an `ant auth login` profile
```

### Files

| File | Responsibility |
|---|---|
| `lib/erp.ts` | `list(doctype, {fields, filters, orderBy, limit})`, `get(doctype, name)`, `deskUrl(doctype, name)`. `fetch` with `Authorization: token <key>`, 8 s timeout. Throws `ErpError` on non-2xx or timeout. |
| `lib/ask.ts` | The three tools, the system prompt, and `ask(question, history, locale)`: the manual tool loop that returns `{answer, sources, trace}`. |
| `app/api/ask/route.ts` | `POST`. Validates the body, calls `ask()`, maps failures to status codes. |
| `components/ask-erp.tsx` | The dock on Orders: transcript, input, source chips, the "Checked N records" line. |
| `scripts/seed-erp.ts` | Creates the demo data with `ERP_SEED_KEY`. Safe to re-run. Writes `lib/erp-samples.json`. |
| `lib/erp-samples.json` | The names and dates of the three seeded sample orders, read by `app/page.tsx`. |
| `lib/ask.test.ts` | Checks, in the repo's `tsx` + `assert` style. |

## Tools

All tools are read-only and scoped to one customer. **The customer is not a
tool parameter.** `lib/ask.ts` adds `["customer","=",DEMO_CUSTOMER]` to every
query that has a customer field, so no prompt wording can reach another
customer's records. `DEMO_CUSTOMER = "BrainWise Technology"`, the company in
the app's profile (`app/page.tsx:48`).

Each tool returns `{rows, sources}`. A source is
`{doctype, name, label, url, readAt}`. An empty `rows` means an empty
`sources`.

### `find_orders({order_id?})`

- Sales Orders for the customer, newest first, limit 10; or the one matching
  `order_id`.
- Fields: `name, status, transaction_date, delivery_date, per_delivered,
  per_billed, grand_total, currency`, plus item lines (`items.item_name`,
  `items.qty`) via the list API's child-field join.
- Source: one per Sales Order returned.

### `check_stock({item, colour?, size?})`

- `item` is a template name (Polo, Cargo Trouser, Shirt, Chino, Blazer).
  Matched case-insensitively against templates, including Arabic aliases held
  in a small map in `lib/ask.ts` (بولو → Polo, and so on).
- Variants are listed with `fields=["name","attributes.attribute",
  "attributes.attribute_value"]` filtered by `variant_of`, then filtered in
  code. The list API joins child rows one at a time, so two attribute filters
  in one query match nothing.
- For each matching variant: `Bin` rows (`warehouse, actual_qty,
  reserved_qty, projected_qty`).
- Sources: the variant Item, and one per `Bin` row.
- No customer filter: stock is not customer data.

### `last_price({item})`

- The customer's latest submitted Sales Invoice containing a variant of
  `item`: `fields=["name","posting_date","items.item_code","items.rate",
  "items.qty"]`, `filters=[customer, docstatus=1, items.item_code in
  variants]`, newest first, limit 1.
- Source: that Sales Invoice.

## The loop and the prompt

- Model `claude-opus-5`, `output_config.effort: "low"` to keep answers to a
  few seconds, server-side refusal fallback (`fallbacks: "default"`, beta
  `server-side-fallback-2026-07-01`), `max_tokens` 4000, non-streaming.
- A manual loop, not the beta tool runner: about 25 lines, no zod, and
  collecting sources as tool results come back is a line in the loop. It stops
  on `end_turn`, `refusal` or 5 rounds.
- Parallel tool calls are run together and returned in one user message.
- **Sources are every record a tool returned this turn**, de-duplicated. The
  model never produces the source list, so it cannot cite something it did
  not read. The UI calls these "records checked", not "citations", because
  that is exactly what they are.
- The system prompt (frozen, so it caches) says:
  - Answer only from tool results. Never estimate a date, quantity or price.
  - If the tools return nothing, say the system has no matching record.
  - Name the record (e.g. its Sales Order name) the answer comes from.
  - Answer in the language of the question. Keep it to two or three sentences.
  - You answer for BrainWise Technology only.
- `history` is the transcript text from the dock (the last 6 turns), so a
  follow-up like "and in L?" works. Tool results are not replayed; the model
  re-reads the ERP each turn, so answers are always current.

## Errors

| Failure | Behaviour |
|---|---|
| ERPNext down, slow (>8 s) or 5xx | The tool returns `is_error: true` with "ERP unavailable". The model says it cannot reach the system right now. No sources. |
| ERPNext 401/403 | Same, and the route logs "check ERP_READ_KEY". |
| Claude API error | Route returns 502. The dock shows "Couldn't reach the assistant" in the page's language. |
| Refusal after fallback | The dock shows the same message. |
| Body invalid, question empty or over 500 characters | 400. |
| Missing env vars | 500 with a server log naming the missing variable. |

## Seed data (`scripts/seed-erp.ts`)

Run with `npx tsx scripts/seed-erp.ts`. It uses the app's own code
(`lib/concepts.ts`, `lib/spec.ts`, `lib/order.ts`) to build the orders, so
ERP totals and the app's totals come from one calculation. Every created
record is found first by a stable key, so a second run creates nothing new.

- **Setup it expects:** the setup wizard finished, company currency EGP.
- **Role:** "API Reader", with read only on Sales Order, Sales Invoice, Item,
  Bin, Warehouse, Customer. Child tables (items, attributes) follow their
  parent's permission. User
  `api.reader@uniform.localhost` with only that role. The seed script creates
  both but not the key: generate that in the user's Settings tab and put it in
  `.env.local`.
- **Customers:** BrainWise Technology (the demo customer), Delta Hotels (for
  the scope step).
- **Items:** attributes Colour (Navy, Sand, Olive, White, Pale Blue, Charcoal,
  Khaki) and Size (S, M, L, XL). Templates Polo, Cargo Trouser, Shirt, Chino,
  Blazer, with variants for the colours the sample kits use. A service item
  per logo method ("Embroidery", "Print").
- **Stock:** Material Receipt into "Stores" and "Finished Goods". Navy Polo XL
  is held only in "Stores", 260 pieces, so step 2 answers yes and step 3's
  single-warehouse reconciliation to 40 makes it no. Other variants are
  spread across both warehouses so step 2 still shows the per-warehouse
  shape for other sizes.
- **Sales Orders:** the three app samples (Technicians, Operations,
  Management), submitted, keyed by `po_no = UNIFORMAI-SAMPLE-<n>`. Lines are
  the garments at the app's unit prices plus one logo line. `delivery_date` is
  `transaction_date + 21 days`, the app's lead time. The script asserts each
  ERP `grand_total` equals the app's `perPerson × sets`. One more Sales Order
  for Delta Hotels.
- **Invoice:** the delivered Management order is invoiced (submitted), which
  gives step 4 its blazer price.
- **Output:** `lib/erp-samples.json` holds `[{name, placed}]` for the three
  samples. `app/page.tsx` builds its fallback sample orders from it: the id is
  the ERP name and `placed` is the ERP `transaction_date`. The Orders screen
  and ERPNext then agree on ids and dates without re-seeding. Stages stay
  app-side, as today.

Before a demo, clear the browser's `orders` key in localStorage so the samples
show. That is how the samples already behave.

## Testing

`lib/ask.test.ts`, run by the existing `npm test`, with `fetch` replaced by a
stub:

1. Every Sales Order and Sales Invoice request carries the customer filter,
   and no tool input can remove or change it.
2. A tool that gets zero rows returns zero sources.
3. `deskUrl("Sales Order", "SAL-ORD-2026-00002")` is
   `<ERP_URL>/app/sales-order/SAL-ORD-2026-00002`.
4. A variant matches only when both colour and size match.
5. An ERP timeout becomes an `is_error` tool result, not a thrown route error.

The model is not tested in CI. It is tested by the **rehearsal**: run the six
script steps against the seeded site and check each against this table.

| Step | Expect |
|---|---|
| 1 | Status, delivery date, % delivered; 1 Sales Order chip; the link opens it |
| 2 | Per-warehouse quantities, total ≥ 200 → yes; Item and Bin chips |
| 3 | After the reconciliation, total 40 → no |
| 4 | Blazer rate from the Management invoice; 1 Sales Invoice chip |
| 5 | Not found; no chips |
| 6 | Not found; no chips |

## Out of scope

- Production stages in the ERP (Work Orders). The app's timeline stays
  app-side.
- Writing to the ERP: placing app orders as Sales Orders, updating anything.
- Login and multiple customers: one demo customer, a constant.
- Streaming answers token by token. Answers are short; the dock shows a
  "checking ERPNext…" state until the answer arrives.
- Invoices and balances as a demo question.
- Voice input in this dock.
