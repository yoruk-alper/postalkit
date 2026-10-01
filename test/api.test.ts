import { test } from "node:test";
import assert from "node:assert/strict";
import { format, getCountries, getCountryInfo, getCountryName, guessCountry, isValid, parse, parseMany } from "../src/index.ts";

test("formats to one canonical form", () => {
  const cases: [string, string, string][] = [
    ["CA", "k1a0t6", "K1A 0T6"],
    ["CA", "K1A-0T6", "K1A 0T6"],
    ["GB", "sw1a1aa", "SW1A 1AA"],
    ["GB", "SW1A   1AA", "SW1A 1AA"],
    ["GB", "m25bq", "M2 5BQ"],
    ["GB", "gir0aa", "GIR 0AA"],
    ["GB", "BFPO61", "BFPO 61"],
    ["GG", "GY101AA", "GY10 1AA"],
    ["US", "90210", "90210"],
    ["US", "902101234", "90210-1234"],
    ["US", "90210 1234", "90210-1234"],
    ["PR", "009301234", "00930-1234"],
    ["NL", "1234ab", "1234 AB"],
    ["JP", "1000001", "100-0001"],
    ["BR", "01310100", "01310-100"],
    ["PL", "00950", "00-950"],
    ["PT", "1000001", "1000-001"],
    ["SE", "11455", "114 55"],
    ["CZ", "11000", "110 00"],
    ["IE", "d02x285", "D02 X285"],
    ["LV", "lv1050", "LV-1050"],
    ["KY", "ky11100", "KY1-1100"],
    ["MT", "vlt1117", "VLT 1117"],
    ["IR", "1193612345", "11936-12345"],
    ["DE", " 10115 ", "10115"],
  ];
  for (const [c, input, out] of cases) assert.equal(format(c, input), out, `${c} ${input}`);
});

test("forgives how people and keyboards actually type", () => {
  const cases: [string, string, string][] = [
    ["JP", "１００－０００１", "100-0001"], // full-width digits and hyphen
    ["JP", "〒100ー0001", "100-0001"], // postal mark and katakana long-vowel "dash"
    ["US", "90210–1234", "90210-1234"], // en dash (autocorrect)
    ["US", "90210—1234", "90210-1234"], // em dash
    ["US", "90210−1234", "90210-1234"], // minus sign
    ["BR", "01.310-100", "01310-100"], // dotted CEP
    ["CA", "k1a\t0t6", "K1A 0T6"],
    ["CA", `K1A${String.fromCharCode(0xa0)}0T6`, "K1A 0T6"], // non-breaking space from copy-paste
    ["US", "902\u200b10", "90210"], // zero-width space from a web page
    ["US", "\ufeff90210\u00ad1234", "90210-1234"], // byte order mark, soft hyphen
    ["SE", "SE-114 55", "114 55"], // country prefix
    ["SE", "SWE-114 55", "114 55"], // alpha-3 country prefix
    ["US", "USA 90210", "90210"],
    ["SE", "S-114 55", "114 55"], // old vehicle code
    ["DE", "D-10115", "10115"],
    ["FR", "F-75001", "75001"],
    ["CH", "CH-8001", "8001"],
    ["LU", "L-1009", "1009"],
    ["LI", "FL-9490", "9490"],
    ["OM", "PC 133", "133"],
    ["NL", "NL-1234 AB", "1234 AB"],
    ["LV", "1050", "LV-1050"], // fixed prefix restored
    ["KY", "11100", "KY1-1100"],
    ["AI", "2640", "AI-2640"],
    ["AD", "100", "AD100"],
    ["BB", "11000", "BB11000"],
    ["IR", "۱۱۹۳۶۱۲۳۴۵", "11936-12345"], // Persian digits
    ["SA", "١٢٣٤٥", "12345"], // Arabic-Indic digits
    ["EG", "١٢٣٤٥", "12345"],
    ["IN", "११००३४", "110034"], // Devanagari
    ["BD", "১২০৩", "1203"], // Bengali
    ["TH", "๑๐๑๐๐", "10100"], // Thai
    ["SA", "٩0٢1٠", "90210"], // mixed scripts
    ["US", "𝟗𝟎𝟐𝟏𝟎", "90210"], // mathematical bold, folded by NFKC
  ];
  for (const [c, input, out] of cases) assert.equal(format(c, input), out, `${c} ${JSON.stringify(input)}`);
});

test("explains every rejection", () => {
  const cases: [string, unknown, string][] = [
    ["US", "", "empty"],
    ["US", "   ", "empty"],
    ["US", null, "empty"],
    ["US", undefined, "empty"],
    ["XX", "12345", "unknown-country"],
    ["", "12345", "unknown-country"],
    ["AE", "00000", "not-applicable"],
    ["DE", "1011", "too-short"],
    ["DE", "101155", "too-long"],
    ["DE", "1O115", "invalid-chars"], // letter O typed for zero
    ["DE", "10115!", "invalid-chars"],
    ["SE", "SE-1145", "too-short"], // prefix stripped before judging
    ["LV", "LV-10A0", "invalid-chars"],
    ["GB", "SW1A", "too-short"],
    ["GB", "QQ1 1AA", "invalid-format"], // no such postcode area
    ["CA", "D1A 0T6", "invalid-format"], // D is never a first letter
    ["NL", "0123 AB", "invalid-format"],
  ];
  for (const [c, input, error] of cases) {
    const r = parse(c, input);
    assert.equal(r.valid, false, `${c} ${String(input)}`);
    if (!r.valid) assert.equal(r.error, error, `${c} ${String(input)}`);
  }
});

test("an empty field is valid exactly where no code is required", () => {
  assert.deepEqual(parse("AR", ""), { valid: true, value: "", country: "AR" }); // optional in Argentina
  assert.equal(format("BG", null), "");
  assert.equal(parse("US", "").valid, false);
  for (const c of getCountries()) {
    const info = getCountryInfo(c)!;
    assert.equal(parse(c, "").valid, !info.hasPostalCode || !info.required, c);
  }
});

test("countries without postal codes accept an empty field", () => {
  assert.deepEqual(parse("AE", ""), { valid: true, value: "", country: "AE" });
  assert.equal(isValid("HK", null), true);
  assert.equal(format("AE", ""), "");
  assert.equal(isValid("AE", "12345"), false);
  assert.equal(getCountryInfo("AE")!.hasPostalCode, false);
});

test("accepts alpha-2, alpha-3, any case, and common aliases", () => {
  assert.equal(parse("usa", "90210").country, "US");
  assert.equal(parse(" de ", "10115").country, "DE");
  assert.equal(parse("UK", "M1 1AE").country, "GB");
  assert.equal(parse("EL", "151 24").country, "GR");
  assert.equal(parse("XKX", "10000").country, "XK");
  for (const c of getCountries()) {
    const a3 = getCountryInfo(c)!.alpha3;
    assert.match(a3, /^[A-Z]{3}$/);
    assert.equal(getCountryInfo(a3)!.code, c, `${a3} should resolve to ${c}`);
  }
});

test("never throws, whatever it is given", () => {
  const junk: unknown[] = [null, undefined, 0, -1, NaN, Infinity, 1.5, {}, [], [1], () => 1, Symbol("x"), true, "\u0000", "𝟙𝟚𝟛𝟜𝟝", "x".repeat(10000), "constructor", "__proto__", "toString"];
  for (const c of junk.concat("US", "AE", "GB")) {
    for (const v of junk) {
      assert.doesNotThrow(() => parse(c as string, v));
      assert.doesNotThrow(() => guessCountry(v));
      assert.doesNotThrow(() => getCountryInfo(c as string));
      assert.doesNotThrow(() => getCountryName(c as string));
    }
  }
  assert.equal(parse("constructor", "1").valid, false);
  assert.equal(parse("__proto__", "1").valid, false);
});

test("accepts whole numbers, as spreadsheets produce them", () => {
  assert.equal(format("US", 90210), "90210");
  assert.equal(format("DE", 10115), "10115");
  assert.equal(format("US", 9021.5), null); // not "90215"
  assert.deepEqual(parse("US", 9021.5), { valid: false, error: "invalid-chars", country: "US" });
  assert.deepEqual(parse("US", -90210), { valid: false, error: "invalid-chars", country: "US" }); // not "empty"
  assert.deepEqual(parse("US", NaN), { valid: false, error: "empty", country: "US" });
});

test("restores the leading zeros a spreadsheet dropped", () => {
  assert.equal(format("US", 2134), "02134");
  assert.equal(format("US", 21341234), "02134-1234");
  assert.equal(format("IT", 100), "00100");
  assert.equal(format("PL", 950), "00-950");
  assert.equal(format("DE", 1067), "01067");
  assert.equal(format("US", "2134"), null); // only numbers lost zeros; a typed string is taken as is
  assert.equal(format("GB", 1234), null); // not a digits-only country
  assert.equal(format("AF", 0), null); // a blank cell, not "0000"
  assert.equal(parse("US", 1234567890).valid, false); // too long to pad
});

test("parses many codes at once, one result per input", () => {
  const results = parseMany("us", ["90210", "", null, "9021", "902101234"]);
  assert.deepEqual(results.map((r) => (r.valid ? r.value : r.error)), ["90210", "empty", "empty", "too-short", "90210-1234"]);
  assert.equal(parseMany("XX", ["1"])[0].valid, false);
  assert.deepEqual(parseMany("US", new Set(["10001"])).map((r) => r.valid), [true]);
  assert.deepEqual(parseMany("US", null as never), []);
  assert.deepEqual(parseMany("US", "90210").map((r) => r.valid), [true]); // one code, not five characters
});

test("Eircodes: real format only", () => {
  assert.equal(format("IE", "d02x285"), "D02 X285");
  assert.equal(format("IE", "D6W1234"), "D6W 1234");
  assert.equal(format("IE", "AAAAAAA"), null); // accepted by Google's loose pattern
  assert.equal(format("IE", "B12 C345"), null); // B never starts a routing key
  assert.equal(format("IE", "A65 F4B2"), null); // B never appears in the identifier
});

test("guesses the country, most likely first", () => {
  assert.deepEqual(guessCountry("K1A 0T6"), ["CA"]);
  assert.deepEqual(guessCountry("12345").slice(0, 3), ["US", "DE", "FR"]);
  assert.equal(guessCountry("SE-114 55")[0], "SE");
  assert.equal(guessCountry("00120")[0], "VA");
  assert.ok(guessCountry("SW1A 1AA").includes("GB"));
  assert.deepEqual(guessCountry(""), []);
  assert.deepEqual(guessCountry("!!!"), []);
});

test("describes a country for forms", () => {
  assert.deepEqual(getCountryInfo("us"), {
    code: "US", alpha3: "USA", hasPostalCode: true, required: true, label: "ZIP code",
    example: "95014", numeric: true, maxLength: 10, inputMaxLength: 16,
  });
  assert.equal(getCountryInfo("IN")!.label, "PIN code");
  assert.equal(getCountryInfo("IE")!.label, "Eircode");
  assert.equal(getCountryInfo("GB")!.label, "postcode");
  assert.equal(getCountryInfo("DE")!.label, "postal code");
  assert.equal(getCountryInfo("GB")!.numeric, false);
  assert.equal(getCountryInfo("LV")!.numeric, true);
  assert.equal(getCountryInfo("XX"), null);
  assert.equal(getCountryInfo("AE")!.inputMaxLength, 0);
});

test("inputMaxLength leaves room for a typed country prefix", () => {
  const cases: [string, string][] = [["SE", "SE-114 55"], ["SE", "SE - 114 55"], ["DE", "D - 10115"], ["DE", "D-10115"], ["LI", "FL-9490"], ["NL", "NL-1234 AB"], ["US", "US-90210-1234"], ["US", "USA - 90210-1234"], ["GB", "GBR SW1A 1AA"]];
  for (const [c, typed] of cases) {
    assert.ok(format(c, typed), `${c} accepts "${typed}"`);
    assert.ok(typed.length <= getCountryInfo(c)!.inputMaxLength, `${c}: "${typed}" > inputMaxLength`);
  }
  for (const c of getCountries()) {
    const info = getCountryInfo(c)!;
    assert.ok(info.inputMaxLength >= info.maxLength, c);
    if (info.hasPostalCode) assert.ok(`${info.alpha3} - ${info.example}`.length <= info.inputMaxLength, c);
  }
});

test("lists countries and names them in any language", () => {
  const all = getCountries();
  assert.equal(all.length, 252);
  assert.deepEqual([...all].sort(), all);
  assert.equal(new Set(all).size, all.length);
  all.pop();
  assert.equal(getCountries().length, 252, "returns a copy");
  assert.equal(getCountryName("DE"), "Germany");
  assert.equal(getCountryName("deu", "de"), "Deutschland");
  assert.equal(getCountryName("XK"), "Kosovo");
  assert.equal(getCountryName("XX"), "");
});

test("territories: codes valid under the territory and the parent's system", () => {
  const cases: [territory: string, parent: string, code: string][] = [
    ["PR", "US", "00901"],
    ["GU", "US", "96910"],
    ["VI", "US", "00802"],
    ["AX", "FI", "22100"],
    ["GP", "FR", "97100"],
    ["RE", "FR", "97400"],
    ["SJ", "NO", "9170"],
  ];
  for (const [territory, parent, code] of cases) {
    assert.equal(format(territory, code), code, `${territory} ${code}`);
    assert.equal(format(parent, code), code, `${parent} ${code}`);
    assert.ok(guessCountry(code).includes(territory as never), `guessCountry("${code}") misses ${territory}`);
  }
  // A territory-specific range or prefix puts the territory first.
  assert.equal(guessCountry("00901")[0], "PR");
  assert.equal(guessCountry("96910")[0], "GU");
  assert.equal(guessCountry("AX-22100")[0], "AX");
  // Guadeloupe, Saint-Martin and Saint-Barthélemy share one pattern: the most populous comes first.
  assert.deepEqual(guessCountry("97100").slice(0, 3), ["GP", "MF", "BL"]);
});
