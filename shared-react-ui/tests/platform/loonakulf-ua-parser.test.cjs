const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const genericSource = readFileSync(path.join(__dirname, "../../src/platform/ua-parser.js"), "utf8")
  .replace(/^export /gm, "");
const genericSandbox = { module: { exports: {} } };
vm.runInNewContext(
  genericSource + "\nmodule.exports = { parseUserAgent };",
  genericSandbox
);

const source = readFileSync(
  path.join(__dirname, "../../src/platform/loonakulf-ua-parser.js"),
  "utf8"
)
  .replace(/^import \{ parseUserAgent \} from ["'][^"']+["'];\s*/m, "")
  .replace(/^export const /gm, "const ")
  .replace(/^export function /gm, "function ");

const sandbox = {
  module: { exports: {} },
  parseUserAgent: genericSandbox.module.exports.parseUserAgent
};
vm.runInNewContext(
  source + "\nmodule.exports = { LOONAKULF_PRODUCT, isLoonakulfUserAgent, getLoonakulfVersion, withLoonakulfProductToken, parseLoonakulfUserAgent };",
  sandbox
);
const api = sandbox.module.exports;

test("identifies Loonakulf by its product token", () => {
  const ua = "Mozilla/5.0 Chrome/130.0.0.0 Safari/537.36 Loonakulf/2.4.1";
  assert.equal(api.isLoonakulfUserAgent(ua), true);
  assert.equal(api.getLoonakulfVersion(ua), "2.4.1");
});

test("does not classify Chrome or Safari as Loonakulf without the product token", () => {
  assert.equal(api.isLoonakulfUserAgent("Mozilla/5.0 Chrome/130.0.0.0"), false);
  assert.equal(api.parseLoonakulfUserAgent("Mozilla/5.0 Chrome/130.0.0.0").isLoonakulf, false);
});

test("reports Loonakulf product identity and Blink engine independently", () => {
  const parsed = api.parseLoonakulfUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36 Loonakulf/2.4.1"
  );
  assert.equal(parsed.browser.name, "Loonakulf");
  assert.equal(parsed.browser.version, "2.4.1");
  assert.equal(parsed.product.id, "loonakulf-browser");
  assert.equal(parsed.engine.name, "Blink");
  assert.equal(parsed.os.name, "Windows");
});

test("preserves WebKit engine identity for Loonakulf on iOS", () => {
  const parsed = api.parseLoonakulfUserAgent(
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 CriOS/130.0 Mobile/15E148 Safari/604.1 Loonakulf/2.4.1"
  );
  assert.equal(parsed.browser.name, "Loonakulf");
  assert.equal(parsed.engine.name, "WebKit");
  assert.equal(parsed.os.name, "iOS");
});

test("adds or replaces the product token without duplicates", () => {
  const ua = "Mozilla/5.0 Chrome/130.0.0.0";
  assert.equal(api.withLoonakulfProductToken(ua, "2.0.0"), ua + " Loonakulf/2.0.0");
  assert.equal(
    api.withLoonakulfProductToken(ua + " Loonakulf/1.0.0", "2.0.0"),
    ua + " Loonakulf/2.0.0"
  );
});

test("rejects invalid product versions", () => {
  assert.throws(() => api.withLoonakulfProductToken("Mozilla/5.0", "latest"));
});

test("handles non-string and oversized UA input safely", () => {
  assert.equal(api.isLoonakulfUserAgent(null), false);
  assert.equal(api.parseLoonakulfUserAgent(null).isLoonakulf, false);
  assert.equal(api.getLoonakulfVersion("x".repeat(3000)), null);
});
