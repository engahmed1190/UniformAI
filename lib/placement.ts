// Where a logo sits on a garment, computed from that garment's own geometry
// rather than pinned to one hand-tuned coordinate.
//
// A single shared spot cannot be right for three silhouettes. A shirt's chest
// panel runs from the armhole seam in to the placket; on a blazer that same
// area is under the lapel, so a shirt-tuned chest spot embroiders the lapel.
// The sleeve is worse: the blazer's armhole sits at x=58 and the shirt's at
// x=62, so a spot at 62 is on the shirt's seam and on the blazer's chest.
//
// So each top declares the landmarks a badge has to fit between, and the
// placement is the middle of that gap. Move a path and the badge moves with
// it; the numbers below are read off the body paths in components/garments.tsx.

export type TopType = 'polo' | 'shirt' | 'blazer';

export type Placement = { x: number; y: number; w: number; size: number };

/** The landmarks a badge is positioned against. All x values are on the
 *  viewer's left half; the right chest is mirrored about the centre line. */
export type Anatomy = {
  /** Armhole seam: the inboard edge of the sleeve, at upperArmY. */
  armholeX: number;
  /** The sleeve's outer edge at the same height. */
  sleeveOuterX: number;
  /** Height of the upper arm, above the cuff and below the shoulder. */
  upperArmY: number;
  /** The clear chest panel at chestY, from the armhole seam inwards... */
  chestOuterX: number;
  /** ...to whatever runs down the middle: a placket, or a blazer's lapel. */
  chestInnerX: number;
  chestY: number;
  /** Centre of the upper back, for a back print. */
  backY: number;
};

export const CENTRE = 100;

export const ANATOMY: Record<TopType, Anatomy> = {
  // Short sleeve, so the upper arm is a narrow band above the sleeve hem.
  polo: {
    armholeX: 61, sleeveOuterX: 37, upperArmY: 74,
    chestOuterX: 63, chestInnerX: 95, chestY: 72,
    backY: 92,
  },
  shirt: {
    armholeX: 62, sleeveOuterX: 40, upperArmY: 74,
    chestOuterX: 64, chestInnerX: 95, chestY: 74,
    backY: 96,
  },
  // The lapel crosses the chest at x≈78, which is why the blazer's chest
  // panel is barely half the shirt's and sits further outboard.
  blazer: {
    armholeX: 58, sleeveOuterX: 33, upperArmY: 74,
    chestOuterX: 59, chestInnerX: 78, chestY: 74,
    backY: 100,
  },
};

/** The badge that fits between two landmarks: centred in the gap, taking
 *  `fill` of it so it never runs up against either edge. */
function between(a: number, b: number, fill: number): { x: number; w: number } {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return { x: (lo + hi) / 2, w: (hi - lo) * fill };
}

/** Font size that keeps a badge in proportion to the room it has. Clamped so
 *  a blazer's narrow chest panel does not produce unreadably small text. */
function sizeFor(w: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, w * 0.3));
}

export type Position = 'left_chest' | 'right_chest' | 'sleeve' | 'back';

/** Where the badge goes on one garment, or undefined for a piece that carries
 *  no logo. A back placement is drawn on the back view, so it needs no
 *  left/right handling. */
export function placementFor(type: string, position: Position): Placement | undefined {
  const a = ANATOMY[type as TopType];
  if (!a) return undefined;

  if (position === 'back') {
    // A back print is bounded by the body, not by a seam: it runs across the
    // shoulder blades, so it is the one placement that is deliberately large.
    const w = (a.armholeX - 20) * 1.4;
    return { x: CENTRE, y: a.backY, w, size: 10 };
  }

  if (position === 'sleeve') {
    const { x, w } = between(a.sleeveOuterX, a.armholeX, 0.7);
    return { x, y: a.upperArmY, w, size: sizeFor(w, 4.5, 6) };
  }

  const { x, w } = between(a.chestOuterX, a.chestInnerX, 0.78);
  return {
    x: position === 'right_chest' ? 2 * CENTRE - x : x,
    y: a.chestY,
    w,
    size: sizeFor(w, 5.5, 7.5),
  };
}
