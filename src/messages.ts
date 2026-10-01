// postalkit/messages: ready-made English error messages for parse() results.
// A separate entry point, so apps that bring their own wording (or language) pay nothing.
import { getCountryInfo, type CountryInfo, type ParseError, type ParseResult } from "./index.ts";

/**
 * A message template's key: one per {@link ParseError}, plus `"invalid-chars-digits"`, used
 * instead of `"invalid-chars"` where codes are digits only ("9021O" typed with a letter O).
 */
export type MessageKey = ParseError | "invalid-chars-digits";

/**
 * Message templates. `{label}` becomes what the country calls its code ("ZIP code",
 * "postcode", "Eircode"), `{example}` a valid code. Written so `{label}` never needs "a" or "an".
 */
export const MESSAGES: { readonly [K in MessageKey]: string } = {
  empty: "Enter your {label}.",
  "unknown-country": "Choose a country first.",
  "not-applicable": "This country doesn't use postal codes. Leave this field empty.",
  "invalid-chars": "This {label} contains characters it can't have (e.g. {example}).",
  "invalid-chars-digits": "This {label} can only contain digits (e.g. {example}).",
  "too-short": "This {label} is too short (e.g. {example}).",
  "too-long": "This {label} is too long (e.g. {example}).",
  "invalid-format": "This isn't a valid {label} (e.g. {example}).",
};

/**
 * A message to show for a rejected postal code, or null when it is valid.
 * Pass `messages` to reword or translate some or all of them, and `labels` to replace the
 * English words for the code that `{label}` stands for.
 *
 * @example getErrorMessage(parse("US", "9021"))  // "This ZIP code is too short (e.g. 95014)."
 * @example getErrorMessage(parse("US", "9021O")) // "This ZIP code can only contain digits (e.g. 95014)."
 * @example getErrorMessage(parse("DE", "1011"), { "too-short": "Die {label} ist zu kurz." }, { "postal code": "Postleitzahl" })
 *   // "Die Postleitzahl ist zu kurz."
 */
export function getErrorMessage(
  result: ParseResult,
  messages?: { readonly [K in MessageKey]?: string },
  labels?: { readonly [L in CountryInfo["label"]]?: string },
): string | null {
  if (!result || result.valid !== false) return null;
  const info = result.country ? getCountryInfo(result.country) : null;
  // "Digits only" would contradict an example like "LV-1073", so only where codes have no letters at all.
  const digitsOnly = result.error === "invalid-chars" && !!info && info.numeric && !/[A-Z]/.test(info.example);
  // A caller's own invalid-chars wording beats the English digits-only one.
  const template =
    (digitsOnly && messages && messages["invalid-chars-digits"]) ||
    (messages && messages[result.error]) ||
    MESSAGES[digitsOnly ? "invalid-chars-digits" : result.error];
  if (typeof template !== "string") return null;
  const label = info ? info.label : "postal code";
  return template
    .replace(/\{label\}/g, (labels && labels[label]) || label)
    .replace(/\{example\}/g, info ? info.example : "");
}
