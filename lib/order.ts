// The sales order a confirmed quote becomes. Built once from what the quote
// screen showed and never recomputed, so the number the buyer approved is
// the number on the order.

import {
  type Concept, type GarmentType, type LogoMethod, type LogoPosition, type SizePlan, gradeName,
} from './spec';

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

/** Where an order is in ERPNext's sales workflow, read from its documents. */
export type Workflow =
  | 'quote_requested' | 'quote_ready' | 'quote_closed'
  | 'awaiting' | 'collecting_sizes' | 'in_progress' | 'delivered';

/** The five steps of the timeline. A step is reached when its document exists. */
export const STEPS = ['requested', 'issued', 'approved', 'confirmed', 'delivered'] as const;

export type Order = {
  id: string;
  name: string;
  /** Absent when the documents carry no kit JSON (a hand-made ERPNext order). */
  concept?: Concept;
  staff: number;
  sets: number;
  perPerson: number;
  /** The price: the Sales Order's total, else the quotation's. */
  total: number;
  /** What the app estimated from the kit, kept beside a differing quote. */
  estimate: number;
  placed: Date;
  /** The Sales Order's delivery date, else placed + 21 days. */
  due: Date;
  state: Workflow;
  /** Document names, for the timeline. */
  quote?: string;
  salesOrder?: string;
  deliveryNote?: string;
  /** The day each reached step happened. */
  dates: Partial<Record<typeof STEPS[number], Date>>;
  /** ERPNext's per_delivered, 0-100. */
  perDelivered: number;
  sizePlan?: SizePlan;
  lines?: OrderLine[];
};

export const LEAD_DAYS = 21;

export const status = (o: Order): Workflow => o.state;

export type TimelineStep = {
  key: typeof STEPS[number];
  reached: boolean;
  /** The step the order is on: the first not reached. None once it is over. */
  now: boolean;
  /** The document that made the step happen, once it has. */
  doc?: string;
  date?: Date;
  /** Delivery started but is not complete: 1-99. */
  partial?: number;
};

/** What the Orders timeline draws. Delivery is reached only at 100%; a
 *  partial delivery is In progress and says how much has arrived. */
export function timeline(o: Order): TimelineStep[] {
  const done = o.state === 'delivered' || o.perDelivered >= 100;
  const over = done || o.state === 'quote_closed';
  const reached = STEPS.map((k) => (k === 'delivered' ? done : o.dates[k] !== undefined));
  const nowAt = over ? -1 : reached.indexOf(false);
  const docs = { requested: o.quote, issued: o.quote, confirmed: o.salesOrder, delivered: o.deliveryNote } as const;
  return STEPS.map((key, i) => ({
    key,
    reached: reached[i],
    now: i === nowAt,
    doc: reached[i] ? (docs as Partial<Record<string, string>>)[key] : undefined,
    date: reached[i] ? o.dates[key] : undefined,
    partial: key === 'delivered' && !done && o.perDelivered > 0 ? Math.round(o.perDelivered) : undefined,
  }));
}

/** "23 Sep". Hand-rolled: en-GB Intl gives "Sept" on newer ICU. */
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const shortDate = (d: Date) => `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]}`;

/** One line per garment plus the branding line, as the Orders screen lists them. */
export function orderLines(concept: Concept, sets: number, grades: number[]): OrderLine[] {
  const lines: OrderLine[] = concept.garments.map((g, i) => ({
    qty: sets,
    garment: g.type,
    colour: g.parts.body ?? g.parts.leg ?? Object.values(g.parts)[0],
    fabric: gradeName(g, grades[i] ?? 0),
  }));
  if (concept.logo.position !== 'none') {
    lines.push({ qty: sets, logo: concept.logo.method, position: concept.logo.position });
  }
  return lines;
}

/** An order as /api/orders sends it, with the dates as Dates again. */
export function fromJson(o: Order): Order {
  const day = (v: unknown) => new Date(v as string);
  return {
    ...o,
    placed: day(o.placed),
    due: day(o.due),
    dates: Object.fromEntries(Object.entries(o.dates ?? {}).map(([k, v]) => [k, day(v)])),
  };
}
