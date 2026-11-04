import {
  inspectBookmarkletRisk,
  normalizeBookmarkletSource,
} from "./bookmarks/runtime";

/**
 * Validate syntax without executing the source. Function construction only
 * parses/compiles the body; the returned function is never invoked here.
 */
export function processAndValidateBookmarklet(inputCode) {
  const normalized = normalizeBookmarkletSource(inputCode);
  if (!normalized.valid) {
    return { isValid: false, error: normalized.error, cleanCode: "" };
  }

  try {
    // Preserve comments and formatting; do not repeatedly decode or rewrite code.
    new Function(normalized.source);
  } catch (syntaxError) {
    return {
      isValid: false,
      error: "Syntax verification failed: " + syntaxError.message,
      cleanCode: "",
    };
  }

  return { isValid: true, error: null, cleanCode: normalized.source };
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
