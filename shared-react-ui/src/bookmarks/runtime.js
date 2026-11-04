const MAX_BOOKMARKLET_LENGTH = 256 * 1024;
const MAX_TITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 500;

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Normalize bookmarklet source without executing or rewriting its semantics.
 * Imported javascript: URLs are decoded once; raw source is never decoded.
 */
export function normalizeBookmarkletSource(input) {
  if (typeof input !== "string") {
    return { valid: false, error: "Bookmarklet source must be a string.", source: "" };
  }
  if (input.length > MAX_BOOKMARKLET_LENGTH) {
    return { valid: false, error: "Bookmarklet exceeds the 256 KiB source limit.", source: "" };
  }

  const hasBookmarkletScheme = /^javascript:/i.test(input.trim());
  let source = input.trim().replace(/^javascript:/i, "").trim();
  if (!source) {
    return { valid: false, error: "Bookmarklet source cannot be empty.", source: "" };
  }

  // Decode one time only when importing a javascript: URL. Raw JavaScript is
  // preserved verbatim so percent sequences inside strings are not rewritten.
  if (hasBookmarkletScheme && /%/.test(source)) {
    if (/%(?![0-9a-f]{2})/i.test(source)) {
      return { valid: false, error: "Bookmarklet URL contains malformed percent encoding.", source: "" };
    }
    try {
      source = decodeURIComponent(source);
    } catch (_error) {
      return { valid: false, error: "Bookmarklet URL contains malformed percent encoding.", source: "" };
    }
  }
  // eslint-disable-next-line no-control-regex -- reject unsafe control bytes in imported source
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(source)) {
    return { valid: false, error: "Bookmarklet contains unsupported control characters.", source: "" };
  }

  return { valid: true, error: null, source };
}

/** Validate a bridge request. This is input validation, not authorization. */
export function validateBookmarkletRequest(input) {
  if (!isPlainObject(input)) {
    return { valid: false, error: "Bookmarklet request must be an object.", request: null };
  }
  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (!title || title.length > MAX_TITLE_LENGTH) {
    return { valid: false, error: "A title of at most 120 characters is required.", request: null };
  }
  const normalized = normalizeBookmarkletSource(input.source);
  if (!normalized.valid) return { valid: false, error: normalized.error, request: null };
  return {
    valid: true,
    error: null,
    request: { title, source: normalized.source }
  };
}

/** Return a stable record suitable for local persistence; never grants trust. */
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

/** Heuristic warnings only. Static scanning cannot prove safety or malice. */
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
