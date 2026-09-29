// lib/cards.ts
// What the chat's order and invoice cards show, worked out from the records
// and already in words. Pure, so the dock only lays it out.

import type { Order, Workflow } from './order';
import type { Invoice, InvoiceStatus } from './invoices';
import type { Button } from './journey';
import { type Locale, countOf, formatCurrency, formatDate, formatDay, kitName, t } from './i18n';

export type CardStepKey = 'quote' | 'approved' | 'confirmed' | 'sizes' | 'production' | 'delivered' | 'invoiced';
export type Actor = 'you' | 'team';
/** `label` is past wording once done ("Approved by you") and the awaited
 *  wording otherwise ("Your approval"): the current step is never named as done. */
export type CardStep = { key: CardStepKey; label: string; state: 'done' | 'now' | 'todo' };
export type OrderCardView = {
  title: string; id: string; meta: string; steps: CardStep[];
  /** The current step: its awaited name, who owns it, and "Step 2 of 7 · Your approval". */
  nowLabel?: string; actor?: Actor; progress?: string;
  next: string; date?: string; action?: Button;
};
export type InvoiceRowView = { id: string; amount: string; status: InvoiceStatus; label: string; note: string };
export type InvoicesCardView = { outstanding: string; open: string; rows: InvoiceRowView[]; paid?: string; action?: Button };
export type Card = { k: 'order'; view: OrderCardView } | { k: 'invoices'; view: InvoicesCardView };

const KEYS: CardStepKey[] = ['quote', 'approved', 'confirmed', 'sizes', 'production', 'delivered', 'invoiced'];
/** Who owns each step while it is the current one. */
const ACTOR: Record<CardStepKey, Actor> = {
  quote: 'team', approved: 'you', confirmed: 'team', sizes: 'you', production: 'team', delivered: 'team', invoiced: 'team',
};
/** Steps whose team answer comes within a working day; production and
 *  delivery take until the delivery date instead. */
const QUICK: CardStepKey[] = ['quote', 'confirmed', 'invoiced'];
/** Steps each state has finished. From the workflow rather than timeline():
 *  a hand-made order with no quote is still past the quote. */
const DONE: Record<Workflow, number> = {
  quote_requested: 0, quote_ready: 1, quote_closed: 1, awaiting: 2, collecting_sizes: 3, in_progress: 4, delivered: 6,
};
const DATED: Workflow[] = ['awaiting', 'collecting_sizes', 'in_progress'];

/** The number the customer knows an order by: the sales order once there is one. */
export const docOf = (o: Order): string => o.salesOrder ?? o.quote ?? o.id;

/** The invoice that bills this order, once issued. */
export const invoiceOf = (o: Order, invoices: Invoice[]): Invoice | undefined =>
  invoices.find((i) => !!i.order && i.order === o.salesOrder);

export function orderCard(locale: Locale, o: Order, invoices: Invoice[]): OrderCardView {
  const invoice = o.state === 'delivered' ? invoiceOf(o, invoices) : undefined;
  const done = DONE[o.state] + (invoice ? 1 : 0);
  const now = o.state === 'quote_closed' || done >= KEYS.length ? -1 : done;
  const steps = KEYS.map((key, i): CardStep => {
    const state = i < done ? 'done' : i === now ? 'now' : 'todo';
    return { key, label: t(locale, `journey.card.${state === 'done' ? 'past' : 'await'}.${key}`), state };
  });
  const current = now >= 0 ? steps[now] : undefined;
  const actor = current ? ACTOR[current.key] : undefined;
  const next = t(locale, `journey.card.${o.state === 'quote_closed' ? 'closed' : !current ? 'done'
    : actor === 'you' ? 'you' : QUICK.includes(current.key) ? 'team' : 'making'}`);
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
    id: docOf(o),
    meta: `${countOf(locale, 'set', o.sets)} · ${total}`,
    steps,
    ...(current ? {
      nowLabel: current.label, actor,
      progress: t(locale, 'journey.card.step', { n: now + 1, total: KEYS.length, name: current.label }),
    } : {}),
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
      note: t(locale, i.status === 'overdue' ? 'journey.invCard.lateSince' : 'journey.invDue', { date: formatDay(locale, i.due) }),
    })),
    ...(paid ? { paid: t(locale, 'journey.invCard.paid', { count: paid }) } : {}),
    ...(doc ? { action: {
      label: t(locale, 'journey.btnDiscussInvoice', { id: doc }),
      act: { k: 'sendContact', topic: 'billing', doc }, primary: true,
    } } : {}),
  };
}
