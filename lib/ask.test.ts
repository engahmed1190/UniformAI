// Run: npx tsx lib/ask.test.ts
import assert from 'node:assert/strict';
import { checkStock, executeTool, findOrders, lastPrice, variantMatches } from './ask';

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
  replies = [[]];
  await findOrders({ customer: 'Delta Hotels' });
  let filters = JSON.parse(seen.at(-1)!.url.searchParams.get('filters')!);
  assert.deepEqual(filters[0], ['customer', '=', 'BrainWise Technology']);

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

// 3. The customer never receives an internal ERP address.
  replies = [[{ name: 'SO-9', status: 'To Deliver' }]];
  const linkless = await findOrders({});
  assert.ok(!JSON.stringify(linkless.sources).includes('uniform.localhost'));

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

// 6. The list API returns one row per item line. Asking for one order must
  // keep every line, and the limit counts orders, not lines.
  replies = [[
    { name: 'SO-1', status: 'To Deliver', item_name: 'Polo', qty: 25 },
    { name: 'SO-1', status: 'To Deliver', item_name: 'Cargo', qty: 25 },
    { name: 'SO-1', status: 'To Deliver', item_name: 'Embroidery', qty: 25 },
  ]];
  const one = await findOrders({ order_id: 'SO-1' });
  assert.equal(one.rows.length, 1);
  assert.equal((one.rows[0].items as unknown[]).length, 3);
  assert.ok(Number(seen.at(-1)!.url.searchParams.get('limit_page_length')) >= 50);
  assert.deepEqual(one.sources.map((x) => [x.title, x.detail]), [['SO-1', 'To Deliver']]);

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
  const stock = await checkStock({ item: 'بولو', colour: 'Navy', size: 'XL' });
  assert.equal(stock.sources.length, 1);
  assert.deepEqual(
    [stock.sources[0].title, stock.sources[0].detail, stock.sources[0].qty],
    ['Polo Navy XL', 'Stores', 260],
  );

// 5. A timeout becomes a tool error result instead of escaping to the route.
  globalThis.fetch = (() => Promise.reject(new DOMException('aborted', 'AbortError'))) as typeof fetch;
  const failed = await executeTool('find_orders', {});
  assert.match(failed.error ?? '', /timed out/);
  assert.equal(failed.result, undefined);

  globalThis.fetch = originalFetch;
  console.log('ask: all assertions passed');
}

void main();
