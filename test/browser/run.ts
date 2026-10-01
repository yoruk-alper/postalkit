// Browser and bundler test: postalkit as a real app gets it.
//   1. packs the package and installs the tarball here (as a consumer would),
//   2. builds the test app four ways: native ES modules + import map, Vite, webpack (ESM), webpack (CommonJS),
//   3. loads each in Chromium, Firefox and WebKit, and checks known answers plus a fingerprint of
//      every country's behavior against Node's,
//   4. checks that a webpack production bundle of `isValid` alone leaves the rest of the API out.
// Run from the repository root with `npm run test:browser` (after `npx --prefix test/browser playwright install`).
// Pass browser names to run only some: `npm run test:browser -- chromium webkit`.
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { chromium, firefox, webkit, type BrowserType } from "playwright";
import { build as vite } from "vite";
import webpack from "webpack";

const here = new URL(".", import.meta.url).pathname;
const root = join(here, "../..");
const app = join(here, "app");
const out = join(here, "out");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

// 1. Install the packed package, exactly what npm would publish.
const packDir = mkdtempSync(join(tmpdir(), "postalkit-pack-"));
execFileSync(npm, ["pack", "--pack-destination", packDir, "--silent"], { cwd: root, stdio: ["ignore", "ignore", "inherit"] });
const tarball = join(packDir, readdirSync(packDir).find((f) => f.endsWith(".tgz"))!);
execFileSync(npm, ["install", "--no-save", "--no-audit", "--no-fund", tarball], { cwd: here, stdio: "inherit" });
rmSync(packDir, { recursive: true, force: true });

// Expected fingerprint, from Node and the same installed package.
const api = {
  core: await import("postalkit"),
  regions: await import("postalkit/regions"),
  partial: await import("postalkit/partial"),
  messages: await import("postalkit/messages"),
};
const { fingerprint, run } = await import(join(app, "checks.js"));
const nodeFailures: string[] = run(api);
if (nodeFailures.length) throw new Error(`checks fail in Node itself:\n  ${nodeFailures.join("\n  ")}`);
const expected: { hash: string; inputs: number } = fingerprint(api);

// 2. Build the variants.
rmSync(out, { recursive: true, force: true });
mkdirSync(out);
const page = (script: string, extra = "") =>
  `<!doctype html><meta charset="utf-8"><title>postalkit</title>${extra}<script ${script}></script>\n`;

// Native ES modules, no bundler: the dist files as published, mapped with an import map.
const esm = join(out, "esm");
cpSync(join(here, "node_modules/postalkit/dist"), join(esm, "postalkit"), { recursive: true });
for (const f of ["entry.js", "checks.js"]) cpSync(join(app, f), join(esm, f));
const imports = Object.fromEntries(
  ["", "/regions", "/partial", "/messages"].map((p) => [`postalkit${p}`, `./postalkit/${p ? p.slice(1) : "index"}.js`]),
);
writeFileSync(join(esm, "index.html"), page(`type="module" src="./entry.js"`, `<script type="importmap">${JSON.stringify({ imports })}</script>`));

await vite({ root: app, base: "./", logLevel: "warn", build: { outDir: join(out, "vite"), emptyOutDir: true } });

function pack(entry: string, dir: string): Promise<string> {
  return new Promise((resolve, reject) =>
    webpack({ mode: "production", entry: join(app, entry), output: { path: join(out, dir), filename: "main.js" } }, (err, stats) => {
      if (err || stats!.hasErrors()) return reject(err ?? new Error(stats!.toString("errors-only")));
      writeFileSync(join(out, dir, "index.html"), page(`src="./main.js"`));
      resolve(readFileSync(join(out, dir, "main.js"), "utf8"));
    }),
  );
}
await pack("entry.js", "webpack");
await pack("entry.cjs", "webpack-cjs");

// 4. Tree shaking: isValid alone must not pull in the rest of the API.
const shaken = await pack("treeshake.js", "treeshake");
const leaked = ["DisplayNames", "inputMaxLength"].filter((s) => shaken.includes(s));
const problems: string[] = leaked.length ? [`treeshake: an isValid-only bundle contains ${leaked.join(", ")}`] : [];
console.log(`webpack bundle of isValid alone: ${(shaken.length / 1024).toFixed(1)} kB minified`);

// 3. Serve and load every variant in every browser.
const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
const server = createServer((req, res) => {
  let path = decodeURIComponent(new URL(req.url!, "http://x").pathname);
  if (path.endsWith("/")) path += "index.html";
  try {
    const body = readFileSync(join(out, path));
    res.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" }).end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

const variants = ["esm", "vite", "webpack", "webpack-cjs", "treeshake"];
const ALL: [string, BrowserType][] = [["chromium", chromium], ["firefox", firefox], ["webkit", webkit]];
const wanted = process.argv.slice(2);
const browsers = wanted.length ? ALL.filter(([name]) => wanted.includes(name)) : ALL;
if (!browsers.length) throw new Error(`unknown browsers: ${wanted.join(" ")}; use chromium, firefox, webkit`);
const rows: string[] = [];
try {
  for (const [name, type] of browsers) {
    let browser;
    try {
      browser = await type.launch();
    } catch (e) {
      problems.push(`${name}: failed to launch: ${(e as Error).message.split("\n")[0]}`);
      rows.push(`${name.padEnd(9)}  did not launch`);
      continue;
    }
    try {
      const line = [name.padEnd(9)];
      for (const variant of variants) {
        const tab = await browser.newPage();
        const errors: string[] = [];
        tab.on("pageerror", (e) => errors.push(e.message));
        tab.on("console", (m) => m.type() === "error" && errors.push(m.text()));
        let ok = false;
        try {
          await tab.goto(`${base}/${variant}/`);
          await tab.waitForFunction(() => (window as any).__result !== undefined, null, { timeout: 15000 });
          const result = await tab.evaluate(() => (window as any).__result);
          if (variant === "treeshake") ok = result === true;
          else {
            for (const f of result.failures) problems.push(`${name} ${variant}: ${f}`);
            if (result.fingerprint.hash !== expected.hash)
              problems.push(`${name} ${variant}: behaves differently from Node (fingerprint ${result.fingerprint.hash}, Node ${expected.hash})`);
            ok = !result.failures.length && result.fingerprint.hash === expected.hash;
          }
        } catch (e) {
          problems.push(`${name} ${variant}: ${(e as Error).message.split("\n")[0]}`);
        }
        for (const e of errors) problems.push(`${name} ${variant}: ${e}`);
        if (errors.length) ok = false;
        line.push(`${variant} ${ok ? "ok" : "FAIL"}`);
        await tab.close();
      }
      rows.push(line.join("  "));
    } finally {
      await browser.close();
    }
  }
} finally {
  server.close();
}

console.log(`\nexpected fingerprint ${expected.hash} over ${expected.inputs} results, from Node ${process.version}`);
for (const r of rows) console.log(r);
if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log("\nall browsers and bundles agree with Node");
