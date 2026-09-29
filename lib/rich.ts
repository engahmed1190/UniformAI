// lib/rich.ts
// Document numbers and amounts inside a sentence, found so the dock can keep
// each one whole on one line (and isolated in Arabic).

const CODE = /(?:SAL-QTN|SAL-ORD|ACC-SINV|MAT-DN|CASE)-\d{4}-\d{3,6}|EGP \d{1,3}(?:,\d{3})*(?:\.\d+)?/g;

export type Piece = { text: string; code: boolean };

export function splitCodes(text: string): Piece[] {
  const out: Piece[] = [];
  let at = 0;
  for (const m of text.matchAll(CODE)) {
    const start = m.index ?? 0;
    if (start > at) out.push({ text: text.slice(at, start), code: false });
    out.push({ text: m[0], code: true });
    at = start + m[0].length;
  }
  if (at < text.length) out.push({ text: text.slice(at), code: false });
  return out;
}
