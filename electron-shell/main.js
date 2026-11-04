const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { isValidUserAgent } = require("./platform");

app.setName("Loonakulf Browser");

let mainWindow;
let targetWebpageView;

const MAX_BOOKMARKLET_LENGTH = 256 * 1024;
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
const LOONAKULF_UA_TOKEN = "Loonakulf/1.0.0";

function withLoonakulfIdentity(userAgent) {
  const value = typeof userAgent === "string" ? userAgent.trim() : "";
  if (!value || /\\bLoonakulf\\//i.test(value)) return value;
  return value + " " + LOONAKULF_UA_TOKEN;
}

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
    title: "Loonakulf Browser",
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

  targetWebpageView.webContents.setUserAgent(
    withLoonakulfIdentity(targetWebpageView.webContents.getUserAgent())
  );
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
  contents.setUserAgent(withLoonakulfIdentity(payload.uaString));
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
