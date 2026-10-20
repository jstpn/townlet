import './style.css';
import { Game } from './game';
import { bindKeys } from './input/keymap';
import { isPaletteName } from './render/palette';
import { isDifficulty } from './sim/difficulty';

const canvas = document.querySelector<HTMLCanvasElement>('#scene');
if (!canvas) {
  throw new Error('missing #scene canvas');
}

const params = new URLSearchParams(window.location.search);
const paletteParam = params.get('palette') ?? '';
const difficultyParam = params.get('difficulty') ?? '';
const game = new Game(canvas, {
  seed: params.get('seed') ?? 'budapest',
  difficulty: isDifficulty(difficultyParam) ? difficultyParam : 'normal',
  palette: isPaletteName(paletteParam) ? paletteParam : 'budapest',
});

bindKeys({
  q: () => game.gfx.rig.rotate(-1),
  e: () => game.gfx.rig.rotate(1),
  '1': () => game.tool.setTool({ kind: 'road' }),
  b: () => game.tool.setTool({ kind: 'bulldoze' }),
  escape: () => game.tool.setTool({ kind: 'none' }),
});

declare global {
  // Global augmentation must be an interface.
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface Window {
    townlet: Game;
  }
}
window.townlet = game;
