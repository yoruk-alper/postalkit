// Builds dist/: ESM + CJS bundles (esbuild) and self-contained .d.ts files (tsc) for
// each entry point. The other entry points import the core instead of bundling a copy,
// so an app using several ships the core once.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { build, type Plugin } from "esbuild";

const dist = new URL("../dist/", import.meta.url);
const tmp = new URL("../.types/", import.meta.url);
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist);

const banner = "/*! postalkit | MIT | postal data derived from Google libaddressinput (CC-BY 4.0), see NOTICE */";
const ENTRIES = ["index", "regions", "partial", "messages"];

/** Keep `import ... from "./index.ts"` as an import of the built core file. */
const externalCore = (file: string): Plugin => ({
  name: "external-core",
  setup(b) {
    b.onResolve({ filter: /^\.\/index\.ts$/ }, () => ({ path: `./${file}`, external: true }));
  },
});

for (const entry of ENTRIES) {
  for (const [format, ext] of [["esm", "js"], ["cjs", "cjs"]] as const) {
    await build({
      entryPoints: [`src/${entry}.ts`],
      outfile: `dist/${entry}.${ext}`,
      bundle: true,
      format,
      target: "es2017",
      platform: "neutral",
      banner: { js: banner },
      legalComments: "none",
      plugins: entry === "index" ? [] : [externalCore(`index.${ext}`)],
    });
  }
}

// Declarations: emit with tsc, inline the generated CountryCode union into the core
// types, and point other entries at the core's published types.
rmSync(tmp, { recursive: true, force: true });
execFileSync(
  process.execPath,
  ["node_modules/typescript/bin/tsc", "--ignoreConfig", ...ENTRIES.map((e) => `src/${e}.ts`), "--declaration", "--emitDeclarationOnly",
    "--outDir", ".types", "--target", "ES2020", "--module", "NodeNext", "--moduleResolution", "NodeNext",
    "--allowImportingTsExtensions", "--strict", "--skipLibCheck", "--lib", "ES2021,DOM"],
  { stdio: "inherit" },
);
const read = (f: string) => readFileSync(new URL(f, tmp), "utf8");
const union = /(?:\/\*\*(?:(?!\*\/)[\s\S])*\*\/\n)?export type CountryCode =[\s\S]*?;/.exec(read("data.d.ts"))![0];
const core = read("index.d.ts")
  .replace(/import \{[^}]*\} from "\.\/data\.ts";\n/, "")
  .replace(/export type \{ CountryCode \};\n/, union + "\n");
if (core.includes("./data")) throw new Error("dist types still reference ./data");
writeFileSync(new URL("index.d.ts", dist), core);
writeFileSync(new URL("index.d.cts", dist), core);

for (const entry of ENTRIES.filter((e) => e !== "index")) {
  const types = read(`${entry}.d.ts`);
  if (!types.includes('"./index.ts"')) throw new Error(`${entry}.d.ts: expected an import of ./index.ts`);
  if (/from "\.\/(?!index\.ts")/.test(types)) throw new Error(`${entry}.d.ts references other internal files`);
  writeFileSync(new URL(`${entry}.d.ts`, dist), types.replaceAll('"./index.ts"', '"./index.js"'));
  writeFileSync(new URL(`${entry}.d.cts`, dist), types.replaceAll('"./index.ts"', '"./index.cjs"'));
}
rmSync(tmp, { recursive: true, force: true });
console.log("built dist/");
