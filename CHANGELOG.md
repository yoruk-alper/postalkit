# Changelog

All notable changes to postalkit. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project follows [semantic versioning](https://semver.org/) as described under "Versioning" in the README. Data changes are listed separately because they change which codes are accepted.

## [0.2.0] - Unreleased

### Changed

- **An empty field is valid where addresses don't require a postal code** (108 countries, such as Argentina and Bulgaria), as it already was for the 70 countries without postal codes. `parse(c, "")` returns `empty` only where `getCountryInfo(c).required` is true.

### Added

- `postalkit/partial`: `checkPartial(country, input)` tells whether input is `"complete"`, `"partial"` (could still become valid) or `"invalid"` while the user types. Adds 2.6 kB gzip, only when imported.
- `parseTyped` in `postalkit/partial`: `parse` with `"too-short"` only when more characters can help. `"QQ1"` in the UK is `"invalid-format"`, since no postcode starts with QQ.
- Digits in any script are understood: Arabic-Indic, Persian, Devanagari, Bengali, Thai and others become 0-9 (`"۱۱۹۳۶۱۲۳۴۵"` is `11936-12345` in Iran).
- `postalkit/messages`: `getErrorMessage(result)` gives English error messages using the country's own word for the code ("This ZIP code is too short (e.g. 95014)."), with `MESSAGES` that can be reworded or translated, and labels that can be replaced too. Where codes are digits only, invalid characters get "This ZIP code can only contain digits". Adds 0.3 kB gzip.
- `CountryInfo.inputMaxLength`: a `maxlength` for the input with room for a typed country prefix (`"SE - 114 55"`). `maxLength` stays the canonical length.
- Documentation comments on every exported type, and generated API reference (`npm run docs`).
- `typesVersions`, so `postalkit/regions` and the new entry points resolve in TypeScript projects using `moduleResolution: "node"`.

### Data

- **Argentina** accepts the 4-digit postal code (`1425`), now also its example, as well as the 8-character CPA (`C1425CJD`). Google's pattern only allows the CPA, but the 4-digit form is what addresses use. Found by the new real-world test corpus.
- `guessCountry` ranks Guadeloupe and Saint-Martin before Saint-Barthélemy, which shares their pattern. Before, the order was alphabetical.

### Quality

- Tested against 22,484 real postal codes from 121 countries (GeoNames, `data/corpus.json`), including `findRegions` against the GeoNames state or province for the US, Canada, Japan, India and Australia.
- Property tests for the documented invariants (`parse`, `isValid`, `format` and `parseMany` agree; `format` is idempotent; `guessCountry` finds every canonical code) on all 252 countries.
- CI runs the full check, package linting (publint, are-the-types-wrong), and installs the packed tarball on Node 14, 16, 18, 20, 22 and 24. A weekly job reports changes in Google's data.
- Releases are published from CI with npm provenance.
- A playground page shows every feature, as you type.
- Browser and bundler test: the packed package in Chromium, Firefox and WebKit, as native ES modules and bundled by Vite and webpack (ESM and CommonJS), compared result by result with Node; plus a check that bundlers tree-shake unused API.
- Contributing guide, security policy, issue forms and Dependabot for dependencies and actions.

### Development

- Needs Node 22.18 or later (`.nvmrc`, `devEngines`). The published package still supports Node 14 and later.

## [0.1.0]

Initial release: `parse`, `parseMany`, `isValid`, `format`, `guessCountry`, `getCountryInfo`, `getCountries`, `getCountryName` for 252 countries, and `postalkit/regions`.
