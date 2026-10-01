// The same app as CommonJS, so the bundle uses the package's "require" builds (dist/*.cjs).
const core = require("postalkit");
const regions = require("postalkit/regions");
const partial = require("postalkit/partial");
const messages = require("postalkit/messages");
const { fingerprint, run } = require("./checks.js");

window.__result = { failures: run({ core, regions, partial, messages }), fingerprint: fingerprint({ core, regions, partial }) };
