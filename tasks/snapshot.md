# Snapshot: townlet (2026-10-21 09:09)

## Goal
Build the Townlet city builder unattended from tasks/spec.md, working through tasks/todo.md and the stretch list, committing per feature on `dev`.

## State
- Branch: dev. Last commit: fec0938 chore: apply code review round A (pushed to origin)
- Uncommitted: src/sim/catalogue.ts, src/sim/types.ts (Zone enum, BUILDINGS table, written), tests/zones.test.ts (first zoning test, RED). git status also lists sim.ts, roads/roadMask/tools tests as modified: that is prettier whitespace only, nothing of substance.

## Done
- Steps 1 to 4 of the build order: scaffold, map generation, island renderer, roads with drag preview.
- Review round A (simplify plus a 46-agent code-review workflow): 19 findings fixed, 43 unit tests, smoke test drags a road across real land.

## In progress
- Step 5 (zones, catalogue, placement, bulldoze, placeholder buildings). Resume at tests/zones.test.ts: `founded()` calls `sim.placeBuilding('townHall', 30, 30)` and `sim.zoneRect(Zone.Residential, 2, 2, 4, 3)`, neither exists yet in src/sim/sim.ts.

## Next
1. In sim.ts add state (zone, level, occupancy, buildingId Int32Array of -1, buildings Map, rev.zones, rev.buildings, townHall flag) and commands planZoneRect/zoneRect, planBuilding/placeBuilding, extend planBulldozeRect to zones and buildings. Rules: town hall must be the first command and is unique and unbulldozable; a footprint needs non-water, no road, no building, zone level 0; forest clearing fee applies; same zone is `keep`, developed tile of another zone is `blocked`.
2. Render: ZoneLayer (flat tints on empty zoned lots) and BuildingLayer with a geometry registry keyed by zone/level/variant or building kind, placeholder boxes now, real geometry in step 9.
3. Tools: zone rect tools, building footprint tool, temporary hotkeys; then commit, push, continue to step 6 (growth). Review round B after steps 6 to 8.

## Decisions
- Sim owns all planning: every command has a `plan*` twin returning tiles with status change/keep/blocked plus cost; the tool previews the plan and commits exactly the hovered tile it previewed.
- Render layers implement `Layer.sync(state, palette)` and track their own revision and palette; Game only iterates layers and requests a shadow update when any rebuilt.
- Playwright pinned to 1.63.0 because the cached Chromium build 1243 matches it; do not upgrade without a browser download.
- Deployment deferred by Joe; no Coolify token exists on this Mac.

## Gotchas
- Joe's socket PreToolUse hook replaces an entire Bash command containing `npm install` with just the install: run installs alone, never chained.
- `npm run check | grep` hides the exit code; use `npm run check > log && git commit` so nothing commits red.
- Three.js colour conversions are per-call in the geometry builder, so pass THREE.Color instances, not hex strings.
- Node types are scoped to scripts/ via a triple-slash reference; keep "node" out of tsconfig `types`.

## Key files
- tasks/spec.md: the agreed contract, all numbers and rules
- src/sim/sim.ts: Sim command API and plan/execute pattern
- src/game.ts: wires sim, layers, pointer, controls, tool, key bindings, dispose
- src/render/geometryBuilder.ts: typed-array flat-shaded mesh builder (floor, wall, box)
- scripts/mapdump.ts: `npm run mapdump <seed>` prints a map as ASCII

## Verify
- `npm run check`: lint, typecheck and 43 tests pass
- `npm run e2e`: 1 passed, writes e2e/screenshots/boot.png
