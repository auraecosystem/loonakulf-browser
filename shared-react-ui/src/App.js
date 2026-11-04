import React, { useCallback, useEffect, useMemo, useState } from "react";
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
    label: "📱 iPad Safari",
    string:
      "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  },
};

const panelStyle = {
  background: "#fff",
  padding: "14px",
  marginBottom: "12px",
  borderRadius: "8px",
  border: "1px solid #ddd",
};
const buttonStyle = { padding: "7px 10px", cursor: "pointer" };

function normalizeNavigationUrl(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  const candidate = /^[a-z][a-z\d+.-]*:/i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url.toString();
  } catch (_error) {
    return null;
  }
}

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

  const appendToConsole = useCallback((type, message) => {
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
  }, []);

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
  }, [appendToConsole]);

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
      setEditError(result.error || "The script did not pass validation.");
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
    appendToConsole("info", "Bookmarklet updated.");
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
        const parsed = JSON.parse(String(reader.result || ""));
        if (parsed.version !== 1 || !Array.isArray(parsed.data)) {
          throw new Error("Unsupported backup format.");
        }
        for (const item of parsed.data) {
          if (
            typeof item.title !== "string" ||
            typeof item.rawCode !== "string"
          ) {
            continue;
          }
          const result = processAndValidateBookmarklet(item.rawCode);
          if (!result.isValid) continue;
          await db.bookmarklets.add({
            title: item.title,
            category: typeof item.category === "string" ? item.category : "General",
            rawCode: item.rawCode,
            cleanCode: result.cleanCode,
          });
        }
        appendToConsole("info", "Backup import completed; invalid records were skipped.");
      } catch (error) {
        appendToConsole("error", `Import failed: ${error.message}`);
      } finally {
        event.target.value = "";
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
  };

  const handleProxySubmit = (event) => {
    event.preventDefault();
    const port = Number(proxyPort);
    if (!proxyIp.trim() || !Number.isInteger(port) || port < 1 || port > 65535) {
      appendToConsole("error", "Enter a valid proxy host and port (1–65535).");
      return;
    }
    if (!window.browserAPI?.setProxyConfig) {
      appendToConsole("error", "Proxy control is unavailable in this environment.");
      return;
    }
    window.browserAPI.setProxyConfig({
      enabled: true,
      rules: `http=${proxyIp.trim()}:${port};https=${proxyIp.trim()}:${port}`,
    });
    setIsProxyActive(true);
    appendToConsole("info", "Proxy configuration requested.");
  };

  const handleInstantInject = (event) => {
    event.preventDefault();
    const result = processAndValidateBookmarklet(scratchpadCode);
    if (!result.isValid) {
      appendToConsole("error", result.error || "Script validation failed.");
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
          style={{ padding: 8 }}
        >
          {Object.entries(UA_PROFILES).map(([key, profile]) => (
            <option key={key} value={key}>{profile.label}</option>
          ))}
        </select>
      </section>

      <section style={panelStyle} aria-labelledby="platform-heading">
        <h2 id="platform-heading" style={{ marginTop: 0 }}>Platform intelligence</h2>
        {platform ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
            }}
          >
            <div><strong>Browser</strong><div>{platform.browser.name} {platform.browser.version || ""}</div></div>
            <div><strong>Engine</strong><div>{platform.engine.name} {platform.engine.version || ""}</div></div>
            <div><strong>Operating system</strong><div>{platform.os.name} {platform.os.version || ""}</div></div>
            <div><strong>Device</strong><div>{[platform.device.vendor, platform.device.model].filter(Boolean).join(" ") || "Unidentified"} ({platform.device.type})</div></div>
            <div><strong>CPU</strong><div>{platform.cpu.architecture || "Not exposed"}</div></div>
            <div><strong>Detection source</strong><div>{platform.browser.source}</div></div>
          </div>
        ) : <p>Detecting this runtime…</p>}
        {capabilities && (
          <p style={{ marginBottom: 0, color: "#5f6368" }}>
            Runtime: touch {capabilities.touch ? "yes" : "no"} · online {capabilities.online === null ? "unknown" : capabilities.online ? "yes" : "no"} · service worker {capabilities.serviceWorker ? "yes" : "no"} · Client Hints {capabilities.userAgentData ? "yes" : "no"}
          </p>
        )}
        <button
          type="button"
          style={buttonStyle}
          onClick={async () => {
            setHighEntropyEnabled(true);
            const hints = await getUserAgentClientHints(window.navigator, { includeHighEntropy: true });
            setPlatform(parseUserAgent(window.navigator.userAgent, hints || {}));
          }}
        >
          {highEntropyEnabled ? "Refresh detailed device hints" : "Request detailed device hints"}
        </button>
        <p style={{ color: "#6b7280", fontSize: 12, marginBottom: 0 }}>
          Diagnostic signals only. Detailed device hints are requested only after you select the button; User-Agent data is not device identity or an authorization signal.
        </p>
      </section>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 16,
        }}
      >
        <section>
          <div style={{ ...panelStyle, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button style={buttonStyle} onClick={handleExport}>📤 Export</button>
            <label style={{ ...buttonStyle, border: "1px solid #aaa", borderRadius: 4 }}>
              📥 Import
              <input type="file" accept="application/json,.json" onChange={handleImport} hidden />
            </label>
            <button style={buttonStyle} onClick={handleClearCache}>🗑️ Clear cache</button>
          </div>

          <form onSubmit={handleProxySubmit} style={panelStyle}>
            <h2 style={{ marginTop: 0 }}>Proxy</h2>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                aria-label="Proxy host"
                placeholder="Proxy host"
                value={proxyIp}
                onChange={(event) => setProxyIp(event.target.value)}
                style={{ flex: 1, minWidth: 0, padding: 7 }}
              />
              <input
                aria-label="Proxy port"
                placeholder="Port"
                value={proxyPort}
                onChange={(event) => setProxyPort(event.target.value)}
                style={{ width: 80, padding: 7 }}
              />
              <button type="submit" style={buttonStyle} disabled={isProxyActive}>Connect</button>
            </div>
            {isProxyActive && (
              <button
                type="button"
                style={{ ...buttonStyle, marginTop: 8 }}
                onClick={() => {
                  window.browserAPI?.setProxyConfig?.({ enabled: false });
                  setIsProxyActive(false);
                }}
              >
                Disconnect proxy
              </button>
            )}
          </form>

          <form onSubmit={handleInstantInject} style={panelStyle}>
            <h2 style={{ marginTop: 0 }}>Quick script</h2>
            <textarea
              aria-label="Quick script payload"
              placeholder="Paste a bookmarklet or JavaScript payload…"
              value={scratchpadCode}
              onChange={(event) => setScratchpadCode(event.target.value)}
              rows={4}
              style={{ width: "100%", boxSizing: "border-box" }}
            />
            <button type="submit" style={{ ...buttonStyle, marginTop: 8 }}>Validate and run</button>
          </form>

          <form onSubmit={handleSave} style={panelStyle}>
            <h2 style={{ marginTop: 0 }}>Create bookmarklet</h2>
            <input
              placeholder="Title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              style={{ width: "100%", boxSizing: "border-box", marginBottom: 8, padding: 8 }}
            />
            <input
              placeholder="Category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              style={{ width: "100%", boxSizing: "border-box", marginBottom: 8, padding: 8 }}
            />
            <textarea
              placeholder="Paste payload raw code…"
              value={rawCode}
              onChange={(event) => setRawCode(event.target.value)}
              required
              rows={5}
              style={{ width: "100%", boxSizing: "border-box" }}
            />
            {validationError && <p role="alert" style={{ color: "#b42318" }}>{validationError}</p>}
            <button type="submit" style={{ ...buttonStyle, marginTop: 8 }}>Save bookmarklet</button>
          </form>
        </section>

        <section style={panelStyle}>
          <h2 style={{ marginTop: 0 }}>Bookmarklet library</h2>
          <input
            aria-label="Search bookmarklets"
            placeholder="Search by title…"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            style={{ width: "100%", boxSizing: "border-box", padding: 8, marginBottom: 8 }}
          />
          <select
            aria-label="Filter bookmarklets by category"
            value={selectedCategory}
            onChange={(event) => setSelectedCategory(event.target.value)}
            style={{ width: "100%", padding: 8, marginBottom: 10 }}
          >
            {categories.map((value) => <option key={value} value={value}>{value === "ALL" ? "All categories" : value}</option>)}
          </select>
          {filtered.length === 0 && <p>No bookmarklets match this filter.</p>}
          <div style={{ maxHeight: 520, overflowY: "auto" }}>
            {filtered.map((item) => (
              <article key={item.id} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: 10, marginBottom: 8 }}>
                {editingId === item.id ? (
                  <form onSubmit={handleUpdate}>
                    <input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} required style={{ width: "100%", marginBottom: 6 }} />
                    <input value={editCategory} onChange={(event) => setEditCategory(event.target.value)} style={{ width: "100%", marginBottom: 6 }} />
                    <textarea value={editRawCode} onChange={(event) => setEditRawCode(event.target.value)} required rows={4} style={{ width: "100%" }} />
                    {editError && <p role="alert" style={{ color: "#b42318" }}>{editError}</p>}
                    <button type="submit" style={buttonStyle}>Save changes</button>
                    <button type="button" style={buttonStyle} onClick={() => setEditingId(null)}>Cancel</button>
                  </form>
                ) : (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                      <strong>{item.title}</strong>
                      <span style={{ color: "#6b7280", fontSize: 12 }}>{item.category || "General"}</span>
                    </div>
                    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                      <button style={buttonStyle} onClick={() => handleExecute(item.cleanCode)}>Run</button>
                      <button
                        style={buttonStyle}
                        onClick={() => {
                          setEditingId(item.id);
                          setEditTitle(item.title);
                          setEditCategory(item.category || "General");
                          setEditRawCode(item.rawCode);
                          setEditError("");
                        }}
                      >
                        Edit
                      </button>
                      <button
                        style={buttonStyle}
                        onClick={async () => {
                          if (window.confirm(`Delete “${item.title}” from local storage?`)) {
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
          </div>
        </section>
      </div>

      <section style={{ ...panelStyle, background: "#1e1e1e", color: "#d1fae5" }}>
        <h2 style={{ marginTop: 0, color: "#fff" }}>Activity console</h2>
        <div style={{ maxHeight: 180, overflowY: "auto", fontFamily: "monospace", fontSize: 12 }}>
          {logs.length === 0 ? <p>No activity yet.</p> : logs.map((log) => (
            <div key={log.id} style={{ marginBottom: 5 }}>
              [{log.timestamp}] {String(log.type).toUpperCase()}: {log.text}
            </div>
          ))}
        </div>
      </section>
      <footer style={{ color: "#6b7280", fontSize: 12 }}>
        Current page: {currentUrl}
      </footer>
    </main>
  );
}
