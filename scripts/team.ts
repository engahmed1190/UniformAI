// scripts/team.ts
// Plays UniformAI's team during a demo or rehearsal: the steps staff take in
// ERPNext's desk, through its API with the seed key. The desk works too.
//
//   npm run team -- issue SAL-QTN-2026-00032     submit the quotation (price confirmed)
//   npm run team -- confirm SAL-ORD-2026-00015   submit the sales order
//   npm run team -- sizes SAL-ORD-2026-00015     apply the customer's size run (Update Items)
//   npm run team -- deliver SAL-ORD-2026-00015   deliver in full and invoice, due in 30 days

import { loadEnvConfig } from '@next/env';
import { type Kit } from '../lib/orders';
import { cutsOf, parseRun } from '../lib/size-run';
import { type SoItem, sizedItems } from '../lib/sized';

loadEnvConfig(process.cwd());
const ERP_URL = process.env.ERP_URL?.replace(/\/$/, '');
const KEY = process.env.ERP_SEED_KEY;
if (!ERP_URL || !KEY) throw new Error('ERP_URL and ERP_SEED_KEY are required');

type Doc = Record<string, unknown> & { name: string };

/** Frappe mapped documents contain client-only `__*` markers. They must not
 *  be sent back through the resource insertion API. */
function clean<T>(value: T): T {
  if (Array.isArray(value)) return value.map(clean) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !key.startsWith('__'))
      .map(([key, child]) => [key, clean(child)])) as T;
  }
  return value;
}

async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${ERP_URL}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `token ${KEY}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res.json() as Promise<T>;
}
const resource = (doctype: string, name = '') =>
  `/api/resource/${encodeURIComponent(doctype)}${name ? `/${encodeURIComponent(name)}` : ''}`;
const get = async (doctype: string, name: string) => (await api<{ data: Doc }>(resource(doctype, name))).data;
const insert = async (doctype: string, doc: Record<string, unknown>) => (await api<{ data: Doc }>(resource(doctype), doc)).data;
const call = async <T>(method: string, args: Record<string, unknown>) =>
  (await api<{ message: T }>(`/api/method/${method}`, args)).message;
const submit = (doc: Doc) => call<Doc>('frappe.client.submit', { doc });
const SO = 'erpnext.selling.doctype.sales_order.sales_order';

type OrderDoc = Doc & {
  docstatus: number; per_delivered: number; per_billed: number; grand_total: number;
  uniformai_kit?: string | null; items: SoItem[];
};

/** The team applies a confirmed order's sizes the way the desk's Update
 *  Items does: each made-to-order garment line is replaced by its colour,
 *  cut and size variants at the same rate, so the total does not move. The
 *  customer's newest Size Run wins; a kit sized at quote time is used when
 *  there is none. ERPNext refuses to delete a delivered, billed or ordered
 *  line, so this runs before `deliver`. */
async function applySizes(name: string): Promise<string> {
  const order = await get('Sales Order', name) as OrderDoc;
  if (order.docstatus !== 1) throw new Error(`${name} is not confirmed yet`);
  if (order.per_delivered > 0 || order.per_billed > 0) throw new Error(`${name} is already delivered or billed in part`);
  const kit = order.uniformai_kit ? JSON.parse(order.uniformai_kit) as Kit : null;
  if (!kit) throw new Error(`${name} was not made by the app`);
  const runs = await api<{ data: { allocation: unknown }[] }>(`${resource('UniformAI Size Run')}?${new URLSearchParams({
    fields: JSON.stringify(['allocation']), filters: JSON.stringify([['sales_order', '=', name]]),
    order_by: 'creation desc', limit_page_length: '1',
  })}`);
  const stored = runs.data[0]?.allocation
    ?? (kit.sizePlan?.mode === 'allocate_now' ? kit.sizePlan.allocation : undefined);
  const run = parseRun(typeof stored === 'string' ? JSON.parse(stored) : stored, cutsOf(kit.concept), kit.sets);
  if (!run) throw new Error(`${name} has no complete size run yet`);
  const trans = sizedItems(order.items, kit, run);
  await call('erpnext.controllers.accounts_controller.update_child_qty_rate', {
    parent_doctype: 'Sales Order', parent_doctype_name: name, child_docname: 'items',
    trans_items: JSON.stringify(trans),
  });
  const after = await get('Sales Order', name);
  if (Number(after.grand_total) !== Number(order.grand_total)) {
    throw new Error(`${name}: the total moved from ${order.grand_total} to ${after.grand_total}`);
  }
  return `sized ${name}: ${trans.filter((t) => !t.docname).length} size lines, total ${after.grand_total}`;
}

async function main() {
  const [verb, name] = process.argv.slice(2);
  if (verb === 'issue' && name) {
    console.log(`issued ${(await submit(await get('Quotation', name))).name}`);
  } else if (verb === 'confirm' && name) {
    console.log(`confirmed ${(await submit(await get('Sales Order', name))).name}`);
  } else if (verb === 'deliver' && name) {
    const note = await submit(await insert('Delivery Note', clean(await call<Doc>(`${SO}.make_delivery_note`, { source_name: name }))));
    const due = new Date();
    due.setDate(due.getDate() + 30);
    const invoice = await submit(await insert('Sales Invoice', {
      ...clean(await call<Doc>(`${SO}.make_sales_invoice`, { source_name: name })), due_date: due.toISOString().slice(0, 10),
    }));
    console.log(`delivered ${note.name}, invoiced ${invoice.name}`);
  } else if (verb === 'sizes' && name) {
    console.log(await applySizes(name));
  } else {
    console.log('usage: npm run team -- issue <quotation> | confirm <sales order> | sizes <sales order> | deliver <sales order>');
    process.exit(1);
  }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
