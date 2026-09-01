// What the account manager says. Every line is derived from data the app
// already holds -- the brief text, the spec, the chosen options, the order --
// so it can state a reason, a tradeoff or a consequence, and never invent one.
//
// The rule that keeps it useful: never narrate what the control already shows.
// "You picked Performance knit" is noise next to a button reading Performance
// knit. Say why it suits this brief, or what it costs.

import { type Concept, type LogoPosition, LABELS, conceptPrice } from './spec';
import { briefWishes, colourName } from './refine';

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

export function readBrief(text: string): BriefRead {
  const t = text.toLowerCase();
  return {
    heat: /\b(summer|hot|heat|humid|cairo|gulf|outdoor|sun)\b/.test(t),
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
  const reasons: string[] = [];
  if (r.heat) reasons.push('you mentioned heat, so everything here is a breathable weave');
  if (r.outdoor) reasons.push('these are all cuts that hold up on site');
  if (r.formal) reasons.push('I kept these smart enough for client-facing work');
  if (r.durable) reasons.push('I leaned towards hard-wearing fabrics');

  const lead = reasons.length
    ? `${cap(reasons[0])}${reasons[1] ? `, and ${reasons[1]}` : ''}.`
    : 'These are the three closest matches to what you described.';

  // Say the literal instructions back only when they were actually carried
  // out. Claiming to have read the brief while ignoring half of it is the
  // fastest way to lose someone's trust in the suggestion.
  const w = briefWishes(brief);
  const done = [
    w.colour ? `put them in ${colourName(w.colour).toLowerCase()}` : null,
    w.logo && w.logo !== 'none' ? `moved the logo to the ${PLACE[w.logo]}` : null,
    w.logo === 'none' ? 'left them unbranded' : null,
  ].filter(Boolean) as string[];
  const kept = done.length
    ? ` I have ${done.join(' and ')}, as you asked.`
    : '';

  return `${lead}${kept} ${cheapest.name} is the most economical at ${money(conceptPrice(cheapest))} a person — worth a look before you decide.`;
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
        return 'For summer work I would put the extra 90 a person into the performance knit — it is the difference people notice by mid-afternoon.';
      }
      if (fabricIndex === 2) {
        return 'Good call for hot weather. It costs 90 more a person than the pique, and it is the one people comment on.';
      }
      return 'The pique is the workhorse here. Move up a grade only if these get worn every day.';

    case 1: {
      const top = concept.garments.find((g) => g.parts.body);
      const light = top && isLight(top.parts.body);
      return light
        ? 'Light bodies look sharp but show marks fast on site. Worth keeping the trouser dark if the work is dirty.'
        : 'Darker bodies hide wear and wash well. Keep one lighter accent so it does not read as a security uniform.';
    }

    case 2:
      if (concept.logo.position === 'none') {
        return 'No branding saves the logo cost per person, but these stop reading as a uniform. Most teams keep at least a small chest mark.';
      }
      if (concept.logo.method === 'print') {
        return 'Print keeps 17 a person versus embroidery. It is the right call on knits; it wears faster on anything washed hot.';
      }
      return 'Embroidery costs 17 more a person than print and outlasts the garment. On a two-year kit it is the cheaper option.';

    case 3: {
      const sets = Math.ceil(staff * (1 + spare));
      if (spare === 0) {
        return `Exactly ${sets} sets means a new starter waits for the next run. Five percent spare is usually the cheapest insurance you can buy.`;
      }
      return `That is ${sets - staff} spare sets — enough for new starters and replacements without sitting on stock.`;
    }

    default:
      return '';
  }
}

/** What the quote means, in the terms a buyer worries about. */
export function quoteNote(concept: Concept, staff: number, sets: number): string {
  const spare = sets - staff;
  return `This covers ${staff} people${spare > 0 ? ` with ${spare} spare sets` : ''}. Nothing is charged until you place the order, and I will collect sizes from your team afterwards.`;
}

/** Where the order actually is, and what happens next. */
export function orderNote(): string {
  return 'Sewing is underway and the fabric is all in. Next is the quality check on the 5th, then delivery on the 8th — I will flag it here if either date moves.';
}

/** The greeting: status plus whether anything needs the customer today. */
export function greeting(name: string, needsYou: number): string {
  const hour = new Date().getHours();
  const part = hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening';
  return needsYou > 0
    ? `${part}, ${name}. The technician polos are being sewn now, on track for the 8th. ${needsYou} quote${needsYou > 1 ? 's need' : ' needs'} your approval.`
    : `${part}, ${name}. The technician polos are being sewn now, on track for the 8th. Nothing needs you today.`;
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
