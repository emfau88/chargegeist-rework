export type Vec = [number, number];

export interface ArmRig {
  /** Shoulder point on the body. */
  at: Vec;
  /** Shoulder point in the arm image. */
  anchor: Vec;
  /** Arm scale. */
  s: number;
  /** Hand point in the arm image. */
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
}
