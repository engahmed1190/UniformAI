// Turning a plain-words request into a patch against the spec -- never into
// free-form drawing. That is the whole safety property: "make the trouser
// navy" can only ever reach setPart(c, i, 'leg', hex).
//
// ponytail: keyword match stands in for the model call. Swap parse() for an
// API that returns the same Patch shape; setPart/setLogo stay the seam.

import {
  type Concept, type LogoMethod, type LogoPosition,
  PARTS, setLogo, setPart, gradesFor, gradeName,
} from './spec';
import { isTop } from '../components/garments';
import { type Locale, t } from './i18n';

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

/** The colour word in the buyer's language. colourName() answers in English
 *  because the parser matches on English; this is what gets read back. */
function swatchWord(locale: Locale, hex: string): string {
  const name = colourName(hex);
  const near = /^Close to (.+)$/.exec(name);
  return near
    ? t(locale, 'colours.closeTo', { name: t(locale, `colours.${near[1]}`) })
    : t(locale, `colours.${name}`);
}

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
  // People brief a colour family as often as a colour: "dark colours" has to
  // land somewhere or the brief is silently half-ignored.
  dark: '#12161f', light: '#dfe6ef', neutral: '#8f9aa6',
  oxblood: '#7d2b2b', burgundy: '#7d2b2b', maroon: '#7d2b2b',
  brass: '#c8a24a', gold: '#c8a24a',
};

/** Applied edit, plus the patch line shown to the user as proof. Fabric and
 *  spare are not part of the spec -- they are the page's own state -- so they
 *  come back as fields the caller applies, keeping setPart/setLogo the only
 *  way the drawing itself can change. */
export type Applied = {
  concept: Concept;
  note: string;
  patch: string;
  /** One grade index per garment, into that garment's own family list. */
  grades?: number[];
  spare?: number;
};

/** Arabic asks, rewritten into the tokens the English matchers below already
 *  understand. Every matcher in this file is an English \b-anchored regex, so
 *  an Arabic request matched nothing and came back "I did not understand" --
 *  including all four of the example chips the Arabic UI offers.
 *
 *  Translating into the parser beats teaching the parser a second language:
 *  one set of rules stays authoritative, and Arabic cannot drift away from
 *  English as the vocabulary grows. \b works at an Arabic/Latin junction
 *  (Arabic letters are not \w), so a token dropped into Arabic still matches.
 *
 *  Order matters. Longest first: "بدون شعار" has to be read as "no logo"
 *  before "شعار" becomes "logo", and "بشعار" has to become " with logo " so
 *  the clause splitter sees the join that the Arabic writes as a prefix. */
const AR_WORDS: [RegExp, string][] = [
  // Negations and joins, before the words they contain.
  [/بدون شعار|بلا شعار|إزالة الشعار|احذف الشعار/g, ' no logo '],
  [/بدون احتياطي|بلا احتياطي|دون احتياطي/g, ' no spare '],
  [/بشعار/g, ' with logo '],
  [/وشعار/g, ' and logo '],
  [/،/g, ', '],
  [/\s+و\s+/g, ' and '],

  // Branding.
  [/يمين الصدر|الصدر الأيمن/g, ' right chest '],
  [/شعار|لوجو|العلامة/g, ' logo '],
  [/تطريز|مطرز/g, ' embroider '],
  [/طباعة|مطبوع/g, ' print '],
  [/الأكمام|الكم|كُم/g, ' sleeve '],
  [/الصدر/g, ' chest '],
  [/الظهر/g, ' back '],

  // Colours.
  [/كحلي|أزرق داكن|ازرق|أزرق/g, ' navy '],
  [/أسود|اسود/g, ' black '],
  [/فحمي/g, ' charcoal '],
  [/رملي|بيج/g, ' sand '],
  [/كريمي/g, ' cream '],
  [/رمادي/g, ' grey '],
  [/أبيض|ابيض/g, ' white '],
  [/زيتي/g, ' olive '],
  [/أخضر|اخضر/g, ' green '],
  [/نبيتي|عنابي|خمري/g, ' burgundy '],
  [/ذهبي|دهبي/g, ' gold '],
  [/نحاسي/g, ' brass '],
  [/داكن|غامق/g, ' dark '],
  [/فاتح/g, ' light '],
  [/محايد/g, ' neutral '],

  // Garments and their parts.
  [/قميص/g, ' shirt '],
  [/بولو/g, ' polo '],
  [/بليزر|سترة|جاكيت/g, ' blazer '],
  [/بنطلون|بنطال|سروال/g, ' trouser '],
  [/تشينو/g, ' chino '],
  [/كارجو/g, ' cargo '],
  [/الياقة|ياقة/g, ' collar '],
  [/الأزرار|أزرار/g, ' buttons '],
  [/الجيوب|جيوب/g, ' pockets '],
  [/الأساور|أساور/g, ' cuffs '],

  // Cloth. The Arabic chip asks for a fabric "suitable for hot weather"
  // rather than naming the grade, which is how a buyer actually says it.
  [/خامة|قماش|نسيج/g, ' fabric '],
  [/الحارة|الحار|حارة|حار|الحرارة|صيفية|صيفي/g, ' performance '],
  [/عالية الأداء|الأداء|أداء/g, ' performance '],
  [/ميداني|ميدانية|المواقع/g, ' performance '],
  [/ممشط/g, ' combed '],
  [/تويل|مبروش/g, ' twill '],
  [/رسمي|رسمية|أنيق/g, ' worsted '],
  [/قياسية|عادية|أساسية|أرخص/g, ' standard '],
  [/ترقية|أنعم|أفخم/g, ' upgrade '],

  // Spare stock.
  [/احتياطية|احتياطي|إضافية/g, ' spare '],
  [/بالضبط|تحديدًا|تحديدا/g, ' exactly '],
];

/** Arabic-Indic digits and the Arabic percent sign, so "١٠٪" counts as "10%". */
const AR_DIGITS = /[\u0660-\u0669]/g;

/** One request, in the vocabulary the matchers below read. A no-op on English:
 *  every pattern is Arabic script, so it cannot touch a Latin request. */
function toParserWords(text: string): string {
  let out = text
    .replace(AR_DIGITS, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/٪/g, '%');
  for (const [re, word] of AR_WORDS) out = out.replace(re, word);
  return out.replace(/\s+/g, ' ').trim();
}

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

/** The colour a request names, if any. Shared by the logo and garment
 *  branches so "gold" means the same hex whichever one claims it. */
function pickColour(t: string): string | null {
  const word = Object.keys(WORDS).find((w) => new RegExp(`\\b${w}\\b`).test(t));
  if (word) return WORDS[word];
  return /^#[0-9a-f]{6}$/i.test(t) ? t : null;
}

/** One clause, one edit. This is the whole original engine: it assumes the
 *  text it gets names at most one colour and one thing to put it on. */
function refineOne(
  concept: Concept,
  request: string,
  currentGrades: number[] = [],
  locale: Locale = 'en',
): Applied | null {
  const ask = request.toLowerCase().trim();
  if (!ask) return null;
  const hex = pickColour(ask);

  // Logo placement and method come first: they are unambiguous.
  const pos: [RegExp, LogoPosition][] = [
    [/\bsleeve\b/, 'sleeve'],
    // Specific before generic: find() takes the first hit.
    [/\bright chest\b/, 'right_chest'],
    [/\bchest\b/, 'left_chest'],
    [/\bback\b/, 'back'],
  ];
  if (/\b(no logo|remove the logo|without a logo|drop the logo)\b/.test(ask)) {
    return {
      concept: setLogo(concept, { position: 'none' }),
      note: t(locale, 'reply.droppedLogo'),
      patch: 'logo.position = none',
    };
  }
  if (/\b(logo|badge|branding|embroider|print)\b/.test(ask)) {
    const method: LogoMethod | null = /\bprint\b/.test(ask)
      ? 'print'
      : /\bembroider/.test(ask)
        ? 'embroidery'
        : null;
    const hit = pos.find(([re]) => re.test(ask));
    // ponytail: a request naming both the logo and a colour is read as
    // recolouring the logo. "Navy polo with a gold logo" is two edits here;
    // say them one at a time.
    if (method || hit || hex) {
      const next = setLogo(concept, {
        ...(method ? { method } : {}),
        ...(hit ? { position: hit[1] } : {}),
        ...(hex ? { colour: hex } : {}),
      });
      const bits = [
        hit ? `logo.position = ${hit[1]}` : null,
        method ? `logo.method = ${method}` : null,
        hex ? `logo.colour = ${hex}` : null,
      ].filter(Boolean);
      return {
        concept: next,
        note: hex && !method && !hit
          ? t(locale, 'reply.logoColour', { colour: swatchWord(locale, hex) })
          : `${t(locale, 'reply.updatedBranding')} ${t(locale, 'reply.bothFollow')}`,
        patch: bits.join('\n'),
      };
    }
  }

  // Fabric sits in a control right above this box, so the box has to
  // understand it too -- a text field that knows less than the panel beside
  // it reads as decoration.
  //
  // Resolved by NAME, never by index. "Performance knit" is grade 2 of the
  // knit list, and a kit of wovens has no such cloth: taking index 2 would
  // have quietly billed fine worsted at +120 while confirming the knit.
  const wants = /\bperformance|wicking|technical\b/.test(ask) ? 'Performance knit'
    : /\bworsted|smart|formal\b/.test(ask) ? 'Fine worsted'
      : /\bcombed\b/.test(ask) ? 'Combed cotton'
        : /\btwill|brushed|heavier\b/.test(ask) ? 'Brushed twill'
          : /\bsofter|premium|upgrade\b/.test(ask) ? 'UP'
            : /\bpique|standard|basic|cheapest|plain\b/.test(ask) ? 'BASE'
              : null;
  if (wants && /\bfabric|knit|cotton|pique|material|cloth|wicking|combed|performance|twill|worsted|weave\b/.test(ask)) {
    // Which garments can actually take it. A kit is usually one family, but
    // Front Office mixes none and Technicians mixes knit with woven.
    const hits = concept.garments.map((g, i) => {
      const list = gradesFor(g.type);
      const at = wants === 'BASE' ? 0
        : wants === 'UP' ? 1
          : list.findIndex((x) => x.name === wants);
      return { i, g, at };
    });
    const usable = hits.filter((h) => h.at >= 0);
    if (!usable.length) {
      const offered = [...new Set(concept.garments.flatMap(
        (g) => gradesFor(g.type).slice(1).map((x) => x.name)))];
      return {
        concept,
        note: t(locale, 'reply.noFabric', {
          wanted: wants,
          these: t(locale, concept.garments.length > 1 ? 'reply.theseGarments' : 'reply.thisGarment'),
          offered: offered.join(t(locale, 'reply.or')),
        }),
        patch: '',
      };
    }
    const grades = concept.garments.map((g, i) =>
      usable.find((h) => h.i === i)?.at ?? currentGrades[i] ?? 0);
    const named = usable.map((h) => gradeName(h.g, h.at));
    return {
      concept,
      grades,
      note: t(locale, 'reply.movedFabric', { fabric: [...new Set(named)].join(t(locale, 'reply.and')) }),
      patch: usable.map((h) => `${h.g.type}.fabric = ${gradeName(h.g, h.at)}`).join('\n'),
    };
  }

  const spareAsk = ask.match(/\b(\d+)\s*%/);
  if (spareAsk && /\bspare|extra|spares|buffer\b/.test(ask)) {
    const pct = Math.min(10, Math.max(0, +spareAsk[1]));
    return {
      concept,
      spare: pct / 100,
      note: pct === 0
        ? t(locale, 'reply.droppedSpare')
        : t(locale, 'reply.setSpare', { pct }),
      patch: `spare = ${pct / 100}`,
    };
  }
  if (/\bno spare|without spare|exactly\b/.test(ask)) {
    return {
      concept,
      spare: 0,
      note: t(locale, 'reply.droppedSpare'),
      patch: 'spare = 0',
    };
  }

  // Colour requests that did not name the logo.
  if (hex) {
    const gi = pickGarment(concept, ask);
    if (gi < 0) return null;
    const part = pickPart(concept, gi, ask);
    if (!part) return null;
    const g = concept.garments[gi];
    return {
      concept: setPart(concept, gi, part, hex),
      note: t(locale, 'reply.setPart', {
        garment: t(locale, `garments.${g.type}`),
        part: t(locale, `parts.${part}`),
        colour: swatchWord(locale, hex),
      }),
      patch: `${g.type}.parts.${part} = ${hex}`,
    };
  }

  return null;
}

/** What the brief itself asks for, in the same vocabulary an edit uses.
 *  The seeds are generic; this is what makes them answer the words the
 *  customer actually typed. */
export function briefWishes(text: string): {
  colour: string | null;
  /** The customer's own word for that colour, when they used one. */
  said: string | null;
  logo: LogoPosition | null;
} {
  const t = toParserWords(text.toLowerCase());
  const said = Object.keys(WORDS).find((w) => new RegExp(`\\b${w}\\b`).test(t)) ?? null;
  const logo: LogoPosition | null =
    /\bno logo|without a logo|unbranded\b/.test(t) ? 'none'
      : /\bsleeve\b/.test(t) ? 'sleeve'
        : /\bback\b/.test(t) ? 'back'
          : /\bright chest\b/.test(t) ? 'right_chest'
            : /\bchest\b/.test(t) ? 'left_chest'
              : null;
  return { colour: pickColour(t), said, logo };
}

/** Apply those wishes to a seed concept: the main surface of every garment
 *  takes the colour, and the logo moves where they asked. Anything the brief
 *  did not mention is left exactly as the seed had it. */
export function applyBrief(c: Concept, text: string): Concept {
  const { colour, logo } = briefWishes(text);
  let next = c;
  if (colour) {
    // Only bodies take the named colour. Recolouring the trouser to match
    // makes a monochrome suit nobody asked for.
    next.garments.forEach((g, i) => {
      if (PARTS[g.type].includes('body')) next = setPart(next, i, 'body', colour);
    });
  }
  if (logo) next = setLogo(next, { position: logo });
  return next;
}

/** Where one instruction ends and the next begins. People chain edits with
 *  "and", commas and "with" -- "navy polo with a gold logo" is two requests
 *  in one breath, and reading it as one bound the gold to the polo's colour
 *  word and set the LOGO navy. Splitting first means each clause names one
 *  colour and one noun, which the single-edit path already gets right. */
function clauses(text: string): string[] {
  return text
    .split(/\s+and\s+|\s*,\s*|\s+with\s+|\s*;\s*/i)
    .map((c) => c.trim())
    .filter(Boolean);
}

/** Apply every instruction in a request, in order. Each edit builds on the
 *  last, so two clauses touching the same garment both land. Anything not
 *  understood is named rather than dropped -- half-applying a request in
 *  silence is the failure this whole file exists to avoid. */
export function refine(
  concept: Concept,
  request: string,
  currentGrades: number[] = [],
  locale: Locale = 'en',
): Applied | null {
  // Into the parser's vocabulary first: the splitter reads an Arabic "،" and
  // a prefixed "بشعار" as the joins they are, not as one long clause.
  const ask = toParserWords(request);
  const parts = clauses(ask);
  // One clause is the overwhelming case; keep it on the original path so a
  // simple ask cannot regress behind the splitter.
  if (parts.length <= 1) return refineOne(concept, ask, currentGrades, locale);

  let next = concept;
  let grades: number[] | undefined;
  let spare: number | undefined;
  const notes: string[] = [];
  const patches: string[] = [];
  const missed: string[] = [];

  for (const clause of parts) {
    const step = refineOne(next, clause, grades ?? currentGrades, locale);
    if (!step) { missed.push(clause); continue; }
    next = step.concept;
    if (step.grades) grades = step.grades;
    if (step.spare !== undefined) spare = step.spare;
    notes.push(step.note);
    // A clause can be understood but change nothing (an unavailable grade);
    // it still gets a note, just no patch line.
    if (step.patch) patches.push(step.patch);
  }

  if (!patches.length && !notes.length) return null;
  if (missed.length) {
    notes.push(t(locale, 'reply.notFollowed', { part: missed.join('”, “') }));
  }
  return {
    concept: next,
    grades,
    spare,
    note: notes.join(' '),
    patch: patches.join('\n'),
  };
}
