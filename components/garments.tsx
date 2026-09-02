import type { Garment, LogoPosition } from '@/lib/spec';
import { type Position, placementFor } from '@/lib/placement';

// Hand-authored flat-vector garments on a shared 200x260 canvas. Every
// colourable region reads its fill from garment.parts, so a spec edit is the
// only thing that can change a colour.

const STROKE = '#00000022';
const SEAM = '#00000038';

/** Construction detail stays stroke-only, so it survives every cloth colour
 * without becoming another editable region in the garment spec. */
function Seam({ d, w = 1.2 }: { d: string; w?: number }) {
  return <path d={d} fill="none" stroke={SEAM} strokeWidth={w} strokeLinecap="round" />;
}

type P = { g: Garment; back?: boolean };

function Polo({ g, back }: P) {
  const { body, collar, placket } = g.parts;
  return (
    <g>
      <path d="M86 32 L60 40 L40 56 L34 90 L58 98 L62 88 L62 180 L138 180 L138 88 L142 98 L166 90 L160 56 L140 40 L114 32 Z"
        fill={body} stroke={STROKE} />
      <Seam d="M36 80 L57 88" />
      <Seam d="M164 80 L143 88" />
      <Seam d="M60 40 Q54 62 62 88" />
      <Seam d="M140 40 Q146 62 138 88" />
      <Seam d="M62 172 L138 172" />
      {back ? (
        // A back yoke, not an open collar -- there is no neck opening to show.
        <path d="M86 32 L100 42 L114 32 L114 38 L100 48 L86 38 Z" fill={collar} stroke={STROKE} />
      ) : (
        <>
          <path d="M85 32 L100 50 L115 32 L113 26 L100 29 L87 26 Z" fill={collar} stroke={STROKE} />
          <Seam d="M100 50 L100 28" />
          <rect x="95" y="48" width="10" height="38" fill={placket} stroke={STROKE} />
          <circle cx="100" cy="58" r="2.2" fill={SEAM} />
          <circle cx="100" cy="74" r="2.2" fill={SEAM} />
        </>
      )}
    </g>
  );
}

function Shirt({ g, back }: P) {
  const { body, collar, cuffs } = g.parts;
  return (
    <g>
      <path d="M88 34 L62 42 L42 56 L34 148 L57 152 L62 82 L64 186 L136 186 L138 82 L143 152 L166 148 L158 56 L138 42 L112 34 Z"
        fill={body} stroke={STROKE} />
      <Seam d="M62 42 Q55 62 62 82" />
      <Seam d="M138 42 Q145 62 138 82" />
      {back ? (
        <>
          <path d="M88 34 L100 43 L112 34 L112 40 L100 49 L88 40 Z" fill={collar} stroke={STROKE} />
          <Seam d="M63 62 L100 56 L137 62" />
          <Seam d="M94 56 L94 66" />
          <Seam d="M106 56 L106 66" />
        </>
      ) : (
        <>
          <path d="M84 33 L100 54 L116 33 L114 27 L100 30 L86 27 Z" fill={collar} stroke={STROKE} />
          <Seam d="M100 54 L100 29" />
          <Seam d="M95 54 L95 186" />
          <Seam d="M105 54 L105 186" />
          {[70, 92, 114, 136, 158].map((y) => (
            <circle key={y} cx="100" cy={y} r="2.2" fill={SEAM} />
          ))}
        </>
      )}
      <path d="M35 134 L58 139 L57 152 L34 148 Z" fill={cuffs} stroke={STROKE} />
      <path d="M165 134 L142 139 L143 152 L166 148 Z" fill={cuffs} stroke={STROKE} />
      <circle cx="46" cy="145" r="2" fill={SEAM} />
      <circle cx="154" cy="145" r="2" fill={SEAM} />
    </g>
  );
}

function Blazer({ g, back }: P) {
  const { body, lapel, buttons } = g.parts;
  return (
    <g>
      <path d="M86 30 L58 38 L34 56 L26 152 L50 157 L58 84 L60 194 L140 194 L142 84 L150 157 L174 152 L166 56 L142 38 L114 30 Z"
        fill={body} stroke={STROKE} />
      <Seam d="M58 38 Q51 60 58 84" />
      <Seam d="M142 38 Q149 60 142 84" />
      <Seam d="M28 140 L51 145" />
      <Seam d="M172 140 L149 145" />
      {back ? (
        <>
          <path d="M86 30 L100 41 L114 30 L114 38 L100 49 L86 38 Z" fill={lapel} stroke={STROKE} />
          <Seam d="M100 49 L100 194" />
          <Seam d="M100 160 L100 194" w={2.2} />
          <Seam d="M62 60 Q100 54 138 60" />
        </>
      ) : (
        <>
          <path d="M86 36 L82 27 L100 23 L118 27 L114 36 L100 31 Z" fill={lapel} stroke={STROKE} />
          <path d="M86 36 L70 52 L96 126 L100 122 Z" fill={lapel} stroke={STROKE} />
          <path d="M114 36 L130 52 L104 126 L100 122 Z" fill={lapel} stroke={STROKE} />
          <Seam d="M100 126 L100 194" />
          <circle cx="100" cy="132" r="4" fill={buttons} stroke={STROKE} />
          <circle cx="100" cy="152" r="4" fill={buttons} stroke={STROKE} />
          <Seam d="M62 164 L90 164 L90 177 L62 177" />
          <Seam d="M110 164 L138 164 L138 177 L110 177" />
        </>
      )}
    </g>
  );
}

function Chino({ g }: P) {
  const { leg } = g.parts;
  return (
    <g>
      <path d="M64 30 L136 30 L134 62 L128 222 L106 222 L100 96 L94 222 L72 222 L66 60 Z"
        fill={leg} stroke={STROKE} />
      <Seam d="M65 44 L135 44" />
      {[70, 98, 126].map((x) => <Seam key={x} d={`M${x} 30 L${x} 44`} />)}
      <Seam d="M100 44 Q107 62 105 80" />
      <Seam d="M68 47 L84 64" />
      <Seam d="M132 47 L116 64" />
      <Seam d="M83 72 L79 218" w={1} />
      <Seam d="M117 72 L121 218" w={1} />
    </g>
  );
}

function Cargo({ g }: P) {
  const { leg, pockets } = g.parts;
  return (
    <g>
      <path d="M62 30 L138 30 L136 62 L130 222 L106 222 L100 98 L94 222 L70 222 L64 62 Z"
        fill={leg} stroke={STROKE} />
      <Seam d="M63 44 L137 44" />
      {[70, 100, 130].map((x) => <Seam key={x} d={`M${x} 30 L${x} 44`} />)}
      <Seam d="M100 44 Q107 62 105 78" />
      <rect x="66" y="104" width="26" height="32" rx="2" fill={pockets} stroke={STROKE} />
      <rect x="108" y="104" width="26" height="32" rx="2" fill={pockets} stroke={STROKE} />
      <Seam d="M66 114 L92 114" />
      <Seam d="M108 114 L134 114" />
      <Seam d="M72 158 L94 158" />
      <Seam d="M106 158 L128 158" />
    </g>
  );
}


/** Tight crop per garment type. The shared 200x260 canvas left ~34% of every
 *  preview empty; these are the actual drawn extents plus a small margin.
 *  Heights stay proportional so a shirt and a trouser sit at the same scale. */
const VIEW_BOX: Record<Garment['type'], string> = {
  polo: '28 14 144 174',
  shirt: '28 14 144 180',
  blazer: '20 11 160 190',
  chino: '56 22 88 208',
  cargo: '54 22 92 210',
};

const RENDERERS = { polo: Polo, shirt: Shirt, chino: Chino, blazer: Blazer, cargo: Cargo };

/** Fit is construction ease, not a clothing size. The drawing changes width
 * around its centre line without inventing separate size artwork. */
const FIT_WIDTH = { slim: 0.92, regular: 1, relaxed: 1.08 } as const;

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
  // Computed from this garment's own landmarks, so a blazer's chest badge
  // clears its lapel and its sleeve badge clears its armhole -- neither of
  // which a single shared coordinate could do.
  const rawSpot = showLogo && logo && logo.position !== 'none'
    ? placementFor(garment.type, logo.position as Position)
    : undefined;
  const width = FIT_WIDTH[garment.fit ?? 'regular'];
  const spot = rawSpot && {
    ...rawSpot,
    x: 100 + (rawSpot.x - 100) * width,
    w: rawSpot.w * width,
  };
  // A back logo is only visible on a back view, and only the garment that
  // carries it turns around.
  const back = showLogo && isTop(garment.type) && isBackView(logo?.position);
  const label = `${garment.fit ?? 'regular'} fit ${garment.type}${back ? ', back view' : ''} in ${
    garment.parts.body ?? garment.parts.leg}`;
  const text = (logoText || 'LOGO').slice(0, 12).toUpperCase();
  return (
    <svg viewBox={VIEW_BOX[garment.type]} width="100%" height="100%"
      preserveAspectRatio="xMidYMid meet" role="img" aria-label={label}>
      <g transform={`translate(100 0) scale(${width} 1) translate(-100 0)`}>
        <Renderer g={garment} back={back} />
      </g>
      {spot && (
        <text x={spot.x} y={spot.y} fontSize={spot.size} fontWeight="700"
          textAnchor="middle"
          {...(text.length > spot.w / (spot.size * 0.62)
            ? { textLength: spot.w, lengthAdjust: 'spacingAndGlyphs' as const }
            : {})}
          fill={logo?.colour ?? readableOn(garment.parts.body ?? garment.parts.leg)}
          stroke="#00000055" strokeWidth="0.3"
          paintOrder="stroke">
          {text}
        </text>
      )}
    </svg>
  );
}

/** A logo with no colour set takes one that can actually be read on the cloth
 *  behind it. Front Office's shirt is white, and the white default rendered a
 *  logo you had to hunt for on the demo's own second kit. An explicit
 *  logo.colour still wins -- this only fills the gap. */
function readableOn(hex: string | undefined): string {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return '#ffffff';
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [n >> 16 & 255, n >> 8 & 255, n & 255].map((c) => c / 255);
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  return L > 0.5 ? '#12161f' : '#ffffff';
}
