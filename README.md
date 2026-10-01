# postalkit

Validate, format and guess postal codes for **252 countries**. Accepts what people actually type, returns one canonical form to store, and tells you *why* a code was rejected.

- **Zero dependencies. 4.1 kB gzipped** for the whole API (3.5 kB if you only use `isValid`).
- **Forgiving input, canonical output.** `"k1a-0t6"`, `"K1A0T6"` and `" k1a  0t6 "` all become `K1A 0T6`.
- **Never throws.** `null`, numbers from spreadsheets, objects: you always get a result.
- **Correct about countries without postal codes.** An empty field is valid for the UAE, Hong Kong and 68 others.
- **Built for forms:** field label, placeholder, `inputmode` and `maxLength` per country.
- Data from Google's libaddressinput (the dataset behind Chrome and Android address forms). Every pattern is fuzz-tested against Google's own.

```bash
npm install postalkit
```

```ts
import { parse, parseMany, isValid, format, guessCountry, getCountryInfo } from "postalkit";

format("CA", "k1a0t6");          // "K1A 0T6"
format("US", "902101234");       // "90210-1234"
format("JP", "１００－０００１");    // "100-0001"   full-width input from a Japanese keyboard
format("SE", "SE-114 55");       // "114 55"     country prefix removed
format("LV", "1050");            // "LV-1050"    required prefix restored

isValid("GB", "SW1A 1AA");       // true
isValid("AE", "");               // true         the UAE has no postal codes

parse("DE", "1O115");            // { valid: false, error: "invalid-chars", country: "DE" }
parse("GB", "SW1A");             // { valid: false, error: "too-short", country: "GB" }
parseMany("US", csvColumn);      // one result per row, same order

guessCountry("K1A 0T6");         // ["CA"]
guessCountry("12345");           // ["US", "DE", "FR", "IT", "ES", ...]  most likely first

getCountryInfo("US");
// { code: "US", alpha3: "USA", hasPostalCode: true, required: true, label: "ZIP code",
//   example: "95014", numeric: true, maxLength: 10 }
```

## Compared with postal-code-checker

Measured by `npm run size`, `npm run compare` and `npm run bench` in this repo (Node 22).

|                                                    | postal-code-checker 2.3.0 | postalkit |
| -------------------------------------------------- | ------------------------: | --------: |
| Bundle, whole API (min + gzip)                     |                   21.0 kB |  **4.1 kB** |
| Bundle, validation only (min + gzip)               |                    7.7 kB |  **3.5 kB** |
| Install size (unpacked)                            |                    288 kB |   **91 kB** |
| Real-world inputs accepted/rejected correctly      |                     10/22 |   **22/22** |
| Real-world inputs returned in canonical form       |                      2/22 |   **22/22** |
| Validate a UK postcode (ops/sec)                   |                      0.9M |  **7.2M** |
| Validate a US ZIP (ops/sec)                        |                      4.3M |  **12.2M** |
| Reject an invalid code (ops/sec)                   |                      5.4M |   **7.5M** |
| Countries                                          |                       249 | **252** (adds Kosovo, Ascension, Tristan da Cunha) |
| Says why a code is invalid                         |                        no |   **yes** |
| State/province from a postal code (23 countries)   |       yes, always bundled |   **yes, opt-in** (`postalkit/regions`) |
| Core + regions (min + gzip)                        |                   21.0 kB |  **14.2 kB** |
| `validate(country, null)`                          |                    throws |   **returns a result** |

## API

All functions accept the country as alpha-2 (`"US"`) or alpha-3 (`"USA"`), in any case. `"UK"` and `"EL"` are accepted for GB and GR.

### `parse(country, code): ParseResult`

```ts
type ParseResult =
  | { valid: true; value: string; country: CountryCode }
  | { valid: false; error: ParseError; country: CountryCode | null };
```

| `error`           | Meaning                                                           |
| ----------------- | ----------------------------------------------------------------- |
| `empty`           | Nothing entered, and the country uses postal codes                |
| `unknown-country` | The country isn't recognised                                      |
| `not-applicable`  | Something was entered, but the country has no postal codes        |
| `invalid-chars`   | A character that can't appear here (letter in a digits-only code) |
| `too-short`       | Too short for any code in this country                            |
| `too-long`        | Too long for any code in this country                             |
| `invalid-format`  | Right length and characters, but not a code this country issues   |

### `parseMany(country, codes): ParseResult[]`

`parse` for a whole column (a CSV import, a bulk upload): one result per input, in the same order, each with the canonical value or the reason it failed. A bad cell never stops the batch.

```ts
const results = parseMany("US", rows.map((r) => r.zip));
const bad = rows.filter((_, i) => !results[i].valid);
```

### `isValid(country, code): boolean`

`parse(...).valid`, without building the result object. An empty value is valid for countries without postal codes.

### `format(country, code): string | null`

The canonical form to store and display, or `null` if invalid. Idempotent: `format(c, format(c, x)) === format(c, x)`.

### `guessCountry(code): CountryCode[]`

Every country whose format accepts the code, most likely first. Ranking combines how specific each country's format is with how common the country is. A country prefix in the input (`"SE-114 55"`) puts that country first.

### `getCountryInfo(country): CountryInfo | null`

```ts
interface CountryInfo {
  code: CountryCode;
  alpha3: string;
  hasPostalCode: boolean; // false: hide the field
  required: boolean;      // whether addresses there need one
  label: "postal code" | "ZIP code" | "PIN code" | "Eircode" | "postcode";
  example: string;        // canonical, for a placeholder
  numeric: boolean;       // digits only: inputmode="numeric" is safe
  maxLength: number;      // longest canonical code
}
```

`numeric` already accounts for separators and fixed prefixes, which are added for you. A phone keypad without a hyphen still works for US ZIP+4 (`902101234` becomes `90210-1234`) and Latvia (`1050` becomes `LV-1050`).

### `getCountries(): CountryCode[]`

All 252 codes, alphabetically.

### `getCountryName(country, locale = "en"): string`

The localized name from the runtime's built-in `Intl.DisplayNames`, so no names are bundled. `getCountryName("DE", "tr")` returns `"Almanya"`. Falls back to the code where `Intl` is unavailable.

## Regions: `postalkit/regions`

Which state or province a postal code belongs to, offline. Use it to fill in the state field from a ZIP code. It's a separate import, so apps that don't need it pay nothing: it adds 10 kB gzipped on top of the core.

```ts
import { findRegions, getRegions, hasRegionData, isInRegion } from "postalkit/regions";

findRegions("US", "90210");        // [{ code: "CA", name: "California" }]
findRegions("CA", "K1A 0T6");      // [{ code: "ON", name: "Ontario" }, { code: "QC", name: "Quebec" }]
findRegions("JP", "100-0001");     // [{ code: "13", name: "Tokyo" }]
findRegions("US", "00000");        // []  valid format, but no state owns it
isInRegion("US", "90210", "CA");   // true; also accepts "US-CA" or "California"
getRegions("BR");                  // all 27 states, for a picker
hasRegionData("DE");               // false
```

- **Coverage:** the 23 countries where Google publishes postal prefixes per region: Andorra, Argentina, Armenia, Australia, Brazil, Canada, El Salvador, India, Italy, Japan, Malaysia, Mexico, Nicaragua, Philippines, Russia, South Korea, Spain, Taiwan, Thailand, Turkey, Ukraine, United States and Uruguay. Not the UK, Germany, France or China.
- **Always a list:** some prefixes belong to more than one region.
- **`code`** is the ISO 3166-2 code without the country prefix (`"CA"` for US-CA), or `null` where there isn't one (US military "Armed Forces" regions, Spain's provinces).
- **`name`** is in English or the Latin alphabet ("Hokkaido", not 北海道).
- **The code is validated first,** so an invalid postal code never returns a guess.

## What "forgiving" means exactly

Before matching, input is uppercased and converted with Unicode NFKC normalization (full-width characters become ASCII). Then spaces, dots, hyphens, en/em dashes, minus signs, `ー` and `〒` are removed. The result is matched against a separator-free pattern, and the canonical separator is put back. Then:

- A country prefix is removed if the code only matches without it: the country's own code (`SE-`, `NL-`), Google's documented prefixes (`FL-` for Liechtenstein, `L-` for Luxembourg), and old European vehicle codes still common in address data (`D-`, `F-`, `A-`, `I-`, ...).
- A fixed prefix is restored if it was left out, for countries whose codes are a fixed prefix plus digits: Latvia, Cayman Islands, Barbados, Andorra, Anguilla, Saint Vincent, British Virgin Islands.

Misplaced separators are accepted (`9021-01234` reads as `90210-1234`). People make that mistake far more often than they mean a different code, and the canonical output shows the user what was understood.

## Using it in a form

```ts
const info = getCountryInfo(country);
if (!info?.hasPostalCode) hideField();
else {
  input.placeholder = info.example;
  input.inputMode = info.numeric ? "numeric" : "text";
  label.textContent = info.label;
  label.toggleAttribute("data-optional", !info.required);
}

input.addEventListener("blur", () => {
  const r = parse(country, input.value);
  if (r.valid) input.value = r.value; // show the user the canonical form
  else showError(MESSAGES[r.error]);
});
```

## Data

Patterns come from Google's [libaddressinput](https://github.com/google/libaddressinput) data (CC-BY 4.0, see [NOTICE](./NOTICE)). The build (`scripts/build-data.ts`):

1. removes separators from each pattern and derives the canonical separator position from Google's examples;
2. applies documented corrections ([`scripts/overrides.ts`](./scripts/overrides.ts)), each with a reason. The build fails if one stops applying. Some make patterns stricter than Google's where Google's are too loose (Irish Eircodes accept only the letters Eircodes really use);
3. optimizes every pattern (the UK area list becomes a prefix tree) and fuzz-tests it against the original;
4. checks that every canonical form it produces still satisfies Google's original pattern.

CI checks Google's data weekly and fails when it changes.

## Development

```bash
npm run check     # regenerate data, typecheck, build, test, size budget
npm run compare   # head-to-head with postal-code-checker
npm run bench     # throughput, after a build
npm run fetch     # refresh data/upstream.json from Google
```

## License

MIT. Postal data CC-BY 4.0 (Google), see [NOTICE](./NOTICE).
