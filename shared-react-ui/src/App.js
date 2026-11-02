import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { processAndValidateBookmarklet } from './parser';

export default function App() {
  const [currentUrl, setCurrentUrl] = useState('https://example.com');
  const [inputUrl, setInputUrl] = useState('https://example.com');

  // Listen for messages from Native Shells updating the current URL when clicking a link
  useEffect(() => {
    const handleNativeNavigationEvent = (event) => {
      // Handle Electron/Web messages
      if (event.data && event.data.type === 'NAVIGATED') {
        setCurrentUrl(event.data.url);
        setInputUrl(event.data.url);
      }
    };
    window.addEventListener('message', handleNativeNavigationEvent);
    
    // Global listener window callback for native platforms (PyQt/Swift)
    window.updateBrowserAddressBar = (url) => {
      setCurrentUrl(url);
      setInputUrl(url);
    };

    return () => window.removeEventListener('message', handleNativeNavigationEvent);
  }, []);

  // Universal Navigation Dispatcher
  const sendNavAction = (action, targetUrl = null) => {
    const payload = { type: 'BROWSER_ACTION', action, url: targetUrl };
    
    if (window.webkit?.messageHandlers?.browserControlBridge) {
      window.webkit.messageHandlers.browserControlBridge.postMessage(payload);
    } else if (window.browserAPI?.sendNavAction) {
      window.browserAPI.sendNavAction(payload);
    } else if (window.pyqtNavBridge) {
      window.pyqtNavBridge.navigate(action, targetUrl || '');
    } else {
      // Local testing mode fallback toggles the active mockup frame
      if (action === 'GOTO' && targetUrl) setCurrentUrl(targetUrl);
    }
  };

  const handleGo = (e) => {
    e.preventDefault();
    let url = inputUrl.trim();
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    setInputUrl(url);
    sendNavAction('GOTO', url);
  };

  // ... (Keep form handlers and Bookmarklet database states from your previous step)
  return (
    <div style={{ fontFamily: 'sans-serif', padding: '20px', maxWidth: '900px', margin: '0 auto', background: '#fff', minHeight: '100vh' }}>
      
      {/* 🌐 Fully Functional Synchronized Navigation Toolbar Bar */}
      <div style={{ display: 'flex', gap: '8px', background: '#e9ecef', padding: '10px', borderRadius: '8px', marginBottom: '25px', alignItems: 'center' }}>
        <button onClick={() => sendNavAction('BACK')} style={navBtnStyle}>◀ Back</button>
        <button onClick={() => sendNavAction('FORWARD')} style={navBtnStyle}>Forward ▶</button>
        <button onClick={() => sendNavAction('RELOAD')} style={navBtnStyle}>🔄 Reload</button>
        
        <form onSubmit={handleGo} style={{ flexGrow: 1, display: 'flex', gap: '6px' }}>
          <input 
            type="text" 
            value={inputUrl} 
            onChange={(e) => setInputUrl(e.target.value)} 
            style={{ flexGrow: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ced4da' }} 
          />
          <button type="submit" style={{ padding: '8px 16px', background: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>Go</button>
        </form>
      </div>

      {/* Grid container to organize script inputs side by side with the playground */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div>
           {/* Paste your Add New Script Form and Stored Library JSX components here */}
        </div>
        
        {/* Sandbox target container frame placement */}
        <div style={{ borderLeft: '2px dashed #ccc', paddingLeft: '20px' }}>
           <SandboxTestingEnvironment currentUrl={currentUrl} onPageChange={(url) => { setCurrentUrl(url); setInputUrl(url); }} />
        </div>
      </div>
    </div>
  );
}

const navBtnStyle = { padding: '8px 12px', background: '#fff', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer' };
