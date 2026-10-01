// postalkit/partial: validation while the user is still typing.
// A separate entry point so the core stays small for everyone who doesn't need it.
import { parse, type CountryInput } from "./index.ts";
import { PARTIAL } from "./partial-data.ts";

/**
 * - `"complete"`: valid now (`parse` accepts it). It may still grow: "90210" can become ZIP+4.
 * - `"partial"`: not valid yet, but more characters can make it valid ("SW1", "9021", "").
 * - `"invalid"`: no continuation can make it valid ("1O1" in Germany), or the country is unknown.
 */
export type PartialStatus = "complete" | "partial" | "invalid";

// Same normalization as the core: separators the core ignores (see SEPARATORS in src/index.ts).
const SEPARATORS = /[\s.\-_‐-―−ー〒]/g;
const cache: { [code: string]: RegExp } = {};

function clean(input: unknown): string {
  let s = typeof input === "string" ? input : Number.isInteger(input) && (input as number) >= 0 ? "" + input : "";
  if (/[^\x20-\x7e]/.test(s) && s.normalize) s = s.normalize("NFKC");
  return s.toUpperCase().replace(SEPARATORS, "");
}

/**
 * Whether what has been typed so far is a valid postal code, could still become one, or can't.
 * Show an error only for `"invalid"` while the field has focus, and run `parse` on blur.
 * Never throws.
 *
 * @example checkPartial("GB", "SW1")      // "partial"
 * @example checkPartial("GB", "SW1A 1AA") // "complete"
 * @example checkPartial("DE", "1O1")      // "invalid" (letter O)
 */
export function checkPartial(country: CountryInput, input: unknown): PartialStatus {
  const r = parse(country, input);
  if (r.valid) return "complete";
  const c = r.country;
  // Codes are uppercase, so `in` cannot hit Object.prototype members.
  if (!c || !(c in PARTIAL)) return "invalid"; // unknown country, or one without postal codes
  const re = (cache[c] ||= new RegExp("^(?:" + PARTIAL[c].replace(/#/g, "\\d") + ")$"));
  return re.test(clean(input)) ? "partial" : "invalid";
}
