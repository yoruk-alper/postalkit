// Measures what an app actually ships: the package bundled and minified, then compressed.
// Fails if postalkit grows past its budget. `--compare` also measures postal-code-checker.
import { brotliCompressSync, gzipSync } from "node:zlib";
import { build } from "esbuild";

const BUDGET_GZIP = 4300; // bytes, minified + gzip, whole API

async function measure(contents: string): Promise<{ min: number; gzip: number; brotli: number }> {
  const out = await build({
    stdin: { contents, resolveDir: process.cwd(), loader: "js" },
    bundle: true,
    minify: true,
    format: "esm",
    write: false,
    legalComments: "none",
  });
  const code = out.outputFiles[0].contents;
  return { min: code.length, gzip: gzipSync(code, { level: 9 }).length, brotli: brotliCompressSync(code).length };
}

const fmt = (n: number) => `${(n / 1024).toFixed(2)} kB`;
const row = (name: string, s: { min: number; gzip: number; brotli: number }) =>
  console.log(`${name.padEnd(44)} min ${fmt(s.min).padStart(9)}   gzip ${fmt(s.gzip).padStart(8)}   brotli ${fmt(s.brotli).padStart(8)}`);

const full = await measure(`export * from "./dist/index.js";`);
row("postalkit (everything)", full);
row("postalkit { isValid }", await measure(`import { isValid } from "./dist/index.js"; console.log(isValid);`));
const regions = await measure(`export * from "./dist/index.js"; export * from "./dist/regions.js";`);
row("postalkit + postalkit/regions", regions);
row("  of which regions", { min: regions.min - full.min, gzip: regions.gzip - full.gzip, brotli: regions.brotli - full.brotli });

if (process.argv.includes("--compare")) {
  row("postal-code-checker (everything)", await measure(`export * from "postal-code-checker";`));
  row("postal-code-checker { validatePostalCode }", await measure(`import { validatePostalCode } from "postal-code-checker"; console.log(validatePostalCode);`));
}

if (full.gzip > BUDGET_GZIP) {
  console.error(`\nsize budget exceeded: ${fmt(full.gzip)} gzip > ${fmt(BUDGET_GZIP)}`);
  process.exit(1);
}
