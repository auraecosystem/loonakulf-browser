import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { processAndValidateBookmarklet, auditScriptSecurityRisks } from './parser';

const UA_PROFILES = {
  DESKTOP_CHROME: { label: "🖥️ Desktop Chrome", string: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36" },
  IPHONE_CHROME: { label: "📱 iPhone Chrome (iOS 27)", string: "Mozilla/5.0 (iPhone; CPU iPhone OS 27_0_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/155.0.8059.37 Mobile/15E148 Safari/604.1" },
  IPHONE_SAFARI: { label: "🍏 iPhone Safari", string: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1" }
};

export default function App() {
  const [currentUrl, setCurrentUrl] = useState('https://example.com');
  const [inputUrl, setInputUrl] = useState('https://example.com');
  const [activeUaKey, setActiveUaKey] = useState('DESKTOP_CHROME');
  const [logs, setLogs] = useState([]);
  
  // Storage Forms State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('General');
  const [rawCode, setRawCode] = useState('');
  const [validationError, setValidationError] = useState(null);
  
  // Filters & Editing States
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editRawCode, setEditRawCode] = useState('');
  const [editError, setEditError] = useState(null);
  const [scratchpadCode, setScratchpadCode] = useState('');

  // Proxy States
  const [proxyIp, setProxyIp] = useState('');
  const [proxyPort, setProxyPort] = useState('');
  const [isProxyActive, setIsProxyActive] = useState(false);

  const bookmarklets = useLiveQuery(() => db.bookmarklets.toArray()) || [];

  useEffect(() => {
    window.updateBrowserAddressBar = (url) => { setCurrentUrl(url); setInputUrl(url); };
    const handleNativeLogs = (e) => {
      if (e.data && e.data.type === 'NATIVE_CONSOLE_LOG') appendToConsole(e.data.logType, e.data.message);
    };
    window.addEventListener('message', handleNativeLogs);
    return () => window.removeEventListener('message', handleNativeLogs);
  }, []);

  const appendToConsole = (type, message) => {
    setLogs(prev => [{ id: Math.random(), timestamp: new Date().toLocaleTimeString(), type, text: String(message) }, ...prev].slice(0, 50));
  };

  const handleExecute = (code) => {
    const securityAudit = auditScriptSecurityRisks(code);
    if (securityAudit.isHighRisk && !window.confirm(`🛡️ SECURITY SHIELD WARNING:\n\n${securityAudit.warnings.join("\n\n")}\n\nRun script anyway?`)) return;

    if (window.webkit?.messageHandlers?.bookmarkletBridge) {
      window.webkit.messageHandlers.bookmarkletBridge.postMessage(code);
    } else if (window.browserAPI?.runBookmarklet) {
      window.browserAPI.runBookmarklet(code);
    } else if (window.pyqtBridge) {
      window.pyqtBridge.execute(code);
    } else {
      appendToConsole('info', `Simulated local execution of clean script.`);
    }
  };

  const sendNavAction = (action, targetUrl = null) => {
    const payload = { type: 'BROWSER_ACTION', action, url: targetUrl };
    if (window.browserAPI?.sendNavAction) window.browserAPI.sendNavAction(payload);
    if (action === 'GOTO' && targetUrl) { setCurrentUrl(targetUrl); setInputUrl(targetUrl); }
  };

  const handleUaChange = (key) => {
    setActiveUaKey(key);
    if (window.browserAPI?.setUserAgent) window.browserAPI.setUserAgent({ type: 'SET_USER_AGENT', uaString: UA_PROFILES[key].string });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const result = processAndValidateBookmarklet(rawCode);
    if (!result.isValid) return setValidationError(result.error);
    await db.bookmarklets.add({ title, category, rawCode, cleanCode: result.cleanCode });
    setTitle(''); setRawCode(''); setValidationError(null);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    const result = processAndValidateBookmarklet(editRawCode);
    if (!result.isValid) return setEditError(result.error);
    await db.bookmarklets.update(editingId, { title: editTitle, category: editCategory, rawCode: editRawCode, cleanCode: result.cleanCode });
    setEditingId(null);
  };

  const handleExport = async () => {
    const records = await db.bookmarklets.toArray();
    const blob = new Blob([JSON.stringify({ version: 1, data: records }, null, 2)], { type: 'application/json' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `backup.json`; link.click();
  };

  const handleImport = (e) => {
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const parsed = JSON.parse(evt.target.result);
      for (const item of parsed.data) {
        await db.bookmarklets.add({ title: item.title, category: item.category, rawCode: item.rawCode, cleanCode: item.cleanCode });
      }
    };
    reader.readAsText(e.target.files[0]);
  };

  const handleClearCache = () => {
    if (window.browserAPI?.clearCacheData) window.browserAPI.clearCacheData();
  };

  const handleProxySubmit = (e) => {
    e.preventDefault();
    if (window.browserAPI?.setProxyConfig) {
      window.browserAPI.setProxyConfig({ enabled: true, rules: `http=${proxyIp}:${proxyPort};https=${proxyIp}:${proxyPort}` });
      setIsProxyActive(true);
    }
  };

  const filtered = bookmarklets.filter(b => (selectedCategory === 'ALL' || b.category === selectedCategory) && b.title.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '20px', maxWidth: '1000px', margin: '0 auto', background: '#f8f9fa' }}>
      {/* TOOLBAR */}
      <div style={{ display: 'flex', gap: '8px', background: '#e9ecef', padding: '10px', borderRadius: '8px', marginBottom: '15px', alignItems: 'center' }}>
        <button onClick={() => sendNavAction('BACK')} style={{ padding: '6px' }}>◀</button>
        <button onClick={() => sendNavAction('FORWARD')} style={{ padding: '6px' }}>▶</button>
        <button onClick={() => sendNavAction('RELOAD')} style={{ padding: '6px' }}>🔄</button>
        <input style={{ flexGrow: 1, padding: '6px' }} value={inputUrl} onChange={e => setInputUrl(e.target.value)} />
        <button onClick={() => sendNavAction('GOTO', inputUrl)} style={{ padding: '6px 12px', background: '#007bff', color: '#fff' }}>Go</button>
        <select value={activeUaKey} onChange={e => handleUaChange(e.target.value)} style={{ padding: '6px' }}>
          {Object.keys(UA_PROFILES).map(k => <option key={k} value={k}>{UA_PROFILES[k].label}</option>)}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div>
          {/* SYNC & CACHE CONTROL */}
          <div style={{ background: '#fff', padding: '10px', marginBottom: '10px', borderRadius: '6px', border: '1px solid #ddd', display: 'flex', gap: '10px' }}>
            <button onClick={handleExport}>📤 Export</button>
            <label style={{ cursor: 'pointer' }}>📥 Import <input type="file" onChange={handleImport} style={{ display: 'none' }} /></label>
            <button onClick={handleClearCache} style={{ background: '#dc3545', color: '#fff' }}>🗑️ Clear Cache</button>
          </div>

          {/* PROXY PANEL */}
          <form onSubmit={handleProxySubmit} style={{ background: '#fff', padding: '10px', marginBottom: '10px', borderRadius: '6px', border: '1px solid #ddd', display: 'flex', gap: '5px' }}>
            <input placeholder="Proxy IP" value={proxyIp} onChange={e => setProxyIp(e.target.value)} style={{ width: '60%' }} />
            <input placeholder="Port" value={proxyPort} onChange={e => setProxyPort(e.target.value)} style={{ width: '20%' }} />
            <button type="submit" disabled={isProxyActive}>Connect</button>
            {isProxyActive && <button type="button" onClick={() => { window.browserAPI.setProxyConfig({ enabled: false }); setIsProxyActive(false); }}>X</button>}
          </form>

          {/* SCRATCHPAD QUICK INJECTOR */}
          <div style={{ background: '#fff', padding: '10px', marginBottom: '10px', borderRadius: '6px', border: '1px solid #ddd' }}>
            <input placeholder="Quick script payload..." value={scratchpadCode} onChange={e => setScratchpadCode(e.target.value)} style={{ width: '75%', padding: '6px' }} />
            <button onClick={handleInstantInject} style={{ width: '20%', padding: '6px', marginLeft: '5px' }}>Inject</button>
          </div>

          {/* INTAKE CREATION FORM */}
          <form onSubmit={handleSave} style={{ background: '#fff', padding: '15px', borderRadius: '6px', border: '1px solid #ddd', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h3>Create Script</h3>
            <input placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} required />
            <input placeholder="Category" value={category} onChange={e => setCategory(e.target.value)} />
            <textarea placeholder="Paste payload raw code..." value={rawCode} onChange={e => setRawCode(e.target.value)} required rows={4} />
            {validationError && <p style={{ color: 'red' }}>{validationError}</p>}
            <button type="submit">Save Bookmarklet</button>
          </form>
        </div>

        {/* MOCK WORKSPACE PLAYGROUND SANDBOX */}
        <div>
          <input placeholder="🔍 Filter local UI..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ width: '100%', padding: '8px', marginBottom: '10px' }} />
          <div style={{ maxH: '400px', overflowY: 'auto' }}>{filtered.map(b => (<div key={b.id} style={{ background: '#fff', padding: '10px', borderRadius: '4px', border: '1px solid #eee', marginBottom: '8px' }}>{editingId === b.id ? (

          <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>

          <input value={editTitle} onChange={e => setEditTitle(e.target.value)} required />

          <input value={editCategory} onChange={e => setEditCategory(e.target.value)} />

          <textarea value={editRawCode} onChange={e => setEditRawCode(e.target.value)} required />
          Update) : (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>{b.title} ({b.category})<button onClick={() => handleExecute(b.cleanCode)}>Run
          <button onClick={() => { setEditingId(b.id); setEditTitle(b.title); setEditCategory(b.category); setEditRawCode(b.rawCode); }}>Edit
)}
))}
{/* TERMINAL ACTIVITY CONSOLE LOGGER */}
<div style={{ background: '#1e1e1e', color: '#00ff00', padding: '12px', marginTop: '15px', borderRadius: '6px', fontFamily: 'monospace' }}>
Output Terminal Logger Feed:
<div style={{ maxH: '120px', overflowY: 'auto', fontSize: '12px', marginTop: '5px' }}>
{logs.map(l => [{l.timestamp}] {l.type.toUpperCase()}: {l.text})}
);
function handleInstantInject(e) {
e.preventDefault();
const result = processAndValidateBookmarklet(scratchpadCode);
if (result.isValid) handleExecute(result.cleanCode);
}
}
function SandboxView({ currentUrl, appendToConsole }) {
const [val, setVal] = useState('');
const [checked, setChecked] = useState(false);
return (
<div style={{ background: '#e9ecef', padding: '15px', borderRadius: '6px', marginTop: '10px' }}>
🛝 Playground Viewport Workspace
<p style={{ fontSize: '11px' }}>Context URL: {currentUrl}
<input id="email-field" placeholder="Target Input Field ID: 'email-field'" value={val} onChange={e => setVal(e.target.value)} style={{ width: '100%', marginBottom: '5px' }} />
<input type="checkbox" className="agree-checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} /> Checkbox Class: 'agree-checkbox'
<div className="stock-status" style={{ background: '#fff', padding: '8px', marginTop: '5px', fontWeight: 'bold' }}>Temporarily Unavailable
<button onClick={() => { appendToConsole('log', 'Simulated execution trigger submitted.'); alert(Email: ${val}, Checked: ${checked}); }} style={{ marginTop: '5px' }}>Submit Container Form

);
}
// Add this entry inside your UA_PROFILES object to support iPad structures:
IPAD_SAFARI: { 
  label: "🍏 iPad kubu's Tablet", 
  string: "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1" 
}
