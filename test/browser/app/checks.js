// Runs in every browser and bundle under test, and in Node for the expected fingerprint.
// Plain JavaScript with no dependencies, so every bundler and browser takes it as is.

/** Spot checks with known answers. Returns a list of failures (empty when all pass). */
export function run({ core, regions, partial, messages }) {
  const failures = [];
  const eq = (name, got, want) => {
    const g = JSON.stringify(got);
    const w = JSON.stringify(want);
    if (g !== w) failures.push(`${name}: got ${g}, want ${w}`);
  };
  eq("format", core.format("ca", "k1a0t6"), "K1A 0T6");
  eq("full-width input", core.format("JP", "１００－０００１"), "100-0001");
  eq("non-breaking space", core.format("CA", "K1A 0T6"), "K1A 0T6");
  eq("en dash", core.format("US", "90210–1234"), "90210-1234");
  eq("native digits", ["۱۱۹۳۶۱۲۳۴۵", "١٢٣٤٥", "११००३४", "๑๐๑๐๐"].map((x, i) => core.format(["IR", "SA", "IN", "TH"][i], x)), ["11936-12345", "12345", "110034", "10100"]);
  eq("optional empty", core.isValid("AR", ""), true);
  eq("parseTyped", partial.parseTyped("GB", "QQ1").error, "invalid-format");
  eq("country prefix", core.format("SE", "SE - 114 55"), "114 55");
  eq("fixed prefix restored", core.format("LV", "1050"), "LV-1050");
  eq("no postal codes", core.isValid("AE", ""), true);
  eq("reason", core.parse("DE", "1O115"), { valid: false, error: "invalid-chars", country: "DE" });
  eq("guessCountry", core.guessCountry("K1A 0T6"), ["CA"]);
  eq("getCountries", core.getCountries().length, 252);
  eq("getCountryName", core.getCountryName("DE", "de"), "Deutschland");
  eq("inputMaxLength", core.getCountryInfo("SE").inputMaxLength, 11);
  eq("findRegions", regions.findRegions("US", "90210"), [{ code: "CA", name: "California" }]);
  eq("checkPartial", ["SW1", "SW1A 1AA", "QQ1"].map((x) => partial.checkPartial("GB", x)), ["partial", "complete", "invalid"]);
  eq("getErrorMessage", messages.getErrorMessage(core.parse("US", "9021")), "This ZIP code is too short (e.g. 95014).");
  eq("digits-only message", messages.getErrorMessage(core.parse("US", "9021O")), "This ZIP code can only contain digits (e.g. 95014).");
  let threw = false;
  try {
    for (const x of [null, undefined, {}, [], 1.5, Symbol("x"), "__proto__"]) {
      core.parse(x, x);
      partial.checkPartial(x, x);
      regions.findRegions(x, x);
      messages.getErrorMessage(x);
    }
  } catch (e) {
    threw = String(e);
  }
  eq("never throws", threw, false);
  return failures;
}

/**
 * A hash of how every country handles a set of inputs (parse, checkPartial, findRegions,
 * getCountryInfo, guessCountry). Must be identical in every engine; differences point at
 * regex or Unicode behavior that varies between JavaScript engines.
 */
export function fingerprint({ core, regions, partial }) {
  const out = [];
  const fullWidth = (s) => s.replace(/[!-~]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0xfee0));
  for (const c of core.getCountries()) {
    const info = core.getCountryInfo(c);
    const ex = info.example;
    const persian = (s) => s.replace(/\d/g, (d) => String.fromCharCode(0x6f0 + +d));
    const inputs = ["", ex, ex.toLowerCase(), ex.replace(/[ -]/g, ""), `${c}-${ex}`, fullWidth(ex), persian(ex), ex.slice(0, 2), ex + "9", ex.replace(/\d/, "O")];
    out.push(JSON.stringify(info), JSON.stringify(core.guessCountry(ex)));
    for (const x of inputs) out.push(JSON.stringify([core.parse(c, x), partial.parseTyped(c, x), partial.checkPartial(c, x), regions.findRegions(c, x)]));
  }
  // FNV-1a, 32-bit
  let h = 0x811c9dc5;
  const s = out.join("\n");
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return { hash: (h >>> 0).toString(16), inputs: out.length };
}
