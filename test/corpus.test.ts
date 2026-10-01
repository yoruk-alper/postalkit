// Real postal codes from GeoNames (data/corpus.json, refreshed by `npm run corpus`).
// Independent of Google's data, so this catches patterns that are wrong in practice.
// Every disagreement is either fixed (scripts/overrides.ts) or listed below with a reason;
// an entry that stops being needed fails the test, so the list cannot rot.
import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { format, parse, type ParseError } from "../src/index.ts";
import { findRegions } from "../src/regions.ts";

const corpus = JSON.parse(readFileSync(new URL("../data/corpus.json", import.meta.url), "utf8")) as {
  codes: Record<string, string[]>;
  regions: Record<string, [code: string, admin1Code: string, admin1Name: string][]>;
};

interface Known {
  why: string;
  /** Every corpus code for the country is rejected with this error. */
  error?: ParseError;
  /** Only the corpus codes matching this are rejected (at least one must exist). */
  match?: RegExp;
}

const KNOWN_CORPUS_ISSUES: Record<string, Known> = {
  // Google lists no postal code system for these; we follow Google.
  AE: { why: "GeoNames lists 10-digit Makani building numbers, not postal codes", error: "not-applicable" },
  HK: { why: "999077 is China Post's code for Hong Kong, not used locally", error: "not-applicable" },
  MO: { why: "999078 is China Post's code for Macao, not used locally", error: "not-applicable" },
  MW: { why: "Google lists no postal codes for Malawi", error: "not-applicable" },
  NR: { why: "Google lists no postal codes for Nauru", error: "not-applicable" },
  NU: { why: "Google lists no postal codes for Niue", error: "not-applicable" },
  PA: { why: "Google lists no postal codes for Panama", error: "not-applicable" },
  WS: { why: "the only GeoNames entry is American Samoa's ZIP (AS 96799)", error: "not-applicable" },
  // GeoNames has only the first part of each code here.
  GG: { why: "outward codes only (GY1), no inward part", error: "too-short" },
  IM: { why: "outward codes only (IM1), no inward part", error: "too-short" },
  JE: { why: "outward codes only (JE2), no inward part", error: "too-short" },
  IE: { why: "Eircode routing keys only (F12), no unique identifier", error: "too-short" },
  MT: { why: "locality letters only (BZN), no digits", error: "too-short" },
  // Codes outside the ranges Google publishes.
  GL: { why: "2412 is Denmark's Santa Claus mail code; Greenland's codes are 39xx", match: /^2412$/ },
  GU: { why: "96930 is outside Google's Guam range (96910-96929, 96931-96932)", match: /^96930$/ },
  RE: { why: "CEDEX (business mail) codes in 977xx-978xx are outside Google's 974xx range", match: /^97[78]\d\d CEDEX/ },
};

/** GeoNames puts France's CEDEX business-mail suffix in the code ("75021 CEDEX 01"); it belongs on the city line. */
const code = (raw: string) => raw.replace(/\s+CEDEX(?:\s*\d+)?$/i, "");

test("every real postal code in the corpus is accepted", () => {
  const failures: string[] = [];
  for (const [cc, list] of Object.entries(corpus.codes)) {
    const known = KNOWN_CORPUS_ISSUES[cc];
    if (known?.error) continue;
    for (const raw of list) {
      if (known?.match?.test(raw)) continue;
      const r = parse(cc, code(raw));
      if (!r.valid) failures.push(`${cc} "${raw}": ${r.error}`);
      else assert.equal(format(cc, r.value), r.value, `${cc}: "${r.value}" is not stable`);
    }
  }
  assert.deepEqual(failures, [], `${failures.length} real codes rejected`);
});

test("every known corpus issue still applies", () => {
  for (const [cc, known] of Object.entries(KNOWN_CORPUS_ISSUES)) {
    const list = corpus.codes[cc];
    assert.ok(list, `${cc}: no longer in the corpus; remove it from KNOWN_CORPUS_ISSUES`);
    if (known.error) {
      for (const raw of list) {
        const r = parse(cc, code(raw));
        assert.ok(!r.valid && r.error === known.error, `${cc} "${raw}" is no longer "${known.error}"; update KNOWN_CORPUS_ISSUES`);
      }
    }
    if (known.match) {
      const matching = list.filter((raw) => known.match!.test(raw));
      assert.ok(matching.length, `${cc}: no corpus code matches ${known.match}; remove it from KNOWN_CORPUS_ISSUES`);
      for (const raw of matching) {
        assert.equal(parse(cc, code(raw)).valid, false, `${cc} "${raw}" is now accepted; update KNOWN_CORPUS_ISSUES`);
      }
    }
  }
});

const simplify = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");

test("findRegions agrees with GeoNames' state or province for real codes", () => {
  for (const [cc, rows] of Object.entries(corpus.regions)) {
    let agree = 0;
    let compared = 0;
    for (const [raw, a1code, a1name] of rows) {
      const found = findRegions(cc, code(raw));
      assert.ok(found.length, `${cc} "${raw}" (${a1name}): no region found`);
      if (!a1code && !a1name) continue; // GeoNames has no region for US military codes; ours is "Armed Forces"
      compared++;
      // GeoNames writes "Saitama Ken" for "Saitama", so a name containing the other also agrees.
      const name = simplify(a1name);
      const same = (r: { code: string | null; name: string }) => {
        const other = simplify(r.name);
        return r.code === a1code || (!!name && !!other && (name.includes(other) || other.includes(name)));
      };
      if (found.some(same)) agree++;
    }
    // Codes near a border can share a prefix with a neighbor, so a few disagreements are real data, not bugs.
    assert.ok(compared > rows.length / 2, `${cc}: too few codes with a GeoNames region to compare`);
    assert.ok(agree / compared >= 0.99, `${cc}: only ${agree}/${compared} codes in GeoNames' region`);
  }
});
