// Invariants the README promises, checked for every country on generated input:
// realistic codes, near misses, and junk.
import { test } from "node:test";
import assert from "node:assert/strict";
import { format, getCountries, getCountryInfo, guessCountry, isValid, parse, parseMany } from "../src/index.ts";
import { mutate, prng } from "../scripts/regex.ts";

const JUNK = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcxyz -.–—〒ー１２３ＡＢ\t /#é";

/** About 120 inputs per country: its example in several spellings, near misses, and junk. */
function inputs(cc: string): string[] {
  const rnd = prng(cc.charCodeAt(0) * 7919 + cc.charCodeAt(1));
  const ex = getCountryInfo(cc)!.example;
  const out = [ex, ex.toLowerCase(), ex.replace(/[ -]/g, ""), ` ${ex} `, `${cc}-${ex}`, "", " "];
  for (let i = 0; i < 60; i++) out.push(mutate(ex.replace(/[ -]/g, ""), rnd));
  for (let i = 0; i < 50; i++) {
    let s = "";
    const n = Math.floor(rnd() * 12);
    for (let j = 0; j < n; j++) s += JUNK[Math.floor(rnd() * JUNK.length)];
    out.push(s);
  }
  return out;
}

test("isValid, format and parse always agree", () => {
  for (const cc of getCountries()) {
    for (const x of inputs(cc)) {
      const r = parse(cc, x);
      assert.equal(r.country, cc);
      assert.equal(isValid(cc, x), r.valid, `${cc} ${JSON.stringify(x)}`);
      assert.equal(format(cc, x), r.valid ? r.value : null, `${cc} ${JSON.stringify(x)}`);
    }
  }
});

test("format is idempotent and its output is already canonical", () => {
  for (const cc of getCountries()) {
    for (const x of inputs(cc)) {
      const out = format(cc, x);
      if (out === null) continue;
      assert.equal(format(cc, out), out, `${cc}: ${JSON.stringify(x)} -> ${JSON.stringify(out)}`);
      assert.ok(out.length <= getCountryInfo(cc)!.maxLength, `${cc}: "${out}" longer than maxLength`);
    }
  }
});

test("parseMany is parse for each input, in order", () => {
  for (const cc of getCountries()) {
    const xs = inputs(cc);
    assert.deepEqual(parseMany(cc, xs), xs.map((x) => parse(cc, x)), cc);
  }
});

test("guessCountry finds the country of every canonical code", () => {
  for (const cc of getCountries()) {
    for (const x of inputs(cc)) {
      if (!x || format(cc, x) !== x) continue;
      assert.ok(guessCountry(x).includes(cc as never), `${cc}: guessCountry("${x}") misses it`);
    }
  }
});
