// Server side of the sales workflow: reads the customer's chain of ERPNext
// documents as Orders, and writes the two things the customer may do, ask for
// a quote and approve one. Everything priced comes from kitLines, never from
// the request body.

import { acceptsSets } from './policy';
import { ErpError, call, get, insert, list } from './erp';
import { type Invoice, type InvoiceRow, toInvoice } from './invoices';
import { type QuoteView, toQuoteView } from './quote-view';
import { type Kit, type DeliveryRow, type QuoteRow, type SalesOrderRow, kitEstimate, kitLines, toOrders } from './orders';
import type { Order } from './order';
import {
  type Concept, type GarmentCut, type GarmentType, type SizePlan,
  GARMENT_CATALOG, SIZES, allocatedSizeCount,
} from './spec';
import { CONCEPTS } from './concepts';
import { cutsOf, parseRun } from './size-run';

export const CUSTOMER = 'BrainWise Technology';
const MAKE_SALES_ORDER = 'erpnext.selling.doctype.quotation.quotation.make_sales_order';
const QUOTE_VALID_DAYS = 30;
const DELIVERY_DAYS = 21;
const MAX_COUNT = 5000;

export class SalesError extends Error {
  constructor(message: string, readonly status: 400 | 404 | 409) {
    super(message);
    this.name = 'SalesError';
  }
}

const bad = (what: string) => new SalesError(`Invalid ${what}`, 400);

function isoDay(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ---- reads -----------------------------------------------------------------

type SalesOrderListRow = Omit<SalesOrderRow, 'quotation'> & { prevdoc_docname?: string | null };
type DeliveryListRow = Omit<DeliveryRow, 'against_sales_order'> & { against_sales_order?: string | null };

export const SIZE_RUN = 'UniformAI Size Run';

type StoredRun = { sales_order: string; allocation: unknown; creation?: string };

/** Orders with stored size-run data. A site seeded before the doctype existed
 *  answers 403 or 404: that is "no runs yet", not an outage. */
async function sizeRuns(): Promise<StoredRun[]> {
  try {
    return await list<StoredRun>(SIZE_RUN, { fields: ['sales_order', 'allocation', 'creation'], orderBy: 'creation desc', limit: 2000 });
  } catch (error) {
    if (error instanceof ErpError && (error.status === 403 || error.status === 404)) return [];
    throw error;
  }
}

export async function listOrders(): Promise<Order[]> {
  const [quotes, orderRows, noteRows, runs] = await Promise.all([
    list<QuoteRow>('Quotation', {
      fields: ['name', 'party_name', 'status', 'docstatus', 'transaction_date', 'valid_till',
        'grand_total', 'uniformai_kit', 'uniformai_ref'],
      filters: [['party_name', '=', CUSTOMER], ['docstatus', '<', 2]],
      orderBy: 'transaction_date desc, creation desc', limit: 500,
    }),
    list<SalesOrderListRow>('Sales Order', {
      fields: ['name', 'customer', 'status', 'docstatus', 'transaction_date', 'delivery_date',
        'per_delivered', 'grand_total', 'uniformai_kit', 'uniformai_ref', 'items.prevdoc_docname'],
      filters: [['customer', '=', CUSTOMER], ['docstatus', '<', 2]],
      orderBy: 'transaction_date desc, `tabSales Order`.creation desc', limit: 2000,
    }),
    list<DeliveryListRow>('Delivery Note', {
      fields: ['name', 'posting_date', 'docstatus', 'items.against_sales_order'],
      filters: [['customer', '=', CUSTOMER], ['docstatus', '=', 1]],
      orderBy: 'posting_date desc', limit: 2000,
    }),
    sizeRuns(),
  ]);

  // Frappe returns one row per item line: fold them back to one per document.
  const orders = new Map<string, SalesOrderRow>();
  for (const { prevdoc_docname, ...row } of orderRows) {
    const seen = orders.get(row.name);
    if (!seen) orders.set(row.name, { ...row, quotation: prevdoc_docname || null });
    else if (!seen.quotation && prevdoc_docname) seen.quotation = prevdoc_docname;
  }
  const notes: DeliveryRow[] = [];
  const noted = new Set<string>();
  for (const row of noteRows) {
    if (!row.against_sales_order) continue;
    const key = `${row.name}\u0000${row.against_sales_order}`;
    if (noted.has(key)) continue;
    noted.add(key);
    notes.push({ ...row, against_sales_order: row.against_sales_order });
  }
  // Rebuilt once more on purpose: stored runs are validated against the set
  // count read from the customer's order, so malformed or manual records do
  // not advance its state.
  const base = toOrders(quotes, [...orders.values()], notes);
  const bySalesOrder = new Map(base.flatMap((o) => o.salesOrder ? [[o.salesOrder, o] as const] : []));
  const sized = new Map(runs.flatMap((run) => {
    const order = bySalesOrder.get(run.sales_order);
    if (!order?.concept) return [];
    let stored: unknown;
    try { stored = typeof run.allocation === 'string' ? JSON.parse(run.allocation) : run.allocation; } catch { return []; }
    return parseRun(stored, cutsOf(order.concept), order.sets)
      ? [[run.sales_order, String(run.creation ?? order.dates.confirmed?.toISOString() ?? '').slice(0, 10)] as const] : [];
  })); // ERPNext lists newest first, so the first run's day is the one kept
  return toOrders(quotes, [...orders.values()], notes, sized);
}

async function chainOf(quote: string): Promise<Order> {
  const order = (await listOrders()).find((o) => o.quote === quote);
  if (!order) throw new SalesError('Quote not found', 404);
  return order;
}

/** An issued quotation of the customer's. Missing, another customer's and
 *  not yet issued all read as not found. */
export async function quoteDetail(name: string): Promise<QuoteView> {
  let doc: Record<string, unknown>;
  try {
    doc = await get<Record<string, unknown>>('Quotation', name);
  } catch (error) {
    if ((error as { status?: number }).status === 404) throw new SalesError('Quote not found', 404);
    throw error;
  }
  if (doc.party_name !== CUSTOMER || doc.docstatus !== 1) throw new SalesError('Quote not found', 404);
  return toQuoteView(doc);
}

/** The customer's submitted invoices, newest first, with a derived status. */
export async function listInvoices(): Promise<Invoice[]> {
  const rows = await list<InvoiceRow>('Sales Invoice', {
    fields: ['name', 'posting_date', 'due_date', 'grand_total', 'outstanding_amount'],
    filters: [['customer', '=', CUSTOMER], ['docstatus', '=', 1], ['is_return', '=', 0]],
    orderBy: 'posting_date desc', limit: 50,
  });
  const today = isoDay();
  return rows.map((r) => toInvoice(r, today));
}

// ---- request a quote ---------------------------------------------------------

const TYPES = Object.keys(GARMENT_CATALOG) as GarmentType[];
const FITS = ['slim', 'regular', 'relaxed'];
const CUTS: GarmentCut[] = ['men', 'women', 'unisex'];
const POSITIONS = ['left_chest', 'right_chest', 'sleeve', 'back', 'none'];
const METHODS = ['embroidery', 'print'];

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const count = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0 && (v as number) <= MAX_COUNT;
const text = (v: unknown, max = 120): v is string => typeof v === 'string' && v.length <= max;

/** The kit the customer may send: rebuilt field by field, so nothing else
 *  in the body reaches ERPNext. */
export function parseKit(input: unknown): Kit {
  if (!isObject(input)) throw bad('request');
  const { concept: c, staff, sets, grades, sizePlan: plan } = input;
  if (!count(staff)) throw bad('staff');
  if (!count(sets) || !acceptsSets(staff, sets)) throw bad('sets');
  if (!isObject(c) || !text(c.name) || !c.name.trim() || !text(c.id, 80)) throw bad('concept');
  if (!Array.isArray(c.garments) || c.garments.length < 1 || c.garments.length > TYPES.length) throw bad('garments');
  if (!isObject(c.logo) || !POSITIONS.includes(c.logo.position as string) || !METHODS.includes(c.logo.method as string)) {
    throw bad('logo');
  }
  const cuts = c.cuts === undefined ? [] : c.cuts;
  if (!Array.isArray(cuts) || cuts.some((x) => !CUTS.includes(x as GarmentCut))) throw bad('cuts');

  const garments = c.garments.map((g: unknown) => {
    if (!isObject(g) || !TYPES.includes(g.type as GarmentType) || !FITS.includes(g.fit as string)) throw bad('garment');
    if (!isObject(g.parts) || Object.values(g.parts).some((h) => !text(h, 20))) throw bad('garment');
    if (!text(g.fabric)) throw bad('garment');
    // The browser's price is ignored: the catalogue sets what a garment costs.
    const type = g.type as GarmentType;
    const unitPrice = CONCEPTS.find((k) => k.id === c.id)?.garments.find((k) => k.type === type)?.unitPrice
      ?? GARMENT_CATALOG[type].unitPrice;
    return {
      type, parts: g.parts as Record<string, string>, fabric: g.fabric,
      fit: g.fit as 'slim' | 'regular' | 'relaxed', unitPrice,
    };
  });
  if (new Set(garments.map((g) => g.type)).size !== garments.length) throw bad('garments');

  if (!Array.isArray(grades) || grades.length > garments.length ||
      grades.some((x) => !Number.isInteger(x) || x < 0 || x > 2)) throw bad('grades');
  if (!isObject(plan) || (plan.mode !== 'collect_later' && plan.mode !== 'allocate_now') || !isObject(plan.allocation)) {
    throw bad('size plan');
  }
  // Counts per cut and size are whole numbers of sets, none above the order.
  for (const [cut, sizes] of Object.entries(plan.allocation)) {
    if (!CUTS.includes(cut as GarmentCut) || !isObject(sizes)) throw bad('size plan');
    for (const [size, n] of Object.entries(sizes)) {
      if (!(SIZES as readonly string[]).includes(size) || !Number.isInteger(n) || (n as number) < 0 || (n as number) > sets) {
        throw bad('size plan');
      }
    }
  }

  const logo = c.logo as { position: Concept['logo']['position']; method: Concept['logo']['method']; colour?: unknown };
  const concept: Concept = {
    id: c.id, name: c.name, garments, cuts: cuts as GarmentCut[],
    logo: { position: logo.position, method: logo.method, ...(text(logo.colour, 20) ? { colour: logo.colour } : {}) },
  };
  const kit: Kit = { concept, staff, sets, grades: grades as number[], sizePlan: plan as SizePlan };
  try {
    kitLines(kit); kitEstimate(kit);
    allocatedSizeCount(kit.sizePlan.allocation, cutsOf(concept));
  } catch { throw bad('kit'); }
  return kit;
}

export async function requestQuote(input: unknown): Promise<Order> {
  const kit = parseKit(input);
  const created = await insert<{ name: string }>('Quotation', {
    quotation_to: 'Customer',
    party_name: CUSTOMER,
    order_type: 'Sales',
    transaction_date: isoDay(),
    valid_till: isoDay(QUOTE_VALID_DAYS),
    items: kitLines(kit),
    uniformai_kit: JSON.stringify(kit),
    uniformai_ref: `app-${Date.now()}`,
  }, 'write');
  return chainOf(created.name);
}

// ---- approve ---------------------------------------------------------------

type QuoteDoc = { name: string; party_name: string; docstatus: number; status: string; valid_till?: string | null };

// Quotations being approved right now in this server process.
const approving = new Set<string>();

/** Drop the client-side markers Frappe puts on a mapped, unsaved document. */
function clean<T>(value: T): T {
  if (Array.isArray(value)) return value.map(clean) as T;
  if (isObject(value)) {
    return Object.fromEntries(
      Object.entries(value).filter(([k]) => !k.startsWith('__')).map(([k, v]) => [k, clean(v)])) as T;
  }
  return value;
}

/** One approval per quotation at a time (one app server instance): a second
 *  call while the first runs is refused before it touches ERPNext. */
export async function approveQuote(name: string): Promise<Order> {
  if (approving.has(name)) throw new SalesError('This quote is already being approved', 409);
  approving.add(name);
  try { return await approve(name); } finally { approving.delete(name); }
}

async function approve(name: string): Promise<Order> {
  let quote: QuoteDoc;
  try {
    quote = await get<QuoteDoc>('Quotation', name);
  } catch (error) {
    if ((error as { status?: number }).status === 404) throw new SalesError('Quote not found', 404);
    throw error;
  }
  if (quote.party_name !== CUSTOMER) throw new SalesError('Quote not found', 404);
  if (quote.docstatus !== 1) throw new SalesError('This quote has not been issued yet', 409);
  if (quote.valid_till && quote.valid_till < isoDay()) throw new SalesError('This quote has expired', 409);
  if (quote.status !== 'Open' && quote.status !== 'Replied') throw new SalesError('This quote can no longer be approved', 409);

  const existing = await list<{ name: string }>('Sales Order', {
    fields: ['name'],
    filters: [['Sales Order Item', 'prevdoc_docname', '=', name], ['docstatus', '<', 2]],
    limit: 1,
  });
  if (existing.length) throw new SalesError('This quote has already been approved', 409);

  const mapped = clean(await call<Record<string, unknown> & { items?: Record<string, unknown>[] }>(
    MAKE_SALES_ORDER, { source_name: name }, 'write'));
  const delivery = isoDay(DELIVERY_DAYS);
  const doc = {
    ...mapped, docstatus: 0, delivery_date: delivery,
    items: (mapped.items ?? []).map((item) => ({ ...item, delivery_date: delivery })),
  };
  await insert('Sales Order', doc, 'write');
  return chainOf(name);
}

// ---- size run and contact --------------------------------------------------

const findOrder = async (name: string) => (await listOrders()).find((o) => o.salesOrder === name);
const recordingSizes = new Set<string>();

/** Record the customer's size run for a confirmed order. Insert-only: the
 *  Sales Order itself is never written. */
export async function sendSizes(name: string, input: unknown): Promise<Order> {
  if (recordingSizes.has(name)) throw new SalesError('Sizes are already being recorded', 409);
  recordingSizes.add(name);
  try {
    const order = await findOrder(name);
    if (!order) throw new SalesError('Order not found', 404);
    if (order.state !== 'collecting_sizes') throw new SalesError('This order is not waiting for sizes', 409);
    const run = parseRun(input, cutsOf(order.concept), order.sets);
    if (!run) throw bad('size run');
    await insert(SIZE_RUN, { sales_order: name, allocation: JSON.stringify(run) }, 'write');
    return (await findOrder(name)) ?? order;
  } finally {
    recordingSizes.delete(name);
  }
}

export const TOPICS = ['general', 'order', 'billing'] as const;
export type Topic = typeof TOPICS[number];
const ABOUT: Record<Topic, string> = { general: 'a general question', order: 'an order', billing: 'billing' };
const CUSTOMER_EMAIL = 'ahmed.osama@brainwise.example'; // seeded primary contact

/** Contact our team: one Issue for the team, about one of the customer's own
 *  documents or a topic. The transcript is never sent. */
export async function openCase(input: unknown): Promise<{ name: string }> {
  if (!isObject(input) || !TOPICS.includes(input.topic as Topic)) throw bad('request');
  const topic = input.topic as Topic;
  const doc = input.document;
  if (doc !== undefined) {
    const mine = typeof doc === 'string' && (await listOrders()).some((o) => o.quote === doc || o.salesOrder === doc);
    if (!mine) throw new SalesError('Order not found', 404);
  }
  const about = typeof doc === 'string' ? doc : ABOUT[topic];
  const created = await insert<{ name: string }>('Issue', {
    subject: `[UniformAI assistant] Please contact ${CUSTOMER} about ${about}`,
    customer: CUSTOMER,
    raised_by: CUSTOMER_EMAIL,
    via_customer_portal: 0,
    description: `Asked from the UniformAI assistant. Topic: ${topic}.${typeof doc === 'string' ? ` Document: ${doc}.` : ''}`,
  }, 'write');
  return { name: created.name };
}
