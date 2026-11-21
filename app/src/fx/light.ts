/**
 * The light of the scene, shared by every ghost on screen. The sky sets it from the time of day;
 * each rig reads it every frame: a slight tint over the figure, and the way to the sun or moon for
 * the acts in which a ghost looks up at it.
 */
import type { SceneLight } from '../logic/sky';

/** For ghosts that are not in front of the sky (on a sheet, or over a theme picture): soft, cool, from the upper left. */
export const NEUTRAL_LIGHT: SceneLight = {
  dir: [-0.5, -0.866],
  tint: [1, 1, 1],
};

let scene: SceneLight = NEUTRAL_LIGHT;
let on = true;

export function setSceneLight(l: SceneLight | null) {
  scene = l ?? NEUTRAL_LIGHT;
}
export function sceneLight(): SceneLight {
  return scene;
}
/** The preview tools switch the light off to compare a ghost with and without it. */
export function setLightOn(v: boolean) {
  on = v;
}
export function lightOn(): boolean {
  return on;
}
