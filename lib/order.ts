// The sales order a confirmed quote becomes. Built once from what the quote
// screen showed and never recomputed, so the number the buyer approved is
// the number on the order.
// ponytail: one order, kept in localStorage. A list when the demo needs two.

import { type Concept, type GarmentType, type LogoMethod, type LogoPosition, gradeName } from './spec';

/** A line stores what it IS, never a rendered sentence: an order placed in
 *  Arabic and reopened in English has to read in the language on screen, and
 *  a baked-in string cannot. The screen turns these into words. */
export type OrderLine = {
  qty: number;
  /** Set on a garment line. */
  garment?: GarmentType;
  /** The garment's main colour, as the stored hex. */
  colour?: string;
  /** The cloth name: catalogue data, the same in both languages. */
  fabric?: string;
  /** Set on the branding line instead. */
  logo?: LogoMethod;
  position?: LogoPosition;
};

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

/** The same six stages as translation keys, in the same order. Kept beside
 *  STAGES so a stage cannot be added to one list and missed in the other. */
export const STAGE_KEYS = ['ordered', 'sizesIn', 'fabricCut', 'sewing', 'checks', 'delivery'] as const;
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
/** Day-of-year (001-366) then the second within that day, so an id is short,
 *  readable, unique to the second and strictly increasing through the year.
 *  Everything is local-time to match the year in the prefix: mixing local
 *  getFullYear() with UTC arithmetic produced "SO-2027-000-1" on New Year's Eve. */
function seq(d: Date): string {
  const start = new Date(d.getFullYear(), 0, 1).getTime();
  const ms = d.getTime() - start;
  const day = Math.floor(ms / 864e5);
  const secs = Math.floor(ms / 1000) % 86400;
  return `${String(day + 1).padStart(3, '0')}${String(secs).padStart(5, '0')}`;
}

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
    qty: sets,
    garment: g.type,
    colour: g.parts.body ?? g.parts.leg ?? Object.values(g.parts)[0],
    fabric: gradeName(g, grades[i] ?? 0),
  }));
  if (concept.logo.position !== 'none') {
    lines.push({ qty: sets, logo: concept.logo.method, position: concept.logo.position });
  }
  const due = new Date(now);
  due.setDate(due.getDate() + LEAD_DAYS);
  return {
    // Day of the year, then seconds into that day: an ERP-shaped 5-digit
    // sequence that still increases all year. Plain seconds-mod-100000
    // wrapped every ~27 hours and sorted a newer order behind an older one.
    // ponytail: still a stand-in. The ERP hands out the real sequence.
    id: `SO-${now.getFullYear()}-${seq(now)}`,
    name: concept.name,
    concept, staff, sets, perPerson,
    total: perPerson * sets,
    placed: now, due, stage, lines,
  };
}

/** Back from JSON with the two dates as Dates again. */
export const revive = (json: string): Order[] =>
  JSON.parse(json, (k, v) => (k === 'placed' || k === 'due' ? new Date(v) : v));
