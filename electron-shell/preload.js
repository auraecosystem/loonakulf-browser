const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('browserAPI', {
  runBookmarklet: (request) => ipcRenderer.invoke("execute-bookmarklet", request),
  sendNavAction: (payload) => ipcRenderer.send('native-browser-control', payload),
  setUserAgent: (payload) => ipcRenderer.send('native-user-agent-toggle', payload),
  clearCacheData: () => ipcRenderer.send('native-clear-cache-data'),
  setProxyConfig: (payload) => ipcRenderer.send('native-set-proxy-config', payload)
});

ipcRenderer.on('target-url-changed', (event, url) => {
  window.updateBrowserAddressBar?.(url);
});

ipcRenderer.on('runtime-console-log', (event, data) => {
  window.postMessage({ type: 'NATIVE_CONSOLE_LOG', logType: data.type, message: data.message }, '*');
});
