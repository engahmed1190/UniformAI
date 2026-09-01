// Turning a plain-words request into a patch against the spec -- never into
// free-form drawing. That is the whole safety property: "make the trouser
// navy" can only ever reach setPart(c, i, 'leg', hex).
//
// ponytail: keyword match stands in for the model call. Swap parse() for an
// API that returns the same Patch shape; setPart/setLogo stay the seam.

import {
  type Concept, type LogoMethod, type LogoPosition,
  PARTS, setLogo, setPart,
} from './spec';
import { isTop } from '../components/garments';

export const SWATCHES: [hex: string, name: string][] = [
  ['#1b2a4a', 'Navy'],
  ['#12161f', 'Ink'],
  ['#d6c19c', 'Sand'],
  ['#8f9aa6', 'Slate'],
  ['#ffffff', 'White'],
  ['#3d4a3a', 'Olive'],
  ['#7d2b2b', 'Oxblood'],
  ['#c8a24a', 'Brass'],
];

/** A name people say out loud. Falls back to the nearest swatch rather than
 *  showing a raw hex, which means nothing to someone ordering uniforms. */
export function colourName(hex: string): string {
  const exact = SWATCHES.find(([h]) => h.toLowerCase() === hex.toLowerCase());
  if (exact) return exact[1];
  const rgb = (h: string) => {
    const n = parseInt(h.replace('#', ''), 16);
    return [n >> 16 & 255, n >> 8 & 255, n & 255];
  };
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  const [r, g, b] = rgb(hex);
  let best = SWATCHES[0];
  let bestD = Infinity;
  for (const sw of SWATCHES) {
    const [r2, g2, b2] = rgb(sw[0]);
    const d = (r - r2) ** 2 + (g - g2) ** 2 + (b - b2) ** 2;
    if (d < bestD) { bestD = d; best = sw; }
  }
  return `Close to ${best[1]}`;
}

const WORDS: Record<string, string> = {
  navy: '#1b2a4a', ink: '#12161f', black: '#12161f', charcoal: '#12161f',
  sand: '#d6c19c', beige: '#d6c19c', tan: '#d6c19c', cream: '#d6c19c',
  slate: '#8f9aa6', grey: '#8f9aa6', gray: '#8f9aa6',
  white: '#ffffff', olive: '#3d4a3a', green: '#3d4a3a',
  oxblood: '#7d2b2b', burgundy: '#7d2b2b', maroon: '#7d2b2b',
  brass: '#c8a24a', gold: '#c8a24a',
};

/** Applied edit, plus the patch line shown to the user as proof. */
export type Applied = { concept: Concept; note: string; patch: string };

const TOP_WORDS = /\b(shirt|polo|top|blazer|jacket|body)\b/;
const LEG_WORDS = /\b(trouser|trousers|chino|chinos|pant|pants|cargo|leg|legs|bottom)\b/;

/** Which garment a request is about. Falls back to the logo-bearing top. */
function pickGarment(c: Concept, text: string): number {
  if (LEG_WORDS.test(text)) {
    const i = c.garments.findIndex((g) => !isTop(g.type));
    if (i >= 0) return i;
  }
  if (/blazer|jacket/.test(text)) {
    const i = c.garments.findIndex((g) => g.type === 'blazer');
    if (i >= 0) return i;
  }
  if (TOP_WORDS.test(text)) {
    const i = c.garments.findIndex((g) => isTop(g.type));
    if (i >= 0) return i;
  }
  return c.garments.findIndex((g) => isTop(g.type));
}

/** Which region of that garment. 'collar'/'cuffs'/'buttons' are named
 *  explicitly; everything else lands on the garment's main surface. */
function pickPart(c: Concept, gi: number, text: string): string | null {
  const parts = PARTS[c.garments[gi].type];
  const named = parts.find((p) => new RegExp(`\\b${p}\\b`).test(text));
  if (named) return named;
  return parts.includes('body') ? 'body' : parts.includes('leg') ? 'leg' : parts[0] ?? null;
}

export function refine(concept: Concept, request: string): Applied | null {
  const t = request.toLowerCase().trim();
  if (!t) return null;

  // Logo placement and method come first: they are unambiguous.
  const pos: [RegExp, LogoPosition][] = [
    [/\bsleeve\b/, 'sleeve'],
    [/\bleft chest\b|\bchest\b/, 'left_chest'],
    [/\bright chest\b/, 'right_chest'],
    [/\bback\b/, 'back'],
  ];
  if (/\b(no logo|remove the logo|without a logo|drop the logo)\b/.test(t)) {
    return {
      concept: setLogo(concept, { position: 'none' }),
      note: 'Dropped the logo. The branding line comes off the price.',
      patch: 'logo.position = none',
    };
  }
  if (/\b(logo|badge|branding|embroider|print)\b/.test(t)) {
    const method: LogoMethod | null = /\bprint\b/.test(t)
      ? 'print'
      : /\bembroider/.test(t)
        ? 'embroidery'
        : null;
    const hit = pos.find(([re]) => re.test(t));
    if (method || hit) {
      const next = setLogo(concept, {
        ...(method ? { method } : {}),
        ...(hit ? { position: hit[1] } : {}),
      });
      const bits = [
        hit ? `logo.position = ${hit[1]}` : null,
        method ? `logo.method = ${method}` : null,
      ].filter(Boolean);
      return {
        concept: next,
        note: 'Updated the branding. The drawing and the price both follow.',
        patch: bits.join('\n'),
      };
    }
  }

  // Colour requests.
  const word = Object.keys(WORDS).find((w) => new RegExp(`\\b${w}\\b`).test(t));
  const hex = word ? WORDS[word] : /^#[0-9a-f]{6}$/i.test(t) ? t : null;
  if (hex) {
    const gi = pickGarment(concept, t);
    if (gi < 0) return null;
    const part = pickPart(concept, gi, t);
    if (!part) return null;
    const g = concept.garments[gi];
    return {
      concept: setPart(concept, gi, part, hex),
      note: `Set the ${g.type} ${part} to ${colourName(hex)}.`,
      patch: `${g.type}.parts.${part} = ${hex}`,
    };
  }

  return null;
}
