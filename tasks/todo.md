# Townlet: todo

Spec: tasks/spec.md. Tick as you go. Review rounds after every 3 or 4 code commits.
Finished items move to tasks/done.md.

## Current

### Build step 2: the Forager age

Spec section 17, step 2: the Forager playable end to end in the browser, from the camp to the
age-up's conditions. Agreed in grilling, 21 Oct 2026 (Q1 to Q8, all as recommended).

Decisions:

- Q1. The start screen gains an age row listing the ages built, Forager (the default for a new
  town) and Motor city; `?age=` sets it from the URL as `?seed=` does. The button reads "Found the
  camp" in the Forager.
- Q2, Q3. Rock and ore come from a new noise drawn after the hills, so every seed keeps its land,
  forest and heights and only some grass turns to rock or ore: two to four rock clusters and two
  to three ore clusters, each 5 to 12 tiles, at least 12 tiles from the map centre (tune). Paths
  cross them; zones and buildings refuse them with a new `rock` error, except the flint pit, which
  stands beside rock. The Motor city gets the same maps; its autoplayer bounds and README shots are
  retaken.
- Q4. "The first store" shows at the bottom of the tree with its conditions ticking, but cannot
  start until step 3 brings the Village (`later` error, "The Village comes in a later build").
- Q5. Grinding stones only raises gathering yield; the spec's grain store clause is dropped.
- Q6. Lean season: December to February. Each month start rolls the month after next, so the dog
  can warn a month ahead; easy never, normal a half chance, hard always. A lean month halves
  gathering and hunting yields; the first one toasts the drying rack as the answer.
- Q7. Signs come now, for buildings: a workplace with no workers, no path, nothing to draw on or a
  full store, and a dwelling with no path. The sign layer takes positions and a tint, so step 8
  reuses it for lots.
- Q8. Walkers: one figure per working resident outside the main building, up to 200, between a
  path tile beside its home and one beside its workplace, carrying its resource's item; their
  number falls to none with the night.
- My calls: advancement effects are data on the advancement (a building's yield, radius or beds,
  or keeping food), applied by one `effective(state, kind)` lookup; food decays 2% a day until
  Fire; happiness is (3 x food store + variety + faith) / 5 less 10 per day of hunger, where food
  store is 5 points a day of eating up to 100, variety 100 x working food kinds / 3, and faith the
  share of beds within the totem's radius 6; the snapshot gains the lean state, so the save goes
  to version 4; the palettes gain `rock`, `ore` and `path` roles; the camp's fire is an emissive
  flame the night bloom picks up, not a light; per-age path and clearing prices wait for the
  Village, the first age that charges for them.

Steps, one commit each, failure modes written as red tests first:

- [ ] 1. `feat: rock and ore on the map` (`src/sim/mapgen.ts`, `src/sim/types.ts`, `src/sim/sim.ts`,
      `scripts/mapdump.ts`, `src/render/terrain.ts`, `src/render/palette.ts`, `src/ui/hud.ts`,
      tests). Fails if: two seeds' terrain differs from before anywhere but rock and ore over grass,
      or their heights differ at all; a seed has outside two to four rock or two to three ore
      clusters, a cluster outside 5 to 12 tiles, or any within 12 of the centre or on sand, water or
      forest; a zone, tent or town hall goes on rock; a path does not. The hills hashes are
      re-pinned. Check: `npm run check`, `npm run mapdump -- budapest moonrise`.
- [ ] 2. `feat: the rest of the Forager catalogue` (`src/sim/catalogue.ts`, `src/sim/ages.ts`,
      `src/sim/sim.ts`, `src/sim/people.ts`, tests). Hunting hut, fishing hut, flint pit, totem.
      Fails if: a fishing hut not touching water is placed; a flint pit without rock within 3 or a
      hunting hut without forest within 4 makes anything; yields are not 3, 3 and 2 a worker.
- [ ] 3. `feat: Forager advancements and their effects` (`src/sim/advancements.ts`, tests). Bow,
      Nets, The dog, Shelter (Nets or Bow, optional), The first store. Fails if: food does not
      decay 2% a day before Fire or does after; a held effect does not change its yield, radius or
      beds; Shelter starts with neither Nets nor Bow; the first store starts at all, or reports a
      condition met that is not.
- [ ] 4. `feat: Forager happiness and the lean season` (`src/sim/people.ts`, `src/sim/hazards.ts`,
      `src/sim/save.ts`, `src/save.ts`, tests). Fails if: happiness differs from the formula for a
      hand-built case; a lean month comes on easy, misses on hard, falls outside winter or fails to
      halve gathering and hunting (and only those); the dog's warning is not a month ahead; the
      first lean month does not raise its event; a save round trip loses the lean state.
- [ ] 5. Review round A: `/simplify` then `/code-review` over steps 1 to 4.
- [ ] 6. `feat: the start screen and top bar follow the age` (`src/ui/startScreen.ts`,
      `src/main.ts`, `src/game.ts`, `src/ui/hud.ts`, `e2e/boot.ts`). Age row; top bar shows the
      age's stock and caps, residents and beds, happiness and the calendar, and drops the treasury
      and demand in the Forager; build menu by age (Paths, Homes, Food, Materials, Institutions,
      Storage, Bulldoze, keys 1 to 7) with materials prices; founding card, hints and error texts
      from the age's main building. Check: `npm run check`, `npm run e2e`, `npm run peek` with
      `?age=forager`, desktop and MOBILE=1.
- [ ] 7. `feat: the info panel and advancements panel` (`src/ui/hud.ts`, `src/style.css`). Info
      panel: workers "1 of 2 workers", what it made, wasted over the cap, what it needs. The
      advancements panel: the tree with prerequisites, costs, the research bar and the age-up's
      conditions. Check: `npm run check`, `npm run peek` by eye.
- [ ] 8. `feat: signs on stuck buildings` (`src/sim/people.ts`, `src/sim/sim.ts`,
      `src/render/signs.ts`, `src/game.ts`, tests). `buildingReport` gives the reasons the panel and
      the signs share. Fails if: a stuck workplace or pathless tent has no reason, or a working one
      has any. Check: `npm run check`, `npm run peek`.
- [ ] 9. Review round B over steps 6 to 8.
- [ ] 10. `feat: the Forager look` (`src/render/models.ts`, `src/render/buildings.ts`,
      `src/render/roads.ts`, `src/render/terrain.ts`). Models for the nine buildings, dirt paths,
      boulders on rock, the camp fire glowing at night. Check: `npm run peek`, day and night, each
      palette.
- [ ] 11. `feat: walkers on the paths` (`src/render/walkers.ts`, `src/game.ts`). Check: `npm run peek` at noon
      and midnight.
- [ ] 12. `test: a Forager start in the browser` (`e2e/forager.spec.ts`): boots `?age=forager`,
      founds the camp, lays a path, builds a gathering hut by forest, sees the first arrival and the
      hut's first worker, screenshot to `e2e/screenshots/forager.png`. Check: `npm run e2e`.
- [ ] 13. `test: the autoplayer plays the Forager to its age-up` (`tests/autoplayer.ts`,
      `tests/autoplay.test.ts`): from a fresh camp on each difficulty, every age-up condition met
      within a bound set from the first runs and written into the spec; never lost on easy. The
      Motor bounds are re-checked against the new maps. Check: `npm run check`.
- [ ] 14. `docs: the Forager` (README, `docs/architecture.md`), then `npm run shots`.
- [ ] 15. Review round C over steps 10 to 13. Move this item to tasks/done.md.

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
