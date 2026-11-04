const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = readFileSync(
  path.join(__dirname, "../../src/bookmarks/runtime.js"),
  "utf8"
).replace(/^export /gm, "");
const sandbox = { module: { exports: {} }, Date, Object };
vm.runInNewContext(
  source + "\nmodule.exports = { normalizeBookmarkletSource, createBookmarkletRecord, inspectBookmarkletRisk, BOOKMARKLET_LIMITS };",
  sandbox
);
const { normalizeBookmarkletSource, createBookmarkletRecord, inspectBookmarkletRisk, BOOKMARKLET_LIMITS } = sandbox.module.exports;

test("normalizes javascript: URLs without evaluating source", () => {
  const result = normalizeBookmarkletSource("javascript:alert(document.title)");
  assert.equal(result.valid, true);
  assert.equal(result.source, "alert(document.title)");
});

test("preserves comments and source semantics", () => {
  const code = "/* keep this */\nconst url = 'https://example.com'; // keep";
  assert.equal(normalizeBookmarkletSource(code).source, code);
});

test("rejects non-string, empty, null-byte and oversized input", () => {
  assert.equal(normalizeBookmarkletSource(null).valid, false);
  assert.equal(normalizeBookmarkletSource("  ").valid, false);
  assert.equal(normalizeBookmarkletSource("alert(1)\0").valid, false);
  assert.equal(normalizeBookmarkletSource("x".repeat(BOOKMARKLET_LIMITS.maxSourceLength + 1)).valid, false);
});

test("rejects malformed percent encoding and decodes only once", () => {
  assert.equal(normalizeBookmarkletSource("%E0%A4%A").valid, false);
  const result = normalizeBookmarkletSource("%252F");
  assert.equal(result.source, "%2F");
});

test("creates a bounded bookmarklet record", () => {
  const result = createBookmarkletRecord({
    title: " Page helper ",
    description: " Small helper ",
    category: "Utilities",
    source: "javascript:document.title"
  });
  assert.equal(result.valid, true);
  assert.equal(result.record.title, "Page helper");
  assert.equal(result.record.source, "document.title");
  assert.equal(result.record.schemaVersion, 1);
});

test("rejects malformed records and overlong titles", () => {
  assert.equal(createBookmarkletRecord([]).valid, false);
  assert.equal(createBookmarkletRecord({ title: "", source: "alert(1)" }).valid, false);
  assert.equal(createBookmarkletRecord({ title: "x".repeat(121), source: "alert(1)" }).valid, false);
});

test("risk inspection reports heuristics without claiming safety", () => {
  const result = inspectBookmarkletRisk("fetch('/api'); document.cookie; eval('1')");
  assert.equal(result.risk, "high");
  assert.deepEqual([...result.findings].map((finding) => finding.id), [
    "cookie-access", "network-request", "dynamic-code"
  ]);
  assert.equal(inspectBookmarkletRisk("document.title").risk, "unknown");
});
