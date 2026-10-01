import { ALPHA3, NONE, RULES, type CountryCode } from "./data.ts";
import { clean } from "./normalize.ts";

export type { CountryCode };

/** Alpha-2 ("US"), alpha-3 ("USA"), any case. Unknown strings are accepted and reported as "unknown-country". */
export type CountryInput = CountryCode | Lowercase<CountryCode> | (string & {});

/** Why a code was rejected. See the README for what each one means and when it happens. */
export type ParseError =
  | "empty" // nothing entered, and the country requires a postal code
  | "unknown-country"
  | "not-applicable" // the country has no postal codes, yet something was entered
  | "invalid-chars"
  | "too-short"
  | "too-long"
  | "invalid-format";

/** The outcome of {@link parse}: the canonical value, or why the code was rejected. */
export type ParseResult =
  | {
      /** The code is acceptable. */
      valid: true;
      /** The canonical form to store and display ("K1A 0T6"); "" for a country without postal codes. */
      value: string;
      /** The country as an alpha-2 code, whichever form it was given in. */
      country: CountryCode;
    }
  | {
      /** The code was rejected. */
      valid: false;
      /** Why. */
      error: ParseError;
      /** The country as an alpha-2 code, or null when it isn't recognised. */
      country: CountryCode | null;
    };

/** What a form needs to know about a country's postal codes, from {@link getCountryInfo}. */
export interface CountryInfo {
  /** ISO 3166-1 alpha-2 code. */
  code: CountryCode;
  /** ISO 3166-1 alpha-3 code. */
  alpha3: string;
  /** False for the ~70 countries without postal codes: hide the field. */
  hasPostalCode: boolean;
  /** Whether addresses in this country need a postal code. */
  required: boolean;
  /** What the country calls it, for a field label. */
  label: "postal code" | "ZIP code" | "PIN code" | "Eircode" | "postcode";
  /** A canonical example, for a placeholder. Empty when there are no postal codes. */
  example: string;
  /** Digits only, so `inputmode="numeric"` is safe. Separators and fixed prefixes are added for you. */
  numeric: boolean;
  /** A safe `maxlength` for the input: room for a typed country prefix and separator ("SE - 114 55"). */
  inputMaxLength: number;
}

interface Rule {
  c: CountryCode;
  r: RegExp[]; // one per alternative; empty = no postal codes
  at: number[]; // per alternative: where the separator goes (negative = from the end, 0 = none)
  sep: string[];
  mn: number;
  mx: number;
  ex: string;
  fl: string;
  st: string[]; // prefixes people write in front of the code (alpha-2, alpha-3, "D"), longest first
  pre: string; // fixed prefix that may be omitted ("LV" in "LV-1050")
}

const ALIASES: { [code: string]: CountryCode } = { UK: "GB", EL: "GR" };
const LABELS: { [flag: string]: CountryInfo["label"] } = { z: "ZIP code", p: "PIN code", e: "Eircode", c: "postcode" };
// Rules by country argument as given ("US", "usa", ...). Only short keys are kept, so it stays bounded.
const memo = new Map<string, Rule>();
let table: { [code: string]: string } | undefined; // code -> packed entry, "" without postal codes
let all: CountryCode[];
let byAlpha3: { [alpha3: string]: CountryCode };
let alpha3Of: { [code: string]: string };

/** Unpack the data once, on first use. */
function load(): { [code: string]: string } {
  if (!table) {
    table = {};
    for (const e of RULES.split(";")) table[e.slice(0, 2)] = e.slice(2);
    for (let i = 0; i < NONE.length; i += 2) table[NONE.substr(i, 2)] = "";
    all = Object.keys(table).sort() as CountryCode[];
    byAlpha3 = {};
    alpha3Of = {};
    let j = 0;
    for (const c of all) {
      const short = ALPHA3[j] > "Z";
      const a3 = short ? c + ALPHA3[j].toUpperCase() : ALPHA3.substr(j, 3);
      j += short ? 1 : 3;
      byAlpha3[a3] = c;
      alpha3Of[c] = a3;
    }
  }
  return table;
}

function resolve(country: unknown): CountryCode | undefined {
  if (typeof country !== "string") return;
  const t = load();
  const up = country.trim().toUpperCase();
  const c = up.length === 3 ? byAlpha3[up] : ALIASES[up] || up;
  // Keys are uppercase, so `in` cannot hit Object.prototype members.
  return c in t ? (c as CountryCode) : undefined;
}

function rule(country: unknown): Rule | undefined {
  let r = typeof country === "string" ? memo.get(country) : undefined;
  if (r) return r;
  const c = resolve(country);
  if (!c) return;
  r = memo.get(c);
  if (!r) {
    // Field layout and the derived defaults are documented in scripts/build-data.ts.
    const [p = "", fl = "", f = "", st = "", len = "", ex = ""] = table![c].split("~");
    const fs = f.split("!");
    const n = len ? parseInt(len[0], 36) : ex.replace(/[ -]/g, "").length;
    memo.set(c, (r = {
      c,
      r: p ? p.replace(/#/g, "\\d").split("!").map((x) => new RegExp("^(?:" + x + ")$")) : [],
      at: fs.map((x) => parseInt(x, 10) || 0),
      sep: fs.map((x) => x.slice(-1)),
      mn: n,
      mx: len ? parseInt(len[1], 36) : n,
      ex,
      fl,
      st: (st ? st.split("!") : []).concat(c, alpha3Of[c]).sort((a, b) => b.length - a.length),
      pre: fl.includes("N") ? (/^[A-Z]+/.exec(p) || [""])[0] : "",
    }));
  }
  if ((country as string).length < 4) memo.set(country as string, r);
  return r;
}

/** Canonical form of `s` if it matches, else null. */
function test(r: Rule, s: string): string | null {
  for (let i = 0; i < r.r.length; i++) {
    if (r.r[i].test(s)) {
      const at = r.at[i] < 0 ? s.length + r.at[i] : r.at[i];
      return at > 0 && at < s.length ? s.slice(0, at) + r.sep[i] + s.slice(at) : s;
    }
  }
  return null;
}

/** Match, tolerating a country prefix in front ("SE-114 55", "D-10115") and a missing fixed one ("1050" in LV). */
function attempt(r: Rule, s: string): [candidate: string, value: string | null] {
  let out = test(r, s);
  if (out === null) {
    for (const p of r.st) {
      if (p !== r.pre && s.length > p.length && s.startsWith(p)) {
        s = s.slice(p.length);
        out = test(r, s);
        break;
      }
    }
    if (out === null && r.pre && !s.startsWith(r.pre)) out = test(r, (s = r.pre + s));
  }
  return [s, out];
}

/** [rule, cleaned input, last candidate tried, canonical value or null]. */
function run(country: unknown, code: unknown): [Rule | undefined, string, string, string | null] {
  const r = rule(country);
  const s = clean(code);
  if (!r) return [r, s, s, null];
  if (!r.r.length) return [r, s, s, s ? null : ""];
  if (!s) return [r, s, s, r.fl.includes("R") ? null : ""]; // empty is fine where a code is optional
  let [t, value] = attempt(r, s);
  // Spreadsheets store codes as numbers and drop their leading zeros: 2134 was "02134". A 0 is a blank cell.
  for (let z = s; value === null && typeof code == "number" && code > 0 && r.fl.includes("N") && z.length < r.mx; ) value = attempt(r, (z = "0" + z))[1];
  return [r, s, t, value];
}

/**
 * Check a postal code and get its canonical form, or the reason it was rejected.
 * Never throws: any input (null, numbers, objects) yields a result.
 *
 * @example parse("ca", "k1a-0t6") // { valid: true, value: "K1A 0T6", country: "CA" }
 * @example parse("GB", "SW1A")    // { valid: false, error: "too-short", country: "GB" }
 * @example parse("AE", "")        // { valid: true, value: "", country: "AE" } (no postal codes in the UAE)
 */
export function parse(country: CountryInput, code: unknown): ParseResult {
  const [r, s, t, value] = run(country, code);
  if (!r) return { valid: false, error: "unknown-country", country: null };
  if (value !== null) return { valid: true, value, country: r.c };
  const error: ParseError =
    !r.r.length ? "not-applicable"
    : !s ? "empty"
    : /[^A-Z0-9]/.test(t) || (r.fl.includes("N") && /[A-Z]/.test(t.slice(r.pre.length))) ? "invalid-chars"
    : t.length < r.mn ? "too-short"
    : t.length > r.mx ? "too-long"
    : "invalid-format";
  return { valid: false, error, country: r.c };
}

/**
 * Whether `code` is acceptable as the postal code for `country`.
 * An empty value is valid where a postal code isn't required (see `CountryInfo.required`).
 */
export function isValid(country: CountryInput, code: unknown): boolean {
  return run(country, code)[3] !== null;
}

/** The canonical form to store and display ("k1a0t6" → "K1A 0T6"), or null if invalid. */
export function format(country: CountryInput, code: unknown): string | null {
  return run(country, code)[3];
}

/** What a form needs to know about a country's postal codes, or null for an unknown country. */
export function getCountryInfo(country: CountryInput): CountryInfo | null {
  const r = rule(country);
  if (!r) return null;
  const fl = r.fl;
  const max = r.r.length ? r.mx + (r.at.some(Boolean) ? 1 : 0) : 0;
  return {
    code: r.c,
    alpha3: alpha3Of[r.c],
    hasPostalCode: r.r.length > 0,
    required: fl.includes("R"),
    label: LABELS[fl[0]] || "postal code",
    example: r.ex,
    numeric: fl.includes("N"),
    // Longest typed prefix (r.st is sorted longest first) plus a separator after it, up to " - ".
    inputMaxLength: max && max + r.st[0].length + 3,
  };
}

/** Every supported country code (252, including XK Kosovo), alphabetically. */
export function getCountries(): CountryCode[] {
  load();
  return all.slice();
}

const names: { [locale: string]: { of(code: string): string | undefined } } = {};

/** Localized country name via the built-in Intl API (no bundled names). Falls back to the code. */
export function getCountryName(country: CountryInput, locale = "en"): string {
  const c = resolve(country);
  if (!c) return "";
  try {
    return (names[locale] ||= new Intl.DisplayNames([locale], { type: "region" })).of(c) || c;
  } catch {
    return c;
  }
}
