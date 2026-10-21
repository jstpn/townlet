# Snapshot: townlet (2026-10-21 10:14)

## Goal
Build the Townlet city builder from tasks/spec.md end to end, autonomously, through build order steps 1 to 16 plus the stretch list, with simplify and code-review rounds every 3 or 4 code commits.

## State
- Branch: dev. Last commit: b35ea03 feat: procedural buildings, windows and variants
- Uncommitted: src/game.ts, src/sim/sim.ts, src/style.css, src/ui/hud.ts (modified); src/render/fire.ts, src/sim/fire.ts, tests/fire.test.ts (new)

## Done
- Steps 5 to 9 shipped: zones and buildings, growth fields, economy, HUD, procedural instanced buildings with windows.
- Review round B (simplify 076081a, code review 3c7e818) applied; deferred the summed-area neighbour scan.
- Step 10 sim half: src/sim/fire.ts (flammable, ignite, monthlyFire, stepFire) wired into Sim.step via burn(); tests/fire.test.ts green (86 tests pass as of the last run).

## In progress
- Step 10 render and HUD: src/render/fire.ts was started but its contents are unknown to this snapshot; treat it as a draft. Needs a FireLayer (flame billboards plus rising smoke puffs, instanced, animate(dt), keyed on state.rev.fire), a HUD toast for the new `{ kind: 'fire', x, y }` SimEvent in src/ui/hud.ts onEvent, "On fire" in the info panel, and FireLayer added to Game.layers in src/game.ts.
- The uncommitted edits to game.ts, hud.ts, style.css were not verified; run the check before trusting them.

## Next
1. Finish FireLayer and the HUD fire toast, `npm run check`, `npm run e2e`, screenshot a burning block, commit `feat: fire`, push dev, tick step 10 in tasks/todo.md (line 18).
2. Step 11 cars on the road graph, step 12 autosave to localStorage (re-add the Continue path to startScreen/main that simplify removed), then review round C.
3. Steps 13 to 15, review round D, stretch items, final report with screenshots; remind Joe to run mattpocock-skills:retro.

## Decisions
- Buildings are one InstancedMesh per model part with per-instance palette colours (src/render/buildings.ts), so growth never rebuilds geometry; windows are one emissive InstancedMesh with setNight(t) for step 13.
- Town hall is immune to fire; burnt lots drop to level 0 and keep their zone; burnt services are removed.
- Unserved or unreachable developed lots now empty out; roads cannot pave developed lots; bulldoze prices the whole footprint of a clipped building.

## Gotchas
- Visual checks: write a throwaway e2e/visual.tmp.spec.ts, run `SHOTDIR=<scratchpad> npx playwright test e2e/visual.tmp.spec.ts`, read the PNG, delete the spec. rig.zoomBy(factor) with factor < 1 zooms in; ZOOM limits cap the close-up.
- CSS: `[hidden] { display: none !important }` and `.start, .hud > * { pointer-events: auto }` are load-bearing; an id selector on #hud children re-broke pointer events once.
- Model window normals face right of the a-to-b wall direction (walk with the building on your left); the other way back-face culls every window.
- tileHash returns [0, 1); multiply before using it as an index.
- The HUD starts with the town hall tool in hand; the e2e founds via window.townlet.sim and then presses '1'.

## Key files
- src/sim/sim.ts: commands, step(), fields cache, events, ignite/burn
- src/sim/fire.ts, src/sim/growth.ts, src/sim/economy.ts, src/sim/fields.ts: daily rules
- src/render/models.ts, src/render/buildings.ts: silhouettes and instancing
- src/ui/hud.ts: menu derived per frame, panels, cards, pause
- tasks/todo.md: checklist; tests/helpers.ts: foundedSim, days

## Verify
- `npm run check > /tmp/townlet-check.log 2>&1; grep -E "error|×|Tests " /tmp/townlet-check.log`: only "Tests N passed"
- `npm run e2e`: 1 passed
