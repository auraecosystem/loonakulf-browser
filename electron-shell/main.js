const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("path");
const { isValidUserAgent } = require("./platform");

let mainWindow;
let targetWebpageView;

const MAX_BOOKMARKLET_LENGTH = 256 * 1024;
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

function isTrustedUiSender(event) {
  return Boolean(
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

  mainWindow.loadURL("http://localhost:3000");
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

ipcMain.on("execute-bookmarklet", async (event, rawCode) => {
  const contents = getTargetWebContents(event);
  if (!contents || typeof rawCode !== "string" || rawCode.length === 0 || rawCode.length > MAX_BOOKMARKLET_LENGTH) {
    console.warn("[Bookmarklet] Rejected untrusted sender or invalid payload.");
    return;
  }

  let cleanCode = rawCode.trim();
  if (/^javascript:/i.test(cleanCode)) {
    cleanCode = cleanCode.slice("javascript:".length).trim();
  }
  if (!cleanCode || /[\u0000]/.test(cleanCode)) {
    console.warn("[Bookmarklet] Rejected empty or malformed source.");
    return;
  }
  const targetUrl = contents.getURL();
  let targetOrigin = "the active page";
  try { targetOrigin = new URL(targetUrl).origin; } catch (_error) { /* retain generic label */ }

  // Consent is enforced in the native process, not only by renderer UI.
  const response = await dialog.showMessageBox(mainWindow, {
    type: "warning",
    title: "Run bookmarklet?",
    message: "This bookmarklet will execute in the active page.",
    detail: `Target: ${targetOrigin}\n\nBookmarklets can read and modify page content and use the page's privileges. Only continue if you trust this source.`,
    buttons: ["Cancel", "Run bookmarklet"],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  });
  if (response.response !== 1 || contents.isDestroyed() || getTargetWebContents(event) !== contents) {
    console.info("[Bookmarklet] Execution cancelled or target changed.");
    return;
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

app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
