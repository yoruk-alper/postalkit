import { test } from "node:test";
import assert from "node:assert/strict";
import { getCountries, getCountryInfo, parse, type ParseError, type ParseResult } from "../src/index.ts";
import { getErrorMessage, MESSAGES, type MessageKey } from "../src/messages.ts";
import { parseTyped } from "../src/partial.ts";

const KEYS: MessageKey[] = ["empty", "unknown-country", "not-applicable", "invalid-chars", "invalid-chars-digits", "too-short", "too-long", "invalid-format"];

test("every error has a message", () => {
  assert.deepEqual(Object.keys(MESSAGES).sort(), [...KEYS].sort());
  for (const k of KEYS) assert.ok(MESSAGES[k].endsWith("."), k);
});

test("fills in the country's label and an example", () => {
  assert.equal(getErrorMessage(parse("US", "9021")), "This ZIP code is too short (e.g. 95014).");
  assert.equal(getErrorMessage(parse("GB", "")), "Enter your postcode.");
  assert.equal(getErrorMessage(parse("IE", "AAAAAAA")), "This isn't a valid Eircode (e.g. A65 F4E2).");
  assert.equal(getErrorMessage(parse("IN", "1100011")), "This PIN code is too long (e.g. 110034).");
  assert.equal(getErrorMessage(parse("AE", "12345")), "This country doesn't use postal codes. Leave this field empty.");
  assert.equal(getErrorMessage(parse("XX", "12345")), "Choose a country first.");
});

test("says 'digits only' where codes are digits only", () => {
  assert.equal(getErrorMessage(parse("US", "9021O")), "This ZIP code can only contain digits (e.g. 95014).");
  assert.equal(getErrorMessage(parse("DE", "1O115")), "This postal code can only contain digits (e.g. 26133).");
  // Letters belong in these codes, so the generic message.
  assert.equal(getErrorMessage(parse("GB", "SW1A 1A!")), "This postcode contains characters it can't have (e.g. EC1Y 8SY).");
  // Digits after a fixed letter prefix: "only digits" would contradict the example.
  assert.equal(getErrorMessage(parse("LV", "LV-10A0")), "This postal code contains characters it can't have (e.g. LV-1073).");
  for (const c of getCountries()) {
    const info = getCountryInfo(c)!;
    const message = getErrorMessage({ valid: false, error: "invalid-chars", country: c });
    if (message?.includes("only contain digits")) assert.ok(info.numeric && /^[\d -]+$/.test(info.example), c);
  }
});

test("explains an impossible start as invalid, not short, through parseTyped", () => {
  assert.equal(getErrorMessage(parseTyped("GB", "QQ1")), "This isn't a valid postcode (e.g. EC1Y 8SY).");
  assert.equal(getErrorMessage(parseTyped("GB", "SW1A")), "This postcode is too short (e.g. EC1Y 8SY).");
});

test("no message for an empty field where the code is optional", () => {
  assert.equal(getErrorMessage(parse("AR", "")), null);
  assert.equal(getErrorMessage(parse("US", "")), "Enter your ZIP code.");
});

test("null for valid codes", () => {
  assert.equal(getErrorMessage(parse("US", "90210")), null);
  assert.equal(getErrorMessage(parse("AE", "")), null);
});

test("custom wording and labels, with the same placeholders", () => {
  const de = { "too-short": "Die {label} ist zu kurz (z. B. {example}).", "invalid-chars": "Die {label} enthält ungültige Zeichen." };
  const labels = { "postal code": "Postleitzahl" } as const;
  assert.equal(getErrorMessage(parse("DE", "1011"), de, labels), "Die Postleitzahl ist zu kurz (z. B. 26133).");
  assert.equal(getErrorMessage(parse("DE", "1011"), de), "Die postal code ist zu kurz (z. B. 26133).", "labels are optional");
  assert.equal(getErrorMessage(parse("DE", ""), de, labels), "Enter your Postleitzahl.", "falls back to English wording");
  // A translated invalid-chars wins over the English digits-only message.
  assert.equal(getErrorMessage(parse("DE", "1O115"), de, labels), "Die Postleitzahl enthält ungültige Zeichen.");
  assert.equal(
    getErrorMessage(parse("DE", "1O115"), { ...de, "invalid-chars-digits": "Nur Ziffern: {example}." }),
    "Nur Ziffern: 26133.",
  );
});

test("never throws", () => {
  for (const junk of [null, undefined, {}, { valid: false }, { valid: false, error: "nope" }, "x", 1]) {
    assert.doesNotThrow(() => getErrorMessage(junk as unknown as ParseResult));
    assert.doesNotThrow(() => getErrorMessage(junk as unknown as ParseResult, junk as never, junk as never));
  }
  assert.equal(getErrorMessage({ valid: false, error: "nope" as ParseError, country: null }), null);
});
