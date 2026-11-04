const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = readFileSync(
  path.join(__dirname, "../../src/platform/ua-parser.js"),
  "utf8"
).replace(/^export (?:async )?function /gm, "function ");
const sandbox = { module: { exports: {} }, navigator: undefined, window: undefined };
vm.runInNewContext(
  source + "\nmodule.exports = { parseUserAgent, detectCapabilities, getUserAgentClientHints };",
  sandbox
);
const { parseUserAgent, detectCapabilities, getUserAgentClientHints } = sandbox.module.exports;

const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 27_0_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/155.0.8059.37 Mobile/15E148 Safari/604.1";

test("identifies Chrome on iPhone while retaining WebKit engine", () => {
  const result = parseUserAgent(IPHONE_CHROME);
  assert.equal(result.browser.name, "Chrome Mobile iOS");
  assert.equal(result.browser.version, "155.0.8059.37");
  assert.equal(result.engine.name, "WebKit");
  assert.equal(result.engine.version, "605.1.15");
  assert.deepEqual({ ...result.os }, {
    name: "iOS", version: "27.0.0", source: "user-agent"
  });
  assert.deepEqual({ ...result.device }, {
    vendor: "Apple", model: "iPhone", type: "mobile", source: "user-agent"
  });
  assert.equal(result.isMobile, true);
});

test("classifies desktop Chrome as Blink, not WebKit", () => {
  const result = parseUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
  );
  assert.equal(result.browser.name, "Chrome");
  assert.equal(result.engine.name, "Blink");
  assert.equal(result.os.name, "Windows");
  assert.equal(result.cpu.architecture, "x64");
});

test("identifies Safari on iPhone", () => {
  const result = parseUserAgent(
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
  );
  assert.equal(result.browser.name, "Safari");
  assert.equal(result.browser.version, "17.5");
  assert.equal(result.engine.name, "WebKit");
});

test("identifies Firefox and Gecko", () => {
  const result = parseUserAgent(
    "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0"
  );
  assert.equal(result.browser.name, "Firefox");
  assert.equal(result.engine.name, "Gecko");
  assert.equal(result.os.name, "Linux");
});

test("uses Client Hints for browser, OS, model and CPU details", () => {
  const result = parseUserAgent("Mozilla/5.0", {
    brands: [{ brand: "Google Chrome", version: "130" }],
    fullVersionList: [{ brand: "Google Chrome", version: "130.0.6723.1" }],
    platform: "Android",
    platformVersion: "15",
    mobile: true,
    model: "Pixel 9",
    architecture: "arm"
  });
  assert.equal(result.browser.name, "Google Chrome");
  assert.equal(result.browser.version, "130.0.6723.1");
  assert.equal(result.os.name, "Android");
  assert.equal(result.os.version, "15");
  assert.equal(result.device.model, "Pixel 9");
  assert.equal(result.device.type, "mobile");
  assert.equal(result.cpu.architecture, "arm64");
});

test("handles missing and non-string user agents safely", () => {
  assert.equal(parseUserAgent(null).browser.name, "Unknown");
  assert.equal(parseUserAgent(42).device.type, "desktop");
  assert.equal(parseUserAgent("x".repeat(3000)).userAgent.length, 2048);
});

test("capabilities are reported separately from UA identity", () => {
  const result = detectCapabilities({
    navigator: { maxTouchPoints: 5, onLine: true, serviceWorker: {}, userAgentData: {} },
  });
  assert.deepEqual({ ...result }, {
    touch: true, online: true, serviceWorker: true, userAgentData: true
  });
});

test("returns null when Client Hints are unavailable", async () => {
  assert.equal(await getUserAgentClientHints({}), null);
});

test("falls back to low-entropy hints when high-entropy access fails", async () => {
  const result = await getUserAgentClientHints({
    userAgentData: {
      brands: [{ brand: "Chromium", version: "130" }],
      mobile: false,
      platform: "Windows",
      getHighEntropyValues: async () => { throw new Error("denied"); }
    }
  });
  assert.equal(result.platform, "Windows");
  assert.equal(result.mobile, false);
  assert.equal(result.brands[0].brand, "Chromium");
});
