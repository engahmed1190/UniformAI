# UniformAI Client Services: the conversational assistant

Date: 2026-09-29
Status: draft, awaiting review
Builds on: `2026-09-29-erp-orders-and-guided-assistant-design.md` (the sales
workflow, the guided assistant, the evidence cards). This spec replaces that
document's Part 2 flow with a full client journey.

## Why

The client's most important request: the assistant is how a UniformAI
customer gets uniforms, start to end, as a conversation with a company's
client-services team. It must feel professional, informative and pleasant,
work on every screen, and cover every case a client meets.

Success: in the client demo the presenter runs the entire story, from "we
need uniforms" to delivery, by tapping through the conversation, while the
screens show each step happen.

## Decisions

| Question | Decision |
|---|---|
| Model | None. Fixed buttons; every sentence is built from app or ERPNext data. |
| Who drives | The conversation drives; the screens follow and stay usable by hand, in sync. |
| Form | The current floating button and sheet, on every screen. |
| Journeys | New uniform → quotation; quotation → approval → tracking; reorder from history; sizes, stock, prices and invoices, contact. |
| Voice | A company's client-services team writing to a corporate client. |

## Voice

- Courteous, precise, calm. Formal address in both languages: "Mr. Ahmed" /
  "أستاذ أحمد"، "حضرتك". Modern Standard Arabic.
- No emoji, no robot avatar, no exclamation marks, no slang.
- Header: the UniformAI brand mark and "UniformAI Client Services" /
  "خدمة عملاء UniformAI".
- Every statement is specific: document number, date, amount. When the
  records hold nothing, it says so and does not guess.
- Buttons name the action exactly: "Request quotation for 42 sets" not
  "Let's go". An action that creates or changes a document states what will
  happen, including the amount where there is one.
- Never mentions ERPNext, an ERP, item codes, internal statuses or URLs.

## Part 1: The assistant on every screen

What stays from today's dock: the launcher with its live dot, the sheet, the
step trail, evidence cards, "Show order", the change card (260 → 40).

### One conversation across screens

- The assistant is mounted once at the page root, not per screen, and keeps
  one transcript while the client moves between screens by conversation or
  by hand. It replaces the Orders dock and the configure screen's designer
  chat (the configurator's suggestion chips become its buttons there).
- The transcript is kept for the browser session. A page reload starts a
  fresh conversation; orders, quotations and kits are unaffected because
  they live in ERPNext and in saved kits.

### Opening line per screen

When the sheet opens, or when the client arrives on a screen by hand, the
assistant adds one line for where they are, only if the last thing it said
is not already about that screen:

| Screen | Opening |
|---|---|
| Home | Greeting by time of day and name, then what needs the client: a quotation ready for review, sizes to send, or nothing. Buttons: the pending item first, then [New uniform request] [My orders] [More]. |
| Design | "Three proposals are shown for your team. Please select one to continue." One button per proposal. |
| Configure | "You may adjust this kit or request a quotation." The configurator's suggestion chips, [Request quotation for N sets, EGP X]. |
| Saved kits | "Would you like to reorder one of your saved kits?" One button per kit. |
| Orders | The open order's state, next step and date, with the actions its state allows. |
| Settings | Nothing added. |

### Sheet placement while the conversation drives the screen

- **Desktop (≥ 1100 px):** the sheet stays open at the inline-end side;
  while it is open the page content gets inline-end padding equal to the
  sheet's width, so the screen being changed is visible beside the chat.
- **Below 1100 px and on phones:** after an action that changes the screen,
  the sheet collapses to a **peek card** above the launcher showing the
  assistant's latest line and its buttons. Tapping the card, or any button
  that needs more room, opens the full sheet again.

### Badge

The launcher shows a count of things waiting on the client: quotations in
Quote ready plus orders in Collecting sizes, from the same orders data the
screens use.

## Part 2: The journeys

Each step below is: what the assistant says → the buttons. The screen
changes are in brackets. "Menu" returns to the Home opening.

### Menu

"How may we help you today?" [New uniform request] [Reorder a previous
order] [My quotations and orders] [Stock availability] [Prices and
invoices] [Contact our team]

### 1. New uniform request → quotation

1. "Which team is this uniform for?" [Technicians] [Front office]
   [Operations] [Management]
2. "How many staff will wear it?" [10] [20] [40] [60] and a − / +
   stepper for another number. Sets include the spare allowance already used
   by the configurator.
3. "Do you have a colour preference?" Swatches from the app's palette,
   [No preference].
4. "Where should your logo appear?" [Left chest] [Sleeve] [Back] [No logo]
5. The app composes a brief from the answers and generates the proposals
   (the same `generate(brief)` the Home brief box uses). [Design screen shows
   the three proposals.] "Three proposals for 40 technicians are shown.
   Please select one." One button per proposal.
6. [Configure screen opens on the choice.] "This kit is priced at EGP X per
   person, EGP Y for N sets. You may adjust it or request a quotation."
   The configurator's suggestion chips (fabric, colour, logo, sizes), each
   applied through the configurator's existing edit path, and
   [Request quotation for N sets, EGP Y].
7. Request → a draft Quotation (the existing `POST /api/quotes`). "Thank
   you. Quotation SAL-QTN-… has been requested. Our team will review it and
   confirm pricing, normally within one working day." Card: the quotation.
   [My quotations and orders] [Menu]

### 2. Quotation → approval → tracking

- **Quote ready:** "Quotation SAL-QTN-… is ready for your review: EGP
  27,451.20 for 42 sets, including a 5% volume discount (estimate EGP
  28,896). Valid until 29 Oct." [Approve quotation] [View quotation]
  [Discuss with our team]
- **Approve** → a confirmation step: "Approve quotation SAL-QTN-… for EGP
  27,451.20?" [Approve] [Not now]. Then the existing approve route. "Thank
  you. Sales order SAL-ORD-… has been created and is awaiting our
  confirmation." Card: the order.
- **Awaiting confirmation / Collecting sizes / In progress / Delivered:**
  the state in plain words, the delivery date (actual when delivered),
  percent delivered, and the next step. Collecting sizes offers
  [Send size run]. [Show order] opens the order's timeline.
- **My quotations and orders:** the count by state (from all orders), then
  one card per order, most recent first, capped at 10, each with
  [Details of …].
- **Quote closed:** "Quotation SAL-QTN-… is no longer open. We would be
  pleased to prepare a new one." [Request a new quotation] (starts journey
  3 with that kit).

### 3. Reorder

1. "Which order would you like to repeat?" One button per past order that
   has a kit, most recent first, labelled "Management, Aug 2026, 13 sets".
   Also the client's saved kits.
2. "How many staff this time?" The previous count preselected; the stepper.
3. [Configure opens with that kit.] Then as journey 1 step 6.

### 4. Sizes, stock, prices and invoices, contact

- **Send size run** (an order in Collecting sizes): for each cut on the
  kit, a row of S, M, L, XL with − / + steppers and a running total against
  the sets. The send button stays disabled until the total equals the sets.
  [Send size run for SAL-ORD-…] → the size plan is saved on the Sales Order
  (below). "Thank you. The size run for SAL-ORD-… has been received; the
  order is now in production."
- **Stock availability:** today's flow (garment → colour → size), with
  [Check again] [Another item].
- **Prices and invoices:** [Last price paid] (today's flow) and [Invoices]:
  the client's submitted Sales Invoices, most recent first, each with date,
  amount, and Paid / Unpaid / Overdue with the amount outstanding; a total
  outstanding line.
- **Contact our team:** "What would you like to discuss?" [A quotation]
  [An order] [Sizes] [Billing] [Something else]; for quotation/order,
  which one (buttons); then [Send request]. Creates an ERPNext Issue for
  BrainWise Technology (subject from the topic and document, description
  naming the document). "Your request CASE-… has been logged. A member of
  our team will contact you within one working day."

Every read-only answer carries its evidence cards, as today.

## Part 3: How the conversation drives the screens

### The journey is data, and pure

`lib/journey.ts` holds the conversation as a state machine with no React
and no fetch:

```ts
type Step = { id: string; say: Line[]; buttons: Button[] };
type Button = { label: Line; event: JourneyEvent; primary?: boolean };
type Effect =
  | { kind: 'generate'; brief: string; staff: number }
  | { kind: 'select'; index: number }
  | { kind: 'refine'; text: string }
  | { kind: 'navigate'; page: PageId; orderId?: string }
  | { kind: 'requestQuote' }
  | { kind: 'approve'; quote: string }
  | { kind: 'sendSizes'; order: string; allocation: SizeAllocation }
  | { kind: 'contact'; topic: Topic; document?: string }
  | { kind: 'read'; intent: Intent; params: Record<string, string> };

function next(state: JourneyState, event: JourneyEvent, ctx: AppContext):
  { state: JourneyState; step: Step; effects: Effect[] };
function greet(state: JourneyState, ctx: AppContext): Step | null;
```

`AppContext` is a read-only snapshot the page provides: current page,
orders, the active kit and its price, saved kits, profile name. Lines are
i18n keys with values, rendered in the current locale, so switching
language re-renders the transcript.

### The page is the only owner of app state

`components/assistant.tsx` renders the sheet and runs a step's effects
through an `AppBridge` that `app/page.tsx` builds from its existing
handlers: `generate`, `setSel`, the configurator's edit, `setPage`,
the quote request (extracted from the quote dialog into one function both
use), approve (the same call the Approve button makes), and the new sizes
and contact calls. The assistant never keeps its own copy of orders or
kits; a screen change by hand and one by conversation are the same state
change.

Effect results (a quotation number, an order, an error) come back as a
`JourneyEvent`, so the next line is chosen by `next()` too, and failures
read as a sentence with [Try again] [Contact our team], never a raw code.

### Server additions

| Route | Does | ERPNext |
|---|---|---|
| `POST /api/orders/[name]/sizes` | Saves the size run into `uniformai_kit` on a submitted Sales Order | Refuses unless the order is BrainWise's, submitted, in Collecting sizes, and every count is an integer ≥ 0 summing to its sets. `frappe.client.set_value` on `uniformai_kit` only, with the Portal key. |
| `POST /api/contact` | Logs a request | Inserts an `Issue` for BrainWise with the topic as subject and the document in the description, Portal key. |
| `POST /api/ask` intent `invoices` | Lists invoices | Read key: submitted Sales Invoices for BrainWise, `name, posting_date, due_date, grand_total, outstanding_amount, status`, status mapped to Paid / Unpaid / Overdue. |

Portal user additions, through the permission manager: write on Sales
Order (the route writes one field on one customer's submitted orders
only), create and read on Issue. Unverified: whether `set_value` on an
allow-on-submit field of a submitted order needs more than write; the first
implementation task probes it against the live site and grants exactly
what it asks for.

### Files

| File | Change |
|---|---|
| `lib/journey.ts`, `lib/journey.test.ts` | New. The conversation. |
| `components/assistant.tsx` | New, replaces `components/ask-erp.tsx`. |
| `components/configurator.tsx` | The designer chat dock removed; its suggestion chips exposed to the assistant. |
| `app/page.tsx` | Mounts the assistant once, builds `AppBridge`, extracts the quote request, adds page padding while the sheet is open on desktop. |
| `lib/sales.ts`, `app/api/orders/[name]/sizes/route.ts`, `app/api/contact/route.ts` | Sizes and contact. |
| `lib/ask.ts`, `lib/answers.ts` | `invoices` intent. |
| `lib/i18n.ts` | The voice, both languages. |
| `scripts/seed-erp.ts` | Portal permissions for sizes and Issue; one unpaid and one overdue invoice in the history so the invoices answer has something to say. |

## Testing

- `lib/journey.test.ts`: each journey scripted start to end as a list of
  button events against a fixture `AppContext`, asserting the effects
  emitted and that every line resolves to a string in both locales with no
  "ERP", no item code, no emoji and no exclamation mark; the opening line
  per screen; the badge count; error events produce a sentence and
  [Try again].
- `lib/sales.test.ts`: sizes refused for another customer, a draft, a
  non-collecting order, a wrong total, non-integers; contact creates an
  Issue with the fixed customer.
- `lib/answers.test.ts`: invoices, including nothing found.
- Rehearsal in the browser, Arabic and English, desktop and phone: the four
  journeys end to end against `uniform.localhost`, then
  `npm run seed:erp -- --reset`.

## Out of scope

- Free text input and any AI model.
- Customer login; one customer, a constant.
- Payments.
- Persisting the transcript across page reloads.
