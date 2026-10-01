// postalkit/partial: validation while the user is still typing.
// A separate entry point so the core stays small for everyone who doesn't need it.
import { parse, type CountryInput, type ParseResult } from "./index.ts";
import { clean } from "./normalize.ts";
import { PARTIAL } from "./partial-data.ts";

/**
 * - `"complete"`: valid now (`parse` accepts it). It may still grow: "90210" can become ZIP+4.
 * - `"partial"`: not valid yet, but more characters can make it valid ("SW1", "9021", "" where a code is required).
 * - `"invalid"`: no continuation can make it valid ("1O1" in Germany), or the country is unknown.
 */
export type PartialStatus = "complete" | "partial" | "invalid";

const cache: { [code: string]: RegExp } = {};

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

/**
 * `parse`, with a better reason for input that can't be completed: `"too-short"` only when more
 * characters can make the code valid, `"invalid-format"` when they can't ("QQ1": no UK postcode
 * starts with QQ). Use it instead of `parse` in forms, while typing and on blur.
 *
 * @example parseTyped("GB", "SW1A") // { valid: false, error: "too-short", country: "GB" }
 * @example parseTyped("GB", "QQ1")  // { valid: false, error: "invalid-format", country: "GB" }
 */
export function parseTyped(country: CountryInput, input: unknown): ParseResult {
  const r = parse(country, input);
  return !r.valid && r.error === "too-short" && checkPartial(country, input) === "invalid"
    ? { valid: false, error: "invalid-format", country: r.country }
    : r;
}
