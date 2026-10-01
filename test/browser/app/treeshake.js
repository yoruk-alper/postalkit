// Only isValid: a production bundle should leave out the rest of the API (sideEffects: false).
import { isValid } from "postalkit";

window.__result = isValid("US", "90210");
