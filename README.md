# UniformAI

A demo of one workflow: a uniform brief, in plain words, becomes a governed
garment specification, a price, a quote and a sales order.

```
npm install
npm run dev     # http://localhost:3000
npm test        # the guards in lib/*.test.ts
npm run build
```

## ERP-grounded assistant

The Orders screen includes an assistant that reads live ERPNext records,
answers through Claude, and links every record it checked. Copy `.env.example`
to `.env.local`, add the three API credentials, then seed the demo tenant:

```sh
npm run seed:erp
npm run dev
```

The seed is safe to run again. It creates the demo customers, item variants,
opening stock, sample orders, one invoice, and a read-only `API Reader` user.
Generate that user's API key in ERPNext after the first run and put it in
`ERP_READ_KEY`. Clear the browser's `orders` localStorage key once after
seeding so the Orders screen picks up the ERP-assigned sample IDs from
`lib/erp-samples.json`.

## What is real and what is a stand-in

Real code paths: the spec (`lib/spec.ts`), every edit to it (`lib/refine.ts`),
the renderer (`components/garments.tsx`), pricing, the quote, and the order
built from that quote (`lib/order.ts`).

Stand-ins, each marked `ponytail:` at the seam where the real thing plugs in:

- **Generation** picks from four hand-authored concepts (`lib/concepts.ts`)
  and bends them to the brief. A model call replaces `selectConcepts()`.
- **Conversational edits** are a keyword parser. An API returning the same
  patch shape replaces `parse()`.
- **Configure-screen stock, lead time and sizing** remain stand-ins. On the
  Orders screen, the ERP assistant's order, stock and last-price answers are
  live ERPNext reads; it deliberately does not claim that app-side production
  stages come from ERPNext.
- **Persistence** is `localStorage` for saved kits and orders. With nothing
  stored, two sample kits and three sample orders (collecting sizes, in
  production, delivered) are seeded so the screens are not empty.

## Layout

- `app/page.tsx` — the five screens and all session state.
- `components/` — shell, kit card, configurator, garment SVGs.
- `lib/` — spec, refine, concepts, order, account-manager copy, and the
  server-only ERP/assistant integration.
