/**
 * Loonakulf Browser UA identity adapter.
 *
 * Product identity is deliberately separate from the rendering engine:
 * Loonakulf may run on Blink, WebKit, or another supported engine.
 */
import { parseUserAgent } from "./ua-parser";

export const LOONAKULF_PRODUCT = Object.freeze({
  name: "Loonakulf",
  token: "Loonakulf",
  id: "loonakulf-browser",
  defaultVersion: "1.0.0"
});

const MAX_UA_LENGTH = 2048;
const VERSION_PATTERN = /^\d+(?:\.\d+){0,3}$/;

export function isLoonakulfUserAgent(input) {
  if (typeof input !== "string") return false;
  return new RegExp("(?:^|\\s)" + LOONAKULF_PRODUCT.token + "/\\d+(?:\\.\\d+){0,3}(?=\\s|$)", "i")
    .test(input.slice(0, MAX_UA_LENGTH));
}

export function getLoonakulfVersion(input) {
  if (typeof input !== "string") return null;
  const match = input.slice(0, MAX_UA_LENGTH).match(
    new RegExp("(?:^|\\s)" + LOONAKULF_PRODUCT.token + "/(\\d+(?:\\.\\d+){0,3})(?=\\s|$)", "i")
  );
  return match ? match[1] : null;
}

/**
 * Append exactly one Loonakulf product token to a UA string.
 * Existing tokens are replaced, making repeated shell configuration safe.
 */
export function withLoonakulfProductToken(input, version = LOONAKULF_PRODUCT.defaultVersion) {
  if (typeof version !== "string" || !VERSION_PATTERN.test(version)) {
    throw new TypeError("Loonakulf version must be a numeric dotted version.");
  }
  const ua = typeof input === "string" ? input.slice(0, MAX_UA_LENGTH) : "";
  const withoutProductToken = ua
    .replace(/(?:^|\\s)Loonakulf\\/\\d+(?:\\.\\d+){0,3}(?=\\s|$)/ig, "")
    .trim();
  const token = LOONAKULF_PRODUCT.token + "/" + version;
  return (withoutProductToken ? withoutProductToken + " " : "") + token;
}

/**
 * Parse a Loonakulf UA while retaining the actual host OS/device/engine.
 * A UA token is a compatibility signal, not proof of a trusted installation.
 */
export function parseLoonakulfUserAgent(input, clientHints = {}) {
  const ua = typeof input === "string" ? input.slice(0, MAX_UA_LENGTH) : "";
  const parsed = parseUserAgent(ua, clientHints);
  const version = getLoonakulfVersion(ua);
  const detected = version !== null;

  return {
    ...parsed,
    browser: detected
      ? {
          name: LOONAKULF_PRODUCT.name,
          version,
          major: version.split(".")[0],
          source: "loonakulf-product-token"
        }
      : parsed.browser,
    product: {
      id: LOONAKULF_PRODUCT.id,
      name: LOONAKULF_PRODUCT.name,
      detected,
      version
    },
    isLoonakulf: detected
  };
}
