# Chat Experience Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The account manager leads: it notices what changed, speaks like one person, shows order/invoice/size cards, and needs fewer taps.

**Architecture:** Pure logic stays in `lib/` (browser-safe, no fetch, no React): a news diff (`lib/updates.ts`), the typing pause (`lib/pace.ts`), card view-models (`lib/cards.ts`), a code splitter (`lib/rich.ts`), and the turns in `lib/journey.ts`. `components/ask-erp.tsx` (the dock) fetches the existing `GET /api/orders` and `GET /api/invoices`, runs acts, and renders; `components/chat-actions.tsx` holds the cards and forms. Each task is reviewable alone and leaves `npm test` green.

**Tech Stack:** Next.js 16 / React 19 client component, TypeScript, tests with `tsx` + `node:assert` (`npm test` runs every `lib/*.test.ts`), CSS modules (`app/ui.module.css`).

**Spec:** `docs/superpowers/specs/2026-09-29-chat-experience-design.md` (copy table there is the source of truth for every string). The UX audit it answers: `.superpowers/sdd/2026-09-29-client-assistant/ux-audit.md`.

## Global Constraints

- Still binding from `docs/superpowers/plans/2026-09-29-client-assistant.md`: demo only; no LLM; the customer never sees "ERPNext", an ERP URL, an item code (`UA-…`) or a raw ERPNext status (document numbers are fine); voice "Mr. Ahmed" / "أستاذ أحمد", formal Arabic (plural address); every English key has an Arabic key with the same `{placeholders}` (`lib/i18n.test.ts`); keep the synchronous `actionLock` write lock.
- At most **4 journey buttons** per turn plus Menu (on the home turn, **More** takes Menu's place); at most one primary per turn and one per card.
- No new server routes, no new Next.js APIs. `/api/invoices` gains one field through `lib/sales.ts` only (the route file is untouched). If you touch a route anyway, read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` first; for the client component, `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-client.md`.
- Demo YAGNI: no transcript persistence, no free text, no push, no new dependencies. Keep the launcher's look (`.evLauncher` styles); only its text changes and it gains the unread dot.
- Typing pause: `min(1000, 600 + 4 × chars)` ms from the tap; `prefers-reduced-motion: reduce` → 150 ms, no animation.
- Re-read cadence: window `focus` / `visibilitychange` (open or closed), on open, and every `30_000` ms while open; never while `busy` or `actionLock`.
- Never start or kill the dev server (it runs at `http://127.0.0.1:3100`); never run `npm run seed:erp`. Browser checks use the Playwright MCP tools and move demo data forward only with `npm run team -- issue|confirm|sizes|deliver`.
- Commits: stage only the files the task lists (`next dev` may re-dirty `AGENTS.md`; leave it). Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- The news diff must key orders by `o.quote ?? o.id`: approving a quote changes `o.id` from SAL-QTN-… to SAL-ORD-…, and a wrong key reports "confirmed" news for the customer's own approval (Task A test pins it; reviewer checks the dock also calls `own()` after every write, and that a `refresh` read resolving after a write started is dropped, not learned).
- A re-read that fires while the customer is typing sizes or people must not replace the form's buttons; the news waits for the next reply (Task A dock `refresh`, checked in the browser step).
- Arabic sentences carry Latin ids and amounts inside U+2068/U+2069 isolates; tests assert with `includes(id)`, never whole Arabic strings, and `splitCodes` must keep the joined text identical (Task D test).
- A stale card's button (an older order card further up the log) must not fire a second approve: cards are live only when they are the last card and the dock is idle (Task C `live` prop); the server's 409 → `movedTurn` path remains the backstop.
- Phone RTL: the 7-step bar hides its labels at ≤760 px and names the current step in the "next" line instead; ids never wrap (Task D browser check measures `getClientRects().length === 1`).

---

### Task A: Updates and a greeting that leads

**Files:**
- Create: `lib/updates.ts`, `lib/updates.test.ts`
- Modify: `lib/invoices.ts` (`Invoice.order`, `InvoiceRow.sales_order`), `lib/sales.ts` (`listInvoices`), `lib/sales-reads.test.ts`, `lib/manager.ts` (`greeting` takes `hour`), `lib/journey.ts` (`Act.more.from`, `waitingButtons`, `menuTurn`, `moreTurn`, `approveTurn`, `newsTurn`), `lib/journey.test.ts`, `lib/i18n.ts` (`journey.btnApproveKit`, `journey.btnSendSizesKit`, `journey.news.*`, `erpAsk.news`; remove `journey.hello`, `journey.btnReview`, `journey.btnSendSizes`), `components/ask-erp.tsx`, `app/ui.module.css` (`.evUnread`)

**Interfaces:**
- Consumes: `Order`, `Workflow` (`lib/order.ts`); `Invoice`, `InvoiceStatus` (`lib/invoices.ts`); `greeting` (`lib/manager.ts`).
- Produces:
  - `lib/invoices.ts`: `Invoice = { name; date; due; total; outstanding; status; order?: string }` (the sales order it bills).
  - `lib/updates.ts`: `UPDATE_MS = 30_000`; `type Seen = { orders: Record<string, Workflow>; invoices: Record<string, InvoiceStatus> | null }`; `type OrderNews = { k: 'quote_ready' | 'confirmed' | 'production' | 'delivered'; order: Order; invoice?: Invoice }`; `type InvoiceNews = { k: 'invoiced' | 'paid'; invoice: Invoice }`; `type News = OrderNews | InvoiceNews`; `orderKey(o: Order): string`; `newsSince(before: Seen | null, orders: Order[], invoices?: Invoice[]): { news: News[]; seen: Seen }`; `withOrder(seen: Seen, o: Order): Seen`.
  - `lib/manager.ts`: `greeting(locale: Locale, orders: Order[], hour = new Date().getHours()): string`.
  - `lib/journey.ts`: `Act` member `{ k: 'more'; from?: number }`; `waitingButtons(locale: Locale, orders: Order[]): Button[]`; `menuTurn(locale: Locale, orders: Order[], hour: number, again = false): Turn`; `moreTurn(locale: Locale, orders: Order[], from = 0): Turn`; `newsTurn(locale: Locale, news: News[]): Turn`.

- [ ] **Step 1: Write the failing tests**

Create `lib/updates.test.ts`:

```ts
// Run: npx tsx lib/updates.test.ts
// "Since we last spoke": what changed between two reads, and never the
// customer's own writes.
import assert from 'node:assert/strict';
import { CONCEPTS } from './concepts';
import { sampleOrder } from './order-fixture';
import type { Order, Workflow } from './order';
import type { Invoice } from './invoices';
import { type Seen, newsSince, orderKey, withOrder } from './updates';
import { newsTurn } from './journey';

const QUOTE_STATES: Workflow[] = ['quote_requested', 'quote_ready', 'quote_closed'];
const order = (state: Workflow, over: Partial<Order> = {}): Order => {
  const o = sampleOrder(CONCEPTS[0], 40, 42, [], 650, new Date('2026-09-20T10:00:00'), state);
  const so = QUOTE_STATES.includes(state) ? undefined : 'SAL-ORD-2026-00011';
  return { ...o, id: so ?? 'SAL-QTN-2026-00031', quote: 'SAL-QTN-2026-00031', salesOrder: so, ...over };
};
const inv = (over: Partial<Invoice> = {}): Invoice => ({
  name: 'ACC-SINV-2026-00010', date: '2026-09-29', due: '2026-10-29', total: 14345, outstanding: 14345,
  status: 'unpaid', order: 'SAL-ORD-2026-00011', ...over,
});

// The first read is the baseline: no news, the greeting covers it.
let r = newsSince(null, [order('quote_ready')], []);
assert.deepEqual(r.news, []);
assert.deepEqual(r.seen, { orders: { 'SAL-QTN-2026-00031': 'quote_ready' }, invoices: {} });

// The team issues a requested quote.
const requested = newsSince(null, [order('quote_requested')], []).seen;
r = newsSince(requested, [order('quote_ready')], []);
assert.deepEqual(r.news.map((n) => n.k), ['quote_ready']);

// The key survives quote -> order (id changes to SAL-ORD-…): approve then confirm is one change.
let seen: Seen = withOrder(requested, order('awaiting'));
assert.equal(orderKey(order('awaiting')), 'SAL-QTN-2026-00031');
assert.deepEqual(newsSince(seen, [order('awaiting')], []).news, [], 'the customer\'s own approval is not news');
r = newsSince(seen, [order('collecting_sizes')], []);
assert.deepEqual(r.news.map((n) => n.k), ['confirmed']);

// Sizes the customer sent are not news; sizes the team applied are.
seen = withOrder(r.seen, order('in_progress'));
assert.deepEqual(newsSince(seen, [order('in_progress')], []).news, []);
assert.deepEqual(newsSince(r.seen, [order('in_progress')], []).news.map((n) => n.k), ['production']);

// Delivered and invoiced in one read fold into one line.
seen = newsSince(null, [order('in_progress')], []).seen;
r = newsSince(seen, [order('delivered')], [inv()]);
assert.equal(r.news.length, 1);
assert.equal(r.news[0].k, 'delivered');
assert.equal((r.news[0] as { invoice?: Invoice }).invoice?.name, 'ACC-SINV-2026-00010');

// An invoice on its own, then paid.
seen = newsSince(null, [order('delivered')], []).seen;
r = newsSince(seen, [order('delivered')], [inv({ order: undefined })]);
assert.deepEqual(r.news.map((n) => n.k), ['invoiced']);
r = newsSince(r.seen, [order('delivered')], [inv({ status: 'paid', outstanding: 0 })]);
assert.deepEqual(r.news.map((n) => n.k), ['paid']);

// An orders-only read keeps the invoice baseline; with none yet, no invoice is "new".
seen = newsSince(null, [order('delivered')], [inv()]).seen;
assert.deepEqual(newsSince(seen, [order('delivered')]).seen.invoices, { 'ACC-SINV-2026-00010': 'unpaid' });
const ordersOnly = newsSince(null, [order('delivered')]).seen;
assert.equal(ordersOnly.invoices, null);
assert.deepEqual(newsSince(ordersOnly, [order('delivered')], [inv()]).news, []);

// The turn: one sentence, a button for what the customer can do, first one primary.
const ready = newsSince(requested, [order('quote_ready')], []).news;
const confirmed = newsSince(withOrder(requested, order('awaiting')), [order('collecting_sizes', { quote: 'SAL-QTN-2026-00031' })], []).news;
let turn = newsTurn('en', [...ready, ...confirmed]);
assert.match(turn.say, /^Since we last spoke: quotation SAL-QTN-2026-00031 is ready for your approval \(EGP.27,300\); /);
assert.match(turn.say, /confirmed order SAL-ORD-2026-00011/);
assert.deepEqual(turn.buttons.map((b) => b.act.k), ['approve', 'sizes']);
assert.equal(turn.buttons.filter((b) => b.primary).length, 1);
assert.ok(turn.buttons[0].primary);
turn = newsTurn('ar', ready);
assert.ok(turn.say.startsWith('منذ حديثنا الأخير:'));
assert.ok(turn.say.includes('SAL-QTN-2026-00031'));
turn = newsTurn('en', newsSince(newsSince(null, [order('in_progress')], []).seen, [order('delivered')], [inv()]).news);
assert.match(turn.say, /order SAL-ORD-2026-00011 has been delivered, and invoice ACC-SINV-2026-00010 for EGP.14,345 is ready\.$/);
assert.deepEqual(turn.buttons.map((b) => b.act), [{ k: 'invoices' }]);

console.log('updates: all assertions passed');
```

In `lib/journey.test.ts`, change the import to also take `waitingButtons` and replace the menu block (from `// Menu: the newest waiting action leads` through `keep(moreTurn(locale));`) with:

```ts
  // Greeting: up to two waiting items, then New and Contact, then Orders; More holds the rest.
  let turn = keep(menuTurn(locale, [order('quote_ready'), order('collecting_sizes')], 15));
  assert.deepEqual(turn.buttons.map((b) => b.act.k), ['approve', 'sizes', 'new', 'contact', 'more']);
  assert.deepEqual(primary(turn), { k: 'approve', quote: 'SAL-QTN-2026-00031', total: 27300 });
  const three = [order('quote_ready'), order('collecting_sizes'), order('quote_ready', { quote: 'SAL-QTN-2026-00032' })];
  turn = keep(menuTurn(locale, three, 15));
  assert.deepEqual(turn.buttons.map((b) => b.act.k), ['approve', 'sizes', 'new', 'contact', 'more']);
  turn = keep(moreTurn(locale, three));
  assert.deepEqual(turn.buttons.map((b) => b.act), [
    { k: 'approve', quote: 'SAL-QTN-2026-00032', total: 27300 }, { k: 'orders' }, { k: 'invoices' }, { k: 'more', from: 3 },
  ]);
  turn = keep(moreTurn(locale, three, 3));
  assert.deepEqual(turn.buttons.map((b) => b.act.k), ['stock', 'price']);
  turn = keep(menuTurn(locale, [], 9));
  assert.deepEqual(turn.buttons.map((b) => b.act.k), ['new', 'contact', 'orders', 'more']);
  assert.equal(primary(turn), undefined);
  assert.match(turn.say, locale === 'en' ? /^Good morning, Mr\. Ahmed\./ : /^صباح الخير أستاذ أحمد\./);
  turn = keep(menuTurn(locale, [order('collecting_sizes')], 15, true));
  assert.deepEqual(primary(turn), { k: 'sizes', order: 'SAL-ORD-2026-00011' });
  assert.equal(waitingButtons(locale, [order('awaiting'), order('in_progress')]).length, 0);
  keep(moreTurn(locale, []));
```

Still in `lib/journey.test.ts`: after `turn = keep(approveTurn(locale, 'SAL-QTN-2026-00031', 27300));` add

```ts
  assert.ok(turn.buttons.some((b) => b.act.k === 'viewQuote'), 'the greeting skips the quote turn, so View is here');
```

and in the voice-rules loop replace `assert.ok(turn.buttons.length <= 4, …)` with

```ts
  assert.ok(turn.buttons.filter((b) => b.act.k !== 'more').length <= 4, `too many buttons: ${turn.say}`);
```

In `lib/sales-reads.test.ts`, after `assert.match(filters, /is_return/);` add:

```ts
  // One row per item line: folded back to one invoice, carrying its order.
  mockErp({ '/api/resource/Sales Invoice': () => ({ data: [
    { ...row, outstanding_amount: 9000, sales_order: null },
    { ...row, outstanding_amount: 9000, sales_order: 'SAL-ORD-1' },
  ] }) });
  const folded = await listInvoices();
  assert.equal(folded.length, 1);
  assert.equal(folded[0].order, 'SAL-ORD-1');
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx tsx lib/updates.test.ts; npx tsx lib/journey.test.ts; npx tsx lib/sales-reads.test.ts`
Expected: FAIL: cannot find module `./updates`; `waitingButtons` is not exported; `folded.length` is 2.

- [ ] **Step 3: Invoice → order link**

`lib/invoices.ts`: add `order?: string` to `Invoice` (comment: `/** The sales order it bills, when one is linked. */`), add `sales_order?: string | null` to `InvoiceRow`, and in `toInvoice` return `{ …existing fields…, ...(r.sales_order ? { order: r.sales_order } : {}) }`.

`lib/sales.ts`, replace `listInvoices`:

```ts
/** The customer's submitted invoices, newest first, with a derived status and
 *  the order each bills. Frappe returns one row per item line for a child
 *  field, so rows are folded back to one per invoice (as listOrders does). */
export async function listInvoices(): Promise<Invoice[]> {
  const rows = await list<InvoiceRow>('Sales Invoice', {
    fields: ['name', 'posting_date', 'due_date', 'grand_total', 'outstanding_amount', 'items.sales_order'],
    filters: [['customer', '=', CUSTOMER], ['docstatus', '=', 1], ['is_return', '=', 0]],
    orderBy: 'posting_date desc', limit: 500,
  });
  const byName = new Map<string, InvoiceRow>();
  for (const r of rows) {
    const seen = byName.get(r.name);
    if (!seen) byName.set(r.name, { ...r });
    else if (!seen.sales_order && r.sales_order) seen.sales_order = r.sales_order;
  }
  const today = isoDay();
  return [...byName.values()].slice(0, 50).map((r) => toInvoice(r, today));
}
```

- [ ] **Step 4: The diff**

Create `lib/updates.ts`:

```ts
// lib/updates.ts
// What changed in the customer's account since the chat last looked, so the
// account manager can open with it. Pure: the dock fetches, this compares.

import type { Order, Workflow } from './order';
import type { Invoice, InvoiceStatus } from './invoices';

/** How often the open chat looks again. */
export const UPDATE_MS = 30_000;

/** What the chat last saw. `invoices` is null until invoices were read once,
 *  so an orders-only read never makes every invoice look new. */
export type Seen = { orders: Record<string, Workflow>; invoices: Record<string, InvoiceStatus> | null };

export type OrderNews = { k: 'quote_ready' | 'confirmed' | 'production' | 'delivered'; order: Order; invoice?: Invoice };
export type InvoiceNews = { k: 'invoiced' | 'paid'; invoice: Invoice };
export type News = OrderNews | InvoiceNews;

/** Stable across quote -> order: an order's `id` becomes the sales order's name. */
export const orderKey = (o: Order): string => o.quote ?? o.id;

/** The states worth telling; the others are the customer's own doing or the team's quiet work. */
const TOLD: Partial<Record<Workflow, OrderNews['k']>> = {
  quote_ready: 'quote_ready', collecting_sizes: 'confirmed', in_progress: 'production', delivered: 'delivered',
};

export function newsSince(before: Seen | null, orders: Order[], invoices?: Invoice[]): { news: News[]; seen: Seen } {
  const seen: Seen = {
    orders: Object.fromEntries(orders.map((o) => [orderKey(o), o.state])),
    invoices: invoices ? Object.fromEntries(invoices.map((i) => [i.name, i.status])) : before?.invoices ?? null,
  };
  if (!before) return { news: [], seen };
  const news: News[] = [];
  for (const o of orders) {
    const k = TOLD[o.state];
    if (k && before.orders[orderKey(o)] !== o.state) news.push({ k, order: o });
  }
  if (invoices && before.invoices) {
    for (const i of invoices) {
      const was = before.invoices[i.name];
      if (was === undefined) {
        // Delivered and invoiced in the same read: one line, not two.
        const delivered = news.find((n): n is OrderNews =>
          n.k === 'delivered' && !!i.order && n.order.salesOrder === i.order && !n.invoice);
        if (delivered) delivered.invoice = i;
        else news.push({ k: 'invoiced', invoice: i });
      } else if (was !== 'paid' && i.status === 'paid') {
        news.push({ k: 'paid', invoice: i });
      }
    }
  }
  return { news, seen };
}

/** The customer's own write: seen as it is now, so it is never news. */
export const withOrder = (seen: Seen, o: Order): Seen => ({ ...seen, orders: { ...seen.orders, [orderKey(o)]: o.state } });
```

- [ ] **Step 5: Greeting, buttons, More, news turn**

`lib/manager.ts`: change the signature to `export function greeting(locale: Locale, orders: Order[], hour = new Date().getHours()): string {` and delete the line `const hour = new Date().getHours();`.

`lib/journey.ts`:
- imports: add `import { greeting } from './manager';` and `import type { News } from './updates';` (`formatDate`, `kitName` and `money` are already there).
- in `Act`, replace `{ k: 'more' }` with `{ k: 'more'; from?: number }`.
- delete the private `waiting()` function and replace `menuTurn` / `moreTurn` with:

```ts
const kitOf = (locale: Locale, o: Order) => (o.concept ? kitName(locale, o.concept.id) : docOf(o));

/** Everything waiting on the customer, newest first: quotes to approve (straight
 *  to the Yes / Not now confirmation) and sizes to send. The first is primary. */
export function waitingButtons(locale: Locale, orders: Order[]): Button[] {
  return orders.flatMap((o): Button[] =>
    o.state === 'quote_ready' && o.quote
      ? [btn(locale, 'btnApproveKit', { k: 'approve', quote: o.quote, total: o.total }, { kit: kitOf(locale, o), total: money(locale, o.total) })]
      : o.state === 'collecting_sizes' && o.salesOrder
        ? [btn(locale, 'btnSendSizesKit', { k: 'sizes', order: o.salesOrder }, { kit: kitOf(locale, o) })]
        : [])
    .map((b, i) => (i === 0 ? { ...b, primary: true } : b));
}

/** The greeting's choices: up to two waiting items, then a new request and our
 *  team, then the orders if there is room. The rest wait behind More. */
function homeButtons(locale: Locale, orders: Order[]): { shown: Button[]; rest: Button[] } {
  const waiting = waitingButtons(locale, orders);
  const lead = [
    ...waiting.slice(0, 2),
    btn(locale, 'btnNew', { k: 'new' }),
    btn(locale, 'btnContact', { k: 'contact', topic: 'general' }),
    btn(locale, 'btnOrders', { k: 'orders' }),
  ];
  return { shown: lead.slice(0, 4), rest: [...waiting.slice(2), ...lead.slice(4)] };
}

/** The home turn. The greeting is Home's own sentence, so the two never disagree. */
export function menuTurn(locale: Locale, orders: Order[], hour: number, again = false): Turn {
  return {
    say: again ? t(locale, 'journey.again') : greeting(locale, orders, hour),
    buttons: [...homeButtons(locale, orders).shown, btn(locale, 'btnMore', { k: 'more' })],
  };
}

/** What did not fit on the greeting, then the quieter tools; four at a time. */
export function moreTurn(locale: Locale, orders: Order[], from = 0): Turn {
  const all = [
    ...homeButtons(locale, orders).rest.map(({ label, act }) => ({ label, act })),
    btn(locale, 'btnInvoices', { k: 'invoices' }),
    btn(locale, 'btnStock', { k: 'stock' }),
    btn(locale, 'btnPrice', { k: 'price' }),
  ];
  const buttons = all.length - from > 4
    ? [...all.slice(from, from + 3), btn(locale, 'btnMore', { k: 'more', from: from + 3 })]
    : all.slice(from, from + 4);
  return { say: t(locale, 'journey.more'), buttons };
}
```

- replace `approveTurn` so the confirmation also offers the quote itself (the greeting skipped it):

```ts
export const approveTurn = (locale: Locale, quote: string, total: number): Turn => ({
  say: t(locale, 'journey.confirmApprove', { id: quote, total: money(locale, total) }),
  // A different label, and not where the first Approve was, so a double
  // tap cannot approve without the customer reading this.
  buttons: [
    btn(locale, 'btnNotNow', { k: 'menu' }),
    btn(locale, 'btnConfirmApprove', { k: 'approveNow', quote }, { total: money(locale, total) }, true),
    btn(locale, 'btnView', { k: 'viewQuote', quote }),
  ],
});
```

- add after `approveTurn`:

```ts
/** "Since we last spoke: …": one clause per change, and a button for what
 *  the customer can do about it (first one primary). */
export function newsTurn(locale: Locale, news: News[]): Turn {
  const line = (n: News): string => {
    if (n.k === 'invoiced') {
      return t(locale, 'journey.news.invoiced', { id: n.invoice.name, total: money(locale, n.invoice.total), date: day(locale, n.invoice.due) });
    }
    if (n.k === 'paid') return t(locale, 'journey.news.paid', { id: n.invoice.name });
    const id = n.k === 'quote_ready' ? n.order.quote ?? docOf(n.order) : docOf(n.order);
    if (n.k === 'delivered' && n.invoice) {
      return t(locale, 'journey.news.deliveredInvoice', { id, invoice: n.invoice.name, total: money(locale, n.invoice.total) });
    }
    return t(locale, `journey.news.${n.k}`, { id, total: money(locale, n.order.total), date: formatDate(locale, n.order.due) });
  };
  const offers = news.flatMap((n): Button[] =>
    n.k === 'quote_ready' || n.k === 'confirmed' ? waitingButtons(locale, [n.order])
      : n.k === 'delivered' || n.k === 'invoiced' ? [btn(locale, 'btnInvoices', { k: 'invoices' })] : []);
  const key = (b: Button) => JSON.stringify(b.act);
  const buttons = offers
    .filter((b, i) => offers.findIndex((x) => key(x) === key(b)) === i)
    .slice(0, 4)
    .map(({ label, act }, i) => (i === 0 ? { label, act, primary: true } : { label, act }));
  return { say: `${t(locale, 'journey.news.since')} ${news.map(line).join(locale === 'ar' ? '؛ ' : '; ')}.`, buttons };
}
```

`lib/i18n.ts`:
- `en.erpAsk`: add `news: 'News from your account manager',`; `ar.erpAsk`: add `news: 'أخبار جديدة من مدير حسابكم',`.
- `en.journey`: delete `hello`, `btnReview`, `btnSendSizes`; add

```ts
    btnApproveKit: 'Approve the {kit} quote ({total})', btnSendSizesKit: 'Send the sizes for {kit}',
    news: {
      since: 'Since we last spoke:',
      quote_ready: 'quotation {id} is ready for your approval ({total})',
      confirmed: 'our team has confirmed order {id}, and the next step is yours: the sizes',
      production: 'the sizes for order {id} are in and production has started; delivery is expected on {date}',
      delivered: 'order {id} has been delivered',
      deliveredInvoice: 'order {id} has been delivered, and invoice {invoice} for {total} is ready',
      invoiced: 'invoice {id} for {total} has been issued, due on {date}',
      paid: 'invoice {id} is now paid, thank you',
    },
```

- `ar.journey`: delete `hello`, `btnReview`, `btnSendSizes`; add

```ts
    btnApproveKit: 'الموافقة على عرض سعر {kit} ({total})', btnSendSizesKit: 'إرسال مقاسات {kit}',
    news: {
      since: 'منذ حديثنا الأخير:',
      quote_ready: 'عرض السعر {id} جاهز لموافقتكم ({total})',
      confirmed: 'أكّد فريقنا الطلب {id}، والخطوة التالية لديكم: المقاسات',
      production: 'اكتملت مقاسات الطلب {id} وبدأ الإنتاج، والتسليم متوقع في {date}',
      delivered: 'تم تسليم الطلب {id}',
      deliveredInvoice: 'تم تسليم الطلب {id}، وفاتورته {invoice} بقيمة {total} جاهزة',
      invoiced: 'صدرت الفاتورة {id} بقيمة {total}، وتستحق في {date}',
      paid: 'تم سداد الفاتورة {id}، شكرًا لكم',
    },
```

- [ ] **Step 6: Run the pure tests**

Run: `npm test`
Expected: every file prints `… all assertions passed` (including `updates`, `journey`, `sales-reads`, `i18n`, `manager`).

- [ ] **Step 7: The dock re-reads, remembers, and lights the launcher**

`components/ask-erp.tsx`:
- imports: `import { type News, type Seen, UPDATE_MS, newsSince, withOrder } from '@/lib/updates';` and add `newsTurn` to the existing `@/lib/journey` import.
- replace `myOrders` (and add the helpers after `readOrders`):

```ts
  // What the chat last saw of the account, and the changes the customer has
  // not been told yet. Kept for the page's life; a reload starts afresh.
  const known = useRef<Seen | null>(null);
  const news = useRef<News[]>([]);
  const [unread, setUnread] = useState(false);
  const learn = (orders: Order[], invoices?: Invoice[]) => {
    const next = newsSince(known.current, orders, invoices);
    known.current = next.seen;
    news.current.push(...next.news);
  };
  const myOrders = async () => {
    const orders = (await api<Order[]>('/api/orders')).map(fromJson);
    readOrders.current = true;
    learn(orders);
    return orders;
  };
  const myAccount = async () => {
    const [orders, invoices] = await Promise.all([
      api<Order[]>('/api/orders').then((all) => all.map(fromJson)),
      api<Invoice[]>('/api/invoices'),
    ]);
    readOrders.current = true;
    learn(orders, invoices);
    return { orders, invoices };
  };
  /** The customer's own write is not news. */
  const own = (o: Order) => { if (known.current) known.current = withOrder(known.current, o); };
```

- replace `say` so pending news is told first:

```ts
  const say = (turn: JourneyTurn, home = false) => {
    const told = news.current.splice(0);
    setTurns((all) => [
      ...all,
      ...(told.length ? [{ role: 'prompt' as const, content: newsTurn(locale, told).say }] : []),
      { role: 'prompt', content: turn.say },
    ]);
    setStage({ k: 'turn', buttons: turn.buttons, home });
  };
```

- in `act`: delete the early line `if (a.k === 'more') return say(moreTurn(locale));` and inside the `try` add as the first branch `if (a.k === 'more') { say(moreTurn(locale, await myOrders(), a.from)); } else` before `if (a.k === 'menu')`; replace the menu branch body with `say(menuTurn(locale, (await myAccount()).orders, new Date().getHours(), turns.length > 0), true);`. After each write, record it: in `requestQuote`, `approveNow` and `sendSizes` add `own(o);` right after `const o = fromJson(…)`.
- after the `actRef` lines add the re-read:

```ts
  /** Look again; tell the news now (open, on a button turn), later (mid-form),
   *  or with the launcher's dot (closed). */
  const refresh = async () => {
    if (busy || actionLock.current || !known.current) return;
    let read: [Order[], Invoice[]];
    try {
      read = await Promise.all([
        api<Order[]>('/api/orders').then((all) => all.map(fromJson)),
        api<Invoice[]>('/api/invoices'),
      ]);
    } catch { return; }
    // A write started while this read was in flight: the read is stale, and
    // learning it would announce the customer's own change as news.
    if (busy || actionLock.current) return;
    readOrders.current = true;
    learn(...read);
    if (!news.current.length) return;
    if (!open) return setUnread(true);
    if (stage.k === 'turn') say(newsTurn(locale, news.current.splice(0)));
  };
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  // A baseline when the page loads, so news can light the launcher before
  // the chat was ever opened.
  useEffect(() => { void myAccount().catch(() => undefined); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Coming back to the window (the presenter ran a team step) looks again.
  useEffect(() => {
    const look = () => void refreshRef.current();
    const visible = () => { if (document.visibilityState === 'visible') look(); };
    addEventListener('focus', look);
    document.addEventListener('visibilitychange', visible);
    return () => { removeEventListener('focus', look); document.removeEventListener('visibilitychange', visible); };
  }, []);

  // Open: clear the dot, catch up, and keep looking while open.
  useEffect(() => {
    if (!open) return;
    setUnread(false);
    if (turns.length) void refreshRef.current();
    const timer = setInterval(() => void refreshRef.current(), UPDATE_MS);
    return () => clearInterval(timer);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
```

- choices are keyed by index now (two waiting items may share a kit name): `{choices.map((c, i) => (<li key={i}>…`.
- the launcher gains the dot:

```tsx
      <button type="button" ref={launcher} className={`${s.evLauncher} ${raised ? s.evLauncherRaised : ''}`} onClick={() => setOpen(true)}
        aria-haspopup="dialog" title={online} aria-label={unread ? `${t(locale, 'erpAsk.launcher')} · ${t(locale, 'erpAsk.news')}` : undefined}>
        <span className={`${s.evLive} ${s[`evLive_${health}`]}`} aria-hidden="true" />
        {t(locale, 'erpAsk.launcher')}
        {unread && <span className={s.evUnread} aria-hidden="true" />}
      </button>
```

`app/ui.module.css`, after `.evLauncher .evLive { … }`:

```css
/* News while the chat was closed: a dot on the launcher's corner. */
.evUnread {
  position: absolute;
  inset-block-start: -3px;
  inset-inline-end: -3px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--warn);
  box-shadow: 0 0 0 2px #fff;
}
```

- [ ] **Step 8: Type-check and test**

Run: `npx tsc --noEmit -p . && npm test`
Expected: no type errors; all tests pass.

- [ ] **Step 9: Browser check (EN + AR, desktop + phone; no seed reset)**

With Playwright MCP at `http://127.0.0.1:3100`, desktop 1440×900:
1. Open the launcher. The greeting's first sentence equals the Home banner's sentence ("Good …, Mr. Ahmed. …"); buttons follow the rule (≤2 waiting items, then "Start a new uniform request", "Ask the team to contact me", …, "More"). Tap More: overflow first, then Invoices, Check stock, Last price paid.
2. Create a request: Start a new uniform request → a team → 18 → Continue → Request. Note the SAL-QTN-… id. Close the chat.
3. In a shell: `npm run team -- issue <that SAL-QTN id>`. Then `browser_evaluate` `() => dispatchEvent(new Event('focus'))`. The launcher shows the dot (`document.querySelector('[class*=evUnread]')` not null). Open: "Since we last spoke: quotation … is ready for your approval (EGP …)." with a primary "Approve the … quote (EGP …)". No dot after opening.
4. Approve → Yes. With the chat open run `npm run team -- confirm <SAL-ORD id>`, dispatch `focus`: "…our team has confirmed order …, and the next step is yours: the sizes." appears once. Your own approval never produced news.
5. Open the sizes form from the news button, dispatch `focus`: the form stays, no news turn is inserted mid-form.
6. Switch to Arabic (Settings), reopen: greeting starts "مساء الخير أستاذ أحمد" / "صباح الخير…"; repeat step 1 at phone 390×844 (`browser_resize`). Screenshot each.

- [ ] **Step 10: Commit**

```bash
git add lib/updates.ts lib/updates.test.ts lib/invoices.ts lib/sales.ts lib/sales-reads.test.ts lib/manager.ts lib/journey.ts lib/journey.test.ts lib/i18n.ts components/ask-erp.tsx app/ui.module.css
git commit -m "Tell the customer what changed since we last spoke, and lead the greeting with what is waiting

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task B: Pacing, one voice, and who acts next

**Files:**
- Create: `lib/pace.ts`, `lib/pace.test.ts`
- Modify: `lib/i18n.ts` (`countOf`; `erpAsk.*` voice keys; next-step copy; remove trace keys), `lib/i18n.test.ts`, `lib/journey.ts` (`planTurn`, `orderTurn(locale, o, invoices)`, `sizesSentTurn`), `lib/journey.test.ts`, `components/ask-erp.tsx` (typing, `act` under `busy`, no trace/“Checked at”), `app/ui.module.css` (`.evTyping`)

**Interfaces:**
- Consumes: `Invoice.order` (Task A); `newsTurn`, `myAccount`, `own`, `say` (Task A dock).
- Produces:
  - `lib/pace.ts`: `TYPING = { min: 600, max: 1000, perChar: 4, reduced: 150 } as const`; `typingMs(text: string, reduced: boolean): number`.
  - `lib/i18n.ts`: `countOf(locale: Locale, noun: 'set' | 'person', n: number): string` ("19 sets" / "19 طقمًا").
  - `lib/journey.ts`: `orderTurn(locale: Locale, o: Order, invoices: Invoice[] = []): Turn` (delivered names the invoice).

- [ ] **Step 1: Write the failing tests**

Create `lib/pace.test.ts`:

```ts
// Run: npx tsx lib/pace.test.ts
import assert from 'node:assert/strict';
import { TYPING, typingMs } from './pace';

assert.equal(typingMs('', false), TYPING.min);
assert.equal(typingMs('x'.repeat(50), false), 800);
assert.equal(typingMs('x'.repeat(500), false), TYPING.max, 'a long reply still arrives within a second');
assert.equal(typingMs('x'.repeat(500), true), TYPING.reduced, 'reduced motion: a short, fixed beat');
console.log('pace: all assertions passed');
```

Append to `lib/i18n.test.ts` (and add `countOf` to its import):

```ts
// Counted nouns: Arabic has five forms, and "19 من الأطقم" was not one of them.
assert.equal(countOf('en', 'set', 1), '1 set');
assert.equal(countOf('en', 'set', 19), '19 sets');
assert.equal(countOf('en', 'person', 1), '1 person');
assert.equal(countOf('en', 'person', 18), '18 people');
assert.equal(countOf('ar', 'set', 1), 'طقم واحد');
assert.equal(countOf('ar', 'set', 2), 'طقمان');
assert.equal(countOf('ar', 'set', 10), '10 أطقم');
assert.equal(countOf('ar', 'set', 19), '19 طقمًا');
assert.equal(countOf('ar', 'set', 100), '100 طقم');
assert.equal(countOf('ar', 'person', 5), '5 موظفين');
assert.equal(countOf('ar', 'person', 18), '18 موظفًا');
```

In `lib/journey.test.ts`, before `// The voice rules, over every turn above.` add:

```ts
// Every reply says who acts next and when.
const bill: Invoice = { name: 'ACC-SINV-2026-00010', date: '2026-09-29', due: '2026-10-29', total: 14345,
  outstanding: 14345, status: 'unpaid', order: 'SAL-ORD-2026-00011' };
assert.match(orderTurn('en', order('delivered'), [bill]).say,
  /Invoice ACC-SINV-2026-00010 for EGP.14,345 is attached to this delivery, due on 29 Oct\.$/);
assert.match(orderTurn('en', order('delivered')).say, /accounts team will send the invoice within one working day\.$/);
for (const state of ['quote_requested', 'quote_ready', 'awaiting'] as Workflow[]) {
  assert.match(orderTurn('en', order(state)).say, /within one working day/, state);
}
assert.match(orderTurn('en', order('collecting_sizes')).say, /next step is yours/);
assert.match(orderTurn('en', order('in_progress')).say, /Nothing else is needed from you\.$/);
assert.match(quoteSentTurn('en', order('quote_requested')).say, /within one working day.*approve\.$/);
assert.match(approvedTurn('en', order('awaiting')).say, /within one working day, and then I will ask you for the sizes\.$/);
assert.match(sizesSentTurn('en', order('in_progress')).say, /Production starts now; expected delivery .+\. Nothing else is needed from you\.$/);
assert.match(caseTurn('en', 'CASE-2026-00007').say, /within one working day\.$/);
// Arabic counts and wording from the audit.
assert.ok(planTurn('ar', 'technicians', 18).say.includes('لفريق من 18 موظفًا'));
assert.ok(planTurn('ar', 'technicians', 18).say.includes('19 طقمًا'));
assert.ok(!planTurn('ar', 'technicians', 18).say.includes('من الأطقم'));
assert.ok(caseTurn('ar', 'CASE-2026-00007').say.includes('أحلت طلب التواصل'));
```

and extend the forbidden-words regex in the voice loop to `/ERPNext|UA-|https?:|journey\.|\{\w+\}|Draft|To Deliver|records|found in|Checked at/`.

- [ ] **Step 2: Run to verify they fail**

Run: `npx tsx lib/pace.test.ts; npx tsx lib/i18n.test.ts; npx tsx lib/journey.test.ts`
Expected: FAIL: cannot find `./pace`; `countOf` is not a function; the delivered sentence has no invoice.

- [ ] **Step 3: Implement the pure parts**

Create `lib/pace.ts`:

```ts
// lib/pace.ts
// A person pauses before answering. The dock waits this long from the tap
// (time spent fetching counts toward it) and shows that it is typing.

export const TYPING = { min: 600, max: 1000, perChar: 4, reduced: 150 } as const;

export function typingMs(text: string, reduced: boolean): number {
  if (reduced) return TYPING.reduced;
  return Math.min(TYPING.max, TYPING.min + TYPING.perChar * text.length);
}
```

`lib/i18n.ts`, after `spareMessage`:

```ts
/** "19 sets" / "19 طقمًا". Arabic picks its noun form by the count's last
 *  two digits: 1 and 2 are words, 3-10 take the plural, 11-99 the singular
 *  accusative, and hundreds the bare singular. */
export function countOf(locale: Locale, noun: 'set' | 'person', n: number): string {
  if (locale === 'en') {
    return noun === 'set' ? `${n} ${n === 1 ? 'set' : 'sets'}` : `${n} ${n === 1 ? 'person' : 'people'}`;
  }
  const f = noun === 'set'
    ? { one: 'طقم واحد', two: 'طقمان', few: 'أطقم', many: 'طقمًا', other: 'طقم' }
    : { one: 'موظف واحد', two: 'موظفان', few: 'موظفين', many: 'موظفًا', other: 'موظف' };
  const m = n % 100;
  if (n === 1) return f.one;
  if (n === 2) return f.two;
  return `${n} ${m >= 3 && m <= 10 ? f.few : m >= 11 ? f.many : f.other}`;
}
```

`lib/i18n.ts` copy (values exactly as the spec's copy table):
- `en.erpAsk`: `launcher: 'Your account manager', title: 'Your account manager'`, `live: 'UniformAI · replies from your live account'`, add `typing: 'Your account manager is typing'`, `evidence: 'From your account'`, `evidenceSome: 'Your latest {shown} of {count} orders'`, `noRecordNote: 'Nothing in your account or our stock matches, so I have not guessed.'`; delete `stepOrders, stepOrder, stepStock, stepPrice, stepOptions, stepFound, stepNone, stepFailed, evidenceOne, evidenceMany, checkedAt`.
- `ar.erpAsk`: `launcher: 'مدير حسابكم', title: 'مدير حسابكم'`, `live: 'UniformAI · من بيانات حسابكم مباشرة'`, add `typing: 'مدير حسابكم يكتب الآن'`, `evidence: 'من حسابكم'`, `evidenceSome: 'أحدث {shown} من طلباتكم، وعددها {count}'`, `noRecordNote: 'لا شيء في حسابكم أو في مخزوننا يطابق ذلك، لذا لم أخمّن.'`; delete the same keys.
- `en.journey` (replace these values; add the two new `stage` keys):

```ts
    plan: 'For {people} I recommend {sets}, which leaves {spare} for replacements and new starters. The estimate is {price}, before our team reviews it.',
    planMoq: 'Our minimum for a made-to-order uniform is {min}, so for {people} I recommend {sets}; the other {spare} serve as spares. The estimate is {price}, before our team reviews it.',
    stage: {
      quote_requested: 'Our team is pricing quotation {quote}; you will have it within one working day, and I will bring it to you here to approve.',
      quote_ready: 'Quotation {quote} is ready for your approval: {total} for {sets}. Once you approve, our team confirms the order within one working day.',
      quote_closed: 'Quotation {quote} is no longer open, so I cannot approve that price. Our team can prepare a new one at today\'s prices.',
      awaiting: 'Order {id} is with our team; they will confirm it within one working day, and then I will ask you for the sizes.',
      collecting_sizes: 'Order {id} is confirmed. The next step is yours: the sizes for all {sets}; production starts as soon as they are in.',
      in_progress: 'Order {id} is in production; expected delivery {date}. Nothing else is needed from you.',
      in_progress_part: 'Order {id} is being delivered: {pct}% has arrived so far, and the rest is expected by {date}. Nothing else is needed from you.',
      delivered: 'All {sets} of order {id} were delivered on {date}.',
      deliveredInvoice: 'Invoice {invoice} for {total} is attached to this delivery, due on {date}.',
      deliveredNoInvoice: 'Our accounts team will send the invoice within one working day.',
    },
    quoteShown: 'Those are the details. Once you approve, our team confirms the order within one working day.',
    confirmApprove: 'Please confirm that you approve quotation {id} for {total}. Our team will then confirm the order within one working day.',
    quoteSent: 'Thank you, Mr. Ahmed. I have passed your request to our team; they will price it within one working day as quotation {id}, and I will bring it to you here to approve.',
    approved: 'Thank you. I have passed your approval to our team; they will confirm order {id} within one working day, and then I will ask you for the sizes.',
    sizesSent: 'Thank you, Mr. Ahmed. I have received the sizes for all {sets} of order {id}. Production starts now; expected delivery {date}. Nothing else is needed from you.',
    caseSent: 'Thank you. I have passed your request to our team (reference {id}); someone will contact you within one working day.',
    btnRequest: 'Request a quotation for {sets}',
```

- `ar.journey`:

```ts
    plan: 'لفريق من {people} أوصي بـ {sets}، يبقى منها {spare} للاستبدال وللموظفين الجدد. التقدير المبدئي {price} قبل مراجعة فريقنا.',
    planMoq: 'الحد الأدنى للزي المصنوع حسب الطلب {min}، لذا أوصي لفريق من {people} بـ {sets}، ويبقى {spare} احتياطيًا. التقدير المبدئي {price} قبل مراجعة فريقنا.',
    stage: {
      quote_requested: 'يقوم فريقنا بتسعير عرض السعر {quote}، وسيصلكم خلال يوم عمل واحد، وسأعرضه عليكم هنا للموافقة.',
      quote_ready: 'عرض السعر {quote} جاهز لموافقتكم: {total} مقابل {sets}. وبعد موافقتكم يؤكد فريقنا الطلب خلال يوم عمل واحد.',
      quote_closed: 'لم يعد عرض السعر {quote} مفتوحًا، لذا لا يمكنني اعتماد ذلك السعر. ويمكن لفريقنا إعداد عرض جديد بأسعار اليوم.',
      awaiting: 'الطلب {id} لدى فريقنا، وسيؤكدونه خلال يوم عمل واحد، ثم أطلب منكم المقاسات.',
      collecting_sizes: 'تم تأكيد الطلب {id}. والخطوة التالية لديكم: مقاسات {sets} جميعها، ويبدأ الإنتاج فور وصولها.',
      in_progress: 'الطلب {id} قيد الإنتاج، والتسليم متوقع في {date}. لا نحتاج منكم شيئًا آخر.',
      in_progress_part: 'يجري تسليم الطلب {id}: وصل {pct}% حتى الآن، والباقي متوقع بحلول {date}. لا نحتاج منكم شيئًا آخر.',
      delivered: 'تم تسليم الطلب {id} كاملًا ({sets}) في {date}.',
      deliveredInvoice: 'وفاتورته {invoice} بقيمة {total} مرفقة بهذا التسليم، وتستحق في {date}.',
      deliveredNoInvoice: 'وسيرسل فريق الحسابات الفاتورة خلال يوم عمل واحد.',
    },
    quoteShown: 'هذه هي التفاصيل. وبعد موافقتكم يؤكد فريقنا الطلب خلال يوم عمل واحد.',
    confirmApprove: 'أرجو تأكيد موافقتكم على عرض السعر {id} بقيمة {total}، ثم يؤكد فريقنا الطلب خلال يوم عمل واحد.',
    quoteSent: 'شكرًا لكم أستاذ أحمد. أحلت طلبكم إلى فريقنا، وسيسعّرونه خلال يوم عمل واحد في عرض السعر {id}، وسأعرضه عليكم هنا للموافقة.',
    approved: 'شكرًا لكم. أحلت موافقتكم إلى فريقنا، وسيؤكدون الطلب {id} خلال يوم عمل واحد، ثم أطلب منكم المقاسات.',
    sizesSent: 'شكرًا لكم أستاذ أحمد. استلمت مقاسات الطلب {id} كاملةً ({sets}). يبدأ الإنتاج الآن، والتسليم متوقع في {date}. لا نحتاج منكم شيئًا آخر.',
    caseSent: 'شكرًا لكم. أحلت طلب التواصل إلى فريقنا برقم مرجعي {id}، وسيتواصل معكم أحد أعضاء الفريق خلال يوم عمل واحد.',
    btnRequest: 'طلب عرض سعر لـ {sets}',
```

`lib/journey.ts`:
- import `countOf` from `./i18n`.
- `planTurn` values: `people: countOf(locale, 'person', p.people), sets: countOf(locale, 'set', p.sets), spare: countOf(locale, 'set', p.spareSets), min: countOf(locale, 'set', POLICY.minimumSets)`; the Request button values stay `{ sets: countOf(locale, 'set', p.sets) }` (pass that instead of `{ sets: p.sets }`).
- `orderTurn`: signature `export function orderTurn(locale: Locale, o: Order, invoices: Invoice[] = []): Turn`; in `values` use `sets: countOf(locale, 'set', o.sets)`; replace the delivered branch with

```ts
  if (o.state === 'delivered') {
    const invoice = invoices.find((i) => !!i.order && i.order === o.salesOrder);
    const tail = invoice
      ? say('deliveredInvoice', { invoice: invoice.name, total: money(locale, invoice.total), date: day(locale, invoice.due) })
      : say('deliveredNoInvoice');
    return {
      say: `${say('delivered', { date: day(locale, iso(o.dates.delivered ?? o.due)) })} ${tail}`,
      buttons: [btn(locale, 'btnInvoices', { k: 'invoices' }), discuss(locale, id)],
    };
  }
```

- `sizesSentTurn`: `t(locale, 'journey.sizesSent', { id: docOf(o), sets: countOf(locale, 'set', o.sets), date: formatDate(locale, o.due) })`.
- `sizesAsk` is still said by the dock with `{ id, sets: countOf(locale, 'set', o.sets) }` (next step).

- [ ] **Step 4: Run the pure tests**

Run: `npm test`
Expected: all pass (`pace`, `i18n`, `journey` included).

- [ ] **Step 5: The dock pauses, types, and drops the trace**

`components/ask-erp.tsx`:
- import `import { typingMs } from '@/lib/pace';` and `countOf` from `@/lib/i18n`.
- delete `stepText`, `stepMeta`, `clock`, `Trail`, and the `<Trail … />` line in `Reply`; in `RecordCard` delete the `<time …>` element (keep the Show order button). In `Reply`, the heading becomes:

```tsx
          {turn.intent === 'orders' && (turn.rows?.length ?? 0) > sources.length && (
            <h3>{t(locale, 'erpAsk.evidenceSome', { shown: sources.length, count: turn.rows!.length })}</h3>
          )}
```

- add the pause (after `findIn`):

```ts
  const reduced = () => typeof window !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  /** Wait out the rest of a person's pause; time already spent fetching counts. */
  const beat = async (text: string, started: number) => {
    const wait = typingMs(text, reduced()) - (Date.now() - started);
    if (wait > 0) await new Promise((done) => setTimeout(done, wait));
  };
```

- in `read`, record `const started = Date.now();` right after `setBusy(true);` and call `await beat('', started);` right before `patchLast((a) => ({ ...a, steps: [data.step] …`.
- replace `act` in full (every branch now runs under `busy`, and every reply waits its beat):

```ts
  const act = async (a: Act, tapped?: string) => {
    if (busy || actionLock.current) return;
    if (a.k === 'orders') return void read('orders', {}, tapped);
    if (a.k === 'stock' || a.k === 'price') { purpose.current = a.k; return void read('options', {}, tapped); }
    echo(tapped);
    actionLock.current = true;
    setBusy(true);
    const started = Date.now();
    const reply = async (turn: JourneyTurn, home = false) => { await beat(turn.say, started); say(turn, home); };
    const ask = async (content: string) => { await beat(content, started); setTurns((all) => [...all, { role: 'prompt', content }]); };
    try {
      if (a.k === 'new') await reply(teamTurn(locale));
      else if (a.k === 'plan') await reply(planTurn(locale, a.kit, a.people));
      else if (a.k === 'approve') await reply(approveTurn(locale, a.quote, a.total));
      else if (a.k === 'contact') await reply(contactTurn(locale, a.topic, a.doc));
      else if (a.k === 'people') {
        await ask(t(locale, 'journey.people'));
        setStage({ k: 'people', kit: a.kit, ...(a.people ? { people: a.people } : {}) });
      } else if (a.k === 'more') {
        await reply(moreTurn(locale, await myOrders(), a.from));
      } else if (a.k === 'menu') {
        await reply(menuTurn(locale, (await myAccount()).orders, new Date().getHours(), turns.length > 0), true);
      } else if (a.k === 'order' || a.k === 'show') {
        const { orders, invoices } = await myAccount();
        const o = findIn(orders, a.id);
        if (a.k === 'show' && o) onOpenOrder?.(o.id);
        await reply(o ? orderTurn(locale, o, invoices) : noOrderTurn(locale));
      } else if (a.k === 'viewQuote') {
        const view = await api<QuoteView>(`/api/quotes/${encodeURIComponent(a.quote)}`);
        const o = findIn(await myOrders(), a.quote);
        await beat('', started);
        setTurns((all) => [...all, { role: 'quote', view }]);
        say(o ? quoteShownTurn(locale, o) : noOrderTurn(locale));
      } else if (a.k === 'invoices') {
        const rows = await api<Invoice[]>('/api/invoices');
        await beat('', started);
        setTurns((all) => [...all, { role: 'invoices', rows }]);
        say(invoicesTurn(locale, rows));
      } else if (a.k === 'sizes') {
        const o = findIn(await myOrders(), a.order);
        if (!o || o.state !== 'collecting_sizes') await reply(o ? orderTurn(locale, o) : noOrderTurn(locale));
        else {
          await ask(t(locale, 'journey.sizesAsk', { id: a.order, sets: countOf(locale, 'set', o.sets) }));
          setStage({ k: 'sizes', order: o, ...(a.run ? { run: a.run } : {}) });
        }
      } else if (a.k === 'requestQuote') {
        const concept = CONCEPTS.find((c) => c.id === a.kit) ?? CONCEPTS[0];
        const o = fromJson(await api<Order>('/api/quotes', {
          concept, staff: a.people, sets: a.sets, grades: [], sizePlan: { mode: 'collect_later', allocation: {} },
        }));
        own(o);
        onChanged?.();
        await reply(quoteSentTurn(locale, o));
      } else if (a.k === 'approveNow') {
        const o = fromJson(await api<Order>(`/api/quotes/${encodeURIComponent(a.quote)}/approve`, {}));
        own(o);
        onChanged?.();
        await reply(approvedTurn(locale, o));
      } else if (a.k === 'sendSizes') {
        const o = fromJson(await api<Order>(`/api/orders/${encodeURIComponent(a.order)}/sizes`, { allocation: a.run }));
        own(o);
        onChanged?.();
        await reply(sizesSentTurn(locale, o));
      } else if (a.k === 'sendContact') {
        const c = await api<{ name: string }>('/api/contact', { topic: a.topic, ...(a.doc ? { document: a.doc } : {}) });
        await reply(caseTurn(locale, c.name));
      }
    } catch (error) {
      // Refused (already approved, sizes already in, gone): not an outage.
      // Say where things stand instead of offering the same write again.
      const status = (error as { status?: number }).status;
      const id = refusedId(a);
      if (id && (status === 409 || status === 404)) {
        try {
          return await reply(movedTurn(locale, findIn(await myOrders(), id)));
        } catch { /* the re-read failed too: that is an outage */ }
      }
      // A failed menu is the menu: its Try again is the only way on.
      say(failTurn(locale, a), a.k === 'menu');
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  };
```

- `refresh` shows the typing beat too: replace its last line with

```ts
    if (stage.k !== 'turn') return;
    const turn = newsTurn(locale, news.current.splice(0));
    setBusy(true);
    await beat(turn.say, Date.now());
    say(turn);
    setBusy(false);
```

- the typing indicator, just before the choices list inside `.evBody`:

```tsx
        {busy && (
          <p className={s.evTyping} role="status" aria-label={t(locale, 'erpAsk.typing')}>
            <span /><span /><span />
          </p>
        )}
```

`app/ui.module.css`, after `.evAnswer { … }`:

```css
/* The account manager is typing: three dots, where the reply will land. */
.evTyping {
  display: inline-flex;
  align-self: flex-start;
  gap: 4px;
  margin: 0;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: var(--r);
  background: var(--surface);
}
.evTyping span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-3);
  animation: evBlink 0.6s ease-in-out infinite alternate;
}
.evTyping span:nth-child(2) { animation-delay: 0.2s; }
.evTyping span:nth-child(3) { animation-delay: 0.4s; }
```

and extend the existing reduced-motion rule to `.evSheet, .evChanged, .evLive_probing, .evStep_running .evDot, .evTyping span { animation: none; }`. Delete the now unused `.evTrail…`/`.evStep_…`/`.evDot` rules only if `grep -n "evTrail\|evStep_\|evDot" components app` shows no other user.

- [ ] **Step 6: Type-check and test**

Run: `npx tsc --noEmit -p . && npm test`
Expected: clean; all pass. `grep -rn "erpAsk.step\|checkedAt\|evidenceOne\|evidenceMany" components lib app` returns nothing.

- [ ] **Step 7: Browser check (EN + AR, desktop + phone; no seed reset)**

Playwright MCP at `http://127.0.0.1:3100`:
1. Desktop EN: the launcher reads "Your account manager"; header "Your account manager" / "UniformAI · replies from your live account". Tap More: `browser_snapshot` taken immediately shows the `status` "Your account manager is typing"; the reply arrives within ~1 s.
2. "Check my quotations and orders": `browser_evaluate` `() => /found in|Checked at|records/i.test(document.querySelector('[role=dialog]').innerText)` is `false`; if cut short, "Your latest 10 of N orders".
3. A delivered order's details say "Invoice ACC-SINV-… for EGP … is attached to this delivery, due on …".
4. AR: Start a new uniform request → team → 18 → Continue: the sentence contains "لفريق من 18 موظفًا" and "19 طقمًا".
5. `browser_emulate_media` `{ reducedMotion: 'reduce' }`: replies still show the dots briefly, not animated. Phone 390×844 EN and AR: screenshot the greeting and one reply.

- [ ] **Step 8: Commit**

```bash
git add lib/pace.ts lib/pace.test.ts lib/i18n.ts lib/i18n.test.ts lib/journey.ts lib/journey.test.ts components/ask-erp.tsx app/ui.module.css
git commit -m "Pause before each reply, speak as one account manager, and say who acts next

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task C: Order, invoice and size-run cards

**Files:**
- Create: `lib/cards.ts`, `lib/cards.test.ts`
- Modify: `lib/journey.ts` (`Turn.card`, `orderTurn`, `quoteShownTurn`, `invoicesTurn`, `movedTurn`; remove `sizeConfirmTurn`, `runText`, `Act.sizes.run`), `lib/journey.test.ts`, `lib/i18n.ts` (`journey.card.*`, `journey.invCard.*`, `invLateOne/invLateMany/invRest/invOnTime`, `btnDiscussInvoice`, `sizesAsk`, `btnSplit`; remove `confirmSizes, btnReviewRun, btnAdjust, invLatest, invOpen, invLate, invWord`), `components/chat-actions.tsx` (`OrderCard`, `InvoicesCard`, `SizeRunCard`; remove `InvoiceList`, `SizeRunForm`), `components/ask-erp.tsx`, `app/ui.module.css`

**Interfaces:**
- Consumes: `countOf` (Task B); `Invoice.order` (Task A); `orderTurn(locale, o, invoices)` (Task B).
- Produces (`lib/cards.ts`):
  - `type CardStepKey = 'quote' | 'approved' | 'confirmed' | 'sizes' | 'production' | 'delivered' | 'invoiced'`
  - `type CardStep = { key: CardStepKey; label: string; state: 'done' | 'now' | 'todo' }`
  - `type OrderCardView = { title: string; id: string; meta: string; steps: CardStep[]; nowLabel?: string; next: string; date?: string; action?: Button }`
  - `type InvoiceRowView = { id: string; amount: string; status: InvoiceStatus; label: string; note: string }`
  - `type InvoicesCardView = { outstanding: string; open: string; rows: InvoiceRowView[]; paid?: string; action?: Button }`
  - `type Card = { k: 'order'; view: OrderCardView } | { k: 'invoices'; view: InvoicesCardView }`
  - `invoiceOf(o: Order, invoices: Invoice[]): Invoice | undefined`; `orderCard(locale: Locale, o: Order, invoices: Invoice[]): OrderCardView`; `billingDoc(invoices: Invoice[]): string | undefined`; `invoicesCard(locale: Locale, invoices: Invoice[]): InvoicesCardView`
  - `lib/journey.ts`: `type Turn = { say: string; buttons: Button[]; card?: Card }`; `Act` member `{ k: 'sizes'; order: string }` (no `run`).
  - `components/chat-actions.tsx`: `OrderCard({ view, live, onAct })`, `InvoicesCard({ view, live, onAct })`, `SizeRunCard({ order, locale, onSend })` with `onAct: (b: Button) => void`, `onSend: (run: SizeAllocation) => void`.

- [ ] **Step 1: Write the failing tests**

Create `lib/cards.test.ts`:

```ts
// Run: npx tsx lib/cards.test.ts
import assert from 'node:assert/strict';
import { CONCEPTS } from './concepts';
import { sampleOrder } from './order-fixture';
import type { Order, Workflow } from './order';
import type { Invoice } from './invoices';
import { LOCALES } from './i18n';
import { billingDoc, invoicesCard, orderCard } from './cards';

const QUOTE_STATES: Workflow[] = ['quote_requested', 'quote_ready', 'quote_closed'];
const order = (state: Workflow): Order => ({
  ...sampleOrder(CONCEPTS[0], 40, 42, [], 650, new Date('2026-09-20T10:00:00'), state),
  quote: 'SAL-QTN-2026-00031',
  salesOrder: QUOTE_STATES.includes(state) ? undefined : 'SAL-ORD-2026-00011',
});
const bill = (over: Partial<Invoice> = {}): Invoice => ({
  name: 'ACC-SINV-2026-00010', date: '2026-09-29', due: '2026-10-29', total: 14345, outstanding: 14345,
  status: 'unpaid', order: 'SAL-ORD-2026-00011', ...over,
});
const bar = (o: Order, inv: Invoice[] = []) => orderCard('en', o, inv).steps.map((s) => s.state[0]).join('');

// The bar: done / now / todo, from the workflow.
assert.equal(bar(order('quote_requested')), 'ntttttt');
assert.equal(bar(order('quote_ready')), 'dnttttt');
assert.equal(bar(order('awaiting')), 'ddntttt');
assert.equal(bar(order('collecting_sizes')), 'dddnttt');
assert.equal(bar(order('in_progress')), 'ddddntt');
assert.equal(bar(order('delivered')), 'ddddddn');
assert.equal(bar(order('delivered'), [bill()]), 'ddddddd');
assert.equal(bar(order('quote_closed')), 'dtttttt');

// Who acts next, the key date, and one action.
let v = orderCard('en', order('quote_ready'), []);
assert.equal(v.next, 'Waiting on you');
assert.deepEqual(v.action?.act, { k: 'approve', quote: 'SAL-QTN-2026-00031', total: 27300 });
assert.equal(v.date, undefined);
assert.equal(v.id, 'SAL-QTN-2026-00031');
assert.match(v.meta, /^42 sets · EGP.27,300$/);
v = orderCard('en', order('awaiting'), []);
assert.match(v.next, /^With our team/);
assert.match(v.date ?? '', /^Expected delivery /);
assert.equal(v.action, undefined);
assert.equal(v.nowLabel, 'Order confirmed');
v = orderCard('en', order('collecting_sizes'), []);
assert.deepEqual(v.action?.act, { k: 'sizes', order: 'SAL-ORD-2026-00011' });
assert.equal(v.nowLabel, 'Sizes received');
v = orderCard('en', order('delivered'), [bill()]);
assert.equal(v.next, 'Complete');
assert.match(v.date ?? '', /^Delivered /);
assert.deepEqual(v.action?.act, { k: 'invoices' });
assert.equal(orderCard('en', order('delivered'), [bill({ order: 'SAL-ORD-2026-99999' })]).action, undefined, 'another order\'s invoice');
assert.equal(orderCard('en', order('quote_closed'), []).next, 'Closed');
for (const locale of LOCALES) {
  for (const s of ['quote_requested', 'quote_ready', 'awaiting', 'collecting_sizes', 'in_progress', 'delivered'] as Workflow[]) {
    const view = orderCard(locale, order(s), [bill()]);
    assert.equal(view.steps.length, 7);
    for (const text of [view.title, view.meta, view.next, ...view.steps.map((x) => x.label)]) {
      assert.doesNotMatch(text, /journey\.|orders\.|\{\w+\}|ERPNext|UA-/, text);
    }
  }
}

// Invoices: outstanding first, overdue pinned (oldest due first), paid collapsed, one action.
const invoices: Invoice[] = [
  bill({ name: 'ACC-SINV-2026-00010', date: '2026-09-29', due: '2026-10-29', outstanding: 14345 }),
  bill({ name: 'ACC-SINV-2026-00008', date: '2026-08-30', due: '2026-09-28', outstanding: 5000, status: 'overdue' }),
  bill({ name: 'ACC-SINV-2026-00007', date: '2026-08-27', due: '2026-09-26', outstanding: 9000, status: 'overdue' }),
  bill({ name: 'ACC-SINV-2026-00005', date: '2026-07-30', due: '2026-08-29', outstanding: 0, status: 'paid' }),
];
assert.equal(billingDoc(invoices), 'ACC-SINV-2026-00007', 'the oldest overdue invoice');
assert.equal(billingDoc([invoices[0], invoices[3]]), 'ACC-SINV-2026-00010', 'else the newest unpaid');
assert.equal(billingDoc([invoices[3]]), undefined);
const card = invoicesCard('en', invoices);
assert.match(card.outstanding, /^EGP.28,345 outstanding$/);
assert.equal(card.open, 'Open invoices: 3');
assert.deepEqual(card.rows.map((r) => r.id), ['ACC-SINV-2026-00007', 'ACC-SINV-2026-00008', 'ACC-SINV-2026-00010']);
assert.match(card.rows[0].note, /^Overdue since /);
assert.equal(card.paid, 'Paid invoices: 1');
assert.deepEqual(card.action?.act, { k: 'contact', topic: 'billing', doc: 'ACC-SINV-2026-00007' });
assert.equal(card.action?.label, 'Discuss invoice ACC-SINV-2026-00007');
assert.equal(invoicesCard('en', [invoices[3]]).action, undefined);

console.log('cards: all assertions passed');
```

In `lib/journey.test.ts`:
- remove `sizeConfirmTurn` from the import and the block from `const run = { men: { M: 21 }, women: { S: 21 } };` through the `// Adjust keeps what was entered.` assertion.
- replace `assert.deepEqual(primary(turn), { k: 'sizes', order: 'SAL-ORD-2026-00011' });` (the one after `orderTurn(locale, order('collecting_sizes'))`) with

```ts
  assert.deepEqual(turn.card?.k === 'order' && turn.card.view.action?.act, { k: 'sizes', order: 'SAL-ORD-2026-00011' });
  assert.equal(primary(turn), undefined, 'the card holds the one primary');
```

- replace `assert.deepEqual(primary(turn), { k: 'approve', quote: 'SAL-QTN-2026-00031', total: 27300 });` after `orderTurn(locale, order('quote_ready'))` with

```ts
  assert.deepEqual(turn.card?.k === 'order' && turn.card.view.action?.act, { k: 'approve', quote: 'SAL-QTN-2026-00031', total: 27300 });
  assert.deepEqual(turn.buttons.map((b) => b.act.k), ['viewQuote', 'contact']);
```

- in the double-tap block, replace the `first` / `confirm` lines with

```ts
  const cardApprove = orderTurn(locale, order('quote_ready')).card;
  assert.notEqual(turn.buttons.find((b) => b.primary)?.label, cardApprove?.k === 'order' ? cardApprove.view.action?.label : '');
  assert.notEqual(turn.buttons.findIndex((b) => b.primary), 0, 'the confirmation is not where the greeting\'s Approve was');
```

- replace the delivered/invoices assertions (`assert.ok(turn.buttons.some((b) => b.act.k === 'invoices'));` through `keep(invoicesTurn(locale, [invoices[2]]));`) with

```ts
  assert.ok(turn.buttons.some((b) => b.act.k === 'contact'));
  turn = keep(invoicesTurn(locale, invoices));
  assert.equal(turn.card?.k, 'invoices');
  assert.deepEqual(turn.card?.k === 'invoices' && turn.card.view.action?.act, { k: 'contact', topic: 'billing', doc: 'ACC-SINV-2026-00006' },
    'the case names the overdue invoice');
  turn = keep(invoicesTurn(locale, [invoices[2]]));
  assert.equal(turn.card?.k === 'invoices' && turn.card.view.action, undefined);
  assert.equal(invoicesTurn(locale, []).card, undefined);
```

- replace the two English invoice lines with

```ts
assert.equal(invoicesTurn('en', invoices).say, 'One invoice is past due. The rest are on time.');
assert.equal(invoicesTurn('en', [invoices[1]]).say, 'One invoice is past due.');
assert.equal(invoicesTurn('en', [invoices[0]]).say, 'All your open invoices are on time.');
assert.equal(invoicesTurn('en', [invoices[2]]).say, 'You have no unpaid invoices.');
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx tsx lib/cards.test.ts; npx tsx lib/journey.test.ts`
Expected: FAIL: cannot find `./cards`; `turn.card` is undefined.

- [ ] **Step 3: The view-models**

Create `lib/cards.ts`:

```ts
// lib/cards.ts
// What the chat's order and invoice cards show, worked out from the records
// and already in words. Pure, so the dock only lays it out.

import type { Order, Workflow } from './order';
import type { Invoice, InvoiceStatus } from './invoices';
import type { Button } from './journey';
import { type Locale, countOf, formatCurrency, formatDate, kitName, t } from './i18n';

export type CardStepKey = 'quote' | 'approved' | 'confirmed' | 'sizes' | 'production' | 'delivered' | 'invoiced';
export type CardStep = { key: CardStepKey; label: string; state: 'done' | 'now' | 'todo' };
export type OrderCardView = {
  title: string; id: string; meta: string; steps: CardStep[];
  nowLabel?: string; next: string; date?: string; action?: Button;
};
export type InvoiceRowView = { id: string; amount: string; status: InvoiceStatus; label: string; note: string };
export type InvoicesCardView = { outstanding: string; open: string; rows: InvoiceRowView[]; paid?: string; action?: Button };
export type Card = { k: 'order'; view: OrderCardView } | { k: 'invoices'; view: InvoicesCardView };

/** Five labels are the Orders timeline's own; two are the card's. */
const LABEL: Record<CardStepKey, string> = {
  quote: 'orders.step.issued', approved: 'orders.step.approved', confirmed: 'orders.step.confirmed',
  sizes: 'orders.step.sized', production: 'journey.card.production', delivered: 'orders.step.delivered',
  invoiced: 'journey.card.invoiced',
};
const KEYS = Object.keys(LABEL) as CardStepKey[];
/** Steps each state has finished. From the workflow rather than timeline():
 *  a hand-made order with no quote is still past the quote. */
const DONE: Record<Workflow, number> = {
  quote_requested: 0, quote_ready: 1, quote_closed: 1, awaiting: 2, collecting_sizes: 3, in_progress: 4, delivered: 6,
};
const DATED: Workflow[] = ['awaiting', 'collecting_sizes', 'in_progress'];
const day = (locale: Locale, iso: string) => formatDate(locale, new Date(`${iso}T12:00:00`));

/** The invoice that bills this order, once issued. */
export const invoiceOf = (o: Order, invoices: Invoice[]): Invoice | undefined =>
  invoices.find((i) => !!i.order && i.order === o.salesOrder);

export function orderCard(locale: Locale, o: Order, invoices: Invoice[]): OrderCardView {
  const invoice = o.state === 'delivered' ? invoiceOf(o, invoices) : undefined;
  const done = DONE[o.state] + (invoice ? 1 : 0);
  const now = o.state === 'quote_closed' || done >= KEYS.length ? -1 : done;
  const steps = KEYS.map((key, i): CardStep =>
    ({ key, label: t(locale, LABEL[key]), state: i < done ? 'done' : i === now ? 'now' : 'todo' }));
  const yours = o.state === 'quote_ready' || o.state === 'collecting_sizes';
  const next = t(locale, `journey.card.${o.state === 'quote_closed' ? 'closed' : now < 0 ? 'done' : yours ? 'you' : 'team'}`);
  const date = o.state === 'delivered'
    ? t(locale, 'journey.card.deliveredOn', { date: formatDate(locale, o.dates.delivered ?? o.due) })
    : DATED.includes(o.state) ? t(locale, 'journey.card.due', { date: formatDate(locale, o.due) }) : undefined;
  const total = formatCurrency(locale, o.total);
  const action: Button | undefined =
    o.state === 'quote_ready' && o.quote
      ? { label: t(locale, 'journey.btnApprove', { total }), act: { k: 'approve', quote: o.quote, total: o.total }, primary: true }
      : o.state === 'collecting_sizes' && o.salesOrder
        ? { label: t(locale, 'journey.btnSizes'), act: { k: 'sizes', order: o.salesOrder }, primary: true }
        : invoice ? { label: t(locale, 'journey.btnInvoices'), act: { k: 'invoices' }, primary: true } : undefined;
  return {
    title: o.concept ? kitName(locale, o.concept.id) : o.name,
    id: o.salesOrder ?? o.quote ?? o.id,
    meta: `${countOf(locale, 'set', o.sets)} · ${total}`,
    steps,
    ...(now >= 0 ? { nowLabel: steps[now].label } : {}),
    next,
    ...(date ? { date } : {}),
    ...(action ? { action } : {}),
  };
}

const overdue = (invoices: Invoice[]) =>
  invoices.filter((i) => i.status === 'overdue').sort((a, b) => a.due.localeCompare(b.due));

/** The invoice a billing question is about: the oldest overdue, else the newest unpaid. */
export function billingDoc(invoices: Invoice[]): string | undefined {
  return (overdue(invoices)[0] ?? invoices.find((i) => i.status === 'unpaid'))?.name;
}

export function invoicesCard(locale: Locale, invoices: Invoice[]): InvoicesCardView {
  const open = [...overdue(invoices), ...invoices.filter((i) => i.status === 'unpaid')];
  const paid = invoices.length - open.length;
  const doc = billingDoc(invoices);
  return {
    outstanding: t(locale, 'journey.invCard.outstanding',
      { total: formatCurrency(locale, open.reduce((n, i) => n + i.outstanding, 0)) }),
    open: t(locale, 'journey.invCard.open', { count: open.length }),
    rows: open.map((i) => ({
      id: i.name,
      amount: formatCurrency(locale, i.outstanding),
      status: i.status,
      label: t(locale, `journey.inv.${i.status}`),
      note: t(locale, i.status === 'overdue' ? 'journey.invCard.lateSince' : 'journey.invDue', { date: day(locale, i.due) }),
    })),
    ...(paid ? { paid: t(locale, 'journey.invCard.paid', { count: paid }) } : {}),
    ...(doc ? { action: {
      label: t(locale, 'journey.btnDiscussInvoice', { id: doc }),
      act: { k: 'contact', topic: 'billing', doc }, primary: true,
    } } : {}),
  };
}
```

`lib/i18n.ts`:
- `en.journey`: add

```ts
    card: {
      production: 'In production', invoiced: 'Invoiced', you: 'Waiting on you',
      team: 'With our team · usually within one working day', done: 'Complete', closed: 'Closed',
      due: 'Expected delivery {date}', deliveredOn: 'Delivered {date}',
    },
    invCard: { outstanding: '{total} outstanding', open: 'Open invoices: {count}', paid: 'Paid invoices: {count}', lateSince: 'Overdue since {date}' },
    invLateOne: 'One invoice is past due.', invLateMany: '{count} invoices are past due.',
    invRest: 'The rest are on time.', invOnTime: 'All your open invoices are on time.',
    btnDiscussInvoice: 'Discuss invoice {id}',
    sizesAsk: 'Here is a proposed size split for order {id}, {sets} in total. Adjust any number, then send it; it becomes the production plan.',
    btnSplit: 'Reset to the proposed split',
```

  and delete `confirmSizes`, `btnReviewRun`, `btnAdjust`, `invLatest`, `invOpen`, `invLate`, `invWord` (the old `sizesAsk` and `btnSplit` are replaced).
- `ar.journey`: add

```ts
    card: {
      production: 'قيد الإنتاج', invoiced: 'صدرت الفاتورة', you: 'بانتظاركم',
      team: 'لدى فريقنا · عادةً خلال يوم عمل واحد', done: 'مكتمل', closed: 'مغلق',
      due: 'التسليم المتوقع {date}', deliveredOn: 'تم التسليم {date}',
    },
    invCard: { outstanding: 'المستحق {total}', open: 'الفواتير المفتوحة: {count}', paid: 'الفواتير المسدّدة: {count}', lateSince: 'متأخرة منذ {date}' },
    invLateOne: 'فاتورة واحدة تجاوزت موعد استحقاقها.', invLateMany: 'عدد الفواتير التي تجاوزت موعد استحقاقها: {count}.',
    invRest: 'والباقي في موعده.', invOnTime: 'جميع فواتيركم المفتوحة في موعدها.',
    btnDiscussInvoice: 'الاستفسار عن الفاتورة {id}',
    sizesAsk: 'هذا توزيع مقترح لمقاسات الطلب {id}، وإجماليه {sets}. عدّلوا أي رقم ثم أرسلوه، وسيُعتمد خطةً للإنتاج.',
    btnSplit: 'العودة إلى التوزيع المقترح',
```

  and delete the same keys.

`lib/journey.ts`:
- `import { type Card, invoiceOf, invoicesCard, orderCard } from './cards';`; `export type Turn = { say: string; buttons: Button[]; card?: Card };`; in `Act` replace `{ k: 'sizes'; order: string; run?: SizeAllocation }` with `{ k: 'sizes'; order: string }`.
- `orderTurn`: build `const card: Card = { k: 'order', view: orderCard(locale, o, invoices) };` and return it on every branch; the primary buttons move to the card:

```ts
  if (o.state === 'quote_ready') {
    return { say: say('quote_ready'), buttons: [btn(locale, 'btnView', { k: 'viewQuote', quote }), discuss(locale, quote)], card };
  }
  if (o.state === 'delivered') {
    const invoice = invoiceOf(o, invoices);
    const tail = invoice
      ? say('deliveredInvoice', { invoice: invoice.name, total: money(locale, invoice.total), date: day(locale, invoice.due) })
      : say('deliveredNoInvoice');
    return { say: `${say('delivered', { date: day(locale, iso(o.dates.delivered ?? o.due)) })} ${tail}`, buttons: [discuss(locale, id)], card };
  }
  const key = o.state === 'in_progress' && o.perDelivered > 0 ? 'in_progress_part' : o.state;
  return { say: say(key), buttons: [discuss(locale, id)], card };
```

  and delete the existing `collecting_sizes` branch: the last return covers it (`say('collecting_sizes')`, Discuss, and the card's Enter the sizes).
- `quoteShownTurn` (the quote card is just above, so no order card and Approve stays a turn button):

```ts
export function quoteShownTurn(locale: Locale, o: Order): Turn {
  if (o.state !== 'quote_ready' || !o.quote) return orderTurn(locale, o);
  return {
    say: t(locale, 'journey.quoteShown'),
    buttons: [
      btn(locale, 'btnApprove', { k: 'approve', quote: o.quote, total: o.total }, { total: money(locale, o.total) }, true),
      discuss(locale, o.quote),
    ],
  };
}
```

- `invoicesTurn`:

```ts
/** One line: what is late, if anything. The card carries the figures and the one action. */
export function invoicesTurn(locale: Locale, invoices: Invoice[]): Turn {
  const open = invoices.filter((i) => i.status !== 'paid').length;
  const late = invoices.filter((i) => i.status === 'overdue').length;
  const say = !open ? t(locale, 'journey.invNone')
    : !late ? t(locale, 'journey.invOnTime')
      : [t(locale, late === 1 ? 'journey.invLateOne' : 'journey.invLateMany', { count: late }),
        ...(open > late ? [t(locale, 'journey.invRest')] : [])].join(' ');
  return { say, buttons: [], ...(invoices.length ? { card: { k: 'invoices' as const, view: invoicesCard(locale, invoices) } } : {}) };
}
```

- `movedTurn` keeps the card (a refused write shows where the order stands):

```ts
export function movedTurn(locale: Locale, o?: Order): Turn {
  const now = o ? orderTurn(locale, o) : noOrderTurn(locale);
  return { ...now, say: `${t(locale, 'journey.moved')} ${now.say}` };
}
```

- delete `runText` and `sizeConfirmTurn` (and the now unused `GarmentCut`, `SIZES` imports if nothing else uses them).

- [ ] **Step 4: Run the pure tests**

Run: `npm test`
Expected: all pass (`cards`, `journey`, `i18n` included).

- [ ] **Step 5: The components**

`components/chat-actions.tsx`: remove `InvoiceList` and `SizeRunForm`; add (imports: `import type { Button } from '@/lib/journey';`, `import type { InvoicesCardView, OrderCardView } from '@/lib/cards';`):

```tsx
export function OrderCard({ view, live, onAct }: { view: OrderCardView; live: boolean; onAct: (b: Button) => void }) {
  return (
    <section className={s.evCard} aria-label={`${view.title} ${view.id}`}>
      <div className={s.evTop}>
        <span className={s.evName} dir="auto">{view.title}</span>
        <bdi className={s.evId}>{view.id}</bdi>
      </div>
      <p className={s.evMeta}>{view.meta}</p>
      <ol className={s.evSteps}>
        {view.steps.map((step) => (
          <li key={step.key} aria-current={step.state === 'now' ? 'step' : undefined}
            className={step.state === 'done' ? s.evStepDone : step.state === 'now' ? s.evStepNow : undefined}>
            <span>{step.label}</span>
          </li>
        ))}
      </ol>
      <p className={s.evNext}>
        {view.nowLabel && <b>{view.nowLabel} · </b>}{view.next}{view.date && <> · {view.date}</>}
      </p>
      {view.action && (
        <button type="button" className={s.evPrimary} disabled={!live} onClick={() => onAct(view.action!)}>{view.action.label}</button>
      )}
    </section>
  );
}

export function InvoicesCard({ view, live, onAct }: { view: InvoicesCardView; live: boolean; onAct: (b: Button) => void }) {
  return (
    <section className={s.evCard} aria-label={view.outstanding}>
      <div className={s.evTop}><b className={s.evBig}>{view.outstanding}</b><span>{view.open}</span></div>
      {view.rows.length > 0 && (
        <ul className={s.evLines}>
          {view.rows.map((r) => (
            <li key={r.id}>
              <bdi className={s.evId}>{r.id}</bdi>
              <span>{r.amount}</span>
              <span className={`${s.evChip} ${s[`evChip_${r.status}`]}`}>{r.label}</span>
              <small>{r.note}</small>
            </li>
          ))}
        </ul>
      )}
      {view.paid && <p className={s.evMeta}>{view.paid}</p>}
      {view.action && (
        <button type="button" className={s.evPrimary} disabled={!live} onClick={() => onAct(view.action!)}>{view.action.label}</button>
      )}
    </section>
  );
}

/** Opens on the proposed split; the customer adjusts or simply sends. */
export function SizeRunCard({ order, locale, onSend }: { order: Order; locale: Locale; onSend: (run: SizeAllocation) => void }) {
  const cuts = cutsOf(order.concept);
  const [proposed] = useState(() => proposedSplit(cuts, order.sets));
  const [run, setRun] = useState<SizeAllocation>(proposed);
  const done = runTotal(run);
  const changed = JSON.stringify(run) !== JSON.stringify(proposed);
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
        {done > order.sets
          ? t(locale, 'journey.sizesOver', { done, over: done - order.sets })
          : t(locale, 'journey.sizesLeft', { done, left: order.sets - done })}
      </p>
      <div className={s.evRow}>
        {changed && <button type="button" onClick={() => setRun(proposed)}>{t(locale, 'journey.btnSplit')}</button>}
        <button type="button" className={s.evPrimary} disabled={done !== order.sets} onClick={() => onSend(run)}>
          {t(locale, 'journey.btnSendRun')}
        </button>
      </div>
    </div>
  );
}
```

`components/ask-erp.tsx`:
- import `OrderCard, InvoicesCard, SizeRunCard` (drop `InvoiceList, SizeRunForm`), `type Card` from `@/lib/cards`; drop `sizeConfirmTurn` from the journey import.
- `Turn` union: replace `| { role: 'invoices'; rows: Invoice[] }` with `| { role: 'card'; card: Card }`; `Stage`: `| { k: 'sizes'; order: Order }`.
- `say` appends the card after the sentence:

```ts
      { role: 'prompt', content: turn.say },
      ...(turn.card ? [{ role: 'card' as const, card: turn.card }] : []),
```

- `act`: the `invoices` branch becomes `await reply(invoicesTurn(locale, await api<Invoice[]>('/api/invoices')));`; in the `sizes` branch `setStage({ k: 'sizes', order: o });`.
- render (replace the `turn.role === 'invoices'` branch; `lastCard` computed once above the JSX as `const lastCard = turns.map((x) => x.role).lastIndexOf('card');`):

```tsx
        ) : turn.role === 'card' ? (
          turn.card.k === 'order'
            ? <OrderCard key={index} view={turn.card.view} live={!busy && index === lastCard} onAct={(b) => void act(b.act, b.label)} />
            : <InvoicesCard key={index} view={turn.card.view} live={!busy && index === lastCard} onAct={(b) => void act(b.act, b.label)} />
```

- the sizes stage:

```tsx
        {!busy && stage.k === 'sizes' && (
          <SizeRunCard key={stage.order.id} order={stage.order} locale={locale}
            onSend={(run) => void act({ k: 'sendSizes', order: stage.order.salesOrder ?? stage.order.id, run }, t(locale, 'journey.btnSendRun'))} />
        )}
```

`app/ui.module.css`, after `.evChip_overdue`:

```css
/* The order card: a seven-step bar, who acts next, one action. */
.evMeta { margin: 0; font-size: var(--t-sm); color: var(--text-2); }
.evBig { font-size: 20px; font-weight: 650; font-variant-numeric: tabular-nums; }
.evSteps { list-style: none; margin: var(--s1) 0 0; padding: 0; display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px; }
.evSteps li { display: grid; gap: 4px; align-content: start; font-size: var(--t-xs); line-height: 1.3; color: var(--text-3); }
.evSteps li::before { content: ''; height: 4px; border-radius: 2px; background: var(--line); }
.evSteps .evStepDone::before { background: var(--accent); }
.evSteps .evStepNow::before { background: var(--warn); }
.evSteps .evStepNow { color: var(--text); font-weight: 600; }
.evNext { margin: 0; font-size: var(--t-sm); color: var(--text-2); }
.evCard > button { justify-self: start; padding: 10px 14px; border: 1px solid var(--accent); border-radius: var(--r); font: inherit; cursor: pointer; }
.evCard > button:disabled { opacity: 0.5; cursor: default; }
@media (max-width: 760px) {
  /* Seven labels do not fit a phone; the "next" line names the current step. */
  .evSteps li span { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
}
```

- [ ] **Step 6: Type-check and test**

Run: `npx tsc --noEmit -p . && npm test`
Expected: clean; all pass. `grep -rn "sizeConfirmTurn\|runText\|InvoiceList\|SizeRunForm\|btnReviewRun\|confirmSizes" lib components app` returns nothing.

- [ ] **Step 7: Browser check (EN + AR, desktop + phone; no seed reset)**

Playwright MCP at `http://127.0.0.1:3100`:
1. Desktop EN: Check my quotations and orders → Details of an order awaiting confirmation: the card shows the kit, id, "N sets · EGP …", a 7-step bar with 2 done and "Order confirmed" current, "With our team · usually within one working day · Expected delivery …", and no action button.
2. A collecting-sizes order ("Send the sizes for …" from the greeting): the size card opens filled, "N assigned, 0 left", no Reset button; change one number → Reset appears and Send disables until the total is right; Reset → Send the size run → "…Production starts now; expected delivery …". Taps from Home: launcher, Send the sizes, Send = 3.
3. `npm run team -- deliver <that SAL-ORD>`, dispatch `focus`, open: the news line names the invoice; Show order: the card has all 7 steps done, "Complete", "Delivered …", and Invoices as the one action.
4. More → Invoices: the card leads with "EGP … outstanding" and "Open invoices: N", overdue rows first with "Overdue since …", "Paid invoices: N", one "Discuss invoice ACC-SINV-…" naming the oldest overdue.
5. AR desktop and phone 390×844: the bar runs right to left; on phone the step labels are hidden and the "next" line begins with the current step's name. Screenshot each.

- [ ] **Step 8: Commit**

```bash
git add lib/cards.ts lib/cards.test.ts lib/journey.ts lib/journey.test.ts lib/i18n.ts components/chat-actions.tsx components/ask-erp.tsx app/ui.module.css
git commit -m "Show orders as a step card, invoices as one outstanding figure, and sizes as one send

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task D: Fewer taps and polish

**Files:**
- Create: `lib/rich.ts`, `lib/rich.test.ts`
- Modify: `lib/journey.ts` (contact sends on first tap; `caseTurn(locale, name, doc?)`; `planTurn` buttons; `Act` loses `contact`, `plan`, `people.people`), `lib/cards.ts` (billing action → `sendContact`), `lib/journey.test.ts`, `lib/cards.test.ts`, `lib/i18n.ts` (`journey.caseAbout`; remove `contactAbout, contactBilling, contactGeneral, btnContinue, btnChangePeople, peopleEcho`), `components/chat-actions.tsx` (`Rich`, `PeopleForm`), `components/ask-erp.tsx` (scroll to top, `Rich`, people form, contact), `app/ui.module.css` (`.evNum`, `.evId`, `.evTurn`, 44 px)

**Interfaces:**
- Consumes: `Turn.card`, `OrderCard`, `InvoicesCard` (Task C); `planTurn` (Task B copy); `beat`/`reply` (Task B dock).
- Produces:
  - `lib/rich.ts`: `type Piece = { text: string; code: boolean }`; `splitCodes(text: string): Piece[]`.
  - `lib/journey.ts`: `caseTurn(locale: Locale, name: string, doc?: string): Turn`; `Act` members `{ k: 'people'; kit: string }` and `{ k: 'sendContact'; topic: Topic; doc?: string }` (no `contact`, no `plan`).
  - `components/chat-actions.tsx`: `Rich({ text })`; `PeopleForm({ locale, kit, initial?, onRequest: (b: Button) => void })`.

- [ ] **Step 1: Write the failing tests**

Create `lib/rich.test.ts`:

```ts
// Run: npx tsx lib/rich.test.ts
import assert from 'node:assert/strict';
import { splitCodes } from './rich';

const en = 'Order SAL-ORD-2026-00047 for EGP 27,451 is ready.';
assert.deepEqual(splitCodes(en), [
  { text: 'Order ', code: false }, { text: 'SAL-ORD-2026-00047', code: true },
  { text: ' for ', code: false }, { text: 'EGP 27,451', code: true }, { text: ' is ready.', code: false },
]);
for (const id of ['SAL-QTN-2026-00074', 'ACC-SINV-2026-00010', 'MAT-DN-2026-00014', 'CASE-2026-00002']) {
  assert.deepEqual(splitCodes(id), [{ text: id, code: true }]);
}
const ar = 'تم تسليم الطلب ⁨SAL-ORD-2026-00046⁩، وفاتورته ⁨ACC-SINV-2026-00010⁩ بقيمة ⁨EGP 14,345⁩ جاهزة';
assert.equal(splitCodes(ar).map((p) => p.text).join(''), ar, 'nothing is lost or reordered');
assert.deepEqual(splitCodes(ar).filter((p) => p.code).map((p) => p.text), ['SAL-ORD-2026-00046', 'ACC-SINV-2026-00010', 'EGP 14,345']);
assert.deepEqual(splitCodes(''), []);
assert.deepEqual(splitCodes('No codes here.'), [{ text: 'No codes here.', code: false }]);
console.log('rich: all assertions passed');
```

In `lib/journey.test.ts`:
- drop `contactTurn` from the import; replace the `// 5. Contact our team.` block (through `keep(contactTurn(locale, 'general'));`) with

```ts
  // 5. Contact our team: one tap sends, from the greeting and from Discuss.
  assert.deepEqual(menuTurn(locale, [], 15).buttons.find((b) => b.act.k === 'sendContact')?.act, { k: 'sendContact', topic: 'general' });
  assert.deepEqual(orderTurn(locale, order('awaiting')).buttons[0].act, { k: 'sendContact', topic: 'order', doc: 'SAL-ORD-2026-00011' });
  turn = keep(caseTurn(locale, 'CASE-2026-00008', 'ACC-SINV-2026-00006'));
  assert.ok(turn.say.includes('ACC-SINV-2026-00006') && turn.say.includes('CASE-2026-00008'));
```

- replace the Change-the-number assertion (`assert.deepEqual(turn.buttons.find((b) => b.act.k === 'people')?.act, …)`) with

```ts
  assert.deepEqual(turn.buttons.map((b) => b.act.k), ['requestQuote'], 'the people form requests in one tap');
```

- in the greeting assertions from Task A, change `'contact'` to `'sendContact'` in the three `map((b) => b.act.k)` lists; in Task C's quote-ready line change `['viewQuote', 'contact']` to `['viewQuote', 'sendContact']`, the delivered line `b.act.k === 'contact'` to `'sendContact'`, and the invoices action to `{ k: 'sendContact', topic: 'billing', doc: 'ACC-SINV-2026-00006' }`.

In `lib/cards.test.ts`, change the billing action expectation to `{ k: 'sendContact', topic: 'billing', doc: 'ACC-SINV-2026-00007' }`.

- [ ] **Step 2: Run to verify they fail**

Run: `npx tsx lib/rich.test.ts; npx tsx lib/journey.test.ts; npx tsx lib/cards.test.ts`
Expected: FAIL: cannot find `./rich`; acts are still `contact`.

- [ ] **Step 3: Implement the pure parts**

Create `lib/rich.ts`:

```ts
// lib/rich.ts
// Document numbers and amounts inside a sentence, found so the dock can keep
// each one whole on one line (and isolated in Arabic).

const CODE = /(?:SAL-QTN|SAL-ORD|ACC-SINV|MAT-DN|CASE)-\d{4}-\d{3,6}|EGP [\d,]+(?:\.\d+)?/g;

export type Piece = { text: string; code: boolean };

export function splitCodes(text: string): Piece[] {
  const out: Piece[] = [];
  let at = 0;
  for (const m of text.matchAll(CODE)) {
    const start = m.index ?? 0;
    if (start > at) out.push({ text: text.slice(at, start), code: false });
    out.push({ text: m[0], code: true });
    at = start + m[0].length;
  }
  if (at < text.length) out.push({ text: text.slice(at), code: false });
  return out;
}
```

`lib/journey.ts`:
- `Act`: replace `| { k: 'people'; kit: string; people?: number } | { k: 'plan'; kit: string; people: number }` with `| { k: 'people'; kit: string }`; replace `| { k: 'contact'; topic: Topic; doc?: string } | { k: 'sendContact'; topic: Topic; doc?: string }` with `| { k: 'sendContact'; topic: Topic; doc?: string }`.
- `discuss`: `btn(locale, 'btnDiscuss', { k: 'sendContact', topic: 'order', doc })`; in `homeButtons`: `btn(locale, 'btnContact', { k: 'sendContact', topic: 'general' })`.
- `planTurn` buttons: only `btn(locale, 'btnRequest', { k: 'requestQuote', kit, people, sets: p.sets }, { sets: countOf(locale, 'set', p.sets) }, true)`.
- delete `contactTurn`; replace `caseTurn`:

```ts
export const caseTurn = (locale: Locale, name: string, doc?: string): Turn => ({
  say: doc ? t(locale, 'journey.caseAbout', { id: name, doc }) : t(locale, 'journey.caseSent', { id: name }),
  buttons: [],
});
```

`lib/cards.ts`: the billing action's `act` becomes `{ k: 'sendContact', topic: 'billing', doc }`.

`lib/i18n.ts`: add `caseAbout` (EN `'Thank you. I have asked our team to contact you about {doc} (reference {id}); someone will be in touch within one working day.'`, AR `'شكرًا لكم. أحلت طلب التواصل بشأن {doc} إلى فريقنا برقم مرجعي {id}، وسيتواصل معكم أحد أعضاء الفريق خلال يوم عمل واحد.'`); delete `contactAbout`, `contactBilling`, `contactGeneral`, `btnContinue`, `btnChangePeople`, `peopleEcho` in both.

- [ ] **Step 4: Run the pure tests**

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: The dock and forms**

`components/chat-actions.tsx`: add `import { splitCodes } from '@/lib/rich';`, `import { planTurn } from '@/lib/journey';` and:

```tsx
/** A sentence with its document numbers and amounts kept whole. */
export function Rich({ text }: { text: string }) {
  return <>{splitCodes(text).map((p, i) => (p.code ? <bdi key={i} className={s.evNum}>{p.text}</bdi> : p.text))}</>;
}
```

Replace `PeopleForm` (the recommendation shows live; the button requests):

```tsx
export function PeopleForm({ locale, kit, initial = 20, onRequest }: {
  locale: Locale; kit: string; initial?: number; onRequest: (b: Button) => void;
}) {
  const [people, setPeople] = useState(initial);
  const [valid, setValid] = useState(initial);
  const ok = Number.isInteger(people) && people >= 1 && people <= 500;
  const plan = planTurn(locale, kit, valid);
  const request = plan.buttons[0];
  return (
    <form className={s.evPanel} onSubmit={(e) => { e.preventDefault(); if (ok) onRequest(request); }}>
      <input type="number" min={1} max={500} inputMode="numeric" value={people} autoFocus
        aria-label={t(locale, 'journey.people')}
        onChange={(e) => {
          const n = Math.floor(Number(e.target.value));
          setPeople(n);
          if (Number.isInteger(n) && n >= 1 && n <= 500) setValid(n);
        }} />
      <p className={s.evRunLeft} aria-live="polite"><Rich text={plan.say} /></p>
      <button type="submit" className={s.evPrimary} disabled={!ok}><Rich text={request.label} /></button>
    </form>
  );
}
```

In `OrderCard` / `InvoicesCard`, render `view.meta`, `view.outstanding`, row amounts and action labels through `<Rich text={…} />`.

`components/ask-erp.tsx`:
- `Stage`: `| { k: 'people'; kit: string }`; in `act` delete the `plan` and `contact` branches; the `people` branch sets `setStage({ k: 'people', kit: a.kit })`; the `sendContact` branch replies `caseTurn(locale, c.name, a.doc)`.
- people form:

```tsx
        {!busy && stage.k === 'people' && (
          <PeopleForm locale={locale} kit={stage.kit} onRequest={(b) => void act(b.act, b.label)} />
        )}
```

- render prompt/user text and choice labels with `<Rich text={…} />` (`turn.content`, `c.label`), and the `Reply` answer `content`.
- every turn gets a scroll anchor: wrap each item of `turns.map` in `<div key={index} data-turn={index} className={s.evTurn}>…</div>` (move the `key` from the inner element to the wrapper).
- replace the scroll-to-bottom effect:

```ts
  // Each new reply opens on its first line; a short one shows whole, with its
  // buttons. `anchor` is the first turn added since the last run.
  const shown = useRef(0);
  const anchor = useRef(0);
  useEffect(() => {
    const box = log.current;
    if (!box) return;
    if (turns.length < shown.current) { shown.current = 0; anchor.current = 0; }
    if (turns.length > shown.current) { anchor.current = shown.current; shown.current = turns.length; }
    const el = box.querySelector<HTMLElement>(`[data-turn="${anchor.current}"]`);
    const top = el ? box.scrollTop + el.getBoundingClientRect().top - box.getBoundingClientRect().top - 8 : 0;
    box.scrollTo({ top: Math.min(top, box.scrollHeight - box.clientHeight), behavior: reduced() ? 'auto' : 'smooth' });
  }, [turns, busy, stage]); // eslint-disable-line react-hooks/exhaustive-deps
```

`app/ui.module.css`:
- in `.evId` replace `overflow-wrap: anywhere;` with `white-space: nowrap;` and `unicode-bidi: isolate;`; set `.evTop { … flex-wrap: wrap; }`.
- add:

```css
/* A document number or amount inside a sentence stays whole. */
.evNum { white-space: nowrap; unicode-bidi: isolate; }
.evTurn { display: block; }

@media (max-width: 760px) {
  .evSuggest button, .evPanel button, .evCard > button { min-height: 44px; }
  .dockClose { min-width: 44px; min-height: 44px; display: inline-grid; place-items: center; }
  .evRun { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .evRun input { min-height: 44px; }
}
```

- [ ] **Step 6: Type-check and test**

Run: `npx tsc --noEmit -p . && npm test`
Expected: clean; all pass. `grep -rn "contactTurn\|k: 'contact'\|k: 'plan'\|btnChangePeople\|peopleEcho" lib components` returns nothing.

- [ ] **Step 7: Browser check (EN + AR, desktop + phone; no seed reset)**

Playwright MCP at `http://127.0.0.1:3100`:
1. Contact, desktop EN: launcher → "Ask the team to contact me": one echo bubble, then "Thank you. I have passed your request to our team (reference CASE-…); …". 2 taps, no second button with the same label. From the invoices card, "Discuss invoice ACC-SINV-…" gives the `caseAbout` receipt naming that invoice.
2. New request: launcher → Start a new uniform request → a team → type 18 → the form already says "For 18 people I recommend 19 sets…"; the button "Request a quotation for 19 sets" sends it (4 taps). AR: "لفريق من 18 موظفًا … 19 طقمًا" live under the field.
3. Scroll: Check my quotations and orders. After the reply, `browser_evaluate` checks that the reply's first turn is at the top of `.evBody` (its `getBoundingClientRect().top` within 16 px of the body's top).
4. Phone 390×844 AR: `browser_evaluate` `() => [...document.querySelectorAll('[class*=evNum],[class*=evId]')].every((e) => e.getClientRects().length === 1)` is `true`; `() => [...document.querySelectorAll('[role=dialog] button, [role=dialog] input')].filter((e) => e.offsetParent).every((e) => e.getBoundingClientRect().height >= 44)` is `true` on the greeting and on the size card.
5. Desktop and phone, EN and AR: screenshot the greeting, an order card, the invoices card and the size card. Confirm nothing is mirrored by hand in RTL and there is no horizontal scroll (`document.documentElement.scrollWidth <= innerWidth`).
6. Re-count the spec's tap targets: approve 3, new request 4, send sizes 3, order and invoices 1 (after a `deliver`), contact 2. Note any miss in the task report.

- [ ] **Step 8: Commit**

```bash
git add lib/rich.ts lib/rich.test.ts lib/journey.ts lib/journey.test.ts lib/cards.ts lib/cards.test.ts lib/i18n.ts components/chat-actions.tsx components/ask-erp.tsx app/ui.module.css
git commit -m "Send contact on the first tap, request from the people step, keep numbers whole, and scroll replies to their top

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Spec coverage

| Spec point | Task |
|---|---|
| A: baseline, focus/visibility, on open, 30 s while open, diff, "Since we last spoke", unread dot, own writes not news | A |
| A: greeting from Home's sentence (time of day), waiting items each a button, ≤4 + More, overflow paging; View on the confirmation | A |
| Invoice → order link (`items.sales_order`) | A (used by B, C) |
| B: typing indicator, reduced motion, all acts under `busy` | B |
| B: one voice (launcher/title/subtitle), no trace / Checked at / records | B |
| B: who acts next in every reply; delivered names its invoice | B |
| B: Arabic counts (`countOf`), "لفريق من 18 موظفًا", "أحلت طلب التواصل" | B |
| B: readable size-run sentence | C (the sentence is replaced by the size card) |
| C: order status card (7 steps, next owner, date, one action) | C |
| C: invoices card (outstanding first, overdue pinned, paid collapsed, one action) | C |
| D: billing contact names the overdue invoice, else newest unpaid (`billingDoc`) | C (moved to `sendContact` in D) |
| C: size card folding split, review and send | C |
| D: contact one tap from the greeting and sent on first tap | A (button) + D (sends) |
| D: numbers never wrap; scroll to reply top; 44 px; RTL | D |
| Tap targets | A (approve 3), C (sizes 3), D (new 4, contact 2), A+B (order and invoices 1) |
