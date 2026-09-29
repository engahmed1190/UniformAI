// lib/sales-writes.test.ts
// Run: npx tsx lib/sales-writes.test.ts
import assert from 'node:assert/strict';
import { CONCEPTS } from './concepts';
import { mockErp } from './fetch-mock';
import { openCase, sendSizes } from './sales';
import { parseRun, proposedSplit, runTotal } from './size-run';

const kit = { concept: CONCEPTS[0], staff: 10, sets: 11, grades: [], sizePlan: { mode: 'collect_later', allocation: {} } };
const QTN = { name: 'SAL-QTN-1', party_name: 'BrainWise Technology', status: 'Ordered', docstatus: 1,
  transaction_date: '2026-09-20', grand_total: 7150, uniformai_kit: JSON.stringify(kit) };
const SO = { name: 'SAL-ORD-1', customer: 'BrainWise Technology', status: 'To Deliver and Bill', docstatus: 1,
  transaction_date: '2026-09-21', delivery_date: '2026-10-12', per_delivered: 0, grand_total: 7150,
  uniformai_kit: JSON.stringify(kit), prevdoc_docname: 'SAL-QTN-1' };
const auth = (init?: RequestInit) => (init?.headers as Record<string, string>).Authorization;

/** The order chain, plus whatever the size-run and Issue endpoints do. */
function erp(extra: Record<string, (s: { init?: RequestInit }) => unknown> = {}) {
  let stored: { sales_order: string; allocation: string } | undefined;
  return mockErp({
    '/api/resource/Quotation': () => ({ data: [QTN] }),
    '/api/resource/Sales Order': () => ({ data: [SO] }),
    '/api/resource/Delivery Note': () => ({ data: [] }),
    '/api/resource/UniformAI Size Run': (s) => {
      if (s.init?.method === 'POST') {
        stored = { sales_order: 'SAL-ORD-1', allocation: JSON.parse(String(s.init.body)).allocation };
        return { data: { name: 'SIZE-RUN-00001' } };
      }
      return { data: stored ? [stored] : [] };
    },
    ...extra,
  });
}

async function main() {
  // 1. Pure helpers.
  const split = proposedSplit(['men', 'women'], 26);
  assert.equal(runTotal(split), 26);
  assert.deepEqual(split.men, { M: 4, L: 3, S: 3, XL: 3 });
  assert.deepEqual(parseRun(split, ['men', 'women'], 26), split);
  assert.equal(parseRun(split, ['men', 'women'], 25), null, 'must add up to the order');
  assert.equal(parseRun({ kids: { M: 26 } }, ['men', 'women'], 26), null, 'unknown cut');
  assert.equal(parseRun({ men: { M: 2.5 } }, ['men'], 2.5), null, 'whole sets only');
  assert.equal(parseRun({ men: { XXL: 26 } }, ['men'], 26), null, 'unknown size');

  // 2. A run that does not add up is refused before anything is written.
  let x = erp();
  await assert.rejects(sendSizes('SAL-ORD-1', { men: { M: 5 }, women: { M: 5 } }), { status: 400 });
  assert.equal(x.posts().length, 0);

  // 3. Not the customer's order.
  x = erp();
  await assert.rejects(sendSizes('SAL-ORD-9', proposedSplit(['men', 'women'], 11)), { status: 404 });
  assert.equal(x.posts().length, 0);

  // 4. A complete run is recorded with the Portal key and the order moves on.
  x = erp();
  const order = await sendSizes('SAL-ORD-1', proposedSplit(['men', 'women'], 11));
  const [post] = x.posts();
  assert.equal(auth(post.init), 'token portal:secret');
  const body = JSON.parse(String(post.init!.body));
  assert.equal(body.sales_order, 'SAL-ORD-1');
  assert.equal(runTotal(JSON.parse(body.allocation)), 11);
  assert.equal(order.state, 'in_progress');

  // 5. Once sizes are in, a second run is refused.
  await assert.rejects(sendSizes('SAL-ORD-1', proposedSplit(['men', 'women'], 11)), { status: 409 });

  // 6. Contact: bad topic, someone else's document, then a real case.
  const issue = { '/api/resource/Issue': () => ({ data: { name: 'CASE-2026-00001' } }) };
  x = erp(issue);
  await assert.rejects(openCase({ topic: 'gossip' }), { status: 400 });
  await assert.rejects(openCase({ topic: 'order', document: 'SAL-ORD-9' }), { status: 404 });
  assert.equal(x.posts().length, 0);
  assert.deepEqual(await openCase({ topic: 'order', document: 'SAL-ORD-1' }), { name: 'CASE-2026-00001' });
  const caseDoc = JSON.parse(String(x.posts()[0].init!.body));
  assert.equal(caseDoc.customer, 'BrainWise Technology');
  assert.equal(caseDoc.raised_by, 'ahmed.osama@brainwise.example');
  assert.equal(caseDoc.via_customer_portal, 0);
  assert.match(caseDoc.subject, /^\[UniformAI assistant\]/);
  assert.match(caseDoc.subject, /SAL-ORD-1/);
  assert.deepEqual(await openCase({ topic: 'general' }), { name: 'CASE-2026-00001' });

  // 7. Same tick: the second call is refused while the first insert is open.
  let release!: () => void;
  const held = new Promise<void>((r) => { release = r; });
  x = erp({
    '/api/resource/UniformAI Size Run': (s) => {
      if (s.init?.method !== 'POST') return { data: [] };
      return held.then(() => new Response(JSON.stringify({ data: { name: 'SIZE-RUN-00002' } })));
    },
  });
  const run11 = proposedSplit(['men', 'women'], 11);
  const first = sendSizes('SAL-ORD-1', run11);
  const second = sendSizes('SAL-ORD-1', run11);
  try {
    await assert.rejects(second, { status: 409 });
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(x.posts().length, 1);
  } finally {
    release();
  }
  await first;
  assert.equal(x.posts().length, 1);

  console.log('sales-writes: all assertions passed');
}

main().catch((e) => { console.error(e); process.exit(1); });
