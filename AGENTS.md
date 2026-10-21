# Townlet

A small city builder for the browser in Wes Anderson palettes: procedural island, roads, zones, services, three difficulties.

@tasks/lessons.md

## Tech Stack

- **Language:** TypeScript 6 strict, Node 26 locally (no `engines` pin)
- **Framework:** Vite 8 with Three.js 0.186 used directly, no React
- **Database:** none; one autosave in localStorage
- **Frontend:** plain DOM and CSS for the HUD, Jost from fontsource
- **Tests:** Vitest 5 for the sim, Playwright 1.63 for the browser
- **Package manager:** npm, `package-lock.json` committed

## Commands

- `npm run dev` - Vite on http://localhost:5173
- `npm run check` - lint, typecheck, prettier, unit tests. Must pass, with its output shown, before a change is called done
- `npm run e2e` - Playwright suite on a dev server at port 4173. Same rule
- `npm run peek` - one screenshot of the running game for checking a change by eye; variables at the top of `e2e/peek.spec.ts`
- `npm run shots` - retakes the README screenshots from an autoplayed town. Commit them only with a visual change

Everything else: docs/commands.md

## Architecture

`src/main.ts` shows the start screen, then builds a `Game`, which owns the `Sim`, the renderer,
the input tools and the sound. Each frame advances the sim by whole days at the chosen speed, then
every render layer compares the sim's revision counters with its own and rebuilds only what
changed. Nothing in `src/sim` knows about Three.js or the DOM.

Full picture: docs/architecture.md

| Module | Path                         | Purpose                                                                                          |
| ------ | ---------------------------- | ------------------------------------------------------------------------------------------------ |
| Sim    | `src/sim/`                   | Deterministic town simulation: grids, map generation, commands, growth, economy, fire, snapshots |
| Render | `src/render/`                | Three.js layers, camera rig, palettes, daylight, post-processing                                 |
| Input  | `src/input/`                 | Pointer and touch tracking, camera controls, the build tool                                      |
| UI     | `src/ui/`                    | Start screen, HUD, panels, title cards, pause menu                                               |
| Audio  | `src/audio/sound.ts`         | Synthesised ambience and cues, no audio files                                                    |
| Game   | `src/game.ts`, `src/save.ts` | Frame loop, layer list, autosave file                                                            |
| Tests  | `tests/`, `e2e/`             | Vitest per sim module plus a headless autoplayer; Playwright smoke, touch, peek, shots           |

## Coding Standards

- Sim state lives in typed-array grids indexed with `idx(x, y)` from `src/sim/grid.ts`; commands return a `CommandResult` and bump a counter in `state.rev` for whatever they changed.
- A render layer implements `Layer` in `src/render/layer.ts`: `sync(state, palette)` rebuilds on a revision change and returns whether it did; `animate(dt)` runs on wall time, even while paused.
- Tile heights come from `groundY(state.height, tile)` in `src/render/ground.ts`. A layer that animates without state copies the grid in `sync`, as cars and fire do.
- Sim tests sit beside their module name in `tests/`; browser tests boot through `e2e/boot.ts`. Pictures and peeks are tagged `@shots` and `@peek` and stay out of `npm run e2e`.
- Balance numbers are starting values from `tasks/spec.md`; a change there is noted in the spec.

## Testing

- Never write unit tests after you write code.
- Highly prefer E2E tests as the sole testing mechanism. Use them to verify complex features work. At the end of E2E tests, produce a verifiable and repeatable artifact.
- If you must test a system in isolation, first write down all the ways it could fail, then write the code.

## Skills

- `mattpocock-skills:grilling` (Codex: `$grilling`) - before planning any change that won't fit in one sentence (new feature, schema change, new dependency, architecture): grill Joe first, then write the agreed plan to `tasks/todo.md`
- `/simplify` then `/code-review` (Codex: `$refactor` then `$review`) - after every 3 or 4 commits that change code (docs-only commits and tiny fixes don't count), run both on those commits without asking: apply the findings, run the gate again, and commit the fixes as `chore:`
- `mattpocock-skills:retro` (Codex: `$retro`) - at the end of a session, when Joe asks: a retrospective on the session that proposes fixes to AGENTS.md, rules, checks and tooling, most severe first. Apply the ones Joe agrees with
- `/typescript-best-practices` - `.ts` files and `tsconfig.json`
- `/tdd` - `src/sim`: growth, economy, fire, map generation, commands
- `/improve-threejs` - `src/render` when frame time or GPU memory is in question

## Commit Conventions

- `type: subject` (`feat:`, `fix:`, `chore:`, `docs:`, `test:`)
- One concern per commit
- Everyday work on `dev`; `main` is unused until the game is deployed

## Deployment

- **Local only.** `npm run dev`; deployment is deferred by Joe's choice.
- **CI.** `.github/workflows/check.yml` runs `check` and `e2e` on every push to `dev` or `main`.
- When it does deploy: `npm run build` emits a static `dist/`, so the Coolify Static build pack on the test box is enough. No database, scheduled tasks or Dockerfile.

## Don't

- Randomness in `src/sim` comes from `this.rng` only, so a seed plus the command list replays a town exactly. `Math.random` belongs to render-side flourishes.
- A typed-array field initialised with `new Uint8Array(0)` is typed `Uint8Array<ArrayBuffer>` by TypeScript 6 and rejects the sim's `ArrayBufferLike` grids. Annotate the field with the bare type.
- A change to the snapshot shape bumps `SAVE_VERSION` in `src/save.ts`; old saves are ignored, never migrated.
- Prettier is part of `npm run check`. Format only the files you touched, so a chore commit stays surgical.
- Three.js r186 removed `PCFSoftShadowMap` and deprecated `Clock`; use `PCFShadowMap` and `Timer`.

## Documentation

| File                   | Purpose                                                  |
| ---------------------- | -------------------------------------------------------- |
| `docs/architecture.md` | Directory tree, frame loop, module reference, data flow  |
| `docs/commands.md`     | Every npm script                                         |
| `tasks/spec.md`        | The agreed design contract and balance numbers, the ages |
| `docs/ages.md`         | Research reference behind the ages: eras, games, sources |
| `docs/archive/`        | Retired documents, kept word for word (spec-v1.md)       |
| `tasks/done.md`        | The build order as shipped                               |
| `e2e/peek.spec.ts`     | Screenshot variables for `npm run peek`                  |
