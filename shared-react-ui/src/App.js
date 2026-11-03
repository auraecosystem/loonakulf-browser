import React, { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db";
import {
  processAndValidateBookmarklet,
  auditScriptSecurityRisks,
} from "./parser";
import {
  parseUserAgent,
  detectCapabilities,
} from "./platform/ua-parser";

const UA_PROFILES = {
  DESKTOP_CHROME: {
    label: "Desktop Chrome",
    string:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  },
  IPHONE_CHROME: {
    label: "iPhone Chrome (iOS 27)",
    string:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 27_0_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/155.0.8059.37 Mobile/15E148 Safari/604.1",
  },
  IPHONE_SAFARI: {
    label: "iPhone Safari",
    string:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  },
  IPAD_SAFARI: {
    label: "iPad Safari",
    string:
      "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  },
};

const panelStyle = {
  background: "#fff",
  border: "1px solid #ddd",
  borderRadius: 8,
  padding: 12,
  marginBottom: 12,
};

export default function App() {
  const [currentUrl, setCurrentUrl] = useState("https://example.com");
  const [inputUrl, setInputUrl] = useState("https://example.com");
  const [activeUaKey, setActiveUaKey] = useState("DESKTOP_CHROME");
  const [logs, setLogs] = useState([]);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("General");
  const [rawCode, setRawCode] = useState("");
  const [validationError, setValidationError] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editRawCode, setEditRawCode] = useState("");
  const [editError, setEditError] = useState("");
  const [scratchpadCode, setScratchpadCode] = useState("");
  const [proxyIp, setProxyIp] = useState("");
  const [proxyPort, setProxyPort] = useState("");
  const [isProxyActive, setIsProxyActive] = useState(false);
  const bookmarklets = useLiveQuery(() => db.bookmarklets.toArray(), []) || [];

  const actualUa = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const detectedPlatform = useMemo(() => parseUserAgent(actualUa), [actualUa]);
  const capabilities = useMemo(
    () => detectCapabilities(typeof window !== "undefined" ? window : null),
    []
  );

  const appendToConsole = (type, message) => {
    setLogs((previous) =>
      [
        {
          id: Date.now() + Math.random(),
          timestamp: new Date().toLocaleTimeString(),
          type,
          text: String(message),
        },
        ...previous,
      ].slice(0, 50)
    );
  };

  useEffect(() => {
    const handleAddress = (url) => {
      setCurrentUrl(url);
      setInputUrl(url);
    };
    const handleNativeLogs = (event) => {
      const payload = event.data;
      if (payload && payload.type === "NATIVE_CONSOLE_LOG") {
        appendToConsole(payload.logType || "log", payload.message || "");
      }
    };

    window.updateBrowserAddressBar = handleAddress;
    window.addEventListener("message", handleNativeLogs);
    const removeUrlListener = window.browserAPI?.onTargetUrlChanged?.(handleAddress);
    const removeLogListener = window.browserAPI?.onRuntimeConsoleLog?.((entry) =>
      appendToConsole(entry.type || "log", entry.message || "")
    );

    return () => {
      window.removeEventListener("message", handleNativeLogs);
      if (typeof removeUrlListener === "function") removeUrlListener();
      if (typeof removeLogListener === "function") removeLogListener();
      delete window.updateBrowserAddressBar;
    };
  }, []);

  const handleExecute = (code) => {
    const audit = auditScriptSecurityRisks(code);
    if (
      audit.isHighRisk &&
      !window.confirm(
        "SECURITY WARNING\n\n" +
          audit.warnings.join("\n\n") +
          "\n\nRun this script anyway?"
      )
    ) {
      return;
    }

    if (window.webkit?.messageHandlers?.bookmarkletBridge) {
      window.webkit.messageHandlers.bookmarkletBridge.postMessage(code);
    } else if (window.browserAPI?.runBookmarklet) {
      window.browserAPI.runBookmarklet(code);
    } else if (window.pyqtBridge?.execute) {
      window.pyqtBridge.execute(code);
    } else {
      appendToConsole("info", "No native browser bridge is connected.");
    }
  };

  const sendNavAction = (action, targetUrl = null) => {
    if (action === "GOTO" && targetUrl) {
      const destination = /^(https?:\/\/)/i.test(targetUrl)
        ? targetUrl
        : "https://" + targetUrl;
      setCurrentUrl(destination);
      setInputUrl(destination);
      window.browserAPI?.sendNavAction?.({
        type: "BROWSER_ACTION",
        action,
        url: destination,
      });
      return;
    }
    window.browserAPI?.sendNavAction?.({ type: "BROWSER_ACTION", action });
  };

  const handleUaChange = (key) => {
    const profile = UA_PROFILES[key];
    if (!profile) return;
    setActiveUaKey(key);
    window.browserAPI?.setUserAgent?.({
      type: "SET_USER_AGENT",
      uaString: profile.string,
    });
  };

  const handleSave = async (event) => {
    event.preventDefault();
    const result = processAndValidateBookmarklet(rawCode);
    if (!result.isValid) {
      setValidationError(result.error);
      return;
    }
    await db.bookmarklets.add({
      title: title.trim(),
      category: category.trim() || "General",
      rawCode,
      cleanCode: result.cleanCode,
    });
    setTitle("");
    setRawCode("");
    setValidationError("");
  };

  const handleUpdate = async (event) => {
    event.preventDefault();
    const result = processAndValidateBookmarklet(editRawCode);
    if (!result.isValid) {
      setEditError(result.error);
      return;
    }
    await db.bookmarklets.update(editingId, {
      title: editTitle.trim(),
      category: editCategory.trim() || "General",
      rawCode: editRawCode,
      cleanCode: result.cleanCode,
    });
    setEditingId(null);
    setEditError("");
  };

  const handleExport = async () => {
    const records = await db.bookmarklets.toArray();
    const blob = new Blob(
      [JSON.stringify({ version: 1, data: records }, null, 2)],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "loonakulf-bookmarklets.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!Array.isArray(parsed.data)) {
          throw new Error("Backup must contain a data array.");
        }
        const records = parsed.data
          .filter(
            (item) =>
              item &&
              typeof item.title === "string" &&
              typeof item.rawCode === "string"
          )
          .map((item) => ({
            title: item.title,
            category:
              typeof item.category === "string" ? item.category : "General",
            rawCode: item.rawCode,
            cleanCode:
              typeof item.cleanCode === "string" ? item.cleanCode : item.rawCode,
          }));
        await db.bookmarklets.bulkAdd(records);
        appendToConsole("info", "Imported " + records.length + " bookmarklets.");
      } catch (error) {
        appendToConsole("error", "Import failed: " + error.message);
      }
      event.target.value = "";
    };
    reader.readAsText(file);
  };

  const handleProxySubmit = (event) => {
    event.preventDefault();
    const port = Number(proxyPort);
    if (!proxyIp.trim() || !Number.isInteger(port) || port < 1 || port > 65535) {
      appendToConsole("error", "Enter a valid proxy host and port.");
      return;
    }
    window.browserAPI?.setProxyConfig?.({
      enabled: true,
      rules: "http=" + proxyIp.trim() + ":" + port + ";https=" + proxyIp.trim() + ":" + port,
    });
    setIsProxyActive(true);
  };

  const handleClearCache = () => {
    window.browserAPI?.clearCacheData?.();
  };

  const handleInstantInject = () => {
    const result = processAndValidateBookmarklet(scratchpadCode);
    if (!result.isValid) {
      appendToConsole("error", result.error);
      return;
    }
    handleExecute(result.cleanCode);
  };

  const filtered = bookmarklets.filter(
    (item) =>
      (selectedCategory === "ALL" || item.category === selectedCategory) &&
      item.title.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const categories = [
    "ALL",
    ...new Set(bookmarklets.map((item) => item.category).filter(Boolean)),
  ];

  return (
    <main
      style={{
        fontFamily: "system-ui, sans-serif",
        padding: 20,
        maxWidth: 1200,
        margin: "0 auto",
        background: "#f8f9fa",
        color: "#212529",
        minHeight: "100vh",
      }}
    >
      <h1>Loonakulf Browser</h1>
      <section style={{ ...panelStyle, display: "flex", gap: 8, alignItems: "center" }}>
        <button type="button" onClick={() => sendNavAction("BACK")}>Back</button>
        <button type="button" onClick={() => sendNavAction("FORWARD")}>Forward</button>
        <button type="button" onClick={() => sendNavAction("RELOAD")}>Reload</button>
        <input
          aria-label="Address"
          style={{ flex: 1, minWidth: 100, padding: 8 }}
          value={inputUrl}
          onChange={(event) => setInputUrl(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") sendNavAction("GOTO", inputUrl);
          }}
        />
        <button type="button" onClick={() => sendNavAction("GOTO", inputUrl)}>Go</button>
        <select
          aria-label="User-Agent profile"
          value={activeUaKey}
          onChange={(event) => handleUaChange(event.target.value)}
        >
          {Object.entries(UA_PROFILES).map(([key, profile]) => (
            <option key={key} value={key}>{profile.label}</option>
          ))}
        </select>
      </section>

      <section style={panelStyle}>
        <h2>Detected platform</h2>
        <p>
          <strong>{detectedPlatform.browser.name}</strong>{" "}
          {detectedPlatform.browser.version || "version unknown"} ·{" "}
          {detectedPlatform.os.name} {detectedPlatform.os.version || ""} ·{" "}
          {detectedPlatform.device.vendor || "Device unknown"}{" "}
          {detectedPlatform.device.model || ""}
        </p>
        <p>
          Rendering engine: {detectedPlatform.engine.name}{" "}
          {detectedPlatform.engine.version || ""} · Device class:{" "}
          {detectedPlatform.device.type}
        </p>
        <p>
          Capabilities: touch {capabilities.touch === null ? "unknown" : capabilities.touch ? "yes" : "no"} ·
          online {capabilities.online === null ? "unknown" : capabilities.online ? "yes" : "no"} ·
          service worker {capabilities.serviceWorker ? "yes" : "no"}
        </p>
        <details>
          <summary>Raw User-Agent</summary>
          <code style={{ overflowWrap: "anywhere" }}>{actualUa || "Unavailable"}</code>
        </details>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
        <section>
          <div style={{ ...panelStyle, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={handleExport}>Export</button>
            <label>
              Import <input type="file" accept="application/json" onChange={handleImport} />
            </label>
            <button type="button" onClick={handleClearCache}>Clear Cache</button>
          </div>

          <form onSubmit={handleProxySubmit} style={panelStyle}>
            <h2>Proxy</h2>
            <input
              aria-label="Proxy host"
              placeholder="Proxy host or IP"
              value={proxyIp}
              onChange={(event) => setProxyIp(event.target.value)}
              required
            />
            <input
              aria-label="Proxy port"
              placeholder="Port"
              inputMode="numeric"
              value={proxyPort}
              onChange={(event) => setProxyPort(event.target.value)}
              required
            />
            <button type="submit" disabled={isProxyActive}>Connect</button>
            {isProxyActive && (
              <button
                type="button"
                onClick={() => {
                  window.browserAPI?.setProxyConfig?.({ enabled: false });
                  setIsProxyActive(false);
                }}
              >
                Disconnect
              </button>
            )}
          </form>

          <section style={panelStyle}>
            <h2>Quick script</h2>
            <textarea
              aria-label="Quick script payload"
              value={scratchpadCode}
              onChange={(event) => setScratchpadCode(event.target.value)}
              rows={4}
              style={{ width: "100%" }}
            />
            <button type="button" onClick={handleInstantInject}>Validate and run</button>
          </section>

          <form onSubmit={handleSave} style={panelStyle}>
            <h2>Create bookmarklet</h2>
            <input
              placeholder="Title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
            <input
              placeholder="Category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            />
            <textarea
              placeholder="Paste JavaScript or bookmarklet code"
              value={rawCode}
              onChange={(event) => setRawCode(event.target.value)}
              rows={6}
              required
              style={{ width: "100%" }}
            />
            {validationError && <p role="alert">{validationError}</p>}
            <button type="submit">Save bookmarklet</button>
          </form>
        </section>

        <section>
          <div style={panelStyle}>
            <h2>Bookmarklets</h2>
            <input
              placeholder="Search by title"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              style={{ width: "100%", boxSizing: "border-box" }}
            />
            <select
              aria-label="Filter category"
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
            >
              {categories.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            {filtered.map((item) => (
              <article key={item.id} style={{ borderTop: "1px solid #ddd", padding: "12px 0" }}>
                {editingId === item.id ? (
                  <form onSubmit={handleUpdate}>
                    <input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} required />
                    <input value={editCategory} onChange={(event) => setEditCategory(event.target.value)} />
                    <textarea value={editRawCode} onChange={(event) => setEditRawCode(event.target.value)} rows={5} required />
                    {editError && <p role="alert">{editError}</p>}
                    <button type="submit">Update</button>
                    <button type="button" onClick={() => setEditingId(null)}>Cancel</button>
                  </form>
                ) : (
                  <>
                    <strong>{item.title}</strong> <small>({item.category})</small>
                    <div>
                      <button type="button" onClick={() => handleExecute(item.cleanCode)}>Run</button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(item.id);
                          setEditTitle(item.title);
                          setEditCategory(item.category);
                          setEditRawCode(item.rawCode);
                          setEditError("");
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (window.confirm("Delete this bookmarklet?")) {
                            await db.bookmarklets.delete(item.id);
                          }
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </article>
            ))}
            {filtered.length === 0 && <p>No bookmarklets found.</p>}
          </div>

          <section style={{ ...panelStyle, background: "#1e1e1e", color: "#00ff00", fontFamily: "monospace" }}>
            <h2>Activity console</h2>
            <div style={{ maxHeight: 180, overflowY: "auto" }}>
              {logs.map((entry) => (
                <p key={entry.id}>
                  [{entry.timestamp}] {entry.type.toUpperCase()}: {entry.text}
                </p>
              ))}
              {logs.length === 0 && <p>Waiting for browser events…</p>}
            </div>
          </section>
        </section>
      </div>
      <p><small>Current page: {currentUrl}</small></p>
    </main>
  );
}
