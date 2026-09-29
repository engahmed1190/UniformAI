// lib/journey.ts
// The account manager's side of the conversation: from the customer's
// records to one turn, a sentence and at most four buttons. Each button
// names an Act; the dock runs it. Pure: no fetch and no React.

import type { Order } from './order';
import type { Invoice } from './invoices';
import { CONCEPTS } from './concepts';
import { type GarmentCut, type SizeAllocation, SIZES, conceptPriceAt } from './spec';
import { POLICY, plan } from './policy';
import { type Locale, countOf, formatCurrency, formatDate, kitName, t } from './i18n';
import { greeting } from './manager';
import type { News } from './updates';

export type Topic = 'general' | 'order' | 'billing';
export type Act =
  | { k: 'menu' } | { k: 'more'; from?: number } | { k: 'orders' } | { k: 'order'; id: string } | { k: 'show'; id: string }
  | { k: 'stock' } | { k: 'price' } | { k: 'invoices' }
  | { k: 'new' } | { k: 'people'; kit: string; people?: number } | { k: 'plan'; kit: string; people: number }
  | { k: 'requestQuote'; kit: string; people: number; sets: number }
  | { k: 'viewQuote'; quote: string } | { k: 'approve'; quote: string; total: number } | { k: 'approveNow'; quote: string }
  | { k: 'sizes'; order: string; run?: SizeAllocation } | { k: 'sendSizes'; order: string; run: SizeAllocation }
  | { k: 'contact'; topic: Topic; doc?: string } | { k: 'sendContact'; topic: Topic; doc?: string };
export type Button = { label: string; act: Act; primary?: boolean };
export type Turn = { say: string; buttons: Button[] };

const money = formatCurrency;
const day = (locale: Locale, iso: string) => formatDate(locale, new Date(`${iso}T12:00:00`));
const docOf = (o: Order) => o.salesOrder ?? o.quote ?? o.id;
const btn = (locale: Locale, key: string, act: Act, values?: Record<string, string | number>, primary = false): Button =>
  ({ label: t(locale, `journey.${key}`, values), act, ...(primary ? { primary } : {}) });
const discuss = (locale: Locale, doc: string) => btn(locale, 'btnDiscuss', { k: 'contact', topic: 'order', doc });

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

export const teamTurn = (locale: Locale): Turn => ({
  say: t(locale, 'journey.team'),
  buttons: CONCEPTS.slice(0, 4).map((c) => ({ label: kitName(locale, c.id), act: { k: 'people', kit: c.id } })),
});

/** People -> sets, said with the arithmetic, never silently raised. */
export function planTurn(locale: Locale, kit: string, people: number): Turn {
  const p = plan(people);
  const concept = CONCEPTS.find((c) => c.id === kit) ?? CONCEPTS[0];
  const values = {
    people: countOf(locale, 'person', p.people), sets: countOf(locale, 'set', p.sets),
    spare: countOf(locale, 'set', p.spareSets), min: countOf(locale, 'set', POLICY.minimumSets),
    price: money(locale, conceptPriceAt(concept, []) * p.sets),
  };
  return {
    say: t(locale, p.moqApplied ? 'journey.planMoq' : 'journey.plan', values),
    buttons: [
      btn(locale, 'btnRequest', { k: 'requestQuote', kit, people, sets: p.sets }, { sets: values.sets }, true),
      btn(locale, 'btnChangePeople', { k: 'people', kit, people }),
    ],
  };
}

/** Where an order is, who owns the next step, and the buttons for it. A
 *  delivered order names its invoice when one is linked to it. */
export function orderTurn(locale: Locale, o: Order, invoices: Invoice[] = []): Turn {
  const id = docOf(o);
  const quote = o.quote ?? id;
  const total = money(locale, o.total);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const values = { id, quote, total, sets: countOf(locale, 'set', o.sets), date: day(locale, iso(o.due)), pct: Math.round(o.perDelivered) };
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
    const invoice = invoices.find((i) => !!i.order && i.order === o.salesOrder);
    const tail = invoice
      ? say('deliveredInvoice', { invoice: invoice.name, total: money(locale, invoice.total), date: day(locale, invoice.due) })
      : say('deliveredNoInvoice');
    return {
      say: `${say('delivered', { date: day(locale, iso(o.dates.delivered ?? o.due)) })} ${tail}`,
      buttons: [btn(locale, 'btnInvoices', { k: 'invoices' }), discuss(locale, id)],
    };
  }
  const key = o.state === 'in_progress' && o.perDelivered > 0 ? 'in_progress_part' : o.state;
  return { say: say(key), buttons: [discuss(locale, id)] };
}

/** After the quote card: no second "ready for your review", no second View. */
export function quoteShownTurn(locale: Locale, o: Order): Turn {
  const now = orderTurn(locale, o);
  return o.state === 'quote_ready'
    ? { say: t(locale, 'journey.quoteShown'), buttons: now.buttons.filter((b) => b.act.k !== 'viewQuote') }
    : now;
}

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

/** A turn whose buttons send something (a confirmation, a request): news
 *  must not replace it, or the pending write and what was typed are lost. */
export const holdsWrite = (buttons: Button[]): boolean =>
  buttons.some((b) => ['approveNow', 'sendSizes', 'requestQuote', 'sendContact'].includes(b.act.k));

/** "Since we last spoke: …": one clause per change, and a button for what
 *  the customer can do about it (first one primary). */
export function newsTurn(locale: Locale, news: News[]): Turn {
  const line = (n: News): string => {
    if (!('order' in n)) {
      return n.k === 'paid' ? t(locale, 'journey.news.paid', { id: n.invoice.name })
        : t(locale, 'journey.news.invoiced', { id: n.invoice.name, total: money(locale, n.invoice.total), date: day(locale, n.invoice.due) });
    }
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
    btn(locale, 'btnAdjust', { k: 'sizes', order: docOf(o), run }),
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
  // The case names the invoice in question: the newest one still open.
  const doc = open[0]?.name;
  return { say: said.join(' '), buttons: [btn(locale, 'btnDiscuss', { k: 'contact', topic: 'billing', ...(doc ? { doc } : {}) })] };
}

const showOrder = (locale: Locale, o: Order) => btn(locale, 'btnShow', { k: 'show', id: docOf(o) }, undefined, true);

export const quoteSentTurn = (locale: Locale, o: Order): Turn =>
  ({ say: t(locale, 'journey.quoteSent', { id: o.quote ?? o.id }), buttons: [showOrder(locale, o)] });
export const approvedTurn = (locale: Locale, o: Order): Turn =>
  ({ say: t(locale, 'journey.approved', { id: docOf(o) }), buttons: [showOrder(locale, o)] });
export const sizesSentTurn = (locale: Locale, o: Order): Turn =>
  ({ say: t(locale, 'journey.sizesSent', { id: docOf(o), sets: countOf(locale, 'set', o.sets), date: formatDate(locale, o.due) }), buttons: [showOrder(locale, o)] });
export const caseTurn = (locale: Locale, name: string): Turn =>
  ({ say: t(locale, 'journey.caseSent', { id: name }), buttons: [] });
export const failTurn = (locale: Locale, retry: Act): Turn =>
  ({ say: t(locale, 'journey.failed'), buttons: [btn(locale, 'btnRetry', retry, undefined, true)] });
export const noOrderTurn = (locale: Locale): Turn =>
  ({ say: t(locale, 'journey.noOrder'), buttons: [btn(locale, 'btnOrders', { k: 'orders' })] });

/** The id a write was about, when the server refused it (409/404). */
export function refusedId(a: Act): string | undefined {
  if (a.k === 'approveNow' || a.k === 'viewQuote') return a.quote;
  if (a.k === 'sendSizes') return a.order;
  return undefined;
}

/** A refused write: nothing was changed, and here is where things stand. */
export function movedTurn(locale: Locale, o?: Order): Turn {
  const now = o ? orderTurn(locale, o) : noOrderTurn(locale);
  return { say: `${t(locale, 'journey.moved')} ${now.say}`, buttons: now.buttons };
}
