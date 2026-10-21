# Snapshot: townlet (2026-10-21 12:12)

## Goal
Finish the spec's stretch list (boats and birds, hills, audio, touch) autonomously on `dev`, with review rounds every 3 to 4 code commits, then a final report with screenshots and a reminder to run `mattpocock-skills:retro`.

## State
- Branch: dev. Last commit: 70387b0 feat: synthesised audio
- Uncommitted: touch controls (src/input/controls.ts, pointer.ts, tools.ts, src/style.css, src/ui/hud.ts, tests/tools.test.ts, e2e/touch.spec.ts). `npm run check` 111 passed, `npm run e2e` 4 passed (touch spec included) at the moment of the snapshot.

## Done
- Review round D (simplify + code review, both committed and findings re-reported).
- Boats and birds, hills with terraces, synthesised audio: each committed and pushed.
- Touch: two-finger pinch/drag/twist in CameraControls, second finger cancels build gesture via Pointer.onCancel, rotate buttons in the top bar, compact layout under 760px, touch-action none on the canvas, e2e test via CDP touch events.

## In progress
- Touch commit. Phone screenshots were taken to the scratchpad (mobile-hints.jpg, mobile-menu.jpg, mobile-pause.jpg) but never viewed; view them, fix any layout overflow, then commit `feat: touch controls`, tick "Touch controls" in tasks/todo.md, add a README controls row for touch gestures, push.

## Next
1. Commit and push touch (see above).
2. Review round E over bf778db..HEAD (boats, hills, audio, touch): 4 simplify agents, apply, then `/code-review high <range>`, fix, re-report findings with outcomes, `chore:` commits, push.
3. Regenerate README shots (`npm run shots`) only if visuals changed; revert byte churn otherwise.
4. Final report with screenshots (SendUserFile of docs/screenshots and a summary), update the app task list, call wrap_up, and remind Joe to run `mattpocock-skills:retro`.

## Decisions
- Hills noise is drawn last from the generator rng so every seed's terrain is byte-identical to before (hash test in tests/hills.test.ts); heights are saved in the snapshot, so pre-hills autosaves are rejected (accepted, local play).
- Light cycle phase 0 is full day (keys rotated), no START_PHASE; MIDNIGHT = 0.65 exported for the shots spec.
- Bloom pass disabled by day (`bloom.enabled = night > 0`); verified hero shot unchanged.
- Skipped merging the grade pass with OutputPass (colour-space include risk for little gain).
- Boats scaled 1.4x; a boat may sail inside a large lagoon, which was judged charming, not a bug.

## Gotchas
- Roads need a founded town: e2e tests that lay roads must place the town hall first.
- Playwright tests with `isMobile` + CDP `Input.dispatchTouchEvent` work; `touchEnd` with empty touchPoints lifts all fingers.
- Prettier is not part of `npm run check`; run `npx prettier --write` on new files before committing.
- Keep screenshot regeneration out of commits unless visuals changed (`git checkout docs/screenshots`).

## Key files
- src/render/ground.ts, roadMask.ts (rampDirection, roadY), terrain.ts: terraces and ramps.
- src/audio/sound.ts: all synthesised audio; wired in hud.ts (EVENT_CUE, onCommand) and game.ts.
- src/input/pointer.ts, controls.ts: touch tracking and pinch.
- tests/autoplayer.ts, tests/autoplay.test.ts: balance bounds easy 0..40, normal 0..80, hard 40..160 months.
- e2e/boot.ts: shared boot/enter helpers; e2e/shots.spec.ts regenerates docs/screenshots.

## Verify
- `npm run check`: lint, typecheck, 111 tests pass.
- `npm run e2e`: 4 passed (smoke x3, touch).
- `npm run shots`: 1 passed, writes docs/screenshots/*.jpg.
