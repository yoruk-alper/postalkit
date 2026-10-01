import { test } from "node:test";
import assert from "node:assert/strict";
import { parse, type ParseError, type ParseResult } from "../src/index.ts";
import { getErrorMessage, MESSAGES } from "../src/messages.ts";

const ERRORS: ParseError[] = ["empty", "unknown-country", "not-applicable", "invalid-chars", "too-short", "too-long", "invalid-format"];

test("every error has a message", () => {
  assert.deepEqual(Object.keys(MESSAGES).sort(), [...ERRORS].sort());
  for (const e of ERRORS) assert.ok(MESSAGES[e].endsWith("."), e);
});

test("fills in the country's label and an example", () => {
  assert.equal(getErrorMessage(parse("US", "9021")), "This ZIP code is too short (e.g. 95014).");
  assert.equal(getErrorMessage(parse("GB", "")), "Enter your postcode.");
  assert.equal(getErrorMessage(parse("IE", "AAAAAAA")), "This isn't a valid Eircode (e.g. A65 F4E2).");
  assert.equal(getErrorMessage(parse("IN", "1100011")), "This PIN code is too long (e.g. 110034).");
  assert.equal(getErrorMessage(parse("DE", "1O115")), "This postal code contains characters it can't have (e.g. 26133).");
  assert.equal(getErrorMessage(parse("AE", "12345")), "This country doesn't use postal codes. Leave this field empty.");
  assert.equal(getErrorMessage(parse("XX", "12345")), "Choose a country first.");
});

test("null for valid codes", () => {
  assert.equal(getErrorMessage(parse("US", "90210")), null);
  assert.equal(getErrorMessage(parse("AE", "")), null);
});

test("custom wording, with the same placeholders", () => {
  const de = { "too-short": "Diese {label} ist zu kurz (z. B. {example})." };
  assert.equal(getErrorMessage(parse("DE", "1011"), de), "Diese postal code ist zu kurz (z. B. 26133).");
  assert.equal(getErrorMessage(parse("DE", ""), de), "Enter your postal code.", "falls back to English");
});

test("never throws", () => {
  for (const junk of [null, undefined, {}, { valid: false }, { valid: false, error: "nope" }, "x", 1]) {
    assert.doesNotThrow(() => getErrorMessage(junk as unknown as ParseResult));
  }
  assert.equal(getErrorMessage({ valid: false, error: "nope" } as unknown as ParseResult), null);
});
