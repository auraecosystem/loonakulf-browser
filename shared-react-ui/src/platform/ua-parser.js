/**
 * Lightweight User-Agent identity parser for the shared browser UI.
 *
 * UA strings are user-controlled input. This parser only classifies known
 * tokens; it does not execute or trust the supplied string.
 */
function matchVersion(ua, expression) {
  const match = ua.match(expression);
  return match ? match[1] : null;
}

export function parseUserAgent(input) {
  const ua = typeof input === "string" ? input.slice(0, 2048) : "";
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);

  let browser = { name: "Unknown", version: null, family: "Unknown" };
  const browserRules = [
    ["Chrome Mobile iOS", new RegExp("CriOS/" + VERSION, "i"), "Chrome Mobile iOS"],
    ["Firefox iOS", new RegExp("FxiOS/" + VERSION, "i"), "Firefox iOS"],
    ["Edge iOS", new RegExp("EdgiOS/" + VERSION, "i"), "Edge iOS"],
    ["Samsung Internet", new RegExp("SamsungBrowser/" + VERSION, "i"), "Samsung Internet"],
    ["Edge", new RegExp("Edg(?:A|iOS)?/" + VERSION, "i"), "Edge"],
    ["Opera", new RegExp("(?:OPR|Opera)/" + VERSION, "i"), "Opera"],
    ["Chrome", new RegExp("(?:Chrome|Chromium)/" + VERSION, "i"), "Chrome"],
    ["Firefox", new RegExp("(?:Firefox|FxiOS)/" + VERSION, "i"), "Firefox"],
    ["Safari", new RegExp("Version/" + VERSION, "i"), "Safari"]
  ];

  for (const [name, expression, family] of browserRules) {
    const version = matchVersion(ua, expression);
    if (version) {
      browser = { name, version, family };
      break;
    }
  }
  if (isIOS && browser.name === "Chrome Mobile iOS") {
    browser.family = "Chrome Mobile iOS";
  } else if (isIOS && browser.name === "Safari") {
    browser.family = "Safari iOS";
  }

  let os = { name: "Unknown", version: null };
  const iosVersion = matchVersion(ua, /(?:iPhone OS|CPU OS) ([\d_]+)/i);
  const androidVersion = matchVersion(ua, /Android[ /]([\d.]+)/i);
  const windowsVersion = matchVersion(ua, /Windows NT ([\d.]+)/i);
  const macVersion = matchVersion(ua, /Mac OS X ([\d_.]+)/i);
  if (iosVersion) os = { name: "iOS", version: iosVersion.replace(/_/g, ".") };
  else if (androidVersion) os = { name: "Android", version: androidVersion };
  else if (windowsVersion) os = { name: "Windows", version: windowsVersion };
  else if (macVersion) os = { name: "macOS", version: macVersion.replace(/_/g, ".") };
  else if (/Linux/i.test(ua)) os = { name: "Linux", version: null };

  let device = { vendor: null, model: null, type: "desktop" };
  if (/iPhone/i.test(ua)) device = { vendor: "Apple", model: "iPhone", type: "mobile" };
  else if (/iPad/i.test(ua) || (isIOS && /Macintosh/i.test(ua) && /Mobile/i.test(ua))) {
    device = { vendor: "Apple", model: "iPad", type: "tablet" };
  } else if (/iPod/i.test(ua)) device = { vendor: "Apple", model: "iPod", type: "mobile" };
  else if (isAndroid) {
    device = { vendor: null, model: null, type: /Mobile/i.test(ua) ? "mobile" : "tablet" };
  }

  // iOS browsers all use WebKit, including Chrome and Firefox on iOS.
  let engine = { name: "Unknown", version: null };
  const webkitVersion = matchVersion(ua, /AppleWebKit\/([\d.]+)/i);
  const geckoVersion = matchVersion(ua, /rv:([\d.]+).*Gecko\//i);
  const blinkVersion = matchVersion(ua, /Chrome\/([\d.]+)/i);
  if (webkitVersion) engine = { name: "WebKit", version: webkitVersion };
  else if (geckoVersion) engine = { name: "Gecko", version: geckoVersion };
  else if (blinkVersion) engine = { name: "Blink", version: blinkVersion };

  return {
    userAgent: ua,
    browser,
    engine,
    os,
    device,
    isMobile: device.type === "mobile",
    isTablet: device.type === "tablet"
  };
}

/**
 * Capability detection must run in the actual browser, not be inferred from UA.
 */
export function detectCapabilities(environment = typeof window !== "undefined" ? window : null) {
  if (!environment) {
    return { touch: null, online: null, serviceWorker: false };
  }
  const navigatorObject = environment.navigator || {};
  return {
    touch: Number(navigatorObject.maxTouchPoints || 0) > 0 || "ontouchstart" in environment,
    online: typeof navigatorObject.onLine === "boolean" ? navigatorObject.onLine : null,
    serviceWorker: Boolean(navigatorObject.serviceWorker)
  };
}
