const { app, BrowserWindow } = require('electron');

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      webviewTag: true, // Enables <webview> in your Vue template
      contextIsolation: true
    }
  });

  // Load your Vite dev server or built index.html
  win.loadURL('http://localhost:5173');
});
