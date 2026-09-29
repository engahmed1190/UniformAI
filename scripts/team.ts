// scripts/team.ts
// Plays UniformAI's team during a demo or rehearsal: the steps staff take in
// ERPNext's desk, through its API with the seed key. The desk works too.
//
//   npm run team -- issue SAL-QTN-2026-00032     submit the quotation (price confirmed)
//   npm run team -- confirm SAL-ORD-2026-00015   submit the sales order
//   npm run team -- deliver SAL-ORD-2026-00015   deliver in full and invoice, due in 30 days

import { loadEnvConfig } from '@next/env';

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
  } else {
    console.log('usage: npm run team -- issue <quotation> | confirm <sales order> | deliver <sales order>');
    process.exit(1);
  }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
