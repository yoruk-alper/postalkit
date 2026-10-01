# Contributing

Thanks for helping. The most valuable contributions are reports of real postal codes that postalkit gets wrong. Use the "Wrong result" issue form, and include a source if you can.

## Setup

Needs Node 22.18 or later (`nvm use` reads `.nvmrc`). Scripts and tests are TypeScript, run directly by Node.

```bash
npm install
npm run check   # regenerate data, typecheck, build, test, size budgets, package lint
```

`npm run check` must pass before a pull request is merged. CI also installs the packed package on Node 14 through 24, and runs it in Chromium, Firefox and WebKit through native ES modules, Vite and webpack (`npm run test:browser`, after `npx --prefix test/browser playwright install`).

## How the code is laid out

- `src/index.ts`: the core. Keep it small: `npm run size` fails if it grows past its budget.
- `src/regions.ts`, `src/partial.ts`, `src/messages.ts`: optional entry points that import the core and never bundle it.
- `src/*-data.ts`: **generated** by `scripts/build-data.ts` from `data/upstream.json`. Don't edit them; run `npm run data`.
- `scripts/overrides.ts`: hand-made corrections to Google's data. Every entry needs a `why`.
- `data/corpus.json`: real postal codes from GeoNames, test data only (`npm run corpus` refreshes it).

## Fixing a country

1. Add a failing case to `test/api.test.ts`, or check that `test/corpus.test.ts` already shows it.
2. Fix it with an entry in `scripts/overrides.ts`, explaining why and citing the source. Set `narrows` or `widens` if postalkit now deliberately differs from Google's pattern.
3. Run `npm run check` and commit the regenerated `src/*-data.ts` with the change. CI fails if they are out of date.
4. Add a line under "Data" in `CHANGELOG.md`.

## Releases

Maintainers bump `version` in `package.json`, move the changelog entry out of "Unreleased", then push a `v<version>` tag. `.github/workflows/release.yml` publishes to npm.
