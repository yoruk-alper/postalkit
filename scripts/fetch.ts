// Downloads Google's libaddressinput country data into data/upstream.json.
//   node scripts/fetch.ts          refresh the snapshot (then run `npm run data`)
//   node scripts/fetch.ts --check  exit 1 if upstream changed since the snapshot (CI drift alarm)
import { readFileSync, writeFileSync } from "node:fs";

const BASE = "https://chromium-i18n.appspot.com/ssl-address/data";
const FILE = new URL("../data/upstream.json", import.meta.url);

async function get(path: string): Promise<Record<string, string>> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(path ? `${BASE}/${path}` : BASE);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as Record<string, string>;
    } catch (err) {
      if (attempt >= 4) throw new Error(`${path || "country list"}: ${(err as Error).message}`);
      await new Promise((r) => setTimeout(r, attempt * 500));
    }
  }
}

const codes = (await get("")).countries.split("~");
const out: Record<string, Record<string, string>> = {};
const queue = [...codes];
await Promise.all(
  Array.from({ length: 8 }, async () => {
    for (let cc; (cc = queue.shift()); ) out[cc] = await get(cc);
  }),
);
const countries = Object.fromEntries(codes.map((cc) => [cc, out[cc]]));

if (process.argv.includes("--check")) {
  const old = JSON.parse(readFileSync(FILE, "utf8")).countries as typeof countries;
  const changed = [...new Set([...Object.keys(old), ...codes])].filter(
    (cc) => JSON.stringify(old[cc]) !== JSON.stringify(countries[cc]),
  );
  if (changed.length) {
    console.error(`upstream changed for: ${changed.join(" ")}. Run \`npm run fetch && npm run data\` and review.`);
    process.exit(1);
  }
  console.log(`upstream unchanged (${codes.length} countries)`);
} else {
  const fetched = new Date().toISOString().slice(0, 10);
  writeFileSync(FILE, JSON.stringify({ fetched, countries }, null, 1) + "\n");
  console.log(`fetched ${codes.length} countries`);
}
