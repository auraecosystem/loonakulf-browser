const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = readFileSync(
  path.join(__dirname, "../../src/platform/ua-parser.js"),
  "utf8"
).replace(/^export function /gm, "function ");
const sandbox = { module: { exports: {} } };
vm.runInNewContext(
  source + "\nmodule.exports = { parseUserAgent, detectCapabilities };",
  sandbox
);
const { parseUserAgent, detectCapabilities } = sandbox.module.exports;

const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 27_0_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/155.0.8059.37 Mobile/15E148 Safari/604.1";

test("identifies Chrome on iPhone while retaining WebKit engine", () => {
  const result = parseUserAgent(IPHONE_CHROME);
  assert.deepEqual({ ...result.browser }, {
    name: "Chrome Mobile iOS",
    version: "155.0.8059.37",
    family: "Chrome Mobile iOS",
  });
  assert.deepEqual({ ...result.engine }, { name: "WebKit", version: "605.1.15" });
  assert.deepEqual({ ...result.os }, { name: "iOS", version: "27.0.0" });
  assert.deepEqual({ ...result.device }, {
    vendor: "Apple",
    model: "iPhone",
    type: "mobile",
  });
  assert.equal(result.isMobile, true);
});

test("does not misidentify Chrome iOS as Blink", () => {
  assert.equal(parseUserAgent(IPHONE_CHROME).engine.name, "WebKit");
});

test("identifies Safari on iPhone", () => {
  const result = parseUserAgent(
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
  );
  assert.equal(result.browser.family, "Safari iOS");
  assert.equal(result.browser.version, "17.5");
});

test("handles missing and non-string user agents safely", () => {
  assert.equal(parseUserAgent(null).browser.name, "Unknown");
  assert.equal(parseUserAgent(42).device.type, "desktop");
});

test("capabilities are reported separately from UA identity", () => {
  const result = detectCapabilities({
    navigator: { maxTouchPoints: 5, onLine: true, serviceWorker: {} },
  });
  assert.deepEqual({ ...result }, {
    touch: true,
    online: true,
    serviceWorker: true,
  });
});
