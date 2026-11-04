/**
 * Privacy-conscious platform identity and capability detection.
 *
 * User-Agent strings and Client Hints are advisory, user-controlled signals.
 * Do not use this output for authentication, authorization, or fraud decisions.
 */
const MAX_UA_LENGTH = 2048;
const VERSION = "(\\d+(?:\\.\\d+){0,3})";

function firstMatch(value, expressions) {
  for (const expression of expressions) {
    const match = value.match(expression);
    if (match) return match[1] || null;
  }
  return null;
}

function normalizeVersion(value) {
  return typeof value === "string" ? value.replace(/_/g, ".") : null;
}

function getBrandVersion(brands) {
  if (!Array.isArray(brands)) return null;
  const preferred = ["Microsoft Edge", "Google Chrome", "Chromium", "Opera"];
  for (const name of preferred) {
    const item = brands.find((brand) =>
      brand && typeof brand.brand === "string" &&
      brand.brand.toLowerCase() === name.toLowerCase()
    );
    if (item && typeof item.version === "string") {
      return { name, version: item.version };
    }
  }
  return null;
}

function parseBrowser(ua, hints) {
  const rules = [
    ["Chrome Mobile iOS", new RegExp("CriOS/" + VERSION, "i")],
    ["Firefox iOS", new RegExp("FxiOS/" + VERSION, "i")],
    ["Edge iOS", new RegExp("EdgiOS/" + VERSION, "i")],
    ["Edge", new RegExp("Edg(?:A|iOS)?/" + VERSION, "i")],
    ["Samsung Internet", new RegExp("SamsungBrowser/" + VERSION, "i")],
    ["Opera", new RegExp("(?:OPR|Opera)/" + VERSION, "i")],
    ["Chrome", new RegExp("(?:Chrome|Chromium)/" + VERSION, "i")],
    ["Firefox", new RegExp("Firefox/" + VERSION, "i")],
    ["Safari", new RegExp("Version/" + VERSION + ".*Safari", "i")]
  ];

  for (const [name, expression] of rules) {
    const version = firstMatch(ua, [expression]);
    if (version) {
      return {
        name,
        version,
        major: version.split(".")[0],
        source: "user-agent"
      };
    }
  }

  const hinted = getBrandVersion(hints.fullVersionList || hints.brands);
  if (hinted) {
    return {
      name: hinted.name,
      version: hinted.version,
      major: hinted.version.split(".")[0],
      source: "client-hints"
    };
  }
  return { name: "Unknown", version: null, major: null, source: "unknown" };
}

function parseOS(ua, hints) {
  const hintedPlatform = typeof hints.platform === "string" ? hints.platform : "";
  const hintedVersion = typeof hints.platformVersion === "string" ? hints.platformVersion : null;
  if (hintedPlatform) {
    const platform = hintedPlatform.toLowerCase();
    const name = platform === "macos" ? "macOS" :
      platform === "chrome os" ? "Chromium OS" :
      platform === "windows" ? "Windows" :
      platform === "android" ? "Android" :
      platform === "ios" ? "iOS" : hintedPlatform;
    return { name, version: hintedVersion, source: "client-hints" };
  }

  const rules = [
    ["iOS", /(?:iPhone OS|CPU OS) ([\d_]+)/i, true],
    ["Android", /Android[ /]([\d.]+)/i],
    ["Windows", /Windows NT ([\d.]+)/i],
    ["macOS", /Mac OS X ([\d_.]+)/i, true],
    ["Chrome OS", /CrOS [^ ]+ ([\d.]+)/i],
    ["KaiOS", /KaiOS[ /]([\d.]+)/i],
    ["webOS", /(?:webOS|hpwOS)[ /]([\d.]+)/i]
  ];
  for (const [name, expression, underscores] of rules) {
    const version = firstMatch(ua, [expression]);
    if (version) return {
      name: name === "Chrome OS" ? "Chromium OS" : name,
      version: underscores ? normalizeVersion(version) : version,
      source: "user-agent"
    };
  }
  if (/Linux/i.test(ua)) return { name: "Linux", version: null, source: "user-agent" };
  return { name: "Unknown", version: null, source: "unknown" };
}

function parseDevice(ua, hints) {
  const modelHint = typeof hints.model === "string" && hints.model ? hints.model : null;
  const mobileHint = typeof hints.mobile === "boolean" ? hints.mobile : null;
  let device = { vendor: null, model: modelHint, type: "desktop", source: modelHint ? "client-hints" : "user-agent" };

  if (/iPhone/i.test(ua)) device = { vendor: "Apple", model: "iPhone", type: "mobile", source: "user-agent" };
  else if (/iPad/i.test(ua) || (/Macintosh/i.test(ua) && mobileHint === true)) {
    device = { vendor: "Apple", model: "iPad", type: "tablet", source: mobileHint === true ? "client-hints" : "user-agent" };
  } else if (/iPod/i.test(ua)) device = { vendor: "Apple", model: "iPod", type: "mobile", source: "user-agent" };
  else if (/Pixel ([\w ]+)/i.test(ua)) {
    const model = firstMatch(ua, [/Pixel ([\w ]+?)(?: Build|\))/i]);
    device = { vendor: "Google", model: model ? "Pixel " + model.trim() : "Pixel", type: mobileHint === false ? "tablet" : "mobile", source: "user-agent" };
  } else if (/SM-[A-Z0-9]+/i.test(ua)) {
    device = { vendor: "Samsung", model: firstMatch(ua, /(SM-[A-Z0-9]+)/i), type: mobileHint === false ? "tablet" : "mobile", source: "user-agent" };
  } else if (/Android/i.test(ua)) {
    device = { vendor: null, model: modelHint, type: mobileHint === true || (mobileHint === null && /Mobile/i.test(ua)) ? "mobile" : "tablet", source: modelHint ? "client-hints" : "user-agent" };
  } else if (modelHint) {
    device = { vendor: null, model: modelHint, type: mobileHint ? "mobile" : "desktop", source: "client-hints" };
  }
  return device;
}

function parseEngine(ua, browser, os) {
  // All iOS browsers are required by the platform to use WebKit.
  if (os.name === "iOS" || /(?:CriOS|FxiOS|EdgiOS|OPiOS)\//i.test(ua)) {
    return { name: "WebKit", version: firstMatch(ua, [/AppleWebKit\/([\d.]+)/i]), source: "user-agent" };
  }
  const webkit = firstMatch(ua, [/AppleWebKit\/([\d.]+)/i]);
  const gecko = firstMatch(ua, [/rv:([\d.]+).*Gecko\//i]);
  if (browser.name === "Firefox" || browser.name === "Firefox iOS") {
    return { name: "Gecko", version: gecko, source: "user-agent" };
  }
  if (browser.name !== "Safari" && /(?:Chrome|Chromium|Edg|OPR)\//i.test(ua)) {
    return { name: "Blink", version: firstMatch(ua, [/Chrome\/([\d.]+)/i]), source: "user-agent" };
  }
  if (webkit) return { name: "WebKit", version: webkit, source: "user-agent" };
  if (gecko) return { name: "Gecko", version: gecko, source: "user-agent" };
  const trident = firstMatch(ua, [/Trident\/([\d.]+)/i]);
  if (trident) return { name: "Trident", version: trident, source: "user-agent" };
  return { name: "Unknown", version: null, source: "unknown" };
}

function parseCPU(ua, hints) {
  if (typeof hints.architecture === "string" && hints.architecture) {
    const arch = hints.architecture.toLowerCase();
    const normalized = /arm/.test(arch) ? "arm64" :
      /x86|ia32|i386/.test(arch) ? "x86" :
      /64/.test(arch) ? "x64" : arch;
    return { architecture: normalized, source: "client-hints" };
  }
  if (/\b(?:aarch64|arm64)\b/i.test(ua)) return { architecture: "arm64", source: "user-agent" };
  if (/\b(?:x86_64|x64|wow64|win64|amd64)\b/i.test(ua)) return { architecture: "x64", source: "user-agent" };
  if (/\b(?:i[3-6]86|x86|ia32)\b/i.test(ua)) return { architecture: "x86", source: "user-agent" };
  if (/\barm/i.test(ua)) return { architecture: "arm", source: "user-agent" };
  return { architecture: null, source: "unknown" };
}

/**
 * Parse a UA string with optional low/high-entropy UA Client Hints.
 * @param {string} input User-Agent string.
 * @param {object} clientHints navigator.userAgentData values, when available.
 */
export function parseUserAgent(input, clientHints = {}) {
  const ua = typeof input === "string" ? input.slice(0, MAX_UA_LENGTH) : "";
  const hints = clientHints && typeof clientHints === "object" ? clientHints : {};
  const browser = parseBrowser(ua, hints);
  const os = parseOS(ua, hints);
  const device = parseDevice(ua, hints);
  const engine = parseEngine(ua, browser, os);
  const cpu = parseCPU(ua, hints);
  return {
    userAgent: ua,
    browser,
    engine,
    os,
    device,
    cpu,
    isMobile: device.type === "mobile",
    isTablet: device.type === "tablet"
  };
}

/**
 * Read UA Client Hints when supported. High-entropy fields are requested only
 * on demand by the caller; callers should avoid persisting them unnecessarily.
 */
export async function getUserAgentClientHints(navigatorObject = typeof navigator !== "undefined" ? navigator : null) {
  if (!navigatorObject || !navigatorObject.userAgentData) return null;
  const data = navigatorObject.userAgentData;
  const lowEntropy = {
    brands: Array.isArray(data.brands) ? data.brands : [],
    mobile: typeof data.mobile === "boolean" ? data.mobile : null,
    platform: typeof data.platform === "string" ? data.platform : null
  };
  if (typeof data.getHighEntropyValues !== "function") return lowEntropy;
  try {
    return { ...lowEntropy, ...(await data.getHighEntropyValues([
      "architecture", "model", "platformVersion", "fullVersionList"
    ])) };
  } catch (_error) {
    return lowEntropy;
  }
}

/**
 * Runtime capabilities are measured, never inferred from a UA string.
 */
export function detectCapabilities(environment = typeof window !== "undefined" ? window : null) {
  if (!environment) return { touch: null, online: null, serviceWorker: false, userAgentData: false };
  const navigatorObject = environment.navigator || {};
  return {
    touch: Number(navigatorObject.maxTouchPoints || 0) > 0 || "ontouchstart" in environment,
    online: typeof navigatorObject.onLine === "boolean" ? navigatorObject.onLine : null,
    serviceWorker: Boolean(navigatorObject.serviceWorker),
    userAgentData: Boolean(navigatorObject.userAgentData)
  };
}
