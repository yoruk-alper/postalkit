# Contributing

Thanks for helping. The most valuable contributions are reports of real postal codes that postalkit gets wrong. Use the "Wrong result" issue form, and include a source if you can.

## Setup

Needs Node 22.18 or later (`nvm use` reads `.nvmrc`). Scripts and tests are TypeScript, run directly by Node.

```bash
npm install
npm run check          # regenerate data, typecheck, build, test, size budgets, publint + attw
npm run bench          # throughput, after a build
npm run fetch          # refresh data/upstream.json from Google, then `npm run data`
npm run corpus         # refresh data/corpus.json from GeoNames (needs `unzip`)
npm run docs           # API reference into docs/ (TypeDoc, run with its own TypeScript 6)
npm run test:browser   # browsers and bundlers; first: npx --prefix test/browser playwright install
```

`npm run check` must pass before a pull request is merged. CI also installs the packed package on Node 14 through 24, and runs it in Chromium, Firefox and WebKit, loaded as native ES modules and bundled by Vite and webpack, and checks that every combination behaves exactly like Node.

To see the playground locally, build, serve the repository root (`python3 -m http.server`), and open `/playground/`.

## How the code is laid out

- `src/index.ts`: the core. Keep it small: `npm run size` fails if it grows past its budget.
- `src/regions.ts`, `src/partial.ts`, `src/messages.ts`: optional entry points that import the core and never bundle it.
- `src/*-data.ts`: **generated** by `scripts/build-data.ts` from `data/upstream.json`. Don't edit them; run `npm run data`.
- `scripts/overrides.ts`: hand-made corrections to Google's data. Every entry needs a `why`.
- `data/corpus.json`: real postal codes from GeoNames, test data only (`npm run corpus` refreshes it).

## How the data is built

`scripts/build-data.ts` turns Google's data into `src/*-data.ts`:

1. removes separators from each pattern and derives the canonical separator position from Google's examples;
2. applies the corrections in `scripts/overrides.ts`, failing if one stops applying;
3. optimizes every pattern (the UK area list becomes a prefix tree) and fuzz-tests it against the original;
4. checks that every canonical form it produces still satisfies Google's original pattern, unless an override deliberately accepts more (`widens`, such as Argentina's 4-digit codes);
5. derives the prefix patterns for `postalkit/partial` and checks them against an independent backtracking matcher.

`.github/workflows/upstream.yml` compares `data/upstream.json` with Google's live data weekly and fails when it changes. In `test/corpus.test.ts`, the rare corpus codes that are expected to fail are GeoNames quirks, listed with reasons, and the test fails when one stops applying.

## Fixing a country

1. Add a failing case to `test/api.test.ts`, or check that `test/corpus.test.ts` already shows it.
2. Fix it with an entry in `scripts/overrides.ts`, explaining why and citing the source. Set `narrows` or `widens` if postalkit now deliberately differs from Google's pattern.
3. Run `npm run check` and commit the regenerated `src/*-data.ts` with the change. CI fails if they are out of date.
4. Add a line under "Data" in `CHANGELOG.md`.

## Releases

Maintainers bump `version` in `package.json`, give the version a dated section in `CHANGELOG.md`, then push a `v<version>` tag. `.github/workflows/release.yml` publishes to npm through trusted publishing and creates the GitHub release from that changelog section.
