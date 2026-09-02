// What the account manager says. Every line is derived from data the app
// already holds -- the brief text, the spec, the chosen options, the order --
// so it can state a reason, a tradeoff or a consequence, and never invent one.
//
// The rule that keeps it useful: never narrate what the control already shows.
// "You picked Performance knit" is noise next to a button reading Performance
// knit. Say why it suits this brief, or what it costs.

import { type Concept, type LogoPosition, type SizingMode, conceptPrice } from './spec';
import { briefWishes, swatchWord } from './refine';
import { type Order, STAGE_KEYS } from './order';
import { type Locale, formatCurrency, formatDate, kitName, spareMessage, t } from './i18n';

/** Colour words that describe a family, not a specific cloth. */
const FAMILY = new Set(['dark', 'light', 'neutral']);

/** How a placement is said out loud, not how it is stored. */
const PLACE: Record<Exclude<LogoPosition, 'none'>, string> = {
  left_chest: 'manager.placeChest', right_chest: 'manager.placeRightChest',
  sleeve: 'manager.placeSleeve', back: 'manager.placeBack',
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
// Arabic has no word boundary \b that works the way it does in Latin script,
// so the Arabic alternatives match as substrings. Both scripts are read from
// one brief: a customer may well type a mix.
const HEAT = /\b(summer|hot|heat|humid|cairo|gulf|outdoor|sun)\b|صيف|حر|حرارة|رطوبة|القاهرة|شمس|خارجي/;

export function readBrief(text: string): BriefRead {
  const s = text.toLowerCase();
  return {
    heat: HEAT.test(s),
    outdoor: /\b(site|field|outdoor|warehouse|yard|driver)\b/.test(s)
      || /موقع|مواقع|ميدان|مستودع|مخزن|ساحة|سائق|خارجي/.test(s),
    formal: /\b(formal|smart|front desk|reception|client|corporate|office)\b/.test(s)
      || /رسمي|رسمية|استقبال|عملاء|مؤسسي|مكتب|أنيق/.test(s),
    budget: /\b(budget|cheap|affordable|cost|tight)\b/.test(s)
      || /ميزانية|رخيص|اقتصادي|تكلفة|محدود/.test(s),
    durable: /\b(durable|hard.?wearing|rugged|tough|workwear|industrial)\b/.test(s)
      || /متين|متينة|تحمل|خشن|ملابس عمل|صناعي/.test(s),
  };
}

/** Why these three kits, in one sentence tied to what the customer wrote. */
export function whyTheseKits(locale: Locale, brief: string, concepts: Concept[]): string {
  const r = readBrief(brief);
  const cheapest = [...concepts].sort((a, b) => conceptPrice(a) - conceptPrice(b))[0];

  // One reason, not a list of every signal that matched. The strongest read
  // is the one worth saying; stacking three makes the note sound automated.
  // Quote the word they wrote -- "summer" reported back as "you mentioned
  // heat" is a claim they can check and find false.
  const reason = r.heat ? t(locale, 'manager.reasonHeat', { word: heatWord(locale, brief) })
    : r.durable ? t(locale, 'manager.reasonDurable')
      : r.outdoor ? t(locale, 'manager.reasonOutdoor')
        : r.formal ? t(locale, 'manager.reasonFormal')
          : t(locale, 'manager.reasonDefault');

  // Only claim what was actually carried out. Keep a requested colour family
  // as a family: someone who wrote "dark colours" did not ask for ink. A
  // specific colour uses its localized display name, never the parser token.
  const w = briefWishes(brief);
  const colour = w.said && FAMILY.has(w.said)
    ? t(locale, `colours.${w.said}Family`)
    : w.colour ? swatchWord(locale, w.colour).toLowerCase() : '';
  const done = [
    w.colour
      ? t(locale, FAMILY.has(w.said ?? '') ? 'manager.didColourKept' : 'manager.didColour', { colour })
      : null,
    w.logo && w.logo !== 'none' ? t(locale, 'manager.didLogo', { place: t(locale, PLACE[w.logo]) }) : null,
    w.logo === 'none' ? t(locale, 'manager.didUnbranded') : null,
  ].filter(Boolean) as string[];

  // Arabic does not capitalise, and the joining comma differs. Both come from
  // the dictionary rather than being spelled into the logic here.
  const join = locale === 'ar' ? '، ' : ', ';
  const head = done.length
    ? t(locale, 'manager.whyWithDid', { did: capFor(locale, done.join(join)), reason })
    : t(locale, 'manager.whyPlain', { reason: capFor(locale, reason) });

  return `${head} ${t(locale, 'manager.cheapest', {
    name: kitName(locale, cheapest.id),
    price: formatCurrency(locale, conceptPrice(cheapest)),
  })}`;
}

/** One line per configure step. Advice, not a readback of the control. */
export function stepAdvice(
  locale: Locale,
  step: number,
  concept: Concept,
  fabricIndex: number,
  brief: string,
  staff: number,
  spare: number,
  /** Only the sizes step reads this. Left out, that step advises on spare
   *  stock alone, which is what it did before sizes were a choice. */
  sizeMode?: SizingMode,
): string {
  const r = readBrief(brief);
  // One case per configure step, in the order the steps run. The outfit step
  // used to have no case, so the caller passed step - 1 and special-cased it;
  // that off-by-one was one new step away from advising on the wrong screen.
  switch (step) {
    // Outfit. Which cuts a shared design is made in is the one thing the
    // garment list on screen does not show.
    case 0:
      return t(locale, 'manager.outfitCuts');

    // Fit and fabric. Heat is the strongest read the brief offers, so the
    // cloth speaks first; the cut only gets the line when the cloth has
    // nothing pointed left to say. One reason per note, never both.
    case 1: {
      if (r.heat && fabricIndex !== 2) return t(locale, 'manager.fabricPushKnit');
      if (fabricIndex === 2) return t(locale, 'manager.fabricGoodCall');
      const fit = concept.garments.find((g) => g.parts.body)?.fit ?? 'regular';
      if ((r.durable || r.outdoor) && fit !== 'relaxed') return t(locale, 'manager.fitRelaxed');
      if (r.formal && fit !== 'slim') return t(locale, 'manager.fitSlim');
      return t(locale, 'manager.fabricStandard');
    }

    case 2: {
      const top = concept.garments.find((g) => g.parts.body);
      const light = top && isLight(top.parts.body);
      return t(locale, light ? 'manager.colourLight' : 'manager.colourDark');
    }

    case 3:
      if (concept.logo.position === 'none') return t(locale, 'manager.brandNone');
      if (concept.logo.method === 'print') return t(locale, 'manager.brandPrint');
      return t(locale, 'manager.brandEmbroidery');

    // Quantity and sizes. Committing the size run now is the choice that
    // carries a consequence worth stating; leave it to the staff and spare
    // stock is what covers the guesswork instead.
    case 4: {
      if (sizeMode === 'allocate_now') return t(locale, 'manager.sizesAllocateNow');
      const sets = Math.ceil(staff * (1 + spare));
      if (spare === 0) return t(locale, 'manager.spareNone', { sets });
      // Arabic counts in five categories, so this sentence is written per
      // category rather than templated. See spareMessage in i18n.ts.
      return spareMessage(locale, sets - staff);
    }

    default:
      return '';
  }
}

/** What the quote means, in the terms a buyer worries about. */
export function quoteNote(
  locale: Locale,
  concept: Concept,
  staff: number,
  sets: number,
  sizesReady = false,
): string {
  const spare = sets - staff;
  if (sizesReady) {
    return spare > 0
      ? t(locale, 'manager.quoteSized', { people: staff, spare })
      : t(locale, 'manager.quoteSizedNoSpare', { people: staff });
  }
  return spare > 0
    ? t(locale, 'manager.quoteCovers', { people: staff, spare })
    : t(locale, 'manager.quoteCoversNoSpare', { people: staff });
}

/** Where the order actually is, and what happens next. */
export function orderNote(locale: Locale, o: Order): string {
  const on = (d: Date) => formatDate(locale, d);
  if (o.stage >= 5) return t(locale, 'manager.orderDelivered', { date: on(o.due) });
  if (o.stage >= 2) {
    return t(locale, 'manager.orderMaking', {
      stage: t(locale, `orders.${STAGE_KEYS[o.stage]}`),
      date: on(o.due),
    });
  }
  return t(locale, 'manager.orderSizes', { placed: on(o.placed), due: on(o.due) });
}

/** The greeting: what is open right now. Delivered orders need nobody. */
export function greeting(locale: Locale, name: string, orders: Order[]): string {
  const hour = new Date().getHours();
  const part = t(locale, hour < 12 ? 'manager.morning' : hour < 18 ? 'manager.afternoon' : 'manager.evening');
  const open = orders.filter((o) => o.stage < 5);
  if (open.length === 0) return t(locale, 'manager.greetNothing', { part, name });
  if (open.length === 1) {
    const o = open[0];
    const kit = kitName(locale, o.concept.id);
    return o.stage < 2
      ? t(locale, 'manager.greetSizes', { part, name, kit, id: o.id })
      : t(locale, 'manager.greetMaking', { part, name, kit, date: formatDate(locale, o.due) });
  }
  const sizes = open.filter((o) => o.stage < 2).length;
  return t(locale, 'manager.greetMany', { part, name, sizes, making: open.length - sizes });
}

/** The word in the brief that triggered the heat read, so the note can quote
 *  it rather than paraphrase it into a claim the customer never made. */
function heatWord(locale: Locale, brief: string): string {
  // match()[0] is the whole hit, in whichever script it was written; [1] was
  // the English capture group only, so an Arabic brief was quoted the literal
  // word "heat" -- something the customer never typed.
  const hit = brief.toLowerCase().match(HEAT)?.[0];
  return hit ?? t(locale, 'manager.heatFallback');
}

/** Arabic has no upper case; capitalising its first letter is a no-op at
 *  best and mangles a leading Latin word at worst. */
const capFor = (locale: Locale, s: string) =>
  (locale === 'ar' ? s : s.charAt(0).toUpperCase() + s.slice(1));

/** WCAG relative luminance. An unparseable hex reads as black rather than
 *  throwing: a colour we cannot measure should not take down the advice. */
function lum(hex: string): number {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return 0;
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [n >> 16 & 255, n >> 8 & 255, n & 255].map((c) => c / 255);
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function isLight(hex: string): boolean {
  return lum(hex) > 0.5;
}

/** WCAG contrast ratio: 1 is two identical colours, 21 is black on white.
 *  A logo under about 2 against its own garment is printed and still
 *  unreadable from across a room, which no swatch picker will tell you. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
}

/** Kept for the kit list: what this kit is for, not what is in it. */
export function kitPurpose(locale: Locale, c: Concept): string {
  const names = c.garments.map((g) => t(locale, `garments.${g.type}`));
  return names.join(locale === 'ar' ? ' و' : ' and ');
}
