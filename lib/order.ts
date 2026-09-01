// The sales order a confirmed quote becomes. Built once from what the quote
// screen showed and never recomputed, so the number the buyer approved is
// the number on the order.
// ponytail: one order, kept in localStorage. A list when the demo needs two.

import { type Concept, LABELS, gradeName } from './spec';
import { colourName } from './refine';

export type OrderLine = { item: string; note: string; qty: number };

export type Order = {
  id: string;
  name: string;
  concept: Concept;
  staff: number;
  sets: number;
  perPerson: number;
  total: number;
  placed: Date;
  /** Indicative. Real lead time is the ERP's to say. */
  due: Date;
  /** Index into STAGES: where the order is right now. */
  stage: number;
  lines: OrderLine[];
};

/** The production stages every order walks through, and the day each one
 *  falls on, counted from placing. One list, so the timeline, the status
 *  pill and the due date cannot disagree. */
export const STAGES = ['Ordered', 'Sizes in', 'Fabric cut', 'Sewing', 'Checks', 'Delivery'];
const DAY = [0, 4, 10, 14, 18, 21];
const LEAD_DAYS = DAY[DAY.length - 1];

export const stageDate = (o: Order, i: number): Date => {
  const d = new Date(o.placed);
  d.setDate(d.getDate() + DAY[i]);
  return d;
};

export type Status = 'Collecting sizes' | 'In production' | 'Delivered';
export const status = (o: Order): Status =>
  o.stage >= 5 ? 'Delivered' : o.stage >= 2 ? 'In production' : 'Collecting sizes';

/** How far along the making is. Nothing moves until sizes are in. */
export const progress = (o: Order): number => [0, 0, 30, 60, 85, 100][Math.min(o.stage, 5)];

/** "23 Sep". Hand-rolled: en-GB Intl gives "Sept" on newer ICU. */
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const shortDate = (d: Date) => `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]}`;

export function placeOrder(
  concept: Concept,
  staff: number,
  sets: number,
  grades: number[],
  perPerson: number,
  now = new Date(),
  stage = 1,
): Order {
  const lines: OrderLine[] = concept.garments.map((g, i) => ({
    item: `${LABELS[g.type]} · ${colourName(g.parts.body ?? g.parts.leg ?? Object.values(g.parts)[0])}`,
    note: gradeName(g, grades[i] ?? 0),
    qty: sets,
  }));
  if (concept.logo.position !== 'none') {
    lines.push({
      item: `${concept.logo.method === 'print' ? 'Printed' : 'Embroidered'} logo`,
      note: concept.logo.position.replace('_', ' '),
      qty: sets,
    });
  }
  const due = new Date(now);
  due.setDate(due.getDate() + LEAD_DAYS);
  return {
    // ponytail: seconds-of-day as the sequence. The ERP hands out real ones.
    id: `SO-${now.getFullYear()}-${String(Math.floor(now.getTime() / 1000) % 100000).padStart(5, '0')}`,
    name: concept.name,
    concept, staff, sets, perPerson,
    total: perPerson * sets,
    placed: now, due, stage, lines,
  };
}

/** Back from JSON with the two dates as Dates again. */
export const revive = (json: string): Order[] =>
  JSON.parse(json, (k, v) => (k === 'placed' || k === 'due' ? new Date(v) : v));
