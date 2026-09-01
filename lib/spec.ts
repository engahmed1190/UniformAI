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
