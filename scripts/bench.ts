// Throughput of postalkit. Run after `npm run build` (measures dist/).
import * as pk from "../dist/index.js";

function bench(fn: () => unknown, ms = 400): number {
  for (let i = 0; i < 2000; i++) fn(); // warm up
  let n = 0;
  const end = performance.now() + ms;
  while (performance.now() < end) for (let i = 0; i < 1000; i++, n++) fn();
  return (n / ms) * 1000;
}

const rows: [string, () => unknown][] = [
  ["validate US 90210", () => pk.isValid("US", "90210")],
  ["validate GB SW1A 1AA", () => pk.isValid("GB", "SW1A 1AA")],
  ["validate alpha-3 CAN", () => pk.isValid("CAN", "K1A 0T6")],
  ["validate invalid", () => pk.isValid("DE", "1O115")],
  ["format CA", () => pk.format("CA", "k1a 0t6")],
];

const fmt = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : `${(n / 1e3).toFixed(0)}k`);
console.log(`${"ops/sec".padEnd(24)} ${"postalkit".padStart(12)}`);
for (const [name, fn] of rows) console.log(`${name.padEnd(24)} ${fmt(bench(fn)).padStart(12)}`);
