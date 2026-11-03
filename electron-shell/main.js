const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;
let targetWebpageView; 

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1300, height: 850,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false
    }
  });

  mainWindow.loadURL('http://localhost:3000');

  // Secondary sub-window container hosting the target webpage
  targetWebpageView = new BrowserWindow({
    width: 1300, height: 400, parent: mainWindow, frame: true,
    webPreferences: { contextIsolation: true }
  });
  targetWebpageView.loadURL('https://example.com');

  targetWebpageView.webContents.on('did-navigate', (e, url) => {
    mainWindow.webContents.send('target-url-changed', url);
  });

  targetWebpageView.webContents.on('console-message', (e, level, msg, line) => {
    const types = ['log', 'log', 'info', 'error'];
    mainWindow.webContents.send('runtime-console-log', { type: types[level] || 'log', message: `[Page Context] ${msg} (Line: ${line})` });
  });
}

ipcMain.on('execute-bookmarklet', (e, rawCode) => {
  const cleanCode = decodeURIComponent(rawCode.replace(/^javascript:/i, ''));
  targetWebpageView.webContents.executeJavaScript(cleanCode).catch(err => console.error(err));
});

ipcMain.on('native-browser-control', (e, p) => {
  const wc = targetWebpageView.webContents;
  if (p.action === 'BACK' && wc.canGoBack()) wc.goBack();
  if (p.action === 'FORWARD' && wc.canGoForward()) wc.goForward();
  if (p.action === 'RELOAD') wc.reload();
  if (p.action === 'GOTO') wc.loadURL(p.url);
});

ipcMain.on('native-user-agent-toggle', (e, p) => {
  targetWebpageView.webContents.setUserAgent(p.uaString);
  targetWebpageView.webContents.reload();
});

ipcMain.on('native-clear-cache-data', () => {
  targetWebpageView.webContents.session.clearStorageData().then(() => targetWebpageView.webContents.reload());
});

ipcMain.on('native-set-proxy-config', (e, p) => {
  const session = targetWebpageView.webContents.session;
  p.enabled ? session.setProxy({ proxyRules: p.rules }).then(() => targetWebpageView.webContents.reload()) : session.setProxy({ mode: 'direct' });
});

app.whenReady().then(createWindow);
