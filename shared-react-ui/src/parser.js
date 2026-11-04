import {
  inspectBookmarkletRisk,
  normalizeBookmarkletSource,
} from "./bookmarks/runtime";

/**
 * Perform bounded structural validation only. Browser-side compilation is not
 * a security boundary; the selected native shell handles execution errors.
 */
export function processAndValidateBookmarklet(inputCode) {
  const normalized = normalizeBookmarkletSource(inputCode);
  if (!normalized.valid) {
    return { isValid: false, error: normalized.error, cleanCode: "" };
  }
  return {
    isValid: true,
    error: null,
    cleanCode: normalized.source,
    syntaxChecked: false,
  };
}

export function auditScriptSecurityRisks(source) {
  const audit = inspectBookmarkletRisk(source);
  return {
    isHighRisk: audit.risk === "high",
    risk: audit.risk,
    findings: audit.findings,
    warnings: audit.findings.map((finding) => finding.message),
  };
}
