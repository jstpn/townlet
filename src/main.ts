import './style.css';
import { Game, type GameOptions } from './game';
import { isPaletteName } from './render/palette';
import { isDifficulty } from './sim/difficulty';
import { Hud } from './ui/hud';
import { showStartScreen } from './ui/startScreen';

function require<T extends Element>(selector: string): T {
  const node = document.querySelector<T>(selector);
  if (!node) throw new Error(`missing ${selector}`);
  return node;
}
const canvas = require<HTMLCanvasElement>('#scene');
const hudRoot = require<HTMLElement>('#hud');

declare global {
  // Global augmentation must be an interface.
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface Window {
    townlet: Game;
  }
}

const params = new URLSearchParams(window.location.search);
const paletteParam = params.get('palette') ?? '';
const difficultyParam = params.get('difficulty') ?? '';
const defaults: Partial<GameOptions> = {
  seed: params.get('seed') ?? undefined,
  difficulty: isDifficulty(difficultyParam) ? difficultyParam : undefined,
  palette: isPaletteName(paletteParam) ? paletteParam : undefined,
};

async function run(initial: Partial<GameOptions>): Promise<void> {
  const options = await showStartScreen(hudRoot, initial);
  const game = new Game(canvas, options);
  const hud = new Hud(hudRoot, game, {
    onNewTown: () => {
      hud.dispose();
      game.dispose();
      void run({ ...options, seed: undefined });
    },
  });
  game.onFrame = () => hud.update();
  window.townlet = game;
}

void run(defaults);
