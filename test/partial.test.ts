import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { getCountries, getCountryInfo, isValid } from "../src/index.ts";
import { checkPartial } from "../src/partial.ts";
import { mutate, prng } from "../scripts/regex.ts";

const corpus = JSON.parse(readFileSync(new URL("../data/corpus.json", import.meta.url), "utf8")) as {
  codes: Record<string, string[]>;
};

test("tells complete, still-typing and hopeless input apart", () => {
  const cases: [string, unknown, string][] = [
    ["GB", "SW1", "partial"],
    ["GB", "sw1a 1", "partial"],
    ["GB", "SW1A 1AA", "complete"],
    ["GB", "SW1A 1AAX", "invalid"],
    ["GB", "QQ", "invalid"], // no such postcode area
    ["US", "", "partial"],
    ["US", "9021", "partial"],
    ["US", "90210", "complete"], // valid, though ZIP+4 could follow
    ["US", "90210-12", "partial"],
    ["US", 902, "partial"],
    ["DE", "1O1", "invalid"], // letter O typed for zero
    ["CA", "K1A 0T", "partial"],
    ["CA", "D1A", "invalid"], // D never starts a Canadian postcode
    ["NL", "1234 S", "partial"],
    ["NL", "1234 SA", "invalid"], // SA, SD and SS are never issued
    ["JP", "１００－", "partial"], // full-width, mid-entry
    ["SE", "SE-11", "partial"], // country prefix being typed
    ["SE", "S", "partial"],
    ["LV", "10", "partial"], // fixed prefix will be added
    ["IE", "D6W", "partial"],
    ["AR", "14", "partial"],
    ["AE", "", "complete"], // no postal codes: empty is the valid answer
    ["AE", "1", "invalid"],
    ["XX", "1", "invalid"],
  ];
  for (const [c, input, want] of cases) assert.equal(checkPartial(c, input), want, `${c} ${JSON.stringify(input)}`);
});

test("every prefix of a real code is partial, the code itself complete", () => {
  for (const [cc, codes] of Object.entries(corpus.codes)) {
    for (const code of codes) {
      if (!isValid(cc, code)) continue; // GeoNames quirks, see test/corpus.test.ts
      for (let i = 0; i < code.length; i++) {
        assert.notEqual(checkPartial(cc, code.slice(0, i)), "invalid", `${cc}: "${code.slice(0, i)}" of "${code}"`);
      }
      assert.equal(checkPartial(cc, code), "complete", `${cc} "${code}"`);
    }
  }
});

test("codes GeoNames only has the start of are partial", () => {
  for (const cc of ["GG", "IM", "JE", "IE", "MT"]) {
    for (const code of corpus.codes[cc]) assert.equal(checkPartial(cc, code), "partial", `${cc} "${code}"`);
  }
});

test("complete exactly when parse accepts, and never throws", () => {
  const junk: unknown[] = [null, undefined, 0, -1, 1.5, NaN, {}, [], "__proto__", "constructor", "\u0000", "x".repeat(1000)];
  for (const cc of getCountries()) {
    const rnd = prng(cc.charCodeAt(0) * 389 + cc.charCodeAt(1));
    const ex = getCountryInfo(cc)!.example;
    const inputs: unknown[] = [ex, ex.toLowerCase(), ...junk];
    for (let i = 0; i < 40; i++) inputs.push(mutate(ex, rnd), ex.slice(0, Math.floor(rnd() * (ex.length + 1))));
    for (const x of inputs) {
      const status = checkPartial(cc, x);
      assert.equal(status === "complete", isValid(cc, x), `${cc} ${JSON.stringify(x)}`);
    }
  }
  for (const c of [null, undefined, 42, {}, "__proto__", "constructor"]) assert.equal(checkPartial(c as string, "1"), "invalid");
});
