// electron-shell/preload.js additions
contextBridge.exposeInMainWorld('browserAPI', {
    runBookmarklet: (code) => ipcRenderer.send('execute-bookmarklet', code),
    sendNavAction: (payload) => ipcRenderer.send('native-browser-control', payload)
});

// Listener letting the frontend know when a browser tab changed URLs implicitly
ipcRenderer.on('target-url-changed', (event, url) => {
    window.postMessage({ type: 'NAVIGATED', url }, '*');
});
