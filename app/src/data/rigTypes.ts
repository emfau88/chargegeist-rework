export type Vec = [number, number];

export interface ArmRig {
  /** Shoulder point on the body. */
  at: Vec;
  /** Shoulder point in the arm image. */
  anchor: Vec;
  /** Arm scale. */
  s: number;
  /** Hand point in the arm image, for held items. */
  hand: Vec;
}

/** Landmarks of one ghost in its own body space (pixels of its body texture). */
export interface RigConfig {
  /** Body units to stage units. */
  k: number;
  /** The body point that sits at the stage centre (300, 280). */
  cx: number;
  cy: number;
  /** Squash pivot, measured down from cy. */
  pivot: number;
  eyeY: number;
  eyeDX: number;
  mouth: Vec;
  /** dx, y, scale */
  blush: [number, number, number];
  /** Scale of face parts. */
  fs: number;
  /** Scale of the mouth. */
  ms: number;
  /** Size of face motions relative to Volti. */
  u: number;
  /** Size of body motions relative to Volti. */
  m: number;
  /** Which eyes are drawn. */
  eyes: string;
  armL: ArmRig;
  armR: ArmRig;
  tuft: { at: Vec; anchor: Vec; rest: number } | null;
  /** Where the skirt starts to sway (measured down from cy), and over which length. */
  flow: Vec;
  /** Where the chest breathes (measured down from cy), and how wide. */
  breath: Vec;
  /** u0, u1, v0, v1 of the curl that wiggles. */
  tail: [number, number, number, number];
  top: number;
  /** Item scale on this body; null when the ghost wears its own costume. */
  wear: number | null;
}

export type Slot = 'halo' | 'back' | 'tail' | 'neck' | 'brow' | 'eyes' | 'mouth' | 'head' | 'hand';

/** Which piece a companion wears in each spot. */
export type Outfit = Partial<Record<Slot, string>>;

export interface ItemRig {
  slot: Slot;
  w: number;
  h: number;
  /** Fraction of the image that sits on `at`. */
  anchor: Vec;
  /** Offset from the face centre (cx, eyeY) of a plain kit ghost. */
  at: Vec;
  s: number;
  rot: number;
  /** Parts this item covers. */
  hide: string[];
}
