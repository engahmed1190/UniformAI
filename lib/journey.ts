// lib/journey.ts
// The account manager's side of the conversation: from the customer's
// records to one turn, a sentence and at most four buttons. Each button
// names an Act; the dock runs it. Pure: no fetch and no React.

import type { Order } from './order';
import type { Invoice } from './invoices';
import { CONCEPTS } from './concepts';
import { type SizeAllocation, conceptPriceAt } from './spec';
import { POLICY, plan } from './policy';
import { type Locale, countOf, formatCurrency, formatDate, formatDay, kitName, t } from './i18n';
import { greeting } from './manager';
import type { News } from './updates';
import { type Card, docOf, invoiceOf, invoicesCard, orderCard } from './cards';

export type Topic = 'general' | 'order' | 'billing';
export type Act =
  | { k: 'menu' } | { k: 'more'; from?: number } | { k: 'orders' } | { k: 'order'; id: string } | { k: 'show'; id: string }
  | { k: 'stock' } | { k: 'price' } | { k: 'invoices' }
  | { k: 'new' } | { k: 'people'; kit: string }
  | { k: 'requestQuote'; kit: string; people: number; sets: number }
  | { k: 'viewQuote'; quote: string } | { k: 'approve'; quote: string; total: number } | { k: 'approveNow'; quote: string }
  | { k: 'sizes'; order: string } | { k: 'sendSizes'; order: string; run: SizeAllocation }
  | { k: 'sendContact'; topic: Topic; doc?: string };
export type Button = { label: string; act: Act; primary?: boolean };
/** `card`, when set, shows under the sentence and holds the turn's one primary. */
export type Turn = { say: string; buttons: Button[]; card?: Card };

const money = formatCurrency;
const btn = (locale: Locale, key: string, act: Act, values?: Record<string, string | number>, primary = false): Button =>
  ({ label: t(locale, `journey.${key}`, values), act, ...(primary ? { primary } : {}) });
const discuss = (locale: Locale, doc: string) => btn(locale, 'btnDiscuss', { k: 'sendContact', topic: 'order', doc });

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
    btn(locale, 'btnContact', { k: 'sendContact', topic: 'general' }),
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
    buttons: [btn(locale, 'btnRequest', { k: 'requestQuote', kit, people, sets: p.sets }, { sets: values.sets }, true)],
  };
}

/** Where an order is and who owns the next step, with the order card, which
 *  holds the one primary (Approve, Enter the sizes, Invoices). A delivered
 *  order names its invoice when one is linked to it. */
export function orderTurn(locale: Locale, o: Order, invoices: Invoice[] = []): Turn {
  const id = docOf(o);
  const quote = o.quote ?? id;
  const total = money(locale, o.total);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const values = { id, quote, total, sets: countOf(locale, 'set', o.sets), date: formatDay(locale, iso(o.due)), pct: Math.round(o.perDelivered) };
  const say = (key: string, extra = {}) => t(locale, `journey.stage.${key}`, { ...values, ...extra });
  const card: Card = { k: 'order', view: orderCard(locale, o, invoices) };
  if (o.state === 'quote_ready') {
    return { say: say('quote_ready'), buttons: [btn(locale, 'btnView', { k: 'viewQuote', quote }), discuss(locale, quote)], card };
  }
  if (o.state === 'delivered') {
    const invoice = invoiceOf(o, invoices);
    const tail = invoice
      ? say('deliveredInvoice', { invoice: invoice.name, total: money(locale, invoice.total), date: formatDay(locale, invoice.due) })
      : say('deliveredNoInvoice');
    return { say: `${say('delivered', { date: formatDay(locale, iso(o.dates.delivered ?? o.due)) })} ${tail}`, buttons: [discuss(locale, id)], card };
  }
  const key = o.state === 'in_progress' && o.perDelivered > 0 ? 'in_progress_part' : o.state;
  return { say: say(key), buttons: [discuss(locale, id)], card };
}

/** After the quote card: no second "ready for your review", no second View,
 *  and no order card (the quote is just above), so Approve is a turn button. */
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

/** A turn whose buttons send something the customer confirmed or typed (a
 *  confirmation, a request, a size run): news must not replace it, or the
 *  pending write is lost. Contact is not one: it sends on its first tap, from
 *  the greeting, with nothing typed. */
export const holdsWrite = (buttons: Button[]): boolean =>
  buttons.some((b) => ['approveNow', 'sendSizes', 'requestQuote'].includes(b.act.k));

/** "Since we last spoke: …": one clause per change, and a button for what
 *  the customer can do about it (first one primary). */
export function newsTurn(locale: Locale, news: News[]): Turn {
  const line = (n: News): string => {
    if (!('order' in n)) {
      return n.k === 'paid' ? t(locale, 'journey.news.paid', { id: n.invoice.name })
        : t(locale, 'journey.news.invoiced', { id: n.invoice.name, total: money(locale, n.invoice.total), date: formatDay(locale, n.invoice.due) });
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

const showOrder = (locale: Locale, o: Order) => btn(locale, 'btnShow', { k: 'show', id: docOf(o) }, undefined, true);

export const quoteSentTurn = (locale: Locale, o: Order): Turn =>
  ({ say: t(locale, 'journey.quoteSent', { id: o.quote ?? o.id }), buttons: [showOrder(locale, o)] });
export const approvedTurn = (locale: Locale, o: Order): Turn =>
  ({ say: t(locale, 'journey.approved', { id: docOf(o) }), buttons: [showOrder(locale, o)] });
export const sizesSentTurn = (locale: Locale, o: Order): Turn =>
  ({ say: t(locale, 'journey.sizesSent', { id: docOf(o), sets: countOf(locale, 'set', o.sets), date: formatDate(locale, o.due) }), buttons: [showOrder(locale, o)] });
/** The receipt: a case about a document names it. */
export const caseTurn = (locale: Locale, name: string, doc?: string): Turn => ({
  say: doc ? t(locale, 'journey.caseAbout', { id: name, doc }) : t(locale, 'journey.caseSent', { id: name }),
  buttons: [],
});
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

/** A refused write: nothing was changed, and here is where things stand,
 *  with the order card (and a delivered order's invoice). */
export function movedTurn(locale: Locale, o?: Order, invoices: Invoice[] = []): Turn {
  const now = o ? orderTurn(locale, o, invoices) : noOrderTurn(locale);
  return { ...now, say: `${t(locale, 'journey.moved')} ${now.say}` };
}
