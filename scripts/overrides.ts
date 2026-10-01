// Hand-maintained corrections layered on top of Google's libaddressinput data.
// Every entry says why it exists. The build fails if an override stops being
// needed or no longer applies, so this list cannot rot silently.

/** A compact pattern (no separators) and how to format it: "5-" inserts "-" after
 *  the 5th character, "-3 " inserts " " before the last 3. "" means no separator. */
export type Alt = [pattern: string, format: string];

interface Override {
  why: string;
  /** Replace the derived alternatives. Receives the compacted upstream pattern. */
  alts?: (compact: string) => Alt[];
  /** Replace the derived format (single-alternative countries). */
  format?: string;
  /** Which upstream example to show as the placeholder (default: the first). A `widens` override may use a code only it accepts. */
  example?: string;
  /** Deliberately stricter than upstream; tests then skip "accepts everything Google accepts". */
  narrows?: boolean;
  /** Deliberately accepts codes upstream rejects; tests then skip "output satisfies Google's pattern". */
  widens?: boolean;
}

const US_ZIP = { why: "US ZIP+4 territory; upstream examples never show the +4 form", format: "5-" };

export const OVERRIDES: Record<string, Override> = {
  GB: {
    why: "BFPO codes put the space after 'BFPO', not before the last 3 characters",
    alts: (rx) => {
      const parts = rx.split("|BFPO");
      if (parts.length !== 2) throw new Error("GB: BFPO alternative not found");
      return [[parts[0], "-3 "], ["BFPO" + parts[1], "4 "]];
    },
  },
  IE: {
    why: "upstream accepts any 7 letters/digits; Eircodes are a routing key (letter + 2 digits, or D6W) "
      + "and a 4-character identifier, using only 0-9 and the letters A C D E F H K N P R T V W X Y",
    alts: () => [["(?:[AC-FHKNPRTV-Y]\\d{2}|D6W)[\\dAC-FHKNPRTV-Y]{4}", "3 "]],
    narrows: true,
  },
  GG: { why: "UK-style: the space goes before the 3-character inward code (GY10 1AA)", format: "-3 " },
  JE: { why: "UK-style: the space goes before the 3-character inward code", format: "-3 " },
  SE: { why: "PostNord writes '114 55'; upstream examples omit the space", format: "3 " },
  AI: {
    why: "Anguilla's single code is written 'AI-2640'; upstream makes the prefix optional",
    alts: () => [["AI2640", "2-"]],
  },
  OM: {
    why: "'PC' is a label ('PC 133'), not part of the code; EXTRA_PREFIXES strips it",
    alts: () => [["\\d{3}", ""]],
  },
  BH: {
    why: "upstream wraps the pattern in (?:^|\\b)...(?:$|\\b) word-boundary hacks",
    alts: () => [["(?:1[0-2]|[1-9])\\d{2}", ""]],
  },
  CR: {
    why: "the legacy 7-digit form is written '123-4567'",
    alts: () => [["\\d{4,5}", ""], ["\\d{7}", "3-"]],
  },
  PE: {
    why: "legacy 'LIMA 23' / 'CALLAO 2' forms keep their space; show a current 5-digit code",
    example: "02001",
    alts: () => [["[0-2]\\d{4}", ""], ["LIMA\\d{1,2}", "4 "], ["CALLAO0?\\d", "6 "]],
  },
  AM: { why: "the first upstream example is the legacy 6-digit form", example: "0010" },
  AR: {
    why: "upstream accepts only the 8-character CPA (C1070AAM), but the 4-digit code (1070) is what most "
      + "addresses use: every GeoNames code is 4-digit, and upstream's own region prefixes (B?[1-36-8]) allow it",
    alts: (rx) => [[rx, ""], ["\\d{4}", ""]],
    widens: true,
    example: "1070",
  },
  AS: US_ZIP,
  FM: US_ZIP,
  GU: US_ZIP,
  MH: US_ZIP,
  MP: US_ZIP,
  PR: US_ZIP,
  PW: US_ZIP,
};

/** Countries whose English name for the code is "postcode" (Google only knows zip/pin/eircode). */
export const POSTCODE_LABEL = ["GB", "GG", "JE", "IM", "AU", "NZ", "AC", "SH", "TA", "FK", "GI", "GS", "PN", "IO", "TC"];

/**
 * Prefixes people write in front of the code, beyond the country's own alpha-2 code
 * and Google's postprefix: old European vehicle codes still common in address data
 * ("D-10115", "F-75001"), and labels such as Oman's "PC 133".
 */
export const EXTRA_PREFIXES: Record<string, string[]> = {
  DE: ["D"], FR: ["F"], AT: ["A"], IT: ["I"], BE: ["B"], LU: ["L"], NO: ["N"],
  SE: ["S"], PT: ["P"], ES: ["E"], HU: ["H"], LI: ["FL"], OM: ["PC"],
};
