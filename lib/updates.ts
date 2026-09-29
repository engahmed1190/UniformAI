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
