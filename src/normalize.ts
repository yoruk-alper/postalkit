// Input normalization shared by the core and postalkit/partial, so the two can't drift apart.
// Each entry point's bundle gets its own copy; this file is the one source.

// Spaces, dots, hyphens and dashes (U+2010-U+2015), minus (U+2212), "ー" (U+30FC, typed as a dash in Japanese), "〒",
// and the invisible characters that come along when copying from web pages and PDFs: soft hyphen,
// zero-width space, joiners, word joiner and byte order mark.
const SEPARATORS = /[\s.\-_‐-―−ー〒\u00ad\u200b-\u200d\u2060\ufeff]/g;
const DIGIT = /\p{Nd}/u;

/** The value of a decimal digit in any script ("٣", "۳", "३", "๓" are all 3). */
function digit(d: string): string {
  // Unicode encodes decimal digits in contiguous runs of ten, 0 to 9, so a digit's
  // value is how many digits precede it in its run (mod 10 for runs that abut).
  const c = d.codePointAt(0)!;
  let n = 0;
  while (DIGIT.test(String.fromCodePoint(c - 1 - n))) n++;
  return "" + (n % 10);
}

/** Uppercase, fold full-width characters and native-script digits, drop every separator. Numbers stay as written, other non-strings become "". */
export function clean(input: unknown): string {
  // Numbers are kept as written, separators included, so only whole ones can be codes:
  // 9021.5 and -90210 are rejected as invalid characters rather than read as "90215" and "90210".
  if (typeof input === "number") return isNaN(input) ? "" : "" + input;
  let s = typeof input === "string" ? input : "";
  if (/[^\x20-\x7e]/.test(s)) {
    if (s.normalize) s = s.normalize("NFKC");
    s = s.replace(/(?![0-9])\p{Nd}/gu, digit);
  }
  return s.toUpperCase().replace(SEPARATORS, "");
}
