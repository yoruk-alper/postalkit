// Consumer smoke test, CommonJS. Runs on every supported Node (>=14) against the
// installed package, so it uses plain JavaScript and node:assert only.
// CI installs the packed tarball into a fresh project and runs this file there.
"use strict";
const assert = require("assert");
const core = require("postalkit");
const regions = require("postalkit/regions");
const partial = require("postalkit/partial");
const messages = require("postalkit/messages");

assert.strictEqual(core.format("ca", "k1a0t6"), "K1A 0T6");
assert.strictEqual(core.format("JP", "１００－０００１"), "100-0001");
assert.strictEqual(core.isValid("AE", ""), true);
assert.deepStrictEqual(core.parse("DE", "1O115"), { valid: false, error: "invalid-chars", country: "DE" });
assert.deepStrictEqual(core.guessCountry("K1A 0T6"), ["CA"]);
assert.strictEqual(core.getCountries().length, 252);
assert.strictEqual(core.getCountryInfo("US").label, "ZIP code");
assert.strictEqual(typeof core.getCountryName("DE"), "string");

assert.deepStrictEqual(regions.findRegions("US", "90210"), [{ code: "CA", name: "California" }]);
assert.strictEqual(regions.isInRegion("US", "10001", "US-NY"), true);

assert.strictEqual(partial.checkPartial("GB", "SW1"), "partial");
assert.strictEqual(partial.checkPartial("DE", "1O1"), "invalid");
assert.strictEqual(partial.parseTyped("GB", "QQ1").error, "invalid-format");
assert.strictEqual(core.format("IR", "۱۱۹۳۶۱۲۳۴۵"), "11936-12345");
assert.strictEqual(core.isValid("AR", ""), true);
assert.strictEqual(messages.getErrorMessage(core.parse("US", "9021")), "This ZIP code is too short (e.g. 95014).");
assert.strictEqual(core.getCountryInfo("SE").inputMaxLength, 12);

console.log("smoke.cjs ok on Node " + process.version);
