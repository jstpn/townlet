import type { Game } from '../game';
import type { Tool } from '../input/tools';
import { bindKeys } from '../input/keymap';
import { PALETTES, PALETTE_NAMES, type PaletteName } from '../render/palette';
import {
  BUILDINGS,
  BULLDOZE_COST,
  type BuildingKind,
  ROAD_COST,
  ZONE_COST,
} from '../sim/catalogue';
import { DIFFICULTY } from '../sim/difficulty';
import { desirability } from '../sim/growth';
import { MAP_SIZE, idx, rectTiles } from '../sim/grid';
import { type CommandError, type PlanTile, type SimEvent, MAX_TAX_RATE } from '../sim/sim';
import { Terrain, Zone, type ZoneKind } from '../sim/types';
import { formatDate } from './calendar';
import { clear, el, input, money } from './dom';

type MenuItem = { label: string; cost: number; tool: Tool; key?: string };
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

const ERROR_TEXT: Record<CommandError, string> = {
  'out-of-bounds': 'That is off the map.',
  water: 'Nothing can be built on water.',
  occupied: 'Something is in the way.',
  'insufficient-funds': 'The town cannot afford that.',
  'nothing-to-build': 'Nothing to do there.',
  'needs-town-hall': 'Found the town first: place the town hall.',
  'already-built': 'A town has only one town hall.',
  protected: 'The town hall stays.',
};

const HINTS = [
  ['Roads first', 'Drag to lay a road. Everything grows within two tiles of one.'],
  ['Then zones', 'Paint homes, shops and workshops beside your roads. They fill on their own.'],
  ['Then services', 'Power and water are required; schools, clinics and parks keep people happy.'],
] as const;

const services: BuildingKind[] = [
  'windTurbine',
  'waterTower',
  'school',
  'clinic',
  'fireStation',
  'policeStation',
];
const building = (kind: BuildingKind): MenuItem => ({
  label: BUILDINGS[kind].label,
  cost: BUILDINGS[kind].cost,
  tool: { kind: 'building', building: kind },
});

const CATEGORIES: Category[] = [
  { label: 'Roads', items: [{ label: 'Road', cost: ROAD_COST, tool: { kind: 'road' } }] },
  {
    label: 'Zones',
    items: ([Zone.Residential, Zone.Commercial, Zone.Industrial] as const).map((zone) => ({
      label: ZONE_LABEL[zone],
      cost: ZONE_COST,
      tool: { kind: 'zone', zone },
    })),
  },
  { label: 'Services', items: [building('townHall'), ...services.map(building)] },
  { label: 'Decor', items: ['park', 'plaza', 'tree'].map((k) => building(k as BuildingKind)) },
  { label: 'Bulldoze', items: [{ label: 'Bulldoze', cost: BULLDOZE_COST, tool: { kind: 'bulldoze' } }] },
];

export type HudCallbacks = { onNewTown: () => void };

/** All the paper-and-ink chrome around the map. Reads game state once per frame. */
export class Hud {
  private readonly root: HTMLElement;
  private readonly stats = {
    money: el('span.stat-value'),
    population: el('span.stat-value'),
    happiness: el('span.stat-value'),
    date: el('span.date'),
    demand: [el('i.bar'), el('i.bar'), el('i.bar')],
  };
  private readonly speedButtons: HTMLElement[] = [];
  private readonly menu = el('nav.menu');
  private readonly items = el('div.menu-items');
  private readonly info = el('aside.panel.info');
  private readonly budget = el('aside.panel.budget');
  private readonly toasts = el('div.toasts');
  private readonly overlay = el('div.overlay');
  private readonly hints = el('div.hints');
  private category = -1;
  private selectionRev = -1;
  private infoDay = -1;
  private budgetOpen = false;
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
    this.root = el('div.hud');
    root.append(this.root);
    this.root.append(this.buildTopBar(), this.menu, this.items, this.info, this.budget, this.toasts);
    this.root.append(this.hints, this.overlay);
    this.renderMenu();
    this.showHint();
    this.budget.hidden = true;
    this.info.hidden = true;
    this.overlay.hidden = true;
    game.tool.onCommand = (result) => {
      if (!result.ok) this.toast(ERROR_TEXT[result.reason]);
    };
    this.unbindKeys = bindKeys({
      '1': () => this.openCategory(0),
      '2': () => this.openCategory(1),
      '3': () => this.openCategory(2),
      '4': () => this.openCategory(3),
      '5': () => this.openCategory(4),
      escape: () => this.escape(),
    });
    this.game.tool.setTool({ kind: 'none' });
  }

  /** Once per frame. */
  update(): void {
    const s = this.game.sim.state;
    this.stats.money.textContent = money(s.money);
    this.stats.money.classList.toggle('negative', s.money < 0);
    this.stats.population.textContent = Math.round(s.population).toLocaleString('en-GB');
    this.stats.happiness.textContent = `${Math.round(s.happiness)}`;
    this.stats.date.textContent = formatDate(s.day);
    const demand = [s.demand.residential, s.demand.commercial, s.demand.industrial];
    this.stats.demand.forEach((bar, i) => {
      const d = demand[i] ?? 0;
      bar.style.setProperty('--fill', `${Math.round(Math.abs(d) * 100)}%`);
      bar.classList.toggle('negative', d < 0);
    });
    this.speedButtons.forEach((b, i) => b.classList.toggle('active', this.game.speed === i));
    if (this.game.tool.selectionRev !== this.selectionRev || this.infoDay !== s.day) {
      this.selectionRev = this.game.tool.selectionRev;
      this.infoDay = s.day;
      this.renderInfo();
    }
    if (this.budgetOpen && s.day % 30 === 0) this.renderBudget();
    for (const event of this.game.sim.takeEvents()) this.onEvent(event);
  }

  dispose(): void {
    this.unbindKeys();
    this.root.remove();
  }

  private buildTopBar(): HTMLElement {
    const stat = (label: string, value: HTMLElement): HTMLElement =>
      el('div.stat', {}, el('span.stat-label', {}, label), value);
    for (const [i, label] of ['Pause', '1x', '2x', '3x'].entries()) {
      this.speedButtons.push(
        el('button.speed', { type: 'button', onclick: () => this.setSpeed(i) }, label),
      );
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
      el('button.ghost', { type: 'button', onclick: () => this.toggleBudget() }, 'Budget'),
      el('button.ghost', { type: 'button', onclick: () => this.togglePause() }, 'Menu'),
    );
  }

  private renderMenu(): void {
    clear(this.menu);
    CATEGORIES.forEach((cat, i) => {
      this.menu.append(
        el(
          `button.category${i === this.category ? '.active' : ''}`,
          { type: 'button', onclick: () => this.openCategory(i) },
          el('kbd', {}, `${i + 1}`),
          cat.label,
        ),
      );
    });
    clear(this.items);
    const cat = CATEGORIES[this.category];
    this.items.hidden = !cat;
    if (!cat) return;
    const founded = this.game.sim.state.townHallId !== undefined;
    for (const item of cat.items) {
      if (item.tool.kind === 'building' && item.tool.building === 'townHall' && founded) continue;
      const active = JSON.stringify(item.tool) === JSON.stringify(this.game.tool.tool);
      const cost = Math.round(item.cost * DIFFICULTY[this.game.sim.state.difficulty].costMultiplier);
      this.items.append(
        el(
          `button.item${active ? '.active' : ''}`,
          { type: 'button', onclick: () => this.pick(item.tool) },
          el('span', {}, item.label),
          el('span.cost', {}, cost === 0 ? 'Free' : money(cost)),
        ),
      );
    }
  }

  private openCategory(i: number): void {
    this.category = this.category === i ? -1 : i;
    if (this.category === -1) this.game.tool.setTool({ kind: 'none' });
    else {
      const first = CATEGORIES[i]?.items[0];
      if (first && CATEGORIES[i]?.items.length === 1) this.game.tool.setTool(first.tool);
    }
    this.renderMenu();
  }

  private pick(tool: Tool): void {
    this.game.tool.setTool(tool);
    this.renderMenu();
  }

  private escape(): void {
    if (this.paused) return this.togglePause();
    if (this.game.tool.tool.kind !== 'none' || this.category !== -1) {
      this.category = -1;
      this.game.tool.setTool({ kind: 'none' });
      this.renderMenu();
      return;
    }
    if (this.game.tool.selected) return this.game.tool.select(undefined);
    this.togglePause();
  }

  private setSpeed(speed: number): void {
    if (this.paused) return;
    this.game.speed = speed;
  }

  private renderInfo(): void {
    const tile = this.game.tool.selected;
    clear(this.info);
    this.info.hidden = !tile;
    if (!tile) {
      this.game.highlight(undefined);
      return;
    }
    const s = this.game.sim.state;
    const t = idx(tile.x, tile.y);
    const rows: [string, string][] = [];
    const id = s.buildingId[t];
    const b = id === -1 ? undefined : s.buildings.get(id);
    let title = TERRAIN_LABEL[s.terrain[t] as Terrain];
    if (b) {
      const def = BUILDINGS[b.kind];
      title = def.label;
      rows.push(['Upkeep', `${money(def.upkeep)} a month`]);
      if (def.radius > 0) rows.push(['Reach', `${def.radius} tiles`]);
      if (def.jobs > 0) rows.push(['Jobs', `${def.jobs}`]);
      const r = def.radius;
      this.game.highlight(
        rectTiles(b.x - r, b.y - r, b.x + def.size - 1 + r, b.y + def.size - 1 + r).map(
          (tt): PlanTile => ({ x: tt % MAP_SIZE, y: Math.floor(tt / MAP_SIZE), status: 'keep' }),
        ),
      );
    } else {
      this.game.highlight([{ x: tile.x, y: tile.y, status: 'keep' }]);
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
    this.info.append(
      el('h2', {}, title),
      el('p.muted', {}, `${tile.x}, ${tile.y}`),
      ...rows.map(([k, v]) => el('div.row', {}, el('span', {}, k), el('span', {}, v))),
    );
  }

  private toggleBudget(): void {
    this.budgetOpen = !this.budgetOpen;
    this.budget.hidden = !this.budgetOpen;
    if (this.budgetOpen) this.renderBudget();
  }

  private renderBudget(): void {
    const s = this.game.sim.state;
    clear(this.budget);
    const slider = input('', {
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
      el('div.row', {}, el('span', {}, k), el('span', {}, money(v)));
    const taxes = ([Zone.Residential, Zone.Commercial, Zone.Industrial] as const).map((z) =>
      line(ZONE_LABEL[z], s.budget.taxes[z]),
    );
    const upkeep = Object.entries(s.budget.upkeep).map(([k, v]) =>
      line(k === 'road' ? 'Roads' : BUILDINGS[k as BuildingKind].label, v),
    );
    this.budget.append(
      el('h2', {}, 'Budget'),
      el('div.row', {}, el('span', {}, 'Tax rate'), rate),
      slider,
      el('h3', {}, 'Last month'),
      el('div.row.total', {}, el('span', {}, 'Income'), el('span', {}, money(s.budget.income))),
      ...taxes,
      el('div.row.total', {}, el('span', {}, 'Expenses'), el('span', {}, money(s.budget.expenses))),
      ...upkeep,
      el(
        'div.row.total',
        {},
        el('span', {}, 'Balance'),
        el('span', {}, money(s.budget.income - s.budget.expenses)),
      ),
    );
  }

  private toast(text: string): void {
    const node = el('div.toast', {}, text);
    this.toasts.append(node);
    while (this.toasts.childElementCount > 4) this.toasts.firstElementChild?.remove();
    window.setTimeout(() => node.classList.add('fade'), 2600);
    window.setTimeout(() => node.remove(), 3200);
  }

  private onEvent(event: SimEvent): void {
    switch (event.kind) {
      case 'founded':
        this.card('The town is founded', 'Lay a road and zone beside it.');
        this.renderMenu();
        break;
      case 'service':
        this.toast(`First ${BUILDINGS[event.building].label.toLowerCase()} opens.`);
        break;
      case 'population':
        this.card(`${event.count.toLocaleString('en-GB')} residents`, 'The town grows.');
        break;
      case 'won': {
        const target = DIFFICULTY[this.game.sim.state.difficulty].winTarget;
        this.card('A town to be proud of', `${target.toLocaleString('en-GB')} residents. Carry on, mayor.`);
        break;
      }
      case 'lost':
        this.gameOver();
        break;
    }
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
    window.setTimeout(() => node.classList.add('fade'), 2800);
    window.setTimeout(() => {
      node.remove();
      this.cardShowing = false;
      this.showNextCard();
    }, 3600);
  }

  private gameOver(): void {
    const s = this.game.sim.state;
    this.game.speed = 0;
    this.showOverlay(
      'The town is bankrupt',
      el('p', {}, `${formatDate(s.day)}. ${Math.round(s.population)} residents, ${money(s.money)} in debt.`),
      el('button.primary', { type: 'button', onclick: () => this.callbacks.onNewTown() }, 'New town'),
    );
  }

  private togglePause(): void {
    if (this.paused) {
      this.paused = false;
      this.overlay.hidden = true;
      this.game.speed = this.pausedSpeed;
      return;
    }
    if (this.game.sim.state.status === 'lost') return;
    this.paused = true;
    this.pausedSpeed = this.game.speed;
    this.game.speed = 0;
    const swatches = el(
      'div.swatches',
      {},
      ...PALETTE_NAMES.map((name) => this.paletteSwatch(name)),
    );
    this.showOverlay(
      'Paused',
      el('button.primary', { type: 'button', onclick: () => this.togglePause() }, 'Resume'),
      el('p.field-label', {}, 'Palette'),
      swatches,
      el('button.ghost', { type: 'button', onclick: () => this.callbacks.onNewTown() }, 'New town'),
    );
  }

  private paletteSwatch(name: PaletteName): HTMLElement {
    const p = PALETTES[name];
    return el(
      `button.swatch${this.game.paletteName === name ? '.active' : ''}`,
      {
        type: 'button',
        onclick: () => {
          this.game.setPalette(name);
          this.togglePause();
          this.togglePause();
        },
      },
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
          { type: 'button', onclick: () => (this.hint++, this.showHint()) },
          last ? 'Got it' : 'Next',
        ),
      ),
    );
  }
}

