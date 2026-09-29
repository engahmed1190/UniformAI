// The commercial rules a customer is told, in one place so the page, the
// server and the assistant quote the same numbers.

export const POLICY = { minimumSets: 10, sparePercent: 5 } as const;

export type QuantityPlan = { people: number; sets: number; spareSets: number; moqApplied: boolean };

/** People -> sets: spares rounded up, then raised to the minimum order.
 *  Integer maths, so 40 people is 42 sets and never 43. */
export function plan(people: number): QuantityPlan {
  const wanted = Math.ceil((people * (100 + POLICY.sparePercent)) / 100);
  const sets = Math.max(wanted, POLICY.minimumSets);
  return { people, sets, spareSets: sets - people, moqApplied: wanted < POLICY.minimumSets };
}

/** What the server accepts for a made-to-order request. */
export function acceptsSets(people: number, sets: number): boolean {
  return Number.isInteger(people)
    && people >= 1
    && people <= 500
    && Number.isInteger(sets)
    && sets >= Math.max(people, POLICY.minimumSets)
    && sets <= Math.max(2 * people, POLICY.minimumSets);
}
