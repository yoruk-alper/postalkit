// The published files, exactly as consumers load them. Run after `npm run build`.
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const built = existsSync(new URL("../dist/index.js", import.meta.url));

test("ESM and CommonJS builds behave the same", { skip: !built && "run npm run build first" }, async () => {
  const esm = await import("../dist/index.js");
  const cjs = createRequire(import.meta.url)("../dist/index.cjs");
  for (const api of [esm, cjs]) {
    assert.equal(api.format("ca", "k1a0t6"), "K1A 0T6");
    assert.deepEqual(api.guessCountry("K1A 0T6"), ["CA"]);
  }
  assert.deepEqual(Object.keys(esm).sort(), Object.keys(cjs).sort());
});

test("postalkit/regions works from both builds and shares the core", { skip: !built && "run npm run build first" }, async () => {
  const esm = await import("../dist/regions.js");
  const cjs = createRequire(import.meta.url)("../dist/regions.cjs");
  for (const api of [esm, cjs]) assert.deepEqual(api.findRegions("US", "90210"), [{ code: "CA", name: "California" }]);
  const read = (f: string) => readFileSync(new URL(`../dist/${f}`, import.meta.url), "utf8");
  assert.match(read("regions.js"), /from "\.\/index\.js"/);
  assert.match(read("regions.cjs"), /require\("\.\/index\.cjs"\)/);
  assert.doesNotMatch(read("regions.js"), /ACASCN/, "core data must not be bundled into regions");
});

test("has no runtime dependencies", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.dependencies, undefined);
  assert.equal(pkg.peerDependencies, undefined);
});
