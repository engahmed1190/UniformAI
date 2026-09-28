// The sales order a confirmed quote becomes. Built once from what the quote
// screen showed and never recomputed, so the number the buyer approved is
// the number on the order.
// ponytail: one order, kept in localStorage. A list when the demo needs two.

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
  const docs = { requested: o.quote, confirmed: o.salesOrder, delivered: o.deliveryNote } as const;
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

// ponytail: placeOrder is the localStorage stand-in; it goes when orders come from ERPNext.
export function placeOrder(
  concept: Concept,
  staff: number,
  sets: number,
  grades: number[],
  perPerson: number,
  now = new Date(),
  state: Workflow = 'collecting_sizes',
  sizePlan?: SizePlan,
): Order {
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
    total: perPerson * sets, estimate: perPerson * sets, sizePlan,
    placed: now, due, state, lines: orderLines(concept, sets, grades),
    // Only the steps this state has been through, so a sample never shows a
    // step it has not reached.
    dates: Object.fromEntries(STEPS.slice(0, {
      quote_requested: 1, quote_ready: 2, quote_closed: 2, awaiting: 3, collecting_sizes: 4, in_progress: 4, delivered: 5,
    }[state]).map((k) => [k, now])),
    perDelivered: state === 'delivered' ? 100 : 0,
  };
}

/** Back from JSON with the dates as Dates again. Orders stored before the
 *  workflow existed carry a stage number; read them as the state it meant. */
const DATE_KEYS = new Set(['placed', 'due', ...STEPS]);
export const revive = (json: string): Order[] =>
  (JSON.parse(json, (k, v) => (DATE_KEYS.has(k) ? new Date(v) : v)) as (Order & { stage?: number })[]).map((o) => ({
    ...o,
    state: o.state ?? (o.stage! >= 5 ? 'delivered' : o.stage! >= 2 ? 'in_progress' : 'collecting_sizes'),
    dates: o.dates ?? {},
    estimate: o.estimate ?? o.total,
    perDelivered: o.perDelivered ?? 0,
  }));
