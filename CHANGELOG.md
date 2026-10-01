# Changelog

All notable changes to postalkit. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project follows [semantic versioning](https://semver.org/) as described under "Versioning" in the README. Data changes are listed separately because they change which codes are accepted.

## [0.2.0] - 2026-10-01

First public release.

### Validation and formatting

- `parse`, `isValid`, `format` for 252 countries and territories, with a reason for every rejection (`empty`, `unknown-country`, `not-applicable`, `invalid-chars`, `too-short`, `too-long`, `invalid-format`). Never throws.
- Forgiving input: case, spacing and separators, full-width characters, digits in any script (Arabic-Indic, Persian, Devanagari, Bengali, Thai, ...), typed country prefixes (`"SE-114 55"`, `"SWE-114 55"`, `"D-10115"`), omitted fixed prefixes (`"1050"` in Latvia), invisible characters copied from web pages (zero-width spaces, soft hyphens), and numbers from spreadsheets, with the leading zeros they dropped restored (`2134` is `02134` in the US).
- An empty field is valid for the 70 countries without postal codes and the 108 where addresses don't require one.
- Countries as alpha-2 or alpha-3 codes, in any case, plus `UK` and `EL`.
- `getCountryInfo` (label, example, `inputmode`, `inputMaxLength`), `getCountries`, `getCountryName`.

### Optional entry points

- `postalkit/regions`: the state or province of a postal code, for the 23 countries where Google publishes postal prefixes.
- `postalkit/partial`: `checkPartial` for input that is still being typed, and `parseTyped`, which reports `too-short` only when more characters can help.
- `postalkit/messages`: English error messages that use the country's own word for the code, with replaceable wording and labels for translation.

### Data

- From Google's libaddressinput, with documented corrections in `scripts/overrides.ts`.
- **Argentina** accepts the 4-digit postal code people use (`1425`) as well as the 8-character CPA (`C1425CJD`), which is the only form Google's pattern allows.

### Quality

- Fuzz-tested against Google's patterns, and tested against 22,484 real postal codes from 121 countries (GeoNames), including region lookup for the US, Canada, Japan, India and Australia.
- Property tests for the documented invariants on all 252 countries.
- CI installs the packed package on Node 14 through 24, and runs it in Chromium, Firefox and WebKit as native ES modules and through Vite and webpack.
- Package shape checked by publint and are-the-types-wrong; size budgets per entry point.
