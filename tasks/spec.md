# Townlet: spec

Agreed 20 October 2026. This is the contract for the build. Decisions here are
settled. Numbers are starting values; the balance pass may change any marked
"tune", and the change gets noted here.

## 1. What it is

A small, beautiful city builder for the desktop browser. Lay roads, zone land,
place a few services, watch a town grow. Three numbers matter: money, population
and happiness. Three difficulty levels change how hard the economy pushes back.
The look is procedural low-poly 3D in Wes Anderson palettes.

Not in version one: weather, traffic simulation, power lines or pipes,
loans, multiple save slots, accounts, any backend.

## 2. Stack

- Vite 8, TypeScript strict, Three.js 0.186 used directly. No React Three Fiber.
- Simulation: pure TypeScript with no DOM or Three imports. Deterministic from a
  seed plus the list of commands. Vitest, tests written first.
- HUD: plain DOM and CSS driven by a small observable store.
- ESLint flat config and Prettier. `npm run check` runs lint, typecheck, prettier, tests.
- Playwright: a smoke test, a touch test, and tagged specs for pictures and peeks.
- npm through the socket hook, package-lock committed.
- Git on `dev`. Public GitHub repo `jstpn/townlet`, MIT. Deployment deferred:
  Joe plays locally for now.

## 3. World

- 64 x 64 tiles. Tile kinds: water, sand, grass, forest. Water is unbuildable.
  Building on forest clears it for the bulldoze fee.
- Generated from a seed string: seeded PRNG, simplex noise land mask with a
  radial falloff so a coast surrounds the map, plus one feature picked by the
  seed: a river from an edge to the sea, or a lake. Sand where land meets water.
  Forest patches from a second noise layer. Retry with an internal seed variant
  until at least 40% of tiles are buildable (tune).
- Orthographic camera. Four snap rotations with Q, E or right-drag. Wheel zoom.
  Pan with WASD, arrows, middle-drag or edge pan.

## 4. Building

| Item             | Size  | Cost | Upkeep / month | Radius | Notes                                                                                       |
| ---------------- | ----- | ---- | -------------- | ------ | ------------------------------------------------------------------------------------------- |
| Road             | 1     | 10   | 1              |        | Dragged in straight axis-aligned lines. Auto-tiles into straight, corner, T, cross, end     |
| Residential zone | 1     | 5    |                |        | Painted as a rectangle                                                                      |
| Commercial zone  | 1     | 5    |                |        | Painted as a rectangle                                                                      |
| Industrial zone  | 1     | 5    |                |        | Painted as a rectangle. Emits pollution                                                     |
| Town hall        | 2 x 2 | 0    | 0              | 6      | First act of every game. Provides power, water and every service in its radius, and 20 jobs |
| Wind turbine     | 1     | 300  | 20             | 8      | Power                                                                                       |
| Water tower      | 1     | 250  | 15             | 8      | Water                                                                                       |
| Park             | 1     | 100  | 5              | 4      | Happiness and desirability                                                                  |
| School           | 2 x 2 | 400  | 40             | 10     |                                                                                             |
| Clinic           | 1     | 500  | 50             | 10     |                                                                                             |
| Fire station     | 1     | 450  | 40             | 10     | Fights fires                                                                                |
| Police station   | 1     | 450  | 40             | 10     |                                                                                             |
| Tree             | 1     | 5    | 0              |        | Decoration                                                                                  |
| Plaza            | 1     | 60   | 2              | 2      | Small desirability boost                                                                    |
| Bulldoze         |       | 2    |                |        | Also clears forest                                                                          |

Radius is Chebyshev distance in tiles from any footprint tile. Costs are for
normal difficulty before the multiplier.

Placement: a footprint must sit entirely on grass, sand or forest with no road
or building on it. A zoned tile only develops within 2 tiles (Chebyshev) of a
road. Services need no road.

## 5. Simulation

Time: one game day is one sim step. At 1x a day lasts 0.5 s, so a 30 day month
is 15 s. Speeds: pause, 1x, 2x, 3x. The economy settles on the first day of each
month. Start: January, year 1.

Each zoned tile holds a level 0 to 3 and an occupancy 0 to 1.

| Zone                             | Level 1 | Level 2 | Level 3 |
| -------------------------------- | ------- | ------- | ------- |
| Residential capacity (residents) | 4       | 12      | 30      |
| Commercial capacity (jobs)       | 3       | 8       | 20      |
| Industrial capacity (jobs)       | 5       | 12      | 25      |

Population is the sum of residential capacity times occupancy. Workers are
population times 0.4. Jobs are commercial plus industrial capacity times
occupancy, plus the town hall's 20.

Demand, each clamped to -1 to 1, recomputed daily, shown as the three-bar gauge:

- Residential: (jobs - workers) / max(jobs, 20), plus a 0.2 baseline that fades
  to 0 by 500 residents.
- Commercial: (population / 3 - commercial jobs) / max(population / 3, 10),
  plus a 0.1 baseline.
- Industrial: (population / 5 - industrial jobs) / max(population / 5, 10),
  plus a 0.15 export baseline.

The job targets add up to more than the workers, so a town that keeps up with
its shops and factories always has room for more homes (the balance pass found
the old 0.6 workers stalled every town near 300 residents).

Hard requirements for any development: power coverage and water coverage.
Without both, the tile shows a warning marker and never grows.

Desirability per zoned tile, 0 to 1:

- Residential: 0.3 base; +0.15 each for school, clinic, police and fire
  coverage; +0.1 within a park radius; +0.05 within a plaza radius; -0.4 times
  pollution.
- Commercial: 0.3 base; +0.4 times min(1, residents within 6 tiles / 40);
  +0.15 police; +0.1 park; -0.2 times pollution.
- Industrial: 0.6 base; +0.2 fire coverage; +0.2 if within 4 tiles of another
  developed industrial tile.

Growth, checked daily per zoned tile with the sim's own RNG:

- Level up when demand > 0, desirability > 0.35 + 0.15 x level, and a roll
  under growthRate x demand x desirability (growthRate per difficulty, tune).
- Occupancy moves toward 1 by 0.05 per day when demand > -0.2 and happiness is
  at or above the leave threshold; otherwise toward 0 by 0.03 per day.
- Level down when occupancy < 0.1 for 30 days with negative demand, or when
  desirability < 0.2 for 60 days.
- A zoned tile without road access stays at level 0.

Pollution: each developed industrial tile emits 1.0 at its tile falling
linearly to 0 at radius 3 + level. The field is the max over emitters,
recomputed when industry changes.

Coverage: one boolean grid per service kind, recomputed when services change.
The town hall covers every kind.

Economy, settled monthly:

- Income = sum over developed zone tiles of taxBase x occupancy x (taxRate / 10).
  Tax base per level: residential 2, 6, 15; commercial 3, 8, 20; industrial
  4, 10, 22. Tax rate 0 to 20, default 10.
- Expenses = building upkeep plus road upkeep, times the difficulty upkeep
  multiplier.
- No loans. Money may go negative. Below the debt limit the game ends on normal
  and hard.

Happiness 0 to 100, recomputed daily as a weighted mean:

| Factor     | Score                                                       | Weight |
| ---------- | ----------------------------------------------------------- | ------ |
| Tax        | 100 at 0%, 60 at 10%, 0 at 20%, linear between              | 2      |
| Coverage   | share of residents with all of school, clinic, police, fire | 2      |
| Parks      | share of residents within a park or plaza radius            | 1      |
| Pollution  | 100 minus share of residents on polluted tiles              | 2      |
| Employment | min(1, jobs / workers)                                      | 2      |

Residents leave below the leave threshold.

Fire:

- Each month, with probability fireChance, a fire starts on a random developed
  or service tile.
- Each day a burning tile spreads to each orthogonal developed neighbour with
  probability 0.2, or 0.05 when the neighbour has fire coverage.
- A tile burns 3 days with fire coverage, 10 without. A burnt zone tile drops to
  level 0 and keeps its zone. A burnt service is destroyed.

Milestones show a title card: founding; 100, 500, 1000, 2500, 5000 and 10000
residents; the first of each service; win; game over.

## 6. Difficulty

|                             | Easy  | Normal | Hard  |
| --------------------------- | ----- | ------ | ----- |
| Starting money              | 20000 | 10000  | 6000  |
| Cost multiplier             | 0.8   | 1.0    | 1.25  |
| Upkeep multiplier           | 0.8   | 1.0    | 1.3   |
| Growth rate                 | 0.05  | 0.035  | 0.025 |
| Leave threshold (happiness) | 30    | 40     | 50    |
| Fire chance per month       | 0     | 0.15   | 0.5   |
| Debt limit                  | none  | -5000  | -2000 |
| Win target (residents)      | 2000  | 5000   | 10000 |

Winning shows a card and the game continues. Losing shows a card with final
stats and a new town button. Every value here is tune.

## 7. Look

Role-based palette: grass, grass alt, sand, water deep, water shallow, foliage,
trunk, road, road line, four wall tones, four roof tones, trim, window glow,
sky, fog, sun, night tint. Four sets: Budapest (default: pinks, plum, cream,
red), Moonrise (mustard, olive, khaki, dusty red), Darjeeling (turquoise,
saffron, maroon, sand), Asteroid (peach, mint, sand, rust). Chosen on the start
screen, switchable from the pause menu. The UI keeps a fixed cream paper and
ink scheme with one red accent.

Geometry is all procedural and flat shaded. Residential levels: cottage,
townhouse, apartment block. Commercial: kiosk, shop with awning, department
store. Industrial: workshop, factory with chimney, large plant. Each service
has its own silhouette: spinning turbine, water tower on legs, school with a
bell tower, clinic with a cross, fire station with a hose tower, police station
with a lamp, town hall with a dome and symmetrical wings. Wall and roof variants
come from the tile position so neighbours differ. Windows are a separate
instanced emissive mesh that glows at night.

Rendering: instanced meshes per piece, a directional sun with soft shadows, a
hemisphere light, fog matched to the palette, a water plane with a gentle
vertex wave and a lighter shallow band. Post-processing: light bloom for
windows, a faint vignette, very light grain.

Day and night: one lighting cycle every 120 game days (60 s at 1x): dawn, flat
midday, golden hour, short dusk, short night. Night tints toward the palette's
night colour rather than going dark.

Life: cars as small instanced boxes following the road graph between a
residential tile and a job tile, with a lane offset, capped at 150. Fire shows
flame billboards and smoke puffs.

Postcard: hides the HUD, snaps to rotation 0, fits the built area, draws a title
card with the town name and date, downloads a PNG.

## 8. HUD

- Start screen: logo, difficulty, palette swatches, seed field with randomise,
  "Found the town". "Continue" when an autosave exists.
- Top bar: money, population, happiness, date, demand gauge, speed buttons.
- Build menu: Roads, Zones, Services, Decor, Bulldoze. Keys 1 to 5 switch
  category. Escape clears the tool. Each item shows its cost.
- Info panel on click: tile or building details, coverage ring on the map.
- Budget panel: tax slider, last month's income and expenses by line.
- Toasts for events and warnings. Title cards for milestones.
- Pause menu: resume, postcard, palette, new town.
- Three hint cards on a new game: roads, zoning, services.
- Font: Jost from fontsource, self-hosted.

## 9. Saving

One autosave in localStorage, written every game month and after every command,
restored by "Continue". The save is the serialised sim state plus camera and
palette.

## 10. Quality bar

- Sim modules are test-first with Vitest.
- A headless autoplayer test builds a sensible town on each difficulty (town
  hall near the centre of the largest land region, a road grid every 5 tiles,
  zones in a 3:1:1 ratio, services bought when money allows) and asserts it
  reaches the win target within a bounded number of months (tune) and never
  ends on easy.
- ESLint and Prettier clean. Playwright smoke passes and leaves a screenshot in
  `e2e/screenshots`.
- Simplify and code review every three or four code commits, per the global
  rules.

## 11. Build order

1. Scaffold and a blank scene
2. Sim: RNG, grids, map generation
3. Render: terrain, water, trees, palette, camera
4. Roads: sim, auto-tiling, render, drag tool
5. Zones, catalogue, placement, bulldoze, placeholder buildings
6. Coverage, pollution, demand, growth, population
7. Economy, tax, happiness, win and lose
8. HUD
9. Procedural buildings, windows, variants
10. Fire
11. Cars
12. Autosave
13. Post-processing, day and night polish, postcard
14. Balance pass with the autoplayer
15. Smoke test, README with screenshots
16. Stretch, in order: boats and birds, hills with terraces, audio, touch

## 12. Open items, my call

- Noise parameters and the 40% buildable threshold.
- Car count scaling and route refresh rate.
- Title card copy and the town name generator.
