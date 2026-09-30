// What the assistant says, built from the rows one read returned, the way
// lib/manager.ts builds the account manager's notes: a sentence can only
// state what the rows hold, and every intent has a nothing-found sentence.
// Pure and free of server code, so the dock can build it in the browser.

import type { Workflow } from './order';
import type { GarmentType, LogoMethod } from './spec';
import { type Locale, counted, formatCurrency, formatDate, formatNumber, t } from './i18n';

export const INTENTS = ['orders', 'order', 'stock', 'price', 'options'] as const;
export type Intent = typeof INTENTS[number];

/** One of the customer's orders as the assistant reads it. */
export type OrderRow = {
  /** The Sales Order number, else the Quotation number. */
  id: string;
  state: Workflow;
  /** yyyy-mm-dd */
  due: string;
  total: number;
  perDelivered: number;
  lines: { garment?: GarmentType; logo?: LogoMethod; qty: number }[];
};

type Row = Record<string, unknown>;

/** "Stores - UA" is the warehouse name with its company suffix; the customer
 *  only needs "Stores". */
export const warehouseName = (value: unknown) => String(value ?? '').replace(/\s+-\s+[^-]+$/, '');

const day = (locale: Locale, iso: string) => formatDate(locale, new Date(`${iso}T12:00:00`));

function ordersAnswer(locale: Locale, rows: OrderRow[]): string {
  const counts = new Map<Workflow, number>();
  for (const row of rows) counts.set(row.state, (counts.get(row.state) ?? 0) + 1);
  const parts = [...counts].map(([state, count]) =>
    t(locale, 'erpAsk.a.part', { count, state: t(locale, `orders.state.${state}`) })).join(locale === 'ar' ? '، ' : ', ');
  return rows.length === 1
    ? t(locale, 'erpAsk.a.ordersOne', { parts })
    : t(locale, 'erpAsk.a.ordersMany', { count: rows.length, parts });
}

function orderAnswer(locale: Locale, o: OrderRow): string {
  const said = [t(locale, `erpAsk.a.state_${o.state}`, { id: o.id })];
  if (o.state === 'in_progress' && o.perDelivered > 0) {
    said.push(t(locale, 'erpAsk.a.partDelivered', { pct: Math.round(o.perDelivered) }));
  }
  if (o.state !== 'delivered' && o.state !== 'quote_closed') {
    said.push(t(locale, 'erpAsk.a.due', { date: day(locale, o.due) }));
  }
  said.push(t(locale, 'erpAsk.a.total', { price: formatCurrency(locale, o.total) }));
  const lines = o.lines.map((l) => t(locale, 'erpAsk.a.line', {
    qty: l.qty,
    what: l.garment ? t(locale, `garments.${l.garment}`)
      : t(locale, l.logo === 'print' ? 'branding.printedLogo' : 'branding.embroideredLogo'),
  })).join(locale === 'ar' ? '، ' : ', ');
  if (lines) said.push(t(locale, 'erpAsk.a.lines', { lines }));
  return said.join(' ');
}

function stockAnswer(locale: Locale, rows: Row[]): string {
  const total = rows.reduce((sum, r) => sum + Number(r.actual_qty ?? 0), 0);
  const item = String(rows[0].item_name ?? rows[0].item_code ?? '');
  if (total <= 0) return t(locale, 'erpAsk.a.stockOut', { item });
  const where = new Map<string, number>();
  for (const r of rows) {
    const qty = Number(r.actual_qty ?? 0);
    if (qty > 0) where.set(warehouseName(r.warehouse), (where.get(warehouseName(r.warehouse)) ?? 0) + qty);
  }
  return t(locale, 'erpAsk.a.stockYes', {
    count: counted(locale, 'piece', total), item,
    where: [...where].map(([warehouse, qty]) =>
      t(locale, 'erpAsk.a.stockWhere', { count: formatNumber(locale, qty), warehouse }))
      .join(locale === 'ar' ? '، ' : ', '),
  });
}

function priceAnswer(locale: Locale, row: Row): string {
  const line = (Array.isArray(row.items) ? row.items[0] : undefined) as Row | undefined;
  return t(locale, 'erpAsk.a.price', {
    price: formatCurrency(locale, Number(line?.rate ?? 0)),
    item: String(line?.item_name ?? ''),
    id: String(row.name),
    date: row.posting_date ? day(locale, String(row.posting_date)) : '',
  });
}

export function answer(locale: Locale, intent: Intent, rows: unknown[]): string {
  if (intent === 'options') return '';
  if (!rows.length) return t(locale, 'erpAsk.noRecord');
  if (intent === 'orders') return ordersAnswer(locale, rows as OrderRow[]);
  if (intent === 'order') return orderAnswer(locale, rows[0] as OrderRow);
  if (intent === 'stock') return stockAnswer(locale, rows as Row[]);
  return priceAnswer(locale, rows[0] as Row);
}
