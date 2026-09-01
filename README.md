# UniformAI

A demo of one workflow: a uniform brief, in plain words, becomes a governed
garment specification, a price, a quote and a sales order.

```
npm install
npm run dev     # http://localhost:3000
npm test        # the guards in lib/*.test.ts
npm run build
```

## What is real and what is a stand-in

Real code paths: the spec (`lib/spec.ts`), every edit to it (`lib/refine.ts`),
the renderer (`components/garments.tsx`), pricing, the quote, and the order
built from that quote (`lib/order.ts`).

Stand-ins, each marked `ponytail:` at the seam where the real thing plugs in:

- **Generation** picks from four hand-authored concepts (`lib/concepts.ts`)
  and bends them to the brief. A model call replaces `selectConcepts()`.
- **Conversational edits** are a keyword parser. An API returning the same
  patch shape replaces `parse()`.
- **Stock, lead time, sizing** are not connected. Prices are indicative and
  the due date is a fixed 21 days.
- **Persistence** is `localStorage` for saved kits. The order lives for one
  page load.

## Layout

- `app/page.tsx` — the five screens and all session state.
- `components/` — shell, kit card, configurator, garment SVGs.
- `lib/` — spec, refine, concepts, order, and the account-manager copy.
