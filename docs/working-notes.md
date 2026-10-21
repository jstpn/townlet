# Working notes

Things the code and configs do not say for themselves. Read when the matching case comes up.

## Checking a change by eye

`npm run peek` takes one screenshot of the running game; the variables are documented at the top
of `e2e/peek.spec.ts`. Two shapes cover most checks:

```bash
GROWN=26 OUT=/tmp/town.jpg npm run peek
```

```bash
MOBILE=1 EVAL="townlet.sim.placeRoadLine(20, 20, 30, 20)" OUT=/tmp/road.jpg npm run peek
```

`npm run shots` regenerates the README pictures; commit them only with a visual change.

## Checks

`npm run check` is lint, typecheck, prettier and the unit tests. `npm run e2e` is the Playwright
suite without the picture specs. Both must pass before a commit; CI runs the same two.

## Gotchas

- TypeScript 6 types `new Uint8Array(0)` as `Uint8Array<ArrayBuffer>`, which rejects the
  `ArrayBufferLike` arrays the sim produces. Annotate the field: `private depth: Uint16Array = ...`.
- Everything under `src/sim` is the deterministic simulation. ESLint forbids it importing three,
  render, ui, input, or touching `window`, `document` and `localStorage`; keep it that way.
- Render layers get their heights from `state.height` through `groundY` in `src/render/ground.ts`.
  Layers that animate without state copy the grid in `sync`, as cars and fire do.
- Old autosaves are rejected by version; bump `SAVE_VERSION` in `src/save.ts` whenever the
  snapshot shape changes, rather than migrating.
