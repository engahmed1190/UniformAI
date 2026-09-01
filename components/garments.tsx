import type { Garment, LogoPosition } from '@/lib/spec';

// Hand-authored flat-vector garments on a shared 200x260 canvas. Every
// colourable region reads its fill from garment.parts, so a spec edit is the
// only thing that can change a colour.

const STROKE = '#00000022';

type P = { g: Garment };

function Polo({ g }: P) {
  const { body, collar, placket } = g.parts;
  return (
    <g>
      <path d="M60 40 L80 32 L100 46 L120 32 L140 40 L162 58 L150 78 L138 70 L138 168 L62 168 L62 70 L50 78 L38 58 Z"
        fill={body} stroke={STROKE} />
      <path d="M80 32 L100 46 L120 32 L112 28 L100 34 L88 28 Z" fill={collar} stroke={STROKE} />
      <rect x="96" y="46" width="8" height="34" fill={placket} stroke={STROKE} />
    </g>
  );
}

function Shirt({ g }: P) {
  const { body, collar, cuffs } = g.parts;
  return (
    <g>
      <path d="M60 40 L80 30 L100 44 L120 30 L140 40 L164 60 L152 82 L138 72 L138 172 L62 172 L62 72 L48 82 L36 60 Z"
        fill={body} stroke={STROKE} />
      <path d="M80 30 L100 44 L120 30 L110 24 L100 32 L90 24 Z" fill={collar} stroke={STROKE} />
      <rect x="97" y="44" width="6" height="128" fill="#00000010" />
      <rect x="140" y="66" width="14" height="12" fill={cuffs} stroke={STROKE} />
      <rect x="46" y="66" width="14" height="12" fill={cuffs} stroke={STROKE} />
    </g>
  );
}

function Blazer({ g }: P) {
  const { body, lapel, buttons } = g.parts;
  return (
    <g>
      <path d="M58 38 L82 28 L100 50 L118 28 L142 38 L168 62 L154 88 L140 76 L140 180 L60 180 L60 76 L46 88 L32 62 Z"
        fill={body} stroke={STROKE} />
      <path d="M82 28 L100 50 L84 92 L74 40 Z" fill={lapel} stroke={STROKE} />
      <path d="M118 28 L100 50 L116 92 L126 40 Z" fill={lapel} stroke={STROKE} />
      <circle cx="100" cy="112" r="4" fill={buttons} />
      <circle cx="100" cy="132" r="4" fill={buttons} />
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
      <rect x="66" y="104" width="24" height="30" rx="2" fill={pockets} stroke={STROKE} />
      <rect x="110" y="104" width="24" height="30" rx="2" fill={pockets} stroke={STROKE} />
    </g>
  );
}

const RENDERERS = { polo: Polo, shirt: Shirt, chino: Chino, blazer: Blazer, cargo: Cargo };

/** Where the logo sits, per garment type. Only tops carry a chest logo. */
const LOGO_XY: Partial<Record<LogoPosition, { x: number; y: number }>> = {
  left_chest: { x: 122, y: 72 },
  right_chest: { x: 66, y: 72 },
  sleeve: { x: 146, y: 66 },
  back: { x: 88, y: 92 },
};

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
  logo?: { position: LogoPosition; method: string };
  logoText?: string;
  /** False for tops that aren't the logo-bearing one. */
  showLogo?: boolean;
}) {
  const Renderer = RENDERERS[garment.type];
  const spot =
    showLogo && logo && logo.position !== 'none' ? LOGO_XY[logo.position] : undefined;
  return (
    <svg viewBox="0 0 200 260" width="100%" role="img"
      aria-label={`${garment.type} in ${garment.parts.body ?? garment.parts.leg}`}>
      <Renderer g={garment} />
      {spot && (
        <text x={spot.x} y={spot.y} fontSize="11" fontWeight="700" textAnchor="middle"
          fill="#ffffff" stroke="#00000055" strokeWidth="0.4" paintOrder="stroke">
          {(logoText || 'LOGO').slice(0, 8).toUpperCase()}
        </text>
      )}
    </svg>
  );
}
