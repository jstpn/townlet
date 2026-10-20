import './style.css';
import { startBlankScene } from './render/blankScene';

const canvas = document.querySelector<HTMLCanvasElement>('#scene');
if (!canvas) {
  throw new Error('missing #scene canvas');
}
startBlankScene(canvas);
