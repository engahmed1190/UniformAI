# UniformAI

A demo of one workflow: a uniform brief, in plain words, becomes a governed
garment specification, a price, a quote and a sales order.

```
npm install
npm run dev     # http://localhost:3000
npm test        # the guards in lib/*.test.ts
npm run build
```

## Orders run on ERPNext

Orders, quotes, stock and prices are real ERPNext records (a local bench,
ERPNext 15, company UniformAI, EGP). An order moves through ERPNext's own
sales workflow:

Request quote (app) -> UniformAI submits the Quotation (ERPNext) -> Approve
quote (app) -> draft Sales Order -> UniformAI submits it (ERPNext) ->
Delivery Note -> Delivered.

The assistant is on every screen: a guided account manager, in English and
formal Arabic, with no language model. Each button is one fixed read or one
insert-only write: request a quotation, approve it, send the size run, see
invoices (Paid / Unpaid / Overdue, worked out from what is owed and the due
date) and ask the team to get in touch (an ERPNext Issue, named CASE-...). The
minimum order is 10 sets, with 5% spares recommended (`lib/policy.ts`).

Sizes follow ERPNext's standard for variants. Quotations and orders are
priced on one made-to-order line per garment (`UA-MTO-…`), since sizes are
not known yet. The customer's sizes arrive as a UniformAI Size Run; the team
applies them with the Sales Order's Update Items (`npm run team -- sizes
<order>`), which replaces each garment line with its colour, cut and size
variants (`UA-SIZED-…`, non-stock) at the same rate, so the total is
unchanged. Delivery notes and invoices then list each size.

Still stand-ins: the kit catalogue and the brief-to-kit generation (below).

### Setup

Copy `.env.example` to `.env.local` and fill in four keys. Each is an ERPNext
API key and secret, as `key:secret`:

| Key | User | Can do |
|---|---|---|
| `ERP_READ_KEY` | API Reader | Read only: orders, stock, prices, invoices |
| `ERP_WRITE_KEY` | UniformAI Portal | Create draft Quotations and draft Sales Orders. Cannot submit, and cannot change rates on a submitted document |
| `ERP_SEED_KEY` | Administrator | Seed and reset only. Never used by the running app |
| `ERP_URL` | | The site, `http://uniform.localhost:8000` |

Rates on a requested quote come from the server's catalogue (the concept's garment prices, else the garment catalogue) plus the grade delta; the browser's prices are ignored. UniformAI's team then sets the final rates in ERPNext before submitting.

```sh
npm run seed:erp            # safe to run again
npm run seed:erp -- --reset # back to the demo's starting point
```

`--reset` removes the current demo orders, everything the app made (app-
references, including app-made orders), their size runs and `[UniformAI assistant]` contact cases, and
puts stock back with its own reconciliation. It keeps history, staff-created
BrainWise cases and other documents made by hand.

`npm run dev` runs webpack on 127.0.0.1:3100 (Turbopack cannot fetch Google
Fonts here).

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

If ERPNext is down, Orders shows "We couldn't load your orders" with a retry.

## What else is a stand-in

Real code paths: the spec (`lib/spec.ts`), every edit to it (`lib/refine.ts`),
the renderer (`components/garments.tsx`), pricing, and the quote and order
workflow against ERPNext (`lib/sales.ts`).

Stand-ins, each marked `ponytail:` at the seam where the real thing plugs in:

- **Generation** picks from four hand-authored concepts (`lib/concepts.ts`)
  and bends them to the brief. A model call replaces `selectConcepts()`.
- **Conversational edits** are a keyword parser. An API returning the same
  patch shape replaces `parse()`.
- **Configure-screen stock, lead time and sizing** are still stand-ins.
- **Saved kits** live in `localStorage`. Orders do not: they are read from
  ERPNext.

## Layout

- `app/page.tsx` — the five screens and all session state.
- `components/` — shell, kit card, configurator, garment SVGs.
- `lib/` — spec, refine, concepts, order, account-manager copy, and the
  server-only ERP/assistant integration.
