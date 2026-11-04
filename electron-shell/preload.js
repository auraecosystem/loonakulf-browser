const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('browserAPI', {
  runBookmarklet: (code) => ipcRenderer.send('execute-bookmarklet', code),
  sendNavAction: (payload) => ipcRenderer.send('native-browser-control', payload),
  setUserAgent: (payload) => ipcRenderer.send('native-user-agent-toggle', payload),
  clearCacheData: () => ipcRenderer.send('native-clear-cache-data'),
  setProxyConfig: (payload) => ipcRenderer.send('native-set-proxy-config', payload),
  getLmlmStatus: () => ipcRenderer.invoke('lmlm:get-status'),
  askLmlm: (payload) => ipcRenderer.invoke('lmlm:assist', payload),
  saveCurrentPageToLmlm: () => ipcRenderer.invoke('lmlm:save-page')
});

ipcRenderer.on('target-url-changed', (event, url) => {
  window.updateBrowserAddressBar?.(url);
});

ipcRenderer.on('runtime-console-log', (event, data) => {
  window.postMessage({ type: 'NATIVE_CONSOLE_LOG', logType: data.type, message: data.message }, '*');
});
