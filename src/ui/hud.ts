import type { Cue } from '../audio/sound';
import type { Game } from '../game';
import { bindKeys } from '../input/keymap';
import type { Tool } from '../input/tools';
import { PALETTE_NAMES } from '../render/palette';
import {
  BUILDINGS,
  BULLDOZE_COST,
  type BuildingKind,
  ROAD_COST,
  ZONE_COST,
  footprint,
} from '../sim/catalogue';
import { DIFFICULTY } from '../sim/difficulty';
import { desirability } from '../sim/growth';
import { idx, xOf, yOf } from '../sim/grid';
import type { Budget } from '../sim/economy';
import { type CommandError, type SimEvent, MAX_TAX_RATE } from '../sim/sim';
import { Terrain, Zone, ZONE_KINDS, type ZoneKind } from '../sim/types';
import { formatDate } from './calendar';
import { clear, el, num } from './dom';
import { paletteSwatch } from './swatch';
import { townName } from './townName';

type MenuItem = { label: string; cost: number; tool: Tool };
type Category = { label: string; items: MenuItem[] };

const ZONE_LABEL: Record<ZoneKind, string> = {
  [Zone.Residential]: 'Residential',
  [Zone.Commercial]: 'Commercial',
  [Zone.Industrial]: 'Industrial',
};
const TERRAIN_LABEL: Record<Terrain, string> = {
  [Terrain.Water]: 'Water',
  [Terrain.Sand]: 'Sand',
  [Terrain.Grass]: 'Grass',
  [Terrain.Forest]: 'Forest',
};
const LEVEL_LABEL: Record<ZoneKind, readonly string[]> = {
  [Zone.Residential]: ['Empty lot', 'Cottage', 'Townhouse', 'Apartments'],
  [Zone.Commercial]: ['Empty lot', 'Kiosk', 'Shop', 'Department store'],
  [Zone.Industrial]: ['Empty lot', 'Workshop', 'Factory', 'Plant'],
};

const EVENT_CUE: Record<SimEvent['kind'], Cue> = {
  founded: 'chime',
  service: 'chime',
  population: 'chime',
  won: 'won',
  lost: 'lost',
  fire: 'fire',
};

const ERROR_TEXT: Record<CommandError, string> = {
  'out-of-bounds': 'That is off the map.',
  water: 'Nothing can be built on water.',
  occupied: 'Something is in the way.',
  'insufficient-funds': 'The town cannot afford that.',
  'nothing-to-build': 'Nothing to do there.',
  'needs-town-hall': 'Found the town first: place the town hall.',
  uneven: 'Services need level ground.',
  'already-built': 'A town has only one town hall.',
  protected: 'The town hall stays.',
};

const HINTS = [
  ['Roads first', 'Drag to lay a road. Everything grows within two tiles of one.'],
  ['Then zones', 'Paint homes, shops and workshops beside your roads. They fill on their own.'],
  ['Then services', 'Power and water are required; schools, clinics and parks keep people happy.'],
] as const;

const building = (kind: BuildingKind): MenuItem => ({
  label: BUILDINGS[kind].label,
  cost: BUILDINGS[kind].cost,
  tool: { kind: 'building', building: kind },
});
const TOWN_HALL = building('townHall');

const CATEGORIES: Category[] = [
  { label: 'Roads', items: [{ label: 'Road', cost: ROAD_COST, tool: { kind: 'road' } }] },
  {
    label: 'Zones',
    items: ZONE_KINDS.map((zone) => ({
      label: ZONE_LABEL[zone],
      cost: ZONE_COST,
      tool: { kind: 'zone', zone },
    })),
  },
  {
    label: 'Services',
    items: [
      TOWN_HALL,
      ...(
        ['windTurbine', 'waterTower', 'school', 'clinic', 'fireStation', 'policeStation'] as const
      ).map(building),
    ],
  },
  { label: 'Decor', items: (['park', 'plaza', 'tree'] as const).map(building) },
  {
    label: 'Bulldoze',
    items: [{ label: 'Bulldoze', cost: BULLDOZE_COST, tool: { kind: 'bulldoze' } }],
  },
];

export type HudCallbacks = { onNewTown: () => void };

/** All the paper-and-ink chrome around the map. Built once; `update` derives it from game state. */
export class Hud {
  private readonly root = el('div.hud');
  private readonly stats = {
    money: el('span.stat-value'),
    population: el('span.stat-value'),
    happiness: el('span.stat-value'),
    date: el('span.date'),
    demand: ZONE_KINDS.map(() => el('i.bar')),
  };
  private readonly speedButtons: HTMLElement[] = [];
  private readonly categoryButtons: HTMLElement[] = [];
  private readonly itemPanels: { panel: HTMLElement; buttons: [MenuItem, HTMLElement][] }[] = [];
  private readonly info = el('aside.panel.info');
  private readonly budget = el('aside.panel.budget');
  private readonly toasts = el('div.toasts');
  private readonly overlay = el('div.overlay');
  private readonly hints = el('div.hints');
  private category = -1;
  private shown = {
    day: -1,
    money: NaN,
    speed: -1,
    selected: undefined as unknown,
    budget: undefined as Budget | undefined,
  };
  private paused = false;
  private pausedSpeed = 1;
  private hint = 0;
  private readonly cards: [string, string][] = [];
  private cardShowing = false;
  private readonly unbindKeys: () => void;

  constructor(
    root: HTMLElement,
    private readonly game: Game,
    private readonly callbacks: HudCallbacks,
  ) {
    root.append(this.root);
    this.root.append(this.buildTopBar(), this.buildMenu(), this.info, this.budget, this.toasts);
    this.root.append(this.hints, this.overlay);
    // The three hint cards walk a new town through its first steps; a continued town has had them.
    if (!game.sim.state.founded) this.showHint();
    this.budget.hidden = true;
    this.info.hidden = true;
    this.overlay.hidden = true;
    game.tool.onCommand = (result, tool) => {
      if (result.ok) {
        if (tool.kind !== 'none') game.sound.play(tool.kind);
      } else {
        this.toast(ERROR_TEXT[result.reason]);
        game.sound.play('error');
      }
    };
    this.unbindKeys = bindKeys({
      '1': () => this.openCategory(0),
      '2': () => this.openCategory(1),
      '3': () => this.openCategory(2),
      '4': () => this.openCategory(3),
      '5': () => this.openCategory(4),
      ' ': () => this.setSpeed(this.game.speed === 0 ? 1 : 0),
      m: () => this.toggleSound(),
      escape: () => this.escape(),
    });
    // The first act of every game is placing the town hall, so start with it in hand.
    if (!game.sim.state.founded) {
      this.category = 2;
      game.tool.setTool(TOWN_HALL.tool);
    }
  }

  /** Once per frame. Cheap when nothing changed. */
  update(): void {
    const s = this.game.sim.state;
    const { shown } = this;
    if (s.day !== shown.day || s.money !== shown.money) {
      shown.day = s.day;
      shown.money = s.money;
      this.renderStats();
    }
    if (this.game.speed !== shown.speed) {
      shown.speed = this.game.speed;
      this.speedButtons.forEach((b, i) => b.classList.toggle('active', shown.speed === i));
    }
    this.syncMenu();
    if (this.game.tool.selected !== shown.selected) {
      shown.selected = this.game.tool.selected;
      this.renderInfo(true);
    } else if (!this.info.hidden && this.infoDay !== s.day) {
      this.renderInfo(false);
    }
    if (!this.budget.hidden && s.budget !== shown.budget) this.renderBudget();
    for (const event of this.game.sim.takeEvents()) this.onEvent(event);
  }

  dispose(): void {
    this.unbindKeys();
    this.root.remove();
  }

  private infoDay = -1;

  private renderStats(): void {
    const s = this.game.sim.state;
    this.stats.money.textContent = num(s.money);
    this.stats.money.classList.toggle('negative', s.money < 0);
    this.stats.population.textContent = num(s.population);
    this.stats.happiness.textContent = `${Math.round(s.happiness)}`;
    this.stats.date.textContent = formatDate(s.day);
    ZONE_KINDS.forEach((zone, i) => {
      const bar = this.stats.demand[i];
      const d = s.demand[zone];
      if (!bar) return;
      bar.style.setProperty('--fill', `${Math.round(Math.abs(d) * 100)}%`);
      bar.classList.toggle('negative', d < 0);
    });
  }

  private buildTopBar(): HTMLElement {
    const stat = (label: string, value: HTMLElement): HTMLElement =>
      el('div.stat', {}, el('span.stat-label', {}, label), value);
    for (const [i, label] of ['Pause', '1x', '2x', '3x'].entries()) {
      this.speedButtons.push(el('button.speed', { onclick: () => this.setSpeed(i) }, label));
    }
    return el(
      'header.topbar',
      {},
      el('div.brand', {}, 'Townlet'),
      stat('Treasury', this.stats.money),
      stat('Residents', this.stats.population),
      stat('Happiness', this.stats.happiness),
      el(
        'div.stat.demand',
        { title: 'Demand: homes, shops, industry' },
        el('span.stat-label', {}, 'Demand'),
        el('span.bars', {}, ...this.stats.demand),
      ),
      el('div.spacer'),
      this.stats.date,
      el('div.speeds', {}, ...this.speedButtons),
      el(
        'div.turns',
        {},
        el(
          'button.ghost',
          { title: 'Turn left (Q)', onclick: () => this.game.gfx.rig.rotate(-1) },
          '\u21ba',
        ),
        el(
          'button.ghost',
          { title: 'Turn right (E)', onclick: () => this.game.gfx.rig.rotate(1) },
          '\u21bb',
        ),
      ),
      el('button.ghost', { onclick: () => this.toggleBudget() }, 'Budget'),
      el('button.ghost', { onclick: () => (this.paused ? this.resume() : this.pause()) }, 'Menu'),
    );
  }

  /** Category bar plus one hidden item panel per category; `syncMenu` picks what shows. */
  private buildMenu(): HTMLElement {
    const bar = el('nav.menu');
    CATEGORIES.forEach((cat, i) => {
      this.categoryButtons.push(
        el(
          'button.category',
          { onclick: () => this.openCategory(i) },
          el('kbd', {}, `${i + 1}`),
          cat.label,
        ),
      );
      const buttons = cat.items.map((item): [MenuItem, HTMLElement] => {
        const cost = this.game.sim.price(item.cost);
        return [
          item,
          el(
            'button.item',
            { onclick: () => this.game.tool.setTool(item.tool) },
            el('span', {}, item.label),
            el('span.cost', {}, cost === 0 ? 'Free' : num(cost)),
          ),
        ];
      });
      const panel = el('div.menu-items', {}, ...buttons.map(([, b]) => b));
      this.itemPanels.push({ panel, buttons });
      this.root.append(panel);
    });
    bar.append(...this.categoryButtons);
    return bar;
  }

  private syncMenu(): void {
    const current = this.game.tool.tool;
    const founded = this.game.sim.state.founded;
    this.categoryButtons.forEach((b, i) => b.classList.toggle('active', i === this.category));
    this.itemPanels.forEach(({ panel, buttons }, i) => {
      panel.hidden = i !== this.category;
      for (const [item, b] of buttons) {
        b.classList.toggle('active', item.tool === current);
        if (item === TOWN_HALL) b.hidden = founded;
      }
    });
  }

  private openCategory(i: number): void {
    this.category = this.category === i ? -1 : i;
    const items = CATEGORIES[this.category]?.items;
    this.game.tool.setTool(items?.length === 1 && items[0] ? items[0].tool : { kind: 'none' });
  }

  private toggleSound(): void {
    this.game.sound.toggle();
    if (this.paused) this.renderPauseMenu();
    else this.toast(this.game.sound.muted ? 'Sound off.' : 'Sound on.');
  }

  private escape(): void {
    if (this.paused) return this.resume();
    if (this.game.tool.tool.kind !== 'none' || this.category !== -1) {
      this.category = -1;
      this.game.tool.setTool({ kind: 'none' });
      return;
    }
    if (this.game.tool.selected) return this.game.tool.select(undefined);
    this.pause();
  }

  private setSpeed(speed: number): void {
    if (!this.paused) this.game.speed = speed;
  }

  private renderInfo(selectionChanged: boolean): void {
    const tile = this.game.tool.selected;
    const s = this.game.sim.state;
    this.infoDay = s.day;
    clear(this.info);
    this.info.hidden = !tile;
    if (!tile) {
      this.game.highlight(undefined);
      return;
    }
    const t = idx(tile.x, tile.y);
    const rows: [string, string][] = [];
    const id = s.buildingId[t];
    const b = id === -1 ? undefined : s.buildings.get(id);
    let title = TERRAIN_LABEL[s.terrain[t] as Terrain];
    if (b) {
      const def = BUILDINGS[b.kind];
      title = def.label;
      rows.push(['Upkeep', `${num(def.upkeep)} a month`]);
      if (def.radius > 0) rows.push(['Reach', `${def.radius} tiles`]);
      if (def.jobs > 0) rows.push(['Jobs', `${def.jobs}`]);
      if (selectionChanged) {
        this.game.highlight(footprint(b, def.radius).map((tt) => ({ x: xOf(tt), y: yOf(tt) })));
      }
    } else {
      if (selectionChanged) this.game.highlight([tile]);
      const zone = s.zone[t] as Zone;
      if (zone !== Zone.None) {
        const level = s.level[t];
        title = `${ZONE_LABEL[zone]}: ${LEVEL_LABEL[zone][level] ?? ''}`;
        rows.push(['Occupancy', `${Math.round(s.occupancy[t] * 100)}%`]);
        const fields = this.game.sim.fields();
        rows.push(['Appeal', `${Math.round(desirability(s, fields, t) * 100)}%`]);
        const warnings: string[] = [];
        if (!fields.roadAccess[t]) warnings.push('no road nearby');
        if (!fields.coverage.power[t]) warnings.push('no power');
        if (!fields.coverage.water[t]) warnings.push('no water');
        if (fields.pollution[t] > 0) warnings.push('smoke');
        if (warnings.length) rows.push(['Needs', warnings.join(', ')]);
      } else if (s.road[t]) title = 'Road';
    }
    if (s.fire[t] > 0) rows.push(['On fire', `${s.fire[t]} days left`]);
    this.info.append(
      el('h2', {}, title),
      el('p.muted', {}, `${tile.x}, ${tile.y}`),
      ...rows.map(([k, v]) => el('div.row', {}, el('span', {}, k), el('span', {}, v))),
    );
  }

  private toggleBudget(): void {
    this.budget.hidden = !this.budget.hidden;
    if (!this.budget.hidden) this.renderBudget();
  }

  private renderBudget(): void {
    const s = this.game.sim.state;
    this.shown.budget = s.budget;
    clear(this.budget);
    const slider = el<HTMLInputElement>('input', {
      type: 'range',
      min: '0',
      max: `${MAX_TAX_RATE}`,
      value: `${s.taxRate}`,
      'aria-label': 'Tax rate',
    });
    const rate = el('span.stat-value', {}, `${s.taxRate}%`);
    slider.addEventListener('input', () => {
      this.game.sim.setTaxRate(Number(slider.value));
      rate.textContent = `${this.game.sim.state.taxRate}%`;
    });
    const line = (k: string, v: number): HTMLElement =>
      el('div.row', {}, el('span', {}, k), el('span', {}, num(v)));
    const total = (k: string, v: number): HTMLElement =>
      el('div.row.total', {}, el('span', {}, k), el('span', {}, num(v)));
    this.budget.append(
      el('h2', {}, 'Budget'),
      el('div.row', {}, el('span', {}, 'Tax rate'), rate),
      slider,
      el('h3', {}, 'Last month'),
      total('Income', s.budget.income),
      ...ZONE_KINDS.map((z) => line(ZONE_LABEL[z], s.budget.taxes[z])),
      total('Expenses', s.budget.expenses),
      ...Object.entries(s.budget.upkeep).map(([k, v]) =>
        line(k === 'road' ? 'Roads' : BUILDINGS[k as BuildingKind].label, v),
      ),
      total('Balance', s.budget.income - s.budget.expenses),
    );
  }

  private toast(text: string, alarm = false): void {
    const node = el(`div.toast${alarm ? '.alarm' : ''}`, {}, text);
    this.toasts.append(node);
    while (this.toasts.childElementCount > 4) this.toasts.firstElementChild?.remove();
    fadeOut(node, 2600, 3200);
  }

  private onEvent(event: SimEvent): void {
    switch (event.kind) {
      case 'founded':
        this.card('The town is founded', 'Lay a road and zone beside it.');
        break;
      case 'service':
        this.toast(`First ${BUILDINGS[event.building].label.toLowerCase()} opens.`);
        break;
      case 'population':
        this.card(`${num(event.count)} residents`, 'The town grows.');
        break;
      case 'won': {
        const target = DIFFICULTY[this.game.sim.state.difficulty].winTarget;
        this.card('A town to be proud of', `${num(target)} residents. Carry on, mayor.`);
        break;
      }
      case 'lost':
        this.gameOver();
        break;
      case 'fire':
        this.toast(`Fire at ${event.x}, ${event.y}.`, true);
        break;
    }
    this.game.sound.play(EVENT_CUE[event.kind]);
  }

  /** Title cards show one at a time, each fading after a moment. */
  private card(title: string, subtitle: string): void {
    this.cards.push([title, subtitle]);
    this.showNextCard();
  }

  private showNextCard(): void {
    const next = this.cards.shift();
    if (this.cardShowing || !next) return;
    this.cardShowing = true;
    const node = el('div.card', {}, el('h2', {}, next[0]), el('p', {}, next[1]));
    this.root.append(node);
    fadeOut(node, 2800, 3600, () => {
      this.cardShowing = false;
      this.showNextCard();
    });
  }

  private gameOver(): void {
    const s = this.game.sim.state;
    this.game.speed = 0;
    this.showOverlay(
      'The town is bankrupt',
      el(
        'p',
        {},
        `${formatDate(s.day)}. ${num(s.population)} residents, ${num(-s.money)} in debt.`,
      ),
      el('button.primary', { onclick: () => this.callbacks.onNewTown() }, 'New town'),
    );
  }

  private pause(): void {
    if (this.paused || this.game.sim.state.status === 'lost') return;
    this.paused = true;
    this.pausedSpeed = this.game.speed;
    this.game.speed = 0;
    this.renderPauseMenu();
  }

  private resume(): void {
    this.paused = false;
    this.overlay.hidden = true;
    this.game.speed = this.pausedSpeed;
  }

  private renderPauseMenu(): void {
    this.showOverlay(
      'Paused',
      el('button.primary', { onclick: () => this.resume() }, 'Resume'),
      el('button.ghost', { onclick: () => this.postcard() }, 'Postcard'),
      el(
        'button.ghost',
        { onclick: () => this.toggleSound() },
        this.game.sound.muted ? 'Sound: off' : 'Sound: on',
      ),
      el('p.field-label', {}, 'Palette'),
      el(
        'div.swatches',
        {},
        ...PALETTE_NAMES.map((name) =>
          paletteSwatch(name, this.game.paletteName === name, () => {
            this.game.setPalette(name);
            this.renderPauseMenu();
          }),
        ),
      ),
      el('button.ghost', { onclick: () => this.callbacks.onNewTown() }, 'New town'),
    );
  }

  /** Saves a PNG of the town from the postcard angle. */
  private postcard(): void {
    const s = this.game.sim.state;
    const name = townName(s.seed);
    const card = this.game.postcard(name, formatDate(s.day));
    card.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = el<HTMLAnchorElement>('a', {
        href: url,
        download: `${name.toLowerCase().replace(/\s+/g, '-')}.png`,
      });
      // Some browsers only honour the download when the link is in the document and the URL is still live.
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }

  private showOverlay(title: string, ...body: HTMLElement[]): void {
    clear(this.overlay);
    this.overlay.hidden = false;
    this.overlay.append(el('div.start-card', {}, el('h2.logo.small', {}, title), ...body));
  }

  private showHint(): void {
    clear(this.hints);
    const hint = HINTS[this.hint];
    if (!hint) return;
    const last = this.hint === HINTS.length - 1;
    this.hints.append(
      el(
        'div.hint',
        {},
        el('h3', {}, hint[0]),
        el('p', {}, hint[1]),
        el(
          'button.ghost',
          { onclick: () => (this.hint++, this.showHint()) },
          last ? 'Got it' : 'Next',
        ),
      ),
    );
  }
}

function fadeOut(node: HTMLElement, fadeAt: number, removeAt: number, then?: () => void): void {
  window.setTimeout(() => node.classList.add('fade'), fadeAt);
  window.setTimeout(() => {
    node.remove();
    then?.();
  }, removeAt);
}
