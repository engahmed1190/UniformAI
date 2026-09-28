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

The Orders screen has a guided assistant with three buttons: My orders, Stock
availability and Last price paid. It is model-free: each button is one fixed
read of ERPNext, and every answer links the records it read.

Still stand-ins: the kit catalogue and the brief-to-kit generation (below).

### Setup

Copy `.env.example` to `.env.local` and fill in four keys. Each is an ERPNext
API key and secret, as `key:secret`:

| Key | User | Can do |
|---|---|---|
| `ERP_READ_KEY` | API Reader | Read only: orders, stock, prices, invoices |
| `ERP_WRITE_KEY` | UniformAI Portal | Create draft Quotations and draft Sales Orders. Cannot submit, and cannot change rates |
| `ERP_SEED_KEY` | Administrator | Seed and reset only. Never used by the running app |
| `ERP_URL` | | The site, `http://uniform.localhost:8000` |

```sh
npm run seed:erp            # safe to run again
npm run seed:erp -- --reset # back to the demo's starting point
```

`--reset` removes only the current demo orders and anything made from them,
and puts stock back with its own reconciliation. It keeps history, orders made
in the app and documents made by hand.

If the dev server cannot fetch Google Fonts (Turbopack failed here), run it
with `npx next dev --webpack`.

### Demo script

`npm run seed:erp -- --reset` first. The demo starts with Technicians at
Quote ready. UniformAI's side is done in ERPNext as the team.

1. Orders: one order in every state. Open Technicians: ERPNext's quoted price
   sits beside the app's estimate.
2. Request a quote for a kit in the app. ERPNext gets a draft Quotation with
   the kit design and a matching total. The app shows Quote requested.
3. In ERPNext, change a rate and submit the Quotation. Back in the app: Quote
   ready, ERPNext's price beside the estimate, and Approve quote.
4. Approve quote. ERPNext has a draft Sales Order linked to the Quotation. The
   app shows Awaiting confirmation.
5. In ERPNext, submit the Sales Order. The app shows Collecting sizes or In
   progress, with the order number on the timeline.
6. In ERPNext, make and submit a Delivery Note from the Sales Order. The app
   shows Delivered, with the delivery note number.
7. Assistant, My orders: the new order is listed with its state.
8. Assistant, Stock availability, Polo, Navy, XL: 260 pcs in Stores.
9. In ERPNext, submit a Stock Reconciliation setting that item to 40. In the
   app, press Check again: the card shows 260 -> 40.
10. Assistant, Last price paid, Blazer: EGP 1,480, from the August invoice.
11. `npm run seed:erp -- --reset` and reload: Technicians is back at Quote
    ready, Navy XL is back at 260, and the orders you made stay listed.

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
