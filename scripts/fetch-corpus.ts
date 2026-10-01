// Builds data/corpus.json: real postal codes from GeoNames (CC-BY 4.0), a fixed-seed
// sample per country, for test/corpus.test.ts. Independent of Google's data, so it
// catches patterns that are wrong in practice, not just different from Google's.
// Test data only: it is not in package.json "files" and never ships.
//   node scripts/fetch-corpus.ts   (needs the `unzip` command)
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prng } from "./regex.ts";

const BASE = "https://download.geonames.org/export/zip";
const PER_COUNTRY = 300;
// The main dump only has outward codes (GB), FSAs (CA) and 4-digit codes (NL); these files have full ones.
const FULL = ["GB", "CA", "NL"];
// Region data is checked where GeoNames' admin1 is the same unit as Google's regions (state, province, prefecture)
// and the names can be matched. Not KR: GeoNames writes 경상남도 where Google writes 경남 or Gyeongsangnam-do.
const REGION_CHECK = ["US", "CA", "JP", "IN", "AU"];

const tmp = mkdtempSync(join(tmpdir(), "postalkit-corpus-"));

async function rows(file: string): Promise<string[][]> {
  const res = await fetch(`${BASE}/${file}.zip`);
  if (!res.ok) throw new Error(`${file}.zip: HTTP ${res.status}`);
  const zip = join(tmp, `${file}.zip`);
  writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
  const inner = file.replace(/\.csv$/, "") + ".txt"; // GB_full.csv.zip holds GB_full.txt
  const text = execFileSync("unzip", ["-p", zip, inner], { maxBuffer: 1 << 30, encoding: "utf8" });
  return text.split("\n").filter(Boolean).map((line) => line.split("\t"));
}

// GeoNames columns: country, postal code, place, admin1 name, admin1 code, ...
const byCountry = new Map<string, Map<string, [admin1Code: string, admin1Name: string]>>();
function add(table: string[][], only?: string) {
  for (const [cc, code, , a1name = "", a1code = ""] of table) {
    if (only ? cc !== only : FULL.includes(cc)) continue;
    let m = byCountry.get(cc);
    if (!m) byCountry.set(cc, (m = new Map()));
    if (!m.has(code)) m.set(code, [a1code, a1name]);
  }
}

try {
  add(await rows("allCountries"));
  for (const cc of FULL) add(await rows(`${cc}_full.csv`), cc);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

/** Up to n items, chosen by a seeded shuffle so a refresh only changes what GeoNames changed. */
function pick<T>(items: T[], n: number, seed: number): T[] {
  const a = items.slice();
  const rnd = prng(seed);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

const codes: Record<string, string[]> = {};
const regions: Record<string, [code: string, admin1Code: string, admin1Name: string][]> = {};
for (const [cc, m] of [...byCountry].sort(([a], [b]) => a.localeCompare(b))) {
  const seed = cc.charCodeAt(0) * 131 + cc.charCodeAt(1);
  const chosen = pick([...m.keys()].sort(), PER_COUNTRY, seed).sort();
  codes[cc] = chosen;
  if (REGION_CHECK.includes(cc)) regions[cc] = chosen.map((code) => [code, ...m.get(code)!]);
}

// One country per line keeps refreshes reviewable.
const fetched = new Date().toISOString().slice(0, 10);
const section = (obj: Record<string, unknown>) =>
  "{\n" + Object.entries(obj).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(",\n") + "\n }";
const out = `{
 "source": "GeoNames postal code data, ${BASE} (CC-BY 4.0, https://creativecommons.org/licenses/by/4.0/). Sampled by scripts/fetch-corpus.ts.",
 "fetched": "${fetched}",
 "codes": ${section(codes)},
 "regions": ${section(regions)}
}
`;
writeFileSync(new URL("../data/corpus.json", import.meta.url), out);
console.log(`data/corpus.json: ${Object.keys(codes).length} countries, ${Object.values(codes).flat().length} codes (${out.length} bytes)`);
