// postalkit/messages: ready-made English error messages for parse() results.
// A separate entry point, so apps that bring their own wording (or language) pay nothing.
import { getCountryInfo, type ParseError, type ParseResult } from "./index.ts";

/**
 * Message templates per error. `{label}` becomes what the country calls its code ("ZIP code",
 * "postcode", "Eircode"), `{example}` a valid code. Written so `{label}` never needs "a" or "an".
 */
export const MESSAGES: { readonly [E in ParseError]: string } = {
  empty: "Enter your {label}.",
  "unknown-country": "Choose a country first.",
  "not-applicable": "This country doesn't use postal codes. Leave this field empty.",
  "invalid-chars": "This {label} contains characters it can't have (e.g. {example}).",
  "too-short": "This {label} is too short (e.g. {example}).",
  "too-long": "This {label} is too long (e.g. {example}).",
  "invalid-format": "This isn't a valid {label} (e.g. {example}).",
};

/**
 * A message to show for a rejected postal code, or null when it is valid.
 * Pass `messages` to reword or translate some or all of them; the same placeholders apply.
 *
 * @example getErrorMessage(parse("US", "9021"))  // "This ZIP code is too short (e.g. 95014)."
 * @example getErrorMessage(parse("GB", ""), { empty: "Postcode required" }) // "Postcode required"
 */
export function getErrorMessage(
  result: ParseResult,
  messages?: { readonly [E in ParseError]?: string },
): string | null {
  if (!result || result.valid !== false) return null;
  const template = (messages && messages[result.error]) || MESSAGES[result.error];
  if (typeof template !== "string") return null;
  const info = result.country ? getCountryInfo(result.country) : null;
  return template
    .replace(/\{label\}/g, info ? info.label : "postal code")
    .replace(/\{example\}/g, info ? info.example : "");
}
