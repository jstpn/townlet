# Snapshot: townlet (2026-10-21 11:12)

## Goal
Build Townlet (Wes Anderson-palette city builder) from tasks/spec.md end to end, all 16 build steps plus the stretch list, autonomously, committing per feature on dev.

## State
- Branch: dev. Last commit: 47aa5c3 feat: balance pass with a headless autoplayer
- Uncommitted: README.md, docs/screenshots/*.jpg (6 shots), e2e/shots.spec.ts, package.json (e2e/shots scripts), tasks/todo.md (step 15 ticked). Check and e2e both green on this tree; just needs a commit.

## Done
- Steps 10 to 15: fire, cars, autosave/continue, simplify + code review round C, post-processing/day-night/postcard, balance pass with autoplayer, README with screenshots.

## In progress
- Step 15 commit: `git add -A && git commit -m "docs: README with screenshots"` (with the Co-Authored-By trailer), push dev. Hero shot was verified as daylight before compaction only for the first (png) run; the jpg rerun used day 720, so eyeball docs/screenshots/hero.jpg once before committing.

## Next
1. Commit and push step 15.
2. Review round D (simplify with 4 agents, then `/code-review high 561074a..HEAD`), fix, commit as `chore:`.
3. Stretch, in order: boats and birds, hills with terraces, synthesised audio, touch controls. Tick tasks/todo.md as each lands.
4. Final report with screenshots; remind Joe to run `mattpocock-skills:retro`.

## Decisions
- Demand rebalance (workers 0.4, C target pop/3 + 0.1, I target pop/5 + 0.15): the spec's 0.6 workers stalled every town near 300 residents. Spec updated.
- Growth rates halved (0.05/0.035/0.025): autoplayer wins easy ~11, normal ~29, hard ~95 months; test bounds 40/80/160.
- Autosave trigger is `state.rev.save` (bumped in execute, setTaxRate, month settle), polled once per frame; replaced a BuildTool counter and a month check that saved every step before founding.
- Layer.animate runs on wall-clock while paused, on purpose.
- Light cycle starts at phase 0.25 so a new town opens in daylight; night is day % 120 in roughly 66 to 90.

## Gotchas
- InstancedMesh with vertexColors plus instanceColor rendered black; cars use instance colour only.
- Shadow map autoUpdate is false, so moving meshes must not castShadow.
- e2e/screenshots is gitignored; README images live in docs/screenshots as jpg (png were 2 MB each).
- Residential lots with no service coverage have appeal 0.3 < 0.35 and never grow; the autoplayer must buy services for zoned (not just developed) homes.
- Vitest console.log from passing tests needs `--silent=false` to show.

## Key files
- tests/autoplayer.ts: headless mayor used by tests/autoplay.test.ts and e2e/shots.spec.ts
- src/render/instanced.ts: shared uploadInstances (sets visible = count > 0)
- src/render/grade.ts, src/render/daylight.ts: post pass and light curve
- src/save.ts, src/sim/save.ts: autosave file and sim snapshot

## Verify
- `npm run check`: lint clean, 105 tests pass
- `npm run e2e`: 3 passed; `npm run shots` regenerates docs/screenshots
