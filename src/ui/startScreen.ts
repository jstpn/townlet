import type { GameOptions } from '../game';
import { PALETTES, PALETTE_NAMES, type PaletteName } from '../render/palette';
import { DIFFICULTIES, DIFFICULTY, type Difficulty } from '../sim/difficulty';
import { clear, el, input } from './dom';

const WORDS = [
  'budapest',
  'moonrise',
  'zissou',
  'tenenbaum',
  'darjeeling',
  'rushmore',
  'fantastic',
  'asteroid',
  'dispatch',
  'margot',
  'gustave',
  'zero',
  'chas',
  'suzy',
  'sam',
];

const randomSeed = (): string => {
  const pick = (): string => WORDS[Math.floor(Math.random() * WORDS.length)] ?? 'town';
  return `${pick()}-${pick()}-${Math.floor(Math.random() * 1000)}`;
};

export type StartChoice = { kind: 'new'; options: GameOptions } | { kind: 'continue' };

/** The title screen. Resolves once the player founds a town or continues the saved one. */
export function showStartScreen(
  root: HTMLElement,
  defaults: Partial<GameOptions>,
  canContinue: boolean,
): Promise<StartChoice> {
  return new Promise((resolve) => {
    let difficulty: Difficulty = defaults.difficulty ?? 'normal';
    let palette: PaletteName = defaults.palette ?? 'budapest';
    const seed = input('seed', {
      type: 'text',
      value: defaults.seed ?? randomSeed(),
      spellcheck: 'false',
      'aria-label': 'Seed',
    });

    const difficultyRow = el('div.choices');
    const paletteRow = el('div.swatches');
    const renderChoices = (): void => {
      clear(difficultyRow);
      for (const name of DIFFICULTIES) {
        difficultyRow.append(
          el(
            `button.choice${name === difficulty ? '.active' : ''}`,
            { type: 'button', onclick: () => ((difficulty = name), renderChoices()) },
            DIFFICULTY[name].label,
          ),
        );
      }
      clear(paletteRow);
      for (const name of PALETTE_NAMES) {
        const p = PALETTES[name];
        const swatch = el(
          `button.swatch${name === palette ? '.active' : ''}`,
          { type: 'button', title: p.label, onclick: () => ((palette = name), renderChoices()) },
          el('span.swatch-row', {}, ...[p.grass, p.walls[0], p.roofs[1], p.waterDeep].map(dot)),
          el('span.swatch-label', {}, p.label),
        );
        paletteRow.append(swatch);
      }
    };
    renderChoices();

    const finish = (choice: StartChoice): void => {
      screen.remove();
      resolve(choice);
    };
    const found = (): void =>
      finish({
        kind: 'new',
        options: { seed: seed.value.trim() || randomSeed(), difficulty, palette },
      });

    const screen = el(
      'div.start',
      {},
      el(
        'div.start-card',
        {},
        el('p.eyebrow', {}, 'A small town, in a small film'),
        el('h1.logo', {}, 'Townlet'),
        el('p.rule'),
        field('Difficulty', difficultyRow),
        field('Palette', paletteRow),
        field(
          'Seed',
          el(
            'div.seed-row',
            {},
            seed,
            el('button.ghost', { type: 'button', onclick: () => (seed.value = randomSeed()) }, 'Randomise'),
          ),
        ),
        el(
          'div.start-actions',
          {},
          el('button.primary', { type: 'button', onclick: found }, 'Found the town'),
          canContinue &&
            el('button.ghost', { type: 'button', onclick: () => finish({ kind: 'continue' }) }, 'Continue'),
        ),
      ),
    );
    seed.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') found();
    });
    root.append(screen);
  });
}

const dot = (hex: string): HTMLElement => el('i.dot', { style: `background:${hex}` });

const field = (label: string, control: HTMLElement): HTMLElement =>
  el('label.field', {}, el('span.field-label', {}, label), control);
