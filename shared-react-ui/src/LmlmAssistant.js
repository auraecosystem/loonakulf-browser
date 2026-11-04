import React, { useEffect, useState } from "react";

const panelStyle = {
  background: "#fff",
  border: "1px solid #d7dce2",
  borderRadius: 8,
  padding: 14,
  marginBottom: 12,
};

const buttonStyle = {
  padding: "8px 12px",
  border: "1px solid #aeb7c2",
  borderRadius: 5,
  background: "#f8fafc",
  cursor: "pointer",
};

export default function LmlmAssistant({ currentUrl }) {
  const [prompt, setPrompt] = useState("");
  const [includePage, setIncludePage] = useState(false);
  const [status, setStatus] = useState("checking");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const check = async () => {
      if (!window.browserAPI?.getLmlmStatus) {
        if (active) setStatus("unavailable");
        return;
      }
      try {
        const result = await window.browserAPI.getLmlmStatus();
        if (active) {
          setStatus(!result?.available ? "offline" : result.providerConfigured ? "ready" : "not-configured");
        }
      } catch (_error) {
        if (active) setStatus("offline");
      }
    };
    check();
    return () => {
      active = false;
    };
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    if (!prompt.trim() || busy) return;
    if (!window.browserAPI?.askLmlm) {
      setError("The LMLM native bridge is unavailable in this shell.");
      return;
    }

    setBusy(true);
    setError("");
    setAnswer("");
    try {
      const result = await window.browserAPI.askLmlm({
        prompt: prompt.trim(),
        includePageContext: includePage,
      });
      if (!result?.ok) {
        throw new Error(result?.error || "LMLM request failed.");
      }
      setAnswer(result.answer);
    } catch (requestError) {
      setError(requestError.message || "LMLM request failed.");
    } finally {
      setBusy(false);
    }
  };

  const statusText = {
    checking: "Checking LMLM runtime…",
    ready: "LMLM runtime connected",
    "not-configured": "Runtime online; configure an inference provider",
    offline: "LMLM runtime offline",
    unavailable: "Native LMLM bridge unavailable in this shell",
  }[status];

  return (
    <section style={panelStyle} aria-labelledby="lmlm-heading">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 id="lmlm-heading" style={{ margin: "0 0 4px" }}>LMLM Intelligence</h2>
          <p style={{ margin: 0, color: "#667085", fontSize: 13 }}>{statusText}</p>
        </div>
        <span style={{ color: "#667085", fontSize: 12 }}>Persona: Roda</span>
      </div>

      <form onSubmit={submit} style={{ marginTop: 12 }}>
        <label htmlFor="lmlm-prompt" style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>
          Ask Roda
        </label>
        <textarea
          id="lmlm-prompt"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          rows={3}
          maxLength={4000}
          placeholder="Ask a question about a topic or the current website…"
          style={{ width: "100%", boxSizing: "border-box", padding: 9, resize: "vertical" }}
        />
        <label style={{ display: "flex", alignItems: "flex-start", gap: 8, margin: "9px 0", fontSize: 13 }}>
          <input
            type="checkbox"
            checked={includePage}
            onChange={(event) => setIncludePage(event.target.checked)}
          />
          <span>
            Include active page text in this request
            <span style={{ display: "block", color: "#667085" }}>
              Sends the page title, URL and up to 12,000 characters of visible text to the configured model provider.
            </span>
          </span>
        </label>
        <button type="submit" style={buttonStyle} disabled={busy || !prompt.trim()}>
          {busy ? "Thinking…" : "Ask LMLM"}
        </button>
        {currentUrl && (
          <span style={{ marginLeft: 10, color: "#667085", fontSize: 12 }}>
            Active tab: {currentUrl}
          </span>
        )}
      </form>

      {error && <p role="alert" style={{ color: "#b42318", whiteSpace: "pre-wrap" }}>{error}</p>}
      {answer && (
        <div style={{ marginTop: 12, padding: 12, background: "#f8fafc", borderRadius: 6 }}>
          <strong>Roda&gt;</strong>
          <p style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>{answer}</p>
        </div>
      )}
    </section>
  );
}
