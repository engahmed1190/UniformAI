// What the assistant shows as proof, shared by the server that reads the ERP
// and the dock that renders it. The dock faces a UniformAI customer, who has
// never heard of the ERP behind it: records carry what the customer would
// recognise, and no internal address ever reaches the browser. Kept apart
// from lib/ask.ts so the browser bundle never pulls in the ERP client.

/** One ERP record a read returned this turn. The dock renders one card each. */
export type Source = {
  doctype: string;
  /** The ERP document name, used for de-duplication and the change check. */
  name: string;
  /** What the customer recognises: the order number, or the item's name. */
  title: string;
  /** The one fact the card leads with: a status, a warehouse, an item. */
  detail: string;
  date?: string;
  qty?: number;
  rate?: number;
  currency?: string;
  readAt: string;
};

export type Step = {
  id: string;
  tool: string;
  input: Record<string, unknown>;
  state: 'running' | 'done' | 'error';
  rows?: number;
  ms?: number;
};

export type Change = { field: 'qty' | 'detail' | 'date' | 'rate'; from: string | number; to: string | number };

/** Order cards and "Details of" buttons shown for one answer. */
export const MAX_CARDS = 10;

export const sourceKey = (s: Source) => `${s.doctype}:${s.name}`;

const FIELDS = ['qty', 'detail', 'date', 'rate'] as const;

/** What moved in ERPNext since the dock last showed each record. This is the
 *  live-change moment of the demo: the same question, asked again after an
 *  edit in ERPNext, shows 260 → 40 instead of just a different number. */
export function changesSince(seen: Map<string, Source>, next: Source[]): Map<string, Change[]> {
  const out = new Map<string, Change[]>();
  for (const s of next) {
    const before = seen.get(sourceKey(s));
    if (!before) continue;
    const changes = FIELDS
      .filter((f) => before[f] !== undefined && s[f] !== undefined && before[f] !== s[f])
      .map((f) => ({ field: f, from: before[f]!, to: s[f]! }));
    if (changes.length) out.set(sourceKey(s), changes);
  }
  return out;
}

export function remember(seen: Map<string, Source>, next: Source[]): void {
  for (const s of next) seen.set(sourceKey(s), s);
}
