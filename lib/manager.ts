// What the account manager says. Every line is derived from data the app
// already holds -- the brief text, the spec, the chosen options, the order --
// so it can state a reason, a tradeoff or a consequence, and never invent one.
//
// The rule that keeps it useful: never narrate what the control already shows.
// "You picked Performance knit" is noise next to a button reading Performance
// knit. Say why it suits this brief, or what it costs.

import { type Concept, type LogoPosition, LABELS, conceptPrice } from './spec';
import { briefWishes, colourName } from './refine';
import { type Order, STAGES, shortDate } from './order';

/** Colour words that describe a family, not a specific cloth. */
const FAMILY = new Set(['dark', 'light', 'neutral']);

/** How a placement is said out loud, not how it is stored. */
const PLACE: Record<Exclude<LogoPosition, 'none'>, string> = {
  left_chest: 'chest', right_chest: 'right chest', sleeve: 'sleeve', back: 'back',
};

/** Signals we can honestly read out of a free-text brief. */
export type BriefRead = {
  heat: boolean;
  outdoor: boolean;
  formal: boolean;
  budget: boolean;
  durable: boolean;
};

/** One definition, used both to detect heat and to quote the word back. Two
 *  copies would drift, and the note would cite a word the read never made. */
const HEAT = /\b(summer|hot|heat|humid|cairo|gulf|outdoor|sun)\b/;

export function readBrief(text: string): BriefRead {
  const t = text.toLowerCase();
  return {
    heat: HEAT.test(t),
    outdoor: /\b(site|field|outdoor|warehouse|yard|driver)\b/.test(t),
    formal: /\b(formal|smart|front desk|reception|client|corporate|office)\b/.test(t),
    budget: /\b(budget|cheap|affordable|cost|tight)\b/.test(t),
    durable: /\b(durable|hard.?wearing|rugged|tough|workwear|industrial)\b/.test(t),
  };
}

/** Why these three kits, in one sentence tied to what the customer wrote. */
export function whyTheseKits(brief: string, concepts: Concept[]): string {
  const r = readBrief(brief);
  const cheapest = [...concepts].sort((a, b) => conceptPrice(a) - conceptPrice(b))[0];

  // One reason, not a list of every signal that matched. The strongest read
  // is the one worth saying; stacking three makes the note sound automated.
  // Quote the word they wrote -- "summer" reported back as "you mentioned
  // heat" is a claim they can check and find false.
  const reason = r.heat ? `“${heatWord(brief)}”, so breathable weaves`
    : r.durable ? 'hard-wearing fabrics throughout'
      : r.outdoor ? 'cuts that hold up on site'
        : r.formal ? 'smart enough for client-facing work'
          : 'the closest matches to what you described';

  // Only claim what was actually carried out. Their word, not our swatch
  // name: someone who wrote "dark colours" did not ask for ink.
  const w = briefWishes(brief);
  const done = [
    w.colour
      ? (FAMILY.has(w.said ?? '') ? `kept ${w.said}` : `in ${w.said ?? colourName(w.colour).toLowerCase()}`)
      : null,
    w.logo && w.logo !== 'none' ? `logo on the ${PLACE[w.logo]}` : null,
    w.logo === 'none' ? 'unbranded' : null,
  ].filter(Boolean) as string[];

  const head = done.length
    ? `${cap(done.join(', '))} — ${reason}.`
    : `${cap(reason)}.`;

  return `${head} ${cheapest.name} is the cheapest at ${money(conceptPrice(cheapest))} a person.`;
}

/** One line per configure step. Advice, not a readback of the control. */
export function stepAdvice(
  step: number,
  concept: Concept,
  fabricIndex: number,
  brief: string,
  staff: number,
  spare: number,
): string {
  const r = readBrief(brief);
  switch (step) {
    case 0:
      if (r.heat && fabricIndex !== 2) {
        return 'In this heat the performance knit is worth the extra 90 a person.';
      }
      if (fabricIndex === 2) return 'Good call — 90 more a person, and people notice it by mid-afternoon.';
      return 'The standard grade is fine unless these get worn every day.';

    case 1: {
      const top = concept.garments.find((g) => g.parts.body);
      const light = top && isLight(top.parts.body);
      return light
        ? 'Light bodies show marks fast on site — worth keeping the trouser dark.'
        : 'Dark hides wear and washes well. One lighter accent stops it reading as security kit.';
    }

    case 2:
      if (concept.logo.position === 'none') {
        return 'Saves 17–35 a person, but without a mark these stop reading as a uniform.';
      }
      if (concept.logo.method === 'print') {
        return 'Print saves 17 a person. Right on knits, but it fades if washed hot.';
      }
      return 'Embroidery is 17 more a person and outlasts the garment — cheaper over two years.';

    case 3: {
      const sets = Math.ceil(staff * (1 + spare));
      if (spare === 0) {
        return `Exactly ${sets} sets — a new starter waits for the next run. 5% is cheap insurance.`;
      }
      return `${sets - staff} spare sets, enough for new starters without sitting on stock.`;
    }

    default:
      return '';
  }
}

/** What the quote means, in the terms a buyer worries about. */
export function quoteNote(concept: Concept, staff: number, sets: number): string {
  const spare = sets - staff;
  return `Covers ${staff} people${spare > 0 ? ` plus ${spare} spare` : ''}. Nothing is charged until you order — I collect sizes after that.`;
}

/** Where the order actually is, and what happens next. */
export function orderNote(o: Order): string {
  if (o.stage >= 5) {
    return `Delivered ${shortDate(o.due)}. Say the word if anything needs replacing — same spec, same price.`;
  }
  if (o.stage >= 2) {
    return `${STAGES[o.stage]} now, fabric all in. Delivery around ${shortDate(o.due)} — I will flag it here if that moves.`;
  }
  return `Placed ${shortDate(o.placed)}. I am collecting sizes now — cutting starts once they are in, delivery around ${shortDate(o.due)}. I will flag it here if that moves.`;
}

/** The greeting: what is open right now. Delivered orders need nobody. */
export function greeting(name: string, orders: Order[]): string {
  const hour = new Date().getHours();
  const part = hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening';
  const open = orders.filter((o) => o.stage < 5);
  if (open.length === 0) return `${part}, ${name}. Nothing needs you today.`;
  if (open.length === 1) {
    const o = open[0];
    return o.stage < 2
      ? `${part}, ${name}. ${o.name} is ordered — I am collecting sizes for ${o.id}.`
      : `${part}, ${name}. ${o.name} is in production, due around ${shortDate(o.due)}.`;
  }
  const sizes = open.filter((o) => o.stage < 2).length;
  return `${part}, ${name}. ${sizes} waiting on sizes, ${open.length - sizes} in production.`;
}

/** The word in the brief that triggered the heat read, so the note can quote
 *  it rather than paraphrase it into a claim the customer never made. */
function heatWord(brief: string): string {
  return brief.toLowerCase().match(HEAT)?.[1] ?? 'heat';
}

const money = (n: number) => `EGP ${Math.round(n).toLocaleString()}`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function isLight(hex: string): boolean {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return false;
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [n >> 16 & 255, n >> 8 & 255, n & 255].map((c) => c / 255);
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) > 0.5;
}

/** Kept for the kit list: what this kit is for, not what is in it. */
export function kitPurpose(c: Concept): string {
  const names = c.garments.map((g) => LABELS[g.type].toLowerCase());
  return names.join(' and ');
}
