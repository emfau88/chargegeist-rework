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

/**
 * A part that is painted into the body picture and bends at a joint, instead of being a loose picture
 * on a hinge: a raised arm, a wing, a fin, an ear. The picture is a mesh; what lies inside the shape
 * turns around the joint, and near the joint the turn fades in, so the part bends out of the body.
 */
export interface Limb {
  /** The joint, in body pixels. */
  at: Vec;
  /** The outline of the part: x and y of each corner in turn, in body pixels. */
  shape: number[];
  /** How far from the joint the turn begins, and where it is complete (body pixels). */
  ramp: Vec;
  /** Degrees of turn per degree of the arm or tuft it stands for; negative turns it the other way. */
  gain: number;
  /** The most it turns either way, in degrees. */
  max: number;
  /** A smaller limit for turning upwards, where the part would run into what is painted above it. */
  lift?: number;
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
  /** Parts of the body picture that bend: L and R move as the arms do, top as a tuft does. */
  limbs?: { L?: Limb; R?: Limb; top?: Limb };
  /** Where the skirt starts to sway (measured down from cy), and over which length. */
  flow: Vec;
  /** Where the chest breathes (measured down from cy), and how wide. */
  breath: Vec;
  /** u0, u1, v0, v1 of the curl that wiggles. */
  tail: [number, number, number, number];
  top: number;
  /**
   * Parts that are painted on the body already and so are not drawn again (ghosts whose body is the
   * finished figure of their sheet). Without arms to draw, armL and armR still say where they would hang.
   */
  baked?: ('arms' | 'blush')[];
}
