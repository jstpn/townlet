import type { GameOptions } from '../game';
import type { SaveFile } from '../save';
import { PALETTE_NAMES, type PaletteName } from '../render/palette';
import { DIFFICULTIES, DIFFICULTY, type Difficulty } from '../sim/difficulty';
import { clear, el } from './dom';
import { paletteSwatch } from './swatch';

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

/** The title screen. Resolves with a new town's options, or the autosave when the player continues. */
export function showStartScreen(
  root: HTMLElement,
  defaults: Partial<GameOptions>,
  saved: SaveFile | undefined,
): Promise<GameOptions | SaveFile> {
  return new Promise((resolve) => {
    let difficulty: Difficulty = defaults.difficulty ?? 'normal';
    let palette: PaletteName = defaults.palette ?? 'budapest';
    const seed = el<HTMLInputElement>('input.seed', {
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
            { onclick: () => ((difficulty = name), renderChoices()) },
            DIFFICULTY[name].label,
          ),
        );
      }
      clear(paletteRow);
      for (const name of PALETTE_NAMES) {
        paletteRow.append(
          paletteSwatch(name, name === palette, () => ((palette = name), renderChoices())),
        );
      }
    };
    renderChoices();

    const done = (result: GameOptions | SaveFile): void => {
      screen.remove();
      resolve(result);
    };
    const found = (): void => done({ seed: seed.value.trim() || randomSeed(), difficulty, palette });

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
            el('button.ghost', { onclick: () => (seed.value = randomSeed()) }, 'Randomise'),
          ),
        ),
        el(
          'div.start-actions',
          {},
          ...(saved ? [el('button.primary', { onclick: () => done(saved) }, 'Continue')] : []),
          el(`button.${saved ? 'ghost' : 'primary'}`, { onclick: found }, 'Found the town'),
        ),
      ),
    );
    seed.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') found();
    });
    root.append(screen);
  });
}

const field = (label: string, control: HTMLElement): HTMLElement =>
  el('label.field', {}, el('span.field-label', {}, label), control);
