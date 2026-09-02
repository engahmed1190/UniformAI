// What the designer proposes without being asked.
//
// A suggestion is a pre-written ask: the same sentence a buyer could have
// typed, parsed by the same refine(), applied by the same submitAsk(). So a
// proposal can never touch the drawing in a way the ask box could not, and
// setPart/setLogo stay the only mutation seam.
//
// Two rules keep this a designer rather than a horoscope:
//   1. Only offer a move that changes something. A card repeating a choice
//      already made is a form control with extra words.
//   2. Every reason cites a signal the app holds and carries a number. We can
//      say what a cloth costs across the run because we compute it; we cannot
//      say a palette "reads sharper", so we never do.

import { type Concept, conceptPriceAt, kitKey } from './spec';
import { type Applied, colourName, refine } from './refine';
import { contrast, isLight, readBrief } from './manager';
import { type Locale, formatCurrency, t } from './i18n';

/** The bare colour word for a sentence. swatchWord() answers "Close to Sand",
 *  which is honest beside a swatch and clumsy inside a sentence. */
function colourWord(locale: Locale, hex: string): string {
  const name = colourName(hex);
  return t(locale, `colours.${/^Close to (.+)$/.exec(name)?.[1] ?? name}`).toLowerCase();
}

export type Suggestion = {
  /** The ask, in the buyer's language. Tapping submits exactly this string. */
  ask: string;
  /** Why, in terms of a number that came from the spec. */
  why: string;
  /** The same proof line the ask box prints, shown before you commit. */
  patch: string;
};

/** A logo this close to the cloth behind it is printed and still unreadable
 *  from a few paces. Below WCAG's 3:1 for graphics, deliberately: uniforms
 *  are read across a room, not held at arm's length. */
const LOGO_MIN_CONTRAST = 2.2;

/** Two at a time. A column of proposals is a form, and the point of this card
 *  is that it says the one thing worth saying. */
const MAX = 2;

/** Three quick asks. They sit on one scrolling line, so a fourth is off the
 *  edge rather than on it. */
const MAX_CHIPS = 3;

/** Did this ask actually move anything? kitKey covers every colour, the logo,
 *  the fits and the cuts; grades and spare live in the page's own state
 *  rather than the spec, so they are compared against what is set now --
 *  "10% spare" offered to a kit already carrying 10% is a button that lies. */
/** kitKey reads an unset logo colour as "", but the renderer draws it white.
 *  Compared raw, "Make the logo white" counts as a change on a kit whose logo
 *  is already white -- a chip that promises something and delivers nothing. */
const asDrawn = (c: Concept): Concept =>
  (c.logo.colour ? c : { ...c, logo: { ...c.logo, colour: '#ffffff' } });

function changesSomething(
  c: Concept, grades: number[], spare: number, a: Applied | null,
): boolean {
  if (!a) return false;
  if (kitKey(asDrawn(a.concept)) !== kitKey(asDrawn(c))) return true;
  if (a.grades?.some((g, i) => g !== (grades[i] ?? 0))) return true;
  return a.spare !== undefined && a.spare !== spare;
}

/** The quick asks, and the step each one belongs to. Every entry is a working
 *  sentence in both languages, not a label: the chip submits this text.
 *
 *  The outfit step has no entries because refine() cannot add or drop a
 *  garment -- that is the one decision the panel makes and the words cannot.
 *  It falls through to the rest of the list rather than showing nothing. */
const CHIPS: { key: string; step: number }[] = [
  { key: 'suggest.askPerformance', step: 1 },
  { key: 'suggest.askTwill', step: 1 },
  { key: 'suggest.askWorsted', step: 1 },
  { key: 'suggest.askStandard', step: 1 },
  { key: 'suggest.askLogoWhite', step: 2 },
  { key: 'suggest.askLogoNavy', step: 2 },
  { key: 'chip.logoSleeve', step: 3 },
  { key: 'chip.logoBack', step: 3 },
  { key: 'chip.logoChest', step: 3 },
  { key: 'chip.embroider', step: 3 },
  { key: 'chip.print', step: 3 },
  { key: 'chip.noLogo', step: 3 },
  { key: 'chip.spare10', step: 4 },
  { key: 'chip.noSpare', step: 4 },
];

/** The quick asks worth offering right now.
 *
 *  These used to be four sentences hardcoded in the dictionary, which meant
 *  the box offered a performance knit to a kit of wovens that cannot be made
 *  in one, and went on offering print to a kit already printed. Same gate as
 *  a proposal: it has to parse, and it has to change something. What the step
 *  does is order them -- the branding words first while you are branding. */
export function quickAsks(
  locale: Locale,
  concept: Concept,
  grades: number[],
  spare: number,
  step: number,
  /** Asks already on screen as proposals, so a chip never echoes a card. */
  exclude: string[] = [],
): string[] {
  const taken = new Set(exclude);
  // Stable sort, so within the step and within the rest the listed order holds.
  const ranked = [...CHIPS].sort(
    (a, b) => Number(b.step === step) - Number(a.step === step));

  const out: string[] = [];
  for (const chip of ranked) {
    if (out.length >= MAX_CHIPS) break;
    const ask = t(locale, chip.key);
    if (taken.has(ask)) continue;
    if (!changesSomething(concept, grades, spare, refine(concept, ask, grades, locale))) continue;
    out.push(ask);
  }
  return out;
}

export function suggestions(
  locale: Locale,
  concept: Concept,
  grades: number[],
  brief: string,
  /** Sets in the run, so a per-person delta can be quoted as real money. */
  sets: number,
  /** Compared against, not proposed: no proposal here touches spare stock. */
  spare = 0,
): Suggestion[] {
  const r = readBrief(brief);
  const out: Suggestion[] = [];
  const priceNow = conceptPriceAt(concept, grades);

  /** Run a candidate through the parser and keep it only if it lands. */
  const offer = (key: string, why: (a: Applied) => string) => {
    if (out.length >= MAX) return;
    const ask = t(locale, key);
    const applied = refine(concept, ask, grades, locale);
    if (!changesSomething(concept, grades, spare, applied)) return;
    out.push({ ask, why: why(applied!), patch: applied!.patch });
  };

  /** The cloth deltas, priced across the whole run rather than per person:
   *  "+90 each" and "+3,780 for the order" land very differently. */
  const clothWhy = (key: string) => (a: Applied) => {
    const delta = Math.abs(conceptPriceAt(concept, a.grades ?? grades) - priceNow);
    return t(locale, key, {
      delta: formatCurrency(locale, delta),
      total: formatCurrency(locale, delta * sets),
      sets,
    });
  };

  // The brief argued for a cloth and the kit is quoted on another. Heat is
  // the strongest read, so it gets first refusal on the two slots.
  if (r.heat) offer('suggest.askPerformance', clothWhy('suggest.whyHeat'));
  if (r.durable || r.outdoor) offer('suggest.askTwill', clothWhy('suggest.whyDurable'));
  if (r.formal) offer('suggest.askWorsted', clothWhy('suggest.whyFormal'));
  if (r.budget) offer('suggest.askStandard', clothWhy('suggest.whyBudget'));

  // A logo nobody can read. The app has both hexes and the luminance maths,
  // so this is the one problem a swatch picker structurally cannot show you:
  // gold on sand looks like two nice colours until they are on one garment.
  const top = concept.garments.find((g) => g.parts.body);
  const logo = concept.logo.colour ?? '#ffffff';
  if (top && concept.logo.position !== 'none'
      && contrast(logo, top.parts.body) < LOGO_MIN_CONTRAST) {
    const dark = isLight(top.parts.body);
    offer(dark ? 'suggest.askLogoNavy' : 'suggest.askLogoWhite', () =>
      t(locale, 'suggest.whyLogo', {
        logo: colourWord(locale, logo),
        body: colourWord(locale, top.parts.body),
      }));
  }

  return out;
}
