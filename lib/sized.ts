// lib/sized.ts
// Made-to-order garments by size, the way ERPNext sells anything with
// variants: one Sales Order line per variant. Quotes and confirmed orders
// carry one UA-MTO-* line per garment because sizes are unknown then; once
// the customer's size run is in, the team replaces each of those lines with
// its colour x cut x size variants through ERPNext's Update Items. Pure, so
// the seed (which makes the variants) and the team script (which uses them)
// share one naming rule.

import {
  type Concept, type Garment, type GarmentCut, type GarmentSize, type GarmentType, type SizeAllocation,
  SIZES, cutsOf,
} from './spec';
import { type Kit, LOGO_ITEM, MTO_ITEM } from './orders';

export const SIZED_PREFIX = 'UA-SIZED-';
export const CUT_ATTRIBUTE = 'Uniform Cut';
export const CUT_VALUE: Record<GarmentCut, string> = { men: 'Men', women: 'Women', unisex: 'Unisex' };
/** The colour a garment is known by (body, else leg), as a Uniform Colour value. */
export const COLOUR_NAMES: Record<string, string> = {
  '#1b2a4a': 'Navy', '#ffffff': 'White', '#2f3640': 'Charcoal',
  '#dfe6ef': 'Pale Blue', '#3d4a3a': 'Olive', '#c8b393': 'Sand',
  '#7a6a4f': 'Khaki', '#6a5c44': 'Khaki',
};

const code = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export const sizedTemplate = (type: GarmentType) => `${SIZED_PREFIX}${code(type)}`;
export const garmentColour = (g: Garment): string | undefined =>
  COLOUR_NAMES[(g.parts.body ?? g.parts.leg ?? Object.values(g.parts)[0] ?? '').toLowerCase()];
export const sizedCode = (type: GarmentType, colour: string, cut: GarmentCut, size: GarmentSize) =>
  `${sizedTemplate(type)}-${code(colour)}-${code(CUT_VALUE[cut])}-${size}`;

export type SizedVariant = {
  item_code: string; template: string; type: GarmentType; colour: string; cut: GarmentCut; size: GarmentSize;
};

/** Every variant the sample concepts can need: each garment's colour, in
 *  each of the concept's cuts, in every size a size run accepts. */
export function sizedVariants(concepts: Concept[]): SizedVariant[] {
  const all = new Map<string, SizedVariant>();
  for (const c of concepts) for (const g of c.garments) {
    const colour = garmentColour(g);
    if (!colour) continue;
    for (const cut of cutsOf(c)) for (const size of SIZES) {
      const item_code = sizedCode(g.type, colour, cut, size);
      all.set(item_code, { item_code, template: sizedTemplate(g.type), type: g.type, colour, cut, size });
    }
  }
  return [...all.values()];
}

/** A Sales Order line as ERPNext returns it: the fields Update Items reads. */
export type SoItem = {
  name: string; item_code: string; qty: number; rate: number;
  uom: string; conversion_factor: number; delivery_date: string; warehouse?: string | null;
};
/** One row of Update Items' trans_items. With docname it keeps that line;
 *  without, it adds one. A line left out is deleted. */
export type TransItem = Omit<SoItem, 'name' | 'warehouse'> & { docname?: string; warehouse?: string };

const MTO = new Set<string>(Object.values(MTO_ITEM));
const LOGO = new Set<string>(Object.values(LOGO_ITEM));

/** The order's lines with each made-to-order garment line replaced by its
 *  size variants: same rate, quantities adding up to the line's. */
export function sizedItems(items: SoItem[], kit: Kit, run: SizeAllocation): TransItem[] {
  if (!items.some((i) => MTO.has(i.item_code))) throw new Error('sizes are already applied');
  // New lines carry no quotation reference; the branding line keeps the link.
  if (!items.some((i) => LOGO.has(i.item_code))) {
    throw new Error('no branding line to keep the quotation link; apply these sizes in the desk');
  }
  const pending = [...kit.concept.garments];
  return items.flatMap((line) => {
    const keep: TransItem = {
      item_code: line.item_code, qty: line.qty, rate: line.rate, uom: line.uom,
      conversion_factor: line.conversion_factor, delivery_date: line.delivery_date,
      ...(line.warehouse ? { warehouse: line.warehouse } : {}),
    };
    if (!MTO.has(line.item_code)) return [{ docname: line.name, ...keep }];
    // Lines pair with garments in order, so a kit with two polos stays two lines.
    const at = pending.findIndex((g) => MTO_ITEM[g.type] === line.item_code);
    if (at < 0) throw new Error(`${line.item_code}: not a garment of this kit`);
    const [garment] = pending.splice(at, 1);
    const colour = garmentColour(garment);
    if (!colour) throw new Error(`${line.item_code}: no Uniform Colour for ${garment.parts.body ?? garment.parts.leg}`);
    const rows = cutsOf(kit.concept).flatMap((cut) => SIZES.flatMap((size) => {
      const qty = run[cut]?.[size] ?? 0;
      return qty > 0 ? [{ ...keep, item_code: sizedCode(garment.type, colour, cut, size), qty }] : [];
    }));
    const total = rows.reduce((n, r) => n + r.qty, 0);
    if (total !== line.qty) throw new Error(`${line.item_code}: the size run has ${total}, the line ${line.qty}`);
    return rows;
  });
}
