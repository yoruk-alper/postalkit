// postalkit/regions: which state or province a postal code belongs to, offline.
// A separate entry point so the core stays small for everyone who doesn't need it.
import { parse, type CountryCode, type CountryInput } from "./index.ts";
import { REGIONS } from "./regions-data.ts";

/** A state, province or other first-level subdivision. */
export interface Region {
  /** ISO 3166-2 code without the country prefix ("CA" for US-CA), or null where none exists (US military "AE"). */
  code: string | null;
  /** English or Latin-script name ("California", "Hokkaido"). */
  name: string;
}

interface Table {
  list: Region[];
  re: (RegExp | null)[]; // prefix pattern per region; null = no prefix data for that region
}

const cache: { [code: string]: Table } = {};

function table(country: CountryCode | null): Table | undefined {
  // Codes are uppercase, so `in` cannot hit Object.prototype members.
  if (!country || !(country in REGIONS)) return;
  if (!cache[country]) {
    const [names, iso, prefixes] = REGIONS[country];
    const codes = iso.split("~");
    cache[country] = {
      list: names.split("~").map((name, i) => ({ code: codes[i] || null, name })),
      re: prefixes.split("~").map((p) => (p ? new RegExp("^(?:" + p + ")") : null)),
    };
  }
  return cache[country];
}

const copy = (r: Region): Region => ({ code: r.code, name: r.name });

/** The core resolves alpha-3, aliases and case for us. */
const resolve = (country: unknown) => parse(country as CountryInput, "").country;

/** Whether region data exists for the country (23 countries, including US, CA, BR, IN, JP, MX, AU). */
export function hasRegionData(country: CountryInput): boolean {
  return !!table(resolve(country));
}

/** Every region known for the country, for a picker. Empty without region data. */
export function getRegions(country: CountryInput): Region[] {
  const t = table(resolve(country));
  return t ? t.list.map(copy) : [];
}

/**
 * The region(s) a postal code belongs to. The code is validated first, so an invalid
 * code never yields a guess. Usually one region; some prefixes are shared, so
 * "K1A 0T6" is both Ontario and Quebec. Empty when invalid or without region data.
 *
 * @example findRegions("US", "90210") // [{ code: "CA", name: "California" }]
 */
export function findRegions(country: CountryInput, postalCode: unknown): Region[] {
  const p = parse(country, postalCode);
  const t = table(p.country);
  if (!p.valid || !p.value || !t) return [];
  const s = p.value.replace(/[ -]/g, "");
  const out: Region[] = [];
  t.re.forEach((re, i) => re && re.test(s) && out.push(copy(t.list[i])));
  return out;
}

/**
 * Whether a valid postal code belongs to a region, given as its ISO code ("CA" or "US-CA")
 * or its name ("California"), in any case.
 */
export function isInRegion(country: CountryInput, postalCode: unknown, region: string): boolean {
  if (typeof region !== "string") return false;
  const want = region.trim().toUpperCase();
  const c = resolve(country);
  return findRegions(country, postalCode).some(
    (r) => (r.code !== null && (r.code === want || c + "-" + r.code === want)) || r.name.toUpperCase() === want,
  );
}
