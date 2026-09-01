// The concept spec. The model never writes SVG -- it writes one of these,
// and the renderer turns it into a picture deterministically. An edit is a
// patch to this object, so "make the shirt beige" provably cannot move a collar.

export type GarmentType = 'polo' | 'shirt' | 'chino' | 'blazer' | 'cargo';

export type Garment = {
  type: GarmentType;
  /** Named regions of the garment -> hex colour. Keys are per-type; see PARTS. */
  parts: Record<string, string>;
  fabric: string;
  /** EGP, per unit. The seam where ERPNext Item Price takes over later. */
  unitPrice: number;
};

export type LogoPosition = 'left_chest' | 'right_chest' | 'sleeve' | 'back' | 'none';
export type LogoMethod = 'embroidery' | 'print';

export type Concept = {
  id: string;
  /** The role this outfit is for: "Front Office", "Technicians". */
  name: string;
  garments: Garment[];
  /** colour is optional: undefined means white, so the seeds need no edit. */
  logo: { position: LogoPosition; method: LogoMethod; colour?: string };
};

/** Which colourable regions each garment type has. The renderer and the
 *  editor both read this, so they can never disagree about what exists. */
export const PARTS: Record<GarmentType, string[]> = {
  polo: ['body', 'collar', 'placket'],
  shirt: ['body', 'collar', 'cuffs'],
  chino: ['leg'],
  blazer: ['body', 'lapel', 'buttons'],
  cargo: ['leg', 'pockets'],
};

export const LABELS: Record<GarmentType, string> = {
  polo: 'Polo Shirt',
  shirt: 'Formal Shirt',
  chino: 'Chino Trouser',
  blazer: 'Blazer',
  cargo: 'Cargo Trouser',
};

export const LOGO_PRICE: Record<LogoMethod, number> = { embroidery: 35, print: 18 };

/** Per-employee cost of one concept: garments + one logo application. */
export function conceptPrice(c: Concept): number {
  const garments = c.garments.reduce((sum, g) => sum + g.unitPrice, 0);
  return garments + (c.logo.position === 'none' ? 0 : LOGO_PRICE[c.logo.method]);
}

/** Deep-clone. structuredClone is in node 17+ and every current browser. */
export function cloneConcept(c: Concept): Concept {
  return structuredClone(c);
}

/** The only mutation path. Returns a new Concept; never touches the original.
 *  ponytail: patches one part of one garment -- the whole edit vocabulary the
 *  POC needs. Multi-part edits are two calls. */
export function setPart(
  c: Concept,
  garmentIndex: number,
  part: string,
  hex: string,
): Concept {
  const next = cloneConcept(c);
  const g = next.garments[garmentIndex];
  if (!g) throw new Error(`no garment at index ${garmentIndex}`);
  if (!PARTS[g.type].includes(part)) {
    throw new Error(`${g.type} has no part "${part}"`);
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) throw new Error(`bad hex "${hex}"`);
  g.parts[part] = hex;
  return next;
}

export function setLogo(
  c: Concept,
  logo: Partial<Concept['logo']>,
): Concept {
  if (logo.colour !== undefined && !/^#[0-9a-fA-F]{6}$/.test(logo.colour)) {
    throw new Error(`bad hex "${logo.colour}"`);
  }
  const next = cloneConcept(c);
  next.logo = { ...next.logo, ...logo };
  return next;
}

/** Every hex in the concept, in a stable order. Used to prove an edit
 *  changed exactly what it claimed to. */
export function colourFingerprint(c: Concept): string {
  return c.garments
    .map((g) => PARTS[g.type].map((p) => `${g.type}.${p}=${g.parts[p] ?? '-'}`).join(','))
    .join('|');
}

/** What makes one saved kit different from another: its name plus every
 *  colour and branding choice on it. The library dedupes on this rather than
 *  on id alone, because an edit keeps the id -- so customising a saved kit
 *  and saving it again used to be a silent no-op. */
export function kitKey(c: Concept): string {
  const { position, method, colour = '' } = c.logo;
  return `${c.id}|${colourFingerprint(c)}|${position}/${method}/${colour}`;
}

/** Whether two kits are the same garments in the same colours with the same
 *  branding. Deliberately blind to id and name: saving a copy mints a new id,
 *  so an id-sensitive comparison stopped matching on the second save and the
 *  library grew a v2, v3, v4 of one unchanged kit. */
export function sameKit(a: Concept, b: Concept): boolean {
  const strip = (k: string) => k.slice(k.indexOf('|'));
  return strip(kitKey(a)) === strip(kitKey(b))
    && a.garments.map((g) => g.type).join() === b.garments.map((g) => g.type).join();
}

/** A kit about to enter the library. An edit keeps the seed's id and name,
 *  so saving a customised kit collided with the original: React dropped a
 *  card on the duplicate key, and the ones that rendered were indistinguish-
 *  able. A copy that differs from everything already saved gets its own id
 *  and a numbered name; an untouched kit is returned as it is. */
export function asSavedKit(c: Concept, saved: Concept[]): Concept {
  if (!saved.some((x) => x.id === c.id)) return c;
  if (saved.some((x) => sameKit(x, c))) return c;
  const n = saved.filter((x) => x.name === c.name || x.name.startsWith(`${c.name} v`)).length + 1;
  return { ...cloneConcept(c), id: `${c.id}-v${n}`, name: `${c.name} v${n}` };
}

/** Fabric grades, per garment family. A blazer offered "moisture-wicking
 *  performance knit" is the kind of thing a buyer spots instantly, so knits
 *  and wovens carry different cloth at the same three grades: the standard
 *  the kit is quoted at, a step up, and the best in that family. */
export type FabricFamily = 'knit' | 'woven';

export const FABRIC_FAMILY: Record<GarmentType, FabricFamily> = {
  polo: 'knit', shirt: 'woven', chino: 'woven', blazer: 'woven', cargo: 'woven',
};

export type Grade = { name: string; note: string; delta: number };

export const GRADES: Record<FabricFamily, Grade[]> = {
  knit: [
    { name: 'Cotton pique', note: '220 GSM · breathable everyday knit', delta: 0 },
    { name: 'Combed cotton', note: '240 GSM · softer hand, holds colour', delta: 45 },
    { name: 'Performance knit', note: 'Moisture wicking · best for heat', delta: 90 },
  ],
  woven: [
    { name: 'Standard weave', note: 'The cloth this kit is quoted at', delta: 0 },
    // grade 0's name is replaced by the garment's own cloth at display time;
    // see gradeName(). A generic label here contradicted the quote.
    { name: 'Brushed twill', note: 'Heavier, softer, holds a press', delta: 60 },
    { name: 'Fine worsted', note: 'Smooth finish · best for client-facing work', delta: 120 },
  ],
};

/** The grades on offer for one garment. */
export const gradesFor = (t: GarmentType): Grade[] => GRADES[FABRIC_FAMILY[t]];

/** Per-employee cost of one concept at the chosen grades. `grades[i]` is the
 *  index into that garment's own family list; anything missing is grade 0. */
export function conceptPriceAt(c: Concept, grades: number[]): number {
  const cloth = c.garments.reduce(
    (sum, g, i) => sum + (gradesFor(g.type)[grades[i] ?? 0]?.delta ?? 0), 0);
  return conceptPrice(c) + cloth;
}

/** What to call a grade for one garment. Grade 0 is the cloth the seed
 *  already names, so the option, the quote and the pill cannot disagree. */
export function gradeName(g: Garment, grade: number): string {
  return grade === 0 ? g.fabric : (gradesFor(g.type)[grade]?.name ?? g.fabric);
}
