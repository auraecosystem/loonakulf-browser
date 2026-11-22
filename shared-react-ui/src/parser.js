/**
 * Bookmarklet input handling.
 *
 * This module performs bounded structural normalization only. It deliberately
 * does not parse by executing source (new Function/eval), rewrite comments, or
 * repeatedly decode percent-encoded input. Validation is not a safety verdict.
 */
const MAX_BOOKMARKLET_LENGTH = 256 * 1024;

export function processAndValidateBookmarklet(inputCode) {
  if (typeof inputCode !== "string") {
    return { isValid: false, error: "Code field must be text.", cleanCode: "" };
  }
  if (inputCode.length > MAX_BOOKMARKLET_LENGTH) {
    return { isValid: false, error: "Bookmarklet exceeds the 256 KiB source limit.", cleanCode: "" };
  }

  let code = inputCode.trim();
  if (!code) {
    return { isValid: false, error: "Code field cannot be empty.", cleanCode: "" };
  }
  if (/^javascript:/i.test(code)) {
    code = code.slice("javascript:".length).trim();
  }
  if (!code) {
    return { isValid: false, error: "Bookmarklet contains no source.", cleanCode: "" };
  }
  if (/[\u0000]/.test(code)) {
    return { isValid: false, error: "Bookmarklet contains a null byte.", cleanCode: "" };
  }

  // Decode once only. Repeated decoding can change the program's meaning.
  if (/%(?:[0-9a-f]{2})/i.test(code)) {
    try {
      code = decodeURIComponent(code);
    } catch (_error) {
      return { isValid: false, error: "Bookmarklet contains malformed percent encoding.", cleanCode: "" };
    }
  }
  if (!code.trim()) {
    return { isValid: false, error: "Bookmarklet contains no source.", cleanCode: "" };
  }

  return { isValid: true, error: null, cleanCode: `javascript:${code}` };
}

export function auditScriptSecurityRisks(source) {
  const code = typeof source === "string" ? source : "";
  const checks = [
    [/\bdocument\s*\.\s*cookie\b/i, "Reads document.cookie; this may expose session data."],
    [/\b(?:fetch|XMLHttpRequest|WebSocket|sendBeacon)\s*\(/i, "May send or receive data over the network."],
    [/\binput\s*\[[^\]]*type\s*=\s*['"]?password/i, "Inspects password fields."],
    [/\b(?:eval|Function)\s*\(/i, "Uses dynamic code execution."],
    [/\b(?:localStorage|sessionStorage|indexedDB)\b/i, "Accesses page-origin browser storage."],
    [/\.\s*submit\s*\(/i, "May submit a page form."]
  ];
  const warnings = checks.filter(([pattern]) => pattern.test(code)).map(([, message]) => message);
  return { isHighRisk: warnings.length > 0, warnings };
}
