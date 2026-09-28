# ERPNext orders and the guided assistant: design

Date: 2026-09-29
Status: draft, awaiting review
Supersedes: the model-driven parts of
`2026-09-28-erp-grounded-assistant-design.md` (the Claude loop, the prompt,
the streamed steps). Its ERP reads, customer scoping and evidence cards stay.

## Why

The client demo shows **ERPNext's standard sales workflow**, driven from the
**UniformAI customer's** side (BrainWise Technology), who never hears the
word ERPNext:

1. The customer designs a kit in the app and taps **Request quote**.
   A **draft Quotation** appears in ERPNext.
2. UniformAI's team reviews it (and may adjust prices) and **submits** it.
   The app shows **Quote ready** with ERPNext's prices.
3. The customer taps **Approve quote**. A **draft Sales Order** is made
   *from the Quotation* (ERPNext's own mapping, so the two are linked).
4. The team **submits** the Sales Order. The app shows the order confirmed.
5. The normal flow continues to a **Delivery Note**. The app shows it
   delivered.
6. At any point the customer checks orders, stock and prices through a
   **guided assistant** (buttons, no free text, no AI model), and every
   answer shows the records it was read from.

The app shows every step with its real document number and date, so the
workflow is visible on both screens: the customer's app and ERPNext's own
Quotation → Sales Order → Delivery Note links.

## Decisions

| Question | Decision |
|---|---|
| Sales flow | Quotation → customer approves → Sales Order → team submits → Delivery Note. |
| Who issues the Quotation | The app creates a draft; UniformAI's team submits it in ERPNext. The submitted Quotation's price is the price. |
| How a custom kit appears on the documents | A made-to-order item per garment type; the full design as JSON on the Quotation, carried to the Sales Order. The stocked variants (Polo Navy XL, ...) stay as ready stock the assistant reports on. |
| Production stages | Only what ERPNext documents record. No Work Orders. |
| Assistant | Guided buttons. No model, no API key. |

## Part 1: The sales workflow lives in ERPNext

### Data on the documents

- **Customer:** always `BrainWise Technology`, set on the server
  (`party_name` on the Quotation, `customer` on the Sales Order).
- **Lines:** one per garment, item `UA-MTO-<TYPE>` ("Polo (made to order)",
  non-stock), `qty = sets`, `rate = garment.unitPrice + grade delta`, and a
  description such as "Navy body, white collar · Cotton Pique 220 GSM ·
  regular fit". One logo line (`UA-EMBROIDERY` or `UA-PRINT`,
  `rate = LOGO_PRICE`) when the kit has a logo. On the draft these sum to
  the app's estimate, `conceptPriceAt(concept, grades) × sets`.
- **`uniformai_kit`:** a hidden Long Text custom field, allowed on submit,
  on **both** Quotation and Sales Order, holding
  `{concept, staff, sets, grades, sizePlan}` as JSON. The same fieldname on
  both means ERPNext's Quotation → Sales Order mapping copies it. The app
  redraws the kit and the size status from it.
- **Quotation:** `valid_till = transaction_date + 30` days.
- **Sales Order:** `delivery_date = transaction_date + 21` days, the app's
  lead time.

### States

One order in the app is the chain of documents from one Quotation.

| App state | ERPNext | Customer action |
|---|---|---|
| Quote requested | Quotation draft | wait |
| Quote ready | Quotation submitted, status Open | **Approve quote** |
| Awaiting confirmation | Sales Order draft, made from the Quotation | wait |
| Collecting sizes | Sales Order submitted, size plan not complete | |
| In progress | Sales Order submitted, sizes complete, `per_delivered < 100` | |
| Delivered | `per_delivered = 100` | |

"Sizes complete" is today's rule: `sizePlan.mode === 'allocate_now'` and the
allocated count equals `sets`. A partial delivery shows as "60% delivered" on
In progress. A Quotation marked Lost or Expired shows as "Quote closed"
with no action. Cancelled documents (`docstatus = 2`) are not shown.

The six-step timeline (`STAGES` in `lib/order.ts`) becomes the workflow:

```
Quote requested ─ Quote issued ─ Approved by you ─ Order confirmed ─ Delivered
QTN-2026-00001    29 Sep         29 Sep            SAL-ORD-…-00005   MAT-DN-…
```

Each reached step shows its document number and date. `status()`,
`progress()`, the timeline, the status pill, the Home counts and the manager
notes all read the new list.

### Price

- The draft Quotation carries the app's estimate.
- Once submitted, the **Quotation's grand total is the price**: the app
  shows ERPNext's lines and total on Quote ready, and if the team changed
  them, the app shows "Quoted" beside the original estimate.
- The Sales Order is mapped from the Quotation, so it carries the quoted
  prices, not the app's.

### Flow

```
Request quote ─POST /api/quotes {concept, staff, sets, grades, sizePlan}─▶
    server: validate, compute estimate lines ─ERP_WRITE_KEY─▶ Quotation (draft)

Approve quote ─POST /api/quotes/<name>/approve─▶
    server: check it is this customer's submitted, open Quotation
    ─▶ erpnext…quotation.make_sales_order(<name>) ─▶ set delivery_date
    ─▶ insert Sales Order (draft)

Orders/Home ─GET /api/orders─▶ server ─ERP_READ_KEY─▶
    Quotations (docstatus < 2) + Sales Orders + Delivery Notes for the customer,
    joined: Sales Order Item.prevdoc_docname → Quotation,
            Delivery Note Item.against_sales_order → Sales Order
◀── Order[] (the app's shape, one per Quotation chain) ──┘
```

- **Nothing priced by the browser is trusted:** the server builds the draft
  lines itself, and after that the Quotation's own prices rule.
- **Approve** refuses anything that is not this customer's submitted, open
  Quotation, and refuses a Quotation that already has a Sales Order.
- **A Sales Order made by hand in ERPNext** (no Quotation) still lists, from
  Awaiting confirmation on. One without kit JSON lists with its ERPNext lines
  as a plain list and no garment drawing.
- **Staying current:** Orders and Home re-read on page visit and when the
  browser tab regains focus. In the demo: submit in ERPNext, switch back to
  the app tab, and the next state shows. No polling.

### Access

A second ERPNext user, `portal@uniform.localhost`, role **UniformAI Portal**:
create and read on Quotation and Sales Order, read on Customer and Item. No
submit, cancel or delete, on anything. Created by the seed through the
permission manager (never a bare `Custom DocPerm` insert), key in
`ERP_WRITE_KEY`. The read-only `ERP_READ_KEY` user also gets read on
Quotation and Delivery Note.

Unverified: whether inserting a Quotation or mapping a Sales Order needs
read on Company, Price List or Warehouse for this user. The first
implementation task runs both against the live site with the Portal key and
adds exactly the read permissions they ask for, nothing wider.

### Screens

- **Quote dialog:** the button becomes **Request quote** ("Requesting…").
  Success: a toast with the new Quotation number, then Orders with it open.
  Failure: a message in the dialog; nothing is saved anywhere.
- **Orders:** the open order shows the workflow timeline. On Quote ready it
  shows the quoted lines and total and an **Approve quote** button
  ("Approving…"; on failure, a message beside the button).
- **Orders / Home:** a loading state on first read; if ERPNext cannot be
  reached, "We couldn't load your orders" with a retry button, never an
  empty list that looks like no orders.
- **Saved kits** stay in localStorage. They are unfinished designs, not
  orders.

## Part 2: The guided assistant

The dock, the step trail, the evidence cards, the "updated since you last
asked" change and the customer voice all stay. The model goes.

### Flow

```
What would you like to check?
[My orders] [Stock availability] [Last price paid]

My orders      → answer + one card per order → [Details of <order>] … [Menu]
Details        → one order: state, delivery date, lines → [Show order] [Menu]
Stock          → [garment] → [colour] → [size] → answer + cards
                 → [Check again] [Another item] [Menu]
Last price     → [garment] → answer + invoice card → [Menu]
```

- The garment, colour and size buttons come from ERPNext (the templates and
  their variants' attributes), so a button never leads to an item that does
  not exist.
- **Check again** repeats the last stock read. After a Stock Reconciliation
  in ERPNext, the card shows 260 → 40.
- "Ask about this order" on the Orders screen opens the dock on that order's
  details.
- The customer's taps show as their side of the conversation ("Stock
  availability", "Polo", "Navy", "XL"), so it still reads as a chat.

### Answers

Built by `lib/answers.ts` from the rows, per intent, in Arabic and English,
like `lib/manager.ts` builds its notes: they can only state what the rows
hold. Every intent has a nothing-found sentence ("We have no record of
this"). Order states use Part 1's workflow states, and a Quote ready answer
says the quote is waiting for their approval.

### Server

`POST /api/ask {intent, params}` runs one read and returns
`{rows, sources, step}` as JSON.

| Intent | Params | Read |
|---|---|---|
| `orders` | none | the customer's orders, read with Part 1's `GET /api/orders` logic, so the assistant and the Orders screen cannot disagree |
| `order` | `id` | one of those orders, by Quotation or Sales Order number |
| `stock` | `item, colour, size` | `Bin` for that variant |
| `price` | `item` | latest submitted Sales Invoice line |
| `options` | none | templates with their variants' colours and sizes |

An unknown intent or bad params is a 400. The customer filter stays
server-side. `@anthropic-ai/sdk`, the loop, the prompt, the streaming and the
`ANTHROPIC_*` settings are removed.

## Demo data (`scripts/seed-erp.ts`)

The seed makes the app look like an account that has been in use for months,
with one order in every workflow state, so no screen needs a static fallback.
Every record exists to show one integration point, on the customer's screen
and in ERPNext, where each document's Connections show the chain.

### Master data

| Record | Purpose |
|---|---|
| Company UniformAI, EGP, fiscal year 2026 | already created by the setup wizard |
| Customer BrainWise Technology, contact Ahmed Osama, a Cairo address | the demo customer; the contact is the app's user |
| Customers Delta Hotels, Nile Logistics | a real-looking customer list, and records BrainWise must not see |
| Item groups Made to order, Ready stock, Branding | a clean item list |
| `UA-MTO-POLO`, `-CARGO`, `-SHIRT`, `-CHINO`, `-BLAZER` (non-stock) and `UA-EMBROIDERY`, `UA-PRINT` | lines on quotations and orders |
| Ready-stock variants, garment × colour × S–XL, attributes Uniform Colour / Uniform Size | the assistant's stock answers |
| Custom fields `uniformai_kit` (Long Text, hidden, allow on submit) and `uniformai_ref` (Data, read only, allow on submit) on Quotation, Sales Order, Delivery Note, Sales Invoice, Stock Entry, Stock Reconciliation | the kit design, and the marker reset uses |
| Roles API Reader and UniformAI Portal, users `api.reader@` and `portal@uniform.localhost` | the two app keys, through the permission manager |

### Every chain is built the way ERPNext builds it

Quotation → `make_sales_order` → `make_delivery_note` → `make_sales_invoice`,
each submitted with back-dated posting. Every document links to the one
before it, statuses come out right (a delivered and invoiced order reads
Completed), and the Connections tab shows the whole chain. The standalone
invoice and delivery note of the first seed are replaced.

### BrainWise Technology: current orders, one per state

| Ref | Kit | App state | Documents |
|---|---|---|---|
| `demo-front-office` | Front Office, 18 staff | Quote requested | draft Quotation, today |
| `demo-technicians` | Technicians, 40 staff | Quote ready | submitted Quotation with UniformAI's 5% volume discount, so the quoted total differs from the estimate. **The live demo starts here.** |
| `demo-operations` | Operations, 24 staff | Collecting sizes | Quotation → Sales Order, submitted 10 days ago, sizes to be collected |
| `demo-management-now` | Management, 12 staff | In progress, 50% delivered | Quotation → Sales Order → partial Delivery Note; sizes allocated |

### BrainWise Technology: history

Completed chains (Quotation → Sales Order → Delivery Note → Sales Invoice)
spread from January to August 2026, inside the 2026 fiscal year:

| Ref | Month | Kit | Why |
|---|---|---|---|
| `demo-hist-01` | Jan | Operations, 20 staff | the first order |
| `demo-hist-02` | Mar | Technicians, 30 staff | |
| `demo-hist-03` | Apr | Front Office, 10 staff | |
| `demo-hist-04` | Jun | Management, 12 staff | blazers at the old price |
| `demo-hist-05` | Jul | Operations, 8 staff | a small reorder for new starters |
| `demo-hist-06` | Aug | Management, 12 staff | blazers at EGP 1,480: the newest invoice, so "last price paid" has an older price to differ from |

### Other customers

`demo-delta`: Delta Hotels, Quotation → Sales Order, submitted.
`demo-nile`: Nile Logistics, submitted Quotation. BrainWise sees neither.

### Stock

Opening stock by a Material Receipt dated 1 January 2026 (`demo-stock`), so
every back-dated delivery finds stock:

| Variant | Stock | Answer it produces |
|---|---|---|
| Polo Navy XL | 260, Stores only | "Yes, 260 available"; after the live reconciliation to 40, the card shows 260 → 40 |
| Polo Navy L | 80 Stores, 40 Finished Goods | per-warehouse quantities |
| Polo Sand M | received, then all issued (`demo-stock-out`) | "out of stock", which differs from "no record" |
| every other variant | 80 Stores, 40 Finished Goods | |

### Running it

- `npm run seed:erp` creates whatever is missing. Every seeded document is
  found by its `uniformai_ref`, so a second run creates nothing.
- `npm run seed:erp -- --reset` restores the demo's starting point, then
  seeds:
  - it cancels and deletes documents whose ref starts with `demo-`, and any
    document made from one of them (for example the Sales Order the live
    demo creates from `demo-technicians`), children before parents;
  - it posts a Stock Reconciliation (`demo-stock-reset`) that puts every
    seeded variant back to its seeded quantity, rather than deleting the
    reconciliation made by hand during the demo;
  - it never touches documents the app created (ref `app-…`, from Request
    quote) or anything made by hand in ERPNext. Those are the account's
    real history and stay.
- The app sets `uniformai_ref = app-<timestamp>` on the Quotations it
  creates, and ERPNext's mapping carries it down the chain.
- `lib/erp-samples.json` and the app's built-in sample orders are deleted:
  every order the app shows comes from ERPNext.

## Files

| File | Change |
|---|---|
| `lib/orders.ts` | New. Kit → document lines; the Quotation / Sales Order / Delivery Note chain → `Order`; state rules. Pure, no fetch. |
| `lib/sales.ts` | New. Server-side reads and writes of the chain through `lib/erp.ts`. |
| `app/api/orders/route.ts` | New. `GET` the customer's orders. |
| `app/api/quotes/route.ts` | New. `POST` a draft Quotation. |
| `app/api/quotes/[name]/approve/route.ts` | New. `POST` make the draft Sales Order. |
| `lib/erp.ts` | Adds `insert` and `call` (whitelisted method) with a key argument. |
| `lib/order.ts` | The workflow states replace the six stages; an order carries its document numbers and dates. |
| `lib/manager.ts` | Notes and greeting for the workflow states. |
| `lib/answers.ts` | New. Answer sentences per intent. |
| `lib/ask.ts` | Model loop removed; adds `options`; reads include drafts. |
| `app/api/ask/route.ts` | Intent dispatch, JSON. |
| `components/ask-erp.tsx` | Button flow. |
| `app/page.tsx` | Orders from `/api/orders`; Request quote and Approve quote; focus re-read. |
| `lib/i18n.ts` | New strings, both languages. |
| `scripts/seed-erp.ts` | The demo data and `--reset`, as above. |
| `package.json` | Drops `@anthropic-ai/sdk`. |

## Testing

`lib/orders.test.ts` and `lib/answers.test.ts`, run by `npm test`:

1. The draft Quotation lines for each sample kit sum to the app's estimate.
2. A `rate`, `total` or `customer` in the request body is ignored.
3. Each row of the States table maps to its app state, from documents alone.
4. The chain joins: a Sales Order finds its Quotation and a Delivery Note
   finds its Sales Order; a hand-made Sales Order and one without kit JSON
   still map to an order.
5. When the submitted Quotation's total differs from the estimate, the order
   carries both and shows the quoted one as the price.
6. Approve is refused for another customer's Quotation, a draft, and one
   that already has a Sales Order.
7. Each intent's answer, in both languages, including nothing found.
8. An unknown intent is rejected; the customer filter is on every customer
   read.

Rehearsal against `uniform.localhost`:

| Step | Expect |
|---|---|
| Request quote in the app | A draft Quotation in ERPNext with the kit JSON and matching total; the app shows Quote requested |
| Change a rate and submit the Quotation in ERPNext, switch back | Quote ready, with ERPNext's price beside the estimate, and Approve quote |
| Approve quote in the app | A draft Sales Order in ERPNext linked to the Quotation, with the kit JSON; the app shows Awaiting confirmation |
| Submit the Sales Order in ERPNext, switch back | Collecting sizes or In progress, with the order number on the timeline |
| Make and submit a Delivery Note in ERPNext, switch back | Delivered, with the delivery note number |
| Assistant: My orders | The new order listed with its state |
| Stock: Polo, Navy, XL | 260 pcs in Stores |
| Stock Reconciliation to 40, then Check again | The card shows 260 → 40 |
| Last price: Blazer | EGP 1,480 from the August invoice (`demo-hist-06`) |
| `npm run seed:erp -- --reset`, then reload the app | Technicians back to Quote ready, Navy XL back to 260, the app-made orders from the rehearsal still listed |
| Stop ERPNext, open Orders | "We couldn't load your orders" with retry |

## Out of scope

- Prices from ERPNext Item Price for the first estimate (the Quotation
  review is where ERPNext sets the real price).
- Sales Invoice and payment in the app's timeline.
- Ordering ready stock from the app.
- Customer login; one demo customer, a constant.
- Work Orders and production stages.
- Delivery, invoicing and payment from the app.
