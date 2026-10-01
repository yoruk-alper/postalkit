// Consumer smoke test, ES modules. Same checks as smoke.cjs, through the "import" conditions.
import assert from "assert";
import { format, getCountries, getCountryInfo, guessCountry, isValid, parse } from "postalkit";
import { findRegions, isInRegion } from "postalkit/regions";

assert.strictEqual(format("ca", "k1a0t6"), "K1A 0T6");
assert.strictEqual(format("JP", "１００－０００１"), "100-0001");
assert.strictEqual(isValid("AE", ""), true);
assert.deepStrictEqual(parse("DE", "1O115"), { valid: false, error: "invalid-chars", country: "DE" });
assert.deepStrictEqual(guessCountry("K1A 0T6"), ["CA"]);
assert.strictEqual(getCountries().length, 252);
assert.strictEqual(getCountryInfo("US").label, "ZIP code");

assert.deepStrictEqual(findRegions("US", "90210"), [{ code: "CA", name: "California" }]);
assert.strictEqual(isInRegion("US", "10001", "US-NY"), true);

console.log("smoke.mjs ok on Node " + process.version);
