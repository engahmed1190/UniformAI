// The sales workflow's documents, as the app sees them. Pure: no fetch, so
// both the seed script and the server routes share one set of rules, and
// the totals ERPNext holds come from the same arithmetic as the quote.

import {
  type Concept, type GarmentType, type LogoMethod, type SizePlan,
  LOGO_PRICE, conceptPriceAt, gradeName, gradesFor,
} from './spec';
import { colourName } from './refine';

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
