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
function SandboxTestingEnvironment({ currentUrl, onPageChange }) {
  const [stockCount, setStockCount] = useState(0);
  const [isChecked, setIsChecked] = useState(false);
  const [emailText, setEmailText] = useState('');

  // Automatically reset mock layout properties when navigating away
  useEffect(() => {
     setStockCount(0);
     setIsChecked(false);
     setEmailText('');
  }, [currentUrl]);

  return (
    <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px solid #dee2e6' }}>
      <h3 style={{ marginTop: 0, color: '#495057' }}>🛝 Local Mock Target Page Playground</h3>
      <p style={{ fontSize: '12px', color: '#6c757d' }}>Mock Active URL Context: <code style={{ background: '#eee', padding: '2px 4px' }}>{currentUrl}</code></p>
      
      <div id="mock-webpage-viewport" style={{ background: '#fff', padding: '20px', borderRadius: '6px', border: '1px solid #ced4da', minHeight: '300px' }}>
        
        {/* Element 1: Form Auto Fill targets */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 'bold' }}>Target Input (ID: "email-field")</label>
          <input 
            type="email" 
            id="email-field" 
            value={emailText} 
            onChange={(e) => setEmailText(e.target.value)}
            placeholder="Waiting for script filling..." 
            style={{ width: '100%', padding: '6px', boxSizing: 'border-box' }}
          />
        </div>

        {/* Element 2: Agreement Checkbox target */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 'bold' }}>
            <input 
              type="checkbox" 
              className="agree-checkbox" 
              checked={isChecked}
              onChange={(e) => setIsChecked(e.target.checked)}
            />
            Target Checkbox (Class: "agree-checkbox")
          </label>
        </div>

        {/* Element 3: Dynamic Stock tracker logic target */}
        <div style={{ background: '#fff3cd', padding: '12px', borderRadius: '4px', border: '1px solid #ffeeba', marginBottom: '15px' }}>
          <span style={{ fontSize: '13px', fontWeight: 'bold' }}>Stock Target (Class: "stock-status"):</span>
          <div className="stock-status" style={{ fontSize: '18px', fontWeight: 'bold', color: stockCount >= 3 ? 'green' : 'red', marginTop: '4px' }}>
            {stockCount >= 3 ? '✅ In Stock - Order Now!' : 'Temporarily Unavailable'}
          </div>
          <button 
            onClick={() => setStockCount(prev => prev + 1)}
            style={{ marginTop: '8px', padding: '4px 8px', fontSize: '11px', background: '#6c757d', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
          >
            Simulate Automation Page Reload Counter (+1)
          </button>
        </div>

        <div style={{ textAlign: 'right' }}>
           <button 
             type="submit" 
             onClick={() => alert(`Submitted parameters:\nEmail: ${emailText}\nChecked: ${isChecked}`)}
             style={{ padding: '6px 12px', background: '#17a2b8', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
           >
             Submit Form
           </button>
        </div>

      </div>
      <small style={{ color: '#6c757d', marginTop: '10px', display: 'block', lineHeight: '1.4' }}>
        💡 <strong>How to test:</strong> Paste code options into the manager input field on the left. Click "Run" next to your processed bookmarklet. It will execute immediately on this target panel!
      </small>
    </div>
  );
}
