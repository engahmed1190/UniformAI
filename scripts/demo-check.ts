// scripts/demo-check.ts
import assert from 'node:assert/strict';

const BASE = process.env.DEMO_URL ?? 'http://127.0.0.1:3100';

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, init);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

type Order = { state: string };
type Invoice = { status: string };

async function main() {
  const health = await json<{ ok: boolean }>('/api/ask');
  assert.equal(health.ok, true, 'ERP records must be reachable');
  const orders = await json<Order[]>('/api/orders');
  const count = (state: string) => orders.filter((order) => order.state === state).length;
  assert.equal(orders.length, 11, 'expected the 11 clean seeded order chains; run seed:erp -- --reset');
  assert.equal(count('quote_requested'), 1, 'one draft quotation');
  assert.equal(count('quote_ready'), 1, 'one issued quotation ready for review');
  assert.equal(count('collecting_sizes'), 1, 'one confirmed order waiting for sizes');
  assert.equal(count('in_progress'), 1, 'one partially delivered order in progress');
  assert.equal(count('delivered'), 7, 'seven delivered history orders');

  const invoices = await json<Invoice[]>('/api/invoices');
  assert.equal(invoices.filter((row) => row.status === 'paid').length, 5, 'five paid history invoices');
  assert.equal(invoices.filter((row) => row.status === 'overdue').length, 1, 'one overdue history invoice');
  // Accepted for this demo window: hist-07 becomes overdue after 2026-10-23.
  assert.equal(invoices.filter((row) => row.status === 'unpaid').length, 1, 'one unpaid history invoice');

  const stock = await json<{ rows: unknown[] }>('/api/ask', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ intent: 'stock', params: { item: 'Polo', colour: 'Navy', size: 'XL' } }),
  });
  assert.match(JSON.stringify(stock.rows), /260/, 'Navy Polo XL must have 260 in Stores');
  console.log('demo: ready');
}

main().catch((error) => {
  console.error(`demo: not ready: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
