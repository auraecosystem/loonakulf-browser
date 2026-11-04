import React, { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db";
import { validateBookmarkletRequest } from "./bookmarks/runtime";
import {
  auditScriptSecurityRisks,
  processAndValidateBookmarklet,
} from "./parser";
import {
  detectCapabilities,
  getUserAgentClientHints,
  parseUserAgent,
} from "./platform";

const UA_PROFILES = {
  DESKTOP_CHROME: {
    label: "🖥️ Desktop Chrome",
    string:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  },
  IPHONE_CHROME: {
    label: "📱 iPhone Chrome (iOS)",
    string:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/155.0.8059.37 Mobile/15E148 Safari/604.1",
  },
  IPHONE_SAFARI: {
    label: "🍏 iPhone Safari",
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
  const [editCategory, setEditCategory] = useState("General");
  const [editRawCode, setEditRawCode] = useState("");
  const [editError, setEditError] = useState("");
  const [scratchpadCode, setScratchpadCode] = useState("");
  const [proxyIp, setProxyIp] = useState("");
  const [proxyPort, setProxyPort] = useState("");
  const [isProxyActive, setIsProxyActive] = useState(false);
  const [platform, setPlatform] = useState(null);
  const [capabilities, setCapabilities] = useState(null);
  const [highEntropyEnabled, setHighEntropyEnabled] = useState(false);

  const bookmarklets = useLiveQuery(() => db.bookmarklets.toArray(), []) || [];
  const categories = useMemo(
    () => ["ALL", ...new Set(bookmarklets.map((item) => item.category || "General"))],
    [bookmarklets],
  );
  const filtered = useMemo(
    () =>
      bookmarklets.filter(
        (item) =>
          (selectedCategory === "ALL" ||
            (item.category || "General") === selectedCategory) &&
          String(item.title || "")
            .toLowerCase()
            .includes(searchQuery.toLowerCase()),
      ),
    [bookmarklets, selectedCategory, searchQuery],
  );

  const appendToConsole = (type, message) => {
    setLogs((previous) =>
      [
        {
          id: `${Date.now()}-${Math.random()}`,
          timestamp: new Date().toLocaleTimeString(),
          type,
          text: String(message),
        },
        ...previous,
      ].slice(0, 50),
    );
  };

  useEffect(() => {
    let active = true;
    const refreshPlatform = async (includeHighEntropy = false) => {
      const hints = await getUserAgentClientHints(window.navigator, { includeHighEntropy });
      if (!active) return;
      setPlatform(parseUserAgent(window.navigator.userAgent, hints || {}));
      setCapabilities(detectCapabilities(window));
    };
    refreshPlatform(false);
    const handleOnline = () => setCapabilities(detectCapabilities(window));
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOnline);
    const handleNativeLogs = (event) => {
      if (event.data?.type === "NATIVE_CONSOLE_LOG") {
        appendToConsole(event.data.logType, event.data.message);
      }
    };
    window.addEventListener("message", handleNativeLogs);
    window.updateBrowserAddressBar = (url) => {
      setCurrentUrl(url);
      setInputUrl(url);
    };

    // Qt WebChannel requires its small client library before the registered
    // QObject can be accessed from the React page.
    let pyqtChannelScript = null;
    const connectPyQtChannel = () => {
      if (!active || !window.qt?.webChannelTransport || !window.QWebChannel) return;
      new window.QWebChannel(window.qt.webChannelTransport, (channel) => {
        if (active) window.pyqtBridge = channel.objects.pyqtBridge;
      });
    };
    if (window.qt?.webChannelTransport && !window.QWebChannel) {
      pyqtChannelScript = document.createElement("script");
      pyqtChannelScript.src = "qrc:///qtwebchannel/qwebchannel.js";
      pyqtChannelScript.onload = connectPyQtChannel;
      document.head.appendChild(pyqtChannelScript);
    } else {
      connectPyQtChannel();
    }

    return () => {
      active = false;
      pyqtChannelScript?.remove();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOnline);
      window.removeEventListener("message", handleNativeLogs);
      delete window.updateBrowserAddressBar;
      delete window.pyqtBridge;
    };
  }, []);

  const handleExecute = async (code, scriptTitle = "Quick script") => {
    const checked = validateBookmarkletRequest({ title: scriptTitle, source: code });
    if (!checked.valid) {
      appendToConsole("error", checked.error);
      return;
    }

    const request = checked.request;
    const audit = auditScriptSecurityRisks(request.source);
    if (audit.findings.length) {
      appendToConsole(
        "warning",
        "Static review findings (not a safety verdict): " +
          audit.warnings.join(" "),
      );
    }

    // Native shells display the authoritative confirmation dialog and validate
    // the active page again immediately before execution.
    if (window.webkit?.messageHandlers?.bookmarkletBridge) {
      window.webkit.messageHandlers.bookmarkletBridge.postMessage(request);
    } else if (window.browserAPI?.runBookmarklet) {
      try {
        const result = await window.browserAPI.runBookmarklet(request);
        appendToConsole(
          result?.ok ? "info" : "warning",
          result?.ok ? "Bookmarklet executed." : "Bookmarklet was not executed: " + (result?.reason || "request rejected"),
        );
      } catch (error) {
        appendToConsole("error", "Bookmarklet bridge failed: " + error.message);
      }
    } else if (window.pyqtBridge?.execute) {
      window.pyqtBridge.execute(JSON.stringify(request));
    } else {
      appendToConsole("info", "No native execution bridge; script was not executed.");
    }
  };

  const sendNavAction = (action, targetUrl) => {
    if (action === "GOTO") {
      const safeUrl = normalizeNavigationUrl(targetUrl);
      if (!safeUrl) {
        appendToConsole("error", "Only valid HTTP and HTTPS navigation URLs are allowed.");
        return;
      }
      if (window.browserAPI?.sendNavAction) {
        window.browserAPI.sendNavAction({ action, url: safeUrl });
      } else {
        appendToConsole("info", "Navigation bridge is unavailable in this environment.");
      }
      setCurrentUrl(safeUrl);
      setInputUrl(safeUrl);
      return;
    }
    window.browserAPI?.sendNavAction?.({ action });
  };

  const handleUaChange = (key) => {
    setActiveUaKey(key);
    window.browserAPI?.setUserAgent?.({
      uaString: UA_PROFILES[key].string,
    });
  };

  const handleSave = async (event) => {
    event.preventDefault();
    const result = processAndValidateBookmarklet(rawCode);
    if (!result.isValid) {
      setValidationError(result.error || "The script did not pass validation.");
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
    appendToConsole("info", "Bookmarklet saved locally.");
  };

  const handleUpdate = async (event) => {
    event.preventDefault();
    const result = processAndValidateBookmarklet(editRawCode);
    if (!result.isValid) {
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
      { type: "application/json" },
    );
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = "loonakulf-bookmarklets-backup.json";
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  };

  const handleImport = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
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
    };
    reader.readAsText(file);
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
    handleExecute(result.cleanCode, "Quick script");
  };

  const handleClearCache = () => {
    window.browserAPI?.clearCacheData?.();
    appendToConsole("info", "Cache clear requested.");
  };

  return (
    <main
      style={{
        fontFamily: "system-ui, sans-serif",
        padding: 20,
        maxWidth: 1200,
        margin: "0 auto",
        background: "#f8f9fa",
        minHeight: "100vh",
        color: "#202124",
      }}
    >
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ margin: "0 0 4px" }}>Loonakulf Browser</h1>
        <p style={{ margin: 0, color: "#5f6368" }}>
          Your bookmarklet workspace — create, inspect, organize and run personal web tools on the active page
        </p>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 16,
        }}
      >
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
                      <button style={buttonStyle} onClick={() => handleExecute(item.cleanCode, item.title)}>Run</button>
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


      </div>

      <details style={{ ...panelStyle, marginTop: 16 }}>
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>
          Browser navigation and platform diagnostics
        </summary>
        <div style={{ marginTop: 12 }}>
      <section
        style={{
          ...panelStyle,
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          alignItems: "center",
        }}
      >
        <button style={buttonStyle} onClick={() => sendNavAction("BACK")}>◀</button>
        <button style={buttonStyle} onClick={() => sendNavAction("FORWARD")}>▶</button>
        <button style={buttonStyle} onClick={() => sendNavAction("RELOAD")}>↻</button>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            sendNavAction("GOTO", inputUrl);
          }}
          style={{ display: "flex", flex: "1 1 320px", gap: 6 }}
        >
          <input
            aria-label="Website address"
            style={{ flex: 1, minWidth: 120, padding: 8 }}
            value={inputUrl}
            onChange={(event) => setInputUrl(event.target.value)}
          />
          <button style={buttonStyle} type="submit">Go</button>
        </form>
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

        </div>
      </details>



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
