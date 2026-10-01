// Head-to-head on real-world input: postalkit vs postal-code-checker.
// Each case is what a user typed and the value a correct library should store.
import * as pcc from "postal-code-checker";
import { format } from "../src/index.ts";

type Case = [country: string, input: unknown, expected: string | null, why: string];
const CASES: Case[] = [
  ["CA", "K1A0T6", "K1A 0T6", "missing space"],
  ["CA", "k1a-0t6", "K1A 0T6", "hyphen instead of space"],
  ["GB", "sw1a1aa", "SW1A 1AA", "missing space"],
  ["GB", "SW1A  1AA", "SW1A 1AA", "double space"],
  ["US", "902101234", "90210-1234", "ZIP+4 without hyphen"],
  ["US", "90210 1234", "90210-1234", "ZIP+4 with space"],
  ["US", "90210–1234", "90210-1234", "en dash from autocorrect"],
  ["NL", "1234ab", "1234 AB", "missing space"],
  ["JP", "1000001", "100-0001", "missing hyphen"],
  ["JP", "１００－０００１", "100-0001", "full-width (Japanese IME)"],
  ["BR", "01310100", "01310-100", "missing hyphen"],
  ["PL", "00950", "00-950", "missing hyphen"],
  ["SE", "11455", "114 55", "missing space"],
  ["SE", "SE-114 55", "114 55", "country prefix"],
  ["DE", "D-10115", "10115", "old vehicle-code prefix"],
  ["LV", "1050", "LV-1050", "required prefix omitted"],
  ["AE", "", "", "UAE has no postal codes"],
  ["XK", "10000", "10000", "Kosovo"],
  ["US", null, null, "null input (must not crash)"],
  ["US", 90210, "90210", "number from a spreadsheet"],
  ["GB", "QQ1 1AA", null, "nonexistent area"],
  ["DE", "1O115", null, "letter O for zero"],
];

function theirs(country: string, input: unknown): string | null | "CRASH" {
  try {
    return pcc.format(country, input as string);
  } catch {
    return "CRASH";
  }
}

let ours = 0;
let them = 0;
let oursAccept = 0;
let themAccept = 0;
const show = (v: unknown) => (v === null ? "null" : JSON.stringify(v));
console.log(`${"case".padEnd(34)} ${"expected".padEnd(13)} ${"postal-code-checker".padEnd(20)} postalkit`);
for (const [country, input, expected, why] of CASES) {
  const a = theirs(country, input);
  const b = format(country, input);
  if (a === expected) them++;
  if (b === expected) ours++;
  // Looser score: only whether valid input was accepted and invalid input rejected.
  if ((a !== null && a !== "CRASH") === (expected !== null)) themAccept++;
  if ((b !== null) === (expected !== null)) oursAccept++;
  const mark = (v: unknown) => `${v === expected ? "✓" : "✗"} ${show(v)}`;
  console.log(`${`${country} ${show(input)} (${why})`.slice(0, 34).padEnd(34)} ${show(expected).padEnd(13)} ${mark(a).padEnd(20)} ${mark(b)}`);
}
const n = CASES.length;
console.log(`\naccepts/rejects correctly:   postal-code-checker ${themAccept}/${n}   postalkit ${oursAccept}/${n}`);
console.log(`returns the canonical value: postal-code-checker ${them}/${n}   postalkit ${ours}/${n}`);
