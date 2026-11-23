import { render } from 'preact';
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/600.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import './styles.css';
import { App } from './app';
import { setLightOn } from './fx/light';
import { RELEASE } from './platform/build';
import { playAct } from './rig/acts';
import { setEyePose } from './rig/gaze';
import { dev, getState, mutate } from './state/store';

if (!RELEASE && (import.meta.env.DEV || location.search.includes('debug'))) {
  (window as unknown as { __cg: unknown }).__cg = { dev, getState, mutate, light: setLightOn, eyes: setEyePose, act: playAct };
}

render(<App />, document.getElementById('app')!);
