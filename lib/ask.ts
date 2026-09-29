import { assertErpConfigured, list } from './erp';
import { MAX_CARDS, type Source, type Step } from './evidence';
import { INTENTS, type Intent, type OrderRow, warehouseName as warehouse } from './answers';
import type { Order } from './order';
import { listOrders } from './sales';
import { SIZED_PREFIX } from './sized';

export type { Source } from './evidence';

export const DEMO_CUSTOMER = 'BrainWise Technology';

type Row = Record<string, unknown>;
type ToolResult = { rows: Row[]; sources: Source[] };

const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const num = (value: unknown) => value === undefined || value === null ? undefined : Number(value);

function source(doctype: string, name: unknown, fields: Omit<Source, 'doctype' | 'name' | 'readAt'>): Source {
  return { doctype, name: String(name), ...fields, readAt: new Date().toISOString() };
}

/** Frappe's list endpoint joins one child row per result and returns child
 * fields by their bare field name. Fold those SQL-shaped rows back into one
 * record. */
function groupJoined(joined: Row[], childFields: string[], childKey: string): Row[] {
  const grouped = new Map<string, Row>();
  for (const row of joined) {
    const name = String(row.name);
    const current = grouped.get(name) ?? { ...row, [childKey]: [] };
    const child = Object.fromEntries(childFields.map((field) => [field, row[field]]));
    if (Object.values(child).some((value) => value !== undefined && value !== null)) {
      (current[childKey] as Row[]).push(child);
    }
    for (const field of childFields) delete current[field];
    grouped.set(name, current);
  }
  return [...grouped.values()];
}

const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** One order as the assistant states it. The Sales Order number when the
 *  order has one, else the Quotation's: the number the Orders screen shows. */
function orderRow(o: Order): OrderRow {
  return {
    id: o.salesOrder ?? o.quote ?? o.id, state: o.state, due: isoDay(o.state === 'delivered' ? o.dates.delivered ?? o.due : o.due), total: o.total,
    perDelivered: o.perDelivered,
    lines: (o.lines ?? []).map((l) => ({ garment: l.garment, logo: l.logo, qty: l.qty })),
  };
}

/** The customer's orders, read the way the Orders screen reads them, so the
 *  two can never disagree. `id` narrows to one Quotation or Sales Order. */
export async function orders(id?: string): Promise<ToolResult> {
  const all = await listOrders();
  const found = id ? all.filter((o) => [o.id, o.salesOrder, o.quote].includes(id)).slice(0, 1) : all;
  const rows = found.map(orderRow);
  // Every order is a row, so the answer counts the true number; only the
  // cards are capped (the "Details of" buttons cap at the same number).
  return {
    rows: rows as unknown as Row[],
    sources: rows.slice(0, MAX_CARDS).map((r, i) => source(found[i].salesOrder ? 'Sales Order' : 'Quotation', r.id, {
      title: r.id, detail: r.state, date: r.due,
    })),
  };
}

type ItemRow = Row & { name: string };

/** The garment word the item codes use: "Cargo Trouser" -> CARGO. */
const garmentWord = (item: unknown) => text(item).split(/\s+/)[0].toUpperCase();

/** The ready-stock template the customer named, and its variants. With
 *  `sized`, also the variants of the same garment made to order by size
 *  (UA-SIZED-<word>), which a sized order's invoice bills. */
async function variantsFor(itemInput: unknown, sized = false): Promise<ItemRow[]> {
  const wanted = text(itemInput).toLowerCase();
  if (!wanted) return [];
  const templates = await list<ItemRow>('Item', {
    fields: ['name', 'item_name'],
    filters: [['has_variants', '=', 1]],
    limit: 100,
  });
  const template = templates.find((row) => !row.name.startsWith(SIZED_PREFIX) &&
    [row.name, row.item_name].some((v) => String(v ?? '').toLowerCase().includes(wanted)));
  if (!template) return [];
  const names = sized ? [template.name, `${SIZED_PREFIX}${garmentWord(itemInput)}`] : [template.name];
  const joined = await list<ItemRow>('Item', {
    fields: ['name', 'item_name', 'variant_of', 'attributes.attribute', 'attributes.attribute_value'],
    filters: [['variant_of', 'in', names]],
    limit: 2000,
  });
  return groupJoined(joined, ['attribute', 'attribute_value'], 'attributes') as ItemRow[];
}

function attributes(row: Row): Row[] {
  const value = row.attributes;
  if (Array.isArray(value)) return value.filter((v): v is Row => !!v && typeof v === 'object');
  return row.attribute && row.attribute_value
    ? [{ attribute: row.attribute, attribute_value: row.attribute_value }]
    : [];
}

export function variantMatches(row: Row, colour?: string, size?: string): boolean {
  const attrs = attributes(row);
  const has = (attribute: string, wanted?: string) => !wanted || attrs.some((a) =>
    // Seeded as "Uniform Colour" / "Uniform Size"; a plain "Colour" matches too.
    String(a.attribute ?? '').toLowerCase().endsWith(attribute) &&
    String(a.attribute_value ?? '').toLowerCase() === wanted.toLowerCase());
  return has('colour', colour) && has('size', size);
}

export async function checkStock(input: Row): Promise<ToolResult> {
  const colour = text(input.colour) || undefined;
  const size = text(input.size).toUpperCase() || undefined;
  const variants = (await variantsFor(input.item)).filter((row) => variantMatches(row, colour, size));
  const stock = await Promise.all(variants.map(async (variant) => ({
    variant,
    bins: await list<Row>('Bin', {
      fields: ['name', 'item_code', 'warehouse', 'actual_qty', 'reserved_qty', 'projected_qty'],
      filters: [['item_code', '=', variant.name]],
      limit: 100,
    }),
  })));
  // Only what the answer states: no item code or bin id leaves the server.
  const rows: Row[] = stock.flatMap(({ variant, bins }) => bins.map((bin) => ({
    item_name: variant.item_name, warehouse: warehouse(bin.warehouse), actual_qty: bin.actual_qty,
  })));
  // One card per warehouse balance, named the way the customer would say it
  // and keyed by item and warehouse: stable across reads of the same bin.
  const sources = rows.map((row) => source('Bin', `${row.item_name} · ${row.warehouse}`, {
    title: String(row.item_name), detail: String(row.warehouse), qty: num(row.actual_qty),
  }));
  return { rows, sources };
}

export async function lastPrice(input: Row): Promise<ToolResult> {
  const variants = await variantsFor(input.item, true);
  if (!variants.length) return { rows: [], sources: [] };
  // What the customer paid for a garment was billed as a ready-stock variant,
  // as the garment made to order (UA-MTO-<word>), or, once sizes were
  // applied, as its sized variants (UA-SIZED-<word>-…), all at one rate.
  const codes = [...variants.map((row) => row.name), `UA-MTO-${garmentWord(input.item)}`];
  const garment = text(input.item);
  const joined = await list<Row>('Sales Invoice', {
    fields: ['name', 'posting_date', 'currency', 'items.item_code', 'items.rate', 'items.qty'],
    filters: [
      ['customer', '=', DEMO_CUSTOMER],
      ['docstatus', '=', 1],
      ['Sales Invoice Item', 'item_code', 'in', codes],
    ],
    orderBy: 'posting_date desc',
    limit: 100,
  });
  // Newest invoice only. The join returns every line of it, so keep the
  // garment's own, named as the customer chose it rather than by item code.
  const rows = groupJoined(joined, ['item_code', 'rate', 'qty'], 'items').slice(0, 1).map((row) => ({
    name: row.name, posting_date: row.posting_date, currency: row.currency,
    items: (row.items as Row[]).filter((line) => codes.includes(String(line.item_code)))
      .map((line) => ({ item_name: garment, rate: line.rate, qty: line.qty })),
  }));
  return {
    rows,
    sources: rows.map((row) => source('Sales Invoice', row.name, {
      title: String(row.name),
      detail: garment,
      date: text(row.posting_date) || undefined,
      rate: num(row.items[0]?.rate),
      currency: text(row.currency) || undefined,
    })),
  };
}

const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
const bySize = (a: string, b: string) => {
  const [x, y] = [SIZE_ORDER.indexOf(a), SIZE_ORDER.indexOf(b)];
  return x < 0 && y < 0 ? a.localeCompare(b) : (x < 0 ? 99 : x) - (y < 0 ? 99 : y);
};

export type Option = { item: string; colours: string[]; sizes: string[] };

/** What the buttons offer: the ready-stock garments with the colours and
 *  sizes their variants really have, so no button leads to a missing item.
 *  Made-to-order templates and the sized templates that carry a customer's
 *  size run are not ready stock and are left out. */
export async function options(): Promise<Option[]> {
  const templates = await list<ItemRow>('Item', {
    fields: ['name', 'item_name'], filters: [['has_variants', '=', 1]], limit: 100,
  });
  const ready = templates.filter((row) => !row.name.startsWith('UA-MTO-') && !row.name.startsWith(SIZED_PREFIX));
  if (!ready.length) return [];
  const joined = await list<Row>('Item', {
    fields: ['name', 'variant_of', 'attributes.attribute', 'attributes.attribute_value'],
    filters: [['variant_of', 'in', ready.map((row) => row.name)]],
    limit: 5000,
  });
  const variants = groupJoined(joined, ['attribute', 'attribute_value'], 'attributes');
  return ready.flatMap((template) => {
    const of = variants.filter((v) => v.variant_of === template.name);
    const values = (attribute: string) => [...new Set(of.flatMap((v) => attributes(v)
      .filter((a) => String(a.attribute ?? '').toLowerCase().endsWith(attribute))
      .map((a) => String(a.attribute_value))))];
    const [colours, sizes] = [values('colour').sort(), values('size').sort(bySize)];
    return of.length ? [{ item: String(template.item_name ?? template.name), colours, sizes }] : [];
  }).sort((a, b) => a.item.localeCompare(b.item));
}

/** Bad intent or params: the route's 400. */
export class AskInputError extends Error {}

const param = (params: Row, key: string) => {
  const value = params[key];
  if (typeof value !== 'string' || !value.trim() || value.length > 80) throw new AskInputError(`Invalid ${key}`);
  return value.trim();
};

/** One button's read. Never takes a customer or a free-text question. */
export async function run(intent: unknown, params: unknown = {}):
  Promise<{ rows: unknown[]; sources: Source[]; step: Step }> {
  if (typeof intent !== 'string' || !(INTENTS as readonly string[]).includes(intent)) {
    throw new AskInputError('Unknown intent');
  }
  if (!params || typeof params !== 'object' || Array.isArray(params)) throw new AskInputError('Invalid params');
  const input = params as Row;
  // Validate before the ERP is touched.
  const args = intent === 'order' ? { id: param(input, 'id') }
    : intent === 'stock' ? { item: param(input, 'item'), colour: param(input, 'colour'), size: param(input, 'size') }
    : intent === 'price' ? { item: param(input, 'item') } : {};
  assertErpConfigured();
  const started = Date.now();
  let result: { rows: unknown[]; sources: Source[] };
  const kind = intent as Intent;
  if (kind === 'orders') result = await orders();
  else if (kind === 'order') result = await orders((args as { id: string }).id);
  else if (kind === 'stock') result = await checkStock(args);
  else if (kind === 'price') result = await lastPrice(args);
  else {
    const rows = await options();
    result = { rows, sources: [] };
  }
  return {
    ...result,
    step: {
      id: crypto.randomUUID(), tool: kind, input: args, state: 'done',
      rows: result.rows.length, ms: Date.now() - started,
    },
  };
}
