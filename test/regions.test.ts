import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { isValid } from "../src/index.ts";
import { findRegions, getRegions, hasRegionData, isInRegion } from "../src/regions.ts";

const upstream = JSON.parse(readFileSync(new URL("../data/upstream.json", import.meta.url), "utf8")) as {
  countries: Record<string, Record<string, string | undefined>>;
};

test("finds the region of a postal code", () => {
  assert.deepEqual(findRegions("US", "90210"), [{ code: "CA", name: "California" }]);
  assert.deepEqual(findRegions("usa", "10001"), [{ code: "NY", name: "New York" }]);
  assert.deepEqual(findRegions("CA", "k1a0t6"), [{ code: "ON", name: "Ontario" }, { code: "QC", name: "Quebec" }]);
  assert.deepEqual(findRegions("JP", "１００－０００１"), [{ code: "13", name: "Tokyo" }]);
  assert.deepEqual(findRegions("BR", "01310100"), [{ code: "SP", name: "São Paulo" }]);
  assert.deepEqual(findRegions("US", "09012"), [{ code: null, name: "Armed Forces (AE)" }]);
});

test("never guesses for invalid codes or countries without data", () => {
  assert.deepEqual(findRegions("US", "00000"), []); // valid format, but no state owns it
  assert.deepEqual(findRegions("US", "9021"), []);
  assert.deepEqual(findRegions("DE", "10115"), []);
  assert.deepEqual(findRegions("XX", "10115"), []);
  assert.deepEqual(findRegions("AE", ""), []);
  assert.deepEqual(findRegions("US", null), []);
});

test("every region example Google publishes resolves to that region", () => {
  let checked = 0;
  for (const [cc, c] of Object.entries(upstream.countries)) {
    if (!c.sub_zipexs) continue;
    const names = (c.sub_lnames ?? c.sub_names ?? c.sub_keys!).split("~");
    c.sub_zipexs.split("~").forEach((list, i) => {
      for (const ex of list.split(",").filter(Boolean)) {
        if (!isValid(cc, ex)) continue; // some region examples are bare prefixes, not full codes
        const found = findRegions(cc, ex).map((r) => r.name);
        assert.ok(found.includes(names[i]), `${cc} ${ex}: expected ${names[i]}, got [${found.join(", ")}]`);
        checked++;
      }
    });
  }
  assert.ok(checked > 400, `only ${checked} examples checked`);
});

test("lists regions for pickers", () => {
  assert.equal(getRegions("US").length, 62);
  assert.ok(getRegions("CA").some((r) => r.code === "BC" && r.name === "British Columbia"));
  assert.deepEqual(getRegions("DE"), []);
  getRegions("US")[0].name = "changed";
  assert.equal(getRegions("US")[0].name, "Alabama", "returns copies");
});

test("knows which countries have region data", () => {
  const withData = Object.keys(upstream.countries).filter((cc) => upstream.countries[cc].sub_zips);
  assert.equal(withData.length, 23);
  for (const cc of withData) assert.ok(hasRegionData(cc), cc);
  assert.equal(hasRegionData("DE"), false);
  assert.equal(hasRegionData("nope"), false);
});

test("checks membership by code, ISO code or name", () => {
  assert.equal(isInRegion("US", "90210", "CA"), true);
  assert.equal(isInRegion("US", "90210", "us-ca"), true);
  assert.equal(isInRegion("US", "90210", " california "), true);
  assert.equal(isInRegion("US", "90210", "NY"), false);
  assert.equal(isInRegion("US", "90210", null as never), false);
  assert.equal(isInRegion("US", "09012", "null"), false);
});
