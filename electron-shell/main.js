const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("path");
const { isValidUserAgent } = require("./platform");

let mainWindow;
let targetWebpageView;

const MAX_BOOKMARKLET_LENGTH = 256 * 1024;
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

function isTrustedUiSender(event) {
  if (
    !mainWindow ||
    mainWindow.isDestroyed() ||
    event.sender !== mainWindow.webContents ||
    event.senderFrame !== event.sender.mainFrame
  ) return false;

  try {
    const frameUrl = new URL(event.senderFrame.url);
    return frameUrl.protocol === "http:" &&
      frameUrl.hostname === "localhost" &&
      frameUrl.port === "3000";
  } catch (_error) {
    return false;
  }
}

function isTrustedUiUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" &&
      url.hostname === "localhost" &&
      url.port === "3000";
  } catch (_error) {
    return false;
  }
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
  mainWindow.webContents.on("will-navigate", (event, navigationUrl) => {
    if (!isTrustedUiUrl(navigationUrl)) event.preventDefault();
  });

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

ipcMain.handle("execute-bookmarklet", async (event, payload) => {
  const contents = getTargetWebContents(event);
  if (
    !contents ||
    !payload ||
    typeof payload !== "object" ||
    typeof payload.title !== "string" ||
    !payload.title.trim() ||
    payload.title.length > 120 ||
    typeof payload.source !== "string" ||
    !payload.source.trim() ||
    payload.source.length > MAX_BOOKMARKLET_LENGTH ||
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(payload.source)
  ) {
    console.warn("[Bookmarklet] Rejected untrusted sender or invalid request.");
    return { ok: false, reason: "invalid-request" };
  }

  const initialUrl = parseSafeHttpUrl(contents.getURL());
  if (!initialUrl || !mainWindow || mainWindow.isDestroyed()) {
    return { ok: false, reason: "invalid-target" };
  }
  const targetOrigin = new URL(initialUrl).origin;
  const response = await dialog.showMessageBox(mainWindow, {
    type: "warning",
    title: "Run bookmarklet?",
    message: "Run “" + payload.title.trim() + "” on " + targetOrigin + "?",
    detail: "This script runs with the active page’s privileges. It may read or modify page content and access data available to scripts on this origin. Only continue if you trust the source.\\n\\nSource preview:\\n" + payload.source.slice(0, 600) + (payload.source.length > 600 ? "…" : ""),
    buttons: ["Cancel", "Run once"],
    defaultId: 0,
    cancelId: 0,
    noLink: true
  });
  if (response.response !== 1) return { ok: false, reason: "cancelled" };

  const currentUrl = parseSafeHttpUrl(contents.getURL());
  if (
    !currentUrl ||
    new URL(currentUrl).origin !== targetOrigin ||
    contents.isDestroyed()
  ) {
    return { ok: false, reason: "target-changed" };
  }

  try {
    await contents.executeJavaScript(payload.source, true);
    return { ok: true };
  } catch (error) {
    console.error("[Bookmarklet] Execution failed:", error);
    return { ok: false, reason: "execution-failed" };
  }
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
