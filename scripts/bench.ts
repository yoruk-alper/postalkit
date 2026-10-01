// Throughput, postalkit vs postal-code-checker. Run after `npm run build` (measures dist/).
import * as pcc from "postal-code-checker";
import * as pk from "../dist/index.js";

function bench(fn: () => unknown, ms = 400): number {
  for (let i = 0; i < 2000; i++) fn(); // warm up
  let n = 0;
  const end = performance.now() + ms;
  while (performance.now() < end) for (let i = 0; i < 1000; i++, n++) fn();
  return (n / ms) * 1000;
}

const rows: [string, () => unknown, () => unknown][] = [
  ["validate US 90210", () => pcc.validatePostalCode("US", "90210"), () => pk.isValid("US", "90210")],
  ["validate GB SW1A 1AA", () => pcc.validatePostalCode("GB", "SW1A 1AA"), () => pk.isValid("GB", "SW1A 1AA")],
  ["validate alpha-3 CAN", () => pcc.validatePostalCode("CAN", "K1A 0T6"), () => pk.isValid("CAN", "K1A 0T6")],
  ["validate invalid", () => pcc.validatePostalCode("DE", "1O115"), () => pk.isValid("DE", "1O115")],
  ["format CA", () => pcc.format("CA", "k1a 0t6"), () => pk.format("CA", "k1a 0t6")],
  ["guess country 12345", () => pcc.guessCountries("12345"), () => pk.guessCountry("12345")],
];

const fmt = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : `${(n / 1e3).toFixed(0)}k`);
console.log(`${"ops/sec".padEnd(24)} ${"postal-code-checker".padStart(20)} ${"postalkit".padStart(12)}   speedup`);
for (const [name, theirs, ours] of rows) {
  const a = bench(theirs);
  const b = bench(ours);
  console.log(`${name.padEnd(24)} ${fmt(a).padStart(20)} ${fmt(b).padStart(12)}   ${(b / a).toFixed(1)}x`);
}
