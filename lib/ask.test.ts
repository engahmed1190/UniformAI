// Run: npx tsx lib/ask.test.ts
import assert from 'node:assert/strict';
import { AskInputError, checkStock, lastPrice, options, run, variantMatches } from './ask';
import { CONCEPTS } from './concepts';
import { kitEstimate } from './orders';

process.env.ERP_URL = 'http://uniform.localhost:8000';
process.env.ERP_READ_KEY = 'reader:secret';

type RequestSeen = { url: URL; init?: RequestInit };
const seen: RequestSeen[] = [];
let replies: Record<string, unknown>[][] = [];
const originalFetch = globalThis.fetch;

globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  seen.push({ url, init });
  const data = replies.shift() ?? [];
  return new Response(JSON.stringify({ data }), { status: 200 });
}) as typeof fetch;

async function main() {
  // 1. Customer-owned reads carry the fixed customer filter; tool input has no
  // customer field capable of replacing it.
  replies = [[], [], []];
  await run('orders', { customer: 'Delta Hotels' });
  for (const call of seen) {
    assert.ok(JSON.stringify(JSON.parse(call.url.searchParams.get('filters')!)).includes('BrainWise Technology'));
  }
  let filters: unknown[][];

  replies = [[{ name: 'Polo', item_name: 'Polo' }], [{ name: 'POLO-NAVY-XL' }], []];
  await lastPrice({ item: 'Polo', customer: 'Delta Hotels' });
  filters = JSON.parse(seen.at(-1)!.url.searchParams.get('filters')!);
  assert.ok(filters.some((f: unknown[]) => f.join('|') === 'customer|=|BrainWise Technology'));

// 2. Empty stock returns no source chips, even when a matching variant exists.
  replies = [
  [{ name: 'Polo', item_name: 'Polo' }],
  [{ name: 'POLO-NAVY-XL', attributes: [
    { attribute: 'Colour', attribute_value: 'Navy' },
    { attribute: 'Size', attribute_value: 'XL' },
  ] }],
  [],
  ];
  const empty = await checkStock({ item: 'Polo', colour: 'Navy', size: 'XL' });
  assert.equal(empty.rows.length, 0);
  assert.equal(empty.sources.length, 0);

// 3. The orders come from the same reads as the Orders screen: one card per
  // order, the document number, the workflow state key (never a raw ERP
  // status), the due date, and no internal address.
  const kit = { concept: CONCEPTS[0], staff: 40, sets: 42, grades: [], sizePlan: { mode: 'collect_later', allocation: {} } };
  const quoteRow = (name: string, docstatus: number) => ({
    name, party_name: 'BrainWise Technology', status: docstatus ? 'Open' : 'Draft', docstatus,
    transaction_date: '2026-09-01', grand_total: kitEstimate(kit as never), uniformai_kit: JSON.stringify(kit),
  });
  const salesRow = { name: 'SO-1', customer: 'BrainWise Technology', status: 'To Deliver and Bill', docstatus: 1,
    transaction_date: '2026-09-03', delivery_date: '2026-09-24', per_delivered: 0,
    grand_total: 1000, uniformai_kit: JSON.stringify(kit), prevdoc_docname: 'QTN-1' };
  seen.length = 0;
  replies = [[quoteRow('QTN-1', 1), quoteRow('QTN-2', 1)], [salesRow], []];
  const listed = await run('orders', {});
  assert.deepEqual(listed.sources.map((x) => [x.doctype, x.name, x.title, x.detail, x.date]), [
    ['Sales Order', 'SO-1', 'SO-1', 'collecting_sizes', '2026-09-24'],
    ['Quotation', 'QTN-2', 'QTN-2', 'quote_ready', '2026-09-22'],
  ]);
  assert.ok(!JSON.stringify(listed).includes('uniform.localhost'));
  assert.equal(listed.step.tool, 'orders');
  assert.equal(listed.step.rows, 2);

  // 3b. One order by its Quotation or Sales Order number; unknown is empty.
  replies = [[quoteRow('QTN-1', 1)], [salesRow], []];
  const oneOrder = await run('order', { id: 'SO-1' });
  assert.deepEqual(oneOrder.sources.map((x) => x.name), ['SO-1']);
  replies = [[quoteRow('QTN-1', 1)], [salesRow], []];
  assert.equal((await run('order', { id: 'NOPE' })).rows.length, 0);

  // 3c. An unknown intent, or missing/oversized params, is rejected before any read.
  seen.length = 0;
  for (const [intent, params] of [
    ['chat', {}], [undefined, {}], ['order', {}], ['stock', { item: 'Polo' }],
    ['price', { item: 'x'.repeat(200) }], ['orders', []], ['price', null],
  ] as [unknown, unknown][]) {
    await assert.rejects(run(intent, params), AskInputError, `${String(intent)} ${JSON.stringify(params)}`);
  }
  assert.equal(seen.length, 0);

// 4. Both requested attributes must belong to the same variant.
  const variant = { attributes: [
  { attribute: 'Colour', attribute_value: 'Navy' },
  { attribute: 'Size', attribute_value: 'XL' },
  ] };
  assert.equal(variantMatches(variant, 'Navy', 'XL'), true);
  assert.equal(variantMatches(variant, 'Sand', 'XL'), false);
  assert.equal(variantMatches(variant, 'Navy', 'L'), false);

  // Frappe's list endpoint returns child fields as joined, flat rows. The
  // production matcher accepts that shape too.
  assert.equal(variantMatches({ attribute: 'Colour', attribute_value: 'Navy' }, 'Navy'), true);

// 6. options() groups variant attributes per template, sorted and
  // de-duplicated, skipping made-to-order templates and templates without variants.
  replies = [
    [{ name: 'UA-POLO', item_name: 'Polo' }, { name: 'UA-BLAZER', item_name: 'Blazer' },
     { name: 'UA-MTO-POLO', item_name: 'Made Polo' }, { name: 'UA-EMPTY', item_name: 'Empty' }],
    [
      { name: 'P1', variant_of: 'UA-POLO', attribute: 'Uniform Colour', attribute_value: 'Sand' },
      { name: 'P1', variant_of: 'UA-POLO', attribute: 'Uniform Size', attribute_value: 'XL' },
      { name: 'P2', variant_of: 'UA-POLO', attribute: 'Uniform Colour', attribute_value: 'Navy' },
      { name: 'P2', variant_of: 'UA-POLO', attribute: 'Uniform Size', attribute_value: 'M' },
      { name: 'P3', variant_of: 'UA-POLO', attribute: 'Uniform Colour', attribute_value: 'Navy' },
      { name: 'P3', variant_of: 'UA-POLO', attribute: 'Uniform Size', attribute_value: 'S' },
      { name: 'B1', variant_of: 'UA-BLAZER', attribute: 'Uniform Colour', attribute_value: 'Charcoal' },
      { name: 'B1', variant_of: 'UA-BLAZER', attribute: 'Uniform Size', attribute_value: 'L' },
    ],
  ];
  assert.deepEqual(await options(), [
    { item: 'Blazer', colours: ['Charcoal'], sizes: ['L'] },
    { item: 'Polo', colours: ['Navy', 'Sand'], sizes: ['S', 'M', 'XL'] },
  ]);

  // 7. Stock cards speak the customer's language: the item's name rather than
  // its internal code, the warehouse without the company suffix, and the
  // quantity as a number for the change check.
  replies = [
    [{ name: 'Polo', item_name: 'Polo' }],
    [
      { name: 'UA-POLO-NAVY-XL', item_name: 'Polo Navy XL', attribute: 'Colour', attribute_value: 'Navy' },
      { name: 'UA-POLO-NAVY-XL', item_name: 'Polo Navy XL', attribute: 'Size', attribute_value: 'XL' },
    ],
    [{ name: 'bin-hash', item_code: 'UA-POLO-NAVY-XL', warehouse: 'Stores - BT', actual_qty: 260 }],
  ];
  const stock = await checkStock({ item: 'Polo', colour: 'Navy', size: 'XL' });
  assert.equal(stock.sources.length, 1);
  assert.deepEqual(
    [stock.sources[0].title, stock.sources[0].detail, stock.sources[0].qty],
    ['Polo Navy XL', 'Stores', 260],
  );

// 8. The last price is the newest invoice's line for that garment, whether it
  // was billed as a ready-stock variant or made to order; the join returns every
  // line of the invoice, and the answer names the garment, not an item code.
  replies = [
    [{ name: 'Blazer', item_name: 'Blazer' }],
    [{ name: 'UA-BLAZER-NAVY-M' }],
    [
      { name: 'INV-7', posting_date: '2026-08-27', currency: 'EGP', item_code: 'UA-EMBROIDERY', rate: 35, qty: 13 },
      { name: 'INV-7', posting_date: '2026-08-27', currency: 'EGP', item_code: 'UA-MTO-BLAZER', rate: 1480, qty: 13 },
      { name: 'INV-5', posting_date: '2026-06-25', currency: 'EGP', item_code: 'UA-MTO-BLAZER', rate: 1420, qty: 13 },
    ],
  ];
  const price = await run('price', { item: 'Blazer' });
  assert.deepEqual(price.rows, [{ name: 'INV-7', posting_date: '2026-08-27', currency: 'EGP',
    items: [{ item_name: 'Blazer', rate: 1480, qty: 13 }] }]);
  assert.deepEqual([price.sources[0].rate, price.sources[0].detail], [1480, 'Blazer']);
  const codes = JSON.parse(seen.at(-1)!.url.searchParams.get('filters')!).at(-1).at(-1);
  assert.ok(codes.includes('UA-MTO-BLAZER') && codes.includes('UA-BLAZER-NAVY-M'));

// 5. A timeout escapes as an ErpError for the route to turn into a 502.
  globalThis.fetch = (() => Promise.reject(new DOMException('aborted', 'AbortError'))) as typeof fetch;
  await assert.rejects(run('orders', {}), /timed out/);

  globalThis.fetch = originalFetch;
  console.log('ask: all assertions passed');
}

void main();
