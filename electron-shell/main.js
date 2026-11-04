const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { isValidUserAgent } = require("./platform");

let mainWindow;
let targetWebpageView;

const MAX_BOOKMARKLET_LENGTH = 256 * 1024;
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

const TRUSTED_UI_ORIGIN = "http://localhost:3000";

function isTrustedUiSender(event) {
  let senderOrigin = "";
  try {
    senderOrigin = new URL(event.senderFrame && event.senderFrame.url).origin;
  } catch (_error) {
    return false;
  }
  return Boolean(
    senderOrigin === TRUSTED_UI_ORIGIN &&
    mainWindow &&
    !mainWindow.isDestroyed() &&
    event.sender === mainWindow.webContents &&
    event.senderFrame === event.sender.mainFrame
  );
}

function getTargetWebContents(event) {
  if (!isTrustedUiSender(event) || !targetWebpageView || targetWebpageView.isDestroyed()) {
    return null;
  }
  const contents = targetWebpageView.webContents;
  return contents && !contents.isDestroyed() ? contents : null;
}

function parseSafeHttpUrl(value) {
  if (typeof value !== "string" || value.length > 4096) return null;
  try {
    const url = new URL(value);
    if (!ALLOWED_PROTOCOLS.has(url.protocol) || url.username || url.password) return null;
    return url.toString();
  } catch (_error) {
    return null;
  }
}

function isValidProxyRules(value) {
  if (typeof value !== "string" || value.length > 512 || /[\r\n]/.test(value)) return false;
  const match = value.match(/^http=([A-Za-z0-9.-]+):(\d{1,5});https=([A-Za-z0-9.-]+):(\d{1,5})$/);
  if (!match || match[1] !== match[3] || match[2] !== match[4]) return false;
  const port = Number(match[2]);
  return port >= 1 && port <= 65535;
}

function notifyUi(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 850,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.loadURL(TRUSTED_UI_ORIGIN);
  mainWindow.webContents.on("will-navigate", (event, navigationUrl) => {
    try {
      if (new URL(navigationUrl).origin !== TRUSTED_UI_ORIGIN) event.preventDefault();
    } catch (_error) {
      event.preventDefault();
    }
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  targetWebpageView = new BrowserWindow({
    width: 1300,
    height: 400,
    parent: mainWindow,
    frame: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  targetWebpageView.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  targetWebpageView.webContents.on("will-navigate", (event, navigationUrl) => {
    if (!parseSafeHttpUrl(navigationUrl)) event.preventDefault();
  });
  targetWebpageView.loadURL("https://example.com");

  targetWebpageView.webContents.on("did-navigate", (_event, url) => {
    notifyUi("target-url-changed", url);
  });

  targetWebpageView.webContents.on("console-message", (_event, level, message, line) => {
    const types = ["log", "log", "info", "error"];
    notifyUi("runtime-console-log", {
      type: types[level] || "log",
      message: `[Page Context] ${String(message).slice(0, 4000)} (Line: ${line})`,
    });
  });

  targetWebpageView.on("closed", () => {
    targetWebpageView = null;
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
    if (targetWebpageView && !targetWebpageView.isDestroyed()) {
      targetWebpageView.close();
    }
    targetWebpageView = null;
  });
}

ipcMain.on("execute-bookmarklet", (event, rawCode) => {
  const contents = getTargetWebContents(event);
  if (!contents || typeof rawCode !== "string" || rawCode.length > MAX_BOOKMARKLET_LENGTH) {
    console.warn("[Bookmarklet] Rejected untrusted sender or invalid payload.");
    return;
  }
  let cleanCode = rawCode;
  if (/^javascript:/i.test(cleanCode)) {
    try {
      cleanCode = decodeURIComponent(cleanCode.replace(/^javascript:/i, ""));
    } catch (_error) {
      console.warn("[Bookmarklet] Rejected malformed encoded payload.");
      return;
    }
  }
  contents.executeJavaScript(cleanCode).catch((error) => {
    console.error("[Bookmarklet] Execution failed:", error);
  });
});

ipcMain.on("native-browser-control", (event, payload) => {
  const contents = getTargetWebContents(event);
  if (!contents || !payload || typeof payload !== "object") return;
  switch (payload.action) {
    case "BACK":
      if (contents.canGoBack()) contents.goBack();
      break;
    case "FORWARD":
      if (contents.canGoForward()) contents.goForward();
      break;
    case "RELOAD":
      contents.reload();
      break;
    case "GOTO": {
      const safeUrl = parseSafeHttpUrl(payload.url);
      if (safeUrl) contents.loadURL(safeUrl);
      else console.warn("[Navigation] Rejected non-HTTP(S) URL.");
      break;
    }
    default:
      console.warn("[Navigation] Rejected unknown action.");
  }
});

ipcMain.on("native-user-agent-toggle", (event, payload) => {
  const contents = getTargetWebContents(event);
  if (!contents || !isValidUserAgent(payload && payload.uaString)) {
    console.warn("[UA Switcher] Rejected untrusted sender or invalid User-Agent.");
    return;
  }
  contents.setUserAgent(payload.uaString);
  contents.reload();
});

ipcMain.on("native-clear-cache-data", (event) => {
  const contents = getTargetWebContents(event);
  if (!contents) return;
  contents.session.clearStorageData()
    .then(() => {
      if (!contents.isDestroyed()) contents.reload();
    })
    .catch((error) => console.error("[Cache] Clear failed:", error));
});

ipcMain.on("native-set-proxy-config", (event, payload) => {
  const contents = getTargetWebContents(event);
  if (!contents || !payload || typeof payload !== "object") return;
  if (payload.enabled === false) {
    contents.session.setProxy({ mode: "direct" })
      .then(() => {
        if (!contents.isDestroyed()) contents.reload();
      })
      .catch((error) => console.error("[Proxy] Reset failed:", error));
    return;
  }
  if (!isValidProxyRules(payload.rules)) {
    console.warn("[Proxy] Rejected invalid proxy configuration.");
    return;
  }
  contents.session.setProxy({ proxyRules: payload.rules })
    .then(() => {
      if (!contents.isDestroyed()) contents.reload();
    })
    .catch((error) => console.error("[Proxy] Configuration failed:", error));
});


// LMLM is reached only through this loopback-only runtime URL. The renderer
// never receives model-provider credentials or an arbitrary network primitive.
function getLmlmRuntimeBaseUrl() {
  const configured = process.env.LMLM_RUNTIME_URL || "http://127.0.0.1:8765";
  try {
    const url = new URL(configured);
    const loopbackHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
    if (url.protocol !== "http:" || !loopbackHosts.has(url.hostname) ||
        url.username || url.password) return null;
    return url.toString().replace(/\/$/, "");
  } catch (_error) {
    return null;
  }
}

async function requestLmlm(pathname, options = {}, timeoutMs = 60000) {
  const baseUrl = getLmlmRuntimeBaseUrl();
  if (!baseUrl) throw new Error("LMLM runtime must use an HTTP loopback URL.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${pathname}`, {
      ...options,
      signal: controller.signal,
    });
    const raw = await response.text();
    if (raw.length > 150000) throw new Error("LMLM response exceeded the size limit.");
    let data = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch (_error) {
      throw new Error("LMLM runtime returned invalid JSON.");
    }
    if (!response.ok) {
      throw new Error(typeof data.detail === "string" ? data.detail : `LMLM runtime HTTP ${response.status}`);
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

ipcMain.handle("lmlm:get-status", async (event) => {
  if (!isTrustedUiSender(event)) return { available: false, providerConfigured: false };
  try {
    const status = await requestLmlm("/health", {}, 2500);
    return {
      available: status.status === "ok",
      providerConfigured: status.provider_configured === true,
      model: typeof status.model === "string" ? status.model : "",
    };
  } catch (_error) {
    return { available: false, providerConfigured: false };
  }
});

ipcMain.handle("lmlm:save-page", async (event) => {
  const contents = getTargetWebContents(event);
  if (!contents) return { ok: false, error: "Untrusted browser request." };
  try {
    const page = await contents.executeJavaScript(
      "(() => ({ title: String(document.title || '').slice(0, 300), " +
      "url: String(location.href || '').slice(0, 2048), " +
      "text: String(document.body?.innerText || '').slice(0, 30000) }))()"
    );
    if (!page.text || !page.text.trim()) {
      return { ok: false, error: "The active page has no readable text to save." };
    }
    const result = await requestLmlm("/v1/knowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        confirm_save: true,
        title: page.title || "Untitled page",
        source_url: page.url || "",
        content: page.text,
      }),
    });
    return { ok: true, id: result.id, title: result.title };
  } catch (error) {
    return { ok: false, error: error.message || "Could not save active page." };
  }
});

ipcMain.handle("lmlm:assist", async (event, payload) => {
  const contents = getTargetWebContents(event);
  if (!contents || !payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, error: "Untrusted browser request." };
  }
  if (typeof payload.prompt !== "string" ||
      !payload.prompt.trim() ||
      payload.prompt.length > 4000 ||
      typeof payload.includePageContext !== "boolean" ||
      typeof payload.useKnowledge !== "boolean") {
    return { ok: false, error: "Invalid LMLM request payload." };
  }

  let page = { title: "", url: "", text: "" };
  if (payload.includePageContext) {
    try {
      page = await contents.executeJavaScript(
        "(() => ({ title: String(document.title || '').slice(0, 300), " +
        "url: String(location.href || '').slice(0, 2048), " +
        "text: String(document.body?.innerText || '').slice(0, 12000) }))()"
      );
    } catch (_error) {
      return { ok: false, error: "Could not read the active page context." };
    }
  }

  try {
    const result = await requestLmlm("/v1/assist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: payload.prompt.trim(),
        page_title: page.title || "",
        page_url: page.url || "",
        page_text: page.text || "",
        use_knowledge: payload.useKnowledge,
      }),
    });
    return { ok: true, answer: result.answer };
  } catch (error) {
    return {
      ok: false,
      error: error.name === "AbortError" ? "LMLM request timed out." : error.message,
    };
  }
});

app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
