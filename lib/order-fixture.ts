// Test-only: an order shaped like the ones /api/orders returns, built from a kit.
import type { Concept, SizePlan } from './spec';
import { type Order, type Workflow, LEAD_DAYS, STEPS, orderLines } from './order';

export function sampleOrder(
  concept: Concept, staff: number, sets: number, grades: number[], perPerson: number,
  now = new Date(), state: Workflow = 'collecting_sizes', sizePlan?: SizePlan,
): Order {
  const due = new Date(now);
  due.setDate(due.getDate() + LEAD_DAYS);
  return {
    id: 'SAL-ORD-2026-00001', name: concept.name, concept, staff, sets, perPerson,
    total: perPerson * sets, estimate: perPerson * sets, sizePlan,
    placed: now, due, state, lines: orderLines(concept, sets, grades),
    dates: Object.fromEntries(STEPS.slice(0, {
      quote_requested: 1, quote_ready: 2, quote_closed: 2, awaiting: 3, collecting_sizes: 4, in_progress: 5, delivered: 6,
    }[state]).map((k) => [k, now])),
    perDelivered: state === 'delivered' ? 100 : 0,
  };
}
