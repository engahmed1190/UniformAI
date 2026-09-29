// The demo account in ERPNext: one customer's months of history plus one
// order in every state of the sales workflow, built through ERPNext's own
// Quotation -> Sales Order -> Delivery Note -> Sales Invoice mapping so each
// document links to the one before it.
//
//   npm run seed:erp              create whatever is missing (safe to rerun)
//   npm run seed:erp -- --reset   put the demo orders, stock, size runs,
//                                 assistant-created cases and everything the
//                                 app made back to the starting point, then seed
//
// Seeded documents carry uniformai_ref "demo-...". Reset touches the CURRENT
// refs below, every app-made document ("app-..."), size runs and the
// assistant's own cases. It never touches the fixed-date history or anything
// made by hand in ERPNext, staff-created cases included.

import { loadEnvConfig } from '@next/env';
import { CONCEPTS } from '../lib/concepts';
import { type GarmentType, type SizePlan, LABELS, allocatedSizeCount } from '../lib/spec';
import { type Kit, LOGO_ITEM, MTO_ITEM, kitEstimate, kitLines } from '../lib/orders';

loadEnvConfig(process.cwd());

const ERP_URL = process.env.ERP_URL?.replace(/\/$/, '');
const ERP_SEED_KEY = process.env.ERP_SEED_KEY;
if (!ERP_URL || !ERP_SEED_KEY) throw new Error('ERP_URL and ERP_SEED_KEY are required');
const RESET = process.argv.includes('--reset');

type Doc = Record<string, unknown> & { name: string };
type Filter = [string, string, unknown] | [string, string, string, unknown];

// ---------- HTTP ----------

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${ERP_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `token ${ERP_SEED_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...init.headers,
    },
  });
  if (!response.ok) {
    const detail = await response.text();
    const reason = /"exception":"([^"]+)"/.exec(detail)?.[1] ?? detail.slice(0, 400);
    throw new Error(`${init.method ?? 'GET'} ${path}: ${response.status} ${reason}`);
  }
  return response.json() as Promise<T>;
}

const q = (params: Record<string, unknown>) => new URLSearchParams(
  Object.fromEntries(Object.entries(params).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)])),
);

async function list(doctype: string, filters: Filter[], fields: string[] = ['name'], limit = 500): Promise<Doc[]> {
  const { data } = await api<{ data: Doc[] }>(
    `/api/resource/${encodeURIComponent(doctype)}?${q({ fields, filters, limit_page_length: String(limit) })}`);
  // A filter on a child table returns one row per matching child line.
  // Keyed on name when it was selected; rows without one are left alone.
  return fields.includes('name') || fields.includes('*')
    ? [...new Map(data.map((d) => [d.name, d])).values()]
    : data;
}

async function find(doctype: string, filters: Filter[]): Promise<Doc | undefined> {
  return (await list(doctype, filters, ['*'], 1))[0];
}

async function create(doctype: string, values: Record<string, unknown>): Promise<Doc> {
  const { data } = await api<{ data: Doc }>(`/api/resource/${encodeURIComponent(doctype)}`, {
    method: 'POST', body: JSON.stringify(values),
  });
  return data;
}

async function call<T = unknown>(method: string, args: Record<string, unknown>): Promise<T> {
  const { message } = await api<{ message: T }>(`/api/method/${method}`, {
    method: 'POST', body: JSON.stringify(args),
  });
  return message;
}

async function submit(doc: Doc): Promise<Doc> {
  if (Number(doc.docstatus) === 1) return doc;
  return call<Doc>('frappe.client.submit', { doc });
}

async function cancel(doctype: string, name: string) {
  await call('frappe.client.cancel', { doctype, name });
}

async function remove(doctype: string, name: string) {
  await api(`/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`, { method: 'DELETE' });
}

/** Cancel if submitted, then delete. A document that posted to the ledger
 *  (an invoice) cannot be deleted, and that is right: it stays cancelled,
 *  which the app and the seed both treat as gone. */
async function discard(doctype: string, doc: Doc) {
  if (Number(doc.docstatus) === 1) await cancel(doctype, doc.name);
  try {
    await remove(doctype, doc.name);
  } catch (error) {
    if (!(error instanceof Error && /LinkExistsError/.test(error.message))) throw error;
  }
}

async function ensure(doctype: string, filters: Filter[], values: Record<string, unknown>): Promise<Doc> {
  return (await find(doctype, filters)) ?? create(doctype, values);
}

// ---------- Dates ----------

const isoDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const plus = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return isoDay(d);
};
const TODAY = isoDay(new Date());
const T = (daysAgo: number) => plus(TODAY, -daysAgo);

// ---------- Masters ----------

const BRAINWISE = 'BrainWise Technology';
const COLOUR = 'Uniform Colour';
const SIZE = 'Uniform Size';
const SIZES = ['S', 'M', 'L', 'XL'];
const code = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const COLOURS: Record<string, string> = {
  '#1b2a4a': 'Navy', '#ffffff': 'White', '#2f3640': 'Charcoal',
  '#dfe6ef': 'Pale Blue', '#3d4a3a': 'Olive', '#c8b393': 'Sand',
  '#7a6a4f': 'Khaki', '#6a5c44': 'Khaki',
};
const TEMPLATES: Record<GarmentType, string> = {
  polo: 'Polo', cargo: 'Cargo Trouser', shirt: 'Shirt', chino: 'Chino', blazer: 'Blazer',
};
const variantCode = (template: string, colour: string, size: string) =>
  `UA-${code(template)}-${code(colour)}-${size}`;

/** Through the permission manager, never a bare Custom DocPerm insert: the
 *  first custom rule on a doctype replaces all its standard rules, and add()
 *  copies those over first so no other role loses access. add() grants read. */
async function grant(parent: string, role: string, extra: string[] = []) {
  if (!(await find('Custom DocPerm', [['parent', '=', parent], ['role', '=', role]]))) {
    await call('frappe.core.page.permission_manager.permission_manager.add', { parent, role, permlevel: 0 });
  }
  for (const ptype of extra) {
    await call('frappe.core.page.permission_manager.permission_manager.update',
      { doctype: parent, role, permlevel: 0, ptype, value: 1 });
  }
}

async function ensureCustomField(dt: string, fieldname: string, props: Record<string, unknown>) {
  if (!(await find('Custom Field', [['name', '=', `${dt}-${fieldname}`]]))) {
    await create('Custom Field', { dt, fieldname, ...props });
  }
}

const SIZE_RUN = 'UniformAI Size Run';

/** Insert-only record of the size breakdown a customer sent for an order.
 *  The app never writes the Sales Order; the team reads size runs here. */
async function ensureSizeRunDoctype() {
  if (await find('DocType', [['name', '=', SIZE_RUN]])) return;
  await create('DocType', {
    name: SIZE_RUN, module: 'Selling', custom: 1,
    autoname: 'format:SIZE-RUN-{#####}', naming_rule: 'Expression',
    fields: [
      { fieldname: 'sales_order', fieldtype: 'Link', options: 'Sales Order', label: 'Sales Order',
        reqd: 1, in_list_view: 1, in_standard_filter: 1 },
      { fieldname: 'allocation', fieldtype: 'JSON', label: 'Size run', reqd: 1 },
    ],
    permissions: [
      { role: 'System Manager', read: 1, write: 1, create: 1, delete: 1 },
      { role: 'Sales User', read: 1 },
      { role: 'UniformAI Portal', read: 1, create: 1 },
      { role: 'API Reader', read: 1 },
    ],
  });
  console.log(`created DocType ${SIZE_RUN}`);
}

async function ensureUser(email: string, first: string, role: string) {
  await ensure('Role', [['role_name', '=', role]], { role_name: role, desk_access: 0 });
  await ensure('User', [['email', '=', email]], {
    email, first_name: first, enabled: 1, send_welcome_email: 0, user_type: 'System User',
    roles: [{ role }],
  });
}

async function masters(company: string) {
  for (const dt of ['Quotation', 'Sales Order', 'Delivery Note', 'Sales Invoice']) {
    await ensureCustomField(dt, 'uniformai_kit',
      { label: 'UniformAI kit', fieldtype: 'Long Text', hidden: 1, allow_on_submit: 1 });
    await ensureCustomField(dt, 'uniformai_ref',
      { label: 'UniformAI ref', fieldtype: 'Data', read_only: 1, allow_on_submit: 1 });
  }

  // The assistant's read-only user, and the app's draft-only Portal user.
  await ensureUser('api.reader@uniform.localhost', 'API Reader', 'API Reader');
  for (const dt of ['Sales Order', 'Sales Invoice', 'Item', 'Bin', 'Warehouse', 'Customer', 'Quotation', 'Delivery Note']) {
    await grant(dt, 'API Reader');
  }
  await ensureUser('portal@uniform.localhost', 'UniformAI Portal', 'UniformAI Portal');
  for (const dt of ['Quotation', 'Sales Order']) await grant(dt, 'UniformAI Portal', ['create']);
  // Read only, and only what inserting a quotation and mapping it to an order
  // asked for when probed against a live site: the customer's address is
  // filled in, and the receivable account decides the currency.
  for (const dt of ['Customer', 'Item', 'Address', 'Account']) await grant(dt, 'UniformAI Portal');
  await ensureSizeRunDoctype();
  // Contact our team: the Portal opens a case, nothing more.
  await grant('Issue', 'UniformAI Portal', ['create']);
  // Cases read as CASE-2026-00007, not ERPNext's ISS- prefix.
  for (const [property, value] of [['options', 'CASE-.YYYY.-'], ['default', 'CASE-.YYYY.-']]) {
    await ensure('Property Setter', [['name', '=', `Issue-naming_series-${property}`]], {
      doctype_or_field: 'DocField', doc_type: 'Issue', field_name: 'naming_series',
      property, property_type: 'Text', value,
    });
  }

  // A customer needs a leaf group and territory; the "All ..." roots are groups.
  const customer_group = (await find('Customer Group', [['is_group', '=', 0]]))?.name;
  const territory = (await find('Territory', [['is_group', '=', 0]]))?.name;
  if (!customer_group || !territory) throw new Error('No leaf Customer Group or Territory; finish the setup wizard');
  for (const customer_name of [BRAINWISE, 'Delta Hotels', 'Nile Logistics']) {
    await ensure('Customer', [['customer_name', '=', customer_name]], {
      customer_name, customer_type: 'Company', customer_group, territory,
    });
  }
  const link = [{ link_doctype: 'Customer', link_name: BRAINWISE }];
  await ensure('Contact', [['first_name', '=', 'Ahmed'], ['last_name', '=', 'Osama']], {
    first_name: 'Ahmed', last_name: 'Osama', is_primary_contact: 1,
    email_ids: [{ email_id: 'ahmed.osama@brainwise.example', is_primary: 1 }], links: link,
  });
  await ensure('Address', [['address_title', '=', BRAINWISE]], {
    address_title: BRAINWISE, address_type: 'Billing', address_line1: '90th Street, Fifth Settlement',
    city: 'New Cairo', country: 'Egypt', is_primary_address: 1, links: link,
  });

  // Ready stock: garment templates with colour and size variants.
  const stockGroup = (await ensure('Item Group', [['item_group_name', '=', 'Uniforms']], {
    item_group_name: 'Uniforms', parent_item_group: 'All Item Groups', is_group: 0,
  })).name;
  const colourValues = ['Navy', 'Sand', 'Olive', 'White', 'Pale Blue', 'Charcoal', 'Khaki'];
  for (const [name, values] of [[COLOUR, colourValues], [SIZE, SIZES]] as const) {
    await ensure('Item Attribute', [['attribute_name', '=', name]], {
      attribute_name: name,
      item_attribute_values: values.map((attribute_value, i) => ({
        attribute_value, abbr: code(attribute_value).slice(0, 8), idx: i + 1,
      })),
    });
  }
  const colours = new Map<string, Set<string>>();
  for (const concept of CONCEPTS) for (const g of concept.garments) {
    const set = colours.get(TEMPLATES[g.type]) ?? new Set<string>();
    set.add(COLOURS[g.parts.body ?? g.parts.leg ?? Object.values(g.parts)[0]] ?? 'Navy');
    colours.set(TEMPLATES[g.type], set);
  }
  for (const [template, set] of colours) {
    await ensure('Item', [['item_code', '=', template]], {
      item_code: template, item_name: template, item_group: stockGroup, stock_uom: 'Nos',
      is_stock_item: 1, has_variants: 1, attributes: [{ attribute: COLOUR }, { attribute: SIZE }],
    });
    for (const colour of set) for (const size of SIZES) {
      const item_code = variantCode(template, colour, size);
      await ensure('Item', [['item_code', '=', item_code]], {
        item_code, item_name: `${template} ${colour} ${size}`, item_group: stockGroup, stock_uom: 'Nos',
        is_stock_item: 1, variant_of: template,
        attributes: [{ attribute: COLOUR, attribute_value: colour }, { attribute: SIZE, attribute_value: size }],
      });
    }
  }

  // Made to order: what a custom kit is quoted and ordered as.
  const mtoGroup = (await ensure('Item Group', [['item_group_name', '=', 'Made to order']], {
    item_group_name: 'Made to order', parent_item_group: 'All Item Groups', is_group: 0,
  })).name;
  for (const [type, item_code] of Object.entries(MTO_ITEM) as [GarmentType, string][]) {
    await ensure('Item', [['item_code', '=', item_code]], {
      item_code, item_name: `${LABELS[type]} (made to order)`, item_group: mtoGroup,
      stock_uom: 'Nos', is_stock_item: 0,
      description: `${LABELS[type]} made to the customer's design: colours, cloth and fit on each line.`,
    });
  }
  for (const [method, item_code] of Object.entries(LOGO_ITEM)) {
    await ensure('Item', [['item_code', '=', item_code]], {
      item_code, item_name: method === 'embroidery' ? 'Embroidery' : 'Print',
      item_group: stockGroup, stock_uom: 'Nos', is_stock_item: 0,
    });
  }

  // Warehouses and stock.
  const whName = async (warehouse_name: string) => (await ensure('Warehouse',
    [['warehouse_name', '=', warehouse_name], ['company', '=', company]],
    { warehouse_name, company, is_group: 0 })).name;
  const stores = await whName('Stores');
  const finished = await whName('Finished Goods');
  const target = (item: string): Record<string, number> =>
    item === 'UA-POLO-NAVY-XL' ? { [stores]: 260 } : { [stores]: 80, [finished]: 40 };

  if (!(await find('Stock Entry', [['remarks', '=', 'UniformAI demo opening stock'], ['docstatus', '=', 1]]))) {
    const items = [...colours].flatMap(([template, set]) => [...set].flatMap((colour) => SIZES.flatMap((size) => {
      const item_code = variantCode(template, colour, size);
      return Object.entries(target(item_code)).map(([t_warehouse, qty]) => ({ item_code, qty, t_warehouse, basic_rate: 100 }));
    })));
    await submit(await create('Stock Entry', {
      stock_entry_type: 'Material Receipt', company, remarks: 'UniformAI demo opening stock', items,
      set_posting_time: 1, posting_date: '2026-01-01',
    }));
  }
  // Sold out, so the assistant can say "out of stock", which is not "no record".
  if (!(await find('Stock Entry', [['remarks', '=', 'UniformAI demo stock-out'], ['docstatus', '=', 1]]))) {
    const bins = await list('Bin', [['item_code', '=', 'UA-POLO-SAND-M']], ['warehouse', 'actual_qty']);
    const items = bins.filter((b) => Number(b.actual_qty) > 0)
      .map((b) => ({ item_code: 'UA-POLO-SAND-M', qty: Number(b.actual_qty), s_warehouse: b.warehouse, basic_rate: 100 }));
    if (items.length) {
      await submit(await create('Stock Entry', {
        stock_entry_type: 'Material Issue', company, remarks: 'UniformAI demo stock-out', items,
      }));
    }
  }
  return { stores, finished, target, variants: [...colours].flatMap(([template, set]) =>
    [...set].flatMap((colour) => SIZES.map((size) => variantCode(template, colour, size)))) };
}

/** The first seed made Sales Orders with no Quotation and a standalone
 *  invoice. The workflow needs every order to come from a quote, so those
 *  are removed once: invoice, delivery notes, then the orders. */
async function removeFirstSeed() {
  const invoice = await find('Sales Invoice',
    [['remarks', '=', 'UniformAI management sample invoice'], ['docstatus', '<', 2]]);
  if (invoice) await discard('Sales Invoice', invoice);
  for (const po of ['UNIFORMAI-SAMPLE-1', 'UNIFORMAI-SAMPLE-2', 'UNIFORMAI-SAMPLE-3', 'UNIFORMAI-DELTA']) {
    const order = await find('Sales Order', [['po_no', '=', po], ['docstatus', '<', 2]]);
    if (!order) continue;
    for (const note of await list('Delivery Note',
      [['Delivery Note Item', 'against_sales_order', '=', order.name], ['docstatus', '<', 2]], ['name', 'docstatus'])) {
      await discard('Delivery Note', note);
    }
    await discard('Sales Order', order);
    console.log(`removed first-seed order ${order.name}`);
  }
}

// ---------- Chains ----------

type Stop = 'quote-draft' | 'quote' | 'order' | 'partial' | 'delivered' | 'invoiced';
type Chain = {
  ref: string; customer: string; kit: string; staff: number; date: string; stop: Stop;
  sizes?: 'later' | 'allocated'; discount?: number; rates?: Partial<Record<GarmentType, number>>;
};

const CURRENT: Chain[] = [
  { ref: 'demo-front-office', customer: BRAINWISE, kit: 'front-office', staff: 18, date: T(0), stop: 'quote-draft' },
  { ref: 'demo-technicians', customer: BRAINWISE, kit: 'technicians', staff: 40, date: T(2), stop: 'quote', discount: 5 },
  { ref: 'demo-operations', customer: BRAINWISE, kit: 'operations', staff: 24, date: T(10), stop: 'order', sizes: 'later' },
  { ref: 'demo-management-now', customer: BRAINWISE, kit: 'management', staff: 12, date: T(20), stop: 'partial', sizes: 'allocated' },
  { ref: 'demo-delta', customer: 'Delta Hotels', kit: 'front-office', staff: 30, date: T(15), stop: 'order' },
  { ref: 'demo-nile', customer: 'Nile Logistics', kit: 'operations', staff: 50, date: T(6), stop: 'quote' },
];

const HISTORY: Chain[] = [
  { ref: 'demo-hist-01', customer: BRAINWISE, kit: 'operations', staff: 20, date: '2026-01-15', stop: 'invoiced', sizes: 'allocated' },
  { ref: 'demo-hist-02', customer: BRAINWISE, kit: 'technicians', staff: 30, date: '2026-03-10', stop: 'invoiced', sizes: 'allocated' },
  { ref: 'demo-hist-03', customer: BRAINWISE, kit: 'front-office', staff: 10, date: '2026-04-08', stop: 'invoiced', sizes: 'allocated' },
  { ref: 'demo-hist-04', customer: BRAINWISE, kit: 'management', staff: 12, date: '2026-06-03', stop: 'invoiced', sizes: 'allocated', rates: { blazer: 1420 } },
  { ref: 'demo-hist-05', customer: BRAINWISE, kit: 'operations', staff: 8, date: '2026-07-12', stop: 'invoiced', sizes: 'allocated' },
  { ref: 'demo-hist-06', customer: BRAINWISE, kit: 'management', staff: 12, date: '2026-08-05', stop: 'invoiced', sizes: 'allocated' },
  { ref: 'demo-hist-07', customer: BRAINWISE, kit: 'technicians', staff: 6, date: '2026-09-01', stop: 'invoiced', sizes: 'allocated' },
];

function kitFor(c: Chain): Kit {
  const concept = CONCEPTS.find((x) => x.id === c.kit);
  if (!concept) throw new Error(`Unknown kit ${c.kit}`);
  const sets = Math.ceil(c.staff * 1.05);
  let sizePlan: SizePlan = { mode: 'collect_later', allocation: {} };
  if (c.sizes === 'allocated') {
    // An even run across the kit's cuts, so the app reads the sizes as complete.
    const men = Math.ceil(sets / 2);
    const women = sets - men;
    const split = (n: number) => {
      const each = Math.floor(n / 4);
      return { S: each, M: each, L: each, XL: n - 3 * each };
    };
    sizePlan = { mode: 'allocate_now', allocation: { men: split(men), women: split(women) } };
    if (allocatedSizeCount(sizePlan.allocation, concept.cuts) !== sets) throw new Error(`${c.ref}: sizes do not add up`);
  }
  return { concept, staff: c.staff, sets, grades: [], sizePlan };
}

/** Live documents only: a cancelled one is history, not the demo's state. */
const byRef = (doctype: string, ref: string) =>
  find(doctype, [['uniformai_ref', '=', ref], ['docstatus', '<', 2]]);

async function chain(c: Chain, company: string) {
  const kit = kitFor(c);
  const lines = kitLines(kit).map((l) => {
    const type = Object.entries(MTO_ITEM).find(([, item]) => item === l.item_code)?.[0] as GarmentType | undefined;
    const rate = type ? c.rates?.[type] : undefined;
    return rate ? { ...l, rate } : l;
  });
  const open = c.stop === 'quote-draft' || c.stop === 'quote';

  let quote = await byRef('Quotation', c.ref);
  if (!quote) {
    quote = await create('Quotation', {
      quotation_to: 'Customer', party_name: c.customer, company, order_type: 'Sales',
      transaction_date: c.date,
      // ERPNext will not turn an expired quotation into an order, so the
      // back-dated history carries no validity date.
      ...(open ? { valid_till: plus(c.date, 30) } : {}),
      items: lines, uniformai_kit: JSON.stringify(kit), uniformai_ref: c.ref,
      ...(c.discount ? { apply_discount_on: 'Grand Total', additional_discount_percentage: c.discount } : {}),
    });
    if (!c.discount && !c.rates && Number(quote.grand_total) !== kitEstimate(kit)) {
      throw new Error(`${c.ref}: quotation ${quote.grand_total} is not the app's estimate ${kitEstimate(kit)}`);
    }
    console.log(`${c.ref}: quotation ${quote.name}`);
  }
  if (c.stop === 'quote-draft') return;
  quote = await submit(quote);
  if (c.stop === 'quote') return;

  const soDate = plus(c.date, 1);
  let order = await byRef('Sales Order', c.ref);
  if (!order) {
    const mapped = await call<Doc>('erpnext.selling.doctype.quotation.quotation.make_sales_order', { source_name: quote.name });
    const due = plus(soDate, 21);
    order = await submit(await create('Sales Order', {
      ...mapped, transaction_date: soDate, delivery_date: due,
      items: (mapped.items as Doc[]).map((i) => ({ ...i, delivery_date: due })),
    }));
    console.log(`${c.ref}: sales order ${order.name}`);
  }
  if (c.stop === 'order') return;

  const dnDate = plus(soDate, c.stop === 'partial' ? 14 : 21);
  if (dnDate > TODAY) throw new Error(`${c.ref}: delivery ${dnDate} would be in the future`);
  if (!(await byRef('Delivery Note', c.ref))) {
    const mapped = await call<Doc>('erpnext.selling.doctype.sales_order.sales_order.make_delivery_note', { source_name: order.name });
    const items = (mapped.items as Doc[]).map((i) =>
      ({ ...i, qty: c.stop === 'partial' ? Math.floor(Number(i.qty) / 2) : i.qty }));
    const note = await submit(await create('Delivery Note', { ...mapped, items, set_posting_time: 1, posting_date: dnDate }));
    console.log(`${c.ref}: delivery note ${note.name}`);
  }
  if (c.stop !== 'invoiced') return;

  if (!(await byRef('Sales Invoice', c.ref))) {
    const mapped = await call<Doc>('erpnext.selling.doctype.sales_order.sales_order.make_sales_invoice', { source_name: order.name });
    const invoice = await submit(await create('Sales Invoice', {
      ...mapped, set_posting_time: 1, posting_date: dnDate, due_date: plus(dnDate, 30),
    }));
    console.log(`${c.ref}: sales invoice ${invoice.name}`);
  }
}

/** History invoices left open on purpose: hist-06 is past due, hist-07 is
 *  not due yet. Every other history invoice is paid, once. */
const UNPAID = new Set(['demo-hist-06', 'demo-hist-07']);

async function pay(ref: string, company: Doc) {
  const invoice = await find('Sales Invoice', [['uniformai_ref', '=', ref], ['docstatus', '=', 1]]);
  if (!invoice || Number(invoice.outstanding_amount) <= 0) return;
  const mapped = await call<Doc>('erpnext.accounts.doctype.payment_entry.payment_entry.get_payment_entry',
    { dt: 'Sales Invoice', dn: invoice.name });
  const paid = plus(String(invoice.posting_date), 14);
  const day = paid > TODAY ? TODAY : paid;
  const entry = await submit(await create('Payment Entry', {
    ...mapped,
    paid_to: mapped.paid_to || company.default_cash_account,
    posting_date: day, reference_no: ref, reference_date: day,
  }));
  console.log(`${ref}: payment ${entry.name}`);
}

// ---------- Reset ----------

async function reset(stock: Awaited<ReturnType<typeof masters>>, company: string) {
  const refs = CURRENT.map((c) => c.ref);
  // Rehearsals leave app- documents behind (the mapping copies the ref onto
  // the order, delivery and invoice). They go too, so every run starts clean.
  const byRefs = async (doctype: string) => {
    const found = [
      ...await list(doctype, [['uniformai_ref', 'in', refs]], ['name', 'docstatus']),
      ...await list(doctype, [['uniformai_ref', 'like', 'app-%']], ['name', 'docstatus']),
    ];
    return [...new Map(found.map((doc) => [doc.name, doc])).values()];
  };
  // A size run links to its order and would block deleting it.
  const orders = (await byRefs('Sales Order')).map((o) => o.name);
  if (orders.length) {
    for (const run of await list(SIZE_RUN, [['sales_order', 'in', orders]])) {
      await remove(SIZE_RUN, run.name);
      console.log(`reset: removed size run ${run.name}`);
    }
  }
  // Only the assistant's tagged cases are disposable. Staff-created BrainWise
  // cases are account history and must survive a rehearsal reset.
  for (const issue of await list('Issue', [
    ['customer', '=', BRAINWISE], ['subject', 'like', '[UniformAI assistant]%'],
  ])) {
    await remove('Issue', issue.name);
    console.log(`reset: removed case ${issue.name}`);
  }
  for (const doctype of ['Sales Invoice', 'Delivery Note', 'Sales Order', 'Quotation']) {
    for (const doc of await byRefs(doctype)) {
      await discard(doctype, doc);
      console.log(`reset: removed ${doctype} ${doc.name}`);
    }
  }
  // Stock goes back by a reconciliation of its own; the one made by hand in
  // the demo stays as a record of what happened.
  const bins = await list('Bin', [['item_code', 'in', stock.variants]], ['item_code', 'warehouse', 'actual_qty'], 2000);
  const items = stock.variants.flatMap((item_code) => {
    const want = item_code === 'UA-POLO-SAND-M' ? {} : stock.target(item_code);
    const warehouses = new Set([
      ...Object.keys(want),
      ...bins.filter((b) => b.item_code === item_code).map((b) => String(b.warehouse)),
    ]);
    return [...warehouses].flatMap((warehouse) => {
      const qty = want[warehouse] ?? 0;
      const have = Number(bins.find((b) => b.item_code === item_code && b.warehouse === warehouse)?.actual_qty ?? 0);
      return qty === have ? [] : [{ item_code, warehouse, qty, valuation_rate: 100 }];
    });
  });
  if (items.length) {
    await submit(await create('Stock Reconciliation', {
      company, purpose: 'Stock Reconciliation', items,
    }));
    console.log(`reset: stock back to the seeded quantities for ${items.length} bins`);
  }
}

// ---------- Run ----------

async function seed() {
  const company = await find('Company', []);
  if (!company) throw new Error('Finish the ERPNext setup wizard and create a company first');
  const companyName = String(company.name);

  const stock = await masters(companyName);
  await removeFirstSeed();
  if (RESET) await reset(stock, companyName);
  for (const c of [...HISTORY, ...CURRENT]) await chain(c, companyName);
  for (const c of HISTORY) if (!UNPAID.has(c.ref)) await pay(c.ref, company);
  console.log(`Seeded ${HISTORY.length} completed orders and ${CURRENT.length} current ones in ${companyName}.`);
}

seed().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
