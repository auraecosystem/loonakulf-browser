import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { processAndValidateBookmarklet } from './parser';

export default function App() {
  // Form states
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('General');
  const [rawCode, setRawCode] = useState('');
  const [validationError, setValidationError] = useState(null);

  // Automatically read bookmarklets out of IndexedDB in real-time
  const bookmarklets = useLiveQuery(() => db.bookmarklets.toArray()) || [];

  const handleSaveBookmarklet = async (e) => {
    e.preventDefault();
    setValidationError(null);

    // Pass the text input directly to our validation engine
    const parsingResult = processAndValidateBookmarklet(rawCode);

    if (!parsingResult.isValid) {
      setValidationError(parsingResult.error);
      return;
    }

    try {
      // Save the record to IndexedDB local device storage
      await db.bookmarklets.add({
        title,
        category,
        rawCode,
        cleanCode: parsingResult.cleanCode
      });

      // Clear Form Fields on Success
      setTitle('');
      setRawCode('');
    } catch (err) {
      setValidationError("Failed to commit changes to local disk framework.");
    }
  };

  const handleDelete = async (id) => {
    await db.bookmarklets.delete(id);
  };

  const handleExecute = (code) => {
    // Route clean optimized string code to native shells
    if (window.webkit?.messageHandlers?.bookmarkletBridge) {
      window.webkit.messageHandlers.bookmarkletBridge.postMessage(code);
    } else if (window.browserAPI?.runBookmarklet) {
      window.browserAPI.runBookmarklet(code);
    } else if (window.pyqtBridge) {
      window.pyqtBridge.execute(code);
    } else {
      alert("Standalone Mode: Code verified and ready for execution contexts.");
    }
  };

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h2>Bookmarklet Manager Dashboard</h2>

      {/* 📥 Input Submission Form Container */}
      <form onSubmit={handleSaveBookmarklet} style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: '#fff', padding: '15px', borderRadius: '6px', border: '1px solid #ddd' }}>
        <h3>Add New Script</h3>
        <input type="text" placeholder="Script Name (e.g., Auto Fill Form)" value={title} onChange={e => setTitle(e.target.value)} required style={{ padding: '8px' }} />
        <input type="text" placeholder="Category (e.g., Shopping, Productivity)" value={category} onChange={e => setCategory(e.target.value)} style={{ padding: '8px' }} />
        <textarea rows="5" placeholder="Paste your dirty javascript here..." value={rawCode} onChange={e => setRawCode(e.target.value)} required style={{ padding: '8px', fontFamily: 'monospace' }} />
        
        {validationError && <div style={{ color: 'red', fontSize: '14px' }}>{validationError}</div>}
        <button type="submit" style={{ padding: '10px', background: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Process & Save Bookmarklet</button>
      </form>

      {/* 📋 Local Saved Library List Display */}
      <h3 style={{ marginTop: '30px' }}>Your Saved Scripts Library ({bookmarklets.length})</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {bookmarklets.map(bml => (
          <div key={bml.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: '#f9f9f9', borderRadius: '4px', border: '1px solid #eee' }}>
            <div>
              <strong>{bml.title}</strong> <span style={{ fontSize: '12px', color: '#666', background: '#e0e0e0', padding: '2px 6px', borderRadius: '10px', marginLeft: '5px' }}>{bml.category}</span>
              <div style={{ fontSize: '11px', color: '#999', fontFamily: 'monospace', maxWidth: '500px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '4px' }}>{bml.cleanCode}</div>
            </div>
            <div style={{ display: 'flex', gap: '5px' }}>
              <button onClick={() => handleExecute(bml.cleanCode)} style={{ padding: '6px 12px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Run</button>
              <button onClick={() => handleDelete(bml.id)} style={{ padding: '6px 12px', background: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
