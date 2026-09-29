// Run: npx tsx lib/sales-reads.test.ts
import assert from 'node:assert/strict';
import { CONCEPTS } from './concepts';
import { mockErp } from './fetch-mock';
import { toInvoice } from './invoices';
import { toQuoteView } from './quote-view';
import { listInvoices, listOrders, quoteDetail } from './sales';

const kit = { concept: CONCEPTS[0], staff: 10, sets: 11, grades: [], sizePlan: { mode: 'collect_later', allocation: {} } };
const QTN = { name: 'SAL-QTN-1', party_name: 'BrainWise Technology', status: 'Ordered', docstatus: 1,
  transaction_date: '2026-09-20', grand_total: 7150, uniformai_kit: JSON.stringify(kit) };
const SO = { name: 'SAL-ORD-1', customer: 'BrainWise Technology', status: 'To Deliver and Bill', docstatus: 1,
  transaction_date: '2026-09-21', delivery_date: '2026-10-12', per_delivered: 0, grand_total: 7150,
  uniformai_kit: JSON.stringify(kit), prevdoc_docname: 'SAL-QTN-1' };
const chain = (runs?: { sales_order: string; allocation?: string }[]) => ({
  '/api/resource/Quotation': () => ({ data: [QTN] }),
  '/api/resource/Sales Order': () => ({ data: [SO] }),
  '/api/resource/Delivery Note': () => ({ data: [] }),
  ...(runs ? { '/api/resource/UniformAI Size Run': () => ({ data: runs }) } : {}),
});

async function main() {
  // 1. A site without the Size Run doctype (404) still lists orders.
  mockErp(chain());
  assert.equal((await listOrders())[0].state, 'collecting_sizes');

  // 2. A valid size run on record (only this concept's cuts, total = sets)
  // moves the order to In progress; malformed or short ones do not.
  const cut = (CONCEPTS[0].cuts?.length ? CONCEPTS[0].cuts : ['men', 'women'])[0];
  const run = (allocation: string) => ({ sales_order: 'SAL-ORD-1', allocation });
  for (const bad of ['{not json', JSON.stringify({ [cut]: { M: 10 } }), JSON.stringify({ [cut]: { XXS9: 11 } })]) {
    mockErp(chain([run(bad)]));
    assert.equal((await listOrders())[0].state, 'collecting_sizes', bad);
  }
  mockErp(chain([run(JSON.stringify({ [cut]: { M: 6, L: 5 } }))]));
  assert.equal((await listOrders())[0].state, 'in_progress');

  // 3. The quotation view carries names and money only.
  const doc = {
    name: 'SAL-QTN-2', party_name: 'BrainWise Technology', docstatus: 1, valid_till: '2026-10-27',
    terms: 'staff terms', additional_discount_percentage: 5, grand_total: 27451.2, rounded_total: 27451,
    items: [
      { item_code: 'UA-MTO-POLO', qty: 42, rate: 300, amount: 12600, description: 'Internal: rush' },
      { item_code: 'UA-EMBROIDERY', qty: 42, rate: 40, amount: 1680, description: 'left chest' },
    ],
  };
  const view = toQuoteView(doc);
  assert.deepEqual(view.lines.map((l) => (l.kind === 'garment' ? l.garment : l.kind)), ['polo', 'branding']);
  assert.equal(view.sets, 42);
  assert.equal(view.discountPct, 5);
  assert.equal(view.total, 27451);
  for (const leak of [/UA-/, /Internal/, /terms/, /description/, /party_name/]) {
    assert.doesNotMatch(JSON.stringify(view), leak);
  }

  // 4. Another customer's, or a draft, quotation reads as not found.
  for (const over of [{ party_name: 'Delta Hotels' }, { docstatus: 0 }]) {
    mockErp({ '/api/resource/Quotation/': () => ({ data: { ...doc, ...over } }) });
    await assert.rejects(quoteDetail('SAL-QTN-2'), { status: 404 });
  }
  mockErp({ '/api/resource/Quotation/': () => ({ data: doc }) });
  assert.equal((await quoteDetail('SAL-QTN-2')).total, 27451);

  // 5. Invoice status comes from what is owed and the due day.
  const row = { name: 'INV-1', posting_date: '2026-08-27', due_date: '2026-09-26', grand_total: 9000 };
  assert.equal(toInvoice({ ...row, outstanding_amount: 0 }, '2026-09-29').status, 'paid');
  assert.equal(toInvoice({ ...row, outstanding_amount: 9000 }, '2026-09-29').status, 'overdue');
  assert.equal(toInvoice({ ...row, outstanding_amount: 9000 }, '2026-09-20').status, 'unpaid');
  assert.equal(toInvoice({ ...row, outstanding_amount: 9000 }, '2026-09-26').status, 'unpaid', 'due today is not late');

  const erp = mockErp({ '/api/resource/Sales Invoice': () => ({ data: [{ ...row, outstanding_amount: 0 }] }) });
  const invoices = await listInvoices();
  assert.equal(invoices[0].status, 'paid');
  const filters = erp.seen[0].url.searchParams.get('filters') ?? '';
  assert.match(filters, /BrainWise Technology/);
  assert.match(filters, /is_return/);

  console.log('sales-reads: all assertions passed');
}

main().catch((e) => { console.error(e); process.exit(1); });
