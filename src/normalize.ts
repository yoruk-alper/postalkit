// Input normalization shared by the core and postalkit/partial, so the two can't drift apart.
// Each entry point's bundle gets its own copy; this file is the one source.

// Spaces, dots, hyphens and dashes (U+2010-U+2015), minus (U+2212), "ー" (U+30FC, typed as a dash in Japanese), "〒".
const SEPARATORS = /[\s.\-_‐-―−ー〒]/g;

/** Uppercase, fold full-width characters, drop every separator. Non-strings become "". */
export function clean(input: unknown): string {
  // Whole numbers only: 9021.5 must not become "90215" once the dot is dropped.
  let s = typeof input === "string" ? input : Number.isInteger(input) && (input as number) >= 0 ? "" + input : "";
  if (/[^\x20-\x7e]/.test(s) && s.normalize) s = s.normalize("NFKC");
  return s.toUpperCase().replace(SEPARATORS, "");
}
