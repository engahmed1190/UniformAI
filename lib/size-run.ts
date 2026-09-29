// lib/size-run.ts
// The size breakdown a customer sends for a confirmed order. Pure, so the
// dock's form and the server share one rule.

import { type Concept, type GarmentCut, type GarmentSize, type SizeAllocation, SIZES } from './spec';

export const cutsOf = (concept?: Concept): GarmentCut[] =>
  concept?.cuts?.length ? concept.cuts : ['men', 'women'];

export const runTotal = (run: SizeAllocation): number =>
  Object.values(run).reduce((n, sizes) => n + Object.values(sizes ?? {}).reduce((m, v) => m + (v ?? 0), 0), 0);

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Only the order's cuts and known sizes, whole counts, adding up to the
 *  order's sets. Anything else is null. */
export function parseRun(input: unknown, cuts: GarmentCut[], sets: number): SizeAllocation | null {
  if (!isObject(input)) return null;
  const run: SizeAllocation = {};
  for (const [cut, sizes] of Object.entries(input)) {
    if (!cuts.includes(cut as GarmentCut) || !isObject(sizes)) return null;
    const clean: Partial<Record<GarmentSize, number>> = {};
    for (const [size, n] of Object.entries(sizes)) {
      if (!(SIZES as string[]).includes(size) || !Number.isInteger(n) || (n as number) < 0) return null;
      if (n) clean[size as GarmentSize] = n as number;
    }
    run[cut as GarmentCut] = clean;
  }
  return runTotal(run) === sets ? run : null;
}

/** An even starting point over S to XL of each cut, any remainder to M,
 *  then L, so the customer adjusts rather than taps from zero. */
export function proposedSplit(cuts: GarmentCut[], sets: number): SizeAllocation {
  const order: GarmentSize[] = ['M', 'L', 'S', 'XL'];
  const run: SizeAllocation = {};
  cuts.forEach((cut, i) => {
    const share = Math.floor(sets / cuts.length) + (i < sets % cuts.length ? 1 : 0);
    run[cut] = Object.fromEntries(order.map((z, j) => [z, Math.floor(share / 4) + (j < share % 4 ? 1 : 0)]));
  });
  return run;
}
