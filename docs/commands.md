# Commands

All from `package.json`. The day-to-day ones are listed in AGENTS.md.

| Command                | What it does                                                                    |
| ---------------------- | ------------------------------------------------------------------------------- |
| `npm run dev`          | Vite dev server on http://localhost:5173                                        |
| `npm run build`        | Typecheck, then a production build into `dist/`                                 |
| `npm run preview`      | Serves `dist/`                                                                  |
| `npm run check`        | `lint`, `typecheck`, `format:check`, `test` in that order                       |
| `npm run lint`         | ESLint over the repo                                                            |
| `npm run typecheck`    | `tsc --noEmit`                                                                  |
| `npm run format`       | Prettier writes every file                                                      |
| `npm run format:check` | Prettier reports unformatted files                                              |
| `npm run test`         | Vitest once; `npm run test:watch` keeps it running                              |
| `npm run e2e`          | Playwright, all specs except `@shots` and `@peek`, on a dev server at port 4173 |
| `npm run peek`         | One screenshot of the running game; variables documented in `e2e/peek.spec.ts`  |
| `npm run shots`        | Regenerates `docs/screenshots/` from an autoplayed town                         |
| `npm run mapdump`      | Prints a generated map as text for a seed: `npm run mapdump -- budapest`        |

Playwright reuses a dev server already running on port 4173 and otherwise starts one. The GitHub Actions workflow runs `check` and `e2e` with chromium.
