# Townlet: todo

Spec: tasks/spec.md. Tick as you go. Review rounds after every 3 or 4 code commits.
Finished items move to tasks/done.md.

## Current

### Build step 1: the people engine

Spec section 17, step 1. The engine counts people and stock; the current game keeps running
untouched as the Motor city (the default age until step 2 adds the choice on the start screen).

Decisions, my calls within the spec, flagged for Joe:

- The engine needs buildings with beds and slots to be tested at all, and the Motor city has none
  until step 8. So the first Forager buildings land here as its test bed, in the sim only: camp,
  tent, gathering hut, woodcutter, drying rack, and the Fire and Grinding stones advancements
  without their effects. Step 2 finishes the Forager age (the rest of its buildings, effects,
  hazard, happiness inputs, look, start screen, hints) and makes it playable.
- Walkers move to step 2: nothing in the sim reads them, and there is no playable age to see
  them in until then.
- Inputs (a workplace that consumes a resource) wait for the first age that has one (Village).
- The Motor city branch stays a plain `age === 'motor'` check in `step()` until step 8 folds the
  v1 economy onto the engine. `money` stays the treasury; coin is `money`.
- A building's coin price stays `cost`; its resource price is a new `materials` stock, both
  scaled by the cost multiplier. A plan carries both; short stock is a new `short` error.
- Caps are the age's base caps plus every standing building's `caps`, cached on
  `rev.buildings`. Starting stock is the difficulty's share of the age's base caps.
- Arrivals need a free bed and food for ten days of the town plus the newcomer. Leaving takes
  one resident every `starveDays` days while the food runs out or happiness sits under the leave
  threshold; the last one leaving loses the game on normal and hard. Until step 2 brings the
  Forager's inputs, an engine age's happiness is 100 less 10 per day of hunger.
- Slots fill in order of Manhattan distance from a workplace's corner to the nearest bed-holding
  building's corner, ties by building id. A workplace with no path within two tiles, or without
  its terrain (forest) within its radius, takes nobody and makes nothing.
- Research takes 30 days times the difficulty's multiplier (tune), one at a time.

Steps, one commit each, failure modes written as red tests first:

- [ ] 1. `feat: an age, its resources and the stock with caps` (`src/sim/ages.ts`,
      `src/sim/catalogue.ts`, `src/sim/difficulty.ts`, `src/sim/sim.ts`, `tests/stock.test.ts`).
      Fails if: a new forager sim on normal holds anything but 15 food, 10 wood, 10 stone; caps
      are not 60, 40, 40; a drying rack does not raise food to 120; a motor sim holds stock or
      loses its v1 money; the camp is not the forager's first building; a townHall is accepted in
      the forager age or a tent in the motor city; a tent costs anything but 4 wood (5 on hard,
      rounded) or goes up with 3 wood; a forager path costs anything. Check: `npm run check`.
- [ ] 2. `feat: residents arrive for beds and food, eat and leave` (`src/sim/people.ts`,
      `tests/people.test.ts`). Fails if: nobody arrives at a camp with food in stock; anyone
      arrives faster than `arrivalDays`, past the beds, or with food for under ten days;
      residents do not eat one food a day; an empty food stock does not send one away every
      `starveDays` days, stop arrivals and dent happiness; the last one leaving does not lose the
      game on normal or does on easy; the motor city's population changes behaviour. Check:
      `npm run check`.
- [ ] 3. `feat: workplaces take the nearest residents and make stock` (`src/sim/people.ts`,
      `tests/people.test.ts`). Fails if: a gathering hut by forest and a path makes anything but
      2 food a worker a day; a hut with no path or no forest within 3 takes workers; the nearer of
      two huts does not fill first; residents fill more slots than there are residents; stock
      passes its cap; the overflow is not recorded for the panel. Check: `npm run check`.
- [ ] 4. `feat: advancements researched one at a time` (`src/sim/advancements.ts`,
      `tests/advancements.test.ts`). Fails if: Fire is not available at a founded camp; Grinding
      stones is available without Fire or without a gathering hut standing; research starts while
      another runs, without the stock, or twice; the cost is not paid at once; it completes in
      other than 30 days on normal (24 easy, 38 hard, rounded); completion does not raise an
      event. Check: `npm run check`.
- [ ] 5. `feat: save version 3` (`src/sim/save.ts`, `src/save.ts`, `tests/save.test.ts`). Fails
      if: a forager town mid-research does not round-trip and then simulate identically; a
      version 2 save is read. Check: `npm run check`, `npm run e2e`.
- [ ] 6. Review round: `/simplify` then `/code-review` over steps 1 to 5, fixes as `chore:`, gate
      rerun with output shown.

## Later

### Stuck lots explain themselves (build step 8)

Agreed in grilling, 21 Oct 2026, then checked line by line against the code. A zoned lot that
cannot grow says why: the info panel's Needs row names what stops the next level, the bar to
beat and what would lift it, and the lot carries a small sign on the map. No balance number
changes. The goal line in the top bar, reactive hints and the fire toast are separate items.

Decisions:

- One exported function in `src/sim/growth.ts` decides, for the daily growth loop and the panel
  alike: `lotReport(state, fields, tile, settings)` returns the lot's appeal, its bar
  (`growthBar(level)`, the exact `0.35 + 0.15 * level` expression, kept so float edges at levels
  1 and 2 behave as today; no bar at level 3), `blocks` (every reason the next level is refused,
  listed road, power, water, demand, appeal; demand blocks at `demand <= 0`), `leaving` (why a
  developed lot's occupancy is falling: road, power, water, demand at or under -0.2, or unhappy;
  the two demand thresholds are different on purpose) and `declineIn` (days until the lot drops
  a level: the sooner of `60 - blightDays` while appeal is under 0.2 and `30 - starveDays` while
  starving). `stepGrowth` calls it: the roll happens only when `level < 3` and `blocks` is empty,
  so a level 3 lot never consumes a random draw and every seeded replay stays identical. Appeal
  is now computed for every zoned lot every day, a modest cost that was short-circuited before.
- Signs come from the sim, not the renderer. `Sim.stuck()` is a `Uint8Array` cached like coverage
  on the key `day + rev.roads + rev.buildings + rev.zones` (all monotonic, so the sum is a
  change key; the array is rebuilt once per day): 0 none, 1 structural (an empty lot with no
  road, power or water, or a developed lot that has lost one of them), 2 appeal (an empty lot at
  or under its bar). Demand never puts up a sign. The Game hands the grid to a sign layer from
  `syncLayers` when the cached array's identity or the palette changes, the way it drives the
  cursor layers. `Layer`, `SimState` and the save format are untouched.
- One sign shape, two tints: post and board in the palette's `road` dark for structural, board in
  `accent` for appeal. Signs appear the day a lot is zoned and vanish the moment the fix lands.
  On an empty lot the sign stands near the centre with a hashed jitter. On a developed lot the
  house fills the tile from 0.12 in, so the sign stands 0.06 in from the road-facing edge; from
  the two camera turns that look over the roof the house hides it and the panel carries the
  message. Judgement call, flagged for Joe.
- The Appeal row stays. The Needs row lists only what is missing, with its worth. Hard gates read
  "no road within 2 tiles", "no power", "no water"; demand reads "no demand for homes right now"
  (shops, industry); appeal reads "over 35% appeal to build" (or "to grow", bar 50 or 65) followed
  by the lifts the lot lacks: homes "a school, clinic, police or fire station adds 15% each, a
  park 10%, a plaza 5%" (only the uncovered ones named); shops "N residents live within 6 tiles,
  1% each up to 40%; police adds 15%, a park 10%" (N rounded); factories "a fire station adds
  20%, another factory within 4 tiles 20%". Smoke appends "smoke takes N% off" with the real
  deduction. Nothing blocking: no Needs row. Developed lots add "Residents are leaving: no
  power" (or no road, no water, "nobody wants to move here right now", "the town is unhappy")
  and "Declines in N days" with its cause ("appeal under 20%" or "standing empty"); this
  replaces today's bare warnings on built lots. Rows gain an optional class so the Needs value
  can wrap under its label.
- Q13 (refresh the panel on map changes) is dropped: every road, zone or building change needs a
  tool, and choosing a tool clears the selection, so the panel is only ever open while nothing
  but the sim can change a lot, and the sim moves once per day, which is already the refresh.
- Proof is end to end: a Playwright test plus the README shots. The report function is the one
  piece of logic that is tested in isolation, red first.

Steps, one commit each:

- [ ] 1. `feat: lot report names what stops a lot growing` (`src/sim/growth.ts`,
      `tests/growth.test.ts`). Ways it could fail, written before the code, each a red test, on
      the `foundedSim` fixture after one `step()` so demand is 1: an empty home outside every
      service radius with road, power and water reports `blocks: ['appeal']`, bar 0.35, appeal
      0.3; the same lot with no road reports road first and still reports appeal; a home at
      exactly 0.35 (base plus plaza) is blocked and a home at 0.40 (park) is not; a shop with
      exactly 5 held residents nearby (two cottages at occupancy 1 and 0.25) is blocked and with
      6 (one level 2 home at 0.5) is not; a bare factory outside the hall's reach passes levels 0
      and 1 and is blocked at level 2; a hall-covered home with `fields.pollution` set to 1 by
      hand sums to a hair under the level 2 bar and is blocked, as the float gate decides today;
      a level 3 lot has no blocks, no bar and never rolls; a developed lot that lost power
      reports `leaving: 'power'`; a developed lot at appeal 0.12 for 17 days reports
      `declineIn: 43`; a lot starving for 10 days reports `declineIn: 20`; demand exactly 0
      blocks with 'demand'; `stepGrowth` rewritten over `lotReport` leaves the determinism,
      growth and autoplay tests green. Check: `npm run check`.
- [ ] 2. `feat: the info panel says what a lot needs` (`src/ui/hud.ts`, `src/style.css`). Build
      the Needs row from `lotReport`; drop the old served and reachable checks and the bare
      'smoke' warning. `.row.needs` wraps its value under the label at full width, left aligned,
      so a long line reads in the 260 px panel. Check: `npm run check`, then `npm run peek` with
      an EVAL that flattens the island (`terrain.fill(2); height.fill(0); rev.terrain++`), founds
      the hall at (30, 30), lays a road (20, 45) to (40, 45) with a wind turbine at (28, 43) and a
      water tower at (32, 43) so both reach x 24 to 36, zones homes (24..36, 46..47), also lays a
      road (24, 33) to (37, 33) with homes (24..37, 34..35) inside the hall's reach, sets speed 0,
      steps three days and selects (30, 46); read the panel by eye on desktop and with MOBILE=1.
- [ ] 3. `feat: signs on lots that cannot grow` (`src/sim/sim.ts`, `src/render/signs.ts`,
      `src/game.ts`). `Sim.stuck()` as above. `SignLayer`: two `InstancedMesh`es at capacity
      `TILE_COUNT` as the cursor layer allocates (post: cylinder radius 0.02 from 0.02 to 0.4;
      board: box 0.22 wide, 0.14 tall, 0.03 thick at the top of the post), flat-shaded
      `MeshStandardMaterial`, no shadows, base at `groundY`, boards aligned to the x axis since
      the camera looks along a diagonal from every quarter turn; `show(stuck, state, palette)`
      and `clear()`. Game: `this.signs` beside the cursor layers, added to the scene with them,
      re-shown from `syncLayers` when `sim.stuck()` returns a new array or the palette changed.
      Check: `npm run check`, `npm run peek` with the same EVAL, HUD=0, desktop and MOBILE=1:
      signs along the far street, none on the street inside the hall's reach, gone after
      `placeBuilding('school', 29, 48)` and a step.
- [ ] 4. `test: a stuck street explains itself` (`e2e/needs.spec.ts`). The step 2 setup through
      `page.evaluate` with speed 0, then `tool.setTool({ kind: 'none' })` and a mouse click at
      `tileToScreen(30, 46)`. Assert the `aside.panel.info` text contains "over 35% appeal" and
      "school", `sim.stuck()` is 2 on every tile of (24..36, 46..47) and 0 on (24..37, 34..35).
      Place a school at (29, 48), step one day, assert the far street reads 0 and the reselected
      panel has no "over 35%". Screenshot to `e2e/screenshots/needs.png`, a local artifact like
      boot.png since that folder is gitignored. Check: `npm run e2e` green locally.
- [ ] 5. `docs: signs and the Needs row` (`tasks/spec.md` sections 7 and 10, README play
      bullet at lines 24 to 26, `docs/architecture.md` layer list, Layers row and frame flow).
      Then `npm run shots`; commit the pictures only if the hero town shows a sign.
- [ ] 6. Review round F: `/simplify` then `/code-review` over steps 1 to 4, fixes as `chore:`,
      gate rerun with output shown. Move this item to tasks/done.md.

Not in this item, noted for the list: after a drag the build tool stays active, so a player has
to press Escape before a click inspects a lot at all.

## Notes

- Deployment deferred. Joe plays locally for now.
