import './style.css';
import { Game } from './game';
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

window.addEventListener('keydown', (e) => {
  if (e.key === '1') game.tool.setTool({ kind: 'road' });
  if (e.key === 'b') game.tool.setTool({ kind: 'bulldoze' });
});

declare global {
  // Global augmentation must be an interface.
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface Window {
    townlet: Game;
  }
}
window.townlet = game;
