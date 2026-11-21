/**
 * The light of the scene, shared by every ghost on screen. The sky sets it from the time of day;
 * each rig reads it every frame and draws it as a rim light, a glow from below and a slight tint.
 */
import type { SceneLight } from '../logic/sky';

/** For ghosts that are not in front of the sky (on a sheet, or over a theme picture): soft, cool, from the upper left. */
export const NEUTRAL_LIGHT: SceneLight = {
  dir: [-0.5, -0.866],
  key: [0.62, 0.66, 0.74],
  under: [0, 0, 0],
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
