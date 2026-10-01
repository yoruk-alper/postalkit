# Security policy

## Supported versions

Security fixes go into the latest release.

## Reporting a vulnerability

Please report vulnerabilities privately through [GitHub's private vulnerability reporting](https://github.com/yoruk-alper/postalkit/security/advisories/new), not as a public issue. You'll get a reply within a week.

postalkit has no runtime dependencies and makes no network requests. The kinds of issue most relevant to it are inputs that make it throw (it is designed never to throw) and inputs that make validation unexpectedly slow, such as a regular expression with catastrophic backtracking.
