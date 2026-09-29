// The sales workflow's documents, as the app sees them. Pure: no fetch, so
// both the seed script and the server routes share one set of rules, and
// the totals ERPNext holds come from the same arithmetic as the quote.

import {
  type Concept, type GarmentCut, type GarmentType, type LogoMethod, type SizePlan,
  LOGO_PRICE, allocatedSizeCount, conceptPriceAt, gradeName, gradesFor,
} from './spec';
import { cutsOf } from './size-run';
import { colourName } from './refine';
import { type Order, type Workflow, LEAD_DAYS, orderLines } from './order';

export type Kit = { concept: Concept; staff: number; sets: number; grades: number[]; sizePlan: SizePlan };
export type DocLine = { item_code: string; qty: number; rate: number; description: string };

export const MTO_ITEM: Record<GarmentType, string> = {
  polo: 'UA-MTO-POLO', cargo: 'UA-MTO-CARGO', shirt: 'UA-MTO-SHIRT',
  chino: 'UA-MTO-CHINO', blazer: 'UA-MTO-BLAZER',
};
export const LOGO_ITEM: Record<LogoMethod, string> = { embroidery: 'UA-EMBROIDERY', print: 'UA-PRINT' };

export const kitEstimate = (kit: Kit) => conceptPriceAt(kit.concept, kit.grades) * kit.sets;

/** One made-to-order line per garment and one logo line. The description is
 *  what UniformAI's team reads when reviewing the quotation in ERPNext. */
export function kitLines(kit: Kit): DocLine[] {
  const lines = kit.concept.garments.map((g, i) => {
    const grade = kit.grades[i] ?? 0;
    const colours = Object.entries(g.parts).map(([part, hex]) => `${colourName(hex)} ${part}`).join(', ');
    return {
      item_code: MTO_ITEM[g.type],
      qty: kit.sets,
      rate: g.unitPrice + (gradesFor(g.type)[grade]?.delta ?? 0),
      description: `${colours} · ${gradeName(g, grade)} · ${g.fit} fit`,
    };
  });
  const { logo } = kit.concept;
  if (logo.position !== 'none') {
    lines.push({
      item_code: LOGO_ITEM[logo.method], qty: kit.sets, rate: LOGO_PRICE[logo.method],
      description: `${logo.method} logo, ${logo.position.replace('_', ' ')}`,
    });
  }
  return lines;
}

// The list-API fields of each document. Dates are 'YYYY-MM-DD'; the kit is
// the JSON the app stored on the document, if it made it.
export type QuoteRow = {
  name: string; party_name: string; status: string; docstatus: number; transaction_date: string;
  valid_till?: string | null; grand_total: number; uniformai_kit?: string | null; uniformai_ref?: string | null;
};
export type SalesOrderRow = {
  name: string; customer: string; status: string; docstatus: number; transaction_date: string;
  delivery_date?: string | null; per_delivered: number; grand_total: number;
  uniformai_kit?: string | null; uniformai_ref?: string | null;
  /** The Quotation it was made from. */
  quotation?: string | null;
};
export type DeliveryRow = { name: string; posting_date: string; docstatus: number; against_sales_order: string };

// Midday local, so the day reads the same in any timezone.
const day = (d: string) => new Date(`${d}T10:00:00`);

/** A document without kit JSON (hand-made in ERPNext), or with broken JSON,
 *  is simply an order we know less about. */
function parseKit(json?: string | null): Kit | undefined {
  if (!json) return undefined;
  try {
    const k = JSON.parse(json) as Kit;
    if (!k?.concept || !Array.isArray(k.concept.garments)) return undefined;
    // Parseable is not usable: run everything downstream reads, so a kit of
    // the wrong shape is no kit instead of a throw that hides every order.
    if (!Number.isFinite(k.sets) || !Number.isFinite(k.staff)) return undefined;
    kitEstimate(k); orderLines(k.concept, k.sets, k.grades); sizesComplete(k);
    return k;
  } catch { return undefined; }
}

const sizesComplete = (kit?: Kit) => {
  if (!kit || kit.sizePlan?.mode !== 'allocate_now') return false;
  return allocatedSizeCount(kit.sizePlan.allocation, cutsOf(kit.concept)) === kit.sets;
};

/** Each Sales Order, and each Quotation still waiting for one, becomes an
 *  order, newest first. Cancelled documents and draft Delivery Notes are
 *  not part of the story. */
export function toOrders(
  quotes: QuoteRow[], orders: SalesOrderRow[], deliveries: DeliveryRow[],
  /** Sales Orders with a size run on record: their sizes are complete. */
  sized: ReadonlySet<string> = new Set(),
): Order[] {
  const liveQuotes = quotes.filter((q) => q.docstatus !== 2);
  const liveOrders = orders.filter((o) => o.docstatus !== 2);
  const submitted = deliveries.filter((d) => d.docstatus === 1);
  const quoteOf = (name?: string | null) => liveQuotes.find((q) => q.name === name);
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const made = new Set(liveOrders.map((o) => o.quotation));

  const build = (q?: QuoteRow, o?: SalesOrderRow): Order => {
    const kit = parseKit(o?.uniformai_kit) ?? parseKit(q?.uniformai_kit);
    const notes = o ? submitted.filter((d) => d.against_sales_order === o.name) : [];
    const last = notes.reduce<DeliveryRow | undefined>(
      (a, d) => (!a || d.posting_date >= a.posting_date ? d : a), undefined);
    const perDelivered = o?.per_delivered ?? 0;

    let state: Workflow;
    if (o) {
      state = o.docstatus === 0 ? 'awaiting'
        : perDelivered >= 100 ? 'delivered'
        : sizesComplete(kit) || sized.has(o.name) ? 'in_progress' : 'collecting_sizes';
    } else {
      state = q!.docstatus === 0 ? 'quote_requested'
        : q!.status === 'Lost' || q!.status === 'Expired' || (q!.valid_till && q!.valid_till < today) ? 'quote_closed'
        : 'quote_ready';
    }

    // ERPNext has no "submitted at" field, so a step takes the date of its document.
    const dates: Order['dates'] = {};
    if (q) {
      dates.requested = day(q.transaction_date);
      if (q.docstatus === 1) dates.issued = day(q.transaction_date);
    }
    if (o) {
      dates.approved = day(o.transaction_date);
      if (o.docstatus === 1) dates.confirmed = day(o.transaction_date);
    }
    if (last) dates.delivered = day(last.posting_date);

    const placed = day((q ?? o!).transaction_date);
    const due = o?.delivery_date ? day(o.delivery_date) : new Date(placed.getTime());
    if (!o?.delivery_date) due.setDate(due.getDate() + LEAD_DAYS);
    const total = o ? o.grand_total : q!.grand_total;

    return {
      id: (o ?? q!).name,
      name: kit?.concept.name ?? (o ?? q!).name,
      concept: kit?.concept,
      staff: kit?.staff ?? 0,
      sets: kit?.sets ?? 0,
      perPerson: kit?.staff ? total / kit.staff : 0,
      total,
      estimate: kit ? kitEstimate(kit) : total,
      placed, due, state, dates, perDelivered,
      quote: q?.name, salesOrder: o?.name, deliveryNote: last?.name,
      sizePlan: kit?.sizePlan,
      lines: kit ? orderLines(kit.concept, kit.sets, kit.grades) : undefined,
    };
  };

  return [
    ...liveOrders.map((o) => build(quoteOf(o.quotation), o)),
    ...liveQuotes.filter((q) => !made.has(q.name)).map((q) => build(q)),
  ].sort((a, b) => b.placed.getTime() - a.placed.getTime() || (a.id < b.id ? 1 : -1));
}
