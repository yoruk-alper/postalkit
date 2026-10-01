// Property tests against Google's own data: for every country, everything Google's
// pattern accepts we accept, and everything we output Google's pattern accepts.
import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { format, getCountries, getCountryInfo, parse } from "../src/index.ts";
import { mutate, parse as parseRegex, prng, sample } from "../scripts/regex.ts";
import { OVERRIDES } from "../scripts/overrides.ts";

const upstream = JSON.parse(readFileSync(new URL("../data/upstream.json", import.meta.url), "utf8")) as {
  countries: Record<string, { zip?: string; zipex?: string }>;
};
// BH wraps its pattern in word-boundary hacks that are not part of the format.
const googlePattern = (zip: string) => zip.replace(/\(\?:\^\|\\b\)|\(\?:\$\|\\b\)/g, "");

const withCodes = Object.entries(upstream.countries).filter(([, c]) => c.zip);

test("covers every country Google knows", () => {
  assert.deepEqual(getCountries(), Object.keys(upstream.countries).sort());
});

test("every upstream example is accepted, and its canonical form satisfies Google's pattern", () => {
  for (const [cc, c] of withCodes) {
    const google = new RegExp(`^(?:${googlePattern(c.zip!)})$`);
    for (const ex of c.zipex!.split(",")) {
      const out = format(cc, ex);
      assert.ok(out !== null, `${cc} rejects its own example ${ex}`);
      assert.match(out, google, `${cc}: ${ex} -> ${out}`);
    }
  }
});

test("everything Google's pattern accepts is accepted (fuzzed, 400 per country)", () => {
  for (const [cc, c] of withCodes) {
    if (OVERRIDES[cc]?.narrows) continue; // deliberately stricter, see scripts/overrides.ts
    const ast = parseRegex(googlePattern(c.zip!));
    const rnd = prng(cc.charCodeAt(0) * 97 + cc.charCodeAt(1));
    for (let i = 0; i < 400; i++) {
      const s = sample(ast, rnd);
      assert.ok(parse(cc, s).valid, `${cc} rejects "${s}", which Google accepts`);
    }
  }
});

test("canonical output always satisfies Google's pattern and is stable (fuzzed with near misses)", () => {
  for (const [cc, c] of withCodes) {
    const google = new RegExp(`^(?:${googlePattern(c.zip!)})$`);
    const ast = parseRegex(googlePattern(c.zip!));
    const rnd = prng(cc.charCodeAt(1) * 89 + cc.charCodeAt(0));
    for (let i = 0; i < 400; i++) {
      const s = i % 2 ? sample(ast, rnd) : mutate(sample(ast, rnd), rnd);
      const out = format(cc, s);
      if (out === null) continue;
      if (!OVERRIDES[cc]?.widens) assert.match(out, google, `${cc}: "${s}" -> "${out}"`); // see scripts/overrides.ts
      assert.equal(format(cc, out), out, `${cc}: format is not idempotent for "${out}"`);
      assert.equal(format(cc, out.toLowerCase().replace(/[ -]/g, "")), out, `${cc}: compact "${out}" formats differently`);
    }
  }
});

test("every country's placeholder example is valid and already canonical", () => {
  for (const cc of getCountries()) {
    const info = getCountryInfo(cc)!;
    if (!info.hasPostalCode) {
      assert.equal(info.example, "");
      continue;
    }
    assert.equal(format(cc, info.example), info.example, cc);
    assert.ok(info.example.length <= info.maxLength, `${cc}: example longer than maxLength`);
    if (info.numeric) assert.ok(parse(cc, info.example.replace(/[^0-9]/g, "")).valid, `${cc}: digits-only entry fails`);
  }
});
