# postalkit

[![npm](https://img.shields.io/npm/v/postalkit)](https://www.npmjs.com/package/postalkit)
[![CI](https://github.com/yoruk-alper/postalkit/actions/workflows/ci.yml/badge.svg)](https://github.com/yoruk-alper/postalkit/actions/workflows/ci.yml)
[![minzipped size](https://img.shields.io/bundlejs/size/postalkit)](https://bundlejs.com/?q=postalkit)
[![types](https://img.shields.io/npm/types/postalkit)](https://www.npmjs.com/package/postalkit)
[![license](https://img.shields.io/npm/l/postalkit)](./LICENSE)

Validate, format and guess postal codes for **252 countries**. Accepts what people actually type, returns one canonical form to store, and tells you *why* a code was rejected.

- **Zero dependencies. 4.3 kB gzipped** for the whole API (3.7 kB if you only use `isValid`).
- **Forgiving input, canonical output.** `"k1a-0t6"`, `"K1A0T6"` and `" k1a  0t6 "` all become `K1A 0T6`.
- **Never throws.** `null`, numbers from spreadsheets, objects: you always get a result. A ZIP code a spreadsheet stored as `2134` gets its leading zero back: `02134`.
- **Correct about when a code is needed.** An empty field is valid for the 70 countries without postal codes (the UAE, Hong Kong, ...) and the 108 where addresses don't require one (Argentina, Bulgaria, ...).
- **Reads any keyboard.** Full-width, Arabic, Persian, Devanagari, Bengali, Thai and other native digits are understood: `"۱۱۹۳۶۱۲۳۴۵"` is `11936-12345` in Iran.
- **Built for forms:** field label, placeholder, `inputmode` and `maxlength` per country, validation *as you type* (`postalkit/partial`) and ready-made error messages (`postalkit/messages`).
- Data from Google's libaddressinput (the dataset behind Chrome and Android address forms). Every pattern is fuzz-tested against Google's own, and tested against 22,484 real postal codes from 121 countries.

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
//   example: "95014", numeric: true, maxLength: 10, inputMaxLength: 16 }
```

[Try it in the playground](https://yoruk-alper.github.io/postalkit/playground/) · [API reference](https://yoruk-alper.github.io/postalkit/api/)

**Contents:** [Compatibility](#compatibility) · [API](#api) · [Regions](#regions-postalkitregions) · [As you type](#as-you-type-postalkitpartial) · [Error messages](#error-messages-postalkitmessages) · [Territories](#territories) · [Forms](#using-it-in-a-form) · [Recipes](#recipes) · [Data](#data) · [Limitations](#limitations)

## Compatibility

- **Node 14 and later.** CI installs the packed package on Node 14 through 24.
- **Browsers:** current Chrome, Firefox and Safari, which CI tests (Chromium, Firefox and WebKit, unbundled and through Vite and webpack). Older browsers work from Chrome 64, Firefox 78 and Safari 11.1, the first with the Unicode regex features postalkit uses; those versions aren't tested. `getCountryName` returns the code itself where `Intl.DisplayNames` is missing (before Chrome 81, Firefox 86, Safari 14.1).
- **ES modules and CommonJS**, with TypeScript types for both. No build step, polyfills or configuration needed.
- **Tree-shakeable** (`sideEffects: false`): bundlers keep only what you import.

## Compared with postal-code-checker

Measured by `npm run size`, `npm run compare` and `npm run bench` in this repo (Node 24).

|                                                    | postal-code-checker 2.3.0 | postalkit |
| -------------------------------------------------- | ------------------------: | --------: |
| Bundle, whole API (min + gzip)                     |                   21.0 kB |  **4.3 kB** |
| Bundle, validation only (min + gzip)               |                    7.7 kB |  **3.7 kB** |
| Install size (unpacked, all entry points)          |                    288 kB |  **137 kB** |
| Real-world inputs accepted/rejected correctly      |                     10/22 |   **22/22** |
| Real-world inputs returned in canonical form       |                      2/22 |   **22/22** |
| Validate a UK postcode (ops/sec)                   |                      0.9M |  **7.4M** |
| Validate a US ZIP (ops/sec)                        |                      5.4M |  **11.1M** |
| Reject an invalid code (ops/sec)                   |                      6.8M |  **10.9M** |
| Countries                                          |                       249 | **252** (adds Kosovo, Ascension, Tristan da Cunha) |
| Says why a code is invalid                         |                        no |   **yes** |
| State/province from a postal code (23 countries)   |       yes, always bundled |   **yes, opt-in** (`postalkit/regions`) |
| Core + regions (min + gzip)                        |                   21.0 kB |  **14.4 kB** |
| `validate(country, null)`                          |                    throws |   **returns a result** |
| Validation while typing                            |                        no |   **yes, opt-in** (`postalkit/partial`) |
| Tested against real postal codes                   |                        no |   **22,484 codes, 121 countries** |

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
| `empty`           | Nothing entered, and the country requires a postal code           |
| `unknown-country` | The country isn't recognised                                      |
| `not-applicable`  | Something was entered, but the country has no postal codes        |
| `invalid-chars`   | A character that can't appear here (letter in a digits-only code) |
| `too-short`       | Too short for any code in this country                            |
| `too-long`        | Too long for any code in this country                             |
| `invalid-format`  | Right length and characters, but not a code this country issues   |

### `parseMany(country, codes): ParseResult[]`

`parse` for a whole column (a CSV import, a bulk upload): one result per input, in the same order, each with the canonical value or the reason it failed. A bad cell never stops the batch.

Cells that a spreadsheet turned into numbers are handled: in digits-only countries, leading zeros it dropped are restored (`2134` is `02134` in the US, `100` is `00100` in Italy). Only whole numbers can be codes; `9021.5` and `-90210` are `invalid-chars`.

```ts
const results = parseMany("US", rows.map((r) => r.zip));
const bad = rows.filter((_, i) => !results[i].valid);
```

### `isValid(country, code): boolean`

`parse(...).valid`, without building the result object. An empty value is valid where a postal code isn't required (`getCountryInfo(c).required` is false), including countries without postal codes.

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
  inputMaxLength: number; // a safe maxlength for the input, with room for "SWE-" or "D - "
}
```

Use `inputMaxLength`, not `maxLength`, as the input's `maxlength`: people type country prefixes (`"SWE - 114 55"` is 12 characters, the canonical `"114 55"` is 6), and the prefix is removed for you.

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

## As you type: `postalkit/partial`

Whether what has been typed so far is valid, could still become valid, or can't. Use it to stay quiet while someone is typing a good code and speak up as soon as they can't succeed. It adds 2.6 kB gzipped, only if you import it.

```ts
import { checkPartial } from "postalkit/partial";

checkPartial("GB", "SW1");        // "partial"   keep typing
checkPartial("GB", "SW1A 1AA");   // "complete"  same as parse(...).valid
checkPartial("GB", "QQ1");        // "invalid"   no UK postcode starts with QQ
checkPartial("DE", "1O1");        // "invalid"   letter O typed for zero
checkPartial("SE", "SE-11");      // "partial"   country prefixes are understood
checkPartial("US", "90210");      // "complete"  though ZIP+4 could follow
```

`parseTyped` is `parse` with a better reason for a start that can't be completed: `"too-short"` only when more characters can help. Use it in forms, while typing and on blur.

```ts
import { parseTyped } from "postalkit/partial";

parse("GB", "QQ1");               // { valid: false, error: "too-short", ... }       true, but unhelpful
parseTyped("GB", "QQ1");          // { valid: false, error: "invalid-format", ... }  no postcode starts with QQ
parseTyped("GB", "SW1A");         // { valid: false, error: "too-short", ... }       keep typing
```

For each country, the build turns the code pattern into a pattern for its prefixes and checks it against an independent backtracking matcher. The tests check that every prefix of every real postal code in the corpus is `"partial"`.

## Error messages: `postalkit/messages`

English messages that use the country's own word for the code. It adds 0.3 kB gzipped.

```ts
import { getErrorMessage, MESSAGES } from "postalkit/messages";

getErrorMessage(parse("US", "9021"));      // "This ZIP code is too short (e.g. 95014)."
getErrorMessage(parse("US", "9021O"));     // "This ZIP code can only contain digits (e.g. 95014)."
getErrorMessage(parseTyped("GB", "QQ1"));  // "This isn't a valid postcode (e.g. EC1Y 8SY)."
getErrorMessage(parse("GB", ""));          // "Enter your postcode."
getErrorMessage(parse("AE", "12345"));     // "This country doesn't use postal codes. Leave this field empty."
getErrorMessage(parse("US", "90210"));     // null

// Translate: reword some or all messages, and name the code in your language.
// {label} is the country's word for the code, {example} a valid one.
const de = { "too-short": "Die {label} ist zu kurz (z. B. {example}).", "invalid-chars": "Die {label} enthält ungültige Zeichen." };
getErrorMessage(parse("DE", "1011"), de, { "postal code": "Postleitzahl" }); // "Die Postleitzahl ist zu kurz (z. B. 26133)."
```

Every `ParseError` has a message in `MESSAGES`, plus `"invalid-chars-digits"`, used instead of `"invalid-chars"` where codes are digits only. If you translate `"invalid-chars"` but not `"invalid-chars-digits"`, your wording is used for both.

## Territories

Territories with their own ISO 3166 code are countries of their own here, as in Google's data: Puerto Rico, Guam, the US Virgin Islands, Åland, Guadeloupe, Réunion, Svalbard and others. Their codes are also valid under the parent's system, because that is how mail to them is addressed:

```ts
parse("PR", "00901").valid;   // true
parse("US", "00901").valid;   // true
guessCountry("00901");        // ["PR", "US", ...]  the territory first
```

Store the country the user picked rather than one derived from the code.

## What "forgiving" means exactly

Before matching, input is uppercased and converted with Unicode NFKC normalization (full-width characters become ASCII), and digits in any script (Arabic-Indic, Persian, Devanagari, Bengali, Thai, ...) become 0-9. Then spaces, dots, hyphens, en/em dashes, minus signs, `ー` and `〒` are removed. The result is matched against a separator-free pattern, and the canonical separator is put back. Then:

- A country prefix is removed if the code only matches without it: the country's own code (`SE-`, `NL-`), Google's documented prefixes (`FL-` for Liechtenstein, `L-` for Luxembourg), and old European vehicle codes still common in address data (`D-`, `F-`, `A-`, `I-`, ...).
- A fixed prefix is restored if it was left out, for countries whose codes are a fixed prefix plus digits: Latvia, Cayman Islands, Barbados, Andorra, Anguilla, Saint Vincent, British Virgin Islands.

Misplaced separators are accepted (`9021-01234` reads as `90210-1234`). People make that mistake far more often than they mean a different code, and the canonical output shows the user what was understood.

## Using it in a form

```ts
import { getCountryInfo } from "postalkit";
import { checkPartial, parseTyped } from "postalkit/partial";
import { getErrorMessage } from "postalkit/messages";

const info = getCountryInfo(country);
if (!info?.hasPostalCode) hideField();
else {
  input.placeholder = info.example;
  input.inputMode = info.numeric ? "numeric" : "text";
  input.maxLength = info.inputMaxLength;
  input.autocomplete = "postal-code";
  label.textContent = info.label;
  label.toggleAttribute("data-optional", !info.required); // an empty optional field is valid
}

// While typing: speak up only when no more characters can help.
input.addEventListener("input", () => {
  showError(checkPartial(country, input.value) === "invalid" ? getErrorMessage(parseTyped(country, input.value)) : null);
});

// On blur: the full verdict, and the canonical form back in the field.
input.addEventListener("blur", () => {
  const r = parseTyped(country, input.value);
  if (r.valid) input.value = r.value;
  showError(getErrorMessage(r));
});
```

If your carrier needs a postal code even where addresses don't, require `r.value !== ""` yourself.

[The playground](https://yoruk-alper.github.io/postalkit/playground/) is this pattern, working.

## Recipes

### Zod

```ts
import { z } from "zod";
import { parse } from "postalkit";
import { getErrorMessage } from "postalkit/messages";

const Address = z
  .object({ country: z.string(), postalCode: z.string() })
  .transform((address, ctx) => {
    const r = parse(address.country, address.postalCode);
    if (r.valid) return { ...address, postalCode: r.value }; // store the canonical form
    ctx.addIssue({ code: "custom", path: ["postalCode"], message: getErrorMessage(r)! });
    return z.NEVER;
  });

Address.parse({ country: "CA", postalCode: "k1a0t6" }); // { country: "CA", postalCode: "K1A 0T6" }
```

### Valibot

```ts
import * as v from "valibot";
import { format, isValid, parse } from "postalkit";
import { getErrorMessage } from "postalkit/messages";

const Address = v.pipe(
  v.object({ country: v.string(), postalCode: v.string() }),
  v.forward(
    v.check(
      (a) => isValid(a.country, a.postalCode),
      (issue) => getErrorMessage(parse(issue.input.country, issue.input.postalCode))!,
    ),
    ["postalCode"],
  ),
  v.transform((a) => ({ ...a, postalCode: format(a.country, a.postalCode)! })),
);
```

### React

```tsx
import { useState } from "react";
import { getCountryInfo } from "postalkit";
import { checkPartial, parseTyped } from "postalkit/partial";
import { getErrorMessage } from "postalkit/messages";

export function usePostalCode(country: string) {
  const [value, setValue] = useState("");
  const [blurred, setBlurred] = useState(false);
  const info = getCountryInfo(country);
  const r = parseTyped(country, value);
  // While typing, only when no more characters can help; after blur, always.
  const error = blurred || checkPartial(country, value) === "invalid" ? getErrorMessage(r) : null;
  return {
    info,
    error,
    value: r.valid ? r.value : null, // canonical, or null while invalid
    inputProps: {
      value,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => setValue(e.target.value),
      onBlur: () => { setBlurred(true); if (r.valid) setValue(r.value); },
      placeholder: info?.example,
      inputMode: info?.numeric ? ("numeric" as const) : ("text" as const),
      maxLength: info?.inputMaxLength || undefined,
      autoComplete: "postal-code",
    },
  };
}
```

## Data

Patterns come from Google's [libaddressinput](https://github.com/google/libaddressinput) data (CC-BY 4.0, see [NOTICE](./NOTICE)). The build (`scripts/build-data.ts`):

1. removes separators from each pattern and derives the canonical separator position from Google's examples;
2. applies documented corrections ([`scripts/overrides.ts`](./scripts/overrides.ts)), each with a reason. The build fails if one stops applying. Some make patterns stricter than Google's where Google's are too loose (Irish Eircodes accept only the letters Eircodes really use);
3. optimizes every pattern (the UK area list becomes a prefix tree) and fuzz-tests it against the original;
4. checks that every canonical form it produces still satisfies Google's original pattern, unless an override deliberately accepts more (Argentina's 4-digit codes, see below);
5. derives the prefix patterns for `postalkit/partial` and checks them against a backtracking matcher.

CI checks Google's data weekly ([`upstream.yml`](./.github/workflows/upstream.yml)) and fails when it changes.

**Real-world test.** Matching Google's patterns only proves postalkit agrees with Google. [`data/corpus.json`](./data/corpus.json) holds 22,484 real postal codes from 121 countries, sampled from [GeoNames](https://www.geonames.org/) (CC-BY 4.0; test data only, not in the package), and [`test/corpus.test.ts`](./test/corpus.test.ts) requires every one of them to be accepted. The rare exceptions are GeoNames quirks, listed with reasons, and the test fails when one stops applying. This test is why Argentina's 4-digit codes (`1425`) are accepted along with the full CPA (`C1425CJD`): Google's pattern only allows the CPA, but the 4-digit form is what addresses use. The corpus also checks `findRegions` against the state or province GeoNames gives: they agree for at least 99% of codes in the US, Canada, Japan, India and Australia.

## Limitations

- **Format, not existence.** `SW1A 9ZZ` has a valid format, but whether it is anyone's postcode takes an address-verification service.
- **As good as the data.** Patterns follow Google's libaddressinput, plus the corrections in [`scripts/overrides.ts`](./scripts/overrides.ts). Where Google says a country has no postal codes (UAE, Hong Kong, Panama, ...), postalkit does too.
- **Same pattern, same answer.** Guadeloupe, Saint-Martin and Saint-Barthélemy share one format, so `guessCountry("97133")` can't tell that the code is Saint-Barthélemy's and puts the most populous first.
- **Regions** cover 23 countries and work by code prefix, so a code near a border can return two regions.
- **CEDEX.** `"75008 CEDEX"` is rejected (`invalid-chars`): the CEDEX part belongs on the city line (`75008 PARIS CEDEX 08`), the postal code is `75008`.

## Versioning

postalkit follows semver. Data changes are listed in [CHANGELOG.md](./CHANGELOG.md).

- **0.x:** minor versions may change the API or the data; patch versions only fix bugs.
- **From 1.0:** accepting a real code that used to be rejected is a fix (patch). Rejecting strings that were never real codes is a minor version, because someone may depend on the looser behavior. API changes are major.

## Development

Needs Node 22.18 or later (`nvm use` picks up `.nvmrc`): scripts and tests are TypeScript, run directly by Node. The published package works on Node 14 and later, which CI checks by installing the packed tarball on Node 14 through 24. CI also runs it in Chromium, Firefox and WebKit, loaded as native ES modules and bundled by Vite and webpack, and checks that every combination behaves exactly like Node.

```bash
npm run check     # regenerate data, typecheck, build, test, size budgets, publint + attw
npm run compare   # head-to-head with postal-code-checker
npm run bench     # throughput, after a build
npm run fetch     # refresh data/upstream.json from Google, then `npm run data`
npm run corpus    # refresh data/corpus.json from GeoNames (needs `unzip`)
npm run docs      # API reference into docs/ (TypeDoc, run with its own TypeScript 6)
npm run test:browser   # browsers and bundlers; first: npx --prefix test/browser playwright install
```

To see the playground locally, build, serve the repository root (`python3 -m http.server`), and open `/playground/`.

## License

MIT. Postal data CC-BY 4.0 (Google), see [NOTICE](./NOTICE). The test corpus in `data/corpus.json` is CC-BY 4.0 (GeoNames) and is not part of the package.
