import type { Garment, LogoPosition } from '@/lib/spec';

// Hand-authored flat-vector garments on a shared 200x260 canvas. Every
// colourable region reads its fill from garment.parts, so a spec edit is the
// only thing that can change a colour.

const STROKE = '#00000022';

type P = { g: Garment; back?: boolean };

function Polo({ g, back }: P) {
  const { body, collar, placket } = g.parts;
  return (
    <g>
      <path d="M60 40 L80 32 L100 46 L120 32 L140 40 L162 58 L150 78 L138 70 L138 168 L62 168 L62 70 L50 78 L38 58 Z"
        fill={body} stroke={STROKE} />
      {back ? (
        // A back yoke, not an open collar -- there is no neck opening to show.
        <path d="M80 32 L100 42 L120 32 L120 38 L100 47 L80 38 Z" fill={collar} stroke={STROKE} />
      ) : (
        <>
          <path d="M80 32 L100 46 L120 32 L112 28 L100 34 L88 28 Z" fill={collar} stroke={STROKE} />
          <rect x="96" y="46" width="8" height="34" fill={placket} stroke={STROKE} />
        </>
      )}
    </g>
  );
}

function Shirt({ g, back }: P) {
  const { body, collar, cuffs } = g.parts;
  return (
    <g>
      <path d="M60 40 L80 30 L100 44 L120 30 L140 40 L164 60 L152 82 L138 72 L138 172 L62 172 L62 72 L48 82 L36 60 Z"
        fill={body} stroke={STROKE} />
      {back ? (
        <>
          <path d="M80 30 L100 40 L120 30 L120 37 L100 46 L80 37 Z" fill={collar} stroke={STROKE} />
          {/* Back yoke seam, the one detail a shirt back actually has. */}
          <path d="M62 76 L138 76" stroke="#00000018" strokeWidth="1.5" fill="none" />
        </>
      ) : (
        <>
          <path d="M80 30 L100 44 L120 30 L110 24 L100 32 L90 24 Z" fill={collar} stroke={STROKE} />
          <rect x="97" y="44" width="6" height="128" fill="#00000010" />
        </>
      )}
      {/* Cuff bands, drawn on the sleeve ends so they share the body outline's
          edge rather than floating over it. */}
      <path d="M164 60 L152 82 L141 71 L153 49 Z" fill={cuffs} stroke={STROKE} />
      <path d="M36 60 L48 82 L59 71 L47 49 Z" fill={cuffs} stroke={STROKE} />
    </g>
  );
}

function Blazer({ g, back }: P) {
  const { body, lapel, buttons } = g.parts;
  return (
    <g>
      <path d="M58 38 L82 28 L100 50 L118 28 L142 38 L168 62 L154 88 L140 76 L140 180 L60 180 L60 76 L46 88 L32 62 Z"
        fill={body} stroke={STROKE} />
      {back ? (
        <>
          <path d="M82 28 L100 40 L118 28 L118 36 L100 47 L82 36 Z" fill={lapel} stroke={STROKE} />
          {/* Centre back seam and vent. */}
          <path d="M100 47 L100 180" stroke="#00000018" strokeWidth="1.5" fill="none" />
          <path d="M100 150 L100 180" stroke="#00000028" strokeWidth="2" fill="none" />
        </>
      ) : (
        <>
          <path d="M82 28 L100 50 L84 92 L74 40 Z" fill={lapel} stroke={STROKE} />
          <path d="M118 28 L100 50 L116 92 L126 40 Z" fill={lapel} stroke={STROKE} />
          <circle cx="100" cy="112" r="4" fill={buttons} />
          <circle cx="100" cy="132" r="4" fill={buttons} />
        </>
      )}
    </g>
  );
}

function Chino({ g }: P) {
  const { leg } = g.parts;
  return (
    <g>
      <path d="M64 30 L136 30 L134 60 L128 220 L106 220 L100 96 L94 220 L72 220 L66 60 Z"
        fill={leg} stroke={STROKE} />
      <rect x="64" y="30" width="72" height="10" fill="#00000018" />
    </g>
  );
}

function Cargo({ g }: P) {
  const { leg, pockets } = g.parts;
  return (
    <g>
      <path d="M62 30 L138 30 L136 62 L130 222 L106 222 L100 98 L94 222 L70 222 L64 62 Z"
        fill={leg} stroke={STROKE} />
      <rect x="62" y="30" width="76" height="10" fill="#00000018" />
      {/* Patch pockets with flaps. The flap is what makes a recoloured
          rectangle read as a pocket instead of a floating block. */}
      <rect x="66" y="104" width="24" height="30" rx="2" fill={pockets} stroke={STROKE} />
      <rect x="110" y="104" width="24" height="30" rx="2" fill={pockets} stroke={STROKE} />
      <path d="M64 104 L92 104 L92 113 L64 113 Z" fill={pockets} stroke={STROKE} />
      <path d="M108 104 L136 104 L136 113 L108 113 Z" fill={pockets} stroke={STROKE} />
      <path d="M64 113 L92 113 M108 113 L136 113" stroke="#00000028" strokeWidth="1.2" fill="none" />
    </g>
  );
}


/** Tight crop per garment type. The shared 200x260 canvas left ~34% of every
 *  preview empty; these are the actual drawn extents plus a small margin.
 *  Heights stay proportional so a shirt and a trouser sit at the same scale. */
const VIEW_BOX: Record<Garment['type'], string> = {
  polo: '28 22 144 158',
  shirt: '26 20 148 164',
  blazer: '22 20 156 172',
  chino: '56 22 88 208',
  cargo: '54 22 92 210',
};

const RENDERERS = { polo: Polo, shirt: Shirt, chino: Chino, blazer: Blazer, cargo: Cargo };

/** Where the logo sits on the drawing. These are flats viewed from the
 *  front, so the wearer's LEFT chest appears on the viewer's RIGHT -- the
 *  x values are mirrored accordingly. 'back' is drawn on a back view
 *  instead, so it needs no front coordinate. The sleeve spot sits on the
 *  upper arm, clear of the cuff band, for all three tops. */
const LOGO_XY: Partial<Record<LogoPosition,
  { x: number; y: number; w: number; size: number; rotate?: number }>> = {
  left_chest: { x: 78, y: 72, w: 34, size: 7 },
  right_chest: { x: 122, y: 72, w: 34, size: 7 },
  // The sleeve is the narrowest placement: a small flat badge on the upper
  // arm, inboard of the cuff band. Rotating it to the sleeve angle was worse
  // -- at this size it just reads as tilted text.
  sleeve: { x: 57, y: 58, w: 20, size: 5.5 },
  back: { x: 100, y: 96, w: 56, size: 10 },
};

/** A logo on the back can only be shown on a back view. Everything else is
 *  drawn from the front. */
const isBackView = (p?: LogoPosition) => p === 'back';

export const isTop = (t: Garment['type']) => ['polo', 'shirt', 'blazer'].includes(t);

/** Index of the garment that carries the logo: the first top, or -1.
 *  One application per concept -- matches conceptPrice, which charges once. */
export function logoGarmentIndex(garments: Garment[]): number {
  return garments.findIndex((g) => isTop(g.type));
}

export function GarmentSvg({
  garment,
  logo,
  logoText,
  showLogo = true,
}: {
  garment: Garment;
  logo?: { position: LogoPosition; method: string; colour?: string };
  logoText?: string;
  /** False for tops that aren't the logo-bearing one. */
  showLogo?: boolean;
}) {
  const Renderer = RENDERERS[garment.type];
  const spot =
    showLogo && logo && logo.position !== 'none' ? LOGO_XY[logo.position] : undefined;
  // A back logo is only visible on a back view, and only the garment that
  // carries it turns around.
  const back = showLogo && isTop(garment.type) && isBackView(logo?.position);
  const label = `${garment.type}${back ? ', back view' : ''} in ${
    garment.parts.body ?? garment.parts.leg}`;
  const text = (logoText || 'LOGO').slice(0, 12).toUpperCase();
  return (
    <svg viewBox={VIEW_BOX[garment.type]} width="100%" height="100%"
      preserveAspectRatio="xMidYMid meet" role="img" aria-label={label}>
      <Renderer g={garment} back={back} />
      {spot && (
        <text x={spot.x} y={spot.y} fontSize={spot.size} fontWeight="700"
          transform={spot.rotate ? `rotate(${spot.rotate} ${spot.x} ${spot.y})` : undefined}
          textAnchor="middle"
          {...(text.length > spot.w / (spot.size * 0.62)
            ? { textLength: spot.w, lengthAdjust: 'spacingAndGlyphs' as const }
            : {})}
          fill={logo?.colour ?? '#ffffff'} stroke="#00000055" strokeWidth="0.3"
          paintOrder="stroke">
          {text}
        </text>
      )}
    </svg>
  );
}
