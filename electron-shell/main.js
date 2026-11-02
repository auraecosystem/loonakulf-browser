// electron-shell/main.js additions
ipcMain.on('native-browser-control', (event, payload) => {
  if (!targetWebpageView) return;
  
  switch (payload.action) {
    case 'BACK': if (targetWebpageView.webContents.canGoBack()) targetWebpageView.webContents.goBack(); break;
    case 'FORWARD': if (targetWebpageView.webContents.canGoForward()) targetWebpageView.webContents.goForward(); break;
    case 'RELOAD': targetWebpageView.webContents.reload(); break;
    case 'GOTO': targetWebpageView.webContents.loadURL(payload.url); break;
  }
});

// Inside your window creation sequence, anchor navigation updates:
targetWebpageView.webContents.on('did-navigate', (event, url) => {
    mainWindow.webContents.send('target-url-changed', url);
});
targetWebpageView.webContents.on('did-navigate-in-page', (event, url) => {
    mainWindow.webContents.send('target-url-changed', url);
});
