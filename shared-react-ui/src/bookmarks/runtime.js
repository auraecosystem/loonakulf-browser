const MAX_BOOKMARKLET_LENGTH = 256 * 1024;
const MAX_TITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 500;

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Normalize bookmarklet source without evaluating it.
 * Syntax checking and execution belong in a sandboxed, user-authorized runtime.
 */
export function normalizeBookmarkletSource(input) {
  if (typeof input !== "string") {
    return { valid: false, error: "Bookmarklet source must be a string.", source: "" };
  }
  if (input.length > MAX_BOOKMARKLET_LENGTH) {
    return { valid: false, error: "Bookmarklet exceeds the 256 KiB source limit.", source: "" };
  }

  let source = input.trim();
  if (!source) {
    return { valid: false, error: "Bookmarklet source cannot be empty.", source: "" };
  }

  if (/^javascript:/i.test(source)) {
    source = source.slice("javascript:".length).trim();
  }
  if (!source) {
    return { valid: false, error: "Bookmarklet contains no executable source.", source: "" };
  }
  if (/[\u0000]/.test(source)) {
    return { valid: false, error: "Bookmarklet contains a null byte.", source: "" };
  }

  // Decode at most once. Repeated decoding can change program meaning and enable
  // double-encoding tricks; callers should retain the original source for review.
  if (/%(?:[0-9a-f]{2})/i.test(source)) {
    try {
      source = decodeURIComponent(source);
    } catch (_error) {
      return { valid: false, error: "Bookmarklet contains malformed percent encoding.", source: "" };
    }
  }

  return { valid: true, error: null, source };
}

/**
 * Return a stable, validated record suitable for local persistence.
 * This function does not establish trust or grant execution permission.
 */
export function createBookmarkletRecord(input) {
  if (!isPlainObject(input)) {
    return { valid: false, error: "Bookmarklet record must be a plain object.", record: null };
  }

  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (!title || title.length > MAX_TITLE_LENGTH) {
    return { valid: false, error: "Title is required and must be at most 120 characters.", record: null };
  }

  const normalized = normalizeBookmarkletSource(input.source ?? input.rawCode);
  if (!normalized.valid) return { valid: false, error: normalized.error, record: null };

  const description = typeof input.description === "string"
    ? input.description.trim().slice(0, MAX_DESCRIPTION_LENGTH)
    : "";
  const category = typeof input.category === "string"
    ? input.category.trim().slice(0, 60)
    : "Uncategorized";

  return {
    valid: true,
    error: null,
    record: {
      title,
      description,
      category: category || "Uncategorized",
      source: normalized.source,
      sourceLength: normalized.source.length,
      updatedAt: new Date().toISOString(),
      schemaVersion: 1
    }
  };
}

/**
 * Heuristic warnings only. Static scanning cannot prove a script safe or malicious.
 */
export function inspectBookmarkletRisk(source) {
  const code = typeof source === "string" ? source : "";
  const checks = [
    ["cookie-access", /document\s*\.\s*cookie/i, "Reads document.cookie; this may expose session data."],
    ["credential-fields", /input\s*\[[^\]]*type\s*=\s*['"]?password/i, "Inspects password fields."],
    ["network-request", /\b(fetch|XMLHttpRequest|WebSocket|sendBeacon)\s*\(/i, "May send or receive data over the network."],
    ["dynamic-code", /\b(eval|Function)\s*\(/i, "Uses dynamic code execution."],
    ["storage-access", /\b(localStorage|sessionStorage|indexedDB)\b/i, "Accesses page-origin browser storage."],
    ["form-submission", /\.submit\s*\(/i, "May submit a page form."]
  ];
  const findings = checks
    .filter(([, pattern]) => pattern.test(code))
    .map(([id, , message]) => ({ id, message }));
  return {
    findings,
    risk: findings.length >= 3 ? "high" : findings.length ? "review" : "unknown"
  };
}

export const BOOKMARKLET_LIMITS = Object.freeze({
  maxSourceLength: MAX_BOOKMARKLET_LENGTH,
  maxTitleLength: MAX_TITLE_LENGTH,
  maxDescriptionLength: MAX_DESCRIPTION_LENGTH
});
