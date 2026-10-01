// The app under test, as ES modules: what a bundler or an import map resolves "postalkit" to.
import * as core from "postalkit";
import * as regions from "postalkit/regions";
import * as partial from "postalkit/partial";
import * as messages from "postalkit/messages";
import { fingerprint, run } from "./checks.js";

window.__result = { failures: run({ core, regions, partial, messages }), fingerprint: fingerprint({ core, regions, partial }) };
