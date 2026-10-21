import { PALETTES, type PaletteName } from '../render/palette';
import { el } from './dom';

/** A palette chip: four of its colours and the name. */
export function paletteSwatch(name: PaletteName, active: boolean, onPick: () => void): HTMLElement {
  const p = PALETTES[name];
  return el(
    `button.swatch${active ? '.active' : ''}`,
    { title: p.label, onclick: onPick },
    el(
      'span.swatch-row',
      {},
      ...[p.grass, p.walls[0], p.roofs[1], p.waterDeep].map((hex) =>
        el('i.dot', { style: `background:${hex}` }),
      ),
    ),
    el('span.swatch-label', {}, p.label),
  );
}
