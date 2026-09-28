// Run: npx tsx lib/sales.test.ts
import assert from 'node:assert/strict';
import { CONCEPTS } from './concepts';
import { GARMENT_CATALOG } from './spec';
import { ErpError } from './erp';
import { kitLines } from './orders';
import { SalesError, approveQuote, listOrders, requestQuote } from './sales';

process.env.ERP_URL = 'http://uniform.localhost:8000';
process.env.ERP_READ_KEY = 'reader:secret';
process.env.ERP_WRITE_KEY = 'portal:secret';

type Seen = { url: URL; init?: RequestInit };
let seen: Seen[] = [];
/** path prefix -> reply (or a function of the request) */
let routes: Record<string, (s: Seen) => unknown> = {};
const originalFetch = globalThis.fetch;
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  const s = { url, init };
  seen.push(s);
  const path = decodeURIComponent(url.pathname);
  const key = Object.keys(routes).find((k) => path.startsWith(k));
  if (!key) return new Response('{}', { status: 404 });
  const out = routes[key](s);
  if (out instanceof Response) return out;
  return new Response(JSON.stringify(out), { status: 200 });
}) as typeof fetch;

const writes = () => seen.filter((s) => s.init?.method === 'POST');
const auth = (s: Seen) => (s.init?.headers as Record<string, string>).Authorization;
const fresh = () => { seen = []; routes = {}; };

const concept = CONCEPTS[0];
const kit = { concept, staff: 10, sets: 15, grades: [0, 1], sizePlan: { mode: 'collect_later', allocation: {} } };

const quoteRow = (over = {}) => ({
  name: 'SAL-QTN-1', party_name: 'BrainWise Technology', status: 'Open', docstatus: 1,
  transaction_date: '2026-09-20', grand_total: 100, uniformai_kit: JSON.stringify(kit), ...over,
});

async function main() {
  // 1. requestQuote: server-built Quotation, body's customer and prices ignored.
  fresh();
  routes = {
    '/api/resource/Quotation': (s) => s.init?.method === 'POST' ? { data: { name: 'SAL-QTN-9' } }
      : { data: [quoteRow({ name: 'SAL-QTN-9', docstatus: 0, status: 'Draft' })] },
    '/api/resource/Sales Order': () => ({ data: [] }),
    '/api/resource/Delivery Note': () => ({ data: [] }),
  };
  const order = await requestQuote({ ...kit, customer: 'Delta Hotels', rate: 1, total: 1 });
  const post = writes();
  assert.equal(post.length, 1);
  assert.equal(auth(post[0]), 'token portal:secret');
  const doc = JSON.parse(String(post[0].init!.body));
  assert.equal(doc.party_name, 'BrainWise Technology');
  assert.equal(doc.quotation_to, 'Customer');
  assert.ok(String(doc.uniformai_ref).startsWith('app-'));
  assert.deepEqual(doc.items, kitLines(kit as never));
  assert.equal(JSON.parse(doc.uniformai_kit).staff, 10);
  assert.equal(order.quote, 'SAL-QTN-9');
  assert.equal(order.state, 'quote_requested');
  const read = seen.find((s) => !s.init?.method || s.init.method === 'GET')!;
  assert.equal(auth(read), 'token reader:secret');

  // 2. Bad kits are 400 and send nothing.
  for (const body of [
    undefined, {}, { ...kit, staff: 0 }, { ...kit, sets: 5 }, { ...kit, sets: 21 }, { ...kit, staff: 5001, sets: 5001 },
    { ...kit, grades: [3] }, { ...kit, sizePlan: null },
    { ...kit, concept: { ...concept, garments: [{ ...concept.garments[0], type: 'cape' }] } },
    { ...kit, concept: { ...concept, garments: [] } },
  ]) {
    fresh();
    await assert.rejects(requestQuote(body), (e) => e instanceof SalesError && e.status === 400);
    assert.equal(seen.length, 0);
  }

  // 3. approve refusals send no write.
  const refuse = async (quote: Record<string, unknown>, status: number, orders: unknown[] = []) => {
    fresh();
    routes = {
      '/api/resource/Quotation': () => ({ data: quote }),
      '/api/resource/Sales Order': () => ({ data: orders }),
      '/api/method/': () => { throw new Error('no write expected'); },
    };
    await assert.rejects(approveQuote('SAL-QTN-1'), (e) => e instanceof SalesError && e.status === status);
    assert.equal(writes().length, 0);
  };
  await refuse(quoteRow({ docstatus: 0, status: 'Draft' }), 409);
  await refuse(quoteRow({ status: 'Ordered' }), 409);
  await refuse(quoteRow({ status: 'Lost' }), 409);
  await refuse(quoteRow({ party_name: 'Delta Hotels' }), 404);
  await refuse(quoteRow(), 409, [{ name: 'SAL-ORD-1' }]);

  // 4. approve: map, set delivery dates, insert a draft, return the chain.
  fresh();
  let inserted: Record<string, unknown> | undefined;
  routes = {
    '/api/method/erpnext.selling.doctype.quotation.quotation.make_sales_order': () => ({
      message: { doctype: 'Sales Order', customer: 'BrainWise Technology', __islocal: 1,
        items: [{ item_code: 'A', qty: 1, prevdoc_docname: 'SAL-QTN-1', __unsaved: 1 }] } }),
    '/api/resource/Quotation': () => ({ data: quoteRow() }),
    '/api/resource/Sales Order': (s) => {
      if (s.init?.method === 'POST') { inserted = JSON.parse(String(s.init.body)); return { data: { name: 'SAL-ORD-7' } }; }
      const orderRead = s.url.searchParams.get('fields')!.includes('items.prevdoc_docname');
      return { data: orderRead && inserted ? [
        { name: 'SAL-ORD-7', customer: 'BrainWise Technology', status: 'Draft', docstatus: 0,
          transaction_date: '2026-09-29', per_delivered: 0, grand_total: 100, uniformai_kit: JSON.stringify(kit),
          prevdoc_docname: null },
        { name: 'SAL-ORD-7', customer: 'BrainWise Technology', status: 'Draft', docstatus: 0,
          transaction_date: '2026-09-29', per_delivered: 0, grand_total: 100, uniformai_kit: JSON.stringify(kit),
          prevdoc_docname: 'SAL-QTN-1' },
      ] : [] };
    },
    '/api/resource/Delivery Note': () => ({ data: [] }),
  };
  // the quote list read shares the /Quotation route: array for lists, doc for get
  routes['/api/resource/Quotation'] = (s) => decodeURIComponent(s.url.pathname).endsWith("/SAL-QTN-1") ? { data: quoteRow() } : { data: [quoteRow()] };
  const approved = await approveQuote('SAL-QTN-1');
  const make = writes().find((s) => s.url.pathname.includes('make_sales_order'))!;
  assert.equal(auth(make), 'token portal:secret');
  assert.deepEqual(JSON.parse(String(make.init!.body)), { source_name: 'SAL-QTN-1' });
  assert.ok(inserted);
  assert.ok(!('__islocal' in inserted!));
  const d = new Date(); d.setDate(d.getDate() + 21);
  const want = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  assert.equal(inserted!.delivery_date, want);
  assert.equal((inserted!.items as { delivery_date: string }[])[0].delivery_date, want);
  assert.equal(inserted!.docstatus, 0);
  assert.equal(approved.salesOrder, 'SAL-ORD-7');
  assert.equal(approved.quote, 'SAL-QTN-1');
  assert.equal(approved.state, 'awaiting');
  assert.equal(writes().length, 2);

  // 5. Second approval of the same quote sees the first Sales Order: 409.
  fresh();
  routes = {
    '/api/resource/Quotation': () => ({ data: quoteRow() }),
    '/api/resource/Sales Order': () => ({ data: [{ name: 'SAL-ORD-7' }] }),
  };
  await assert.rejects(approveQuote('SAL-QTN-1'), (e) => e instanceof SalesError && e.status === 409);
  assert.equal(writes().length, 0);

  // 6. An ERP failure on insert propagates as ErpError.
  fresh();
  routes = { '/api/resource/Quotation': () => new Response('{}', { status: 500 }) };
  await assert.rejects(requestQuote(kit), (e) => e instanceof ErpError);

  // 7. listOrders folds item rows and scopes reads to the customer.
  fresh();
  routes = {
    '/api/resource/Quotation': () => ({ data: [quoteRow()] }),
    '/api/resource/Sales Order': () => ({ data: [
      { name: 'SAL-ORD-1', customer: 'BrainWise Technology', status: 'To Deliver', docstatus: 1,
        transaction_date: '2026-09-21', per_delivered: 100, grand_total: 100, uniformai_kit: JSON.stringify(kit), prevdoc_docname: 'SAL-QTN-1' },
      { name: 'SAL-ORD-1', customer: 'BrainWise Technology', status: 'To Deliver', docstatus: 1,
        transaction_date: '2026-09-21', per_delivered: 100, grand_total: 100, uniformai_kit: JSON.stringify(kit), prevdoc_docname: 'SAL-QTN-1' },
    ] }),
    '/api/resource/Delivery Note': () => ({ data: [
      { name: 'MAT-DN-1', posting_date: '2026-09-25', docstatus: 1, against_sales_order: 'SAL-ORD-1' },
      { name: 'MAT-DN-1', posting_date: '2026-09-25', docstatus: 1, against_sales_order: 'SAL-ORD-1' },
    ] }),
  };
  const all = await listOrders();
  assert.equal(all.length, 1);
  assert.equal(all[0].state, 'delivered');
  assert.equal(all[0].quote, 'SAL-QTN-1');
  assert.equal(all[0].deliveryNote, 'MAT-DN-1');
  const dn = seen.find((s) => s.url.pathname.endsWith('Delivery%20Note') || s.url.pathname.endsWith('Delivery Note'))!;
  assert.deepEqual(JSON.parse(dn.url.searchParams.get('filters')!), [['customer', '=', 'BrainWise Technology'], ['docstatus', '=', 1]]);

  // 8. The server prices from the catalogue, not the body.
  fresh();
  routes = {
    '/api/resource/Quotation': (s) => s.init?.method === 'POST' ? { data: { name: 'SAL-QTN-9' } } : { data: [quoteRow({ name: 'SAL-QTN-9', docstatus: 0 })] },
    '/api/resource/Sales Order': () => ({ data: [] }),
    '/api/resource/Delivery Note': () => ({ data: [] }),
  };
  const cheap = { ...kit, concept: { ...concept, garments: concept.garments.map((g) => ({ ...g, unitPrice: 0 })) } };
  await requestQuote(cheap);
  assert.deepEqual(JSON.parse(String(writes()[0].init!.body)).items, kitLines(kit as never));
  assert.ok(JSON.parse(String(writes()[0].init!.body)).items[0].rate > 0);
  // An unknown concept id falls back to the garment catalogue by type.
  fresh();
  routes = { '/api/resource/Quotation': (s) => s.init?.method === 'POST' ? { data: { name: 'SAL-QTN-9' } } : { data: [quoteRow({ name: 'SAL-QTN-9', docstatus: 0 })] },
    '/api/resource/Sales Order': () => ({ data: [] }), '/api/resource/Delivery Note': () => ({ data: [] }) };
  const unknown = { ...kit, grades: [], concept: { ...concept, id: 'mine', garments: [{ ...concept.garments[0], unitPrice: 1 }] } };
  await requestQuote(unknown);
  assert.equal(JSON.parse(String(writes()[0].init!.body)).items[0].rate, GARMENT_CATALOG[concept.garments[0].type].unitPrice);

  // 9. Size allocations are whole numbers, 0..sets, per size.
  for (const allocation of [{ men: { M: -1 } }, { men: { M: 1.5 } }, { men: { M: 16 } }, { men: { M: '3' } },
    { men: { Q: 1 } }, { dwarf: { M: 1 } }, { men: 3 }]) {
    fresh();
    await assert.rejects(requestQuote({ ...kit, sizePlan: { mode: 'allocate_now', allocation } }),
      (e) => e instanceof SalesError && e.status === 400, JSON.stringify(allocation));
    assert.equal(seen.length, 0);
  }

  // 10. Expired quotes are refused before ERPNext is asked to make anything.
  await refuse(quoteRow({ valid_till: '2020-01-01' }), 409);

  // 11. ERPNext failing during approve writes nothing.
  fresh();
  routes = { '/api/resource/Quotation': () => new Response('{}', { status: 500 }) };
  await assert.rejects(approveQuote('SAL-QTN-1'), (e) => e instanceof ErpError);
  assert.equal(writes().length, 0);
  fresh();
  routes = {
    '/api/resource/Quotation': () => ({ data: quoteRow() }),
    '/api/resource/Sales Order': () => ({ data: [] }),
    '/api/method/': () => new Response('{}', { status: 500 }),
  };
  await assert.rejects(approveQuote('SAL-QTN-1'), (e) => e instanceof ErpError);
  assert.equal(writes().filter((s) => s.url.pathname.includes('/api/resource/Sales')).length, 0, 'no insert after a failed mapping');
  // ...and the lock is released, so a retry is not stuck on a 409.
  routes['/api/method/'] = () => ({ message: { doctype: 'Sales Order', items: [] } });
  let retried = 0;
  routes['/api/resource/Sales Order'] = (s) => { if (s.init?.method === 'POST') { retried++; return { data: { name: 'SAL-ORD-8' } }; } return { data: [] }; };
  routes['/api/resource/Quotation'] = (s) => decodeURIComponent(s.url.pathname).endsWith('/SAL-QTN-1') ? { data: quoteRow() } : { data: [quoteRow()] };
  routes['/api/resource/Delivery Note'] = () => ({ data: [] });
  await approveQuote('SAL-QTN-1');
  assert.equal(retried, 1);

  // 12. Two approvals at once: one insert, the other is a 409 with no ERPNext write.
  fresh();
  let inserts = 0;
  const slow = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 30));
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const path = decodeURIComponent(url.pathname);
    seen.push({ url, init });
    const json = (v: unknown) => new Response(JSON.stringify(v), { status: 200 });
    if (init?.method === 'POST' && path.includes('/api/resource/Sales Order')) { inserts++; return json({ data: { name: 'SAL-ORD-9' } }); }
    if (init?.method === 'POST') return json({ message: { doctype: 'Sales Order', items: [] } });
    if (path.endsWith('/SAL-QTN-1')) return json(await slow({ data: quoteRow() }));
    if (path.includes('/Quotation')) return json({ data: [quoteRow()] });
    return json({ data: [] });
  }) as typeof fetch;
  const results = await Promise.allSettled([approveQuote('SAL-QTN-1'), approveQuote('SAL-QTN-1')]);
  assert.equal(inserts, 1);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  const lost = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
  assert.ok(lost.reason instanceof SalesError && lost.reason.status === 409);
  assert.equal(writes().length, 2, 'only the winner wrote: one mapping, one insert');

  console.log('sales: all assertions passed');
}

main().finally(() => { globalThis.fetch = originalFetch; }).catch((e) => { console.error(e); process.exit(1); });
