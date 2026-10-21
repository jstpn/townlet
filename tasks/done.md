# Done

Finished items from tasks/todo.md, numbers as they were. Spec: tasks/spec.md.

## Build step 1: the people engine

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

- [x] 1. `feat: an age, its resources and the stock with caps` (`src/sim/ages.ts`,
      `src/sim/catalogue.ts`, `src/sim/difficulty.ts`, `src/sim/sim.ts`, `tests/stock.test.ts`).
      Fails if: a new forager sim on normal holds anything but 15 food, 10 wood, 10 stone; caps
      are not 60, 40, 40; a drying rack does not raise food to 120; a motor sim holds stock or
      loses its v1 money; the camp is not the forager's first building; a townHall is accepted in
      the forager age or a tent in the motor city; a tent costs anything but 4 wood (5 on hard,
      rounded) or goes up with 3 wood; a forager path costs anything. Check: `npm run check`.
      The snapshot gains the age and stock here, so `SAVE_VERSION` goes to 3 now and stays at 3
      through step 5, since nothing between is released.
- [x] 2. `feat: residents arrive for beds and food, eat and leave` (`src/sim/people.ts`,
      `tests/people.test.ts`). Fails if: nobody arrives at a camp with food in stock; anyone
      arrives faster than `arrivalDays`, past the beds, or with food for under ten days;
      residents do not eat one food a day; an empty food stock does not send one away every
      `starveDays` days, stop arrivals and dent happiness; the last one leaving does not lose the
      game on normal or does on easy; the motor city's population changes behaviour. Check:
      `npm run check`.
- [x] 3. `feat: workplaces take the nearest residents and make stock` (`src/sim/people.ts`,
      `tests/people.test.ts`). Fails if: a gathering hut by forest and a path makes anything but
      2 food a worker a day; a hut with no path or no forest within 3 takes workers; the nearer of
      two huts does not fill first; residents fill more slots than there are residents; stock
      passes its cap; the overflow is not recorded for the panel. Check: `npm run check`.
- [x] 4. `feat: advancements researched one at a time` (`src/sim/advancements.ts`,
      `tests/advancements.test.ts`). Fails if: Fire is not available at a founded camp; Grinding
      stones is available without Fire or without a gathering hut standing; research starts while
      another runs, without the stock, or twice; the cost is not paid at once; it completes in
      other than 30 days on normal (24 easy, 38 hard, rounded); completion does not raise an
      event. Check: `npm run check`.
- [x] 5. `test: save version 3` (`src/sim/save.ts`, `src/save.ts`, `tests/save.test.ts`). Fails
      if: a forager town mid-research does not round-trip and then simulate identically; a
      version 2 save is read. Check: `npm run check`, `npm run e2e`.
- [x] 6. Review round: `/simplify` then `/code-review` over steps 1 to 4 (run before step 5,
      at four code commits), fixes as `chore:`, gate
      rerun with output shown.

## Stretch, in order

- [x] Boats and birds
- [x] Hills with terraces
- [x] Synthesised audio
- [x] Touch controls
- [x] Review round E

## Core

- [x] 1. Scaffold: Vite, TS strict, ESLint, Prettier, Vitest, Playwright, blank scene renders
- [x] 2. Sim: seeded RNG, typed grids, map generation with tests
- [x] 3. Render: terrain, water, trees, palette sets, orthographic camera and controls
- [x] 4. Roads: sim, auto-tiling, render, drag tool, tests
- [x] 5. Zones, building catalogue, placement rules, bulldoze, placeholder meshes, tests
- [x] Review round A
- [x] 6. Coverage, pollution, demand, growth, occupancy, population, tests
- [x] 7. Economy, tax, happiness, debt, win and lose, tests
- [x] 8. HUD: start screen, top bar, build menu, info panel, budget, toasts, title cards, pause menu, hints
- [x] Review round B
- [x] 9. Procedural buildings for every type, level and service; windows; variants
- [x] 10. Fire: sim and effects, tests
- [x] 11. Cars on the road graph
- [x] 12. Autosave and continue, tests
- [x] Review round C
- [x] 13. Post-processing, day and night polish, postcard
- [x] 14. Balance pass with the autoplayer test
- [x] 15. Playwright smoke, README with screenshots
- [x] Review round D
