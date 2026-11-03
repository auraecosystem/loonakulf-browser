// Add into your electron-shell/main.js file
const DESKTOP_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

// Updated with your specific parsed target mobile profile 
const MOBILE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 27_0_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/155.0.8059.37 Mobile/15E148 Safari/604.1";

ipcMain.on('native-user-agent-toggle', (event, payload) => {
  if (!targetWebpageView) return;

  const targetAgentString = payload.profile === 'MOBILE' ? MOBILE_UA : DESKTOP_UA;
  
  // Set headers and reload active session
  targetWebpageView.webContents.setUserAgent(targetAgentString);
  targetWebpageView.webContents.reload();
  
  console.log(`[UA Switcher] Engine swapped tab to profile layout: ${payload.profile}`);
});
