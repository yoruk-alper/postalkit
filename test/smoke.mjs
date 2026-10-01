// Consumer smoke test, ES modules. Same checks as smoke.cjs, through the "import" conditions.
import assert from "assert";
import { format, getCountries, getCountryInfo, guessCountry, isValid, parse } from "postalkit";
import { findRegions, isInRegion } from "postalkit/regions";
import { checkPartial } from "postalkit/partial";
import { getErrorMessage } from "postalkit/messages";

assert.strictEqual(format("ca", "k1a0t6"), "K1A 0T6");
assert.strictEqual(format("JP", "１００－０００１"), "100-0001");
assert.strictEqual(isValid("AE", ""), true);
assert.deepStrictEqual(parse("DE", "1O115"), { valid: false, error: "invalid-chars", country: "DE" });
assert.deepStrictEqual(guessCountry("K1A 0T6"), ["CA"]);
assert.strictEqual(getCountries().length, 252);
assert.strictEqual(getCountryInfo("US").label, "ZIP code");

assert.deepStrictEqual(findRegions("US", "90210"), [{ code: "CA", name: "California" }]);
assert.strictEqual(isInRegion("US", "10001", "US-NY"), true);

assert.strictEqual(checkPartial("GB", "SW1"), "partial");
assert.strictEqual(checkPartial("DE", "1O1"), "invalid");
assert.strictEqual(getErrorMessage(parse("US", "9021")), "This ZIP code is too short (e.g. 95014).");
assert.strictEqual(getCountryInfo("SE").inputMaxLength, 9);

console.log("smoke.mjs ok on Node " + process.version);
