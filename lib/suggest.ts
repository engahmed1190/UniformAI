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

/** Did this ask actually move anything? kitKey covers every colour, the logo,
 *  the fits and the cuts; grades and spare live in the page's own state
 *  rather than the spec, so they are compared separately. */
function changesSomething(c: Concept, grades: number[], a: Applied | null): boolean {
  if (!a) return false;
  if (kitKey(a.concept) !== kitKey(c)) return true;
  if (a.grades?.some((g, i) => g !== (grades[i] ?? 0))) return true;
  return a.spare !== undefined;
}

export function suggestions(
  locale: Locale,
  concept: Concept,
  grades: number[],
  brief: string,
  /** Sets in the run, so a per-person delta can be quoted as real money. */
  sets: number,
): Suggestion[] {
  const r = readBrief(brief);
  const out: Suggestion[] = [];
  const priceNow = conceptPriceAt(concept, grades);

  /** Run a candidate through the parser and keep it only if it lands. */
  const offer = (key: string, why: (a: Applied) => string) => {
    if (out.length >= MAX) return;
    const ask = t(locale, key);
    const applied = refine(concept, ask, grades, locale);
    if (!changesSomething(concept, grades, applied)) return;
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
