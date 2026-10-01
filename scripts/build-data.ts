// Compiles data/upstream.json (+ overrides) into src/data.ts, the only data the
// runtime ships. Run with `node scripts/build-data.ts`.
//
// Every country becomes one entry: its alpha-2 code, then "pattern~flags~format~strip~lengths~example",
// with trailing empty fields dropped (rarely-set fields come last for that reason).
//   pattern  compact, optimized regex (separators removed), alternatives joined by "!"; "#" = \d
//   flags    z/p/e/c = zip/PIN/Eircode/postcode label, R = required, N = digits only
//   format   separator rule per alternative ("5-", "-3 ", ""), joined by "!"
//   strip    extra prefixes people write in front of the code ("D" for "D-10115"), joined by "!"
//   lengths  min and max compact length, one base-36 digit each; empty = the example's length
//   example  canonical example (a real upstream one)
import { readFileSync, writeFileSync } from "node:fs";
import { canComplete, hasLetters, lengths, mutate, optimize, parse, prefixPattern, prng, sample } from "./regex.ts";
import { EXTRA_PREFIXES, OVERRIDES, POSTCODE_LABEL, type Alt } from "./overrides.ts";

const root = new URL("..", import.meta.url);
const upstream = JSON.parse(readFileSync(new URL("data/upstream.json", root), "utf8")) as {
  fetched: string;
  countries: Record<string, Record<string, string | undefined>>;
};
const alpha3 = JSON.parse(readFileSync(new URL("data/alpha3.json", root), "utf8")) as Record<string, string>;

/** Drop spaces and hyphens that sit between code characters, keeping class ranges. */
function compact(rx: string): string {
  let out = "";
  for (let i = 0; i < rx.length; i++) {
    const c = rx[i];
    if (c === "\\" && rx[i + 1] === "-") {
      i++;
      if (rx[i + 1] === "?") i++;
      continue;
    }
    if (c === "\\") {
      out += c + rx[++i];
      continue;
    }
    if (c === " " || c === "-") {
      if (rx[i + 1] === "?") i++;
      continue;
    }
    if (c === "[") {
      const end = rx.indexOf("]", i + 2);
      const body = rx.slice(i + 1, end);
      if (/^(?:[ -]|\\-)+$/.test(body)) {
        i = end;
        if (rx[i + 1] === "?") i++;
        continue;
      }
      out += rx.slice(i, end + 1);
      i = end;
      continue;
    }
    out += c;
  }
  return out;
}

/** Derive "k<sep>" (from the start) or "-k<sep>" (from the end) from canonical examples. */
function deriveFormat(cc: string, examples: string[]): string {
  const info = examples.map((ex) => {
    const seps = [...ex.matchAll(/[ -]/g)];
    if (seps.length > 1) throw new Error(`${cc}: example "${ex}" has several separators; add an override`);
    const len = ex.length - seps.length;
    return seps.length ? { len, at: seps[0].index!, sep: seps[0][0] } : { len };
  });
  const withSep = info.filter((x) => "sep" in x) as { len: number; at: number; sep: string }[];
  if (!withSep.length) return "";
  const sep = withSep[0].sep;
  if (withSep.some((x) => x.sep !== sep)) throw new Error(`${cc}: mixed separators in examples`);
  const bare = info.filter((x) => !("sep" in x));
  const k = withSep[0].at;
  if (withSep.every((x) => x.at === k) && bare.every((x) => x.len <= k)) return `${k}${sep}`;
  const e = withSep[0].len - withSep[0].at;
  if (withSep.every((x) => x.len - x.at === e) && bare.every((x) => x.len <= e)) return `-${e}${sep}`;
  throw new Error(`${cc}: no consistent separator position in examples; add an override`);
}

/** Mirror of the runtime formatter in src/index.ts. */
function applyFormat(s: string, f: string): string {
  if (!f) return s;
  const n = parseInt(f, 10);
  const i = n < 0 ? s.length + n : n;
  return i > 0 && i < s.length ? s.slice(0, i) + f.slice(-1) + s.slice(i) : s;
}

/** Optimize a pattern and prove, by fuzzing in both directions, that it matches exactly the same strings. */
function optimizeChecked(cc: string, pattern: string): string {
  const out = optimize(pattern);
  const a = new RegExp(`^(?:${pattern})$`);
  const b = new RegExp(`^(?:${out})$`);
  const rnd = prng(cc.charCodeAt(0) * 31 + cc.charCodeAt(1));
  const pa = parse(pattern);
  const pb = parse(out);
  for (let i = 0; i < 3000; i++) {
    const s = i % 3 === 0 ? sample(pa, rnd) : i % 3 === 1 ? sample(pb, rnd) : mutate(sample(pa, rnd), rnd);
    if (a.test(s) !== b.test(s)) throw new Error(`${cc}: optimized pattern disagrees on "${s}"\n  ${pattern}\n  ${out}`);
  }
  return out;
}

/**
 * The pattern postalkit/partial uses: every string that can still be completed into a code
 * parse() accepts, prefixes like "SE-" included. Fuzz-checked against a backtracking matcher.
 */
function partialChecked(cc: string, full: string): string {
  const out = prefixPattern(full);
  const re = new RegExp(`^(?:${out})$`);
  const ast = parse(full);
  const rnd = prng(cc.charCodeAt(0) * 53 + cc.charCodeAt(1));
  for (let i = 0; i < 2000; i++) {
    const s = sample(ast, rnd);
    const cut = s.slice(0, Math.floor(rnd() * (s.length + 2)));
    const t = i % 2 ? cut : mutate(cut, rnd);
    if (re.test(t) !== canComplete(ast, t)) throw new Error(`${cc}: prefix pattern disagrees on "${t}"\n  ${full}\n  ${out}`);
  }
  return out;
}

const usedOverrides = new Set<string>();
const partials: string[] = [];
const rules: { cc: string; value: string }[] = [];
const none: string[] = [];

for (const [cc, c] of Object.entries(upstream.countries)) {
  if (!alpha3[cc]) throw new Error(`${cc}: missing from data/alpha3.json`);
  if (!c.zip) {
    none.push(cc);
    continue;
  }
  const ov = OVERRIDES[cc];
  if (ov) usedOverrides.add(cc);
  const rawExamples = (c.zipex ?? "").split(",").filter(Boolean).map((x) => x.toUpperCase());
  const base = compact(c.zip);

  let alts: Alt[];
  if (ov?.alts) alts = ov.alts(base);
  else alts = [[base, ov?.format ?? deriveFormat(cc, rawExamples)]];
  alts = alts.map(([p, f]) => [optimizeChecked(cc, p), f]);

  // Digits-only after an optional fixed letter prefix ("LV-1050", "BB11000").
  const fixed = alts.length === 1 ? (/^[A-Z]+(?![?*+{])/.exec(alts[0][0])?.[0] ?? "") : "";
  const numeric = alts.length === 1 && !hasLetters(parse(alts[0][0].slice(fixed.length)));
  // Only a prefix in front of digits can be safely added back when someone omits it.
  const prefix = numeric ? fixed : "";
  const asts = alts.map(([p]) => parse(p));
  const re = alts.map(([p]) => new RegExp(`^(?:${p})$`));
  const canon = (code: string) => {
    let s = code.replace(/[ -]/g, "");
    let i = re.findIndex((r) => r.test(s));
    if (i < 0 && prefix) i = re.findIndex((r) => r.test((s = prefix + s)));
    return i < 0 ? null : applyFormat(s, alts[i][1]);
  };

  // Our canonical form of every upstream example must still satisfy Google's own pattern.
  const google = new RegExp(`^(?:${c.zip.replace(/\(\?:\^\|\\b\)|\(\?:\$\|\\b\)/g, "")})$`);
  const examples = rawExamples.map((ex) => {
    const out = canon(ex);
    if (out === null) throw new Error(`${cc}: example "${ex}" rejected by compiled pattern`);
    if (!google.test(out)) throw new Error(`${cc}: canonical "${out}" rejected by upstream pattern ${c.zip}`);
    if (!ov && out !== ex) throw new Error(`${cc}: example "${ex}" formats to "${out}"; add an override`);
    return out;
  });
  if (!examples.length) throw new Error(`${cc}: no examples`);
  const example = ov?.example ?? examples[0];
  // An override's example must be an upstream one, unless the override widens the format and its own pattern accepts it as canonical.
  if (!examples.includes(example) && !(ov?.widens && canon(example) === example))
    throw new Error(`${cc}: override example ${example} is not an upstream example`);

  const lens = asts.map(lengths);
  const min = Math.min(...lens.map((l) => l[0]));
  const max = Math.max(...lens.map((l) => l[1]));
  if (max > 35) throw new Error(`${cc}: max length ${max} does not fit one base-36 digit`);

  const label =
    c.zip_name_type === "zip" ? "z" : c.zip_name_type === "pin" ? "p" : c.zip_name_type === "eircode" ? "e"
    : POSTCODE_LABEL.includes(cc) ? "c" : "";
  if (c.zip_name_type && !label) throw new Error(`${cc}: unknown zip_name_type ${c.zip_name_type}`);
  const flags = label + ((c.require ?? "").includes("Z") ? "R" : "") + (numeric ? "N" : "");

  const post = (c.postprefix ?? "").replace(/[ -]/g, "").toUpperCase();
  const strip = [...new Set([post, ...(EXTRA_PREFIXES[cc] ?? [])])].filter((p) => p && p !== cc && p !== prefix);

  // What parse() accepts, mirroring attempt() in src/index.ts: an optional typed prefix
  // (never the fixed one), then the code, with or without its fixed prefix.
  const typed = [...strip, cc].filter((p) => p !== prefix);
  const codes = alts.map((a) => a[0]).concat(prefix ? [alts[0][0].slice(prefix.length)] : []);
  const partial = partialChecked(cc, (typed.length ? `(?:${typed.join("|")})?` : "") + `(?:${codes.join("|")})`);
  if (partial.includes("#")) throw new Error(`${cc}: prefix pattern contains "#"`);
  partials.push(`  ${cc}: ${JSON.stringify(partial.replaceAll("\\d", "#"))},`);

  // The lengths are left out when every code is as long as the example (mirrored in rule() in src/index.ts).
  const fixedLen = min === max && max === example.replace(/[ -]/g, "").length;
  const fields = [
    alts.map((a) => a[0]).join("!"),
    flags,
    alts.map((a) => a[1]).join("!"),
    strip.join("!"),
    fixedLen ? "" : min.toString(36) + max.toString(36),
    example,
  ];
  for (const f of fields) if (/[~;#]/.test(f)) throw new Error(`${cc}: field contains a reserved character (~ ; #)`);
  for (const [p] of alts) if (p.includes("!")) throw new Error(`${cc}: pattern contains "!"`);
  fields[0] = fields[0].replaceAll("\\d", "#");

  rules.push({ cc, value: fields.join("~").replace(/~+$/, "") });
}

for (const cc of Object.keys(OVERRIDES)) if (!usedOverrides.has(cc)) throw new Error(`override ${cc} unused`);
for (const cc of Object.keys(EXTRA_PREFIXES)) if (!upstream.countries[cc]?.zip) throw new Error(`extra prefix ${cc} unused`);

rules.sort((a, b) => a.cc.localeCompare(b.cc));
const all = Object.keys(upstream.countries).sort();

const out = `// GENERATED by scripts/build-data.ts — do not edit. Run \`npm run data\` instead.
// Derived from Google libaddressinput address data (CC-BY 4.0), snapshot ${upstream.fetched}.
// Format of each entry is documented at the top of scripts/build-data.ts.

/**
 * Countries with postal codes: alpha-2 code + entry, ";"-separated, "#" standing for \\d.
 * Minifiers fold the concatenation.
 */
export const RULES =
${rules.map((r, i) => `  ${JSON.stringify(r.cc + r.value + (i < rules.length - 1 ? ";" : ""))}`).join(" +\n")};

/** Countries without a postal code system, concatenated alpha-2 codes. */
export const NONE = "${none.join("")}";

/**
 * Alpha-3 codes in alphabetical order of their alpha-2 codes. A lowercase letter
 * means "alpha-2 + this letter" (DE + u = DEU); otherwise three uppercase letters.
 */
export const ALPHA3 = "${all.map((cc) => (alpha3[cc].startsWith(cc) ? alpha3[cc][2].toLowerCase() : alpha3[cc])).join("")}";

/** ISO 3166-1 alpha-2 code of a supported country or territory (252, including XK for Kosovo). */
export type CountryCode =
${all.map((cc) => `  | "${cc}"`).join("\n")};
`;
writeFileSync(new URL("src/data.ts", root), out);
console.log(`src/data.ts: ${rules.length} countries with postal codes, ${none.length} without (${out.length} bytes)`);

// ---------------------------------------------------------------------------
// Regions (postalkit/regions): states and provinces with the postal-code prefixes
// that belong to them, for the countries where Google publishes prefixes.
// Per country: [names, ISO 3166-2 suffixes, prefix patterns], each "~"-joined in the same order.

const regions: string[] = [];
let regionCount = 0;
for (const [cc, c] of Object.entries(upstream.countries)) {
  if (!c.sub_zips) continue;
  const keys = c.sub_keys!.split("~");
  // Latin-script names where Google has them (Japan: "Hokkaido", not 北海道), else local names, else keys.
  const names = (c.sub_lnames ?? c.sub_names ?? c.sub_keys!).split("~");
  const iso = (c.sub_isoids ?? "").split("~");
  const zips = c.sub_zips.split("~");
  if (names.length !== keys.length || zips.length !== keys.length || (c.sub_isoids && iso.length !== keys.length))
    throw new Error(`${cc}: subdivision lists differ in length`);
  for (const [i, z] of zips.entries()) {
    if (!names[i]) throw new Error(`${cc}: subdivision ${keys[i]} has no name`);
    if (/[~;]/.test(z + names[i] + (iso[i] ?? ""))) throw new Error(`${cc}: reserved character in subdivision ${keys[i]}`);
    if (z) new RegExp(`^(?:${z})`); // must compile
  }
  regionCount += keys.length;
  regions.push(`  ${cc}: [${[names, c.sub_isoids ? iso : [], zips].map((l) => JSON.stringify(l.join("~"))).join(", ")}],`);
}

const regionsOut = `// GENERATED by scripts/build-data.ts — do not edit. Run \`npm run data\` instead.
// Derived from Google libaddressinput address data (CC-BY 4.0), snapshot ${upstream.fetched}.

/**
 * Per country: [names, ISO 3166-2 suffixes ("" when unknown), postal-code prefix patterns],
 * each "~"-joined in the same order. A code belongs to a region when its compact form
 * (no separators) starts with a match of the region's pattern.
 */
export const REGIONS: { [code: string]: [names: string, iso: string, prefixes: string] } = {
${regions.join("\n")}
};
`;
writeFileSync(new URL("src/regions-data.ts", root), regionsOut);
console.log(`src/regions-data.ts: ${regionCount} regions in ${regions.length} countries (${regionsOut.length} bytes)`);

// ---------------------------------------------------------------------------
// Partial input (postalkit/partial): per country, the strings that can still become a valid code.

const partialOut = `// GENERATED by scripts/build-data.ts — do not edit. Run \`npm run data\` instead.
// Derived from Google libaddressinput address data (CC-BY 4.0), snapshot ${upstream.fetched}.

/**
 * Per country with postal codes: a pattern ("#" standing for \\d) matching every compact input
 * (uppercase, no separators) that can still be completed into a code parse() accepts.
 */
export const PARTIAL: { [code: string]: string } = {
${partials.sort().join("\n")}
};
`;
writeFileSync(new URL("src/partial-data.ts", root), partialOut);
console.log(`src/partial-data.ts: ${partials.length} countries (${partialOut.length} bytes)`);
