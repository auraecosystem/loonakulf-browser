/**
 * Electron-side validation for renderer-supplied User-Agent overrides.
 * The active handler lives in main.js; this module intentionally registers
 * no IPC listeners of its own.
 */
function isValidUserAgent(value) {
  return typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= 2048 &&
    !/[\r\n]/.test(value);
}

module.exports = { isValidUserAgent };
