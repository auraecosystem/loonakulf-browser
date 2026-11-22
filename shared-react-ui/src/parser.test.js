import { auditScriptSecurityRisks, processAndValidateBookmarklet } from "./parser";

describe("bookmarklet input handling", () => {
  test("accepts ordinary JavaScript without executing it", () => {
    const result = processAndValidateBookmarklet("const value = 1;");
    expect(result.isValid).toBe(true);
    expect(result.cleanCode).toBe("javascript:const value = 1;");
  });

  test("does not strip comments or alter string contents", () => {
    const source = 'const url = "https://example.com/*keep*/"; // keep this comment';
    const result = processAndValidateBookmarklet(source);
    expect(result.isValid).toBe(true);
    expect(result.cleanCode).toBe(`javascript:${source}`);
  });

  test("decodes percent encoding once, not repeatedly", () => {
    const result = processAndValidateBookmarklet("%2561");
    expect(result.isValid).toBe(true);
    expect(result.cleanCode).toBe("javascript:%61");
  });

  test("rejects empty, non-string, oversized and malformed input", () => {
    expect(processAndValidateBookmarklet(" ").isValid).toBe(false);
    expect(processAndValidateBookmarklet(null).isValid).toBe(false);
    expect(processAndValidateBookmarklet("x".repeat(256 * 1024 + 1)).isValid).toBe(false);
    expect(processAndValidateBookmarklet("%E0%A4%A").isValid).toBe(false);
  });

  test("flags sensitive capabilities for user review", () => {
    const audit = auditScriptSecurityRisks("const x = document.cookie; fetch('/api');");
    expect(audit.isHighRisk).toBe(true);
    expect(audit.warnings.length).toBeGreaterThanOrEqual(2);
  });

  test("does not label a clean static scan as safe", () => {
    const audit = auditScriptSecurityRisks("document.querySelector('h1')");
    expect(audit.isHighRisk).toBe(false);
    expect(audit.warnings).toEqual([]);
  });
});
