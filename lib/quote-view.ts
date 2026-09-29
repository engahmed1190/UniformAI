// What the customer may see of an issued quotation, built field by field:
// garments and branding by name, quantities, discount and total. Never item
// codes, descriptions, terms or internal fields.

import type { GarmentType, LogoMethod } from './spec';
import { LOGO_ITEM, MTO_ITEM } from './orders';

type Money = { qty: number; rate: number; amount: number };
export type QuoteLine =
  | ({ kind: 'garment'; garment: GarmentType } & Money)
  | ({ kind: 'branding'; method: LogoMethod } & Money)
  | ({ kind: 'other' } & Money);
export type QuoteView = {
  name: string; validTill: string | null; lines: QuoteLine[]; sets: number; discountPct: number; total: number;
};

const GARMENT = Object.fromEntries(Object.entries(MTO_ITEM).map(([g, code]) => [code, g])) as Record<string, GarmentType>;
const LOGO = Object.fromEntries(Object.entries(LOGO_ITEM).map(([m, code]) => [code, m])) as Record<string, LogoMethod>;
const n = (v: unknown) => Number(v) || 0;

export function toQuoteView(doc: Record<string, unknown>): QuoteView {
  const items = Array.isArray(doc.items) ? doc.items as Record<string, unknown>[] : [];
  const lines: QuoteLine[] = items.map((i) => {
    const money = { qty: n(i.qty), rate: n(i.rate), amount: n(i.amount) || n(i.qty) * n(i.rate) };
    const code = String(i.item_code ?? '');
    if (GARMENT[code]) return { kind: 'garment', garment: GARMENT[code], ...money };
    if (LOGO[code]) return { kind: 'branding', method: LOGO[code], ...money };
    return { kind: 'other', ...money };
  });
  return {
    name: String(doc.name),
    validTill: typeof doc.valid_till === 'string' ? doc.valid_till : null,
    lines,
    sets: lines.find((l) => l.kind === 'garment')?.qty ?? 0,
    discountPct: n(doc.additional_discount_percentage),
    total: n(doc.rounded_total) || n(doc.grand_total),
  };
}
